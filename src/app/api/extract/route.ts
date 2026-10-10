export async function POST(request: Request) {
  const formData = await request.formData();
  const content = formData.get("content") ?? "";

  return Response.json({
    ok: true,
    extractedText: String(content).trim(),
    wordCount: String(content).trim().length > 0 ? String(content).trim().split(/\s+/).length : 0,
  });
}
