import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import {
  guardStub,
  installRouteHarness,
  makeSpy,
} from "@/tests/_lib/route-harness";

const guard = guardStub();

// http.ts (loaded real) does `error instanceof AuthError` — provide a class.
class StubAuthError extends Error {}

const ensureUserBookStarted = makeSpy(async () => ({
  issuedDeviceId: false,
  deviceId: null,
}));
// applyStartDeviceCookie must return the response unchanged (real http.ts bookOk).
const applyStartDeviceCookie = makeSpy((response: unknown) => response);
// parseResponses is stubbed to a passthrough so the field-reaches-core seam is
// observable without pulling the whole quiz-submit dependency graph.
const parseResponses = makeSpy(
  (body: Record<string, unknown>) => body.responses ?? [],
);
const completeLearningLoop = makeSpy(
  async (_input: {
    responses: unknown;
    bookId: string;
    chapterNumber: number;
  }) => ({
    quiz: { questions: [] },
    progress: { currentChapterNumber: 1 },
  }),
);

const envStub = {
  getBookContentBucket: async () => "bucket-test",
  getBookTableName: async () => "book-table-test",
  getAppBaseUrl: async () => "https://app.chapterflow.ca",
};

const harness = installRouteHarness({
  "@/app/app/api/book/_lib/account-guard": {
    requireActiveBookUser: guard.requireActiveBookUser,
  },
  "@/app/app/api/_lib/auth": { AuthError: StubAuthError },
  "@/app/app/api/book/_lib/env": envStub,
  "./env": envStub,
  "@/app/app/api/book/_lib/ensure-book-started": {
    ensureUserBookStarted,
    applyStartDeviceCookie,
  },
  "@/app/app/api/book/_lib/quiz-submit-service": {
    completeLearningLoop,
    parseResponses,
  },
});

let POST: typeof import("./route").POST;

before(async () => {
  ({ POST } = await import("./route"));
});

beforeEach(() => {
  guard.reset();
  ensureUserBookStarted.calls.length = 0;
  applyStartDeviceCookie.calls.length = 0;
  parseResponses.calls.length = 0;
  completeLearningLoop.calls.length = 0;
});

after(() => {
  harness.restore();
});

const FAKE_JWT = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxIn0.sig";

function quizRequest(body?: string): Request {
  return new Request(
    "https://app.chapterflow.ca/app/api/book/me/quiz/b1/1/submit",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${FAKE_JWT}`,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body }),
    },
  );
}

function params() {
  return { params: Promise.resolve({ bookId: "b1", chapterNumber: "1" }) };
}

async function errorCode(res: Response): Promise<string | undefined> {
  const body = (await res.json()) as { error?: { code?: string } };
  return body.error?.code;
}

test("happy submit: guard invoked; answers reach completeLearningLoop", async () => {
  const answers = [{ questionId: "q1", selectedChoiceId: "c1" }];
  const res = await POST(
    quizRequest(JSON.stringify({ responses: answers })),
    params(),
  );
  assert.equal(res.status, 200);
  assert.equal(guard.requireActiveBookUser.calls.length, 1);
  assert.equal(completeLearningLoop.calls.length, 1);
  // field-reaches-core seam: the parsed responses + route params reach the core.
  assert.deepEqual(completeLearningLoop.calls[0]![0]!.responses, answers);
  assert.equal(completeLearningLoop.calls[0]![0]!.bookId, "b1");
  assert.equal(completeLearningLoop.calls[0]![0]!.chapterNumber, 1);
});

test("guard error maps to 403 account_deleted; submit never called", async () => {
  guard.setError(new BookApiError(403, "account_deleted", "deleted"));
  const res = await POST(
    quizRequest(JSON.stringify({ responses: [] })),
    params(),
  );
  assert.equal(res.status, 403);
  assert.equal(await errorCode(res), "account_deleted");
  assert.equal(completeLearningLoop.calls.length, 0);
});

test("no JSON body -> 400 invalid_json; submit never called", async () => {
  const res = await POST(quizRequest(), params());
  assert.equal(res.status, 400);
  assert.equal(await errorCode(res), "invalid_json");
  assert.equal(completeLearningLoop.calls.length, 0);
});
