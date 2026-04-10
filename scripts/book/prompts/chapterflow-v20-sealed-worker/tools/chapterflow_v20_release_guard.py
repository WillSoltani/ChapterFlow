#!/usr/bin/env python3
from pathlib import Path
import json, sys
if len(sys.argv) < 3:
    print('Usage: chapterflow_v20_release_guard.py <run-root> <release-json>')
    sys.exit(2)
run = Path(sys.argv[1]); release = Path(sys.argv[2])
rel = json.loads(release.read_text(encoding='utf-8'))
errors = []
for ch in rel.get('chapters', []):
    num = ch.get('number')
    cid = ch.get('chapterId')
    vpath = run/f'validated/ch{num:02d}.chapter.json'
    cpath = run/f'commits/ch{num:02d}.commit.json'
    if not vpath.exists():
        errors.append(f'missing_validated_for_{cid}')
        continue
    if not cpath.exists():
        errors.append(f'missing_commit_for_{cid}')
        continue
    vobj = json.loads(vpath.read_text(encoding='utf-8'))
    if ch != vobj:
        errors.append(f'release_mismatch_{cid}')
if errors:
    print('FAIL')
    for e in errors: print(e)
    sys.exit(1)
print('PASS')
