import { extractMedicalFacts } from "./extract-medical-facts.ts";
import { reconcileMedicalRecords } from "./medical-reconciliation.ts";
import type {
  DocumentKind,
  FindingSeverity,
  FindingStatus,
  MedicalDocument,
  MedicalFact,
  ReconciliationFinding,
} from "./types.ts";

export const INTAKE_STORAGE_KEY = "carebridge:demo:intake:v1";
export const UPLOAD_DEMO_PATIENT_PREFIX = "patient-upload-demo-";

export const INTAKE_FORMATS = ["pdf", "png", "jpeg", "text"] as const;

export type IntakeFormat = (typeof INTAKE_FORMATS)[number];
export type ReconciliationStatus = "pending" | "completed" | "failed";

export type StoredIntake = {
  document: MedicalDocument;
  sizeBytes: number;
  format: IntakeFormat;
  facts: MedicalFact[];
  warnings: string[];
  missingFields: string[];
  findings: ReconciliationFinding[];
  reconciliationStatus: ReconciliationStatus;
};

export type IntakeLoadResult = {
  entries: StoredIntake[];
  malformed: boolean;
  migrated: boolean;
};

const DOCUMENT_KINDS: DocumentKind[] = [
  "lab_report",
  "prescription",
  "diagnosis",
  "discharge_summary",
  "other",
];

const VERIFICATION_STATUSES = ["unverified", "verified", "needs_review"] as const;
const FINDING_SEVERITIES: FindingSeverity[] = ["info", "warning", "review_required"];
const FINDING_STATUSES: FindingStatus[] = ["open", "reviewed", "unresolved"];
const DOCUMENT_STATUSES = ["pending", "completed", "failed"] as const;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;
const UPLOAD_PROFILE_PATTERN = /^patient-upload-demo-(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|legacy-[0-9a-f]{8})$/i;
const DOCUMENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const FACT_ID_PATTERN = /^fact-[a-f0-9]{8}$/;
const FINDING_ID_PATTERN = /^R0[1-5]-[A-Za-z0-9._:-]+-[a-f0-9]{8}$/;

function isUploadProfileId(value: unknown): value is string {
  return typeof value === "string" && UPLOAD_PROFILE_PATTERN.test(value);
}

function isValidIsoDate(value: string): boolean {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMedicalDocument(
  value: unknown,
  requireUploadProfile = true,
  allowLegacyHash = false,
): value is MedicalDocument {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    DOCUMENT_ID_PATTERN.test(value.id) &&
    typeof value.patientId === "string" &&
    (!requireUploadProfile || isUploadProfileId(value.patientId)) &&
    typeof value.title === "string" &&
    DOCUMENT_KINDS.includes(value.kind as DocumentKind) &&
    (value.documentDate === null || (typeof value.documentDate === "string" && isValidIsoDate(value.documentDate))) &&
    typeof value.originalFileName === "string" &&
    typeof value.sourceText === "string" &&
    typeof value.uploadedAt === "string" && Number.isFinite(Date.parse(value.uploadedAt)) &&
    DOCUMENT_STATUSES.includes(value.extractionStatus as (typeof DOCUMENT_STATUSES)[number]) &&
    (value.fileHash === undefined || (
      typeof value.fileHash === "string" &&
      (SHA256_PATTERN.test(value.fileHash) || (allowLegacyHash && value.fileHash.length > 0))
    ))
  );
}

function isMedicalFact(value: unknown): value is MedicalFact {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    FACT_ID_PATTERN.test(value.id) &&
    typeof value.patientId === "string" &&
    typeof value.field === "string" && value.field.trim().length > 0 &&
    typeof value.value === "string" && value.value.trim().length > 0 &&
    (value.recordedAt === null || (typeof value.recordedAt === "string" && isValidIsoDate(value.recordedAt))) &&
    (value.sourceId === null || (typeof value.sourceId === "string" && DOCUMENT_ID_PATTERN.test(value.sourceId))) &&
    VERIFICATION_STATUSES.includes(value.verificationStatus as (typeof VERIFICATION_STATUSES)[number])
  );
}

function isFinding(value: unknown): value is ReconciliationFinding {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    FINDING_ID_PATTERN.test(value.id) &&
    typeof value.patientId === "string" &&
    typeof value.ruleId === "string" &&
    /^R0[1-5]$/.test(value.ruleId) &&
    value.id.startsWith(`${value.ruleId}-`) &&
    FINDING_SEVERITIES.includes(value.severity as FindingSeverity) &&
    typeof value.message === "string" && value.message.trim().length > 0 &&
    Array.isArray(value.factIds) && value.factIds.every((id) => typeof id === "string" && FACT_ID_PATTERN.test(id)) &&
    Array.isArray(value.documentIds) && value.documentIds.every((id) => typeof id === "string" && DOCUMENT_ID_PATTERN.test(id)) &&
    FINDING_STATUSES.includes(value.status as FindingStatus) &&
    typeof value.createdAt === "string" && Number.isFinite(Date.parse(value.createdAt))
  );
}

function isLegacyBase(value: unknown): value is Record<string, unknown> & {
  document: MedicalDocument;
  sizeBytes: number;
  format: IntakeFormat;
} {
  if (!isRecord(value) || !isMedicalDocument(value.document, false, true)) return false;
  return (
    typeof value.sizeBytes === "number" &&
    Number.isFinite(value.sizeBytes) &&
    value.sizeBytes >= 0 &&
    value.sizeBytes <= MAX_FILE_SIZE &&
    INTAKE_FORMATS.includes(value.format as IntakeFormat)
  );
}

export function isStoredIntake(value: unknown): value is StoredIntake {
  if (!isLegacyBase(value) || !isRecord(value)) return false;
  const validShape = (
    Array.isArray(value.facts) && value.facts.every(isMedicalFact) &&
    Array.isArray(value.warnings) && value.warnings.every((warning) => typeof warning === "string") &&
    Array.isArray(value.missingFields) && value.missingFields.every((field) => typeof field === "string") &&
    Array.isArray(value.findings) && value.findings.every(isFinding) &&
    ["pending", "completed", "failed"].includes(value.reconciliationStatus as string)
  );
  if (!validShape) return false;

  const entry = value as unknown as StoredIntake;
  if (
    !isUploadProfileId(entry.document.patientId) ||
    !SHA256_PATTERN.test(entry.document.fileHash ?? "") && entry.document.fileHash !== undefined ||
    !entry.findings.every((finding) => finding.patientId === entry.document.patientId)
  ) return false;
  const factsBelongToDocument = entry.facts.every(
    (fact) => fact.patientId === entry.document.patientId &&
      fact.sourceId === entry.document.id &&
      fact.verificationStatus === "needs_review" &&
      fact.recordedAt === entry.document.documentDate,
  );
  if (!factsBelongToDocument) return false;

  const supportsTextExtraction = entry.format === "text" ||
    ((entry.format === "png" || entry.format === "jpeg") && entry.document.extractionStatus !== "pending");
  if (supportsTextExtraction && entry.document.extractionStatus === "completed") {
    if (!entry.document.sourceText.trim()) return false;
    const extraction = extractMedicalFacts(
      entry.document.sourceText,
      migrationMetadata(entry.document),
      entry.document.patientId,
    );
    const expectedFacts = extraction.facts.map((fact) => [fact.id, fact.field, fact.value, fact.patientId, fact.sourceId, fact.recordedAt, fact.verificationStatus]);
    const storedFacts = entry.facts.map((fact) => [fact.id, fact.field, fact.value, fact.patientId, fact.sourceId, fact.recordedAt, fact.verificationStatus]);
    if (
      extraction.extractionStatus !== entry.document.extractionStatus ||
      extraction.document.documentDate !== entry.document.documentDate ||
      JSON.stringify(expectedFacts) !== JSON.stringify(storedFacts) ||
      JSON.stringify(extraction.missingFields) !== JSON.stringify(entry.missingFields) ||
      extraction.warnings.some((warning, index) => entry.warnings[index] !== warning)
    ) return false;
  }

  if (supportsTextExtraction) {
    if (entry.document.extractionStatus === "completed" && entry.document.sourceText.trim()) {
      return entry.reconciliationStatus === "completed";
    }
    if (entry.format !== "text" && entry.document.extractionStatus === "failed") {
      return (
        entry.reconciliationStatus === "failed" &&
        entry.facts.length === 0 &&
        entry.findings.length === 0 &&
        entry.warnings.length > 0
      );
    }
    return (
      entry.document.extractionStatus === "failed" &&
      entry.reconciliationStatus === "failed" &&
      !entry.document.sourceText.trim() &&
      entry.facts.length === 0 &&
      entry.findings.length === 0
    );
  }

  return (
    entry.format === "pdf" ||
    entry.format === "png" ||
    entry.format === "jpeg"
  ) && (
    entry.document.extractionStatus === "pending" &&
    entry.reconciliationStatus === "pending" &&
    entry.document.sourceText.length === 0 &&
    entry.facts.length === 0 &&
    entry.findings.length === 0
  );
}

function stableIdentifier(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function migrationMetadata(document: MedicalDocument) {
  return {
    id: document.id,
    title: document.title,
    kind: document.kind,
    documentDate: document.documentDate,
    originalFileName: document.originalFileName,
    uploadedAt: document.uploadedAt,
    ...(document.fileHash && SHA256_PATTERN.test(document.fileHash) ? { fileHash: document.fileHash } : {}),
  };
}

function migrateLegacyEntry(value: unknown): StoredIntake | null {
  if (!isLegacyBase(value)) return null;

  const patientId = `${UPLOAD_DEMO_PATIENT_PREFIX}legacy-${stableIdentifier(value.document.patientId)}`;
  const hasUnreliableHash = value.document.fileHash !== undefined && !SHA256_PATTERN.test(value.document.fileHash);
  const hashWarning = hasUnreliableHash
    ? ["A previously stored file hash was invalid and was removed; duplicate-file checking is unavailable for this entry."]
    : [];
  if (value.format === "text" && value.document.sourceText.trim().length > 0) {
    const extraction = extractMedicalFacts(
      value.document.sourceText,
      migrationMetadata(value.document),
      patientId,
    );
    return {
      ...value,
      document: extraction.document,
      facts: extraction.facts,
      warnings: [...extraction.warnings, ...hashWarning],
      missingFields: extraction.missingFields,
      findings: [],
      reconciliationStatus: "completed",
    };
  }

  const isText = value.format === "text";
  const { fileHash, ...legacyDocument } = value.document;
  const migratedDocument = {
    ...legacyDocument,
    ...(fileHash && SHA256_PATTERN.test(fileHash)
      ? { fileHash }
      : {}),
    patientId,
    extractionStatus: isText ? "failed" as const : "pending" as const,
  };
  return {
    ...value,
    document: migratedDocument,
    facts: [],
    warnings: [...(isText
      ? ["Previously saved text was empty; no medical facts were extracted."]
      : ["PDF and image parsing are not implemented; this entry remains pending."]), ...hashWarning],
    missingFields: [],
    findings: [],
    reconciliationStatus: isText ? "failed" : "pending",
  };
}

export function reconcileIntakeEntries(entries: StoredIntake[]): StoredIntake[] {
  const validEntries = entries.filter(isStoredIntake);
  const documentIdCounts = new Map<string, number>();
  const factIdCounts = new Map<string, number>();
  for (const entry of validEntries) {
    documentIdCounts.set(entry.document.id, (documentIdCounts.get(entry.document.id) ?? 0) + 1);
    for (const fact of entry.facts) {
      factIdCounts.set(fact.id, (factIdCounts.get(fact.id) ?? 0) + 1);
    }
  }
  const safeEntries = validEntries.filter((entry) =>
    documentIdCounts.get(entry.document.id) === 1 &&
    entry.facts.every((fact) =>
      fact.patientId === entry.document.patientId &&
      fact.sourceId === entry.document.id &&
      factIdCounts.get(fact.id) === 1,
    ),
  );
  const safeEntrySet = new Set(safeEntries);
  const byPatient = new Map<string, StoredIntake[]>();
  for (const entry of safeEntries) {
    if (
      entry.format === "pdf" ||
      entry.document.extractionStatus !== "completed" ||
      entry.reconciliationStatus !== "completed"
    ) continue;
    const patientEntries = byPatient.get(entry.document.patientId) ?? [];
    patientEntries.push(entry);
    byPatient.set(entry.document.patientId, patientEntries);
  }

  const findingsByPatient = new Map<string, ReconciliationFinding[]>();
  for (const [patientId, patientEntries] of byPatient) {
    const documents = patientEntries.map((entry) => entry.document);
    const facts = patientEntries.flatMap((entry) => entry.facts).filter((fact) =>
      fact.patientId === patientId && documents.some((document) => document.id === fact.sourceId && document.patientId === patientId),
    );
    findingsByPatient.set(patientId, reconcileMedicalRecords(documents, facts));
  }

  return entries.map((entry) => {
    if (!safeEntrySet.has(entry)) return entry;
    const patientFindings = findingsByPatient.get(entry.document.patientId) ?? [];
    const ownFactIds = new Set(entry.facts.map((fact) => fact.id));
    const relevantFindings = patientFindings.filter((finding) =>
      finding.documentIds.includes(entry.document.id) || finding.factIds.some((factId) => ownFactIds.has(factId)),
    );
    return {
      ...entry,
      findings: relevantFindings,
    };
  });
}

export function parseStoredIntake(value: string | null): IntakeLoadResult {
  if (value === null) return { entries: [], malformed: false, migrated: false };

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return { entries: [], malformed: true, migrated: false };
  }

  if (!Array.isArray(parsed)) return { entries: [], malformed: true, migrated: false };

  let malformed = false;
  let migrated = false;
  const entries: StoredIntake[] = [];

  for (const candidate of parsed) {
    if (isStoredIntake(candidate)) {
      entries.push(candidate);
      continue;
    }

    if (isLegacyBase(candidate) && isRecord(candidate)) {
      const hasExtendedFields = ["facts", "warnings", "missingFields", "findings", "reconciliationStatus"]
        .some((field) => Object.hasOwn(candidate, field));
      if (!hasExtendedFields) {
        const migratedEntry = migrateLegacyEntry(candidate);
        if (migratedEntry) {
          entries.push(migratedEntry);
          migrated = true;
          continue;
        }
      }
    }

    malformed = true;
  }

  const entriesByDocumentId = new Map<string, StoredIntake[]>();
  const entriesByFactId = new Map<string, StoredIntake[]>();
  for (const entry of entries) {
    const sameDocumentId = entriesByDocumentId.get(entry.document.id) ?? [];
    sameDocumentId.push(entry);
    entriesByDocumentId.set(entry.document.id, sameDocumentId);
    for (const fact of entry.facts) {
      const sameFactId = entriesByFactId.get(fact.id) ?? [];
      sameFactId.push(entry);
      entriesByFactId.set(fact.id, sameFactId);
    }
  }
  const duplicatedDocumentIds = new Set(
    [...entriesByDocumentId].filter(([, matches]) => matches.length > 1).map(([id]) => id),
  );
  const duplicatedFactIds = new Set(
    [...entriesByFactId].filter(([, matches]) => matches.length > 1).map(([id]) => id),
  );
  const preliminaryEntries = entries.filter((entry) =>
    !duplicatedDocumentIds.has(entry.document.id) &&
    !entry.facts.some((fact) => duplicatedFactIds.has(fact.id)),
  );
  if (preliminaryEntries.length !== entries.length) malformed = true;

  const documentOwners = new Map(preliminaryEntries.map((entry) => [entry.document.id, entry.document.patientId]));
  const factOwners = new Map(preliminaryEntries.flatMap((entry) =>
    entry.facts.map((fact) => [fact.id, fact.patientId] as const),
  ));
  const validatedEntries = preliminaryEntries.filter((entry) =>
    !entry.findings.some((finding) =>
      finding.documentIds.some((id) => documentOwners.get(id) !== finding.patientId) ||
      finding.factIds.some((id) => factOwners.get(id) !== finding.patientId),
    ),
  );
  if (validatedEntries.length !== preliminaryEntries.length) malformed = true;

  return {
    entries: reconcileIntakeEntries(validatedEntries),
    malformed,
    migrated,
  };
}

export function createUploadPatientId(): string {
  return `${UPLOAD_DEMO_PATIENT_PREFIX}${crypto.randomUUID()}`;
}
