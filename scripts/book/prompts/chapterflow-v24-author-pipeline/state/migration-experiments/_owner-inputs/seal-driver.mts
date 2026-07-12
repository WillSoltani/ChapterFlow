/** §16 seal driver — seals an experiment through the "seal" phase only.
 *  Injects expectedChapterNumbers explicitly (SealDeps first-class parameter):
 *  start-with-why 1..14 (live registry), radical-candor 1..9 (B2 substitution,
 *  see radical-candor-extraction.manifest.json). Everything else uses the
 *  production defaults (freeze.collectSharedInputPaths + current card
 *  builders). No model calls occur in the seal phase.
 *  Usage (from PIPE): npx tsx state/migration-experiments/_owner-inputs/seal-driver.mts <spec.json>
 */
import { runMigrationExperiment } from "../../../src/bakeoff/migration/runExperiment.js";

const specPath = process.argv[2];
if (!specPath) { console.error("usage: seal-driver.mts <spec.json>"); process.exit(2); }
const INDEX: Record<string, number[]> = {
  "start-with-why": Array.from({ length: 14 }, (_, i) => i + 1),
  "radical-candor": Array.from({ length: 9 }, (_, i) => i + 1), // == the installed authoritative index (state/indexes/radical-candor.json: 1..9)
};
const out = await runMigrationExperiment({
  specPath,
  through: "seal",
  sealDeps: {
    expectedChapterNumbers: (bookId: string) => {
      const idx = INDEX[bookId];
      if (!idx) throw new Error(`no chapter index injected for book ${bookId}`);
      return idx;
    },
  },
  log: (m: string) => console.log(m),
});
console.log(JSON.stringify(out, null, 2));
