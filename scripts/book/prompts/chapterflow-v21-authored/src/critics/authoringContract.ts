/**
 * Authoring-contract checks (`author-check`) — Phase 1 of the redesign
 * (see ../../MASTER-PLAN.md). These run BOTH at chapter-write time (the
 * `author-check` CLI Codex runs as it writes, so it converges in-session) and
 * inside the gate.
 *
 * They are the content/field-job layer the structural gates lack. Three design
 * rules from the red-team are baked in:
 *
 *  1. JOB-level messages, never regex/span. A finding says "this card tests
 *     recall, rewrite from the concept" — not "matched /.../", so the contract
 *     can't be turned into an evasion manual.
 *  2. Every reader-facing string field is covered (not just the ~8 the catalog
 *     named), or defects relocate into the unguarded ones.
 *  3. Frame-based where possible (shingle ratio, structural shape) rather than
 *     fixed lexical lists that single-token mutation evades.
 *
 * SHADOW ROLLOUT: every check ships `major`/`minor` (advisory — surfaces at
 * gate but does not block) and is calibrated to ZERO fires on the clean gold
 * corpus (daring-greatly) before any is promoted to a blocker, exactly like the
 * AS13 7/9-gap protocol.
 *
 * Red-team corrections honored:
 *  - whatToDo is NOT required to be a second-person imperative (the clean book
 *    is 100% third-person scene-continuation). The defect is whatToDo = an
 *    abstract PROPOSITION/source-claim; that is what AC4 detects.
 *  - "because/since" is NEVER a positive requirement (absent in 90% of clean
 *    explanations). The echo-explanation check (AC5) keys on overlap + a
 *    no-new-content remainder, not connective presence.
 */

import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { ChapterV21 } from "../types.js";
import { parseChapterId } from "../lib/chapterPaths.js";

const __dirname = dirname(fileURLToPath(import.meta.url)); // src/critics

export type ACSeverity = "blocker" | "major" | "minor";
export type ACFinding = {
  checkId: string;
  severity: ACSeverity;
  unit: string;
  job: string; // the field's JOB this violates, in plain language
  message: string;
  evidence?: string;
};

// ── Field enumeration: every reader-facing string field on a chapter ─────────
type Field = { unit: string; field: string; text: string };

export function readerFields(ch: ChapterV21): Field[] {
  const out: Field[] = [];
  const push = (unit: string, field: string, text: unknown) => {
    if (typeof text === "string" && text.trim()) out.push({ unit, field, text });
  };
  push("chapter", "hook", ch.hook);
  push("chapter", "counterintuition", ch.counterintuition);
  push("chapter", "tryThisNow", ch.tryThisNow);
  push("chapter", "keyTakeaway", ch.keyTakeaway);
  push("breakdown", "fastRead", ch.breakdown?.fastRead);
  push("breakdown", "deepRead", ch.breakdown?.deepRead);
  push("breakdown", "fullRead", ch.breakdown?.fullRead);
  (ch.examples ?? []).forEach((e, i) => {
    push(`example[${i}]`, "scenario", e.scenario);
    push(`example[${i}]`, "whatToDo", e.whatToDo);
    push(`example[${i}]`, "whyItMatters", e.whyItMatters);
    push(`example[${i}]`, "title", e.title);
  });
  (ch.quiz?.questions ?? []).forEach((q, i) => {
    push(`quiz.q${String(i + 1).padStart(2, "0")}`, "prompt", q.prompt);
    push(`quiz.q${String(i + 1).padStart(2, "0")}`, "explanation", q.explanation);
  });
  (ch.reviewCards ?? []).forEach((c, i) => {
    push(`card[${i}]`, "front", c.front);
    push(`card[${i}]`, "back", c.back);
  });
  const p = ch.implementationPlan;
  if (p) {
    push("plan", "coreSkill", p.coreSkill);
    push("plan", "twentyFourHourChallenge", p.twentyFourHourChallenge);
    push("plan", "weeklyPractice", p.weeklyPractice);
    (p.ifThenPlans ?? []).forEach((it, i) => {
      push(`plan.ifThen[${i}]`, "context", it.context);
      push(`plan.ifThen[${i}]`, "plan", it.plan);
    });
  }
  (ch.memorableLines ?? []).forEach((m, i) => push(`memorableLine[${i}]`, "text", m.text));
  return out;
}

// ── token helpers ───────────────────────────────────────────────────────────
const STOP = new Set([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for", "with", "at", "by",
  "from", "as", "is", "are", "was", "were", "be", "been", "it", "its", "this", "that", "these",
  "those", "they", "them", "their", "he", "she", "you", "your", "we", "our", "i", "if", "then",
  "her", "his", "him", "hers", "theirs", "ours", "yours", "myself", "herself", "himself", "itself",
  "so", "not", "no", "do", "does", "did", "can", "will", "would", "should", "could", "into",
  "than", "what", "which", "when", "while", "who", "how", "why", "about", "more", "most",
]);
function words(s: string): string[] {
  return (s.toLowerCase().match(/[a-z0-9']+/g) ?? []);
}
function contentTokens(s: string): string[] {
  return words(s).filter((w) => w.length > 2 && !STOP.has(w));
}
/** Multiset (Jaccard-on-multiset) containment: fraction of `a`'s content tokens
 *  also present in `b`. Asymmetric — "is a contained in b". */
function containment(a: string, b: string): number {
  const at = contentTokens(a);
  if (at.length === 0) return 0;
  const bset = new Set(contentTokens(b));
  let hit = 0;
  for (const t of at) if (bset.has(t)) hit++;
  return hit / at.length;
}
/** Longest contiguous common run length (in words) between two token streams,
 *  normalized by the shorter length. Survives single-word swaps better than a
 *  fixed n-gram because we report the longest run, not exact-n matches. */
function longestCommonRunRatio(a: string, b: string): number {
  const A = words(a), B = words(b);
  if (A.length === 0 || B.length === 0) return 0;
  const dp = new Array(B.length + 1).fill(0);
  let best = 0;
  for (let i = 1; i <= A.length; i++) {
    let prev = 0;
    for (let j = 1; j <= B.length; j++) {
      const tmp = dp[j];
      dp[j] = A[i - 1] === B[j - 1] ? prev + 1 : 0;
      if (dp[j] > best) best = dp[j];
      prev = tmp;
    }
  }
  return best / Math.min(A.length, B.length);
}
/** Within-text repetition: 1 − distinct/total over n-word shingles. */
function shingleRepetitionRatio(text: string, n: number): { ratio: number; top: string } {
  const w = words(text);
  if (w.length < n + 2) return { ratio: 0, top: "" };
  const counts = new Map<string, number>();
  for (let i = 0; i <= w.length - n; i++) {
    const sh = w.slice(i, i + n).join(" ");
    counts.set(sh, (counts.get(sh) ?? 0) + 1);
  }
  const total = w.length - n + 1;
  const distinct = counts.size;
  let top = "", topN = 0;
  for (const [sh, c] of counts) if (c > topN) { topN = c; top = sh; }
  return { ratio: 1 - distinct / total, top };
}
/** Longest contiguous identical word-run between two texts (in words). */
function longestCommonRunWords(a: string, b: string): number {
  const A = words(a), B = words(b);
  if (A.length === 0 || B.length === 0) return 0;
  const dp = new Array(B.length + 1).fill(0);
  let best = 0;
  for (let i = 1; i <= A.length; i++) {
    let prev = 0;
    for (let j = 1; j <= B.length; j++) {
      const tmp = dp[j];
      dp[j] = A[i - 1] === B[j - 1] ? prev + 1 : 0;
      if (dp[j] > best) best = dp[j];
      prev = tmp;
    }
  }
  return best;
}
/** Flatten a source sidecar to its prose text (what the writer reasons FROM). */
function sidecarSourceText(sidecar: any): string {
  const parts: string[] = [];
  const add = (v: unknown) => { if (typeof v === "string" && v.trim()) parts.push(v); };
  add(sidecar?.centralConcept?.plainDefinition);
  add(sidecar?.hardEdge);
  add(sidecar?.paraphraseNotes);
  for (const e of sidecar?.namedExamples ?? []) add(e?.summary);
  return parts.join("  ");
}
/** Named-framework config (config/named-frameworks.json), loaded once. Maps a
 *  bookId to its named multi-member frameworks. Config-driven = zero false
 *  positives by construction (AC11 only runs for seeded (book, framework) pairs).*/
let _frameworks: Record<string, Array<{ name: string; members: string[] }>> | null = null;
function frameworksForBook(bookId: string): Array<{ name: string; members: string[] }> {
  if (_frameworks === null) {
    try {
      _frameworks = JSON.parse(readFileSync(resolve(__dirname, "../../config/named-frameworks.json"), "utf8"));
    } catch {
      _frameworks = {};
    }
  }
  return (_frameworks ?? {})[bookId] ?? [];
}
function reEscape(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

/** Concept-label content tokens — ONLY from the sidecar's centralConcept.name.
 *  The chapter title is deliberately NOT used: a chapter title often contains
 *  the real concrete noun the chapter is about (e.g. "cigarette"), which made
 *  AC1 false-fire on legitimate scenes ("points to the unsticky cigarette").
 *  The abstraction we want to forbid as an actor ("productive vulnerability")
 *  lives in the sidecar. Returns empty when no sidecar → AC1 stays silent
 *  (skips) until sidecars are wired in Phase 3. */
function conceptTokens(_ch: ChapterV21, sidecar?: any): Set<string> {
  const set = new Set<string>();
  const cc = sidecar?.centralConcept?.name;
  if (typeof cc === "string") for (const t of contentTokens(cc)) set.add(t);
  return set;
}

// ── checks ───────────────────────────────────────────────────────────────────
const SCAFFOLD_PATTERNS: Array<{ re: RegExp; what: string }> = [
  { re: /\bSource Moment\s+\d/i, what: "scaffold title 'Source Moment N'" },
  { re: /\b(First|Second|Third|Fourth|Fifth|Sixth)\s+Angle\s+\d/i, what: "scaffold title 'Nth Angle'" },
  { re: /\b(Scene|Beat|Point|Practice|Claim)\s+\d+\.\d+\b/i, what: "scaffold marker 'Word N.M'" },
  { re: /\bas the source (cue|check)\b/i, what: "editor-facing 'as the source cue/check'" },
  { re: /\buses? a real source cue\b/i, what: "editor-facing 'uses a real source cue'" },
  { re: /\brevisit the hard edge\b/i, what: "editor-facing 'revisit the hard edge'" },
  { re: /\bwhen someone cites\b/i, what: "editor-facing 'when someone cites <source>'" },
];
/** "X means The X is …" tautology seam (drive ×11): the same token repeated as
 *  "<S> means The <S> is". Frame-based — any subject, not a fixed word. */
const MEANS_SEAM = /\b([a-z][a-z'-]{2,}(?:\s+[a-z][a-z'-]{2,}){0,3})\s+means\s+the\s+\1\b/i;

export function checkAuthoringContract(ch: ChapterV21, opts?: { sidecar?: any; filePath?: string }): ACFinding[] {
  const out: ACFinding[] = [];
  const fields = readerFields(ch);
  const concept = conceptTokens(ch, opts?.sidecar);

  // AC7 — scaffolding strings + "X means The X is" seam (any field). High precision.
  for (const f of fields) {
    for (const { re, what } of SCAFFOLD_PATTERNS) {
      const m = f.text.match(re);
      if (m) out.push({ checkId: "AC7.scaffold_leak", severity: "major", unit: `${f.unit}.${f.field}`,
        job: "reader fields carry finished prose, not generation scaffolding or editor notes",
        message: `${f.unit}.${f.field} contains ${what} — internal scaffolding leaked into reader-facing text. Rewrite as finished prose.`, evidence: m[0] });
    }
    const seam = f.text.match(MEANS_SEAM);
    if (seam) out.push({ checkId: "AC7.means_seam", severity: "major", unit: `${f.unit}.${f.field}`,
      job: "deepRead/prose teaches the idea; it does not restate '<concept> means The <concept> is…'",
      message: `${f.unit}.${f.field} has the tautology seam "<X> means The <X> is…". Replace with a real definition/mechanism.`, evidence: seam[0] });
  }

  // AC8 — templated-loop repetition (fullRead/deepRead + any long prose field).
  // Calibrated: the CLEAN corpus (daring-greatly + start-with-why) max 10-gram
  // repetition ratio over all long fields is 0.000; the dare-to-lead loop was
  // 0.78–0.86. Threshold 0.22 sits far above clean and below the defect band.
  // Covers whyItMatters/coreSkill too (red-team field-coverage fix).
  for (const f of fields) {
    const w = words(f.text).length;
    if (w < 40) continue; // only long fields can loop
    const { ratio, top } = shingleRepetitionRatio(f.text, 10);
    if (ratio >= 0.22) out.push({ checkId: "AC8.templated_loop", severity: "major", unit: `${f.unit}.${f.field}`,
      job: "prose develops the idea; it does not repeat one clause with a rotating label",
      message: `${f.unit}.${f.field} repeats a 10-word frame (repetition ratio ${ratio.toFixed(2)} — clean prose ≈ 0). This is a templated loop; write distinct sentences that advance the point.`, evidence: top });
  }

  // AC1 — concept-label as a grammatical actor/object of a physical/cognition
  // verb ("Cleo lifts a productive vulnerability folder"; "<Name> studies <label>").
  // Only fires when a concept-label token is the noun the verb acts on.
  const ACTOR_VERB = /\b(lifts|holds|studies|opens|carries|reads|reviews|grabs|files|stacks|examines|weighs|considers|points|places|sets)\s+(?:a|an|the|her|his|their|this|that|to|toward|towards|at)?\s*([a-z][a-z'-]+(?:\s+[a-z][a-z'-]+){0,3})/gi;
  // AC1 only runs with a sidecar concept (skips otherwise) — the title is an
  // unreliable concept source (it often holds the real concrete noun).
  for (const f of (concept.size > 0 ? fields : [])) {
    if (f.field !== "scenario" && f.field !== "back" && f.field !== "front") continue;
    let m: RegExpExecArray | null;
    ACTOR_VERB.lastIndex = 0;
    while ((m = ACTOR_VERB.exec(f.text))) {
      const objTokens = contentTokens(m[2]);
      // fire only if the object is MADE OF concept-label tokens and has no other concrete noun
      if (objTokens.length > 0 && objTokens.every((t) => concept.has(t)) && !/\b(labeled|titled|named|marked)\b/i.test(f.text.slice(Math.max(0, m.index - 20), m.index + m[0].length + 20))) {
        out.push({ checkId: "AC1.concept_as_actor", severity: "major", unit: `${f.unit}.${f.field}`,
          job: "a person acts in the scene; the concept is what their action illustrates, never a physical object they handle",
          message: `${f.unit}.${f.field} uses the concept label "${m[2]}" as the object of "${m[1].toLowerCase()}". People act; ideas don't get held/studied. Write what the person concretely does that the concept explains.`, evidence: m[0] });
        break;
      }
    }
  }

  // AC6 — card front must be a question (or imperative-recall stem), not a bare label.
  const RECALL_STEM = /^(name|list|state|describe|explain|recall|give|identify|define|what|why|how|when|which|where|who)\b/i;
  (ch.reviewCards ?? []).forEach((c, i) => {
    const front = (c.front ?? "").trim();
    if (!front) return;
    if (!front.endsWith("?") && !RECALL_STEM.test(front)) {
      out.push({ checkId: "AC6.card_front_not_question", severity: "major", unit: `card[${i}].front`,
        job: "a review card front is a question that pulls an idea from memory",
        message: `card[${i}].front "${front.slice(0, 60)}" is a bare label/statement, not a question. Make it a question the reader retrieves an understanding to answer.`, evidence: front.slice(0, 80) });
    }
  });

  // AC4 — whatToDo is a concrete action, not an abstract PROPOSITION/source-claim.
  // (Red-team: do NOT require second-person imperative — clean book is 3rd-person.
  // Fire only on the proposition/claim shape.)
  const PROPOSITION_OPENER = /^(it would|this would|that would|the\s+\w+\s+would|it is\s+(?:the|a|an)?\s*\w+|this is\s+(?:the|a|an)?\s*\w+|the concept|the idea|would be managed through|first,? then ask)/i;
  (ch.examples ?? []).forEach((e, i) => {
    const w = (e.whatToDo ?? "").trim();
    if (!w) return;
    if (PROPOSITION_OPENER.test(w)) {
      out.push({ checkId: "AC4.whatToDo_proposition", severity: "major", unit: `example[${i}].whatToDo`,
        job: "whatToDo names the concrete thing the protagonist DOES, not a proposition about the idea",
        message: `example[${i}].whatToDo opens as an abstract proposition/source-claim ("${w.slice(0, 50)}…") instead of an action the protagonist takes. State what they do.`, evidence: w.slice(0, 80) });
    }
  });

  // AC5 — echo-template explanation: explanation ⊇ (keyed choice ∪ prompt) with
  // no new content of its own. Structurally hides a wrong key. Keys on overlap +
  // a no-new-content remainder; NOT on connective presence (red-team).
  (ch.quiz?.questions ?? []).forEach((q, i) => {
    const expl = (q.explanation ?? "").trim();
    const choices = q.choices ?? [];
    const keyed = typeof q.correctIndex === "number" ? choices[q.correctIndex] ?? "" : "";
    if (!expl || !keyed) return;
    const combined = `${keyed} ${q.prompt ?? ""}`;
    const overlap = containment(expl, combined); // fraction of explanation's content also in choice+prompt
    if (overlap >= 0.85) {
      // does the explanation add ANY new content tokens beyond choice+prompt?
      const explTokens = new Set(contentTokens(expl));
      const combinedSet = new Set(contentTokens(combined));
      const novel = [...explTokens].filter((t) => !combinedSet.has(t));
      if (novel.length <= 2) {
        out.push({ checkId: "AC5.echo_explanation", severity: "major", unit: `quiz.q${String(i + 1).padStart(2, "0")}.explanation`,
          job: "an explanation justifies WHY the keyed choice is right, adding reasoning beyond restating it",
          message: `quiz.q${String(i + 1).padStart(2, "0")} explanation is ${(overlap * 100).toFixed(0)}% a restatement of the keyed choice + prompt with ~no new content. It cannot reveal a wrong key. Write the reasoning that makes the answer correct.`, evidence: expl.slice(0, 90) });
      }
    }
  });

  // AC2 — source paste: a reader field shares a long verbatim run with the
  // sidecar source text. Source is input you reason FROM, not output. Calibrated:
  // clean books (daring-greatly, start-with-why) max out at an 11-word shared run
  // (faithful paraphrase coincidence); the unreasonable-hospitality paste defect
  // has runs of 14–78. Threshold 14 separates them with margin. Sidecar required.
  if (opts?.sidecar) {
    const src = sidecarSourceText(opts.sidecar);
    if (src) {
      for (const f of fields) {
        if (words(f.text).length < 14) continue;
        const run = longestCommonRunWords(f.text, src);
        if (run >= 14) out.push({ checkId: "AC2.source_paste", severity: "major", unit: `${f.unit}.${f.field}`,
          job: "reader fields paraphrase the source into the field's own register; they never paste a source sentence",
          message: `${f.unit}.${f.field} contains a ${run}-word run pasted verbatim from the source notes. Source is input you reason FROM — say it in this field's own voice.`, evidence: `(${run}-word verbatim run)` });
      }
    }
  }

  // AC9 — if-then plan context must not be a SOURCE-ENTITY label. The documented
  // defect is a named source entity used as the context ("Brent Ladd at Purdue
  // University"), not a terse topic label ("Youth selection") — which shipped on
  // clean books and is allowed. Fires only when the context names a source entity
  // (≥60% of its content tokens overlap a sidecar namedExample label) and carries
  // no situational cue. Sidecar required (else skips).
  const SITUATIONAL = /\b(when|if|before|after|during|once|whenever|as soon as|the moment|you notice|you catch|you feel|someone|next time|at the start|right after|just before)\b/i;
  const namedLabels: string[][] = (opts?.sidecar?.namedExamples ?? [])
    .map((e: any) => contentTokens(String(e?.label ?? "")))
    .filter((t: string[]) => t.length > 0);
  if (namedLabels.length > 0) {
    (ch.implementationPlan?.ifThenPlans ?? []).forEach((it, i) => {
      const ctx = (it.context ?? "").trim();
      if (!ctx || SITUATIONAL.test(ctx)) return;
      const ctxTok = contentTokens(ctx);
      if (ctxTok.length === 0) return;
      const isSourceEntity = namedLabels.some((lbl) => {
        const hits = ctxTok.filter((t) => lbl.includes(t)).length;
        return hits / ctxTok.length >= 0.6;
      });
      if (isSourceEntity) {
        out.push({ checkId: "AC9.plan_context_source_entity", severity: "major", unit: `plan.ifThen[${i}].context`,
          job: "an if-then context is a situation the reader is IN, not a source entity's name",
          message: `plan.ifThen[${i}].context "${ctx.slice(0, 50)}" is a source-entity name used as a context. Name the moment the reader experiences (when/if/before/after/once…), not the case it came from.`, evidence: ctx.slice(0, 60) });
      }
    });
  }

  // AC11 — named-framework completeness (config-driven; zero FP by construction).
  // When the chapter NAMES a multi-member framework, all members must appear.
  const bookId = parseChapterId(ch.chapterId ?? "")?.bookId;
  if (bookId) {
    const proseText = [ch.breakdown?.fastRead, ch.breakdown?.deepRead, ch.breakdown?.fullRead, ch.keyTakeaway, ch.counterintuition]
      .filter((s): s is string => typeof s === "string").join("  ");
    for (const fw of frameworksForBook(bookId)) {
      if (!new RegExp(`\\b${reEscape(fw.name)}\\b`, "i").test(proseText)) continue;
      const missing = fw.members.filter((m) => !new RegExp(`\\b${reEscape(m)}\\b`, "i").test(proseText));
      if (missing.length > 0) out.push({ checkId: "AC11.framework_incomplete", severity: "major", unit: "breakdown",
        job: `when the chapter names the ${fw.name} framework, it enumerates all ${fw.members.length} members with the source's exact names`,
        message: `${fw.name} is named but ${missing.length} member(s) are missing or renamed: ${missing.join(", ")}. Enumerate all ${fw.members.length} with the canonical names.`, evidence: fw.name });
    }
  }

  // NOTE: an mtime "slot-fill tripwire" (chapter saved within ~120s of a
  // generator) was prototyped here but DROPPED — on a frozen/restored repo many
  // legitimate chapters share a batch timeframe with the generators, so it
  // false-fired on the clean gold book. Slot-fill protection is instead: the
  // generators are quarantined (scratch/_QUARANTINED-slot-fill/), and the
  // content checks above catch slot-fill OUTPUT regardless of when it was saved.

  return out;
}

/** Pretty-print for the `author-check` CLI — JOB-grouped, surgical. */
export function formatAuthoringReport(chapterId: string, findings: ACFinding[]): string {
  const lines: string[] = [];
  lines.push(`author-check: ${chapterId} — ${findings.length === 0 ? "clean" : `${findings.length} finding(s)`} [shadow: advisory]`);
  for (const f of findings) {
    lines.push(`  [${f.checkId}] ${f.unit}`);
    lines.push(`     JOB: ${f.job}`);
    lines.push(`     ${f.message}`);
  }
  return lines.join("\n");
}
