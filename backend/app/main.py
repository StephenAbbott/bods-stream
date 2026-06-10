"""bods-stream FastAPI app: SSE relay over the Companies House PSC stream.

Endpoints:
  GET /api/events   Server-Sent Events stream of mapped {raw, bods} payloads.
  GET /api/recent   The current rolling buffer (JSON) — for a cold page load.
  GET /api/health   Liveness + event count.

On startup a single background task consumes the CH PSC stream (if the streaming
key is configured) and fans every mapped event out to all SSE subscribers.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

from .broadcast import Broadcaster
from .stream import run_stream

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("bods_stream")

broadcaster = Broadcaster()


@asynccontextmanager
async def lifespan(app: FastAPI):
    key = os.environ.get("COMPANIES_HOUSE_STREAM_KEY")
    task: asyncio.Task | None = None
    if key:
        task = asyncio.create_task(run_stream(broadcaster, key))
        log.info("PSC stream consumer started")
    else:
        log.warning("COMPANIES_HOUSE_STREAM_KEY not set — running without a live feed")
    try:
        yield
    finally:
        if task:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass


app = FastAPI(title="bods-stream", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("BODS_STREAM_CORS_ORIGIN", "*")],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health() -> dict:
    return {"status": "ok", "events_seen": broadcaster.event_count}


@app.get("/api/recent")
async def recent() -> list:
    return broadcaster.recent()


@app.get("/api/events")
async def events():
    async def event_generator():
        async for message in broadcaster.subscribe():
            yield {"event": "psc", "data": json.dumps(message)}

    return EventSourceResponse(event_generator())
