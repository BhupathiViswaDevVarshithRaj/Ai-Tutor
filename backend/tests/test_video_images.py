"""Unit tests for picture search (Wikimedia Commons) with a stand-in HTTP transport."""

import io
from pathlib import Path

import httpx
import pytest
from PIL import Image

from app.core.config import Settings
from app.video.images import WikimediaImages, credit_line, pick
from app.video.script import Scene, VideoScript, validate_script


def png(size=(800, 500), mode="RGB") -> bytes:
    buf = io.BytesIO()
    Image.new(mode, size, (200, 30, 30, 128) if mode == "RGBA" else (200, 30, 30)).save(buf, "PNG")
    return buf.getvalue()


def page(
    index, title, *, mime="image/jpeg", width=1600, height=900, url=None, artist="A", lic="CC0"
):
    return {
        "index": index,
        "title": title,
        "imageinfo": [
            {
                "mime": mime,
                "width": width,
                "height": height,
                "thumburl": url or f"https://upload.wikimedia.org/thumb/{index}.jpg",
                "descriptionurl": f"https://commons.wikimedia.org/wiki/{title}",
                "extmetadata": {
                    "Artist": {"value": artist},
                    "LicenseShortName": {"value": lic},
                },
            }
        ],
    }


class FakeCommons:
    """Answers search requests with `results[query]` and serves the files in `files`."""

    def __init__(self, results: dict[str, list[dict]], files: dict[str, bytes]) -> None:
        self.results, self.files = results, files
        self.requests: list[httpx.Request] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if request.url.host == "commons.wikimedia.org":
            pages = self.results.get(request.url.params["gsrsearch"], [])
            return httpx.Response(200, json={"query": {"pages": pages}} if pages else {})
        body = self.files.get(str(request.url))
        return httpx.Response(200, content=body) if body else httpx.Response(404)


def finder(fake: FakeCommons) -> WikimediaImages:
    return WikimediaImages(Settings(media_contact="test@example.org"), httpx.MockTransport(fake))


async def test_finds_a_photo_and_keeps_its_credit(tmp_path: Path):
    url = "https://upload.wikimedia.org/thumb/1.jpg"
    fake = FakeCommons(
        {
            "AK-47 rifle filetype:bitmap": [
                page(1, "File:AK-47.jpg", artist='<a href="x">Ickybicky</a>')
            ]
        },
        {url: png()},
    )
    found = await finder(fake).find("AK-47 rifle", tmp_path / "p.png")
    assert found and found.title == "File:AK-47.jpg"
    assert found.credit == "Image: Ickybicky · CC0 · Wikimedia Commons"
    assert found.source_url == "https://commons.wikimedia.org/wiki/File:AK-47.jpg"
    # Saved as RGBA PNG: Manim reads pictures with mode="RGBA".
    with Image.open(found.path) as img:
        assert img.format == "PNG" and img.mode == "RGBA"
    search = fake.requests[0]
    assert search.url.params["gsrnamespace"] == "6" and search.url.params["iiurlwidth"] == "1280"
    assert "test@example.org" in search.headers["user-agent"]  # Wikimedia's UA policy


async def test_prefers_photos_then_falls_back_to_drawings(tmp_path: Path):
    url = "https://upload.wikimedia.org/thumb/2.png"
    fake = FakeCommons(
        {"heart anatomy": [page(2, "File:Heart.svg", mime="image/svg+xml", url=url)]},
        {url: png(mode="RGBA")},
    )
    found = await finder(fake).find("heart anatomy", tmp_path / "p.png")
    assert found and found.title == "File:Heart.svg"
    queries = [r.url.params["gsrsearch"] for r in fake.requests if "gsrsearch" in r.url.params]
    assert queries == ["heart anatomy filetype:bitmap", "heart anatomy"]


async def test_skips_unusable_results_and_foreign_hosts(tmp_path: Path):
    good = "https://upload.wikimedia.org/thumb/9.jpg"
    results = [
        page(1, "File:Tiny.jpg", width=200, height=150),  # too small
        page(2, "File:Panorama.jpg", width=8000, height=1000),  # too stretched
        page(3, "File:Video.webm", mime="video/webm"),  # not a picture
        page(4, "File:Elsewhere.jpg", url="https://evil.example/x.jpg"),  # not Wikimedia
        page(5, "File:Broken.jpg", url="https://upload.wikimedia.org/thumb/5.jpg"),  # not an image
        page(6, "File:Good.jpg", url=good),
    ]
    fake = FakeCommons(
        {"microscope filetype:bitmap": results},
        {"https://upload.wikimedia.org/thumb/5.jpg": b"<html>", good: png()},
    )
    found = await finder(fake).find("microscope", tmp_path / "p.png")
    assert found and found.title == "File:Good.jpg"
    assert not any(r.url.host == "evil.example" for r in fake.requests)


async def test_a_failed_connection_is_tried_again(tmp_path: Path, monkeypatch):
    async def no_wait(_):
        return None

    monkeypatch.setattr("app.video.images.asyncio.sleep", no_wait)
    url = "https://upload.wikimedia.org/thumb/1.jpg"
    fake = FakeCommons({"leaf filetype:bitmap": [page(1, "File:Leaf.jpg")]}, {url: png()})
    calls = {"n": 0}

    def flaky(request):
        calls["n"] += 1
        if calls["n"] == 1:
            raise httpx.ConnectError("certificate verify failed")
        return fake(request)

    found = await WikimediaImages(Settings(), httpx.MockTransport(flaky)).find(
        "leaf", tmp_path / "p.png"
    )
    assert found and found.title == "File:Leaf.jpg"


async def test_nothing_found_or_network_errors_give_none(tmp_path: Path, monkeypatch):
    async def no_wait(_):
        return None

    monkeypatch.setattr("app.video.images.asyncio.sleep", no_wait)
    assert await finder(FakeCommons({}, {})).find("zzz", tmp_path / "p.png") is None

    def down(request):
        raise httpx.ConnectError("offline")

    offline = WikimediaImages(Settings(), httpx.MockTransport(down))
    assert await offline.find("anything", tmp_path / "p.png") is None


def test_credit_lines_are_plain_text():
    assert credit_line("<span>Jane &amp; Co</span>", "CC BY-SA 4.0") == (
        "Image: Jane & Co · CC BY-SA 4.0 · Wikimedia Commons"
    )
    assert credit_line("", "") == "Image: Unknown author · see source · Wikimedia Commons"


def test_pick_keeps_search_order():
    pages = [page(3, "File:C.jpg"), page(1, "File:A.jpg"), page(2, "File:B.jpg")]
    assert [p["title"] for p in pick(pages)] == ["File:A.jpg", "File:B.jpg", "File:C.jpg"]


def scene(template, **extra):
    base = dict(
        heading="H",
        items=["One", "Two"],
        dates=[],
        expression="",
        x_min=0,
        x_max=1,
        shape="",
        atoms=[],
        image_query="",
        caption="",
        narration="Words.",
    )
    return Scene(template=template, **{**base, **extra})


def test_picture_scenes_need_a_query_and_are_capped_at_three():
    pictures = [scene("image", image_query=f"object {i}") for i in range(5)]
    script = VideoScript(title="T", scenes=[scene("image"), *pictures, scene("bullets")])
    fixed = validate_script(script, "T")
    kinds = [(s.template, s.image_query) for s in fixed.scenes]
    assert kinds == [
        ("title", ""),
        ("image", "object 0"),
        ("image", "object 1"),
        ("image", "object 2"),
        ("bullets", ""),
    ]


@pytest.mark.parametrize("query", ["", "   "])
def test_a_picture_scene_without_a_query_is_dropped(query):
    fixed = validate_script(
        VideoScript(title="T", scenes=[scene("image", image_query=query), scene("bullets")] * 2),
        "T",
    )
    assert [s.template for s in fixed.scenes] == ["title", "bullets", "bullets"]
