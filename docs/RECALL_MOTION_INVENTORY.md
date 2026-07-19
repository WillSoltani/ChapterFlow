# Recall continuous-motion inventory

This is the acceptance inventory for owner decision 2A+. It classifies motion by
the state it communicates, not by selector name. Decorative public-site motion is
finite, pointer-driven, or static; the continuous cases below exist only while a
real state is changing. Both `prefers-reduced-motion: reduce` and the in-app
`html[data-motion="reduced"]` setting clamp CSS/Tailwind animation to one near-zero
duration iteration. Components that can avoid scheduling motion directly do so.

## Literal continuous declarations

- `.animate-shimmer` in `app/globals.css` — a loading skeleton while content is genuinely unresolved. Both reduced-motion signals explicitly remove the animation and leave the complete static skeleton.
- `.bd-dot-pulse` in `app/globals.css` — the current chapter-learning step while work is in progress. The static bullseye shape, `aria-current="step"`, and accessible step label preserve the state without motion or color.
- `components/website/BookRequestForm.tsx` — Framer `repeat: Infinity` rotates only the submitting indicator. The button remains `aria-busy` with “Submitting...” text; the shared reduced-motion hook removes rotation.

## Tailwind-compiled continuous utilities

These utilities compile to continuous keyframes even though the word `infinite`
does not occur at their call sites. Each source/class pair is listed so the
contract test fails if a new loop appears without an owner and state explanation.

### Loading skeletons (`animate-pulse`)

- `app/book/admin/_clients/FunnelsClient.tsx` — `animate-pulse` — admin funnel rows while the query is loading.
- `app/book/admin/_clients/GrowthClient.tsx` — `animate-pulse` — admin growth metrics while loading.
- `app/book/admin/_clients/ModerationClient.tsx` — `animate-pulse` — moderation queue placeholders while loading.
- `app/book/admin/_clients/OpsClient.tsx` — `animate-pulse` — operations dashboard placeholders while loading.
- `app/book/admin/_clients/OverviewClient.tsx` — `animate-pulse` — overview metrics while loading.
- `app/book/admin/_clients/RetentionClient.tsx` — `animate-pulse` — retention rows while loading.
- `app/book/admin/_clients/SegmentBuilderClient.tsx` — `animate-pulse` — segment results while loading.
- `app/book/admin/_clients/UsersClient.tsx` — `animate-pulse` — user detail/list placeholders while loading.
- `app/book/admin/_components/Skeleton.tsx` — `animate-pulse` — canonical admin loading skeleton.
- `app/book/events/EventsClient.tsx` — `animate-pulse` — event page/list placeholders while loading.
- `app/book/events/[eventId]/EventDetailClient.tsx` — `animate-pulse` — event detail placeholder while loading.
- `app/book/journeys/JourneysClient.tsx` — `animate-pulse` — journey page/list placeholders while loading.
- `app/book/journeys/[journeyId]/JourneyDetailClient.tsx` — `animate-pulse` — journey detail placeholder while loading.
- `app/book/library/[bookId]/chapter/[chapterId]/components/ChapterSkeleton.tsx` — `animate-pulse` — chapter reader skeleton while content loads.
- `app/book/library/[bookId]/components/BookDetailSkeleton.tsx` — `animate-pulse` — book detail skeleton while content loads.
- `app/book/notebook/NotebookClient.tsx` — `animate-pulse` — notebook entries while loading.
- `app/book/progress/loading.tsx` — `animate-pulse` — route-level progress skeleton while loading.
- `components/library/LibrarySkeleton.tsx` — `animate-pulse` — library skeleton while catalog data loads.

### Live but independently labelled state (`animate-pulse`)

- `app/book/library/[bookId]/chapter/[chapterId]/components/AudioPlayer.tsx` — `animate-pulse` — audio is actively playing; the control also shows the pause icon and “Now Playing.”
- `app/book/library/[bookId]/chapter/[chapterId]/components/SessionModeOverlay.tsx` — `animate-pulse` — the current active guided-tour step; the step is also structurally current, and this class is omitted directly under reduced motion.

### Loading, submitting, or refreshing (`animate-spin`)

- `app/book/admin/_clients/LiveActivityClient.tsx` — `animate-spin` — live-activity refresh is running.
- `app/book/admin/_clients/OpsClient.tsx` — `animate-spin` — an operations action/refresh is running.
- `app/book/admin/_clients/OverviewClient.tsx` — `animate-spin` — overview refresh is running.
- `app/book/admin/_clients/ReconciliationClient.tsx` — `animate-spin` — reconciliation refresh is running.
- `app/book/events/[eventId]/EventDetailClient.tsx` — `animate-spin` — an event action is being processed.
- `app/book/library/[bookId]/chapter/[chapterId]/components/AudioPlayer.tsx` — `animate-spin` — audio is loading; play/pause controls and loading state remain static under reduced motion.
- `app/book/library/[bookId]/chapter/[chapterId]/components/QuizPanel.tsx` — `animate-spin` — a quiz answer is being submitted alongside “Submitting...” text.
- `app/book/settings/components/DangerZone.tsx` — `animate-spin` — deactivate/delete work is being processed in a disabled action.
- `app/book/settings/components/ExportModal.tsx` — `animate-spin` — the account export is being prepared.
- `app/book/settings/components/SubscriptionCard.tsx` — `animate-spin` — a subscription action is being processed.
- `app/onboarding/components/UnlockCelebration.tsx` — `animate-spin` — onboarding setup is being saved alongside “Saving your setup...” text.
- `components/landing/recall/RecallBookRequestForm.tsx` — `animate-spin` — the public book request is being sent alongside “Sending...” and `aria-busy`.
- `components/review/ReviewSessionFSRS.tsx` — `animate-spin` — review cards are loading alongside “Loading review cards...” text.

### Streaming or evaluation in progress (`animate-bounce`)

- `app/book/components/AskBookDrawer.tsx` — `animate-bounce` — the assistant is streaming a response; the message region remains the state carrier without motion.
- `components/reader/ExamplesList.tsx` — `animate-bounce` — a submitted scenario is being evaluated alongside “Reviewing your scenario...” text and a disabled action.

## Reduced-motion parity

- OS and in-app reduced-motion triggers share the same universal duration and iteration clamp.
- `.animate-shimmer` and `.bd-dot-pulse` additionally use the identical explicit kill list.
- The public Recall hero, reveal choreography, reader showcase, and library choreography render their meaningful final state instead of hidden pre-animation content.
- Loading, submitting, playing, selection, and current-step meaning remains available through text, shape, icon, `aria-busy`, `aria-current`, or structural position when animation is removed.
