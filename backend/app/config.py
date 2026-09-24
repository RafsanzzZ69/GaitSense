from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND / ".env", extra="ignore", hide_input_in_errors=True)
    mongodb_uri: SecretStr
    mongo_database: str = Field(default="gaitsense", pattern=r"^[A-Za-z0-9_-]{1,63}$")
    jwt_secret: SecretStr
    environment: Literal["development", "test", "production"] = "development"
    cors_origins: list[str] = ["http://localhost:8081"]
    access_token_minutes: int = Field(default=15, ge=1, le=60)
    refresh_token_days: int = Field(default=14, ge=1, le=90)
    storage_provider: Literal["local", "s3"] = "local"
    storage_path: Path = BACKEND / "storage"
    s3_bucket: str | None = None
    s3_endpoint_url: str | None = None
    max_upload_mb: int = Field(default=200, ge=1, le=500)
    video_retention_days: int = Field(default=30, ge=1, le=365)
    pose_model_path: Path = BACKEND.parent / "research/gaitsense_poc/models/pose_landmarker_full.task"
    mongo_timeout_ms: int = Field(default=5000, ge=1000, le=30000)

    @field_validator("jwt_secret")
    @classmethod
    def valid_secret(cls, value):
        secret = value.get_secret_value()
        if len(secret) < 32 or secret.startswith("replace-"):
            raise ValueError("Set JWT_SECRET to a random secret of at least 32 characters")
        return value

    @field_validator("mongodb_uri")
    @classmethod
    def valid_uri(cls, value):
        if not value.get_secret_value().startswith(("mongodb://", "mongodb+srv://")):
            raise ValueError("MONGODB_URI must be a MongoDB connection URI")
        return value

    @field_validator("storage_path", "pose_model_path")
    @classmethod
    def absolute_paths(cls, value):
        return value.resolve() if value.is_absolute() else (BACKEND / value).resolve()

    @model_validator(mode="after")
    def deployment_settings(self):
        if self.storage_provider == "s3" and not self.s3_bucket:
            raise ValueError("S3_BUCKET is required for S3 storage")
        if "*" in self.cors_origins:
            raise ValueError("CORS_ORIGINS must contain explicit origins")
        return self
