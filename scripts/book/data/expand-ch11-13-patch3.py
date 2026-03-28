#!/usr/bin/env python3
"""Patch round 3: fill remaining hard difficulty fields to 2200-2600 words."""

import json, os

FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "chapters-11-15.json")

PATCHES = {}

# CH11 hard gentle: 2124 -> need +76-476
PATCHES[(11, "hard", "gentle")] = """

There is a final thought that brings this chapter full circle. The photography students who were graded on quantity did not set out to take great photos. They set out to take many photos. The greatness emerged as a side effect of volume. In the same way, you do not need to set out to build the perfect habit. You need to set out to perform the habit as many times as possible, in as many contexts as possible, with as little regard for perfection as you can manage. The perfection will come. It always does, when the foundation of repetitions is deep enough. Your job is not to be perfect. Your job is to be prolific. Stack the reps. Trust the neuroscience. And remember that every single time you choose action over motion, you are one step closer to the version of yourself who does this without thinking about it. That version is not a fantasy. It is a neurological inevitability, waiting on the other side of enough repetitions."""

# CH11 hard direct: 1782 -> need +418-818
PATCHES[(11, "hard", "direct")] = """

There is a final clinical point that ties the entire chapter into a single actionable framework. The habit line, the prefrontal-to-basal-ganglia transfer, long-term potentiation, Hebb's rule, the motion-action distinction, and the rep-versus-time reframe are all describing the same underlying process from different angles. The process is simple: repeated performance of a behavior causes neurological changes that make the behavior progressively more automatic. Every concept in this chapter is a lens on that single process.

The actionable framework derived from these concepts has four components. First, identify the behavior you want to automate. Be specific. "Exercise" is too vague. "Do twenty pushups after brushing my teeth in the morning" is specific enough to generate a clear neural pathway. Second, eliminate as much motion as possible and replace it with action. Stop researching the optimal pushup form and start doing pushups. The form will improve through repetition. Third, maximize daily repetition frequency. If you can find three opportunities per day to perform the behavior, you will reach automaticity three times faster than if you perform it once per day. Look for opportunities to practice in different contexts, at different times, and in different environments. Each context adds resilience to the habit because the neural pathway becomes associated with multiple cues. Fourth, measure your progress in total reps, not in calendar days. Keep a tally if it helps. Each tally mark is a real, physical representation of the neural strengthening that is occurring below conscious awareness.

The photography class taught us that prolific creators outperform careful planners. The neuroscience of long-term potentiation explains why. The distinction between motion and action tells us where to focus our energy. And the rep-based reframe of habit formation timelines tells us exactly how to measure our progress. This chapter is not abstract theory. It is a biological instruction manual for building automatic behavior. Follow the instructions, stack the reps, and the habit line will take care of itself."""

# CH11 hard competitive: 2032 -> need +168-568
PATCHES[(11, "hard", "competitive")] = """

The final takeaway is tactical and unambiguous. The Third Law, Make It Easy, is not about comfort. It is about rep efficiency. Every concept in this chapter, the photography class, long-term potentiation, Hebb's rule, the habit line, the prefrontal-to-basal-ganglia transfer, and the motion-action distinction, converges on a single instruction: maximize your daily repetition count for the target behavior. Find every opportunity to practice. Do not wait for ideal conditions. Do not postpone until you feel ready. Do not spend another hour in motion. Start stacking reps now, today, imperfectly, consistently, and relentlessly. The person who stacks the most reps in the next ninety days will be in a position that no amount of planning, motivation, or talent can replicate. Because automaticity, once achieved, is permanent infrastructure. It does not decay when motivation fades. It does not collapse when life gets hard. It runs silently in the background, producing results while you focus your conscious energy elsewhere. That is the prize. And the price is reps. Pay it."""

# CH12 hard gentle: 2018 -> need +182-582
PATCHES[(12, "hard", "gentle")] = """

There is one more thing worth saying about this chapter before moving on. The advice here is not glamorous. Nobody writes inspirational quotes about unplugging their television or laying out their gym clothes. Nobody posts on social media about moving the fruit bowl to the counter. These are small, quiet, unglamorous actions that happen in private and produce results that take weeks to notice. But they are among the most effective behavior change strategies available to you. Glamorous strategies, like hiring a personal trainer, joining an expensive gym, or committing to a radical life overhaul, often fail because they depend on sustained motivation and high ongoing effort. Friction reduction depends on neither. It is a one-time environmental adjustment that works every single day thereafter without requiring any additional investment from you. The book on your pillow does not need your motivation to be there. It just is there, and because it is there, you pick it up. That is the power of designing for least effort. It is not about lowering your standards. It is about building a life where the standard is met by default, because the environment was designed to make it inevitable."""

# CH12 hard direct: 1812 -> need +388-788
PATCHES[(12, "hard", "direct")] = """

A final synthesis of the chapter's argument: the Third Law, Make It Easy, is an instruction to shift your behavior change strategy from the internal to the external. Most people try to change behavior by changing themselves: their motivation, their discipline, their mindset, their attitude. This chapter argues that changing the environment is more effective, more reliable, and more sustainable. The environment persists when motivation fluctuates. The environment operates 24 hours per day, including the hours when your willpower is depleted. The environment does not require ongoing cognitive investment to maintain.

The practical protocol is systematic. For each desired habit, map the complete sequence from cue to completed behavior. Count the steps. Identify every step that can be eliminated or shortened. Implement the elimination. Then test the new sequence for one week and note any remaining friction points. Iterate until the sequence is as short and effortless as possible. For each undesired habit, perform the same mapping in reverse. Count the steps and then add steps. Each added step is a friction point that reduces the probability of the behavior executing automatically.

The environment you design today is the behavior you perform tomorrow. This chapter is the bridge between understanding that principle and implementing it. The implementation is not complicated. It is a series of small, physical adjustments to your living and working spaces that tilt the effort equation in your favor. The adjustments are permanent. The benefits compound daily. And the result, over months and years, is a life where good habits are the default and bad habits are the exception, not because you have extraordinary willpower, but because you have an extraordinary environment. That is the legacy of the Third Law. Build the environment. Let the environment build the habits. And let the habits build the life."""

# CH12 hard competitive: 1856 -> need +344-744
PATCHES[(12, "hard", "competitive")] = """

The final strategic point is about the long-term compounding of friction engineering. Each habit you automate through friction reduction frees up willpower that was previously spent on maintaining that habit manually. That freed willpower can then be invested in building the next habit. The person who automates their first habit in month one has extra willpower capacity in month two. They use that capacity to build a second habit while still maintaining the first on autopilot. By month six, they have five or six automated habits running simultaneously, each one requiring zero willpower, while their competitor is still struggling to maintain their first habit through brute-force discipline.

This is the compounding engine that makes friction engineering the single most powerful tool in the habit builder's arsenal. Each automated habit is not just a behavior. It is a willpower investment that pays dividends by freeing capacity for the next behavior. The person who starts engineering friction on day one and continues systematically has an exponential advantage over the person who relies on motivation for each individual habit. The motivation-dependent person hits a willpower ceiling after two or three simultaneous habits. The friction-engineering person never hits a ceiling because each new habit is supported by environmental design rather than cognitive effort.

This is the competitive endgame. Not one habit built through willpower. Not two habits built through discipline. But an entire ecosystem of automated behaviors, each one running on environmental design, each one freeing capacity for the next, each one compounding the advantage that was established by the simple, unsexy act of removing friction from the first behavior. That is what the Third Law builds when you apply it systematically, and it is an advantage that no amount of motivation or talent can overcome."""

# CH13 hard gentle: 1966 -> need +234-634
PATCHES[(13, "hard", "gentle")] = """

There is one more layer to this chapter that is easy to overlook in the focus on practical techniques. The Two-Minute Rule is ultimately an act of self-compassion. It says: you do not have to be perfect to make progress. You do not have to have a great day to show up. You do not have to feel motivated, inspired, or energetic. You just have to do two minutes. That is enough. That counts. And that counting is what makes the difference over time. In a culture that glorifies hustle and intensity, giving yourself permission to do the minimum can feel like surrender. But it is not surrender. It is strategy. It is the recognition that a sustainable minimum, performed every single day, produces better long-term results than an ambitious maximum performed sporadically.

Clear is asking you to trust that small things add up. He is asking you to believe that one page, one pushup, one minute of breathing is not too small to matter. And the science backs him up completely. Each of those tiny actions fires a neural circuit, deposits an identity vote, maintains a streak, and moves you one increment closer to the person you want to become. The Two-Minute Rule is not the ceiling of what you can achieve. It is the floor that prevents you from ever hitting zero. And a floor of one page per day, 365 days per year, will carry you further than most people travel in a lifetime of ambitious plans that never survive their first encounter with a bad Tuesday."""

# CH13 hard direct: 1823 -> need +377-777
PATCHES[(13, "hard", "direct")] = """

There is a broader principle embedded in the Two-Minute Rule that applies beyond habit formation: the principle that minimum viable consistency outperforms maximum occasional effort in virtually every domain where long-term compounding matters. A minimum viable reading habit of one page per day produces 365 pages per year, roughly two books, with zero days of failure and zero internal negotiation. A maximum-effort reading goal of one book per month produces twelve books per year in theory, but in practice, missed months and broken streaks typically reduce the actual output to five or six books, which is not dramatically more than the minimum-viable approach, and which comes at a much higher psychological cost.

The Two-Minute Rule is the behavioral application of this principle. It selects for the minimum viable version of any habit and builds from there. The selection is not arbitrary. It is calibrated to the threshold below which compliance is essentially guaranteed. If the habit is small enough that doing it is easier than deciding not to do it, compliance approaches 100 percent. And 100 percent compliance over time is what produces the neural adaptation, the identity reinforcement, and the streak psychology that make the habit permanent.

This is why the chapter's advice feels counterintuitive to high achievers. High achievers are conditioned to believe that more is better, that intensity produces results, that anything worth doing is worth doing at full capacity. The Two-Minute Rule challenges that belief directly. It argues that less is more when "less" can be sustained indefinitely and "more" cannot. The evidence supports the argument. Consistency of execution beats intensity of effort across every timeframe longer than a few weeks. And the Two-Minute Rule is the simplest, most reliable method available for producing that consistency. Start small. Stay small until it is automatic. Then grow. That is the protocol. That is the chapter. And that is how habits are actually built."""

# CH13 hard competitive: 1908 -> need +292-692
PATCHES[(13, "hard", "competitive")] = """

The broader principle at work here is that minimum viable consistency beats maximum occasional effort in every compounding domain. One page per day is 365 pages per year, roughly two books, with a perfect attendance record. One hour of reading once a week, which sounds more impressive, produces about 52 hours per year, but missed weeks reduce the actual total to maybe 35 hours, and the broken streaks undermine the identity-building process. The two-minute habit wins the math, wins the psychology, and wins the neuroscience.

This is the insight that separates strategic habit builders from ambitious habit failures. The strategic builder optimizes for consistency. The ambitious failure optimizes for intensity. Intensity feels good in the moment but produces erratic repetition patterns. Consistency feels boring but produces the unbroken chains that drive neural adaptation, identity reinforcement, and automaticity. The Two-Minute Rule is the tool that guarantees consistency by making the daily commitment too small to refuse.

This chapter is the culmination of the Third Law. Make It Easy started with the principle that behavior follows the path of least effort. Chapter 12 applied that principle to the environment. This chapter applies it to the behavior itself. Together, they create a system where the desired habit is the easiest thing you can do at the designated moment: the environment is primed, the friction is zero, and the behavior takes two minutes. Under those conditions, performing the habit requires less effort than not performing it. And when performing the habit is the path of least resistance, your brain's natural laziness becomes your greatest asset. You do not need willpower. You do not need motivation. You just need a system designed so well that the habit is the default. The Two-Minute Rule is the final piece of that system, and the person who deploys it correctly will outperform everyone who does not, not because they work harder, but because they engineered a game they cannot lose."""

# ═══════════════════════════════════════════════════════════════════════════════

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

# Trim any over-target
TARGETS = {"easy": (450, 550), "medium": (1100, 1400), "hard": (2200, 2600)}

def trim_to_target(text, max_words):
    words = text.split()
    if len(words) <= max_words:
        return text
    trimmed = " ".join(words[:max_words])
    last_period = trimmed.rfind(".")
    if last_period > len(trimmed) * 0.8:
        trimmed = trimmed[:last_period + 1]
    return trimmed

for chapter in data:
    ch_num = chapter["number"]
    if ch_num not in (11, 12, 13):
        continue
    for difficulty in ["easy", "medium", "hard"]:
        lo, hi = TARGETS[difficulty]
        for tone in ["gentle", "direct", "competitive"]:
            text = chapter["contentVariants"][difficulty]["chapterBreakdown"][tone]
            wc = len(text.split())
            if wc > hi:
                chapter["contentVariants"][difficulty]["chapterBreakdown"][tone] = trim_to_target(text, hi)

with open(FILE, "w") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
    f.write("\n")

print("=" * 70)
print("WORD COUNT VERIFICATION (after patch 3)")
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
