"""Lifecycle state: new -> updated -> closed, and deletion-driven close."""

from __future__ import annotations

from app.lifecycle import Lifecycle

URI = "/company/01234567/persons-with-significant-control/individual/PSCID"


def changed(etag, ceased=None):
    data = {
        "etag": etag, "kind": "individual-person-with-significant-control",
        "name": "Jane Q Public", "natures_of_control": ["ownership-of-shares-25-to-50-percent"],
    }
    if ceased:
        data["ceased_on"] = ceased
    return {"resource_uri": URI, "resource_id": "PSCID", "data": data,
            "event": {"type": "changed", "published_at": "2026-06-10T10:00:00"}}


def deleted():
    return {"resource_uri": URI, "resource_id": "PSCID",
            "event": {"type": "deleted", "published_at": "2026-06-10T12:00:00"}}


def test_new_then_updated_then_deleted():
    lc = Lifecycle()

    r1 = lc.resolve(changed("e1"))
    assert r1["status"] == "new" and r1["replaces"] is None and r1["stable"] == "PSCID"
    lc.record(changed("e1"), "stmt-1", r1["stable"])

    r2 = lc.resolve(changed("e2"))  # re-sighting -> updated, even with a new etag
    assert r2["status"] == "updated" and r2["replaces"] == "stmt-1" and r2["stable"] == "PSCID"
    lc.record(changed("e2"), "stmt-2", r2["stable"])

    r3 = lc.resolve(deleted())  # deletion -> closed, rebuilt from prior state
    assert r3["status"] == "closed" and r3["replaces"] == "stmt-2"
    assert r3["base_event"]["data"]["etag"] == "e2"
    assert r3["end_date"] == "2026-06-10T12:00:00"

    assert lc.resolve(deleted()) is None  # state was popped on close


def test_ceased_on_event_closes():
    lc = Lifecycle()
    r1 = lc.resolve(changed("e1"))
    lc.record(changed("e1"), "s1", r1["stable"])
    rc = lc.resolve(changed("e2", ceased="2026-06-09"))
    assert rc["status"] == "closed" and rc["replaces"] == "s1"


def test_deleted_unseen_is_none():
    assert Lifecycle().resolve(deleted()) is None
