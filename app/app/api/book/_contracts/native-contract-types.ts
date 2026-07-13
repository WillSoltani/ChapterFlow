export type JsonPrimitive = string | number | boolean | null;

export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type NativeContractMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export type NativeContractCoverage = "full" | "partial" | "blocked";

export type NativeContractAuthClass =
  | "public"
  | "cognito_id_token"
  | "active_book_user"
  | "recent_auth_active_user";

export type NativeContractCacheClass = "public" | "private" | "no_store" | "unknown";

export type NativeContractIdempotencyClass =
  | "safe_read"
  | "idempotent_write"
  | "idempotency_keyed"
  | "conditional_once"
  | "non_idempotent"
  | "unknown";

export type NativeContractBlockerKind =
  | "missing_route"
  | "method_mismatch"
  | "path_mismatch"
  | "request_mismatch"
  | "response_mismatch"
  | "unverified";

export type NativeContractRequestBody =
  | { kind: "none" }
  | { kind: "json"; value: JsonValue };

export type NativeContractQueryItem = {
  name: string;
  value: JsonPrimitive;
};

export type NativeContractRequestFixture = {
  operationVariantId: string;
  producerEvidence: string[];
  pathParameters: Record<string, JsonPrimitive>;
  queryItems: NativeContractQueryItem[];
  headers: NativeContractQueryItem[];
  body: NativeContractRequestBody;
  compatibility: "canonical" | "client_drift";
  notes: string;
};

export type NativeContractResponsePayload =
  | { kind: "json"; value: JsonValue }
  | { kind: "empty" }
  | { kind: "binary"; contentType: string; syntheticByteLength: number }
  | { kind: "stream"; contentType: string };

export type NativeContractErrorFixture = {
  status: number;
  code: string;
  headers: NativeContractQueryItem[];
  body: {
    error: {
      code: string;
      message: string;
      requestId: string;
      details?: JsonValue;
    };
  };
};

export type NativeContractSourceRole =
  | "route"
  | "request_validator"
  | "response_builder"
  | "schema"
  | "auth"
  | "error_envelope";

export type NativeContractSourceFile = {
  path: string;
  role: NativeContractSourceRole;
  sourceSha256: string;
};

export type NativeContractBackendEvidence = {
  routeSource: string;
  exportedMethod: NativeContractMethod;
  authClass: NativeContractAuthClass;
  sourceFiles: NativeContractSourceFile[];
  serializerProof:
    | {
        kind: "executed_pure_builder";
        module: string;
        exportedSymbol: string;
        fixtureId: string;
      }
    | {
        kind: "source_fenced";
        reason: string;
      };
};

export type NativeContractBackendCandidate = {
  routeSource: string;
  exportedMethods: NativeContractMethod[];
  sourceFiles: NativeContractSourceFile[];
};

export type NativeContractOperation = {
  id: string;
  method: NativeContractMethod;
  routeTemplate: string;
  matrixRowId: string | null;
  auth: {
    class: NativeContractAuthClass;
    credential: "none" | "Authorization: Bearer <Cognito id_token>" | "conditional_bearer";
  };
  nativeRequestFixtures: NativeContractRequestFixture[];
  cache: {
    class: NativeContractCacheClass;
    cacheControl?: string;
    notes: string;
  };
  idempotency: {
    class: NativeContractIdempotencyClass;
    notes: string;
  };
  responseContract: {
    iosModels: string[];
    decoders: string[];
    optionality: string;
    pagination: string;
    versionSemantics: string;
    assetSemantics: string;
  };
  authority: {
    classification: "none" | "identity" | "entitlement" | "server_decision" | "private_data";
    expectedRequiredPointers: string[];
    failureMode: "not_applicable" | "fail_closed";
  };
  ios: {
    factories: string[];
    callSites: string[];
  };
  coverage: NativeContractCoverage;
  gaps: Array<{
    kind: string;
    reason: string;
  }>;
  backend?: NativeContractBackendEvidence;
  blocker?: {
    kind: NativeContractBlockerKind;
    reason: string;
    evidence: string[];
    expectedRouteSource?: string;
    backendCandidate?: NativeContractBackendCandidate;
  };
  fixtures?: {
    request: NativeContractRequestFixture;
    requestVariants: NativeContractRequestFixture[];
    success: {
      status: number;
      headers: NativeContractQueryItem[];
      payload: NativeContractResponsePayload;
      requiredAuthorityFields: string[];
    };
    deployedCompatibleSuccessAliases: Array<{
      aliasId: string;
      provenance: {
        kind: "backend_source_compatibility" | "deployed_capture";
        revision: string | null;
        environment: "source" | "staging" | "production";
        verified: boolean;
        evidence: string[];
      };
      payload: NativeContractResponsePayload;
      evidence: string[];
    }>;
    errors: NativeContractErrorFixture[];
  };
  evidence: string[];
};

export type NativeContractSourceFileDefinition = Omit<NativeContractSourceFile, "sourceSha256">;

export type NativeContractBackendEvidenceDefinition = Omit<
  NativeContractBackendEvidence,
  "sourceFiles"
> & {
  sourceFiles: NativeContractSourceFileDefinition[];
};

export type NativeContractBackendCandidateDefinition = Omit<
  NativeContractBackendCandidate,
  "sourceFiles"
> & {
  sourceFiles: NativeContractSourceFileDefinition[];
};

export type NativeContractOperationDefinition = Omit<
  NativeContractOperation,
  "backend" | "blocker"
> & {
  backend?: NativeContractBackendEvidenceDefinition;
  blocker?: Omit<NonNullable<NativeContractOperation["blocker"]>, "backendCandidate"> & {
    backendCandidate?: NativeContractBackendCandidateDefinition;
  };
};

export type NativeContractBundle = {
  schemaVersion: "chapterflow-native-contract-bundle-v1";
  contractVersion: "1";
  provenance: {
    backendRepository: "WillSoltani/ChapterFlow";
    sourceRevision: string | null;
    behaviorSourceRevision: string;
    behaviorSourceTimestamp: string;
    sourceRevisionPhase:
      | "uncommitted_backend"
      | "committed_backend_branch"
      | "merged_backend";
    generatedAt: string;
    generatorVersion: "chapterflow-native-contract-generator-v1";
    generatorTreeDigest: string;
    syntheticDataOnly: true;
    deployedRevision: null;
    deployedRevisionVerified: false;
  };
  inventory: {
    uniqueOperationCount: number;
    nativeProducerCount: number;
    matrixRowCount: number;
    iosSourceEvidence: {
      manifestPath: "contracts/native-ios/v1/ios-source-inventory-manifest.json";
      manifestSha256: string;
      iosRepository: "WillSoltani/Chapterflow-IOS";
      iosBaseRevision: string;
      iosSourceRevision: string | null;
      iosSourceRevisionPhase: "uncommitted_contract_branch" | "committed_contract_branch";
      operationKeySha256: string;
      producerVariantIdSha256: string;
      exactFactoryTestedProducerCount: number;
      bundleSuccessDecoderTestedOperationCount: number;
      backendRuntimeFactoryValidationPerformed: false;
      limitation: string;
    };
    matrixRows: Array<{
      id: string;
      operationIds: string[];
    }>;
  };
  errorEnvelope: {
    source: "app/app/api/book/_lib/http.ts";
    required: ["error"];
    errorRequired: ["code", "message", "requestId"];
    errorOptional: ["details"];
    canonicalErrors: Array<{
      status: number;
      code: string;
      retryable: boolean;
      notes: string;
    }>;
  };
  retryAfterPolicy: {
    implemented: boolean;
    fixtureCount: number;
    evidence: string[];
    gap: string | null;
  };
  operations: NativeContractOperation[];
};

export const NATIVE_CONTRACT_MATRIX_ROW_IDS = [
  "catalog",
  "search-index",
  "book-detail-manifest",
  "entitlements-paywall",
  "progress-overview",
  "saved-books",
  "start-book",
  "book-state-cursor-preferences",
  "chapter-content",
  "quiz-load-check-events",
  "quiz-submit",
  "ask-the-book",
  "audio-narration-plan",
  "reading-sessions",
  "notebook",
  "fsrs-reviews",
  "commitments",
  "profile-social",
  "reading-pairs",
  "gifts-referrals",
  "notification-inbox",
  "notification-preferences",
  "apns-device-registration",
  "onboarding",
  "apple-purchase-verification",
  "data-export",
  "account-deactivation",
  "account-deletion",
  "mobile-config",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasJsonPointer(value: JsonValue, pointer: string): boolean {
  if (!pointer.startsWith("/")) return false;
  let current: JsonValue = value;
  for (const encodedPart of pointer.slice(1).split("/")) {
    const part = encodedPart.replaceAll("~1", "/").replaceAll("~0", "~");
    if (Array.isArray(current)) {
      if (!/^\d+$/.test(part)) return false;
      const index = Number(part);
      if (index >= current.length) return false;
      current = current[index] as JsonValue;
      continue;
    }
    if (!isRecord(current) || !(part in current)) return false;
    current = current[part] as JsonValue;
  }
  return true;
}

function assertNonEmptyStrings(values: unknown, label: string): asserts values is string[] {
  if (
    !Array.isArray(values) ||
    values.length === 0 ||
    values.some((value) => typeof value !== "string" || value.trim().length === 0)
  ) {
    throw new Error(`${label} must contain only non-empty strings`);
  }
}

function assertSourceFiles(sourceFiles: NativeContractSourceFile[], operationId: string): void {
  if (sourceFiles.length === 0) throw new Error(`${operationId} has no fenced backend sources`);
  for (const source of sourceFiles) {
    if (!/^[0-9a-f]{64}$/.test(source.sourceSha256)) {
      throw new Error(`${operationId} has an invalid source SHA-256 for ${source.path}`);
    }
  }
}

function assertErrorFixture(error: NativeContractErrorFixture, operationId: string): void {
  if (!Number.isInteger(error.status) || error.status < 400 || error.status > 599) {
    throw new Error(`${operationId} has an invalid error status`);
  }
  if (error.code !== error.body.error.code) {
    throw new Error(`${operationId} error code does not match its envelope`);
  }
  if (!/^req_synthetic_[a-z0-9_]+$/.test(error.body.error.requestId)) {
    throw new Error(`${operationId} has a non-synthetic requestId`);
  }
}

function assertRequestFixture(request: NativeContractRequestFixture, operationId: string): void {
  if (!request.operationVariantId.trim()) {
    throw new Error(`${operationId} has an empty operationVariantId`);
  }
  assertNonEmptyStrings(request.producerEvidence, `${operationId}.producerEvidence`);
}

export function assertNativeContractBundle(bundle: NativeContractBundle): void {
  if (bundle.schemaVersion !== "chapterflow-native-contract-bundle-v1") {
    throw new Error("unsupported native contract schema version");
  }
  if (bundle.contractVersion !== "1") throw new Error("unsupported native contract version");
  if (!bundle.provenance.syntheticDataOnly) {
    throw new Error("native contract bundle must be synthetic-only");
  }
  if (bundle.provenance.deployedRevision !== null || bundle.provenance.deployedRevisionVerified) {
    throw new Error("source provenance must not imply a deployed revision");
  }
  if (bundle.provenance.sourceRevisionPhase === "uncommitted_backend") {
    if (bundle.provenance.sourceRevision !== null) {
      throw new Error("an uncommitted generated bundle cannot claim its containing source revision");
    }
  } else {
    if (
      bundle.provenance.sourceRevisionPhase !== "committed_backend_branch" &&
      bundle.provenance.sourceRevisionPhase !== "merged_backend"
    ) {
      throw new Error("unsupported backend source revision phase");
    }
    if (
      bundle.provenance.sourceRevision === null ||
      !/^[0-9a-f]{40}$/.test(bundle.provenance.sourceRevision)
    ) {
      throw new Error("committed backend provenance requires a full source revision");
    }
  }
  if (!/^[0-9a-f]{40}$/.test(bundle.provenance.behaviorSourceRevision)) {
    throw new Error("behavior source revision must be a full Git SHA");
  }
  if (!Number.isFinite(Date.parse(bundle.provenance.behaviorSourceTimestamp))) {
    throw new Error("behaviorSourceTimestamp must be an ISO-8601 timestamp");
  }
  if (!/^[0-9a-f]{64}$/.test(bundle.provenance.generatorTreeDigest)) {
    throw new Error("generator tree digest must be a SHA-256");
  }
  if (!Number.isFinite(Date.parse(bundle.provenance.generatedAt))) {
    throw new Error("generatedAt must be an ISO-8601 timestamp");
  }
  if (!bundle.retryAfterPolicy.implemented) {
    if (bundle.retryAfterPolicy.fixtureCount !== 0 || !bundle.retryAfterPolicy.gap) {
      throw new Error("unimplemented Retry-After policy must record a zero-fixture gap");
    }
    assertNonEmptyStrings(bundle.retryAfterPolicy.evidence, "retryAfterPolicy.evidence");
  }

  if (bundle.inventory.uniqueOperationCount !== bundle.operations.length) {
    throw new Error("inventory operation count does not match bundle operations");
  }
  const producerCount = bundle.operations.reduce(
    (count, operation) => count + operation.nativeRequestFixtures.length,
    0
  );
  if (bundle.inventory.nativeProducerCount !== producerCount) {
    throw new Error("inventory producer count does not match native request fixtures");
  }
  const inventoryEvidence = bundle.inventory.iosSourceEvidence;
  if (!/^[0-9a-f]{64}$/.test(inventoryEvidence.manifestSha256)) {
    throw new Error("iOS source inventory manifest digest must be a SHA-256");
  }
  if (!/^[0-9a-f]{40}$/.test(inventoryEvidence.iosBaseRevision)) {
    throw new Error("iOS source inventory base revision must be a full Git SHA");
  }
  if (inventoryEvidence.iosSourceRevisionPhase === "uncommitted_contract_branch") {
    if (inventoryEvidence.iosSourceRevision !== null) {
      throw new Error("uncommitted iOS source inventory cannot claim a containing revision");
    }
  } else if (
    inventoryEvidence.iosSourceRevision === null ||
    !/^[0-9a-f]{40}$/.test(inventoryEvidence.iosSourceRevision)
  ) {
    throw new Error("committed iOS source inventory requires a full Git SHA");
  }
  if (
    !/^[0-9a-f]{64}$/.test(inventoryEvidence.operationKeySha256) ||
    !/^[0-9a-f]{64}$/.test(inventoryEvidence.producerVariantIdSha256)
  ) {
    throw new Error("iOS source inventory key digests must be SHA-256 values");
  }
  if (inventoryEvidence.backendRuntimeFactoryValidationPerformed !== false) {
    throw new Error("backend bundle must not claim runtime validation of Swift factories");
  }
  if (
    inventoryEvidence.exactFactoryTestedProducerCount < 0 ||
    inventoryEvidence.exactFactoryTestedProducerCount >= bundle.inventory.nativeProducerCount
  ) {
    throw new Error("iOS source inventory must truthfully retain the exact-factory coverage gap");
  }
  const coveredOperationCount = bundle.operations.filter(
    (operation) => operation.coverage !== "blocked"
  ).length;
  if (
    inventoryEvidence.bundleSuccessDecoderTestedOperationCount < 0 ||
    inventoryEvidence.bundleSuccessDecoderTestedOperationCount >= coveredOperationCount
  ) {
    throw new Error("iOS source inventory must truthfully retain the success-consumer coverage gap");
  }
  if (!inventoryEvidence.limitation.trim()) {
    throw new Error("iOS source inventory must explain the backend validation limitation");
  }
  const matrixRows = new Set(
    bundle.operations.flatMap((operation) => (operation.matrixRowId ? [operation.matrixRowId] : []))
  );
  if (bundle.inventory.matrixRowCount !== matrixRows.size) {
    throw new Error("inventory matrix count does not match represented matrix rows");
  }
  const expectedMatrixRows = new Set<string>(NATIVE_CONTRACT_MATRIX_ROW_IDS);
  if (
    matrixRows.size !== expectedMatrixRows.size ||
    [...expectedMatrixRows].some((row) => !matrixRows.has(row))
  ) {
    throw new Error("bundle does not represent the exact authoritative 29-row matrix");
  }
  const summaryMatrixRows = new Map(
    bundle.inventory.matrixRows.map((row) => [row.id, new Set(row.operationIds)])
  );
  if (
    summaryMatrixRows.size !== expectedMatrixRows.size ||
    [...expectedMatrixRows].some((row) => !summaryMatrixRows.has(row))
  ) {
    throw new Error("matrix row summary is incomplete");
  }

  const ids = new Set<string>();
  const methodRoutes = new Set<string>();
  const variantIds = new Set<string>();
  for (const operation of bundle.operations) {
    if (ids.has(operation.id)) throw new Error(`duplicate operation id: ${operation.id}`);
    ids.add(operation.id);

    const methodRoute = `${operation.method} ${operation.routeTemplate}`;
    if (methodRoutes.has(methodRoute)) throw new Error(`duplicate operation: ${methodRoute}`);
    methodRoutes.add(methodRoute);

    if (!operation.routeTemplate.startsWith("/book/")) {
      throw new Error(`${operation.id} has an invalid native route template`);
    }
    assertNonEmptyStrings(operation.ios.factories, `${operation.id}.ios.factories`);
    assertNonEmptyStrings(operation.ios.callSites, `${operation.id}.ios.callSites`);
    assertNonEmptyStrings(operation.responseContract.iosModels, `${operation.id}.iosModels`);
    assertNonEmptyStrings(operation.responseContract.decoders, `${operation.id}.decoders`);
    assertNonEmptyStrings(operation.evidence, `${operation.id}.evidence`);
    for (const request of operation.nativeRequestFixtures) {
      assertRequestFixture(request, operation.id);
      if (variantIds.has(request.operationVariantId)) {
        throw new Error(`duplicate operationVariantId: ${request.operationVariantId}`);
      }
      variantIds.add(request.operationVariantId);
    }

    if (operation.auth.class === "public" && operation.auth.credential !== "none") {
      throw new Error(`${operation.id} public auth must not require a credential`);
    }
    if (operation.auth.class !== "public" && operation.auth.credential === "none") {
      throw new Error(`${operation.id} authenticated operation is missing its credential contract`);
    }

    if (operation.coverage === "blocked") {
      if (!operation.blocker) throw new Error(`${operation.id} blocked without blocker evidence`);
      if (operation.backend || operation.fixtures) {
        throw new Error(`${operation.id} blocked operation must not claim backend fixtures`);
      }
      assertNonEmptyStrings(operation.blocker.evidence, `${operation.id}.blocker.evidence`);
      if (operation.blocker.kind === "missing_route") {
        if (
          !operation.blocker.expectedRouteSource?.startsWith("app/app/api/book/") ||
          !operation.blocker.expectedRouteSource.endsWith("/route.ts")
        ) {
          throw new Error(`${operation.id} missing-route blocker lacks its expected route source`);
        }
      } else if (operation.blocker.expectedRouteSource) {
        throw new Error(`${operation.id} non-missing-route blocker declares an expected route source`);
      }
      if (operation.blocker.backendCandidate) {
        assertSourceFiles(operation.blocker.backendCandidate.sourceFiles, operation.id);
      }
      continue;
    }

    if (operation.blocker) throw new Error(`${operation.id} covered operation has a blocker`);
    if (!operation.backend || !operation.fixtures) {
      throw new Error(`${operation.id} covered operation is missing backend evidence or fixtures`);
    }
    if (operation.backend.exportedMethod !== operation.method) {
      throw new Error(`${operation.id} backend method does not match the native operation`);
    }
    assertSourceFiles(operation.backend.sourceFiles, operation.id);
    if (operation.coverage === "partial" && operation.gaps.length === 0) {
      throw new Error(`${operation.id} partial coverage must identify concrete gaps`);
    }
    if (operation.coverage === "full" && operation.gaps.length > 0) {
      throw new Error(`${operation.id} full coverage cannot carry unresolved gaps`);
    }
    if (
      operation.coverage === "full" &&
      operation.backend.serializerProof.kind !== "executed_pure_builder"
    ) {
      throw new Error(`${operation.id} source-fenced proof cannot claim full coverage`);
    }
    const gapKinds = new Set(operation.gaps.map((gap) => gap.kind));
    if (!gapKinds.has("route_specific_error_coverage")) {
      throw new Error(`${operation.id} must disclose incomplete route-specific error coverage`);
    }
    if (!gapKinds.has("native_request_fixture_proof")) {
      throw new Error(`${operation.id} must disclose the native request fixture proof gap`);
    }
    if (!gapKinds.has("source_dependency_closure")) {
      throw new Error(`${operation.id} must disclose the incomplete source dependency closure`);
    }
    if (operation.fixtures.requestVariants.length === 0) {
      throw new Error(`${operation.id} must have at least one backend request variant`);
    }
    if (operation.fixtures.request.operationVariantId !== operation.fixtures.requestVariants[0]?.operationVariantId) {
      throw new Error(`${operation.id} primary request must equal the first request variant`);
    }
    for (const request of operation.fixtures.requestVariants) {
      assertRequestFixture(request, operation.id);
    }
    if (operation.coverage === "full" && operation.fixtures.errors.length === 0) {
      throw new Error(`${operation.id} full coverage must include its error contract`);
    }
    if (operation.fixtures.success.payload.kind === "json") {
      for (const pointer of operation.fixtures.success.requiredAuthorityFields) {
        if (!hasJsonPointer(operation.fixtures.success.payload.value, pointer)) {
          throw new Error(`${operation.id} synthetic success is missing authority field ${pointer}`);
        }
      }
    } else if (operation.fixtures.success.requiredAuthorityFields.length > 0) {
      throw new Error(`${operation.id} non-JSON success cannot declare JSON authority pointers`);
    }
    if (operation.authority.classification === "none") {
      if (
        operation.authority.failureMode !== "not_applicable" ||
        operation.authority.expectedRequiredPointers.length > 0
      ) {
        throw new Error(`${operation.id} non-authority contract has authority requirements`);
      }
    } else {
      if (
        operation.authority.failureMode !== "fail_closed" ||
        operation.authority.expectedRequiredPointers.length === 0
      ) {
        throw new Error(`${operation.id} authority contract must declare fail-closed pointers`);
      }
      const expected = [...operation.authority.expectedRequiredPointers].sort();
      const actual = [...operation.fixtures.success.requiredAuthorityFields].sort();
      if (expected.length !== actual.length || expected.some((pointer, index) => pointer !== actual[index])) {
        throw new Error(`${operation.id} success authority pointers do not match classification`);
      }
    }
    for (const error of operation.fixtures.errors) assertErrorFixture(error, operation.id);
  }
}
