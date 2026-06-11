# BODS stream

**Watch UK beneficial ownership change in real time — as open, standardised data.** Live at **[bods-stream.onrender.com](https://bods-stream.onrender.com/)**.

BODS stream consumes the [Companies House Streaming API](https://developer-specs.company-information.service.gov.uk/streaming-api/reference/persons-with-significant-control/stream)
and turns every live PSC (Person with Significant Control) change into
[Beneficial Ownership Data Standard (BODS) v0.4](https://standard.openownership.org/en/0.4.0/)
statements on screen, the moment it's filed — each shown as a BOVS ownership
diagram with the raw Companies House event and the mapped BODS side by side.

Most corporate and beneficial-ownership registers don't offer a streaming API —
and almost none stream *beneficial ownership* data that's publicly available to
developers. The UK is the standout exception. BODS stream makes the most of that,
and shows what no static bulk download can: **ownership appearing, changing, and
ceasing, live, captured as an append-only open standard.**

## Why this, not just "lots of data"

[companies.stream](https://companies.stream/) brilliantly shows the *volume* of
Companies House changes. BODS stream's angle is the **change model**: the PSC
stream is the only public, real-time feed of beneficial-ownership changes
anywhere, and BODS is purpose-built to represent change — `recordStatus`
new/updated/closed, `replacesStatements`, one statement per point in time. So you
don't just see *that* something changed; you watch a beneficial owner appear
(`new`), be re-filed (`updated`), and be removed (`closed`) — the full lifecycle,
which a static snapshot can never show.

## What you see

- **Per-event BOVS diagram** — interested party (person / entity, with the Open
  Ownership BOVS icons) → subject company, the interest on the edge, jurisdiction
  and nationality flags, an identity-verification tick, all tinted by lifecycle.
- **Lifecycle badges** — `NEW` / `UPDATED` / `CEASED`, driven by the BODS
  `recordStatus` (see [Lifecycle](#lifecycle-handling)).
- **Glanceable + deep** — a plain-English one-liner and interest chips up top;
  the raw Companies House event ↔ BODS v0.4 statements one click away.
- **Pause / play** with a live counter that keeps climbing while paused.
- **Live insight bar** — individual vs corporate split, cessation rate, identity-
  verification rate, and the most-active ("prolific") PSC spotted today.
- **Risk signals** (structural, no external calls) — FATF black/grey list,
  trust/arrangement, nominee, super-secure (opaque), and the
  source's own sanctioned flag — as card chips and a live risk-rate box.
- **Prolific PSC** — a stream-native signal: when one person turns up as a PSC of
  several companies this session, the card flags it and the insight bar tracks
  the most active.
- **PSC nationalities** — a live top-15 flag tally (hover a flag for the country).

## Companies House APIs used

| API | Used for |
|-----|----------|
| [Streaming API](https://developer-specs.company-information.service.gov.uk/streaming-api/reference/persons-with-significant-control/stream) — `persons-with-significant-control` | The live feed of PSC change events. Needs a **streaming** API key. |
| [Public Data API](https://developer-specs.company-information.service.gov.uk/companies-house-public-data-api/reference) — `GET /company/{number}` | Resolving the **company name** (the PSC stream carries only the number). Cached. Needs a **REST** API key. |

The streaming and REST keys are **separate credentials** from the same
[developer account](https://developer.company-information.service.gov.uk/).

## Architecture

```
Companies House PSC Streaming API   (one long-lived authenticated connection)
        │
        ▼
  enrich company name        (Public Data API, cached)            companies.py
        │
        ▼
  prolific tracking          (person → distinct companies)         prolific.py
        │
        ▼
  lifecycle resolve          (new / updated / closed state)        lifecycle.py
        │
        ▼
  redact                     (drop address + DOB)                  privacy.py
        │
        ▼
  map_psc_event  ──►  BODS v0.4 statements   (shared bods-mapper)   stream.py
        │
        ▼
  risk assess                (structural signals)                  risk.py
        │
        ▼
  Broadcaster  ──►  SSE  ──►  many browsers  (React + Vite)       broadcast.py
```

One process holds **one** connection to the stream; every viewer subscribes via
Server-Sent Events. The streaming key never reaches the browser. Nothing is
persisted to disk — this is a live view, not a beneficial-ownership data
republisher. A short rolling buffer means a freshly-loaded page sees immediate
activity. All in-memory state (lifecycle, prolific) is single-process and resets
on restart, so the app must run as **one instance, one worker**.

## Lifecycle handling

The PSC stream has no notion of new/updated/closed — a re-filing is just another
`changed` event, and a removal is a `deleted` event with no data. BODS stream
keeps an in-memory map keyed by the PSC's stable id (`resource_uri`) so it can:

- emit `updated` (not a second `new`) when a PSC we've seen is re-filed, with
  `replacesStatements` pointing at the prior statement;
- emit a `closed` record when a `deleted` event arrives — **rebuilt from the
  last-seen state**, so it still shows who the former owner was;
- keep a single stable `recordId` across the whole `new → updated → closed`
  series (the shared `map_psc_event` is keyed on the stable id, not the per-update
  `etag`).

## Privacy

UK PSC data is published by Companies House as fully open, public data, and
showcasing it is squarely in line with the UK's own anti-corruption / BODS
adoption commitments. BODS stream still exposes only the **minimal meaningful**
fields: a beneficial owner's **name** and **how their interest is changing**.
**Address and date of birth are stripped at ingress**, so neither the raw payload
shown in the UI nor the mapped BODS ever carries them. (Date of birth is used
briefly, in-process, only to disambiguate people for the prolific signal — it is
never broadcast.) Risk signals describe the *company or arrangement*, not named
individuals; sanctions/PEP name-screening is deliberately **not** done.

## Quickstart (local)

You need two Companies House keys (free, same account): a **streaming** key and a
**REST** key — https://developer.company-information.service.gov.uk/

**Backend** (FastAPI SSE relay):

```bash
cd backend
cp .env.example .env          # set COMPANIES_HOUSE_STREAM_KEY + COMPANIES_HOUSE_API_KEY
uv sync                       # installs deps + bods-mapper (from git)
uv run uvicorn app.main:app --reload --port 8000
```

**Frontend** (React + Vite):

```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173 (proxies /api to :8000)
```

Open http://localhost:5173 and watch PSC changes arrive as BODS.

**Quiet stream?** Out of UK office hours the live feed slows right down. Replay a
captured file through the same pipeline instead:

```bash
# backend/.env →  BODS_STREAM_REPLAY_FILE=/path/to/psc_events.jsonl
```

## Configuration

All via environment variables (`backend/.env` locally):

| Variable | Purpose |
|----------|---------|
| `COMPANIES_HOUSE_STREAM_KEY` | Streaming API key (the live PSC feed). |
| `COMPANIES_HOUSE_API_KEY` | Public Data API (REST) key — enables company names. Without it, events show "Company &lt;number&gt;". |
| `BODS_STREAM_REPLAY_FILE` | Path to a captured `.jsonl`; replays it instead of connecting live (takes priority). A curated sample ships at `sample_psc_stream.jsonl` (in the Docker image: `/app/sample_psc_stream.jsonl`). When replay is active the header shows an amber **replay** flag and banner. |
| `BODS_STREAM_REPLAY_RATE` | Replay events/second (default `2`). |
| `BODS_STREAM_PROLIFIC_THRESHOLD` | Distinct companies before a PSC is "prolific" (default `3`). |
| `BODS_STREAM_CORS_ORIGIN` | Allowed CORS origin (default `*`; only needed if frontend is a separate origin). |
| `BODS_STREAM_STATIC_DIR` | Where the built frontend lives (set automatically in the Docker image). |

## Layout

```
backend/app/
  main.py        FastAPI app, SSE endpoints (/api/events, /api/recent, /api/health), serves built frontend
  stream.py      single CH stream connection → enrich → lifecycle → redact → map → publish
  companies.py   company-name enrichment via the Public Data API (cached)
  lifecycle.py   per-PSC new/updated/closed state (incl. deleted-event closes)
  prolific.py    person → distinct-companies tracker
  risk.py        structural risk signals (FATF, trust, nominee, opaque, sanctioned)
  privacy.py     address/DOB redaction at ingress
  broadcast.py   in-memory fan-out + rolling replay buffer
  replay.py      feed a captured file through the live pipeline
frontend/src/
  App.tsx                    header, insight + risk + nationality bars, feed
  lib/useSSE.ts              EventSource hook + cumulative stats
  lib/{stats,eventView,nationalities}.ts
  components/{EventCard,BovsDiagram,InsightBar,RiskBox,NationalityBar,LifecycleBadge}.tsx
```

## Deployment

A single Docker image builds the frontend and serves it together with the API
(same origin → no CORS or proxy). See `Dockerfile` and `render.yaml`.

On [Render](https://render.com): **New + → Blueprint**, pick this repo, and set
`COMPANIES_HOUSE_STREAM_KEY` and `COMPANIES_HOUSE_API_KEY` in the dashboard. Keep
it to **one instance / one worker** (in-memory state). The free plan spins down
when idle — fine for a quick share, but the stream stops while asleep; use a paid
plan (or an external uptime pinger on `/api/health`) for an always-on public demo.

**Replay for demos.** The PSC stream goes quiet out of UK office hours (and the
upstream feed can stall). To guarantee activity — e.g. for a talk — add
`BODS_STREAM_REPLAY_FILE=/app/sample_psc_stream.jsonl` in the Render dashboard:
the bundled sample (lifecycle, prolific, and risk-signal examples) loops through
the identical redact → map → risk pipeline, and the header flags **replay** so
viewers can tell it apart from live data. Delete the var to return to live.

`/api/health` reports the live connection state — `mode` (live/replay),
`connected`, `last_status_code`, `lines_seen`, `last_event_s_ago`, and the REST
key's `names_last_status` — so you can tell "connected but quiet" from a key or
upstream problem at a glance.

## Dependencies

- [bods-mapper](https://github.com/StephenAbbott/bods-mapper) — the shared
  Companies House → BODS v0.4 mapping core, used by both BODS stream and
  [OpenCheck](https://github.com/StephenAbbott/opencheck) so they can't drift.
  Wired as a git dependency in `backend/pyproject.toml`.

## Attributions

- [Beneficial Ownership Data Standard](https://standard.openownership.org/en/0.4.0/) and the
  [Beneficial Ownership Visualisation System](https://www.openownership.org/en/publications/beneficial-ownership-visualisation-system/) — © Open Ownership.
- Flags from the [flag-icons](https://github.com/lipis/flag-icons) project (MIT).
- PSC data from the [Companies House APIs](https://developer.company-information.service.gov.uk/) — © Crown copyright, licensed under the [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/).

## Licence

Code: [MIT](LICENSE). PSC data is © Crown copyright, OGL v3.0.
