import { readFile } from "node:fs/promises";
import path from "node:path";

const nodeModulesRoot = path.join(process.cwd(), "node_modules");
const tesseractRoot = path.join(nodeModulesRoot, "tesseract.js");
const coreRoot = path.join(nodeModulesRoot, "tesseract.js-core");
const languageRoot = path.join(nodeModulesRoot, "@tesseract.js-data", "eng");

const assets: Record<string, { file: string; contentType: string }> = {
  "worker.min.js": {
    file: path.join(tesseractRoot, "dist", "worker.min.js"),
    contentType: "text/javascript; charset=utf-8",
  },
  "core/tesseract-core-relaxedsimd-lstm.wasm.js": {
    file: path.join(coreRoot, "tesseract-core-relaxedsimd-lstm.wasm.js"),
    contentType: "text/javascript; charset=utf-8",
  },
  "core/tesseract-core-relaxedsimd-lstm.wasm": {
    file: path.join(coreRoot, "tesseract-core-relaxedsimd-lstm.wasm"),
    contentType: "application/wasm",
  },
  "core/tesseract-core-simd-lstm.wasm.js": {
    file: path.join(coreRoot, "tesseract-core-simd-lstm.wasm.js"),
    contentType: "text/javascript; charset=utf-8",
  },
  "core/tesseract-core-simd-lstm.wasm": {
    file: path.join(coreRoot, "tesseract-core-simd-lstm.wasm"),
    contentType: "application/wasm",
  },
  "core/tesseract-core-lstm.wasm.js": {
    file: path.join(coreRoot, "tesseract-core-lstm.wasm.js"),
    contentType: "text/javascript; charset=utf-8",
  },
  "core/tesseract-core-lstm.wasm": {
    file: path.join(coreRoot, "tesseract-core-lstm.wasm"),
    contentType: "application/wasm",
  },
  "tesseract-core-relaxedsimd-lstm.wasm.js": {
    file: path.join(coreRoot, "tesseract-core-relaxedsimd-lstm.wasm.js"),
    contentType: "text/javascript; charset=utf-8",
  },
  "tesseract-core-relaxedsimd-lstm.wasm": {
    file: path.join(coreRoot, "tesseract-core-relaxedsimd-lstm.wasm"),
    contentType: "application/wasm",
  },
  "tesseract-core-simd-lstm.wasm.js": {
    file: path.join(coreRoot, "tesseract-core-simd-lstm.wasm.js"),
    contentType: "text/javascript; charset=utf-8",
  },
  "tesseract-core-simd-lstm.wasm": {
    file: path.join(coreRoot, "tesseract-core-simd-lstm.wasm"),
    contentType: "application/wasm",
  },
  "tesseract-core-lstm.wasm.js": {
    file: path.join(coreRoot, "tesseract-core-lstm.wasm.js"),
    contentType: "text/javascript; charset=utf-8",
  },
  "tesseract-core-lstm.wasm": {
    file: path.join(coreRoot, "tesseract-core-lstm.wasm"),
    contentType: "application/wasm",
  },
  "lang/eng.traineddata.gz": {
    file: path.join(languageRoot, "4.0.0_best_int", "eng.traineddata.gz"),
    contentType: "application/gzip",
  },
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ asset: string[] }> },
): Promise<Response> {
  const { asset: pathParts } = await context.params;
  const asset = pathParts.join("/");
  const selectedAsset = assets[asset];
  if (!selectedAsset) return new Response("Not found", { status: 404 });

  try {
    const contents = await readFile(selectedAsset.file);
    return new Response(new Uint8Array(contents), {
      headers: {
        "Content-Type": selectedAsset.contentType,
        "Cache-Control": "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("OCR runtime asset is unavailable.", { status: 503 });
  }
}
