import { useState } from "react";
import type { StreamMessage } from "../types";
import { summarise, toEventView } from "../lib/eventView";
import { BovsDiagram } from "./BovsDiagram";
import { LifecycleBadge } from "./LifecycleBadge";

const MAX_CHIPS = 6;

export function EventCard({ msg }: { msg: StreamMessage }) {
  const [open, setOpen] = useState(false);
  const view = toEventView(msg);

  if (!view) {
    return (
      <article className="card muted">
        <header className="card-head">
          <span className="kind">{msg.event_type ?? "event"} — no mappable PSC</span>
          <span className="ts">{msg.published_at ?? ""}</span>
        </header>
      </article>
    );
  }

  const shownChips = view.interests.slice(0, MAX_CHIPS);
  const extraChips = view.interests.length - shownChips.length;

  return (
    <article className={`card lc-${view.lifecycle}`}>
      <header className="card-head">
        <LifecycleBadge status={view.lifecycle} />
        <span className="summary">{summarise(view)}</span>
        {msg.schema_valid && (
          <span className="valid" title="Every statement validated against BODS v0.4">✓ BODS v0.4</span>
        )}
        <span className="ts">{msg.published_at ?? ""}</span>
      </header>

      {/* one interest → readable descriptor; several → compact chips (avoids a wall of text) */}
      {view.interests.length === 1 ? (
        <p className="interest-detail">{view.primary.details}</p>
      ) : (
        <div className="chips">
          {shownChips.map((i, idx) => (
            <span key={idx} className="chip">
              {i.type}
              {i.shareBand ? ` · ${i.shareBand}` : ""}
            </span>
          ))}
          {extraChips > 0 && <span className="chip more">+{extraChips}</span>}
        </div>
      )}

      <BovsDiagram view={view} />

      <button className="data-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="data-ico" aria-hidden="true">{"{ }"}</span>
        {open ? "Hide data" : "View raw ↔ BODS data"}
        <span className="chev" aria-hidden="true">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="split">
          <div className="pane">
            <div className="pane-label">Raw Companies House PSC event</div>
            <pre>{JSON.stringify(msg.raw, null, 2)}</pre>
          </div>
          <div className="pane">
            <div className="pane-label">BODS v0.4 statements</div>
            <pre>{JSON.stringify(msg.bods, null, 2)}</pre>
          </div>
        </div>
      )}
    </article>
  );
}
