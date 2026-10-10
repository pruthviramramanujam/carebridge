import { extractMedicalFacts, type MedicalDocumentMetadata } from "./extract-medical-facts.ts";
import type { ExtractionResult } from "./types.ts";

export type ImageOCRResult = {
  text: string;
  confidence: number;
};

export type ImageProcessingStage =
  | "reading-image"
  | "extracting-text"
  | "extracting-facts";

export type ImageOCRProgress = {
  stage: ImageProcessingStage;
  progress?: number;
};

export type ImageRecognizer = (
  file: File,
  onProgress?: (progress: ImageOCRProgress) => void,
  signal?: AbortSignal,
) => Promise<ImageOCRResult>;

export type ImageExtractionResult = ExtractionResult & {
  confidence: number | null;
};

function failedExtraction(
  sourceText: string,
  metadata: MedicalDocumentMetadata,
  patientId: string,
  warning: string,
  confidence: number | null,
): ImageExtractionResult {
  return {
    document: {
      ...metadata,
      patientId,
      sourceText,
      extractionStatus: "failed",
    },
    facts: [],
    warnings: [warning],
    missingFields: [],
    extractionStatus: "failed",
    confidence,
  };
}

export async function extractImageMedicalFacts(
  file: File,
  metadata: MedicalDocumentMetadata,
  patientId: string,
  recognize: ImageRecognizer,
  onProgress?: (progress: ImageOCRProgress) => void,
  signal?: AbortSignal,
): Promise<ImageExtractionResult> {
  if (signal?.aborted) throw new DOMException("Image processing was cancelled.", "AbortError");
  onProgress?.({ stage: "reading-image" });

  let recognized: ImageOCRResult;
  try {
    recognized = await recognize(file, onProgress, signal);
  } catch (error) {
    if (signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) throw error;
    return failedExtraction(
      "",
      metadata,
      patientId,
      "Image text recognition failed. No medical facts were extracted or reconciled; try a clearer PNG or JPEG.",
      null,
    );
  }

  const sourceText = typeof recognized.text === "string" ? recognized.text : "";
  const confidence = Number.isFinite(recognized.confidence)
    ? Math.max(0, Math.min(100, recognized.confidence))
    : 0;
  if (!sourceText.trim()) {
    return failedExtraction(
      sourceText,
      metadata,
      patientId,
      "No readable text was recognized in this image. No medical facts were extracted or reconciled.",
      confidence,
    );
  }
  if (confidence < 35) {
    return failedExtraction(
      sourceText,
      metadata,
      patientId,
      `OCR confidence was very low (${Math.round(confidence)}%). Text is shown for review, but no medical facts were extracted or reconciled.`,
      confidence,
    );
  }

  onProgress?.({ stage: "extracting-facts" });
  const extraction = extractMedicalFacts(sourceText, metadata, patientId);
  const warnings = confidence < 65
    ? [...extraction.warnings, `OCR confidence is low (${Math.round(confidence)}%). Verify the recognized text carefully before relying on any extracted field.`]
    : extraction.warnings;

  return {
    ...extraction,
    warnings,
    confidence,
  };
}
