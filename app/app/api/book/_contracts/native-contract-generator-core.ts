import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type {
  NativeContractBundle,
  NativeContractOperation,
  NativeContractOperationDefinition,
  NativeContractSourceFile,
  NativeContractSourceFileDefinition,
} from "./native-contract-types";
import { assertNativeContractBundle } from "./native-contract-types";

export const BACKEND_SOURCE_REVISION = "968ff67ecafbed7e8e1d4c7b77badf507cfc5aee";
export const BACKEND_BEHAVIOR_SOURCE_TIMESTAMP = "2026-07-11T22:16:03-03:00";
export const ARTIFACT_GENERATED_AT = "2026-07-13T02:27:09-03:00";

const GENERATOR_SOURCE_PATHS = [
  "app/app/api/book/_contracts/native-contract-types.ts",
  "app/app/api/book/_contracts/native-contract-generator-core.ts",
  "app/app/api/book/_contracts/native-contract-registry.ts",
  "scripts/contracts/generate-native-contract.ts",
] as const;

const IOS_SOURCE_INVENTORY_MANIFEST_PATH =
  "contracts/native-ios/v1/ios-source-inventory-manifest.json" as const;

type IosSourceInventoryManifest = {
  schemaVersion: "chapterflow-ios-native-inventory-v1";
  iosRepository: "WillSoltani/Chapterflow-IOS";
  iosBaseRevision: string;
  iosSourceRevision: string | null;
  iosSourceRevisionPhase: "uncommitted_contract_branch" | "committed_contract_branch";
  canonicalization: string;
  operationKeyCount: number;
  operationKeySha256: string;
  producerVariantCount: number;
  producerVariantIdSha256: string;
  exactFactoryTestedProducerCount: number;
  bundleSuccessDecoderTestedOperationCount: number;
  backendRuntimeFactoryValidationPerformed: false;
  evidence: string[];
};

function sourceSha256(repoRoot: string, relativePath: string): string {
  const source = readFileSync(resolve(repoRoot, relativePath));
  return createHash("sha256").update(source).digest("hex");
}

function generatorTreeDigest(repoRoot: string): string {
  const hash = createHash("sha256");
  for (const relativePath of GENERATOR_SOURCE_PATHS) {
    hash.update(relativePath);
    hash.update("\0");
    hash.update(readFileSync(resolve(repoRoot, relativePath)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function sha256SortedLines(values: string[]): string {
  return createHash("sha256").update(`${[...values].sort().join("\n")}\n`).digest("hex");
}

function loadIosSourceInventoryManifest(repoRoot: string): IosSourceInventoryManifest {
  const parsed: unknown = JSON.parse(
    readFileSync(resolve(repoRoot, IOS_SOURCE_INVENTORY_MANIFEST_PATH), "utf8")
  );
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("iOS source inventory manifest must be a JSON object");
  }
  const manifest = parsed as Partial<IosSourceInventoryManifest>;
  if (
    manifest.schemaVersion !== "chapterflow-ios-native-inventory-v1" ||
    manifest.iosRepository !== "WillSoltani/Chapterflow-IOS" ||
    typeof manifest.iosBaseRevision !== "string" ||
    (manifest.iosSourceRevision !== null && typeof manifest.iosSourceRevision !== "string") ||
    (manifest.iosSourceRevisionPhase !== "uncommitted_contract_branch" &&
      manifest.iosSourceRevisionPhase !== "committed_contract_branch") ||
    typeof manifest.canonicalization !== "string" ||
    typeof manifest.operationKeyCount !== "number" ||
    typeof manifest.operationKeySha256 !== "string" ||
    typeof manifest.producerVariantCount !== "number" ||
    typeof manifest.producerVariantIdSha256 !== "string" ||
    typeof manifest.exactFactoryTestedProducerCount !== "number" ||
    typeof manifest.bundleSuccessDecoderTestedOperationCount !== "number" ||
    manifest.backendRuntimeFactoryValidationPerformed !== false ||
    !Array.isArray(manifest.evidence) ||
    manifest.evidence.some((item) => typeof item !== "string" || !item.trim())
  ) {
    throw new Error("iOS source inventory manifest is incomplete or invalid");
  }
  return manifest as IosSourceInventoryManifest;
}

function assertIosSourceInventory(
  manifest: IosSourceInventoryManifest,
  operations: NativeContractOperation[]
): void {
  const operationKeys = operations.map(
    (operation) => `${operation.id}|${operation.method}|${operation.routeTemplate}`
  );
  const producerVariantIds = operations.flatMap((operation) =>
    operation.nativeRequestFixtures.map((request) => request.operationVariantId)
  );
  if (
    manifest.operationKeyCount !== operationKeys.length ||
    manifest.operationKeySha256 !== sha256SortedLines(operationKeys)
  ) {
    throw new Error("backend registry does not match the independent iOS operation inventory");
  }
  if (
    manifest.producerVariantCount !== producerVariantIds.length ||
    manifest.producerVariantIdSha256 !== sha256SortedLines(producerVariantIds)
  ) {
    throw new Error("backend registry does not match the independent iOS producer inventory");
  }
}

function materializeSourceFiles(
  repoRoot: string,
  sourceFiles: NativeContractSourceFileDefinition[]
): NativeContractSourceFile[] {
  return sourceFiles.map((source) => ({
    ...source,
    sourceSha256: sourceSha256(repoRoot, source.path),
  }));
}

function materializeOperation(
  repoRoot: string,
  definition: NativeContractOperationDefinition
): NativeContractOperation {
  const { backend: backendDefinition, blocker: blockerDefinition, ...operation } = definition;
  const blocker: NativeContractOperation["blocker"] = blockerDefinition
    ? {
        kind: blockerDefinition.kind,
        reason: blockerDefinition.reason,
        evidence: blockerDefinition.evidence,
        expectedRouteSource: blockerDefinition.expectedRouteSource,
        backendCandidate: blockerDefinition.backendCandidate
          ? {
              ...blockerDefinition.backendCandidate,
              sourceFiles: materializeSourceFiles(
                repoRoot,
                blockerDefinition.backendCandidate.sourceFiles
              ),
            }
          : undefined,
      }
    : undefined;
  if (!backendDefinition) return { ...operation, blocker };
  return {
    ...operation,
    backend: {
      ...backendDefinition,
      sourceFiles: materializeSourceFiles(repoRoot, backendDefinition.sourceFiles),
    },
    blocker,
  };
}

export function assertBehaviorSourceRevision(repoRoot: string): void {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", BACKEND_SOURCE_REVISION, "HEAD"], {
      cwd: repoRoot,
      stdio: "ignore",
    });
  } catch {
    throw new Error(
      `behavior source revision ${BACKEND_SOURCE_REVISION} is not an ancestor of HEAD`
    );
  }
}

function assertExportedMethod(
  repoRoot: string,
  routeSource: string,
  method: string,
  operationId: string
): void {
  const source = readFileSync(resolve(repoRoot, routeSource), "utf8");
  const pattern = new RegExp(`export\\s+(?:async\\s+)?function\\s+${method}\\b`);
  if (!pattern.test(source)) {
    throw new Error(`${operationId} source does not export ${method}: ${routeSource}`);
  }
}

export function assertNativeContractSourceConformance(
  repoRoot: string,
  bundle: NativeContractBundle
): void {
  assertBehaviorSourceRevision(repoRoot);
  if (bundle.provenance.behaviorSourceRevision !== BACKEND_SOURCE_REVISION) {
    throw new Error("bundle behavior source revision does not match the generator baseline");
  }
  if (bundle.provenance.generatorTreeDigest !== generatorTreeDigest(repoRoot)) {
    throw new Error("bundle generator tree digest does not match the checked-in generator sources");
  }
  const inventoryManifestSha256 = sourceSha256(repoRoot, IOS_SOURCE_INVENTORY_MANIFEST_PATH);
  if (bundle.inventory.iosSourceEvidence.manifestSha256 !== inventoryManifestSha256) {
    throw new Error("iOS source inventory manifest drifted");
  }

  for (const operation of bundle.operations) {
    if (
      operation.blocker?.kind === "missing_route" &&
      operation.blocker.expectedRouteSource &&
      existsSync(resolve(repoRoot, operation.blocker.expectedRouteSource))
    ) {
      throw new Error(
        `${operation.id} expected missing route now exists: ${operation.blocker.expectedRouteSource}`
      );
    }
    const evidence = operation.backend ?? operation.blocker?.backendCandidate;
    if (!evidence) continue;
    for (const source of evidence.sourceFiles) {
      const actual = sourceSha256(repoRoot, source.path);
      if (actual !== source.sourceSha256) {
        throw new Error(`${operation.id} source drift: ${source.path}`);
      }
    }
    if (operation.backend) {
      assertExportedMethod(
        repoRoot,
        operation.backend.routeSource,
        operation.backend.exportedMethod,
        operation.id
      );
    } else if (operation.blocker?.backendCandidate) {
      for (const method of operation.blocker.backendCandidate.exportedMethods) {
        assertExportedMethod(
          repoRoot,
          operation.blocker.backendCandidate.routeSource,
          method,
          operation.id
        );
      }
    }
  }
}

export function buildNativeContractBundle(
  repoRoot: string,
  definitions: NativeContractOperationDefinition[],
  options?: { sourceRevision?: string }
): NativeContractBundle {
  assertBehaviorSourceRevision(repoRoot);
  if (options?.sourceRevision) {
    try {
      execFileSync("git", ["merge-base", "--is-ancestor", options.sourceRevision, "HEAD"], {
        cwd: repoRoot,
        stdio: "ignore",
      });
    } catch {
      throw new Error(
        `merged source revision ${options.sourceRevision} is not an ancestor of backend HEAD`
      );
    }
  }
  const operations = definitions.map((definition) => materializeOperation(repoRoot, definition));
  const iosSourceInventory = loadIosSourceInventoryManifest(repoRoot);
  assertIosSourceInventory(iosSourceInventory, operations);
  const representedMatrixRows = new Set(
    operations.flatMap((operation) => (operation.matrixRowId ? [operation.matrixRowId] : []))
  );
  const matrixRows = [...representedMatrixRows]
    .sort()
    .map((id) => ({
      id,
      operationIds: operations
        .filter((operation) => operation.matrixRowId === id)
        .map((operation) => operation.id)
        .sort(),
    }));
  const bundle: NativeContractBundle = {
    schemaVersion: "chapterflow-native-contract-bundle-v1",
    contractVersion: "1",
    provenance: {
      backendRepository: "WillSoltani/ChapterFlow",
      sourceRevision: options?.sourceRevision ?? null,
      behaviorSourceRevision: BACKEND_SOURCE_REVISION,
      behaviorSourceTimestamp: BACKEND_BEHAVIOR_SOURCE_TIMESTAMP,
      sourceRevisionPhase: options?.sourceRevision ? "merged_backend" : "uncommitted_backend",
      generatedAt: ARTIFACT_GENERATED_AT,
      generatorVersion: "chapterflow-native-contract-generator-v1",
      generatorTreeDigest: generatorTreeDigest(repoRoot),
      syntheticDataOnly: true,
      deployedRevision: null,
      deployedRevisionVerified: false,
    },
    inventory: {
      uniqueOperationCount: operations.length,
      nativeProducerCount: operations.reduce(
        (count, operation) => count + operation.nativeRequestFixtures.length,
        0
      ),
      matrixRowCount: representedMatrixRows.size,
      iosSourceEvidence: {
        manifestPath: IOS_SOURCE_INVENTORY_MANIFEST_PATH,
        manifestSha256: sourceSha256(repoRoot, IOS_SOURCE_INVENTORY_MANIFEST_PATH),
        iosRepository: iosSourceInventory.iosRepository,
        iosBaseRevision: iosSourceInventory.iosBaseRevision,
        iosSourceRevision: iosSourceInventory.iosSourceRevision,
        iosSourceRevisionPhase: iosSourceInventory.iosSourceRevisionPhase,
        operationKeySha256: iosSourceInventory.operationKeySha256,
        producerVariantIdSha256: iosSourceInventory.producerVariantIdSha256,
        exactFactoryTestedProducerCount: iosSourceInventory.exactFactoryTestedProducerCount,
        bundleSuccessDecoderTestedOperationCount:
          iosSourceInventory.bundleSuccessDecoderTestedOperationCount,
        backendRuntimeFactoryValidationPerformed:
          iosSourceInventory.backendRuntimeFactoryValidationPerformed,
        limitation: iosSourceInventory.evidence.join(" "),
      },
      matrixRows,
    },
    errorEnvelope: {
      source: "app/app/api/book/_lib/http.ts",
      required: ["error"],
      errorRequired: ["code", "message", "requestId"],
      errorOptional: ["details"],
      canonicalErrors: [
        {
          status: 400,
          code: "invalid_json",
          retryable: false,
          notes: "The request body is not a valid JSON object.",
        },
        {
          status: 401,
          code: "unauthenticated",
          retryable: false,
          notes: "No Cognito id_token credential was presented.",
        },
        {
          status: 401,
          code: "invalid_token",
          retryable: false,
          notes: "The presented Cognito id_token was deterministically rejected.",
        },
        {
          status: 401,
          code: "reauth_required",
          retryable: false,
          notes: "The operation requires a fresh interactive authentication.",
        },
        {
          status: 403,
          code: "forbidden_origin",
          retryable: false,
          notes: "Cookie-authenticated unsafe requests must pass the same-origin guard.",
        },
        {
          status: 503,
          code: "verifier_unavailable",
          retryable: true,
          notes: "The JWKS verifier could not reach a validity decision.",
        },
        {
          status: 500,
          code: "server_error",
          retryable: true,
          notes: "An unexpected server error was normalized by withBookApiErrors.",
        },
      ],
    },
    retryAfterPolicy: {
      implemented: false,
      fixtureCount: 0,
      evidence: [
        "app/app/api/book/_lib/http.ts bookErr emits only the JSON error envelope",
        "behavior source revision 968ff67 has no native-route Retry-After header contract",
      ],
      gap: "Rate-limit responses do not currently define a stable Retry-After header, so no fixture is invented.",
    },
    operations,
  };
  assertNativeContractBundle(bundle);
  return bundle;
}

export function serializeNativeContractBundle(bundle: NativeContractBundle): string {
  return `${JSON.stringify(bundle, null, 2)}\n`;
}
