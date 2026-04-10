#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: $0 \"Book Title\" \"Author\""
  exit 1
fi

TITLE="$1"
AUTHOR="$2"
ROOT="$(pwd)"
PACK_ROOT="scripts/book/prompts/chapterflow-v18-director-worker-complete"

slugify() {
python3 - "$1" <<'PY'
import re, sys, unicodedata
s = unicodedata.normalize("NFKD", sys.argv[1]).encode("ascii","ignore").decode("ascii")
s = re.sub(r"[^A-Za-z0-9]+", "-", s).strip("-").lower()
print(s)
PY
}

BOOK_ID="$(slugify "$TITLE")"
RUN_ID="$(date +%Y%m%d-%H%M%S)"
RUN_ROOT=".chapterflow/runs/${BOOK_ID}/${RUN_ID}"

mkdir -p "$RUN_ROOT"/{manifests,memory,memory/role-cards,skeleton,briefs,outlines,quiz-blueprints,example-blueprints,drafts/canonical,drafts/edited,structured,quizzes,validated,continuity,reports,sidecars,release,source-freeze,tickets,workers,commits}

python3 - "$TITLE" "$AUTHOR" "$BOOK_ID" "$RUN_ID" "$PACK_ROOT" "$RUN_ROOT" <<'PY'
import json, sys
title, author, book_id, run_id, pack_root, run_root = sys.argv[1:7]
manifest = {
  "title": title,
  "author": author,
  "bookId": book_id,
  "runId": run_id,
  "packRoot": pack_root,
  "runRoot": run_root,
  "outputProfile": "flagship_v4_compatible",
  "learningContract": "research_native",
  "runProfile": "director_workers_parallel",
  "validationMode": "chapter_gate",
  "chapterGateQuizMode": "generate",
  "scenarioTonePolicy": "required",
  "waveDefaultWidth": 6,
  "calibrationChapters": [1,2],
  "forbidBulkGenerators": True,
  "releaseAssembleFromValidatedOnly": True,
  "preserveCommittedHashes": True,
  "sourceDiscoveryMode": "web_first",
  "coverPolicy": "manual_none",
  "askOnlyOnMaterialEditionAmbiguity": True,
  "book": {
    "bookId": book_id,
    "title": title,
    "author": author,
    "variantFamily": "EMH"
  }
}
with open(f"{run_root}/manifests/run-manifest.json","w",encoding="utf-8") as f:
    json.dump(manifest,f,indent=2)
PY

cat > "$RUN_ROOT/manifests/launch-prompt.txt" <<EOF
PACK_ROOT=${PACK_ROOT}
RUN_ROOT=${RUN_ROOT}

Read in order:
1. ${PACK_ROOT}/README.md
2. ${PACK_ROOT}/OPERATING_CONTRACT.md
3. ${PACK_ROOT}/ARCHITECTURE.md
4. ${PACK_ROOT}/MasterDirector-v18.md
5. ${RUN_ROOT}/manifests/run-manifest.json

Then run the Director workflow exactly as written.
EOF

echo "Created run at $RUN_ROOT"
echo "Paste $RUN_ROOT/manifests/launch-prompt.txt into the Director chat."
