from datetime import timedelta
import os
from pathlib import Path

import cv2
import numpy as np
import pytest
from bson import ObjectId
from pymongo.errors import WriteError

from app.db import utcnow
from app.migrations import backup, migrate, restore_empty, verify
from app.pipeline import ProcessingError, joint_angle, measure
from app.storage import Storage
from app.worker import maintenance, run_once


def session(api, headers, key="test", angle="front"):
    response = api.post("/api/v1/sessions", headers={**headers, "Idempotency-Key": key}, json={"angle": angle})
    assert response.status_code == 201, response.text
    return response.json()["id"]


def video(tmp_path):
    path = tmp_path / "sample.mp4"
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"mp4v"), 15, (128, 128))
    assert writer.isOpened()
    for _ in range(45):
        writer.write(np.full((128, 128, 3), 100, dtype=np.uint8))
    writer.release()
    return path.read_bytes()


def uploaded(api, headers, tmp_path):
    sid = session(api, headers)
    response = api.post(f"/api/v1/sessions/{sid}/video", headers=headers,
                        files={"file": ("test.mp4", video(tmp_path), "video/mp4")})
    assert response.status_code == 201, response.text
    return sid, response.json()


def fake_analyzer(*args):
    args[-1]()
    return {"frames": [], "metrics": {"shoulderLevelDifference": 0.02}, "definitions": {},
            "unavailable": {"overallScore": "Unvalidated"}, "quality": {"usableFrameRatio": 1.0,
            "meanLandmarkVisibility": 0.9, "warnings": ["Experimental"]},
            "poseModel": {"name": "test", "version": "test", "landmarkCount": 33}}


def test_schema_idempotent_validation_and_backup(db, mongo_client, tmp_path):
    assert verify(db) == {"schemaVersion": 2, "collections": 20, "applicationIndexes": 42}
    ids = [r["_id"] for r in db.consent_documents.find()]
    migrate(db)
    assert ids == [r["_id"] for r in db.consent_documents.find()]
    with pytest.raises(WriteError):
        db.users.insert_one({"email": "invalid"})
    assert "ttl_media_expiry" not in db.media_assets.index_information()
    target = tmp_path / "backup"
    backup(db, target)
    restore_db = mongo_client["gaitsense_test_" + str(ObjectId())]
    try:
        restore_empty(restore_db, target)
        assert verify(restore_db)["collections"] == 20
        assert restore_db.consent_documents.count_documents({}) == 5
        with pytest.raises(RuntimeError):
            restore_empty(restore_db, target)
    finally:
        assert restore_db.name.startswith("gaitsense_test_")
        mongo_client.drop_database(restore_db.name)


def test_auth_refresh_reuse_and_logout(api, account):
    data, headers = account
    assert api.get("/api/v1/me", headers=headers).status_code == 200
    assert api.get("/api/v1/me").status_code == 401
    token = {"refreshToken": data["refreshToken"]}
    rotated = api.post("/api/v1/auth/refresh", json=token)
    assert rotated.status_code == 200
    assert api.post("/api/v1/auth/refresh", json=token).status_code == 401
    assert api.get("/api/v1/me", headers={"Authorization": "Bearer " + rotated.json()["accessToken"]}).status_code == 401
    login = api.post("/api/v1/auth/login", json={"email": "ALICE@example.com", "password": "correct horse battery staple"})
    assert login.status_code == 200
    headers = {"Authorization": "Bearer " + login.json()["accessToken"]}
    assert api.post("/api/v1/auth/logout", headers=headers).status_code == 204
    assert api.get("/api/v1/me", headers=headers).status_code == 401


def test_validation_consent_and_ownership(api, account):
    _, headers = account
    sid = session(api, headers)
    assert session(api, headers) == sid
    assert api.post("/api/v1/sessions", headers={**headers, "Idempotency-Key": "test"}, json={"angle": "side_left"}).status_code == 409
    stranger = api.post("/api/v1/auth/register", json={"email": "bob@example.com", "password": "some long password", "displayName": "Bob"}).json()
    other = {"Authorization": "Bearer " + stranger["accessToken"]}
    for route in (f"/sessions/{sid}", f"/sessions/{sid}/media"):
        assert api.get("/api/v1" + route, headers=other).status_code == 404
    assert api.delete(f"/api/v1/sessions/{sid}", headers=other).status_code == 404
    assert api.post("/api/v1/sessions", headers={**other, "Idempotency-Key": "x"}, json={"angle": "front"}).status_code == 409
    assert api.put("/api/v1/me/profile", headers=headers, json={"displayName": "A", "role": "admin"}).status_code == 422
    assert api.get("/api/v1/sessions/invalid", headers=headers).status_code == 422
    api.post("/api/v1/me/consents", headers=headers, json={"type": "data_processing", "status": "withdrawn"})
    assert api.post(f"/api/v1/sessions/{sid}/process", headers=headers).status_code == 409


def test_upload_rejects_bad_and_large_file(api, account, settings):
    _, headers = account
    sid = session(api, headers)
    url = f"/api/v1/sessions/{sid}/video"
    assert api.post(url, headers=headers, files={"file": ("video.mp4", b"not video")}).status_code == 422
    assert api.get(f"/api/v1/sessions/{sid}", headers=headers).json()["status"] == "created"
    assert api.post(url, headers=headers, files={"file": ("big.mp4", b"x" * (settings.max_upload_mb * 1024 * 1024 + 1))}).status_code == 413
    assert api.post(url, headers=headers, files={"file": ("big.mp4", b"x" * (4 * 1024 * 1024))}).status_code == 413
    storage = Storage(settings)
    with pytest.raises(ValueError):
        storage.path("../outside.txt")


def test_pipeline_publication_and_deletion(api, account, db, settings, tmp_path):
    _, headers = account
    sid, media = uploaded(api, headers, tmp_path)
    url = f"/api/v1/sessions/{sid}/process"
    first = api.post(url, headers=headers)
    assert first.status_code == 202, first.text
    assert api.post(url, headers=headers).json()["id"] == first.json()["id"]
    assert api.get("/api/v1/assessments", headers=headers).json()["items"] == []
    assert run_once(db, settings, analyzer=fake_analyzer)
    assert not run_once(db, settings, analyzer=fake_analyzer)
    item = api.get(f"/api/v1/sessions/{sid}", headers=headers).json()
    assert item["status"] == "completed"
    reports = api.get("/api/v1/assessments", headers=headers).json()["items"]
    assert len(reports) == 1
    assert "overallScore" not in reports[0]
    assert reports[0]["kind"] == "measurement_report"
    assert api.get(f"/api/v1/media/{media['id']}/content", headers=headers).status_code == 200
    assert api.delete(f"/api/v1/sessions/{sid}", headers=headers).status_code == 202
    assert api.get(f"/api/v1/assessments/{reports[0]['id']}", headers=headers).status_code == 404
    maintenance(db, Storage(settings))
    assert db.walk_sessions.count_documents({}) == 0
    assert db.gait_features.count_documents({}) == 0
    assert db.media_assets.count_documents({}) == 0
    assert not list(settings.storage_path.rglob("*.video"))


def test_cancel_during_processing_never_publishes(api, account, db, settings, tmp_path):
    _, headers = account
    sid, _ = uploaded(api, headers, tmp_path)
    api.post(f"/api/v1/sessions/{sid}/process", headers=headers)

    def interrupted(*args):
        api.post(f"/api/v1/sessions/{sid}/cancel", headers=headers)
        return fake_analyzer(*args)

    run_once(db, settings, analyzer=interrupted)
    assert db.walk_sessions.find_one()["status"] == "cancelled"
    assert db.assessments.count_documents({}) == 0


def test_failure_retry_and_expired_lease(api, account, db, settings, tmp_path):
    _, headers = account
    sid, _ = uploaded(api, headers, tmp_path)
    api.post(f"/api/v1/sessions/{sid}/process", headers=headers)

    def bad(*args):
        raise ProcessingError("INSUFFICIENT_POSE", "No usable body")

    run_once(db, settings, analyzer=bad)
    assert db.processing_jobs.find_one()["status"] == "dead_letter"
    assert api.post(f"/api/v1/sessions/{sid}/process", headers=headers).status_code == 202
    old = ObjectId()
    db.processing_jobs.update_one({}, {"$set": {"status": "running", "runId": old, "attempt": 1,
                                               "leaseUntil": utcnow() - timedelta(seconds=1)}})
    db.walk_sessions.update_one({}, {"$set": {"status": "processing", "activeRunId": old}})
    maintenance(db, Storage(settings))
    run_once(db, settings, analyzer=fake_analyzer)
    assert db.walk_sessions.find_one()["status"] == "completed"
    assert db.walk_sessions.find_one()["activeRunId"] != old


def test_expiry_and_account_deletion(api, account, db, settings, tmp_path):
    _, headers = account
    _, media = uploaded(api, headers, tmp_path)
    db.media_assets.update_one({}, {"$set": {"expiresAt": utcnow() - timedelta(seconds=1)}})
    assert api.get(f"/api/v1/media/{media['id']}/content", headers=headers).status_code == 410
    exported = api.get("/api/v1/me/export", headers=headers)
    assert exported.status_code == 200
    assert "passwordHash" not in exported.text and "tokenHash" not in exported.text
    assert api.delete("/api/v1/me", headers=headers).status_code == 202
    assert api.get("/api/v1/me", headers=headers).status_code == 401
    maintenance(db, Storage(settings))
    assert db.users.count_documents({}) == 0
    assert db.media_assets.count_documents({}) == 0


def test_angles_and_missing_pose():
    result = joint_angle(np.array([[0., 1.]]), np.array([[0., 0.]]), np.array([[1., 0.]]))
    assert result[0] == pytest.approx(90)
    with pytest.raises(ProcessingError):
        measure(np.full((30, 33, 4), np.nan), np.arange(30) / 15, 1920, 1080, "front")


def test_cadence_uses_frame_timestamps_and_front_view_does_not_claim_speed():
    times = np.arange(150) / 15
    points = np.full((150, 33, 4), 0.5)
    points[:, :, 3] = 1
    points[:, 27, 0] += 0.1 * np.sin(times * 2 * np.pi)
    points[:, 28, 0] -= 0.1 * np.sin(times * 2 * np.pi)
    metrics, _, missing, _ = measure(points, times, 1920, 1080, "side_left")
    assert metrics["cadenceSpm"] == pytest.approx(120, rel=0.1)
    assert "walkingSpeedMps" in missing and "walkingSpeedMps" not in metrics
    metrics, _, missing, _ = measure(points, times, 1920, 1080, "front")
    assert "cadenceSpm" not in metrics and "cadenceSpm" in missing


def test_profile_pagination_and_configuration(api, account):
    _, headers = account
    response = api.put("/api/v1/me/profile", headers=headers,
                       json={"displayName": "Alice", "yearOfBirth": 1999, "heightCm": 165})
    assert response.status_code == 200
    assert response.json()["yearOfBirth"] == 1999
    for i in range(3):
        session(api, headers, key=str(i))
    first = api.get("/api/v1/sessions?limit=2", headers=headers).json()
    second = api.get("/api/v1/sessions?limit=2&before=" + first["nextCursor"], headers=headers).json()
    assert len(first["items"]) == 2 and len(second["items"]) == 1
    assert api.get("/api/v1/capabilities").json()["healthScoreEnabled"] is False
    assert api.get("/health/ready").status_code == 200


def test_storage_provider_changes_cannot_delete_wrong_object(settings, tmp_path):
    storage = Storage(settings)
    with pytest.raises(ValueError):
        storage.delete_asset({"storage": {"provider": "s3", "bucket": "other", "key": "private.video"}})


def test_migration_lock(db):
    db.schema_migrations.insert_one({"version": 2147483647, "name": "migration_lock", "appliedAt": utcnow()})
    with pytest.raises(RuntimeError, match="Another migration"):
        migrate(db)


def test_rate_limiting(api):
    statuses = [api.post("/api/v1/auth/login", json={"email": "nobody@example.com", "password": "bad"}).status_code for _ in range(11)]
    assert statuses[-1] == 429


@pytest.mark.integration
def test_real_walking_video(api, account, db, settings):
    source = os.environ.get("GAITSENSE_TEST_VIDEO")
    if not source:
        pytest.skip("Set GAITSENSE_TEST_VIDEO for an explicit private-video integration run")
    _, headers = account
    settings.max_upload_mb = 200
    # The request middleware is intentionally fixed at startup, so use an increased-limit client.
    from app.main import create_app
    from fastapi.testclient import TestClient
    with TestClient(create_app(settings, db)) as real_api:
        sid = session(real_api, headers)
        with Path(source).open("rb") as file:
            response = real_api.post(f"/api/v1/sessions/{sid}/video", headers=headers,
                                     files={"file": ("walking.MOV", file, "video/quicktime")})
        assert response.status_code == 201, response.text
        response = real_api.post(f"/api/v1/sessions/{sid}/process", headers=headers)
        assert response.status_code == 202, response.text
        run_once(db, settings)
        item = real_api.get(f"/api/v1/sessions/{sid}", headers=headers).json()
        assert item["status"] == "completed", item.get("processingError")
        response = real_api.get(f"/api/v1/assessments/{item['assessmentId']}", headers=headers)
        assert response.status_code == 200, response.text
        assert response.json()["features"]["quality"]["usableFrameRatio"] >= 0.5
        assert db.pose_chunks.count_documents({}) > 0
        print("Real video: completed, pose chunks saved, measurement report retrieved; no health score.")
