"""Company-name enrichment via the Companies House REST API.

The PSC stream carries no company name (only the number, in ``resource_uri``).
The company-information *stream* doesn't help either — it only emits events when
a company's profile changes, so it can't name the arbitrary company behind a PSC
event. So we resolve names with a **cached REST lookup**: ``GET /company/{number}``.

Requires the REST API key (``COMPANIES_HOUSE_API_KEY``) — a different credential
from the streaming key. Without it, events fall back to "Company {number}".
"""

from __future__ import annotations

import logging

import httpx

log = logging.getLogger("bods_stream.companies")

_REST = "https://api.company-information.service.gov.uk"


class CompanyNames:
    """Cached company-number -> name resolver."""

    def __init__(self, api_key: str | None) -> None:
        self._key = api_key
        self._cache: dict[str, str] = {}
        self._client = httpx.AsyncClient(timeout=10.0) if api_key else None

    @property
    def enabled(self) -> bool:
        return self._client is not None

    async def name_for(self, number: str | None) -> str | None:
        if not number or self._client is None:
            return None
        if number in self._cache:
            return self._cache[number]
        try:
            r = await self._client.get(f"{_REST}/company/{number}", auth=(self._key, ""))
            if r.status_code == 200:
                name = r.json().get("company_name")
                if name:
                    self._cache[number] = name
                    return name
        except httpx.HTTPError:
            log.debug("company name lookup failed for %s", number)
        return None

    async def aclose(self) -> None:
        if self._client is not None:
            await self._client.aclose()
