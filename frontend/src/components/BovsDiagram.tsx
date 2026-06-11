import type { EventView } from "../lib/eventView";
import { BOVS_ICONS } from "../lib/bovsIcons";

const LIFECYCLE_COLOR: Record<string, string> = {
  new: "#1f9d4e",
  updated: "#3d30d4",
  closed: "#be123c",
};

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

/** Split a name onto at most two lines so it fits under the node. */
function wrapName(name: string, max = 13): string[] {
  if (name.length <= max) return [name];
  const words = name.split(/\s+/);
  if (words.length === 1) return [name.slice(0, max), truncate(name.slice(max), max)];
  let line1 = "";
  let i = 0;
  while (i < words.length) {
    const cand = line1 ? `${line1} ${words[i]}` : words[i];
    if (cand.length > max && line1) break;
    line1 = cand;
    i++;
  }
  let line2 = words.slice(i).join(" ");
  if (line2.length > max) line2 = truncate(line2, max);
  return line2 ? [line1, line2] : [line1];
}

/** A real flag SVG (flag-icons set, served from /flags/<code>.svg), framed. */
function FlagImg({ code, x, y, w = 18 }: { code?: string; x: number; y: number; w?: number }) {
  if (!code) return null;
  const h = (w * 3) / 4; // flags are 4:3
  return (
    <g>
      <image
        href={`/flags/${code.toLowerCase()}.svg`}
        x={x} y={y} width={w} height={h}
        preserveAspectRatio="xMidYMid meet"
        onError={(e) => {
          (e.currentTarget as SVGImageElement).style.display = "none";
        }}
      />
      <rect x={x} y={y} width={w} height={h} fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth="0.7" />
    </g>
  );
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
      {/* nationality flag, top-right of the person node */}
      {isPerson && <FlagImg code={view.nationalityCode} x={67} y={23} w={20} />}
      {view.idVerified && <VerifiedBadge cx={78} cy={76} />}
      {(() => {
        const lines = wrapName(view.partyName, 13);
        return (
          <text x="54" y={lines.length > 1 ? 92 : 99} textAnchor="middle" className="bovs-name">
            {lines.map((ln, i) => (
              <tspan key={i} x="54" dy={i === 0 ? 0 : 9}>{ln}</tspan>
            ))}
          </text>
        );
      })()}

      {/* subject company */}
      <rect x="276" y="26" width="172" height="56" rx="8" fill="#ffffff" stroke={color} strokeWidth="2" />
      {/* jurisdiction flag, top-left corner of the company box */}
      <FlagImg code={view.jurisdiction?.code} x={285} y={33} w={18} />
      {(() => {
        const lines = wrapName(view.subjectName, 18);
        return (
          <text x="368" y={lines.length > 1 ? 44 : 50} textAnchor="middle" className="bovs-name strong">
            {lines.map((ln, i) => (
              <tspan key={i} x="368" dy={i === 0 ? 0 : 9}>{ln}</tspan>
            ))}
          </text>
        );
      })()}
      {view.subjectCode && (
        <text x="368" y="69" textAnchor="middle" className="bovs-sub">{view.subjectCode}</text>
      )}
    </svg>
  );
}
