export interface BodsStatement {
  statementId: string;
  recordId: string;
  recordType: "entity" | "person" | "relationship";
  recordStatus: "new" | "updated" | "closed";
  recordDetails: Record<string, unknown>;
  [k: string]: unknown;
}

export interface RiskSignal {
  code: string;
  label: string;
  level: "high" | "medium" | "low";
}

export interface StreamMessage {
  event_type: string | null;
  timepoint: number | null;
  published_at: string | null;
  psc_kind: string | null;
  ceased: boolean;
  raw: unknown;
  bods: BodsStatement[];
  schema_valid: boolean;
  risk?: RiskSignal[];
}
