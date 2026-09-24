"""Start a disposable loopback-only MongoDB, run tests, and stop only that process."""
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path

from pymongo import MongoClient
from pymongo.errors import PyMongoError

ROOT = Path(__file__).resolve().parents[1]


def main():
    if os.environ.get("GAITSENSE_TEST_MONGODB_URI"):
        return subprocess.call([sys.executable, "-m", "pytest", "tests", *sys.argv[1:]], cwd=ROOT)
    binary = shutil.which("mongod")
    if not binary and os.name == "nt":
        candidates = sorted(Path("C:/Program Files/MongoDB/Server").glob("*/bin/mongod.exe"))
        if candidates:
            binary = str(candidates[-1])
    if not binary:
        raise SystemExit("Install MongoDB Server for isolated tests, or set GAITSENSE_TEST_MONGODB_URI to a disposable server")
    with socket.socket() as reservation:
        reservation.bind(("127.0.0.1", 0))
        port = reservation.getsockname()[1]
    with tempfile.TemporaryDirectory(prefix="gaitsense-mongo-test-") as directory:
        process = subprocess.Popen([binary, "--dbpath", directory, "--port", str(port),
            "--bind_ip", "127.0.0.1", "--logpath", str(Path(directory) / "mongod.log")],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
        client = MongoClient(f"mongodb://127.0.0.1:{port}", serverSelectionTimeoutMS=500)
        try:
            for _ in range(40):
                if process.poll() is not None:
                    raise RuntimeError("Temporary mongod failed to start")
                try:
                    client.admin.command("ping")
                    break
                except PyMongoError:
                    time.sleep(0.25)
            else:
                raise RuntimeError("Temporary MongoDB did not become ready")
            env = {**os.environ, "GAITSENSE_TEST_MONGODB_URI": f"mongodb://127.0.0.1:{port}"}
            return subprocess.call([sys.executable, "-m", "pytest", "tests", *sys.argv[1:]], cwd=ROOT, env=env)
        finally:
            client.close()
            process.terminate()
            process.wait(timeout=20)


if __name__ == "__main__":
    raise SystemExit(main())
