"""Generate private backend configuration from the existing Atlas settings. Never connects."""
import json
import secrets
from pathlib import Path
from urllib.parse import quote

from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[2]
target = ROOT / "backend/.env"
if target.exists():
    raise SystemExit("backend/.env already exists; kept it unchanged")
values = dotenv_values(ROOT / "database/.env.atlas")
required = ["ATLAS_HOST", "ATLAS_USERNAME", "ATLAS_PASSWORD"]
if not all(values.get(k) for k in required):
    raise SystemExit("Existing database/.env.atlas is incomplete; use backend/.env.example as the configuration template")
host = values["ATLAS_HOST"]
if not host.endswith(".mongodb.net") or any(c in host for c in "/@:\\"):
    raise SystemExit("Invalid Atlas hostname")
uri = (f"mongodb+srv://{quote(values['ATLAS_USERNAME'], safe='')}:{quote(values['ATLAS_PASSWORD'], safe='')}"
       f"@{host}/?authSource=admin&retryWrites=true&w=majority&appName=GaitSense")
lines = ["# Private configuration generated from the saved Atlas settings. No connection was attempted.",
         "MONGODB_URI=" + json.dumps(uri), "MONGO_DATABASE=" + values.get("MONGO_DATABASE", "gaitsense"),
         "JWT_SECRET=" + secrets.token_urlsafe(64), "ENVIRONMENT=development",
         'CORS_ORIGINS=["http://localhost:8081","http://localhost:8082"]',
         "STORAGE_PROVIDER=local", "STORAGE_PATH=storage", "MAX_UPLOAD_MB=200", "VIDEO_RETENTION_DAYS=30",
         "POSE_MODEL_PATH=../research/gaitsense_poc/models/pose_landmarker_full.task"]
with target.open("x", encoding="utf-8") as file:
    file.write("\n".join(lines) + "\n")
print("Created private backend/.env from the existing Atlas settings. Atlas still needs reconnection; nothing was migrated.")
