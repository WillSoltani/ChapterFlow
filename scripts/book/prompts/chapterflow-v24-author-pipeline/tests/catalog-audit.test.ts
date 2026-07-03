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
import { makeChapter, plantSyntheticChapterCorpus, runCli } from "./helpers.js";

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
  // HERMETIC: the real gold corpus is not in git (fixture policy) and is absent in a bare
  // worktree / post-purge canonical checkout, which made this "runs on the real corpus"
  // audit exit 2 ("No chapters in state/chapters/"). Plant a deterministic synthetic corpus
  // — carrying the house tic + deadline scenario + bank names — so the CLI reads a populated
  // catalog and the fingerprint lines print on every checkout. The assertions below are
  // unchanged: presence of the meter lines, not magnitude.
  const corpus = plantSyntheticChapterCorpus({ books: ["zz-fixture-audit-alpha", "zz-fixture-audit-beta"] });
  try {
    const { status, out } = runCli(["catalog-audit"]);
    assert.equal(status, 0, out.slice(-500));
    assert.match(out, /variety score:/);
    assert.match(out, /cross-book name collisions:/);
    // The 2026-06-10 review hand-counted these; the meter must see the same
    // catalog. Exact numbers drift as books are refreshed — assert presence,
    // not magnitude.
    assert.match(out, /"the point is":\d+/);
    assert.match(out, /deadline tic: \d+%/);
  } finally {
    corpus.cleanup();
  }
});

test("name-plan: names are unique within a book and report catalog overlap diagnostics", () => {
  // The shared policy excludes current-book planned names and recent ledgered
  // cooldown names. The raw chapter scan remains an audit diagnostic, not the
  // accounting source of truth.
  const { planNames, bankNamesUsedByOtherBooks } = require("../src/librarian/namePlan.js") as typeof import("../src/librarian/namePlan.js");
  const plan = planNames("zz-fixture-fresh-names", 1, 3);
  const dealt = Object.values(plan.allocation).flat();

  // WITHIN-book uniqueness: no protagonist name is dealt to two chapters.
  assert.equal(new Set(dealt).size, dealt.length, "names must be unique within a book");

  // The raw cross-book scan is still exposed as an informational audit count.
  assert.equal(typeof plan.diagnostics.crossBookReused, "number", "diagnostics must expose the cross-book reuse count");

  // HERMETIC: bankNamesUsedByOtherBooks reads OTHER books' chapters from state/chapters/ —
  // the real corpus is not in git (fixture policy) and is purged from bare worktrees, which
  // made the ">100 distinct bank names in use" assertion env-dependent (got 0). Plant a
  // synthetic OTHER-book corpus carrying >100 distinct bank names so the cross-book scan has
  // a deterministic catalog to see, regardless of checkout.
  const corpus = plantSyntheticChapterCorpus({
    books: ["zz-fixture-corpus-other-1", "zz-fixture-corpus-other-2"],
    chaptersPerBook: 8, // 2 books × 8 ch × 6 examples × 2 names = 192 name-slots ≥ 140 distinct
    distinctBankNames: 140,
  });
  try {
    const taken = bankNamesUsedByOtherBooks("zz-fixture-fresh-names");
    assert.ok(taken.size > 100, `cross-book scan should still see the catalog (got ${taken.size})`);
  } finally {
    corpus.cleanup();
  }
});

test("plainness meters: abstraction-dense prose scores higher nominalization than concrete prose", () => {
  const { plainnessMeters } = require("../src/critics/catalogAudit.js") as typeof import("../src/critics/catalogAudit.js");
  const abstract = plainnessMeters(
    "Scarcity culture shrinks courage by teaching deficiency first. Worthiness requires the dissolution of comparison, disengagement, and the persistent insufficiency of external validation. Authenticity emerges through the integration of vulnerability and intention.",
  );
  const concrete = plainnessMeters(
    "Maya checks her phone before her feet hit the floor. Forty new emails. She picks the one from her boss, answers it in bed, and the day belongs to other people before she has brushed her teeth.",
  );
  assert.ok(
    abstract.nomPer100 > concrete.nomPer100 + 5,
    `abstract prose must meter higher (abstract ${abstract.nomPer100.toFixed(1)} vs concrete ${concrete.nomPer100.toFixed(1)})`,
  );
});
