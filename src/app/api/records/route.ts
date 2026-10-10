import { handoffReport } from "@/lib/demo-data";

export async function GET() {
  return Response.json({
    ok: true,
    patient: handoffReport.patient,
    findings: handoffReport.findings,
  });
}

export async function POST(request: Request) {
  const payload = await request.json();

  return Response.json({
    ok: true,
    record: payload,
  });
}
