/**
 * Shrinks the SVG the build writes. The kit samples outlines and tone sheets densely: drop points
 * within 0.15 px of the line through their neighbours (Douglas-Peucker), then write each run in
 * relative coordinates with no padding. Paths with arcs or H/V commands are left as they are.
 */
function simplify(points, tolerance) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = points[a];
    const [bx, by] = points[b];
    const dx = bx - ax;
    const dy = by - ay;
    const length = Math.hypot(dx, dy);
    let worst = -1;
    let index = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = points[i];
      const distance = length ? Math.abs(dx * (ay - py) - dy * (ax - px)) / length : Math.hypot(px - ax, py - ay);
      if (distance > worst) [worst, index] = [distance, i];
    }
    if (worst > tolerance) {
      keep[index] = 1;
      stack.push([a, index], [index, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}
const num = (value) => {
  const text = (Math.round(value * 10) / 10).toString();
  return text.replace(/^(-?)0\./, "$1.");
};
const pair = (x, y) => {
  const a = num(x);
  const b = num(y);
  return a + (b.startsWith("-") ? "" : " ") + b;
};
function compactPath(d) {
  if (!/^[MLZ0-9.\s-]+$/.test(d)) return d;
  const runs = [];
  for (const piece of d.match(/M[^M]*/g) ?? []) {
    const closed = /Z\s*$/.test(piece);
    const values = piece.match(/-?\d*\.?\d+/g)?.map(Number) ?? [];
    const points = [];
    for (let i = 0; i + 1 < values.length; i += 2) points.push([values[i], values[i + 1]]);
    if (points.length) runs.push({ points: simplify(points, 0.15), closed });
  }
  let out = "";
  let cx = 0;
  let cy = 0;
  for (const { points, closed } of runs) {
    const [x0, y0] = points[0];
    out += `m${pair(x0 - cx, y0 - cy)}`;
    if (points.length > 1) out += "l";
    let px = x0;
    let py = y0;
    for (let i = 1; i < points.length; i++) {
      const [x, y] = points[i];
      const step = pair(Math.round((x - px) * 10) / 10, Math.round((y - py) * 10) / 10);
      out += (i > 1 && !step.startsWith("-") ? " " : "") + step;
      px = Math.round(px * 10 + (x - px) * 10) / 10;
      py = Math.round(py * 10 + (y - py) * 10) / 10;
    }
    if (closed) {
      out += "z";
      [cx, cy] = [x0, y0];
    } else [cx, cy] = [px, py];
  }
  return out;
}
export const compact = (markup) => markup.replace(/ d="([^"]*)"/g, (_, d) => ` d="${compactPath(d)}"`);
