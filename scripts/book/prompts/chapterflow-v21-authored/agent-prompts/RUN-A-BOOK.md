# Run a book end-to-end — four prompts (ChapterFlow v21)

A book ships in **four phases**. Each phase is **one prompt pasted into one FRESH
session**. Paste them in order; each phase tells you when it's done and which prompt
comes next. You never have to remember the step order.

| # | Phase | Paste this file | Say to the agent | It stops at |
|---|-------|-----------------|------------------|-------------|
| 1 | Research | `RESEARCH-CODEX-SESSION.md` | `Research the book <book>` | `phase: write-chapter` — index + every source sidecar exist |
| 2 | Write | `WRITE-ORCHESTRATE-CODEX-SESSION.md` | `Write the book <book>` | `phase: qc` — every chapter gate-clean + book-gate clean AND self-scored on the 8-axis publishable bar (`publishable-rubric`); gate-clean alone does NOT predict the QC verdict |
| 3 | QC | `QC-ORCHESTRATE-CODEX-SESSION.md` | `QC <book>` | `QC AUTO PASS` — every chapter PUBLISHABLE (copy the round id) |
| 4 | Commit + push + publish | `PUBLISH-AFTER-QC-CODEX-SESSION.md` | `Finalize and publish <book> from QC round <roundId>. Commit and push.` | package written, committed, pushed |

## What each phase does
1. **Research** — produces the frozen bibliography + per-chapter source-v2 sidecars + the
   chapter index. The grounded material everything is authored FROM. Stops at the write handoff.
2. **Write** — the orchestrator deals the pre-authoring plans (names, scene shapes, venues,
   pedagogy, exemplars, rhetoric, answer-key), dispatches **≤6 writer subagents at a time**
   (one chapter each from its own source, self-gating), runs the `book-gate` barrier, and
   re-dispatches only the chapters that fail. It never QCs or publishes; stops at `phase: qc`.
3. **QC** — the orchestrator opens a round and dispatches **≤6 reviewer subagents** (sweep →
   keyA+keyB → bar/chapter → confirm/candidate). The deterministic CLI collects + decides.
   It does **not** publish. On PASS it prints the round id + the exact phase-4 command. If it
   says **REPAIR REQUIRED**, the repair goes to a fresh *writer* session and you re-QC — nothing
   ships until a clean full-book PASS.
4. **Finalize** — confirms the round still passes, promotes the book to a package, cleans up
   one-time QC artifacts, then **commits and pushes**. This is the **only** step that writes to
   git/remote — nothing auto-publishes or auto-pushes before it.

## Single-session fallbacks (no subagents)
If your harness can't spawn subagents, the sequential single-session prompts still work:
- `GENERATE-A-BOOK-CODEX-SESSION.md` (`Generate the book <book>`) does research **and** write
  in one status-driven loop, stopping at `phase: qc`.
- `QC-CODEX-SESSION.md` (`QC <book>`) does the whole QC round in one reviewer session.
Same trust boundaries, same stop points — just no fan-out.

## The rule that ties them together
Each phase is a **fresh, independent session**: research ≠ writer ≠ reviewer ≠ publisher.
The author must not grade its own work, and the publisher acts on a finished round, not its
own grading. Within the write and QC phases, a subagent does ONE unit and never crosses roles
(a writer never QCs; a reviewer never edits or certifies its own read).

## If something goes sideways
- Phase 2 `book-gate` barrier keeps failing the SAME book-wide blocker for 3 re-dispatch
  rounds → it's a Step-1 source problem, not authoring. Stop and fix research (phase 1).
- Phase 3 says **NEEDS_MORE_QC** → a unit's submission is missing/stale; re-spawn ONLY that
  unit against the same round, then re-finalize. Never force a pass.
- Phase 3 says **STALE_ROUND** → chapters changed after the round opened. Start a fresh round.
- Phase 3 says **REPAIR REQUIRED** → open the printed repair prompt in a fresh *writer*
  session, fix the named fields, then re-run phase 3 (a fresh round).
- Phase 4 dry-run **blocks** → it prints the failed check + a resume command. Fix and re-run;
  it physically cannot ship a book that hasn't passed QC.
