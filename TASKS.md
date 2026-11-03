# Tasks

Legend: `[ ]` todo · `[~]` in progress · `[x]` done (verified)

## Phase 0 — Architecture and planning
- [x] Inspect project directory (empty) and local tooling (Node 24, npm 11, Python 3.11, Docker 29, Git 2.53; no native psql/ffmpeg, so those run in Docker)
- [x] ARCHITECTURE.md
- [x] DATABASE_DESIGN.md
- [x] DEVELOPMENT_ROADMAP.md
- [x] TASKS.md, DECISIONS.md, PROJECT_STATUS.md, README.md
- [x] Approval from you (2026-11-03)

## Phase 1 — Environment setup ✅
- [x] 1.1 `git init`, `.gitignore`, `.editorconfig`, `.env.example` (incl. Gnani placeholders)
- [x] 1.2 `docker-compose.yml`: postgres (pgvector/pgvector:pg16), redis:7, named volumes, healthchecks
- [x] 1.3 Backend scaffold: `backend/pyproject.toml`, venv, FastAPI app factory, `core/config.py` (pydantic-settings), logging
- [x] 1.4 DB session (async SQLAlchemy + asyncpg), Alembic init, `0001_extensions` migration (applied: vector 0.8.7, citext, pgcrypto)
- [x] 1.5 `/api/v1/health` (liveness) and `/api/v1/health/ready` (DB + Redis, concurrent, with timeouts, 503 when degraded)
- [x] 1.6 Pytest setup + health tests: 5 unit + 1 integration, all passing
- [x] 1.7 Frontend scaffold: Vite 8 + React 19 + TS, Tailwind v4, React Router 7, TanStack Query, Lucide; dev proxy to the backend
- [x] 1.8 Frontend `BackendStatus` indicator; Vitest + RTL: 3 tests passing; build passing
- [x] 1.9 Verified end to end (Vite proxy → API → Postgres/Redis, HTTP 200)

## Phase 2 — Dashboard UI shell ✅
- [x] 2.1 Design tokens: semantic colour tokens (bg/surface/line/fg/muted) switched for light/dark in `index.css`; brand scale; Inter + Noto Indic-script fonts; no-flash theme script
- [x] 2.2 UI primitives (`components/ui`): Button, Input/Textarea/Select/Field, Card, Badge, Spinner, Skeleton, EmptyState, Modal (focus trap/restore), Toast, Tabs (keyboard nav)
- [x] 2.3 App layout: sidebar nav with "Soon" markers, top bar (language + level switch, theme toggle, sign-in), mobile drawer
- [x] 2.4 Lazy-loaded routes for all 12 pages + 404
- [x] 2.5 Landing page
- [x] 2.6 Auth pages: login, register, forgot password, with validation; they state honestly that accounts arrive in Phase 3
- [x] 2.7 Tutor chat layout (lesson list, conversation log, composer, disabled until Phase 4)
- [x] 2.8 Voice, Video studio, Mind map, Whiteboard, Quiz, Progress, History, Settings. Settings (language, level, theme) is functional and saved on this device
- [x] 2.9 Tests: 8 files, 50 tests passing

## Phase 3 — Backend, DB, auth ✅ (awaiting your approval)
- [x] 3.1 Models + migration 0002 (users, user_preferences, refresh_tokens, password_reset_tokens); reversible, `alembic check` clean
- [x] 3.2 Security: argon2id, HS256 JWT access tokens (15 min), opaque refresh tokens (stored as sha256) with rotation, reuse detection and race grace; CSRF header on cookie routes; Redis rate limits
- [x] 3.3 Auth endpoints: register, login, refresh, logout, change-password; `GET/PATCH /users/me`
- [x] 3.4 Password reset: single-use, 30-min, newest-link-only tokens; Mailer interface (console mailer in dev, SMTP when configured); revokes all sessions
- [x] 3.5 Preferences endpoints with validation (language, level, interests, TTS speed/voice, theme, daily goal)
- [x] 3.6 Migration 0003 (lessons, conversations, messages) + CRUD APIs with pagination
- [x] 3.7 Isolation tests: another user's IDs return 404 for read, update, delete, write and attach
- [x] 3.8 Frontend: in-memory access token + auto refresh, AuthProvider, protected routes with `?next=` return, real login/register/forgot/reset pages, user menu + sign out, preferences synced to the account, profile/password/interests in Settings, real lesson lists on Dashboard and History

## UI redesign (branch `ui-redesign`) ✅
- [x] R.1 Design system: ivory/charcoal pop style, purple/lavender/sun/tangerine/mint tokens, display + body fonts, pop utilities, float/marquee/page-flip keyframes, reduced-motion handling
- [x] R.2 Illustration library: robot tutor + avatar, books (closed, open with turning page, stack, notebook, cap), phone chat, laptop, tablet, microphone, headphones, speech bubbles, brain, neural net, atom, graph, flask, light bulb, mind map, video thumbnails, whiteboard, trophy, quiz card, globe, vocabulary cards, equation chips
- [x] R.3 Motion helpers: Float, Parallax, Reveal, CountUp, Marquee
- [x] R.4 Navigation: grouped floating sidebar with animated active pill, top bar, public site nav with mobile menu
- [x] R.5 Landing: "LEARN WITHOUT LIMITS." hero with layered parallax scene, marquees, steps, bento features, languages, real-fact counters, CTA
- [x] R.6 Home dashboard, AI Tutor classroom, new Language Learning page, Mind Maps, Whiteboard, Video Studio, Voice Learning, Quizzes, My Progress, Lesson History, Profile & Settings, auth split layout, 404
- [x] R.7 Tests updated (76 passing); visual check with Playwright at 1440 px and 390 px, light + dark: no page errors, no horizontal overflow

## Phase 4 — AI tutor ✅ (branch `phase-4-ai-tutor`, awaiting your approval)
- [x] 4.1 LLM provider interface (`app/ai/llm`): Anthropic adapter (official SDK 2.4, `claude-opus-5-5`, streaming, structured outputs, prompt caching, effort per route, server-side refusal fallback) + clearly labelled mock provider; `LLM_PROVIDER=auto`
- [x] 4.2 Prompts: level-adaptive (beginner/intermediate/advanced), language rules for 6 languages (native script + English technical terms), interests, lesson plan in context, understanding-check question after each idea; cache-stable system prompt
- [x] 4.3 Lesson plans via validated structured output (`POST /tutor/lessons`) → lesson + conversation
- [x] 4.4 Streaming replies over SSE with conversation memory (last 30 messages), refusal and error handling; replies saved with model and token usage
- [x] 4.5 Lesson summaries (`POST /tutor/lessons/{id}/summary`), section progress (`completed_sections`, `current_section`)
- [x] 4.6 Frontend: lesson starter, lesson classroom (streaming chat, Markdown, stop, retry, quick follow-ups), plan checklist with "Study", summary card, Mock AI badges; Dashboard "Start lesson" and lesson links are live
- [x] 4.7 Tests: backend 66 (incl. fake-SDK and real-SDK-over-mock-transport checks), frontend 87; live browser run through the dev servers
- [ ] Deferred: mastery tracking from understanding checks → Phase 13 (needs `topic_mastery`, migration 0008); quiz generation → Phase 13; RAG over uploaded material → later phase (no upload UI yet)

## Phase 5 — Speech abstraction ✅ (branch `phase-5-speech`, awaiting your approval)
- [x] 5.1 `STTProvider` / `TTSProvider` interfaces (`app/ai/speech/base.py`): `Transcript`, `AudioResult`, `Voice`, capability methods, `SpeechError` / `ProviderNotConfigured` / `UnsupportedLanguage`
- [x] 5.2 Mock providers: STT returns a clearly labelled placeholder transcript (with real WAV duration); TTS returns a real WAV with realistic duration, two voices and speed control (quiet tones per word, obviously not speech)
- [x] 5.3 Gnani adapters as disabled placeholders: no endpoints, auth or payload formats; no network code; report why they are unavailable (disabled / missing credentials / not implemented)
- [x] 5.4 Config: `STT_PROVIDER`, `TTS_PROVIDER`, `GNANI_*` (backend only), `SPEECH_MAX_AUDIO_BYTES`, `SPEECH_MAX_TTS_CHARS`, `SPEECH_RATE_LIMIT`
- [x] 5.5 API: `GET /speech/info` (providers, availability, voices, language matrix, limits), `POST /speech/transcribe` (raw audio body; type, magic-byte, size and length checks), `POST /speech/synthesize` (audio + `X-Speech-*` headers); rate-limited
- [x] 5.6 Frontend: `lib/api/speech.ts` client (+ `apiRaw` for binary bodies), live "Speech services" card and real voice list on Voice Learning
- [x] 5.7 Tests: backend 106 (40 new), frontend 92 (5 new); live round-trip through the dev servers; Playwright check of Voice Learning at 1440 px (light) and 390 px (dark)

## Phases 6–15
Broken into tasks when each phase starts (see DEVELOPMENT_ROADMAP.md).
