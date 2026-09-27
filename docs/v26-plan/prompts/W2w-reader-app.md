# W2w — Show readers the writing: the reader's default depth and two mode bugs (only if R1-d = B or C)

- **Model:** Opus 5.5 (Claude Code session, started as `caffeinate -dimsu claude` in `~/cf-wt`; if `claude --version` is below 2.1.280, use the VS Code extension's binary as in W1's header)
- **Start directory:** `~/cf-wt`
- **Depends on:** R1-d = B or C in `~/cf-wt/v26-plan/DECISIONS.md`. Runs in parallel with W2.
- **Estimate:** 3–5 hours wall time. No pipeline model calls. At most 6 subagents.
- **Ends with:** one merged web PR (or its merge command printed), and `RESULT: DONE`. It deploys with Franklin's release in W3 (the deploy is the owner's).

---PROMPT---
You are running the web-app part of Wave 2 of the v26 ChapterFlow campaign on the owner's Mac. Work autonomously and do not ask the owner questions. You stop only by writing your status file.

## Why
A new user who has not customized their settings reads only a chapter's short summary (`fastRead`, a median of 94 words across the catalog). They then get one example, 5 quiz questions and a practice screen. The full telling (`fullRead`) appears only in "Challenge" mode, together with a 10-question, no-retry quiz. Two bugs make it worse. Clicking "Standard" does nothing. Picking a reading profile in Settings resets the reader to the short summary. The owner decided at R1-d to change what a new reader sees first:
- **B** = the full telling by default, for every book;
- **C** = the middle depth (`deepRead`) by default.

Evidence, with file:line, is in `~/cf-wt/v26-plan/scan/app-render.md` (§2, §3, §7 and its "Adversarial verification" section).

## Step 0
1. Read `~/cf-wt/v26-plan/BRIEF.md` (it overrides CLAUDE.md files) and the R1-d answer in `DECISIONS.md`. If R1-d is A or blank, write `RESULT: DONE — not needed (R1-d = A); no app change` and stop.
2. Read `scan/app-render.md` in full.
3. Create a change worktree `~/cf-wt/v26-reader` on branch `v26/reader-default-depth` from `origin/main`: `git -C ~/ChapterFlow-books-v25-completion fetch origin && git -C ~/ChapterFlow-books-v25-completion worktree add -b v26/reader-default-depth ~/cf-wt/v26-reader origin/main`. Then `cmp` the lockfiles and symlink both `node_modules` (BRIEF §5). Never `npm ci`. Reuse the worktree if it already exists.
4. Read the repo's `app/CLAUDE.md` and `components/CLAUDE.md` for the web-app conventions. They apply to this web change.
5. Load `superpowers:verification-before-completion` if it is in your skill list.

## The change (keep it minimal; each item test-first)
1. **Default depth, text only.**
   - `activeDepth` (`app/book/library/[bookId]/chapter/[chapterId]/ChapterReaderClient.tsx:144`) drives much more than the summary text: the example "Pause and predict" gate (`components/reader/ExamplesList.tsx:116`), the by-depth prompts and recap (`ReaderPhaseContent.tsx:105-114`, `ReaderOverlays.tsx:124-126`), the audio variant (`ReaderChrome.tsx:115-119`) and the client quiz (`useChapterQuiz.ts` `quizByDepth[activeDepth]`). So **leave `activeDepth` exactly as it is.**
   - Add `const readDepth: ReadingDepth = !bookPrefs.extended.profileCustomized ? "deeper" : modeToDepth(learningMode);`. Use `"deeper"` for B and `"standard"` for C.
   - Pass `readDepth` as a new prop, used only for the summary blocks (`ReaderPhaseContent.tsx:105` and its motion key at :121) and the audio `variant`. If item 5 is done, also use it for the header minutes.
   - Do **not** change `learning-mode.ts` or `lib/quiz-question-counts.ts`. The server already serves 5 questions to readers who have not customized their settings (`learning-mode.ts:141-150`, pinned by `learning-mode.test.ts`).
   - Leave the existing pin in `ChapterReaderClient.contract.test.ts` (it pins `useReaderSettings.ts:31`, which does not change). Add a test that pins `readDepth`'s default and checks that `activeDepth` stays `"simple"` on the fast path. `readDepth` needs no hydration guard: the defaults already have `profileCustomized:false`, so SSR and the first client render agree.
2. **Standard is a no-op.** At `ChapterReaderClient.tsx:262` (`if (mode === learningMode) return;`), a click on the already-selected mode must still apply its depth when the displayed depth differs.
3. **The settings profile reset.** `BookSettingsClient.tsx:419-434` writes `profileCustomized:false` when a profile is chosen, so a "Deep" profile still reads the short summary. Picking a profile is a customization, so the reader should get that profile's depth.
   - While there, make the side effects at `:458,468,477` (daily goal, persona, streak writing `profileCustomized:true`) not change reading depth by themselves.
   - Fix only what these lines do. Do not redesign settings.
   - Note in the PR body that a profile pick now also sizes the quiz by that profile's mode (Concise 5, Balanced 7, Deep 10), through `resolveStrictQuizQuestionCount`.
4. **Memorable lines once.** Today they render as an unquoted "Key Takeaways" list and again as quoted "Lines worth keeping" (`app/book/lib/v21-adapter.ts:134-139` → `SummaryCard.tsx`; `ReaderPhaseContent.tsx:158-160`). Keep one rendering, the quoted "Lines worth keeping". Check that removing the takeaway copy does not blank another surface that reads `takeaways` (grep the consumers). If it does, keep the data and hide only the duplicate list.
5. **Header reading time.** If it is a small change, make "N min read" (`ChapterHeader.tsx` ~430) reflect the depth being shown (words / 230 wpm). If it is not small, skip it and say why.

Do not touch the quiz content, the phases, the points economy, or anything else the app-render report lists as "not worth doing alone" (the single-newline split).

## Verify
- Unit and contract tests for each item, with the pass lines pasted.
- Run `npm run typecheck`, `npm run lint`, `npm run test`, then `npm run verify`, and paste the pass lines.
- Start `npm run dev` in the background and load a catalog chapter page. The chapter route needs AWS, so if it returns 404 or needs credentials, say so and rely on the component tests. Confirm with `curl` or the test render that the default depth now shows the longer tier.
- If `next build` or `next dev` fails on the symlinked `node_modules` (Turbopack: "points out of the filesystem root"), retry with `npx next build --webpack` or `npm run dev -- --webpack`. If that also fails, run the other `verify` parts one by one, rely on CI's build job, and say so. Never run `npm ci` or replace the symlink.
- One independent reviewer subagent (Opus) re-runs the tests on a clean checkout of the branch and reviews the diff for regressions: a reader in Challenge still gets fullRead and 10 questions, a Guided reader still gets fastRead, and SSR and hydration do not flash a different tier.

## PR
- Title like `fix(reader): show the chapter's full telling by default; fix the Standard no-op and the settings depth reset; show memorable lines once`.
- The body gives:
  - the owner decision (R1-d = B or C);
  - the before/after word counts a new reader sees for one catalog chapter (e.g. `book-packages/radical-candor.v21.json` ch1) and for W1's Franklin ch01 (`~/cf-wt/v26-plan/scratch/W1/final/ch01.chapter.json`);
  - the test evidence.
- Squash-merge when the review passed and the required checks pass (`.github/rulesets/main-branch.json`; E2E Smoke is not required and has been red on main since before this campaign). If refused, print the command for the owner.
- It ships with the next web deploy, which the owner runs in W3.

## Definition of done
`status/W2w.md` starts with `RESULT: DONE — reader default depth = <B|C>; PR #<n> merged (<sha>)`, or `NEEDS-OWNER — merge refused, command: …`. Include the test counts, the files changed, and anything W3 must include in the deploy note. Append one line to `~/.claude/projects/-Users-radinsoltani-ChapterFlow/memory/v26-campaign.md`.
---END---
