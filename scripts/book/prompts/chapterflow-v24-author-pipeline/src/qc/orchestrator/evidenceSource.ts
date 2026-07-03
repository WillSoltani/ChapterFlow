import { createHash } from "crypto";

import type { SubmissionRole } from "./schemas.js";

export type EvidenceSourceKind = "raw_submission" | "derived_artifact" | "effective_decision";

export type EvidenceSourceRef = {
  sourceRole: SubmissionRole | "finalizer";
  submissionFile: string;
  sourceKind: EvidenceSourceKind;
  sourceId: string;
};

function normalize(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function evidenceSourceId(args: {
  bookId: string;
  roundId: string;
  sourceRole: SubmissionRole | "finalizer";
  submissionFile: string;
  sourceKind: EvidenceSourceKind;
  variant?: string;
}): string {
  const raw = [
    normalize(args.bookId),
    normalize(args.roundId),
    normalize(args.sourceRole),
    normalize(args.sourceKind),
    normalize(args.variant),
    normalize(args.submissionFile),
  ].join("\n");
  const prefix = args.sourceKind === "effective_decision" ? "qce" : "qcs";
  return `${prefix}-${createHash("sha256").update(raw, "utf8").digest("hex").slice(0, 16)}`;
}

export function evidenceSourceRef(args: {
  bookId: string;
  roundId: string;
  sourceRole: SubmissionRole | "finalizer";
  submissionFile: string;
  sourceKind: EvidenceSourceKind;
  variant?: string;
}): EvidenceSourceRef {
  return {
    sourceRole: args.sourceRole,
    submissionFile: args.submissionFile,
    sourceKind: args.sourceKind,
    sourceId: evidenceSourceId(args),
  };
}
