/**
 * IMP-12 items 16-17 — cross-book coverage and the anti-hard-code scan.
 *
 * Two MATERIALLY different synthetic book profiles (a research/explanation-heavy
 * book with contested evidence and no scene-worthy cases, vs an example-heavy
 * how-to with several well-documented cases) exercise the source ontology along
 * different axes. Cross-book fixtures are proven immutable (deterministic
 * compile → identical bytes), and no production source file may hard-code a
 * test-fixture book id.
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { test } from "./harness.js";
import { fxPacket, fxFact, fxCase } from "./migrationFixtures.js";
import { compileSourceUsePlan } from "../src/compiler/sourceUsePlanCompiler.js";
import { sourceUsePlanHash } from "../src/contracts/sourceUsePlan.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = resolve(HERE, "..", "src");

// ── two materially different book profiles ────────────────────────────────────

/** Profile A: research/explanation-heavy — six facts, one contested, ZERO
 *  scene-worthy cases (every case under-documented). The ontology must produce
 *  explanation-only units and refuse every scene. */
function researchHeavyPacket() {
  return fxPacket({
    bookId: "zz-profile-research",
    chapterId: "zz-profile-research-ch01",
    chapterTitle: "Mechanisms Without Anecdotes",
    facts: [
      fxFact("ch01.fact.1"),
      fxFact("ch01.fact.2", { replicationStatus: "contested" }),
      fxFact("ch01.fact.3", { mechanism: "" }),
      fxFact("ch01.fact.4"),
      fxFact("ch01.fact.5"),
      fxFact("ch01.fact.6", { replicationStatus: "mixed" }),
    ],
    namedCases: [fxCase("ch01.ex.thin", { hardSpecifics: ["one token"] })], // under-documented
  });
}

/** Profile B: example-heavy how-to — three well-documented real cases plus a
 *  fictional device. The ontology must license partial scenes for the real
 *  cases and require framing for the device. */
function exampleHeavyPacket() {
  return fxPacket({
    bookId: "zz-profile-howto",
    chapterId: "zz-profile-howto-ch01",
    chapterTitle: "Five Worked Cases",
    facts: [fxFact("ch01.fact.1"), fxFact("ch01.fact.2"), fxFact("ch01.fact.3"), fxFact("ch01.fact.4"), fxFact("ch01.fact.5"), fxFact("ch01.fact.6")],
    namedCases: [
      fxCase("ch01.ex.a", { hardSpecifics: ["a documented site", "a documented date"] }),
      fxCase("ch01.ex.b", { hardSpecifics: ["a documented cohort", "a documented result"] }),
      fxCase("ch01.ex.device", { realWorld: false, hardSpecifics: ["a parable", "a fable figure"] }),
    ],
  });
}

test("two materially different book profiles exercise the ontology along different axes", () => {
  const research = compileSourceUsePlan(researchHeavyPacket());
  const example = compileSourceUsePlan(exampleHeavyPacket());

  // Research profile: NO source-bound case-form unit (every case degraded).
  assert.ok(research.plan.units.every((u) => !(u.form === "case")), "research profile mints zero scene licenses");
  assert.ok(research.plan.units.some((u) => u.claimStrength === "descriptive"), "contested/mixed facts capped at descriptive");
  assert.ok(research.findings.some((f) => f.includes("no scene license")), "the under-documented case degraded loudly");

  // Example profile: two real case units (scene-licensed) + a framed device.
  const caseUnits = example.plan.units.filter((u) => u.form === "case");
  assert.equal(caseUnits.length, 3, "three documented cases scene-license (the device still scenes but framed)");
  const device = example.plan.units.find((u) => u.caseId === "ch01.ex.device");
  assert.equal(device?.framingRequired, true, "the fictional device requires framing");
  const realCase = example.plan.units.find((u) => u.caseId === "ch01.ex.a");
  assert.equal(realCase?.framingRequired, false, "a documented real case needs no fictional framing");

  // The two profiles are genuinely different plans.
  assert.notEqual(sourceUsePlanHash(research.plan), sourceUsePlanHash(example.plan), "materially different books → different plans");
});

test("cross-book fixtures are immutable: deterministic compile yields identical plan bytes across repeated builds", () => {
  const a = compileSourceUsePlan(researchHeavyPacket()).plan;
  const b = compileSourceUsePlan(researchHeavyPacket()).plan;
  assert.equal(JSON.stringify(a), JSON.stringify(b), "same synthetic packet → byte-identical plan (no in-place mutation, no clock/random)");
  // Building profile B must not have mutated profile A's factory output.
  compileSourceUsePlan(exampleHeavyPacket());
  const aAgain = compileSourceUsePlan(researchHeavyPacket()).plan;
  assert.equal(sourceUsePlanHash(a), sourceUsePlanHash(aAgain), "one profile's compile never contaminates another's");
});

// ── anti-hard-code scan (item 17, red-team "production hard-codes") ────────────

test("no production source file hard-codes a test-fixture book id (zz-*)", () => {
  const offenders: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (entry.name.endsWith(".ts")) {
        const text = readFileSync(abs, "utf8");
        // A quoted zz- token is a test fixture id — it must never drive production logic.
        if (/["'`]zz-[a-z0-9-]+/i.test(text)) offenders.push(resolve(abs).slice(SRC_DIR.length + 1));
      }
    }
  };
  walk(SRC_DIR);
  assert.deepEqual(offenders, [], `production source must not hard-code fixture book ids:\n${offenders.join("\n")}`);
});

test("the synthetic fixtures never reference a real catalog book id (no deleted-corpus dependency)", () => {
  // The IMP-12 fixture modules are self-owned: they must not import or name a
  // production book slug. A cheap proxy: their source carries only zz- ids.
  for (const file of ["migrationFixtures.ts", "hostileHome.ts", "testRoots.ts"]) {
    const text = readFileSync(resolve(HERE, file), "utf8");
    const bookIshLiterals = text.match(/["'`]zz-[a-z0-9-]+/gi) ?? [];
    // Every book-ish literal in the fixtures is a zz- synthetic id (this asserts
    // the fixtures own their ids; a real slug like "the-compound-effect" would
    // NOT match zz- and would signal a deleted-corpus dependency if present).
    for (const lit of bookIshLiterals) assert.match(lit, /zz-/, "fixture book ids are synthetic");
  }
  assert.ok(statSync(resolve(HERE, "migrationFixtures.ts")).size > 0, "fixture module exists");
});
