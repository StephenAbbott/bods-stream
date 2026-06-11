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
}

export function emptyStats(): Stats {
  return {
    total: 0, individual: 0, corporate: 0, other: 0,
    ceased: 0, idChecked: 0, idVerified: 0, jurisdictions: {}, nationalities: {},
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
}

export function pct(n: number, d: number): number {
  return d > 0 ? Math.round((n / d) * 100) : 0;
}
