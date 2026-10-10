import assert from "node:assert/strict";
import test from "node:test";

import { extractMedicalFacts, type MedicalDocumentMetadata } from "../lib/extract-medical-facts.ts";
import { reconcileMedicalRecords } from "../lib/medical-reconciliation.ts";
import type { DocumentKind } from "../lib/types.ts";

function makeMetadata(
  id: string,
  kind: DocumentKind = "prescription",
  fileHash?: string,
): MedicalDocumentMetadata {
  return {
    id,
    title: `Synthetic ${id}`,
    kind,
    documentDate: null,
    originalFileName: `${id}.txt`,
    uploadedAt: "2026-10-10T12:00:00.000Z",
    ...(fileHash ? { fileHash } : {}),
  };
}

test("patient name and medicine labels create review-only facts", () => {
  const sourceText = "pAtIeNt: Ravi\nmEdIcAtIoN: ExampleMedicine";
  const result = extractMedicalFacts(sourceText, makeMetadata("doc-name-med"), "upload-patient-a");

  assert.deepEqual(result.facts.map((fact) => [fact.field, fact.value]), [
    ["patient:name", "Ravi"],
    ["medication:examplemedicine:name", "ExampleMedicine"],
  ]);
  assert.ok(result.facts.every((fact) => fact.verificationStatus === "needs_review"));
  assert.equal(result.document.sourceText, sourceText);
  assert.equal(result.extractionStatus, "completed");
  assert.equal(result.facts[0]?.id, extractMedicalFacts(sourceText, makeMetadata("doc-name-med"), "upload-patient-a").facts[0]?.id);
});

test("explicit dose is extracted only when an explicitly labeled medicine is present", () => {
  const result = extractMedicalFacts(
    "Medication: ExampleMedicine\nDose: 5 mg\nUnlabeled number 240",
    makeMetadata("doc-dose"),
    "upload-patient-a",
  );

  assert.deepEqual(
    result.facts.filter((fact) => fact.field.endsWith(":dose")).map((fact) => fact.value),
    ["5 mg"],
  );
  assert.ok(result.warnings.some((warning) => warning.includes("not a supported labeled field")));

  const unassociatedDose = extractMedicalFacts("Dose: 5 mg", makeMetadata("doc-dose-alone"), "upload-patient-a");
  assert.equal(unassociatedDose.facts.length, 0);
  assert.ok(unassociatedDose.warnings.some((warning) => warning.includes("no adjacent, explicitly labeled medicine")));
});

test("dose alternatives are warned and never reduced to the first value", () => {
  const alternatives = [
    "5 mg or 10 mg",
    "5 mg / 10 mg",
    "5 mg / 10mg",
    "5mg or 10mg",
    "5mg/10mg",
    "5 mg vs 10 mg",
    "5-10 mg",
    "5 mg to 10 mg",
  ];

  for (const [index, value] of alternatives.entries()) {
    const result = extractMedicalFacts(
      `Medication: ExampleMedicine\nDose: ${value}`,
      makeMetadata(`doc-ambiguous-dose-${index}`),
      "upload-patient-a",
    );
    assert.equal(result.facts.some((fact) => fact.field.endsWith(":dose")), false, value);
    assert.ok(result.warnings.some((warning) => warning.startsWith("Ambiguous dose")), value);
  }
});

test("dose extraction ignores unrelated numbers and keeps only a directly labeled dose", () => {
  const result = extractMedicalFacts(
    "Visit number: 240\nMedication: ExampleMedicine\nDose: 5 mg\nReference number 10",
    makeMetadata("doc-dose-unrelated-numbers"),
    "upload-patient-a",
  );

  assert.deepEqual(
    result.facts.filter((fact) => fact.field.endsWith(":dose")).map((fact) => fact.value),
    ["5 mg"],
  );
});

test("explicit medicine-to-dose association resets after unrelated text", () => {
  const result = extractMedicalFacts(
    "Medication: ExampleMedicine\nThis is unrelated narrative text.\nDose: 5 mg",
    makeMetadata("doc-stale-medicine"),
    "upload-patient-a",
  );

  assert.equal(result.facts.some((fact) => fact.field.endsWith(":dose")), false);
  assert.ok(result.warnings.some((warning) => warning.includes("not a supported labeled field")));
  assert.ok(result.warnings.some((warning) => warning.includes("no adjacent, explicitly labeled medicine")));
});

test("an invalid dose field cannot leave medicine context active for a later dose", () => {
  const result = extractMedicalFacts(
    "Medication: ExampleMedicine\nDose: as directed\nDose: 5 mg",
    makeMetadata("doc-invalid-dose-context"),
    "upload-patient-a",
  );

  assert.equal(result.facts.some((fact) => fact.field.endsWith(":dose")), false);
  assert.ok(result.warnings.some((warning) => warning.includes("does not begin with one explicit amount")));
  assert.ok(result.warnings.some((warning) => warning.includes("no adjacent, explicitly labeled medicine")));
});

test("consecutive explicitly labeled medicine and dose pairs associate with the correct medicines", () => {
  const result = extractMedicalFacts(
    "Medicine: ExampleMedicine\nDose: 5 mg\nMedication: AnotherMedicine\nDose: 10 mg",
    makeMetadata("doc-multiple-medicines"),
    "upload-patient-a",
  );

  assert.deepEqual(
    result.facts.filter((fact) => fact.field.endsWith(":dose")).map((fact) => [fact.field, fact.value]),
    [
      ["medication:examplemedicine:dose", "5 mg"],
      ["medication:anothermedicine:dose", "10 mg"],
    ],
  );
});

test("a clearly labeled concentration remains a single explicit dose value", () => {
  const result = extractMedicalFacts(
    "Medication: ExampleMedicine\nDose: 5 mg / 10 ml",
    makeMetadata("doc-concentration"),
    "upload-patient-a",
  );

  assert.equal(result.facts.find((fact) => fact.field.endsWith(":dose"))?.value, "5 mg / 10 ml");
});

test("an explicitly labeled ISO date updates document metadata", () => {
  const result = extractMedicalFacts(
    "Medication: ExampleMedicine\nDate: 2026-01-12",
    makeMetadata("doc-date"),
    "upload-patient-a",
  );

  assert.equal(result.document.documentDate, "2026-01-12");
  assert.equal(result.facts[0]?.recordedAt, "2026-01-12");
  assert.equal(result.warnings.length, 0);
});

test("an unambiguous slash date is normalized and an ambiguous date is warned", () => {
  const unambiguous = extractMedicalFacts("Date: 01/14/2026", makeMetadata("doc-date-us"), "upload-patient-a");
  assert.equal(unambiguous.document.documentDate, "2026-01-14");

  const ambiguous = extractMedicalFacts("Date: 04/03/2026", makeMetadata("doc-date-ambiguous"), "upload-patient-a");
  assert.equal(ambiguous.document.documentDate, null);
  assert.ok(ambiguous.warnings.some((warning) => warning.includes("ambiguous")));
});

test("equivalent supported date formats normalize before comparison", () => {
  const result = extractMedicalFacts(
    "Date: 2026-01-14\nRecorded Date: 14/01/2026",
    makeMetadata("doc-equivalent-dates"),
    "upload-patient-a",
  );

  assert.equal(result.document.documentDate, "2026-01-14");
  assert.equal(result.warnings.some((warning) => warning.includes("Multiple different")), false);
});

test("ambiguous slash dates are not guessed or treated as conflicting", () => {
  const result = extractMedicalFacts(
    "Date: 2026-01-12\nRecorded Date: 12/01/2026",
    makeMetadata("doc-equivalent-ambiguous-date"),
    "upload-patient-a",
  );

  assert.equal(result.document.documentDate, null);
  assert.ok(result.warnings.some((warning) => warning.includes("12/01/2026") && warning.includes("ambiguous")));
  assert.equal(result.warnings.some((warning) => warning.includes("conflicts")), false);
  assert.equal(result.warnings.some((warning) => warning.includes("Multiple different")), true);
});

test("invalid explicit dates are not recorded", () => {
  const result = extractMedicalFacts(
    "Date: 2026-02-30",
    makeMetadata("doc-invalid-date"),
    "upload-patient-a",
  );

  assert.equal(result.document.documentDate, null);
  assert.ok(result.warnings.some((warning) => warning.includes("not a valid calendar date")));
});

test("prescription without a date still produces an R01 finding", () => {
  const result = extractMedicalFacts(
    "Medication: ExampleMedicine\nDose: 5 mg",
    makeMetadata("doc-no-date", "prescription"),
    "upload-patient-a",
  );
  const findings = reconcileMedicalRecords([result.document], result.facts);

  assert.ok(findings.some((finding) => finding.ruleId === "R01" && finding.documentIds.includes("doc-no-date")));
});

test("a prescription is evaluated for R01 even when no facts are extractable", () => {
  const result = extractMedicalFacts(
    "Unlabeled synthetic text only",
    makeMetadata("doc-zero-facts", "prescription"),
    "upload-patient-a",
  );
  const findings = reconcileMedicalRecords([result.document], result.facts);

  assert.equal(result.facts.length, 0);
  assert.ok(findings.some((finding) => finding.ruleId === "R01"));
});

test("date rules apply to prescriptions and lab reports, not unrelated categories", () => {
  const supportedKinds: DocumentKind[] = ["prescription", "lab_report"];
  const unsupportedKinds: DocumentKind[] = ["other", "diagnosis", "discharge_summary"];

  for (const kind of supportedKinds) {
    const extraction = extractMedicalFacts("Unlabeled content", makeMetadata(`doc-${kind}`, kind), "upload-patient-a");
    assert.ok(reconcileMedicalRecords([extraction.document], []).some((finding) => finding.ruleId === "R01"));
  }

  for (const kind of unsupportedKinds) {
    const extraction = extractMedicalFacts("Unlabeled content", makeMetadata(`doc-${kind}`, kind), "upload-patient-a");
    assert.equal(reconcileMedicalRecords([extraction.document], []).some((finding) => finding.ruleId === "R01"), false);
  }
});

test("unrecognized text returns an explanation and missing supported fields", () => {
  const result = extractMedicalFacts("Some unlabeled synthetic prose with 240", makeMetadata("doc-empty"), "upload-patient-a");

  assert.equal(result.facts.length, 0);
  assert.equal(result.extractionStatus, "completed");
  assert.ok(result.warnings.some((warning) => warning.includes("No supported labeled values")));
  assert.ok(result.warnings.some((warning) => warning.includes("not a supported labeled field")));
  assert.deepEqual(result.missingFields, ["Patient name", "Medicine", "Dose", "Date", "Allergy"]);
});

test("empty text reports zero extracted fields and still evaluates document-only rules", () => {
  const result = extractMedicalFacts(" \n  ", makeMetadata("doc-empty-text", "prescription"), "upload-patient-a");

  assert.equal(result.extractionStatus, "failed");
  assert.equal(result.facts.length, 0);
  assert.ok(result.warnings.some((warning) => warning.includes("empty or contains only whitespace")));
});

test("label-only values on separate lines are extracted with document and patient provenance", () => {
  const result = extractMedicalFacts(
    "Patient Name\nRavi\nMedicine/Medication\nExampleMedicine\nDose\n5 mg\nAllergy\nExampleSubstance",
    makeMetadata("doc-separated-labels", "other"),
    "upload-patient-a",
  );

  assert.equal(result.facts.length, 4);
  assert.ok(result.facts.every((fact) => fact.patientId === "upload-patient-a"));
  assert.ok(result.facts.every((fact) => fact.sourceId === "doc-separated-labels"));
  assert.ok(result.facts.every((fact) => fact.verificationStatus === "needs_review"));
  assert.ok(result.facts.some((fact) => fact.field === "allergy:examplesubstance" && fact.value === "ExampleSubstance"));
  assert.equal(result.document.kind, "other");
  assert.equal(reconcileMedicalRecords([result.document], result.facts).some((finding) => finding.ruleId === "R01"), false);
});

test("two TXT records for the same patient conflict, but different patients do not", () => {
  const first = extractMedicalFacts(
    "Medication: ExampleMedicine\nDose: 5 mg",
    makeMetadata("doc-same-a"),
    "upload-patient-a",
  );
  const second = extractMedicalFacts(
    "Medication: ExampleMedicine\nDose: 10 mg",
    makeMetadata("doc-same-b"),
    "upload-patient-a",
  );
  const conflict = reconcileMedicalRecords(
    [first.document, second.document],
    [...first.facts, ...second.facts],
  ).find((finding) => finding.ruleId === "R02");

  assert.ok(conflict);
  assert.deepEqual(conflict.documentIds.sort(), ["doc-same-a", "doc-same-b"]);
  assert.ok(reconcileMedicalRecords(
    [first.document, second.document],
    [...first.facts, ...second.facts],
  ).some((finding) => finding.ruleId === "R04"));

  const otherPatient = extractMedicalFacts(
    "Medication: ExampleMedicine\nDose: 10 mg",
    makeMetadata("doc-other-patient"),
    "upload-patient-b",
  );
  const separatePatients = reconcileMedicalRecords(
    [first.document, otherPatient.document],
    [...first.facts, ...otherPatient.facts],
  );
  assert.equal(separatePatients.some((finding) => finding.ruleId === "R02"), false);
});

test("R03 detects matching reliable hashes only within one patient", () => {
  const hash = `sha256:${"a".repeat(64)}`;
  const first = extractMedicalFacts("Medicine: ExampleMedicine", makeMetadata("doc-hash-a", "other", hash), "upload-patient-a");
  const second = extractMedicalFacts("Medicine: ExampleMedicine", makeMetadata("doc-hash-b", "other", hash), "upload-patient-a");
  const duplicate = reconcileMedicalRecords([first.document, second.document], [...first.facts, ...second.facts]);
  assert.ok(duplicate.some((finding) => finding.ruleId === "R03"));

  const differentPatient = extractMedicalFacts("Medicine: ExampleMedicine", makeMetadata("doc-hash-c", "other", hash), "upload-patient-c");
  const separated = reconcileMedicalRecords([first.document, differentPatient.document], [...first.facts, ...differentPatient.facts]);
  assert.equal(separated.some((finding) => finding.ruleId === "R03"), false);

  const unreliable = extractMedicalFacts("Medicine: ExampleMedicine", makeMetadata("doc-hash-invalid", "other", "sha256:abc"), "upload-patient-a");
  assert.equal(reconcileMedicalRecords([first.document, unreliable.document], [...first.facts, ...unreliable.facts]).some((finding) => finding.ruleId === "R03"), false);
});