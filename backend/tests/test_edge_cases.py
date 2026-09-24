from datetime import timedelta
from pathlib import Path

from bson import ObjectId

from app.db import utcnow
from app.pipeline import ProcessingError
from app.storage import Storage
from app.worker import maintenance, run_once
from test_backend import fake_analyzer, session, uploaded


def test_profile_optional_fields_can_be_removed(api, account):
    _, headers = account
    api.put("/api/v1/me/profile", headers=headers, json={"displayName": "A", "heightCm": 175})
    response = api.put("/api/v1/me/profile", headers=headers, json={"displayName": "A", "heightCm": None})
    assert response.status_code == 200
    assert "heightCm" not in response.json()


def test_other_user_cannot_read_job_report_or_media(api, account, db, settings, tmp_path):
    _, headers = account
    sid, media = uploaded(api, headers, tmp_path)
    job = api.post(f"/api/v1/sessions/{sid}/process", headers=headers).json()
    run_once(db, settings, analyzer=fake_analyzer)
    assessment_id = str(db.assessments.find_one()["_id"])
    stranger = api.post("/api/v1/auth/register", json={"email": "other@example.com", "password": "another long password", "displayName": "Other"}).json()
    other = {"Authorization": "Bearer " + stranger["accessToken"]}
    for path in (f"/jobs/{job['id']}", f"/assessments/{assessment_id}", f"/media/{media['id']}/content", f"/sessions/{sid}/pose"):
        assert api.get("/api/v1" + path, headers=other).status_code == 404
    assert api.get("/api/v1/assessments", headers=other).json()["items"] == []


def test_delete_waits_for_running_worker(api, account, db, settings, tmp_path):
    _, headers = account
    sid, _ = uploaded(api, headers, tmp_path)
    api.post(f"/api/v1/sessions/{sid}/process", headers=headers)

    def delete_in_flight(*args):
        api.delete(f"/api/v1/sessions/{sid}", headers=headers)
        maintenance(db, Storage(settings))
        assert db.walk_sessions.count_documents({}) == 1
        return fake_analyzer(*args)

    run_once(db, settings, analyzer=delete_in_flight)
    assert db.processing_jobs.find_one()["status"] == "cancelled"
    maintenance(db, Storage(settings))
    assert db.walk_sessions.count_documents({}) == 0
    assert db.assessments.count_documents({}) == 0


def test_crashed_upload_is_recovered(api, account, db, settings):
    data, headers = account
    sid = session(api, headers)
    token = "simulated-interrupted-upload"
    storage = Storage(settings)
    key = f"{data['user']['id']}/{sid}/{token}.video"
    path = storage.path(key)
    path.parent.mkdir(parents=True)
    path.write_bytes(b"partial-upload-test-data")
    db.walk_sessions.update_one({"_id": ObjectId(sid)}, {"$set": {"status": "uploading", "uploadToken": token,
        "uploadExpiresAt": utcnow() - timedelta(seconds=1)}})
    maintenance(db, storage)
    assert db.walk_sessions.find_one()["status"] == "created"
    assert not path.exists()


def test_two_workers_cannot_claim_the_same_live_job(api, account, db, settings, tmp_path):
    _, headers = account
    sid, _ = uploaded(api, headers, tmp_path)
    api.post(f"/api/v1/sessions/{sid}/process", headers=headers)

    def overlapping(*args):
        assert run_once(db, settings, analyzer=fake_analyzer) is False
        return fake_analyzer(*args)

    run_once(db, settings, analyzer=overlapping)
    assert db.assessments.count_documents({}) == 1
    assert db.processing_jobs.find_one()["attempt"] == 1


def test_transient_failure_retries_before_dead_letter(api, account, db, settings, tmp_path):
    _, headers = account
    sid, _ = uploaded(api, headers, tmp_path)
    api.post(f"/api/v1/sessions/{sid}/process", headers=headers)

    def temporary_failure(*args):
        raise ProcessingError("TEMPORARY", "Temporary test failure", retryable=True)

    run_once(db, settings, analyzer=temporary_failure)
    assert db.processing_jobs.find_one()["status"] == "queued"
    assert run_once(db, settings, analyzer=fake_analyzer) is False
    db.processing_jobs.update_one({}, {"$set": {"availableAt": utcnow() - timedelta(seconds=1)}})
    run_once(db, settings, analyzer=fake_analyzer)
    assert db.processing_jobs.find_one()["status"] == "succeeded"
    assert db.processing_jobs.find_one()["attempt"] == 2


def test_deleted_account_cannot_rotate_refresh_token(api, account):
    data, headers = account
    api.delete("/api/v1/me", headers=headers)
    assert api.post("/api/v1/auth/refresh", json={"refreshToken": data["refreshToken"]}).status_code == 401


def test_s3_storage_adapter_uses_the_selected_bucket(settings, tmp_path, monkeypatch):
    import boto3
    calls = []

    class Bucket:
        def upload_file(self, file, bucket, key, ExtraArgs):
            calls.append(("upload", bucket, key))

        def download_file(self, bucket, key, file):
            calls.append(("download", bucket, key))
            Path(file).write_bytes(b"test-video")

        def delete_object(self, **kwargs):
            calls.append(("delete", kwargs["Bucket"], kwargs["Key"]))

    monkeypatch.setattr(boto3, "client", lambda *args, **kwargs: Bucket())
    settings.storage_provider = "s3"
    settings.s3_bucket = "test-private-bucket"
    storage = Storage(settings)
    source = tmp_path / "test.bin"
    source.write_bytes(b"test-video")
    ref = storage.put(source, "user/session/video")
    asset = {"storage": ref}
    with storage.materialize_asset(asset) as path:
        assert path.read_bytes() == b"test-video"
    storage.delete_asset(asset)
    assert calls == [(op, "test-private-bucket", "user/session/video") for op in ("upload", "download", "delete")]
