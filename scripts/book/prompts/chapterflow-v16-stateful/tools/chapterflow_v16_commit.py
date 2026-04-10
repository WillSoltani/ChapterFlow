
#!/usr/bin/env python3
from pathlib import Path
import json, sys, subprocess, hashlib

def load_json(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))

def dump_json(p, data):
    Path(p).write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

def require(path, errors):
    if not Path(path).exists():
        errors.append(f"missing: {path}")

def sha256_file(path):
    h = hashlib.sha256()
    h.update(Path(path).read_bytes())
    return h.hexdigest()

def run(cmd):
    return subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)

def next_chapter_num(book_state):
    completed = set(book_state.get("completedChapters", []))
    total = book_state.get("chapterCount") or 0
    for i in range(1, total + 1):
        if i not in completed:
            return i
    return None

def advance_stage(pack_root, run_root, book_state, current):
    stage = current["stage"]
    if stage == "source_discovery":
        current["stage"] = "memory_compile"
    elif stage == "memory_compile":
        current["stage"] = "book_skeleton"
    elif stage == "book_skeleton":
        current["stage"] = "chapter_01"
    elif stage.startswith("chapter_"):
        ch = int(stage.split("_")[1])
        book_state.setdefault("completedChapters", []).append(ch)
        book_state["completedChapters"] = sorted(set(book_state["completedChapters"]))
        # store hash
        val = run_root / "validated" / f"ch{ch:02d}.chapter.json"
        book_state.setdefault("validatedChapterHashes", {})[f"ch{ch:02d}"] = sha256_file(val)
        if ch == 2 and not book_state.get("calibrationLocked", False):
            current["stage"] = "calibration_lock"
        else:
            nxt = next_chapter_num(book_state)
            if nxt is None:
                current["stage"] = "release_assembly"
            else:
                current["stage"] = f"chapter_{nxt:02d}"
    elif stage == "calibration_lock":
        book_state["calibrationLocked"] = True
        nxt = next_chapter_num(book_state)
        current["stage"] = f"chapter_{nxt:02d}" if nxt else "release_assembly"
    elif stage == "release_assembly":
        current["stage"] = "release_validation"
    elif stage == "release_validation":
        current["stage"] = "complete"
    else:
        pass
    return current, book_state

def check_stage(pack_root, run_root, stage):
    errors = []
    if stage == "source_discovery":
        for rel in [
            "source-freeze/edition-lock.json",
            "source-freeze/source-ledger.json",
            "source-freeze/source-discovery.md",
            "source-freeze/toc.json",
            "sidecars/source-heading-index.json",
            "state/chapter-index.json",
        ]:
            require(run_root / rel, errors)
        # if chapter index exists, set chapterCount later
    elif stage == "memory_compile":
        for rel in [
            "memory/style-memory.md",
            "memory/quality-memory.md",
            "memory/role-cards/writer.md",
            "memory/role-cards/editor.md",
            "memory/role-cards/critic.md",
            "memory/role-cards/converter.md",
            "memory/role-cards/quiz.md",
            "memory/role-cards/validator.md",
            "memory/role-cards/patch.md",
        ]:
            require(run_root / rel, errors)
    elif stage == "book_skeleton":
        require(run_root / "skeleton/book-skeleton.md", errors)
    elif stage.startswith("chapter_"):
        ch = int(stage.split("_")[1])
        chid = f"ch{ch:02d}"
        for rel in [
            f"briefs/{chid}.md",
            f"outlines/{chid}.md",
            f"quiz-blueprints/{chid}.md",
            f"drafts/canonical/{chid}.md",
            f"drafts/edited/{chid}.md",
            f"reports/{chid}.critic.md",
            f"structured/{chid}.chapter.json",
            f"quizzes/{chid}.quiz.json",
            f"reports/{chid}.validation.md",
            f"validated/{chid}.chapter.json",
            f"validated/{chid}.review-package.json",
            "continuity/continuity-state.json",
        ]:
            require(run_root / rel, errors)
        if not errors:
            guard = run([sys.executable, str(pack_root / "tools" / "chapterflow_v16_artifact_guard.py"), str(run_root / "validated" / f"{chid}.chapter.json")])
            if guard.returncode != 0:
                errors.append("artifact guard failed:\n" + guard.stdout)
    elif stage == "calibration_lock":
        for rel in ["state/calibration-lock.json", "reports/calibration-lock.md"]:
            require(run_root / rel, errors)
    elif stage == "release_assembly":
        manifest = load_json(run_root / "manifests" / "run-manifest.json")
        require(run_root / "release" / f"{manifest['bookId']}.modern.json", errors)
    elif stage == "release_validation":
        for rel in ["reports/release.validation.md", "reports/release.audit.md"]:
            require(run_root / rel, errors)
        if not errors:
            manifest = load_json(run_root / "manifests" / "run-manifest.json")
            rel_path = run_root / "release" / f"{manifest['bookId']}.modern.json"
            guard = run([sys.executable, str(pack_root / "tools" / "chapterflow_v16_release_guard.py"), str(run_root), str(rel_path)])
            if guard.returncode != 0:
                errors.append("release guard failed:\n" + guard.stdout)
    return errors

def main():
    if len(sys.argv) != 3:
        print("Usage: chapterflow_v16_commit.py <pack_root> <run_root>")
        sys.exit(2)
    pack_root = Path(sys.argv[1])
    run_root = Path(sys.argv[2])
    book_state = load_json(run_root / "state" / "book-state.json")
    current = load_json(run_root / "state" / "current-task.json")
    errors = check_stage(pack_root, run_root, current["stage"])
    if errors:
        print("COMMIT BLOCKED")
        for e in errors:
            print(" -", e)
        sys.exit(1)
    # set chapter count after source discovery
    if current["stage"] == "source_discovery":
        idx = load_json(run_root / "state" / "chapter-index.json")
        book_state["chapterCount"] = len(idx)
    current, book_state = advance_stage(pack_root, run_root, book_state, current)
    dump_json(run_root / "state" / "book-state.json", book_state)
    dump_json(run_root / "state" / "current-task.json", current)
    subprocess.run([sys.executable, str(pack_root / "tools" / "chapterflow_v16_dispatch.py"), str(pack_root), str(run_root)], check=True)
    print("COMMIT OK ->", current["stage"])

if __name__ == "__main__":
    main()
