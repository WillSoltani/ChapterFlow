/**
 * Structural-sameness enforcement flag (F-06, 2026-07-08).
 *
 * Proves the operator-opt-in enforcement path end-to-end at the bookGate level, the
 * mode resolver, and the deterministic acceptance-telemetry snapshot:
 *   - CHAPTERFLOW_STRUCTURAL_SAMENESS=advisory (default) leaves bookGate BYTE-IDENTICAL
 *     — a SEVERE-mold fixture passes the gate, ARCH0/CM0 stay `major`;
 *   - CHAPTERFLOW_STRUCTURAL_SAMENESS=enforce promotes a SEVERE aggregate to a
 *     `blocker` that FAILS the gate, and changes NOTHING else in the report;
 *   - a below-threshold (1-axis) book passes in BOTH modes;
 *   - the snapshot builder reports the deterministic saturation compactly.
 *
 * The critic-level severity matrix (advisory major / enforce blocker / non-severe
 * stays major) is pinned in architecture-monoculture.test.ts and
 * content-machinery.test.ts; the acceptance-record wiring is pinned in
 * author-carry-e1-e2.test.ts. This file owns the bookGate + resolver + snapshot layer.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import type { ChapterV21 } from "../src/types.js";
import { resolveStructuralSamenessMode } from "../src/critics/structuralSamenessMode.js";
import { structuralSamenessSnapshot } from "../src/critics/structuralSamenessSnapshot.js";
import { runBookGate } from "../src/critics/bookGate.js";

const BOOK = "zz-structural-sameness";

const T = ["harvest", "bridge", "signal", "harbor", "forge", "loom", "quarry", "meadow", "cinder", "tundra", "willow", "copper", "zephyr", "marble", "granite", "cobalt"];
const A = ["measured", "charted", "folded", "tuned", "sealed", "carved", "braided", "sifted", "anchored", "polished", "grafted", "kindled", "threaded", "quarried", "tempered", "honed"];
// 16 structurally-DISTINCT counterintuition sentences: the fixture must be clean on
// every OTHER book critic so the only thing that can fail the gate is the sameness
// aggregate under enforce. A shared counterintuition frame would trip BP3.
const CI = [
  (t: string, a: string, w: (k: number) => string, n: number) => `Rushing the ${t} feels productive, yet the ${w(9)} it buries costs more than any pause.`,
  (t: string, a: string, w: (k: number) => string, n: number) => `Crews trust a ${a} ${t}; the twist is that a slower ${w(2)} read wins.`,
  (t: string, a: string, w: (k: number) => string, n: number) => `Skipping the ${w(4)} step looks safe, but that is precisely what unravels everything.`,
  (t: string, a: string, w: (k: number) => string, n: number) => `Fast ${w(6)} calls earn applause, though the patient ${a} path outlasts them.`,
  (t: string, a: string, w: (k: number) => string, n: number) => `Defending the ${t} loudly backfires; letting the ${w(8)} evidence speak is stronger.`,
  (t: string, a: string, w: (k: number) => string, n: number) => `We assume more ${w(3)} data helps, when a single ${a} check settles it faster.`,
  (t: string, a: string, w: (k: number) => string, n: number) => `The loudest ${w(5)} opinion usually loses to the quiet ${t} record nobody reread.`,
  (t: string, a: string, w: (k: number) => string, n: number) => `Everyone guards the finished ${t}; the real risk hides in the ${w(7)} nobody revisits.`,
  (t: string, a: string, w: (k: number) => string, n: number) => `Adding a ${w(1)} rule seldom fixes drift that a ${a} habit would have caught.`,
  (t: string, a: string, w: (k: number) => string, n: number) => `Confidence in the ${t} grows just as the ${w(10)} beneath it quietly rots.`,
  (t: string, a: string, w: (k: number) => string, n: number) => `Waiting to ${a} the ${w(2)} seems costly until the alternative rework arrives.`,
  (t: string, a: string, w: (k: number) => string, n: number) => `A polished ${t} summary can hide the ${w(4)} gap a rougher note would expose.`,
  (t: string, a: string, w: (k: number) => string, n: number) => `Trusting memory over the ${w(6)} log feels efficient right up to the collapse.`,
  (t: string, a: string, w: (k: number) => string, n: number) => `The urge to move the ${t} forward is exactly when a ${a} halt pays most.`,
  (t: string, a: string, w: (k: number) => string, n: number) => `More eyes on the ${w(9)} rarely beat one owner who ${a} rereads the source.`,
  (t: string, a: string, w: (k: number) => string, n: number) => `It seems generous to share the ${t} widely before the ${w(8)} is even verified.`,
];

type SamenessFlags = { anchor?: boolean; compound?: boolean; shell?: boolean; reversal?: boolean };

/** A schema-valid chapter with DISTINCT prose per chapter (empty examples/quiz so the
 *  quiz/example book critics stay silent) that carries exactly the requested skeleton
 *  markers: anchor→ARCH4/named-anchor-lead, compound→ARCH2, shell→ARCH1/practice-shell,
 *  reversal→ARCH3/return-proof. */
function ch(n: number, o: SamenessFlags = {}): ChapterV21 {
  const t = T[n % T.length], a = A[n % A.length], w = (k: number) => T[(n + k) % T.length];
  const anchor = o.anchor ? `Apple in ${1970 + n} ${a} a ${t}. ` : `A ${t} crew ${a} the ${w(3)} early. `;
  const key = o.compound
    ? `First ${a} the ${t}, then weigh the ${w(1)}, then keep the ${w(2)} in unit ${n}.`
    : `The ${t} rewards patient ${a} care over ${w(5)} in unit ${n}.`;
  const shell = o.shell
    ? `Each Friday, revisit the ${w(4)} ledger for unit ${n} and if one item drifted, then repair one.`
    : `Before the ${t} handoff in unit ${n}, ${a} the single ${w(6)} that matters most.`;
  const line = o.reversal
    ? `The ${t} proof is the return trip for unit ${n}, arriving after the ${w(2)} comes back.`
    : `The ${t} lesson ${a} unit ${n} with quiet ${w(7)}.`;
  return {
    schemaVersion: "chapterflow-v21-authored",
    chapterId: `${BOOK}-ch${String(n).padStart(2, "0")}`,
    number: n,
    title: `The ${t} ${a} chapter ${n}`,
    readingTimeMinutes: 7,
    hook: anchor + `The ${w(11)} question opens quietly in unit ${n}.`,
    counterintuition: CI[n % CI.length](t, a, w, n),
    tryThisNow: `In unit ${n}, ${a} the ${t} before the ${w(12)} closes for good.`,
    keyTakeaway: key,
    breakdown: {
      fastRead: anchor + `The ${t} team ${a} a ${w(7)} before the ${w(8)} shifted in unit ${n}.`,
      deepRead: `A deep ${t} ${a} study of unit ${n} weaving ${w(1)} through ${w(13)} terrain and back.`,
      fullRead: `The full ${t} chronicle for unit ${n} gathers ${w(2)}, ${w(14)}, and ${w(15)} into one ${a} arc.`,
    },
    examples: [],
    reviewCards: [],
    quiz: { passingScorePercent: 70, questions: [] },
    implementationPlan: {
      title: `Catch ${t} drift early in unit ${n}`,
      coreSkill: `Noticing ${t} drift while the ${w(1)} is still one record wide, comparing the ${w(2)} entry each time in unit ${n}.`,
      ifThenPlans: [{ context: `starting a ${t} shift`, plan: `If I open the ${w(4)} log, then I ${a} the last entry against the prior day in unit ${n}.` }],
      twentyFourHourChallenge: `Within a day of unit ${n}, ${a} which ${w(6)} record you expect wrong and check it first.`,
      weeklyPractice: shell,
    },
    memorableLines: [{ text: line, location: "hook", why: `It names the ${t} motif for unit ${n}.` }],
  } as unknown as ChapterV21;
}

const GATE_OPTS = { requirePlanArtifacts: false, checkSourceAlignment: false } as const;

/** Set the enforcement env flag, run `fn`, always restore. Tests run sequentially
 *  (harness runRegistered is a for-await loop), so this cannot race another test. */
function withEnv<T>(value: string | undefined, fn: () => T): T {
  const prev = process.env.CHAPTERFLOW_STRUCTURAL_SAMENESS;
  if (value === undefined) delete process.env.CHAPTERFLOW_STRUCTURAL_SAMENESS;
  else process.env.CHAPTERFLOW_STRUCTURAL_SAMENESS = value;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.CHAPTERFLOW_STRUCTURAL_SAMENESS;
    else process.env.CHAPTERFLOW_STRUCTURAL_SAMENESS = prev;
  }
}

/** Quiet the intentional bookGate console.warn noise. */
function quiet<T>(fn: () => T): T {
  const orig = console.warn;
  console.warn = () => {};
  try {
    return fn();
  } finally {
    console.warn = orig;
  }
}

const saturatedBook = (): ChapterV21[] =>
  Array.from({ length: 14 }, (_, i) => ch(i + 1, { anchor: true, compound: true, shell: true, reversal: true }));
const oneAxisBook = (): ChapterV21[] => Array.from({ length: 14 }, (_, i) => ch(i + 1, { anchor: true }));

// ── the mode resolver ─────────────────────────────────────────────────────────

test("structural-sameness mode: resolves to advisory by default and only `enforce` opts in", () => {
  assert.equal(withEnv(undefined, resolveStructuralSamenessMode), "advisory", "unset → advisory (flag ships off)");
  assert.equal(withEnv("", resolveStructuralSamenessMode), "advisory", "empty → advisory");
  assert.equal(withEnv("ADVISORY", resolveStructuralSamenessMode), "advisory", "any non-`enforce` literal → advisory");
  assert.equal(withEnv("Enforce", resolveStructuralSamenessMode), "advisory", "case-sensitive: only exact `enforce` opts in");
  assert.equal(withEnv("enforce", resolveStructuralSamenessMode), "enforce", "exact `enforce` → enforce");
});

// ── bookGate: advisory is byte-identical, enforce adds ONLY the sameness blocker ──

test("bookGate (F-06): a SEVERE-mold book PASSES under advisory (ARCH0/CM0 major) and FAILS under enforce (ARCH0 blocker); every other finding is byte-identical", () => {
  const book = saturatedBook();

  const advisory = quiet(() => withEnv(undefined, () => runBookGate(BOOK, book, GATE_OPTS)));
  assert.equal(advisory.passed, true, "advisory: a severe-mold book still PASSES the gate (semantic panel is the true gate)");
  const advArch = advisory.findings.find((f) => f.catalogId === "ARCH0.architecture_monoculture");
  const advCm = advisory.findings.find((f) => f.catalogId === "CM0.content_machinery_monoculture");
  assert.equal(advArch?.severity, "major", "advisory ARCH0 is a surfaced advisory (major)");
  assert.equal(advCm?.severity, "major", "advisory CM0 is a surfaced advisory (major)");
  assert.equal(advisory.findings.filter((f) => /^ARCH|^CM/.test(f.catalogId) && f.severity === "blocker").length, 0, "no sameness finding blocks under advisory");

  const enforce = quiet(() => withEnv("enforce", () => runBookGate(BOOK, book, GATE_OPTS)));
  assert.equal(enforce.passed, false, "enforce: the severe mold now FAILS the gate");
  assert.equal(
    enforce.findings.find((f) => f.catalogId === "ARCH0.architecture_monoculture")?.severity,
    "blocker",
    "enforce promotes the SEVERE ARCH0 aggregate to a blocker",
  );

  // Nothing else moved: every NON-sameness finding is identical (id+severity+message)
  // between the two runs — the flag changes only the ARCH0/CM0 aggregate severities.
  const nonSameness = (r: typeof advisory) =>
    r.findings.filter((f) => !/^ARCH|^CM/.test(f.catalogId)).map((f) => `${f.catalogId}|${f.severity}|${f.message}`).sort();
  assert.deepEqual(nonSameness(enforce), nonSameness(advisory), "enforce leaves every non-sameness finding byte-identical");
});

test("bookGate (F-06): a below-threshold (1-axis) book passes in BOTH modes — enforcement never touches the warn tier", () => {
  const book = oneAxisBook();
  const advisory = quiet(() => withEnv(undefined, () => runBookGate(BOOK, book, GATE_OPTS)));
  const enforce = quiet(() => withEnv("enforce", () => runBookGate(BOOK, book, GATE_OPTS)));
  assert.equal(advisory.passed, true, "1-axis book passes under advisory");
  assert.equal(enforce.passed, true, "1-axis book still passes under enforce (no aggregate → nothing to promote)");
  assert.equal(advisory.findings.some((f) => f.catalogId === "ARCH0.architecture_monoculture"), false, "no ARCH0 aggregate on a 1-axis book");
});

// ── the NEW-authoring opt-in option (content-excellence Track B 2026-07-15) ─────

test("bookGate (Track B): the structuralSamenessMode OPTION forces enforcement independent of the env flag (NEW-authoring path)", () => {
  const book = saturatedBook();
  // NEW-authoring path (generateBook): the option forces enforce even with the env
  // UNSET (advisory) → a severe-mold fresh book FAILS the gate.
  const forced = quiet(() => withEnv(undefined, () => runBookGate(BOOK, book, { ...GATE_OPTS, structuralSamenessMode: "enforce" })));
  assert.equal(forced.passed, false, "the enforce option fails a severe-mold book even with the env unset");
  assert.equal(
    forced.findings.find((f) => f.catalogId === "ARCH0.architecture_monoculture")?.severity,
    "blocker",
    "the option promotes the SEVERE ARCH0 aggregate to a blocker",
  );

  // Replay/gold/repair/promotion: omitting the option inherits the env default
  // (advisory) → the SAME book PASSES, byte-identical to before this change.
  const inherited = quiet(() => withEnv(undefined, () => runBookGate(BOOK, book, GATE_OPTS)));
  assert.equal(inherited.passed, true, "without the option, the env default (advisory) governs — gold/replay unchanged");

  // The explicit option WINS over the env: an advisory option beats an enforce env.
  const optAdvisory = quiet(() => withEnv("enforce", () => runBookGate(BOOK, book, { ...GATE_OPTS, structuralSamenessMode: "advisory" })));
  assert.equal(optAdvisory.passed, true, "an explicit advisory option overrides an enforce env");
});

// ── the deterministic snapshot builder ─────────────────────────────────────────

test("structuralSamenessSnapshot: reports a compact deterministic saturation snapshot; empty on a varied book", () => {
  const snap = withEnv(undefined, () => structuralSamenessSnapshot(saturatedBook()));
  assert.equal(snap.mode, "advisory", "snapshot records the mode in force (advisory default)");
  assert.equal(snap.archAxes.length, 4, "all four ARCH skeleton axes are captured");
  assert.equal(snap.archSevere, true, "≥ axesBlock axes → archSevere");
  assert.ok(snap.contentOverCap.length >= 1, "over-cap content devices are captured");
  for (const d of snap.contentOverCap) {
    assert.ok(d.frac > 0 && d.frac <= 1, `device ${d.id} fraction is a 0..1 ratio (got ${d.frac})`);
    assert.ok(Array.isArray(d.chapters) && d.chapters.length > 0, `device ${d.id} names its chapters`);
  }
  // The snapshot mirrors the env flag for attribution (telemetry only).
  assert.equal(withEnv("enforce", () => structuralSamenessSnapshot(saturatedBook())).mode, "enforce", "snapshot mode follows the env flag");

  // A varied book (no shared skeleton markers) → nothing saturated.
  const varied = Array.from({ length: 14 }, (_, i) => ch(i + 1, {}));
  const clean = structuralSamenessSnapshot(varied);
  assert.deepEqual(clean.archAxes, [], "no skeleton axes on a varied book");
  assert.equal(clean.archSevere, false, "varied book is not archSevere");
  assert.equal(clean.contentSevere, false, "varied book is not contentSevere");
});

test("structuralSamenessSnapshot: deterministic — identical books produce identical snapshots", () => {
  assert.deepEqual(structuralSamenessSnapshot(saturatedBook()), structuralSamenessSnapshot(saturatedBook()), "snapshot is a pure function of the chapters");
});
