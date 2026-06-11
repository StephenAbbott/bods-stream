"""Prolific-PSC tracking — a stateful, stream-native signal.

A single lookup can't see it, but the firehose can: the same person appearing as
a PSC of many different companies in a short span (serial directors, but also
mass-incorporation / nominee-farm patterns). We keep an in-memory map of person
-> distinct companies seen *this session* and surface the count once it crosses a
threshold.

Identity is keyed on name + date-of-birth (month/year) + nationality. The DOB is
used **only** for matching, before redaction — it is never exposed in the
broadcast payload. This is informational (factual: "PSC of N companies seen this
session"), not an accusation.
"""

from __future__ import annotations

import os

from bods_mapper import company_number_from_uri

THRESHOLD = int(os.environ.get("BODS_STREAM_PROLIFIC_THRESHOLD", "3"))
_MAX_PEOPLE = 100_000  # memory guard; stop tracking new people beyond this


def _person_key(data: dict) -> str | None:
    name = (data.get("name") or "").strip().lower()
    if not name:
        return None
    dob = data.get("date_of_birth") or {}
    nat = (data.get("nationality") or "").strip().lower()
    return f"{name}|{dob.get('year')}-{dob.get('month')}|{nat}"


class ProlificTracker:
    def __init__(self) -> None:
        self._people: dict[str, set[str]] = {}

    def observe(self, event: dict) -> int | None:
        """Record an individual PSC event; return the person's distinct-company
        count so far, or None for non-individual / unkeyable events."""
        data = event.get("data") or {}
        if "individual" not in (data.get("kind") or "").lower():
            return None
        key = _person_key(data)
        number = company_number_from_uri(event.get("resource_uri", ""))
        if not key or not number:
            return None
        companies = self._people.get(key)
        if companies is None:
            if len(self._people) >= _MAX_PEOPLE:
                return None
            companies = set()
            self._people[key] = companies
        companies.add(number)
        return len(companies)


_tracker = ProlificTracker()


def observe(event: dict) -> int | None:
    return _tracker.observe(event)
