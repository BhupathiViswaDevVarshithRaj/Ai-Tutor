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


class DiagramType(StrEnum):
    FLOWCHART = "flowchart"
    BLOCK = "block"
    TIMELINE = "timeline"
    GRAPH_FN = "graph_fn"
    PROCESS = "process"
    FREEHAND = "freehand"  # a blank sketch board with no generated diagram


class MediaKind(StrEnum):
    AUDIO = "audio"
    VIDEO = "video"
    SUBTITLE = "subtitle"
    IMAGE = "image"
    DOCUMENT = "document"


class VideoStatus(StrEnum):
    QUEUED = "queued"
    SCRIPTING = "scripting"
    NARRATING = "narrating"
    RENDERING = "rendering"
    COMPOSITING = "compositing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

    @property
    def active(self) -> bool:
        return self not in (VideoStatus.COMPLETED, VideoStatus.FAILED, VideoStatus.CANCELLED)
