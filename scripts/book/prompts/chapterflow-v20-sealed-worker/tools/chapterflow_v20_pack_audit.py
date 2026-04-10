#!/usr/bin/env python3
from pathlib import Path
import sys, re
ROOT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('.')
required = [
    'README.md','QUICKSTART.md','INSTALL.md','REPO_RUNBOOK.md','OPERATING_CONTRACT.md','ARCHITECTURE.md','STATE_MACHINE.md','SOURCE_SUFFICIENCY.md','TICKET_SPEC.md','WORKER_SPAWN_PROTOCOL.md','COMMIT_PROTOCOL.md','MasterDirector-v20.md','MasterValidator-v20.md','PROMPT_STARTER.txt','launch.sh',
    'style/voice.md','style/constraints.md','style/bad-patterns.md','style/gold-patterns.md','style/gold-prose.md','style/gold-examples.md','style/gold-quiz.md','style/grade-bands.md',
    'briefs/brief-template.md','briefs/chapter-outline-template.md','briefs/quiz-blueprint-template.md','briefs/run-manifest-template.json',
    'rules/chapter-quality-gate.md','rules/chapter-structure.md','rules/quiz-rules.md','rules/validator-rules.md','rules/repair-rules.md','rules/learning-loop.md','rules/meta-distance-rules.md','rules/readability-rules.md','rules/scenario-tone-rules.md','rules/hard-depth-rules.md','rules/chapter-gate-rules.md','rules/release-gate-rules.md','rules/evidence-anchor-rules.md','rules/name-ledger-rules.md','rules/chapter-review-artifact-rules.md','rules/writer-agent.md','rules/editor-agent.md','rules/critic-agent.md','rules/structure-worker.md','rules/scenario-worker.md','rules/assembler-worker.md','rules/quiz-agent.md','rules/validator-agent.md','rules/repair-agent.md','rules/patch-agent.md',
    'tools/chapterflow_v20_pack_audit.py','tools/chapterflow_v20_artifact_guard.py','tools/chapterflow_v20_provenance_guard.py','tools/chapterflow_v20_commit.py','tools/chapterflow_v20_release_guard.py','tools/chapterflow_v20_source_sufficiency.py','tools/chapterflow_v20_smoke_test.py'
]
missing = [p for p in required if not (ROOT/p).exists()]
forbidden = [
    r'manufacture the run artifact tree from chapter metadata',
    r'authoring chapters by expanding fresh metadata alone',
    r'shortcut the remaining chapters',
    r'stop after validated Chapter 1 and wait for approval',
    r'chapterflow-v4/',
]
hits = []
for p in ROOT.rglob('*'):
    if p.name in {'chapterflow_v20_pack_audit.py','OPERATING_CONTRACT.md','PROMPT_STARTER.txt'}:
        continue
    if p.is_file() and p.suffix in {'.md','.txt','.py','.sh','.json'}:
        text = p.read_text(encoding='utf-8', errors='ignore')
        for pat in forbidden:
            if re.search(pat, text, flags=re.I):
                hits.append((str(p.relative_to(ROOT)), pat))
print('ChapterFlow v20 Pack Audit')
print('Root:', ROOT)
print('Missing files:', len(missing))
for m in missing:
    print('MISSING', m)
print('Banned-text hits:', len(hits))
for f, pat in hits[:50]:
    print('HIT', f, '::', pat)
if missing or hits:
    print('FAIL')
    sys.exit(1)
print('PASS')
