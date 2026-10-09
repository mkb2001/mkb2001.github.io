/**
 * Geometry for the orbit dial: a 24-hour clock face drawn as a circle. 00 is at the bottom and the
 * hours run clockwise, so 06 is on the left, 12 (noon) at the top and 18 on the right.
 * A dial is { cx, cy, r } in SVG user units (y grows downwards).
 */

const TAU = Math.PI * 2;
const mod24 = (n) => ((n % 24) + 24) % 24;
const fix = (n) => +n.toFixed(2);

export function pointAt(hour, { cx, cy, r }) {
  const a = (hour / 24) * TAU;
  return { x: cx - r * Math.sin(a), y: cy + r * Math.cos(a) };
}

// SVG path for the arc from `start` to `end` hours, clockwise. Spans must be under 24 hours.
export function arcPath(start, end, dial) {
  const p = pointAt(start, dial);
  const q = pointAt(end, dial);
  const large = end - start > 12 ? 1 : 0;
  return `M ${fix(p.x)} ${fix(p.y)} A ${dial.r} ${dial.r} 0 ${large} 1 ${fix(q.x)} ${fix(q.y)}`;
}

// The hour under a pointer at (x, y), in the dial's coordinates.
export function hourAt(x, y, { cx, cy }) {
  const a = Math.atan2(-(x - cx), y - cy);
  return mod24((a / TAU) * 24);
}

export function formatHour(hour) {
  const minutes = Math.floor(mod24(hour) * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
