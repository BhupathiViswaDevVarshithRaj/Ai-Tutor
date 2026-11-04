"""Quiz repair, rule marking, mastery maths and recommendations (no database)."""

from datetime import UTC, datetime, timedelta

import pytest

from app.ai.llm.base import LLMError
from app.ai.quiz import (
    QuestionDraft,
    QuizDraft,
    next_review,
    recommendations,
    rule_mark,
    snap_score,
    updated_mastery,
    validate_quiz,
)
from app.db.enums import LearningLevel


def mcq(prompt="Q?", options=("A", "B", "C"), answer="A", **extra) -> QuestionDraft:
    base = dict(
        qtype="mcq",
        prompt=prompt,
        options=list(options),
        answer=answer,
        accepted_answers=[],
        explanation="Because.",
        concept="Basics",
        difficulty=2,
    )
    return QuestionDraft(**{**base, **extra})


def short(prompt="Name it?", answer="chlorophyll", **extra) -> QuestionDraft:
    return mcq(prompt=prompt, answer=answer, **{"options": (), "qtype": "short_answer", **extra})


def test_unusable_questions_are_dropped_and_good_ones_repaired():
    draft = QuizDraft(
        title="  Plants  ",
        questions=[
            mcq("Which is green?", ["Leaf", "leaf ", "Root", "Stem"], "LEAF", difficulty=9),
            mcq("Answer not offered?", ["A", "B"], "C"),
            mcq("Only one option?", ["A", "a"], "A"),
            mcq("", ["A", "B"], "A"),
            mcq("which is green?", ["Leaf", "Root"], "Leaf"),  # repeat of the first
            short("What pigment?", "chlorophyll", options=["ignored"], concept=""),
            short("Empty answer?", "  "),
            mcq("What do roots take up?", ["Water", "Light"], "Water"),
        ],
    )
    quiz = validate_quiz(draft, topic="Photosynthesis", count=4, types="mixed")
    assert quiz.title == "Plants"
    assert [q.prompt for q in quiz.questions] == [
        "Which is green?",
        "What pigment?",
        "What do roots take up?",
    ]
    first = quiz.questions[0]
    assert sorted(first.options) == ["Leaf", "Root", "Stem"]  # duplicates removed
    assert first.answer == "Leaf" and first.difficulty == 3
    assert quiz.questions[1].options == [] and quiz.questions[1].concept == "Photosynthesis"


def test_question_types_and_count_are_respected():
    draft = QuizDraft(
        title="T", questions=[mcq(f"M{i}?") for i in range(4)] + [short(f"S{i}?") for i in range(4)]
    )
    only_short = validate_quiz(draft, topic="t", count=3, types="short_answer")
    assert [q.qtype for q in only_short.questions] == ["short_answer"] * 3
    assert len(validate_quiz(draft, topic="t", count=5, types="mixed").questions) == 5


def test_a_quiz_with_too_few_usable_questions_fails():
    draft = QuizDraft(title="T", questions=[mcq("A?"), mcq("B?"), mcq("C?"), mcq("D?", answer="Z")])
    with pytest.raises(LLMError):
        validate_quiz(draft, topic="t", count=10, types="mixed")
    # Half of a 6-question quiz is enough.
    assert len(validate_quiz(draft, topic="t", count=6, types="mixed").questions) == 3


def test_rule_marking():
    assert rule_mark("mcq", " leaf ", "Leaf", []) == 1.0
    assert rule_mark("mcq", "Root", "Leaf", []) == 0.0
    assert rule_mark("short_answer", "", "chlorophyll", []) == 0.0
    assert rule_mark("short_answer", "Chlorophyll.", "chlorophyll", []) == 1.0
    assert rule_mark("short_answer", "chlorophyl a", "chlorophyll", ["chlorophyll a"]) is None
    assert rule_mark("short_answer", "Chlorophyll A", "chlorophyll", ["chlorophyll a"]) == 1.0
    assert [snap_score(s) for s in (-1, 0.2, 0.3, 0.6, 0.8, 7)] == [0, 0, 0.5, 0.5, 1, 1]


def test_mastery_is_a_moving_average_with_review_dates():
    assert updated_mastery(None, 0.5) == 0.5
    assert updated_mastery(0.5, 1.0) == 0.7
    assert updated_mastery(1.0, 0.0) == 0.6
    now = datetime(2026, 11, 4, tzinfo=UTC)
    assert next_review(0.2, 3, now) == now + timedelta(days=1)
    assert next_review(0.6, 3, now) == now + timedelta(days=3)
    assert next_review(0.9, 3, now) == now + timedelta(days=7)
    assert next_review(0.9, 10, now) == now + timedelta(days=14)


def test_recommendations():
    concepts = [
        {"concept": "Light", "correct": 0, "total": 2, "score": 0.0},
        {"concept": "Water", "correct": 1, "total": 2, "score": 0.5},
        {"concept": "Sugar", "correct": 0.5, "total": 2, "score": 0.25},
    ]
    recs = recommendations(concepts, 0.25, topic="Plants", level=LearningLevel.BEGINNER)
    assert [r["concept"] for r in recs] == ["Light", "Sugar"]
    assert recs[0]["lesson_topic"] == "Light (Plants)"
    assert "0 of 2" in recs[0]["text"]

    strong = [{"concept": "Light", "correct": 2, "total": 2, "score": 1.0}]
    up = recommendations(strong, 1.0, topic="Plants", level=LearningLevel.BEGINNER)
    assert up == [
        {
            "kind": "advance",
            "concept": None,
            "text": "Strong result. Next, try Plants at intermediate level.",
            "level": "intermediate",
        }
    ]
    top = recommendations(strong, 1.0, topic="Plants", level=LearningLevel.ADVANCED)
    assert "level" not in top[0]
    middling = [{"concept": "Light", "correct": 1.5, "total": 2, "score": 0.75}]
    assert (
        recommendations(middling, 0.75, topic="P", level=LearningLevel.BEGINNER)[0]["kind"]
        == "retake"
    )
