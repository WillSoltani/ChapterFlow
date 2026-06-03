/**
 * Source-grounding critics — ensure chapter content is anchored in the
 * book's source material rather than invented from generic templates.
 *
 * Root-cause analysis from the May 2026 Start With Why incident: the
 * writer agent shipped 14 chapters whose example scenarios used invented
 * characters at invented locations with zero reference to Sinek's real
 * named cases (American/Japanese car-door assembly, Wright brothers,
 * Apple, MLK, TiVo, Southwest, etc.). Once detached from the source,
 * scenarios become interchangeable; every downstream templating defect
 * (BP13 stock phrases, BP2 skeleton drift, AS9/AS10 cross-chapter
 * reuse) follows naturally.
 *
 * SC9 closes this at chapter-write time by reading the chapter's
 * source sidecar and requiring each scenario to reference at least one
 * named entity from `namedExamples`. The writer can no longer ship
 * generic decision scenes — they have to use real source material.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { ChapterV21, CriticFinding } from "../types.js";
import { finding } from "./shared.js";
import { parseChapterId } from "../lib/chapterPaths.js";
import { detectSidecarShape } from "../source/sidecarSchema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// SC9 lives in src/critics/, so it needs one more `..` than helpers in
// src/ (which use ../../../../..).
const REPO = resolve(__dirname, "../../../../../..");
const RUNS_DIR = resolve(REPO, ".chapterflow/runs");

function findLatestRun(bookId: string): string | null {
  const bookDir = resolve(RUNS_DIR, bookId);
  if (!existsSync(bookDir)) return null;
  const runs = readdirSync(bookDir)
    .filter((d) => {
      try {
        return statSync(resolve(bookDir, d)).isDirectory();
      } catch {
        return false;
      }
    })
    .sort();
  return runs.length > 0 ? runs[runs.length - 1] : null;
}

/** Shared sidecar loader (Phase 1) — resolves a chapter's source sidecar via the
 *  casing-normalized bookId, returns the parsed object or null. Used by SC9 and
 *  by author-check (so AC1/AC2 can read the real centralConcept + source text). */
export function loadChapterSidecar(chapterId: string): any | null {
  const parsed = parseChapterId(chapterId);
  if (!parsed) return null;
  const runId = findLatestRun(parsed.bookId);
  if (!runId) return null;
  const sidecarPath = resolve(RUNS_DIR, parsed.bookId, runId, "sidecars/source", `ch${String(parsed.num).padStart(2, "0")}.source.json`);
  if (!existsSync(sidecarPath)) return null;
  try {
    return JSON.parse(readFileSync(sidecarPath, "utf8"));
  } catch {
    return null;
  }
}

// Words that look proper-noun-shaped in titles + summaries but are not
// useful anchors for source-grounding. Includes generic concept words
// and chapter-shape words that an LLM would capitalize-by-default.
const PROPER_NOUN_STOPWORDS = new Set([
  "the", "and", "that", "this", "with", "from", "have", "were", "will",
  "what", "when", "where", "while", "their", "them", "they", "these",
  "those", "then", "than", "into", "over", "under", "about", "after",
  "before", "because", "could", "would", "should", "might", "still",
  "just", "also", "very", "more", "most", "some", "many", "much",
  "other", "another", "here", "there", "both",
  "chapter", "section", "book", "author", "reader", "example", "case",
  "first", "second", "third", "each", "every", "none", "such", "same",
  "kind", "type", "thing", "things", "people", "person", "team",
  "group", "story", "stories", "summary", "lesson", "lessons", "idea",
  "ideas", "point", "points", "rule", "rules", "claim", "claims",
  "principle", "principles", "concept", "concepts",
]);

/**
 * Extract candidate proper-noun fingerprints from a list of strings.
 *
 * Heuristic: capitalized 4+ character words (so a leading-capital
 * sentence is not over-extracted) excluding common stopwords and the
 * chapter's own title words. Returns lowercase set for case-insensitive
 * matching against scenario text.
 */
function extractProperNouns(texts: string[], excluded: Set<string>): Set<string> {
  const out = new Set<string>();
  for (const text of texts) {
    if (!text) continue;
    // Single proper-noun-shaped tokens: Capitalized 4+ chars total
    // (uppercase + 3 more), excludes single-letter caps.
    const single = text.match(/[A-Z][A-Za-z0-9'-]{3,}/g) || [];
    for (const m of single) {
      const lower = m.toLowerCase();
      if (PROPER_NOUN_STOPWORDS.has(lower)) continue;
      if (excluded.has(lower)) continue;
      out.add(lower);
    }
    // ALL-CAPS acronyms (2+ chars), with optional possessive 's. Catches
    // "WHY", "HOW", "MLK", "NASA", "MIT" — short tokens that the
    // single-word pattern misses but that are real source anchors. The
    // stopword filter still catches generic caps ("AND", "BUT").
    const acronyms = text.match(/\b[A-Z]{2,}(?:'s)?\b/g) || [];
    for (const m of acronyms) {
      const lower = m.toLowerCase();
      if (PROPER_NOUN_STOPWORDS.has(lower)) continue;
      if (excluded.has(lower)) continue;
      out.add(lower);
    }
    // Hyphenated multi-word proper terms ("car-door", "inside-out",
    // "WHY-HOW-WHAT"). Often the technical anchors a source uses.
    // Allow 3-char prefix so short distinctive terms are captured.
    const hyphenated = text.match(/[A-Za-z]{3,}(?:-[A-Za-z]{2,}){1,}/g) || [];
    for (const m of hyphenated) {
      const lower = m.toLowerCase();
      if (excluded.has(lower)) continue;
      out.add(lower);
    }
  }
  return out;
}

/**
 * SC9 — chapter-time source-grounding for example scenarios.
 *
 * Reads the chapter's sidecar at
 *   .chapterflow/runs/<bookId>/<runId>/sidecars/source/ch<NN>.source.json
 * extracts proper-noun fingerprints from `namedExamples[*].label` and
 * `namedExamples[*].summary`, and fires MAJOR per `examples[i].scenario`
 * that references none of them.
 *
 * Calibrated to skip rather than false-positive on chapters whose source
 * notes are too abstract to yield proper-noun anchors (< 3 candidates).
 * Sidecar missing → skip. Sidecar unparseable → skip. Title words and
 * common stopwords filtered out so a chapter doesn't pass by echoing its
 * own title.
 */
/**
 * SC11 — declared provenance (Phase 3). The Goodhart-resistant grounding core:
 * every reader unit names the source anchor it was built from (`sourceAnchorId`),
 * and the gate verifies the unit actually USES that anchor's concrete specifics —
 * not a generic sentence that merely mentions a proper noun (which is how the
 * source-dilution evasion defeats SC9's inferred grounding).
 *
 * GATED behind v2 (hard rule): only runs when the chapter's sidecar is
 * schemaVersion source-v2. v1 chapters (all current) skip → zero effect, no brick.
 */
export function checkChapterProvenance(chapter: ChapterV21, sidecarOverride?: any): CriticFinding[] {
  const sc = sidecarOverride ?? loadChapterSidecar(chapter.chapterId);
  if (!sc || detectSidecarShape(sc) !== "v2") return []; // v2-only — v1 cannot brick
  const findings: CriticFinding[] = [];

  // anchorId -> hardSpecifics (namedExamples carry them; facts/concept have none).
  const anchors = new Map<string, string[]>();
  for (const e of sc.namedExamples ?? []) if (e?.id) anchors.set(String(e.id), (e.hardSpecifics ?? []).map(String));
  for (const f of sc.testableFacts ?? []) if (f?.id) anchors.set(String(f.id), []);
  if (sc.centralConcept?.id) anchors.set(String(sc.centralConcept.id), []);

  const checkUnit = (unit: string, anchorId: string | undefined, text: string) => {
    if (!anchorId) {
      findings.push(finding("SC11.1.missing_provenance" as any, "blocker",
        `${unit} has no sourceAnchorId — a v2 chapter must declare which source anchor each unit is built from (declare-then-write). Add the anchor id it dramatizes.`));
      return;
    }
    if (!anchors.has(anchorId)) {
      findings.push(finding("SC11.1.missing_provenance" as any, "blocker",
        `${unit} cites sourceAnchorId "${anchorId}" which is not an anchor in this chapter's sidecar (dangling/fabricated). Cite a real namedExample/testableFact/concept id.`, anchorId));
      return;
    }
    const specifics = anchors.get(anchorId)!;
    if (specifics.length >= 2) {
      const lc = text.toLowerCase();
      const present = specifics.filter((s) => s && lc.includes(s.toLowerCase())).length;
      if (present < 2) {
        findings.push(finding("SC11.2.anchor_specific_not_present" as any, "blocker",
          `${unit} names anchor "${anchorId}" but uses <2 of its hardSpecifics (${specifics.slice(0, 4).join(", ")}). Build the unit FROM the anchor's concrete details — a generic sentence that just mentions it doesn't ground the content (this is what the source-dilution evasion exploits).`, anchorId));
      }
    }
  };

  chapter.examples?.forEach((e, i) => checkUnit(`example[${i}].scenario`, e.sourceAnchorId, e.scenario ?? ""));
  chapter.quiz?.questions?.forEach((q, i) => {
    const ci = typeof q.correctIndex === "number" ? q.choices?.[q.correctIndex] ?? "" : "";
    checkUnit(`quiz.q${String(i + 1).padStart(2, "0")}`, q.sourceAnchorId, `${q.prompt ?? ""} ${ci} ${q.explanation ?? ""}`);
  });
  chapter.reviewCards?.forEach((c, i) => checkUnit(`card[${i}]`, c.sourceAnchorId, `${c.front ?? ""} ${c.back ?? ""}`));
  chapter.implementationPlan?.ifThenPlans?.forEach((it, i) => checkUnit(`plan.ifThen[${i}]`, it.sourceAnchorId, `${it.context ?? ""} ${it.plan ?? ""}`));

  return findings;
}

export function checkExampleSourceGrounding(chapter: ChapterV21): CriticFinding[] {
  const findings: CriticFinding[] = [];
  const id = chapter.chapterId;
  if (typeof id !== "string" || !id) return findings;
  // Phase 0 casing fix: normalize the bookId so the sidecar lookup isn't broken
  // by a capital chapterId — the SAME bug class that silently skipped AS5–AS12
  // also silently skipped source-grounding (findLatestRun was case-sensitive).
  const parsed = parseChapterId(id);
  if (!parsed) return findings;
  const bookId = parsed.bookId;
  const chNum = String(parsed.num).padStart(2, "0");

  const runId = findLatestRun(bookId);
  if (!runId) {
    // SC11.0 (Phase 0, SHADOW = major) — no source run on disk. Missing source
    // reliably predicts word-salad; surface it loudly instead of the old silent
    // pass (`return findings`). Promotes to BLOCKER in Phase 3 once every active
    // book is guaranteed a resolvable sidecar (with a schemaVersion migration).
    return [
      finding(
        "SC11.0.no_source_run" as any,
        "major",
        `no source run found for "${bookId}" under .chapterflow/runs/ — this chapter was authored without on-disk source notes, which reliably predicts ungrounded/templated content. Run STEP-1 / check-source. [shadow: major — promotes to blocker in Phase 3]`,
      ),
    ];
  }
  const sidecarPath = resolve(
    RUNS_DIR,
    bookId,
    runId,
    "sidecars/source",
    `ch${chNum}.source.json`,
  );
  if (!existsSync(sidecarPath)) {
    return [
      finding(
        "SC11.0.no_source_run" as any,
        "major",
        `source run exists for "${bookId}" but no sidecar at ch${chNum}.source.json — this chapter has no source notes for grounding. [shadow: major — promotes to blocker in Phase 3]`,
      ),
    ];
  }

  let sidecar: any;
  try {
    sidecar = JSON.parse(readFileSync(sidecarPath, "utf8"));
  } catch {
    return findings;
  }

  const namedExamples = sidecar?.namedExamples ?? [];
  if (!Array.isArray(namedExamples) || namedExamples.length === 0) return findings;

  // Build the candidate-proper-noun pool from every source field that
  // names a chapter-specific concept or case. Includes:
  //   - namedExamples[*].label + summary
  //   - centralConcept.name + plainDefinition + whyItMatters
  //   - hardEdge (string or array)
  //   - paraphraseNotes (string or array)
  // This ensures concept-heavy chapters whose source-material anchor is
  // a framework name ("Golden Circle", "WHY/HOW/WHAT", "Circle of
  // Influence") are not false-positives.
  const texts: string[] = [];
  for (const ex of namedExamples) {
    if (typeof ex === "string") texts.push(ex);
    else if (ex && typeof ex === "object") {
      if (typeof ex.label === "string") texts.push(ex.label);
      if (typeof ex.summary === "string") texts.push(ex.summary);
    }
  }
  const cc = sidecar?.centralConcept;
  if (cc && typeof cc === "object") {
    if (typeof cc.name === "string") texts.push(cc.name);
    if (typeof cc.plainDefinition === "string") texts.push(cc.plainDefinition);
    if (typeof cc.whyItMatters === "string") texts.push(cc.whyItMatters);
  } else if (typeof cc === "string") {
    texts.push(cc);
  }
  const pushIfText = (v: unknown) => {
    if (typeof v === "string") texts.push(v);
    else if (Array.isArray(v)) for (const item of v) if (typeof item === "string") texts.push(item);
  };
  pushIfText(sidecar?.hardEdge);
  pushIfText(sidecar?.paraphraseNotes);

  // Exclude the chapter's own title words from the candidate pool so a
  // chapter doesn't auto-pass by referencing its own title in scenarios.
  const titleWords = new Set(
    (chapter.title ?? "")
      .toLowerCase()
      .split(/[^a-z0-9'-]+/)
      .filter((w) => w.length >= 4),
  );
  const candidates = extractProperNouns(texts, titleWords);
  // If the sidecar is too abstract to yield anchors, skip to avoid
  // false-positives on legitimately concept-heavy chapters. Threshold
  // of 2 is conservative — a chapter with only one proper-noun anchor
  // would force every example to reference the same name, creating its
  // own templating problem.
  if (candidates.size < 2) return findings;

  // For each example, check if scenario contains any candidate as a
  // word-boundary match (case-insensitive).
  const examples = chapter.examples ?? [];
  for (let i = 0; i < examples.length; i++) {
    const ex = examples[i];
    if (!ex) continue;
    const scenario = typeof ex.scenario === "string" ? ex.scenario : "";
    if (!scenario) continue;
    const scenarioLower = scenario.toLowerCase();
    let matched: string | null = null;
    for (const c of candidates) {
      const re = new RegExp(`\\b${c.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`);
      if (re.test(scenarioLower)) {
        matched = c;
        break;
      }
    }
    if (matched) continue;

    const sampleAnchors = [...candidates].slice(0, 6).map((c) => `"${c}"`).join(", ");
    findings.push(
      finding(
        "SC9.example_not_source_grounded" as any,
        "major",
        `examples[${i}].scenario does not reference any named entity from this chapter's source notes (sidecar offers anchors like ${sampleAnchors}). Rewrite this scenario to use one of the chapter's namedExamples — invented set pieces (a generic name + a generic location) drift into templating because they're untethered from real source material.`,
        scenario.slice(0, 180),
      ),
    );
  }
  return findings;
}
