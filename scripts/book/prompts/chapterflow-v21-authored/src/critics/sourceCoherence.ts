/**
 * Source-coherence critic. Deterministic checks against an assembled
 * researcher bundle (bibliography + per-chapter source notes) BEFORE the
 * downstream pipeline reads it.
 *
 * Catches:
 *   - Chapter-count mismatch between bibliography and rendered sources.
 *   - Empty / stub chapter sources (under 400 chars).
 *   - Meta-references that source-loader's strip rules would silently nuke.
 *   - Cross-chapter duplicate paraphrase notes (the researcher repeating itself).
 *   - Suspicious verbatim-text spans (heuristic: any 40+ char sequence that
 *     looks like literal book prose — quoted lines, page-numbered text, etc.).
 *
 * Fail-close on any blocker. The orchestrator either re-runs the offending
 * chapter or aborts the research session and surfaces the issues.
 */

import { BibliographyResult } from "../agents/researcher-bibliography.js";
import { ChapterResearchResult } from "../agents/researcher-chapter.js";

export type SourceCoherenceFinding = {
  code: string;                       // e.g., "SC1.chapter_count_mismatch"
  severity: "blocker" | "major" | "minor";
  scope: "book" | `chapter:${number}`;
  message: string;
  evidence?: string;
};

export type SourceCoherenceReport = {
  passed: boolean;
  findings: SourceCoherenceFinding[];
};

const META_REGEXES: RegExp[] = [
  /\bthis chapter\b/i,
  /\bthe chapter\b/i,
  /\bthe author\b/i,
  /\bthe book\b/i,
  /\bin this (chapter|section|book)\b/i,
  /\bchapter\s+\d+\b/i,
];

const AUTHOR_VERB_REGEX: RegExp =
  /\b(clear|kahneman|taleb|housel|tetlock|cialdini|greene|machiavelli|duhigg|eyal|covey|ries|brown|kolb|gladwell|fogg)\s+(argues|says|opens|notes|introduces|explains|writes|claims|points out|observes)\b/i;

/** Heuristic: a 40+ char span enclosed in matching quotes is treated as a
 *  potential verbatim citation. The researcher prompt forbids this; we surface
 *  it so the operator can verify it isn't a copyrighted paste. */
const QUOTED_LONG_SPAN: RegExp = /["“][^"”]{40,}["”]/;

export type SourceCoherenceInput = {
  bibliography: BibliographyResult;
  chapters: ChapterResearchResult[];
};

export function runSourceCoherenceCheck(input: SourceCoherenceInput): SourceCoherenceReport {
  const findings: SourceCoherenceFinding[] = [];
  const { bibliography, chapters } = input;

  // SC1 — chapter count consistency
  const expected = bibliography.edition?.chapterCount;
  if (typeof expected === "number" && chapters.length !== expected) {
    findings.push({
      code: "SC1.chapter_count_mismatch",
      severity: "blocker",
      scope: "book",
      message: `Bibliography says ${expected} chapters but researcher returned ${chapters.length}`,
    });
  }

  // SC2 — chapter numbers sequential 1..N
  const sorted = [...chapters].sort((a, b) => a.chapterNumber - b.chapterNumber);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].chapterNumber !== i + 1) {
      findings.push({
        code: "SC2.chapter_numbers_not_sequential",
        severity: "blocker",
        scope: "book",
        message: `chapter numbers not sequential: expected ${i + 1} at position ${i}, got ${sorted[i].chapterNumber}`,
      });
      break;
    }
  }

  // SC3..SC7 — per-chapter checks
  for (const ch of chapters) {
    const scope: `chapter:${number}` = `chapter:${ch.chapterNumber}`;

    // SC3 — paraphrase notes length floor
    if (typeof ch.paraphraseNotes !== "string" || ch.paraphraseNotes.length < 600) {
      findings.push({
        code: "SC3.paraphrase_too_short",
        severity: "blocker",
        scope,
        message: `paraphraseNotes is ${ch.paraphraseNotes?.length ?? 0} chars; minimum 600 (target 1200-2400)`,
      });
    }

    // SC4 — meta-reference leakage
    const allText = [
      ch.focus,
      ch.coreClaim,
      ch.centralConcept?.plainDefinition ?? "",
      ch.centralConcept?.whyItMatters ?? "",
      ...(ch.keyClaims ?? []),
      ...(ch.namedExamples ?? []).flatMap((ex) => [ex.summary, ex.teachesWhat]),
      ch.hardEdge,
      ch.paraphraseNotes,
    ].join(" \n ");

    for (const re of META_REGEXES) {
      const m = allText.match(re);
      if (m) {
        findings.push({
          code: "SC4.meta_reference",
          severity: "blocker",
          scope,
          message: `meta-reference "${m[0]}" found — paraphrase the claim directly without naming the chapter or author`,
          evidence: m.input?.slice(Math.max(0, m.index! - 30), m.index! + m[0].length + 30),
        });
        break;
      }
    }
    const av = allText.match(AUTHOR_VERB_REGEX);
    if (av) {
      findings.push({
        code: "SC5.author_surname_verb",
        severity: "blocker",
        scope,
        message: `author-surname-verb "${av[0]}" — state the claim directly without naming the author as an actor`,
        evidence: av.input?.slice(Math.max(0, av.index! - 30), av.index! + av[0].length + 30),
      });
    }

    // SC6 — long quoted span (possible verbatim leakage)
    const qm = ch.paraphraseNotes?.match(QUOTED_LONG_SPAN);
    if (qm) {
      findings.push({
        code: "SC6.long_quoted_span",
        severity: "major",
        scope,
        message: `40+ char quoted span found in paraphraseNotes; verify this is paraphrase, not a verbatim citation`,
        evidence: qm[0].slice(0, 160),
      });
    }

    // SC7 — named examples must have non-trivial summaries
    if (!Array.isArray(ch.namedExamples) || ch.namedExamples.length === 0) {
      findings.push({
        code: "SC7.no_named_examples",
        severity: "major",
        scope,
        message: `no namedExamples — downstream prose will be abstract. At least 1 named example required.`,
      });
    }
  }

  // SC8 — cross-chapter paraphraseNotes duplication. Detects researcher
  // self-repetition (the same paragraph reused across chapters with minimal
  // edits). Compare with a simple 8-gram hash signature.
  const sigBuckets = new Map<string, number[]>();
  for (const ch of chapters) {
    const text = (ch.paraphraseNotes ?? "").toLowerCase().split(/[^a-z0-9']+/).filter(Boolean);
    for (let i = 0; i <= text.length - 8; i += 4) {
      const sig = text.slice(i, i + 8).join(" ");
      const list = sigBuckets.get(sig) ?? [];
      if (!list.includes(ch.chapterNumber)) list.push(ch.chapterNumber);
      sigBuckets.set(sig, list);
    }
  }
  const crossDuplicates = new Map<number, Set<number>>();
  for (const [sig, chs] of sigBuckets.entries()) {
    if (chs.length < 2) continue;
    for (let i = 0; i < chs.length; i++) {
      for (let j = i + 1; j < chs.length; j++) {
        const a = chs[i];
        const b = chs[j];
        if (!crossDuplicates.has(a)) crossDuplicates.set(a, new Set());
        crossDuplicates.get(a)!.add(b);
      }
    }
  }
  // Report any pair sharing 3+ signature 8-grams.
  const reported = new Set<string>();
  for (const ch of chapters) {
    const partners = crossDuplicates.get(ch.chapterNumber);
    if (!partners) continue;
    for (const partner of partners) {
      const key = `${Math.min(ch.chapterNumber, partner)}-${Math.max(ch.chapterNumber, partner)}`;
      if (reported.has(key)) continue;
      // Count distinct shared 8-grams between this pair
      let shared = 0;
      for (const [, chs] of sigBuckets.entries()) {
        if (chs.includes(ch.chapterNumber) && chs.includes(partner)) shared++;
      }
      if (shared >= 3) {
        reported.add(key);
        findings.push({
          code: "SC8.cross_chapter_paraphrase_duplicate",
          severity: "blocker",
          scope: "book",
          message: `Chapters ${ch.chapterNumber} and ${partner} share ${shared}+ 8-gram signatures in paraphraseNotes — researcher is reusing text across chapters`,
        });
      }
    }
  }

  const blockers = findings.filter((f) => f.severity === "blocker");
  return { passed: blockers.length === 0, findings };
}

export function formatSourceCoherenceReport(r: SourceCoherenceReport): string {
  const lines: string[] = [];
  const blockers = r.findings.filter((f) => f.severity === "blocker");
  const majors = r.findings.filter((f) => f.severity === "major");
  const minors = r.findings.filter((f) => f.severity === "minor");
  lines.push(`Source coherence: ${r.passed ? "PASS" : "BLOCK"} (${blockers.length} blocker, ${majors.length} major, ${minors.length} minor)`);
  for (const f of r.findings) {
    lines.push(`  [${f.code} ${f.severity}] ${f.scope}: ${f.message}`);
    if (f.evidence) lines.push(`     evidence: ${f.evidence.slice(0, 180)}`);
  }
  return lines.join("\n");
}
