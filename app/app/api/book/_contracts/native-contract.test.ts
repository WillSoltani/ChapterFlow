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
  nativeContractExpectedMissingInputPaths,
  parseNativeContractProvenanceEnvironment,
  routeSourceExportsMethod,
  serializeNativeContractBundle,
  type NativeContractBuildOptions,
} from "./native-contract-generator-core";
import { parseIosSourceInventoryManifest } from "./native-contract-inventory-relations";
import { nativeContractOperationDefinitions } from "./native-contract-registry";
import {
  assertNativeContractBundle,
  type NativeContractBundle,
  type NativeContractOperationDefinition,
} from "./native-contract-types";

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
analytics-beacon.post:defaultanalyticsclient-path-beacon
analytics-track.post:defaultanalyticsclient-path-track
apple-verify.post:liveentitlementrepository-verifyappletransaction
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
scenario.post:scenariorepository-syncpendinguploads
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

const focusedRepositoryProvenance = {
  "reading-session.post": [
    "app/app/api/book/_lib/book-metrics-repo.ts",
    "app/app/api/book/_lib/progress-repo.ts",
    "app/app/api/book/_lib/user-settings-repo.ts",
  ],
  "reflection.post": ["app/app/api/book/_lib/flow-points-repo.ts"],
  "saved-toggle.post": ["app/app/api/book/_lib/saved-books-repo.ts"],
  "share-event.post": ["app/app/api/book/_lib/book-metrics-repo.ts"],
  "onboarding-complete.post": [
    "app/app/api/book/_lib/user-profile-repo.ts",
    "app/app/api/book/_lib/user-settings-repo.ts",
  ],
  "onboarding-progress.post": ["app/app/api/book/_lib/user-settings-repo.ts"],
  "scenario.post": [
    "app/app/api/book/_lib/book-metrics-repo.ts",
    "app/app/api/book/_lib/scenario-repo.ts",
  ],
  "commitment.post": ["app/app/api/book/_lib/commitment-repo.ts"],
  "book-state.patch": [
    "app/app/api/book/_lib/book-state-repo.ts",
    "app/app/api/book/_lib/progress-repo.ts",
  ],
  "settings.patch": ["app/app/api/book/_lib/user-settings-repo.ts"],
  "account-deactivate.post": [
    "app/app/api/book/_lib/account-repo.ts",
    "app/app/api/book/_lib/entitlement-repo.ts",
  ],
  "own-profile.get": [
    "app/app/api/book/_lib/user-profile-repo.ts",
    "app/app/api/book/_lib/user-settings-repo.ts",
  ],
  "progress.get": [
    "app/app/api/book/_lib/entitlement-repo.ts",
    "app/app/api/book/_lib/progress-repo.ts",
  ],
  "saved.get": ["app/app/api/book/_lib/saved-books-repo.ts"],
  "settings.get": ["app/app/api/book/_lib/user-settings-repo.ts"],
  "entitlements.get": ["app/app/api/book/_lib/entitlement-repo.ts"],
  "export.get": [
    "app/app/api/book/_lib/entitlement-repo.ts",
    "app/app/api/book/_lib/export-repo.ts",
    "app/app/api/book/_lib/user-profile-repo.ts",
    "app/app/api/book/_lib/user-settings-repo.ts",
  ],
  "gift-claim.post": ["app/app/api/book/_lib/gift-repo.ts"],
  "gift-preview.get": [
    "app/app/api/book/_lib/gift-repo.ts",
    "app/app/api/book/_lib/user-profile-repo.ts",
  ],
  "onboarding-progress.get": ["app/app/api/book/_lib/user-settings-repo.ts"],
  "badges.get": ["app/app/api/book/_lib/book-metrics-repo.ts"],
  "scenarios.get": [
    "app/app/api/book/_lib/book-metrics-repo.ts",
    "app/app/api/book/_lib/scenario-repo.ts",
  ],
  "book-state.get": [
    "app/app/api/book/_lib/book-state-repo.ts",
    "app/app/api/book/_lib/progress-repo.ts",
  ],
  "commitments.get": ["app/app/api/book/_lib/commitment-repo.ts"],
  "dashboard.get": [
    "app/app/api/book/_lib/book-metrics-repo.ts",
    "app/app/api/book/_lib/book-state-repo.ts",
    "app/app/api/book/_lib/entitlement-repo.ts",
    "app/app/api/book/_lib/progress-repo.ts",
    "app/app/api/book/_lib/saved-books-repo.ts",
    "app/app/api/book/_lib/user-profile-repo.ts",
    "app/app/api/book/_lib/user-settings-repo.ts",
  ],
} as const satisfies Record<string, readonly string[]>;

const canonicalBookPackageOperations = [
  "chapter.get",
  "concept-graph.get",
  "quiz-submit.post",
] as const;

const focusedMovedResponseBuilderProvenance = {
  "quiz-submit.post": [
    "app/app/api/book/_lib/quiz-session.ts",
    "app/app/api/book/_lib/quiz-submit-core.ts",
    "app/app/api/book/_lib/quiz-submit-service.ts",
  ],
  "gift-claim.post": ["app/app/api/book/_lib/gift-repo.ts"],
  "gift-preview.get": [
    "app/app/api/book/_lib/gift-repo.ts",
    "app/app/api/book/_lib/user-profile-repo.ts",
  ],
  "export.get": [
    "app/app/api/book/_lib/entitlement-repo.ts",
    "app/app/api/book/_lib/export-manifest-core.ts",
    "app/app/api/book/_lib/export-repo.ts",
    "app/app/api/book/_lib/user-profile-repo.ts",
    "app/app/api/book/_lib/user-settings-repo.ts",
  ],
} as const satisfies Record<string, readonly string[]>;

function assertFocusedNativeContractProvenance(
  definitions: NativeContractOperationDefinition[]
): void {
  for (const [operationId, expectedPaths] of Object.entries(focusedRepositoryProvenance)) {
    const operation = definitions.find((candidate) => candidate.id === operationId);
    const evidence = operation?.backend ?? operation?.blocker?.backendCandidate;
    if (!evidence) throw new Error(`${operationId} is missing backend provenance`);

    const actualPaths = evidence.sourceFiles
      .filter(
        (source) =>
          source.role === "response_builder" &&
          (source.path.endsWith("-repo.ts") || source.path.endsWith("/_lib/repo.ts"))
      )
      .map((source) => source.path)
      .sort();
    const expectedSorted = [...expectedPaths].sort();
    if (
      actualPaths.length !== expectedSorted.length ||
      actualPaths.some((path, index) => path !== expectedSorted[index])
    ) {
      throw new Error(
        `${operationId} repository provenance mismatch: expected ${expectedSorted.join(", ")}; got ${actualPaths.join(", ")}`
      );
    }
  }

  for (const [operationId, expectedPaths] of Object.entries(
    focusedMovedResponseBuilderProvenance,
  )) {
    const operation = definitions.find((candidate) => candidate.id === operationId);
    const evidence = operation?.backend ?? operation?.blocker?.backendCandidate;
    if (!evidence) throw new Error(`${operationId} is missing backend provenance`);

    const actualPaths = evidence.sourceFiles
      .filter((source) => source.role === "response_builder")
      .map((source) => source.path)
      .sort();
    const expectedSorted = [...expectedPaths].sort();
    if (
      actualPaths.length !== expectedSorted.length ||
      actualPaths.some((path, index) => path !== expectedSorted[index])
    ) {
      throw new Error(
        `${operationId} moved response-builder provenance mismatch: expected ${expectedSorted.join(", ")}; got ${actualPaths.join(", ")}`,
      );
    }
  }

  const shimFences = definitions.flatMap((operation) => {
    const evidence = operation.backend ?? operation.blocker?.backendCandidate;
    return evidence?.sourceFiles.some(
      (source) =>
        source.path === "app/app/api/book/_lib/repo.ts" && source.role === "response_builder"
    )
      ? [operation.id]
      : [];
  });
  if (shimFences.length > 0) {
    throw new Error(`export-only repo.ts response-builder fences remain: ${shimFences.join(", ")}`);
  }

  for (const operationId of canonicalBookPackageOperations) {
    const operation = definitions.find((candidate) => candidate.id === operationId);
    const evidence = operation?.backend ?? operation?.blocker?.backendCandidate;
    const hasCanonicalSchema = evidence?.sourceFiles.some(
      (source) => source.path === "lib/book-package-types.ts" && source.role === "schema"
    );
    if (!hasCanonicalSchema) {
      throw new Error(`${operationId} is missing canonical BookPackage schema evidence`);
    }
  }
}

test("focused native operations use exact repositories and canonical BookPackage evidence", () => {
  assert.doesNotThrow(() =>
    assertFocusedNativeContractProvenance(nativeContractOperationDefinitions)
  );
});

test("focused provenance canary rejects missing, extra, moved, shim, and canonical-schema drift", () => {
  const missing = structuredClone(nativeContractOperationDefinitions);
  const readingSession = missing.find((operation) => operation.id === "reading-session.post");
  assert.ok(readingSession?.backend);
  readingSession.backend.sourceFiles = readingSession.backend.sourceFiles.filter(
    (source) => source.path !== "app/app/api/book/_lib/progress-repo.ts"
  );
  assert.throws(
    () => assertFocusedNativeContractProvenance(missing),
    /reading-session\.post repository provenance mismatch/
  );

  const extra = structuredClone(nativeContractOperationDefinitions);
  const saved = extra.find((operation) => operation.id === "saved.get");
  assert.ok(saved?.backend);
  saved.backend.sourceFiles.push({
    path: "app/app/api/book/_lib/progress-repo.ts",
    role: "response_builder",
  });
  assert.throws(
    () => assertFocusedNativeContractProvenance(extra),
    /saved\.get repository provenance mismatch/
  );

  const moved = structuredClone(nativeContractOperationDefinitions);
  const quizSubmit = moved.find((operation) => operation.id === "quiz-submit.post");
  assert.ok(quizSubmit?.backend);
  quizSubmit.backend.sourceFiles = quizSubmit.backend.sourceFiles.filter(
    (source) => source.path !== "app/app/api/book/_lib/quiz-submit-service.ts"
  );
  assert.throws(
    () => assertFocusedNativeContractProvenance(moved),
    /quiz-submit\.post moved response-builder provenance mismatch/
  );

  const shim = structuredClone(nativeContractOperationDefinitions);
  const reflection = shim.find((operation) => operation.id === "reflection.post");
  assert.ok(reflection?.backend);
  reflection.backend.sourceFiles.push({
    path: "app/app/api/book/_lib/repo.ts",
    role: "response_builder",
  });
  assert.throws(
    () => assertFocusedNativeContractProvenance(shim),
    /reflection\.post repository provenance mismatch|export-only repo\.ts/
  );

  const schema = structuredClone(nativeContractOperationDefinitions);
  const chapter = schema.find((operation) => operation.id === "chapter.get");
  assert.ok(chapter?.backend);
  chapter.backend.sourceFiles = chapter.backend.sourceFiles.filter(
    (source) => source.path !== "lib/book-package-types.ts"
  );
  assert.throws(
    () => assertFocusedNativeContractProvenance(schema),
    /chapter\.get is missing canonical BookPackage schema evidence/
  );
});

test("native inventory equals the verified 83-operation / 92-producer iOS source inventory", () => {
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
  assert.equal(bundle.inventory.nativeProducerCount, 92);
  assert.equal(bundle.inventory.matrixRowCount, 29);
  assert.equal(bundle.operations.filter((operation) => operation.coverage === "partial").length, 61);
  assert.equal(bundle.operations.filter((operation) => operation.coverage === "blocked").length, 22);
});

test("shared expected-missing route paths form a unique provenance input set", () => {
  const paths = nativeContractExpectedMissingInputPaths(nativeContractOperationDefinitions);
  const missingRouteOperationCount = nativeContractOperationDefinitions.filter(
    (operation) => operation.blocker?.kind === "missing_route"
  ).length;

  assert.equal(new Set(paths).size, paths.length);
  assert.ok(paths.length < missingRouteOperationCount);
});

test("relational inventory rejects producer reassignment with unchanged counts", () => {
  const definitions = structuredClone(nativeContractOperationDefinitions);
  const track = definitions.find((operation) => operation.id === "analytics-track.post");
  const beacon = definitions.find((operation) => operation.id === "analytics-beacon.post");
  assert.ok(track && beacon);
  const trackRequests = track.nativeRequestFixtures;
  track.nativeRequestFixtures = beacon.nativeRequestFixtures;
  beacon.nativeRequestFixtures = trackRequests;

  assert.throws(
    () => buildNativeContractBundle(repoRoot, definitions),
    /relational inventory.*analytics/i
  );
});

test("relational inventory rejects operation-to-matrix reassignment", () => {
  const definitions = structuredClone(nativeContractOperationDefinitions);
  const commitment = definitions.find((operation) => operation.id === "commitment.get");
  assert.ok(commitment);
  commitment.matrixRowId = "catalog";

  assert.throws(
    () => buildNativeContractBundle(repoRoot, definitions),
    /relational inventory[\s\S]*commitment\.get/i
  );
});

test("relational inventory rejects duplicate and removed producer membership", () => {
  const duplicated = structuredClone(nativeContractOperationDefinitions);
  const duplicatedBook = duplicated.find((operation) => operation.id === "book-detail.get");
  assert.ok(duplicatedBook);
  duplicatedBook.nativeRequestFixtures.push(
    structuredClone(duplicatedBook.nativeRequestFixtures[0])
  );
  assert.throws(
    () => buildNativeContractBundle(repoRoot, duplicated),
    /relational inventory.*duplicate backend variant.*book-detail\.get:getbook/i
  );

  const removed = structuredClone(nativeContractOperationDefinitions);
  const removedBook = removed.find((operation) => operation.id === "book-detail.get");
  assert.ok(removedBook);
  removedBook.nativeRequestFixtures.pop();
  assert.throws(
    () => buildNativeContractBundle(repoRoot, removed),
    /relational inventory[\s\S]*missing backend variant[\s\S]*getmanifestfordownload/i
  );
});

test("relational inventory rejects method and route reassignment", () => {
  const methodDrift = structuredClone(nativeContractOperationDefinitions);
  const methodCommitment = methodDrift.find((operation) => operation.id === "commitment.get");
  assert.ok(methodCommitment);
  methodCommitment.method = "POST";
  assert.throws(
    () => buildNativeContractBundle(repoRoot, methodDrift),
    /relational inventory[\s\S]*commitment\.get:getcommitment\.method[\s\S]*iOS=GET backend=POST/i
  );

  const routeDrift = structuredClone(nativeContractOperationDefinitions);
  const routeCommitment = routeDrift.find((operation) => operation.id === "commitment.get");
  assert.ok(routeCommitment);
  routeCommitment.routeTemplate = "/book/me/commitments/{commitmentId}/history";
  assert.throws(
    () => buildNativeContractBundle(repoRoot, routeDrift),
    /relational inventory[\s\S]*commitment\.get:getcommitment\.routeTemplate/i
  );
});

test("relational inventory rejects producer symbol and source-path reassignment", () => {
  const symbolDrift = structuredClone(nativeContractOperationDefinitions);
  const symbolCommitment = symbolDrift.find((operation) => operation.id === "commitment.get");
  assert.ok(symbolCommitment);
  symbolCommitment.nativeRequestFixtures[0].producerEvidence = [
    "getOtherCommitment@Packages/Networking/Sources/Networking/Endpoint.swift:502",
  ];
  assert.throws(
    () => buildNativeContractBundle(repoRoot, symbolDrift),
    /relational inventory.*commitment\.get.*does not match producer getOtherCommitment/i
  );

  const sourceDrift = structuredClone(nativeContractOperationDefinitions);
  const sourceCommitment = sourceDrift.find((operation) => operation.id === "commitment.get");
  assert.ok(sourceCommitment);
  sourceCommitment.nativeRequestFixtures[0].producerEvidence = [
    "getCommitment@Packages/Networking/Sources/Networking/Endpoint+Other.swift:502",
  ];
  assert.throws(
    () => buildNativeContractBundle(repoRoot, sourceDrift),
    /relational inventory[\s\S]*commitment\.get:getcommitment\.producerSourcePath/i
  );
});

test("relational inventory rejects variant and derived stable-suffix reassignment", () => {
  const variantDrift = structuredClone(nativeContractOperationDefinitions);
  const variantCommitment = variantDrift.find((operation) => operation.id === "commitment.get");
  assert.ok(variantCommitment);
  variantCommitment.nativeRequestFixtures[0].operationVariantId =
    "commitment.get:getothercommitment";
  assert.throws(
    () => buildNativeContractBundle(repoRoot, variantDrift),
    /relational inventory.*commitment\.get.*getothercommitment.*getCommitment/i
  );

  const suffixDrift = structuredClone(nativeContractOperationDefinitions);
  const suffixCommitment = suffixDrift.find((operation) => operation.id === "commitment.get");
  assert.ok(suffixCommitment);
  suffixCommitment.nativeRequestFixtures[0].producerEvidence = [
    "getOtherCommitment@Packages/Networking/Sources/Networking/Endpoint.swift:502",
  ];
  suffixCommitment.nativeRequestFixtures[0].operationVariantId =
    "commitment.get:getothercommitment";
  assert.throws(
    () => buildNativeContractBundle(repoRoot, suffixDrift),
    /relational inventory[\s\S]*missing backend variant[\s\S]*getcommitment[\s\S]*unexpected backend variant[\s\S]*getothercommitment/i
  );
});

test("relational inventory normalizes only a terminal numeric evidence line", () => {
  const lineOnlyDrift = structuredClone(nativeContractOperationDefinitions);
  const commitment = lineOnlyDrift.find((operation) => operation.id === "commitment.get");
  assert.ok(commitment);
  commitment.nativeRequestFixtures[0].producerEvidence = [
    "getCommitment@Packages/Networking/Sources/Networking/Endpoint.swift:999",
  ];
  assert.doesNotThrow(() => buildNativeContractBundle(repoRoot, lineOnlyDrift));

  const unsafeSuffix = structuredClone(nativeContractOperationDefinitions);
  const unsafeCommitment = unsafeSuffix.find((operation) => operation.id === "commitment.get");
  assert.ok(unsafeCommitment);
  unsafeCommitment.nativeRequestFixtures[0].producerEvidence = [
    "getCommitment@Packages/Networking/Sources/Networking/Endpoint.swift:502:extra",
  ];
  assert.throws(
    () => buildNativeContractBundle(repoRoot, unsafeSuffix),
    /relational inventory.*must end in one numeric source line/i
  );
});

test("matrix summary must exactly equal operation matrix membership", () => {
  const drifted = structuredClone(buildBundle());
  const catalog = drifted.inventory.matrixRows.find((row) => row.id === "catalog");
  assert.ok(catalog);
  catalog.operationIds = ["account-delete.post"];

  assert.throws(
    () => assertNativeContractBundle(drifted),
    /matrix.*membership/i
  );
});

test("iOS manifest matrix summary and relational digest are recomputed", () => {
  const manifestPath = "contracts/native-ios/v1/ios-source-inventory-manifest.json";
  const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    relationalRecordSha256: string;
    sourceInputTreeSha256: string;
    sourceInputs: Array<{ path: string; sha256: string }>;
    matrixRows: Array<{ id: string; operationIds: string[] }>;
  };
  const driftedRows = structuredClone(parsed);
  const catalog = driftedRows.matrixRows.find((row) => row.id === "catalog");
  assert.ok(catalog);
  catalog.operationIds = ["account-delete.post"];
  assert.throws(
    () => parseIosSourceInventoryManifest(driftedRows),
    /relational inventory matrix summary does not exactly match its records/i
  );

  const driftedDigest = structuredClone(parsed);
  driftedDigest.relationalRecordSha256 = "0".repeat(64);
  assert.throws(
    () => parseIosSourceInventoryManifest(driftedDigest),
    /relational inventory records are duplicated, unsorted, or have an invalid digest/i
  );

  const omittedSource = structuredClone(parsed);
  omittedSource.sourceInputs = omittedSource.sourceInputs.filter(
    (input) => input.path !== "Packages/Networking/Sources/Networking/Endpoint.swift"
  );
  omittedSource.sourceInputTreeSha256 = createHash("sha256")
    .update(
      `${omittedSource.sourceInputs
        .map((input) => `${input.path}\t${input.sha256}`)
        .sort()
        .join("\n")}\n`
    )
    .digest("hex");
  assert.throws(
    () => parseIosSourceInventoryManifest(omittedSource),
    /source input tree omits required input: Packages\/Networking\/Sources\/Networking\/Endpoint\.swift/i
  );
});

test("recent-auth routes that bypass the active-user guard use the precise auth class", () => {
  const bundle = buildBundle();
  for (const operationId of ["account-delete.post", "export.get"]) {
    const operation = bundle.operations.find((candidate) => candidate.id === operationId);
    assert.equal(operation?.auth.class, "recent_auth_user", operationId);
    const evidence = operation?.backend ?? operation?.blocker?.backendCandidate;
    assert.ok(evidence, operationId);
    assert.ok(
      evidence.sourceFiles.some(
        (source) =>
          source.path === "app/app/api/book/_lib/account-guard.ts" &&
          source.role === "auth_policy"
      ),
      `${operationId} must fence the intentional active-account bypass policy`
    );
    assert.equal(
      evidence.sourceFiles.some(
        (source) =>
          source.path === "app/app/api/book/_lib/account-guard.ts" && source.role === "auth"
      ),
      false,
      `${operationId} must not claim active-account guard enforcement`
    );
  }
});

test("every blocker has closed resolution ownership and decision metadata", () => {
  const blocked = buildBundle().operations.filter((operation) => operation.coverage === "blocked");
  assert.equal(blocked.length, 22);
  const validOwners = new Set([
    "ios",
    "backend",
    "coordinated",
    "product_or_security_decision",
  ]);
  for (const operation of blocked) {
    const resolution = (operation.blocker as unknown as {
      resolution?: {
        owner?: string;
        rationale?: string;
        dependency?: string;
        decisionRequired?: boolean;
        unresolvedDecision?: string | null;
      };
    } | undefined)?.resolution;
    assert.ok(resolution, operation.id);
    assert.ok(validOwners.has(resolution.owner ?? ""), operation.id);
    assert.ok(resolution.rationale?.trim(), operation.id);
    assert.ok(resolution.dependency?.trim(), operation.id);
    assert.equal(typeof resolution.decisionRequired, "boolean", operation.id);
    if (resolution.owner === "product_or_security_decision") {
      assert.equal(resolution.decisionRequired, true, operation.id);
      assert.ok(resolution.unresolvedDecision?.trim(), operation.id);
    }
  }
});

test("authority metadata separates structural, production-consumer, and blocked proof", () => {
  const bundle = buildBundle() as NativeContractBundle & {
    authorityProofSummary?: {
      structuralFixtureVerifiedOperationCount: number;
      productionConsumerVerifiedOperationCount: number;
      blockedOrUnprovenOperationCount: number;
    };
  };
  assert.deepEqual(bundle.authorityProofSummary, {
    structuralFixtureVerifiedOperationCount: 52,
    productionConsumerVerifiedOperationCount: 4,
    blockedOrUnprovenOperationCount: 0,
  });

  const expectedProductionConsumers = new Map([
    ["chapter.get", "models.chapter-progress.authority-deletion"],
    ["quiz.get", "models.quiz-progress.authority-deletion"],
    ["entitlements.get", "models.entitlement.authority-deletion"],
    ["own-profile.get", "social.own-profile-identity.authority-deletion"],
  ]);
  for (const operation of bundle.operations) {
    const proof = (operation.authority as unknown as {
      proof?: { level?: string; productionConsumerTestIds?: string[] };
    }).proof;
    assert.ok(proof, operation.id);
    const expectedTest = expectedProductionConsumers.get(operation.id);
    if (expectedTest) {
      assert.equal(proof.level, "production_consumer_verified", operation.id);
      assert.deepEqual(proof.productionConsumerTestIds, [expectedTest], operation.id);
      assert.equal(
        operation.gaps.some((gap) => gap.kind === "native_authority_consumer_proof"),
        false,
        operation.id
      );
    } else if (proof.level === "structural_fixture_only") {
      const gap = operation.gaps.find(
        (candidate) => candidate.kind === "native_authority_consumer_proof"
      );
      assert.equal(gap?.owner, "ios", operation.id);
      assert.ok(gap?.dependency?.trim(), operation.id);
      for (const pointer of operation.authority.expectedRequiredPointers) {
        assert.ok(gap?.reason.includes(pointer), operation.id);
      }
    }
  }
  const submit = bundle.operations.find((operation) => operation.id === "quiz-submit.post");
  assert.equal(submit?.coverage, "partial");
  assert.equal(submit?.blocker, undefined);
  assert.equal(
    (submit?.authority as unknown as { proof?: { level?: string } }).proof?.level,
    "structural_fixture_only"
  );
  assert.deepEqual(submit?.authority.expectedRequiredPointers, [
    "/quiz/result/passed",
    "/quiz/result/scorePercent",
    "/quiz/unlockedNextChapter",
    "/quiz/cooldownSeconds",
    "/quiz/nextAttemptAvailableAt",
  ]);
  assert.equal(submit?.nativeRequestFixtures.length, 1);
  assert.equal(
    submit?.nativeRequestFixtures[0]?.operationVariantId,
    "quiz-submit.post:submitquiz-online"
  );
  assert.deepEqual(submit?.nativeRequestFixtures[0]?.body, {
    kind: "json",
    value: {
      attemptNumber: 1,
      responses: [
        {
          questionId: "question-synthetic-1",
          selectedChoiceId: "choice-a",
        },
      ],
    },
  });
  assert.equal(submit?.idempotency.class, "unknown");
  assert.match(submit?.idempotency.notes ?? "", /not replay-idempotent/i);
  assert.ok(submit?.fixtures?.success.payload.kind === "json");
  const submitPayload = submit.fixtures.success.payload.value as {
    quiz?: {
      result?: { passed?: boolean; scorePercent?: number };
      unlockedNextChapter?: boolean;
      cooldownSeconds?: number;
      nextAttemptAvailableAt?: string | null;
    };
    progress?: { unlockedThroughChapterNumber?: number };
  };
  assert.equal(submitPayload.quiz?.result?.passed, true);
  assert.equal(submitPayload.quiz?.result?.scorePercent, 100);
  assert.equal(submitPayload.quiz?.unlockedNextChapter, true);
  assert.equal(submitPayload.quiz?.cooldownSeconds, 0);
  assert.equal(submitPayload.quiz?.nextAttemptAvailableAt, null);
  assert.equal(submitPayload.progress?.unlockedThroughChapterNumber, 2);
  assert.ok(
    submit.fixtures.errors.some(
      (error) => error.status === 409 && error.code === "quiz_session_stale"
    )
  );
  const submitAuthorityGap = submit?.gaps.find(
    (gap) => gap.kind === "native_authority_consumer_proof"
  );
  assert.equal(submitAuthorityGap?.owner, "ios");
  assert.equal(submitAuthorityGap?.dependency, "WP-CONTRACT-01 iOS authority-consumer follow-up");
  assert.match(
    submitAuthorityGap?.reason ?? "",
    /\/quiz\/result\/passed.*\/quiz\/result\/scorePercent.*\/quiz\/unlockedNextChapter/
  );
});

test("own-profile identity fixture follows the production identity.sub contract", () => {
  const operation = buildBundle().operations.find((candidate) => candidate.id === "own-profile.get");
  assert.ok(operation?.fixtures?.success.payload.kind === "json");
  const root = operation.fixtures.success.payload.value as {
    identity?: Record<string, unknown>;
  };
  assert.equal(root.identity?.sub, "user-synthetic");
  assert.equal("userId" in (root.identity ?? {}), false);
  assert.deepEqual(operation.authority.expectedRequiredPointers, ["/identity/sub"]);
});

test("backend inventory is pinned to an independent iOS source manifest without claiming Swift execution", () => {
  const bundle = buildBundle();
  const evidence = bundle.inventory.iosSourceEvidence;
  const rawManifest = readFileSync(evidence.manifestPath);
  const manifest = JSON.parse(rawManifest.toString("utf8")) as {
    schemaVersion?: string;
    records?: unknown[];
    matrixRows?: unknown[];
    relationalRecordCount?: number;
    relationalRecordSha256?: string;
  };
  assert.equal(createHash("sha256").update(rawManifest).digest("hex"), evidence.manifestSha256);
  assert.equal(manifest.schemaVersion, "chapterflow-ios-native-inventory-v2");
  assert.equal(evidence.manifestSchemaVersion, "chapterflow-ios-native-inventory-v2");
  assert.equal(manifest.records?.length, 92);
  assert.equal(manifest.matrixRows?.length, 29);
  assert.equal(manifest.relationalRecordCount, 92);
  assert.equal(manifest.relationalRecordSha256, evidence.relationalRecordSha256);
  assert.equal(evidence.iosBaseRevision, "92a5c351a42771f546b3d0e575b3b37a8cbfb588");
  assert.equal(evidence.iosSourceRevisionPhase, "committed_contract_branch");
  assert.match(evidence.iosSourceRevision ?? "", /^[0-9a-f]{40}$/);
  assert.equal(evidence.backendRuntimeFactoryValidationPerformed, false);
  assert.equal(evidence.exactFactoryTestedProducerCount, 6);
  assert.equal(evidence.bundleSuccessDecoderTestedOperationCount, 24);
  assert.equal(evidence.relationalRecordCount, 92);
  assert.equal(evidence.matrixRowCount, 29);
  assert.match(evidence.producerIdentitySha256, /^[0-9a-f]{64}$/);
  assert.match(evidence.sourceInputTreeSha256, /^[0-9a-f]{64}$/);
  assert.match(evidence.limitation, /does not replace or regenerate iOS inventory authority/);
});

test("generator is byte-deterministic and the checked-in artifact is current", () => {
  const first = serializeNativeContractBundle(buildBundle());
  const second = serializeNativeContractBundle(buildBundle());
  assert.equal(first, second);
  assert.equal(readFileSync(bundlePath, "utf8"), first);
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
  const mainOnly = {
    trustedMainRef: "refs/remotes/origin/main",
  } as unknown as NativeContractBuildOptions;

  assert.throws(
    () => buildNativeContractBundle(repoRoot, nativeContractOperationDefinitions, revisionOnly),
    /source revision, source revision phase, and trusted main ref must be provided together/
  );
  assert.throws(
    () => buildNativeContractBundle(repoRoot, nativeContractOperationDefinitions, phaseOnly),
    /source revision, source revision phase, and trusted main ref must be provided together/
  );
  assert.throws(
    () => buildNativeContractBundle(repoRoot, nativeContractOperationDefinitions, mainOnly),
    /source revision, source revision phase, and trusted main ref must be provided together/
  );
  assert.throws(
    () => parseNativeContractProvenanceEnvironment({ CONTRACT_SOURCE_REVISION: head }),
    /CONTRACT_SOURCE_REVISION, CONTRACT_SOURCE_REVISION_PHASE, and CONTRACT_TRUSTED_MAIN_REF must be provided together/
  );
  assert.throws(
    () =>
      parseNativeContractProvenanceEnvironment({
        CONTRACT_SOURCE_REVISION_PHASE: "merged_backend",
      }),
    /CONTRACT_SOURCE_REVISION, CONTRACT_SOURCE_REVISION_PHASE, and CONTRACT_TRUSTED_MAIN_REF must be provided together/
  );
  assert.throws(
    () =>
      parseNativeContractProvenanceEnvironment({
        CONTRACT_SOURCE_REVISION: head,
        CONTRACT_SOURCE_REVISION_PHASE: "uncommitted_backend",
        CONTRACT_TRUSTED_MAIN_REF: "refs/remotes/origin/main",
      }),
    /must be committed_backend_branch or merged_backend/
  );
  assert.equal(parseNativeContractProvenanceEnvironment({}), undefined);
  assert.deepEqual(
    parseNativeContractProvenanceEnvironment({
      CONTRACT_SOURCE_REVISION: ` ${head} `,
      CONTRACT_SOURCE_REVISION_PHASE: " committed_backend_branch ",
      CONTRACT_TRUSTED_MAIN_REF: " refs/remotes/origin/main ",
    }),
    {
      sourceRevision: head,
      sourceRevisionPhase: "committed_backend_branch",
      trustedMainRef: "refs/remotes/origin/main",
    }
  );
});

test("covered routes and blocked backend candidates conform to source hashes and methods", () => {
  assertNativeContractSourceConformance(repoRoot, buildBundle());
});

test("route-method source fence rejects comment and string decoys", () => {
  const decoys = [
    {
      name: "line comment",
      source: "// export async function GET() {}\nexport async function POST() {}\n",
    },
    {
      name: "block comment",
      source: "/* export async function GET() {} */\nexport async function POST() {}\n",
    },
    {
      name: "string literal",
      source: 'const decoy = "export async function GET() {}";\nexport async function POST() {}\n',
    },
    {
      name: "template literal",
      source: "const decoy = `export async function GET() {}`;\nexport async function POST() {}\n",
    },
  ];

  for (const decoy of decoys) {
    assert.equal(routeSourceExportsMethod(decoy.source, "GET"), false, decoy.name);
  }
});

test("route-method source fence rejects real exported method drift", () => {
  const source = "export async function POST() {}\n";

  assert.equal(routeSourceExportsMethod(source, "GET"), false);
  assert.equal(routeSourceExportsMethod(source, "POST"), true);
});

test("route-method source fence requires a runnable named export", () => {
  assert.equal(
    routeSourceExportsMethod("export declare function GET(): Response;\n", "GET"),
    false
  );
  assert.equal(routeSourceExportsMethod("export default function GET() {}\n", "GET"), false);
  assert.equal(routeSourceExportsMethod("export function GET() {}\n", "GET"), true);
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
  assert.deepEqual({
    classification: operation.authority.classification,
    expectedRequiredPointers: operation.authority.expectedRequiredPointers,
    failureMode: operation.authority.failureMode,
  }, {
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
  assert.equal(operation.authority.proof.level, "structural_fixture_only");
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

test("book-state success requires an authoritative closed stateStatus", () => {
  const bundle = buildBundle();
  const operation = bundle.operations.find(
    (candidate) => candidate.id === "book-state.get"
  );
  assert.ok(operation?.fixtures?.success.payload.kind === "json");
  const body = operation.fixtures.success.payload.value as Record<string, unknown>;

  assert.equal(body.stateStatus, "started");
  assert.deepEqual(Object.keys(body).sort(), [
    "applicationStates",
    "state",
    "stateStatus",
  ]);
  assert.equal(operation.coverage, "partial");
  assert.equal(operation.idempotency.class, "safe_read");
  assert.deepEqual(operation.backend?.serializerProof, {
    kind: "executed_pure_builder",
    module: "app/app/api/book/_lib/book-state-status-core.ts",
    exportedSymbol: "buildBookStateGetResponse",
    fixtureId: "book-state.get:success",
  });
  assert.ok(operation.authority.expectedRequiredPointers.includes("/stateStatus"));
  assert.ok(
    operation.backend?.sourceFiles.some(
      (source) =>
        source.path === "app/app/api/book/_lib/book-state-status-core.ts" &&
        source.role === "response_builder"
    )
  );
  assert.ok(
    operation.backend?.sourceFiles.some(
      (source) =>
        source.path === "app/app/api/book/_lib/content-service.ts" &&
        source.role === "response_builder"
    )
  );
  assert.deepEqual(
    operation.fixtures.errors
      .filter((error) => error.status === 404)
      .map((error) => error.code)
      .sort(),
    ["book_not_found", "book_version_not_found"]
  );
  assert.equal(bundle.inventory.uniqueOperationCount, 83);
  assert.equal(bundle.inventory.nativeProducerCount, 92);
  assert.equal(bundle.inventory.matrixRowCount, 29);

  const missing = structuredClone(bundle);
  const missingOperation = missing.operations.find(
    (candidate) => candidate.id === "book-state.get"
  );
  assert.ok(missingOperation?.fixtures?.success.payload.kind === "json");
  delete (missingOperation.fixtures.success.payload.value as Record<string, unknown>)
    .stateStatus;
  assert.throws(
    () => assertNativeContractBundle(missing),
    /book-state\.get.*stateStatus/
  );

  const invalid = structuredClone(bundle);
  const invalidOperation = invalid.operations.find(
    (candidate) => candidate.id === "book-state.get"
  );
  assert.ok(invalidOperation?.fixtures?.success.payload.kind === "json");
  (invalidOperation.fixtures.success.payload.value as Record<string, unknown>)
    .stateStatus = "maybe";
  assert.throws(
    () => assertNativeContractBundle(invalid),
    /book-state\.get.*stateStatus/
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
  assert.deepEqual({
    classification: quiz?.authority.classification,
    expectedRequiredPointers: quiz?.authority.expectedRequiredPointers,
    failureMode: quiz?.authority.failureMode,
  }, {
    classification: "server_decision",
    expectedRequiredPointers: ["/progress/unlockedThroughChapterNumber"],
    failureMode: "fail_closed",
  });
  assert.equal(quiz?.authority.proof.level, "production_consumer_verified");
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
      "app/app/api/book/_lib/http.ts withBookApiErrors sets a Retry-After header only on the 503 throttled path (classifyRetryableAwsError)",
      "behavior source revision 968ff67 has no native-route Retry-After header contract for any other error",
    ],
    gap: "Only the AWS-throttle 503 sets Retry-After today; per-operation native fixtures for it, and for a 429 rate_limited Retry-After, are not yet captured.",
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
