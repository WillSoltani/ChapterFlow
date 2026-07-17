import { createHash } from "node:crypto";

import type {
  NativeContractMethod,
  NativeContractOperation,
} from "./native-contract-types";

const EXPECTED_OPERATION_COUNT = 83;
const EXPECTED_PRODUCER_COUNT = 92;
const EXPECTED_MATRIX_ROW_COUNT = 29;
const EXPECTED_CANONICALIZATION =
  "UTF-8 records; fixed field order; TAB-separated fields; null matrix row is empty; lexicographically sorted lines joined with LF and a terminal LF";
const IOS_INVENTORY_MAPPING_PATH =
  "contracts/native-ios/v1/ios-native-contract-inventory-source.json";
const IOS_INVENTORY_GENERATOR_PATH =
  "scripts/contracts/generate_ios_native_inventory.py";

const RECORD_FIELDS = [
  "operationId",
  "method",
  "routeTemplate",
  "matrixRowId",
  "operationVariantId",
  "producerKind",
  "producerSymbol",
  "producerSourcePath",
  "stableVariantSuffix",
  "sourceMethodExpression",
  "sourcePathExpression",
] as const;

const MANIFEST_FIELDS = [
  "schemaVersion",
  "iosRepository",
  "iosBaseRevision",
  "iosSourceRevision",
  "iosSourceRevisionPhase",
  "canonicalization",
  "operationKeyCount",
  "operationKeySha256",
  "producerVariantCount",
  "producerVariantIdSha256",
  "producerIdentitySha256",
  "matrixRowCount",
  "relationalRecordCount",
  "relationalRecordSha256",
  "sourceInputTreeSha256",
  "sourceInputs",
  "records",
  "matrixRows",
  "exactFactoryTestedProducerCount",
  "bundleSuccessDecoderTestedOperationCount",
  "backendRuntimeFactoryValidationPerformed",
  "evidence",
] as const;

export type IosNativeInventoryProducerKind =
  | "endpoint_factory"
  | "direct_endpoint"
  | "analytics_path";

export type IosNativeInventoryRecord = {
  operationId: string;
  method: NativeContractMethod;
  routeTemplate: string;
  matrixRowId: string | null;
  operationVariantId: string;
  producerKind: IosNativeInventoryProducerKind;
  producerSymbol: string;
  producerSourcePath: string;
  stableVariantSuffix: string;
  sourceMethodExpression: string;
  sourcePathExpression: string;
};

export type NativeContractMatrixRow = {
  id: string;
  operationIds: string[];
};

export type IosSourceInventoryManifest = {
  schemaVersion: "chapterflow-ios-native-inventory-v2";
  iosRepository: "WillSoltani/Chapterflow-IOS";
  iosBaseRevision: string;
  iosSourceRevision: string | null;
  iosSourceRevisionPhase: "uncommitted_contract_branch" | "committed_contract_branch";
  canonicalization: string;
  operationKeyCount: number;
  operationKeySha256: string;
  producerVariantCount: number;
  producerVariantIdSha256: string;
  producerIdentitySha256: string;
  matrixRowCount: number;
  relationalRecordCount: number;
  relationalRecordSha256: string;
  sourceInputTreeSha256: string;
  sourceInputs: Array<{ path: string; sha256: string }>;
  records: IosNativeInventoryRecord[];
  matrixRows: NativeContractMatrixRow[];
  exactFactoryTestedProducerCount: number;
  bundleSuccessDecoderTestedOperationCount: number;
  backendRuntimeFactoryValidationPerformed: false;
  evidence: string[];
};

type RelationalBackendOperation = Pick<
  NativeContractOperation,
  "id" | "method" | "routeTemplate" | "matrixRowId" | "nativeRequestFixtures"
>;

type ComparableInventoryRecord = Omit<
  IosNativeInventoryRecord,
  "sourceMethodExpression" | "sourcePathExpression"
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertExactFields(
  value: Record<string, unknown>,
  expected: readonly string[],
  label: string
): void {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(sortedExpected)) {
    const missing = sortedExpected.filter((field) => !actual.includes(field));
    const extra = actual.filter((field) => !sortedExpected.includes(field));
    throw new Error(`${label} fields differ; missing=${missing.join(",")} extra=${extra.join(",")}`);
  }
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function requiredRepoPath(value: unknown, label: string): string {
  const path = requiredString(value, label);
  const parts = path.split("/");
  if (
    path.startsWith("/") ||
    path.includes("\\") ||
    path.includes("\0") ||
    parts.some((part) => part === "" || part === "." || part === "..")
  ) {
    throw new Error(`${label} must be a normalized repository-relative path`);
  }
  return path;
}

function requiredInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return value;
}

function requiredSha256(value: unknown, label: string): string {
  const sha = requiredString(value, label);
  if (!/^[0-9a-f]{64}$/.test(sha)) throw new Error(`${label} must be a SHA-256`);
  return sha;
}

function requiredStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value.map((item, index) => requiredString(item, `${label}[${index}]`));
}

function sha256Lines(values: Iterable<string>): string {
  return createHash("sha256")
    .update(`${[...values].sort().join("\n")}\n`)
    .digest("hex");
}

function stableVariantSuffix(producerSymbol: string): string {
  return producerSymbol
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function methodFromSourceExpression(
  expression: string,
  producerKind: IosNativeInventoryProducerKind
): NativeContractMethod {
  const match =
    producerKind === "analytics_path"
      ? /^request\.httpMethod = "([A-Z]+)"$/.exec(expression)
      : /^method: \.([a-z]+)$/.exec(expression);
  const method = match?.[1]?.toUpperCase();
  if (!method || !["GET", "POST", "PATCH", "PUT", "DELETE"].includes(method)) {
    throw new Error(`iOS relational inventory has an invalid source method expression: ${expression}`);
  }
  return method as NativeContractMethod;
}

function routeFromSourceExpression(expression: string, routeTemplate: string): string {
  if (expression.length < 2 || !expression.startsWith('"') || !expression.endsWith('"')) {
    throw new Error(
      `iOS relational inventory source path expression is not one Swift string literal: ${expression}`
    );
  }
  const sourcePath = expression.slice(1, -1);
  const interpolations = [...sourcePath.matchAll(/\\\([^)]*\)/g)];
  const placeholders = routeTemplate.match(/\{[^{}]+\}/g) ?? [];
  if (interpolations.length !== placeholders.length) {
    throw new Error(
      `iOS relational inventory route placeholder count differs: ${routeTemplate} / ${expression}`
    );
  }
  let cursor = 0;
  let normalized = "";
  for (let index = 0; index < interpolations.length; index += 1) {
    const interpolation = interpolations[index];
    normalized += sourcePath.slice(cursor, interpolation.index);
    normalized += placeholders[index];
    cursor = (interpolation.index ?? 0) + interpolation[0].length;
  }
  return normalized + sourcePath.slice(cursor);
}

function parseInventoryRecord(value: unknown, index: number): IosNativeInventoryRecord {
  if (!isRecord(value)) throw new Error(`iOS relational inventory record ${index} is not an object`);
  assertExactFields(value, RECORD_FIELDS, `iOS relational inventory record ${index}`);

  const operationId = requiredString(value.operationId, `records[${index}].operationId`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*\.(?:get|post|patch|delete)$/.test(operationId)) {
    throw new Error(`iOS relational inventory has an invalid operation id: ${operationId}`);
  }
  const method = requiredString(value.method, `records[${index}].method`) as NativeContractMethod;
  if (!["GET", "POST", "PATCH", "DELETE"].includes(method)) {
    throw new Error(`iOS relational inventory ${operationId} has an unsupported method: ${method}`);
  }
  const routeTemplate = requiredString(
    value.routeTemplate,
    `records[${index}].routeTemplate`
  );
  if (!routeTemplate.startsWith("/book/")) {
    throw new Error(`iOS relational inventory ${operationId} has an invalid route: ${routeTemplate}`);
  }
  const matrixRowId =
    value.matrixRowId === null
      ? null
      : requiredString(value.matrixRowId, `records[${index}].matrixRowId`);
  const operationVariantId = requiredString(
    value.operationVariantId,
    `records[${index}].operationVariantId`
  );
  const producerKind = requiredString(
    value.producerKind,
    `records[${index}].producerKind`
  ) as IosNativeInventoryProducerKind;
  if (!["endpoint_factory", "direct_endpoint", "analytics_path"].includes(producerKind)) {
    throw new Error(
      `iOS relational inventory ${operationId} has an invalid producer kind: ${producerKind}`
    );
  }
  const producerSymbol = requiredString(
    value.producerSymbol,
    `records[${index}].producerSymbol`
  );
  const producerSourcePath = requiredRepoPath(
    value.producerSourcePath,
    `records[${index}].producerSourcePath`
  );
  if (!/^Packages\/[^/]+\/Sources\/.+\.swift$/.test(producerSourcePath)) {
    throw new Error(
      `iOS relational inventory ${operationId} has an invalid producer source path: ${producerSourcePath}`
    );
  }
  const suffix = requiredString(
    value.stableVariantSuffix,
    `records[${index}].stableVariantSuffix`
  );
  if (suffix !== stableVariantSuffix(producerSymbol)) {
    throw new Error(
      `iOS relational inventory ${operationId} stable suffix differs from producer symbol`
    );
  }
  if (operationVariantId !== `${operationId}:${suffix}`) {
    throw new Error(
      `iOS relational inventory ${operationId} variant differs from operation and stable suffix`
    );
  }
  const sourceMethodExpression = requiredString(
    value.sourceMethodExpression,
    `records[${index}].sourceMethodExpression`
  );
  if (methodFromSourceExpression(sourceMethodExpression, producerKind) !== method) {
    throw new Error(
      `iOS relational inventory ${operationId} method differs from source expression`
    );
  }
  const sourcePathExpression = requiredString(
    value.sourcePathExpression,
    `records[${index}].sourcePathExpression`
  );
  if (routeFromSourceExpression(sourcePathExpression, routeTemplate) !== routeTemplate) {
    throw new Error(
      `iOS relational inventory ${operationId} route differs from source path expression`
    );
  }
  return {
    operationId,
    method,
    routeTemplate,
    matrixRowId,
    operationVariantId,
    producerKind,
    producerSymbol,
    producerSourcePath,
    stableVariantSuffix: suffix,
    sourceMethodExpression,
    sourcePathExpression,
  };
}

export function canonicalIosInventoryRecordLine(record: IosNativeInventoryRecord): string {
  return RECORD_FIELDS.map((field) => record[field] ?? "").join("\t");
}

function parseMatrixRows(value: unknown): NativeContractMatrixRow[] {
  if (!Array.isArray(value)) throw new Error("iOS relational inventory matrixRows must be an array");
  return value.map((row, index) => {
    if (!isRecord(row)) throw new Error(`iOS relational inventory matrix row ${index} is invalid`);
    assertExactFields(row, ["id", "operationIds"], `iOS relational inventory matrix row ${index}`);
    const id = requiredString(row.id, `matrixRows[${index}].id`);
    const operationIds = requiredStringArray(
      row.operationIds,
      `matrixRows[${index}].operationIds`
    );
    if (new Set(operationIds).size !== operationIds.length) {
      throw new Error(`iOS relational inventory matrix row ${id} has duplicate operations`);
    }
    if (JSON.stringify(operationIds) !== JSON.stringify([...operationIds].sort())) {
      throw new Error(`iOS relational inventory matrix row ${id} is not sorted`);
    }
    return { id, operationIds };
  });
}

export function deriveNativeContractMatrixRows(
  operations: readonly Pick<NativeContractOperation, "id" | "matrixRowId">[]
): NativeContractMatrixRow[] {
  const grouped = new Map<string, string[]>();
  for (const operation of operations) {
    if (operation.matrixRowId === null) continue;
    const operationIds = grouped.get(operation.matrixRowId) ?? [];
    operationIds.push(operation.id);
    grouped.set(operation.matrixRowId, operationIds);
  }
  return [...grouped]
    .map(([id, operationIds]) => ({ id, operationIds: operationIds.sort() }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function deriveMatrixRowsFromRecords(records: IosNativeInventoryRecord[]): NativeContractMatrixRow[] {
  const operations = new Map<string, { id: string; matrixRowId: string | null }>();
  for (const record of records) {
    const existing = operations.get(record.operationId);
    if (existing && existing.matrixRowId !== record.matrixRowId) {
      throw new Error(
        `iOS relational inventory ${record.operationId} has inconsistent matrix membership`
      );
    }
    operations.set(record.operationId, {
      id: record.operationId,
      matrixRowId: record.matrixRowId,
    });
  }
  return deriveNativeContractMatrixRows([...operations.values()]);
}

function parseSourceInputs(value: unknown): Array<{ path: string; sha256: string }> {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("iOS relational inventory sourceInputs must be a non-empty array");
  }
  const inputs = value.map((input, index) => {
    if (!isRecord(input)) throw new Error(`iOS relational inventory source input ${index} is invalid`);
    assertExactFields(input, ["path", "sha256"], `iOS relational inventory source input ${index}`);
    return {
      path: requiredRepoPath(input.path, `sourceInputs[${index}].path`),
      sha256: requiredSha256(input.sha256, `sourceInputs[${index}].sha256`),
    };
  });
  const paths = inputs.map((input) => input.path);
  if (
    new Set(paths).size !== paths.length ||
    JSON.stringify(paths) !== JSON.stringify([...paths].sort())
  ) {
    throw new Error("iOS relational inventory source inputs must be unique and sorted");
  }
  for (const path of paths) {
    if (
      path !== IOS_INVENTORY_MAPPING_PATH &&
      path !== IOS_INVENTORY_GENERATOR_PATH &&
      !/^Packages\/[^/]+\/Sources\/.+\.swift$/.test(path)
    ) {
      throw new Error(`iOS relational inventory has an unsupported generation input: ${path}`);
    }
  }
  return inputs;
}

export function parseIosSourceInventoryManifest(value: unknown): IosSourceInventoryManifest {
  if (!isRecord(value)) throw new Error("iOS source inventory manifest must be a JSON object");
  assertExactFields(value, MANIFEST_FIELDS, "iOS source inventory manifest");
  if (value.schemaVersion !== "chapterflow-ios-native-inventory-v2") {
    throw new Error("iOS source inventory manifest must use relational schema v2");
  }
  if (value.iosRepository !== "WillSoltani/Chapterflow-IOS") {
    throw new Error("iOS source inventory manifest names an unexpected repository");
  }
  const iosBaseRevision = requiredString(value.iosBaseRevision, "iosBaseRevision");
  if (!/^[0-9a-f]{40}$/.test(iosBaseRevision)) {
    throw new Error("iOS source inventory base revision must be a full Git SHA");
  }
  const iosSourceRevision =
    value.iosSourceRevision === null
      ? null
      : requiredString(value.iosSourceRevision, "iosSourceRevision");
  const iosSourceRevisionPhase = requiredString(
    value.iosSourceRevisionPhase,
    "iosSourceRevisionPhase"
  );
  if (
    iosSourceRevisionPhase !== "uncommitted_contract_branch" &&
    iosSourceRevisionPhase !== "committed_contract_branch"
  ) {
    throw new Error("iOS source inventory has an unsupported source revision phase");
  }
  if (
    (iosSourceRevisionPhase === "uncommitted_contract_branch" && iosSourceRevision !== null) ||
    (iosSourceRevisionPhase === "committed_contract_branch" &&
      (iosSourceRevision === null || !/^[0-9a-f]{40}$/.test(iosSourceRevision)))
  ) {
    throw new Error("iOS source inventory revision does not match its provenance phase");
  }
  const canonicalization = requiredString(value.canonicalization, "canonicalization");
  if (canonicalization !== EXPECTED_CANONICALIZATION) {
    throw new Error("iOS relational inventory canonicalization contract changed");
  }

  const operationKeyCount = requiredInteger(value.operationKeyCount, "operationKeyCount");
  const producerVariantCount = requiredInteger(
    value.producerVariantCount,
    "producerVariantCount"
  );
  const matrixRowCount = requiredInteger(value.matrixRowCount, "matrixRowCount");
  const relationalRecordCount = requiredInteger(
    value.relationalRecordCount,
    "relationalRecordCount"
  );
  if (
    operationKeyCount !== EXPECTED_OPERATION_COUNT ||
    producerVariantCount !== EXPECTED_PRODUCER_COUNT ||
    relationalRecordCount !== EXPECTED_PRODUCER_COUNT ||
    matrixRowCount !== EXPECTED_MATRIX_ROW_COUNT
  ) {
    throw new Error("iOS relational inventory must contain exactly 83 operations, 92 records, and 29 rows");
  }

  const operationKeySha256 = requiredSha256(value.operationKeySha256, "operationKeySha256");
  const producerVariantIdSha256 = requiredSha256(
    value.producerVariantIdSha256,
    "producerVariantIdSha256"
  );
  const producerIdentitySha256 = requiredSha256(
    value.producerIdentitySha256,
    "producerIdentitySha256"
  );
  const relationalRecordSha256 = requiredSha256(
    value.relationalRecordSha256,
    "relationalRecordSha256"
  );
  const sourceInputTreeSha256 = requiredSha256(
    value.sourceInputTreeSha256,
    "sourceInputTreeSha256"
  );
  const sourceInputs = parseSourceInputs(value.sourceInputs);
  if (
    sha256Lines(sourceInputs.map((input) => `${input.path}\t${input.sha256}`)) !==
    sourceInputTreeSha256
  ) {
    throw new Error("iOS relational inventory source input tree digest is invalid");
  }

  if (!Array.isArray(value.records)) throw new Error("iOS relational inventory records are missing");
  const records = value.records.map(parseInventoryRecord);
  const sourceInputPaths = new Set(sourceInputs.map((input) => input.path));
  for (const requiredPath of [
    IOS_INVENTORY_MAPPING_PATH,
    IOS_INVENTORY_GENERATOR_PATH,
    ...records.map((record) => record.producerSourcePath),
  ]) {
    if (!sourceInputPaths.has(requiredPath)) {
      throw new Error(
        `iOS relational inventory source input tree omits required input: ${requiredPath}`
      );
    }
  }
  const relationalLines = records.map(canonicalIosInventoryRecordLine);
  if (
    records.length !== relationalRecordCount ||
    new Set(relationalLines).size !== records.length ||
    JSON.stringify(relationalLines) !== JSON.stringify([...relationalLines].sort()) ||
    sha256Lines(relationalLines) !== relationalRecordSha256
  ) {
    throw new Error("iOS relational inventory records are duplicated, unsorted, or have an invalid digest");
  }

  const operationContracts = new Map<string, string>();
  const operationKeys = new Set<string>();
  const variantIds = new Set<string>();
  const producerIdentities = new Set<string>();
  for (const record of records) {
    const operationContract = `${record.method}\t${record.routeTemplate}\t${record.matrixRowId ?? ""}`;
    const existing = operationContracts.get(record.operationId);
    if (existing && existing !== operationContract) {
      throw new Error(
        `iOS relational inventory ${record.operationId} producer records disagree on operation fields`
      );
    }
    operationContracts.set(record.operationId, operationContract);
    operationKeys.add(`${record.operationId}|${record.method}|${record.routeTemplate}`);
    if (variantIds.has(record.operationVariantId)) {
      throw new Error(`iOS relational inventory duplicate variant: ${record.operationVariantId}`);
    }
    variantIds.add(record.operationVariantId);
    const identity = `${record.producerKind}|${record.producerSymbol}|${record.producerSourcePath}`;
    if (producerIdentities.has(identity)) {
      throw new Error(`iOS relational inventory duplicate producer identity: ${identity}`);
    }
    producerIdentities.add(identity);
  }
  if (
    operationKeys.size !== operationKeyCount ||
    sha256Lines(operationKeys) !== operationKeySha256 ||
    variantIds.size !== producerVariantCount ||
    sha256Lines(variantIds) !== producerVariantIdSha256 ||
    sha256Lines(producerIdentities) !== producerIdentitySha256
  ) {
    throw new Error("iOS relational inventory operation, variant, or producer digests are invalid");
  }

  const matrixRows = parseMatrixRows(value.matrixRows);
  const derivedMatrixRows = deriveMatrixRowsFromRecords(records);
  if (
    matrixRows.length !== matrixRowCount ||
    JSON.stringify(matrixRows) !== JSON.stringify(derivedMatrixRows)
  ) {
    throw new Error("iOS relational inventory matrix summary does not exactly match its records");
  }
  const exactFactoryTestedProducerCount = requiredInteger(
    value.exactFactoryTestedProducerCount,
    "exactFactoryTestedProducerCount"
  );
  const bundleSuccessDecoderTestedOperationCount = requiredInteger(
    value.bundleSuccessDecoderTestedOperationCount,
    "bundleSuccessDecoderTestedOperationCount"
  );
  if (value.backendRuntimeFactoryValidationPerformed !== false) {
    throw new Error("backend must not claim Swift runtime factory validation");
  }
  const evidence = requiredStringArray(value.evidence, "evidence");
  if (evidence.length === 0) throw new Error("iOS source inventory evidence is empty");

  return {
    schemaVersion: "chapterflow-ios-native-inventory-v2",
    iosRepository: "WillSoltani/Chapterflow-IOS",
    iosBaseRevision,
    iosSourceRevision,
    iosSourceRevisionPhase,
    canonicalization,
    operationKeyCount,
    operationKeySha256,
    producerVariantCount,
    producerVariantIdSha256,
    producerIdentitySha256,
    matrixRowCount,
    relationalRecordCount,
    relationalRecordSha256,
    sourceInputTreeSha256,
    sourceInputs,
    records,
    matrixRows,
    exactFactoryTestedProducerCount,
    bundleSuccessDecoderTestedOperationCount,
    backendRuntimeFactoryValidationPerformed: false,
    evidence,
  };
}

function producerKind(producerSymbol: string): IosNativeInventoryProducerKind {
  if (producerSymbol.startsWith("DefaultAnalyticsClient.Path.")) return "analytics_path";
  if (
    producerSymbol === "LiveEntitlementRepository.verifyAppleTransaction" ||
    producerSymbol === "ScenarioRepository.syncPendingUploads"
  ) {
    return "direct_endpoint";
  }
  return "endpoint_factory";
}

function parseProducerEvidence(
  operationId: string,
  evidence: readonly string[]
): { producerSymbol: string; producerSourcePath: string } {
  if (evidence.length !== 1) {
    throw new Error(
      `iOS relational inventory ${operationId} requires exactly one native producer evidence entry`
    );
  }
  const match = /^([^@]+)@(Packages\/.+\/Sources\/.+\.swift):([1-9][0-9]*)$/.exec(evidence[0]);
  if (!match) {
    throw new Error(
      `iOS relational inventory ${operationId} producer evidence must end in one numeric source line: ${evidence[0]}`
    );
  }
  return { producerSymbol: match[1], producerSourcePath: match[2] };
}

function deriveBackendRelations(
  operations: readonly RelationalBackendOperation[]
): ComparableInventoryRecord[] {
  const records: ComparableInventoryRecord[] = [];
  const variantIds = new Set<string>();
  for (const operation of operations) {
    for (const request of operation.nativeRequestFixtures) {
      const { producerSymbol, producerSourcePath } = parseProducerEvidence(
        operation.id,
        request.producerEvidence
      );
      const suffix = stableVariantSuffix(producerSymbol);
      if (request.operationVariantId !== `${operation.id}:${suffix}`) {
        throw new Error(
          `iOS relational inventory ${operation.id} variant ${request.operationVariantId} does not match producer ${producerSymbol}`
        );
      }
      if (variantIds.has(request.operationVariantId)) {
        throw new Error(
          `iOS relational inventory has a duplicate backend variant: ${request.operationVariantId}`
        );
      }
      variantIds.add(request.operationVariantId);
      records.push({
        operationId: operation.id,
        method: operation.method,
        routeTemplate: operation.routeTemplate,
        matrixRowId: operation.matrixRowId,
        operationVariantId: request.operationVariantId,
        producerKind: producerKind(producerSymbol),
        producerSymbol,
        producerSourcePath,
        stableVariantSuffix: suffix,
      });
    }
  }
  return records;
}

function matrixDifferences(
  expectedRows: NativeContractMatrixRow[],
  backendRows: NativeContractMatrixRow[]
): string[] {
  const expected = new Map(expectedRows.map((row) => [row.id, new Set(row.operationIds)]));
  const backend = new Map(backendRows.map((row) => [row.id, new Set(row.operationIds)]));
  const rowIds = new Set([...expected.keys(), ...backend.keys()]);
  const differences: string[] = [];
  for (const rowId of [...rowIds].sort()) {
    const expectedOperations = expected.get(rowId) ?? new Set<string>();
    const backendOperations = backend.get(rowId) ?? new Set<string>();
    const missing = [...expectedOperations].filter((operationId) => !backendOperations.has(operationId));
    const unexpected = [...backendOperations].filter(
      (operationId) => !expectedOperations.has(operationId)
    );
    if (missing.length > 0 || unexpected.length > 0) {
      differences.push(
        `matrix row ${rowId}: missing backend=${missing.sort().join(",") || "none"}; ` +
          `unexpected backend=${unexpected.sort().join(",") || "none"}`
      );
    }
  }
  return differences;
}

export function assertIosSourceInventoryRelations(
  manifest: IosSourceInventoryManifest,
  operations: readonly RelationalBackendOperation[]
): void {
  const backendRelations = deriveBackendRelations(operations);
  const expectedByVariant = new Map(
    manifest.records.map((record) => [record.operationVariantId, record])
  );
  const backendByVariant = new Map(
    backendRelations.map((record) => [record.operationVariantId, record])
  );
  const differences: string[] = [];
  const comparableFields: Array<keyof ComparableInventoryRecord> = [
    "operationId",
    "method",
    "routeTemplate",
    "matrixRowId",
    "producerKind",
    "producerSymbol",
    "producerSourcePath",
    "stableVariantSuffix",
  ];

  for (const [variantId, expected] of [...expectedByVariant].sort()) {
    const actual = backendByVariant.get(variantId);
    if (!actual) {
      differences.push(`missing backend variant ${variantId} for ${expected.operationId}`);
      continue;
    }
    for (const field of comparableFields) {
      if (expected[field] !== actual[field]) {
        differences.push(
          `${variantId}.${field}: iOS=${String(expected[field])} backend=${String(actual[field])}`
        );
      }
    }
  }
  for (const [variantId, actual] of [...backendByVariant].sort()) {
    if (!expectedByVariant.has(variantId)) {
      differences.push(`unexpected backend variant ${variantId} on ${actual.operationId}`);
    }
  }

  const backendMatrixRows = deriveNativeContractMatrixRows(operations);
  differences.push(...matrixDifferences(manifest.matrixRows, backendMatrixRows));
  if (backendRelations.length !== manifest.relationalRecordCount) {
    differences.push(
      `record count differs: iOS=${manifest.relationalRecordCount} backend=${backendRelations.length}`
    );
  }
  if (operations.length !== manifest.operationKeyCount) {
    differences.push(
      `operation count differs: iOS=${manifest.operationKeyCount} backend=${operations.length}`
    );
  }

  if (differences.length > 0) {
    throw new Error(`iOS relational inventory mismatch:\n- ${differences.join("\n- ")}`);
  }
}
