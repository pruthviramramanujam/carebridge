import { createWorker } from "tesseract.js";
import type { ImageOCRResult, ImageRecognizer } from "./image-ocr.ts";

function isAbortError(signal?: AbortSignal): boolean {
  return signal?.aborted === true;
}

function abortError(): DOMException {
  return new DOMException("Image processing was cancelled.", "AbortError");
}

function recognizeWithAbort(
  task: Promise<ImageOCRResult>,
  signal?: AbortSignal,
): Promise<ImageOCRResult> {
  if (!signal) return task;
  if (signal.aborted) return Promise.reject(abortError());

  return new Promise((resolve, reject) => {
    const cleanup = () => signal.removeEventListener("abort", onAbort);
    const onAbort = () => {
      cleanup();
      reject(abortError());
    };
    signal.addEventListener("abort", onAbort, { once: true });
    task.then(
      (result) => {
        cleanup();
        resolve(result);
      },
      (error: unknown) => {
        cleanup();
        reject(error);
      },
    );
  });
}

export const recognizeImageInBrowser: ImageRecognizer = async (
  file,
  onProgress,
  signal,
) => {
  if (typeof createImageBitmap !== "function") {
    throw new Error("This browser cannot validate image files for OCR.");
  }
  const bitmap = await createImageBitmap(file);
  bitmap.close();
  if (isAbortError(signal)) throw abortError();

  let worker: Awaited<ReturnType<typeof createWorker>> | null = null;
  let abortListener: (() => void) | null = null;
  try {
    worker = await createWorker("eng", 1, {
      workerPath: "/api/ocr-assets/worker.min.js",
      corePath: "/api/ocr-assets/core/",
      langPath: "/api/ocr-assets/lang/",
      gzip: true,
      workerBlobURL: false,
      cacheMethod: "write",
      logger: ({ progress }) => {
        onProgress?.({
          stage: "extracting-text",
          progress: Number.isFinite(progress) ? progress : undefined,
        });
      },
    });
    if (isAbortError(signal)) throw abortError();

    abortListener = () => {
      if (worker) void worker.terminate();
    };
    signal?.addEventListener("abort", abortListener, { once: true });
    const recognition = worker.recognize(file).then(({ data }) => ({
      text: data.text,
      confidence: data.confidence,
    }));
    return await recognizeWithAbort(recognition, signal);
  } catch (error) {
    if (isAbortError(signal)) throw abortError();
    throw error;
  } finally {
    if (abortListener) signal?.removeEventListener("abort", abortListener);
    if (worker) await worker.terminate();
  }
};
