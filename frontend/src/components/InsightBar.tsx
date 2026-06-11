import type { Stats } from "../lib/stats";
import { pct } from "../lib/stats";

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
      {stats.topProlific && stats.topProlific.count >= 3 && (
        <div className="stat wide">
          <div className="stat-lbl">spotted today</div>
          <div className="prolific-name">{stats.topProlific.name}</div>
          <div className="stat-lbl">
            a PSC linked to {stats.topProlific.count} companies
          </div>
        </div>
      )}
    </section>
  );
}
