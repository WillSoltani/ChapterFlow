/**
 * s16-rubric-audit-v1 — blind-worker receipt chain (TS port).
 *
 * Exact port of the owner's `worker_receipts.py` (retained with the ratified
 * gold-bar audit run under docs/v25/rubric-audit-2026-07-15/): fail-closed
 * dispatch receipts, blind pair seals, and canonical artifact hashing for the
 * rubric-v2 chapter-audit instrument (plan v2 P1, decision D7). Proven
 * bit-compatible against that sealed run by fixture test — every stored
 * dispatch/result/judgment/binding sha256 must be reproduced from the committed
 * record bytes. Records are handled as { raw, value } pairs because canonical
 * hashing needs the RAW TEXT (python float fidelity — see
 * rubricAuditCanonical.ts); plain-parsed values are for field access only.
 */

import { hashCanonical } from "../../contracts/contractUtil.js";
import {
  RubricAuditError,
  artifactSha256FromText,
  judgmentSha256FromText,
} from "./rubricAuditCanonical.js";

export { RubricAuditError };

const SHA256_RE = /^[0-9a-f]{64}$/;
export const RUBRIC_WORKER_ROLES = ["primary", "verification"] as const;
export type RubricWorkerRole = (typeof RUBRIC_WORKER_ROLES)[number];

export const RUBRIC_RECEIPT_ISSUER = "chapterflow_evaluation_orchestrator" as const;
export const RUBRIC_DISPATCH_ARTIFACT_TYPE = "chapterflow_worker_dispatch_receipt" as const;
export const RUBRIC_PAIR_SEAL_ARTIFACT_TYPE = "chapterflow_blind_pair_seal" as const;

export type JsonRecord = Record<string, unknown>;

/** A record as loaded from disk: raw bytes for hashing, parsed for reading. */
export type LoadedRecord = { raw: string; value: JsonRecord };

export function loadRecord(raw: string): LoadedRecord {
  const value = JSON.parse(raw) as unknown;
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new RubricAuditError("record must be a top-level JSON object");
  }
  return { raw, value: value as JsonRecord };
}

function boundHash(value: JsonRecord): string {
  const payload: JsonRecord = {};
  for (const key of Object.keys(value)) {
    if (key !== "binding_sha256") payload[key] = value[key];
  }
  return hashCanonical(payload);
}

type ChapterInventoryItem = {
  chapter_index?: unknown;
  chapter_id?: unknown;
  number?: unknown;
  title?: unknown;
};

export type RubricInspection = JsonRecord & {
  book_id?: string;
  source_path?: string;
  source_hash?: string;
  inventory_complete?: boolean;
  chapter_count?: number;
  chapter_inventory?: ChapterInventoryItem[];
  heading_inventory_sha256?: string;
};

export function inventorySha256(inspection: RubricInspection): string {
  const inventory = inspection.chapter_inventory;
  if (inspection.inventory_complete !== true || !Array.isArray(inventory) || inventory.length === 0) {
    throw new RubricAuditError("worker receipts require a complete, positive source chapter inventory");
  }
  if (inspection.chapter_count !== inventory.length) {
    throw new RubricAuditError("worker receipt inventory count does not match chapter_inventory");
  }
  const indices = inventory.map((item) =>
    item !== null && typeof item === "object" ? (item as ChapterInventoryItem).chapter_index : null);
  for (let i = 0; i < inventory.length; i += 1) {
    if (indices[i] !== i + 1) {
      throw new RubricAuditError("worker receipt inventory indices must be exactly 1..chapter_count");
    }
  }
  const entries = inventory.filter((item): item is ChapterInventoryItem =>
    item !== null && typeof item === "object");
  if (entries.length !== inventory.length) {
    throw new RubricAuditError("worker receipt inventory entries must all be objects");
  }
  // Inventory fields are strings and small integers — plain canonical hashing
  // is float-safe here (proven by dispatch-hash equality on the sealed run).
  return hashCanonical({
    book_id: inspection.book_id,
    chapter_count: inventory.length,
    chapter_inventory: entries.map((item) => ({
      chapter_index: item.chapter_index,
      chapter_id: item.chapter_id,
      number: item.number,
      title: item.title,
    })),
  });
}

function nonEmpty(value: unknown): boolean {
  return String(value ?? "").trim().length > 0;
}

export function issueDispatchReceipt(args: {
  pairId: string;
  runId: string;
  bookId: string;
  sourceHash: string;
  inspection: RubricInspection;
  role: RubricWorkerRole;
  jobId: string;
  workerTaskId: string;
  workerSessionId: string;
  issuedAtUtc: string;
}): JsonRecord {
  const labeled: Array<[string, string]> = [
    ["pair_id", args.pairId], ["run_id", args.runId], ["book_id", args.bookId],
    ["job_id", args.jobId], ["worker_task_id", args.workerTaskId], ["worker_session_id", args.workerSessionId],
  ];
  for (const [label, value] of labeled) {
    if (!nonEmpty(value)) throw new RubricAuditError(`dispatch receipt ${label} must be nonempty`);
  }
  if (!RUBRIC_WORKER_ROLES.includes(args.role)) {
    throw new RubricAuditError("dispatch receipt role must be primary or verification");
  }
  if (!SHA256_RE.test(args.sourceHash)) {
    throw new RubricAuditError("dispatch receipt source_hash must be a lowercase SHA-256 digest");
  }
  if (String(args.inspection.book_id ?? "") !== args.bookId) {
    throw new RubricAuditError("dispatch receipt book_id differs from the source inspection");
  }
  const receipt: JsonRecord = {
    schema_version: "1.0.0",
    artifact_type: RUBRIC_DISPATCH_ARTIFACT_TYPE,
    issuer: RUBRIC_RECEIPT_ISSUER,
    pair_id: args.pairId,
    issued_at_utc: args.issuedAtUtc,
    run_id: args.runId,
    book_id: args.bookId,
    source_hash: args.sourceHash,
    inventory_sha256: inventorySha256(args.inspection),
    role: args.role,
    job_id: args.jobId,
    worker_task_id: args.workerTaskId,
    worker_session_id: args.workerSessionId,
  };
  receipt.binding_sha256 = boundHash(receipt);
  return receipt;
}

export function validateDispatchReceipt(
  receipt: LoadedRecord,
  args: { result: LoadedRecord; inspection: RubricInspection },
): string[] {
  const errors: string[] = [];
  const value = receipt.value;
  const constants: Array<[string, string]> = [
    ["schema_version", "1.0.0"],
    ["artifact_type", RUBRIC_DISPATCH_ARTIFACT_TYPE],
    ["issuer", RUBRIC_RECEIPT_ISSUER],
  ];
  for (const [key, expected] of constants) {
    if (value[key] !== expected) errors.push(`worker dispatch receipt ${key} must equal '${expected}'`);
  }
  if (!RUBRIC_WORKER_ROLES.includes(value.role as RubricWorkerRole)) {
    errors.push("worker dispatch receipt role is invalid");
  }
  for (const key of ["pair_id", "run_id", "book_id", "job_id", "worker_task_id", "worker_session_id", "issued_at_utc"]) {
    if (!nonEmpty(value[key])) errors.push(`worker dispatch receipt ${key} must be nonempty`);
  }
  if (!SHA256_RE.test(String(value.source_hash ?? ""))) {
    errors.push("worker dispatch receipt source_hash is malformed");
  }
  let expectedInventory = "";
  try {
    expectedInventory = inventorySha256(args.inspection);
  } catch (error) {
    errors.push((error as Error).message);
  }
  const book = args.result.value.book;
  const comparisons: Array<[string, unknown]> = [
    ["run_id", args.result.value.run_id],
    ["book_id", book !== null && typeof book === "object" ? (book as JsonRecord).book_id : null],
    ["job_id", args.result.value.job_id],
    ["role", args.result.value.rater_role],
    ["source_hash", args.result.value.source_hash],
    ["inventory_sha256", expectedInventory],
  ];
  for (const [key, expected] of comparisons) {
    if (value[key] !== expected) errors.push(`worker dispatch receipt ${key} does not match the bound result/source`);
  }
  if (value.binding_sha256 !== boundHash(value)) {
    errors.push("worker dispatch receipt binding_sha256 is invalid");
  }
  if (args.result.value.worker_dispatch_receipt_sha256 !== artifactSha256FromText(receipt.raw)) {
    errors.push("result worker_dispatch_receipt_sha256 does not match its dispatch receipt");
  }
  return errors;
}

export function sealPairReceipt(args: {
  primary: LoadedRecord;
  verification: LoadedRecord;
  primaryDispatch: LoadedRecord;
  verificationDispatch: LoadedRecord;
  inspection: RubricInspection;
  sealedAtUtc: string;
}): JsonRecord {
  const errors = [
    ...validateDispatchReceipt(args.primaryDispatch, { result: args.primary, inspection: args.inspection }),
    ...validateDispatchReceipt(args.verificationDispatch, { result: args.verification, inspection: args.inspection }),
  ];
  if (errors.length > 0) {
    throw new RubricAuditError(`cannot seal invalid worker dispatch chain: ${errors.join(" | ")}`);
  }
  const pd = args.primaryDispatch.value;
  const vd = args.verificationDispatch.value;
  for (const key of ["job_id", "worker_task_id", "worker_session_id"]) {
    if (pd[key] === vd[key]) {
      throw new RubricAuditError("primary and verification workers require distinct job, task, and session identities");
    }
  }
  for (const key of ["pair_id", "run_id", "book_id", "source_hash", "inventory_sha256"]) {
    if (pd[key] !== vd[key]) {
      throw new RubricAuditError("primary and verification dispatch receipts do not share one source-bound pair identity");
    }
  }
  const primaryJudgment = judgmentSha256FromText(args.primary.raw);
  const verificationJudgment = judgmentSha256FromText(args.verification.raw);
  if (primaryJudgment === verificationJudgment) {
    throw new RubricAuditError("blind pair cannot be an administrative clone of one worker judgment");
  }
  const seal: JsonRecord = {
    schema_version: "1.0.0",
    artifact_type: RUBRIC_PAIR_SEAL_ARTIFACT_TYPE,
    issuer: RUBRIC_RECEIPT_ISSUER,
    pair_id: pd.pair_id,
    sealed_at_utc: args.sealedAtUtc,
    run_id: pd.run_id,
    book_id: pd.book_id,
    source_hash: pd.source_hash,
    inventory_sha256: pd.inventory_sha256,
    workers: {
      primary: {
        job_id: pd.job_id,
        worker_task_id: pd.worker_task_id,
        worker_session_id: pd.worker_session_id,
        dispatch_receipt_sha256: artifactSha256FromText(args.primaryDispatch.raw),
        result_canonical_sha256: artifactSha256FromText(args.primary.raw),
        judgment_sha256: primaryJudgment,
      },
      verification: {
        job_id: vd.job_id,
        worker_task_id: vd.worker_task_id,
        worker_session_id: vd.worker_session_id,
        dispatch_receipt_sha256: artifactSha256FromText(args.verificationDispatch.raw),
        result_canonical_sha256: artifactSha256FromText(args.verification.raw),
        judgment_sha256: verificationJudgment,
      },
    },
  };
  seal.binding_sha256 = boundHash(seal);
  return seal;
}

export function validatePairChain(args: {
  primary: LoadedRecord;
  verification: LoadedRecord;
  primaryDispatch: LoadedRecord;
  verificationDispatch: LoadedRecord;
  pairSeal: LoadedRecord;
  inspection: RubricInspection;
}): string[] {
  const errors = [
    ...validateDispatchReceipt(args.primaryDispatch, { result: args.primary, inspection: args.inspection }),
    ...validateDispatchReceipt(args.verificationDispatch, { result: args.verification, inspection: args.inspection }),
  ];
  let expected: JsonRecord;
  try {
    expected = sealPairReceipt({
      primary: args.primary,
      verification: args.verification,
      primaryDispatch: args.primaryDispatch,
      verificationDispatch: args.verificationDispatch,
      inspection: args.inspection,
      sealedAtUtc: String(args.pairSeal.value.sealed_at_utc ?? ""),
    });
  } catch (error) {
    errors.push((error as Error).message);
    return [...new Set(errors)].sort();
  }
  // Seals carry only strings — plain canonical equality is float-safe, and the
  // stored side is hashed from raw text for full fidelity anyway.
  if (artifactSha256FromText(args.pairSeal.raw) !== hashCanonical(expected)) {
    errors.push("blind pair seal does not match the exact dispatch receipts and result payloads");
  }
  return [...new Set(errors)].sort();
}
