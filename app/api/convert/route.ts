import { convertBtwToNlbl } from "@/lib/convert";
import type { ConversionNote } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 8 * 1024 * 1024;

type ConvertSuccess = {
  fileName: string;
  title: string;
  widthMm: number;
  heightMm: number;
  notes: ConversionNote[];
  nlblBase64: string;
  previewPngBase64: string | null;
};

type ConvertError = {
  error: string;
};

export async function POST(
  request: Request,
): Promise<Response> {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return jsonError("Upload a .btw file.", 400);
  }

  if (!file.name.toLowerCase().endsWith(".btw")) {
    return jsonError("Only BarTender .btw files are accepted.", 400);
  }

  if (file.size > MAX_BYTES) {
    return jsonError("File is larger than 8 MB.", 400);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  try {
    const result = await convertBtwToNlbl(file.name, bytes);
    const body: ConvertSuccess = {
      fileName: result.fileName,
      title: result.title,
      widthMm: result.widthMm,
      heightMm: result.heightMm,
      notes: result.notes,
      nlblBase64: Buffer.from(result.nlbl).toString("base64"),
      previewPngBase64: result.previewPng
        ? Buffer.from(result.previewPng).toString("base64")
        : null,
    };
    return Response.json(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Conversion failed.";
    return jsonError(message, 422);
  }
}

function jsonError(error: string, status: number): Response {
  const body: ConvertError = { error };
  return Response.json(body, { status });
}
