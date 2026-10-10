import type { HandoffReport as HandoffReportType } from "@/lib/types";

export function HandoffReport({ report }: { report: HandoffReportType }) {
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
    </section>
  );
}
