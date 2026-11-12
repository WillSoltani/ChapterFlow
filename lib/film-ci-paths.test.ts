import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

// The CI job "film" (.github/workflows/ci.yml) runs the film specs only when
// a change touches one of the paths in its `git diff --name-only` list. A
// file the film imports (transitively, from the landing page, the root
// layout, the middleware that sets its CSP, the Next config, the Playwright
// config and the film's own specs and scripts) that the list misses would let
// a pull request that breaks the film skip the film specs and pass. This walks
// the import graph from those roots and requires every file it reaches to be
// covered by the list. Pure node:fs.

const ROOT = process.cwd();
const CI_YML = path.join(ROOT, ".github", "workflows", "ci.yml");

/** The pathspecs of the film job's change filter, as written in ci.yml. */
export function filmPathspecs(yml: string): string[] {
  const m = /changed="\$\(git diff --name-only "\$base" HEAD --([\s\S]*?)\)"/.exec(yml);
  if (!m?.[1]) throw new Error("ci.yml: the film job's git diff pathspec list was not found");
  return m[1]
    .split(/\s+/)
    .map((s) => s.replace(/\\$/, "").replace(/^'(.*)'$/, "$1").trim())
    .filter((s) => s && s !== "\\");
}

/** Git-style match: an exact path, a directory prefix, or a `*` glob. */
export function covered(file: string, specs: string[]): boolean {
  return specs.some((s) => {
    if (s.includes("*")) {
      const re = new RegExp(`^${s.split("*").map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*")}(/.*)?$`);
      return re.test(file);
    }
    return file === s || file.startsWith(`${s.replace(/\/$/, "")}/`);
  });
}

const EXTS = ["", ".ts", ".tsx", ".mts", ".js", ".mjs", ".json", ".css", "/index.ts", "/index.tsx", "/index.js"];
const SPEC_RE =
  /(?:^|[\s;{}])(?:import|export)\s[^"'`;]*?from\s*["']([^"']+)["']|(?:^|[\s;{}(=,])import\s*\(\s*["']([^"']+)["']\s*\)|(?:^|[\s;])import\s+["']([^"']+)["']|require\(\s*["']([^"']+)["']\s*\)|@import\s+["']([^"']+)["']/gm;

function resolve(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = path.join(ROOT, spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec);
  else return null; // a package
  for (const ext of EXTS) {
    const p = base + ext;
    if (existsSync(p) && statSync(p).isFile()) return p;
  }
  return null;
}

/** Every repository file reachable from `roots` through static and dynamic imports. */
export function importClosure(roots: string[]): Set<string> {
  const seen = new Set<string>();
  const queue = roots.map((r) => path.join(ROOT, r));
  while (queue.length) {
    const file = queue.pop()!;
    const rel = path.relative(ROOT, file);
    if (seen.has(rel) || rel.startsWith("..") || rel.includes("node_modules")) continue;
    seen.add(rel);
    if (!/\.(m?[jt]sx?|css)$/.test(file)) continue;
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(SPEC_RE)) {
      const spec = m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5];
      if (!spec) continue;
      const hit = resolve(file, spec);
      if (hit) queue.push(hit);
    }
  }
  return seen;
}

const listDir = (dir: string, keep: (f: string) => boolean) =>
  readdirSync(path.join(ROOT, dir))
    .filter(keep)
    .map((f) => `${dir}/${f}`)
    .filter((f) => statSync(path.join(ROOT, f)).isFile());

test("the film job's change filter covers every file the film depends on", () => {
  const specs = filmPathspecs(readFileSync(CI_YML, "utf8"));
  const roots = [
    "app/page.tsx",
    "app/layout.tsx",
    "app/globals.css",
    "middleware.ts",
    "next.config.ts",
    "playwright.config.ts",
    ...listDir("e2e", (f) => f.startsWith("film-")),
    ...listDir("scripts/film", (f) => /\.m?js$/.test(f)),
    ...listDir("components/film", (f) => /\.(tsx?|json)$/.test(f) && !/\.test\.tsx?$/.test(f)),
  ];
  const closure = importClosure(roots);
  assert.ok(closure.size > roots.length, "the import walk found nothing beyond its roots");
  const missing = [...closure].filter((f) => !covered(f, specs)).sort();
  assert.deepEqual(missing, [], `ci.yml film job: add these to its git diff list:\n  ${missing.join("\n  ")}`);
});

test("pathspec matching: directories, exact files and globs", () => {
  const specs = ["components/film", "app/page.tsx", "e2e/film-*"];
  assert.equal(covered("components/film/scrub.ts", specs), true);
  assert.equal(covered("components/filmstrip.ts", specs), false);
  assert.equal(covered("app/page.tsx", specs), true);
  assert.equal(covered("app/page.tsx.bak", specs), false);
  assert.equal(covered("e2e/film-truth.spec.ts", specs), true);
  assert.equal(covered("e2e/smoke.spec.ts", specs), false);
});
