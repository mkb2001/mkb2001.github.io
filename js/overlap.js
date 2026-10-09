/**
 * Time math for the working-hours strip. Pure functions with no DOM access, so they can be
 * unit-tested with `node --test`. All hours are on a 24-hour clock and may be fractional.
 *
 * An interval is { start, end } with 0 <= start < end <= 24.
 */

const mod24 = (n) => ((n % 24) + 24) % 24;

// A span of `length` hours starting at `start`, split in two if it runs past midnight.
function span(start, length) {
  const s = mod24(start);
  const e = s + length;
  return e <= 24
    ? [{ start: s, end: e }]
    : [
        { start: s, end: 24 },
        { start: 0, end: e - 24 },
      ];
}

/**
 * @param {{ kevinOffset: number, kevinHours: {start: number, end: number},
 *           visitorOffset: number, visitorHours: {start: number, end: number} }} input
 */
export function computeOverlap({ kevinOffset, kevinHours, visitorOffset, visitorHours }) {
  // Hours to add to a Kampala clock time to get the visitor's clock time.
  const shift = visitorOffset - kevinOffset;
  const kevin = span(kevinHours.start + shift, kevinHours.end - kevinHours.start);
  const visitor = span(visitorHours.start, visitorHours.end - visitorHours.start);

  const shared = [];
  for (const a of kevin) {
    for (const b of visitor) {
      const start = Math.max(a.start, b.start);
      const end = Math.min(a.end, b.end);
      if (end > start) shared.push({ start, end });
    }
  }
  shared.sort((a, b) => a.start - b.start);

  const sharedHours = shared.reduce((sum, i) => sum + (i.end - i.start), 0);
  return { kevin, visitor, shared, sharedHours, sameZone: shift === 0 };
}
