# bods-stream

**Watch UK beneficial ownership change in real time — as open, standardised data.**

bods-stream consumes the [Companies House streaming API](https://developer-specs.company-information.service.gov.uk/streaming-api/reference/persons-with-significant-control/stream)
and turns every live PSC (persons with significant control) change into a
[BODS v0.4](https://standard.openownership.org/en/0.4.0/) statement on screen, the
moment it's filed.

Most corporate and beneficial-ownership registers don't offer a streaming API —
and almost none stream *beneficial ownership* data that's publicly available to
developers. The UK is the standout exception. bods-stream makes the most of that,
and shows what no static bulk download can: **ownership appearing, changing, and
ceasing, live, captured as an append-only open standard.**

## Why this, not just "lots of data"

[companies.stream](https://companies.stream/) brilliantly shows the *volume* of
Companies House changes. bods-stream's angle is the **change model**: the PSC
stream is the only public, real-time feed of beneficial-ownership changes
anywhere, and BODS is purpose-built to represent change — `recordStatus`
new/updated/closed, `replacesStatements`, one statement per point in time. The
hero is a single PSC event shown raw (left) and as BODS (right), with the
lifecycle made obvious.

## Architecture

```
Companies House PSC stream  (one long-lived authenticated connection)
        │
        ▼
  redact (drop address + DOB; keep name + how the interest changes)
        │
        ▼
  map_psc_event  ──►  BODS v0.4 statements   (shared bods-mapper package)
        │
        ▼
  Broadcaster  ──►  SSE  ──►  many browsers   (React + Vite frontend)
```

One process holds **one** connection to the stream; every viewer subscribes via
Server-Sent Events. The streaming key never reaches the browser. Nothing is
persisted to disk — this is a live view, not a beneficial-ownership data
republisher. A short rolling buffer means a freshly-loaded page sees immediate
activity.

## Privacy

UK PSC data is published by Companies House as fully open, public data, and
showcasing it is squarely in line with the UK's own anti-corruption / BODS
adoption commitments. bods-stream still exposes only the **minimal meaningful**
fields: a beneficial owner's **name** and **how their interest is changing**.
**Address and date of birth are stripped at ingress**, so neither the raw payload
shown in the UI nor the mapped BODS ever carries them.

## Quickstart

You need a Companies House **streaming** API key (a separate credential from the
REST key): https://developer.company-information.service.gov.uk/

**Backend** (FastAPI SSE relay):

```bash
cd backend
cp .env.example .env          # set COMPANIES_HOUSE_STREAM_KEY
uv sync                       # installs deps + the sibling bods-mapper package
uv run uvicorn app.main:app --reload --port 8000
```

**Frontend** (React + Vite):

```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173 (proxies /api to :8000)
```

Open http://localhost:5173 and watch PSC changes arrive as BODS.

## Layout

```
backend/
  app/
    main.py        FastAPI app + SSE endpoint (/api/events, /api/recent, /api/health)
    stream.py      single CH PSC stream connection -> map -> publish (reconnect/timepoint)
    broadcast.py   in-memory fan-out + rolling replay buffer
    privacy.py     address/DOB redaction at ingress
frontend/
  src/
    App.tsx                  live feed + connection/counter header
    lib/useSSE.ts            EventSource hook
    components/EventCard.tsx raw-PSC / BODS split view + lifecycle badge
```

## Dependencies

- [bods-mapper](https://github.com/StephenAbbott/bods-mapper) — the shared
  Companies House → BODS v0.4 mapping core (sibling repo; wired as a local path
  dependency in `backend/pyproject.toml`).

## Roadmap

- Per-event BOVS ownership diagram (Cytoscape) alongside the JSON.
- Curated **replay** of exemplar change-sequences for talks (live feed can be quiet).
- Live insight layer: corporate vs individual share, cross-border corporate PSCs, cessation rate.
- `deleted`-event handling + `updated` re-assertion via an in-memory last-state map.

## Licence

Code: [MIT](LICENSE). PSC data is © Crown copyright, licensed under the
[Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/).
