# Write a book — parallel writer-orchestrator (ChapterFlow v21)

Paste this whole file into a FRESH session. This session is an **orchestrator**: it
does NOT write chapters itself. It deals the pre-authoring plans, dispatches **up to
6 writer subagents at a time** (one chapter each), runs the book-wide gate as a
barrier, and re-dispatches only the chapters that fail — until the book is gate-clean.

Use this when **research is already done** (the chapter index + per-chapter source
sidecars exist). When the operator says **`Write the book <book>`** (a title or bookId).

> Why an orchestrator: a single session writing all 13 chapters drifts as it goes
> (answer-position balance erodes; every chapter reaches for the same "X is not Y"
> counterintuition and "What…" hook). Short, fresh, one-chapter subagents don't
> fatigue — and the orchestrator enforces the book-wide invariants no single writer
> can see. **You stay thin:** you read file paths and gate output, never paste a
> chapter's full prose into your own context.

## 0. Setup + preflight
```bash
cd scripts/book/prompts/chapterflow-v21-authored
export CHAPTERFLOW_SESSION_ID="author-$(date +%Y%m%d%H%M%S)"   # stamped so QC can prove independence
npx tsx src/cli.ts doctor <bookId>
npx tsx src/cli.ts book-status "<book>"
```
Fix anything FATAL from `doctor`. If `book-status` shows a **research** phase
(`research-bibliography` / `research-chapter` / `chapter-index`), STOP — research isn't
done; run **phase 1 first** (`RESEARCH-CODEX-SESSION.md`, or the research portion of the
single-session `GENERATE-A-BOOK-CODEX-SESSION.md` fallback), then come back. Proceed only
when the phase is `write-chapter`/`generating` and every chapter has a source sidecar.

## 1. Deal the plans + get the per-chapter authoring cards
```bash
npx tsx src/cli.ts fanout <bookId> --from 1 --to <N>
```
This deals ALL pre-authoring plans (names, scene shapes, venues, pedagogy, exemplars,
**rhetoric** = counterintuition shape + hook opener class, **answer-key** = balanced
correctIndex targets) and prints one **authoring card per chapter**. Each card already
contains everything that chapter's writer needs: its source-sidecar path, its reserved
names, dealt scene shapes, the OPENERS directive, the ANSWER-KEY TARGET, the source-
case-binding rule, and its self-gate command. **The card is the dispatch unit** — you
hand one card to one subagent, verbatim.

## 2. Dispatch in batches of ≤6 — one fresh writer subagent per chapter
Split the chapters into batches of at most 6 (e.g. 13 → **6 + 6 + 1**). For each batch,
spawn one subagent per chapter, in parallel, each with this contract:

> You are a writer subagent. Write EXACTLY ONE chapter — chapter `<n>` — from the card
> below. Read its source sidecar and author every field from THAT chapter's real source
> case. Obey the card's OPENERS (don't reach for "X is not Y" or a "What…" hook), the
> ANSWER-KEY TARGET (score each quiz question for truth first, then arrange the unchanged
> choices to the target positions), and the source-case-binding rule (the named case is
> the stage; the dealt venue is fallback-only — never demote the case to notes on a phone
> or write a format tag / domain label into prose). Then run
> `npx tsx src/cli.ts author-check <file>` and `npx tsx src/cli.ts gate-chapter <file>`
> and FIX until gate-chapter prints "Gate verdict: PASS — 0 blockers". Do NOT QC, publish,
> or touch any other chapter. If gate-chapter halts on a circuit-breaker (exit 3), STOP
> and report — do not keep patching.
>
> <paste this chapter's fanout card here>

Wait for a batch to finish before starting the next. Collect only each subagent's result
(file path + gate verdict) — never its prose.

## 3. Barrier — run the book-wide gate after ALL chapters exist
```bash
npx tsx src/cli.ts book-gate <bookId>
```
This auto-derives the brief + plans and runs the cross-chapter audit. The book-wide
defects (F3 answer-position drift, B11 counterintuition shell, B13 hook clustering,
F1 name reuse, BP13 verbatim runs) surface **only here** — a chapter can be clean on its
own and still be part of a book-wide collision.

## 4. Re-dispatch only the offenders, then loop
If `book-gate` reports blockers/majors, they name the offending chapters. Re-deal +
re-dispatch ONLY those chapters with the specific finding text added to the subagent's
instructions:
```bash
npx tsx src/cli.ts fanout <bookId> --from <ch> --to <ch> --all   # re-emits that chapter's card
```
- B11/B13/B14 (opener clustering) → the offenders DRIFTED from their dealt rhetoric
  shape; re-author them to the card's assigned counter/hook shape.
- F3 (answer drift) → re-author the chapters whose distribution deviates most from their
  ANSWER-KEY TARGET, arranging choices to the target.
- F1 / BP13 (name/phrase collision) → re-author the named chapters off the collision.

Re-run `book-gate`. Loop until **0 blockers**. **Round cap: 3.** If a book-wide blocker
survives 3 re-dispatch rounds, STOP and surface a one-paragraph status — that's a Step-1
source problem, not an authoring one, and grinding more rounds won't fix it.

## 5. Stop at `phase: qc` — hand off
When `book-status` shows `phase: qc` (every chapter gate-clean and book-gate clean):
```bash
npx tsx src/cli.ts qc-stamp-author <bookId>   # records this authoring session so QC can prove independence
```
Then STOP. Hand off to **QC-ORCHESTRATE-CODEX-SESSION.md** in a NEW session. This session
never QCs or publishes.

## Rules
- One chapter = one fresh subagent, authored from its OWN source sidecar. NEVER batch-write
  multiple chapters from a shared scaffold (that is the cross-chapter templating that
  AS5–AS11 / B11 / B13 block).
- Stay thin: reference file paths + gate output, never inline chapter prose into your own
  context — that's what lets you run a whole book without drifting.
- No editing a chapter to dodge a gate; fix the real field and re-run.
- Do not QC or publish here. Stop at `phase: qc`.
