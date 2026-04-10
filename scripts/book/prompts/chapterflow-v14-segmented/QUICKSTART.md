# Quickstart

## 1. Install the pack
Copy this directory into your repo at:

`scripts/book/prompts/chapterflow-v14-segmented/`

## 2. Audit the pack
```bash
python3 scripts/book/prompts/chapterflow-v14-segmented/tools/chapterflow_v14_pack_audit.py   scripts/book/prompts/chapterflow-v14-segmented
```

## 3. Launch a run
```bash
bash scripts/book/prompts/chapterflow-v14-segmented/launch.sh   "The Prince"   "Niccolò Machiavelli"
```

## 4. Paste the generated launch prompt
Paste:

`RUN_ROOT/manifests/launch-prompt.txt`

into your coding-agent session.

## 5. Core pipeline finishes here
The core pipeline should end at:
- final validated book JSON package
- release guard passing

## 6. Optional next steps
Only after core success:
- post-pipeline integration
- cleanup
