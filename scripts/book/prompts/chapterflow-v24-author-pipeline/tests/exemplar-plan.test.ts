/**
 * Exemplar plan — repeated marquee figures/cases get exactly one chapter owner.
 * Fixtures are written into the real .chapterflow/runs layout so the test uses
 * findRunArtifact through the production sidecar locator.
 */

import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

import { formatExemplarPlan, formatExemplarForbidden, planExemplars, writeExemplarPlan } from "../src/librarian/exemplarPlan.js";
import { checkPlanEnforcement } from "../src/qc/planEnforcement.js";
import { test } from "./harness.js";
import { makeChapter, PIPELINE_DIR, runCli, writeResearchRunManifestFixture } from "./helpers.js";

const BOOK = "zz-fixture-exemplars";
const REPO_ROOT = PIPELINE_DIR;
const RUN_BOOK_DIR = resolve(REPO_ROOT, ".chapterflow", "runs", BOOK);
const RUN_DIR = resolve(RUN_BOOK_DIR, "99999999-test");
const PLAN_PATH = resolve(PIPELINE_DIR, "state", "exemplar-plans", `${BOOK}.exemplar-plan.json`);

function writeSidecar(chapter: number, data: Record<string, unknown>): void {
  const dir = resolve(RUN_DIR, "sidecars", "source");
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, `ch${String(chapter).padStart(2, "0")}.source.json`), JSON.stringify(data, null, 2), "utf8");
}

function resetFixture(): void {
  rmSync(RUN_BOOK_DIR, { recursive: true, force: true });
  rmSync(PLAN_PATH, { force: true });
}

function writeFixtureSidecars(): void {
  resetFixture();
  writeResearchRunManifestFixture({
    runDir: RUN_DIR,
    bookId: BOOK,
    chapters: [
      { number: 1, title: "Exemplar One" },
      { number: 2, title: "Exemplar Two" },
      { number: 3, title: "Exemplar Three" },
    ],
  });
  writeSidecar(1, {
    namedExamples: [
      {
        label: "Dorothy Day at the Catholic Worker",
        summary: "Dorothy Day turned public conviction into an ordinary discipline.",
        teachesWhat: "commitment",
      },
      {
        label: "Tiger Woods training round",
        summary: "Tiger Woods kept the swing quiet under pressure.",
        teachesWhat: "practice",
        hardSpecifics: ["Tiger Woods", "2008 U.S. Open"],
      },
    ],
  });
  writeSidecar(2, {
    namedExamples: [
      "Tiger Woods at Torrey Pines in 2008",
      {
        label: "Anne Frank diary pages",
        summary: "Anne Frank made inner steadiness visible inside a narrow hiding place.",
        teachesWhat: "attention",
      },
    ],
  });
  writeSidecar(3, {
    namedExamples: [
      {
        label: "Fred Rogers testimony",
        summary: "Fred Rogers treated television as a room where children deserved care.",
        teachesWhat: "presence",
      },
      {
        label: "Anne Frank in the annex",
        summary: "Anne Frank shows why a repeated exemplar needs one owner.",
        teachesWhat: "focus",
      },
    ],
    properNouns: ["Kennedy", "John F. Kennedy"],
  });
}

test("exemplar-plan deals contested exemplars to exactly one owner with symmetric forbiddens", () => {
  try {
    writeFixtureSidecars();
    const plan = planExemplars(BOOK, 1, 3);
    assert.equal(plan.diagnostics.contested, 2);
    assert.deepEqual(plan.diagnostics.chaptersWithoutSidecar, []);

    const ownerChapters = Object.entries(plan.allocation)
      .filter(([, entry]) => entry.assigned.includes("Tiger Woods"))
      .map(([chapter]) => Number(chapter));
    assert.deepEqual(ownerChapters, [2], "Tiger Woods appears earlier in ch2's sidecar and must be owned there only");
    assert.deepEqual(plan.allocation[1].forbidden.filter((item) => item.name === "Tiger Woods"), [{ name: "Tiger Woods", ownerChapter: 2 }]);
    assert.deepEqual(plan.allocation[2].forbidden.filter((item) => item.name === "Tiger Woods"), []);

    assert.ok(plan.allocation[2].assigned.includes("Anne Frank"), "tie on namedExamples order goes to the lower chapter");
    assert.deepEqual(plan.allocation[3].forbidden.filter((item) => item.name === "Anne Frank"), [{ name: "Anne Frank", ownerChapter: 2 }]);
    assert.ok(plan.allocation[3].assigned.includes("Kennedy"), "single-token properNouns entries are allowed when the sidecar explicitly supplies them");
  } finally {
    resetFixture();
  }
});

test("exemplar-plan is deterministic across runs", () => {
  try {
    writeFixtureSidecars();
    const a = planExemplars(BOOK, 1, 3);
    const b = planExemplars(BOOK, 1, 3);
    assert.deepEqual(a.allocation, b.allocation);
    assert.equal(formatExemplarPlan(a), formatExemplarPlan({ ...b, createdAt: a.createdAt }));
  } finally {
    resetFixture();
  }
});

test("exemplar-plan warns but still plans chapters with missing sidecars", () => {
  try {
    writeFixtureSidecars();
    rmSync(resolve(RUN_DIR, "sidecars", "source", "ch03.source.json"), { force: true });
    const warnings: string[] = [];
    const oldWarn = console.warn;
    console.warn = (message?: unknown) => { warnings.push(String(message)); };
    try {
      const plan = planExemplars(BOOK, 1, 3);
      assert.deepEqual(plan.diagnostics.chaptersWithoutSidecar, [3]);
      assert.deepEqual(plan.allocation[3], { assigned: [], forbidden: [] });
    } finally {
      console.warn = oldWarn;
    }
    assert.ok(warnings.some((line) => line.includes("ch03")), `expected ch03 warning, got ${warnings.join("\n")}`);
  } finally {
    resetFixture();
  }
});

test("exemplar-plan CLI writes the plan and prints ownership", () => {
  try {
    writeFixtureSidecars();
    const { status, out } = runCli(["exemplar-plan", BOOK, "--from", "1", "--to", "3"]);
    assert.equal(status, 0, out.slice(-400));
    assert.match(out, /Exemplar plan/);
    assert.match(out, /Tiger Woods/);
    assert.match(out, /Written:/);
  } finally {
    resetFixture();
  }
});

test("WS-2 deal↔gate contract: the OWNERSHIP the plan deals is exactly what the SP5 gate enforces (whole-book vs partial)", () => {
  try {
    writeFixtureSidecars(); // Tiger Woods is shared by ch1 + ch2; owner resolves to ch2.
    // The DEAL: derive ownership over the WHOLE book (what fanout now persists for
    // every range) and write the artifact the gate reads.
    writeExemplarPlan(planExemplars(BOOK, 1, 3));
    // The GATE's view: a chapter-1 draft that stages Tiger Woods (owned by ch2) must
    // be flagged SP5 — proving the card a writer is dealt and the gate that judges it
    // agree on ownership.
    const ch1 = makeChapter(BOOK, 1);
    ch1.examples.forEach((ex: any, i) => { ex.planSpec.format = `shape_${i}`; ex.planSpec.exemplar = ""; });
    (ch1.examples[0] as any).planSpec.exemplar = "Tiger Woods";
    const flagged = checkPlanEnforcement(BOOK, [ch1]).filter((f) => f.checkId === "SP5.exemplar_ownership_violation");
    assert.equal(flagged.length, 1, `whole-book plan must let the gate catch ch1 using ch2's owned exemplar: ${JSON.stringify(checkPlanEnforcement(BOOK, [ch1]))}`);
    // The CARD a writer is dealt renders the SAME ownership the gate enforces (one
    // renderer, no producer↔validator drift): the fanout MARQUEE EXEMPLARS forbidden
    // line names the exact exemplar+owner SP5 flagged.
    const cardForbidden = formatExemplarForbidden(planExemplars(BOOK, 1, 3).allocation[1]);
    assert.match(cardForbidden, /Tiger Woods \(ch2\)/, "the card's FORBIDDEN line must name the exemplar+owner the SP5 gate flags");

    // The BUG the fix prevents: a PARTIAL (single-chapter) deal computes forbidden=∅
    // because it never sees ch2's claim — so the persisted plan and the gate silently
    // DISAGREE and the violation only surfaces at publish. This is what fanout used to
    // write when an operator pulled cards per chapter.
    writeExemplarPlan(planExemplars(BOOK, 1, 1));
    const missed = checkPlanEnforcement(BOOK, [ch1]).filter((f) => f.checkId === "SP5.exemplar_ownership_violation");
    assert.equal(missed.length, 0, "a partial-range plan loses cross-chapter ownership — exactly the deal↔gate gap the whole-book fix closes");
  } finally {
    resetFixture(); // also removes the persisted exemplar-plan.json (PLAN_PATH)
  }
});

test("entity unification: superstring forms share ONE owner; single-token noise dropped", () => {
  try {
    resetFixture();
    // ch1 treats Tiger Woods most centrally (order 0); ch2's sidecar carries
    // the SUPERSTRING form "Tiger Woods Earl Woods" — pre-unification this
    // dealt two owners for one person (the stillness ch9/ch14 contradiction).
    writeSidecar(1, {
      namedExamples: [
        { label: "Tiger Woods comeback", summary: "Tiger Woods rebuilt the swing.", teachesWhat: "practice" },
      ],
    });
    writeSidecar(2, {
      namedExamples: [
        { label: "Quiet fairway drill", summary: "A practice green at dawn.", teachesWhat: "focus" },
        { label: "Tiger Woods Earl Woods lessons", summary: "Earl Woods drilled Tiger Woods on exits.", teachesWhat: "pressure" },
      ],
      properNouns: ["California"],
    });
    writeResearchRunManifestFixture({
      runDir: RUN_DIR,
      bookId: BOOK,
      chapters: [
        { number: 1, title: "Exemplar One" },
        { number: 2, title: "Exemplar Two" },
      ],
    });
    const plan = planExemplars(BOOK, 1, 2);
    const ch1 = plan.allocation[1], ch2 = plan.allocation[2];
    // every Woods-family form is owned by ch1; ch2 only forbids, never owns
    const ch2WoodsOwned = ch2.assigned.filter((a) => a.includes("Woods"));
    assert.deepEqual(ch2WoodsOwned, [], `ch2 must not own any Woods form (got ${JSON.stringify(ch2WoodsOwned)})`);
    assert.ok(ch1.assigned.some((a) => a.includes("Tiger Woods")), "ch1 owns the Tiger Woods entity");
    assert.ok(ch2.forbidden.some((f) => f.name.includes("Woods") && f.ownerChapter === 1), "ch2 forbids the Woods entity, owner ch1");
    // standalone single-token properNouns are noise, not exemplars
    const everywhere = [...ch1.assigned, ...ch2.assigned, ...ch1.forbidden.map((f) => f.name), ...ch2.forbidden.map((f) => f.name)];
    assert.ok(!everywhere.includes("California"), "single-token-only entity must be dropped");
  } finally {
    resetFixture();
  }
});

test("C7 plan-skip honors FRESH deals only — carried (already-authored) allocations never license a banned-pool name", () => {
  const { runShipGate } = require("../src/critics/finalGate.js") as typeof import("../src/critics/finalGate.js");
  const { makeChapter } = require("./helpers.js") as typeof import("./helpers.js");
  const NAME_PLAN = resolve(PIPELINE_DIR, "state", "name-plans", "zz-fixture-cseven.name-plan.json");
  try {
    // Hermetic: create the fixture's own target dir (a purged/bare checkout has no
    // state/name-plans/ yet — the test wrote its fixture assuming a prior run had
    // populated state/). mkdirSync makes the test self-provisioning.
    mkdirSync(dirname(NAME_PLAN), { recursive: true });
    writeFileSync(
      NAME_PLAN,
      JSON.stringify({
        bookId: "zz-fixture-cseven",
        allocation: { 1: ["Priya"], 2: ["Omar"] },
        diagnostics: { alreadyAuthored: [2] },
      }),
      "utf8",
    );
    // ch1: Priya was FRESH-dealt -> C7 skip applies, no blocker for Priya.
    const ch1 = makeChapter("zz-fixture-cseven", 1);
    ch1.examples[0].scenario = "Priya reviews the intake queue while the clinic empties out, and she rewrites the triage order before the next arrival reaches the desk today.";
    const r1 = runShipGate(ch1);
    const all1 = [...r1.blockers, ...r1.majors, ...r1.minors];
    assert.ok(!all1.some((f) => f.catalogId === "C7" && f.message.includes("Priya")), "fresh-dealt Priya must not trip C7");
    // ch2 is listed alreadyAuthored: its allocation is an ECHO of on-disk
    // text, not a license — C7 must still fire on Omar.
    const ch2 = makeChapter("zz-fixture-cseven", 2);
    ch2.examples[0].scenario = "Omar reviews the intake queue while the clinic empties out, and he rewrites the triage order before the next arrival reaches the desk today.";
    const r2 = runShipGate(ch2);
    const all2 = [...r2.blockers, ...r2.majors, ...r2.minors];
    assert.ok(all2.some((f) => f.catalogId === "C7" && f.message.includes("Omar")), "carried-chapter Omar must still trip C7 (echo loophole)");
  } finally {
    rmSync(NAME_PLAN, { force: true });
  }
});
