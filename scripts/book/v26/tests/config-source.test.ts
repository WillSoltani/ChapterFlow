import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { expandHome, loadBookConfig } from "../src/config";
import { loadSource, spanText, writerForm, writerFormText } from "../src/source";

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "v26-config-source-"));
}

// ---------------------------------------------------------------- config

function validConfig(): Record<string, any> {
  return {
    bookId: "the-example-book",
    title: "The Example Book",
    author: "A. Writer",
    bookType: "memoir",
    categories: ["biography"],
    tags: ["habits", "character"],
    source: { textPath: "source/book.txt", chapterMapPath: "source/map.json" },
    briefPath: "brief.md",
    shape: {
      examples: 3,
      quizQuestions: 5,
      choices: 4,
      reviewCards: 6,
      memorableLines: 3,
      ifThenPlans: 3,
      fastRead: [90, 140],
      deepRead: [300, 450],
      fullRead: [700, 1000],
    },
    writer: { bin: "claude", model: "opus", effort: "high" },
    checker: { bin: "claude", model: "sonnet", effort: "medium" },
    solver: { bin: "claude", model: "haiku", effort: "low" },
    budgetUsd: 25,
    runDir: "runs/example",
  };
}

function writeConfig(dir: string, cfg: unknown, name = "book.config.json"): string {
  const p = path.join(dir, name);
  fs.writeFileSync(p, typeof cfg === "string" ? cfg : JSON.stringify(cfg, null, 2));
  return p;
}

test("expandHome: only a leading ~/ is expanded", () => {
  assert.equal(expandHome("~/books/x.txt"), os.homedir() + "/books/x.txt");
  assert.equal(expandHome("~/"), os.homedir() + "/");
  assert.equal(expandHome("/abs/~/x"), "/abs/~/x");
  assert.equal(expandHome("rel/x"), "rel/x");
  assert.equal(expandHome("~"), "~");
  assert.equal(expandHome("~other/x"), "~other/x");
});

test("loadBookConfig: relative paths resolve against the config file's directory", () => {
  const dir = tmp();
  const file = writeConfig(dir, validConfig());
  const cfg = loadBookConfig(file);
  assert.equal(cfg.source.textPath, path.join(dir, "source/book.txt"));
  assert.equal(cfg.source.chapterMapPath, path.join(dir, "source/map.json"));
  assert.equal(cfg.briefPath, path.join(dir, "brief.md"));
  assert.equal(cfg.runDir, path.join(dir, "runs/example"));
  assert.equal(cfg.knownTrapsPath, undefined);
  assert.equal(cfg.bookType, "memoir");
  assert.deepEqual(cfg.shape.fastRead, [90, 140]);
  assert.deepEqual(cfg.writer, { bin: "claude", model: "opus", effort: "high" });
});

test("loadBookConfig: ~ is expanded in every path field, absolute paths are untouched", () => {
  const dir = tmp();
  const raw = validConfig();
  raw.source = { textPath: "~/src/book.txt", chapterMapPath: "/abs/map.json" };
  raw.knownTrapsPath = "~/traps.md";
  raw.briefPath = "~/brief.md";
  raw.runDir = "~/runs/x";
  raw.writer.bin = "~/bin/claude";
  raw.checker.bin = "~/bin/codex";
  raw.solver.bin = "~/bin/solver";
  const cfg = loadBookConfig(writeConfig(dir, raw));
  const home = os.homedir();
  assert.equal(cfg.source.textPath, `${home}/src/book.txt`);
  assert.equal(cfg.source.chapterMapPath, "/abs/map.json");
  assert.equal(cfg.knownTrapsPath, `${home}/traps.md`);
  assert.equal(cfg.briefPath, `${home}/brief.md`);
  assert.equal(cfg.runDir, `${home}/runs/x`);
  assert.equal(cfg.writer.bin, `${home}/bin/claude`);
  assert.equal(cfg.checker.bin, `${home}/bin/codex`);
  assert.equal(cfg.solver.bin, `${home}/bin/solver`);
});

test("loadBookConfig: a relative knownTrapsPath resolves; a bare command name in bin stays a command", () => {
  const dir = tmp();
  const raw = validConfig();
  raw.knownTrapsPath = "notes/traps.md";
  raw.solver.bin = "./tools/solve";
  const cfg = loadBookConfig(writeConfig(dir, raw));
  assert.equal(cfg.knownTrapsPath, path.join(dir, "notes/traps.md"));
  assert.equal(cfg.writer.bin, "claude");
  assert.equal(cfg.solver.bin, path.join(dir, "tools/solve"));
});

test("loadBookConfig: concurrency defaults to 3 and an explicit value is kept", () => {
  const dir = tmp();
  assert.equal(loadBookConfig(writeConfig(dir, validConfig())).concurrency, 3);
  const raw = validConfig();
  raw.concurrency = 5;
  assert.equal(loadBookConfig(writeConfig(dir, raw, "b.json")).concurrency, 5);
});

test("loadBookConfig: a missing required field throws CONFIG_INVALID naming the field", () => {
  const dir = tmp();
  const raw = validConfig();
  delete raw.briefPath;
  assert.throws(() => loadBookConfig(writeConfig(dir, raw)), /^Error: CONFIG_INVALID: briefPath: /);

  const nested = validConfig();
  delete nested.source.textPath;
  assert.throws(() => loadBookConfig(writeConfig(dir, nested, "n.json")), /CONFIG_INVALID: source\.textPath: /);

  const noShape = validConfig();
  delete noShape.shape.quizQuestions;
  assert.throws(() => loadBookConfig(writeConfig(dir, noShape, "s.json")), /CONFIG_INVALID: shape\.quizQuestions: /);

  const noRole = validConfig();
  delete noRole.checker;
  assert.throws(() => loadBookConfig(writeConfig(dir, noRole, "r.json")), /CONFIG_INVALID: checker: /);
});

test("loadBookConfig: a bad effort throws CONFIG_INVALID", () => {
  const dir = tmp();
  const raw = validConfig();
  raw.writer.effort = "ultra";
  assert.throws(() => loadBookConfig(writeConfig(dir, raw)), /CONFIG_INVALID: writer\.effort: /);
});

test("loadBookConfig: bad types and values throw CONFIG_INVALID", () => {
  const dir = tmp();
  const cases: Array<[string, (c: Record<string, any>) => void, RegExp]> = [
    ["bookType", (c) => { c.bookType = "novel"; }, /CONFIG_INVALID: bookType: /],
    ["categories", (c) => { c.categories = "biography"; }, /CONFIG_INVALID: categories: /],
    ["tags", (c) => { c.tags = [1]; }, /CONFIG_INVALID: tags: /],
    ["budgetUsd", (c) => { c.budgetUsd = "25"; }, /CONFIG_INVALID: budgetUsd: /],
    ["concurrency", (c) => { c.concurrency = 0; }, /CONFIG_INVALID: concurrency: /],
    ["shape.examples", (c) => { c.shape.examples = 2.5; }, /CONFIG_INVALID: shape\.examples: /],
    ["shape.fastRead", (c) => { c.shape.fastRead = [140, 90]; }, /CONFIG_INVALID: shape\.fastRead: /],
    ["shape.deepRead", (c) => { c.shape.deepRead = [300]; }, /CONFIG_INVALID: shape\.deepRead: /],
    ["solver.model", (c) => { c.solver.model = ""; }, /CONFIG_INVALID: solver\.model: /],
  ];
  for (const [name, mutate, re] of cases) {
    const raw = validConfig();
    mutate(raw);
    assert.throws(() => loadBookConfig(writeConfig(dir, raw, `${name}.json`)), re, name);
  }
});

test("loadBookConfig: unreadable or non-JSON files throw CONFIG_INVALID", () => {
  const dir = tmp();
  assert.throws(() => loadBookConfig(path.join(dir, "nope.json")), /CONFIG_INVALID: /);
  assert.throws(() => loadBookConfig(writeConfig(dir, "{ not json", "bad.json")), /CONFIG_INVALID: /);
  assert.throws(() => loadBookConfig(writeConfig(dir, "[]", "arr.json")), /CONFIG_INVALID: /);
});

// ---------------------------------------------------------------- source

// Includes a multi-byte character so the hash must be over UTF-8 bytes.
const FRONT = "FRONT MATTER — licence.\n\n";
const CH1 = "CHAPTER ONE\n\nIt began in the café.";
const GAP = "\n\n";
const CH2 = "CHAPTER TWO\n\nIt ended in the street.";
const BACK = "\n\nAPPENDIX.";
const BOOK = FRONT + CH1 + GAP + CH2 + BACK;

function writeBook(dir: string, opts: { sha?: string } = {}): { textPath: string; mapPath: string } {
  const textPath = path.join(dir, "book.txt");
  const mapPath = path.join(dir, "map.json");
  fs.writeFileSync(textPath, BOOK, "utf8");
  const s1 = FRONT.length;
  const s2 = s1 + CH1.length + GAP.length;
  fs.writeFileSync(
    mapPath,
    JSON.stringify({
      schemaVersion: "chapterflow.chapterMap.v1",
      bookId: "x",
      sourceTextSha256: opts.sha ?? createHash("sha256").update(BOOK, "utf8").digest("hex"),
      sourceTextLength: BOOK.length,
      coverageFraction: 0.9,
      spans: [
        { chapterNumber: 1, chapterTitle: "The Cafe", startOffset: s1, endOffset: s1 + CH1.length, startAnchor: "a", endAnchor: "b" },
        { chapterNumber: 2, chapterTitle: "The Street", startOffset: s2, endOffset: s2 + CH2.length, startAnchor: "c", endAnchor: "d" },
      ],
    }),
  );
  return { textPath, mapPath };
}

test("loadSource: reads text and map and computes the UTF-8 sha256", () => {
  const dir = tmp();
  const { textPath, mapPath } = writeBook(dir);
  const src = loadSource(textPath, mapPath);
  assert.equal(src.text, BOOK);
  assert.equal(src.sha256, createHash("sha256").update(BOOK, "utf8").digest("hex"));
  assert.equal(src.spans.length, 2);
  assert.equal(src.title(1), "The Cafe");
  assert.equal(src.title(2), "The Street");
  assert.throws(() => src.title(9), /NO_SUCH_CHAPTER: 9/);
});

test("loadSource: a map whose sha does not match the text throws SOURCE_SHA_MISMATCH", () => {
  const dir = tmp();
  const { textPath, mapPath } = writeBook(dir, { sha: "0".repeat(64) });
  assert.throws(() => loadSource(textPath, mapPath), /SOURCE_SHA_MISMATCH: /);
});

test("loadSource: a map without spans throws", () => {
  const dir = tmp();
  const { textPath, mapPath } = writeBook(dir);
  fs.writeFileSync(mapPath, JSON.stringify({ sourceTextSha256: createHash("sha256").update(BOOK, "utf8").digest("hex") }));
  assert.throws(() => loadSource(textPath, mapPath), /SOURCE_MAP_INVALID: /);
});

test("spanText: returns the exact characters of one chapter and throws on an unknown one", () => {
  const dir = tmp();
  const { textPath, mapPath } = writeBook(dir);
  const src = loadSource(textPath, mapPath);
  assert.equal(spanText(src, 1), CH1);
  assert.equal(spanText(src, 2), CH2);
  assert.throws(() => spanText(src, 3), /^Error: NO_SUCH_CHAPTER: 3$/);
});

// ---------------------------------------------------------------- writerForm

const FOOTNOTE_NOTE = "[3] A footnote explaining the marker.";
const RAW = [
  "The first paragraph has a marker[3] inline and a longer one[12] too.",
  "",
  "  Roses are red,\n  violets are blue.", // verse, 2-space indent: must STAY
  " \t ", // whitespace-only blank line still splits paragraphs
  "    Four spaces but no footnote before it, so it is body text.",
  "",
  "    " + FOOTNOTE_NOTE,
  "",
  "    Its continuation paragraph, indented four spaces.",
  "",
  "    A second continuation paragraph.",
  "",
  "Body again, a bracket [a] that is not a number stays.",
  "",
  "  [Illustration: a garden gate]",
  "",
  "    Indented right after an illustration, which is not a footnote, so it stays.",
  "",
  "Closing paragraph with no marks.",
].join("\n");

test("writerForm: moves footnotes, continuations and illustrations to notes; keeps verse", () => {
  const { text, notes } = writerForm(RAW);
  assert.equal(
    text,
    [
      "The first paragraph has a marker inline and a longer one too.",
      "  Roses are red,\n  violets are blue.",
      "    Four spaces but no footnote before it, so it is body text.",
      "Body again, a bracket [a] that is not a number stays.",
      "    Indented right after an illustration, which is not a footnote, so it stays.",
      "Closing paragraph with no marks.",
    ].join("\n\n"),
  );
  assert.equal(
    notes,
    [
      FOOTNOTE_NOTE,
      "Its continuation paragraph, indented four spaces.",
      "A second continuation paragraph.",
      "[Illustration: a garden gate]",
    ].join("\n\n"),
  );
});

test("writerForm: a continuation only follows a footnote and ends at the next ordinary paragraph", () => {
  const { text, notes } = writerForm("Body.\n\n    [1] Note.\n\n    More note.\n\nBody two.\n\n    Not a continuation.");
  assert.equal(text, "Body.\n\nBody two.\n\n    Not a continuation.");
  assert.equal(notes, "[1] Note.\n\nMore note.");
});

// The 4-space rule: a 2-space verse or block quote directly after a footnote (or its continuation) must stay
// in the author's text. These cases fail if indentation is matched loosely (any indent, or 2+ spaces).
test("writerForm: a 2-space verse right after a footnote and its continuation stays in the text", () => {
  const { text, notes } = writerForm(
    [
      "Body[1].",
      "    [4] The footnote.",
      "    Its continuation.",
      "  Roses are red,\n  violets are blue.", // 2-space verse straight after the continuation
      "Closing.",
    ].join("\n\n"),
  );
  assert.equal(text, ["Body.", "  Roses are red,\n  violets are blue.", "Closing."].join("\n\n"));
  assert.equal(notes, "[4] The footnote.\n\nIts continuation.");

  // Directly after the footnote itself, with no continuation in between.
  const direct = writerForm("Body.\n\n    [4] The footnote.\n\n  A block quote.\n\nEnd.");
  assert.equal(direct.text, "Body.\n\n  A block quote.\n\nEnd.");
  assert.equal(direct.notes, "[4] The footnote.");
});

test("writerForm: a [n] paragraph that is not indented exactly 4 spaces is body text, marker stripped", () => {
  const { text, notes } = writerForm(
    ["Body.", "    [3] A real footnote.", "  [4] not a footnote", "[5] bracket-led body", "     [6] five spaces", "Closing."].join("\n\n"),
  );
  assert.equal(text, ["Body.", "   not a footnote", " bracket-led body", "      five spaces", "Closing."].join("\n\n"));
  assert.equal(notes, "[3] A real footnote.");
});

// writerForm is a port of Python, whose whitespace set (str.isspace, re \s) differs from JavaScript's:
// Python counts U+001C-U+001F and U+0085 as whitespace and does not count U+FEFF.
test("writerForm: whitespace follows Python's isspace set, U+0085 counts and U+FEFF does not", () => {
  // \S: U+0085 is whitespace, so it is not a continuation and the paragraph stays.
  assert.deepEqual(writerForm("Body.\n\n    [1] Note.\n\n    \u0085x"), {
    text: "Body.\n\n    \u0085x",
    notes: "[1] Note.",
  });
  // \S: U+FEFF is not whitespace, so it is a continuation; strip() leaves the FEFF in place.
  assert.deepEqual(writerForm("Body.\n\n    [1] Note.\n\n    ﻿x"), {
    text: "Body.",
    notes: "[1] Note.\n\n﻿x",
  });
  // lstrip(): U+0085 is stripped, so this is an illustration; U+FEFF is not, so it stays.
  assert.deepEqual(writerForm("Body.\n\n\u0085[Illustration: x]"), { text: "Body.", notes: "[Illustration: x]" });
  assert.deepEqual(writerForm("Body.\n\n﻿[Illustration: x]"), { text: "Body.\n\n﻿[Illustration: x]", notes: "" });
  // strip() on a note: trailing U+0085 is trimmed, trailing U+FEFF is kept.
  assert.equal(writerForm("Body.\n\n[Illustration: x]\u0085").notes, "[Illustration: x]");
  assert.equal(writerForm("Body.\n\n[Illustration: x]﻿").notes, "[Illustration: x]﻿");
  // The other C0 separators U+001C-U+001F are whitespace too.
  assert.equal(writerForm("Body.\n\n\u001c[Illustration: x]").notes, "[Illustration: x]");
});

test("writerForm: only newlines are stripped at the ends of the text", () => {
  const { text } = writerForm("\n\n  Indented opening line.\n\nEnd.\n\n");
  // The empty strings the split leaves at the ends are joined, then newlines trimmed; leading spaces stay.
  assert.equal(text, "  Indented opening line.\n\nEnd.");
});

test("writerForm: no notes gives an empty notes string", () => {
  assert.deepEqual(writerForm("One.\n\nTwo[7]."), { text: "One.\n\nTwo.", notes: "" });
});

test("writerFormText: without notes it is the text alone", () => {
  assert.equal(writerFormText("One.\n\nTwo[7]."), "One.\n\nTwo.");
});

test("writerFormText: with notes it appends the editor's-notes block", () => {
  const out = writerFormText("Body[1].\n\n    [1] The note.\n\n[Illustration: map]");
  assert.equal(
    out,
    "Body." +
      "\n\nEDITOR'S NOTES (a later editor's words, not the author's; never quote them as the author)\n\n" +
      "[1] The note.\n\n[Illustration: map]",
  );
});
