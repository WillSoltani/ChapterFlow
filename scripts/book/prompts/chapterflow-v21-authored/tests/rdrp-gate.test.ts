/**
 * readerPatterns gate coverage (RDRP1/RDRP2/RDRP3 chapter-level + RDRP10/RDRP11
 * book-level). Same calibration claim as EXP*: every RDRP check runs only when
 * experiencePlan.behaviorLoop is present, so a chapter/book without the field
 * emits zero RDRP findings. The makeChapter default carries 6 examples (indices
 * 0-5) and 2 ifThenPlans (indices 0-1), so a mapsToExampleIndex of 0/2 and a
 * mapsToPlanIndex of 0 are in range.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { makeChapter } from "./helpers.js";
import { runShipGate, type GateFinding } from "../src/critics/finalGate.js";
import { runBookGate } from "../src/critics/bookGate.js";
import type { ExperiencePlanV21 } from "../src/types.js";

/** A clean, gate-passing behaviorLoop. `seed` varies the labels so two chapters
 *  built from it do NOT collide on the RDRP10 convergence check. Labels are
 *  concrete situations (20-60 chars), indices in range of the default chapter. */
function validPatterns(seed: string): ExperiencePlanV21 {
  return {
    behaviorLoop: {
      readerPatterns: [
        { id: `${seed}-morning-reach`, label: `When you reach for the ${seed} first thing`, mapsToPlanIndex: 0, mapsToExampleIndex: 0 },
        { id: `${seed}-midtask-drift`, label: `When focus drifts toward the ${seed} mid task`, mapsToExampleIndex: 2 },
      ],
    },
  };
}

function allFindings(report: ReturnType<typeof runShipGate>): GateFinding[] {
  return [...report.blockers, ...report.majors, ...report.minors];
}
function rdrpFindings(report: ReturnType<typeof runShipGate>): GateFinding[] {
  return allFindings(report).filter((f) => f.catalogId.startsWith("RDRP"));
}

test("absent behaviorLoop emits zero RDRP findings (calibration)", () => {
  const plain = runShipGate(makeChapter("zz-rdrp-absent", 1));
  assert.deepEqual(rdrpFindings(plain), [], "a chapter without behaviorLoop must surface no RDRP finding");
  // experiencePlan present but WITHOUT behaviorLoop must also be RDRP-silent.
  const epOnly = runShipGate(
    makeChapter("zz-rdrp-eponly", 1, {
      overrides: {
        experiencePlan: {
          transferPrompt: {
            prompt: "Where else does trading a hard task for a quick reward quietly cost you over a week?",
            contexts: ["Choosing which overdue bill to open first", "Deciding when to start a hard talk at home"],
          },
        },
      },
    }),
  );
  assert.deepEqual(rdrpFindings(epOnly), [], "experiencePlan without behaviorLoop must surface no RDRP finding");
});

test("a valid behaviorLoop emits zero RDRP findings", () => {
  const report = runShipGate(makeChapter("zz-rdrp-valid", 1, { overrides: { experiencePlan: validPatterns("phone") } }));
  assert.deepEqual(
    rdrpFindings(report),
    [],
    `valid readerPatterns should be clean; got: ${rdrpFindings(report).map((f) => `${f.catalogId}:${f.message}`).join(" | ")}`,
  );
});

test("RDRP1 blocks more than 8 patterns", () => {
  const plan: ExperiencePlanV21 = {
    behaviorLoop: {
      readerPatterns: Array.from({ length: 9 }, (_, i) => ({
        id: `pattern-${i}`,
        label: `When situation number ${i} pulls your focus away`,
      })),
    },
  };
  const report = runShipGate(makeChapter("zz-rdrp-card", 1, { overrides: { experiencePlan: plan } }));
  assert.ok(report.blockers.some((f) => f.catalogId === "RDRP1.structure"), "9 patterns must raise an RDRP1.structure blocker");
});

test("RDRP1 blocks empty/duplicate id and empty label", () => {
  const plan: ExperiencePlanV21 = {
    behaviorLoop: {
      readerPatterns: [
        { id: "dupe", label: "When you reach for the phone first thing" },
        { id: "dupe", label: "   " }, // duplicate id + empty label
      ],
    },
  };
  const report = runShipGate(makeChapter("zz-rdrp-id", 1, { overrides: { experiencePlan: plan } }));
  const msgs = report.blockers.filter((f) => f.catalogId === "RDRP1.structure").map((f) => f.message).join(" | ");
  assert.match(msgs, /duplicated/, "a duplicate id must block");
  assert.match(msgs, /label is empty/, "an empty label must block");
});

test("RDRP1 blocks a mapsToExampleIndex out of range", () => {
  const plan: ExperiencePlanV21 = {
    behaviorLoop: {
      readerPatterns: [
        { id: "out-of-range", label: "When you reach for the phone first thing", mapsToExampleIndex: 99 },
        { id: "in-range", label: "When focus drifts toward the phone mid task", mapsToPlanIndex: 0 },
      ],
    },
  };
  const report = runShipGate(makeChapter("zz-rdrp-idx", 1, { overrides: { experiencePlan: plan } }));
  assert.ok(
    report.blockers.some((f) => f.catalogId === "RDRP1.structure" && /mapsToExampleIndex/.test(f.message)),
    "an out-of-range mapsToExampleIndex must raise RDRP1.structure",
  );
});

test("RDRP2 flags a label outside 20-60 chars (minor)", () => {
  const plan: ExperiencePlanV21 = {
    behaviorLoop: {
      readerPatterns: [
        { id: "too-short", label: "Phone pull" }, // 10 chars: non-empty (not RDRP1) but < 20
        { id: "ok-length", label: "When focus drifts toward the phone mid task" },
      ],
    },
  };
  const report = runShipGate(makeChapter("zz-rdrp-len", 1, { overrides: { experiencePlan: plan } }));
  assert.ok(report.minors.some((f) => f.catalogId === "RDRP2.label_length"), "a 10-char label must raise RDRP2.label_length");
});

test("RDRP3 flags a vague personality-archetype label (major)", () => {
  const plan: ExperiencePlanV21 = {
    behaviorLoop: {
      readerPatterns: [
        { id: "archetype", label: "The procrastinator who keeps delaying" }, // contains "the procrastinator"
        { id: "concrete", label: "When focus drifts toward the phone mid task" },
      ],
    },
  };
  const report = runShipGate(makeChapter("zz-rdrp-cliche", 1, { overrides: { experiencePlan: plan } }));
  assert.ok(
    report.majors.some((f) => f.catalogId === "RDRP3.label_hygiene"),
    "a personality-archetype label must raise RDRP3.label_hygiene",
  );
});

test("RDRP10: identical labels across chapters converge (book gate)", () => {
  const shared = validPatterns("phone"); // same object → identical labels in both chapters
  const ch1 = makeChapter("zz-rdrp-conv", 1, { overrides: { experiencePlan: shared } });
  const ch2 = makeChapter("zz-rdrp-conv", 2, { overrides: { experiencePlan: shared } });
  const report = runBookGate("zz-rdrp-conv", [ch1, ch2]);
  assert.ok(
    report.findings.some((f) => f.catalogId === "RDRP10.label_convergence"),
    "an identical readerPattern label across 2 chapters must raise RDRP10",
  );
});

test("RDRP11: an out-of-range index is caught at the book gate too", () => {
  const plan: ExperiencePlanV21 = {
    behaviorLoop: { readerPatterns: [{ id: "bad-index", label: "When you reach for the phone first thing", mapsToPlanIndex: 50 }] },
  };
  const ch = makeChapter("zz-rdrp-idxbook", 1, { overrides: { experiencePlan: plan } });
  const report = runBookGate("zz-rdrp-idxbook", [ch]);
  assert.ok(
    report.findings.some((f) => f.catalogId === "RDRP11.index_validity"),
    "an out-of-range mapsToPlanIndex must raise RDRP11 at the book gate",
  );
});

test("RDRP10/RDRP11 do not fire on distinct, in-range patterns, and not at all without the field", () => {
  const distinct = [
    makeChapter("zz-rdrp-distinct", 1, { overrides: { experiencePlan: validPatterns("phone") } }),
    makeChapter("zz-rdrp-distinct", 2, { overrides: { experiencePlan: validPatterns("ledger") } }),
  ];
  const distinctReport = runBookGate("zz-rdrp-distinct", distinct);
  assert.ok(
    !distinctReport.findings.some((f) => f.catalogId.startsWith("RDRP")),
    "distinct, in-range patterns must produce zero RDRP book findings",
  );

  const plain = [makeChapter("zz-rdrp-plain", 1), makeChapter("zz-rdrp-plain", 2)];
  const plainReport = runBookGate("zz-rdrp-plain", plain);
  assert.ok(
    !plainReport.findings.some((f) => f.catalogId.startsWith("RDRP")),
    "a book without behaviorLoop must emit zero RDRP findings",
  );
});
