# Production API: FastAPI on uvicorn. Runs the database migrations, then serves on port 8000
# behind Caddy (docker-compose.prod.yml). Builds for amd64 and arm64 (Oracle Ampere).
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    MEDIA_ROOT=/media

WORKDIR /app
COPY backend/pyproject.toml ./
COPY backend/app ./app
COPY backend/alembic ./alembic
COPY backend/alembic.ini ./
RUN pip install . \
    && useradd --create-home --uid 10001 aitutor \
    && mkdir -p /media && chown aitutor /media

USER aitutor
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health', timeout=4)"

# --proxy-headers: the client address comes from Caddy's X-Forwarded-For, so sign-in rate
# limits count real visitors (only Caddy can reach this port; it isn't published).
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers ${API_WORKERS:-2} --proxy-headers --forwarded-allow-ips='*'"]
