
#!/usr/bin/env python3
from pathlib import Path
import sys

REQUIRED = [
    "README.md",
    "QUICKSTART.md",
    "INSTALL.md",
    "REPO_RUNBOOK.md",
    "OPERATING_CONTRACT.md",
    "STATE_MACHINE.md",
    "SCHEMA_NOTES.md",
    "RUN_PROFILES.md",
    "MasterGenerator-v16.md",
    "MasterValidator-v16.md",
    "prompt-starter.txt",
    "launch.sh",
    "style/voice.md",
    "style/constraints.md",
    "style/bad-patterns.md",
    "style/gold-patterns.md",
    "style/gold-prose.md",
    "style/gold-examples.md",
    "style/gold-quiz.md",
    "style/grade-bands.md",
    "briefs/brief-template.md",
    "briefs/chapter-outline-template.md",
    "briefs/quiz-blueprint-template.md",
    "briefs/run-manifest-template.json",
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
    "rules/learning-loop.md",
    "rules/source-discovery-rules.md",
    "rules/state-machine-rules.md",
    "rules/task-envelope-rules.md",
    "rules/no-generator-rules.md",
    "rules/calibration-lock-rules.md",
    "rules/artifact-guard-rules.md",
    "rules/release-assembly-rules.md",
    "rules/meta-distance-rules.md",
    "rules/readability-rules.md",
    "rules/scenario-tone-rules.md",
    "rules/hard-depth-rules.md",
    "rules/quiz-lifecycle-rules.md",
    "rules/evidence-anchor-rules.md",
    "rules/name-ledger-rules.md",
    "rules/chapter-review-artifact-rules.md",
    "tools/chapterflow_v16_dispatch.py",
    "tools/chapterflow_v16_commit.py",
    "tools/chapterflow_v16_artifact_guard.py",
    "tools/chapterflow_v16_release_guard.py",
    "tools/chapterflow_v16_build_release.py"
]

BANNED_PHRASES = [
    "stop after validated Chapter 1 and wait for approval",
    "generate-the-prince-v1.mjs",
    "one controlled pass",
    "synthesize the rest"
]

def main():
    if len(sys.argv) != 2:
        print("Usage: chapterflow_v16_pack_audit.py <pack_root>")
        sys.exit(2)
    root = Path(sys.argv[1])
    missing = [p for p in REQUIRED if not (root / p).exists()]
    banned_hits = []
    for path in root.rglob("*"):
        if path.is_file() and path.name not in {'chapterflow_v16_pack_audit.py', 'PACK_AUDIT_REPORT.md'}:
            try:
                text = path.read_text(encoding="utf-8")
            except Exception:
                continue
            for phrase in BANNED_PHRASES:
                if phrase in text:
                    banned_hits.append((str(path.relative_to(root)), phrase))
    if missing or banned_hits:
        if missing:
            print("MISSING FILES:")
            for m in missing:
                print(" -", m)
        if banned_hits:
            print("BANNED PHRASE HITS:")
            for rel, phrase in banned_hits:
                print(f" - {rel}: {phrase}")
        sys.exit(1)
    print("PASS: pack audit clean")
if __name__ == "__main__":
    main()
