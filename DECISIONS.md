# Technical Decisions

| ID | Date | Decision | Rationale | Status |
|---|---|---|---|---|
| D-001 | 2026-11-03 | Monorepo: `frontend/`, `backend/`, root `docker-compose.yml` | Simple for one team; shared docs. | Proposed |
| D-002 | 2026-11-03 | Postgres, Redis and the video worker run in Docker. API and frontend run natively in dev | No native psql/ffmpeg on the Windows dev machine. Keeps reload fast. | Proposed |
| D-003 | 2026-11-03 | LLM: Anthropic Claude (`claude-opus-5-5`) behind an `LLMProvider` interface. Model per route set in config | Multilingual quality and structured outputs. The provider stays swappable. | Proposed |
| D-004 | 2026-11-03 | AI output is JSON specs only. Visuals come from our own renderers and templated Manim scenes | Never execute untrusted AI-generated code. | Proposed |
| D-005 | 2026-11-03 | Embeddings: local `intfloat/multilingual-e5-base` (768-d) + pgvector HNSW | Free, multilingual, private. | Proposed |
| D-006 | 2026-11-03 | Background jobs with `arq` (Redis) | Async-native and lightweight. RQ needs `fork`, which Windows lacks. | Proposed |
| D-007 | 2026-11-03 | No fine-tuning (PEFT/LoRA) in v1 | Not justified until evaluation data shows that prompting plus RAG falls short. | Proposed |
| D-008 | 2026-11-03 | Gnani: interfaces + mocks + disabled adapters only, until official docs and key are provided | Avoids fabricating an API. | Proposed |
| D-009 | 2026-11-03 | Auth: argon2id, 15-minute JWT access token, rotating hashed refresh token in an httpOnly cookie | Revocable sessions; no long-lived tokens in JS. | Proposed |
| D-010 | 2026-11-03 | Manim scenes use `Text` (no LaTeX) by default | Smaller image, faster renders. | Proposed |
| D-011 | 2026-11-03 | D-001 to D-010 approved with the Phase 0 plan | You approved the plan ("start building"). | Accepted |
| D-012 | 2026-11-03 | Frontend versions from the current Vite template: React 19, Vite 8, TypeScript 7, Tailwind v4 (CSS-first `@theme`, `@tailwindcss/vite`), oxlint | Current stable at scaffold time. Tailwind v4 needs no `tailwind.config.js`. | Accepted |
| D-013 | 2026-11-03 | Readiness checks are injected through a FastAPI dependency (`default_checks`) | Lets tests simulate dependency failures and timeouts without real services. | Accepted |
| D-014 | 2026-11-03 | Integration tests marked `@pytest.mark.integration` and excluded by default | Unit tests run anywhere. Integration tests need `docker compose up`. | Accepted |
| D-015 | 2026-11-03 | Semantic CSS-variable colour tokens (`bg-surface`, `text-muted`, …) with class-based dark mode | One place to theme; avoids `dark:` duplication across components. | Accepted |
| D-016 | 2026-11-03 | Contexts and hooks live in `*-context.ts` files; provider components in `.tsx` | Keeps Vite fast refresh working (oxlint `only-export-components`). | Accepted |
| D-017 | 2026-11-03 | Unbuilt features render real layouts with disabled actions and a `PhaseNotice`; never sample data | Your rule: no fake buttons and no hardcoded data standing in for functionality. | Accepted |
| D-018 | 2026-11-03 | Learner preferences stored in localStorage until Phase 3, then synced to `user_preferences` | Works before auth exists; same context API afterwards. | Accepted |
| D-019 | 2026-11-03 | Built our own Modal/Tabs/Toast (no headless UI library) | Small, accessible, tested; avoids a dependency for three components. | Accepted |
| D-020 | 2026-11-03 | CSRF: custom-header check (`X-CSRF-Protection: 1`) on cookie routes instead of a double-submit token (changes ARCHITECTURE §8) | Only refresh, logout and change-password use the cookie; a custom header forces a CORS preflight, which the allowlist blocks. Simpler, with no token to sync. | Accepted |
| D-021 | 2026-11-03 | Refresh rotation has a 30 s grace window: re-use of a just-rotated token returns `refresh_race` (the client retries) instead of revoking every session | Two tabs refreshing at once must not log the user out everywhere; real reuse after the window still revokes all sessions. | Accepted |
| D-022 | 2026-11-03 | Another user's resources return 404, never 403 | Doesn't confirm that someone else's IDs exist. | Accepted |
| D-023 | 2026-11-03 | Backend tests run against a separate `aitutor_test` DB (migrated by Alembic, truncated per test) and Redis DB 15; skipped with a message if Docker services are down | Real Postgres behaviour (CITEXT, enums, cascades); no mocks of the database. | Accepted |
| D-024 | 2026-11-03 | Theme stays a per-device setting (localStorage); language and level sync to the account | Theme is usually device-specific; the learning preferences follow the learner. | Accepted |
| D-025 | 2026-11-03 | Dev uvicorn runs with `--reload-dir app` | Watching `.venv` made `pip install` trigger a reload that hung. | Accepted |
| D-026 | 2026-11-03 | UI redesign: warm ivory + charcoal "pop" style (ink outlines, hard offset shadows), electric purple/lavender, sun, tangerine, mint; Bricolage Grotesque display + Plus Jakarta Sans body | Your redesign brief: premium, playful, game-inspired, not a generic admin panel. | Accepted |
| D-027 | 2026-11-03 | All illustrations are hand-built inline SVG React components (`components/illustrations`) with a fixed palette | One consistent style, no stock images or licensing, tiny payload, scalable, theme-independent. | Accepted |
| D-028 | 2026-11-03 | Animation via `motion` (Framer Motion) wrapped in `MotionConfig reducedMotion="user"`; reveals render immediately and CSS keyframes are disabled under `prefers-reduced-motion` | Accessibility; content never depends on an animation firing. | Accepted |
| D-029 | 2026-11-03 | New Language Learning section (`/app/languages`, 8 world languages, CEFR A1–C2) added to Phase 9 scope; UI only for now (language/level saved locally, practice disabled, sample flip-cards labelled as samples) | Requested in the redesign brief; backend changes were out of scope for this task. | Accepted |
| D-030 | 2026-11-03 | Navigation regrouped (Learn / Visualise / Track / You) with your 8 brief items; Whiteboard, Quizzes and Lesson History kept | Preserve all existing functionality. | Accepted |
| D-031 | 2026-11-03 | Playwright added as a dev dependency (used for visual checks now, E2E in Phase 14) | Unit tests can't catch layout and visual regressions. | Accepted |
