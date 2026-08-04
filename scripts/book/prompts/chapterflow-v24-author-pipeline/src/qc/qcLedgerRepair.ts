import { randomBytes } from "node:crypto";
import { link, unlink, writeFile } from "node:fs/promises";

import { replaceFileAtomic } from "../books/atomicBookFiles.js";
import { ensureDirectoryWithinBooksRoot, readRegularFileWithinBooksRoot } from "../books/bookPaths.js";
import type { Result, UtcIso } from "../contracts/v4Core.js";
import {
  parseLedgerBytes,
  safeQcId,
  serializeLedger,
  type QcLedgerRepairEvent,
  type QcStore,
} from "./qcStore.js";
import type { LedgerRepairRequest, LedgerRepairResult } from "./qcTypes.js";

export type QcLedgerRepairPoint =
  | "ledger.after-preserve"
  | "ledger.before-replace"
  | "ledger.after-replace";

export interface QcLedgerRepairSeams {
  readonly point?: (name: QcLedgerRepairPoint) => void;
  readonly tempSuffix?: () => string;
}

export interface QcLedgerRepairOptions {
  readonly booksRoot: string;
  readonly store: QcStore;
  readonly now: () => UtcIso;
  readonly seams?: QcLedgerRepairSeams;
}

function failed<T>(code: string, message: string): Result<T> {
  return { ok: false, error: { code, message } };
}

function isCanonicalUtc(value: string): boolean {
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}

async function createPreservedFile(filePath: string, bytes: Uint8Array): Promise<"CREATED" | "EXISTS"> {
  const temporaryPath = `${filePath}.tmp-${process.pid}-${randomBytes(8).toString("hex")}`;
  try {
    await writeFile(temporaryPath, bytes, { flag: "wx", mode: 0o600 });
    try {
      await link(temporaryPath, filePath);
      return "CREATED";
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code === "EEXIST") return "EXISTS";
      throw cause;
    }
  } finally {
    await unlink(temporaryPath).catch((cause: NodeJS.ErrnoException) => {
      if (cause.code !== "ENOENT") throw cause;
    });
  }
}

export async function repairQcLedgerUnlocked(
  options: QcLedgerRepairOptions,
  request: LedgerRepairRequest,
): Promise<Result<Readonly<LedgerRepairResult>>> {
  if (request.confirmation !== "REPAIR_QC_LEDGER") {
    return failed("QC_LEDGER_REPAIR_CONFIRMATION_REQUIRED", "ledger repair requires exact REPAIR_QC_LEDGER confirmation");
  }
  if (!Number.isSafeInteger(request.expectedRevision) || request.expectedRevision < 0) {
    return failed("QC_LEDGER_REVISION_INVALID", "expected ledger revision must be a non-negative safe integer");
  }
  try {
    safeQcId(request.repairId, "repairId");
  } catch (cause) {
    return failed("INVALID_QC_ID", (cause as Error).message);
  }

  const paths = options.store.paths(request.bookId);
  if (!paths.ok) return paths;
  const raw = await options.store.readLedgerRaw(request.bookId);
  if (!raw.ok) return raw;
  const parsed = parseLedgerBytes(raw.value);

  const prior = parsed.events.find(
    (event): event is QcLedgerRepairEvent => event.kind === "REPAIR" && event.repairId === request.repairId,
  );
  if (prior) {
    if (request.expectedRevision !== prior.beforeRevision) {
      return failed("QC_LEDGER_REPAIR_ID_CONFLICT", `repair ID is already bound to revision ${prior.beforeRevision}`);
    }
    return {
      ok: true,
      value: {
        beforeRevision: prior.beforeRevision,
        afterRevision: prior.revision,
        preservedSourcePath: paths.value.preserved(request.repairId),
      },
    };
  }

  const beforeRevision = parsed.events.length;
  if (request.expectedRevision !== beforeRevision) {
    return failed(
      "QC_LEDGER_REVISION_CONFLICT",
      `expected ledger revision ${request.expectedRevision}, found ${beforeRevision}`,
    );
  }
  if (parsed.issues.length === 0 && parsed.events.length > 0) {
    return failed("QC_LEDGER_NOT_MALFORMED", "ledger repair requires a malformed current ledger");
  }

  const repairedAt = options.now();
  if (!isCanonicalUtc(repairedAt)) return failed("QC_CLOCK_INVALID", "QC clock must return canonical UTC ISO time");
  const repairEvent: QcLedgerRepairEvent = {
    schemaVersion: "1",
    kind: "REPAIR",
    revision: beforeRevision + 1,
    repairId: request.repairId,
    beforeRevision,
    repairedAt,
  };
  const preservedSourcePath = paths.value.preserved(request.repairId);

  try {
    await ensureDirectoryWithinBooksRoot(options.booksRoot, paths.value.preservedRoot);
    const preserved = await createPreservedFile(preservedSourcePath, raw.value);
    if (preserved === "EXISTS") {
      const existing = await readRegularFileWithinBooksRoot(options.booksRoot, preservedSourcePath);
      if (!existing.equals(raw.value)) {
        return failed("QC_LEDGER_REPAIR_ID_CONFLICT", "repair ID already preserves different source bytes");
      }
    }
    options.seams?.point?.("ledger.after-preserve");
    options.seams?.point?.("ledger.before-replace");
    await replaceFileAtomic(
      paths.value.ledger,
      serializeLedger([...parsed.events, repairEvent]),
      { tempSuffix: options.seams?.tempSuffix },
    );
    options.seams?.point?.("ledger.after-replace");
    return {
      ok: true,
      value: {
        beforeRevision,
        afterRevision: beforeRevision + 1,
        preservedSourcePath,
      },
    };
  } catch (cause) {
    return failed("QC_LEDGER_REPAIR_IO", `ledger repair failed: ${(cause as Error).message}`);
  }
}
