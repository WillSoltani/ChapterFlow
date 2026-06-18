/**
 * Chapter-level checks for the optional `experiencePlan` behavior-change layer
 * (failureRecovery + transferPrompt). These run from finalGate ONLY when the
 * field is present, so they fire exactly zero on the current corpus (no chapter
 * carries an experiencePlan yet) — calibration-safe by construction.
 *
 * Catalog ids (severities live in finalGate's SEVERITY_FROM_CATALOG):
 *   EXP1.structure          — blocker: malformed/empty subfields or bad cardinality.
 *   EXP2.length             — minor:   a subfield is outside its char bounds.
 *   EXP3.normalizing_cliche — major:   normalizingLine/repairLine reaches for a
 *                                       self-compassion cliché instead of naming
 *                                       the mechanism.
 * Meta-reference / em-dash / banned-phrase hygiene is handled by finalGate's
 * shared `runRegisterChecks` over `experiencePlanStrings(ep)` (B1/B2/B4/B5) —
 * no new id needed.
 *
 * Cross-chapter convergence (EXP10/EXP11) is enforced in bookGate, not here —
 * a single chapter cannot see its siblings.
 */

import { ExperiencePlanV21 } from "../types.js";

/** A finalGate consumes only `.message` / `.evidence` and assigns severity from
 *  the catalog id at the push site, so checks return this minimal shape rather
 *  than a full CriticFinding (whose checkId union does not carry EXP* ids). */
export type ExpFinding = { message: string; evidence?: string };

/** Self-compassion clichés that substitute reassurance for a real, mechanism-
 *  level reframe. Kept LOCAL (not in config/banned-phrases.json) so they are
 *  scoped to experiencePlan and can never fire on existing book prose. */
export const NORMALIZING_CLICHES = [
  "you're not broken",
  "you are not broken",
  "it's not your fault",
  "it is not your fault",
  "don't beat yourself up",
  "do not beat yourself up",
  "be kind to yourself",
  "be gentle with yourself",
  "go easy on yourself",
  "give yourself grace",
  "there's nothing wrong with you",
  "there is nothing wrong with you",
  "you're only human",
  "you are only human",
];

/** EXP1 — structural integrity. Each sub-object is optional, but if present its
 *  required fields must be non-empty and its arrays correctly sized. */
export function checkExperiencePlanStructure(ep: ExperiencePlanV21): ExpFinding[] {
  const out: ExpFinding[] = [];
  const fr = ep.failureRecovery;
  if (fr) {
    if (!fr.normalizingLine?.trim()) out.push({ message: "failureRecovery.normalizingLine is empty" });
    if (!fr.cueQuestion?.trim()) out.push({ message: "failureRecovery.cueQuestion is empty" });
    if (!fr.repairLine?.trim()) out.push({ message: "failureRecovery.repairLine is empty" });
    const opts = Array.isArray(fr.options) ? fr.options : [];
    if (opts.length < 2 || opts.length > 4) {
      out.push({ message: `failureRecovery.options must have 2-4 items (has ${opts.length})` });
    }
    opts.forEach((o, i) => {
      if (!o?.trim()) out.push({ message: `failureRecovery.options[${i}] is empty` });
    });
  }
  const tp = ep.transferPrompt;
  if (tp) {
    if (!tp.prompt?.trim()) out.push({ message: "transferPrompt.prompt is empty" });
    const ctx = Array.isArray(tp.contexts) ? tp.contexts : [];
    if (ctx.length < 2 || ctx.length > 5) {
      out.push({ message: `transferPrompt.contexts must have 2-5 items (has ${ctx.length})` });
    }
    ctx.forEach((c, i) => {
      if (!c?.trim()) out.push({ message: `transferPrompt.contexts[${i}] is empty` });
    });
  }
  return out;
}

function lenCheck(label: string, s: string | undefined, min: number, max: number, out: ExpFinding[]): void {
  const n = (s ?? "").trim().length;
  if (n === 0) return; // emptiness is EXP1's job, not EXP2's
  if (n < min || n > max) out.push({ message: `${label} length ${n} outside ${min}-${max}`, evidence: s });
}

/** EXP2 — soft length bounds (advisory). */
export function checkExperiencePlanLengths(ep: ExperiencePlanV21): ExpFinding[] {
  const out: ExpFinding[] = [];
  const fr = ep.failureRecovery;
  if (fr) {
    lenCheck("failureRecovery.normalizingLine", fr.normalizingLine, 60, 160, out);
    lenCheck("failureRecovery.cueQuestion", fr.cueQuestion, 30, 120, out);
    lenCheck("failureRecovery.repairLine", fr.repairLine, 60, 200, out);
    (fr.options ?? []).forEach((o, i) => lenCheck(`failureRecovery.options[${i}]`, o, 15, 120, out));
  }
  const tp = ep.transferPrompt;
  if (tp) {
    lenCheck("transferPrompt.prompt", tp.prompt, 60, 200, out);
    (tp.contexts ?? []).forEach((c, i) => lenCheck(`transferPrompt.contexts[${i}]`, c, 10, 80, out));
  }
  return out;
}

/** EXP3 — a normalizing/repair line that reassures ("you're not broken") instead
 *  of naming the mechanism. Scoped to the two lines whose job is the reframe. */
export function checkNormalizingCliche(ep: ExperiencePlanV21): ExpFinding[] {
  const out: ExpFinding[] = [];
  const targets: Array<[string, string | undefined]> = [
    ["failureRecovery.normalizingLine", ep.failureRecovery?.normalizingLine],
    ["failureRecovery.repairLine", ep.failureRecovery?.repairLine],
  ];
  for (const [label, text] of targets) {
    if (!text) continue;
    const lower = text.toLowerCase();
    const hit = NORMALIZING_CLICHES.find((c) => lower.includes(c));
    if (hit) {
      out.push({
        message: `${label} uses self-compassion cliché "${hit}" — name why the slip is normal (the mechanism), don't just reassure`,
        evidence: text,
      });
    }
  }
  return out;
}

/** Every authored string in an experiencePlan, for shared register hygiene
 *  (meta-reference / em-dash / banned phrases) in finalGate. */
export function experiencePlanStrings(ep: ExperiencePlanV21): string[] {
  const out: string[] = [];
  const fr = ep.failureRecovery;
  if (fr) {
    if (fr.normalizingLine) out.push(fr.normalizingLine);
    if (fr.cueQuestion) out.push(fr.cueQuestion);
    if (fr.repairLine) out.push(fr.repairLine);
    for (const o of fr.options ?? []) if (o) out.push(o);
  }
  const tp = ep.transferPrompt;
  if (tp) {
    if (tp.prompt) out.push(tp.prompt);
    for (const c of tp.contexts ?? []) if (c) out.push(c);
  }
  return out;
}

/** Normalize a line for cross-chapter convergence comparison (EXP10/EXP11):
 *  lowercase, strip non-alphanumerics, collapse whitespace. Two chapters whose
 *  normalized key matches are the verbatim-copy convergence failure mode. */
export function normalizeConvergenceKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
