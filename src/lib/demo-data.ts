import type {
  Finding,
  HandoffReport,
  MedicalDocument,
  MedicalFact,
  PatientSummary,
  RecordEntry,
} from "@/lib/types";

export const DEMO_PATIENT_ID = "patient-demo-001";

export const patientSummary: PatientSummary = {
  patientId: DEMO_PATIENT_ID,
  name: "Alicia Romero",
  age: 68,
  sex: "Female",
  mrn: "MRN-20481",
  encounterDate: "2026-10-08",
  primaryDiagnosis: "Post-operative atrial fibrillation",
  location: "Telemetry Unit",
};

export const recordEntries: RecordEntry[] = [
  {
    id: "rec-1",
    title: "Discharge summary",
    type: "discharge",
    date: "2026-10-08",
    summary:
      "Patient discharged after cardioversion with instruction to continue anticoagulation and return for follow-up in one week.",
    source: "Attending physician note",
  },
  {
    id: "rec-2",
    title: "Medication reconciliation",
    type: "medication",
    date: "2026-10-07",
    summary:
      "Warfarin started with target INR 2.0-3.0 and edits made to home regimen.",
    source: "Pharmacy review",
  },
  {
    id: "rec-3",
    title: "Lab panel",
    type: "lab",
    date: "2026-10-08",
    summary:
      "INR 2.4, creatinine stable, K 4.1, no hemoglobin drop noted.",
    source: "Lab results",
  },
];

export const findings: Finding[] = [
  {
    id: "finding-1",
    title: "Warfarin monitoring",
    category: "medication",
    severity: "high",
    statement:
      "The patient has been started on warfarin without a documented follow-up INR check scheduled before the next clinic visit.",
    evidence: [
      "Medication reconciliation lists warfarin initiation.",
      "Discharge instructions mention home monitoring but no explicit follow-up date.",
    ],
    action: "Schedule a same-week INR check and document the plan in the handoff note.",
  },
  {
    id: "finding-2",
    title: "Care plan detail",
    category: "care-plan",
    severity: "moderate",
    statement:
      "The patient’s care plan includes rhythm management but lacks a clear escalation trigger for new symptoms.",
    evidence: [
      "Cardiology follow-up is noted.",
      "The discharge summary omits symptom-based escalation instructions.",
    ],
    action: "Add an escalation pathway for palpitations, dizziness, or bleeding symptoms.",
  },
];

export const handoffReport: HandoffReport = {
  patient: patientSummary,
  findings,
  recommendations: [
    "Confirm INR follow-up in 3-5 days.",
    "Review bleeding precautions and medication adherence with the patient.",
    "Escalate to cardiology if symptoms recur or rhythm instability persists.",
  ],
  completeness: {
    score: 86,
    missing: ["Follow-up INR date"],
    strengths: ["Medication review", "Discharge summary", "Lab review"],
  },
};

export const demoDocuments: MedicalDocument[] = [
  {
    id: "doc-001",
    patientId: DEMO_PATIENT_ID,
    title: "Prescription - January Visit",
    kind: "prescription",
    documentDate: "2026-01-12",
    originalFileName: "prescription_january.pdf",
    sourceText:
      "FICTIONAL SAMPLE. ExampleMedicine dose recorded as 5 mg.",
    uploadedAt: "2026-10-10T09:00:00.000Z",
    extractionStatus: "completed",
    fileHash: "sample-hash-prescription-001",
  },
  {
    id: "doc-002",
    patientId: DEMO_PATIENT_ID,
    title: "Prescription - March Visit",
    kind: "prescription",
    documentDate: "2026-03-04",
    originalFileName: "prescription_march.pdf",
    sourceText:
      "FICTIONAL SAMPLE. ExampleMedicine dose recorded as 10 mg.",
    uploadedAt: "2026-10-10T09:05:00.000Z",
    extractionStatus: "completed",
    fileHash: "sample-hash-prescription-002",
  },
  {
    id: "doc-003",
    patientId: DEMO_PATIENT_ID,
    title: "Laboratory Report",
    kind: "lab_report",
    documentDate: null,
    originalFileName: "lab_report.pdf",
    sourceText:
      "FICTIONAL SAMPLE. Laboratory report; report date requires verification.",
    uploadedAt: "2026-10-10T09:10:00.000Z",
    extractionStatus: "completed",
    fileHash: "sample-hash-lab-001",
  },
  {
    id: "doc-004",
    patientId: DEMO_PATIENT_ID,
    title: "Laboratory Report",
    kind: "lab_report",
    documentDate: null,
    originalFileName: "lab_report_copy.pdf",
    sourceText:
      "FICTIONAL SAMPLE. Duplicate copy of the laboratory report.",
    uploadedAt: "2026-10-10T09:12:00.000Z",
    extractionStatus: "completed",
    fileHash: "sample-hash-lab-001",
  },
];

export const demoFacts: MedicalFact[] = [
  {
    id: "fact-001",
    patientId: DEMO_PATIENT_ID,
    field: "medication:ExampleMedicine:dose",
    value: "5 mg",
    recordedAt: "2026-01-12",
    sourceId: "doc-001",
    verificationStatus: "verified",
  },
  {
    id: "fact-002",
    patientId: DEMO_PATIENT_ID,
    field: "medication:ExampleMedicine:dose",
    value: "10 mg",
    recordedAt: "2026-03-04",
    sourceId: "doc-002",
    verificationStatus: "unverified",
  },
  {
    id: "fact-003",
    patientId: DEMO_PATIENT_ID,
    field: "lab_report:date",
    value: "Unknown",
    recordedAt: null,
    sourceId: "doc-003",
    verificationStatus: "needs_review",
  },
  {
    id: "fact-004",
    patientId: DEMO_PATIENT_ID,
    field: "allergy:example",
    value: "Unconfirmed",
    recordedAt: null,
    sourceId: null,
    verificationStatus: "needs_review",
  },
];