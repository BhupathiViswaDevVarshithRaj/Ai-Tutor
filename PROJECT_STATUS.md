# Project Status

**Current phase:** 13 — Assessment and progress ✅ complete on branch `phase-13-assessment`. Next is Phase 14 (testing and hardening).
`main` (also on GitHub): Phases 0–12 + UI redesign (`45ed408`).
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

- **Phase 13 (assessment and progress):** generated quizzes (multiple choice and short answer) marked by rule or by the AI, results by idea with explanations and next steps, mastery per idea with a revision schedule, quick understanding checks from lessons, and a real My Progress page (scores trend, active days, strong and weak ideas, revision plan).
- **Phase 14 (testing and hardening):** 12 Playwright end-to-end journeys (sign-up/sign-in, lesson + tutor + progress, voice input, quiz → My Progress, mind map, whiteboard, language words, video queue, privacy between two learners, phone layout and menu) on their own mock backend; security headers, a 4 MB body limit, per-user limits for AI/speech/video, docs off in production; a route-table test that every ID route refuses other users; an N+1 query guard; main bundle trimmed 157 → 117 kB gzip.

- **Phase 15 (deployment), prepared and tested locally (2026-11-11, branch `phase-15-deploy`):** production Docker setup with Caddy (HTTPS, security headers, streaming and WebSocket proxying), images for amd64 and ARM64 (Oracle Ampere), secrets generated on the server, daily backups with a tested restore, a step-by-step DEPLOYMENT.md for Oracle Cloud Always Free + DuckDNS. Not yet deployed: waiting for your Oracle server and DuckDNS name.
- **Video accuracy and visuals (2026-11-05, branch `video-visuals`):** scripts are written from Wikipedia text and reviewed against it, with fact-check status and sources shown under each video; new animated mind map (branches appear as they are explained), cycle, comparison and bar chart scenes; an "Explain it as: Mind map" option; a repeatable quality eval.
- **Real pictures in videos (2026-11-05, branch `video-3d`):** an `image` scene shows a real photo from Wikimedia Commons with its facts and credit; live check: "AK-47 rifle: its parts and history" → the public-domain photo of the rifle, narrated 66 s video. Basic solids are no longer passed off as real objects.
- **Video Studio 3D (2026-11-05, branch `video-3d`):** three 3D scene templates (solids, molecules, surfaces) that turn slowly with labels and facts; Groq chooses them when a topic has a shape, a structure in space or a two-variable function.

## Test results (actually executed, 2026-11-04/05)
| Suite | Result |
|---|---|
| Production stack on this PC (2026-11-11, `https://localhost`, mock AI) | All 6 services up, API healthy; HTTP → HTTPS redirect; CSP, HSTS, Permissions-Policy present; real Chromium: sign-up with secure cookie, reload keeps the session, Google Fonts load under the CSP, tutor reply streams through Caddy, microphone recording uploads, quiz, a video rendered by the worker and playable; no CSP violations or 5xx; dark theme still applied before paint. Voice WebSocket over `wss://` through Caddy: handshake, streamed reply and audio. 12 sign-ins with a different fake X-Forwarded-For each: 11th and 12th blocked (429). Backup → delete all users → `restore.sh` → users back |
| ARM64 images (2026-11-11, built under emulation) | web: built. api: built, runs on aarch64, imports OK. video worker: built (manimpango, moderngl and pycairo compile from source, about 12 min under emulation), runs on aarch64 as the non-root user, rendered a mind map scene (51 s under emulation) |
| Video quality eval (2026-11-05, real Groq) | 8 topics, baseline (model alone) → first full version: visual share 0.67 → 1.00, right scene type 4 → 8 of 8, sourced numbers stated 2 → 6, unsupported numbers 2 → 0, expected facts 0.97 → 0.94. Reading those scripts found problems the scores hid (a true bond angle deleted, Mars missing from a list, no chart for sizes), since fixed except the chart. Retest of the 4 most affected topics after fixes: water molecule has its 3D model and 104.5°; "Sizes of the planets" still gets a comparison, not a chart. Not all 8 re-run after the final fixes: the free daily token limit was reached |
| Real video, all steps but the AI call (2026-11-05) | A Groq script written earlier replayed through real Wikipedia, Gnani, Commons, Manim and FFmpeg: narrated 58 s video (60 s asked) at 1280×720 with a mind map, photo and chart. Frames compared with subtitle times: branches appear as they are spoken. A mind-map video through the live model is **not yet confirmed** after the final fixes (two attempts failed with an unusable draft before them; the daily limit stopped a retest and the raw output could not be captured) |
| Tests after this work (2026-11-05) | Backend 367 passed, 1 skipped; real render test with all 14 templates 1 passed; frontend 202 passed (`--maxWorkers=2`); Playwright E2E 12 passed; `alembic check` clean |
| Pictures in videos (2026-11-05) | Backend 329 passed, 1 skipped (picture search with a stand-in transport: photos first, unusable/foreign files skipped, offline → none; pipeline fallback and credits); real render test in the worker with all 10 templates incl. a picture — 1 passed; frontend 202 passed (`--maxWorkers=2`). Live: Commons found real photos for an AK-47, a microscope and a 3D printer (3–6 s per search, 8–9 s per scene render at 480p) |
| 3D video templates (2026-11-05) | Real render test in the worker image: all 9 templates (incl. cuboid, water, a Gaussian surface and a Hindi summary) joined into one subtitled video — 1 passed. Live through the app with Groq + Gnani: "Shapes of molecules" → 2 `molecule3d` scenes (water bent, methane tetrahedral), 61.5 s 1280×720, narrated; "Cylinder" → a `model3d` cylinder with r/h; "Functions of two variables" → a `surface3d` of sin(x)·cos(y) (after the formula fix). Frames checked by eye. Backend 317 passed, 1 skipped; frontend 202 passed (with `--maxWorkers=2`: at full parallelism page tests time out while other apps keep the CPU at ~50%) |
| Backend (`pytest`, real Postgres + Redis test DB) | 303 passed, 1 skipped (the real render test, which runs in the worker image) |
| E2E (`npm run e2e`, Playwright Chromium, desktop + Pixel 7) | 12 passed, two full runs in a row (≈ 1 min each), and again after the bundle change |
| Isolation (`test_isolation.py`) | all 17 ID routes in the OpenAPI schema answer 404 to another user; creating quizzes, maps, diagrams, videos or conversations on another user's lesson → 404; lists and My Progress empty for the other user |
| Hardening (`test_hardening.py`) | headers present (also on streamed replies), 413 for large and chunked bodies, audio exempt, per-user AI limit (Alice limited, Bob not), production hides /docs and sends HSTS |
| Query counts (`test_query_counts.py`) | same number of SQL statements for 1 and 4 of everything: lessons 4, conversations 4, quizzes 7, maps 4, diagrams 4, videos 3, My Progress 18, languages 5, vocabulary 3 |
| Response times (`e2e/perf.py`, 15 of everything, mock AI) | p50 / p95: /users/me 5 / 6 ms, lists 6–13 / 7–16 ms, /progress 20 / 28 ms |
| Frontend bundle | main chunk 117 kB gzip (was 157); animation features 19 kB, loaded after first render |
| Real rendering inside the worker image (`test_video_render.py`) | 1 passed in 27 s: all six templates incl. a Hindi scene rendered and joined; ffprobe shows 854×480 H.264, AAC, `mov_text` subtitles tagged `eng`, duration matches the narration timing |
| Backend lint (`ruff check`) | clean |
| Frontend (`vitest run`) | 26 files, 202 tests passed (repeated full runs) |
| Frontend lint (`oxlint`) / build (`tsc -b && vite build`) | clean / success |
| Claude adapter vs real SDK 2.4 over a mocked HTTP transport | request shape verified (beta header, `fallbacks`, effort, cache control, JSON schema); stream + parse round-trip OK |
| Live tutor flow (browser via Playwright, mock AI) | start lesson → classroom → streamed reply → section marked done; no page errors or overflow at 1440/390 px |
| Live speech round-trip via curl through the Vite proxy (mock) | `/speech/info` 200 → Hindi text synthesized to a 2.7 s WAV → same WAV transcribed (duration 2714 ms, labelled mock transcript) |
| Real-browser quiz + progress (Playwright, Chromium, through the Vite proxy, mock AI) | Generate a 5-question quiz → answer (one wrong, one short answer partly right) → marked 70% (3.5/5) with results by idea and next steps → My Progress shows the attempt on the chart, 1 active day, a strong idea and 3 revision items. Screenshots checked by eye at 1440 px light and 390 px dark (chart text was too small on phones; fixed by drawing at the real width); no page errors, no 5xx, no overflow |
| Migrations 0008 + 0009 | upgrade → downgrade (drops the new enum) → upgrade; `alembic check` clean |
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
- Deferred from the Phase 4 roadmap: RAG over uploaded material (no upload UI yet).
- Mastery comes from quizzes (including lesson "Quiz me" checks), not from the tutor's in-chat questions.
- Learning time isn't tracked (no `learning_sessions` table); My Progress shows active days and a streak instead, counted in UTC.
- Quiz content and short-answer marking from the mock AI are placeholders (the mock marks by shared words); tests still use the mock.
- Stopping a reply mid-stream discards it (not saved).
- No email-address change or account deletion yet.
- Without SMTP settings, password-reset emails are written to the backend log (dev only).
- **Groq + Gnani connected (2026-11-04, branch `phase-gnani-groq`):** Groq (`openai/gpt-oss-120b`) writes tutor replies, lesson plans, quizzes, marking, mind maps, diagrams, video scripts and course material; Gnani does speech-to-text and read-aloud for English and nine Indian languages. Checked live: all 9 structured formats, a streamed reply, a quiz, TTS and STT through the API (WebM and > 30 s recordings too).
- Gnani has no voices for the world-course languages (German, French, …), so speech is unavailable there. Gnani response time varies (1–9 s per call observed, also with curl).
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
- A video now uses about 3 times the AI tokens (roughly 11,000 instead of 3,500, estimated): about 18 videos a day on Groq's free 200,000-token limit, shared with the tutor. Upgrading the Groq account raises it.
- Fact-checking is by the AI against a short Wikipedia excerpt: it reduces errors but can't guarantee none, and the excerpt may not contain every key fact. Reference text is English only.
- Mind maps can be explained only by the video's own script; a saved map from the Mind Maps page can't be turned into a video yet.
- This network intermittently fails certificate checks on outgoing connections (retried, never bypassed).
- Production media (videos, pictures) lives on the server's disk; there's no object storage, and media isn't in the backups.
- Off-server copies of backups are manual (`scp`, see DEPLOYMENT.md).
- Pictures depend on what Wikimedia Commons has; a topic with no good free picture gets text instead. Searches are in English.
- 3D scenes take ~1–1.5 min each to render at 720p (at most two per video). Molecules use ideal VSEPR angles (lone pairs aren't drawn); only single bonds are shown.
- Videos are stored on the local disk (`media/`); there's no cloud storage or automatic clean-up of old files yet (deleting a video removes its files).
- Subtitles are in the video's own language only (no translated subtitle tracks yet).
- SVG exports are large (≈ 3.7 MB) because all web fonts, including the Indic script fonts, are embedded; PNG is ≈ 60 kB.
- Mind maps are a tree plus a few cross-links; learners can't draw new cross-links yet (they come from generation).
- The whiteboard has no text tool or shapes for learners yet (pen, highlighter and eraser only); generated diagrams can't be edited, only drawn on.
- Exported board images use the browser's fonts (web fonts aren't embedded), so text may look slightly different from the page.
- The dev server's auto-reload did not pick up newly created router files on Windows; restart uvicorn after adding modules.
- E2E runs use the mock AI and mock speech (free and repeatable); Groq and Gnani are covered by unit tests with stand-in clients and by the live checks recorded above. Video rendering isn't part of E2E (no worker), only queueing.
- Rate limits are fixed windows in Redis and fail open if Redis is down. Sign-in limits are per IP, so behind the Phase 15 proxy uvicorn must trust its forwarded headers (`--proxy-headers`).
- Page-level headers for the web app (CSP, Permissions-Policy for the microphone, HSTS) are set by the web server in Phase 15; the API sets its own.

## Next (after approval)
- Deploy: create the Oracle server and DuckDNS name (DEPLOYMENT.md steps 1–3), then follow steps 4–7 on the server.

## Blockers / pending inputs
- Re-run a live mind-map video and the full 8-topic eval once Groq's daily allowance has refilled.
- Optional: `ANTHROPIC_API_KEY` to use Claude instead of Groq.
- Optional SMTP credentials.
