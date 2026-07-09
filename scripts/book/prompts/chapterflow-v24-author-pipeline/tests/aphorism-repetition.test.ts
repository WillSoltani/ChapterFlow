/**
 * BP34 within-book aphorism repetition + cross-book aphorism-shape extension +
 * banned-phrases consumer path. CF-F / Finding 11: the minted one-liner
 * "Agreement nods; commitment signs" shipped as a lede/coreSkill line across four
 * high-output-management chapters and two execution chapters, invisible to every
 * existing guard.
 */

import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, readdirSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { resolve } from "path";

import { checkBookAphorismRepetition } from "../src/critics/bookRepetition.js";
import {
  isAphorismShaped,
  runCrossBookSignatureAudit,
  findCrossBookTells,
} from "../src/critics/crossBookSignatureAudit.js";
import { checkBannedPhrases } from "../src/critics/register.js";
import { loadBannedPhrases } from "../src/critics/shared.js";
import type { ChapterV21 } from "../src/types.js";
import { test, skip } from "./harness.js";
import { makeChapter, STATE_CHAPTERS } from "./helpers.js";

const APHORISM = "Agreement nods; commitment signs.";
const APHORISM_COMMA = "Agreement nods, commitment signs.";

// ── Within-book detector (BP34) ──────────────────────────────────────────────

test("BP34 fires when the same aphorism recurs in ≥3 chapters (semicolon + comma variants unified)", () => {
  const book = "zz-fixture-bp34";
  const chapters = [1, 2, 3].map((n) => makeChapter(book, n));
  chapters.forEach((c) => { c.memorableLines = []; }); // drop the fixture's constant memorable line
  // Same line, three punctuation/case renderings — must collapse to one finding.
  chapters[0].counterintuition = `${APHORISM} The rest of the counter is chapter-specific here.`;
  chapters[1].counterintuition = `${APHORISM_COMMA} The rest of the counter is chapter-specific here too.`;
  chapters[2].counterintuition = `agreement nods; commitment signs. And a different tail entirely.`;

  const findings = checkBookAphorismRepetition(chapters);
  const bp34 = findings.filter((f) => f.checkId === "BP34.aphorism_repetition");
  assert.equal(bp34.length, 1, `expected exactly one BP34 finding, got ${JSON.stringify(bp34)}`);
  assert.equal(bp34[0].severity, "minor");
  assert.deepEqual(bp34[0].chapters, [1, 2, 3]);
  assert.match(bp34[0].message, /agreement nods/i);
});

test("BP34 stays silent at 2 chapters — a deliberate callback is legal", () => {
  const book = "zz-fixture-bp34-pair";
  const chapters = [1, 2, 3].map((n) => makeChapter(book, n));
  chapters.forEach((c) => { c.memorableLines = []; });
  chapters[0].counterintuition = `${APHORISM} A chapter-specific continuation.`;
  chapters[1].counterintuition = `${APHORISM_COMMA} Another chapter-specific continuation.`;
  // chapter 3 does NOT carry the line.
  const findings = checkBookAphorismRepetition(chapters);
  assert.equal(findings.filter((f) => f.checkId === "BP34.aphorism_repetition").length, 0);
});

test("BP34 does not fire on different aphorism-shaped sentences that merely share words", () => {
  const book = "zz-fixture-bp34-sharewords";
  const chapters = [1, 2, 3].map((n) => makeChapter(book, n));
  chapters.forEach((c) => { c.memorableLines = []; });
  // All three are aphorism-SHAPED (so the shape gate admits them) but each
  // normalizes to a distinct key — no verbatim recurrence, so no finding.
  chapters[0].counterintuition = "Commitment signs; agreement only nods.";
  chapters[1].counterintuition = "Agreement drifts; commitment holds.";
  chapters[2].counterintuition = "Signs commit; nods agree.";
  const findings = checkBookAphorismRepetition(chapters);
  assert.equal(findings.filter((f) => f.checkId === "BP34.aphorism_repetition").length, 0);
});

test("BP34 catches an aphorism buried mid-breakdown (the real HOM shape), but NOT a plain repeated hinge", () => {
  // The HOM leak sat at sentence index 4–20 of the breakdown tiers, never the
  // lede. An aphorism-shaped line there must fire; a plain structural hinge
  // reused across chapters (the start-with-why "There is a limit." pattern) must
  // NOT — that is the SC9 false-positive class.
  const book = "zz-fixture-bp34-breakdown";
  const chapters = [1, 2, 3].map((n) => makeChapter(book, n));
  chapters.forEach((c) => { c.memorableLines = []; });
  const lede = "The mechanism is specific to this chapter and varies each time.";
  for (const ch of chapters) {
    ch.breakdown.fastRead = `${lede} A second sentence. ${APHORISM} A closing sentence unique here.`;
  }
  const aphorismFindings = checkBookAphorismRepetition(chapters).filter(
    (f) => f.checkId === "BP34.aphorism_repetition",
  );
  assert.equal(aphorismFindings.length, 1, "aphorism-shaped mid-breakdown line must fire");
  assert.deepEqual(aphorismFindings[0].chapters, [1, 2, 3]);

  // Now a plain (non-aphorism) hinge repeated in breakdown body → silent.
  const book2 = "zz-fixture-bp34-hinge";
  const hingeChapters = [1, 2, 3].map((n) => makeChapter(book2, n));
  hingeChapters.forEach((c) => { c.memorableLines = []; });
  for (const ch of hingeChapters) {
    ch.breakdown.fastRead = `Chapter-specific opening ${ch.number}. There is a limit. A unique close ${ch.number}.`;
    ch.counterintuition = `A distinct counter for chapter ${ch.number} with no shared line.`;
  }
  const hingeFindings = checkBookAphorismRepetition(hingeChapters).filter(
    (f) => f.checkId === "BP34.aphorism_repetition",
  );
  assert.equal(hingeFindings.length, 0, "a plain repeated hinge in breakdown body must NOT fire (SC9 guard)");
});

// ── Cross-book aphorism-shape extension ──────────────────────────────────────

test("isAphorismShaped admits the antithesis couplet, rejects an ordinary short sentence", () => {
  assert.equal(isAphorismShaped("Agreement nods; commitment signs."), true);
  assert.equal(isAphorismShaped("Agreement nods, commitment signs."), true);
  assert.equal(isAphorismShaped("The team missed the deadline again."), false);
  assert.equal(isAphorismShaped("She wrote the date, checked it, and moved on."), false); // 3 comma parts
});

test("cross-book audit catches a distilled 'agreement nods' across two books; ordinary 4-word sentences stay out", () => {
  const dir = mkdtempSync(resolve(tmpdir(), "cf-crossbook-"));
  try {
    const mkPkg = (bookId: string, coreLines: string[]) => ({
      book: { bookId },
      chapters: coreLines.map((line, i) => ({
        number: i + 1,
        breakdown: { fastRead: `${line} The rest of this tier is unique to book ${bookId} chapter ${i + 1}.`, deepRead: "", fullRead: "" },
        counterintuition: "",
        keyTakeaway: "",
        tryThisNow: "",
        implementationPlan: { coreSkill: i === 0 ? line : "" },
        memorableLines: [],
      })),
    });
    // Two books, each carrying the 4-word aphorism in fields the old audit
    // never scanned (coreSkill) plus an ORDINARY 4-word sentence that must NOT
    // enter the watchlist.
    writeFileSync(resolve(dir, "alpha.v21.json"), JSON.stringify(mkPkg("alpha", [
      "Agreement nods; commitment signs.", "The team shipped it late.", "Agreement nods, commitment signs.",
    ])));
    writeFileSync(resolve(dir, "beta.v21.json"), JSON.stringify(mkPkg("beta", [
      "Agreement nods; commitment signs.", "The team shipped it late.",
    ])));

    const tells = findCrossBookTells(runCrossBookSignatureAudit(dir));
    const aphorism = tells.find((t) => t.phrase === "agreement nods commitment signs");
    assert.ok(aphorism, `aphorism tell should surface; tells=${JSON.stringify(tells.map((t) => t.phrase))}`);
    assert.ok(aphorism!.bookCount >= 2, "aphorism must span both books");

    // The ordinary 4-word sentence "The team shipped it late" is below the 6-word
    // floor and NOT aphorism-shaped → it must never enter the watchlist.
    assert.ok(
      !tells.some((t) => t.phrase === "the team shipped it late"),
      "ordinary 4-word sentence must not be admitted by the aphorism-shape floor",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── banned-phrases consumer path ─────────────────────────────────────────────

test("banned-phrases config carries both 'agreement nods' variants and the register critic flags them", () => {
  const cfg = loadBannedPhrases();
  const hard = (cfg.hardBanned ?? []).map((e: { phrase: string }) => e.phrase.toLowerCase());
  assert.ok(hard.includes("agreement nods; commitment signs"), "semicolon variant must be hard-banned");
  assert.ok(hard.includes("agreement nods, commitment signs"), "comma variant must be hard-banned");

  // Consumer: register.checkBannedPhrases (runs at gate over reader-facing text
  // AND the list is pasted into the writer system prompt for future generation).
  for (const text of [
    "The useful contrast is simple: Agreement nods; commitment signs.",
    "Agreement nods, commitment signs.",
  ]) {
    const { findings } = checkBannedPhrases(text);
    assert.ok(
      findings.some((f) => f.checkId === "register.no_banned_phrase" && /agreement nods/i.test(f.message)),
      `checkBannedPhrases must flag: ${text}`,
    );
  }
});

// ── Gold-corpus pin ──────────────────────────────────────────────────────────

test("BP34 gold-corpus pin: zero findings on the on-disk reference corpus", () => {
  let files: string[];
  try {
    files = readdirSync(STATE_CHAPTERS).filter((f) => f.endsWith(".chapter.json"));
  } catch {
    skip("BP34 gold-corpus pin", "state/chapters absent on this machine");
    return;
  }
  const byBook = new Map<string, ChapterV21[]>();
  for (const f of files) {
    let ch: ChapterV21;
    try {
      ch = JSON.parse(readFileSync(resolve(STATE_CHAPTERS, f), "utf8")) as ChapterV21;
    } catch {
      continue;
    }
    const bid = (ch.chapterId ?? "").replace(/-ch\d+.*$/, "");
    if (!bid) continue;
    if (!byBook.has(bid)) byBook.set(bid, []);
    byBook.get(bid)!.push(ch);
  }
  if (byBook.size === 0) {
    skip("BP34 gold-corpus pin", "no readable chapters in state/chapters on this machine");
    return;
  }
  const offenders: string[] = [];
  for (const [bid, chs] of byBook) {
    const findings = checkBookAphorismRepetition(chs);
    for (const f of findings) offenders.push(`${bid} ${f.chapters.join(",")}`);
  }
  // Pinned to 0: the reference corpus's repeated breakdown hinges ("There is a
  // limit.") are plain, not aphorism-shaped, so the shape filter excludes them.
  assert.deepEqual(offenders, [], `BP34 must stay clean on the on-disk reference corpus:\n${offenders.join("\n")}`);
});
