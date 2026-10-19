/**
 * Builds the hero figure: a representative AM5 / B650 ATX motherboard on a steel bench tray, drawn
 * with the Anatomy iso kit (tools/board/kit, copied from the anatomy skill). World units are
 * millimetres; layout.mjs says where everything sits and copper.mjs draws the copper.
 *
 * The board builds in ten stages as the visitor scrolls, in the order a board is made and then
 * populated: the six copper layers land one by one on the standoffs, the top copper, solder mask
 * and silkscreen go on, then the socket, the processor, the regulators, memory, chipset, slots and
 * storage, the support chips and headers, and last the power connectors, rear I/O and heatsinks.
 * js/board.js plays that order (each part's data-build) and then the power-on (data-net).
 *
 * The bench, tray and board sheets are drawn first, in a fixed order. Every part on the board is
 * recorded with its true shape (kit/audit.mjs), and A.settle measures which is in front wherever
 * two overlap on screen, so tall parts (modules, heatsinks, connectors) are painted correctly.
 *
 * Run from the repository root:  node tools/board/build.mjs   (add --audit to check the geometry)
 * It rewrites the SVG between the board:start and board:end markers in index.html.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./kit/iso-kit.mjs";
import * as A from "./kit/audit.mjs";
import { compact } from "./compact.mjs";
import { BOARD, memoryGBps } from "../../js/board-model.js";
import * as Lay from "./layout.mjs";
import { LAYER, TOP_LAYER, NETS } from "./copper.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const { TOP, Z, PCB, TRAY } = Lay;

const WIDTH = 640;
const HEIGHT = 600;
// The board is drawn in the middle of the canvas, in a box this big; the ring of labels goes round it.
const BOARD_BOX = [510, 430];

const P = k.fitProjection([...k.boxCorners(TRAY, -12, 0), [Lay.DIMM.slots[0].x, 18, TOP + 36], [0, 12, TOP + 24], [Lay.HEATSINK.top.x, 9, TOP + 25]], BOARD_BOX[0], BOARD_BOX[1], {
  pad: 0,
  azimuth: 45,
  elevation: 50,
});
P.origin[0] += (WIDTH - BOARD_BOX[0]) / 2;
P.origin[1] += (HEIGHT - BOARD_BOX[1]) / 2;

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const depth = (x, y, z = 0) => k.depthOf([x, y, z], P);
const r1 = (v) => +v.toFixed(1);
const onTop = (points, z, closed = false) => k.onTop(points, z, P, closed);
const rectOf = ({ x, y, w, d }) => [[x, y], [x + w, y], [x + w, y + d], [x, y + d]];
const centreOf = ({ x, y, w, d }) => [x + w / 2, y + d / 2];
// Many tiny round marks (pins, vias, clearance holes) as one path of zero-length round-capped strokes.
const pinsPath = (points, z) => points.map((p) => at([p[0], p[1], z])).map(([x, y]) => `M${x.toFixed(1)} ${y.toFixed(1)}h0`).join("");
// Lines that stand for printed text: short rules on a face, marked free for the line check.
const rules = (x, y, z, lengths, gap = 1.2) => L(lengths.map((l, i) => k.lineOnTop([x, y + i * gap], [x + l, y + i * gap], z, P)).join(""), { tone: "lo", free: true });

// --- Parts and items ----------------------------------------------------------------------------
// A part is what builds as one step; an item is one drawn piece with its true shape.
const STAGES = ["bench", "layers", "routing", "socket", "processor", "power", "memory", "chipset", "expansion", "support", "connectors"];
const LOAD_STAGES = 1; // laid when the page opens; the rest build with the scroll
const parts = [];
const part = (stage, label = null) => {
  parts.push({ stage: STAGES.indexOf(stage), label, id: parts.length });
  return parts.length - 1;
};
const back = []; // drawn first, in this order: the bench, the board's sheets and its copper
const R = A.recorder(P);
const record = R.solid;
const put = (id, name, ref, svg, shapes = [], bias = 0, extra = {}) => R.put({ name: R.nameFor(name), at: ref, bias, svg, shapes, part: id, ...extra });

function box(id, name, plan, z, h, style = {}, { steps = 2, bevel = 0.3, inner = "", extra = "", bias = 0, attrs } = {}) {
  const shape = record(A.slab(plan, z, h, { name }, steps));
  const svg = S(k.slabOf(plan, z, h, P, steps, bevel), { tone: "mid", ...style, inner }) + extra;
  return put(id, name, [...centreOf(plan), z + h / 2], attrs ? `<g ${attrs}>${svg}</g>` : svg, [shape], bias);
}
function cyl(id, name, cx, cy, r, z, h, style = {}, { steps = 24, bevel = 0, inner = "", extra = "", bias = 0, attrs } = {}) {
  const shape = record(A.cylinder(cx, cy, r, z, h, { name }));
  const svg = S(k.cylinder(cx, cy, r, z, h, P, steps, bevel), { tone: "mid", ...style, inner }) + extra;
  return put(id, name, [cx, cy, z + h / 2], attrs ? `<g ${attrs}>${svg}</g>` : svg, [shape], bias);
}
// A small chip: its package, a pin-one dot and, for the bigger ones, rules for its marking.
function chip(id, name, plan, h, { tone = "hi", marking = true, attrs } = {}) {
  const z = TOP + h;
  const dot = Dots([at([plan.x + 1.1, plan.y + 1.1, z])], { size: 0.4, tone: "hi" });
  const text = marking && plan.w >= 6 ? rules(plan.x + plan.w * 0.25, plan.y + plan.d * 0.45, z, [plan.w * 0.5, plan.w * 0.36]) : "";
  return box(id, name, plan, TOP, h, { tone }, { extra: dot + text, attrs });
}
// Gull-wing leads down the sides of a quad flat pack, as lines from the body to the board.
function leads({ x, y, w, d }, h, pitch) {
  const out = [];
  for (let t = x + 1; t < x + w - 0.6; t += pitch) out.push(k.segment([t, y + d, TOP + h * 0.5], [t, y + d + 0.9, TOP], P), k.segment([t, y, TOP + h * 0.5], [t, y - 0.9, TOP], P));
  for (let t = y + 1; t < y + d - 0.6; t += pitch) out.push(k.segment([x + w, t, TOP + h * 0.5], [x + w + 0.9, t, TOP], P), k.segment([x, t, TOP + h * 0.5], [x - 0.9, t, TOP], P));
  return L(out.join(""), { tone: "mid" });
}

// --- Bench: the steel tray on rubber feet, a groove, a ruler, a label plate, nine standoffs ------
{
  const id = part("bench");
  const out = [`<path class="iso-halo" d="${k.haloOf(TRAY, -12, 6, P)}"/>`];
  const feet = k.corners(TRAY, 20).sort((a, b) => depth(...a) - depth(...b));
  for (const [x, y] of feet) {
    out.push(S(k.cylinder(x, y, 8, -12, 1.6, P, 28), { tone: "lo" }), S(k.cylinder(x, y, 6, -10.4, 6.4, P, 28), { tone: "mid" }));
    record(A.cylinder(x, y, 8, -12, 1.6, { name: "stand.foot", ground: true }));
  }
  out.push(S(k.slabOf(TRAY, -4, 4, P, 8, 1.2), { tone: "lo" }));
  record(A.slab(TRAY, -4, 4, { name: "stand.tray", ground: true }, 8));
  out.push(L(k.planOutline(k.insetPlan(TRAY, 5), 0, P), { tone: "faint" }));
  const screws = k.corners(TRAY, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.4, 0, P, 16)).join(""), { tone: "lo" }), Dots(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // A ruler along the front edge, in millimetres, and the tray's label plate in the far corner.
  const strip = { x: TRAY.x + TRAY.w - 12, y: 6, w: 7, d: 290, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.y + 4, strip.y + strip.d - 4, 5, 5, strip.x + 0.8, 0.6, [2, 3.6], P, "y");
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  const label = { x: TRAY.x + 8, y: TRAY.y + TRAY.d - 28, w: 12, d: 22, r: 1 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 3), { tone: "mid", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.4), 0.8, P, 3), { tone: "faint" }));
  out.push(L([[3, 16], [6, 12], [9, 14]].map(([dx, l]) => k.lineOnTop([label.x + dx, label.y + 4], [label.x + dx, label.y + 4 + l], 0.8, P)).join(""), { tone: "lo", free: true }));
  // Brass standoffs: a hex body under each of the board's nine holes.
  for (const [x, y] of [...Lay.HOLES].sort((a, b) => depth(...a) - depth(...b))) {
    out.push(S(k.cylinder(x, y, 3.2, 0, Z.standoff, P, 6, 0.3), { tone: "mid" }));
    record(A.cylinder(x, y, 3.2, 0, Z.standoff, { name: "stand.standoff" }));
  }
  back.push({ id, svg: `<g class="board-bench">${out.join("")}</g>` });
}

// --- The six copper layers, bottom up, then the top copper, the mask and the silkscreen ---------
// Each sheet is a layer of copper on its glass-fibre core, with the board's outline and holes.
const PCB_RING = rectOf(PCB);
const holeVoids = (z) => Lay.HOLES.map(([x, y]) => `<path class="board-void" d="${k.ring(x, y, 1.9, z, P, 20)}"/>`).join("");
function sheet(id, name, z, h, pattern, className, tone = "lo") {
  const solid = S(k.extrude(PCB_RING, z, h, P, { bevel: 0 }), { tone, crease: "none" });
  record(A.extruded(PCB_RING, z, h, { name }));
  back.push({ id, svg: `<g class="${className}">${solid}${pattern}${holeVoids(z + h)}</g>` });
}
const traceSvg = (lines, z, className = "board-trace") => `<path class="${className}" d="${lines.map((points) => onTop(points, z)).join("")}"/>`;
const pourSvg = (pours, z, className = "board-copper") => pours.map((ring) => `<path class="${className}" d="${onTop(ring, z, true)}"/>`).join("");

Lay.LAYERS.forEach((layer, i) => {
  const z = Z.standoff + i * Z.sheet;
  const top = z + Z.sheet;
  const spec = LAYER[layer];
  const id = part(layer === "L1" ? "routing" : "layers", layer === "L1" ? 1 : 0);
  let pattern = "";
  if (spec) {
    if (spec.pours) pattern += pourSvg(spec.pours, top);
    if (spec.lines) pattern += traceSvg(spec.lines, top);
    if (spec.pads) pattern += `<path class="board-copper" d="${spec.pads.map((ring) => onTop(ring, top, true)).join("")}"/>`;
    if (spec.holes) pattern += `<path class="board-holes" d="${pinsPath(spec.holes, top)}"/>`;
  } else {
    // L1, the top layer: pours, then the traces, then the pads they run to.
    pattern += pourSvg(TOP_LAYER.pours, top) + traceSvg(TOP_LAYER.lines, top);
  }
  sheet(id, `pcb.${layer}`, z, Z.sheet, pattern, `board-sheet board-${layer}`);
});
const MASK_Z = Z.standoff + Lay.LAYERS.length * Z.sheet;
{
  // Plated through-holes and vias, then the solder mask over everything: the copper still shows
  // through it as faint relief.
  back.push({ id: part("routing", 1), svg: `<path class="board-vias" d="${pinsPath(TOP_LAYER.vias, MASK_Z)}"/>` });
  const id = part("routing", 1);
  const relief = pourSvg(TOP_LAYER.pours, TOP, "board-mask-pour") + traceSvg(TOP_LAYER.lines, TOP, "board-mask-trace");
  sheet(id, "pcb.mask", MASK_Z, Z.mask, relief + `<path class="board-vias board-vias-masked" d="${pinsPath(TOP_LAYER.vias, TOP)}"/>`, "board-sheet board-mask", "mid");
}

// The silkscreen: an outline round every part's footprint, pin-one marks, the audio section's
// isolation line and the board's name, the one engraved label in the drawing.
const SILK = [];
const silk = (plan, grow = 0.8) => SILK.push(k.planOutline(k.insetPlan({ r: 0.3, ...plan }, -grow), TOP, P, 2));
{
  const id = part("routing", 1);
  const silkLater = () => {
    const iso = onTop([[0, 256], [56, 256], [56, Lay.D]], TOP); // the audio section, edge to edge
    const name = k.topMatrix([196, 268], TOP, P, "x");
    back.push({
      id,
      svg: `<g class="board-silk">${L(SILK.join(""), { tone: "faint", className: "board-silk-line" })}${L(iso, { tone: "faint", className: "board-silk-line" })}${k.faceTextSvg(name, "B650 ATX · REV 1.0", { size: 3.4, tone: "lo" })}</g>`,
    });
  };
  // Filled in once every footprint is known, at the end of the build.
  SILK.later = silkLater;
}

// The routes the power-on lights, on the board under every part.
{
  const nets = NETS.map(({ net, kind, points }) => `<path class="board-net" data-net="${net}" data-kind="${kind}" d="${k.pathOf(points.map(([x, y]) => at([x, y, TOP])))}"/>`).join("");
  back.push({ id: null, svg: `<g class="board-nets" data-nets aria-hidden="true">${nets}</g>` });
}

// --- 3. Socket: the contact insert, the housing round it, the stiffener frame and the lever -----
{
  const { cx, cy } = Lay.SOCKET;
  const id = part("socket", 2);
  const insert = { ...Lay.CAVITY, r: 0.4 };
  const pins = [];
  for (let r = 0; r < 31; r++) for (let c = 0; c < 31; c++) if (!((r === 0 || r === 30) && (c === 0 || c === 30))) pins.push([insert.x + 1.5 + c * 1.3, insert.y + 1.5 + r * 1.3]);
  box(id, "socket.insert", insert, TOP, 1.6, { tone: "lo" }, { bevel: 0, extra: `<path class="board-pins" d="${pinsPath(pins, TOP + 1.6)}"/>` });
  // The housing is a ring of four walls round the cavity, so the processor can sit inside it.
  const H = Lay.HOUSING;
  const wall = 3;
  const walls = [
    { x: H.x, y: H.y, w: H.w, d: wall },
    { x: H.x, y: H.y + H.d - wall, w: H.w, d: wall },
    { x: H.x, y: H.y + wall, w: wall, d: H.d - 2 * wall },
    { x: H.x + H.w - wall, y: H.y + wall, w: wall, d: H.d - 2 * wall },
  ];
  walls.forEach((plan, i) => box(id, `socket.wall${i}`, { ...plan, r: 0.4 }, TOP, 3.2, { tone: "hi" }, { bevel: 0.2 }));
  // The loading mechanism's steel frame round the housing, with its four screws and the lever.
  const F = Lay.FRAME;
  const bar = 4.4;
  const bars = [
    { x: F.x, y: F.y, w: F.w, d: bar },
    { x: F.x, y: F.y + F.d - bar, w: F.w, d: bar },
    { x: F.x, y: F.y + bar, w: bar, d: F.d - 2 * bar },
    { x: F.x + F.w - bar, y: F.y + bar, w: bar, d: F.d - 2 * bar },
  ];
  const id2 = part("socket", 2);
  bars.forEach((plan, i) => {
    const screws = i < 2 ? [[plan.x + 2.4, plan.y + bar / 2], [plan.x + plan.w - 2.4, plan.y + bar / 2]] : [];
    box(id2, `socket.frame${i}`, { ...plan, r: 0.6 }, TOP, 1.4, { tone: "hi" }, { bevel: 0.3, extra: screws.length ? L(screws.map(([x, y]) => k.ring(x, y, 1.3, TOP + 1.4, P, 12)).join(""), { tone: "lo" }) + Dots(screws.map(([x, y]) => at([x, y, TOP + 1.4])), { size: 0.45 }) : "" });
  });
  // The alignment triangle in the frame's corner, that matches the one on the processor.
  const tri = onTop([[F.x + 1, F.y + F.d - 1], [F.x + 4, F.y + F.d - 1], [F.x + 1, F.y + F.d - 4]], TOP + 1.4, true);
  put(id2, "socket.key", [F.x + 2, F.y + F.d - 2, TOP + 1.4], L(tri, { tone: "hi" }), [record(A.box([F.x + 1, F.y + F.d - 4, TOP + 1.4], [F.x + 4, F.y + F.d - 1, TOP + 1.45], { name: "socket.key" }))], 0.2);
  const lever = { x: F.x + F.w, y: F.y + 3, w: 2, d: F.d - 6, r: 0.8 };
  box(id2, "socket.lever", lever, TOP, 2.2, { tone: "hi" }, { steps: 3 });
  box(id2, "socket.lever.hook", { x: lever.x + lever.w, y: lever.y + lever.d - 2, w: 4, d: 2, r: 0.8 }, TOP, 2.2, { tone: "hi" }, { steps: 3 });
  // Cooler mounting holes (54 x 90, as AM4), plated, with the backplate's threaded studs.
  const id3 = part("socket", 2);
  for (const [x, y] of Lay.COOLER_HOLES) {
    cyl(id3, "socket.stud", x, y, 2.4, TOP, 3.6, { tone: "mid" }, { steps: 6, bevel: 0.3, extra: `<path class="board-void" d="${k.ring(x, y, 1.3, TOP + 3.6, P, 14)}"/>` });
  }
  silk(Lay.FRAME, 1.2);
}

// --- 4. Processor: the package, its capacitors, the heat spreader, then the load plate closes ----
{
  const { cx, cy } = Lay.SOCKET;
  const id = part("processor", 2);
  const pkg = Lay.PACKAGE;
  const zs = TOP + 1.6;
  const caps = [];
  // The heat spreader's flange has two notches on each side, where capacitors sit on the package.
  const notches = [-11, 7];
  for (const dy of notches) for (const side of [0, 1]) for (let n = 0; n < 3; n++) caps.push([side ? pkg.x + pkg.w - 5.1 : pkg.x + 3.9, cy + dy + 0.6 + n * 1.4]);
  const capSvg = caps.map(([x, y]) => S(k.slabOf({ x, y, w: 1.2, d: 0.8, r: 0.1 }, zs + 1.2, 0.5, P, 1, 0), { tone: "mid", crease: "none" })).join("");
  const tri = onTop([[pkg.x + 0.8, pkg.y + pkg.d - 0.8], [pkg.x + 3.4, pkg.y + pkg.d - 0.8], [pkg.x + 0.8, pkg.y + pkg.d - 3.4]], zs + 1.2, true);
  box(id, "cpu.substrate", pkg, zs, 1.2, { tone: "mid" }, { bevel: 0.2, extra: capSvg + L(tri, { tone: "hi" }) });
  const z0 = zs + 1.2;
  const fx = pkg.x + 3.2;
  const fw = pkg.w - 6.4;
  const fy = pkg.y + 1;
  const fd = pkg.d - 2;
  const ring = [[fx, fy], [fx + fw, fy]];
  for (const dy of notches) ring.push([fx + fw, cy + dy], [fx + fw - 2.2, cy + dy], [fx + fw - 2.2, cy + dy + 4.4], [fx + fw, cy + dy + 4.4]);
  ring.push([fx + fw, fy + fd], [fx, fy + fd]);
  for (const dy of [...notches].reverse()) ring.push([fx, cy + dy + 4.4], [fx + 2.2, cy + dy + 4.4], [fx + 2.2, cy + dy], [fx, cy + dy]);
  const id2 = part("processor", 2);
  record(A.extruded(ring, z0, 1.4, { name: "cpu.flange" }));
  put(id2, "cpu.flange", [cx, cy, z0 + 0.7], S(k.extrude(ring, z0, 1.4, P, { convex: false, bevel: 0.3 }), { tone: "hi" }), [R.solids[R.solids.length - 1]]);
  const plateau = { x: cx - 15.5, y: cy - 16.5, w: 31, d: 33, r: 1.2 };
  box(id2, "cpu.ihs", plateau, z0 + 1.4, 2.2, { tone: "hi" }, { steps: 4, bevel: 0.6, extra: rules(plateau.x + 6, plateau.y + 9, z0 + 3.6, [14, 18, 10, 16], 2.4) });
  // The load plate comes down over the spreader's flange and the lever locks it.
  const id3 = part("processor", 2);
  const LP = { x: cx - 25, y: cy - 26, w: 50, d: 52 };
  const win = { x: plateau.x - 1, y: plateau.y - 1, w: plateau.w + 2, d: plateau.d + 2 };
  const lz = z0 + 1.4;
  const strips = [
    { x: LP.x, y: LP.y, w: LP.w, d: win.y - LP.y },
    { x: LP.x, y: win.y + win.d, w: LP.w, d: LP.y + LP.d - win.y - win.d },
    { x: LP.x, y: win.y, w: win.x - LP.x, d: win.d },
    { x: win.x + win.w, y: win.y, w: LP.x + LP.w - win.x - win.w, d: win.d },
  ];
  strips.forEach((plan, i) => box(id3, `cpu.plate${i}`, { ...plan, r: 0.5 }, lz, 0.6, { tone: "hi" }, { bevel: 0.2 }));
}

// --- 5. Power delivery: the CPU connector, input capacitors, controller, power stages, chokes ------
{
  const id = part("power", 3);
  const E = Lay.EPS;
  const pins = [];
  for (let c = 0; c < 4; c++) for (let r = 0; r < 2; r++) pins.push([E.x + 3.2 + c * 4.3, E.y + 2.7 + r * 4.2]);
  box(id, "eps", E, TOP, 12.8, { tone: "hi" }, {
    extra: pins.map(([x, y]) => `<path class="board-void" d="${onTop([[x - 1.6, y - 1.6], [x + 1.6, y - 1.6], [x + 1.6, y + 1.6], [x - 1.6, y + 1.6]], TOP + 12.8, true)}"/>`).join("") + L(pins.map(([x, y]) => onTop([[x - 1.6, y - 1.6], [x + 1.6, y - 1.6], [x + 1.6, y + 1.6], [x - 1.6, y + 1.6]], TOP + 12.8, true)).join(""), { tone: "lo" }),
    attrs: `data-glow="12v"`,
  });
  box(id, "eps.latch", { x: E.x + E.w / 2 - 2.4, y: E.y + E.d, w: 4.8, d: 1.4, r: 0.3 }, TOP + 6, 6.8, { tone: "mid" }, { steps: 1 });
  silk(E);
  const id2 = part("power", 3);
  for (const [x, y] of Lay.VRM.input) {
    cyl(id2, "vrm.input", x, y, 3.15, TOP, 8, { tone: "hi" }, { steps: 24, bevel: 0.4, inner: L(k.sideArc(x, y, 3.15, TOP + 6.6, P, 20), { tone: "lo" }), extra: L(k.ring(x, y, 2.2, TOP + 8, P, 18), { tone: "faint" }), attrs: `data-glow="12v"` });
    SILK.push(k.ring(x, y, 3.8, TOP, P, 20));
  }
  chip(id2, "vrm.controller", Lay.VRM.controller, 0.9);
  // Fourteen phases: a power stage (under the heatsink later) and a choke each, then the output
  // capacitors between the chokes and the socket.
  const phases = [...Lay.VRM.left.map((p) => ({ ...p, side: "left" })), ...Lay.VRM.top.map((p) => ({ ...p, side: "top" }))];
  phases.forEach(({ stage, choke, side }, n) => {
    const id3 = part("power", 3);
    const net = side === "top" && n >= Lay.VRM.left.length + 4 ? "vsoc" : "vcore";
    chip(id3, "vrm.stage", stage, 0.9, { marking: false });
    const z = TOP + 7;
    box(id3, "vrm.choke", choke, TOP, 7, { tone: "hi" }, { steps: 3, bevel: 0.5, extra: L(k.planOutline(k.insetPlan(choke, 1.6), z, P, 3), { tone: "faint" }) + rules(choke.x + 2.6, choke.y + choke.d / 2 - 0.6, z, [choke.w * 0.4, choke.w * 0.28]), attrs: `data-glow="${net}"` });
    // The two cooler holes above the socket take the place of the top row's end capacitors.
    const cap = side === "left" ? { x: 44.6, y: choke.y + 2.6, w: 3.4, d: 3, r: 0.3 } : { x: choke.x + 2.6, y: 32.4, w: 3.4, d: 3, r: 0.3 };
    const blocked = Lay.COOLER_HOLES.some(([hx, hy]) => Math.hypot(hx - (cap.x + cap.w / 2), hy - (cap.y + cap.d / 2)) < 6);
    if (!blocked) box(id3, "vrm.cap", cap, TOP, 1.9, { tone: "mid" }, { bevel: 0.2 });
    silk(choke, 0.6);
  });
}

// --- 6. Memory: four DDR5 slots, then two modules in A2 and B2 -------------------------------------
{
  const M = Lay.DIMM.module;
  Lay.DIMM.slots.forEach((slot, i) => {
    const id = part("memory", 4);
    // The slot is a floor with two walls, so the module's edge sits in the groove between them,
    // and a latch at the top end.
    const floor = { x: slot.x, y: slot.y + 4, w: slot.w, d: slot.d - 4, r: 0.6 };
    box(id, "dimm.floor", floor, TOP, 3, { tone: "lo" }, { bevel: 0 });
    for (const [x, w] of [[slot.x, 2.4], [slot.x + slot.w - 2.4, 2.4]]) box(id, "dimm.wall", { x, y: floor.y, w, d: floor.d, r: 0.5 }, TOP + 3, 4, { tone: "hi" }, { bevel: 0.2 });
    box(id, "dimm.latch", { x: slot.x - 0.3, y: slot.y, w: slot.w + 0.6, d: 4, r: 0.8 }, TOP, 9.6, { tone: "hi" }, { steps: 3, bevel: 0.3 });
    silk(slot, 0.6);
  });
  Lay.DIMM.filled.forEach((index) => {
    const slot = Lay.DIMM.slots[index];
    const id = part("memory", 4);
    const x = slot.x + (slot.w - M.t) / 2;
    const z0 = TOP + 3;
    const pcb = { x, y: M.y, w: M.t, d: M.d, r: 0.3 };
    box(id, "dimm.pcb", pcb, z0, M.h, { tone: "hi" }, { bevel: 0, inner: L(k.sideSeam(pcb, z0 + 3.4, P, 2), { tone: "faint" }) });
    // Eight DRAM packages on the side facing the viewer, the PMIC that makes the module's own
    // 1.1 V from 5 V, and the SPD hub.
    const face = x + M.t;
    const centres = [-45.5, -35, -24.5, -14, 14, 24.5, 35, 45.5].map((dy) => M.y + M.d / 2 + dy);
    centres.forEach((cy) => box(id, "dimm.dram", { x: face, y: cy - 4, w: 1, d: 8, r: 0.2 }, z0 + 14.6, 11, { tone: "mid" }, { steps: 1, bevel: 0 }));
    box(id, "dimm.pmic", { x: face, y: M.y + M.d / 2 - 3.6, w: 0.9, d: 7.2, r: 0.2 }, z0 + 8, 5, { tone: "mid" }, { steps: 1, bevel: 0, attrs: `data-glow="vdimm"` });
    box(id, "dimm.spd", { x: face, y: M.y + M.d / 2 - 1.5, w: 0.7, d: 3, r: 0.1 }, z0 + 19, 3, { tone: "lo" }, { steps: 1, bevel: 0 });
  });
}

// --- 7. Chipset: the B650 package, its bare die, and the capacitors round it ---------------------
{
  const id = part("chipset", 5);
  const C = Lay.CHIPSET.pkg;
  box(id, "chipset.pkg", C, TOP, 1.4, { tone: "hi" }, { bevel: 0.2, extra: Dots([at([C.x + 1.4, C.y + 1.4, TOP + 1.4])], { size: 0.45, tone: "hi" }) });
  box(id, "chipset.die", { x: C.x + 4.5, y: C.y + 4.5, w: 12, d: 12, r: 0.2 }, TOP + 1.4, 0.7, { tone: "hi" }, { bevel: 0.2 });
  const caps = [];
  for (let i = 0; i < 6; i++) caps.push({ x: C.x - 3, y: C.y + 2 + i * 3.2 }, { x: C.x + C.w + 1.4, y: C.y + 2 + i * 3.2 });
  const id2 = part("chipset", 5);
  for (const c of caps) box(id2, "chipset.cap", { ...c, w: 1.6, d: 0.9, r: 0.1 }, TOP, 0.8, { tone: "mid" }, { steps: 1, bevel: 0 });
  silk(C, 1);
}

// --- 8. Expansion and storage: three PCIe slots, the M.2 connector and drive, four SATA ports ------
Lay.SLOTS.forEach((slot) => {
  const id = part("expansion", 6);
  const plan = { ...slot, r: 0.6 };
  const z = TOP + 11;
  // The card-edge opening along the top, broken by the key 11.65 mm from the bracket end.
  const key = slot.x + 11.65;
  const open = [onTop([[slot.x + 2, slot.y + 3], [key - 0.6, slot.y + 3], [key - 0.6, slot.y + slot.d - 3], [slot.x + 2, slot.y + slot.d - 3]], z, true), onTop([[key + 0.6, slot.y + 3], [slot.x + slot.w - 2, slot.y + 3], [slot.x + slot.w - 2, slot.y + slot.d - 3], [key + 0.6, slot.y + slot.d - 3]], z, true)];
  const opening = `<path class="board-void" d="${open.join("")}"/>` + L(open.join(""), { tone: "lo" });
  box(id, `slot.${slot.name}`, plan, TOP, 11, { tone: "hi" }, { bevel: 0.3, extra: opening, inner: slot.armour ? L(k.sideSeam(plan, TOP + 3.2, P, 2), { tone: "lo" }) : "" });
  if (slot.w > 40) box(id, "slot.latch", { x: slot.x + slot.w, y: slot.y + 0.8, w: 7, d: slot.d - 1.6, r: 0.8 }, TOP, 8.4, { tone: "mid" }, { steps: 3 });
  silk(slot, 0.8);
});
{
  const id = part("expansion", 6);
  const { connector, drive, standoff } = Lay.M2;
  box(id, "m2.connector", connector, TOP, connector.h, { tone: "hi" }, { bevel: 0.2 });
  const [sx, sy] = standoff;
  cyl(id, "m2.standoff", sx, sy, 2.2, TOP, 2.4, { tone: "mid" }, { steps: 6, bevel: 0.2 });
  silk(drive, 0.6);
  const id2 = part("expansion", 6);
  const z = TOP + connector.h + 0.8;
  const pcb = drive;
  box(id2, "m2.pcb", pcb, z - 0.8, 0.8, { tone: "hi" }, { bevel: 0 });
  const zt = z;
  box(id2, "m2.controller", { x: drive.x + 7, y: drive.y + 5, w: 12, d: 12, r: 0.4 }, zt, 1.2, { tone: "hi" }, { bevel: 0.3, extra: rules(drive.x + 9.5, drive.y + 9.6, zt + 1.2, [7, 5]) });
  box(id2, "m2.dram", { x: drive.x + 23, y: drive.y + 6, w: 8, d: 10, r: 0.3 }, zt, 1, { tone: "mid" }, { bevel: 0.2 });
  for (const x of [drive.x + 36, drive.x + 55]) box(id2, "m2.nand", { x, y: drive.y + 2.5, w: 15, d: 17, r: 0.4 }, zt, 1.3, { tone: "hi" }, { bevel: 0.3, extra: rules(x + 3, drive.y + 9.2, zt + 1.3, [9, 6]) });
  // The screw that holds the drive down on its standoff.
  cyl(id2, "m2.screw", sx, sy, 2.4, z, 1.2, { tone: "hi" }, { steps: 20, bevel: 0.3, extra: L(k.lineOnTop([sx - 1.4, sy], [sx + 1.4, sy], z + 1.2, P) + k.lineOnTop([sx, sy - 1.4], [sx, sy + 1.4], z + 1.2, P), { tone: "lo" }) });
  const id3 = part("expansion", 6);
  Lay.SATA.forEach((plan) => {
    // Right-angle dual ports: the two L-shaped openings face the front edge.
    const face = plan.x + plan.w;
    const port = (z0) => k.pathOf([[face, plan.y + 1.6, z0], [face, plan.y + plan.d - 1.6, z0], [face, plan.y + plan.d - 1.6, z0 + 3.6], [face, plan.y + 4, z0 + 3.6], [face, plan.y + 4, z0 + 2], [face, plan.y + 1.6, z0 + 2]].map(at), true);
    const openings = port(TOP + 2) + port(TOP + 8);
    box(id3, "sata", plan, TOP, 13, { tone: "hi" }, { bevel: 0.3, extra: `<path class="board-void" d="${openings}"/>` + L(openings, { tone: "lo" }) });
    silk(plan, 0.6);
  });
}

{
  // The second M.2 slot, from the chipset, empty: its connector, a standoff at 80 mm and plated
  // holes for shorter drives.
  const id = part("expansion", 6);
  const { connector, holes } = Lay.M2B;
  box(id, "m2b.connector", connector, TOP, connector.h, { tone: "hi" }, { bevel: 0.2, extra: `<path class="board-void" d="${k.planOutline({ x: connector.x + 2.4, y: connector.y + 1.6, w: 1.2, d: connector.d - 3.2, r: 0.4 }, TOP + connector.h, P, 2)}"/>` });
  holes.forEach(([x, y], i) => {
    if (i === holes.length - 1) cyl(id, "m2b.standoff", x, y, 2.2, TOP, 2.4, { tone: "mid" }, { steps: 6, bevel: 0.2, extra: `<path class="board-void" d="${k.ring(x, y, 1, TOP + 2.4, P, 12)}"/>` });
    else SILK.push(k.ring(x, y, 2.6, TOP, P, 16));
  });
  silk({ x: connector.x + 4, y: connector.y, w: 84, d: 22 }, 0.4);
}

// --- 9. Support: the clock, firmware flash, CMOS battery, Super I/O, network, audio, headers, LEDs --
{
  const id = part("support", 7);
  chip(id, "clock.chip", Lay.CLOCK.chip, 0.9);
  box(id, "clock.crystal", Lay.CLOCK.crystal, TOP, 1.1, { tone: "hi" }, { steps: 2, bevel: 0.3 });
  silk(Lay.CLOCK.chip, 0.6);
  silk(Lay.CLOCK.crystal, 0.6);
}
{
  const id = part("support", 8);
  const F = Lay.FLASH;
  box(id, "flash", F, TOP, 1.75, { tone: "hi" }, { bevel: 0.2, extra: Dots([at([F.x + 0.9, F.y + 0.9, TOP + 1.75])], { size: 0.4, tone: "hi" }) + rules(F.x + 1.4, F.y + 2.4, TOP + 1.75, [2.6, 1.8], 1) });
  const pinsOut = [];
  for (let i = 0; i < 4; i++) for (const side of [-1, 1]) {
    const y = F.y + 0.8 + i * 1.27;
    const x0 = side < 0 ? F.x : F.x + F.w;
    pinsOut.push(k.segment([x0, y, TOP + 0.9], [x0 + side * 1.1, y, TOP], P));
  }
  const leadRows = [[F.x - 1.1, F.x], [F.x + F.w, F.x + F.w + 1.1]].map(([x0, x1]) => record(A.box([x0, F.y + 0.4, TOP], [x1, F.y + F.d - 0.4, TOP + 0.9], { name: "flash.leads" })));
  put(id, "flash.leads", [F.x + F.w / 2, F.y + F.d / 2, TOP + 0.5], L(pinsOut.join(""), { tone: "mid" }), leadRows, -0.1);
  silk(F, 1.6);
  const SI = Lay.SUPERIO;
  box(id, "superio", SI, TOP, 1.4, { tone: "hi" }, { bevel: 0.2, extra: Dots([at([SI.x + 1.2, SI.y + 1.2, TOP + 1.4])], { size: 0.45, tone: "hi" }) + rules(SI.x + 3, SI.y + 6, TOP + 1.4, [8, 6, 7], 1.4) });
  const leadSides = [
    [[SI.x - 0.9, SI.y], [SI.x, SI.y + SI.d]],
    [[SI.x + SI.w, SI.y], [SI.x + SI.w + 0.9, SI.y + SI.d]],
    [[SI.x, SI.y - 0.9], [SI.x + SI.w, SI.y]],
    [[SI.x, SI.y + SI.d], [SI.x + SI.w, SI.y + SI.d + 0.9]],
  ].map(([[x0, y0], [x1, y1]]) => record(A.box([x0, y0, TOP], [x1, y1, TOP + 0.7], { name: "superio.leads" })));
  put(id, "superio.leads", [SI.x + SI.w / 2, SI.y + SI.d / 2, TOP + 0.5], leads(SI, 1.4, 0.8), leadSides, -0.1);
  silk(SI, 1.4);
  // The CMOS battery: a CR2032 coin cell on its holder, held by a spring clip.
  const { cx, cy, r } = Lay.CMOS;
  cyl(id, "cmos.holder", cx, cy, r + 1.4, TOP, 0.8, { tone: "mid" }, { steps: 40 });
  cyl(id, "cmos.cell", cx, cy, r, TOP + 0.8, 3.2, { tone: "hi" }, { steps: 48, bevel: 0.5, extra: L(k.ring(cx, cy, r - 2, TOP + 4, P, 40), { tone: "faint" }) + L(k.lineOnTop([cx - 2, cy], [cx + 2, cy], TOP + 4, P) + k.lineOnTop([cx, cy - 2], [cx, cy + 2], TOP + 4, P), { tone: "mid", free: true }) });
  box(id, "cmos.clip", { x: cx - 2.4, y: cy - r - 3.4, w: 4.8, d: 2.4, r: 0.4 }, TOP, 4.4, { tone: "mid" }, { steps: 2 });
  SILK.push(k.ring(cx, cy, r + 2.2, TOP, P, 40));
}
{
  const id = part("support", 8);
  chip(id, "lan", Lay.LAN, 0.9);
  box(id, "lan.crystal", { x: Lay.LAN.x + 10, y: Lay.LAN.y + 2, w: 3.2, d: 2.5, r: 0.3 }, TOP, 0.9, { tone: "hi" }, { bevel: 0.2 });
  const C = Lay.AUDIO.codec;
  chip(id, "audio.codec", C, 1.4);
  for (const [x, y] of Lay.AUDIO.caps) cyl(id, "audio.cap", x, y, 2.5, TOP, 5, { tone: "hi" }, { steps: 22, bevel: 0.3, inner: L(k.sideArc(x, y, 2.5, TOP + 4, P, 18), { tone: "lo" }), extra: L(k.ring(x, y, 1.6, TOP + 5, P, 16), { tone: "faint" }) });
  silk(Lay.LAN, 0.6);
  silk(C, 1);
}
{
  // Pin headers: a plastic base with square posts at 2.54 mm. The fan headers have a shroud.
  const id = part("support", 8);
  for (const [name, h] of Object.entries(Lay.HEADERS)) {
    const plan = { x: h.x, y: h.y, w: h.cols * 2.54, d: h.rows * 2.54, r: 0.3 };
    box(id, `header.${name}`, plan, TOP, 2.5, { tone: "mid" }, { bevel: 0 });
    for (let c = 0; c < h.cols; c++) for (let r = 0; r < h.rows; r++) {
      if (name !== "panel" && c === h.cols - 1 && r === 1) continue; // the key position
      const x = plan.x + 0.95 + c * 2.54;
      const y = plan.y + 0.95 + r * 2.54;
      box(id, `header.${name}.pin`, { x, y, w: 0.64, d: 0.64, r: 0.05 }, TOP + 2.5, 5.8, { tone: "hi" }, { steps: 1, bevel: 0 });
    }
    silk(plan, 0.8);
  }
  for (const fan of Lay.FANS) {
    const plan = fan.along === "x" ? { x: fan.x, y: fan.y, w: 10.2, d: 5.8, r: 0.4 } : { x: fan.x, y: fan.y, w: 5.8, d: 10.2, r: 0.4 };
    const tops = [];
    for (let n = 0; n < 4; n++) tops.push(fan.along === "x" ? [plan.x + 1.3 + n * 2.54, plan.y + 3.2] : [plan.x + 3.2, plan.y + 1.3 + n * 2.54]);
    box(id, `fan.${fan.name}`, plan, TOP, 6.4, { tone: "hi" }, { bevel: 0.2, extra: `<path class="board-void" d="${k.planOutline(k.insetPlan(plan, 0.8), TOP + 6.4, P, 2)}"/>` + `<path class="board-pins board-pins-bright" d="${pinsPath(tops, TOP + 6.4)}"/>` });
    silk(plan, 0.8);
  }
  const U = Lay.USB3;
  box(id, "header.usb3", U, TOP, 8.6, { tone: "hi" }, { bevel: 0.3, extra: `<path class="board-void" d="${k.planOutline(k.insetPlan(U, 1), TOP + 8.6, P, 2)}"/>` });
  silk(U, 0.8);
  // The four status LEDs that light in turn while the board checks the processor, memory,
  // graphics and boot device.
  ["cpu", "dram", "vga", "boot"].forEach((name, i) => {
    const [x, y] = Lay.LEDS[i];
    box(id, "led", { x, y, w: 1.6, d: 0.8, r: 0.1 }, TOP, 0.6, { tone: "lo" }, { steps: 1, bevel: 0, extra: `<circle class="board-led" data-led="${name}" cx="${r1(at([x + 0.8, y + 0.4, TOP + 0.6])[0])}" cy="${r1(at([x + 0.8, y + 0.4, TOP + 0.6])[1])}" r="0.9"/>` });
    SILK.push(k.lineOnTop([x + 3, y + 0.4], [x + 6.4, y + 0.4], TOP, P));
  });
}

{
  // The fan and lighting controller, the internal USB hub, and the front USB-C header.
  const id = part("support", 8);
  chip(id, "mcu", Lay.MCU, 0.9);
  chip(id, "hub", Lay.HUB, 0.9, { marking: false });
  const U = Lay.USBC;
  box(id, "header.usbc", U, TOP, 7, { tone: "hi" }, { bevel: 0.3, extra: `<path class="board-void" d="${k.planOutline({ x: U.x + 2.4, y: U.y + 1.6, w: U.w - 4.8, d: U.d - 3.2, r: 0.8 }, TOP + 7, P, 3)}"/>` });
  silk(Lay.MCU, 0.6);
  silk(U, 0.8);
}
{
  // Small resistors and capacitors: a body between two tinned ends.
  for (const cluster of Lay.PASSIVES) {
    const id = part("support", null);
    const shapes = [];
    let svg = "";
    for (const [x, y, along] of cluster) {
      const plan = along === "y" ? { x: x - 0.4, y: y - 0.8, w: 0.8, d: 1.6, r: 0.08 } : { x: x - 0.8, y: y - 0.4, w: 1.6, d: 0.8, r: 0.08 };
      shapes.push(record(A.slab(plan, TOP, 0.5, { name: "passive" }, 1)));
      svg += S(k.slabOf(plan, TOP, 0.5, P, 1, 0), { tone: "mid", crease: "none" });
    }
    const [cx, cy] = cluster[Math.floor(cluster.length / 2)];
    put(id, "passives", [cx, cy, TOP + 0.25], svg, shapes);
  }
}

// --- 10. Power connectors, rear I/O, heatsinks ---------------------------------------------------
{
  const id = part("connectors", 9);
  const A24 = Lay.ATX24;
  const pins = [];
  for (let i = 0; i < 12; i++) for (const x of [A24.x + 2.6, A24.x + 7.8]) pins.push([x, A24.y + 3.5 + i * 4.2]);
  const sq = ([x, y]) => onTop([[x - 1.6, y - 1.6], [x + 1.6, y - 1.6], [x + 1.6, y + 1.6], [x - 1.6, y + 1.6]], TOP + 12.8, true);
  box(id, "atx24", A24, TOP, 12.8, { tone: "hi" }, { extra: `<path class="board-void" d="${pins.map(sq).join("")}"/>` + L(pins.map(sq).join(""), { tone: "lo" }), attrs: `data-glow="5vsb 12v 5v 3v3"` });
  box(id, "atx24.latch", { x: A24.x + A24.w, y: A24.y + A24.d / 2 - 2.4, w: 1.4, d: 4.8, r: 0.3 }, TOP + 6, 6.8, { tone: "mid" }, { steps: 1 });
  silk(A24);
}
{
  const id = part("connectors", 9);
  for (const port of Lay.REAR) {
    const plan = { x: port.x, y: port.y, w: port.w, d: port.d, r: 0.4 };
    const z = TOP + port.h;
    // Seams round each shell, and the spring tabs on the USB shells' tops.
    const seams = port.kind === "usb" || port.kind === "usbc" ? [TOP + port.h / 2] : port.kind === "lan" ? [TOP + 13, TOP + 15.4] : [];
    const inner = L(seams.map((h) => k.sideSeam(plan, h, P, 2)).join(""), { tone: "lo" });
    const tabs = port.kind === "usb" ? Dots([[4, port.y + 3], [4, port.y + port.d - 3], [10, port.y + 3], [10, port.y + port.d - 3]].map(([x, y]) => at([x, y, z])), { size: 0.45, tone: "lo" }) : "";
    const tone = "hi";
    const lines = port.kind === "audio" ? L([0, 1, 2, 3, 4].map((n) => k.sideSeam({ ...plan, y: plan.y }, TOP + 4 + n * 4, P, 2)).join(""), { tone: "faint" }) : "";
    box(id, `rear.${port.kind}`, plan, TOP, port.h, { tone }, { bevel: 0.4, inner: inner + lines, extra: tabs + L(k.planOutline(k.insetPlan(plan, 1.4), z, P, 2), { tone: "faint" }) });
  }
}
{
  // Heatsinks: a thermal pad, a machined base and fins, over each bank of power stages; a low
  // finned plate over the chipset.
  // Fins run across each bank, like a comb, on a solid machined base.
  const fins = (id, name, base, stack, count) => {
    box(id, `${name}.pad`, k.insetPlan(base, 0.6), TOP + 0.9, 0.7, { tone: "lo" }, { bevel: 0 });
    const z0 = TOP + 1.6;
    box(id, `${name}.base`, base, z0, 11, { tone: "hi" }, { steps: 3, bevel: 0.4 });
    const pitch = (stack === "y" ? base.d : base.w) / count;
    for (let i = 0; i < count; i++) {
      const plan = stack === "y" ? { x: base.x + 0.6, y: base.y + i * pitch + pitch * 0.22, w: base.w - 1.2, d: pitch * 0.56, r: 0.3 } : { x: base.x + i * pitch + pitch * 0.22, y: base.y + 0.6, w: pitch * 0.56, d: base.d - 1.2, r: 0.3 };
      box(id, `${name}.fin`, plan, z0 + 11, 8, { tone: "hi" }, { steps: 1, bevel: 0 });
    }
  };
  fins(part("connectors", 3), "heatsink.left", Lay.HEATSINK.left, "y", 11);
  fins(part("connectors", 3), "heatsink.top", Lay.HEATSINK.top, "x", 9);
  const id = part("connectors", 5);
  const H = Lay.CHIPSET.heatsink;
  box(id, "heatsink.chipset.pad", { x: H.x + 10, y: H.y + 10, w: 24, d: 24, r: 0.5 }, TOP + 2.1, 0.5, { tone: "lo" }, { bevel: 0 });
  // The plate stands on four posts at its corners, clear of the chipset's capacitors.
  for (const [x, y] of k.corners(H, 3)) cyl(id, "heatsink.chipset.post", x, y, 1.8, TOP, 2.6, { tone: "mid" }, { steps: 12 });
  const grooves = [];
  for (let i = 1; i < 8; i++) grooves.push(k.planOutline({ x: H.x + 4, y: H.y + i * 5.5 - 0.6, w: H.w - 8, d: 1.2, r: 0.6 }, TOP + 11.6, P, 2));
  box(id, "heatsink.chipset", H, TOP + 2.6, 9, { tone: "hi" }, { steps: 6, bevel: 0.6, extra: L(grooves.join(""), { tone: "faint" }) });
}

// --- Labels -------------------------------------------------------------------------------------
// The labels stand in a ring round the board: each on an ellipse about the drawing's centre, at the
// end of a leader that runs out from a point on its part like a spoke. Labels take evenly spaced
// places round the ring in the order of their anchors' angles; any two leaders that still cross
// swap places (which always shortens them), until none do. The words live in index.html, in the
// order of the build.
function labelsOf() {
  const anchors = [
    [6, 230, TOP],
    [100, 120, TOP],
    [Lay.SOCKET.cx, Lay.SOCKET.cy, TOP + 5],
    [37, 70, TOP + 7],
    [Lay.DIMM.slots[3].x + 3, 60, TOP + 30],
    [Lay.CHIPSET.heatsink.x + 22, Lay.CHIPSET.heatsink.y + 22, TOP + 11.6],
    [100, Lay.M2.drive.y + 11, TOP + 4.5],
    [Lay.CLOCK.crystal.x + 2.5, Lay.CLOCK.crystal.y + 1.6, TOP + 1.1],
    [Lay.CMOS.cx, Lay.CMOS.cy, TOP + 4],
    [6, 60, TOP + 15.6],
  ].map((point) => at(point));
  const centre = [WIDTH / 2, HEIGHT / 2];
  const RING = [286, 246];
  const TAU = Math.PI * 2;
  const angleOf = ([x, y]) => Math.atan2((y - centre[1]) / RING[1], (x - centre[0]) / RING[0]);
  const order = anchors.map((point, i) => ({ i, angle: angleOf(point) })).sort((a, b) => a.angle - b.angle);
  const step = TAU / order.length;
  const offsets = order.map(({ angle }, n) => angle - n * step);
  const base = Math.atan2(offsets.reduce((s, a) => s + Math.sin(a), 0), offsets.reduce((s, a) => s + Math.cos(a), 0));
  const slots = order.map((_, n) => base + n * step);
  const slotOf = [];
  order.forEach(({ i }, n) => (slotOf[i] = n));
  const endOf = (n) => [centre[0] + RING[0] * Math.cos(slots[n]), centre[1] + RING[1] * Math.sin(slots[n])];
  const crosses = (a, b, c, d) => {
    const side = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
    return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
  };
  for (let changed = true, rounds = 0; changed && rounds < 100; rounds++) {
    changed = false;
    for (let i = 0; i < anchors.length; i++)
      for (let j = i + 1; j < anchors.length; j++)
        if (crosses(anchors[i], endOf(slotOf[i]), anchors[j], endOf(slotOf[j]))) {
          [slotOf[i], slotOf[j]] = [slotOf[j], slotOf[i]];
          changed = true;
        }
  }
  return anchors.map((anchor, i) => {
    const angle = slots[slotOf[i]];
    return { anchor: anchor.map(r1), end: endOf(slotOf[i]).map(r1), out: [+Math.cos(angle).toFixed(3), +Math.sin(angle).toFixed(3)] };
  });
}

// --- Order and output -----------------------------------------------------------------------------
SILK.later();
A.settle(R, P);
R.items.sort((a, b) => a.key - b.key);
A.auditOrExit(R, P, {});

const ranked = [...parts].sort((a, b) => a.stage - b.stage || a.id - b.id);
ranked.forEach((p, rank) => (p.rank = rank));
const loadCount = parts.filter((p) => p.stage < LOAD_STAGES).length;
const tag = (id) => `data-build="${parts[id].rank}" data-stage="${parts[id].stage}"${parts[id].label === null ? "" : ` data-label="${parts[id].label}"`}`;

// Neighbouring items of one part share one <g>.
const groups = [];
for (const item of [...back.map((b) => ({ part: b.id, svg: b.svg })), ...R.items]) {
  const last = groups[groups.length - 1];
  if (last && last.part === item.part && item.part !== null) last.svg += item.svg;
  else groups.push({ part: item.part, svg: item.svg });
}
// The screentone the solder mask is printed in: fine dots in screen space, as on a printed page.
const tone = `<defs><pattern id="board-tone" width="2.6" height="2.6" patternUnits="userSpaceOnUse"><rect class="board-tone-ground" width="2.6" height="2.6"/><circle class="board-tone-dot" cx="1.3" cy="1.3" r="0.45"/></pattern></defs>`;
const body = tone + groups.map((g) => (g.part === null ? g.svg : `<g ${tag(g.part)}>${g.svg}</g>`)).join("");

// The board's own box in the viewBox, for narrow screens, which crop to it and drop the ring.
const extent = [...k.boxCorners(TRAY, -12, 0), [Lay.DIMM.slots[0].x, 18, TOP + 36], [0, 12, TOP + 24]].map(at);
const xs = extent.map((p) => p[0]);
const ys = extent.map((p) => p[1]);
const boardBox = [Math.min(...xs) - 4, Math.min(...ys) - 4, Math.max(...xs) - Math.min(...xs) + 8, Math.max(...ys) - Math.min(...ys) + 8].map(r1);

const data = {
  parts: parts.length,
  load: loadCount,
  stages: STAGES,
  drop: k.axisVector(P, [0, 0, 1]),
  labels: labelsOf(),
  boardBox,
};

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  className: "board-svg",
  label: `An isometric drawing of a representative AM5 ATX motherboard with a B650 chipset, on a bench tray: six copper layers with the solder mask and silkscreen, the processor in its socket, fourteen regulator phases, two DDR5 modules in four slots, the chipset, three PCIe slots, an M.2 drive, SATA ports, the firmware flash, CMOS battery, clock, Super I/O, headers, the 24-pin and 8-pin power connectors, the rear ports and heatsinks. Memory peaks at ${memoryGBps().toFixed(1)} GB/s across ${BOARD.memory.channels} channels.`,
  body,
});

const markup = `${compact(svg)}\n          <script type="application/json" data-board-data>${JSON.stringify(data)}</script>`;
const indexPath = join(ROOT, "index.html");
const html = readFileSync(indexPath, "utf8");
const start = "<!-- board:start -->";
const end = "<!-- board:end -->";
const from = html.indexOf(start);
const to = html.indexOf(end);
if (from < 0 || to < 0) throw new Error("index.html has no board:start / board:end markers");
writeFileSync(indexPath, html.slice(0, from + start.length) + "\n          " + markup + "\n          " + html.slice(to));
console.log(`wrote ${parts.length} parts (${loadCount} on load), ${R.items.length} items, into index.html, ${(markup.length / 1024).toFixed(0)} KB`);
