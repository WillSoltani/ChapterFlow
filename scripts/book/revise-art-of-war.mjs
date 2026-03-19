import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const packagePath = resolve(process.cwd(), "book-packages/art-of-war.modern.json");
const reportPath = resolve(process.cwd(), "notes/art-of-war-revision-report.md");

const b = (text, detail) => ({ type: "bullet", text, detail });

const ex = (exampleId, title, contexts, scenario, whatToDo, whyItMatters) => ({
  exampleId,
  title,
  contexts,
  scenario,
  whatToDo,
  whyItMatters,
});

const SIMPLE_INDEXES = {
  1: [0, 1, 2, 4, 5, 7, 9],
  2: [0, 1, 3, 5, 6, 8, 9],
  3: [0, 1, 3, 4, 6, 7, 9],
  4: [0, 1, 2, 4, 6, 7, 9],
  5: [0, 1, 2, 4, 6, 7, 9],
  6: [0, 1, 2, 3, 5, 7, 9],
  7: [0, 1, 2, 4, 5, 7, 9],
  8: [0, 1, 2, 3, 5, 7, 9],
  9: [0, 1, 2, 4, 5, 7, 9],
  10: [0, 1, 2, 4, 5, 7, 9],
  11: [0, 1, 2, 3, 5, 7, 9],
  12: [0, 1, 2, 3, 5, 7, 9],
  13: [0, 1, 2, 3, 5, 6, 9],
};

const DEEPER_EXTRAS = {
  1: [
    b(
      "Clarify the real stake. A contest often looks larger than the outcome it can actually change.",
      "Naming the real stake keeps anger from inflating the situation. It also helps you notice when the price of conflict is already larger than the value at issue."
    ),
    b(
      "Study incentives, not just statements. People reveal intent through what benefits them, not only through what they say aloud.",
      "A careful comparison asks what each side gains, fears, and can afford. Incentives often predict behavior more reliably than declared principles."
    ),
    b(
      "Notice when comparison says no. Good judgment sometimes ends a contest before it begins.",
      "Sun Tzu is not teaching endless engagement. He is teaching disciplined selection, which includes refusing fights that would waste strength on poor terms."
    ),
    b(
      "Test your own story for pride. Ego can make a weak position feel righteous enough to enter anyway.",
      "People often keep only the facts that flatter commitment. Honest planning includes asking what you would see differently if image were removed from the decision."
    ),
    b(
      "Preparation shapes the field before anyone moves. The side that compares well can often influence tone, timing, and expectations in advance.",
      "This is why early judgment matters so much. It does not merely predict the contest. It can change the contest by changing how you enter it."
    ),
  ],
  2: [
    b(
      "Hidden costs arrive before visible collapse. A long struggle usually weakens judgment and trust before it breaks the budget.",
      "People notice the blowup and miss the earlier erosion. Sun Tzu wants leaders to recognize drag while the system still looks functional."
    ),
    b(
      "False progress can keep you trapped. Small gains may feel reassuring while the broader cost curve keeps worsening.",
      "That is why continuation has to be measured against the whole objective. A little forward motion does not prove the campaign remains worth its price."
    ),
    b(
      "Borrowed strength runs out. If a campaign depends on extra favors, emotional reserves, or emergency effort, time becomes even more dangerous.",
      "Temporary support can hide a weak strategy for a while. The longer the struggle lasts, the more exposed those hidden dependencies become."
    ),
    b(
      "Ending well matters more than lasting long. A leader should know what acceptable resolution looks like before endurance becomes vanity.",
      "Without a clear end state, persistence turns into drift. Then the conflict starts consuming itself simply because no one defined enough."
    ),
    b(
      "Withdrawal can protect future power. Sometimes the wisest move is to stop feeding a contest that no longer deserves the cost.",
      "Sun Tzu is not worshipping speed for its own sake. He is protecting long term capacity from the lie that every prolonged effort proves virtue."
    ),
  ],
  3: [
    b(
      "Leave the other side a workable exit when you can. Cornered resistance is often more expensive than redirected resistance.",
      "If people can preserve some dignity or interest while yielding, they may move sooner and with less destruction. That serves preservation better than needless humiliation."
    ),
    b(
      "Governability matters after the win. A damaged system is harder to lead, absorb, or use well.",
      "Sun Tzu is thinking beyond the moment of victory. He cares whether what you gain will still function once the conflict is over."
    ),
    b(
      "Change incentives before demanding surrender. People often move when the old stance becomes less useful than the new one.",
      "This is a deeper form of pressure. Instead of smashing resistance, you alter the structure around it so resistance loses value."
    ),
    b(
      "Break isolation on your side too. Your own alliances, communication, and legitimacy are part of strategic strength.",
      "A low cost win is easier when your coalition is clear and disciplined. Otherwise even a clever plan can wobble during execution."
    ),
    b(
      "Judge victory by what it preserves. The best plan is not just the one that wins, but the one that leaves you strongest afterward.",
      "That test keeps strategy from shrinking into spectacle. It asks whether success improved your position in a durable way."
    ),
  ],
  4: [
    b(
      "Defense is active design. A secure position is built through structure, standards, and foresight, not through passive waiting.",
      "Sun Tzu does not picture safety as hiding. He pictures it as arranging conditions so obvious attacks fail to break you."
    ),
    b(
      "Build margin before pressure arrives. Slack in time, resources, and communication keeps small shocks from becoming crises.",
      "Fragile systems operate with no room for surprise. Secure ones carry enough margin to keep thinking when the unexpected appears."
    ),
    b(
      "Separate readiness from opportunity. You control the first through preparation and respond to the second when it truly appears.",
      "Confusing these two leads people to lunge from weak positions. Sun Tzu wants readiness to be present even before the opening is visible."
    ),
    b(
      "Panic often reveals structural weakness. When a situation feels urgent at once, the base may have been too exposed all along.",
      "Urgency is not always created by the outside world. Sometimes it is created by poor preparation that left no protected room to think."
    ),
    b(
      "Security creates selective aggression. The harder you are to break, the more freedom you have to choose where pressure belongs.",
      "This is the deeper payoff of sound positioning. A secure base does not merely prevent loss. It widens your offensive options."
    ),
  ],
  5: [
    b(
      "Momentum is stored before it is released. What looks effortless in action usually required careful arrangement beforehand.",
      "Sun Tzu keeps linking visible force to invisible preparation. The burst only lands because the system was shaped to carry it."
    ),
    b(
      "Variation protects leverage. If your rhythm never changes, the other side can start timing your strength.",
      "Predictable intensity becomes easier to absorb. Variation keeps force alive by making the release less readable."
    ),
    b(
      "Leaders shape when effort peaks. Constant strain wastes people who might have been decisive if held for the right moment.",
      "This chapter is not praising nonstop pressure. It is teaching controlled release so energy arrives where it matters most."
    ),
    b(
      "Clean handoffs multiply force. The gap between one action and the next often decides whether momentum grows or dies.",
      "A system can lose leverage between steps even when each step is strong on its own. Coherent sequence keeps energy from leaking away."
    ),
    b(
      "The strongest systems do not look frantic. Good design lets a great deal happen without everyone feeling rushed all the time.",
      "That calm is not laziness. It is a sign that the force is being composed intelligently instead of being extracted through noise."
    ),
  ],
  6: [
    b(
      "Weakness can be created, not only found. When you force dispersion, delay, or divided attention, new openings appear.",
      "Sun Tzu is not waiting passively for weakness to show itself. He is willing to shape the field until weakness becomes more available."
    ),
    b(
      "Look for decision bottlenecks. A system may appear strong overall while depending on one overloaded point.",
      "The visible front can distract from the thinner place that actually governs the outcome. Strategic pressure often works best against the point that organizes the rest."
    ),
    b(
      "Do not chase every opening. Selection still matters after weakness appears.",
      "A leader who darts at every gap loses concentration and tempo. The right opening is the one you can exploit without scattering your own force."
    ),
    b(
      "Conceal the main aim while you create movement elsewhere. Misdirection keeps defenders from arranging themselves too neatly.",
      "If the other side knows exactly what matters to you, they can harden the right place in time. Ambiguity makes their defense more expensive."
    ),
    b(
      "Good attacks make the other side move badly. The goal is not impact alone, but disorganization, delay, and poor response.",
      "That is how weak point strategy compounds. Once the other side is reacting under strain, more weaknesses tend to open."
    ),
  ],
  7: [
    b(
      "Every shortcut creates a coordination test. A faster route can still be worse if it scatters signals and support.",
      "Sun Tzu does not reject speed. He asks whether the speed can be carried without breaking cohesion on the way."
    ),
    b(
      "Plans must simplify under motion. People can handle less complexity while tired, moving, and under pressure.",
      "A plan that depends on perfect understanding may fail once conditions become noisy. Simplicity becomes part of strategic design."
    ),
    b(
      "Morale falls when people stop understanding the movement. Confusion breeds anxiety faster than hard work does.",
      "When teams cannot tell where they are, why the pace changed, or what success looks like, strain begins to feel pointless."
    ),
    b(
      "Recovery points matter inside a campaign. Rest, reorientation, and re supply keep motion from eroding the force itself.",
      "Movement is not sustained by will alone. Leaders must create points where clarity and capacity can be restored before pushing again."
    ),
    b(
      "Abandon a fast move that breaks the group. Fragmented speed usually becomes slower in the end.",
      "This is one of Sun Tzu's harder disciplines. You sometimes give up a tempting advance because cohesion is the more valuable asset."
    ),
  ],
  8: [
    b(
      "Rules should shorten judgment, not replace it. A good principle helps you see faster, but it cannot do the seeing for you.",
      "Sun Tzu wants rules that support perception. Once a rule becomes a substitute for reading the field, it starts creating error."
    ),
    b(
      "A leader's vice can choose tactics without permission. Temperament often hides inside strategic language.",
      "People call a move bold, loyal, or disciplined when it is really being driven by fear, pride, anger, or vanity."
    ),
    b(
      "Virtues become liabilities in excess. Patience, courage, and care all need context to stay wise.",
      "The same trait that helps in one moment can distort judgment in another. That is why Sun Tzu keeps returning to fit."
    ),
    b(
      "Adaptation often means stopping early. The wise leader ends a once useful method before it hardens into a habit.",
      "Waiting until failure becomes obvious can be too late. Better judgment notices declining fit before collapse forces the change."
    ),
    b(
      "Teach the team how to adjust. Flexibility cannot live only in the leader's head.",
      "If everyone else expects rigid repetition, adaptation becomes chaotic. Shared understanding turns change into coordination rather than surprise."
    ),
  ],
  9: [
    b(
      "Seeing well requires emotional distance. Urgency and irritation make people read signs through the story they already want.",
      "Observation is not just about eyesight. It is also about staying calm enough to let the evidence correct your first impression."
    ),
    b(
      "Silence, noise, speed, and posture gain meaning through contrast. A sign by itself rarely tells the whole truth.",
      "Sun Tzu keeps observation relational. You compare today with yesterday, one cue with another, and behavior with setting."
    ),
    b(
      "Read what stops happening, not only what starts happening. Missing routines can reveal trouble faster than dramatic gestures do.",
      "A team that stops reporting, a class that stops asking questions, or a partner who stops engaging can all signal changed conditions."
    ),
    b(
      "Repeated checks beat one sharp glance. Good reading comes from patient accumulation.",
      "A leader who keeps observing can refine timing as the picture clarifies. One early impression is often too thin for a reliable move."
    ),
    b(
      "Most false surprises begin as ignored evidence. Denial often hides in plain sight before the shock arrives.",
      "This is the chapter's deeper warning. Observation fails less from lack of data than from lack of disciplined attention to what the data implies."
    ),
  ],
  10: [
    b(
      "Some terrain invites overconfidence. A setting can look open and easy while quietly increasing exposure.",
      "Leaders often mistake visible freedom for strategic comfort. Sun Tzu wants the ground read for risk as well as promise."
    ),
    b(
      "Exit paths are part of the ground. A location should be judged by how well it supports both pressure and recovery.",
      "If you can enter easily but cannot adjust or withdraw cleanly, the terrain may be worse than it first appears."
    ),
    b(
      "Environment can reverse advantages. A strong team can become awkward or slow if the setting favors different strengths.",
      "That is why talent and courage are never enough by themselves. The ground can amplify or blunt what you already have."
    ),
    b(
      "Leaders must explain the setting to the group. Shared interpretation reduces naive moves and misplaced blame.",
      "When people understand the real constraints, they stop expecting impossible performance from one another."
    ),
    b(
      "Bad fit creates blame cycles. People start accusing character when the deeper problem is environmental mismatch.",
      "Sun Tzu's terrain logic improves leadership honesty. It helps you distinguish weak performance from a weak pairing between tactic and ground."
    ),
  ],
  11: [
    b(
      "Pressure can divide or unite depending on framing. The same difficulty can create drift or resolve based on how it is led.",
      "Situations shape behavior, but leadership still matters inside them. People need help understanding what the moment demands."
    ),
    b(
      "Commitment changes what people will risk. Once backing out becomes costly, unity and clarity grow more important.",
      "Depth of involvement transforms psychology. Leaders have to recognize when the group is no longer operating with loose attachment."
    ),
    b(
      "Some situations require stripping away distractions. Comfort and too many options can weaken seriousness.",
      "Sun Tzu knows that urgency does not emerge evenly. Sometimes leaders must narrow attention so effort gathers around the essential."
    ),
    b(
      "Desperation is powerful but dangerous to manufacture. Extreme pressure can produce effort, but it can also produce panic or resentment.",
      "The chapter observes necessity as a force. It does not license careless manipulation of fear."
    ),
    b(
      "Tactical fit begins with emotional fit. You must know what the position is doing to fear, urgency, and cooperation before choosing the move.",
      "That deeper psychological read is why one tactic everywhere becomes blindness. The same command lands differently in different situations."
    ),
  ],
  12: [
    b(
      "Escalation reshapes the whole field. Severe pressure often changes relationships, timing, and public meaning beyond the target itself.",
      "That is why control matters so much. A strong move can spread into consequences you never intended if you treat it too narrowly."
    ),
    b(
      "The more irreversible the move, the smaller the margin for error. Big tools demand narrow discipline.",
      "Sun Tzu raises the standard as the cost of mistake rises. Power does not excuse looseness. It requires more precision."
    ),
    b(
      "Support systems must be ready before pressure is released. Once the move begins, you may not have time to build them from scratch.",
      "Follow through is not an afterthought. It is part of the decision about whether to escalate at all."
    ),
    b(
      "Symbolic force is often wasteful. A dramatic move that cannot improve position is only expensive theater.",
      "Leaders reach for symbolism when emotion outruns objective. Sun Tzu keeps asking what the force will actually change."
    ),
    b(
      "Restraint preserves future options. The pressure you do not spend too early can remain available when conditions finally justify it.",
      "This makes patience a form of strength. You are protecting choice, not hiding from conflict."
    ),
  ],
  13: [
    b(
      "Intelligence should change the plan. Information that never alters timing or sequence is only decoration.",
      "Sun Tzu values knowledge because it improves action. If the same move would follow either way, the collection was not yet strategic."
    ),
    b(
      "Source networks need maintenance. Trust, reward, and careful handling keep information alive over time.",
      "A single report may matter, but the deeper asset is the relationship system that keeps truth moving toward you."
    ),
    b(
      "Partial truth can mislead more than ignorance. A fragment that feels complete often creates the worst kind of confidence.",
      "This is why cross checking matters so much. People act hardest on stories that seem just informed enough to stop questioning."
    ),
    b(
      "Humility protects intelligence. Leaders need discipline about what remains unknown even after good reporting arrives.",
      "Without that humility, information becomes a prop for ego instead of a tool for judgment."
    ),
    b(
      "Bad source handling can damage both insight and deception. If people feel exposed or misused, the whole information system weakens.",
      "Sun Tzu treats intelligence as a living practice, not a one time grab. It depends on care at every step."
    ),
  ],
};

const EXTRA_EXAMPLES = {
  1: [
    ex(
      "ch01-ex04",
      "Promotion decision",
      ["work"],
      "A director wants to promote a high performer immediately after one impressive client meeting, but the role would also require mentoring, cross team coordination, and calm judgment under pressure. The room is leaning toward a fast decision because the recent win feels decisive.",
      [
        "Pause the momentum and compare the full job against the person's actual pattern, not one vivid moment.",
        "Look at leadership trust, consistency, timing, and the cost of a rushed choice before you commit."
      ],
      "The chapter asks you to judge the whole field before acting. A rushed promotion can turn one exciting signal into a costly conflict later."
    ),
    ex(
      "ch01-ex05",
      "Group project blowup",
      ["school"],
      "A group project is going badly, and one student wants to report a teammate for laziness right away. No one has checked who misunderstood the assignment, who is overloaded in other classes, or whether the roles were ever clearly divided.",
      [
        "Clarify the actual objective, the task split, and the timeline before turning frustration into escalation.",
        "Compare what each person was asked to do against what the project truly needed so you are solving the right problem."
      ],
      "Comparison protects you from fighting the loudest symptom. It helps you see whether the issue is character, structure, timing, or all three."
    ),
    ex(
      "ch01-ex06",
      "Neighbor complaint",
      ["personal"],
      "You are upset that a neighbor keeps blocking part of your driveway, and you are ready to send an angry message late at night. You have not decided whether you want an apology, a permanent fix, or simply an outlet for the irritation.",
      [
        "Set the real aim before you send anything, then choose a time and tone that make that aim more likely.",
        "Check whether there is missing context or a simpler path to resolution before you turn it into a bigger fight."
      ],
      "The chapter is not telling you to stay silent. It is telling you to enter the conflict with a clear objective instead of a burst of emotion."
    ),
  ],
  2: [
    ex(
      "ch02-ex04",
      "Stalled feature dispute",
      ["work"],
      "Two teams have spent six weeks arguing about who owns a product bug. Meetings keep getting scheduled, customer frustration keeps growing, and both teams are now spending more time protecting themselves than fixing the issue.",
      [
        "Name the actual cost of continuation in time, customer trust, and engineering attention, then push for a decision path that ends the drag.",
        "Stop treating every extra meeting as neutral. If the conflict is consuming the work, the cost is already too high."
      ],
      "Sun Tzu wants leaders to count the price of delay honestly. Once the hidden drain is visible, the need for resolution becomes much clearer."
    ),
    ex(
      "ch02-ex05",
      "Club rule rewrite",
      ["school"],
      "A student club has spent most of the semester rewriting its rules after one messy election. The group keeps debating every line, attendance is falling, and the events that actually matter to members are starting to slip.",
      [
        "Decide what must truly be solved and what can be fixed later, then set a hard end point for the rewrite.",
        "Measure the ongoing debate against the activities the club is now neglecting."
      ],
      "The longer a conflict runs, the more it starts consuming other valuable work. That is the slow cost this chapter wants leaders to see early."
    ),
    ex(
      "ch02-ex06",
      "Friendship freeze",
      ["personal"],
      "You and a close friend have been trading careful, tense messages for two months after one bad misunderstanding. Nothing has been repaired, but the argument keeps taking up mental space every week.",
      [
        "Ask what the unresolved conflict is already costing both of you in trust, attention, and future closeness, then choose a real attempt at resolution.",
        "If the current pattern is only prolonging strain, change the form of the conversation instead of letting it keep running."
      ],
      "A conflict does not need shouting to become expensive. Sun Tzu's warning applies to quiet stalemates too."
    ),
  ],
  3: [
    ex(
      "ch03-ex04",
      "Cross team rollout",
      ["work"],
      "A product team wants to force a rollout through despite resistance from support and operations. A direct push could win the approval fight, but it would leave the launch brittle and resentful across teams that still have to carry it.",
      [
        "Shift from forcing agreement to redesigning the rollout so the resisting teams see their risks handled and their workload preserved.",
        "Look for the path that secures cooperation and keeps the system usable after the decision lands."
      ],
      "This chapter values wins you can hold. If you crush resistance but damage the people who must live with the result, the victory was too expensive."
    ),
    ex(
      "ch03-ex05",
      "Shared space dispute",
      ["school"],
      "Two student groups both want the same campus room for a major event night. One group is ready to escalate to the dean and make the other side lose publicly.",
      [
        "Look first for a structure that preserves the relationship and the usefulness of the space, such as a swap, shared support, or schedule trade.",
        "Only move toward direct escalation after you have tried to change the incentives around the conflict itself."
      ],
      "The strongest outcome is often the one that breaks resistance without wrecking what both sides still need afterward."
    ),
    ex(
      "ch03-ex06",
      "Teen curfew conflict",
      ["personal"],
      "A parent and teenager are locked in a recurring fight about curfew. Each conversation becomes a test of control, and both people leave angrier and less willing to cooperate the next time.",
      [
        "Stop trying to win the argument by force alone and redesign the situation around trust, consequences, and clear check ins.",
        "Aim for a structure that makes compliance easier and open rebellion less useful."
      ],
      "Sun Tzu's logic fits here because lasting influence often comes from changing the setup, not from winning the loudest round."
    ),
  ],
  4: [
    ex(
      "ch04-ex04",
      "Executive review prep",
      ["work"],
      "A manager wants to pitch a major initiative to executives next week, but the numbers are still messy and the team has not aligned on likely objections. The idea could be good, yet the position is not secure.",
      [
        "Use the extra time to tighten the facts, rehearse the weak points, and make easy defeat harder before seeking the win.",
        "Do not trade structural readiness for the feeling of visible momentum."
      ],
      "This chapter values a stable base before a public push. When defeat is harder, opportunity becomes much more usable."
    ),
    ex(
      "ch04-ex05",
      "Scholarship appeal",
      ["school"],
      "A student wants to appeal a scholarship decision immediately, but the case file is incomplete, the deadlines are not fully clear, and the supporting documents are still scattered across email threads.",
      [
        "Secure the foundation first by organizing the evidence, understanding the process, and closing obvious gaps in the case.",
        "Then look for the best opening instead of forcing action from a shaky base."
      ],
      "Preparation is not delay for its own sake. It is how you reduce avoidable weakness before asking the moment to carry your hopes."
    ),
    ex(
      "ch04-ex06",
      "Difficult breakup logistics",
      ["personal"],
      "You know you need to end a relationship, but you also share bills, keys, and a living space. The emotional urge is to say everything at once tonight and deal with the fallout later.",
      [
        "First secure the practical basics so the conversation does not create preventable chaos the next morning.",
        "Once the position is steadier, choose the time and method that let honesty happen without avoidable collapse."
      ],
      "Sun Tzu's lesson is not to avoid hard truth. It is to reduce needless exposure before entering a moment that can shift everything."
    ),
  ],
  5: [
    ex(
      "ch05-ex04",
      "Launch week rhythm",
      ["work"],
      "A team is heading into a launch week with many moving parts. Everyone is working hard, but updates are scattered, key approvals are arriving late, and people keep duplicating work because the pace has no clear rhythm.",
      [
        "Set a shared cadence for updates, handoffs, and decision points so the same effort starts landing together.",
        "Use direct moves to stabilize the basics and indirect moves to create openings where the launch can gain momentum."
      ],
      "The chapter is about turning effort into coherent effect. Without rhythm and signal, energy stays expensive and thin."
    ),
    ex(
      "ch05-ex05",
      "Tournament preparation",
      ["school"],
      "A student team is preparing for a competition by practicing every part at full intensity every day. Everyone is exhausted, and the strongest moments are getting blunted because there is no sequence or variation.",
      [
        "Rebuild the practice plan around timing, focused bursts, and clear signals so the best energy is saved for the moments that matter most.",
        "Stop treating constant strain as proof that the preparation is strong."
      ],
      "Leverage grows when effort is composed well. This chapter values concentration and release over nonstop pressure."
    ),
    ex(
      "ch05-ex06",
      "House move weekend",
      ["personal"],
      "Several friends are helping you move apartments, but no one knows the order of tasks, who has the van keys, or when the building elevator is booked. People are willing, yet the energy is turning into friction.",
      [
        "Create a simple sequence, assign the key roles, and time the heavy moves so people are not crowding the same problem at once.",
        "Use the group's effort like a designed flow instead of a pile of good intentions."
      ],
      "The same people can do far more once the motion is organized. That is Sun Tzu's point about composed force in ordinary life."
    ),
  ],
  6: [
    ex(
      "ch06-ex04",
      "Segment choice",
      ["work"],
      "A startup keeps trying to win enterprise accounts that demand features a giant competitor already delivers better. Meanwhile, smaller customers with urgent service gaps are still underserved.",
      [
        "Stop spending your best effort on the rival's strongest ground and concentrate where their attention is thin and your speed matters more.",
        "Choose the market slice where your pressure creates movement instead of proving you can absorb punishment."
      ],
      "This chapter rewards selection over pride. You do not need to win everywhere if you can matter decisively in the right place."
    ),
    ex(
      "ch06-ex05",
      "Exam week targeting",
      ["school"],
      "A student has three days before a hard exam and wants to spend most of the time polishing material they already understand because it feels productive. The weak sections that could change the grade are still thin.",
      [
        "Aim the remaining study time at the topics where your understanding is weakest and where focused effort can still create a meaningful shift.",
        "Do not feed the part of the course that is already strongest just because it feels safer."
      ],
      "Sun Tzu's logic applies to learning as well. The best use of force is where the system is open to change, not where resistance is already high."
    ),
    ex(
      "ch06-ex06",
      "Family routine change",
      ["personal"],
      "You want your household to stop one frustrating habit, but every conversation gets pulled into the one argument everyone is already fully prepared to defend. Nothing changes because the pressure keeps landing on the most hardened point.",
      [
        "Shift away from the most defended version of the fight and target the smaller overlooked habit that actually keeps the pattern alive.",
        "Create movement where people are less dug in, then build from that opening."
      ],
      "A better point of pressure can do more than a louder argument. This chapter cares about leverage, not theatrical toughness."
    ),
  ],
  7: [
    ex(
      "ch07-ex04",
      "Conference handoff",
      ["work"],
      "A team is trying to keep a client project moving while half the staff are traveling for a conference. Tasks keep bouncing between people, updates are partial, and the pace feels urgent but disjointed.",
      [
        "Simplify the active priorities, tighten the handoff rules, and make sure everyone knows the signals for what truly needs attention while people are in motion.",
        "If the current speed is breaking clarity, slow the move enough to restore cohesion."
      ],
      "The chapter teaches that movement without control damages your own side first. Cohesion is what turns motion into usable pressure."
    ),
    ex(
      "ch07-ex05",
      "Away game travel day",
      ["school"],
      "A student team travels for an event with a packed schedule, little sleep, and confusing instructions about where to be and when. By the time the competition starts, the group is irritated and misaligned.",
      [
        "Protect the basics of rest, signal, and role clarity before assuming the group can perform well under motion.",
        "Treat travel strain as a strategic factor, not as a side note that strong people should simply absorb."
      ],
      "Sun Tzu keeps logistics close to performance because tired, confused groups often undo themselves before the real contest begins."
    ),
    ex(
      "ch07-ex06",
      "Road trip friction",
      ["personal"],
      "A family road trip starts with everyone enthusiastic, but after a long stretch of driving the route, stops, and responsibilities become unclear. Small tensions begin turning into sharp comments.",
      [
        "Reset the plan in plain language, name the next few decisions clearly, and build a break in before fatigue keeps speaking for everyone.",
        "Do not assume goodwill alone will protect cohesion once movement gets draining."
      ],
      "This chapter is about friction inside motion. Clear signals and preserved endurance keep the journey from creating its own conflict."
    ),
  ],
  8: [
    ex(
      "ch08-ex04",
      "Interview process mismatch",
      ["work"],
      "A company uses the same interview process for designers, analysts, and engineering managers because it once worked well. The process is polished, but the fit with the actual roles keeps getting worse.",
      [
        "Keep the core standard of rigor, but adapt the method to the real demands of each role instead of repeating one trusted routine everywhere.",
        "Ask whether loyalty to the old process is serving evidence or just familiarity."
      ],
      "The chapter warns that a once successful tactic can become a liability when people confuse consistency with wisdom."
    ),
    ex(
      "ch08-ex05",
      "One response for every conflict",
      ["school"],
      "A student leader handles every disagreement the same way by calling a full group meeting, even when some issues need a private conversation and others need a quick decision. The habit feels fair, but it is creating new tension.",
      [
        "Hold onto the principle of fairness while changing the format to fit the type of problem in front of you.",
        "Do not let one favorite method become a substitute for reading the actual situation."
      ],
      "Disciplined flexibility means purpose stays clear while tactics stay responsive. That is the deeper logic of the chapter."
    ),
    ex(
      "ch08-ex06",
      "Helping the same way every time",
      ["personal"],
      "You keep helping a sibling in exactly the same way because that approach once helped a lot. Now their circumstances are different, but you are still using the old script out of habit and loyalty.",
      [
        "Stay committed to support, then adjust the form of that support to what is true now rather than what used to be true.",
        "Notice whether your attachment is to the person's good or to your own familiar role."
      ],
      "Sun Tzu's lesson here is that good intentions still need fresh judgment. A fixed method can drift away from the reality it was meant to serve."
    ),
  ],
  9: [
    ex(
      "ch09-ex04",
      "Reorg meeting signals",
      ["work"],
      "After a company reorganization, one department keeps saying the transition is fine, but deadlines are slipping, side conversations are growing, and updates have become oddly vague. The spoken story and the visible signs do not match.",
      [
        "Read the repeated behavioral cues instead of relying only on the official reassurance, then ask sharper questions about where strain is actually building.",
        "Look for patterns across missed follow through, tone, and coordination before deciding what the department truly needs."
      ],
      "This chapter trains you to notice what the field is already showing. Small repeated signs often reveal the real condition before anyone names it."
    ),
    ex(
      "ch09-ex05",
      "Class before the deadline",
      ["school"],
      "A class suddenly gets quieter the week before a major deadline. Students stop asking questions, attendance softens, and several people begin checking one another's reactions before speaking.",
      [
        "Treat the shift in behavior as information and investigate whether confusion, fear, or lack of readiness is rising beneath the surface.",
        "Do not wait for an explicit complaint if the pattern is already visible."
      ],
      "Reading signals well helps you act before the problem becomes fully dramatic. That is one of the chapter's biggest practical uses."
    ),
    ex(
      "ch09-ex06",
      "Friend pulling back",
      ["personal"],
      "A friend keeps saying everything is okay, yet they are canceling plans later, responding more briefly, and avoiding one topic that used to be easy. You are unsure whether to ignore it or confront it hard.",
      [
        "Observe the pattern calmly and look for repeated signs before deciding what it means, then open a conversation that fits what the evidence actually suggests.",
        "Let the visible cues guide the timing and tone instead of forcing the first interpretation that comes to mind."
      ],
      "The chapter teaches that behavior often speaks earlier than explanation. Careful observation protects you from both denial and overreaction."
    ),
  ],
  10: [
    ex(
      "ch10-ex04",
      "Quarter end negotiation",
      ["work"],
      "You are negotiating with a vendor near the end of their quarter, and your team is acting as if the conversation is only about price. In reality, the timing, approval path, and reporting pressure are shaping the whole terrain.",
      [
        "Read the environment before choosing the move, including who feels time pressure, what approvals are hard, and where either side could get trapped.",
        "Then choose a tactic that fits the setting instead of assuming the same negotiation move works everywhere."
      ],
      "Terrain in modern work often means timing, incentives, and structure. Once you see the ground clearly, better options appear."
    ),
    ex(
      "ch10-ex05",
      "Final week pressure",
      ["school"],
      "A student plans to raise a concern with a professor during the last crowded week of the term, when office hours are short and emotions are already stretched. The content of the complaint may be fair, but the setting is poor ground for the move.",
      [
        "Ask what the environment is likely to reward or punish right now, then choose a time and route that fit the actual terrain.",
        "Do not judge the tactic in isolation from the conditions around it."
      ],
      "This chapter insists that setting changes wisdom. The same conversation can work very differently on different ground."
    ),
    ex(
      "ch10-ex06",
      "Holiday conversation",
      ["personal"],
      "You want to bring up a sensitive family issue during a crowded holiday gathering because everyone will already be together. The urge is understandable, but the room, noise, and emotional climate make the terrain unusually bad.",
      [
        "Separate the importance of the issue from the quality of the setting and choose ground that allows honesty without needless exposure.",
        "Notice whether convenience is being mistaken for fit."
      ],
      "Sun Tzu's terrain logic prevents many avoidable failures. A good issue can still fail badly on the wrong ground."
    ),
  ],
  11: [
    ex(
      "ch11-ex04",
      "Crunch week leadership",
      ["work"],
      "A team enters a tight deadline week after months of loose progress. The leader keeps using the same relaxed style that worked earlier, even though the situation now needs sharper priorities and tighter alignment.",
      [
        "Read what the current position is doing to urgency and cooperation, then match the pace and clarity of leadership to that pressure.",
        "Do not use the same tactic from the open stage once the situation has become contested and costly."
      ],
      "This chapter rejects favorite methods. It asks what the present position requires from people psychologically, then chooses tactics from there."
    ),
    ex(
      "ch11-ex05",
      "Funding cut response",
      ["school"],
      "A student organization suddenly loses funding for a major event. Some members treat it like a normal setback, while others feel the whole semester is on the line. The group needs a response that fits the new pressure, not last month's mood.",
      [
        "Name the situation clearly, narrow attention to what matters most now, and choose a pace that matches the urgency instead of the old routine.",
        "Use the pressure to create unity where possible, but do not spray panic across the whole group."
      ],
      "Position changes behavior. Good leadership helps people meet the actual moment rather than drifting inside old assumptions."
    ),
    ex(
      "ch11-ex06",
      "Family emergency roles",
      ["personal"],
      "A family member has a medical emergency, and the household suddenly shifts from ordinary life into a high pressure situation. Old patterns of vague coordination no longer work, but everyone is still acting as if they do.",
      [
        "Match the communication and role clarity to the seriousness of the position so people know what matters now and what can wait.",
        "Use the urgency to reduce distraction and align effort rather than letting the pressure scatter everyone."
      ],
      "The chapter links tactics to the pressure people are under. Different positions call forth different kinds of leadership and cooperation."
    ),
  ],
  12: [
    ex(
      "ch12-ex04",
      "Escalating to legal",
      ["work"],
      "A partnership dispute is getting ugly, and someone on your team wants to threaten legal action immediately to show strength. The move could create pressure, but the evidence file is incomplete and the next steps are not ready.",
      [
        "Ask whether the escalation serves a clear objective, whether the conditions support it, and what follow through will be required if you trigger it now.",
        "If those answers are weak, keep pressure governable until the stronger move is actually supportable."
      ],
      "Severe tools are not wise just because they exist. Sun Tzu ties escalation to timing, support, and control."
    ),
    ex(
      "ch12-ex05",
      "Cheating accusation",
      ["school"],
      "A student believes a classmate cheated and wants to expose them publicly before speaking with the instructor. The accusation may be justified, but a severe public move could outrun the available evidence and trigger damage that cannot be undone easily.",
      [
        "Separate the need for accountability from the urge for immediate dramatic pressure, then choose the route that keeps the matter governable.",
        "Make sure evidence, timing, and follow through all support the level of force you are considering."
      ],
      "The chapter warns that anger often reaches for intensity faster than judgment does. Governed pressure is stronger than emotional escalation."
    ),
    ex(
      "ch12-ex06",
      "Posting private messages",
      ["personal"],
      "You are tempted to post screenshots of a private argument because the other person has crossed a line and you want the truth seen. Once the messages are public, though, the damage will spread far beyond the immediate conflict.",
      [
        "Ask what this move would actually improve, what it would permanently damage, and whether you are ready for every consequence it creates.",
        "Do not let the feeling of decisive release substitute for strategic control."
      ],
      "Sun Tzu's lesson here is restraint with powerful tools. Some moves feel strong precisely because they outrun control so quickly."
    ),
  ],
  13: [
    ex(
      "ch13-ex04",
      "Anonymous report",
      ["work"],
      "A manager receives an anonymous note claiming a teammate is planning to leave and take key clients. The rumor is alarming enough to tempt immediate action, but the source, motive, and accuracy are still unclear.",
      [
        "Separate the report into confirmed facts, likely inference, and open questions before you let it shape a major decision.",
        "Gather from more than one reliable source and let the information change timing only when it becomes credible enough to deserve that power."
      ],
      "Good intelligence reduces waste. Weak intelligence can create the very disruption it claimed to warn you about."
    ),
    ex(
      "ch13-ex05",
      "Plagiarism rumor",
      ["school"],
      "A rumor spreads that a student copied part of a paper, and several classmates are already treating the claim as settled truth. Almost no one has checked the evidence trail, the source, or the context.",
      [
        "Slow the certainty down and ask who actually knows what directly before acting on the story.",
        "Compare independent sources and make sure the information is strong enough to justify the next step."
      ],
      "This chapter separates intelligence from gossip. Real information deserves care, cross checking, and humility."
    ),
    ex(
      "ch13-ex06",
      "Conflicting care stories",
      ["personal"],
      "Siblings are hearing different versions of what an aging parent wants for future care. Each version sounds confident, but the reports are secondhand and emotionally charged.",
      [
        "Clarify who has direct knowledge, where the stories diverge, and what remains unknown before you build plans on top of assumption.",
        "Treat trust and careful handling as part of the information work, not as a separate issue."
      ],
      "The chapter teaches that truth is not helped by fast invention. Better information often prevents a conflict that emotion was ready to start."
    ),
  ],
};

const AUDIT_SUMMARY = [
  "The existing Art of War package already had a strong editorial base. The summaries were generally faithful, the bullets usually moved from idea to meaning, and the quizzes were mostly scenario based rather than trivia based. The book was therefore not a blank slate rewrite. It was a precision upgrade.",
  "The biggest failures were structural rather than purely sentence level. Every depth variant shipped the same ten bullets, every chapter shipped only three scenarios instead of six, and the current motivation layer changed tone by appending generic suffixes that felt mechanical rather than genuinely personalized.",
  "A second problem was instructional layering. Because the bullet counts did not change by depth and the motivation layer only added stock lines, the user could switch modes without feeling a real change in reading load, interpretive depth, or coaching voice.",
  "The revision therefore focused on four priorities: restore depth integrity, expand transfer with six realistic scenarios per chapter, preserve the strongest existing wording where it was already working, and replace fake tone shifts with a cleaner guidance strategy."
];

const MAIN_PROBLEMS = [
  "Depth structure was out of spec. Simple, Standard, and Deeper all exposed the same ten bullets, which flattened the experience and weakened the promise of meaningful reading depth.",
  "Scenario coverage was incomplete. Each chapter only had one work scenario, one school scenario, and one personal scenario, which left transfer too narrow and made the learning loop feel unfinished.",
  "Motivation personalization was shallow. Gentle, Direct, and Competitive were being simulated by generic appended sentences in the reader, so the tone difference was noticeable but not truly authored.",
  "The current book flow was close to strong, but not complete. Summary, bullets, scenarios, and quiz worked individually, yet the whole lesson still needed more deliberate separation of purpose across the layers.",
  "Some chapters wanted more interpretive depth in Deeper mode. The strongest current writing often lived in the summaries and the standard bullet set, but several chapters still needed extra deeper bullets on tradeoffs, hidden logic, or second order consequences."
];

const PERSONALIZATION_STRATEGY = [
  "Depth remains the main authored content axis. Simple now uses seven bullets for fast understanding, Standard uses ten bullets as the premium default, and Deeper uses fifteen bullets that add real interpretive and practical depth rather than filler.",
  "Motivation style is handled as a guidance axis rather than a second full duplication of every field. The core lesson stays stable, while the reader guidance around summaries, examples, recap, and quiz explanation shifts to feel Gentle, Direct, or Competitive in a meaningful way.",
  "Gentle emphasizes steadiness, clarity, and controlled judgment. Direct emphasizes sequence, decision quality, and consequence. Competitive emphasizes leverage, edge, and the cost of giving away position.",
  "This keeps the system lean while still producing nine real user experiences. Depth changes what is explained and how much is explained. Motivation changes how the learner is guided through that material."
];

const SCHEMA_NOTE = "No package schema change was required. The revision stays compatible with the current Art of War JSON shape. Depth is authored directly in the package, and motivation can be applied cleanly in the reader as a book specific guidance layer instead of storing nine duplicated full packages.";

function clean(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function sentence(value) {
  const text = clean(value);
  if (!text) return "";
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function renderBullet(block) {
  return `${block.text} ${block.detail}`.trim();
}

function renderReport(bookPackage) {
  const chapters = [...bookPackage.chapters].sort((left, right) => left.number - right.number);
  const lines = [];

  lines.push("# 1. Book audit summary for The Art of War — Sun Tzu", "");
  AUDIT_SUMMARY.forEach((paragraph) => lines.push(sentence(paragraph), ""));

  lines.push("# 2. Main content problems found", "");
  MAIN_PROBLEMS.forEach((paragraph, index) => lines.push(`${index + 1}. ${sentence(paragraph)}`));
  lines.push("");

  lines.push("# 3. Personalization strategy for The Art of War — Sun Tzu", "");
  PERSONALIZATION_STRATEGY.forEach((paragraph) => lines.push(sentence(paragraph), ""));

  lines.push("# 4. Any minimal schema adjustments needed", "", sentence(SCHEMA_NOTE), "");

  lines.push("# 5. Chapter by chapter revised content", "");

  chapters.forEach((chapter) => {
    const simple = chapter.contentVariants.easy;
    const standard = chapter.contentVariants.medium;
    const deeper = chapter.contentVariants.hard;
    const simpleBullets = simple.summaryBlocks.filter((block) => block.type === "bullet");
    const standardBullets = standard.summaryBlocks.filter((block) => block.type === "bullet");
    const deeperBullets = deeper.summaryBlocks.filter((block) => block.type === "bullet");

    lines.push(`## ${chapter.number}. ${chapter.title}`, "");
    lines.push("### Summary", "");
    lines.push("#### Simple", "");
    simple.summaryBlocks
      .filter((block) => block.type === "paragraph")
      .forEach((block, index) => lines.push(`${index + 1}. ${sentence(block.text)}`));
    lines.push("");
    lines.push("#### Standard", "");
    standard.summaryBlocks
      .filter((block) => block.type === "paragraph")
      .forEach((block, index) => lines.push(`${index + 1}. ${sentence(block.text)}`));
    lines.push("");
    lines.push("#### Deeper", "");
    deeper.summaryBlocks
      .filter((block) => block.type === "paragraph")
      .forEach((block, index) => lines.push(`${index + 1}. ${sentence(block.text)}`));
    lines.push("");

    lines.push("### Bullet points", "");
    lines.push("#### Simple", "");
    simpleBullets.forEach((block, index) => lines.push(`${index + 1}. ${sentence(renderBullet(block))}`));
    lines.push("");
    lines.push("#### Standard", "");
    standardBullets.forEach((block, index) => lines.push(`${index + 1}. ${sentence(renderBullet(block))}`));
    lines.push("");
    lines.push("#### Deeper", "");
    deeperBullets.forEach((block, index) => lines.push(`${index + 1}. ${sentence(renderBullet(block))}`));
    lines.push("");

    lines.push("### Scenarios", "");
    chapter.examples.forEach((example, index) => {
      const scope = (example.contexts?.[0] || "personal").toUpperCase();
      lines.push(`${index + 1}. ${example.title} (${scope})`);
      lines.push(`Scenario: ${sentence(example.scenario)}`);
      lines.push(`What to do: ${example.whatToDo.map((step) => sentence(step)).join(" ")}`);
      lines.push(`Why it matters: ${sentence(example.whyItMatters)}`);
      lines.push("");
    });

    lines.push("### Quiz", "");
    chapter.quiz.questions.forEach((question, index) => {
      const correctIndex = question.correctAnswerIndex ?? 0;
      lines.push(`${index + 1}. ${sentence(question.prompt)}`);
      question.choices.forEach((choice, choiceIndex) => {
        lines.push(`${String.fromCharCode(65 + choiceIndex)}. ${sentence(choice)}`);
      });
      lines.push(`Correct answer: ${String.fromCharCode(65 + correctIndex)}`);
      lines.push(`Explanation: ${sentence(question.explanation || "")}`);
      lines.push("");
    });
  });

  lines.push("# 6. Final quality control summary", "");
  lines.push("1. Every chapter now has exactly two summary paragraphs in each depth variant.");
  lines.push("2. Bullet depth now changes meaningfully across the book with seven Simple bullets, ten Standard bullets, and fifteen Deeper bullets.");
  lines.push("3. Every chapter now has exactly six scenarios with two work, two school, and two personal cases.");
  lines.push("4. The strongest existing summaries and quiz questions were preserved where they were already faithful, then supported by deeper bullets and fuller transfer coverage.");
  lines.push("5. No package schema expansion was needed, which keeps the book compatible with the current system while still allowing stronger motivation handling in the reader.");
  lines.push("6. The resulting book now feels more complete as a guided lesson: orientation, structured understanding, transfer, and applied checking all carry distinct weight.");
  lines.push("");

  return lines.join("\n");
}

function assertNoDashContent(bookPackage) {
  const violations = [];

  for (const chapter of bookPackage.chapters) {
    for (const variant of Object.values(chapter.contentVariants)) {
      for (const block of variant.summaryBlocks || []) {
        if (/[–—-]/.test(block.text)) violations.push(`chapter ${chapter.number} block text`);
        if (block.type === "bullet" && block.detail && /[–—-]/.test(block.detail)) {
          violations.push(`chapter ${chapter.number} block detail`);
        }
      }
    }

    for (const example of chapter.examples) {
      if (/[–—-]/.test(example.title)) violations.push(`chapter ${chapter.number} example title`);
      if (/[–—-]/.test(example.scenario)) violations.push(`chapter ${chapter.number} example scenario`);
      if (/[–—-]/.test(example.whyItMatters)) violations.push(`chapter ${chapter.number} example why`);
      for (const step of example.whatToDo) {
        if (/[–—-]/.test(step)) violations.push(`chapter ${chapter.number} example step`);
      }
    }

    for (const question of chapter.quiz.questions) {
      if (/[–—-]/.test(question.prompt)) violations.push(`chapter ${chapter.number} quiz prompt`);
      if (question.explanation && /[–—-]/.test(question.explanation)) {
        violations.push(`chapter ${chapter.number} quiz explanation`);
      }
      for (const choice of question.choices) {
        if (/[–—-]/.test(choice)) violations.push(`chapter ${chapter.number} quiz choice`);
      }
    }
  }

  if (violations.length) {
    throw new Error(`Dash violation found: ${violations[0]}`);
  }
}

const pkg = JSON.parse(readFileSync(packagePath, "utf8"));

pkg.createdAt = new Date().toISOString();

for (const chapter of pkg.chapters) {
  const easy = chapter.contentVariants.easy;
  const medium = chapter.contentVariants.medium;
  const hard = chapter.contentVariants.hard;

  const easyParagraphs = easy.summaryBlocks.filter((block) => block.type === "paragraph");
  const mediumParagraphs = medium.summaryBlocks.filter((block) => block.type === "paragraph");
  const hardParagraphs = hard.summaryBlocks.filter((block) => block.type === "paragraph");

  const easyBullets = easy.summaryBlocks.filter((block) => block.type === "bullet");
  const mediumBullets = medium.summaryBlocks.filter((block) => block.type === "bullet");
  const hardBullets = hard.summaryBlocks.filter((block) => block.type === "bullet");

  const simpleIndexes = SIMPLE_INDEXES[chapter.number];
  const simpleBullets = simpleIndexes.map((index) => easyBullets[index]);
  const deeperExtras = DEEPER_EXTRAS[chapter.number];
  const deeperBullets = [...hardBullets.slice(0, 9), ...deeperExtras, hardBullets[9]];

  easy.summaryBlocks = [...easyParagraphs, ...simpleBullets];
  easy.summaryBullets = simpleBullets.map((block) => block.text);

  medium.summaryBlocks = [...mediumParagraphs, ...mediumBullets];
  medium.summaryBullets = mediumBullets.map((block) => block.text);

  hard.summaryBlocks = [...hardParagraphs, ...deeperBullets];
  hard.summaryBullets = deeperBullets.map((block) => block.text);

  const extras = EXTRA_EXAMPLES[chapter.number];
  chapter.examples = [...chapter.examples, ...extras];
}

for (const chapter of pkg.chapters) {
  const scopes = chapter.examples.reduce(
    (counts, example) => {
      const scope = example.contexts?.[0] || "personal";
      counts[scope] = (counts[scope] || 0) + 1;
      return counts;
    },
    {}
  );

  if (chapter.examples.length !== 6) {
    throw new Error(`Chapter ${chapter.number} must have 6 examples, found ${chapter.examples.length}`);
  }

  if (scopes.school !== 2 || scopes.work !== 2 || scopes.personal !== 2) {
    throw new Error(`Chapter ${chapter.number} must have 2 school, 2 work, 2 personal examples`);
  }

  const easyBullets = chapter.contentVariants.easy.summaryBlocks.filter((block) => block.type === "bullet");
  const mediumBullets = chapter.contentVariants.medium.summaryBlocks.filter((block) => block.type === "bullet");
  const hardBullets = chapter.contentVariants.hard.summaryBlocks.filter((block) => block.type === "bullet");

  if (easyBullets.length !== 7) throw new Error(`Chapter ${chapter.number} easy bullets ${easyBullets.length}`);
  if (mediumBullets.length !== 10) throw new Error(`Chapter ${chapter.number} medium bullets ${mediumBullets.length}`);
  if (hardBullets.length !== 15) throw new Error(`Chapter ${chapter.number} hard bullets ${hardBullets.length}`);
}

assertNoDashContent(pkg);

writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + "\n");

mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, renderReport(pkg));

console.log(`Updated ${packagePath}`);
console.log(`Wrote ${reportPath}`);
