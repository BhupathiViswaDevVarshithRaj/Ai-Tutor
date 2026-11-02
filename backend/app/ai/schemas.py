"""Structured outputs requested from the LLM.

These models are sent to the API as JSON schemas, so they avoid constraints the
structured-output schema subset may not support; `validate_plan` and friends enforce
sizes afterwards.
"""

from pydantic import BaseModel

from app.ai.llm.base import LLMError


class PlanSection(BaseModel):
    title: str
    objectives: list[str]
    key_terms: list[str]


class PlanModule(BaseModel):
    title: str
    summary: str
    sections: list[PlanSection]


class LessonPlan(BaseModel):
    title: str
    overview: str
    prerequisites: list[str]
    modules: list[PlanModule]


class LessonSummary(BaseModel):
    summary: str
    key_points: list[str]
    next_steps: list[str]


def _clip(items: list[str], limit: int, length: int = 200) -> list[str]:
    return [i.strip()[:length] for i in items if i.strip()][:limit]


def validate_plan(plan: LessonPlan) -> LessonPlan:
    """Enforce sane sizes and reject empty plans."""
    modules = []
    for module in plan.modules[:8]:
        sections = [
            PlanSection(
                title=s.title.strip()[:200],
                objectives=_clip(s.objectives, 6),
                key_terms=_clip(s.key_terms, 10, 80),
            )
            for s in module.sections[:6]
            if s.title.strip()
        ]
        if module.title.strip() and sections:
            modules.append(
                PlanModule(
                    title=module.title.strip()[:200],
                    summary=module.summary.strip()[:600],
                    sections=sections,
                )
            )
    if not plan.title.strip() or not modules:
        raise LLMError("The tutor couldn't build a lesson plan for that topic. Please try again.")
    return LessonPlan(
        title=plan.title.strip()[:200],
        overview=plan.overview.strip()[:1000],
        prerequisites=_clip(plan.prerequisites, 6),
        modules=modules,
    )


def validate_summary(summary: LessonSummary) -> LessonSummary:
    if not summary.summary.strip():
        raise LLMError("The tutor couldn't summarise this lesson yet. Please try again.")
    return LessonSummary(
        summary=summary.summary.strip()[:2000],
        key_points=_clip(summary.key_points, 8, 300),
        next_steps=_clip(summary.next_steps, 5, 300),
    )


def plan_sections(plan: dict) -> list[str]:
    """Flat list of section titles in plan order (index = section number)."""
    return [s["title"] for m in plan.get("modules", []) for s in m.get("sections", [])]
