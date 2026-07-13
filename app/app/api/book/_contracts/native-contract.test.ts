import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

import { buildIosAppConfig } from "../config/ios/config-core";
import {
  assertNativeContractSourceConformance,
  buildNativeContractBundle,
  parseNativeContractProvenanceEnvironment,
  serializeNativeContractBundle,
  type NativeContractBuildOptions,
} from "./native-contract-generator-core";
import { nativeContractOperationDefinitions } from "./native-contract-registry";
import { assertNativeContractBundle, type NativeContractBundle } from "./native-contract-types";

const repoRoot = process.cwd();
const bundlePath = "contracts/native-ios/v1/contract-bundle.json";

const expectedOperationKeys = `
account-deactivate.post|POST|/book/me/account/deactivate
account-delete.post|POST|/book/me/account/delete
analytics-beacon.post|POST|/book/me/analytics/beacon
analytics-track.post|POST|/book/me/analytics/track
apple-verify.post|POST|/book/me/billing/apple/verify
ask-book.post|POST|/book/books/{bookId}/ask
audio-plan.get|GET|/book/books/{bookId}/chapters/{chapterNumber}/audio
badges.get|GET|/book/me/badges
block-user.post|POST|/book/me/blocks
blocked-user.delete|DELETE|/book/me/blocks/{userId}
blocked-users.get|GET|/book/me/blocks
book-detail.get|GET|/book/books/{bookId}
book-state.get|GET|/book/me/books/{bookId}/state
book-state.patch|PATCH|/book/me/books/{bookId}/state
catalog.get|GET|/book/books
chapter.get|GET|/book/books/{bookId}/chapters/{chapterNumber}
commitment.get|GET|/book/me/commitments/{commitmentId}
commitment.patch|PATCH|/book/me/commitments/{commitmentId}
commitment.post|POST|/book/me/commitments
commitments.get|GET|/book/me/commitments
concept-graph.get|GET|/book/books/{bookId}/concept-graph
dashboard.get|GET|/book/me/dashboard
depth-recommendation.get|GET|/book/me/books/{bookId}/depth-recommendation
device-register.post|POST|/book/me/devices/register
device-unregister.post|POST|/book/me/devices/unregister
entitlements.get|GET|/book/me/entitlements
event-join.post|POST|/book/me/events/{eventId}/join
event-progress.get|GET|/book/me/events/{eventId}/progress
event-progress.post|POST|/book/me/events/{eventId}/progress
export.get|GET|/book/me/export
flow-points-redeem.post|POST|/book/me/flow-points/redeem
flow-points.get|GET|/book/me/flow-points
gift-claim.post|POST|/book/me/gifts/{code}/claim
gift-create.post|POST|/book/me/gifts
gift-preview.get|GET|/book/me/gifts/{code}
journey-start.post|POST|/book/me/journeys/{journeyId}/start
journeys.get|GET|/book/books/journeys
mobile-config.get|GET|/book/config/ios
moderation-report.post|POST|/book/moderation/reports
notebook.delete|DELETE|/book/me/notebook/{entryId}
notebook.get|GET|/book/me/notebook
notebook.patch|PATCH|/book/me/notebook/{entryId}
notebook.post|POST|/book/me/notebook
notifications-read-all.post|POST|/book/me/notifications/read-all
notifications.get|GET|/book/me/notifications
onboarding-complete.post|POST|/book/me/onboarding/complete
onboarding-progress.get|GET|/book/me/onboarding/progress
onboarding-progress.post|PATCH|/book/me/onboarding/progress
own-profile.get|GET|/book/me/profile
pair-accept.post|POST|/book/me/pairs/accept/{code}
pair-invite.post|POST|/book/me/pairs/invite
pair-nudge.post|POST|/book/me/pairs/{partnerId}/nudge
pair.delete|DELETE|/book/me/pairs/{partnerId}
pair.get|GET|/book/me/pairs/{partnerId}
pairs.get|GET|/book/me/pairs
progress.get|GET|/book/me/progress
public-profile.get|GET|/book/users/{userId}/profile
quiz-check.post|POST|/book/books/{bookId}/chapters/{chapterNumber}/quiz/check
quiz-event.post|POST|/book/me/quiz/{bookId}/{chapterNumber}/events
quiz-submit.post|POST|/book/me/quiz/{bookId}/{chapterNumber}/submit
quiz.get|GET|/book/books/{bookId}/chapters/{chapterNumber}/quiz
reading-session.post|POST|/book/me/reading-sessions
referral-apply.post|POST|/book/me/referrals/apply
referral-profile.get|GET|/book/me/referrals
reflection-feedback.post|POST|/book/me/reflections/{bookId}/{chapterNumber}/feedback
reflection.post|POST|/book/me/reflections/{bookId}/{chapterNumber}
reflections.get|GET|/book/me/reflections/{bookId}/{chapterNumber}
review-grade.post|POST|/book/me/reviews/{cardId}
reviews.get|GET|/book/me/reviews
saved-toggle.post|POST|/book/me/saved
saved.get|GET|/book/me/saved
scenario.post|POST|/book/me/books/{bookId}/chapters/{chapterNumber}/scenarios
scenarios.get|GET|/book/me/books/{bookId}/chapters/{chapterNumber}/scenarios
search-index.get|GET|/book/search-index
seasonal-event.get|GET|/book/events/active
settings.get|GET|/book/me/settings
settings.patch|PATCH|/book/me/settings
share-event.post|POST|/book/me/share-events
shop.get|GET|/book/me/shop
start-book.post|POST|/book/me/books/{bookId}/start
streak.get|GET|/book/me/streak
tier.post|GET|/book/me/tier
user-journey.get|GET|/book/me/journeys/{journeyId}
`
  .trim()
  .split("\n")
  .sort();

const expectedVariantIds = `
account-deactivate.post:deactivateaccount
account-delete.post:deleteaccount
analytics-beacon.post:urlsessionanalyticstransport-path-beacon
analytics-track.post:urlsessionanalyticstransport-path-track
apple-verify.post:liveentitlementrepository-directendpoint
apple-verify.post:verifyapplepurchase
ask-book.post:askbook
audio-plan.get:getaudioplan
audio-plan.get:getaudioplanfreshurls
badges.get:getbadges
block-user.post:blockuser
blocked-user.delete:unblockuser
blocked-users.get:getblockedusers
book-detail.get:getbook
book-detail.get:getmanifestfordownload
book-state.get:getbookstate
book-state.patch:patchbookcursor
book-state.patch:patchbookpreferredvariant
catalog.get:getbooks
chapter.get:getchapter
chapter.get:getchapterfordownload
commitment.get:getcommitment
commitment.patch:updatecommitment
commitment.post:createcommitment
commitments.get:getcommitments
concept-graph.get:getconceptgraph
dashboard.get:getdashboard
depth-recommendation.get:getdepthrecommendation
device-register.post:registerdevice
device-unregister.post:unregisterdevice
entitlements.get:getentitlements
event-join.post:joinevent
event-progress.get:geteventprogress
event-progress.post:posteventprogress
export.get:getexport
flow-points-redeem.post:redeemflowpoints
flow-points.get:getflowpoints
gift-claim.post:claimgift
gift-create.post:creategift
gift-preview.get:getgift
journey-start.post:startjourney
journeys.get:getjourneys
mobile-config.get:getiosconfig
moderation-report.post:submitreport
notebook.delete:deletenotebookentry
notebook.get:getnotebook
notebook.patch:patchnotebookentry
notebook.post:postnotebookentry
notifications-read-all.post:postmarkallnotificationsread
notifications.get:getnotifications
onboarding-complete.post:postonboardingcomplete
onboarding-progress.get:getonboardingprogress
onboarding-progress.post:postonboardingprogress
own-profile.get:getmyprofile
pair-accept.post:acceptpairinvite
pair-invite.post:createpairinvite
pair-nudge.post:nudgepartner
pair.delete:deletepair
pair.get:getpair
pairs.get:getpairs
progress.get:getprogressoverview
public-profile.get:getpublicprofile
quiz-check.post:checkquizanswer
quiz-event.post:postquizevent
quiz-submit.post:submitquiz-online
quiz-submit.post:submitquiz-sync
quiz.get:getquiz
quiz.get:getquizfordownload
reading-session.post:postaudiosessionevent
reading-session.post:postreadingsessionevent
referral-apply.post:applyreferralcode
referral-profile.get:getreferralprofile
reflection-feedback.post:requestreflectionfeedback
reflection.post:postreflection
reflections.get:getreflections
review-grade.post:gradereviewcard
reviews.get:getreviews
saved-toggle.post:togglesaved
saved.get:getsavedbooks
scenario.post:postscenario
scenario.post:scenariorepository-replaydirectendpoint
scenarios.get:getscenarios
search-index.get:getsearchindex
seasonal-event.get:getactiveevent
settings.get:getsettings
settings.patch:patchnotificationsettings
settings.patch:updatesettings
share-event.post:postshareevent
shop.get:getshop
start-book.post:startbook
streak.get:getstreak
tier.post:posttier
user-journey.get:getuserjourney
`
  .trim()
  .split("\n")
  .sort();

function buildBundle(): NativeContractBundle {
  return buildNativeContractBundle(repoRoot, nativeContractOperationDefinitions);
}

test("native inventory equals the verified 83-operation / 93-producer iOS source inventory", () => {
  const bundle = buildBundle();
  const actualOperationKeys = bundle.operations
    .map((operation) => `${operation.id}|${operation.method}|${operation.routeTemplate}`)
    .sort();
  const actualVariantIds = bundle.operations
    .flatMap((operation) =>
      operation.nativeRequestFixtures.map((request) => request.operationVariantId)
    )
    .sort();

  assert.deepEqual(actualOperationKeys, expectedOperationKeys);
  assert.deepEqual(actualVariantIds, expectedVariantIds);
  assert.equal(bundle.inventory.uniqueOperationCount, 83);
  assert.equal(bundle.inventory.nativeProducerCount, 93);
  assert.equal(bundle.inventory.matrixRowCount, 29);
});

test("backend inventory is pinned to an independent iOS source manifest without claiming Swift execution", () => {
  const bundle = buildBundle();
  const evidence = bundle.inventory.iosSourceEvidence;
  const rawManifest = readFileSync(evidence.manifestPath);
  assert.equal(createHash("sha256").update(rawManifest).digest("hex"), evidence.manifestSha256);
  assert.equal(evidence.iosBaseRevision, "92a5c351a42771f546b3d0e575b3b37a8cbfb588");
  assert.equal(evidence.iosSourceRevision, "bb7ca30041dd095dc36144611bea127f0b53099d");
  assert.equal(evidence.iosSourceRevisionPhase, "committed_contract_branch");
  assert.equal(evidence.backendRuntimeFactoryValidationPerformed, false);
  assert.equal(evidence.exactFactoryTestedProducerCount, 6);
  assert.equal(evidence.bundleSuccessDecoderTestedOperationCount, 24);
  assert.match(evidence.limitation, /does not inspect or instantiate Swift endpoint factories/);
});

test("generator is byte-deterministic and the checked-in artifact is current", () => {
  const first = serializeNativeContractBundle(buildBundle());
  const second = serializeNativeContractBundle(buildBundle());
  assert.equal(first, second);
  assert.equal(readFileSync(bundlePath, "utf8"), first);
});

test("an exact committed companion-branch revision can be recorded without claiming merge", () => {
  const head = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim();
  const bundle = buildNativeContractBundle(repoRoot, nativeContractOperationDefinitions, {
    sourceRevision: head,
    sourceRevisionPhase: "committed_backend_branch",
  });

  assert.equal(bundle.provenance.sourceRevision, head);
  assert.equal(bundle.provenance.sourceRevisionPhase, "committed_backend_branch");
});

test("an exact merged revision can be recorded for the post-merge iOS provenance gate", () => {
  const head = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim();
  const bundle = buildNativeContractBundle(repoRoot, nativeContractOperationDefinitions, {
    sourceRevision: head,
    sourceRevisionPhase: "merged_backend",
  });

  assert.equal(bundle.provenance.sourceRevision, head);
  assert.equal(bundle.provenance.sourceRevisionPhase, "merged_backend");
});

test("revision provenance requires a revision and phase together", () => {
  const head = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim();
  const revisionOnly = { sourceRevision: head } as unknown as NativeContractBuildOptions;
  const phaseOnly = {
    sourceRevisionPhase: "committed_backend_branch",
  } as unknown as NativeContractBuildOptions;

  assert.throws(
    () => buildNativeContractBundle(repoRoot, nativeContractOperationDefinitions, revisionOnly),
    /source revision and source revision phase must be provided together/
  );
  assert.throws(
    () => buildNativeContractBundle(repoRoot, nativeContractOperationDefinitions, phaseOnly),
    /source revision and source revision phase must be provided together/
  );
  assert.throws(
    () => parseNativeContractProvenanceEnvironment({ CONTRACT_SOURCE_REVISION: head }),
    /CONTRACT_SOURCE_REVISION and CONTRACT_SOURCE_REVISION_PHASE must be provided together/
  );
  assert.throws(
    () =>
      parseNativeContractProvenanceEnvironment({
        CONTRACT_SOURCE_REVISION_PHASE: "merged_backend",
      }),
    /CONTRACT_SOURCE_REVISION and CONTRACT_SOURCE_REVISION_PHASE must be provided together/
  );
  assert.throws(
    () =>
      parseNativeContractProvenanceEnvironment({
        CONTRACT_SOURCE_REVISION: head,
        CONTRACT_SOURCE_REVISION_PHASE: "uncommitted_backend",
      }),
    /must be committed_backend_branch or merged_backend/
  );
  assert.equal(parseNativeContractProvenanceEnvironment({}), undefined);
  assert.deepEqual(
    parseNativeContractProvenanceEnvironment({
      CONTRACT_SOURCE_REVISION: ` ${head} `,
      CONTRACT_SOURCE_REVISION_PHASE: " committed_backend_branch ",
    }),
    {
      sourceRevision: head,
      sourceRevisionPhase: "committed_backend_branch",
    }
  );
});

test("committed provenance retains the backend ancestry gate", () => {
  assert.throws(
    () =>
      buildNativeContractBundle(repoRoot, nativeContractOperationDefinitions, {
        sourceRevision: "f".repeat(40),
        sourceRevisionPhase: "committed_backend_branch",
      }),
    /contract source revision .* is not an ancestor of backend HEAD/
  );
});

test("covered routes and blocked backend candidates conform to source hashes and methods", () => {
  assertNativeContractSourceConformance(repoRoot, buildBundle());
});

test("mobile config golden is produced by the actual pure backend builder", () => {
  const bundle = buildBundle();
  const operation = bundle.operations.find((candidate) => candidate.id === "mobile-config.get");
  assert.ok(operation?.fixtures?.success.payload.kind === "json");
  const actual = buildIosAppConfig({
    APPLE_IAP_APP_APPLE_ID: "1234567890",
    IOS_STOREKIT_PRODUCT_IDS: "com.chapterflow.pro.monthly,com.chapterflow.pro.annual",
    IOS_APP_STORE_URL: "https://apps.apple.com/ca/app/chapterflow/id1234567890",
  });
  assert.deepEqual(operation.fixtures.success.payload.value, actual);
  assert.equal(operation.coverage, "partial");
  assert.deepEqual(operation.authority, {
    classification: "server_decision",
    expectedRequiredPointers: [
      "/minSupportedVersion",
      "/latestVersion",
      "/featureFlags",
      "/storeKitProductIds",
      "/appStoreURL",
      "/maintenanceMode",
    ],
    failureMode: "fail_closed",
  });
  assert.deepEqual(
    operation.fixtures.errors.find((error) => error.code === "ios_config_unavailable"),
    {
      status: 503,
      code: "ios_config_unavailable",
      headers: [],
      body: {
        error: {
          code: "ios_config_unavailable",
          message: "The iOS application configuration is temporarily unavailable.",
          requestId: "req_synthetic_mobile_config_get",
          details: {
            issues: [
              "missing_product_allowlist",
              "invalid_app_apple_id",
              "invalid_app_store_url",
            ],
          },
        },
      },
    }
  );
  assert.ok(
    operation.gaps.some((gap) => gap.kind === "client_authority_enforcement"),
    "mobile config must disclose the current native fail-open enforcement gap"
  );
});

test("all covered operations disclose selected-source, request-factory, and error-coverage gaps", () => {
  const covered = buildBundle().operations.filter((operation) => operation.coverage !== "blocked");
  assert.ok(covered.length > 0);
  assert.equal(covered.filter((operation) => operation.coverage === "full").length, 0);
  for (const operation of covered) {
    const kinds = new Set(operation.gaps.map((gap) => gap.kind));
    assert.ok(kinds.has("route_specific_error_coverage"), operation.id);
    assert.ok(kinds.has("native_request_fixture_proof"), operation.id);
    assert.ok(kinds.has("native_response_consumer_proof"), operation.id);
    assert.ok(kinds.has("source_dependency_closure"), operation.id);
  }
});

test("search-index fences its tracked producer but not the external S3 response object", () => {
  const searchIndex = buildBundle().operations.find(
    (operation) => operation.id === "search-index.get"
  );
  assert.ok(searchIndex?.backend);
  assert.ok(
    searchIndex.backend.sourceFiles.some(
      (source) =>
        source.path ===
          "app/app/api/book/admin/books/[bookId]/versions/[version]/publish/search-index-builder.ts" &&
        source.role === "response_builder"
    )
  );
  assert.equal(searchIndex.fixtures?.errors.length, 0);
  assert.ok(searchIndex.gaps.some((gap) => gap.kind === "external_response_asset"));
  assert.ok(searchIndex.gaps.some((gap) => gap.kind === "client_response_projection"));
  assert.match(searchIndex.responseContract.assetSemantics, /book-content\/library\/search-index\.json/);
  assert.ok(searchIndex.fixtures?.success.payload.kind === "json");
  assert.ok(Array.isArray(searchIndex.fixtures.success.payload.value));
  assert.deepEqual(searchIndex.fixtures.success.payload.value[0], {
    id: "book:book-synthetic",
    type: "book",
    bookId: "book-synthetic",
    bookTitle: "Synthetic Book",
    author: "Synthetic Author",
    text: "Synthetic Book by Synthetic Author",
    categories: ["Leadership"],
    tags: ["synthetic"],
  });
});

test("all missing-route blockers fail closed against their expected route path", () => {
  const missingRoutes = buildBundle().operations.filter(
    (operation) => operation.blocker?.kind === "missing_route"
  );
  assert.equal(missingRoutes.length, 8);
  for (const operation of missingRoutes) {
    assert.ok(operation.blocker?.expectedRouteSource, operation.id);
    assert.equal(existsSync(resolve(repoRoot, operation.blocker.expectedRouteSource)), false);
  }
});

test("drift canary rejects a changed route hash", () => {
  const drifted = structuredClone(buildBundle());
  const catalog = drifted.operations.find((operation) => operation.id === "catalog.get");
  assert.ok(catalog?.backend);
  catalog.backend.sourceFiles[0]!.sourceSha256 = "0".repeat(64);
  assert.throws(
    () => assertNativeContractSourceConformance(repoRoot, drifted),
    /catalog\.get source drift/
  );
});

test("authority canary rejects entitlement fixture key removal", () => {
  const drifted = structuredClone(buildBundle());
  const entitlement = drifted.operations.find(
    (operation) => operation.id === "entitlements.get"
  );
  assert.ok(entitlement?.fixtures?.success.payload.kind === "json");
  const body = entitlement.fixtures.success.payload.value as {
    entitlement: Record<string, unknown>;
  };
  delete body.entitlement.plan;
  assert.throws(() => assertNativeContractBundle(drifted), /authority field \/entitlement\/plan/);
});

test("authority canaries reject quiz unlock and mobile launch-control removal", () => {
  const quizDrift = structuredClone(buildBundle());
  const quiz = quizDrift.operations.find((operation) => operation.id === "quiz.get");
  assert.deepEqual(quiz?.authority, {
    classification: "server_decision",
    expectedRequiredPointers: ["/progress/unlockedThroughChapterNumber"],
    failureMode: "fail_closed",
  });
  assert.ok(quiz?.fixtures?.success.payload.kind === "json");
  const quizBody = quiz.fixtures.success.payload.value as {
    progress: Record<string, unknown>;
  };
  delete quizBody.progress.unlockedThroughChapterNumber;
  assert.throws(
    () => assertNativeContractBundle(quizDrift),
    /authority field \/progress\/unlockedThroughChapterNumber/
  );

  const configDrift = structuredClone(buildBundle());
  const config = configDrift.operations.find(
    (operation) => operation.id === "mobile-config.get"
  );
  assert.ok(config?.fixtures?.success.payload.kind === "json");
  const configBody = config.fixtures.success.payload.value as Record<string, unknown>;
  delete configBody.maintenanceMode;
  assert.throws(
    () => assertNativeContractBundle(configDrift),
    /authority field \/maintenanceMode/
  );
});

test("Retry-After gap is explicit instead of inventing headers", () => {
  const bundle = buildBundle();
  assert.deepEqual(bundle.retryAfterPolicy, {
    implemented: false,
    fixtureCount: 0,
    evidence: [
      "app/app/api/book/_lib/http.ts bookErr emits only the JSON error envelope",
      "behavior source revision 968ff67 has no native-route Retry-After header contract",
    ],
    gap: "Rate-limit responses do not currently define a stable Retry-After header, so no fixture is invented.",
  });
});

test("generated bundle contains synthetic/redacted data only", () => {
  const serialized = serializeNativeContractBundle(buildBundle());
  assert.doesNotMatch(serialized, /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  assert.doesNotMatch(serialized, /Bearer\s+(?!<)[A-Za-z0-9._~-]{20,}/);
  assert.doesNotMatch(serialized, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  assert.doesNotMatch(serialized, /https:\/\/[^"\s]*amazonaws\.com/i);
  assert.doesNotMatch(serialized, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/);
  assert.doesNotMatch(serialized, /(?:AKIA|ASIA|AIDA|AROA|AIPA|ANPA|ANVA)[A-Z0-9]{16}/);
  assert.doesNotMatch(
    serialized,
    /X-Amz-(?:Algorithm|Credential|Date|Expires|Security-Token|Signature|SignedHeaders)=/i
  );
  assert.doesNotMatch(
    serialized,
    /(?:sk_(?:live|test)|rk_live|whsec|ghp|github_pat|xox[baprs])_[A-Za-z0-9_-]{8,}/i
  );
  assert.doesNotMatch(serialized, /AIza[0-9A-Za-z_-]{20,}/);
  const urls = [...serialized.matchAll(/https:\/\/[^"\\\s]+/g)].map((match) => match[0]);
  assert.ok(urls.length > 0);
  for (const value of urls) {
    assert.ok(["example.invalid", "apps.apple.com"].includes(new URL(value).hostname), value);
  }
  assert.match(serialized, /synthetic/i);
});
