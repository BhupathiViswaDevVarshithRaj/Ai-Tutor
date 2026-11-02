import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status
from fastapi.responses import StreamingResponse

from app.ai.llm.base import LLMProvider
from app.ai.llm.factory import get_llm
from app.api.deps import CurrentUser, SessionDep
from app.core.rate_limit import RateLimiter
from app.schemas.learning import ConversationOut, LessonOut
from app.schemas.tutor import AIInfo, LessonGenerate, LessonStart, TutorMessageIn
from app.services import tutor_service

router = APIRouter(prefix="/tutor", tags=["tutor"])

LLM = Annotated[LLMProvider, Depends(get_llm)]
AI_LIMIT = [Depends(RateLimiter("ai", "ai_rate_limit", "ai_rate_window_seconds"))]


@router.get("/info")
async def ai_info(_: CurrentUser, llm: LLM) -> AIInfo:
    return AIInfo(
        provider=llm.name,
        is_mock=llm.is_mock,
        tutor_model=llm.model_for("tutor"),
        structured_model=llm.model_for("structured"),
    )


@router.post("/lessons", status_code=status.HTTP_201_CREATED, dependencies=AI_LIMIT)
async def start_lesson(
    data: LessonGenerate, user: CurrentUser, session: SessionDep, llm: LLM
) -> LessonStart:
    """Generate a lesson plan for a topic and open its conversation."""
    lesson, conversation = await tutor_service.generate_lesson(session, llm, user, data)
    return LessonStart(
        lesson=LessonOut.model_validate(lesson),
        conversation=ConversationOut.model_validate(conversation),
    )


@router.post("/conversations/{conversation_id}/reply", dependencies=AI_LIMIT)
async def reply(
    conversation_id: uuid.UUID,
    data: TutorMessageIn,
    user: CurrentUser,
    session: SessionDep,
    llm: LLM,
) -> StreamingResponse:
    """Store the learner's message and stream the tutor's reply as server-sent events."""
    turn = await tutor_service.prepare_turn(session, user, conversation_id, data)
    return StreamingResponse(
        tutor_service.stream_turn(llm, turn),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/lessons/{lesson_id}/summary", dependencies=AI_LIMIT)
async def summarize(
    lesson_id: uuid.UUID, user: CurrentUser, session: SessionDep, llm: LLM
) -> LessonOut:
    lesson = await tutor_service.summarize_lesson(session, llm, user, lesson_id)
    return LessonOut.model_validate(lesson)
