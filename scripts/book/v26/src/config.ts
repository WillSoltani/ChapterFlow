import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { EFFORTS, type Effort, type RoleConfig } from "./types";

export interface BookConfig {
  bookId: string;
  title: string;
  author: string;
  bookType: "memoir" | "how-to" | "argument";
  categories: string[];
  tags: string[];
  source: { textPath: string; chapterMapPath: string };
  knownTrapsPath?: string;
  briefPath: string;
  shape: {
    examples: number;
    quizQuestions: number;
    choices: number;
    reviewCards: number;
    memorableLines: number;
    ifThenPlans: number;
    fastRead: [number, number];
    deepRead: [number, number];
    fullRead: [number, number];
  };
  writer: RoleConfig;
  checker: RoleConfig;
  solver: RoleConfig;
  concurrency: number;
  budgetUsd: number;
  runDir: string;
}

const BOOK_TYPES = ["memoir", "how-to", "argument"] as const;
const DEFAULT_CONCURRENCY = 3;

/** "~/x" becomes "<home>/x". Only a leading "~/" counts; "~" alone and "~user/" are left as they are. */
export function expandHome(p: string): string {
  return p.startsWith("~/") ? os.homedir() + "/" + p.slice(2) : p;
}

function invalid(field: string, reason: string): never {
  throw new Error(`CONFIG_INVALID: ${field}: ${reason}`);
}

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function obj(v: unknown, field: string): Obj {
  return isObj(v) ? v : invalid(field, "must be an object");
}

function str(v: unknown, field: string): string {
  return typeof v === "string" && v.trim() !== "" ? v : invalid(field, "must be a non-empty string");
}

function strList(v: unknown, field: string): string[] {
  if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) return invalid(field, "must be an array of strings");
  return v as string[];
}

function posInt(v: unknown, field: string): number {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 ? v : invalid(field, "must be a positive integer");
}

function range(v: unknown, field: string): [number, number] {
  const ok =
    Array.isArray(v) && v.length === 2 && v.every((x) => typeof x === "number" && Number.isFinite(x) && x >= 0) && v[0] <= v[1];
  return ok ? [v[0], v[1]] : invalid(field, "must be [min, max] with 0 <= min <= max");
}

function role(v: unknown, field: string, base: string): RoleConfig {
  const o = obj(v, field);
  const effort = str(o.effort, `${field}.effort`);
  if (!(EFFORTS as readonly string[]).includes(effort)) {
    invalid(`${field}.effort`, `must be one of ${EFFORTS.join(", ")} (got "${effort}")`);
  }
  // A bin with no "/" is a command looked up on PATH ("claude"), so it must not be turned into a path.
  const rawBin = expandHome(str(o.bin, `${field}.bin`));
  const bin = rawBin.includes("/") ? resolveFrom(base, rawBin) : rawBin;
  return { bin, model: str(o.model, `${field}.model`), effort: effort as Effort };
}

function resolveFrom(base: string, p: string): string {
  return path.resolve(base, expandHome(p));
}

export function loadBookConfig(configPath: string): BookConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (e) {
    return invalid(configPath, `cannot read as JSON (${(e as Error).message})`);
  }
  const raw = obj(parsed, "(root)");
  const base = path.dirname(path.resolve(configPath));
  const p = (v: unknown, field: string): string => resolveFrom(base, str(v, field));

  const bookType = str(raw.bookType, "bookType");
  if (!(BOOK_TYPES as readonly string[]).includes(bookType)) {
    invalid("bookType", `must be one of ${BOOK_TYPES.join(", ")} (got "${bookType}")`);
  }

  const source = obj(raw.source, "source");
  const shape = obj(raw.shape, "shape");

  const concurrency = raw.concurrency === undefined ? DEFAULT_CONCURRENCY : posInt(raw.concurrency, "concurrency");
  const budgetUsd = raw.budgetUsd;
  if (typeof budgetUsd !== "number" || !Number.isFinite(budgetUsd) || budgetUsd < 0) {
    invalid("budgetUsd", "must be a non-negative number");
  }

  const cfg: BookConfig = {
    bookId: str(raw.bookId, "bookId"),
    title: str(raw.title, "title"),
    author: str(raw.author, "author"),
    bookType: bookType as BookConfig["bookType"],
    categories: strList(raw.categories, "categories"),
    tags: strList(raw.tags, "tags"),
    source: {
      textPath: p(source.textPath, "source.textPath"),
      chapterMapPath: p(source.chapterMapPath, "source.chapterMapPath"),
    },
    briefPath: p(raw.briefPath, "briefPath"),
    shape: {
      examples: posInt(shape.examples, "shape.examples"),
      quizQuestions: posInt(shape.quizQuestions, "shape.quizQuestions"),
      choices: posInt(shape.choices, "shape.choices"),
      reviewCards: posInt(shape.reviewCards, "shape.reviewCards"),
      memorableLines: posInt(shape.memorableLines, "shape.memorableLines"),
      ifThenPlans: posInt(shape.ifThenPlans, "shape.ifThenPlans"),
      fastRead: range(shape.fastRead, "shape.fastRead"),
      deepRead: range(shape.deepRead, "shape.deepRead"),
      fullRead: range(shape.fullRead, "shape.fullRead"),
    },
    writer: role(raw.writer, "writer", base),
    checker: role(raw.checker, "checker", base),
    solver: role(raw.solver, "solver", base),
    concurrency,
    budgetUsd: budgetUsd as number,
    runDir: p(raw.runDir, "runDir"),
  };
  // Optional, so the key is left off entirely when the config does not name one.
  if (raw.knownTrapsPath !== undefined) cfg.knownTrapsPath = p(raw.knownTrapsPath, "knownTrapsPath");
  return cfg;
}
