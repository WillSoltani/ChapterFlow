#!/usr/bin/env python3
import json, sys, hashlib, subprocess
from pathlib import Path
from datetime import datetime, timezone

def sha(path):
    h = hashlib.sha256()
    with open(path,'rb') as f:
        for chunk in iter(lambda: f.read(65536), b''):
            h.update(chunk)
    return h.hexdigest()

def main():
    if len(sys.argv) != 3:
        print('Usage: chapterflow_v19_commit.py <run_root> <chapter_code like ch03>')
        raise SystemExit(1)
    run_root = Path(sys.argv[1])
    ch = sys.argv[2]
    pack_root = Path(__file__).resolve().parents[1]
    subprocess.run([sys.executable, str(pack_root/'tools/chapterflow_v19_provenance_guard.py'), str(run_root), ch], check=True)
    subprocess.run([sys.executable, str(pack_root/'tools/chapterflow_v19_artifact_guard.py'), str(run_root), f'validated/{ch}.chapter.json'], check=True)
    val = run_root / 'validated' / f'{ch}.chapter.json'
    commit_dir = run_root / 'commits'
    commit_dir.mkdir(parents=True, exist_ok=True)
    rec = {
        'schemaVersion': '1.0.0',
        'chapter': ch,
        'createdAt': datetime.now(timezone.utc).isoformat(),
        'validatedPath': str(val.relative_to(run_root)),
        'validatedSha256': sha(val),
        'reviewPackagePath': str((run_root/'validated'/f'{ch}.review-package.json').relative_to(run_root)) if (run_root/'validated'/f'{ch}.review-package.json').exists() else None,
    }
    (commit_dir/f'{ch}.commit.json').write_text(json.dumps(rec, indent=2, ensure_ascii=False)+'\n', encoding='utf-8')
    state_path = run_root / 'manifests' / 'state.json'
    state = {'history': []}
    if state_path.exists():
        try:
            state = json.loads(state_path.read_text(encoding='utf-8'))
        except Exception:
            state = {'history': []}
    state.setdefault('history', []).append({'event':'chapter_committed','chapter':ch,'at':rec['createdAt']})
    state['lastCommittedChapter'] = ch
    state_path.write_text(json.dumps(state, indent=2, ensure_ascii=False)+'\n', encoding='utf-8')
    print('PASS')
    print(f'Committed {ch}')

if __name__ == '__main__':
    main()
