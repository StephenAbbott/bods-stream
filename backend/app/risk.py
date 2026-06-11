"""Per-event structural risk signals — free, zero external dependencies.

The safe subset of OpenCheck's risk signals that are computable from a single
PSC event with no external calls and no ownership chain. These describe the
*company or arrangement*, not a named individual, so they're safe to surface on a
public live feed. Name-match signals (sanctioned / PEP / offshore-leaks) are
deliberately excluded — they accuse named people off a fuzzy match and aren't
appropriate for an auto-scrolling public page.

Signals:
  FATF_BLACK_LIST / FATF_GREY_LIST  — corporate PSC registered in a FATF-listed
                                      jurisdiction (lists current Feb 2026).
  TRUST_OR_ARRANGEMENT              — control via a trust (natures) or a trust/
                                      foundation legal form.
  NOMINEE                           — registered-owner-as-nominee natures (ROE).
  OPAQUE_OWNERSHIP                  — super-secure PSC (details withheld by order).
  SANCTIONED                        — the source's own is_sanctioned flag (ROE BOs).
"""

from __future__ import annotations

from typing import Any

from bods_mapper import country_object

# FATF lists current as of February 2026 (refresh each plenary; mirrors OpenCheck).
FATF_BLACK_CODES = {"KP", "IR", "MM"}
FATF_GREY_CODES = {
    "DZ", "AO", "BO", "BG", "CM", "CI", "CD", "HT", "KE", "KW", "LA", "LB",
    "MC", "NA", "NP", "PG", "SS", "SY", "VE", "VN", "VG", "YE",
}

_TRUST_LEGAL_FORMS = ("trust", "stiftung", "anstalt", "fideicomiso", "treuhand", "foundation")


def _sig(code: str, label: str, level: str) -> dict[str, str]:
    return {"code": code, "label": label, "level": level}


def assess(event: dict[str, Any]) -> list[dict[str, str]]:
    """Return the structural risk signals for one (redacted) PSC event."""
    data = event.get("data") or {}
    signals: list[dict[str, str]] = []

    kind = (data.get("kind") or "").lower()
    natures = " ".join(data.get("natures_of_control") or []).lower()
    ident = data.get("identification") or {}

    # Jurisdiction of a corporate / legal-person PSC (FATF-list check).
    country = (ident.get("country_registered") or "").strip()
    code = (country_object(country) or {}).get("code") if country else None
    if code:
        if code in FATF_BLACK_CODES:
            signals.append(_sig("FATF_BLACK_LIST", "FATF black list", "high"))
        elif code in FATF_GREY_CODES:
            signals.append(_sig("FATF_GREY_LIST", "FATF grey list", "medium"))

    # Trust / arrangement: via the nature codes or a trust/foundation legal form.
    legal_form = (ident.get("legal_form") or "").lower()
    if "as-trust" in natures or any(k in legal_form for k in _TRUST_LEGAL_FORMS):
        signals.append(_sig("TRUST_OR_ARRANGEMENT", "Trust / arrangement", "medium"))

    # Nominee (registered overseas entity nominee land-holding).
    if "registered-owner-as-nominee" in natures or "nominee" in natures:
        signals.append(_sig("NOMINEE", "Nominee", "medium"))

    # Super-secure PSC — identity withheld by court order.
    if "super-secure" in kind:
        signals.append(_sig("OPAQUE_OWNERSHIP", "Super-secure (details withheld)", "medium"))

    # The source's own sanctioned flag (overseas-entity beneficial owners).
    if data.get("is_sanctioned"):
        signals.append(_sig("SANCTIONED", "Declared sanctioned", "high"))

    return signals
