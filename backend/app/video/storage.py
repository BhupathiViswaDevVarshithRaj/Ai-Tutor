"""Where media files live, and short-lived signed links to them.

Files are stored by key (e.g. "<user>/videos/<job>/video.mp4"), either under MEDIA_ROOT
(MEDIA_STORAGE=local: the API and the video worker container share that folder) or in the
media_blobs table (MEDIA_STORAGE=database: for hosts like Render, where the worker runs
elsewhere and can't share a disk with the API). Browsers fetch media through
`GET /api/v1/media/{asset_id}` with a signed, expiring token, because <video> and <track>
can't send an Authorization header.
"""

import hashlib
import hmac
import re
import shutil
import time
import uuid
from pathlib import Path
from typing import Protocol

from fastapi import Request
from fastapi.responses import FileResponse, Response
from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert

from app.core.config import get_settings
from app.db.models import MediaBlob
from app.db.session import session_scope

CACHE_HEADERS = {"Cache-Control": "private, max-age=3600"}


class MediaStorage(Protocol):
    async def save_file(self, key: str, source: Path) -> int: ...
    async def save_text(self, key: str, text: str) -> int: ...
    async def remove(self, key: str) -> None: ...
    async def response(self, key: str, mime_type: str, request: Request) -> Response | None: ...


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

    async def save_file(self, key: str, source: Path) -> int:
        return self.put_file(key, source)

    async def save_text(self, key: str, text: str) -> int:
        return self.put_text(key, text)

    async def remove(self, key: str) -> None:
        self.delete(key)

    async def response(self, key: str, mime_type: str, request: Request) -> Response | None:
        path = self.path(key)
        if not path.is_file():
            return None
        return FileResponse(path, media_type=mime_type, headers=CACHE_HEADERS)


_RANGE = re.compile(r"bytes=(\d*)-(\d*)$")


class DatabaseMediaStorage:
    """Files as rows in media_blobs. Videos are a few MB, so this is fine for a small deploy."""

    async def save_file(self, key: str, source: Path) -> int:
        return await self._put(key, source.read_bytes())

    async def save_text(self, key: str, text: str) -> int:
        return await self._put(key, text.encode("utf-8"))

    async def _put(self, key: str, data: bytes) -> int:
        stmt = insert(MediaBlob).values(key=key, data=data)
        stmt = stmt.on_conflict_do_update(index_elements=[MediaBlob.key], set_={"data": data})
        async with session_scope() as session:
            await session.execute(stmt)
            await session.commit()
        return len(data)

    async def remove(self, key: str) -> None:
        async with session_scope() as session:
            await session.execute(delete(MediaBlob).where(MediaBlob.key == key))
            await session.commit()

    async def response(self, key: str, mime_type: str, request: Request) -> Response | None:
        async with session_scope() as session:
            size = await session.scalar(
                select(func.octet_length(MediaBlob.data)).where(MediaBlob.key == key)
            )
            if size is None:
                return None
            start, end = 0, size - 1
            match = _RANGE.match(request.headers.get("range", "").strip())
            ranged = bool(match and (match[1] or match[2]))
            if match and ranged:
                if match[1]:
                    start = int(match[1])
                    end = min(int(match[2]), size - 1) if match[2] else size - 1
                else:  # "bytes=-N": the last N bytes
                    start = max(size - int(match[2]), 0)
                if start >= size or start > end:
                    return Response(status_code=416, headers={"Content-Range": f"bytes */{size}"})
            # substring() is 1-based; only the requested part leaves the database.
            chunk = await session.scalar(
                select(func.substring(MediaBlob.data, start + 1, end - start + 1)).where(
                    MediaBlob.key == key
                )
            )
        headers = {**CACHE_HEADERS, "Accept-Ranges": "bytes"}
        if ranged:
            headers["Content-Range"] = f"bytes {start}-{end}/{size}"
            return Response(chunk, status_code=206, media_type=mime_type, headers=headers)
        return Response(chunk, media_type=mime_type, headers=headers)


def get_storage() -> MediaStorage:
    settings = get_settings()
    if settings.media_storage == "database":
        return DatabaseMediaStorage()
    return LocalMediaStorage(settings.media_root)


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
