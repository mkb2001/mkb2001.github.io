/**
 * The hero motherboard (drawn by tools/board/build.mjs) and the introduction beside it.
 *
 *  - The bench tray and its standoffs settle in when the page opens.
 *  - The hero then stays pinned (.hero-pin is several screens tall and the hero is sticky inside it)
 *    while the board builds with the scroll: the six copper layers land one by one, then the top
 *    copper, solder mask and silkscreen, and then the parts in the order they are fitted, in the
 *    build order baked into each part's data-build. Scrolling back up takes it apart.
 *  - The introduction arrives along the way: each [data-intro] piece of the hero copy shows once
 *    the pinned scroll reaches its share.
 *  - Each group of parts gets a label named after one of Kevin's skills, hung on a leader from the
 *    part as it is built. The stage being built now has amber outlines and an amber label.
 *  - Once complete, the last stretch of the pin powers the board on, one step of the sequence in
 *    js/board-model.js at a time: standby power, the power button, PS_ON#, the main rails, PWR_OK,
 *    the regulators, clocks and reset, the firmware read, memory training and PCIe. Each live net's
 *    routes and parts light (amber for power, blue for signals, white for the clock), the status
 *    LEDs step through their checks, and at the end the board is running.
 *
 * With prefers-reduced-motion the parts appear without dropping in and nothing flows.
 */
import { BOOT, bootStepAt, liveAt, memoryGBps, BOARD } from "./board-model.js";

const NS_SVG = "http://www.w3.org/2000/svg";
const root = document.querySelector("[data-board]");
if (root) start();

function start() {
  const stage = root.querySelector("[data-board-stage]");
  const frame = root.querySelector(".board-frame");
  const svg = stage.querySelector("svg");
  const data = JSON.parse(root.querySelector("[data-board-data]").textContent);
  const hint = root.querySelector("[data-board-hint]");
  const readout = root.querySelector("[data-board-readout]");
  const pin = document.querySelector("[data-hero-pin]");
  const intros = [...document.querySelectorAll("[data-intro]")].map((el) => ({ el, at: Number(el.dataset.intro), shown: false }));
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const ARRIVE = 0.7; // seconds for the bench to settle when the page opens
  const LIFT = { layers: 34, routing: 26, parts: 30 }; // how far parts fall from, in world units
  const BUILD = [0.03, 0.64]; // share of the pinned scroll over which the board builds
  const POWER = [0.68, 0.95]; // and over which it powers on
  const BOOT_LED_SECONDS = 2.5; // the BOOT LED's last check, once the board is running
  const STAGE_NAMES = ["Bench", "Copper layers", "Top copper, mask and silkscreen", "CPU socket", "Processor", "Voltage regulators", "Memory", "Chipset", "PCIe and storage", "Support chips and headers", "Power, rear I/O and heatsinks"];
  // The status LEDs light while the board checks each of these.
  const LEDS = { cpu: ["vrm", "reset", "firmware"], dram: ["training"], vga: ["enumerate"] };

  // A part is every element that carries its build number; one part can be drawn in several places
  // in the painter's order.
  const parts = [];
  for (const el of svg.querySelectorAll("[data-build]")) {
    const n = Number(el.dataset.build);
    parts[n] ??= { els: [], stage: Number(el.dataset.stage), label: el.dataset.label === undefined ? -1 : Number(el.dataset.label), t: -1 };
    parts[n].els.push(el);
  }
  const total = parts.length;
  const fitted = total - data.load;
  const liftOf = (part) => (data.stages[part.stage] === "layers" ? LIFT.layers : data.stages[part.stage] === "routing" ? LIFT.routing : LIFT.parts);

  // --- Placing parts -------------------------------------------------------------------------
  const ease = (t) => 1 - (1 - t) ** 3;
  function place(part, t) {
    t = Math.min(1, Math.max(0, t));
    if (Math.abs(t - part.t) < 1e-4) return;
    part.t = t;
    const up = reduced ? 0 : (1 - ease(t)) * liftOf(part);
    const opacity = String(Math.min(1, t * 2.5));
    const transform = up ? `translate(${(data.drop[0] * up).toFixed(2)} ${(data.drop[1] * up).toFixed(2)})` : "";
    for (const el of part.els) {
      el.style.opacity = opacity;
      if (transform) el.setAttribute("transform", transform);
      else el.removeAttribute("transform");
    }
  }

  // --- Labels --------------------------------------------------------------------------------
  // The words are the list items in index.html; the build script gives each one an anchor on its
  // part and the place its leader runs to. Label i names the parts tagged data-label="i".
  const [, , vbWidth, vbHeight] = svg.getAttribute("viewBox").split(" ").map(Number);
  const list = root.querySelector("[data-board-labels]");
  const leaders = document.createElementNS(NS_SVG, "svg");
  leaders.setAttribute("class", "board-leaders");
  leaders.setAttribute("viewBox", `0 0 ${vbWidth} ${vbHeight}`);
  leaders.setAttribute("aria-hidden", "true");
  stage.after(leaders);
  const labels = [...list.children].map((li, i) => {
    const spec = data.labels[i];
    li.style.left = `${(spec.end[0] / vbWidth) * 100}%`;
    li.style.top = `${(spec.end[1] / vbHeight) * 100}%`;
    // The label sits outside the end of its leader, pushed out the way the leader points.
    li.style.setProperty("--ax", spec.out[0]);
    li.style.setProperty("--ay", spec.out[1]);
    li.dataset.align = spec.out[0] < -0.45 ? "end" : spec.out[0] > 0.45 ? "start" : "middle";
    const g = document.createElementNS(NS_SVG, "g");
    const [x, y] = spec.anchor;
    const [ex, ey] = spec.end;
    g.innerHTML = `<path d="M${x} ${y}L${ex} ${ey}"/><circle cx="${x}" cy="${y}" r="1.6"/><circle class="board-leader-end" cx="${ex}" cy="${ey}" r="1.1"/>`;
    leaders.append(g);
    return { li, g, own: parts.filter((p) => p.label === i), state: "" };
  });
  list.classList.add("is-placed");

  // Labels at the sides wrap to the room left between their leader and the edge of the frame (plus
  // a little of the page gutter), so none runs off the page.
  const fitLabels = () => {
    const width = frame.clientWidth;
    labels.forEach(({ li }, i) => {
      const { end, out } = data.labels[i];
      const x = (end[0] / vbWidth) * width;
      const room = out[0] > 0.45 ? width - x + 24 : out[0] < -0.45 ? x + 24 : Infinity;
      li.style.maxWidth = Number.isFinite(room) ? `min(10.5em, ${Math.max(80, room - 10).toFixed(0)}px)` : "";
    });
  };
  fitLabels();
  window.addEventListener("resize", fitLabels);

  // Narrow screens have no room for the ring: crop the drawing to the board and name the part
  // being built in the caption instead.
  const narrow = window.matchMedia("(max-width: 40rem)");
  const fullBox = svg.getAttribute("viewBox");
  const crop = () => {
    const box = narrow.matches ? data.boardBox.join(" ") : fullBox;
    svg.setAttribute("viewBox", box);
    const [, , w, h] = box.split(" ").map(Number);
    frame.style.aspectRatio = `${w} / ${h}`;
    lastText = "";
    kick();
  };
  narrow.addEventListener("change", crop);

  // A label shows once its parts start to arrive; it is the current one until they are all built.
  let latestLabel = null;
  function showLabels() {
    let latest = -1;
    labels.forEach((label, i) => {
      const started = label.own.some((p) => p.t > 0.15);
      const done = label.own.every((p) => p.t >= 0.97);
      if (started) latest = i;
      const state = !started ? "" : done ? "in" : "current";
      if (state === label.state) return;
      label.state = state;
      for (const el of [label.li, label.g]) {
        el.classList.toggle("is-in", state !== "");
        el.classList.toggle("is-current", state === "current");
      }
    });
    latestLabel = labels[latest] ?? null;
  }

  // The stage being built has amber outlines.
  let currentStage = -1;
  function markStage(built) {
    const next = built < total ? parts[built].stage : -1;
    if (next === currentStage) return;
    currentStage = next;
    for (const part of parts) for (const el of part.els) el.classList.toggle("is-current", part.stage === next && next > 0);
  }

  // --- Power-on ------------------------------------------------------------------------------
  const nets = [...svg.querySelectorAll("[data-net]")];
  const glows = [...svg.querySelectorAll("[data-glow]")].map((el) => ({ el, nets: el.dataset.glow.split(" ") }));
  const leds = [...svg.querySelectorAll("[data-led]")];
  let step = -1;
  let runningSince = -1;
  let clock = 0;
  function power(next) {
    if (next === step) return;
    step = next;
    const live = new Set(step < 0 ? [] : liveAt(step));
    for (const el of nets) el.classList.toggle("is-live", live.has(el.dataset.net));
    for (const { el, nets: own } of glows) el.classList.toggle("is-live", own.some((n) => live.has(n)));
    const id = step < 0 ? "" : BOOT[step].id;
    for (const el of leds) el.classList.toggle("is-live", (LEDS[el.dataset.led] ?? []).includes(id));
    runningSince = id === "running" ? clock : -1;
    root.classList.toggle("is-powered", step > 0);
    lastText = "";
  }
  function bootLed() {
    const on = runningSince >= 0 && clock - runningSince < BOOT_LED_SECONDS && !reduced;
    for (const el of leds) if (el.dataset.led === "boot") el.classList.toggle("is-live", on);
    return on;
  }

  // --- State ---------------------------------------------------------------------------------
  let laid = reduced ? Infinity : 0; // seconds since the page opened
  let shown = 0; // fitted parts placed, eased towards the scroll
  let last = 0;
  let frameId = 0;

  // How far through the pinned stretch the page is, 0 to 1.
  const pinShare = () => {
    if (!pin) return 1;
    const box = pin.getBoundingClientRect();
    const sticky = pin.firstElementChild.getBoundingClientRect();
    const travel = box.height - sticky.height;
    return travel < 40 ? 1 : Math.min(1, Math.max(0, (sticky.top - box.top) / travel));
  };
  const targetParts = (share) => Math.min(1, Math.max(0, (share - BUILD[0]) / (BUILD[1] - BUILD[0]))) * (fitted + 0.5);

  // --- Words ---------------------------------------------------------------------------------
  let lastText = "";
  function words(complete, built) {
    let text;
    let help;
    if (complete && step > 0) {
      text = BOOT[step].id === "running" ? `Running · DDR5-${BOARD.memory.mts} · ${memoryGBps().toFixed(1)} GB/s peak` : BOOT[step].say;
      help = BOOT[step].id === "running" ? "Built from my stack · scroll on" : `Powering on · step ${step} of ${BOOT.length - 1}`;
    } else if (complete) {
      text = `Complete · ${total} parts`;
      help = "Scroll to power it on";
    } else if (narrow.matches && latestLabel) {
      // On narrow screens the caption carries the label of the part being built.
      const skill = latestLabel.li.querySelector(".board-label-skill")?.textContent;
      text = `${skill} · ${built} / ${total} parts`;
      help = "Scroll to build the board";
    } else {
      const next = parts[Math.min(total - 1, built)];
      text = `${STAGE_NAMES[next.stage]} · ${built} / ${total} parts`;
      help = "Scroll to build the board";
    }
    if (text === lastText) return;
    lastText = text;
    readout.textContent = text;
    hint.textContent = help;
  }

  function showIntro(share) {
    for (const piece of intros) {
      const shown = share >= piece.at;
      if (shown === piece.shown) continue;
      piece.shown = shown;
      piece.el.classList.toggle("is-in", shown);
      document.dispatchEvent(new CustomEvent("intro", { detail: { el: piece.el, shown } }));
    }
  }

  // --- Loop ----------------------------------------------------------------------------------
  function tick(now) {
    const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
    last = now;
    clock += dt;

    laid += dt;
    for (let i = 0; i < data.load; i++) place(parts[i], laid / ARRIVE);
    const benchDone = laid > ARRIVE;

    const share = pinShare();
    showIntro(share);
    const target = benchDone ? targetParts(share) : 0;
    shown = reduced ? target : shown + (target - shown) * (1 - Math.exp(-dt / 0.22));
    if (Math.abs(target - shown) < 0.002) shown = target;
    for (let j = 0; j < fitted; j++) place(parts[data.load + j], (shown - j) / 1.5);

    let built = data.load;
    while (built < total && parts[built].t >= 0.97) built++;
    const complete = built === total;
    markStage(built);
    power(complete ? bootStepAt((share - POWER[0]) / (POWER[1] - POWER[0])) : -1);
    const glowing = bootLed();
    showLabels();
    words(complete, built);

    const busy = !benchDone || shown !== target || glowing;
    frameId = busy && visible() ? requestAnimationFrame(tick) : 0;
  }

  let onScreen = true;
  const visible = () => !document.hidden && onScreen;
  const kick = () => {
    if (frameId || !visible()) return;
    last = 0;
    frameId = requestAnimationFrame(tick);
  };

  new IntersectionObserver(
    (entries) => {
      onScreen = entries[entries.length - 1].isIntersecting;
      kick();
    },
    { rootMargin: "120px 0px" },
  ).observe(frame);

  if (narrow.matches) crop();
  window.addEventListener("scroll", kick, { passive: true });
  window.addEventListener("resize", kick);
  document.addEventListener("visibilitychange", kick);
  kick();
}
