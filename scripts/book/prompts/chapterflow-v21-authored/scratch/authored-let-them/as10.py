#!/usr/bin/env python3
"""Replica of AS10 (+ cross-chapter dup key/distractor + AS12 + book n-gram)
to find every cross-chapter collision authoritatively. Reports 5-token windows
(>=3 content tokens) shared by >=3 chapters within the breakdown pool and the
examples pool separately (AS10 fires when shared by >=3 chapters)."""
import json, os, re
from collections import defaultdict

CHAP="/Users/radinsoltani/ChapterFlow/scripts/book/prompts/chapterflow-v21-authored/state/chapters"
STOP={"the","and","that","this","with","from","have","were","will","what","when",
"where","which","while","their","them","they","these","those","then","than","into",
"over","under","about","after","before","because","could","would","should","might",
"still","just","also","very","more","most","some","many","much","other","another",
"here","there","both"}

def windows(text):
    out=set()
    toks=[t for t in text.split() if t]
    for s in range(len(toks)-4):
        sl=toks[s:s+5]
        cc=0
        for tok in sl:
            w=re.sub(r"[^a-z0-9'-]","",tok.lower())
            if len(w)<4: continue
            if w in STOP: continue
            cc+=1
        if cc<3: continue
        out.add(" ".join(sl))
    return out

chs={}
for n in range(1,21):
    chs[n]=json.load(open(f"{CHAP}/the-let-them-theory-ch{n:02d}.v21-native.chapter.json"))

def pool_breakdown(d):
    b=d["breakdown"];
    return windows(b["fastRead"])|windows(b["deepRead"])|windows(b["fullRead"])
def pool_examples(d):
    s=set()
    for e in d["examples"]:
        for f in ("scenario","whatToDo","whyItMatters"):
            if e.get(f): s|=windows(e[f])
    return s

for name,poolfn in [("BREAKDOWN",pool_breakdown),("EXAMPLES",pool_examples)]:
    win2ch=defaultdict(set)
    for n in range(1,21):
        for w in poolfn(chs[n]): win2ch[w].add(n)
    bad={w:sorted(cs) for w,cs in win2ch.items() if len(cs)>=3}
    print(f"\n===== {name}: {len(bad)} windows shared by >=3 chapters =====")
    for w,cs in sorted(bad.items(), key=lambda x:-len(x[1])):
        print(f"  [{len(cs)}ch {cs}] {w!r}")

# cross-chapter duplicate quiz answer keys
print("\n===== DUPLICATE ANSWER KEYS across chapters =====")
key2loc=defaultdict(list)
for n in range(1,21):
    for q in chs[n]["quiz"]["questions"]:
        k=q["choices"][q["correctIndex"]].strip().lower()
        key2loc[k].append((n,q["questionId"]))
dup=False
for k,locs in key2loc.items():
    if len(set(c for c,_ in locs))>=2:
        print(f"  DUP KEY in {locs}: {k[:80]}"); dup=True
if not dup: print("  none")

# cross-chapter duplicate distractors (>=30 chars)
print("\n===== DUPLICATE DISTRACTORS (>=30 chars) across chapters =====")
d2loc=defaultdict(list)
for n in range(1,21):
    for q in chs[n]["quiz"]["questions"]:
        ci=q["correctIndex"]
        for i,c in enumerate(q["choices"]):
            if i==ci: continue
            k=c.strip().lower()
            if len(k)<30: continue
            d2loc[k].append((n,q["questionId"],i))
dd=False
for k,locs in d2loc.items():
    if len(set(c for c,_,_ in locs))>=2:
        print(f"  DUP DISTRACTOR in {locs}: {k[:70]}"); dd=True
if not dd: print("  none")

# AS12: identical correctIndex sequences
print("\n===== AS12 duplicate correctIndex sequences =====")
seq2ch=defaultdict(list)
for n in range(1,21):
    seq=",".join(str(q["correctIndex"]) for q in chs[n]["quiz"]["questions"])
    seq2ch[seq].append(n)
a12=False
for s,cs in seq2ch.items():
    if len(cs)>=2: print(f"  DUP SEQ {cs}: {s}"); a12=True
if not a12: print("  none")

# book-wide answer position balance
print("\n===== book answer positions =====")
pos=[0,0,0]
for n in range(1,21):
    for q in chs[n]["quiz"]["questions"]: pos[q["correctIndex"]]+=1
print(f"  {pos} maxfrac={max(pos)/sum(pos):.3f} (limit 0.45)")
