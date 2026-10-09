import { test } from "node:test";
import assert from "node:assert/strict";
import { computeOverlap } from "./overlap.js";

const KEVIN = { kevinOffset: 3, kevinHours: { start: 9, end: 18 }, visitorHours: { start: 9, end: 17 } };
const at = (visitorOffset) => computeOverlap({ ...KEVIN, visitorOffset });

test("Kampala visitor is in the same zone and shares eight hours", () => {
  const r = at(3);
  assert.equal(r.sameZone, true);
  assert.deepEqual(r.kevin, [{ start: 9, end: 18 }]);
  assert.deepEqual(r.shared, [{ start: 9, end: 17 }]);
  assert.equal(r.sharedHours, 8);
});

test("London in summer shares seven hours", () => {
  const r = at(1);
  assert.equal(r.sameZone, false);
  assert.deepEqual(r.kevin, [{ start: 7, end: 16 }]);
  assert.deepEqual(r.shared, [{ start: 9, end: 16 }]);
  assert.equal(r.sharedHours, 7);
});

test("New York in summer shares two hours", () => {
  const r = at(-4);
  assert.deepEqual(r.kevin, [{ start: 2, end: 11 }]);
  assert.deepEqual(r.shared, [{ start: 9, end: 11 }]);
  assert.equal(r.sharedHours, 2);
});

test("US Pacific in summer splits Kevin's day at midnight and shares nothing", () => {
  const r = at(-7);
  assert.deepEqual(r.kevin, [
    { start: 23, end: 24 },
    { start: 0, end: 8 },
  ]);
  assert.deepEqual(r.shared, []);
  assert.equal(r.sharedHours, 0);
});

test("India handles a half-hour offset", () => {
  const r = at(5.5);
  assert.deepEqual(r.kevin, [{ start: 11.5, end: 20.5 }]);
  assert.deepEqual(r.shared, [{ start: 11.5, end: 17 }]);
  assert.equal(r.sharedHours, 5.5);
});

test("Nepal handles a 45-minute offset", () => {
  const r = at(5.75);
  assert.deepEqual(r.kevin, [{ start: 11.75, end: 20.75 }]);
  assert.equal(r.sharedHours, 5.25);
});

test("Tokyo ends exactly at midnight without an empty second band", () => {
  const r = at(9);
  assert.deepEqual(r.kevin, [{ start: 15, end: 24 }]);
  assert.deepEqual(r.shared, [{ start: 15, end: 17 }]);
  assert.equal(r.sharedHours, 2);
});

test("Kiribati splits Kevin's day past midnight and shares nothing", () => {
  const r = at(14);
  assert.deepEqual(r.kevin, [
    { start: 20, end: 24 },
    { start: 0, end: 5 },
  ]);
  assert.equal(r.sharedHours, 0);
});
