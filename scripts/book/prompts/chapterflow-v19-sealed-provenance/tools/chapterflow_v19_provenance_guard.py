#!/usr/bin/env python3
import json, sys, hashlib
from pathlib import Path

STAGES = [
    ('writer', 'drafts/canonical/{ch}.md'),
    ('editor', 'drafts/edited/{ch}.md'),
    ('critic', 'reports/{ch}.critic.md'),
    ('structure', 'partials/{ch}.structure.json'),
    ('scenario', 'partials/{ch}.examples.json'),
    ('assembler', 'structured/{ch}.chapter.json'),
    ('quiz', 'quizzes/{ch}.quiz.json'),
    ('validator', 'validated/{ch}.chapter.json'),
]
RECEIPTS = 'receipts/{ch}/{stage}.json'
REQS = [
    'briefs/{ch}.md','outlines/{ch}.md','quiz-blueprints/{ch}.md','tickets/{ch}.md'
]

def sha(path):
    h = hashlib.sha256()
    with open(path,'rb') as f:
        for chunk in iter(lambda: f.read(65536), b''):
            h.update(chunk)
    return h.hexdigest()

def main():
    if len(sys.argv) != 3:
        print('Usage: chapterflow_v19_provenance_guard.py <run_root> <chapter_code like ch03>')
        raise SystemExit(1)
    run_root = Path(sys.argv[1])
    ch = sys.argv[2]
    fails = []
    for patt in REQS:
        p = run_root / patt.format(ch=ch)
        if not p.exists():
            fails.append(f'missing required file {p.relative_to(run_root)}')
    for stage, outpatt in STAGES:
        outp = run_root / outpatt.format(ch=ch)
        recp = run_root / RECEIPTS.format(ch=ch, stage=stage)
        if not outp.exists():
            fails.append(f'missing stage output {outp.relative_to(run_root)}')
            continue
        if not recp.exists():
            fails.append(f'missing receipt {recp.relative_to(run_root)}')
            continue
        try:
            rec = json.loads(recp.read_text(encoding='utf-8'))
        except Exception as e:
            fails.append(f'bad receipt json {recp.relative_to(run_root)}: {e}')
            continue
        if rec.get('stage') != stage:
            fails.append(f'receipt stage mismatch in {recp.relative_to(run_root)}')
        outputs = rec.get('outputFiles') or []
        found = False
        actual_sha = sha(outp)
        rel_out = str(outp.relative_to(run_root))
        for item in outputs:
            if item.get('path') == rel_out:
                found = True
                if item.get('sha256') != actual_sha:
                    fails.append(f'output hash mismatch for {rel_out}')
        if not found:
            fails.append(f'output path missing from receipt {recp.relative_to(run_root)}')
    if fails:
        print('FAIL')
        for f in fails:
            print(f'- {f}')
        raise SystemExit(1)
    print('PASS')

if __name__ == '__main__':
    main()
