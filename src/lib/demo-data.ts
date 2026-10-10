import { assessCompleteness } from "./completeness.ts";
import type { Finding, HandoffReport, PatientSummary, RecordEntry } from "./types.ts";

export const patientSummary: PatientSummary = {
  patientId: "CB-11024",
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

const completeness = assessCompleteness({
  patientId: patientSummary.patientId,
  name: patientSummary.name,
  age: patientSummary.age,
  sex: patientSummary.sex,
  mrn: patientSummary.mrn,
  encounterDate: patientSummary.encounterDate,
  primaryDiagnosis: patientSummary.primaryDiagnosis,
  location: patientSummary.location,
  medicationList: recordEntries.some((record) => record.type === "medication") ? "present" : "",
  dischargeSummary: recordEntries.some((record) => record.type === "discharge") ? "present" : "",
  labResults: recordEntries.some((record) => record.type === "lab") ? "present" : "",
});

export const handoffReport: HandoffReport = {
  patient: patientSummary,
  findings,
  recommendations: [
    "Confirm INR follow-up in 3-5 days.",
    "Review bleeding precautions and medication adherence with the patient.",
    "Escalate to cardiology if symptoms recur or rhythm instability persists.",
  ],
  completeness,
};
