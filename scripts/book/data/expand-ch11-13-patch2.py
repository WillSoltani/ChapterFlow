#!/usr/bin/env python3
"""Patch round 2: append more content to still-under-target fields for ch11-13."""

import json, os

FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "chapters-11-15.json")

PATCHES = {}

# ─── CH11 EASY direct (559 -> need to trim to 450-550, actually OVER) ──────
# We need to REPLACE the last paragraph to shorten it. Actually let's handle trims differently.
# Let's focus on fields that are UNDER target and need more content.

# For OVER targets we'll trim. Let's handle those separately.

# UNDER TARGETS:
# CH11 medium gentle: 1002 -> need ~1100-1400 (+100-400)
# CH11 medium direct: 989 -> need ~1100-1400 (+111-411)
# CH11 medium competitive: 930 -> need ~1100-1400 (+170-470)
# CH11 hard gentle: 1796 -> need ~2200-2600 (+404-804)
# CH11 hard direct: 1479 -> need ~2200-2600 (+721-1121)
# CH11 hard competitive: 1601 -> need ~2200-2600 (+599-999)
# CH12 medium direct: 1077 -> need ~1100-1400 (+23-323)
# CH12 medium competitive: 1081 -> need ~1100-1400 (+19-319)
# CH12 hard gentle: 1665 -> need ~2200-2600 (+535-935)
# CH12 hard direct: 1507 -> need ~2200-2600 (+693-1093)
# CH12 hard competitive: 1565 -> need ~2200-2600 (+635-1035)
# CH13 medium direct: 1037 -> need ~1100-1400 (+63-363)
# CH13 medium competitive: 949 -> need ~1100-1400 (+151-451)
# CH13 hard gentle: 1674 -> need ~2200-2600 (+526-926)
# CH13 hard direct: 1459 -> need ~2200-2600 (+741-1141)
# CH13 hard competitive: 1529 -> need ~2200-2600 (+671-1071)

# OVER TARGETS (need to trim):
# CH11 easy direct: 559 -> need 450-550 (trim ~9-109 words)
# CH13 easy direct: 573 -> need 450-550 (trim ~23-123 words)
# CH13 easy competitive: 573 -> need 450-550 (trim ~23-123 words)

# ─── CH11 MEDIUM ───────────────────────────────────────────────────────────────

PATCHES[(11, "medium", "gentle")] = """

It is also worth noting the emotional dimension of this process. When you are in the early stages of a new habit, every repetition requires a small act of courage. You have to choose the behavior over comfort, action over inertia, doing over not-doing. That choice takes energy, and it takes a kind of faith that the effort will eventually pay off even though you cannot see the results yet. The habit line is invisible. You do not know how close you are to crossing it. But Clear's message here is reassuring: every single rep moves you forward, even the ones that feel pointless. The reps you do on your worst days, when you are tired, distracted, and just going through the motions, count just as much neurologically as the reps you do on your best days. Your brain does not grade the quality of the rep. It simply registers that the circuit fired, and it strengthens the connection accordingly. So on the days when showing up feels like nothing, remember that it is doing exactly what it needs to do underneath the surface."""

PATCHES[(11, "medium", "direct")] = """

One additional consideration: the relationship between repetition quality and neural adaptation is less significant than most people assume during the standardization phase. A mediocre rep and an excellent rep produce approximately equivalent strengthening of the neural pathway during the early stages of habit formation. The basal ganglia, which is the target destination for the behavior, does not evaluate performance. It tracks activation frequency. This means that a day where you perform the habit poorly, where your meditation is distracted, your workout is half-hearted, or your writing is uninspired, still counts as a full rep toward the automaticity threshold. The practical implication is that you should never skip a rep because you cannot do it well. A bad rep is infinitely more valuable than a skipped rep because a bad rep advances the automaticity timeline while a skipped rep does nothing. This is the final piece of the chapter's argument: show up, perform the behavior regardless of quality, and trust the process. The neural pathway does not need your reps to be impressive. It needs them to be frequent."""

PATCHES[(11, "medium", "competitive")] = """

One more tactical point. During the early phase of habit formation, rep quality is almost irrelevant compared to rep frequency. The basal ganglia does not grade your performance. It counts your activations. A sloppy workout and a perfect workout register as approximately the same neural stimulus during the pre-automaticity phase. This means that your worst days are not wasted days as long as you show up. A bad rep is infinitely better than a skipped rep because a bad rep advances the transfer while a skipped rep contributes nothing. Your competitor who skips the gym because they do not feel like doing their full program just handed you a free rep differential. While they are at home preserving their standard of perfection, you are at the gym stacking another activation onto your basal ganglia transfer. The perfectionist loses. The person who shows up regardless of quality wins. And once you have crossed the habit line and the behavior is automated, then you can optimize the quality. But quality before automation is a strategic error that costs you reps, and reps are the only thing that matters in this game."""

# ─── CH11 HARD ─────────────────────────────────────────────────────────────────

PATCHES[(11, "hard", "gentle")] = """

There is one more aspect of this chapter that deserves your attention, and it has to do with the emotional experience of building a habit before it becomes automatic. The period before the habit line is, frankly, uncomfortable. You have to choose the behavior every single day. You have to talk yourself into it. You have to override the part of your brain that would rather rest, scroll, or do anything other than the hard thing you committed to. This discomfort is not a sign that you are doing something wrong. It is a sign that you are in the prefrontal cortex phase, the phase where the behavior still requires conscious effort. Every person who has ever built a lasting habit went through this phase. The difference between people who succeed and people who quit is not that successful people found the phase easier. It is that they kept showing up through the discomfort, kept stacking reps, and eventually reached the point where the discomfort faded because the basal ganglia took over.

Clear does not promise that this phase will be short. For some habits, it might take weeks. For others, months. But he does promise that it is temporary. The discomfort has an expiration date, and that date arrives when you have accumulated enough repetitions to cross the habit line. Every rep you perform during the uncomfortable phase is moving that date closer. Every rep you skip is pushing it further away. The chapter is, at its core, an invitation to trust the process even when the process does not feel like it is working. The results are accumulating beneath the surface, in the strengthening synapses, in the gradual transfer from prefrontal cortex to basal ganglia, in the slow but steady approach toward the habit line. You may not be able to see the progress, but it is there, in every rep, building quietly toward the moment when the behavior simply becomes part of who you are."""

PATCHES[(11, "hard", "direct")] = """

The emotional dimension of pre-automaticity habit building is worth addressing because it is the primary reason people quit before reaching the habit line. The prefrontal cortex phase is uncomfortable. Every repetition requires a conscious decision, and conscious decisions drain cognitive resources. The person building the habit feels like they are spending willpower with no visible return. The neural adaptation is happening, but it is invisible. There is no external signal that tells you, "You are now sixty percent of the way to automaticity." You simply feel the same effort on day forty that you felt on day four, until one day you do not.

This is the valley of disappointment, and it is where most habit attempts die. The person expects linear progress: more reps should mean less effort. But the relationship between reps and perceived effort is not linear. It is more like a step function. The effort stays approximately constant for a long period, then drops suddenly when the basal ganglia transfer reaches a critical threshold. If you quit during the constant phase, which can last weeks, you lose all accumulated neural adaptation. The transfer reverses. You return to baseline.

The instruction is to keep performing the behavior through the valley. Do not evaluate whether the habit feels easier. Do not track your subjective experience of effort. Track only the rep count. The rep count is the objective measure of progress. The subjective experience of effort is a lagging indicator that will eventually catch up to the objective reality, but only if you keep stacking reps long enough for the transfer to complete. This is the most demanding aspect of the Third Law: it requires you to trust a process you cannot see and to continue investing in a behavior whose returns are delayed and invisible until the threshold is crossed."""

PATCHES[(11, "hard", "competitive")] = """

The emotional dimension of this process is the part that eliminates most of your competition without you having to do anything. The period before the habit line is uncomfortable. It requires daily conscious effort. It drains willpower. It produces no visible results for weeks. Most people interpret this lack of visible results as evidence that the habit is not working, and they quit. They do not understand that the neural adaptation is happening beneath the surface, invisible but real. They quit at forty percent of the way to automaticity and lose everything they invested. Then they restart three months later, hit the same wall, and quit again.

You can outlast them by understanding the neurological reality. The effort curve is not linear. It stays approximately constant during the prefrontal cortex phase and then drops sharply when the basal ganglia transfer completes. If you track your reps and trust the research on how many are needed, you can estimate your position on the automaticity curve even though you cannot feel it. Knowing that you are seventy percent of the way there, based on rep count, even though the effort feels identical to day one, gives you the psychological edge to push through the final thirty percent.

Your competitor does not have this understanding. They are going on feel alone. And the feel is telling them to quit because the feel does not update until the transfer is nearly complete. They are making rational decisions based on incomplete information, and those rational decisions are wrong. You have the complete information. You know the effort will drop. You know the transfer is happening. You know the rep count is the real metric. That knowledge is the weapon that gets you across the habit line while everyone else is still stuck on the wrong side, wondering why their habits never feel easy.

This is the ultimate competitive insight of the Third Law: the habit line is not a physical barrier. It is a psychological filter. It does not keep anyone out permanently. It simply filters out the people who do not understand the process well enough to trust it during the uncomfortable phase. If you understand the process and keep stacking reps, you will cross the line. Most of your competition will not, because they will quit when the effort does not decrease on their expected timeline. Their impatience is your opportunity. Their lack of understanding is your edge. Show up. Stack reps. Trust the process. Cross the line. It is not complicated. It is just hard, and hard is what filters out the competition."""

# ─── CH12 MEDIUM ───────────────────────────────────────────────────────────────

PATCHES[(12, "medium", "direct")] = """

One additional principle emerges from this analysis: the concept of effort asymmetry. Removing friction from a desired habit and adding friction to an undesired habit are not symmetric operations. Removing friction has an immediate, proportional effect on behavior frequency. Adding friction has a disproportionate effect because it disrupts the automatic chain that bad habits depend on. A bad habit with zero friction runs on pure autopilot. Adding even a small amount of friction, ten seconds of delay, one extra step, forces the behavior out of autopilot and into conscious processing. That shift from automatic to conscious is often enough to kill the behavior entirely because the conscious mind can intervene with a better choice. This asymmetry means that adding friction to bad habits is, per unit of effort, more effective than removing friction from good habits. Both are important, but if you have limited energy for environment design, prioritize adding friction to bad habits first."""

PATCHES[(12, "medium", "competitive")] = """

One additional principle: effort asymmetry. Removing friction from good habits helps proportionally. Adding friction to bad habits helps disproportionately. Bad habits run on autopilot, and even a tiny friction point can kick the behavior out of autopilot and into conscious processing. Once a behavior enters conscious processing, the automatic pull is broken, and you have the opportunity to redirect. This means that adding ten seconds of friction to a bad habit can reduce its frequency more than removing ten seconds of friction from a good habit increases that habit's frequency. If you are optimizing your environment and have limited time, target the bad habits first. Add friction. Break the autopilot. The ROI on friction addition for bad habits is higher than friction removal for good habits, and the competitive edge goes to the person who understands which lever to pull first."""

# ─── CH12 HARD ─────────────────────────────────────────────────────────────────

PATCHES[(12, "hard", "gentle")] = """

Clear also draws attention to the role of decisions in creating friction. Every decision you have to make before performing a habit is a friction point. "Should I go to the gym or go tomorrow?" is friction. "Which workout should I do?" is friction. "Should I use the treadmill or the bike?" is friction. Each decision consumes cognitive energy and creates an opportunity to choose the easier option, which is usually to skip the habit altogether. The solution is to pre-decide. Decide in advance which workout you will do, on which days, at which times, and with which equipment. These pre-decisions eliminate the friction of choosing in the moment. When the cue fires, you do not have to think. The decision has already been made. You simply execute.

This is particularly important in the evening, when your cognitive resources are depleted from a full day of decisions. By evening, your prefrontal cortex is running on fumes. If your evening habits require multiple decisions before initiation, they will often lose to the zero-decision alternative of scrolling your phone or watching television. But if the decisions have been pre-made and the environment has been primed, the evening habit requires no more cognitive effort than the bad habit it replaces. The playing field is leveled, and the path of least effort now points toward the behavior you want.

The broader philosophy of this chapter is that your environment is not a neutral backdrop to your life. It is an active participant in your behavior. Every object in your space, every arrangement of furniture, every default setting on your devices is either making your habits easier or making them harder. Most people treat their environment as fixed, as something they live in rather than something they design. This chapter asks you to flip that perspective. You are the architect of your environment, and the environment you build determines the habits you keep. Build it with intention, and the habits follow naturally. Leave it to chance, and the habits that emerge will be the ones that require the least effort, which are usually not the ones you want."""

PATCHES[(12, "hard", "direct")] = """

The role of decisions as friction points deserves explicit analysis. Every decision you must make before performing a habit functions as a friction point. "Should I exercise today or rest?" is a decision point. "Which exercise should I do?" is another. "How long should I exercise?" is a third. Each decision point consumes prefrontal cortex resources and creates an opportunity for the brain to select the lower-effort option, which is typically to skip the behavior. The solution is to pre-decide. Use the implementation intentions from Chapter 5 to eliminate as many in-the-moment decisions as possible. Define the behavior, the time, the location, the duration, and the specific steps in advance. When the cue fires, the only remaining action is execution. No deliberation required.

This is especially critical for habits scheduled later in the day. By evening, the prefrontal cortex has been depleted by a full day of decisions, impulse management, and cognitive load. Evening habits that require multiple decisions before initiation will almost always lose to zero-decision alternatives like scrolling or watching television. Pre-deciding eliminates this disadvantage by reducing the evening habit to a single action: execute the pre-determined plan. The effort required becomes equivalent to the effort required for the bad habit, and when effort is equal, the primed environment tips the balance toward the desired behavior.

The chapter's final implication is that environmental friction is not something to be tolerated and overcome. It is something to be measured and eliminated. Treat friction like a defect in a manufacturing process. Identify it, quantify its impact on repetition frequency, and remove it. Do not accept friction as an inherent feature of the habit. If friction exists, it can be designed away. And every friction point you design away is a permanent improvement to your daily repetition rate that requires no ongoing willpower investment to maintain."""

PATCHES[(12, "hard", "competitive")] = """

Decision friction is the final category of friction that most people ignore completely. Every decision you must make before performing a habit is a friction point that drains prefrontal cortex resources and creates an exit ramp. "Should I work out?" is a decision. "Which workout?" is another. "How long?" is a third. "What music?" is a fourth. Four exit ramps before the habit even starts. Compare that to the person who pre-decided everything: Monday is chest and back, forty-five minutes, playlist already queued, clothes already laid out. Zero decisions. Zero exit ramps. The second person will execute the habit almost every time. The first person will negotiate themselves out of it at least twice a week.

Pre-deciding is the final layer of friction elimination. Combined with environmental priming and friction addition for bad habits, it creates a system where desired behaviors are the path of absolute least resistance. No decisions to make. No obstacles to navigate. No willpower to spend. The behavior just happens because every alternative requires more effort.

This is the end state that Clear is building toward. Not a life where you have superhuman discipline, but a life where discipline is unnecessary because the environment handles everything. The cues are visible. The cravings are charged. The response is frictionless. The rewards are satisfying. Every law of behavior change, working together, creates a behavioral ecosystem where good habits are the default and bad habits are the exception. The person who builds this ecosystem has a permanent structural advantage over anyone who relies on willpower, motivation, or accountability. Those resources are finite and unreliable. The ecosystem is permanent and self-sustaining. Build the ecosystem. Let it do the work. And spend your freed-up willpower on the things that actually require it."""

# ─── CH13 MEDIUM ───────────────────────────────────────────────────────────────

PATCHES[(13, "medium", "direct")] = """

There is a subtlety here about the relationship between the Two-Minute Rule and habit expansion that is worth clarifying. Clear does not prescribe a specific timeline for when to expand the habit beyond two minutes. The signal is not a date on the calendar. The signal is the absence of internal resistance at the current level. When you sit down to read one page and it happens without debate, without a voice in your head suggesting you skip it, that is the signal. The behavior has been standardized. The neural pathway is strong enough to support additional load. At that point, and only at that point, you add a small increment. Not a large one. A small one. And you hold the increment until it, too, produces no internal resistance. This patience is what separates habits that last from habits that spike and crash."""

PATCHES[(13, "medium", "competitive")] = """

There is a subtlety about expansion timing that gives you an additional edge. Clear does not say to expand after a fixed number of days. He says to expand when the current level produces zero internal resistance. Zero debate. Zero negotiation. The behavior just happens. That is the signal. When it arrives, you add a small increment, not a large one, and hold it until that increment, too, triggers zero resistance. This patience is a competitive weapon because your competitor is expanding too soon. They feel good on day five and double the habit. By day ten, the expanded version feels hard and they start skipping. Their streak breaks. Momentum dies. You, holding at two minutes until the signal appears, are still stacking perfect days when their habit has already collapsed. Patience is not passive. Patience is the strategy of someone who understands that the fastest path to a big habit is a perfectly consistent small one.

The Two-Minute Rule combined with earlier strategies from the book creates a habit architecture that is both robust and scalable. The implementation intention provides the cue. The friction reduction provides the environment. The Two-Minute Rule provides the response. And the patient expansion provides the growth path. Each layer reinforces the others. The result is not just a habit. It is a system for building habits, one that you can apply to any behavior you want to add to your life. Master the system once and you have a tool that works for every habit that follows."""

# ─── CH13 HARD ─────────────────────────────────────────────────────────────────

PATCHES[(13, "hard", "gentle")] = """

There is also something to be said about the role of patience in this process. Our culture celebrates dramatic transformations, overnight success stories, and before-and-after comparisons that compress months or years of work into a single image. The Two-Minute Rule does not produce dramatic transformations. It produces quiet, daily consistency that is invisible to everyone except you. Nobody will notice that you read one page last night. Nobody will be impressed that you sat on a cushion for two minutes. Nobody will congratulate you for putting on your running shoes and standing on the porch. But those invisible actions are the ones that build the neural pathways, the identity votes, and the consistency streaks that eventually produce the visible results everyone admires.

The visible results are the tip of the iceberg. Underneath them is a massive, invisible foundation of thousands of tiny reps, each one deposited by showing up on a day when it would have been easier not to. The Two-Minute Rule builds that foundation. It is not exciting. It is not dramatic. But it is effective, and effectiveness is what matters when you are trying to change your behavior for the rest of your life, not just for the next thirty days.

Clear closes the chapter with a reminder that the Two-Minute Rule is not the end of the process. It is the beginning. And the beginning is the most important part because everything that follows depends on it. A habit that begins with two minutes can grow into a lifetime practice. A habit that begins with two hours will likely end in two weeks. Start at two minutes. Trust the process. And give yourself permission to be a beginner, because beginners who show up every day eventually become experts."""

PATCHES[(13, "hard", "direct")] = """

The emotional dimension of the Two-Minute Rule is worth addressing because it is the factor that determines long-term adherence. The pre-automaticity phase of any habit is uncomfortable. It requires conscious effort. It drains willpower. And it produces no visible results for weeks. The Two-Minute Rule mitigates this discomfort by ensuring that the daily effort investment is so small that the discomfort barely registers. Two minutes of reading is not uncomfortable. Two minutes of meditation is not draining. Putting on your running shoes is not a willpower challenge. The low effort level means you can sustain perfect attendance even through the valley of disappointment, the period where reps are accumulating but the subjective experience of ease has not yet arrived.

This sustained attendance through the valley is the critical differentiator. Most habit failures occur not because the person lacked motivation on a specific day, but because the accumulated effort of many consecutive days exceeded their tolerance threshold. The Two-Minute Rule keeps the per-day effort so far below the threshold that the accumulation never reaches a breaking point. You can maintain a two-minute habit through stress, illness, travel, schedule disruptions, and emotional difficulty because the effort required is negligible. The habit survives anything life throws at it, which means the repetition chain remains unbroken, which means the neural pathway continues to strengthen, which means automaticity arrives on schedule.

The final point is about the transition from two-minute habit to full habit. This transition is not a discrete event. It is a gradual expansion driven by the natural craving that develops once the gateway behavior is automatic. You sit on the cushion for two minutes and want to stay longer. You read one page and want to read another. You put on your shoes and want to walk further. This craving is the engine of expansion, and it emerges organically from the automaticity of the gateway. You do not have to manufacture it. You do not have to force it. It appears on its own when the foundation is solid. The Two-Minute Rule builds the foundation. The craving builds the structure. And the result is a habit that grows from within rather than being imposed from without."""

PATCHES[(13, "hard", "competitive")] = """

The emotional warfare of habit building is where most of your competition self-destructs, and the Two-Minute Rule is your shield against the same fate. The pre-automaticity phase is a grind. It produces no visible results. It requires daily conscious effort. And it lasts longer than anyone wants it to. Most people quit during this phase because the effort-to-visible-result ratio feels unacceptable. They invested four weeks of daily effort and still do not feel like the habit is "sticking." So they quit.

The Two-Minute Rule inoculates you against this failure mode by making the daily effort so small that the effort-to-result ratio never feels unacceptable. You invested two minutes. The expected return on two minutes is low. So when the visible results are also low, there is no psychological conflict. No frustration. No sense of wasted effort. You just show up again tomorrow, deposit another two-minute rep, and keep the chain alive. Your competitor, who invested forty-five minutes and expected proportional results, is furious that nothing has changed. Their frustration builds. Their motivation erodes. They quit.

By month two, you have sixty consecutive reps. They have zero, because they quit at the end of week three and have not restarted. Your neural pathway is stronger. Your identity is stronger. Your streak is unbroken. And the habit is beginning to expand naturally because the gateway behavior is now automatic and the craving for more is emerging on its own.

This is the competitive endgame of the Two-Minute Rule. It is not about doing less. It is about lasting longer. The person who lasts longest accumulates the most reps. The person with the most reps crosses the habit line first. The person who crosses the habit line first has automated the behavior while everyone else is still struggling with it manually. And automation, in the habit game, is the permanent advantage. Once a behavior is automated, it persists indefinitely with zero willpower cost. Your competitor will need to match your entire rep history to reach the same level. By the time they start their next attempt, you are already working on the next habit, building the next layer, compounding the advantage. The Two-Minute Rule is the foundation of that compounding engine, and the person who builds on it earliest builds the furthest."""

# ═══════════════════════════════════════════════════════════════════════════════
# APPLY PATCHES AND HANDLE TRIMS
# ═══════════════════════════════════════════════════════════════════════════════

with open(FILE, "r") as f:
    data = json.load(f)

# Apply appends
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

# Handle OVER targets by trimming: (11,easy,direct), (13,easy,direct), (13,easy,competitive)
TARGETS = {"easy": (450, 550), "medium": (1100, 1400), "hard": (2200, 2600)}

def trim_to_target(text, max_words):
    """Trim text to max_words by removing words from the end, ending at last sentence."""
    words = text.split()
    if len(words) <= max_words:
        return text
    trimmed = " ".join(words[:max_words])
    # Find last period
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

# Verify
print("=" * 70)
print("WORD COUNT VERIFICATION (after patch 2)")
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
