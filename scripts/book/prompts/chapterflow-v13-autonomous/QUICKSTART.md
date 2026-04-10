# Quickstart

## 1) Install the pack

Copy this folder to:

`scripts/book/prompts/chapterflow-v13-autonomous/`

## 2) Audit the pack itself

```bash
python3 scripts/book/prompts/chapterflow-v13-autonomous/tools/chapterflow_v13_pack_audit.py \
  scripts/book/prompts/chapterflow-v13-autonomous
```

Require `FAIL=0`.

## 3) Launch a book run

```bash
bash scripts/book/prompts/chapterflow-v13-autonomous/launch.sh \
  "The Prince" \
  "Niccolò Machiavelli"
```

This creates a new run root automatically, for example:

`.chapterflow/runs/the-prince/20260406-013015/`

and writes:

- `RUN_ROOT/manifests/run-manifest.json`
- `RUN_ROOT/manifests/launch-prompt.txt`
- `RUN_ROOT/continuity/continuity-state.json`
- `RUN_ROOT/reports/run-log.md`

## 4) Review the manifest only if you want to override defaults

Open:

`RUN_ROOT/manifests/run-manifest.json`

Common optional changes:
- `runProfile`
- `waveSize`
- `editionPreference`
- `sourcePolicy`

Default autopilot settings are already filled.

## 5) Start the coding-agent run

Paste one file into the agent session:

`RUN_ROOT/manifests/launch-prompt.txt`

That prompt tells the agent to read the pack and continue automatically.

## 6) What happens next

The pipeline will:
1. discover candidate editions / translations online
2. ask you only if edition ambiguity materially affects the content
3. freeze the chosen source bundle into `source-freeze/`
4. build the skeleton
5. run Chapter 1 automatically through chapter gate
6. run Chapter 2 automatically through chapter gate
7. continue in waves with quality sentries
8. assemble the final release from validated chapters only

## 7) Before repo wiring

Run:

```bash
python3 scripts/book/prompts/chapterflow-v13-autonomous/tools/chapterflow_v13_artifact_guard.py \
  .chapterflow/runs/the-prince/20260406-013015

python3 scripts/book/prompts/chapterflow-v13-autonomous/tools/chapterflow_v13_release_guard.py \
  .chapterflow/runs/the-prince/20260406-013015 \
  .chapterflow/runs/the-prince/20260406-013015/release/the-prince.modern.json
```

Require `FAIL=0` for both.

Then run:

```bash
node scripts/book/validate-book.mjs book-packages/the-prince.modern.json
python3 scripts/book/prompts/chapterflow-v13-autonomous/tools/chapterflow_v13_lint.py \
  book-packages/the-prince.modern.json release_gate
npm run build
```
