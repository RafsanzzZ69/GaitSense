import hashlib
import secrets
from datetime import timedelta

import jwt
from bson import ObjectId
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pwdlib import PasswordHash
from pymongo import ReturnDocument

from app.db import oid, utcnow

password_hash = PasswordHash.recommended()
DUMMY_HASH = password_hash.hash("not-a-real-account-password")
bearer = HTTPBearer(auto_error=False)
REQUIRED_CONSENTS = ("terms", "privacy", "health_disclaimer", "data_processing")


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def throttle(db, key, limit=20, seconds=60):
    now = utcnow()
    bucket = int(now.timestamp()) // seconds
    record = db.rate_limits.find_one_and_update(
        {"_id": digest(f"{key}:{bucket}")},
        {"$inc": {"count": 1}, "$setOnInsert": {"expiresAt": now + timedelta(seconds=seconds * 2)}},
        upsert=True, return_document=ReturnDocument.AFTER)
    if record["count"] > limit:
        raise HTTPException(429, "Too many requests. Try again later.", headers={"Retry-After": str(seconds)})


def tokens(db, settings, user_id, device, auth_session=None):
    now = utcnow()
    if auth_session is None:
        auth_session = {"_id": ObjectId(), "userId": user_id, "deviceId": device,
                        "createdAt": now, "expiresAt": now + timedelta(days=settings.refresh_token_days)}
        db.auth_sessions.insert_one(auth_session)
    refresh = secrets.token_urlsafe(48)
    db.refresh_tokens.insert_one({"userId": user_id, "authSessionId": auth_session["_id"],
                                  "deviceId": device, "tokenHash": digest(refresh),
                                  "createdAt": now, "expiresAt": auth_session["expiresAt"]})
    access = jwt.encode({"sub": str(user_id), "sid": str(auth_session["_id"]), "iss": "gaitsense",
                         "aud": "gaitsense-api", "iat": now,
                         "exp": now + timedelta(minutes=settings.access_token_minutes), "type": "access"},
                        settings.jwt_secret.get_secret_value(), algorithm="HS256")
    return {"accessToken": access, "refreshToken": refresh, "tokenType": "bearer",
            "expiresIn": settings.access_token_minutes * 60}


def current_user(request: Request, credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
    try:
        if credentials is None:
            raise ValueError()
        payload = jwt.decode(credentials.credentials, request.app.state.settings.jwt_secret.get_secret_value(),
                             algorithms=["HS256"], audience="gaitsense-api", issuer="gaitsense",
                             options={"require": ["sub", "sid", "exp", "iat", "type"]})
        if payload["type"] != "access":
            raise ValueError()
        user_id, session_id = oid(payload["sub"]), oid(payload["sid"])
    except (jwt.PyJWTError, ValueError, HTTPException):
        raise HTTPException(401, "Authentication required", headers={"WWW-Authenticate": "Bearer"}) from None
    db = request.app.state.db
    session = db.auth_sessions.find_one({"_id": session_id, "userId": user_id,
                                        "expiresAt": {"$gt": utcnow()}, "revokedAt": {"$exists": False}})
    user = db.users.find_one({"_id": user_id, "status": "active"})
    if not session or not user:
        raise HTTPException(401, "Session expired or revoked")
    request.state.auth_session_id = session_id
    return user


def require_consents(db, user_id):
    accepted = {c["type"] for c in db.consents.find({"userId": user_id,
                "documentVersion": "0.2.0", "status": "accepted"})}
    missing = sorted(set(REQUIRED_CONSENTS) - accepted)
    if missing:
        raise HTTPException(409, {"code": "CONSENT_REQUIRED", "types": missing})
