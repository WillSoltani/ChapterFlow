# ChapterFlow v21 Codex Agent Rules

You are operating in one role only. Never mix roles.

## Universal
- Run commands exactly from this directory:
  scripts/book/prompts/chapterflow-v21-authored
- Do not promote a book unless all no-API QC artifacts are fresh.
- In `CHAPTERFLOW_NO_API_CODEX_QC=1`, every QC action must belong to an opened
  `qc-open-round` round and use only the token for that role.
- Do not edit chapters during QC roles.
- Do not QC a chapter you authored or repaired.
- If a required command fails, report the failure; do not infer PASS.

## Writer role
- Read STEP-2-WRITE-CHAPTERS.md.
- Read the chapter's source-v2 sidecar.
- Use only the dealt name/shape/pedagogy/venue/exemplar plan.
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
