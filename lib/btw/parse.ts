import { randomUUID } from "node:crypto";
import { inflateSync } from "node:zlib";
import type {
  BarcodeSymbology,
  ConversionNote,
  LabelObject,
  LabelObjectKind,
  ParsedLabel,
} from "@/lib/types";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_IEND = Buffer.from([0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
const STRING_PREFIX = Buffer.from([0xff, 0xfe, 0xff]);

const SKIP_STRINGS = new Set([
  "bartender",
  "idbtlf",
  "picture.bmp",
  "picture",
  "bmp",
  "tif",
  "jpg",
  "png",
  "box options",
  "backgroundpicturepage",
  "predefinedstockspage",
  "promptoptionspage",
  "functions and subs",
  "procedures for all events",
  "onprocessdata",
  "onpostserialize",
  "onprintjobstart",
  "onopen",
  "onprintjobcancel",
  "onserialize",
  "onprintjobend",
  "onclose",
  "onsave",
  "onnewrecord",
  "onidenticalcopies",
  "call onprintjobend",
  "data source",
  "datasource",
  "minimumpage",
  "image processing",
  "dialog control",
  "print quantity",
  "1...",
  "sample prompt",
]);

export function parseBtw(fileName: string, bytes: Uint8Array): ParsedLabel {
  const buffer = Buffer.from(bytes);
  const headerText = buffer.subarray(0, 4096).toString("latin1");

  if (!headerText.includes("Bar Tender Format File")) {
    throw new Error("This is not a BarTender .btw file.");
  }

  const notes: ConversionNote[] = [];
  const metadata = parseMetadata(headerText);
  const size = parseSize(metadata.templateSize);
  const previewPng = extractFirstPng(buffer);
  const payload = extractPayload(buffer);
  const strings = payload ? extractUtf16Strings(payload) : [];

  if (!payload) {
    notes.push({
      level: "warn",
      message: "Could not decompress the BarTender object graph. Layout is estimated from metadata only.",
    });
  }

  const objects = inferObjects(strings, metadata, notes);

  if (headerText.includes("DataEntryForms>1") || /Daten eingeben/i.test(strings.join("\n"))) {
    notes.push({
      level: "info",
      message: "Print-time prompts were mapped to ZebraDesigner keyboard input (Essentials-compatible).",
    });
  }

  if (/RFID/i.test(strings.join("\n"))) {
    notes.push({
      level: "warn",
      message: "RFID objects were skipped. Essentials cannot use RFID encoding.",
    });
  }

  if (/OnProcessData|Functions and Subs/i.test(strings.join("\n"))) {
    notes.push({
      level: "warn",
      message: "BarTender scripts were skipped. They require ZebraDesigner Professional.",
    });
  }

  notes.push({
    level: "info",
    message:
      "Positions are reconstructed for a small label. Open the file in ZebraDesigner Essentials and nudge objects if needed.",
  });

  return {
    fileName,
    title: metadata.title || stripExtension(fileName),
    widthMm: size.widthMm,
    heightMm: size.heightMm,
    printer: metadata.printer,
    previewPng,
    objects,
    notes,
  };
}

type HeaderMetadata = {
  title: string;
  templateSize: string | null;
  printer: string | null;
  company: string | null;
};

function parseMetadata(headerText: string): HeaderMetadata {
  const title = matchGroup(headerText, /<Title>([^<]+)<\/Title>/) ?? "";
  const templateSize = matchGroup(headerText, /<TemplateSize>([^<]+)<\/TemplateSize>/);
  const printer =
    matchGroup(headerText, /<Printer>([^<]+)<\/Printer>/) ??
    matchGroup(headerText, /Printer: Name=([^;]+)/);
  const company = matchGroup(headerText, /<Company>([^<]+)<\/Company>/);

  return { title, templateSize, printer, company };
}

function parseSize(templateSize: string | null): { widthMm: number; heightMm: number } {
  if (!templateSize) {
    return { widthMm: 38, heightMm: 19 };
  }

  const match = templateSize.match(/([\d.]+)\s*x\s*([\d.]+)\s*mm/i);
  if (!match) {
    return { widthMm: 38, heightMm: 19 };
  }

  return {
    widthMm: Number(match[1]),
    heightMm: Number(match[2]),
  };
}

function extractFirstPng(buffer: Buffer): Uint8Array | null {
  const start = buffer.indexOf(PNG_SIGNATURE);
  if (start < 0) {
    return null;
  }

  const end = buffer.indexOf(PNG_IEND, start);
  if (end < 0) {
    return null;
  }

  return new Uint8Array(buffer.subarray(start, end + PNG_IEND.length));
}

function extractPayload(buffer: Buffer): Buffer | null {
  let searchFrom = 0;
  let lastEnd = -1;

  while (true) {
    const start = buffer.indexOf(PNG_SIGNATURE, searchFrom);
    if (start < 0) {
      break;
    }
    const end = buffer.indexOf(PNG_IEND, start);
    if (end < 0) {
      break;
    }
    lastEnd = end + PNG_IEND.length;
    searchFrom = lastEnd;
  }

  if (lastEnd < 0 || lastEnd + 4 >= buffer.length) {
    return null;
  }

  const compressed = buffer.subarray(lastEnd + 2);
  try {
    return inflateSync(compressed);
  } catch {
    try {
      return inflateSync(buffer.subarray(lastEnd));
    } catch {
      return null;
    }
  }
}

function extractUtf16Strings(payload: Buffer): string[] {
  const strings: string[] = [];
  let offset = 0;

  while (offset < payload.length - 4) {
    const index = payload.indexOf(STRING_PREFIX, offset);
    if (index < 0) {
      break;
    }

    const lengthByte = payload[index + 3];
    let charCount: number;
    let dataStart: number;

    if (lengthByte === 0xff) {
      if (index + 6 > payload.length) {
        break;
      }
      charCount = payload.readUInt16LE(index + 4);
      dataStart = index + 6;
    } else {
      charCount = lengthByte;
      dataStart = index + 4;
    }

    const byteLength = charCount * 2;
    if (charCount === 0 || dataStart + byteLength > payload.length) {
      offset = index + 4;
      continue;
    }

    const value = payload.subarray(dataStart, dataStart + byteLength).toString("utf16le");
    if (isUsefulString(value)) {
      strings.push(value);
    }

    offset = dataStart + byteLength;
  }

  return strings;
}

function isUsefulString(value: string): boolean {
  if (value.length < 2) {
    return false;
  }

  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code < 9 || (code > 13 && code < 32) || code === 0xfffd) {
      return false;
    }
  }

  return /[\p{L}\p{N}]/u.test(value);
}

function inferObjects(
  strings: string[],
  metadata: HeaderMetadata,
  notes: ConversionNote[],
): LabelObject[] {
  const unique = uniquePreserveOrder(strings);
  const objects: LabelObject[] = [];
  const seenNames = new Set<string>();

  let hasFileSource = false;

  for (const value of unique) {
    const kind = classifyString(value);
    if (kind === null) {
      if (/textdatei|input data file|feld \d+/i.test(value)) {
        hasFileSource = true;
      }
      continue;
    }

    const name = sanitizeName(value);
    if (seenNames.has(name.toLowerCase())) {
      continue;
    }
    seenNames.add(name.toLowerCase());

    objects.push({
      id: randomUUID(),
      kind,
      name,
      value: defaultValueFor(kind, value, metadata.title),
      prompt: promptFor(kind, name),
      symbology: kind === "barcode" ? inferSymbology(value, metadata.title) : null,
    });
  }

  if (hasFileSource) {
    notes.push({
      level: "warn",
      message:
        "A text-file / database source was flattened to a keyboard prompt so the file opens in Essentials.",
    });
  }

  if (!objects.some((object) => object.kind === "barcode")) {
    objects.unshift({
      id: randomUUID(),
      kind: "barcode",
      name: "Barcode",
      value: "12345678",
      prompt: "Barcode",
      symbology: inferSymbology("", metadata.title),
    });
    notes.push({
      level: "info",
      message: "No barcode object was found. A Code 128 field was added as a starting point.",
    });
  }

  if (!objects.some((object) => object.kind === "text" || object.kind === "prompt")) {
    objects.push({
      id: randomUUID(),
      kind: "prompt",
      name: "Text",
      value: "Beispieltext",
      prompt: "Text",
      symbology: null,
    });
  }

  return objects.slice(0, 8);
}

function classifyString(value: string): LabelObjectKind | null {
  const normalized = value.trim();
  const lower = normalized.toLowerCase();

  if (SKIP_STRINGS.has(lower)) {
    return null;
  }

  if (/^rfid/i.test(normalized) || /magnetstreifen|hintergrund/i.test(normalized)) {
    return null;
  }

  if (/strichcode|barcode|code\s*128|code128/i.test(normalized)) {
    return "barcode";
  }

  if (/daten eingeben|beispiel für eingabe|prompt/i.test(normalized)) {
    return "prompt";
  }

  if (/^text\s*\d*$/i.test(normalized) || normalized === "Beispieltext") {
    return "text";
  }

  if (/^feld\s*\d+$/i.test(normalized) || /^test$/i.test(normalized)) {
    return "prompt";
  }

  return null;
}

function inferSymbology(value: string, title: string): BarcodeSymbology {
  const haystack = `${value} ${title}`.toLowerCase();
  if (haystack.includes("qr")) {
    return "qr";
  }
  if (haystack.includes("datamatrix") || haystack.includes("data matrix")) {
    return "datamatrix";
  }
  if (haystack.includes("code 39") || haystack.includes("code39")) {
    return "code39";
  }
  if (haystack.includes("ean-13") || haystack.includes("ean13") || haystack.includes("ean 13")) {
    return "ean13";
  }
  return "code128";
}

function defaultValueFor(kind: LabelObjectKind, raw: string, title: string): string {
  switch (kind) {
    case "barcode":
      return title.toLowerCase().includes("128") ? "12345678" : "12345678";
    case "text":
      return raw === "Beispieltext" ? raw : "Text";
    case "prompt":
      return "12345678";
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

function promptFor(kind: LabelObjectKind, name: string): string {
  switch (kind) {
    case "barcode":
      return name || "Barcode";
    case "text":
      return name || "Text";
    case "prompt":
      return name || "Daten eingeben";
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

function sanitizeName(value: string): string {
  const cleaned = value.replaceAll(/[^\p{L}\p{N} _-]/gu, " ").trim();
  return cleaned.slice(0, 40) || "Field";
}

function uniquePreserveOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const key = value.trim();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(key);
  }
  return result;
}

function matchGroup(text: string, pattern: RegExp): string | null {
  const match = text.match(pattern);
  return match?.[1]?.trim() ?? null;
}

function stripExtension(fileName: string): string {
  return fileName.replace(/\.btw$/i, "");
}
