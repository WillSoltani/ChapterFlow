# QC — fanned-out orchestrator session (ChapterFlow v21)

Paste this whole file into a FRESH session. This session is a QC **orchestrator**: it
opens a round, then dispatches **up to 6 reviewer subagents at a time** (one QC unit
each), and lets the deterministic CLI collect + decide. It does NOT author, edit, or
publish. This is the parallel alternative to `QC-CODEX-SESSION.md`; same trust model,
more throughput.

When the operator says **`QC <book>`** — do exactly this.

> Trust model (don't subvert it): the per-unit reviewer ids are PRE-DERIVED in the
> review packet (`codex-qc:<round>:<role>:ch<NN>`), so a chapter's bar and confirm
> reviewers DIFFER by construction — which makes finalize's "confirm reviewer must
> differ from bar reviewer" check pass for genuinely separate reviewers. The ids only
> guarantee the strings differ; genuine independence still requires YOU to dispatch a
> SEPARATE subagent for each chapter's confirm read — never let a chapter's bar
> subagent also fill/submit that chapter's confirm. Subagents only ever produce a
> `qc-submit`; the parent CLI re-runs every deterministic gate from scratch at finalize
> and computes the verdict, so a subagent CANNOT make a failing chapter publishable,
> and no subagent may attest, collect, finalize, promote, or edit.
>
> **Make independence EVIDENCE, not just a label (session ids).** Each reviewer subagent
> must `export CHAPTERFLOW_SESSION_ID=<unique-per-subagent>` before its `qc-submit` —
> e.g. `qc-keyA-<ts>`, `qc-keyB-<ts>`, `qc-bar-ch03-<ts>`, `qc-confirm-ch03-<ts>`,
> `qc-bar-ch03-t2-<ts>`. `qc-submit` captures that env value (NOT anything in the file)
> as the submission's `reviewerSessionId`. Fresh submissions are rejected if the env id is
> missing. Finalize then REQUIRES the sessions to differ: **keyA≠keyB, author≠sweep/bar/confirm,
> sweep≠bar/confirm, bar≠confirm, and bar≠each tiebreak variant.** Reuse one id across two
> roles and the round blocks with a self-diagnosing reason ("…SAME session…"). Missing
> legacy/unknown provenance also blocks publishable certification. This proves attributable
> procedural separation of local sessions, not cryptographic human identity.

**You are the head of QC, guarding the reader's trust.** Your job is genuine independence
(separate reviewers, honest reads) and reading the verdict correctly — not pushing the book
through. A REVISE you dispatch back is the system working, not a failure.

## How to read the finalize verdict and decide
- **`REPAIR REQUIRED`** → real defects. Open the printed `repair-prompt.md` in a fresh **Writer**
  session. Read its `affected chapters:` line — it is bucketed (`[edit]` / `[book-wide status]` /
  `[re-QC only]`). A **`CLASS DEFECT:`** banner means a defect repeats across sibling units (e.g.
  every `ifThenPlans` entry): tell the writer to fix the WHOLE class in the chapter CONTENT, not just
  the quoted units — fixing only the quoted ones leaves the siblings to re-fail next round. "At its
  source" means the chapter's own content/source case — NEVER pipeline code, gates, allocators, or
  config; the generated `repair-prompt.md` states this boundary.
- **A chapter REVISEs round after round, each time on a DIFFERENT axis** → the bar surfaces the
  single worst axis; fixing it uncovers the next-latent one. That is convergence, not a loop — keep
  repairing. But if the SAME finding survives 2 repairs with a genuine fix each time, the defect may
  be a research/source limitation; surface it rather than grinding.
- **`NEEDS_MORE_QC`** → a unit's submission is missing/stale (e.g. a bar subagent didn't submit).
  Re-spawn ONLY that unit against the SAME round; never fabricate a submission or force a pass.
- **`STALE_ROUND`** → chapters changed after the round opened. Start a FRESH round.
- After any repair, **run `qc-converge <bookId>` and fix everything it lists, in ONE pass, until it
  reports DETERMINISTIC-CLEAN** — it runs the SAME deterministic battery this finalize uses
  (source-v2, ship-gate, author-check, intra-book, book-gate, plan-enforcement) WITHOUT opening a
  round, so converging it locally means the next round can't bounce on a mechanical nit (em-dash,
  >34-word sentence, shape-plan slot, dangling anchor). THEN re-QC as a fresh **`--incremental`**
  round (only changed chapters are re-reviewed; already-PUBLISHABLE ones carry forward; the
  book-wide sweep still runs). Converging deterministically BEFORE the round is what keeps the
  repair loop from becoming a one-nit-per-round treadmill.

## 0. Setup
```bash
cd scripts/book/prompts/chapterflow-v21-authored
# Strict production gates (set for every NEW book; carried from research/write).
export CHAPTERFLOW_NO_API_CODEX_QC=1
export CHAPTERFLOW_REQUIRE_SOURCE_VERIFY=1
export CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE=1
export CHAPTERFLOW_SESSION_ID="qc-$(date +%Y%m%d%H%M%S)"   # different from the author session; each reviewer SUBAGENT overrides with its OWN unique id (see above)
```

## 1. Open the round
```bash
CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx src/cli.ts qc-auto "<book>" --pass --max-agents 6
```
First run prints `QC AUTO INCOMPLETE` + a **REVIEW-PACKET.md** path and a task-card
directory. Capture the **round id**. (If it prints `QC AUTO PASS`, you're done → step 6.
If `STALE_ROUND`, start a fresh round with the printed command.)

**Re-QC after a repair?** Use the command above only for a book's **first** QC round. A
repair changes chapters, so every re-QC is a **fresh round** — open it with `--incremental`
so it re-reviews ONLY the changed chapters and carries the already-PUBLISHABLE ones forward
(the book-wide sweep still runs over every chapter, so a new cross-chapter collision is still
caught):
```bash
CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx src/cli.ts qc-auto "<book>" --pass --incremental --max-agents 6
```
`--incremental` only matters at this open step; the resume/finalize commands below
(`--round <roundId>`) read the carried set from the round record automatically.

> Optional `--tiebreak`: add it to this open command for a variance-prone book (one that
> flaps REVISE/PASS at the 84/85 boundary on re-runs). A chapter whose first bar read lands
> borderline then gets 2 extra independent reads, combined by per-axis median — see Wave 3.5.
> Default off; everything below is unchanged when it's not set. (Composable with `--incremental`.)

Open REVIEW-PACKET.md once: it holds, for every QC unit, the exact `qc-submit` command
and a JSON skeleton whose `reviewer` is already the correct derived id and whose judgment
fields are placeholders that FAIL validation until filled from a real read.

## 2. Dispatch the read waves (respect the barriers)
Spawn subagents from the packet, never more than 6 at once. **Each subagent reviews ONE
unit, fills only its own skeleton from a real read, runs only its own `qc-submit`, and
copies the `reviewer` id from its skeleton verbatim.** Wait for each wave to finish
before the next.

> **Close each completed reviewer before spawning the next wave.** A finished subagent holds
> its concurrency slot until closed, so a later wave's spawn fails at the cap mid-wave. Close
> the wave's agents, then start the next. (A `npx tsx` sandbox IPC `listen EPERM` is the
> runner's temp socket — rerun the same command with escalation, it's not a QC failure.)

- **Wave 1 — sweep (1 agent, barrier):** the book-wide cross-chapter templating sweep
  (4 families). PASS only if none fire; REVISE/CORRUPTION need ≥1 quote-backed finding.
- **Wave 2 — keyA + keyB (2 agents, parallel):** two INDEPENDENT blind quiz-key
  derivations — each derives every answer from prompt + choices + source facts before
  looking at any stored key. (Their agreement vs the stored key is the wrong-key catch.)
- **Wave 3 — bar reads (≤6 agents, batched over the chapters):** one per chapter. Score
  each axis 0..1 from the read; any axis < 0.6 REQUIRES a cited verbatim hit. Reviewer id
  `codex-qc:<round>:bar:ch<NN>` (already in the skeleton).
- **Wave 3b — craft reads (≤6 agents, batched; the CRAFT READ, F6b):** one per chapter, only
  when `CHAPTERFLOW_CRAFT_READ != off` (default **shadow**). Score the five craft axes 0..1
  (`summaries_depth`, `tone_register`, `transfer_design`, `idea_density`, `limits_honesty`) —
  the ~64 rubric points the bar has no axis for. GREEN = weighted overall ≥ 75 AND every axis
  ≥ 0.6; NO corruption tier; any axis < 0.6 REQUIRES a cited hit `{unitId, quote, defect, fix}`.
  Score `tone_register` against the book's VOICE CARD (in the packet's craft section). Reviewer
  id `codex-qc:<round>:craft:ch<NN>` (already in the skeleton); submit `qc-craft-read-v1` with
  the round's **craft** token. Full anchors: `agent-prompts/CRAFT-READ-RUBRIC.md`. In **shadow**
  the craft read is recorded + surfaced as a NON-gating evidence column and NEVER changes a
  verdict; in **enforce** a below-floor chapter becomes REVISE (never CORRUPTION) with the hits
  as surgical repair directives; in **off** it does not run. A craft subagent must be a FRESH,
  separate session (its own `CHAPTERFLOW_SESSION_ID`), like every other reviewer.

## 3. Collect + select confirm candidates (parent — deterministic)
```bash
CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx src/cli.ts qc-auto "<book>" --pass --round <roundId>
```
This collects the submissions, re-runs the deterministic gates, and writes
`confirm-candidates.json` (the chapters on a publishable trajectory). Read that file.

**Wave 3.5 — tiebreak (only with `--tiebreak`, and only if the CLI asks).** When the round
was opened with `--tiebreak`, a chapter whose first bar read lands borderline (overall 83–87,
or an axis near the 0.6 floor) is held with a `tiebreak` blocker and the CLI writes
`task-cards/bar-tiebreak/chNN-t2.md` (+ `-t3.md`). Dispatch those as FRESH independent bar
reviewers (use the round's bar token; submit with `--variant t2` / `--variant t3`). They must
NOT read the first submission. The CLI combines all reads of that chapter by per-axis MEDIAN, so
one noisy sample can't flip the verdict (a cited corruption still RED-gates). Re-run collect; once
the tiebreak reads are in, the chapter resolves to a stable verdict. Skip this wave entirely if
no `bar-tiebreak` cards were written.

## 4. Wave 4 — confirm reads (≤6 agents, parallel; ONLY candidates)
For each chapter in `confirm-candidates.json`, spawn a confirm subagent (≤6 at once).
It is a SECOND independent read; decision = PUBLISHABLE / REVISE / CORRUPTION, with ≥1
quote-backed finding for non-PUBLISHABLE. Reviewer id `codex-qc:<round>:confirm:ch<NN>`
(already in the skeleton — distinct from that chapter's bar reviewer, so it counts).
Do NOT spawn confirm for chapters that aren't candidates (they're already blocked).

## 5. Finalize (parent — deterministic)
```bash
CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx src/cli.ts qc-auto "<book>" --pass --round <roundId>
```
Branch on the headline:
- **`QC AUTO PASS`** → go to step 6.
- **`QC AUTO INCOMPLETE`** (per-chapter reasons read `NEEDS_MORE_QC` — a unit missing or
  stale, e.g. a bar subagent didn't submit) → re-spawn ONLY those units against the SAME
  round (content hasn't changed), then re-run this finalize. Never fabricate a missing
  submission or force a pass.
- **`status: STALE_ROUND`** → a chapter changed after the round opened. Start a FRESH round
  (step 1); never finalize a stale round.
- **`QC AUTO REPAIR REQUIRED`** → real defects. Open the printed **repair-prompt.md** in a
  fresh **Writer** session (NOT this one, NOT a subagent — one session reviews OR edits,
  never both). The repair-prompt's `affected chapters:` line is bucketed: re-author the
  `[edit]` chapters, fix `[book-wide status]` patterns at their source (don't re-author each),
  and leave `[re-QC only]` chapters untouched. After the writer edits, run **`qc-converge <bookId>`
  until it reports DETERMINISTIC-CLEAN** (fix every finding in one pass — it mirrors finalize's
  deterministic gates, so a clean result means the next round won't bounce on a mechanical nit),
  THEN start a FRESH **`--incremental`** round (step 1).

## 6. On a full-book PASS — hand off (do NOT publish here)
Report the **round id** and `qc-status: PASS`, then tell the operator to open a NEW
session with `PUBLISH-AFTER-QC-CODEX-SESSION.md`:
```text
Finalize and publish <book> from QC round <roundId>. Commit and push.
```

## Rules (non-negotiable)
- ≤6 subagents at once. Each reviews exactly ONE unit and runs ONLY its own `qc-submit`.
- Subagents NEVER run `--collect`/`--finalize`/`qc-attest`/`promote-book`, never edit
  chapters, and never invent a reviewer id — they copy the one in their skeleton.
- The orchestrator never fabricates a submission for an absent subagent and never
  force-passes. Read content; submit honest results.
- No chapter edits while a round is in flight (it makes the round stale). Repair runs in a
  separate writer session AFTER finalize. Do not publish here — that is prompt 3.
