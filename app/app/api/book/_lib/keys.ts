import { createHash } from "node:crypto";

export function nowIso(): string {
  return new Date().toISOString();
}

export function padVersion(version: number): string {
  return String(Math.max(1, Math.floor(version))).padStart(6, "0");
}

export function padChapterNumber(chapterNumber: number): string {
  return String(Math.max(0, Math.floor(chapterNumber))).padStart(4, "0");
}

export function catalogPk(): string {
  return "BOOKCATALOG";
}

export function catalogSk(bookId: string): string {
  return `BOOK#${bookId}`;
}

export function bookPk(bookId: string): string {
  return `BOOK#${bookId}`;
}

export function bookMetaSk(): string {
  return "META";
}

export function bookVersionSk(version: number): string {
  return `VERSION#${padVersion(version)}`;
}

export function ingestJobPk(jobId: string): string {
  return `BOOKINGEST#${jobId}`;
}

export function ingestJobSk(): string {
  return "JOB";
}

export function bookUserPk(userId: string): string {
  return `BOOKUSER#${userId}`;
}

export function entitlementSk(): string {
  return "ENTITLEMENT";
}

export function progressSk(bookId: string): string {
  return `PROGRESS#${bookId}`;
}

export function profileSk(): string {
  return "PROFILE";
}

export function settingsSk(): string {
  return "SETTINGS";
}

export function riskEventPk(scope: string, fingerprint: string): string {
  return `BOOKRISK#${scope.toUpperCase()}#${fingerprint}`;
}

export function riskEventSk(timestampIso: string, eventType: string, userId: string): string {
  return `EVENT#${timestampIso}#${eventType.toUpperCase()}#${userId}`;
}

export function savedBookSk(bookId: string): string {
  return `SAVED#${bookId}`;
}

export function bookStateSk(bookId: string): string {
  return `BOOKSTATE#${bookId}`;
}

export function chapterStateSk(bookId: string, chapterNumber: number): string {
  return `CHAPTERSTATE#${bookId}#${padChapterNumber(chapterNumber)}`;
}

export function scenarioSubmissionSk(
  bookId: string,
  chapterNumber: number,
  submissionId: string
): string {
  return `SCENARIO#${bookId}#${padChapterNumber(chapterNumber)}#${submissionId}`;
}

export function scenarioModerationPk(status: "PENDING"): string {
  return `BOOKSCENARIO#${status}`;
}

export function scenarioModerationSk(createdAt: string, submissionId: string): string {
  return `${createdAt}#${submissionId}`;
}

export function scenarioLookupPk(submissionId: string): string {
  return `BOOKSCENARIO#LOOKUP#${submissionId}`;
}

export function scenarioLookupSk(): string {
  return "META";
}

export function approvedScenarioPk(bookId: string, chapterNumber: number): string {
  return `BOOKSCENARIO#APPROVED#${bookId}#${padChapterNumber(chapterNumber)}`;
}

export function approvedScenarioSk(createdAt: string, submissionId: string): string {
  return `${createdAt}#${submissionId}`;
}

export function engagementSk(): string {
  return "ENGAGEMENT";
}

export function flowPointsLedgerSk(createdAt: string, transactionId: string): string {
  return `FLOWPOINTS#${createdAt}#${transactionId}`;
}

export function flowPointsGrantSk(sourceType: string, sourceId: string): string {
  return `POINTSGRANT#${sourceType}#${sourceId}`;
}

export function rewardRedemptionSk(createdAt: string, redemptionId: string): string {
  return `REDEMPTION#${createdAt}#${redemptionId}`;
}

export function rewardClaimSk(rewardId: string): string {
  return `REWARDCLAIM#${rewardId}`;
}

export function referralProfileSk(): string {
  return "REFERRAL";
}

export function referralClaimSk(): string {
  return "REFERRALCLAIM";
}

export function referralCodePk(inviteCode: string): string {
  return `BOOKREFERRAL#CODE#${inviteCode.toUpperCase()}`;
}

export function referralCodeSk(): string {
  return "META";
}

export function readingDaySk(dayKey: string): string {
  return `READINGDAY#${dayKey}`;
}

export function badgeAwardSk(badgeId: string): string {
  return `BADGE#${badgeId}`;
}

export function quizAttemptPk(userId: string, bookId: string, chapterNumber: number): string {
  return `QUIZATTEMPT#${userId}#${bookId}#${padChapterNumber(chapterNumber)}`;
}

export function quizAttemptSk(timestampIso: string): string {
  return timestampIso;
}

export function quizStateSk(bookId: string, chapterNumber: number): string {
  return `QUIZSTATE#${bookId}#${padChapterNumber(chapterNumber)}`;
}

export function quizScopeKey(bookId: string, chapterNumber: number): string {
  return `QUIZ#${bookId}#${padChapterNumber(chapterNumber)}`;
}

export function webhookPk(): string {
  return "BOOKBILLING#WEBHOOK";
}

export function webhookSk(eventId: string): string {
  return `EVENT#${eventId}`;
}

/** Shared PK for durable billing events (refunds, disputes) surfaced in admin finance reports. */
export function billingEventPk(): string {
  return "BOOKBILLING#EVENTS";
}

/**
 * SK for a billing event. Embeds the kind, the Stripe object's created
 * timestamp (so a Query sorts chronologically within a kind), and the Stripe
 * object id (so webhook redelivery overwrites the same item — idempotent).
 */
export function billingEventSk(
  kind: "REFUND" | "DISPUTE",
  createdAtIso: string,
  id: string
): string {
  return `${kind}#${createdAtIso}#${id}`;
}

/**
 * Per-(customer, trial_end) dedup marker for the transactional "trial ends soon"
 * email. A conditional Put on this key gates the send so a webhook redelivery of
 * customer.subscription.trial_will_end cannot re-send the same notice.
 */
export function trialEndingEmailPk(customerId: string): string {
  return `BOOKBILLING#TRIALEMAIL#${customerId}`;
}

export function trialEndingEmailSk(trialEndUnix: number): string {
  return `SENT#${trialEndUnix}`;
}

export function stripeCustomerPk(customerId: string): string {
  return `BOOKBILLING#CUSTOMER#${customerId}`;
}

export function stripeCustomerSk(): string {
  return "USER";
}

/** PK for a license key record. Code is stored uppercase for case-insensitive lookups. */
export function licenseKeyPk(code: string): string {
  return `BOOKLICENSE#KEY#${code.toUpperCase()}`;
}

export function licenseKeySk(): string {
  return "META";
}

/** Shared PK for querying all license keys. Each key also writes an index item here. */
export function licenseIndexPk(): string {
  return "BOOKLICENSE#KEYS";
}

/** SK for a license key index entry under the shared BOOKLICENSE#KEYS partition. */
export function licenseIndexSk(code: string): string {
  return `CODE#${code.toUpperCase()}`;
}

// ── Insight Points System keys (§10.1) ──────────────────────────────────────

export function accountStatusSk(): string {
  return "ACCOUNT_STATUS";
}

export function streakSk(): string {
  return "STREAK";
}

export function tierSk(): string {
  return "TIER";
}

export function achievementSk(achievementId: string): string {
  return `ACHIEVEMENT#${achievementId}`;
}

export function loopSk(bookId: string, chapterNumber: number): string {
  return `LOOP#${bookId}#${padChapterNumber(chapterNumber)}`;
}

export function inventorySk(itemType: string, itemId: string): string {
  return `INVENTORY#${itemType}#${itemId}`;
}

// ── Device token keys ──────────────────────────────────────────────────────

export function deviceTokenSk(endpoint: string): string {
  // Hash the FULL endpoint (not just the trailing 32 chars) so two distinct
  // push endpoints can never collide onto the same SK and clobber each other's
  // device row. register + unregister both call this, so they stay aligned.
  const hash = createHash("sha256").update(endpoint).digest("base64url");
  return `DEVICE#${hash}`;
}

// ── Notification keys ──────────────────────────────────────────────────────

export function notificationSk(createdAt: string, notificationId: string): string {
  return `NOTIF#${createdAt}#${notificationId}`;
}

// ── Daily metrics keys ─────────────────────────────────────────────────────

export function bookMetricsPk(bookId: string): string {
  return `BOOKMETRICS#${bookId}`;
}

export function dailyMetricsSk(dayKey: string): string {
  return `DAY#${dayKey}`;
}

// ── Gift code keys ─────────────────────────────────────────────────────────

export function giftCodePk(): string {
  return "BOOKGIFT#CODES";
}

export function giftCodeSk(code: string): string {
  return `CODE#${code.toUpperCase()}`;
}

// ── Content keys ────────────────────────────────────────────────────────────

export function buildContentPrefix(bookId: string, version: number): string {
  return `book-content/books/${bookId}/v${padVersion(version)}`;
}

export function buildManifestKey(prefix: string): string {
  return `${prefix}/manifest.json`;
}

export function buildBookJsonKey(prefix: string): string {
  return `${prefix}/book.json`;
}

export function buildChapterKey(prefix: string, chapterNumber: number): string {
  return `${prefix}/chapters/${padChapterNumber(chapterNumber)}.json`;
}

export function buildQuizKey(prefix: string, chapterNumber: number): string {
  return `${prefix}/quizzes/${padChapterNumber(chapterNumber)}.json`;
}

export function buildConceptGraphKey(prefix: string): string {
  return `${prefix}/concept-graph.json`;
}

// ── FSRS Spaced Repetition keys ───────────────────────────────────────────────

export function fsrsCardSk(cardId: string): string {
  return `FSRS#CARD#${cardId}`;
}

export function fsrsReviewLogSk(reviewedAt: string, reviewId: string): string {
  return `FSRS#LOG#${reviewedAt}#${reviewId}`;
}

// ── Adaptive Depth Routing keys ───────────────────────────────────────────────

export function depthModelSk(bookId: string): string {
  return `DEPTHMODEL#${bookId}`;
}

// ── Commitment keys (Feature #3) ─────────────────────────────────────────────

export function commitmentSk(commitmentId: string): string {
  return `COMMITMENT#${commitmentId}`;
}

// ── AI Reflection Feedback keys (Feature #2) ─────────────────────────────────

export function reflectionFeedbackSk(
  bookId: string,
  chapterNumber: number,
  exampleId: string,
): string {
  return `FEEDBACK#${bookId}#${padChapterNumber(chapterNumber)}#${exampleId}`;
}

export function feedbackLimitSk(date: string, exampleId: string): string {
  return `FEEDBACK_LIMIT#${date}#${exampleId}`;
}

// ── Journey keys (Feature #6) ────────────────────────────────────────────────

export function journeySk(journeyId: string): string {
  return `JOURNEY#${journeyId}`;
}

// ── Reading Partner keys (Feature #7) ────────────────────────────────────────

export function pairSk(partnerId: string): string {
  return `PAIR#${partnerId}`;
}

export function pairInvitePk(inviteCode: string): string {
  return `BOOKPAIR#INVITE#${inviteCode.toUpperCase()}`;
}

export function pairInviteSk(): string {
  return "META";
}

export function pairNudgeSk(partnerId: string, dayKey: string): string {
  return `NUDGE#${partnerId}#${dayKey}`;
}

export function pairBonusSk(partnerId: string, dayKey: string): string {
  return `PAIRBONUS#${partnerId}#${dayKey}`;
}

// ── Share Card keys (Feature #9) ─────────────────────────────────────────────

export function shareEventSk(createdAt: string, shareId: string): string {
  return `SHARE#${createdAt}#${shareId}`;
}

// ── Notebook Tag keys (Feature #14) ──────────────────────────────────────────

export function notebookTagSk(bookId: string, chapterNumber: number): string {
  return `NOTEBOOK_TAGS#${bookId}#${padChapterNumber(chapterNumber)}`;
}

// ── AI Chat keys (Feature #16) ───────────────────────────────────────────────

export function aiQuestionCountSk(date: string): string {
  return `AI_QUESTIONS#${date}`;
}

export function aiCachedAnswerPk(bookId: string): string {
  return `BOOK#${bookId}`;
}

export function aiCachedAnswerSk(questionHash: string): string {
  return `AI_CACHE#${questionHash}`;
}

// ── Per-user daily rate-limit counters (#8) ──────────────────────────────────

/** Daily counter SK for the GDPR data-export endpoint. `date` = `YYYY-MM-DD`. */
export function exportLimitSk(date: string): string {
  return `EXPORT_LIMIT#${date}`;
}

// ── Seasonal Event keys (Feature #17) ────────────────────────────────────────

export function eventParticipationSk(eventId: string): string {
  return `EVENT#${eventId}`;
}

export function eventDefinitionPk(): string {
  return "BOOKEVENT#DEFS";
}

export function eventDefinitionSk(eventId: string): string {
  return `EVENT#${eventId}`;
}

export function eventStatsPk(eventId: string): string {
  return `BOOKEVENT#STATS#${eventId}`;
}

export function eventStatsSk(): string {
  return "META";
}

// ── Nudge dedup keys (Feature #1) ────────────────────────────────────────────

export function nudgeSentSk(nudgeType: string, dateKey: string): string {
  return `NUDGE_SENT#${nudgeType}#${dateKey}`;
}

// ── Operational failure log keys ─────────────────────────────────────────────

/**
 * Shared PK for the operational-failure log (e.g. a Stripe cancellation that
 * failed during account delete/deactivate). Surfaced in the admin Ops
 * dashboard so an operator can follow up instead of the failure being swallowed.
 */
export function opsFailurePk(): string {
  return "BOOKOPSFAILURE";
}

/** SK embeds the timestamp (newest-first Query) and a uuid (uniqueness). */
export function opsFailureSk(createdAtIso: string, id: string): string {
  return `${createdAtIso}#${id}`;
}

/**
 * Shared PK for the permanent erasure audit log. Erasure deletes the user
 * partition (including its own status-change audit rows), so the record of an
 * erasure having happened is written here, OUTSIDE the user partition.
 */
export function erasureLogPk(): string {
  return "BOOKERASURE#LOG";
}

export function erasureLogSk(erasedAtIso: string, userId: string): string {
  return `${erasedAtIso}#${userId}`;
}

// ── Account-status audit log keys ────────────────────────────────────────────

/**
 * SK for an append-only account-status change record under the user partition.
 * The current status still lives in the single `ACCOUNT_STATUS` item
 * (`accountStatusSk`); these rows are the immutable who/when/why audit trail.
 */
export function accountStatusChangeSk(changedAtIso: string): string {
  return `ACCOUNTSTATUSCHANGE#${changedAtIso}`;
}

// ── Email suppression keys (bounce/complaint deliverability) ──────────────────

/**
 * PK for an email-suppression record, keyed by the lowercased address so a
 * send-time check is a single GetItem. Written by the SES bounce/complaint
 * handler Lambda; read before commercial sends. NOTE: the same key format is
 * replicated in `infra/lambda/lib/email-compliance.ts` and the suppression
 * handler (separate build roots) — keep them in sync.
 */
export function emailSuppressionPk(email: string): string {
  return `BOOKSUPPRESS#${email.trim().toLowerCase()}`;
}

export function emailSuppressionSk(): string {
  return "SUPPRESSION";
}
