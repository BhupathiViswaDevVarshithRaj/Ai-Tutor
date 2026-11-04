from fastapi import APIRouter

from app.api.deps import CurrentUser, SessionDep
from app.schemas.progress import ProgressOut
from app.services import progress_service

router = APIRouter(prefix="/progress", tags=["progress"])


@router.get("")
async def get_progress(user: CurrentUser, session: SessionDep) -> ProgressOut:
    """Lessons, quiz scores, active days, strong and weak ideas, and what to revise."""
    return await progress_service.progress(session, user.id)
