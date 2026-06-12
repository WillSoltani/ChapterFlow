import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { orchestratorRoundDir, roundRecordPath } from "../orchestrator/artifacts.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = resolve(__dirname, "../../../templates/qc-auto.workflow.template.js");

export function qcAutoWorkflowPath(bookId: string, roundId: string): string {
  return resolve(orchestratorRoundDir(bookId, roundId), "qc-auto.workflow.js");
}

export function generateQcAutoWorkflow(bookId: string, roundId: string, options: { maxAgents?: number } = {}): string {
  const template = readFileSync(TEMPLATE_PATH, "utf8");
  const rendered = template
    .replaceAll("__BOOK_ID__", JSON.stringify(bookId))
    .replaceAll("__ROUND_ID__", JSON.stringify(roundId))
    .replaceAll("__ROUND_RECORD_PATH__", JSON.stringify(roundRecordPath(bookId, roundId)))
    .replaceAll("__MAX_AGENTS__", JSON.stringify(options.maxAgents ?? null));
  const path = qcAutoWorkflowPath(bookId, roundId);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, rendered, "utf8");
  return path;
}
