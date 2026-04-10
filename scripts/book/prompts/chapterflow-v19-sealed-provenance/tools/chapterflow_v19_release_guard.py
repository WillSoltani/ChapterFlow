#!/usr/bin/env python3
import json, sys
from pathlib import Path

def main():
    if len(sys.argv) != 3:
        print('Usage: chapterflow_v19_release_guard.py <run_root> <release_json_rel_or_abs>')
        raise SystemExit(1)
    run_root = Path(sys.argv[1])
    p = Path(sys.argv[2])
    if not p.is_absolute():
        p = run_root / p
    release = json.loads(p.read_text(encoding='utf-8'))
    fails = []
    chapters = release.get('chapters') or []
    commit_dir = run_root / 'commits'
    if not chapters:
        fails.append('release has no chapters')
    for ch in chapters:
        num = ch.get('number')
        code = f'ch{int(num):02d}' if isinstance(num, int) else None
        commit_path = commit_dir / f'{code}.commit.json'
        if not commit_path.exists():
            fails.append(f'missing commit record for {code}')
            continue
        commit = json.loads(commit_path.read_text(encoding='utf-8'))
        val_path = run_root / commit['validatedPath']
        if not val_path.exists():
            fails.append(f'missing validated file for {code}')
            continue
        val = json.loads(val_path.read_text(encoding='utf-8'))
        if val != ch:
            fails.append(f'release chapter {code} does not exactly match committed validated chapter')
    if fails:
        print('FAIL')
        for f in fails:
            print(f'- {f}')
        raise SystemExit(1)
    print('PASS')

if __name__ == '__main__':
    main()
