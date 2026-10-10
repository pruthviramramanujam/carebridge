import type { HandoffReport as HandoffReportType, ReconciliationFinding } from "@/lib/types";
import { demoDocuments } from "@/lib/demo-data";

export function HandoffReport({
  report,
  medicalFindings = [],
}: {
  report: HandoffReportType;
  medicalFindings?: ReconciliationFinding[];
}) {
  const documentTitleMap = new Map(demoDocuments.map((document) => [document.id, document.title]));

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
            Handoff report
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">
            {report.patient.name}
          </h2>
        </div>
        <div className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
          {report.completeness.score}% complete
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
            MRN
          </p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{report.patient.mrn}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
            Diagnosis
          </p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {report.patient.primaryDiagnosis}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
            Unit
          </p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{report.patient.location}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Key findings</h3>
          <ul className="mt-3 space-y-3">
            {report.findings.map((finding) => (
              <li key={finding.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">{finding.title}</p>
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
                    {finding.severity}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600">{finding.statement}</p>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-slate-900">Recommendations</h3>
          <ul className="mt-3 space-y-3">
            {report.recommendations.map((recommendation, index) => (
              <li key={`${recommendation}-${index}`} className="flex gap-3 rounded-xl bg-sky-50 p-4">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-600 text-xs font-semibold text-white">
                  {index + 1}
                </span>
                <span className="text-sm text-slate-700">{recommendation}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {medicalFindings.length > 0 ? (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-800">
                Medical reconciliation flags
              </p>
              <h3 className="mt-1 text-xl font-semibold text-slate-900">Human review required</h3>
            </div>
            <span className="rounded-full border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-amber-800">
              {medicalFindings.filter((finding) => finding.status === "open").length} open
            </span>
          </div>

          <p className="mt-3 text-sm text-slate-700">
            FICTIONAL DEMO DATA ONLY. These reconciliation findings are review flags for a human
            clinician or workflow owner; they are not diagnoses and do not constitute treatment or
            medication recommendations.
          </p>

          <ul className="mt-4 space-y-3">
            {medicalFindings.map((finding) => {
              const isOpen = finding.status === "open";

              return (
                <li key={finding.id} className="rounded-xl border border-amber-200 bg-white p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-700">
                        {finding.ruleId}
                      </span>
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${
                          finding.severity === "warning"
                            ? "bg-amber-100 text-amber-800"
                            : finding.severity === "review_required"
                              ? "bg-orange-100 text-orange-800"
                              : "bg-sky-100 text-sky-800"
                        }`}
                      >
                        {finding.severity}
                      </span>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${
                        isOpen
                          ? "bg-rose-100 text-rose-700"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {isOpen ? "Unresolved" : finding.status}
                    </span>
                  </div>

                  <p className="mt-3 text-sm text-slate-700">{finding.message}</p>

                  {finding.documentIds.length > 0 ? (
                    <div className="mt-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                        Supporting documents
                      </p>
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {finding.documentIds.map((documentId) => (
                          <li
                            key={`${finding.id}-${documentId}`}
                            className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700"
                          >
                            {documentTitleMap.get(documentId) ? `${documentId} • ${documentTitleMap.get(documentId)}` : documentId}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
