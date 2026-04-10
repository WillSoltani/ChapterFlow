#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: cleanup.sh RUN_ROOT"
  exit 1
fi

RUN_ROOT="$1"
python3 "$(dirname "$0")/tools/chapterflow_v14_cleanup.py" "$RUN_ROOT"
