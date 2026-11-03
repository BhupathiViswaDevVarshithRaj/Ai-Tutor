"""World-language courses API: enrolment, vocabulary, practice, role-play, progress."""

import pytest

from app.ai.llm.base import LLMRefusal
from app.ai.llm.factory import get_llm
from app.ai.llm.mock_provider import MockLLMProvider
from tests.conftest import API, register_user
from tests.test_tutor import parse_sse

pytestmark = pytest.mark.integration

L = f"{API}/languages"


class RecordingLLM(MockLLMProvider):
    def __init__(self) -> None:
        super().__init__(delay_seconds=0)
        self.systems: list[str] = []

    async def stream_chat(self, *, system, messages, role="tutor"):
        self.systems.append(system)
        async for event in super().stream_chat(system=system, messages=messages, role=role):
            yield event


@pytest.fixture
def llm(app):
    provider = RecordingLLM()
    app.dependency_overrides[get_llm] = lambda: provider
    return provider


async def enrolled(api, level="A2", language="de") -> dict:
    headers = await register_user(api)
    resp = await api.put(f"{L}/{language}", headers=headers, json={"level": level})
    assert resp.status_code == 200, resp.text
    return headers


async def start(api, headers, skill, language="de", **extra):
    resp = await api.post(
        f"{L}/{language}/practice", headers=headers, json={"skill": skill, **extra}
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def test_courses_list_and_enrolment(api, llm):
    headers = await register_user(api)
    courses = (await api.get(L, headers=headers)).json()
    assert [c["code"] for c in courses] == ["de", "fr", "es", "ja", "ko", "zh", "it", "pt"]
    assert not any(c["enrolled"] for c in courses)
    assert next(c for c in courses if c["code"] == "zh")["name"] == "Chinese"

    await api.put(f"{L}/ja", headers=headers, json={"level": "A1"})
    resp = await api.put(f"{L}/ja", headers=headers, json={"level": "B1"})  # change level
    assert resp.json()["level"] == "B1"
    ja = next(c for c in (await api.get(L, headers=headers)).json() if c["code"] == "ja")
    assert ja["enrolled"] is True and ja["level"] == "B1"


async def test_rejects_unknown_languages_levels_and_unenrolled_use(api, llm):
    headers = await register_user(api)
    assert (await api.put(f"{L}/xx", headers=headers, json={"level": "A1"})).status_code == 422
    assert (await api.put(f"{L}/de", headers=headers, json={"level": "D1"})).status_code == 422
    resp = await api.post(f"{L}/de/vocabulary/generate", headers=headers, json={})
    assert resp.status_code == 409 and resp.json()["code"] == "not_enrolled"
    assert (await api.get(L)).status_code == 401


async def test_vocabulary_generation_and_spaced_repetition(api, llm):
    headers = await enrolled(api)
    first = await api.post(f"{L}/de/vocabulary/generate", headers=headers, json={"topic": "food"})
    assert first.status_code == 201
    words = first.json()
    assert len(words) == 8 and words[0]["level"] == "A2" and words[0]["topic"] == "food"
    # Asking again adds new words rather than repeating the deck.
    again = (await api.post(f"{L}/de/vocabulary/generate", headers=headers, json={})).json()
    assert len(again) == 8 and not {w["word"] for w in again} & {w["word"] for w in words}

    due = (await api.get(f"{L}/de/vocabulary", headers=headers, params={"due": True})).json()
    assert len(due) == 16

    card = words[0]["id"]
    reviewed = (
        await api.post(f"{L}/vocabulary/{card}/review", headers=headers, json={"grade": "good"})
    ).json()
    assert reviewed["repetitions"] == 1 and reviewed["interval_days"] == 1
    due = (await api.get(f"{L}/de/vocabulary", headers=headers, params={"due": True})).json()
    assert card not in {w["id"] for w in due}

    bad = await api.post(f"{L}/vocabulary/{card}/review", headers=headers, json={"grade": "ok"})
    assert bad.status_code == 422
    assert (await api.delete(f"{L}/vocabulary/{card}", headers=headers)).status_code == 204
    assert len((await api.get(f"{L}/de/vocabulary", headers=headers)).json()) == 15


async def test_vocabulary_is_private(api, llm):
    owner = await enrolled(api)
    card = (await api.post(f"{L}/de/vocabulary/generate", headers=owner, json={})).json()[0]["id"]
    other = await register_user(api, email="other@example.com")
    resp = await api.post(f"{L}/vocabulary/{card}/review", headers=other, json={"grade": "good"})
    assert resp.status_code == 404
    assert (await api.delete(f"{L}/vocabulary/{card}", headers=other)).status_code == 404
    assert (await api.get(f"{L}/de/vocabulary", headers=other)).json() == []


async def test_grammar_answers_stay_hidden_until_marked(api, llm):
    headers = await enrolled(api)
    practice = await start(api, headers, "grammar", topic="present tense")
    exercises = practice["content"]["exercises"]
    assert len(exercises) == 3 and practice["completed_at"] is None
    assert all("answer" not in e and "explanation" not in e for e in exercises)
    assert exercises[0]["options"] == ["correct", "wrong", "also wrong"]

    url = f"{L}/practice/{practice['id']}/submit"
    wrong_count = await api.post(url, headers=headers, json={"answers": ["correct"]})
    assert wrong_count.status_code == 422

    marked = (
        await api.post(url, headers=headers, json={"answers": ["correct", "AM", "wrong"]})
    ).json()
    assert marked["score"] == pytest.approx(0.667)
    assert [i["correct"] for i in marked["result"]["items"]] == [True, True, False]
    assert marked["content"]["exercises"][0]["answer"] == "correct"  # revealed after marking
    again = await api.post(url, headers=headers, json={"answers": ["correct", "am", "correct"]})
    assert again.status_code == 409


@pytest.mark.parametrize("skill", ["listening", "reading"])
async def test_comprehension_practice_is_marked(api, llm, skill):
    headers = await enrolled(api)
    practice = await start(api, headers, skill)
    assert practice["content"]["text"] and len(practice["content"]["questions"]) == 2
    marked = (
        await api.post(
            f"{L}/practice/{practice['id']}/submit",
            headers=headers,
            json={"answers": ["correct", "correct"]},
        )
    ).json()
    assert marked["score"] == 1.0


async def test_writing_is_marked_with_feedback(api, llm):
    headers = await enrolled(api)
    practice = await start(api, headers, "writing")
    assert practice["content"]["min_words"] == 20
    url = f"{L}/practice/{practice['id']}/submit"
    assert (await api.post(url, headers=headers, json={})).status_code == 422
    marked = (await api.post(url, headers=headers, json={"text": "Ich lerne Deutsch."})).json()
    assert marked["score"] == 0.5
    assert marked["result"]["corrected_text"] == "Ich lerne Deutsch."
    assert marked["answers"] == {"text": "Ich lerne Deutsch.", "words": 3}


async def test_speaking_compares_what_was_heard(api, llm):
    headers = await enrolled(api)
    practice = await start(api, headers, "speaking")
    phrases = [p["text"] for p in practice["content"]["phrases"]]
    marked = (
        await api.post(
            f"{L}/practice/{practice['id']}/submit",
            headers=headers,
            json={"transcripts": [phrases[0], "something else entirely", ""]},
        )
    ).json()
    verdicts = [i["verdict"] for i in marked["result"]["items"]]
    assert verdicts[0] == "good" and verdicts[2] == "retry"


async def test_roleplay_opens_a_voice_conversation_in_the_target_language(api, llm):
    headers = await enrolled(api, level="B1", language="fr")
    practice = await start(api, headers, "conversation", language="fr", scenario="At a café")
    conversation_id = practice["conversation_id"]
    assert practice["content"] == {"scenario": "At a café"}

    conversation = (await api.get(f"{API}/conversations/{conversation_id}", headers=headers)).json()
    assert conversation["mode"] == "voice" and conversation["language"] == "fr"
    assert conversation["level"] == "intermediate"
    assert conversation["title"] == "French role-play · At a café"

    resp = await api.post(
        f"{API}/tutor/conversations/{conversation_id}/reply",
        headers=headers,
        json={"content": "Bonjour !"},
    )
    assert parse_sse(resp.text)[-1][0] == "done"
    assert "role-playing this situation: At a café" in llm.systems[0]
    assert "French" in llm.systems[0] and "plain sentences" in llm.systems[0]

    submit = await api.post(f"{L}/practice/{practice['id']}/submit", headers=headers, json={})
    assert submit.status_code == 400


async def test_practice_is_private_and_listed(api, llm):
    owner = await enrolled(api)
    practice = await start(api, owner, "grammar")
    other = await register_user(api, email="other@example.com")
    assert (await api.get(f"{L}/practice/{practice['id']}", headers=other)).status_code == 404
    listed = (await api.get(f"{L}/de/practice", headers=owner)).json()
    assert [(p["id"], p["skill"], p["title"]) for p in listed] == [
        (practice["id"], "grammar", "[mock] A grammar point")
    ]
    assert (
        await api.get(f"{L}/de/practice", headers=owner, params={"skill": "reading"})
    ).json() == []


async def test_progress_summarises_words_skills_and_streak(api, llm):
    headers = await enrolled(api, level="A1")
    words = (await api.post(f"{L}/de/vocabulary/generate", headers=headers, json={})).json()
    for w in words[:3]:
        await api.post(f"{L}/vocabulary/{w['id']}/review", headers=headers, json={"grade": "good"})
    practice = await start(api, headers, "grammar")
    await api.post(
        f"{L}/practice/{practice['id']}/submit",
        headers=headers,
        json={"answers": ["correct", "am", "correct"]},
    )
    await start(api, headers, "reading")  # started, not finished

    progress = (await api.get(f"{L}/de/progress", headers=headers)).json()
    assert progress["level"] == "A1"
    assert progress["words"] == {"total": 8, "learned": 3, "mastered": 0, "due": 5}
    assert progress["skills"]["grammar"] == {
        "sessions": 1,
        "completed": 1,
        "average_score": 1.0,
        "last_practised": progress["skills"]["grammar"]["last_practised"],
    }
    assert progress["skills"]["reading"]["completed"] == 0
    assert progress["skills"]["writing"]["sessions"] == 0
    assert progress["streak_days"] == 1 and progress["active_days_last_7"] == 1

    courses = (await api.get(L, headers=headers)).json()
    de = next(c for c in courses if c["code"] == "de")
    assert (de["words"], de["due"]) == (8, 5) and de["last_practised"] is not None


async def test_model_refusal_is_reported(api, app):
    class Refusing(MockLLMProvider):
        async def parse(self, **_):
            raise LLMRefusal()

    app.dependency_overrides[get_llm] = lambda: Refusing()
    headers = await enrolled(api)
    resp = await api.post(f"{L}/de/practice", headers=headers, json={"skill": "grammar"})
    assert resp.status_code == 422 and resp.json()["code"] == "ai_refused"
    assert (await api.get(f"{L}/de/practice", headers=headers)).json() == []
