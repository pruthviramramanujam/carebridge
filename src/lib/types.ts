export type Severity = "low" | "moderate" | "high";

export type FindingCategory =
  | "medication"
  | "care-plan"
  | "history"
  | "risk"
  | "follow-up";

export interface Finding {
  id: string;
  title: string;
  category: FindingCategory;
  severity: Severity;
  statement: string;
  evidence: string[];
  action: string;
}

export interface PatientSummary {
  patientId: string;
  name: string;
  age: number;
  sex: string;
  mrn: string;
  encounterDate: string;
  primaryDiagnosis: string;
  location: string;
}

export interface RecordEntry {
  id: string;
  title: string;
  type: "discharge" | "progress-note" | "lab" | "medication";
  date: string;
  summary: string;
  source: string;
}

export interface CompletenessSummary {
  score: number;
  missing: string[];
  strengths: string[];
}

export interface HandoffReport {
  patient: PatientSummary;
  findings: Finding[];
  recommendations: string[];
  completeness: CompletenessSummary;
}
