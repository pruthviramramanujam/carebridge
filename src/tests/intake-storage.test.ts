import assert from "node:assert/strict";
import test from "node:test";

import { extractMedicalFacts } from "../lib/extract-medical-facts.ts";
import {
  isStoredIntake,
  parseStoredIntake,
  reconcileIntakeEntries,
  UPLOAD_DEMO_PATIENT_PREFIX,
  type StoredIntake,
} from "../lib/intake-storage.ts";
import type { MedicalDocument } from "../lib/types.ts";

const PROFILE_A = "patient-upload-demo-11111111-1111-4111-8111-111111111111";
const PROFILE_B = "patient-upload-demo-22222222-2222-4222-8222-222222222222";
const SHA256_HASH = `sha256:${"a".repeat(64)}`;

function makeDocument(id: string, kind: MedicalDocument["kind"] = "prescription"): MedicalDocument {
  return {
    id,
    patientId: "patient-legacy-demo",
    title: `${id}.txt`,
    kind,
    documentDate: null,
    originalFileName: `${id}.txt`,
    sourceText: "Medication: ExampleMedicine\nDose: 5 mg",
    uploadedAt: "2026-10-10T12:00:00.000Z",
    extractionStatus: "completed",
  };
}

function toStored(document: MedicalDocument, patientId: string): StoredIntake {
  const extraction = extractMedicalFacts(
    document.sourceText,
    {
      id: document.id,
      title: document.title,
      kind: document.kind,
      documentDate: document.documentDate,
      originalFileName: document.originalFileName,
      uploadedAt: document.uploadedAt,
      ...(document.fileHash ? { fileHash: document.fileHash } : {}),
    },
    patientId,
  );
  return {
    document: extraction.document,
    sizeBytes: 44,
    format: "text",
    facts: extraction.facts,
    warnings: extraction.warnings,
    missingFields: extraction.missingFields,
    findings: [],
    reconciliationStatus: "completed",
  };
}

test("legacy TXT localStorage entries migrate to extracted review facts and reconcile", () => {
  const oldEntry = {
    document: makeDocument("legacy-text"),
    sizeBytes: 44,
    format: "text",
  };
  const loaded = parseStoredIntake(JSON.stringify([oldEntry]));

  assert.equal(loaded.malformed, false);
  assert.equal(loaded.migrated, true);
  assert.equal(loaded.entries.length, 1);
  assert.ok(loaded.entries[0].document.patientId.startsWith(UPLOAD_DEMO_PATIENT_PREFIX));
  assert.ok(loaded.entries[0].facts.length > 0);
  assert.ok(loaded.entries[0].facts.every((fact) => fact.sourceId === "legacy-text"));
  assert.equal(loaded.entries[0].reconciliationStatus, "completed");
  assert.ok(loaded.entries[0].findings.some((finding) => finding.ruleId === "R01"));
});

test("legacy PDF entries remain pending and do not create facts or findings", () => {
  const document = makeDocument("legacy-pdf");
  const loaded = parseStoredIntake(JSON.stringify([{ document, sizeBytes: 300, format: "pdf" }]));

  assert.equal(loaded.migrated, true);
  assert.equal(loaded.entries[0].document.extractionStatus, "pending");
  assert.equal(loaded.entries[0].facts.length, 0);
  assert.equal(loaded.entries[0].findings.length, 0);
  assert.equal(loaded.entries[0].reconciliationStatus, "pending");
});

test("empty legacy TXT entries migrate with failed extraction and reconciliation statuses and reload", () => {
  const document = makeDocument("legacy-empty");
  document.sourceText = " \r\n\t";
  const migrated = parseStoredIntake(JSON.stringify([{ document, sizeBytes: 4, format: "text" }]));

  assert.equal(migrated.malformed, false);
  assert.equal(migrated.entries[0].document.extractionStatus, "failed");
  assert.equal(migrated.entries[0].reconciliationStatus, "failed");
  assert.equal(migrated.entries[0].facts.length, 0);

  const reloaded = parseStoredIntake(JSON.stringify(migrated.entries));
  assert.equal(reloaded.malformed, false);
  assert.equal(reloaded.entries.length, 1);
  assert.equal(reloaded.entries[0].reconciliationStatus, "failed");
});

test("mixed valid legacy and malformed storage is marked non-persistable", () => {
  const legacy = {
    document: makeDocument("legacy-next-to-malformed"),
    sizeBytes: 44,
    format: "text",
  };
  const loaded = parseStoredIntake(JSON.stringify([legacy, { document: "invalid" }]));

  assert.equal(loaded.migrated, true);
  assert.equal(loaded.malformed, true);
  assert.equal(loaded.entries.length, 1);
  assert.equal(loaded.entries[0].document.id, "legacy-next-to-malformed");
  assert.equal(loaded.entries[0].document.extractionStatus, "completed");
});

test("malformed and cross-patient fact payloads are rejected without engine input", () => {
  const stored = toStored(makeDocument("safe-doc"), PROFILE_A);
  const tampered = {
    ...stored,
    facts: stored.facts.map((fact) => ({ ...fact, patientId: PROFILE_B })),
  };

  assert.equal(isStoredIntake(tampered), false);
  const malformed = parseStoredIntake(JSON.stringify([tampered]));
  assert.equal(malformed.malformed, true);
  assert.equal(malformed.entries.length, 0);
  assert.deepEqual(parseStoredIntake("{broken json").entries, []);
});

test("stored intake reconciliation stays within each synthetic patient", () => {
  const first = toStored(makeDocument("same-a"), PROFILE_A);
  const secondDoc = makeDocument("same-b");
  secondDoc.sourceText = "Medication: ExampleMedicine\nDose: 10 mg";
  const second = toStored(secondDoc, PROFILE_A);
  const otherPatientDoc = makeDocument("other-patient");
  otherPatientDoc.sourceText = "Medication: ExampleMedicine\nDose: 10 mg";
  const otherPatient = toStored(otherPatientDoc, PROFILE_B);

  const reconciled = reconcileIntakeEntries([first, second, otherPatient]);
  assert.ok(reconciled[0].findings.some((finding) => finding.ruleId === "R02"));
  assert.ok(reconciled[1].findings.some((finding) => finding.ruleId === "R02"));
  assert.equal(reconciled[2].findings.some((finding) => finding.ruleId === "R02"), false);
});

test("reconciliation excludes invalid profiles and facts not owned by their source document", () => {
  const valid = toStored(makeDocument("owned-source"), PROFILE_A);
  const invalidProfile = toStored(makeDocument("invalid-profile-source"), "patient-not-supported");
  invalidProfile.facts = invalidProfile.facts.map((fact) => ({
    ...fact,
    value: "10 mg",
  }));
  const wrongSource = toStored(makeDocument("wrong-source"), PROFILE_A);
  wrongSource.facts = wrongSource.facts.map((fact) => ({
    ...fact,
    value: "10 mg",
    sourceId: "another-document",
  }));

  const reconciled = reconcileIntakeEntries([valid, invalidProfile, wrongSource]);
  assert.equal(reconciled[0].findings.some((finding) => finding.ruleId === "R02"), false);
  assert.equal(reconciled[1].findings.some((finding) => finding.ruleId === "R02"), false);
  assert.equal(reconciled[2].findings.some((finding) => finding.ruleId === "R02"), false);
});

test("invalid profile IDs and cross-profile documents are rejected", () => {
  const stored = toStored(makeDocument("profile-doc"), PROFILE_A);
  assert.equal(isStoredIntake({
    ...stored,
    document: { ...stored.document, patientId: "patient-legacy-demo" },
    facts: stored.facts.map((fact) => ({ ...fact, patientId: "patient-legacy-demo" })),
  }), false);

  const crossProfileDocument = {
    ...stored,
    document: { ...stored.document, patientId: PROFILE_B },
  };
  assert.equal(isStoredIntake(crossProfileDocument), false);
});

test("forged verification states on extracted facts are rejected when loaded", () => {
  const stored = toStored(makeDocument("forged-verification"), PROFILE_A);
  const forged = {
    ...stored,
    facts: stored.facts.map((fact) => ({ ...fact, verificationStatus: "verified" })),
  };

  assert.equal(isStoredIntake(forged), false);
  const loaded = parseStoredIntake(JSON.stringify([forged]));
  assert.equal(loaded.malformed, true);
  assert.equal(loaded.entries.length, 0);
});

test("storage accepts only browser SHA-256 hashes and leaves missing hashes absent", () => {
  const withHash = makeDocument("valid-hash", "other");
  withHash.fileHash = SHA256_HASH;
  const validStored = toStored(withHash, PROFILE_A);
  assert.equal(isStoredIntake(validStored), true);

  const badHash = {
    ...validStored,
    document: { ...validStored.document, fileHash: "same-filename-is-not-a-hash" },
  };
  assert.equal(isStoredIntake(badHash), false);

  const withoutHash = toStored(makeDocument("missing-hash", "other"), PROFILE_A);
  assert.equal(Object.hasOwn(withoutHash.document, "fileHash"), false);
  assert.equal(isStoredIntake(withoutHash), true);
  assert.equal(reconcileIntakeEntries([withoutHash, {
    ...withoutHash,
    document: { ...withoutHash.document, id: "same-name-different-document" },
  }]).some((entry) => entry.findings.some((finding) => finding.ruleId === "R03")), false);
});

test("legacy invalid hashes are removed with a recoverable warning", () => {
  const document = makeDocument("legacy-bad-hash", "other");
  document.fileHash = "not-a-sha256-hash";
  const loaded = parseStoredIntake(JSON.stringify([{ document, sizeBytes: 44, format: "text" }]));

  assert.equal(loaded.malformed, false);
  assert.equal(loaded.entries.length, 1);
  assert.equal(Object.hasOwn(loaded.entries[0].document, "fileHash"), false);
  assert.ok(loaded.entries[0].warnings.some((warning) => warning.includes("hash was invalid and was removed")));
});

test("malformed document IDs, fact provenance, and finding status are rejected", () => {
  const stored = toStored(makeDocument("valid-doc"), PROFILE_A);
  assert.equal(isStoredIntake({
    ...stored,
    document: { ...stored.document, id: " " },
  }), false);
  assert.equal(isStoredIntake({
    ...stored,
    facts: stored.facts.map((fact) => ({ ...fact, sourceId: "other-doc" })),
  }), false);
  assert.equal(isStoredIntake({
    ...stored,
    reconciliationStatus: "unknown",
  }), false);

  const malformed = parseStoredIntake(JSON.stringify([
    { ...stored, document: { ...stored.document, fileHash: "sha256:abc" } },
  ]));
  assert.equal(malformed.malformed, true);
  assert.equal(malformed.entries.length, 0);
});
