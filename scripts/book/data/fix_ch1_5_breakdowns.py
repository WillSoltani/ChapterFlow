#!/usr/bin/env python3
"""Fix all failing chapterBreakdown variants to hit target word counts."""
import json
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_PATH = os.path.join(SCRIPT_DIR, "chapters-1-5.json")

# All 27 failing variants, rewritten to correct length.
# Format: fixes[(ch_num, difficulty, tone)] = new_text

fixes = {}

# ============================================================
# ch1 easy/competitive: 181 -> trim to 175
# ============================================================
fixes[(1, "easy", "competitive")] = (
    "What separates people who actually transform their performance from the ones who set ambitious targets and stall out? "
    "Clear argues it's the thing most people dismiss because it looks too small: 1% daily improvement, applied relentlessly. "
    "British Cycling spent a century losing. Then Dave Brailsford optimized dozens of tiny variables: seat geometry, suit fabric, recovery gels, hand-washing, pillow types. "
    "Each change was laughably minor. Stacked together: 178 world championships, 66 Olympic golds, 5 Tour de France titles in ten years.\n\n"
    "But there's a trap. The Plateau of Latent Potential catches almost everyone. "
    "Results lag behind effort like ice warming from 25 to 31 degrees. Nothing visible changes until 32. "
    "Clear calls this stretch the \"valley of disappointment.\" Every day your competitors quit during the plateau is a day you gain ground. "
    "The chapter closes with a principle: goals are overrated. Every serious competitor has them. "
    "The edge belongs to whoever builds the most reliable daily system. "
    "You do not rise to the level of your goals. You fall to the level of your systems."
)

# ============================================================
# ch1 medium/competitive: 323 -> expand to 340+
# ============================================================
fixes[(1, "medium", "competitive")] = (
    "What if the single most powerful performance advantage available to you is something your competitors dismiss every day because it looks too small to bother with? "
    "Clear opens with a provocation: 1% improvements, applied consistently, produce more total performance gain than any dramatic overhaul.\n\n"
    "British Cycling spent over a century losing. A leading bike manufacturer refused to sell them equipment to protect its brand. "
    "Then Dave Brailsford introduced \"the aggregation of marginal gains\": 1% improvements in every variable. "
    "Seat comfort, suit fabric, recovery gels, hand-washing protocol, pillow selection. "
    "Each optimization was so minor no rational competitor would lose sleep over any single one. "
    "Together: 178 world championships, 66 Olympic golds, 5 Tour de France titles in a decade. "
    "The math: 1.01^365 = 37.78. A 1% daily decline erodes you to 0.03. These curves start identically on day one and end in completely different places by day 365. "
    "The gains also interacted across domains: better sleep meant faster recovery, which meant higher-quality training, which meant better race performance. "
    "Marginal gains in connected variables create multiplicative outcomes, not additive ones.\n\n"
    "The returns are heavily back-loaded. The first months produce results barely distinguishable from zero. "
    "The steep upward bend arrives late, which means quitting at the halfway point doesn't cost you half the results. It costs you most of the results. "
    "Clear calls the flat early stretch the \"valley of disappointment,\" where effort accumulates but the scoreboard hasn't moved. "
    "This is where competitors drop out. Every day they quit is a day the field thins for you.\n\n"
    "Clear then targets something most performance advice treats as sacred: goals. Every competitor shares the same goals. "
    "What separates outcomes is systems. Four structural failures of goal-centric thinking: postponed satisfaction, no root-cause fix, artificially narrow success definition, and predictable boom-bust cycles. "
    "A system-oriented competitor doesn't cycle between effort and coasting. Results become the natural byproduct of showing up and executing consistently. "
    "The daily process is the only remaining variable that can create a gap when competitors share ambitions and talent levels. "
    "It is the entire game."
)

# ============================================================
# ch1 hard/gentle: 466 -> expand to 500+
# ============================================================
fixes[(1, "hard", "gentle")] = (
    "What if the most life-changing thing you could do today looks so small that you'd be tempted to skip it entirely? "
    "Clear opens with British Cycling, a team that spent a century as a punchline. A top European bike manufacturer refused to sell them equipment to avoid the association. "
    "Then Dave Brailsford took over and hunted for 1% improvements in everything: seat comfort, suit fabric, recovery gels, hand-washing routines, pillow types for better sleep. "
    "Each change was borderline trivial. Together: 178 world championships, 66 Olympic golds, 5 Tour de France wins in a decade. "
    "The math is clean. A 1% daily gain compounds to 37x improvement over a year. A 1% daily decline erodes you to nearly zero. "
    "The direction of your tiny daily choices determines which curve you ride, and those choices are compounding right now whether you notice them or not.\n\n"
    "But the compounding has a painful feature: the Plateau of Latent Potential. Like ice warming from 25 to 31 degrees, effort accumulates invisibly. "
    "At 32, everything shifts. Clear calls the period before breakthrough the \"valley of disappointment,\" where expected results outpace actual results by a frustrating margin. "
    "You go to the gym for weeks and the mirror stays the same. You write every morning and your prose feels clumsy. You eat better for a month and the scale doesn't move. "
    "Most people quit here, interpreting the delay as proof the method is broken. They're usually one degree from the melting point. "
    "Almost every success story you admire was preceded by a stretch that looked, from the outside, like nothing was happening. The author who seems to appear overnight was writing for years before the book that connected.\n\n"
    "This connects to a deeper problem with how people approach improvement. Clear argues that goals are overrated. "
    "Every Olympic athlete wants gold. Every startup founder wants growth. Every student wants top marks. "
    "What separates outcomes is systems: the daily processes you follow regardless of how motivated you feel on a given morning. "
    "Clear identifies four failures of goal-only thinking. Goals postpone satisfaction to a future event, making your present state feel inadequate. Goals don't fix underlying processes, so gains revert once the target is hit. "
    "Goals narrow your success definition to one specific outcome. Goals create boom-bust cycles of intense effort followed by regression.\n\n"
    "Systems address all four problems. When your daily process is dialed in, improvement becomes the default state rather than a temporary sprint toward a finish line. "
    "Your current life reflects the habits you've been running. Your net worth is a lagging measure of financial habits. Your weight reflects eating habits. Your knowledge reflects learning habits. "
    "Fix the daily inputs, and the outputs adjust on their own timeline. "
    "The relationship between system and outcome isn't optional. It's automatic. "
    "You do not rise to the level of your goals. You fall to the level of your systems.\n\n"
    "What makes this chapter's message so quietly powerful is that it reframes the entire project of self-improvement. "
    "You don't need a dramatic overhaul. You need a slight change in direction, maintained long enough for the compounding to become visible. "
    "The ice will melt. The curve will bend. The results will appear. "
    "And that is the fundamental promise of this chapter: the process works, if you let it run long enough."
)

# ============================================================
# ch1 hard/direct: 411 -> expand to 500+
# ============================================================
fixes[(1, "hard", "direct")] = (
    "What separates a century of failure from a decade of historic dominance? "
    "In British Cycling's case: Dave Brailsford and the aggregation of marginal gains. "
    "He optimized bike seats for comfort during long stages, suit fabric for reduced wind resistance, recovery gel formulations for faster muscle repair, hand-washing protocols to reduce illness, and pillow types for better sleep quality. "
    "Each change was almost trivially small. Compounded together: 178 world championships, 66 Olympic golds, 5 Tour de France titles. "
    "The math is direct. 1.01^365 = 37.78. A 1% daily decline drops you to 0.03. "
    "These curves are already running in your life whether you track them or not.\n\n"
    "The gains multiplied across domains rather than simply adding up. Better pillows meant better sleep. Better sleep meant faster recovery. "
    "Faster recovery meant higher-intensity training sessions. Higher-intensity training meant faster race times. "
    "Faster race times meant greater team confidence, which meant riders actively sought their own 1% edges. "
    "Marginal gains in connected variables create multiplicative outcomes, not additive ones. "
    "This explains why the strategy produced such disproportionate results: small improvements in interrelated systems compound on top of each other.\n\n"
    "But compounding has a structural problem: back-loaded returns. The first months look flat. The second half of the timeline holds most of the value. "
    "Clear introduces the Plateau of Latent Potential. Heating ice from 25 to 31 degrees stores energy without visible change. At 32, it melts. "
    "Your habits follow this pattern. You put in effort, and results operate on a delay that feels like punishment. "
    "Clear calls this the \"valley of disappointment.\" You exercise for three weeks and your times stay flat. You study for a month and bomb a test. "
    "The effort is accumulating beneath the surface. Your brain wants linear feedback, but compounding delivers exponential results on a delayed schedule. "
    "The early phase always looks flat. The breakthrough always looks sudden. "
    "Understanding this prevents you from abandoning a working strategy because results haven't appeared on your preferred timeline.\n\n"
    "Clear then makes a structural argument against goals. Goals are not useless, but they're a commodity. "
    "Every competitor has them. What separates actual outcomes is systems: the daily processes executed regardless of mood or motivation. "
    "Four problems with goal-only thinking: goals delay happiness to a future event, don't fix root processes so gains revert, narrow success to one specific outcome, and create boom-bust cycles of effort followed by regression. "
    "Systems eliminate all four failure modes. When you commit to a process, improvement becomes the default operating state rather than a temporary push.\n\n"
    "Your current results are a lagging measure of current habits. Net worth lags financial habits. Weight lags eating habits. Knowledge lags learning habits. "
    "Fix the leading indicator, and the lagging indicator adjusts over time. "
    "The relationship between inputs and outputs is not optional. It is automatic. "
    "The only question is whether you design the system deliberately or let it design itself by default. "
    "And the most effective inputs are small, consistent, and compounding, applied daily without exception."
)

# ============================================================
# ch1 hard/competitive: 408 -> expand to 500+
# ============================================================
fixes[(1, "hard", "competitive")] = (
    "What would you do if someone proved that the single most powerful competitive advantage in any field is something that, on any given day, looks completely unremarkable? "
    "British Cycling spent a century losing. A major manufacturer refused to sell them bikes to protect its own reputation. "
    "Then Dave Brailsford applied the aggregation of marginal gains: 1% improvements in every variable connected to performance. "
    "Seat comfort for long stages, suit fabric for aerodynamic advantage, recovery gels for faster muscle repair, hand-washing protocols to reduce illness during travel, pillow types for better sleep. "
    "Each tweak was so minor no competitor would worry about any single one. "
    "Together: 178 world championships, 66 Olympic golds, 5 Tour de France titles in a decade.\n\n"
    "The gains interacted multiplicatively across domains. Better sleep meant faster recovery. Faster recovery meant harder training. "
    "Harder training meant faster times. Faster times meant higher team confidence and buy-in, which meant riders actively sought their own 1% edges. "
    "Marginal gains in connected variables don't just stack linearly. They compound across domains, creating a multiplier effect within the compounding. "
    "The math is clean: 1.01^365 = 37.78. A 1% daily decline drops you to 0.03. "
    "These two curves start identically on day one and diverge into completely different outcomes by day 365.\n\n"
    "The returns are heavily back-loaded, and this creates an additional competitive advantage for those who understand the shape of the curve. "
    "The first months of 1% improvement produce results barely distinguishable from zero. The curve looks flat. "
    "The steep acceleration arrives late, concentrated in the final stretch. Quitting at the halfway point doesn't cost you half the value. It forfeits most of it. "
    "Clear calls the flat early stretch the \"valley of disappointment.\" "
    "This is where competitors drop out. They interpret delayed feedback as a failed strategy and abandon the approach right before the curve bends upward. "
    "Every day they quit during the plateau is a day the field thins for you. "
    "If you understand the shape of the curve, you can tolerate the early flatness. That tolerance is itself a competitive edge.\n\n"
    "Clear then takes aim at goals. Every serious competitor shares the same goals. What separates outcomes is systems, the daily processes executed regardless of mood or motivation. "
    "Four structural failures of goal-centric thinking: postponed satisfaction, no root-cause fix, artificially narrow success criteria, and predictable boom-bust cycles of intense effort followed by regression. "
    "A system-oriented competitor doesn't oscillate between effort and coasting. The system runs continuously, independent of any single milestone. "
    "In any field where competitors share ambitions and similar talent levels, the daily process is the only variable that creates separation.\n\n"
    "Your current results are a lagging measure of the system you've been running. "
    "The scoreboard reflects habits, not intentions. Change the daily inputs, and the outputs adjust on their own schedule. "
    "The edge belongs to whoever builds the most reliable daily process and runs it longer than everyone else. "
    "Everything else, the results, the recognition, the scoreboard, follows from that single daily commitment repeated over a long enough timeline."
)

# ============================================================
# ch2 easy/gentle: 191 -> trim to 170
# ============================================================
fixes[(2, "easy", "gentle")] = (
    "Have you ever stuck with a new habit for a few weeks and then quietly let it fade, even though nothing went wrong? "
    "Clear says the problem usually isn't your plan or your willpower. It's that you're trying to change what you do without changing who you believe you are. "
    "He describes three layers of behavior change: outcomes (what you get), processes (what you do), and identity (what you believe). "
    "Most people start with outcomes. Clear says the lasting approach is to start with identity.\n\n"
    "The difference shows up in language. \"I'm trying to quit smoking\" holds onto a smoker's identity. "
    "\"I'm not a smoker\" shifts the belief underneath the behavior. "
    "Every time you perform a habit, you cast a small vote for a type of person. Enough votes, and the identity becomes self-evident. "
    "You don't need a complete reinvention. You need enough repetitions to shift the story you tell about yourself. "
    "The story changes, and the habits that once required willpower start feeling like something you just naturally do."
)

# ============================================================
# ch2 easy/direct: 184 -> trim to 170
# ============================================================
fixes[(2, "easy", "direct")] = (
    "Why do two people with the exact same workout plan end up with completely different results three months later? "
    "Clear's answer: identity. Behavior change has three layers. The outer layer is outcomes (what you get). The middle is processes (what you do). "
    "The core is identity (what you believe about yourself). "
    "Most people aim at outcomes first. Clear argues the effective sequence is identity first, then process, then outcomes.\n\n"
    "The mechanism is a voting system. Every action you take is a vote for the type of person you're becoming. "
    "Write one page, and you've cast a vote for \"writer.\" Skip the gym, and you've voted for \"sedentary person.\" "
    "No single vote is decisive, but a majority wins. "
    "Saying \"I'm trying to quit\" treats the identity as unchanged. Saying \"I'm not a smoker\" treats the behavior as evidence of who you already are. "
    "That shift changes the motivational structure. You stop fighting behavior with willpower and start aligning behavior with belief. "
    "Start changing who you believe you are, and let the doing follow naturally from there."
)

# ============================================================
# ch2 easy/competitive: 178 -> trim to 170
# ============================================================
fixes[(2, "easy", "competitive")] = (
    "Everyone talks about building better habits, but almost nobody addresses why identical systems produce wildly different results in different people. "
    "Clear's answer is the variable most people overlook: identity. "
    "He maps behavior change as three concentric layers. Outcomes on the outside. Processes in the middle. Identity at the core. "
    "Most people work outside-in. Clear says winners work inside-out.\n\n"
    "The mechanism is a voting system. Every action casts a vote for a type of identity. "
    "Run today, and you vote for \"runner.\" Skip the work, and you vote for \"someone who cuts corners.\" "
    "No single vote decides the election, but a pattern emerges. "
    "This is why two competitors with identical plans get different results: one has aligned the plan with identity, the other is fighting it. "
    "When your identity matches your system, you stop spending willpower on compliance. "
    "You get to put all of yours into the work that moves the needle."
)

# ============================================================
# ch2 medium/direct: 296 -> expand to 340+
# ============================================================
fixes[(2, "medium", "direct")] = (
    "Chapter 1 proved that systems outperform goals and that compounding is the engine behind long-term results. "
    "Chapter 2 answers the next question: why do some systems sustain themselves while others collapse?\n\n"
    "Clear introduces three layers of behavior change. Outcomes (what you get) sit on the outside. "
    "Processes (what you do) occupy the middle. Identity (what you believe) is the core. "
    "Most people start with outcomes: lose 20 pounds, get a promotion, publish a book. "
    "Then they try to bolt on processes to reach the outcome. Clear argues this is backwards. "
    "Lasting change starts at the identity layer and radiates outward. "
    "The identity layer is where your beliefs about yourself live, and those beliefs determine which behaviors feel natural and which feel forced.\n\n"
    "The mechanism is a voting system. Every action is a vote for a type of identity. "
    "Go to the gym: one vote for \"person who exercises.\" Write a paragraph: one vote for \"writer.\" "
    "Skip the morning run: one vote for \"person who sleeps in.\" "
    "No single vote determines the result. But a majority forms a belief, and beliefs drive behavior automatically. "
    "The key distinction: \"I'm trying to quit smoking\" versus \"I'm not a smoker.\" "
    "The first frames the identity as unchanged and uses willpower to override it. "
    "The second frames the identity as already shifted and lets behavior follow naturally. "
    "Same external action, different internal structure, vastly different sustainability over weeks and months.\n\n"
    "This connects directly to Chapter 1's systems argument. A system that aligns with your identity is self-reinforcing. "
    "You don't need willpower to act like the person you believe you are. "
    "A system that contradicts your identity demands constant effort, and willpower is a depletable resource that runs low under stress. "
    "The two-step protocol: decide who you want to be, then prove it with small wins. "
    "Each small win casts another vote. Enough votes shift the belief. The shifted belief sustains the system without external motivation. "
    "Without identity alignment, even a well-designed system eventually breaks under friction. "
    "With it, the system becomes self-reinforcing and durable."
)

# ============================================================
# ch2 medium/competitive: 310 -> expand to 340+
# ============================================================
fixes[(2, "medium", "competitive")] = (
    "Chapter 1 established that systems determine results and that compounding is the mathematical engine behind long-term performance. "
    "Chapter 2 answers the question that separates durable competitors from temporary ones: why do some systems sustain themselves while others collapse under pressure?\n\n"
    "Clear maps behavior change as three concentric layers. Outcomes on the outside. Processes in the middle. Identity at the core. "
    "Most competitors start with outcomes: win the title, hit the revenue target, lead the ranking. "
    "Then they search for processes to reach those outcomes. "
    "Clear argues the effective direction is reversed. Start with identity. Let process and outcomes follow. "
    "The reason is structural: identity-aligned behavior runs on autopilot, while identity-misaligned behavior requires constant willpower.\n\n"
    "The mechanism is a voting system. Each action casts a vote for a type of identity. "
    "Train today: one vote for \"elite athlete.\" Cut corners: one vote for \"person who compromises under pressure.\" "
    "No single vote is decisive, but a pattern emerges, and that pattern becomes a belief that drives future behavior automatically. "
    "The competitive significance: two people running identical systems get different results because one has aligned the system with their identity and the other hasn't. "
    "The aligned competitor doesn't spend willpower on compliance. "
    "The misaligned competitor burns willpower every session, and willpower is a finite resource that depletes fastest under competitive stress.\n\n"
    "The \"I'm not a smoker\" versus \"I'm trying to quit\" distinction captures the entire structural difference. "
    "The first operates from a settled identity. The second fights against one. "
    "Building from Chapter 1: a well-designed system is necessary but not sufficient. It needs an identity foundation to hold under pressure. "
    "Without it, the system erodes when conditions get difficult. With it, the system becomes self-reinforcing. "
    "The two-step process: decide who you want to be, then prove it with small, repeated wins. "
    "Each win casts a vote. Enough votes lock in the identity. The locked-in identity sustains the system automatically. "
    "Competitors who operate from identity alignment don't just perform better on good days. "
    "They have a structural advantage that compounds every day, in every interaction, across every domain of performance."
)

# ============================================================
# ch2 hard/gentle: 392 -> expand to 500+
# ============================================================
fixes[(2, "hard", "gentle")] = (
    "Why would someone who successfully maintained a new habit for thirty straight days suddenly stop on day thirty-one, without any external disruption or crisis? "
    "Clear says the answer lives in a layer most people never examine: identity. "
    "Building from Chapter 1's insight that systems beat goals, Chapter 2 reveals why some systems run on autopilot while others require constant willpower that eventually runs dry.\n\n"
    "Clear introduces three layers of behavior change as concentric circles. "
    "Outcomes (what you get) sit on the outside. Processes (what you do) are in the middle. Identity (what you believe about yourself) is at the core. "
    "Most people start from the outside and work inward: pick a desired result, find a process to reach it, then force compliance through willpower. "
    "Clear argues that lasting change works from the inside out. When your identity aligns with the behavior, willpower becomes unnecessary. "
    "The person who says \"I'm not a smoker\" doesn't need to resist cigarettes. The non-smoker identity handles the decision automatically. "
    "The person who says \"I'm trying to quit\" is still a smoker who happens to be fighting the urge. Same external action, completely different internal cost.\n\n"
    "The mechanism is a voting system. Every habit you perform casts a vote for a type of person. "
    "Write one page, and you've voted for \"writer.\" Go to the gym, and you've voted for \"someone who values fitness.\" Skip the workout, and you've voted for \"someone who makes exceptions.\" "
    "No single vote decides the election, but a majority forms a belief. Once the belief takes hold, the behavior stops requiring effort because it's simply what someone like you does. "
    "This explains why two people with the same plan get different results: one has accumulated enough votes for the new identity, the other hasn't crossed that threshold yet.\n\n"
    "The connection to Chapter 1's compounding principle is direct and significant. Identity-aligned habits compound freely because they don't burn willpower. "
    "Every repetition flows naturally, which means you can sustain the behavior long enough for the compounding to produce visible results. "
    "Identity-misaligned habits drain energy with every repetition, creating an invisible tax on your system. "
    "Over weeks and months, that tax compounds too, but in the wrong direction. The person fighting their identity every morning eventually runs out of fuel. "
    "The person whose identity matches their habits just keeps going, not because they're tougher, but because compliance costs them almost nothing.\n\n"
    "Clear's two-step process is straightforward: first, decide the type of person you want to be. Second, prove it to yourself with small wins. "
    "You don't need a dramatic transformation or a complete reinvention of your personality. You need enough repetitions, enough evidence, to shift the story you tell yourself. "
    "Each small win is another vote. Each vote edges the identity closer to the tipping point. And once the identity tips, the system sustains itself. "
    "Your job during the difficult phase is simply to keep casting votes, knowing that each one brings you closer to the tipping point where everything gets easier."
)

# ============================================================
# ch2 hard/direct: 350 -> expand to 500+
# ============================================================
fixes[(2, "hard", "direct")] = (
    "Chapter 1 established that systems outperform goals and that compounding drives long-term results. "
    "Chapter 2 answers the structural follow-up: what determines whether a system sustains itself or collapses under friction?\n\n"
    "Clear introduces three layers of behavior change. Outcomes (what you get) on the outside. Processes (what you do) in the middle. "
    "Identity (what you believe about yourself) at the core. Most people start with outcomes and search for processes to reach them. "
    "Clear argues the effective direction is reversed: identity first, then process, then outcomes. "
    "The reason is structural. An identity-aligned system runs with minimal friction because the behavior feels natural. "
    "An identity-misaligned system requires willpower at every step, and willpower depletes under stress, fatigue, and competing demands.\n\n"
    "The voting mechanism explains how identity forms and shifts. Every action is a vote for a type of person. "
    "Write a page: one vote for \"writer.\" Hit the gym: one vote for \"athlete.\" Sleep in instead of running: one vote for \"person who makes exceptions.\" "
    "No single vote determines identity, but a majority forms a belief. Once the belief locks in, behavior follows automatically without requiring conscious effort. "
    "\"I'm not a smoker\" versus \"I'm trying to quit\" captures the entire structural distinction. "
    "The first operates from a settled identity and the behavior is self-consistent. The second fights against a still-active identity and requires ongoing willpower. "
    "Same external behavior on any given day, but different internal cost, and that cost difference compounds over time.\n\n"
    "This connects directly to Chapter 1's compounding framework. Compounding requires consistency over long periods. "
    "Consistency requires low friction at each decision point. Low friction requires identity alignment. "
    "Without alignment, every repetition costs willpower. Over time, that cost accumulates and the system breaks, usually right before the compounding curve bends upward. "
    "With alignment, every repetition reinforces the identity, which reinforces the behavior, which reinforces the identity further. "
    "The loop becomes self-sustaining. This is the structural difference between habits that last months and habits that last years.\n\n"
    "The practical protocol has two steps. First, define the identity you want. Not an outcome (\"lose 20 pounds\") but a type of person (\"someone who doesn't miss workouts\"). "
    "Second, accumulate evidence through small wins. Each win casts a vote. Enough votes shift the belief. "
    "The shifted belief reduces the cost of the behavior. The reduced cost increases consistency. The increased consistency accelerates the compounding from Chapter 1. "
    "The chain is identity to consistency to compounding to results. "
    "Without the identity foundation, systems require constant external motivation, which is unreliable and finite. "
    "With the foundation, the vehicle runs smoothly and the compounding produces results on its own schedule."
)

# ============================================================
# ch2 hard/competitive: 359 -> expand to 500+
# ============================================================
fixes[(2, "hard", "competitive")] = (
    "Chapter 1 proved that systems determine results and that compounding is the mathematical engine behind long-term performance gains. "
    "Chapter 2 addresses the variable that determines whether a system holds up under competitive pressure or fractures when conditions get difficult: identity.\n\n"
    "Clear maps three layers of behavior change. Outcomes sit on the outside. Processes in the middle. Identity at the core. "
    "Most competitors start with outcomes: win the championship, lead the market, top the ranking. Then they search for processes to deliver those outcomes. "
    "Clear argues the winning direction is reversed. "
    "Identity-first competitors build systems that run on alignment rather than willpower. "
    "The distinction between \"I'm trying to quit\" and \"I'm not a smoker\" is the entire difference between fighting your identity and acting from it. "
    "One requires energy at every decision point. The other is free.\n\n"
    "The mechanism is a voting system. Every action casts a vote for a type of person. "
    "Train when it's inconvenient: vote for \"elite competitor.\" Cut a corner: vote for \"someone who compromises under pressure.\" "
    "No single vote is decisive, but patterns become beliefs, and beliefs drive automatic behavior without conscious effort. "
    "Two competitors with identical systems produce different results because one has alignment and the other doesn't. "
    "The aligned competitor doesn't spend willpower on compliance. Every bit of mental energy goes toward actual performance. "
    "The misaligned competitor leaks energy at every decision point, and that leak accelerates under competitive stress.\n\n"
    "This connects to Chapter 1's compounding framework with direct competitive implications. Compounding requires consistency. Consistency requires low friction. "
    "Low friction requires identity alignment. Without it, every repetition carries a willpower tax that accumulates invisibly. "
    "That tax compounds in the wrong direction: the system gets harder to maintain over time instead of easier, and the competitor burns out right before the exponential curve bends upward. "
    "With alignment, every repetition reinforces the identity, which lowers friction, which increases consistency, which accelerates compounding. "
    "The self-reinforcing loop is the structural advantage that separates competitors who sustain performance from those who spike and fade.\n\n"
    "Clear's protocol: decide who you want to be, then prove it with small wins. Each win casts a vote. Enough votes lock in the belief. "
    "The locked-in belief sustains the system automatically, freeing mental bandwidth for actual performance improvement rather than basic compliance. "
    "The competitive implication is significant. While others burn willpower just to show up, identity-aligned competitors invest that same energy in getting better. "
    "You don't start with intensity and hope identity follows. "
    "You start with consistency, and intensity follows the identity shift."
)

# ============================================================
# ch3 medium/gentle: 324 -> expand to 340+
# ============================================================
fixes[(3, "medium", "gentle")] = (
    "In 1898, inside a small laboratory, a young psychologist named Edward Thorndike began placing cats inside wooden puzzle boxes. "
    "The cats scratched, pawed, and stumbled randomly until they accidentally pressed the lever that opened the door. "
    "But each time they were returned to the box, they found the lever faster. "
    "Thorndike realized something foundational: behaviors followed by satisfying outcomes get repeated, and behaviors producing no satisfaction fade away. "
    "He called this the Law of Effect. It remains the bedrock of habit science over a century later.\n\n"
    "Clear builds on Thorndike's insight to introduce the four-step habit loop: cue, craving, response, reward. "
    "A cue is a signal that something is available: you see a plate of cookies, your phone buzzes, you walk past a gym. "
    "A craving is the motivation the cue triggers: not the cookie itself, but the anticipation of sweetness. Not the phone buzz, but the curiosity about who messaged. "
    "A response is whatever action follows: you eat the cookie, check the phone, walk into the gym. "
    "A reward is the payoff that closes the loop and teaches the brain which patterns to repeat next time. "
    "Without a cue, the loop never starts. Without a craving, there's no motivation to act. Without a response, nothing happens. Without a reward, nothing gets encoded into memory.\n\n"
    "Building on Chapters 1 and 2, which showed that systems beat goals and that identity fuels those systems, Chapter 3 gives you the operating manual for habit mechanics. "
    "From the four-step loop, Clear derives four corresponding laws of behavior change. "
    "The 1st Law (Make It Obvious) targets the cue. The 2nd Law (Make It Attractive) targets the craving. "
    "The 3rd Law (Make It Easy) targets the response. The 4th Law (Make It Satisfying) targets the reward. "
    "To break a bad habit, invert each law: make it invisible, unattractive, difficult, and unsatisfying. "
    "This gives you a diagnostic framework for any behavior. When a habit isn't forming, ask which step is broken. "
    "That question marks the beginning of conscious habit design instead of unconscious habit accumulation."
)

# ============================================================
# ch3 medium/direct: 312 -> expand to 340+
# ============================================================
fixes[(3, "medium", "direct")] = (
    "Edward Thorndike put cats in puzzle boxes in 1898 and recorded what happened with systematic precision. "
    "The cats didn't reason their way to freedom. They flailed until accidental movements triggered the escape lever. "
    "But trial times shortened consistently. Successful behaviors were repeated; unsuccessful ones disappeared entirely. "
    "Thorndike codified this as the Law of Effect: behaviors followed by satisfying outcomes recur, and behaviors followed by unsatisfying outcomes fade. Over 125 years later, it remains the foundation of behavioral science.\n\n"
    "Clear translates Thorndike's principle into a four-step habit loop: cue, craving, response, reward. "
    "The cue is a signal: your phone buzzes, you see a gym bag by the door, you smell coffee from the kitchen. "
    "The craving is the motivational interpretation: not the phone buzz itself but the anticipation of connection, not the coffee smell but the energy you associate with that first cup. "
    "The response is the action: check the phone, walk to the gym, pour the cup. "
    "The reward is the satisfaction that closes the loop and programs the brain to repeat the pattern next time the cue appears. "
    "Remove any single step and the habit breaks down entirely. No cue, no trigger. No craving, no motivation. No response, no action. No reward, no encoding.\n\n"
    "From this loop, Clear derives the Four Laws of Behavior Change: make it obvious (cue), make it attractive (craving), make it easy (response), make it satisfying (reward). "
    "Each law maps directly to one step of the loop. To build a habit, strengthen the relevant step. To break one, invert the corresponding law. "
    "Chapters 1 and 2 established why habits matter (compounding produces outsized results) and what sustains them (identity alignment reduces friction). "
    "Chapter 3 delivers the mechanical framework: a four-part diagnostic for any behavior you want to install or remove. "
    "When a habit fails to form, one of these four steps is the bottleneck. When a bad habit persists, one of these four steps is reinforcing it. "
    "The result is a behavior change system with clear inputs and predictable outputs, where every failure can be traced to a specific step and every fix maps to a specific law."
)

# ============================================================
# ch3 medium/competitive: 262 -> expand to 340+
# ============================================================
fixes[(3, "medium", "competitive")] = (
    "Thorndike's 1898 puzzle-box experiments stripped habit formation down to its most basic mechanics, and the results haven't been overturned in over a century of behavioral science. "
    "Cats didn't strategize their way out. They flailed, stumbled on the lever, and repeated what worked. Trial times shortened with each attempt. "
    "Unsuccessful behaviors were eliminated. This is the Law of Effect: satisfying consequences select behaviors for repetition. Unsatisfying consequences extinguish them.\n\n"
    "Clear maps this into a four-step loop: cue, craving, response, reward. "
    "The cue is the trigger that initiates the sequence. The craving assigns meaning and motivation to that trigger. The response is the action you take. The reward closes the loop and programs the brain to repeat the pattern. "
    "Every habit you've ever formed, good or bad, runs on this loop. The four steps are not optional. "
    "Remove any one and the behavior chain breaks. This applies to the habits you want and the habits you're trying to eliminate.\n\n"
    "From this loop, Clear derives the Four Laws of Behavior Change: make it obvious (cue), make it attractive (craving), make it easy (response), make it satisfying (reward). "
    "To build a habit, optimize each step systematically. To break one, invert each law: make it invisible, unattractive, difficult, unsatisfying. "
    "This is the control system that connects Chapter 1's compounding to Chapter 2's identity into a single operational framework. "
    "Compounding requires consistent behavior. Consistent behavior requires a working habit loop. "
    "Identity determines which loops feel natural and which create friction that drains willpower. "
    "The Four Laws give you specific intervention points rather than vague advice about discipline or motivation.\n\n"
    "Most competitors treat habit formation as a willpower problem. They believe the answer is trying harder, pushing through resistance, grinding it out. "
    "The four-step model reveals it as an engineering problem with specific, diagnosable failure points. "
    "When a competitor fails to build a habit, they blame motivation. A systems thinker diagnoses which of the four steps is broken and fixes it directly. "
    "That reframe is the competitive edge."
)

# ============================================================
# ch3 hard/gentle: 359 -> expand to 500+
# ============================================================
fixes[(3, "hard", "gentle")] = (
    "In 1898, in a small laboratory space at Columbia University, a young psychologist named Edward Thorndike began running an experiment that would quietly reshape how we think about learning, behavior, and habits for the next century and beyond. "
    "He placed cats in wooden puzzle boxes with a lever that opened the door. The cats scratched, pawed, and stumbled until they accidentally pressed the lever. "
    "Returned to the box, they found the lever faster each time. The fumbling became more focused, the random movements more targeted. "
    "Thorndike's conclusion was elegant: behaviors producing satisfying results get repeated; behaviors producing nothing fade away over time. "
    "The Law of Effect. Simple, durable, and still foundational to every modern study of habit formation.\n\n"
    "Clear builds on this to present the four-step habit loop: cue, craving, response, reward. "
    "A cue is a signal that something is available: your phone buzzes, you smell coffee from the kitchen, you see running shoes placed by the front door. "
    "A craving is the motivational interpretation: the anticipation of social connection, the promise of energy, the pull of a runner's high. "
    "A response is the action: check the phone, pour the cup, lace up the shoes and head outside. "
    "A reward is the satisfaction that closes the loop and teaches the brain to repeat the pattern next time the cue appears. "
    "Remove any step and the chain breaks. No cue means no trigger. No craving means no motivation. No response means no action. No reward means no encoding. "
    "This loop runs thousands of times daily, mostly below conscious awareness, shaping your behavior without your permission.\n\n"
    "From this loop, Clear derives the Four Laws of Behavior Change. The 1st Law (Make It Obvious) targets the cue. "
    "The 2nd Law (Make It Attractive) targets the craving. The 3rd Law (Make It Easy) targets the response. "
    "The 4th Law (Make It Satisfying) targets the reward. To break a bad habit, invert each: make it invisible, unattractive, difficult, unsatisfying. "
    "This framework connects directly to Chapters 1 and 2. Chapter 1 showed that systems beat goals and that small improvements compound over time. "
    "Chapter 2 showed that identity sustains systems by making consistent behavior feel natural rather than forced. "
    "Chapter 3 provides the mechanical blueprint for building the daily behaviors that form those systems and express that identity.\n\n"
    "The deeper insight is that habits are not a willpower problem. They're a design problem. "
    "When a good habit won't stick, one of the four steps is weak or missing entirely. When a bad habit won't budge despite your best intentions, one of the four steps is actively reinforcing it. "
    "The framework turns abstract frustration (\"why can't I change?\") into a specific diagnostic question: which step is broken, and what would fix it? "
    "That shift from vague self-blame to precise diagnosis is what separates people who drift from people who design their behavior deliberately. "
    "That is what conscious habit design looks like in practice."
)

# ============================================================
# ch3 hard/direct: 346 -> expand to 500+
# ============================================================
fixes[(3, "hard", "direct")] = (
    "Thorndike's puzzle-box experiments in 1898 produced one of the most durable findings in the history of behavioral science, and the core insight has survived over 125 years of research without being overturned. "
    "Cats in boxes didn't reason their way to freedom. They flailed until accidental movements triggered the escape mechanism. "
    "But trial times shortened consistently with each attempt. Successful behaviors were selected for repetition. Unsuccessful ones were eliminated. "
    "Thorndike called this the Law of Effect: behaviors followed by satisfying consequences recur; behaviors followed by unpleasant or neutral consequences don't.\n\n"
    "Clear translates this into a four-step habit loop: cue, craving, response, reward. "
    "The cue triggers attention (phone buzzes, gym bag is visible by the door, coffee smell drifts from the kitchen). "
    "The craving assigns motivation (anticipation of connection from the phone, exercise high from the gym, caffeine energy from the coffee). "
    "The response is the action (check the phone, work out, pour the coffee). "
    "The reward closes the loop and encodes the pattern for future repetition when the same cue appears. "
    "Remove any step and the habit fails to form or sustain. Every habit you run, whether positive or destructive, follows this exact four-step sequence.\n\n"
    "From the loop, Clear derives the Four Laws of Behavior Change: make it obvious (cue), make it attractive (craving), make it easy (response), make it satisfying (reward). "
    "Build habits by strengthening the relevant step. Break habits by inverting the corresponding law: invisible, unattractive, difficult, unsatisfying. "
    "This framework integrates with the first two chapters to form a complete system. "
    "Chapter 1 established compounding: small behaviors, repeated consistently, produce outsized results over time. "
    "Chapter 2 established identity: when behavior aligns with belief about who you are, consistency requires less effort because the behavior feels natural. "
    "Chapter 3 delivers the engineering layer: the four-step loop is the mechanism through which identity expresses itself as behavior and behavior compounds into measurable results.\n\n"
    "The diagnostic value is significant and practical. When a habit fails to form, the framework narrows the problem to one of four specific steps. "
    "Cue missing? The habit never triggers. Craving weak? No motivation to act. Response too difficult? Too much friction to complete. Reward absent or delayed? No encoding in memory. "
    "When a bad habit persists despite your efforts, one of the four steps is providing reinforcement you haven't identified. Find which one and invert it. "
    "This turns habit change from a vague willpower contest into a systematic process with specific intervention points and predictable outcomes. "
    "And that systematic approach is what the rest of the book will help you execute, one law at a time."
)

# ============================================================
# ch3 hard/competitive: 338 -> expand to 500+
# ============================================================
fixes[(3, "hard", "competitive")] = (
    "Thorndike's 1898 puzzle-box experiments are the competitive equivalent of studying foundational game film. "
    "Cats in boxes didn't strategize or plan their escape. They flailed until something worked, then repeated what worked faster each time. "
    "Successful behaviors were selected for repetition. Unsuccessful ones were eliminated from the repertoire. "
    "The Law of Effect: satisfying consequences select behaviors for repetition. Unsatisfying consequences extinguish them. "
    "Over 125 years of behavioral research has not overturned this core finding.\n\n"
    "Clear maps the Law of Effect into a four-step loop: cue, craving, response, reward. "
    "The cue triggers attention. The craving assigns motivation and meaning to that trigger. The response is the action taken. The reward closes the loop and encodes the pattern for future repetition. "
    "Every habit you run operates on this loop, and every habit your competitors run operates on it too. "
    "The competitor who understands the loop has four specific intervention points to work with. The competitor who doesn't has only willpower, and willpower is a depletable resource that fails under pressure.\n\n"
    "From the loop, Clear derives the Four Laws of Behavior Change: make it obvious, make it attractive, make it easy, make it satisfying. "
    "Build a habit by optimizing each step. Break one by inverting each law: invisible, unattractive, difficult, unsatisfying. "
    "This integrates directly with the first two chapters to form a complete competitive framework. "
    "Chapter 1 showed that compounding requires consistent behavior sustained over long periods. "
    "Chapter 2 showed that identity sustains consistency by reducing the willpower cost of each repetition. "
    "Chapter 3 provides the mechanical framework for building the specific behaviors that identity drives and compounding amplifies into results. "
    "The three chapters form a complete stack: compounding (why it works), identity (what sustains it), and the habit loop (how to engineer it).\n\n"
    "Most competitors treat behavior change as a discipline problem. They believe success comes from trying harder, pushing through pain, and grinding out repetitions. "
    "The four-step model reframes it as an engineering problem with specific, diagnosable failure points. "
    "When a competitor can't build a habit, they assume they lack discipline. A systems thinker diagnoses which step is broken and fixes it with precision. "
    "When a competitor can't break a bad habit, they try harder to resist. A systems thinker identifies which step provides reinforcement and removes that specific reinforcement. "
    "The difference between the two approaches compounds over time, just like everything else in this framework. "
    "The discipline-based competitor is always fighting friction. The engineering-based competitor is always reducing it. "
    "Over months and years, that gap becomes decisive. "
    "That execution starts now."
)

# ============================================================
# ch4 easy/competitive: 196 -> trim to 170
# ============================================================
fixes[(4, "easy", "competitive")] = (
    "A paramedic looked at his father-in-law across the dinner table and detected a medical emergency that nobody else in the room could see. "
    "The man was having a heart attack. Only the paramedic's years of pattern recognition made the signs visible. "
    "Clear uses this story to introduce the 1st Law: Make It Obvious. "
    "Most of your habits are invisible to you. They fire automatically, below conscious awareness, driven by cues you never deliberately process.\n\n"
    "You can't optimize what you can't see. "
    "Pointing-and-Calling forces you to verbalize an action before doing it, pulling the behavior from automatic to conscious. "
    "The Habits Scorecard lists every daily routine and labels each as positive, negative, or neutral. "
    "Together, these tools create an accurate map of what you actually do, not what you think you do. "
    "Most competitors overestimate good habits and underestimate bad ones. "
    "These two techniques drag invisible processes into view so you can decide which to keep, optimize, or dismantle."
)

# ============================================================
# ch4 medium/direct: 322 -> expand to 340+
# ============================================================
fixes[(4, "medium", "direct")] = (
    "A paramedic walked into his father-in-law's house for a family visit and immediately sensed something was wrong. "
    "The man's face showed subtle signs of distress that no one else at the table detected. Hospital visit confirmed a heart attack in progress. "
    "Clear uses this to introduce the 1st Law: Make It Obvious. The paramedic's brain had been trained to notice cues that everyone else filtered out.\n\n"
    "This connects directly to the habit loop from Chapter 3. The cue is step one of any habit. "
    "If you never become aware of the cue, the habit runs automatically, which is efficient for good habits and destructive for bad ones. "
    "Most people dramatically overestimate their awareness of their own daily behavior. "
    "You don't consciously decide to check your phone 80 times a day or reach for a snack every time you sit on the couch. "
    "The cue triggers the behavior below conscious processing, and the response completes before you realize it happened.\n\n"
    "Two techniques address this blind spot. Pointing-and-Calling, used in the Japanese railway system, reduces operational errors by up to 85% by forcing operators to verbalize each signal's status aloud. "
    "Applied to personal habits: say the action out loud before doing it. \"I'm about to eat this second serving even though I'm not hungry.\" "
    "The verbalization raises the behavior from automatic to deliberate, creating a moment of choice that didn't exist before. "
    "The Habits Scorecard lists every routine in your day with a positive, negative, or neutral label. "
    "No changes yet. Just accurate observation. The gap between perceived behavior and actual behavior is usually large, and the scorecard closes that gap.\n\n"
    "Building from Chapter 2's identity model, awareness is what turns unconscious votes into conscious ones. "
    "Without awareness, your identity is shaped by habits you never chose and never examined. With it, every habit becomes a decision point. "
    "Chapter 4 is the transition from understanding why habits matter (Chapters 1-2) and how they work mechanically (Chapter 3) to the first practical intervention. "
    "Before you can make a cue obvious, you need to see the cues already running your behavior. "
    "Without that map, you're operating blind. "
    "With it, you're working from satellite imagery."
)

# ============================================================
# ch4 medium/competitive: 286 -> expand to 340+
# ============================================================
fixes[(4, "medium", "competitive")] = (
    "A paramedic walked into his father-in-law's house for a routine family visit and detected a life-threatening condition that nobody else in the room could see. "
    "The man was having a heart attack. Only the paramedic's trained pattern recognition made the danger visible. "
    "Clear opens with this story to introduce the 1st Law: Make It Obvious. "
    "The competitive principle: you can only optimize what you can perceive. Everything invisible to you is a variable you cannot control.\n\n"
    "Connecting to the habit loop from Chapter 3, the cue is the entry point of every behavioral sequence. "
    "Most people run dozens of habits daily without ever consciously registering the cue that initiates each one. "
    "Phone checking, snacking, posture shifts, procrastination routines: all firing below conscious awareness. "
    "This means most competitors are running behavioral patterns they've never audited, optimizing outcomes while leaving the underlying cue-response chains completely invisible and unchallenged.\n\n"
    "Clear introduces two tools for making the invisible visible. Pointing-and-Calling, from the Japanese railway system, reduces operational errors by up to 85% by forcing verbalization of each step. "
    "Applied to personal behavior: verbalize the action before performing it. \"I'm about to check email for the fourth time this hour even though nothing urgent is pending.\" "
    "The verbalization converts autopilot into active choice, creating a decision point where none existed before. "
    "The Habits Scorecard lists every daily routine, labeled positive, negative, or neutral. "
    "No changes required at this stage, just accurate mapping. The gap between what you think you do and what you actually do is precisely where performance leaks hide.\n\n"
    "Building from Chapter 2, awareness is what converts unconscious identity votes into deliberate ones. "
    "Without awareness, your competitors and your environment shape your identity by default because you're responding to cues you never chose. "
    "With it, every habit becomes a strategic decision rather than an automatic reflex. "
    "The audit itself is a competitive act: the competitor who maps their behavioral patterns accurately can redesign them with precision. "
    "The competitor who doesn't is running last year's code and wondering why the output hasn't changed. "
    "That principle holds across every domain where performance matters."
)

# ============================================================
# ch4 hard/gentle: 394 -> expand to 500+
# ============================================================
fixes[(4, "hard", "gentle")] = (
    "One evening, a paramedic walked into his father-in-law's home for a casual family dinner. "
    "The moment he saw the older man's face, something felt wrong. No one else at the table noticed anything unusual. "
    "The paramedic insisted on a hospital visit. Doctors discovered a heart attack in progress. "
    "Years of pattern recognition had trained his brain to detect cues invisible to everyone around him. "
    "Clear uses this story to open the 1st Law of Behavior Change: Make It Obvious.\n\n"
    "The connection to Chapter 3's habit loop is direct and important. The cue is the first step in every habit. "
    "If you never notice the cue, the behavior runs on autopilot without your conscious participation. "
    "This is efficient for good habits but dangerous for bad ones, because you're casting identity votes (Chapter 2) without ever choosing them. "
    "Most people overestimate their self-awareness significantly. You don't decide to check your phone 80 times a day or bite your nails during meetings. "
    "The cue fires and the response follows before conscious thought enters the picture. The behavior is finished before you even realize it started.\n\n"
    "Clear introduces two tools for bringing the invisible into view. "
    "Pointing-and-Calling comes from the Japanese railway system, where conductors physically point at each signal and call out its status aloud. "
    "The practice reduces errors by up to 85%. Applied to personal habits, it means saying your action aloud before doing it: \"I'm about to eat this second cookie even though I'm full.\" "
    "The verbalization lifts the behavior from automatic to conscious, creating a moment of choice where none previously existed. "
    "The Habits Scorecard is the second tool. It lists every routine in your day with a simple label: positive, negative, or neutral. "
    "The point isn't to change anything yet. It's to build an honest map of what you actually do, which almost always differs from the story you tell yourself about your day.\n\n"
    "The deeper significance connects to the full framework from Chapters 1 through 3. "
    "Chapter 1 showed that small behaviors compound into significant outcomes over time. Chapter 2 showed that identity sustains those behaviors by making them feel natural. "
    "Chapter 3 mapped the mechanical loop: cue, craving, response, reward. "
    "Chapter 4 says: before you can engineer that loop deliberately, you need to see the loops already running in your daily life. "
    "Awareness is the prerequisite for every intervention that follows. Without it, you optimize blindly, making changes based on an inaccurate self-image. "
    "With it, you gain the ability to choose which cues to amplify, which to remove, and which behaviors to keep, modify, or replace entirely.\n\n"
    "The Habits Scorecard isn't just a one-time exercise. It's the foundation of deliberate behavioral design. "
    "Every chapter from this point forward assumes you can see your habits clearly and accurately. "
    "Start here."
)

# ============================================================
# ch4 hard/direct: 375 -> expand to 500+
# ============================================================
fixes[(4, "hard", "direct")] = (
    "A paramedic walked into his father-in-law's home for a family gathering and identified a life-threatening medical condition that no one else in the room detected. "
    "The man's face showed subtle distress signals visible only to someone with years of trained pattern recognition. "
    "Hospital visit confirmed a heart attack in progress. "
    "Clear uses this to introduce the 1st Law: Make It Obvious. Before you can change a behavior, you need to see it clearly.\n\n"
    "This connects to Chapter 3's habit loop. The cue is step one of every habit, and most cues fire below conscious awareness. "
    "You don't deliberate about checking your phone or reaching for a snack every time you sit on the couch. The cue triggers the response automatically, and the behavior completes before you register what happened. "
    "This is the efficiency that makes habits useful: they free mental bandwidth for other tasks. "
    "But that efficiency becomes a liability when bad habits run just as automatically as good ones. "
    "You end up casting identity votes (Chapter 2) and feeding compounding loops (Chapter 1) without ever consciously choosing to do so.\n\n"
    "Two tools address this visibility problem. Pointing-and-Calling, from the Japanese railway system, reduces operational errors by up to 85% "
    "by forcing operators to verbalize each signal before proceeding. Applied to personal habits: state the action before performing it. "
    "\"I'm about to eat this second serving even though I'm not hungry.\" The verbalization converts autopilot to active choice, inserting a decision point into what was previously an automatic sequence. "
    "The Habits Scorecard lists every daily routine with a label: positive, negative, or neutral. "
    "No changes required at this stage. The sole goal is an accurate behavioral map. "
    "The gap between perceived behavior and actual behavior is typically significant, and most people don't realize how large it is until they complete the scorecard.\n\n"
    "The diagnostic value integrates with everything from Chapters 1 through 3. "
    "Compounding (Chapter 1) requires knowing which behaviors you're compounding. If you don't see a daily habit, you can't assess whether it's compounding for you or against you. "
    "Identity (Chapter 2) requires knowing which votes you're casting with each repeated action. "
    "The habit loop (Chapter 3) requires knowing which cues are currently active in your environment and what behavioral chains they trigger. "
    "Chapter 4 provides the visibility layer that makes all three prior chapters actionable. Without it, you're optimizing a system you can't see. "
    "With it, every habit becomes a conscious intervention point where you can decide to keep, modify, or eliminate the behavior.\n\n"
    "The chapter positions awareness as the gateway to all four laws of behavior change. "
    "Before you can make a cue more obvious, attractive, easy, or satisfying, you need to know which cues are currently active and what specific behaviors they're driving in your daily life. "
    "The Habits Scorecard and Pointing-and-Calling are the minimum viable tools for that visibility. "
    "Awareness is not the end of the process, but nothing meaningful begins without it."
)

# ============================================================
# ch4 hard/competitive: 349 -> expand to 500+
# ============================================================
fixes[(4, "hard", "competitive")] = (
    "A paramedic walked into a family gathering and spotted a medical emergency that every other person in the room missed entirely. "
    "The father-in-law's face showed distress signals invisible to untrained eyes. "
    "Heart attack confirmed at the hospital. "
    "Clear uses this story to introduce the 1st Law: Make It Obvious. The principle: you can only optimize what you can perceive. Everything else is a blind spot your competitors might already see.\n\n"
    "Connecting to Chapter 3's habit loop, the cue is the entry point of every behavioral sequence. "
    "Most competitors run dozens of behavioral loops daily without ever consciously registering the cue that triggers them. "
    "Phone checking, procrastination sequences, emotional eating, posture habits, attention drift: all firing automatically below awareness. "
    "This means most competitors are casting identity votes (Chapter 2) and feeding compounding cycles (Chapter 1) with zero awareness of the specific behaviors involved. "
    "They're running code they've never reviewed, and that code is producing their current results.\n\n"
    "Clear introduces two tools for behavioral auditing. "
    "Pointing-and-Calling, from the Japanese railway system, reduces operational errors by up to 85% by forcing verbalization of each signal before proceeding. "
    "Applied to personal habits: state the behavior aloud before performing it. \"I'm about to check social media for the fifth time this hour even though I checked two minutes ago.\" "
    "The verbalization converts automatic behavior into a deliberate decision, inserting a choice point into what was previously an unconscious reflex. "
    "The Habits Scorecard maps every daily routine with a label: positive, negative, or neutral. "
    "No changes at this stage. Just accurate intelligence on your actual behavioral patterns rather than the idealized version you carry in your head. "
    "The gap between perceived and actual behavior is exactly where performance leaks hide.\n\n"
    "The competitive significance is structural and far-reaching. The competitor who audits their habits can redesign them with precision. "
    "The competitor who doesn't is optimizing blindly, making changes based on a distorted self-image and wondering why the results don't match the effort. "
    "In any performance domain, the quality of your behavioral intelligence determines the quality of your interventions. "
    "A competitor who sees their habits clearly can amplify the right cues, remove the wrong ones, and design their environment deliberately for maximum performance. "
    "A competitor operating from assumption wastes interventions on the wrong targets and never understands why the improvement doesn't stick.\n\n"
    "Chapter 4 sits at the transition point from theory (Chapters 1-3) to practice. "
    "Every technique in the remaining chapters assumes you can see your current habits accurately and honestly. "
    "The behavioral audit isn't preliminary work you can skip. It's the foundation everything else is built on. "
    "The audit is where systematic behavioral improvement begins, and skipping it is where most improvement efforts silently fail."
)

# ============================================================
# ch5 easy/gentle: 188 -> trim to 170
# ============================================================
fixes[(5, "easy", "gentle")] = (
    "In 2001, researchers in Great Britain recruited 248 people and divided them into three groups to study exercise habits. "
    "The first group tracked workouts. The second received a motivational presentation. "
    "The third wrote one sentence: \"I will exercise at [TIME] in [PLACE] on [DAY].\" "
    "91% of the third group exercised consistently, compared to about 35% of the others. "
    "The difference wasn't motivation. It was a plan tied to a specific time and place.\n\n"
    "Clear calls this an implementation intention: pairing a behavior with a when and where. "
    "He extends the principle with habit stacking: linking a new habit to an existing one. "
    "\"After I pour my morning coffee, I will write for ten minutes.\" The existing habit becomes the cue. "
    "This connects to the Diderot Effect, where one change triggers a chain of related ones. "
    "Habit stacking uses that chain reaction deliberately, letting each completed habit cue the next. "
    "That's a much more sustainable approach to behavior change than relying on willpower, which fades as the day goes on and life gets complicated."
)

# ============================================================
# ch5 medium/gentle: 316 -> expand to 340+
# ============================================================
fixes[(5, "medium", "gentle")] = (
    "In 2001, researchers in Great Britain designed a study that would reveal one of the simplest and most effective strategies for behavior change ever tested. "
    "They recruited 248 people and split them into three groups. "
    "The first group tracked their exercise. The second received a motivational presentation about the benefits of physical activity. "
    "The third did something deceptively simple: they wrote a sentence filling in the blanks of \"I will exercise at [TIME] in [PLACE] on [DAY].\" "
    "91% of the third group exercised consistently. Only about 35% of the other groups did.\n\n"
    "Clear calls this an implementation intention: specifying the when and where of a behavior in advance. "
    "The insight is that motivation is not usually the bottleneck. Clarity is. "
    "People who say \"I'll exercise more\" leave too many decisions unmade: when during the day, where exactly, how long, which exercises. "
    "Each unmade decision is a moment where the behavior can fail to launch because there's no clear trigger. "
    "The implementation intention fills those gaps in advance so the behavior fires when the context arrives, without needing a burst of willpower.\n\n"
    "He extends this with habit stacking, which connects to the Diderot Effect. "
    "Diderot, the French philosopher, received a beautiful scarlet robe as a gift. Suddenly his other possessions looked shabby by comparison, and he replaced them one by one until his whole study was transformed. "
    "One purchase triggered a chain of related purchases. "
    "Habit stacking uses the same chain reaction deliberately: \"After [CURRENT HABIT], I will [NEW HABIT].\" "
    "Your morning coffee becomes the cue for journaling. Journaling becomes the cue for reviewing your calendar. "
    "Each completed habit triggers the next, building a sequence that runs with minimal willpower or deliberation.\n\n"
    "Building from Chapter 4's emphasis on awareness and the 1st Law (Make It Obvious), implementation intentions and habit stacking make your cues unmistakable. "
    "You don't wait for the right moment to appear. You pre-decide the moment and build it into your day. "
    "The clearer and more specific you make these insertion points, the less willpower and motivation they require, and the more likely they are to actually happen."
)

# ============================================================
# ch5 medium/direct: 295 -> expand to 340+
# ============================================================
fixes[(5, "medium", "direct")] = (
    "A 2001 British study on exercise habits produced a result that should fundamentally change how you think about behavior change. "
    "248 people, three groups. Group one tracked their workouts. Group two received a motivational presentation about the health benefits of exercise. "
    "Group three wrote one sentence: \"I will exercise at [TIME] in [PLACE] on [DAY].\" "
    "About 35% of groups one and two exercised regularly. 91% of group three did. The only variable that differed was a pre-committed plan specifying when and where.\n\n"
    "Clear identifies this as an implementation intention. The formula: \"I will [BEHAVIOR] at [TIME] in [LOCATION].\" "
    "The research finding is that people don't fail to follow through because they lack motivation or information. They fail because they lack clarity about when and where the behavior will happen. "
    "\"I'll exercise more\" is a vague intention with no trigger attached. \"I'll go to the gym at 6 AM on Monday, Wednesday, and Friday\" is a concrete plan that fires when the context arrives. "
    "The specificity removes the decision point where most people stall out and default to whatever is easiest.\n\n"
    "He extends this with habit stacking: \"After [CURRENT HABIT], I will [NEW HABIT].\" "
    "The existing habit becomes the cue, which connects directly to Chapter 3's habit loop (cue triggers craving triggers response triggers reward). "
    "The Diderot Effect provides the underlying mechanism. Diderot received a lavish robe as a gift, and it triggered a cascade of replacements throughout his home as each item looked shabby next to the new one. "
    "One change led to another, then another. Habit stacking uses this chain reaction deliberately, linking new behaviors to established routines so each completed action cues the next. "
    "\"After I pour my coffee, I'll review my goals. After I review my goals, I'll write for ten minutes.\"\n\n"
    "Building from Chapter 4's 1st Law (Make It Obvious), implementation intentions and habit stacking are the first practical applications of that principle. "
    "They pre-load the cue into your environment and schedule. The behavior doesn't depend on noticing an opportunity or feeling inspired. "
    "The opportunity is engineered in advance. The result is consistency without reliance on daily motivation. "
    "That consistency is the goal."
)

# ============================================================
# ch5 medium/competitive: 278 -> expand to 340+
# ============================================================
fixes[(5, "medium", "competitive")] = (
    "A British study on exercise habits produced one of the cleanest demonstrations of what actually drives behavior change when you strip away assumptions and measure outcomes. "
    "248 participants, three groups, one variable. Group three wrote a single sentence pre-committing to a specific time, place, and action. "
    "91% of that group followed through on their exercise intention. About 35% of the others did. "
    "The variable that produced a nearly 3x performance gap wasn't motivation, desire, or accountability. It was pre-decided context.\n\n"
    "Clear calls this an implementation intention: \"I will [BEHAVIOR] at [TIME] in [LOCATION].\" "
    "The strategic insight: most people fail not from lack of motivation but from lack of specificity about when and where the behavior will happen. "
    "\"I'll exercise more\" leaves every decision open, and each open decision is a vulnerability point where the behavior can fail to launch. "
    "\"I'll run at 6 AM at the park on Monday, Wednesday, and Friday\" closes those decisions. "
    "Each closed decision eliminates a failure point and removes a moment where willpower must intervene.\n\n"
    "He extends this with habit stacking: \"After [CURRENT HABIT], I will [NEW HABIT].\" "
    "Connecting to Chapter 3's habit loop, the existing habit serves as the cue that triggers the new behavior automatically. "
    "The Diderot Effect is the underlying mechanism: one change triggers a chain of related changes. "
    "Diderot received a beautiful robe and replaced everything in his study to match it, one item triggering the next. "
    "Habit stacking converts that natural cascade into deliberate architecture, linking new behaviors to established routines in a tight sequence. "
    "\"After my morning coffee, I'll review priorities. After reviewing priorities, I'll start the hardest task first.\"\n\n"
    "Building from Chapter 4's awareness tools and the 1st Law (Make It Obvious), implementation intentions and habit stacking are the first offensive moves in behavior design. "
    "Chapter 4 gave you the map of your current behavioral patterns. Chapter 5 gives you the insertion points for new ones. "
    "The competitor who pre-decides context doesn't waste energy deliberating each morning. Every pre-made decision conserves willpower for actual performance. "
    "Every unmade decision is a leak where competitors lose consistency without realizing it. "
    "That is the competitive edge."
)

# ============================================================
# ch5 hard/gentle: 394 -> expand to 500+
# ============================================================
fixes[(5, "hard", "gentle")] = (
    "In 2001, researchers in Great Britain wanted to understand what it actually takes to get people to exercise regularly, not in theory, not in a laboratory, but in real life where competing demands, low energy, and busy schedules constantly get in the way. "
    "They recruited 248 people and split them into three groups. "
    "Group one tracked their workouts. Group two received motivational information about the health benefits of regular exercise. "
    "Group three wrote a single sentence: \"I will exercise at [TIME] in [PLACE] on [DAY].\" "
    "The results were striking. About 35% of groups one and two exercised consistently. 91% of group three did.\n\n"
    "Clear calls this an implementation intention. The formula: specify the when and where of a behavior before the moment arrives. "
    "The finding upends a common assumption that most people hold about themselves. Most people believe they fail to follow through because they lack motivation or desire. "
    "The research suggests they fail because they lack clarity about when and where the behavior will happen. \"I should exercise more\" is a wish with no trigger attached. "
    "\"I will go to the gym at 7 AM on Tuesday and Thursday\" is a plan that fires when the context arrives. "
    "The specificity removes the decision point where behaviors most often fail to launch because there's nothing to deliberate.\n\n"
    "Clear extends this with habit stacking, which connects to a principle called the Diderot Effect. "
    "Denis Diderot, the French philosopher, received a beautiful scarlet robe as a gift. Suddenly his other possessions looked shabby by comparison, and he replaced them one by one until his whole study was transformed. "
    "One purchase triggered a chain of related purchases, each one making the next feel necessary. "
    "Habit stacking uses that same chain reaction deliberately: \"After [CURRENT HABIT], I will [NEW HABIT].\" "
    "Your morning coffee becomes the cue for journaling. Journaling becomes the cue for planning your day. "
    "Each habit in the sequence triggers the next, building a behavioral chain that runs with minimal friction or willpower.\n\n"
    "The connection to earlier chapters is clear and direct. Chapter 1 showed that small behaviors compound into significant results over time. "
    "Chapter 2 showed that identity sustains those behaviors by making them feel like a natural expression of who you are. "
    "Chapter 3 mapped the habit loop: cue, craving, response, reward. "
    "Chapter 4 introduced awareness through Pointing-and-Calling and the Habits Scorecard, giving you an accurate map of your current behavioral patterns. "
    "Chapter 5 provides the first construction tool: instead of waiting for cues to appear on their own, you engineer them into your existing daily routine. "
    "The behavior no longer depends on motivation or memory. It's embedded in the context of your day.\n\n"
    "What makes this approach so quietly effective is that it removes the gap between intention and action entirely. "
    "You've already decided what you'll do, when you'll do it, and where it will happen. When the moment arrives, there's nothing left to deliberate. "
    "The plan runs because you built it into the architecture of your day, not because you summoned the willpower to start from scratch. "
    "And you can start using it today."
)

# ============================================================
# ch5 hard/direct: 320 -> expand to 500+
# ============================================================
fixes[(5, "hard", "direct")] = (
    "In 2001, British researchers ran a study that effectively isolated the single most important variable in behavior change. "
    "248 participants, three groups. Group one tracked their workouts. Group two received motivational content about the health benefits of exercise. "
    "Group three wrote one sentence: \"I will exercise at [TIME] in [PLACE] on [DAY].\" "
    "About 35% of the first two groups exercised regularly. 91% of group three did. "
    "The variable wasn't motivation, information, or tracking. It was a pre-committed plan specifying exactly when and where the behavior would happen.\n\n"
    "Clear identifies this as an implementation intention. The formula: \"I will [BEHAVIOR] at [TIME] in [LOCATION].\" "
    "The mechanism is specificity. Vague intentions (\"exercise more\") leave every decision open, and each open decision is a failure point where the behavior can die. "
    "Specific plans (\"gym at 6 AM on Monday, Wednesday, and Friday\") close those decisions in advance so the behavior fires when the context arrives. "
    "No deliberation required. No willpower needed to start. The plan does the work that motivation usually fails to do consistently.\n\n"
    "He extends this with habit stacking: \"After [CURRENT HABIT], I will [NEW HABIT].\" "
    "The existing habit serves as the cue, connecting directly to Chapter 3's habit loop where cue triggers craving triggers response triggers reward. "
    "The underlying principle is the Diderot Effect: the French philosopher Diderot received a lavish robe as a gift and then replaced everything in his study to match it, one item at a time. "
    "One change triggered a chain of related changes. Habit stacking converts that natural chain into deliberate behavioral architecture. "
    "\"After I pour coffee, I review my goals for the day. After I review goals, I write for ten minutes.\" "
    "Each completed behavior cues the next, building a sequence that runs on structure rather than motivation.\n\n"
    "This integrates with the full framework from Chapters 1 through 4. Compounding (Chapter 1) requires consistency sustained over long periods. "
    "Consistency requires identity alignment (Chapter 2) so the behavior feels natural rather than forced. "
    "Identity expresses itself through the habit loop (Chapter 3), which needs clear cues to trigger each behavioral sequence. "
    "Visible cues (Chapter 4) are the prerequisite, and implementation intentions and habit stacking make those cues explicit, context-dependent, and impossible to miss. "
    "They're the first construction tools in the practical toolkit: instead of hoping for the right moment to act, you engineer the moment in advance.\n\n"
    "The practical implication is direct: stop relying on motivation to initiate behavior. Pre-load the decision completely. "
    "Specify the time, the place, and the preceding habit that will serve as the trigger. "
    "The behavior becomes a scheduled event embedded in your routine rather than a spontaneous act dependent on your mood. "
    "Spontaneous behavior depends on mood and energy, both of which fluctuate. Scheduled behavior depends on architecture, which is stable. "
    "Start there."
)

# ============================================================
# ch5 hard/competitive: 335 -> expand to 500+
# ============================================================
fixes[(5, "hard", "competitive")] = (
    "A British study from 2001 isolated the variable that separates people who follow through on behavioral intentions from people who don't, and the answer wasn't motivation, accountability, desire, or discipline. "
    "248 participants, three groups. Group three wrote one sentence: \"I will exercise at [TIME] in [PLACE] on [DAY].\" "
    "91% followed through on their exercise intention. About 35% of the other groups managed it. "
    "The difference was a pre-committed plan specifying when, where, and what. Nothing more.\n\n"
    "Clear calls this an implementation intention. The formula: \"I will [BEHAVIOR] at [TIME] in [LOCATION].\" "
    "The competitive insight: most people lose consistency not because they lack discipline but because they leave too many decisions unmade each day. "
    "Each unmade decision is a failure point where motivation, fatigue, or distraction can derail the behavior before it starts. "
    "Specific plans close those gaps in advance. The behavior fires when the context arrives, not when you manage to summon enough willpower.\n\n"
    "He extends this with habit stacking: \"After [CURRENT HABIT], I will [NEW HABIT].\" "
    "The existing habit serves as the trigger, connecting directly to Chapter 3's four-step habit loop where the cue initiates the entire behavioral chain. "
    "The Diderot Effect provides the underlying mechanism: the French philosopher Diderot received a beautiful robe and replaced everything around it to match, one item triggering the next replacement. "
    "One change cascaded into a full transformation of his environment. Habit stacking converts that natural cascade into deliberate architecture for your daily routine. "
    "\"After my morning coffee, I review priorities. After reviewing priorities, I start the hardest task first.\" "
    "Each link in the chain cues the next, building a sequence that runs on structure rather than daily motivation.\n\n"
    "This integrates with the full competitive framework built across Chapters 1 through 4. "
    "Compounding (Chapter 1) requires consistency sustained over long periods to produce the exponential returns that arrive late on the curve. "
    "Identity (Chapter 2) sustains that consistency by reducing the willpower cost of each daily repetition. "
    "The habit loop (Chapter 3) provides the mechanical framework for each behavior. "
    "Awareness (Chapter 4) reveals the existing patterns already running in your daily routine. "
    "Implementation intentions and habit stacking are the first tools for building new behavioral patterns into your existing architecture with precision. "
    "They pre-load every decision so the behavior doesn't depend on daily motivation, which fluctuates unpredictably.\n\n"
    "The competitor who pre-decides context eliminates the decision gap where others lose consistency without even realizing the loss is happening. "
    "Every decision pre-made is willpower conserved for actual performance rather than wasted on deliberation. "
    "Every decision left open is a point of vulnerability where the behavior can fail to launch. "
    "Stack enough pre-committed behaviors into a tight daily sequence, and your system runs on architecture rather than ambition. "
    "And the compounding never stops once the architecture is in place."
)


def main():
    with open(JSON_PATH, "r") as f:
        data = json.load(f)

    for chapter in data:
        ch_num = chapter["number"]
        for difficulty in ["easy", "medium", "hard"]:
            for tone in ["gentle", "direct", "competitive"]:
                key = (ch_num, difficulty, tone)
                if key in fixes:
                    chapter["contentVariants"][difficulty]["chapterBreakdown"][tone] = fixes[key]

    with open(JSON_PATH, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    # Verify ALL word counts
    print("=== FULL VERIFICATION ===")
    targets = {
        "easy": (140, 175),
        "medium": (330, 420),
        "hard": (490, 600),
    }
    all_pass = True
    for chapter in data:
        ch_num = chapter["number"]
        if ch_num > 5:
            continue
        print(f"\nChapter {ch_num}:")
        for difficulty in ["easy", "medium", "hard"]:
            lo, hi = targets[difficulty]
            for tone in ["gentle", "direct", "competitive"]:
                text = chapter["contentVariants"][difficulty]["chapterBreakdown"][tone]
                wc = len(text.split())
                status = "OK" if lo <= wc <= hi else "FAIL"
                if status == "FAIL":
                    all_pass = False
                print(f"  {difficulty}/{tone}: {wc} words [{status}] (target {lo}-{hi})")

    print(f"\n{'ALL PASSED' if all_pass else 'SOME FAILED - needs adjustment'}")

if __name__ == "__main__":
    main()
