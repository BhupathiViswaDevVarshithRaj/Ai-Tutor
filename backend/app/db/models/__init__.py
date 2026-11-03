"""Import every model module so Base.metadata is complete (Alembic, tests)."""

from app.db.models.languages import LanguageEnrollment, PracticeSession, VocabItem
from app.db.models.learning import Conversation, Lesson, Message
from app.db.models.user import PasswordResetToken, RefreshToken, User, UserPreferences

__all__ = [
    "Conversation",
    "LanguageEnrollment",
    "Lesson",
    "Message",
    "PracticeSession",
    "PasswordResetToken",
    "RefreshToken",
    "User",
    "UserPreferences",
    "VocabItem",
]
