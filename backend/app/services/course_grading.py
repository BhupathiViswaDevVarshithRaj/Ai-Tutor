"""Deterministic marking and spaced-repetition scheduling for language courses.

Exercises are marked by rule, not by a model, so the same answer always gets the same mark.
"""

import unicodedata
from dataclasses import dataclass
from datetime import datetime, timedelta
from difflib import SequenceMatcher

# Speaking: how close the recognised speech must be to the target phrase.
GOOD_MATCH = 0.8
CLOSE_MATCH = 0.5


def normalize(text: str) -> str:
    """Compare answers ignoring case, punctuation, accents' composition and extra spaces."""
    text = unicodedata.normalize("NFKC", text).casefold()
    text = "".join(" " if unicodedata.category(ch).startswith("P") else ch for ch in text)
    return " ".join(text.split())


def is_correct(exercise: dict, answer: str) -> bool:
    given = normalize(answer)
    if not given:
        return False
    if exercise["kind"] == "choice":
        return given == normalize(exercise["answer"])
    return any(given == normalize(alt) for alt in exercise["answer"].split("|") if alt.strip())


def grade_exercises(exercises: list[dict], answers: list[str]) -> tuple[float, list[dict]]:
    """Mark answers in order; a missing answer counts as wrong. Returns (score 0-1, items)."""
    items = []
    for i, exercise in enumerate(exercises):
        given = answers[i] if i < len(answers) else ""
        items.append(
            {
                "given": given,
                "correct": is_correct(exercise, given),
                "expected": exercise["answer"].split("|")[0],
                "explanation": exercise.get("explanation", ""),
            }
        )
    score = sum(item["correct"] for item in items) / len(items) if items else 0.0
    return score, items


def phrase_similarity(target: str, heard: str) -> float:
    """0-1 similarity of what was heard to the target, by characters (works for CJK too)."""
    a, b = normalize(target).replace(" ", ""), normalize(heard).replace(" ", "")
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a, b).ratio()


def grade_speaking(phrases: list[dict], transcripts: list[str]) -> tuple[float, list[dict]]:
    items = []
    for i, phrase in enumerate(phrases):
        heard = transcripts[i] if i < len(transcripts) else ""
        similarity = round(phrase_similarity(phrase["text"], heard), 3)
        verdict = (
            "good"
            if similarity >= GOOD_MATCH
            else "close"
            if similarity >= CLOSE_MATCH
            else "retry"
        )
        items.append({"heard": heard, "similarity": similarity, "verdict": verdict})
    score = sum(item["similarity"] for item in items) / len(items) if items else 0.0
    return round(score, 3), items


# --- spaced repetition (SM-2) --------------------------------------------------------

GRADE_QUALITY = {"again": 1, "hard": 3, "good": 4, "easy": 5}
RELEARN_AFTER = timedelta(minutes=10)


@dataclass
class Schedule:
    ease: float
    interval_days: int
    repetitions: int
    lapses: int
    due_at: datetime


def schedule_review(
    *, ease: float, interval_days: int, repetitions: int, lapses: int, grade: str, now: datetime
) -> Schedule:
    """Next review after answering a card with `grade` (again / hard / good / easy)."""
    quality = GRADE_QUALITY[grade]
    ease = max(1.3, ease + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    if quality < 3:
        # Forgotten: start the card again and show it again shortly.
        return Schedule(ease, 0, 0, lapses + 1, now + RELEARN_AFTER)
    if repetitions == 0:
        interval = 1
    elif repetitions == 1:
        interval = 3 if grade == "hard" else 6
    else:
        factor = 1.2 if grade == "hard" else ease
        interval = max(interval_days + 1, round(interval_days * factor))
    if grade == "easy":
        interval = round(interval * 1.3)
    return Schedule(ease, interval, repetitions + 1, lapses, now + timedelta(days=interval))
