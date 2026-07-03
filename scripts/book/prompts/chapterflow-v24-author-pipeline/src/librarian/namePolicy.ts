import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = resolve(__dirname, "../../config");
const NAME_POLICY_PATH = resolve(CONFIG_DIR, "name-policy.json");

export type NamePolicyV1 = {
  schemaVersion: "name-policy-v1";
  policyId: string;
  description: string;
  primaryNameSource: "planner-allocation";
  auditNameSource: "capitalized-word-heuristic";
  withinBook: {
    maxOccurrencesPerName: number;
  };
  catalogCooldown: {
    lookbackBooks: number;
    maxBooksPerName: number;
  };
};

export type NamePolicyBookEntry = {
  bookId: string;
  generatedAt: string;
  namesUsed: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function parseNamePolicy(raw: unknown, source = NAME_POLICY_PATH): NamePolicyV1 {
  if (!isRecord(raw)) throw new Error(`name policy at ${source} must be an object`);
  if (raw.schemaVersion !== "name-policy-v1") {
    throw new Error(`name policy at ${source} has unsupported schemaVersion ${String(raw.schemaVersion)}`);
  }
  const withinBook = raw.withinBook;
  const catalogCooldown = raw.catalogCooldown;
  const maxOccurrencesPerName = isRecord(withinBook) ? withinBook.maxOccurrencesPerName : undefined;
  const lookbackBooks = isRecord(catalogCooldown) ? catalogCooldown.lookbackBooks : undefined;
  const maxBooksPerName = isRecord(catalogCooldown) ? catalogCooldown.maxBooksPerName : undefined;
  if (!Number.isInteger(maxOccurrencesPerName) || (maxOccurrencesPerName as number) < 1) {
    throw new Error(`name policy at ${source} needs withinBook.maxOccurrencesPerName >= 1`);
  }
  if (!Number.isInteger(lookbackBooks) || (lookbackBooks as number) < 0 || !Number.isInteger(maxBooksPerName) || (maxBooksPerName as number) < 1) {
    throw new Error(`name policy at ${source} needs catalogCooldown.lookbackBooks >= 0 and maxBooksPerName >= 1`);
  }
  if (raw.primaryNameSource !== "planner-allocation" || raw.auditNameSource !== "capitalized-word-heuristic") {
    throw new Error(`name policy at ${source} must use planner allocations as primary names and heuristics as audit names`);
  }
  return {
    schemaVersion: "name-policy-v1",
    policyId: typeof raw.policyId === "string" && raw.policyId ? raw.policyId : "catalog-cooldown-v1",
    description: typeof raw.description === "string" ? raw.description : "",
    primaryNameSource: "planner-allocation",
    auditNameSource: "capitalized-word-heuristic",
    withinBook: { maxOccurrencesPerName: maxOccurrencesPerName as number },
    catalogCooldown: {
      lookbackBooks: lookbackBooks as number,
      maxBooksPerName: maxBooksPerName as number,
    },
  };
}

export function loadNamePolicy(path = NAME_POLICY_PATH): NamePolicyV1 {
  try {
    return parseNamePolicy(JSON.parse(readFileSync(path, "utf8")), path);
  } catch (err) {
    if (err instanceof SyntaxError) throw new Error(`name policy config unreadable at ${path}: ${err.message}`);
    throw err;
  }
}

export function orderedRecentBooks(entries: NamePolicyBookEntry[], currentBookId: string): NamePolicyBookEntry[] {
  return entries
    .filter((b) => b.bookId !== currentBookId)
    .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt) || a.bookId.localeCompare(b.bookId));
}

export function forbiddenNamesByPolicy(
  entries: NamePolicyBookEntry[],
  currentBookId: string,
  policy: NamePolicyV1,
): Set<string> {
  const forbidden = new Set<string>();

  const currentBook = entries.find((b) => b.bookId === currentBookId);
  if (currentBook) {
    for (const name of currentBook.namesUsed) forbidden.add(name);
  }

  const recent = orderedRecentBooks(entries, currentBookId).slice(0, policy.catalogCooldown.lookbackBooks);
  const booksByName = new Map<string, Set<string>>();
  for (const book of recent) {
    for (const name of new Set(book.namesUsed)) {
      const books = booksByName.get(name) ?? new Set<string>();
      books.add(book.bookId);
      booksByName.set(name, books);
    }
  }
  for (const [name, books] of booksByName) {
    if (books.size >= policy.catalogCooldown.maxBooksPerName) forbidden.add(name);
  }

  return forbidden;
}

export function formatNamePolicy(policy: NamePolicyV1): string {
  return `${policy.policyId}: unique within each book; blocked after ${policy.catalogCooldown.maxBooksPerName} book(s) in the last ${policy.catalogCooldown.lookbackBooks} other ledgered book(s).`;
}
