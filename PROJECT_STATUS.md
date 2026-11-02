# Project Status

**Current phase:** 4 — AI tutor ✅ complete on branch `phase-4-ai-tutor` (not yet committed). ⏸ **Awaiting your approval** before Phase 5 (speech provider abstraction).
`main`: Phases 0–3 (`f8155ab`) + UI redesign (`5fb573d`).
**Last updated:** 2026-11-03

## Completed
- **Phase 0:** planning documents approved.
- **Phase 1:** Docker (Postgres + pgvector, Redis), FastAPI health API, React scaffold.
- **Phase 2:** design system, app shell, all 12 pages.
- **Phase 3:**
  - Database: migrations 0002 (auth) and 0003 (lessons, conversations, messages); tested up, down and up again; models match the schema (`alembic check`).
  - Auth API: register, login, refresh (rotation + reuse detection), logout, change password, password reset by email link. argon2id hashing, JWT access tokens, httpOnly refresh cookie, CSRF header, rate limits.
  - User API: profile and preferences.
  - Learning API: lessons and conversations CRUD, message persistence, pagination; strict per-user isolation.
  - Frontend: real sign-up/sign-in/reset flows, protected routes, user menu, preferences saved to the account, Settings → Account (profile, password) and interests, real lesson lists.

- **UI redesign (branch `ui-redesign`):** new visual identity, SVG illustration library, Framer Motion animations, redesigned pages, and a new Language Learning section (UI only). Backend unchanged. See TASKS.md › UI redesign and DECISIONS D-026–D-031.

- **Phase 4 (AI tutor):** Claude-backed tutor with a labelled mock fallback; lesson plans (validated structured output), streamed level- and language-adaptive replies with memory and understanding checks, summaries, section progress; classroom UI. Runs on the mock until `ANTHROPIC_API_KEY` is set.

## Test results (actually executed, 2026-11-03)
| Suite | Result |
|---|---|
| Backend (`pytest`, real Postgres + Redis test DB) | 66 passed |
| Backend lint (`ruff check`) | clean |
| Frontend (`vitest run`) | 13 files, 87 tests passed |
| Frontend lint (`oxlint`) / build (`tsc -b && vite build`) | clean / success |
| Claude adapter vs real SDK 2.4 over a mocked HTTP transport | request shape verified (beta header, `fallbacks`, effort, cache control, JSON schema); stream + parse round-trip OK |
| Live tutor flow (browser via Playwright, mock AI) | start lesson → classroom → streamed reply → section marked done; no page errors or overflow at 1440/390 px |
| Live E2E via curl through the Vite proxy | register 201 → reset request 202 → link found in backend log → confirm 204 → login with new password 200 → old session refresh 401 |

## Known limitations
- **No real model output has been tested yet**: no `ANTHROPIC_API_KEY` is configured, so every AI response so far comes from the mock. The quality of real plans and explanations (especially in Indic languages) still needs checking with a key.
- Deferred from the Phase 4 roadmap: mastery tracking from understanding checks and quiz generation (Phase 13), RAG over uploaded material (no upload UI yet).
- Stopping a reply mid-stream discards it (not saved).
- No email-address change or account deletion yet.
- Without SMTP settings, password-reset emails are written to the backend log (dev only).
- Playwright is used for visual screenshots; the automated E2E suite is still planned for Phase 14.
- Main JS bundle is 156 kB gzip after adding `motion` (was 96 kB); could be trimmed with `LazyMotion` if needed.

## Next (after approval)
- Phase 5: STT/TTS provider interfaces, mock providers, disabled Gnani adapters, configuration and tests.

## Blockers / pending inputs
- `ANTHROPIC_API_KEY` to switch the tutor from mock to Claude (add to `.env`, restart the backend).
- Gnani documentation + key (any time after Phase 5).
- Optional SMTP credentials.
