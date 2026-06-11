"""Per-PSC lifecycle state — turn the stream's changed/deleted events into the
correct BODS recordStatus (new → updated → closed) with stable recordIds.

The PSC stream carries no lifecycle: a re-filing is just another ``changed``
event, and a removal is a ``deleted`` event with no ``data``. We keep an in-memory
map keyed by the PSC's stable id (its ``resource_uri``) so we can:

  * emit ``updated`` (not a second ``new``) when we've seen the PSC before, and
  * emit a ``closed`` record when a ``deleted`` event arrives — rebuilt from the
    last-seen state, since the deleted event itself carries no data.

The stored event (used to rebuild a deletion-close) is the enriched, un-redacted
event; redaction is re-applied before mapping, so DOB/address never escape. State
resets on restart and is memory-guarded.
"""

from __future__ import annotations

from typing import Any

_MAX_TRACKED = 50_000


class Lifecycle:
    def __init__(self) -> None:
        self._seen: dict[str, dict[str, Any]] = {}

    def resolve(self, event: dict[str, Any]) -> dict[str, Any] | None:
        """Decide the lifecycle for an event.

        Returns ``{base_event, status, replaces, stable, end_date}`` — where
        ``base_event`` is the event to map (a deletion reuses the prior event) —
        or ``None`` when there's nothing to emit (unkeyable, or a deletion of a
        PSC we never saw). Pops state on close.
        """
        uri = event.get("resource_uri") or ""
        if not uri:
            return None
        rid = event.get("resource_id") or uri
        ev_type = (event.get("event") or {}).get("type")
        data = event.get("data")
        prior = self._seen.get(uri)

        # Deletion (or any event with no data) → close from the prior state.
        if ev_type == "deleted" or data is None:
            if prior is None:
                return None
            self._seen.pop(uri, None)
            return {
                "base_event": prior["event"],
                "status": "closed",
                "replaces": prior["statement_id"],
                "stable": prior["stable"],
                "end_date": (event.get("event") or {}).get("published_at"),
            }

        # Cessation declared on the event itself → close.
        if data.get("ceased_on"):
            self._seen.pop(uri, None)
            return {
                "base_event": event,
                "status": "closed",
                "replaces": prior["statement_id"] if prior else None,
                "stable": prior["stable"] if prior else rid,
                "end_date": None,
            }

        # Seen before → updated; otherwise new.
        if prior:
            return {"base_event": event, "status": "updated", "replaces": prior["statement_id"],
                    "stable": prior["stable"], "end_date": None}
        return {"base_event": event, "status": "new", "replaces": None, "stable": rid, "end_date": None}

    def record(self, event: dict[str, Any], statement_id: str, stable: str) -> None:
        """Remember the latest relationship statementId for future update/close."""
        uri = event.get("resource_uri") or ""
        if not uri:
            return
        if uri not in self._seen and len(self._seen) >= _MAX_TRACKED:
            return  # memory guard: stop tracking new PSCs once full
        self._seen[uri] = {"statement_id": statement_id, "stable": stable, "event": event}


_lifecycle = Lifecycle()


def resolve(event: dict[str, Any]) -> dict[str, Any] | None:
    return _lifecycle.resolve(event)


def record(event: dict[str, Any], statement_id: str, stable: str) -> None:
    _lifecycle.record(event, statement_id, stable)
