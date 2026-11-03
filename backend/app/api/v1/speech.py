from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import Response

from app.ai.speech.audio import ACCEPTED_AUDIO_TYPES
from app.ai.speech.base import STTProvider, TTSProvider
from app.ai.speech.factory import get_stt, get_tts
from app.api.deps import CurrentUser
from app.core.config import get_settings
from app.core.rate_limit import RateLimiter
from app.schemas.common import AnyLanguage
from app.schemas.speech import SpeechInfo, SynthesizeIn, TranscriptOut
from app.services import speech_service

router = APIRouter(prefix="/speech", tags=["speech"])

STT = Annotated[STTProvider, Depends(get_stt)]
TTS = Annotated[TTSProvider, Depends(get_tts)]
SPEECH_LIMIT = [Depends(RateLimiter("speech", "speech_rate_limit", "speech_rate_window_seconds"))]

# Response headers describing synthesized audio (exposed to the browser via CORS).
SPEECH_HEADERS = ["X-Speech-Duration-Ms", "X-Speech-Voice", "X-Speech-Provider", "X-Speech-Mock"]

_AUDIO_BODY = {
    "requestBody": {
        "required": True,
        "content": {
            mime: {"schema": {"type": "string", "format": "binary"}}
            for mime in ACCEPTED_AUDIO_TYPES
        },
    }
}


@router.get("/info")
async def info(_: CurrentUser, stt: STT, tts: TTS) -> SpeechInfo:
    """Speech providers, their availability, voices and per-language support."""
    return speech_service.speech_info(stt, tts, get_settings())


@router.post("/transcribe", dependencies=SPEECH_LIMIT, openapi_extra=_AUDIO_BODY)
async def transcribe(
    request: Request, _: CurrentUser, stt: STT, language: Annotated[AnyLanguage, Query()]
) -> TranscriptOut:
    """Transcribe a recording sent as the raw request body (Content-Type: audio/...)."""
    transcript = await speech_service.transcribe(stt, request, language, get_settings())
    return TranscriptOut(
        text=transcript.text,
        language=transcript.language,
        confidence=transcript.confidence,
        duration_ms=transcript.duration_ms,
        provider=stt.name,
        is_mock=stt.is_mock,
    )


@router.post(
    "/synthesize",
    dependencies=SPEECH_LIMIT,
    response_class=Response,
    responses={200: {"content": {"audio/wav": {}}, "description": "Synthesized audio"}},
)
async def synthesize(data: SynthesizeIn, _: CurrentUser, tts: TTS) -> Response:
    """Read text aloud. Returns audio bytes; details are in the X-Speech-* headers."""
    result = await speech_service.synthesize(tts, data, get_settings())
    return Response(
        content=result.audio,
        media_type=result.mime_type,
        headers={
            "X-Speech-Duration-Ms": str(result.duration_ms),
            "X-Speech-Voice": result.voice,
            "X-Speech-Provider": tts.name,
            "X-Speech-Mock": "true" if tts.is_mock else "false",
            "Cache-Control": "no-store",
        },
    )
