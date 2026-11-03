"""Turn a streamed tutor reply into sentence-sized pieces that can be spoken one by one."""

import re

# A sentence ends at . ! ? or the danda (।), optionally followed by closing quotes/brackets,
# once the following whitespace has arrived; a line break also ends a piece.
_BOUNDARY = re.compile(r"[.!?।]+[\"'”’)\]]*(?=\s)|\n")
_LIST_MARKER = re.compile(r"^\s*(?:[-*•]|\d+[.)])\s+", re.MULTILINE)


def speakable(text: str) -> str:
    """Remove Markdown symbols that would be read out literally."""
    text = _LIST_MARKER.sub("", text)
    text = re.sub(r"^\s*#{1,6}\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", text)
    text = text.replace("**", "").replace("__", "").replace("`", "")
    return re.sub(r"\s+", " ", text).strip()


class SentenceBuffer:
    """Accumulates streamed text and releases complete pieces.

    Pieces are at least `min_chars` long (very short sentences are merged with the next) and
    at most `max_chars` (an over-long run is cut between words).
    """

    def __init__(self, min_chars: int = 40, max_chars: int = 400) -> None:
        self.min_chars = min_chars
        self.max_chars = max_chars
        self._buffer = ""

    def feed(self, text: str) -> list[str]:
        self._buffer += text
        pieces: list[str] = []
        while (cut := self._next_cut()) is not None:
            piece, self._buffer = self._buffer[:cut], self._buffer[cut:]
            if spoken := speakable(piece):
                pieces.append(spoken)
        return pieces

    def flush(self) -> list[str]:
        """Release whatever is left (call when the reply is complete)."""
        rest, self._buffer = self._buffer, ""
        pieces: list[str] = []
        while len(rest) > self.max_chars:
            space = rest.rfind(" ", 0, self.max_chars)
            cut = space if space > 0 else self.max_chars
            pieces.append(rest[:cut])
            rest = rest[cut:]
        pieces.append(rest)
        return [s for p in pieces if (s := speakable(p))]

    def _next_cut(self) -> int | None:
        for match in _BOUNDARY.finditer(self._buffer):
            if len(speakable(self._buffer[: match.end()])) >= self.min_chars:
                return match.end()
        if len(self._buffer) > self.max_chars:
            space = self._buffer.rfind(" ", 0, self.max_chars)
            return space if space > 0 else self.max_chars
        return None
