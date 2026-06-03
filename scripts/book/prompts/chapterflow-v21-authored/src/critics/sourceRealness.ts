/**
 * SC10 — source REALNESS (Phase 3). `check-source` (SC1–SC8) validates the
 * bibliography + sidecar STRUCTURE; it passes on "nothing to check" — a sidecar
 * of pure concept-labels with no real cases sails through, and that is the
 * upstream cause of word-salad ("vague source = vague book").
 *
 * SC10 measures whether the source notes contain REAL, specific material.
 *
 * GATING (red-team hard rule — cannot brick the 1581 existing v1 sidecars):
 *   - v2 sidecars: ENFORCED (blocker). A v2 sidecar must carry testableFacts +
 *     real named entities + non-degenerate facts.
 *   - v1 sidecars (rich + thin): ADVISORY only. One low-noise book-scope finding
 *     summarizing grounding strength; never a blocker.
 */

import { SourceCoherenceFinding } from "./sourceCoherence.js";
import { detectSidecarShape } from "../source/sidecarSchema.js";

const ABSTRACTION = new Set(
  "system systems framework principle principles mindset approach method process model models concept idea ideas factor factors force forces strategy strategies rule rules law laws practice practices habit habits skill skills value values goal goals theory lens cycle loop type level stage step phase pattern".split(" "),
);
const CAUSAL = /\b(because|since|so that|which means|the result|leads to|causes|drives|therefore|so the|in order to|that is why)\b/i;

function realEntityCount(sc: any): number {
  const blob: string[] = [];
  for (const e of sc?.namedExamples ?? []) blob.push(`${e?.label ?? ""} ${e?.summary ?? ""} ${(e?.hardSpecifics ?? []).join(" ")}`);
  blob.push(`${sc?.paraphraseNotes ?? ""} ${sc?.hardEdge ?? ""}`);
  for (const p of sc?.properNouns ?? []) blob.push(String(p));
  const txt = blob.join("  ");
  const concept = [
    ...String(sc?.centralConcept?.name ?? "").toLowerCase().split(/\s+/),
    ...String(sc?.chapterTitle ?? sc?.title ?? "").toLowerCase().split(/\s+/),
  ];
  const ents = new Set<string>();
  for (const m of txt.match(/\b[A-Z][a-z]+(?:\s+(?:[A-Z][a-z]+|and|of|the))*|\b[A-Z]{2,}\b/g) ?? []) {
    const toks = m.toLowerCase().split(/\s+/).filter((t) => t !== "and" && t !== "of" && t !== "the");
    if (toks.length && !toks.every((t) => concept.includes(t) || ABSTRACTION.has(t))) ents.add(m.toLowerCase());
  }
  for (const m of txt.match(/\b\d[\d,.]*\s?(?:%|percent|million|billion|years?)?/g) ?? []) if (/\d/.test(m)) ents.add(m);
  return ents.size;
}

function contentTokens(s: string): string[] {
  return (s.toLowerCase().match(/[a-z0-9']+/g) ?? []).filter((w) => w.length > 2);
}

/** Run SC10 across a book's sidecars. `chapters` is the sidecar array (same as
 *  runSourceCoherenceCheck input). Returns findings to merge into that report. */
export function checkSourceRealness(chapters: any[]): SourceCoherenceFinding[] {
  const findings: SourceCoherenceFinding[] = [];
  let weakV1 = 0;

  chapters.forEach((sc, i) => {
    const chNum = Number(sc?.chapterNumber ?? sc?.number ?? i + 1);
    const shape = detectSidecarShape(sc);

    if (shape === "v2") {
      // ── v2: ENFORCED (blocker) ──────────────────────────────────────────
      const facts = Array.isArray(sc?.testableFacts) ? sc.testableFacts : [];
      if (facts.length < 9) {
        findings.push({ code: "SC10.1.missing_testable_facts", severity: "blocker", scope: `chapter:${chNum}`,
          message: `v2 sidecar has ${facts.length} testableFacts (need ≥9 — one per quiz question). Each is {claim, becauseMechanism, commonError, errorIsWhy} and seeds a correct, well-explained, non-strawman question.` });
      }
      if (realEntityCount(sc) < 2) {
        findings.push({ code: "SC10.2.no_real_named_entity", severity: "blocker", scope: `chapter:${chNum}`,
          message: `v2 sidecar has <2 real named entities (companies/people/studies/numbers) — the writer will fill templates with concept-labels (the word-salad predictor). Add real cases with hardSpecifics.` });
      }
      for (const f of facts) {
        const claim = String(f?.claim ?? ""), err = String(f?.commonError ?? ""), mech = String(f?.becauseMechanism ?? "");
        if (claim && err) {
          const ct = contentTokens(claim);
          const es = new Set(contentTokens(err));
          const ov = ct.length ? ct.filter((t) => es.has(t)).length / ct.length : 0;
          if (ov >= 0.8) findings.push({ code: "SC10.3.degenerate_testable_fact", severity: "blocker", scope: `chapter:${chNum}`,
            message: `testableFact "${f?.id ?? ""}": commonError is ~the claim reworded (≥80% overlap). A distractor seed must be a DIFFERENT plausible-but-wrong belief, not a negation of the answer.`, evidence: err.slice(0, 80) });
        }
        if (mech && !CAUSAL.test(mech)) findings.push({ code: "SC10.3.degenerate_testable_fact", severity: "blocker", scope: `chapter:${chNum}`,
          message: `testableFact "${f?.id ?? ""}": becauseMechanism has no causal link — it must explain WHY the claim is true (because/since/so that…), so it can seed a real explanation.`, evidence: mech.slice(0, 80) });
      }
    } else {
      // ── v1 (rich + thin): ADVISORY only ─────────────────────────────────
      if (shape === "thin-v1" || shape === "unknown" || realEntityCount(sc) < 2) weakV1++;
    }
  });

  // One low-noise book-scope advisory summarizing v1 grounding strength.
  const v1Total = chapters.filter((sc) => detectSidecarShape(sc) !== "v2").length;
  if (v1Total > 0 && weakV1 / v1Total >= 0.5) {
    findings.push({ code: "SC10.weak_source_grounding", severity: "minor", scope: "book",
      message: `${weakV1}/${v1Total} chapters have weak source grounding (thin sidecar shape or <2 real named entities). This is the upstream predictor of templated/word-salad output. For stronger grounding, re-run STEP-1 with the v2 schema (testableFacts + namedExamples with hardSpecifics). Advisory — does not block.` });
  }
  return findings;
}
