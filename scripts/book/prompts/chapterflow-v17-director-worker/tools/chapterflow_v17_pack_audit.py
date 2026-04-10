#!/usr/bin/env python3
import sys, pathlib, re, json

REQUIRED = [
    "README.md",
    "QUICKSTART.md",
    "INSTALL.md",
    "OPERATING_CONTRACT.md",
    "ARCHITECTURE.md",
    "STATE_MACHINE.md",
    "WAVE_PROTOCOL.md",
    "TICKET_SPEC.md",
    "WORKER_SPAWN_PROTOCOL.md",
    "SCHEMA_NOTES.md",
    "REPO_RUNBOOK.md",
    "MasterDirector-v17.md",
    "MasterValidator-v17.md",
    "prompt-starter.txt",
    "launch.sh",
    "style/voice.md",
    "style/constraints.md",
    "style/bad-patterns.md",
    "style/gold-patterns.md",
    "style/gold-prose.md",
    "style/gold-examples.md",
    "style/gold-quiz.md",
    "briefs/brief-template.md",
    "briefs/chapter-outline-template.md",
    "briefs/quiz-blueprint-template.md",
    "briefs/run-manifest-template.json",
    "briefs/chapter-ticket-template.md",
    "briefs/work-order-template.md",
    "rules/learning-loop.md",
    "rules/no-shortcut-rules.md",
    "rules/source-freeze-rules.md",
    "rules/calibration-lock-rules.md",
    "rules/wave-routing-rules.md",
    "rules/artifact-guard-rules.md",
    "rules/chapter-commit-rules.md",
    "rules/release-assembly-rules.md",
    "rules/meta-distance-rules.md",
    "rules/readability-rules.md",
    "rules/scenario-tone-rules.md",
    "rules/hard-depth-rules.md",
    "rules/chapter-review-artifact-rules.md",
    "rules/chapter-gate-rules.md",
    "rules/release-gate-rules.md",
    "rules/evidence-anchor-rules.md",
    "rules/name-ledger-rules.md",
    "rules/chapter-quality-gate.md",
    "rules/chapter-structure.md",
    "rules/validator-rules.md",
    "rules/repair-rules.md",
    "roles/research-card.md",
    "roles/writer-card.md",
    "roles/editor-card.md",
    "roles/critic-card.md",
    "roles/converter-card.md",
    "roles/quiz-card.md",
    "roles/validator-card.md",
    "roles/patch-card.md",
    "tools/chapterflow_v17_pack_audit.py",
    "tools/chapterflow_v17_artifact_guard.py",
    "tools/chapterflow_v17_commit.py",
    "tools/chapterflow_v17_release_guard.py",
]

BANNED_TEXT = [
    "stop after validated Chapter 1",
    "wait for approval",
    "Approve this chapter to continue",
    "generate-the-prince-v1.mjs",
]

def main(root):
    root = pathlib.Path(root)
    missing = []
    for rel in REQUIRED:
        if not (root / rel).exists():
            missing.append(rel)
    text_failures = []
    for p in root.rglob("*.md"):
        txt = p.read_text(encoding="utf-8", errors="ignore")
        for s in BANNED_TEXT:
            if s in txt:
                text_failures.append((str(p.relative_to(root)), s))
    print("ChapterFlow v17 Pack Audit")
    print(f"Root: {root}")
    print(f"Missing files: {len(missing)}")
    for m in missing:
        print(f"  MISSING: {m}")
    print(f"Banned-text hits: {len(text_failures)}")
    for f, s in text_failures:
        print(f"  HIT: {f} -> {s}")
    if missing or text_failures:
        sys.exit(1)
    print("PASS")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: chapterflow_v17_pack_audit.py <pack_root>")
        sys.exit(2)
    main(sys.argv[1])
