/**
 * IMP-06 — passive structural diversity features (F-008/F-016, instruction 5/6).
 *
 * Deterministic, heuristic classifiers over a finished chapter that record BROAD
 * structural features for OUTCOME measurement — never for writer instruction. The
 * feature vocabulary is internal (hidden from cards and prose; see
 * internalTaxonomy.ts), values are hyphenated distinctive tokens, and "unknown"/
 * "none" are first-class honest answers: a heuristic that cannot classify says so
 * rather than guessing.
 *
 * These features exist so the IMP-11 bakeoff / held-out evaluation can MEASURE
 * first-write concentration ("did 12/12 chapters resolve late with a rescue
 * beat?") without exposing a named taxonomy the writer could mirror (the F-016
 * trap). Extraction is pure; recording is the ledger's job (diversityLedger.ts);
 * activation of any constraint derived from them is governed by the
 * diversityConfig activation contract.
 */

import type { ChapterV21 } from "../types.js";
import type { SourceUsePlanV1 } from "../contracts/sourceUsePlan.js";
import { detectProxyNames } from "../compiler/contentDeviceDeal.js";

export const DIVERSITY_FEATURE_SCHEMA_VERSION = "diversity-features-v1" as const;

export type DiversityFeaturesV1 = {
  openerFunction: string;
  settingCategory: string;
  actorRegister: string;
  sourceOriginForm: string;
  tensionSource: string;
  discoveryTiming: string;
  resolutionTiming: string;
  rescueTiming: string;
  propDependence: string;
  narrativeContainer: string;
  beforeAfterShape: string;
  practiceActionFamily: string;
  memorableLinePattern: string;
};

export type DiversityFeatureRecordV1 = {
  schema: typeof DIVERSITY_FEATURE_SCHEMA_VERSION;
  bookId: string;
  chapterNumber: number;
  features: DiversityFeaturesV1;
};

// ── shared text harvesting ────────────────────────────────────────────────────

function exampleText(ch: ChapterV21): string {
  return (ch.examples ?? [])
    .flatMap((e) => [e?.scenario, e?.whatToDo, e?.whyItMatters])
    .filter((s): s is string => typeof s === "string" && s.length > 0)
    .join("\n");
}

function practiceText(ch: ChapterV21): string {
  const ip = ch.implementationPlan;
  return [ch.tryThisNow, ip?.coreSkill, ip?.twentyFourHourChallenge, ip?.weeklyPractice, ...(ip?.ifThenPlans ?? []).map((p) => p?.plan)]
    .filter((s): s is string => typeof s === "string" && s.length > 0)
    .join("\n");
}

/** Position of the first match as a fraction of text length, or null. */
function relPos(text: string, rx: RegExp): number | null {
  rx.lastIndex = 0;
  const m = rx.exec(text);
  return m && text.length > 0 ? m.index / text.length : null;
}

function bucket(pos: number): string {
  return pos < 0.34 ? "early" : pos < 0.67 ? "middle" : "late";
}

// ── the extractors (each honest: unknown/none when unclassifiable) ────────────

export function classifyOpenerFunction(ch: ChapterV21): string {
  const hook = (ch.hook ?? "").trim();
  if (!hook) return "unknown";
  const first = hook.split(/(?<=[.!?])\s+/)[0] ?? hook;
  if (/\?/.test(first)) return "question-opener";
  if (/\b\d[\d,.]*\s*(?:%|percent|x\b)|\$\s?\d|\b\d{2,}\b/.test(first)) return "statistic-opener";
  // A scene: a concrete actor mid-moment (name or article+role, sentence-initial
  // included, + a present-tense posture/action verb).
  if (/(?:^|\s)(?:[A-Z][a-z]+|(?:the|a|an)\s+[a-z]+(?:\s+[a-z]+)?)\s+(?:is|are|stands|sits|opens|reads|watches|holds|walks|stares|waits)\b/i.test(first)) return "scene-opener";
  if (/\b(?:but|yet|except|no one|nobody|everyone)\b/i.test(hook)) return "tension-opener";
  return "claim-opener";
}

const SETTING_VOCAB: Array<[string, RegExp]> = [
  ["office-meeting", /\b(?:meeting|boardroom|conference room|stand-?up|off-?site|all-?hands|status update|slide deck|whiteboard)\b/i],
  ["industrial-site", /\b(?:plant|factory|floor|warehouse|loading dock|assembly|shift|foreman|line worker)\b/i],
  ["digital-remote", /\b(?:dashboard|slack|email|inbox|video call|remote|ticket|repo|deploy|on-?call)\b/i],
  ["home-personal", /\b(?:kitchen|home|family|morning routine|commute|evening|weekend|apartment)\b/i],
  ["public-field", /\b(?:store|hospital|clinic|school|classroom|court|stadium|restaurant|branch)\b/i],
];

export function classifySettingCategory(ch: ChapterV21): string {
  const text = exampleText(ch);
  if (!text) return "unknown";
  let best: string | null = null;
  let bestCount = 0;
  for (const [label, rx] of SETTING_VOCAB) {
    const count = (text.match(new RegExp(rx.source, "gi")) ?? []).length;
    if (count > bestCount) { best = label; bestCount = count; }
  }
  return best ?? "abstract-none";
}

export function classifyActorRegister(ch: ChapterV21): string {
  const text = exampleText(ch);
  if (!text) return "unknown";
  const youHits = (text.match(/\byou(?:r|rs)?\b/gi) ?? []).length;
  const names = detectProxyNames(text).length;
  const roles = (text.match(/\b(?:a|the)\s+(?:manager|engineer|analyst|lead|nurse|teacher|founder|designer|operator|rep|director|owner|coach)\b/gi) ?? []).length;
  const max = Math.max(youHits, names * 2, roles); // names weighted: one recurring name dominates
  if (max === 0) return "conceptual-none";
  if (max === youHits) return "second-person-you";
  if (max === names * 2) return "named-individuals";
  return "role-labels";
}

/** Aggregate origin/form shape from the compiler-owned plan; content-blind. */
export function classifySourceOriginForm(plan: SourceUsePlanV1 | null): string {
  if (!plan || plan.units.length === 0) return "unknown";
  const hasCase = plan.units.some((u) => u.origin === "source_bound" && u.form === "case");
  const hasFacts = plan.units.some((u) => u.origin === "source_bound" && u.form === "explanation");
  if (hasCase) return "sourced-case-led";
  if (hasFacts) return "sourced-facts-only";
  return "invented-only";
}

const TENSION_VOCAB: Array<[string, RegExp]> = [
  ["deadline-time", /\b(?:deadline|running out|too late|last minute|overdue|by friday|ship date|behind schedule)\b/i],
  ["interpersonal", /\b(?:disagree|pushback|conflict|blame|argument|tension between|refus\w+|defensive)\b/i],
  ["resource-constraint", /\b(?:budget|headcount|short-?staffed|no time|limited|scarce|can'?t afford)\b/i],
  ["quality-failure", /\b(?:defect|bug|error|miss(?:ed|es)?|broke|failure|wrong|rework|churn)\b/i],
  ["uncertainty-risk", /\b(?:uncertain|unknown|risk|might|no one knows|unclear|ambiguous)\b/i],
];

export function classifyTensionSource(ch: ChapterV21): string {
  const text = exampleText(ch);
  if (!text) return "unknown";
  for (const [label, rx] of TENSION_VOCAB) if (rx.test(text)) return label;
  return "none";
}

const DISCOVERY_RX = /\b(?:realiz\w+|discover\w+|notic\w+|turns? out|it emerged|spots?|catches|surfaces)\b/i;
const RESOLUTION_RX = /\b(?:resolv\w+|fix\w+|works now|recovered|back on track|ships?|landed|settl\w+|the numbers? (?:improve|recover))\b/i;
const RESCUE_RX = /\b(?:just in time|at the last minute|barely|pulled (?:it )?back|caught it before|averted|narrowly)\b/i;

export function classifyDiscoveryTiming(ch: ChapterV21): string {
  const pos = relPos(exampleText(ch), DISCOVERY_RX);
  return pos === null ? "none" : `discovery-${bucket(pos)}`;
}

export function classifyResolutionTiming(ch: ChapterV21): string {
  const pos = relPos(exampleText(ch), RESOLUTION_RX);
  return pos === null ? "unresolved" : `resolution-${bucket(pos)}`;
}

export function classifyRescueTiming(ch: ChapterV21): string {
  const pos = relPos(exampleText(ch), RESCUE_RX);
  return pos === null ? "none" : `rescue-${bucket(pos)}`;
}

const PROP_RX = /\b(?:whiteboard|sticky note|checklist|printout|index card|notebook|spreadsheet|timer|clipboard|post-?it|marker|binder|form|badge|receipt)\b/gi;

export function classifyPropDependence(ch: ChapterV21): string {
  const count = (exampleText(ch).match(PROP_RX) ?? []).length;
  return count === 0 ? "none" : count <= 2 ? "prop-light" : "prop-heavy";
}

export function classifyNarrativeContainer(ch: ChapterV21): string {
  const text = exampleText(ch);
  if (!text) return "unknown";
  const quotes = (text.match(/["“][^"”]{8,}["”]/g) ?? []).length;
  const names = detectProxyNames(text);
  const scenarios = (ch.examples ?? []).length;
  if (quotes >= 3) return "dialogue-scenes";
  if (names.length === 1 && scenarios >= 3) return "running-story";
  if (names.length === 0 && !/\b(?:a|the)\s+(?:manager|engineer|analyst|lead|team)\b/i.test(text)) return "conceptual-exposition";
  return scenarios >= 3 ? "discrete-vignettes" : "single-case-study";
}

export function classifyBeforeAfterShape(ch: ChapterV21): string {
  const text = exampleText(ch);
  if (/\bbefore\b[^.]{0,80}\bafter\b/i.test(text)) return "explicit-before-after";
  if (/\b(?:from|was)\s+\d[\d,.]*\s*(?:%|hours?|days?|dollars?)?\s+(?:to|down to|up to|now)\s+\d/i.test(text)) return "delta-numbers";
  return "none";
}

const PRACTICE_FAMILIES: Array<[string, RegExp]> = [
  ["write-family", /\b(?:write|draft|jot|list|note down|pre-?write)\b/i],
  ["say-family", /\b(?:say|tell|ask|speak|read aloud|out loud)\b/i],
  ["observe-family", /\b(?:watch|observe|notice|spot|look for|listen for)\b/i],
  ["measure-family", /\b(?:count|measure|track|time yourself|capture (?:a|one) number)\b/i],
  ["schedule-family", /\b(?:schedule|calendar|block|set a reminder|book)\b/i],
  ["mark-family", /\b(?:circle|cross out|mark|highlight|flag|underline)\b/i],
  ["teach-family", /\b(?:teach|explain (?:it )?to|walk someone|show (?:a|your))\b/i],
];

export function classifyPracticeActionFamily(ch: ChapterV21): string {
  const text = practiceText(ch);
  if (!text) return "unknown";
  for (const [label, rx] of PRACTICE_FAMILIES) if (rx.test(text)) return label;
  return "other-family";
}

export function classifyMemorableLinePattern(ch: ChapterV21): string {
  const lines = (ch.memorableLines ?? []).map((m) => m?.text).filter((t): t is string => typeof t === "string" && t.length > 0);
  if (lines.length === 0) return "none";
  const classify = (l: string): string => {
    if (/\?\s*$/.test(l)) return "question-line";
    if (/\bis\s+(?:not\s+)?(?:a|the|your)\b/i.test(l)) return "redefinition-line";
    if (/\b(?:costs?|price|pays?|spend|worth)\b/i.test(l)) return "cost-line";
    if (/\b(?:but|not|instead|until|unless)\b/i.test(l)) return "reversal-line";
    if (/^[A-Z][a-z]*(?:\s+\w+){0,6}[.!]$/.test(l) && /^(?:[A-Z][a-z]+\s+)?(?:Name|Trace|Ask|Write|Count|Stop|Keep|Make|Put|Say)\b/.test(l)) return "imperative-line";
    return "plain-line";
  };
  const kinds = lines.map(classify);
  const uniq = [...new Set(kinds)];
  return uniq.length === 1 ? uniq[0] : "mixed-lines";
}

/** Extract the full passive feature record for one chapter. Pure; no disk. */
export function extractDiversityFeatures(
  bookId: string,
  chapter: ChapterV21,
  plan: SourceUsePlanV1 | null = null,
): DiversityFeatureRecordV1 {
  return {
    schema: DIVERSITY_FEATURE_SCHEMA_VERSION,
    bookId,
    chapterNumber: chapter.number,
    features: {
      openerFunction: classifyOpenerFunction(chapter),
      settingCategory: classifySettingCategory(chapter),
      actorRegister: classifyActorRegister(chapter),
      sourceOriginForm: classifySourceOriginForm(plan),
      tensionSource: classifyTensionSource(chapter),
      discoveryTiming: classifyDiscoveryTiming(chapter),
      resolutionTiming: classifyResolutionTiming(chapter),
      rescueTiming: classifyRescueTiming(chapter),
      propDependence: classifyPropDependence(chapter),
      narrativeContainer: classifyNarrativeContainer(chapter),
      beforeAfterShape: classifyBeforeAfterShape(chapter),
      practiceActionFamily: classifyPracticeActionFamily(chapter),
      memorableLinePattern: classifyMemorableLinePattern(chapter),
    },
  };
}
