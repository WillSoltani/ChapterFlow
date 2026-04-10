
#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: launch.sh <book title> <author>"
  exit 2
fi

TITLE="$1"
AUTHOR="$2"

PACK_ROOT="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(pwd)"

slugify() {
  python3 - "$1" <<'PY'
import re, sys, unicodedata
s = unicodedata.normalize("NFKD", sys.argv[1]).encode("ascii","ignore").decode("ascii")
s = s.lower()
s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
print(s)
PY
}

BOOK_ID="$(slugify "$TITLE")"
RUN_ID="$(date +%Y%m%d-%H%M%S)"
RUN_ROOT="$REPO_ROOT/.chapterflow/runs/$BOOK_ID/$RUN_ID"

mkdir -p "$RUN_ROOT"/{manifests,memory/role-cards,skeleton,source-freeze/source-bundle,sidecars/source,briefs,outlines,quiz-blueprints,drafts/canonical,drafts/edited,structured,quizzes,validated,continuity,reports,release,state,tickets}

python3 - "$PACK_ROOT" "$RUN_ROOT" "$TITLE" "$AUTHOR" "$BOOK_ID" "$RUN_ID" <<'PY'
import json, sys
from pathlib import Path
pack_root, run_root, title, author, book_id, run_id = sys.argv[1:]
tmpl = json.loads((Path(pack_root)/"briefs"/"run-manifest-template.json").read_text())
tmpl["title"] = title
tmpl["author"] = author
tmpl["bookId"] = book_id
tmpl["runId"] = run_id
(Path(run_root)/"manifests"/"run-manifest.json").write_text(json.dumps(tmpl, indent=2) + "\n")
book_state = {
    "title": title,
    "author": author,
    "bookId": book_id,
    "runId": run_id,
    "currentStage": "source_discovery",
    "chapterCount": 0,
    "completedChapters": [],
    "validatedChapterHashes": {},
    "calibrationLocked": False,
    "forbidBulkGenerators": True,
    "releaseAssembleFromValidatedOnly": True
}
(Path(run_root)/"state"/"book-state.json").write_text(json.dumps(book_state, indent=2) + "\n")
current_task = {"stage": "source_discovery"}
(Path(run_root)/"state"/"current-task.json").write_text(json.dumps(current_task, indent=2) + "\n")
continuity = {
    "nameUsage": {},
    "formatCategoryHistory": [],
    "schoolSettingUsage": {},
    "wordFrequency": {},
    "phraseFrequency": {},
    "openerRegistry": {"gentle": {}, "direct": {}, "competitive": {}},
    "titleTemplateRegistry": {},
    "endingPatternRegistry": {},
    "withinChapterNames": {}
}
(Path(run_root)/"continuity"/"continuity-state.json").write_text(json.dumps(continuity, indent=2) + "\n")
(Path(run_root)/"state"/"calibration-lock.json").write_text(json.dumps({}, indent=2) + "\n")
PY

python3 "$PACK_ROOT/tools/chapterflow_v16_dispatch.py" "$PACK_ROOT" "$RUN_ROOT" >/dev/null

cat > "$RUN_ROOT/manifests/launch-prompt.txt" <<EOF
PACK_ROOT=$PACK_ROOT
RUN_ROOT=$RUN_ROOT

You are running ChapterFlow v16 Stateful inside a repo.

Read in this order:
1. \$PACK_ROOT/OPERATING_CONTRACT.md
2. \$PACK_ROOT/MasterGenerator-v16.md
3. \$RUN_ROOT/manifests/run-manifest.json
4. \$RUN_ROOT/state/current-ticket.md

Then do only the current ticket.
When the ticket is complete, run:
python3 \$PACK_ROOT/tools/chapterflow_v16_commit.py \$PACK_ROOT \$RUN_ROOT

Then reread \$RUN_ROOT/state/current-ticket.md and continue until the stage becomes complete.

Do not create or use any content generator scripts.
Do not rely on chat memory for the full run.
EOF

echo "RUN_ROOT=$RUN_ROOT"
echo "Paste: $RUN_ROOT/manifests/launch-prompt.txt"
