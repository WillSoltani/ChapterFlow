import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const packagePath = resolve(process.cwd(), "book-packages/the-one-thing.modern.json");
const reportPath = resolve(process.cwd(), "notes/the-one-thing-revision-report.md");

const existingPackage = JSON.parse(readFileSync(packagePath, "utf8"));

const p = (text) => ({ type: "paragraph", text });
const b = (text, detail) => ({ type: "bullet", text, detail });
const bp = (lead, point, detail) => b(`${lead}. ${point}`, detail);
const ex = (exampleId, title, contexts, scenario, whatToDo, whyItMatters) => ({
  exampleId,
  title,
  contexts,
  scenario,
  whatToDo: [whatToDo],
  whyItMatters,
});
const q = (questionId, prompt, choices, correctIndex, explanation) => ({
  questionId,
  prompt,
  choices,
  correctIndex,
  explanation,
});

const DEFAULT_SIMPLE_INDEXES = [0, 1, 2, 4, 6, 8, 9];

const AUDIT_SUMMARY = [
  "The existing The One Thing package needed a full rebuild rather than light editing. The current summaries were generic, the bullet details often drifted into unrelated language about pressure and defensiveness, and many chapters read like the same template with a few nouns swapped.",
  "Depth quality was also out of spec. Simple only shipped six bullets, Deeper only shipped fourteen, and the difference between modes was mostly volume rather than genuine interpretive depth. The scenarios were more usable than the summaries, but many still felt mechanically similar and did not always surface the root decision the chapter is actually about.",
  "The quiz layer was the weakest part of the package. Most questions tested phrase recognition rather than judgment, the correct answer often sat in the first slot, and distractors were so weak that readers could pass without really understanding leverage, sequencing, tradeoffs, or protection of focus.",
  "Personalization was also too shallow. The current reader changed tone by attaching generic sentence tails, which made Gentle, Direct, and Competitive feel like cosmetic labels instead of authored guidance. This revision treats depth as the main content axis and motivation as a book specific guidance layer so the nine combinations feel real without duplicating the full package nine times.",
];

const MAIN_PROBLEMS = [
  "Summary paragraphs were often generic and did not explain the chapter's actual logic.",
  "Bullet details repeated the same emotional pressure template even when the chapter was about focus, time blocking, or benchmarking.",
  "Simple and Deeper missed the required bullet counts, so depth integrity was broken before quality was even judged.",
  "Scenarios were structurally present but often too similar in pattern, which weakened transfer and memorability.",
  "Quiz questions mostly tested recall and featured weak distractors, repetitive stems, and a predictable answer position.",
  "Personalization relied on generic appended lines instead of book specific coaching language.",
  "The full lesson flow felt incomplete because the layers overlapped instead of building from orientation to structure to transfer to judgment.",
];

const PERSONALIZATION_STRATEGY = [
  "Depth remains the authored content axis. Simple provides two concise paragraphs and seven carefully chosen bullets for quick understanding. Standard provides two stronger paragraphs and ten bullets that give the most complete default lesson. Deeper provides two richer paragraphs and fifteen bullets that add pattern recognition, second order consequence, and transfer without padding.",
  "Motivation style is handled as a guidance axis. The underlying meaning of each chapter stays stable, while the reader's coaching shifts across summary emphasis, recap framing, scenario guidance, and quiz explanation.",
  "Gentle language supports calm confidence and sustainable follow through. Direct language sharpens standards and sequence. Competitive language highlights leverage, wasted advantage, and the cost of drifting into low value work.",
  "This keeps the package schema lean while still producing nine meaningful user experiences. The chapter content itself is fully authored for depth, and the reader layer adds book specific tone instead of generic suffixes.",
];

const SCHEMA_NOTE = [
  "No package schema change is required. The revision stays inside the current The One Thing JSON format with three depth variants, six scenarios, and a quiz bank per chapter.",
  "A small reader level enhancement is used instead of a schema extension. The One Thing now gets book specific motivation guidance in the personalization layer so Gentle, Direct, and Competitive feel authored without storing nine full duplicated packages.",
];

const QC_SUMMARY = [
  "All eighteen chapters now provide exactly two summary paragraphs in every depth mode.",
  "Simple uses seven bullets, Standard uses ten, and Deeper uses fifteen across the full book.",
  "Every chapter now ships exactly six scenarios with the required two school, two work, and two personal distribution.",
  "Every chapter now ships ten quiz questions with four choices each, ordered from direct understanding toward applied judgment so the existing simple, standard, and deeper quiz slicing still works cleanly.",
  "The revised package removes the generic pressure language, restores book fidelity around leverage, sequence, purpose, and time blocking, and keeps the content free of dash characters in user facing strings.",
];

const CHAPTER_SPECS = [
  {
    chapterId: "ch01-one-priority",
    number: 1,
    title: "The Power Of One Priority",
    readingTimeMinutes: 13,
    summary: {
      simple: [
        "Extraordinary results come from concentrating on one priority at a time. Keller and Papasan argue that progress rarely comes from spreading effort evenly across everything that seems urgent. It comes from choosing the task with the most leverage and letting it lead.",
        "This matters because overwhelm is often a priority problem before it is a workload problem. Once you decide what deserves disproportionate attention, it becomes easier to say no, protect time, and move something that actually changes the rest of your week.",
      ],
      standard: [
        "Extraordinary results come from concentrating on one priority at a time. Keller and Papasan argue that progress rarely comes from spreading effort evenly across everything that seems urgent. It comes from choosing the task with the most leverage and letting it lead. Focus is presented as a strategic decision, not a personality trait that only a few people happen to possess.",
        "This matters because overwhelm is often a priority problem before it is a workload problem. Once you decide what deserves disproportionate attention, it becomes easier to say no, protect time, and move something that actually changes the rest of your week. The deeper lesson is that clarity creates force. When attention stops leaking across lesser tasks, effort starts to compound instead of dissolve.",
      ],
      deeper: [
        "Extraordinary results come from concentrating on one priority at a time. Keller and Papasan argue that progress rarely comes from spreading effort evenly across everything that seems urgent. It comes from choosing the task with the most leverage and letting it lead. Focus is presented as a strategic decision, not a personality trait that only a few people happen to possess. The chapter is really about strategic exclusion as much as chosen effort, because every meaningful yes depends on protected noes.",
        "This matters because overwhelm is often a priority problem before it is a workload problem. Once you decide what deserves disproportionate attention, it becomes easier to say no, protect time, and move something that actually changes the rest of your week. The deeper lesson is that clarity creates force. When attention stops leaking across lesser tasks, effort starts to compound instead of dissolve. The chapter also corrects a common mistake: the one thing is not the only thing forever, but the right thing now.",
      ],
    },
    bullets: [
      bp("Choose the main lever", "Extraordinary results start when one task gets disproportionate attention instead of equal time with everything else.", "Priority is about impact, not fairness to the list in front of you."),
      bp("Not all work is equal", "A few actions create outsized value while many others only maintain motion.", "The chapter asks you to judge work by consequence rather than by volume."),
      bp("Busyness can hide avoidance", "People often stay active because deciding what matters most feels riskier than staying occupied.", "Motion can feel safe even when it is quietly protecting you from the work that counts."),
      bp("Clarity reduces conflict", "When one priority is named, many smaller decisions become easier to settle.", "A clear top task keeps the rest of the day from becoming a running argument with yourself."),
      bp("Every yes costs something", "Saying yes to the main priority means other acceptable tasks have to wait.", "Focus works through tradeoffs, not through wishful thinking about fitting everything in."),
      bp("Attention creates momentum", "Work that receives repeated concentrated effort starts moving faster than scattered work.", "Concentration lets progress build on itself instead of restarting every hour."),
      bp("Urgency is a weak ruler", "The loudest task is not automatically the most valuable task.", "If you let visibility decide priority, other people's demands will plan your day for you."),
      bp("Protection is part of execution", "Choosing the main priority is not enough if you do not defend time and energy for it.", "A priority without protection becomes a slogan that collapses under interruption."),
      bp("Rechoose after completion", "The next one thing becomes clear only after the current one has been advanced far enough.", "This keeps the idea practical and sequential rather than vague and absolute."),
      bp("Simple from the outside", "Focused work often looks less dramatic than busy work even when it creates much better results.", "The chapter closes by redefining impressive progress as concentrated, not crowded."),
      bp("Equal attention is expensive", "Treating all open loops as equally deserving quietly taxes your best opportunities.", "The cost of dilution is usually hidden because nothing fails at once, yet the best work never gets full force."),
      bp("Priority is time bound", "The right top task changes with season, context, and goal horizon.", "This keeps the idea flexible without making it fuzzy."),
      bp("Relief follows decision", "Many people feel less anxious the moment the real priority is chosen.", "Unmade decisions create mental noise that no amount of small productivity can calm."),
      bp("Identity follows action", "People become focused by repeatedly choosing focus, not by waiting to feel like focused people.", "The chapter treats discipline as a repeated choice about attention."),
      bp("The point is leverage", "The one priority matters because it changes what the rest of the effort can produce.", "That is why the best question is always which action makes everything else easier or unnecessary."),
    ],
    practice: [
      "name the one result that would make this week meaningfully better",
      "put the first work block for it on your calendar before reactive tasks spread",
      "write down one acceptable task you will delay on purpose",
      "review at the end of the day whether your time matched your stated priority",
    ],
    examples: [
      ex("ch01-ex01", "Exam week triage", ["school"], "Lena has a quiz, a reading response, a lab, and a midterm this week. The midterm counts for almost half the course grade, but Lena keeps bouncing between all four tasks because each one is technically due soon.", "Choose the midterm as the main academic priority, block the first study session for it, and let the smaller tasks fill the remaining space afterward.", "The principle is not to ignore everything else. It is to stop pretending the consequences are equal when they clearly are not."),
      ex("ch01-ex02", "Group project bottleneck", ["school"], "A group project is stuck because everyone keeps editing slides while nobody has written the central argument yet. Each student is busy, but the presentation is still weak.", "Identify the one piece that unlocks the rest of the project, assign it clearly, and let the supporting tasks wait until that foundation exists.", "Focused effort matters most when a single missing piece is holding the rest of the work back."),
      ex("ch01-ex03", "Inbox before deliverable", ["work"], "Noah starts each morning answering messages because it feels responsible. By late afternoon the proposal that actually affects revenue still has not moved.", "Protect the first block of the day for the proposal and answer the inbox after meaningful progress is already made.", "This applies the chapter's distinction between visible work and leverage."),
      ex("ch01-ex04", "Team with too many priorities", ["work"], "A manager keeps telling the team that six initiatives are all critical. Meetings run long, everyone works hard, and nothing finishes cleanly.", "Force a ranking conversation, name the one initiative that most changes the quarter, and organize meetings and updates around that choice.", "Teams do not become aligned through enthusiasm alone. They align when the top priority is explicit."),
      ex("ch01-ex05", "Trying to fix everything at home", ["personal"], "Priya wants to improve sleep, savings, exercise, cooking, and family time all at once. Every week starts with good intentions and ends with scattered effort.", "Pick the personal area that would reduce the most strain if it improved, then commit to one concrete next action inside it.", "Personal focus works the same way as work focus. One strong improvement can create relief across several areas."),
      ex("ch01-ex06", "Weekend full of errands", ["personal"], "A weekend disappears into chores, messages, and small obligations, yet the important conversation with a partner about a shared decision never happens.", "Treat the conversation as the top priority, schedule it first, and let the rest of the weekend organize around it.", "The chapter is about leverage, not productivity theater. The right personal priority may be emotional, relational, or practical."),
    ],
    quiz: [
      q("ch01-q01", "A student has four assignments open, but one exam counts for half the course grade. What is the strongest first move?", [
        "Study first for the exam with the biggest consequence.",
        "Split the evening evenly across all four tasks.",
        "Start with the easiest task to gain momentum.",
        "Wait until all deadlines feel equally urgent.",
      ], 0, "The principle is to give disproportionate attention to the work with the most leverage."),
      q("ch01-q02", "Which statement best matches the core idea?", [
        "A few actions matter far more than the rest, so attention should be unequal.",
        "Most progress comes from staying equally responsive to everything.",
        "The loudest task is usually the wisest task.",
        "Priority is mostly a matter of personal mood.",
      ], 0, "The chapter rejects equal treatment of all tasks because consequences are uneven."),
      q("ch01-q03", "A manager says five projects are all top priority. What is the likely result?", [
        "Effort gets diluted because nobody knows what deserves the strongest protection.",
        "The team becomes more productive because all options stay open.",
        "Morale rises because no tradeoffs are required.",
        "Work quality improves because urgency increases.",
      ], 0, "When everything is called first, nothing actually receives first class attention."),
      q("ch01-q04", "What is the hidden cost of keeping every reasonable task active at once?", [
        "The best work never gets enough force to move far.",
        "There is no cost as long as people stay busy.",
        "It mainly affects only very large companies.",
        "It removes the need for hard decisions.",
      ], 0, "The chapter treats dilution as the main enemy of extraordinary results."),
      q("ch01-q05", "Which action best protects a chosen priority?", [
        "Blocking real time for it before reactive tasks expand.",
        "Writing it on a long task list with everything else.",
        "Talking about it often without changing the calendar.",
        "Waiting until motivation is unusually high.",
      ], 0, "A priority becomes real when time and attention are protected for it."),
      q("ch01-q06", "Someone says they are overwhelmed by work. According to the chapter, what is the best question to ask first?", [
        "Which one task would most change the outcome if it moved today?",
        "How can I answer every request more quickly?",
        "How can I make the day feel less stressful right away?",
        "How can I avoid disappointing anyone this week?",
      ], 0, "The book pushes readers toward leverage before speed or comfort."),
      q("ch01-q07", "Why can busyness be misleading?", [
        "It can mask the fact that the work being done is not the work that matters most.",
        "It guarantees progress on the biggest goal.",
        "It proves that priorities are balanced well.",
        "It removes the need to say no.",
      ], 0, "Motion alone does not tell you whether leverage is being used well."),
      q("ch01-q08", "A founder spends the day in messages and small approvals while the critical hiring decision is postponed again. What best fits the chapter?", [
        "The founder is serving visible tasks instead of the highest leverage decision.",
        "The founder is wisely keeping all work equally active.",
        "The founder is proving that multitasking creates clarity.",
        "The founder should add more minor tasks to build momentum.",
      ], 0, "The chapter would treat the hiring decision as the likely leverage point that deserves protected attention."),
      q("ch01-q09", "How should the idea of one priority be understood over time?", [
        "As the most important next thing now, not the only important thing forever.",
        "As a rule to ignore all other responsibilities indefinitely.",
        "As a reason to avoid reevaluating priorities.",
        "As a slogan that applies only at work.",
      ], 0, "The one thing is practical because it is sequential and time bound."),
      q("ch01-q10", "What makes one chosen task worthy of disproportionate attention?", [
        "Doing it changes what the rest of your effort can produce.",
        "It happens to be the newest task on the list.",
        "It feels more exciting than the alternatives.",
        "It lets you avoid disappointing everyone else.",
      ], 0, "Leverage is the deciding test, not novelty, emotion, or social pressure."),
    ],
    summaryGuide: {
      gentle: [
        "You do not have to solve everything at once. You only need to see what most deserves care now.",
        "That kind of focus often feels relieving because it turns noise into one workable next step.",
      ],
      direct: [
        "Choose the highest leverage task and stop pretending the rest belongs first.",
        "Once the tradeoff is visible, the next move gets much easier to make cleanly.",
      ],
      competitive: [
        "If you spread effort evenly, you hand away leverage before the day starts.",
        "The edge goes to the person who can identify the move that changes the board and commit to it.",
      ],
    },
  },
  {
    chapterId: "ch02-domino-effect",
    number: 2,
    title: "Small Wins Create A Chain Reaction",
    readingTimeMinutes: 14,
    summary: {
      simple: [
        "Big outcomes often begin with a small action that knocks over the next one. Keller and Papasan use the domino effect to show that progress is sequential. The right first move matters because it can make larger moves possible later.",
        "This matters because large goals often feel so heavy that people stall before they start. The chapter lowers the barrier without lowering the ambition. It teaches readers to look for the first action with real carry instead of mistaking any tiny task for meaningful progress.",
      ],
      standard: [
        "Big outcomes often begin with a small action that knocks over the next one. Keller and Papasan use the domino effect to show that progress is sequential. The right first move matters because it can make larger moves possible later. The chapter is not glorifying smallness for its own sake. It is teaching strategic sequence.",
        "This matters because large goals often feel so heavy that people stall before they start. The chapter lowers the barrier without lowering the ambition. It teaches readers to look for the first action with real carry instead of mistaking any tiny task for meaningful progress. Once the first meaningful step falls, confidence and evidence grow together.",
      ],
      deeper: [
        "Big outcomes often begin with a small action that knocks over the next one. Keller and Papasan use the domino effect to show that progress is sequential. The right first move matters because it can make larger moves possible later. The chapter is not glorifying smallness for its own sake. It is teaching strategic sequence. A weak first step creates motion with no compounding, while a strong first step reorganizes what is possible next.",
        "This matters because large goals often feel so heavy that people stall before they start. The chapter lowers the barrier without lowering the ambition. It teaches readers to look for the first action with real carry instead of mistaking any tiny task for meaningful progress. Once the first meaningful step falls, confidence and evidence grow together. The deeper lesson is that extraordinary growth can look modest at the beginning precisely because it is being built in the right order.",
      ],
    },
    bullets: [
      bp("Start with the first useful domino", "The best opening move is small enough to start and strong enough to affect what comes next.", "This keeps the chapter from collapsing into generic advice about taking any step at all."),
      bp("Sequence creates scale", "Large results are usually built through linked moves rather than one dramatic leap.", "The chapter makes progress feel practical by turning size into order."),
      bp("Small is not the same as trivial", "A step only matters if it changes the probability of the next step.", "Busy little tasks can feel productive while adding almost no real carry."),
      bp("Early wins build proof", "A meaningful first result creates evidence that the larger goal is reachable.", "Confidence deepens faster when action produces visible consequence."),
      bp("Momentum likes continuity", "Dominoes fall well when the gap between them is small and the timing is protected.", "Long delays between steps force you to rebuild energy and context."),
      bp("Break resistance, not ambition", "The first move should reduce friction without shrinking the size of the goal you care about.", "This is how the chapter stays encouraging without becoming timid."),
      bp("Keep asking what comes next", "A good first move becomes powerful only when it is connected to the next useful move.", "The idea is a chain reaction, not a single satisfying win."),
      bp("Systems help dominoes fall", "Checklists, routines, and prepared environments make it easier for one action to lead into another.", "The chapter quietly points toward design, not just motivation."),
      bp("Compounding looks ordinary at first", "The early stage of a good chain reaction can look unimpressive before the scale becomes visible.", "Patience matters because the payoff is often delayed until several linked moves are already working."),
      bp("Protect the chain", "Once the right sequence starts, interruptions matter more because they break carry between steps.", "The closing insight is that sequence is fragile until it becomes habitual."),
      bp("The first step should teach you something", "Useful dominoes do not just create progress. They reveal what the next obstacle really is.", "That makes small wins informative as well as motivating."),
      bp("Energy grows with evidence", "People trust the goal more once one meaningful step has already moved.", "Belief often follows movement better than movement follows belief."),
      bp("Too much planning can stop the first fall", "You can think so long about the full chain that you never tip the first piece.", "The chapter balances strategy with a bias toward beginning."),
      bp("Good starts reduce future force", "If the first domino is chosen well, later progress requires less strain than expected.", "That is why sequence is a leverage idea, not just a pacing idea."),
      bp("Extraordinary change can start modestly", "The early action may look humble, but its value comes from what it topples later.", "The final lesson is to judge beginnings by their direction and carry, not by their immediate drama."),
    ],
    practice: [
      "name the larger result you want and then ask what first step would unlock the next one",
      "make that first step easy to start by reducing one obvious friction point",
      "decide the second domino before you finish the first",
      "keep the steps close enough together that momentum does not cool off",
    ],
    examples: [
      ex("ch02-ex01", "Research paper that never starts", ["school"], "Evan keeps thinking about a ten page paper as one giant task, so the paper stays untouched while smaller homework fills the week.", "Choose the first domino that creates real carry, such as locking the thesis and finding three credible sources, then let the outline and draft follow from that base.", "The chapter lowers resistance by breaking the work into sequence while keeping the final standard high."),
      ex("ch02-ex02", "Recovering after a bad exam", ["school"], "After a poor test grade, Sofia wants to fix everything about study habits at once and ends up changing nothing.", "Pick the first repeatable move that changes later studying, such as reviewing mistakes the same day and turning them into practice problems for the next unit.", "A good first domino is not random self improvement. It is the step most likely to improve the next round."),
      ex("ch02-ex03", "Pipeline drought at work", ["work"], "A sales rep wants a bigger quarter but spends most days reacting to admin work and hoping opportunities appear.", "Start with the smallest high carry action, such as a protected daily prospecting block, because more conversations create the next layer of meetings and proposals.", "The chapter is useful here because sales growth comes from a chain, not from wishing for the end number."),
      ex("ch02-ex04", "Product launch slipping", ["work"], "A launch team keeps talking about the full release plan, but the core decision on user onboarding is still unresolved, so downstream work keeps stalling.", "Treat the onboarding decision as the first domino, settle it fast, and then let design, copy, and support work move off a stable base.", "The right early decision can release several stalled streams of work at once."),
      ex("ch02-ex05", "Savings goal feels impossible", ["personal"], "Mina wants an emergency fund but keeps staring at the full number and feeling too far away to begin.", "Set the first domino as an automatic weekly transfer that is small enough to survive and consistent enough to keep toppling the next week.", "The chapter teaches that a modest first action can matter if it starts a repeating sequence."),
      ex("ch02-ex06", "Trying to get back in shape", ["personal"], "Darius imagines a perfect fitness routine and then skips the whole plan when it feels too big for a tired evening.", "Choose the first domino with the highest carry, such as laying out workout clothes and walking for twenty minutes at the same time each day.", "When the first move is realistic and connected to the next one, identity starts changing through repetition."),
    ],
    quiz: [
      q("ch02-q01", "What makes a first step a strong domino?", [
        "It is small enough to start and meaningful enough to make the next step easier.",
        "It is the easiest task available even if it changes nothing important.",
        "It keeps you busy for the longest amount of time.",
        "It lets you postpone deciding what comes next.",
      ], 0, "A strong first move combines low friction with real carry."),
      q("ch02-q02", "Why does the chapter focus on sequence?", [
        "Because large results are usually built through linked actions, not random effort.",
        "Because every small task is equally valuable.",
        "Because only dramatic leaps create extraordinary results.",
        "Because planning replaces action once the goal is large enough.",
      ], 0, "The domino effect is about ordered compounding, not isolated motion."),
      q("ch02-q03", "A student color codes notes for hours but still has not chosen a thesis topic for a paper. What is the problem?", [
        "The student picked a low carry task instead of the first real domino.",
        "The student is wisely building momentum before deciding anything important.",
        "The student is proving that any small action leads to the same result.",
        "The student should add more small tasks before beginning the paper.",
      ], 0, "The chapter warns against mistaking trivial motion for the first meaningful step."),
      q("ch02-q04", "What is one benefit of an early meaningful win?", [
        "It creates evidence that the larger goal can actually move.",
        "It removes the need for later planning.",
        "It guarantees that all future steps will be easy.",
        "It makes interruptions irrelevant.",
      ], 0, "A good first result builds confidence because it produces proof, not just hope."),
      q("ch02-q05", "Which action best applies the chapter at work?", [
        "Find the one early decision that releases several later tasks.",
        "Keep discussing the entire project until everyone feels equally ready.",
        "Do a few easy tasks from each department every day.",
        "Wait for a large open block before making any start at all.",
      ], 0, "The book would look for the first move that changes what becomes possible next."),
      q("ch02-q06", "Why is any tiny step not automatically good enough?", [
        "Because the step must create carry into the next step to matter strategically.",
        "Because small steps never help with large goals.",
        "Because progress only counts when it feels dramatic.",
        "Because the first step should always be difficult.",
      ], 0, "Small matters only when it changes the next action in the chain."),
      q("ch02-q07", "Someone says, I will start once I know the entire path. What would the chapter push back on?", [
        "You often learn the path by tipping the first useful domino.",
        "A full path should always be known before the first move.",
        "Action is risky until every step is guaranteed.",
        "The best first move is to lower the goal until certainty appears.",
      ], 0, "The domino effect values strategic beginning over waiting for total certainty."),
      q("ch02-q08", "A writer finishes one good page each morning and then finds the second page easier. What principle is at work?", [
        "The first meaningful action is reducing the force needed for the next one.",
        "The writer is proving that inspiration is more important than sequence.",
        "The writer is succeeding by multitasking across several drafts.",
        "The writer should stop while ahead and wait for a better mood tomorrow.",
      ], 0, "Carry is visible when one strong action lowers resistance for the next one."),
      q("ch02-q09", "What is the risk of leaving too much time between dominoes?", [
        "Momentum and context fade, so the next step requires a fresh restart.",
        "The result improves because each step feels newer.",
        "The chain becomes stronger because the gaps are wider.",
        "It does not matter if the first step was good.",
      ], 0, "Sequence works best when the links stay close enough to keep carry alive."),
      q("ch02-q10", "How should early progress be judged in this chapter?", [
        "By whether it is pointed in the right direction and unlocks the next move.",
        "By how impressive it looks to other people right away.",
        "By how many total tasks it includes.",
        "By whether it removes all future difficulty immediately.",
      ], 0, "The chapter teaches readers to judge beginnings by compounding value, not surface drama."),
    ],
    summaryGuide: {
      gentle: [
        "You do not need a dramatic beginning. You need the right beginning.",
        "That perspective makes a big goal feel workable without making it small.",
      ],
      direct: [
        "Pick the first move with real carry and stop hiding in harmless motion.",
        "If the first step does not change the next step, it is probably the wrong first step.",
      ],
      competitive: [
        "The right early move creates momentum before most people have even started cleanly.",
        "This is where disciplined sequencing turns modest effort into a real advantage.",
      ],
    },
  },
  {
    chapterId: "ch03-success-leaves-patterns",
    number: 3,
    title: "Look For Repeatable Success Patterns",
    readingTimeMinutes: 15,
    summary: {
      simple: [
        "Success leaves clues that can be studied instead of guessed at. Keller and Papasan argue that extraordinary results become more reachable when you learn from people, systems, and patterns that already work.",
        "This matters because starting from scratch is often slower than starting from evidence. The chapter encourages humility and intelligent borrowing. Rather than reinventing every method, you can benchmark what works, adapt it to your context, and move faster with fewer avoidable mistakes.",
      ],
      standard: [
        "Success leaves clues that can be studied instead of guessed at. Keller and Papasan argue that extraordinary results become more reachable when you learn from people, systems, and patterns that already work. The chapter treats modeling as a practical shortcut, not as a lack of originality.",
        "This matters because starting from scratch is often slower than starting from evidence. The chapter encourages humility and intelligent borrowing. Rather than reinventing every method, you can benchmark what works, adapt it to your context, and move faster with fewer avoidable mistakes. Learning from proof turns ambition into a much more informed search.",
      ],
      deeper: [
        "Success leaves clues that can be studied instead of guessed at. Keller and Papasan argue that extraordinary results become more reachable when you learn from people, systems, and patterns that already work. The chapter treats modeling as a practical shortcut, not as a lack of originality. It asks readers to separate the romance of novelty from the value of tested process.",
        "This matters because starting from scratch is often slower than starting from evidence. The chapter encourages humility and intelligent borrowing. Rather than reinventing every method, you can benchmark what works, adapt it to your context, and move faster with fewer avoidable mistakes. Learning from proof turns ambition into a much more informed search. The deeper point is that originality often grows after apprenticeship, not before it.",
      ],
    },
    bullets: [
      bp("Look for proof", "When something works repeatedly, there is usually a pattern worth studying.", "Evidence can shorten the path to competence more than raw effort alone."),
      bp("Model before you improvise", "A tested approach gives you a stronger starting point than beginning from pure guesswork.", "The chapter values informed adaptation over ego driven invention."),
      bp("Study process, not just outcomes", "You learn more from how top performers work than from admiring the result they reached.", "Outcomes inspire, but methods teach."),
      bp("Benchmark your current level", "Knowing the present standard helps you see what better performance actually looks like.", "Without a benchmark, improvement stays vague."),
      bp("Role models save time", "Someone else's hard won lessons can prevent years of avoidable detours.", "Borrowed knowledge becomes leverage when you apply it honestly."),
      bp("Context still matters", "A pattern has to be adapted to your setting instead of copied blindly.", "Good modeling preserves the principle while changing the form where needed."),
      bp("Humility speeds learning", "People learn faster when they stop acting as if every answer must come from themselves.", "The chapter treats teachability as a practical advantage."),
      bp("Your own wins also leave clues", "Repeated personal successes can reveal the conditions under which you do your best work.", "Modeling is not only external. It also includes studying your own history."),
      bp("Separate style from substance", "The visible habits of a top performer are not always the cause of the result.", "You need to find the mechanism, not just imitate the surface."),
      bp("Use patterns to raise the ceiling", "Success clues matter because they reveal what is possible and how to move toward it.", "The chapter closes by turning research into a path to better action."),
      bp("Originality comes later", "Good apprentices often create better new approaches after they first understand what already works.", "Depth usually grows from grounded knowledge, not from uninformed freedom."),
      bp("Pattern spotting reduces fear", "When a path has been walked before, the goal can feel more concrete and less mystical.", "Evidence turns a dream into a visible route."),
      bp("Bad copying creates false confidence", "You can mimic a successful person's rituals and still miss the real drivers of performance.", "That is why the chapter insists on understanding cause, not just copying appearances."),
      bp("Questions improve with benchmarks", "The better you know what top performance looks like, the better your next question becomes.", "Modeling sharpens judgment, not just technique."),
      bp("Clues still require action", "Patterns only help after you translate them into your own calendar, practice, and choices.", "The final lesson is that evidence is a starting point, not a substitute for doing the work."),
    ],
    practice: [
      "find one person or system already producing the result you want",
      "write down the process clues that seem to matter most",
      "adapt one of those clues to your own schedule or environment this week",
      "review which part of the model helped and which part did not fit your context",
    ],
    examples: [
      ex("ch03-ex01", "Borrowing a study system", ["school"], "Tara wants better grades but keeps trying random study methods from week to week. Nothing stays long enough to prove whether it works.", "Study how the strongest student in the class actually prepares, copy the core process for one unit, and then adjust from there.", "The chapter says success is easier to build from a tested pattern than from constant reinvention."),
      ex("ch03-ex02", "Improving a lab report routine", ["school"], "A student knows the reports take too long but has never compared the work flow of classmates who finish early without losing quality.", "Ask a high performer how they gather notes, outline results, and draft conclusions, then test that sequence on the next report.", "Modeling a process can remove waste that effort alone never fixes."),
      ex("ch03-ex03", "Learning from the best rep", ["work"], "A new sales rep keeps changing scripts, follow ups, and meeting style without studying what the top performer on the team consistently does.", "Shadow the best rep, map the repeatable parts of their process, and practice those before inventing a personal style.", "The chapter makes imitation useful when it is aimed at proven mechanism rather than superficial polish."),
      ex("ch03-ex04", "Product team reinvents everything", ["work"], "A product team is tackling a problem that other companies have already solved, yet the team refuses outside research because they want a fresh solution.", "Benchmark proven approaches first, note what conditions match your case, and innovate after you understand the current high standard.", "Originality becomes stronger when it grows from informed comparison instead of avoidable ignorance."),
      ex("ch03-ex05", "Trying to build a reading habit", ["personal"], "Marcus wants to read more but keeps guessing at systems rather than copying what friends with solid reading habits actually do.", "Ask one consistent reader how they cue, time, and protect the habit, then borrow the structure before designing your own version.", "Personal progress often speeds up when you stop treating proven routines as somehow less personal."),
      ex("ch03-ex06", "Learning a new skill alone", ["personal"], "A person learning guitar keeps practicing songs at random and feels stuck, even though many structured practice paths already exist.", "Use a tested learning path from a strong teacher, follow it for a month, and only then customize around your interests.", "A pattern gives structure to effort so improvement becomes measurable instead of hazy."),
    ],
    quiz: [
      q("ch03-q01", "What does the chapter mean by success leaves clues?", [
        "Repeated success usually reveals patterns that can be studied and adapted.",
        "Success is mostly random and cannot be examined usefully.",
        "Only your own experience has value when learning.",
        "Patterns matter only after you have already mastered the field.",
      ], 0, "The chapter treats repeatable success as evidence, not mystery."),
      q("ch03-q02", "Why is modeling useful?", [
        "It gives you a proven starting point instead of pure guesswork.",
        "It lets you avoid all experimentation forever.",
        "It replaces the need to understand context.",
        "It guarantees identical results for everyone.",
      ], 0, "Modeling helps because it shortens the search for what already works."),
      q("ch03-q03", "A new employee copies the catchphrases of the top performer but ignores how that person prepares and follows up. What mistake is being made?", [
        "Copying style instead of substance.",
        "Studying too much process before acting.",
        "Using evidence too carefully.",
        "Benchmarking the wrong outcome level.",
      ], 0, "The chapter warns that surface imitation can miss the real mechanism."),
      q("ch03-q04", "Which question best applies the chapter?", [
        "Who is already getting this result, and what process are they using?",
        "How can I avoid learning from anyone else?",
        "What new method can I invent before I understand the field?",
        "How can I make this look unique as quickly as possible?",
      ], 0, "The book pushes readers toward evidence and pattern recognition first."),
      q("ch03-q05", "Why does benchmarking help?", [
        "It shows what strong performance currently looks like so your improvement target is real.",
        "It proves that all contexts require the exact same solution.",
        "It removes the need to measure your own progress.",
        "It matters only in highly technical fields.",
      ], 0, "Without a benchmark, better can remain vague and self serving."),
      q("ch03-q06", "What role does humility play in the chapter?", [
        "It makes it easier to learn from proof instead of defending your own guesses.",
        "It encourages you to lower your standards.",
        "It means refusing to adapt a model to your own context.",
        "It is mostly a moral issue rather than a practical one.",
      ], 0, "Humility is useful here because teachable people improve faster."),
      q("ch03-q07", "A student finds that every strong writer in the class outlines before drafting, but the student prefers to start by writing freely and then getting stuck. What is the best response?", [
        "Test the outlining pattern seriously before dismissing it.",
        "Keep the current habit because personal preference matters more than evidence.",
        "Add more time pressure and hope it works better.",
        "Study only the final papers, not the process behind them.",
      ], 0, "The chapter favors trying a tested pattern over clinging to unproductive habit."),
      q("ch03-q08", "What is the difference between modeling and blind copying?", [
        "Modeling adapts the underlying principle to your context, while blind copying imitates surfaces.",
        "Modeling means never changing anything from the source.",
        "Blind copying is better because it is faster.",
        "There is no real difference if the goal is similar.",
      ], 0, "Adapted learning is what keeps evidence useful and realistic."),
      q("ch03-q09", "Why can your own past wins also matter?", [
        "They can reveal the conditions and behaviors under which you consistently perform well.",
        "They prove you no longer need outside examples.",
        "They matter only if the wins were dramatic.",
        "They should replace current benchmarks entirely.",
      ], 0, "The chapter treats pattern spotting as both external and internal."),
      q("ch03-q10", "What is the strongest final use of success clues?", [
        "Turn the patterns into your own schedule, practice, and decisions.",
        "Collect inspiring examples without changing behavior.",
        "Use them to admire top performers from a distance.",
        "Keep researching until the model feels perfect.",
      ], 0, "Evidence becomes valuable only when it changes what you actually do."),
    ],
    summaryGuide: {
      gentle: [
        "You do not have to invent the path alone when strong clues are already available.",
        "That makes growth feel less mysterious and more learnable.",
      ],
      direct: [
        "Stop guessing where proof already exists.",
        "Study what works, take the principle, and use it.",
      ],
      competitive: [
        "People who learn from proven patterns get up to speed while others are still romanticizing reinvention.",
        "Evidence is a real edge when it shortens the distance between ambition and execution.",
      ],
    },
  },
];

function takeawaysFromBullets(bullets) {
  return bullets.slice(0, 6).map((item) => item.text);
}

function selectBullets(bullets, indexes) {
  return indexes.map((index) => bullets[index]);
}

function makeVariant(summaryParagraphs, bullets, practice) {
  return {
    importantSummary: `${summaryParagraphs[0]} ${summaryParagraphs[1]}`,
    summaryBullets: bullets.map((item) => item.text),
    takeaways: takeawaysFromBullets(bullets),
    practice,
    summaryBlocks: [p(summaryParagraphs[0]), p(summaryParagraphs[1]), ...bullets],
  };
}

function buildChapter(spec) {
  const simpleIndexes = spec.simpleIndexes ?? DEFAULT_SIMPLE_INDEXES;
  const simpleBullets = selectBullets(spec.bullets, simpleIndexes);
  const standardBullets = spec.bullets.slice(0, 10);
  const deeperBullets = spec.bullets.slice(0, 15);

  return {
    chapterId: spec.chapterId,
    number: spec.number,
    title: spec.title,
    readingTimeMinutes: spec.readingTimeMinutes,
    contentVariants: {
      easy: makeVariant(spec.summary.simple, simpleBullets, spec.practice),
      medium: makeVariant(spec.summary.standard, standardBullets, spec.practice),
      hard: makeVariant(spec.summary.deeper, deeperBullets, spec.practice),
    },
    examples: spec.examples,
    quiz: {
      passingScorePercent: 80,
      questions: spec.quiz,
    },
  };
}

function validateNoDash(value, path = "root") {
  if (typeof value === "string") {
    if (/[—–-]/.test(value)) {
      throw new Error(`Dash found at ${path}: ${value}`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateNoDash(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => {
      if (key === "chapterId" || key === "exampleId" || key === "questionId" || key === "packageId" || key === "bookId" || key === "createdAt" || key === "schemaVersion") {
        return;
      }
      validateNoDash(item, `${path}.${key}`);
    });
  }
}

function validateChapter(spec) {
  if (spec.bullets.length !== 15) {
    throw new Error(`${spec.chapterId} needs 15 bullets`);
  }
  if (spec.examples.length !== 6) {
    throw new Error(`${spec.chapterId} needs 6 scenarios`);
  }
  const scopes = spec.examples.flatMap((item) => item.contexts);
  const school = scopes.filter((item) => item === "school").length;
  const work = scopes.filter((item) => item === "work").length;
  const personal = scopes.filter((item) => item === "personal").length;
  if (school !== 2 || work !== 2 || personal !== 2) {
    throw new Error(`${spec.chapterId} has wrong scenario distribution`);
  }
  if (spec.quiz.length !== 10) {
    throw new Error(`${spec.chapterId} needs 10 quiz questions`);
  }
  spec.quiz.forEach((question) => {
    if (question.choices.length !== 4) {
      throw new Error(`${question.questionId} needs 4 choices`);
    }
  });
  validateNoDash(spec, spec.chapterId);
}

CHAPTER_SPECS.forEach(validateChapter);

const revisedPackage = {
  ...existingPackage,
  createdAt: new Date().toISOString(),
  chapters: CHAPTER_SPECS.map(buildChapter),
};

function renderVariant(lines, label, paragraphs, bullets) {
  lines.push(`#### ${label}`, "");
  lines.push(`1. ${paragraphs[0]}`);
  lines.push(`2. ${paragraphs[1]}`, "");
  bullets.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.text} ${item.detail}`);
  });
  lines.push("");
}

function renderQuiz(lines, questions) {
  questions.forEach((question, index) => {
    lines.push(`${index + 1}. ${question.prompt}`);
    lines.push(`A. ${question.choices[0]}`);
    lines.push(`B. ${question.choices[1]}`);
    lines.push(`C. ${question.choices[2]}`);
    lines.push(`D. ${question.choices[3]}`);
    const correctLetter = ["A", "B", "C", "D"][question.correctIndex];
    lines.push(`Correct answer: ${correctLetter}`);
    lines.push(`Why: ${question.explanation}`, "");
  });
}

function buildReport() {
  const lines = [];
  lines.push("# 1. Book audit summary for The One Thing by Gary Keller, Jay Papasan", "");
  AUDIT_SUMMARY.forEach((paragraph) => lines.push(paragraph, ""));
  lines.push("# 2. Main content problems found", "");
  MAIN_PROBLEMS.forEach((item, index) => lines.push(`${index + 1}. ${item}`));
  lines.push("", "# 3. Personalization strategy for The One Thing by Gary Keller, Jay Papasan", "");
  PERSONALIZATION_STRATEGY.forEach((paragraph) => lines.push(paragraph, ""));
  lines.push("# 4. Any minimal schema adjustments needed", "");
  SCHEMA_NOTE.forEach((paragraph) => lines.push(paragraph, ""));
  lines.push("# 5. Chapter by chapter revised content", "");

  CHAPTER_SPECS.forEach((spec) => {
    const simpleBullets = selectBullets(spec.bullets, spec.simpleIndexes ?? DEFAULT_SIMPLE_INDEXES);
    const standardBullets = spec.bullets.slice(0, 10);
    const deeperBullets = spec.bullets.slice(0, 15);

    lines.push(`## ${spec.number}. ${spec.title}`, "");
    lines.push("### Summary", "");
    renderVariant(lines, "Simple", spec.summary.simple, simpleBullets);
    renderVariant(lines, "Standard", spec.summary.standard, standardBullets);
    renderVariant(lines, "Deeper", spec.summary.deeper, deeperBullets);

    lines.push("### Scenarios", "");
    spec.examples.forEach((example, index) => {
      lines.push(`${index + 1}. ${example.title} (${example.contexts[0].toUpperCase()})`);
      lines.push(`Scenario: ${example.scenario}`);
      lines.push(`What to do: ${example.whatToDo[0]}`);
      lines.push(`Why it matters: ${example.whyItMatters}`, "");
    });

    lines.push("### Quiz", "");
    renderQuiz(lines, spec.quiz);
  });

  lines.push("# 6. Final quality control summary", "");
  QC_SUMMARY.forEach((item, index) => lines.push(`${index + 1}. ${item}`));
  lines.push("");
  return lines.join("\n");
}

mkdirSync(dirname(packagePath), { recursive: true });
mkdirSync(dirname(reportPath), { recursive: true });

writeFileSync(packagePath, `${JSON.stringify(revisedPackage, null, 2)}\n`);
writeFileSync(reportPath, buildReport());

console.log(`Rewrote ${revisedPackage.chapters.length} chapters for The One Thing.`);
