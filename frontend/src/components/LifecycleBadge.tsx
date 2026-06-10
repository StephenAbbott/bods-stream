const LABELS: Record<string, { label: string; cls: string }> = {
  new: { label: "NEW", cls: "badge-new" },
  updated: { label: "UPDATED", cls: "badge-updated" },
  closed: { label: "CEASED", cls: "badge-closed" },
};

/** The BODS recordStatus of the relationship, as a lifecycle pill. */
export function LifecycleBadge({ status }: { status: string }) {
  const m = LABELS[status] ?? { label: status.toUpperCase(), cls: "badge-new" };
  return <span className={`badge ${m.cls}`}>{m.label}</span>;
}
