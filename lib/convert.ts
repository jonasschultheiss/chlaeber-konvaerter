import { parseBtw } from "@/lib/btw/parse";
import { layoutLabel, toPreviewLayout } from "@/lib/nlbl/layout";
import { writeNlbl } from "@/lib/nlbl/write";
import type { ConversionResult } from "@/lib/types";

export async function convertBtwToNlbl(
  fileName: string,
  bytes: Uint8Array,
): Promise<ConversionResult> {
  const parsed = parseBtw(fileName, bytes);
  const widthUm = Math.round(parsed.widthMm * 1000);
  const heightUm = Math.round(parsed.heightMm * 1000);
  const layout = toPreviewLayout(
    layoutLabel(parsed.objects, widthUm, heightUm),
    widthUm,
    heightUm,
  );
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
    layout,
  };
}
