"""Scores video scripts on accuracy and visuals, so changes can be measured, not guessed.

Usage (from backend/):
    .venv/Scripts/python -m evals.run_video_eval --mode draft --yes   # the model alone
    .venv/Scripts/python -m evals.run_video_eval --mode full --yes    # sources + review pass
    .venv/Scripts/python -m evals.run_video_eval --rescore FILE       # re-mark a saved run

`--yes` is required: each case spends real Groq quota (about 4000-8000 tokens). Cases are paced
to stay inside the free tier's 8000 tokens a minute. Results go to evals/results/.

Checks are deterministic. Each case's whole Wikipedia article is a fixed yardstick, the same in
every mode. "Unsupported" numbers aren't in it, so are the likeliest inventions; "supported"
ones are specific facts it confirms. Read them together: a script can score zero unsupported by
being vague, which is why a script's real text should still be read before trusting a score.
"""

import argparse
import asyncio
import json
import re
import sys
from datetime import UTC, datetime
from pathlib import Path

import httpx

from app.ai.llm.base import ChatMessage, LLMError
from app.ai.llm.factory import get_video_llm
from app.core.config import get_settings
from app.db.enums import LearningLevel
from app.video.script import VIDEO_SYSTEM, VideoScript, validate_script, video_request
from app.video.sources import Source, WikipediaFacts, supported_numbers, unsupported_numbers

HERE = Path(__file__).parent
TEXT_ONLY = {"bullets"}
FRAME = {"title", "summary"}  # every video has these; they don't count either way


def script_text(script: VideoScript) -> str:
    parts = []
    for s in script.scenes:
        parts += [s.heading, s.caption, s.narration, *s.items, *s.dates]
        for branch in getattr(s, "branches", []) or []:
            parts += [branch.label, branch.say, *branch.children]
    return " ".join(parts)


def score(case: dict, script: VideoScript, yardstick: list) -> dict:
    text = script_text(script)
    templates = [s.template for s in script.scenes]
    body = [t for t in templates if t not in FRAME]
    hits = [f for f in case["facts"] if re.search(f, text, re.IGNORECASE)]
    return {
        "topic": case["topic"],
        "templates": templates,
        "visual_share": round(sum(t not in TEXT_ONLY for t in body) / max(len(body), 1), 2),
        "kinds_of_visual": len({t for t in body if t not in TEXT_ONLY}),
        "right_template": any(t in templates for t in case["any_template"]),
        "facts_hit": f"{len(hits)}/{len(case['facts'])}",
        "facts_score": round(len(hits) / len(case["facts"]), 2),
        "missing_facts": [f for f in case["facts"] if f not in hits],
        "unsupported_numbers": unsupported_numbers(text, yardstick),
        "supported_numbers": supported_numbers(text, yardstick),
        "middle_scenes": len(body),
    }


async def write(mode: str, llm, facts, topic: str) -> tuple[VideoScript, dict]:
    if mode == "draft":
        result = await llm.parse(
            system=VIDEO_SYSTEM,
            messages=[
                ChatMessage(
                    "user",
                    video_request(
                        topic=topic,
                        level=LearningLevel.BEGINNER,
                        language_name="English",
                        seconds=60,
                        plan=None,
                    ),
                )
            ],
            schema=VideoScript,
        )
        return validate_script(result.value, topic), {}
    from app.video.authoring import write_script  # noqa: PLC0415 - only exists in full mode

    written = await write_script(
        llm,
        facts,
        topic=topic,
        level=LearningLevel.BEGINNER,
        language_name="English",
        seconds=60,
        plan=None,
    )
    return written.script, {
        "sources": [s.title for s in written.sources],
        "reviewed": written.reviewed,
    }


async def whole_article(title: str) -> list[Source]:
    """The yardstick: a case's entire article, however long."""
    facts = WikipediaFacts(get_settings())
    async with httpx.AsyncClient(headers={"User-Agent": facts.user_agent}, timeout=30) as client:
        page = await facts._query(client, {"titles": title})
    return [Source(title, "", page["extract"])] if page else []


def summarise(rows: list[dict], mode: str) -> dict:
    done = [r for r in rows if "error" not in r]
    n = max(len(done), 1)
    return {
        "mode": mode,
        "cases": len(rows),
        "failed": len(rows) - len(done),
        "avg_visual_share": round(sum(r["visual_share"] for r in done) / n, 2),
        "avg_kinds_of_visual": round(sum(r["kinds_of_visual"] for r in done) / n, 2),
        "avg_facts_score": round(sum(r["facts_score"] for r in done) / n, 2),
        "right_template": sum(r["right_template"] for r in done),
        "unsupported_numbers": sum(len(r["unsupported_numbers"]) for r in done),
        "supported_numbers": sum(len(r["supported_numbers"]) for r in done),
    }


async def rescore(path: str, cases: list[dict]) -> int:
    """Mark a saved run again with the current checks. Calls no model."""
    data = json.loads((HERE / "results" / path).read_text(encoding="utf-8"))
    by_topic = {c["topic"]: c for c in cases}
    rows = []
    for old in data["rows"]:
        if "error" in old or old["topic"] not in by_topic:
            continue
        case = by_topic[old["topic"]]
        rows.append(score(case, VideoScript(**old["script"]), await whole_article(case["article"])))
    print(json.dumps(summarise(rows, f"rescored {path}")))
    return 0


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["draft", "full"], default="full")
    parser.add_argument("--only", help="comma-separated words matched against topics")
    parser.add_argument("--pause", type=int, default=None, help="seconds between cases")
    parser.add_argument("--label", default="", help="added to the results file name")
    parser.add_argument("--yes", action="store_true", help="really call the model")
    parser.add_argument("--rescore", help="a results file to re-mark, without calling the model")
    args = parser.parse_args()
    if not args.yes and not args.rescore:
        print("Add --yes to run: this spends real Groq quota.")
        return 2
    sys.stdout.reconfigure(encoding="utf-8")

    cases = json.loads((HERE / "video_cases.json").read_text(encoding="utf-8"))
    if args.rescore:
        return await rescore(args.rescore, cases)
    if args.only:
        words = [w.strip().lower() for w in args.only.split(",")]
        cases = [c for c in cases if any(w in c["topic"].lower() for w in words)]
    pause = args.pause if args.pause is not None else (35 if args.mode == "draft" else 65)

    llm, facts = get_video_llm(), WikipediaFacts(get_settings())
    rows = []
    for i, case in enumerate(cases):
        if i:
            await asyncio.sleep(pause)
        yardstick = await whole_article(case["article"])
        try:
            script, extra = await write(args.mode, llm, facts, case["topic"])
        except LLMError as exc:
            rows.append({"topic": case["topic"], "error": exc.user_message})
            print(f"FAILED {case['topic']}: {exc.user_message}", flush=True)
            continue
        row = {**score(case, script, yardstick), **extra, "script": script.model_dump()}
        rows.append(row)
        print(
            f"{case['topic'][:32]:32} visual {row['visual_share']:.2f} "
            f"facts {row['facts_hit']} fit {'yes' if row['right_template'] else 'no ':3} "
            f"unsupported {len(row['unsupported_numbers'])} "
            f"supported {len(row['supported_numbers'])} {row['templates']} "
            f"{extra or ''}",
            flush=True,
        )

    summary = summarise(rows, args.mode)
    print("\nSUMMARY", json.dumps(summary))
    out = HERE / "results"
    out.mkdir(exist_ok=True)
    stamp = datetime.now(UTC).strftime("%Y%m%d-%H%M%S")
    name = f"video-{args.mode}{'-' + args.label if args.label else ''}-{stamp}.json"
    (out / name).write_text(
        json.dumps({"summary": summary, "rows": rows}, ensure_ascii=False, indent=1),
        encoding="utf-8",
    )
    print("saved", name)
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
