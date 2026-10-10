export type DocumentKind =
  | "lab_report"
  | "prescription"
  | "diagnosis"
  | "discharge_summary"
  | "other";

export type VerificationStatus =
  | "unverified"
  | "verified"
  | "needs_review";

export type FindingSeverity =
  | "info"
  | "warning"
  | "review_required";

export type FindingStatus =
  | "open"
  | "reviewed"
  | "unresolved";

export type MedicalFact = {
  id: string;
  patientId: string;
  field: string;
  value: string;
  recordedAt: string | null;
  sourceId: string | null;
  verificationStatus: VerificationStatus;
};

export type MedicalDocument = {
  id: string;
  patientId: string;
  title: string;
  kind: DocumentKind;
  documentDate: string | null;
  originalFileName: string;
  sourceText: string;
  uploadedAt: string;
  extractionStatus:
    | "pending"
    | "completed"
    | "failed";
  fileHash?: string;
};

export type ReconciliationFinding = {
  id: string;
  patientId: string;
  ruleId: string;
  severity: FindingSeverity;
  message: string;
  factIds: string[];
  documentIds: string[];
  status: FindingStatus;
  createdAt: string;
};

export type ExtractionResult = {
  document: MedicalDocument;
  facts: MedicalFact[];
  warnings: string[];
  missingFields: string[];
  extractionStatus: MedicalDocument["extractionStatus"];
};

export type Severity = "low" | "moderate" | "high";

export type FindingCategory =
  | "medication"
  | "care-plan"
  | "history"
  | "risk"
  | "follow-up";

export type Finding = {
  id: string;
  title: string;
  category: FindingCategory;
  severity: Severity;
  statement: string;
  evidence: string[];
  action: string;
};

export type PatientSummary = {
  patientId: string;
  name: string;
  age: number;
  sex: string;
  mrn: string;
  encounterDate: string;
  primaryDiagnosis: string;
  location: string;
};

export type RecordEntry = {
  id: string;
  title: string;
  type: "discharge" | "progress-note" | "lab" | "medication";
  date: string;
  summary: string;
  source: string;
};

export type CompletenessSummary = {
  score: number;
  missing: string[];
  strengths: string[];
};

export type HandoffReport = {
  patient: PatientSummary;
  findings: Finding[];
  recommendations: string[];
  completeness: CompletenessSummary;
};