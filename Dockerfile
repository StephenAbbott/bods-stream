# syntax=docker/dockerfile:1
# bods-stream — single image: build the React frontend, then serve it + the API
# from one FastAPI process (same origin, so SSE needs no CORS/proxy in prod).

# ---- stage 1: build the React/Vite frontend ----
FROM node:20-slim AS frontend
WORKDIR /fe
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
RUN npm run build      # -> /fe/dist

# ---- stage 2: Python backend runtime ----
FROM python:3.12-slim
# git: uv clones the bods-mapper git dependency during sync
RUN apt-get update && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
WORKDIR /app

# Install backend deps first (cached unless pyproject changes).
COPY backend/pyproject.toml ./
RUN uv sync --no-dev

# App code + the built frontend.
COPY backend/ ./
COPY --from=frontend /fe/dist ./static

ENV BODS_STREAM_STATIC_DIR=/app/static
EXPOSE 8000
# Single worker is required: the stream connection + all state are in-process.
CMD ["sh", "-c", ".venv/bin/uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
