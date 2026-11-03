"""Per-language evaluation of tutor replies and course role-plays.

Usage (from backend/):
    .venv/Scripts/python -m evals.run_language_eval             # mock provider: checks the pipeline
    .venv/Scripts/python -m evals.run_language_eval --yes       # real model (spends API credit)
    .venv/Scripts/python -m evals.run_language_eval --only hi,ja --yes

Each case sends one learner message with the production system prompt and checks the reply
deterministically (see `evaluate`). Results are printed and saved to evals/results/.
"""

import argparse
import asyncio
import json
import sys
from datetime import UTC, datetime
from pathlib import Path

from app.ai.course_prompts import roleplay_system_prompt
from app.ai.llm.base import ChatMessage, LLMError, LLMProvider, TextDelta
from app.ai.llm.factory import get_llm
from app.ai.prompts import tutor_system_prompt
from app.ai.script_check import FUNCTION_WORDS, function_word_lead, script_share
from app.db.enums import CefrLevel, LearningLevel

HERE = Path(__file__).parent
MIN_SCRIPT_SHARE = 0.6  # leaves room for English technical terms in parentheses


def evaluate(kind: str, language: str, reply: str) -> dict:
    """Deterministic checks for one reply."""
    share = script_share(reply, language)
    checks = {
        "not_empty": bool(reply.strip()),
        "native_script": share >= MIN_SCRIPT_SHARE,
    }
    if language in FUNCTION_WORDS and language != "en":
        # Latin-script languages share a script with English; check the words too.
        checks["target_words"] = function_word_lead(reply, language) > 0
    if kind == "tutor":
        # Every tutor reply should end its explanation with an understanding check.
        checks["asks_question"] = any(mark in reply for mark in ("?", "？", "؟"))
    return {"script_share": round(share, 3), "checks": checks, "passed": all(checks.values())}


def build(case: dict, kind: str) -> tuple[str, str]:
    if kind == "tutor":
        system = tutor_system_prompt(
            level=LearningLevel(case["level"]),
            language=case["language"],
            interests=[],
            topic=case["topic"],
            plan=None,
        )
        return system, case["question"]
    system = roleplay_system_prompt(
        language=case["language"],
        level=CefrLevel(case["level"]),
        scenario=case["scenario"],
        interests=[],
        spoken=False,
    )
    return system, case["message"]


async def run_case(llm: LLMProvider, case: dict, kind: str) -> dict:
    system, message = build(case, kind)
    parts: list[str] = []
    try:
        async for event in llm.stream_chat(system=system, messages=[ChatMessage("user", message)]):
            if isinstance(event, TextDelta):
                parts.append(event.text)
    except LLMError as exc:
        return {"id": case["id"], "kind": kind, "error": exc.user_message, "passed": False}
    reply = "".join(parts)
    return {
        "id": case["id"],
        "kind": kind,
        "language": case["language"],
        **evaluate(kind, case["language"], reply),
        "reply": reply,
    }


async def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--yes", action="store_true", help="allow calls to a real (paid) model")
    parser.add_argument("--only", help="comma-separated language codes to run")
    args = parser.parse_args(argv)

    llm = get_llm()
    if not llm.is_mock and not args.yes:
        print("A real model is configured; this eval makes paid API calls. Re-run with --yes.")
        return 2
    cases = json.loads((HERE / "language_cases.json").read_text(encoding="utf-8"))
    only = set(args.only.split(",")) if args.only else None
    jobs = [
        (case, kind)
        for kind in ("tutor", "roleplay")
        for case in cases[kind]
        if only is None or case["language"] in only
    ]

    results = []
    for case, kind in jobs:  # sequential: gentle on rate limits
        result = await run_case(llm, case, kind)
        results.append(result)
        status = "PASS" if result["passed"] else "FAIL"
        detail = result.get("error") or (
            f"script {result['script_share']:.0%} "
            + " ".join(f"{k}={'ok' if v else 'no'}" for k, v in result["checks"].items())
        )
        print(f"{status}  {result['id']:<18} {detail}")

    passed = sum(r["passed"] for r in results)
    print(f"\n{passed}/{len(results)} passed · provider={llm.name} model={llm.model_for('tutor')}")
    if llm.is_mock:
        print(
            "Mock provider: replies are English placeholders, "
            "so non-English language checks are expected to fail."
        )

    out = HERE / "results"
    out.mkdir(exist_ok=True)
    stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    path = out / f"languages-{stamp}-{llm.name}.json"
    path.write_text(
        json.dumps(
            {"provider": llm.name, "model": llm.model_for("tutor"), "results": results},
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"Saved {path.relative_to(HERE.parent)}")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main(sys.argv[1:])))
