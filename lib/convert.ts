import { parseBtw } from "@/lib/btw/parse";
import { layoutLabel, placementsFromLayoutItems, toPreviewLayout } from "@/lib/nlbl/layout";
import { clampItemToLabel } from "@/lib/nlbl/nudge";
import { writeNlbl } from "@/lib/nlbl/write";
import type { ConversionResult, ExportLabel } from "@/lib/types";

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
    printer: parsed.printer,
    layout,
  };
}

export async function writeEditedLabel(label: ExportLabel): Promise<Uint8Array> {
  const items = label.items.map((item) => ({
    ...item,
    ...clampItemToLabel(item, label.widthMm, label.heightMm),
    name: item.name.trim() || "Field",
    prompt: item.prompt.trim() || item.name.trim() || "Field",
  }));
  const placements = placementsFromLayoutItems(items);
  return writeNlbl(
    {
      fileName: label.fileName,
      title: label.title,
      widthMm: label.widthMm,
      heightMm: label.heightMm,
      printer: label.printer,
      previewPng: null,
      objects: placements.map((placement) => placement.object),
      notes: [],
    },
    placements,
  );
}
