<<<<<<< HEAD
# AI Tutor Dashboard

An AI-powered personal tutor: personalised lessons at three levels, multilingual chat and voice, mind maps, diagrams, short educational videos, quizzes and progress analytics.

**Status:** Phase 1 (environment setup) complete. See [PROJECT_STATUS.md](PROJECT_STATUS.md).

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
```

## Tests

```bash
# Backend tests (DB tests auto-skip if docker services are down)
cd backend && .venv/Scripts/python -m pytest
# Only the integration tests
cd backend && .venv/Scripts/python -m pytest -m integration
# Lint
cd backend && .venv/Scripts/python -m ruff check .

# Frontend
cd frontend && npm test && npm run lint && npm run build
```

## Layout
```
backend/    FastAPI app (app/), Alembic migrations, pytest suite
frontend/   React + TypeScript + Vite + Tailwind
docker-compose.yml   Postgres (pgvector) + Redis
```

## API (prefix `/api/v1`)
| Area | Endpoints |
|---|---|
| Health | `GET /health`, `GET /health/ready` (503 when degraded) |
| Auth | `POST /auth/register`, `/auth/login`, `/auth/refresh`*, `/auth/logout`*, `/auth/change-password`*, `/auth/password-reset/request`, `/auth/password-reset/confirm` |
| User | `GET/PATCH /users/me`, `GET/PATCH /users/me/preferences` |
| Lessons | `GET/POST /lessons`, `GET/PATCH/DELETE /lessons/{id}` |
| Conversations | `GET/POST /conversations`, `GET/DELETE /conversations/{id}`, `POST /conversations/{id}/messages` |
| AI tutor | `GET /tutor/info`, `POST /tutor/lessons` (plan + classroom), `POST /tutor/conversations/{id}/reply` (SSE stream), `POST /tutor/lessons/{id}/summary` |

\* Cookie-authenticated routes require the header `X-CSRF-Protection: 1`. Other routes use `Authorization: Bearer <access_token>`.
Interactive docs: http://localhost:8000/docs

**AI tutor:** set `ANTHROPIC_API_KEY` in `.env` and restart the backend to use Claude (`claude-opus-5-5` by default; see the `LLM_*` settings). Without a key the app runs on a clearly labelled mock provider.

**Password reset in development:** without SMTP settings, the reset email (with its link) is printed in the backend log.

**Dev server tip:** run uvicorn with `--reload-dir app`. Watching `.venv` makes package installs trigger reloads that can hang.

## Documents
- [ARCHITECTURE.md](ARCHITECTURE.md) · [DATABASE_DESIGN.md](DATABASE_DESIGN.md) · [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md) · [TASKS.md](TASKS.md) · [DECISIONS.md](DECISIONS.md)
=======
# Ai-Tutor
AI Tutor Dashboard is an AI-powered personalized learning platform designed to transform the way people learn. It acts as a virtual tutor that helps users understand academic subjects, develop new skills, and learn foreign languages through interactive and personalized teaching experiences.

The platform combines Artificial Intelligence, Large Language Models (LLMs), Speech-to-Text (STT), Text-to-Speech (TTS), and visual learning technologies to create an engaging digital classroom.

✨ Key Features

AI-Powered Personal Tutor: Learn any subject through personalized explanations, examples, summaries, and interactive conversations.

Multilingual Learning: Interact with the AI tutor in multiple languages.

Foreign Language Learning: Learn languages such as German, French, Spanish, Japanese, and more through structured lessons, vocabulary, grammar, and conversation practice.

Voice-Based Interaction: Communicate with the tutor using speech-to-text and text-to-speech technologies.

Real-Time AI Conversations: Experience interactive one-on-one learning with an AI tutor.

AI-Generated Mind Maps: Convert complex topics into structured and interactive mind maps.

Visual Learning and Digital Whiteboard: Understand concepts through diagrams, drawings, flowcharts, and step-by-step visual explanations.

Educational Video Generation: Generate short educational videos to simplify difficult concepts.

Interactive Quizzes and Assessments: Test knowledge and evaluate learning progress.

Personalized Learning Progress: Track learning activities, performance, achievements, and improvement over time.

🛠️ Technology Stack

Frontend: React.js, TypeScript, Vite, Tailwind CSS

Backend: Python, FastAPI

Database: PostgreSQL, pgvector

Artificial Intelligence: Large Language Models, Hugging Face, PyTorch

Speech Technologies: Speech-to-Text (STT), Text-to-Speech (TTS)

Visualization: React Flow, SVG, Canvas, Manim

Video Processing: FFmpeg

Deployment: Docker, Git, GitHub

🎯 Project Objective

The main objective is to develop an intelligent virtual teaching platform that makes personalized education accessible to everyone. By combining conversational AI, multilingual capabilities, speech technologies, and visual learning, the platform aims to provide a more engaging and effective learning experience.

🚀 Vision

To build an AI-powered digital classroom where anyone can learn any subject, practice any language, ask questions, visualize complex concepts, and improve their knowledge with the help of a personal AI tutor.
>>>>>>> origin/main
