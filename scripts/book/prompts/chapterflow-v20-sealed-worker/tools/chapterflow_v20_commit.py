#!/usr/bin/env python3
from pathlib import Path
import json, sys, hashlib, subprocess

def sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()
if len(sys.argv) < 3:
    print('Usage: chapterflow_v20_commit.py <run-root> <chapter-id>')
    sys.exit(2)
run = Path(sys.argv[1]); ch = sys.argv[2]
prov = subprocess.run([sys.executable, str(Path(__file__).with_name('chapterflow_v20_provenance_guard.py')), str(run), ch], capture_output=True, text=True)
if prov.returncode != 0:
    print(prov.stdout)
    sys.exit(prov.returncode)
val_path = run/f'validated/{ch}.chapter.json'
art = subprocess.run([sys.executable, str(Path(__file__).with_name('chapterflow_v20_artifact_guard.py')), str(val_path)], capture_output=True, text=True)
if art.returncode != 0:
    print(art.stdout)
    sys.exit(art.returncode)
commit = {
  'chapterId': ch,
  'validatedHash': sha(val_path),
  'artifacts': {
    'brief': sha(run/f'briefs/{ch}.md'),
    'outline': sha(run/f'outlines/{ch}.md'),
    'canonical': sha(run/f'drafts/canonical/{ch}.md'),
    'edited': sha(run/f'drafts/edited/{ch}.md'),
    'critic': sha(run/f'reports/{ch}.critic.md'),
    'structure': sha(run/f'partials/{ch}.structure.json'),
    'examples': sha(run/f'partials/{ch}.examples.json'),
    'assembled': sha(run/f'structured/{ch}.chapter.json'),
    'quiz': sha(run/f'quizzes/{ch}.quiz.json'),
    'validation': sha(run/f'reports/{ch}.validation.md'),
    'validated': sha(val_path)
  }
}
(run/'commits').mkdir(exist_ok=True)
(run/f'commits/{ch}.commit.json').write_text(json.dumps(commit, indent=2)+"\n", encoding='utf-8')
cont_path = run/'continuity/continuity-state.json'
cont = json.loads(cont_path.read_text(encoding='utf-8')) if cont_path.exists() else {'committedChapters': []}
cc = cont.setdefault('committedChapters', [])
if ch not in cc:
    cc.append(ch)
cont_path.write_text(json.dumps(cont, indent=2)+"\n", encoding='utf-8')
print('COMMITTED', ch)
