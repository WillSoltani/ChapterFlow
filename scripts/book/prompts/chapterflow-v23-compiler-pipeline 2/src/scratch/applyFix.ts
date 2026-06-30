/**
 * applyFix <chapterFile> <patchFile> — inject HAND-AUTHORED fixes (QC pass) into
 * a chapter JSON, preserving every untouched field. Not a generator: it writes
 * only the fields present in the patch.
 *
 * Patch keys (all optional):
 *   "fastRead" / "deepRead" / "fullRead"  -> breakdown tiers
 *   "memorableLines": [ {text, location, why}, ... ]  -> full replace (must be 3)
 *   "cardBacks":  { "3": "full sentence back", ... }   -> reviewCards[i].back
 *   "cardFronts": { "0": "...", ... }                  -> reviewCards[i].front
 *   "ifThenContexts": { "0": "...", "2": "..." }        -> ifThenPlans[i].context
 *   "ifThenPlans":    { "0": "...", ... }               -> ifThenPlans[i].plan
 *   "coreSkill" / "planTitle" / "twentyFourHourChallenge" / "weeklyPractice"
 *   "whyItMatters": { "0": "...", ... }                 -> examples[i].whyItMatters
 *   "scenario":     { "0": "...", ... }                 -> examples[i].scenario
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const chapterFile = process.argv[2];
const patchFile = process.argv[3];
if (!chapterFile || !patchFile) { console.error("usage: applyFix <chapterFile> <patchFile>"); process.exit(2); }
const ch: any = JSON.parse(readFileSync(resolve(chapterFile), "utf8"));
const p: any = JSON.parse(readFileSync(resolve(patchFile), "utf8"));

function guard(label: string, s: string) {
  if (typeof s !== "string") throw new Error(`${label} not a string`);
  if (/—/.test(s)) throw new Error(`em dash in ${label}`);
  if (/[^\x00-\x7F]/.test(s)) throw new Error(`non-ascii in ${label}: ${JSON.stringify(s.slice(0,60))}`);
}

for (const tier of ["fastRead", "deepRead", "fullRead"] as const) {
  if (typeof p[tier] === "string") { guard(tier, p[tier]); ch.breakdown[tier] = p[tier]; }
}
if (Array.isArray(p.memorableLines)) {
  p.memorableLines.forEach((m: any, i: number) => guard(`memorableLines[${i}].text`, m.text));
  ch.memorableLines = p.memorableLines;
}
const setByIdx = (arr: any[], map: any, field: string, label: string) => {
  for (const [idx, val] of Object.entries(map)) { guard(`${label}[${idx}]`, val as string); arr[Number(idx)][field] = val; }
};
if (p.cardBacks) setByIdx(ch.reviewCards, p.cardBacks, "back", "cardBack");
if (p.cardFronts) setByIdx(ch.reviewCards, p.cardFronts, "front", "cardFront");
if (p.whyItMatters) setByIdx(ch.examples, p.whyItMatters, "whyItMatters", "whyItMatters");
if (p.scenario) setByIdx(ch.examples, p.scenario, "scenario", "scenario");
if (p.ifThenContexts) setByIdx(ch.implementationPlan.ifThenPlans, p.ifThenContexts, "context", "ifThenCtx");
if (p.ifThenPlans) setByIdx(ch.implementationPlan.ifThenPlans, p.ifThenPlans, "plan", "ifThenPlan");
for (const k of ["coreSkill", "title", "twentyFourHourChallenge", "weeklyPractice"] as const) {
  const key = k === "title" ? "planTitle" : k;
  if (typeof p[key] === "string") { guard(key, p[key]); ch.implementationPlan[k] = p[key]; }
}

// Verify memorableLines texts are verbatim in their named breakdown tier (A11).
for (const m of ch.memorableLines ?? []) {
  if (typeof m.location === "string" && m.location.startsWith("breakdown.")) {
    const tier = m.location.split(".")[1];
    if (!String(ch.breakdown[tier] ?? "").includes(m.text)) {
      throw new Error(`A11 RISK: memorableLine not verbatim in ${m.location}: ${JSON.stringify(m.text.slice(0,70))}`);
    }
  }
}
writeFileSync(resolve(chapterFile), JSON.stringify(ch, null, 2) + "\n");
console.log(`applied fix to ${chapterFile}`);
