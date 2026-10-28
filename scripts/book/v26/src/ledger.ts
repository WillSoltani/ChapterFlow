import fs from "node:fs";
import path from "node:path";

/** One row per model call attempt (retries included), appended as a JSON line. */
export interface LedgerRow {
  ts: string;
  chapter: string;
  step: string;
  model: string;
  effort: string;
  cost: number;
  outTokens: number | null;
  stopReason: string | null;
  seconds: number;
  isError: boolean;
}

export function readLedger(file: string): LedgerRow[] {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line, i) => {
      // A bad row must stop the run: silently skipping it would under-count spend.
      try {
        return JSON.parse(line) as LedgerRow;
      } catch {
        throw new Error(`ledger ${file}: line ${i + 1} is not valid JSON`);
      }
    });
}

export function ledgerTotal(file: string): number {
  return readLedger(file).reduce((sum, r) => sum + (r.cost || 0), 0);
}

export function appendLedger(file: string, row: LedgerRow): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(row) + "\n");
}
