#!/usr/bin/env python3
import json, sys, re
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from chapterflow_v13_prose_audit import audit_package

CONTAMINATION = [
    "keep the prose narrow and concrete",
    "the source is short and works by contrast",
    "used lazily, the point turns into",
    "keep this question alive",
    "one source pressure stays visible",
    "tied to the live constraint",
    "threshold question",
    "reading calibration",
    "unsupported zones",
    "motif watchlist",
    "sourceanchorpriority",
    "internal concept budget",
]
ANTIFRAGILE_TITLE = "Antifragile: Things That Gain from Disorder"
ANTIFRAGILE_AUTHOR = "Nassim Nicholas Taleb"

def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def is_tone_obj(x):
    return isinstance(x, dict) and set(x.keys()) == {"gentle","direct","competitive"} and all(isinstance(v,str) and v.strip() for v in x.values())

def walk(obj, path=""):
    if isinstance(obj, dict):
        yield path, obj
        for k,v in obj.items():
            np = f"{path}.{k}" if path else k
            yield from walk(v, np)
    elif isinstance(obj, list):
        for i,v in enumerate(obj):
            yield from walk(v, f"{path}[{i}]")

def tone_objects(obj):
    for path, val in walk(obj):
        if is_tone_obj(val):
            yield path, val

def norm(s):
    return re.sub(r"\s+", " ", s.strip().lower())

def meta_text(value):
    return str(value or "").replace("“", '"').replace("”", '"').replace("‘", "'").replace("’", "'").strip()

def is_antifragile(data):
    book = data.get("book", {}) if isinstance(data, dict) else {}
    title = norm(meta_text(book.get("title", "")))
    author = norm(meta_text(book.get("author", "")))
    book_id = norm(meta_text(book.get("bookId", "")))
    return book_id == "antifragile" or "antifragile" in title or "nassim nicholas taleb" in author

def antifragile_metadata_checks(data, fail_msgs):
    if not isinstance(data, dict) or not is_antifragile(data):
        return
    book = data.get("book", {})
    if meta_text(book.get("title")) != ANTIFRAGILE_TITLE:
        fail_msgs.append("antifragile metadata title must be normalized exactly")
    if meta_text(book.get("author")) != ANTIFRAGILE_AUTHOR:
        fail_msgs.append("antifragile metadata author must be normalized exactly")
    if re.search(r"[“”‘’]", str(book.get("title", "")) + str(book.get("author", ""))):
        fail_msgs.append("antifragile metadata contains curly quote corruption")
    if "chapters" in data and isinstance(data["chapters"], list):
        edition = book.get("edition", {})
        if not data.get("packageId"):
            fail_msgs.append("antifragile packageId missing")
        if not data.get("createdAt"):
            fail_msgs.append("antifragile createdAt missing")
        if not data.get("contentOwner"):
            fail_msgs.append("antifragile contentOwner missing")
        if not isinstance(book.get("categories"), list) or not book.get("categories"):
            fail_msgs.append("antifragile categories missing")
        if book.get("variantFamily") != "EMH":
            fail_msgs.append("antifragile variantFamily must equal EMH")
        if not meta_text(book.get("chapterRange")):
            fail_msgs.append("antifragile chapterRange missing")
        if not isinstance(edition, dict) or not meta_text(edition.get("name")):
            fail_msgs.append("antifragile edition.name missing")
        if not meta_text(edition.get("sourceText")):
            fail_msgs.append("antifragile edition.sourceText missing")
        if not meta_text(edition.get("sourceProvenance")):
            fail_msgs.append("antifragile edition.sourceProvenance missing")
        if not edition.get("publishedYear"):
            fail_msgs.append("antifragile edition.publishedYear missing")
    else:
        if meta_text(book.get("title")) != ANTIFRAGILE_TITLE or meta_text(book.get("author")) != ANTIFRAGILE_AUTHOR:
            fail_msgs.append("antifragile chapter-level book object is not normalized")

def tone_similarity_fail(t):
    vals = [norm(v) for v in t.values()]
    return len(set(vals)) < 3

def scenario_checks(chapter, fail_msgs):
    for i, ex in enumerate(chapter.get("examples", []), 1):
        for field in ["scenario", "whatToDo", "whyItMatters"]:
            if not is_tone_obj(ex.get(field)):
                fail_msgs.append(f"examples[{i}].{field} is not a tone object")

def contamination_checks(obj, fail_msgs):
    for path, val in tone_objects(obj):
        flat = " ".join(val.values()).lower()
        for bad in CONTAMINATION:
            if bad in flat:
                fail_msgs.append(f"contamination phrase '{bad}' found at {path}")

def quiz_checks(chapter, mode, fail_msgs):
    quiz = chapter.get("quiz")
    if not isinstance(quiz, dict):
        fail_msgs.append("quiz missing")
        return
    questions = quiz.get("questions")
    if mode == "chapter_gate" and (not isinstance(questions, list) or len(questions) == 0):
        fail_msgs.append("quiz.questions empty in chapter_gate mode")

def tone_checks(chapter, fail_msgs):
    for path, t in tone_objects(chapter):
        if tone_similarity_fail(t):
            fail_msgs.append(f"tone collapse at {path}")

def package_chapters(data):
    if "chapters" in data and isinstance(data["chapters"], list):
        return data["chapters"]
    return [data]

def main():
    if len(sys.argv) != 3:
        print("Usage: chapterflow_v13_lint.py PATH chapter_gate|release_gate")
        sys.exit(2)
    path = Path(sys.argv[1])
    mode = sys.argv[2]
    data = load_json(path)
    fails = []
    warns = []
    antifragile_metadata_checks(data, fails)
    for ch in package_chapters(data):
        quiz_checks(ch, mode, fails)
        scenario_checks(ch, fails)
        tone_checks(ch, fails)
        contamination_checks(ch, fails)
    audit = audit_package(data, source_path=path.resolve())
    for issue in audit["issues"]:
        line = f"{issue['issue_type']} at {issue['location']}: {issue['message']}"
        if issue["severity"] == "FAIL":
            fails.append(line)
        else:
            warns.append(line)
    for f in fails:
        print("FAIL", f)
    for w in warns:
        print("WARN", w)
    print(f"FAIL={len(fails)} WARN={len(warns)}")
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
