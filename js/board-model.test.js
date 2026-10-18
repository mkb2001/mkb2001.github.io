import { test } from "node:test";
import assert from "node:assert/strict";
import { BOARD, BOOT, pcieGBps, memoryGBps, dutyCycle, rippleAmps, vrmAmps, epsWatts, bootStepAt, liveAt } from "./board-model.js";

const near = (a, b, within = 0.01) => assert.ok(Math.abs(a - b) < within, `${a} is not within ${within} of ${b}`);

test("the x16 slot carries about 31.5 GB/s each way at PCIe 4.0", () => {
  near(pcieGBps(BOARD.pcie.gpu), 31.51);
});

test("the M.2 slot carries about 15.75 GB/s each way at PCIe 5.0 x4", () => {
  near(pcieGBps(BOARD.pcie.m2), 15.75);
});

test("the chipset link is PCIe 4.0 x4, about 7.88 GB/s each way", () => {
  near(pcieGBps(BOARD.pcie.chipset), 7.88);
});

test("two channels of DDR5-5200 peak at 83.2 GB/s", () => {
  near(memoryGBps(), 83.2, 1e-9);
});

test("an ideal buck from 12 V to 1.1 V switches on 9.2% of the time", () => {
  near(dutyCycle(), 0.0917, 1e-4);
});

test("each phase's inductor current ripples by about 13 A peak to peak", () => {
  near(rippleAmps(), 13.32, 0.01);
});

test("twelve 60 A power stages can deliver 720 A", () => {
  assert.equal(vrmAmps(), 720);
});

test("the 8-pin EPS connector carries 336 W through four 12 V pins", () => {
  assert.equal(epsWatts(), 336);
});

test("the power-on starts off and ends running", () => {
  assert.equal(BOOT[0].id, "off");
  assert.equal(BOOT[BOOT.length - 1].id, "running");
});

test("each share of the power-on scroll maps to one step, in order", () => {
  assert.equal(bootStepAt(0), 0);
  assert.equal(bootStepAt(1), BOOT.length - 1);
  assert.equal(bootStepAt(-0.5), 0);
  assert.equal(bootStepAt(2), BOOT.length - 1);
  let last = 0;
  for (let s = 0; s <= 1; s += 0.01) {
    const step = bootStepAt(s);
    assert.ok(step >= last && step - last <= 1);
    last = step;
  }
});

test("nothing is live until standby, and standby power comes first", () => {
  assert.deepEqual(liveAt(0), []);
  const standby = BOOT.findIndex((s) => s.id === "standby");
  assert.deepEqual(liveAt(standby), ["5vsb"]);
});

test("a rail that has come up stays up for the rest of the power-on", () => {
  const rails = ["5vsb", "12v", "5v", "3v3", "pwrok", "vcore", "vsoc", "vdimm", "clock"];
  for (let i = 1; i < BOOT.length; i++) {
    for (const rail of rails) if (liveAt(i - 1).includes(rail)) assert.ok(liveAt(i).includes(rail), `${rail} drops at ${BOOT[i].id}`);
  }
});

test("the sequence follows ATX: PS_ON#, then the main rails, then PWR_OK, then the CPU regulators", () => {
  const first = (net) => BOOT.findIndex((_, i) => liveAt(i).includes(net));
  assert.ok(first("pson") < first("12v"));
  assert.equal(first("12v"), first("5v"));
  assert.equal(first("12v"), first("3v3"));
  assert.ok(first("12v") < first("pwrok"));
  assert.ok(first("pwrok") < first("vcore"));
  assert.ok(first("vcore") < first("clock"));
  assert.ok(first("clock") < first("spi"));
  assert.ok(first("spi") < first("ddr"));
  assert.ok(first("ddr") < first("pcie"));
});

test("every step has words for the readout", () => {
  for (const step of BOOT) {
    assert.equal(typeof step.say, "string");
    assert.ok(step.say.length > 0 && step.say.length <= 44, `${step.id}: "${step.say}" is ${step.say.length} characters`);
  }
});
