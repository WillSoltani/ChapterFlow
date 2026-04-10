#!/usr/bin/env python3
import sys, shutil
from pathlib import Path

KEEP = {
    'release',
    'manifests',
    'source-freeze',
    'validated',
    'reports',
}
REMOVE = [
    'drafts',
    'outlines',
    'quiz-blueprints',
    'structured',
    'quizzes',
    'briefs',
    'sidecars/tmp',
]

def main(run_root):
    run = Path(run_root)
    removed = []
    for name in REMOVE:
        p = run/name
        if p.exists():
            if p.is_dir():
                shutil.rmtree(p)
            else:
                p.unlink()
            removed.append(str(p))
    print("PASS")
    for r in removed:
        print(f"removed {r}")

if __name__ == '__main__':
    if len(sys.argv) != 2:
        print("Usage: chapterflow_v14_cleanup.py RUN_ROOT")
        raise SystemExit(2)
    main(sys.argv[1])
