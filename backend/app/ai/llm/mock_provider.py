"""Deterministic stand-in for development and tests. Every output says it is a mock."""

import asyncio
import re
from collections.abc import AsyncIterator

from app.ai.course_schemas import (
    Example,
    Exercise,
    GrammarLesson,
    Passage,
    Phrase,
    SpeakingSet,
    VocabList,
    VocabWord,
    WritingFeedback,
    WritingTask,
)
from app.ai.llm.base import (
    ChatMessage,
    LLMError,
    ModelRole,
    ParseResult,
    StreamDone,
    StreamEvent,
    T,
    TextDelta,
    Usage,
)
from app.ai.schemas import LessonPlan, LessonSummary, PlanModule, PlanSection

MOCK_MODEL = "mock-tutor"
MOCK_NOTICE = "*(Mock AI: add an ANTHROPIC_API_KEY to get real tutor replies.)*"


def _field(text: str, name: str, default: str) -> str:
    match = re.search(rf"^{name}:\s*(.+)$", text, flags=re.MULTILINE)
    return match.group(1).strip() if match else default


def _system_field(system: str, name: str, default: str) -> str:
    return _field(system, name, default)


class MockLLMProvider:
    name = "mock"
    is_mock = True

    def __init__(self, delay_seconds: float = 0.0) -> None:
        self.delay_seconds = delay_seconds

    def model_for(self, role: ModelRole) -> str:
        return MOCK_MODEL

    async def stream_chat(
        self, *, system: str, messages: list[ChatMessage], role: ModelRole = "tutor"
    ) -> AsyncIterator[StreamEvent]:
        if not messages or messages[-1].role != "user":
            raise LLMError("Nothing to reply to.", retryable=False)
        question = messages[-1].content.strip()
        topic = _system_field(system, "Topic", "this topic")
        turn = sum(1 for m in messages if m.role == "user")
        reply = (
            f"{MOCK_NOTICE}\n\n"
            f"You asked: **{question[:200]}**\n\n"
            f"This is turn {turn} of our lesson on **{topic}**. A real tutor reply would "
            "explain the idea step by step at your level, give an example, and finish with a "
            "quick question to check your understanding.\n\n"
            "**Quick check:** can you say the main idea in your own words?"
        )
        for word in re.findall(r"\S+\s*", reply):
            if self.delay_seconds:
                await asyncio.sleep(self.delay_seconds)
            yield TextDelta(word)
        yield StreamDone(
            model=MOCK_MODEL,
            usage=Usage(input_tokens=0, output_tokens=0),
            stop_reason="end_turn",
        )

    async def parse(
        self,
        *,
        system: str,
        messages: list[ChatMessage],
        schema: type[T],
        role: ModelRole = "structured",
    ) -> ParseResult[T]:
        prompt = messages[-1].content if messages else ""
        topic = _field(prompt, "Topic", "Your topic")
        if schema is LessonPlan:
            value = LessonPlan(
                title=f"{topic} (mock plan)",
                overview=(
                    f"A sample plan for {topic}, generated without an AI model. "
                    "Add an ANTHROPIC_API_KEY for a real, personalised plan."
                ),
                prerequisites=[],
                modules=[
                    PlanModule(
                        title=f"Foundations of {topic}",
                        summary="The core ideas and vocabulary.",
                        sections=[
                            PlanSection(
                                title=f"What is {topic}?",
                                objectives=[f"Describe {topic} in your own words"],
                                key_terms=["definition"],
                            ),
                            PlanSection(
                                title="Key vocabulary",
                                objectives=["Recognise the main terms"],
                                key_terms=["term", "concept"],
                            ),
                        ],
                    ),
                    PlanModule(
                        title=f"Applying {topic}",
                        summary="Worked examples and practice.",
                        sections=[
                            PlanSection(
                                title="A worked example",
                                objectives=["Follow an example step by step"],
                                key_terms=["example"],
                            ),
                        ],
                    ),
                ],
            )
        elif schema is LessonSummary:
            turns = prompt.count("\nLearner:") + prompt.startswith("Learner:")
            value = LessonSummary(
                summary=f"Mock summary of a session on {topic} with {turns} learner message(s).",
                key_points=[f"You started learning {topic}."],
                next_steps=["Add an ANTHROPIC_API_KEY to get real summaries."],
            )
        elif (course := _mock_course_content(schema, prompt, topic)) is not None:
            value = course
        else:
            raise LLMError("The mock provider can't produce this output.", retryable=False)
        return ParseResult(value=value, model=MOCK_MODEL)  # type: ignore[arg-type]


def _mock_choice(n: int) -> Exercise:
    return Exercise(
        kind="choice",
        prompt=f"[mock] Question {n}: which option is correct?",
        options=["correct", "wrong", "also wrong"],
        answer="correct",
        explanation="Mock exercise: the right option is always 'correct'.",
    )


def _mock_course_content(schema: type, prompt: str, topic: str):
    """Placeholder course material, clearly marked as mock, for keyless development."""
    if topic.startswith("your choice"):  # no topic given: the prompt's placeholder text
        topic = "everyday life"
    if schema is VocabList:
        # Number new words after the known ones so repeated requests add new cards.
        known = _field(prompt, "Already known", "")
        start = 0 if known in ("", "(none yet)") else len(known.split(", "))
        return VocabList(
            words=[
                VocabWord(
                    word=f"[mock] word {start + i}",
                    reading="",
                    meaning=f"mock meaning {start + i}",
                    example=f"[mock] An example with word {start + i}.",
                    example_translation="Mock example translation.",
                )
                for i in range(1, 9)
            ]
        )
    if schema is GrammarLesson:
        return GrammarLesson(
            title="[mock] A grammar point",
            explanation=f"{MOCK_NOTICE}\n\nA real lesson would explain one grammar point.",
            examples=[Example(text="[mock] Example sentence.", translation="Mock translation.")],
            exercises=[
                _mock_choice(1),
                Exercise(
                    kind="fill",
                    prompt="[mock] Fill the gap: I ___ a student.",
                    options=[],
                    answer="am|'m",
                    explanation="Mock exercise: 'am' (or 'm) fills the gap.",
                ),
                _mock_choice(2),
            ],
        )
    if schema is Passage:
        return Passage(
            title=f"[mock] {topic}",
            text="[mock] Anna: Hello! Ben: Hi Anna, how are you? Anna: Very well, thank you.",
            translation="Mock translation of the text.",
            questions=[_mock_choice(1), _mock_choice(2)],
        )
    if schema is WritingTask:
        return WritingTask(
            title="[mock] Write a short message",
            instructions="Mock task: write a few sentences about your day.",
            min_words=20,
            max_words=60,
            useful_phrases=[Example(text="[mock] phrase", translation="mock phrase")],
        )
    if schema is WritingFeedback:
        text = prompt.split("Learner's text:\n", 1)[-1].strip()
        return WritingFeedback(
            corrected_text=text,
            corrections=[],
            strengths=["Mock feedback: you submitted some text."],
            score=50,
            summary="Mock feedback. Add an ANTHROPIC_API_KEY for real corrections.",
        )
    if schema is SpeakingSet:
        return SpeakingSet(
            title=f"[mock] {topic}",
            phrases=[
                Phrase(text=f"[mock] phrase {i}", reading="", translation=f"mock phrase {i}")
                for i in range(1, 4)
            ],
        )
    return None
