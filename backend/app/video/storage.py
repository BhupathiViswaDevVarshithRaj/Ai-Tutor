"""Where media files live, and short-lived signed links to them.

Files are stored under MEDIA_ROOT by key (e.g. "<user>/videos/<job>/video.mp4"). The API and
the video worker container share that folder. Browsers fetch media through
`GET /api/v1/media/{asset_id}` with a signed, expiring token, because <video> and <track>
can't send an Authorization header.
"""

import hashlib
import hmac
import shutil
import time
import uuid
from pathlib import Path

from app.core.config import get_settings


class LocalMediaStorage:
    def __init__(self, root: Path) -> None:
        self.root = root

    def path(self, key: str) -> Path:
        path = (self.root / key).resolve()
        if self.root.resolve() not in path.parents:
            raise ValueError("Media key escapes the media folder")
        return path

    def put_file(self, key: str, source: Path) -> int:
        target = self.path(key)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
        return target.stat().st_size

    def put_text(self, key: str, text: str) -> int:
        target = self.path(key)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text, encoding="utf-8")
        return target.stat().st_size

    def delete(self, key: str) -> None:
        self.path(key).unlink(missing_ok=True)


def get_storage() -> LocalMediaStorage:
    return LocalMediaStorage(get_settings().media_root)


def _signature(asset_id: uuid.UUID, expires: int) -> str:
    key = get_settings().secret_key.encode()
    message = f"media:{asset_id}:{expires}".encode()
    return hmac.new(key, message, hashlib.sha256).hexdigest()


def media_token(asset_id: uuid.UUID, now: float | None = None) -> str:
    expires = int((now or time.time()) + get_settings().media_url_ttl_seconds)
    return f"{expires}.{_signature(asset_id, expires)}"


def check_media_token(asset_id: uuid.UUID, token: str, now: float | None = None) -> bool:
    try:
        expires_text, signature = token.split(".", 1)
        expires = int(expires_text)
    except ValueError:
        return False
    if expires < (now or time.time()):
        return False
    return hmac.compare_digest(signature, _signature(asset_id, expires))


def media_url(asset_id: uuid.UUID) -> str:
    return f"{get_settings().api_prefix}/media/{asset_id}?token={media_token(asset_id)}"
