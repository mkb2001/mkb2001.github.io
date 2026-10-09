/**
 * Flight control for the hero. Owns "the hour being shown" on the visitor's 24-hour clock: normally
 * the live time, or an hour the visitor has dragged the plane to, which springs back to now when
 * let go (anime.js). js/telemetry.js reads it every frame to place the 3D plane.
 *
 * Also runs the high-precision Kampala clock in the HUD and draws the flat fallback dial that
 * stands in when WebGL is unavailable.
 *
 * Kevin's offset and hours come from data attributes on the `.telemetry` figure in index.html.
 * Without JavaScript the HUD and the dial stay hidden.
 */
import { animate, createSpring, utils } from "./vendor/anime.esm.min.js";
import { computeOverlap } from "./overlap.js";
import { clockParts, createEpochClock, dayFraction, stampDate } from "./clock.js";
import { arcPath, formatHour, pointAt } from "./orbit.js";

// Visitor's assumed working day, in their local time.
const VISITOR_HOURS = { start: 9, end: 17 };
const DIAL = { cx: 200, cy: 200, r: 150 };

const root = document.querySelector("[data-telemetry]");
const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const mod24 = (h) => ((h % 24) + 24) % 24;

// Fractional epoch milliseconds that stay correct after the computer sleeps.
const epochMs = createEpochClock(Date.now, () => performance.now());

const kevinOffset = Number(root?.dataset.offset ?? 3);
// getTimezoneOffset is minutes behind UTC, so negate it.
const visitorOffset = -new Date().getTimezoneOffset() / 60;
const overlap = computeOverlap({
  kevinOffset,
  kevinHours: { start: Number(root?.dataset.start ?? 9), end: Number(root?.dataset.end ?? 18) },
  visitorOffset,
  visitorHours: VISITOR_HOURS,
});

let scrubHour = null;
let spring = null;
const listeners = new Set();

/** The shared state the 3D scene reads. Hours are on the visitor's clock. */
export const flight = {
  overlap,
  liveHour: () => dayFraction(epochMs(), visitorOffset) * 24,
  hour: () => scrubHour ?? flight.liveHour(),
  isScrubbing: () => scrubHour !== null,
  kampalaHour: (visitorHour) => mod24(visitorHour - visitorOffset + kevinOffset),
  /** Hold the plane at an hour (while dragging, or from the keyboard). */
  scrubTo(hour) {
    spring?.pause();
    spring = null;
    const was = scrubHour !== null;
    scrubHour = mod24(hour);
    if (!was) listeners.forEach((fn) => fn("scrub"));
  },
  /** Let go: spring back to the live hour the short way round. */
  release() {
    if (scrubHour === null || spring) return;
    const done = () => {
      scrubHour = null;
      spring = null;
      listeners.forEach((fn) => fn("live"));
    };
    if (!smooth) return done();
    const live = flight.liveHour();
    const delta = mod24(live - scrubHour + 12) - 12;
    const state = { h: scrubHour };
    spring = animate(state, {
      h: scrubHour + delta,
      ease: createSpring({ stiffness: 70, damping: 12 }),
      onUpdate: () => (scrubHour = mod24(state.h)),
      onComplete: done,
    });
  },
  on: (fn) => listeners.add(fn),
};

if (root) {
  const $ = (sel) => document.querySelector(sel);
  const hud = $("[data-hud]");
  const hmsEl = $("[data-hms]");
  const msEl = $("[data-ms]");
  const usEl = $("[data-us]");
  const nsEl = $("[data-ns]");
  const dateEl = $("[data-date]");
  const subEl = $(".hud-sub");
  const scrubEl = $("[data-scrub]");
  const control = $("[data-hour-control]");

  // Flat fallback dial, until (or unless) the 3D globe takes over.
  const dial = root.querySelector("[data-dial]");
  const plane2d = root.querySelector("[data-plane-2d]");
  const arcs = (intervals) => intervals.map((i) => arcPath(i.start, i.end, DIAL)).join(" ");
  root.querySelector("[data-arc-you]").setAttribute("d", arcs(overlap.visitor));
  root.querySelector("[data-arc-me]").setAttribute("d", arcs(overlap.kevin));
  dial.hidden = false;

  /**
   * A short "data scramble" when the HUD switches between the live clock and a dragged hour:
   * digits roll through random values and settle left to right.
   */
  const scramble = (el, text) => {
    if (!smooth) return (el.textContent = text);
    const state = { p: 0 };
    animate(state, {
      p: 1,
      duration: 380,
      ease: "outQuad",
      onUpdate: () => {
        const settled = Math.floor(state.p * text.length);
        el.textContent = [...text]
          .map((c, i) => (i < settled || !/\d/.test(c) ? c : String(utils.random(0, 9))))
          .join("");
      },
      onComplete: () => (el.textContent = text),
    });
  };

  let lastMinute = -1;
  let lastHms = "";
  let scrambling = false;
  const tick = () => {
    const t = epochMs();
    const hour = flight.hour();

    if (!flight.isScrubbing()) {
      const { hms, ms, us } = clockParts(t, kevinOffset);
      if (hms !== lastHms && !scrambling) {
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
    } else if (!scrambling) {
      hmsEl.textContent = `${formatHour(flight.kampalaHour(hour))}:00`;
      scrubEl.textContent = `Your time ${formatHour(hour)}`;
    }

    if (!root.classList.contains("has-3d")) {
      const p = pointAt(hour, DIAL);
      const a = (hour / 24) * Math.PI * 2;
      const deg = (Math.atan2(-Math.sin(a), -Math.cos(a)) * 180) / Math.PI;
      plane2d.setAttribute("transform", `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${deg.toFixed(1)})`);
    }

    const minute = Math.floor(t / 60_000);
    if (minute !== lastMinute) {
      lastMinute = minute;
      dateEl.textContent = stampDate(t, kevinOffset);
    }
  };

  flight.on((mode) => {
    const scrub = mode === "scrub";
    subEl.hidden = scrub || !smooth;
    scrubEl.hidden = !scrub;
    lastHms = "";
    scrambling = true;
    const target = scrub
      ? `${formatHour(flight.kampalaHour(flight.hour()))}:00`
      : clockParts(epochMs(), kevinOffset).hms;
    scramble(hmsEl, target);
    setTimeout(() => (scrambling = false), smooth ? 400 : 0);
  });

  // Keyboard control for the plane: a range input that appears when focused.
  control.hidden = false;
  control.addEventListener("input", () => flight.scrubTo(Number(control.value)));
  control.addEventListener("focus", () => (control.value = String(Math.round(flight.hour() * 4) / 4)));
  control.addEventListener("blur", () => flight.release());
  control.addEventListener("keydown", (e) => e.key === "Escape" && flight.release());

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
