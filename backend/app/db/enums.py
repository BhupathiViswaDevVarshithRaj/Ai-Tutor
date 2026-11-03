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


# World-language courses (Phase 9): the language being learned, separate from tutor languages.
COURSE_LANGUAGES = ("de", "fr", "es", "ja", "ko", "zh", "it", "pt")


class CefrLevel(StrEnum):
    A1 = "A1"
    A2 = "A2"
    B1 = "B1"
    B2 = "B2"
    C1 = "C1"
    C2 = "C2"


class PracticeSkill(StrEnum):
    GRAMMAR = "grammar"
    LISTENING = "listening"
    READING = "reading"
    WRITING = "writing"
    SPEAKING = "speaking"
    CONVERSATION = "conversation"
