"""Open the verified Atlas URI in MongoDB for VS Code; let VS Code encrypt and save it.

Uses discovered replica-set seed hosts to avoid VS Code-specific SRV resolver failures.
Never writes a password to workspace settings or prints the connection URI.
"""
import os
import subprocess
from pathlib import Path
from urllib.parse import quote, urlencode, urlsplit

from pymongo import MongoClient

from app.config import Settings
from app.db import connect


def main():
    settings = Settings()
    original = urlsplit(settings.mongodb_uri.get_secret_value())
    if not original.hostname or not original.hostname.endswith(".mongodb.net"):
        raise SystemExit("This helper is only for the configured Atlas cluster")
    client = connect(settings)
    try:
        topology = client.admin.command("hello")
    finally:
        client.close()
    hosts = topology.get("hosts", [])
    replica_set = topology.get("setName")
    if not hosts or not replica_set or any(not h.split(":")[0].endswith(".mongodb.net") for h in hosts):
        raise SystemExit("Could not verify the Atlas replica-set hosts")
    # URI username/password are already percent-encoded. Preserve that encoding.
    authority = original.netloc.rsplit("@", 1)[0]
    if ":" not in authority or "@" not in original.netloc:
        raise SystemExit("A username/password Atlas URI is required")
    query = urlencode({"authSource": "admin", "replicaSet": replica_set, "tls": "true",
                       "retryWrites": "true", "w": "majority", "appName": "GaitSense-VSCode"})
    uri = f"mongodb://{authority}@{','.join(hosts)}/{quote(settings.mongo_database)}?{query}"
    with MongoClient(uri, serverSelectionTimeoutMS=8000) as verification:
        verification.admin.command("ping")
    if os.name != "nt":
        raise SystemExit("Automatic VS Code opening is currently supported on Windows only")
    code = Path(os.environ["LOCALAPPDATA"]) / "Programs/Microsoft VS Code/Code.exe"
    if not code.is_file():
        raise SystemExit("VS Code executable not found")
    link = "vscode://mongodb.mongodb-vscode/connectWithURI?" + urlencode({
        "connectionString": uri, "reuseExisting": "true", "name": "GaitSense Atlas (saved)"})
    subprocess.Popen([str(code), "--open-url", link], stdout=subprocess.DEVNULL,
                     stderr=subprocess.DEVNULL, creationflags=subprocess.CREATE_NO_WINDOW)
    print("Verified Atlas connection sent to VS Code. Approve Open/Connect and choose Global if prompted.")


if __name__ == "__main__":
    main()
