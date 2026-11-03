"""Audio helpers: container detection for uploads and WAV encoding for the mock voice."""

import io
import math
import wave
from array import array

# Accepted upload types (parameters such as ";codecs=opus" are stripped first) → container.
ACCEPTED_AUDIO_TYPES: dict[str, str] = {
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/wave": "wav",
    "audio/mpeg": "mp3",
    "audio/mp4": "mp4",
}

SAMPLE_RATE = 16_000


def base_mime(content_type: str | None) -> str:
    return (content_type or "").split(";", 1)[0].strip().lower()


def sniff_container(data: bytes) -> str | None:
    """Identify the container from its magic bytes, so a mislabelled upload is rejected."""
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WAVE":
        return "wav"
    if data[:4] == b"\x1a\x45\xdf\xa3":
        return "webm"
    if data[:4] == b"OggS":
        return "ogg"
    if data[:3] == b"ID3" or (len(data) >= 2 and data[0] == 0xFF and data[1] & 0xE0 == 0xE0):
        return "mp3"
    if len(data) >= 8 and data[4:8] == b"ftyp":
        return "mp4"
    return None


def wav_duration_ms(data: bytes) -> int | None:
    try:
        with wave.open(io.BytesIO(data)) as wav:
            return round(wav.getnframes() * 1000 / wav.getframerate())
    except (wave.Error, EOFError, ZeroDivisionError):
        return None


def encode_wav(samples: array) -> bytes:
    """16-bit mono PCM WAV."""
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)
        wav.writeframes(samples.tobytes())
    return buffer.getvalue()


def blips(duration_ms: int, onsets_ms: list[int], *, pitch_hz: float, blip_ms: int = 70) -> bytes:
    """A quiet WAV with one short, faded tone at each onset: an audible but obviously fake voice."""
    total = int(SAMPLE_RATE * duration_ms / 1000)
    samples = array("h", bytes(2 * total))
    length = int(SAMPLE_RATE * blip_ms / 1000)
    amplitude = 0.12 * 32767
    for onset in onsets_ms:
        start = int(SAMPLE_RATE * onset / 1000)
        for i in range(min(length, total - start)):
            envelope = math.sin(math.pi * i / length)  # fade in and out, no clicks
            samples[start + i] = int(
                amplitude * envelope * math.sin(2 * math.pi * pitch_hz * i / SAMPLE_RATE)
            )
    return encode_wav(samples)
