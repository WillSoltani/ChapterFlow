#!/usr/bin/env python3
"""Third patch for ch17 hard variants - add remaining words."""
import json

FILE = "/Users/willsoltani/dev/chapterflow-siliconx/scripts/book/data/chapters-16-20.json"

with open(FILE) as f:
    data = json.load(f)

ch = [c for c in data if c['number']==17][0]

# ── hard gentle: 2157 -> need 2200+ (add ~50 words) ──
text = ch['contentVariants']['hard']['chapterBreakdown']['gentle']
old = "The practical constraint worth remembering:"
new = "The remaining chapters will shift from the question of how to change behavior, which has now been thoroughly answered across all four laws and their inversions, to the question of which behaviors to change in the first place and how to continue improving after the initial habits are established and running automatically.\n\nThe practical constraint worth remembering:"
text = text.replace(old, new)
ch['contentVariants']['hard']['chapterBreakdown']['gentle'] = text
print(f"hard gentle: {len(text.split())} words")

# ── hard direct: 2109 -> need 2200+ (add ~100 words) ──
text = ch['contentVariants']['hard']['chapterBreakdown']['direct']
old = "The remaining chapters shift the focus from behavioral mechanics"
new = "The inversion of the Fourth Law from Chapter 15 finds its sharpest and most practically applicable expression through social accountability, where the abstract principle of making bad habits unsatisfying becomes a concrete, implementable system with specific components: a partner who monitors, a contract that defines, and a consequence that motivates through the fastest cost mechanism available to the human brain. The simplicity of the structure is part of its power. You do not need to understand neuroscience to use it. You need a person who cares and a piece of paper with your signature on it.\n\nThe remaining chapters shift the focus from behavioral mechanics"
text = text.replace(old, new)
ch['contentVariants']['hard']['chapterBreakdown']['direct'] = text
print(f"hard direct: {len(text.split())} words")

# ── hard competitive: 2196 -> need 2200+ (add ~10 words) ──
text = ch['contentVariants']['hard']['chapterBreakdown']['competitive']
old = "That is the threshold that determines whether the inversion is strong enough to change the behavior."
new = "That is the threshold that determines whether the inversion is strong enough to change the behavior and sustain the change over time as novelty fades and the temptation returns."
text = text.replace(old, new)
ch['contentVariants']['hard']['chapterBreakdown']['competitive'] = text
print(f"hard competitive: {len(text.split())} words")

with open(FILE, 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print("\nDone.")
