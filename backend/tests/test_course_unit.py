"""Unit tests for course marking, spaced repetition, content validation and prompts."""

from datetime import UTC, date, datetime, timedelta

import pytest

from app.ai.course_prompts import roleplay_system_prompt, vocab_request
from app.ai.course_schemas import (
    Exercise,
    GrammarLesson,
    VocabList,
    VocabWord,
    WritingFeedback,
    validate_feedback,
    validate_grammar,
    validate_vocab,
)
from app.ai.llm.base import LLMError
from app.db.enums import CefrLevel
from app.services.course_grading import (
    grade_exercises,
    grade_speaking,
    is_correct,
    normalize,
    phrase_similarity,
    schedule_review,
)
from app.services.language_service import streak

NOW = datetime(2026, 11, 3, 12, tzinfo=UTC)


# --- marking -----------------------------------------------------------------------


def test_normalize_ignores_case_punctuation_and_spacing():
    assert normalize("  ¿Dónde   está?  ") == "dónde está"
    assert normalize("Ｈｅｌｌｏ!") == "hello"  # full-width forms fold to ASCII
    assert normalize("こんにちは。") == "こんにちは"


def test_fill_accepts_listed_alternatives():
    exercise = {"kind": "fill", "answer": "am|'m"}
    assert is_correct(exercise, "AM")
    assert is_correct(exercise, "'m")
    assert not is_correct(exercise, "is")
    assert not is_correct(exercise, "  ")


def test_choice_needs_the_exact_option():
    exercise = {"kind": "choice", "answer": "le livre"}
    assert is_correct(exercise, "Le livre.")
    assert not is_correct(exercise, "la livre")


def test_grade_exercises_counts_missing_answers_as_wrong():
    exercises = [
        {"kind": "choice", "answer": "a", "explanation": "because"},
        {"kind": "fill", "answer": "x|y", "explanation": ""},
        {"kind": "choice", "answer": "c", "explanation": ""},
    ]
    score, items = grade_exercises(exercises, ["a", "y"])
    assert score == pytest.approx(2 / 3)
    assert [i["correct"] for i in items] == [True, True, False]
    assert items[1]["expected"] == "x" and items[0]["explanation"] == "because"


def test_speaking_similarity_works_for_cjk_and_latin():
    assert phrase_similarity("你好", "你好") == 1.0
    assert phrase_similarity("Guten Morgen", "guten morgen!") == 1.0
    assert 0.5 < phrase_similarity("Ich heiße Anna", "Ich heise Ana") < 1
    assert phrase_similarity("Bonjour", "") == 0.0
    score, items = grade_speaking([{"text": "Hola"}, {"text": "Gracias"}], ["hola", "xyz"])
    assert [i["verdict"] for i in items] == ["good", "retry"]
    assert score == pytest.approx(0.5)


# --- spaced repetition -------------------------------------------------------------


def review(grade, **state):
    base = {"ease": 2.5, "interval_days": 0, "repetitions": 0, "lapses": 0}
    return schedule_review(**{**base, **state}, grade=grade, now=NOW)


def test_new_card_good_is_due_tomorrow_then_in_six_days():
    first = review("good")
    assert (first.interval_days, first.repetitions, first.due_at) == (1, 1, NOW + timedelta(days=1))
    second = review("good", interval_days=1, repetitions=1, ease=first.ease)
    assert second.interval_days == 6


def test_intervals_grow_with_ease_and_easy_gets_a_bonus():
    good = review("good", interval_days=6, repetitions=2)
    easy = review("easy", interval_days=6, repetitions=2)
    hard = review("hard", interval_days=6, repetitions=2)
    assert hard.interval_days < good.interval_days < easy.interval_days
    assert good.interval_days == 15  # 6 x 2.5


def test_forgotten_card_restarts_soon_and_counts_a_lapse():
    lapsed = review("again", interval_days=30, repetitions=5)
    assert (lapsed.interval_days, lapsed.repetitions, lapsed.lapses) == (0, 0, 1)
    assert lapsed.due_at == NOW + timedelta(minutes=10)
    assert lapsed.ease < 2.5


def test_ease_never_drops_below_the_floor():
    state = {"ease": 1.3}
    for _ in range(5):
        state["ease"] = review("again", **state).ease
    assert state["ease"] == 1.3


def test_streak_counts_back_from_today_or_yesterday():
    today = date(2026, 11, 3)
    days = {today - timedelta(days=n) for n in (1, 2, 3, 5)}
    assert streak(days, today) == 3  # yesterday and the two days before
    assert streak(days | {today}, today) == 4
    assert streak(set(), today) == 0


# --- validation of generated content ------------------------------------------------


def exercise(kind="choice", answer="b", options=("a", "b", "c"), prompt="Pick one"):
    return Exercise(kind=kind, prompt=prompt, options=list(options), answer=answer, explanation="")


def test_grammar_validation_drops_broken_exercises():
    lesson = GrammarLesson(
        title="Articles",
        explanation="Use der, die, das.",
        examples=[],
        exercises=[
            exercise(),
            exercise(answer="z"),  # answer not among the options
            exercise(options=("b", "b")),  # no real choice
            exercise(kind="fill", answer="der", options=("ignored",)),
            exercise(prompt="   "),
        ],
    )
    kept = validate_grammar(lesson).exercises
    assert [(e.kind, e.answer, e.options) for e in kept] == [
        ("choice", "b", ["a", "b", "c"]),
        ("fill", "der", []),
    ]


def test_grammar_with_too_few_usable_exercises_is_rejected():
    lesson = GrammarLesson(title="", explanation="x", examples=[], exercises=[exercise()])
    with pytest.raises(LLMError):
        validate_grammar(lesson)


def test_vocab_validation_dedupes_and_requires_meanings():
    words = [
        VocabWord(word="Hallo", reading="", meaning="hello", example="", example_translation=""),
        VocabWord(word="hallo", reading="", meaning="dup", example="", example_translation=""),
        VocabWord(word="leer", reading="", meaning="  ", example="", example_translation=""),
    ]
    assert [w.word for w in validate_vocab(VocabList(words=words)).words] == ["Hallo"]
    with pytest.raises(LLMError):
        validate_vocab(VocabList(words=[]))


def test_feedback_score_is_clamped():
    fb = WritingFeedback(corrected_text="x", corrections=[], strengths=[], score=140, summary="s")
    assert validate_feedback(fb).score == 100


# --- prompts ---------------------------------------------------------------------------


def test_vocab_request_lists_known_words_and_asks_for_readings_where_needed():
    request = vocab_request("ja", CefrLevel.A1, "food", ["寿司"])
    assert "Japanese" in request and "A1" in request and "寿司" in request and "romaji" in request
    assert "reading` field empty" in vocab_request("de", CefrLevel.B2, None, [])


def test_roleplay_prompt_stays_in_the_target_language_and_level():
    prompt = roleplay_system_prompt(
        language="fr", level=CefrLevel.A2, scenario="At a café", interests=[], spoken=True
    )
    assert "French" in prompt and "At a café" in prompt and "A2" in prompt
    assert "Tip:" in prompt and "plain sentences" in prompt
    assert "pinyin" in roleplay_system_prompt(
        language="zh", level=CefrLevel.A1, scenario="x", interests=[], spoken=False
    )


# --- language checks used by the evaluation set ------------------------------------

SAMPLES = {
    "en": "Plants make food from sunlight. What do they need?",
    "hi": "पौधे सूर्य के प्रकाश से अपना भोजन बनाते हैं। उन्हें क्या चाहिए?",
    "te": "మొక్కలు సూర్యకాంతి నుండి ఆహారాన్ని తయారు చేస్తాయి.",
    "ta": "தாவரங்கள் சூரிய ஒளியில் இருந்து உணவை உருவாக்குகின்றன.",
    "pa": "ਪੌਦੇ ਧੁੱਪ ਤੋਂ ਆਪਣਾ ਭੋਜਨ ਬਣਾਉਂਦੇ ਹਨ।",
    "bn": "গাছ সূর্যের আলো থেকে খাদ্য তৈরি করে।",
    "de": "Ich möchte einen Kaffee, bitte. Was ist das?",
    "fr": "Je voudrais un café, s'il vous plaît. Où est la gare ?",
    "es": "Yo quiero un café, por favor. ¿Dónde está la estación?",
    "it": "Io vorrei un caffè, per favore. Dove è la stazione?",
    "pt": "Eu quero um café, por favor. Onde é a estação?",
    "ja": "こんにちは、私は学生です。よろしくお願いします。",
    "ko": "안녕하세요, 저는 학생입니다.",
    "zh": "你好，我想买一些水果。",
}


@pytest.mark.parametrize("language", list(SAMPLES))
def test_script_check_recognises_each_language(language):
    from app.ai.script_check import FUNCTION_WORDS, function_word_lead, script_share

    assert script_share(SAMPLES[language], language) >= 0.9
    if language in FUNCTION_WORDS and language != "en":
        assert function_word_lead(SAMPLES[language], language) > 0
        assert function_word_lead(SAMPLES["en"], language) < 0


def test_script_check_spots_the_wrong_language():
    from app.ai.script_check import script_share

    assert script_share(SAMPLES["en"], "hi") == 0
    assert script_share(SAMPLES["hi"] + " (photosynthesis)", "hi") > 0.6  # English term allowed
    assert script_share(SAMPLES["zh"], "ko") == 0
    assert script_share("", "ta") == 0
