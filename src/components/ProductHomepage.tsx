import Link from "next/link";
import { demoDocuments, demoFacts } from "@/lib/demo-data";
import { reconcileMedicalRecords } from "@/lib/medical-reconciliation";
import type { ReconciliationFinding } from "@/lib/types";

const capabilities = [
  ["EVIDENCE LINKED", "Trace the source", "Review supporting document references and titles where available."],
  ["R01 · DATES", "Find missing dates", "Surface prescription and lab documents with no recorded date."],
  ["R02 · CONFLICTS", "Compare recorded values", "Bring differing values for the same patient field into review."],
  ["R03 · DUPLICATES", "Notice duplicate files", "Flag matching file hashes associated with the same patient."],
  ["R04–R05 · CONTEXT", "Check medication and sources", "Highlight missing current-status context and source traceability gaps."],
  ["HANDOFF", "Prepare a clearer handoff", "Bring open flags and references together for human review."],
];

const steps = [
  ["01", "Collect records", "Bring the available document and fact references together."],
  ["02", "Identify gaps", "Rule-based checks surface missing context, conflicts, and duplicates."],
  ["03", "Review the handoff", "A person checks each flag and evidence before deciding what to do next."],
];

function FindingCard({ finding }: { finding: ReconciliationFinding }) {
  const facts = finding.factIds
    .map((factId) => demoFacts.find((fact) => fact.id === factId))
    .filter((fact) => fact !== undefined);
  const documents = finding.documentIds.map((documentId) =>
    demoDocuments.find((document) => document.id === documentId),
  );

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-[#e4f3f0] px-2.5 py-1 font-mono text-xs font-bold text-[#176b60]">{finding.ruleId}</span>
          <span className="text-xs font-semibold uppercase text-slate-500">{finding.severity.replaceAll("_", " ")}</span>
        </div>
        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">Human review</span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-700">{finding.message}</p>
      {facts.length > 0 ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {facts.map((fact) => {
            const source = demoDocuments.find((document) => document.id === fact.sourceId);
            return (
              <div key={fact.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] font-semibold uppercase text-slate-500">Recorded value</p>
                <p className="mt-1 font-semibold text-[#102d36]">{fact.value}</p>
                <p className="mt-1 break-words text-xs text-slate-600">{source?.title ?? fact.sourceId ?? "Source not recorded"}</p>
              </div>
            );
          })}
        </div>
      ) : null}
      {documents.length > 0 ? (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Supporting records</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {documents.map((document, index) => (
              <li key={finding.documentIds[index]} className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700">
                {document?.title ?? finding.documentIds[index]}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

export function ProductHomepage() {
  const findings = reconcileMedicalRecords(demoDocuments, demoFacts);
  const openCount = findings.filter((finding) => finding.status === "open").length;
  const previewFindings = ["R02", "R01", "R03"]
    .map((ruleId) => findings.find((finding) => finding.ruleId === ruleId))
    .filter((finding): finding is ReconciliationFinding => finding !== undefined);
  const featuredFinding = previewFindings.find((finding) => finding.ruleId === "R02");
  const supportingFindings = previewFindings.filter((finding) => finding.ruleId !== "R02");

  return (
    <main className="flex-1 bg-[#f5f8f7] font-sans text-[#142f38]">
      <nav aria-label="Main navigation" className="border-b border-white/10 bg-[#0b2932] text-white">
        <div className="mx-auto flex min-h-[72px] max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link href="/" aria-label="TraceMed home" className="inline-flex items-center gap-3 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#9fe3d2]">
            <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#6bd0b5]/40 bg-[#174b50] text-lg font-semibold text-[#a8ead6]">T</span>
            <span className="text-lg font-semibold tracking-wide">TraceMed</span>
          </Link>
          <div className="flex items-center gap-4 sm:gap-7">
            <Link href="/records" className="rounded-sm text-sm text-slate-200 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#9fe3d2]">Records</Link>
            <Link href="/upload" className="rounded-sm text-sm text-slate-200 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#9fe3d2]">Upload</Link>
            <Link href="/records" className="inline-flex rounded-lg bg-[#9fe3d2] px-2.5 py-2 text-xs font-semibold text-[#10343a] hover:bg-[#c0f2e4] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:px-4 sm:py-2.5 sm:text-sm"><span className="sm:hidden">Report</span><span className="hidden sm:inline">Open report</span></Link>
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden bg-[#0b2932] text-white">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:gap-16 lg:py-24">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-[#6bd0b5]/30 bg-[#143d44] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#a9e9d8]">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#7fe0c3]" />Medical history gap detector
            </p>
            <h1 className="mt-7 max-w-[15ch] text-4xl font-semibold leading-[1.08]">Important details shouldn&apos;t get lost between providers.</h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-300">
              TraceMed organizes fragmented medical history and flags missing dates, conflicting values, duplicate documents, and gaps in source context for human review.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/records" className="inline-flex min-h-12 items-center justify-center rounded-lg bg-[#9fe3d2] px-5 py-3 text-sm font-semibold text-[#10343a] transition-colors hover:bg-[#c0f2e4] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">View reconciliation report</Link>
              <Link href="/upload" className="inline-flex min-h-12 items-center justify-center rounded-lg border border-white/25 px-5 py-3 text-sm font-semibold text-white transition-colors hover:border-white/50 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#9fe3d2]">Add a demo document</Link>
            </div>
            <p className="mt-5 text-xs leading-5 text-slate-400">Fictional sample data · Review support, not clinical advice</p>
          </div>

          <aside aria-label="Live reconciliation preview based on fictional demo data" className="rounded-2xl border border-white/15 bg-[#f9fbfa] p-3 text-[#142f38] shadow-[0_24px_70px_rgba(0,0,0,0.22)] sm:p-5">
            <div className="flex flex-col justify-between gap-3 border-b border-slate-200 px-2 pb-4 sm:flex-row sm:items-center sm:px-1">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#39796f]">Product preview</p>
                <h2 className="mt-1 text-lg font-semibold">Reconciliation review</h2>
              </div>
              <span className="self-start rounded-full bg-[#e3f2ed] px-3 py-1.5 text-xs font-semibold text-[#28695d] sm:self-auto">{openCount} open {openCount === 1 ? "flag" : "flags"}</span>
            </div>
            <div className="mt-4 space-y-3">
              {featuredFinding ? <FindingCard finding={featuredFinding} /> : <p className="rounded-xl bg-white p-4 text-sm text-slate-600">No matching R02 example is available in the current demo data.</p>}
              <div className="grid gap-3 sm:grid-cols-2">
                {supportingFindings.map((finding) => (
                  <article key={finding.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-[#176b60]">{finding.ruleId}</span>
                      <span className="text-[10px] font-semibold uppercase text-slate-500">{finding.severity}</span>
                    </div>
                    <p className="mt-2 text-sm leading-5 text-slate-700">{finding.message}</p>
                    {finding.documentIds.length > 0 ? <p className="mt-2 text-xs text-slate-500">{finding.documentIds.map((id) => demoDocuments.find((document) => document.id === id)?.title ?? id).join(" · ")}</p> : null}
                  </article>
                ))}
              </div>
            </div>
            <p className="mt-3 px-1 text-[11px] text-slate-500">Preview calculated from fictional demo records and facts.</p>
          </aside>
        </div>
      </section>

      <section aria-label="Workflow summary" className="border-b border-[#dce7e3] bg-white">
        <div className="mx-auto grid max-w-7xl gap-5 px-5 py-6 sm:grid-cols-3 sm:px-8 sm:py-7">
          {steps.map(([number, title, description]) => (
            <div key={number} className="flex gap-4">
              <span className="font-mono text-sm font-semibold text-[#438b7c]">{number}</span>
              <div><h2 className="text-sm font-semibold text-[#173740]">{title}</h2><p className="mt-1 text-sm leading-6 text-slate-600">{description}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#39796f]">Built for careful review</p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight text-[#12323b]">Make the gaps easier to see.</h2>
          <p className="mt-4 text-base leading-7 text-slate-600">A practical set of checks helps teams focus on what needs context, verification, or a human decision.</p>
        </div>
        <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {capabilities.map(([rule, title, description]) => (
            <article key={rule} className="rounded-xl border border-[#dce7e3] bg-white p-5 shadow-[0_3px_12px_rgba(13,48,55,0.035)] sm:p-6">
              <p className="font-mono text-[11px] font-semibold tracking-wide text-[#398073]">{rule}</p>
              <h3 className="mt-3 text-lg font-semibold text-[#16353d]">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-[#d8e7e1] bg-[#eaf3ef]">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[0.7fr_1.3fr] lg:items-start">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#39796f]">Trust and limitations</p><h2 className="mt-3 text-2xl font-semibold text-[#12323b]">Designed to support review, not replace it.</h2></div>
          <ul className="grid gap-3 sm:grid-cols-2">
            <li className="rounded-lg border border-[#cfdfd8] bg-white/75 p-4 text-sm leading-6 text-slate-700">All included patient and document examples are fictional demo data.</li>
            <li className="rounded-lg border border-[#cfdfd8] bg-white/75 p-4 text-sm leading-6 text-slate-700">Findings require human review. They are not diagnoses or treatment recommendations.</li>
            <li className="rounded-lg border border-[#cfdfd8] bg-white/75 p-4 text-sm leading-6 text-slate-700">PNG and JPEG text recognition runs locally in the browser. PDF parsing is not implemented, and OCR facts require human review.</li>
            <li className="rounded-lg border border-[#cfdfd8] bg-white/75 p-4 text-sm leading-6 text-slate-700">Uploaded entries are compared only within their selected synthetic profile. Browser storage is demo-only.</li>
          </ul>
        </div>
      </section>

      <footer className="bg-[#0b2932] text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-7 px-5 py-12 sm:px-8 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9fe3d2]">TraceMed</p><h2 className="mt-3 max-w-xl text-2xl font-semibold leading-tight">Bring the record together. Make room for a better handoff.</h2><p className="mt-3 text-sm text-slate-300">Fictional demo · Human review required</p></div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/records" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#9fe3d2] px-5 py-3 text-sm font-semibold text-[#10343a] hover:bg-[#c0f2e4] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">Open the report</Link>
            <Link href="/upload" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/30 px-5 py-3 text-sm font-semibold text-white hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#9fe3d2]">Go to document intake</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
