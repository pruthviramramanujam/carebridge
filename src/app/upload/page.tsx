'use client';

import { useEffect, useRef, useState } from "react";
import { extractMedicalFacts } from "@/lib/extract-medical-facts";
import {
  createUploadPatientId,
  INTAKE_STORAGE_KEY,
  parseStoredIntake,
  reconcileIntakeEntries,
  type IntakeFormat,
  type StoredIntake,
} from "@/lib/intake-storage";
import type { DocumentKind, MedicalDocument } from "@/lib/types";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const documentKinds: { value: DocumentKind; label: string }[] = [
  { value: "lab_report", label: "Lab report" },
  { value: "prescription", label: "Prescription" },
  { value: "diagnosis", label: "Diagnosis" },
  { value: "discharge_summary", label: "Discharge summary" },
  { value: "other", label: "Other" },
];

function getSupportedFormat(file: File): IntakeFormat | null {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const mediaType = file.type.toLowerCase();
  const matches = (expectedType: string) => mediaType === "" || mediaType === expectedType;

  if (extension === "pdf" && matches("application/pdf")) return "pdf";
  if (extension === "png" && matches("image/png")) return "png";
  if ((extension === "jpg" || extension === "jpeg") && matches("image/jpeg")) return "jpeg";
  if (extension === "txt" && matches("text/plain")) return "text";

  return null;
}

function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  return `${(sizeBytes / 1024 / 1024).toFixed(2)} MB`;
}

export default function UploadPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [category, setCategory] = useState<DocumentKind | "">("");
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [validationError, setValidationError] = useState("");
  const [processingMessage, setProcessingMessage] = useState("");
  const [textPreview, setTextPreview] = useState("");
  const [entries, setEntries] = useState<StoredIntake[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [storageWritable, setStorageWritable] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadStoredIntake() {
      await Promise.resolve();
      try {
        const stored = parseStoredIntake(window.localStorage.getItem(INTAKE_STORAGE_KEY));
        if (cancelled) return;
        setEntries(stored.entries);
        if (stored.malformed) {
          setStorageWritable(false);
          setStorageError("Some saved intake could not be validated. It will not be overwritten; new entries remain visible for this session only.");
        } else if (stored.migrated) {
          window.localStorage.setItem(INTAKE_STORAGE_KEY, JSON.stringify(stored.entries));
        }
      } catch {
        if (!cancelled) {
          setStorageWritable(false);
          setStorageError("Saved demo intake could not be read or migrated in this browser. New entries remain visible for this session only.");
        }
      } finally {
        if (!cancelled) setStorageReady(true);
      }
    }

    void loadStoredIntake();
    return () => {
      cancelled = true;
    };
  }, []);

  async function hashFile(file: File): Promise<string | null> {
    try {
      const digest = await window.crypto.subtle.digest("SHA-256", await file.arrayBuffer());
      const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
      return `sha256:${hash}`;
    } catch {
      return null;
    }
  }

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

      const patientId = selectedPatientId || createUploadPatientId();
      const fileHash = await hashFile(selectedFile);
      const metadata = {
        id: `intake-${crypto.randomUUID()}`,
        title: selectedFile.name,
        kind: category,
        documentDate: null,
        originalFileName: selectedFile.name,
        uploadedAt: new Date().toISOString(),
        ...(fileHash ? { fileHash } : {}),
      };
      let document: MedicalDocument;
      let facts: StoredIntake["facts"] = [];
      let warnings: string[] = [];
      let missingFields: string[] = [];
      const findings: StoredIntake["findings"] = [];
      let reconciliationStatus: StoredIntake["reconciliationStatus"] = "pending";

      if (format === "text") {
        let sourceText: string;
        try {
          sourceText = await selectedFile.text();
        } catch {
          document = {
            ...metadata,
            patientId,
            sourceText: "",
            extractionStatus: "failed",
          };
          const failedEntry: StoredIntake = {
            document,
            sizeBytes: selectedFile.size,
            format,
            facts: [],
            warnings: ["The browser could not read this text file. No medical facts were extracted or reconciled."],
            missingFields: [],
            findings: [],
            reconciliationStatus: "failed",
          };
          const updatedEntries = [failedEntry, ...entries];
          setEntries(updatedEntries);
          try {
            if (!storageWritable) throw new Error("Storage is unavailable.");
            window.localStorage.setItem(INTAKE_STORAGE_KEY, JSON.stringify(updatedEntries));
          } catch {
            setStorageWritable(false);
            setStorageError("The read failure is visible for this session but could not be saved in browser storage.");
          }
          setProcessingMessage("The text file could not be read. Its failed status is shown below; try selecting a synthetic TXT file again.");
          return;
        }

        const extraction = extractMedicalFacts(sourceText, metadata, patientId);
        document = extraction.document;
        facts = extraction.facts;
        warnings = extraction.warnings;
        missingFields = extraction.missingFields;
        reconciliationStatus = extraction.extractionStatus === "completed" ? "completed" : "failed";
        setTextPreview(sourceText);
        if (!fileHash) warnings.push("A reliable file hash could not be calculated; duplicate-file checking was unavailable.");
      } else {
        document = {
          ...metadata,
          patientId,
          sourceText: "",
          extractionStatus: "pending",
        };
        warnings = ["PDF parsing and image OCR are not implemented. File contents remain unparsed and are excluded from reconciliation."];
        if (!fileHash) warnings.push("A reliable file hash could not be calculated; duplicate-file checking is unavailable.");
      }

      const entry: StoredIntake = {
        document,
        sizeBytes: selectedFile.size,
        format,
        facts,
        warnings,
        missingFields,
        findings,
        reconciliationStatus,
      };
      const updatedEntries = reconcileIntakeEntries([entry, ...entries]);
      const savedEntry = updatedEntries.find((item) => item.document.id === document.id) ?? entry;
      setEntries(updatedEntries);
      setSelectedPatientId("");

      try {
        if (!storageWritable) {
          throw new Error("Storage is read-only after an earlier validation error.");
        }
        window.localStorage.setItem(INTAKE_STORAGE_KEY, JSON.stringify(updatedEntries));
        setProcessingMessage(format === "text"
          ? document.extractionStatus === "failed"
            ? "TXT extraction was unsuccessful because the file is empty or whitespace-only. No facts were extracted or reconciled."
            : `TXT extraction completed: ${facts.length} fact${facts.length === 1 ? "" : "s"} extracted. Reconciliation found ${savedEntry.findings.length} flag${savedEntry.findings.length === 1 ? "" : "s"} for this fictional profile. All extracted facts need human review.`
          : "File metadata was saved in this browser. PDF/image extraction and reconciliation remain pending.");
      } catch {
        setStorageWritable(false);
        setStorageError("Browser storage is unavailable or full. This intake remains visible until you leave or refresh this page.");
        setProcessingMessage(format === "text"
          ? `TXT extraction completed: ${facts.length} fact${facts.length === 1 ? "" : "s"} extracted. Reconciliation ran, but browser storage failed; this session still needs human review.`
          : "File metadata was accepted for this session but could not be saved. PDF/image extraction and reconciliation remain pending.");
      }
    } finally {
      setIsProcessing(false);
    }
  }

  const selectedFormat = selectedFile ? getSupportedFormat(selectedFile) : null;
  const patientProfiles = [...new Set(entries.map((entry) => entry.document.patientId))];

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
            <label htmlFor="patient-profile" className="block text-sm font-semibold text-slate-800">
              Synthetic intake profile
            </label>
            <select
              id="patient-profile"
              value={selectedPatientId}
              onChange={(event) => setSelectedPatientId(event.target.value)}
              className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm text-slate-800"
            >
              <option value="">Create a separate fictional profile</option>
              {patientProfiles.map((patientId, index) => (
                <option key={patientId} value={patientId}>Continue fictional profile {index + 1}</option>
              ))}
            </select>
            <p className="mt-2 text-xs text-slate-500">
              Records are compared only within a profile you explicitly choose. Profiles are separate from the fictional handoff demo.
            </p>
          </div>

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
            <p className="mt-1 text-sm text-slate-600">Inspect captured text and the explicitly labeled fields below. Every extracted fact still needs human review.</p>
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
              {entries.map(({ document, sizeBytes, format, facts, warnings, missingFields, findings, reconciliationStatus }) => (
                <li key={document.id} className="p-4">
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                    <div className="min-w-0">
                      <p className="break-all font-medium text-slate-900">{document.originalFileName}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {documentKinds.find((kind) => kind.value === document.kind)?.label} · {formatFileSize(sizeBytes)} · {format.toUpperCase()}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {new Date(document.uploadedAt).toLocaleString()} · Separate synthetic profile
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 self-start">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${document.extractionStatus === "pending" ? "bg-amber-100 text-amber-800" : document.extractionStatus === "completed" ? "bg-sky-100 text-sky-800" : "bg-rose-100 text-rose-800"}`}>
                        {document.extractionStatus === "completed" ? `TXT extracted · ${facts.length} facts` : document.extractionStatus === "pending" ? "Extraction pending" : "Extraction failed"}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${reconciliationStatus === "completed" ? "bg-emerald-100 text-emerald-800" : reconciliationStatus === "failed" ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-700"}`}>
                        {reconciliationStatus === "completed" ? `Reconciled · ${findings.length} flags` : reconciliationStatus === "failed" ? "Reconciliation failed" : "Not reconciled · pending extraction"}
                      </span>
                    </div>
                  </div>
                  {facts.length > 0 ? (
                    <div className="mt-4">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Extracted fields · needs review</h3>
                      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                        {facts.map((fact) => (
                          <li key={fact.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <p className="break-words text-xs text-slate-500">{fact.field}</p>
                            <p className="mt-1 break-words text-sm font-medium text-slate-800">{fact.value}</p>
                            <p className="mt-1 text-[11px] font-semibold text-amber-800">{fact.verificationStatus.replaceAll("_", " ")}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {missingFields.length > 0 ? (
                    <div className="mt-4">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fields not found in labeled text</h3>
                      <p className="mt-1 text-sm text-slate-600">{missingFields.join(" · ")}</p>
                    </div>
                  ) : null}
                  {warnings.length > 0 ? (
                    <ul className="mt-3 space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                      {warnings.map((warning, index) => <li key={`${document.id}-warning-${index}`}>{warning}</li>)}
                    </ul>
                  ) : null}
                  {document.sourceText ? (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm font-medium text-sky-800">Inspect saved text</summary>
                      <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-800">{document.sourceText}</pre>
                    </details>
                  ) : null}
                  {reconciliationStatus === "completed" ? (
                    <div className="mt-4 border-t border-slate-200 pt-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reconciliation · human review required</h3>
                      {findings.length > 0 ? (
                        <ul className="mt-2 space-y-2">
                          {findings.map((finding) => (
                            <li key={finding.id} className="rounded-lg border border-amber-200 bg-white p-3">
                              <p className="text-xs font-semibold text-amber-900">{finding.ruleId} · {finding.severity.replaceAll("_", " ")} · {finding.status.replaceAll("_", " ")}</p>
                              <p className="mt-1 text-sm text-slate-700">{finding.message}</p>
                              <p className="mt-1 break-words text-xs text-slate-500">Supporting files: {finding.documentIds.map((documentId) => entries.find((item) => item.document.id === documentId && item.document.patientId === finding.patientId)?.document.originalFileName ?? `Unknown source (${documentId})`).join(" · ") || "No source files identified."}</p>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 text-sm text-slate-600">No reconciliation flags were produced for this document and the selected profile.</p>
                      )}
                    </div>
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
