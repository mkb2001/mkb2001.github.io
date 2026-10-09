/**
 * Where the sun is overhead, for lighting the globe. Accurate to a degree or two, which is plenty
 * for drawing the line between day and night (it ignores the equation of time).
 */

const DEG = Math.PI / 180;

// The point on Earth with the sun directly overhead at `date`, in degrees.
export function subsolarPoint(date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const dayOfYear = (date.getTime() - start) / 86_400_000;
  const lat = -23.44 * Math.cos(((2 * Math.PI) / 365) * (dayOfYear + 10));
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const lon = ((((-15 * (utcHours - 12)) % 360) + 540) % 360) - 180;
  return { lat, lon };
}

// A unit vector for a latitude and longitude, laid out like Three.js's SphereGeometry, so an
// equirectangular Earth texture lines up with it.
export function toVector(lat, lon) {
  const phi = (lon + 180) * DEG;
  const c = Math.cos(lat * DEG);
  return [-Math.cos(phi) * c, Math.sin(lat * DEG), Math.sin(phi) * c];
}
