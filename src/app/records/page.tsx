import { HandoffReport } from "@/components/HandoffReport";
import { getHandoffReport, listRecords } from "@/lib/repository";

export default async function RecordsPage() {
  const [report, records] = await Promise.all([getHandoffReport(), listRecords()]);

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-700">
              Patient records
            </p>
            <h1 className="mt-2 text-4xl font-semibold text-slate-900">CareBridge overview</h1>
          </div>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-600">
            {records.length} records linked
          </span>
        </header>

        <HandoffReport report={report} />

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Document timeline</h2>
          <div className="mt-5 space-y-4">
            {records.map((record) => (
              <article key={record.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      {record.type}
                    </p>
                    <h3 className="mt-1 text-lg font-semibold text-slate-900">{record.title}</h3>
                  </div>
                  <span className="text-sm text-slate-500">{record.date}</span>
                </div>
                <p className="mt-3 text-sm text-slate-600">{record.summary}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.15em] text-slate-400">
                  {record.source}
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
