# Project Status

**Current phase:** 12 — Video generation ✅ complete on branch `phase-12-video` (⏸ checkpoint). Next is Phase 13 (quizzes and progress).
`main` (also on GitHub): Phases 0–11 + UI redesign (`09e559e`).
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

- **Phase 10 (mind maps):** generated, validated mind maps (from any topic or from a lesson's plan) shown with React Flow: colour-coded ideas, collapse/expand, drag to rearrange (saved), edit/add/delete ideas, grow a branch with AI, and export to PNG, SVG, JSON or a Markdown outline.

- **Phase 11 (drawing and diagrams):** the whiteboard draws flowcharts, block diagrams, cycles, timelines and function graphs step by step (layout computed by the app; formulas through a whitelisted parser), with playback controls, read-aloud step explanations, a freehand layer (pen, highlighter, eraser, undo/redo), blank sketch boards, and PNG/SVG/JSON export.

- **Phase 12 (video generation):** short animated lesson videos made in the background by a Docker worker (Manim scenes from six templates + FFmpeg), with narration per scene when a real voice is configured, subtitles timed to the narration (in the player and embedded in the MP4), live progress, cancel, delete, download, and a "Make a video" button on lessons.

## Test results (actually executed, 2026-11-04)
| Suite | Result |
|---|---|
| Backend (`pytest`, real Postgres + Redis test DB) | 259 passed, 1 skipped (the real render test, which runs in the worker image) |
| Real rendering inside the worker image (`test_video_render.py`) | 1 passed in 27 s: all six templates incl. a Hindi scene rendered and joined; ffprobe shows 854×480 H.264, AAC, `mov_text` subtitles tagged `eng`, duration matches the narration timing |
| Backend lint (`ruff check`) | clean |
| Frontend (`vitest run`) | 25 files, 197 tests passed (repeated full runs) |
| Frontend lint (`oxlint`) / build (`tsc -b && vite build`) | clean / success |
| Claude adapter vs real SDK 2.4 over a mocked HTTP transport | request shape verified (beta header, `fallbacks`, effort, cache control, JSON schema); stream + parse round-trip OK |
| Live tutor flow (browser via Playwright, mock AI) | start lesson → classroom → streamed reply → section marked done; no page errors or overflow at 1440/390 px |
| Live speech round-trip via curl through the Vite proxy (mock) | `/speech/info` 200 → Hindi text synthesized to a 2.7 s WAV → same WAV transcribed (duration 2714 ms, labelled mock transcript) |
| Real-browser video (Playwright with Edge, through the Vite proxy, worker in Docker) | Topic entered → queued → progress shown stage by stage (script, scenes 1–4, joining) → finished in 27 s → signed media link answered 206 `video/mp4` → the player loaded 18.4 s at 1280×720, played, and showed 4 subtitle cues; screenshot checked by eye; no page errors, no 5xx. (Playwright's own Chromium can't play H.264, hence Edge.) |
| Migration 0007 | upgrade → downgrade (drops both new enums) → upgrade; `alembic check` clean |
| Migration 0006 | upgrade → downgrade (drops the new enum) → upgrade; `alembic check` clean |
| Real-browser whiteboard (Playwright, Chromium, through the Vite proxy) | Flowchart, function graph, cycle and timeline each generated, revealed step by step and in full; a pen stroke saved and restored after reload; PNG, SVG and JSON exported; screenshots and the exported PNG checked by eye (a loop line crossing a box was found and fixed). 1440 px light, 390 px dark; no page errors, no 5xx |
| Migration 0005 | upgrade → downgrade → upgrade on the dev database; `alembic check` clean |
| Real-browser mind maps (Playwright, Chromium, through the Vite proxy) | Generate (11 ideas, 11 connections) → rename → expand with AI (14) → fold a branch and drag an idea → reload keeps the layout → PNG, SVG, JSON and outline downloaded and non-empty; exported PNG checked by eye (whole map, nothing cropped). 1440 px light, 390 px dark; no page errors, no 5xx |
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
- Videos are silent until a real voice (Gnani) is connected: the mock voice isn't speech, so mock videos carry subtitles only (labelled in the player).
- Video scripts from the mock AI are placeholders; real scripts need `ANTHROPIC_API_KEY`.
- The video worker is a 2.4 GB Docker image and must be started separately (`docker compose --profile video up -d video-worker`); without it, videos wait in the queue and the page says so.
- One video renders at a time; a 60 s video at 720p takes roughly 30–60 s on this machine.
- Videos are stored on the local disk (`media/`); there's no cloud storage or automatic clean-up of old files yet (deleting a video removes its files).
- Subtitles are in the video's own language only (no translated subtitle tracks yet).
- SVG exports are large (≈ 3.7 MB) because all web fonts, including the Indic script fonts, are embedded; PNG is ≈ 60 kB.
- Mind maps are a tree plus a few cross-links; learners can't draw new cross-links yet (they come from generation).
- The whiteboard has no text tool or shapes for learners yet (pen, highlighter and eraser only); generated diagrams can't be edited, only drawn on.
- Exported board images use the browser's fonts (web fonts aren't embedded), so text may look slightly different from the page. Real speech needs Gnani's official docs + key.
- The dev server's auto-reload did not pick up newly created router files on Windows; restart uvicorn after adding modules.
- Playwright is used for visual screenshots; the automated E2E suite is still planned for Phase 14.
- Main JS bundle is 156 kB gzip after adding `motion` (was 96 kB); could be trimmed with `LazyMotion` if needed.

## Next (after approval)
- Phase 13: quizzes and progress — quiz generation and marking, mastery per topic from quizzes and understanding checks, the My Progress page (migration 0008).

## Blockers / pending inputs
- `ANTHROPIC_API_KEY` to switch the tutor from mock to Claude (add to `.env`, restart the backend).
- Gnani documentation + key (any time after Phase 5).
- Optional SMTP credentials.
