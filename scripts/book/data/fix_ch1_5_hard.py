#!/usr/bin/env python3
"""Fix remaining hard variants that are still under 490 words."""
import json
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_PATH = os.path.join(SCRIPT_DIR, "chapters-1-5.json")

fixes = {}

# ch2 hard/direct: 433 -> need 490+
fixes[(2, "hard", "direct")] = (
    "Chapter 1 established that systems outperform goals and that compounding drives long-term results. "
    "Chapter 2 answers the structural follow-up: what determines whether a system sustains itself or collapses under friction?\n\n"
    "Clear introduces three layers of behavior change. Outcomes (what you get) on the outside. Processes (what you do) in the middle. "
    "Identity (what you believe about yourself) at the core. Most people start with outcomes and search for processes to reach them. "
    "Clear argues the effective direction is reversed: identity first, then process, then outcomes. "
    "The reason is structural and mechanical. An identity-aligned system runs with minimal friction because the behavior feels like a natural expression of who you are. "
    "An identity-misaligned system requires willpower at every step, and willpower depletes under stress, fatigue, and the accumulated demands of a full day.\n\n"
    "The voting mechanism explains how identity forms and shifts over time. Every action is a vote for a type of person. "
    "Write a page: one vote for \"writer.\" Hit the gym: one vote for \"athlete.\" Sleep in instead of running: one vote for \"person who makes exceptions when it's inconvenient.\" "
    "No single vote determines identity, but a majority forms a belief. Once the belief locks in, behavior follows automatically without requiring conscious effort or daily motivation. "
    "\"I'm not a smoker\" versus \"I'm trying to quit\" captures the entire structural distinction. "
    "The first operates from a settled identity, and the behavior is self-consistent with that identity. The second fights against a still-active identity and requires ongoing willpower to maintain. "
    "Same external behavior on any given day, but a different internal cost that compounds over weeks and months.\n\n"
    "This connects directly to Chapter 1's compounding framework with specific mechanical implications. Compounding requires consistency over long periods. "
    "Consistency requires low friction at each individual decision point. Low friction requires identity alignment so the behavior doesn't feel like a fight. "
    "Without alignment, every repetition costs willpower. Over time, that cost accumulates and the system breaks down, usually right before the compounding curve from Chapter 1 bends upward. "
    "With alignment, every repetition reinforces the identity, which reinforces the behavior, which reinforces the identity further in a self-sustaining loop. "
    "The loop becomes self-sustaining and gains momentum with each cycle. This is the structural difference between habits that last a few months and habits that last years or a lifetime.\n\n"
    "The practical protocol has two steps. First, define the identity you want. Not an outcome (\"lose 20 pounds\") but a type of person (\"someone who doesn't miss workouts\"). "
    "Second, accumulate evidence through small wins, each of which casts a vote for the new identity. Each win shifts the belief slightly. Enough votes shift it permanently. "
    "The shifted belief reduces the cost of the behavior because it now feels natural. The reduced cost increases consistency because there's less resistance. "
    "The increased consistency accelerates the compounding from Chapter 1 because the behavior runs longer without interruption. "
    "The chain is clear: identity to consistency to compounding to results. "
    "Without the identity foundation, systems require constant external motivation, which is unreliable and finite. "
    "With the foundation, the vehicle runs smoothly and the compounding produces results on its own schedule."
)

# ch2 hard/competitive: 419 -> need 490+
fixes[(2, "hard", "competitive")] = (
    "Chapter 1 proved that systems determine results and that compounding is the mathematical engine behind long-term performance gains. "
    "Chapter 2 addresses the variable that determines whether a system holds up under competitive pressure or fractures when conditions get difficult: identity.\n\n"
    "Clear maps three layers of behavior change. Outcomes sit on the outside. Processes in the middle. Identity at the core. "
    "Most competitors start with outcomes: win the championship, lead the market, top the ranking. Then they search for processes to deliver those outcomes. "
    "Clear argues the winning direction is reversed. Start at the core. "
    "Identity-first competitors build systems that run on alignment rather than willpower, which gives them a structural advantage that increases over time. "
    "The distinction between \"I'm trying to quit\" and \"I'm not a smoker\" is the entire difference between fighting your identity and acting from it. "
    "One requires energy at every decision point. The other is free because it's self-consistent.\n\n"
    "The mechanism is a voting system. Every action casts a vote for a type of person. "
    "Train when it's inconvenient and conditions are bad: vote for \"elite competitor.\" Cut a corner when no one is watching: vote for \"someone who compromises under pressure.\" "
    "No single vote is decisive on its own, but patterns become beliefs, and beliefs drive automatic behavior without requiring conscious effort or daily motivation. "
    "Two competitors with identical systems produce different results because one has alignment and the other doesn't. "
    "The aligned competitor doesn't spend willpower on basic compliance. Every bit of mental energy goes toward actual performance improvement. "
    "The misaligned competitor leaks energy at every decision point throughout the day, and that leak accelerates under competitive stress when the stakes are highest.\n\n"
    "This connects to Chapter 1's compounding framework with direct and significant competitive implications. Compounding requires consistency. Consistency requires low friction. "
    "Low friction requires identity alignment. Without it, every repetition carries a willpower tax that accumulates invisibly over days and weeks. "
    "That tax compounds in the wrong direction: the system gets harder to maintain over time instead of easier, and the competitor burns out right before the exponential curve bends upward and the returns arrive. "
    "With alignment, every repetition reinforces the identity, which lowers friction, which increases consistency, which accelerates compounding in a self-reinforcing cycle. "
    "The self-reinforcing loop is the structural advantage that separates competitors who sustain high performance from those who spike and fade.\n\n"
    "Clear's protocol is straightforward: decide who you want to be, then prove it with small wins repeated consistently. Each win casts a vote. Enough votes lock in the belief permanently. "
    "The locked-in belief sustains the system automatically, freeing mental bandwidth for actual performance improvement rather than daily compliance and self-negotiation. "
    "The competitive implication is significant and measurable over time. While others burn willpower just to show up and go through the motions, identity-aligned competitors invest that same energy in getting better. "
    "You don't start with intensity and hope identity follows eventually. "
    "You start with consistency, and intensity follows the identity shift."
)

# ch3 hard/gentle: 486 -> need 490+
fixes[(3, "hard", "gentle")] = (
    "In 1898, in a small laboratory space at Columbia University, a young psychologist named Edward Thorndike began running an experiment that would quietly reshape how we think about learning, behavior, and habits for the next century and beyond. "
    "He placed cats in wooden puzzle boxes with a lever that opened the door to freedom and food. The cats scratched, pawed, and stumbled until they accidentally pressed the lever. "
    "Returned to the box, they found the lever faster each time. The fumbling became more focused, the random movements more targeted with each trial. "
    "Thorndike's conclusion was elegant: behaviors producing satisfying results get repeated; behaviors producing nothing fade away over time. "
    "The Law of Effect. Simple, durable, and still foundational to every modern study of habit formation.\n\n"
    "Clear builds on this to present the four-step habit loop: cue, craving, response, reward. "
    "A cue is a signal that something is available: your phone buzzes, you smell coffee from the kitchen, you see running shoes placed by the front door. "
    "A craving is the motivational interpretation: the anticipation of social connection, the promise of caffeine energy, the pull of a runner's high. "
    "A response is the action: check the phone, pour the cup, lace up the shoes and head outside. "
    "A reward is the satisfaction that closes the loop and teaches the brain to repeat the pattern next time the cue appears. "
    "Remove any step and the chain breaks entirely. No cue means no trigger. No craving means no motivation to act. No response means no action taken. No reward means no encoding into memory. "
    "This loop runs thousands of times daily, mostly below conscious awareness, shaping your behavior without your conscious permission or participation.\n\n"
    "From this loop, Clear derives the Four Laws of Behavior Change. The 1st Law (Make It Obvious) targets the cue. "
    "The 2nd Law (Make It Attractive) targets the craving. The 3rd Law (Make It Easy) targets the response. "
    "The 4th Law (Make It Satisfying) targets the reward. To break a bad habit, invert each law: make it invisible, unattractive, difficult, unsatisfying. "
    "This framework connects directly to Chapters 1 and 2 and completes the foundational trilogy. "
    "Chapter 1 showed that systems beat goals and that small improvements compound into significant results over time. "
    "Chapter 2 showed that identity sustains systems by making consistent behavior feel natural rather than forced. "
    "Chapter 3 provides the mechanical blueprint for building the daily behaviors that form those systems and express that identity in action.\n\n"
    "The deeper insight is that habits are not a willpower problem. They're a design problem with specific, diagnosable failure points. "
    "When a good habit won't stick, one of the four steps is weak or missing entirely. When a bad habit won't budge despite your best intentions, one of the four steps is actively reinforcing it. "
    "The framework turns abstract frustration (\"why can't I change?\") into a specific diagnostic question: which step is broken, and what would fix it? "
    "That shift from vague self-blame to precise, targeted diagnosis is what separates people who drift from people who design their behavior deliberately. "
    "That is what conscious habit design looks like in practice."
)

# ch3 hard/direct: 429 -> need 490+
fixes[(3, "hard", "direct")] = (
    "Thorndike's puzzle-box experiments in 1898 produced one of the most durable findings in the history of behavioral science, and the core insight has survived over 125 years of research without being overturned. "
    "Cats in boxes didn't reason their way to freedom or plan an escape strategy. They flailed until accidental movements triggered the escape mechanism. "
    "But trial times shortened consistently with each attempt. Successful behaviors were selected for repetition. Unsuccessful ones were gradually eliminated from the repertoire. "
    "Thorndike called this the Law of Effect: behaviors followed by satisfying consequences recur; behaviors followed by unpleasant or neutral consequences don't. It is the bedrock of behavioral science.\n\n"
    "Clear translates this into a four-step habit loop: cue, craving, response, reward. "
    "The cue triggers attention (phone buzzes, gym bag is visible by the door, coffee smell drifts from the kitchen). "
    "The craving assigns motivation (anticipation of social connection from the phone, the exercise high from the gym, caffeine energy from the coffee). "
    "The response is the action (check the phone, work out, pour the coffee). "
    "The reward closes the loop and encodes the pattern for future repetition when the same cue appears again. "
    "Remove any step and the habit fails to form or sustain itself. Every habit you currently run, whether positive or destructive, follows this exact four-step sequence without exception.\n\n"
    "From the loop, Clear derives the Four Laws of Behavior Change: make it obvious (cue), make it attractive (craving), make it easy (response), make it satisfying (reward). "
    "Build habits by strengthening the relevant step. Break habits by inverting the corresponding law: invisible, unattractive, difficult, unsatisfying. "
    "This framework integrates with the first two chapters to form a complete system for behavior change. "
    "Chapter 1 established compounding: small behaviors, repeated consistently over time, produce outsized results that arrive on a delayed schedule. "
    "Chapter 2 established identity: when behavior aligns with your belief about who you are, consistency requires less effort because the behavior feels natural rather than forced. "
    "Chapter 3 delivers the engineering layer: the four-step loop is the mechanism through which identity expresses itself as daily behavior and daily behavior compounds into measurable results.\n\n"
    "The diagnostic value is significant and immediately practical. When a habit fails to form, the framework narrows the problem to one of four specific steps. "
    "Cue missing or hidden? The habit never triggers in the first place. Craving weak or absent? No motivation to act when the cue appears. Response too difficult or friction-heavy? Too much effort to complete the behavior. Reward absent or too delayed? No encoding in memory, so the pattern doesn't strengthen. "
    "When a bad habit persists despite your best efforts to stop it, one of the four steps is providing reinforcement you haven't yet identified. Find which one is active and invert it. "
    "This turns habit change from a vague willpower contest into a systematic process with specific intervention points and predictable, repeatable outcomes. "
    "And that systematic approach is what the rest of the book will help you execute, one law at a time."
)

# ch3 hard/competitive: 420 -> need 490+
fixes[(3, "hard", "competitive")] = (
    "Thorndike's 1898 puzzle-box experiments are the competitive equivalent of studying foundational game film that reveals how the game actually works. "
    "Cats in boxes didn't strategize or plan their escape. They flailed until something worked, then repeated what worked faster each time they were placed back in the box. "
    "Successful behaviors were selected for repetition. Unsuccessful ones were eliminated from the repertoire entirely. "
    "The Law of Effect: satisfying consequences select behaviors for repetition. Unsatisfying consequences extinguish them from the behavioral pattern. "
    "Over 125 years of behavioral research has not overturned this core finding. It remains the foundation.\n\n"
    "Clear maps the Law of Effect into a four-step loop: cue, craving, response, reward. "
    "The cue triggers attention and signals that something is available. The craving assigns motivation and meaning to that trigger. The response is the action taken. The reward closes the loop and encodes the pattern for future repetition. "
    "Every habit you run operates on this loop, and every habit your competitors run operates on it too. "
    "The competitor who understands the loop has four specific intervention points to diagnose and optimize. The competitor who doesn't has only willpower, and willpower is a depletable resource that fails first under pressure.\n\n"
    "From the loop, Clear derives the Four Laws of Behavior Change: make it obvious, make it attractive, make it easy, make it satisfying. "
    "Build a habit by optimizing each step systematically. Break one by inverting each law: invisible, unattractive, difficult, unsatisfying. "
    "This integrates directly with the first two chapters to form a complete competitive framework for behavior change. "
    "Chapter 1 showed that compounding requires consistent behavior sustained over long periods to produce the exponential returns that arrive late on the curve. "
    "Chapter 2 showed that identity sustains that consistency by reducing the willpower cost of each repetition. "
    "Chapter 3 provides the mechanical framework for building the specific behaviors that identity drives and compounding amplifies into measurable results. "
    "The three chapters form a complete stack: compounding (why it works), identity (what sustains it), and the habit loop (how to engineer it precisely).\n\n"
    "Most competitors treat behavior change as a discipline problem. They believe success requires trying harder, pushing through resistance, and grinding out repetitions through sheer force of will. "
    "The four-step model reframes it as an engineering problem with specific, diagnosable failure points that can be fixed with precision. "
    "When a competitor can't build a habit, they assume they lack discipline and blame themselves. A systems thinker diagnoses which step is broken and fixes it directly. "
    "When a competitor can't break a bad habit, they try harder to resist with raw willpower. A systems thinker identifies which step provides the reinforcement and removes that specific reinforcement. "
    "The difference between the two approaches compounds over time, just like everything else in this framework. "
    "The discipline-based competitor is always fighting friction and depleting their willpower reserves. The engineering-based competitor is always reducing friction and conserving energy for performance. "
    "Over months and years, that gap becomes decisive and insurmountable. "
    "That execution starts now."
)

# ch4 hard/gentle: 462 -> need 490+
fixes[(4, "hard", "gentle")] = (
    "One evening, a paramedic walked into his father-in-law's home for a casual family dinner. "
    "The moment he saw the older man's face, something felt wrong. No one else at the table noticed anything unusual about the man's appearance. "
    "The paramedic insisted on an immediate hospital visit. Doctors discovered a heart attack in progress. "
    "Years of pattern recognition on the job had trained his brain to detect subtle cues invisible to everyone around him. "
    "Clear uses this story to open the 1st Law of Behavior Change: Make It Obvious.\n\n"
    "The connection to Chapter 3's habit loop is direct and important for understanding why awareness matters so much. The cue is the first step in every habit. "
    "If you never notice the cue, the behavior runs on complete autopilot without your conscious participation or permission. "
    "This is efficient for good habits, since they run without draining your attention, but dangerous for bad ones, because you're casting identity votes (Chapter 2) without ever choosing them. "
    "Most people overestimate their self-awareness significantly. You don't consciously decide to check your phone 80 times a day or bite your nails during meetings. "
    "The cue fires and the response follows before conscious thought enters the picture. The entire behavioral sequence completes before you realize it started.\n\n"
    "Clear introduces two tools for bringing the invisible into view and creating conscious choice points. "
    "Pointing-and-Calling comes from the Japanese railway system, where conductors physically point at each signal and call out its status aloud before proceeding. "
    "The practice reduces operational errors by up to 85%. Applied to personal habits, it means saying your action aloud before doing it: \"I'm about to eat this second cookie even though I'm already full.\" "
    "The verbalization lifts the behavior from automatic to conscious, inserting a moment of deliberate choice into what was previously a reflexive sequence. "
    "The Habits Scorecard is the second tool. It's a written list of every routine in your day, each marked with a simple label: positive, negative, or neutral. "
    "The point isn't to change anything yet. It's to build an honest, accurate map of what you actually do each day, which almost always differs from the story you tell yourself about your behavior.\n\n"
    "The deeper significance connects to the full framework from Chapters 1 through 3 and explains why awareness comes before action. "
    "Chapter 1 showed that small behaviors compound into significant outcomes over time. Chapter 2 showed that identity sustains those behaviors by making them feel natural. "
    "Chapter 3 mapped the mechanical loop: cue, craving, response, reward. "
    "Chapter 4 says: before you can engineer that loop deliberately, you need to see the loops already running in your daily life. "
    "Awareness is the prerequisite for every intervention that follows in the remaining chapters. Without it, you optimize blindly, making changes based on an inaccurate self-image. "
    "With it, you gain the ability to choose which cues to amplify, which to remove, and which behaviors to keep, modify, or replace entirely.\n\n"
    "The Habits Scorecard isn't just a one-time exercise or a box to check. It's the foundation of deliberate behavioral design that everything else rests on. "
    "Every chapter from this point forward assumes you can see your habits clearly and honestly. "
    "Start here."
)

# ch4 hard/direct: 488 -> need 490+, just 2 words short
fixes[(4, "hard", "direct")] = (
    "A paramedic walked into his father-in-law's home for a family gathering and identified a life-threatening medical condition that no one else in the room detected. "
    "The man's face showed subtle distress signals visible only to someone with years of trained pattern recognition on the job. "
    "Hospital visit confirmed a heart attack in progress. "
    "Clear uses this to introduce the 1st Law: Make It Obvious. Before you can change a behavior, you need to see it clearly.\n\n"
    "This connects to Chapter 3's habit loop. The cue is step one of every habit, and most cues fire below conscious awareness. "
    "You don't deliberate about checking your phone or reaching for a snack every time you sit on the couch. The cue triggers the response automatically, and the behavior completes before you register what happened. "
    "This is the efficiency that makes habits useful: they free mental bandwidth for other tasks that need conscious attention. "
    "But that efficiency becomes a liability when bad habits run just as automatically as good ones. "
    "You end up casting identity votes (Chapter 2) and feeding compounding loops (Chapter 1) without ever consciously choosing to do so.\n\n"
    "Two tools address this visibility problem directly. Pointing-and-Calling, from the Japanese railway system, reduces operational errors by up to 85% "
    "by forcing operators to verbalize each signal before proceeding. Applied to personal habits: state the action before performing it. "
    "\"I'm about to eat this second serving even though I'm not hungry.\" The verbalization converts autopilot to active choice, inserting a decision point into what was previously an automatic sequence. "
    "The Habits Scorecard lists every daily routine with a label: positive, negative, or neutral. "
    "No changes required at this stage. The sole goal is an accurate behavioral map of your actual daily patterns. "
    "The gap between perceived behavior and actual behavior is typically significant, and most people don't realize how large that gap is until they complete the scorecard.\n\n"
    "The diagnostic value integrates with everything from Chapters 1 through 3. "
    "Compounding (Chapter 1) requires knowing which specific behaviors you're compounding. If you don't see a daily habit, you can't assess whether it's compounding for you or against you. "
    "Identity (Chapter 2) requires knowing which votes you're casting with each repeated action throughout the day. "
    "The habit loop (Chapter 3) requires knowing which cues are currently active in your environment and what behavioral chains they trigger. "
    "Chapter 4 provides the visibility layer that makes all three prior chapters actionable rather than theoretical. Without it, you're optimizing a system you can't see. "
    "With it, every habit becomes a conscious intervention point where you can decide to keep, modify, or eliminate the behavior.\n\n"
    "The chapter positions awareness as the gateway to all four laws of behavior change. "
    "Before you can make a cue more obvious, attractive, easy, or satisfying, you need to know which cues are currently active and what specific behaviors they're driving in your daily life. "
    "The Habits Scorecard and Pointing-and-Calling are the minimum viable tools for that visibility. "
    "Awareness is not the end of the process, but nothing meaningful begins without it."
)

# ch4 hard/competitive: 448 -> need 490+
fixes[(4, "hard", "competitive")] = (
    "A paramedic walked into a family gathering and spotted a medical emergency that every other person in the room missed entirely. "
    "The father-in-law's face showed distress signals invisible to untrained eyes, signals that only years of professional pattern recognition could detect. "
    "Heart attack confirmed at the hospital. "
    "Clear uses this story to introduce the 1st Law: Make It Obvious. The principle: you can only optimize what you can perceive. Everything else is a blind spot your competitors might already see and act on.\n\n"
    "Connecting to Chapter 3's habit loop, the cue is the entry point of every behavioral sequence. "
    "Most competitors run dozens of behavioral loops daily without ever consciously registering the cue that triggers them. "
    "Phone checking, procrastination sequences, emotional eating, posture habits, attention drift during focused work: all firing automatically below awareness. "
    "This means most competitors are casting identity votes (Chapter 2) and feeding compounding cycles (Chapter 1) with zero awareness of the specific behaviors involved. "
    "They're running code they've never reviewed, and that unreviewed code is producing their current results whether those results are good or bad.\n\n"
    "Clear introduces two tools for behavioral auditing that bring invisible patterns into conscious view. "
    "Pointing-and-Calling, from the Japanese railway system, reduces operational errors by up to 85% by forcing verbalization of each signal before proceeding. "
    "Applied to personal habits: state the behavior aloud before performing it. \"I'm about to check social media for the fifth time this hour even though I checked two minutes ago.\" "
    "The verbalization converts automatic behavior into a deliberate decision, inserting a choice point into what was previously an unconscious reflex. "
    "The Habits Scorecard maps every daily routine with a label: positive, negative, or neutral. "
    "No changes at this stage. Just accurate intelligence on your actual behavioral patterns rather than the idealized version you carry in your head. "
    "The gap between perceived and actual behavior is exactly where performance leaks hide, and that gap is usually larger than people expect.\n\n"
    "The competitive significance is structural and far-reaching. The competitor who audits their habits can redesign them with precision and specificity. "
    "The competitor who doesn't is optimizing blindly, making changes based on a distorted self-image and wondering why the results don't match the effort invested. "
    "In any performance domain, the quality of your behavioral intelligence determines the quality of your interventions. "
    "A competitor who sees their habits clearly can amplify the right cues, remove the wrong ones, and design their environment deliberately for maximum performance output. "
    "A competitor operating from assumption and self-delusion wastes interventions on the wrong targets and never understands why the improvement doesn't stick.\n\n"
    "Chapter 4 sits at the transition point from theory (Chapters 1-3) to practice and direct application. "
    "Every technique in the remaining chapters assumes you can see your current habits accurately and honestly. "
    "The behavioral audit isn't preliminary work you can skip or rush through. It's the foundation everything else is built on. "
    "The audit is where systematic behavioral improvement begins, and skipping it is where most improvement efforts silently fail."
)

# ch5 hard/direct: 463 -> need 490+
fixes[(5, "hard", "direct")] = (
    "In 2001, British researchers ran a study that effectively isolated the single most important variable in behavior change. "
    "248 participants, three groups. Group one tracked their workouts in a log. Group two received motivational content about the health benefits of regular exercise. "
    "Group three wrote one sentence: \"I will exercise at [TIME] in [PLACE] on [DAY].\" "
    "About 35% of the first two groups exercised regularly. 91% of group three did. "
    "The variable wasn't motivation, information, or tracking. It was a pre-committed plan specifying exactly when and where the behavior would happen.\n\n"
    "Clear identifies this as an implementation intention. The formula: \"I will [BEHAVIOR] at [TIME] in [LOCATION].\" "
    "The mechanism is specificity. Vague intentions (\"exercise more this week\") leave every decision open, and each open decision is a failure point where the behavior can die before it starts. "
    "Specific plans (\"gym at 6 AM on Monday, Wednesday, and Friday\") close those decisions in advance so the behavior fires when the context arrives. "
    "No deliberation required in the moment. No willpower needed to start. The plan does the work that motivation usually fails to do consistently over time.\n\n"
    "He extends this with habit stacking: \"After [CURRENT HABIT], I will [NEW HABIT].\" "
    "The existing habit serves as the cue, connecting directly to Chapter 3's habit loop where cue triggers craving triggers response triggers reward in sequence. "
    "The underlying principle is the Diderot Effect: the French philosopher Diderot received a lavish robe as a gift and then replaced everything in his study to match it, one item at a time, each replacement triggering the next. "
    "One change triggered a chain of related changes. Habit stacking converts that natural chain reaction into deliberate behavioral architecture. "
    "\"After I pour coffee, I review my goals for the day. After I review goals, I write for ten minutes before checking messages.\" "
    "Each completed behavior cues the next in the sequence, building a chain that runs on structure rather than moment-to-moment motivation.\n\n"
    "This integrates with the full framework from Chapters 1 through 4. Compounding (Chapter 1) requires consistency sustained over long periods to deliver the exponential returns. "
    "Consistency requires identity alignment (Chapter 2) so the behavior feels natural rather than forced each time you perform it. "
    "Identity expresses itself through the habit loop (Chapter 3), which needs clear cues to trigger each behavioral sequence reliably. "
    "Visible cues (Chapter 4) are the prerequisite, and implementation intentions and habit stacking make those cues explicit, context-dependent, and impossible to miss. "
    "They're the first construction tools in the practical toolkit: instead of hoping for the right moment to act, you engineer the moment in advance and remove the guesswork.\n\n"
    "The practical implication is direct: stop relying on motivation to initiate behavior. Pre-load the decision completely before the moment arrives. "
    "Specify the time, the place, and the preceding habit that will serve as the trigger. "
    "The behavior becomes a scheduled event embedded in your existing routine rather than a spontaneous act dependent on your mood and energy level. "
    "Spontaneous behavior depends on mood and energy, both of which fluctuate unpredictably throughout the day. Scheduled behavior depends on architecture, which is stable and reliable. "
    "Start there."
)

# ch5 hard/competitive: 463 -> need 490+
fixes[(5, "hard", "competitive")] = (
    "A British study from 2001 isolated the variable that separates people who follow through on behavioral intentions from people who don't, and the answer wasn't motivation, accountability, desire, or discipline. "
    "248 participants, three groups. Group three wrote one sentence: \"I will exercise at [TIME] in [PLACE] on [DAY].\" "
    "91% followed through on their exercise intention. About 35% of the other groups managed it. "
    "The difference was a pre-committed plan specifying exactly when, where, and what. Nothing more.\n\n"
    "Clear calls this an implementation intention. The formula: \"I will [BEHAVIOR] at [TIME] in [LOCATION].\" "
    "The competitive insight: most people lose consistency not because they lack discipline but because they leave too many decisions unmade each day. "
    "Each unmade decision is a failure point where motivation, fatigue, or distraction can derail the behavior before it starts. "
    "Specific plans close those gaps in advance so the behavior fires when the context arrives, not when you manage to summon enough willpower to begin.\n\n"
    "He extends this with habit stacking: \"After [CURRENT HABIT], I will [NEW HABIT].\" "
    "The existing habit serves as the trigger, connecting directly to Chapter 3's four-step habit loop where the cue initiates the entire behavioral chain automatically. "
    "The Diderot Effect provides the underlying mechanism: the French philosopher Diderot received a beautiful robe and replaced everything around it to match, one item triggering the next replacement in sequence. "
    "One change cascaded into a full transformation of his environment. Habit stacking converts that natural cascade into deliberate architecture for your daily routine and performance system. "
    "\"After my morning coffee, I review priorities for the day. After reviewing priorities, I start the hardest task first before checking messages.\" "
    "Each link in the chain cues the next, building a sequence that runs on structure rather than daily motivation or inspiration.\n\n"
    "This integrates with the full competitive framework built across Chapters 1 through 4. "
    "Compounding (Chapter 1) requires consistency sustained over long periods to produce the exponential returns that arrive late on the curve when most competitors have already quit. "
    "Identity (Chapter 2) sustains that consistency by reducing the willpower cost of each daily repetition so the behavior feels natural. "
    "The habit loop (Chapter 3) provides the mechanical framework for engineering each specific behavior in the chain. "
    "Awareness (Chapter 4) reveals the existing patterns already running in your daily routine so you know where to insert new ones. "
    "Implementation intentions and habit stacking are the first tools for building new behavioral patterns into your existing architecture with precision and reliability. "
    "They pre-load every decision so the behavior doesn't depend on daily motivation, which fluctuates unpredictably under competitive pressure.\n\n"
    "The competitor who pre-decides context eliminates the decision gap where others lose consistency without even realizing the loss is happening. "
    "Every decision pre-made is willpower conserved for actual performance rather than wasted on deliberation and self-negotiation. "
    "Every decision left open is a point of vulnerability where the behavior can fail to launch. "
    "Stack enough pre-committed behaviors into a tight daily sequence, and your system runs on architecture rather than ambition or hope. "
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
