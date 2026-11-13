/** The cover step: the prompt, the style ledger, and the returned image turned into the app's pair. Hermetic: temp dirs
 *  for the run, the ledger and the cover folder; images made here with sharp; no model and no network. */
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

import { main } from "../cli";
import {
  COVER_GENERATION,
  COVER_LEDGER,
  COVER_STYLES,
  coverBrief,
  coverPrompt,
  coverStatus,
  installCover,
  styleCounts,
  type CoverCtx,
  type CoverLedger,
} from "../src/cover";

// The real prompt, whatever another suite's environment points at.
delete process.env.V26_PROMPT_DIR;

const FAKE = fileURLToPath(new URL("./fixtures/fake-claude.mjs", import.meta.url));
const NOW = () => new Date("2026-11-12T10:00:00.000Z");
const LEDGER_EXISTED = fs.existsSync(COVER_LEDGER);

const roots: string[] = [];
after(() => {
  for (const d of roots) fs.rmSync(d, { recursive: true, force: true });
});
const tmp = (): string => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "v26-cover-"));
  roots.push(d);
  return d;
};

const desc = (name: string): string => COVER_STYLES.find(([n]) => n === name)![1];
const names = COVER_STYLES.map(([n]) => n);

function setup(opts: { bookId?: string; title?: string; author?: string; ledger?: CoverLedger } = {}) {
  const dir = tmp();
  const ctx: CoverCtx = { config: { bookId: opts.bookId ?? "demo-book", runDir: path.join(dir, "run"), title: opts.title ?? "Demo Book", author: opts.author ?? "A. Author" } };
  const ledgerPath = path.join(dir, "covers.json");
  if (opts.ledger) fs.writeFileSync(ledgerPath, JSON.stringify(opts.ledger, null, 2) + "\n");
  const coversDir = path.join(dir, "book-covers");
  return { dir, ctx, ledgerPath, coversDir };
}

const entry = (style: string, concept = "a picture") => ({ concept, style, at: "2026-11-01T00:00:00.000Z" });

/** A picture with real content: two gradients, a disc, a bar and a little deterministic grain, so the encoders have
 *  something to encode. `flat` paints one colour only. */
async function picture(file: string, width: number, height: number, opts: { flat?: boolean } = {}): Promise<string> {
  const px = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      if (opts.flat) {
        px[i] = 40; px[i + 1] = 90; px[i + 2] = 160;
        continue;
      }
      const grain = ((x * 7919 + y * 104729) % 29) - 14;
      const inDisc = (x - width / 2) ** 2 + (y - height / 2) ** 2 < (width / 4) ** 2;
      const inBar = y > height * 0.1 && y < height * 0.2 && x > width * 0.1 && x < width * 0.9;
      const [r, g, b] = inDisc ? [230, 180 - (y % 40), 60] : inBar ? [250, 245, 235] : [(x * 255) / width, (y * 200) / height, 120 + ((x + y) % 60)];
      px[i] = Math.max(0, Math.min(255, r + grain));
      px[i + 1] = Math.max(0, Math.min(255, g + grain));
      px[i + 2] = Math.max(0, Math.min(255, b + grain));
    }
  }
  const img = sharp(px, { raw: { width, height, channels: 3 } });
  await (file.endsWith(".jpg") ? img.jpeg({ quality: 90 }) : img.png()).toFile(file);
  return file;
}

// ---------------------------------------------------------------- the prompt

test("coverPrompt: title, author, picture and the style's description filled in, nothing left, double quotes made single", () => {
  const p = coverPrompt({ title: 'The "Real" Title', author: 'Jo "JJ" Smith', concept: "A lighthouse made of stacked books.", style: "ink-wash" });
  assert.ok(p.startsWith("Front cover design for a non-fiction book. Portrait, 2:3."));
  assert.ok(p.includes(`- the title, set large and perfectly legible: "The 'Real' Title"\n`));
  assert.ok(p.includes(`- the author's name, smaller, in a clear band near the bottom: "Jo 'JJ' Smith"\n`));
  assert.ok(p.includes("THE PICTURE: A lighthouse made of stacked books.\n"));
  assert.ok(p.includes(`ART DIRECTION: ${desc("ink-wash")}\n`));
  assert.ok(!p.includes("@@"));
  assert.ok(p.includes("no logo and no trademark."));
  assert.throws(() => coverPrompt({ title: "T", author: "A", concept: "c", style: "neon" }), /^Error: COVER_STYLE_UNKNOWN: "neon"/);
});

// ---------------------------------------------------------------- the style choice

test("styleCounts and coverBrief's style: fewest used by other books, ties in list order, an explicit style wins", () => {
  assert.deepEqual(styleCounts({}).map((s) => s.style), names);
  const ledger: CoverLedger = { a: entry("painted-still-life"), b: entry("painted-still-life"), c: entry("flat-poster"), d: entry("unknown-old-style") };
  const counts = styleCounts(ledger);
  assert.deepEqual(counts.map((s) => [s.style, s.count]), [["cut-paper", 0], ["ink-wash", 0], ["dusk-scene", 0], ["engraving", 0], ["flat-poster", 1], ["painted-still-life", 2]]);


  const f = setup({ ledger });
  assert.equal(coverBrief(f.ctx, { concept: "x", ledgerPath: f.ledgerPath, now: NOW }).style, "cut-paper");
  // An explicit style wins, even the most used one.
  const g = setup({ ledger });
  assert.equal(coverBrief(g.ctx, { concept: "x", style: "painted-still-life", ledgerPath: g.ledgerPath, now: NOW }).style, "painted-still-life");
  // An unknown style is refused before anything is written.
  const h = setup({ ledger });
  assert.throws(() => coverBrief(h.ctx, { concept: "x", style: "neon", ledgerPath: h.ledgerPath, now: NOW }), /^Error: COVER_STYLE_UNKNOWN: "neon" is not a cover style \(choose from painted-still-life, /);
  assert.ok(!fs.existsSync(path.join(h.ctx.config.runDir, "cover")));
  assert.deepEqual(JSON.parse(fs.readFileSync(h.ledgerPath, "utf8")), ledger);
  // The book's own earlier entry does not count against it: with it, cut-paper would be taken and ink-wash next.
  const own = setup({ ledger: { "demo-book": entry("cut-paper"), a: entry("painted-still-life"), b: entry("flat-poster") } });
  assert.equal(coverBrief(own.ctx, { concept: "x", ledgerPath: own.ledgerPath, now: NOW }).style, "cut-paper");
});

// ---------------------------------------------------------------- the brief

test("coverBrief: prompt.txt, brief.json and the ledger entry (created, then replaced in place), the concept trimmed", () => {
  const f = setup({ title: 'Say "No"', author: "B. Writer" });
  assert.ok(!fs.existsSync(f.ledgerPath));
  const r = coverBrief(f.ctx, { concept: "  A single red door in a long grey wall.  ", ledgerPath: f.ledgerPath, now: NOW });
  const dir = path.join(f.ctx.config.runDir, "cover");
  assert.equal(r.promptFile, path.join(dir, "prompt.txt"));
  assert.equal(r.briefFile, path.join(dir, "brief.json"));
  assert.equal(fs.readFileSync(r.promptFile, "utf8"), r.prompt);
  assert.equal(r.prompt, coverPrompt({ title: 'Say "No"', author: "B. Writer", concept: "A single red door in a long grey wall.", style: r.style }));
  assert.equal(r.style, "painted-still-life");
  const brief = JSON.parse(fs.readFileSync(r.briefFile, "utf8"));
  assert.deepEqual(brief, { bookId: "demo-book", title: 'Say "No"', author: "B. Writer", concept: "A single red door in a long grey wall.", style: "painted-still-life", generation: COVER_GENERATION, at: "2026-11-12T10:00:00.000Z" });
  assert.deepEqual(brief.generation, { model: "gpt_image_2", aspectRatio: "2:3", resolution: "2k", quality: "high", fallbackModels: ["nano_banana_pro", "soul_2"] });
  const text = fs.readFileSync(f.ledgerPath, "utf8");
  assert.equal(text, JSON.stringify({ "demo-book": { concept: "A single red door in a long grey wall.", style: "painted-still-life", at: "2026-11-12T10:00:00.000Z" } }, null, 2) + "\n");

  // Other books keep their order; this one's entry is replaced where it was.
  const g = setup({ ledger: { a: entry("flat-poster"), "demo-book": entry("engraving", "old"), z: entry("ink-wash") } });
  coverBrief(g.ctx, { concept: "new picture", style: "dusk-scene", ledgerPath: g.ledgerPath, now: NOW });
  const after = JSON.parse(fs.readFileSync(g.ledgerPath, "utf8")) as CoverLedger;
  assert.deepEqual(Object.keys(after), ["a", "demo-book", "z"]);
  assert.deepEqual(after["demo-book"], { concept: "new picture", style: "dusk-scene", at: "2026-11-12T10:00:00.000Z" });
  assert.deepEqual(after.a, entry("flat-poster"));
});

test("coverBrief refuses a concept that is empty, has a line break or runs past 60 words; 60 words pass", () => {
  const f = setup();
  const brief = (concept: string) => coverBrief(f.ctx, { concept, ledgerPath: f.ledgerPath, now: NOW });
  assert.throws(() => brief("   "), /^Error: COVER_CONCEPT_INVALID: the concept is empty/);
  assert.throws(() => brief("A door.\nA wall."), /^Error: COVER_CONCEPT_INVALID: the concept has a line break/);
  assert.throws(() => brief("A door.\r\nA wall."), /COVER_CONCEPT_INVALID: the concept has a line break/);
  assert.throws(() => brief(Array.from({ length: 61 }, () => "word").join(" ")), /^Error: COVER_CONCEPT_INVALID: the concept has 61 words; keep it to 60/);
  assert.ok(!fs.existsSync(f.ledgerPath) && !fs.existsSync(path.join(f.ctx.config.runDir, "cover")), "a refusal writes nothing");
  assert.equal(brief(` ${Array.from({ length: 60 }, () => "word").join(" ")}\n`).style, "painted-still-life", "the trailing newline is trimmed first");
});

test("coverStatus: the styles by use (this book's own entry left out) and the pictures taken; it writes nothing", () => {
  const f = setup();
  assert.deepEqual(coverStatus(f.ctx, { ledgerPath: f.ledgerPath }), { styles: styleCounts({}), entries: [] });
  assert.ok(!fs.existsSync(f.ledgerPath));
  const ledger = { a: entry("engraving", "a key"), "demo-book": entry("painted-still-life", "mine"), b: entry("engraving", "a bell") };
  const g = setup({ ledger });
  const s = coverStatus(g.ctx, { ledgerPath: g.ledgerPath });
  assert.equal(s.styles[0]!.style, "painted-still-life");
  assert.deepEqual(s.styles.at(-1), { style: "engraving", description: desc("engraving"), count: 2 });
  assert.deepEqual(s.entries, [{ bookId: "a", style: "engraving", concept: "a key" }, { bookId: "demo-book", style: "painted-still-life", concept: "mine" }, { bookId: "b", style: "engraving", concept: "a bell" }]);
  assert.equal(fs.readFileSync(g.ledgerPath, "utf8"), JSON.stringify(ledger, null, 2) + "\n");
});

// ---------------------------------------------------------------- the image

test("installCover: a 1024x1536 picture becomes the 600x900 WebP and AVIF pair, in the run dir and the cover folder, the source kept", async () => {
  const f = setup();
  const src = await picture(path.join(f.dir, "from-model.png"), 1024, 1536);
  const r = await installCover(f.ctx, { image: src, coversDir: f.coversDir, now: NOW });
  const dir = path.join(f.ctx.config.runDir, "cover");
  assert.equal(r.webp, path.join(dir, "demo-book.webp"));
  assert.equal(r.avif, path.join(dir, "demo-book.avif"));
  assert.equal(r.coversWebp, path.join(f.coversDir, "demo-book.webp"));
  assert.equal(r.coversAvif, path.join(f.coversDir, "demo-book.avif"));
  assert.equal(r.source, path.join(dir, "source.png"));
  assert.deepEqual([r.sourceWidth, r.sourceHeight], [1024, 1536]);
  assert.ok(fs.readFileSync(r.source).equals(fs.readFileSync(src)));
  assert.ok(r.webpBytes > 2000 && r.avifBytes > 1000, `${r.webpBytes} ${r.avifBytes}`);
  for (const [file, format, bytes] of [[r.webp, "webp", r.webpBytes], [r.avif, "heif", r.avifBytes], [r.coversWebp, "webp", r.webpBytes], [r.coversAvif, "heif", r.avifBytes]] as const) {
    const meta = await sharp(fs.readFileSync(file)).metadata();
    assert.deepEqual([meta.format, meta.width, meta.height], [format, 600, 900], file);
    assert.equal(fs.statSync(file).size, bytes);
  }
  assert.ok(fs.readFileSync(r.webp).equals(fs.readFileSync(r.coversWebp)));
  assert.deepEqual(fs.readdirSync(f.coversDir).sort(), ["demo-book.avif", "demo-book.webp"], "nothing else in the cover folder");

  // Another image replaces the files, the old source included.
  const firstWebp = fs.readFileSync(r.coversWebp);
  const second = await picture(path.join(f.dir, "second.jpg"), 1000, 1500);
  const r2 = await installCover(f.ctx, { image: second, coversDir: f.coversDir, now: NOW });
  assert.equal(r2.source, path.join(dir, "source.jpg"));
  assert.ok(!fs.existsSync(path.join(dir, "source.png")));
  assert.ok(!fs.readFileSync(r2.coversWebp).equals(firstWebp));
  assert.ok(fs.readFileSync(r2.webp).equals(fs.readFileSync(r2.coversWebp)));
  assert.equal(fs.statSync(r2.coversWebp).size, r2.webpBytes);
  assert.deepEqual(fs.readdirSync(f.coversDir).sort(), ["demo-book.avif", "demo-book.webp"]);
});

test("installCover refusals: missing, unreadable, too small, not portrait 2:3, too light; nothing written by any", async () => {
  const f = setup();
  const nothing = () => {
    assert.ok(!fs.existsSync(f.coversDir), "nothing in the cover folder");
    assert.ok(!fs.existsSync(path.join(f.ctx.config.runDir, "cover")), "nothing in the run dir");
  };
  const install = (image: string) => installCover(f.ctx, { image, coversDir: f.coversDir, now: NOW });
  await assert.rejects(install(path.join(f.dir, "nope.png")), /^Error: COVER_IMAGE_MISSING: .*nope\.png does not exist/);
  const junk = path.join(f.dir, "junk.png");
  fs.writeFileSync(junk, "not an image at all");
  await assert.rejects(install(junk), /^Error: COVER_IMAGE_UNREADABLE: /);
  await assert.rejects(install(await picture(path.join(f.dir, "small.png"), 400, 600)), /^Error: COVER_TOO_SMALL: .* is 400x600; a cover needs at least 600x900/);
  await assert.rejects(install(await picture(path.join(f.dir, "tall-thin.png"), 600, 1100)), /^Error: COVER_ASPECT: .* is 600x1100 \(width\/height 0\.55\)/);
  await assert.rejects(install(await picture(path.join(f.dir, "square.png"), 1024, 1024)), /^Error: COVER_ASPECT: .* is 1024x1024 \(width\/height 1\.00\); the cover must be portrait 2:3/);
  await assert.rejects(install(await picture(path.join(f.dir, "wide.png"), 1536, 1024)), /^Error: COVER_ASPECT: .*width\/height 1\.50/);
  await assert.rejects(install(await picture(path.join(f.dir, "flat.png"), 1024, 1536, { flat: true })), /^Error: COVER_TOO_LIGHT: the encoded cover is \d+ bytes as WebP and \d+ as AVIF/);
  nothing();
  // The edges of the band pass: 0.60 and 0.74.
  for (const [w, h] of [[900, 1500], [740, 1000]]) {
    const r = await install(await picture(path.join(f.dir, `edge-${w}.png`), w, h));
    assert.deepEqual([r.sourceWidth, r.sourceHeight], [w, h]);
  }
});

test("installCover from the kept source itself: the source survives and the pair is rebuilt", async () => {
  const f = setup();
  const r = await installCover(f.ctx, { image: await picture(path.join(f.dir, "first.png"), 1024, 1536), coversDir: f.coversDir, now: NOW });
  const kept = fs.readFileSync(r.source);
  const again = await installCover(f.ctx, { image: r.source, coversDir: f.coversDir, now: NOW });
  assert.equal(again.source, r.source);
  assert.ok(fs.readFileSync(again.source).equals(kept), "the kept source is still there, unchanged");
  assert.deepEqual(fs.readdirSync(path.join(f.ctx.config.runDir, "cover")).sort(), ["demo-book.avif", "demo-book.webp", "source.png"]);
});

test("installCover crops (fit cover), not letterboxes: a 0.62 portrait image fills 600x900 to the edges", async () => {
  const f = setup();
  const r = await installCover(f.ctx, { image: await picture(path.join(f.dir, "narrow.png"), 930, 1500), coversDir: f.coversDir, now: NOW });
  const { data, info } = await sharp(fs.readFileSync(r.webp)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([info.width, info.height], [600, 900]);
  // The picture's background has a blue channel of 120 or more everywhere; contain would pad the sides with black.
  for (const x of [1, 598]) {
    const i = (450 * info.width + x) * info.channels;
    assert.ok(Math.max(data[i]!, data[i + 1]!, data[i + 2]!) > 60, `pixel at x=${x} is ${data[i]},${data[i + 1]},${data[i + 2]}`);
  }
});

test("coverBrief and coverStatus refuse a covers.json that is not JSON, with its path; the file is left alone", () => {
  for (const text of ["", "{not json"]) {
    const f = setup();
    fs.writeFileSync(f.ledgerPath, text);
    const re = new RegExp(`^Error: COVER_LEDGER_INVALID: ${f.ledgerPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} is not valid JSON \\(.+\\); fix or remove it$`);
    assert.throws(() => coverStatus(f.ctx, { ledgerPath: f.ledgerPath }), re);
    assert.throws(() => coverBrief(f.ctx, { concept: "a boat", ledgerPath: f.ledgerPath, now: NOW }), re);
    assert.equal(fs.readFileSync(f.ledgerPath, "utf8"), text);
    assert.ok(!fs.existsSync(path.join(f.ctx.config.runDir, "cover")));
  }
});

test("a template token in the concept, title or author is a COVER_ refusal, not TEMPLATE_UNFILLED", () => {
  const f = setup();
  assert.throws(() => coverBrief(f.ctx, { concept: "A sign reading @@TITLE@@ on a door", ledgerPath: f.ledgerPath, now: NOW }), /^Error: COVER_CONCEPT_INVALID: the concept contains a template token \(@@TITLE@@\)/);
  assert.ok(!fs.existsSync(f.ledgerPath));
  assert.throws(() => coverPrompt({ title: "@@AUTHOR@@ x", author: "A", concept: "c", style: "ink-wash" }), /^Error: COVER_TITLE_INVALID: the title contains a template token \(@@AUTHOR@@\)/);
  assert.throws(() => coverPrompt({ title: "T", author: "@@CONCEPT@@", concept: "c", style: "ink-wash" }), /^Error: COVER_TITLE_INVALID: the author contains a template token/);
  // A bare @@ or a lowercase one is plain text.
  assert.ok(coverPrompt({ title: "a @@ b @@x@@", author: "A", concept: "c", style: "ink-wash" }).includes(`"a @@ b @@x@@"`));
});

// ---------------------------------------------------------------- the CLI

function cliConfig(dir: string, bookId = "demo-book"): string {
  fs.writeFileSync(path.join(dir, "source.txt"), "Chapter 1 text.");
  fs.writeFileSync(path.join(dir, "map.json"), JSON.stringify({ sourceTextSha256: createHash("sha256").update("Chapter 1 text.").digest("hex"), spans: [{ chapterNumber: 1, chapterTitle: "One", startOffset: 0, endOffset: 15 }] }));
  fs.writeFileSync(path.join(dir, "brief.md"), "BRIEF\n");
  const role = { bin: FAKE, model: "claude-opus-5-5", effort: "high" };
  const file = path.join(dir, "demo.json");
  fs.writeFileSync(file, JSON.stringify({
    bookId, title: "Demo Book", author: "A. Author", bookType: "memoir", categories: ["Memoir"], tags: ["habits"],
    source: { textPath: "source.txt", chapterMapPath: "map.json" }, briefPath: "brief.md",
    shape: { examples: 2, quizQuestions: 3, choices: 3, reviewCards: 2, memorableLines: 1, ifThenPlans: 1, fastRead: [10, 100], deepRead: [10, 170], fullRead: [10, 320] },
    writer: role, checker: role, solver: role, budgetUsd: 1, runDir: "run",
  }));
  return file;
}

test("cli cover: the status, the prompt and the install forms; flag misuse exits 1; a COVER_ refusal exits 2", async () => {
  const f = setup({ ledger: { other: entry("painted-still-life", "a brass key on velvet") } });
  const config = cliConfig(f.dir);
  const runDir = path.join(f.dir, "run");
  const cli = async (...args: string[]) => {
    let out = "";
    let err = "";
    const code = await main(args, { out: (s) => (out += s), err: (s) => (err += s) }, { coversDir: f.coversDir, coverLedger: f.ledgerPath });
    return { code, out, err };
  };

  const status = await cli("cover", "--book", config);
  assert.equal(status.code, 0, status.err);
  assert.match(status.out, /^Demo Book by A\. Author \(demo-book\)\n/);
  assert.match(status.out, /styles, fewest books first[^\n]*\n {2}flat-poster +0 {2}A bold flat poster/);
  assert.match(status.out, /\n {2}painted-still-life +1 {2}A painted still life/);
  assert.match(status.out, /pictures already taken:\n {2}other \(painted-still-life\): a brass key on velvet\n/);
  assert.match(status.out, /next: cover --book .*--concept/);
  assert.ok(!fs.existsSync(path.join(runDir, "cover")));

  const brief = await cli("cover", "--style", "engraving", "--book", config, "--concept", "A paper boat on a dark sea.");
  assert.equal(brief.code, 0, brief.err);
  assert.match(brief.out, /^demo-book: style engraving\n/);
  assert.ok(brief.out.includes("generation: model gpt_image_2, aspect ratio 2:3, resolution 2k, quality high; if the connector lacks that model: nano_banana_pro, then soul_2\n"), brief.out);
  const lines = brief.out.trimEnd().split("\n");
  assert.equal(lines.at(-1), path.join(runDir, "cover", "prompt.txt"), "prompt.txt is the last line");
  assert.match(fs.readFileSync(path.join(runDir, "cover", "prompt.txt"), "utf8"), /THE PICTURE: A paper boat on a dark sea\.\n\nART DIRECTION: A vintage engraving/);
  assert.equal((JSON.parse(fs.readFileSync(f.ledgerPath, "utf8")) as CoverLedger)["demo-book"]!.style, "engraving");
  const byDefault = await cli("cover", "--book", config, "--concept", "A paper boat.");
  assert.match(byDefault.out, /^demo-book: style flat-poster \(the one the fewest other books use\)\n/);
  // `--style=<name>` works too.
  assert.match((await cli("cover", "--book", config, "--concept", "A boat.", "--style=ink-wash")).out, /^demo-book: style ink-wash\n/);

  const image = await picture(path.join(f.dir, "model.png"), 1024, 1536);
  const inst = await cli("cover", "--book", config, "--image", image);
  assert.equal(inst.code, 0, inst.err);
  assert.match(inst.out, /^demo-book: cover installed from .*model\.png \(1024x1536\)\n/);
  for (const file of [path.join(runDir, "cover", "demo-book.webp"), path.join(runDir, "cover", "demo-book.avif"), path.join(f.coversDir, "demo-book.webp"), path.join(f.coversDir, "demo-book.avif")]) {
    assert.ok(inst.out.includes(`  ${file} (${fs.statSync(file).size} bytes)\n`), file);
  }
  assert.match(inst.out, /the next publish uploads .*demo-book\.webp with the package, and the site step carries the pair into the checkout of main/);

  // COVER_ refusals: exit 2 with the message.
  for (const args of [
    ["cover", "--book", config, "--concept", "x", "--style", "neon"],
    ["cover", "--book", config, "--concept", " "],
    ["cover", "--book", config, "--image", path.join(f.dir, "none.png")],
  ]) {
    const r = await cli(...args);
    assert.equal(r.code, 2, `${JSON.stringify(args)}: ${r.err}`);
    assert.match(r.err, /^error: COVER_/);
  }

  // A ledger that is not JSON and a concept with a template token are COVER_ refusals too.
  const bad = setup();
  fs.writeFileSync(bad.ledgerPath, "");
  for (const args of [["cover", "--book", config], ["cover", "--book", config, "--concept", "a boat"]]) {
    let err = "";
    const code = await main(args, { out: () => {}, err: (s) => (err += s) }, { coversDir: bad.coversDir, coverLedger: bad.ledgerPath });
    assert.equal(code, 2, err);
    assert.ok(err.startsWith(`error: COVER_LEDGER_INVALID: ${bad.ledgerPath} is not valid JSON`), err);
  }
  const token = await cli("cover", "--book", config, "--concept", "A sign reading @@TITLE@@ on a door");
  assert.equal(token.code, 2, token.err);
  assert.match(token.err, /^error: COVER_CONCEPT_INVALID: the concept contains a template token/);

  // Misuse: usage errors, exit 1.
  for (const [args, msg] of [
    [["status", "--book", config, "--concept", "x"], /--concept only goes with the cover command/],
    [["site", "--book", config, "--repo", f.dir, "--image", image], /--image only goes with the cover command/],
    [["status", "--book", config, "--style"], /--style only goes with the fix command \(as a switch\) and the cover command/],
    [["cover", "--book", config, "--concept", "x", "--image", image], /cover takes --concept .* or --image .*, not both/],
    [["cover", "--book", config, "--style", "ink-wash"], /--style <name> goes with --concept/],
    [["cover", "--book", config, "--image", image, "--style", "ink-wash"], /--style <name> goes with --concept/],
    [["cover", "--book", config, "--concept", "x", "--style"], /argument missing|requires|--cover-style/],
    [["status", "--book", config, "--cover-style", "ink-wash"], /--style <name> only goes with the cover command/],
  ] as Array<[string[], RegExp]>) {
    const r = await cli(...args);
    assert.equal(r.code, 1, `${JSON.stringify(args)}: ${r.err}`);
    assert.match(r.err, msg);
    assert.match(r.err, /Usage:/);
  }

  // The tool's own covers.json was never touched by these tests.
  assert.equal(fs.existsSync(COVER_LEDGER), LEDGER_EXISTED);
});
