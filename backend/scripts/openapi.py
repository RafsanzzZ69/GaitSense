import json
from pathlib import Path

from app.config import Settings
from app.main import create_app

settings = Settings(_env_file=None, mongodb_uri="mongodb://127.0.0.1:27017",
                    jwt_secret="schema-export-only-not-a-server-secret")
app = create_app(settings)
target = Path(__file__).resolve().parents[1] / "docs/openapi.json"
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(app.openapi(), indent=2) + "\n", encoding="utf-8")
print(f"Exported API contract: {len(app.openapi()['paths'])} paths")
