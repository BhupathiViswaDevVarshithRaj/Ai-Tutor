"""Scene durations and subtitle cues, from the narration (and its audio, when there is any)."""

import re
from dataclasses import dataclass

from app.video.script import CHARS_PER_SECOND

MIN_SCENE_SECONDS = 3.0
TAIL_SECONDS = 0.8  # a short pause after each scene's narration
CUE_CHARS = 84  # about two subtitle lines


@dataclass(frozen=True)
class Cue:
    start: float
    end: float
    text: str


def scene_seconds(narration: str, audio_ms: int | None) -> float:
    """How long a scene lasts: its narration audio (or reading time) plus a short pause."""
    spoken = audio_ms / 1000 if audio_ms else len(narration) / CHARS_PER_SECOND
    return round(max(MIN_SCENE_SECONDS, spoken + TAIL_SECONDS), 2)


def split_cues(text: str, limit: int = CUE_CHARS) -> list[str]:
    """Break narration into subtitle-sized chunks at sentence ends, then between words."""
    sentences = re.findall(r"[^.!?।]+[.!?।]*\s*", text) or [text]
    chunks: list[str] = []
    for sentence in (s.strip() for s in sentences):
        if not sentence:
            continue
        if len(sentence) <= limit:
            chunks.append(sentence)
            continue
        current = ""
        for word in sentence.split():
            if current and len(current) + 1 + len(word) > limit:
                chunks.append(current)
                current = word
            else:
                current = f"{current} {word}".strip()
        if current:
            chunks.append(current)
    return chunks


def build_cues(narrations: list[str], durations: list[float]) -> list[Cue]:
    """Cues for every scene, each scene's narration spread over its spoken part by length."""
    cues: list[Cue] = []
    offset = 0.0
    for narration, duration in zip(narrations, durations, strict=True):
        chunks = split_cues(narration)
        spoken = max(duration - TAIL_SECONDS, 0.5)
        total = sum(len(c) for c in chunks) or 1
        t = offset
        for chunk in chunks:
            length = spoken * len(chunk) / total
            cues.append(Cue(start=round(t, 3), end=round(t + length, 3), text=chunk))
            t += length
        offset += duration
    return cues


def _stamp(seconds: float, separator: str) -> str:
    ms = round(seconds * 1000)
    h, rest = divmod(ms, 3_600_000)
    m, rest = divmod(rest, 60_000)
    s, ms = divmod(rest, 1000)
    return f"{h:02d}:{m:02d}:{s:02d}{separator}{ms:03d}"


def to_vtt(cues: list[Cue]) -> str:
    blocks = [f"{_stamp(c.start, '.')} --> {_stamp(c.end, '.')}\n{c.text}" for c in cues]
    return "WEBVTT\n\n" + "\n\n".join(blocks) + "\n"


def to_srt(cues: list[Cue]) -> str:
    blocks = [
        f"{i}\n{_stamp(c.start, ',')} --> {_stamp(c.end, ',')}\n{c.text}"
        for i, c in enumerate(cues, start=1)
    ]
    return "\n\n".join(blocks) + "\n"
