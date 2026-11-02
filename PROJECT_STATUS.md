# Project Status

**Current phase:** 3 — Backend, database, authentication ✅ complete. ⏸ **Awaiting your approval** before Phase 4 (AI tutor).
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

## Test results (actually executed, 2026-11-03)
| Suite | Result |
|---|---|
| Backend (`pytest`, real Postgres + Redis test DB) | 44 passed |
| Backend lint (`ruff check`) | clean |
| Frontend (`vitest run`) | 11 files, 75 tests passed |
| Frontend lint (`oxlint`) / build (`tsc -b && vite build`) | clean / success |
| Live E2E via curl through the Vite proxy | register 201 → reset request 202 → link found in backend log → confirm 204 → login with new password 200 → old session refresh 401 |

## Known limitations
- Lessons can only be created via the API until the AI tutor (Phase 4) creates them from the UI.
- No email-address change or account deletion yet.
- Without SMTP settings, password-reset emails are written to the backend log (dev only).
- No real-browser (Playwright) run yet; planned for Phase 14.

## Next (after approval)
- Phase 4: LLM provider abstraction (Anthropic + clearly labelled mock), streaming tutor chat (SSE), lesson plans, level-adaptive and language-aware prompts, summaries, understanding checks. **Needs `ANTHROPIC_API_KEY`** for real responses.

## Blockers / pending inputs
- `ANTHROPIC_API_KEY` for Phase 4.
- Gnani documentation + key (any time after Phase 5).
- Optional SMTP credentials.
