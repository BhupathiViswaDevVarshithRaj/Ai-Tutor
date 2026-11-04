# Ai-Tutor

AI Tutor Dashboard is an AI-powered personalized learning platform designed to transform the way people learn. It acts as a virtual tutor that helps users understand academic subjects, develop new skills, and learn foreign languages through interactive and personalized teaching experiences.

The platform combines Artificial Intelligence, Large Language Models (LLMs), Speech-to-Text (STT), Text-to-Speech (TTS), and visual learning technologies to create an engaging digital classroom.

## ✨ Key Features

- **AI-Powered Personal Tutor:** Learn any subject through personalized explanations, examples, summaries, and interactive conversations.
- **Multilingual Learning:** Interact with the AI tutor in multiple languages.
- **Foreign Language Learning:** Learn languages such as German, French, Spanish, Japanese, and more through structured lessons, vocabulary, grammar, and conversation practice.
- **Voice-Based Interaction:** Communicate with the tutor using speech-to-text and text-to-speech technologies.
- **Real-Time AI Conversations:** Experience interactive one-on-one learning with an AI tutor.
- **AI-Generated Mind Maps:** Convert complex topics into structured and interactive mind maps.
- **Visual Learning and Digital Whiteboard:** Understand concepts through diagrams, drawings, flowcharts, and step-by-step visual explanations.
- **Educational Video Generation:** Generate short educational videos to simplify difficult concepts.
- **Interactive Quizzes and Assessments:** Test knowledge and evaluate learning progress.
- **Personalized Learning Progress:** Track learning activities, performance, achievements, and improvement over time.

## 🛠️ Technology Stack

- **Frontend:** React.js, TypeScript, Vite, Tailwind CSS
- **Backend:** Python, FastAPI
- **Database:** PostgreSQL, pgvector
- **Artificial Intelligence:** Large Language Models, Hugging Face, PyTorch
- **Speech Technologies:** Speech-to-Text (STT), Text-to-Speech (TTS)
- **Visualization:** React Flow, SVG, Canvas, Manim
- **Video Processing:** FFmpeg
- **Deployment:** Docker, Git, GitHub

## 🎯 Project Objective

The main objective is to develop an intelligent virtual teaching platform that makes personalized education accessible to everyone. By combining conversational AI, multilingual capabilities, speech technologies, and visual learning, the platform aims to provide a more engaging and effective learning experience.

## 🚀 Vision

To build an AI-powered digital classroom where anyone can learn any subject, practice any language, ask questions, visualize complex concepts, and improve their knowledge with the help of a personal AI tutor.

---

## 📍 Current Status

Phases 0–12 are complete: architecture and planning, environment, UI, accounts and data storage, the AI tutor (lesson plans, streamed explanations, summaries), the speech layer (speech-to-text / text-to-speech interfaces with mock providers; Gnani is prepared but disabled), voice input (record, transcribe, correct; dictation in lessons), read-aloud (listen to any reply with play/pause/stop, speed and voice saved to your account), the voice tutor (a live spoken conversation you can interrupt, which reconnects with its history), and world-language courses (German, French, Spanish, Japanese, Korean, Chinese, Italian, Portuguese; CEFR A1–C2) with vocabulary review, grammar, listening, reading, writing, speaking and role-play conversation, mind maps (generated, editable, grown with AI, exportable as PNG/SVG/JSON/outline), and the whiteboard (flowcharts, block diagrams, cycles, timelines and function graphs drawn step by step, with freehand drawing and export), and lesson videos (animated scenes rendered in the background with subtitles, a player and download). Quizzes and progress tracking are next. See [PROJECT_STATUS.md](PROJECT_STATUS.md) and [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md).

## Prerequisites
- Docker Desktop (runs Postgres + pgvector and Redis)
- Python 3.11+
- Node.js 20+ (developed on Node 24)

## Local setup

```bash
# 1. Environment
cp .env.example .env            # then edit values as needed

# 2. Database + Redis
docker compose up -d

# 3. Backend
cd backend
python -m venv .venv
.venv/Scripts/python -m pip install -e ".[dev]"     # macOS/Linux: .venv/bin/python
.venv/Scripts/alembic upgrade head
.venv/Scripts/python -m uvicorn app.main:app --reload --reload-dir app --timeout-graceful-shutdown 3 --port 8000

# 4. Frontend (new terminal)
cd frontend
npm install
npm run dev                      # http://localhost:5173 (proxies /api to :8000)

# 5. Video worker (optional; needed only for Video Studio)
docker compose --profile video up -d --build video-worker   # first build ≈ 2.4 GB
```

## Tests

```bash
# Backend tests (DB tests auto-skip if docker services are down)
cd backend && .venv/Scripts/python -m pytest
# Only the integration tests
cd backend && .venv/Scripts/python -m pytest -m integration
# Lint
cd backend && .venv/Scripts/python -m ruff check .

# Real video rendering (runs inside the worker image; skipped elsewhere)
MSYS_NO_PATHCONV=1 docker compose --profile video run --rm --no-deps -v "$(pwd -W)/backend/tests:/app/tests" video-worker \
  sh -c "pip install -q pytest; python -m pytest -q -p no:cacheprovider --noconftest tests/test_video_render.py"

# Frontend
cd frontend && npm test && npm run lint && npm run build
```

## Layout
```
backend/    FastAPI app (app/), Alembic migrations, pytest suite
frontend/   React + TypeScript + Vite + Tailwind
docker/     video worker image (Manim + FFmpeg)
media/      rendered videos and subtitles (git-ignored)
docker-compose.yml   Postgres (pgvector) + Redis, video worker (profile `video`)
```

## API (prefix `/api/v1`)
| Area | Endpoints |
|---|---|
| Health | `GET /health`, `GET /health/ready` (503 when degraded) |
| Auth | `POST /auth/register`, `/auth/login`, `/auth/refresh`*, `/auth/logout`*, `/auth/change-password`*, `/auth/password-reset/request`, `/auth/password-reset/confirm` |
| User | `GET/PATCH /users/me`, `GET/PATCH /users/me/preferences` |
| Lessons | `GET/POST /lessons`, `GET/PATCH/DELETE /lessons/{id}` |
| Conversations | `GET/POST /conversations` (`?mode=voice` to filter), `GET/DELETE /conversations/{id}`, `POST /conversations/{id}/messages` |
| AI tutor | `GET /tutor/info`, `POST /tutor/lessons` (plan + classroom), `POST /tutor/conversations/{id}/reply` (SSE stream), `POST /tutor/lessons/{id}/summary` |
| Speech | `GET /speech/info`, `POST /speech/transcribe?language=` (raw audio body), `POST /speech/synthesize` (returns audio) |
| Voice tutor | WebSocket `/voice/ws` (protocol in ARCHITECTURE.md › Voice tutor) |
| Diagrams | `GET/POST /diagrams`, `POST /diagrams/sketch`, `GET/PATCH/DELETE /diagrams/{id}` |
| Videos | `GET/POST /videos` (POST → 202), `GET /videos/worker`, `GET /videos/{id}`, `POST /videos/{id}/cancel`, `DELETE /videos/{id}`; files via `GET /media/{id}?token=` (signed link, Range supported) |
| Mind maps | `GET/POST /mindmaps`, `GET/PATCH/DELETE /mindmaps/{id}`, `POST /mindmaps/{id}/expand` |
| Language courses | `GET /languages`, `PUT /languages/{code}`, `GET /languages/{code}/progress`, `GET /languages/{code}/vocabulary`, `POST /languages/{code}/vocabulary/generate`, `POST /languages/vocabulary/{id}/review`, `DELETE /languages/vocabulary/{id}`, `GET/POST /languages/{code}/practice`, `GET /languages/practice/{id}`, `POST /languages/practice/{id}/submit` |

\* Cookie-authenticated routes require the header `X-CSRF-Protection: 1`. Other routes use `Authorization: Bearer <access_token>`.
Interactive docs: http://localhost:8000/docs

**AI tutor:** set `ANTHROPIC_API_KEY` in `.env` and restart the backend to use Claude (`claude-opus-5-5` by default; see the `LLM_*` settings). Without a key the app runs on a clearly labelled mock provider.

**Speech:** runs on mock providers (`STT_PROVIDER=mock`, `TTS_PROVIDER=mock`), labelled "Mock" in the UI. The Gnani adapters are placeholders: they make no network calls and are implemented only once Gnani's official API documentation is available.

**Videos:** made by the `video-worker` container (arq queue on Redis, Manim + FFmpeg). Without it, videos wait in the queue and Video Studio shows how to start it. Files go to `MEDIA_ROOT` (default `media/` in the repo). While speech uses the mock voice, videos are silent with subtitles.

**Language evaluation:** `cd backend && .venv/Scripts/python -m evals.run_language_eval` checks that tutor and role-play replies come back in the right language. With the mock it only exercises the pipeline; add `--yes` to run it against the real model (paid API calls).

**Password reset in development:** without SMTP settings, the reset email (with its link) is printed in the backend log.

**Dev server tip:** run uvicorn with `--reload-dir app`. Watching `.venv` makes package installs trigger reloads that can hang. On Windows, if new routes return 404/403, check that no old server still holds port 8000 (`Get-NetTCPConnection -LocalPort 8000`).

## Documents
- [ARCHITECTURE.md](ARCHITECTURE.md) · [DATABASE_DESIGN.md](DATABASE_DESIGN.md) · [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md) · [TASKS.md](TASKS.md) · [DECISIONS.md](DECISIONS.md)
