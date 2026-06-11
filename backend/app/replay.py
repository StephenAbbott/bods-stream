"""Replay captured PSC events through the live pipeline.

Feeds a JSON-Lines file of raw Companies House PSC events (e.g. produced by
OpenCheck's ``capture_psc_stream.py``) through the same redact -> map -> broadcast
path as the live stream, paced to look live. Useful when the real stream is
quiet (evenings/weekends) and for talk demos where you want guaranteed activity.

Enabled by setting ``BODS_STREAM_REPLAY_FILE``; events are redacted exactly as
live data is, so address/DOB never appear.
"""

from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path

from .broadcast import Broadcaster
from .companies import CompanyNames
from .stream import process_event

log = logging.getLogger("bods_stream.replay")


async def run_replay(
    broadcaster: Broadcaster,
    path: str,
    *,
    rate: float = 2.0,
    loop: bool = True,
    names: CompanyNames | None = None,
) -> None:
    """Publish events from *path* at ~*rate* events/second; loop when exhausted."""
    p = Path(path)
    if not p.exists():
        log.error("replay file not found: %s", path)
        return
    delay = 1.0 / rate if rate > 0 else 0.0
    log.info("replay mode: %s at ~%.1f events/s (loop=%s)", path, rate, loop)
    while True:
        with p.open(encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    event = json.loads(line)
                except json.JSONDecodeError:
                    continue
                try:
                    message = await process_event(event, names)
                except Exception:  # noqa: BLE001
                    log.exception("replay: failed to map event")
                    continue
                await broadcaster.publish(message)
                if delay:
                    await asyncio.sleep(delay)
        if not loop:
            break
    log.info("replay finished")
