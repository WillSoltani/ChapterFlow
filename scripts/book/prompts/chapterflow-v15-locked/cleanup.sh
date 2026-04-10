#!/usr/bin/env bash
set -euo pipefail
if [ "$#" -lt 1 ]; then
  echo 'Usage: cleanup.sh RUN_ROOT'
  exit 1
fi
RUN_ROOT="$1"

for sub in drafts/canonical drafts/edited outlines quiz-blueprints; do
  if [ -d "$RUN_ROOT/$sub" ]; then
    find "$RUN_ROOT/$sub" -type f -delete
  fi
done

echo "Cleanup complete for $RUN_ROOT"
