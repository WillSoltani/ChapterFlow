import { test } from "node:test";
import assert from "node:assert/strict";

import {
  COMMITMENT_FOLLOW_THROUGH_DAILY_CAP,
  commitmentAwardLimitSk,
  commitmentAwardSourceId,
  isCommitmentDue,
  precheckCommitmentAward,
} from "./commitment-award-core";

const FOLLOW_UP = "2026-11-15T10:00:00.000Z";
const AFTER = Date.parse("2026-11-15T10:00:01.000Z");
const BEFORE = Date.parse("2026-11-15T09:59:59.000Z");

function base() {
  return {
    followUpDate: FOLLOW_UP,
    nowMs: AFTER,
    chapterNumber: 4,
    completedChapters: [1, 2, 3, 4],
    alreadyAwardedForChapter: false,
  };
}

test("the award key is per book chapter, not per commitment", () => {
  assert.equal(commitmentAwardSourceId("atomic-habits", 4), "atomic-habits:4");
  assert.equal(
    commitmentAwardSourceId("atomic-habits", 4),
    commitmentAwardSourceId("atomic-habits", 4)
  );
});

test("the daily counter key is bucketed by day", () => {
  assert.equal(commitmentAwardLimitSk("2026-11-12"), "COMMITMENT_IP_LIMIT#2026-11-12");
});

test("a conservative daily cap is set", () => {
  assert.ok(COMMITMENT_FOLLOW_THROUGH_DAILY_CAP >= 1 && COMMITMENT_FOLLOW_THROUGH_DAILY_CAP <= 3);
});

test("no award before the follow-up date", () => {
  assert.equal(isCommitmentDue(FOLLOW_UP, BEFORE), false);
  assert.equal(precheckCommitmentAward({ ...base(), nowMs: BEFORE }), "not_due");
});

test("award once the follow-up date has passed", () => {
  assert.equal(isCommitmentDue(FOLLOW_UP, AFTER), true);
  assert.equal(precheckCommitmentAward(base()), null);
});

test("an unparseable follow-up date is never due", () => {
  assert.equal(precheckCommitmentAward({ ...base(), followUpDate: "nope" }), "not_due");
});

test("no award for a chapter the reader has not completed", () => {
  assert.equal(
    precheckCommitmentAward({ ...base(), completedChapters: [1, 2, 3] }),
    "chapter_not_completed"
  );
  assert.equal(
    precheckCommitmentAward({ ...base(), completedChapters: null }),
    "chapter_not_completed"
  );
});

test("no second award for the same book chapter", () => {
  assert.equal(
    precheckCommitmentAward({ ...base(), alreadyAwardedForChapter: true }),
    "already_awarded"
  );
});
