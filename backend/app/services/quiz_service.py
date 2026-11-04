"""Quizzes: generation, marking, feedback, and the mastery each attempt updates."""

import logging
import uuid
from collections import defaultdict
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.llm.base import ChatMessage, LLMError, LLMProvider
from app.ai.prompts import language_name
from app.ai.quiz import (
    GRADER_SYSTEM,
    QUIZ_SYSTEM,
    AnswerGrades,
    QuizDraft,
    concept_key,
    grading_request,
    next_review,
    quiz_request,
    recommendations,
    rule_mark,
    snap_score,
    updated_mastery,
    validate_quiz,
)
from app.core.errors import AppError, NotFound
from app.db.enums import QuestionType
from app.db.models import Quiz, QuizAnswer, QuizQuestion, QuizSubmission, TopicMastery, User
from app.schemas.quizzes import (
    AnswerResult,
    AttemptSummary,
    ConceptResult,
    QuestionOut,
    QuizCreate,
    QuizOut,
    QuizSubmit,
    QuizSummary,
    Recommendation,
    SubmissionOut,
)
from app.services.learning_service import get_lesson

logger = logging.getLogger(__name__)


def _section(plan: dict | None, index: int) -> dict | None:
    """The plan section at a flat index (sections numbered across modules)."""
    sections = [s for m in (plan or {}).get("modules", []) for s in m.get("sections", [])]
    return sections[index] if 0 <= index < len(sections) else None


def _attempt(sub: QuizSubmission) -> AttemptSummary:
    return AttemptSummary(
        id=sub.id,
        score=sub.score / sub.max_score if sub.max_score else 0.0,
        correct=sub.score,
        total=int(sub.max_score),
        submitted_at=sub.submitted_at,
    )


async def _attempts(
    session: AsyncSession, quiz_ids: list[uuid.UUID]
) -> dict[uuid.UUID, list[QuizSubmission]]:
    by_quiz: dict[uuid.UUID, list[QuizSubmission]] = defaultdict(list)
    if quiz_ids:
        rows = await session.scalars(
            select(QuizSubmission)
            .where(QuizSubmission.quiz_id.in_(quiz_ids))
            .order_by(QuizSubmission.submitted_at.desc())
        )
        for sub in rows:
            by_quiz[sub.quiz_id].append(sub)
    return by_quiz


def to_summary(quiz: Quiz, attempts: list[QuizSubmission]) -> QuizSummary:
    scores = [_attempt(a).score for a in attempts]
    return QuizSummary(
        id=quiz.id,
        lesson_id=quiz.lesson_id,
        title=quiz.title,
        topic=quiz.topic,
        focus=quiz.focus,
        language=quiz.language,
        level=quiz.level,
        question_count=quiz.question_count,
        attempts=len(attempts),
        best_score=max(scores) if scores else None,
        last_attempt=_attempt(attempts[0]) if attempts else None,
        created_at=quiz.created_at,
    )


def to_out(quiz: Quiz, attempts: list[QuizSubmission]) -> QuizOut:
    return QuizOut(
        **to_summary(quiz, attempts).model_dump(),
        question_types=quiz.question_types,
        questions=[
            QuestionOut(
                id=q.id,
                position=q.position,
                qtype=q.qtype,
                prompt=q.prompt,
                options=q.options,
                concept=q.concept,
                difficulty=q.difficulty,
            )
            for q in quiz.questions
        ],
    )


async def quiz_out(session: AsyncSession, quiz: Quiz) -> QuizOut:
    return to_out(quiz, (await _attempts(session, [quiz.id]))[quiz.id])


async def generate(session: AsyncSession, llm: LLMProvider, user: User, data: QuizCreate) -> Quiz:
    topic, focus, section = data.topic, None, None
    if data.lesson_id is not None:
        lesson = await get_lesson(session, user.id, data.lesson_id)  # ownership check
        topic = lesson.topic
        if data.section is not None:
            section = _section(lesson.plan, data.section)
            if section is None:
                raise NotFound("Lesson section")
            focus = section.get("title") or None
    elif data.section is not None:
        raise AppError(422, "lesson_required", "A section check needs a lesson.")
    result = await llm.parse(
        system=QUIZ_SYSTEM,
        messages=[
            ChatMessage(
                "user",
                quiz_request(
                    topic=topic,
                    level=data.level,
                    language_name=language_name(data.language),
                    count=data.question_count,
                    types=data.question_types,
                    focus=section,
                ),
            )
        ],
        schema=QuizDraft,
    )
    draft = validate_quiz(
        result.value, topic=topic, count=data.question_count, types=data.question_types
    )
    logger.info(
        "quiz generated model=%s questions=%d out=%s",
        result.model,
        len(draft.questions),
        result.usage.output_tokens,
    )
    quiz = Quiz(
        user_id=user.id,
        lesson_id=data.lesson_id,
        title=f"{draft.title}: {focus}"[:200]
        if focus and focus not in draft.title
        else draft.title,
        topic=topic,
        focus=focus,
        language=data.language,
        level=data.level,
        question_types=data.question_types,
        question_count=len(draft.questions),
        questions=[
            QuizQuestion(
                position=i,
                qtype=QuestionType(q.qtype),
                prompt=q.prompt,
                options=q.options if q.qtype == "mcq" else None,
                correct_answer=q.answer,
                accepted_answers=q.accepted_answers,
                explanation=q.explanation,
                concept=q.concept,
                difficulty=q.difficulty,
            )
            for i, q in enumerate(draft.questions)
        ],
    )
    session.add(quiz)
    await session.commit()
    await session.refresh(quiz)
    return quiz


async def list_quizzes(
    session: AsyncSession,
    user_id: uuid.UUID,
    *,
    lesson_id: uuid.UUID | None,
    limit: int,
    offset: int,
) -> tuple[list[QuizSummary], int]:
    filters = [Quiz.user_id == user_id]
    if lesson_id is not None:
        filters.append(Quiz.lesson_id == lesson_id)
    total = await session.scalar(select(func.count()).select_from(Quiz).where(*filters))
    quizzes = list(
        await session.scalars(
            select(Quiz)
            .where(*filters)
            .order_by(Quiz.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
    )
    attempts = await _attempts(session, [q.id for q in quizzes])
    return [to_summary(q, attempts[q.id]) for q in quizzes], total or 0


async def get_quiz(session: AsyncSession, user_id: uuid.UUID, quiz_id: uuid.UUID) -> Quiz:
    quiz = await session.get(Quiz, quiz_id)
    if quiz is None or quiz.user_id != user_id:
        raise NotFound("Quiz")
    return quiz


async def delete(session: AsyncSession, user_id: uuid.UUID, quiz_id: uuid.UUID) -> None:
    await session.delete(await get_quiz(session, user_id, quiz_id))
    await session.commit()


# --- attempts --------------------------------------------------------------------------


async def _model_marks(
    llm: LLMProvider, quiz: Quiz, pending: list[tuple[QuizQuestion, str]]
) -> dict[int, tuple[float, str]]:
    """Ask the model to mark short answers that didn't match exactly: {position: (score, fb)}."""
    result = await llm.parse(
        system=GRADER_SYSTEM,
        messages=[
            ChatMessage(
                "user",
                grading_request(
                    [(q.position, q.prompt, q.correct_answer, given) for q, given in pending],
                    language_name(quiz.language),
                ),
            )
        ],
        schema=AnswerGrades,
    )
    marks = {g.index: (snap_score(g.score), g.feedback.strip()[:600]) for g in result.value.grades}
    if any(q.position not in marks for q, _ in pending):
        raise LLMError("Some answers couldn't be marked. Please submit again.")
    return marks


def _concepts(quiz: Quiz, scores: dict[uuid.UUID, float]) -> list[dict]:
    groups: dict[str, dict] = {}
    for q in quiz.questions:
        group = groups.setdefault(
            concept_key(q.concept), {"concept": q.concept, "correct": 0.0, "total": 0}
        )
        group["correct"] += scores[q.id]
        group["total"] += 1
    return [{**g, "score": round(g["correct"] / g["total"], 3)} for g in groups.values()]


async def _update_mastery(
    session: AsyncSession, user_id: uuid.UUID, topic: str, concepts: list[dict], now: datetime
) -> None:
    topic_key = concept_key(topic)[:300]
    existing = {
        m.concept_key: m
        for m in await session.scalars(
            select(TopicMastery)
            .where(TopicMastery.user_id == user_id, TopicMastery.topic_key == topic_key)
            .with_for_update()
        )
    }
    for c in concepts:
        key = concept_key(c["concept"])
        row = existing.get(key)
        if row is None:
            row = TopicMastery(
                user_id=user_id,
                topic_key=topic_key,
                topic=topic,
                concept_key=key,
                concept=c["concept"],
                evidence_count=0,
            )
            session.add(row)
        row.mastery = updated_mastery(row.mastery if row.evidence_count else None, c["score"])
        row.evidence_count += c["total"]
        row.last_assessed_at = now
        row.next_review_at = next_review(row.mastery, row.evidence_count, now)


async def submit(
    session: AsyncSession,
    llm: LLMProvider,
    user_id: uuid.UUID,
    quiz_id: uuid.UUID,
    data: QuizSubmit,
) -> QuizSubmission:
    quiz = await get_quiz(session, user_id, quiz_id)
    known = {q.id for q in quiz.questions}
    if any(a.question_id not in known for a in data.answers):
        raise AppError(422, "unknown_question", "An answer refers to a question not in this quiz.")
    given = {a.question_id: a.answer for a in data.answers}

    marks: dict[uuid.UUID, tuple[float, str | None, str]] = {}
    pending: list[tuple[QuizQuestion, str]] = []
    for q in quiz.questions:
        answer = given.get(q.id, "")
        score = rule_mark(q.qtype.value, answer, q.correct_answer, q.accepted_answers)
        if score is None:
            pending.append((q, answer))
        else:
            marks[q.id] = (score, None, "rule")
    if pending:
        model = await _model_marks(llm, quiz, pending)
        for q, _ in pending:
            score, feedback = model[q.position]
            marks[q.id] = (score, feedback or None, "model")

    scores = {qid: m[0] for qid, m in marks.items()}
    total = len(quiz.questions)
    correct = sum(scores.values())
    concepts = _concepts(quiz, scores)
    recs = recommendations(concepts, correct / total, topic=quiz.topic, level=quiz.level)
    now = datetime.now(UTC)
    submission = QuizSubmission(
        quiz_id=quiz.id,
        user_id=user_id,
        score=correct,
        max_score=float(total),
        duration_seconds=data.duration_seconds,
        feedback={"concepts": concepts, "recommendations": recs},
        submitted_at=now,
        answers=[
            QuizAnswer(
                question_id=q.id,
                answer=given.get(q.id, ""),
                is_correct=marks[q.id][0] == 1.0,
                score=marks[q.id][0],
                grader_feedback=marks[q.id][1],
                graded_by=marks[q.id][2],
            )
            for q in quiz.questions
        ],
    )
    session.add(submission)
    await _update_mastery(session, user_id, quiz.topic, concepts, now)
    await session.commit()
    await session.refresh(submission)
    return submission


async def get_submission(
    session: AsyncSession, user_id: uuid.UUID, submission_id: uuid.UUID
) -> tuple[Quiz, QuizSubmission]:
    sub = await session.get(QuizSubmission, submission_id)
    if sub is None or sub.user_id != user_id:
        raise NotFound("Quiz attempt")
    return await get_quiz(session, user_id, sub.quiz_id), sub


def submission_out(quiz: Quiz, sub: QuizSubmission) -> SubmissionOut:
    """An attempt with answers and explanations (shown only after submitting)."""
    answers = {a.question_id: a for a in sub.answers}
    results = []
    for q in quiz.questions:
        a = answers.get(q.id)
        results.append(
            AnswerResult(
                question_id=q.id,
                position=q.position,
                qtype=q.qtype,
                prompt=q.prompt,
                options=q.options,
                concept=q.concept,
                answer=a.answer if a else "",
                correct_answer=q.correct_answer,
                is_correct=a.is_correct if a else False,
                score=a.score if a else 0.0,
                explanation=q.explanation,
                feedback=a.grader_feedback if a else None,
                graded_by=a.graded_by if a else "rule",
            )
        )
    attempt = _attempt(sub)
    return SubmissionOut(
        id=sub.id,
        quiz_id=quiz.id,
        score=attempt.score,
        correct=sub.score,
        total=attempt.total,
        duration_seconds=sub.duration_seconds,
        concepts=[ConceptResult(**c) for c in sub.feedback.get("concepts", [])],
        recommendations=[Recommendation(**r) for r in sub.feedback.get("recommendations", [])],
        results=results,
        submitted_at=sub.submitted_at,
    )
