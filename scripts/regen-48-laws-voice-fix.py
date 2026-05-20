#!/usr/bin/env python3
"""Fix voice-tell deductions and counter-shape collision on the merged 48 Laws package.

Targets:
- Ch5/Ch26/Ch36 share "What looks like a..." counter opener (cap=2). Rewrite Ch36's counter.
- Ch7: counter contains "the author of a system" (meta-tell) and lacks paradox signal. Rewrite.
- Ch7 fullRead: "This Law makes people queasy" + "This Law inverts" — rephrase "This Law" -> "The discipline".
- Ch10 fullRead: "The author on the other end..." (the literary agent's client) — rephrase "author" -> "writer".
- Ch13 fullRead: "Franklin did not need the book" (Franklin literally borrowed a book) — rephrase.
- Ch25 fullRead: "the book" referring to Lela's actual novel — rephrase "the book" -> "the novel".
- Ch32 fullRead: heavy "the book"/"the author"/"the chapter" referring to the memoir Saskia is selling — rephrase.
"""
import json
from pathlib import Path

PATH = Path("/Users/willsoltani/dev/chapterflow-siliconx/book-packages/the-48-laws-of-power.v21.json")


def main():
    d = json.load(open(PATH))
    chapters = {c["number"]: c for c in d["chapters"]}

    # === Ch36 counter rewrite: break "What looks like a..." collision (Ch5/26/36) ===
    ch36 = chapters[36]
    ch36["counterintuition"] = (
        "A refusal to engage looks like surrender, but it is sometimes the only response that does not legitimize the attack. "
        "The attacker needs you to answer. Silence starves the story; the answer feeds it."
    )

    # === Ch7 counter rewrite: remove "the author" meta-tell + add paradox signal ===
    ch7 = chapters[7]
    ch7["counterintuition"] = (
        "Owning the credit for work you did not personally do is honest when the achievement is the system that produced the work. "
        "The architect of a system is not the person who wrote each line, but the person who arranged the conditions in which the lines could be written at all."
    )

    # === Ch7 fullRead: "This Law" -> "The discipline" (2 occurrences) ===
    full7 = ch7["breakdown"]["fullRead"]
    full7 = full7.replace("This Law makes people queasy", "The discipline makes people queasy")
    full7 = full7.replace("This Law inverts", "The discipline inverts")
    full7 = full7.replace("That order is the discipline of this Law.", "That order is the discipline at work.")
    # Memorable lines may reference these strings; check after
    ch7["breakdown"]["fullRead"] = full7

    # === Ch10 fullRead: "the author" -> "the writer" (referring to Soraya's literary client) ===
    full10 = ch10 = chapters[10]["breakdown"]["fullRead"]
    full10 = full10.replace("The author on the other end", "The writer on the other end")
    full10 = full10.replace("The author has not changed", "The writer has not changed")
    full10 = full10.replace("referring the author to", "referring the writer to")
    chapters[10]["breakdown"]["fullRead"] = full10

    # === Ch13 fullRead: "Franklin did not need the book" -> "Franklin did not need it" ===
    full13 = chapters[13]["breakdown"]["fullRead"]
    full13 = full13.replace("Franklin did not need the book.", "Franklin did not need to read it.")
    chapters[13]["breakdown"]["fullRead"] = full13

    # === Ch25 fullRead: "the book" referring to Lela's novel -> "the novel" ===
    for tier in ("fastRead", "deepRead", "fullRead"):
        t = chapters[25]["breakdown"][tier]
        t = t.replace("the book is scheduled", "the novel is scheduled")
        t = t.replace("The book is good enough", "The novel is good enough")
        t = t.replace("the book gives them", "the novel gives them")
        t = t.replace("the book changed them", "the novel changed them")
        t = t.replace("the book gave them", "the novel gave them")
        chapters[25]["breakdown"][tier] = t

    # === Ch32 fullRead: heavy memoir references — rephrase ===
    for tier in ("fastRead", "deepRead", "fullRead"):
        t = chapters[32]["breakdown"][tier]
        t = t.replace("the book will sell", "the memoir will sell")
        t = t.replace("the book lands at number eleven", "the memoir lands at number eleven")
        t = t.replace("the book changed them", "the memoir changed them")
        t = t.replace("the book gave them", "the memoir gave them")
        t = t.replace("The book lands", "The memoir lands")
        t = t.replace("The book gave them", "The memoir gave them")
        t = t.replace("the book the room", "the memoir the room")
        # "the author" -> "the writer" (Saskia's debut client)
        t = t.replace("the author's", "the writer's")
        t = t.replace("the author.", "the writer.")
        t = t.replace("the author,", "the writer,")
        t = t.replace("the author through", "the writer through")
        t = t.replace("the author describing", "the writer describing")
        t = t.replace("the author whose", "the writer whose")
        t = t.replace("the author wanted", "the writer wanted")
        t = t.replace("the chapter order", "the section order")
        chapters[32]["breakdown"][tier] = t

    # Verify memorable lines still match after rewrites
    issues = []
    for n in (7, 10, 13, 25, 32, 36):
        ch = chapters[n]
        prose = ch["breakdown"]["fastRead"] + "\n" + ch["breakdown"]["deepRead"] + "\n" + ch["breakdown"]["fullRead"]
        for i, ml in enumerate(ch["memorableLines"]):
            if ml["text"] not in prose:
                issues.append(f"Ch{n} memLine[{i}] BROKEN after voice-fix: '{ml['text'][:60]}...'")
    # Counter range check on Ch36 and Ch7 rewrites
    for n in (7, 36):
        c = chapters[n]["counterintuition"]
        if not (80 <= len(c) <= 280):
            issues.append(f"Ch{n} counter={len(c)} OUT OF RANGE 80-280")

    if issues:
        print("ISSUES after voice-fix:")
        for i in issues:
            print(f"  {i}")
        print("\nWill still write (may need separate fix), but flagging.")

    with open(PATH, "w") as f:
        json.dump(d, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"\nWrote voice-fixed package to {PATH}")
    print(f"Ch7 counter now {len(chapters[7]['counterintuition'])} chars")
    print(f"Ch36 counter now {len(chapters[36]['counterintuition'])} chars")


if __name__ == "__main__":
    main()
