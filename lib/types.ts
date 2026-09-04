export type NoteLevel = "info" | "warn";

export type ConversionNote = {
  level: NoteLevel;
  message: string;
};

export type LabelObjectKind = "text" | "barcode" | "prompt";

export type BarcodeSymbology = "code128" | "qr" | "datamatrix" | "code39" | "ean13";

export type LabelObject = {
  id: string;
  kind: LabelObjectKind;
  name: string;
  value: string;
  prompt: string;
  symbology: BarcodeSymbology | null;
};

export type ParsedLabel = {
  fileName: string;
  title: string;
  widthMm: number;
  heightMm: number;
  printer: string | null;
  previewPng: Uint8Array | null;
  objects: LabelObject[];
  notes: ConversionNote[];
};

export type LayoutPreviewItem = {
  name: string;
  kind: LabelObjectKind;
  value: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
};

export type LabelLayoutPreview = {
  widthMm: number;
  heightMm: number;
  items: LayoutPreviewItem[];
};

export type ConversionResult = {
  fileName: string;
  nlbl: Uint8Array;
  previewPng: Uint8Array | null;
  notes: ConversionNote[];
  widthMm: number;
  heightMm: number;
  title: string;
  layout: LabelLayoutPreview;
};
