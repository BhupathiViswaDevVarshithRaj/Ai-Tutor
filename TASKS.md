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

## Phase 5 — Speech abstraction ✅ (merged to `main`)
- [x] 5.1 `STTProvider` / `TTSProvider` interfaces (`app/ai/speech/base.py`): `Transcript`, `AudioResult`, `Voice`, capability methods, `SpeechError` / `ProviderNotConfigured` / `UnsupportedLanguage`
- [x] 5.2 Mock providers: STT returns a clearly labelled placeholder transcript (with real WAV duration); TTS returns a real WAV with realistic duration, two voices and speed control (quiet tones per word, obviously not speech)
- [x] 5.3 Gnani adapters as disabled placeholders: no endpoints, auth or payload formats; no network code; report why they are unavailable (disabled / missing credentials / not implemented)
- [x] 5.4 Config: `STT_PROVIDER`, `TTS_PROVIDER`, `GNANI_*` (backend only), `SPEECH_MAX_AUDIO_BYTES`, `SPEECH_MAX_TTS_CHARS`, `SPEECH_RATE_LIMIT`
- [x] 5.5 API: `GET /speech/info` (providers, availability, voices, language matrix, limits), `POST /speech/transcribe` (raw audio body; type, magic-byte, size and length checks), `POST /speech/synthesize` (audio + `X-Speech-*` headers); rate-limited
- [x] 5.6 Frontend: `lib/api/speech.ts` client (+ `apiRaw` for binary bodies), live "Speech services" card and real voice list on Voice Learning
- [x] 5.7 Tests: backend 106 (40 new), frontend 92 (5 new); live round-trip through the dev servers; Playwright check of Voice Learning at 1440 px (light) and 390 px (dark)

## Phase 6 — Speech-to-text (UI + pipeline) ✅ (merged to `main`)
- [x] 6.1 `useRecorder`: microphone permission, MediaRecorder with the best supported container (WebM/Opus → Ogg → MP4), 60 s auto-stop, live timer, cancel, microphone always released (also on unmount)
- [x] 6.2 Validation: clear messages for blocked / missing / busy microphone and unsupported browsers; recordings under 0.5 s discarded; size checked against the server limit before upload
- [x] 6.3 `useDictation`: upload to `/speech/transcribe` in the chosen language, server errors shown, mic disabled with a reason when speech recognition is unavailable or doesn't support the language
- [x] 6.4 Lesson classroom: mic dictates into the message box for correction; sent with `input_mode: "voice"` (kept on retry); composer grows with the text
- [x] 6.5 Voice Learning: working mic and Stop, transcript list with correction ("Corrected" badge, undo) and remove
- [x] 6.6 Tests: frontend 103 (11 new, fake microphone helper), backend 107 (voice input mode stored); real Chromium run with a fake microphone device: real WebM uploads accepted, transcripts shown, dictated message sent as voice, 1440 px light / 390 px dark

## Phase 7 — Text-to-speech (UI + pipeline) ✅ (merged to `main`)
- [x] 7.1 Speech text: Markdown replies converted to plain spoken sentences (code blocks skipped) and split into ≤400-character pieces at sentence ends (incl. the danda) or, if needed, between words
- [x] 7.2 `useSpeechPlayer`: pieces synthesized in order with the next one prefetched; play / pause / resume / stop; progress across pieces; cached audio; object URLs released; blocked-autoplay and network errors explained
- [x] 7.3 Voice + speed preferences saved to the account (optimistic, rolled back on error); speed applies immediately via `playbackRate`
- [x] 7.4 Capability gating: read-aloud disabled with a reason when the provider is unavailable or doesn't support the language
- [x] 7.5 Lesson classroom: Listen / Pause / Resume on every tutor reply; playback bar (play latest reply, stop, progress, speed)
- [x] 7.6 Voice Learning: working speed and voice controls, "Hear a sample" in each tutor language, Listen on transcripts
- [x] 7.7 Settings → System shows the live AI model and speech providers (replacing static text)
- [x] 7.8 Tests: frontend 117 (14 new, fake audio helper); real Chromium run: sample played to the end, voice/speed kept after reload, lesson reply played with progress, pause, resume and stop; 1440 px light / 390 px dark

## Phase 8 — Voice tutor ✅ (merged to `main`)
- [x] 8.1 WebSocket `/api/v1/voice/ws`: hello handshake with access token, origin check, conversation ownership; close codes 4400/4401/4403/4404; ping/pong
- [x] 8.2 Recording upload over the socket (header + binary frame), validated with the same checks as `/speech/transcribe`, then transcribed
- [x] 8.3 Turns reuse the tutor pipeline (`turn_events`, shared with the SSE route); spoken reply style for voice conversations
- [x] 8.4 Streaming speech: sentence splitter (incl. danda, Markdown stripped) → TTS task → ordered audio frames while the model is still writing; continues as text-only if TTS is unavailable
- [x] 8.5 Interruption and barge-in cancel the model and speech; unfinished replies are not saved; per-turn numbering drops late frames
- [x] 8.6 Rate limits on turns (AI) and recordings (speech) for socket clients (`check_rate_limit`)
- [x] 8.7 Frontend: `VoiceConnection` (token hello, refresh on 4401, reconnect with backoff, audio frame pairing), `AudioQueue`, `useVoiceTutor`; Voice Learning rebuilt: recent voice conversations, new conversation, live session (mic, stop tutor, auto-send or review-and-correct, type instead, live log), playback + speech services cards; conversation kept in the URL so a reload resumes it
- [x] 8.8 `GET /conversations?mode=voice`; Voice Learning no longer marked "soon"
- [x] 8.9 Tests: backend 125 (18 new, WebSocket tests with `httpx-ws`), frontend 124 (13 new, fake WebSocket); real Chromium run with a fake microphone: speak → transcript → streamed reply with 7 audio sentences → interrupt → review-and-correct → reply → reload reconnects with history; 1440 px light / 390 px dark

## Phase 9 — Multilingual + language courses ✅ (merged to `main`)
- [x] 9.1 Migration 0004: `language_enrollments`, `vocab_items` (SM-2 state), `practice_sessions`; reversible, `alembic check` clean
- [x] 9.2 Courses API (`/languages`): course list with level and word counts, enrol / change CEFR level (A1–C2)
- [x] 9.3 Vocabulary: AI-generated words at the learner's level (articles for gendered nouns, readings for ja/ko/zh, examples), deduplicated per deck; SM-2 review (again/hard/good/easy); delete
- [x] 9.4 Practice generated with validated structured output: grammar lesson + exercises, listening script + questions, graded reading + questions, writing task, speaking phrases; answers withheld from the API until submission
- [x] 9.5 Marking: grammar/listening/reading by rule (Unicode-normalised, accepted alternatives), speaking by similarity of the recognised speech (works for CJK), writing by the model (corrections, strengths, score)
- [x] 9.6 Conversation practice: role-play in the course language (CEFR-pitched, in-role replies with English tips, readings for ja/ko/zh) as a voice conversation in Voice Learning
- [x] 9.7 Progress API: words total/learned/mastered/due, per-skill sessions and averages, streak, active days
- [x] 9.8 Speech accepts course languages; capability matrix lists tutor + course languages
- [x] 9.9 Per-language evaluation set (`backend/evals`): 18 tutor cases (6 languages × 3 levels) + 8 role-play cases; deterministic checks (native-script share, function words for Latin-script languages, understanding-check question); runner refuses paid calls without `--yes`
- [x] 9.10 Frontend: Language Learning (server-backed course and level, real progress, working skill buttons with optional topic, role-play with situations, recent practice), Vocabulary review page, Practice page for each skill; static sample words removed
- [x] 9.11 Tests: backend 169 (44 new), frontend 135 (11 new); real Chromium run through the dev servers covering every skill, 1440 px light / 390 px dark
- [ ] Deferred: subtitle languages → Phase 12 (needs video); running the evaluation against the real model → once `ANTHROPIC_API_KEY` is set

## Phase 10 — Mind maps ✅ (merged to `main`)
- [x] 10.1 Migration 0005: `mind_maps` (graph, learner layout, version); reversible, `alembic check` clean
- [x] 10.2 Schema: a tree of nodes (topic / main idea / sub-concept / example / definition, with a one-line explanation) plus up to 12 labelled cross-links
- [x] 10.3 Generation with structured output, in the learner's language and level; model output repaired (ids renumbered, orphans attached, cycles and over-deep branches dropped, links checked); maps from a lesson follow its plan
- [x] 10.4 Learner edits validated strictly (one root, no orphans or cycles, depth ≤ 5, ≤ 150 nodes) and versioned (stale edits → 409)
- [x] 10.5 "Expand with AI" grows one branch without repeating existing ideas
- [x] 10.6 Frontend: React Flow 12 canvas with a two-sided mind-map layout, colour by kind, collapse/expand (+n hidden), drag to rearrange (saved), zoom/pan/fit, expand all / collapse all / tidy layout, side panel to edit, add, delete and expand with AI
- [x] 10.7 Export: PNG, SVG (fonts embedded), JSON, Markdown outline
- [x] 10.8 Lesson page "Make a mind map" / "Open mind map"; Mind Maps no longer marked "soon"
- [x] 10.9 Tests: backend 193 (24 new), frontend 148 (13 new); real Chromium run: generate → rename → AI expand → fold + drag → reload keeps layout → all four exports downloaded; 1440 px light / 390 px dark

## Phase 11 — Drawing and diagrams ✅
- [x] 11.1 Migration 0006: `diagrams` (type, validated spec, freehand strokes); reversible incl. the new enum, `alembic check` clean
- [x] 11.2 Diagram description: flowchart, block, cycle (process), timeline, function graph; elements, connectors, plotted functions and points, and ordered reveal steps; no coordinates from the model
- [x] 11.3 Safe formulas: one whitelisted grammar (numbers, x, + − × ÷ ^, sin cos tan sqrt abs log ln exp, pi, e), checked in Python and parsed/evaluated in TypeScript; never `eval`; both sides tested against the same accept/reject list
- [x] 11.4 Generation with structured output; model output repaired (bad items dropped, connector ids remapped, every item revealed in some step, unreadable formulas dropped, ranges fixed)
- [x] 11.5 Layout in the app: layered flowcharts (loops detected and routed around), left-to-right block diagrams, circular cycles, alternating timelines, plotted graphs with nice ticks and asymptote breaks
- [x] 11.6 Step playback: play/pause (auto-advance), previous/next, restart, show all, step list, step explanation read aloud
- [x] 11.7 Freehand layer: pen, highlighter, eraser, five inks, undo/redo, clear; saved to the account (size-limited); blank sketch boards
- [x] 11.8 Export: PNG (2×), SVG, JSON; the finished diagram plus the drawing
- [x] 11.9 Lesson page "Draw a diagram" / "Open diagram"; Whiteboard no longer marked "soon"
- [x] 11.10 Tests: backend 238 (45 new), frontend 193 (45 new); real Chromium run of all four diagram types, drawing + reload, and all exports; 1440 px light / 390 px dark

## Phase 12 — Video generation ✅
- [x] 12.1 Migration 0007: `media_assets` and `video_jobs` (+ FK from `messages.audio_asset_id`); reversible incl. the new enums, `alembic check` clean
- [x] 12.2 Video script: structured output of 3–8 scenes from six templates (title, bullets, flow, plot, timeline, summary) with narration; repaired like other model output (title card added, bad scenes and unsafe formulas dropped)
- [x] 12.3 Background worker (arq on Redis) in its own Docker image with Manim 0.19 + FFmpeg 7; `docker compose --profile video up -d video-worker`; one job at a time, timeout, no retries
- [x] 12.4 Pipeline with real progress: script → narration (TTS per scene) → Manim scenes → FFmpeg join (padding to narration length, H.264/AAC, `+faststart`); cancel between steps; stalled jobs expire
- [x] 12.5 Subtitles timed to the narration: WebVTT for the player, SRT embedded as a `mov_text` track with the language tag; Indic scripts rendered with Noto fonts
- [x] 12.6 Mock TTS isn't speech, so mock videos are silent with subtitles and say so; real narration switches on with a real voice provider
- [x] 12.7 Media files served by signed, expiring links (Range requests supported) because `<video>` can't send a token
- [x] 12.8 API: create (202, rate-limited, ≤2 active per learner), list, get, cancel, delete (removes files), worker status
- [x] 12.9 Frontend: Video Studio (topic, level, language, length), live progress, worker-offline notice with the command, player with subtitles and download, job list; lesson page "Make a video" / "Watch video"; Video Studio no longer marked "soon"
- [x] 12.10 Tests: backend 259 + 1 render test run inside the worker image (all six templates incl. Hindi, checked with ffprobe), frontend 197 (4 new); real Edge run: topic → worker renders in 27 s → video plays with subtitles

## Phase 13 — Assessment and progress ✅ (branch `phase-13-assessment`, awaiting your approval)
- [x] 13.1 Migrations 0008 (`quizzes`, `quiz_questions`, `quiz_submissions`, `quiz_answers`) and 0009 (`topic_mastery`); reversible incl. the new enum, `alembic check` clean
- [x] 13.2 Quiz generation (3–20 questions; mixed, multiple choice or short answer) with structured output, repaired like other model output (unusable or repeated questions dropped, the right option checked to be among the options, options shuffled)
- [x] 13.3 Answers and explanations withheld from the API until an attempt is submitted
- [x] 13.4 Marking: multiple choice and exact short answers by rule; other short answers by the model against a model answer (0, ½ or 1, with feedback); if the marker fails nothing is saved and the learner can resubmit
- [x] 13.5 Feedback per idea (concept), and next steps by rule: revise weak ideas (one click starts a lesson), try the next level, or retake later
- [x] 13.6 Mastery per topic and idea (moving average of quiz results) with a revision date: weak ideas next day, others in 3, 7 or 14 days
- [x] 13.7 Understanding checks: "Quiz me" on the lesson page makes a 5-question check on the current section
- [x] 13.8 Progress API and My Progress page: lessons, sections done, quizzes taken, average/best score, score trend chart (with table view), active days and streak, strong ideas, ideas that need work, revision plan
- [x] 13.9 Quizzes and My Progress no longer marked "soon"; the last "Coming in Phase N" placeholders removed
- [x] 13.10 Tests: backend 271 (12 new), frontend 202 (5 new); real Chromium run: generate → answer → marked 70% (one wrong, one partly right by the mock marker) → progress shows the attempt, active day and revision plan; 1440 px light / 390 px dark, no overflow

## Extra — Groq (AI) + Gnani (speech) ✅ (branch `phase-gnani-groq`)
- [x] Groq LLM provider (official SDK): streaming chat, strict `json_schema` structured output with Pydantic validation and one retry; `LLM_PROVIDER=groq`, `GROQ_*` settings
- [x] Real Gnani STT/TTS from docs.gnani.ai: auth header, `/stt/v3`, `/api/v1/tts/inference`, 10 languages, Timbre v2.5 voices
- [x] WebM/Opus → 16 kHz WAV (PyAV), ≤ 28 s pieces; fixed streamed WAV headers
- [x] Voice picker shows the current language's voices; tutor prompt avoids LaTeX
- [x] Tests with stand-in clients (no network): `test_groq_unit.py`, Gnani section of `test_speech_unit.py`; live checks done by hand
- [x] Video worker rebuilt (Groq scripts, Gnani narration)

## Phase 14 — Testing and hardening ✅ (branch `phase-14-hardening`, awaiting your approval)
- [x] 14.1 Playwright E2E: own backend (`backend/e2e/server.py`: port 8001, fresh `aitutor_e2e` DB, mock AI/speech) + Vite on 5174; `npm run e2e`
- [x] 14.2 Journeys: sign up / out / in, protected routes, form errors; lesson → reply → section done → reload → history; voice input (fake mic); quiz → results → My Progress; mind map; whiteboard steps; language words review; video queued; privacy between two learners; every page fits a phone; phone menu
- [x] 14.3 Isolation: OpenAPI-driven test over every ID route (404 for others), foreign `lesson_id` on create, empty lists for others
- [x] 14.4 Security headers + no-store, HSTS in production, docs off in production
- [x] 14.5 Request body limit (4 MB JSON, also chunked); audio keeps its 10 MB limit
- [x] 14.6 Per-user limits for AI, speech, video and the voice socket (auth stays per IP)
- [x] 14.7 Reviewed: tokens (pinned HS256), cookies (HttpOnly, SameSite=Strict, path-scoped), CSRF header on cookie routes, password policy, no raw HTML in rendered AI output, keys backend-only
- [x] 14.8 Performance: N+1 guard on list pages and My Progress; `e2e/perf.py` timings; `LazyMotion` (main bundle 157 → 117 kB gzip)
- [x] 14.9 Mock AI notices name GROQ_API_KEY as well as ANTHROPIC_API_KEY

## Extra — 3D in Video Studio ✅ (branch `video-3d`)
- [x] `model3d`: cube, cuboid, sphere, hemisphere, cylinder, cone, square pyramid, triangular prism, tetrahedron, octahedron, torus — turning, with labelled r/h/l/a measurements
- [x] `molecule3d`: ball-and-stick by VSEPR geometry (linear … octahedral), CPK colours, readable atom labels
- [x] `surface3d`: z = f(x, y) with the safe formula grammar extended to x and y
- [x] Facts appear beside the model; at most two 3D scenes per video; prompt teaches the model when to use them
- [x] Fixes found on the way: formulas written as `z = …` or with ·/−/², Groq `json_validate_failed` retries, render subprocess importing stale code
- [x] Tests: script validation, bond angles, formulas; real render in the worker image; live videos through the app

## Extra — Real pictures in Video Studio ✅ (branch `video-3d`)
- [x] `image` scene: the model writes a search phrase and facts; the worker fetches a real photo from Wikimedia Commons (no key)
- [x] Safe download (Wikimedia hosts only, size cap, Pillow re-encode), photos before drawings, text fallback, at most 3 per video
- [x] Credits on screen and under the video (licence requirement); User-Agent per Wikimedia policy
- [x] Fixed: Manim 0.19 + Pillow 13 hang (worker pinned to Pillow 11); basic solids no longer stand in for real objects
- [x] Tests: picture search, pipeline fallback/credits, render test with a picture, frontend credits

## Extra — Video accuracy and visuals (branch `video-visuals`)
- [x] Scripts written from Wikipedia reference text; a review pass checks the draft, told by code which numbers no source has; bad reviews rejected
- [x] Fact-check status and source links under each video
- [x] New scenes: mind map (branches appear as they are explained), cycle, comparison, bar chart
- [x] "Explain it as: Mind map" option (migration 0010)
- [x] `evals/run_video_eval.py`: before/after scoring, `--rescore` for free
- [x] Retries for dropped connections; clear message for Groq's daily limit
- [ ] Confirm a live mind-map video and re-run all 8 topics once the daily allowance refills
- [ ] "Sizes" topics should get a bar chart (the model still avoids one)

## Phase 15 ⏸ — Deployment
Broken into tasks when the phase starts (needs your choice of host).
