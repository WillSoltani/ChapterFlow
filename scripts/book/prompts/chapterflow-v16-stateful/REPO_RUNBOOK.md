
# Repo Runbook

## Start

```bash
python3 scripts/book/prompts/chapterflow-v16-stateful/tools/chapterflow_v16_pack_audit.py   scripts/book/prompts/chapterflow-v16-stateful

bash scripts/book/prompts/chapterflow-v16-stateful/launch.sh   "Book Title"   "Author Name"
```

Open:

`RUN_ROOT/manifests/launch-prompt.txt`

Paste that into the coding-agent session.

## The stateful rule

The agent must not continue from chat memory alone.
Before every chapter it must read:

- `RUN_ROOT/state/current-ticket.md`
- `RUN_ROOT/state/book-state.json`
- `RUN_ROOT/continuity/continuity-state.json`
- `RUN_ROOT/memory/style-memory.md`
- `RUN_ROOT/memory/quality-memory.md`
- `RUN_ROOT/memory/role-cards/*.md`
- `RUN_ROOT/state/calibration-lock.json` after Chapter 2

## Commit after every ticket

After the agent finishes the current ticket, it must run:

```bash
python3 PACK_ROOT/tools/chapterflow_v16_commit.py PACK_ROOT RUN_ROOT
```

The commit script:
- checks required outputs for the current stage
- runs artifact guard when appropriate
- updates state
- writes the next ticket

## End of run

After all chapters validate, assemble release:

```bash
python3 PACK_ROOT/tools/chapterflow_v16_build_release.py PACK_ROOT RUN_ROOT
python3 PACK_ROOT/tools/chapterflow_v16_release_guard.py RUN_ROOT release/{bookId}.modern.json
```

Optional repo integration may happen after release guard, but cover generation is out of scope by default.
