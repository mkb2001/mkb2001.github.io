/**
 * The transit map in the far background: routes between stations, laid out like a metro map
 * (straight runs and 45-degree turns) and drawn very slowly with anime.js. Two amber routes keep a
 * short "train" travelling along them. The layout is seeded, so it is the same on every visit, and
 * rebuilt when the window is resized.
 *
 * With reduced motion the map is drawn complete and nothing moves.
 */
import { animate, createDrawable, stagger } from "./vendor/anime.esm.min.js";

const svg = document.querySelector("[data-transit]");
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const NS = "http://www.w3.org/2000/svg";
const ROUTES = 7;
const HOT = 2;

// Small seeded random generator (mulberry32), so the map does not change between visits.
const seeded = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// One route: a walk across the screen in metro-map steps, snapped to a grid.
function route(rand, w, h, cell) {
  const snap = (v) => Math.round(v / cell) * cell;
  const horizontal = rand() < 0.6;
  let x = horizontal ? -cell : snap(rand() * w);
  let y = horizontal ? snap(rand() * h) : -cell;
  const pts = [[x, y]];
  const stations = [];
  // Headings in 45-degree steps; a route mostly keeps going the same general way.
  const main = horizontal ? 0 : 2;
  let dir = main;
  const dirs = [
    [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1],
  ];
  while (x > -2 * cell && x < w + 2 * cell && y > -2 * cell && y < h + 2 * cell && pts.length < 40) {
    const run = (2 + Math.floor(rand() * 5)) * cell;
    const [dx, dy] = dirs[dir];
    x += dx * run;
    y += dy * run;
    pts.push([x, y]);
    if (rand() < 0.55) stations.push([x, y]);
    // Turn by 45 degrees now and then, never away from the main heading.
    const turn = rand();
    if (turn < 0.3) dir = (main + 1) % 8;
    else if (turn < 0.6) dir = (main + 7) % 8;
    else dir = main;
  }
  return { d: pts.map(([px, py], i) => `${i ? "L" : "M"} ${px} ${py}`).join(" "), stations };
}

let animations = [];

function build() {
  animations.forEach((a) => a.revert?.() ?? a.pause?.());
  animations = [];
  svg.replaceChildren();

  const w = window.innerWidth;
  const h = window.innerHeight;
  const cell = Math.max(24, Math.round(Math.min(w, h) / 22));
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);

  const rand = seeded(20261010);
  const paths = [];
  const nodes = document.createElementNS(NS, "g");
  for (let i = 0; i < ROUTES; i++) {
    const { d, stations } = route(rand, w, h, cell);
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", d);
    path.setAttribute("class", i < HOT ? "route route-hot" : "route");
    svg.append(path);
    paths.push(path);
    for (const [sx, sy] of stations) {
      const c = document.createElementNS(NS, "circle");
      c.setAttribute("class", "node");
      c.setAttribute("cx", sx);
      c.setAttribute("cy", sy);
      c.setAttribute("r", 3);
      nodes.append(c);
    }
  }
  svg.append(nodes);

  if (reduced) return;

  // Draw every route slowly, one after another.
  animations.push(
    animate(createDrawable(paths), {
      draw: ["0 0", "0 1"],
      duration: 9000,
      delay: stagger(900, { start: 600 }),
      ease: "inOutSine",
    }),
  );
  animations.push(animate(nodes.children, { opacity: [0, 1], duration: 1200, delay: stagger(60, { start: 1500 }) }));

  // Trains: a short bright segment running the length of each amber route, forever.
  for (const path of paths.slice(0, HOT)) {
    const train = path.cloneNode();
    train.setAttribute("class", "route route-hot");
    train.style.strokeOpacity = "0.75";
    train.style.strokeWidth = "1.5";
    svg.insertBefore(train, nodes);
    animations.push(
      animate(createDrawable(train), {
        draw: ["0 0.03", "0.97 1"],
        duration: 16000 + Math.random() * 6000,
        delay: 9000,
        loop: true,
        ease: "linear",
      }),
    );
  }
}

if (svg) {
  build();
  let timer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(timer);
    timer = setTimeout(build, 250);
  });
}
