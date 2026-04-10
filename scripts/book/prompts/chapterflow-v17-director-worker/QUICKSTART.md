# Quickstart

## 1) Install the pack
Copy this folder into your repo at:

```text
scripts/book/prompts/chapterflow-v17-director-worker/
```

## 2) Audit the pack
```bash
python3 scripts/book/prompts/chapterflow-v17-director-worker/tools/chapterflow_v17_pack_audit.py   scripts/book/prompts/chapterflow-v17-director-worker
```

Require zero audit failures.

## 3) Launch a run
```bash
bash scripts/book/prompts/chapterflow-v17-director-worker/launch.sh   "The Prince"   "Niccolò Machiavelli"
```

This creates:

```text
.chapterflow/runs/the-prince/<runId>/
```

and writes:

```text
RUN_ROOT/manifests/launch-prompt.txt
```

## 4) Start the Director session
Paste the full contents of `launch-prompt.txt` into one fresh GPT-5.4 High / Codex session.

## 5) Let the Director run
The Director will:
- discover and freeze sources
- create the skeleton
- build and commit Chapters 1 and 2 as calibration chapters
- lock the calibration baseline
- continue remaining chapters in waves
- assemble the release only from committed validated chapters

## 6) Before each wave commit
Run the artifact guard:

```bash
python3 scripts/book/prompts/chapterflow-v17-director-worker/tools/chapterflow_v17_artifact_guard.py   .chapterflow/runs/the-prince/<runId>
```

## 7) Before release
Run the release guard:

```bash
python3 scripts/book/prompts/chapterflow-v17-director-worker/tools/chapterflow_v17_release_guard.py   .chapterflow/runs/the-prince/<runId>
```

## Defaults
- default wave width: 6 chapters
- calibration chapters: 1 and 2
- no manual approval stop
- no cover generation
