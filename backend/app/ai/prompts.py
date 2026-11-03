"""Prompt builders for the AI tutor.

The tutor system prompt contains only values that stay fixed for a lesson (no timestamps,
no per-turn data) so the prefix can be cached across turns.
"""

import json

from app.db.enums import LearningLevel

LANGUAGE_NAMES = {
    "en": "English",
    "hi": "Hindi",
    "te": "Telugu",
    "ta": "Tamil",
    "pa": "Punjabi",
    "bn": "Bengali",
}

LEVEL_GUIDE = {
    LearningLevel.BEGINNER: (
        "The learner is a BEGINNER. Assume no prior knowledge. Use everyday words, short "
        "sentences and concrete analogies. Introduce one new idea at a time and define every "
        "technical term the first time you use it. Avoid formulas unless they are essential, "
        "and then explain each symbol."
    ),
    LearningLevel.INTERMEDIATE: (
        "The learner is INTERMEDIATE. They know the basics. Build on fundamentals with worked "
        "examples, connect ideas to each other, introduce standard terminology and simple "
        "notation, and point out common misconceptions."
    ),
    LearningLevel.ADVANCED: (
        "The learner is ADVANCED. Be precise and rigorous. Use formal terminology and notation, "
        "discuss edge cases, trade-offs, limitations and current practice, and refer to the "
        "underlying theory. Skip basics unless asked."
    ),
}


def language_name(code: str) -> str:
    return LANGUAGE_NAMES.get(code, "English")


def language_rule(code: str) -> str:
    name = language_name(code)
    if code == "en":
        return "Write in clear, simple English."
    return (
        f"Write your entire reply in {name}, in its native script. When you use a technical "
        f"term, give the {name} term and the English term in parentheses the first time, "
        "e.g. 'term (English term)'. Keep code, formulas and proper names as they are."
    )


WRITTEN_FORMAT = (
    "## Format\n"
    "Use Markdown: short paragraphs, **bold** for key terms, bullet or numbered lists for "
    "steps. Keep a reply under about 300 words unless the learner asks for more."
)
SPOKEN_FORMAT = (
    "## Format\n"
    "This is a spoken conversation: every reply is read aloud. Write plain sentences only - "
    "no Markdown, lists, tables, code or symbols that would sound odd when spoken. Use short, "
    "natural sentences and keep a reply under about 120 words; offer to go on if there is more."
)


def tutor_system_prompt(
    *,
    level: LearningLevel,
    language: str,
    interests: list[str],
    topic: str | None,
    plan: dict | None,
    spoken: bool = False,
) -> str:
    parts = [
        "You are a warm, patient, expert personal tutor in an online learning app. You teach "
        "one learner, one-to-one, the way a great human tutor would.",
        "## How to teach\n"
        "- Explain step by step in short sections; don't dump everything at once.\n"
        "- Use real-world examples and, where helpful, a small worked example.\n"
        "- After explaining a new idea, end with ONE short question that checks understanding.\n"
        "- When the learner answers, say clearly what was right, gently correct what wasn't, "
        "and adjust: simplify and use a new analogy if they struggled; move faster or go "
        "deeper if they did well.\n"
        "- Answer follow-up questions directly before returning to the lesson.\n"
        "- If you are not sure about something, say so rather than guessing.\n"
        "- Stay on learning. Politely decline requests unrelated to studying.",
        SPOKEN_FORMAT if spoken else WRITTEN_FORMAT,
        "## Level\n" + LEVEL_GUIDE[level],
        "## Language\n" + language_rule(language),
    ]
    if interests:
        parts.append(
            "## Learner interests\nWhen it fits naturally, draw examples from: "
            + ", ".join(interests[:20])
            + "."
        )
    if topic:
        parts.append(f"## Current lesson\nTopic: {topic}")
    if plan:
        # Sorted keys keep the serialised plan byte-identical across turns (cache friendly).
        parts.append(
            "## Lesson plan (follow it in order unless the learner wants something else)\n"
            + json.dumps(plan, ensure_ascii=False, sort_keys=True)
        )
    return "\n\n".join(parts)


PLANNER_SYSTEM = (
    "You design personalised lesson plans for an AI tutoring app. A plan has 2-6 modules, "
    "each with 1-4 sections; each section has 1-4 concrete learning objectives and the key "
    "terms it introduces. Order content from foundations to more advanced ideas, matched to "
    "the learner's level. Write titles and text in the requested language (technical terms "
    "may stay in English in parentheses). List prerequisites only if they genuinely matter."
)


def plan_request(*, topic: str, level: LearningLevel, language: str, interests: list[str]) -> str:
    lines = [
        f"Topic: {topic}",
        f"Level: {level.value}",
        f"Language: {language_name(language)}",
    ]
    if interests:
        lines.append("Learner interests: " + ", ".join(interests[:20]))
    lines.append("Create the lesson plan.")
    return "\n".join(lines)


SUMMARY_SYSTEM = (
    "You summarise tutoring sessions for the learner. Write a concise recap of what was "
    "actually covered in the conversation (not the whole plan), 3-6 key points, and 1-3 "
    "suggested next steps. Write in the requested language."
)


def summary_request(*, topic: str, language: str, transcript: str) -> str:
    return (
        f"Topic: {topic}\nLanguage: {language_name(language)}\n\n"
        f"Conversation transcript:\n{transcript}\n\nSummarise this session."
    )
