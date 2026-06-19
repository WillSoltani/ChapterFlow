# Book Autopilot — one-sentence, end-to-end book generation (Codex)

Paste this whole file into a FRESH Codex session. This session is a **thin trigger**:
its only job is to run the deterministic `book-autopilot` conductor and report. The
conductor (code, not you) sequences the phases and spawns fresh `codex exec`
sub-sessions for the actual work — research, per-chapter authoring, QC review,
repair. **You do not author, review, or decide repair-vs-publish yourself.**

## Setup
```bash
cd scripts/book/prompts/chapterflow-v21-authored
export CHAPTERFLOW_NO_API_CODEX_QC=1
export CHAPTERFLOW_REQUIRE_SOURCE_VERIFY=1
export CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE=1
# The conductor shells out to `codex exec` for every unit of model work — all on
# your Codex subscription, NO API metering. If `codex` is not on PATH, set:
#   export CHAPTERFLOW_CODEX_BIN=/path/to/codex
```

## Run it
```bash
# Preview first (no work spawned): what phase the book is in + how many codex
# sessions a full run would spawn.
npx tsx src/cli.ts book-autopilot <bookId> --plan

# Then run it end-to-end and walk away:
npx tsx src/cli.ts book-autopilot <bookId>
```

That's the whole task. The conductor will, in order:
- **research** → spawn one codex session (the RESEARCH playbook) until research artifacts exist;
- **write** → deal dispatch cards (`fanout`) and spawn one writer session per missing chapter (parallel, each a distinct session id), self-gating as it goes;
- **gate** → converge the deterministic gates (`qc-converge`), spawning a repair session if dirty;
- **qc** → open a round, spawn independent reviewer sessions per task card (keyA ≠ keyB ≠ bar ≠ confirm ≠ author), finalize; on REVISE it runs `qc-diagnose`, spawns ONE repair session, re-converges, and re-QCs — up to **3** rounds;
- **ready to publish** → it STOPS and prints the passed round id + the publish command.

## What to do with the result
- **`AUTOPILOT — <book>: READY TO PUBLISH …`** → review the evidence, then ship yourself:
  `npx tsx src/cli.ts publish-after-qc "<bookId>" --round <roundId> --commit --push`
  (Publish is human-gated by design. To let the autopilot promote — still no commit/push —
  re-run with `--auto-publish`.)
- **`AUTOPILOT HALT — … [phase X]: <reason>`** → the conductor stopped on purpose (a stuck
  finding, a major needing your disposition, gates still dirty after 3 rounds, or no progress).
  Read the reason, fix/decide what it names, then re-run `book-autopilot <bookId>` — it RESUMES
  from the current phase (finished chapters are skipped).

## Guarantees the conductor enforces (you don't need to police these)
- **No API metering** — every model call is a `codex exec` session on the subscription.
- **Author ≠ reviewer** — each spawn carries a distinct `CHAPTERFLOW_SESSION_ID`; finalize
  REVISE-rejects any collision, so a book can never be self-graded.
- **Bounded + honest** — ≤3 repair rounds; it HALTs (never grinds, never auto-waives a major,
  never force-passes).
- **Publish stays yours** — it halts at "ready to publish" unless you pass `--auto-publish`.
