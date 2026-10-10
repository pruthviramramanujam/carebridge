import assert from "node:assert/strict";
import test from "node:test";

import { patientSummary } from "../lib/demo-data.ts";
import { reconcileFindings } from "../lib/reconcile.ts";

test("reconcileFindings calculates coverage and identifies missing handoff data", () => {
  const summary = reconcileFindings(
    {
      ...patientSummary,
      primaryDiagnosis: "",
      location: "",
    },
    [
      {
        id: "f-1",
        title: "Medication note",
        category: "medication",
        severity: "high",
        statement: "Patient requires warfarin review.",
        evidence: ["Medication list indicates warfarin."],
        action: "Confirm INR follow-up.",
      },
    ],
    [
      {
        id: "r-1",
        title: "Progress note",
        type: "progress-note",
        date: "2026-10-09",
        summary: "Some progress was documented.",
        source: "Nurse note",
      },
    ],
  );

  assert.equal(summary.coverage, 0);
  assert.deepEqual(summary.missing, [
    "Primary diagnosis",
    "Care location",
    "Medication list",
    "Lab results",
    "Discharge summary",
  ]);
  assert.equal(summary.highRiskCount, 1);
});
