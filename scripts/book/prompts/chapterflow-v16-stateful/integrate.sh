
#!/usr/bin/env bash
set -euo pipefail
if [ "$#" -lt 2 ]; then
  echo "Usage: integrate.sh <run_root> <repo_root>"
  exit 2
fi
RUN_ROOT="$1"
REPO_ROOT="$2"
BOOK_ID="$(python3 - <<'PY' "$RUN_ROOT"
import json, sys
from pathlib import Path
m=json.loads((Path(sys.argv[1])/'manifests'/'run-manifest.json').read_text())
print(m['bookId'])
PY
)"
mkdir -p "$REPO_ROOT/book-packages"
cp "$RUN_ROOT/release/$BOOK_ID.modern.json" "$REPO_ROOT/book-packages/$BOOK_ID.modern.json"
echo "Copied release package to book-packages/$BOOK_ID.modern.json"
echo "No cover generation performed."
