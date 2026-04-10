# ChapterFlow v13 Autonomous

ChapterFlow v13 Autonomous keeps the quality core that worked in v12, but smooths the operation in three ways:

- **Web-first source discovery.** You no longer need to pre-populate a source folder. The run discovers the book on the web, locks an edition or translation, freezes the usable source bundle, and then writes chapter-local sidecars.
- **No manual Chapter 1 pause.** Chapter 1 still passes an internal chapter gate, but it no longer waits for human approval. If it passes, the run continues automatically. If it fails, it repairs locally or stops as a true blocker.
- **One low-friction launcher.** Your only required inputs are **book title** and **author**. The launcher creates the run, prefills the manifest, and generates a single `launch-prompt.txt` you paste into the coding agent.

## What stays the same

v13 keeps the parts that made ChapterFlow good:
- prose first, schema later
- dossier / brief as factual truth
- edited draft as prose truth
- writer -> editor -> critic -> converter -> quiz -> validator -> patch / repair
- no downstream invention beyond the brief
- release assembled from validated chapters only
- no bulk generators and no content-writing repo scripts

## What changes from v12

### 1. Source discovery is built in
The pack now assumes **no user-provided raw source file**. Instead it requires:
- `manifests/source-ledger.json`
- `manifests/edition-lock.json`
- `source-freeze/` with frozen source material
- `sidecars/source/chXX.source.txt`
- `sidecars/source/chXX.source.json`

The orchestrator must discover candidate editions/translations on the web, choose or confirm the correct one, and freeze the source bundle before writing Chapter 1.

### 2. Chapter gate is automatic, not manual
The human approval stop is gone.

The new rule is:
- Chapter 1 must pass the chapter gate automatically.
- Chapter 2 must also pass the chapter gate automatically.
- Chapters 1 and 2 become the **baseline quality floor** for later waves.
- Later waves stop only if a real blocker appears or quality decays beyond the configured threshold.

### 3. The launch path is simpler
The recommended entry is now:

```bash
bash scripts/book/prompts/chapterflow-v13-autonomous/launch.sh "The Prince" "Niccolò Machiavelli"
```

That command:
- generates a slugged `bookId`
- creates a timestamped `runId`
- bootstraps the run root
- prefills `run-manifest.json`
- writes `launch-prompt.txt`

Then you paste only:

`RUN_ROOT/manifests/launch-prompt.txt`

## Default operating policy

Unless the run manifest overrides it:
- `outputProfile = flagship_v4_compatible`
- `learningContract = research_native`
- `runProfile = balanced_flagship`
- `validationMode = chapter_gate`
- `chapterGateMode = automatic_continue`
- `chapterGateQuizMode = generate`
- `scenarioTonePolicy = required`
- `sourceDiscoveryMode = web_bundle`
- `editionSelectionMode = ask_if_ambiguous`
- `sourcePolicy = public_or_authorized_plus_secondary`
- `forbidBulkGenerators = true`
- `releaseAssembleFromValidatedOnly = true`
- `preserveApprovedChapterHashes = true`
- `sourceFreezeRequired = true`
- `artifactGuardRequired = true`
- `releaseGuardRequired = true`
- `qualitySentryRequired = true`

## Core folders

Install the static pack at:

`scripts/book/prompts/chapterflow-v13-autonomous/`

Create one durable run root per book:

`.chapterflow/runs/{bookId}/{runId}/`

No separate user-managed source folder is required.
The run freezes source material inside:

`.chapterflow/runs/{bookId}/{runId}/source-freeze/`

## Minimum run sequence

1. Install the pack
2. Run `tools/chapterflow_v13_pack_audit.py`
3. Run `launch.sh "Book Title" "Author Name"`
4. Paste `RUN_ROOT/manifests/launch-prompt.txt` into the coding agent
5. Let the run discover sources, lock the edition, and generate Chapter 1 and Chapter 2 automatically
6. Continue in waves until release gate
7. Run repo wiring and build only after release gate passes

See:
- `QUICKSTART.md`
- `INSTALL.md`
- `REPO_RUNBOOK.md`
- `SCHEMA_NOTES.md`
- `FINAL_CHECKLIST.md`
- `TROUBLESHOOTING.md`
