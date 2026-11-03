"""Diagrams API: generation by type, lesson diagrams, sketch boards and strokes."""

import pytest

from app.ai.llm.base import LLMRefusal
from app.ai.llm.factory import get_llm
from app.ai.llm.mock_provider import MockLLMProvider
from tests.conftest import API, register_user

pytestmark = pytest.mark.integration

D = f"{API}/diagrams"
REQUEST = {"topic": "Quadratics", "level": "intermediate", "language": "en"}
STROKE = {"tool": "pen", "color": "#7c3aed", "width": 3, "points": [[0, 0], [10, 5], [20, 12]]}


class RecordingLLM(MockLLMProvider):
    def __init__(self) -> None:
        super().__init__()
        self.prompts: list[str] = []

    async def parse(self, *, system, messages, schema, role="structured"):
        self.prompts.append(messages[-1].content)
        return await super().parse(system=system, messages=messages, schema=schema, role=role)


@pytest.fixture
def llm(app):
    provider = RecordingLLM()
    app.dependency_overrides[get_llm] = lambda: provider
    return provider


async def create(api, headers, **overrides):
    resp = await api.post(D, headers=headers, json={**REQUEST, **overrides})
    assert resp.status_code == 201, resp.text
    return resp.json()


@pytest.mark.parametrize(
    ("requested", "expected"),
    [
        ("auto", "flowchart"),
        ("flowchart", "flowchart"),
        ("block", "block"),
        ("process", "process"),
        ("timeline", "timeline"),
        ("graph_fn", "graph_fn"),
    ],
)
async def test_generates_each_diagram_type(api, llm, requested, expected):
    headers = await register_user(api)
    diagram = await create(api, headers, diagram_type=requested)
    assert diagram["diagram_type"] == expected
    spec = diagram["spec"]
    assert spec["steps"] and diagram["title"] == "Quadratics (mock diagram)"
    shown = [i for step in spec["steps"] for i in step["show"]]
    everything = [
        x["id"] for key in ("elements", "connectors", "functions", "points") for x in spec[key]
    ]
    assert sorted(shown) == sorted(everything)  # each item appears in exactly one step
    if expected == "graph_fn":
        assert spec["functions"][0]["expression"] == "x^2 - 4"
        assert spec["elements"] == [] and (spec["x_min"], spec["x_max"]) == (-4, 4)
    want = "your choice" if requested == "auto" else requested
    assert f"Diagram type: {want}" in llm.prompts[-1]


async def test_a_lesson_diagram_uses_the_plan_and_is_listed(api, llm):
    headers = await register_user(api)
    lesson = (
        await api.post(f"{API}/tutor/lessons", headers=headers, json={**REQUEST, "topic": "Loops"})
    ).json()["lesson"]
    diagram = await create(api, headers, topic="Loops", lesson_id=lesson["id"])
    assert diagram["lesson_id"] == lesson["id"]
    assert "It is for this lesson" in llm.prompts[-1]
    listed = (await api.get(D, headers=headers, params={"lesson_id": lesson["id"]})).json()
    assert listed["total"] == 1 and listed["items"][0]["step_count"] == 3

    other = await register_user(api, email="other@example.com")
    resp = await api.post(D, headers=other, json={**REQUEST, "lesson_id": lesson["id"]})
    assert resp.status_code == 404


async def test_sketch_boards_and_strokes(api, llm):
    headers = await register_user(api)
    resp = await api.post(
        f"{D}/sketch",
        headers=headers,
        json={"title": "My sketch", "level": "beginner", "language": "hi"},
    )
    assert resp.status_code == 201
    board = resp.json()
    assert board["diagram_type"] == "freehand" and board["spec"] is None and board["strokes"] == []

    url = f"{D}/{board['id']}"
    saved = (
        await api.patch(
            url,
            headers=headers,
            json={"strokes": [STROKE, {**STROKE, "tool": "highlighter", "width": 16}]},
        )
    ).json()
    assert len(saved["strokes"]) == 2 and saved["strokes"][1]["tool"] == "highlighter"
    renamed = (await api.patch(url, headers=headers, json={"title": "Cells"})).json()
    assert renamed["title"] == "Cells" and len(renamed["strokes"]) == 2  # title only: strokes kept

    cleared = (await api.patch(url, headers=headers, json={"strokes": []})).json()
    assert cleared["strokes"] == []


@pytest.mark.parametrize(
    "stroke",
    [
        {**STROKE, "color": "red"},
        {**STROKE, "color": "#12345"},
        {**STROKE, "width": 0},
        {**STROKE, "tool": "laser"},
        {**STROKE, "points": []},
        {**STROKE, "points": [[0, 0]] * 2001},
    ],
)
async def test_strokes_are_validated(api, llm, stroke):
    headers = await register_user(api)
    board = (
        await api.post(
            f"{D}/sketch",
            headers=headers,
            json={"title": "b", "level": "beginner", "language": "en"},
        )
    ).json()
    resp = await api.patch(f"{D}/{board['id']}", headers=headers, json={"strokes": [stroke]})
    assert resp.status_code == 422


async def test_a_full_board_is_refused(api, llm):
    headers = await register_user(api)
    board = (
        await api.post(
            f"{D}/sketch",
            headers=headers,
            json={"title": "b", "level": "beginner", "language": "en"},
        )
    ).json()
    big = {**STROKE, "points": [[i, i] for i in range(2000)]}
    resp = await api.patch(f"{D}/{board['id']}", headers=headers, json={"strokes": [big] * 26})
    assert resp.status_code == 422 and resp.json()["code"] == "too_much_drawing"


async def test_diagrams_are_private_and_deletable(api, llm):
    owner = await register_user(api)
    diagram = await create(api, owner)
    url = f"{D}/{diagram['id']}"
    other = await register_user(api, email="other@example.com")
    assert (await api.get(url, headers=other)).status_code == 404
    assert (await api.patch(url, headers=other, json={"title": "x"})).status_code == 404
    assert (await api.delete(url, headers=other)).status_code == 404
    assert (await api.get(D, headers=other)).json()["total"] == 0
    assert (await api.delete(url, headers=owner)).status_code == 204
    assert (await api.get(url, headers=owner)).status_code == 404


async def test_input_validation_and_refusals(api, app):
    headers = await register_user(api)
    assert (
        await api.post(D, headers=headers, json={**REQUEST, "diagram_type": "pie"})
    ).status_code == 422
    assert (await api.post(D, headers=headers, json={**REQUEST, "topic": "x"})).status_code == 422

    class Refusing(MockLLMProvider):
        async def parse(self, **_):
            raise LLMRefusal()

    app.dependency_overrides[get_llm] = lambda: Refusing()
    resp = await api.post(D, headers=headers, json=REQUEST)
    assert resp.status_code == 422 and resp.json()["code"] == "ai_refused"
    assert (await api.get(D, headers=headers)).json()["total"] == 0
