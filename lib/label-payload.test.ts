import assert from "node:assert/strict";
import { test } from "node:test";
import { isLayoutPreviewItem, readExportLabel } from "./label-payload";

const item = {
  id: "field-1",
  name: "Text",
  kind: "prompt" as const,
  value: "Beispieltext",
  prompt: "Text",
  symbology: null,
  xMm: 1.14,
  yMm: 1.14,
  widthMm: 35.72,
  heightMm: 2.86,
  showHri: false,
};

test("accepts a complete layout item", () => {
  assert.equal(isLayoutPreviewItem(item), true);
});

test("rejects an item without an id", () => {
  assert.equal(isLayoutPreviewItem({ ...item, id: "" }), false);
});

test("reads an export payload", () => {
  const parsed = readExportLabel({
    fileName: "demo.nlbl",
    title: "Demo Label",
    widthMm: 38,
    heightMm: 19,
    printer: "ZDesigner ZD621-203dpi ZPL",
    items: [item],
  });
  assert.ok(parsed);
  assert.equal(parsed.items[0]?.value, "Beispieltext");
});

test("rejects an export payload with no items", () => {
  assert.equal(
    readExportLabel({
      fileName: "demo.nlbl",
      title: "Demo Label",
      widthMm: 38,
      heightMm: 19,
      printer: null,
      items: [],
    }),
    null,
  );
});
