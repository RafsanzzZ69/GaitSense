import hashlib
import shutil
import tempfile
from contextlib import contextmanager
from pathlib import Path, PurePosixPath

import cv2
from fastapi import HTTPException


class Storage:
    def __init__(self, settings):
        self.settings = settings
        self.root = settings.storage_path
        self.root.mkdir(parents=True, exist_ok=True)
        self.s3 = None
        if settings.storage_provider == "s3":
            import boto3
            self.s3 = boto3.client("s3", endpoint_url=settings.s3_endpoint_url)

    def path(self, key):
        parts = PurePosixPath(key)
        if parts.is_absolute() or ".." in parts.parts or "\\" in key or ":" in key:
            raise ValueError("Invalid object key")
        path = (self.root / key).resolve()
        if not path.is_relative_to(self.root.resolve()):
            raise ValueError("Object key escapes storage")
        return path

    def put(self, source, key):
        # Validate keys for both providers; never incorporate the uploaded filename.
        path = self.path(key)
        if self.s3:
            self.s3.upload_file(str(source), self.settings.s3_bucket, key,
                                ExtraArgs={"ContentType": "application/octet-stream"})
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, path)
        result = {"provider": self.settings.storage_provider, "key": key}
        if self.s3:
            result["bucket"] = self.settings.s3_bucket
        return result

    def delete(self, key):
        path = self.path(key)
        if self.s3:
            self.s3.delete_object(Bucket=self.settings.s3_bucket, Key=key)
        else:
            path.unlink(missing_ok=True)

    def check_location(self, asset):
        ref = asset["storage"]
        if ref["provider"] != self.settings.storage_provider:
            raise ValueError("Stored media uses a different storage provider; migrate storage before changing configuration")
        if self.s3 and ref.get("bucket") != self.settings.s3_bucket:
            raise ValueError("Stored media uses a different bucket")

    def delete_asset(self, asset):
        self.check_location(asset)
        self.delete(asset["storage"]["key"])

    @contextmanager
    def materialize_asset(self, asset):
        self.check_location(asset)
        with self.materialize(asset["storage"]["key"]) as path:
            yield path

    @contextmanager
    def materialize(self, key):
        path = self.path(key)
        if not self.s3:
            yield path
            return
        with tempfile.TemporaryDirectory(prefix="gaitsense-read-") as directory:
            temp = Path(directory) / "video.bin"
            self.s3.download_file(self.settings.s3_bucket, key, str(temp))
            yield temp

    def stream(self, key):
        with self.materialize(key) as path, path.open("rb") as source:
            while chunk := source.read(1024 * 1024):
                yield chunk


def save_upload(file, destination, maximum):
    size, checksum = 0, hashlib.sha256()
    with destination.open("xb") as target:
        while chunk := file.read(1024 * 1024):
            size += len(chunk)
            if size > maximum:
                raise HTTPException(413, "Video exceeds the upload limit")
            checksum.update(chunk)
            target.write(chunk)
    if size == 0:
        raise HTTPException(422, "The video is empty")
    return size, checksum.hexdigest()


def probe_video(path):
    with Path(path).open("rb") as file:
        header = file.read(16)
    if header[4:8] == b"ftyp":
        content_type = "video/mp4"
    elif header[:4] == b"\x1aE\xdf\xa3":
        content_type = "video/webm"
    else:
        raise HTTPException(422, "Upload a real MP4, MOV or WebM video")
    cap = cv2.VideoCapture(str(path))
    try:
        fps = float(cap.get(cv2.CAP_PROP_FPS))
        frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        width, height = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        if not 5 <= fps <= 240 or not 2 <= frames / fps <= 60:
            raise HTTPException(422, "Video must be 2-60 seconds at 5-240 FPS")
        if not (64 <= width <= 4096 and 64 <= height <= 4096) or width * height > 9_000_000:
            raise HTTPException(422, "Unsupported video resolution")
        ok, _ = cap.read()
        if not ok:
            raise HTTPException(422, "Video cannot be decoded")
        return {"fps": fps, "durationSeconds": frames / fps,
                "resolution": {"width": width, "height": height}}, content_type
    finally:
        cap.release()
