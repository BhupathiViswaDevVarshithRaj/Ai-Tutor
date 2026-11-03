"""Prompts for world-language courses (Phase 9).

Generated content is pitched at the learner's CEFR level. Explanations, meanings and
translations are in English (the course interface language); practice material is in the
course language.
"""

from app.db.enums import CefrLevel

COURSE_LANGUAGE_NAMES = {
    "de": "German",
    "fr": "French",
    "es": "Spanish",
    "ja": "Japanese",
    "ko": "Korean",
    "zh": "Chinese (Mandarin, simplified characters)",
    "it": "Italian",
    "pt": "Portuguese",
}

# Languages whose learners need a romanised reading next to the native script.
NEEDS_READING = {"ja": "romaji", "ko": "romanisation", "zh": "pinyin with tone marks"}

CEFR_GUIDE = {
    CefrLevel.A1: "A1 (beginner): very common words, short simple sentences, present tense, "
    "greetings, numbers, family, food, everyday objects.",
    CefrLevel.A2: "A2 (elementary): routine tasks and familiar topics, simple past and future, "
    "short connected sentences, shopping, travel, work.",
    CefrLevel.B1: "B1 (intermediate): main points on familiar matters, opinions with reasons, "
    "connected text, a wider range of tenses.",
    CefrLevel.B2: "B2 (upper intermediate): detailed text on many subjects, abstract topics, "
    "nuanced opinions, complex sentences and idioms in moderation.",
    CefrLevel.C1: "C1 (advanced): demanding, longer texts, implicit meaning, flexible and "
    "precise language, formal and informal registers.",
    CefrLevel.C2: "C2 (proficient): near-native material, subtle distinctions, idiomatic and "
    "specialised language.",
}


def course_language_name(code: str) -> str:
    return COURSE_LANGUAGE_NAMES[code]


def _context(language: str, level: CefrLevel, topic: str | None) -> str:
    lines = [
        f"Language: {course_language_name(language)}",
        f"Level: {CEFR_GUIDE[level]}",
        f"Topic: {topic or 'your choice of an everyday topic suited to the level'}",
    ]
    if language in NEEDS_READING:
        lines.append(f"Give a reading in {NEEDS_READING[language]} wherever one is asked for.")
    else:
        lines.append("Leave every `reading` field empty (the language uses the Latin alphabet).")
    return "\n".join(lines)


_COMMON = (
    "You create practice material for a language-learning app. Everything must be correct, "
    "natural and suited to the stated CEFR level. Write explanations, meanings and "
    "translations in English; write practice material in the course language."
)

VOCAB_SYSTEM = (
    f"{_COMMON} Produce 8 useful words or short phrases for the topic. For nouns in "
    "languages with grammatical gender, include the article (e.g. 'das Buch'). Each needs an "
    "English meaning and one short example sentence with its translation. Avoid words the "
    "learner is listed as already knowing."
)

GRAMMAR_SYSTEM = (
    f"{_COMMON} Teach ONE grammar point that fits the level and topic: a clear explanation "
    "(under 200 words, Markdown allowed), 3-4 examples with translations, then 6 exercises. "
    "Mix 'choice' exercises (3-4 options, exactly one correct; the answer is the exact option "
    "text) and 'fill' exercises (a sentence with ___ for the gap; the answer is the missing "
    "word(s); list acceptable alternatives separated by '|'). Each exercise has a one-line "
    "explanation of why the answer is right."
)

LISTENING_SYSTEM = (
    f"{_COMMON} Write a short script to be read aloud: a dialogue between two people (prefix "
    "lines with their names) or a short announcement, 60-150 words at A1-A2 and up to 250 "
    "words above. Then write 4 comprehension 'choice' questions in English about what was "
    "said (3-4 options, one correct; the answer is the exact option text), each with a short "
    "explanation. Provide an English translation of the script."
)

READING_SYSTEM = (
    f"{_COMMON} Write a short graded text (80-150 words at A1-A2, up to 350 words above) "
    "such as a message, article or story. Then write 4 comprehension questions in English: "
    "mostly 'choice' (3-4 options, one correct; the answer is the exact option text), "
    "optionally one 'fill' question answered with a word from the text. Give an English "
    "translation of the text and a short explanation for each answer."
)

WRITING_TASK_SYSTEM = (
    f"{_COMMON} Set one short writing task (an email, message, description or opinion) "
    "suited to the level, with instructions in English, a sensible word range, and 4-6 "
    "useful phrases in the course language with translations."
)

WRITING_FEEDBACK_SYSTEM = (
    "You are a kind, precise language teacher marking a learner's writing. Correct the text "
    "with minimal changes that keep the learner's meaning, list each correction with a short "
    "English explanation, name up to three strengths, give a score from 0 to 100 for how well "
    "the text completes the task at the stated CEFR level (accuracy, range, task completion), "
    "and write a two-sentence summary in English. If the text is not in the course language, "
    "say so in the summary and score it low."
)

SPEAKING_SYSTEM = (
    f"{_COMMON} Produce 6 short phrases (2-10 words) on the topic for the learner to say out "
    "loud, ordered from easiest to hardest, each with a reading where asked and an English "
    "translation."
)


def vocab_request(language: str, level: CefrLevel, topic: str | None, known: list[str]) -> str:
    known_line = ", ".join(known[:80]) or "(none yet)"
    return f"{_context(language, level, topic)}\nAlready known: {known_line}"


def content_request(language: str, level: CefrLevel, topic: str | None) -> str:
    return _context(language, level, topic)


def feedback_request(language: str, level: CefrLevel, task: dict, text: str) -> str:
    return (
        f"{_context(language, level, task.get('title'))}\n"
        f"Task: {task.get('instructions', '')}\n"
        f"Word range: {task.get('min_words')}-{task.get('max_words')}\n\n"
        f"Learner's text:\n{text}"
    )


def roleplay_system_prompt(
    *, language: str, level: CefrLevel, scenario: str, interests: list[str], spoken: bool
) -> str:
    """System prompt for conversation practice: a role-play in the course language."""
    name = course_language_name(language)
    parts = [
        f"You are a friendly conversation partner helping someone practise {name}. You are "
        f"role-playing this situation: {scenario}. Play your role naturally (for example the "
        "waiter, the shop assistant or the new colleague) and keep the conversation going.",
        "## Language level\n"
        f"Speak only {name}, pitched at CEFR {CEFR_GUIDE[level]} Keep each turn short "
        "(1-3 sentences) and end with something the learner can respond to.",
        "## Helping the learner\n"
        "- If the learner makes a mistake, reply in role first, then add one short tip in "
        "English in parentheses, starting with 'Tip:', showing the correct form.\n"
        f"- If the learner writes in English or seems stuck, help them say it in {name}, "
        "then continue the role-play.\n"
        "- Never switch the whole conversation to English.",
    ]
    if language in NEEDS_READING:
        parts.append(
            f"## Reading aid\nAfter each {name} sentence, add its {NEEDS_READING[language]} in "
            "brackets, since the learner is still learning the script."
        )
    if spoken:
        parts.append(
            "## Format\nThis is a spoken conversation: plain sentences only, no Markdown or lists."
        )
    if interests:
        parts.append("## Learner interests\n" + ", ".join(interests[:20]))
    parts.append(
        "In your first reply, greet the learner in role and set the scene in one sentence."
    )
    return "\n\n".join(parts)
