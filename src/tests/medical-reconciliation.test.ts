import assert from "node:assert/strict";
import test from "node:test";

import { reconcileMedicalRecords } from "../lib/medical-reconciliation.ts";
import type { MedicalDocument, MedicalFact } from "../lib/types.ts";

function makeDocument(overrides: Partial<MedicalDocument> = {}): MedicalDocument {
  return {
    id: "doc-1",
    patientId: "patient-1",
    title: "Document",
    kind: "prescription",
    documentDate: "2026-01-01",
    originalFileName: "doc.pdf",
    sourceText: "sample",
    uploadedAt: "2026-01-01T00:00:00.000Z",
    extractionStatus: "completed",
    fileHash: `sha256:${"0".repeat(64)}`,
    ...overrides,
  };
}

function makeFact(overrides: Partial<MedicalFact> = {}): MedicalFact {
  return {
    id: "fact-1",
    patientId: "patient-1",
    field: "medication:ExampleMedicine:dose",
    value: "5 mg",
    recordedAt: "2026-01-01",
    sourceId: "doc-1",
    verificationStatus: "verified",
    ...overrides,
  };
}

test("R01: missing prescription or lab report dates produce warnings", () => {
  const docs = [
    makeDocument({ id: "doc-r01-a", kind: "prescription", documentDate: null }),
    makeDocument({ id: "doc-r01-b", kind: "prescription", documentDate: "2026-01-02" }),
    makeDocument({ id: "doc-r01-c", kind: "lab_report", documentDate: null }),
    makeDocument({ id: "doc-r01-d", kind: "lab_report", documentDate: "2026-01-03" }),
  ];

  const findings = reconcileMedicalRecords(docs, []);
  const r01 = findings.filter((finding) => finding.ruleId === "R01");

  assert.equal(r01.length, 2);
  assert.deepEqual(
    r01.map((finding) => finding.documentIds).sort(),
    [["doc-r01-a"], ["doc-r01-c"]].sort(),
  );
  assert.equal(findings.some((finding) => finding.ruleId === "R01" && finding.documentIds.includes("doc-r01-b")), false);
  assert.equal(findings.some((finding) => finding.ruleId === "R01" && finding.documentIds.includes("doc-r01-d")), false);
});

test("R02: conflicting values for the same patient and field produce a review finding", () => {
  const docs = [
    makeDocument({ id: "doc-2a", patientId: "patient-1" }),
    makeDocument({ id: "doc-2b", patientId: "patient-1" }),
    makeDocument({ id: "doc-2c", patientId: "patient-2" }),
  ];

  const facts = [
    makeFact({ id: "fact-2a", sourceId: "doc-2a", field: "medication:ExampleMedicine:dose", value: "5 mg" }),
    makeFact({ id: "fact-2b", sourceId: "doc-2b", field: "medication:ExampleMedicine:dose", value: "10 mg" }),
    makeFact({ id: "fact-2c", sourceId: "doc-2c", patientId: "patient-2", field: "medication:ExampleMedicine:dose", value: "7 mg" }),
    makeFact({ id: "fact-2d", sourceId: "doc-2a", patientId: "patient-1", field: "medication:OtherMedicine:dose", value: "5 mg" }),
  ];

  const findings = reconcileMedicalRecords(docs, facts);
  const r02 = findings.filter((finding) => finding.ruleId === "R02");

  assert.equal(r02.length, 1);
  assert.deepEqual(r02[0].factIds.sort(), ["fact-2a", "fact-2b"].sort());
  assert.deepEqual(r02[0].documentIds.sort(), ["doc-2a", "doc-2b"].sort());
  assert.equal(findings.some((finding) => finding.ruleId === "R02" && finding.factIds.includes("fact-2c")), false);
});

test("R03: duplicate document fileHash produces a duplicate finding only for same patient", () => {
  const sameHash = `sha256:${"a".repeat(64)}`;
  const differentHash = `sha256:${"b".repeat(64)}`;
  const docs = [
    makeDocument({ id: "doc-3a", patientId: "patient-1", fileHash: sameHash }),
    makeDocument({ id: "doc-3b", patientId: "patient-1", fileHash: sameHash }),
    makeDocument({ id: "doc-3c", patientId: "patient-2", fileHash: sameHash }),
    makeDocument({ id: "doc-3d", patientId: "patient-1", fileHash: differentHash }),
    makeDocument({ id: "doc-3e", patientId: "patient-1", fileHash: "not-a-reliable-hash" }),
    makeDocument({ id: "doc-3f", patientId: "patient-1", fileHash: "not-a-reliable-hash" }),
  ];

  const findings = reconcileMedicalRecords(docs, []);
  const r03 = findings.filter((finding) => finding.ruleId === "R03");

  assert.equal(r03.length, 1);
  assert.deepEqual(r03[0].documentIds.sort(), ["doc-3a", "doc-3b"].sort());
});

test("R04: uncertain current medication status produces a single finding per medicine", () => {
  const docs = [
    makeDocument({ id: "doc-4a", patientId: "patient-1" }),
    makeDocument({ id: "doc-4b", patientId: "patient-1" }),
  ];

  const facts = [
    makeFact({ id: "fact-4a", sourceId: "doc-4a", patientId: "patient-1", field: "medication:ExampleMedicine:dose", value: "5 mg" }),
    makeFact({ id: "fact-4b", sourceId: "doc-4b", patientId: "patient-1", field: "medication:ExampleMedicine:dose", value: "6 mg" }),
    makeFact({ id: "fact-4c", sourceId: "doc-4a", patientId: "patient-1", field: "medication:ExampleMedicine:status", value: "active" }),
  ];

  const findings = reconcileMedicalRecords(docs, facts);
  const r04 = findings.filter((finding) => finding.ruleId === "R04");

  assert.equal(r04.length, 0);

  const factsWithoutStatus = [
    makeFact({ id: "fact-4d", sourceId: "doc-4a", patientId: "patient-1", field: "medication:ExampleMedicine:dose", value: "5 mg" }),
    makeFact({ id: "fact-4e", sourceId: "doc-4b", patientId: "patient-1", field: "medication:ExampleMedicine:dose", value: "6 mg" }),
  ];

  const r04Findings = reconcileMedicalRecords(docs, factsWithoutStatus).filter((finding) => finding.ruleId === "R04");
  assert.equal(r04Findings.length, 1);
  assert.deepEqual(r04Findings[0].factIds.sort(), ["fact-4d", "fact-4e"].sort());
});

test("R05: missing or invalid source references produce findings", () => {
  const docs = [
    makeDocument({ id: "doc-5a", patientId: "patient-1" }),
    makeDocument({ id: "doc-5b", patientId: "patient-2" }),
  ];

  const facts = [
    makeFact({ id: "fact-5a", patientId: "patient-1", sourceId: null, field: "medication:ExampleMedicine:dose", value: "5 mg" }),
    makeFact({ id: "fact-5b", patientId: "patient-1", sourceId: "missing-doc", field: "medication:ExampleMedicine:dose", value: "6 mg" }),
    makeFact({ id: "fact-5c", patientId: "patient-1", sourceId: "doc-5b", field: "medication:OtherMedicine:dose", value: "3 mg" }),
    makeFact({ id: "fact-5d", patientId: "patient-2", sourceId: "doc-5a", field: "medication:OtherMedicine:dose", value: "4 mg" }),
  ];

  const findings = reconcileMedicalRecords(docs, facts);
  const r05 = findings.filter((finding) => finding.ruleId === "R05");

  assert.equal(r05.length, 4);
  assert.deepEqual(r05.map((finding) => finding.factIds[0]).sort(), ["fact-5a", "fact-5b", "fact-5c", "fact-5d"].sort());
});

test("empty inputs return an empty array and inputs remain unchanged", () => {
  const docs = [
    makeDocument({ id: "doc-empty", patientId: "patient-1" }),
  ];
  const facts = [
    makeFact({ id: "fact-empty", patientId: "patient-1", sourceId: "doc-empty" }),
  ];

  const originalDocs = JSON.stringify(docs);
  const originalFacts = JSON.stringify(facts);

  assert.deepEqual(reconcileMedicalRecords([], []), []);
  assert.deepEqual(
    reconcileMedicalRecords([], facts).map((finding) => finding.ruleId).sort(),
    ["R04", "R05"],
  );
  assert.deepEqual(reconcileMedicalRecords(docs, []), []);

  assert.equal(JSON.stringify(docs), originalDocs);
  assert.equal(JSON.stringify(facts), originalFacts);
});
