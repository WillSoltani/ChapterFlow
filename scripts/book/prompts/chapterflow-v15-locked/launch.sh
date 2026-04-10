#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo 'Usage: launch.sh "Book Title" "Author Name" ["Edition or translation hint"]'
  exit 1
fi

TITLE="$1"
AUTHOR="$2"
EDITION_HINT="${3:-}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(pwd)"
PACK_ROOT_REL="scripts/book/prompts/chapterflow-v15-locked"
PACK_ROOT="$ROOT/$PACK_ROOT_REL"

slugify() {
  python3 - "$1" <<'PY'
import re, sys, unicodedata
s = sys.argv[1]
s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
s = s.lower()
s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
print(s or "book")
PY
}

BOOK_ID="$(slugify "$TITLE")"
RUN_ID="$(date +%Y%m%d-%H%M%S)"
RUN_ROOT="$ROOT/.chapterflow/runs/$BOOK_ID/$RUN_ID"

mkdir -p \
  "$RUN_ROOT/manifests" \
  "$RUN_ROOT/source-freeze" \
  "$RUN_ROOT/sidecars" \
  "$RUN_ROOT/memory/role-cards" \
  "$RUN_ROOT/skeleton" \
  "$RUN_ROOT/briefs" \
  "$RUN_ROOT/outlines" \
  "$RUN_ROOT/quiz-blueprints" \
  "$RUN_ROOT/drafts/canonical" \
  "$RUN_ROOT/drafts/edited" \
  "$RUN_ROOT/structured" \
  "$RUN_ROOT/quizzes" \
  "$RUN_ROOT/validated" \
  "$RUN_ROOT/continuity" \
  "$RUN_ROOT/reports" \
  "$RUN_ROOT/release"

python3 - "$TITLE" "$AUTHOR" "$EDITION_HINT" "$BOOK_ID" "$RUN_ID" "$PACK_ROOT_REL" "$RUN_ROOT/manifests/run-manifest.json" <<'PY'
import json, pathlib, sys
title, author, edition_hint, book_id, run_id, pack_root, out_path = sys.argv[1:]
manifest = {
    "schemaVersion": "1.0",
    "title": title,
    "author": author,
    "requestedEdition": edition_hint or None,
    "requestedTranslation": None,
    "bookId": book_id,
    "runId": run_id,
    "packRoot": pack_root,
    "outputProfile": "flagship_v4_compatible",
    "learningContract": "research_native",
    "runProfile": "serial_safe",
    "validationMode": "autonomous_release",
    "chapterGateQuizMode": "generate",
    "scenarioTonePolicy": "required",
    "sourceDiscoveryMode": "web_first",
    "autoResolveEditionUnlessMaterial": True,
    "forbidBulkGenerators": True,
    "releaseAssembleFromValidatedOnly": True,
    "preserveCalibrationChapterHashes": True,
    "skipCoverGeneration": True,
    "manualCoverPath": None,
    "integrationEnabled": True,
    "cleanupEnabled": True,
    "notes": ""
}
pathlib.Path(out_path).write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
PY

cat > "$RUN_ROOT/manifests/launch-prompt.txt" <<EOF
PACK_ROOT = $PACK_ROOT_REL
RUN_ROOT = .chapterflow/runs/$BOOK_ID/$RUN_ID

You are running ChapterFlow v15 Locked inside a repo.

Resolve all static files from PACK_ROOT.
Resolve all generated artifacts from RUN_ROOT.
Do not mix them.

Read and follow these files in order:
1. PACK_ROOT/OPERATING_CONTRACT.md
2. PACK_ROOT/README.md
3. PACK_ROOT/SCHEMA_NOTES.md
4. PACK_ROOT/MasterGenerator-v15.md
5. RUN_ROOT/manifests/run-manifest.json

Critical reminders:
- ignore all legacy packs and all legacy generator scripts outside PACK_ROOT
- no human approval gates
- no content generator scripts
- no cover generation
- release must be assembled from validated chapter artifacts only

Run the full pipeline end-to-end for:
Title: $TITLE
Author: $AUTHOR
Edition hint: ${EDITION_HINT:-<none>}
EOF

echo "Created run at: $RUN_ROOT"
echo "Paste this into the agent:"
echo "  $RUN_ROOT/manifests/launch-prompt.txt"
