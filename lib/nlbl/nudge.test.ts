import assert from "node:assert/strict";
import { test } from "node:test";
import { clampItemToLabel, nudgeItem } from "./nudge";

const box = { xMm: 10, yMm: 4, widthMm: 12, heightMm: 5 };

test("clamp keeps a box on a 38x19 mm label", () => {
  assert.deepEqual(clampItemToLabel({ ...box, xMm: 40, yMm: 18 }, 38, 19), {
    xMm: 26,
    yMm: 14,
  });
});

test("nudge stops at the label origin", () => {
  assert.deepEqual(nudgeItem(box, -20, -20, 38, 19), { xMm: 0, yMm: 0 });
});

test("nudge moves by 0.2 mm when there is room", () => {
  assert.deepEqual(nudgeItem(box, 0.2, -0.2, 38, 19), { xMm: 10.2, yMm: 3.8 });
});
