import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import {
  guardStub,
  installRouteHarness,
  makeSpy,
} from "@/tests/_lib/route-harness";

// API-02 route wiring: drives the real PATCH handler (daily cap served by an
// in-memory counter) so the follow-through rules are checked end to end, not only in the pure core:
//  - not due / already granted / cap reached -> 200, check-in recorded with 0 IP,
//    no award call;
//  - eligible -> one award keyed by "bookId:chapter", ipAwarded 25.

const guard = guardStub();

class StubAuthError extends Error {}

const DAY_MS = 24 * 60 * 60 * 1000;

type CommitmentFixture = {
  commitmentId: string;
  bookId: string;
  chapterNumber: number;
  status: string;
  followUpDate: string;
  followUpDays: number;
};

let commitment: CommitmentFixture;
let completedChapters: number[] = [];
let alreadyGranted = false;

const getCommitment = makeSpy(async () => commitment);
const listCommitments = makeSpy(async () => []);
const updateCommitmentStatus = makeSpy(
  async (
    _table: string,
    _userId: string,
    commitmentId: string,
    status: string,
    _reflection?: string,
    ipAwarded?: number,
  ) => ({ ...commitment, commitmentId, status, ipAwarded }),
);
const awardFlowPoints = makeSpy(
  async (_table: string, input: { amount: number; sourceId: string }) => {
    void input;
    return { awarded: true, state: { points: 125 } };
  },
);
const getUserFlowPointsState = makeSpy(async () => ({ points: 100 }));
const hasFlowPointsGrant = makeSpy(
  async (_table: string, _userId: string, _sourceType: string, sourceId: string) => {
    void sourceId;
    return alreadyGranted;
  },
);
const getUserProgress = makeSpy(async () => ({ completedChapters }));

// In-memory per-day counter standing in for http.ts's enforceDailyUserLimit
// (same contract: reserve one unit, or throw 429 rate_limited at the limit).
const counters = new Map<string, number>();
const enforceDailyUserLimit = makeSpy(
  async (params: { userPk: string; counterSk: string; limit: number }) => {
    const key = `${params.userPk}|${params.counterSk}`;
    const count = counters.get(key) ?? 0;
    if (count >= params.limit) {
      throw new BookApiError(429, "rate_limited", "Daily limit reached");
    }
    counters.set(key, count + 1);
  },
);

// The route imports bookOk/bookErr/withBookApiErrors and enforceDailyUserLimit
// from the same http module. Serve the real module with only the limiter
// replaced (filled in before() once the real module has loaded under the harness).
const httpStub: Record<string, unknown> = {};

const envStub = {
  getBookTableName: async () => "book-table-test",
  getBookAnalyticsTableName: async () => null,
  getAppBaseUrl: async () => "https://app.chapterflow.ca",
};

const harness = installRouteHarness({
  "@/app/app/api/book/_lib/account-guard": {
    requireActiveBookUser: guard.requireActiveBookUser,
  },
  "@/app/app/api/_lib/auth": { AuthError: StubAuthError },
  "@/app/app/api/book/_lib/http": httpStub,
  "@/app/app/api/book/_lib/env": envStub,
  "./env": envStub,
  "@/app/app/api/book/_lib/commitment-repo": {
    getCommitment,
    listCommitments,
    updateCommitmentStatus,
  },
  "@/app/app/api/book/_lib/analytics-repo": {
    analyticsTrackCommitment: async () => {},
  },
  "@/app/app/api/book/_lib/flow-points-repo": {
    awardFlowPoints,
    getUserFlowPointsState,
    hasFlowPointsGrant,
  },
  "@/app/app/api/book/_lib/progress-repo": { getUserProgress },
});

let PATCH: typeof import("./route").PATCH;

before(async () => {
  const realHttp = await import("../../../_lib/http");
  Object.assign(httpStub, realHttp, { enforceDailyUserLimit });
  ({ PATCH } = await import("./route"));
});

beforeEach(() => {
  guard.reset();
  commitment = {
    commitmentId: "c-1",
    bookId: "book-1",
    chapterNumber: 2,
    status: "active",
    followUpDate: new Date(Date.now() - DAY_MS).toISOString(),
    followUpDays: 3,
  };
  completedChapters = [1, 2];
  alreadyGranted = false;
  counters.clear();
  for (const spy of [
    getCommitment,
    listCommitments,
    updateCommitmentStatus,
    awardFlowPoints,
    getUserFlowPointsState,
    hasFlowPointsGrant,
    getUserProgress,
    enforceDailyUserLimit,
  ]) {
    spy.calls.length = 0;
  }
});

after(() => {
  harness.restore();
});

function completeRequest(): Request {
  return new Request("https://app.chapterflow.ca/app/api/book/me/commitments/c-1", {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxIn0.sig",
    },
    body: JSON.stringify({
      action: "complete",
      followThroughReflection: "I tried it twice this week and it helped.",
    }),
  });
}

async function complete(): Promise<{ status: number; ipAwarded: number | undefined }> {
  const res = await PATCH(completeRequest(), {
    params: Promise.resolve({ commitmentId: "c-1" }),
  });
  const body = (await res.json()) as { ipAwarded?: number };
  return { status: res.status, ipAwarded: body.ipAwarded };
}

function recordedIp(): number | undefined {
  assert.equal(updateCommitmentStatus.calls.length, 1, "check-in is recorded");
  assert.equal(updateCommitmentStatus.calls[0]?.[3], "completed");
  return updateCommitmentStatus.calls[0]?.[5];
}

test("eligible: one award keyed by book chapter, 25 IP reported and recorded", async () => {
  const res = await complete();
  assert.equal(res.status, 200);
  assert.equal(res.ipAwarded, 25);
  assert.equal(recordedIp(), 25);
  assert.equal(awardFlowPoints.calls.length, 1);
  const input = awardFlowPoints.calls[0]?.[1];
  assert.ok(input);
  assert.equal(input.sourceId, "book-1:2");
  assert.equal(input.amount, 25);
  assert.equal(enforceDailyUserLimit.calls.length, 1, "one daily-cap unit reserved");
});

test("not due yet: check-in recorded with 0 IP, no award, no cap reservation", async () => {
  commitment.followUpDate = new Date(Date.now() + DAY_MS).toISOString();
  const res = await complete();
  assert.equal(res.status, 200);
  assert.equal(res.ipAwarded, 0);
  assert.equal(recordedIp(), 0);
  assert.equal(awardFlowPoints.calls.length, 0);
  assert.equal(enforceDailyUserLimit.calls.length, 0);
});

test("chapter not completed: check-in recorded with 0 IP, no award", async () => {
  completedChapters = [1];
  const res = await complete();
  assert.equal(res.status, 200);
  assert.equal(res.ipAwarded, 0);
  assert.equal(recordedIp(), 0);
  assert.equal(awardFlowPoints.calls.length, 0);
});

test("already granted for this chapter: 0 IP, no award", async () => {
  alreadyGranted = true;
  const res = await complete();
  assert.equal(res.status, 200);
  assert.equal(res.ipAwarded, 0);
  assert.equal(recordedIp(), 0);
  assert.equal(awardFlowPoints.calls.length, 0);
  assert.equal(hasFlowPointsGrant.calls[0]?.[3], "book-1:2");
});

test("daily cap reached: check-in still succeeds with 0 IP, no award", async () => {
  // Three awards already paid today.
  for (let i = 0; i < 3; i += 1) {
    assert.equal((await complete()).ipAwarded, 25);
  }
  updateCommitmentStatus.calls.length = 0;
  awardFlowPoints.calls.length = 0;

  const res = await complete();
  assert.equal(res.status, 200);
  assert.equal(res.ipAwarded, 0);
  assert.equal(recordedIp(), 0);
  assert.equal(awardFlowPoints.calls.length, 0);
});
