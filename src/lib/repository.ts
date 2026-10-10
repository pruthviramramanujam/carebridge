import { handoffReport, patientSummary, recordEntries } from "./demo-data.ts";
import type { Finding, HandoffReport, PatientSummary, RecordEntry } from "./types.ts";

export async function getPatient(): Promise<PatientSummary> {
  return patientSummary;
}

export async function listRecords(): Promise<RecordEntry[]> {
  return recordEntries;
}

export async function getHandoffReport(): Promise<HandoffReport> {
  return handoffReport;
}

export async function saveFinding(finding: Finding): Promise<Finding> {
  return finding;
}
