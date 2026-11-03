from typing import Annotated

from fastapi import APIRouter, Depends, WebSocket

from app.ai.llm.base import LLMProvider
from app.ai.llm.factory import get_llm
from app.ai.speech.base import STTProvider, TTSProvider
from app.ai.speech.factory import get_stt, get_tts
from app.core.config import get_settings
from app.services.voice_service import VoiceSession

router = APIRouter(prefix="/voice", tags=["voice"])


@router.websocket("/ws")
async def voice_ws(
    websocket: WebSocket,
    llm: Annotated[LLMProvider, Depends(get_llm)],
    stt: Annotated[STTProvider, Depends(get_stt)],
    tts: Annotated[TTSProvider, Depends(get_tts)],
) -> None:
    """Live voice tutor session. Protocol: see app/services/voice_service.py."""
    await VoiceSession(websocket, llm=llm, stt=stt, tts=tts, settings=get_settings()).run()
