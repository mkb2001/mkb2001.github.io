/**
 * The HUD: a high-precision Kampala clock, fixed bottom right.
 *
 * Kevin's UTC offset is the data-offset attribute on the HUD in index.html. Without JavaScript
 * the HUD stays hidden.
 */
import { utils } from "./vendor/anime.esm.min.js";
import { clockParts, createEpochClock, stampDate } from "./clock.js";

const hud = document.querySelector("[data-hud]");
const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Fractional epoch milliseconds that stay correct after the computer sleeps.
const epochMs = createEpochClock(Date.now, () => performance.now());

if (hud) {
  const offset = Number(hud.dataset.offset ?? 3);
  const $ = (sel) => hud.querySelector(sel);
  const hmsEl = $("[data-hms]");
  const msEl = $("[data-ms]");
  const usEl = $("[data-us]");
  const nsEl = $("[data-ns]");
  const dateEl = $("[data-date]");
  const subEl = $(".hud-sub");

  let lastMinute = -1;
  let lastHms = "";
  const tick = () => {
    const t = epochMs();
    const { hms, ms, us } = clockParts(t, offset);
    if (hms !== lastHms) {
      lastHms = hms;
      hmsEl.textContent = hms;
    }
    if (smooth) {
      msEl.textContent = ms;
      usEl.textContent = us;
      // Browsers cannot measure nanoseconds (timers stop at 5-100 microseconds, on purpose), so
      // these three digits roll as a display effect rather than claiming a measurement.
      nsEl.textContent = String(utils.random(0, 999)).padStart(3, "0");
    }
    const minute = Math.floor(t / 60_000);
    if (minute !== lastMinute) {
      lastMinute = minute;
      dateEl.textContent = stampDate(t, offset);
    }
  };

  hud.hidden = false;
  tick();
  if (smooth) {
    const frame = () => {
      tick();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  } else {
    // Reduced motion: whole seconds only, updated on the second.
    subEl.hidden = true;
    const second = () => {
      tick();
      setTimeout(second, 1000 - (epochMs() % 1000));
    };
    second();
  }
}
