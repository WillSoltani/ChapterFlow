import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  AUDIO_GENERATION_DAILY_LIMIT,
  audioGenerationLimitSk,
  createGenerationReservation,
} from "./audio-generation-limit-core";

test("the daily counter key is bucketed by day", () => {
  assert.equal(audioGenerationLimitSk("2026-11-12"), "AUDIO_TTS_LIMIT#2026-11-12");
});

test("the daily generation limit is positive and bounded", () => {
  assert.ok(AUDIO_GENERATION_DAILY_LIMIT >= 1 && AUDIO_GENERATION_DAILY_LIMIT <= 50);
});

test("a request reserves one unit however many segments it generates", async () => {
  let reservations = 0;
  const ensure = createGenerationReservation(async () => {
    reservations += 1;
  });
  await Promise.all([ensure(), ensure(), ensure()]);
  await ensure();
  assert.equal(reservations, 1);
});

test("a request that generates nothing reserves nothing", () => {
  let reservations = 0;
  createGenerationReservation(async () => {
    reservations += 1;
  });
  assert.equal(reservations, 0);
});

test("a refused reservation rejects every generating caller", async () => {
  const refused = new Error("rate_limited");
  const ensure = createGenerationReservation(async () => {
    throw refused;
  });
  await assert.rejects(ensure(), (e: unknown) => e === refused);
  await assert.rejects(ensure(), (e: unknown) => e === refused);
});

// The route cannot be imported in a unit test (server-only + AWS clients), so pin
// its wiring at the source level: chapter access uses the same check as the
// chapter content route, and generation reserves the daily allowance first.
const routeSrc = readFileSync(
  join(process.cwd(), "app/app/api/book/books/[bookId]/chapters/[chapterNumber]/audio/route.ts"),
  "utf8"
);

test("audio route gates on the shared chapter-access check", () => {
  assert.match(routeSrc, /getUserAccessibleChapter\(/);
  const accessAt = routeSrc.indexOf("getUserAccessibleChapter(");
  const ttsAt = routeSrc.indexOf("api.elevenlabs.io", routeSrc.indexOf("async function handleAudioGet"));
  assert.ok(accessAt > 0 && ttsAt > accessAt, "access check must run before any generation");
});

test("audio route reserves the daily generation allowance before generating", () => {
  assert.match(routeSrc, /enforceDailyUserLimit\(/);
  assert.match(routeSrc, /audioGenerationLimitSk\(/);
});
