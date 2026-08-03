# ChapterFlow — fix prompts (by category)

Ready-to-dispatch agent prompts for every confirmed finding from the production-readiness re-audit of `main`: 200 findings + 2 re-confirmed carry-overs. Each prompt is self-contained — copy one block, give it to one agent. It tells the agent which branch to use, how to verify, and how to commit. IDs match `docs/archive/CHAPTERFLOW-PRODUCTION-READINESS-2026-06-14.md`.

**▶ Running them in parallel? Paste from [PARALLEL-TASKS.md](PARALLEL-TASKS.md)** — all 202 findings consolidated into 132 file-disjoint tasks, sorted by priority. Each is one copy-paste block that makes an agent create its own worktree+branch, fix, verify, and commit autonomously. That is the file to dispatch from.

**▶ Read [DISPATCH.md](DISPATCH.md)** for the branch model, the worktree spawner, and collision groups. The per-category files below hold the same prompts grouped by category (one item per block) if you prefer that view.

**Target branch for all fixes:** `audit/prod-readiness-2026-06-14`

> ⚠ **Launch blockers — do these first:** `X1`, `X2`, `C1`, `H4`, `H3`, `H12`, `H15`, `H14`, `H1`, `H2`, `H19`, `H20`, `H22`, `H23`, `H26`, `H27`, `H28`.

## Categories

| Category | Items | File |
|---|---|---|
| Security | 24 (5 high, 5 medium, 14 low) | [security.md](security.md) |
| Correctness / Bugs | 45 (1 critical, 1 high, 11 medium, 30 low, 2 polish) | [correctness.md](correctness.md) |
| Data Integrity (real-vs-fabricated, validation, money) | 40 (18 high, 11 medium, 10 low, 1 polish) | [data-integrity.md](data-integrity.md) |
| Production Readiness / Ops | 20 (2 critical, 1 high, 8 medium, 8 low, 1 polish) | [prod-readiness.md](prod-readiness.md) |
| UX / Flows | 28 (1 high, 6 medium, 16 low, 5 polish) | [ux.md](ux.md) |
| Performance | 8 (1 high, 5 medium, 2 low) | [performance.md](performance.md) |
| Accessibility | 5 (1 high, 1 medium, 2 low, 1 polish) | [accessibility.md](accessibility.md) |
| Dead Code | 12 (1 high, 3 medium, 5 low, 3 polish) | [dead-code.md](dead-code.md) |
| Maintainability | 20 (3 medium, 8 low, 9 polish) | [maintainability.md](maintainability.md) |

## All items (id → title)

### Security
- `H10` [high] Ask-the-Book daily rate limit is bypassable via a race (parallel requests) and aborted streams consume tokens free
- `H11` [high] Reflection-feedback endpoint: client-controlled exampleId defeats the rate limit and uncapped prompt fields inflate token cost
- `H13` [high] Public Lambda Function URLs, no CloudFront lock, no WAF
- `H18` [high] Public book-request endpoint has no rate limiting or abuse controls (writes DynamoDB + sends SES email per request)
- `H28` [high] No document-level Content-Security-Policy header for an auth + payments product
- `M1` [medium] OAuth callback never validates the state nonce — CSRF defense rests solely on encrypted-state integrity, and the cookie-fallback path has no anti-CSRF check at all
- `M5` [medium] User IP sent to third-party geolocation provider over plaintext HTTP
- `M11` [medium] Referral fraud same-device / same-IP checks are dead — inviter device/IP always passed as null
- `M23` [medium] Secrets in 5 Lambdas sharing one over-broad role
- `M42` [medium] CSV export is vulnerable to formula (CSV) injection on user-controlled fields
- `L3` [low] /auth/refresh has no rate limiting or abuse control on a token-minting endpoint
- `L9` [low] logout() relies on Cognito to reject an attacker-supplied returnTo; redundant cookieStore.delete() calls are no-ops for domain-scoped cookies
- `L17` [low] Trial-ending email interpolates Stripe customer name into HTML without escaping
- `L18` [low] requireActiveBookUser fails open — a deleted account stays reachable during a DynamoDB outage
- `L22` [low] Per-book metrics endpoint returns aggregate reader counts for any bookId without existence/ownership check
- `L23` [low] Ask-book endpoint trusts client-supplied conversation history as assistant turns
- `L27` [low] Badges PUT lets a client record any catalog badge with arbitrary earnedAt/tier without earning it (cosmetic only)
- `L35` [low] Push endpoint not validated against allowlist at registration time (defense-in-depth gap)
- `L36` [low] Pair invite codes use Math.random() rather than a CSPRNG
- `L40` [low] concept-graph route has no route-level auth/active-account guard while paid chapter content is gated
- `L42` [low] Audio route logs user display name and userId to application logs (PII) plus heavy per-request console noise
- `L43` [low] Ask endpoint accepts client-supplied conversation history as assistant turns (prompt-injection / jailbreak surface)
- `L50` [low] Unhandled-error logger emits full stack traces to console (potential sensitive-data logging) and there is no error monitor
- `L87` [low] @anthropic-ai/sdk pinned to a range that includes a moderate CVE (insecure default file permissions) — but fix is a SemVer-major bump, not 'non-breaking-ish'

### Correctness / Bugs
- `X2` ⚠ [critical] CloudFront errorResponses rewrite ALL 403/404 to the homepage at HTTP 200, corrupting every API error response
- `H15` [high] Reminder emails hardcode legacy APP_BASE_URL — unsubscribe broken
- `M6` [medium] Depth-recommendation broken: wrong DynamoDB key casing (pk/sk) and updateDepthModel never called
- `M8` [medium] Streak-day IP bonus anchored to UTC day while streak progresses on user-timezone day — denies the daily bonus to evening/morning readers in negative-offset timezones
- `M9` [medium] FSRS review submit is not idempotent — a double-submit corrupts the card schedule and writes duplicate review logs
- `M10` [medium] share-events endpoint returns 400 on every request — requireString called with the body object instead of the field
- `M15` [medium] Admin email search is case-sensitive (contains on raw stored email) — admins can't find users by name-cased emails
- `M18` [medium] Adaptive depth-routing is entirely dead/broken — wrong DynamoDB key casing, no writer, no consumer
- `M21` [medium] No QueryCommand in repo.ts paginates LastEvaluatedKey — every list silently truncates at 1MB
- `M22` [medium] listLicenseKeys applies FilterExpression AFTER a single un-paginated 1MB read
- `M28` [medium] Recorded Terms-acceptance version (2026-06-10) does not match the displayed Terms/Privacy effective date (April 2, 2026)
- `M32` [medium] quizPassed is always false in the live flow (state.quizResult is never written client-side) — dead IP-reconciliation + dead practice gating
- `M36` [medium] Progress page client redirect race bounces fresh-browser onboarded users off /book/progress
- `L2` [low] /auth/refresh parses Cognito's token response with un-guarded await tokenRes.json() — a non-JSON 200 surfaces as an uncaught 500
- `L10` [low] invoice.payment_failed records the wrong Stripe field as the failure reason — admin sees generic "payment_failed" not the decline code
- `L12` [low] Trial-ending email can be re-sent on webhook redelivery (recordStripeWebhookEvent is the only idempotency gate and runs after the send)
- `L13` [low] Disputed-then-paid race can re-activate a chargebacked subscriber (out-of-order webhook delivery)
- `L19` [low] Unsubscribe and settings writes are read-modify-write with no concurrency guard
- `L20` [low] Published-catalog query has no pagination (silent truncation as library grows)
- `L21` [low] Local quiz answer key defaults to index 0 when missing, can silently mis-grade
- `L24` [low] Consistency score double-counts today and can exceed 100%
- `L26` [low] Concurrent redemption of the same one-time reward returns a raw 500 instead of a clean 409 (double-spend is prevented)
- `L30` [low] Pair invite accept is a TOCTOU with non-conditional writes — concurrent/duplicate accepts can clobber
- `L31` [low] journeys/[journeyId]/start does not validate the journeyId exists in definitions
- `L32` [low] events join does not validate the event exists/is active
- `L33` [low] recordEventChapter dereferences eventDef.badge unconditionally in the completion notification
- `L34` [low] Device token SK truncates endpoint to last 32 alphanumerics — collision can drop a user's device
- `L37` [low] Filtered scan with Limit returns fewer rows than expected (ingestion jobs / metrics) — silent under-counting
- `L38` [low] Segment filters stored without server-side validation of field/operator/value
- `L39` [low] events POST casts body.books to string[] without per-element validation
- `L45` [low] summarizeProgress 'booksCompleted' uses a fragile chapter-number-vs-count heuristic
- `L46` [low] getLambdaHealth reports the MEDIAN of per-bucket percentiles instead of the percentile
- `L47` [low] deviceTokenSk hashes only the last 32 chars of the endpoint, risking key collisions
- `L56` [low] Hero/Problem make unsourced absolute retention claims ('only proven method', 'forget the majority within weeks')
- `L58` [low] Privacy Policy effective date (April 2, 2026) predates the data practices it describes; CASL/analytics sections are newer than the stated date
- `L62` [low] UnlockCelebration currentStreak prop is never wired; route's real streak/points are parsed then discarded
- `L73` [low] Reflection filter and "reflection" entry type never produced by the notebook API (always-empty filter)
- `L75` [low] Division-by-zero NaN width on journey/event progress bars when a journey has 0 books
- `L76` [low] BadgeCelebration hero effect has stale-closure deps and uncleared staggered timeouts
- `L79` [low] Streak alerts can stay enabled (and fire) after streak mode is turned off
- `L81` [low] Currency-formatted KPIs always render a bare '$' though amounts are CAD
- `L85` [low] Reading 'Sans-Serif' option maps to Inter, which is never loaded
- `L86` [low] Dialog/Sheet has no nested-dialog stack: a second open overlay breaks Escape and the focus trap
- `P7` [polish] estimateMonthlyCost uses hardcoded US-region on-demand prices and a 30-day month
- `P8` [polish] CurrentYear renders on the server, risking a stale copyright year and a year-boundary hydration mismatch

### Data Integrity (real-vs-fabricated, validation, money)
- `H1` [high] Admin "Real MRR/ARR" sums annual subscription amounts as if monthly — inflates MRR ~12x per annual subscriber
- `H2` [high] GDPR/CCPA data export silently truncates for heavy users — unpaginated DynamoDB Queries
- `H3` [high] Quiz answer key (correctChoiceId/correctIndex) leaked to client on every quiz fetch
- `H4` [high] Chapter unlock gating bypassable via client-trusted state-sync PATCH
- `H5` [high] Live progress page renders fabricated daily-quest reward ("+75 IP for all") that is never awarded server-side
- `H6` [high] Live progress page Knowledge-Review and streak data come from localStorage, diverging from the real server FSRS/streak systems
- `H8` [high] Referral escalation tier rewards (4,600 IP + exclusive frames/themes/badges) are never awarded — checkReferralEscalation is dead code
- `H12` [high] DocumentClient convertEmptyValues:true rewrites empty Sets (and empty strings) to NULL, breaking entitlement set-initialization
- `H14` [high] App table never enables TTL though cron+app write ttl
- `H19` [high] Privacy & Data-Rights pages claim analytics/location are excluded from self-serve export, but the export route returns them
- `H20` [high] Cookie Policy omits the persistent refresh_token cookie and cf_acq_* acquisition cookies; states auth_expires_at duration is 1 hour when its cookie lifetime is 30 days
- `H21` [high] Onboarding tone/chapter-order choices never reach the reader (legacy localStorage key only gets setupComplete; reader seeds from different field names / settings.extended)
- `H22` [high] Chapter notes (and other reader state) silently overwritten by server state on load — data loss
- `H23` [high] Reset progress only mutates local state and can be resurrected by the server union-merge
- `H24` [high] Event detail fabricates "Eligible Books" titles by title-casing the bookId slug instead of using the real catalog title
- `H26` [high] Reminder time & timezone chosen in Settings never reach the reminder cron — all reminders fire at default 20:00 UTC
- `H27` [high] Cross-device settings clobber: server settings only applied when localStorage is empty; stale device silently overwrites newer settings
- `H29` [high] Profile page hardcodes a stale, overstated catalog size ("93+ more books", "21 categories") that contradicts the live 68-book / 13-category catalog
- `M3` [medium] Export contains analytics data but tells the user it doesn't (false disclaimer)
- `M12` [medium] PartnerProgressCard shows no partner progress or name — feature delivers nothing it promises
- `M16` [medium] Admin insight-point adjustment marks the target user as active (lastActiveAt = now), corrupting retention/active metrics
- `M17` [medium] Manual entitlement override (plan/proStatus/freeBookSlots) writes no audit trail
- `M19` [medium] Ask and Audio load book content from the in-repo package list, diverging from the S3/API-backed reader (S3-only books 404)
- `M37` [medium] Profile shows hardcoded "93+ books" and "X of 21 categories" that don't match the real catalog
- `M38` [medium] Badges page presents an "IP" level/currency derived from badge points the server never grants (diverges from real Insight Points)
- `M40` [medium] Free-tier book count hardcoded to "2" instead of reading freeBookSlots from the entitlement payload
- `M41` [medium] "Personalized recommendations" consent toggle is a no-op — no surface honors it
- `M44` [medium] Night-mode schedule is partially wired (a scheduler exists) but only runs on 2 pages and races applyDocumentTheme
- `M53` [medium] Profile renders a zeroed account on a dashboard API failure
- `L14` [low] Dispute billing-event record key falls back to a non-deterministic timestamp if dispute.created is ever absent
- `L15` [low] Mixed-currency subscriptions silently corrupt MRR sum (warning is logged but the bad total is still reported)
- `L25` [low] Reflection IP (5 IP/example) is granted on a client-supplied length, not on validated reflection content
- `L48` [low] ingestBookPackageFromS3 re-validates but stores the RAW unvalidated upload as book.json
- `L57` [low] BrowseLibraryPage default 'Most popular' sort is essentially reverse-alphabetical because only one book is flagged popular
- `L64` [low] Terms/Privacy consent from signup is only persisted at onboarding completion (client-side gate otherwise)
- `L71` [low] Library 'Recently added' sort just reverses catalog order (no real recency signal)
- `L74` [low] Profile "Pinned takeaways" stat is a derived count, not real pin state
- `L94` [low] Library UserStats reports currentStreak:0 and a hardcoded nextBadge regardless of real data (currently not displayed, but a latent lie)
- `L95` [low] Book detail page presents a derived page-count estimate as a real "pages" figure
- `P13` [polish] Library UserStats hardcodes currentStreak=0 / streakIsActiveToday=false / nextBadge (dead-but-misleading derived fields)

### Production Readiness / Ops
- `C1` [critical] Production canonical/OG/sitemap URL silently defaults to wrong domain (https://soltani.org) with no env guard
- `X1` ⚠ [critical] Auth middleware redirects the Stripe webhook to /auth/login, breaking webhook processing in production
- `H9` [high] Segment bulk-notify fans out up to 5000 sequential notification sends in one 30s request (SES + push per user) — will time out and partially send
- `M4` [medium] audio-name route swallows auth/4xx into 500, is an unrate-limited paid-TTS abuse surface, and has no caller (greeting feature itself is NOT broken)
- `M13` [medium] Reconciliation route declares maxDuration=60 but the server Lambda timeout is 30s — long reconciliations are silently killed
- `M24` [medium] No Lambda log retention; CloudFront 403/404->200 soft-404s
- `M25` [medium] lambda/dist no build automation; no prod-secret guard; dead App Runner role+CI perms
- `M27` [medium] Sitemap and robots advertise login-gated /book/* routes as public indexable URLs
- `M30` [medium] Deep-link login emits an absolute returnTo that the env-only allowlist rejects when site-URL vars don't match the serving host
- `M49` [medium] Unused heavy dependencies shipped (aws-sdk v2, pdf-lib, pdfjs-dist) + app-unused openai — 3 of 6 moderate CVEs; bundle-bloat claim overstated
- `M51` [medium] E2E CI gate only smoke-tests the Turbopack dev build with auth bypassed — never exercises the production artifact or real-data/error paths
- `L1` [low] /auth/login throws an unhandled 500 (raw Next error page) when Cognito env is missing; the friendly 500 guard below it is dead code
- `L8` [low] /api/auth/session and /api/me cannot distinguish 'logged out' from 'Cognito/JWKS temporarily unverifiable', so a verification outage shows users as logged out
- `L41` [low] Scenario submissions trigger a Claude moderation call with no per-user submission rate limit
- `L44` [low] getServerEnv permanently caches missing env vars, so a transient SSM error becomes a permanent 'missing'
- `L49` [low] Ingestion writes all S3 artifacts sequentially with no rollback on partial failure
- `L84` [low] OpenDyslexic accessibility font loads from a third-party CDN at runtime
- `L88` [low] next.config.ts redirects use permanent: true (308) — permanently browser-cached, hard to undo
- `L91` [low] CI app-checks build uses placeholder Cognito/table env that masks missing-config crashes; launch-blocking env vars fail soft, no .env.example
- `P2` [polish] Console.log noise in hot audio path and stray debug logging

### UX / Flows
- `H25` [high] Notebook page is unreachable from navigation and missing the server access guard
- `M26` [medium] Prominent 'Start 14-day free trial' CTA dumps logged-out users into the reader, never into a trial/checkout flow
- `M31` [medium] Pair-accept 401 (expired/invalid token) dead-ends with only 'Go to dashboard', no re-login path
- `M35` [medium] Library 'Active Reads' silently drops the 2nd in-progress book (exactly-two case)
- `M39` [medium] Failed reward redemption is shown in a success-styled (accent) banner
- `M43` [medium] Bulk 'Notify segment' sends to thousands with no pre-send count or confirmation
- `M52` [medium] Badges page blanks out on a dashboard API failure
- `L6` [low] Brief refresh race: id_token cookie expires (~1h) on its own maxAge while a silent refresh is in flight, so a navigation in that window is bounced to /auth/login
- `L7` [low] Middleware-built absolute returnTo is silently dropped to /book if the serving host's origin isn't the configured APP_BASE_URL
- `L29` [low] Journeys feature is orphaned post-merge (no reachable nav link) and dashboard no longer surfaces partner/commitment/event cards
- `L53` [low] /pricing SEO description advertises 'Challenge mode' that the pricing page never surfaces (copy drift)
- `L54` [low] Contact page sticky header uses invalid inline CSS 'var(--bg-base)/80' so its background never renders
- `L59` [low] Data-Rights page links to /book/settings, which requires authentication (redirects logged-out visitors to login)
- `L60` [low] AuthErrorBanner retry hardcodes returnTo=/book and dismiss strips all query params
- `L65` [low] AudioPlayer resets playback speed to 1x on every (re)load while UI still shows the chosen speed
- `L68` [low] Progress 'Reading Activity' empty-state CTA renders literal '→' instead of an arrow
- `L69` [low] Daily quests bonus IP collapses to '+0 IP earned' the moment all quests complete
- `L72` [low] Dashboard 'next reward' always points at the first catalog reward, not the next unearned one
- `L77` [low] Delete/Deactivate modals close on failure, hiding the error behind a transient toast
- `L78` [low] Settings search index omits the privacy/analytics consent toggle and welcome-back emails
- `L80` [low] Retention 'Reading frequency' card shows all-zeros during load instead of a skeleton
- `L82` [low] Ops ingestion 'view' error link is a dead element (no href/action)
- `L83` [low] User-detail drawer dumps raw entitlement/erase JSON, exposing internal fields and PII
- `P1` [polish] Signup Enter-to-submit and OAuth buttons no-op silently when the consent box is unchecked
- `P12` [polish] AskBookDrawer follow-up suggestions use a biased Math.random sort over a tiny pool
- `P15` [polish] Rewards page TopNav highlights the wrong active tab (badges)
- `P20` [polish] Admin client mutations use native alert()/confirm() instead of in-app dialogs
- `P21` [polish] EmptyState CTA renders a raw <a href> (full page reload) instead of Next Link, and the branch is dead

### Performance
- `H16` [high] Reminder cron full-table Scan + serial N+1 reads on 5-min timeout
- `M2` [medium] economy-health full-table Scan runs synchronously inside the admin economy HTTP route — timeout/cost risk at scale
- `M7` [medium] Audio route writes a full per-user MP3 to S3 on every playback that is never read back
- `M14` [medium] Multiple metrics routes do unbounded full-table DynamoDB scans on every request under a 30s ceiling
- `M20` [medium] Audio route writes a per-user stitched MP3 to S3 on every request but never reads it back; segment loads are serial
- `M47` [medium] Color-blind mode applies an SVG filter:url() to <html>, forcing full-page filtered repaints
- `L16` [low] Analytics beacon does a DynamoDB read per navigation event to re-check consent
- `L67` [low] Full book detail is re-fetched server-side on every chapter navigation

### Accessibility
- `H17` [high] Reduced-motion users get the mobile sticky CTA bar pinned over content from first paint, with all scroll/visibility gating bypassed
- `M46` [medium] High-contrast mode flattens every semantic border color to one gray via `* !important`
- `L55` [low] Interactive demo auto-advances animated content with no reduced-motion guard or pause control
- `L66` [low] Keyboard-shortcuts overlay (and AddScenarioModal) are bespoke dialogs without focus trap / focus restore
- `P10` [polish] Onboarding swipe-deck arrow-key handler is global and unguarded (no input-focus / modifier check)

### Dead Code
- `H7` [high] Reading-partner (pairs) feature has no UI entry point — entirely unreachable
- `M33` [medium] Reflection-IP award flow in ExamplesList is fully dead (endpoint never called)
- `M34` [medium] Entire app/book/home/components tree's 11 widgets are dead code (~1577 LOC)
- `M45` [medium] accentColor, interfaceDensity, focusRingStrength are dead theming plumbing (no CSS consumers, no Settings UI)
- `L5` [low] access_token cookie is set on every auth/callback+refresh but never read by the app — unused credential surface
- `L11` [low] Webhook imports a block of dead symbols left over from the removed referral-conversion payout
- `L28` [low] review_session_complete IP (10) is defined in the economy but never awarded by any endpoint
- `L92` [low] Dead mock-data modules left in the live tree (progressMockData, MOCK_USER_STATS/MOCK_WEEKLY_CHALLENGE) — confusing but not rendered
- `L93` [low] Unmounted legacy home-screen components (CurrentlyReadingCard, TodaySessionCard, FlowPointsSection, etc.) — plus 5 more dead home cards and a dead hook the finding missed
- `P9` [polish] prose-legal class applied to every legal article is a no-op (not defined in CSS and not a valid typography-plugin variant)
- `P14` [polish] Dead exported mock constants and helpers in libraryData.ts (MOCK_BOOKS / MOCK_USER_STATS / MOCK_WEEKLY_CHALLENGE / getBookById etc.)
- `P17` [polish] saveQuizHistory and saveNotes privacy fields exist in the schema but have no Settings UI control

### Maintainability
- `M29` [medium] Terms, Privacy, and Cookies pages hardcode entity name, support email, and pricing instead of importing the single-source-of-truth modules
- `M48` [medium] Multiple divergent copy-pasted ProgressRing implementations (more than the audit found)
- `M50` [medium] Static JSON book-package imports against a directory with untracked files — latent CI build-break trap (does not currently reproduce)
- `L4` [low] Two parallel design-token systems split across the auth components (--cf-* vs --accent-amber/--bg-elevated/--text-*)
- `L51` [low] EmailSuppression key format is duplicated across multiple build roots with only a comment to keep them in sync
- `L52` [low] Lower-severity infra items (content-bucket public, dead stream, prod CORS, hardcoded SES sender)
- `L61` [low] AuthErrorBanner uses legacy design tokens while the rest of the auth UI uses --cf-*
- `L63` [low] INSIGHT_POINTS_COOKIE_NAME is actually the referral cookie ('cf_ref') — misleading constant name
- `L70` [low] Two parallel CSS token systems (--cf-* vs legacy --bg-/--text-/--accent-) split across sibling surfaces
- `L89` [low] Lint is advisory-only (continue-on-error) and next build does not lint — real code-quality regressions cannot block a merge
- `L90` [low] README.md still claims the repo ships two product domains including the deleted Cloud Portfolio — plus a verified-dead SECURE_DOC_TABLE code path
- `P3` [polish] Streak-shield purchase return value carries a misleading balance:0
- `P4` [polish] INSIGHT_POINTS_COOKIE_NAME ('cf_ref') is the referral-attribution cookie — misleading name invites future bugs
- `P5` [polish] insight-points/adjust duplicates requireAdminUser logic instead of reusing the shared guard
- `P6` [polish] Stale-comment 'fire-and-forget' on awaited notify loop, and notifications dailyVolume hardcoded to zero
- `P11` [polish] Onboarding books.ts / recommendations.ts comments hardcode '67-book catalog' — already drifted (catalog is 68)
- `P16` [polish] Two parallel design-token systems used across this area (--cf-* vs --bg-base/--text-*/--accent-cyan)
- `P18` [polish] Content scenario chart zips submissions and approvals by array index, not by date
- `P19` [polish] Stale 'Phase N / once live in production' copy implies tracking is not wired
- `P22` [polish] Five coexisting token systems (~170+ CSS custom properties) create high theming-change risk

