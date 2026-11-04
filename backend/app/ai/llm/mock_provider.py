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
from app.ai.diagram import Connector, DiagramSpec, Element, PlotFunction, PlotPoint, Step
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
from app.ai.mindmap import Branch, BranchNode, MapLink, MapNode, MindMapGraph
from app.ai.quiz import AnswerGrade, AnswerGrades, QuestionDraft, QuizDraft
from app.ai.schemas import LessonPlan, LessonSummary, PlanModule, PlanSection
from app.video.script import Scene, VideoScript

MOCK_MODEL = "mock-tutor"
MOCK_NOTICE = "*(Mock AI: add a GROQ_API_KEY or ANTHROPIC_API_KEY to get real tutor replies.)*"


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
                    "Add a GROQ_API_KEY or ANTHROPIC_API_KEY for a real, personalised plan."
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
                next_steps=["Add a GROQ_API_KEY or ANTHROPIC_API_KEY to get real summaries."],
            )
        elif schema is VideoScript:
            value = _mock_video(topic)
        elif schema is QuizDraft:
            value = _mock_quiz(
                topic, int(_field(prompt, "Questions", "5")), _field(prompt, "Types", "mixed")
            )
        elif schema is AnswerGrades:
            value = _mock_grades(prompt)
        elif schema is DiagramSpec:
            value = _mock_diagram(topic, _field(prompt, "Diagram type", "your choice"))
        elif schema is MindMapGraph:
            value = _mock_mind_map(topic)
        elif schema is Branch:
            # Number new nodes after the existing ones so repeated expansions add new ideas.
            start = prompt.count("\n- ") + 1
            value = Branch(
                nodes=[
                    BranchNode(
                        label=f"[mock] idea {start + i}", kind="concept", detail="Mock detail."
                    )
                    for i in range(3)
                ]
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
            summary="Mock feedback. Add a GROQ_API_KEY or ANTHROPIC_API_KEY for real corrections.",
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


def _mock_mind_map(topic: str) -> MindMapGraph:
    """A small, clearly labelled map: the topic, three main ideas, and a few leaves."""
    nodes = [MapNode(id="root", parent="", label=topic, kind="topic", detail="Mock central topic.")]
    leaf_kinds = ("concept", "example", "definition")
    for i in range(1, 4):
        nodes.append(
            MapNode(
                id=f"i{i}", parent="root", label=f"[mock] Main idea {i}", kind="idea", detail=""
            )
        )
        for j, kind in enumerate(leaf_kinds[: 2 if i < 3 else 3], start=1):
            nodes.append(
                MapNode(
                    id=f"i{i}-{j}",
                    parent=f"i{i}",
                    label=f"[mock] {kind} {i}.{j}",
                    kind=kind,
                    detail=f"Mock {kind}. Add a GROQ_API_KEY or ANTHROPIC_API_KEY for a real map.",
                )
            )
    return MindMapGraph(
        title=f"{topic} (mock map)",
        nodes=nodes,
        links=[MapLink(source="i1-1", target="i2-1", relation="related to")],
    )


def _mock_diagram(topic: str, requested: str) -> DiagramSpec:
    """A labelled example of the requested type (a flowchart when the model would choose)."""
    kind = (
        requested
        if requested in ("flowchart", "block", "timeline", "graph_fn", "process")
        else "flowchart"
    )
    empty = {
        "functions": [],
        "points": [],
        "x_min": 0.0,
        "x_max": 1.0,
        "x_label": "",
        "y_label": "",
    }
    title = f"{topic} (mock diagram)"

    def el(id_: str, label: str, kind_: str = "box", tag: str = "") -> Element:
        return Element(id=id_, kind=kind_, label=label, tag=tag, detail=f"Mock detail for {label}.")

    if kind == "graph_fn":
        return DiagramSpec(
            title=title,
            diagram_type="graph_fn",
            elements=[],
            connectors=[],
            functions=[PlotFunction(id="f", expression="x^2 - 4", label="y = x² − 4")],
            points=[
                PlotPoint(id="r1", x=-2, y=0, label="root x = −2"),
                PlotPoint(id="r2", x=2, y=0, label="root x = 2"),
                PlotPoint(id="v", x=0, y=-4, label="vertex"),
            ],
            x_min=-4,
            x_max=4,
            x_label="x",
            y_label="y",
            steps=[
                Step(
                    title="[mock] The curve", explanation="A parabola opening upwards.", show=["f"]
                ),
                Step(
                    title="[mock] Roots",
                    explanation="It crosses the x-axis twice.",
                    show=["r1", "r2"],
                ),
                Step(title="[mock] Vertex", explanation="The lowest point.", show=["v"]),
            ],
        )
    if kind == "timeline":
        events = [
            el(f"e{i}", f"[mock] Event {i}", "event", tag=str(1900 + 25 * i)) for i in range(1, 5)
        ]
        return DiagramSpec(
            title=title,
            diagram_type="timeline",
            elements=events,
            connectors=[],
            steps=[
                Step(title="[mock] Early", explanation="The first events.", show=["e1", "e2"]),
                Step(title="[mock] Later", explanation="What followed.", show=["e3", "e4"]),
            ],
            **empty,
        )
    if kind == "process":
        stages = [el(f"s{i}", f"[mock] Stage {i}") for i in range(1, 5)]
        links = [
            Connector(id=f"l{i}", source=f"s{i}", target=f"s{i % 4 + 1}", label="")
            for i in range(1, 5)
        ]
        return DiagramSpec(
            title=title,
            diagram_type="process",
            elements=stages,
            connectors=links,
            steps=[
                Step(
                    title="[mock] Start the cycle",
                    explanation="The first two stages.",
                    show=["s1", "l1", "s2"],
                ),
                Step(
                    title="[mock] Complete it",
                    explanation="Round and back again.",
                    show=["l2", "s3", "l3", "s4", "l4"],
                ),
            ],
            **empty,
        )
    elements = [
        el("start", "[mock] Start", "start_end"),
        el("a", "[mock] Do the first thing"),
        el("q", "[mock] Did it work?", "decision"),
        el("b", "[mock] Try again"),
        el("end", "[mock] Done", "start_end"),
    ]
    connectors = [
        Connector(id="c1", source="start", target="a", label=""),
        Connector(id="c2", source="a", target="q", label=""),
        Connector(id="c3", source="q", target="end", label="yes"),
        Connector(id="c4", source="q", target="b", label="no"),
        Connector(id="c5", source="b", target="a", label=""),
    ]
    return DiagramSpec(
        title=title,
        diagram_type="block" if kind == "block" else "flowchart",
        elements=elements,
        connectors=connectors,
        steps=[
            Step(
                title="[mock] Begin",
                explanation="Start and do the first thing.",
                show=["start", "c1", "a"],
            ),
            Step(title="[mock] Check", explanation="Ask whether it worked.", show=["c2", "q"]),
            Step(
                title="[mock] Finish or retry",
                explanation="Yes ends; no loops back.",
                show=["c3", "end", "c4", "b", "c5"],
            ),
        ],
        **empty,
    )


def _mock_video(topic: str) -> VideoScript:
    """A short, clearly labelled script using five of the templates, one of them 3D."""

    def scene(template, heading, narration, items=(), caption="", shape=""):
        return Scene(
            template=template,
            heading=heading,
            items=list(items),
            dates=[],
            expression="",
            x_min=0,
            x_max=1,
            shape=shape,
            atoms=[],
            image_query="",
            caption=caption,
            narration=narration,
        )

    return VideoScript(
        title=f"{topic} (mock video)",
        scenes=[
            scene(
                "title",
                f"{topic} (mock video)",
                f"This is a mock video about {topic}.",
                caption="Made without an AI model",
            ),
            scene(
                "bullets",
                "[mock] Three key ideas",
                "A real video would explain the main ideas here, one at a time.",
                items=["[mock] First idea", "[mock] Second idea", "[mock] Third idea"],
            ),
            scene(
                "flow",
                "[mock] How it works",
                "Then it would walk through the process step by step.",
                items=["[mock] Step one", "[mock] Step two", "[mock] Step three"],
            ),
            scene(
                "model3d",
                "[mock] In 3D",
                "A real video would turn a model like this to show its shape from every side.",
                items=["[mock] Turns slowly", "[mock] Labelled"],
                shape="cube",
            ),
            scene(
                "summary",
                "[mock] Summary",
                "Add a Groq or Anthropic API key to get real scripts.",
                items=["[mock] Recap one", "[mock] Recap two"],
            ),
        ],
    )


MOCK_CONCEPTS = ("Basics", "Key terms", "Applications")


def _mock_quiz(topic: str, count: int, types: str) -> QuizDraft:
    """Right answers are 'Right answer n' / 'idea n', so tests and demos can answer them."""
    questions = []
    for i in range(1, count + 1):
        concept = MOCK_CONCEPTS[(i - 1) % len(MOCK_CONCEPTS)]
        short = types.startswith("short_answer") or (types.startswith("a mix") and i % 3 == 0)
        if short:
            questions.append(
                QuestionDraft(
                    qtype="short_answer",
                    prompt=f"[mock] In a few words, what is idea {i} of {topic}?",
                    options=[],
                    answer=f"idea {i}",
                    accepted_answers=[f"idea number {i}"],
                    explanation=f"Mock explanation: the answer is idea {i}.",
                    concept=concept,
                    difficulty=1 + i % 3,
                )
            )
        else:
            questions.append(
                QuestionDraft(
                    qtype="mcq",
                    prompt=f"[mock] Which statement about {topic} is true? (question {i})",
                    options=[f"Right answer {i}", "A wrong answer", "Another wrong answer"],
                    answer=f"Right answer {i}",
                    accepted_answers=[],
                    explanation=f"Mock explanation: 'Right answer {i}' is the right option.",
                    concept=concept,
                    difficulty=1 + i % 3,
                )
            )
    return QuizDraft(title=f"{topic} (mock quiz)", questions=questions)


def _mock_grades(prompt: str) -> AnswerGrades:
    """Marks by shared words with the model answer; clearly not real marking."""
    grades = []
    pattern = r"Item (\d+)\nQuestion: .*?\nModel answer: (.*?)\n<answer>(.*?)</answer>"
    for index, expected, given in re.findall(pattern, prompt, flags=re.DOTALL):
        want = set(re.findall(r"\w+", expected.lower()))
        got = set(re.findall(r"\w+", given.lower()))
        overlap = len(want & got) / len(want) if want else 0.0
        score = 1 if overlap >= 0.6 else 0.5 if overlap >= 0.3 else 0
        grades.append(
            AnswerGrade(
                index=int(index),
                score=score,
                feedback="[mock] Marked by shared words with the model answer; "
                "add a GROQ_API_KEY or ANTHROPIC_API_KEY for real marking.",
            )
        )
    return AnswerGrades(grades=grades)
