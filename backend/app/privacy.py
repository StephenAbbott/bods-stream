"""Privacy redaction for PSC stream events.

UK PSC beneficial-ownership data is published by Companies House as fully open,
public data. bods-stream still exposes only the *minimal meaningful* fields: a
beneficial owner's **name** and **how the ownership relationship is changing**
(interest type, share band, direct/indirect, new/updated/closed). Personal
fields that aren't needed to tell that story — **address and date of birth** —
are stripped at ingress, so both the raw payload shown in the UI and the mapped
BODS statements are already clean.

Redaction happens once, up front: the redacted event is what gets mapped and
broadcast. Nothing downstream ever sees the dropped fields.
"""

from __future__ import annotations

import copy
from typing import Any

# Person-level fields removed from ``data`` before mapping/broadcast.
_REDACT_FIELDS = (
    "address",               # individual PSC service address (may be residential)
    "date_of_birth",         # month/year of birth
    "residential_address",
)


def redact_event(event: dict[str, Any]) -> dict[str, Any]:
    """Return a deep copy of *event* with personal address/DOB fields removed."""
    redacted = copy.deepcopy(event)
    data = redacted.get("data")
    if isinstance(data, dict):
        for field in _REDACT_FIELDS:
            data.pop(field, None)
    return redacted
