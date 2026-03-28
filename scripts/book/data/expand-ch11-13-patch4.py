#!/usr/bin/env python3
"""Patch round 4: final small additions to 4 remaining under-target hard fields."""

import json, os

FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "chapters-11-15.json")

PATCHES = {}

# CH11 hard direct: 2103 -> need +97-497
PATCHES[(11, "hard", "direct")] = """

One final observation. The photography class is not just an anecdote. It is a controlled comparison of two approaches to skill development, and the results are unambiguous. Volume-based practice, which generates high repetition density and rapid feedback cycling, outperforms deliberation-based practice, which generates low repetition density and minimal feedback. The principle scales beyond photography to any domain where habit formation is the objective. Building a meditation practice, learning an instrument, developing a fitness routine, establishing a writing habit, all of these follow the same pattern. The person who accumulates the most repetitions in the shortest timeframe will reach automaticity first, and automaticity is the point where the habit becomes self-sustaining. Everything before automaticity is fragile. Everything after it is durable. The Third Law is your map to that transition point, and repetitions are the steps that carry you there."""

# CH11 hard competitive: 2199 -> need +1-401
PATCHES[(11, "hard", "competitive")] = """

The photography class is not a metaphor. It is a prediction of what will happen to you if you choose volume over perfection. The quantity group won because they played the right game. The quality group lost because they played the wrong one. You get to choose which group you join, and you make that choice every single day with every rep you either do or skip."""

# CH12 hard direct: 2111 -> need +89-489
PATCHES[(12, "hard", "direct")] = """

The chapter's central claim, restated in clinical terms: the most reliable predictor of whether a behavior will occur on any given day is the number of friction points between the cue and the completed behavior, not the person's motivation level, not their stated commitment, and not their past success with the behavior. Friction is the dominant variable. Motivation is the noise. If you want to predict and control your own behavior with precision, stop measuring your motivation and start measuring your friction. Count the steps. Reduce the count. The behavior will follow, not because you willed it, but because the physics of least effort made it inevitable."""

# CH13 hard direct: 2139 -> need +61-461
PATCHES[(13, "hard", "direct")] = """

The chapter's central instruction, distilled to its essence: the correct sequence for building any habit is to start with the smallest possible version, establish perfect daily attendance at that version, expand only when the current version triggers zero internal resistance, and repeat the expand-and-stabilize cycle until the full target behavior is reached. This sequence works because it respects the neurological requirements for automaticity, the psychological requirements for identity change, and the practical requirements for surviving real-world variability. Violating the sequence by starting large, expanding early, or skipping the stabilization phase will produce short-term results and long-term failure. Following it will produce long-term results that compound indefinitely."""

with open(FILE, "r") as f:
    data = json.load(f)

for chapter in data:
    ch_num = chapter["number"]
    if ch_num not in (11, 12, 13):
        continue
    for difficulty in ["easy", "medium", "hard"]:
        for tone in ["gentle", "direct", "competitive"]:
            key = (ch_num, difficulty, tone)
            if key in PATCHES:
                current = chapter["contentVariants"][difficulty]["chapterBreakdown"][tone]
                chapter["contentVariants"][difficulty]["chapterBreakdown"][tone] = current + PATCHES[key]

with open(FILE, "w") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
    f.write("\n")

TARGETS = {"easy": (450, 550), "medium": (1100, 1400), "hard": (2200, 2600)}
print("=" * 70)
print("FINAL WORD COUNT VERIFICATION")
print("=" * 70)
all_ok = True
for chapter in data:
    ch_num = chapter["number"]
    if ch_num not in (11, 12, 13):
        continue
    print(f"\nChapter {ch_num}: {chapter['title']}")
    for difficulty in ["easy", "medium", "hard"]:
        lo, hi = TARGETS[difficulty]
        for tone in ["gentle", "direct", "competitive"]:
            text = chapter["contentVariants"][difficulty]["chapterBreakdown"][tone]
            wc = len(text.split())
            ok = lo <= wc <= hi
            status = "OK" if ok else f"MISS ({wc})"
            if not ok:
                all_ok = False
            print(f"  {difficulty:6s}/{tone:12s}: {wc:4d} words  [{lo}-{hi}] {status}")

print("\n" + ("ALL PASS" if all_ok else "SOME MISSED TARGET"))
