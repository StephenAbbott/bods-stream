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

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <div className="stat">
      <div className="stat-val">{value}</div>
      <div className="stat-lbl">{label}</div>
    </div>
  );
}

/** Live aggregate insight over every PSC event seen so far. */
export function InsightBar({ stats }: { stats: Stats }) {
  if (stats.total === 0) return null;

  const indPct = pct(stats.individual, stats.total);
  const corpPct = pct(stats.corporate, stats.total);
  const topJur = Object.entries(stats.jurisdictions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <section className="insights" aria-label="live insight">
      <Tile value={stats.total.toLocaleString()} label="events seen" />
      <div className="stat">
        <div className="stat-val">{indPct}% / {corpPct}%</div>
        <div className="stat-lbl">individual / corporate</div>
        <div className="splitbar" aria-hidden="true">
          <span className="splitbar-ind" style={{ width: `${indPct}%` }} />
          <span className="splitbar-corp" style={{ width: `${corpPct}%` }} />
        </div>
      </div>
      <Tile value={`${pct(stats.ceased, stats.total)}%`} label="ceased" />
      <Tile value={`${pct(stats.idVerified, stats.idChecked)}%`} label="identities verified" />
      {topJur.length > 0 && (
        <div className="stat wide">
          <div className="stat-lbl">corporate PSC jurisdictions</div>
          <div className="jur">
            {topJur.map(([j, n]) => (
              <span key={j} className="jur-chip">
                {j} <b>{n}</b>
              </span>
            ))}
          </div>
        </div>
      )}
      {Object.keys(stats.riskCounts).length > 0 && (
        <div className="stat wide">
          <div className="stat-val">{pct(stats.flagged, stats.total)}%</div>
          <div className="stat-lbl">events with a risk signal</div>
          <div className="jur">
            {Object.entries(stats.riskCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([code, n]) => (
                <span key={code} className="jur-chip">
                  {RISK_SHORT[code] ?? code} <b>{n}</b>
                </span>
              ))}
          </div>
        </div>
      )}
    </section>
  );
}
