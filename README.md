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
