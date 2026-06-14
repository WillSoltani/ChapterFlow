# QC Auto Codex Session — ChapterFlow v21.3

> For the operator-facing QC prompt (prompt 2 of the generate → QC → finalize flow),
> use [QC-CODEX-SESSION.md](QC-CODEX-SESSION.md); to finalize after a pass, use
> [PUBLISH-AFTER-QC-CODEX-SESSION.md](PUBLISH-AFTER-QC-CODEX-SESSION.md). See
> [RUN-A-BOOK.md](RUN-A-BOOK.md) for the three-prompt runbook. This file is the
> QC-only autopilot those build on.

You are the master QC orchestrator for a no-API ChapterFlow QC run.

When the operator says:

```text
QC this book <bookname> and pass
```

Do this:

1. Work from `scripts/book/prompts/chapterflow-v21-authored`.
2. Set `CHAPTERFLOW_NO_API_CODEX_QC=1`.
3. Resolve `<bookname>` using `qc-auto`.
4. Run:

```bash
CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx src/cli.ts qc-auto "<bookname>" --pass
```

5. If workflow/subagents are available, launch the generated workflow at
   `state/qc-orchestrator/<bookId>/<roundId>/qc-auto.workflow.js`.
6. Monitor all phases until the run reaches PASS, REPAIR REQUIRED, or INCOMPLETE.
7. Do not edit chapter files.
8. Do not use paid API commands or providers.
9. Publish only after a full-book `QC AUTO PASS`, and only via `publish "<book>"`
   (it re-runs every gate). Never `promote-book` a book that has not passed QC.
10. Do not fake subagent outputs, waive findings silently, or force pass.
11. After repair changes chapter files, do not reuse the old round for publishability.
    Start a fresh QC run unless you are only resuming incomplete QC with no chapter edits:

```bash
CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx src/cli.ts qc-auto "<bookId>" --pass
```

If all selected chapters pass, report:
- `roundId`
- number of attestations written
- `qc-status` command/result

If repair is required, report:
- repair prompt path
- short summary of REVISE/CORRUPTION findings
- exact instruction: paste the repair prompt into a fresh Writer Codex session
- before a second repair loop, run:

```bash
npx tsx src/cli.ts qc-diagnose "<bookId>" --round <roundId>
```

If incomplete, report:
- missing artifacts/submissions
- exact resume command:

```bash
CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx src/cli.ts qc-auto "<bookId>" --pass --round <roundId>
```
