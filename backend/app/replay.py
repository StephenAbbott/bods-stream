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
from .status import STATUS
from .stream import process_event

log = logging.getLogger("bods_stream.replay")


def _pin_statement_dates(statements: list[dict], published_at: str) -> None:
    """Stamp BODS statements with the event's capture time, not "now".

    The mapper defaults ``statementDate`` / ``publicationDate`` / ``retrievedAt``
    to today/now at map time. That's right for the live stream, but in replay it
    makes captured history look like it was filed today. Re-point those three
    fields at the event's own ``published_at`` so replayed statements read as the
    capture date. Live mode never calls this, so its timestamps stay current.
    """
    day = published_at[:10]  # YYYY-MM-DD
    retrieved = published_at if "T" in published_at else f"{published_at}T00:00:00"
    if not retrieved.endswith("Z"):
        retrieved += "Z"
    for s in statements:
        if "statementDate" in s:
            s["statementDate"] = day
        pub = s.get("publicationDetails")
        if isinstance(pub, dict):
            pub["publicationDate"] = day
        src = s.get("source")
        if isinstance(src, dict):
            src["retrievedAt"] = retrieved


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
    STATUS.connected = True  # a replay is "connected" to its file for health purposes
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
                published_at = (event.get("event") or {}).get("published_at")
                if published_at and message.get("bods"):
                    _pin_statement_dates(message["bods"], published_at)
                await broadcaster.publish(message)
                STATUS.on_event()
                if delay:
                    await asyncio.sleep(delay)
        if not loop:
            break
    log.info("replay finished")
