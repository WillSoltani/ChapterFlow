# ChapterFlow Pre-Launch Audit — Status vs `origin/main` (2026-06-25)

Re-validated the **66 remaining** findings (lane items 3+) against `origin/main` (each checked once; every "fixed" verdict adversarially re-confirmed). Combined with rounds 1–2 (items 1–2 of each lane), this accounts for **all 82** audit findings.

## Cumulative picture (all 82)

| Outcome | Count |
|---|---|
| Fixed by our PRs (rounds 1–2, merged #299–#309) | 10 |
| Already fixed on `main` (discovered: A1,C1,F1,G1,E2,H2 + this sweep's 8) | 14 |
| **Partial** (residual remains) | 1 |
| **Still LIVE — remaining work** | **57** |
| **Total** | **82** |

Remaining work = **57 live + 1 partial = 58**, of which **5 T1 + 10 T2 = 15 are priority**; the other 43 are T3/T4 hardening.

---

## ✅ Newly confirmed FIXED on main this sweep (8) — skip

- **C5** [T2] Gift-code claim unconditionally overwrites currentPeriodEnd, shortening a longer flow_points/gift PRO window
  - ↳ Gift-claim SET is now atomically guarded by the shared grantUpgradeConditionExpression; the future currentPeriodEnd < :expires clause makes the longer-window overwrite fail with 409 instead of shortening it.
- **F6** [T2] SES suppression handler swallows DynamoDB write failures (no re-throw, no DLQ, no alarm) — bounce/complaint suppressions can be permanently lost
  - ↳ All three gaps closed: handler re-throws (SNS async retry → DLQ on exhaustion), 14-day DLQ wired, error alarm pages ops; bundled dist matches source so the deployed artifact is not stale.
- **G5** [T3] WorkspacePage BookRow renders userBooks and recommendedProBooks in one container with colliding keys
  - ↳ Both maps still share one flex container, but userBooks and recommendedProBooks are now provably id-disjoint (exclusion seeded from seenUserBookIds) and each internally deduped, using the same untransformed snap.book.id as both filter key and React key — colliding keys cannot occur.
- **H20** [T3] markNotificationRead is an unconditional UpdateItem on a fully client-controlled SK → stub-item injection
  - ↳ Repo-layer ConditionExpression(attribute_exists PK AND SK) prevents the upsert at both call sites (route still passes client createdAt/notificationId, but the guard rejects non-existent SKs); SK is hard-prefixed NOTIF# and PK is server-derived from user.sub, so no cross-item corruption or third unguarded path exists.
- **H22** [T3] recordEventChapter read-modify-write has no condition guard, allowing duplicate completion side-effects
  - ↳ Lost-update race closed by optimistic updatedAt= condition + retry/dedup; completion side-effects gated on the single successful conditional write, so no duplicate counter/IP/badge.
- **C7** [T4] License expiry computed with Date.setMonth(getMonth()+validMonths) overflows on end-of-month dates, granting a slightly different window than intended
  - ↳ Clamp captures pre-shift day and rolls overflow back via setDate(0); exhaustive 4-year x {1,3,6,12}mo sweep (5840 cases, DST tz) = 0 failures. Jan 31+1mo now yields Feb 28, May 31+1mo yields Jun 30. Described overflow cannot occur.
- **C8** [T4] Non-numeric ?limit on GET /me/reviews yields NaN and getDueCards' slice(0, NaN) returns zero due cards
  - ↳ Number.isFinite(parsedLimit) && parsedLimit > 0 coerces every non-numeric/empty/negative/zero ?limit to 20, so NaN can never reach Math.min or getDueCards' slice(0, NaN); all described inputs (?limit=abc, ?limit=, ?limit=-5) fall back to 20.
- **G7** [T4] Completion-route streak/points response is parsed then discarded; UnlockCelebration never receives currentStreak, contradicting its own contract
  - ↳ The described defect (UnlockCelebration never receives currentStreak / prop silently unused, contradicting its contract) cannot occur: the prop is now explicitly passed (currentStreak={1}) and consumed to render the Day-streak stat; the still-discarded resp.json() body is harmless because the celebration paints deterministic amounts before the POST and /dashboard reads persisted state, and the previously self-contradicting comment is rewritten to match.

## 🟡 PARTIAL (1)

- **F5** [T2] Reminder/nudge cron has no error or duration alarm and no timeout headroom; serial per-user sub-handlers can blow the 5-min timeout and silently drop users
  - current: `infra/lambda/lib/weekly-digest.ts:41 (serial loop); infra/lib/chapterflow-backend-stack.ts:434 (timeout=5min), :510 + :526 (the two new alarms)`
  - ↳ Both alarms + DLQ landed and the main reminder pass was parallelized (H16), but the exact residual remains: 5-min timeout unchanged and all three nudge sub-handlers (Sunday digest ~5 serial round-trips/user) still iterate every user serially, so they can still blow the timeout — the alarms now make a drop visible rather than silent.

## 🔴 STILL LIVE (57) — grouped by tier

### T1 — 5

- **A5** — Reset Progress permanently locks the reader at chapter 1 (stale passed quiz state blocks re-unlock)
  - current: `app/app/api/book/me/quiz/[bookId]/[chapterNumber]/submit/route.ts:267 (short-circuit); app/app/api/book/me/books/[bookId]/state/reset/route.ts (reset never deletes BOOK_USER_QUIZ_STATE)`
  - ↳ Defect fully live: reset relocks to ch.1 but leaves stale passed=true BOOK_USER_QUIZ_STATE; re-attempting ch.1 short-circuits at submit/route.ts:267 and never calls buildProgressAfterQuizPass, so unlockedThroughChapterNumber can never rise again — reader permanently stuck at chapter 1.
- **A6** — Unconditional full-object Put of BOOK_PROGRESS on quiz pass races with concurrent progress writes and loses completed chapters / unlocks
  - current: `app/app/api/book/_lib/repo.ts:1271-1283 (recordQuizAttemptOutcome nextProgress Put) and repo.ts:878-892 (upsertUserProgress)`
  - ↳ Exact defect intact: quiz-pass progress Put and upsertUserProgress are both unconditional full-object Puts of PROGRESS#<bookId> derived from request-start snapshots, so concurrent writes can lose completedChapters/unlocks. The conditional-update fix pattern landed only in repointProgressVersion, not these writers.
- **A7** — ensureUserBookStarted does an unconditional full-item Put of progress, racing with and rolling back quiz-pass unlocks
  - current: `app/app/api/book/_lib/ensure-book-started.ts:265-270 (write) + repo.ts:878-892 (unconditional Put); stale read at ensure-book-started.ts:224`
  - ↳ Exact defect intact: ensureUserBookStarted unconditionally full-item Puts stale progress (gating fields included) via guardless upsertUserProgress; runs first on every quiz submit, so a concurrent request can clobber/roll back another request's quiz-pass unlock.
- **B3** — v21 packages bypass ALL server-side semantic validation at ingestion (adapter docstring is wrong)
  - current: `app/app/api/book/_lib/validate-book-package.ts:1228-1229`
  - ↳ Core defect fully live: v21 (canonical format for all shipped books) still skips parseChapters + enforceSemanticRules at the only ingestion call site. The only change is the incidental 'docstring is wrong' detail — the v21-adapter.ts:308-318 docstring was rewritten to correctly state it does NOT re-run the v13 parser ('That is deliberate'), so the bypass is now documented as intentional rather than contradicted.
- **C3** — Sticky chargeback marker (disputeOpen) blocks only Stripe re-activation; a charged-back user can immediately restore PRO via license, gift code, or flow-points
  - current: `app/app/api/book/_lib/pro-grant-guard-core.ts:44-55 (grantUpgradeConditionExpression), used by license repo.ts:3504, gift claim/route.ts:122, flow-points-repo.ts:737`
  - ↳ Live: after a chargeback (plan=FREE, proSource=null, disputeOpen=true), all three non-Stripe grant paths skip the disputeOpen check via the shared guard, so a charged-back user immediately restores PRO via license, gift code, or flow-points.

### T2 — 10

- **A3** — Book-state read routes use the CURRENT published manifest instead of the user's pinned-version manifest
  - current: `app/app/api/book/me/books/[bookId]/state/route.ts:61 (GET) & :147 (PATCH); app/app/api/book/me/books/[bookId]/state/reset/route.ts:47`
  - ↳ Defect intact: state and state/reset routes map version-pinned progress numbers into chapterIds using the latest published manifest, not the user's pinned manifest, so a catalog advance can diverge the returned state mid-read. The third cited route (scenarios/route.ts) no longer exists at that path on origin/main.
- **A4** — Out-of-range authored correctIndex yields a correctChoiceId no choice can match → permanently-failing question
  - current: `app/app/api/book/_lib/quiz-session.ts:175-180`
  - ↳ Out-of-range authored index passes the only (typeof) guard; findIndex returns -1, so correctChoiceId falls back to a synthetic id absent from choices[], making the question unmatchable and always graded wrong. Unchanged from the original finding.
- **A8** — recordQuizAttemptOutcome treats every TransactionCanceledException as a permanent quiz_state_conflict, silently dropping a passed quiz on a transient throttle/c
  - current: `app/app/api/book/_lib/repo.ts:1293-1306 (function recordQuizAttemptOutcome, defined at :1224; call site app/app/api/book/me/quiz/[bookId]/[chapterNumber]/submit/route.ts:485)`
  - ↳ Defect intact: transient TransactionConflict/Throttling/ProvisionedThroughputExceeded (all surface as TransactionCanceledException) on a passing quiz are mapped to a permanent 409, silently dropping the pass. The transactionCancellationReasons/isTransactionConditionFailedAt discriminators exist in errors.ts and are imported into repo.ts (used at :3534) but are NOT applied in this catch block.
- **B4** — v21 packages bypass the entire v13 validator (range/uniqueness/variant-completeness checks) — only adapter defaults guard them
  - current: `app/app/api/book/_lib/validate-book-package.ts:1228-1229`
  - ↳ Defect live: v21 packages still bypass the entire v13 validator via early return; only the false doc-comment was corrected (v21-adapter.ts:309-318 now admits no re-validation runs), so the claimed bug-shielding remains absent.
- **B5** — Ingest rollback deletes content+version draft but leaves META/CATALOG pointing at the deleted version
  - current: `app/app/api/book/_lib/ingestion.ts:214-232 (helper at repo.ts:456-516)`
  - ↳ Defect intact: META+CATALOG are two non-atomic PUTs and are the last op in the try, but the catch only runs deleteContentPrefix + deleteBookVersion — it never restores META/CATALOG, so a CATALOG-PUT throw (or republish failure) leaves META/CATALOG pointing at a version whose content+VERSION row rollback just deleted.
- **D4** — charge.dispute.created records the event as processed even when user can't be resolved, so the chargeback never revokes access on later redelivery
  - current: `app/app/api/book/billing/webhook/route.ts:501-526 (userId resolve + `if (userId)` guard) and :606 (unconditional `completeStripeWebhookEvent`)`
  - ↳ Core D4 residual is live: a dispute that arrives before the customer→user map propagates (or with a null customer) is marked permanently DONE with no revocation, and the idempotency short-circuit blocks revocation on later redelivery. The new stripe.charges.retrieve only protects against a transient Stripe-API throw, not the null-map case the finding describes.
- **F3** — WAF AWSManagedRulesCommonRuleSet (no rule overrides) will 403 legitimate API POSTs containing XSS-lookalike text (display names, free-text)
  - current: `infra/lib/chapterflow-frontend-stack.ts:737-752 (rule), 862 (webAclId attachment)`
  - ↳ Distribution-level WebACL (webAclId) covers the default serverOrigin behavior that serves all /app/api/*; CommonRuleSet is overrideAction none with zero rule overrides, so Block-mode CrossSiteScripting_BODY/QUERYARGUMENTS + SizeRestrictions_BODY remain fully active on every JSON POST body — exact defect unchanged.
- **F7** — isSkippableSsmError swallows AccessDenied on the legitimate prefixed parameter, caching SSM-only config as permanently missing on an IAM misconfig
  - current: `app/app/api/_lib/server-env.ts:47-55 (isSkippableSsmError), :115-116 (skip without recording lastError), :120-123 (loud-fail never reached), :157 (missingCache poison)`
  - ↳ Defect fully live on origin/main: AccessDenied on the in-scope prefixed parameter is still swallowed without setting lastError, bypassing the `if (SSM_PREFIX) throw` loud-fail and permanently caching the SSM-only var as missing; call sites (env.ts, email-compliance.ts) resolve real config through this path.
- **H6** — acceptPairInvite TOCTOU lets a user end up with multiple active partners
  - current: `app/app/api/book/_lib/pair-repo.ts:117-187 (origin/main)`
  - ↳ TOCTOU intact: the getUserActivePair pre-checks are non-atomic with the TransactWrite, whose only guards are attribute_not_exists on partner-specific PAIR#<partnerId> SKs plus a per-code invite-status guard. With two distinct invite codes, A's two accept transactions (PAIR#B vs PAIR#C, different invites) have no shared conflicting item, so concurrent B+C accepts both commit, leaving the inviter with two active partners. No singleton/fixed-SK pair pointer or lock exists; accept route is a thin wrapper with no extra locking.
- **H7** — deletePair soft-deletes the pair row, permanently blocking the same two users from re-pairing
  - current: `app/app/api/book/_lib/pair-repo.ts:354-380 (deletePair soft-delete) + :153,:170 (accept Put guards), :219 (active-only filter)`
  - ↳ Defect fully intact: deletePair only sets status='ended' (no DeleteCommand/reactivation), and acceptPairInvite's unconditional attribute_not_exists Puts can never overwrite the ended row — two ex-partners are permanently blocked from re-pairing and get a misleading "Invite already used".

### T3 — 21

- **A10** — ensureUserBookStarted can throw 500 progress_init_failed on first book-start due to eventually-consistent read after create
  - current: `app/app/api/book/_lib/ensure-book-started.ts:257-262 (create-then-read-then-throw); app/app/api/book/_lib/repo.ts:980-987 (getUserProgress GetCommand, no ConsistentRead)`
  - ↳ Defect unchanged on origin/main: PutCommand immediately followed by a default eventually-consistent GetCommand (no ConsistentRead) can read null on first book-start and throw 500 progress_init_failed; quiz-submit hits it first.
- **A11** — summarizeProgress fallback heuristic can never report a sequentially-read book as completed
  - current: `app/app/api/book/me/progress/route.ts:23 (call site, no chapterCounts) + app/app/api/book/_lib/repo.ts:2580-2582 (fallback heuristic)`
  - ↳ L45 fix added an optional chapterCounts param for exact completion, but the /me/progress route never passes it, so it falls through to the identical broken heuristic — fix is inert; defect live (repo's own RESIDUALS.md M21/L45 admits this).
- **A9** — Quiz question count for the live catalog is driven by the client-supplied `difficulty`, letting a user choose the smallest set
  - current: `app/app/api/book/me/quiz/[bookId]/[chapterNumber]/submit/route.ts:190,263-264 (also check/route.ts:190-196)`
  - ↳ Live: for strictV12 (entire v21 catalog), quiz question count is still driven by client-supplied body.difficulty with no server-side reconciliation, so a user can send difficulty:"simple" to be graded on only 5 questions instead of 7/10 — exactly the described defect. Only the enum labels changed (easy/hard → simple/deeper) and the old GET quiz/route.ts logic moved into check/route.ts with the same flaw.
- **B8** — updateIngestionJob unconditionally writes bookId/details/errorReportKey = null, wiping a previously-set bookId on the FAILED path
  - current: `app/app/api/book/_lib/repo.ts:642-655 (clobber); FAILED caller app/app/api/book/admin/ingest/run/route.ts:85-89`
  - ↳ Unchanged on origin/main: static SET expression with `params.bookId ?? null` still wipes a previously-set bookId on the FAILED update, which passes no bookId.
- **C4** — FSRS post-lapse stability is not clamped to the prior stability, so pressing 'Again' can schedule a card FURTHER out than before the failure
  - current: `app/app/api/book/_lib/fsrs.ts:179 (def at :56, consumed at :191/:196)`
  - ↳ Defect live and unchanged: no post-lapse stability clamp. Verified with default weights d=1,s=0.3,r=0.1 → S_forget=1.1989 > S_prev=0.3, so pressing 'Again' schedules the card further out than before the failure.
- **C6** — Full license key string is persisted to the analytics table on every redemption attempt, including successful redemptions
  - current: `app/app/api/book/_lib/analytics-repo.ts:1001-1002`
  - ↳ Full license key string is still persisted verbatim into the analytics table for all outcomes including success; no redaction/hashing was added.
- **D3** — Signature-verification errors 'Timestamp outside the tolerance zone' / 'No webhook payload' return HTTP 500, triggering 3 days of Stripe retries + false ops ala
  - current: `app/app/api/book/billing/webhook/route.ts:65-74`
  - ↳ Catch block still gates 400 solely on err.message.includes("signature"); Stripe's 'Timestamp outside the tolerance zone' and 'No webhook payload was provided.' lack that substring, so a replayed/clock-skewed signature-verification failure still bubbles to 500, triggering 3 days of Stripe retries + false ops alarms. (Audit cited Stripe v20.4.1; origin/main now pins ^22.2.1 but the error strings are identical, so unchanged.)
- **E3** — App-side email config silently falls back to dead legacy host while the lambda refuses to send
  - current: `app/app/api/book/_lib/email-compliance.ts:30`
  - ↳ App-side getEmailComplianceConfig still falls back to dead siliconx.ca host and callers gate only on senderEmail/postalAddress (never appBaseUrl), so they send dead unsubscribe/settings links while the lambda refuses — exact described defect intact.
- **F12** — getAppBaseUrl returns a loopback CHAPTERFLOW_APP_BASE_URL verbatim in prod (Stripe success/return URLs point at localhost)
  - current: `app/app/api/book/_lib/env.ts:62 (getAppBaseUrl, function at :57)`
  - ↳ getAppBaseUrl returns CHAPTERFLOW_APP_BASE_URL verbatim with no loopback guard (unlike resolvePublicOrigin), and synth only checks non-empty — a loopback config still flows into Stripe success/return URLs in prod.
- **F13** — resolvePublicOrigin trusts attacker-controllable x-forwarded-host when no base URL is configured; getServerOrigin callers emit it into user-facing URLs
  - current: `app/app/_lib/server-origin.ts:59-65 (resolvePublicOrigin); getServerOrigin :74-81; consumer app/app/api/book/me/pairs/invite/route.ts:25; also app/auth/login/route.ts:44 and app/auth/callback/route.ts:96`
  - ↳ Code on origin/main is byte-identical to the audit branch; the exact x-forwarded-host/host fallthrough when no base URL is configured still exists. F13 itself credited the prod CHAPTERFLOW_APP_BASE_URL mitigation, so its presence is not a fix of the described residual.
- **F4** — Reading-reminder email is gated on channels.email === true but channels is never persisted, so reminder emails are never sent
  - current: `infra/lambda/reading-reminder-cron.ts:196 (gate) → infra/lambda/lib/email-consent.ts:7-13 (helper); never-written side: app/book/hooks/useBookPreferences.ts:200 + app/book/settings/BookSettingsClient.tsx`
  - ↳ Still live: reminder email gated on channels.email===true (now via emailChannelConsented helper), but no UI/default/onboarding ever writes channels.email=true, so reminder emails never send; only the in-app notification fires. Settings route now whitelists "channels" but nothing sends it.
- **F8** — Email body templates interpolate user displayName into HTML without escaping (self-targeted HTML injection)
  - current: `infra/lambda/lib/email-templates/reading-reminder.ts:8`
  - ↳ Unchanged: user displayName flows raw from DynamoDB into htmlBody across all 5 templates; escapeHtml is still footer-only. Self-targeted injection sink exactly as described.
- **F9** — Email-events SNS topic policy allows ses.amazonaws.com Publish with no aws:SourceAccount/SourceArn condition (confused-deputy)
  - current: `infra/lib/chapterflow-backend-stack.ts:554-559`
  - ↳ SES service-principal sns:Publish grant still has no aws:SourceAccount/SourceArn condition — confused-deputy defect unchanged on origin/main.
- **G3** — ContinueLearningCard can build /book/library/{id}/chapter/ with an empty chapter segment
  - current: `components/progress/ContinueLearningCard.tsx:27-32 (resumeChapterId origin app/book/hooks/useBookAnalytics.ts:586-591; passthrough components/progress/ProgressPage.tsx:193)`
  - ↳ Unchanged: resumeChapterId still falls back to "" and getBookHref still interpolates it via encodeURIComponent, yielding /book/library/{id}/chapter/ with a missing chapter segment; no guard added on origin/main.
- **G4** — ProgressPage reads e.plan from /me/entitlements but the route returns a nested {entitlement:{plan}} — isPro is permanently false and Pro users are shown as Free
  - current: `components/progress/ProgressPage.tsx:482-483`
  - ↳ Unchanged on origin/main: ProgressPage reads top-level e.plan but the endpoint nests it under e.entitlement.plan, so isPro is permanently false for all users including PRO subscribers.
- **G6** — inferChapterNumber() parses the first digit run in the chapterId, returning the wrong chapter for the 8 books whose bookId contains a number
  - current: `app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterState.ts:212-220 (function) and :359 (use site); caller app/book/library/[bookId]/chapter/[chapterId]/ChapterReaderClient.tsx:321`
  - ↳ Defect fully live: regex grabs first digit run; caller still passes the async baseChapter?.order (undefined on mount) instead of the synchronously-correct manifest chapterNumber; only a console.warn (already noted by the audit) was added.
- **H15** — Partner nudge daily cap is check-then-write (non-atomic), allowing a duplicate nudge notification
  - current: `app/app/api/book/_lib/pair-repo.ts:398-417 (recordNudgeSent) + :383-396 (canSendNudge); route at app/app/api/book/me/pairs/[partnerId]/nudge/route.ts`
  - ↳ Check-then-write is non-atomic: two concurrent POSTs both pass canSendNudge, both Put the same key unconditionally (no attribute_not_exists guard), and both createNotification → duplicate partner_nudge. Unchanged from the audit; sibling puts at lines 68/78/153/170 use conditions but this one does not.
- **H3** — 10-activation referral milestone never grants the promised 30-day Pro pass to free inviters
  - current: `app/app/api/book/_lib/referral-escalation.ts:226-235 (award) and referral-escalation-core.ts:35-41 (milestone def)`
  - ↳ Defect intact: 10-activation milestone awards 1200 IP unconditionally for both FREE and PRO inviters; proInviterIPAlternative is dead and no 30-day Pro-pass grant exists, so a free inviter never receives the promised Pro pass.
- **H4** — Re-rejecting a previously approved scenario does not reverse the Insight Points already awarded
  - current: `app/app/api/book/admin/scenario-submissions/[submissionId]/route.ts:117-135`
  - ↳ Approved→rejected PATCH deletes the approved-scenario record and flips lookup status but never deducts the previously-awarded existing.pointsAwarded IP; award is gated on approved && !wasApprovedAlready with no symmetric clawback.
- **H5** — Segment filter `lastActiveWithinDays gt` matches never-active users, polluting commercial notification fan-out targeting
  - current: `app/app/api/book/_lib/segment-engine.ts:83`
  - ↳ Offending line `return op === "isEmpty" || op === "gt"` unchanged on origin/main; validator still allows gt; never-active users still match a recently-active filter.
- **H8** — system-mode theme does not re-apply to the DOM when the OS color scheme changes live
  - current: `app/hooks/useThemePreference.ts:43-71`
  - ↳ syncTheme (fired by the prefers-color-scheme change listener) only sets React state and never re-applies the document theme, so the html.dark class / colorScheme / token datasets stay stale on a live OS color-scheme change; the only DOM re-apply path (useBookPreferences) is Reader/Settings-only and itself self-documents this app-wide gap.

### T4 — 21

- **A12** — state PATCH writes an unvalidated client-supplied lastOpenedAt into the canonical BOOK_PROGRESS row
  - current: `app/app/api/book/me/books/[bookId]/state/route.ts:233-234 (read) and 270-273 (canonical BOOK_PROGRESS write)`
  - ↳ Unchanged from the audit: lastOpenedAt is accepted as any client string (only typeof==="string") and written into canonical BOOK_PROGRESS, so a garbage/far-future value persists and feeds the lastOpenedAt!==epoch started-badge clause and recency surfaces.
- **B6** — A malformed library catalog.json makes the entire library listing throw 422 instead of degrading
  - current: `app/app/api/book/_lib/library-catalog.ts:122-129 (rethrow at 128); throw site app/app/api/book/_lib/storage.ts:49`
  - ↳ Catch on origin/main still excludes invalid_json; a malformed/partial catalog.json throws 422 and breaks the entire library listing rather than degrading to an empty presentation index.
- **B7** — Standalone publish swallows search-index errors and can publish a stale/incomplete public search index
  - current: `app/app/api/book/admin/books/[bookId]/versions/[version]/publish/search-index-builder.ts:57-60, 139-142, 147-156; publish/route.ts:36-42`
  - ↳ All four B7 mechanisms persist verbatim: per-book + per-chapter silent `continue` on read failure, unconditional overwrite of the public index with max-age=3600 even when partial, and route try/catch that only console.errors while publish still returns ok. The builder body was rewritten (DynamoDB catalog + manifest keys) to fix a separate stale-path bug, but the error-swallowing defect is unchanged.
- **B9** — v21 adapter synthesizes a time-based packageId when absent, silently defeating ingest idempotency
  - current: `app/app/api/book/_lib/v21-adapter.ts:325 (synthesis) + app/app/api/book/_lib/ingestion.ts:104-115 (idempotency keyed on packageId)`
  - ↳ Both the time-based synthesis (v21-adapter.ts:325) and the packageId-keyed idempotency check (ingestion.ts:104-115) are byte-for-byte the described defect; no fix or guard landed on origin/main.
- **C9** — POST /me/reviews/[cardId] and POST /me/shop call req.json() without try/catch, returning 500 instead of 400 on a malformed/empty body
  - current: `app/app/api/book/me/reviews/[cardId]/route.ts:45 and app/app/api/book/me/shop/route.ts:113`
  - ↳ Defect unchanged on origin/main: both routes call req.json() inline with no try/catch, so an empty/malformed body throws SyntaxError → generic 500 instead of 400; the redeem route's try/catch fallback pattern was not adopted.
- **E4** — No per-user device cap; createNotification push loop fans out over all registered endpoints
  - current: `app/app/api/book/me/devices/register/route.ts:15-50 + app/app/api/book/_lib/notifications-repo.ts:138-160`
  - ↳ Exact defect still live: register route has no per-user device cap and the push branch fans out over all DEVICE# rows unbounded; only the pre-existing isAllowedPushEndpoint SSRF guard (which the finding already discounted) is present.
- **E5** — Suppression check fails open — DynamoDB blip re-enables sends to hard-bounced/complained addresses
  - current: `infra/lambda/lib/email-compliance.ts:62-79 (isEmailSuppressed catch→false, called at :266); app/app/api/book/_lib/repo.ts:1949-1961 (isEmailSuppressed, no try/catch)`
  - ↳ Both replicas unchanged: lambda still catch→false (fails open, re-enabling sends to bounced/complained addresses during a DynamoDB blip), app-side still has no catch (throws) — the exact described defect and asymmetry persist.
- **F10** — Page-guard auto-reactivation write failure fails open silently, leaving status='deactivated'
  - current: `app/_lib/require-dashboard-access.ts:101-116 (write site repo.ts:2814)`
  - ↳ Unchanged: a thrown reactivation Put is caught as non-redirect, logged as account_status_check_error, and swallowed fail-open — page renders while DynamoDB status stays 'deactivated'. The authoritative Put in setAccountStatus is not retried/guarded.
- **F11** — Settings-page isAdmin flag is always false in prod (ADMIN_EMAILS/ADMIN_SUBS never reach the Lambda)
  - current: `app/book/settings/page.tsx:42-45`
  - ↳ Unchanged on origin/main: isAdmin derived from un-injected raw process.env vars, always false in prod (hides the /book/admin link in BookSettingsClient.tsx:1618; not a security hole since real admin auth is Cognito-group-based).
- **H10** — Catalog-count drift guard (d) only scans .tsx and only matches 'books', missing .ts/.md and category claims
  - current: `scripts/ci/scan-style-drift.mjs:51-54 (RE_CATALOG), :106 (isTsx), :195 (gate in guardCatalogCounts)`
  - ↳ All three sub-defects intact: guard still .tsx-only (skips .ts/.md/JSON), RE_CATALOG matches only 'books' (no categories/topics), and \d{2,3} lets single-digit 'N more books' slip. isStyleConsumer (.tsx|ts|css) exists but is unused by this guard.
- **H11** — Depth-routing feature is inert: updateDepthModel is never called, so the recommendation always returns the cold-start fallback
  - current: `app/app/api/book/_lib/depth-routing.ts:104 (writer, no callers) and app/app/api/book/me/books/[bookId]/depth-recommendation/route.ts:26-36 (always-fallback branch)`
  - ↳ updateDepthModel still has zero call sites on origin/main, so getDepthModel always returns null and the depth-recommendation route always emits the cold-start easy/0.3/hasData:false fallback. (The separate M6 DynamoDB key-casing bug was fixed via depthModelKey(), but that does not address H11.)
- **H12** — Event PATCH accepts a malformed/empty badge object that the POST creator rejects
  - current: `app/app/api/book/admin/events/[eventId]/route.ts:95`
  - ↳ Defect unchanged: PATCH `badge` keeps the weak `typeof === "object"` check while POST requires badgeId+name+icon; `books`/numeric fields were hardened to match POST (L39/M4 comments) but `badge` was not.
- **H13** — Malformed JSON body in Ask endpoint returns a 500 instead of 400
  - current: `app/app/api/book/books/[bookId]/ask/route.ts:32 (parse) + :446 (500 fallback)`
  - ↳ Malformed/truncated JSON body still throws SyntaxError that falls through to the generic 500 fallback; no 400 path for parse failure exists.
- **H14** — Notifications dailyVolume is computed from an arbitrary-order capped Scan, so the chart is wrong (under/random-counted) once the table exceeds the cap
  - current: `app/app/api/book/admin/metrics/notifications/route.ts:39-90`
  - ↳ Still an unordered Scan capped at 5000 with no createdAt index/sort; dailyVolume + read-rate aggregates are bucketed from that hash-order sample. Only a warning string + acknowledging comment were added — the wrong-count defect is unchanged.
- **H16** — Segment filter 'lastActiveWithinDays gt N' wrongly matches users who have never been active
  - current: `app/app/api/book/_lib/segment-engine.ts:83 (and :88)`
  - ↳ Unchanged on origin/main: a never-active user (lastActiveAt null) returns true for op 'gt', and gt means 'active within N days' (t>=cutoff), so dormant/never-active accounts are wrongly matched. 'gt' is allowed for this field (segments/route.ts:53) and exposed in the UI (SegmentBuilderClient.tsx:79), so the path is reachable.
- **H17** — Starter prescription can only ever recommend one of 3 hardcoded books, ignoring the user's selected shelf and the full book catalog
  - current: `app/app/api/book/_lib/starter-prescription.ts:119-126 (BOOK_META at :59-73; persisted at app/app/api/book/me/onboarding/complete/route.ts:142; consumed at app/book/hooks/useStarterPrescription.ts:47)`
  - ↳ Unchanged: BOOK_META hardcodes 3 books; a shelf with no overlap yields empty candidateIds and falls back to those same 3, so the prescription ignores the user's shelf and the 100+ catalog exactly as described.
- **H18** — book-covers.test asserts AVIF-sibling over the working tree, so stray untracked covers fail local verify
  - current: `lib/book-covers.test.ts:84-98 (origin/main)`
  - ↳ Test still readdirSyncs the working-tree covers dir and asserts an AVIF sibling for EVERY .webp (not git-tracked files), so stray untracked covers fail npm run test / verify; code is byte-identical to the audited lines 84-98.
- **H19** — listBookVersions issues a single un-paginated, un-limited Query and silently truncates past 1MB
  - current: `app/app/api/book/_lib/repo.ts:362-394 (offending send at 363-373)`
  - ↳ Defect unchanged: listBookVersions still does a single un-paginated, un-limited Query with no LastEvaluatedKey loop, silently dropping oldest VERSION# items past 1MB while queryAllItems sits 130 lines above unused.
- **H21** — putEvent writes append-only analytics events with no uniqueness guard; same-millisecond events of one type silently overwrite
  - current: `app/app/api/book/_lib/analytics-repo.ts:59-61,66-98 (PutCommand at :97); keys.ts:3-5 (nowIso)`
  - ↳ Exact defect intact: same-millisecond, same-eventType events for one user collide on PK+SK and the second PutCommand silently overwrites the first; no uniqueness guard added.
- **H23** — share-events returns 500 server_error instead of a typed 400 on missing/invalid JSON body
  - current: `app/app/api/book/me/share-events/route.ts:25`
  - ↳ Unchanged: req.json() in share-events POST is still un-try/catch'd, so malformed/empty bodies map to 500 server_error + OpsFailure instead of a typed 400, exactly as the finding describes.
- **H9** — BOOK_PACKAGE_PRESENTATION 'Getting-Things-Done' entry is unreachable and embeds a 404 cover path
  - current: `app/book/data/bookPackages.ts:1066-1072 (map entry) + :1566-1567 (resolver); cover 404 via lib/book-covers.ts:129-131`
  - ↳ Defect fully live on origin/main; only the v21 source filename was lowercased to getting-things-done.v21.json (bookId already lowercase), which makes the mismatch certain, not fixed. Audit line numbers drifted but code is substantively identical.
