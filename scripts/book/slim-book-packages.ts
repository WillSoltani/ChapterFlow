/**
 * slim-book-packages — one-time (idempotent) catalog sweep for WS1 / K5.
 *
 * Rewrites every `book-packages/*.v21.json` to the classic v21 SLIM shape:
 *   { schemaVersion, packageId, createdAt, contentOwner, book, chapters[…slim] }
 * by (a) removing an embedded `productionManifest` (the 75 KB internal-run-path /
 * code-inventory blob that leaks into the client bundle) and (b) dropping the
 * dead-in-distribution chapter fields (the K2 reader-content-strip-v3 set). It
 * PRESERVES each already-shipped book's `packageId` + `createdAt` (identity of old
 * books is never rewritten), preserves each file's existing trailing-newline
 * convention, and is byte-idempotent (running twice = no change).
 *
 * It self-asserts CONTENT PRESERVATION: for every book, the swept output must be
 * deep-equal to the input after removing ONLY the dropped keys — the sweep can
 * never silently alter chapter reader content.
 *
 * Usage (from repo root):
 *   npx tsx scripts/book/slim-book-packages.ts            # dry-run (default)
 *   npx tsx scripts/book/slim-book-packages.ts --dry-run  # explicit dry-run
 *   npx tsx scripts/book/slim-book-packages.ts --apply    # rewrite in place
 */

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PACKAGES_DIR = join(process.cwd(), "book-packages");

// ── The K5 drop set (mirrors src/lib/readerContent.ts reader-content-strip-v3) ──
// Package-level: productionManifest. Deep key-names (unique to internals):
const DEEP_KEYS = new Set([
  "productionManifest",
  "authoring",
  "planSpec",
  "sourceAnchorId",
  "sourceAnchorIds",
  "keyEvidenceAnchorIds",
  "titleSourceAnchorIds",
  "coreSkillSourceAnchorIds",
  "twentyFourHourChallengeSourceAnchorIds",
  "weeklyPracticeSourceAnchorIds",
  "hookSourceAnchorIds",
  "counterintuitionSourceAnchorIds",
  "keyTakeawaySourceAnchorIds",
  "tryThisNowSourceAnchorIds",
  "namedCaseIds",
  "sourceFactIds",
  "depthLevel",
]);

type Json = unknown;
function isObject(v: Json): v is Record<string, Json> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/** Deep-remove DEEP_KEYS anywhere in the tree. */
function stripDeep(value: Json): Json {
  if (Array.isArray(value)) return value.map(stripDeep);
  if (isObject(value)) {
    const out: Record<string, Json> = {};
    for (const [k, v] of Object.entries(value)) {
      if (DEEP_KEYS.has(k)) continue;
      out[k] = stripDeep(v);
    }
    return out;
  }
  return value;
}

/**
 * Path-aware removal on a single CHAPTER object (mirrors
 * readerContent.ts stripPathAwareInternalFields):
 *   - per-chapter schemaVersion (top-level of the chapter only)
 *   - implementationPlan.title
 *   - memorableLines[].location / .why
 * Reader content sharing a generic key name (examples[].title, chapters[].title,
 * examples[].whyItMatters) is untouched.
 */
function stripChapterPathAware(chapter: Json): Json {
  if (!isObject(chapter)) return chapter;
  const out: Record<string, Json> = { ...chapter };
  delete out.schemaVersion;
  if (isObject(out.implementationPlan)) {
    const plan = { ...out.implementationPlan };
    delete plan.title;
    out.implementationPlan = plan;
  }
  if (Array.isArray(out.memorableLines)) {
    out.memorableLines = out.memorableLines.map((line) => {
      if (!isObject(line)) return line;
      const next = { ...line };
      delete next.location;
      delete next.why;
      return next;
    });
  }
  return out;
}

/** Produce the slim package from a raw parsed package. */
function slimPackage(pkg: Record<string, Json>): Record<string, Json> {
  const deep = stripDeep(pkg) as Record<string, Json>;
  if (Array.isArray(deep.chapters)) {
    deep.chapters = deep.chapters.map(stripChapterPathAware);
  }
  return deep;
}

/**
 * Content-preservation self-assertion: `after` must equal `before` once the
 * dropped keys are removed from BOTH. i.e. the sweep removes ONLY the drop set
 * and never mutates any surviving byte. Returns null if preserved, else a diff path.
 */
function contentPreservationViolation(before: Json, after: Json, path = "$"): string | null {
  const b = removeAllDropped(before);
  const a = removeAllDropped(after);
  return deepDiff(b, a, path);
}

/** Remove BOTH deep keys and path-aware chapter internals everywhere, so two
 *  values can be compared for "same modulo the drop set". */
function removeAllDropped(value: Json): Json {
  const deep = stripDeep(value);
  return removePathAwareEverywhere(deep);
}
function removePathAwareEverywhere(value: Json): Json {
  if (Array.isArray(value)) return value.map(removePathAwareEverywhere);
  if (isObject(value)) {
    // A chapter-like object (has chapterId + implementationPlan/memorableLines/schemaVersion)
    // gets the path-aware strip; then recurse.
    const stripped = stripChapterPathAware(value) as Record<string, Json>;
    const out: Record<string, Json> = {};
    for (const [k, v] of Object.entries(stripped)) out[k] = removePathAwareEverywhere(v);
    return out;
  }
  return value;
}

function deepDiff(a: Json, b: Json, path: string): string | null {
  if (a === b) return null;
  if (typeof a !== typeof b) return `${path}: type ${typeof a} != ${typeof b}`;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return `${path}: array/non-array`;
    if (a.length !== b.length) return `${path}: length ${a.length} != ${b.length}`;
    for (let i = 0; i < a.length; i++) {
      const d = deepDiff(a[i], b[i], `${path}[${i}]`);
      if (d) return d;
    }
    return null;
  }
  if (isObject(a) && isObject(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      const d = deepDiff(a[k], b[k], `${path}.${k}`);
      if (d) return d;
    }
    return null;
  }
  return `${path}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`;
}

function countRemovedKeys(before: Json, after: Json): Record<string, number> {
  const counts: Record<string, number> = {};
  const beforeKeys: Record<string, number> = {};
  const afterKeys: Record<string, number> = {};
  tallyKeys(before, beforeKeys, true);
  tallyKeys(after, afterKeys, true);
  for (const k of Object.keys(beforeKeys)) {
    const delta = beforeKeys[k] - (afterKeys[k] ?? 0);
    if (delta > 0) counts[k] = delta;
  }
  return counts;
}
function tallyKeys(value: Json, acc: Record<string, number>, top: boolean): void {
  if (Array.isArray(value)) { for (const v of value) tallyKeys(v, acc, false); return; }
  if (isObject(value)) {
    for (const [k, v] of Object.entries(value)) {
      acc[k] = (acc[k] ?? 0) + 1;
      tallyKeys(v, acc, false);
    }
  }
}

type FileReport = { file: string; bookId: string; beforeBytes: number; afterBytes: number; removed: Record<string, number>; changed: boolean };

function sweepFile(file: string, apply: boolean): FileReport {
  const path = join(PACKAGES_DIR, file);
  const raw = readFileSync(path, "utf8");
  const hadTrailingNewline = raw.endsWith("\n");
  const pkg = JSON.parse(raw) as Record<string, Json>;
  const bookId = (isObject(pkg.book) && typeof pkg.book.bookId === "string" ? pkg.book.bookId : file.replace(/\.v21\.json$/, ""));

  const slim = slimPackage(pkg);

  // Content-preservation self-assertion (fail-closed).
  const violation = contentPreservationViolation(pkg, slim);
  if (violation) {
    throw new Error(`CONTENT PRESERVATION VIOLATION in ${file}: ${violation}`);
  }

  // Stable stringify (indent 2), preserving the file's own trailing-newline convention.
  const serialized = JSON.stringify(slim, null, 2) + (hadTrailingNewline ? "\n" : "");
  const changed = serialized !== raw;
  const removed = countRemovedKeys(pkg, slim);

  if (apply && changed) writeFileSync(path, serialized, "utf8");

  return { file, bookId, beforeBytes: Buffer.byteLength(raw), afterBytes: Buffer.byteLength(serialized), removed, changed };
}

function main(): void {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const files = readdirSync(PACKAGES_DIR).filter((f) => f.endsWith(".v21.json")).sort();

  const reports: FileReport[] = [];
  for (const file of files) reports.push(sweepFile(file, apply));

  const changed = reports.filter((r) => r.changed);
  const totalBefore = reports.reduce((s, r) => s + r.beforeBytes, 0);
  const totalAfter = reports.reduce((s, r) => s + r.afterBytes, 0);

  console.log(`slim-book-packages (${apply ? "APPLY" : "DRY-RUN"}) — ${files.length} packages, ${changed.length} would change\n`);
  const rows = changed.length > 0 ? changed : reports.slice(0, 0);
  if (rows.length > 0) {
    console.log("book".padEnd(38) + "Δbytes".padStart(10) + "  fields removed");
    console.log("-".repeat(38 + 10 + 30));
    for (const r of changed) {
      const delta = r.afterBytes - r.beforeBytes;
      const removed = Object.entries(r.removed).map(([k, n]) => `${k}×${n}`).join(", ") || "(formatting)";
      console.log(r.bookId.slice(0, 37).padEnd(38) + String(delta).padStart(10) + `  ${removed}`);
    }
    console.log("-".repeat(38 + 10 + 30));
  }
  console.log(
    `\nTotal: ${totalBefore} → ${totalAfter} bytes (${totalBefore - totalAfter} saved). ` +
    `${apply ? `Rewrote ${changed.length} file(s).` : "Dry-run — pass --apply to rewrite."}`,
  );
  if (!apply && changed.length > 0) {
    console.log("Run again after --apply to confirm idempotence (0 would change).");
  }
}

main();
