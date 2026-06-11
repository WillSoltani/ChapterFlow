#!/usr/bin/env python3
"""Exact replica of BP13 (book pattern audit): 5-token windows over example
scenario/whatToDo/whyItMatters, keep names+stopwords, require >=2 content
tokens (len>=4 not in the short stoplist), fire when a window appears in
>= max(3, ceil(N*0.1)) chapters. Also flags F1-style protagonist-name reuse
and Q-position prompt-opener clustering (BP16)."""
import json, re
from collections import defaultdict

CHAP="/Users/radinsoltani/ChapterFlow/scripts/book/prompts/chapterflow-v21-authored/state/chapters"
STOP={"the","and","that","this","with","from","have","were","will","what","when",
"where","which","while","their","them","they","these","those","then","than","into",
"over","under","about","after","before","because","could","would","should","might",
"still","just","also","very","more","most","some","many","much","other","another",
"here","there","both"}
chs={n:json.load(open(f"{CHAP}/the-let-them-theory-ch{n:02d}.v21-native.chapter.json")) for n in range(1,21)}
THRESH=max(3, -(-20//10))  # ceil(20*0.1)=2 -> max(3,2)=3

def content(tok):
    w=re.sub(r"[^a-z0-9'-]","",tok.lower())
    return len(w)>=4 and w not in STOP

win2ch=defaultdict(set); win2loc=defaultdict(list)
for n in range(1,21):
    seen=set()
    for i,ex in enumerate(chs[n]["examples"]):
        for field in ("scenario","whatToDo","whyItMatters"):
            raw=ex.get(field) or ""
            toks=[t for t in raw.split() if t]
            for s in range(len(toks)-4):
                sl=toks[s:s+5]
                if sum(1 for t in sl if content(t))<2: continue
                p=" ".join(sl)
                if p in seen: continue
                seen.add(p)
                win2ch[p].add(n); win2loc[p].append((n,f"ex{i}.{field}"))
bad={p:sorted(cs) for p,cs in win2ch.items() if len(cs)>=THRESH}
print(f"===== BP13: {len(bad)} windows in >=3 chapters (threshold {THRESH}) =====")
for p,cs in sorted(bad.items(), key=lambda x:-len(x[1])):
    print(f"  [{len(cs)}ch {cs}] {p!r}")

# F1 source-name reuse: extract Capitalized multi-char words in scenarios that look like person names
print("\n===== possible cross-chapter NAME reuse in scenarios =====")
name2ch=defaultdict(set)
COMMON={"The","A","An","When","Before","After","Two","Both","Most","She","He","They","It","That","This","Her","His","Their","For","Her","Now"}
for n in range(1,21):
    blob=" ".join(e.get("scenario","") for e in chs[n]["examples"])
    for m in re.findall(r"\b[A-Z][a-z]{2,}\b", blob):
        if m in COMMON: continue
        name2ch[m].add(n)
for nm,cs in sorted(name2ch.items()):
    if len(cs)>=2:
        print(f"  {nm}: {sorted(cs)}")

# BP16 Q-position opener clustering
print("\n===== Q-position prompt opener clustering (first 3 words) =====")
for qi in range(9):
    op2ch=defaultdict(list)
    for n in range(1,21):
        qs=chs[n]["quiz"]["questions"]
        if qi<len(qs):
            op=" ".join(qs[qi]["prompt"].split()[:3]).lower()
            op2ch[op].append(n)
    for op,cs in op2ch.items():
        if len(cs)>=4: print(f"  q{qi+1:02d} opener '{op}' in {len(cs)} ch: {cs}")
