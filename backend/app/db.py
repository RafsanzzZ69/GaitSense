from datetime import datetime, timezone

from bson import ObjectId
from fastapi import HTTPException
from pymongo import MongoClient


def utcnow():
    return datetime.now(timezone.utc)


def connect(settings):
    client = MongoClient(settings.mongodb_uri.get_secret_value(), tz_aware=True,
                         serverSelectionTimeoutMS=settings.mongo_timeout_ms,
                         connectTimeoutMS=settings.mongo_timeout_ms, appname="GaitSense")
    client.admin.command("ping")
    return client


def oid(value):
    if not ObjectId.is_valid(value):
        raise HTTPException(422, "Invalid resource ID")
    return ObjectId(value)


def public(value):
    """Explicitly select safe fields before serializing documents with secrets."""
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return {("id" if k == "_id" else k): public(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [public(item) for item in value]
    return value


def audit(db, user_id, event, resource_type, resource_id):
    from datetime import timedelta
    db.audit_events.insert_one({"eventType": event, "actor": {"type": "user", "id": user_id},
                               "resource": {"type": resource_type, "id": resource_id},
                               "occurredAt": utcnow(), "expiresAt": utcnow() + timedelta(days=90)})
