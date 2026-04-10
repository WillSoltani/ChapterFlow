Chapter-gate requirements

Required artifacts:
- brief
- outline
- quiz blueprint
- canonical draft
- edited draft
- critic report
- structured chapter
- quiz
- validation report
- validated chapter
- review package
- reading metrics
- source sidecar

Chapter gate is passed only if:
- critic score >= 10/12
- no chapter-quality auto-fails
- no contamination phrases in reader-facing content
- no scenario string violations
- no empty quiz when quiz mode is generate
- no identical tone objects in required fields
- source sidecar exists and matches the frozen source bundle

If `chapterGateMode = automatic_continue`, the run proceeds without waiting for user approval.
