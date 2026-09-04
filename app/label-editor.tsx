"use client";

import {
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactElement,
} from "react";
import { clampItemToLabel, nudgeItem } from "@/lib/nlbl/nudge";
import type { ConversionNote, LabelObjectKind, LayoutPreviewItem } from "@/lib/types";

const NUDGE_MM = 0.2;

type LabelEditorProps = {
  title: string;
  fileName: string;
  widthMm: number;
  heightMm: number;
  printer: string | null;
  initialItems: LayoutPreviewItem[];
  notes: ConversionNote[];
  previewPngBase64: string | null;
};

type DragState = {
  id: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startXMm: number;
  startYMm: number;
};

export function LabelEditor({
  title,
  fileName,
  widthMm,
  heightMm,
  printer,
  initialItems,
  notes,
  previewPngBase64,
}: LabelEditorProps) {
  const [items, setItems] = useState(initialItems);
  const [selectedId, setSelectedId] = useState<string | null>(initialItems[0]?.id ?? null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const selected = items.find((item) => item.id === selectedId) ?? null;

  function updateItem(id: string, patch: Partial<LayoutPreviewItem>) {
    setItems((current) =>
      current.map((item) => {
        if (item.id !== id) {
          return item;
        }
        const next = { ...item, ...patch };
        const position = clampItemToLabel(next, widthMm, heightMm);
        return { ...next, ...position };
      }),
    );
  }

  function onFieldPointerDown(event: PointerEvent<HTMLButtonElement>, item: LayoutPreviewItem) {
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(item.id);
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      id: item.id,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startXMm: item.xMm,
      startYMm: item.yMm,
    };
  }

  function onFieldPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    const surface = surfaceRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !surface) {
      return;
    }

    const rect = surface.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return;
    }

    const dxMm = ((event.clientX - drag.startClientX) / rect.width) * widthMm;
    const dyMm = ((event.clientY - drag.startClientY) / rect.height) * heightMm;
    const item = items.find((entry) => entry.id === drag.id);
    if (!item) {
      return;
    }

    const position = clampItemToLabel(
      {
        ...item,
        xMm: drag.startXMm + dxMm,
        yMm: drag.startYMm + dyMm,
      },
      widthMm,
      heightMm,
    );
    updateItem(drag.id, position);
  }

  function onFieldPointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  }

  function onCanvasKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!selected) {
      return;
    }

    let dx = 0;
    let dy = 0;
    switch (event.key) {
      case "ArrowLeft":
        dx = -NUDGE_MM;
        break;
      case "ArrowRight":
        dx = NUDGE_MM;
        break;
      case "ArrowUp":
        dy = -NUDGE_MM;
        break;
      case "ArrowDown":
        dy = NUDGE_MM;
        break;
      default:
        return;
    }

    event.preventDefault();
    const position = nudgeItem(selected, dx, dy, widthMm, heightMm);
    updateItem(selected.id, position);
  }

  async function downloadNlbl() {
    setExporting(true);
    setExportError(null);

    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName,
          title,
          widthMm,
          heightMm,
          printer,
          items,
        }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        setExportError(readError(payload));
        return;
      }
      const file = readExportFile(payload);
      const bytes = Uint8Array.from(atob(file.nlblBase64), (char) => char.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError("Could not write the .nlbl file.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="space-y-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="space-y-1 text-sm">
        <p>
          <span className="font-medium">{title}</span>
          {` · ${widthMm} × ${heightMm} mm`}
        </p>
        <p className="text-zinc-500">{fileName}</p>
      </div>

      {previewPngBase64 ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt="BarTender preview"
          className="max-h-56 w-full rounded border border-zinc-200 object-contain dark:border-zinc-800"
          src={`data:image/png;base64,${previewPngBase64}`}
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Label editor
          </p>
          <p className="text-xs text-zinc-500">
            Drag a field to move it. Click it, then edit the name and value or
            use the arrow keys.
          </p>
          <div className="rounded border border-zinc-300 bg-zinc-200 p-3 dark:border-zinc-700 dark:bg-zinc-900">
            <div
              ref={surfaceRef}
              className="relative w-full overflow-hidden bg-white outline-none"
              role="application"
              aria-label="Label canvas"
              tabIndex={0}
              onKeyDown={onCanvasKeyDown}
              onPointerDown={() => setSelectedId(null)}
              style={{ aspectRatio: `${widthMm} / ${heightMm}` }}
            >
              {items.map((item) => (
                <FieldBox
                  key={item.id}
                  item={item}
                  selected={item.id === selectedId}
                  labelWidthMm={widthMm}
                  labelHeightMm={heightMm}
                  onPointerDown={onFieldPointerDown}
                  onPointerMove={onFieldPointerMove}
                  onPointerUp={onFieldPointerUp}
                />
              ))}
            </div>
          </div>
        </div>

        <FieldInspector
          item={selected}
          widthMm={widthMm}
          heightMm={heightMm}
          onChange={updateItem}
        />
      </div>

      <ul className="space-y-2 text-sm">
        {notes.map((note) => (
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

      {exportError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-100">
          {exportError}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => {
          void downloadNlbl();
        }}
        disabled={exporting}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {exporting ? "Writing…" : "Download .nlbl"}
      </button>
    </section>
  );
}

function FieldBox({
  item,
  selected,
  labelWidthMm,
  labelHeightMm,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  item: LayoutPreviewItem;
  selected: boolean;
  labelWidthMm: number;
  labelHeightMm: number;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>, item: LayoutPreviewItem) => void;
  onPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLButtonElement>) => void;
}) {
  const isBarcode = item.kind === "barcode";
  return (
    <button
      type="button"
      aria-label={`${kindLabel(item.kind)} ${item.name}`}
      aria-pressed={selected}
      className={`absolute overflow-hidden border bg-white text-left ${
        selected ? "z-10 border-sky-500 ring-2 ring-sky-400" : "border-zinc-400"
      }`}
      style={{
        left: `${(item.xMm / labelWidthMm) * 100}%`,
        top: `${(item.yMm / labelHeightMm) * 100}%`,
        width: `${(item.widthMm / labelWidthMm) * 100}%`,
        height: `${(item.heightMm / labelHeightMm) * 100}%`,
        cursor: "grab",
      }}
      onPointerDown={(event) => onPointerDown(event, item)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {isBarcode ? (
        <span className="block h-full w-full">
          <svg aria-hidden="true" className="h-full w-full" viewBox="0 0 200 80" preserveAspectRatio="none">
            {renderBarcodeStripes(0, 0, 200, 80)}
          </svg>
          <span className="pointer-events-none absolute inset-x-0 bottom-0.5 text-center text-[10px] text-zinc-900">
            {item.value}
          </span>
        </span>
      ) : (
        <span className="block truncate px-1 text-[11px] leading-5 text-zinc-900">
          {item.value}
        </span>
      )}
    </button>
  );
}

function FieldInspector({
  item,
  widthMm,
  heightMm,
  onChange,
}: {
  item: LayoutPreviewItem | null;
  widthMm: number;
  heightMm: number;
  onChange: (id: string, patch: Partial<LayoutPreviewItem>) => void;
}) {
  if (!item) {
    return (
      <div className="rounded-md border border-dashed border-zinc-300 p-3 text-sm text-zinc-500 dark:border-zinc-700">
        Select a field to edit it.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {kindLabel(item.kind)}
      </p>
      <label className="block space-y-1 text-sm">
        <span className="text-zinc-600 dark:text-zinc-400">Name</span>
        <input
          className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          value={item.name}
          onChange={(event) => onChange(item.id, { name: event.target.value })}
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="text-zinc-600 dark:text-zinc-400">Value</span>
        <input
          className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          value={item.value}
          onChange={(event) => onChange(item.id, { value: event.target.value })}
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label="X mm"
          value={item.xMm}
          max={widthMm}
          onChange={(xMm) => onChange(item.id, { xMm })}
        />
        <NumberField
          label="Y mm"
          value={item.yMm}
          max={heightMm}
          onChange={(yMm) => onChange(item.id, { yMm })}
        />
      </div>
      <div className="grid grid-cols-3 gap-1">
        <span />
        <NudgeButton
          label="Nudge up"
          onClick={() => onChange(item.id, nudgeItem(item, 0, -NUDGE_MM, widthMm, heightMm))}
        >
          ↑
        </NudgeButton>
        <span />
        <NudgeButton
          label="Nudge left"
          onClick={() => onChange(item.id, nudgeItem(item, -NUDGE_MM, 0, widthMm, heightMm))}
        >
          ←
        </NudgeButton>
        <NudgeButton
          label="Nudge down"
          onClick={() => onChange(item.id, nudgeItem(item, 0, NUDGE_MM, widthMm, heightMm))}
        >
          ↓
        </NudgeButton>
        <NudgeButton
          label="Nudge right"
          onClick={() => onChange(item.id, nudgeItem(item, NUDGE_MM, 0, widthMm, heightMm))}
        >
          →
        </NudgeButton>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="text-zinc-600 dark:text-zinc-400">{label}</span>
      <input
        type="number"
        step="0.1"
        min={0}
        max={max}
        className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        value={value}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) {
            onChange(next);
          }
        }}
      />
    </label>
  );
}

function NudgeButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className="rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function kindLabel(kind: LabelObjectKind): string {
  switch (kind) {
    case "barcode":
      return "Barcode";
    case "text":
      return "Text";
    case "prompt":
      return "Prompt";
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

function renderBarcodeStripes(
  x: number,
  y: number,
  width: number,
  height: number,
): ReactElement[] {
  const barHeight = Math.max(height - 10, height * 0.7);
  const barModule = Math.max(1.2, width / 70);
  const stripes: ReactElement[] = [];
  let offset = 4;
  let index = 0;
  while (offset < width - 4 && index < 80) {
    const barWidth = index % 4 === 0 ? barModule * 1.8 : barModule;
    if (index % 2 === 0) {
      stripes.push(
        <rect
          fill="#18181b"
          height={barHeight}
          key={`bar-${index}`}
          width={barWidth}
          x={x + offset}
          y={y + 2}
        />,
      );
    }
    offset += barWidth + barModule * 0.6;
    index += 1;
  }
  return stripes;
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
  return "Export failed.";
}

function readExportFile(payload: unknown): { fileName: string; nlblBase64: string } {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "fileName" in payload &&
    "nlblBase64" in payload &&
    typeof payload.fileName === "string" &&
    typeof payload.nlblBase64 === "string"
  ) {
    return {
      fileName: payload.fileName,
      nlblBase64: payload.nlblBase64,
    };
  }
  throw new Error("Unexpected export response.");
}
