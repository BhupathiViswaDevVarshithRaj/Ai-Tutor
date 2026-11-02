import uuid
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUser, SessionDep
from app.db.enums import LessonStatus
from app.schemas.common import Page
from app.schemas.learning import LessonCreate, LessonOut, LessonUpdate
from app.services import learning_service

router = APIRouter(prefix="/lessons", tags=["lessons"])

Limit = Annotated[int, Query(ge=1, le=100)]
Offset = Annotated[int, Query(ge=0)]


@router.get("")
async def list_lessons(
    user: CurrentUser,
    session: SessionDep,
    status_filter: Annotated[LessonStatus | None, Query(alias="status")] = None,
    limit: Limit = 20,
    offset: Offset = 0,
) -> Page[LessonOut]:
    items, total = await learning_service.list_lessons(
        session, user.id, status=status_filter, limit=limit, offset=offset
    )
    return Page[LessonOut](
        items=[LessonOut.model_validate(i) for i in items], total=total, limit=limit, offset=offset
    )


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_lesson(data: LessonCreate, user: CurrentUser, session: SessionDep) -> LessonOut:
    return LessonOut.model_validate(await learning_service.create_lesson(session, user.id, data))


@router.get("/{lesson_id}")
async def get_lesson(lesson_id: uuid.UUID, user: CurrentUser, session: SessionDep) -> LessonOut:
    return LessonOut.model_validate(await learning_service.get_lesson(session, user.id, lesson_id))


@router.patch("/{lesson_id}")
async def update_lesson(
    lesson_id: uuid.UUID, data: LessonUpdate, user: CurrentUser, session: SessionDep
) -> LessonOut:
    lesson = await learning_service.update_lesson(session, user.id, lesson_id, data)
    return LessonOut.model_validate(lesson)


@router.delete("/{lesson_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lesson(lesson_id: uuid.UUID, user: CurrentUser, session: SessionDep) -> None:
    await learning_service.delete_lesson(session, user.id, lesson_id)
