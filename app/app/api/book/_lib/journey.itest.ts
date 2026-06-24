/**
 * First authed golden-journey INTEGRATION test (PR-G / issue #17).
 *
 * Harness: drives the REAL repo modules against DynamoDB Local — NOT the HTTP
 * handlers, NOT Playwright. The seven required guarantees are pure DynamoDB
 * transaction semantics (conditional writes, transaction-cancellation mapping,
 * idempotency keys, effective-plan computation); each lives in a repo function
 * taking `tableName` first and talking only to `ddbDoc`. Point `ddbDoc` at
 * DynamoDB Local (via `AWS_ENDPOINT_URL_DYNAMODB`, honoured by AWS SDK v3 at
 * client construction) and the prod code runs unmodified.
 *
 * `.itest.ts` suffix so the `*.test.ts` glob (`npm test`) does NOT pick it up;
 * run via `npm run test:integration` (DynamoDB Local service container in CI).
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";

import { installServerOnlyShim } from "@/tests/_lib/server-only-shim";
import {
  makeAdminClient,
  createBookTable,
  dropTableIfExists,
  assertLoopbackEndpoint,
} from "@/tests/_lib/dynamo-local";

// ── Env MUST be set before importing any module that constructs an AWS client ──
// `app/app/api/_lib/aws.ts` builds `ddbDoc` at module load with only { region },
// so AWS_ENDPOINT_URL_DYNAMODB + dummy creds + AWS_REGION have to exist first.
const TABLE_NAME = process.env.BOOK_TABLE_NAME || "ChapterFlowApp-itest";
process.env.BOOK_TABLE_NAME = TABLE_NAME;
process.env.AWS_REGION ||= "us-east-1";
process.env.AWS_ENDPOINT_URL_DYNAMODB ||= "http://127.0.0.1:8000";
process.env.AWS_ACCESS_KEY_ID ||= "dummy";
process.env.AWS_SECRET_ACCESS_KEY ||= "dummy";

type RepoModule = typeof import("./repo");
type FlowPointsModule = typeof import("./flow-points-repo");
type QuizSessionModule = typeof import("./quiz-session");
type ContentServiceModule = typeof import("./content-service");
type AccountGuardPolicyModule = typeof import("./account-guard-policy");
type StorageModule = typeof import("./storage");
type AwsModule = typeof import("@/app/app/api/_lib/aws");

let repo: RepoModule;
let flowPoints: FlowPointsModule;
let quizSession: QuizSessionModule;
let contentService: ContentServiceModule;
let accountGuardPolicy: AccountGuardPolicyModule;
let storage: StorageModule;
let aws: AwsModule;

const adminClient = makeAdminClient();

before(async () => {
  // Hard safety: never let a mis-set AWS_ENDPOINT_URL_DYNAMODB point the
  // destructive create/drop at real AWS. (createBookTable/dropTableIfExists
  // also assert this internally — this is the first line of defence.)
  assertLoopbackEndpoint();
  await createBookTable(adminClient, TABLE_NAME);

  const restore = installServerOnlyShim();
  repo = await import("./repo");
  flowPoints = await import("./flow-points-repo");
  quizSession = await import("./quiz-session");
  contentService = await import("./content-service");
  accountGuardPolicy = await import("./account-guard-policy");
  storage = await import("./storage");
  aws = await import("@/app/app/api/_lib/aws");
  restore();
});

after(async () => {
  await dropTableIfExists(adminClient, TABLE_NAME);
  adminClient.destroy();
});

// ── Fixtures ────────────────────────────────────────────────────────────────

const BOOK_ID = "atomic-habits";

function isoNow(offsetMs = 0): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

async function seedProgress(
  userId: string,
  overrides: Partial<import("./types").BookUserProgress> = {},
): Promise<import("./types").BookUserProgress> {
  const now = isoNow();
  const progress: import("./types").BookUserProgress = {
    userId,
    bookId: BOOK_ID,
    pinnedBookVersion: 1,
    contentPrefix: `book-content/books/${BOOK_ID}/v000001`,
    manifestKey: `book-content/books/${BOOK_ID}/v000001/manifest.json`,
    currentChapterNumber: 1,
    unlockedThroughChapterNumber: 1,
    completedChapters: [],
    bestScoreByChapter: {},
    lastOpenedAt: now,
    lastActiveAt: now,
    updatedAt: now,
    createdAt: now,
    ...overrides,
  };
  await repo.upsertUserProgress(TABLE_NAME, progress);
  return progress;
}

function makePassingAttempt(
  userId: string,
  attemptNumber: number,
  createdAt: string,
): import("./types").QuizAttemptItem {
  return {
    userId,
    bookId: BOOK_ID,
    chapterNumber: 1,
    chapterId: `${BOOK_ID}-ch01`,
    quizId: `${BOOK_ID}:1`,
    attemptNumber,
    passingScorePercent: 80,
    scorePercent: 100,
    correctCount: 5,
    totalQuestions: 5,
    passed: true,
    cooldownSeconds: 0,
    nextEligibleAttemptAt: null,
    unlockedNextChapter: true,
    responses: [],
    questionResults: [],
    createdAt,
    updatedAt: createdAt,
  };
}

// ── GOLDEN PATH ───────────────────────────────────────────────────────────────

test("golden journey: reserve FREE slot → quiz pass advances progress → award IP", async () => {
  const userId = "golden-user";

  // 1. reserveBookEntitlement — FREE user, first unlock fills a free slot.
  const entitlement = await repo.reserveBookEntitlement(TABLE_NAME, {
    userId,
    bookId: BOOK_ID,
    freeSlotsDefault: 2,
  });
  assert.equal(entitlement.plan, "FREE");
  assert.ok(
    entitlement.unlockedBookIds.includes(BOOK_ID),
    "unlocked set should contain the book",
  );

  // 2. seed progress (book started, ch1 unlocked).
  const progress = await seedProgress(userId);
  assert.equal(progress.unlockedThroughChapterNumber, 1);

  // 3. build the pass-state via the pure helper, then record it.
  const createdAt = isoNow();
  const attempt = makePassingAttempt(userId, 1, createdAt);
  const nextProgress = quizSession.buildProgressAfterQuizPass(progress, {
    chapterNumber: 1,
    scorePercent: 100,
  });
  const nextQuizState = quizSession.buildQuizStateFromAttempts({
    userId,
    bookId: BOOK_ID,
    chapterNumber: 1,
    attempts: [attempt],
  });
  assert.ok(nextQuizState, "quiz state should be derivable from one attempt");

  await repo.recordQuizAttemptOutcome(TABLE_NAME, {
    previousAttemptsCount: 0,
    attempt,
    nextQuizState: nextQuizState!,
    nextProgress,
  });

  // progress advanced: ch1 complete, ch2 unlocked.
  const after = await repo.getUserProgress(TABLE_NAME, userId, BOOK_ID);
  assert.ok(after);
  assert.deepEqual(after!.completedChapters, [1]);
  assert.equal(after!.currentChapterNumber, 2);
  assert.equal(after!.unlockedThroughChapterNumber, 2);

  // 4. award Insight Points for the pass.
  const POINTS = 50;
  const award = await flowPoints.awardFlowPoints(TABLE_NAME, {
    userId,
    amount: POINTS,
    sourceType: "quiz_pass",
    sourceId: `${BOOK_ID}:1`,
  });
  assert.equal(award.awarded, true);
  assert.equal(award.reason, null);
  assert.equal(award.state.points, POINTS);
});

// ── NEGATIVE 1: deleted account ────────────────────────────────────────────────

test("deleted account → getAccountStatus + decideAccountAccess blocks", async () => {
  const userId = "deleted-user";
  await repo.setAccountStatus(TABLE_NAME, userId, "deleted", {
    statusReason: "self-delete",
  });

  const status = await repo.getAccountStatus(TABLE_NAME, userId);
  assert.equal(status?.status, "deleted");

  const decision = accountGuardPolicy.decideAccountAccess(status?.status);
  assert.equal(decision.action, "block");

  // active / missing → allow; deactivated → reactivate.
  assert.equal(accountGuardPolicy.decideAccountAccess(null).action, "allow");
  assert.equal(
    accountGuardPolicy.decideAccountAccess("deactivated").action,
    "reactivate",
  );
});

// ── NEGATIVE 2: locked chapter (throws BEFORE any S3 read) ──────────────────────

test("locked chapter → getUserAccessibleQuiz throws chapter_locked 403 before S3", async () => {
  const userId = "locked-user";
  await seedProgress(userId, { unlockedThroughChapterNumber: 1 });

  // Sabotage S3 so we prove the lock check throws BEFORE any object read.
  const originalSend = aws.s3.send.bind(aws.s3);
  let s3Touched = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (aws.s3 as any).send = async (...args: unknown[]) => {
    s3Touched = true;
    return originalSend(...(args as Parameters<typeof originalSend>));
  };

  try {
    await assert.rejects(
      () =>
        contentService.getUserAccessibleQuiz({
          tableName: TABLE_NAME,
          contentBucket: "unused-bucket",
          userId,
          bookId: BOOK_ID,
          chapterNumber: 5,
        }),
      (error: unknown) => {
        const e = error as { status?: number; code?: string };
        assert.equal(e.status, 403);
        assert.equal(e.code, "chapter_locked");
        return true;
      },
    );
    assert.equal(s3Touched, false, "must not reach S3 for a locked chapter");
  } finally {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (aws.s3 as any).send = originalSend;
  }
});

// ── NEGATIVE 3: duplicate quiz submit ──────────────────────────────────────────

test("duplicate submit → second recordQuizAttemptOutcome 409, second award not granted", async () => {
  const userId = "dup-user";
  const progress = await seedProgress(userId);
  const createdAt = isoNow();
  const attempt = makePassingAttempt(userId, 1, createdAt);
  const nextProgress = quizSession.buildProgressAfterQuizPass(progress, {
    chapterNumber: 1,
    scorePercent: 100,
  });
  const nextQuizState = quizSession.buildQuizStateFromAttempts({
    userId,
    bookId: BOOK_ID,
    chapterNumber: 1,
    attempts: [attempt],
  })!;

  await repo.recordQuizAttemptOutcome(TABLE_NAME, {
    previousAttemptsCount: 0,
    attempt,
    nextQuizState,
    nextProgress,
  });

  // Replaying the SAME attempt (same createdAt → same SK) AND the stale
  // previousAttemptsCount=0 cancels the transaction → quiz_state_conflict 409.
  await assert.rejects(
    () =>
      repo.recordQuizAttemptOutcome(TABLE_NAME, {
        previousAttemptsCount: 0,
        attempt,
        nextQuizState,
        nextProgress,
      }),
    (error: unknown) => {
      const e = error as { status?: number; code?: string };
      assert.equal(e.status, 409);
      assert.equal(e.code, "quiz_state_conflict");
      return true;
    },
  );

  // Idempotent IP: first award granted, second (same sourceId) is a no-op.
  const first = await flowPoints.awardFlowPoints(TABLE_NAME, {
    userId,
    amount: 50,
    sourceType: "quiz_pass",
    sourceId: `${BOOK_ID}:1`,
  });
  assert.equal(first.awarded, true);
  const second = await flowPoints.awardFlowPoints(TABLE_NAME, {
    userId,
    amount: 50,
    sourceType: "quiz_pass",
    sourceId: `${BOOK_ID}:1`,
  });
  assert.equal(second.awarded, false);
  assert.equal(second.reason, "duplicate");
  // Balance not double-counted.
  assert.equal(second.state.points, 50);
});

// ── NEGATIVE 4: book limit reached ──────────────────────────────────────────────

test("book limit → second reserve with slots=1 throws book_limit_reached 402", async () => {
  const userId = "limit-user";
  const a = await repo.reserveBookEntitlement(TABLE_NAME, {
    userId,
    bookId: "book-a",
    freeSlotsDefault: 1,
  });
  assert.ok(a.unlockedBookIds.includes("book-a"));

  await assert.rejects(
    () =>
      repo.reserveBookEntitlement(TABLE_NAME, {
        userId,
        bookId: "book-b",
        freeSlotsDefault: 1,
      }),
    (error: unknown) => {
      const e = error as { status?: number; code?: string };
      assert.equal(e.status, 402);
      assert.equal(e.code, "book_limit_reached");
      return true;
    },
  );

  // Re-reserving an ALREADY-unlocked book is idempotent (no 402).
  const again = await repo.reserveBookEntitlement(TABLE_NAME, {
    userId,
    bookId: "book-a",
    freeSlotsDefault: 1,
  });
  assert.ok(again.unlockedBookIds.includes("book-a"));
});

// ── NEGATIVE 5: cooldown ────────────────────────────────────────────────────────

test("cooldown: remainingCooldownSeconds > 0 for a future eligibility, 0 for past/absent", () => {
  // Drive the pure helper (the live gate uses the same function).
  assert.equal(quizSession.remainingCooldownSeconds(null), 0);
  assert.equal(quizSession.remainingCooldownSeconds(undefined), 0);
  assert.equal(quizSession.remainingCooldownSeconds(isoNow(-60_000)), 0);
  const remaining = quizSession.remainingCooldownSeconds(isoNow(120_000));
  assert.ok(remaining > 0, "future eligibility yields positive cooldown");
  assert.ok(remaining <= 120, "cooldown is bounded by the offset");

  // Failure-streak ladder: 1→60, 2→120, 3+→180.
  assert.equal(quizSession.cooldownSecondsForFailureStreak(0), 0);
  assert.equal(quizSession.cooldownSecondsForFailureStreak(1), 60);
  assert.equal(quizSession.cooldownSecondsForFailureStreak(2), 120);
  assert.equal(quizSession.cooldownSecondsForFailureStreak(3), 180);
  assert.equal(quizSession.cooldownSecondsForFailureStreak(9), 180);
});

// ── NEGATIVE 6: entitlement-read failure + effective-plan computation ───────────

test("entitlement read DynamoDB failure → repo.getUserEntitlement REJECTS (never silently FREE)", async () => {
  // If a DynamoDB read fails, the repo MUST propagate the error — it must NOT
  // swallow the failure into a resolved FREE/null entitlement, which would lock
  // a paying user out of their books. Stub the SAME client the repo uses
  // (aws.ddbDoc) to reject, drive the REAL repo function, and assert IT rejects.
  const originalSend = aws.ddbDoc.send.bind(aws.ddbDoc);
  const sendError = new Error("simulated DynamoDB outage") as Error & {
    name: string;
  };
  sendError.name = "InternalServerError";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (aws.ddbDoc as any).send = async () => {
    throw sendError;
  };

  try {
    let result: unknown;
    let threw = false;
    try {
      result = await repo.getUserEntitlement(TABLE_NAME, "any-user");
    } catch {
      threw = true;
    }
    // The contract: the repo propagates the failure. It must NOT have resolved
    // — and in particular must NOT have resolved to a (false) FREE entitlement.
    assert.equal(
      threw,
      true,
      "getUserEntitlement must reject on a DynamoDB read failure, not resolve",
    );
    assert.equal(
      (result as { plan?: string } | undefined)?.plan,
      undefined,
      "the failure must not be swallowed into a resolved entitlement (e.g. FREE)",
    );

    // Belt-and-suspenders: the same assertion via assert.rejects.
    await assert.rejects(() =>
      repo.getUserEntitlement(TABLE_NAME, "any-user"),
    );
  } finally {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (aws.ddbDoc as any).send = originalSend;
  }
});

test("effective plan: expired license → FREE, future license → PRO (inline at read)", async () => {
  const expiredUser = "lic-expired";
  const activeUser = "lic-active";

  // Raw-seed PRO-via-license items (the webhook/license route would normally
  // write these); getUserEntitlement recomputes the effective plan at read.
  await rawPutLicenseEntitlement(expiredUser, isoNow(-86_400_000)); // yesterday
  await rawPutLicenseEntitlement(activeUser, isoNow(86_400_000)); // tomorrow

  const expired = await repo.getUserEntitlement(TABLE_NAME, expiredUser);
  assert.equal(expired?.plan, "FREE", "expired license downgrades to FREE");

  const active = await repo.getUserEntitlement(TABLE_NAME, activeUser);
  assert.equal(active?.plan, "PRO", "unexpired license stays PRO");
});

async function rawPutLicenseEntitlement(
  userId: string,
  licenseExpiresAt: string,
): Promise<void> {
  const restore = installServerOnlyShim();
  const { PutCommand } = await import("@aws-sdk/lib-dynamodb");
  restore();
  await aws.ddbDoc.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `BOOKUSER#${userId}`,
        SK: "ENTITLEMENT",
        entity: "BOOK_USER_ENTITLEMENT",
        userId,
        plan: "PRO",
        proStatus: "active",
        proSource: "license",
        licenseKey: "CF-TEST-TEST-TEST",
        licenseExpiresAt,
        freeBookSlots: 2,
        updatedAt: isoNow(),
      },
    }),
  );
}

// ── NEGATIVE 7: content failure (S3) ────────────────────────────────────────────

test("content failure: NoSuchKey → content_not_found 404, malformed → invalid_json 422", async () => {
  const originalSend = aws.s3.send.bind(aws.s3);

  // NoSuchKey → 404 content_not_found.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (aws.s3 as any).send = async () => {
    const err = new Error("no such key") as Error & { name: string };
    err.name = "NoSuchKey";
    throw err;
  };
  try {
    await assert.rejects(
      () => storage.readJsonFromS3("bucket", "missing.json"),
      (error: unknown) => {
        const e = error as { status?: number; code?: string };
        assert.equal(e.status, 404);
        assert.equal(e.code, "content_not_found");
        return true;
      },
    );
  } finally {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (aws.s3 as any).send = originalSend;
  }

  // Malformed JSON body → 422 invalid_json.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (aws.s3 as any).send = async () => ({
    Body: { transformToString: async () => "{ this is not json" },
  });
  try {
    await assert.rejects(
      () => storage.readJsonFromS3("bucket", "bad.json"),
      (error: unknown) => {
        const e = error as { status?: number; code?: string };
        assert.equal(e.status, 422);
        assert.equal(e.code, "invalid_json");
        return true;
      },
    );
  } finally {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (aws.s3 as any).send = originalSend;
  }
});

// (Stripe webhook idempotency is unit-tested in webhook-claim-core.test.ts; the
// claim-lease design replaced the old recordStripeWebhookEvent boolean API, so
// it is not re-exercised here.)
