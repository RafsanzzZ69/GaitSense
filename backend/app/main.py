import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pymongo.errors import PyMongoError

from app.config import Settings
from app.db import connect
from app.storage import Storage


class BodyLimit:
    def __init__(self, app, maximum):
        self.app, self.maximum = app, maximum

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        count = 0
        headers = dict(scope.get("headers", []))
        length = headers.get(b"content-length", b"")
        if length.isdigit() and int(length) > self.maximum:
            return await JSONResponse({"detail": "Request exceeds upload limit"}, 413)(scope, receive, send)

        async def limited_receive():
            nonlocal count
            message = await receive()
            count += len(message.get("body", b""))
            if count > self.maximum:
                raise HTTPException(413, "Request exceeds upload limit")
            return message

        await self.app(scope, limited_receive, send)


def create_app(settings=None, database=None):
    settings = settings or Settings()

    @asynccontextmanager
    async def lifespan(app):
        client = None
        if database is None:
            client = connect(settings)
            app.state.db = client[settings.mongo_database]
        else:
            app.state.db = database
        if not app.state.db.schema_migrations.find_one({"version": 2}):
            if client:
                client.close()
            raise RuntimeError("Database schema v2 is required. Run the migrate command first.")
        app.state.settings = settings
        app.state.storage = Storage(settings)
        try:
            yield
        finally:
            if client:
                client.close()

    app = FastAPI(title="GaitSense API", version="0.2.0", lifespan=lifespan,
                  description="Private walking-video workflow and experimental measurements. Not a diagnostic device.")
    app.add_middleware(BodyLimit, maximum=settings.max_upload_mb * 1024 * 1024 + 1024 * 1024)
    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins,
                       allow_methods=["GET", "POST", "PUT", "DELETE"],
                       allow_headers=["Authorization", "Content-Type", "Idempotency-Key"],
                       expose_headers=["X-Request-ID"])

    @app.middleware("http")
    async def request_id(request, call_next):
        request.state.request_id = uuid.uuid4().hex
        response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    @app.exception_handler(PyMongoError)
    async def database_error(request: Request, exc):
        # Error strings can include URIs, document contents or tokens. Log the class only.
        logging.error("Database error %s request=%s", type(exc).__name__, request.state.request_id)
        return JSONResponse({"detail": "Database unavailable or operation failed",
                             "requestId": request.state.request_id}, status_code=503)

    @app.get("/health/live", tags=["health"])
    def live():
        return {"status": "ok", "version": "0.2.0"}

    @app.get("/health/ready", tags=["health"])
    def ready(request: Request):
        request.app.state.db.command("ping")
        return {"status": "ready", "schemaVersion": 2}

    from app.routes import router
    app.include_router(router, prefix="/api/v1")
    return app
