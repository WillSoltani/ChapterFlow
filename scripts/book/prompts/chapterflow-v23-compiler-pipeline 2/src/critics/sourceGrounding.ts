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

import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { ChapterV21, CriticFinding, SourceAnchorForPrompt, SourceClaimType } from "../types.js";
import { finding } from "./shared.js";
import { parseChapterId } from "../lib/chapterPaths.js";
import { findLatestRunDir, findRunArtifact } from "../lib/runDirs.js";
import { detectSidecarShape } from "../source/sidecarSchema.js";
import { buildSourceAnchorCatalog } from "../source/sourceEvidence.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// SC9 lives in src/critics/, so it needs one more `..` than helpers in
// src/ (which use ../../../../..).
const REPO = resolve(__dirname, "../..");
const RUNS_DIR = resolve(REPO, ".chapterflow/runs");

/** Shared sidecar loader (Phase 1) — resolves a chapter's source sidecar via the
 *  casing-normalized bookId, returns the parsed object or null. Used by SC9 and
 *  by author-check (so AC1/AC2 can read the real centralConcept + source text).
 *  Artifact-aware (runDirs.findRunArtifact): falls through past run dirs that
 *  don't contain this chapter's sidecar — the rework/zz- burial bug class. */
export function loadChapterSidecar(chapterId: string): any | null {
  const parsed = parseChapterId(chapterId);
  if (!parsed) return null;
  const sidecarPath = findRunArtifact(
    RUNS_DIR,
    parsed.bookId,
    `sidecars/source/ch${String(parsed.num).padStart(2, "0")}.source.json`,
  );
  if (!sidecarPath) return null;
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
  const anchorCatalog = buildSourceAnchorCatalog(sc);
  const anchors = new Map(anchorCatalog.map((anchor) => [anchor.id, anchor]));
  const expectedPrefix = `ch${String(chapter.number).padStart(2, "0")}.`;
  const effective = chapter.authoring?.sourceAnchors?.effectiveAnchors ?? {};

  const idsFor = (path: string, legacy?: unknown, fallbackPath?: string): string[] => {
    const mapped = normalizeAnchorIds(effective[path]);
    if (mapped.length > 0) return mapped;
    const legacyIds = normalizeAnchorIds(legacy);
    if (legacyIds.length > 0) return legacyIds;
    if (fallbackPath) return normalizeAnchorIds(effective[fallbackPath]);
    return [];
  };

  type Unit = { unit: string; path: string; claimType: SourceClaimType; ids: string[]; text: string };
  const units: Unit[] = [];
  const push = (unit: string, path: string, claimType: SourceClaimType, ids: string[], text: string | undefined) => {
    units.push({ unit, path, claimType, ids, text: text ?? "" });
  };

  push("hook", "hook", "hook", idsFor("hook", (chapter as any).hookSourceAnchorIds), chapter.hook);
  if (chapter.counterintuition) {
    push("counterintuition", "counterintuition", "hook", idsFor("counterintuition", (chapter as any).counterintuitionSourceAnchorIds, "hook"), chapter.counterintuition);
  }
  push("breakdown.fastRead", "breakdown.fastRead", "breakdown_claim", idsFor("breakdown.fastRead"), chapter.breakdown?.fastRead);
  push("breakdown.deepRead", "breakdown.deepRead", "breakdown_claim", idsFor("breakdown.deepRead"), chapter.breakdown?.deepRead);
  push("breakdown.fullRead", "breakdown.fullRead", "breakdown_claim", idsFor("breakdown.fullRead"), chapter.breakdown?.fullRead);
  push("keyTakeaway", "keyTakeaway", "takeaway", idsFor("keyTakeaway", (chapter as any).keyTakeawaySourceAnchorIds), chapter.keyTakeaway);
  if (chapter.tryThisNow) {
    push("tryThisNow", "tryThisNow", "implementation_guidance", idsFor("tryThisNow", (chapter as any).tryThisNowSourceAnchorIds), chapter.tryThisNow);
  }

  chapter.examples?.forEach((e, i) => {
    push(
      `example[${i}]`,
      `examples[${i}]`,
      "example",
      idsFor(`examples[${i}]`, (e as any).sourceAnchorIds ?? e.sourceAnchorId),
      `${e.title ?? ""} ${e.scenario ?? ""} ${e.whatToDo ?? ""} ${e.whyItMatters ?? ""}`,
    );
  });

  chapter.quiz?.questions?.forEach((q, i) => {
    const base = `quiz.questions[${i}]`;
    const ci = typeof q.correctIndex === "number" ? q.choices?.[q.correctIndex] ?? "" : "";
    const qIds = idsFor(base, (q as any).sourceAnchorIds ?? q.sourceAnchorId);
    push(`quiz.questions[${i}].prompt`, `${base}.prompt`, "quiz_prompt", idsFor(`${base}.prompt`, undefined, base).concat(qIds).filter(uniqueInOrder), q.prompt ?? "");
    push(`quiz.questions[${i}].explanation`, `${base}.explanation`, "quiz_explanation", idsFor(`${base}.explanation`, undefined, base).concat(qIds).filter(uniqueInOrder), q.explanation ?? "");
    const keyIds = idsFor(`${base}.keyEvidence`, (q as any).keyEvidenceAnchorIds, base);
    push(`quiz.questions[${i}].keyEvidence`, `${base}.keyEvidence`, "quiz_key_evidence", keyIds.length > 0 ? keyIds : qIds, `${q.prompt ?? ""} ${ci} ${q.explanation ?? ""}`);
  });

  chapter.reviewCards?.forEach((c, i) => {
    push(
      `reviewCards[${i}]`,
      `reviewCards[${i}]`,
      "review_card",
      idsFor(`reviewCards[${i}]`, (c as any).sourceAnchorIds ?? c.sourceAnchorId),
      `${c.front ?? ""} ${c.back ?? ""}`,
    );
  });

  const impl = chapter.implementationPlan;
  if (impl) {
    push("implementationPlan.title", "implementationPlan.title", "implementation_guidance", idsFor("implementationPlan.title", (impl as any).titleSourceAnchorIds), impl.title);
    push("implementationPlan.coreSkill", "implementationPlan.coreSkill", "implementation_guidance", idsFor("implementationPlan.coreSkill", (impl as any).coreSkillSourceAnchorIds), impl.coreSkill);
    impl.ifThenPlans?.forEach((it, i) => {
      push(
        `implementationPlan.ifThenPlans[${i}]`,
        `implementationPlan.ifThenPlans[${i}]`,
        "implementation_guidance",
        idsFor(`implementationPlan.ifThenPlans[${i}]`, (it as any).sourceAnchorIds ?? it.sourceAnchorId),
        `${it.context ?? ""} ${it.plan ?? ""}`,
      );
    });
    push("implementationPlan.twentyFourHourChallenge", "implementationPlan.twentyFourHourChallenge", "implementation_guidance", idsFor("implementationPlan.twentyFourHourChallenge", (impl as any).twentyFourHourChallengeSourceAnchorIds), impl.twentyFourHourChallenge);
    push("implementationPlan.weeklyPractice", "implementationPlan.weeklyPractice", "implementation_guidance", idsFor("implementationPlan.weeklyPractice", (impl as any).weeklyPracticeSourceAnchorIds), impl.weeklyPractice);
  }

  chapter.memorableLines?.forEach((line, i) => {
    push(
      `memorableLines[${i}]`,
      `memorableLines[${i}]`,
      "memorable_line",
      idsFor(`memorableLines[${i}]`, (line as any).sourceAnchorIds, line.location),
      `${line.text ?? ""} ${line.why ?? ""}`,
    );
  });

  for (const unit of units) {
    checkUnit(unit, anchors, expectedPrefix, findings);
  }

  return findings;
}

function normalizeAnchorIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  if (typeof value === "string" && value.trim()) return [value];
  return [];
}

function uniqueInOrder(value: string, index: number, array: string[]): boolean {
  return array.indexOf(value) === index;
}

function placeholderAnchorId(id: string): boolean {
  return /^(anchor|source-anchor|sourceAnchor|id|todo|tbd|fixme|placeholder)([-_:]?\d*)?$/i.test(id.trim()) ||
    /\b(todo|tbd|fixme|placeholder)\b/i.test(id);
}

function checkUnit(
  unit: { unit: string; claimType: SourceClaimType; ids: string[]; text: string },
  anchors: Map<string, SourceAnchorForPrompt>,
  expectedPrefix: string,
  findings: CriticFinding[],
): void {
  if (unit.ids.length === 0) {
    findings.push(finding("SC11.1.missing_provenance" as any, "blocker",
      `${unit.unit} has no source anchors — a source-v2 chapter must declare which source anchor each claim-bearing unit is built from.`));
    return;
  }
  for (const anchorId of unit.ids) {
    if (placeholderAnchorId(anchorId)) {
      findings.push(finding("SC11.3.placeholder_anchor" as any, "blocker",
        `${unit.unit} cites placeholder source anchor "${anchorId}". Cite a stable id from the validated source-v2 sidecar.`, anchorId));
      continue;
    }
    const anchor = anchors.get(anchorId);
    if (!anchor) {
      const chapterMatch = anchorId.match(/^ch\d+\./i);
      const checkId = chapterMatch && !anchorId.startsWith(expectedPrefix)
        ? "SC11.4.wrong_chapter_anchor"
        : "SC11.5.unknown_anchor";
      findings.push(finding(checkId as any, "blocker",
        `${unit.unit} cites source anchor "${anchorId}" which is not allowed for this chapter. Cite a real anchor id from ${expectedPrefix}*.`, anchorId));
      continue;
    }
    if (!anchor.supportsClaimTypes.includes(unit.claimType)) {
      findings.push(finding("SC11.6.unsupported_anchor" as any, "blocker",
        `${unit.unit} cites "${anchorId}" (${anchor.kind}), but that anchor does not support ${unit.claimType} claims. Use an anchor whose supportsClaimTypes includes ${unit.claimType}.`, anchorId));
      continue;
    }
    const specifics = anchor.hardSpecifics ?? [];
    if (specifics.length >= 2) {
      const lc = unit.text.toLowerCase();
      const present = specifics.filter((s) => s && lc.includes(s.toLowerCase())).length;
      if (present < 2) {
        findings.push(finding("SC11.2.anchor_specific_not_present" as any, "blocker",
          `${unit.unit} names anchor "${anchorId}" but uses <2 of its hardSpecifics (${specifics.slice(0, 4).join(", ")}). Build the unit FROM the anchor's concrete details.`, anchorId));
      }
    }
  }
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

  const latestRun = findLatestRunDir(RUNS_DIR, bookId);
  if (!latestRun) {
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
  // Artifact-aware: take the sidecar from the NEWEST run that actually has it
  // (a rework run dir without ch01-08 sidecars must not hide the originals).
  const sidecarPath = findRunArtifact(RUNS_DIR, bookId, `sidecars/source/ch${chNum}.source.json`);
  if (!sidecarPath) {
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
  // v2: testableFacts carry real entities too (e.g. "Pierre Omidyar" in a claim).
  for (const f of sidecar?.testableFacts ?? []) {
    if (typeof f?.claim === "string") texts.push(f.claim);
    if (typeof f?.becauseMechanism === "string") texts.push(f.becauseMechanism);
  }

  // Exclude the chapter's own title words from the candidate pool so a
  // chapter doesn't auto-pass by referencing its own title in scenarios.
  const titleWords = new Set(
    (chapter.title ?? "")
      .toLowerCase()
      .split(/[^a-z0-9'-]+/)
      .filter((w) => w.length >= 4),
  );
  const candidates = extractProperNouns(texts, titleWords);
  // v2: hardSpecifics are curated REAL anchors (e.g. "eBay", "auction marketplace")
  // — add them directly so lowercase-initial / multi-word entities count, which the
  // capital-first proper-noun regex would otherwise miss (the eBay false-positive).
  for (const ex of namedExamples) {
    if (ex && typeof ex === "object") {
      for (const s of (ex as any).hardSpecifics ?? []) {
        const t = String(s).toLowerCase().trim();
        if (t.length >= 3 && !titleWords.has(t)) candidates.add(t);
      }
    }
  }
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
