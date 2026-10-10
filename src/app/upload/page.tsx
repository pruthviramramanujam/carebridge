export default function UploadPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10">
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
          Upload
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-900">Upload patient documents</h1>
        <p className="mt-3 text-slate-600">
          Drag in a discharge summary, clinic note, or medication list to begin reconciliation.
        </p>

        <div className="mt-8 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <p className="text-lg font-medium text-slate-700">No file selected</p>
          <p className="mt-2 text-sm text-slate-500">This upload flow is ready for the intake form.</p>
        </div>
      </div>
    </main>
  );
}
