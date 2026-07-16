/**
 * Emission-package parity contract (frozen by WP-102; V25 S-Tier §8 Lane 1).
 *
 * The pipeline's terminal artifact — the `book-packages/<id>.v21.json` bytes
 * `promoteBook` writes — is the load-bearing interface to the TWO hand-maintained
 * web adapters that render every book:
 *
 *   • server  `app/app/api/book/_lib/v21-adapter.ts` — `adaptV21ToV13`
 *   • client  `app/book/lib/v21-adapter.ts`          — `normalizeV21Package`
 *                                                       + `extractV21ChapterExtras`
 *
 * V25-08: that interface was never in the frozen manifest, so the two adapters
 * could silently drift from the emission (a new reader-facing field the pipeline
 * emits but neither adapter reads is dropped without a sound; a field an adapter
 * needs that stops being emitted degrades to an empty default). This contract
 * freezes the CONSUMER-PARITY SURFACE — the exact fields the two adapters read —
 * and makes `contract-validate` fail closed on drift.
 *
 * PARITY RULE: every field a fresh emission carries at the consumer envelope
 * (package / book / chapter / breakdown) must be a field the web adapters read.
 * A new envelope field that is not consumed is drift and MUST be wired into both
 * adapters (or removed) before it can ship.
 *
 * SCOPE OF ENFORCEMENT. The field lists below are derived ONLY from the keys the
 * two adapters actually read — no invented fields, never a superset that would
 * let a silently-dropped field pass (WP-102 red-team). Closed-world drift
 * detection is enforced at the four ENVELOPE levels where the emission surface
 * and the consumer surface coincide cleanly (package, book, chapter, breakdown).
 * The deeper sub-objects (example, quiz question, review card, implementation
 * plan, memorable line, experience plan) are DOCUMENTED here as the consumed
 * reference but their shape is governed by `validateChapterV21`
 * (`runtimeSchemas.ts`), which `contract-validate` runs alongside this check:
 * `validateChapterV21` legitimately requires internal-only emission fields the
 * adapters never read (e.g. `implementationPlan.title`,
 * `example.planSpec.{audience,stakes,requiredBeat}`, `*.sourceAnchorIds`), so a
 * naive whole-tree closed-world check would flag deliberate internal metadata as
 * drift. The two checks together are the parity gate; neither alone is.
 */

import { ContractDescriptor, expectFields } from "./contractUtil.js";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** One emission object level: the fields the web adapters read at that level.
 *  `enforceClosed` marks the four consumer-envelope levels where a field not in
 *  {required ∪ optional} is drift; the remaining (documentation-only) levels are
 *  validated for deep shape by `validateChapterV21`. */
export type EmissionLevelSurfaceV1 = {
  required: readonly string[];
  optional: readonly string[];
  enforceClosed: boolean;
};

/**
 * The single source of truth for the emission↔adapter parity surface. Every key
 * is traceable to an adapter read:
 *   • package/book/chapter/breakdown/example/reviewCard/implementationPlan/
 *     ifThenPlan/memorableLine — union of `adaptV21ToV13` (server) and
 *     `normalizeV21Package`/`adaptV21Chapter`/`extractV21ChapterExtras` (client)
 *     reads.
 *   • `book.edition` — client `normalizeV21Package` only (optional).
 *   • `quizQuestion.bloomsLevel`/`depthLevel` — server `adaptQuiz` only.
 *   • chapter `reflectionBefore`/`reflectionAfter` — client `extractV21ChapterExtras`
 *     only (deprecated, still read).
 * This constant is embedded in the frozen descriptor `fields`, so editing it
 * moves the contract hash and the freeze test fails without a version bump.
 */
export const EMISSION_ADAPTER_SURFACE = {
  // ── consumer envelope — closed-world drift detection ──────────────────────
  package: {
    required: ["schemaVersion", "packageId", "createdAt", "contentOwner", "book", "chapters"],
    optional: [],
    enforceClosed: true,
  },
  book: {
    required: ["bookId", "title", "author", "categories", "tags"],
    optional: ["edition"],
    enforceClosed: true,
  },
  chapter: {
    required: [
      "chapterId", "number", "title", "readingTimeMinutes", "hook", "keyTakeaway",
      "breakdown", "examples", "quiz", "reviewCards", "implementationPlan",
    ],
    optional: [
      "counterintuition", "tryThisNow", "reflectionBefore", "reflectionAfter",
      "memorableLines", "experiencePlan",
    ],
    enforceClosed: true,
  },
  breakdown: {
    required: ["fastRead", "deepRead", "fullRead"],
    optional: [],
    enforceClosed: true,
  },
  // ── deep shapes — documented consumed surface; validated by validateChapterV21 ──
  example: {
    required: ["exampleId", "title", "scenario", "whatToDo", "whyItMatters", "tags", "planSpec"],
    optional: [],
    enforceClosed: false,
  },
  quizQuestion: {
    required: ["questionId", "prompt", "choices", "correctIndex", "explanation"],
    optional: ["bloomsLevel", "depthLevel"],
    enforceClosed: false,
  },
  reviewCard: {
    required: ["cardId", "front", "back", "difficulty"],
    optional: [],
    enforceClosed: false,
  },
  implementationPlan: {
    required: ["coreSkill", "ifThenPlans", "twentyFourHourChallenge", "weeklyPractice"],
    optional: [],
    enforceClosed: false,
  },
  ifThenPlan: {
    required: ["context", "plan"],
    optional: [],
    enforceClosed: false,
  },
  memorableLine: {
    required: ["text"],
    optional: ["location", "why"],
    enforceClosed: false,
  },
  experiencePlan: {
    required: [],
    optional: ["failureRecovery", "transferPrompt", "behaviorLoop"],
    enforceClosed: false,
  },
} as const satisfies Record<string, EmissionLevelSurfaceV1>;

/** Closed-world + required check for one object level. Extra fields at an
 *  `enforceClosed` level are drift; missing required fields are drift. */
function checkLevel(
  obj: Record<string, unknown>,
  level: EmissionLevelSurfaceV1,
  where: string,
  errors: string[],
): void {
  if (level.enforceClosed) {
    const allowed = new Set<string>([...level.required, ...level.optional]);
    for (const key of Object.keys(obj)) {
      if (!allowed.has(key)) {
        errors.push(
          `${where}: field "${key}" is emitted but not consumed by the web adapters — ` +
          `wire it into adaptV21ToV13 + normalizeV21Package or remove it (emission↔adapter drift)`,
        );
      }
    }
  }
  expectFields(obj, [...level.required], errors, where);
}

/**
 * Validate a fresh emission against the consumer-parity envelope. Returns an
 * error-string list ([] = parity holds). Enforces closed-world drift detection
 * at package / book / chapter / breakdown; deep sub-object shape is delegated to
 * `validateChapterV21` (run alongside by `contract-validate`).
 */
export function validateEmissionParity(emission: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(emission)) return ["emission: not an object"];
  checkLevel(emission, EMISSION_ADAPTER_SURFACE.package, "emission", errors);

  if (isRecord(emission.book)) {
    checkLevel(emission.book, EMISSION_ADAPTER_SURFACE.book, "emission.book", errors);
  }

  if (Array.isArray(emission.chapters)) {
    emission.chapters.forEach((ch, i) => {
      const where = `emission.chapters[${i}]`;
      if (!isRecord(ch)) { errors.push(`${where}: not an object`); return; }
      checkLevel(ch, EMISSION_ADAPTER_SURFACE.chapter, where, errors);
      if (isRecord(ch.breakdown)) {
        checkLevel(ch.breakdown, EMISSION_ADAPTER_SURFACE.breakdown, `${where}.breakdown`, errors);
      }
    });
  }
  return errors;
}

/**
 * A canonical, deterministic fresh-emit SAMPLE. Every field is a consumed field
 * (closed over the envelope) AND the whole chapter is `validateChapterV21`-
 * conformant, so `contract-validate` can self-check both the parity envelope and
 * the deep schema with zero model calls. Deep sub-objects carry the internal-only
 * fields `validateChapterV21` requires (e.g. `implementationPlan.title`,
 * `planSpec.audience`) — legitimately outside the parity envelope.
 */
export function canonicalEmissionSample(): Record<string, unknown> {
  return {
    schemaVersion: "chapterflow-v21-authored",
    packageId: "pkg-emission-parity-sample",
    createdAt: "2026-07-16T00:00:00.000Z",
    contentOwner: "chapterflow",
    book: {
      bookId: "emission-parity-sample",
      title: "Emission Parity Sample",
      author: "ChapterFlow",
      categories: ["reference"],
      tags: ["contract"],
    },
    chapters: [
      {
        chapterId: "emission-parity-sample-ch01",
        number: 1,
        title: "Sample Chapter",
        readingTimeMinutes: 8,
        hook: "A hook that opens the chapter.",
        counterintuition: "The obvious move is the wrong one.",
        tryThisNow: "Do one small thing in the next 60 seconds.",
        keyTakeaway: "The single idea to remember.",
        breakdown: {
          fastRead: "Fast tier prose.\n\nSecond paragraph.",
          deepRead: "Deep tier prose.\n\nSecond paragraph.",
          fullRead: "Full tier prose.\n\nSecond paragraph.",
        },
        examples: [
          {
            exampleId: "ex01",
            title: "Worked example",
            tags: ["work"],
            planSpec: {
              domain: "work",
              audience: "practitioners",
              stakes: "a missed deadline",
              format: "narrative",
              requiredBeat: "decision",
            },
            scenario: "A concrete situation.",
            whatToDo: "The specific action to take.",
            whyItMatters: "The reason it pays off.",
          },
        ],
        quiz: {
          passingScorePercent: 80,
          questions: [
            {
              questionId: "q01",
              prompt: "What is the key idea?",
              choices: ["The right answer", "A distractor", "Another distractor"],
              correctIndex: 0,
              explanation: "Because the right answer is right.",
              bloomsLevel: "understand",
              depthLevel: "recall",
            },
          ],
        },
        reviewCards: [
          { cardId: "rc01", front: "Front prompt", back: "Back answer", difficulty: "easy" },
        ],
        implementationPlan: {
          title: "Put it to work",
          coreSkill: "The core skill.",
          ifThenPlans: [{ context: "When X happens", plan: "Then do Y." }],
          twentyFourHourChallenge: "A challenge for the next day.",
          weeklyPractice: "A practice for the week.",
        },
        memorableLines: [
          { text: "A line worth remembering.", location: "section 2", why: "It reframes the idea." },
        ],
        experiencePlan: {
          failureRecovery: {
            normalizingLine: "Slips are normal.",
            cueQuestion: "What tripped you up?",
            options: ["Reset the cue", "Shrink the step"],
            repairLine: "Restart at the next opportunity.",
          },
          transferPrompt: {
            prompt: "Where else could you apply this?",
            contexts: ["home", "work"],
          },
          behaviorLoop: {
            readerPatterns: [
              { id: "p1", label: "The over-planner", mapsToPlanIndex: 0, mapsToExampleIndex: 0 },
            ],
          },
        },
      },
    ],
  };
}

/**
 * The canonical sample mutated to CARRY a chapter-level field the adapters do not
 * consume — the minimal reproduction of emission↔adapter drift. `contract-validate`
 * and the freeze test use it to prove the parity check has teeth.
 */
export function driftedEmissionSample(): Record<string, unknown> {
  const sample = canonicalEmissionSample();
  const chapters = sample.chapters as Array<Record<string, unknown>>;
  // A brand-new reader-facing section the pipeline "started emitting" but that
  // neither adapter was taught to read — silently dropped today.
  chapters[0].audioNarration = "https://example.invalid/narration.mp3";
  return sample;
}

export const EMISSION_PACKAGE_CONTRACT: ContractDescriptor = {
  name: "emission-package",
  version: 1,
  ownerPrompt: "WP-102",
  description:
    "Consumer-parity surface of the terminal v21 emission: the exact fields the two web adapters (adaptV21ToV13 server, normalizeV21Package/extractV21ChapterExtras client) read. Closed-world drift detection at the package/book/chapter/breakdown envelope; deep shape delegated to validateChapterV21.",
  fields: {
    parityRule:
      "a field a fresh emission carries at the consumer envelope must be a field the web adapters read; deep shape is governed by validateChapterV21",
    adapterSurface: EMISSION_ADAPTER_SURFACE,
  },
};
