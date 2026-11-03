"""Mind maps API: generation, lesson maps, edits with versions, layout, AI expansion."""

import pytest

from app.ai.llm.base import LLMRefusal
from app.ai.llm.factory import get_llm
from app.ai.llm.mock_provider import MockLLMProvider
from tests.conftest import API, register_user

pytestmark = pytest.mark.integration

M = f"{API}/mindmaps"
REQUEST = {"topic": "Photosynthesis", "level": "beginner", "language": "en"}


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
    resp = await api.post(M, headers=headers, json={**REQUEST, **overrides})
    assert resp.status_code == 201, resp.text
    return resp.json()


async def test_generates_a_validated_map(api, llm):
    headers = await register_user(api)
    mind_map = await create(api, headers)
    graph = mind_map["graph"]
    assert graph["title"] == "Photosynthesis (mock map)"
    assert graph["nodes"][0] == {
        "id": "n0",
        "parent": "",
        "label": "Photosynthesis",
        "kind": "topic",
        "detail": "Mock central topic.",
    }
    assert len(graph["nodes"]) == 11 and len(graph["links"]) == 1
    assert {n["kind"] for n in graph["nodes"]} == {
        "topic",
        "idea",
        "concept",
        "example",
        "definition",
    }
    assert mind_map["version"] == 1 and mind_map["layout"] is None

    listed = (await api.get(M, headers=headers)).json()
    assert listed["total"] == 1
    assert listed["items"][0]["title"] == "Photosynthesis (mock map)"
    assert listed["items"][0]["node_count"] == 11


async def test_a_lesson_map_follows_the_lesson_plan(api, llm):
    headers = await register_user(api)
    lesson = (
        await api.post(f"{API}/tutor/lessons", headers=headers, json={**REQUEST, "language": "hi"})
    ).json()["lesson"]
    mind_map = await create(api, headers, lesson_id=lesson["id"], language="hi")
    assert mind_map["lesson_id"] == lesson["id"]
    assert "lesson plan" in llm.prompts[-1] and "Foundations of Photosynthesis" in llm.prompts[-1]
    assert "Language: Hindi" in llm.prompts[-1]
    by_lesson = (await api.get(M, headers=headers, params={"lesson_id": lesson["id"]})).json()
    assert by_lesson["total"] == 1

    other = await register_user(api, email="other@example.com")
    resp = await api.post(M, headers=other, json={**REQUEST, "lesson_id": lesson["id"]})
    assert resp.status_code == 404


async def test_edits_are_validated_and_versioned(api, llm):
    headers = await register_user(api)
    mind_map = await create(api, headers)
    graph = mind_map["graph"]
    graph["nodes"][1]["label"] = "Light reactions"
    graph["nodes"].append(
        {"id": "mine", "parent": "n1", "label": "My note", "kind": "example", "detail": ""}
    )
    url = f"{M}/{mind_map['id']}"

    assert (await api.patch(url, headers=headers, json={"graph": graph})).status_code == 422
    saved = (await api.patch(url, headers=headers, json={"graph": graph, "version": 1})).json()
    assert saved["version"] == 2
    assert saved["graph"]["nodes"][1]["label"] == "Light reactions"
    assert saved["graph"]["nodes"][-1]["id"] == "mine"

    stale = await api.patch(url, headers=headers, json={"graph": graph, "version": 1})
    assert stale.status_code == 409 and stale.json()["code"] == "version_conflict"

    broken = {
        **graph,
        "nodes": [
            *graph["nodes"],
            {"id": "x", "parent": "nope", "label": "x", "kind": "idea", "detail": ""},
        ],
    }
    bad = await api.patch(url, headers=headers, json={"graph": broken, "version": 2})
    assert bad.status_code == 422 and bad.json()["code"] == "invalid_map"
    assert "doesn't exist" in bad.json()["detail"]


async def test_title_and_layout_are_saved_without_a_version(api, llm):
    headers = await register_user(api)
    mind_map = await create(api, headers)
    url = f"{M}/{mind_map['id']}"
    layout = {
        "positions": {"n1": {"x": 10, "y": 20}, "ghost": {"x": 0, "y": 0}},
        "collapsed": ["n2", "n2", "ghost"],
    }
    saved = (
        await api.patch(url, headers=headers, json={"title": "My map", "layout": layout})
    ).json()
    assert saved["graph"]["title"] == "My map"
    assert saved["layout"] == {"positions": {"n1": {"x": 10.0, "y": 20.0}}, "collapsed": ["n2"]}
    assert saved["version"] == 1  # layout and title don't change the graph's structure

    # Removing a node drops its layout entries too.
    graph = saved["graph"]
    removed = {"n2"} | {n["id"] for n in graph["nodes"] if n["parent"] == "n2"}
    graph["nodes"] = [n for n in graph["nodes"] if n["id"] not in removed]
    graph["links"] = [
        link for link in graph["links"] if {link["source"], link["target"]}.isdisjoint(removed)
    ]
    resp = await api.patch(url, headers=headers, json={"graph": graph, "version": 1})
    assert resp.status_code == 200, resp.text
    assert resp.json()["layout"]["collapsed"] == []


async def test_expanding_a_node_adds_children_and_opens_it(api, llm):
    headers = await register_user(api)
    mind_map = await create(api, headers)
    url = f"{M}/{mind_map['id']}"
    await api.patch(url, headers=headers, json={"layout": {"collapsed": ["n1"]}})

    expanded = (
        await api.post(f"{url}/expand", headers=headers, json={"node_id": "n1", "version": 1})
    ).json()
    added = [n for n in expanded["graph"]["nodes"] if n["label"].startswith("[mock] idea")]
    assert len(added) == 3 and all(n["parent"] == "n1" for n in added)
    assert expanded["version"] == 2 and expanded["layout"]["collapsed"] == []
    assert "Expand this node: Photosynthesis > [mock] Main idea 1" in llm.prompts[-1]

    again = (
        await api.post(f"{url}/expand", headers=headers, json={"node_id": "n1", "version": 2})
    ).json()
    assert len(again["graph"]["nodes"]) == len(expanded["graph"]["nodes"]) + 3

    stale = await api.post(f"{url}/expand", headers=headers, json={"node_id": "n1", "version": 1})
    assert stale.status_code == 409
    missing = await api.post(f"{url}/expand", headers=headers, json={"node_id": "zz", "version": 3})
    assert missing.status_code == 404


async def test_maps_are_private_and_deletable(api, llm):
    owner = await register_user(api)
    mind_map = await create(api, owner)
    url = f"{M}/{mind_map['id']}"
    other = await register_user(api, email="other@example.com")
    assert (await api.get(url, headers=other)).status_code == 404
    assert (await api.patch(url, headers=other, json={"title": "x"})).status_code == 404
    assert (await api.delete(url, headers=other)).status_code == 404
    assert (await api.get(M, headers=other)).json()["total"] == 0

    assert (await api.delete(url, headers=owner)).status_code == 204
    assert (await api.get(url, headers=owner)).status_code == 404


async def test_input_validation_and_refusals(api, app):
    headers = await register_user(api)
    assert (await api.post(M, headers=headers, json={**REQUEST, "topic": "x"})).status_code == 422
    assert (
        await api.post(M, headers=headers, json={**REQUEST, "language": "de"})
    ).status_code == 422

    class Refusing(MockLLMProvider):
        async def parse(self, **_):
            raise LLMRefusal()

    app.dependency_overrides[get_llm] = lambda: Refusing()
    resp = await api.post(M, headers=headers, json=REQUEST)
    assert resp.status_code == 422 and resp.json()["code"] == "ai_refused"
    assert (await api.get(M, headers=headers)).json()["total"] == 0
