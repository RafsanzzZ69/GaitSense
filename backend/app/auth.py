from fastapi import APIRouter, Depends, HTTPException, Request
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.db import audit, public, utcnow
from app.schemas import Login, Refresh, Register
from app.security import DUMMY_HASH, current_user, digest, password_hash, throttle, tokens

router = APIRouter(prefix="/auth", tags=["authentication"])


def auth_limit(request):
    throttle(request.app.state.db, f"auth:{request.client.host if request.client else 'unknown'}", 20, 60)


@router.post("/register", status_code=201)
def register(body: Register, request: Request):
    db = request.app.state.db
    auth_limit(request)
    now = utcnow()
    user = {"email": str(body.email), "emailNormalized": str(body.email).lower(),
            "passwordHash": password_hash.hash(body.password), "authProviders": ["password"],
            "role": "user", "status": "active", "createdAt": now, "updatedAt": now}
    try:
        db.users.insert_one(user)
    except DuplicateKeyError:
        raise HTTPException(409, "An account with this email already exists") from None
    db.participant_profiles.update_one({"userId": user["_id"]}, {"$setOnInsert": {
        "userId": user["_id"], "displayName": body.displayName, "createdAt": now, "updatedAt": now}}, upsert=True)
    audit(db, user["_id"], "account.registered", "user", user["_id"])
    return {"user": public({k: v for k, v in user.items() if k in ("_id", "email", "role")}),
            **tokens(db, request.app.state.settings, user["_id"], body.deviceId)}


@router.post("/login")
def login(body: Login, request: Request):
    auth_limit(request)
    db = request.app.state.db
    throttle(db, f"login:{str(body.email).lower()}", 10, 300)
    user = db.users.find_one({"emailNormalized": str(body.email).lower()})
    valid = password_hash.verify(body.password, user.get("passwordHash", DUMMY_HASH) if user else DUMMY_HASH)
    if not user or not valid or user["status"] != "active":
        raise HTTPException(401, "Invalid email or password")
    return tokens(db, request.app.state.settings, user["_id"], body.deviceId)


@router.post("/refresh")
def refresh(body: Refresh, request: Request):
    auth_limit(request)
    db = request.app.state.db
    token = db.refresh_tokens.find_one_and_update(
        {"tokenHash": digest(body.refreshToken), "revokedAt": {"$exists": False}, "expiresAt": {"$gt": utcnow()}},
        {"$set": {"revokedAt": utcnow()}}, return_document=ReturnDocument.BEFORE)
    if not token:
        used = db.refresh_tokens.find_one({"tokenHash": digest(body.refreshToken)})
        if used and "authSessionId" in used:
            db.auth_sessions.update_one({"_id": used["authSessionId"]}, {"$set": {"revokedAt": utcnow()}})
        raise HTTPException(401, "Refresh token expired, revoked or already used")
    session = db.auth_sessions.find_one({"_id": token.get("authSessionId"),
        "userId": token["userId"], "revokedAt": {"$exists": False}, "expiresAt": {"$gt": utcnow()}})
    if not session or not db.users.find_one({"_id": token["userId"], "status": "active"}):
        raise HTTPException(401, "Session revoked")
    return tokens(db, request.app.state.settings, token["userId"], token["deviceId"], session)


@router.post("/logout", status_code=204)
def logout(request: Request, user=Depends(current_user)):
    db = request.app.state.db
    db.auth_sessions.update_one({"_id": request.state.auth_session_id}, {"$set": {"revokedAt": utcnow()}})
    db.refresh_tokens.update_many({"authSessionId": request.state.auth_session_id}, {"$set": {"revokedAt": utcnow()}})


@router.post("/logout-all", status_code=204)
def logout_all(request: Request, user=Depends(current_user)):
    db = request.app.state.db
    db.auth_sessions.update_many({"userId": user["_id"]}, {"$set": {"revokedAt": utcnow()}})
    db.refresh_tokens.update_many({"userId": user["_id"]}, {"$set": {"revokedAt": utcnow()}})
