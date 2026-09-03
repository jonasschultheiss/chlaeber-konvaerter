import { parseBtw } from "@/lib/btw/parse";
import { writeNlbl } from "@/lib/nlbl/write";
import type { ConversionResult } from "@/lib/types";

export async function convertBtwToNlbl(
  fileName: string,
  bytes: Uint8Array,
): Promise<ConversionResult> {
  const parsed = parseBtw(fileName, bytes);
  const nlbl = await writeNlbl(parsed);
  const outputName = fileName.replace(/\.btw$/i, "") + ".nlbl";

  return {
    fileName: outputName,
    nlbl,
    previewPng: parsed.previewPng,
    notes: parsed.notes,
    widthMm: parsed.widthMm,
    heightMm: parsed.heightMm,
    title: parsed.title,
  };
}
