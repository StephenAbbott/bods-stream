"""Companies House PSC stream consumer.

Holds a single authenticated connection to the CH ``persons-with-significant-
control`` stream, redacts each event, maps it to BODS v0.4 via the shared
``bods-mapper`` package, and publishes a ``{raw, bods, ...}`` payload to the
broadcaster for SSE fan-out. Reconnects on drop, resuming from the last
``timepoint`` so no events are missed.

The streaming API key is a *separate* credential from the REST key. Auth is HTTP
Basic with the key as the username and an empty password.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

import httpx
from bods_mapper import company_number_from_uri, map_psc_event, validate_shape

from . import lifecycle, prolific
from .broadcast import Broadcaster
from .companies import CompanyNames
from .privacy import redact_event
from .risk import assess

log = logging.getLogger("bods_stream.stream")

STREAM_URL = "https://stream.companieshouse.gov.uk/persons-with-significant-control"


def _assemble_message(display_event: dict[str, Any], statements: list[dict[str, Any]]) -> dict[str, Any]:
    """Build the broadcast payload from a (redacted) display event + mapped BODS."""
    ev = display_event.get("event") or {}
    ceased = any(
        s.get("recordType") == "relationship" and s.get("recordStatus") == "closed"
        for s in statements
    )
    return {
        "event_type": ev.get("type"),
        "timepoint": ev.get("timepoint"),
        "published_at": ev.get("published_at"),
        "psc_kind": (display_event.get("data") or {}).get("kind"),
        "ceased": ceased,
        "raw": display_event,             # already redacted
        "bods": statements,
        "schema_valid": validate_shape(statements) == [],
        "risk": assess(display_event),
    }


def _build_message(event: dict[str, Any]) -> dict[str, Any]:
    """Simple path with no lifecycle state — used by tests and as a fallback."""
    return _assemble_message(event, list(map_psc_event(event)))


async def process_event(event: dict[str, Any], names: CompanyNames | None) -> dict[str, Any]:
    """Enrich (company name) -> prolific -> lifecycle -> redact -> map. Shared by
    the live + replay paths."""
    if names is not None and names.enabled:
        company_name = await names.name_for(company_number_from_uri(event.get("resource_uri", "")))
        if company_name and isinstance(event.get("data"), dict):
            event["data"]["company_name"] = company_name

    # Prolific tracking uses the pre-redaction DOB for identity; it is never exposed.
    count = prolific.observe(event)
    lc = lifecycle.resolve(event)

    if lc is None:
        # Unkeyable, or a deletion of a PSC we never saw → map as-is (a deleted
        # event has no data → empty bundle → muted card).
        message = _build_message(redact_event(event))
    else:
        bundle = map_psc_event(
            redact_event(lc["base_event"]),
            stable_psc_id=lc["stable"],
            record_status=lc["status"],
            replaces_statement_id=lc["replaces"],
            end_date=lc["end_date"],
        )
        statements = list(bundle)
        message = _assemble_message(redact_event(event), statements)
        if lc["status"] != "closed" and statements:
            rel = next((s for s in statements if s.get("recordType") == "relationship"), None)
            if rel is not None:
                lifecycle.record(event, rel["statementId"], lc["stable"])

    if count is not None and count >= prolific.THRESHOLD:
        message["prolific"] = count
    return message


async def run_stream(
    broadcaster: Broadcaster,
    api_key: str,
    *,
    timepoint: int | None = None,
    names: CompanyNames | None = None,
) -> None:
    """Long-lived task: consume the PSC stream and publish mapped events.

    Cancelled on app shutdown. Never returns under normal operation.
    """
    timeout = httpx.Timeout(connect=15.0, read=None, write=15.0, pool=15.0)
    backoff = 2.0
    last_timepoint = timepoint

    async with httpx.AsyncClient(timeout=timeout) as client:
        while True:
            params = {"timepoint": last_timepoint} if last_timepoint is not None else {}
            try:
                async with client.stream("GET", STREAM_URL, params=params, auth=(api_key, "")) as resp:
                    if resp.status_code == 401:
                        log.error("401 Unauthorized — check COMPANIES_HOUSE_STREAM_KEY")
                        return
                    if resp.status_code == 416:
                        log.warning("timepoint too old — restarting live")
                        last_timepoint = None
                        continue
                    if resp.status_code == 429:
                        retry = float(resp.headers.get("retry-after", backoff))
                        log.warning("rate-limited; sleeping %.0fs", retry)
                        await asyncio.sleep(retry)
                        backoff = min(backoff * 2, 60.0)
                        continue
                    resp.raise_for_status()
                    backoff = 2.0
                    log.info("connected to PSC stream")

                    seen = 0
                    async for line in resp.aiter_lines():
                        seen += 1
                        if not line.strip():
                            if seen <= 40:
                                log.info("stream line %d: heartbeat (blank)", seen)
                            continue
                        if seen <= 40:
                            log.info("stream line %d: %d chars of data", seen, len(line))
                        try:
                            event = json.loads(line)
                        except json.JSONDecodeError:
                            log.warning("stream line %d: not JSON: %s", seen, line[:120])
                            continue
                        tp = (event.get("event") or {}).get("timepoint")
                        if isinstance(tp, int):
                            last_timepoint = tp
                        try:
                            message = await process_event(event, names)
                        except Exception:  # noqa: BLE001 — never let one bad event kill the stream
                            log.exception("failed to map event")
                            continue
                        await broadcaster.publish(message)
                        if broadcaster.event_count <= 5 or broadcaster.event_count % 100 == 0:
                            log.info("published event #%d", broadcaster.event_count)
            except asyncio.CancelledError:
                raise
            except httpx.HTTPError as exc:
                log.warning("stream dropped (%s) — reconnecting in %.0fs", type(exc).__name__, backoff)
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 60.0)
