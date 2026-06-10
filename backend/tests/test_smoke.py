"""Smoke tests: redaction + event->payload mapping."""

from __future__ import annotations

from app.privacy import redact_event
from app.stream import _build_message


def _event(ceased_on=None):
    data = {
        "etag": "e1",
        "kind": "individual-person-with-significant-control",
        "name": "Jane Q Public",
        "nationality": "British",
        "date_of_birth": {"month": 4, "year": 1980},
        "address": {"address_line_1": "1 High St", "postal_code": "EC1A 1AA", "country": "England"},
        "natures_of_control": ["ownership-of-shares-25-to-50-percent"],
    }
    if ceased_on:
        data["ceased_on"] = ceased_on
    return {
        "resource_uri": "/company/01234567/persons-with-significant-control/individual/e1",
        "data": data,
        "event": {"type": "changed", "timepoint": 99, "published_at": "2024-09-04T10:00:00"},
    }


def test_redaction_strips_address_and_dob_keeps_name():
    red = redact_event(_event())
    assert "address" not in red["data"]
    assert "date_of_birth" not in red["data"]
    assert red["data"]["name"] == "Jane Q Public"          # name kept
    assert red["data"]["natures_of_control"]               # change details kept


def test_build_message_is_schema_valid_and_carries_no_dob():
    msg = _build_message(redact_event(_event()))
    assert msg["event_type"] == "changed"
    assert msg["schema_valid"] is True
    person = [s for s in msg["bods"] if s["recordType"] == "person"][0]
    assert "birthDate" not in person["recordDetails"]       # DOB never reaches BODS
    assert "addresses" not in person["recordDetails"]


def test_ceased_event_message_flags_closed():
    msg = _build_message(redact_event(_event(ceased_on="2024-09-03")))
    assert msg["ceased"] is True
    rel = [s for s in msg["bods"] if s["recordType"] == "relationship"][0]
    assert rel["recordStatus"] == "closed"
