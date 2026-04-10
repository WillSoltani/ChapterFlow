#!/usr/bin/env python3
import sys
from pathlib import Path

REQUIRED = [
  'README.md','QUICKSTART.md','INSTALL.md','REPO_RUNBOOK.md','PROMPT_STARTER.txt',
  'OPERATING_CONTRACT.md','ARCHITECTURE.md','STATE_MACHINE.md','SOURCE_SUFFICIENCY.md',
  'COMMIT_PROTOCOL.md','RELEASE_PROTOCOL.md','SCHEMA_NOTES.md',
  'MasterDirector-v19.md','MasterValidator-v19.md','launch.sh',
  'style/voice.md','style/constraints.md','style/bad-patterns.md','style/gold-patterns.md',
  'style/gold-prose.md','style/gold-examples.md','style/gold-quiz.md','style/grade-bands.md',
  'rules/chapter-quality-gate.md','rules/chapter-structure.md','rules/writer-agent.md','rules/editor-agent.md',
  'rules/converter-agent.md','rules/quiz-agent.md','rules/quiz-rules.md','rules/validator-agent.md',
  'rules/validator-rules.md','rules/repair-agent.md','rules/repair-rules.md','rules/critic-agent.md',
  'rules/patch-agent.md','rules/learning-loop.md','rules/meta-distance-rules.md','rules/scenario-tone-rules.md',
  'rules/source-discovery-rules.md','rules/structure-worker.md','rules/scenario-worker.md','rules/assembler-agent.md',
  'briefs/brief-template.md','briefs/chapter-outline-template.md','briefs/quiz-blueprint-template.md',
  'briefs/run-manifest-template.json',
  'templates/ticket-template.md','templates/work-order-template.md','templates/receipt-template.json',
  'tools/chapterflow_v19_artifact_guard.py','tools/chapterflow_v19_provenance_guard.py',
  'tools/chapterflow_v19_commit.py','tools/chapterflow_v19_release_guard.py'
]
BANNED = [
  'generate the run tree from structured chapter metadata',
  'synthesize the rest',
  'emit the remaining artifacts plus the final package in one controlled pass',
  'generate every chapter from fresh chapter metadata'
]

ALLOWED_SELF = {'chapterflow_v19_pack_audit.py'}

def main():
    if len(sys.argv) != 2:
        print('Usage: chapterflow_v19_pack_audit.py <pack_root>')
        raise SystemExit(1)
    root = Path(sys.argv[1])
    missing = [p for p in REQUIRED if not (root/p).exists()]
    hits = []
    for path in root.rglob('*'):
        if path.is_file() and path.suffix in {'.md','.txt','.py','.sh','.json'}:
            text = path.read_text(encoding='utf-8', errors='ignore').lower()
            for phrase in BANNED:
                if phrase in text and path.name not in ALLOWED_SELF and 'PROMPT_STARTER' not in str(path):
                    hits.append((str(path.relative_to(root)), phrase))
    print('ChapterFlow v19 Pack Audit')
    print(f'Root: {root}')
    print(f'Missing files: {len(missing)}')
    for m in missing:
        print(f'  MISSING {m}')
    print(f'Banned-text hits: {len(hits)}')
    for path, phrase in hits:
        print(f'  HIT {path}: {phrase}')
    if missing or hits:
        print('FAIL')
        raise SystemExit(1)
    print('PASS')

if __name__ == '__main__':
    main()
