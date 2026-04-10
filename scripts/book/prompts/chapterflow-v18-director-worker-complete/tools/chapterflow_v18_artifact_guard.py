
#!/usr/bin/env python3
import os, sys, json, re, hashlib
FORBIDDEN_PHRASES = [
    "keep the prose narrow and concrete",
    "keep this question alive",
    "used lazily, the point turns into",
    "readingcalibration",
    "thresholdquestion",
    "unsupportedzones",
]
TOP_KEYS = {"chapterId","number","title","readingTimeMinutes","contentVariants","examples","quiz","implementationPlan","reviewCards","keyTakeawayCard"}
EASY_KEYS = {"chapterBreakdown","keyTakeaways","oneMinuteRecap"}
MEDIUM_KEYS = {"chapterBreakdown","keyTakeaways","activationPrompt","selfCheckPrompt","oneMinuteRecap"}
HARD_KEYS = {"chapterBreakdown","keyTakeaways","activationPrompt","selfCheckPrompts","predictionPrompt","oneMinuteRecap"}

def is_tone_obj(v):
    return isinstance(v, dict) and set(v.keys())=={"gentle","direct","competitive"} and all(isinstance(v[k], str) and v[k].strip() for k in v)

def norm(s):
    s = s.lower()
    s = re.sub(r"[^a-z0-9\s]"," ",s)
    s = re.sub(r"\s+"," ",s).strip()
    return s

def iter_strings(obj):
    if isinstance(obj, str):
        yield obj
    elif isinstance(obj, dict):
        for v in obj.values():
            yield from iter_strings(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from iter_strings(v)

def main():
    if len(sys.argv) < 3:
        print("Usage: artifact_guard.py RUN_ROOT path/to/chapter.json")
        sys.exit(1)
    _, run_root, chapter_path = sys.argv
    if not os.path.isabs(chapter_path):
        chapter_path = os.path.join(run_root, chapter_path)
    chapter = json.load(open(chapter_path, encoding='utf-8'))
    fails = []
    warns = []

    extra = set(chapter.keys()) - TOP_KEYS
    if extra: fails.append(f"extra top-level keys: {sorted(extra)}")

    cv = chapter.get("contentVariants", {})
    if set(cv.get("easy",{}).keys()) != EASY_KEYS:
        fails.append(f"easy keys not canonical: {sorted(cv.get('easy',{}).keys())}")
    if set(cv.get("medium",{}).keys()) != MEDIUM_KEYS:
        fails.append(f"medium keys not canonical: {sorted(cv.get('medium',{}).keys())}")
    if set(cv.get("hard",{}).keys()) != HARD_KEYS:
        fails.append(f"hard keys not canonical: {sorted(cv.get('hard',{}).keys())}")

    # no duplicate surfaces
    for bad in ("takeaways","structuredRecap","summary","whatChanges","moreDetails"):
        if bad in cv.get("easy",{}) or bad in cv.get("medium",{}) or bad in cv.get("hard",{}):
            fails.append(f"forbidden leftover field present: {bad}")

    # scenarios
    examples = chapter.get("examples", [])
    if len(examples) != 6:
        warns.append(f"example count {len(examples)}")
    for i, ex in enumerate(examples):
        for field in ("scenario","whatToDo","whyItMatters"):
            if not is_tone_obj(ex.get(field)):
                fails.append(f"example {i+1} {field} is not tone object")

    # quiz
    quiz = chapter.get("quiz", {})
    q = quiz.get("questions") if isinstance(quiz, dict) else None
    if not isinstance(q, list) or len(q) != 10:
        fails.append("quiz missing or not 10 questions")

    # obvious leakage
    alltxt = "\n".join(iter_strings(chapter)).lower()
    for p in FORBIDDEN_PHRASES:
        if p in alltxt:
            fails.append(f"instruction leakage: {p}")

    # repeated normalized sentences
    sent_counts = {}
    for s in iter_strings(chapter):
        for sent in re.split(r"(?<=[.!?])\s+", s):
            n = norm(sent)
            if len(n.split()) >= 8:
                sent_counts[n] = sent_counts.get(n,0)+1
    repeated = [k for k,v in sent_counts.items() if v >= 3]
    if repeated:
        warns.append(f"{len(repeated)} repeated sentence patterns")

    # repeated thesis-like stems count; rough heuristic
    bigrams = {}
    for s in iter_strings(chapter):
        ns = norm(s).split()
        if len(ns)>=6:
            key=" ".join(ns[:6])
            bigrams[key]=bigrams.get(key,0)+1
    stemrep = [k for k,v in bigrams.items() if v>=4]
    if stemrep:
        warns.append(f"{len(stemrep)} repeated opening stems")

    print("FAILS", len(fails))
    for f in fails: print("FAIL", f)
    print("WARNS", len(warns))
    for w in warns: print("WARN", w)
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
