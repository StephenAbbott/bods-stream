import type { StreamMessage } from "../types";
import { nationalityToCode } from "./nationalities";

/** Cumulative tallies over every event seen (independent of the visible feed). */
export interface Stats {
  total: number;
  individual: number;
  corporate: number; // corporate-entity + legal-person PSCs (RLEs)
  other: number; // super-secure etc.
  ceased: number;
  idChecked: number; // individuals seen (denominator for verification)
  idVerified: number;
  jurisdictions: Record<string, number>; // corporate PSC country_registered tallies
  nationalities: Record<string, number>; // individual PSC nationality tallies, by ISO code
  flagged: number; // events with >= 1 risk signal
  riskCounts: Record<string, number>; // per risk-signal-code tallies
  topProlific: { name: string; count: number } | null; // most-active PSC + their distinct-company count
}

export function emptyStats(): Stats {
  return {
    total: 0, individual: 0, corporate: 0, other: 0,
    ceased: 0, idChecked: 0, idVerified: 0, jurisdictions: {}, nationalities: {},
    flagged: 0, riskCounts: {}, topProlific: null,
  };
}

export function accumulate(s: Stats, msg: StreamMessage): void {
  s.total += 1;
  if (msg.ceased) s.ceased += 1;

  const kind = (msg.psc_kind ?? "").toLowerCase();
  const raw = ((msg.raw as any)?.data ?? {}) as any;

  if (kind.includes("individual")) {
    s.individual += 1;
    s.idChecked += 1;
    const ivd = raw.identity_verification_details ?? {};
    if (
      ivd.identity_verified_on ||
      ivd.appointment_verification_start_on ||
      ivd.appointment_verification_statement_date
    ) {
      s.idVerified += 1;
    }
    const code = nationalityToCode(raw.nationality);
    if (code) s.nationalities[code] = (s.nationalities[code] ?? 0) + 1;
  } else if (kind.includes("corporate-entity") || kind.includes("legal-person")) {
    s.corporate += 1;
    const j = (raw.identification?.country_registered ?? "").trim();
    if (j) s.jurisdictions[j] = (s.jurisdictions[j] ?? 0) + 1;
  } else {
    s.other += 1;
  }

  if (msg.risk && msg.risk.length > 0) {
    s.flagged += 1;
    for (const r of msg.risk) {
      s.riskCounts[r.code] = (s.riskCounts[r.code] ?? 0) + 1;
    }
  }

  if (msg.prolific && msg.prolific > (s.topProlific?.count ?? 0)) {
    const person = (msg.bods ?? []).find((st) => st.recordType === "person");
    const pd = (person?.recordDetails ?? {}) as any;
    const name =
      raw.identity_verification_details?.preferred_name ||
      pd.names?.[0]?.fullName ||
      "a PSC";
    s.topProlific = { name, count: msg.prolific };
  }
}

export function pct(n: number, d: number): number {
  return d > 0 ? Math.round((n / d) * 100) : 0;
}
