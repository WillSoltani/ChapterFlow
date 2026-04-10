#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: launch.sh \"Book Title\" \"Author Name\" [editionPreference]"
  exit 1
fi

TITLE="$1"
AUTHOR="$2"
EDITION_PREF="${3:-ask_if_ambiguous}"
PACK_ROOT="$(cd "$(dirname "$0")" && pwd)"

slugify() {
  python3 - <<'PY' "$1"
import re, sys, unicodedata
s = sys.argv[1]
s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode('ascii')
s = s.lower()
s = re.sub(r'[^a-z0-9]+', '-', s).strip('-')
print(s or 'book')
PY
}

BOOK_ID="$(slugify "$TITLE")"
RUN_ID="$(date -u +%Y%m%d-%H%M%S)"
RUN_ROOT=".chapterflow/runs/${BOOK_ID}/${RUN_ID}"

bash "${PACK_ROOT}/bootstrap.sh" "${PACK_ROOT}" "${BOOK_ID}" "${RUN_ID}"

MANIFEST="${RUN_ROOT}/manifests/run-manifest.json"
python3 - <<'PY' "$MANIFEST" "$BOOK_ID" "$RUN_ID" "$TITLE" "$AUTHOR" "$EDITION_PREF"
import json, sys
from pathlib import Path
manifest_path = Path(sys.argv[1])
book_id = sys.argv[2]
run_id = sys.argv[3]
title = sys.argv[4]
author = sys.argv[5]
edition_pref = sys.argv[6]
obj = json.loads(manifest_path.read_text(encoding='utf-8'))
obj['packVersion'] = 'v13-autonomous'
obj['bookId'] = book_id
obj['runId'] = run_id
obj['packRoot'] = 'scripts/book/prompts/chapterflow-v13-autonomous'
obj['runRoot'] = f'.chapterflow/runs/{book_id}/{run_id}'
obj['chapterGateMode'] = 'automatic_continue'
obj['sourceDiscoveryMode'] = 'web_bundle'
obj['editionSelectionMode'] = edition_pref
obj['bookRequest'] = {'title': title, 'author': author, 'editionPreference': edition_pref}
obj['book']['bookId'] = book_id
obj['book']['title'] = title
obj['book']['author'] = author
obj['book']['edition']['sourceText'] = f'.chapterflow/runs/{book_id}/{run_id}/source-freeze/book-source.txt'
manifest_path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
PY

LAUNCH_PROMPT="${RUN_ROOT}/manifests/launch-prompt.txt"
cat > "${LAUNCH_PROMPT}" <<EOF2
PACK_ROOT=scripts/book/prompts/chapterflow-v13-autonomous
RUN_ROOT=${RUN_ROOT}

You are running ChapterFlow v13 Autonomous inside this repo.

This is an execution task, not a planning task.
Do not switch into planning behavior.
Do not give me a plan unless I explicitly ask for one.
Start working immediately.

Read these files in order:
1. PACK_ROOT/README.md
2. PACK_ROOT/SCHEMA_NOTES.md
3. PACK_ROOT/MasterGenerator-v13.md
4. RUN_ROOT/manifests/run-manifest.json

Book:
- Title: ${TITLE}
- Author: ${AUTHOR}

Primary rule:
The MasterGenerator is the single workflow authority.
Follow it strictly for every chapter.
Do not optimize, compress, simplify, simulate, or reinterpret the workflow.

Non-negotiable anti-drift rules:
- No shortcuts.
- No bulk generation.
- No one-pass chapter generation.
- No “good enough” substitutes for required stages.
- No chapter may skip writer -> editor -> critic -> prose decision -> converter -> quiz -> validator.
- No validated chapter artifact may be created unless the full required chain for that chapter already exists.
- No review-package may wrap a partial chapter object. It must wrap the full validated chapter JSON.
- Do not continue to a later chapter if the current chapter has any missing, malformed, or partial required artifact.
- If you ever detect that you drifted from the MasterGenerator, stop immediately, repair the run state, and resume only from the corrected strict path.
- If any previously created artifact conflicts with the MasterGenerator, the MasterGenerator wins.

Source rules:
- Discover and freeze sources online before Chapter 1.
- Ask the user only if edition or translation ambiguity materially affects content.
- Do not ask for a source file.
- Use only frozen/authorized sources as the factual basis.
- Exact quotes are allowed only if directly supported by the frozen authorized preview.
- Otherwise remain paraphrase-first and narrower rather than speculative.

Chapter completion rule:
A chapter is not complete unless all of the following exist for that chapter and are internally consistent:
- brief
- outline
- quiz blueprint
- source sidecar text
- source sidecar json
- canonical draft
- edited draft
- critic report
- structured chapter json
- quiz json
- validation report
- validated chapter json
- validated review-package json
- reading metrics json
- continuity hash seal after validation passes

Required control loop for every chapter:
1. Create the required pre-writer artifacts first.
2. Do not start the writer until all pre-writer artifacts exist.
3. Complete the full chapter chain exactly as required by the MasterGenerator.
4. Before moving to the next chapter, verify that every required artifact for the current chapter exists on disk.
5. Run the chapter gate validation.
6. Seal the hash only after validation passes.
7. Only then continue.

Required control loop for waves:
- After Chapters 1 and 2 pass, continue automatically.
- Process remaining chapters in waves of 2 exactly as the manifest/pack requires.
- Before starting the next wave, verify the previous wave is fully clean.
- Run the repo artifact guard after each completed wave.
- If any chapter in a wave fails, repair it before continuing.

Required verification behavior:
- Do not assume a file is correct because it exists.
- Verify shape and completeness of chapter artifacts before proceeding.
- Review-package chapter payload must match the full validated chapter payload.
- Never silently tolerate partial wrappers, stub files, placeholder content, or malformed chapter objects.

Release rule:
- Assemble release output only from validated/*.chapter.json.
- Do not regenerate chapters during release assembly.
- Do not assemble from drafts, structured chapters, or partial artifacts.

Reporting behavior:
- Give short progress updates only.
- Do not stop after partial progress if the workflow can continue.
- Do not ask me whether to proceed unless you hit a true blocker that cannot be resolved locally.

Failure rule:
If you violate any rule above, your next action must be:
1. identify the exact deviation,
2. repair the run state,
3. re-run the relevant validations,
4. continue from the corrected strict path.

Begin now.
EOF2

cat <<EOF2
PACK_ROOT=${PACK_ROOT}
RUN_ROOT=${RUN_ROOT}
Manifest: ${MANIFEST}
Launch prompt: ${LAUNCH_PROMPT}
Next step: paste ${LAUNCH_PROMPT} into your coding-agent session.
EOF2
