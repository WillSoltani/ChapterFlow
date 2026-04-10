#!/usr/bin/env python3
import sys
from pathlib import Path

required = [
    'README.md',
    'QUICKSTART.md',
    'INSTALL.md',
    'REPO_RUNBOOK.md',
    'SCHEMA_NOTES.md',
    'PIPELINE_BOUNDARY.md',
    'POST_PIPELINE_INTEGRATION.md',
    'CLEANUP_POLICY.md',
    'MasterGenerator-v14.md',
    'MasterValidator-v14.md',
    'prompt-starter.txt',
    'launch.sh',
    'bootstrap.sh',
    'integrate.sh',
    'cleanup.sh',
    'style/voice.md',
    'style/constraints.md',
    'style/grade-bands.md',
    'style/bad-patterns.md',
    'style/gold-patterns.md',
    'style/gold-prose.md',
    'style/gold-examples.md',
    'style/gold-quiz.md',
    'briefs/brief-template.md',
    'briefs/chapter-outline-template.md',
    'briefs/quiz-blueprint-template.md',
    'briefs/run-manifest-template.json',
    'rules/chapter-structure.md',
    'rules/writer-agent.md',
    'rules/editor-agent.md',
    'rules/critic-agent.md',
    'rules/converter-agent.md',
    'rules/quiz-agent.md',
    'rules/validator-agent.md',
    'rules/repair-agent.md',
    'rules/patch-agent.md',
    'tools/chapterflow_v14_lint.py',
    'tools/chapterflow_v14_artifact_guard.py',
    'tools/chapterflow_v14_release_guard.py',
    'tools/chapterflow_v14_cleanup.py',
]

def main(root):
    root = Path(root)
    missing = [p for p in required if not (root/p).exists()]
    if missing:
        print("FAIL")
        for m in missing:
            print(f"MISSING {m}")
        raise SystemExit(1)
    print("PASS")
    print(f"Checked {len(required)} required files.")

if __name__ == '__main__':
    if len(sys.argv) != 2:
        print("Usage: chapterflow_v14_pack_audit.py PACK_ROOT")
        raise SystemExit(2)
    main(sys.argv[1])
