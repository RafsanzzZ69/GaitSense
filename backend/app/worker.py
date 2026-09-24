"""Durable MongoDB queue worker. Start separately from the API; safe to run multiple workers."""
import argparse
import logging
import socket
import time
from datetime import timedelta

from bson import ObjectId
from fastapi import HTTPException
from pymongo import ReturnDocument

from app.config import Settings
from app.db import connect, utcnow
from app.pipeline import LIMITATIONS, VERSION, ProcessingError, analyze
from app.security import require_consents
from app.storage import Storage

LEASE_SECONDS = 120
OWNED_COLLECTIONS = ("pose_chunks", "gait_features", "assessments", "processing_jobs",
                     "assessment_recommendations", "progress_snapshots")


class LeaseLost(Exception):
    pass


def enqueue_document(session):
    now = utcnow()
    return {"userId": session["userId"], "sessionId": session["_id"], "pipelineVersion": VERSION,
            "jobType": "pipeline", "status": "queued", "attempt": 0, "maxAttempts": 3,
            "availableAt": now, "createdAt": now, "updatedAt": now}


def maintenance(db, storage):
    now = utcnow()
    # Recover API crashes between the session transition and the queue write.
    for session in db.walk_sessions.find({"status": "queued"}).limit(100):
        db.processing_jobs.update_one({"sessionId": session["_id"], "pipelineVersion": VERSION},
                                     {"$setOnInsert": enqueue_document(session)}, upsert=True)
    # Reconcile a crash immediately after publication and before acknowledging the job.
    for job in db.processing_jobs.find({"status": "running", "leaseUntil": {"$lte": now}}).limit(100):
        session = db.walk_sessions.find_one({"_id": job["sessionId"]})
        status = "queued"
        if not session or session["status"] in ("cancelled", "deleting"):
            status = "cancelled"
        elif session["status"] == "completed":
            status = "succeeded"
        elif job["attempt"] >= job["maxAttempts"]:
            status = "dead_letter"
            db.walk_sessions.update_one({"_id": session["_id"], "status": "processing", "activeRunId": job["runId"]},
                {"$set": {"status": "failed", "updatedAt": now,
                           "processingError": {"code": "WORKER_TIMEOUT", "message": "Worker repeatedly stopped responding", "retryable": True}}})
        db.processing_jobs.update_one({"_id": job["_id"], "runId": job["runId"], "leaseUntil": {"$lte": now}},
            {"$set": {"status": status, "availableAt": now, "updatedAt": now}})
    # Incomplete uploads have deterministic object keys, so a crashed upload can be cleaned up.
    for session in db.walk_sessions.find({"uploadExpiresAt": {"$lte": now}}).limit(100):
        token = session.get("uploadToken")
        if token:
            storage.delete(f"{session['userId']}/{session['_id']}/{token}.video")
            db.media_assets.delete_many({"sessionId": session["_id"]})
        update = {"$unset": {"uploadToken": "", "uploadExpiresAt": ""}, "$set": {"updatedAt": now}}
        if session["status"] == "uploading":
            update["$set"]["status"] = "created"
        db.walk_sessions.update_one({"_id": session["_id"], "uploadToken": token}, update)
    for session in db.walk_sessions.find({"status": "deleting"}).limit(100):
        sid = session["_id"]
        if session.get("uploadExpiresAt", now) > now:
            continue
        if db.processing_jobs.find_one({"sessionId": sid, "status": "running", "leaseUntil": {"$gt": now}}):
            continue
        assessment_ids = [a["_id"] for a in db.assessments.find({"sessionId": sid}, {"_id": 1})]
        for asset in db.media_assets.find({"sessionId": sid}):
            storage.delete_asset(asset)
            db.media_assets.delete_one({"_id": asset["_id"]})
        db.assessment_recommendations.delete_many({"assessmentId": {"$in": assessment_ids}})
        db.progress_snapshots.delete_many({"$or": [{"currentAssessmentId": {"$in": assessment_ids}},
                                                   {"baselineAssessmentId": {"$in": assessment_ids}}]})
        for name in OWNED_COLLECTIONS:
            db[name].delete_many({"sessionId": sid})
        db.walk_sessions.delete_one({"_id": sid, "status": "deleting"})
    for asset in db.media_assets.find({"expiresAt": {"$lte": now}}).limit(100):
        if db.processing_jobs.find_one({"sessionId": asset["sessionId"], "status": "running", "leaseUntil": {"$gt": now}}):
            continue
        storage.delete_asset(asset)
        db.media_assets.delete_one({"_id": asset["_id"]})
    for user in db.users.find({"status": "deleted"}).limit(100):
        uid = user["_id"]
        db.walk_sessions.update_many({"userId": uid}, {"$set": {"status": "deleting", "updatedAt": now}})
        if db.walk_sessions.find_one({"userId": uid}):
            continue
        for name in (*OWNED_COLLECTIONS, "participant_profiles", "consents", "auth_sessions", "refresh_tokens"):
            db[name].delete_many({"userId": uid})
        db.audit_events.delete_many({"actor.id": uid})
        db.users.delete_one({"_id": uid, "status": "deleted"})
    # Remove abandoned attempt outputs after a grace period (including stale workers).
    for name in ("pose_chunks", "gait_features", "assessments"):
        for doc in db[name].find({"runId": {"$exists": True}, "createdAt": {"$lt": now - timedelta(hours=1)}}).limit(100):
            if db.walk_sessions.find_one({"_id": doc["sessionId"], "activeRunId": doc["runId"],
                                          "status": {"$in": ["processing", "completed"]}}):
                continue
            db[name].delete_one({"_id": doc["_id"]})


def run_once(db, settings, storage=None, analyzer=analyze):
    storage = storage or Storage(settings)
    now = utcnow()
    run_id = ObjectId()
    job = db.processing_jobs.find_one_and_update(
        {"jobType": "pipeline", "pipelineVersion": VERSION, "status": "queued",
         "availableAt": {"$lte": now}, "$expr": {"$lt": ["$attempt", "$maxAttempts"]}},
        {"$set": {"status": "running", "runId": run_id, "lockedBy": socket.gethostname(),
                  "leaseUntil": now + timedelta(seconds=LEASE_SECONDS), "startedAt": now, "updatedAt": now},
         "$inc": {"attempt": 1}}, sort=[("availableAt", 1)], return_document=ReturnDocument.AFTER)
    if not job:
        return False
    job_filter = {"_id": job["_id"], "runId": run_id, "status": "running"}
    session_filter = {"_id": job["sessionId"], "activeRunId": run_id, "status": "processing"}
    session = db.walk_sessions.find_one_and_update({"_id": job["sessionId"], "userId": job["userId"],
        "status": {"$in": ["queued", "processing"]}},
        {"$set": {"status": "processing", "activeRunId": run_id, "updatedAt": now}},
        return_document=ReturnDocument.AFTER)

    def heartbeat():
        if not session or not db.walk_sessions.find_one(session_filter):
            raise LeaseLost()
        if not db.users.find_one({"_id": job["userId"], "status": "active"}):
            raise LeaseLost()
        try:
            require_consents(db, job["userId"])
        except HTTPException:
            raise LeaseLost() from None
        result = db.processing_jobs.update_one({**job_filter, "leaseUntil": {"$gt": utcnow()}},
            {"$set": {"leaseUntil": utcnow() + timedelta(seconds=LEASE_SECONDS), "updatedAt": utcnow()}})
        if not result.matched_count:
            raise LeaseLost()

    try:
        heartbeat()
        asset = db.media_assets.find_one({"sessionId": job["sessionId"], "userId": job["userId"],
                                         "kind": "source_video", "expiresAt": {"$gt": utcnow()}})
        if not asset:
            raise ProcessingError("VIDEO_UNAVAILABLE", "Source video is missing or expired")
        with storage.materialize_asset(asset) as path:
            result = analyzer(path, settings.pose_model_path, session["capture"]["angle"], heartbeat)
        heartbeat()
        common = {"userId": job["userId"], "sessionId": job["sessionId"], "runId": run_id, "createdAt": utcnow()}
        for offset in range(0, len(result["frames"]), 120):
            heartbeat()
            frames = result["frames"][offset:offset + 120]
            db.pose_chunks.insert_one({**common, "poseModel": result["poseModel"], "chunkIndex": offset // 120,
                "frameStart": frames[0]["frameNumber"], "frameEnd": frames[-1]["frameNumber"], "frames": frames})
        version = f"{VERSION}+{run_id}"
        feature = {**common, "extractorVersion": version, "pipelineVersion": VERSION,
                   "coordinateSystem": "pixel_2d", **{k: result[k] for k in ("metrics", "definitions", "unavailable", "quality")}}
        feature_id = db.gait_features.insert_one(feature).inserted_id
        assessment = {**common, "kind": "measurement_report", "assessmentVersion": version, "pipelineVersion": VERSION,
                      "protocolVersion": session["protocolVersion"], "angle": session["capture"]["angle"],
                      "featureId": feature_id, "modelRefs": [], "flags": [], "disclaimerVersion": VERSION,
                      "limitations": LIMITATIONS, "poseModelSha256": result.get("modelSha256")}
        assessment_id = db.assessments.insert_one(assessment).inserted_id
        heartbeat()
        changed = db.walk_sessions.update_one(session_filter, {"$set": {"status": "completed",
            "assessmentId": assessment_id, "completedAt": utcnow(), "updatedAt": utcnow(),
            "quality": {"status": "warning" if result["quality"]["warnings"] else "passed", "checks": {},
                        "messages": result["quality"]["warnings"]}}})
        if not changed.modified_count:
            raise LeaseLost()
        db.processing_jobs.update_one(job_filter, {"$set": {"status": "succeeded", "completedAt": utcnow(), "updatedAt": utcnow()}})
    except LeaseLost:
        db.processing_jobs.update_one(job_filter, {"$set": {"status": "cancelled", "updatedAt": utcnow()}})
        db.walk_sessions.update_one(session_filter, {"$set": {"status": "cancelled", "updatedAt": utcnow()}})
    except Exception as exc:
        known = isinstance(exc, ProcessingError)
        code = exc.code if known else "PROCESSING_FAILED"
        message = exc.message if known else "Processing failed. Check worker configuration and retry."
        retry = (exc.retryable if known else True) and job["attempt"] < job["maxAttempts"]
        logging.warning("Job %s failed: %s", job["_id"], code)
        db.processing_jobs.update_one(job_filter, {"$set": {"status": "queued" if retry else "dead_letter",
            "error": {"code": code, "message": message}, "availableAt": utcnow() + timedelta(seconds=10 * job["attempt"]), "updatedAt": utcnow()}})
        db.walk_sessions.update_one(session_filter, {"$set": {"status": "queued" if retry else "failed",
            "processingError": {"code": code, "message": message, "retryable": retry}, "updatedAt": utcnow()}})
    return True


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args()
    settings = Settings()
    client = connect(settings)
    db, storage = client[settings.mongo_database], Storage(settings)
    if not db.schema_migrations.find_one({"version": 2}):
        raise RuntimeError("Run the schema migration before starting the worker")
    try:
        next_maintenance = 0.0
        while True:
            try:
                if time.monotonic() >= next_maintenance:
                    maintenance(db, storage)
                    next_maintenance = time.monotonic() + 30
                worked = run_once(db, settings, storage)
            except Exception as exc:
                logging.error("Worker infrastructure error: %s", type(exc).__name__)
                if args.once:
                    raise
                time.sleep(5)
                continue
            if args.once:
                break
            if not worked:
                time.sleep(2)
    except KeyboardInterrupt:
        pass
    finally:
        client.close()


if __name__ == "__main__":
    main()
