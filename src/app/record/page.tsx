import { HandoffReport } from "@/components/HandoffReport";
import { getHandoffReport } from "@/lib/repository";

export default async function RecordPage() {
  const report = await getHandoffReport();

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <HandoffReport report={report} />
      </div>
    </main>
  );
}
