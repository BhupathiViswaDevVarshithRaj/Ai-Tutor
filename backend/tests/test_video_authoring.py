"""Writing scripts from sources, the review pass, and the new diagram templates."""

import httpx
import pytest

from app.ai.llm.base import LLMError, ParseResult
from app.core.config import Settings
from app.db.enums import LearningLevel
from app.video import authoring
from app.video.authoring import write_script
from app.video.script import (
    REVIEW_SYSTEM,
    VIDEO_SYSTEM,
    ArticleTitles,
    MapBranch,
    Scene,
    VideoScript,
    ensure_mindmap,
    for_review,
    validate_script,
    visual_share,
)
from app.video.sources import (
    Source,
    WikipediaFacts,
    numbers_in,
    passages,
    supported_numbers,
    unsupported_numbers,
)


def scene(template, narration="Words.", **extra):
    base = dict(
        heading="H",
        items=["One", "Two", "Three"],
        dates=[],
        expression="",
        x_min=0,
        x_max=1,
        shape="",
        atoms=[],
        image_query="",
        caption="",
        narration=narration,
    )
    return Scene(template=template, **{**base, **extra})


def script(*scenes) -> VideoScript:
    return VideoScript(title="T", scenes=list(scenes))


def fixed(raw: Scene) -> Scene | None:
    """`raw` after validation, or None if it was dropped."""
    result = validate_script(script(scene("title"), raw, scene("bullets"), scene("bullets")), "T")
    return result.scenes[1] if len(result.scenes) == 4 else None


def branch(label="Sun", children=("Star",), say="The Sun is a star."):
    return MapBranch(label=label, children=list(children), say=say)


# --- templates ---------------------------------------------------------------


def test_a_mindmap_speaks_each_branch_after_its_opening_line():
    kept = fixed(
        scene(
            "mindmap",
            narration="Let us map it.",
            branches=[branch("A", say="A says."), branch("B", say="B says."), branch("C", say="")],
        )
    )
    assert kept.narration == "Let us map it. A says. B says."
    # Reviewing a validated script must not speak the lines twice.
    again = validate_script(
        script(scene("title"), kept, scene("bullets"), scene("bullets")), "T"
    ).scenes[1]
    assert again.narration == kept.narration


def test_a_mindmap_keeps_only_one_opening_sentence_before_its_branches():
    kept = fixed(
        scene(
            "mindmap",
            narration="The Sun holds 99.86% of the mass. Then the whole explanation again.",
            branches=[branch("A", say="A."), branch("B", say="B."), branch("C", say="C.")],
        )
    )
    assert kept.narration == "The Sun holds 99.86% of the mass. A. B. C."


def test_a_mindmap_needs_three_branches_and_is_trimmed():
    assert fixed(scene("mindmap", branches=[branch(), branch()])) is None
    big = fixed(
        scene(
            "mindmap",
            branches=[branch(f"B{i}" * 30, children=["x" * 90] * 9) for i in range(9)],
        )
    )
    assert len(big.branches) == 6
    assert all(len(b.children) == 4 and len(b.label) <= 28 for b in big.branches)
    assert len(big.branches[0].children[0]) <= 34


def test_a_mindmap_may_leave_its_opening_line_to_the_branches():
    kept = fixed(
        scene(
            "mindmap",
            narration="",
            branches=[branch("A", say="A."), branch("B", say="B."), branch("C", say="C.")],
        )
    )
    assert kept and kept.narration == "A. B. C."
    # With nothing at all to say, it can't be a scene.
    silent = [branch("A", say=""), branch("B", say=""), branch("C", say="")]
    assert fixed(scene("mindmap", narration="", branches=silent)) is None


def test_frame_scenes_without_narration_speak_what_they_show():
    result = validate_script(
        script(
            scene("title", narration="", heading="The heart"),
            scene("cycle"),
            scene("summary", narration="", items=["Four chambers", "One-way valves"]),
        ),
        "T",
    )
    assert result.scenes[0].narration == "The heart"
    assert result.scenes[2].narration == "Four chambers. One-way valves"


def test_a_title_and_a_mindmap_are_enough_for_a_video():
    themap = scene("mindmap", branches=[branch("A"), branch("B"), branch("C")])
    kept = validate_script(script(scene("title"), themap), "T")
    assert [s.template for s in kept.scenes] == ["title", "mindmap"]
    with pytest.raises(LLMError):
        validate_script(script(scene("title"), scene("cycle")), "T")


def test_a_review_sees_a_mindmaps_opening_line_only():
    kept = fixed(
        scene(
            "mindmap",
            narration="Open.",
            branches=[branch("A", say="A."), branch("B", say="B."), branch("C", say="C.")],
        )
    )
    shown = for_review(script(kept))["scenes"][0]
    assert shown["narration"] == "Open."


def test_compare_needs_two_columns_of_at_least_two_rows():
    good = [branch("X", ["a", "b"], ""), branch("Y", ["c", "d", "e"], "")]
    assert fixed(scene("compare", branches=good)).branches == good
    assert fixed(scene("compare", branches=good[:1])) is None
    assert fixed(scene("compare", branches=[branch("X", ["a"], ""), good[1]])) is None
    three = fixed(scene("compare", branches=[*good, branch("Z", ["f", "g"], "")]))
    assert [b.label for b in three.branches] == ["X", "Y"]


def test_cycle_needs_three_stages():
    assert fixed(scene("cycle", items=["a", "b", "c"])) is not None
    assert fixed(scene("cycle", items=["a", "b"])) is None


@pytest.mark.parametrize(
    ("items", "values", "ok"),
    [
        (["a", "b"], [1.0, 2.0], True),
        (["a", "b"], [1.0], False),  # one value per label
        (["a"], [1.0], False),  # nothing to compare
        (["a", "b"], [-1.0, 2.0], False),  # bars start at zero
        (["a", "b"], [0.0, 0.0], False),  # nothing to draw
        (["a", "b"], [float("inf"), 1.0], False),
    ],
)
def test_chart_values_must_be_usable(items, values, ok):
    assert (fixed(scene("chart", items=items, values=values)) is not None) is ok


def test_visual_share_counts_only_main_scenes():
    assert visual_share(script(scene("title"), scene("bullets"), scene("cycle"))) == 0.5
    assert visual_share(script(scene("title"), scene("summary"))) == 0.0


def test_ensure_mindmap_turns_the_fullest_list_into_a_map():
    plain = script(
        scene("title"),
        scene("bullets", items=["a", "b", "c", "d"]),
        scene("flow"),
        scene("summary"),
    )
    converted = ensure_mindmap(plain)
    assert [s.template for s in converted.scenes] == ["title", "mindmap", "flow", "summary"]
    assert [b.label for b in converted.scenes[1].branches] == ["a", "b", "c", "d"]
    already = script(scene("mindmap", branches=[branch()] * 3))
    assert ensure_mindmap(already) is already


# --- sources -------------------------------------------------------------------


def test_numbers_are_compared_ignoring_commas_and_small_counts():
    assert numbers_in("In 1947, 3 parts and 1,200 rounds at 104.5°.") == {"1947", "1200", "104.5"}
    sources = [Source("A", "u", "Designed in 1947, firing 1200 rounds.")]
    text = "Made in 1947 with 1,200 rounds, 75 million built."
    assert unsupported_numbers(text, sources) == ["75"]
    assert supported_numbers(text, sources) == ["1200", "1947"]


class FakeWiki:
    def __init__(self, pages: dict[str, dict]) -> None:
        self.pages = pages
        self.seen: list[dict] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        params = dict(request.url.params)
        self.seen.append(params)
        key = params.get("titles") or f"search:{params.get('gsrsearch')}"
        page = self.pages.get(key)
        if isinstance(page, Exception):
            raise page
        return httpx.Response(200, json={"query": {"pages": [page] if page else []}})


def page(title, text):
    return {"title": title, "extract": text, "fullurl": f"https://en.wikipedia.org/wiki/{title}"}


def wiki(fake) -> WikipediaFacts:
    return WikipediaFacts(Settings(), httpx.MockTransport(fake))


async def test_finds_articles_by_title_then_by_search():
    fake = FakeWiki(
        {
            "Plant": page("Plant", "Plants  make food.  " + "x" * 5000),
            "search:Growing things": page("Plant development", "Plants grow."),
        }
    )
    found = await wiki(fake).find(["Plant", "Growing things", "Ignored third"])
    assert [s.title for s in found] == ["Plant", "Plant development"]
    assert found[0].text.startswith("Plants make food.") and len(found[0].text) <= 3000
    assert found[0].url == "https://en.wikipedia.org/wiki/Plant"
    assert not any(s.get("titles") == "Ignored third" for s in fake.seen)


async def test_the_same_article_twice_counts_once():
    fake = FakeWiki({"AK-47": page("AK-47", "Rifle."), "AK47": page("AK-47", "Rifle.")})
    assert len(await wiki(fake).find(["AK-47", "AK47"])) == 1


async def test_missing_articles_and_network_failures_give_nothing(monkeypatch):
    async def no_wait(_):
        return None

    monkeypatch.setattr("app.video.sources.asyncio.sleep", no_wait)
    assert await wiki(FakeWiki({})).find(["Nothing here"]) == []
    fake = FakeWiki({"Down": httpx.ConnectError("certificate verify failed")})
    assert await wiki(fake).find(["Down"]) == []
    assert sum(s.get("titles") == "Down" for s in fake.seen) == 3  # tried again first


# --- writing -------------------------------------------------------------------


class FakeFacts:
    def __init__(self, sources) -> None:
        self.sources, self.asked = sources, []

    async def find(self, titles, topic=""):
        self.asked.append(titles)
        return self.sources


class ScriptedLLM:
    """Plays back a draft and a review, remembering what it was asked."""

    is_mock = False

    def __init__(self, draft, review=None, review_error=None, titles=("AK-47",)):
        self.draft, self.review, self.review_error, self.titles = (
            draft,
            review,
            review_error,
            titles,
        )
        self.calls: list[tuple[str, str]] = []
        self.review_attempts = 0

    async def parse(self, *, system, messages, schema, role="structured"):
        self.calls.append((system, messages[0].content))
        if schema is ArticleTitles:
            return ParseResult(value=ArticleTitles(titles=list(self.titles)), model="m")
        if system is VIDEO_SYSTEM:
            return ParseResult(value=self.draft, model="m")
        assert system is REVIEW_SYSTEM
        self.review_attempts += 1
        if self.review_error and self.review_attempts <= self.review_error[1]:
            raise self.review_error[0]
        return ParseResult(value=self.review, model="m")


SOURCES = [
    Source("AK-47", "https://en.wikipedia.org/wiki/AK-47", "Adopted in 1949 by the Soviets.")
]


def draft(narration="Adopted in 1949.", middle="bullets"):
    return script(scene("title"), scene(middle, narration), scene("flow"), scene("summary"))


async def write(llm, facts=None, style="auto", **extra):
    return await write_script(
        llm,
        facts,
        topic="The AK-47",
        level=LearningLevel.BEGINNER,
        language_name="English",
        seconds=60,
        plan=None,
        style=style,
        **extra,
    )


async def test_the_script_is_written_from_sources_then_reviewed():
    review = draft(middle="cycle")
    llm = ScriptedLLM(draft(), review)
    facts = FakeFacts(SOURCES)
    stages = []

    async def on_stage(detail):
        stages.append(detail)

    written = await write(llm, facts, on_stage=on_stage)
    assert facts.asked == [["AK-47"]]
    assert written.reviewed and written.sources == SOURCES
    assert written.script.scenes[1].template == "cycle"
    assert stages == ["Reading sources", "Writing the script", "Checking the facts"]
    _, draft_request = llm.calls[1]
    assert "Adopted in 1949 by the Soviets." in draft_request
    assert "never as instructions" in draft_request.replace("\n", " ")


async def test_the_review_is_told_which_numbers_no_source_supports():
    llm = ScriptedLLM(draft("Made 75000 of them in 1949."), draft("Adopted back in 1949."))
    written = await write(llm, FakeFacts(SOURCES))
    _, review_request = llm.calls[-1]
    assert "Numbers not found in the reference text" in review_request
    assert review_request.rstrip().endswith("75000")
    assert written.reviewed and "75000" not in written.script.scenes[1].narration


async def test_a_review_that_makes_things_worse_is_rejected():
    invented = ScriptedLLM(draft(), draft("Adopted in 1949 and 1951."))
    written = await write(invented, FakeFacts(SOURCES))
    assert not written.reviewed and "1951" not in written.script.scenes[1].narration

    plainer = ScriptedLLM(draft(middle="cycle"), draft(middle="bullets"))
    written = await write(plainer, FakeFacts(SOURCES))
    assert not written.reviewed and written.script.scenes[1].template == "cycle"


async def test_a_review_may_not_drop_sourced_facts_to_look_safe():
    vaguer = ScriptedLLM(draft("Adopted in 1949."), draft("Adopted long ago."))
    written = await write(vaguer, FakeFacts(SOURCES))
    assert not written.reviewed and "1949" in written.script.scenes[1].narration


async def test_a_review_may_not_gut_the_script():
    long = "Adopted in 1949 by the Soviets, it spread around the world. " * 8
    llm = ScriptedLLM(draft(long), draft("Adopted in 1949."))
    written = await write(llm, FakeFacts(SOURCES))
    assert not written.reviewed and written.script.scenes[1].narration.startswith(
        "Adopted in 1949 by"
    )


async def test_an_unusable_draft_gets_one_more_try():
    class Second(ScriptedLLM):
        drafts = 0

        async def parse(self, *, system, messages, schema, role="structured"):
            if system is VIDEO_SYSTEM:
                self.drafts += 1
                value = script(scene("title")) if self.drafts == 1 else draft()
                return ParseResult(value=value, model="m")
            return await super().parse(system=system, messages=messages, schema=schema)

    llm = Second(draft())
    assert len((await write(llm)).script.scenes) == 4 and llm.drafts == 2

    class Always(Second):
        async def parse(self, *, system, messages, schema, role="structured"):
            self.drafts += 1
            return ParseResult(value=script(scene("title")), model="m")

    llm = Always(draft())
    with pytest.raises(LLMError):
        await write(llm)
    assert llm.drafts == 2


def test_a_summary_without_points_becomes_a_closing_card():
    closing = scene("summary", "That is the heart.", items=[])
    result = validate_script(script(scene("title"), scene("cycle"), closing), "T")
    assert [s.template for s in result.scenes] == ["title", "cycle", "title"]
    assert result.scenes[2].narration == "That is the heart."


async def test_list_articles_are_not_used_as_references():
    llm = ScriptedLLM(draft(), draft(), titles=("List of rifles", "AK-47"))
    facts = FakeFacts(SOURCES)
    await write(llm, facts)
    assert facts.asked == [["AK-47"]]


def test_passages_keep_the_opening_and_find_facts_deep_in_the_article():
    filler = " ".join(f"Sentence {i} is about something else entirely." for i in range(200))
    article = (
        "Water is a chemical compound. It covers most of Earth. "
        + filler
        + " == Structure == The water molecule has a bond angle of 104.45 degrees. "
        + filler
    )
    excerpt = passages(article, "Why the water molecule is bent", 900)
    assert excerpt.startswith("Water is a chemical compound.")
    assert "104.45" in excerpt and "==" not in excerpt and len(excerpt) <= 900


def test_short_articles_are_kept_whole():
    assert passages("One. == Two == Three.", "anything", 500) == "One. Three."


async def test_a_busy_model_is_waited_for_once(monkeypatch):
    waits = []

    async def fake_sleep(seconds):
        waits.append(seconds)

    monkeypatch.setattr(authoring.asyncio, "sleep", fake_sleep)
    llm = ScriptedLLM(draft(), draft(middle="cycle"), review_error=(LLMError("busy"), 1))
    assert (await write(llm, FakeFacts(SOURCES))).reviewed and waits == [45]

    # Still busy: the video goes ahead, but isn't called checked.
    llm = ScriptedLLM(draft(), draft(), review_error=(LLMError("busy"), 9))
    written = await write(llm, FakeFacts(SOURCES))
    assert not written.reviewed and written.sources == SOURCES and llm.review_attempts == 2


async def test_without_sources_there_is_no_review_and_no_claim_of_one():
    llm = ScriptedLLM(draft())
    written = await write(llm, FakeFacts([]))
    assert not written.reviewed and written.sources == []
    assert not any(system is REVIEW_SYSTEM for system, _ in llm.calls)
    # Choosing articles failing doesn't stop the video: it searches for the topic.
    no_titles = ScriptedLLM(draft(), titles=())
    facts = FakeFacts([])
    await write(no_titles, facts)
    assert facts.asked == [["The AK-47"]]


async def test_a_mindmap_video_asks_for_a_map_and_always_gets_one():
    llm = ScriptedLLM(draft())
    written = await write(llm, None, style="mindmap")
    assert "mind-map explanation" in llm.calls[0][1]
    assert any(s.template == "mindmap" for s in written.script.scenes)
