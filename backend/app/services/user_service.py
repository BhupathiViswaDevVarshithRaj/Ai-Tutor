from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import User
from app.schemas.user import PreferencesUpdate, UserUpdate


async def update_profile(session: AsyncSession, user: User, data: UserUpdate) -> User:
    user.full_name = data.full_name
    await session.commit()
    await session.refresh(user)
    return user


async def update_preferences(session: AsyncSession, user: User, data: PreferencesUpdate) -> User:
    for field, value in data.model_dump(exclude_unset=True).items():
        if value is None and field != "tts_voice":
            continue  # null means "unchanged" except for tts_voice, which is nullable
        setattr(user.preferences, field, value)
    await session.commit()
    await session.refresh(user)
    return user
