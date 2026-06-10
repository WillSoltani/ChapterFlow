/**
 * catalog-audit (campaign Phase A) — the fingerprint meter for cross-book
 * sameness. These tests plant known fingerprints in synthetic books and
 * assert the meter reads them; the real-corpus validation (does it reproduce
 * the 2026-06-10 reader-review hand counts) happens in the CLI smoke test.
 */

import assert from "node:assert/strict";

import {
  auditBook,
  auditCatalog,
  classifyHook,
  quizOpener,
  tryThisNowVerb,
} from "../src/critics/catalogAudit.js";
import { loadNameBank } from "../src/librarian/namePlan.js";
import { test } from "./harness.js";
import { makeChapter, runCli } from "./helpers.js";

test("hook classification distinguishes the shapes the palette will deal", () => {
  assert.equal(classifyHook("Why does the calendar lie to you?"), "question");
  assert.equal(classifyHook("Your inbox is a list of other people's priorities."), "direct_address");
  assert.equal(classifyHook("Forty-seven employees, 3 rules, no managers."), "numeric");
  assert.equal(classifyHook("I quit on a Tuesday."), "first_person");
  assert.equal(classifyHook("Houston hears a question about entitled kids, and the room starts talking about fear."), "declarative_image");
});

test("tryThisNow grammar + quiz opener extraction", () => {
  assert.equal(tryThisNowVerb("Write the first not-enough thought you had today, then name its source."), "Write");
  assert.equal(tryThisNowVerb("Pick one drawer and count the duplicates."), "Pick");
  assert.equal(quizOpener("A manager says Drive means incentives are obsolete. What correction fits?"), "a <role>");
  assert.equal(quizOpener("What should a keeper do first when the record drifts?"), "what should");
});

test("auditBook reads planted fingerprints (tics, deadline, distractor tell, bank names)", () => {
  const book = "zz-fixture-audit";
  const bankName = loadNameBank()[0];
  const ch1 = makeChapter(book, 1);
  const ch2 = makeChapter(book, 2);
  ch1.breakdown.fastRead += " The point is simple. The point is repeated.";
  ch1.examples[0].scenario = `${bankName} stares at the report and must decide before the meeting whether to escalate. ${bankName} chooses the harder path before the deadline arrives in the conference room today.`;
  // Plant the distractor tell: keyed answer strictly longest on every question.
  for (const q of ch2.quiz.questions) {
    q.choices = q.choices.map((c, i) => (i === q.correctIndex ? c + " — and this is by far the longest, most hedged choice." : c.slice(0, 60)));
  }
  const a = auditBook(book, [ch1, ch2]);
  assert.equal(a.ticCounts["the point is"], 2);
  assert.ok(a.deadlineTicRate > 0, "the planted must-decide scenario must register");
  assert.ok(a.bankNames.includes(bankName), `bank name ${bankName} must be detected`);
  assert.ok(a.correctLongestRate >= 0.5, `distractor tell must register (got ${a.correctLongestRate})`);
});

test("auditCatalog finds cross-book name collisions and scores monoculture lower", () => {
  const bankName = loadNameBank()[1];
  const mk = (book: string) => {
    const ch = makeChapter(book, 1);
    ch.examples[0].scenario = `${bankName} reviews the ledger twice while ${bankName} waits for the door to open and the morning shift to settle into the long room near the window.`;
    return ch;
  };
  const byBook = new Map([
    ["zz-aud-one", [mk("zz-aud-one")]],
    ["zz-aud-two", [mk("zz-aud-two")]],
    ["zz-aud-three", [mk("zz-aud-three")]],
  ]);
  const r = auditCatalog(byBook);
  const col = r.catalog.nameCollisions.find((c) => c.name === bankName);
  assert.ok(col, `collision for ${bankName} must be reported`);
  assert.equal(col!.books.length, 3);
  assert.ok(r.catalog.varietyScore < 10, "collisions + identical fixture grammar must cost variety points");
});

test("cli: catalog-audit runs on the real corpus and reports the known fingerprints", () => {
  const { status, out } = runCli(["catalog-audit"]);
  assert.equal(status, 0, out.slice(-500));
  assert.match(out, /variety score:/);
  assert.match(out, /cross-book name collisions:/);
  // The 2026-06-10 review hand-counted these; the meter must see the same
  // catalog. Exact numbers drift as books are refreshed — assert presence,
  // not magnitude.
  assert.match(out, /"the point is":\d+/);
  assert.match(out, /deadline tic: \d+%/);
});

test("name-plan excludes names other books already use (2026-06-10 policy reversal)", () => {
  // zz-fixture book against the REAL catalog: every dealt name must be fresh
  // catalog-wide (the bank comfortably covers one more book).
  const { planNames, bankNamesUsedByOtherBooks } = require("../src/librarian/namePlan.js") as typeof import("../src/librarian/namePlan.js");
  const plan = planNames("zz-fixture-fresh-names", 1, 3);
  const taken = bankNamesUsedByOtherBooks("zz-fixture-fresh-names");
  assert.ok(taken.size > 100, `cross-book scan should see the real catalog's used names (got ${taken.size})`);
  for (const [ch, names] of Object.entries(plan.allocation)) {
    for (const n of names) {
      assert.ok(!taken.has(n), `ch${ch} dealt "${n}", which another book already uses — the Asha-in-two-books tell`);
    }
  }
  assert.ok(plan.diagnostics.freshAvailable > 50, "the 777-name bank must leave real headroom after exclusion");
});
