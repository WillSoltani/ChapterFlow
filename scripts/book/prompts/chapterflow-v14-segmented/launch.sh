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
obj['packVersion'] = 'v14-segmented'
obj['bookId'] = book_id
obj['runId'] = run_id
obj['packRoot'] = 'scripts/book/prompts/chapterflow-v14-segmented'
obj['runRoot'] = f'.chapterflow/runs/{book_id}/{run_id}'
obj['bookRequest'] = {'title': title, 'author': author, 'editionPreference': edition_pref}
obj['book']['bookId'] = book_id
obj['book']['title'] = title
obj['book']['author'] = author
obj['chapterGateMode'] = 'automatic_continue'
obj['validationMode'] = 'core_pipeline_gate'
obj['sourceDiscoveryMode'] = 'web_bundle'
obj['editionSelectionMode'] = edition_pref
obj['book']['edition']['sourceText'] = f'.chapterflow/runs/{book_id}/{run_id}/source-freeze/book-source.txt'
manifest_path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
PY

LAUNCH_PROMPT="${RUN_ROOT}/manifests/launch-prompt.txt"
cat > "${LAUNCH_PROMPT}" <<EOF2
PACK_ROOT=scripts/book/prompts/chapterflow-v14-segmented
RUN_ROOT=${RUN_ROOT}

You are running ChapterFlow v14 Segmented Autonomous inside this repo.

Read these files in order:
1. PACK_ROOT/README.md
2. PACK_ROOT/SCHEMA_NOTES.md
3. PACK_ROOT/PIPELINE_BOUNDARY.md
4. PACK_ROOT/MasterGenerator-v14.md
5. RUN_ROOT/manifests/run-manifest.json

Already supplied by the user:
- Title: ${TITLE}
- Author: ${AUTHOR}

Autonomy rules:
- Discover and freeze sources online before Chapter 1.
- Ask the user only if edition or translation ambiguity materially affects chapter structure or meaning.
- Continue automatically from Chapter 1 through the final book package.
- Stop the core pipeline only on a true blocker.
- Do not ask for source files or manual approval.
- Do not create bulk generators.
- Assemble the release from validated chapters only.
- Treat app registration, cover work, build fixes, and UI verification as post-pipeline integration, not core pipeline work.
EOF2

cat <<EOF2
PACK_ROOT=${PACK_ROOT}
RUN_ROOT=${RUN_ROOT}
Manifest: ${MANIFEST}
Launch prompt: ${LAUNCH_PROMPT}
Next step: paste ${LAUNCH_PROMPT} into your coding-agent session.
EOF2
