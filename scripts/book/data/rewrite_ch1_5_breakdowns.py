#!/usr/bin/env python3
"""
Rewrite all 45 chapterBreakdown variants in chapters 1-5 to match target word counts.
Easy: 140-175 words. Medium: 330-420 words. Hard: 490-600 words.
"""
import json
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_PATH = os.path.join(SCRIPT_DIR, "chapters-1-5.json")

# ============================================================
# CHAPTER 1: The Surprising Power of Atomic Habits
# ============================================================

ch1_easy_gentle = (
    "What if getting 1% better each day could completely transform your life within a year? "
    "That's the opening premise of James Clear's first chapter, and he backs it with a story from British Cycling. "
    "For a century, the team was so bad a top bike manufacturer refused to sell them equipment. "
    "Then coach Dave Brailsford started hunting for 1% improvements everywhere: seat comfort, suit fabric, recovery gels, hand-washing routines, even pillow types. "
    "Each tweak was tiny. Together, they produced 178 world championships, 66 Olympic golds, and 5 Tour de France wins.\n\n"
    "Clear pairs this with a warning: the Plateau of Latent Potential. Like heating ice from 25 to 31 degrees, effort accumulates invisibly before the melting point hits. "
    "Most people quit in this \"valley of disappointment,\" mistaking delayed results for a broken method. "
    "The fix? Stop chasing goals and build systems instead. Every competitor wants to win. "
    "What separates outcomes is the daily process you run whether you feel motivated or not. "
    "Change the habits, and over time, the results take care of themselves."
)

ch1_easy_direct = (
    "How much would your life change if you got just 1% better at something every single day for a year? "
    "Clear opens with the math: 1.01 raised to the 365th power equals 37.78. "
    "A 1% daily decline drops you to 0.03. These two curves start identically and end in completely different places. "
    "He proves it with British Cycling. Dave Brailsford hunted 1% gains in bike seats, suit fabric, recovery gels, hand-washing, and sleep quality. "
    "Within a decade: 178 world championships, 66 Olympic golds, 5 Tour de France titles.\n\n"
    "The catch is the Plateau of Latent Potential. Like ice warming from 25 to 31 degrees, effort stores up invisibly before crossing the threshold. "
    "Clear calls the gap between expected and actual progress the \"valley of disappointment.\" "
    "Most people quit there. The chapter lands on a direct claim: stop prioritizing goals, start prioritizing systems. "
    "Winners and losers share the same goals. What separates them is their daily process. "
    "Fix the system, and the scoreboard updates on its own."
)

ch1_easy_competitive = (
    "What separates people who actually transform their performance from the ones who set ambitious targets and stall out? "
    "Clear argues it's the thing most people dismiss because it looks too small: 1% daily improvement, applied relentlessly. "
    "British Cycling spent a century losing. Then Dave Brailsford optimized dozens of tiny variables: seat geometry, suit fabric, recovery gels, hand-washing, pillow types. "
    "Each change was laughably minor. Stacked together: 178 world championships, 66 Olympic golds, 5 Tour de France titles in ten years.\n\n"
    "But there's a trap. The Plateau of Latent Potential catches almost everyone who tries this. "
    "Results lag behind effort like ice warming from 25 to 31 degrees. Nothing visible changes until 32. "
    "Clear calls this stretch the \"valley of disappointment.\" Every day your competitors quit during the plateau is a day you gain ground. "
    "The chapter closes with a principle that ties it together: goals are overrated. Every serious competitor has them. "
    "The edge belongs to whoever builds the most reliable daily system. "
    "You do not rise to the level of your goals. You fall to the level of your systems."
)

# ---

ch1_medium_gentle = (
    "What if the changes that matter most in your life are the ones you barely notice while they're happening? "
    "Clear opens by asking you to reconsider what progress actually looks like. His answer: it looks boring. "
    "It looks like doing something slightly better today than yesterday, then repeating that tomorrow.\n\n"
    "He anchors this with Dave Brailsford and British Cycling. For over a century, the team was mediocre to embarrassing. "
    "Brailsford introduced \"the aggregation of marginal gains\": improve every cycling-related variable by 1%. "
    "Bike seats, suit fabrics, recovery gels, hand-washing technique, pillow selection. None would make headlines alone. "
    "Together, within a decade, the team amassed 178 world championships, 66 Olympic golds, and 5 Tour de France victories. "
    "The math reshapes how you see daily choices. Improve 1% daily and you're 37 times better after a year. Decline 1% and you drop to nearly zero. "
    "The compounding works in both directions simultaneously, and the gap between the two curves starts invisible and ends enormous.\n\n"
    "But small improvements don't feel like they're working. Clear introduces the Plateau of Latent Potential to explain why people give up too soon. "
    "Heating an ice cube from 25 to 31 degrees changes nothing visible. At 32, it melts. "
    "Your habits follow the same pattern. You go to the gym for three weeks and see no change. You write every morning and your prose still feels clumsy. "
    "Clear calls this the \"valley of disappointment.\" Most people quit here, not because the approach failed, but because the timeline was longer than expected. "
    "Almost every success story you admire was preceded by a stretch that looked like nothing from the outside.\n\n"
    "The chapter's final argument flips a common assumption: goals are overrated. Winners and losers share the same goals. "
    "What separates them is systems, the daily processes that run regardless of motivation. "
    "Clear identifies four problems with goal-first thinking: goals postpone happiness, don't fix underlying processes, narrow your success definition, and create boom-bust cycles. "
    "The alternative is to fall in love with the process. Fix the inputs, and the outputs follow. "
    "Every morning you show up and run the system, you cast a vote for a specific version of your future. "
    "Your habits aren't just producing results. They're producing the person who will either sustain those results or watch them fade."
)

ch1_medium_direct = (
    "What if 1% turns out to be the most important number in your entire approach to getting better? "
    "Clear makes the case that consistency matters more than size of change, and he uses a dramatic real-world turnaround to prove it.\n\n"
    "Dave Brailsford took over British Cycling, a team so terrible for a hundred years that a major bike manufacturer refused to sell to them. "
    "His approach: hunt for 1% improvements in everything connected to performance. Seat comfort, suit fabric, recovery gels, hand-washing technique, pillow quality. "
    "No single change was impressive. Stacked together: 178 world championships, 66 Olympic golds, and 5 Tour de France victories in about ten years. "
    "Better sleep improved recovery. Better recovery improved training. Better training improved race times. "
    "The gains multiplied rather than simply adding up. "
    "Clear backs this with math: 1.01^365 equals 37.78. A 1% daily decline takes you to 0.03. Your habits compound for you or against you right now.\n\n"
    "But compounding has a frustrating feature: delayed results. Clear introduces the Plateau of Latent Potential. "
    "Heating ice from 25 to 31 degrees produces no visible change. At 32, melting begins. "
    "The work from 25 to 31 stored energy building toward the phase transition. Your habits work the same way. "
    "You exercise for three weeks and the mirror looks the same. You study for a month and bomb a practice test. "
    "Clear calls this the \"valley of disappointment.\" Compounding delivers exponential results on a delayed schedule: the early phase always looks flat, the breakthrough always looks sudden. "
    "Understanding this prevents you from abandoning a working strategy because results haven't appeared on your preferred timeline.\n\n"
    "Clear's biggest argument targets goals. Not having direction, but letting goals be your primary framework. "
    "Winners and losers often share identical goals. What separates them is their systems. "
    "Four problems with goal-only thinking: goals delay happiness, don't fix the underlying process, narrow your success definition, and create yo-yo effort cycles. "
    "When you commit to a process rather than a destination, improvement becomes the default state. "
    "Your current results are a lagging measure of current habits. Fix the leading indicator, and the lagging indicator adjusts. "
    "The only choice is whether you design the system deliberately or let it design itself by default."
)

ch1_medium_competitive = (
    "What if the single most powerful performance advantage available to you is something your competitors dismiss every day because it looks too small to bother with? "
    "Clear opens with a provocation: 1% improvements, applied consistently, produce more total performance gain than any dramatic overhaul.\n\n"
    "British Cycling spent over a century losing. A leading bike manufacturer refused to sell them equipment to protect its brand. "
    "Then Dave Brailsford introduced \"the aggregation of marginal gains\": 1% improvements in every variable. "
    "Seat comfort, suit fabric, recovery gels, hand-washing protocol, pillow selection. "
    "Each optimization was so minor no rational competitor would lose sleep over any single one. "
    "Together: 178 world championships, 66 Olympic golds, 5 Tour de France titles in a decade. "
    "The math: 1.01^365 = 37.78. A 1% daily decline erodes you to 0.03. These curves start identically on day one and end in completely different places. "
    "The gains also interacted: better sleep meant faster recovery, which meant higher-quality training, which meant better race performance. "
    "Marginal gains in connected variables create multiplicative outcomes.\n\n"
    "The returns are heavily back-loaded. The first months produce results barely distinguishable from zero. "
    "The steep upward bend arrives late, which means quitting at the halfway point forfeits most of the value. "
    "Clear calls the flat early stretch the \"valley of disappointment,\" where effort accumulates but the scoreboard hasn't moved. "
    "This is where competitors drop out. Every day they quit is a day the field thins for you.\n\n"
    "Clear then targets something most performance advice treats as sacred: goals. Every competitor shares the same goals. "
    "What separates outcomes is systems. Four structural failures of goal-centric thinking: postponed satisfaction, no root-cause fix, artificially narrow success definition, and predictable boom-bust cycles. "
    "A system-oriented competitor doesn't cycle between effort and coasting. Results become the natural byproduct of showing up and executing. "
    "The daily process is the only remaining variable that can create a gap when competitors share ambitions and talent levels. "
    "It is the entire game."
)

# ---

ch1_hard_gentle = (
    "What if the most life-changing thing you could do today looks so small that you'd be tempted to skip it entirely? "
    "Clear opens with British Cycling, a team that spent a century as a punchline. Dave Brailsford took over and hunted for 1% improvements in everything: seat comfort, suit fabric, recovery gels, hand-washing routines, pillow types. "
    "Each change was borderline trivial. Together: 178 world championships, 66 Olympic golds, 5 Tour de France wins in a decade. "
    "The math is clean. A 1% daily gain compounds to 37x improvement over a year. A 1% daily decline erodes you to nearly zero. "
    "The direction of your tiny daily choices determines which curve you ride.\n\n"
    "But the compounding has a painful feature: the Plateau of Latent Potential. Like ice warming from 25 to 31 degrees, effort accumulates invisibly. "
    "At 32, everything shifts. Clear calls the period before breakthrough the \"valley of disappointment,\" where expected results outpace actual results by a frustrating margin. "
    "You go to the gym for weeks and the mirror stays the same. You write every morning and your prose feels clumsy. "
    "Most people quit here, interpreting the delay as proof the method is broken. They're usually one degree from the melting point. "
    "Almost every success story you admire was preceded by a stretch that looked, from the outside, like nothing was happening.\n\n"
    "This connects to a deeper problem with how people approach improvement. Clear argues that goals are overrated. "
    "Every Olympic athlete wants gold. Every startup founder wants growth. "
    "What separates outcomes is systems: the daily processes you follow regardless of how motivated you feel. "
    "Clear identifies four failures of goal-only thinking. Goals postpone satisfaction to a future event. Goals don't fix underlying processes, so gains revert. "
    "Goals narrow your success definition to one outcome. Goals create boom-bust cycles of intense effort followed by regression.\n\n"
    "Systems address all four problems. When your daily process is dialed in, improvement becomes the default state rather than a temporary sprint. "
    "Your current life reflects the habits you've been running. Your net worth is a lagging measure of financial habits. Your weight reflects eating habits. Your knowledge reflects learning habits. "
    "Fix the daily inputs, and the outputs adjust on their own timeline. "
    "The relationship between system and outcome isn't optional. It's automatic. "
    "You do not rise to the level of your goals. You fall to the level of your systems.\n\n"
    "What makes this chapter's message so quietly powerful is that it reframes the entire project of self-improvement. "
    "You don't need a dramatic overhaul. You need a slight change in direction, maintained long enough for the compounding to become visible. "
    "The ice will melt. The curve will bend. The results will appear. "
    "And that is the fundamental promise of this chapter: the process works, if you let it run long enough."
)

ch1_hard_direct = (
    "What separates a century of failure from a decade of historic dominance? "
    "In British Cycling's case: Dave Brailsford and the aggregation of marginal gains. "
    "He optimized bike seats, suit fabric, recovery gels, hand-washing protocols, and pillow quality. "
    "Each change was almost trivially small. Compounded together: 178 world championships, 66 Olympic golds, 5 Tour de France titles. "
    "The math is direct. 1.01^365 = 37.78. A 1% daily decline drops you to 0.03. "
    "These curves are already running in your life whether you track them or not.\n\n"
    "The gains multiplied across domains. Better pillows meant better sleep. Better sleep meant faster recovery. "
    "Faster recovery meant higher-intensity training. Higher-intensity training meant faster race times. "
    "Marginal gains in connected variables create multiplicative outcomes, not additive ones. "
    "This explains why the strategy produced such disproportionate results: small improvements in interrelated systems compound on top of each other.\n\n"
    "But compounding has a structural problem: back-loaded returns. The first months look flat. "
    "Clear introduces the Plateau of Latent Potential. Heating ice from 25 to 31 degrees stores energy without visible change. At 32, it melts. "
    "Your habits follow this pattern. You put in effort, and results operate on a delay. "
    "Clear calls this the \"valley of disappointment.\" You exercise for three weeks and your times stay flat. You study for a month and bomb a test. "
    "The effort is accumulating beneath the surface. Your brain wants linear feedback, but compounding delivers exponential results on a delayed schedule. "
    "Understanding this prevents you from abandoning a working strategy because results haven't appeared on your preferred timeline.\n\n"
    "Clear then makes a structural argument against goals. Goals are not useless, but they're a commodity. "
    "Every competitor has them. What separates actual outcomes is systems: the daily processes executed regardless of mood. "
    "Four problems with goal-only thinking: goals delay happiness to a future event, don't fix root processes so gains revert, narrow success to one outcome, and create boom-bust cycles. "
    "Systems eliminate all four failure modes. When you commit to a process, improvement becomes the default operating state.\n\n"
    "Your current results are a lagging measure of current habits. Net worth lags financial habits. Weight lags eating habits. Knowledge lags learning habits. "
    "Fix the leading indicator, and the lagging indicator adjusts. "
    "The relationship between inputs and outputs is not optional. It is automatic. "
    "The only question is whether you design the system deliberately or let it design itself by default. "
    "And the most effective inputs are small, consistent, and compounding, applied daily without exception."
)

ch1_hard_competitive = (
    "What would you do if someone proved that the single most powerful competitive advantage in any field is something that, on any given day, looks completely unremarkable? "
    "British Cycling spent a century losing. A major manufacturer refused to sell them bikes. "
    "Then Dave Brailsford applied the aggregation of marginal gains: 1% improvements in every variable. "
    "Seat comfort, suit fabric, recovery gels, hand-washing, pillow types. "
    "Each tweak was so minor no competitor would worry about any single one. "
    "Together: 178 world championships, 66 Olympic golds, 5 Tour de France titles in a decade.\n\n"
    "The gains interacted multiplicatively. Better sleep meant faster recovery. Faster recovery meant harder training. "
    "Harder training meant faster times. Faster times meant higher confidence and buy-in, which meant riders actively sought their own 1% edges. "
    "Marginal gains in connected variables don't just stack. They compound across domains. "
    "The math is clean: 1.01^365 = 37.78. A 1% daily decline drops you to 0.03. "
    "These two curves start identically and diverge into completely different outcomes.\n\n"
    "The returns are heavily back-loaded, and this creates an additional competitive advantage. "
    "The first months of 1% improvement produce results barely distinguishable from zero. "
    "The steep acceleration arrives late. Quitting at the halfway point forfeits most of the value. "
    "Clear calls the flat early stretch the \"valley of disappointment.\" "
    "This is where competitors drop out. They interpret delayed feedback as a failed strategy. "
    "Every day they quit during the plateau is a day the field thins for you. "
    "If you understand the shape of the curve, you can tolerate the early flatness. That tolerance is itself a competitive edge.\n\n"
    "Clear then takes aim at goals. Every serious competitor shares the same goals. What separates outcomes is systems. "
    "Four structural failures of goal-centric thinking: postponed satisfaction, no root-cause fix, artificially narrow success criteria, and predictable boom-bust cycles. "
    "A system-oriented competitor doesn't oscillate between effort and coasting. The system runs continuously, independent of any single milestone. "
    "In any field where competitors share ambitions and talent levels, the daily process is the only variable that creates separation.\n\n"
    "Your current results are a lagging measure of the system you've been running. "
    "The scoreboard reflects habits, not intentions. Change the daily inputs, and the outputs adjust on their own schedule. "
    "The edge belongs to whoever builds the most reliable daily process and runs it longer than everyone else. "
    "Everything else, the results, the recognition, the scoreboard, follows from that single daily commitment repeated over a long enough timeline."
)

# ============================================================
# CHAPTER 2: How Your Habits Shape Your Identity (and Vice Versa)
# ============================================================

ch2_easy_gentle = (
    "Have you ever stuck with a new habit for a few weeks and then quietly let it fade, even though nothing went wrong? "
    "Clear says the problem usually isn't your plan or your willpower. It's that you're trying to change what you do without changing who you believe you are. "
    "He describes three layers of behavior change: outcomes (what you get), processes (what you do), and identity (what you believe). "
    "Most people start with outcomes and work inward. Clear says the lasting approach is to start with identity and work outward.\n\n"
    "The difference shows up in language. A person who says \"No thanks, I'm trying to quit smoking\" is still holding onto a smoker's identity. "
    "A person who says \"No thanks, I'm not a smoker\" has shifted the belief underneath the behavior. "
    "Every time you perform a habit, you cast a small vote for a type of person. Enough votes, and the identity becomes self-evident. "
    "You don't need a complete reinvention. You need enough repetitions to shift the story you tell about yourself. "
    "The story changes, and the habits that once required willpower start feeling like something you just naturally do."
)

ch2_easy_direct = (
    "Why do two people with the exact same workout plan end up with completely different results three months later? "
    "Clear's answer: identity. Behavior change has three layers. The outer layer is outcomes (what you get). The middle layer is processes (what you do). "
    "The core is identity (what you believe about yourself). "
    "Most people aim at outcomes first. Clear argues the effective sequence is identity first, then process, then outcomes.\n\n"
    "The mechanism is a voting system. Every action you take is a vote for the type of person you're becoming. "
    "Write one page today, and you've cast a vote for \"writer.\" Skip the gym and you've cast a vote for \"sedentary person.\" "
    "No single vote is decisive, but a majority wins. "
    "The practical distinction: saying \"I'm trying to quit smoking\" treats the identity as unchanged. Saying \"I'm not a smoker\" treats the behavior as evidence of who you already are. "
    "That shift changes the entire motivational structure. You stop fighting behavior with willpower and start aligning behavior with belief. "
    "Start changing who you believe you are, and let the doing follow naturally from there."
)

ch2_easy_competitive = (
    "Everyone talks about building better habits, but almost nobody addresses why identical systems produce wildly different results in different people. "
    "Clear's answer is the variable most people overlook: identity. "
    "He maps behavior change as three concentric layers. Outcomes sit on the outside. Processes are in the middle. Identity is the core. "
    "Most people work from the outside in. Clear says winners work from the inside out.\n\n"
    "The mechanism is a voting system. Every action casts a vote for a type of identity. "
    "Run today, and you vote for \"runner.\" Skip the work, and you vote for \"someone who cuts corners.\" "
    "No single vote decides the election, but a pattern emerges. "
    "This is why two competitors with identical plans get different results: one has aligned the plan with their identity, the other is fighting their identity every step. "
    "The \"I'm not a smoker\" versus \"I'm trying to quit\" distinction captures the entire difference. "
    "When your identity matches your system, you stop spending willpower on compliance. "
    "You get to put all of yours into the work that moves the needle."
)

# ---

ch2_medium_gentle = (
    "What if the reason your habits keep slipping has nothing to do with your willpower, your motivation, or even the quality of your daily system? "
    "Clear suggests the real issue runs deeper. It lives in the story you tell yourself about who you are.\n\n"
    "He introduces three layers of behavior change, pictured as concentric circles. "
    "The outer ring is outcomes: what you get. The middle ring is processes: what you do. "
    "The core is identity: what you believe about yourself. "
    "Most people start from the outside and work inward, picking a result and then trying to find a process to reach it. "
    "Clear argues that lasting change works the opposite way. Start with identity, and the processes and outcomes follow.\n\n"
    "The practical distinction appears in a single phrase. Someone offered a cigarette can respond two ways. "
    "\"No thanks, I'm trying to quit\" treats smoking as something they still do but are resisting. "
    "\"No thanks, I'm not a smoker\" treats non-smoking as a fact about who they are. "
    "Same behavior, completely different internal structure. The first requires ongoing willpower. The second is simply self-consistent. "
    "Clear explains the mechanism: every habit you perform is a vote for a type of identity. "
    "Write one page and you cast a vote for \"writer.\" Go to the gym and you vote for \"active person.\" "
    "No single vote is decisive. But as votes accumulate, a pattern forms, and that pattern becomes a belief. "
    "Once the belief takes hold, the behavior stops requiring effort because it's just what someone like you does.\n\n"
    "Building from Chapter 1's insight that systems beat goals, Chapter 2 reveals what makes systems stick. "
    "A system aligned with your identity runs on autopilot. A system fighting your identity requires constant willpower, which is a finite resource. "
    "The two-step process Clear recommends: first, decide the type of person you want to be. Second, prove it to yourself with small wins. "
    "You don't need a dramatic reinvention. You need enough evidence, enough votes, for the new identity to feel true. "
    "That is the real gift of identity-based change: it takes the pressure off any single day and places it on the overall direction, which is something you can always influence."
)

ch2_medium_direct = (
    "Chapter 1 proved that systems outperform goals and that compounding is the engine behind long-term results. "
    "Chapter 2 answers the next question: why do some systems sustain themselves while others collapse?\n\n"
    "Clear introduces three layers of behavior change. Outcomes (what you get) sit on the outside. "
    "Processes (what you do) occupy the middle. Identity (what you believe) is the core. "
    "Most people start with outcomes: lose 20 pounds, get a promotion, publish a book. "
    "Then they try to bolt on processes to reach the outcome. Clear argues this is backwards. "
    "Lasting change starts at the identity layer and radiates outward.\n\n"
    "The mechanism is a voting system. Every action is a vote for a type of identity. "
    "Go to the gym: one vote for \"person who exercises.\" Write a paragraph: one vote for \"writer.\" "
    "No single vote determines the result. But a majority forms a belief, and beliefs drive behavior automatically. "
    "The key distinction: \"I'm trying to quit smoking\" versus \"I'm not a smoker.\" "
    "The first frames the identity as unchanged and uses willpower to override it. "
    "The second frames the identity as already shifted and lets behavior follow. "
    "Same external action, different internal structure, vastly different sustainability.\n\n"
    "This connects directly to Chapter 1's systems argument. A system that aligns with your identity is self-reinforcing. "
    "You don't need willpower to act like the person you believe you are. "
    "A system that contradicts your identity demands constant effort, and willpower is a depletable resource. "
    "The two-step protocol: decide who you want to be, then prove it with small wins. "
    "Each small win casts another vote. Enough votes shift the belief. The shifted belief sustains the system without external motivation. "
    "Without identity alignment, even a well-designed system eventually breaks under friction. "
    "With it, the system becomes self-reinforcing and durable."
)

ch2_medium_competitive = (
    "Chapter 1 established that systems determine results and that compounding is the mathematical engine behind long-term performance. "
    "Chapter 2 answers the question that separates durable competitors from temporary ones: why do some systems sustain themselves while others collapse under pressure?\n\n"
    "Clear maps behavior change as three concentric layers. Outcomes on the outside. Processes in the middle. Identity at the core. "
    "Most competitors start with outcomes: win the title, hit the revenue target, lead the ranking. "
    "Then they search for processes to reach those outcomes. "
    "Clear argues the effective direction is reversed. Start with identity. Let process and outcomes follow.\n\n"
    "The mechanism is a voting system. Each action casts a vote for a type of identity. "
    "Train today: one vote for \"elite athlete.\" Cut corners: one vote for \"person who compromises.\" "
    "No single vote is decisive, but a pattern emerges, and that pattern becomes a belief. "
    "The competitive significance: two people running identical systems get different results because one has aligned the system with their identity and the other hasn't. "
    "The aligned competitor doesn't spend willpower on compliance. "
    "The misaligned competitor burns willpower every session, and willpower is finite.\n\n"
    "The \"I'm not a smoker\" versus \"I'm trying to quit\" distinction captures the entire structural difference. "
    "The first operates from a settled identity. The second fights against one. "
    "Building from Chapter 1: a well-designed system is necessary but not sufficient. It needs an identity foundation. "
    "Without it, the system erodes under pressure. With it, the system becomes self-reinforcing. "
    "The two-step process: decide who you want to be, then prove it with small, repeated wins. "
    "Each win casts a vote. Enough votes lock in the identity. The locked-in identity sustains the system automatically. "
    "Competitors who operate from identity alignment don't just perform better on good days. "
    "They have a structural advantage that compounds every day, in every interaction, across every domain of performance."
)

# ---

ch2_hard_gentle = (
    "Why would someone who successfully maintained a new habit for thirty straight days suddenly stop on day thirty-one, without any external disruption or crisis? "
    "Clear says the answer lives in a layer most people never examine: identity. "
    "Building from Chapter 1's insight that systems beat goals, Chapter 2 reveals why some systems run on autopilot while others require constant willpower.\n\n"
    "Clear introduces three layers of behavior change as concentric circles. "
    "Outcomes (what you get) sit on the outside. Processes (what you do) are in the middle. Identity (what you believe) is at the core. "
    "Most people start from the outside and work inward: pick a result, find a process, then force compliance. "
    "Clear argues that lasting change works from the inside out. When your identity aligns with the behavior, willpower becomes unnecessary. "
    "The person who says \"I'm not a smoker\" doesn't need to resist cigarettes. The non-smoker identity handles the decision automatically.\n\n"
    "The mechanism is a voting system. Every habit you perform casts a vote for a type of person. "
    "Write one page, and you've voted for \"writer.\" Go to the gym, and you've voted for \"someone who values fitness.\" "
    "No single vote decides the election, but a majority forms a belief. Once the belief takes hold, the behavior stops requiring effort. "
    "This explains why two people with the same plan get different results: one has enough votes for the new identity, the other doesn't.\n\n"
    "The connection to Chapter 1's compounding principle is direct. Identity-aligned habits compound freely because they don't burn willpower. "
    "Identity-misaligned habits drain energy with every repetition, creating an invisible tax on your system. "
    "Over weeks and months, that tax compounds too, in the wrong direction. The person fighting their identity every morning eventually runs out of fuel. "
    "The person whose identity matches their habits just keeps going, not because they're tougher, but because compliance costs them less.\n\n"
    "Clear's two-step process: first, decide the type of person you want to be. Second, prove it with small wins. "
    "You don't need a dramatic transformation. You need enough repetitions to shift the story. "
    "Each small win is another vote. Each vote edges the identity closer. And once the identity tips, the system sustains itself. "
    "Your job during the difficult phase is simply to keep casting votes, knowing that each one brings you closer to the tipping point where everything gets easier."
)

ch2_hard_direct = (
    "Chapter 1 established that systems outperform goals and that compounding drives long-term results. "
    "Chapter 2 answers the structural follow-up: what determines whether a system sustains itself or collapses under friction?\n\n"
    "Clear introduces three layers of behavior change. Outcomes (what you get) on the outside. Processes (what you do) in the middle. "
    "Identity (what you believe) at the core. Most people start with outcomes and search for processes to reach them. "
    "Clear argues the effective direction is reversed: identity first, then process, then outcomes. "
    "The reason is structural. An identity-aligned system runs with minimal friction. "
    "An identity-misaligned system requires willpower at every step, and willpower depletes.\n\n"
    "The voting mechanism explains how identity forms and shifts. Every action is a vote for a type of person. "
    "Write a page: one vote for \"writer.\" Hit the gym: one vote for \"athlete.\" "
    "No single vote determines identity, but a majority forms a belief. Once the belief locks in, behavior follows automatically. "
    "\"I'm not a smoker\" versus \"I'm trying to quit\" captures the entire structural distinction. "
    "The first operates from a settled identity. The second fights against one. Same external behavior, different internal cost.\n\n"
    "This connects directly to Chapter 1's compounding framework. Compounding requires consistency. "
    "Consistency requires low friction. Low friction requires identity alignment. "
    "Without alignment, every repetition costs willpower. Over time, that cost accumulates and the system breaks. "
    "With alignment, every repetition reinforces the identity, which reinforces the behavior, which reinforces the identity. "
    "The loop becomes self-sustaining. This is the structural difference between habits that last months and habits that last years.\n\n"
    "The practical protocol has two steps. First, define the identity you want. Not an outcome (\"lose 20 pounds\") but a type of person (\"someone who doesn't miss workouts\"). "
    "Second, accumulate evidence through small wins. Each win casts a vote. Enough votes shift the belief. "
    "The shifted belief reduces the cost of the behavior. The reduced cost increases consistency. "
    "The increased consistency accelerates the compounding from Chapter 1. "
    "Without the identity foundation, systems require constant external motivation. "
    "With the foundation, the vehicle runs smoothly and the compounding produces results on its own schedule."
)

ch2_hard_competitive = (
    "Chapter 1 proved that systems determine results and that compounding is the mathematical engine behind long-term performance gains. "
    "Chapter 2 addresses the variable that determines whether a system holds up under competitive pressure or fractures when things get hard: identity.\n\n"
    "Clear maps three layers of behavior change. Outcomes sit on the outside. Processes in the middle. Identity at the core. "
    "Most competitors start with outcomes: win the championship, lead the market, top the ranking. Then they search for processes. "
    "Clear argues the winning direction is reversed. "
    "Identity-first competitors build systems that run on alignment rather than willpower. "
    "The distinction between \"I'm trying to quit\" and \"I'm not a smoker\" is the entire difference between fighting your identity and acting from it.\n\n"
    "The mechanism is a voting system. Every action casts a vote for a type of person. "
    "Train when it's inconvenient: vote for \"elite competitor.\" Cut a corner: vote for \"someone who compromises.\" "
    "No single vote is decisive, but patterns become beliefs, and beliefs drive automatic behavior. "
    "Two competitors with identical systems produce different results because one has alignment and the other doesn't. "
    "The aligned competitor doesn't spend willpower on compliance. The misaligned competitor leaks energy at every decision point.\n\n"
    "This connects to Chapter 1's compounding framework. Compounding requires consistency. Consistency requires low friction. "
    "Low friction requires identity alignment. Without it, every repetition carries a willpower tax. "
    "That tax compounds in the wrong direction: the system gets harder to maintain over time instead of easier. "
    "With alignment, every repetition reinforces the identity, which lowers friction, which increases consistency, which accelerates compounding. "
    "The self-reinforcing loop is the structural advantage that separates competitors who sustain performance from those who spike and fade.\n\n"
    "Clear's protocol: decide who you want to be, then prove it with small wins. Each win casts a vote. Enough votes lock in the belief. "
    "The locked-in belief sustains the system automatically, freeing mental bandwidth for actual performance rather than compliance. "
    "The competitive implication is significant. While others burn willpower on discipline, identity-aligned competitors invest that same energy in improvement. "
    "You don't start with intensity and hope identity follows. "
    "You start with consistency, and intensity follows the identity shift."
)

# ============================================================
# CHAPTER 3: How to Build Better Habits in 4 Simple Steps
# ============================================================

ch3_easy_gentle = (
    "In 1898, a psychologist named Edward Thorndike locked cats inside wooden puzzle boxes and watched what happened next. "
    "The cats didn't plan or reason their way out. They scratched, clawed, and stumbled randomly until they accidentally hit the lever that opened the door. "
    "But each time they were put back in the box, they found the lever faster. "
    "Behaviors followed by satisfying results got repeated. Behaviors that produced nothing got dropped. "
    "Thorndike called this the Law of Effect, and it still governs how habits form today.\n\n"
    "Clear builds on this to introduce the habit loop: cue, craving, response, reward. "
    "A cue triggers attention. A craving gives the cue meaning and motivation. A response is the action you take. A reward satisfies the craving and teaches your brain what to repeat. "
    "From this loop, Clear draws his Four Laws of Behavior Change: make it obvious, make it attractive, make it easy, and make it satisfying. "
    "Every practical strategy in the chapters ahead maps to one of these four laws."
)

ch3_easy_direct = (
    "Edward Thorndike's cats didn't learn to escape a puzzle box through insight or planning. "
    "They flailed until an accidental movement hit the lever. "
    "But each trial was faster than the last. Behaviors followed by satisfying outcomes got repeated; behaviors that produced nothing faded. "
    "Thorndike's Law of Effect, published in 1898, remains the foundation of habit science.\n\n"
    "Clear translates this into a four-step loop: cue, craving, response, reward. "
    "The cue triggers attention. The craving assigns motivation. The response is the action. The reward closes the loop and teaches the brain what to repeat. "
    "From these four steps, Clear derives his Four Laws of Behavior Change: make it obvious (cue), make it attractive (craving), make it easy (response), make it satisfying (reward). "
    "Want to build a habit? Optimize each step. Want to break one? Invert each law. "
    "The four laws are your control panel for shaping it."
)

ch3_easy_competitive = (
    "Thorndike's puzzle-box experiment in 1898 revealed a selection mechanism that still governs your performance today. "
    "Cats in boxes didn't strategize. They flailed until something worked, then repeated what worked faster each time. "
    "Behaviors followed by satisfying results survived. Everything else was discarded. "
    "This is how habits form: not through planning, but through a feedback loop your brain runs automatically.\n\n"
    "Clear maps this loop as four steps: cue, craving, response, reward. "
    "The cue triggers attention. The craving assigns meaning. The response is the action. The reward closes the loop and encodes the pattern. "
    "His Four Laws of Behavior Change map directly: make it obvious (cue), make it attractive (craving), make it easy (response), make it satisfying (reward). "
    "Build a habit by optimizing each step. Break one by inverting each law. "
    "The competitor who designs their environment around these four laws doesn't rely on motivation. "
    "The person who buys chips and then tries not to eat them is operating on hope."
)

# ---

ch3_medium_gentle = (
    "In 1898, inside a small laboratory, a young psychologist named Edward Thorndike began placing cats inside wooden puzzle boxes. "
    "The cats scratched, pawed, and stumbled randomly until they accidentally pressed the lever that opened the door. "
    "But each time they were returned to the box, they found the lever faster. "
    "Thorndike realized something foundational: behaviors followed by satisfying outcomes get repeated, and behaviors producing no satisfaction fade. "
    "He called this the Law of Effect. It remains the bedrock of habit science over a century later.\n\n"
    "Clear builds on Thorndike's insight to introduce the four-step habit loop: cue, craving, response, reward. "
    "A cue is a signal that something is available: you see a plate of cookies, your phone buzzes, you walk past a gym. "
    "A craving is the motivation the cue triggers: not the cookie itself, but the feeling of sweetness. Not the phone buzz, but the curiosity about who messaged. "
    "A response is whatever action follows: you eat the cookie, check the phone, walk into the gym. "
    "A reward is the payoff that closes the loop and teaches the brain which patterns to repeat. "
    "Without a cue, the loop never starts. Without a craving, there's no motivation. Without a response, nothing happens. Without a reward, nothing gets encoded.\n\n"
    "Building on Chapters 1 and 2, which showed that systems beat goals and that identity fuels systems, Chapter 3 gives you the operating manual for habit mechanics. "
    "From the four-step loop, Clear derives four corresponding laws. "
    "The 1st Law (Make It Obvious) targets the cue. The 2nd Law (Make It Attractive) targets the craving. "
    "The 3rd Law (Make It Easy) targets the response. The 4th Law (Make It Satisfying) targets the reward. "
    "To break a bad habit, invert each law: make it invisible, unattractive, difficult, unsatisfying. "
    "This gives you a diagnostic framework. When a habit isn't forming, ask which step is broken. "
    "That question marks the beginning of conscious habit design instead of unconscious habit accumulation."
)

ch3_medium_direct = (
    "Edward Thorndike put cats in puzzle boxes in 1898 and recorded what happened with systematic precision. "
    "The cats didn't reason. They flailed until accidental movements triggered the escape lever. "
    "But trial times shortened consistently. Successful behaviors were repeated; unsuccessful ones disappeared. "
    "Thorndike codified this as the Law of Effect. Over 125 years later, it remains the foundation of behavioral science.\n\n"
    "Clear translates Thorndike's principle into a four-step habit loop: cue, craving, response, reward. "
    "The cue is a signal: your phone buzzes, you see a gym bag, you smell coffee. "
    "The craving is the motivational interpretation: not the buzz itself but the anticipation of connection, not the coffee smell but the energy you associate with it. "
    "The response is the action: check the phone, walk to the gym, pour the cup. "
    "The reward is the satisfaction that closes the loop and programs the brain to repeat the pattern. "
    "Remove any single step and the habit breaks down. No cue, no trigger. No craving, no motivation. No response, no action. No reward, no encoding.\n\n"
    "From this loop, Clear derives the Four Laws of Behavior Change: make it obvious (cue), make it attractive (craving), make it easy (response), make it satisfying (reward). "
    "Each law maps to one step of the loop. To build a habit, strengthen the relevant step. To break one, invert the law. "
    "Chapters 1 and 2 established why habits matter (compounding) and what sustains them (identity). "
    "Chapter 3 delivers the mechanical framework: a four-part diagnostic for any behavior you want to install or remove. "
    "When a habit fails to form, one of these four steps is the bottleneck. When a bad habit persists, one of these four steps is reinforcing it. "
    "The result is a behavior change system with clear inputs and predictable outputs, where every failure can be traced to a specific step and every fix maps to a specific law."
)

ch3_medium_competitive = (
    "Thorndike's 1898 puzzle-box experiments stripped habit formation down to its most basic mechanics, and the results haven't been overturned in over a century of behavioral science. "
    "Cats didn't strategize. They flailed, stumbled on the lever, and repeated what worked. Trial times shortened. "
    "Unsuccessful behaviors were eliminated. This is the Law of Effect: satisfying consequences select behaviors for repetition.\n\n"
    "Clear maps this into a four-step loop: cue, craving, response, reward. "
    "The cue is the trigger. The craving assigns meaning and motivation. The response is the action. The reward closes the loop and programs the brain. "
    "Every habit you've ever formed, good or bad, runs on this loop. The four steps are not optional. "
    "Remove any one and the behavior chain breaks.\n\n"
    "From this loop, Clear derives the Four Laws of Behavior Change: make it obvious (cue), make it attractive (craving), make it easy (response), make it satisfying (reward). "
    "To build a habit, optimize each step. To break one, invert each law: invisible, unattractive, difficult, unsatisfying. "
    "This is the control system that connects Chapter 1's compounding to Chapter 2's identity. "
    "Compounding requires consistent behavior. Consistent behavior requires a working habit loop. "
    "Identity determines which loops feel natural and which create friction. "
    "The Four Laws give you specific intervention points rather than vague advice about discipline.\n\n"
    "Most competitors treat habit formation as a willpower problem. The four-step model reveals it as an engineering problem. "
    "When a competitor fails to build a habit, they blame motivation. A systems thinker diagnoses which of the four steps is broken and fixes it. "
    "That reframe is the competitive edge."
)

# ---

ch3_hard_gentle = (
    "In 1898, in a small laboratory space at Columbia University, a young psychologist named Edward Thorndike began running an experiment that would quietly reshape how we think about learning, behavior, and habits for the next century and beyond. "
    "He placed cats in wooden puzzle boxes. The cats scratched, pawed, and stumbled until they accidentally pressed the lever that opened the door. "
    "Returned to the box, they found the lever faster each time. "
    "Thorndike's conclusion was elegant: behaviors producing satisfying results get repeated; behaviors producing nothing fade. "
    "The Law of Effect. Simple, durable, and still foundational.\n\n"
    "Clear builds on this to present the four-step habit loop: cue, craving, response, reward. "
    "A cue is a signal: your phone buzzes, you smell coffee, you see running shoes by the door. "
    "A craving is the motivational interpretation: the anticipation of connection, energy, or a runner's high. "
    "A response is the action: check the phone, pour the cup, lace up the shoes. "
    "A reward is the satisfaction that closes the loop and teaches the brain to repeat the pattern. "
    "Remove any step and the chain breaks. This loop runs thousands of times daily, mostly below conscious awareness.\n\n"
    "From this loop, Clear derives the Four Laws of Behavior Change. The 1st Law (Make It Obvious) targets the cue. "
    "The 2nd Law (Make It Attractive) targets the craving. The 3rd Law (Make It Easy) targets the response. "
    "The 4th Law (Make It Satisfying) targets the reward. To break a bad habit, invert each: invisible, unattractive, difficult, unsatisfying. "
    "This framework connects directly to Chapters 1 and 2. Chapter 1 showed that systems beat goals and that small improvements compound. "
    "Chapter 2 showed that identity sustains systems. Chapter 3 provides the mechanical blueprint for building the daily behaviors that form those systems.\n\n"
    "The deeper insight is that habits are not a willpower problem. They're a design problem. "
    "When a good habit won't stick, one of the four steps is weak. When a bad habit won't budge, one of the four steps is reinforcing it. "
    "The framework turns abstract frustration into a specific diagnostic question: which step is broken? "
    "That is what conscious habit design looks like in practice."
)

ch3_hard_direct = (
    "Thorndike's puzzle-box experiments in 1898 produced one of the most durable findings in the history of behavioral science, and the core insight has survived over 125 years of research without being overturned. "
    "Cats in boxes didn't reason. They flailed until accidental movements triggered the escape mechanism. "
    "But trial times shortened consistently. Successful behaviors were selected for repetition. Unsuccessful ones were eliminated. "
    "Thorndike called this the Law of Effect: behaviors followed by satisfying consequences recur; behaviors followed by unpleasant consequences don't.\n\n"
    "Clear translates this into a four-step habit loop: cue, craving, response, reward. "
    "The cue triggers attention (phone buzzes, gym bag visible, coffee smell). "
    "The craving assigns motivation (anticipation of connection, exercise high, caffeine energy). "
    "The response is the action (check phone, work out, pour coffee). "
    "The reward closes the loop and encodes the pattern for future repetition. "
    "Remove any step and the habit fails. Every habit you run, good or bad, follows this sequence.\n\n"
    "From the loop, Clear derives the Four Laws of Behavior Change: make it obvious (cue), make it attractive (craving), make it easy (response), make it satisfying (reward). "
    "Build habits by strengthening each step. Break habits by inverting each law. "
    "This framework integrates with the first two chapters. Chapter 1 established compounding: small behaviors, repeated consistently, produce outsized results. "
    "Chapter 2 established identity: when behavior aligns with belief, consistency requires less effort. "
    "Chapter 3 delivers the engineering layer: the four-step loop is the mechanism through which identity expresses itself as behavior and behavior compounds into results.\n\n"
    "The diagnostic value is significant. When a habit fails to form, the framework narrows the problem to one of four steps. "
    "Cue missing? The habit never triggers. Craving weak? No motivation. Response too difficult? Too much friction. Reward absent? No encoding. "
    "When a bad habit persists, one of the four steps is providing reinforcement. Identify which one and invert it. "
    "This turns habit change from a vague willpower contest into a systematic process with specific intervention points. "
    "And that systematic approach is what the rest of the book will help you execute, one law at a time."
)

ch3_hard_competitive = (
    "Thorndike's 1898 puzzle-box experiments are the competitive equivalent of studying foundational game film. "
    "Cats in boxes didn't strategize or plan. They flailed until something worked, then repeated what worked faster each time. "
    "Successful behaviors were selected for repetition. Unsuccessful ones were eliminated. "
    "The Law of Effect: satisfying consequences select behaviors. Unsatisfying consequences extinguish them. "
    "Over 125 years of research has not overturned this finding.\n\n"
    "Clear maps the Law of Effect into a four-step loop: cue, craving, response, reward. "
    "The cue triggers attention. The craving assigns motivation. The response is the action. The reward closes the loop and encodes the pattern. "
    "Every habit you run operates on this loop, and every habit your competitors run operates on it too. "
    "The competitor who understands the loop has four specific intervention points. The competitor who doesn't has only willpower, and willpower is depletable.\n\n"
    "From the loop, Clear derives the Four Laws of Behavior Change: make it obvious, make it attractive, make it easy, make it satisfying. "
    "Build a habit by optimizing each step. Break one by inverting each law. "
    "This integrates directly with the first two chapters. Chapter 1 showed that compounding requires consistent behavior. "
    "Chapter 2 showed that identity sustains consistency. Chapter 3 provides the mechanical framework for building the specific behaviors that identity drives and compounding amplifies. "
    "The three chapters form a complete stack: compounding (why it works), identity (what sustains it), and the habit loop (how to engineer it).\n\n"
    "Most competitors treat behavior change as a discipline problem. The four-step model reframes it as an engineering problem. "
    "When a competitor can't build a habit, they assume they lack discipline. A systems thinker diagnoses which step is broken and fixes it specifically. "
    "When a competitor can't break a bad habit, they try harder. A systems thinker identifies which step provides reinforcement and removes it. "
    "The difference between the two approaches compounds over time. The discipline-based competitor is always fighting friction. "
    "The engineering-based competitor is always reducing it. Over months and years, that gap becomes decisive. "
    "That execution starts now."
)

# ============================================================
# CHAPTER 4: The Man Who Didn't Look Right
# ============================================================

ch4_easy_gentle = (
    "A paramedic walked into his father-in-law's house one evening and immediately felt something was wrong. "
    "The older man's face looked off, though nobody else at the dinner table noticed. "
    "The paramedic insisted they go to the hospital. Doctors discovered the man was having a heart attack. "
    "Years of pattern recognition had trained the paramedic to see what others couldn't. "
    "Clear uses this story to introduce the 1st Law of Behavior Change: Make It Obvious.\n\n"
    "The point is that most of your habits run on autopilot, below conscious awareness. "
    "You don't decide to bite your nails or reach for your phone. The cue triggers the behavior before you even notice. "
    "Clear introduces two tools to bring habits into view: Pointing-and-Calling (saying what you're about to do out loud) and the Habits Scorecard (listing your daily habits and marking each as positive, negative, or neutral). "
    "Both tools work by forcing awareness. You can't change what you can't see. "
    "Without it, you're adjusting behaviors based on a distorted self-image rather than a true one."
)

ch4_easy_direct = (
    "A paramedic saved his father-in-law's life because something about the man's face didn't look right. "
    "No one else at the table noticed. Years of training had wired the paramedic's brain to detect subtle cues automatically. "
    "Clear uses this to introduce the 1st Law: Make It Obvious. "
    "Most habits operate below conscious awareness. You don't deliberate about checking your phone or biting your nails. The cue fires and the behavior follows.\n\n"
    "Two tools make the invisible visible. Pointing-and-Calling is the practice of saying your action out loud before doing it: "
    "\"I'm about to eat this second cookie.\" The act of verbalizing raises the behavior from automatic to conscious. "
    "The Habits Scorecard lists every daily habit and labels each as positive, negative, or neutral. "
    "No judgment, just observation. The goal isn't to change anything yet. It's to see accurately. "
    "Awareness is the first requirement. You can't optimize a process you're running blindly. "
    "That's where all behavior change starts."
)

ch4_easy_competitive = (
    "A paramedic looked at his father-in-law across the dinner table and detected a medical emergency that nobody else in the room could see. "
    "The man was having a heart attack, and only the paramedic's years of pattern recognition made the signs visible. "
    "Clear uses this story to introduce the 1st Law: Make It Obvious. "
    "Most of your habits are invisible to you. They fire automatically, below conscious awareness, driven by cues you never deliberately process.\n\n"
    "This is a problem, because you can't optimize what you can't see. "
    "Clear introduces two tools. Pointing-and-Calling forces you to verbalize an action before doing it, pulling the behavior from automatic to conscious. "
    "The Habits Scorecard lists every daily routine and labels each as positive, negative, or neutral. "
    "Together, these tools create an accurate map of what you actually do each day, not what you think you do. "
    "Most competitors operate from a distorted self-image, overestimating good habits and underestimating bad ones. "
    "This chapter gives you the counter-move: two specific, proven techniques for dragging those invisible, automatic processes into full conscious view "
    "so you can deliberately decide which ones to keep, which ones to optimize, and which ones to dismantle entirely."
)

# ---

ch4_medium_gentle = (
    "One evening, a paramedic walked into his father-in-law's home for a casual family dinner. "
    "Something about the older man's face immediately looked wrong. No one else at the table noticed anything unusual. "
    "The paramedic insisted on a hospital visit. Doctors found the man was having a heart attack. "
    "Years of experience had trained the paramedic's brain to detect patterns invisible to untrained eyes. "
    "Clear uses this story to open the 1st Law of Behavior Change: Make It Obvious.\n\n"
    "The insight connects to the habit loop from Chapter 3. The cue is the first step in any habit. "
    "If you don't notice the cue, the habit never enters consciousness. And most of your habits run without any conscious input at all. "
    "You don't decide to check your phone dozens of times a day. The cue fires and your hand moves before you've formed a thought. "
    "This automatic quality is what makes habits powerful (they conserve mental energy) and dangerous (they operate unchecked).\n\n"
    "Clear offers two tools to bring awareness to your automatic patterns. "
    "Pointing-and-Calling is a technique from the Japanese railway system. Conductors physically point at each signal and call out its status aloud. "
    "The practice reduces errors by up to 85%. Applied to habits, it means verbalizing your action before doing it: "
    "\"I'm about to open social media for the third time this hour.\" The verbal statement pulls the behavior from autopilot into awareness. "
    "The Habits Scorecard is a written list of every routine in your day, each labeled positive, negative, or neutral. "
    "The goal isn't to change anything immediately. It's to build an accurate map of your actual behavior, which almost always differs from the story you tell yourself.\n\n"
    "Building from Chapter 2's identity framework, this chapter shows that awareness is what allows you to choose which identity votes you're casting. "
    "Without awareness, you vote blindly. With it, every habit becomes a conscious decision point. "
    "The Habits Scorecard and Pointing-and-Calling are your first tools for making the invisible visible."
)

ch4_medium_direct = (
    "A paramedic walked into his father-in-law's house for a family visit and immediately sensed something was wrong. "
    "The man's face showed subtle signs of distress that no one else detected. Hospital visit confirmed a heart attack in progress. "
    "Clear uses this to introduce the 1st Law: Make It Obvious. The paramedic's brain was trained to notice cues that others filtered out.\n\n"
    "This connects directly to the habit loop from Chapter 3. The cue is step one. "
    "If you never become aware of the cue, the habit runs automatically, which is efficient for good habits and destructive for bad ones. "
    "Most people dramatically overestimate their awareness of their own behavior. "
    "You don't consciously decide to check your phone 80 times a day or reach for a snack every time you sit on the couch. "
    "The cue triggers the behavior below conscious processing.\n\n"
    "Two techniques address this. Pointing-and-Calling, used in the Japanese railway system, reduces errors by up to 85% by forcing operators to verbalize each signal's status. "
    "Applied to habits: say the action out loud before doing it. \"I'm about to eat this second serving even though I'm not hungry.\" "
    "The verbalization raises the behavior from automatic to deliberate. "
    "The Habits Scorecard lists every routine in your day with a positive, negative, or neutral label. "
    "No changes yet. Just observation. The gap between perceived behavior and actual behavior is usually large, and the scorecard closes it.\n\n"
    "Building from Chapter 2's identity model, awareness is what turns unconscious votes into conscious ones. "
    "Without awareness, your identity is shaped by habits you never chose. With it, every habit becomes a decision point. "
    "Chapter 4 is the transition from understanding why habits matter (Chapters 1-2) and how they work (Chapter 3) to the first practical intervention. "
    "Before you can make a cue obvious, you need to see the cues already running your behavior. "
    "Without that map, you're operating blind. "
    "With it, you're working from satellite imagery."
)

ch4_medium_competitive = (
    "A paramedic walked into his father-in-law's house for a routine family visit and detected a life-threatening condition that nobody else in the room could see. "
    "The man was having a heart attack. Only the paramedic's trained pattern recognition made it visible. "
    "Clear opens with this story to introduce the 1st Law: Make It Obvious. "
    "The competitive principle: you can only optimize what you can perceive.\n\n"
    "Connecting to the habit loop from Chapter 3, the cue is the entry point. "
    "Most people run dozens of habits daily without ever consciously registering the cue. "
    "Phone checking, snacking, posture shifts, procrastination routines: all firing below awareness. "
    "This means most competitors are running behavioral patterns they've never audited, optimizing outcomes while leaving the underlying cue-response chains invisible.\n\n"
    "Clear introduces two tools. Pointing-and-Calling, from the Japanese railway system, reduces operational errors by up to 85%. "
    "Applied to behavior: verbalize the action before performing it. \"I'm about to check email for the fourth time this hour.\" "
    "The verbalization converts autopilot into active choice. "
    "The Habits Scorecard lists every daily routine, labeled positive, negative, or neutral. "
    "No changes, just accurate mapping. The gap between what you think you do and what you actually do is where performance leaks hide.\n\n"
    "Building from Chapter 2, awareness is what converts unconscious identity votes into deliberate ones. "
    "Without it, your competitors shape your identity by default because you're responding to their cues, their environment, their framing. "
    "With it, every habit becomes a strategic decision. "
    "The audit itself is a competitive act: the competitor who knows their own behavioral patterns can redesign them. "
    "The competitor who doesn't is running last year's code and wondering why the output hasn't changed. "
    "That principle holds across every domain where performance matters."
)

# ---

ch4_hard_gentle = (
    "One evening, a paramedic walked into his father-in-law's home for a casual family dinner. "
    "The moment he saw the older man's face, something felt wrong. No one else at the table noticed anything unusual. "
    "The paramedic insisted on a hospital visit. Doctors discovered a heart attack in progress. "
    "Years of pattern recognition had trained his brain to detect cues invisible to others. "
    "Clear uses this story to open the 1st Law of Behavior Change: Make It Obvious.\n\n"
    "The connection to Chapter 3's habit loop is direct. The cue is the first step in every habit. "
    "If you never notice the cue, the behavior runs on autopilot. "
    "This is efficient for good habits but dangerous for bad ones, because you're casting identity votes (Chapter 2) without ever choosing them. "
    "Most people overestimate their self-awareness significantly. You don't decide to check your phone 80 times a day. "
    "The cue fires and the response follows before conscious thought enters the picture.\n\n"
    "Clear introduces two tools for bringing the invisible into view. "
    "Pointing-and-Calling comes from the Japanese railway system, where conductors physically point at signals and call out their status. "
    "The practice reduces errors by up to 85%. Applied to habits, it means saying your action aloud: \"I'm about to eat this second cookie even though I'm full.\" "
    "The verbalization lifts the behavior from automatic to conscious. "
    "The Habits Scorecard lists every routine in your day with a simple label: positive, negative, or neutral. "
    "The point isn't to change anything yet. It's to build an honest map of what you actually do, which almost always differs from what you think you do.\n\n"
    "The deeper significance connects to the full framework from Chapters 1 through 3. "
    "Chapter 1 showed that small behaviors compound. Chapter 2 showed that identity sustains behavior. Chapter 3 mapped the mechanical loop: cue, craving, response, reward. "
    "Chapter 4 says: before you can engineer that loop, you need to see the loops already running. "
    "Awareness is the prerequisite for every intervention that follows. Without it, you optimize blindly, making changes based on an inaccurate self-image. "
    "With it, you gain the ability to choose which cues to amplify, which to remove, and which behaviors to keep or replace.\n\n"
    "The Habits Scorecard isn't just an exercise. It's the foundation of deliberate behavioral design. "
    "Every chapter from this point forward assumes you can see your habits clearly. "
    "Start here."
)

ch4_hard_direct = (
    "A paramedic walked into his father-in-law's home for a family gathering and identified a life-threatening medical condition that no one else in the room detected. "
    "The man's face showed subtle distress signals visible only to someone with years of trained pattern recognition. "
    "Hospital visit confirmed a heart attack. "
    "Clear uses this to introduce the 1st Law: Make It Obvious. Before you can change behavior, you need to see it.\n\n"
    "This connects to Chapter 3's habit loop. The cue is step one, and most cues fire below conscious awareness. "
    "You don't deliberate about checking your phone or reaching for a snack on the couch. The cue triggers the response automatically. "
    "This is the efficiency that makes habits useful: they free mental bandwidth. "
    "But efficiency becomes a liability when bad habits run just as automatically as good ones. "
    "You end up casting identity votes (Chapter 2) and feeding compounding loops (Chapter 1) without ever consciously choosing to.\n\n"
    "Two tools address this. Pointing-and-Calling, from the Japanese railway system, reduces errors by up to 85% "
    "by forcing operators to verbalize each signal. Applied to habits: state the action before performing it. "
    "\"I'm about to eat this second serving even though I'm not hungry.\" The verbalization converts autopilot to active choice. "
    "The Habits Scorecard lists every daily routine with a label: positive, negative, or neutral. "
    "No changes required at this stage. The goal is an accurate behavioral map. "
    "The gap between perceived behavior and actual behavior is typically significant, and the scorecard closes it.\n\n"
    "The diagnostic value integrates with everything from Chapters 1-3. "
    "Compounding (Chapter 1) requires knowing which behaviors you're compounding. "
    "Identity (Chapter 2) requires knowing which votes you're casting. "
    "The habit loop (Chapter 3) requires knowing which cues are active. "
    "Chapter 4 provides the visibility layer. Without it, you're optimizing a system you can't see. "
    "With it, every habit becomes a conscious intervention point.\n\n"
    "The chapter positions awareness as the gateway to all four laws. "
    "Before you can make a cue more obvious, attractive, easy, or satisfying, you need to know which cues are currently active and what behaviors they're driving. "
    "The Habits Scorecard and Pointing-and-Calling are the minimum viable tools for that visibility. "
    "Awareness is not the end of the process, but nothing meaningful begins without it."
)

ch4_hard_competitive = (
    "A paramedic walked into a family gathering and spotted a medical emergency that every other person in the room missed entirely. "
    "The father-in-law's face showed distress signals invisible to untrained eyes. "
    "Heart attack confirmed at the hospital. "
    "Clear uses this story to introduce the 1st Law: Make It Obvious. The principle: you can only optimize what you can perceive.\n\n"
    "Connecting to Chapter 3's habit loop, the cue is the entry point. "
    "Most competitors run dozens of behavioral loops daily without ever consciously registering the cue that triggers them. "
    "Phone checking, procrastination sequences, emotional eating, posture habits: all firing automatically. "
    "This means most competitors are casting identity votes (Chapter 2) and feeding compounding cycles (Chapter 1) with zero awareness of the specific behaviors involved. "
    "They're running code they've never reviewed.\n\n"
    "Clear introduces two tools for behavioral auditing. "
    "Pointing-and-Calling, from the Japanese railway system, reduces errors by up to 85% by forcing verbalization. "
    "Applied to habits: state the behavior aloud before performing it. \"I'm about to check social media for the fifth time this hour.\" "
    "The verbalization converts automatic behavior into a deliberate decision. "
    "The Habits Scorecard maps every daily routine with a label: positive, negative, or neutral. "
    "No changes yet. Just accurate intelligence on your actual behavioral patterns. "
    "The gap between perceived and actual behavior is where performance leaks hide.\n\n"
    "The competitive significance is structural. The competitor who audits their habits can redesign them. "
    "The competitor who doesn't is optimizing blindly, making changes based on a distorted self-image. "
    "In any performance domain, the quality of your behavioral intelligence determines the quality of your interventions. "
    "A competitor who sees their habits clearly can amplify the right cues, remove the wrong ones, and design their environment deliberately. "
    "A competitor operating from assumption wastes interventions on the wrong targets.\n\n"
    "Chapter 4 sits at the transition point from theory (Chapters 1-3) to practice. "
    "Every technique in the remaining chapters assumes you can see your current habits accurately. "
    "The behavioral audit isn't preliminary work. It's the foundation. "
    "The audit is where systematic behavioral improvement begins, and skipping it is where most improvement efforts silently fail."
)

# ============================================================
# CHAPTER 5: The Best Way to Start a New Habit
# ============================================================

ch5_easy_gentle = (
    "In 2001, researchers in Great Britain recruited 248 people and divided them into three groups to study exercise habits. "
    "The first group tracked workouts. The second received a motivational presentation on exercise benefits. "
    "The third wrote one sentence: \"I will exercise at [TIME] in [PLACE] on [DAY].\" "
    "Results: 91% of the third group exercised consistently, compared to roughly 35% of the other groups. "
    "The difference wasn't motivation. It was a plan tied to a specific time and place.\n\n"
    "Clear calls this an implementation intention: pairing a behavior with a when and where. "
    "He extends the principle with habit stacking: linking a new habit to an existing one. "
    "\"After I pour my morning coffee, I will write for ten minutes.\" The existing habit becomes the cue for the new one. "
    "This connects to the Diderot Effect, the tendency for one purchase or change to trigger a chain of related ones. "
    "Habit stacking uses that same chain reaction deliberately, letting each completed habit cue the next. "
    "That's a much more sustainable approach to behavior change than relying on willpower, which fades as the day goes on and life gets complicated."
)

ch5_easy_direct = (
    "A British study gave 248 people the same goal: exercise more. "
    "One group tracked workouts. Another got a motivational presentation. A third wrote a single sentence: "
    "\"I will exercise at [TIME] in [PLACE] on [DAY].\" "
    "91% of the third group followed through. About 35% of the others did. "
    "The variable that mattered wasn't motivation or tracking. It was specificity of time and place.\n\n"
    "Clear calls this an implementation intention. The formula: \"I will [BEHAVIOR] at [TIME] in [LOCATION].\" "
    "It removes the decision point. You don't wait for motivation. The plan fires when the context arrives. "
    "He extends this with habit stacking: \"After [CURRENT HABIT], I will [NEW HABIT].\" "
    "The existing habit becomes the cue. No new trigger needed. "
    "The underlying principle is the Diderot Effect: one change triggers a chain of related changes. "
    "Habit stacking turns that chain reaction into architecture. "
    "It's the scaffolding."
)

ch5_easy_competitive = (
    "Researchers in Britain gave 248 people the same objective and nearly identical resources, then watched one group outperform the others by a factor of nearly three. "
    "The difference: a single written sentence specifying when, where, and what they would do. "
    "91% of the group with that sentence exercised consistently. About 35% of the others managed it. "
    "The winning variable wasn't motivation, accountability, or desire. It was pre-decided context.\n\n"
    "Clear calls this an implementation intention: \"I will [BEHAVIOR] at [TIME] in [LOCATION].\" "
    "It eliminates the decision gap between wanting and doing. "
    "He extends it with habit stacking: \"After [CURRENT HABIT], I will [NEW HABIT].\" "
    "The existing habit becomes the trigger. The Diderot Effect, the tendency for one change to cascade into related changes, is the mechanism. "
    "Habit stacking converts that natural cascade into deliberate architecture. "
    "The competitor who pre-decides when and where doesn't waste energy deliberating. Every decision already made is willpower conserved. "
    "That's architectural power."
)

# ---

ch5_medium_gentle = (
    "In 2001, researchers in Great Britain designed a study that would reveal one of the simplest and most effective strategies for behavior change ever tested. "
    "They recruited 248 people and split them into three groups. "
    "The first tracked their exercise. The second received a motivational presentation. "
    "The third did something deceptively simple: they wrote a sentence filling in the blanks of \"I will exercise at [TIME] in [PLACE] on [DAY].\" "
    "91% of the third group exercised consistently. Only about 35% of the other groups did.\n\n"
    "Clear calls this an implementation intention: specifying the when and where of a behavior in advance. "
    "The insight is that motivation is not usually the bottleneck. Clarity is. "
    "People who say \"I'll exercise more\" leave too many decisions unmade: when, where, how long, which exercises. "
    "Each unmade decision is a moment where the behavior can fail to launch. "
    "The implementation intention fills those gaps in advance so the behavior fires when the context arrives.\n\n"
    "He extends this with habit stacking, which connects to the Diderot Effect. "
    "Diderot, the French philosopher, received a beautiful scarlet robe as a gift. Suddenly his other possessions looked shabby, and he replaced them one by one until his whole study was transformed. "
    "One purchase triggered a chain of related purchases. "
    "Habit stacking uses the same chain reaction deliberately: \"After [CURRENT HABIT], I will [NEW HABIT].\" "
    "Your morning coffee becomes the cue for journaling. Journaling becomes the cue for reviewing your calendar. "
    "Each completed habit triggers the next, building a sequence that runs with minimal willpower.\n\n"
    "Building from Chapter 4's emphasis on awareness and the 1st Law (Make It Obvious), implementation intentions and habit stacking make cues unmistakable. "
    "You don't wait for the right moment to appear. You pre-decide the moment. "
    "The clearer and more specific you make these insertion points, the less willpower and motivation they require, and the more likely they are to actually happen."
)

ch5_medium_direct = (
    "A 2001 British study on exercise habits produced a result that should fundamentally change how you think about behavior change. "
    "248 people, three groups. Group one tracked workouts. Group two got a motivational presentation. "
    "Group three wrote one sentence: \"I will exercise at [TIME] in [PLACE] on [DAY].\" "
    "35% of groups one and two exercised regularly. 91% of group three did. The only difference was a pre-committed plan.\n\n"
    "Clear identifies this as an implementation intention. The formula: \"I will [BEHAVIOR] at [TIME] in [LOCATION].\" "
    "The research finding is that people don't fail to follow through because they lack motivation. They fail because they lack clarity. "
    "\"I'll exercise more\" is a vague intention. \"I'll go to the gym at 6 AM on Monday, Wednesday, and Friday\" is a plan that fires when the context arrives. "
    "The specificity removes the decision point where most people stall.\n\n"
    "He extends this with habit stacking: \"After [CURRENT HABIT], I will [NEW HABIT].\" "
    "The existing habit becomes the cue, which connects directly to Chapter 3's habit loop (cue triggers craving triggers response triggers reward). "
    "The Diderot Effect provides the underlying mechanism. Diderot received a lavish robe, and it triggered a cascade of replacements throughout his home. "
    "One change led to another, then another. Habit stacking uses this chain reaction deliberately, linking new behaviors to established routines. "
    "\"After I pour my coffee, I'll review my goals. After I review my goals, I'll write for ten minutes.\"\n\n"
    "Building from Chapter 4's 1st Law (Make It Obvious), implementation intentions and habit stacking are the first practical applications. "
    "They pre-load the cue into your environment and schedule. The behavior doesn't depend on noticing an opportunity. "
    "The opportunity is engineered in advance. The result is consistency without reliance on daily motivation. "
    "That consistency is the goal."
)

ch5_medium_competitive = (
    "A British study on exercise habits produced one of the cleanest demonstrations of what actually drives behavior change when you strip away assumptions and measure outcomes. "
    "248 participants, three groups, one variable. Group three wrote a single sentence pre-committing to a time, place, and action. "
    "91% of that group followed through. About 35% of the others did. "
    "The variable that produced a nearly 3x performance gap wasn't motivation, desire, or accountability. It was pre-decided context.\n\n"
    "Clear calls this an implementation intention: \"I will [BEHAVIOR] at [TIME] in [LOCATION].\" "
    "The strategic insight: most people fail not from lack of motivation but from lack of specificity. "
    "\"I'll exercise more\" leaves every decision open. \"I'll run at 6 AM at the park on Monday\" closes them. "
    "Each closed decision eliminates a failure point.\n\n"
    "He extends this with habit stacking: \"After [CURRENT HABIT], I will [NEW HABIT].\" "
    "Connecting to Chapter 3's habit loop, the existing habit serves as the cue. "
    "The Diderot Effect is the mechanism: one change triggers a chain of related changes. "
    "Diderot received a robe and replaced everything in his study to match. "
    "Habit stacking converts that natural cascade into deliberate architecture, linking new behaviors to established routines. "
    "\"After my morning coffee, I'll review priorities. After reviewing priorities, I'll start the hardest task.\"\n\n"
    "Building from Chapter 4's awareness tools and the 1st Law (Make It Obvious), implementation intentions and habit stacking are the first offensive moves. "
    "Chapter 4 gave you the map. Chapter 5 gives you the insertion points. "
    "The competitor who pre-decides context doesn't deliberate. Every pre-made decision conserves willpower for actual performance. "
    "Every unmade decision is a leak where competitors lose consistency. "
    "That is the competitive edge."
)

# ---

ch5_hard_gentle = (
    "In 2001, researchers in Great Britain wanted to understand what it actually takes to get people to exercise regularly, not in theory, not in a laboratory, but in real life where competing demands, low energy, and busy schedules constantly get in the way. "
    "They recruited 248 people and split them into three groups. "
    "Group one tracked workouts. Group two received motivational information about exercise benefits. "
    "Group three wrote a single sentence: \"I will exercise at [TIME] in [PLACE] on [DAY].\" "
    "The results were striking. About 35% of groups one and two exercised consistently. 91% of group three did.\n\n"
    "Clear calls this an implementation intention. The formula: specify the when and where of a behavior before the moment arrives. "
    "The finding upends a common assumption. Most people believe they fail because they lack motivation. "
    "The research suggests they fail because they lack clarity. \"I should exercise more\" is a wish. "
    "\"I will go to the gym at 7 AM on Tuesday\" is a plan that fires when the context arrives. "
    "The specificity removes the decision point where behaviors most often fail to launch.\n\n"
    "Clear extends this with habit stacking, which connects to the Diderot Effect. "
    "Denis Diderot received a beautiful scarlet robe and then replaced item after item in his study until the whole room matched. "
    "One change triggered a chain. Habit stacking uses that same chain deliberately: \"After [CURRENT HABIT], I will [NEW HABIT].\" "
    "Your morning coffee becomes the cue for journaling. Journaling becomes the cue for planning. "
    "Each habit in the sequence triggers the next, building a behavioral chain that runs with minimal friction.\n\n"
    "The connection to earlier chapters is clear. Chapter 1 showed that small behaviors compound. "
    "Chapter 2 showed that identity sustains behaviors. Chapter 3 mapped the habit loop: cue, craving, response, reward. "
    "Chapter 4 introduced awareness through Pointing-and-Calling and the Habits Scorecard. "
    "Chapter 5 provides the first construction tool: instead of waiting for cues to appear, you engineer them into your existing routine. "
    "The behavior no longer depends on motivation or memory. It's embedded in context.\n\n"
    "What makes this approach so quietly effective is that it removes the gap between intention and action. "
    "You've already decided what you'll do, when, and where. When the moment arrives, there's nothing to deliberate. "
    "The plan runs because you built it into the architecture of your day. "
    "And you can start using it today."
)

ch5_hard_direct = (
    "In 2001, British researchers ran a study that effectively isolated the single most important variable in behavior change. "
    "248 participants, three groups. Group one tracked workouts. Group two received motivational content. "
    "Group three wrote one sentence: \"I will exercise at [TIME] in [PLACE] on [DAY].\" "
    "35% of the first two groups exercised regularly. 91% of group three did. "
    "The variable wasn't motivation, information, or tracking. It was a pre-committed plan specifying time and place.\n\n"
    "Clear identifies this as an implementation intention. The formula: \"I will [BEHAVIOR] at [TIME] in [LOCATION].\" "
    "The mechanism is specificity. Vague intentions (\"exercise more\") leave every decision open, and each open decision is a failure point. "
    "Specific plans (\"gym at 6 AM Monday, Wednesday, Friday\") close those decisions in advance. "
    "The behavior fires when the context arrives. No deliberation required.\n\n"
    "He extends this with habit stacking: \"After [CURRENT HABIT], I will [NEW HABIT].\" "
    "The existing habit serves as the cue, connecting directly to Chapter 3's habit loop. "
    "The underlying principle is the Diderot Effect: Diderot received a robe and replaced everything in his study to match it. "
    "One change triggered a chain. Habit stacking converts that chain into deliberate behavioral architecture. "
    "\"After I pour coffee, I review goals. After I review goals, I write for ten minutes.\" "
    "Each completed behavior cues the next.\n\n"
    "This integrates with the full framework from Chapters 1-4. Compounding (Chapter 1) requires consistency. "
    "Consistency requires identity alignment (Chapter 2) and a working habit loop (Chapter 3). "
    "The habit loop requires visible cues (Chapter 4). Implementation intentions and habit stacking make cues explicit and context-dependent. "
    "They're the first construction tools: instead of hoping for the right moment, you engineer it.\n\n"
    "The practical implication: stop relying on motivation to initiate behavior. Pre-load the decision. "
    "Specify the time, place, and preceding habit. The behavior becomes a scheduled event rather than a spontaneous one. "
    "Spontaneous behavior depends on mood. Scheduled behavior depends on architecture. "
    "Start there."
)

ch5_hard_competitive = (
    "A British study from 2001 isolated the variable that separates people who follow through on behavioral intentions from people who don't, and the answer wasn't motivation, accountability, desire, or discipline. "
    "248 participants, three groups. Group three wrote one sentence: \"I will exercise at [TIME] in [PLACE] on [DAY].\" "
    "91% followed through. About 35% of the other groups managed it. "
    "The difference was a pre-committed plan. Nothing more.\n\n"
    "Clear calls this an implementation intention. The formula: \"I will [BEHAVIOR] at [TIME] in [LOCATION].\" "
    "The competitive insight: most people lose consistency not because they lack discipline but because they leave too many decisions unmade. "
    "Each unmade decision is a failure point where motivation, fatigue, or distraction can derail the behavior. "
    "Specific plans close those gaps in advance. The behavior fires when the context arrives.\n\n"
    "He extends this with habit stacking: \"After [CURRENT HABIT], I will [NEW HABIT].\" "
    "The existing habit serves as the trigger, connecting directly to Chapter 3's habit loop. "
    "The Diderot Effect provides the mechanism: Diderot received a robe and replaced everything around it to match. "
    "One change cascaded into a full transformation. Habit stacking converts that natural cascade into architecture. "
    "\"After my morning coffee, I review priorities. After reviewing priorities, I start the hardest task.\" "
    "Each link in the chain cues the next.\n\n"
    "This integrates with the full competitive framework from Chapters 1-4. "
    "Compounding (Chapter 1) requires consistency. Identity (Chapter 2) sustains it. "
    "The habit loop (Chapter 3) provides mechanics. Awareness (Chapter 4) reveals existing patterns. "
    "Implementation intentions and habit stacking are the first tools for building new patterns into your existing architecture. "
    "They pre-load decisions so the behavior doesn't depend on daily motivation.\n\n"
    "The competitor who pre-decides context eliminates the decision gap where others lose consistency. "
    "Every decision pre-made is willpower conserved for actual performance. "
    "Every decision left open is a point of vulnerability. "
    "Stack enough pre-committed behaviors into a tight sequence, and your daily system runs on architecture rather than ambition. "
    "And the compounding never stops once the architecture is in place."
)

# ============================================================
# APPLY ALL REPLACEMENTS
# ============================================================

replacements = {
    1: {
        "easy": {"gentle": ch1_easy_gentle, "direct": ch1_easy_direct, "competitive": ch1_easy_competitive},
        "medium": {"gentle": ch1_medium_gentle, "direct": ch1_medium_direct, "competitive": ch1_medium_competitive},
        "hard": {"gentle": ch1_hard_gentle, "direct": ch1_hard_direct, "competitive": ch1_hard_competitive},
    },
    2: {
        "easy": {"gentle": ch2_easy_gentle, "direct": ch2_easy_direct, "competitive": ch2_easy_competitive},
        "medium": {"gentle": ch2_medium_gentle, "direct": ch2_medium_direct, "competitive": ch2_medium_competitive},
        "hard": {"gentle": ch2_hard_gentle, "direct": ch2_hard_direct, "competitive": ch2_hard_competitive},
    },
    3: {
        "easy": {"gentle": ch3_easy_gentle, "direct": ch3_easy_direct, "competitive": ch3_easy_competitive},
        "medium": {"gentle": ch3_medium_gentle, "direct": ch3_medium_direct, "competitive": ch3_medium_competitive},
        "hard": {"gentle": ch3_hard_gentle, "direct": ch3_hard_direct, "competitive": ch3_hard_competitive},
    },
    4: {
        "easy": {"gentle": ch4_easy_gentle, "direct": ch4_easy_direct, "competitive": ch4_easy_competitive},
        "medium": {"gentle": ch4_medium_gentle, "direct": ch4_medium_direct, "competitive": ch4_medium_competitive},
        "hard": {"gentle": ch4_hard_gentle, "direct": ch4_hard_direct, "competitive": ch4_hard_competitive},
    },
    5: {
        "easy": {"gentle": ch5_easy_gentle, "direct": ch5_easy_direct, "competitive": ch5_easy_competitive},
        "medium": {"gentle": ch5_medium_gentle, "direct": ch5_medium_direct, "competitive": ch5_medium_competitive},
        "hard": {"gentle": ch5_hard_gentle, "direct": ch5_hard_direct, "competitive": ch5_hard_competitive},
    },
}

def main():
    with open(JSON_PATH, "r") as f:
        data = json.load(f)

    for chapter in data:
        ch_num = chapter["number"]
        if ch_num not in replacements:
            continue
        for difficulty in ["easy", "medium", "hard"]:
            for tone in ["gentle", "direct", "competitive"]:
                chapter["contentVariants"][difficulty]["chapterBreakdown"][tone] = replacements[ch_num][difficulty][tone]

    with open(JSON_PATH, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    # Verify word counts
    print("=== VERIFICATION ===")
    targets = {
        "easy": (140, 175),
        "medium": (330, 420),
        "hard": (490, 600),
    }
    all_pass = True
    for chapter in data:
        ch_num = chapter["number"]
        if ch_num not in replacements:
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
