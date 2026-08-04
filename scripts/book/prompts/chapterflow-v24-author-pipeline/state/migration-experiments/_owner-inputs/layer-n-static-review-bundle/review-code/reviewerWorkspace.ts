/**
 * reviewerWorkspace (IMP-08, F-015/F-022) — role-specific reviewer workspaces.
 *
 * Makes reviewer blindness TECHNICAL instead of instruction-based: each
 * reviewer role gets a temporary directory OUTSIDE the pipeline repository
 * (os tmpdir via IMP-00's buildRoleWorkspace) containing ONLY the artifact
 * kinds its manifest authorizes. The spawn's cwd is that directory with a
 * read-only sandbox, so "read only this file" no longer coexists with an
 * entire visible repo (answer keys, sources, prior verdicts, model config).
 *
 * The manifest matrix below is the single source of truth for what each
 * ReviewerRoleV1 may see. Fail-closed on both axes:
 *   - an artifact whose kind is not in the role's manifest throws at build;
 *   - a KEY-BLIND role's artifact containing answer-key material throws at
 *     build (defense in depth behind assertPhase1KeyIsolated).
 *
 * The workspace file manifest (relPath + sha256 + bytes, from IMP-00) is
 * hashed into `manifestSha256` so a persisted review can be bound to the
 * EXACT file set its reviewer saw (plan instruction 5).
 */

import { readFileSync } from "fs";
import { join } from "path";

import type { ReviewerRoleV1 } from "../contracts/reviewContracts.js";
import { hashCanonical, sha256Hex } from "../contracts/contractUtil.js";
import type { WorkspaceFileV1 } from "../contracts/effectiveContext.js";
import { buildRoleWorkspace, unexpectedWorkspaceEntries } from "../exec/roleWorkspace.js";

// ── Artifact kinds ────────────────────────────────────────────────────────────

/** The closed set of artifact kinds a reviewer workspace may host. Kinds are
 *  COARSE on purpose — the authorization unit is "what class of information",
 *  not a filename. */
export type ReviewerArtifactKind =
  | "phase1-doc"       // reader-facing content WITHOUT answer key/explanations
  | "phase2-doc"       // committed derivation + answer key + adjudication ask
  | "source-evidence"  // bounded citable source-evidence packet
  | "source-plan"      // rendered source-use plan (claim ceilings; no identity)
  | "causal-claims";   // extracted causal-claim packet (unit-linked spans)

export type ReviewerArtifact = {
  kind: ReviewerArtifactKind;
  /** Path INSIDE the workspace (relative; validated by buildRoleWorkspace). */
  relPath: string;
  content: string;
};

// ── The role manifest matrix (plan instruction 1) ─────────────────────────────

/** Minimum artifact set per reviewer role. A direct reader sees reader-facing
 *  content ONLY — no key, no source, no author/model identity, no prior
 *  verdicts. The quiz adjudicator is the ONLY role that ever sees the key, and
 *  only bundled with the already-committed derivation (phase-2 doc). The
 *  source/causal verifiers see bounded evidence + the plan, never identity or
 *  other reviewers' conclusions (those artifact kinds simply do not exist). */
export const REVIEWER_ROLE_MANIFESTS: Record<ReviewerRoleV1, readonly ReviewerArtifactKind[]> = {
  "direct-reader": ["phase1-doc"],
  "quiz-derivation": ["phase1-doc"],
  "quiz-adjudication": ["phase2-doc"],
  "source-verifier": ["phase1-doc", "source-evidence", "source-plan"],
  "causal-verifier": ["phase1-doc", "source-plan", "causal-claims"],
  "tiebreak": ["phase1-doc"],
  "acceptance-reader": ["phase1-doc"],
};

/** Roles that must NEVER see answer-key material in ANY artifact. Everything
 *  except the phase-2 adjudicator (whose whole job is key-visible). */
export const KEY_BLIND_REVIEWER_ROLES: readonly ReviewerRoleV1[] = [
  "direct-reader", "quiz-derivation", "source-verifier", "causal-verifier", "tiebreak", "acceptance-reader",
];

// ── Key-material detection (build-time containment, not the primary assert) ──

const ANSWER_KEY_HEADER_RE = /^## ANSWER KEY/m;
/** A chapter key row (`Q3: b — …`) or a book combined-key row
 *  (`CHAPTER 4 Q3: b`) — the two shapes the legacy renderers emit. */
const KEY_ROW_RE = /^(?:CHAPTER \d+ )?Q\d+: [abc?](?: — .*)?$/m;

/** True when `text` contains answer-key material in either rendered shape. */
export function containsAnswerKeyMaterial(text: string): boolean {
  return ANSWER_KEY_HEADER_RE.test(text) || KEY_ROW_RE.test(text);
}

// ── Workspace construction ────────────────────────────────────────────────────

export class ReviewerWorkspaceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewerWorkspaceError";
  }
}

export type ReviewerWorkspace = {
  role: ReviewerRoleV1;
  /** Absolute temp dir OUTSIDE the repository — the spawn's cwd. */
  dir: string;
  /** IMP-00 hashed file manifest (relPath + sha256 + bytes, sorted). */
  files: WorkspaceFileV1[];
  /** hashCanonical({role, files}) — binds a review to the exact file set. */
  manifestSha256: string;
  cleanup: () => void;
};

/** Build a role-authorized reviewer workspace. Fail-closed: unknown role,
 *  artifact kind outside the role's manifest, key material reaching a
 *  key-blind role, or forbidden strings (author/model identity) in ANY
 *  artifact all throw BEFORE any directory exists. */
export function buildReviewerWorkspace(opts: {
  role: ReviewerRoleV1;
  artifacts: ReviewerArtifact[];
  /** Strings that must not appear in ANY reviewer-visible artifact — the
   *  caller passes what it knows (resolved model name, author session id). */
  forbiddenStrings?: readonly string[];
  baseDir?: string;
}): ReviewerWorkspace {
  const allowed = REVIEWER_ROLE_MANIFESTS[opts.role];
  if (!allowed) throw new ReviewerWorkspaceError(`unknown reviewer role "${String(opts.role)}"`);
  if (opts.artifacts.length === 0) throw new ReviewerWorkspaceError(`reviewer workspace for ${opts.role}: no artifacts`);
  const keyBlind = KEY_BLIND_REVIEWER_ROLES.includes(opts.role);
  for (const a of opts.artifacts) {
    if (!allowed.includes(a.kind)) {
      throw new ReviewerWorkspaceError(
        `reviewer workspace for ${opts.role}: artifact kind "${a.kind}" (${a.relPath}) is not in the role manifest [${allowed.join(", ")}]`,
      );
    }
    if (keyBlind && containsAnswerKeyMaterial(a.content)) {
      throw new ReviewerWorkspaceError(
        `reviewer workspace for ${opts.role}: artifact ${a.relPath} contains answer-key material — ${opts.role} is a key-blind role`,
      );
    }
    for (const forbidden of opts.forbiddenStrings ?? []) {
      if (forbidden.length > 0 && a.content.includes(forbidden)) {
        throw new ReviewerWorkspaceError(
          `reviewer workspace for ${opts.role}: artifact ${a.relPath} contains a forbidden identity string — reviewers must not see author/model identity`,
        );
      }
    }
  }
  const ws = buildRoleWorkspace({
    label: `reviewer-${opts.role}`,
    files: opts.artifacts.map((a) => ({ relPath: a.relPath, content: a.content })),
    baseDir: opts.baseDir,
  });
  return {
    role: opts.role,
    dir: ws.dir,
    files: ws.files,
    manifestSha256: hashCanonical({ role: opts.role, files: ws.files }),
    cleanup: ws.cleanup,
  };
}

/** Post-spawn integrity check for read-only reviewer roles: the workspace must
 *  contain EXACTLY the manifest files, byte-identical. Extra entries or a
 *  drifted file mean the "read-only" envelope did not hold — the attempt's
 *  output cannot be trusted against the intended document bytes. Throws
 *  ReviewerWorkspaceError; callers treat it like a failed attempt, never a
 *  verdict. */
export function assertReviewerWorkspaceIntact(ws: ReviewerWorkspace): void {
  const debris = unexpectedWorkspaceEntries(ws.dir, ws.files.map((f) => f.relPath));
  if (debris.length > 0) {
    throw new ReviewerWorkspaceError(
      `reviewer workspace (${ws.role}) gained unexpected entries after a read-only spawn: ${debris.join(", ")}`,
    );
  }
  for (const f of ws.files) {
    const now = sha256Hex(readFileSync(join(ws.dir, f.relPath)));
    if (now !== f.sha256) {
      throw new ReviewerWorkspaceError(
        `reviewer workspace (${ws.role}) file ${f.relPath} drifted during a read-only spawn (${f.sha256.slice(0, 12)}… → ${now.slice(0, 12)}…)`,
      );
    }
  }
}
