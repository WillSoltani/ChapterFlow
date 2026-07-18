/**
 * B1 ratification transform (owner directive 2026-07-11, §2).
 *
 * The owner ratified the 64-case Layer-O instrument and the sealed design
 * decisions outright, and CONDITIONALLY ratified the three SEED-* Layer-N
 * entries as "owner-approved compatibility fixtures". This script:
 *
 *  1. extracts the three SEED-* items VERBATIM into a sealed-fixture record
 *     (content, expected labels, provenance, per-item hashes) — B1 condition 1;
 *  2. flips labelProvenance → "human" on all 43 items (owner-ratified labels;
 *     the SEED-* items carry an explicit owner-approved-compatibility-fixture
 *     provenance statement in the sealed record — they are NOT represented as
 *     an independent second-human rating, independentHumanRater stays false);
 *  3. renames the corpus id from the PENDING marker to the ratified id and
 *     writes layer-n-corpus.ratified.v1.json;
 *  4. re-validates the ratified corpus with the REAL validator (must be []).
 *
 * Read-only over the owner package; never touches canonical book state.
 */
import { createHash } from "crypto";
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { validateQualCorpus } from "../../../src/bakeoff/migration/qualification.js";
import { chapterContentHash } from "../../../src/critics/qcAttestation.js";
import type { QualCorpusV1 } from "../../../src/bakeoff/migration/experimentTypes.js";

const OI = dirname(fileURLToPath(import.meta.url));
const sha = (s: string | Buffer): string => createHash("sha256").update(s).digest("hex");

const pendingPath = join(OI, "stage-q", "layer-n-corpus.pending-ratification.json");
const pendingBytes = readFileSync(pendingPath, "utf8");
const corpus = JSON.parse(pendingBytes) as QualCorpusV1;
console.log(`pending corpus: ${corpus.corpusId} · ${corpus.items.length} items · sha256 ${sha(pendingBytes)}`);

const seeds = corpus.items.filter((i) => i.itemId.startsWith("SEED-"));
if (seeds.length !== 3) throw new Error(`expected exactly 3 SEED-* items, found ${seeds.length}`);

const sealedSeeds = {
  schema: "s16-seed-fixtures-sealed-v1",
  purpose:
    "B1 condition 1 (owner directive 2026-07-11): the exact content, expected labels, provenance, and hashes " +
    "of the three SEED-* Layer-N compatibility fixtures, sealed before any live judging.",
  provenanceStatement:
    "Owner-approved compatibility fixtures under conditional B1 ratification (2026-07-11). Content is " +
    "agent-authored synthetic fixture material; the expected labels are OWNER-RATIFIED, not independently " +
    "human-rated (independentHumanRater: false is preserved). These fixtures exist ONLY to satisfy the native " +
    "eight-class corpus-completeness requirement for the three classes (causal-overreach, two-valid-answer-quiz, " +
    "unsupported-complaint-bait) whose owner-instrument counterparts are contract/key/finding-dependent judge " +
    "TASKS (Layer-O-only, cases SQ-025..SQ-048). They do not replace, dilute, or reduce the 64-case owner " +
    "primary gate; a judge that fails Layer O is disqualified regardless of Layer-N performance.",
  conditions: {
    "1-sealed-content-labels-provenance-hashes": "this file; sha pinned in the diagnostic reseal + preflight addendum",
    "2-does-not-replace-or-dilute-64-case-gate": "Layer O scores all 64 owner cases against C4 bounds; passing Layer N never substitutes",
    "3-not-an-independent-second-human-rating": "provenanceStatement above; independentHumanRater:false preserved in owner-package evidence",
    "4-cannot-independently-qualify-a-layer-o-failure": "sequencing (Layer O runs first; any panel-judge failure halts) + owner-policy evaluator conjunction check",
    "5-no-new-ground-truth-rule-inconsistent-with-C1-C4":
      "SEED-causal-overreach instantiates C1's causal-overreach class (C4 maxHighSeverityCausalOverreach=0); " +
      "SEED-two-valid-answer-quiz instantiates C1's quiz-defect class (C4 maxHighSeverityQuizTeachingDefects=0); " +
      "SEED-unsupported-complaint-bait is a clean-control specificity probe (C4 cleanControlSpecificityMinimum). " +
      "No label contradicts an owner class definition.",
    "6-not-used-to-hide-missing-coverage":
      "stage-q/mapping-table.md discloses the three classes as Layer-O-only in the owner instrument; the fixtures " +
      "fill the NATIVE class matrix and are counted separately in all reporting",
  },
  items: seeds.map((i) => ({
    itemId: i.itemId,
    class: i.class,
    cleanControl: i.cleanControl,
    expected: i.expected,
    labelProvenanceAtSeal: i.labelProvenance,
    labelProvenanceAfterRatification: "human (owner-ratified compatibility fixture — NOT independent human rating)",
    chapterContentSha256: chapterContentHash(i.chapter),
    itemCanonicalSha256: sha(JSON.stringify(i)),
    item: i, // full verbatim content
  })),
};
const sealedSeedsPath = join(OI, "stage-q", "seed-fixtures.sealed.json");
const sealedSeedsBytes = JSON.stringify(sealedSeeds, null, 2) + "\n";
writeFileSync(sealedSeedsPath, sealedSeedsBytes);
console.log(`sealed SEED fixtures: ${sealedSeedsPath} · sha256 ${sha(sealedSeedsBytes)}`);

const ratified: QualCorpusV1 = {
  ...corpus,
  corpusId: "s16-stage-q-layer-n-ratified-v1",
  items: corpus.items.map((i) => ({ ...i, labelProvenance: "human" as const })),
};
const problems = validateQualCorpus(ratified, []);
if (problems.length > 0) throw new Error(`ratified corpus INVALID:\n- ${problems.join("\n- ")}`);
const ratifiedPath = join(OI, "stage-q", "layer-n-corpus.ratified.v1.json");
const ratifiedBytes = JSON.stringify(ratified, null, 2) + "\n";
writeFileSync(ratifiedPath, ratifiedBytes);
console.log(`ratified corpus: ${ratifiedPath}`);
console.log(`  corpusId ${ratified.corpusId} · items ${ratified.items.length} · validateQualCorpus [] · sha256 ${sha(ratifiedBytes)}`);
console.log(`  human-labeled items: ${ratified.items.filter((i) => i.labelProvenance === "human").length}/43 (dryRunOnly will be false)`);
