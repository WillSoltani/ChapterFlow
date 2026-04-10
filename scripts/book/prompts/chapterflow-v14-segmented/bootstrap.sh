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

mkdir -p "${RUN_ROOT}"/manifests
mkdir -p "${RUN_ROOT}"/memory/role-cards
mkdir -p "${RUN_ROOT}"/skeleton
mkdir -p "${RUN_ROOT}"/source-freeze
mkdir -p "${RUN_ROOT}"/briefs
mkdir -p "${RUN_ROOT}"/outlines
mkdir -p "${RUN_ROOT}"/quiz-blueprints
mkdir -p "${RUN_ROOT}"/drafts/canonical
mkdir -p "${RUN_ROOT}"/drafts/edited
mkdir -p "${RUN_ROOT}"/structured
mkdir -p "${RUN_ROOT}"/quizzes
mkdir -p "${RUN_ROOT}"/validated
mkdir -p "${RUN_ROOT}"/continuity
mkdir -p "${RUN_ROOT}"/reports
mkdir -p "${RUN_ROOT}"/sidecars/source
mkdir -p "${RUN_ROOT}"/release

MANIFEST="${RUN_ROOT}/manifests/run-manifest.json"
if [ ! -f "${MANIFEST}" ]; then
  cp "${PACK_ROOT}/briefs/run-manifest-template.json" "${MANIFEST}"
fi

echo "PACK_ROOT=${PACK_ROOT}"
echo "RUN_ROOT=${RUN_ROOT}"
echo "Manifest=${MANIFEST}"
