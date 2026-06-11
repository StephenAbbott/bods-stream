import type { Stats } from "../lib/stats";

/** ISO 3166-1 alpha-2 -> flag emoji. */
function flagEmoji(code: string): string {
  if (code.length !== 2) return "🏳️";
  const A = 0x1f1e6;
  return String.fromCodePoint(
    A + code.toUpperCase().charCodeAt(0) - 65,
    A + code.toUpperCase().charCodeAt(1) - 65
  );
}

// Built-in ISO code -> full country name (e.g. GB -> "United Kingdom"), shown on hover.
const regionNames =
  typeof Intl !== "undefined" && (Intl as any).DisplayNames
    ? new (Intl as any).DisplayNames(["en"], { type: "region" })
    : null;

function countryName(code: string): string {
  try {
    return regionNames?.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

/** Live tally of individual-PSC nationalities — top 20 by count. */
export function NationalityBar({ stats }: { stats: Stats }) {
  const entries = Object.entries(stats.nationalities)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);
  if (entries.length === 0) return null;

  return (
    <section className="nationalities" aria-label="PSC nationalities (top 20)">
      <span className="nat-title">PSC nationalities</span>
      {entries.map(([code, n]) => (
        <span key={code} className="nat-chip" title={countryName(code)}>
          <span className="nat-flag">{flagEmoji(code)}</span>
          <span className="nat-count">{n.toLocaleString()}</span>
        </span>
      ))}
    </section>
  );
}
