'use client';

import { useEffect, useRef, useState } from "react";
import { extractText } from "@/lib/extract-text";
import { DEMO_PATIENT_ID } from "@/lib/demo-data";
import type { DocumentKind, MedicalDocument } from "@/lib/types";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const STORAGE_KEY = "carebridge:demo:intake:v1";

const documentKinds: { value: DocumentKind; label: string }[] = [
  { value: "lab_report", label: "Lab report" },
  { value: "prescription", label: "Prescription" },
  { value: "diagnosis", label: "Diagnosis" },
  { value: "discharge_summary", label: "Discharge summary" },
  { value: "other", label: "Other" },
];

type SupportedFormat = "pdf" | "png" | "jpeg" | "text";

type StoredIntake = {
  document: MedicalDocument;
  sizeBytes: number;
  format: SupportedFormat;
};

function getSupportedFormat(file: File): SupportedFormat | null {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const mediaType = file.type.toLowerCase();
  const matches = (expectedType: string) => mediaType === "" || mediaType === expectedType;

  if (extension === "pdf" && matches("application/pdf")) return "pdf";
  if (extension === "png" && matches("image/png")) return "png";
  if ((extension === "jpg" || extension === "jpeg") && matches("image/jpeg")) return "jpeg";
  if (extension === "txt" && matches("text/plain")) return "text";

  return null;
}

function isStoredIntake(value: unknown): value is StoredIntake {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<StoredIntake>;
  const document = candidate.document;
  return Boolean(
    document &&
      typeof document === "object" &&
      typeof document.id === "string" &&
      typeof document.patientId === "string" &&
      typeof document.title === "string" &&
      documentKinds.some((kind) => kind.value === document.kind) &&
      typeof document.originalFileName === "string" &&
      typeof document.sourceText === "string" &&
      typeof document.uploadedAt === "string" &&
      ["pending", "completed", "failed"].includes(document.extractionStatus) &&
      typeof candidate.sizeBytes === "number" &&
      ["pdf", "png", "jpeg", "text"].includes(candidate.format ?? ""),
  );
}

function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  return `${(sizeBytes / 1024 / 1024).toFixed(2)} MB`;
}

export default function UploadPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [category, setCategory] = useState<DocumentKind | "">("");
  const [validationError, setValidationError] = useState("");
  const [processingMessage, setProcessingMessage] = useState("");
  const [textPreview, setTextPreview] = useState("");
  const [entries, setEntries] = useState<StoredIntake[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    try {
      const savedValue = window.localStorage.getItem(STORAGE_KEY);
      if (savedValue) {
        const parsed: unknown = JSON.parse(savedValue);
        if (!Array.isArray(parsed) || !parsed.every(isStoredIntake)) {
          throw new Error("Saved intake data has an unexpected format.");
        }
        setEntries(parsed);
      }
    } catch {
      setStorageError("Saved demo intake could not be read from this browser. You can still process a file in this session.");
    } finally {
      setStorageReady(true);
    }
  }, []);

  function validateFile(file: File): string {
    if (!getSupportedFormat(file)) {
      return "Choose a PDF, PNG, JPEG, or plain-text (.txt) file.";
    }
    if (file.size > MAX_FILE_SIZE) {
      return "The selected file is larger than the 5 MB limit.";
    }
    return "";
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setValidationError(file ? validateFile(file) : "");
    setProcessingMessage("");
    setTextPreview("");
  }

  function removeSelectedFile() {
    setSelectedFile(null);
    setValidationError("");
    setProcessingMessage("");
    setTextPreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProcessingMessage("");
    setTextPreview("");

    if (!selectedFile) {
      setValidationError("Select a file to continue.");
      return;
    }

    const fileError = validateFile(selectedFile);
    if (fileError) {
      setValidationError(fileError);
      return;
    }

    if (!category) {
      setValidationError("Choose a document category to continue.");
      return;
    }

    setValidationError("");
    setIsProcessing(true);

    try {
      const format = getSupportedFormat(selectedFile);
      if (!format) {
        setValidationError("This file type is not supported.");
        return;
      }

      let sourceText = "";
      let extractionStatus: MedicalDocument["extractionStatus"] = "pending";

      if (format === "text") {
        try {
          sourceText = await extractText(selectedFile);
        } catch {
          setProcessingMessage("The text file could not be read. Try selecting it again.");
          return;
        }

        if (!sourceText) {
          setProcessingMessage("This text file is empty. Add synthetic sample text and select it again.");
          return;
        }

        extractionStatus = "completed";
        setTextPreview(sourceText);
      }

      const document: MedicalDocument = {
        id: `intake-${crypto.randomUUID()}`,
        patientId: DEMO_PATIENT_ID,
        title: selectedFile.name,
        kind: category,
        documentDate: null,
        originalFileName: selectedFile.name,
        sourceText,
        uploadedAt: new Date().toISOString(),
        extractionStatus,
      };
      const entry: StoredIntake = { document, sizeBytes: selectedFile.size, format };
      const updatedEntries = [entry, ...entries];
      setEntries(updatedEntries);

      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedEntries));
        setStorageError("");
        setProcessingMessage(
          format === "text"
            ? "Plain text was read and saved in this browser for inspection. No medical facts were generated."
            : "File metadata was saved in this browser. PDF/image text extraction is not available; status remains pending.",
        );
      } catch {
        setStorageError("Browser storage is unavailable or full. This intake remains visible until you leave or refresh this page.");
        setProcessingMessage(
          format === "text"
            ? "Plain text was read for inspection, but could not be saved in this browser. No medical facts were generated."
            : "File metadata was accepted for this session but could not be saved. PDF/image text extraction is not available.",
        );
      }
    } finally {
      setIsProcessing(false);
    }
  }

  const selectedFormat = selectedFile ? getSupportedFormat(selectedFile) : null;

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">Demo intake</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Add a document</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Use fictional sample files only. Do not upload real patient records or identifying information.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <section className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-950">
            PDF and image files are accepted as metadata only; PDF parsing and image OCR are not implemented.
            Plain-text files are read in this browser. Intake data is stored in this browser&apos;s localStorage,
            which is demo storage, not a secure medical-record database or permanent cloud storage.
          </section>

          <div>
            <label htmlFor="document-file" className="block text-sm font-semibold text-slate-800">
              Document file
            </label>
            <input
              ref={fileInputRef}
              id="document-file"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.txt,application/pdf,image/png,image/jpeg,text/plain"
              onChange={handleFileChange}
              className="mt-2 block w-full cursor-pointer rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-sky-700 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
            />
            <p className="mt-2 text-xs text-slate-500">PDF, PNG, JPEG, or TXT. Maximum size: 5 MB.</p>
          </div>

          {selectedFile ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div className="min-w-0">
                  <p className="break-all font-medium text-slate-900">{selectedFile.name}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {formatFileSize(selectedFile.size)} · {selectedFormat ?? "Unsupported file type"}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Category: {documentKinds.find((kind) => kind.value === category)?.label ?? "Not selected"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={removeSelectedFile}
                  className="shrink-0 self-start rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  Remove file
                </button>
              </div>
            </div>
          ) : null}

          <div>
            <label htmlFor="document-kind" className="block text-sm font-semibold text-slate-800">
              Document category
            </label>
            <select
              id="document-kind"
              value={category}
              onChange={(event) => setCategory(event.target.value as DocumentKind | "")}
              onInvalid={() => setValidationError("Choose a document category to continue.")}
              className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm text-slate-800"
              required
            >
              <option value="">Select a category</option>
              {documentKinds.map((kind) => (
                <option key={kind.value} value={kind.value}>{kind.label}</option>
              ))}
            </select>
          </div>

          {validationError ? (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              {validationError}
            </p>
          ) : null}

          {processingMessage ? (
            <p role="status" className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              {processingMessage}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isProcessing || !storageReady}
            className="w-full rounded-lg bg-sky-700 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {isProcessing ? "Processing…" : storageReady ? "Process demo file" : "Loading saved intake…"}
          </button>
        </form>

        {textPreview ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold text-slate-900">Plain-text preview</h2>
            <p className="mt-1 text-sm text-slate-600">Inspect the captured text. It has not been converted into medical facts.</p>
            <pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-800">{textPreview}</pre>
          </section>
        ) : null}

        <section className="border-t border-slate-300 pt-5">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-baseline">
            <h2 className="text-lg font-semibold text-slate-900">This browser&apos;s demo intake</h2>
            <span className="text-xs text-slate-500">{entries.length} {entries.length === 1 ? "document" : "documents"}</span>
          </div>
          {storageError ? (
            <p role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {storageError}
            </p>
          ) : null}
          {entries.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">No demo documents have been added in this browser.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
              {entries.map(({ document, sizeBytes, format }) => (
                <li key={document.id} className="p-4">
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                    <div className="min-w-0">
                      <p className="break-all font-medium text-slate-900">{document.originalFileName}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {documentKinds.find((kind) => kind.value === document.kind)?.label} · {formatFileSize(sizeBytes)} · {format.toUpperCase()}
                      </p>
                    </div>
                    <span className={`self-start rounded-full px-2.5 py-1 text-xs font-semibold ${document.extractionStatus === "pending" ? "bg-amber-100 text-amber-800" : document.extractionStatus === "completed" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                      {document.extractionStatus === "completed" ? "Text captured" : document.extractionStatus}
                    </span>
                  </div>
                  {document.sourceText ? (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm font-medium text-sky-800">Inspect saved text</summary>
                      <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-800">{document.sourceText}</pre>
                    </details>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
