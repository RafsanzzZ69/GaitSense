import os
import uuid

import pytest
from fastapi.testclient import TestClient
from pymongo import MongoClient

from app.config import Settings
from app.main import create_app
from app.migrations import migrate


@pytest.fixture(scope="session")
def mongo_client():
    uri = os.environ.get("GAITSENSE_TEST_MONGODB_URI")
    if not uri:
        pytest.fail("Use python scripts/test.py or explicitly set GAITSENSE_TEST_MONGODB_URI to an isolated test server")
    client = MongoClient(uri, tz_aware=True, serverSelectionTimeoutMS=3000)
    client.admin.command("ping")  # Fail loudly, never silently skip integration coverage.
    yield client
    client.close()


@pytest.fixture
def db(mongo_client):
    name = "gaitsense_test_" + uuid.uuid4().hex
    database = mongo_client[name]
    migrate(database)
    yield database
    assert database.name.startswith("gaitsense_test_") and len(database.name) == 47
    mongo_client.drop_database(database.name)


@pytest.fixture
def settings(tmp_path):
    return Settings(_env_file=None, mongodb_uri="mongodb://127.0.0.1:27017", jwt_secret="test-secret-" * 5,
                    environment="test", storage_path=tmp_path / "storage", max_upload_mb=2)


@pytest.fixture
def api(db, settings):
    with TestClient(create_app(settings, db)) as client:
        yield client


@pytest.fixture
def account(api):
    response = api.post("/api/v1/auth/register", json={"email": "alice@example.com",
        "password": "correct horse battery staple", "displayName": "Alice"})
    assert response.status_code == 201, response.text
    data = response.json()
    headers = {"Authorization": f"Bearer {data['accessToken']}"}
    for consent in ("terms", "privacy", "health_disclaimer", "data_processing"):
        response = api.post("/api/v1/me/consents", json={"type": consent, "status": "accepted"}, headers=headers)
        assert response.status_code == 200, response.text
    return data, headers
