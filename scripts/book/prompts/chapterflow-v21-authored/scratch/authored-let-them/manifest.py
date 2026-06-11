#!/usr/bin/env python3
"""Emit a per-chapter repair manifest: for each chapter, the exact colliding
5-grams (shared by >=3 chapters) and which field they sit in, so a repair agent
can reword precisely. Also folds in known chapter-level findings."""
import json, re
from collections import defaultdict

CHAP="/Users/radinsoltani/ChapterFlow/scripts/book/prompts/chapterflow-v21-authored/state/chapters"
STOP={"the","and","that","this","with","from","have","were","will","what","when",
"where","which","while","their","them","they","these","those","then","than","into",
"over","under","about","after","before","because","could","would","should","might",
"still","just","also","very","more","most","some","many","much","other","another",
"here","there","both"}

def windows(text):
    out=set(); toks=[t for t in text.split() if t]
    for s in range(len(toks)-4):
        sl=toks[s:s+5]; cc=0
        for tok in sl:
            w=re.sub(r"[^a-z0-9'-]","",tok.lower())
            if len(w)<4 or w in STOP: continue
            cc+=1
        if cc>=3: out.add(" ".join(sl))
    return out

chs={n:json.load(open(f"{CHAP}/the-let-them-theory-ch{n:02d}.v21-native.chapter.json")) for n in range(1,21)}

def bd_fields(d):
    b=d["breakdown"]; return [("breakdown.fastRead",b["fastRead"]),("breakdown.deepRead",b["deepRead"]),("breakdown.fullRead",b["fullRead"])]
def ex_fields(d):
    out=[]
    for i,e in enumerate(d["examples"]):
        for f in ("scenario","whatToDo","whyItMatters"):
            if e.get(f): out.append((f"examples[{i}].{f}",e[f]))
    return out

manifest={n:{"breakdown":[], "examples":[]} for n in range(1,21)}
for grp,fieldfn,key in [("bd",bd_fields,"breakdown"),("ex",ex_fields,"examples")]:
    win2ch=defaultdict(set); win2loc=defaultdict(lambda: defaultdict(set))
    for n in range(1,21):
        for unit,txt in fieldfn(chs[n]):
            for w in windows(txt):
                win2ch[w].add(n); win2loc[w][n].add(unit)
    for w,cs in win2ch.items():
        if len(cs)>=3:
            for n in cs:
                for unit in win2loc[w][n]:
                    manifest[n][key].append({"phrase":w,"unit":unit,"shared_with":sorted(cs)})

# chapter-level extras
manifest[4]["chapterLevel"]=["C8: examples 1,3,5 share 'she has to decide whether' (within-chapter) - give each example a DIFFERENT decision-cue phrasing"]
manifest[14]["chapterLevel"]=["C13: example[0] scenario contains 'the only person' and example[1] 'the only place' - reword so the word 'only' is not used as 'the only <noun>'"]
manifest[19]["chapterLevel"]=["C10: 4 of 6 example titles have 'the' as 2nd word - rewrite titles to distinct shapes","B1: reviewCards[4] back contains meta-reference 'the author' - reword to state the idea directly"]

for n in range(1,21):
    m=manifest[n]
    if not m["breakdown"] and not m["examples"] and "chapterLevel" not in m: continue
    print(f"\n### ch{n:02d}")
    for item in m["breakdown"]:
        print(f"  BREAKDOWN {item['unit']}: reword '{item['phrase']}' (shared w/ ch{item['shared_with']})")
    for item in m["examples"]:
        print(f"  EXAMPLE {item['unit']}: reword '{item['phrase']}' (shared w/ ch{item['shared_with']})")
    for c in m.get("chapterLevel",[]):
        print(f"  CHAPTER-LEVEL {c}")

json.dump(manifest, open("/Users/radinsoltani/ChapterFlow/scripts/book/prompts/chapterflow-v21-authored/scratch/authored-let-them/repair-manifest.json","w"), indent=1)
print("\n[manifest written]")
