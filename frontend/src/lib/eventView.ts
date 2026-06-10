import type { BodsStatement, StreamMessage } from "../types";
import { nationalityToCode } from "./nationalities";

export interface EventInterest {
  type: string;
  details: string; // official CH descriptor
  shareBand?: string; // e.g. "25–50%"
}

export interface EventView {
  lifecycle: string; // new | updated | closed
  subjectName: string;
  subjectCode?: string;
  jurisdiction?: { name?: string; code?: string };
  partyName: string; // preferred_name when present, else legal name
  partyType: "person" | "entity";
  partyIconKey: string; // BOVS icon key
  nationalityCode?: string; // ISO2 for the person flag
  idVerified: boolean; // CH identity verification complete
  interests: EventInterest[];
  primary: EventInterest;
  endDate?: string;
}

function relationship(bods: BodsStatement[]): BodsStatement | undefined {
  return bods.find((s) => s.recordType === "relationship");
}

function shareBand(interest: any): string | undefined {
  const sh = interest.share;
  if (sh && typeof sh === "object") {
    const lo = sh.exclusiveMinimum ?? sh.minimum;
    const hi = sh.maximum ?? sh.exclusiveMaximum;
    if (lo != null || hi != null) return `${lo ?? ""}–${hi ?? ""}%`;
  }
  return undefined;
}

export function toEventView(msg: StreamMessage): EventView | null {
  const bods = msg.bods ?? [];
  const rel = relationship(bods);
  if (!rel) return null;
  const rd = rel.recordDetails as any;
  const subject = bods.find((s) => s.statementId === rd.subject);
  const party = bods.find((s) => s.statementId === rd.interestedParty);
  const raw = ((msg.raw as any)?.data ?? {}) as any;

  const interests: EventInterest[] = (rd.interests ?? []).map((i: any) => ({
    type: i.type ?? "interest",
    details: i.details ?? i.type ?? "interest",
    shareBand: shareBand(i),
  }));
  const primary = interests[0] ?? { type: "interest", details: "interest" };

  const sd = (subject?.recordDetails ?? {}) as any;
  const pd = (party?.recordDetails ?? {}) as any;
  const partyType: "person" | "entity" = party?.recordType === "person" ? "person" : "entity";

  // #5 — prefer the name the PSC prefers to be known by, when present.
  const bodsName = partyType === "person" ? pd.names?.[0]?.fullName : pd.name;
  const partyName =
    raw.identity_verification_details?.preferred_name ||
    bodsName ||
    (partyType === "person" ? "Unknown person" : "Unknown entity");

  // #1 — BOVS icon by person/entity type.
  const partyIconKey =
    partyType === "person"
      ? pd.personType === "knownPerson"
        ? "knownPerson"
        : "anonymousPerson"
      : pd.entityType?.type === "anonymousEntity"
        ? "anonymousEntity"
        : "registeredEntity";

  // #6 — nationality flag (person only).
  const nationalityName = pd.nationalities?.[0]?.name ?? raw.nationality;
  const nationalityCode = partyType === "person" ? nationalityToCode(nationalityName) : undefined;

  // #7 — identity verification complete?
  const ivd = raw.identity_verification_details ?? {};
  const idVerified = Boolean(
    ivd.identity_verified_on ||
      ivd.appointment_verification_start_on ||
      ivd.appointment_verification_statement_date
  );

  const coh = (sd.identifiers ?? []).find((i: any) => i.scheme === "GB-COH");

  return {
    lifecycle: rel.recordStatus,
    subjectName: sd.name ?? "Company",
    subjectCode: coh?.id,
    jurisdiction: sd.jurisdiction,
    partyName,
    partyType,
    partyIconKey,
    nationalityCode,
    idVerified,
    interests,
    primary,
    endDate: (rd.interests ?? [])[0]?.endDate,
  };
}

/** A plain-English one-liner readable at speed. */
export function summarise(v: EventView): string {
  const verb = v.lifecycle === "closed" ? "ceased" : v.lifecycle === "updated" ? "updated" : "new";
  const share = v.primary.shareBand ? ` (${v.primary.shareBand})` : "";
  const more = v.interests.length > 1 ? ` +${v.interests.length - 1} more` : "";
  return `${v.partyName} — ${verb} ${v.primary.type}${share}${more}`;
}
