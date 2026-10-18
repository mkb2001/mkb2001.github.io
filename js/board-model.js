/**
 * The numbers behind the hero board: a representative AM5 / B650 ATX motherboard. Shared by the
 * build script (tools/board/build.mjs) and the live figure (js/board.js), so what the readout says
 * is what the drawing shows. The figures are the platform's published ones (PCIe, DDR5, ATX power);
 * the regulator values are typical of a B650 board, and the model is an ideal buck converter, not a
 * circuit simulation.
 */
export const BOARD = {
  atx: { w: 244, d: 305, layers: 6, thickness: 1.6 }, // mm: 9.6 x 12 in, six copper layers
  pcie: {
    gpu: { gen: 4, lanes: 16 }, // the x16 slot, from the processor (B650 runs it at 4.0)
    m2: { gen: 5, lanes: 4 }, // the first M.2 slot, from the processor
    chipset: { gen: 4, lanes: 4 }, // the link from the processor to the B650 chipset
  },
  memory: { channels: 2, busBits: 64, mts: 5200, slots: 4, modules: 2 }, // DDR5, modules in A2 and B2
  vrm: { phases: 12, ampsPerStage: 60, vin: 12, vout: 1.1, fswKHz: 500, nH: 150 }, // the processor's core rail
  eps: { pins12V: 4, ampsPerPin: 7 }, // the 8-pin CPU connector: four 12 V pins and four grounds
};

const GT_PER_SECOND = { 3: 8, 4: 16, 5: 32 };

/** PCIe bandwidth one way in GB/s: 128b/130b encoding on every lane. */
export const pcieGBps = ({ gen, lanes }) => (lanes * GT_PER_SECOND[gen] * (128 / 130)) / 8;

/** Peak memory bandwidth in GB/s across both channels. */
export const memoryGBps = ({ channels, busBits, mts } = BOARD.memory) => (channels * (busBits / 8) * mts) / 1000;

/** The share of each switching period an ideal buck converter's high-side switch is on. */
export const dutyCycle = ({ vin, vout } = BOARD.vrm) => vout / vin;

/** Peak-to-peak ripple in one phase's inductor current, in amps: (Vin - Vout) D / (L f). */
export const rippleAmps = (vrm = BOARD.vrm) => ((vrm.vin - vrm.vout) * dutyCycle(vrm)) / (vrm.nH * 1e-9 * vrm.fswKHz * 1e3);

/** Most current the core phases are rated for, and the power the EPS connector is rated to carry. */
export const vrmAmps = ({ phases, ampsPerStage } = BOARD.vrm) => phases * ampsPerStage;
export const epsWatts = ({ pins12V, ampsPerPin } = BOARD.eps) => pins12V * ampsPerPin * 12;

/**
 * The power-on, simplified from ATX and AMD platform behaviour. Each step adds the nets that come
 * up and stay up (`adds`), and may carry nets that are only active during it (`pulse`). Net names:
 * 5vsb standby, pwrbtn the front-panel switch, pson PS_ON#, 12v / 5v / 3v3 the main rails, pwrok
 * PWR_OK, vcore / vsoc the processor's rails, vdimm the modules' own regulators, clock the reference
 * clocks, spi the firmware read, ddr memory traffic, pcie the slots and the chipset link.
 */
export const BOOT = [
  { id: "off", say: "Off · the supply is switched off" },
  { id: "standby", adds: ["5vsb"], say: "Standby · 5 V standby on the 24-pin" },
  { id: "button", pulse: ["pwrbtn"], say: "Power button · Super I/O sees PWRBTN#" },
  { id: "pson", adds: ["pson"], say: "PS_ON# pulled low · the supply starts" },
  { id: "rails", adds: ["12v", "5v", "3v3"], say: "Main rails up · 12 V, 5 V and 3.3 V" },
  { id: "pwrok", adds: ["pwrok"], say: "PWR_OK high · rails in regulation" },
  { id: "vrm", adds: ["vcore", "vsoc", "vdimm"], say: "Regulators up · core about 1.1 V" },
  { id: "reset", adds: ["clock"], say: "Clocks running · reset released" },
  { id: "firmware", pulse: ["spi"], say: "Firmware read from the SPI flash" },
  { id: "training", adds: ["ddr"], say: "Memory training · DDR5-5200" },
  { id: "enumerate", adds: ["pcie"], say: "PCIe found · x16, NVMe, chipset" },
  { id: "running", say: "Running" },
];

/** The step of the power-on at a share (0 to 1) of its stretch of scroll. */
export const bootStepAt = (share) => Math.min(BOOT.length - 1, Math.floor(Math.min(1, Math.max(0, share)) * BOOT.length));

/** The nets live at step i: everything added up to and including it, plus its own pulses. */
export function liveAt(i) {
  const live = [];
  for (let j = 0; j <= i; j++) live.push(...(BOOT[j].adds ?? []));
  live.push(...(BOOT[i].pulse ?? []));
  return live;
}
