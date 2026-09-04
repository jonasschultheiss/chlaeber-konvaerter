import assert from "node:assert/strict";
import { test } from "node:test";
import type { LabelObject } from "../types";
import {
  estimateCode128Modules,
  layoutLabel,
  refineLabelObjects,
} from "./layout";

function object(
  kind: LabelObject["kind"],
  name: string,
  value: string,
): LabelObject {
  return {
    id: name,
    kind,
    name,
    value,
    prompt: name,
    symbology: kind === "barcode" ? "code128" : null,
  };
}

test("refine drops prompt fields that repeat the barcode sample", () => {
  const notes: Array<{ level: "info" | "warn"; message: string }> = [];
  const refined = refineLabelObjects(
    [
      object("prompt", "Feld 1", "12345678"),
      object("text", "Beispieltext", "Beispieltext"),
      object("barcode", "Barcode", "12345678"),
      object("prompt", "Feld 2", "12345678"),
      object("prompt", "Feld 3", "12345678"),
    ],
    19,
    notes,
  );

  assert.deepEqual(
    refined.map((item) => item.name),
    ["Beispieltext", "Barcode"],
  );
  assert.equal(notes.length, 1);
});

test("layout keeps every object inside a 38x19 mm label", () => {
  const width = 38_000;
  const height = 19_000;
  const placements = layoutLabel(
    [
      object("text", "Beispieltext", "Beispieltext"),
      object("barcode", "Barcode", "12345678"),
    ],
    width,
    height,
  );

  assert.equal(placements.length, 2);
  for (const placement of placements) {
    const extra = placement.showHri ? 2400 : 0;
    assert.ok(placement.x >= 0, "x is on the label");
    assert.ok(placement.y >= 0, "y is on the label");
    assert.ok(placement.x + placement.width <= width, "right edge is on the label");
    assert.ok(
      placement.y + placement.height + extra <= height,
      "bottom edge is on the label",
    );
  }

  const barcode = placements.find((item) => item.object.kind === "barcode");
  assert.ok(barcode);
  assert.ok(barcode.barcodeModuleUm !== null);
  const encodedWidth =
    barcode.barcodeModuleUm * estimateCode128Modules(barcode.object.value);
  assert.ok(encodedWidth <= barcode.width, "barcode modules fit the allocated width");
});

test("layout still fits when many unique texts are supplied", () => {
  const width = 38_000;
  const height = 19_000;
  const objects = [
    object("text", "Line1", "Alpha"),
    object("text", "Line2", "Beta"),
    object("text", "Line3", "Gamma"),
    object("barcode", "Barcode", "12345678"),
  ];
  const placements = layoutLabel(objects, width, height);

  assert.ok(placements.some((item) => item.object.kind === "barcode"));
  for (const placement of placements) {
    const extra = placement.showHri ? 2400 : 0;
    assert.ok(placement.y + placement.height + extra <= height);
  }
});
