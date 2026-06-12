# QC Auto Codex Session — ChapterFlow v21.3

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
9. Do not run `promote-book`.
10. Do not fake subagent outputs, waive findings silently, or force pass.

If all selected chapters pass, report:
- `roundId`
- number of attestations written
- `qc-status` command/result

If repair is required, report:
- repair prompt path
- short summary of REVISE/CORRUPTION findings
- exact instruction: paste the repair prompt into a fresh Writer Codex session

If incomplete, report:
- missing artifacts/submissions
- exact resume command:

```bash
CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx src/cli.ts qc-auto "<bookId>" --pass --round <roundId>
```
