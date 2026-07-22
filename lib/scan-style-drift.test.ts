/**
 * Regression coverage for the catalog-count drift guard (d) and numeric
 * arbitrary font-size occurrence guard (e) in
 * scripts/ci/scan-style-drift.mjs.
 *
 * The guard previously only scanned .tsx files and only matched book counts,
 * so hardcoded catalog claims in .ts copy constants or .md docs — and ANY
 * category/topic/genre count claim — slipped past it (finding H10, cluster
 * "scan-style-drift-scope"). These tests pin the broadened behavior: .ts/.md
 * are scanned, category counts are matched, and the single-digit book floor is
 * caught. Guard (e) coverage proves a staged, unbaselined numeric arbitrary
 * font size fails closed.
 *
 * The scanner is a standalone .mjs with no exports (it `process.exit`s), so we
 * exercise it as a subprocess: `--selftest` for the regex/false-positive matrix,
 * and `--staged` against throwaway fixtures for the end-to-end file-type + scope
 * gate. Fixtures are staged then fully reset so the working tree is untouched.
 *
 * NOTE: the fixture literals below are assembled from fragments at runtime so
 * this very test file does not itself contain a matchable catalog-count literal
 * (it lives under lib/, which guard (d) now scans). Same self-exclusion trick
 * the scanner's own --selftest uses for its class-token samples.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"])
  .toString()
  .trim();
const SCANNER = join(ROOT, "scripts/ci/scan-style-drift.mjs");

/** Run the scanner in `mode`; return { code, stdout } (never throws on exit 1). */
function runScanner(mode: string): { code: number; stdout: string } {
  try {
    const stdout = execFileSync("node", [SCANNER, mode], {
      cwd: ROOT,
      encoding: "utf8",
    });
    return { code: 0, stdout };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { code: e.status ?? 1, stdout: (e.stdout ?? "") + (e.stderr ?? "") };
  }
}

test("--selftest passes (broadened catalog regex + false-positive matrix)", () => {
  const { code, stdout } = runScanner("--selftest");
  assert.equal(code, 0, `selftest should pass; output:\n${stdout}`);
});

test("guard (d) catches hardcoded catalog claims in .ts and .md (not just .tsx)", () => {
  // Unique, un-baselined fixtures placed in scanned scopes (lib/ and docs/).
  const stamp = Date.now();
  const tsFixtureRel = `lib/__drift_fixture_${stamp}.ts`;
  const mdFixtureRel = `docs/__drift_fixture_${stamp}.md`;
  const tsFixture = join(ROOT, tsFixtureRel);
  const mdFixture = join(ROOT, mdFixtureRel);

  // A TS copy-constant claiming a category count, and a Markdown doc claiming a
  // (single-digit) book count — exactly the two gaps the old .tsx-only,
  // books-only guard let through. Built from fragments so this source file
  // contains no matchable literal of its own.
  const frag = (...p: string[]) => p.join(""); // breaks the literal for the scanner
  const categoryClaim = frag("Explore 21 ", "categories across the library");
  const bookClaim = frag("Unlock 7 ", "more books with Pro.");
  writeFileSync(tsFixture, `export const COPY = ${JSON.stringify(categoryClaim)};\n`);
  writeFileSync(mdFixture, `${bookClaim}\n`);

  try {
    execFileSync("git", ["add", "--", tsFixtureRel, mdFixtureRel], {
      cwd: ROOT,
    });
    const { code, stdout } = runScanner("--staged");
    assert.equal(
      code,
      1,
      `expected the guard to FAIL on the .ts/.md fixtures; output:\n${stdout}`,
    );
    assert.match(
      stdout,
      /Literal catalog-size count/,
      "should report the catalog-count guard",
    );
    assert.ok(
      stdout.includes(tsFixtureRel),
      `should flag the .ts category-count fixture; output:\n${stdout}`,
    );
    assert.ok(
      stdout.includes(mdFixtureRel),
      `should flag the .md book-count fixture; output:\n${stdout}`,
    );
  } finally {
    // Unstage + delete the fixtures; leave the working tree exactly as found.
    try {
      execFileSync("git", ["reset", "--quiet", "--", tsFixtureRel, mdFixtureRel], {
        cwd: ROOT,
      });
    } catch {
      /* best-effort */
    }
    if (existsSync(tsFixture)) rmSync(tsFixture);
    if (existsSync(mdFixture)) rmSync(mdFixture);
  }
});

test("guard (e) rejects an unbaselined numeric arbitrary font size in staged TSX", () => {
  const stamp = Date.now();
  const fixtureRel = `components/__drift_font_fixture_${stamp}.tsx`;
  const fixture = join(ROOT, fixtureRel);

  // Assemble the forbidden utility from fragments so this tracked test file is
  // not itself a guard (e) finding or a Tailwind source-scanner input.
  const frag = (...p: string[]) => p.join("");
  const forbiddenClass = frag("text-[", "19", "px]");
  writeFileSync(
    fixture,
    `export function DriftFixture() { return <span className=${JSON.stringify(forbiddenClass)}>fixture</span>; }\n`,
  );

  try {
    execFileSync("git", ["add", "--", fixtureRel], { cwd: ROOT });
    const { code, stdout } = runScanner("--staged");
    assert.equal(
      code,
      1,
      `expected guard (e) to FAIL on the staged TSX fixture; output:\n${stdout}`,
    );
    assert.match(
      stdout,
      /Numeric arbitrary font-size utility/,
      "should report the arbitrary font-size guard",
    );
    assert.ok(
      stdout.includes(fixtureRel),
      `should flag the staged TSX font-size fixture; output:\n${stdout}`,
    );
  } finally {
    try {
      execFileSync("git", ["reset", "--quiet", "--", fixtureRel], { cwd: ROOT });
    } catch {
      /* best-effort */
    }
    if (existsSync(fixture)) rmSync(fixture);
  }
});
