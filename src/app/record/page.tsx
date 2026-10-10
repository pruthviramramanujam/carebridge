import { HandoffReport } from "@/components/HandoffReport";
import { demoDocuments, demoFacts } from "@/lib/demo-data";
import { reconcileMedicalRecords } from "@/lib/medical-reconciliation";
import { getHandoffReport } from "@/lib/repository";

export default async function RecordPage() {
  const [report, medicalFindings] = await Promise.all([
    getHandoffReport(),
    Promise.resolve(reconcileMedicalRecords(demoDocuments, demoFacts)),
  ]);

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <HandoffReport report={report} medicalFindings={medicalFindings} />
      </div>
    </main>
  );
}
