import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

import type {
  NativeContractBundle,
  NativeContractOperation,
  NativeContractOperationDefinition,
  NativeContractSourceFile,
  NativeContractSourceFileDefinition,
} from "./native-contract-types";
import { assertNativeContractBundle } from "./native-contract-types";
import {
  assertIosSourceInventoryRelations,
  deriveNativeContractMatrixRows,
  parseIosSourceInventoryManifest,
  type IosSourceInventoryManifest,
} from "./native-contract-inventory-relations";
import {
  assertNativeContractGitProvenance,
  type VerifiedNativeContractGitProvenance,
} from "./native-contract-provenance";

export type NativeContractCommittedSourceRevisionPhase =
  | "committed_backend_branch"
  | "merged_backend";

export type NativeContractBuildOptions =
  | {
      sourceRevision?: undefined;
      sourceRevisionPhase?: undefined;
      trustedMainRef?: undefined;
    }
  | {
      sourceRevision: string;
      sourceRevisionPhase: NativeContractCommittedSourceRevisionPhase;
      trustedMainRef: string;
    };

export const BACKEND_SOURCE_REVISION = "968ff67ecafbed7e8e1d4c7b77badf507cfc5aee";
export const BACKEND_BEHAVIOR_SOURCE_TIMESTAMP = "2026-07-11T22:16:03-03:00";
export const ARTIFACT_GENERATED_AT = "2026-07-13T02:27:09-03:00";

const GENERATOR_SOURCE_PATHS = [
  "app/app/api/book/_contracts/native-contract-types.ts",
  "app/app/api/book/_contracts/native-contract-generator-core.ts",
  "app/app/api/book/_contracts/native-contract-registry.ts",
  "app/app/api/book/_contracts/native-contract-inventory-relations.ts",
  "app/app/api/book/_contracts/native-contract-provenance.ts",
  "scripts/contracts/generate-native-contract.ts",
] as const;

const IOS_SOURCE_INVENTORY_MANIFEST_PATH =
  "contracts/native-ios/v1/ios-source-inventory-manifest.json" as const;
const CONTRACT_BUNDLE_PATH = "contracts/native-ios/v1/contract-bundle.json" as const;

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

function loadIosSourceInventoryManifest(repoRoot: string): IosSourceInventoryManifest {
  const parsed: unknown = JSON.parse(
    readFileSync(resolve(repoRoot, IOS_SOURCE_INVENTORY_MANIFEST_PATH), "utf8")
  );
  return parseIosSourceInventoryManifest(parsed);
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
        resolution: blockerDefinition.resolution,
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

export function parseNativeContractProvenanceEnvironment(
  environment: Record<string, string | undefined>
): NativeContractBuildOptions | undefined {
  const sourceRevision = environment.CONTRACT_SOURCE_REVISION?.trim() || undefined;
  const sourceRevisionPhase =
    environment.CONTRACT_SOURCE_REVISION_PHASE?.trim() || undefined;
  const trustedMainRef = environment.CONTRACT_TRUSTED_MAIN_REF?.trim() || undefined;

  const suppliedCount = [sourceRevision, sourceRevisionPhase, trustedMainRef].filter(
    (value) => value !== undefined
  ).length;
  if (suppliedCount !== 0 && suppliedCount !== 3) {
    throw new Error(
      "CONTRACT_SOURCE_REVISION, CONTRACT_SOURCE_REVISION_PHASE, and CONTRACT_TRUSTED_MAIN_REF must be provided together"
    );
  }
  if (
    sourceRevision === undefined ||
    sourceRevisionPhase === undefined ||
    trustedMainRef === undefined
  ) {
    return undefined;
  }
  if (
    sourceRevisionPhase !== "committed_backend_branch" &&
    sourceRevisionPhase !== "merged_backend"
  ) {
    throw new Error(
      "CONTRACT_SOURCE_REVISION_PHASE must be committed_backend_branch or merged_backend"
    );
  }
  return { sourceRevision, sourceRevisionPhase, trustedMainRef };
}

function committedInputPaths(definitions: NativeContractOperationDefinition[]): string[] {
  const paths = new Set<string>([
    ...GENERATOR_SOURCE_PATHS,
    IOS_SOURCE_INVENTORY_MANIFEST_PATH,
  ]);
  for (const definition of definitions) {
    const evidence = definition.backend ?? definition.blocker?.backendCandidate;
    if (!evidence) continue;
    paths.add(evidence.routeSource);
    for (const source of evidence.sourceFiles) paths.add(source.path);
  }
  return [...paths].sort();
}

export function nativeContractExpectedMissingInputPaths(
  definitions: NativeContractOperationDefinition[]
): string[] {
  return [
    ...new Set(
      definitions.flatMap((definition) =>
        definition.blocker?.kind === "missing_route" &&
        definition.blocker.expectedRouteSource
          ? [definition.blocker.expectedRouteSource]
          : []
      )
    ),
  ].sort();
}

export function routeSourceExportsMethod(source: string, method: string): boolean {
  const sourceFile = ts.createSourceFile(
    "route.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  ) as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] };
  if (sourceFile.parseDiagnostics.length > 0) return false;

  return sourceFile.statements.some((statement) => {
    if (
      !ts.isFunctionDeclaration(statement) ||
      statement.name?.text !== method ||
      statement.body === undefined
    ) {
      return false;
    }
    const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
    const exported =
      modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false;
    const defaultExport =
      modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword) ?? false;
    return exported && !defaultExport;
  });
}

function assertExportedMethod(
  repoRoot: string,
  routeSource: string,
  method: string,
  operationId: string
): void {
  const source = readFileSync(resolve(repoRoot, routeSource), "utf8");
  if (!routeSourceExportsMethod(source, method)) {
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
  options?: NativeContractBuildOptions
): NativeContractBundle {
  const sourceRevision = options?.sourceRevision;
  const sourceRevisionPhase = options?.sourceRevisionPhase;
  const trustedMainRef = options?.trustedMainRef;
  const committedOptionCount = [sourceRevision, sourceRevisionPhase, trustedMainRef].filter(
    (value) => value !== undefined
  ).length;
  if (committedOptionCount !== 0 && committedOptionCount !== 3) {
    throw new Error(
      "source revision, source revision phase, and trusted main ref must be provided together"
    );
  }
  const committedProvenance: VerifiedNativeContractGitProvenance | undefined =
    sourceRevision !== undefined &&
    sourceRevisionPhase !== undefined &&
    trustedMainRef !== undefined
      ? assertNativeContractGitProvenance({
          repoRoot,
          sourceRevision,
          sourceRevisionPhase,
          trustedMainRef,
          requiredInputPaths: committedInputPaths(definitions),
          expectedMissingInputPaths: nativeContractExpectedMissingInputPaths(definitions),
          contractArtifactPath: CONTRACT_BUNDLE_PATH,
        })
      : undefined;
  assertBehaviorSourceRevision(repoRoot);
  const operations = definitions.map((definition) => materializeOperation(repoRoot, definition));
  const iosSourceInventory = loadIosSourceInventoryManifest(repoRoot);
  assertIosSourceInventoryRelations(iosSourceInventory, operations);
  const matrixRows = deriveNativeContractMatrixRows(operations);
  const authorityOperations = operations.filter(
    (operation) => operation.authority.classification !== "none"
  );
  const bundle: NativeContractBundle = {
    schemaVersion: "chapterflow-native-contract-bundle-v1",
    contractVersion: "1",
    provenance: {
      backendRepository: "WillSoltani/ChapterFlow",
      sourceRevision: sourceRevision ?? null,
      behaviorSourceRevision: BACKEND_SOURCE_REVISION,
      behaviorSourceTimestamp: BACKEND_BEHAVIOR_SOURCE_TIMESTAMP,
      sourceRevisionPhase: sourceRevisionPhase ?? "uncommitted_backend",
      generatedAt: ARTIFACT_GENERATED_AT,
      generatorVersion: "chapterflow-native-contract-generator-v1",
      generatorTreeDigest: generatorTreeDigest(repoRoot),
      committedInputTree: committedProvenance
        ? {
            sha256: committedProvenance.inputTreeDigest,
            inputPathCount: committedProvenance.verifiedInputPaths.length,
            expectedMissingPathCount: committedProvenance.verifiedMissingInputPaths.length,
            trustedMainRef: committedProvenance.trustedMainRef,
            trustedMainRevision: committedProvenance.trustedMainRevision,
          }
        : null,
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
      matrixRowCount: matrixRows.length,
      iosSourceEvidence: {
        manifestPath: IOS_SOURCE_INVENTORY_MANIFEST_PATH,
        manifestSha256: sourceSha256(repoRoot, IOS_SOURCE_INVENTORY_MANIFEST_PATH),
        manifestSchemaVersion: iosSourceInventory.schemaVersion,
        iosRepository: iosSourceInventory.iosRepository,
        iosBaseRevision: iosSourceInventory.iosBaseRevision,
        iosSourceRevision: iosSourceInventory.iosSourceRevision,
        iosSourceRevisionPhase: iosSourceInventory.iosSourceRevisionPhase,
        operationKeySha256: iosSourceInventory.operationKeySha256,
        producerVariantIdSha256: iosSourceInventory.producerVariantIdSha256,
        producerIdentitySha256: iosSourceInventory.producerIdentitySha256,
        relationalRecordCount: iosSourceInventory.relationalRecordCount,
        relationalRecordSha256: iosSourceInventory.relationalRecordSha256,
        sourceInputTreeSha256: iosSourceInventory.sourceInputTreeSha256,
        matrixRowCount: iosSourceInventory.matrixRowCount,
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
    authorityProofSummary: {
      structuralFixtureVerifiedOperationCount: authorityOperations.filter(
        (operation) =>
          operation.coverage !== "blocked" &&
          (operation.authority.proof.level === "structural_fixture_only" ||
            operation.authority.proof.level === "production_consumer_verified")
      ).length,
      productionConsumerVerifiedOperationCount: authorityOperations.filter(
        (operation) => operation.authority.proof.level === "production_consumer_verified"
      ).length,
      blockedOrUnprovenOperationCount: authorityOperations.filter(
        (operation) => operation.authority.proof.level === "blocked_unproven"
      ).length,
    },
    operations,
  };
  assertNativeContractBundle(bundle);
  return bundle;
}

export function serializeNativeContractBundle(bundle: NativeContractBundle): string {
  return `${JSON.stringify(bundle, null, 2)}\n`;
}
