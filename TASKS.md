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

## Phases 4–15
Broken into tasks when each phase starts (see DEVELOPMENT_ROADMAP.md).
