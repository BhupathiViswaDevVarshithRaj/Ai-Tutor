from enum import StrEnum


class LearningLevel(StrEnum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"


class LessonStatus(StrEnum):
    ACTIVE = "active"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class ConversationMode(StrEnum):
    TEXT = "text"
    VOICE = "voice"


class MessageRole(StrEnum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class InputMode(StrEnum):
    TEXT = "text"
    VOICE = "voice"


# Target tutor languages (BCP-47). Per-capability support is verified in Phase 9.
SUPPORTED_LANGUAGES = ("en", "hi", "te", "ta", "pa", "bn")
