import type {
  MedicalDocument,
  MedicalFact,
  ReconciliationFinding,
} from "./types.ts";

const EMPTY_TS = "1970-01-01T00:00:00.000Z";
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/i;

function stableHash(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function sortUnique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))].sort();
}

function buildFinding(
  ruleId: string,
  patientId: string,
  message: string,
  factIds: string[],
  documentIds: string[],
  severity: ReconciliationFinding["severity"] extends never ? never : ReconciliationFinding["severity"],
  createdAt: string,
): ReconciliationFinding {
  const evidence = sortUnique([...factIds, ...documentIds]);
  return {
    id: `${ruleId}-${patientId}-${stableHash(evidence.join("|"))}`,
    patientId,
    ruleId,
    severity,
    message,
    factIds: sortUnique(factIds),
    documentIds: sortUnique(documentIds),
    status: "open",
    createdAt,
  };
}

function earliestUploadedAt(documents: MedicalDocument[]): string {
  if (documents.length === 0) {
    return EMPTY_TS;
  }

  const sorted = [...documents].sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt));
  return sorted[0]?.uploadedAt ?? EMPTY_TS;
}

function parseMedicationKey(field: string): string | null {
  const parts = field.split(":");
  if (parts.length < 3 || parts[0] !== "medication") {
    return null;
  }
  const medicine = parts[1]?.trim();
  return medicine && medicine.length > 0 ? medicine : null;
}

function medicationKind(field: string): string | null {
  const parts = field.split(":");
  if (parts.length < 3 || parts[0] !== "medication") {
    return null;
  }
  return parts[2]?.trim() || null;
}

export function reconcileMedicalRecords(
  documents: MedicalDocument[],
  facts: MedicalFact[],
): ReconciliationFinding[] {
  if (documents.length === 0 && facts.length === 0) {
    return [];
  }

  const findings: ReconciliationFinding[] = [];
  const seen = new Set<string>();

  const documentIndex = new Map<string, MedicalDocument>();
  for (const document of documents) {
    documentIndex.set(document.id, document);
  }

  const validSourceDocs = new Map<string, MedicalDocument[]>();
  for (const fact of facts) {
    if (!fact.sourceId) continue;
    const document = documentIndex.get(fact.sourceId);
    if (!document || document.patientId !== fact.patientId) continue;
    const group = validSourceDocs.get(`${fact.patientId}:${fact.id}`) ?? [];
    group.push(document);
    validSourceDocs.set(`${fact.patientId}:${fact.id}`, group);
  }

  for (const document of documents) {
    if ((document.kind === "prescription" || document.kind === "lab_report") && document.documentDate === null) {
      const key = `R01|${document.id}`;
      if (seen.has(key)) continue;
      findings.push(
        buildFinding(
          "R01",
          document.patientId,
          `Missing document date for ${document.kind} document "${document.title}".`,
          [],
          [document.id],
          "warning",
          document.uploadedAt,
        ),
      );
      seen.add(key);
    }
  }

  const factsByPatientField = new Map<string, MedicalFact[]>();
  for (const fact of facts) {
    const trimmedValue = fact.value.trim();
    if (!fact.patientId || !fact.field || trimmedValue.length === 0) continue;
    const key = `${fact.patientId}::${fact.field}`;
    const group = factsByPatientField.get(key) ?? [];
    group.push(fact);
    factsByPatientField.set(key, group);
  }

  for (const [key, groupedFacts] of factsByPatientField.entries()) {
    const [patientId, field] = key.split("::");
    if (!field || !patientId) continue;

    const distinctValues = new Set(
      groupedFacts
        .map((fact) => fact.value.trim())
        .filter((value) => value.length > 0),
    );

    if (distinctValues.size <= 1) continue;

    const relatedFactIds = sortUnique(groupedFacts.map((fact) => fact.id));
    const relatedDocuments = groupedFacts
      .map((fact) => (fact.sourceId ? documentIndex.get(fact.sourceId) : null))
      .filter((doc): doc is MedicalDocument => !!doc && doc.patientId === patientId)
      .map((doc) => doc.id);

    const dedupeKey = `R02|${patientId}|${field}|${relatedFactIds.join("|")}`;
    if (seen.has(dedupeKey)) continue;

    findings.push(
      buildFinding(
        "R02",
        patientId,
        `Conflicting values detected for field "${field}". Review the differing values for the same patient.`,
        relatedFactIds,
        sortUnique(relatedDocuments),
        "review_required",
        earliestUploadedAt(
          groupedFacts
            .map((fact) => (fact.sourceId ? documentIndex.get(fact.sourceId) : null))
            .filter((doc): doc is MedicalDocument => !!doc && doc.patientId === patientId),
        ),
      ),
    );
    seen.add(dedupeKey);
  }

  const fileHashGroups = new Map<string, MedicalDocument[]>();
  for (const document of documents) {
    if (!document.fileHash || !SHA256_PATTERN.test(document.fileHash)) continue;
    const key = `${document.patientId}::${document.fileHash.toLowerCase()}`;
    const group = fileHashGroups.get(key) ?? [];
    group.push(document);
    fileHashGroups.set(key, group);
  }

  for (const [key, repeatedDocuments] of fileHashGroups.entries()) {
    if (repeatedDocuments.length < 2) continue;
    const [patientId] = key.split("::");
    const dedupeKey = `R03|${patientId}|${repeatedDocuments[0]?.fileHash}`;
    if (seen.has(dedupeKey)) continue;

    findings.push(
      buildFinding(
        "R03",
        patientId,
        `Duplicate documents detected for the same fileHash under patient ${patientId}.`,
        [],
        sortUnique(repeatedDocuments.map((doc) => doc.id)),
        "warning",
        earliestUploadedAt(repeatedDocuments),
      ),
    );
    seen.add(dedupeKey);
  }

  const medicationGroups = new Map<string, { doseFacts: MedicalFact[]; statusFacts: MedicalFact[] }>();
  for (const fact of facts) {
    const medicine = parseMedicationKey(fact.field);
    if (!medicine || fact.patientId.trim().length === 0) continue;
    const kind = medicationKind(fact.field);
    if (!kind) continue;
    const key = `${fact.patientId}::${medicine}`;
    const group = medicationGroups.get(key) ?? { doseFacts: [], statusFacts: [] };
    if (kind === "dose") {
      group.doseFacts.push(fact);
    }
    if (kind === "status" || kind === "current_status") {
      group.statusFacts.push(fact);
    }
    medicationGroups.set(key, group);
  }

  for (const [key, group] of medicationGroups.entries()) {
    const [patientId, medicine] = key.split("::");
    const doseFacts = group.doseFacts.filter((fact) => fact.value.trim().length > 0);
    if (doseFacts.length === 0) continue;
    const hasCurrentStatus = group.statusFacts.some(
      (fact) => fact.value.trim().length > 0 && (fact.field.endsWith(":status") || fact.field.endsWith(":current_status")),
    );
    if (hasCurrentStatus) continue;

    const dedupeKey = `R04|${patientId}|${medicine}`;
    if (seen.has(dedupeKey)) continue;

    const relatedDocuments = doseFacts
      .map((fact) => (fact.sourceId ? documentIndex.get(fact.sourceId) : null))
      .filter((doc): doc is MedicalDocument => !!doc && doc.patientId === patientId)
      .map((doc) => doc.id);

    findings.push(
      buildFinding(
        "R04",
        patientId,
        `Medication history exists for "${medicine}" without an explicit current medication status.`,
        sortUnique(doseFacts.map((fact) => fact.id)),
        sortUnique(relatedDocuments),
        "review_required",
        earliestUploadedAt(
          doseFacts
            .map((fact) => (fact.sourceId ? documentIndex.get(fact.sourceId) : null))
            .filter((doc): doc is MedicalDocument => !!doc && doc.patientId === patientId),
        ),
      ),
    );
    seen.add(dedupeKey);
  }

  for (const fact of facts) {
    const relatedDocument = fact.sourceId ? documentIndex.get(fact.sourceId) : null;
    const hasValidSource = !!fact.sourceId && !!relatedDocument && relatedDocument.patientId === fact.patientId;
    if (hasValidSource) continue;

    const dedupeKey = `R05|${fact.patientId}|${fact.id}`;
    if (seen.has(dedupeKey)) continue;

    const validSupportingDocumentIds = fact.sourceId && relatedDocument && relatedDocument.patientId === fact.patientId
      ? [relatedDocument.id]
      : [];

    findings.push(
      buildFinding(
        "R05",
        fact.patientId,
        fact.sourceId
          ? `Fact ${fact.id} references a source document outside the same patient or an unknown document.`
          : `Fact ${fact.id} has no source document reference.`,
        [fact.id],
        validSupportingDocumentIds,
        "warning",
        fact.recordedAt ?? EMPTY_TS,
      ),
    );
    seen.add(dedupeKey);
  }

  return findings.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}
