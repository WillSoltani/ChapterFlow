import { test } from "node:test";
import assert from "node:assert/strict";
import { TTS_SPEED_OPTIONS, snapTtsSpeedToOption } from "./tts";

test("TTS_SPEED_OPTIONS is the expected ascending step list", () => {
  assert.deepEqual([...TTS_SPEED_OPTIONS], [0.75, 1, 1.25, 1.5, 2]);
});

test("snapTtsSpeedToOption returns an exact option unchanged", () => {
  for (const opt of TTS_SPEED_OPTIONS) {
    assert.equal(snapTtsSpeedToOption(opt), opt);
  }
});

test("snapTtsSpeedToOption snaps off-grid values to the nearest step", () => {
  assert.equal(snapTtsSpeedToOption(0.5), 0.75); // legacy min clamps up to the slowest step
  assert.equal(snapTtsSpeedToOption(1.1), 1); // closer to 1 than to 1.25
  assert.equal(snapTtsSpeedToOption(1.4), 1.5); // closer to 1.5 than to 1.25
  assert.equal(snapTtsSpeedToOption(2.0), 2);
  assert.equal(snapTtsSpeedToOption(3), 2); // above range clamps to the fastest step
});

test("snapTtsSpeedToOption breaks an exact tie toward the slower step", () => {
  // 1.125 is equidistant from 1 and 1.25; reduce keeps the earlier (slower) one.
  assert.equal(snapTtsSpeedToOption(1.125), 1);
});
