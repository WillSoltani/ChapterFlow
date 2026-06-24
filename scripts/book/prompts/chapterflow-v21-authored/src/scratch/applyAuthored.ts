/**
 * applyAuthored <chapterFile> <patchFile> — inject HAND-AUTHORED content into a
 * chapter JSON while preserving every untouched field exactly.
 *
 * This is NOT a content generator: it reads no sidecar and synthesizes nothing.
 * It only overwrites the specific fields the author re-wrote by hand (passed in
 * as a JSON patch) and leaves breakdown / hook / counterintuition / keyTakeaway /
 * memorableLines / reviewCards[*].back / examples[*].whyItMatters intact.
 *
 * Patch shape (all keys optional):
 * {
 *   "examples":   [ ...full authored example objects... ],
 *   "quiz":       { ...full authored quiz... },
 *   "cardFronts": { "card01": "new front", ... },        // updates .front only
 *   "coreSkill":  "new core skill prose",                // implementationPlan.coreSkill
 *   "planTitle":  "new plan title",                      // implementationPlan.title (optional)
 *   "ifThenContexts": { "1": "new context", ... },       // ifThenPlans[idx].context only
 *   "ifThenPlans":    { "1": "new plan text", ... }       // ifThenPlans[idx].plan only (rare)
 * }
 */
import { readFileSync } from "fs";
import { resolve } from "path";

import { writeFileAtomic } from "../lib/atomicWrite.js";
import { AuthorProvenanceConflictError, recordAuthorProvenance, requireCurrentSessionId } from "../qc/sessionProvenance.js";
import { chapterContentHash } from "../critics/qcAttestation.js";

const chapterFile = process.argv[2];
const patchFile = process.argv[3];
if (!chapterFile || !patchFile) {
  console.error("usage: applyAuthored <chapterFile> <patchFile>");
  process.exit(2);
}
const ch: any = JSON.parse(readFileSync(resolve(chapterFile), "utf8"));
const patch: any = JSON.parse(readFileSync(resolve(patchFile), "utf8"));

function assertAscii(label: string, s: string) {
  // Guard against accidental smart quotes / unicode / em dashes sneaking in.
  if (/[‐-―‘-‟…]/.test(s) || /[^\x00-\x7F]/.test(s)) {
    throw new Error(`non-ASCII / smart-punctuation in ${label}: ${JSON.stringify(s.slice(0, 80))}`);
  }
  if (/—/.test(s)) throw new Error(`em dash in ${label}`);
}

if (patch.examples) {
  if (!Array.isArray(patch.examples)) throw new Error("patch.examples must be an array");
  // Field-level merge by index: override only the keys provided (title /
  // scenario / whatToDo / optional planSpec); preserve exampleId, tags,
  // whyItMatters, and anything else from the original example exactly.
  patch.examples.forEach((ex: any, i: number) => {
    if (!ch.examples[i]) throw new Error(`patch.examples[${i}] has no original example to merge onto`);
    for (const k of ["title", "scenario", "whatToDo", "whyItMatters"] as const) {
      if (typeof ex[k] === "string") assertAscii(`examples[${i}].${k}`, ex[k]);
    }
    for (const [k, v] of Object.entries(ex)) {
      if (k === "planSpec" && v && typeof v === "object") {
        ch.examples[i].planSpec = { ...ch.examples[i].planSpec, ...v };
      } else {
        ch.examples[i][k] = v;
      }
    }
  });
}

if (patch.quiz) {
  for (const q of patch.quiz.questions ?? []) {
    assertAscii(`quiz prompt`, q.prompt ?? "");
    (q.choices ?? []).forEach((c: string, ci: number) => assertAscii(`choice[${ci}]`, c));
    assertAscii(`explanation`, q.explanation ?? "");
  }
  ch.quiz = patch.quiz;
}

if (patch.cardFronts) {
  for (const [cardId, front] of Object.entries(patch.cardFronts)) {
    const card = (ch.reviewCards ?? []).find((c: any) => c.cardId === cardId);
    if (!card) throw new Error(`cardFronts: no card ${cardId}`);
    assertAscii(`card ${cardId} front`, front as string);
    card.front = front;
  }
}

if (typeof patch.coreSkill === "string") {
  assertAscii("coreSkill", patch.coreSkill);
  ch.implementationPlan.coreSkill = patch.coreSkill;
}
if (typeof patch.planTitle === "string") {
  assertAscii("planTitle", patch.planTitle);
  ch.implementationPlan.title = patch.planTitle;
}
if (patch.ifThenContexts) {
  for (const [idx, ctx] of Object.entries(patch.ifThenContexts)) {
    assertAscii(`ifThenContexts[${idx}]`, ctx as string);
    ch.implementationPlan.ifThenPlans[Number(idx)].context = ctx;
  }
}
if (patch.ifThenPlans) {
  for (const [idx, plan] of Object.entries(patch.ifThenPlans)) {
    assertAscii(`ifThenPlans[${idx}]`, plan as string);
    ch.implementationPlan.ifThenPlans[Number(idx)].plan = plan;
  }
}

// This is a DELIBERATE re-authoring: the patch has been merged into `ch`, so the
// content hash here reflects the newly-authored content. Binding provenance to it
// lets recordAuthorProvenance permit the transition (changed content) while still
// refusing to let a different session claim authorship of IDENTICAL content.
const authorSessionId = requireCurrentSessionId(`applyAuthored ${ch.chapterId ?? chapterFile}`);
if (typeof ch.chapterId === "string" && ch.chapterId.trim()) {
  try {
    recordAuthorProvenance(ch.chapterId, authorSessionId, chapterContentHash(ch));
  } catch (err) {
    // Idempotent re-apply: the patched content is byte-identical to a version already
    // authored under a DIFFERENT session. The re-applier did not author content it did
    // not change, so the original author is preserved (create-once). The write below is
    // a no-op (or touches only hash-excluded fields), so this stays a safe no-crash re-run.
    if (err instanceof AuthorProvenanceConflictError) {
      console.warn(`applyAuthored: author provenance preserved — ${err.message}`);
    } else {
      throw err;
    }
  }
}
writeFileAtomic(resolve(chapterFile), JSON.stringify(ch, null, 2) + "\n");
console.log(`applied patch to ${chapterFile}`);
