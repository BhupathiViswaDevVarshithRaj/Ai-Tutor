# Video worker: renders explainer videos with Manim and FFmpeg (Phase 12).
# Built and started with:  docker compose --profile video up -d --build video-worker
FROM python:3.11-slim

# FFmpeg; Cairo/Pango (+ build tools) for Manim; Noto fonts covering Latin and the tutor's
# Indic scripts (Devanagari, Telugu, Tamil, Gurmukhi, Bengali).
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ffmpeg \
        libcairo2-dev libpango1.0-dev pkg-config build-essential \
        fonts-noto-core \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY backend/pyproject.toml ./
COPY backend/app ./app
RUN pip install --no-cache-dir ".[video]"

ENV PYTHONUNBUFFERED=1 \
    MEDIA_ROOT=/media

# `python -m` puts /app first on the path, so code mounted at /app/app (see compose) is used.
CMD ["python", "-m", "arq", "app.workers.video.WorkerSettings"]
