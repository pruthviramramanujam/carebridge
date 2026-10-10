"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  INTAKE_STORAGE_KEY,
  parseStoredIntake,
  type StoredIntake,
} from "@/lib/intake-storage";
import type { DocumentKind, MedicalDocument } from "@/lib/types";

const categories: Record<DocumentKind, string> = {
  lab_report: "Lab report",
  prescription: "Prescription",
  diagnosis: "Diagnosis",
  discharge_summary: "Discharge summary",
  other: "Other",
};

function formatUploadedAt(value: string): string | null {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatStatus(status: MedicalDocument["extractionStatus"], format: StoredIntake["format"], factCount: number): string {
  if (status === "pending") return "Pending review";
  if (status === "completed") return `${format === "text" ? "Text" : "OCR text"} captured · ${factCount} facts`;
  return "Extraction failed";
}

export function UploadedIntake() {
  const [entries, setEntries] = useState<StoredIntake[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [storageMessage, setStorageMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadStoredIntake() {
      await Promise.resolve();
      try {
        const result = parseStoredIntake(window.localStorage.getItem(INTAKE_STORAGE_KEY));
        if (cancelled) return;
        setEntries(result.entries);
        if (result.migrated && !result.malformed) {
          window.localStorage.setItem(INTAKE_STORAGE_KEY, JSON.stringify(result.entries));
        }
        if (result.malformed) {
          setStorageMessage("Some saved intake entries could not be validated and were omitted. The reconciled demo report is unaffected.");
        }
      } catch {
        if (!cancelled) {
          setStorageMessage("Saved intake could not be read or migrated in this browser. The reconciled demo report is unaffected.");
        }
      } finally {
        if (!cancelled) setIsLoaded(true);
      }
    }

    void loadStoredIntake();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="border-t border-slate-300 pt-6" aria-labelledby="uploaded-intake-heading">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Browser-only uploads</p>
          <h2 id="uploaded-intake-heading" className="mt-1 text-xl font-semibold text-slate-900">
            Uploaded intake
          </h2>
        </div>
        <Link
          href="/upload"
          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-sky-700 bg-white px-4 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-50"
        >
          Add another file
        </Link>
      </header>

      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
        These uploads are separate from the fictional reconciled demo records above. Labeled TXT and OCR-recognized image text are reconciled only within the explicitly selected synthetic profile; all extracted facts still need human review. PDF uploads remain pending.
      </p>

      {storageMessage ? (
        <p role="status" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {storageMessage}
        </p>
      ) : null}

      {!isLoaded ? (
        <p className="mt-4 text-sm text-slate-600" role="status">Loading this browser&apos;s intake…</p>
      ) : entries.length === 0 ? (
        <p className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          No uploaded intake entries are saved in this browser.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {entries.map(({ document, sizeBytes, format, facts, warnings, missingFields, findings, reconciliationStatus }) => {
            const uploadedAt = formatUploadedAt(document.uploadedAt);
            const status = document.extractionStatus;

            return (
              <li key={document.id} className="p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="break-all font-semibold text-slate-900">{document.originalFileName}</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {categories[document.kind]} · {format.toUpperCase()} · {(sizeBytes / 1024 / 1024).toFixed(2)} MB
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {uploadedAt ? (
                        <time dateTime={document.uploadedAt}>{uploadedAt}</time>
                      ) : (
                        "Upload time unavailable"
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status === "pending" ? "bg-amber-100 text-amber-800" : status === "completed" ? "bg-sky-100 text-sky-800" : "bg-rose-100 text-rose-800"}`}>
                      {formatStatus(status, format, facts.length)}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${reconciliationStatus === "completed" ? "bg-emerald-100 text-emerald-800" : reconciliationStatus === "failed" ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-700"}`}>
                      {reconciliationStatus === "completed" ? `Reconciled · ${findings.length} flags` : reconciliationStatus === "failed" ? "Reconciliation failed" : "Not reconciled · pending extraction"}
                    </span>
                  </div>
                </div>
                {facts.length > 0 ? (
                  <div className="mt-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Extracted fields · needs review</p>
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
                  <p className="mt-3 text-sm text-slate-600"><span className="font-medium">Fields not found:</span> {missingFields.join(" · ")}</p>
                ) : null}
                {warnings.length > 0 ? (
                  <ul className="mt-3 space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    {warnings.map((warning, index) => <li key={`${document.id}-warning-${index}`}>{warning}</li>)}
                  </ul>
                ) : null}
                {document.sourceText ? (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-medium text-sky-800">
                      Inspect {format === "text" ? "saved text" : "OCR-recognized text"}
                    </summary>
                    <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-800">{document.sourceText}</pre>
                  </details>
                ) : null}
                {reconciliationStatus === "completed" ? (
                  <div className="mt-4 border-t border-slate-200 pt-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Reconciliation · human review required</p>
                    {findings.length > 0 ? (
                      <ul className="mt-2 space-y-2">
                        {findings.map((finding) => (
                          <li key={finding.id} className="rounded-lg border border-amber-200 bg-white p-3">
                            <p className="text-xs font-semibold text-amber-900">{finding.ruleId} · {finding.severity.replaceAll("_", " ")} · {finding.status.replaceAll("_", " ")}</p>
                            <p className="mt-1 text-sm text-slate-700">{finding.message}</p>
                            <p className="mt-1 text-xs text-slate-500">Supporting files: {finding.documentIds.map((documentId) => entries.find((entry) => entry.document.id === documentId && entry.document.patientId === finding.patientId)?.document.originalFileName ?? `Unknown source (${documentId})`).join(" · ") || "No source files identified."}</p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-sm text-slate-600">Extraction completed, but no reconciliation flags were produced for this document and its selected synthetic profile.</p>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}