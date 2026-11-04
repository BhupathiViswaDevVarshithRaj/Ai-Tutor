import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.ai.llm.base import LLMProvider
from app.ai.llm.factory import get_llm
from app.api.deps import CurrentUser, SessionDep, UserRateLimiter
from app.db.enums import PracticeSkill
from app.schemas.common import CourseLanguage
from app.schemas.languages import (
    CourseOut,
    EnrollIn,
    EnrollmentOut,
    PracticeSessionOut,
    PracticeStartIn,
    PracticeSubmitIn,
    PracticeSummaryOut,
    ProgressOut,
    VocabGenerateIn,
    VocabItemOut,
    VocabReviewIn,
)
from app.services import language_service

router = APIRouter(prefix="/languages", tags=["languages"])

LLM = Annotated[LLMProvider, Depends(get_llm)]
AI_LIMIT = [Depends(UserRateLimiter("ai", "ai_rate_limit", "ai_rate_window_seconds"))]


@router.get("")
async def list_courses(user: CurrentUser, session: SessionDep) -> list[CourseOut]:
    """The eight courses, with the learner's level and word counts for each."""
    return await language_service.list_courses(session, user.id)


@router.put("/{language}")
async def enroll(
    language: CourseLanguage, data: EnrollIn, user: CurrentUser, session: SessionDep
) -> EnrollmentOut:
    """Start a course or change its CEFR level."""
    enrollment = await language_service.enroll(session, user.id, language, data.level)
    return EnrollmentOut.model_validate(enrollment)


@router.get("/{language}/progress")
async def progress(language: CourseLanguage, user: CurrentUser, session: SessionDep) -> ProgressOut:
    return await language_service.progress(session, user.id, language)


@router.get("/{language}/vocabulary")
async def list_vocabulary(
    language: CourseLanguage,
    user: CurrentUser,
    session: SessionDep,
    due: bool = False,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> list[VocabItemOut]:
    items = await language_service.list_vocabulary(
        session, user.id, language, due_only=due, limit=limit
    )
    return [VocabItemOut.model_validate(i) for i in items]


@router.post(
    "/{language}/vocabulary/generate",
    status_code=status.HTTP_201_CREATED,
    dependencies=AI_LIMIT,
)
async def generate_vocabulary(
    language: CourseLanguage,
    data: VocabGenerateIn,
    user: CurrentUser,
    session: SessionDep,
    llm: LLM,
) -> list[VocabItemOut]:
    """Add new words at the learner's level (words already in the deck are skipped)."""
    items = await language_service.generate_vocabulary(session, llm, user, language, data.topic)
    return [VocabItemOut.model_validate(i) for i in items]


@router.post("/vocabulary/{item_id}/review")
async def review_vocabulary(
    item_id: uuid.UUID, data: VocabReviewIn, user: CurrentUser, session: SessionDep
) -> VocabItemOut:
    item = await language_service.review_vocabulary(session, user.id, item_id, data.grade)
    return VocabItemOut.model_validate(item)


@router.delete("/vocabulary/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vocabulary(item_id: uuid.UUID, user: CurrentUser, session: SessionDep) -> None:
    await language_service.delete_vocabulary(session, user.id, item_id)


@router.post("/{language}/practice", status_code=status.HTTP_201_CREATED, dependencies=AI_LIMIT)
async def start_practice(
    language: CourseLanguage,
    data: PracticeStartIn,
    user: CurrentUser,
    session: SessionDep,
    llm: LLM,
) -> PracticeSessionOut:
    """Generate a practice session (or open a role-play conversation) at the learner's level."""
    practice = await language_service.start_practice(session, llm, user, language, data)
    return language_service.session_out(practice)


@router.get("/{language}/practice")
async def list_practice(
    language: CourseLanguage,
    user: CurrentUser,
    session: SessionDep,
    skill: PracticeSkill | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[PracticeSummaryOut]:
    items = await language_service.list_practice(
        session, user.id, language, skill=skill, limit=limit
    )
    return [language_service.summary_out(i) for i in items]


@router.get("/practice/{practice_id}")
async def get_practice(
    practice_id: uuid.UUID, user: CurrentUser, session: SessionDep
) -> PracticeSessionOut:
    practice = await language_service.get_practice(session, user.id, practice_id)
    return language_service.session_out(practice)


@router.post("/practice/{practice_id}/submit", dependencies=AI_LIMIT)
async def submit_practice(
    practice_id: uuid.UUID,
    data: PracticeSubmitIn,
    user: CurrentUser,
    session: SessionDep,
    llm: LLM,
) -> PracticeSessionOut:
    """Mark the learner's answers (writing is marked by the model, the rest by rule)."""
    practice = await language_service.submit_practice(session, llm, user.id, practice_id, data)
    return language_service.session_out(practice)
