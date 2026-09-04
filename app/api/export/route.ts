import { writeEditedLabel } from "@/lib/convert";
import { readExportLabel } from "@/lib/label-payload";

export const runtime = "nodejs";
export const maxDuration = 30;

type ExportSuccess = {
  fileName: string;
  nlblBase64: string;
};

type ExportError = {
  error: string;
};

export async function POST(request: Request): Promise<Response> {
  const payload: unknown = await request.json();
  const label = readExportLabel(payload);
  if (!label) {
    return jsonError("Provide a title, label size, and at least one field.", 400);
  }

  if (!label.fileName.toLowerCase().endsWith(".nlbl")) {
    return jsonError("The download name must end with .nlbl.", 400);
  }

  try {
    const nlbl = await writeEditedLabel(label);
    const body: ExportSuccess = {
      fileName: label.fileName,
      nlblBase64: Buffer.from(nlbl).toString("base64"),
    };
    return Response.json(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Export failed.";
    return jsonError(message, 422);
  }
}

function jsonError(error: string, status: number): Response {
  const body: ExportError = { error };
  return Response.json(body, { status });
}
