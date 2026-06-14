#!/usr/bin/env python3
"""Splice re-authored chapter bodies into the live chapter JSON files.

Preserves protected fields byte-for-byte (schemaVersion, chapterId, number,
title, readingTimeMinutes, hook, counterintuition) and example metadata
(exampleId, tags, planSpec). Overwrites the re-authored fields. Forces
correctIndex to the assigned per-chapter sequence. Validates structure and the
A11 memorable-line invariant.

Usage: python3 splice.py 01 02 03    (or no args = all 20)
"""
import json, sys, os

BASE = "/Users/radinsoltani/ChapterFlow/scripts/book/prompts/chapterflow-v21-authored"
AUTH = os.path.join(BASE, "scratch/authored-let-them")
CHAP = os.path.join(BASE, "state/chapters")

# Assigned correctIndex sequences (distinct per chapter, book-balanced 60/60/60).
SEQ = {
 1:[1,0,0,2,1,2,0,2,1], 2:[2,1,2,1,2,0,1,0,0], 3:[2,0,1,0,1,2,2,0,1],
 4:[1,1,2,0,2,0,0,1,2], 5:[0,1,2,0,1,2,2,1,0], 6:[0,1,1,2,0,0,1,2,2],
 7:[2,1,0,1,2,2,1,0,0], 8:[1,0,1,0,2,2,2,0,1], 9:[1,2,0,2,0,1,0,1,2],
 10:[1,0,2,2,0,1,2,0,1], 11:[0,2,1,1,2,2,0,0,1], 12:[2,1,0,1,0,1,2,2,0],
 13:[2,2,0,1,1,0,0,1,2], 14:[2,0,2,0,2,1,1,0,1], 15:[2,1,0,2,0,1,2,1,0],
 16:[0,2,0,1,1,0,2,2,1], 17:[1,1,1,2,0,0,0,2,2], 18:[2,0,2,1,0,1,1,0,2],
 19:[2,1,2,0,2,1,0,0,1], 20:[1,1,2,0,0,2,1,2,0],
}

PROTECTED = ["schemaVersion","chapterId","number","title","readingTimeMinutes","hook","counterintuition"]

def splice(nn:int):
    cid = f"the-let-them-theory-ch{nn:02d}"
    chap_path = os.path.join(CHAP, f"{cid}.v21-native.chapter.json")
    auth_path = os.path.join(AUTH, f"ch{nn:02d}.json")
    base = json.load(open(chap_path))
    a = json.load(open(auth_path))
    errs=[]

    # --- overwrite re-authored top-level fields ---
    for k in ["keyTakeaway","tryThisNow","breakdown","implementationPlan","memorableLines"]:
        if k not in a: errs.append(f"missing {k}"); continue
        base[k]=a[k]

    # --- reviewCards: take authored, force sequential cardId ---
    cards=a.get("reviewCards",[])
    if len(cards)<6: errs.append(f"cards={len(cards)}")
    for i,c in enumerate(cards): c["cardId"]=f"card{i+1:02d}"
    base["reviewCards"]=cards

    # --- quiz: take authored, force correctIndex sequence, sequential questionId ---
    q=a.get("quiz",{})
    qs=q.get("questions",[])
    if len(qs)!=9: errs.append(f"quiz Qs={len(qs)}")
    seq=SEQ[nn]
    for i,question in enumerate(qs):
        question["questionId"]=f"q{i+1:02d}"
        if i<len(seq): question["correctIndex"]=seq[i]
        if len(question.get("choices",[]))!=3: errs.append(f"q{i+1} choices={len(question.get('choices',[]))}")
        # strip any stray legacy alias
        question.pop("correctAnswerIndex",None)
    base["quiz"]={"passingScorePercent":q.get("passingScorePercent",70),"questions":qs}

    # --- examples: keep original exampleId/tags/planSpec, take authored prose ---
    orig_ex={e["exampleId"]:e for e in base.get("examples",[])}
    orig_order=[e["exampleId"] for e in base.get("examples",[])]
    auth_ex=a.get("examples",[])
    if len(auth_ex)!=len(orig_order): errs.append(f"examples auth={len(auth_ex)} orig={len(orig_order)}")
    new_examples=[]
    for i,eid in enumerate(orig_order):
        o=orig_ex[eid]
        # match authored by index (authored exampleIds should align)
        ae=auth_ex[i] if i<len(auth_ex) else {}
        merged=dict(o)  # keep exampleId, tags, planSpec, etc.
        for f in ["title","scenario","whatToDo","whyItMatters"]:
            if f in ae: merged[f]=ae[f]
            else: errs.append(f"ex{i+1} missing {f}")
        new_examples.append(merged)
    base["examples"]=new_examples

    # --- re-affirm protected fields from original (they are already in base) ---
    # (base already holds the originals; nothing to do, but assert presence)
    for p in PROTECTED:
        if p not in base: errs.append(f"protected missing {p}")

    # --- A11 invariant: each memorable line text must appear in breakdown ---
    hay="\n".join([base["breakdown"].get("fastRead",""),base["breakdown"].get("deepRead",""),base["breakdown"].get("fullRead","")])
    for i,m in enumerate(base.get("memorableLines",[])):
        if m.get("text","") not in hay: errs.append(f"memorableLine[{i}] NOT verbatim in breakdown")

    # --- em dash check ---
    if "—" in json.dumps(base, ensure_ascii=False): errs.append("EM DASH present")

    if errs:
        print(f"ch{nn:02d}: ERRORS: {errs}")
        return False
    json.dump(base, open(chap_path,"w"), ensure_ascii=False, indent=2)
    print(f"ch{nn:02d}: spliced OK -> {chap_path}")
    return True

if __name__=="__main__":
    args=sys.argv[1:]
    nums=[int(x) for x in args] if args else list(range(1,21))
    ok=0
    for n in nums:
        if splice(n): ok+=1
    print(f"\n{ok}/{len(nums)} spliced cleanly")
