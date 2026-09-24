import json
import secrets
import tempfile
from datetime import timedelta
from pathlib import Path

from bson import ObjectId
from fastapi import APIRouter, Depends, File, Header, HTTPException, Query, Request, UploadFile
from fastapi.responses import StreamingResponse
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.auth import router as auth_router
from app.db import audit, oid, public, utcnow
from app.schemas import Consent, Profile, WalkSession
from app.security import REQUIRED_CONSENTS, current_user, require_consents, throttle
from app.storage import probe_video, save_upload

VERSION = "0.2.0"
router = APIRouter()
router.include_router(auth_router)


@router.get("/capabilities", tags=["configuration"])
def capabilities():
    return {"schemaVersion": 2, "pipelineVersion": VERSION, "reportType": "measurement_report",
            "views": ["front", "side_left", "side_right"], "clinicalModelsEnabled": False,
            "healthScoreEnabled": False, "researchSharingEnabled": False, "requiresWorker": True}


def owned(db, collection, value, user_id):
    doc = db[collection].find_one({"_id": oid(value), "userId": user_id})
    if not doc:
        raise HTTPException(404, "Resource not found")
    return doc


def page(db, collection, query, before, limit, projection=None):
    if before:
        query = {**query, "_id": {"$lt": oid(before)}}
    items = list(db[collection].find(query, projection).sort("_id", -1).limit(limit + 1))
    return {"items": public(items[:limit]),
            "nextCursor": str(items[limit - 1]["_id"]) if len(items) > limit else None}


@router.get("/me", tags=["account"])
def me(user=Depends(current_user)):
    return public({k: v for k, v in user.items() if k in ("_id", "email", "role", "status", "createdAt")})


@router.get("/me/profile", tags=["account"])
def get_profile(request: Request, user=Depends(current_user)):
    return public(request.app.state.db.participant_profiles.find_one({"userId": user["_id"]}))


@router.put("/me/profile", tags=["account"])
def put_profile(body: Profile, request: Request, user=Depends(current_user)):
    db = request.app.state.db
    if body.yearOfBirth is not None and body.yearOfBirth > utcnow().year - 18:
        raise HTTPException(422, "This research prototype supports adults only")
    # Omit unset optional fields; MongoDB validators do not interpret null as unknown.
    values = body.model_dump(exclude_none=True)
    update = {"$set": {**values, "updatedAt": utcnow()}, "$setOnInsert": {"createdAt": utcnow()}}
    remove = {key: "" for key in body.model_fields_set if key not in values}
    if remove:
        update["$unset"] = remove
    return public(db.participant_profiles.find_one_and_update({"userId": user["_id"]}, update,
                  upsert=True, return_document=ReturnDocument.AFTER))


@router.get("/consent-documents", tags=["consent"])
def consent_documents(request: Request):
    return public(list(request.app.state.db.consent_documents.find({"isActive": True})))


@router.get("/me/consents", tags=["consent"])
def consents(request: Request, user=Depends(current_user)):
    return public(list(request.app.state.db.consents.find({"userId": user["_id"]})))


@router.post("/me/consents", tags=["consent"])
def consent(body: Consent, request: Request, user=Depends(current_user)):
    db = request.app.state.db
    if body.type == "research_data" and body.status == "accepted":
        raise HTTPException(409, "Research data sharing is not enabled")
    if not db.consent_documents.find_one({"type": body.type, "version": body.documentVersion, "isActive": True}):
        raise HTTPException(422, "Unknown or inactive consent document")
    doc = db.consents.find_one_and_update({"userId": user["_id"], "type": body.type,
            "documentVersion": body.documentVersion},
        {"$set": {"status": body.status, "recordedAt": utcnow()}}, upsert=True,
        return_document=ReturnDocument.AFTER)
    audit(db, user["_id"], f"consent.{body.type}.{body.status}", "consent", doc["_id"])
    if body.type in REQUIRED_CONSENTS and body.status != "accepted":
        db.walk_sessions.update_many({"userId": user["_id"], "status": {"$in": ["queued", "processing"]}},
                                     {"$set": {"status": "cancelled", "updatedAt": utcnow()}})
        db.processing_jobs.update_many({"userId": user["_id"], "status": "queued"},
                                       {"$set": {"status": "cancelled", "updatedAt": utcnow()}})
    return public(doc)


@router.get("/capture-protocols", tags=["sessions"])
def protocols(request: Request):
    return public(list(request.app.state.db.capture_protocols.find()))


@router.post("/sessions", tags=["sessions"], status_code=201)
def create_session(body: WalkSession, request: Request, user=Depends(current_user),
                   idempotency_key: str = Header(min_length=1, max_length=100)):
    db = request.app.state.db
    require_consents(db, user["_id"])
    throttle(db, f"create-session:{user['_id']}", 30, 3600)
    now = utcnow()
    doc = {"userId": user["_id"], "status": "created", "protocolVersion": body.protocolVersion,
           "idempotencyKey": idempotency_key, "capture": {"angle": body.angle, "device": {"platform": body.platform}},
           "quality": {"status": "pending", "checks": {}}, "createdAt": now, "updatedAt": now}
    if body.capturedAt:
        doc["capturedAt"] = body.capturedAt
    try:
        db.walk_sessions.insert_one(doc)
    except DuplicateKeyError:
        doc = db.walk_sessions.find_one({"userId": user["_id"], "idempotencyKey": idempotency_key})
        if (doc["capture"]["angle"] != body.angle or doc["capture"]["device"]["platform"] != body.platform
                or doc.get("capturedAt") != body.capturedAt):
            raise HTTPException(409, "Idempotency key already used for a different request") from None
    return public(doc)


@router.get("/sessions", tags=["sessions"])
def sessions(request: Request, before: str | None = None, limit: int = Query(20, ge=1, le=100),
             user=Depends(current_user)):
    return page(request.app.state.db, "walk_sessions", {"userId": user["_id"]}, before, limit)


@router.get("/sessions/{session_id}", tags=["sessions"])
def session(session_id: str, request: Request, user=Depends(current_user)):
    return public(owned(request.app.state.db, "walk_sessions", session_id, user["_id"]))


@router.post("/sessions/{session_id}/video", tags=["media"], status_code=201)
def upload(session_id: str, request: Request, file: UploadFile = File(), user=Depends(current_user)):
    db, settings, storage = request.app.state.db, request.app.state.settings, request.app.state.storage
    require_consents(db, user["_id"])
    owned(db, "walk_sessions", session_id, user["_id"])
    token = secrets.token_hex(16)
    doc = db.walk_sessions.find_one_and_update({"_id": oid(session_id), "userId": user["_id"], "status": "created"},
        {"$set": {"status": "uploading", "uploadToken": token,
                  "uploadExpiresAt": utcnow() + timedelta(minutes=15), "updatedAt": utcnow()}},
        return_document=ReturnDocument.AFTER)
    if not doc:
        raise HTTPException(409, "Session already has an upload or is busy. Create a new session to replace a video.")
    key = f"{user['_id']}/{session_id}/{token}.video"
    asset_id = ObjectId()
    try:
        with tempfile.TemporaryDirectory(prefix="gaitsense-upload-") as directory:
            path = Path(directory) / "video.bin"
            size, sha = save_upload(file.file, path, settings.max_upload_mb * 1024 * 1024)
            metadata, content_type = probe_video(path)
            # Recheck consent after a potentially long upload.
            require_consents(db, user["_id"])
            stored = storage.put(path, key)
        db.media_assets.insert_one({"_id": asset_id, "userId": user["_id"], "sessionId": doc["_id"],
            "kind": "source_video", "storage": stored, "contentType": content_type, "sizeBytes": size,
            "sha256": sha, "createdAt": utcnow(), "expiresAt": utcnow() + timedelta(days=settings.video_retention_days)})
        changed = db.walk_sessions.update_one({"_id": doc["_id"], "status": "uploading", "uploadToken": token},
            {"$set": {"status": "uploaded", "capture": {**doc["capture"], **metadata}, "updatedAt": utcnow()},
             "$unset": {"uploadToken": "", "uploadExpiresAt": ""}})
        if not changed.modified_count:
            raise HTTPException(409, "Session was cancelled or deleted during upload")
        return {"id": str(asset_id), "sessionId": session_id, "sizeBytes": size, "sha256": sha, "capture": metadata}
    except Exception:
        storage.delete(key)
        db.media_assets.delete_one({"_id": asset_id})
        db.walk_sessions.update_one({"_id": doc["_id"], "status": "uploading", "uploadToken": token},
            {"$set": {"status": "created", "updatedAt": utcnow()}, "$unset": {"uploadToken": "", "uploadExpiresAt": ""}})
        raise
    finally:
        file.file.close()


@router.get("/sessions/{session_id}/media", tags=["media"])
def media_list(session_id: str, request: Request, user=Depends(current_user)):
    db = request.app.state.db
    owned(db, "walk_sessions", session_id, user["_id"])
    return public(list(db.media_assets.find({"sessionId": oid(session_id), "userId": user["_id"],
        "expiresAt": {"$gt": utcnow()}}, {"storage": 0})))


@router.get("/media/{media_id}/content", tags=["media"])
def media_content(media_id: str, request: Request, user=Depends(current_user)):
    db = request.app.state.db
    item = owned(db, "media_assets", media_id, user["_id"])
    session = owned(db, "walk_sessions", str(item["sessionId"]), user["_id"])
    if session["status"] == "deleting" or (item.get("expiresAt") and item["expiresAt"] <= utcnow()):
        raise HTTPException(410, "Media has expired or is being deleted")
    try:
        request.app.state.storage.check_location(item)
    except ValueError:
        raise HTTPException(503, "The media storage configuration needs operator attention") from None
    return StreamingResponse(request.app.state.storage.stream(item["storage"]["key"]), media_type=item["contentType"],
                             headers={"Content-Disposition": 'attachment; filename="walking-video"'})


@router.post("/sessions/{session_id}/process", tags=["processing"], status_code=202)
def process(session_id: str, request: Request, user=Depends(current_user)):
    db = request.app.state.db
    require_consents(db, user["_id"])
    session = owned(db, "walk_sessions", session_id, user["_id"])
    existing = db.processing_jobs.find_one({"sessionId": session["_id"], "pipelineVersion": VERSION})
    if existing and existing["status"] in ("queued", "running", "succeeded") and session["status"] != "cancelled":
        return public(existing)
    if session["status"] not in ("uploaded", "failed", "cancelled"):
        raise HTTPException(409, "Upload a video first; this session cannot be queued")
    if existing and existing["status"] == "running":
        raise HTTPException(409, "Cancellation is still being acknowledged by the worker")
    if not db.media_assets.find_one({"sessionId": session["_id"], "kind": "source_video", "expiresAt": {"$gt": utcnow()}}):
        raise HTTPException(410, "Source video is unavailable or expired; create a new session")
    throttle(db, f"processing:{user['_id']}", 20, 3600)
    changed = db.walk_sessions.update_one({"_id": session["_id"], "status": session["status"]},
        {"$set": {"status": "queued", "updatedAt": utcnow()}, "$unset": {"processingError": "", "activeRunId": ""}})
    if not changed.modified_count:
        raise HTTPException(409, "Session changed; retry")
    job = {"sessionId": session["_id"], "userId": user["_id"], "jobType": "pipeline", "pipelineVersion": VERSION,
           "status": "queued", "attempt": 0, "maxAttempts": 3, "availableAt": utcnow(), "updatedAt": utcnow()}
    db.processing_jobs.update_one({"sessionId": session["_id"], "pipelineVersion": VERSION},
                                  {"$set": job, "$setOnInsert": {"createdAt": utcnow()}}, upsert=True)
    return public(db.processing_jobs.find_one({"sessionId": session["_id"], "pipelineVersion": VERSION}))


@router.get("/jobs/{job_id}", tags=["processing"])
def job(job_id: str, request: Request, user=Depends(current_user)):
    result = owned(request.app.state.db, "processing_jobs", job_id, user["_id"])
    result.pop("lockedBy", None)
    return public(result)


@router.post("/sessions/{session_id}/cancel", tags=["processing"], status_code=202)
def cancel(session_id: str, request: Request, user=Depends(current_user)):
    db = request.app.state.db
    item = owned(db, "walk_sessions", session_id, user["_id"])
    if item["status"] in ("completed", "deleting"):
        raise HTTPException(409, "Completed reports cannot be cancelled; use deletion")
    db.walk_sessions.update_one({"_id": item["_id"], "status": {"$nin": ["completed", "deleting"]}},
                               {"$set": {"status": "cancelled", "updatedAt": utcnow()}})
    db.processing_jobs.update_many({"sessionId": item["_id"], "status": "queued"},
                                  {"$set": {"status": "cancelled", "updatedAt": utcnow()}})
    return {"status": "cancelled"}


@router.delete("/sessions/{session_id}", tags=["privacy"], status_code=202)
def delete_session(session_id: str, request: Request, user=Depends(current_user)):
    db = request.app.state.db
    item = owned(db, "walk_sessions", session_id, user["_id"])
    db.walk_sessions.update_one({"_id": item["_id"]}, {"$set": {"status": "deleting", "updatedAt": utcnow()}})
    audit(db, user["_id"], "session.deletion_requested", "session", item["_id"])
    return {"status": "deleting", "message": "The worker removes files and dependent records before the session."}


def report(db, assessment, user_id):
    session = db.walk_sessions.find_one({"_id": assessment["sessionId"], "userId": user_id,
                                        "status": "completed", "assessmentId": assessment["_id"]})
    if not session:
        raise HTTPException(404, "Published report not found")
    feature = db.gait_features.find_one({"_id": assessment["featureId"], "userId": user_id})
    return public({**assessment, "features": feature})


@router.get("/assessments", tags=["reports"])
def assessments(request: Request, before: str | None = None, limit: int = Query(20, ge=1, le=100),
                user=Depends(current_user)):
    db = request.app.state.db
    # Join through the publication pointer, not every intermediate processing attempt.
    match = {"userId": user["_id"], "status": "completed"}
    if before:
        match["_id"] = {"$lt": oid(before)}
    sessions = list(db.walk_sessions.find(match).sort("_id", -1).limit(limit + 1))
    items = [report(db, db.assessments.find_one({"_id": s["assessmentId"]}), user["_id"]) for s in sessions[:limit]]
    return {"items": items, "nextCursor": str(sessions[limit - 1]["_id"]) if len(sessions) > limit else None}


@router.get("/assessments/{assessment_id}", tags=["reports"])
def assessment(assessment_id: str, request: Request, user=Depends(current_user)):
    db = request.app.state.db
    return report(db, owned(db, "assessments", assessment_id, user["_id"]), user["_id"])


@router.get("/sessions/{session_id}/pose", tags=["reports"])
def pose(session_id: str, request: Request, chunk: int = Query(0, ge=0), user=Depends(current_user)):
    db = request.app.state.db
    item = owned(db, "walk_sessions", session_id, user["_id"])
    if item["status"] != "completed":
        raise HTTPException(409, "Pose replay is available after completion")
    result = db.pose_chunks.find_one({"sessionId": item["_id"], "runId": item["activeRunId"], "chunkIndex": chunk})
    if not result:
        raise HTTPException(404, "Pose chunk not found")
    return public(result)


@router.get("/progress", tags=["reports"])
def progress(request: Request, user=Depends(current_user)):
    db = request.app.state.db
    latest = db.walk_sessions.find_one({"userId": user["_id"], "status": "completed"}, sort=[("_id", -1)])
    if not latest:
        return {"status": "insufficient_data", "changes": {}}
    previous = db.walk_sessions.find_one({"userId": user["_id"], "status": "completed", "_id": {"$lt": latest["_id"]},
        "capture.angle": latest["capture"]["angle"], "protocolVersion": latest["protocolVersion"]}, sort=[("_id", -1)])
    if not previous:
        return {"status": "insufficient_data", "changes": {}}
    current = db.assessments.find_one({"_id": latest["assessmentId"]})
    baseline = db.assessments.find_one({"_id": previous["assessmentId"], "pipelineVersion": current["pipelineVersion"]})
    if not baseline:
        return {"status": "incompatible_pipeline", "changes": {}}
    a = db.gait_features.find_one({"_id": current["featureId"]})["metrics"]
    b = db.gait_features.find_one({"_id": baseline["featureId"]})["metrics"]
    changes = {k: {"current": a[k], "baseline": b[k], "delta": a[k] - b[k]}
               for k in a.keys() & b.keys() if isinstance(a[k], (int, float)) and isinstance(b[k], (int, float))}
    return {"status": "experimental_comparison", "currentAssessmentId": str(current["_id"]),
            "baselineAssessmentId": str(baseline["_id"]), "changes": changes,
            "warning": "A numerical change is not evidence of health improvement or decline."}


@router.get("/me/export", tags=["privacy"])
def export(request: Request, user=Depends(current_user)):
    db = request.app.state.db
    collections = ("participant_profiles", "consents", "walk_sessions", "media_assets", "gait_features", "assessments")

    def records():
        yield json.dumps({"collection": "users", "document": public({k: user[k] for k in ("_id", "email", "createdAt")})}) + "\n"
        for name in collections:
            for item in db[name].find({"userId": user["_id"]}, {"storage": 0, "uploadToken": 0}):
                yield json.dumps({"collection": name, "document": public(item)}) + "\n"
    return StreamingResponse(records(), media_type="application/x-ndjson",
                             headers={"Content-Disposition": 'attachment; filename="gaitsense-export.ndjson"'})


@router.delete("/me", tags=["privacy"], status_code=202)
def delete_account(request: Request, user=Depends(current_user)):
    db = request.app.state.db
    db.users.update_one({"_id": user["_id"]}, {"$set": {"status": "deleted", "updatedAt": utcnow()}})
    db.auth_sessions.update_many({"userId": user["_id"]}, {"$set": {"revokedAt": utcnow()}})
    db.walk_sessions.update_many({"userId": user["_id"]}, {"$set": {"status": "deleting", "updatedAt": utcnow()}})
    return {"status": "deletion_requested", "message": "Access revoked. Worker will remove account data and videos."}
