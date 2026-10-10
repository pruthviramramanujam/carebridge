import type { Finding, PatientSummary, RecordEntry } from "./types.ts";

export interface ReconciliationSummary {
  totalFindings: number;
  highRiskCount: number;
  coverage: number;
  missing: string[];
  actionItems: string[];
}

export function reconcileFindings(
  patient: PatientSummary,
  findings: Finding[],
  records: RecordEntry[],
): ReconciliationSummary {
  const missing = [
    ...(patient.primaryDiagnosis ? [] : ["Primary diagnosis"]),
    ...(patient.location ? [] : ["Care location"]),
    ...(records.some((record) => record.type === "medication") ? [] : ["Medication list"]),
    ...(records.some((record) => record.type === "lab") ? [] : ["Lab results"]),
    ...(records.some((record) => record.type === "discharge") ? [] : ["Discharge summary"]),
  ];

  const highRiskCount = findings.filter((finding) => finding.severity === "high").length;
  const totalSignals = 5;
  const presentSignals = totalSignals - missing.length;
  const coverage = Math.max(0, Math.min(100, Math.round((presentSignals / totalSignals) * 100)));

  return {
    totalFindings: findings.length,
    highRiskCount,
    coverage,
    missing,
    actionItems: findings.slice(0, 3).map((finding) => finding.action),
  };
}
