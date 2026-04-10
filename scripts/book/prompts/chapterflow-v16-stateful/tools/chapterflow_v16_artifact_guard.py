
#!/usr/bin/env python3
from pathlib import Path
import json, sys

CONTAMINATION_PHRASES = [
    "keep the prose narrow and concrete",
    "keep this question alive",
    "used lazily, the point turns into",
    "threshold question",
    "reading calibration",
    "unsupported zones",
    "source is short and works by contrast",
]

def load_json(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))

def walk_strings(obj, path=""):
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield from walk_strings(v, f"{path}.{k}" if path else k)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from walk_strings(v, f"{path}[{i}]")
    elif isinstance(obj, str):
        yield path, obj

def is_tone_object(v):
    return isinstance(v, dict) and set(v.keys()) == {"gentle","direct","competitive"} and all(isinstance(v[k], str) and v[k].strip() for k in v)

def tone_identical(v):
    return is_tone_object(v) and (v["gentle"] == v["direct"] or v["gentle"] == v["competitive"] or v["direct"] == v["competitive"])

def check_chapter(chapter_path):
    data = load_json(chapter_path)
    errors = []
    # contamination
    for path, text in walk_strings(data):
        low = text.lower()
        for phrase in CONTAMINATION_PHRASES:
            if phrase in low:
                errors.append(f"contamination phrase '{phrase}' at {path}")
        if "daily daily" in low:
            errors.append(f"duplicate word artifact at {path}")
    # examples scenario tone object
    for i, ex in enumerate(data.get("examples", []), 1):
        for field in ["scenario","whatToDo","whyItMatters"]:
            if not is_tone_object(ex.get(field)):
                errors.append(f"example {i} field '{field}' is not a tone object")
            elif tone_identical(ex[field]):
                errors.append(f"example {i} field '{field}' has identical tone variants")
    # quiz non-empty
    quiz = data.get("quiz")
    if not isinstance(quiz, dict) or not isinstance(quiz.get("questions"), list) or len(quiz.get("questions", [])) == 0:
        errors.append("quiz.questions is empty or missing")
    else:
        for qi, q in enumerate(quiz["questions"], 1):
            exp = q.get("explanation")
            if not is_tone_object(exp):
                errors.append(f"quiz question {qi} explanation is not a tone object")
            elif tone_identical(exp):
                errors.append(f"quiz question {qi} explanation has identical tone variants")
    # generic tone collapse recursive
    for path, val in []:
        pass
    return errors

def main():
    if len(sys.argv) < 2:
        print("Usage: chapterflow_v16_artifact_guard.py <run_root_or_chapter_json> [chapter_json]")
        sys.exit(2)
    target = Path(sys.argv[1])
    if target.is_file():
        chapters = [target]
    else:
        validated = target / "validated"
        if len(sys.argv) >= 3:
            chapters = [Path(sys.argv[2])]
        else:
            chapters = sorted(validated.glob("ch*.chapter.json"))
    all_errors = []
    for ch in chapters:
        errs = check_chapter(ch)
        if errs:
            all_errors.append((ch.name, errs))
    if all_errors:
        for name, errs in all_errors:
            print(name)
            for e in errs:
                print(" -", e)
        sys.exit(1)
    print("PASS: artifact guard clean")
if __name__ == "__main__":
    main()
