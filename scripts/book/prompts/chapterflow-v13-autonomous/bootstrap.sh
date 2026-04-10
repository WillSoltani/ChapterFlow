#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 3 ]; then
  echo "Usage: bootstrap.sh PACK_ROOT BOOK_ID RUN_ID"
  exit 1
fi

PACK_ROOT="$1"
BOOK_ID="$2"
RUN_ID="$3"
RUN_ROOT=".chapterflow/runs/${BOOK_ID}/${RUN_ID}"

mkdir -p "${RUN_ROOT}"/{manifests,memory,memory/role-cards,skeleton,source-freeze,briefs,outlines,quiz-blueprints,drafts/canonical,drafts/edited,structured,quizzes,validated,continuity,reports,sidecars,sidecars/source,release}

if [ ! -f "${RUN_ROOT}/manifests/run-manifest.json" ]; then
  cp "${PACK_ROOT}/briefs/run-manifest-template.json" "${RUN_ROOT}/manifests/run-manifest.json"
fi

if [ ! -f "${RUN_ROOT}/continuity/continuity-state.json" ]; then
  cat > "${RUN_ROOT}/continuity/continuity-state.json" <<'JSON'
{
  "nameUsage": {},
  "formatCategoryHistory": [],
  "schoolSettingUsage": {},
  "wordFrequency": {},
  "phraseFrequency": {},
  "openerRegistry": { "gentle": {}, "direct": {}, "competitive": {} },
  "titleTemplateRegistry": {},
  "endingPatternRegistry": {},
  "withinChapterNames": {},
  "approvedChapterHashes": {},
  "baselineQuality": {}
}
JSON
fi

if [ ! -f "${RUN_ROOT}/reports/run-log.md" ]; then
  cat > "${RUN_ROOT}/reports/run-log.md" <<'MD'
# Run Log
MD
fi

echo "PACK_ROOT=${PACK_ROOT}"
echo "RUN_ROOT=${RUN_ROOT}"
echo "Run manifest created at ${RUN_ROOT}/manifests/run-manifest.json"
