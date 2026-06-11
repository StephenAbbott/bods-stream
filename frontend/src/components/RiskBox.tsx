import type { Stats } from "../lib/stats";
import { pct } from "../lib/stats";

const RISK_SHORT: Record<string, string> = {
  FATF_BLACK_LIST: "FATF black",
  FATF_GREY_LIST: "FATF grey",
  NON_EU_JURISDICTION: "non-EU",
  TRUST_OR_ARRANGEMENT: "trust",
  NOMINEE: "nominee",
  OPAQUE_OWNERSHIP: "super-secure",
  SANCTIONED: "sanctioned",
};

/** Compact live risk-rate box: % of events flagged + a per-signal tally. */
export function RiskBox({ stats }: { stats: Stats }) {
  const entries = Object.entries(stats.riskCounts).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;

  return (
    <section className="riskbox" aria-label="risk signals">
      <div className="stat-val">{pct(stats.flagged, stats.total)}%</div>
      <div className="stat-lbl">events with a risk signal</div>
      <div className="risk-tally">
        {entries.map(([code, n]) => (
          <span key={code} className="jur-chip">
            {RISK_SHORT[code] ?? code} <b>{n}</b>
          </span>
        ))}
      </div>
    </section>
  );
}
