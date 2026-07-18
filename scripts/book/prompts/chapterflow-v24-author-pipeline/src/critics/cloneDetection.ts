/**
 * IMP-06 — deterministic exact / near-exact clone detection (instruction 4/10).
 *
 * Book-level, pure functions over the chapter set. Two families, kept separate
 * by design (instruction 10):
 *
 *  EXACT — copied material: byte-identical hooks (normalized), byte-identical
 *  memorable lines, and long shared word n-grams (>= minNgramWords) between two
 *  chapters' reader prose. These are calibrated on clean fixtures and are the
 *  only class eligible for `blocking` in the activation contract.
 *
 *  NEAR — structural reuse: example scenarios with high word-shingle overlap
 *  (Jaccard >= scenarioJaccard) and opener stem families (two hooks opening on
 *  the same first four words). Near-clone stays shadow-first until the IMP-11
 *  held-out calibration (broad similarity must never block on vibes).
 *
 * Everything returns findings as DATA — no gate consumes this module in v25;
 * the shadow report renders it and the activation contract governs any future
 * promotion. Thresholds arrive from the diversity config so a measurement is
 * always attributable to the exact config hash it ran under.
 */

import type { ChapterV21 } from "../types.js";
import { DEFAULT_DIVERSITY_CONFIG, type DiversityConfigV1 } from "../telemetry/diversityConfig.js";
import { PROSE_FORBIDDEN_LABELS } from "../telemetry/internalTaxonomy.js";

export type CloneFindingClass = "exact-clone" | "near-clone";

export type CloneFinding = {
  class: CloneFindingClass;
  kind:
    | "hook-exact"
    | "memorable-line-exact"
    | "long-ngram"
    | "scenario-overlap"
    | "opener-stem-family"
    | "taxonomy-wording";
  chapters: number[];
  /** The shared material (truncated) — the evidence a human verifies. */
  evidence: string;
  /** Measured value where the kind is threshold-based (n-gram length, Jaccard,
   *  family size); 1 for exact matches. */
  measure: number;
};

// ── text utilities ────────────────────────────────────────────────────────────

export function normalizeForClone(text: string): string {
  return text
    .toLowerCase()
    .replace(/["“”'’]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function words(text: string): string[] {
  const n = normalizeForClone(text);
  return n.length === 0 ? [] : n.split(" ");
}

function readerProse(ch: ChapterV21): string {
  const parts: string[] = [];
  const push = (v: unknown): void => { if (typeof v === "string" && v) parts.push(v); };
  push(ch.hook); push(ch.counterintuition); push(ch.keyTakeaway);
  push(ch.breakdown?.fastRead); push(ch.breakdown?.deepRead); push(ch.breakdown?.fullRead);
  for (const ex of ch.examples ?? []) { push(ex?.scenario); push(ex?.whatToDo); push(ex?.whyItMatters); }
  for (const q of ch.quiz?.questions ?? []) { push(q?.prompt); push(q?.explanation); }
  for (const m of ch.memorableLines ?? []) push(m?.text);
  return parts.join("\n");
}

/** All word n-grams of exactly `n` words, as joined strings. */
function ngrams(tokens: string[], n: number): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i + n <= tokens.length; i++) out.add(tokens.slice(i, i + n).join(" "));
  return out;
}

/** Word-shingle (3-gram) Jaccard similarity between two texts. */
export function shingleJaccard(a: string, b: string): number {
  const sa = ngrams(words(a), 3);
  const sb = ngrams(words(b), 3);
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const s of sa) if (sb.has(s)) inter++;
  return inter / (sa.size + sb.size - inter);
}

const TRUNC = 120;
function clip(s: string): string {
  return s.length > TRUNC ? `${s.slice(0, TRUNC - 1)}…` : s;
}

// ── the detector ──────────────────────────────────────────────────────────────

/** Scan a book's chapters for exact and near clones. Pure; deterministic;
 *  findings ordered by (kind, chapter pair). */
export function detectClones(
  chapters: ChapterV21[],
  config: DiversityConfigV1 = DEFAULT_DIVERSITY_CONFIG,
): CloneFinding[] {
  const findings: CloneFinding[] = [];
  const minNgramWords = Math.max(6, Math.round(config.checks["exact-clone"].thresholds.minNgramWords ?? 12));
  const minHookChars = Math.max(8, Math.round(config.checks["exact-clone"].thresholds.minHookChars ?? 24));
  const scenarioJaccard = config.checks["near-clone"].thresholds.scenarioJaccard ?? 0.82;

  const byNumber = [...chapters].sort((a, b) => (a.number ?? 0) - (b.number ?? 0));

  // hook-exact + opener-stem-family
  const hookNorm = new Map<number, string>();
  for (const ch of byNumber) {
    const h = normalizeForClone(ch.hook ?? "");
    if (h.length > 0) hookNorm.set(ch.number, h);
  }
  const seenHookPairs = new Set<string>();
  for (const [na, ha] of hookNorm) {
    for (const [nb, hb] of hookNorm) {
      if (na >= nb) continue;
      if (ha === hb && ha.length >= minHookChars) {
        const key = `${na}-${nb}`;
        if (!seenHookPairs.has(key)) {
          seenHookPairs.add(key);
          findings.push({ class: "exact-clone", kind: "hook-exact", chapters: [na, nb], evidence: clip(ha), measure: 1 });
        }
      }
    }
  }
  const stemFamilies = new Map<string, number[]>();
  for (const [n, h] of hookNorm) {
    const stem = words(h).slice(0, 4).join(" ");
    if (stem.split(" ").length < 4) continue;
    const list = stemFamilies.get(stem) ?? [];
    list.push(n);
    stemFamilies.set(stem, list);
  }
  for (const [stem, members] of stemFamilies) {
    if (members.length >= 2) {
      findings.push({ class: "near-clone", kind: "opener-stem-family", chapters: members.sort((a, b) => a - b), evidence: clip(stem), measure: members.length });
    }
  }

  // memorable-line-exact (across chapters — the same aphorism twice in one book)
  const lineOwners = new Map<string, number[]>();
  for (const ch of byNumber) {
    for (const m of ch.memorableLines ?? []) {
      const norm = normalizeForClone(m?.text ?? "");
      if (norm.length < 12) continue;
      const owners = lineOwners.get(norm) ?? [];
      if (!owners.includes(ch.number)) owners.push(ch.number);
      lineOwners.set(norm, owners);
    }
  }
  for (const [line, owners] of lineOwners) {
    if (owners.length >= 2) {
      findings.push({ class: "exact-clone", kind: "memorable-line-exact", chapters: owners.sort((a, b) => a - b), evidence: clip(line), measure: 1 });
    }
  }

  // long-ngram between chapter pairs (prose-wide copied runs)
  const proseTokens = new Map<number, string[]>();
  for (const ch of byNumber) proseTokens.set(ch.number, words(readerProse(ch)));
  const nums = [...proseTokens.keys()];
  for (let i = 0; i < nums.length; i++) {
    for (let j = i + 1; j < nums.length; j++) {
      const a = ngrams(proseTokens.get(nums[i])!, minNgramWords);
      const b = ngrams(proseTokens.get(nums[j])!, minNgramWords);
      let shared: string | null = null;
      for (const g of a) { if (b.has(g)) { shared = g; break; } }
      if (shared) {
        findings.push({ class: "exact-clone", kind: "long-ngram", chapters: [nums[i], nums[j]], evidence: clip(shared), measure: minNgramWords });
      }
    }
  }

  // scenario-overlap (near): any example pair across chapters above the Jaccard bar
  type Slot = { chapter: number; text: string };
  const slots: Slot[] = [];
  for (const ch of byNumber) {
    for (const ex of ch.examples ?? []) {
      if (typeof ex?.scenario === "string" && ex.scenario.length > 0) slots.push({ chapter: ch.number, text: ex.scenario });
    }
  }
  const seenScenarioPairs = new Set<string>();
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      if (slots[i].chapter === slots[j].chapter) continue;
      const key = `${slots[i].chapter}-${slots[j].chapter}`;
      if (seenScenarioPairs.has(key)) continue;
      const sim = shingleJaccard(slots[i].text, slots[j].text);
      if (sim >= scenarioJaccard) {
        seenScenarioPairs.add(key);
        findings.push({
          class: "near-clone",
          kind: "scenario-overlap",
          chapters: [slots[i].chapter, slots[j].chapter].sort((a, b) => a - b),
          evidence: clip(normalizeForClone(slots[i].text)),
          measure: Math.round(sim * 100) / 100,
        });
      }
    }
  }

  // taxonomy-wording (exact): internal labels reproduced in reader prose
  for (const ch of byNumber) {
    const prose = readerProse(ch).toLowerCase();
    for (const label of PROSE_FORBIDDEN_LABELS) {
      const needle = label.toLowerCase();
      const rx = new RegExp(`(?:^|[^a-z0-9-])${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|[^a-z0-9-])`);
      if (rx.test(prose)) {
        findings.push({ class: "exact-clone", kind: "taxonomy-wording", chapters: [ch.number], evidence: label, measure: 1 });
      }
    }
  }

  return findings;
}
