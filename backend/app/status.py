"""Live stream-connection diagnostics, surfaced at ``/api/health``.

A single process-wide ``STATUS`` object the stream consumer updates so the
running instance can self-report *why* it is (or isn't) seeing events — which a
bare event count can't distinguish (never connected vs. 401 vs. connected-but-
quiet). Purely in-memory, reset on restart, like the rest of the app state.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Optional


@dataclass
class StreamStatus:
    mode: str = "idle"  # "live" | "replay" | "idle"
    connected: bool = False
    last_status_code: Optional[int] = None
    last_error: Optional[str] = None
    connected_since: Optional[float] = None
    last_line_at: Optional[float] = None  # any line, incl. blank heartbeats
    last_event_at: Optional[float] = None  # a PSC event actually published
    lines_seen: int = 0  # cumulative, incl. heartbeats, across reconnects
    reconnects: int = 0
    # Company-name enrichment (REST Public Data API) health.
    names_enabled: bool = False  # REST key present
    names_last_status: Optional[int] = None  # last /company/{n} HTTP status
    names_resolved: int = 0  # successful name lookups

    def on_connect(self) -> None:
        self.connected = True
        self.connected_since = time.time()
        self.last_status_code = 200
        self.last_error = None

    def on_disconnect(self, error: str | None = None) -> None:
        self.connected = False
        if error is not None:
            self.last_error = error

    def on_line(self) -> None:
        self.lines_seen += 1
        self.last_line_at = time.time()

    def on_event(self) -> None:
        self.last_event_at = time.time()

    def as_dict(self) -> dict:
        now = time.time()

        def ago(ts: Optional[float]) -> Optional[float]:
            return None if ts is None else round(now - ts, 1)

        return {
            "mode": self.mode,
            "connected": self.connected,
            "last_status_code": self.last_status_code,
            "last_error": self.last_error,
            "connected_for_s": ago(self.connected_since),
            "last_line_s_ago": ago(self.last_line_at),
            "last_event_s_ago": ago(self.last_event_at),
            "lines_seen": self.lines_seen,
            "reconnects": self.reconnects,
            "names_enabled": self.names_enabled,
            "names_last_status": self.names_last_status,
            "names_resolved": self.names_resolved,
        }


STATUS = StreamStatus()
