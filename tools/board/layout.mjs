/**
 * Where everything sits on the hero motherboard, in millimetres. x runs across the board from the
 * rear edge (where the I/O ports are, x = 0) to the front edge (x = 244); y runs down from the top
 * edge (y = 0, by the CPU power connector) to the bottom edge (y = 305, by the front-panel header);
 * z is up from the bench tray the board stands on.
 *
 * The board is a representative AM5 / B650 ATX layout drawn for the site, not a copy of any
 * commercial board: the outline, slot pitch, socket, module and connector sizes are the standard
 * ones, and the placement follows how such boards are usually laid out.
 */
import { BOARD } from "../../js/board-model.js";

export const W = BOARD.atx.w; // 244
export const D = BOARD.atx.d; // 305
export const PCB = { x: 0, y: 0, w: W, d: D, r: 1.5 };

// Heights. The six copper layers (with the glass-fibre between them) are drawn as six sheets, then
// the solder mask; the stack is drawn about twice its real 1.6 mm so its edge reads.
export const Z = { tray: 0, standoff: 6.4, sheet: 0.5, mask: 0.2 };
Z.top = Z.standoff + BOARD.atx.layers * Z.sheet + Z.mask; // 9.6, where every part is soldered
export const TOP = Z.top;
export const LAYERS = ["L6", "L5", "L4", "L3", "L2", "L1"]; // bottom up

// The steel bench tray, on rubber feet, with brass standoffs under the board's nine ATX holes.
export const TRAY = { x: -18, y: -16, w: W + 36, d: D + 32, r: 6 };
export const HOLES = [
  [6.4, 10.2], [157.5, 10.2], [238, 10.2],
  [6.4, 165], [157.5, 165], [238, 165],
  [6.4, 295], [157.5, 295], [238, 295],
];

// AM5 socket (LGA1718): the processor package is 40 x 40 mm.
export const SOCKET = { cx: 88, cy: 80 };
export const PACKAGE = { x: SOCKET.cx - 20, y: SOCKET.cy - 20, w: 40, d: 40, r: 0.6 };
export const CAVITY = { x: SOCKET.cx - 21, y: SOCKET.cy - 21, w: 42, d: 42 };
export const HOUSING = { x: SOCKET.cx - 24, y: SOCKET.cy - 24, w: 48, d: 48 };
export const FRAME = { x: SOCKET.cx - 29, y: SOCKET.cy - 30, w: 58, d: 61 }; // the loading mechanism's stiffener
export const COOLER_HOLES = [[-27, -45], [27, -45], [-27, 45], [27, 45]].map(([dx, dy]) => [SOCKET.cx + dx, SOCKET.cy + dy]); // 54 x 90, as AM4

// The processor's regulators: eight phases down the left of the socket and six along the top (twelve
// core phases and two for the SoC rail). Each phase is a power stage under the heatsink and a choke.
export const VRM = {
  left: Array.from({ length: 8 }, (_, i) => ({ stage: { x: 22, y: 36 + i * 9.6, w: 6, d: 5, r: 0.3 }, choke: { x: 32, y: 34 + i * 9.6, w: 10, d: 9, r: 1 } })),
  top: Array.from({ length: 6 }, (_, j) => ({ stage: { x: 57 + j * 10.4, y: 12, w: 6, d: 5, r: 0.3 }, choke: { x: 55.5 + j * 10.4, y: 21, w: 9, d: 10, r: 1 } })),
  controller: { x: 30, y: 116, w: 6, d: 6, r: 0.3 },
  input: [[35, 20], [43.5, 20], [35, 28.5]],
};
export const EPS = { x: 17, y: 1, w: 19.4, d: 9.6, r: 0.6 }; // 8-pin, 2 x 4 at 4.2 mm
export const HEATSINK = {
  left: { x: 19, y: 32, w: 12, d: 80, r: 1.2 },
  top: { x: 53, y: 9.4, w: 66, d: 10.6, r: 1.2 },
};

// Four DDR5 slots, channel A then B, two DIMMs per channel; modules in A2 and B2.
export const DIMM = {
  slots: ["A1", "A2", "B1", "B2"].map((name, i) => ({ name, x: 152 + i * 9.6, y: 18, w: 6.4, d: 140 })),
  filled: [1, 3],
  module: { y: 90 - 133.35 / 2, d: 133.35, h: 31.25, t: 1.3 }, // centred on the slot's floor
};

export const ATX24 = { x: 231, y: 92, w: 10.4, d: 53, r: 0.6 }; // 2 x 12 at 4.2 mm

// PCIe slots at the ATX 20.32 mm pitch: x16 from the processor, x1 and x16 (wired x4) from the chipset.
export const SLOTS = [
  { name: "PCIE1", x: 40, y: 172, w: 89, d: 7.6, armour: true },
  { name: "PCIE2", x: 40, y: 212.6, w: 25, d: 7.6 },
  { name: "PCIE3", x: 40, y: 253.3, w: 89, d: 7.6 },
];

// M.2 2280 from the processor: connector, then a 22 x 80 mm drive held by a standoff and screw.
export const M2 = { connector: { x: 45, y: 138, w: 6, d: 22, r: 0.4, h: 2.4 }, drive: { x: 49, y: 138, w: 80, d: 22, r: 0.6 }, standoff: [129.6, 149] };
// A second M.2 slot from the chipset, left empty: its connector and the standoff positions for
// 42, 60 and 80 mm drives.
export const M2B = { connector: { x: 45, y: 228, w: 6, d: 22, r: 0.4, h: 2.4 }, holes: [91, 109, 129.6].map((x) => [x, 239]) };

export const CHIPSET = { pkg: { x: 179.5, y: 214.5, w: 21, d: 21, r: 0.6 }, heatsink: { x: 168, y: 203, w: 44, d: 44, r: 2 } };
export const SATA = [{ x: 228, y: 196, w: 15, d: 12, r: 0.5 }, { x: 228, y: 211, w: 15, d: 12, r: 0.5 }];
export const CMOS = { cx: 152, cy: 236, r: 10 };
export const FLASH = { x: 172, y: 279, w: 5.3, d: 5.3, r: 0.3 }; // 256 Mbit SPI NOR, SOIC-8
export const SUPERIO = { x: 113, y: 275, w: 14, d: 14, r: 0.3 };
export const CLOCK = { chip: { x: 122, y: 118, w: 6, d: 6, r: 0.3 }, crystal: { x: 131, y: 119.4, w: 5, d: 3.2, r: 0.4 } };
export const LAN = { x: 25, y: 145, w: 8, d: 8, r: 0.3 }; // 2.5 GbE controller
export const AUDIO = { codec: { x: 18, y: 270, w: 7, d: 7, r: 0.3 }, caps: [[32, 266], [38, 266], [44, 266], [32, 286], [38, 286], [44, 286]] };
export const LEDS = Array.from({ length: 4 }, (_, i) => [221, 60 + i * 6]); // CPU, DRAM, VGA, BOOT

// Pin headers along the edges: 2.54 mm pitch.
export const HEADERS = {
  panel: { x: 214, y: 293, cols: 5, rows: 2 },
  usb2a: { x: 100, y: 293, cols: 5, rows: 2 },
  usb2b: { x: 84, y: 293, cols: 5, rows: 2 },
  audio: { x: 12, y: 293, cols: 5, rows: 2 },
  tpm: { x: 64, y: 293, cols: 7, rows: 2 },
  rgb: { x: 196, y: 4, cols: 4, rows: 1 },
  argb: { x: 208, y: 4, cols: 3, rows: 1 },
  jbat: { x: 166, y: 262, cols: 2, rows: 1 },
};
export const FANS = [
  { name: "CPU_FAN", x: 122, y: 3, along: "x" },
  { name: "SYS_FAN1", x: 236, y: 22, along: "y" },
  { name: "SYS_FAN2", x: 190, y: 294, along: "x" },
];
export const USB3 = { x: 232, y: 173, w: 9, d: 16, r: 0.5 }; // 19-pin front USB header
export const USBC = { x: 233, y: 149, w: 8, d: 10, r: 0.5 }; // front USB-C header
export const MCU = { x: 204, y: 96, w: 7, d: 7, r: 0.3 }; // fan and lighting controller
export const HUB = { x: 214, y: 257, w: 5, d: 5, r: 0.3 }; // USB 2.0 hub for the internal headers

// Small resistors and capacitors (0603, 1.6 x 0.8 mm) where they cluster on a real board: beside the
// memory slots, under the chipset, round the network, Super I/O, regulator controller, clock and audio.
const row = (x, y, n, dx, dy, along = "x") => Array.from({ length: n }, (_, i) => [x + i * dx, y + i * dy, along]);
export const PASSIVES = [
  [...row(191, 26, 16, 0, 8, "y"), ...row(194.4, 30, 16, 0, 8, "y")],
  row(186, 250, 8, 3.2, 0),
  [...row(23, 156, 4, 2.8, 0), ...row(23, 159, 4, 2.8, 0)],
  row(130, 276, 5, 0, 2.8, "y"),
  row(30, 125, 4, 2.6, 0),
  [...row(122, 126, 3, 2.6, 0), ...row(138.5, 118.5, 3, 0, 2.2, "y")],
  [...row(16, 280, 4, 2.6, 0), ...row(27, 270, 3, 0, 2.4, "y")],
  row(53, 132, 4, 2.6, 0),
  row(206, 106, 4, 2.4, 0),
];

// The rear I/O stack, top to bottom, overhanging the rear edge by 3 mm.
export const REAR = [
  { kind: "buttons", y: 12, d: 8, h: 6 },
  { kind: "usb", y: 22, d: 14.5, h: 15.6 },
  { kind: "usb", y: 38.5, d: 14.5, h: 15.6 },
  { kind: "video", y: 55, d: 15, h: 13 },
  { kind: "usb", y: 72, d: 14.5, h: 15.6 },
  { kind: "lan", y: 88.5, d: 16.5, h: 24 },
  { kind: "usbc", y: 107, d: 14.5, h: 15 },
  { kind: "audio", y: 123.5, d: 31, h: 22 },
].map((port) => ({ ...port, x: -3, w: 18 }));
