/**
 * Clock math for the ticker that rides the hour strip. Pure functions, unit-tested with `node --test`.
 * Times are fractional epoch milliseconds (see createEpochClock), so the
 * microsecond digits are as fine as the browser allows; many browsers coarsen them on purpose.
 */

const DAY_US = 86_400_000_000;

// Microseconds since midnight on a clock `offsetHours` from UTC.
function microsOfDay(epochMs, offsetHours) {
  const us = Math.round(epochMs * 1000) + Math.round(offsetHours * 3_600_000_000);
  return ((us % DAY_US) + DAY_US) % DAY_US;
}

const pad = (n, width) => String(n).padStart(width, "0");

export function clockParts(epochMs, offsetHours) {
  const t = microsOfDay(epochMs, offsetHours);
  const secs = Math.floor(t / 1_000_000);
  const hms = `${pad(Math.floor(secs / 3600), 2)}:${pad(Math.floor(secs / 60) % 60, 2)}:${pad(secs % 60, 2)}`;
  return { hms, ms: pad(Math.floor(t / 1000) % 1000, 3), us: pad(t % 1000, 3) };
}

// Share of the day elapsed, 0 <= f < 1, on a clock `offsetHours` from UTC.
export function dayFraction(epochMs, offsetHours) {
  return microsOfDay(epochMs, offsetHours) / DAY_US;
}

/**
 * A clock in fractional epoch milliseconds: the wall clock for correctness, the monotonic clock for
 * sub-millisecond digits. performance.now() can stall while a laptop sleeps, so whenever the two
 * drift more than a second apart the clock re-anchors to the wall clock.
 *
 * @param {() => number} wallNow  usually Date.now
 * @param {() => number} monoNow  usually performance.now
 */
export function createEpochClock(wallNow, monoNow) {
  let base = wallNow() - monoNow();
  return () => {
    const wall = wallNow();
    let t = base + monoNow();
    if (Math.abs(t - wall) > 1000) {
      base = wall - monoNow();
      t = wall;
    }
    return t;
  };
}

// The calendar date (YYYY-MM-DD) on a clock `offsetHours` from UTC.
export function stampDate(epochMs, offsetHours) {
  return new Date(epochMs + offsetHours * 3_600_000).toISOString().slice(0, 10);
}
