import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const css = readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8");

function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`));
  assert.ok(match, `missing ${selector} rule`);
  return match[1];
}

function channel(v: number): number {
  const n = v / 255;
  return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const value = hex.replace("#", "");
  const parts = [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
  return 0.2126 * channel(parts[0]) + 0.7152 * channel(parts[1]) + 0.0722 * channel(parts[2]);
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

test("the public shell aliases every legacy marketing accent to Recall periwinkle", () => {
  const publicSite = rule(".cf-public-site");
  assert.match(publicSite, /--accent-cyan:\s*var\(--cf-recall-accent\)/);
  assert.match(publicSite, /--primary:\s*var\(--cf-recall-accent\)/);
  assert.match(publicSite, /--cf-anchor-accent:\s*var\(--cf-recall-accent\)/);
  assert.match(publicSite, /--ring:\s*var\(--cf-recall-accent\)/);
});

test("the paper folio is a light material within the same periwinkle system", () => {
  const paper = rule(".cf-paper-folio");
  assert.match(paper, /color-scheme:\s*light/);
  assert.match(paper, /--cf-paper-field:\s*#F6F2E8/i);
  assert.match(paper, /--cf-paper-sheet:\s*#FBF8F1/i);
  assert.match(paper, /--accent-cyan:\s*var\(--cf-recall-accent-ink\)/);
  assert.match(paper, /--text-heading:\s*#171925/i);
  assert.match(paper, /--text-secondary:\s*#3F4250/i);
  assert.match(paper, /--border-subtle:\s*#D8D1C4/i);
});

test("dark and paper accent/text pairs meet their WCAG contrast roles", () => {
  assert.ok(contrast("#8AA2FF", "#06070A") >= 4.5, "dark accent must meet AA text contrast");
  assert.ok(contrast("#5265C2", "#F6F2E8") >= 4.5, "paper accent link must meet AA");
  assert.ok(contrast("#3F4250", "#FBF8F1") >= 4.5, "paper body must meet AA");
  assert.ok(contrast("#171925", "#FBF8F1") >= 7, "paper heading must meet AAA");
});

test("both materials use solid, visible Recall focus treatment", () => {
  assert.match(rule(".cf-public-site :focus-visible"), /outline:\s*2px solid var\(--cf-recall-accent\)/);
  assert.match(
    rule(".cf-public-site .cf-paper-folio :focus-visible"),
    /outline-color:\s*var\(--cf-recall-accent-ink\)/,
  );
  const filterFocus = rule(".rl-filter-chip:focus-visible");
  assert.match(filterFocus, /outline:\s*2px solid var\(--cf-recall-accent\)/);
  assert.match(filterFocus, /outline-offset:\s*2px/);
  assert.doesNotMatch(filterFocus, /accent-line/);
  assert.doesNotMatch(filterFocus, /outline:\s*none/);
});
