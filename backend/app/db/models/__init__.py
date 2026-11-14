"""Import every model module so Base.metadata is complete (Alembic, tests)."""

from app.db.models.assessment import Quiz, QuizAnswer, QuizQuestion, QuizSubmission, TopicMastery
from app.db.models.languages import LanguageEnrollment, PracticeSession, VocabItem
from app.db.models.learning import Conversation, Lesson, Message
from app.db.models.media import MediaAsset, MediaBlob, VideoJob
from app.db.models.user import PasswordResetToken, RefreshToken, User, UserPreferences
from app.db.models.visual import Diagram, MindMap

__all__ = [
    "Conversation",
    "Diagram",
    "LanguageEnrollment",
    "Lesson",
    "MediaAsset",
    "MediaBlob",
    "Message",
    "MindMap",
    "PracticeSession",
    "PasswordResetToken",
    "Quiz",
    "QuizAnswer",
    "QuizQuestion",
    "QuizSubmission",
    "RefreshToken",
    "TopicMastery",
    "User",
    "UserPreferences",
    "VideoJob",
    "VocabItem",
]
