"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { DocumentKind, MedicalDocument } from "@/lib/types";

const STORAGE_KEY = "carebridge:demo:intake:v1";
const formats = ["pdf", "png", "jpeg", "text"] as const;
const categories: Record<DocumentKind, string> = {
  lab_report: "Lab report",
  prescription: "Prescription",
  diagnosis: "Diagnosis",
  discharge_summary: "Discharge summary",
  other: "Other",
};

type StoredIntake = {
  document: MedicalDocument;
  sizeBytes: number;
  format: (typeof formats)[number];
};

function isStoredIntake(value: unknown): value is StoredIntake {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<StoredIntake>;
  const document = candidate.document;
  if (!document || typeof document !== "object") return false;

  return (
    typeof document.id === "string" &&
    typeof document.patientId === "string" &&
    typeof document.title === "string" &&
    Object.hasOwn(categories, document.kind) &&
    (typeof document.documentDate === "string" || document.documentDate === null) &&
    typeof document.originalFileName === "string" &&
    typeof document.sourceText === "string" &&
    typeof document.uploadedAt === "string" &&
    ["pending", "completed", "failed"].includes(document.extractionStatus) &&
    typeof candidate.sizeBytes === "number" &&
    Number.isFinite(candidate.sizeBytes) &&
    candidate.sizeBytes >= 0 &&
    formats.includes(candidate.format as (typeof formats)[number])
  );
}

function formatUploadedAt(value: string): string | null {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatStatus(status: MedicalDocument["extractionStatus"]): string {
  if (status === "pending") return "Pending review";
  if (status === "completed") return "Text captured";
  return "Read failed";
}

export function UploadedIntake() {
  const [entries, setEntries] = useState<StoredIntake[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [storageMessage, setStorageMessage] = useState("");

  useEffect(() => {
    try {
      const savedValue = window.localStorage.getItem(STORAGE_KEY);
      if (savedValue) {
        const parsed: unknown = JSON.parse(savedValue);
        if (!Array.isArray(parsed)) {
          throw new Error("Saved intake data is not a list.");
        }

        const validEntries = parsed.filter(isStoredIntake);
        setEntries(validEntries);
        if (validEntries.length !== parsed.length) {
          setStorageMessage("Some saved intake entries could not be displayed because their data is incomplete.");
        }
      }
    } catch {
      setStorageMessage("Saved intake could not be read from this browser. The reconciled demo report is unaffected.");
    } finally {
      setIsLoaded(true);
    }
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
        These uploads are separate from the fictional reconciled demo records above. Uploaded files are not included in medical reconciliation; captured text has not been converted into facts or reviewed.
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
          {entries.map(({ document, sizeBytes, format }) => {
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
                      {formatStatus(status)}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      Not reconciled
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}