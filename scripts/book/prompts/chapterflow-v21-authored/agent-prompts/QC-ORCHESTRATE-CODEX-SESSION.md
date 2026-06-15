# QC — fanned-out orchestrator session (ChapterFlow v21)

Paste this whole file into a FRESH session. This session is a QC **orchestrator**: it
opens a round, then dispatches **up to 6 reviewer subagents at a time** (one QC unit
each), and lets the deterministic CLI collect + decide. It does NOT author, edit, or
publish. This is the parallel alternative to `QC-CODEX-SESSION.md`; same trust model,
more throughput.

When the operator says **`QC <book>`** — do exactly this.

> Trust model (don't subvert it): the per-unit reviewer ids are PRE-DERIVED in the
> review packet (`codex-qc:<round>:<role>:ch<NN>`), so a chapter's bar and confirm
> reviewers differ BY CONSTRUCTION — that's what lets a confirm read count as an
> independent second reviewer. Subagents only ever produce a `qc-submit`; the parent
> CLI re-runs every deterministic gate from scratch at finalize and computes the
> verdict. A subagent therefore CANNOT make a failing chapter publishable, and no
> subagent may attest, collect, finalize, promote, or edit.

## 0. Setup
```bash
cd scripts/book/prompts/chapterflow-v21-authored
export CHAPTERFLOW_NO_API_CODEX_QC=1
export CHAPTERFLOW_SESSION_ID="qc-$(date +%Y%m%d%H%M%S)"   # different from the author session
```

## 1. Open the round
```bash
CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx src/cli.ts qc-auto "<book>" --pass --max-agents 6
```
First run prints `QC AUTO INCOMPLETE` + a **REVIEW-PACKET.md** path and a task-card
directory. Capture the **round id**. (If it prints `QC AUTO PASS`, you're done → step 6.
If `STALE_ROUND`, start a fresh round with the printed command.)

Open REVIEW-PACKET.md once: it holds, for every QC unit, the exact `qc-submit` command
and a JSON skeleton whose `reviewer` is already the correct derived id and whose judgment
fields are placeholders that FAIL validation until filled from a real read.

## 2. Dispatch the read waves (respect the barriers)
Spawn subagents from the packet, never more than 6 at once. **Each subagent reviews ONE
unit, fills only its own skeleton from a real read, runs only its own `qc-submit`, and
copies the `reviewer` id from its skeleton verbatim.** Wait for each wave to finish
before the next.

- **Wave 1 — sweep (1 agent, barrier):** the book-wide cross-chapter templating sweep
  (4 families). PASS only if none fire; REVISE/CORRUPTION need ≥1 quote-backed finding.
- **Wave 2 — keyA + keyB (2 agents, parallel):** two INDEPENDENT blind quiz-key
  derivations — each derives every answer from prompt + choices + source facts before
  looking at any stored key. (Their agreement vs the stored key is the wrong-key catch.)
- **Wave 3 — bar reads (≤6 agents, batched over the chapters):** one per chapter. Score
  each axis 0..1 from the read; any axis < 0.6 REQUIRES a cited verbatim hit. Reviewer id
  `codex-qc:<round>:bar:ch<NN>` (already in the skeleton).

## 3. Collect + select confirm candidates (parent — deterministic)
```bash
CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx src/cli.ts qc-auto "<book>" --pass --round <roundId>
```
This collects the submissions, re-runs the deterministic gates, and writes
`confirm-candidates.json` (the chapters on a publishable trajectory). Read that file.

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
- **`NEEDS_MORE_QC`** → it lists which units are missing/stale (e.g. a bar subagent didn't
  submit). Re-spawn ONLY those units against the SAME round (content hasn't changed), then
  re-run this finalize. Never fabricate a missing submission or force a pass.
- **`QC AUTO REPAIR REQUIRED`** → real defects. Open the printed **repair-prompt.md** in a
  fresh **Writer** session (NOT this one, NOT a subagent — one session reviews OR edits,
  never both). After the writer edits, the round is stale → start a FRESH round (step 1).

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
