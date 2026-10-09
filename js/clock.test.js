import { test } from "node:test";
import assert from "node:assert/strict";
import { clockParts, createEpochClock, dayFraction, stampDate } from "./clock.js";

// 2026-10-09T11:02:03.004005Z, as fractional epoch milliseconds.
const T = Date.UTC(2026, 9, 9, 11, 2, 3, 4) + 0.005;

test("clockParts shifts UTC to Kampala and splits out milliseconds and microseconds", () => {
  assert.deepEqual(clockParts(T, 3), { hms: "14:02:03", ms: "004", us: "005" });
});

test("clockParts wraps past midnight", () => {
  const lateUtc = Date.UTC(2026, 9, 9, 22, 30, 0, 0);
  assert.equal(clockParts(lateUtc, 3).hms, "01:30:00");
});

test("clockParts handles a negative offset that wraps to the previous day", () => {
  const earlyUtc = Date.UTC(2026, 9, 9, 2, 15, 59, 999);
  assert.deepEqual(clockParts(earlyUtc, -7), { hms: "19:15:59", ms: "999", us: "000" });
});

test("clockParts handles half-hour offsets", () => {
  assert.equal(clockParts(T, 5.5).hms, "16:32:03");
});

test("dayFraction is the share of the day elapsed on a clock", () => {
  assert.equal(dayFraction(Date.UTC(2026, 9, 9, 12, 0, 0, 0), 0), 0.5);
  assert.equal(dayFraction(Date.UTC(2026, 9, 9, 21, 0, 0, 0), 3), 0);
});

test("createEpochClock adds sub-millisecond precision to the wall clock", () => {
  let wall = 1_000_000;
  let mono = 500.25;
  const clock = createEpochClock(() => wall, () => mono);
  // Anchored to the wall clock on the first call...
  assert.equal(clock(), 1_000_000);
  // ...then the monotonic clock supplies the fraction of a millisecond.
  mono += 10.5;
  wall += 10;
  assert.equal(clock(), 1_000_010.5);
});

test("createEpochClock re-anchors when the monotonic clock stalls during sleep", () => {
  let wall = 1_000_000;
  let mono = 500;
  const clock = createEpochClock(() => wall, () => mono);
  clock();
  // Two hours of suspend: the wall clock moves on, performance.now() does not.
  wall += 7_200_000;
  mono += 16;
  assert.ok(Math.abs(clock() - wall) < 1000, "clock should follow the wall clock after sleep");
});

test("stampDate gives the calendar date on the shifted clock", () => {
  // 22:30 UTC on 9 October is already 10 October in Kampala.
  assert.equal(stampDate(Date.UTC(2026, 9, 9, 22, 30), 3), "2026-10-10");
  assert.equal(stampDate(Date.UTC(2026, 9, 9, 20, 59, 59, 999), 3), "2026-10-09");
  // And a negative offset can still be on the previous day.
  assert.equal(stampDate(Date.UTC(2026, 0, 1, 2, 0), -7), "2025-12-31");
});
