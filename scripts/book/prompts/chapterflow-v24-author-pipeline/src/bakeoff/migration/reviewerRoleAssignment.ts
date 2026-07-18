/**
 * IMP-20 WP-B5 — FIXED judge assignment for the split-lane reviewer (design §G),
 * replacing the execution-order rotation the §16 migration harness historically
 * used (baseline E-06).
 *
 * The primary judge for every role is the SAME across every candidate cell: a
 * pure function of the sealed experiment spec's judge panel, NEVER a function of
 * the record's execution order, cell id, sample index, or the candidate's
 * authoring model. A backup / adjudicator read runs ONLY on the frozen balanced
 * audit subset — a deterministic, output-independent selection — so an
 * inconvenient candidate can never be re-rolled onto a different judge.
 *
 * This module is PURE: no file I/O, no ambient environment reads, no canonical
 * pipeline state. It is subject to the migration firewall (no ambient env, no
 * verb capability, no promotion/publish import, no forbidden canonical-tree
 * literal — not even in comments).
 */

import type {
  ExperimentSpecV1,
  MigrationSampleRecordV1,
} from "./experimentTypes.js";
import { MigrationGuardError } from "./guards.js";
import {
  FIXED_ROLE_ASSIGNMENT_SCHEMA,
  type AssignFixedRolesFn,
  type FixedRoleAssignmentV1,
  type RoleJudgeRefV1,
} from "./reviewLaneTypes.js";

/**
 * The deterministic quiz answer-tell checker version stamped into every fixed
 * assignment. The quiz lane's key / tell verdict is a code path (answer-length
 * outlier + absolute-wording lexicon), never a model profile — a model cannot
 * hide a tell.
 */
export const QUIZ_DETERMINISTIC_CHECKER_VERSION = "quiz-answer-tell-checker-v1" as const;

/**
 * The frozen role-assignment policy version. A change here stales any prior
 * qualification: it is bound into the split-lane instrument manifest (design §M)
 * so a re-shuffled assignment cannot silently reuse an old qualification.
 */
export const ROLE_ASSIGNMENT_POLICY_VERSION = "fixed-role-assignment-v1" as const;

/**
 * The designated audit sample index. Exactly ONE sample per (cell × chapter)
 * block — the first independent sample — is admitted to the balanced audit
 * subset, so every cell and every chapter stratum receives equal backup
 * coverage. Sample indexes are 1-based within each block (schedule.ts), so the
 * first sample is index 1.
 */
export const AUDIT_SUBSET_SAMPLE_INDEX = 1 as const;

/** A stable judge reference from a flat panel entry. `profileId` is the frozen
 *  identity "<model>@<effort>"; the candidate's authoring model never selects
 *  or influences its judge. */
function judgeRef(judge: ExperimentSpecV1["judgePanel"][number]): RoleJudgeRefV1 {
  return { profileId: `${judge.model}@${judge.effort}`, model: judge.model, effort: judge.effort };
}

/**
 * Map the sealed experiment's flat judge panel onto the fixed role slots. The
 * primary of every role is `panel[0]`; the backup / adjudicator is the next
 * distinct panel member (`panel[1]`) when the panel carries one, else `panel[0]`.
 * The quiz checker is a deterministic code path, not a model profile.
 *
 * The result is a pure function of `spec` — the `record` argument is accepted to
 * satisfy the frozen cross-WP signature (AssignFixedRolesFn) but NEVER influences
 * the assignment. That is the anti-rotation invariant: no execution-order,
 * cell-id, sample-index, or candidate-model term reaches the primary selection.
 */
export const assignFixedRoles: AssignFixedRolesFn = (
  spec: ExperimentSpecV1,
  _record: MigrationSampleRecordV1,
): FixedRoleAssignmentV1 => {
  const panel = spec.judgePanel;
  if (panel.length === 0) {
    throw new MigrationGuardError(
      `experiment ${spec.experimentId} has an empty judge panel — cannot assign a fixed primary`,
    );
  }
  const primary = judgeRef(panel[0]);
  const backup = judgeRef(panel[panel.length > 1 ? 1 : 0]);
  return {
    schema: FIXED_ROLE_ASSIGNMENT_SCHEMA,
    readerPrimary: primary,
    readerBackup: backup,
    sourcePrimary: primary,
    sourceAdjudicator: backup,
    quizChecker: { deterministic: true, checkerVersion: QUIZ_DETERMINISTIC_CHECKER_VERSION },
    quizAdjudicator: primary,
  };
};

/**
 * Whether a committed sample belongs to the frozen balanced audit subset that
 * receives a second (backup / adjudicator) read. Membership is a deterministic
 * function of the sample's frozen schedule coordinate — the designated audit
 * sample index of each (cell × chapter) block — and is INDEPENDENT of the
 * execution order, the candidate's authoring model, and the review output. A
 * backup is therefore never chosen after seeing a candidate's result, and every
 * cell is audited equally (one designated sample per cell × chapter).
 *
 * `spec` is accepted to satisfy the fixed cross-WP shape; the subset boundary is
 * a pure property of the sample's frozen coordinate, not of the panel or output.
 */
export function isInFrozenAuditSubset(
  _spec: ExperimentSpecV1,
  record: MigrationSampleRecordV1,
): boolean {
  return record.sampleIndex === AUDIT_SUBSET_SAMPLE_INDEX;
}
