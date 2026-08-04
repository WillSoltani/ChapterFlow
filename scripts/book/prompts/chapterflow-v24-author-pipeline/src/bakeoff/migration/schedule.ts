/**
 * IMP-11 — deterministic blocked sample schedule (prompt inst. 8; §16 control 6).
 *
 * Blocks are (bookId, chapterNumber). Within each block, every cell × sample
 * entry is shuffled with the experiment's seeded rng — execution order is
 * randomized within blocks, and the whole schedule is a pure function of the
 * sealed spec (same seed ⇒ byte-identical schedule; the seal hashes it).
 *
 * Screening (inst. 14): sample indexes beyond spec.screening.samplesPerCell are
 * marked `expansion: true` — they run only when the frozen expansion rules fire.
 */

import type { ExperimentSpecV1, SampleScheduleEntryV1, SampleScheduleV1 } from "./experimentTypes.js";
import { MIGRATION_SCHEDULE_SCHEMA } from "./experimentTypes.js";
import { blindSampleId, rngFromSeed, shuffleSeeded } from "./prng.js";

export function buildSampleSchedule(spec: ExperimentSpecV1): SampleScheduleV1 {
  const rand = rngFromSeed(`${spec.randomizationSeed}::schedule::${spec.experimentId}`);
  const entries: SampleScheduleEntryV1[] = [];
  let order = 0;
  for (const book of spec.books) {
    for (const ch of book.chapters) {
      const block: Omit<SampleScheduleEntryV1, "executionOrder">[] = [];
      for (const cell of spec.cells) {
        for (let sampleIndex = 1; sampleIndex <= spec.samplesPerCell; sampleIndex++) {
          block.push({
            blindSampleId: blindSampleId(spec.experimentId, cell.cellId, book.bookId, ch.chapterNumber, sampleIndex, spec.randomizationSeed),
            cellId: cell.cellId,
            bookId: book.bookId,
            chapterNumber: ch.chapterNumber,
            stratum: ch.stratum,
            sampleIndex,
            expansion: sampleIndex > spec.screening.samplesPerCell,
          });
        }
      }
      for (const e of shuffleSeeded(block, rand)) entries.push({ ...e, executionOrder: order++ });
    }
  }
  return { schema: MIGRATION_SCHEDULE_SCHEMA, experimentId: spec.experimentId, randomizationSeed: spec.randomizationSeed, entries };
}
