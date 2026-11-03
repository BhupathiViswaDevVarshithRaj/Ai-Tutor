"""Which writing system a text is in — used to check replies are in the requested language."""

import unicodedata

# Unicode script of each language's native writing, by the prefix of its characters' names.
LANGUAGE_SCRIPTS: dict[str, tuple[str, ...]] = {
    "en": ("LATIN",),
    "hi": ("DEVANAGARI",),
    "te": ("TELUGU",),
    "ta": ("TAMIL",),
    "pa": ("GURMUKHI",),
    "bn": ("BENGALI",),
    "de": ("LATIN",),
    "fr": ("LATIN",),
    "es": ("LATIN",),
    "it": ("LATIN",),
    "pt": ("LATIN",),
    "ja": ("HIRAGANA", "KATAKANA", "CJK UNIFIED IDEOGRAPH"),
    "ko": ("HANGUL",),
    "zh": ("CJK UNIFIED IDEOGRAPH",),
}


# Very common function words, to tell Latin-script languages apart (the script can't).
FUNCTION_WORDS: dict[str, frozenset[str]] = {
    "en": frozenset("the and is are you to of a in it that this what do not".split()),
    "de": frozenset("der die das und ist ich du sie nicht ein eine zu mit was wie bitte".split()),
    "fr": frozenset("le la les et est je tu vous pas un une de du que avec où".split()),
    "es": frozenset("el la los las y es yo tú usted no un una de que con dónde por".split()),
    "it": frozenset("il lo la gli e è io tu lei non un una di che con dove per".split()),
    "pt": frozenset("o a os as e é eu tu você não um uma de que com onde para".split()),
}


def function_word_lead(text: str, language: str) -> int:
    """Target-language function words minus English ones (positive = looks like the target)."""
    words = [w.strip(".,!?;:¿¡\"'()").casefold() for w in text.split()]
    target = sum(w in FUNCTION_WORDS[language] for w in words)
    english = sum(w in FUNCTION_WORDS["en"] for w in words)
    return target - english


def _script(ch: str) -> str | None:
    if not ch.isalpha():
        return None
    name = unicodedata.name(ch, "")
    for scripts in LANGUAGE_SCRIPTS.values():
        for script in scripts:
            if name.startswith(script):
                return script
    return "OTHER"


def script_share(text: str, language: str) -> float:
    """Share (0-1) of letters written in the language's native script(s)."""
    expected = LANGUAGE_SCRIPTS[language]
    letters = [s for ch in text if (s := _script(ch)) is not None]
    if not letters:
        return 0.0
    return sum(1 for s in letters if s in expected) / len(letters)
