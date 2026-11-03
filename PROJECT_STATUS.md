# Project Status

**Current phase:** 9 — Multilingual + language courses ✅ complete on branch `phase-9-languages`. Awaiting your approval before Phase 10 (mind maps).
`main` (also on GitHub): Phases 0–8 + UI redesign (`ea62b02`).
**Last updated:** 2026-11-04

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

- **Phase 7 (text-to-speech UI):** read-aloud for every tutor reply with play/pause/resume/stop, progress and live speed; long replies read in sentence pieces with prefetching; voice and speed saved to the account; read-aloud disabled with a reason when unsupported; working Playback card and transcript read-back on Voice Learning; live provider info in Settings.

- **Phase 8 (voice tutor):** live spoken conversations over a WebSocket: speak (or type), the transcript is sent or held for correction, the reply streams as text and is spoken sentence by sentence while it is still being written; interrupt or ask something new at any time; automatic reconnection with history; spoken reply style; Voice Learning rebuilt around conversations.

- **Phase 9 (multilingual + language courses):** eight world-language courses with CEFR levels: AI-generated vocabulary with spaced-repetition review, grammar, listening, reading, writing (model feedback) and speaking practice marked on the server, role-play conversations in the target language through the voice tutor, and course progress. Speech accepts course languages. A per-language evaluation set checks replies come back in the right language and script.

## Test results (actually executed, 2026-11-04)
| Suite | Result |
|---|---|
| Backend (`pytest`, real Postgres + Redis test DB) | 169 passed (incl. 15 WebSocket and 31 course unit tests) |
| Backend lint (`ruff check`) | clean |
| Frontend (`vitest run`) | 19 files, 135 tests passed (three consecutive full runs) |
| Frontend lint (`oxlint`) / build (`tsc -b && vite build`) | clean / success |
| Claude adapter vs real SDK 2.4 over a mocked HTTP transport | request shape verified (beta header, `fallbacks`, effort, cache control, JSON schema); stream + parse round-trip OK |
| Live tutor flow (browser via Playwright, mock AI) | start lesson → classroom → streamed reply → section marked done; no page errors or overflow at 1440/390 px |
| Live speech round-trip via curl through the Vite proxy (mock) | `/speech/info` 200 → Hindi text synthesized to a 2.7 s WAV → same WAV transcribed (duration 2714 ms, labelled mock transcript) |
| Migration 0004 | upgrade → downgrade → upgrade on the dev database; `alembic check` clean |
| Language evaluation (mock provider) | pipeline runs end to end: 26 cases; English cases pass, other languages fail as expected because the mock replies in English (the checks correctly catch this, including for Latin-script languages) |
| Real-browser language courses (Playwright, Chromium, through the Vite proxy) | Enrol German A2 → add 8 words → review one (7 due) → grammar marked 100% → listening audio plays → writing feedback 50% (mock) → speaking recorded with the fake mic and marked → role-play opens live in Voice Learning and replies → progress shows a 1-day streak. 1440 px light, 390 px dark; no page errors, no 5xx, no overflow |
| Real-browser voice tutor (Playwright, Chromium fake microphone, through the Vite proxy) | New conversation → Live → spoken question transcribed and auto-sent → reply streamed with 7 audio sentences → Stop tutor (interrupted; unfinished reply not saved) → review mode: transcript corrected and sent → answered → page reload reconnects with the same history. 1440 px light, 390 px dark; no page errors |
| Real-browser read-aloud (Playwright, Chromium) | Voice and speed saved → sample synthesized (WAV, mock-calm) and played to the end → settings kept after reload. Lesson reply synthesized and played with progress, then paused, resumed and stopped. 1440 px light, 390 px dark; no page errors |
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
- A voice session stays authorised until it disconnects (the token is checked at connect and each reconnect); per-sentence speech inside a turn is not separately rate-limited (turns are).
- Speech recognition is per recording (no streaming recognition while you talk); the mock returns placeholder text.
- The mock AI writes Markdown even in voice conversations; the spoken style applies to the real model.
- Course content quality (vocabulary, exercises, feedback, role-play) is untested with a real model: no API key yet. The mock produces clearly labelled placeholder material.
- Speaking scores are only meaningful with real speech recognition (the mock 'hears' placeholder text).
- The listening transcript is sent to the browser (hidden until shown), so a determined learner can read it early.
- Subtitle languages are deferred to Phase 12 (videos). Real speech needs Gnani's official docs + key.
- The dev server's auto-reload did not pick up newly created router files on Windows; restart uvicorn after adding modules.
- Playwright is used for visual screenshots; the automated E2E suite is still planned for Phase 14.
- Main JS bundle is 156 kB gzip after adding `motion` (was 96 kB); could be trimmed with `LazyMotion` if needed.

## Next (after approval)
- Phase 10: mind maps — schema, AI generation with validation, React Flow rendering, collapse/expand, export (migration 0005).

## Blockers / pending inputs
- `ANTHROPIC_API_KEY` to switch the tutor from mock to Claude (add to `.env`, restart the backend).
- Gnani documentation + key (any time after Phase 5).
- Optional SMTP credentials.
