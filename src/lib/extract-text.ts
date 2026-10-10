export async function extractText(source: string | File | Blob): Promise<string> {
  if (typeof source === "string") {
    return source.trim();
  }

  if (source instanceof File || source instanceof Blob) {
    const text = await source.text();
    return text.trim();
  }

  return "";
}
