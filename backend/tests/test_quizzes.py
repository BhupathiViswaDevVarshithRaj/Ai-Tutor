"""Quizzes and progress API: generation, hidden answers, marking, mastery and progress."""

import pytest

from app.ai.llm.base import LLMError
from app.ai.llm.factory import get_llm
from app.ai.llm.mock_provider import MockLLMProvider
from app.ai.quiz import AnswerGrades
from tests.conftest import API, register_user

pytestmark = pytest.mark.integration

Q = f"{API}/quizzes"
REQUEST = {"topic": "Photosynthesis", "level": "beginner", "language": "en", "question_count": 6}


class RecordingLLM(MockLLMProvider):
    def __init__(self) -> None:
        super().__init__()
        self.calls: list[tuple[type, str]] = []
        self.fail_grading = False

    async def parse(self, *, system, messages, schema, role="structured"):
        self.calls.append((schema, messages[-1].content))
        if schema is AnswerGrades and self.fail_grading:
            raise LLMError("The tutor is busy. Please try again.")
        return await super().parse(system=system, messages=messages, schema=schema, role=role)


@pytest.fixture
def llm(app):
    provider = RecordingLLM()
    app.dependency_overrides[get_llm] = lambda: provider
    return provider


async def create(api, headers, **overrides):
    resp = await api.post(Q, headers=headers, json={**REQUEST, **overrides})
    assert resp.status_code == 201, resp.text
    return resp.json()


def right_answer(question) -> str:
    """The mock's right answers: 'Right answer n' (mcq) or 'idea n' (short answer)."""
    n = question["position"] + 1
    return f"Right answer {n}" if question["qtype"] == "mcq" else f"idea {n}"


async def test_a_quiz_is_generated_without_revealing_answers(api, llm):
    headers = await register_user(api)
    quiz = await create(api, headers)
    assert quiz["title"] == "Photosynthesis (mock quiz)"
    assert quiz["question_count"] == 6 and quiz["attempts"] == 0
    assert [q["qtype"] for q in quiz["questions"]] == ["mcq", "mcq", "short_answer"] * 2
    first = quiz["questions"][0]
    assert set(first) == {"id", "position", "qtype", "prompt", "options", "concept", "difficulty"}
    assert "Right answer 1" in first["options"]
    assert "Questions: 6" in llm.calls[-1][1] and "Types: a mix" in llm.calls[-1][1]

    fetched = (await api.get(f"{Q}/{quiz['id']}", headers=headers)).json()
    assert "correct_answer" not in str(fetched) and "explanation" not in str(fetched)

    only_short = await create(api, headers, question_types="short_answer", question_count=3)
    assert {q["qtype"] for q in only_short["questions"]} == {"short_answer"}
    assert (await api.get(Q, headers=headers)).json()["total"] == 2


async def test_submitting_marks_answers_and_explains_them(api, llm):
    headers = await register_user(api)
    quiz = await create(api, headers)
    qs = quiz["questions"]
    answers = [
        {"question_id": qs[0]["id"], "answer": right_answer(qs[0])},
        {"question_id": qs[1]["id"], "answer": "A wrong answer"},
        {"question_id": qs[2]["id"], "answer": "IDEA 3."},  # exact match after normalising
        {"question_id": qs[3]["id"], "answer": right_answer(qs[3])},
        {"question_id": qs[5]["id"], "answer": "I think it is idea"},  # marked by the model
        # qs[4] unanswered
    ]
    resp = await api.post(
        f"{Q}/{quiz['id']}/submit",
        headers=headers,
        json={"answers": answers, "duration_seconds": 95},
    )
    assert resp.status_code == 200, resp.text
    result = resp.json()
    marks = [(r["score"], r["graded_by"]) for r in result["results"]]
    assert marks == [
        (1, "rule"),
        (0, "rule"),
        (1, "rule"),
        (1, "rule"),
        (0, "rule"),
        (0.5, "model"),
    ]
    assert result["correct"] == 3.5 and result["total"] == 6
    assert result["score"] == pytest.approx(3.5 / 6)
    assert result["results"][1]["correct_answer"] == "Right answer 2"
    assert result["results"][1]["explanation"].startswith("Mock explanation")
    assert result["results"][5]["feedback"].startswith("[mock]")
    assert result["duration_seconds"] == 95
    # Only the short answer that didn't match exactly went to the model.
    grading = [p for s, p in llm.calls if s is AnswerGrades]
    assert len(grading) == 1 and "I think it is idea" in grading[0] and "IDEA 3" not in grading[0]

    concepts = {c["concept"]: c for c in result["concepts"]}
    assert concepts["Basics"] == {"concept": "Basics", "correct": 2, "total": 2, "score": 1.0}
    assert concepts["Key terms"]["score"] == 0.0
    assert concepts["Applications"]["score"] == 0.75
    assert result["recommendations"][0]["kind"] == "revise"
    assert result["recommendations"][0]["concept"] == "Key terms"

    again = (await api.get(f"{Q}/attempts/{result['id']}", headers=headers)).json()
    assert again == result
    summary = (await api.get(f"{Q}/{quiz['id']}", headers=headers)).json()
    assert summary["attempts"] == 1 and summary["best_score"] == pytest.approx(3.5 / 6)
    assert summary["last_attempt"]["id"] == result["id"]


async def test_mastery_and_progress_follow_attempts(api, llm):
    headers = await register_user(api)
    quiz = await create(api, headers)
    url = f"{Q}/{quiz['id']}/submit"
    empty = await api.get(f"{API}/progress", headers=headers)
    assert empty.json()["quizzes"] == {
        "quizzes": 1,
        "attempts": 0,
        "average_score": None,
        "best_score": None,
    }

    # First attempt: nothing right. Second: everything right.
    await api.post(url, headers=headers, json={"answers": []})
    perfect = [{"question_id": q["id"], "answer": right_answer(q)} for q in quiz["questions"]]
    best = (await api.post(url, headers=headers, json={"answers": perfect})).json()
    assert best["score"] == 1.0 and best["recommendations"][0]["kind"] == "advance"

    progress = (await api.get(f"{API}/progress", headers=headers)).json()
    assert progress["quizzes"] == {
        "quizzes": 1,
        "attempts": 2,
        "average_score": 0.5,
        "best_score": 1.0,
    }
    assert [p["score"] for p in progress["scores"]] == [0.0, 1.0]
    assert progress["activity"]["streak_days"] == 1
    assert progress["activity"]["active_days_last_30"] == 1
    # 0 then 1 with a 0.4 weight on the newest: 0.4 for every concept, so all weak.
    assert {c["concept"] for c in progress["weak"]} == {"Basics", "Key terms", "Applications"}
    assert {c["mastery"] for c in progress["weak"]} == {0.4}
    assert progress["strong"] == []
    assert all(c["evidence_count"] == 4 for c in progress["weak"])
    # Weak ideas are due again tomorrow, which is inside the revision window.
    assert len(progress["revision"]) == 3 and not progress["revision"][0]["due"]
    assert progress["weak"][0]["topic"] == "Photosynthesis"

    other = await register_user(api, email="other@example.com")
    theirs = (await api.get(f"{API}/progress", headers=other)).json()
    assert theirs["quizzes"]["quizzes"] == 0 and theirs["weak"] == []
    assert (await api.get(f"{Q}/{quiz['id']}", headers=other)).status_code == 404
    assert (await api.post(url, headers=other, json={"answers": []})).status_code == 404
    assert (await api.get(f"{Q}/attempts/{best['id']}", headers=other)).status_code == 404


async def test_a_lesson_section_check(api, llm):
    headers = await register_user(api)
    lesson = (
        await api.post(f"{API}/tutor/lessons", headers=headers, json={**REQUEST, "language": "hi"})
    ).json()["lesson"]
    quiz = await create(
        api, headers, lesson_id=lesson["id"], section=1, question_count=3, language="hi"
    )
    assert quiz["lesson_id"] == lesson["id"] and quiz["focus"] == "Key vocabulary"
    assert quiz["title"] == "Photosynthesis (mock quiz): Key vocabulary"
    prompt = llm.calls[-1][1]
    assert "Only test this lesson section" in prompt and "Key vocabulary" in prompt
    assert "Language: Hindi" in prompt
    listed = (await api.get(Q, headers=headers, params={"lesson_id": lesson["id"]})).json()
    assert listed["total"] == 1

    missing = await api.post(
        Q, headers=headers, json={**REQUEST, "lesson_id": lesson["id"], "section": 40}
    )
    assert missing.status_code == 404
    no_lesson = await api.post(Q, headers=headers, json={**REQUEST, "section": 0})
    assert no_lesson.status_code == 422
    other = await register_user(api, email="other@example.com")
    resp = await api.post(Q, headers=other, json={**REQUEST, "lesson_id": lesson["id"]})
    assert resp.status_code == 404


async def test_invalid_submissions_and_marking_failures(api, llm):
    headers = await register_user(api)
    quiz = await create(api, headers)
    other = await create(api, headers, topic="Gravity")
    url = f"{Q}/{quiz['id']}/submit"
    foreign = {"question_id": other["questions"][0]["id"], "answer": "x"}
    resp = await api.post(url, headers=headers, json={"answers": [foreign]})
    assert resp.status_code == 422 and resp.json()["code"] == "unknown_question"

    # If the AI marker fails, nothing is saved and the learner can submit again.
    llm.fail_grading = True
    short = next(q for q in quiz["questions"] if q["qtype"] == "short_answer")
    resp = await api.post(
        url, headers=headers, json={"answers": [{"question_id": short["id"], "answer": "maybe"}]}
    )
    assert resp.status_code == 503, resp.text
    assert (await api.get(f"{Q}/{quiz['id']}", headers=headers)).json()["attempts"] == 0
    assert (await api.get(f"{API}/progress", headers=headers)).json()["weak"] == []

    assert (
        await api.post(Q, headers=headers, json={**REQUEST, "question_count": 2})
    ).status_code == 422
    assert (await api.delete(f"{Q}/{quiz['id']}", headers=headers)).status_code == 204
    assert (await api.get(f"{Q}/{quiz['id']}", headers=headers)).status_code == 404


async def test_progress_counts_lessons_and_activity(api, llm):
    headers = await register_user(api)
    body = (await api.get(f"{API}/progress", headers=headers)).json()
    assert body["lessons"] == {"total": 0, "active": 0, "completed": 0, "sections_completed": 0}
    assert body["activity"]["days"] == [] and body["activity"]["streak_days"] == 0
    assert body["activity"]["active_days_last_30"] == 0 and body["activity"]["today"]
    assert body["scores"] == [] and body["revision"] == []

    lesson = (await api.post(f"{API}/tutor/lessons", headers=headers, json=REQUEST)).json()[
        "lesson"
    ]
    resp = await api.patch(
        f"{API}/lessons/{lesson['id']}",
        headers=headers,
        json={"completed_sections": [0, 1], "status": "completed"},
    )
    assert resp.status_code == 200, resp.text
    body = (await api.get(f"{API}/progress", headers=headers)).json()
    assert body["lessons"] == {"total": 1, "active": 0, "completed": 1, "sections_completed": 2}
    # Starting a lesson counts as activity today.
    assert body["activity"]["streak_days"] == 1 and len(body["activity"]["days"]) == 1
