import type {
  JsonValue,
  NativeContractAuthClass,
  NativeContractBackendCandidateDefinition,
  NativeContractBlockerOwner,
  NativeContractErrorFixture,
  NativeContractMethod,
  NativeContractOperationDefinition,
  NativeContractRequestBody,
  NativeContractRequestFixture,
  NativeContractResponsePayload,
  NativeContractSourceFileDefinition,
} from "./native-contract-types";
import { buildBookStateGetResponse } from "../_lib/book-state-status-core";

type RequestSeed = {
  producer: string;
  pathParameters?: Record<string, string | number | boolean | null>;
  queryItems?: Array<{ name: string; value: string | number | boolean | null }>;
  body?: NativeContractRequestBody;
  compatibility?: "canonical" | "client_drift";
  notes?: string;
};

type OperationSeed = {
  id: string;
  method: NativeContractMethod;
  routeTemplate: string;
  matrixRowId?: string;
  auth?: NativeContractAuthClass;
  credential?: "none" | "Authorization: Bearer <Cognito id_token>" | "conditional_bearer";
  requests: RequestSeed[];
  callSites: string[];
  iosModels: string[];
  decoder?: string;
  cacheNotes: string;
  idempotencyNotes: string;
  responseBody?: NativeContractResponsePayload;
  successStatus?: number;
  responseHeaders?: Array<{ name: string; value: string }>;
  routeSource?: string;
  responseSources?: NativeContractSourceFileDefinition[];
  serializerProof?: NativeContractOperationDefinition["backend"] extends infer Backend
    ? Backend extends { serializerProof: infer Proof }
      ? Proof
      : never
    : never;
  full?: boolean;
  authority?: {
    classification: "identity" | "entitlement" | "server_decision" | "private_data";
    pointers: string[];
  };
  versionSemantics?: string;
  assetSemantics?: string;
  pagination?: string;
  optionality?: string;
  aliases?: NonNullable<NativeContractOperationDefinition["fixtures"]>["deployedCompatibleSuccessAliases"];
  additionalGaps?: NativeContractOperationDefinition["gaps"];
  additionalErrorFixtures?: NativeContractErrorFixture[];
  canonicalErrorEnvelope?: boolean;
};

type BlockedSeed = Omit<OperationSeed, "responseBody" | "routeSource"> & {
  blocker: {
    kind: NonNullable<NativeContractOperationDefinition["blocker"]>["kind"];
    reason: string;
    evidence: string[];
    candidate?: {
      routeSource: string;
      methods: NativeContractMethod[];
    };
  };
};

const AUTH_SOURCE = "app/app/api/_lib/auth.ts";
const ACTIVE_USER_SOURCE = "app/app/api/book/_lib/account-guard.ts";
const ERROR_SOURCE = "app/app/api/book/_lib/http.ts";

type BlockerResolution = {
  owner: NativeContractBlockerOwner;
  rationale: string;
  dependency: string;
  decisionRequired: boolean;
  unresolvedDecision: string | null;
};

const BLOCKER_RESOLUTIONS: Record<string, BlockerResolution> = {
  "analytics-track.post": {
    owner: "product_or_security_decision",
    rationale: "The telemetry taxonomy, payload allowlist, consent boundary, and data minimization rule must be approved before either client or server shape changes.",
    dependency: "WP-PRIV-01 and WP-OBS-01",
    decisionRequired: true,
    unresolvedDecision: "Approve the analytics event schema and privacy/consent policy for batched native events.",
  },
  "analytics-beacon.post": {
    owner: "product_or_security_decision",
    rationale: "The beacon taxonomy and primitive payload allowlist are privacy-sensitive product policy, not a unilateral transport rename.",
    dependency: "WP-PRIV-01 and WP-OBS-01",
    decisionRequired: true,
    unresolvedDecision: "Approve the beacon type allowlist, permitted properties, and consent behavior.",
  },
  "audio-plan.get": {
    owner: "coordinated",
    rationale: "Backend emits a raw plan while production iOS decodes a plan envelope; both clients and server compatibility must be considered.",
    dependency: "WP-AUDIO-01",
    decisionRequired: false,
    unresolvedDecision: null,
  },
  "referral-apply.post": {
    owner: "product_or_security_decision",
    rationale: "No backend route establishes referral eligibility, abuse controls, or entitlement effects for the visible native producer.",
    dependency: "WP-NAV-01 and WP-ENT-01",
    decisionRequired: true,
    unresolvedDecision: "Decide whether referral application ships and approve eligibility, abuse, and reward semantics.",
  },
  "reflection-feedback.post": {
    owner: "coordinated",
    rationale: "Backend conditionally streams while iOS expects one JSON response; a single compatible response contract must be chosen across both sides.",
    dependency: "WP-NET-01",
    decisionRequired: false,
    unresolvedDecision: null,
  },
  "moderation-report.post": {
    owner: "product_or_security_decision",
    rationale: "A moderation route requires approved report categories, abuse controls, retention, operator handling, and user feedback semantics.",
    dependency: "WP-SAFE-01",
    decisionRequired: true,
    unresolvedDecision: "Approve the report taxonomy, moderation workflow, retention, and reporter feedback contract.",
  },
  "blocked-user.delete": {
    owner: "backend",
    rationale: "Server-side unblock and cross-surface enforcement are mandatory safety invariants, while the explicit native route has no backend implementation.",
    dependency: "WP-SAFE-01",
    decisionRequired: false,
    unresolvedDecision: null,
  },
  "notebook.delete": {
    owner: "ios",
    rationale: "Backend already exposes DELETE on the notebook collection with highlightId; the native path producer is the divergent side.",
    dependency: "WP-NOTE-01",
    decisionRequired: false,
    unresolvedDecision: null,
  },
  "block-user.post": {
    owner: "backend",
    rationale: "Server-side block enforcement is mandatory across user-content surfaces, and the explicit native contract has no backend route.",
    dependency: "WP-SAFE-01",
    decisionRequired: false,
    unresolvedDecision: null,
  },
  "event-progress.post": {
    owner: "product_or_security_decision",
    rationale: "Backend exposes a server-owned read while native emits an empty progress write; mutation authority cannot be inferred from either side.",
    dependency: "WP-READER-01 and WP-SYNC-01",
    decisionRequired: true,
    unresolvedDecision: "Decide whether event progress is server-derived or accepts an idempotent client signal and define its authority semantics.",
  },
  "gift-create.post": {
    owner: "product_or_security_decision",
    rationale: "Gift creation has entitlement, fraud, expiry, and account-binding consequences but no backend route contract.",
    dependency: "WP-ENT-01 and WP-NAV-01",
    decisionRequired: true,
    unresolvedDecision: "Approve who can create gifts, entitlement effects, expiry, abuse controls, and redemption ownership.",
  },
  "public-profile.get": {
    owner: "product_or_security_decision",
    rationale: "A public-profile route cannot be added until field visibility, block enforcement, and privacy defaults are approved.",
    dependency: "WP-SAFE-01 and WP-PRIV-01",
    decisionRequired: true,
    unresolvedDecision: "Approve the public profile field allowlist, privacy defaults, and block/moderation enforcement.",
  },
  "notebook.patch": {
    owner: "ios",
    rationale: "Backend already exposes PATCH on the notebook collection with highlightId in the body; the native item-path producer diverges.",
    dependency: "WP-NOTE-01",
    decisionRequired: false,
    unresolvedDecision: null,
  },
  "ask-book.post": {
    owner: "coordinated",
    rationale: "Backend SSE framing and native one-shot JSON decoding are incompatible and must preserve citations, cancellation, and partial failure together.",
    dependency: "WP-NET-01 and WP-READER-01",
    decisionRequired: false,
    unresolvedDecision: null,
  },
  "quiz-check.post": {
    owner: "ios",
    rationale: "Backend has a concrete authenticated check route and response validator; native currently sends a different public path and singleton body.",
    dependency: "WP-SYNC-02",
    decisionRequired: false,
    unresolvedDecision: null,
  },
  "account-delete.post": {
    owner: "ios",
    rationale: "Backend already requires recent authentication and an explicit DELETE confirmation; the native factory currently sends an empty body.",
    dependency: "WP-ACCOUNT-01 after WP-AUTH-01",
    decisionRequired: false,
    unresolvedDecision: null,
  },
  "pair.get": {
    owner: "coordinated",
    rationale: "The item route is delete-only while native expects a detail read; collection reuse versus a new detail response must be coordinated.",
    dependency: "WP-CONTRACT-01 follow-up",
    decisionRequired: false,
    unresolvedDecision: null,
  },
  "referral-profile.get": {
    owner: "coordinated",
    rationale: "Backend exposes a smaller embedded referral aggregate while native expects a richer standalone reward profile; neither source proves unilateral ownership.",
    dependency: "WP-NET-01 and WP-ENT-01",
    decisionRequired: false,
    unresolvedDecision: null,
  },
  "reflections.get": {
    owner: "coordinated",
    rationale: "Backend item route is write-only while native expects a read projection; persistence and response semantics span both sides.",
    dependency: "WP-CONTRACT-01 follow-up",
    decisionRequired: false,
    unresolvedDecision: null,
  },
  "user-journey.get": {
    owner: "ios",
    rationale: "Backend already returns the journey definition with nested progress; the native decoder requires the progress fields at the wrong level.",
    dependency: "WP-READER-01",
    decisionRequired: false,
    unresolvedDecision: null,
  },
  "blocked-users.get": {
    owner: "backend",
    rationale: "A server-owned blocklist is required for cross-device and server enforcement, while the explicit native list route is absent.",
    dependency: "WP-SAFE-01 and WP-PRIV-01",
    decisionRequired: false,
    unresolvedDecision: null,
  },
  "commitment.get": {
    owner: "coordinated",
    rationale: "Backend exposes collection GET and item PATCH; list filtering versus a stable item GET/not-found contract must be chosen across callers.",
    dependency: "WP-READER-01",
    decisionRequired: false,
    unresolvedDecision: null,
  },
};

const PRODUCTION_AUTHORITY_PROOFS: Record<
  string,
  { testId: string; evidence: string[] }
> = {
  "chapter.get": {
    testId: "models.chapter-progress.authority-deletion",
    evidence: [
      "Packages/Models/Tests/ModelsTests/BackendOwnedContractTests.swift BackendOwnedContractTests.progressAuthorityDeletionFailsClosed (chapter.get argument)",
      "Packages/Models/Sources/Models/Progress/BookProgress.swift BookProgress.init(from:)",
      "Packages/Models/Sources/Models/Evaluator/EntitlementEvaluator.swift EntitlementEvaluator.isChapterUnlocked(number:progress:)",
    ],
  },
  "quiz.get": {
    testId: "models.quiz-progress.authority-deletion",
    evidence: [
      "Packages/Models/Tests/ModelsTests/BackendOwnedContractTests.swift BackendOwnedContractTests.progressAuthorityDeletionFailsClosed (quiz.get argument)",
      "Packages/Models/Sources/Models/Responses.swift QuizResponse",
      "Packages/Models/Sources/Models/Evaluator/EntitlementEvaluator.swift EntitlementEvaluator.isChapterUnlocked(number:progress:)",
    ],
  },
  "entitlements.get": {
    testId: "models.entitlement.authority-deletion",
    evidence: [
      "Packages/Models/Tests/ModelsTests/BackendOwnedContractTests.swift BackendOwnedContractTests.entitlementAuthorityDeletionFailsClosed",
      "Packages/Models/Sources/Models/Responses.swift EntitlementResponse",
      "Packages/Models/Sources/Models/Evaluator/EntitlementEvaluator.swift EntitlementEvaluator",
    ],
  },
  "own-profile.get": {
    testId: "social.own-profile-identity.authority-deletion",
    evidence: [
      "Packages/SocialFeature/Tests/SocialFeatureTests/BackendOwnedAuthorityContractTests.swift BackendOwnedAuthorityContractTests.ownProfileIdentityAuthorityDeletionFailsClosed",
      "Packages/SocialFeature/Sources/SocialFeature/Models/OwnProfile.swift OwnProfileResponse.init(from:)",
    ],
  },
};

function sourceFiles(
  routeSource: string,
  auth: NativeContractAuthClass,
  extra: NativeContractSourceFileDefinition[] = [],
  canonicalErrorEnvelope = true
): NativeContractSourceFileDefinition[] {
  const sources: NativeContractSourceFileDefinition[] = [
    { path: routeSource, role: "route" },
  ];
  if (canonicalErrorEnvelope) sources.push({ path: ERROR_SOURCE, role: "error_envelope" });
  if (
    auth === "cognito_id_token" ||
    auth === "recent_auth_user" ||
    auth === "recent_auth_active_user"
  ) {
    sources.push({ path: AUTH_SOURCE, role: "auth" });
  }
  if (auth === "active_book_user" || auth === "recent_auth_active_user") {
    sources.push({ path: ACTIVE_USER_SOURCE, role: "auth" });
  }
  if (auth === "recent_auth_user") {
    sources.push({ path: ACTIVE_USER_SOURCE, role: "auth_policy" });
  }
  for (const source of extra) {
    if (!sources.some((candidate) => candidate.path === source.path)) sources.push(source);
  }
  return sources;
}

function pathParameters(routeTemplate: string): Record<string, string | number> {
  const result: Record<string, string | number> = {};
  for (const match of routeTemplate.matchAll(/\{([^}]+)\}/g)) {
    const name = match[1] ?? "parameter";
    result[name] = name.toLowerCase().includes("number") ? 1 : `${name}-synthetic`;
  }
  return result;
}

function variantId(operationId: string, producer: string): string {
  const label = producer
    .split("@")[0]
    ?.replaceAll(/[^A-Za-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "")
    .toLowerCase();
  return `${operationId}:${label || "default"}`;
}

function requestFixture(
  operationId: string,
  routeTemplate: string,
  request: RequestSeed
): NativeContractRequestFixture {
  return {
    operationVariantId: variantId(operationId, request.producer),
    producerEvidence: [request.producer],
    pathParameters: request.pathParameters ?? pathParameters(routeTemplate),
    queryItems: request.queryItems ?? [],
    headers: [],
    body: request.body ?? { kind: "none" },
    compatibility: request.compatibility ?? "canonical",
    notes: request.notes ?? "Synthetic request derived from the named native producer.",
  };
}

function errorFixtures(id: string, auth: NativeContractAuthClass) {
  const requestId = `req_synthetic_${id.replaceAll(/[^a-z0-9]+/g, "_")}`;
  const errors = [
    {
      status: 500,
      code: "server_error",
      headers: [],
      body: {
        error: {
          code: "server_error",
          message: "An unexpected server error occurred.",
          requestId,
        },
      },
    },
  ];
  if (auth !== "public") {
    errors.unshift({
      status: 401,
      code: "unauthenticated",
      headers: [],
      body: {
        error: {
          code: "unauthenticated",
          message: "Authentication is required.",
          requestId,
        },
      },
    });
  }
  return errors;
}

function defaultRouteSource(routeTemplate: string): string {
  const route = routeTemplate.replaceAll(/\{([^}]+)\}/g, "[$1]");
  return `app/app/api${route}/route.ts`;
}

function common(seed: OperationSeed) {
  const auth = seed.auth ?? "active_book_user";
  const productionAuthorityProof = PRODUCTION_AUTHORITY_PROOFS[seed.id];
  const nativeRequestFixtures = seed.requests.map((request) =>
    requestFixture(seed.id, seed.routeTemplate, request)
  );
  return {
    id: seed.id,
    method: seed.method,
    routeTemplate: seed.routeTemplate,
    matrixRowId: seed.matrixRowId ?? null,
    auth: {
      class: auth,
      credential:
        seed.credential ??
        (auth === "public" ? "none" : "Authorization: Bearer <Cognito id_token>"),
    },
    nativeRequestFixtures,
    cache: {
      class: (
        seed.method === "GET" ? (auth === "public" ? "public" : "private") : "no_store"
      ) as NativeContractOperationDefinition["cache"]["class"],
      notes: seed.cacheNotes,
    },
    idempotency: {
      class: (
        seed.method === "GET" ? "safe_read" : "unknown"
      ) as NativeContractOperationDefinition["idempotency"]["class"],
      notes: seed.idempotencyNotes,
    },
    responseContract: {
      iosModels: seed.iosModels,
      decoders: [seed.decoder ?? `Decodable<${seed.iosModels.join("|")}>`],
      optionality: seed.optionality ?? "Exact optionality is source-fenced; additive unknown fields are allowed.",
      pagination: seed.pagination ?? "none",
      versionSemantics: seed.versionSemantics ?? "No explicit API contract version is emitted.",
      assetSemantics: seed.assetSemantics ?? "No external asset semantics.",
    },
    authority: seed.authority
      ? {
          classification: seed.authority.classification,
          expectedRequiredPointers: seed.authority.pointers,
          failureMode: "fail_closed" as const,
          proof: productionAuthorityProof
            ? {
                level: "production_consumer_verified" as const,
                structuralEvidence: [
                  `${seed.id} requiredAuthorityFields are validated against the synthetic success fixture by assertNativeContractBundle`,
                ],
                productionConsumerTestIds: [productionAuthorityProof.testId],
                productionConsumerEvidence: productionAuthorityProof.evidence,
                gaps: [],
              }
            : {
                level: "structural_fixture_only" as const,
                structuralEvidence: [
                  `${seed.id} requiredAuthorityFields are validated against the synthetic success fixture by assertNativeContractBundle`,
                ],
                productionConsumerTestIds: [],
                productionConsumerEvidence: [],
                gaps: [
                  `No executed production iOS decoder/mapper deletion test is registered for ${seed.authority.pointers.join(", ")}.`,
                ],
              },
        }
      : {
          classification: "none" as const,
          expectedRequiredPointers: [],
          failureMode: "not_applicable" as const,
          proof: {
            level: "not_applicable" as const,
            structuralEvidence: [],
            productionConsumerTestIds: [],
            productionConsumerEvidence: [],
            gaps: [],
          },
        },
    ios: {
      factories: seed.requests.map((request) => request.producer),
      callSites: seed.callSites,
    },
    evidence: [
      ...seed.requests.map((request) => request.producer),
      ...seed.callSites,
    ],
  };
}

function matched(seed: OperationSeed): NativeContractOperationDefinition {
  if (!seed.responseBody) throw new Error(`${seed.id} matched seed is missing a response body`);
  const base = common(seed);
  const auth = seed.auth ?? "active_book_user";
  const routeSource = seed.routeSource ?? defaultRouteSource(seed.routeTemplate);
  const requests = base.nativeRequestFixtures.map((request) => ({
    ...request,
    compatibility: "canonical" as const,
  }));
  const full = seed.full === true;
  const serializerProof =
    seed.serializerProof ?? {
      kind: "source_fenced" as const,
      reason: "The response path has no exported hermetic serializer seam.",
    };
  const partialGaps: NativeContractOperationDefinition["gaps"] = [
    ...(serializerProof.kind === "source_fenced"
      ? [
          {
            kind: "response_path_execution",
            reason: serializerProof.reason,
          },
        ]
      : []),
    {
      kind: "route_specific_error_coverage",
      reason:
        seed.canonicalErrorEnvelope === false
          ? "No JSON error fixture is claimed; route-specific failure behavior is not exhaustively executed by the exporter."
          : "Documented error fixtures are representative, not an exhaustive route-specific status/code/header contract.",
    },
    {
      kind: "native_request_fixture_proof",
      reason: "Native requests are source-inventoried and hand-registered; the backend exporter does not instantiate Swift factories, and only six of 92 producers currently have exact factory tests in the iOS consumer.",
    },
    {
      kind: "native_response_consumer_proof",
      reason: "Only 24 of 61 partial operations currently pass the bundle success payload through the production iOS decoder and a cache round-trip; the remaining success fixtures are schema evidence, not native-consumer execution proof.",
    },
    {
      kind: "source_dependency_closure",
      reason: "Fenced backend source files are selected direct evidence, not a complete transitive import/dependency closure.",
    },
    ...(seed.authority && !PRODUCTION_AUTHORITY_PROOFS[seed.id]
      ? [
          {
            kind: "native_authority_consumer_proof",
            reason: `Structural fixture validation exists, but no production iOS decoder/mapper deletion test is registered for ${seed.authority.pointers.join(", ")}.`,
            owner: "ios" as const,
            dependency: "WP-CONTRACT-01 iOS authority-consumer follow-up",
          },
        ]
      : []),
    ...(seed.additionalGaps ?? []),
  ];
  return {
    ...base,
    coverage: full ? "full" : "partial",
    gaps: full ? [] : partialGaps,
    backend: {
      routeSource,
      exportedMethod: seed.method,
      authClass: auth,
      sourceFiles: sourceFiles(
        routeSource,
        auth,
        seed.responseSources,
        seed.canonicalErrorEnvelope !== false
      ),
      serializerProof,
    },
    fixtures: {
      request: requests[0] as NativeContractRequestFixture,
      requestVariants: requests,
      success: {
        status: seed.successStatus ?? 200,
        headers: seed.responseHeaders ?? [],
        payload: seed.responseBody,
        requiredAuthorityFields: seed.authority?.pointers ?? [],
      },
      deployedCompatibleSuccessAliases: seed.aliases ?? [],
      errors: [
        ...(seed.canonicalErrorEnvelope === false ? [] : errorFixtures(seed.id, auth)),
        ...(seed.additionalErrorFixtures ?? []),
      ],
    },
  };
}

function blocked(seed: BlockedSeed): NativeContractOperationDefinition {
  const base = common(seed);
  const resolution = BLOCKER_RESOLUTIONS[seed.id];
  if (!resolution) throw new Error(`${seed.id} blocked seed is missing resolution ownership`);
  let backendCandidate: NativeContractBackendCandidateDefinition | undefined;
  if (seed.blocker.candidate) {
    backendCandidate = {
      routeSource: seed.blocker.candidate.routeSource,
      exportedMethods: seed.blocker.candidate.methods,
      sourceFiles: sourceFiles(
        seed.blocker.candidate.routeSource,
        seed.auth ?? "active_book_user"
      ),
    };
  }
  return {
    ...base,
    authority:
      base.authority.classification === "none"
        ? base.authority
        : {
            ...base.authority,
            proof: {
              level: "blocked_unproven" as const,
              structuralEvidence: [],
              productionConsumerTestIds: [],
              productionConsumerEvidence: [],
              gaps: [
                `No compatible success fixture exists; authority fields ${base.authority.expectedRequiredPointers.join(", ")} remain unproven.`,
              ],
            },
          },
    coverage: "blocked",
    gaps: [
      { kind: seed.blocker.kind, reason: seed.blocker.reason },
      ...(base.authority.classification === "none"
        ? []
        : [
            {
              kind: "native_authority_consumer_proof",
              reason: `No compatible success contract exists, so production iOS authority handling for ${base.authority.expectedRequiredPointers.join(", ")} remains unproven.`,
              owner: resolution.owner,
              dependency: resolution.dependency,
            },
          ]),
    ],
    blocker: {
      kind: seed.blocker.kind,
      reason: seed.blocker.reason,
      evidence: seed.blocker.evidence,
      resolution,
      expectedRouteSource:
        seed.blocker.kind === "missing_route" ? defaultRouteSource(seed.routeTemplate) : undefined,
      backendCandidate,
    },
  };
}

function json(value: JsonValue): NativeContractResponsePayload {
  return { kind: "json", value };
}

function jsonBody(value: JsonValue): NativeContractRequestBody {
  return { kind: "json", value };
}

export const nativeContractOperationDefinitions: NativeContractOperationDefinition[] = [];

nativeContractOperationDefinitions.push(
  blocked({
    id: "analytics-track.post",
    method: "POST",
    routeTemplate: "/book/me/analytics/track",
    auth: "active_book_user",
    credential: "conditional_bearer",
    requests: [
      {
        producer:
          "DefaultAnalyticsClient.Path.track@Packages/CoreKit/Sources/CoreKit/Analytics/AnalyticsClient.swift:60",
        body: jsonBody({
          events: [
            {
              name: "chapter_opened",
              properties: { bookId: "book-synthetic" },
              timestamp: "2026-01-01T00:00:00Z",
            },
          ],
        }),
        compatibility: "client_drift",
      },
    ],
    callSites: ["AnalyticsClient.swift:187-208"],
    iosModels: ["IgnoredResponse"],
    decoder: "URLSessionAnalyticsTransport ignores the response body",
    cacheNotes: "Disk-backed batches requeue on transport failure; memory-only failures drop.",
    idempotencyNotes: "No server idempotency identity is sent.",
    blocker: {
      kind: "request_mismatch",
      reason: "Native sends {events:[...]}; backend requires a singular allowlisted {event,bookId,...} object.",
      evidence: [
        "Packages/CoreKit/Sources/CoreKit/Analytics/AnalyticsClient.swift:33-43 AnalyticsEvent and AnalyticsBatch define the batched native wire body",
        "Packages/CoreKit/Sources/CoreKit/Analytics/AnalyticsClient.swift:187-208 URLSessionAnalyticsTransport.send(_:) encodes and posts the batch",
        "app/app/api/book/me/analytics/track/route.ts:18-29 TRACK_EVENTS defines the backend event allowlist",
        "app/app/api/book/me/analytics/track/route.ts:31-69 POST validates one event object and its scalar fields",
      ],
      candidate: {
        routeSource: "app/app/api/book/me/analytics/track/route.ts",
        methods: ["POST"],
      },
    },
  }),
  blocked({
    id: "analytics-beacon.post",
    method: "POST",
    routeTemplate: "/book/me/analytics/beacon",
    auth: "active_book_user",
    credential: "conditional_bearer",
    requests: [
      {
        producer:
          "DefaultAnalyticsClient.Path.beacon@Packages/CoreKit/Sources/CoreKit/Analytics/AnalyticsClient.swift:61",
        body: jsonBody({
          name: "navigation",
          properties: { destination: "reader" },
          timestamp: "2026-01-01T00:00:00Z",
        }),
        compatibility: "client_drift",
      },
    ],
    callSites: ["AnalyticsClient.swift:212-220"],
    iosModels: ["IgnoredResponse"],
    decoder: "URLSessionAnalyticsTransport ignores the response body",
    cacheNotes: "Beacon delivery is fire-and-forget and failures are dropped.",
    idempotencyNotes: "No server idempotency identity is sent.",
    blocker: {
      kind: "request_mismatch",
      reason: "Native sends {name,properties,timestamp}; backend requires an allowlisted {type,...primitivePayload} object.",
      evidence: [
        "Packages/CoreKit/Sources/CoreKit/Analytics/AnalyticsClient.swift:33-38 AnalyticsEvent defines name, properties, and timestamp",
        "Packages/CoreKit/Sources/CoreKit/Analytics/AnalyticsClient.swift:212-220 URLSessionAnalyticsTransport.sendBeacon(_:) encodes the event",
        "app/app/api/book/me/analytics/beacon/route.ts:15-18 defines beacon type and key limits",
        "app/app/api/book/me/analytics/beacon/route.ts:82-90 enforces analytics consent behavior",
        "app/app/api/book/me/analytics/beacon/route.ts:98-128 parses type and sanitizes primitive payload values",
      ],
      candidate: {
        routeSource: "app/app/api/book/me/analytics/beacon/route.ts",
        methods: ["POST"],
      },
    },
  }),
  matched({
    id: "catalog.get",
    method: "GET",
    routeTemplate: "/book/books",
    matrixRowId: "catalog",
    auth: "public",
    requests: [
      { producer: "getBooks@Packages/Networking/Sources/Networking/Endpoint.swift:77" },
    ],
    callSites: ["LiveLibraryRepository.swift:74"],
    iosModels: ["CatalogResponse", "BookCatalogItem"],
    cacheNotes: "Backend: public max-age=3600, stale-while-revalidate=86400. iOS public cache TTL is 300 seconds.",
    idempotencyNotes: "Safe public read.",
    responseBody: json({
      books: [
        {
          id: "book-synthetic",
          title: "Synthetic Book",
          author: "Synthetic Author",
          icon: "📘",
          category: "Leadership",
          categories: ["Leadership"],
          difficulty: "balanced",
          estimatedMinutes: 120,
          chapterCount: 8,
          synopsis: "Synthetic catalog entry.",
          tags: ["synthetic"],
          variantFamily: "PBC",
          publishedVersion: "v1",
        },
      ],
    }),
    responseHeaders: [
      { name: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" },
    ],
    responseSources: [
      { path: "app/app/api/book/_lib/library-catalog.ts", role: "response_builder" },
      { path: "app/app/api/book/_lib/types.ts", role: "schema" },
    ],
    assetSemantics: "coverImage is an optional public HTTPS URL; metadata remains usable without it.",
    versionSemantics: "publishedVersion identifies the published content revision.",
  }),
  matched({
    id: "search-index.get",
    method: "GET",
    routeTemplate: "/book/search-index",
    matrixRowId: "search-index",
    auth: "public",
    canonicalErrorEnvelope: false,
    requests: [
      {
        producer:
          "getSearchIndex@Packages/Networking/Sources/Networking/Endpoint.swift:84",
      },
    ],
    callSites: ["LiveLibraryRepository.swift:179"],
    iosModels: ["SearchIndexResponse", "SearchIndexBook"],
    cacheNotes: "Backend streams the S3 JSON with public max-age=3600/SWR=86400 and returns [] on read failure.",
    idempotencyNotes: "Safe public read.",
    responseBody: json([
      {
        id: "book:book-synthetic",
        type: "book",
        bookId: "book-synthetic",
        bookTitle: "Synthetic Book",
        author: "Synthetic Author",
        text: "Synthetic Book by Synthetic Author",
        categories: ["Leadership"],
        tags: ["synthetic"],
      },
    ]),
    responseHeaders: [
      { name: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" },
    ],
    optionality: "The backend canonical success is a bare array; malformed or unavailable storage degrades to an empty array.",
    responseSources: [
      {
        path: "app/app/api/book/admin/books/[bookId]/versions/[version]/publish/search-index-builder.ts",
        role: "response_builder",
      },
    ],
    serializerProof: {
      kind: "source_fenced",
      reason: "The route streams an external S3 object produced by rebuildSearchIndex; route and producer source are fenced, but the stored response bytes are not executed or content-hash-fenced by this exporter.",
    },
    additionalGaps: [
      {
        kind: "external_response_asset",
        reason: "The actual response is the external S3 object book-content/library/search-index.json, whose deployed bytes and revision cannot be proven from backend source.",
      },
      {
        kind: "error_envelope_not_applicable",
        reason: "This route catches storage/read failures and returns HTTP 200 with an empty array; it does not advertise the shared JSON error envelope or a generic 500 fixture.",
      },
      {
        kind: "client_response_projection",
        reason: "The backend index is a flat SearchDocument array containing book, chapter, takeaway, and example records. Current iOS SearchIndexResponse decodes those records as SearchIndexBook values and cannot reconstruct the intended per-book chapter hierarchy; this semantic reconciliation remains unresolved.",
      },
    ],
    assetSemantics: "Response bytes come from external S3 key book-content/library/search-index.json; source fencing does not verify the deployed object.",
  }),
  matched({
    id: "book-detail.get",
    method: "GET",
    routeTemplate: "/book/books/{bookId}",
    matrixRowId: "book-detail-manifest",
    auth: "public",
    requests: [
      {
        producer: "getBook@Packages/Networking/Sources/Networking/Endpoint.swift:89",
      },
      {
        producer:
          "getManifestForDownload@Packages/Networking/Sources/Networking/Endpoint+Downloads.swift:13",
      },
    ],
    callSites: ["LiveBookDetailRepository.swift:14", "DownloadManager.swift:251"],
    iosModels: ["BookManifest"],
    cacheNotes: "Public metadata read; downloads persist the manifest in an account-owned store.",
    idempotencyNotes: "Safe public read.",
    responseBody: json({
      book: {
        id: "book-synthetic",
        title: "Synthetic Book",
        author: "Synthetic Author",
        categories: ["Leadership"],
        tags: ["synthetic"],
        variantFamily: "PBC",
        publishedVersion: "v1",
        chapterCount: 1,
        chapters: [
          {
            id: "book-synthetic-ch01",
            chapterId: "book-synthetic-ch01",
            number: 1,
            code: "ch01",
            title: "Synthetic Chapter",
            minutes: 12,
          },
        ],
      },
    }),
    responseSources: [
      { path: "app/app/api/book/_lib/library-catalog.ts", role: "response_builder" },
    ],
    versionSemantics: "publishedVersion pins the public detail to its published content revision.",
  }),
  matched({
    id: "chapter.get",
    method: "GET",
    routeTemplate: "/book/books/{bookId}/chapters/{chapterNumber}",
    matrixRowId: "chapter-content",
    requests: [
      {
        producer: "getChapter@Packages/Networking/Sources/Networking/Endpoint.swift:95",
      },
      {
        producer:
          "getChapterForDownload@Packages/Networking/Sources/Networking/Endpoint+Downloads.swift:20",
      },
    ],
    callSites: ["LiveReaderRepository.swift:48", "DownloadManager.swift:361"],
    iosModels: ["ChapterResponse", "Chapter", "BookProgress"],
    cacheNotes: "Private no-store response; iOS persists account-scoped chapter content.",
    idempotencyNotes: "Safe authenticated read.",
    responseBody: json({
      chapter: {
        chapterId: "book-synthetic-ch01",
        number: 1,
        title: "Synthetic Chapter",
        readingTimeMinutes: 12,
        activeVariant: "balanced",
        availableVariants: ["balanced"],
        content: { summaryBullets: ["Synthetic learning point."] },
        contentVariants: { balanced: { summaryBullets: ["Synthetic learning point."] } },
        examples: [],
      },
      progress: {
        currentChapterNumber: 1,
        unlockedThroughChapterNumber: 1,
        completedChapters: [],
        bestScoreByChapter: {},
      },
    }),
    responseHeaders: [{ name: "Cache-Control", value: "private, no-store" }],
    responseSources: [
      { path: "app/app/api/book/_lib/content-service.ts", role: "response_builder" },
      { path: "app/app/api/book/_lib/types.ts", role: "schema" },
      { path: "lib/book-package-types.ts", role: "schema" },
    ],
    authority: {
      classification: "server_decision",
      pointers: ["/progress/unlockedThroughChapterNumber"],
    },
    assetSemantics: "Chapter content may be stored for offline reading under an account/content-version key.",
  }),
  matched({
    id: "quiz.get",
    method: "GET",
    routeTemplate: "/book/books/{bookId}/chapters/{chapterNumber}/quiz",
    matrixRowId: "quiz-load-check-events",
    requests: [
      { producer: "getQuiz@Packages/Networking/Sources/Networking/Endpoint.swift:106" },
      {
        producer:
          "getQuizForDownload@Packages/Networking/Sources/Networking/Endpoint+Downloads.swift:29",
      },
    ],
    callSites: ["LiveQuizRepository.swift:64", "DownloadManager.swift:368"],
    iosModels: ["QuizResponse", "QuizClientSession", "BookProgress"],
    cacheNotes: "Private no-store response; iOS may persist the assigned quiz account-scoped.",
    idempotencyNotes: "Safe authenticated read.",
    responseBody: json({
      quiz: {
        questions: [
          {
            questionId: "question-synthetic-1",
            prompt: "Which option is synthetic?",
            choices: [
              { choiceId: "choice-a", text: "Option A" },
              { choiceId: "choice-b", text: "Option B" },
            ],
          },
        ],
        attemptNumber: 1,
      },
      progress: {
        currentChapterNumber: 1,
        unlockedThroughChapterNumber: 1,
        completedChapters: [],
        bestScoreByChapter: {},
      },
    }),
    responseHeaders: [{ name: "Cache-Control", value: "private, no-store" }],
    responseSources: [
      { path: "app/app/api/book/_lib/content-service.ts", role: "response_builder" },
      { path: "app/app/api/book/_lib/quiz-session.ts", role: "response_builder" },
    ],
    authority: {
      classification: "server_decision",
      pointers: ["/progress/unlockedThroughChapterNumber"],
    },
  }),
  blocked({
    id: "audio-plan.get",
    method: "GET",
    routeTemplate: "/book/books/{bookId}/chapters/{chapterNumber}/audio",
    matrixRowId: "audio-narration-plan",
    requests: [
      {
        producer:
          "getAudioPlan@Packages/Networking/Sources/Networking/Endpoint.swift:451",
        queryItems: [{ name: "mode", value: "plan" }],
      },
      {
        producer:
          "getAudioPlanFreshURLs@Packages/Networking/Sources/Networking/Endpoint+Downloads.swift:42",
        queryItems: [{ name: "mode", value: "plan" }],
      },
    ],
    callSites: ["LiveAudioRepository.swift:21", "DownloadManager.swift:316"],
    iosModels: ["AudioNarrationResponse", "AudioNarrationPlan"],
    cacheNotes: "Private no-store manifest; every segment URL expires and must be refreshed.",
    idempotencyNotes: "Safe authenticated read; generation side effects may occur for missing audio assets.",
    blocker: {
      kind: "response_mismatch",
      reason: "With mode=plan the backend returns the raw AudioNarrationPlan, while native decodes AudioNarrationResponse {plan}.",
      evidence: [
        "app/app/api/book/books/[bookId]/chapters/[chapterNumber]/audio/route.ts:549 returns JSON.stringify(result.plan)",
        "Packages/Models/Sources/Models/Audio/AudioNarrationPlan.swift requires the plan wrapper",
      ],
      candidate: {
        routeSource:
          "app/app/api/book/books/[bookId]/chapters/[chapterNumber]/audio/route.ts",
        methods: ["GET"],
      },
    },
  }),
  matched({
    id: "concept-graph.get",
    method: "GET",
    routeTemplate: "/book/books/{bookId}/concept-graph",
    requests: [
      {
        producer:
          "getConceptGraph@Packages/Networking/Sources/Networking/Endpoint.swift:398",
      },
    ],
    callSites: ["LiveAIRepository.swift:34"],
    iosModels: ["ConceptGraph"],
    cacheNotes: "No explicit iOS cache was observed.",
    idempotencyNotes: "Safe authenticated read.",
    responseBody: json({
      concepts: [{ id: "concept-synthetic", label: "Synthetic concept" }],
      edges: [],
      chapterIntroduces: { "book-synthetic-ch01": ["concept-synthetic"] },
      chapterRequires: {},
    }),
    responseSources: [
      { path: "app/app/api/book/_lib/types.ts", role: "schema" },
      { path: "lib/book-package-types.ts", role: "schema" },
      { path: "app/app/api/book/_lib/storage.ts", role: "response_builder" },
    ],
  }),
  matched({
    id: "journeys.get",
    method: "GET",
    routeTemplate: "/book/books/journeys",
    requests: [
      { producer: "getJourneys@Packages/Networking/Sources/Networking/Endpoint.swift:382" },
    ],
    callSites: ["JourneysRepository.swift:60"],
    iosModels: ["JourneysListResponse", "JourneyCatalogItem"],
    cacheNotes: "iOS uses memory and disk fallback.",
    idempotencyNotes: "Safe authenticated read.",
    responseBody: json({ journeys: [] }),
    responseSources: [
      { path: "app/app/api/book/_lib/journey-repo.ts", role: "response_builder" },
      { path: "content/journeys/journeys.json", role: "schema" },
    ],
  })
);

nativeContractOperationDefinitions.push(
  matched({
    id: "quiz-submit.post",
    method: "POST",
    routeTemplate: "/book/me/quiz/{bookId}/{chapterNumber}/submit",
    matrixRowId: "quiz-submit",
    requests: [
      {
        producer:
          "submitQuiz.online@Packages/QuizFeature/Sources/QuizFeature/Endpoints+Quiz.swift:9",
        body: jsonBody({
          attemptNumber: 1,
          responses: [
            {
              questionId: "question-synthetic-1",
              selectedChoiceId: "choice-a",
            },
          ],
        }),
      },
    ],
    callSites: ["LiveQuizRepository.swift:211"],
    iosModels: ["QuizAttemptResult"],
    cacheNotes: "The authoritative no-store result may clear the matching local draft only after this request succeeds.",
    idempotencyNotes: "This write is not replay-idempotent: attemptNumber is a freshness check, not an idempotency key, and no automatic replay contract is claimed.",
    responseBody: json({
      quiz: {
        chapterId: "book-synthetic-ch01",
        chapterNumber: 1,
        title: "Synthetic quiz",
        passingScorePercent: 80,
        status: "passed",
        attemptNumber: 1,
        nextAttemptNumber: null,
        attemptsCount: 1,
        failureStreak: 0,
        cooldownSeconds: 0,
        nextAttemptAvailableAt: null,
        highestScorePercent: 100,
        unlockedNextChapter: true,
        latestAttemptAt: "2026-07-17T12:00:00.000Z",
        questions: [
          {
            questionId: "question-synthetic-1",
            prompt: "Which option is synthetic?",
            choices: [
              { choiceId: "choice-a", text: "Option A" },
              { choiceId: "choice-b", text: "Option B" },
            ],
            selectedChoiceId: "choice-a",
            correctChoiceId: "choice-a",
            isCorrect: true,
          },
        ],
        result: {
          attemptNumber: 1,
          scorePercent: 100,
          correctAnswers: 1,
          totalQuestions: 1,
          passed: true,
          submittedAt: "2026-07-17T12:00:00.000Z",
        },
        history: [
          {
            attemptNumber: 1,
            scorePercent: 100,
            correctAnswers: 1,
            totalQuestions: 1,
            passed: true,
            submittedAt: "2026-07-17T12:00:00.000Z",
          },
        ],
      },
      progress: {
        currentChapterNumber: 2,
        unlockedThroughChapterNumber: 2,
        completedChapters: [1],
      },
    }),
    responseHeaders: [{ name: "Cache-Control", value: "private, no-store" }],
    responseSources: [
      { path: "app/app/api/book/_lib/quiz-session.ts", role: "response_builder" },
      { path: "app/app/api/book/_lib/types.ts", role: "schema" },
      { path: "lib/book-package-types.ts", role: "schema" },
    ],
    authority: {
      classification: "server_decision",
      pointers: [
        "/quiz/result/passed",
        "/quiz/result/scorePercent",
        "/quiz/unlockedNextChapter",
        "/quiz/cooldownSeconds",
        "/quiz/nextAttemptAvailableAt",
      ],
    },
    additionalErrorFixtures: [
      {
        status: 409,
        code: "quiz_session_stale",
        headers: [],
        body: {
          error: {
            code: "quiz_session_stale",
            message: "This quiz session is out of date. Refresh and try again.",
            requestId: "req_synthetic_quiz_submit_stale",
          },
        },
      },
    ],
  }),
  matched({
    id: "reading-session.post",
    method: "POST",
    routeTemplate: "/book/me/reading-sessions",
    matrixRowId: "reading-sessions",
    requests: [
      {
        producer:
          "postReadingSessionEvent@Packages/Networking/Sources/Networking/Endpoint.swift:181",
        body: jsonBody({
          event: "start",
          bookId: "book-synthetic",
          chapterId: "book-synthetic-ch01",
          sessionId: "session-synthetic",
        }),
      },
      {
        producer:
          "postAudioSessionEvent@Packages/Networking/Sources/Networking/Endpoint.swift:534",
        body: jsonBody({
          event: "end",
          bookId: "book-synthetic",
          chapterNumber: 1,
          sessionId: "session-synthetic",
          listeningSeconds: 60,
          source: "audio",
        }),
      },
    ],
    callSites: [
      "LiveReaderRepository.swift:188",
      "LiveAudioRepository.swift:55",
      "SyncDispatch.swift:200",
    ],
    iosModels: ["ReadingSessionResponse", "SessionEventResponse"],
    cacheNotes: "Session events belong in an account-scoped durable journal with heartbeat coalescing.",
    idempotencyNotes: "sessionId is available but exact server dedupe semantics are not declared centrally.",
    responseBody: json({
      readingDay: {
        date: "2026-01-01",
        totalActiveMs: 60000,
      },
      trackedMinutesToday: 1,
    }),
    responseSources: [
      { path: "app/app/api/book/_lib/book-metrics-repo.ts", role: "response_builder" },
      { path: "app/app/api/book/_lib/progress-repo.ts", role: "response_builder" },
      { path: "app/app/api/book/_lib/user-settings-repo.ts", role: "response_builder" },
    ],
    authority: {
      classification: "server_decision",
      pointers: ["/trackedMinutesToday"],
    },
  }),
  blocked({
    id: "referral-apply.post",
    method: "POST",
    routeTemplate: "/book/me/referrals/apply",
    matrixRowId: "gifts-referrals",
    requests: [
      {
        producer:
          "applyReferralCode@Packages/Networking/Sources/Networking/Endpoint+Referrals.swift:21",
        body: jsonBody({ code: "REF-SYNTHETIC" }),
        compatibility: "client_drift",
      },
    ],
    callSites: ["LiveSocialRepository.swift:216"],
    iosModels: ["ReferralApplyResponse"],
    cacheNotes: "No client grant is allowed; backend reward is authoritative.",
    idempotencyNotes: "Claim should be conditional-once if implemented.",
    blocker: {
      kind: "missing_route",
      reason: "No backend /book/me/referrals/apply route exists.",
      evidence: ["backend tree at behavior revision 968ff67 contains no me/referrals route"],
    },
  }),
  matched({
    id: "reflection.post",
    method: "POST",
    routeTemplate: "/book/me/reflections/{bookId}/{chapterNumber}",
    requests: [
      {
        producer:
          "postReflection@Packages/Networking/Sources/Networking/Endpoint+Reflections.swift:11",
        body: jsonBody({ text: "Synthetic reflection" }),
      },
    ],
    callSites: ["LiveSocialRepository.swift:134"],
    iosModels: ["PostReflectionResponse", "ChapterReflection"],
    cacheNotes: "ReflectionOutbox retries the write but has no stable HTTP mutation ID.",
    idempotencyNotes: "Duplicate reflection creation is possible on retry.",
    responseBody: json({
      reflection: {
        reflectionId: "reflection-synthetic",
        bookId: "bookId-synthetic",
        chapterNumber: 1,
        text: "Synthetic reflection",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      pointsAwarded: 0,
    }),
    responseSources: [
      { path: "app/app/api/book/_lib/flow-points-repo.ts", role: "response_builder" },
    ],
    authority: {
      classification: "private_data",
      pointers: ["/reflection/reflectionId"],
    },
  }),
  blocked({
    id: "reflection-feedback.post",
    method: "POST",
    routeTemplate: "/book/me/reflections/{bookId}/{chapterNumber}/feedback",
    requests: [
      {
        producer:
          "requestReflectionFeedback@Packages/Networking/Sources/Networking/Endpoint+Reflections.swift:21",
        body: jsonBody({ reflectionId: "reflection-synthetic" }),
        compatibility: "client_drift",
      },
    ],
    callSites: ["LiveSocialRepository.swift:151"],
    iosModels: ["ReflectionFeedbackResponse"],
    cacheNotes: "Feedback is queued only after reflection sync.",
    idempotencyNotes: "Backend cache may return JSON, while a cache miss opens a stream.",
    blocker: {
      kind: "response_mismatch",
      reason: "Backend conditionally returns JSON for a cache hit or text/event-stream for a miss; native decodes one JSON response.",
      evidence: [
        "app/app/api/book/me/reflections/[bookId]/[chapterNumber]/feedback/route.ts:106-110",
        "app/app/api/book/me/reflections/[bookId]/[chapterNumber]/feedback/route.ts:248-254",
      ],
      candidate: {
        routeSource:
          "app/app/api/book/me/reflections/[bookId]/[chapterNumber]/feedback/route.ts",
        methods: ["POST"],
      },
    },
  }),
  matched({
    id: "review-grade.post",
    method: "POST",
    routeTemplate: "/book/me/reviews/{cardId}",
    matrixRowId: "fsrs-reviews",
    requests: [
      {
        producer:
          "gradeReviewCard@Packages/Networking/Sources/Networking/Endpoint.swift:261",
        body: jsonBody({ rating: 3 }),
      },
    ],
    callSites: ["ReviewsRepository.swift:118", "SyncDispatch.swift:142"],
    iosModels: ["ReviewCardResponse", "FsrsCard"],
    cacheNotes: "Client has a durable pending-grade outbox; server schedule wins after reconciliation.",
    idempotencyNotes: "Backend dedupes a repeated grade within a bounded window.",
    responseBody: json({
      card: {
        cardId: "cardId-synthetic",
        bookId: "book-synthetic",
        front: "Synthetic prompt",
        back: "Synthetic answer",
        due: "2026-01-02T00:00:00.000Z",
        retrievability: 0.9,
      },
    }),
    responseSources: [
      { path: "app/app/api/book/_lib/fsrs-repo.ts", role: "response_builder" },
      { path: "app/app/api/book/_lib/fsrs.ts", role: "response_builder" },
    ],
    authority: { classification: "server_decision", pointers: ["/card/cardId"] },
  }),
  matched({
    id: "saved-toggle.post",
    method: "POST",
    routeTemplate: "/book/me/saved",
    matrixRowId: "saved-books",
    requests: [
      {
        producer:
          "toggleSaved@Packages/Networking/Sources/Networking/Endpoint.swift:131",
        body: jsonBody({ bookId: "book-synthetic", saved: true }),
      },
    ],
    callSites: ["LiveLibraryRepository.swift:143", "SyncDispatch.swift:194"],
    iosModels: ["SavedBooksResponse"],
    cacheNotes: "Client has multiple local mutation/outbox paths; optimistic state must reconcile with server truth.",
    idempotencyNotes: "Setting an explicit saved boolean is logically idempotent.",
    responseBody: json({
      saved: [{ bookId: "book-synthetic" }],
      savedBookIds: ["book-synthetic"],
    }),
    responseSources: [
      { path: "app/app/api/book/_lib/saved-books-repo.ts", role: "response_builder" },
    ],
    authority: {
      classification: "private_data",
      pointers: ["/savedBookIds"],
    },
  }),
  matched({
    id: "share-event.post",
    method: "POST",
    routeTemplate: "/book/me/share-events",
    requests: [
      {
        producer:
          "postShareEvent@Packages/Networking/Sources/Networking/Endpoint+ShareEvents.swift:10",
        body: jsonBody({ cardType: "quote", destination: "system-share-sheet" }),
      },
    ],
    callSites: ["LiveSocialRepository.swift:109"],
    iosModels: ["ShareEventResponse"],
    cacheNotes: "Analytics side effect is not cached.",
    idempotencyNotes: "No idempotency identity is sent.",
    responseBody: json({ ok: true, shareId: "share-synthetic" }),
    responseSources: [
      { path: "app/app/api/book/_lib/book-metrics-repo.ts", role: "response_builder" },
    ],
    authority: { classification: "server_decision", pointers: ["/ok"] },
  }),
  matched({
    id: "tier.post",
    method: "GET",
    routeTemplate: "/book/me/tier",
    requests: [
      {
        producer: "postTier@Packages/Networking/Sources/Networking/Endpoint.swift:276",
        notes: "Factory name is retained for source compatibility; method was corrected from POST to backend GET.",
      },
    ],
    callSites: ["EngagementRepository.swift:246"],
    iosModels: ["TierResponse", "TierState"],
    cacheNotes: "iOS memory TTL is 300 seconds with account-owned disk cache.",
    idempotencyNotes: "Safe authoritative read.",
    responseBody: json({
      currentTier: "READER",
      overallProgress: 0,
      tiers: [],
    }),
    responseSources: [
      { path: "app/app/api/book/_lib/tier-repo.ts", role: "response_builder" },
    ],
    authority: {
      classification: "server_decision",
      pointers: ["/currentTier", "/overallProgress"],
    },
  }),
  blocked({
    id: "moderation-report.post",
    method: "POST",
    routeTemplate: "/book/moderation/reports",
    matrixRowId: "profile-social",
    requests: [
      {
        producer:
          "submitReport@Packages/Networking/Sources/Networking/Endpoint+Safety.swift:61",
        body: jsonBody({
          targetUserId: "user-synthetic",
          contentId: "content-synthetic",
          contentType: "profile",
          reason: "other",
          details: "Synthetic report details",
        }),
        compatibility: "client_drift",
      },
    ],
    callSites: ["LiveSocialRepository.swift:198"],
    iosModels: ["ReportResponse"],
    cacheNotes: "Report mutation is not cached.",
    idempotencyNotes: "No handler exists to define dedupe/rate-limit semantics.",
    blocker: {
      kind: "missing_route",
      reason: "No backend /book/moderation/reports route exists.",
      evidence: ["backend tree at behavior revision 968ff67 contains no moderation reports route"],
    },
  }),
  blocked({
    id: "blocked-user.delete",
    method: "DELETE",
    routeTemplate: "/book/me/blocks/{userId}",
    matrixRowId: "profile-social",
    requests: [
      {
        producer:
          "unblockUser@Packages/Networking/Sources/Networking/Endpoint+Safety.swift:32",
        compatibility: "client_drift",
      },
    ],
    callSites: ["LiveSocialRepository.swift:177"],
    iosModels: ["BlockActionResponse"],
    cacheNotes: "iOS source marks backend support as TODO.",
    idempotencyNotes: "Unblock should be idempotent if implemented.",
    blocker: {
      kind: "missing_route",
      reason: "No backend /book/me/blocks/[userId] route exists.",
      evidence: ["backend tree at behavior revision 968ff67 contains no me/blocks route"],
    },
  }),
  blocked({
    id: "notebook.delete",
    method: "DELETE",
    routeTemplate: "/book/me/notebook/{entryId}",
    matrixRowId: "notebook",
    requests: [
      {
        producer:
          "deleteNotebookEntry@Packages/Networking/Sources/Networking/Endpoint.swift:342",
        compatibility: "client_drift",
      },
    ],
    callSites: ["NotebookRepository.swift:152", "LiveAnnotationRepository.swift:233"],
    iosModels: ["NotebookDeleteResponse"],
    cacheNotes: "Client has offline journals/outboxes.",
    idempotencyNotes: "Delete should be idempotent, but path contracts do not align.",
    blocker: {
      kind: "path_mismatch",
      reason: "Backend DELETE exists on /book/me/notebook with highlightId query; iOS sends /book/me/notebook/{entryId}.",
      evidence: ["app/app/api/book/me/notebook/route.ts exports DELETE on the base path"],
      candidate: {
        routeSource: "app/app/api/book/me/notebook/route.ts",
        methods: ["GET", "POST", "PATCH", "DELETE"],
      },
    },
  }),
  matched({
    id: "pair.delete",
    method: "DELETE",
    routeTemplate: "/book/me/pairs/{partnerId}",
    matrixRowId: "reading-pairs",
    requests: [
      {
        producer:
          "deletePair@Packages/Networking/Sources/Networking/Endpoint.swift:588",
      },
    ],
    callSites: ["LiveSocialRepository.swift:76"],
    iosModels: ["PairAckResponse"],
    cacheNotes: "No client cache was observed.",
    idempotencyNotes: "Backend returns not_found when no active pair remains; repeated delete is not a success no-op.",
    responseBody: json({ ended: true }),
    responseSources: [
      { path: "app/app/api/book/_lib/pair-repo.ts", role: "response_builder" },
    ],
    authority: { classification: "server_decision", pointers: ["/ended"] },
  })
);

nativeContractOperationDefinitions.push(
  matched({
    id: "gift-claim.post",
    method: "POST",
    routeTemplate: "/book/me/gifts/{code}/claim",
    matrixRowId: "gifts-referrals",
    requests: [
      {
        producer:
          "claimGift@Packages/Networking/Sources/Networking/Endpoint.swift:303",
        body: jsonBody({}),
      },
    ],
    callSites: ["LiveSocialRepository.swift:92"],
    iosModels: ["GiftClaimResponse", "Gift"],
    cacheNotes: "Client must re-fetch backend entitlement after claim; no local Pro grant is allowed.",
    idempotencyNotes: "A gift claim is conditional-once; already-claimed is a distinct outcome.",
    responseBody: json({
      claimed: true,
      status: "claimed",
      giftType: "pro_week",
      proDays: 7,
      message: "Synthetic gift claimed.",
    }),
    responseSources: [
      { path: "app/app/api/book/_lib/pro-grant-guard-core.ts", role: "request_validator" },
      { path: "app/app/api/book/_lib/flow-points-repo.ts", role: "response_builder" },
    ],
    authority: {
      classification: "entitlement",
      pointers: ["/claimed", "/status"],
    },
  }),
  matched({
    id: "journey-start.post",
    method: "POST",
    routeTemplate: "/book/me/journeys/{journeyId}/start",
    requests: [
      {
        producer:
          "startJourney@Packages/Networking/Sources/Networking/Endpoint.swift:392",
        body: jsonBody({}),
      },
    ],
    callSites: ["JourneysRepository.swift:94"],
    iosModels: ["UserJourneyResponse", "UserJourney"],
    cacheNotes: "Client updates its journey cache after acknowledgment.",
    idempotencyNotes: "Backend journey start converges existing state; no client idempotency key is sent.",
    responseBody: json({
      journey: {
        journeyId: "journeyId-synthetic",
        status: "active",
        completedBookIds: [],
      },
    }),
    responseSources: [
      { path: "app/app/api/book/_lib/journey-repo.ts", role: "response_builder" },
    ],
    authority: {
      classification: "server_decision",
      pointers: ["/journey/journeyId", "/journey/status"],
    },
  }),
  matched({
    id: "notebook.post",
    method: "POST",
    routeTemplate: "/book/me/notebook",
    matrixRowId: "notebook",
    requests: [
      {
        producer:
          "postNotebookEntry@Packages/Networking/Sources/Networking/Endpoint.swift:329",
        body: jsonBody({
          bookId: "book-synthetic",
          chapterId: "book-synthetic-ch01",
          type: "note",
          content: "Synthetic note",
        }),
      },
    ],
    callSites: ["LiveAnnotationRepository.swift:130", "SyncDispatch.swift:107"],
    iosModels: ["NotebookCreateResponse", "NotebookEntry"],
    cacheNotes: "Client has durable local outboxes; backend remains the cross-device source.",
    idempotencyNotes: "No stable HTTP mutation ID is sent; duplicate create risk remains.",
    responseBody: json({
      entry: {
        entryId: "entry-synthetic",
        bookId: "book-synthetic",
        chapterId: "book-synthetic-ch01",
        type: "note",
        content: "Synthetic note",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    }),
    successStatus: 201,
    responseSources: [
      { path: "app/app/api/book/_lib/notebook-highlight-repo.ts", role: "response_builder" },
      { path: "app/app/api/book/_lib/notebook-entries.ts", role: "response_builder" },
    ],
    authority: { classification: "private_data", pointers: ["/entry/entryId"] },
  }),
  matched({
    id: "notifications-read-all.post",
    method: "POST",
    routeTemplate: "/book/me/notifications/read-all",
    matrixRowId: "notification-inbox",
    requests: [
      {
        producer:
          "postMarkAllNotificationsRead@Packages/Networking/Sources/Networking/Endpoint+Notifications.swift:25",
      },
    ],
    callSites: ["NotificationInboxRepository.swift:66"],
    iosModels: ["IgnoredBody"],
    cacheNotes: "Client currently does not mutate its cache after the acknowledgment.",
    idempotencyNotes: "Mark-all-read is idempotent.",
    responseBody: json({ marked: true }),
    responseSources: [
      { path: "app/app/api/book/_lib/notifications-repo.ts", role: "response_builder" },
    ],
    authority: { classification: "server_decision", pointers: ["/marked"] },
  }),
  matched({
    id: "onboarding-complete.post",
    method: "POST",
    routeTemplate: "/book/me/onboarding/complete",
    matrixRowId: "onboarding",
    requests: [
      {
        producer:
          "postOnboardingComplete@Packages/Networking/Sources/Networking/Endpoint+Onboarding.swift:19",
        body: jsonBody({
          interests: ["Leadership"],
          chapterOrder: "sequential",
          tone: "direct",
          dailyGoal: 15,
          reminderHour: 9,
          reminderMinute: 0,
        }),
      },
    ],
    callSites: ["OnboardingRepository.swift:46"],
    iosModels: ["OnboardingAckResponse"],
    cacheNotes: "Local completion must remain pending until backend acknowledgment.",
    idempotencyNotes: "Repeated completion is intended to converge, but optimistic concurrency is not exposed to the client.",
    responseBody: json({ success: true }),
    responseSources: [
      { path: "app/app/api/book/_lib/starter-prescription.ts", role: "response_builder" },
      { path: "app/app/api/book/_lib/user-settings-repo.ts", role: "response_builder" },
      { path: "app/app/api/book/_lib/user-profile-repo.ts", role: "response_builder" },
    ],
    authority: { classification: "server_decision", pointers: ["/success"] },
  }),
  matched({
    id: "onboarding-progress.post",
    method: "PATCH",
    routeTemplate: "/book/me/onboarding/progress",
    matrixRowId: "onboarding",
    requests: [
      {
        producer:
          "postOnboardingProgress@Packages/Networking/Sources/Networking/Endpoint+Onboarding.swift:14",
        body: jsonBody({
          step: 2,
          interests: ["Leadership"],
          tone: "direct",
        }),
        notes: "Factory name is retained for source compatibility; method was corrected from POST to backend PATCH.",
      },
    ],
    callSites: ["OnboardingRepository.swift:41"],
    iosModels: ["OnboardingAckResponse"],
    cacheNotes: "No durable client acknowledgment journal exists.",
    idempotencyNotes: "Repeated partial progress PATCH converges on the same draft fields.",
    responseBody: json({ success: true }),
    responseSources: [
      { path: "app/app/api/book/_lib/user-settings-repo.ts", role: "response_builder" },
    ],
    authority: { classification: "server_decision", pointers: ["/success"] },
  }),
  matched({
    id: "pair-accept.post",
    method: "POST",
    routeTemplate: "/book/me/pairs/accept/{code}",
    matrixRowId: "reading-pairs",
    requests: [
      {
        producer:
          "acceptPairInvite@Packages/Networking/Sources/Networking/Endpoint.swift:577",
        body: jsonBody({}),
      },
    ],
    callSites: ["LiveSocialRepository.swift:65"],
    iosModels: ["PairResponse", "ReadingPair"],
    cacheNotes: "No client cache was observed.",
    idempotencyNotes: "Invite accept is conditional; already-paired/expired are explicit outcomes.",
    responseBody: json({
      pair: {
        partnerId: "partner-synthetic",
        status: "active",
      },
    }),
    responseSources: [
      { path: "app/app/api/book/_lib/pair-repo.ts", role: "response_builder" },
      { path: "app/app/api/book/_lib/pair-write-core.ts", role: "request_validator" },
    ],
    authority: {
      classification: "server_decision",
      pointers: ["/pair/partnerId", "/pair/status"],
    },
  }),
  matched({
    id: "pair-invite.post",
    method: "POST",
    routeTemplate: "/book/me/pairs/invite",
    matrixRowId: "reading-pairs",
    requests: [
      {
        producer:
          "createPairInvite@Packages/Networking/Sources/Networking/Endpoint.swift:571",
        body: jsonBody({}),
      },
    ],
    callSites: ["LiveSocialRepository.swift:59"],
    iosModels: ["PairInviteResponse"],
    cacheNotes: "Invite codes are ephemeral.",
    idempotencyNotes: "Invite creation is non-idempotent without a request identity.",
    responseBody: json({
      invite: {
        code: "PAIR-SYNTHETIC",
        expiresAt: "2026-01-02T00:00:00.000Z",
        url: "https://example.invalid/pair/PAIR-SYNTHETIC",
      },
    }),
    responseSources: [
      { path: "app/app/api/book/_lib/pair-repo.ts", role: "response_builder" },
    ],
    authority: { classification: "server_decision", pointers: ["/invite/code"] },
  }),
  matched({
    id: "pair-nudge.post",
    method: "POST",
    routeTemplate: "/book/me/pairs/{partnerId}/nudge",
    matrixRowId: "reading-pairs",
    requests: [
      {
        producer:
          "nudgePartner@Packages/Networking/Sources/Networking/Endpoint.swift:593",
        body: jsonBody({}),
      },
    ],
    callSites: ["LiveSocialRepository.swift:80"],
    iosModels: ["PairAckResponse"],
    cacheNotes: "No cache was observed.",
    idempotencyNotes: "Notification side effect is non-idempotent without a request identity.",
    responseBody: json({ sent: true }),
    responseSources: [
      { path: "app/app/api/book/_lib/pair-repo.ts", role: "response_builder" },
      { path: "app/app/api/book/_lib/notifications-repo.ts", role: "response_builder" },
    ],
    authority: { classification: "server_decision", pointers: ["/sent"] },
  }),
  matched({
    id: "quiz-event.post",
    method: "POST",
    routeTemplate: "/book/me/quiz/{bookId}/{chapterNumber}/events",
    matrixRowId: "quiz-load-check-events",
    requests: [
      {
        producer:
          "postQuizEvent@Packages/QuizFeature/Sources/QuizFeature/Endpoints+Quiz.swift:40",
        body: jsonBody({
          event: "question_answered",
          questionId: "question-synthetic-1",
        }),
      },
    ],
    callSites: ["LiveQuizRepository.swift:161"],
    iosModels: ["QuizEventAck"],
    cacheNotes: "Online-only analytics event; failures are currently dropped.",
    idempotencyNotes: "Analytics side effect has no idempotency key.",
    responseBody: json({ recorded: true }),
    responseSources: [
      { path: "app/app/api/book/_lib/analytics-repo.ts", role: "response_builder" },
    ],
    authority: { classification: "server_decision", pointers: ["/recorded"] },
  })
);

nativeContractOperationDefinitions.push(
  blocked({
    id: "block-user.post",
    method: "POST",
    routeTemplate: "/book/me/blocks",
    matrixRowId: "profile-social",
    requests: [
      {
        producer:
          "blockUser@Packages/Networking/Sources/Networking/Endpoint+Safety.swift:23",
        body: jsonBody({ userId: "userId-synthetic" }),
        compatibility: "client_drift",
      },
    ],
    callSites: ["LiveSocialRepository.swift:172"],
    iosModels: ["BlockActionResponse"],
    cacheNotes: "iOS source marks the backend as TODO.",
    idempotencyNotes: "Block should be idempotent if implemented.",
    blocker: {
      kind: "missing_route",
      reason: "No backend /book/me/blocks route exists.",
      evidence: ["backend tree at behavior revision 968ff67 contains no me/blocks route"],
    },
  }),
  matched({
    id: "scenario.post",
    method: "POST",
    routeTemplate: "/book/me/books/{bookId}/chapters/{chapterNumber}/scenarios",
    requests: [
      {
        producer:
          "postScenario@Packages/Networking/Sources/Networking/Endpoints+Scenarios.swift:25",
        body: jsonBody({
          title: "Synthetic scenario",
          scenario: "A synthetic reader practices a skill.",
          whatToDo: "Apply the synthetic step.",
          whyItMatters: "It tests the contract safely.",
          scope: "private",
        }),
      },
      {
        producer:
          "ScenarioRepository.syncPendingUploads@Packages/EngagementFeature/Sources/EngagementFeature/Scenarios/ScenarioRepository.swift:113",
        body: jsonBody({
          title: "Synthetic scenario",
          scenario: "A synthetic reader practices a skill.",
          whatToDo: "Apply the synthetic step.",
          whyItMatters: "It tests the contract safely.",
          scope: "private",
        }),
      },
    ],
    callSites: ["ScenarioRepository.swift:81", "ScenarioRepository.swift:113"],
    iosModels: ["ScenarioResponse", "UserScenario"],
    cacheNotes: "SwiftData outbox replays the exact request body.",
    idempotencyNotes: "No HTTP idempotency key is sent; duplicate submission risk remains.",
    responseBody: json({
      submission: {
        submissionId: "submission-synthetic",
        title: "Synthetic scenario",
        scenario: "A synthetic reader practices a skill.",
        whatToDo: "Apply the synthetic step.",
        whyItMatters: "It tests the contract safely.",
        scope: "private",
        status: "submitted",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      pointsAwarded: 0,
    }),
    responseSources: [
      { path: "app/app/api/book/_lib/scenario-prefilter.ts", role: "request_validator" },
      { path: "app/app/api/book/_lib/ai-service.ts", role: "request_validator" },
      { path: "app/app/api/book/_lib/scenario-repo.ts", role: "response_builder" },
      { path: "app/app/api/book/_lib/book-metrics-repo.ts", role: "response_builder" },
    ],
    authority: {
      classification: "server_decision",
      pointers: ["/submission/submissionId", "/submission/status"],
    },
  }),
  matched({
    id: "start-book.post",
    method: "POST",
    routeTemplate: "/book/me/books/{bookId}/start",
    matrixRowId: "start-book",
    requests: [
      {
        producer: "startBook@Packages/Networking/Sources/Networking/Endpoint.swift:143",
        body: jsonBody({}),
      },
    ],
    callSites: ["LiveBookDetailRepository.swift:22"],
    iosModels: ["BookStateResponse"],
    cacheNotes: "Accepted server state is cached account-scoped; no speculative unlock is allowed.",
    idempotencyNotes: "Backend ensure-book-started logic converges repeated starts; no client idempotency key is sent.",
    responseBody: json({
      bookId: "bookId-synthetic",
      entitlement: {
        plan: "FREE",
        freeBookSlots: 1,
        unlockedBookIds: ["bookId-synthetic"],
      },
      progress: {
        currentChapterNumber: 1,
        unlockedThroughChapterNumber: 1,
      },
    }),
    responseSources: [
      { path: "app/app/api/book/_lib/ensure-book-started.ts", role: "response_builder" },
      { path: "app/app/api/book/_lib/ensure-book-started-core.ts", role: "response_builder" },
    ],
    authority: {
      classification: "entitlement",
      pointers: ["/entitlement/plan", "/entitlement/unlockedBookIds"],
    },
  }),
  matched({
    id: "commitment.post",
    method: "POST",
    routeTemplate: "/book/me/commitments",
    matrixRowId: "commitments",
    requests: [
      {
        producer:
          "createCommitment@Packages/Networking/Sources/Networking/Endpoint.swift:474",
        body: jsonBody({
          bookId: "book-synthetic",
          chapterId: "book-synthetic-ch01",
          ifStatement: "If I see the cue",
          thenStatement: "then I take the synthetic action",
          followUpDays: 7,
        }),
      },
    ],
    callSites: ["CommitmentRepository.swift:70"],
    iosModels: ["CommitmentResponse", "Commitment"],
    cacheNotes: "Client keeps an offline outbox; no HTTP mutation identity is present.",
    idempotencyNotes: "Create is non-idempotent without a stable mutation ID.",
    responseBody: json({
      commitment: {
        commitmentId: "commitment-synthetic",
        bookId: "book-synthetic",
        chapterId: "book-synthetic-ch01",
        ifStatement: "If I see the cue",
        thenStatement: "then I take the synthetic action",
        status: "active",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      created: true,
    }),
    responseSources: [
      { path: "app/app/api/book/_lib/commitment-repo.ts", role: "response_builder" },
    ],
    authority: {
      classification: "server_decision",
      pointers: ["/commitment/commitmentId", "/commitment/status"],
    },
  }),
  matched({
    id: "device-register.post",
    method: "POST",
    routeTemplate: "/book/me/devices/register",
    matrixRowId: "apns-device-registration",
    requests: [
      {
        producer:
          "registerDevice@Packages/Networking/Sources/Networking/Endpoint+Devices.swift:10",
        body: jsonBody({
          platform: "ios",
          apnsToken: "synthetic-apns-token",
          bundleId: "com.chapterflow.synthetic",
          locale: "en_CA",
          timeZone: "UTC",
        }),
      },
    ],
    callSites: ["DeviceRegistrationRepository.swift:34"],
    iosModels: ["DeviceRegistrationResponse"],
    cacheNotes: "Local registration state changes only after backend acknowledgment.",
    idempotencyNotes: "Backend upserts by user and token; repeated registration is idempotent.",
    responseBody: json({ registered: true }),
    responseSources: [
      { path: "app/app/api/book/_lib/device-register-core.ts", role: "request_validator" },
      { path: "app/app/api/book/_lib/device-cap-core.ts", role: "response_builder" },
    ],
    authority: { classification: "server_decision", pointers: ["/registered"] },
  }),
  matched({
    id: "device-unregister.post",
    method: "POST",
    routeTemplate: "/book/me/devices/unregister",
    matrixRowId: "apns-device-registration",
    requests: [
      {
        producer:
          "unregisterDevice@Packages/Networking/Sources/Networking/Endpoint+Devices.swift:40",
        body: jsonBody({ apnsToken: "synthetic-apns-token" }),
      },
    ],
    callSites: ["DeviceRegistrationRepository.swift:49"],
    iosModels: ["DeviceRegistrationResponse"],
    cacheNotes: "Failed unregister remains retryable; absence is a successful no-op.",
    idempotencyNotes: "Delete by stable token key is idempotent.",
    responseBody: json({ unregistered: true }),
    responseSources: [
      { path: "app/app/api/book/_lib/keys.ts", role: "schema" },
    ],
    authority: { classification: "server_decision", pointers: ["/unregistered"] },
  }),
  matched({
    id: "event-join.post",
    method: "POST",
    routeTemplate: "/book/me/events/{eventId}/join",
    requests: [
      {
        producer: "joinEvent@Packages/Networking/Sources/Networking/Endpoint.swift:362",
        body: jsonBody({}),
      },
    ],
    callSites: ["SeasonalEventRepository.swift:86"],
    iosModels: ["JoinEventResponse", "EventProgress"],
    cacheNotes: "Client updates its in-memory event state after acknowledgment.",
    idempotencyNotes: "Existing participation returns isNew=false; repeated join is idempotent.",
    responseBody: json({
      participation: {
        eventId: "eventId-synthetic",
        chaptersCompleted: 0,
        dailyChaptersCompleted: 0,
        isCompleted: false,
      },
      isNew: true,
    }),
    responseSources: [
      { path: "app/app/api/book/_lib/events-repo.ts", role: "response_builder" },
      { path: "app/app/api/book/_lib/admin-events-repo.ts", role: "request_validator" },
    ],
    authority: {
      classification: "server_decision",
      pointers: ["/participation/eventId", "/isNew"],
    },
  }),
  blocked({
    id: "event-progress.post",
    method: "POST",
    routeTemplate: "/book/me/events/{eventId}/progress",
    requests: [
      {
        producer:
          "postEventProgress@Packages/Networking/Sources/Networking/Endpoint.swift:374",
        body: jsonBody({}),
        compatibility: "client_drift",
      },
    ],
    callSites: ["SeasonalEventRepository.swift:115"],
    iosModels: ["EventProgressResponse", "EventProgress"],
    cacheNotes: "Client expects server-authoritative progress after the mutation.",
    idempotencyNotes: "Mutation semantics cannot be established because the handler is absent.",
    blocker: {
      kind: "method_mismatch",
      reason: "The backend event progress route exports GET only.",
      evidence: ["app/app/api/book/me/events/[eventId]/progress/route.ts exports GET"],
      candidate: {
        routeSource: "app/app/api/book/me/events/[eventId]/progress/route.ts",
        methods: ["GET"],
      },
    },
  }),
  matched({
    id: "flow-points-redeem.post",
    method: "POST",
    routeTemplate: "/book/me/flow-points/redeem",
    requests: [
      {
        producer:
          "redeemFlowPoints@Packages/Networking/Sources/Networking/Endpoint.swift:226",
        body: jsonBody({ itemId: "reward-synthetic", action: "equip" }),
      },
    ],
    callSites: ["EngagementRepository.swift:274"],
    iosModels: ["RedeemFlowPointsResponse"],
    cacheNotes: "Success invalidates flow-points and shop caches.",
    idempotencyNotes: "Conditional redemption prevents duplicate one-time rewards; equip action converges.",
    responseBody: json({ ok: true, rewardId: "reward-synthetic", balance: 0 }),
    responseSources: [
      { path: "app/app/api/book/_lib/flow-points-repo.ts", role: "response_builder" },
    ],
    authority: {
      classification: "server_decision",
      pointers: ["/ok", "/balance"],
    },
  }),
  blocked({
    id: "gift-create.post",
    method: "POST",
    routeTemplate: "/book/me/gifts",
    matrixRowId: "gifts-referrals",
    requests: [
      {
        producer:
          "createGift@Packages/Networking/Sources/Networking/Endpoint.swift:312",
        body: jsonBody({ giftType: "pro_week" }),
        compatibility: "client_drift",
      },
    ],
    callSites: ["LiveSocialRepository.swift:98"],
    iosModels: ["CreateGiftResponse", "Gift"],
    cacheNotes: "Gift codes are ephemeral.",
    idempotencyNotes: "Create would be non-idempotent without a mutation key.",
    blocker: {
      kind: "missing_route",
      reason: "No backend /book/me/gifts base route exists.",
      evidence: ["backend tree at behavior revision 968ff67 contains only gifts/[code] routes"],
    },
  })
);

nativeContractOperationDefinitions.push(
  blocked({
    id: "public-profile.get",
    method: "GET",
    routeTemplate: "/book/users/{userId}/profile",
    matrixRowId: "profile-social",
    requests: [
      {
        producer:
          "getPublicProfile@Packages/Networking/Sources/Networking/Endpoint.swift:323",
        compatibility: "client_drift",
      },
    ],
    callSites: ["LiveSocialRepository.swift:45"],
    iosModels: ["PublicProfileResponse", "PublicProfile"],
    cacheNotes: "No cache was observed.",
    idempotencyNotes: "Safe read if implemented.",
    blocker: {
      kind: "missing_route",
      reason: "No backend /book/users/[userId]/profile route exists.",
      evidence: ["backend tree at behavior revision 968ff67 contains no users profile route"],
    },
  }),
  matched({
    id: "book-state.patch",
    method: "PATCH",
    routeTemplate: "/book/me/books/{bookId}/state",
    matrixRowId: "book-state-cursor-preferences",
    requests: [
      {
        producer:
          "patchBookCursor@Packages/Networking/Sources/Networking/Endpoint.swift:152",
        body: jsonBody({
          lastReadChapterId: "book-synthetic-ch01",
          currentChapterId: "book-synthetic-ch01",
        }),
      },
      {
        producer:
          "patchBookPreferredVariant@Packages/Networking/Sources/Networking/Endpoint.swift:170",
        body: jsonBody({ preferredVariant: "balanced" }),
      },
    ],
    callSites: [
      "LiveReaderRepository.swift:162",
      "LiveBookPreferencesRepository.swift:16",
      "SyncDispatch.swift:44",
    ],
    iosModels: ["BookStateResponse", "BookStateResponseEnvelope"],
    cacheNotes: "Cursor writes use a durable mutation journal; preference writes are currently best-effort.",
    idempotencyNotes: "PATCH is logically idempotent for the same state fields, but no revision/idempotency token is sent.",
    responseBody: json({
      state: {
        bookId: "book-synthetic",
        completedChapterIds: [],
        unlockedChapterIds: ["book-synthetic-ch01"],
        chapterScores: {},
        chapterCompletedAt: {},
        currentChapterId: "book-synthetic-ch01",
        preferredVariant: "balanced",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    }),
    responseSources: [
      { path: "app/app/api/book/_lib/progress-write-core.ts", role: "response_builder" },
      { path: "app/app/api/book/_lib/progress-repo.ts", role: "response_builder" },
      { path: "app/app/api/book/_lib/book-state-repo.ts", role: "response_builder" },
      { path: "app/app/api/book/_lib/types.ts", role: "schema" },
    ],
    authority: {
      classification: "private_data",
      pointers: ["/state/bookId", "/state/unlockedChapterIds"],
    },
  }),
  matched({
    id: "commitment.patch",
    method: "PATCH",
    routeTemplate: "/book/me/commitments/{commitmentId}",
    matrixRowId: "commitments",
    requests: [
      {
        producer:
          "updateCommitment@Packages/Networking/Sources/Networking/Endpoint.swift:512",
        body: jsonBody({ reflection: "Synthetic reflection", outcome: "helped" }),
      },
    ],
    callSites: ["CommitmentRepository.swift:107"],
    iosModels: ["CommitmentResponse", "Commitment"],
    cacheNotes: "iOS queues the update offline without an HTTP mutation identity.",
    idempotencyNotes: "The backend conditionally prevents repeated terminal updates; duplicate outcome semantics are explicit.",
    responseBody: json({
      commitment: {
        commitmentId: "commitmentId-synthetic",
        status: "completed",
        reflection: "Synthetic reflection",
        outcome: "helped",
      },
      ipAwarded: 0,
    }),
    responseSources: [
      { path: "app/app/api/book/_lib/commitment-application.ts", role: "response_builder" },
      { path: "app/app/api/book/_lib/flow-points-repo.ts", role: "response_builder" },
    ],
    authority: {
      classification: "server_decision",
      pointers: ["/commitment/status"],
    },
  }),
  blocked({
    id: "notebook.patch",
    method: "PATCH",
    routeTemplate: "/book/me/notebook/{entryId}",
    matrixRowId: "notebook",
    requests: [
      {
        producer:
          "patchNotebookEntry@Packages/Networking/Sources/Networking/Endpoint.swift:347",
        body: jsonBody({ content: "Synthetic note", tags: ["synthetic"] }),
        compatibility: "client_drift",
      },
    ],
    callSites: ["NotebookRepository.swift:134", "SyncDispatch.swift:95"],
    iosModels: ["NotebookUpdateResponse"],
    cacheNotes: "The client queues updates offline.",
    idempotencyNotes: "No HTTP idempotency identity is sent.",
    blocker: {
      kind: "path_mismatch",
      reason: "Backend PATCH exists on /book/me/notebook with highlightId in the body; iOS sends /book/me/notebook/{entryId}.",
      evidence: ["app/app/api/book/me/notebook/route.ts exports PATCH on the base path"],
      candidate: {
        routeSource: "app/app/api/book/me/notebook/route.ts",
        methods: ["GET", "POST", "PATCH", "DELETE"],
      },
    },
  }),
  matched({
    id: "settings.patch",
    method: "PATCH",
    routeTemplate: "/book/me/settings",
    matrixRowId: "notification-preferences",
    requests: [
      {
        producer:
          "patchNotificationSettings@Packages/Networking/Sources/Networking/Endpoint+Notifications.swift:15",
        body: jsonBody({
          notifications: { enabled: true, reminderHour: 9, reminderMinute: 0 },
        }),
      },
      {
        producer:
          "updateSettings@Packages/Networking/Sources/Networking/Endpoint.swift:318",
        body: jsonBody({ privacy: { analyticsParticipation: false } }),
      },
    ],
    callSites: [
      "NotificationPreferencesRepository.swift:37",
      "LiveSocialRepository.swift:35",
      "SettingsRepository.swift:97",
    ],
    iosModels: ["UserSettingsResponse", "SettingsUpdateResponse", "ReadingSettingsResponse"],
    cacheNotes: "No repository cache; PATCH must not erase unrelated settings.",
    idempotencyNotes: "Repeated identical partial PATCHes are logically idempotent; optimistic concurrency uses updatedAt where supplied.",
    responseBody: json({
      settings: {
        notifications: { enabled: true, reminderHour: 9, reminderMinute: 0 },
        privacy: { analyticsParticipation: false },
      },
      updatedAt: "2026-01-01T00:00:00.000Z",
    }),
    responseSources: [
      { path: "app/app/api/book/_lib/user-settings-repo.ts", role: "response_builder" },
      { path: "app/app/api/book/_lib/http-guards-core.ts", role: "request_validator" },
    ],
    authority: { classification: "private_data", pointers: ["/settings"] },
  }),
  blocked({
    id: "ask-book.post",
    method: "POST",
    routeTemplate: "/book/books/{bookId}/ask",
    matrixRowId: "ask-the-book",
    requests: [
      {
        producer: "askBook@Packages/Networking/Sources/Networking/Endpoint.swift:413",
        body: jsonBody({
          question: "What is the synthetic lesson?",
          context: "book-synthetic-ch01",
          tone: "direct",
          history: [],
        }),
        compatibility: "client_drift",
      },
    ],
    callSites: ["LiveAIRepository.swift:24"],
    iosModels: ["BookAskResponse"],
    cacheNotes: "Private questions/history; cached answers remain server-side.",
    idempotencyNotes: "Question quota is reserved per request; no idempotency identity is sent.",
    blocker: {
      kind: "response_mismatch",
      reason: "Backend returns text/event-stream SSE tokens while the native API client decodes one JSON BookAskResponse.",
      evidence: [
        "app/app/api/book/books/[bookId]/ask/route.ts:429-436 returns text/event-stream",
        "Packages/AIFeature/Sources/AIFeature/Repository/LiveAIRepository.swift:24 decodes BookAskResponse",
      ],
      candidate: {
        routeSource: "app/app/api/book/books/[bookId]/ask/route.ts",
        methods: ["POST"],
      },
    },
  }),
  blocked({
    id: "quiz-check.post",
    method: "POST",
    routeTemplate: "/book/books/{bookId}/chapters/{chapterNumber}/quiz/check",
    matrixRowId: "quiz-load-check-events",
    requests: [
      {
        producer:
          "checkQuizAnswer@Packages/QuizFeature/Sources/QuizFeature/Endpoints+Quiz.swift:24",
        body: jsonBody({ questionId: "question-synthetic-1", choiceId: "choice-a" }),
        compatibility: "client_drift",
      },
    ],
    callSites: ["LiveQuizRepository.swift:153"],
    iosModels: ["QuizCheckResult"],
    cacheNotes: "Online-only correctness check; no caching.",
    idempotencyNotes: "Read-only grading oracle, but no request identity is sent.",
    blocker: {
      kind: "path_mismatch",
      reason: "Backend path is /book/me/quiz/{bookId}/{chapterNumber}/check and expects responses:[{questionId,selectedChoiceId}], not the native singleton body.",
      evidence: [
        "Packages/QuizFeature/Sources/QuizFeature/Endpoints+Quiz.swift:21-34 Endpoint.checkQuizAnswer defines the native path and singleton body",
        "Packages/QuizFeature/Sources/QuizFeature/QuizTypes.swift:23-27 defines the native questionId/choiceId DTO",
        "app/app/api/book/me/quiz/[bookId]/[chapterNumber]/check/route.ts:23-86 validates the responses array",
        "app/app/api/book/me/quiz/[bookId]/[chapterNumber]/check/route.ts:101-156 parses the request and returns the result array",
      ],
      candidate: {
        routeSource: "app/app/api/book/me/quiz/[bookId]/[chapterNumber]/check/route.ts",
        methods: ["POST"],
      },
    },
  }),
  matched({
    id: "account-deactivate.post",
    method: "POST",
    routeTemplate: "/book/me/account/deactivate",
    matrixRowId: "account-deactivation",
    auth: "cognito_id_token",
    requests: [
      {
        producer:
          "deactivateAccount@Packages/Networking/Sources/Networking/Endpoint+Account.swift:15",
        body: jsonBody({}),
      },
    ],
    callSites: ["SettingsRepository.swift:106"],
    iosModels: ["AccountLifecycleResponse"],
    cacheNotes: "On success the app must tear down the session and purge account-owned caches.",
    idempotencyNotes: "Repeated deactivation is intended to converge on inactive state; external subscription cancellation may be retried.",
    responseBody: json({ success: true, redirectTo: "/auth/logout" }),
    responseSources: [
      { path: "app/app/api/book/_lib/account-status-transition.ts", role: "response_builder" },
      { path: "app/app/api/book/_lib/entitlement-repo.ts", role: "response_builder" },
      { path: "app/app/api/book/_lib/account-repo.ts", role: "response_builder" },
    ],
    authority: { classification: "server_decision", pointers: ["/success"] },
  }),
  blocked({
    id: "account-delete.post",
    method: "POST",
    routeTemplate: "/book/me/account/delete",
    matrixRowId: "account-deletion",
    auth: "recent_auth_user",
    requests: [
      {
        producer:
          "deleteAccount@Packages/Networking/Sources/Networking/Endpoint+Account.swift:23",
        body: jsonBody({}),
        compatibility: "client_drift",
      },
    ],
    callSites: ["SettingsRepository.swift:112"],
    iosModels: ["AccountLifecycleResponse"],
    cacheNotes: "Destructive account state is never cached as success before backend acknowledgment.",
    idempotencyNotes: "Backend requires recent auth and exact confirmation before transitioning state.",
    blocker: {
      kind: "request_mismatch",
      reason: "Native sends {}; backend requires {confirm:\"DELETE\"} plus recent authentication.",
      evidence: [
        "Packages/Networking/Sources/Networking/Endpoint+Account.swift:20-26 Endpoint.deleteAccount sends an empty JSON object",
        "app/app/api/book/me/account/delete/route.ts:31-60 POST calls requireUser and requireRecentAuth, then requires confirm=DELETE",
        "app/app/api/_lib/auth.ts:131-199 requireUser and requireRecentAuth define the identity and recency gates",
        "app/app/api/book/_lib/account-guard.ts:13-27 documents account delete as an intentional requireActiveBookUser bypass",
      ],
      candidate: {
        routeSource: "app/app/api/book/me/account/delete/route.ts",
        methods: ["POST"],
      },
    },
  }),
  matched({
    id: "apple-verify.post",
    method: "POST",
    routeTemplate: "/book/me/billing/apple/verify",
    matrixRowId: "apple-purchase-verification",
    requests: [
      {
        producer:
          "verifyApplePurchase@Packages/PaywallFeature/Sources/PaywallFeature/BillingEndpoints.swift:14",
        body: jsonBody({ transactionJWS: "synthetic-jws-placeholder" }),
      },
      {
        producer:
          "LiveEntitlementRepository.verifyAppleTransaction@Packages/PaywallFeature/Sources/PaywallFeature/LiveEntitlementRepository.swift:20",
        body: jsonBody({ transactionJWS: "synthetic-jws-placeholder" }),
      },
    ],
    callSites: ["StoreKitService.swift:398", "LiveEntitlementRepository.swift:18-29"],
    iosModels: ["EntitlementResponse", "Entitlement", "Paywall"],
    cacheNotes: "The backend grant is authoritative; StoreKit transaction is finished only after success.",
    idempotencyNotes: "The transaction identity is the replay/claim guard.",
    responseBody: json({
      entitlement: {
        plan: "PRO",
        proStatus: "active",
        proSource: "apple",
        freeBookSlots: 1,
        unlockedBookIds: [],
        unlockedBooksCount: 0,
        remainingFreeStarts: 1,
        cancelAtPeriodEnd: false,
      },
      paywall: null,
    }),
    responseSources: [
      {
        path: "app/app/api/book/_lib/apple-verify-service-core.ts",
        role: "response_builder",
      },
      {
        path: "app/app/api/book/_lib/apple-purchase-policy-core.ts",
        role: "request_validator",
      },
      {
        path: "app/app/api/book/_lib/apple-entitlement-write-core.ts",
        role: "response_builder",
      },
    ],
    authority: {
      classification: "entitlement",
      pointers: ["/entitlement/plan", "/entitlement/proStatus"],
    },
  })
);

nativeContractOperationDefinitions.push(
  blocked({
    id: "pair.get",
    method: "GET",
    routeTemplate: "/book/me/pairs/{partnerId}",
    matrixRowId: "reading-pairs",
    requests: [
      {
        producer: "getPair@Packages/Networking/Sources/Networking/Endpoint.swift:583",
        compatibility: "client_drift",
      },
    ],
    callSites: ["LiveSocialRepository.swift:71"],
    iosModels: ["PairResponse", "ReadingPair"],
    cacheNotes: "No cache was observed.",
    idempotencyNotes: "Safe read if implemented.",
    blocker: {
      kind: "method_mismatch",
      reason: "The backend partner route exports DELETE only.",
      evidence: ["app/app/api/book/me/pairs/[partnerId]/route.ts:12 exports DELETE"],
      candidate: {
        routeSource: "app/app/api/book/me/pairs/[partnerId]/route.ts",
        methods: ["DELETE"],
      },
    },
  }),
  matched({
    id: "own-profile.get",
    method: "GET",
    routeTemplate: "/book/me/profile",
    matrixRowId: "profile-social",
    requests: [
      {
        producer:
          "getMyProfile@Packages/Networking/Sources/Networking/Endpoint.swift:284",
      },
    ],
    callSites: ["LiveSocialRepository.swift:25"],
    iosModels: ["OwnProfileResponse", "OwnProfile"],
    cacheNotes: "No client cache was observed.",
    idempotencyNotes: "Safe authenticated read.",
    responseBody: json({
      profile: null,
      identity: {
        sub: "user-synthetic",
        displayName: "Synthetic Reader",
      },
      inferredLocation: null,
      updatedAt: null,
    }),
    responseSources: [
      { path: "app/app/api/book/_lib/identity.ts", role: "response_builder" },
      { path: "app/app/api/book/_lib/user-profile-repo.ts", role: "response_builder" },
      { path: "app/app/api/book/_lib/user-settings-repo.ts", role: "response_builder" },
    ],
    authority: { classification: "identity", pointers: ["/identity/sub"] },
  }),
  matched({
    id: "progress.get",
    method: "GET",
    routeTemplate: "/book/me/progress",
    matrixRowId: "progress-overview",
    requests: [
      {
        producer:
          "getProgressOverview@Packages/Networking/Sources/Networking/Endpoint.swift:121",
      },
    ],
    callSites: ["LiveLibraryRepository.swift:104", "EngagementRepository.swift:147"],
    iosModels: ["ProgressOverviewResponse", "ProgressOverviewItem"],
    cacheNotes: "Account-scoped memory/disk cache; a stale label is required when used offline.",
    idempotencyNotes: "Safe authenticated read.",
    responseBody: json({
      summary: {
        booksStarted: 0,
        booksCompleted: 0,
        chaptersCompleted: 0,
      },
      books: [],
    }),
    responseSources: [
      { path: "app/app/api/book/_lib/entitlement-repo.ts", role: "response_builder" },
      { path: "app/app/api/book/_lib/progress-repo.ts", role: "response_builder" },
      { path: "app/app/api/book/_lib/book-completion-core.ts", role: "response_builder" },
    ],
    authority: { classification: "private_data", pointers: ["/books"] },
  }),
  blocked({
    id: "referral-profile.get",
    method: "GET",
    routeTemplate: "/book/me/referrals",
    matrixRowId: "gifts-referrals",
    requests: [
      {
        producer:
          "getReferralProfile@Packages/Networking/Sources/Networking/Endpoint+Referrals.swift:11",
        compatibility: "client_drift",
      },
    ],
    callSites: ["LiveSocialRepository.swift:211"],
    iosModels: ["ReferralProfileResponse", "ReferralProfile"],
    cacheNotes: "No cache was observed.",
    idempotencyNotes: "Safe read if implemented.",
    blocker: {
      kind: "missing_route",
      reason: "No backend /book/me/referrals route exists; referral data is embedded in other aggregates only.",
      evidence: ["backend tree at behavior revision 968ff67 contains no me/referrals route"],
    },
  }),
  blocked({
    id: "reflections.get",
    method: "GET",
    routeTemplate: "/book/me/reflections/{bookId}/{chapterNumber}",
    requests: [
      {
        producer:
          "getReflections@Packages/Networking/Sources/Networking/Endpoint+Reflections.swift:6",
        compatibility: "client_drift",
      },
    ],
    callSites: ["LiveSocialRepository.swift:119"],
    iosModels: ["ReflectionsResponse", "ChapterReflection"],
    cacheNotes: "A local outbox exists for writes; no backend read can currently reconcile it.",
    idempotencyNotes: "Safe read if implemented.",
    blocker: {
      kind: "method_mismatch",
      reason: "The backend reflection item route exports POST only.",
      evidence: [
        "app/app/api/book/me/reflections/[bookId]/[chapterNumber]/route.ts:28 exports POST",
      ],
      candidate: {
        routeSource:
          "app/app/api/book/me/reflections/[bookId]/[chapterNumber]/route.ts",
        methods: ["POST"],
      },
    },
  }),
  matched({
    id: "reviews.get",
    method: "GET",
    routeTemplate: "/book/me/reviews",
    matrixRowId: "fsrs-reviews",
    requests: [
      { producer: "getReviews@Packages/Networking/Sources/Networking/Endpoint.swift:249" },
    ],
    callSites: ["ReviewsRepository.swift:88"],
    iosModels: ["ReviewsResponse", "FsrsCard"],
    cacheNotes: "iOS uses account-scoped memory and disk cache.",
    idempotencyNotes: "Safe authenticated read.",
    responseBody: json({ cards: [], count: 0 }),
    responseSources: [
      { path: "app/app/api/book/_lib/fsrs-repo.ts", role: "response_builder" },
      { path: "app/app/api/book/_lib/fsrs.ts", role: "response_builder" },
    ],
    authority: { classification: "private_data", pointers: ["/cards"] },
    pagination: "Optional limit (max 50) and bookId filters; no continuation cursor.",
  }),
  matched({
    id: "saved.get",
    method: "GET",
    routeTemplate: "/book/me/saved",
    matrixRowId: "saved-books",
    requests: [
      {
        producer:
          "getSavedBooks@Packages/Networking/Sources/Networking/Endpoint.swift:126",
      },
    ],
    callSites: ["LiveLibraryRepository.swift:137", "NotebookRepository.swift:105"],
    iosModels: ["SavedBooksResponse"],
    cacheNotes: "Private saved state must be account-scoped.",
    idempotencyNotes: "Safe authenticated read.",
    responseBody: json({ saved: [], savedBookIds: [] }),
    responseSources: [
      { path: "app/app/api/book/_lib/saved-books-repo.ts", role: "response_builder" },
    ],
    authority: {
      classification: "private_data",
      pointers: ["/savedBookIds"],
    },
  }),
  matched({
    id: "settings.get",
    method: "GET",
    routeTemplate: "/book/me/settings",
    matrixRowId: "notification-preferences",
    requests: [
      {
        producer:
          "getSettings@Packages/Networking/Sources/Networking/Endpoint+Notifications.swift:7",
      },
    ],
    callSites: ["NotificationPreferencesRepository.swift:31", "SettingsRepository.swift:84"],
    iosModels: ["UserSettingsResponse", "ReadingSettingsResponse"],
    cacheNotes: "No client repository cache was observed.",
    idempotencyNotes: "Safe authenticated read.",
    responseBody: json({ settings: null, updatedAt: null }),
    responseSources: [
      { path: "app/app/api/book/_lib/user-settings-repo.ts", role: "response_builder" },
    ],
    authority: { classification: "private_data", pointers: ["/settings"] },
  }),
  matched({
    id: "shop.get",
    method: "GET",
    routeTemplate: "/book/me/shop",
    requests: [
      { producer: "getShop@Packages/Networking/Sources/Networking/Endpoint.swift:218" },
    ],
    callSites: ["EngagementRepository.swift:218"],
    iosModels: ["ShopResponse", "ShopItem"],
    cacheNotes: "iOS memory TTL is 300 seconds with disk fallback.",
    idempotencyNotes: "Safe authoritative read.",
    responseBody: json({
      items: [],
      giftAFriend: {
        id: "gift-a-friend",
        name: "Gift a Friend",
        cost: 1000,
        affordable: false,
      },
    }),
    responseSources: [
      { path: "app/book/_lib/personalization-catalog.ts", role: "schema" },
      { path: "app/app/api/book/_lib/flow-points-repo.ts", role: "response_builder" },
    ],
    authority: { classification: "server_decision", pointers: ["/items"] },
  }),
  matched({
    id: "streak.get",
    method: "GET",
    routeTemplate: "/book/me/streak",
    requests: [
      { producer: "getStreak@Packages/Networking/Sources/Networking/Endpoint.swift:208" },
    ],
    callSites: ["EngagementRepository.swift:127"],
    iosModels: ["StreakResponse", "StreakState"],
    cacheNotes: "iOS uses memory TTL and account-owned disk cache.",
    idempotencyNotes: "Safe authoritative read.",
    responseBody: json({
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: null,
      shieldsHeld: 0,
      nextMilestone: null,
    }),
    responseSources: [
      { path: "app/app/api/book/_lib/streak-repo.ts", role: "response_builder" },
    ],
    authority: {
      classification: "server_decision",
      pointers: ["/currentStreak", "/longestStreak"],
    },
  })
);

nativeContractOperationDefinitions.push(
  matched({
    id: "entitlements.get",
    method: "GET",
    routeTemplate: "/book/me/entitlements",
    matrixRowId: "entitlements-paywall",
    auth: "cognito_id_token",
    requests: [
      {
        producer:
          "getEntitlements@Packages/Networking/Sources/Networking/Endpoint.swift:116",
      },
    ],
    callSites: ["LiveEntitlementRepository.swift:15", "EntitlementService.swift:201"],
    iosModels: ["EntitlementResponse", "Entitlement", "Paywall"],
    cacheNotes: "Server-authoritative; last-known client state is presentation-only.",
    idempotencyNotes: "Safe authenticated read.",
    responseBody: json({
      entitlement: {
        plan: "FREE",
        proStatus: "inactive",
        freeBookSlots: 1,
        unlockedBookIds: [],
        unlockedBooksCount: 0,
        remainingFreeStarts: 1,
        cancelAtPeriodEnd: false,
      },
      paywall: {
        price: "$9.99/month",
        pricingTiers: [],
        benefits: ["Unlock unlimited books"],
      },
    }),
    responseSources: [
      { path: "app/app/api/book/_lib/entitlement-repo.ts", role: "response_builder" },
      { path: "lib/pricing.ts", role: "schema" },
    ],
    authority: {
      classification: "entitlement",
      pointers: [
        "/entitlement/plan",
        "/entitlement/freeBookSlots",
        "/entitlement/unlockedBookIds",
        "/entitlement/unlockedBooksCount",
        "/entitlement/remainingFreeStarts",
      ],
    },
  }),
  matched({
    id: "event-progress.get",
    method: "GET",
    routeTemplate: "/book/me/events/{eventId}/progress",
    requests: [
      {
        producer:
          "getEventProgress@Packages/Networking/Sources/Networking/Endpoint.swift:368",
      },
    ],
    callSites: ["SeasonalEventRepository.swift:105"],
    iosModels: ["EventProgressResponse", "EventProgress"],
    cacheNotes: "iOS uses an in-memory TTL.",
    idempotencyNotes: "Safe authenticated read.",
    responseBody: json({
      progress: {
        eventId: "eventId-synthetic",
        chaptersCompleted: 0,
        dailyChaptersCompleted: 0,
        isCompleted: false,
      },
    }),
    responseSources: [
      { path: "app/app/api/book/_lib/events-repo.ts", role: "response_builder" },
    ],
    authority: { classification: "private_data", pointers: ["/progress/eventId"] },
  }),
  matched({
    id: "export.get",
    method: "GET",
    routeTemplate: "/book/me/export",
    matrixRowId: "data-export",
    auth: "recent_auth_user",
    requests: [
      {
        producer:
          "getExport@Packages/Networking/Sources/Networking/Endpoint+Account.swift:9",
      },
    ],
    callSites: ["SettingsRepository.swift:103"],
    iosModels: ["RawExportData"],
    decoder: "SettingsRepository returns response Data without model decoding",
    cacheNotes: "Privacy-sensitive export is never cached by the repository.",
    idempotencyNotes: "Safe recent-auth read.",
    responseBody: { kind: "binary", contentType: "application/json", syntheticByteLength: 128 },
    responseHeaders: [
      { name: "Content-Type", value: "application/json" },
      {
        name: "Content-Disposition",
        value: "attachment; filename=\"chapterflow-export-synthetic.json\"",
      },
    ],
    responseSources: [
      { path: "app/app/api/book/_lib/export-manifest-core.ts", role: "response_builder" },
      { path: "app/app/api/book/_lib/entitlement-repo.ts", role: "response_builder" },
      { path: "app/app/api/book/_lib/user-profile-repo.ts", role: "response_builder" },
      { path: "app/app/api/book/_lib/user-settings-repo.ts", role: "response_builder" },
    ],
  }),
  matched({
    id: "flow-points.get",
    method: "GET",
    routeTemplate: "/book/me/flow-points",
    requests: [
      {
        producer:
          "getFlowPoints@Packages/Networking/Sources/Networking/Endpoint.swift:213",
      },
    ],
    callSites: ["EngagementRepository.swift:194"],
    iosModels: ["FlowPointsResponse", "FlowPointsState", "FlowLedgerEntry"],
    cacheNotes: "iOS memory TTL is 120 seconds with account-owned disk fallback.",
    idempotencyNotes: "Safe authoritative read.",
    responseBody: json({
      summary: {
        balance: 0,
        lifetimeEarned: 0,
        lifetimeSpent: 0,
        rewardReadyCount: 0,
        nextReward: null,
      },
      rewards: [],
      recentTransactions: [],
      referral: {
        code: "REF-SYNTHETIC",
        path: "/ref/REF-SYNTHETIC",
        pendingInvites: 0,
        activatedInvites: 0,
        proInvites: 0,
        activationPointsEarned: 0,
        proPointsEarned: 0,
      },
      waysToEarn: [],
    }),
    responseSources: [
      { path: "app/app/api/book/_lib/flow-points-repo.ts", role: "response_builder" },
    ],
    authority: {
      classification: "server_decision",
      pointers: ["/summary/balance"],
    },
  }),
  matched({
    id: "gift-preview.get",
    method: "GET",
    routeTemplate: "/book/me/gifts/{code}",
    matrixRowId: "gifts-referrals",
    requests: [
      { producer: "getGift@Packages/Networking/Sources/Networking/Endpoint.swift:293" },
    ],
    callSites: ["LiveSocialRepository.swift:87"],
    iosModels: ["GiftPreviewResponse", "Gift"],
    cacheNotes: "Gift codes are ephemeral and are not cached.",
    idempotencyNotes: "Safe authenticated preview.",
    responseBody: json({
      status: "available",
      giftType: "pro_week",
      proDays: 7,
      senderName: "Synthetic Reader",
    }),
    responseSources: [
      { path: "app/app/api/book/_lib/user-profile-repo.ts", role: "response_builder" },
    ],
    authority: { classification: "server_decision", pointers: ["/status"] },
  }),
  blocked({
    id: "user-journey.get",
    method: "GET",
    routeTemplate: "/book/me/journeys/{journeyId}",
    requests: [
      {
        producer:
          "getUserJourney@Packages/Networking/Sources/Networking/Endpoint.swift:387",
      },
    ],
    callSites: ["JourneysRepository.swift:82"],
    iosModels: ["UserJourneyResponse", "UserJourney"],
    cacheNotes: "iOS uses memory and disk fallback.",
    idempotencyNotes: "Safe authenticated read.",
    blocker: {
      kind: "response_mismatch",
      reason: "Backend nests progress under journey.progress; native UserJourney requires currentBookIndex/completedBookIds/isCompleted/startedAt/completedAt at the journey level.",
      evidence: [
        "app/app/api/book/me/journeys/[journeyId]/route.ts:52-61 returns {journey:{...definition,progress}}",
        "Packages/Models/Sources/Models/Engagement/Journey.swift requires flat user-state fields",
      ],
      candidate: {
        routeSource: "app/app/api/book/me/journeys/[journeyId]/route.ts",
        methods: ["GET"],
      },
    },
  }),
  matched({
    id: "notebook.get",
    method: "GET",
    routeTemplate: "/book/me/notebook",
    matrixRowId: "notebook",
    requests: [
      {
        producer:
          "getNotebook@Packages/Networking/Sources/Networking/Endpoint.swift:334",
      },
    ],
    callSites: ["NotebookRepository.swift:83"],
    iosModels: ["NotebookResponse", "NotebookEntry"],
    cacheNotes: "iOS memory and disk cache must be account-scoped.",
    idempotencyNotes: "Safe authenticated read.",
    responseBody: json({ entries: [], totalCount: 0 }),
    responseSources: [
      { path: "app/app/api/book/_lib/notebook-highlight-repo.ts", role: "response_builder" },
      { path: "app/app/api/book/_lib/notebook-entries.ts", role: "response_builder" },
    ],
    authority: { classification: "private_data", pointers: ["/entries"] },
    pagination: "Optional bookId/chapterId query filters; no server pagination cursor.",
  }),
  matched({
    id: "notifications.get",
    method: "GET",
    routeTemplate: "/book/me/notifications",
    matrixRowId: "notification-inbox",
    requests: [
      {
        producer:
          "getNotifications@Packages/Networking/Sources/Networking/Endpoint+Notifications.swift:20",
      },
    ],
    callSites: ["NotificationInboxRepository.swift:50"],
    iosModels: ["NotificationsResponse", "AppNotification"],
    cacheNotes: "The existing iOS UserDefaults cache is not account-scoped; backend response is private.",
    idempotencyNotes: "Safe authenticated read.",
    responseBody: json({ notifications: [], unreadCount: 0 }),
    responseSources: [
      { path: "app/app/api/book/_lib/notifications-repo.ts", role: "response_builder" },
    ],
    authority: {
      classification: "private_data",
      pointers: ["/notifications", "/unreadCount"],
    },
  }),
  matched({
    id: "onboarding-progress.get",
    method: "GET",
    routeTemplate: "/book/me/onboarding/progress",
    matrixRowId: "onboarding",
    requests: [
      {
        producer:
          "getOnboardingProgress@Packages/Networking/Sources/Networking/Endpoint+Onboarding.swift:9",
      },
    ],
    callSites: ["OnboardingRepository.swift:31"],
    iosModels: ["OnboardingGetProgressResponse"],
    cacheNotes: "No repository cache; missing progress is represented in the response.",
    idempotencyNotes: "Safe authenticated read.",
    responseBody: json({
      onboardingCompleted: false,
      progress: null,
      preferences: null,
    }),
    responseSources: [
      { path: "app/app/api/book/_lib/user-settings-repo.ts", role: "response_builder" },
    ],
    authority: {
      classification: "private_data",
      pointers: ["/onboardingCompleted"],
    },
  }),
  matched({
    id: "pairs.get",
    method: "GET",
    routeTemplate: "/book/me/pairs",
    matrixRowId: "reading-pairs",
    requests: [
      { producer: "getPairs@Packages/Networking/Sources/Networking/Endpoint.swift:566" },
    ],
    callSites: ["LiveSocialRepository.swift:54"],
    iosModels: ["PairsListResponse", "ReadingPair"],
    cacheNotes: "No client cache was observed.",
    idempotencyNotes: "Safe authenticated read.",
    responseBody: json({ pair: null, partner: null }),
    responseSources: [
      { path: "app/app/api/book/_lib/pair-repo.ts", role: "response_builder" },
    ],
    authority: { classification: "private_data", pointers: ["/pair"] },
  })
);

nativeContractOperationDefinitions.push(
  matched({
    id: "mobile-config.get",
    method: "GET",
    routeTemplate: "/book/config/ios",
    matrixRowId: "mobile-config",
    auth: "public",
    requests: [
      {
        producer:
          "getIOSConfig@Packages/Networking/Sources/Networking/Endpoint+Config.swift:12",
      },
    ],
    callSites: ["AppConfigService.swift:98"],
    iosModels: ["IOSAppConfig"],
    cacheNotes: "Backend public max-age=300; iOS keeps a last-good fail-open configuration.",
    idempotencyNotes: "Safe public read.",
    responseBody: json({
      minSupportedVersion: "1.0.0",
      latestVersion: "1.0.0",
      featureFlags: {},
      storeKitProductIds: [
        "com.chapterflow.pro.monthly",
        "com.chapterflow.pro.annual",
      ],
      appStoreURL: "https://apps.apple.com/ca/app/chapterflow/id1234567890",
      maintenanceMode: false,
    }),
    responseHeaders: [{ name: "Cache-Control", value: "public, max-age=300" }],
    responseSources: [
      {
        path: "app/app/api/book/config/ios/config-core.ts",
        role: "response_builder",
      },
      {
        path: "app/app/api/book/_lib/apple-purchase-policy-core.ts",
        role: "request_validator",
      },
    ],
    serializerProof: {
      kind: "executed_pure_builder",
      module: "app/app/api/book/config/ios/config-core.ts",
      exportedSymbol: "buildIosAppConfig",
      fixtureId: "mobile-config.get:success",
    },
    additionalGaps: [
      {
        kind: "route_error_execution",
        reason: "The success builder is executed, but the GET wrapper and ios_config_unavailable 503 branch are source-fenced rather than hermetically executed by this exporter.",
      },
      {
        kind: "client_authority_enforcement",
        reason: "Current iOS IOSAppConfig decoding defaults missing launch-control fields to fail-open values. WP-DEV-01 owns the configuration gate, so this contract lane records the server-required pointers but does not claim the native client enforces them fail-closed.",
      },
    ],
    additionalErrorFixtures: [
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
      },
    ],
    authority: {
      classification: "server_decision",
      pointers: [
        "/minSupportedVersion",
        "/latestVersion",
        "/featureFlags",
        "/storeKitProductIds",
        "/appStoreURL",
        "/maintenanceMode",
      ],
    },
    versionSemantics: "minSupportedVersion and latestVersion are semantic app versions; no request query is required.",
  }),
  matched({
    id: "seasonal-event.get",
    method: "GET",
    routeTemplate: "/book/events/active",
    requests: [
      {
        producer:
          "getActiveEvent@Packages/Networking/Sources/Networking/Endpoint.swift:357",
      },
    ],
    callSites: ["SeasonalEventRepository.swift:68"],
    iosModels: ["ActiveEventResponse", "SeasonalEvent"],
    cacheNotes: "iOS uses an in-memory TTL and captures the server date offset.",
    idempotencyNotes: "Safe authenticated read.",
    responseBody: json({ events: [] }),
    responseSources: [
      { path: "app/app/api/book/_lib/events-repo.ts", role: "response_builder" },
      { path: "app/app/api/book/_lib/admin-events-repo.ts", role: "response_builder" },
    ],
  }),
  matched({
    id: "badges.get",
    method: "GET",
    routeTemplate: "/book/me/badges",
    requests: [
      { producer: "getBadges@Packages/Networking/Sources/Networking/Endpoint.swift:239" },
    ],
    callSites: ["EngagementRepository.swift:169", "LiveSocialRepository.swift:30"],
    iosModels: ["BadgesResponse", "BadgeItem"],
    cacheNotes: "iOS uses memory and disk cache.",
    idempotencyNotes: "Safe authenticated read.",
    responseBody: json({ awards: [] }),
    responseSources: [
      { path: "app/app/api/book/_lib/book-metrics-repo.ts", role: "response_builder" },
    ],
    authority: { classification: "private_data", pointers: ["/awards"] },
  }),
  blocked({
    id: "blocked-users.get",
    method: "GET",
    routeTemplate: "/book/me/blocks",
    matrixRowId: "profile-social",
    requests: [
      {
        producer:
          "getBlockedUsers@Packages/Networking/Sources/Networking/Endpoint+Safety.swift:39",
        compatibility: "client_drift",
      },
    ],
    callSites: ["LiveSocialRepository.swift:186"],
    iosModels: ["BlockedUsersResponse"],
    cacheNotes: "iOS keeps an in-memory set; its source marks the backend as TODO.",
    idempotencyNotes: "Safe read if implemented.",
    blocker: {
      kind: "missing_route",
      reason: "No backend route exists at app/app/api/book/me/blocks/route.ts.",
      evidence: [
        "Packages/Networking/Sources/Networking/Endpoint+Safety.swift:39-41",
        "backend tree at behavior revision 968ff67 contains no me/blocks route",
      ],
    },
  }),
  matched({
    id: "scenarios.get",
    method: "GET",
    routeTemplate: "/book/me/books/{bookId}/chapters/{chapterNumber}/scenarios",
    requests: [
      {
        producer:
          "getScenarios@Packages/Networking/Sources/Networking/Endpoints+Scenarios.swift:12",
      },
    ],
    callSites: ["ScenarioRepository.swift:56"],
    iosModels: ["ScenariosResponse", "UserScenario", "CommunityScenario"],
    cacheNotes: "iOS merges an in-memory cache with pending local submissions.",
    idempotencyNotes: "Safe authenticated read.",
    responseBody: json({
      approvedScenarios: [],
      mySubmissions: [],
      weeklyRemaining: 3,
    }),
    responseSources: [
      { path: "app/app/api/book/_lib/scenario-repo.ts", role: "response_builder" },
      { path: "app/app/api/book/_lib/book-metrics-repo.ts", role: "response_builder" },
      { path: "app/app/api/book/_lib/ai-service.ts", role: "response_builder" },
    ],
  }),
  matched({
    id: "depth-recommendation.get",
    method: "GET",
    routeTemplate: "/book/me/books/{bookId}/depth-recommendation",
    requests: [
      {
        producer:
          "getDepthRecommendation@Packages/Networking/Sources/Networking/Endpoint.swift:440",
      },
    ],
    callSites: ["LiveAIRepository.swift:39"],
    iosModels: ["DepthRecommendation"],
    cacheNotes: "No explicit iOS cache was observed.",
    idempotencyNotes: "Safe authenticated read.",
    responseBody: json({
      recommendedDepth: "standard",
      confidence: 0,
      reason: "Not enough history yet.",
      hasData: false,
    }),
    responseSources: [
      { path: "app/app/api/book/_lib/depth-routing.ts", role: "response_builder" },
      { path: "app/app/api/book/_lib/depth-routing-core.ts", role: "response_builder" },
    ],
  }),
  matched({
    id: "book-state.get",
    method: "GET",
    routeTemplate: "/book/me/books/{bookId}/state",
    matrixRowId: "book-state-cursor-preferences",
    requests: [
      { producer: "getBookState@Packages/Networking/Sources/Networking/Endpoint.swift:138" },
    ],
    callSites: ["LiveBookDetailRepository.swift:18", "LiveReaderRepository.swift:257"],
    iosModels: ["BookStateResponse", "BookStateResponseEnvelope", "BookUserBookState"],
    cacheNotes: "Private state belongs in an account-scoped cache; current client has an anonymous fallback risk.",
    idempotencyNotes: "Safe authenticated read.",
    optionality: "stateStatus is required on canonical GET success; older deployed responses may omit it until this additive contract is deployed.",
    responseBody: json(buildBookStateGetResponse({
      state: {
        bookId: "book-synthetic",
        completedChapterIds: [],
        unlockedChapterIds: ["book-synthetic-ch01"],
        chapterScores: {},
        chapterCompletedAt: {},
        currentChapterId: "book-synthetic-ch01",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      applicationStates: {},
      hasBookState: true,
      hasProgress: false,
    })),
    responseSources: [
      {
        path: "app/app/api/book/_lib/book-state-status-core.ts",
        role: "response_builder",
      },
      {
        path: "app/app/api/book/_lib/content-service.ts",
        role: "response_builder",
      },
      { path: "app/app/api/book/_lib/progress-repo.ts", role: "response_builder" },
      { path: "app/app/api/book/_lib/book-state-repo.ts", role: "response_builder" },
      { path: "app/app/api/book/_lib/progress-write-core.ts", role: "response_builder" },
      { path: "app/app/api/book/_lib/types.ts", role: "schema" },
    ],
    serializerProof: {
      kind: "executed_pure_builder",
      module: "app/app/api/book/_lib/book-state-status-core.ts",
      exportedSymbol: "buildBookStateGetResponse",
      fixtureId: "book-state.get:success",
    },
    authority: {
      classification: "private_data",
      pointers: ["/stateStatus", "/state/bookId", "/state/unlockedChapterIds"],
    },
    additionalErrorFixtures: [
      {
        status: 404,
        code: "book_not_found",
        headers: [],
        body: {
          error: {
            code: "book_not_found",
            message: "Published book not found.",
            requestId: "req_synthetic_book_state_get_missing_book",
          },
        },
      },
      {
        status: 404,
        code: "book_version_not_found",
        headers: [],
        body: {
          error: {
            code: "book_version_not_found",
            message: "Published version not found.",
            requestId: "req_synthetic_book_state_get_missing_version",
          },
        },
      },
    ],
  }),
  matched({
    id: "commitments.get",
    method: "GET",
    routeTemplate: "/book/me/commitments",
    matrixRowId: "commitments",
    requests: [
      {
        producer:
          "getCommitments@Packages/Networking/Sources/Networking/Endpoint.swift:462",
      },
    ],
    callSites: ["CommitmentRepository.swift:49"],
    iosModels: ["CommitmentsResponse", "Commitment"],
    cacheNotes: "iOS merges memory state with pending local creates.",
    idempotencyNotes: "Safe authenticated read.",
    responseBody: json({ commitments: [] }),
    responseSources: [
      { path: "app/app/api/book/_lib/commitment-repo.ts", role: "response_builder" },
    ],
    authority: { classification: "private_data", pointers: ["/commitments"] },
  }),
  blocked({
    id: "commitment.get",
    method: "GET",
    routeTemplate: "/book/me/commitments/{commitmentId}",
    matrixRowId: "commitments",
    requests: [
      {
        producer:
          "getCommitment@Packages/Networking/Sources/Networking/Endpoint.swift:502",
        compatibility: "client_drift",
      },
    ],
    callSites: ["CommitmentRepository.swift:132"],
    iosModels: ["CommitmentResponse", "Commitment"],
    cacheNotes: "iOS would upsert the returned item into memory.",
    idempotencyNotes: "Safe read if implemented.",
    blocker: {
      kind: "method_mismatch",
      reason: "The backend item route exports PATCH only; it has no GET handler.",
      evidence: [
        "app/app/api/book/me/commitments/[commitmentId]/route.ts exports PATCH",
      ],
      candidate: {
        routeSource: "app/app/api/book/me/commitments/[commitmentId]/route.ts",
        methods: ["PATCH"],
      },
    },
  }),
  matched({
    id: "dashboard.get",
    method: "GET",
    routeTemplate: "/book/me/dashboard",
    requests: [
      { producer: "getDashboard@Packages/Networking/Sources/Networking/Endpoint.swift:203" },
    ],
    callSites: ["EngagementRepository.swift:107"],
    iosModels: ["DashboardResponse", "Dashboard"],
    cacheNotes: "iOS uses a memory TTL and account-owned disk cache.",
    idempotencyNotes: "Safe authenticated aggregate read.",
    responseBody: json({
      catalog: [],
      entitlement: { plan: "FREE" },
      profile: null,
      settings: null,
      progress: [],
      bookStates: [],
      chapterStates: [],
      saved: [],
      readingDays: [],
      badgeAwards: [],
      insightPointsBalance: 0,
      partial: false,
      warnings: [],
    }),
    responseSources: [
      {
        path: "app/app/api/book/me/dashboard/dashboard-partial.ts",
        role: "response_builder",
      },
      { path: "app/app/api/book/_lib/entitlement-repo.ts", role: "response_builder" },
      { path: "app/app/api/book/_lib/user-profile-repo.ts", role: "response_builder" },
      { path: "app/app/api/book/_lib/user-settings-repo.ts", role: "response_builder" },
      { path: "app/app/api/book/_lib/book-state-repo.ts", role: "response_builder" },
      { path: "app/app/api/book/_lib/progress-repo.ts", role: "response_builder" },
      { path: "app/app/api/book/_lib/book-metrics-repo.ts", role: "response_builder" },
      { path: "app/app/api/book/_lib/saved-books-repo.ts", role: "response_builder" },
      { path: "app/app/api/book/_lib/library-catalog.ts", role: "response_builder" },
    ],
    authority: {
      classification: "entitlement",
      pointers: ["/entitlement/plan"],
    },
  })
);
