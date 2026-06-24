# Fix note: quiz-submit local-fallback bypasses anti-abuse cooldown ("lazy-avalanche")

**Status:** NOT A BUG ON `main` — already fixed. No code change.
**Investigated:** 2026-06-24 · against `origin/main` tip `fb5bc111f`.
**Outcome:** Finding does not reproduce in production. Documented here for audit traceability.

## The finding (from the prod-readiness audit)

> In `app/book/library/[bookId]/chapter/[chapterId]/hooks/useQuizSession.ts` `submit()`, the
> catch block calls `scoreLocally()` first. Because a loaded session always has questions,
> `scoreSessionLocally()` (`lib/quizScoring.ts`) only returns `null` for a zero-question
> session, so the catch ALWAYS enters the provisional-scoring branch, sets `provisional=true`,
> and returns a locally-graded `{session}`. The follow-on
> `if (submitError instanceof BookClientError && code === "attempt_cooldown") await load()`
> branch is therefore **dead code**.
>
> Trigger: user fails a quiz (failureStreak→1, 60s cooldown), edits answers, retries inside the
> cooldown. Server returns 429 `attempt_cooldown`; `fetchBookJson` throws `BookClientError`,
> but `submit()` returns a local provisional result. If the corrected answers now pass,
> `handleSubmitQuiz` (`ChapterReaderClient.tsx`) calls `markPhaseCompleted("quiz")` and the
> ResultsScreen "Continue" path calls `markChapterComplete()` + unlock — locally completing the
> chapter and unlocking the next. Same swallowing for `attempt_rate_limited`,
> `quiz_session_stale`, 400 validation, and transient 5xx. Impact: the documented anti-abuse
> failure cooldown / hourly rate limit is not enforced in the UI; a server-rejected attempt can
> flip the local UI to "passed" and unlock the next chapter.

Cited location: `useQuizSession.ts:337-354` (catch block), consumed in `ChapterReaderClient.tsx:728-792`.

## Why it does not reproduce on `main`

The cited line numbers (337–354) match the **stale audit branch** `audit/prod-readiness-2026-06-14`,
which still carries the buggy dead-code version. `main` was refactored past it by:

> **`44cd7ab49`** — `fix(reader,dashboard): local-content fallback dev-only (#1) + dashboard fail-honest (#2) (#290)`

(confirmed an ancestor of `main`'s current tip). The relevant mechanism on `main`:

1. **Build flag** `IS_DEV` — `app/book/_lib/client-env.ts:17`:
   ```ts
   export const IS_DEV = process.env.NODE_ENV !== "production";
   ```
   Next statically inlines `NODE_ENV`, so in a production bundle `IS_DEV` is the literal
   `false` and every `IS_DEV`-guarded branch is dead-code-eliminated.

2. **Pure policy** `shouldUseLocalFallback(isDev, status)` —
   `app/book/library/[bookId]/chapter/[chapterId]/lib/fallbackPolicy.ts` — returns `isDev`
   (i.e. `false` in prod) for **every** status: connectivity/`null`, 5xx, AND access codes
   402/403/404. Its header documents the deliberate policy: prod never falls back to bundled
   local content/quiz because the local choiceId scheme diverges from the server's and local
   content can be stale, so masking a real outage is worse than surfacing the retryable error UI.

3. **`submit()` catch** — `useQuizSession.ts:~526-545` now reads:
   ```ts
   } catch (submitError: unknown) {
     const status = submitError instanceof BookClientError ? submitError.status : null;
     if (shouldUseLocalFallback(IS_DEV, status)) {   // false in prod ⇒ block skipped
       const local = scoreLocally();
       if (local) { local.provisional = true; /* …setSession/syncFromSession… */ return { session: local, loopPipeline: null }; }
     }
     if (submitError instanceof BookClientError && submitError.code === "attempt_cooldown") {
       await load();                                  // now reachable in prod
     }
     throw submitError;                               // server rejection surfaces
   }
   ```
   In prod the provisional branch is skipped and control falls through to `throw submitError`.
   `handleSubmitQuiz` catches the re-thrown `BookClientError` and toasts its message. There is
   **no provisional pass and no false completion/unlock**. The cooldown `await load()` branch —
   dead in the buggy version — is reachable again, refreshing the cooldown/attempt state.

4. The **`load()`** path's `buildLocalSession` is gated by the same policy
   (`shouldUseLocalFallback(IS_DEV, null)`), so a failed quiz *fetch* also surfaces the
   retryable error UI in prod rather than an offline local session.

5. A **regression test already exists**:
   `app/book/library/[bookId]/chapter/[chapterId]/lib/fallbackPolicy.test.ts`.

## Note on scope of main's fix

`main`'s fix is intentionally **stricter** than the audit's recommended fix. The audit proposed
re-throwing only server-enforcement codes / 4xx while *keeping* local provisional scoring for
genuine offline/network failures. `main` instead refuses local fallback in prod for *all*
failure modes (including offline), on the documented grounds that the local choiceId scheme can
grade a divergent, wrong "pass". The audit's core security concern — a server-rejected attempt
producing a provisional pass that completes/unlocks the next chapter — cannot occur in
production on `main`. No further change is warranted.

## Recommendation

Close this finding as already-resolved by `44cd7ab49` (PR #290). No code change.
