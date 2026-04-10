
# Quickstart

## 1) Install the pack

Place this directory at:

`scripts/book/prompts/chapterflow-v16-stateful/`

## 2) Audit the pack

```bash
python3 scripts/book/prompts/chapterflow-v16-stateful/tools/chapterflow_v16_pack_audit.py   scripts/book/prompts/chapterflow-v16-stateful
```

## 3) Launch a run

```bash
bash scripts/book/prompts/chapterflow-v16-stateful/launch.sh   "The Prince"   "Niccolò Machiavelli"
```

## 4) Paste the launch prompt

Paste:

`RUN_ROOT/manifests/launch-prompt.txt`

into the coding-agent session.

## 5) Let the agent follow the ticket loop

The agent should:

1. read `OPERATING_CONTRACT.md`
2. read `MasterGenerator-v16.md`
3. read `RUN_ROOT/manifests/run-manifest.json`
4. read `RUN_ROOT/state/current-ticket.md`
5. perform only that ticket
6. run the commit script
7. repeat with the newly written ticket

The agent must not try to remember the whole book in chat memory.
