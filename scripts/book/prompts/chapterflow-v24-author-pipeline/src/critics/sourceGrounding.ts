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

import { existsSync, readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { ChapterV21, CriticFinding, SourceAnchorForPrompt, SourceClaimType } from "../types.js";
import type { SourceUsePlanV1 } from "../contracts/sourceUsePlan.js";
import { sourceUsePlanPath } from "../artifacts/artifactStore.js";
import { finding } from "./shared.js";
import { isPageCitationOnly } from "./apparatusLeakage.js";
import { parseChapterId } from "../lib/chapterPaths.js";
import { findLatestRunDir, findRunArtifact } from "../lib/runDirs.js";
import { countSpecificsInProse, normalizeDerivabilityText } from "../sections/chapterProse.js";
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

  // ---- SC11.7 — the chapter TEACHES every case it cites ---------------------
  //
  // The ship-side mirror of SEC14/SEC128. It is what replaces the per-unit verbatim
  // demands the table above zeroed out: grounding is no longer "every unit repeats a
  // token" but "the chapter's reader-visible prose carries at least two of each cited
  // case's hard specifics, once". Same rule, same folding (chapterProse), so a chapter
  // that passes the write-time gate passes this one by construction — measured on the
  // live Franklin rev-6 candidate, where it fires zero on all four chapters.
  {
    const prose = normalizeDerivabilityText([
      chapter.hook ?? "",
      chapter.counterintuition ?? "",
      chapter.breakdown?.fastRead ?? "",
      chapter.breakdown?.deepRead ?? "",
      chapter.breakdown?.fullRead ?? "",
      chapter.keyTakeaway ?? "",
    ].join("\n"));
    const citedRich = new Map<string, SourceAnchorForPrompt>();
    for (const unit of units) {
      // SCOPE: the units a reader is TESTED or INSTRUCTED on, never the examples.
      // The write-time rule (SEC128) does cover the example pack — a chapter whose
      // scenes borrow a case its prose never states is a real coverage gap, and a
      // fresh draft can be retried into shape. At SHIP time the same arm would
      // retro-block already-promoted packages for a defect no repair round is aimed
      // at, so the ship mirror keeps the scope SEC120 chose for the same reason: a
      // quiz must be answerable from what the READER READS as the chapter, and a
      // fictional scene is not that. Ship ⊆ write in every case, which is the
      // property that matters — this gate never blocks what compile passed.
      if (unit.claimType === "example") continue;
      for (const anchorId of unit.ids) {
        const anchor = anchors.get(anchorId);
        if (!anchor?.supportsClaimTypes.includes(unit.claimType)) continue;
        if ((anchor.hardSpecifics ?? []).length < CHAPTER_CASE_MIN_SPECIFICS) continue;
        citedRich.set(anchorId, anchor);
      }
    }
    for (const [anchorId, anchor] of citedRich) {
      const present = countSpecificsInProse(anchor.hardSpecifics ?? [], prose);
      if (present >= CHAPTER_CASE_MIN_SPECIFICS) continue;
      findings.push(finding("SC11.7.chapter_case_not_taught" as any, "blocker",
        `this chapter cites "${anchorId}" but its reader-visible prose (hook, counterintuition, the three tiers, keyTakeaway) carries only ${present}/${CHAPTER_CASE_MIN_SPECIFICS} of that case's hardSpecifics (${(anchor.hardSpecifics ?? []).slice(0, 4).join(", ")}). A chapter may not test a case it never taught.`,
        anchorId));
    }
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

/**
 * SHIP-LAYER MIRROR OF THE WRITE-TIME GROUNDING RULES (package 1B).
 *
 * The ship gate must never block what the write-time gate passes, or every freshly
 * compiled book re-blocks at QC — the exact write/ship disagreement this file has
 * already been burned by twice (live: regenerated POM ch01 passed validate-sections
 * with 0 blockers, then gate-chapter threw 42 SC11.2 blockers, all on quiz/cards/plan
 * units). So this table is derived FROM the section gate, one entry per claim type:
 *
 *   example                 -> 1   (SEC33: one specific POOLED across scenario /
 *                                   whatToDo / whyItMatters)
 *   implementation_guidance -> 1   (SEC74, unchanged)
 *   everything else         -> 0   (no per-unit verbatim demand)
 *
 * The zeros are the package-1B demotion, and they are paid for on BOTH sides. At
 * write time SEC56/SEC58 stopped demanding a token per quiz unit and per card, and
 * SEC14's per-unit quota on the hook, the three tiers and the keyTakeaway became a
 * once-per-chapter presence rule; the grounding those quotas were standing in for is
 * now SEC14/SEC128 (the chapter's prose must TEACH every case it cites) plus SEC120
 * (a unit may not name what the prose never showed). At ship time SC11.7 below is the
 * mirror of that chapter-level rule, so the ship gate still refuses an ungrounded
 * chapter — it just no longer counts tokens per unit.
 */
const CLAIM_TYPE_MIN_SPECIFICS: ReadonlyMap<SourceClaimType, number> = new Map<SourceClaimType, number>([
  ["example", 1],
  ["implementation_guidance", 1],
]);

/** At most this many source specifics may appear in a memorable line — the ship-side
 *  reading of SEC16's redesigned rule (a line states the principle; the case itself is
 *  taught by the tiers). MAJOR, not a blocker: every package promoted before this
 *  change carries token-pair lines (11 of the 12 in the live Franklin rev-6 package),
 *  and a blocker here would retro-block them at re-promote for a defect the write-time
 *  gate now prevents at the source. */
const SHIP_MEMORABLE_LINE_MAX_SPECIFICS = 1;

/** SC11.7 — hard specifics of a cited case that must reach the chapter's own
 *  reader-visible prose. Mirrors sectionGate's CHAPTER_CASE_MIN_SPECIFICS. */
const CHAPTER_CASE_MIN_SPECIFICS = 2;

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
  // MEMORABLE LINES (package 1B): the demand is inverted. It used to be ">=2 of one
  // cited case's hardSpecifics verbatim", which is why every shipped line is a token
  // pair; the write-time rule is now a CAP of one, enforced by SEC16. Here it is
  // reported, not blocked — see SHIP_MEMORABLE_LINE_MAX_SPECIFICS.
  if (unit.claimType === "memorable_line") {
    const lc = unit.text.toLowerCase();
    const carried = new Set<string>();
    for (const anchor of anchors.values()) {
      for (const specific of anchor.hardSpecifics ?? []) {
        if (specific && specific.length >= 3 && lc.includes(specific.toLowerCase())) carried.add(specific);
      }
    }
    if (carried.size > SHIP_MEMORABLE_LINE_MAX_SPECIFICS) {
      findings.push(finding("SC11.8.memorable_line_specific_stack" as any, "major",
        `${unit.unit} carries ${carried.size} source specifics — ${[...carried].slice(0, 4).join(", ")}. A memorable line states the principle and carries at most ${SHIP_MEMORABLE_LINE_MAX_SPECIFICS}; the case itself is taught by the tiers.`));
    }
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
    // The outer `>= 2` stays even for min-1 units: anchors carrying a single hardSpecific
    // remain ship-unchecked (the write-time section gate enforces them for NEW books), so
    // previously-shipped v2 chapters cannot retro-block at re-promote.
    const minRequired = CLAIM_TYPE_MIN_SPECIFICS.get(unit.claimType) ?? 0;
    if (specifics.length >= 2 && minRequired > 0) {
      const lc = unit.text.toLowerCase();
      // CF-J Task 4 (2026-07-09): a hardSpecific that IS a page citation ("Ch. 6
      // p. 138") is the source guide's internal locator coordinate, and the writer
      // projection now WITHHOLDS it from the writer (sourcePacketProjection strips
      // citation spans; the release review proved writers were quoting them into
      // reader prose to satisfy exactly this presence check). An internal coordinate
      // can never be REQUIRED reader-visible text, so it counts as satisfied by
      // construction. Strictly TOLERANT: `present` can only rise, so findings(new)
      // ⊆ findings(old) — previously-shipped v2 chapters (which DO quote the cites)
      // gate identically, and no unit can newly block.
      const present = specifics.filter((s) => s && (isPageCitationOnly(s) || lc.includes(s.toLowerCase()))).length;
      if (present < minRequired) {
        findings.push(finding("SC11.2.anchor_specific_not_present" as any, "blocker",
          `${unit.unit} names anchor "${anchorId}" but uses <${minRequired} of its hardSpecifics (${specifics.slice(0, 4).join(", ")}). Build the unit FROM the anchor's concrete details.`, anchorId));
      }
    }
  }
}

/** IMP-09 (instruction 4): count the source-use plan's units whose DECLARED
 *  origin is generic/constructed — the compiler licensed exactly that many
 *  reader units to carry NO source proper noun (their register is validated by
 *  C37/the register advisories instead). Plan absent → 0 (legacy behavior,
 *  byte-identical). Plan present but unreadable → 0: for a CRITIC the strict
 *  no-plan behavior is the FAIL-CLOSED direction (the author lane separately
 *  converts a corrupt plan into a refusal — authorRun.readSourcePlan). */
function planLicensedUnanchoredUnits(chapter: ChapterV21, planOverride?: SourceUsePlanV1 | null): number {
  let plan: SourceUsePlanV1 | null = null;
  if (planOverride !== undefined) {
    plan = planOverride;
  } else {
    try {
      const parsed = parseChapterId(chapter.chapterId ?? "");
      if (!parsed) return 0;
      const p = sourceUsePlanPath(parsed.bookId, parsed.num);
      plan = existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as SourceUsePlanV1) : null;
    } catch {
      return 0;
    }
  }
  if (!plan || !Array.isArray(plan.units)) return 0;
  return plan.units.filter((u) => u.origin === "generic" || u.origin === "constructed").length;
}

export function checkExampleSourceGrounding(
  chapter: ChapterV21,
  planOverride?: SourceUsePlanV1 | null,
  sidecarOverride?: unknown,
): CriticFinding[] {
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

  const latestRun = sidecarOverride !== undefined ? "explicit-sidecar" : findLatestRunDir(RUNS_DIR, bookId);
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
  const sidecarPath = sidecarOverride !== undefined
    ? "explicit-sidecar"
    : findRunArtifact(RUNS_DIR, bookId, `sidecars/source/ch${chNum}.source.json`);
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
  if (sidecarOverride !== undefined) sidecar = sidecarOverride;
  else {
    try {
      sidecar = JSON.parse(readFileSync(sidecarPath, "utf8"));
    } catch {
      return findings;
    }
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
  //
  // IMP-09 (instruction 4): the compiler's source-use plan may LICENSE units
  // as generic/constructed — those are validated by their declared register
  // (C37, register advisories) and must NOT be forced to restamp a source
  // name. The plan does not bind units to example slots, so the allowance is
  // positional and conservative: up to `licensedUnanchored` unmatched
  // scenarios (ascending index) are licensed; every unmatched scenario BEYOND
  // the plan's allowance fires the same MAJOR as before. No plan → allowance
  // 0 → byte-identical legacy behavior.
  findings.push(...scenarioGroundingFindings(
    chapter.examples ?? [],
    candidates,
    planLicensedUnanchoredUnits(chapter, planOverride),
  ));
  return findings;
}

/** The SC9 scenario loop, extracted pure for direct testing (IMP-09): each
 *  scenario must word-boundary-match ≥1 candidate anchor; up to
 *  `licensedUnanchored` unmatched scenarios (ascending index — the plan does
 *  not bind units to slots) are licensed by dealt generic/constructed plan
 *  units; every unmatched scenario beyond the allowance fires the SAME MAJOR
 *  as pre-IMP-09. licensedUnanchored=0 (no plan) is byte-identical legacy
 *  behavior. */
export function scenarioGroundingFindings(
  examples: ChapterV21["examples"],
  candidates: ReadonlySet<string>,
  licensedUnanchored: number,
): CriticFinding[] {
  const findings: CriticFinding[] = [];
  let licensedRemaining = licensedUnanchored;
  const list = examples ?? [];
  for (let i = 0; i < list.length; i++) {
    const ex = list[i];
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
    if (licensedRemaining > 0) {
      licensedRemaining--;
      continue; // licensed by a dealt generic/constructed plan unit
    }

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
