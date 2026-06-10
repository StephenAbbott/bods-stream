import type { BodsStatement, StreamMessage } from "../types";
import { LifecycleBadge } from "./LifecycleBadge";

function relationship(bods: BodsStatement[]): BodsStatement | undefined {
  return bods.find((s) => s.recordType === "relationship");
}

function partyName(bods: BodsStatement[]): string {
  const person = bods.find((s) => s.recordType === "person");
  if (person) {
    const names = (person.recordDetails as any)?.names ?? [];
    return names[0]?.fullName ?? "Unknown person";
  }
  // Corporate PSC: the interested-party entity is the non-subject entity.
  const rel = relationship(bods);
  const ipId = (rel?.recordDetails as any)?.interestedParty;
  const entity = bods.find((s) => s.recordType === "entity" && s.statementId === ipId);
  return ((entity?.recordDetails as any)?.name as string) ?? "—";
}

function interestSummary(bods: BodsStatement[]): string {
  const interests = ((relationship(bods)?.recordDetails as any)?.interests ?? []) as any[];
  return interests.map((i) => i.details ?? i.type).join(" · ") || "—";
}

const KIND_LABEL: Record<string, string> = {
  "individual-person-with-significant-control": "Individual PSC",
  "corporate-entity-person-with-significant-control": "Corporate PSC",
  "legal-person-person-with-significant-control": "Legal person PSC",
  "super-secure-person-with-significant-control": "Super-secure PSC",
};

export function EventCard({ msg }: { msg: StreamMessage }) {
  const status = relationship(msg.bods)?.recordStatus ?? "new";
  const kind = msg.psc_kind ? KIND_LABEL[msg.psc_kind] ?? msg.psc_kind : "PSC";

  return (
    <article className="card">
      <header className="card-head">
        <LifecycleBadge status={status} />
        <span className="party">{partyName(msg.bods)}</span>
        <span className="kind">{kind}</span>
        {msg.schema_valid && <span className="valid" title="Validated against BODS v0.4">✓ BODS v0.4</span>}
        <span className="ts">{msg.published_at ?? ""}</span>
      </header>

      <p className="interest">{interestSummary(msg.bods)}</p>

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
    </article>
  );
}
