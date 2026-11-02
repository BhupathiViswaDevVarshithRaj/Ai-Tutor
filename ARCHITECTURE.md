# AI Tutor Dashboard — Architecture

Status: **Phase 0 draft — awaiting approval**
Last updated: 2026-11-03

## 1. Goals and non-goals

**Goals**
- A personal tutor for any topic, at three levels (Beginner / Intermediate / Advanced), in six initial languages (en, hi, te, ta, pa, bn).
- Text, voice, and visual learning: chat, voice tutor, mind maps, diagrams/whiteboard, short videos, quizzes, analytics.
- Every core feature backed by real persistence and real AI calls. Mock providers are only for development and tests, and they are clearly labelled in the UI.

**Non-goals (for v1)**
- Fine-tuning models. PEFT/LoRA is deferred until we have evaluation data that shows prompting plus RAG is not enough (see DECISIONS.md, D-007).
- Running untrusted AI-generated code. The AI only emits **validated JSON specifications**. Our own renderers (SVG, React Flow, templated Manim scenes) turn those into visuals.
- Claims of universal language support. Each language is tested and marked as supported per capability (LLM, STT, TTS).

## 2. System overview

```
┌──────────────────────────── Browser (React + TS + Vite) ────────────────────────────┐
│ Pages: Landing · Auth · Dashboard · Tutor Chat · Voice Tutor · Video Studio ·        │
│        Mind Map · Whiteboard · Quiz · Progress · History · Settings                  │
│ REST (fetch, JSON)  ·  SSE (streamed tutor replies)  ·  WebSocket (voice tutor)      │
└───────────────┬──────────────────────────────────────────────────────┬──────────────┘
                │ HTTPS                                                 │ WSS
┌───────────────▼──────────────────────────────────────────────────────▼──────────────┐
│ FastAPI backend (app/)                                                               │
│  api/v1 routers → services (business logic, user scoping) → repositories (SQLAlchemy)│
│                                                                                      │
│  AI Orchestration layer (app/ai)                                                     │
│   ├─ llm/        LLMProvider interface → AnthropicProvider | MockLLMProvider         │
│   ├─ tutor       lesson plans, explanations, follow-ups, summaries, adaptation       │
│   ├─ rag/        chunker → embedder (sentence-transformers) → pgvector retriever     │
│   ├─ mindmap     structured JSON → validated graph                                   │
│   ├─ diagram     structured JSON diagram DSL → validated spec                        │
│   ├─ quiz        generation + grading (MCQ deterministic, short answer LLM-graded)   │
│   └─ video       outline → script → storyboard → scene specs                        │
│  speech/ STTProvider, TTSProvider → Mock* | Gnani* (disabled until docs + key)       │
└───────┬───────────────────────────┬──────────────────────────────┬───────────────────┘
        │                           │ enqueue jobs                 │
┌───────▼────────┐        ┌─────────▼─────────┐          ┌─────────▼──────────┐
│ PostgreSQL 16  │        │ Redis             │◄────────►│ Worker (arq)        │
│ + pgvector     │        │ job queue, cache, │          │ Manim + FFmpeg      │
│                │        │ rate limits       │          │ video render jobs   │
└────────────────┘        └───────────────────┘          └─────────┬──────────┘
                                                                   │
                                                         ┌─────────▼──────────┐
                                                         │ Media storage       │
                                                         │ local volume (dev)  │
                                                         │ S3-compatible (prod)│
                                                         └────────────────────┘
```

## 3. Technology decisions

| Area | Choice | Reason |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite, Tailwind CSS, React Router, Lucide, React Flow (`@xyflow/react`), Recharts, Framer Motion (sparingly) | As specified. |
| Frontend data | TanStack Query for server state, a small React context for auth/session | Caching, retries and loading states without writing our own. |
| Backend | FastAPI, Pydantic v2, SQLAlchemy 2.0 (async, `asyncpg`), Alembic | As specified. Async fits streaming and WebSockets. |
| Auth | Argon2id password hashing; short-lived JWT access token (15 min) plus a rotating refresh token in an httpOnly, SameSite cookie, stored hashed in the DB | Refresh tokens can be revoked, and the browser never sees long-lived tokens in JS. |
| Password reset | One-time hashed token with a 30-minute TTL, sent through a `Mailer` interface (`ConsoleMailer` in dev, `SMTPMailer` when configured) | No paid email service is required. |
| LLM | Anthropic Claude through the official `anthropic` Python SDK, behind an `LLMProvider` interface | Strong multilingual quality, including Indic languages; structured outputs; streaming. |
| Structured output | `client.messages.parse()` with Pydantic models (`output_config.format`) | Schema-validated JSON for mind maps, diagrams, quizzes, video specs. |
| Embeddings | `sentence-transformers`, using `intfloat/multilingual-e5-base` (768-dim) by default, run locally on CPU | Free, multilingual, and covers all six target languages. Configurable. |
| Vector store | pgvector (HNSW index, cosine) | Keeps vectors next to relational data and makes per-user filtering easy. |
| Background jobs | `arq` (asyncio, Redis) | Lightweight and async-native. Unlike RQ, it does not depend on `fork`, which matters on Windows dev machines. |
| Video | Manim Community + FFmpeg inside the worker container | As specified. The container avoids painful native installs on Windows. |
| Diagrams / whiteboard | Our own JSON diagram DSL rendered to SVG in React; free drawing on HTML Canvas (pointer events) | Safe (no code execution), exportable (SVG/PNG). |
| Speech | `STTProvider` / `TTSProvider` interfaces with `Mock*` and `Gnani*` adapters | Gnani is disabled until official docs and a key arrive (see §7). |
| Storage | `MediaStorage` interface: `LocalStorage` (Docker volume) in dev, S3-compatible in prod | Keeps the hosting provider swappable. |
| Testing | Pytest (+ httpx AsyncClient, testcontainers or a compose Postgres), Vitest + React Testing Library, Playwright | As specified. |
| Deployment | Docker Compose: `frontend` (nginx static), `backend`, `worker`, `postgres`, `redis`, plus a reverse proxy (Caddy for automatic HTTPS) | One-host deploy first, which is cheap. Split later if load requires it. |

## 4. Model recommendations

| Use | Default | Notes |
|---|---|---|
| Tutor chat, lesson plans, explanations, adaptation | `claude-opus-5-5` | Effort `medium` (set explicitly), adaptive thinking, streaming. |
| Mind map / diagram / quiz / video-script generation | `claude-opus-5-5` | Structured outputs via `messages.parse()`. |
| Short-answer grading | `claude-opus-5-5` | Effort `low`. Short rubric-based JSON. |
| Embeddings | `intfloat/multilingual-e5-base` (local) | Swappable through `EMBEDDING_MODEL`. Dimension recorded per row. |

- **Model per route is configuration** (`LLM_MODEL_TUTOR`, `LLM_MODEL_STRUCTURED`, `LLM_MODEL_GRADER`). You can move cheaper routes, such as grading and quiz generation, to `claude-sonnet-5-5` or `claude-haiku-5-5`. That is your choice, made after we measure quality on real outputs. See the cost section.
- **Refusal handling:** requests enable the server-side fallback (`fallbacks: "default"` with beta `server-side-fallback-2026-07-01`), and the code always checks `stop_reason` before reading content.
- **Notes on the Opus 5.5 API:** thinking cannot be disabled, so effort is the only control. Forced `tool_choice` is not supported, so we use structured outputs instead. Prefill is not supported. Prompt caching is placed on the stable system prompt plus the lesson context.
- **Provider abstraction:** `LLMProvider` exposes `stream_chat()`, `complete()` and `parse(schema)`. A `MockLLMProvider` returns deterministic fixtures for tests and keyless local development. The UI shows a "Mock AI" badge whenever it is active.

## 5. Backend module layout

```
backend/app/
  main.py                 app factory, middleware, router mounting
  core/                   config (pydantic-settings), security, logging, errors, rate limiting
  db/                     engine/session, Base, models/ (one module per aggregate)
  schemas/                Pydantic request/response models
  repositories/           data access, always scoped by user_id
  services/               business logic: auth, lessons, conversations, quizzes, progress, media
  api/v1/                 routers: health, auth, users, tutor, conversations, lessons,
                          speech, voice (WS), mindmaps, diagrams, videos, quizzes, progress
  ai/
    llm/                  base.py, anthropic_provider.py, mock_provider.py, factory.py
    prompts/              versioned prompt templates (per task, language-aware)
    tutor.py  lesson_planner.py  mindmap.py  diagram.py  quiz.py  video_script.py
    rag/                  chunker.py, embedder.py, retriever.py
    orchestrator.py       wires providers, retries, timeouts, validation
  speech/
    stt/                  base.py, mock.py, gnani.py (disabled stub)
    tts/                  base.py, mock.py, gnani.py (disabled stub)
  video/                  scene_spec.py (Pydantic), scenes/ (templated Manim classes),
                          renderer.py, compositor.py (FFmpeg), subtitles.py (SRT/VTT)
  workers/                arq WorkerSettings, tasks (render_video, embed_resource)
  storage/                MediaStorage interface, local + S3 implementations
```

Rules: routers stay thin. Services own logic. Every repository query takes `user_id`. AI modules never touch the DB directly; services persist their results.

## 6. Key flows

**Tutor chat (text):** `POST /api/v1/conversations/{id}/messages` stores the user message, then the orchestrator builds context: system prompt (level, language, learner profile, weak topics), lesson plan, RAG chunks, and recent history. The reply streams back over SSE. When the stream finishes, the assistant message is stored. Every *N* turns, the tutor also emits a hidden structured "understanding check" that updates `topic_mastery`.

**Lesson plan:** `POST /lessons` generates a structured plan (modules → concepts → objectives) through `parse()`, stores it, and tracks progress per section.

**Voice tutor:** WebSocket `/api/v1/voice/ws`. The client records an utterance (MediaRecorder, webm/opus) and sends it, ending with an end-of-utterance marker. The server runs STT, sends a `transcript` event (the user can correct it), streams the LLM reply, sends `tts_chunk` events sentence by sentence, then `done`. An `interrupt` message from the client cancels the LLM and TTS tasks. Reconnecting uses the conversation ID, so history is preserved.

**Mind map:** LLM → `MindMap` Pydantic schema (nodes with id, label, definition, example, parent; edges with source, target, relation). The server checks for one root, unique IDs, no orphans or cycles, and caps depth and node count. React Flow renders it with a dagre/elk layout, collapse/expand, and PNG/SVG/JSON export.

**Diagram / whiteboard:** LLM → `DiagramSpec` (type: flowchart | block | timeline | graph_fn | process; elements, connectors, labels, ordered `steps`) → React SVG renderer that animates the steps. Function graphs use a whitelisted expression parser, not `eval`. Free drawing is a Canvas layer, and diagrams can be saved and exported.

**Video generation (background):** `POST /videos` creates a `video_jobs` row and enqueues `render_video`. The worker runs: outline → script → storyboard → `SceneSpec[]` (validated) → each scene rendered by a **pre-written, parameterised Manim template** (title card, bullet reveal, flow diagram, function plot, labelled diagram, timeline) → TTS narration per scene → SRT/VTT from narration timings → FFmpeg concat, mux and subtitle → `media_assets`. Progress is written to the job row and the UI polls (or uses SSE). Target length is 30–120 s. Without a configured TTS provider, videos render with subtitles and silent audio, and the UI says so.

**Quiz:** Generation gives MCQ and short-answer questions with answer and explanation. MCQ grading is deterministic. Short answers are graded by the LLM against a rubric. Per-concept results feed `topic_mastery` and the recommendations.

## 7. Gnani integration strategy

- `STTProvider.transcribe(audio: bytes, mime: str, language: str) -> Transcript` and `TTSProvider.synthesize(text, language, voice, speed) -> AudioResult`, plus `supported_languages()` / `voices()` capability methods.
- `MockSTTProvider` returns a fixed or echo transcript. `MockTTSProvider` generates a short tone or silent WAV with realistic duration metadata. Both exist for development and tests only, and the UI labels them as mocks.
- `GnaniSTTProvider` / `GnaniTTSProvider` exist as classes that raise `ProviderNotConfigured`. **They contain no invented endpoints, auth, or payloads.**
- Selection: `STT_PROVIDER=mock|gnani`, `TTS_PROVIDER=mock|gnani`, with `GNANI_STT_ENABLED` / `GNANI_TTS_ENABLED` as an extra safety switch. Credentials live only on the backend.
- When the official documentation and key arrive: read the docs, implement the adapters, check language coverage, and add integration tests with sample audio (skipped when there is no key).
- Browser fallback: none by default. We will not silently send audio to a third party you have not approved.

## 8. Cross-cutting concerns

- **Security:** CORS allowlist; the refresh token is a secure, httpOnly, `SameSite=Strict` cookie scoped to `/api/v1/auth`; the access token is kept only in memory and sent as a Bearer header, so ordinary API routes can't be CSRF'd; cookie-authenticated routes (refresh, logout, change-password) also require an `X-CSRF-Protection: 1` header (a cross-site page can't send it without a CORS preflight, which the allowlist rejects); refresh-token rotation with reuse detection and a 30 s race grace window; argon2id hashing; per-IP Redis rate limits on login, register and password reset; input size limits (audio ≤ 10 MB / 60 s, prompts ≤ 8k chars); a rate limit per user and route (Redis); user data isolation enforced in repositories and tested; secrets only in env; no AI output executed.
- **Reliability:** LLM timeouts (60 s non-streaming), SDK retries (2), our own retry on schema validation failure (1 re-ask with the validation errors), circuit-breaker-style error surfacing to the UI.
- **Observability:** structured JSON logs with request ID; LLM token usage logged per request (to measure real cost); `/health` and `/health/ready` (DB and Redis).
- **i18n:** UI strings through a small i18n layer (English first, other UI translations later). Tutor content language is a per-request parameter. A language capability matrix (`GET /api/v1/meta/languages`) reports what LLM, STT and TTS support, so the UI disables options that are not supported.

## 9. Cost considerations (estimates, to be validated with logged usage)

Prices from Anthropic's published API rates (per million tokens): **Opus 5.5** $4 in / $20 out (cache read $0.20); **Sonnet 5.5** $2 / $10; **Haiku 5.5** $0.10 / $0.50. Thinking tokens are billed as output.

| Action | Rough tokens | Opus 5.5 cost |
|---|---|---|
| Tutor chat turn | ~1k fresh + ~3k cached in, ~1.2k out | ≈ $0.03 |
| Lesson plan | ~1.5k in, ~4k out | ≈ $0.09 |
| Quiz (10 Q) | ~1.5k in, ~3k out | ≈ $0.07 |
| Mind map | ~1k in, ~2.5k out | ≈ $0.05 |
| Video script + storyboard | ~2k in, ~4k out | ≈ $0.09 |

An active learner doing about 30 chat turns per day plus a few generations comes to roughly **$1–1.5/day on Opus 5.5**. Moving all routes to Sonnet 5.5 roughly halves that. Haiku 5.5 is about 40× cheaper, with a quality trade-off we would need to measure. Levers: prompt caching (built in from day one), effort tuning per route, caching generated mind maps and quizzes per (topic, level, language), and per-user daily quotas.

Other costs: embeddings run locally (free, CPU). Manim rendering is CPU-heavy (about 1–3 min CPU per 60 s video at 720p), so one 4 vCPU / 8 GB host handles light use. Gnani pricing is unknown until you share their terms.

## 10. Technical risks

| Risk | Mitigation |
|---|---|
| Gnani API capabilities or languages differ from assumptions | Interface-first design, mocks, and a capability matrix. No real calls until docs arrive. |
| LLM quality varies across Indic languages, especially technical terms | Prompt keeps English technical terms in parentheses. Per-language evaluation set in Phase 9. |
| Manim/LaTeX image size and render time | Use `Text`, not `MathTex`, by default (no LaTeX). Render at 720p/30 fps. Worker concurrency of 1–2. |
| Structured output drift | Pydantic validation plus one repair re-ask, then a graceful error. |
| Cost growth | Usage logging, quotas, per-route model config, caching. |
| PyTorch image size (sentence-transformers) | CPU-only torch wheel. The model is downloaded once to a volume. |
| Windows dev environment (no native psql/ffmpeg) | Postgres, Redis and the worker run in Docker. API and frontend run natively for fast reload. |
