import { test } from "node:test";
import assert from "node:assert/strict";
import { hallLineStyle, pinStyle, quantOpacity, quantPx } from "./layers";

test("quantOpacity: 0.01 steps; quantPx: 0.5 px steps", () => {
  assert.equal(quantOpacity(0.123), 0.12);
  assert.equal(quantOpacity(0.996), 1);
  assert.equal(quantOpacity(0.004), 0);
  assert.equal(quantPx(3.2), 3);
  assert.equal(quantPx(3.3), 3.5);
  assert.equal(quantPx(-0.2), 0);
});

test("pinStyle: a resting visible pin has no transform; a rising one a 2D translate", () => {
  assert.deepEqual(pinStyle(1, 18, false, false), { opacity: "1", transform: "none" });
  assert.deepEqual(pinStyle(0.5, 18, false, false), { opacity: "0.5", transform: "translate(0px, 9px)" });
  assert.deepEqual(pinStyle(0, 18, false, false), { opacity: "0", transform: "translate(0px, 18px)" });
  // reduced motion: never moves
  assert.deepEqual(pinStyle(0.5, 18, false, true), { opacity: "0.5", transform: "none" });
});

test("pinStyle: a scrim pin writes opacity only", () => {
  assert.deepEqual(pinStyle(0.5, 0, true, false), { opacity: "0.5", transform: null });
  assert.deepEqual(pinStyle(1, 18, true, false), { opacity: "1", transform: null });
});

test("pinStyle: a tiny change of opacity writes nothing new", () => {
  assert.deepEqual(pinStyle(0.5012, 18, false, false), pinStyle(0.4991, 18, false, false));
});

test("hallLineStyle: kept lines brighten, lift and catch the accent past half the compress", () => {
  assert.deepEqual(hallLineStyle(true, 0, false), { opacity: "0.55", transform: "none", lit: false });
  assert.deepEqual(hallLineStyle(true, 1, false), { opacity: "1", transform: "translate3d(0px, 0px, 14px)", lit: true });
  assert.deepEqual(hallLineStyle(true, 0.5, false).lit, false);
  assert.deepEqual(hallLineStyle(true, 0.51, false).lit, true);
  assert.deepEqual(hallLineStyle(false, 0, false), { opacity: "0.55", transform: "none", lit: false });
  assert.deepEqual(hallLineStyle(false, 1, false), { opacity: "0", transform: "none", lit: false });
  assert.deepEqual(hallLineStyle(true, 1, true), { opacity: "1", transform: "none", lit: true });
});
