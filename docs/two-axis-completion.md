# Two-axis completion (knowledge vs applied)

Feedback #4. A chapter has **two independent axes of completion**. Only the first one
gates anything.

| Axis | Meaning | Source | Gates? | IP? |
|------|---------|--------|--------|-----|
| **`knowledgeComplete`** | "You understood it." | quiz pass → `BookUserProgress.completedChapters` | **Yes — the sole gate** (unlock, IP, streak, tier, FSRS, journey) | quiz-pass IP (unchanged) |
| **`applicationComplete`** | "You used it." | commitment follow-through (derived) | **No — gates nothing** | none new (the pre-existing `+25 commitmentFollowThrough` only) |

## The application axis is derived, read-only, and gateless

`applicationComplete` is **not** a stored field. It is computed from the existing
commitment records by `deriveChapterApplicationState` — a 3-state value per
`(user, book, chapter)`:

- **`applied`** — a commitment was followed through (`status === "completed"` **and**
  `followThroughSubmittedAt != null`). Outcome (helped/partly/didn't) is irrelevant.
- **`committed`** — else, an `active` commitment exists (overdue-but-not-expired counts).
- **`none`** — otherwise.

Precedence is by **status-strength** (`applied > committed > none`), not recency, over
the **full unfiltered** commitment list.

### Why it must never become a gate

The original proposal would have let "chose an action" count as completion — that's a
gameable button click. Application completion deliberately means *demonstrated
follow-through over time* (you returned days later and wrote a 10–1000-char reflection),
which can't be faked and grants no unlock and no new IP. **Do not "fix" this into a
gate.** If you find yourself reading commitments inside a quiz/write/IP path, stop — the
application axis is read-only, for display and analytics only.

## Where it lives

- **Core (pure, client-safe):** `app/app/api/book/_lib/commitment-application-core.ts`
  — `deriveChapterApplicationState`, `reduceBookApplicationStates`,
  `toChapterIdKeyedApplicationStates`, `aggregateBookApplicationStates`. No
  `server-only`, so the reader can reuse the reducer.
- **Server wrapper:** `commitment-application.ts` — `getBookApplicationStates`
  (one `listCommitments` query per book read, no N+1).
- **Read path:** `GET /app/api/book/me/books/{bookId}/state` returns `applicationStates`
  (chapterId-keyed) as a sibling of `state` on **both** return branches. It is **not**
  part of the persisted `BookUserBookStateItem`.
- **Reader celebration:** `ChapterCompleteModal` pairs "Learned" with the application
  axis (helper: `app/book/_lib/application-axis.ts`).
- **Library:** `useBookProgress` exposes `applicationStates` (server-only state, never
  merged with local progress) + `appliedCount`; `ChapterCard`/`BookHero` display it
  (helper: `app/book/_lib/application-display.ts`).
- **Analytics:** `application_complete` funnel event fires once per chapter (deduped) at
  PATCH-complete time; `commitment_follow_through` is a surfaced earning rule.
