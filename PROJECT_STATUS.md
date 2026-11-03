# Project Status

**Current phase:** 6 — Speech-to-text UI and pipeline ✅ complete on branch `phase-6-stt`. ⏸ **Awaiting your approval** before Phase 7 (text-to-speech playback).
`main` (also on GitHub): Phases 0–5 + UI redesign (`e718947`).
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

- **Phase 5 (speech abstraction):** STT/TTS provider interfaces; mock providers (labelled placeholder transcript, real WAV audio with realistic duration, two voices, speed); Gnani adapters as disabled placeholders with no invented API details; `/speech/info`, `/speech/transcribe`, `/speech/synthesize` with upload validation and rate limits; live speech status and voice list on Voice Learning.

- **Phase 6 (speech-to-text UI):** microphone recording with permission handling, validation, 60 s limit and cancel; transcription in the lesson language; dictation in the lesson classroom (correct, then send as voice input); Voice Learning records and lists editable transcripts.

## Test results (actually executed, 2026-11-03)
| Suite | Result |
|---|---|
| Backend (`pytest`, real Postgres + Redis test DB) | 107 passed |
| Backend lint (`ruff check`) | clean |
| Frontend (`vitest run`) | 16 files, 103 tests passed |
| Frontend lint (`oxlint`) / build (`tsc -b && vite build`) | clean / success |
| Claude adapter vs real SDK 2.4 over a mocked HTTP transport | request shape verified (beta header, `fallbacks`, effort, cache control, JSON schema); stream + parse round-trip OK |
| Live tutor flow (browser via Playwright, mock AI) | start lesson → classroom → streamed reply → section marked done; no page errors or overflow at 1440/390 px |
| Live speech round-trip via curl through the Vite proxy (mock) | `/speech/info` 200 → Hindi text synthesized to a 2.7 s WAV → same WAV transcribed (duration 2714 ms, labelled mock transcript) |
| Real-browser voice input (Playwright, Chromium fake microphone) | Voice Learning: record 2 s → real WebM accepted (200) → transcript shown → corrected. Lesson: dictate → text in composer → sent with `input_mode: "voice"` → reply streamed. 1440 px light, 390 px dark; no page errors |
| Voice Learning page (Playwright) | 1440 px light + 390 px dark: no page errors, no overflow |
| Live E2E via curl through the Vite proxy | register 201 → reset request 202 → link found in backend log → confirm 204 → login with new password 200 → old session refresh 401 |

## Known limitations
- **No real model output has been tested yet**: no `ANTHROPIC_API_KEY` is configured, so every AI response so far comes from the mock. The quality of real plans and explanations (especially in Indic languages) still needs checking with a key.
- Deferred from the Phase 4 roadmap: mastery tracking from understanding checks and quiz generation (Phase 13), RAG over uploaded material (no upload UI yet).
- Stopping a reply mid-stream discards it (not saved).
- No email-address change or account deletion yet.
- Without SMTP settings, password-reset emails are written to the backend log (dev only).
- Speech is mock-only: transcripts are placeholders and read-aloud plays tones. Real microphone audio is recorded and uploaded, but not recognised until Gnani is integrated.
- Voice Learning transcripts are not saved yet (Phase 8). Real speech needs Gnani's official docs + key.
- The dev server's auto-reload did not pick up newly created router files on Windows; restart uvicorn after adding modules.
- Playwright is used for visual screenshots; the automated E2E suite is still planned for Phase 14.
- Main JS bundle is 156 kB gzip after adding `motion` (was 96 kB); could be trimmed with `LazyMotion` if needed.

## Next (after approval)
- Phase 7: text-to-speech playback: play/pause/speed controls on tutor replies and in Voice Learning, voice and speed preferences, using the mock voice until Gnani is configured.

## Blockers / pending inputs
- `ANTHROPIC_API_KEY` to switch the tutor from mock to Claude (add to `.env`, restart the backend).
- Gnani documentation + key (any time after Phase 5).
- Optional SMTP credentials.
