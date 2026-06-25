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

/**
 * Reconstruct the `quizAttemptPk` for a book+chapter from a `BOOK_USER_QUIZ_STATE`
 * sort key (`QUIZSTATE#<bookId>#<paddedChapter>`, see `quizStateSk`).
 *
 * Quiz-ATTEMPT rows do NOT live under the user partition — they sit in their own
 * partition keyed `QUIZATTEMPT#<userId>#<bookId>#<chapter>` (`quizAttemptPk`), so
 * a `begins_with(SK, …)` sweep of the user partition (which clears QUIZSTATE#/LOOP#)
 * cannot reach them. The submit route writes a quiz-state row alongside every
 * recorded attempt, so the quiz-state SKs the reset already queries enumerate
 * exactly the chapters that have an attempt partition. We rebuild the attempt PK
 * from each one to delete those partitions during a reset (otherwise
 * `buildQuizStateFromAttempts` reconstructs a stale `passed:true` from the
 * surviving attempts and the reader stays locked).
 *
 * Greedy bookId capture (`(.+)#(\d+)$`) mirrors `quizAttemptPksFromUserItems` in
 * account-erasure.ts so a bookId that itself contains "#" still reconstructs the
 * exact PK the attempts were written under. Returns `null` for a non-quiz-state SK.
 */
export function quizAttemptPkFromQuizStateSk(
  userId: string,
  quizStateSkValue: string
): string | null {
  const match = /^QUIZSTATE#(.+)#(\d+)$/.exec(quizStateSkValue);
  if (!match) return null;
  const bookId = match[1];
  const chapter = Number(match[2]);
  if (!bookId || !Number.isFinite(chapter)) return null;
  return quizAttemptPk(userId, bookId, chapter);
}

export function quizStateSk(bookId: string, chapterNumber: number): string {
  return `QUIZSTATE#${bookId}#${padChapterNumber(chapterNumber)}`;
}

/**
 * SK prefix matching EVERY per-chapter quiz-state row for one book under a user
 * partition (`begins_with(SK, …)`). Used by the per-book progress reset to
 * sweep stale `BOOK_USER_QUIZ_STATE` rows. Must stay byte-identical to the
 * `quizStateSk` prefix up to (and including) the trailing `#` so it can't match
 * a sibling book whose id is a prefix of this one.
 */
export function quizStateSkPrefix(bookId: string): string {
  return `QUIZSTATE#${bookId}#`;
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

/**
 * SK prefix matching EVERY per-chapter learning-loop row for one book under a
 * user partition (`begins_with(SK, …)`). Used by the per-book progress reset to
 * sweep stale `BOOK_USER_LOOP` rows alongside the quiz-state rows. Must stay
 * byte-identical to the `loopSk` prefix up to (and including) the trailing `#`.
 */
export function loopSkPrefix(bookId: string): string {
  return `LOOP#${bookId}#`;
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

/**
 * SK for a user's single ACTIVE reading partner. A FIXED constant (not keyed by
 * partnerId) so each user can hold at most one active-pair item: the accept Put
 * guards on `attribute_not_exists(SK)`, which atomically rejects a second active
 * partner regardless of who it is with (the H6 singleton invariant). Replaces the
 * old partner-keyed `PAIR#<partnerId>` SK — that scheme allowed N concurrent
 * active partners and, once soft-deleted, permanently blocked re-pairing the same
 * two users (the H7 bug). No prod data used the old scheme at the time of change.
 */
export function pairActiveSk(): string {
  return "PAIR#ACTIVE";
}

/**
 * SK for an immutable ended-pair history row. Keyed by (partnerId, endedAt) so
 * dissolving and re-forming a pair leaves a distinct audit row each time and none
 * of them occupy `PAIR#ACTIVE` (which must stay free for re-pairing). Lives in the
 * user's own partition so the account-erasure partition sweep reaches it.
 */
export function pairHistorySk(partnerId: string, endedAtIso: string): string {
  return `PAIRHISTORY#${partnerId}#${endedAtIso}`;
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

// ── Erasure reverse-pointers (#4) ────────────────────────────────────────────
//
// Some records are written OUTSIDE the user's own partition and keyed by
// something other than userId (risk events by device/network fingerprint;
// referral & pair invites by code), so an erasure that only sweeps
// `bookUserPk(userId)` can't reach them and there's no userId GSI to find them.
//
// Fix WITHOUT a GSI (forward-only): at write time we ALSO write a tiny
// reverse-pointer item INTO the user's own partition that carries exactly the
// fields needed to reconstruct the external target key byte-for-byte. The
// existing partition sweep then deletes both the pointer and (after
// reconstruction) the target. SKs embed the reconstruction inputs verbatim so
// account-erasure can rebuild `riskEventPk/Sk`, `referralCodePk`, and
// `pairInvitePk` exactly as they were written.

/**
 * Pointer to one externally-keyed risk/fraud event. Embeds (scope, fingerprint,
 * createdAt, eventType) — every input `riskEventPk`/`riskEventSk` need (userId
 * is the partition owner). A user can produce up to 3 risk rows per signal
 * (device/network/network_ua) sharing createdAt+eventType, so scope+fingerprint
 * disambiguate. The createdAt ISO can contain ':' which is SK-safe.
 */
export function riskEventPointerSk(
  scope: string,
  fingerprint: string,
  createdAt: string,
  eventType: string,
): string {
  return `RISKPTR#${scope.toUpperCase()}#${fingerprint}#${createdAt}#${eventType.toUpperCase()}`;
}

/** Pointer to one referral-code reverse-index item, by the (uppercased) code. */
export function referralCodePointerSk(inviteCode: string): string {
  return `REFCODEPTR#${inviteCode.toUpperCase()}`;
}

/** Pointer to one pair-invite reverse-index item, by the (uppercased) code. */
export function pairInvitePointerSk(inviteCode: string): string {
  return `PAIRINVITEPTR#${inviteCode.toUpperCase()}`;
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

/**
 * SK for a permanent erasure-audit row. The second segment is an HMAC/SHA-256
 * hash of the erased user's sub (NOT the raw sub) so the audit proves an erasure
 * occurred without retaining a durable plaintext identifier for the erased
 * subject (#4b). The hash is deterministic, so an operator holding a sub can
 * still locate "was THIS sub erased?" without the table leaking subs.
 */
export function erasureLogSk(erasedAtIso: string, subjectHash: string): string {
  return `${erasedAtIso}#${subjectHash}`;
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

// ── Data retention / DynamoDB TTL (#16) ───────────────────────────────────────
//
// DynamoDB's TTL attribute MUST be a Number holding the expiry as epoch SECONDS
// (NOT milliseconds). A row is eligible for deletion once that value is in the
// past; the actual delete is asynchronous and can lag by up to ~48h, so TTL is a
// best-effort floor on lifetime, never a precise/secure delete. We stamp it only
// on HIGH-VOLUME, NON-compliance record classes; durable finance/fraud/legal
// records carry NO ttl (see retentionPolicyFor + docs/DATA-RETENTION.md).

/** ~30.4 days per month → days for a month-denominated retention period. */
const DAYS_PER_MONTH = 365 / 12;

/** Default retention for high-volume append-only classes (analytics/ops/share). */
export const RETENTION_DAYS_18_MONTHS = Math.round(18 * DAYS_PER_MONTH);

/**
 * Compute a DynamoDB TTL value: the epoch-SECONDS instant `retentionDays` from
 * `nowMs` (default: now). Pure and dependency-free so it can be unit tested and
 * reused by any writer. Returns whole seconds (DynamoDB ignores sub-second
 * precision); never returns milliseconds.
 */
export function ttlEpochSeconds(retentionDays: number, nowMs: number = Date.now()): number {
  return Math.floor(nowMs / 1000) + Math.round(retentionDays * 86400);
}

/**
 * Retention classification for the #16-managed record classes — the tested
 * guard that keeps the durable-vs-event decision honest.
 *
 * `true`  → high-volume / append-only telemetry → #16 stamps `ttl` at write
 *           time from `retentionDays`, so it ages out.
 * `false` → durable / legal / fraud / compliance → MUST NEVER carry a `ttl`
 *           (a stray ttl would silently delete finance/fraud/audit history).
 *
 * SCOPE: this governs the #16 durable-vs-event classes only. Short-lived
 * OPERATIONAL keys (rate-limit counters like BOOK_EXPORT_COUNT, dedup markers,
 * AI answer caches, pair invites) set their OWN short ttl directly at their
 * writer and are intentionally NOT enumerated here — they are neither the
 * high-volume telemetry this stamps nor compliance records, so they hit the
 * fail-safe default below. A `{ttl:false}` from this table therefore means
 * "not stamped by #16", NOT "guaranteed to live forever". The keys.retention
 * test pins the compliance classes so a future writer cannot silently flip one
 * to "expiring".
 */
export function retentionPolicyFor(
  entity: string,
): { ttl: boolean; retentionDays?: number; reason: string } {
  switch (entity) {
    // ── High-volume, append-only EVENT classes → TTL'd ──────────────────────
    case "BOOK_ANALYTICS_EVENT":
      return {
        ttl: true,
        retentionDays: RETENTION_DAYS_18_MONTHS,
        reason: "append-only analytics event stream; unbounded growth",
      };
    case "BOOK_OPS_FAILURE":
      return {
        ttl: true,
        retentionDays: RETENTION_DAYS_18_MONTHS,
        reason: "operational-failure log; high-volume, no compliance value once resolved",
      };
    case "BOOK_USER_SHARE_EVENT":
      return {
        ttl: true,
        retentionDays: RETENTION_DAYS_18_MONTHS,
        reason: "share-card event stream; high-volume engagement telemetry",
      };

    // ── Durable / legal / fraud / compliance classes → NEVER TTL'd ──────────
    case "BOOK_ANALYTICS_SNAPSHOT":
      return { ttl: false, reason: "durable per-user analytics snapshot (current state, not an event)" };
    case "BOOK_BILLING_EVENT":
      return { ttl: false, reason: "retained — legal/tax (refunds, disputes, finance reports)" };
    case "BOOK_RISK_EVENT":
      return { ttl: false, reason: "retained — fraud/abuse investigation" };
    case "BOOK_ACCOUNT_STATUS_CHANGE":
      return { ttl: false, reason: "retained — immutable account-lifecycle audit trail" };
    case "BOOK_ERASURE_LOG":
      return { ttl: false, reason: "retained — permanent GDPR erasure audit (proves an erasure occurred)" };
    case "BOOK_STRIPE_WEBHOOK_EVENT":
      // The webhook idempotency marker owns its OWN ttl lifecycle in #10
      // (PROCESSING leases carry a ttl; the DONE flip REMOVEs it so DONE markers
      // are retained forever). Retention (#16) must never stamp/alter it.
      return { ttl: false, reason: "owned by #10 webhook-claim lease; do not stamp here" };

    default:
      // Unknown class → NO ttl from #16 (fail-safe — never silently expire an
      // entity nobody has classified here). NOTE: this does NOT assert the class
      // is durable-forever — a short-lived operational key (e.g. BOOK_EXPORT_COUNT,
      // dedup markers, the ask cache) may still carry its OWN ttl set at its
      // writer; #16 simply doesn't govern those. Add a case above to bring a
      // class under #16 management.
      return { ttl: false, reason: "not managed by #16 retention (durable, or sets its own ttl at its writer)" };
  }
}
