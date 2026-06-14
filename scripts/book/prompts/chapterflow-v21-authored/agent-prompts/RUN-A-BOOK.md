# Run a book end-to-end — three prompts (ChapterFlow v21)

A book ships in **three phases**. Each phase is **one prompt pasted into one FRESH
session**. Paste them in order; each phase tells you when it's done and which prompt
comes next. You never have to remember the step order.

| # | Phase | Paste this file | Say to the agent | It stops at |
|---|-------|-----------------|------------------|-------------|
| 1 | Research + write | `GENERATE-A-BOOK-CODEX-SESSION.md` | `Generate the book <book>` | `phase: qc` — every chapter gate-clean |
| 2 | QC | `QC-CODEX-SESSION.md` | `QC <book>` | `QC AUTO PASS` — every chapter PUBLISHABLE (copy the round id it prints) |
| 3 | Commit + push + publish | `PUBLISH-AFTER-QC-CODEX-SESSION.md` | `Finalize and publish <book> from QC round <roundId>. Commit and push.` | package written, committed, pushed |

## What each phase does
1. **Generate** — runs the status-driven loop (research → write → gate). It never QCs
   or publishes; it stops at `phase: qc` and hands off to prompt 2.
2. **QC** — opens a QC round, you review every chapter honestly and submit, and
   `qc-auto` converges to `QC AUTO PASS`. It does **not** publish. On PASS it prints the
   round id and the exact prompt-3 command. If it says **REPAIR REQUIRED**, it hands a
   repair prompt to a writer session and you re-QC — nothing ships until a clean
   full-book PASS.
3. **Finalize** — confirms the round still passes, promotes the book to a package,
   cleans up one-time QC artifacts, then **commits and pushes**. This is the **only**
   step that writes to git/remote — nothing auto-publishes or auto-pushes before it.

## The rule that ties them together
Each phase is a **fresh, independent session**. Don't generate + QC in one session
(the author must not grade its own work), and don't publish from the QC session (the
publisher acts on a finished round, not on its own grading). The three sessions are the
three checks.

## If something goes sideways
- Prompt 2 says **STALE_ROUND** → chapters changed after the round opened. Start a fresh
  round (the printed command). Never publish a stale round.
- Prompt 2 says **REPAIR REQUIRED** → open the printed repair prompt in a fresh *writer*
  session, fix the named fields, then re-run prompt 2 (a fresh round).
- Prompt 3 dry-run **blocks** → it prints the failed check + a resume command. Fix and
  re-run; it physically cannot ship a book that hasn't passed QC.
