/**
 * Pedagogy-slot plan — catalog-level variety for hooks, exercises, and quiz
 * prompt openers.
 *
 * THE PROBLEM: parallel authoring fixed the per-book chapter contracts but left
 * the catalog speaking in one slot voice: the same declarative-image hook move,
 * the same "write one" exercise grammar, and the same scenario-role quiz
 * opener. These are not local correctness failures; they are catalog texture
 * failures. Like namePlan and shapePlan, the fix is prevention: deal rhetorical
 * variety BEFORE authoring, then paste the exact slot instruction into each
 * STEP-2 prompt.
 *
 * Allocation scheme (deterministic, no RNG, reproducible like namePlan):
 *   - rotation = FNV-1a(bookId). From that one book hash we choose:
 *       hook mix: dominant + 2 secondaries
 *       tryThisNow mix: 3 grammars
 *       quiz mix: 2 opener families
 *   - Book-level mix steps are coprime with the shipped palette sizes:
 *       HOOK_MIX_STEP=3 for 10 hook shapes
 *       TRY_MIX_STEP=3 for 8 exercise grammars
 *       QUIZ_MIX_STEP=5 for 6 quiz openers
 *     The invariant: adjacent entries in a book's mix are distinct, and nearby
 *     book rotations do not collapse to the same internal order. Runtime checks
 *     below throw if a future config size breaks this math.
 *   - Chapter-level dealing within the book mix:
 *       hooks use [dominant, secondaryA, dominant, secondaryB], a circular
 *       pattern with no adjacent equal slots and a real dominant voice;
 *       exercises rotate through the 3-grammar mix;
 *       quiz openers alternate order each chapter, so within-chapter questions
 *       can rotate between the pair without every chapter starting the same way.
 *   - Idempotent re-plan: an already-authored chapter is marked carried unless
 *     forceFresh is set. Existence is checked first by the canonical
 *     chapterFileName path, then by isSiblingFile so capital-letter bookIds and
 *     filename casing drift do not hide authored siblings.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { CHAPTERS_DIR, chapterFileName, isSiblingFile } from "../lib/chapterPaths.js";
import type { HookShape } from "../critics/catalogAudit.js";

const __dirname = dirname(fileURLToPath(import.meta.url)); // .../src/librarian
const PEDAGOGY_PALETTES_PATH = resolve(__dirname, "../../config/pedagogy-palettes.json");
const PEDAGOGY_PLANS_DIR = resolve(__dirname, "../../state/pedagogy-plans");

const HOOK_MIX_STEP = 3; // coprime with 10 shipped hook shapes -> distinct dominant/secondary picks
const TRY_MIX_STEP = 3;  // coprime with 8 shipped grammars -> distinct 3-grammar mix
const QUIZ_MIX_STEP = 5; // coprime with 6 shipped openers -> distinct opener pair
const HOOK_CHAPTER_PATTERN = [0, 1, 0, 2] as const; // circularly no adjacent repeats; 0 remains dominant

export type HookShapePaletteEntry = {
  id: string;
  definition: string;
  auditClass: HookShape;
};

export type TryThisNowGrammar = {
  id: string;
  definition: string;
  example: string;
};

export type QuizOpener = {
  id: string;
  definition: string;
  example: string;
};

export type PedagogyPalettes = {
  hookShapes: HookShapePaletteEntry[];
  tryThisNowGrammars: TryThisNowGrammar[];
  quizOpeners: QuizOpener[];
};

export type PedagogyChapterAllocation = {
  hookShape: string;
  tryThisNowGrammar: string;
  quizOpeners: [string, string];
};

export type PedagogyPlan = {
  schemaVersion: "pedagogy-plan-v1";
  bookId: string;
  fromChapter: number;
  toChapter: number;
  bookMix: {
    hookShapes: [string, string, string];
    dominantHookShape: string;
    tryThisNowGrammars: [string, string, string];
    quizOpeners: [string, string];
  };
  /** chapter number -> dealt slot guidance. Already-authored chapters are
   *  marked in carriedChapters so redo/fanout can distinguish previews from
   *  fresh assignments. */
  allocation: Record<number, PedagogyChapterAllocation>;
  carriedChapters: number[];
};

export type PlanPedagogyOpts = {
  /** Deal fresh pedagogy slots even for chapters already on disk. The REDO
   *  path (fanout --all) needs this so old slot habits do not get carried. */
  forceFresh?: boolean;
};

const VALID_HOOK_CLASSES: Record<HookShape, true> = {
  question: true,
  direct_address: true,
  numeric: true,
  first_person: true,
  declarative_image: true,
};

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isHookClass(value: unknown): value is HookShape {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(VALID_HOOK_CLASSES, value);
}

function uniqueIds<T extends { id: string }>(items: T[], label: string): void {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) throw new Error(`pedagogy-palettes.json has duplicate ${label} id "${item.id}".`);
    seen.add(item.id);
  }
}

function cleanHookShape(value: unknown): HookShapePaletteEntry | null {
  if (!isRecord(value)) return null;
  const id = value.id;
  const definition = value.definition;
  const auditClass = value.auditClass;
  if (typeof id !== "string" || typeof definition !== "string" || !isHookClass(auditClass)) return null;
  return { id, definition, auditClass };
}

function cleanTryGrammar(value: unknown): TryThisNowGrammar | null {
  if (!isRecord(value)) return null;
  const id = value.id;
  const definition = value.definition;
  const example = value.example;
  if (typeof id !== "string" || typeof definition !== "string" || typeof example !== "string") return null;
  return { id, definition, example };
}

function cleanQuizOpener(value: unknown): QuizOpener | null {
  if (!isRecord(value)) return null;
  const id = value.id;
  const definition = value.definition;
  const example = value.example;
  if (typeof id !== "string" || typeof definition !== "string" || typeof example !== "string") return null;
  return { id, definition, example };
}

export function loadPedagogyPalettes(): PedagogyPalettes {
  const raw = JSON.parse(readFileSync(PEDAGOGY_PALETTES_PATH, "utf8")) as Record<string, unknown>;
  const hookShapes = Array.isArray(raw.hookShapes) ? raw.hookShapes.map(cleanHookShape).filter((entry): entry is HookShapePaletteEntry => entry !== null) : [];
  const tryThisNowGrammars = Array.isArray(raw.tryThisNowGrammars)
    ? raw.tryThisNowGrammars.map(cleanTryGrammar).filter((entry): entry is TryThisNowGrammar => entry !== null)
    : [];
  const quizOpeners = Array.isArray(raw.quizOpeners) ? raw.quizOpeners.map(cleanQuizOpener).filter((entry): entry is QuizOpener => entry !== null) : [];

  if (hookShapes.length < 3) throw new Error(`pedagogy-palettes.json has only ${hookShapes.length} usable hook shapes.`);
  if (tryThisNowGrammars.length < 3) throw new Error(`pedagogy-palettes.json has only ${tryThisNowGrammars.length} usable tryThisNow grammars.`);
  if (quizOpeners.length < 2) throw new Error(`pedagogy-palettes.json has only ${quizOpeners.length} usable quiz openers.`);
  uniqueIds(hookShapes, "hook shape");
  uniqueIds(tryThisNowGrammars, "tryThisNow grammar");
  uniqueIds(quizOpeners, "quiz opener");

  const declarative = hookShapes.filter((entry) => entry.auditClass === "declarative_image").length;
  if (declarative > 3) throw new Error(`pedagogy-palettes.json has ${declarative} declarative_image hook shapes; cap is 3.`);
  for (const required of ["question", "direct_address", "numeric", "first_person"] as const) {
    if (!hookShapes.some((entry) => entry.auditClass === required)) {
      throw new Error(`pedagogy-palettes.json must include at least one ${required} hook shape.`);
    }
  }

  return { hookShapes, tryThisNowGrammars, quizOpeners };
}

function pickIds<T extends { id: string }>(items: T[], rotation: number, count: number, step: number, label: string): string[] {
  if (items.length < count) throw new Error(`${label} palette has ${items.length} entries; need ${count}.`);
  const picked: string[] = [];
  for (let i = 0; i < count; i++) {
    picked.push(items[(rotation + i * step) % items.length].id);
  }
  if (new Set(picked).size !== picked.length) {
    throw new Error(
      `pedagogy-plan invariant violated: ${label} mix repeated ids (${picked.join(", ")}) with palette size ${items.length} and step ${step}.`,
    );
  }
  return picked;
}

function authoredChapterExists(bookId: string, chapterNumber: number): boolean {
  const chapterId = `${bookId}-ch${String(chapterNumber).padStart(2, "0")}`;
  const canonical = resolve(CHAPTERS_DIR, chapterFileName(chapterId));
  if (existsSync(canonical)) return true;
  let files: string[] = [];
  try {
    files = readdirSync(CHAPTERS_DIR);
  } catch {
    return false;
  }
  for (const file of files) {
    if (!isSiblingFile(file, bookId)) continue;
    const match = file.match(/-ch0*(\d{1,3})\.v21-native\.chapter\.json$/i);
    if (match && parseInt(match[1], 10) === chapterNumber) return true;
  }
  return false;
}

function assertNoConsecutiveHookRepeats(plan: PedagogyPlan): void {
  for (let chapterNumber = plan.fromChapter; chapterNumber < plan.toChapter; chapterNumber++) {
    const current = plan.allocation[chapterNumber]?.hookShape;
    const next = plan.allocation[chapterNumber + 1]?.hookShape;
    if (current && next && current === next) {
      throw new Error(
        `pedagogy-plan invariant violated: hook shape "${current}" repeats across ch${chapterNumber}->ch${chapterNumber + 1}.`,
      );
    }
  }
}

export function planPedagogy(bookId: string, from: number, to: number, opts: PlanPedagogyOpts = {}): PedagogyPlan {
  if (to < from) throw new Error(`to (${to}) < from (${from})`);
  // Chapters are 1-based; a non-positive `from` drives JS's negative modulo
  // through the chapter pattern and silently deals null/undefined slots
  // (adversarial-review finding) — fail loud like the to<from case.
  if (from < 1) throw new Error(`from (${from}) must be >= 1 (chapters are 1-based)`);
  const palettes = loadPedagogyPalettes();
  const hash = fnv1a(bookId);

  const hookRotation = hash % palettes.hookShapes.length;
  const tryRotation = Math.floor(hash / palettes.hookShapes.length) % palettes.tryThisNowGrammars.length;
  const quizRotation = Math.floor(hash / (palettes.hookShapes.length * palettes.tryThisNowGrammars.length)) % palettes.quizOpeners.length;
  const hookPhase = Math.floor(hash / 97) % HOOK_CHAPTER_PATTERN.length;
  const tryPhase = Math.floor(hash / 193) % 3;
  const quizPhase = Math.floor(hash / 389) % 2;

  const hookMix = pickIds(palettes.hookShapes, hookRotation, 3, HOOK_MIX_STEP, "hook shape") as [string, string, string];
  const tryMix = pickIds(palettes.tryThisNowGrammars, tryRotation, 3, TRY_MIX_STEP, "tryThisNow grammar") as [string, string, string];
  const quizMix = pickIds(palettes.quizOpeners, quizRotation, 2, QUIZ_MIX_STEP, "quiz opener") as [string, string];

  const allocation: Record<number, PedagogyChapterAllocation> = {};
  const carriedChapters: number[] = [];
  for (let chapterNumber = from; chapterNumber <= to; chapterNumber++) {
    if (!opts.forceFresh && authoredChapterExists(bookId, chapterNumber)) carriedChapters.push(chapterNumber);

    const hookPatternIndex = HOOK_CHAPTER_PATTERN[(chapterNumber - 1 + hookPhase) % HOOK_CHAPTER_PATTERN.length];
    const quizStart = (chapterNumber - 1 + quizPhase) % 2;
    allocation[chapterNumber] = {
      hookShape: hookMix[hookPatternIndex],
      tryThisNowGrammar: tryMix[(chapterNumber - 1 + tryPhase) % tryMix.length],
      quizOpeners: [quizMix[quizStart], quizMix[(quizStart + 1) % quizMix.length]],
    };
  }

  const plan: PedagogyPlan = {
    schemaVersion: "pedagogy-plan-v1",
    bookId,
    fromChapter: from,
    toChapter: to,
    bookMix: {
      hookShapes: hookMix,
      dominantHookShape: hookMix[0],
      tryThisNowGrammars: tryMix,
      quizOpeners: quizMix,
    },
    allocation,
    carriedChapters,
  };
  assertNoConsecutiveHookRepeats(plan);
  return plan;
}

export function writePedagogyPlan(plan: PedagogyPlan): string {
  mkdirSync(PEDAGOGY_PLANS_DIR, { recursive: true });
  const path = resolve(PEDAGOGY_PLANS_DIR, `${plan.bookId}.pedagogy-plan.json`);
  writeFileSync(path, JSON.stringify(plan, null, 2), "utf8");
  return path;
}

export function formatPedagogyPlan(plan: PedagogyPlan): string {
  const palettes = loadPedagogyPalettes();
  const hookDefs = new Map<string, string>();
  const tryDefs = new Map<string, string>();
  const quizExamples = new Map<string, string>();
  for (const entry of palettes.hookShapes) hookDefs.set(entry.id, entry.definition);
  for (const entry of palettes.tryThisNowGrammars) tryDefs.set(entry.id, `${entry.definition} Example: ${entry.example}`);
  for (const entry of palettes.quizOpeners) quizExamples.set(entry.id, entry.example);

  const lines: string[] = [`Pedagogy plan — ${plan.bookId} ch${plan.fromChapter}-${plan.toChapter}`];
  lines.push(`  hook mix: ${plan.bookMix.hookShapes.join(", ")} (dominant: ${plan.bookMix.dominantHookShape})`);
  lines.push(`  tryThisNow mix: ${plan.bookMix.tryThisNowGrammars.join(", ")}`);
  lines.push(`  quiz opener mix: ${plan.bookMix.quizOpeners.join(", ")}`);
  lines.push("");
  for (const [chapterNumber, allocation] of Object.entries(plan.allocation).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    const num = Number(chapterNumber);
    const carried = plan.carriedChapters.includes(num);
    lines.push(
      `  ch${String(num).padStart(2, "0")}${carried ? " (authored — carried from disk)" : ""}: ` +
        `hook=${allocation.hookShape}; try=${allocation.tryThisNowGrammar}; quiz=${allocation.quizOpeners.join(" / ")}`,
    );
  }
  lines.push("", "Hook definitions:");
  for (const id of plan.bookMix.hookShapes) lines.push(`  ${id}: ${hookDefs.get(id) ?? "(missing definition)"}`);
  lines.push("", "Try-this-now definitions:");
  for (const id of plan.bookMix.tryThisNowGrammars) lines.push(`  ${id}: ${tryDefs.get(id) ?? "(missing definition)"}`);
  lines.push("", "Quiz opener examples:");
  for (const id of plan.bookMix.quizOpeners) lines.push(`  ${id}: ${quizExamples.get(id) ?? "(missing example)"}`);
  return lines.join("\n");
}
