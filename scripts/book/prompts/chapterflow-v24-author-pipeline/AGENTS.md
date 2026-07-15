# ChapterFlow v24 Codex Agent Rules

You are operating in one role only. Never mix roles.

## Universal
- Before any pipeline command or file operation, enter the active pipeline root:
  `cd "$(git rev-parse --show-toplevel)/scripts/book/prompts/chapterflow-v24-author-pipeline"`.
- Stay in that directory and use only package-relative paths: `src/cli.ts`,
  `.chapterflow/**`, `state/**`, and `book-packages/**`.
- Never run a pipeline command from the outer repository root, never point
  `CHAPTERFLOW_STATE_DIR` at the outer `state/`, and never write chapters or
  run artifacts outside this pipeline directory. The outer repository contains
  shadow `state/` and `.chapterflow/` directories that are not authoritative.
- Do not promote a book unless all no-API QC artifacts are fresh.
- In `CHAPTERFLOW_NO_API_CODEX_QC=1`, every QC action must belong to an opened
  `qc-open-round` round and use only the token for that role.
- Do not edit chapters during QC roles.
- Do not QC a chapter you authored or repaired.
- If a required command fails, report the failure; do not infer PASS.
- No more than one repair loop may run without `qc-diagnose <bookId> --round <roundId>`.
- After repair changes chapter content, do not resume the old QC round for
  publishability; start a fresh `qc-auto "<bookId>" --pass` round.

## Writer role
- Read `agent-prompts/STEP-2-WRITE-CHAPTERS.md`.
- Read the chapter's source-v2 sidecar.
- Use only the dealt name/shape/pedagogy/venue/exemplar plan.
- Chapter Format v25 (docs/v25/CHAPTER_FORMAT_V25.md) applies to every new
  chapter: each read tier stands alone (the app shows a reader exactly one);
  every quiz question carries choiceRationales (one per choice) and a revisit
  pointer to a real component. The gate blocks a missing feedback block
  (F25.quiz_feedback).
- Save the chapter.
- Run author-check and gate-chapter until both are clean.
- Never run qc-attest, key-derive, sweep-attest, or promote-book.

## QC roles
- You must be a fresh session.
- You must use the role token supplied by the operator.
- You must not edit chapter files.
- You must cite exact units and quotes for every defect.
- A missing read is never a pass.
- A partial answer file is never a pass.
- A master QC orchestrator may coordinate subagents and write attestations only
  through `qc-orchestrate --finalize`. It may not directly edit chapters,
  override evidence, silently waive findings, or force pass.

## Key Reader role
- Read only key-pack blind files and source facts.
- Do not open state/chapters directly.
- Derive every answer before any reveal.
- Output one answer per question with confidence and sourceFactIds.

## Bar/Confirm role
- Apply publishableBar axes mechanically.
- One corruption hit red-gates the chapter.
- Overall <85 or any axis <0.6 is REVISE.
- Prefer `bar-pack` + `bar-attest` for full-book batch attestation when the
  book is large; it reduces command repetition but still requires every axis
  for every chapter.

## Confirm role
- Use the confirm token only for final attestation/disposition decisions.
- Never waive a current major without a concrete reason tied to the finding id.

## Publish-after-QC role
- You may finalize/promote/register only after `qc-auto`/`qc-status` prove the
  selected book is publishable.
- You must not edit chapter files.
- You must not run `qc-attest` manually.
- You must not bypass no-api QC blockers.
- You must clean token-bearing task cards before commit.
- You may delete one-time repair prompts after clean publish.
- You must preserve durable evidence by default: qc attestations,
  manual-keyjudge records, sweep record, evidence matrix, and final book package.
- You may commit and push only after validation passes.
