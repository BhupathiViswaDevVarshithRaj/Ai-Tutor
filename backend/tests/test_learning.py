import uuid

import pytest

from tests.conftest import API, register_user

pytestmark = pytest.mark.integration

LESSON = {"topic": "Machine learning", "level": "beginner", "language": "en"}


async def _conversation(api, headers, **overrides) -> dict:
    payload = {"title": "Intro", "language": "hi", "level": "beginner", **overrides}
    resp = await api.post(f"{API}/conversations", headers=headers, json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


async def test_lesson_crud_and_listing(api):
    headers = await register_user(api)
    created = await api.post(f"{API}/lessons", headers=headers, json=LESSON)
    assert created.status_code == 201
    lesson = created.json()
    assert lesson["status"] == "active" and lesson["plan"] is None

    await api.post(f"{API}/lessons", headers=headers, json={**LESSON, "topic": "Photosynthesis"})
    listing = (await api.get(f"{API}/lessons", headers=headers)).json()
    assert listing["total"] == 2
    assert listing["items"][0]["topic"] == "Photosynthesis"  # most recently updated first

    patched = await api.patch(
        f"{API}/lessons/{lesson['id']}", headers=headers, json={"status": "completed"}
    )
    assert patched.json()["status"] == "completed"
    completed = await api.get(f"{API}/lessons", headers=headers, params={"status": "completed"})
    assert [i["id"] for i in completed.json()["items"]] == [lesson["id"]]

    assert (await api.delete(f"{API}/lessons/{lesson['id']}", headers=headers)).status_code == 204
    assert (await api.get(f"{API}/lessons/{lesson['id']}", headers=headers)).status_code == 404


async def test_lesson_validation(api):
    headers = await register_user(api)
    for bad in ({**LESSON, "topic": " "}, {**LESSON, "language": "xx"}, {**LESSON, "level": "pro"}):
        assert (await api.post(f"{API}/lessons", headers=headers, json=bad)).status_code == 422


async def test_conversation_messages_are_persisted_in_order(api):
    headers = await register_user(api)
    conv = await _conversation(api, headers)
    for text in ("What is gravity?", "Give an example"):
        resp = await api.post(
            f"{API}/conversations/{conv['id']}/messages", headers=headers, json={"content": text}
        )
        assert resp.status_code == 201
        assert resp.json()["role"] == "user" and resp.json()["language"] == "hi"

    detail = (await api.get(f"{API}/conversations/{conv['id']}", headers=headers)).json()
    assert [m["content"] for m in detail["messages"]] == ["What is gravity?", "Give an example"]

    empty = await api.post(
        f"{API}/conversations/{conv['id']}/messages", headers=headers, json={"content": "   "}
    )
    assert empty.status_code == 422


async def test_deleting_a_lesson_deletes_its_conversations(api):
    headers = await register_user(api)
    lesson = (await api.post(f"{API}/lessons", headers=headers, json=LESSON)).json()
    conv = await _conversation(api, headers, lesson_id=lesson["id"])
    by_lesson = await api.get(
        f"{API}/conversations", headers=headers, params={"lesson_id": lesson["id"]}
    )
    assert by_lesson.json()["total"] == 1

    await api.delete(f"{API}/lessons/{lesson['id']}", headers=headers)
    assert (await api.get(f"{API}/conversations/{conv['id']}", headers=headers)).status_code == 404


async def test_user_data_is_isolated(api):
    alice = await register_user(api, email="alice@example.com")
    bob = await register_user(api, email="bob@example.com")

    lesson = (await api.post(f"{API}/lessons", headers=alice, json=LESSON)).json()
    conv = await _conversation(api, alice, lesson_id=lesson["id"])
    await api.post(
        f"{API}/conversations/{conv['id']}/messages", headers=alice, json={"content": "secret"}
    )

    # Bob cannot see, change, delete or write to Alice's data. Responses are 404, not 403,
    # so Bob can't even confirm the IDs exist.
    assert (await api.get(f"{API}/lessons", headers=bob)).json()["total"] == 0
    assert (await api.get(f"{API}/conversations", headers=bob)).json()["total"] == 0
    assert (await api.get(f"{API}/lessons/{lesson['id']}", headers=bob)).status_code == 404
    assert (
        await api.patch(f"{API}/lessons/{lesson['id']}", headers=bob, json={"status": "archived"})
    ).status_code == 404
    assert (await api.delete(f"{API}/lessons/{lesson['id']}", headers=bob)).status_code == 404
    assert (await api.get(f"{API}/conversations/{conv['id']}", headers=bob)).status_code == 404
    assert (await api.delete(f"{API}/conversations/{conv['id']}", headers=bob)).status_code == 404
    hijack = await api.post(
        f"{API}/conversations/{conv['id']}/messages", headers=bob, json={"content": "hi"}
    )
    assert hijack.status_code == 404
    attach = await api.post(
        f"{API}/conversations",
        headers=bob,
        json={"title": "x", "language": "en", "level": "beginner", "lesson_id": lesson["id"]},
    )
    assert attach.status_code == 404

    # Alice's data is intact.
    detail = (await api.get(f"{API}/conversations/{conv['id']}", headers=alice)).json()
    assert [m["content"] for m in detail["messages"]] == ["secret"]
    assert (await api.get(f"{API}/lessons/{lesson['id']}", headers=alice)).json()[
        "status"
    ] == "active"


async def test_unknown_ids_return_404(api):
    headers = await register_user(api)
    missing = uuid.uuid4()
    assert (await api.get(f"{API}/lessons/{missing}", headers=headers)).status_code == 404
    assert (await api.get(f"{API}/conversations/{missing}", headers=headers)).status_code == 404
    assert (await api.get(f"{API}/lessons/not-a-uuid", headers=headers)).status_code == 422
