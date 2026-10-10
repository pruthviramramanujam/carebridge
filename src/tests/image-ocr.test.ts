import assert from "node:assert/strict";
import test from "node:test";

import { extractImageMedicalFacts } from "../lib/image-ocr.ts";
import type { MedicalDocumentMetadata } from "../lib/extract-medical-facts.ts";
import { isStoredIntake, reconcileIntakeEntries, type StoredIntake } from "../lib/intake-storage.ts";

const PATIENT_A = "patient-upload-demo-11111111-1111-4111-8111-111111111111";
const PATIENT_B = "patient-upload-demo-22222222-2222-4222-8222-222222222222";

function metadata(id: string): MedicalDocumentMetadata {
  return {
    id,
    title: `${id}.png`,
    kind: "prescription",
    documentDate: null,
    originalFileName: `${id}.png`,
    uploadedAt: "2026-10-10T12:00:00.000Z",
  };
}

function imageFile(name = "synthetic-prescription.png"): File {
  return new File(["synthetic image bytes"], name, { type: "image/png" });
}

function asStored(
  extraction: Awaited<ReturnType<typeof extractImageMedicalFacts>>,
): StoredIntake {
  return {
    document: extraction.document,
    sizeBytes: 24,
    format: "png",
    facts: extraction.facts,
    warnings: extraction.warnings,
    missingFields: extraction.missingFields,
    findings: [],
    reconciliationStatus: extraction.extractionStatus === "completed" ? "completed" : "failed",
  };
}

test("recognized OCR text flows into the existing labeled-fact extractor", async () => {
  const sourceText = "Medication: ExampleMedicine\nDose: 5 mg";
  const stages: string[] = [];
  const result = await extractImageMedicalFacts(
    imageFile(),
    metadata("ocr-flow"),
    PATIENT_A,
    async (_file, onProgress) => {
      onProgress?.({ stage: "extracting-text", progress: 0.5 });
      return { text: sourceText, confidence: 92 };
    },
    ({ stage }) => stages.push(stage),
  );

  assert.deepEqual(result.facts.map(({ field, value }) => [field, value]), [
    ["medication:examplemedicine:name", "ExampleMedicine"],
    ["medication:examplemedicine:dose", "5 mg"],
  ]);
  assert.equal(result.document.sourceText, sourceText);
  assert.equal(result.document.originalFileName, "ocr-flow.png");
  assert.equal(result.document.patientId, PATIENT_A);
  assert.equal(result.facts.every((fact) => fact.verificationStatus === "needs_review"), true);
  assert.deepEqual(stages, ["reading-image", "extracting-text", "extracting-facts"]);
});

test("blank OCR output fails without creating facts", async () => {
  const result = await extractImageMedicalFacts(
    imageFile(),
    metadata("ocr-blank"),
    PATIENT_A,
    async () => ({ text: " \n\t", confidence: 0 }),
  );

  assert.equal(result.extractionStatus, "failed");
  assert.equal(result.facts.length, 0);
  assert.ok(result.warnings.some((warning) => warning.includes("No readable text")));
});

test("OCR failures are recoverable extraction failures without fact creation", async () => {
  const result = await extractImageMedicalFacts(
    imageFile(),
    metadata("ocr-error"),
    PATIENT_A,
    async () => { throw new Error("synthetic OCR failure"); },
  );

  assert.equal(result.extractionStatus, "failed");
  assert.equal(result.facts.length, 0);
  assert.ok(result.warnings.some((warning) => warning.includes("recognition failed")));
});

test("unreadable image failures produce a recoverable warning", async () => {
  const result = await extractImageMedicalFacts(
    imageFile(),
    metadata("ocr-unreadable"),
    PATIENT_A,
    async () => { throw new Error("synthetic unreadable image"); },
  );

  assert.equal(result.extractionStatus, "failed");
  assert.equal(result.facts.length, 0);
  assert.ok(result.warnings.some((warning) => warning.includes("try a clearer PNG or JPEG")));
});

test("very low confidence OCR is preserved for inspection but not extracted as facts", async () => {
  const sourceText = "Medication: ExampleMedicine\nDose: 5 mg";
  const result = await extractImageMedicalFacts(
    imageFile(),
    metadata("ocr-low-confidence"),
    PATIENT_A,
    async () => ({ text: sourceText, confidence: 20 }),
  );

  assert.equal(result.document.sourceText, sourceText);
  assert.equal(result.extractionStatus, "failed");
  assert.equal(result.facts.length, 0);
  assert.ok(result.warnings.some((warning) => warning.includes("very low")));
});

test("OCR confidence exactly 35 allows extraction with a low-confidence warning", async () => {
  const result = await extractImageMedicalFacts(
    imageFile(),
    metadata("ocr-confidence-35"),
    PATIENT_A,
    async () => ({ text: "Medication: ExampleMedicine\nDose: 5 mg", confidence: 35 }),
  );

  assert.equal(result.extractionStatus, "completed");
  assert.equal(result.confidence, 35);
  assert.equal(result.facts.length, 2);
  assert.equal(result.facts.every((fact) => fact.verificationStatus === "needs_review"), true);
  assert.ok(result.warnings.some((warning) => warning.includes("OCR confidence is low (35%)")));
});

test("OCR confidence exactly 65 allows extraction without a low-confidence warning", async () => {
  const result = await extractImageMedicalFacts(
    imageFile(),
    metadata("ocr-confidence-65"),
    PATIENT_A,
    async () => ({ text: "Medication: ExampleMedicine\nDose: 5 mg", confidence: 65 }),
  );

  assert.equal(result.extractionStatus, "completed");
  assert.equal(result.confidence, 65);
  assert.equal(result.facts.length, 2);
  assert.equal(result.facts.every((fact) => fact.verificationStatus === "needs_review"), true);
  assert.equal(result.warnings.some((warning) => warning.includes("OCR confidence is low")), false);
});

test("OCR confidence values 34, 64, and 100 follow the configured thresholds", async () => {
  const cases = [
    { confidence: 34, status: "failed", lowConfidenceWarning: true },
    { confidence: 64, status: "completed", lowConfidenceWarning: true },
    { confidence: 100, status: "completed", lowConfidenceWarning: false },
  ] as const;

  for (const { confidence, status, lowConfidenceWarning } of cases) {
    const result = await extractImageMedicalFacts(
      imageFile(),
      metadata(`ocr-confidence-${confidence}`),
      PATIENT_A,
      async () => ({ text: "Medication: ExampleMedicine\nDose: 5 mg", confidence }),
    );

    assert.equal(result.extractionStatus, status);
    assert.equal(result.confidence, confidence);
    assert.equal(result.facts.length, status === "failed" ? 0 : 2);
    assert.equal(
      result.facts.every((fact) => fact.verificationStatus === "needs_review"),
      true,
    );
    assert.equal(
      result.warnings.some((warning) => warning.includes("OCR confidence is low")),
      lowConfidenceWarning && status === "completed",
    );
    if (confidence === 34) {
      assert.ok(result.warnings.some((warning) => warning.includes("very low")));
    }
  }
});

const invalidConfidenceCases: Array<{
  name: string;
  result: { text: string; confidence?: number };
}> = [
  { name: "missing", result: { text: "Medication: ExampleMedicine\nDose: 5 mg" } },
  { name: "NaN", result: { text: "Medication: ExampleMedicine\nDose: 5 mg", confidence: Number.NaN } },
  { name: "negative", result: { text: "Medication: ExampleMedicine\nDose: 5 mg", confidence: -1 } },
  { name: "above 100", result: { text: "Medication: ExampleMedicine\nDose: 5 mg", confidence: 101 } },
];

for (const { name, result: recognition } of invalidConfidenceCases) {
  test(`invalid ${name} OCR confidence fails without creating facts`, async () => {
    const result = await extractImageMedicalFacts(
      imageFile(),
      metadata(`ocr-confidence-${name.replaceAll(" ", "-")}`),
      PATIENT_A,
      async () => recognition,
    );

    assert.equal(result.extractionStatus, "failed");
    assert.equal(result.document.extractionStatus, "failed");
    assert.equal(result.confidence, null);
    assert.equal(result.document.sourceText, recognition.text);
    assert.equal(result.facts.length, 0);
    assert.ok(result.warnings.some((warning) => warning.includes("confidence is unavailable or invalid")));
  });
}

test("ambiguous doses and missing dates use the existing conservative extraction behavior", async () => {
  const sourceText = "Medication: ExampleMedicine\nDose: 5 mg or 10 mg";
  const result = await extractImageMedicalFacts(
    imageFile(),
    metadata("ocr-ambiguous"),
    PATIENT_A,
    async () => ({ text: sourceText, confidence: 88 }),
  );

  assert.equal(result.facts.some((fact) => fact.field.endsWith(":dose")), false);
  assert.ok(result.warnings.some((warning) => warning.startsWith("Ambiguous dose")));
  assert.deepEqual(result.missingFields, ["Patient name", "Date", "Allergy"]);
});

test("cancelled image processing does not continue into OCR", async () => {
  const controller = new AbortController();
  controller.abort();
  let recognizeCalled = false;

  await assert.rejects(
    extractImageMedicalFacts(
      imageFile(),
      metadata("ocr-cancelled"),
      PATIENT_A,
      async () => {
        recognizeCalled = true;
        return { text: "", confidence: 0 };
      },
      undefined,
      controller.signal,
    ),
    { name: "AbortError" },
  );
  assert.equal(recognizeCalled, false);
});

test("OCR facts retain source-document and profile provenance and cannot verify themselves", async () => {
  const firstResult = await extractImageMedicalFacts(
    imageFile("first.png"),
    metadata("ocr-profile-a"),
    PATIENT_A,
    async () => ({ text: "Medication: ExampleMedicine\nDose: 5 mg", confidence: 90 }),
  );
  const secondResult = await extractImageMedicalFacts(
    imageFile("second.png"),
    metadata("ocr-profile-b"),
    PATIENT_B,
    async () => ({ text: "Medication: ExampleMedicine\nDose: 10 mg", confidence: 90 }),
  );
  const first = asStored(firstResult);
  const second = asStored(secondResult);

  assert.equal(isStoredIntake(first), true);
  assert.equal(first.facts.every((fact) =>
    fact.patientId === PATIENT_A &&
    fact.sourceId === "ocr-profile-a" &&
    fact.verificationStatus === "needs_review",
  ), true);
  assert.equal(isStoredIntake({
    ...first,
    facts: first.facts.map((fact) => ({ ...fact, verificationStatus: "verified" })),
  }), false);
  assert.equal(isStoredIntake({
    ...first,
    facts: first.facts.map((fact) => ({ ...fact, sourceId: "another-image" })),
  }), false);
  assert.equal(
    reconcileIntakeEntries([first, second]).some((entry) => entry.findings.some((finding) => finding.ruleId === "R02")),
    false,
  );
});

test("same-profile OCR documents can reconcile conflicts with both source documents", async () => {
  const first = asStored(await extractImageMedicalFacts(
    imageFile("first.png"),
    metadata("ocr-conflict-a"),
    PATIENT_A,
    async () => ({ text: "Medication: ExampleMedicine\nDose: 5 mg", confidence: 90 }),
  ));
  const second = asStored(await extractImageMedicalFacts(
    imageFile("second.png"),
    metadata("ocr-conflict-b"),
    PATIENT_A,
    async () => ({ text: "Medication: ExampleMedicine\nDose: 10 mg", confidence: 90 }),
  ));

  const reconciled = reconcileIntakeEntries([first, second]);
  const conflict = reconciled.flatMap((entry) => entry.findings).find((finding) => finding.ruleId === "R02");
  assert.ok(conflict);
  assert.deepEqual(new Set(conflict.documentIds), new Set(["ocr-conflict-a", "ocr-conflict-b"]));
});
