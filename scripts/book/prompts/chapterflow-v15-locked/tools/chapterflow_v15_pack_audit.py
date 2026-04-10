#!/usr/bin/env python3
import sys
from pathlib import Path

REQUIRED = [
    "README.md",
    "QUICKSTART.md",
    "INSTALL.md",
    "REPO_RUNBOOK.md",
    "OPERATING_CONTRACT.md",
    "SCHEMA_NOTES.md",
    "RUN_PROFILES.md",
    "PIPELINE_BOUNDARY.md",
    "SOURCE_DISCOVERY_POLICY.md",
    "MasterGenerator-v15.md",
    "MasterValidator-v15.md",
    "prompt-starter.txt",
    "launch.sh",
    "cleanup.sh",
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
    "rules/source-discovery-rules.md",
    "rules/operating-seal.md",
    "rules/no-generator-rules.md",
    "rules/chapter-gate-rules.md",
    "rules/release-gate-rules.md",
    "rules/artifact-guard-rules.md",
    "rules/chapter-review-artifact-rules.md",
    "rules/evidence-anchor-rules.md",
    "rules/name-ledger-rules.md",
    "rules/meta-distance-rules.md",
    "rules/readability-rules.md",
    "rules/scenario-tone-rules.md",
    "rules/hard-depth-rules.md",
    "rules/quiz-lifecycle-rules.md",
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
    "tools/chapterflow_v15_pack_audit.py",
    "tools/chapterflow_v15_lint.py",
    "tools/chapterflow_v15_artifact_guard.py",
    "tools/chapterflow_v15_release_guard.py",
]

BANNED_TEXT = [
    "Approve this chapter",
    "wait for approval",
    "stop after validated Chapter 1",
]

def main():
    if len(sys.argv) != 2:
        print("Usage: chapterflow_v15_pack_audit.py PACK_ROOT")
        sys.exit(2)
    root = Path(sys.argv[1])
    missing = [p for p in REQUIRED if not (root / p).exists()]
    text_hits = []
    for path in root.rglob("*"):
        if path.is_file() and path.name not in {'chapterflow_v15_pack_audit.py', 'PACK_AUDIT_REPORT.md'}:
            try:
                txt = path.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                continue
            for bad in BANNED_TEXT:
                if bad in txt:
                    text_hits.append((str(path.relative_to(root)), bad))
    print("PACK AUDIT")
    print(f"pack_root: {root}")
    if missing:
        print("MISSING FILES:")
        for m in missing:
            print(f"- {m}")
    if text_hits:
        print("BANNED TEXT HITS:")
        for rel, bad in text_hits:
            print(f"- {rel}: {bad}")
    if missing or text_hits:
        sys.exit(1)
    print("PASS: all required files present and no banned approval/cover text found.")

if __name__ == "__main__":
    main()
