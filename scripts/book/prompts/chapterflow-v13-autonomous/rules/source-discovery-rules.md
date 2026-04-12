# Source discovery rules

Goal: build a lawful, high-signal source bundle from the internet without requiring a user-populated source folder.

## Required artifacts
Write before any chapter work:
- `manifests/source-ledger.json`
- `manifests/edition-lock.json`
- refreshed `manifests/run-manifest.json` `book` metadata after the edition decision is locked
- `source-freeze/source-discovery.md`
- `source-freeze/source-freeze-report.md`
- `source-freeze/toc.json`
- `sidecars/source/source-heading-index.json`

## Source ladder
Prefer sources in this order:
1. full public-domain text
2. official / authorized digital text or sample
3. official table of contents / chapter listing
4. reputable secondary sources for chapter interpretation
5. chapter-specific reference material when needed

## Rules
- Freeze the chosen source bundle inside `RUN_ROOT/source-freeze/`.
- Record every source used in `source-ledger.json` with title, type, role, confidence, and notes.
- Record the chosen edition / translation in `edition-lock.json`.
- After the edition is locked, refresh `run-manifest.json.book` from the frozen source metadata.
- Do not leave launch-placeholder book metadata in place once title, author, edition details, categories, tags, and chapter scope are known.
- If the text is public domain and complete, save it locally into the source freeze.
- If the text is not fully available, save the preview or sample plus the chapter map and secondary research bundle.
- Use paraphrase-first unless exact quote support is verified in the frozen source.
- If a claim cannot be supported by the frozen source bundle, exclude it or narrow it.
- Do not use obvious pirate mirrors or unauthorized reposts.
- Do not let source discovery drift into vague “I found enough” language. Freeze and document the bundle.
