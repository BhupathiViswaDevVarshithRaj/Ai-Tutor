"""Mock speech providers for development and tests. The UI labels them as mocks."""

from app.ai.speech.audio import blips, sniff_container, wav_duration_ms
from app.ai.speech.base import AudioResult, Transcript, UnsupportedLanguage, Voice

MOCK_LANGUAGES = ("en", "hi", "te", "ta", "pa", "bn")
MOCK_TRANSCRIPT = (
    "[Mock transcript] Speech recognition is not connected yet, "
    "so this text is a placeholder, not what you said."
)
# Characters spoken per second at speed 1.0; gives realistic durations for the UI.
CHARS_PER_SECOND = 14
MOCK_VOICES = (
    Voice(id="mock-bright", name="Mock voice (bright)", languages=MOCK_LANGUAGES),
    Voice(id="mock-calm", name="Mock voice (calm)", languages=MOCK_LANGUAGES),
)
_PITCH = {"mock-bright": 660.0, "mock-calm": 440.0}


class MockSTTProvider:
    name = "mock"
    is_mock = True
    unavailable_reason = None

    def __init__(self, transcript: str = MOCK_TRANSCRIPT) -> None:
        self.transcript = transcript

    def supported_languages(self) -> tuple[str, ...]:
        return MOCK_LANGUAGES

    async def transcribe(self, audio: bytes, *, mime_type: str, language: str) -> Transcript:
        if language not in MOCK_LANGUAGES:
            raise UnsupportedLanguage(language, "Speech recognition")
        duration = wav_duration_ms(audio) if sniff_container(audio) == "wav" else None
        return Transcript(
            text=self.transcript, language=language, confidence=None, duration_ms=duration
        )


class MockTTSProvider:
    name = "mock"
    is_mock = True
    unavailable_reason = None

    def supported_languages(self) -> tuple[str, ...]:
        return MOCK_LANGUAGES

    def voices(self) -> tuple[Voice, ...]:
        return MOCK_VOICES

    async def synthesize(
        self, text: str, *, language: str, voice: str | None = None, speed: float = 1.0
    ) -> AudioResult:
        if language not in MOCK_LANGUAGES:
            raise UnsupportedLanguage(language, "Speech")
        voice_id = voice if voice in _PITCH else MOCK_VOICES[0].id
        ms_per_char = 1000 / (CHARS_PER_SECOND * speed)
        duration = max(400, round(len(text) * ms_per_char))
        # One blip per word, placed where the word would start.
        onsets, position = [], 0
        for word in text.split():
            position = text.index(word, position)
            onsets.append(round(position * ms_per_char))
            position += len(word)
        return AudioResult(
            audio=blips(duration, onsets, pitch_hz=_PITCH[voice_id]),
            mime_type="audio/wav",
            duration_ms=duration,
            voice=voice_id,
        )
