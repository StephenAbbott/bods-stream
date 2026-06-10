import type { EventView } from "../lib/eventView";
import { BOVS_ICONS } from "../lib/bovsIcons";

const LIFECYCLE_COLOR: Record<string, string> = {
  new: "#1f8f5f",
  updated: "#1565c0",
  closed: "#be123c",
};

/** 2-letter ISO country code -> flag emoji. */
function flag(code?: string): string {
  if (!code || code.length !== 2) return "";
  const A = 0x1f1e6;
  return String.fromCodePoint(
    A + code.toUpperCase().charCodeAt(0) - 65,
    A + code.toUpperCase().charCodeAt(1) - 65
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

/** White-tick-on-green-circle, mirroring Companies House's verified-identity mark. */
function VerifiedBadge({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g aria-label="identity verified">
      <circle cx={cx} cy={cy} r="9" fill="#117a3d" stroke="#fff" strokeWidth="1.5" />
      <polyline
        points={`${cx - 4},${cy + 0.5} ${cx - 1},${cy + 3.5} ${cx + 4.5},${cy - 3}`}
        fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      />
    </g>
  );
}

/**
 * BOVS-style mini-diagram for one PSC event: interested party (BOVS person/entity
 * icon) → subject company, tinted by lifecycle (new / updated / ceased).
 */
export function BovsDiagram({ view }: { view: EventView }) {
  const color = LIFECYCLE_COLOR[view.lifecycle] ?? LIFECYCLE_COLOR.new;
  const closed = view.lifecycle === "closed";
  const isPerson = view.partyType === "person";
  const icon = BOVS_ICONS[view.partyIconKey] ?? BOVS_ICONS.knownPerson;
  const natFlag = flag(view.nationalityCode);

  const edgeLabel =
    view.interests.length > 1
      ? `${view.interests.length} interests`
      : view.primary.shareBand
        ? `${view.primary.type} · ${view.primary.shareBand}`
        : view.primary.type;

  return (
    <svg className="bovs" viewBox="0 0 460 116" role="img"
         aria-label={`${view.partyName} ${view.primary.type} ${view.subjectName}`}>
      <defs>
        <marker id={`arr-${view.lifecycle}`} viewBox="0 0 10 10" refX="9" refY="5"
                markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill={color} />
        </marker>
      </defs>

      {/* edge */}
      <line x1="88" y1="54" x2="276" y2="54" stroke={color} strokeWidth="2"
            strokeDasharray={closed ? "6 5" : undefined} markerEnd={`url(#arr-${view.lifecycle})`} />
      <text x="182" y="45" textAnchor="middle" className="bovs-edge">{truncate(edgeLabel, 30)}</text>
      {closed && view.endDate && (
        <text x="182" y="71" textAnchor="middle" className="bovs-ceased">ceased {view.endDate}</text>
      )}

      {/* interested party */}
      {isPerson ? (
        <circle cx="58" cy="54" r="26" fill={color} />
      ) : (
        <rect x="32" y="28" width="52" height="52" rx="7" fill={color} />
      )}
      <image href={icon} x="40" y="36" width="36" height="36" />
      {natFlag && (
        <>
          <circle cx="78" cy="33" r="10" fill="#fff" stroke={color} strokeWidth="1" />
          <text x="78" y="37.5" textAnchor="middle" className="bovs-flag">{natFlag}</text>
        </>
      )}
      {view.idVerified && <VerifiedBadge cx={78} cy={75} />}
      <text x="54" y="103" textAnchor="middle" className="bovs-name">{truncate(view.partyName, 15)}</text>

      {/* subject company */}
      <rect x="276" y="26" width="172" height="56" rx="8" fill="#1f232c" stroke={color} strokeWidth="2" />
      <text x="362" y="51" textAnchor="middle" className="bovs-name strong">
        {flag(view.jurisdiction?.code)} {truncate(view.subjectName, 15)}
      </text>
      {view.subjectCode && (
        <text x="362" y="69" textAnchor="middle" className="bovs-sub">{view.subjectCode}</text>
      )}
    </svg>
  );
}
