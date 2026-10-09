import { test } from "node:test";
import assert from "node:assert/strict";
import { pointAt, arcPath, hourAt, formatHour } from "./orbit.js";

// A dial centred at (100, 100) with radius 50. 00 is at the bottom and hours run clockwise,
// so 06 is on the left, 12 at the top and 18 on the right.
const C = { cx: 100, cy: 100, r: 50 };
const round = ({ x, y }) => ({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });

test("pointAt puts the hours around the dial clockwise from the bottom", () => {
  assert.deepEqual(round(pointAt(0, C)), { x: 100, y: 150 });
  assert.deepEqual(round(pointAt(6, C)), { x: 50, y: 100 });
  assert.deepEqual(round(pointAt(12, C)), { x: 100, y: 50 });
  assert.deepEqual(round(pointAt(18, C)), { x: 150, y: 100 });
});

test("arcPath draws a short clockwise arc", () => {
  assert.equal(arcPath(6, 12, C), "M 50 100 A 50 50 0 0 1 100 50");
});

test("arcPath sets the large-arc flag past twelve hours", () => {
  assert.equal(arcPath(0, 18, C), "M 100 150 A 50 50 0 1 1 150 100");
});

test("hourAt turns a pointer position back into an hour", () => {
  assert.equal(hourAt(50, 100, C), 6);
  assert.equal(hourAt(100, 20, C), 12);
  assert.equal(hourAt(170, 100, C), 18);
  assert.equal(hourAt(100, 160, C), 0);
});

test("formatHour writes a fractional hour on a 24-hour clock and wraps", () => {
  assert.equal(formatHour(9.5), "09:30");
  assert.equal(formatHour(23.99), "23:59");
  assert.equal(formatHour(26.25), "02:15");
  assert.equal(formatHour(-1), "23:00");
});
