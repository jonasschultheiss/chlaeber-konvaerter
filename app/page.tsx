"use client";

import { useState, type ChangeEvent } from "react";

type NoteLevel = "info" | "warn";

type ConversionNote = {
  level: NoteLevel;
  message: string;
};

type ConvertSuccess = {
  fileName: string;
  title: string;
  widthMm: number;
  heightMm: number;
  notes: ConversionNote[];
  nlblBase64: string;
  previewPngBase64: string | null;
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

  function downloadNlbl() {
    if (!result) {
      return;
    }

    const bytes = Uint8Array.from(atob(result.nlblBase64), (char) => char.charCodeAt(0));
    const blob = new Blob([bytes], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = result.fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">BTW → NLBL</h1>
        <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Upload a BarTender <code>.btw</code> file. The converter writes a
          ZebraDesigner Essentials <code>.nlbl</code> (keyboard prompts, no
          concatenation, database, RFID, or scripts).
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
        <section className="space-y-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="space-y-1 text-sm">
            <p>
              <span className="font-medium">{result.title}</span>
              {` · ${result.widthMm} × ${result.heightMm} mm`}
            </p>
            <p className="text-zinc-500">{result.fileName}</p>
          </div>

          {result.previewPngBase64 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt="BarTender preview"
              className="max-h-56 w-full rounded border border-zinc-200 object-contain dark:border-zinc-800"
              src={`data:image/png;base64,${result.previewPngBase64}`}
            />
          ) : null}

          <ul className="space-y-2 text-sm">
            {result.notes.map((note) => (
              <li
                key={note.message}
                className={
                  note.level === "warn"
                    ? "text-amber-800 dark:text-amber-200"
                    : "text-zinc-600 dark:text-zinc-400"
                }
              >
                {note.level === "warn" ? "Warning: " : ""}
                {note.message}
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={downloadNlbl}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Download .nlbl
          </button>
        </section>
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
    "nlblBase64" in payload &&
    "previewPngBase64" in payload &&
    typeof payload.fileName === "string" &&
    typeof payload.title === "string" &&
    typeof payload.widthMm === "number" &&
    typeof payload.heightMm === "number" &&
    typeof payload.nlblBase64 === "string" &&
    (payload.previewPngBase64 === null || typeof payload.previewPngBase64 === "string") &&
    Array.isArray(payload.notes)
  ) {
    return {
      fileName: payload.fileName,
      title: payload.title,
      widthMm: payload.widthMm,
      heightMm: payload.heightMm,
      nlblBase64: payload.nlblBase64,
      previewPngBase64: payload.previewPngBase64,
      notes: payload.notes.filter(isNote),
    };
  }

  throw new Error("Unexpected conversion response.");
}

function isNote(value: unknown): value is ConversionNote {
  return (
    typeof value === "object" &&
    value !== null &&
    "level" in value &&
    "message" in value &&
    (value.level === "info" || value.level === "warn") &&
    typeof value.message === "string"
  );
}
