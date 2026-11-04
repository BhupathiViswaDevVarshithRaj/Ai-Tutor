"""Real pictures for video scenes, from Wikimedia Commons (freely licensed, no API key).

Search: the MediaWiki Action API (https://www.mediawiki.org/wiki/API:Imageinfo) with
`generator=search` over the File namespace. Commons requires a descriptive User-Agent with
contact details (https://foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_User-Agent_Policy).
Every image is shown with its author and licence, as the licences require.
"""

import html
import io
import logging
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol
from urllib.parse import urlparse

import httpx

from app.core.config import Settings

logger = logging.getLogger(__name__)

API_URL = "https://commons.wikimedia.org/w/api.php"
# Files are only ever downloaded from Wikimedia's own media hosts.
MEDIA_HOSTS = {"upload.wikimedia.org", "thumb.wikimedia.org"}
IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"}
CANDIDATES = 8
MIN_WIDTH = 400
MAX_ASPECT = 3.2  # skip panoramas and long strips
MAX_BYTES = 8 * 1024 * 1024
WIDTH = 1280  # thumbnail width requested (Commons renders SVG diagrams to PNG too)


@dataclass(frozen=True)
class FoundImage:
    path: Path  # a PNG in the job's work folder
    title: str  # e.g. "File:AK-47 assault rifle.jpg"
    credit: str  # "Image: <author> · <licence> · Wikimedia Commons"
    source_url: str  # the file's description page


class ImageFinder(Protocol):
    async def find(self, query: str, dest: Path) -> FoundImage | None: ...


def _plain(value: str | None) -> str:
    """Commons metadata is HTML: keep the text."""
    text = html.unescape(re.sub(r"<[^>]+>", "", value or ""))
    return " ".join(text.split())


def credit_line(artist: str, licence: str) -> str:
    author = _plain(artist)[:60] or "Unknown author"
    return f"Image: {author} · {_plain(licence) or 'see source'} · Wikimedia Commons"


def pick(pages: list[dict]) -> list[dict]:
    """Usable results in search order: real images, big enough, not extreme shapes."""
    usable = []
    for page in sorted(pages, key=lambda p: p.get("index", 0)):
        info = (page.get("imageinfo") or [{}])[0]
        width, height = info.get("width", 0), info.get("height", 0)
        if (
            info.get("mime") in IMAGE_TYPES
            and info.get("thumburl")
            and width >= MIN_WIDTH
            and height > 0
            and max(width / height, height / width) <= MAX_ASPECT
        ):
            usable.append(page)
    return usable


class WikimediaImages:
    def __init__(self, settings: Settings, transport: httpx.AsyncBaseTransport | None = None):
        self.user_agent = (
            f"AITutorDashboard/0.1 ({settings.media_contact}) httpx/{httpx.__version__}"
        )
        self.transport = transport

    async def find(self, query: str, dest: Path) -> FoundImage | None:
        try:
            async with httpx.AsyncClient(
                headers={"User-Agent": self.user_agent},
                timeout=30,
                transport=self.transport,
                follow_redirects=False,
            ) as client:
                # Photos first (bitmaps); drawings and SVG diagrams only if no photo fits.
                for search in (f"{query} filetype:bitmap", query):
                    for page in pick(await self._search(client, search)):
                        found = await self._download(client, page, dest)
                        if found:
                            return found
        except httpx.HTTPError as exc:
            logger.warning("Commons search for %r failed: %s", query, exc)
        return None

    async def _search(self, client: httpx.AsyncClient, query: str) -> list[dict]:
        resp = await client.get(
            API_URL,
            params={
                "action": "query",
                "format": "json",
                "formatversion": "2",
                "generator": "search",
                "gsrsearch": query,
                "gsrnamespace": "6",  # File:
                "gsrlimit": str(CANDIDATES),
                "prop": "imageinfo",
                "iiprop": "url|mime|size|extmetadata",
                "iiurlwidth": str(WIDTH),
                "iiextmetadatafilter": "Artist|LicenseShortName",
            },
        )
        resp.raise_for_status()
        return resp.json().get("query", {}).get("pages", [])

    async def _download(self, client: httpx.AsyncClient, page: dict, dest: Path):
        from PIL import Image, UnidentifiedImageError

        info = page["imageinfo"][0]
        url = info["thumburl"]
        if urlparse(url).scheme != "https" or urlparse(url).hostname not in MEDIA_HOSTS:
            return None
        resp = await client.get(url)
        if resp.status_code != 200 or len(resp.content) > MAX_BYTES:
            return None
        try:
            with Image.open(io.BytesIO(resp.content)) as img:
                img.load()
                # Flatten transparency onto white (diagrams), drop odd colour modes (CMYK).
                if img.mode in ("RGBA", "LA", "P"):
                    rgba = img.convert("RGBA")
                    flat = Image.new("RGB", rgba.size, (255, 255, 255))
                    flat.paste(rgba, mask=rgba.split()[3])
                    img = flat
                # Saved as RGBA: Manim reads the pixels with mode="RGBA", which Pillow 13 rejects
                # for 3-channel data (and the render then hangs instead of failing).
                img.convert("RGB").convert("RGBA").save(dest, "PNG")
        except (UnidentifiedImageError, OSError) as exc:
            logger.warning("Commons file %s isn't a usable image: %s", page.get("title"), exc)
            return None
        meta = info.get("extmetadata", {})
        return FoundImage(
            path=dest,
            title=page.get("title", ""),
            credit=credit_line(
                meta.get("Artist", {}).get("value"), meta.get("LicenseShortName", {}).get("value")
            ),
            source_url=info.get("descriptionurl", ""),
        )
