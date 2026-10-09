import { test } from "node:test";
import assert from "node:assert/strict";
import { subsolarPoint, toVector } from "./sun.js";

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} not within ${tol} of ${b}`);

test("subsolarPoint puts the sun over the Greenwich meridian at noon UTC", () => {
  const { lon } = subsolarPoint(new Date(Date.UTC(2026, 2, 20, 12, 0)));
  near(lon, 0, 5, "longitude");
});

test("subsolarPoint moves the sun 15 degrees west per hour", () => {
  near(subsolarPoint(new Date(Date.UTC(2026, 2, 20, 18, 0))).lon, -90, 5, "18:00 UTC");
  near(subsolarPoint(new Date(Date.UTC(2026, 2, 20, 9, 0))).lon, 45, 5, "09:00 UTC");
});

test("subsolarPoint follows the seasons", () => {
  near(subsolarPoint(new Date(Date.UTC(2026, 5, 21, 12))).lat, 23.44, 0.5, "June solstice");
  near(subsolarPoint(new Date(Date.UTC(2026, 11, 21, 12))).lat, -23.44, 0.5, "December solstice");
  near(subsolarPoint(new Date(Date.UTC(2026, 2, 20, 12))).lat, 0, 1, "March equinox");
});

test("toVector matches the Three.js sphere's texture layout", () => {
  // Three.js maps u=0 of an equirectangular texture to longitude -180, wrapping round from -x.
  const v = (lat, lon) => toVector(lat, lon).map((n) => Math.round(n * 1000) / 1000 + 0);
  assert.deepEqual(v(90, 0), [0, 1, 0]);
  assert.deepEqual(v(0, -180), [-1, 0, 0]);
  assert.deepEqual(v(0, -90), [0, 0, 1]);
  assert.deepEqual(v(0, 0), [1, 0, 0]);
  assert.deepEqual(v(0, 90), [0, 0, -1]);
});
