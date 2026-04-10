#!/usr/bin/env python3
import sys, pathlib, json, hashlib, datetime

def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            b = f.read(65536)
            if not b:
                break
            h.update(b)
    return h.hexdigest()

def main(run_root, ch_num):
    run_root = pathlib.Path(run_root)
    ch = int(ch_num)
    ch_tag = f"ch{ch:02d}"
    req = {
        "validatedChapter": run_root / "validated" / f"{ch_tag}.chapter.json",
        "reviewPackage": run_root / "validated" / f"{ch_tag}.review-package.json",
        "quiz": run_root / "quizzes" / f"{ch_tag}.quiz.json",
        "validationReport": run_root / "reports" / f"{ch_tag}.validation.md",
    }
    missing = [k for k,p in req.items() if not p.exists()]
    if missing:
        print("COMMIT FAIL")
        print("Missing:", ", ".join(missing))
        sys.exit(1)
    commit = {
        "chapter": ch,
        "committedAt": datetime.datetime.utcnow().isoformat() + "Z",
        "artifacts": {k: str(p) for k,p in req.items()},
        "hashes": {k: sha256(p) for k,p in req.items()},
    }
    commits_dir = run_root / "commits"
    commits_dir.mkdir(exist_ok=True, parents=True)
    out = commits_dir / f"{ch_tag}.commit.json"
    out.write_text(json.dumps(commit, indent=2), encoding="utf-8")

    state_path = run_root / "state" / "pipeline-state.json"
    state_path.parent.mkdir(exist_ok=True, parents=True)
    if state_path.exists():
        state = json.loads(state_path.read_text(encoding="utf-8"))
    else:
        state = {}
    done = set(state.get("completedChapters", []))
    done.add(ch)
    state["completedChapters"] = sorted(done)
    state.setdefault("committedHashes", {})[ch_tag] = commit["hashes"]["validatedChapter"]
    state["currentState"] = "chapter_committing"
    state_path.write_text(json.dumps(state, indent=2), encoding="utf-8")
    print(f"COMMIT PASS {ch_tag}")
    print(out)

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: chapterflow_v17_commit.py <run_root> <chapter_number>")
        sys.exit(2)
    main(sys.argv[1], sys.argv[2])
