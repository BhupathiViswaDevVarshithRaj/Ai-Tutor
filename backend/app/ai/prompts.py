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


MINDMAP_SYSTEM = (
    "You build mind maps for a learning app. A mind map is a tree: one central topic node "
    "(parent ''), 3-6 main ideas under it (kind 'idea'), and under those the sub-concepts "
    "(kind 'concept'), examples (kind 'example') and definitions of key terms (kind "
    "'definition') that a learner at the stated level needs. Aim for 20-40 nodes, at most 4 "
    "levels deep. Labels are short (2-6 words); `detail` is one plain sentence explaining the "
    "node. Use short unique ids and set each node's `parent` to its parent's id. Optionally "
    "add up to 6 cross-links between nodes on different branches that are genuinely related, "
    "with a 1-3 word relation (e.g. 'causes', 'part of'). Write labels and details in the "
    "requested language; technical terms may keep the English term in parentheses."
)

MINDMAP_EXPAND_SYSTEM = (
    "You extend one branch of a learner's mind map. Given the map and the node to expand, add "
    "3-5 new child nodes that go one step deeper (sub-concepts, examples or definitions), "
    "without repeating anything already in the map. Labels are short (2-6 words); `detail` is "
    "one plain sentence. Write in the requested language and at the stated level."
)


def mindmap_request(
    *, topic: str, level: LearningLevel, language: str, plan: dict | None = None
) -> str:
    lines = [f"Topic: {topic}", f"Level: {level.value}", f"Language: {language_name(language)}"]
    if plan:
        # A map for a lesson follows the lesson's plan so the two match.
        lines.append(
            "Base the main ideas on this lesson plan:\n"
            + json.dumps(plan, ensure_ascii=False, sort_keys=True)
        )
    lines.append("Create the mind map.")
    return "\n".join(lines)


def expand_request(*, graph: dict, node_id: str, level: LearningLevel, language: str) -> str:
    by_id = {n["id"]: n for n in graph["nodes"]}
    node, path = by_id[node_id], []
    current = node
    while current:
        path.append(current["label"])
        current = by_id.get(current["parent"])
    outline = "\n".join(
        f"- {n['label']}" + (f" (under {by_id[n['parent']]['label']})" if n["parent"] else "")
        for n in graph["nodes"]
    )
    return (
        f"Topic: {graph['title']}\nLevel: {level.value}\nLanguage: {language_name(language)}\n"
        f"Expand this node: {' > '.join(reversed(path))}\n"
        f"Node detail: {node['detail']}\n\nThe whole map so far:\n{outline}"
    )


DIAGRAM_SYSTEM = (
    "You draw teaching diagrams on a whiteboard for a learning app, revealed step by step "
    "like a teacher drawing at the board. Choose the clearest type unless one is requested:\n"
    "- flowchart: a procedure or algorithm. Elements: 'start_end' for start/end, 'box' for "
    "actions, 'decision' for yes/no questions (label its outgoing connectors 'yes'/'no').\n"
    "- block: parts of a system and how they connect (kind 'box'; connectors show flow).\n"
    "- process: a cycle that repeats (e.g. the water cycle): 3-8 'box' elements in order, "
    "each connected to the next and the last back to the first.\n"
    "- timeline: dated events in chronological order (kind 'event'; put the date in `tag`).\n"
    "- graph_fn: a mathematical function. Give 1-3 formulas in x using only numbers, x, "
    "+ - * / ^, parentheses, sin cos tan sqrt abs log ln exp, pi and e; always write "
    "multiplication explicitly (2*x, not 2x). Set x_min/x_max to show the interesting part, "
    "and mark key points (roots, maxima, intercepts) in `points`.\n"
    "Use 4-14 elements (graphs: no elements or connectors). Labels are short (1-6 words); "
    "`detail` is one plain sentence. Use short unique ids for everything.\n"
    "Then write 3-7 `steps`, in teaching order: each has a short title, a one- or two-sentence "
    "explanation, and `show`, the ids of the elements, connectors, functions or points that "
    "appear in that step. Every item should appear in exactly one step. Write all text in the "
    "requested language, at the stated level. Leave unused fields empty (x range 0 to 1)."
)


def diagram_request(
    *, topic: str, level: LearningLevel, language: str, diagram_type: str, plan: dict | None = None
) -> str:
    lines = [f"Topic: {topic}", f"Level: {level.value}", f"Language: {language_name(language)}"]
    lines.append(
        f"Diagram type: {diagram_type}" if diagram_type != "auto" else "Diagram type: your choice"
    )
    if plan:
        lines.append(
            "It is for this lesson:\n" + json.dumps(plan, ensure_ascii=False, sort_keys=True)
        )
    lines.append("Draw the diagram.")
    return "\n".join(lines)
