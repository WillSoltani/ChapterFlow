#!/usr/bin/env python3
from pathlib import Path
from tempfile import TemporaryDirectory
import subprocess, sys, json, shutil, os

if len(sys.argv) < 2:
    print("Usage: chapterflow_v20_smoke_test.py <pack-root>")
    sys.exit(2)
pack = Path(sys.argv[1]).resolve()
launch = pack / "launch.sh"
if not launch.exists():
    print("FAIL\nmissing launch.sh")
    sys.exit(1)
with TemporaryDirectory() as td:
    td = Path(td)
    target = td / 'scripts' / 'book' / 'prompts' / 'chapterflow-v20-sealed-worker'
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(pack, target)
    proc = subprocess.run(['bash', str(target/'launch.sh'), 'Smoke Book', 'Smoke Author'], cwd=td, capture_output=True, text=True)
    if proc.returncode != 0:
        print('FAIL')
        print(proc.stdout)
        print(proc.stderr)
        sys.exit(proc.returncode or 1)
    run_dirs = sorted((td/'.chapterflow'/'runs'/'smoke-book').glob('*'))
    if not run_dirs:
        print('FAIL\nrun root missing')
        sys.exit(1)
    run = run_dirs[-1]
    manifest = run/'manifests'/'run-manifest.json'
    prompt = run/'manifests'/'launch-prompt.txt'
    if not manifest.exists() or not prompt.exists():
        print('FAIL\nmanifest or launch prompt missing')
        sys.exit(1)
    data = json.loads(manifest.read_text(encoding='utf-8'))
    if data.get('bookId') != 'smoke-book':
        print('FAIL\nbookId mismatch')
        sys.exit(1)
    text = prompt.read_text(encoding='utf-8')
    required = [
        'Do not create content generator scripts.',
        'Do not generate the run tree from chapter metadata.',
        'If fresh worker sessions are unavailable, stop as blocked instead of simulating them.'
    ]
    missing = [r for r in required if r not in text]
    if missing:
        print('FAIL\nprompt missing anti-shortcut lines: ' + ', '.join(missing))
        sys.exit(1)
print('PASS')
