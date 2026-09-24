from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Register(Input):
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)
    displayName: str = Field(min_length=1, max_length=100)
    deviceId: str = Field(default="default", min_length=1, max_length=100)


class Login(Input):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)
    deviceId: str = Field(default="default", min_length=1, max_length=100)


class Refresh(Input):
    refreshToken: str = Field(min_length=30, max_length=200)


class Profile(Input):
    displayName: str = Field(min_length=1, max_length=100)
    yearOfBirth: int | None = Field(default=None, ge=1900, le=2100)
    heightCm: float | None = Field(default=None, ge=50, le=250)
    weightKg: float | None = Field(default=None, ge=10, le=350)


class Consent(Input):
    type: Literal["terms", "privacy", "health_disclaimer", "data_processing", "research_data"]
    documentVersion: str = Field(default="0.2.0", min_length=1, max_length=40)
    status: Literal["accepted", "declined", "withdrawn"]


class WalkSession(Input):
    angle: Literal["front", "side_left", "side_right"]
    platform: Literal["android", "ios", "web", "import"] = "import"
    protocolVersion: Literal["0.2.0"] = "0.2.0"
    capturedAt: datetime | None = None

    @field_validator("capturedAt")
    @classmethod
    def timezone_required(cls, value):
        if value is not None and value.tzinfo is None:
            raise ValueError("capturedAt must include a timezone")
        return value
