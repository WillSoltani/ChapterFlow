#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: integrate.sh RUN_ROOT REPO_ROOT"
  exit 1
fi

RUN_ROOT="$1"
REPO_ROOT="$2"

echo "Post-pipeline integration should start only after core release guard passes."
echo "RUN_ROOT=${RUN_ROOT}"
echo "REPO_ROOT=${REPO_ROOT}"
echo "Tasks may include app registration, metadata wiring, cover mapping, build, and product verification."
