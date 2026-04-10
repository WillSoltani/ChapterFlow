#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 2 ]; then
  echo "Usage: bash launch.sh \"<Title>\" \"<Author>\""
  exit 1
fi

TITLE="$1"
AUTHOR="$2"
ROOT="$(pwd)"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PACK_ROOT="scripts/book/prompts/chapterflow-v19-sealed-provenance"
RUN_ID="$(date +%Y%m%d-%H%M%S)"

BOOK_ID="$(python3 - <<'PY' "$TITLE"
import re, sys
s = sys.argv[1].lower().strip()
s = re.sub(r"['’]", '', s)
s = re.sub(r'[^a-z0-9]+', '-', s)
s = re.sub(r'-+', '-', s).strip('-')
print(s or 'book')
PY
)"

RUN_ROOT=".chapterflow/runs/${BOOK_ID}/${RUN_ID}"
mkdir -p "$RUN_ROOT"/{manifests,reports,source-freeze,sidecars,continuity,memory,memory/role-cards,skeleton,briefs,outlines,quiz-blueprints,drafts/canonical,drafts/edited,partials,structured,quizzes,validated,commits,receipts,release,tickets,work-orders}

python3 - <<'PY' "$TITLE" "$AUTHOR" "$BOOK_ID" "$RUN_ID" "$PACK_ROOT" "$RUN_ROOT"
import json, sys
(title, author, book_id, run_id, pack_root, run_root) = sys.argv[1:7]
manifest = {
  "title": title,
  "author": author,
  "bookId": book_id,
  "runId": run_id,
  "packRoot": pack_root,
  "runRoot": run_root,
  "outputProfile": "flagship_v4_compatible",
  "learningContract": "research_native",
  "runProfile": "director_workers_provenance",
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
  "sourceSufficiencyPolicy": "full_fidelity_or_block",
  "integrationMode": "outside_core_pipeline"
}
with open(f"{run_root}/manifests/run-manifest.json", "w", encoding="utf-8") as f:
    json.dump(manifest, f, indent=2, ensure_ascii=False)
    f.write("\n")
PY

python3 - <<'PY' "$SCRIPT_DIR" "$PACK_ROOT" "$RUN_ROOT"
from pathlib import Path
import sys
script_dir, pack_root, run_root = sys.argv[1:4]
starter = Path(script_dir, 'PROMPT_STARTER.txt').read_text(encoding='utf-8').rstrip()
prompt = f"{starter}\n\nPACK_ROOT={pack_root}\nRUN_ROOT={run_root}\n\nRead in order:\n1. {pack_root}/README.md\n2. {pack_root}/OPERATING_CONTRACT.md\n3. {pack_root}/ARCHITECTURE.md\n4. {pack_root}/MasterDirector-v19.md\n5. {run_root}/manifests/run-manifest.json\n\nThen run the Director workflow exactly as written.\n"
Path(run_root, 'manifests', 'launch-prompt.txt').write_text(prompt, encoding='utf-8')
PY

echo "RUN_ROOT=${RUN_ROOT}"
echo "Launch prompt written to ${RUN_ROOT}/manifests/launch-prompt.txt"
