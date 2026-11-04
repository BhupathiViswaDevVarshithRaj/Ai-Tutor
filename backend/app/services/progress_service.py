"""The learner's progress, computed from their real activity, quiz attempts and mastery."""

import uuid
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.quiz import STRONG, WEAK
from app.db.enums import LessonStatus, MessageRole
from app.db.models import (
    Diagram,
    Lesson,
    Message,
    MindMap,
    PracticeSession,
    Quiz,
    QuizSubmission,
    TopicMastery,
    VideoJob,
    VocabItem,
)
from app.schemas.progress import (
    Activity,
    ConceptMastery,
    LessonCounts,
    ProgressOut,
    QuizCounts,
    ScorePoint,
)
from app.services.language_service import streak

SCORE_POINTS = 20
TOPIC_ROWS = 8
REVISION_ROWS = 10
REVISION_HORIZON = timedelta(days=7)
STREAK_LOOKBACK = timedelta(days=366)


async def active_days(session: AsyncSession, user_id: uuid.UUID, since: datetime) -> set[date]:
    """Days with any learning activity: a question asked, a quiz taken, practice, words
    reviewed, or a mind map, diagram, video or lesson made. Days are in UTC."""
    sources = [
        (Message.created_at, [Message.user_id == user_id, Message.role == MessageRole.USER]),
        (QuizSubmission.submitted_at, [QuizSubmission.user_id == user_id]),
        (PracticeSession.completed_at, [PracticeSession.user_id == user_id]),
        (VocabItem.last_reviewed_at, [VocabItem.user_id == user_id]),
        (MindMap.created_at, [MindMap.user_id == user_id]),
        (Diagram.created_at, [Diagram.user_id == user_id]),
        (VideoJob.created_at, [VideoJob.user_id == user_id]),
        (Lesson.created_at, [Lesson.user_id == user_id]),
    ]
    days: set[date] = set()
    for column, filters in sources:
        days.update(
            await session.scalars(
                select(func.date(column)).where(*filters, column >= since).distinct()
            )
        )
    return days


def _mastery(row: TopicMastery, now: datetime) -> ConceptMastery:
    return ConceptMastery(
        topic=row.topic,
        concept=row.concept,
        mastery=row.mastery,
        evidence_count=row.evidence_count,
        last_assessed_at=row.last_assessed_at,
        next_review_at=row.next_review_at,
        due=row.next_review_at <= now,
    )


async def progress(session: AsyncSession, user_id: uuid.UUID) -> ProgressOut:
    now = datetime.now(UTC)

    lesson_rows = (
        await session.execute(
            select(
                Lesson.status,
                func.count(),
                func.sum(func.cardinality(Lesson.completed_sections)),
            )
            .where(Lesson.user_id == user_id)
            .group_by(Lesson.status)
        )
    ).all()
    by_status = {status: count for status, count, _ in lesson_rows}
    lessons = LessonCounts(
        total=sum(by_status.values()),
        active=by_status.get(LessonStatus.ACTIVE, 0),
        completed=by_status.get(LessonStatus.COMPLETED, 0),
        sections_completed=int(sum(done or 0 for *_, done in lesson_rows)),
    )

    quiz_count = await session.scalar(
        select(func.count()).select_from(Quiz).where(Quiz.user_id == user_id)
    )
    ratio = QuizSubmission.score / func.nullif(QuizSubmission.max_score, 0)
    attempts, average, best = (
        await session.execute(
            select(func.count(), func.avg(ratio), func.max(ratio)).where(
                QuizSubmission.user_id == user_id
            )
        )
    ).one()
    quizzes = QuizCounts(
        quizzes=quiz_count or 0,
        attempts=attempts,
        average_score=round(average, 3) if average is not None else None,
        best_score=round(best, 3) if best is not None else None,
    )

    recent = (
        await session.execute(
            select(QuizSubmission, Quiz.title)
            .join(Quiz, Quiz.id == QuizSubmission.quiz_id)
            .where(QuizSubmission.user_id == user_id)
            .order_by(QuizSubmission.submitted_at.desc())
            .limit(SCORE_POINTS)
        )
    ).all()
    scores = [
        ScorePoint(
            submission_id=sub.id,
            quiz_id=sub.quiz_id,
            title=title,
            score=round(sub.score / sub.max_score, 3) if sub.max_score else 0.0,
            submitted_at=sub.submitted_at,
        )
        for sub, title in reversed(recent)
    ]

    days = await active_days(session, user_id, now - STREAK_LOOKBACK)
    today = now.date()
    last_30 = sorted(d for d in days if (today - d).days < 30)
    activity = Activity(
        today=today, streak_days=streak(days, today), active_days_last_30=len(last_30), days=last_30
    )

    mine = TopicMastery.user_id == user_id
    strong = await session.scalars(
        select(TopicMastery)
        .where(mine, TopicMastery.mastery >= STRONG)
        .order_by(TopicMastery.mastery.desc(), TopicMastery.evidence_count.desc())
        .limit(TOPIC_ROWS)
    )
    weak = await session.scalars(
        select(TopicMastery)
        .where(mine, TopicMastery.mastery < WEAK)
        .order_by(TopicMastery.mastery, TopicMastery.last_assessed_at.desc())
        .limit(TOPIC_ROWS)
    )
    revision = await session.scalars(
        select(TopicMastery)
        .where(mine, TopicMastery.next_review_at <= now + REVISION_HORIZON)
        .order_by(TopicMastery.next_review_at, TopicMastery.mastery)
        .limit(REVISION_ROWS)
    )
    return ProgressOut(
        lessons=lessons,
        quizzes=quizzes,
        activity=activity,
        scores=scores,
        strong=[_mastery(r, now) for r in strong],
        weak=[_mastery(r, now) for r in weak],
        revision=[_mastery(r, now) for r in revision],
    )
