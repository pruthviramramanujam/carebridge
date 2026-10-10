import type {
  ExtractionResult,
  MedicalDocument,
  MedicalFact,
} from "./types.ts";

export type MedicalDocumentMetadata = Omit<
  MedicalDocument,
  "patientId" | "sourceText" | "extractionStatus"
>;

type SupportedLabel = "patient" | "medicine" | "dose" | "date" | "allergy";

const LABELS: { label: RegExp; field: SupportedLabel }[] = [
  { label: /^patient(?:\s+name)?$/i, field: "patient" },
  { label: /^(?:(?:medicine\s*\/\s*medication)|(?:medicine|medication|drug))(?:\s+name)?$/i, field: "medicine" },
  { label: /^(?:dose|dosage)$/i, field: "dose" },
  { label: /^(?:(?:document|recorded)\s+)?date$/i, field: "date" },
  { label: /^allergy(?:\s+to)?$/i, field: "allergy" },
];

const DOSE_TOKEN = /(\d+(?:\.\d+)?)\s*(mcg|μg|ug|mg|kg|g|ml|units?|tablets?|capsules?)\b/gi;
const CONCENTRATION = /^(\d+(?:\.\d+)?)\s*(mcg|μg|ug|mg|kg|g|ml)\s*\/\s*(\d+(?:\.\d+)?)\s*(ml)$/i;
const ALLOWED_DOSE_QUALIFIER = /^(?:(?:once|twice|three times)\s+(?:daily|a day)|daily|weekly|nightly|as needed|prn|at bedtime|every\s+\d+\s+(?:hours?|days?)|with food|with meals)$/i;

function stableHash(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function cleanValue(value: string): string {
  return value.trim().replace(/^[\s:=\-]+|[\s,;]+$/g, "");
}

function labelFor(line: string): { field: SupportedLabel; value: string } | null {
  const match = line.match(/^\s*([^:=]+?)\s*[:=]\s*(.*?)\s*$/);
  if (match) {
    const configured = LABELS.find((item) => item.label.test(match[1].trim()));
    return configured ? { field: configured.field, value: cleanValue(match[2]) } : null;
  }

  const configured = LABELS.find((item) => item.label.test(line.trim()));
  return configured ? { field: configured.field, value: "" } : null;
}

function parseDate(value: string): { iso: string | null; warning?: string } {
  const isoMatch = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, yearText, monthText, dayText] = isoMatch;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) {
      return { iso: `${yearText}-${monthText.padStart(2, "0")}-${dayText.padStart(2, "0")}` };
    }
    return { iso: null, warning: `The date "${value}" is not a valid calendar date.` };
  }

  const numericMatch = value.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
  if (numericMatch) {
    const first = Number(numericMatch[1]);
    const second = Number(numericMatch[2]);
    const yearText = numericMatch[3];
    let month: number;
    let day: number;

    if (first > 12 && second <= 12) {
      day = first;
      month = second;
    } else if (second > 12 && first <= 12) {
      month = first;
      day = second;
    } else if (first <= 12 && second <= 12) {
      return { iso: null, warning: `The date "${value}" is ambiguous; use YYYY-MM-DD.` };
    } else {
      return { iso: null, warning: `The date "${value}" is not a valid calendar date.` };
    }

    const year = Number(yearText);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) {
      return { iso: `${yearText}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` };
    }
    return { iso: null, warning: `The date "${value}" is not a valid calendar date.` };
  }

  const monthNames = "January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec";
  const namedMatch = value.match(new RegExp(`^(${monthNames})\\.?\\s+(\\d{1,2}),?\\s+(\\d{4})$`, "i"))
    ?? value.match(new RegExp(`^(\\d{1,2})\\s+(${monthNames})\\.?[,]?\\s+(\\d{4})$`, "i"));
  if (namedMatch) {
    const monthToken = namedMatch[1].match(/^\d/) ? namedMatch[2] : namedMatch[1];
    const day = Number(namedMatch[1].match(/^\d/) ? namedMatch[1] : namedMatch[2]);
    const year = Number(namedMatch[3]);
    const monthIndex = [
      "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec",
    ].indexOf(monthToken.slice(0, 3).toLowerCase());
    const date = new Date(Date.UTC(year, monthIndex, day));
    if (monthIndex >= 0 && date.getUTCFullYear() === year && date.getUTCMonth() === monthIndex && date.getUTCDate() === day) {
      return { iso: `${String(year).padStart(4, "0")}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}` };
    }
    return { iso: null, warning: `The date "${value}" is not a valid calendar date.` };
  }

  return { iso: null, warning: `The date "${value}" was not recognized; no date was recorded.` };
}

function makeFact(
  patientId: string,
  document: MedicalDocument,
  field: string,
  value: string,
): MedicalFact {
  return {
    id: `fact-${stableHash(`${document.id}|${patientId}|${field}|${value}`)}`,
    patientId,
    field,
    value,
    recordedAt: document.documentDate,
    sourceId: document.id,
    verificationStatus: "needs_review",
  };
}

function fieldValue(slug: string): string {
  return slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function explicitDose(value: string): { dose?: string; warning?: string } {
  const trimmed = value.trim();
  const concentration = trimmed.match(CONCENTRATION);
  if (concentration) {
    return { dose: `${concentration[1]} ${concentration[2]} / ${concentration[3]} ${concentration[4]}` };
  }

  const doseMatches = [...trimmed.matchAll(DOSE_TOKEN)];
  const hasAlternativeConnector = /\b(?:or|and\/or|versus|vs\.?)\b/i.test(trimmed)
    || /\d+(?:\.\d+)?\s*(?:\/|[-–]|\bto\b)\s*\d+(?:\.\d+)?/i.test(trimmed);

  if (doseMatches.length > 1 || hasAlternativeConnector) {
    return { warning: `Ambiguous dose "${trimmed}" contains alternatives or multiple amounts; no dose fact was created and human review is needed.` };
  }

  const match = doseMatches[0];
  if (!match || match.index !== 0) {
    return { warning: `The dose value "${trimmed}" does not begin with one explicit amount and unit.` };
  }

  const qualifier = trimmed.slice(match[0].length).trim().replace(/^[,;]\s*/, "");
  if (qualifier && !ALLOWED_DOSE_QUALIFIER.test(qualifier)) {
    return { warning: `The dose value "${trimmed}" has unrecognized trailing text; no dose fact was created and human review is needed.` };
  }

  return { dose: `${match[1]} ${match[2]}` };
}

export function extractMedicalFacts(
  sourceText: string,
  metadata: MedicalDocumentMetadata,
  patientId: string,
): ExtractionResult {
  const document: MedicalDocument = {
    ...metadata,
    patientId,
    sourceText,
    extractionStatus: "completed",
  };
  const warnings: string[] = [];
  const extractedFacts: MedicalFact[] = [];
  const observedLabels = new Set<SupportedLabel>();
  const dateValues = new Set<string>();
  let currentMedicine: string | null = null;
  const lines = sourceText.split(/\r?\n/);

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex].trim();
    if (!line) continue;

    let recognized = labelFor(line);
    if (recognized && !recognized.value) {
      let nextIndex = lineIndex + 1;
      while (nextIndex < lines.length && !lines[nextIndex].trim()) nextIndex += 1;
      if (nextIndex < lines.length && !labelFor(lines[nextIndex].trim())) {
        recognized = { ...recognized, value: cleanValue(lines[nextIndex]) };
        lineIndex = nextIndex;
      }
    }

    if (!recognized) {
      currentMedicine = null;
      warnings.push(`Line ${lineIndex + 1} was not a supported labeled field and was not interpreted.`);
      continue;
    }

    if (recognized.field !== "medicine" && recognized.field !== "dose") {
      currentMedicine = null;
    }
    if (recognized.field === "medicine") {
      currentMedicine = recognized.value || null;
    }

    observedLabels.add(recognized.field);
    if (!recognized.value) {
      warnings.push(`The ${recognized.field} label has no value.`);
      continue;
    }

    if (recognized.field === "patient") {
      extractedFacts.push(makeFact(patientId, document, "patient:name", recognized.value));
      continue;
    }

    if (recognized.field === "medicine") {
      const medicineKey = fieldValue(recognized.value);
      if (!medicineKey || /\b(?:or|and\/or|versus|vs\.?)\b|\s\/\s/i.test(recognized.value)) {
        currentMedicine = null;
        warnings.push(`Ambiguous medicine value "${recognized.value}" requires human review; no medicine fact was created.`);
        continue;
      }
      extractedFacts.push(makeFact(
        patientId,
        document,
        `medication:${medicineKey}:name`,
        recognized.value,
      ));
      continue;
    }

    if (recognized.field === "dose") {
      const associatedMedicine = currentMedicine;
      currentMedicine = null;
      const parsedDose = explicitDose(recognized.value);
      if (!parsedDose.dose) {
        warnings.push(parsedDose.warning ?? `The dose value "${recognized.value}" was not extracted.`);
      } else if (!associatedMedicine) {
        warnings.push(`The dose "${parsedDose.dose}" has no adjacent, explicitly labeled medicine to associate with it.`);
      } else {
        extractedFacts.push(makeFact(
          patientId,
          document,
          `medication:${fieldValue(associatedMedicine)}:dose`,
          parsedDose.dose,
        ));
      }
      continue;
    }

    if (recognized.field === "date") {
      dateValues.add(recognized.value);
      continue;
    }

    const allergyKey = fieldValue(recognized.value);
    if (!allergyKey) {
      warnings.push("The allergy value could not be converted to a source-specific field.");
    } else if (/\b(?:or|and\/or|versus|vs\.?)\b|\s\/\s/i.test(recognized.value)) {
      warnings.push(`Ambiguous allergy value "${recognized.value}" requires human review; no allergy fact was created.`);
    } else {
      extractedFacts.push(makeFact(patientId, document, `allergy:${allergyKey}`, recognized.value));
    }
  }

  let existingMetadataDate: string | null = null;
  if (document.documentDate) {
    const parsedMetadataDate = parseDate(document.documentDate);
    if (parsedMetadataDate.iso) existingMetadataDate = parsedMetadataDate.iso;
    else warnings.push(`Document metadata date "${document.documentDate}" is invalid or ambiguous and was not trusted.`);
    document.documentDate = existingMetadataDate;
  }

  if (dateValues.size > 0) {
    const parsedDates = [...dateValues].map((value) => ({ value, parsed: parseDate(value) }));
    for (const { parsed } of parsedDates) {
      if (!parsed.iso && parsed.warning) warnings.push(parsed.warning);
    }
    const hasUnresolvedDates = parsedDates.some(({ parsed }) => !parsed.iso);
    const canonicalDates = new Set(parsedDates.flatMap(({ parsed }) => parsed.iso ? [parsed.iso] : []));

    if (!hasUnresolvedDates && canonicalDates.size === 1) {
      const textDate = [...canonicalDates][0];
      if (existingMetadataDate && existingMetadataDate !== textDate) {
        warnings.push("The explicitly labeled text date conflicts with document metadata; the metadata date was retained for review.");
      } else {
        document.documentDate = textDate;
      }
    } else if (canonicalDates.size > 1 || (dateValues.size > 1 && hasUnresolvedDates)) {
      warnings.push("Multiple different or unresolved date values were labeled; no text date was selected.");
    }
  }

  const facts = [...new Map(extractedFacts.map((fact) => [fact.id, fact])).values()];
  document.extractionStatus = sourceText.trim() ? "completed" : "failed";
  for (const fact of facts) {
    if (fact.recordedAt !== document.documentDate) fact.recordedAt = document.documentDate;
  }

  const expectedFields = [
    ["patient", "Patient name"],
    ["medicine", "Medicine"],
    ["dose", "Dose"],
    ["date", "Date"],
    ["allergy", "Allergy"],
  ] as const;
  const missingFields = expectedFields
    .filter(([field]) => !observedLabels.has(field))
    .map(([, label]) => label);

  if (facts.length === 0) {
    warnings.push(sourceText.trim()
      ? "No supported labeled values were extracted; no medical facts were created."
      : "The TXT file is empty or contains only whitespace; extraction was unsuccessful and no medical facts were created.");
  }

  return {
    document,
    facts,
    warnings,
    missingFields,
    extractionStatus: document.extractionStatus,
  };
}