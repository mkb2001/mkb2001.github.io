/**
 * The board's copper, in board millimetres (see layout.mjs). Each layer is a set of trace polylines,
 * filled planes and clearance holes; the nets are the routes the power-on lights, each tagged with
 * the net names in js/board-model.js.
 *
 * The routing is an educational model: it follows the board's real architecture (which device each
 * bus runs between, wide planes for power, tight pairs for PCIe, buses for DDR5), not a
 * signal-integrity checked layout.
 */
import { SOCKET, DIMM, SLOTS, M2, CHIPSET, SATA, FLASH, SUPERIO, CLOCK, LAN, AUDIO, ATX24, EPS, VRM, HEADERS, W, D, REAR } from "./layout.mjs";

/** A polyline moved sideways by d (to the left of its direction), with mitred corners. */
export function offsetLine(points, d) {
  const normal = ([ax, ay], [bx, by]) => {
    const l = Math.hypot(bx - ax, by - ay) || 1;
    return [-(by - ay) / l, (bx - ax) / l];
  };
  return points.map((p, i) => {
    const a = i > 0 ? normal(points[i - 1], p) : null;
    const b = i < points.length - 1 ? normal(p, points[i + 1]) : null;
    if (!a || !b) {
      const n = a ?? b;
      return [p[0] + n[0] * d, p[1] + n[1] * d];
    }
    const m = [a[0] + b[0], a[1] + b[1]];
    const scale = d / (1 + a[0] * b[0] + a[1] * b[1]);
    return [p[0] + m[0] * scale, p[1] + m[1] * scale];
  });
}

/** count parallel traces along a centre line. With pairs, they come in differential pairs. */
export function bus(centre, count, pitch, { pairs = false, gap = pitch * 0.45 } = {}) {
  const offsets = [];
  if (pairs) {
    const n = count / 2;
    for (let i = 0; i < n; i++) {
      const c = (i - (n - 1) / 2) * pitch;
      offsets.push(c - gap / 2, c + gap / 2);
    }
  } else for (let i = 0; i < count; i++) offsets.push((i - (count - 1) / 2) * pitch);
  return offsets.map((d) => offsetLine(centre, d));
}

const rect = (x, y, w, d) => [[x, y], [x + w, y], [x + w, y + d], [x, y + d]];
const grid = (x, y, cols, rows, pitch) => {
  const out = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push([x + c * pitch, y + r * pitch]);
  return out;
};
const slotPins = ({ x, y, w, d }, along = "x", pitch = 1.6) => {
  const out = [];
  if (along === "x") for (let t = x + 1.2; t < x + w - 1; t += pitch) out.push([t, y + 1.6], [t, y + d - 1.6]);
  else for (let t = y + 1.2; t < y + d - 1; t += pitch) out.push([x + 1.6, t], [x + w - 1.6, t]);
  return out;
};

// --- Buses ------------------------------------------------------------------------------------
const S = SOCKET;
const ddrA = [[S.cx + 18, 58], [126, 58], [132, 52], [DIMM.slots[1].x + 3.2, 52]];
const ddrB = [[S.cx + 18, 92], [126, 92], [132, 98], [DIMM.slots[3].x + 3.2, 98]];
const gpu = [[S.cx + 4, S.cy + 22], [S.cx + 4, 124], [S.cx - 2, 130], [S.cx - 2, SLOTS[0].y + 1]];
const m2 = [[S.cx - 22, S.cy + 22], [S.cx - 22, S.cy + 28], [S.cx - 36, S.cy + 42], [M2.connector.x + 3, S.cy + 46], [M2.connector.x + 3, M2.connector.y + 2]];
const link = [[S.cx + 20, S.cy + 22], [S.cx + 32, S.cy + 34], [S.cx + 32, 130], [146, 156], [146, 190], [170, 214], [CHIPSET.pkg.x + 1, 214]];
// On the top layer the link only surfaces past the slots, from a row of vias to the chipset.
const linkTop = [[146, 172], [146, 190], [170, 214], [CHIPSET.pkg.x + 1, 214]];
const sata = [[CHIPSET.pkg.x + CHIPSET.pkg.w - 1, 220], [214, 220], [218, 216], [SATA[1].x + 1, 216]];
const slot3 = [[CHIPSET.pkg.x + 2, CHIPSET.pkg.y + CHIPSET.pkg.d - 1], [CHIPSET.pkg.x + 2, 246], [168, 252], [SLOTS[2].x + SLOTS[2].w - 1, 252]];
const slot2 = [[CHIPSET.pkg.x + 1, 228], [172, 228], [166, 222], [SLOTS[1].x + SLOTS[1].w - 1, 222]];
const usbRear = [[S.cx - 26, S.cy - 10], [52, S.cy - 10], [46, S.cy - 4], [14, S.cy - 4]];
const lan = [[CHIPSET.pkg.x + 1, 231], [168, 231]];

// --- Layers -----------------------------------------------------------------------------------
// The ground planes are poured over the whole board, pulled back 1.2 mm from the edge, with a
// clearance hole round every pin and via that passes through them.
const outline = rect(1.2, 1.2, W - 2.4, D - 2.4);
const socketField = grid(S.cx - 19, S.cy - 19, 20, 20, 2);
const dimmPins = DIMM.slots.flatMap((slot) => slotPins(slot, "y", 3.2));
const slotHoles = SLOTS.flatMap((slot) => slotPins(slot, "x", 3.2));

export const LAYER = {
  L6: {
    note: "Bottom signal layer: low-speed routes and the pads for the capacitors behind the socket",
    lines: [
      ...bus([[190, 236], [190, 266], [170, 286], [108, 286]], 6, 1.1),
      ...bus([[SUPERIO.x + 14, 282], [206, 282], [216, 292]], 4, 1.1),
      ...bus([[30, 160], [30, 250], [22, 262]], 4, 1.1),
      ...bus([[236, 40], [236, 86]], 3, 1.2),
    ],
    pads: grid(S.cx - 12, S.cy - 12, 7, 7, 4).map(([x, y]) => rect(x - 0.9, y - 0.5, 1.8, 1)),
  },
  L5: { note: "Ground plane", pours: [outline], holes: [...socketField, ...dimmPins] },
  L4: {
    note: "Power planes: the core and SoC rails under the socket, 12 V from the CPU connector, 5 V and 3.3 V from the 24-pin",
    pours: [
      [[44, 30], [124, 30], [124, 42], [118, 42], [118, 108], [56, 108], [56, 112], [44, 112]], // VDDCR (core)
      [[126, 30], [134, 30], [134, 44], [126, 44]], // VDDCR_SOC, beside the top bank
      [[14, 2], [52, 2], [52, 8], [120, 8], [120, 19], [20, 19], [20, 112], [14, 112]], // 12 V
      [[200, 88], [242, 88], [242, 150], [200, 150]], // 5 V
      [[40, 134], [136, 134], [136, 164], [40, 164]], // 3.3 V to the M.2 and slots
      [[166, 200], [214, 200], [214, 250], [166, 250]], // chipset rails
    ],
  },
  L3: {
    note: "Inner signal layer: DDR5 to all four slots, the PCIe lanes and the chipset link, between two ground planes",
    lines: [
      ...DIMM.slots.flatMap((slot) => bus([[slot.x + 3.2, 24], [slot.x + 3.2, 152]], 4, 1.2)),
      ...bus(gpu, 24, 1.3, { pairs: true }),
      ...bus(link, 8, 1.2, { pairs: true }),
      ...bus(usbRear, 8, 1.1, { pairs: true }),
      ...bus(sata, 8, 1.2, { pairs: true }),
      ...bus([[CHIPSET.pkg.x + 2, CHIPSET.pkg.y + 1], [CHIPSET.pkg.x + 2, 190], [120, 190], [40, 190], [LAN.x + 4, 160], [LAN.x + 4, LAN.y + 8]], 4, 1.1, { pairs: true }),
    ],
  },
  L2: { note: "Ground plane under the top layer", pours: [outline], holes: [...socketField, ...slotHoles] },
};

// The top layer, drawn in stage 2: the fan-out from the socket to the slots, the PCIe pairs, the
// chipset's buses, and the copper pours that carry power to the regulators and the 24-pin.
export const TOP_LAYER = {
  lines: [
    ...bus(ddrA, 16, 0.95),
    ...bus(ddrB, 16, 0.95),
    ...bus(gpu, 32, 0.95, { pairs: true }),
    ...bus(m2, 8, 0.95, { pairs: true }),
    ...bus(linkTop, 8, 0.95, { pairs: true }),
    ...bus(sata, 8, 0.95, { pairs: true }),
    ...bus(slot3, 8, 0.95, { pairs: true }),
    ...bus(slot2, 2, 0.95, { pairs: true }),
    ...bus(lan, 4, 0.95, { pairs: true }),
    ...bus([[CLOCK.chip.x, CLOCK.chip.y + 3], [S.cx + 24, CLOCK.chip.y + 3], [S.cx + 20, S.cy + 22]], 2, 0.8),
    ...bus([[FLASH.x + 2.6, FLASH.y], [FLASH.x + 2.6, 262], [166, 250], [166, 236]], 4, 0.9),
    ...bus([[SUPERIO.x + 7, SUPERIO.y], [SUPERIO.x + 7, 262], [128, 256]], 4, 0.9),
    ...bus([[AUDIO.codec.x + 3.5, AUDIO.codec.y], [AUDIO.codec.x + 3.5, 170], [8, 160]], 4, 0.9),
    ...bus([[HEADERS.panel.x + 5, HEADERS.panel.y], [HEADERS.panel.x + 5, 286], [SUPERIO.x + 14, 286]], 3, 0.9),
  ],
  pours: [
    [[EPS.x, EPS.y + EPS.d], [EPS.x + EPS.w, EPS.y + EPS.d], [48, 15], [48, 32], [30, 32], [17, 19]], // 12 V from the CPU connector to the input capacitors
    [[44, 34], [50, 34], [50, 112], [44, 112]], // core rail behind the left chokes
    [[55, 32], [120, 32], [120, 36], [55, 36]], // core rail behind the top chokes
    [[ATX24.x - 6, ATX24.y], [ATX24.x, ATX24.y], [ATX24.x, ATX24.y + ATX24.d], [ATX24.x - 6, ATX24.y + ATX24.d]], // 24-pin rails
  ],
  vias: [
    ...grid(S.cx + 22, 50, 3, 26, 2.1),
    ...grid(S.cx - 14, S.cy + 24, 14, 2, 2.2),
    ...grid(CHIPSET.pkg.x - 3, CHIPSET.pkg.y - 3, 2, 12, 2.4),
    ...grid(46, 38, 2, 34, 2.2),
    ...grid(58, 38.4, 30, 1, 2.1),
    ...grid(ATX24.x - 4, ATX24.y + 3, 2, 22, 2.2),
    ...grid(4, 172, 1, 50, 2.4),
    ...grid(142, 170.4, 4, 1, 2.6),
    ...grid(54, 282, 30, 1, 2.4),
  ],
};

// --- Nets for the power-on --------------------------------------------------------------------
// Each route is drawn on the board under the parts and lit when its net is live (js/board.js).
// kind: power (amber glow along the copper), signal (a pulse that runs along it), clock (ticks).
const at24 = (pin) => {
  // Pins 1-12 run down the outer row, 13-24 down the inner row, both from the top.
  const row = pin <= 12 ? 0 : 1;
  const i = pin <= 12 ? pin - 1 : pin - 13;
  return [ATX24.x + (row ? 2.6 : 7.8), ATX24.y + 3.5 + i * 4.2];
};
export const NETS = [
  { net: "5vsb", kind: "power", points: [at24(9), [224, at24(9)[1]], [224, 270], [SUPERIO.x + 14, 270]] },
  { net: "5vsb", kind: "power", points: [[224, 160], [180, 160], [S.cx + 30, S.cy + 22]] },
  { net: "pwrbtn", kind: "signal", points: [[HEADERS.panel.x + 2, HEADERS.panel.y], [HEADERS.panel.x + 2, 288], [SUPERIO.x + 14, 288]] },
  { net: "pson", kind: "signal", points: [[SUPERIO.x + 14, 279], [228, 279], [228, at24(16)[1]], at24(16)] },
  { net: "12v", kind: "power", points: [[EPS.x + 9.7, EPS.y + EPS.d], [EPS.x + 9.7, 14], [VRM.top[5].stage.x + 6, 14]] },
  { net: "12v", kind: "power", points: [[EPS.x + 9.7, 14], [25, 14], [25, VRM.left[7].stage.y + 5]] },
  { net: "12v", kind: "power", points: [at24(10), [226, at24(10)[1]], [226, 168], [SLOTS[0].x + SLOTS[0].w + 2, 168], [SLOTS[0].x + SLOTS[0].w + 2, SLOTS[0].y]] },
  { net: "5v", kind: "power", points: [at24(4), [ATX24.x - 4, at24(4)[1]], [ATX24.x - 4, ATX24.y + ATX24.d]] },
  { net: "3v3", kind: "power", points: [at24(13), [229, at24(13)[1]], [229, 166], [M2.drive.x + M2.drive.w + 4, 166], [M2.drive.x + M2.drive.w + 4, M2.drive.y + 11]] },
  { net: "pwrok", kind: "signal", points: [at24(8), [222, at24(8)[1]], [222, 156], [186, 156], [S.cx + 32, S.cy + 26]] },
  { net: "vcore", kind: "power", points: [[47, VRM.left[0].choke.y], [47, VRM.left[7].choke.y + 9]] },
  { net: "vcore", kind: "power", points: [[VRM.top[0].choke.x, 34], [VRM.top[3].choke.x + 9, 34]] },
  { net: "vsoc", kind: "power", points: [[VRM.top[4].choke.x, 34], [VRM.top[5].choke.x + 9, 34]] },
  { net: "clock", kind: "clock", points: [[CLOCK.chip.x, CLOCK.chip.y + 3], [S.cx + 24, CLOCK.chip.y + 3], [S.cx + 20, S.cy + 22]] },
  { net: "clock", kind: "clock", points: [[CLOCK.chip.x + 3, CLOCK.chip.y + 6], [CLOCK.chip.x + 3, SLOTS[0].y]] },
  { net: "spi", kind: "signal", points: [[FLASH.x + 2.6, FLASH.y], [FLASH.x + 2.6, 262], [166, 250], [166, 196], [140, 170], [118, 130], [S.cx + 14, S.cy + 22]] },
  { net: "ddr", kind: "signal", points: ddrA },
  { net: "ddr", kind: "signal", points: ddrB },
  { net: "pcie", kind: "signal", points: gpu },
  { net: "pcie", kind: "signal", points: m2 },
  { net: "pcie", kind: "signal", points: link },
  { net: "pcie", kind: "signal", points: sata },
  { net: "pcie", kind: "signal", points: slot3 },
  { net: "pcie", kind: "signal", points: [...usbRear].reverse() },
];

export const REAR_SPAN = [REAR[0].y, REAR[REAR.length - 1].y + REAR[REAR.length - 1].d];
