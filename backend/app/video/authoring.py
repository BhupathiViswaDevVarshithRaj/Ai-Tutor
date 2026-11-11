"""Writing a video script: look up sources, draft from them, then review the draft.

The model can't be trained from here, so accuracy comes from what surrounds it: it writes from
reference text instead of memory, and a second pass corrects the draft, told by plain code which
numbers no source supports. Every step is optional: if a lookup or the review fails (the free
tier's rate limit, a network problem), the video still gets made and isn't claimed as checked.
"""

import asyncio
import json
import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass

from app.ai.llm.base import ChatMessage, LLMError, LLMProvider
from app.db.enums import LearningLevel
from app.video.script import (
    ARTICLES_SYSTEM,
    REVIEW_SYSTEM,
    VIDEO_SYSTEM,
    ArticleTitles,
    VideoScript,
    ensure_mindmap,
    for_review,
    script_text,
    validate_script,
    video_request,
    visual_share,
)
from app.video.sources import (
    FactFinder,
    Source,
    sources_block,
    supported_numbers,
    unsupported_numbers,
)

logger = logging.getLogger(__name__)

# The review comes right after the draft and can hit the per-minute limit: wait it out once.
REVIEW_RETRY_SECONDS = 45
# A review corrects a script; one that cuts it to well under this share has gutted it.
MIN_REVIEW_LENGTH = 0.7
DRAFT_ATTEMPTS = 2


@dataclass
class WrittenScript:
    script: VideoScript
    sources: list[Source]
    reviewed: bool  # a review against the sources was accepted


Stage = Callable[[str], Awaitable[None]]


async def _nothing(_: str) -> None:
    return None


async def _find_sources(llm: LLMProvider, facts: FactFinder, topic: str) -> list[Source]:
    try:
        result = await llm.parse(
            system=ARTICLES_SYSTEM,
            messages=[ChatMessage("user", f"Topic: {topic}")],
            schema=ArticleTitles,
        )
        # A "List of ..." opens with no explanation, so it makes a poor reference.
        chosen = [t for t in result.value.titles if not t.lower().startswith("list of")]
        titles = chosen or [topic]
    except LLMError as exc:
        logger.warning("couldn't choose articles: %s", exc.user_message)
        titles = [topic]
    return await facts.find(titles, topic)


async def _draft(llm: LLMProvider, request: str, topic: str) -> VideoScript:
    """The first draft; a script too broken to use gets one more try before the video fails."""
    message = ChatMessage("user", request)
    for attempt in range(DRAFT_ATTEMPTS):
        result = await llm.parse(system=VIDEO_SYSTEM, messages=[message], schema=VideoScript)
        try:
            return validate_script(result.value, topic)
        except LLMError:
            logger.warning("unusable draft (attempt %d)", attempt + 1)
            if attempt == DRAFT_ATTEMPTS - 1:
                raise
    raise AssertionError("unreachable")


def _spoken(script: VideoScript) -> int:
    return sum(len(s.narration) for s in script.scenes)


def _review_request(script: VideoScript, request: str, sources: list[Source]) -> str:
    missing = unsupported_numbers(script_text(script), sources)
    lines = [request.removesuffix("Write the video script."), "Draft script:"]
    lines.append(json.dumps(for_review(script), ensure_ascii=False))
    if missing:
        lines.append(
            "Numbers not found in the reference text (the excerpt is short, so some may still be "
            "right; correct or remove only those you can't confirm): " + ", ".join(missing)
        )
    return "\n".join(lines)


async def _reviewed(
    llm: LLMProvider, draft: VideoScript, request: str, sources: list[Source], topic: str
) -> VideoScript | None:
    """The corrected script, or None if there's no improvement to accept."""
    message = ChatMessage("user", _review_request(draft, request, sources))
    for attempt in range(2):
        try:
            result = await llm.parse(system=REVIEW_SYSTEM, messages=[message], schema=VideoScript)
            review = validate_script(result.value, topic)
        except LLMError as exc:
            logger.warning("review failed (attempt %d): %s", attempt + 1, exc.user_message)
            if attempt == 0 and exc.retryable:
                await asyncio.sleep(REVIEW_RETRY_SECONDS)
                continue
            return None
        # Accept it unless it made things worse by the two measures code can check.
        before, after = script_text(draft), script_text(review)
        worse_facts = len(unsupported_numbers(after, sources)) > len(
            unsupported_numbers(before, sources)
        )
        # Removing every figure would "pass" that check: sourced facts have to survive too.
        lost_facts = len(supported_numbers(after, sources)) < len(
            supported_numbers(before, sources)
        )
        shrunk = _spoken(review) < _spoken(draft) * MIN_REVIEW_LENGTH
        if worse_facts or lost_facts or shrunk or visual_share(review) < visual_share(draft):
            logger.info("review rejected: it was no better than the draft")
            return None
        return review
    return None


async def write_script(
    llm: LLMProvider,
    facts: FactFinder | None,
    *,
    topic: str,
    level: LearningLevel,
    language_name: str,
    seconds: int,
    plan: dict | None,
    style: str = "auto",
    on_stage: Stage = _nothing,
) -> WrittenScript:
    sources: list[Source] = []
    if facts:
        await on_stage("Reading sources")
        sources = await _find_sources(llm, facts, topic)

    await on_stage("Writing the script")
    request = video_request(
        topic=topic,
        level=level,
        language_name=language_name,
        seconds=seconds,
        plan=plan,
        sources=sources_block(sources),
        style=style,
    )
    script = await _draft(llm, request, topic)

    reviewed = False
    if sources:
        await on_stage("Checking the facts")
        review = await _reviewed(llm, script, request, sources, topic)
        if review:
            script, reviewed = review, True
    if style == "mindmap":
        script = ensure_mindmap(script)
    return WrittenScript(script=script, sources=sources, reviewed=reviewed)
