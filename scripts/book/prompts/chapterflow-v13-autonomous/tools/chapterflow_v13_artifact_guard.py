#!/usr/bin/env python3
import sys, re
from pathlib import Path

DRAFT_HEADERS = [r"^##\s+Easy\b", r"^##\s+Medium\b", r"^##\s+Hard\b"]
CONTAM = [
    "keep the prose narrow and concrete",
    "used lazily, the point turns into",
    "keep this question alive",
    "reading calibration",
    "unsupported zones",
]

def read(path):
    return Path(path).read_text(encoding="utf-8", errors="ignore")

def main():
    if len(sys.argv) != 2:
        print("Usage: chapterflow_v13_artifact_guard.py RUN_ROOT")
        sys.exit(2)
    run_root = Path(sys.argv[1])
    fails = []

    for req in [
        run_root / "manifests" / "run-manifest.json",
        run_root / "manifests" / "source-ledger.json",
        run_root / "manifests" / "edition-lock.json",
        run_root / "continuity" / "continuity-state.json",
    ]:
        if not req.exists():
            fails.append(f"missing required artifact {req}")

    frozen = run_root / "source-freeze"
    if not frozen.exists() or not any(frozen.iterdir()):
        fails.append("source-freeze missing or empty")

    for draft_dir in [run_root / "drafts" / "canonical", run_root / "drafts" / "edited"]:
        if draft_dir.exists():
            for p in draft_dir.glob("ch*.md"):
                txt = read(p)
                if any(re.search(pat, txt, flags=re.M) for pat in DRAFT_HEADERS):
                    fails.append(f"{p} looks like a structured pseudo-draft, not real prose")
                low = txt.lower()
                for bad in CONTAM:
                    if bad in low:
                        fails.append(f"{p} contains contamination phrase '{bad}'")

    validated = run_root / "validated"
    for p in sorted(validated.glob("ch*.chapter.json")):
        stem = p.stem.replace(".chapter", "")
        expected = [
            run_root / "briefs" / f"{stem}.md",
            run_root / "outlines" / f"{stem}.md",
            run_root / "quiz-blueprints" / f"{stem}.md",
            run_root / "drafts" / "canonical" / f"{stem}.md",
            run_root / "drafts" / "edited" / f"{stem}.md",
            run_root / "structured" / f"{stem}.chapter.json",
            run_root / "quizzes" / f"{stem}.quiz.json",
            run_root / "reports" / f"{stem}.critic.md",
            run_root / "reports" / f"{stem}.validation.md",
            run_root / "validated" / f"{stem}.review-package.json",
            run_root / "sidecars" / f"{stem}.reading-metrics.json",
            run_root / "sidecars" / "source" / f"{stem}.source.json",
        ]
        for e in expected:
            if not e.exists():
                fails.append(f"missing artifact {e}")

    for f in fails:
        print("FAIL", f)
    print(f"FAIL={len(fails)} WARN=0")
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
