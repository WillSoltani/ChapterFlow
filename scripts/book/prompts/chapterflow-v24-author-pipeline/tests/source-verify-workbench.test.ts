/**
 * buildSourceVerifyWorkbench — the pure HTML generator behind `source-verify-workbench <book>`.
 * The in-browser form can't be unit-tested here, so these guard the data layer: the page inlines
 * exactly the items the gate will check (coverage parity), serializes to the record shape
 * source-verify-check reads, and is safe against a `</script>` breakout from claim/detail text.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { buildSourceVerifyWorkbench, type WorkbenchChapter } from "../src/sourceVerifyWorkbench.js";
import type { SourceVerifyItem } from "../src/critics/sourceVerify.js";

function item(over: Partial<SourceVerifyItem>): SourceVerifyItem {
  return { chapterNumber: 1, kind: "named_example", id: "x", claim: "c", detail: "d", ...over };
}

const CHAPTERS: WorkbenchChapter[] = [
  {
    chapterNumber: 1,
    sidecarPath: "state/source-v2/zz-book-ch01.json",
    items: [item({ id: "ex.1", claim: "Cal Newport quit social media" }), item({ id: "fact.1.0", kind: "testable_fact", claim: "53% figure" })],
  },
  { chapterNumber: 2, sidecarPath: "state/source-v2/zz-book-ch02.json", items: [item({ chapterNumber: 2, id: "ex.2", claim: "Thoreau at Walden" })] },
];

/** Pull the inlined `const DATA = {...};` back out and parse it (JSON unicode escapes decode fine). */
function extractData(html: string): any {
  const m = html.match(/const DATA = (.+);\nconst VERDICTS =/);
  assert.ok(m, "DATA literal present");
  return JSON.parse(m![1]);
}

test("workbench inlines exactly the gate's items (coverage parity), grouped by chapter", () => {
  const data = extractData(buildSourceVerifyWorkbench("zz-book", CHAPTERS));
  assert.equal(data.bookId, "zz-book");
  assert.deepEqual(data.chapters.map((c: any) => c.chapterNumber), [1, 2]);
  assert.deepEqual(data.chapters[0].items.map((i: any) => i.id), ["ex.1", "fact.1.0"]);
  assert.equal(data.chapters[0].sidecarPath, "state/source-v2/zz-book-ch01.json");
  assert.equal(data.chapters[0].items[1].kind, "testable_fact");
});

test("the page serializes to the source-verify-record-v1 shape with the right item fields", () => {
  const html = buildSourceVerifyWorkbench("zz-book", CHAPTERS);
  assert.match(html, /schemaVersion: "source-verify-record-v1"/);
  for (const f of ["id:", "kind:", "verdict:", "sourceRef:", "note:"]) assert.ok(html.includes(f), `record carries ${f}`);
  for (const v of ["VERIFIED", "UNVERIFIABLE", "WRONG"]) assert.ok(html.includes(`"${v}"`), `verdict option ${v}`);
});

test("claim/detail text cannot break out of the inlined <script>", () => {
  const evil = buildSourceVerifyWorkbench("zz-book", [
    { chapterNumber: 1, sidecarPath: "p", items: [item({ id: "e", claim: "</script><img src=x onerror=alert(1)>", detail: "a & b < c" })] },
  ]);
  // The only </script> in the document is the real closing tag, not one smuggled via data.
  assert.equal((evil.match(/<\/script>/g) || []).length, 1);
  // Yet the data is preserved (escaped) and decodes back to the original text.
  const data = extractData(evil);
  assert.equal(data.chapters[0].items[0].claim, "</script><img src=x onerror=alert(1)>");
  assert.equal(data.chapters[0].items[0].detail, "a & b < c");
});

test("bookId is HTML-escaped where it lands in markup (title/header)", () => {
  const html = buildSourceVerifyWorkbench("a<b>&c", []);
  assert.ok(!html.includes("<title>Source verify — a<b>"), "raw bookId not injected into title");
  assert.match(html, /a&lt;b&gt;&amp;c/);
});
