#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: launch.sh \"Book Title\" \"Author Name\""
  exit 2
fi

TITLE="$1"
AUTHOR="$2"

ROOT="$(pwd)"
PACK_ROOT="scripts/book/prompts/chapterflow-v17-director-worker"
BOOK_ID="$(printf '%s' "$TITLE" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]\+/-/g; s/^-//; s/-$//')"
RUN_ID="$(date +%Y%m%d-%H%M%S)"
RUN_ROOT=".chapterflow/runs/${BOOK_ID}/${RUN_ID}"

mkdir -p "${RUN_ROOT}"/{manifests,state,memory,source-freeze,sidecars,skeleton,briefs,outlines,quiz-blueprints,tickets,work-orders,drafts/canonical,drafts/edited,structured,quizzes,validated,continuity,commits,reports,release}

python3 - "$TITLE" "$AUTHOR" "$BOOK_ID" "$RUN_ID" "$PACK_ROOT" "$RUN_ROOT" > "${RUN_ROOT}/manifests/run-manifest.json" <<'PY'
import json
import sys

title, author, book_id, run_id, pack_root, run_root = sys.argv[1:]

manifest = {
    "title": title,
    "author": author,
    "bookId": book_id,
    "runId": run_id,
    "packRoot": pack_root,
    "runRoot": run_root,
    "outputProfile": "flagship_v4_compatible",
    "learningContract": "research_native",
    "runProfile": "director_workers_balanced",
    "validationMode": "chapter_gate",
    "chapterGateQuizMode": "generate",
    "scenarioTonePolicy": "required",
    "waveDefaultWidth": 6,
    "calibrationChapters": [1, 2],
    "forbidBulkGenerators": True,
    "releaseAssembleFromValidatedOnly": True,
    "preserveCommittedHashes": True,
    "sourceDiscoveryMode": "web_first",
    "coverPolicy": "manual_user_supplied_none_generated",
    "askOnlyOnMaterialEditionAmbiguity": True,
}

json.dump(manifest, sys.stdout, ensure_ascii=False, indent=2)
sys.stdout.write("\n")
PY

cat > "${RUN_ROOT}/state/pipeline-state.json" <<JSON
{
  "currentState": "preflight",
  "completedChapters": [],
  "currentWave": 0,
  "queuedChapters": [],
  "committedHashes": {},
  "calibrationLocked": false,
  "sourceFreezeLocked": false,
  "releaseAssembled": false,
  "releaseValidated": false
}
JSON

cat > "${RUN_ROOT}/manifests/launch-prompt.txt" <<TXT
PACK_ROOT = ${PACK_ROOT}
RUN_ROOT = ${RUN_ROOT}

Read and follow in order:
1. ${PACK_ROOT}/README.md
2. ${PACK_ROOT}/OPERATING_CONTRACT.md
3. ${PACK_ROOT}/STATE_MACHINE.md
4. ${PACK_ROOT}/MasterDirector-v17.md
5. ${RUN_ROOT}/manifests/run-manifest.json

Non-negotiables:
- You are the Director, not the chapter writer.
- Heavy chapter work must be done by workers from chapter-local work orders.
- No bulk generators.
- No human approval stops.
- Release assembled from committed validated chapters only.
- No cover generation.

Start at Phase 0.
TXT

echo "RUN_ROOT=${RUN_ROOT}"
echo "${RUN_ROOT}/manifests/launch-prompt.txt"
