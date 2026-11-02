# AI Tutor Dashboard — Development Roadmap

Each phase ends with a **checkpoint**: tests run and pass (real output reported), PROJECT_STATUS.md and TASKS.md updated, and a short demo note. Work stops for your approval at the end of each phase that is marked ⏸.

| # | Phase | Exit criteria (checkpoint) |
|---|---|---|
| 0 ⏸ | Architecture and planning | ARCHITECTURE, DATABASE_DESIGN, ROADMAP, TASKS, DECISIONS approved. |
| 1 | Environment setup | `docker compose up` brings up Postgres+pgvector and Redis. Backend `/health/ready` is green. Frontend shows backend health. Git repo initialised. Pytest and Vitest smoke tests pass. |
| 2 | Dashboard UI shell | Design system (tokens, Button, Card, Input, Select, Modal, Toast, Skeleton, EmptyState). App layout with sidebar and topbar. All 12 routes exist and are responsive. Feature pages show honest "available in Phase N" states, with no fake data. Component tests pass. |
| 3 ⏸ | Backend, DB, auth | Alembic migrations 0001–0003. Register, login, refresh, logout, password reset. Protected routes. Profile and preferences CRUD. Conversation and lesson persistence. Isolation tests pass. Frontend auth flow wired end to end. |
| 4 ⏸ | AI tutor | LLM provider abstraction (Anthropic + Mock). Streaming chat (SSE). Lesson plans. Level-adaptive prompts. Summaries. Understanding checks that update mastery. **Requires `ANTHROPIC_API_KEY`**; otherwise it runs on Mock and that is stated. |
| 5 | Speech abstraction | STT/TTS interfaces, mock providers, disabled Gnani adapters, config, tests. |
| 6 | STT (UI + pipeline) | Mic permission, recording, validation, upload, transcript display and correction, using the mock provider until Gnani is configured. |
| 7 | TTS (UI + pipeline) | Playback controls, speed and voice selection, per-language capability gating. |
| 8 ⏸ | Voice tutor | WebSocket STT → LLM → TTS loop with interruption, reconnection and history. |
| — ⏸ | **Gnani real integration** | Starts only after you provide official docs and a key. It can be inserted after any phase ≥ 5. |
| 9 | Multilingual | Language capability matrix, multilingual prompts, per-language evaluation set, subtitle languages. |
| 10 | Mind maps | Schema, generation, validation, React Flow render, collapse/expand, export. Migration 0005. |
| 11 | Drawing / diagrams | Diagram DSL, SVG renderer with step playback, canvas freehand, export. |
| 12 ⏸ | Video generation | Worker container (Manim + FFmpeg), templated scenes, narration, subtitles, job progress, player. Migration 0006. |
| 13 | Assessment | Quiz generation and grading, history, weak-topic detection, recommendations. Migration 0007–0008. |
| 14 | Testing and hardening | Playwright E2E for the main journeys, security review (RLS, rate limits, headers), performance checks. |
| 15 ⏸ | Deployment | Production compose with Caddy HTTPS, S3-compatible storage option, backups, monitoring, DEPLOYMENT.md. |

## Notes on ordering
- Phase 2 builds the UI shell before the backend exists, as you specified. To respect "no fake buttons", controls for features that are not built yet are visibly disabled with a "coming in Phase N" label, never wired to sample data.
- RAG (learning resources, embeddings) is built inside Phase 4. Migration 0004 is introduced there.
- Phase 13's analytics page depends on `topic_mastery`, which Phase 4 starts populating.

## Inputs needed from you, and when
| Needed | By phase | Without it |
|---|---|---|
| Approval of this plan | before 1 | — |
| `ANTHROPIC_API_KEY` (or another LLM decision) | 4 | Tutor runs on MockLLMProvider (clearly labelled). |
| SMTP credentials (optional) | 3 | Reset links are printed to the backend log (dev only). |
| Gnani docs + key | any time ≥ 5 | Mock STT/TTS. Videos have silent narration with subtitles. |
| Hosting target (VPS / cloud) | 15 | Local Docker Compose deployment only. |
