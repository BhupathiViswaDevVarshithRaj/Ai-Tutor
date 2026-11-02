import uuid
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUser, SessionDep
from app.schemas.common import Page
from app.schemas.learning import (
    ConversationCreate,
    ConversationDetail,
    ConversationOut,
    MessageCreate,
    MessageOut,
)
from app.services import learning_service

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("")
async def list_conversations(
    user: CurrentUser,
    session: SessionDep,
    lesson_id: uuid.UUID | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> Page[ConversationOut]:
    items, total = await learning_service.list_conversations(
        session, user.id, lesson_id=lesson_id, limit=limit, offset=offset
    )
    return Page[ConversationOut](
        items=[ConversationOut.model_validate(i) for i in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_conversation(
    data: ConversationCreate, user: CurrentUser, session: SessionDep
) -> ConversationOut:
    conversation = await learning_service.create_conversation(session, user.id, data)
    return ConversationOut.model_validate(conversation)


@router.get("/{conversation_id}")
async def get_conversation(
    conversation_id: uuid.UUID, user: CurrentUser, session: SessionDep
) -> ConversationDetail:
    conversation = await learning_service.get_conversation(
        session, user.id, conversation_id, with_messages=True
    )
    return ConversationDetail.model_validate(conversation)


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conversation_id: uuid.UUID, user: CurrentUser, session: SessionDep
) -> None:
    await learning_service.delete_conversation(session, user.id, conversation_id)


@router.post("/{conversation_id}/messages", status_code=status.HTTP_201_CREATED)
async def add_message(
    conversation_id: uuid.UUID, data: MessageCreate, user: CurrentUser, session: SessionDep
) -> MessageOut:
    """Store a learner message. Tutor replies are generated here from Phase 4."""
    message = await learning_service.add_user_message(session, user.id, conversation_id, data)
    return MessageOut.model_validate(message)
