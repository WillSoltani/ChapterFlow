#!/usr/bin/env python3
from pathlib import Path
import sys, json, hashlib

def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

if len(sys.argv) < 3:
    print('Usage: chapterflow_v20_provenance_guard.py <run-root> <chapter-id>')
    sys.exit(2)
run = Path(sys.argv[1])
ch = sys.argv[2]
required = {
    'brief': run/f'briefs/{ch}.md',
    'outline': run/f'outlines/{ch}.md',
    'canonical': run/f'drafts/canonical/{ch}.md',
    'edited': run/f'drafts/edited/{ch}.md',
    'critic': run/f'reports/{ch}.critic.md',
    'structure': run/f'partials/{ch}.structure.json',
    'examples': run/f'partials/{ch}.examples.json',
    'assembled': run/f'structured/{ch}.chapter.json',
    'quiz': run/f'quizzes/{ch}.quiz.json',
    'validation': run/f'reports/{ch}.validation.md',
    'validated': run/f'validated/{ch}.chapter.json',
}
missing = [name for name,p in required.items() if not p.exists()]
if missing:
    print('FAIL')
    for m in missing: print('missing', m)
    sys.exit(1)
canon = required['canonical'].read_text(encoding='utf-8', errors='ignore')
if '"chapterId"' in canon or canon.lstrip().startswith('{'):
    print('FAIL')
    print('canonical_looks_like_json')
    sys.exit(1)
if sha(required['canonical']) == sha(required['edited']):
    print('FAIL')
    print('edited_identical_to_canonical')
    sys.exit(1)
sp = json.loads(required['structure'].read_text(encoding='utf-8'))
if 'examples' in sp or 'quiz' in sp:
    print('FAIL')
    print('structure_partial_contains_forbidden_sections')
    sys.exit(1)
xp = json.loads(required['examples'].read_text(encoding='utf-8'))
if not isinstance(xp, list):
    print('FAIL')
    print('examples_partial_not_list')
    sys.exit(1)
for stage in ['writer','editor','critic','structure','scenario','assembler','quiz','validator']:
    rp = run/f'receipts/{ch}.{stage}.receipt.json'
    if not rp.exists():
        print('FAIL')
        print('missing_receipt', stage)
        sys.exit(1)
    data = json.loads(rp.read_text(encoding='utf-8'))
    if data.get('chapterId') != ch or data.get('stage') != stage:
        print('FAIL')
        print('bad_receipt', stage)
        sys.exit(1)
print('PASS')
