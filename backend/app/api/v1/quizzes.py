import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.ai.llm.base import LLMProvider
from app.ai.llm.factory import get_llm
from app.api.deps import CurrentUser, SessionDep, UserRateLimiter
from app.schemas.common import Page
from app.schemas.quizzes import QuizCreate, QuizOut, QuizSubmit, QuizSummary, SubmissionOut
from app.services import quiz_service

router = APIRouter(prefix="/quizzes", tags=["quizzes"])

LLM = Annotated[LLMProvider, Depends(get_llm)]
AI_LIMIT = [Depends(UserRateLimiter("ai", "ai_rate_limit", "ai_rate_window_seconds"))]


@router.get("")
async def list_quizzes(
    user: CurrentUser,
    session: SessionDep,
    lesson_id: uuid.UUID | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> Page[QuizSummary]:
    items, total = await quiz_service.list_quizzes(
        session, user.id, lesson_id=lesson_id, limit=limit, offset=offset
    )
    return Page[QuizSummary](items=items, total=total, limit=limit, offset=offset)


@router.post("", status_code=status.HTTP_201_CREATED, dependencies=AI_LIMIT)
async def create_quiz(
    data: QuizCreate, user: CurrentUser, session: SessionDep, llm: LLM
) -> QuizOut:
    """Generate a quiz on a topic, or a quick check on one section of a lesson."""
    quiz = await quiz_service.generate(session, llm, user, data)
    return await quiz_service.quiz_out(session, quiz)


@router.get("/attempts/{submission_id}")
async def get_attempt(
    submission_id: uuid.UUID, user: CurrentUser, session: SessionDep
) -> SubmissionOut:
    quiz, sub = await quiz_service.get_submission(session, user.id, submission_id)
    return quiz_service.submission_out(quiz, sub)


@router.get("/{quiz_id}")
async def get_quiz(quiz_id: uuid.UUID, user: CurrentUser, session: SessionDep) -> QuizOut:
    """The questions without answers; answers come back with an attempt."""
    return await quiz_service.quiz_out(
        session, await quiz_service.get_quiz(session, user.id, quiz_id)
    )


@router.post("/{quiz_id}/submit", dependencies=AI_LIMIT)
async def submit_quiz(
    quiz_id: uuid.UUID, data: QuizSubmit, user: CurrentUser, session: SessionDep, llm: LLM
) -> SubmissionOut:
    """Mark an attempt, update mastery, and return results with explanations."""
    sub = await quiz_service.submit(session, llm, user.id, quiz_id, data)
    quiz = await quiz_service.get_quiz(session, user.id, quiz_id)
    return quiz_service.submission_out(quiz, sub)


@router.delete("/{quiz_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_quiz(quiz_id: uuid.UUID, user: CurrentUser, session: SessionDep) -> None:
    await quiz_service.delete(session, user.id, quiz_id)
