import type { BarcodeSymbology, ConversionNote, LabelObject } from "../types";

const UM_PER_MM = 1000;

export type PlacedObject = {
  object: LabelObject;
  x: number;
  y: number;
  width: number;
  height: number;
  zOrder: number;
  barcodeModuleUm: number | null;
  showHri: boolean;
};

export type LabelLayout = {
  widthMm: number;
  heightMm: number;
  items: Array<{
    name: string;
    kind: LabelObject["kind"];
    value: string;
    xMm: number;
    yMm: number;
    widthMm: number;
    heightMm: number;
  }>;
};

export function refineLabelObjects(
  objects: LabelObject[],
  heightMm: number,
  notes: ConversionNote[],
): LabelObject[] {
  const barcodes = objects.filter((object) => object.kind === "barcode");
  const others = objects.filter((object) => object.kind !== "barcode");
  const barcode = barcodes[0] ?? null;
  const seenValues = new Set<string>();
  const uniqueOthers: LabelObject[] = [];

  if (barcode) {
    seenValues.add(normalizeValue(barcode.value));
  }

  for (const object of others) {
    const key = normalizeValue(object.value);
    if (seenValues.has(key)) {
      continue;
    }
    seenValues.add(key);
    uniqueOthers.push(object);
  }

  const maxTexts = maxTextCount(heightMm, barcode !== null);
  const keptTexts = uniqueOthers.slice(0, maxTexts);
  const dropped = objects.length - keptTexts.length - (barcode ? 1 : 0);

  if (dropped > 0) {
    notes.push({
      level: "info",
      message:
        dropped === 1
          ? "1 duplicate or extra field was omitted so the layout fits the label."
          : `${dropped} duplicate or extra fields were omitted so the layout fits the label.`,
    });
  }

  const result: LabelObject[] = [...keptTexts];
  if (barcode) {
    result.push(barcode);
  }
  return result;
}

export function layoutLabel(
  objects: LabelObject[],
  widthUm: number,
  heightUm: number,
): PlacedObject[] {
  const margin = clamp(
    Math.round(Math.min(widthUm, heightUm) * 0.06),
    800,
    1500,
  );
  const innerWidth = widthUm - margin * 2;
  const innerBottom = heightUm - margin;
  if (innerWidth <= 0 || innerBottom <= margin) {
    return [];
  }

  const texts = objects.filter((object) => object.kind !== "barcode");
  const barcode = objects.find((object) => object.kind === "barcode") ?? null;
  const textLineUm = clamp(Math.round(innerBottom * 0.16), 2200, 3200);
  const gapUm = clamp(Math.round(Math.min(widthUm, heightUm) * 0.03), 400, 800);
  const hriUm = 2400;
  const minBarcodeUm = 5000;
  const showHri = Boolean(
    barcode && !texts.some((text) => normalizeValue(text.value) === normalizeValue(barcode.value)),
  );

  let visibleTexts = [...texts];
  while (
    barcode &&
    visibleTexts.length > 0 &&
    remainingBarcodeHeight({
      textCount: visibleTexts.length,
      margin,
      innerBottom,
      textLineUm,
      gapUm,
      hriUm: showHri ? hriUm : 0,
    }) < minBarcodeUm
  ) {
    visibleTexts = visibleTexts.slice(0, -1);
  }

  const placements: PlacedObject[] = [];
  let y = margin;
  let zOrder = 1;

  for (const object of visibleTexts) {
    placements.push({
      object,
      x: margin,
      y,
      width: innerWidth,
      height: textLineUm,
      zOrder,
      barcodeModuleUm: null,
      showHri: false,
    });
    y += textLineUm + gapUm;
    zOrder += 1;
  }

  if (barcode) {
    const reservedHri = showHri ? hriUm : 0;
    const barcodeHeight = Math.max(0, innerBottom - y - reservedHri);
    if (barcodeHeight > 0) {
      const symbology = barcode.symbology ?? "code128";
      placements.push({
        object: barcode,
        x: margin,
        y,
        width: innerWidth,
        height: barcodeHeight,
        zOrder,
        barcodeModuleUm: barcodeModuleWidth(symbology, barcode.value, innerWidth),
        showHri,
      });
    }
  }

  return placements;
}

export function toPreviewLayout(
  placements: PlacedObject[],
  widthUm: number,
  heightUm: number,
): LabelLayout {
  return {
    widthMm: roundMm(widthUm / UM_PER_MM),
    heightMm: roundMm(heightUm / UM_PER_MM),
    items: placements.map((placement) => ({
      name: placement.object.name,
      kind: placement.object.kind,
      value: placement.object.value,
      xMm: roundMm(placement.x / UM_PER_MM),
      yMm: roundMm(placement.y / UM_PER_MM),
      widthMm: roundMm(placement.width / UM_PER_MM),
      heightMm: roundMm(
        (placement.height + (placement.showHri ? 2400 : 0)) / UM_PER_MM,
      ),
    })),
  };
}

export function estimateCode128Modules(value: string): number {
  const n = Math.max(1, value.length);
  return 11 * (n + 3) + 13 + 20;
}

function remainingBarcodeHeight(input: {
  textCount: number;
  margin: number;
  innerBottom: number;
  textLineUm: number;
  gapUm: number;
  hriUm: number;
}): number {
  const textsHeight =
    input.textCount === 0
      ? 0
      : input.textCount * input.textLineUm + input.textCount * input.gapUm;
  return input.innerBottom - input.margin - textsHeight - input.hriUm;
}

function barcodeModuleWidth(
  symbology: BarcodeSymbology,
  value: string,
  innerWidth: number,
): number {
  const modules = estimateModules(symbology, value);
  const raw = Math.floor(innerWidth / modules);
  return clamp(raw, 125, 200);
}

function estimateModules(symbology: BarcodeSymbology, value: string): number {
  switch (symbology) {
    case "code128":
      return estimateCode128Modules(value);
    case "code39":
      return 16 * (Math.max(1, value.length) + 2) + 20;
    case "ean13":
      return 115;
    case "qr":
    case "datamatrix":
      return 40;
    default: {
      const exhaustive: never = symbology;
      return exhaustive;
    }
  }
}

function maxTextCount(heightMm: number, hasBarcode: boolean): number {
  if (!hasBarcode) {
    return heightMm < 25 ? 3 : 5;
  }
  if (heightMm < 22) {
    return 1;
  }
  if (heightMm < 40) {
    return 2;
  }
  return 3;
}

function normalizeValue(value: string): string {
  return value.trim().toLowerCase();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundMm(value: number): number {
  return Math.round(value * 100) / 100;
}
