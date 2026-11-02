from fastapi import APIRouter

from app.api.deps import CurrentUser, SessionDep
from app.schemas.user import PreferencesOut, PreferencesUpdate, UserOut, UserUpdate
from app.services import user_service

router = APIRouter(prefix="/users/me", tags=["users"])


@router.get("")
async def get_me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)


@router.patch("")
async def update_me(data: UserUpdate, user: CurrentUser, session: SessionDep) -> UserOut:
    return UserOut.model_validate(await user_service.update_profile(session, user, data))


@router.get("/preferences")
async def get_preferences(user: CurrentUser) -> PreferencesOut:
    return PreferencesOut.model_validate(user.preferences)


@router.patch("/preferences")
async def update_preferences(
    data: PreferencesUpdate, user: CurrentUser, session: SessionDep
) -> PreferencesOut:
    user = await user_service.update_preferences(session, user, data)
    return PreferencesOut.model_validate(user.preferences)
