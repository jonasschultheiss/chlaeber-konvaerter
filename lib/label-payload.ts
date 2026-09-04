import type {
  BarcodeSymbology,
  ConversionNote,
  ExportLabel,
  LabelLayoutPreview,
  LabelObjectKind,
  LayoutPreviewItem,
} from "./types";

function isKind(value: string): value is LabelObjectKind {
  switch (value) {
    case "text":
    case "barcode":
    case "prompt":
      return true;
    default:
      return false;
  }
}

function isSymbology(value: string): value is BarcodeSymbology {
  switch (value) {
    case "code128":
    case "qr":
    case "datamatrix":
    case "code39":
    case "ean13":
      return true;
    default:
      return false;
  }
}

export function isNote(value: unknown): value is ConversionNote {
  return (
    typeof value === "object" &&
    value !== null &&
    "level" in value &&
    "message" in value &&
    (value.level === "info" || value.level === "warn") &&
    typeof value.message === "string"
  );
}

export function isLayoutPreviewItem(value: unknown): value is LayoutPreviewItem {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if (
    !("id" in value) ||
    !("name" in value) ||
    !("kind" in value) ||
    !("value" in value) ||
    !("prompt" in value) ||
    !("symbology" in value) ||
    !("xMm" in value) ||
    !("yMm" in value) ||
    !("widthMm" in value) ||
    !("heightMm" in value) ||
    !("showHri" in value)
  ) {
    return false;
  }
  if (typeof value.kind !== "string" || !isKind(value.kind)) {
    return false;
  }
  if (value.symbology !== null) {
    if (typeof value.symbology !== "string" || !isSymbology(value.symbology)) {
      return false;
    }
  }
  return (
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.name === "string" &&
    typeof value.value === "string" &&
    typeof value.prompt === "string" &&
    typeof value.xMm === "number" &&
    Number.isFinite(value.xMm) &&
    typeof value.yMm === "number" &&
    Number.isFinite(value.yMm) &&
    typeof value.widthMm === "number" &&
    Number.isFinite(value.widthMm) &&
    value.widthMm > 0 &&
    typeof value.heightMm === "number" &&
    Number.isFinite(value.heightMm) &&
    value.heightMm > 0 &&
    typeof value.showHri === "boolean"
  );
}

export function isLayoutPreview(value: unknown): value is LabelLayoutPreview {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if (!("widthMm" in value) || !("heightMm" in value) || !("items" in value)) {
    return false;
  }
  return (
    typeof value.widthMm === "number" &&
    Number.isFinite(value.widthMm) &&
    value.widthMm > 0 &&
    typeof value.heightMm === "number" &&
    Number.isFinite(value.heightMm) &&
    value.heightMm > 0 &&
    Array.isArray(value.items) &&
    value.items.every(isLayoutPreviewItem)
  );
}

export function readExportLabel(value: unknown): ExportLabel | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  if (
    !("fileName" in value) ||
    !("title" in value) ||
    !("widthMm" in value) ||
    !("heightMm" in value) ||
    !("printer" in value) ||
    !("items" in value)
  ) {
    return null;
  }
  if (
    typeof value.fileName !== "string" ||
    typeof value.title !== "string" ||
    typeof value.widthMm !== "number" ||
    !Number.isFinite(value.widthMm) ||
    value.widthMm <= 0 ||
    typeof value.heightMm !== "number" ||
    !Number.isFinite(value.heightMm) ||
    value.heightMm <= 0 ||
    (value.printer !== null && typeof value.printer !== "string") ||
    !Array.isArray(value.items) ||
    value.items.length === 0 ||
    !value.items.every(isLayoutPreviewItem)
  ) {
    return null;
  }

  return {
    fileName: value.fileName,
    title: value.title,
    widthMm: value.widthMm,
    heightMm: value.heightMm,
    printer: value.printer,
    items: value.items,
  };
}
