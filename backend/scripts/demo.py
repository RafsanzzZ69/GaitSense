"""Exercise the running loopback API and worker; remove only this run's demo account.

Outputs a private local verification snapshot (no credentials), not a clinical report.
"""
import argparse
import hashlib
import json
import secrets
import shutil
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx
from bson import ObjectId

from app.config import Settings
from app.db import connect
from app.migrations import MANIFEST, manifest, verify


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--video", required=True, type=Path)
    parser.add_argument("--confirm-database", required=True)
    args = parser.parse_args()
    settings = Settings()
    if args.confirm_database != settings.mongo_database:
        parser.error("Database confirmation does not match private configuration")
    source = args.video.resolve(strict=True)
    output = Path(__file__).resolve().parents[2] / "tmp" / "backend-demo" / datetime.now().strftime("%Y%m%d-%H%M%S")
    output.mkdir(parents=True, exist_ok=False)
    result = {"startedAt": datetime.now(timezone.utc).isoformat(), "checks": [], "runs": []}
    client = connect(settings)
    db = client[settings.mongo_database]
    api = httpx.Client(base_url="http://127.0.0.1:8000", timeout=120)
    uid, headers = None, {}

    def call(method, route, expected=200, **kwargs):
        response = api.request(method, route, **kwargs)
        passed = response.status_code == expected
        result["checks"].append({"method": method, "route": route, "status": response.status_code,
                                  "expected": expected, "passed": passed})
        print(f"{'PASS' if passed else 'FAIL'} {method} {route} -> {response.status_code}", flush=True)
        if not passed:
            raise RuntimeError(f"Unexpected HTTP status on {route}: {response.status_code}")
        return response

    def wait_until(predicate, timeout=180):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            if predicate():
                return
            time.sleep(2)
        raise RuntimeError("Worker did not finish within the bounded wait")

    try:
        result["database"] = verify(db)
        spec = manifest()
        invalid = {name: db[name].count_documents({"$nor": [options["validator"]]})
                   for name, options in spec["collections"].items()}
        assert not any(invalid.values()), "Existing documents fail schema validation"
        assert not db.schema_migrations.find_one({"version": 2147483647}), "Migration lock remains"
        assert db.schema_migrations.find_one({"version": 2})["checksum"] == hashlib.sha256(MANIFEST.read_bytes()).hexdigest()
        for name, index in spec["removeIndexes"]:
            assert index not in db[name].index_information()
        result["database"]["invalidDocuments"] = sum(invalid.values())
        result["database"]["seeds"] = {name: db[name].count_documents({}) for name in
            ("model_versions", "recommendation_catalog", "consent_documents", "capture_protocols")}
        call("GET", "/health/live")
        call("GET", "/health/ready")
        call("GET", "/openapi.json")
        call("GET", "/api/v1/capabilities")
        call("GET", "/api/v1/consent-documents")
        call("GET", "/api/v1/capture-protocols")
        call("GET", "/api/v1/me", 401)
        credentials = {"email": f"demo-{secrets.token_hex(10)}@example.com", "password": secrets.token_urlsafe(32)}
        registered = call("POST", "/api/v1/auth/register", 201,
                          json={**credentials, "displayName": "Temporary backend verification"}).json()
        uid = ObjectId(registered["user"]["id"])
        headers = {"Authorization": "Bearer " + registered["accessToken"]}
        login = call("POST", "/api/v1/auth/login", json=credentials).json()
        refreshed = call("POST", "/api/v1/auth/refresh", json={"refreshToken": login["refreshToken"]}).json()
        headers = {"Authorization": "Bearer " + refreshed["accessToken"]}
        call("GET", "/api/v1/me", headers=headers)
        call("PUT", "/api/v1/me/profile", headers=headers,
             json={"displayName": "Temporary backend verification", "yearOfBirth": 2000})
        call("GET", "/api/v1/me/profile", headers=headers)
        call("POST", "/api/v1/sessions", 409, headers={**headers, "Idempotency-Key": "without-consent"}, json={"angle": "front"})
        for consent in ("terms", "privacy", "health_disclaimer", "data_processing"):
            call("POST", "/api/v1/me/consents", headers=headers,
                 json={"type": consent, "status": "accepted", "documentVersion": "0.2.0"})
        call("GET", "/api/v1/me/consents", headers=headers)
        for number in range(2):
            session_headers = {**headers, "Idempotency-Key": f"demo-walk-{number}"}
            session = call("POST", "/api/v1/sessions", 201, headers=session_headers, json={"angle": "front"}).json()
            sid = session["id"]
            duplicate = call("POST", "/api/v1/sessions", 201, headers=session_headers, json={"angle": "front"}).json()
            assert duplicate["id"] == sid
            if number == 0:
                call("POST", f"/api/v1/sessions/{sid}/video", 422, headers=headers,
                     files={"file": ("invalid.mp4", b"not a video", "video/mp4")})
            with source.open("rb") as video:
                media = call("POST", f"/api/v1/sessions/{sid}/video", 201, headers=headers,
                             files={"file": ("walking.MOV", video, "video/quicktime")}).json()
            call("GET", f"/api/v1/sessions/{sid}/media", headers=headers)
            downloaded = call("GET", f"/api/v1/media/{media['id']}/content", headers=headers)
            assert hashlib.sha256(downloaded.content).hexdigest() == media["sha256"]
            job = call("POST", f"/api/v1/sessions/{sid}/process", 202, headers=headers).json()
            transitions = []

            def finished():
                state = api.get(f"/api/v1/sessions/{sid}", headers=headers)
                state.raise_for_status()
                item = state.json()
                if not transitions or transitions[-1] != item["status"]:
                    transitions.append(item["status"])
                    print(f"Worker: {item['status']}", flush=True)
                if item["status"] == "failed":
                    raise RuntimeError(f"Video processing failed: {item.get('processingError', {}).get('code')}")
                return item["status"] == "completed"

            wait_until(finished)
            session = call("GET", f"/api/v1/sessions/{sid}", headers=headers).json()
            job_result = call("GET", f"/api/v1/jobs/{job['id']}", headers=headers).json()
            assert job_result["status"] == "succeeded"
            report = call("GET", f"/api/v1/assessments/{session['assessmentId']}", headers=headers).json()
            pose = call("GET", f"/api/v1/sessions/{sid}/pose?chunk=0", headers=headers).json()
            assert report["kind"] == "measurement_report" and "overallScore" not in report
            assert pose["frames"] and all(len(f["landmarks"]) == 33 for f in pose["frames"])
            result["runs"].append({"status": session["status"], "transitions": transitions,
                "capture": media["capture"], "metrics": report["features"]["metrics"],
                "definitions": report["features"]["definitions"], "quality": report["features"]["quality"],
                "unavailable": report["features"]["unavailable"], "frames": pose["frames"]})
        history = call("GET", "/api/v1/sessions?limit=1", headers=headers).json()
        assert history["nextCursor"]
        call("GET", "/api/v1/sessions?limit=1&before=" + history["nextCursor"], headers=headers)
        reports = call("GET", "/api/v1/assessments", headers=headers).json()
        assert len(reports["items"]) == 2
        result["progress"] = call("GET", "/api/v1/progress", headers=headers).json()
        assert result["progress"]["status"] == "experimental_comparison"
        exported = call("GET", "/api/v1/me/export", headers=headers)
        assert "passwordHash" not in exported.text and "tokenHash" not in exported.text
        result["exportRecords"] = len(exported.text.splitlines())
        cancelled = call("POST", "/api/v1/sessions", 201,
                         headers={**headers, "Idempotency-Key": "cancel-demo"}, json={"angle": "front"}).json()
        call("POST", f"/api/v1/sessions/{cancelled['id']}/cancel", 202, headers=headers)
        call("DELETE", f"/api/v1/sessions/{cancelled['id']}", 202, headers=headers)
        call("POST", "/api/v1/auth/logout-all", 204, headers=headers)
        call("GET", "/api/v1/me", 401, headers=headers)
        login = call("POST", "/api/v1/auth/login", json=credentials).json()
        headers = {"Authorization": "Bearer " + login["accessToken"]}
        result["passed"] = True
    finally:
        try:
            if uid is not None:
                call("DELETE", "/api/v1/me", 202, headers=headers)
                call("GET", "/api/v1/me", 401, headers=headers)
                wait_until(lambda: db.users.find_one({"_id": uid}) is None)
                for name in spec["collections"]:
                    assert db[name].count_documents({"userId": uid}) == 0, f"Demo data remains: {name}"
                assert not list((settings.storage_path / str(uid)).rglob("*.video"))
                result["cleanup"] = "Temporary account, uploaded copies and owned Atlas records removed by worker. Original video unchanged."
                print("PASS worker cleanup: no demo account, owned records or uploaded videos remain", flush=True)
        finally:
            result["finishedAt"] = datetime.now(timezone.utc).isoformat()
            (output / "results.json").write_text(json.dumps(result), encoding="utf-8")
            shutil.copyfile(Path(__file__).with_name("demo.html"), output / "index.html")
            print(f"Private local results: {output}", flush=True)
            api.close()
            client.close()


if __name__ == "__main__":
    main()
