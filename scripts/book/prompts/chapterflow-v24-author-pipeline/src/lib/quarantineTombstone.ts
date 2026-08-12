/**
 * The quarantine tombstone — the ONE record `quarantine-book <bookId>` writes and
 * promises will stop a book from being shipped again.
 *
 * `quarantine-book` moves the shipped package aside AND writes
 * `state/books/_quarantined/<bookId>.json`, then prints:
 *
 *     promote-book and register-web now REFUSE this book until
 *     `unquarantine-book <bookId>` releases it.
 *
 * The tombstone exists because moving the package aside is NOT enough: every
 * piece of state that made the book promotable survives the move, so the next
 * promote silently re-shipped a book an operator had explicitly pulled. Only the
 * tombstone makes quarantine sticky.
 *
 * This module is the single reader both promotion routes share, so the legacy
 * promoter (promoteBook Step 0) and the v25 candidate-release route cannot drift
 * apart on WHERE the tombstone lives, WHICH ids it covers, or WHAT the refusal
 * says. A tombstone that exists but cannot be parsed still blocks — an
 * unreadable pull-this-book record is not permission to ship.
 */
import { existsSync, readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { normSlug } from "./chapterPaths.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** The canonical pipeline state root — the same `resolve(__dirname, "../state")`
 *  promoteBook.ts and cli.ts compute from `src/`. Production reads exactly this;
 *  the `stateRoot` argument exists only so hermetic tests can point the lookup at
 *  a disposable tree. */
export const CANONICAL_PIPELINE_STATE_ROOT = resolve(__dirname, "../../state");

/** True when `value` can be used verbatim as ONE path segment. A book id that
 *  cannot be a filename cannot have a tombstone, and must never be joined into a
 *  path to go looking for one. */
function isSafePathSegment(value: string): boolean {
  return typeof value === "string" &&
    value.length > 0 &&
    value !== "." &&
    value !== ".." &&
    !value.includes("/") &&
    !value.includes("\\") &&
    !value.includes("\0") &&
    ![...value].some((character) => {
      const code = character.charCodeAt(0);
      return code < 0x20 || code === 0x7f;
    });
}

export function quarantineTombstoneDir(stateRoot: string = CANONICAL_PIPELINE_STATE_ROOT): string {
  return resolve(stateRoot, "books", "_quarantined");
}

export function quarantineTombstonePath(
  bookId: string,
  stateRoot: string = CANONICAL_PIPELINE_STATE_ROOT,
): string {
  return resolve(quarantineTombstoneDir(stateRoot), `${bookId}.json`);
}

export type QuarantineTombstone = Readonly<{
  /** The id the tombstone was filed under (raw argv id or normalised slug). */
  bookId: string;
  path: string;
  /** The operator's reason, "" when the record carries none or is unreadable. */
  reason: string;
  /** True when the file exists but its JSON/shape could not be read. It still
   *  blocks; this only changes what the refusal can say. */
  unreadable: boolean;
}>;

/**
 * Every id one book's tombstone can be filed under. `quarantine-book` writes the
 * RAW argv id; promoteBook has always looked up the NORMALISED slug. Both are
 * "this book", so both are checked and either one blocks — a promoter that only
 * checked one of the two would ship a book an operator had explicitly pulled
 * whenever the operator typed the id in the other form.
 */
export function quarantineTombstoneIds(bookId: string): string[] {
  const ids: string[] = [];
  for (const candidate of [bookId, normSlug(String(bookId ?? ""))]) {
    if (isSafePathSegment(candidate) && !ids.includes(candidate)) ids.push(candidate);
  }
  return ids;
}

/**
 * Read the quarantine tombstone covering `bookId`, or null when the book is not
 * quarantined. Fail-closed by construction: any file that EXISTS blocks, whether
 * or not its contents can be parsed.
 */
export function readQuarantineTombstone(
  bookId: string,
  stateRoot: string = CANONICAL_PIPELINE_STATE_ROOT,
): QuarantineTombstone | null {
  for (const id of quarantineTombstoneIds(bookId)) {
    const path = quarantineTombstonePath(id, stateRoot);
    let exists = false;
    try {
      exists = existsSync(path);
    } catch {
      // An unreadable tombstone DIRECTORY is not proof of absence. Treat the
      // probe failure as a blocking tombstone rather than as permission.
      return { bookId: id, path, reason: "", unreadable: true };
    }
    if (!exists) continue;
    try {
      const parsed = JSON.parse(readFileSync(path, "utf8")) as { reason?: unknown };
      const reason = typeof parsed?.reason === "string" ? parsed.reason : "";
      return { bookId: id, path, reason, unreadable: false };
    } catch {
      return { bookId: id, path, reason: "", unreadable: true };
    }
  }
  return null;
}

/**
 * The refusal both routes print. Kept here so the legacy promoter and the v25
 * release route say the SAME thing, naming the SAME release verb.
 */
export function quarantineRefusalMessage(bookId: string, tombstone: QuarantineTombstone): string {
  const why = tombstone.reason.length > 0 ? ` (${tombstone.reason})` : "";
  return `QUARANTINED: ${bookId} was explicitly quarantined${why}. ` +
    `Promote refuses until \`unquarantine-book ${tombstone.bookId}\` releases it ` +
    `(after the defect is fixed and re-QC'd).`;
}
