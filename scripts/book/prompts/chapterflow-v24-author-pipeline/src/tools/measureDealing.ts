/**
 * measure-dealing — the reproducible measurement behind WP-DEAL-1C's before → after table.
 *
 *   npx tsx src/tools/measureDealing.ts <candidate-content-dir> [--book <bookId>] [--json]
 *
 * SHIPPED  = the blueprints already in the candidate (`compiler/chNN/blueprint.json`), i.e. what
 *            the compiler on origin/main dealt when that candidate was produced.
 * RECOMPILED = the SAME candidate's source packets (`compiler/chNN/source-packet.json`) put back
 *            through THIS working tree's compiler, into a throwaway state root under the OS temp
 *            dir. Both halves are read-only with respect to the candidate: this tool opens files
 *            under <candidate-content-dir> and writes nothing there, ever.
 *
 * Every number the change record claims about the live candidate is printed here, each beside the
 * property it measures, so a reviewer re-runs one command instead of trusting a table.
 */
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { bookDesignPath, sourcePacketPath, writeJsonFile } from "../artifacts/artifactStore.js";
import { checkPositionalDeals, poolSizeOverrides, validateBlueprint } from "../compiler/blueprintGate.js";
import { deriveBookDesign, validateBookDesign } from "../compiler/bookDesign.js";
import { compileChapterBlueprint, resolvedPoolsForBook } from "../compiler/chapterBlueprint.js";
import type { ChapterBlueprintV1, SourcePacketV1 } from "../artifacts/artifactTypes.js";
import type { ChapterSpec } from "../generateChapter.js";

/** The subset of a blueprint this tool reads. Deliberately structural and tolerant: a SHIPPED
 *  blueprint was written by an older compiler and may lack fields this branch added. */
export type MeasuredBlueprint = {
  chapterNumber: number;
  reservedVariety?: { allowedNames?: string[]; forbiddenNames?: string[]; hookShape?: string };
  sections?: {
    hook?: { shape?: string; requiredFactIds?: string[] };
    summaries?: { requiredFactIds?: string[] };
    examples?: Array<{ venue?: string; allowedNames?: string[]; requiredFactIds?: string[] }>;
    quiz?: Array<{ caseCueIds?: string[]; requiredFactIds?: string[] }>;
    cards?: Array<{ caseCueIds?: string[]; requiredFactIds?: string[]; backShape?: string }>;
    action?: { requiredFactIds?: string[] };
  };
  plan?: { exampleSpecs?: Array<{ domain?: string; format?: string }> };
  constraints?: { allowedFactIds?: string[] };
};

export type Measurement = {
  chapters: number;
  cuesPerChapter: number[];
  worstCaseCueMultiplicity: number[];
  quizSlotsCued: string[];
  distinctFormatSequences: number;
  openingWordBackShapes: string;
  rotatedCardBackNeighbours: string;
  forbiddenNamesPerChapter: number[];
  forbiddenNamesOwnedByAnotherChapter: number[];
  orphanTeachingFacts: string[];
  actionEqualsSummaries: string;
  concatenatedDomains: string;
  namesDealtTwiceInOneChapter: number[];
  hookShapes: string[];
  hookShapeEqualsReserved: boolean;
  venuesSlot0: string[];
};

const OPENING_WORD_BACK = /\b(start|open|begin|lead)\b[^.]{0,24}\b(with|on|by)\b/i;

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function isRotation(a: readonly string[], b: readonly string[]): boolean {
  if (a.length === 0 || a.length !== b.length) return false;
  for (let k = 1; k < a.length; k++) {
    if (a.every((v, i) => v === b[(i + k) % a.length])) return true;
  }
  return false;
}

export function measure(blueprints: MeasuredBlueprint[]): Measurement {
  const sorted = [...blueprints].sort((x, y) => x.chapterNumber - y.chapterNumber);
  const cues: number[] = [];
  const worst: number[] = [];
  const quizCued: string[] = [];
  const forbidden: number[] = [];
  const forbiddenOwned: number[] = [];
  const orphans: string[] = [];
  const dupNames: number[] = [];
  let openingWord = 0;
  let backShapeTotal = 0;
  let concatenated = 0;
  let domainTotal = 0;
  let actionEqSummaries = 0;
  const hookShapes: string[] = [];
  let hookEqualsReserved = true;
  const venues: string[] = [];
  const formatSequences = new Set<string>();
  const backLists: string[][] = [];

  for (const bp of sorted) {
    const quiz = bp.sections?.quiz ?? [];
    const cards = bp.sections?.cards ?? [];
    const examples = bp.sections?.examples ?? [];
    const cueIds = [...quiz, ...cards].flatMap((slot) => slot.caseCueIds ?? []);
    cues.push(cueIds.length);
    const counts = new Map<string, number>();
    for (const id of cueIds) counts.set(id, (counts.get(id) ?? 0) + 1);
    worst.push(counts.size === 0 ? 0 : Math.max(...counts.values()));
    quizCued.push(`${quiz.filter((q) => (q.caseCueIds ?? []).length > 0).length} of ${quiz.length}`);

    const names = bp.reservedVariety?.forbiddenNames ?? [];
    forbidden.push(names.length);
    const elsewhere = new Set(sorted.filter((o) => o.chapterNumber !== bp.chapterNumber).flatMap((o) => o.reservedVariety?.allowedNames ?? []));
    forbiddenOwned.push(names.filter((n) => elsewhere.has(n)).length);

    const mandated = new Set<string>([
      ...(bp.sections?.hook?.requiredFactIds ?? []),
      ...(bp.sections?.summaries?.requiredFactIds ?? []),
      ...(bp.sections?.action?.requiredFactIds ?? []),
      ...examples.flatMap((e) => e.requiredFactIds ?? []),
      ...quiz.flatMap((q) => q.requiredFactIds ?? []),
      ...cards.flatMap((c) => c.requiredFactIds ?? []),
    ]);
    const allowed = bp.constraints?.allowedFactIds ?? [];
    orphans.push(`${allowed.filter((id) => !mandated.has(id)).length} of ${allowed.length}`);

    const slotNames = examples.flatMap((e) => e.allowedNames ?? []);
    dupNames.push(slotNames.length - new Set(slotNames).size);

    for (const card of cards) {
      backShapeTotal += 1;
      if (card.backShape && OPENING_WORD_BACK.test(card.backShape)) openingWord += 1;
    }
    backLists.push(cards.map((c) => c.backShape ?? ""));

    for (const spec of bp.plan?.exampleSpecs ?? []) {
      domainTotal += 1;
      const domain = spec.domain ?? "";
      if (domain.includes(": ") || domain.includes("; ")) concatenated += 1;
    }
    formatSequences.add((bp.plan?.exampleSpecs ?? []).map((s) => s.format ?? "").join("|"));

    const action = (bp.sections?.action?.requiredFactIds ?? []).join("|");
    const summaries = (bp.sections?.summaries?.requiredFactIds ?? []).join("|");
    if (action !== "" && action === summaries) actionEqSummaries += 1;

    const hookShape = bp.sections?.hook?.shape ?? "";
    hookShapes.push(hookShape);
    if (hookShape !== (bp.reservedVariety?.hookShape ?? "")) hookEqualsReserved = false;
    venues.push(examples[0]?.venue ?? "");
  }

  let rotated = 0;
  for (let i = 1; i < backLists.length; i++) if (isRotation(backLists[i - 1], backLists[i])) rotated += 1;

  return {
    chapters: sorted.length,
    cuesPerChapter: cues,
    worstCaseCueMultiplicity: worst,
    quizSlotsCued: quizCued,
    distinctFormatSequences: formatSequences.size,
    openingWordBackShapes: `${openingWord} of ${backShapeTotal}`,
    rotatedCardBackNeighbours: `${rotated} of ${Math.max(0, backLists.length - 1)}`,
    forbiddenNamesPerChapter: forbidden,
    forbiddenNamesOwnedByAnotherChapter: forbiddenOwned,
    orphanTeachingFacts: orphans,
    actionEqualsSummaries: `${actionEqSummaries} of ${sorted.length}`,
    concatenatedDomains: `${concatenated} of ${domainTotal}`,
    namesDealtTwiceInOneChapter: dupNames,
    hookShapes,
    hookShapeEqualsReserved: hookEqualsReserved,
    venuesSlot0: venues,
  };
}

function main(): void {
  const args = process.argv.slice(2);
  const contentDir = args.find((a) => !a.startsWith("--"));
  if (!contentDir) {
    console.error("usage: npx tsx src/tools/measureDealing.ts <candidate-content-dir> [--book <bookId>] [--json]");
    process.exitCode = 2;
    return;
  }
  const bookFlag = args.indexOf("--book");
  const chapters = readJson<ChapterSpec[]>(resolve(contentDir, "inputs", "chapter-index.json"));
  const bookId = bookFlag >= 0 ? args[bookFlag + 1] : (chapters[0]?.chapterId ?? "").replace(/-ch\d+$/, "");
  if (!bookId) throw new Error("could not infer a bookId from the chapter index — pass --book <bookId>");

  const packets: SourcePacketV1[] = [];
  const shipped: MeasuredBlueprint[] = [];
  for (const chapter of chapters) {
    const dir = resolve(contentDir, "compiler", `ch${String(chapter.chapterNumber).padStart(2, "0")}`);
    packets.push(readJson<SourcePacketV1>(resolve(dir, "source-packet.json")));
    const blueprintPath = resolve(dir, "blueprint.json");
    if (existsSync(blueprintPath)) shipped.push(readJson<MeasuredBlueprint>(blueprintPath));
  }

  // Recompile into a throwaway state root. Nothing under the candidate is written.
  const stateRoot = mkdtempSync(resolve(tmpdir(), "measure-dealing-"));
  const roots = { stateRoot };
  writeJsonFile(resolve(stateRoot, "indexes", `${bookId}.json`), chapters);
  for (const packet of packets) writeJsonFile(sourcePacketPath(bookId, packet.chapterNumber, roots), packet);
  const design = deriveBookDesign(bookId, { packets, chapters: chapters.length });
  writeJsonFile(bookDesignPath(bookId, roots), design);
  const recompiled: ChapterBlueprintV1[] = chapters.map((chapter, index) => compileChapterBlueprint({
    bookId,
    chapter,
    packet: packets[index],
    packetPath: sourcePacketPath(bookId, chapter.chapterNumber, roots),
    roots,
    totalChapters: chapters.length,
  }));

  const pools = resolvedPoolsForBook(bookId, roots);
  const designFindings = validateBookDesign(design, chapters.length);
  const blueprintFindings = recompiled.flatMap((bp) => validateBlueprint(bp));
  const dealFindings = checkPositionalDeals(recompiled, poolSizeOverrides(pools), pools.chapterDerived);
  const severity = (findings: ReadonlyArray<{ severity: string }>) =>
    `${findings.filter((f) => f.severity === "blocker").length} blocker(s), ${findings.filter((f) => f.severity !== "blocker").length} advisory`;

  // R-103's claim (the derived flavour is ranked by teaching value, not alphabetical) is read off
  // the design artifact this same run derived: each chapter's top-ranked mined topic.
  const derivedTopics = chapters.map((chapter) => {
    const entry = pools.chapterDerived(chapter.chapterNumber);
    return `ch${String(chapter.chapterNumber).padStart(2, "0")}: ${entry?.topics?.[0] ?? "(none)"}`;
  });

  const report = {
    bookId,
    candidate: contentDir,
    chapters: chapters.length,
    tempStateRoot: stateRoot,
    shipped: shipped.length === chapters.length ? measure(shipped) : null,
    recompiled: measure(recompiled as unknown as MeasuredBlueprint[]),
    derivedTopics,
    gatesOnRecompiled: {
      validateBookDesign: severity(designFindings),
      validateBlueprint: severity(blueprintFindings),
      checkPositionalDeals: severity(dealFindings),
      messages: [...designFindings, ...blueprintFindings, ...dealFindings].map((f) => `[${f.severity}] ${f.checkId}: ${f.message}`),
    },
  };

  if (args.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  const rows: Array<[string, keyof Measurement]> = [
    ["quiz + card case cues per chapter", "cuesPerChapter"],
    ["worst single case, cues in one chapter", "worstCaseCueMultiplicity"],
    ["quiz slots carrying a case cue", "quizSlotsCued"],
    ["distinct example-format sequences", "distinctFormatSequences"],
    ["card backShapes instructing an opening word", "openingWordBackShapes"],
    ["neighbouring chapters whose card-back list is a rotation", "rotatedCardBackNeighbours"],
    ["forbiddenNames entries per chapter", "forbiddenNamesPerChapter"],
    ["forbiddenNames entries another chapter's cast owns", "forbiddenNamesOwnedByAnotherChapter"],
    ["teaching facts mandated in no unit", "orphanTeachingFacts"],
    ["chapters where action facts == summaries facts", "actionEqualsSummaries"],
    ["plan domains concatenating venue + mode + frame", "concatenatedDomains"],
    ["names dealt to two slots in one chapter", "namesDealtTwiceInOneChapter"],
    ["hook shapes across the book", "hookShapes"],
    ["hook.shape equals the dealt reservedVariety.hookShape", "hookShapeEqualsReserved"],
    ["example slot 0 venue", "venuesSlot0"],
  ];
  const show = (value: unknown): string => (Array.isArray(value) ? value.join(", ") : String(value));
  console.log(`book ${report.bookId} — ${report.chapters} chapters from ${report.candidate}`);
  console.log(`| property | shipped (candidate blueprints) | recompiled (this tree) |`);
  console.log(`|---|---|---|`);
  for (const [label, key] of rows) {
    console.log(`| ${label} | ${report.shipped ? show(report.shipped[key]) : "n/a"} | ${show(report.recompiled[key])} |`);
  }
  console.log("");
  console.log(`per-chapter derived staging head (R-103): ${report.derivedTopics.join(" | ")}`);
  console.log("");
  console.log(`gates on the recompiled blueprints:`);
  console.log(`  validateBookDesign      ${report.gatesOnRecompiled.validateBookDesign}`);
  console.log(`  validateBlueprint       ${report.gatesOnRecompiled.validateBlueprint}`);
  console.log(`  checkPositionalDeals    ${report.gatesOnRecompiled.checkPositionalDeals}`);
  for (const message of report.gatesOnRecompiled.messages) console.log(`    ${message}`);
}

/** Run only when invoked as a script — a test may import `measure` without executing the tool. */
if ((process.argv[1] ?? "").endsWith("measureDealing.ts")) main();
