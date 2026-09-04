"use client";

import { useState, type ChangeEvent } from "react";
import { LabelEditor } from "@/app/label-editor";
import { isLayoutPreview, isNote } from "@/lib/label-payload";
import type { ConversionNote, LabelLayoutPreview } from "@/lib/types";

type ConvertSuccess = {
  fileName: string;
  title: string;
  widthMm: number;
  heightMm: number;
  printer: string | null;
  notes: ConversionNote[];
  previewPngBase64: string | null;
  layout: LabelLayoutPreview;
};

export default function Home() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConvertSuccess | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setFileName(file.name);
    setError(null);
    setResult(null);
    setBusy(true);

    const body = new FormData();
    body.set("file", file);

    try {
      const response = await fetch("/api/convert", {
        method: "POST",
        body,
      });
      const payload: unknown = await response.json();

      if (!response.ok) {
        setError(readError(payload));
        return;
      }

      setResult(readSuccess(payload));
    } catch {
      setError("Conversion request failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">BTW → NLBL</h1>
        <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Upload a BarTender <code>.btw</code> file. Nudge and edit fields in
          the browser, then download a ZebraDesigner Essentials{" "}
          <code>.nlbl</code>.
        </p>
      </header>

      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-6 py-12 text-center dark:border-zinc-700 dark:bg-zinc-950">
        <span className="text-sm font-medium">
          {busy ? "Converting…" : "Choose a .btw file"}
        </span>
        <span className="text-xs text-zinc-500">
          {fileName ?? "No file selected"}
        </span>
        <input
          type="file"
          accept=".btw,application/octet-stream"
          className="sr-only"
          disabled={busy}
          onChange={onFileChange}
        />
      </label>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-100">
          {error}
        </p>
      ) : null}

      {result ? (
        <LabelEditor
          key={`${result.fileName}-${result.layout.items.map((item) => item.id).join(",")}`}
          title={result.title}
          fileName={result.fileName}
          widthMm={result.widthMm}
          heightMm={result.heightMm}
          printer={result.printer}
          initialItems={result.layout.items}
          notes={result.notes}
          previewPngBase64={result.previewPngBase64}
        />
      ) : null}
    </main>
  );
}

function readError(payload: unknown): string {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }
  return "Conversion failed.";
}

function readSuccess(payload: unknown): ConvertSuccess {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "fileName" in payload &&
    "title" in payload &&
    "widthMm" in payload &&
    "heightMm" in payload &&
    "notes" in payload &&
    "previewPngBase64" in payload &&
    "printer" in payload &&
    "layout" in payload &&
    typeof payload.fileName === "string" &&
    typeof payload.title === "string" &&
    typeof payload.widthMm === "number" &&
    typeof payload.heightMm === "number" &&
    (payload.printer === null || typeof payload.printer === "string") &&
    (payload.previewPngBase64 === null || typeof payload.previewPngBase64 === "string") &&
    Array.isArray(payload.notes) &&
    isLayoutPreview(payload.layout)
  ) {
    return {
      fileName: payload.fileName,
      title: payload.title,
      widthMm: payload.widthMm,
      heightMm: payload.heightMm,
      printer: payload.printer,
      previewPngBase64: payload.previewPngBase64,
      notes: payload.notes.filter(isNote),
      layout: payload.layout,
    };
  }

  throw new Error("Unexpected conversion response.");
}
