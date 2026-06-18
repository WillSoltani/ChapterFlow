import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeV21Package } from "./v21-adapter";
import { buildBookChapterFromRawV21 } from "../data/bookChapters";
import { adaptApiChapterToBookChapter } from "@/app/book/library/[bookId]/chapter/[chapterId]/lib/chapterFromApi";

// Run from the repo root (npm test), so process.cwd() is the project root.
const rawPkg = JSON.parse(
  readFileSync(
    join(process.cwd(), "book-packages", "atomic-habits.v21.json"),
    "utf8",
  ),
) as unknown;

const sampleRawChapter = (rawPkg as { chapters: Record<string, unknown>[] }).chapters[0];

const EXPERIENCE_PLAN = {
  failureRecovery: {
    normalizingLine:
      "Reaching for the feed is your focus trading a hard task for a quicker, surer reward.",
    cueQuestion: "What pressure pushed you toward the distraction just now?",
    options: [
      "Move the phone an arm's length away before the next work block begins.",
      "Say the task out loud, then write its very first line.",
    ],
    repairLine:
      "Close the app, set a short timer, and reopen the work where you left it before the pull took over.",
  },
  transferPrompt: {
    prompt:
      "Where else does trading a hard task for a quick reward quietly cost you over a week?",
    contexts: [
      "Choosing which overdue bill to open first",
      "Deciding when to start a hard conversation at home",
    ],
  },
};

/**
 * Regression guard for the C1 "blank Summary" class of bug: v21 chapter prose
 * lives in `breakdown.{fastRead,deepRead,fullRead}`, and must be mapped into
 * the reader's `contentVariants.{easy,medium,hard}` with non-empty
 * `chapterBreakdown` + `summaryBlocks`. If a future change routes v21 through
 * the wrong normalizer (the original C1 bug), these assertions fail.
 */
test("normalizeV21Package fills non-empty Summary content for every chapter (guards C1)", () => {
  const pkg = normalizeV21Package(rawPkg);
  assert.equal(pkg.schemaVersion, "chapterflow-v21-authored");
  assert.ok(pkg.chapters.length > 0, "expected the package to have chapters");

  for (const ch of pkg.chapters) {
    const variants = ch.contentVariants;
    assert.ok(
      Object.keys(variants).length > 0,
      `chapter ${ch.number} has zero contentVariants (C1 regression)`,
    );

    for (const key of ["easy", "medium", "hard"] as const) {
      const v = variants[key];
      assert.ok(v, `chapter ${ch.number} is missing the ${key} variant`);
      assert.ok(
        typeof v!.chapterBreakdown === "string" &&
          v!.chapterBreakdown.trim().length > 0,
        `chapter ${ch.number} ${key} has empty chapterBreakdown`,
      );
      assert.ok(
        Array.isArray(v!.summaryBlocks) && v!.summaryBlocks.length > 0,
        `chapter ${ch.number} ${key} has empty summaryBlocks`,
      );
    }
  }
});

test("normalizeV21Package rejects a non-v21 package", () => {
  assert.throws(() => normalizeV21Package({ schemaVersion: "nstd" }));
});

/**
 * experiencePlan must survive the full raw → BookChapter pipeline
 * (extractV21ChapterExtras + the merge-spread in buildBundle). Wiring the
 * adapter but forgetting the merge-spread silently drops the field — this is
 * the regression guard for that.
 */
test("experiencePlan survives raw → BookChapter (adapter + merge-spread)", () => {
  const withPlan = { ...sampleRawChapter, experiencePlan: EXPERIENCE_PLAN };
  const chapter = buildBookChapterFromRawV21(withPlan, {
    bookId: "atomic-habits",
    title: "Atomic Habits",
    author: "James Clear",
  });
  assert.ok(chapter.experiencePlan, "experiencePlan must reach the reader BookChapter");
  assert.equal(
    chapter.experiencePlan!.failureRecovery?.normalizingLine,
    EXPERIENCE_PLAN.failureRecovery.normalizingLine,
  );
  assert.deepEqual(
    chapter.experiencePlan!.failureRecovery?.options,
    EXPERIENCE_PLAN.failureRecovery.options,
  );
  assert.deepEqual(
    chapter.experiencePlan!.transferPrompt?.contexts,
    EXPERIENCE_PLAN.transferPrompt.contexts,
  );
});

test("a chapter without experiencePlan yields undefined (graceful absence)", () => {
  const chapter = buildBookChapterFromRawV21(sampleRawChapter, { bookId: "atomic-habits" });
  assert.equal(chapter.experiencePlan, undefined);
});

test("a partial/empty experiencePlan is dropped, not surfaced as empty strings", () => {
  const partial = {
    ...sampleRawChapter,
    experiencePlan: {
      failureRecovery: { normalizingLine: "present", cueQuestion: "", options: [], repairLine: "" },
    },
  };
  const chapter = buildBookChapterFromRawV21(partial, { bookId: "atomic-habits" });
  assert.equal(chapter.experiencePlan, undefined, "an incomplete failureRecovery must not surface");
});

/**
 * The production reader loads chapters via the API and reconstructs them through
 * chapterFromApi. experiencePlan must survive THAT path too (it lives in
 * v21Extras), or the cards render only in local-bundled mode. Regression guard.
 */
test("experiencePlan survives the API-backed path (chapterFromApi.v21Extras → BookChapter)", () => {
  const apiChapter = {
    chapterId: "atomic-habits-ch01",
    number: 1,
    title: "Test chapter",
    readingTimeMinutes: 8,
    contentVariants: {
      easy: { chapterBreakdown: { direct: "Fast-read prose, long enough for the reader to render." } },
      medium: { chapterBreakdown: { direct: "Deep-read prose, long enough for the reader to render." } },
      hard: { chapterBreakdown: { direct: "Full-read prose, long enough for the reader to render." } },
    },
    v21Extras: { hook: "A hook.", experiencePlan: EXPERIENCE_PLAN },
  };
  const chapter = adaptApiChapterToBookChapter(apiChapter, {
    bookId: "atomic-habits",
    title: "Atomic Habits",
  });
  assert.ok(chapter.experiencePlan, "API path must carry experiencePlan onto the reader BookChapter");
  assert.equal(
    chapter.experiencePlan!.failureRecovery?.normalizingLine,
    EXPERIENCE_PLAN.failureRecovery.normalizingLine,
  );
  assert.deepEqual(
    chapter.experiencePlan!.transferPrompt?.contexts,
    EXPERIENCE_PLAN.transferPrompt.contexts,
  );
});

/**
 * behaviorLoop.readerPatterns (RDRP / Phase 3) must survive BOTH reader paths —
 * the local extract+merge-spread AND the API v21Extras reconstruction — including
 * the optional 0-based mapsTo*Index fields. If the carry is wired on only one path,
 * pattern personalization silently vanishes for half the readers.
 */
const READER_PATTERNS = {
  behaviorLoop: {
    readerPatterns: [
      {
        id: "morning-phone-reach",
        label: "When you reach for the phone first thing",
        mapsToPlanIndex: 0,
        mapsToExampleIndex: 1,
      },
      {
        id: "midtask-drift",
        label: "When focus drifts toward the feed mid task",
        mapsToExampleIndex: 2,
      },
    ],
  },
};

test("behaviorLoop.readerPatterns survives raw → BookChapter (local adapter + merge-spread)", () => {
  const withPatterns = { ...sampleRawChapter, experiencePlan: { ...EXPERIENCE_PLAN, ...READER_PATTERNS } };
  const chapter = buildBookChapterFromRawV21(withPatterns, {
    bookId: "atomic-habits",
    title: "Atomic Habits",
    author: "James Clear",
  });
  const patterns = chapter.experiencePlan?.behaviorLoop?.readerPatterns;
  assert.ok(patterns, "behaviorLoop.readerPatterns must reach the reader BookChapter (local path)");
  assert.equal(patterns!.length, 2);
  assert.equal(patterns![0].label, "When you reach for the phone first thing");
  assert.equal(patterns![0].mapsToPlanIndex, 0);
  assert.equal(patterns![0].mapsToExampleIndex, 1);
  assert.equal(patterns![1].mapsToExampleIndex, 2);
  assert.equal(patterns![1].mapsToPlanIndex, undefined, "an omitted index stays omitted");
});

test("behaviorLoop.readerPatterns survives the API-backed path (chapterFromApi.v21Extras → BookChapter)", () => {
  const apiChapter = {
    chapterId: "atomic-habits-ch01",
    number: 1,
    title: "Test chapter",
    readingTimeMinutes: 8,
    contentVariants: {
      easy: { chapterBreakdown: { direct: "Fast-read prose, long enough for the reader to render." } },
      medium: { chapterBreakdown: { direct: "Deep-read prose, long enough for the reader to render." } },
      hard: { chapterBreakdown: { direct: "Full-read prose, long enough for the reader to render." } },
    },
    v21Extras: { hook: "A hook.", experiencePlan: { ...EXPERIENCE_PLAN, ...READER_PATTERNS } },
  };
  const chapter = adaptApiChapterToBookChapter(apiChapter, {
    bookId: "atomic-habits",
    title: "Atomic Habits",
  });
  const patterns = chapter.experiencePlan?.behaviorLoop?.readerPatterns;
  assert.ok(patterns, "API path must carry behaviorLoop.readerPatterns onto the reader BookChapter");
  assert.equal(patterns!.length, 2);
  assert.equal(patterns![0].id, "morning-phone-reach");
  assert.equal(patterns![1].mapsToExampleIndex, 2);
});
