"""Source facts for video scripts, from Wikipedia, so the model writes from a reference.

MediaWiki Action API (`prop=extracts`), with the same descriptive User-Agent as picture search.
The text is reference data for the model, never instructions: see `sources_block`.
"""

import asyncio
import logging
import math
import re
from dataclasses import dataclass
from typing import Protocol

import httpx

from app.core.config import Settings

logger = logging.getLogger(__name__)

API_URL = "https://en.wikipedia.org/w/api.php"
MAX_ARTICLES = 2
# About 1000 tokens in all: Groq's free tier allows 8000 tokens a minute.
ARTICLE_CHARS = (3000, 1200)
ATTEMPTS = 3

_NUMBER = re.compile(r"\d[\d,]*(?:\.\d+)?")
_HEADING = re.compile(r"={2,}[^=]+={2,}")
# Where an article stops being prose: these sections are lists of links and citations.
_TAIL = re.compile(
    r"^={2,}\s*(see also|references|notes|footnotes|citations|sources|bibliography|"
    r"further reading|external links)\s*={2,}\s*$",
    re.IGNORECASE | re.MULTILINE,
)
_SENTENCE = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9])")
# Small whole numbers are mostly ordinary words ("3 steps"), not claims to check.
_SMALL = 12


@dataclass(frozen=True)
class Source:
    title: str
    url: str
    text: str


class FactFinder(Protocol):
    async def find(self, titles: list[str], topic: str = "") -> list[Source]: ...


def passages(article: str, topic: str, limit: int) -> str:
    """The article's opening, then the sentences most about the topic, in their original order.

    The facts a video needs are often deep in an article (water's bond angle isn't in the
    opening of "Water"), and a whole article is too long to send. A topic's rare words count
    for more than its common ones ("bent" over "water" in an article about water), a sentence
    is helped by a paragraph on the topic, and one stating a figure gets a bonus, since figures
    are what memory gets wrong most.
    """
    body = _TAIL.split(article, maxsplit=1)[0]
    paragraphs = [" ".join(_HEADING.sub(" ", line).split()) for line in body.split("\n")]
    paragraphs = [line for line in paragraphs if line]
    text = " ".join(paragraphs)
    if len(text) <= limit:
        return text

    sentences = [(i, s) for i, line in enumerate(paragraphs) for s in _SENTENCE.split(line)]
    opening, used = 0, 0
    while opening < len(sentences) and used < limit * 0.4:
        used += len(sentences[opening][1]) + 1
        opening += 1

    stems = {word[:5] for word in re.findall(r"[a-z]{4,}", topic.lower())}
    lowered = [s.lower() for _, s in sentences]
    weights = {
        stem: math.log(1 + len(sentences) / (1 + sum(stem in s for s in lowered))) for stem in stems
    }
    around = [sum(w for stem, w in weights.items() if stem in line.lower()) for line in paragraphs]

    def relevance(n: int) -> float:
        paragraph, sentence = sentences[n]
        if not around[paragraph]:
            return 0.0
        own = sum(w for stem, w in weights.items() if stem in lowered[n])
        return own + 0.5 * around[paragraph] + (1.0 if numbers_in(sentence) else 0.0)

    chosen = []
    for n in sorted(range(opening, len(sentences)), key=relevance, reverse=True):
        size = len(sentences[n][1]) + 1
        if relevance(n) > 0 and used + size <= limit:
            chosen.append(n)
            used += size
    return " ".join(sentences[n][1] for n in [*range(opening), *sorted(chosen)])[:limit]


def sources_block(sources: list[Source]) -> str:
    """The reference text as it goes into a prompt, marked as data."""
    return "\n".join(f'<source title="{s.title}">\n{s.text}\n</source>' for s in sources)


def numbers_in(text: str) -> set[str]:
    """Numbers in `text` that are specific enough to be checked (years, figures, 104.5)."""
    found = set()
    for raw in _NUMBER.findall(text):
        number = raw.replace(",", "").rstrip(".")
        if number and float(number) > _SMALL:
            found.add(number)
    return found


def unsupported_numbers(text: str, sources: list[Source]) -> list[str]:
    """Numbers the script states that no source contains: the likeliest invented facts."""
    known = numbers_in(" ".join(s.text for s in sources))
    return sorted(numbers_in(text) - known)


def supported_numbers(text: str, sources: list[Source]) -> list[str]:
    """Numbers the script states that a source confirms: the specific, checkable facts."""
    known = numbers_in(" ".join(s.text for s in sources))
    return sorted(numbers_in(text) & known)


class WikipediaFacts:
    def __init__(self, settings: Settings, transport: httpx.AsyncBaseTransport | None = None):
        self.user_agent = (
            f"AITutorDashboard/0.1 ({settings.media_contact}) httpx/{httpx.__version__}"
        )
        self.transport = transport

    async def find(self, titles: list[str], topic: str = "") -> list[Source]:
        sources: list[Source] = []
        async with httpx.AsyncClient(
            headers={"User-Agent": self.user_agent}, timeout=30, transport=self.transport
        ) as client:
            for title in titles[:MAX_ARTICLES]:
                limit = ARTICLE_CHARS[len(sources)]
                source = await self._article(client, title, limit, topic or title)
                if source and source.url not in {s.url for s in sources}:
                    sources.append(source)
        return sources

    async def _article(
        self, client: httpx.AsyncClient, title: str, limit: int, topic: str
    ) -> Source | None:
        # The exact title first; a search for it if no such article exists.
        for params in (
            {"titles": title},
            {"generator": "search", "gsrsearch": title, "gsrlimit": "1"},
        ):
            page = await self._query(client, params)
            if page and (page.get("extract") or "").strip():
                text = passages(page["extract"], topic, limit)
                return Source(page["title"], page.get("fullurl", ""), text)
        return None

    async def _query(self, client: httpx.AsyncClient, params: dict) -> dict | None:
        for attempt in range(ATTEMPTS):
            try:
                resp = await client.get(
                    API_URL,
                    params={
                        "action": "query",
                        "format": "json",
                        "formatversion": "2",
                        "prop": "extracts|info",
                        "inprop": "url",
                        "explaintext": "1",
                        "exlimit": "1",
                        "redirects": "1",
                        **params,
                    },
                )
                resp.raise_for_status()
                pages = resp.json().get("query", {}).get("pages", [])
                usable = [p for p in pages if not p.get("missing")]
                return usable[0] if usable else None
            except (httpx.HTTPError, ValueError) as exc:
                logger.warning("Wikipedia lookup failed (attempt %d): %s", attempt + 1, exc)
                await asyncio.sleep(attempt + 1)
        return None
