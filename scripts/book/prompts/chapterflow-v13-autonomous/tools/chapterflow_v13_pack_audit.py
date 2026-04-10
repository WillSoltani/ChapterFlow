#!/usr/bin/env python3
import sys
from pathlib import Path

REQUIRED = [
    "README.md",
    "QUICKSTART.md",
    "INSTALL.md",
    "REPO_RUNBOOK.md",
    "TROUBLESHOOTING.md",
    "FINAL_CHECKLIST.md",
    "SCHEMA_NOTES.md",
    "COMPLETE_FILE_INDEX.md",
    "MasterGenerator-v13.md",
    "MasterValidator-v13.md",
    "RUN_PROFILES.md",
    "CHANGELOG.md",
    "prompt-starter.txt",
    "bootstrap.sh",
    "launch.sh",
    "style/voice.md",
    "style/constraints.md",
    "style/grade-bands.md",
    "style/bad-patterns.md",
    "style/gold-patterns.md",
    "style/gold-prose.md",
    "style/gold-examples.md",
    "style/gold-quiz.md",
    "briefs/brief-template.md",
    "briefs/chapter-outline-template.md",
    "briefs/quiz-blueprint-template.md",
    "briefs/run-manifest-template.json",
    "rules/learning-loop.md",
    "rules/meta-distance-rules.md",
    "rules/readability-rules.md",
    "rules/scenario-tone-rules.md",
    "rules/hard-depth-rules.md",
    "rules/quiz-lifecycle-rules.md",
    "rules/chapter-gate-rules.md",
    "rules/release-gate-rules.md",
    "rules/evidence-anchor-rules.md",
    "rules/name-ledger-rules.md",
    "rules/chapter-review-artifact-rules.md",
    "rules/source-sidecar-rules.md",
    "rules/source-discovery-rules.md",
    "rules/edition-selection-rules.md",
    "rules/autopilot-rules.md",
    "rules/continuation-guard-rules.md",
    "rules/no-bulk-generation-rules.md",
    "rules/release-assembly-rules.md",
    "rules/chapter-quality-gate.md",
    "rules/chapter-structure.md",
    "rules/writer-agent.md",
    "rules/editor-agent.md",
    "rules/critic-agent.md",
    "rules/converter-agent.md",
    "rules/quiz-agent.md",
    "rules/quiz-rules.md",
    "rules/validator-agent.md",
    "rules/validator-rules.md",
    "rules/repair-agent.md",
    "rules/repair-rules.md",
    "rules/patch-agent.md",
    "tools/chapterflow_v13_pack_audit.py",
    "tools/chapterflow_v13_lint.py",
    "tools/chapterflow_v13_artifact_guard.py",
    "tools/chapterflow_v13_release_guard.py",
    "tools/chapterflow_v13_source_guard.py",
]

def main():
    if len(sys.argv) != 2:
        print("Usage: chapterflow_v13_pack_audit.py PACK_ROOT")
        sys.exit(2)
    root = Path(sys.argv[1])
    fail = 0
    for rel in REQUIRED:
        if not (root / rel).exists():
            print(f"FAIL missing {rel}")
            fail += 1
    if fail == 0:
        print("PASS all required files present")
    print(f"FAIL={fail}")
    sys.exit(1 if fail else 0)

if __name__ == "__main__":
    main()
