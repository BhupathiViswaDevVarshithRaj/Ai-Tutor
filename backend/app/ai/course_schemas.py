"""Structured outputs for world-language courses, and their post-parse validation.

As with lesson plans (DECISIONS D-036), the schemas are plain Pydantic models without
constraints the structured-output subset may not support; sizes and shapes are enforced
after parsing by the `validate_*` functions, which raise `LLMError` on unusable output.
"""

from typing import Literal

from pydantic import BaseModel

from app.ai.llm.base import LLMError

MAX_EXERCISES = 8


class VocabWord(BaseModel):
    word: str
    reading: str  # romanisation / pronunciation aid; empty for Latin-script languages
    meaning: str  # in English
    example: str  # a short sentence in the course language
    example_translation: str


class VocabList(BaseModel):
    words: list[VocabWord]


class Exercise(BaseModel):
    kind: Literal["choice", "fill"]
    prompt: str
    options: list[str]  # choice: 3-4 options; fill: empty
    answer: str  # choice: the correct option; fill: accepted answers separated by "|"
    explanation: str


class Example(BaseModel):
    text: str
    translation: str


class GrammarLesson(BaseModel):
    title: str
    explanation: str
    examples: list[Example]
    exercises: list[Exercise]


class Passage(BaseModel):
    """A text to read, or a script to listen to, with comprehension questions."""

    title: str
    text: str
    translation: str
    questions: list[Exercise]


class WritingTask(BaseModel):
    title: str
    instructions: str
    min_words: int
    max_words: int
    useful_phrases: list[Example]


class Correction(BaseModel):
    original: str
    corrected: str
    explanation: str


class WritingFeedback(BaseModel):
    corrected_text: str
    corrections: list[Correction]
    strengths: list[str]
    score: int  # 0-100
    summary: str


class Phrase(BaseModel):
    text: str
    reading: str
    translation: str


class SpeakingSet(BaseModel):
    title: str
    phrases: list[Phrase]


def _clean(text: str, limit: int) -> str:
    return " ".join(text.split())[:limit]


def _exercises(items: list[Exercise], what: str) -> list[Exercise]:
    usable = []
    for ex in items[:MAX_EXERCISES]:
        prompt, answer = _clean(ex.prompt, 500), _clean(ex.answer, 200)
        if not prompt or not answer:
            continue
        options = [_clean(o, 200) for o in ex.options if o.strip()][:5]
        if ex.kind == "choice":
            # The answer must be one of the options, and options must be distinct.
            if answer not in options or len(set(options)) < 2:
                continue
            options = list(dict.fromkeys(options))
        else:
            options = []
        usable.append(
            Exercise(
                kind=ex.kind,
                prompt=prompt,
                options=options,
                answer=answer,
                explanation=_clean(ex.explanation, 500),
            )
        )
    if len(usable) < 2:
        raise LLMError(f"The {what} couldn't be prepared. Please try again.")
    return usable


def validate_vocab(value: VocabList) -> VocabList:
    words, seen = [], set()
    for w in value.words[:15]:
        word = _clean(w.word, 200)
        if not word or not w.meaning.strip() or word.casefold() in seen:
            continue
        seen.add(word.casefold())
        words.append(
            VocabWord(
                word=word,
                reading=_clean(w.reading, 200),
                meaning=_clean(w.meaning, 300),
                example=_clean(w.example, 400),
                example_translation=_clean(w.example_translation, 400),
            )
        )
    if not words:
        raise LLMError("No words could be prepared. Please try again.")
    return VocabList(words=words)


def validate_grammar(value: GrammarLesson) -> GrammarLesson:
    if not value.explanation.strip():
        raise LLMError("The grammar lesson couldn't be prepared. Please try again.")
    return GrammarLesson(
        title=_clean(value.title, 200) or "Grammar",
        explanation=value.explanation.strip()[:4000],
        examples=[
            Example(text=_clean(e.text, 300), translation=_clean(e.translation, 300))
            for e in value.examples[:6]
            if e.text.strip()
        ],
        exercises=_exercises(value.exercises, "exercises"),
    )


def validate_passage(value: Passage) -> Passage:
    if len(value.text.strip()) < 20:
        raise LLMError("The text couldn't be prepared. Please try again.")
    return Passage(
        title=_clean(value.title, 200) or "Practice",
        text=value.text.strip()[:4000],
        translation=value.translation.strip()[:4000],
        questions=_exercises(value.questions, "questions"),
    )


def validate_writing_task(value: WritingTask) -> WritingTask:
    if not value.instructions.strip():
        raise LLMError("The writing task couldn't be prepared. Please try again.")
    low = min(max(value.min_words, 10), 300)
    return WritingTask(
        title=_clean(value.title, 200) or "Writing",
        instructions=value.instructions.strip()[:1500],
        min_words=low,
        max_words=min(max(value.max_words, low + 10), 400),
        useful_phrases=[
            Example(text=_clean(p.text, 200), translation=_clean(p.translation, 200))
            for p in value.useful_phrases[:8]
            if p.text.strip()
        ],
    )


def validate_feedback(value: WritingFeedback) -> WritingFeedback:
    return WritingFeedback(
        corrected_text=value.corrected_text.strip()[:6000],
        corrections=[
            Correction(
                original=_clean(c.original, 300),
                corrected=_clean(c.corrected, 300),
                explanation=_clean(c.explanation, 500),
            )
            for c in value.corrections[:20]
            if c.original.strip() or c.corrected.strip()
        ],
        strengths=[_clean(s, 300) for s in value.strengths[:5] if s.strip()],
        score=min(max(value.score, 0), 100),
        summary=_clean(value.summary, 800),
    )


def validate_speaking(value: SpeakingSet) -> SpeakingSet:
    phrases = [
        Phrase(
            text=_clean(p.text, 200),
            reading=_clean(p.reading, 200),
            translation=_clean(p.translation, 200),
        )
        for p in value.phrases[:8]
        if p.text.strip()
    ]
    if len(phrases) < 2:
        raise LLMError("The speaking practice couldn't be prepared. Please try again.")
    return SpeakingSet(title=_clean(value.title, 200) or "Speaking", phrases=phrases)
