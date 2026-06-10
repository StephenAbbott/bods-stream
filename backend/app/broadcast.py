"""In-memory fan-out: one upstream PSC connection -> many SSE subscribers.

A single process holds one connection to the Companies House stream; every
browser that connects subscribes here. A short rolling buffer keeps the most
recent events so a freshly-connected client (or a talk demo) sees immediate
activity instead of a blank screen. Nothing is persisted to disk — bods-stream
is a live view, not a beneficial-ownership data republisher.
"""

from __future__ import annotations

import asyncio
from collections import deque
from typing import Any, AsyncIterator

Message = dict[str, Any]


class Broadcaster:
    def __init__(self, buffer_size: int = 50, queue_size: int = 100) -> None:
        self._subscribers: set[asyncio.Queue[Message]] = set()
        self._buffer: deque[Message] = deque(maxlen=buffer_size)
        self._queue_size = queue_size
        self._count = 0

    @property
    def event_count(self) -> int:
        return self._count

    def recent(self) -> list[Message]:
        return list(self._buffer)

    async def publish(self, message: Message) -> None:
        self._count += 1
        self._buffer.append(message)
        for q in list(self._subscribers):
            try:
                q.put_nowait(message)
            except asyncio.QueueFull:
                # Slow consumer: drop the oldest so the live feed stays current.
                try:
                    q.get_nowait()
                    q.put_nowait(message)
                except asyncio.QueueEmpty:
                    pass

    async def subscribe(self) -> AsyncIterator[Message]:
        q: asyncio.Queue[Message] = asyncio.Queue(maxsize=self._queue_size)
        # Prime with the rolling buffer so the client isn't staring at nothing.
        for msg in self._buffer:
            q.put_nowait(msg)
        self._subscribers.add(q)
        try:
            while True:
                yield await q.get()
        finally:
            self._subscribers.discard(q)
