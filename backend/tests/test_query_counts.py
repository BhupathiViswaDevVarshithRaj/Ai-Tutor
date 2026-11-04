"""No N+1 queries: list pages and My Progress run the same number of SQL statements for a
learner with a few items as for one with many."""

from contextlib import contextmanager

import pytest
from sqlalchemy import event

from app.core.config import get_settings
from app.db.session import get_engine
from app.services.video_service import get_video_queue
from tests.conftest import API, register_user
from tests.test_videos import FakeQueue

pytestmark = pytest.mark.integration

TOPIC = {"topic": "Photosynthesis", "level": "beginner", "language": "en"}
LIST_PAGES = [
    "/lessons",
    "/conversations",
    "/quizzes",
    "/mindmaps",
    "/diagrams",
    "/videos",
    "/progress",
    "/languages",
    "/languages/de/vocabulary",
]


@contextmanager
def counting_queries():
    statements: list[str] = []

    def record(conn, cursor, statement, *args):
        statements.append(statement)

    engine = get_engine().sync_engine
    event.listen(engine, "before_cursor_execute", record)
    try:
        yield statements
    finally:
        event.remove(engine, "before_cursor_execute", record)


async def learner_with(api, n: int, email: str) -> dict[str, str]:
    headers = await register_user(api, email=email)

    async def post(path, body):
        resp = await api.post(f"{API}{path}", headers=headers, json=body)
        assert resp.status_code < 300, (path, resp.text)
        return resp.json()

    await api.put(f"{API}/languages/de", headers=headers, json={"level": "A1"})
    for _ in range(n):
        await post("/tutor/lessons", TOPIC)
        quiz = await post("/quizzes", {**TOPIC, "question_count": 3})
        answers = [{"question_id": q["id"], "answer": "x"} for q in quiz["questions"]]
        await post(f"/quizzes/{quiz['id']}/submit", {"answers": answers})
        await post("/mindmaps", TOPIC)
        await post("/diagrams", TOPIC)
        # Cancelled at once: only two videos may be in progress at a time.
        video = await post("/videos", {**TOPIC, "target_seconds": 45})
        await post(f"/videos/{video['id']}/cancel", {})
        await post("/languages/de/vocabulary/generate", {"topic": f"set {_}"})
    return headers


async def query_counts(api, headers) -> dict[str, int]:
    counts = {}
    for path in LIST_PAGES:
        with counting_queries() as statements:
            resp = await api.get(f"{API}{path}", headers=headers)
        assert resp.status_code == 200, (path, resp.text)
        counts[path] = len(statements)
    return counts


async def test_list_pages_do_not_query_per_item(api, app, monkeypatch):
    monkeypatch.setattr(get_settings(), "ai_rate_limit", 1000)
    monkeypatch.setattr(get_settings(), "video_rate_limit", 1000)
    app.dependency_overrides[get_video_queue] = lambda: FakeQueue()
    few = await query_counts(api, await learner_with(api, 1, "few@example.com"))
    many = await query_counts(api, await learner_with(api, 4, "many@example.com"))
    assert many == few
    # And none is extravagant (My Progress gathers the most, in fixed batches).
    assert max(few.values()) <= 25, few
