import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";

const ROOT = process.cwd();
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const FORBIDDEN_BOOK_IMPORT = /@\/app\/book\//g;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    const extension = entry.name.slice(entry.name.lastIndexOf("."));
    return SOURCE_EXTENSIONS.has(extension) ? [path] : [];
  });
}

test("components and lib do not import from the app/book route tree", () => {
  const violations = ["components", "lib"].flatMap((directory) =>
    sourceFiles(join(ROOT, directory)).flatMap((path) => {
      const source = readFileSync(path, "utf8");
      const matches = source.match(FORBIDDEN_BOOK_IMPORT) ?? [];
      return matches.map(() => relative(ROOT, path));
    }),
  );

  assert.deepEqual(
    violations,
    [],
    `found ${violations.length} @/app/book/ imports:\n${violations.join("\n")}`,
  );
});

test("ESLint actively restricts components from importing app/book", () => {
  const config = readFileSync(join(ROOT, "eslint.config.mjs"), "utf8");

  assert.match(config, /files:\s*\["components\/\*\*\/\*\.\{ts,tsx\}"\]/);
  assert.match(config, /@\/app\/book\/\*\*/);
  assert.match(config, /no-restricted-imports/);
});
