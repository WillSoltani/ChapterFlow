/**
 * v24 Chapter Briefs (B1) — one page of reservations + intent per chapter.
 *
 * The v23 blueprint deals EVERY slot from small vocabularies (5 ifThen shapes, 9 quiz prompt
 * shapes, …) → book-wide rotations that the variety scout then blocks after writing. The v24
 * author architecture inverts that: the writer owns structure, and the brief reserves ONLY the
 * things where cross-chapter collisions actually hurt —
 *
 *   HARD reservations: ownedCases / notYours (source-case partition), cast (chapter-disjoint
 *   invented names), answerIndexPattern (the anti-gaming quiz-key deal);
 *   NON-BINDING intent: coreMove / thesis / readerPromise, avoid, flavor, lengthBudget.
 *
 * Purely ADDITIVE. The compiler/legacy path never reads briefs; briefs reuse (never re-derive)
 * the blueprint compiler's deterministic deals — coreMove mirrors the P13 rule (pinned by a
 * parity test against the pre-P13 golden), cast reuses dealAllowedNames, the quiz key reuses
 * answerPattern — so a brief and a blueprint compiled from the same packets can never disagree.
 */
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

import { CANONICAL_STATE, chapterFileName, normSlug } from "../lib/chapterPaths.js";
import { readCanonicalChapterIndex } from "../lib/chapterSet.js";
import {
  chapterBriefMdPath,
  chapterBriefPath,
  readJsonFile,
  sourcePacketPath,
  writeJsonFile,
  writeTextFile,
  type CompilerStoreRoots,
} from "../artifacts/artifactStore.js";
import {
  CHAPTER_BRIEF_SCHEMA_VERSION,
  type ChapterBriefV1,
  type SourcePacketV1,
} from "../artifacts/artifactTypes.js";
import {
  CHALLENGE_FRAMES,
  CHALLENGE_INSTRUCTION,
  EXAMPLE_LENSES,
  LENS_INSTRUCTION,
  OPENER_INSTRUCTION,
  OPENER_TYPES,
  PRACTICE_INSTRUCTION,
  PRACTICE_SHAPES,
  PRACTICE_VERBS,
  dealBriefRotations,
  oneThirdCap,
  twoThirdsCap,
  type BriefRotation,
  type ExampleLens,
} from "./briefRotation.js";
import type { ChapterSpec } from "../generateChapter.js";
import { C7_BANNED_NAMES } from "../critics/finalGate.js";
import {
  answerPattern,
  compilerNameBank,
  dealAllowedNames,
  readSlotSalts,
  resolvedPoolsForBook,
} from "./chapterBlueprint.js";
import { protectedSourceNames } from "./sourceNames.js";

/** The blueprint compiler always deals a 9-question quiz (quizCount in compileChapterBlueprint);
 *  the brief's answerIndexPattern must be the same 9-slot deal. */
export const BRIEF_QUIZ_SLOT_COUNT = 9;
export const DEFAULT_LENGTH_BUDGET_CHARS = 16000;
export const LENGTH_BUDGET_TOLERANCE = 0.2;
export const LENGTH_BUDGET_MIN = 8000;
export const LENGTH_BUDGET_MAX = 30000;
const NOT_YOURS_CAP = 20;
const AVOID_CAP = 6;
const FLAVOR_CAP = 5;
const CAST_TARGET = 4; // 2-4 invented names per chapter
const CAST_MIN = 2;
const OPENER_SIGNATURE_WORDS = 8;

export type CompileChapterBriefsOpts = {
  roots?: CompilerStoreRoots;
  /** Target rendered chapter size in chars (default 16000). Guidance, not a contract. */
  lengthBudget?: number;
};

export type CompileChapterBriefsResult = {
  bookId: string;
  briefs: ChapterBriefV1[];
  findings: string[];
};

export type WriteChapterBriefsResult = {
  bookId: string;
  written: string[];
  findings: string[];
};

function oneLine(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * The chapter's core move — a faithful reimplementation of the P13 rule inlined in
 * chapterBlueprint.buildPlan (coreMoveFactId's mechanism, else its claim; legacy fallback
 * facts[0].mechanism/claim; last resort a title-derived line). Parity with the blueprint is
 * pinned by tests/chapter-brief.test.ts against the pre-P13 legacy golden AND a ranked packet.
 */
export function briefCoreMove(packet: SourcePacketV1, chapterTitle: string): string {
  const coreFact = packet.coreMoveFactId ? packet.facts.find((f) => f.id === packet.coreMoveFactId) : undefined;
  return (coreFact?.mechanism || coreFact?.claim)
    || packet.facts[0]?.mechanism || packet.facts[0]?.claim
    || `Use ${chapterTitle} as a concrete decision tool.`;
}

/** One line: the highest-teachingPriority fact's claim (legacy fallback: the first fact). */
export function briefThesis(packet: SourcePacketV1): string {
  const ranked = packet.facts
    .filter((f) => typeof f.teachingPriority === "number")
    .sort((a, b) => (a.teachingPriority! - b.teachingPriority!) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const fact = ranked[0] ?? packet.facts[0];
  return oneLine(fact?.claim ?? "");
}

/** Deterministic template. Guidance, not contract. */
export function briefReaderPromise(coreMove: string): string {
  const move = oneLine(coreMove);
  if (!move) return "";
  return `After this chapter, a reader can ${move.charAt(0).toLowerCase()}${move.slice(1)}`;
}

/** Union of real source-person names (bank-colliding) across ALL packets, plus the global
 *  reserved source figures. Brief cast must never touch any of these. */
function bookProtectedNames(packets: SourcePacketV1[]): Set<string> {
  const bank = compilerNameBank();
  const out = new Set<string>();
  for (const packet of packets) {
    for (const name of protectedSourceNames(packet, bank)) out.add(name);
  }
  return out;
}

const C7_BANNED = new Set(C7_BANNED_NAMES);

/** First-example scenario opening signature (first N words) of an on-disk sibling chapter file,
 *  or null when the file/example/scenario is absent (fresh book). Regen-only signal. */
function siblingOpenerSignature(chapterId: string, chaptersDir: string): string | null {
  const p = resolve(chaptersDir, chapterFileName(chapterId));
  if (!existsSync(p)) return null;
  try {
    const chapter = JSON.parse(readFileSync(p, "utf8")) as { examples?: Array<{ scenario?: unknown }> };
    const raw = chapter?.examples?.[0]?.scenario;
    // Legacy examples carry MaybeToned scenarios ({ direct, … }); v21-native ones are strings.
    const scenario = typeof raw === "string"
      ? raw
      : raw && typeof raw === "object" && typeof (raw as { direct?: unknown }).direct === "string"
        ? (raw as { direct: string }).direct
        : null;
    if (typeof scenario !== "string") return null;
    const words = oneLine(scenario).split(" ").filter(Boolean);
    if (words.length === 0) return null;
    return words.slice(0, OPENER_SIGNATURE_WORDS).join(" ");
  } catch {
    return null; // an unreadable sibling must never fail a brief compile — avoid is best-effort
  }
}

/** Defensive rotation for a chapter number the whole-book deal did not cover (e.g. an index whose
 *  numbers are non-contiguous). Deterministic single-chapter deal — never throws, never Math.random. */
function fallbackRotation(n: number): BriefRotation {
  const i = Math.max(1, n) - 1;
  return {
    openerType: OPENER_TYPES[i % OPENER_TYPES.length],
    challengeFrame: CHALLENGE_FRAMES[i % CHALLENGE_FRAMES.length],
    practiceShape: PRACTICE_SHAPES[i % PRACTICE_SHAPES.length],
    exampleLenses: [0, 1, 2].map((k) => EXAMPLE_LENSES[(i * 3 + k) % EXAMPLE_LENSES.length]),
    practiceVerb: PRACTICE_VERBS[i % PRACTICE_VERBS.length],
    requireFrictionExample: true, // degraded path: prefer the requirement over the ritual concern
  };
}

/**
 * v24 S-tier P1 — the book's hot FRAMEWORK NOUNS, computed deterministically from the
 * source packets (available before any chapter exists; stable across regens). The halted
 * `execution` run saturated its framework vocabulary ('review' 246×/9ch, 'owner' 121×,
 * all 9/9 chapters) because nine parallel writers each taught the full framework at full
 * strength with no vocabulary plan. Each brief lists these nouns WITH a usage budget; the
 * overflow valve is the chapter's case-concrete referents, never invented synonyms.
 *
 * Ranking: content words (len>3, generic-English stoplisted) by packet SPREAD first (a
 * framework noun is one every chapter's packet carries), then total frequency, then alpha
 * for determinism. Top 6. Pure.
 */
const FRAMEWORK_NOUN_STOP = new Set([
  // structural words that recur in any packet regardless of the book's framework
  "chapter", "book", "reader", "people", "person", "work", "make", "makes", "making",
  "time", "thing", "things", "way", "ways", "place", "good", "better", "best", "real",
  "clear", "small", "large", "high", "moment", "moments", "example", "point", "part",
  "well", "right", "wrong", "keep", "keeps", "turn", "turns", "help", "helps", "need",
  "needs", "want", "wants", "know", "knows", "come", "comes", "take", "takes", "give",
  "gives", "used", "uses", "using", "instead", "without", "within", "become", "becomes",
]);

export function hotFrameworkNouns(packets: SourcePacketV1[], top = 6): string[] {
  const freq = new Map<string, number>();
  const spread = new Map<string, Set<number>>();
  for (const packet of packets) {
    const text = (packet.facts ?? [])
      .flatMap((f) => [f.claim, f.mechanism, f.commonError, f.whyWrong])
      .filter((s): s is string => typeof s === "string" && s.length > 0)
      .join("\n")
      .toLowerCase();
    for (const w of text.replace(/[^a-z'\s-]/g, " ").split(/\s+/)) {
      if (w.length <= 3 || FRAMEWORK_NOUN_STOP.has(w)) continue;
      freq.set(w, (freq.get(w) ?? 0) + 1);
      if (!spread.has(w)) spread.set(w, new Set());
      spread.get(w)!.add(packet.chapterNumber);
    }
  }
  const majority = Math.max(2, Math.ceil(packets.length / 2));
  return [...freq.keys()]
    .filter((w) => (spread.get(w)?.size ?? 0) >= majority)
    .sort((a, b) =>
      (spread.get(b)!.size - spread.get(a)!.size)
      || (freq.get(b)! - freq.get(a)!)
      || (a < b ? -1 : a > b ? 1 : 0))
    .slice(0, top);
}

export function compileChapterBriefs(bookId: string, opts: CompileChapterBriefsOpts = {}): CompileChapterBriefsResult {
  const normalized = normSlug(bookId);
  const roots = opts.roots ?? {};
  const index = readCanonicalChapterIndex(normalized, roots.stateRoot);
  if (!index.ok) return { bookId: normalized, briefs: [], findings: index.blockers.map((b) => `${b.checkId}: ${b.message}`) };

  const findings: string[] = [];
  const chapters: Array<{ spec: ChapterSpec; packet: SourcePacketV1 }> = [];
  for (const spec of index.chapters) {
    const packetP = sourcePacketPath(normalized, spec.chapterNumber, roots);
    if (!existsSync(packetP)) {
      findings.push(`ch${String(spec.chapterNumber).padStart(2, "0")}: missing source packet at ${packetP}`);
      continue;
    }
    try {
      chapters.push({ spec, packet: readJsonFile<SourcePacketV1>(packetP) });
    } catch (err) {
      findings.push(`ch${String(spec.chapterNumber).padStart(2, "0")}: unreadable source packet at ${packetP}: ${(err as Error).message}`);
    }
  }

  const totalChapters = index.chapters.length;
  const salts = readSlotSalts(normalized, roots);
  const protectedNames = bookProtectedNames(chapters.map((c) => c.packet));
  const chaptersDir = resolve(roots.stateRoot ?? CANONICAL_STATE, "chapters");

  // Flavor: non-binding venue/frame suggestions from the book design pools — ONLY when a design
  // artifact exists (resolvedPoolsForBook returns source "derived"); genre-fallback/legacy → [].
  const pools = resolvedPoolsForBook(normalized, roots);
  const flavorFor = (n: number): string[] => {
    if (pools.source !== "derived") return [];
    const palette = pools.venuePaletteFor(n);
    const frameD = pools.sceneFramesDecision.length ? pools.sceneFramesDecision[(n - 1) % pools.sceneFramesDecision.length] : null;
    const frameE = pools.sceneFramesExperiential.length ? pools.sceneFramesExperiential[(n - 1) % pools.sceneFramesExperiential.length] : null;
    const out = [
      ...palette.slice(0, 3).map((v) => `venue: ${v}`),
      ...(frameD ? [`frame: ${frameD}`] : []),
      ...(frameE ? [`frame: ${frameE}`] : []),
    ];
    return [...new Set(out)].slice(0, FLAVOR_CAP);
  };
  const flavorByChapter = new Map<number, string[]>(chapters.map(({ spec }) => [spec.chapterNumber, flavorFor(spec.chapterNumber)]));

  // Cast: reuse the blueprint's deterministic name deal per chapter (bucketed, sibling-replayed,
  // salt-aware), then filter against the BOOK-WIDE protected-name union and the names already
  // reserved by earlier chapters' briefs, so cast is disjoint across the whole book AND never a
  // real source person from ANY packet. Chapters are walked in ascending order (determinism).
  const usedCast = new Set<string>();
  const castFor = (spec: ChapterSpec, packet: SourcePacketV1): string[] => {
    const { allowedNames } = dealAllowedNames(normalized, spec.chapterNumber, packet, roots, salts);
    const cast: string[] = [];
    for (const name of allowedNames) {
      if (cast.length >= CAST_TARGET) break;
      if (protectedNames.has(name) || usedCast.has(name) || C7_BANNED.has(name)) continue;
      cast.push(name);
    }
    // Cross-packet protected names can (rarely) starve a chapter's dealt slice below the floor;
    // top up deterministically from the bank, still honoring every exclusion.
    if (cast.length < CAST_MIN) {
      for (const name of compilerNameBank()) {
        if (cast.length >= CAST_MIN) break;
        if (protectedNames.has(name) || usedCast.has(name) || C7_BANNED.has(name) || cast.includes(name)) continue;
        cast.push(name);
      }
    }
    for (const name of cast) usedCast.add(name);
    return cast;
  };

  const labelsByChapter = new Map<number, string[]>(
    chapters.map(({ spec, packet }) => [spec.chapterNumber, packet.namedCases.map((c) => c.label).filter(Boolean)]),
  );

  // v24 W4: deal the opener/challenge-frame/practice-shape rotations for the WHOLE book (over the
  // canonical chapter count, not just the readable-packet subset, so the deal is stable even if a
  // packet is transiently missing). Every brief gets its dealt reservation.
  const rotations = dealBriefRotations(normalized, totalChapters);
  // v24 S-tier P1: one book-wide hot-noun list, computed from every readable packet so all
  // chapters share the SAME budget list (per-chapter lists would let a noun saturate anyway).
  const frameworkNouns = hotFrameworkNouns(chapters.map((c) => c.packet));

  const briefs: ChapterBriefV1[] = [];
  for (const { spec, packet } of chapters) {
    const n = spec.chapterNumber;
    const coreMove = briefCoreMove(packet, spec.chapterTitle);
    const ownLabelsLower = new Set((labelsByChapter.get(n) ?? []).map((l) => l.toLowerCase()));
    const notYours = [...new Set(
      chapters
        .filter((c) => c.spec.chapterNumber !== n)
        .flatMap((c) => labelsByChapter.get(c.spec.chapterNumber) ?? [])
        .filter((label) => !ownLabelsLower.has(label.toLowerCase())),
    )].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)).slice(0, NOT_YOURS_CAP);

    // Avoid: (a) sibling openers already on disk (regen case), ascending; then (b) sibling
    // briefs' flavor picks, ascending. Deduped, capped. Empty is fine for a fresh book.
    const avoid: string[] = [];
    for (const other of chapters) {
      if (other.spec.chapterNumber === n) continue;
      const sig = siblingOpenerSignature(other.spec.chapterId, chaptersDir);
      if (sig) avoid.push(`opener (ch${String(other.spec.chapterNumber).padStart(2, "0")}): "${sig}"`);
    }
    for (const other of chapters) {
      if (other.spec.chapterNumber === n) continue;
      for (const pick of flavorByChapter.get(other.spec.chapterNumber) ?? []) {
        avoid.push(`flavor (ch${String(other.spec.chapterNumber).padStart(2, "0")}): ${pick}`);
      }
    }

    briefs.push({
      schemaVersion: CHAPTER_BRIEF_SCHEMA_VERSION,
      chapterId: spec.chapterId,
      chapterNumber: n,
      title: spec.chapterTitle,
      coreMove,
      thesis: briefThesis(packet),
      readerPromise: briefReaderPromise(coreMove),
      ownedCases: packet.namedCases.map((c) => ({ id: c.id, label: c.label })),
      notYours,
      cast: castFor(spec, packet),
      answerIndexPattern: answerPattern(n, BRIEF_QUIZ_SLOT_COUNT, totalChapters),
      avoid: [...new Set(avoid)].slice(0, AVOID_CAP),
      lengthBudget: { renderedChars: opts.lengthBudget ?? DEFAULT_LENGTH_BUDGET_CHARS, tolerance: LENGTH_BUDGET_TOLERANCE },
      flavor: flavorByChapter.get(n) ?? [],
      openerType: (rotations.get(n) ?? fallbackRotation(n)).openerType,
      challengeFrame: (rotations.get(n) ?? fallbackRotation(n)).challengeFrame,
      practiceShape: (rotations.get(n) ?? fallbackRotation(n)).practiceShape,
      exampleLenses: (rotations.get(n) ?? fallbackRotation(n)).exampleLenses,
      practiceVerb: (rotations.get(n) ?? fallbackRotation(n)).practiceVerb,
      requireFrictionExample: (rotations.get(n) ?? fallbackRotation(n)).requireFrictionExample,
      frameworkNouns,
    });
  }

  return { bookId: normalized, briefs, findings };
}

/** The three EXPLICIT writer instructions the v24 W4 rotation deals: the hook opener MODE, the
 *  24-hour-challenge framing (always banning the "In the next 24 hours," stem), and the tryThisNow
 *  structure. Rendered verbatim into the brief md (and reused by the author card) so the writer gets
 *  a mode, not a bare label. */
export function briefVarietyInstructionLines(brief: ChapterBriefV1): string[] {
  const opener = OPENER_INSTRUCTION[brief.openerType] ?? `Open the hook in "${brief.openerType}" mode.`;
  const frame = CHALLENGE_INSTRUCTION[brief.challengeFrame] ?? `frame it as "${brief.challengeFrame}"`;
  const practice = PRACTICE_INSTRUCTION[brief.practiceShape] ?? `Shape tryThisNow as "${brief.practiceShape}".`;
  const lines = [
    `- OPENER: ${opener} Carry the SAME mode into the fastRead opening sentence.`,
    `- 24-HOUR CHALLENGE: Frame it as ${brief.challengeFrame} — ${frame} Do NOT use the "In the next 24 hours," stem.`,
    `- PRACTICE: ${practice}`,
  ];
  // v24 S-tier P2/P4/P1 — optional fields; briefs compiled before 2026-07-03 render the
  // original three lines unchanged.
  if (brief.exampleLenses && brief.exampleLenses.length > 0) {
    // #14 (adversarial round 2): the friction-example requirement is DEALT to ceil(2N/3)
    // chapters, not stamped on all — a dutiful failure-example ×9 is the next ritual.
    const friction = brief.requireFrictionExample
      ? " At least ONE of your examples must show the move failing or only partially working — real friction, not another frictionless win."
      : "";
    lines.push(`- EXAMPLE SCENES: your 6 examples must cover all three dealt lenses below; at most 2 examples may be a person-handling-a-document scene.${friction}`);
    for (const lens of brief.exampleLenses) {
      const instruction = LENS_INSTRUCTION[lens as ExampleLens] ?? `use the "${lens}" scene class.`;
      lines.push(`    * ${lens}: ${instruction}`);
    }
  }
  if (brief.practiceVerb) {
    lines.push(`- PRACTICE VERB: build the physical actions in tryThisNow and the 24-hour challenge around "${brief.practiceVerb}" — not "touch" or "open" (other chapters own other verbs; a shared verb becomes a book-wide tic).`);
  }
  if (brief.frameworkNouns && brief.frameworkNouns.length > 0) {
    lines.push(
      `- FRAMEWORK VOCABULARY BUDGET: the book's framework nouns are: ${brief.frameworkNouns.join(", ")}. Every chapter leans on them, so they saturate book-wide. Your budget: the single noun you need most ≤15 uses in this chapter; every other listed noun ≤10. The same budget applies to any generic role-noun you find yourself repeating (owner, leader, manager) even if unlisted — name people by their case names and titles instead. When the budget is spent, use YOUR cases' concrete referents — the person's name, the artifact, the number — never an invented formal synonym ("the accountable party" is worse than the budget).`,
    );
  }
  return lines;
}

/** The compact human page the writer card embeds. Aim well under ~2,200 chars for a typical
 *  chapter (bounded by construction: notYours ≤ 20, avoid ≤ 6, flavor ≤ 5). */
export function renderBriefMd(brief: ChapterBriefV1): string {
  const nn = String(brief.chapterNumber).padStart(2, "0");
  const lines: string[] = [];
  lines.push(`# Chapter ${brief.chapterNumber} — ${brief.title} (${brief.chapterId})`);
  lines.push("");
  lines.push("## THE MOVE");
  lines.push(brief.coreMove);
  lines.push(`Thesis: ${brief.thesis}`);
  lines.push("");
  lines.push("## PROMISE");
  lines.push(brief.readerPromise || "(none)");
  lines.push("");
  lines.push("## VARIETY (dealt — do NOT default to the house pattern)");
  for (const line of briefVarietyInstructionLines(brief)) lines.push(line);
  lines.push("");
  lines.push("## YOUR CASES");
  if (brief.ownedCases.length) {
    lines.push("Yours alone — scene them fully:");
    for (const c of brief.ownedCases) lines.push(`- ${c.label} (${c.id})`);
  } else {
    lines.push("(no named source cases in this chapter)");
  }
  lines.push("");
  lines.push("## NOT YOURS");
  if (brief.notYours.length) {
    lines.push("Other chapters own these — never scene them; at most one passing mention:");
    for (const label of brief.notYours) lines.push(`- ${label}`);
  } else {
    lines.push("(nothing reserved by other chapters)");
  }
  lines.push("");
  lines.push("## CAST");
  lines.push(`Invented first names reserved for ch${nn}: ${brief.cast.join(", ") || "(none)"}.`);
  lines.push("Use only these; never a real source-person name.");
  lines.push("");
  lines.push("## QUIZ KEY PATTERN");
  lines.push(`Correct-answer indexes (0-2) for Q1-Q${brief.answerIndexPattern.length}, in order: ${brief.answerIndexPattern.join(", ")}.`);
  lines.push("Write each question so its correct choice lands at the dealt index.");
  lines.push("");
  lines.push("## AVOID");
  if (brief.avoid.length) {
    for (const a of brief.avoid) lines.push(`- ${a}`);
  } else {
    lines.push("(nothing yet — fresh book)");
  }
  lines.push("");
  lines.push("## LENGTH");
  lines.push(`Target ~${brief.lengthBudget.renderedChars} rendered chars (±${Math.round(brief.lengthBudget.tolerance * 100)}%).`);
  lines.push("");
  lines.push("## FLAVOR");
  if (brief.flavor.length) {
    lines.push("Non-binding suggestions — use, adapt, or ignore:");
    for (const f of brief.flavor) lines.push(`- ${f}`);
  } else {
    lines.push("(no design pools for this book — writer's choice)");
  }
  return lines.join("\n");
}

/** Compile + persist every chapter's brief (json + rendered md) under
 *  state/books/<book>/runs/<runId>/briefs/. */
export function writeChapterBriefs(bookId: string, opts: CompileChapterBriefsOpts = {}): WriteChapterBriefsResult {
  const roots = opts.roots ?? {};
  const result = compileChapterBriefs(bookId, opts);
  const written: string[] = [];
  for (const brief of result.briefs) {
    const jsonPath = chapterBriefPath(result.bookId, brief.chapterNumber, roots);
    writeJsonFile(jsonPath, brief);
    written.push(jsonPath);
    const mdPath = chapterBriefMdPath(result.bookId, brief.chapterNumber, roots);
    writeTextFile(mdPath, renderBriefMd(brief));
    written.push(mdPath);
  }
  return { bookId: result.bookId, written, findings: result.findings };
}

// ── Gate (BR1–BR5) ──────────────────────────────────────────────────────────────

export type ChapterBriefFinding = { checkId: string; severity: "blocker" | "advisory"; message: string; path?: string };
export type ChapterBriefGateReport = { bookId: string; passed: boolean; findings: ChapterBriefFinding[] };

/** Read + validate the on-disk briefs for a book (verb `chapter-brief-gate`). Blockers:
 *  BR1 ownedCases labels disjoint across chapters; BR2 cast disjoint across chapters and from
 *  all real source-person names; BR3 answerIndexPattern present/9-slot/0..2/not-all-identical;
 *  BR4 lengthBudget.renderedChars in [8000, 30000]; BR5 coreMove/thesis non-empty. */
export function validateChapterBriefs(bookId: string, roots: CompilerStoreRoots = {}): ChapterBriefGateReport {
  const normalized = normSlug(bookId);
  const findings: ChapterBriefFinding[] = [];
  const push = (checkId: string, message: string, path?: string) =>
    findings.push({ checkId, severity: "blocker", message, path });

  const index = readCanonicalChapterIndex(normalized, roots.stateRoot);
  if (!index.ok) {
    for (const b of index.blockers) push("BR0.index", `${b.checkId}: ${b.message}`);
    return { bookId: normalized, passed: false, findings };
  }

  const briefs: Array<{ n: number; brief: ChapterBriefV1 }> = [];
  const packets: SourcePacketV1[] = [];
  for (const spec of index.chapters) {
    const p = chapterBriefPath(normalized, spec.chapterNumber, roots);
    if (!existsSync(p)) {
      push("BR0.missing", `no brief for chapter ${spec.chapterNumber} at ${p} — run compile-chapter-briefs first`, p);
      continue;
    }
    try {
      briefs.push({ n: spec.chapterNumber, brief: readJsonFile<ChapterBriefV1>(p) });
    } catch (err) {
      push("BR0.malformed", `unreadable brief for chapter ${spec.chapterNumber}: ${(err as Error).message}`, p);
    }
    const packetP = sourcePacketPath(normalized, spec.chapterNumber, roots);
    if (existsSync(packetP)) {
      try {
        packets.push(readJsonFile<SourcePacketV1>(packetP));
      } catch {
        /* best-effort: BR2's protected-name set is built from the packets that ARE readable */
      }
    }
  }

  // BR1 — ownedCases labels disjoint across chapters.
  const labelOwner = new Map<string, number>();
  for (const { n, brief } of briefs) {
    for (const c of brief.ownedCases ?? []) {
      const key = (c.label ?? "").trim().toLowerCase();
      if (!key) continue;
      const owner = labelOwner.get(key);
      if (owner !== undefined && owner !== n) {
        push("BR1.case_collision", `case label "${c.label}" is owned by both chapter ${owner} and chapter ${n} — ownedCases must partition the book's cases`);
      } else {
        labelOwner.set(key, n);
      }
    }
  }

  // BR2 — cast disjoint across chapters AND from all real source-person names.
  const protectedNames = bookProtectedNames(packets);
  const castOwner = new Map<string, number>();
  for (const { n, brief } of briefs) {
    for (const name of brief.cast ?? []) {
      const owner = castOwner.get(name);
      if (owner !== undefined && owner !== n) {
        push("BR2.cast_collision", `cast name "${name}" is reserved by both chapter ${owner} and chapter ${n}`);
      } else {
        castOwner.set(name, n);
      }
      if (protectedNames.has(name)) {
        push("BR2.cast_source_person", `chapter ${n} cast name "${name}" collides with a real source-person name from the book's packets`);
      }
    }
  }

  // BR3 / BR4 / BR5 — per-brief shape checks.
  for (const { n, brief } of briefs) {
    const pattern = brief.answerIndexPattern;
    if (!Array.isArray(pattern) || pattern.length === 0) {
      push("BR3.answer_pattern", `chapter ${n} brief has no answerIndexPattern`);
    } else {
      if (pattern.length !== BRIEF_QUIZ_SLOT_COUNT) {
        push("BR3.answer_pattern", `chapter ${n} answerIndexPattern has ${pattern.length} slots; the blueprint deals ${BRIEF_QUIZ_SLOT_COUNT}`);
      }
      if (pattern.some((v) => !Number.isInteger(v) || v < 0 || v > 2)) {
        push("BR3.answer_pattern", `chapter ${n} answerIndexPattern carries values outside 0..2: [${pattern.join(", ")}]`);
      }
      if (pattern.length > 1 && new Set(pattern).size === 1) {
        push("BR3.answer_pattern", `chapter ${n} answerIndexPattern is all-identical (${pattern[0]}) — a gameable key`);
      }
    }
    const budget = brief.lengthBudget?.renderedChars;
    if (typeof budget !== "number" || budget < LENGTH_BUDGET_MIN || budget > LENGTH_BUDGET_MAX) {
      push("BR4.length_budget", `chapter ${n} lengthBudget.renderedChars ${String(budget)} is outside [${LENGTH_BUDGET_MIN}, ${LENGTH_BUDGET_MAX}]`);
    }
    if (!oneLine(brief.coreMove ?? "")) push("BR5.core_move", `chapter ${n} brief has an empty coreMove`);
    if (!oneLine(brief.thesis ?? "")) push("BR5.core_move", `chapter ${n} brief has an empty thesis`);

    // BR6 — the W4 rotation fields are present and drawn from their pools (fail-closed: a brief
    // missing any of these would silently ship the templated house pattern).
    if (!(OPENER_TYPES as readonly string[]).includes(brief.openerType)) {
      push("BR6.rotation_field", `chapter ${n} brief openerType ${JSON.stringify(brief.openerType)} is missing or not one of ${OPENER_TYPES.join("/")}`);
    }
    if (!(CHALLENGE_FRAMES as readonly string[]).includes(brief.challengeFrame)) {
      push("BR6.rotation_field", `chapter ${n} brief challengeFrame ${JSON.stringify(brief.challengeFrame)} is missing or not one of the ${CHALLENGE_FRAMES.length} challenge frames`);
    }
    if (!(PRACTICE_SHAPES as readonly string[]).includes(brief.practiceShape)) {
      push("BR6.rotation_field", `chapter ${n} brief practiceShape ${JSON.stringify(brief.practiceShape)} is missing or not one of ${PRACTICE_SHAPES.join("/")}`);
    }
  }

  // BR7 — cross-chapter rotation caps hold (the deal honors these; the gate fails closed if a brief
  // set is hand-edited or a future deal regresses). openerType/practiceShape: no value on more than
  // ceil(2/3·N); challengeFrame: no repeat until the pool is exhausted, then no value on more than
  // ceil(1/3·N). N is the number of briefs actually present (not the canonical index) so a partial
  // set is still checked against its own size, never over-strict.
  const briefCount = briefs.length;
  if (briefCount > 0) {
    const openerCap = twoThirdsCap(briefCount);
    const practiceCap = twoThirdsCap(briefCount);
    const frameCap = briefCount <= CHALLENGE_FRAMES.length ? 1 : Math.max(1, oneThirdCap(briefCount));
    const tally = (pick: (b: ChapterBriefV1) => string): Map<string, number> => {
      const m = new Map<string, number>();
      for (const { brief } of briefs) {
        const v = pick(brief);
        if (v) m.set(v, (m.get(v) ?? 0) + 1);
      }
      return m;
    };
    for (const [v, c] of tally((b) => b.openerType)) {
      if (c > openerCap) push("BR7.rotation_cap", `openerType "${v}" lands on ${c} of ${briefCount} chapters — over the ceil(2/3·N)=${openerCap} cap; the opener rotation is over-concentrated`);
    }
    for (const [v, c] of tally((b) => b.practiceShape)) {
      if (c > practiceCap) push("BR7.rotation_cap", `practiceShape "${v}" lands on ${c} of ${briefCount} chapters — over the ceil(2/3·N)=${practiceCap} cap; the practice rotation is over-concentrated`);
    }
    for (const [v, c] of tally((b) => b.challengeFrame)) {
      if (c > frameCap) push("BR7.rotation_cap", `challengeFrame "${v}" lands on ${c} of ${briefCount} chapters — over the ${frameCap === 1 ? "no-repeat" : `ceil(1/3·N)=${frameCap}`} cap; the 24-hour-challenge framing is over-concentrated`);
    }
  }

  return { bookId: normalized, passed: !findings.some((f) => f.severity === "blocker"), findings };
}

export function formatChapterBriefGateReport(report: ChapterBriefGateReport): string {
  const blockers = report.findings.filter((f) => f.severity === "blocker").length;
  const advisories = report.findings.filter((f) => f.severity === "advisory").length;
  const lines = [`chapter-brief-gate: ${report.passed ? "PASS" : "BLOCK"} (${blockers} blocker(s), ${advisories} advisory)`];
  for (const f of report.findings) lines.push(`  [${f.severity.toUpperCase()} ${f.checkId}] ${f.message}${f.path ? ` (${f.path})` : ""}`);
  return lines.join("\n");
}
