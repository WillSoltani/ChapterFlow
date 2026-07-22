import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";
import { RecallReveal } from "./RecallReveal";

const source = (relativePath: string) =>
  readFileSync(path.join(process.cwd(), relativePath), "utf8");

test("server rendering keeps reveal content visible and in source order", () => {
  const html = renderToStaticMarkup(
    <RecallReveal className="reveal-probe">
      <section aria-label="First section">First section</section>
      <section aria-label="Second section">Second section</section>
    </RecallReveal>,
  );
  const wrapperTag = html.match(/^<div[^>]*>/)?.[0] ?? "";
  const wrapperClasses = wrapperTag.match(/class="([^"]*)"/)?.[1]?.split(/\s+/) ?? [];

  assert.match(wrapperTag, /class="reveal-probe"/);
  assert.equal(wrapperClasses.includes("cf-reveal"), false);
  assert.equal(wrapperClasses.includes("cf-reveal-in"), false);
  assert.ok(html.indexOf("First section") < html.indexOf("Second section"));
});

test("print forces armed wrapper and staggered children into their visible state", () => {
  const css = source("app/globals.css");
  const printBlock = css.match(
    /@media print\s*\{[\s\S]*?\.cf-reveal-group \.cf-reveal-item[\s\S]*?\n\}/,
  )?.[0];

  assert.ok(printBlock, "expected a print safety block for RecallReveal");
  assert.match(printBlock, /\.cf-reveal\s*,/);
  assert.match(printBlock, /\.cf-reveal-group \.cf-reveal-item/);
  assert.match(printBlock, /opacity:\s*1\s*!important/);
  assert.match(printBlock, /transform:\s*none\s*!important/);
  assert.match(printBlock, /transition:\s*none\s*!important/);
});
