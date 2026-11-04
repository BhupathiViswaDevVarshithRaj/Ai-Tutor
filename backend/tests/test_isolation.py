"""Every route that takes a resource ID refuses other users' resources.

The routes come from the app's own OpenAPI schema, so a new route with an ID in its path fails
here until the test knows how to make that resource: isolation can't be forgotten.
"""

import re

import pytest

from app.main import app as fastapi_app
from app.services.video_service import get_video_queue
from tests.conftest import API, register_user
from tests.test_videos import FakeQueue

pytestmark = pytest.mark.integration

TOPIC = {"topic": "Photosynthesis", "level": "beginner", "language": "en"}
# `{language}` routes are scoped to the signed-in user by the language code, not a foreign ID.
USER_SCOPED_PARAMS = {"language"}


def id_routes() -> list[tuple[str, str]]:
    routes = []
    for path, ops in fastapi_app.openapi()["paths"].items():
        params = set(re.findall(r"{(\w+)}", path))
        if params and not params <= USER_SCOPED_PARAMS:
            routes += [(method.upper(), path) for method in ops]
    return routes


async def owner_resources(api, headers) -> dict[str, str]:
    """One of everything, owned by `headers`' user; returns path-parameter values."""

    async def post(path, body, status=201):
        resp = await api.post(f"{API}{path}", headers=headers, json=body)
        assert resp.status_code == status, (path, resp.text)
        return resp.json()

    lesson = await post("/tutor/lessons", TOPIC)
    quiz = await post("/quizzes", {**TOPIC, "question_count": 3})
    answers = [{"question_id": q["id"], "answer": "x"} for q in quiz["questions"]]
    attempt = await post(f"/quizzes/{quiz['id']}/submit", {"answers": answers}, status=200)
    await api.put(f"{API}/languages/de", headers=headers, json={"level": "A2"})
    card = (await post("/languages/de/vocabulary/generate", {}))[0]
    practice = await post("/languages/de/practice", {"skill": "grammar"})
    return {
        "lesson_id": lesson["lesson"]["id"],
        "conversation_id": lesson["conversation"]["id"],
        "quiz_id": quiz["id"],
        "submission_id": attempt["id"],
        "map_id": (await post("/mindmaps", TOPIC))["id"],
        "diagram_id": (await post("/diagrams", TOPIC))["id"],
        "job_id": (await post("/videos", {**TOPIC, "target_seconds": 45}, status=202))["id"],
        "item_id": card["id"],
        "practice_id": practice["id"],
    }


@pytest.fixture
def queue(app):
    app.dependency_overrides[get_video_queue] = lambda: FakeQueue()


async def test_every_id_route_refuses_other_users(api, queue):
    owner = await register_user(api, email="owner@example.com")
    ids = await owner_resources(api, owner)
    intruder = await register_user(api, email="intruder@example.com")

    routes = id_routes()
    assert len(routes) >= 20  # sanity: the schema really was read
    for method, path in routes:
        params = set(re.findall(r"{(\w+)}", path))
        unknown = params - USER_SCOPED_PARAMS - set(ids)
        assert not unknown, f"{method} {path}: teach owner_resources to make {unknown}"
        url = path.format(**{p: ids.get(p, "de") for p in params})
        # A plausible body, so validation can't hide whether ownership is checked.
        body = {
            "content": "hi",
            "role": "user",
            "answers": [],
            "title": "x",
            "version": 1,
            "grade": "good",
            "node_id": "n1",
        }
        resp = await api.request(method, url, headers=intruder, json=body)
        assert resp.status_code == 404, f"{method} {path} -> {resp.status_code}: {resp.text}"

    # Nothing of the owner's was changed or deleted by those requests.
    kinds = {
        "lessons": "lesson_id",
        "conversations": "conversation_id",
        "quizzes": "quiz_id",
        "mindmaps": "map_id",
        "diagrams": "diagram_id",
        "videos": "job_id",
    }
    for kind, key in kinds.items():
        resp = await api.get(f"{API}/{kind}/{ids[key]}", headers=owner)
        assert resp.status_code == 200, (kind, resp.text)


@pytest.mark.parametrize("path", ["/quizzes", "/mindmaps", "/diagrams", "/videos"])
async def test_create_refuses_another_users_lesson(api, queue, path):
    owner = await register_user(api, email="owner@example.com")
    lesson = (await api.post(f"{API}/tutor/lessons", headers=owner, json=TOPIC)).json()
    intruder = await register_user(api, email="intruder@example.com")
    body = {**TOPIC, "lesson_id": lesson["lesson"]["id"], "target_seconds": 45}
    if path != "/videos":
        body.pop("target_seconds")
    resp = await api.post(f"{API}{path}", headers=intruder, json=body)
    assert resp.status_code == 404, resp.text


async def test_conversation_create_refuses_another_users_lesson(api):
    owner = await register_user(api, email="owner@example.com")
    lesson = (await api.post(f"{API}/tutor/lessons", headers=owner, json=TOPIC)).json()
    intruder = await register_user(api, email="intruder@example.com")
    resp = await api.post(
        f"{API}/conversations",
        headers=intruder,
        json={
            "title": "Mine now",
            "language": "en",
            "level": "beginner",
            "lesson_id": lesson["lesson"]["id"],
        },
    )
    assert resp.status_code == 404, resp.text


async def test_lists_only_show_own_items(api, queue):
    owner = await register_user(api, email="owner@example.com")
    await owner_resources(api, owner)
    intruder = await register_user(api, email="intruder@example.com")
    for path in ("/lessons", "/conversations", "/quizzes", "/mindmaps", "/diagrams", "/videos"):
        resp = await api.get(f"{API}{path}", headers=intruder)
        assert resp.status_code == 200, (path, resp.text)
        body = resp.json()
        assert (body["items"] if isinstance(body, dict) else body) == [], path
    progress = (await api.get(f"{API}/progress", headers=intruder)).json()
    assert progress["quizzes"]["attempts"] == 0
