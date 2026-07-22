import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";

// WS5-030: utilities use Tailwind v4 defaults (sm=640 md=768 lg=1024 xl=1280);
// hand-authored max-width complements use the X-0.02px form (1023.98). Any other
// width needs an inline rationale comment. Section markers (/* ---- x ---- */)
// are dividers, not rationale.
const DOCUMENTED = new Set(["640", "768", "1024", "1280", "1023.98"]);
const cssPath = path.join(process.cwd(), "app", "globals.css");
const css = readFileSync(cssPath, "utf8");
const lines = css.split("\n");
const hasRationale = (s: string) => /\/\*(?!\s*----)/.test(s);

test("globals.css documents the project breakpoint set", () => {
  assert.match(css, /Breakpoint set \(WS5-030\)/);
});

test("every width media query in globals.css uses a documented breakpoint or carries an inline rationale comment", () => {
  const offenders: string[] = [];
  lines.forEach((line, i) => {
    for (const m of line.matchAll(/@media[^{]*?\((?:min|max)-width:\s*([\d.]+)px\)/g)) {
      if (DOCUMENTED.has(m[1]!)) continue;
      const window = lines.slice(Math.max(0, i - 3), i + 1).join("\n");
      if (!hasRationale(window)) offenders.push(`line ${i + 1}: ${line.trim()}`);
    }
  });
  assert.deepEqual(offenders, []);
});
