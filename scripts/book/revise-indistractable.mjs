import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";

const packagePath = resolve(process.cwd(), "book-packages/indistractable.modern.json");
const reportPath = resolve(process.cwd(), "notes/indistractable-revision-report.md");

const t = (base, balanced = "", deep = "") => ({ base, balanced, deep });

const compose = (value, level) =>
  [value.base, level !== "easy" ? value.balanced : "", level === "hard" ? value.deep : ""]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

const bullet = (text, base, balanced = "", deep = "") => ({
  text,
  detail: t(base, balanced, deep),
});

const example = (exampleId, title, contexts, scenario, whatToDo, whyItMatters) => ({
  exampleId,
  title,
  contexts,
  scenario,
  whatToDo,
  whyItMatters,
});

function rotateQuestionChoices(choices, correctIndex, seed) {
  const shift = seed % choices.length;
  if (shift === 0) {
    return { choices, correctIndex };
  }
  const rotated = choices.map((_, index) => choices[(index + shift) % choices.length]);
  const nextCorrectIndex = (correctIndex - shift + choices.length) % choices.length;
  return { choices: rotated, correctIndex: nextCorrectIndex };
}

const question = (questionId, prompt, choices, correctIndex, explanation) => {
  const seed = Array.from(questionId).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const rotated = rotateQuestionChoices(choices, correctIndex, seed);
  return {
    questionId,
    prompt: sanitizePrompt(prompt),
    choices: rotated.choices,
    correctIndex: rotated.correctIndex,
    explanation,
  };
};

const sanitizePrompt = (value) =>
  value
    .replace(/\bthis chapter's\b/gi, "this idea")
    .replace(/\bthis chapter\b/gi, "this idea")
    .replace(/\bthe chapter\b/gi, "the idea")
    .replace(/\s+/g, " ")
    .trim();

const DEFAULT_SIMPLE_INDEXES = [0, 1, 2, 4, 6, 8, 9];

const AUDIT_SUMMARY = [
  "The existing Indistractable package was structurally complete enough to load, but the actual learning content was not publishable. It reused one generic writing template across summaries, bullets, scenarios, and quizzes, which made many chapters feel like renamed copies instead of distinct lessons from Nir Eyal's book.",
  "The summaries repeated stock framing, the second summary paragraph barely changed from chapter to chapter, and the bullet details recycled the same emotional pressure language even when the chapter was about calendars, meetings, email, family rules, or intimacy. That flattened the book's real logic into vague advice about reacting under pressure.",
  "Scenario coverage technically hit six examples per chapter, but the examples followed the same order and same pattern every time, often ending with the same explanation tag. They showed little chapter specific transfer and often treated school, work, and personal life as cosmetic swaps rather than genuinely different environments.",
  "The quiz layer was the weakest part. All thirty five chapters used ten base questions with the correct answer in the first slot every time, reused the same five prompt shells across the whole book, and often tested slogan recall instead of applied understanding. The result was predictable, shallow, and easy to game.",
  "Depth and motivation personalization were also weak. Simple used six bullets instead of about seven, Deeper used fourteen instead of fifteen, and the writing quality difference between modes was too small. Motivation style existed mostly as generic sentence tails in the reader, not as meaningful book specific coaching.",
];

const MAIN_PROBLEMS = [
  "Summaries were repetitive, vague, and often failed to explain the real chapter argument.",
  "Bullet details reused the same stock language across unrelated chapters, which broke fidelity and made the book feel machine made.",
  "Scenarios were formulaic and often only changed setting labels while keeping the same lesson structure underneath.",
  "Quiz prompts and answer patterns were mechanically repeated, with every base question using the first choice as correct.",
  "Depth variation missed the required bullet counts and did not create a genuinely better Standard mode or a genuinely deeper Deeper mode.",
  "Motivation style for Indistractable was not authored around the book's calm but disciplined logic about attention, discomfort, boundaries, and precommitment.",
  "The whole learning flow felt like four adjacent blocks instead of one designed lesson that moves from orientation to transfer to understanding checks.",
];

const PERSONALIZATION_STRATEGY = [
  "Depth stays as the authored content axis inside the package. Simple gives two clear summary paragraphs and seven high signal bullets for fast understanding. Standard gives the strongest default lesson with ten more developed bullets. Deeper keeps the same core truth but adds five real insights about tradeoffs, hidden patterns, and transfer rather than padding.",
  "Motivation stays as a lean runtime layer rather than duplicating nine full book files. Indistractable now gets a book specific tone system in the reader so Gentle sounds calm and steady, Direct sounds disciplined and practical, and Competitive highlights edge, drift, and opportunity cost when the chapter naturally supports that frame.",
  "That tone layer changes summary framing, scenario guidance, recap language, and quiz explanations while leaving the chapter meaning stable. The user experience changes meaningfully across the nine combinations without bloating the package or risking version drift between duplicated variants.",
  "Because Indistractable moves through distinct sections such as internal triggers, traction, external triggers, pacts, workplace culture, and family life, the motivation layer is designed around those sections instead of one generic book wide phrase bank.",
];

const SCHEMA_NOTE =
  "No package schema change is required. The revision stays inside the current JSON package contract. Depth is fully authored in the package, and motivation style is strengthened through a book specific reader transform rather than by storing nine duplicated package versions.";

function chapter({
  chapterId,
  number,
  title,
  readingTimeMinutes,
  summary,
  standardBullets,
  deeperBullets,
  simpleIndexes = DEFAULT_SIMPLE_INDEXES,
  takeaways,
  practice,
  examples,
  questions,
}) {
  if (standardBullets.length !== 10) {
    throw new Error(`Chapter ${number} needs exactly 10 standard bullets.`);
  }
  if (deeperBullets.length !== 5) {
    throw new Error(`Chapter ${number} needs exactly 5 deeper bullets.`);
  }
  if (simpleIndexes.length !== 7) {
    throw new Error(`Chapter ${number} needs exactly 7 simple bullet indexes.`);
  }
  if (examples.length !== 6) {
    throw new Error(`Chapter ${number} needs exactly 6 scenarios.`);
  }
  if (questions.length !== 10) {
    throw new Error(`Chapter ${number} needs exactly 10 questions.`);
  }

  const easyBullets = simpleIndexes.map((index) => standardBullets[index]);
  const hardBullets = [...standardBullets, ...deeperBullets];

  return {
    chapterId,
    number,
    title,
    readingTimeMinutes,
    contentVariants: Object.fromEntries(
      ["easy", "medium", "hard"].map((level) => {
        const paragraphOne = compose(summary.p1, level);
        const paragraphTwo = compose(summary.p2, level);
        const levelBullets =
          level === "easy" ? easyBullets : level === "medium" ? standardBullets : hardBullets;

        return [
          level,
          {
            importantSummary: `${paragraphOne} ${paragraphTwo}`.trim(),
            summaryBullets: levelBullets.map((item) => item.text),
            takeaways,
            practice,
            summaryBlocks: [
              { type: "paragraph", text: paragraphOne },
              { type: "paragraph", text: paragraphTwo },
              ...levelBullets.map((item) => ({
                type: "bullet",
                text: item.text,
                detail: compose(item.detail, level),
              })),
            ],
          },
        ];
      })
    ),
    examples,
    quiz: {
      passingScorePercent: 80,
      questions,
    },
  };
}

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

const CHAPTER_REVISIONS = [
  chapter({
    chapterId: "ch01-superpower-of-attention",
    number: 1,
    title: "Attention Is The Real Superpower",
    readingTimeMinutes: 13,
    summary: {
      p1: t(
        "Attention is the real superpower because your life follows what you repeatedly give your mind to, not what you merely claim to value.",
        "Eyal uses that claim to define indistractability as doing what you planned instead of what steals the moment.",
        "That makes attention a practical discipline of alignment between values and behavior, not a vague wish to feel more focused."
      ),
      p2: t(
        "This matters because distraction is not just a technology problem. It is a behavior problem shaped by discomfort, cues, and the systems around you.",
        "Once you see that, the solution becomes broader than willpower: shape time, reduce triggers, and protect future intent before the urge arrives.",
        "The deeper lesson is that attention is a life allocation problem. What wins your minutes eventually wins your work, relationships, and self respect."
      ),
    },
    standardBullets: [
      bullet(
        "Attention is the asset. Where your attention goes, your days and identity slowly follow.",
        "Focus matters because repeated attention becomes repeated action.",
        "What feels small in the moment compounds into habits, reputation, and results.",
        "That is why guarding attention is less about one productive hour and more about the kind of life you are rehearsing."
      ),
      bullet(
        "Traction and distraction are opposites. Both are actions, but only one serves what you intended.",
        "The distinction turns distraction from a mood into a measurable mismatch between plan and behavior.",
        "That clarity matters because you can only fix drift when you know what the right direction was.",
        "Without a chosen direction, almost any impulse can pretend to be reasonable."
      ),
      bullet(
        "Distraction is broader than screens. Anything can be a distraction if it pulls you from planned traction.",
        "A conversation, a browser tab, a snack, or a task that feels useful can still be off course.",
        "This widens the book beyond device blame and forces a more honest diagnosis.",
        "It also protects you from the comforting lie that deleting one app solves a deeper problem."
      ),
      bullet(
        "Willpower is too narrow. Focus improves when calendars, tools, and norms support it.",
        "People drift less when the environment makes the intended action easier to continue.",
        "That is why the book keeps returning to design, not just determination.",
        "Reliable follow through usually comes from systems that reduce the number of vulnerable moments."
      ),
      bullet(
        "Internal triggers matter first. Many distractions begin as attempts to escape boredom, anxiety, or uncertainty.",
        "The urge often feels like a response to the outside world when it actually starts inside.",
        "Seeing that changes the target from blaming the device to understanding the feeling.",
        "If the discomfort stays unnamed, the next external trigger will keep finding an easy opening."
      ),
      bullet(
        "External triggers still count. Notifications, people, and clutter amplify drift when the mind is already vulnerable.",
        "A cue is more powerful when it arrives during friction, ambiguity, or fatigue.",
        "That means trigger reduction is not trivial housekeeping. It is decision protection.",
        "Good environments do not remove all temptation, but they stop making every weak moment easier to lose."
      ),
      bullet(
        "Values need visible expression. If something matters, it should appear in time and behavior, not only in ideals.",
        "Attention follows what has been concretely chosen, not what has been vaguely admired.",
        "That is why later chapters move from values to calendars and boundaries.",
        "An unscheduled value is easy to praise and easy to abandon."
      ),
      bullet(
        "Pacts protect future intention. Constraints are smart when they keep short term urges from taking over.",
        "A pact matters because it reduces the number of times you have to negotiate with temptation in real time.",
        "That is not weakness. It is an honest response to predictable human behavior.",
        "Strong systems assume future vulnerability and plan for it instead of feeling surprised by it."
      ),
      bullet(
        "Attention is social. Other people's expectations can either defend or destroy your focus.",
        "Meetings, messages, and relationship habits shape what feels interruptible.",
        "That makes indistractability partly a coordination skill, not just a private one.",
        "If the people around you expect instant access at all times, private discipline alone will keep losing ground."
      ),
      bullet(
        "The real question is simple. Do your actions match what you meant to do.",
        "That question turns attention from a personality test into a daily practice of alignment.",
        "It also keeps the book practical because it asks for evidence, not self flattering intention.",
        "Once you start measuring that gap honestly, the rest of the method has somewhere real to work."
      ),
    ],
    deeperBullets: [
      bullet(
        "Small leaks become life patterns. A tiny escape repeated many times can quietly become your default relationship with discomfort.",
        "The danger of distraction is rarely one dramatic failure. It is slow erosion.",
        "That is why indistractability needs to be trained in ordinary moments, not only during big deadlines."
      ),
      bullet(
        "Feeling busy can hide being distracted. Motion is not proof that attention is serving what matters most.",
        "Many people replace meaningful traction with urgent looking activity.",
        "The deeper risk is confusing responsiveness with progress until the calendar is full and the real work is still untouched."
      ),
      bullet(
        "Tools are rarely the full villain. Technology becomes dangerous when it meets unmet emotional needs and weak defaults.",
        "That more precise view prevents shallow solutions and points toward better design.",
        "It also explains why two people can use the same tool and get very different outcomes."
      ),
      bullet(
        "Indistractability is learned before it is felt. You usually build it through structure first and confidence later.",
        "Waiting to feel disciplined before acting is backwards.",
        "People often gain the identity of being focused only after they have repeatedly used systems that helped them stay on course."
      ),
      bullet(
        "Guard attention to guard a life. Attention is not just a productivity resource. It is the medium through which you experience everything you care about.",
        "That is what gives the book moral weight without turning it into moralizing.",
        "Losing attention too cheaply means losing presence too cheaply."
      ),
    ],
    takeaways: [
      "Attention shapes life",
      "Traction needs intention",
      "Distraction is broader than tech",
      "Triggers matter inside and outside",
      "Systems beat raw willpower",
      "Alignment is the real test",
    ],
    practice: [
      "Write down one thing that deserves your best attention this week",
      "Notice one recurring internal trigger before you obey it",
      "Remove one obvious external trigger from your work area",
      "Schedule one block for something you say matters",
      "Ask whether one recent action served traction or distraction",
    ],
    examples: [
      example(
        "ch01-ex01",
        "Study block with no real target",
        ["school"],
        "A student sits down to study, opens several tabs, checks messages between readings, and ends the hour feeling busy but unsure what actually moved forward.",
        [
          "Decide what traction means before you begin, such as finishing one problem set section or reviewing one lecture outline.",
          "Clear the extra tabs and keep only what serves that chosen task."
        ],
        "This matters because attention cannot be protected when the target stays vague. Defining traction first makes distraction visible instead of letting it hide inside activity."
      ),
      example(
        "ch01-ex02",
        "Club leader pulled in every direction",
        ["school"],
        "A student running a campus event spends the afternoon jumping between design edits, chat replies, volunteer questions, and social posts, then realizes the venue request was never sent.",
        [
          "Name the one action that most directly moves the event forward and finish it before handling the smaller inputs.",
          "Use a short focus block so the urgent looking requests do not crowd out the important one."
        ],
        "The lesson is that attention has to be allocated on purpose. Without that choice, the loudest input often wins over the most consequential one."
      ),
      example(
        "ch01-ex03",
        "Inbox first workday",
        ["work"],
        "An analyst starts each morning in email and chat because it feels responsible, but the work that actually requires thought keeps getting pushed into a rushed final hour.",
        [
          "Protect one early block for the work that matters most before opening channels designed to react to other people.",
          "Treat communication as one part of the job, not as the whole agenda."
        ],
        "This shows that attention is a business asset, not just a personal virtue. If reactive work always comes first, real traction gets whatever energy is left."
      ),
      example(
        "ch01-ex04",
        "Helpful coworker with no boundaries",
        ["work"],
        "A teammate prides herself on being available, so she says yes to every quick request and interruption. By the end of the week she has helped everyone and missed her own deadline.",
        [
          "Separate being supportive from being permanently interruptible.",
          "Set times when you can help others and times when your main job is to protect the task you already committed to."
        ],
        "Attention is social, so boundary setting is part of doing reliable work. Generosity without structure often turns into scattered effort."
      ),
      example(
        "ch01-ex05",
        "Dinner with a half present mind",
        ["personal"],
        "Someone keeps glancing at their phone during dinner because nothing seems urgent enough to justify a full stop, yet the conversation with their partner never becomes fully engaged.",
        [
          "Treat shared time as traction if that is what you meant to be doing.",
          "Put the phone out of reach so presence does not depend on constant self correction."
        ],
        "The chapter applies outside work because attention is how care is felt. If you do not protect it, the people you value receive leftovers."
      ),
      example(
        "ch01-ex06",
        "Weekend plans dissolved by drift",
        ["personal"],
        "A person says the weekend is for rest and a personal project, but the days disappear into random browsing, errands, and low value tasks that were never chosen intentionally.",
        [
          "Plan what real rest and real progress will look like before the weekend starts.",
          "Make the chosen activities easier to begin than the default drift."
        ],
        "This matters because distraction often wins when nothing meaningful has been defined first. Attention does not protect itself in open space."
      ),
    ],
    questions: [
      question(
        "ch01-q01",
        "Which choice best captures why attention is treated as a superpower?",
        [
          "It lets you ignore every unpleasant emotion",
          "It decides what repeatedly receives your time and effort",
          "It makes planning unnecessary",
          "It turns every interruption into a useful signal",
        ],
        1
      ),
      question(
        "ch01-q02",
        "A student says social media is the problem, but he never decides what he plans to do before opening his laptop. What is the deeper issue?",
        [
          "He has not defined traction clearly enough to spot distraction",
          "He should trust motivation to appear once he starts",
          "He needs more apps that block every website",
          "He should switch tasks more often to stay interested",
        ],
        0
      ),
      question(
        "ch01-q03",
        "Which action best reflects the book's opening logic?",
        [
          "Removing all technology from daily life",
          "Waiting until you feel disciplined before making changes",
          "Designing time and environment so intended actions are easier to continue",
          "Trying harder each time you get off track",
        ],
        2
      ),
      question(
        "ch01-q04",
        "Someone answers every message immediately and calls it productivity. What would Eyal most likely say?",
        [
          "Responsiveness is always traction",
          "If the behavior was not what they planned, it may still be distraction",
          "Speed matters more than intention",
          "Communication cannot count as distraction",
        ],
        1
      ),
      question(
        "ch01-q05",
        "Why does the chapter connect focus to relationships as well as work?",
        [
          "Because attention shapes presence wherever it is spent",
          "Because relationships are less demanding than work",
          "Because only personal life creates distraction",
          "Because planning matters only outside the office",
        ],
        0
      ),
      question(
        "ch01-q06",
        "Which statement best fits the role of pacts in the opening framework?",
        [
          "They are signs that a person lacks discipline",
          "They matter only after all internal triggers disappear",
          "They help protect future intention from predictable short term urges",
          "They work only for children",
        ],
        2
      ),
      question(
        "ch01-q07",
        "A manager complains that her team is always interrupting her, but she answers every ping within seconds and never signals focus time. What is the most useful interpretation?",
        [
          "Attention is partly social, so norms and expectations are shaping the problem",
          "Her team is the only thing that needs to change",
          "Interruptions do not affect meaningful work",
          "The best fix is to work longer at night",
        ],
        0
      ),
      question(
        "ch01-q08",
        "Which option is most consistent with the idea that distraction is broader than screens?",
        [
          "Only entertainment tools count as distractions",
          "A useful looking task can still be distraction if it pulls you from your chosen priority",
          "Any difficult task is automatically traction",
          "If a task feels urgent, it should replace the plan",
        ],
        1
      ),
      question(
        "ch01-q09",
        "Why is willpower alone an incomplete answer to distraction?",
        [
          "Because emotions do not exist during focused work",
          "Because environment, triggers, and social expectations also shape behavior",
          "Because planning is less important than personality",
          "Because discipline always creates rigidity",
        ],
        1
      ),
      question(
        "ch01-q10",
        "What is the simplest test for whether a behavior is serving you?",
        [
          "Whether it looks impressive to other people",
          "Whether it feels easier than the planned task",
          "Whether it matches what you intended to do",
          "Whether it removes discomfort right away",
        ],
        2
      ),
    ],
  }),
  chapter({
    chapterId: "ch02-being-indistractable",
    number: 2,
    title: "Choose Traction Over Distraction",
    readingTimeMinutes: 11,
    summary: {
      p1: t(
        "You can only call something a distraction if you know what it distracted you from.",
        "Eyal uses that idea to define traction as the actions that move you toward what you planned and distraction as the actions that pull you away from it.",
        "The chapter therefore turns focus from a vague aspiration into a question of predecision and follow through."
      ),
      p2: t(
        "This matters because many people try to fight distraction without clearly choosing traction first.",
        "When the day is left undefined, almost any urge can pretend to be productive, restorative, or necessary.",
        "The deeper lesson is that intention has to become structure before it can survive pressure. Calendars, commitments, and planned rest make the difference visible."
      ),
    },
    standardBullets: [
      bullet(
        "Define traction first. A distraction only exists in relation to a chosen plan.",
        "Without that anchor, you can feel off track without ever being able to name why.",
        "That is why the book begins with deliberate planning instead of rule making.",
        "Trying to manage distraction before defining traction is like trying to be lost without first naming a destination."
      ),
      bullet(
        "Traction and distraction come from the same trigger. The difference is the direction of the response.",
        "A cue can lead toward what matters or away from it depending on what you do next.",
        "This keeps the framework behavioral instead of emotional.",
        "The same restless feeling can become productive action in one context and avoidance in another."
      ),
      bullet(
        "Unplanned time invites rationalization. When nothing specific has been chosen, low value behavior becomes easy to excuse.",
        "That is why open time often fills with whatever is most available.",
        "The problem is not only temptation. It is ambiguity.",
        "Ambiguity gives every impulse a chance to argue that it belongs."
      ),
      bullet(
        "Planned fun is traction, not failure. Recreation counts when it is chosen on purpose.",
        "The point is not to maximize work. The point is to be honest about what you meant to do.",
        "That distinction prevents the method from collapsing into joyless self monitoring.",
        "Rest is part of a sane plan when it serves recovery instead of hiding avoidance."
      ),
      bullet(
        "Saying yes by default is often drift. Many distractions arrive disguised as opportunities, favors, or useful extras.",
        "If you have not decided what the current block is for, the latest request usually wins.",
        "That is why traction requires selection as well as effort.",
        "A calendar without boundaries turns good intentions into a queue for other people."
      ),
      bullet(
        "A calendar is a commitment device. It turns values into visible tradeoffs instead of private hopes.",
        "What gets scheduled has a better chance of being protected when pressure rises.",
        "The calendar is not proof that life will go perfectly. It is proof that you chose before reacting.",
        "That prior choice is what lets you tell whether a trigger is helping or hijacking you."
      ),
      bullet(
        "Review the gap between plan and behavior. The mismatch teaches more than guilt does.",
        "When you see where traction broke, you can adjust the system instead of only criticizing yourself.",
        "That makes reflection diagnostic rather than shame driven.",
        "The chapter's logic depends on feedback because intention alone does not reveal where drift actually happens."
      ),
      bullet(
        "Success means returning, not performing perfectly. Indistractability is about getting back to traction repeatedly.",
        "A plan only helps if you can reenter it after interruptions, errors, or fatigue.",
        "That makes resilience part of the method.",
        "Perfectionism often creates more drift because one miss becomes permission to abandon the whole day."
      ),
      bullet(
        "One question clarifies any trigger. Ask whether this serves traction or distraction.",
        "The question works because it compares the moment to a prior commitment.",
        "It also slows the mind enough to expose weak justifications.",
        "Over time the question trains honesty, not just restraint."
      ),
      bullet(
        "Protect traction before it must defend itself. The best time to choose is before the urge arrives.",
        "That principle explains why so much of the book is about preparation.",
        "Reactive discipline is harder, noisier, and less reliable than proactive structure.",
        "What looks like self control in the moment often began as a clear decision made earlier."
      ),
    ],
    deeperBullets: [
      bullet(
        "Vague goals make distraction unprovable. If the standard is loose, the drift never has to admit itself.",
        "Many people stay busy enough to avoid confronting this problem.",
        "Precision is uncomfortable because it reveals tradeoffs, but it is also what makes self direction possible."
      ),
      bullet(
        "Traction requires tradeoffs. Choosing one worthwhile action means letting another possible action wait.",
        "That is why calendar discomfort is part of honest planning.",
        "The deeper skill is accepting that not doing everything is part of doing the right thing."
      ),
      bullet(
        "Borrowed priorities multiply distraction. When the day is built from other people's demands, your own traction becomes easy to postpone.",
        "This is one reason communication tools dominate unplanned schedules.",
        "The chapter quietly pushes toward agency by asking who authored the day in the first place."
      ),
      bullet(
        "Calendar shame misses the point. A plan is not a morality test. It is a mirror.",
        "The goal is to learn where intention fails under real conditions.",
        "Used well, the calendar does not punish you for being human. It shows you where design is still weak."
      ),
      bullet(
        "Predecision is freedom, not rigidity. Clear choices made in advance create room for presence when the moment arrives.",
        "You spend less energy negotiating the same temptation again and again.",
        "That conserved attention can then go toward the work, the conversation, or the rest you actually chose."
      ),
    ],
    takeaways: [
      "Traction must be defined",
      "Distraction is relative to plan",
      "Planned rest still counts",
      "Calendars make values visible",
      "The question is traction or distraction",
      "Return matters more than perfection",
    ],
    practice: [
      "Schedule one block of traction before your day starts",
      "Decide what counts as intentional rest this week",
      "Review one recent drift point without blaming yourself",
      "Ask the traction or distraction question once before switching tasks",
      "Protect one chosen block from borrowed priorities",
    ],
    examples: [
      example(
        "ch02-ex01",
        "Homework night with no real plan",
        ["school"],
        "A student tells herself she will work all evening, but because she never decides what subject or task comes first, she keeps sliding into whatever feels easiest.",
        [
          "Turn the evening into specific traction by assigning clear blocks to clear tasks.",
          "Use the plan to decide whether a sudden new activity belongs or is simply drift."
        ],
        "This matters because undefined effort leaves nothing firm enough to protect. Traction has to be chosen before distraction can be recognized."
      ),
      example(
        "ch02-ex02",
        "Campus event planning versus random busyness",
        ["school"],
        "A student committee keeps moving between posters, playlists, group chat jokes, and snack ideas, but the permit deadline is what actually decides whether the event happens.",
        [
          "Name the traction that moves the event forward and finish it before handling the interesting side tasks.",
          "Treat the other tasks as optional until the core commitment is secure."
        ],
        "The chapter teaches that many distractions are not obviously silly. They look useful until you compare them to the chosen objective."
      ),
      example(
        "ch02-ex03",
        "Starting work in reaction mode",
        ["work"],
        "An employee opens every day by checking messages because it feels professional, but by late afternoon the important proposal is still untouched.",
        [
          "Choose the first traction block before logging into reactive channels.",
          "Let communication fit around the priority instead of defining it."
        ],
        "This example shows why the day needs authorship. If you do not choose traction early, the inbox will do it for you."
      ),
      example(
        "ch02-ex04",
        "Busy manager with no main target",
        ["work"],
        "A manager attends extra meetings, answers side questions, and reviews minor drafts all week, yet the key hiring decision keeps slipping because no protected time was assigned to it.",
        [
          "Put the important decision on the calendar as traction instead of hoping it survives leftover time.",
          "Measure the week against that commitment, not against how full the schedule looked."
        ],
        "The chapter matters here because busyness can hide drift. A crowded calendar is not the same as a directed one."
      ),
      example(
        "ch02-ex05",
        "Rest that turns into accidental scrolling",
        ["personal"],
        "Someone wants a quiet evening to recover, but because rest was never defined, the night dissolves into aimless scrolling that leaves them more tired than before.",
        [
          "Choose what intentional recovery looks like before the evening begins.",
          "If scrolling is not the plan, treat it as distraction rather than calling it rest after the fact."
        ],
        "This matters because the method is not anti leisure. It is anti drift. Planned enjoyment and accidental consumption feel very different by the end."
      ),
      example(
        "ch02-ex06",
        "Weekend project that keeps moving",
        ["personal"],
        "A person says they care about writing, but every weekend the writing block gets displaced by errands, favors, and low stakes tasks that were easier to start.",
        [
          "Decide when the writing happens and let the other tasks fit around it when possible.",
          "Use the written plan to judge new requests instead of deciding from scratch each time."
        ],
        "Traction becomes durable when it is preselected. Otherwise the easier next step keeps replacing the more meaningful one."
      ),
    ],
    questions: [
      question(
        "ch02-q01",
        "Why can you not label something a distraction without another prior step?",
        [
          "Because all distractions come from technology",
          "Because you first need to know what traction was supposed to be",
          "Because distractions matter only at work",
          "Because emotion always decides the answer",
        ],
        1
      ),
      question(
        "ch02-q02",
        "A person blocks social apps but still wastes the morning on low priority tasks. What does that suggest?",
        [
          "The real issue may be that traction was never clearly chosen",
          "Blocking tools always fail",
          "Only leisure activities count as distraction",
          "The morning should be left fully open",
        ],
        0
      ),
      question(
        "ch02-q03",
        "Which option best fits the meaning of traction?",
        [
          "Any action that feels urgent",
          "Any action chosen in advance that moves you toward what matters",
          "Only paid work",
          "Any task completed quickly",
        ],
        1
      ),
      question(
        "ch02-q04",
        "How does the chapter treat planned leisure?",
        [
          "As failure because only work should be scheduled",
          "As neutral because calendars are only for business tasks",
          "As traction when it is chosen intentionally",
          "As distraction whenever a phone is involved",
        ],
        2
      ),
      question(
        "ch02-q05",
        "What is the main value of putting priorities on a calendar?",
        [
          "It guarantees perfect execution",
          "It turns vague values into visible commitments and tradeoffs",
          "It removes all need for review",
          "It prevents every interruption automatically",
        ],
        1
      ),
      question(
        "ch02-q06",
        "Someone says, \"I was productive all day,\" but cannot name the one thing the day was meant to advance. What is the best response?",
        [
          "Productivity does not require a target",
          "A full day is always a good day",
          "Without defined traction, busyness can hide distraction",
          "They should trust that important work happened somewhere in the mix",
        ],
        2
      ),
      question(
        "ch02-q07",
        "Why does the chapter emphasize returning to traction instead of perfect adherence?",
        [
          "Because schedules are mostly symbolic",
          "Because repair after drift is part of real self control",
          "Because interruptions always cancel the plan",
          "Because consistency matters less than intensity",
        ],
        1
      ),
      question(
        "ch02-q08",
        "What question should a person ask when a trigger appears?",
        [
          "Will this make me look responsive",
          "Can I do this quickly enough to ignore the cost",
          "Does this serve traction or distraction",
          "Do I feel like doing this more than the original task",
        ],
        2
      ),
      question(
        "ch02-q09",
        "Which move best protects traction?",
        [
          "Waiting to choose priorities until you see your mood",
          "Letting new requests decide the day in real time",
          "Predeciding what matters before the reactive inputs arrive",
          "Filling every open minute with something easy",
        ],
        2
      ),
      question(
        "ch02-q10",
        "Why is unplanned time so vulnerable to distraction?",
        [
          "Because every unscheduled hour is wasteful",
          "Because ambiguity lets almost any impulse justify itself",
          "Because people only drift at night",
          "Because motivation declines the moment a plan exists",
        ],
        1
      ),
    ],
  }),
  chapter({
    chapterId: "ch03-motivation-and-discomfort",
    number: 3,
    title: "Discomfort Drives Many Behaviors",
    readingTimeMinutes: 12,
    summary: {
      p1: t(
        "Discomfort drives many behaviors because people often act less to pursue value than to escape unpleasant internal states.",
        "Eyal argues that boredom, anxiety, loneliness, doubt, and stress frequently sit underneath the urge to check, click, eat, talk, or switch tasks.",
        "That reframes distraction as a relief behavior rather than a simple attraction to fun."
      ),
      p2: t(
        "This matters because it changes the real battlefield. If you only attack the tool, the mind will keep looking for another way to feel better fast.",
        "Seeing discomfort clearly lets you work on the cause of the drift instead of chasing its latest form.",
        "The deeper lesson is that indistractability requires emotional skill. Attention becomes steadier when you can feel friction without instantly fleeing it."
      ),
    },
    standardBullets: [
      bullet(
        "Discomfort sits under many urges. The impulse to switch tasks often begins as a wish to stop feeling something unpleasant.",
        "That unpleasant state may be boredom, uncertainty, frustration, or fear.",
        "Naming this pattern keeps you from mistaking relief seeking for rational choice.",
        "Many distractions look externally caused only because the internal discomfort is harder to notice in time."
      ),
      bullet(
        "Relief feels rewarding. A distraction works because it changes the feeling quickly, even when it harms the larger goal.",
        "The brain learns from the short term emotional payoff before it considers the long term cost.",
        "That is why repeating the escape can make it more automatic over time.",
        "The behavior becomes sticky not because it is wise, but because it is briefly soothing."
      ),
      bullet(
        "Boredom is a trigger, not a trivial inconvenience. Many people reach for stimulation the moment a task stops feeling vivid.",
        "That matters because modern tools are built to answer boredom instantly.",
        "If boredom is always treated as a problem to erase, sustained attention becomes hard to practice.",
        "The ability to stay with a dull moment is often part of the ability to finish meaningful work."
      ),
      bullet(
        "Anxiety often disguises itself as urgency. What feels like a useful switch may really be avoidance of uncertainty.",
        "People frequently move toward easier tasks because the harder one exposes doubt or possible failure.",
        "This is why distraction can look responsible while still being evasive.",
        "Urgency language can hide emotional avoidance behind a more flattering story."
      ),
      bullet(
        "Shame makes distraction worse. Self attack adds more discomfort to the cycle you were already trying to escape.",
        "That often creates another round of avoidance instead of a better response.",
        "Harsh self judgment therefore weakens follow through more than it strengthens it.",
        "If the emotional cost of noticing drift is too high, the mind will keep choosing numbness."
      ),
      bullet(
        "Naming the feeling weakens autopilot. Precision creates a little space between sensation and action.",
        "Even a simple label can interrupt the blur that makes urges feel inevitable.",
        "That is useful because choice returns when the feeling becomes something observed rather than obeyed.",
        "Language does not erase discomfort, but it often reduces confusion around it."
      ),
      bullet(
        "Small discomfort tolerance builds focus. You do not need to love friction, but you do need to survive it.",
        "Every time you stay with a difficult moment a little longer, you teach yourself that escape is not the only option.",
        "That training matters more than waiting for life to become perfectly pleasant.",
        "Steady attention grows through repeated contact with manageable discomfort."
      ),
      bullet(
        "The goal is not zero discomfort. Meaningful work, relationships, and growth all create some friction.",
        "Trying to remove every unpleasant feeling will usually remove challenge along with it.",
        "The better aim is learning which discomfort signals a real problem and which discomfort is simply part of the task.",
        "People often become more distractible when they assume every bad feeling must be solved right now."
      ),
      bullet(
        "Every escape teaches the brain something. Repeated distraction becomes rehearsal for how you respond to tension.",
        "The lesson may be that unease should always be resolved immediately.",
        "That is why the cycle strengthens even when you consciously dislike it.",
        "Behavior shapes future expectation, so each quick escape slightly rewrites what feels normal."
      ),
      bullet(
        "Progress begins when you see what you are trying not to feel. Insight turns a vague habit into something workable.",
        "Once the hidden discomfort becomes visible, later tools such as timeboxing and pacts have a better chance to help.",
        "Otherwise those tools get asked to solve a problem that was never honestly named.",
        "The chapter's real gift is not guilt. It is clarity about what the urge is protecting you from."
      ),
    ],
    deeperBullets: [
      bullet(
        "Pleasure is often secondary. The escape can look enjoyable while its real function is emotional anesthesia.",
        "That explains why the same activity can feel irresistible in one mood and uninteresting in another.",
        "The deeper driver is often relief, not delight."
      ),
      bullet(
        "Ambiguity is its own discomfort. Tasks with unclear payoff, unclear next steps, or unclear standards create fertile ground for avoidance.",
        "This insight matters because it points toward design fixes as well as emotional ones.",
        "Sometimes the mind is not weak. The task is poorly framed."
      ),
      bullet(
        "Social discomfort counts too. Shame, comparison, and fear of judgment can trigger the same escape loop as boredom or stress.",
        "That widens the idea beyond solo productivity and into school, work, and relationships.",
        "Many digital distractions feel tempting because they offer temporary shelter from social exposure."
      ),
      bullet(
        "Self compassion is strategic, not sentimental. It lowers the added pain that keeps the avoidance loop alive.",
        "People often recover faster when noticing drift does not immediately become a character indictment.",
        "A calmer response preserves enough clarity to choose again."
      ),
      bullet(
        "Attention improves when you stop negotiating with fantasy. The mind often promises that one small escape will be harmless even when the pattern says otherwise.",
        "Seeing the discomfort honestly makes those promises less persuasive.",
        "The deeper win is not stronger denial. It is less self deception."
      ),
    ],
    takeaways: [
      "Discomfort drives many urges",
      "Relief can reinforce distraction",
      "Boredom and anxiety both matter",
      "Naming feelings creates space",
      "Tolerance beats instant escape",
      "Shame deepens the loop",
    ],
    practice: [
      "Notice the feeling that appears right before one common distraction",
      "Label that feeling in plain words instead of obeying it immediately",
      "Stay with one uncomfortable work moment for two more minutes",
      "Treat self criticism as extra noise, not as guidance",
      "Ask what the urge is trying to help you avoid",
    ],
    examples: [
      example(
        "ch03-ex01",
        "Bored study session turns into scrolling",
        ["school"],
        "A student starts reading a difficult chapter, feels bored and mentally restless within minutes, and suddenly finds himself checking sports scores without remembering the decision to switch.",
        [
          "Pause long enough to name boredom as the trigger instead of treating the phone as the whole story.",
          "Once the feeling is visible, choose whether to stay with the reading or take a brief intentional break."
        ],
        "This matters because the urge often feels like it came from the phone when it actually came from discomfort. Naming the feeling is the first step toward changing the response."
      ),
      example(
        "ch03-ex02",
        "Group project work avoided by easy tasks",
        ["school"],
        "A student keeps organizing notes and renaming files instead of writing her section of a group project because starting the draft makes her feel unsure and exposed.",
        [
          "Recognize that the easy tasks are relieving anxiety, not advancing the assignment enough.",
          "Name the discomfort and then begin with one small piece of the actual draft."
        ],
        "The chapter is useful here because distraction often hides inside respectable looking activity. Uncertainty, not laziness, is driving the detour."
      ),
      example(
        "ch03-ex03",
        "Hard analysis replaced by inbox cleaning",
        ["work"],
        "A consultant has to write a difficult recommendation, but each time the document opens she feels tension and returns to email because it offers quick relief and clearer tasks.",
        [
          "Identify the tension as the real trigger rather than calling email productive by default.",
          "Stay with the hard document long enough to start one real section before switching."
        ],
        "This shows how anxiety can disguise itself as professionalism. Relief seeking can look efficient while still keeping the most important work untouched."
      ),
      example(
        "ch03-ex04",
        "Manager checks chat whenever uncertainty rises",
        ["work"],
        "A manager waiting on a big decision keeps refreshing team chat and dashboards because the waiting feels uncomfortable, even though none of the checking changes the outcome.",
        [
          "Name the discomfort as uncertainty and admit that the checking is serving the feeling more than the work.",
          "Choose one useful next action or stop pretending that more monitoring will calm the deeper issue."
        ],
        "The lesson is that distraction is often about emotional control, not information needs. Relief can become addictive even when it does not help."
      ),
      example(
        "ch03-ex05",
        "Lonely evening filled with random apps",
        ["personal"],
        "Someone feels lonely after getting home, moves from one app to another for hours, and ends the night feeling both numb and unsatisfied.",
        [
          "Notice loneliness as the trigger instead of treating the apps as random habits.",
          "Once the feeling is named, choose a response that actually addresses it, such as calling someone or going somewhere social."
        ],
        "This matters because distraction often offers temporary anesthesia instead of real relief. The better response usually depends on seeing the real feeling first."
      ),
      example(
        "ch03-ex06",
        "Avoiding a hard conversation with chores",
        ["personal"],
        "A person knows they need to discuss a problem with their partner, but each time the thought appears they suddenly become interested in cleaning, shopping, or doing anything else.",
        [
          "Treat the busyness as a response to discomfort rather than as a lucky burst of responsibility.",
          "Name the fear and decide on one concrete next step toward the conversation."
        ],
        "The chapter helps because it reveals how avoidance recruits respectable substitutes. The chores are not the main issue. The discomfort is."
      ),
    ],
    questions: [
      question(
        "ch03-q01",
        "What is the main claim of this part of the book?",
        [
          "People are distracted mainly because they enjoy pleasure too much",
          "Many distracting behaviors are attempts to escape discomfort",
          "Only boredom creates distraction",
          "Emotions are mostly unrelated to focus",
        ],
        1
      ),
      question(
        "ch03-q02",
        "Why can a distraction feel rewarding even when it hurts long term goals?",
        [
          "Because it quickly changes the unpleasant feeling in the moment",
          "Because the brain values long term outcomes first",
          "Because every distraction contains useful information",
          "Because relief and reward are unrelated",
        ],
        0
      ),
      question(
        "ch03-q03",
        "A worker keeps switching from a hard project to smaller tasks that feel clearer. What is the best interpretation?",
        [
          "She is naturally better at smaller tasks",
          "The hard project must be unimportant",
          "Uncertainty is creating discomfort that makes avoidance attractive",
          "She should keep following what feels easiest",
        ],
        2
      ),
      question(
        "ch03-q04",
        "How does shame usually affect the distraction cycle?",
        [
          "It ends the cycle because guilt is motivating",
          "It adds more discomfort and can trigger more avoidance",
          "It has no real effect on behavior",
          "It improves emotional precision",
        ],
        1
      ),
      question(
        "ch03-q05",
        "Which move best interrupts automatic escape behavior?",
        [
          "Pretending the feeling is not there",
          "Finding a faster distraction",
          "Labeling the feeling before acting on the urge",
          "Judging yourself harder",
        ],
        2
      ),
      question(
        "ch03-q06",
        "Why is boredom important in this framework?",
        [
          "Because boredom can act as an internal trigger that sends people searching for easy stimulation",
          "Because boredom means the task should always be abandoned",
          "Because boredom only matters for students",
          "Because boredom is less disruptive than anxiety",
        ],
        0
      ),
      question(
        "ch03-q07",
        "What does the chapter suggest about discomfort itself?",
        [
          "It should be removed from life completely",
          "It is always a sign that the task is wrong",
          "Some discomfort is normal and must be tolerated if you want steady attention",
          "It matters only when technology is involved",
        ],
        2
      ),
      question(
        "ch03-q08",
        "Someone checks her phone every time she feels a little lonely. What is the most useful next question?",
        [
          "Which app should be deleted first",
          "What discomfort is the checking helping her avoid",
          "Why is loneliness always irrational",
          "How can she stay busy enough to never notice the feeling again",
        ],
        1
      ),
      question(
        "ch03-q09",
        "Why does repeated escape matter even if each escape looks small?",
        [
          "Each one teaches the brain that discomfort should be resolved immediately through distraction",
          "Small distractions do not affect future behavior",
          "Only large failures build habits",
          "The effect disappears if the task was difficult",
        ],
        0
      ),
      question(
        "ch03-q10",
        "Which statement is most consistent with the chapter?",
        [
          "Distraction is solved once the right app is removed",
          "Pleasure is always the main driver of avoidance",
          "Seeing the hidden discomfort makes later tools more effective",
          "Good planning eliminates emotional friction entirely",
        ],
        2
      ),
    ],
  }),
  chapter({
    chapterId: "ch04-pain-management",
    number: 4,
    title: "Time Management Is Really Pain Management",
    readingTimeMinutes: 11,
    summary: {
      p1: t(
        "Time management is really pain management because the hardest part of following a plan is usually handling the discomfort that appears while doing it.",
        "Eyal argues that calendars fail less from bad intentions than from the urge to escape friction once real work, boredom, uncertainty, or effort arrive.",
        "That means the problem is not only scheduling. It is your relationship with the pain that shows up inside the schedule."
      ),
      p2: t(
        "This matters because people often keep changing tools while the same emotional pattern keeps breaking the plan.",
        "If you learn to work with that friction instead of automatically fleeing it, the calendar becomes far more believable and useful.",
        "The deeper lesson is that better planning and better emotional regulation are inseparable. A strong system still depends on your ability to stay with the moment it was built to protect."
      ),
    },
    standardBullets: [
      bullet(
        "Plans usually break at the point of friction. The schedule is fine until the task starts to feel bad.",
        "That is why the moment of failure often arrives after a good intention and a decent plan.",
        "The break happens when discomfort suddenly feels like a reason to switch.",
        "If you misread that moment as a planning issue every time, you keep solving the wrong problem."
      ),
      bullet(
        "Pain is not always a stop signal. Sometimes it simply means the task is effortful, ambiguous, or mentally demanding.",
        "Treating every unpleasant feeling as a reason to exit makes consistency impossible.",
        "The wiser move is to ask what kind of pain is present before obeying it.",
        "Some discomfort warns of real mismatch. Some is merely the price of doing meaningful work."
      ),
      bullet(
        "Calendars expose pain instead of causing it. A plan reveals where your internal triggers are strongest.",
        "That is why a schedule can feel frustrating even when it is useful.",
        "The schedule is showing you the moment where intention loses to relief seeking.",
        "Seen this way, a broken plan is not only failure. It is information."
      ),
      bullet(
        "Escaping pain teaches the wrong lesson. Each quick switch makes the next escape feel more justified.",
        "The mind learns that discomfort should be solved by leaving the task.",
        "Over time that association can become stronger than the original intention.",
        "This is why small departures from a plan can accumulate into a stable pattern."
      ),
      bullet(
        "The skill is staying, not suffering dramatically. You need enough tolerance to keep going, not a performance of toughness.",
        "The book is practical here because it asks for manageable endurance.",
        "A short extension of effort can be more important than an abstract promise to be more disciplined.",
        "Sustainable pain management is measured in repeatable moments, not heroic episodes."
      ),
      bullet(
        "Short pauses can protect traction. A breath, a reset, or a brief note can keep discomfort from turning into drift.",
        "The pause matters because it creates a moment in which the plan can reenter awareness.",
        "That is very different from abandoning the plan and calling it a break after the fact.",
        "The useful question is whether the pause serves the work or quietly replaces it."
      ),
      bullet(
        "Bad moods do not have to control the calendar. Feelings influence behavior, but they do not have to author the day.",
        "This is one reason timeboxing matters. It gives intention a shape that can survive a mood shift.",
        "The point is not emotional denial. It is emotional non submission.",
        "A planned block can hold steady even when enthusiasm disappears."
      ),
      bullet(
        "The next step should be small enough to survive resistance. Huge vague blocks create more pain than they can carry.",
        "Breaking work into a visible entry point reduces the emotional cost of beginning.",
        "That can make the schedule feel less like a threat and more like a sequence.",
        "Pain management often improves when the work becomes more startable."
      ),
      bullet(
        "Review where the pain shows up. Repeated friction points tell you where design or skill still needs work.",
        "This may reveal a task that needs a better first step, a better environment, or a better emotional response.",
        "The important thing is to study the pain instead of only resenting it.",
        "Patterns become manageable once they stop being mysterious."
      ),
      bullet(
        "A working calendar respects reality. The best plan is one you can return to when discomfort arrives.",
        "That is why time management without pain management keeps disappointing people.",
        "A schedule becomes trustworthy when it accounts for human friction instead of pretending it does not exist.",
        "The chapter closes the gap between planning and psychology by refusing to treat them as separate problems."
      ),
    ],
    deeperBullets: [
      bullet(
        "Productivity guilt often adds pain instead of reducing it. The harsher the inner voice becomes, the easier escape starts to look.",
        "That is one reason many planning systems collapse into self accusation.",
        "Pain management gets stronger when the review process is honest but not punishing."
      ),
      bullet(
        "Timeboxes are emotional containers as much as logistical ones. They tell the mind how long it needs to stay engaged before redeciding.",
        "That reduces endless moment by moment bargaining.",
        "A limited container often feels safer than a vague demand to work until the task feels complete."
      ),
      bullet(
        "Different pains need different responses. Fatigue, fear, boredom, and ambiguity are not solved in the same way.",
        "This is why careful reflection beats generic discipline talk.",
        "The deeper gain comes from matching the intervention to the actual friction."
      ),
      bullet(
        "Pleasant planning can hide painful execution. Many people enjoy organizing work more than doing it because planning feels cleaner and less exposing.",
        "That turns planning itself into a subtle escape route.",
        "A good system has to move attention back into contact with the work."
      ),
      bullet(
        "Real time management begins when you stop expecting comfort to lead. Meaningful use of time often requires acting before the mood catches up.",
        "This is a quiet but serious standard.",
        "It replaces the hope of feeling ready with the practice of staying present long enough to begin."
      ),
    ],
    takeaways: [
      "Plans break at friction points",
      "Pain is not always a stop signal",
      "Calendars reveal discomfort",
      "Small pauses can protect traction",
      "Entry points reduce resistance",
      "Planning and pain are linked",
    ],
    practice: [
      "Notice where your schedule most often breaks",
      "Add a smaller entry step to one painful task",
      "Use one short pause instead of an unplanned switch",
      "Ask what kind of discomfort appeared before you drifted",
      "Review one broken block as data, not as proof of failure",
    ],
    examples: [
      example(
        "ch04-ex01",
        "Study plan breaks on the hard chapter",
        ["school"],
        "A student makes a solid study plan, but every time the hardest chapter appears she suddenly wants to organize notes, clean her room, or get coffee first.",
        [
          "Treat the switch as pain management rather than as a planning mystery.",
          "Shrink the entry step so she can begin the hard chapter before renegotiating with the discomfort."
        ],
        "This matters because the schedule is not failing randomly. It is breaking exactly where the task feels most aversive."
      ),
      example(
        "ch04-ex02",
        "Essay block replaced by endless outlining",
        ["school"],
        "A student keeps improving the outline for an essay because drafting feels exposing and messy, even though the assignment now needs real sentences.",
        [
          "Recognize that the outline work is easing discomfort more than moving the paper forward.",
          "Set a short timebox for writing one imperfect paragraph before touching the outline again."
        ],
        "The chapter helps because it distinguishes useful planning from pain avoidance disguised as preparation."
      ),
      example(
        "ch04-ex03",
        "Strategic work postponed by reactive tasks",
        ["work"],
        "An employee blocks time for a difficult strategy document, but the moment the work feels unclear she drifts into easier admin tasks that provide quick completion.",
        [
          "Name the discomfort and make the first move inside the strategy block smaller and more concrete.",
          "Use the timebox to stay with the real work a little longer before switching."
        ],
        "This example shows that the calendar often breaks where ambiguity feels painful. Solving that pain is part of real time management."
      ),
      example(
        "ch04-ex04",
        "Manager reviews dashboards instead of making a tough call",
        ["work"],
        "A manager keeps checking metrics before a difficult staffing decision because the data review feels active while the decision itself feels heavy.",
        [
          "See the repeated checking as a response to discomfort, not as proof that more data is still needed.",
          "Define the smallest next step that moves the decision forward."
        ],
        "Pain management matters here because more activity is not the same as more progress. Some tasks keep getting delayed because they hurt to confront."
      ),
      example(
        "ch04-ex05",
        "Home budget session avoided by errands",
        ["personal"],
        "A couple plans to review their budget, but when the time arrives they suddenly remember several errands and choose those instead because money tension feels unpleasant.",
        [
          "Treat the escape as a response to discomfort instead of as coincidence.",
          "Return to the budget with a shorter, more specific first step such as reviewing one category."
        ],
        "The chapter applies outside work because difficult life tasks also create pain that makes easy substitutes look appealing."
      ),
      example(
        "ch04-ex06",
        "Exercise plan breaks at the start",
        ["personal"],
        "Someone sets aside time to exercise after work, but the moment they feel tired and resistant they sit down with videos and lose the whole evening.",
        [
          "Notice that the real battle is the discomfort at the start, not a total lack of values.",
          "Use a smaller starting action that lowers the pain of beginning."
        ],
        "This matters because time plans survive only when the person can work with the discomfort that arrives when the plan becomes real."
      ),
    ],
    questions: [
      question(
        "ch04-q01",
        "Why does the chapter say time management is really pain management?",
        [
          "Because calendars only fail when the math is wrong",
          "Because following a plan often depends on how you handle the discomfort that appears during it",
          "Because time pressure affects only work tasks",
          "Because good schedules remove all emotional friction",
        ],
        1
      ),
      question(
        "ch04-q02",
        "A person keeps abandoning a planned task the moment it feels boring. What is the most useful interpretation?",
        [
          "The schedule is irrelevant",
          "Boredom is functioning as pain that the person is trying to escape",
          "The task should always be replaced",
          "Boredom means the person has no values",
        ],
        1
      ),
      question(
        "ch04-q03",
        "What does a broken calendar often reveal?",
        [
          "The exact point where discomfort becomes stronger than the current system",
          "That planning never works",
          "That the task was impossible",
          "That moods should guide the day",
        ],
        0
      ),
      question(
        "ch04-q04",
        "Which response best matches the chapter's advice?",
        [
          "Wait until the task feels pleasant before starting",
          "Shrink the next step so the work can survive the resistance",
          "Replace every hard block with something easier",
          "Assume discomfort means the plan is wrong",
        ],
        1
      ),
      question(
        "ch04-q05",
        "Why can quick escapes make time management harder over time?",
        [
          "They teach the brain that discomfort should be answered by leaving the task",
          "They permanently damage motivation",
          "They make calendars too rigid",
          "They matter only for students",
        ],
        0
      ),
      question(
        "ch04-q06",
        "What is the role of a short pause in this chapter?",
        [
          "It can create enough space to return to the plan instead of drifting away from it",
          "It should replace the difficult task",
          "It proves the plan was unrealistic",
          "It removes the need for later review",
        ],
        0
      ),
      question(
        "ch04-q07",
        "Which statement best fits the chapter's view of bad moods?",
        [
          "They should automatically rewrite the calendar",
          "They do not matter if you are disciplined enough",
          "They influence behavior, but they do not have to author the day",
          "They make planning pointless",
        ],
        2
      ),
      question(
        "ch04-q08",
        "A worker enjoys planning his week but keeps postponing the real work once the blocks arrive. What is happening?",
        [
          "Planning may be serving as a cleaner substitute for execution",
          "Planning and execution are the same skill",
          "The calendar is too specific to be useful",
          "He should stop planning entirely",
        ],
        0
      ),
      question(
        "ch04-q09",
        "What should a person review after a block breaks?",
        [
          "How to blame themselves more effectively",
          "What type of discomfort showed up and what design change might help next time",
          "Whether schedules are morally strict enough",
          "Which app to download next",
        ],
        1
      ),
      question(
        "ch04-q10",
        "What makes a calendar realistic according to this chapter?",
        [
          "It assumes no friction and lots of motivation",
          "It can be followed only in ideal conditions",
          "It respects the fact that real work creates discomfort and plans for that truth",
          "It schedules every minute of the day equally",
        ],
        2
      ),
    ],
  }),
  chapter({
    chapterId: "ch29-avoid-excuses",
    number: 29,
    title: "Do Not Hide Behind Easy Excuses",
    readingTimeMinutes: 16,
    summary: {
      p1: t(
        "Do not hide behind easy excuses because blaming technology, personality, or modern life too casually prevents the real work of understanding and redesigning behavior.",
        "Eyal warns that convenient explanations can feel comforting while quietly preserving the patterns they claim to describe.",
        "The chapter asks readers, especially adults and parents, to choose responsibility over easy blame."
      ),
      p2: t(
        "This matters because excuses can look thoughtful when they are really avoidance of agency.",
        "If every distraction is explained away as inevitable, nobody has to examine the environment, the trigger, the model being set, or the choices still available.",
        "The deeper lesson is that honest diagnosis starts where excuses end. Responsibility is not the same as self blame. It is the starting point for useful change."
      ),
    },
    standardBullets: [
      bullet(
        "Easy blame protects the problem. A comforting explanation can stop the harder work of redesigning behavior.",
        "That is why the chapter treats excuses as a real obstacle, not as harmless language.",
        "An excuse often feels like insight because it sounds complete.",
        "But a story that removes agency usually removes improvement too."
      ),
      bullet(
        "Technology is rarely the whole explanation. Devices matter, but so do triggers, norms, and what adults model.",
        "This keeps the book from settling for shallow villains.",
        "The tool is part of the picture, not the whole portrait.",
        "Blaming one object too completely can hide what still remains in your control."
      ),
      bullet(
        "Responsibility is different from shame. The chapter does not ask for guilt theater. It asks for ownership of the part you can influence.",
        "That distinction keeps responsibility usable.",
        "Shame narrows thought while ownership directs it.",
        "A calm acceptance of influence is more productive than a dramatic confession of failure."
      ),
      bullet(
        "Adults model the norms they complain about. Children and peers learn attention habits partly by watching what the important adults around them actually do.",
        "This makes example setting central, not peripheral.",
        "Behavior teaches faster than speeches.",
        "If your own actions contradict your advice, the contradiction becomes part of the lesson."
      ),
      bullet(
        "Convenient stories reduce curiosity. Once you think you already know the cause, you stop asking better questions.",
        "That is why excuses are intellectually expensive.",
        "They close investigation early.",
        "A fast explanation can keep the real pattern hidden in plain sight."
      ),
      bullet(
        "The better question is what can be changed here. Even when some constraints are real, there is usually still a design choice worth making.",
        "This is the chapter's practical pivot.",
        "Agency becomes visible when the question changes.",
        "You may not control everything, but you rarely control nothing."
      ),
      bullet(
        "Excuses often flatter the speaker. They can protect identity by making the problem seem universal, inevitable, or externally imposed.",
        "That is one reason they are seductive.",
        "They let a person feel informed without feeling challenged.",
        "The chapter asks readers to notice this self protective payoff."
      ),
      bullet(
        "Honest accountability improves empathy. When you stop hiding behind excuses, you can understand others more clearly too.",
        "Ownership makes space for better questions about context and need.",
        "It does not require harshness.",
        "Clear responsibility and real compassion can coexist."
      ),
      bullet(
        "The first redesign step may be yours. Before demanding change from children, teams, or partners, examine what your own habits are reinforcing.",
        "This keeps the chapter grounded in leadership by example.",
        "Influence begins close to home.",
        "A person who changes the local environment and model often changes more than one behavior at once."
      ),
      bullet(
        "Excuse free attention work begins with truth. The chapter wants a more accurate and more useful relationship to the problem.",
        "That is why it appears before the family chapters move into more specific guidance.",
        "Truth creates traction.",
        "Once the excuse falls away, the real levers finally become easier to see."
      ),
    ],
    deeperBullets: [
      bullet(
        "Some excuses are culturally approved. Because they are common, they can feel realistic even when they keep everyone passive.",
        "That makes them harder to detect.",
        "Normal language can still protect weak habits."
      ),
      bullet(
        "Blame can become a status move. People sometimes gain moral comfort by sounding critical of the problem while avoiding costly self examination.",
        "The chapter pushes against that performance.",
        "Serious diagnosis asks more of the speaker."
      ),
      bullet(
        "Children especially notice adult contradiction. They are often less persuaded by stated rules than by the patterns adults keep enacting around them.",
        "This gives the chapter strong relevance to parenting.",
        "Modeling is ambient instruction."
      ),
      bullet(
        "Agency is often partial, not total. The chapter's honesty comes from refusing both extremes of total control and total helplessness.",
        "Useful change usually starts in that middle ground.",
        "Partial influence is still influence worth using."
      ),
      bullet(
        "The deeper cost of excuses is delayed learning. As long as the wrong story keeps winning, the right experiment never gets run.",
        "That is why convenient blame is so expensive over time.",
        "It blocks discovery as well as action."
      ),
    ],
    takeaways: [
      "Excuses protect patterns",
      "Technology is not the whole story",
      "Responsibility is not shame",
      "Adults model the norms",
      "Ask what can change here",
      "Truth opens real redesign",
    ],
    practice: [
      "Notice one explanation that removes too much agency",
      "Replace blame with one concrete question about what can change",
      "Examine one habit you are modeling for others",
      "Separate responsibility from self attack",
      "Run one small redesign instead of repeating the same excuse",
    ],
    examples: [
      example(
        "ch29-ex01",
        "Student blames the app only",
        ["school"],
        "A student says social media is ruining his grades, but he has also never built a study plan, removed notifications, or changed where the phone sits during homework.",
        [
          "Keep the truth that the app is powerful, but stop there no longer.",
          "Ask what part of the pattern is still under his control right now."
        ],
        "This matters because blaming the tool alone feels satisfying while preserving the rest of the system that keeps the habit alive."
      ),
      example(
        "ch29-ex02",
        "Club leader blames group culture without changing hers",
        ["school"],
        "A student leader says the club has terrible attention habits, but she still sends late night messages, changes priorities constantly, and models the same chaos she criticizes.",
        [
          "Look first at the norms she is personally reinforcing.",
          "Use ownership to change the local pattern before blaming the wider group alone."
        ],
        "The chapter helps because leadership by example is part of the diagnosis. Complaint without self examination rarely changes culture."
      ),
      example(
        "ch29-ex03",
        "Manager blames young workers",
        ["work"],
        "A manager says the team cannot focus because modern workers have no attention span, but the workplace itself runs on constant pings, vague priorities, and meeting overload.",
        [
          "Stop using a generational story as a substitute for system diagnosis.",
          "Ask what norms and processes are producing the behavior you dislike."
        ],
        "This shows why easy stories can flatter the speaker while leaving the real levers untouched."
      ),
      example(
        "ch29-ex04",
        "Employee blames workload without examining habits",
        ["work"],
        "An employee says he is too busy to focus, yet he also checks every channel constantly and never protects the tasks that matter most.",
        [
          "Acknowledge the workload and still examine the design choices inside the day.",
          "Look for the part of the pattern that can be changed instead of choosing total helplessness."
        ],
        "The chapter matters because reality is often mixed. Some constraints are real, and some excuses still need to be retired."
      ),
      example(
        "ch29-ex05",
        "Parent blames the child only",
        ["personal"],
        "A parent says the child is addicted to screens, but the household has few routines, devices are always visible, and the adults are rarely off their own phones.",
        [
          "Expand the diagnosis beyond the child and look at the environment and modeling too.",
          "Start with the parts of the pattern the adults control."
        ],
        "This matters because family attention habits are rarely created by one person alone. Excuse free diagnosis makes better parenting possible."
      ),
      example(
        "ch29-ex06",
        "Person blames personality forever",
        ["personal"],
        "Someone says they are just the type who will always be distracted, so every failed attempt becomes proof instead of information.",
        [
          "Challenge the excuse without turning it into shame.",
          "Ask what small redesign would still be possible even if the tendency is real."
        ],
        "The deeper lesson is that partial agency still matters. A true tendency does not justify total surrender."
      ),
    ],
    questions: [
      question(
        "ch29-q01",
        "What is the main problem with easy excuses?",
        [
          "They can stop the real work of diagnosis and redesign",
          "They make people too responsible",
          "They improve curiosity",
          "They remove emotional comfort permanently",
        ],
        0
      ),
      question(
        "ch29-q02",
        "How does the chapter treat responsibility?",
        [
          "As ownership of influence, not as shame theater",
          "As proof that only one person caused everything",
          "As less useful than blame",
          "As something children alone should carry",
        ],
        0
      ),
      question(
        "ch29-q03",
        "Why is blaming technology alone usually insufficient?",
        [
          "Because triggers, norms, environment, and modeling also shape behavior",
          "Because technology never matters",
          "Because only culture matters",
          "Because screens affect only children",
        ],
        0
      ),
      question(
        "ch29-q04",
        "What do adults often forget when complaining about others' distraction?",
        [
          "Their own behavior is also teaching the norm",
          "Children ignore modeling",
          "Rules matter more than example",
          "Environment is irrelevant",
        ],
        0
      ),
      question(
        "ch29-q05",
        "Why are excuses intellectually expensive?",
        [
          "They reduce curiosity by making the problem seem already explained",
          "They increase experimentation",
          "They clarify every tradeoff",
          "They make patterns easier to see",
        ],
        0
      ),
      question(
        "ch29-q06",
        "What question does the chapter prefer over blame?",
        [
          "What can be changed here",
          "Who deserves more criticism",
          "Why is modern life impossible",
          "Which group is most at fault",
        ],
        0
      ),
      question(
        "ch29-q07",
        "How can excuses flatter the speaker?",
        [
          "They can preserve identity by making the problem seem inevitable or external",
          "They force humility",
          "They remove all comfort",
          "They increase accountability",
        ],
        0
      ),
      question(
        "ch29-q08",
        "What is the first redesign step in many cases?",
        [
          "Examining what you yourself are reinforcing in the local environment",
          "Waiting for others to change first",
          "Making the explanation more dramatic",
          "Assuming agency is total or zero",
        ],
        0
      ),
      question(
        "ch29-q09",
        "What does the chapter say about partial agency?",
        [
          "It still matters and is worth using",
          "It is too small to matter",
          "It creates more excuses",
          "It applies only in personal life",
        ],
        0
      ),
      question(
        "ch29-q10",
        "What begins once excuses end?",
        [
          "A more honest search for the real levers of change",
          "A guarantee of easy behavior",
          "The end of all compassion",
          "A purely technological fix",
        ],
        0
      ),
    ],
  }),
  chapter({
    chapterId: "ch30-understand-child-triggers",
    number: 30,
    title: "Understand What Kids Are Escaping",
    readingTimeMinutes: 12,
    summary: {
      p1: t(
        "Understanding what kids are escaping means looking beneath distracting behavior to the discomfort, unmet need, or emotional strain the behavior is helping them avoid.",
        "Eyal applies the book's internal trigger logic to children by arguing that screens and other distractions often serve as escapes from boredom, loneliness, stress, powerlessness, or social pain.",
        "The chapter asks adults to investigate the feeling before attacking the surface habit."
      ),
      p2: t(
        "This matters because children are easier to control than to understand, and control without understanding often misses the root problem.",
        "When adults ask what the child is trying not to feel, they can respond with more precision, empathy, and effectiveness.",
        "The deeper lesson is that distracting behavior is often communication. A better diagnosis can lead to better support and better boundaries at the same time."
      ),
    },
    standardBullets: [
      bullet(
        "Children use distraction for reasons, not only for fun. The behavior often has an emotional function.",
        "That function may be relief from boredom, fear, loneliness, social pain, or lack of control.",
        "Seeing function changes the adult response.",
        "Surface behavior becomes more understandable when you ask what job it is doing."
      ),
      bullet(
        "The screen is often the symptom, not the whole cause. Removing access without understanding the discomfort can simply move the escape elsewhere.",
        "That is why the chapter focuses on triggers first.",
        "A better diagnosis prevents whack a mole parenting.",
        "If the underlying need stays untouched, another outlet will often appear."
      ),
      bullet(
        "Boredom matters for kids too. Constant stimulation can make ordinary quiet feel unusually hard to tolerate.",
        "This does not make the child bad. It reveals a skill gap to work on.",
        "Tolerance can be taught and modeled.",
        "The chapter sees boredom as a developmental challenge, not merely as a nuisance."
      ),
      bullet(
        "Children need agency. Some distracting behaviors intensify when kids feel overly controlled or chronically powerless.",
        "A bit more voice and participation can change the emotional meaning of the situation.",
        "Autonomy is protective here.",
        "A child who never gets real input may seek escape partly as relief from constant submission."
      ),
      bullet(
        "Social pain is a real trigger. Rejection, insecurity, comparison, and embarrassment can drive children toward fast digital refuge.",
        "This broadens the chapter beyond simple screen time complaints.",
        "Emotional context matters deeply.",
        "A child hiding in distraction may be shielding something adults cannot see yet."
      ),
      bullet(
        "Curiosity before punishment improves understanding. Asking calm questions can reveal more than reacting only to the visible habit.",
        "This does not eliminate boundaries. It makes them smarter.",
        "A regulated adult sees more.",
        "The first job is to understand what the behavior is solving from the child's point of view."
      ),
      bullet(
        "Adults should look at the environment too. Sleep, stress, social pressures, family tension, and school overload all shape what a child wants to escape.",
        "This keeps the diagnosis systemic rather than narrowly moral.",
        "Context is part of care.",
        "A child living inside a hard environment may be adapting in clumsy but understandable ways."
      ),
      bullet(
        "Empathy and accountability can coexist. Understanding the trigger does not mean giving up on limits.",
        "It means the limit can target the real issue more effectively.",
        "Compassion should sharpen intervention, not replace it.",
        "The chapter's balance is soft on the child and firm on the problem."
      ),
      bullet(
        "What helps one child may not help another. The trigger has to be investigated rather than assumed.",
        "This resists generic parenting scripts.",
        "Specificity improves guidance.",
        "The same behavior can arise from very different discomforts in different children."
      ),
      bullet(
        "Better questions produce better support. Once the root discomfort is clearer, adults can design routines, conversations, and boundaries that actually fit the child.",
        "That is the chapter's practical payoff.",
        "Understanding leads to better intervention.",
        "A child is easier to guide wisely when the adult stops treating the distraction as meaningless noise."
      ),
    ],
    deeperBullets: [
      bullet(
        "Children often lack the language to describe what they are escaping. Adults may have to infer the trigger from context, timing, and repeated patterns.",
        "This is why calm observation matters so much.",
        "The behavior may be speaking before the child can."
      ),
      bullet(
        "Control without curiosity can increase the very discomfort driving the escape. A child who already feels powerless may react to pure restriction with more intensity.",
        "That does not mean no limits. It means limits should come with understanding and voice.",
        "Otherwise the intervention can feed the trigger."
      ),
      bullet(
        "Adults are often responding to their own discomfort too. The child's behavior may trigger parental fear, embarrassment, or impatience, which can narrow diagnosis.",
        "The chapter quietly asks adults to regulate themselves first.",
        "Better parenting begins with better observation."
      ),
      bullet(
        "A child's distracting behavior can be an early warning signal for stress elsewhere in life. The escape may reveal pressure that has not yet been discussed directly.",
        "That makes the behavior diagnostically valuable.",
        "The symptom may be pointing to a larger story."
      ),
      bullet(
        "Understanding the escape is a form of respect. It assumes the child is not random or hopeless, but is responding to something meaningful from their point of view.",
        "That stance changes the quality of the relationship.",
        "It invites wiser authority."
      ),
    ],
    takeaways: [
      "Kids escape discomfort too",
      "The screen may be the symptom",
      "Agency and social pain matter",
      "Curiosity improves diagnosis",
      "Empathy and limits can coexist",
      "Behavior often communicates need",
    ],
    practice: [
      "Notice when a child's distraction appears most often",
      "Ask what feeling or need the behavior may be serving",
      "Look at the environment around the pattern",
      "Use a calmer question before a faster punishment",
      "Design one response that fits the real trigger better",
    ],
    examples: [
      example(
        "ch30-ex01",
        "Student disappears into games after school",
        ["school"],
        "A student comes home from school and instantly disappears into games every day, and adults keep focusing only on the screen rather than on what school may be leaving him desperate to escape.",
        [
          "Look for the discomfort under the habit, such as social stress, exhaustion, or lack of agency after a long day.",
          "Use that diagnosis to shape both support and limits."
        ],
        "This matters because the game may be doing emotional work. Better rules start with understanding what that work is."
      ),
      example(
        "ch30-ex02",
        "Younger child melts into videos",
        ["school"],
        "A younger student uses videos to avoid homework every evening, and the adults keep repeating that the child just lacks discipline.",
        [
          "Ask what feels hard about homework from the child's side before tightening the rule again.",
          "Identify whether the trigger is boredom, confusion, shame, or exhaustion."
        ],
        "The chapter helps because surface behavior can hide different underlying pains. Smarter help depends on clearer diagnosis."
      ),
      example(
        "ch30-ex03",
        "Manager misreads a junior worker's avoidance",
        ["work"],
        "A manager sees a young employee constantly hiding in easy tasks and assumes laziness, never asking what discomfort the person may be escaping.",
        [
          "Use the chapter's logic and ask what pressure, uncertainty, or fear the avoidance may be relieving.",
          "Respond to the root issue rather than only the surface behavior."
        ],
        "This work example shows the broader principle. People of any age often distract themselves for emotional reasons before practical ones."
      ),
      example(
        "ch30-ex04",
        "Parent comes home and sees only the screen",
        ["work"],
        "A parent arrives home from work, sees a child on a device, and reacts instantly with frustration without trying to understand what the child is escaping from that day.",
        [
          "Pause before the reprimand and investigate the context first.",
          "Let the boundary be informed by what the child is actually dealing with."
        ],
        "The deeper lesson is that adult stress can make surface control look easier than real diagnosis. Better timing creates better parenting."
      ),
      example(
        "ch30-ex05",
        "Child uses media during family conflict",
        ["personal"],
        "A child retreats into media whenever tension rises at home, but the adults keep calling the device the main issue instead of noticing the atmosphere the child is fleeing.",
        [
          "Treat the behavior as information about the family emotional climate, not only as a screen rule problem.",
          "Address the underlying tension while also setting boundaries."
        ],
        "This matters because some distraction is a refuge from an environment, not just from boredom. The diagnosis has to widen."
      ),
      example(
        "ch30-ex06",
        "Teen scrolls after social humiliation",
        ["personal"],
        "A teenager spends hours scrolling after a painful social experience, and the parent sees only wasted time rather than the attempt to numb embarrassment.",
        [
          "Start with the emotional event and what the scrolling is helping the teen avoid feeling.",
          "Use that understanding to guide a more helpful response."
        ],
        "The chapter applies here because social pain can be a powerful trigger. The screen may be secondary to the shame underneath it."
      ),
    ],
    questions: [
      question(
        "ch30-q01",
        "What is the key shift this chapter asks adults to make?",
        [
          "Look beneath the distracting behavior to the discomfort or need it may be serving",
          "Ignore the behavior entirely",
          "Assume every child has the same trigger",
          "Treat screens as the full explanation",
        ],
        0
      ),
      question(
        "ch30-q02",
        "Why is the screen often not the whole cause?",
        [
          "Because the device may be functioning as an escape from some other discomfort",
          "Because screens never affect behavior",
          "Because children only use screens for school",
          "Because boundaries do not matter",
        ],
        0
      ),
      question(
        "ch30-q03",
        "What role can boredom play here?",
        [
          "It can be a trigger that children have not yet learned to tolerate well",
          "It is always a sign the task should end",
          "It matters only for adults",
          "It is unrelated to screens",
        ],
        0
      ),
      question(
        "ch30-q04",
        "Why does the chapter emphasize agency for children?",
        [
          "A chronic sense of powerlessness can itself drive escape behavior",
          "Children should make all rules alone",
          "Agency removes the need for boundaries",
          "Powerlessness always improves obedience",
        ],
        0
      ),
      question(
        "ch30-q05",
        "How should adults begin responding more effectively?",
        [
          "With curiosity about what the behavior is solving from the child's perspective",
          "With faster punishment before asking questions",
          "By assuming the trigger is always boredom",
          "By avoiding all limits",
        ],
        0
      ),
      question(
        "ch30-q06",
        "What broader context should adults examine?",
        [
          "Stress, sleep, school pressure, family tension, and social pain",
          "Only app settings",
          "Only personality",
          "Only the child's age",
        ],
        0
      ),
      question(
        "ch30-q07",
        "What is the relationship between empathy and limits in this chapter?",
        [
          "They can coexist, with understanding making boundaries smarter",
          "Empathy means no limits",
          "Limits make empathy impossible",
          "Only empathy matters",
        ],
        0
      ),
      question(
        "ch30-q08",
        "Why should adults avoid generic assumptions about children's triggers?",
        [
          "The same behavior can arise from very different discomforts in different kids",
          "Because all kids are identical",
          "Because triggers cannot be understood",
          "Because behavior never communicates anything",
        ],
        0
      ),
      question(
        "ch30-q09",
        "What is one reason adults can misread the behavior?",
        [
          "Their own discomfort can push them toward fast control instead of better observation",
          "Children always explain themselves clearly",
          "Parents naturally see the root cause first",
          "A screen habit never points to anything else",
        ],
        0
      ),
      question(
        "ch30-q10",
        "What is the deeper lesson of the chapter?",
        [
          "Distracting behavior is often a form of communication about what a child is struggling with",
          "Children should manage everything alone",
          "Understanding replaces structure completely",
          "Only emotional issues matter",
        ],
        0
      ),
    ],
  }),
  chapter({
    chapterId: "ch31-family-traction",
    number: 31,
    title: "Plan Traction Together At Home",
    readingTimeMinutes: 13,
    summary: {
      p1: t(
        "Planning traction together at home means building family time around shared priorities instead of leaving every evening and weekend open to the loudest distraction.",
        "Eyal applies the values to time principle to family life by encouraging households to decide together what matters and when it should happen.",
        "The result is a home that is more intentional and less governed by drift."
      ),
      p2: t(
        "This matters because homes are full of competing needs and easy digital escapes.",
        "When family members help shape the plan, traction becomes more visible, more cooperative, and easier to defend against interruption.",
        "The deeper lesson is that shared planning builds both structure and buy in. Families often follow rules better when they have participated in choosing the priorities those rules protect."
      ),
    },
    standardBullets: [
      bullet(
        "Families need visible priorities too. Home life becomes reactive when no one has agreed on what time is actually for.",
        "That is why the chapter brings planning into the household.",
        "Traction matters outside work as well.",
        "A family without stated priorities is easy for screens and chaos to organize."
      ),
      bullet(
        "Shared planning increases buy in. People follow a plan more readily when they had a voice in shaping it.",
        "This is especially true for children and teens.",
        "Participation creates ownership.",
        "A family calendar is stronger when it feels authored together rather than imposed from above."
      ),
      bullet(
        "Name the domains that matter at home. Homework, chores, play, rest, connection, and personal time all need some visibility.",
        "This keeps one domain from swallowing the rest.",
        "Balance becomes easier when categories are seen clearly.",
        "What remains unnamed often loses."
      ),
      bullet(
        "Turn values into actual blocks. Saying family time matters is less useful than deciding when it will happen.",
        "Time creates reality here too.",
        "A shared block protects what good intentions alone cannot.",
        "Home values gain force once they have a place on the calendar."
      ),
      bullet(
        "Leave room for autonomy inside the structure. A good family plan creates guidance without turning every minute into control.",
        "This matters because too much rigidity can create resistance.",
        "Structure works best when it includes ownership and choice.",
        "A family plan should support agency, not erase it."
      ),
      bullet(
        "Predictable rhythms reduce conflict. Repeated routines around work, meals, play, and rest make attention decisions easier for everyone.",
        "Rhythm lowers the amount of negotiation and surprise.",
        "That can make the home feel calmer.",
        "Many family conflicts are really rhythm problems in disguise."
      ),
      bullet(
        "Planning makes distraction easier to spot. Once the household knows what this time is for, interruptions and detours become more visible.",
        "That clarity supports better boundaries.",
        "The plan gives the family a shared reference point.",
        "Without it, every interruption can argue that it belongs."
      ),
      bullet(
        "Review the plan together. A home schedule should be adjusted with reality, not treated as a rigid monument.",
        "Shared review helps the plan stay trusted.",
        "People support systems that listen to reality.",
        "A family calendar becomes more durable when it can be revised without drama."
      ),
      bullet(
        "Model the plan through adult behavior. Children notice whether adults respect the same rhythms and boundaries they ask others to follow.",
        "This keeps the chapter tied to credibility.",
        "Home culture is taught by example.",
        "A family plan weakens quickly when adults exempt themselves from it."
      ),
      bullet(
        "Family traction is a form of care. The chapter treats planned connection, rest, and responsibility as parts of a healthy home, not as competing moral camps.",
        "That broadens the meaning of productivity in a useful way.",
        "Home life deserves intentional design too.",
        "A family becomes more coherent when its time starts reflecting what it says it values."
      ),
    ],
    deeperBullets: [
      bullet(
        "Shared planning teaches children how priorities become time. It is a form of apprenticeship in deliberate living.",
        "The lesson is larger than the weekly schedule itself.",
        "The family becomes a training ground for authorship."
      ),
      bullet(
        "The plan should reduce negotiation load, not create constant surveillance. Good structure lowers daily conflict because fewer basics have to be renegotiated under stress.",
        "This is one reason rhythm matters so much at home.",
        "Calmer systems are often kinder systems."
      ),
      bullet(
        "Buy in depends on meaning as well as participation. People cooperate better when they understand what the plan protects, not only when they helped choose it.",
        "Purpose strengthens structure.",
        "A shared why can steady a shared schedule."
      ),
      bullet(
        "Home plans reveal hidden tradeoffs too. What the family keeps saying yes to may expose values it never intended to elevate.",
        "The calendar is honest in households just as it is in work.",
        "That honesty can improve family conversation."
      ),
      bullet(
        "A family that plans traction together is teaching more than obedience. It is teaching attention as a shared value that can be discussed, defended, and revised.",
        "That is one of the chapter's deepest contributions.",
        "It turns home structure into culture."
      ),
    ],
    takeaways: [
      "Homes need visible priorities",
      "Shared planning builds buy in",
      "Values need real blocks",
      "Autonomy should stay inside structure",
      "Rhythm reduces conflict",
      "Family traction teaches authorship",
    ],
    practice: [
      "Hold one short family planning conversation",
      "Name one shared home priority for the week",
      "Put one family value on the calendar in a real block",
      "Keep one area of choice inside the plan",
      "Review the plan together after trying it",
    ],
    examples: [
      example(
        "ch31-ex01",
        "Homework, gaming, and dinner collide",
        ["school"],
        "A family keeps fighting over homework, dinner, and gaming because no one has agreed on what the evening is supposed to hold or in what order.",
        [
          "Plan the evening together with visible blocks and some room for choice.",
          "Use the shared plan as the reference point when distractions appear."
        ],
        "This matters because conflict often drops when the home has a clearer rhythm. Planning reduces reactive battles."
      ),
      example(
        "ch31-ex02",
        "Student athlete with no weekly map",
        ["school"],
        "A student athlete keeps feeling like school, training, and family are all fighting for the same time because the household never plans the week together.",
        [
          "Map the week's real priorities with the family instead of letting each day improvise from scratch.",
          "Make the tradeoffs visible early."
        ],
        "The chapter helps because shared planning turns competing demands into a coordinated schedule instead of a repeated scramble."
      ),
      example(
        "ch31-ex03",
        "Parents and work spillover",
        ["work"],
        "Two working parents keep saying home life matters, but because work spillover is never planned around, evenings become a series of collisions and last minute compromises.",
        [
          "Plan traction at home with the same seriousness given to work obligations.",
          "Clarify what protected family time actually is and when it happens."
        ],
        "This shows that home traction needs authorship too. Otherwise outside demands keep deciding the household rhythm."
      ),
      example(
        "ch31-ex04",
        "Manager wants calm at home but improvises every night",
        ["work"],
        "A busy manager wants less chaos with the family after work, but every evening is improvised under fatigue, so devices and random tasks keep taking over.",
        [
          "Use shared planning to reduce nightly decision chaos.",
          "Create a realistic home rhythm that the family can recognize and trust."
        ],
        "The deeper issue is not only personal stress. It is the absence of a shared plan for what home time is trying to protect."
      ),
      example(
        "ch31-ex05",
        "Weekend disappears into drift",
        ["personal"],
        "A family reaches Sunday night feeling like nothing important happened together because the whole weekend was left open to impulse and screens.",
        [
          "Choose a few shared traction blocks before the weekend starts.",
          "Leave space for spontaneity, but not so much that the whole weekend defaults to drift."
        ],
        "This matters because unplanned home time is easy for distraction to colonize. A little structure can protect a lot of value."
      ),
      example(
        "ch31-ex06",
        "Child resists every rule",
        ["personal"],
        "A child resists every household rule partly because the rules always arrive as orders, never as part of a conversation about what the family is trying to make possible.",
        [
          "Invite the child into planning the household traction the rules are meant to protect.",
          "Build some ownership into the structure."
        ],
        "The chapter applies here because buy in improves when people can see the purpose of a plan and feel some participation in it."
      ),
    ],
    questions: [
      question(
        "ch31-q01",
        "What is the core idea of planning traction together at home?",
        [
          "Turn shared values into visible time instead of leaving home life to drift",
          "Schedule every minute rigidly",
          "Treat home as the place with no structure at all",
          "Focus only on chores",
        ],
        0
      ),
      question(
        "ch31-q02",
        "Why does shared planning improve buy in?",
        [
          "People support plans more readily when they had some voice in shaping them",
          "Children prefer rules they never heard discussed",
          "Participation removes the need for boundaries",
          "Buy in matters only for adults",
        ],
        0
      ),
      question(
        "ch31-q03",
        "What should a family name clearly when planning traction?",
        [
          "The domains that matter, such as homework, rest, play, chores, and connection",
          "Only the most urgent tasks",
          "Only screen limits",
          "Only parent priorities",
        ],
        0
      ),
      question(
        "ch31-q04",
        "Why does the chapter keep some autonomy inside structure?",
        [
          "Too much rigidity can create resistance and weaken ownership",
          "Because structure never matters",
          "Because children should control everything",
          "Because routines are always oppressive",
        ],
        0
      ),
      question(
        "ch31-q05",
        "What do predictable rhythms reduce in a home?",
        [
          "Daily conflict and constant renegotiation",
          "The need for connection",
          "The value of planning",
          "The need for review",
        ],
        0
      ),
      question(
        "ch31-q06",
        "How does planning make distraction easier to spot?",
        [
          "Once everyone knows what the time is for, detours become clearer",
          "It eliminates all temptations",
          "It makes spontaneity impossible",
          "It works only on weekends",
        ],
        0
      ),
      question(
        "ch31-q07",
        "Why should the family review the plan together?",
        [
          "To keep the schedule realistic and trusted rather than rigid and brittle",
          "To prove the first version was wrong",
          "To avoid letting children speak",
          "To replace routines with improvisation",
        ],
        0
      ),
      question(
        "ch31-q08",
        "What role do adults play in making family traction real?",
        [
          "They model whether the shared rhythms and boundaries are actually respected",
          "They are less influential than the children",
          "They should exempt themselves from the plan",
          "They matter only during conflict",
        ],
        0
      ),
      question(
        "ch31-q09",
        "What broader lesson does the chapter teach children?",
        [
          "How priorities become time through shared planning",
          "How rules replace values",
          "How to avoid all tradeoffs",
          "How to depend on improvisation",
        ],
        0
      ),
      question(
        "ch31-q10",
        "What is the chapter's central standard for home life?",
        [
          "Home time should intentionally reflect what the family says it values",
          "The loudest distraction should decide",
          "Family plans should stay entirely private",
          "Only work calendars deserve seriousness",
        ],
        0
      ),
    ],
  }),
  chapter({
    chapterId: "ch32-help-kids-external-triggers",
    number: 32,
    title: "Help Children Handle External Triggers",
    readingTimeMinutes: 14,
    summary: {
      p1: t(
        "Helping children handle external triggers means teaching them how cues, notifications, defaults, and persuasive design influence attention and then reshaping those cues with them.",
        "Eyal does not reduce the issue to taking devices away. He shows how children can learn to recognize and redesign the triggers acting on them.",
        "This makes attention support more educational and more durable."
      ),
      p2: t(
        "This matters because children are growing up inside environments deliberately built to pull on impulse and curiosity.",
        "When adults help them change settings, remove cues, and understand what the trigger is doing, children gain practical leverage instead of only receiving commands.",
        "The deeper lesson is that external trigger literacy is a life skill. A child who can read the cue is better equipped to choose around it."
      ),
    },
    standardBullets: [
      bullet(
        "Triggers are teaching every day. Notifications, badges, autoplay, and visual prompts all shape what feels worthy of attention.",
        "Children need help learning that these cues are designed, not magical.",
        "Naming design reduces passivity.",
        "A child who sees the trigger more clearly is less likely to mistake it for pure desire."
      ),
      bullet(
        "Do not wait for self control alone. Reduce the cue load where possible by changing settings, placement, and access.",
        "This follows the same design logic used throughout the book.",
        "Environment should help the child succeed.",
        "Expecting discipline in a cue saturated environment is often unfair and ineffective."
      ),
      bullet(
        "Make the cues visible and discussable. A child can learn to notice what kinds of prompts pull attention most strongly.",
        "That awareness turns a vague habit into something observable.",
        "Observation is the first step toward agency.",
        "Once a cue is named, it becomes easier to redesign."
      ),
      bullet(
        "Use settings as tools, not as secrets. Explain why a notification is being changed or an app is being moved.",
        "This helps the child learn the logic, not only submit to it.",
        "Education increases durability.",
        "Children are more likely to internalize a rule when they understand the mechanism it addresses."
      ),
      bullet(
        "Reduce default temptation. The easiest path on a device should not point straight toward the most distracting option.",
        "Home screens, app placement, and permissions matter here.",
        "Defaults train behavior quietly.",
        "A child should not have to beat the strongest temptation every time the screen wakes up."
      ),
      bullet(
        "Create context specific rules. The right trigger protections may differ across homework time, bedtime, social time, and travel.",
        "Fit keeps rules more believable and useful.",
        "One blanket rule is not always the smartest rule.",
        "Context aware design teaches judgment instead of only obedience."
      ),
      bullet(
        "Adults should model trigger management too. Children learn more when they see grown ups turning off notifications, moving devices, and choosing focused presence.",
        "Modeling turns the lesson into household culture.",
        "The rule becomes shared rather than imposed.",
        "Advice is stronger when the adult is living it too."
      ),
      bullet(
        "Make the better option easier. A cue loses power when an alternative activity, tool, or space is ready and more inviting.",
        "This is why replacement matters alongside removal.",
        "Protection works better when the child still has somewhere meaningful to go next.",
        "An empty vacuum can make the forbidden cue feel even more magnetic."
      ),
      bullet(
        "Review which triggers still break through. The chapter is not about one perfect setup, but about ongoing observation and adjustment.",
        "Children's habits and devices change.",
        "Good design changes with them.",
        "What was once a weak cue can later become a strong one and needs to be noticed."
      ),
      bullet(
        "External trigger skill builds independence. The more a child understands cues and can redesign them, the less every boundary must come from outside authority.",
        "That is the chapter's long term goal.",
        "A child becomes less acted upon and more aware.",
        "Better cue management is preparation for later self regulation."
      ),
    ],
    deeperBullets: [
      bullet(
        "Children need both protection and explanation. Shielding without teaching leaves them unprepared for later environments where the cues return.",
        "Education turns short term control into longer term skill.",
        "This is one of the chapter's most important balances."
      ),
      bullet(
        "Trigger literacy is a form of dignity. It treats children as minds that can learn how environments work rather than as passive targets to be managed forever.",
        "That raises the quality of guidance.",
        "Respect and structure reinforce each other here."
      ),
      bullet(
        "A cue is often strongest when it matches a known internal trigger. External trigger management works even better when adults also understand the child's boredom, stress, or loneliness patterns.",
        "The chapter quietly depends on the previous one.",
        "Design and diagnosis belong together."
      ),
      bullet(
        "Rules that feel arbitrary become easier to resist secretly. Mechanistic understanding creates better internal cooperation.",
        "That is why explaining autoplay or notifications matters.",
        "Understanding turns the child into a partner in design."
      ),
      bullet(
        "The long game is self authored environments. A child who learns to move cues, mute prompts, and choose contexts is practicing a lifelong attention skill.",
        "The immediate benefit is less distraction.",
        "The deeper benefit is authorship."
      ),
    ],
    takeaways: [
      "Cues are designed",
      "Reduce cue load where possible",
      "Explain the settings",
      "Use context specific protections",
      "Model trigger management",
      "Teach long term cue literacy",
    ],
    practice: [
      "Notice one strong external trigger affecting a child",
      "Change one setting or placement with the child, not only for the child",
      "Explain why the trigger matters",
      "Prepare one easier alternative activity",
      "Review whether the trigger still breaks through next week",
    ],
    examples: [
      example(
        "ch32-ex01",
        "Homework derailed by notifications",
        ["school"],
        "A student's homework keeps breaking because school work and social notifications live on the same device with equal interruption rights.",
        [
          "Reduce the cue load during homework by changing settings and layout with the student.",
          "Explain what the notifications are doing to attention."
        ],
        "This matters because external triggers often beat children before they have much chance to choose. Better cue design gives them a fairer start."
      ),
      example(
        "ch32-ex02",
        "Tablet default opens into games",
        ["school"],
        "A child opens a tablet for one school related task, but the first screen presents games and videos more prominently than the useful option.",
        [
          "Redesign the default so the intended task is easier to reach than the tempting alternatives.",
          "Use the setup as a teaching moment about cues and convenience."
        ],
        "The chapter helps because defaults teach behavior. A device can either support the child or keep competing with the goal."
      ),
      example(
        "ch32-ex03",
        "Parent notices work notifications around kids",
        ["work"],
        "A parent wants a child to manage device triggers better, but at home the child also watches the parent respond instantly to every work cue.",
        [
          "Model the same trigger management you want the child to learn.",
          "Show that notifications are choices, not commands."
        ],
        "This work linked example shows why explanation alone is not enough. Children learn the household norm from adult behavior too."
      ),
      example(
        "ch32-ex04",
        "Mentor sees intern checking every ping",
        ["work"],
        "A mentor notices a young intern checking every message and alert, and instead of scolding only the behavior, teaches how to adjust cues and protect work blocks.",
        [
          "Use the moment to teach external trigger literacy, not just etiquette.",
          "Change the environment so the intern can practice the lesson immediately."
        ],
        "The broader principle works at work too. People become more independent when they can read and redesign cues."
      ),
      example(
        "ch32-ex05",
        "Bedtime derailed by autoplay",
        ["personal"],
        "A child intends to stop after one video at night, but autoplay and easy access keep extending the session beyond the original plan.",
        [
          "Adjust the setting and context so the cue chain is weaker before bedtime begins.",
          "Explain how autoplay is designed to keep going."
        ],
        "This matters because good rules can fail against engineered continuation if the environment stays unchanged."
      ),
      example(
        "ch32-ex06",
        "Family says no phones but leaves them everywhere",
        ["personal"],
        "A household wants less screen drift, but phones and tablets stay in every common space with full notifications, so the cues keep defeating the rule.",
        [
          "Reduce the trigger density in the environment instead of relying only on repeated reminders.",
          "Make the better home norm easier to follow."
        ],
        "The chapter applies here because external triggers are environmental facts, not just personal intentions. Better homes manage the cues more deliberately."
      ),
    ],
    questions: [
      question(
        "ch32-q01",
        "What is the main idea of helping children with external triggers?",
        [
          "Teach them to notice and redesign cues instead of only commanding behavior",
          "Remove every device permanently",
          "Trust self control without environment changes",
          "Ignore how settings affect attention",
        ],
        0
      ),
      question(
        "ch32-q02",
        "Why should adults reduce cue load where possible?",
        [
          "Because children should not have to fight a saturated environment with pure willpower alone",
          "Because cues never matter",
          "Because design only works for adults",
          "Because rules are enough on their own",
        ],
        0
      ),
      question(
        "ch32-q03",
        "Why is it useful to explain the settings change to a child?",
        [
          "So the child learns the logic of the cue, not only the rule",
          "So the child can debate every limit forever",
          "So settings become more secret",
          "Because explanation replaces boundaries",
        ],
        0
      ),
      question(
        "ch32-q04",
        "What is one reason default layouts matter so much?",
        [
          "They quietly make some behaviors easier and more likely than others",
          "They only affect visual style",
          "They matter only for games",
          "Children never notice them",
        ],
        0
      ),
      question(
        "ch32-q05",
        "Why should rules be context specific in this chapter?",
        [
          "Because homework, bedtime, and play may need different trigger protections",
          "Because one blanket rule is always best",
          "Because context never affects temptation",
          "Because children dislike consistency",
        ],
        0
      ),
      question(
        "ch32-q06",
        "What role does adult modeling play here?",
        [
          "Children learn trigger management more deeply when they see adults practice it too",
          "Modeling matters less than lectures",
          "Adults should keep their own cues untouched",
          "Modeling only affects toddlers",
        ],
        0
      ),
      question(
        "ch32-q07",
        "Why should adults prepare easier alternatives alongside removing triggers?",
        [
          "Because protection works better when the child still has a meaningful next option",
          "Because alternatives make cues stronger",
          "Because boredom should never exist",
          "Because replacement only matters for school work",
        ],
        0
      ),
      question(
        "ch32-q08",
        "What does the chapter suggest about reviewing triggers over time?",
        [
          "The setup should be adjusted as habits and devices change",
          "One perfect setup lasts forever",
          "Review weakens authority",
          "Only experts can notice trigger changes",
        ],
        0
      ),
      question(
        "ch32-q09",
        "What is a deeper benefit of trigger literacy?",
        [
          "It builds long term independence in how children manage their environments",
          "It makes external triggers disappear permanently",
          "It removes the need for values",
          "It matters only at home",
        ],
        0
      ),
      question(
        "ch32-q10",
        "What is the chapter's main standard?",
        [
          "Help children understand and redesign cues so attention is less at the mercy of them",
          "Let devices keep their strongest defaults",
          "Use rules without explanation whenever possible",
          "Treat every cue as equal",
        ],
        0
      ),
    ],
  }),
  chapter({
    chapterId: "ch33-teach-kid-pacts",
    number: 33,
    title: "Teach Children To Make Their Own Pacts",
    readingTimeMinutes: 15,
    summary: {
      p1: t(
        "Teaching children to make their own pacts means helping them set clear limits and commitments for themselves instead of relying only on rules imposed from above.",
        "Eyal argues that children become more indistractable when they participate in defining the boundary, understand why it exists, and use a concrete tool such as a timer or agreed cutoff to enforce it.",
        "The core claim is that self chosen commitments build stronger attention habits than constant parental policing."
      ),
      p2: t(
        "This matters because children eventually have to manage attention without a parent standing nearby.",
        "When they practice making and revising their own pacts, they build autonomy, media literacy, and the belief that their time is theirs to protect.",
        "The deeper lesson is that real self regulation grows through authorship. A child who can make a promise to themselves and keep it is gaining far more than one good screen rule."
      ),
    },
    standardBullets: [
      bullet(
        "A self authored pact matters more. Children are more likely to respect a limit they helped create than one they only received.",
        "Ownership changes the emotional meaning of the rule.",
        "The pact feels like a chosen standard instead of a constant parental interruption.",
        "That shift is crucial because attention skills should survive even when no adult is enforcing them."
      ),
      bullet(
        "Pacts make the future decision easier. A timer, cutoff, or agreed stopping point reduces the need to renegotiate in the hot moment.",
        "This follows the same precommitment logic used earlier in the book.",
        "The best time to set the boundary is before temptation is active.",
        "Clear rules made in advance protect children from having to win the same argument again and again."
      ),
      bullet(
        "Explain the system behind the temptation. Children should understand that games, videos, and apps are built to hold attention for profit.",
        "That does not require paranoia. It requires healthy skepticism.",
        "Media literacy helps the pact make sense.",
        "A child who understands the incentive structure is harder to manipulate passively."
      ),
      bullet(
        "Keep the pact concrete. Vague promises like using screens less are weaker than specific agreements about time, place, or stopping cues.",
        "Clarity makes success visible.",
        "It also makes review more honest.",
        "A clear pact is easier to keep and easier to learn from when it fails."
      ),
      bullet(
        "Start with a pact the child can actually keep. The goal is not to win a dramatic battle, but to build reliable self trust.",
        "A smaller successful commitment usually teaches more than an unrealistic one.",
        "Progress grows from believable promises.",
        "When the child experiences themselves keeping the pact, confidence and identity both strengthen."
      ),
      bullet(
        "Use tools that shift enforcement away from arguments. Timers, schedules, and visible stopping points can carry some of the burden.",
        "That keeps the adult from becoming the whole boundary.",
        "The tool supports the promise.",
        "Less direct policing often means less resentment and better learning."
      ),
      bullet(
        "Review the pact together after real life tests it. A broken pact is information about friction, not proof that the child is hopeless.",
        "Curious review keeps the learning alive.",
        "Adjustment is part of the method.",
        "Children need to see that refinement is normal when a promise did not hold."
      ),
      bullet(
        "Adults should coach, not dominate. Guidance still matters, but the child should feel invited into responsibility rather than trapped by control.",
        "This keeps dignity in the process.",
        "It also builds long term skill.",
        "A child who only obeys an adult has learned something different from a child who can self govern."
      ),
      bullet(
        "Success should shape identity. Each kept pact is evidence that the child can protect time and attention.",
        "Identity grows from repeated proof.",
        "This is how discipline becomes more personal and less externally forced.",
        "Small wins can quietly change how a child sees their own capabilities."
      ),
      bullet(
        "The goal is independence, not endless supervision. A good pact prepares children to act wisely when no one else is watching.",
        "That is why this chapter matters so much.",
        "The method is training for later freedom.",
        "Children become stronger when the boundary gradually becomes theirs."
      ),
    ],
    deeperBullets: [
      bullet(
        "A pact only works if the child feels some genuine choice. Forced participation can imitate collaboration while still teaching powerlessness.",
        "The chapter values guided authorship, not fake autonomy.",
        "Children need to feel that their judgment has a real place in the process."
      ),
      bullet(
        "Precommitment is also emotional education. The child learns that wanting something later does not mean the earlier promise was foolish.",
        "That distinction matters for maturity.",
        "It teaches that impulses can change without becoming the new authority."
      ),
      bullet(
        "A review conversation is where much of the learning happens. It turns a kept pact into confidence and a broken pact into diagnosis.",
        "Without review, the child may only remember the conflict.",
        "Reflection converts events into skill."
      ),
      bullet(
        "Parents who stay in pure enforcer mode can accidentally weaken the child's future competence. The child learns to wait for outside control instead of building inside control.",
        "That is the deeper risk of overpolicing.",
        "Short term compliance can hide long term dependence."
      ),
      bullet(
        "The long game is a child who can create better defaults for themselves. Pacts are not only about one app or one bedtime. They teach authorship over attention.",
        "That is why the chapter belongs near the end of the book.",
        "It turns the method into something the next generation can carry forward."
      ),
    ],
    takeaways: [
      "Let children help write the rule",
      "Use concrete pacts, not vague hopes",
      "Teach why attention is being pulled",
      "Use tools so arguments carry less weight",
      "Review and revise after real tests",
      "Aim for independent self regulation",
    ],
    practice: [
      "Ask the child what limit feels fair and keepable",
      "Turn that answer into one concrete pact",
      "Choose a timer, schedule, or other visible enforcement tool",
      "Explain the attention grabbing design behind the tempting app or show",
      "Review together after a week and adjust the pact if needed",
    ],
    examples: [
      example(
        "ch33-ex01",
        "Student chooses a research cutoff",
        ["school"],
        "A middle school student needs a laptop for homework but keeps sliding from research into videos and then argues when a parent tries to end the session.",
        [
          "Help the student create a clear stopping pact before work begins, such as finishing one assignment and then taking a timed break.",
          "Use a timer or visible checklist so the rule comes from the agreement, not only from a parent's interruption."
        ],
        "This matters because children learn more when they help write the boundary. The pact teaches self management instead of endless bargaining."
      ),
      example(
        "ch33-ex02",
        "Study break turns into endless scrolling",
        ["school"],
        "A high school student says a short break between study blocks keeps stretching into half an hour of scrolling, and every reset becomes another argument at home.",
        [
          "Ask the student to choose a realistic break limit and the signal that ends it.",
          "Review the result later so the student can see whether the pact was clear enough and honest enough."
        ],
        "The chapter helps because precommitment works best when the child defines the promise in calm conditions and then learns from the outcome."
      ),
      example(
        "ch33-ex03",
        "Program director wants less device policing",
        ["work"],
        "An after school program director is tired of staff spending all their energy policing tablet use during free time, which keeps creating the same arguments with the same children.",
        [
          "Shift some responsibility to child authored pacts that define time limits and stopping cues before free time begins.",
          "Teach staff to review the pact with the child later instead of treating every slip as a fresh power struggle."
        ],
        "This work example shows that constant enforcement can consume adults without building real skill in children. Shared pacts create better learning and calmer supervision."
      ),
      example(
        "ch33-ex04",
        "Coach keeps confiscating phones",
        ["work"],
        "A youth coach keeps taking players' phones before practice because the team never stops checking them, but the behavior returns every day.",
        [
          "Have the players help create their own prepractice phone pact and choose how they will enforce it together.",
          "Explain why the cue is strong and let them take part in designing the answer."
        ],
        "The lesson applies at work because leaders who only control from above often get short compliance but weak ownership. Better pacts build discipline inside the group."
      ),
      example(
        "ch33-ex05",
        "Five year old asks for one more episode",
        ["personal"],
        "A young child melts down every night at the end of screen time because the stopping point always feels sudden and personal.",
        [
          "Create a simple self chosen pact using a timer and a small clear rule the child can understand.",
          "Keep the adult in a coaching role so the timer and the agreement carry more of the limit."
        ],
        "This matters because even very young children can begin practicing self authored boundaries when the pact is concrete and developmentally realistic."
      ),
      example(
        "ch33-ex06",
        "Parent keeps becoming the bad guy",
        ["personal"],
        "A parent notices that every digital rule ends with resentment because the child experiences the limit as the parent's control instead of as a shared plan.",
        [
          "Move from commands toward a conversation about what the child wants time for and what pact would protect it.",
          "Use the next slip as a review moment instead of a lecture."
        ],
        "The deeper point is that children need practice governing themselves. If the parent remains the whole boundary, the skill may never fully transfer."
      ),
    ],
    questions: [
      question(
        "ch33-q01",
        "Why are self authored pacts usually stronger for children than imposed rules?",
        [
          "Because they reduce the need for all adult guidance",
          "Because children take more ownership when they help create the limit",
          "Because any child chosen rule is automatically wise",
          "Because they make tempting apps less persuasive",
        ],
        1
      ),
      question(
        "ch33-q02",
        "A parent wants a child to stop watching videos after homework. Which approach best fits the chapter?",
        [
          "Pick a realistic viewing limit with the child and use a timer to enforce the agreement",
          "Wait until the child gets absorbed and then argue about fairness",
          "Hide the device every night without explaining why",
          "Keep repeating that self control should be enough",
        ],
        0
      ),
      question(
        "ch33-q03",
        "Why does the chapter encourage explaining how apps and media compete for attention?",
        [
          "So children feel guilty for enjoying them",
          "So children understand the business incentives shaping the temptation",
          "So parents can frighten children away from all technology",
          "So rules can stay vague and emotional",
        ],
        1
      ),
      question(
        "ch33-q04",
        "What is a sign that a child's pact is too weak?",
        [
          "It is concrete and easy to review",
          "It uses a visible enforcement tool",
          "It was chosen in a calm moment",
          "It sounds like a vague hope instead of a specific commitment",
        ],
        3
      ),
      question(
        "ch33-q05",
        "A child keeps breaking an agreed limit. What is the best next move?",
        [
          "Treat the broken pact as information and review what friction or temptation the pact missed",
          "Conclude that children are too immature for precommitment",
          "Double the punishment without discussion",
          "Abandon the idea of pacts and return to constant supervision",
        ],
        0
      ),
      question(
        "ch33-q06",
        "Why does the chapter recommend starting with a pact the child can actually keep?",
        [
          "Because the first pact should eliminate all temptation forever",
          "Because believable promises build self trust and identity",
          "Because children should never be challenged",
          "Because small pacts matter only until high school",
        ],
        1
      ),
      question(
        "ch33-q07",
        "What is the risk if adults stay only in enforcer mode?",
        [
          "Children may wait for outside control instead of learning inside control",
          "Children become too confident too quickly",
          "Technology stops being attractive",
          "Review conversations become unnecessary",
        ],
        0
      ),
      question(
        "ch33-q08",
        "A coach wants players off their phones before practice. Which response follows the chapter best?",
        [
          "Confiscate devices every day and avoid discussion",
          "Ask the team to create a prepractice phone pact and choose how to enforce it",
          "Ignore the issue because sports already build discipline",
          "Keep changing the rule based on the coach's mood",
        ],
        1
      ),
      question(
        "ch33-q09",
        "What is the deeper purpose of reviewing a kept or broken pact with a child?",
        [
          "To make the child feel monitored",
          "To convert the experience into skill and better self understanding",
          "To show that all rules are temporary",
          "To prove that adults already knew the right answer",
        ],
        1
      ),
      question(
        "ch33-q10",
        "What long term outcome is the chapter aiming for?",
        [
          "Children who follow rules only when adults are present",
          "Children who avoid all screens permanently",
          "Children who can author and protect their own attention over time",
          "Children who never need adjustment after a setback",
        ],
        2
      ),
    ],
  }),
  chapter({
    chapterId: "ch34-social-antibodies",
    number: 34,
    title: "Friendships Need Defenses Against Distraction",
    readingTimeMinutes: 16,
    summary: {
      p1: t(
        "Friendships need defenses against distraction because divided attention spreads socially and weakens the quality of time people share together.",
        "Eyal introduces the idea of social antibodies, which are group norms that gently resist habits such as checking phones in the middle of connection.",
        "The chapter's central point is that friendship quality depends partly on what a group treats as acceptable interruption."
      ),
      p2: t(
        "This matters because distraction is contagious. One person's drift can quietly give everyone else permission to drift too.",
        "When friends develop better norms, they protect conversation, trust, and the sense that being together is worth full presence.",
        "The deeper lesson is that relationships are shaped by culture as much as by intention. Strong connection needs social standards, not only private good wishes."
      ),
    },
    standardBullets: [
      bullet(
        "Distraction spreads socially. When one person checks out, others often follow without much thought.",
        "That is why the chapter treats distraction as contagious behavior, not only a private habit.",
        "Groups absorb cues quickly.",
        "A room can lose depth before anyone openly decides to stop paying attention."
      ),
      bullet(
        "Social antibodies are protective norms. They are the informal expectations that make distracting behavior feel less acceptable in shared time.",
        "The comparison is to how societies changed around smoking.",
        "Norms can shift over time.",
        "What once felt ordinary can later feel clearly out of place."
      ),
      bullet(
        "Friends should make distraction visible. A tactful question can interrupt mindless phone use without turning the moment into a fight.",
        "The point is awareness, not humiliation.",
        "Gentle honesty works better than silent resentment.",
        "Often the person is barely aware how much they have drifted."
      ),
      bullet(
        "Care should frame correction. Asking whether everything is all right gives space for a real emergency while also signaling that presence matters here.",
        "This keeps the norm human.",
        "Concern is more effective than scolding.",
        "A good social antibody protects the relationship while defending the interaction."
      ),
      bullet(
        "Phones are not the only threat. Televisions, background media, and constant interruptions can also fracture shared attention.",
        "The chapter is really about protecting presence from whatever keeps splitting it.",
        "Devices are common, but not unique.",
        "Any recurring interruption can weaken closeness if the group keeps tolerating it."
      ),
      bullet(
        "Hosts and planners can help. A setting designed for conversation gives better behavior a better chance.",
        "Seating, screens, timing, and activity all matter.",
        "Good gatherings are lightly designed.",
        "Social norms grow faster when the environment supports them."
      ),
      bullet(
        "State the norm early when useful. If a group wants deeper connection, saying so out loud can prevent confusion later.",
        "This makes the expectation shared instead of implied.",
        "Clarity reduces awkwardness.",
        "People often cooperate better when they know what kind of time they are agreeing to have."
      ),
      bullet(
        "Do not rely on private annoyance. Unspoken irritation usually lets the distracting habit keep winning.",
        "A friendship improves when people can name what is weakening the time together.",
        "Silence protects the old pattern.",
        "Norms change only after someone is willing to surface the cost."
      ),
      bullet(
        "Protecting presence strengthens closeness. Better attention makes conversations warmer, richer, and more memorable.",
        "The benefit is relational, not merely polite.",
        "Presence is how bonds deepen.",
        "Attention is one of the clearest gifts friends can give each other."
      ),
      bullet(
        "A healthy friend group guards what it values. If connection matters, the group should build customs that defend it.",
        "This is the chapter's closing standard.",
        "Relationships improve when the norm improves.",
        "Friendship gets stronger when shared time stops being treated as disposable."
      ),
    ],
    deeperBullets: [
      bullet(
        "Social antibodies are a cultural immune system. They do not eliminate all distraction, but they help a group recognize and correct drift before it becomes the norm.",
        "That makes them preventive, not merely reactive.",
        "Healthy cultures recover faster because they can detect what is weakening them."
      ),
      bullet(
        "One person's phone use changes the moral weather of the room. It quietly lowers the standard for everyone else.",
        "That is why small acts matter socially.",
        "The group learns from what it sees tolerated."
      ),
      bullet(
        "People often avoid naming distraction because they fear seeming controlling. The chapter argues that tactful care is kinder than letting shallow connection become normal.",
        "Kindness sometimes requires a small social risk.",
        "Silence can be the less caring option."
      ),
      bullet(
        "The deepest loss is not etiquette but intimacy. Fragmented gatherings may still look social while failing to create real closeness.",
        "A fun evening can remain oddly thin when no one is fully there.",
        "Attention quality shapes emotional quality."
      ),
      bullet(
        "Norms become durable when the group co owns them. A friendship circle that talks openly about presence can defend it far better than one person privately trying to hold the line.",
        "Shared standards reduce friction and defensiveness.",
        "The group becomes part of the solution."
      ),
    ],
    takeaways: [
      "Distraction is socially contagious",
      "Groups need norms that protect presence",
      "Make drift visible with tact",
      "Design gatherings for connection",
      "Silence keeps weak norms alive",
      "Friendship grows where attention is protected",
    ],
    practice: [
      "Notice one social setting where divided attention keeps becoming normal",
      "Decide what better norm would protect the interaction",
      "Use one tactful phrase to make drift visible when it happens",
      "Reduce one environmental distraction before the next gathering",
      "Talk with friends about what kind of presence the group wants to protect",
    ],
    examples: [
      example(
        "ch34-ex01",
        "Study group keeps fragmenting",
        ["school"],
        "A study group meets to prepare for exams, but every time one person grabs a phone, the whole table slowly drifts into side conversations and scrolling.",
        [
          "Name the pattern and agree on a simple group norm for phones during work blocks.",
          "Use a tactful reminder when someone slips instead of letting the group silently dissolve."
        ],
        "This matters because distraction spreads fast in groups. A better norm can protect everyone's focus and improve the quality of the time together."
      ),
      example(
        "ch34-ex02",
        "Friends hang out after class but never connect deeply",
        ["school"],
        "A group of college friends keeps meeting between classes, yet the time feels thin because everyone is half present and half checking updates.",
        [
          "Acknowledge that the group wants more real connection and set a clearer expectation for phone free conversation during part of the hangout.",
          "Choose a setting with fewer background screens if possible."
        ],
        "The chapter helps because weak presence can become normal without anyone meaning for it to. Social antibodies restore the standard."
      ),
      example(
        "ch34-ex03",
        "Team lunch becomes silent scrolling",
        ["work"],
        "Coworkers say they want team lunches to strengthen relationships, but the moment food arrives the table fills with phones and attention collapses.",
        [
          "Make the cost visible and suggest one simple norm that protects part of the meal for real conversation.",
          "Frame it around better connection, not around moral superiority."
        ],
        "This work example shows that social time does not automatically create closeness. Presence has to be protected if the relationship benefit is going to happen."
      ),
      example(
        "ch34-ex04",
        "Offsite conversation keeps getting broken",
        ["work"],
        "At an offsite, coworkers are finally having an honest conversation, but constant checking of messages keeps breaking the momentum before trust can build.",
        [
          "Ask whether the interruptions are urgent and agree on a better standard for the rest of the discussion.",
          "Reduce obvious external triggers in the room so the norm is easier to keep."
        ],
        "The principle applies at work because group attention shapes the depth of conversation. Better norms can create a safer and more useful social environment."
      ),
      example(
        "ch34-ex05",
        "Dinner with friends turns into parallel scrolling",
        ["personal"],
        "A friend group meets for dinner, but the table keeps disappearing into phones whenever there is a pause in conversation.",
        [
          "Introduce a tactful phrase or shared norm that makes the drift visible without turning aggressive.",
          "Protect the meal as time that deserves fuller presence."
        ],
        "This matters because friendships are built in ordinary moments like these. If drift keeps winning, the relationship slowly gets thinner."
      ),
      example(
        "ch34-ex06",
        "Game night competes with the television",
        ["personal"],
        "A group wants game night to feel lively, but a loud television in the background keeps pulling eyes and comments away from the people in the room.",
        [
          "Treat the television as part of the distraction problem and remove it from the setting.",
          "Design the environment so the social norm has a better chance to hold."
        ],
        "The chapter is broader than phone etiquette. Friendships deepen more easily when the whole environment supports shared attention."
      ),
    ],
    questions: [
      question(
        "ch34-q01",
        "What does the idea of social antibodies refer to?",
        [
          "Private habits people use when they are alone",
          "Informal group norms that resist distracting behavior in shared time",
          "Strict punishments for friends who check phones",
          "Apps that block social media during meals",
        ],
        1
      ),
      question(
        "ch34-q02",
        "Why does the chapter treat distraction among friends as especially important?",
        [
          "Because distraction spreads socially and weakens real connection",
          "Because friendship time should never include devices of any kind",
          "Because social settings matter less than work settings",
          "Because people are more rational in groups",
        ],
        0
      ),
      question(
        "ch34-q03",
        "A friend keeps checking a phone during dinner. Which response best fits the chapter?",
        [
          "Say nothing and hope the behavior stops on its own",
          "Mock the friend so the norm becomes clear",
          "Use a tactful question that makes the distraction visible while leaving room for a real emergency",
          "Start checking your own phone too so the moment feels less awkward",
        ],
        2
      ),
      question(
        "ch34-q04",
        "Why are norms compared to smoking rules in the chapter?",
        [
          "To show that social expectations can shift and make harmful behavior less acceptable",
          "To argue that phones and smoking are the same type of health risk",
          "To prove rules should always come from law",
          "To show that friends need strict punishment systems",
        ],
        0
      ),
      question(
        "ch34-q05",
        "What is one mistake the chapter warns against?",
        [
          "Designing the setting to support conversation",
          "Letting private annoyance replace an honest conversation about the norm",
          "Protecting part of a gathering for fuller presence",
          "Treating background media as a potential distraction too",
        ],
        1
      ),
      question(
        "ch34-q06",
        "Why does the chapter care about televisions and background media too?",
        [
          "Because any recurring interruption can fracture shared attention, not only phones",
          "Because only older people are distracted by them",
          "Because social norms apply only to screens on tables",
          "Because background media always improves gatherings",
        ],
        0
      ),
      question(
        "ch34-q07",
        "A host wants deeper conversation at a gathering. What should they do?",
        [
          "Rely entirely on guests to improvise better habits",
          "Design the setting and expectation so presence is easier to maintain",
          "Assume good friends do not need social norms",
          "Wait until the end of the night to mention the issue",
        ],
        1
      ),
      question(
        "ch34-q08",
        "What is the deeper loss when group distraction becomes normal?",
        [
          "The group starts violating formal policy",
          "The group becomes less fun in every situation",
          "The gathering can look social while failing to build real closeness",
          "No one will ever want to meet again",
        ],
        2
      ),
      question(
        "ch34-q09",
        "Why is a shared norm usually stronger than one person privately holding the line?",
        [
          "Because group ownership makes the expectation clearer and less defensive",
          "Because norms only work when everyone agrees instantly",
          "Because one person can never influence a group",
          "Because friendship should avoid all awkwardness",
        ],
        0
      ),
      question(
        "ch34-q10",
        "What standard closes the chapter?",
        [
          "Friends should accept divided attention as part of modern life",
          "Good friendships do not need protection from distraction",
          "A healthy group builds customs that defend the connection it says it values",
          "Presence matters only during formal occasions",
        ],
        2
      ),
    ],
  }),
  chapter({
    chapterId: "ch35-indistractable-intimacy",
    number: 35,
    title: "Intimacy Requires Protected Attention",
    readingTimeMinutes: 12,
    summary: {
      p1: t(
        "Intimacy requires protected attention because the person closest to you cannot feel fully met when your mind keeps leaving the room.",
        "Eyal closes the book by showing that distraction is not only a productivity problem. It reaches into rest, romance, and the most private forms of connection.",
        "The chapter argues that partners need deliberate protection from both digital interruption and the discomfort that sends them toward it."
      ),
      p2: t(
        "This matters because devices often become a socially acceptable escape from boredom, anxiety, awkwardness, or vulnerability inside a relationship.",
        "Simply removing one screen is not enough if the inner urge to flee contact remains untouched. Couples need the full method: understand the trigger, make time, remove cues, and use pacts where needed.",
        "The deeper lesson is that attention is one of the clearest expressions of love. Protecting it is not cosmetic. It is part of keeping faith with the relationship."
      ),
    },
    standardBullets: [
      bullet(
        "Intimacy runs on presence. A partner can be physically near you while still feeling abandoned if your attention keeps leaving.",
        "This is why the chapter treats distraction as relational loss, not only lost efficiency.",
        "Connection depends on felt presence.",
        "Attention is one of the ways love becomes visible."
      ),
      bullet(
        "Devices often serve as escape hatches. People reach for them not only from habit, but to avoid boredom, tension, or emotional exposure.",
        "That links the chapter back to internal triggers.",
        "The screen is often a response to discomfort.",
        "Without naming that, couples can keep arguing about the object while missing the motive."
      ),
      bullet(
        "External triggers matter in the bedroom and at home. Phones, laptops, alerts, and late night internet access can all fracture closeness.",
        "The relationship environment needs design too.",
        "Private space should not be cue saturated by default.",
        "A room filled with interruptions rarely supports deep rest or intimacy."
      ),
      bullet(
        "Removing one device may not solve the problem. If the discomfort remains, people often substitute another distraction.",
        "That is why the method has to go deeper than surface cleanup.",
        "The urge will search for a new outlet.",
        "Real change requires understanding what the distraction is relieving."
      ),
      bullet(
        "Make time for togetherness on purpose. Important connection loses ground when it depends only on whatever time survives the day.",
        "Scheduling is not unromantic here. It is protective.",
        "What matters needs a place to live.",
        "Time that is never claimed is easy for habit and fatigue to steal."
      ),
      bullet(
        "Use effort pacts when needed. Turning off internet access, moving devices out of reach, or creating evening cutoffs can support the relationship.",
        "A pact is useful when clear intention keeps collapsing in the same place.",
        "The goal is less temptation at the vulnerable hour.",
        "Design can help couples stop fighting the same predictable battle."
      ),
      bullet(
        "Talk openly about the real cost. Partners need language for how distraction is affecting closeness, not only annoyance about a device.",
        "Honest naming creates a better target for change.",
        "The issue is emotional before it is technical.",
        "A clearer conversation makes better agreements possible."
      ),
      bullet(
        "Protect sleep as part of intimacy. Exhaustion and late night digital drift can erode both mood and connection.",
        "Rest is relationship infrastructure.",
        "A tired couple is more distractible and less generous.",
        "Better evenings often begin with fewer cues pulling the night apart."
      ),
      bullet(
        "Repair should matter more than perfection. Slips are not proof that the relationship goal was fake.",
        "What matters is noticing the drift and returning to the promise.",
        "Gentle correction keeps the system alive.",
        "Shame can make the next escape even more likely."
      ),
      bullet(
        "An indistractable partner keeps choosing the relationship. That is the chapter's closing standard.",
        "The promise is not flawless attention every second.",
        "It is repeated, protected return.",
        "Love gets stronger when attention stops being left to chance."
      ),
    ],
    deeperBullets: [
      bullet(
        "Intimate distraction is often the most revealing kind because it shows what we do when no audience is grading us. Private habits expose private priorities.",
        "That gives the chapter unusual honesty.",
        "The final test of attention may happen at home, not at work."
      ),
      bullet(
        "A couple can remove the device and still keep the avoidance. The deeper work is learning to stay with the discomfort that once sent both people elsewhere.",
        "This is why internal trigger skill remains essential at the end of the book.",
        "Surface order without emotional courage may not last."
      ),
      bullet(
        "Pacts in relationships should protect closeness, not become another arena for control. The agreement works best when both people see it as service to the bond.",
        "Shared intention matters here.",
        "A pact imposed like punishment can damage the very connection it was meant to defend."
      ),
      bullet(
        "Attention in love is cumulative. Many small moments of partial presence can quietly reduce trust, warmth, and desire over time.",
        "The loss may feel subtle until it is not.",
        "Tiny fractures repeated often can reshape the relationship climate."
      ),
      bullet(
        "Protected attention is a form of honoring. It tells the other person that convenience, news, and endless input do not automatically outrank shared life.",
        "That is why the chapter ends the book here.",
        "Choosing presence is one of the strongest everyday signals of value."
      ),
    ],
    takeaways: [
      "Presence is essential to intimacy",
      "Screens often mask discomfort",
      "Private spaces need trigger control too",
      "Use pacts when repeated drift keeps winning",
      "Talk about the real relational cost",
      "Protected attention is a form of love",
    ],
    practice: [
      "Notice where shared time keeps being interrupted at home",
      "Name the feeling that often sends you or your partner toward a screen",
      "Choose one protected block for connection or rest",
      "Remove one repeating cue from the bedroom or evening routine",
      "Use a pact if the same digital drift keeps returning",
    ],
    examples: [
      example(
        "ch35-ex01",
        "College couple studies together but never fully arrives",
        ["school"],
        "Two students say they want more meaningful time together, but every shared evening becomes half studying and half drifting into separate feeds whenever the work gets tiring.",
        [
          "Set a clear study period and a clear device free period so the time stops blending into one distracted block.",
          "Talk about the discomfort that sends each person away from the interaction."
        ],
        "This matters because intimacy is weakened when together time is always partial. Protected attention helps the relationship feel real again."
      ),
      example(
        "ch35-ex02",
        "Late night messages crowd out connection",
        ["school"],
        "A student couple keeps bringing phones into bed because class chats, club messages, and updates feel impossible to ignore at night.",
        [
          "Create an evening cutoff and move the devices away from the bed so the cue is weaker when both are tired.",
          "Treat the arrangement as a shared pact serving the relationship."
        ],
        "The chapter helps because private closeness needs environmental protection too. Good intentions usually lose when the strongest cues stay in reach."
      ),
      example(
        "ch35-ex03",
        "Work email keeps entering dinner",
        ["work"],
        "One partner says they are listening at dinner, but work email keeps pulling glances and fragmented replies into the conversation.",
        [
          "Agree on a protected dinner window and change the cue pattern that keeps work entering it.",
          "Discuss whether the device is handling true urgency or only habitual anxiety."
        ],
        "This work linked example shows that relationship strain often comes from repeated small interruptions, not only dramatic conflict."
      ),
      example(
        "ch35-ex04",
        "Both partners decompress by disappearing online",
        ["work"],
        "After draining workdays, both partners collapse into separate digital escapes at night and then wonder why they feel disconnected.",
        [
          "Acknowledge that the screens are soothing discomfort, not merely filling time.",
          "Create one easier path into shared rest or conversation before the automatic drift begins."
        ],
        "The deeper lesson is that external cleanup alone is not enough. Couples need a better answer to the tired feelings that make escape attractive."
      ),
      example(
        "ch35-ex05",
        "Bedroom has become another screen space",
        ["personal"],
        "A couple notices the bedroom now feels like an extension of the internet, with each person browsing until sleep and almost no real unwinding together.",
        [
          "Remove the strongest cues from the room and use a firm evening pact if needed.",
          "Protect the space for rest, conversation, and closeness instead of endless input."
        ],
        "This matters because private spaces teach habits. When the room is built for distraction, intimacy has to fight uphill every night."
      ),
      example(
        "ch35-ex06",
        "One partner feels ignored but talks only about the phone",
        ["personal"],
        "A partner keeps complaining about device use, but the deeper pain is feeling less chosen and less seen during the time they hoped would feel shared.",
        [
          "Talk about the relational cost directly instead of arguing only about the object in someone's hand.",
          "Use the full method to protect the time, the cues, and the underlying discomfort."
        ],
        "The chapter helps because device conflict is often really about neglected presence. The relationship improves when the true wound gets named."
      ),
    ],
    questions: [
      question(
        "ch35-q01",
        "What is the chapter's main claim about intimacy and attention?",
        [
          "Intimacy depends on protected presence, not only physical proximity",
          "Intimacy is threatened only by phones in the bedroom",
          "Romance should never involve structure",
          "Attention matters more at work than at home",
        ],
        0
      ),
      question(
        "ch35-q02",
        "Why does the chapter link relationship distraction back to internal triggers?",
        [
          "Because people often use devices to escape discomfort inside the relationship moment",
          "Because external triggers do not matter in private life",
          "Because intimacy removes boredom completely",
          "Because emotional discomfort is always a sign the relationship is failing",
        ],
        0
      ),
      question(
        "ch35-q03",
        "A couple removes phones from the bedroom but starts using laptops there instead. What does that show?",
        [
          "The original rule was too strict",
          "The deeper discomfort driving the escape is still active",
          "Laptops are less distracting than phones",
          "Protected attention is unrealistic for most couples",
        ],
        1
      ),
      question(
        "ch35-q04",
        "Why does the chapter defend scheduling time for togetherness?",
        [
          "Because planning makes relationships feel less spontaneous",
          "Because meaningful connection usually loses if it depends only on leftover time",
          "Because couples should spend every hour together",
          "Because schedules solve internal triggers on their own",
        ],
        1
      ),
      question(
        "ch35-q05",
        "What is the best use of a pact in a relationship according to the chapter?",
        [
          "To punish the partner who slips first",
          "To create a shared structure that protects closeness where intention keeps collapsing",
          "To avoid talking about why the distraction is happening",
          "To prove which partner has more discipline",
        ],
        1
      ),
      question(
        "ch35-q06",
        "A partner keeps talking only about the phone itself, while the real hurt is feeling unseen. What is missing?",
        [
          "A more expensive blocking app",
          "A stricter nightly punishment",
          "A conversation about the true relational cost of divided attention",
          "A promise to never use screens again",
        ],
        2
      ),
      question(
        "ch35-q07",
        "Why does the chapter mention sleep when discussing intimacy?",
        [
          "Because rest shapes mood, presence, and the couple's ability to connect well",
          "Because tired people need more entertainment",
          "Because sleep and intimacy are unrelated",
          "Because sleep problems are always caused by technology",
        ],
        0
      ),
      question(
        "ch35-q08",
        "What does the chapter suggest after a couple slips back into digital drift one night?",
        [
          "Treat the slip as proof the relationship goal was fake",
          "Repair and return to the promise instead of turning the setback into shame",
          "Drop the pact because it failed once",
          "Argue about whose fault it was before changing anything else",
        ],
        1
      ),
      question(
        "ch35-q09",
        "What is the deeper value of protected attention in a relationship?",
        [
          "It signals that convenience and endless input do not automatically outrank shared life",
          "It makes all tension disappear",
          "It proves one partner is morally stronger",
          "It matters only for couples with children",
        ],
        0
      ),
      question(
        "ch35-q10",
        "What standard ends the book here?",
        [
          "A good partner should never need structure",
          "Love means responding instantly to everyone else all the time",
          "An indistractable partner keeps returning protected attention to the relationship",
          "Private distraction matters less than public distraction",
        ],
        2
      ),
    ],
  }),
  chapter({
    chapterId: "ch26-distraction-is-dysfunction",
    number: 26,
    title: "Chronic Distraction Signals System Problems",
    readingTimeMinutes: 13,
    summary: {
      p1: t(
        "Chronic distraction signals system problems because workplaces that constantly pull people off task are often revealing deeper issues in priorities, processes, trust, or leadership.",
        "Eyal argues that not all distraction should be blamed on individual weakness. Sometimes the environment itself is organized around fragmentation.",
        "That moves the conversation from personal guilt toward system diagnosis."
      ),
      p2: t(
        "This matters because people can internalize dysfunction and call it normal work.",
        "When interruption, ambiguity, and reactive busyness are built into the system, individual hacks help only up to a point.",
        "The deeper lesson is that distraction can be a symptom. If everyone is struggling in the same way, the problem may be collective design more than private character."
      ),
    },
    standardBullets: [
      bullet(
        "Recurring distraction at scale is data. When many people are fragmented in similar ways, the pattern points beyond individual weakness.",
        "That is why the chapter asks leaders to diagnose the environment.",
        "Shared symptoms often reflect shared causes.",
        "A system that produces constant drift deserves scrutiny, not only lectures."
      ),
      bullet(
        "Ambiguous priorities create reactive work. When people are unsure what matters most, they stay busy on whatever is loudest.",
        "This is a structural invitation to distraction.",
        "Clarity is therefore a focus intervention.",
        "A team without ranked priorities becomes easy prey for urgency theater."
      ),
      bullet(
        "Overused urgency trains permanent interruption. If everything is treated as immediate, nothing gets enough sustained thought.",
        "This damages both quality and calm.",
        "The issue is not only workload. It is the emotional operating mode of the system.",
        "Chronic emergency language can become a workplace addiction."
      ),
      bullet(
        "Poor process turns people into manual patchwork. Broken workflows, unclear ownership, and scattered information force constant switching just to keep things moving.",
        "That is not a discipline problem first.",
        "It is a design problem with attention costs.",
        "People often look distractible when they are actually compensating for a chaotic system."
      ),
      bullet(
        "Psychological strain feeds distraction too. Fear, uncertainty, and politics can keep attention split even when the visible tools are under control.",
        "This broadens the diagnosis beyond notifications and meetings.",
        "Culture affects cognition.",
        "A tense environment makes concentration harder before any device gets involved."
      ),
      bullet(
        "Busyness can hide deeper weakness. Constant visible activity sometimes substitutes for clear thinking, hard decisions, or accountable priorities.",
        "The system can start rewarding motion more than progress.",
        "That produces a lot of distracting work that feels legitimate.",
        "Chronic distraction often survives because it is culturally disguised as diligence."
      ),
      bullet(
        "Individual tactics still help, but they cannot carry a broken system alone. That is the chapter's balance point.",
        "Personal skill matters and so does organizational design.",
        "Both levels must be seen clearly.",
        "A person should not be asked to out discipline a structure built for interruption."
      ),
      bullet(
        "Leaders should read distraction as feedback. The places where people are always pulled apart may show exactly where the system is weakest.",
        "This makes distraction diagnostically useful.",
        "Instead of blaming the symptom, investigate the recurring cause.",
        "Attention failures can reveal process failures surprisingly quickly."
      ),
      bullet(
        "Healthy systems reduce unnecessary decisions. Clear rules, clear tools, and clear ownership lower the amount of attention wasted on coordination chaos.",
        "That is one reason good design feels calmer.",
        "Less ambiguity means less reactive switching.",
        "A stronger system protects cognitive bandwidth by default."
      ),
      bullet(
        "The goal is not only fewer distractions, but better work conditions. Fixing the system helps people think, recover, and collaborate more effectively.",
        "This chapter gives the book organizational seriousness.",
        "Focus is a performance issue and a culture issue.",
        "When distraction becomes normal, something important in the system usually needs repair."
      ),
    ],
    deeperBullets: [
      bullet(
        "A fragmented workplace often rewards visibility over depth. People stay reactive because visible responsiveness is easier to signal than quiet high quality thinking.",
        "That creates incentives against concentration.",
        "System diagnosis has to include what the culture publicly rewards."
      ),
      bullet(
        "Chronic distraction can become self reinforcing. The more fragmented people are, the less time they have to improve the system that is fragmenting them.",
        "That is why the pattern can persist for years.",
        "A broken rhythm protects itself through exhaustion."
      ),
      bullet(
        "The symptom often appears in people first because systems are harder to see than habits. It is easier to tell someone to focus than to redesign priorities, channels, and expectations.",
        "The chapter resists that laziness.",
        "It asks for harder honesty."
      ),
      bullet(
        "Different functions may need different focus protections. A system becomes dysfunctional when it forces one interruptibility standard onto work with very different cognitive demands.",
        "Uniform access norms can produce uneven damage.",
        "Better systems respect the real work being done."
      ),
      bullet(
        "Organizational attention is a strategic asset. A company that burns it casually is not only tiring people out. It is reducing the quality of its decisions and output.",
        "This gives distraction diagnosis executive importance.",
        "The cost is broader than individual frustration."
      ),
    ],
    takeaways: [
      "Shared distraction is system data",
      "Ambiguity creates reactivity",
      "Process chaos taxes attention",
      "Busyness can hide dysfunction",
      "Leaders should diagnose patterns",
      "Focus is an organizational asset",
    ],
    practice: [
      "Identify one recurring distraction pattern shared by several people",
      "Ask what system condition is producing it",
      "Clarify one priority or ownership gap",
      "Notice where urgency language is overused",
      "Treat one attention failure as diagnostic feedback",
    ],
    examples: [
      example(
        "ch26-ex01",
        "Student team always in last minute chaos",
        ["school"],
        "A project group looks individually scattered, but the deeper issue is that no one knows the main priority, ownership is fuzzy, and every deadline becomes a panic scramble.",
        [
          "Treat the distraction as a sign of a weak system, not only weak personal discipline.",
          "Clarify ownership, order of priorities, and how updates should flow."
        ],
        "This matters because repeated shared distraction usually points to shared design failure. Better structure can calm the whole group."
      ),
      example(
        "ch26-ex02",
        "Campus organization runs on urgency",
        ["school"],
        "A student organization calls nearly every issue urgent, so members keep switching tasks and nothing gets enough sustained attention until the final rush.",
        [
          "Redefine urgency and create clearer operating rules instead of treating the stress as normal leadership.",
          "Use the pattern as feedback about the system."
        ],
        "The chapter helps because the problem is not simply that members need more grit. The culture is training distraction."
      ),
      example(
        "ch26-ex03",
        "Company team lives in ping chaos",
        ["work"],
        "A team cannot finish deep work because priorities shift constantly, ownership is unclear, and people keep interrupting one another to patch missing information.",
        [
          "Diagnose the process and priority failures underneath the interruptions.",
          "Fix the system conditions instead of only telling people to focus harder."
        ],
        "This shows why chronic distraction can be a symptom. The work design itself is generating fragmentation."
      ),
      example(
        "ch26-ex04",
        "Manager blames attention but not process",
        ["work"],
        "A manager complains that everyone is distracted, but meetings lack outcomes, requests arrive through too many channels, and nobody knows which work outranks which.",
        [
          "Read the distraction as a response to the system the team is living inside.",
          "Repair clarity, ownership, and channel rules before expecting big behavioral improvement."
        ],
        "The deeper lesson is that leaders often see the symptom first. This chapter asks them to trace it back to design."
      ),
      example(
        "ch26-ex05",
        "Household everyone blames themselves",
        ["personal"],
        "A household keeps feeling scattered, but the real issue is that responsibilities, communication, and routines are so vague that everyone is constantly reacting.",
        [
          "Treat the scattered feeling as a sign that the home system needs clearer expectations.",
          "Reduce unnecessary decision chaos."
        ],
        "This applies outside work because attention problems can grow anywhere unclear systems and constant reaction dominate daily life."
      ),
      example(
        "ch26-ex06",
        "Shared family calendar never trusted",
        ["personal"],
        "Family members keep forgetting plans and interrupting one another because the shared system is inconsistent, rarely updated, and not trusted by anyone.",
        [
          "Fix the reliability of the system instead of only blaming individual follow through.",
          "Use distraction patterns as clues about where trust in the structure has broken down."
        ],
        "The chapter matters because weak systems create weak attention. Better reliability lowers reactive switching for everyone involved."
      ),
    ],
    questions: [
      question(
        "ch26-q01",
        "What does chronic distraction at scale often indicate?",
        [
          "A system problem in priorities, process, or culture",
          "Only personal weakness",
          "Too much technology and nothing else",
          "A lack of ambition",
        ],
        0
      ),
      question(
        "ch26-q02",
        "Why do ambiguous priorities create distraction?",
        [
          "People default to whatever is loudest when what matters most is unclear",
          "They make work more creative",
          "They eliminate urgency",
          "They matter only in large companies",
        ],
        0
      ),
      question(
        "ch26-q03",
        "How can poor process create attention problems?",
        [
          "It forces constant switching just to patch workflow gaps",
          "It removes the need for communication",
          "It makes ownership too clear",
          "It affects only managers",
        ],
        0
      ),
      question(
        "ch26-q04",
        "What does the chapter say about individual tactics?",
        [
          "They help, but they cannot fully compensate for a broken system",
          "They are useless everywhere",
          "They should replace organizational fixes",
          "They matter only when the system is perfect",
        ],
        0
      ),
      question(
        "ch26-q05",
        "Why can busyness be misleading in a dysfunctional environment?",
        [
          "Visible motion can mask unclear priorities and weak decisions",
          "Busy people are always focused",
          "Motion guarantees progress",
          "Distraction never looks like work",
        ],
        0
      ),
      question(
        "ch26-q06",
        "How should leaders use recurring distraction patterns?",
        [
          "As diagnostic feedback about where the system is weakest",
          "As proof that employees do not care",
          "As a reason to add more urgency",
          "As something to ignore once deadlines are met",
        ],
        0
      ),
      question(
        "ch26-q07",
        "What kind of culture often worsens chronic distraction?",
        [
          "One that rewards visible responsiveness over deep thoughtful work",
          "One that clarifies ownership",
          "One that respects different work types",
          "One that limits emergency language",
        ],
        0
      ),
      question(
        "ch26-q08",
        "Why can chronic distraction become self reinforcing?",
        [
          "Fragmentation leaves little time or energy to repair the system causing it",
          "It automatically improves once noticed",
          "It only affects junior people",
          "It reduces exhaustion",
        ],
        0
      ),
      question(
        "ch26-q09",
        "What is one sign a system is healthier?",
        [
          "It reduces unnecessary decisions through clearer rules and ownership",
          "It increases access to everyone at all times",
          "It keeps priorities hidden",
          "It treats every task as equally urgent",
        ],
        0
      ),
      question(
        "ch26-q10",
        "What is the chapter's deeper claim?",
        [
          "Distraction can be a symptom of organizational design, not only an individual flaw",
          "Focus is purely private",
          "System diagnosis is less useful than pressure",
          "Attention has little strategic value",
        ],
        0
      ),
    ],
  }),
  chapter({
    chapterId: "ch27-culture-test",
    number: 27,
    title: "Fixing Distraction Reveals Culture Quality",
    readingTimeMinutes: 14,
    summary: {
      p1: t(
        "Fixing distraction reveals culture quality because the way a group reacts to focus problems exposes whether honesty, trust, and psychological safety are actually present.",
        "Eyal argues that if people cannot raise distraction costs without fear, the issue is not just workflow. It is culture.",
        "Attention becomes a test of whether the workplace can face inconvenient truth."
      ),
      p2: t(
        "This matters because many organizations claim to value deep work, well being, or thoughtful execution while punishing the conversations that would make those things possible.",
        "If people stay silent about overload, interruption, or unrealistic expectations, distraction remains built into the culture.",
        "The deeper lesson is that focus is socially negotiated. A healthy culture lets people surface the real costs of how work is currently being done."
      ),
    },
    standardBullets: [
      bullet(
        "Attention problems are culture questions. How people talk about distraction tells you how safe honesty really is.",
        "That is why the chapter goes beyond tools and process.",
        "The response to the problem matters as much as the problem itself.",
        "A culture that cannot discuss focus honestly cannot improve it sustainably."
      ),
      bullet(
        "Psychological safety matters. People need to be able to say that a norm is breaking concentration without fearing punishment or ridicule.",
        "This is a deeper condition for change.",
        "Silence protects dysfunction.",
        "If raising the issue feels dangerous, distraction will keep winning quietly."
      ),
      bullet(
        "Stated values are tested by response. Many groups say focus matters until a real boundary or process change is proposed.",
        "That reaction reveals what the culture truly rewards.",
        "Attention questions expose the gap between branding and behavior.",
        "Culture becomes visible when values become inconvenient."
      ),
      bullet(
        "Overwork can become identity theater. People may glorify interruption and constant availability because those habits signal loyalty or toughness.",
        "This makes distraction culturally sticky.",
        "The problem is no longer only operational.",
        "A status system built on exhaustion will keep reproducing fragmented attention."
      ),
      bullet(
        "Leaders shape the permission to speak. If managers dismiss focus concerns, the whole culture learns what cannot be said safely.",
        "That is why leadership reaction is central here.",
        "Permission is modeled, not announced.",
        "A leader's casual shrug can silence useful truth for a long time."
      ),
      bullet(
        "Real improvement requires surfacing tradeoffs. Better focus may require slower response in some channels, fewer meetings, or clearer priorities.",
        "Cultures that cannot face tradeoffs stay trapped in slogans.",
        "Honesty is therefore a performance tool.",
        "You cannot redesign work if every cost stays politically untouchable."
      ),
      bullet(
        "Listening to attention pain reveals operational truth. Where people feel constantly split may show where the system is unrealistic or poorly led.",
        "This is why employee experience around distraction is important data.",
        "Focus complaints are not merely personal preference reports.",
        "They can contain hard evidence about how work actually functions."
      ),
      bullet(
        "Shared language helps. Teams improve faster when they can name distraction, traction, and interruption cost clearly.",
        "Language creates a map for better conversations.",
        "Without it, concerns stay fuzzy and easy to dismiss.",
        "Naming the problem well is part of making it discussable."
      ),
      bullet(
        "Cultural change starts with one truthful conversation. Someone has to make the cost visible before the group can decide whether it wants to keep paying it.",
        "This can begin at any level, though power shapes the risk.",
        "Visibility is the first move.",
        "What stays politely hidden keeps governing from underneath."
      ),
      bullet(
        "A healthy culture treats focus as a shared responsibility. It does not dump the burden entirely on individual discipline while keeping the system untouched.",
        "This is the chapter's core standard.",
        "Shared norms create shared protection.",
        "When culture matures, attention stops being only a private struggle and becomes a design concern the group can own."
      ),
    ],
    deeperBullets: [
      bullet(
        "Distraction is politically revealing. The work patterns people feel unable to question often point directly to where power is concentrated and where candor is weak.",
        "That gives the chapter unusual diagnostic sharpness.",
        "Attention complaints can expose hidden power structures."
      ),
      bullet(
        "Silence can look like professionalism. People may comply with destructive attention norms because resistance seems risky or immature.",
        "A culture can therefore mistake suppression for health.",
        "The chapter asks leaders to see through that false calm."
      ),
      bullet(
        "Psychological safety is not softness here. It is what allows the system to receive the information needed for better design.",
        "Fear blocks that information.",
        "A frightened culture cannot learn quickly about its own attention costs."
      ),
      bullet(
        "Attention norms reveal whether trust is real. If leadership trusts people only when they are visibly available at every second, the culture is already saying something important about control and fear.",
        "Focus conflict is rarely only about calendars.",
        "It often reflects deeper beliefs about power and reliability."
      ),
      bullet(
        "One of the strongest signs of a mature culture is the ability to talk about tradeoffs without moral panic. Better focus nearly always requires saying no to some old habits.",
        "That conversation takes courage and trust.",
        "Cultures that can have it tend to improve faster."
      ),
    ],
    takeaways: [
      "Attention problems reveal culture",
      "Psychological safety matters",
      "Values are tested by response",
      "Overwork can become theater",
      "Shared language improves candor",
      "Focus should be a shared responsibility",
    ],
    practice: [
      "Notice how your group reacts when someone raises a focus concern",
      "Name one norm that everyone tolerates but few defend openly",
      "Use clearer language for traction and interruption cost",
      "Surface one tradeoff the team keeps avoiding",
      "Treat one focus complaint as culture data rather than annoyance",
    ],
    examples: [
      example(
        "ch27-ex01",
        "Student team laughs off focus concerns",
        ["school"],
        "A student says the group chat and meeting load are making it hard to do the actual project, but the rest of the team jokes that real leaders should handle the chaos.",
        [
          "Treat the reaction itself as important data about the group's culture.",
          "Try to reframe the concern around work quality and shared cost."
        ],
        "This matters because the first response to a focus problem often reveals whether honesty is safe. The distraction issue may be cultural before it is logistical."
      ),
      example(
        "ch27-ex02",
        "Club says members matter but punishes boundaries",
        ["school"],
        "A club publicly talks about balance and sustainability, but members who question late night urgency norms are treated as less committed.",
        [
          "Use the contradiction as a way to test what the culture truly values.",
          "Surface the real tradeoff between performative urgency and sustainable work."
        ],
        "The chapter helps because attention reveals whether stated values survive contact with inconvenience."
      ),
      example(
        "ch27-ex03",
        "Team says deep work matters but mocks it",
        ["work"],
        "A company praises strategic thinking, but workers who protect focus blocks are teased as unresponsive and not team players.",
        [
          "Read the culture through its reaction to boundaries, not through its slogans.",
          "Make the cost of the current norm visible in work quality terms."
        ],
        "This shows why distraction reform is a culture test. The spoken value and the rewarded behavior may be far apart."
      ),
      example(
        "ch27-ex04",
        "Manager listens defensively",
        ["work"],
        "An employee raises how constant interruptions are hurting output, but the manager treats the feedback as complaint rather than as data about the system.",
        [
          "Notice that the defensive response is part of the problem to solve.",
          "Reframe the issue around process and shared outcomes if possible."
        ],
        "The deeper issue is psychological safety. If the system cannot hear its own attention costs, it cannot improve them."
      ),
      example(
        "ch27-ex05",
        "Family says presence matters but keeps interrupting it",
        ["personal"],
        "A household says shared time matters, but anyone who asks for a no phone dinner or a quiet work block is treated as overly rigid.",
        [
          "Use the reaction to test what the family really values in practice.",
          "Start a more honest conversation about what kind of attention the home wants to protect."
        ],
        "This applies beyond workplaces because every group has attention norms. Resistance to discussing them is itself useful information."
      ),
      example(
        "ch27-ex06",
        "Friend group normalizes constant availability",
        ["personal"],
        "A friend group says connection matters, yet delayed replies are quickly moralized as disrespect, so everyone stays half available and half resentful.",
        [
          "Treat the tension as a norm problem, not only as a personal conflict.",
          "Discuss what healthy responsiveness should actually mean for the group."
        ],
        "The chapter matters because social expectations around attention can be negotiated only if the group can talk honestly about them."
      ),
    ],
    questions: [
      question(
        "ch27-q01",
        "What does this chapter say fixing distraction reveals?",
        [
          "The quality of a group's culture and psychological safety",
          "Only how disciplined individuals are",
          "Which apps are most popular",
          "Whether meetings should exist",
        ],
        0
      ),
      question(
        "ch27-q02",
        "Why is psychological safety important for attention reform?",
        [
          "People need to be able to raise focus costs without fear",
          "It removes all tradeoffs",
          "It matters only in therapy settings",
          "It guarantees fewer tools",
        ],
        0
      ),
      question(
        "ch27-q03",
        "How are stated values tested in this chapter?",
        [
          "By how the group responds when focus protection becomes inconvenient",
          "By how often the values are repeated",
          "By whether everyone agrees instantly",
          "By the size of the workload",
        ],
        0
      ),
      question(
        "ch27-q04",
        "Why can overwork and constant availability become culturally sticky?",
        [
          "They can signal loyalty or toughness even when they damage real work",
          "They always improve trust",
          "They eliminate distraction",
          "They matter only for leaders",
        ],
        0
      ),
      question(
        "ch27-q05",
        "What role do leaders play here?",
        [
          "They shape whether honest conversations about attention feel safe or risky",
          "They can avoid the issue if tools are good enough",
          "They matter less than employees",
          "They should stay neutral when concerns are raised",
        ],
        0
      ),
      question(
        "ch27-q06",
        "Why are tradeoffs central to culture change?",
        [
          "Because better focus often requires giving up some old habits of speed or access",
          "Because tradeoffs mean the value is false",
          "Because tradeoffs should stay hidden",
          "Because tradeoffs apply only to remote work",
        ],
        0
      ),
      question(
        "ch27-q07",
        "How should teams treat focus complaints?",
        [
          "As potentially valuable data about how work actually functions",
          "As simple personal preferences to ignore",
          "As signs that ambition is low",
          "As reasons to increase urgency",
        ],
        0
      ),
      question(
        "ch27-q08",
        "Why does shared language around traction and interruption help?",
        [
          "It makes the problem clearer and easier to discuss honestly",
          "It replaces the need for trust",
          "It makes feedback unnecessary",
          "It works only in large companies",
        ],
        0
      ),
      question(
        "ch27-q09",
        "What is one sign of a mature culture according to this chapter?",
        [
          "It can discuss focus tradeoffs without moral panic",
          "It keeps all tension private",
          "It praises constant urgency",
          "It equates silence with health",
        ],
        0
      ),
      question(
        "ch27-q10",
        "What is the chapter's core standard?",
        [
          "Focus should be treated as a shared responsibility the culture can actually support",
          "Distraction is always a private issue",
          "Candor weakens teamwork",
          "Only leaders should think about attention",
        ],
        0
      ),
    ],
  }),
  chapter({
    chapterId: "ch28-indistractable-workplace",
    number: 28,
    title: "Build A Workplace That Protects Focus",
    readingTimeMinutes: 15,
    summary: {
      p1: t(
        "Building a workplace that protects focus means designing norms, tools, and leadership habits that make sustained attention easier instead of constantly more fragile.",
        "Eyal turns the book's personal methods into organizational principles by asking what kind of workplace would support traction as a default condition.",
        "The answer is a culture with clearer priorities, healthier rhythms, safer candor, and stronger boundaries around interruption."
      ),
      p2: t(
        "This matters because individual focus remains limited in a workplace that keeps rewarding chaos, speed theater, and permanent accessibility.",
        "An indistractable workplace lowers those costs system wide and gives people a fairer chance to do thoughtful work without needless strain.",
        "The deeper lesson is that organizations choose their attention economy. Better results often follow when the system starts protecting thinking as seriously as it protects visible activity."
      ),
    },
    standardBullets: [
      bullet(
        "Workplace attention is designed whether leaders admit it or not. Norms around meetings, messaging, priorities, and urgency already create a focus environment.",
        "The chapter asks for that design to become intentional.",
        "Invisible design is still design.",
        "The only real choice is whether the system is being shaped consciously or by drift."
      ),
      bullet(
        "Clear priorities are foundational. A workplace cannot protect focus if people are unsure which work truly outranks which.",
        "Priority clarity reduces frantic switching.",
        "It also improves coordination.",
        "When everything matters equally, interruption will keep choosing on behalf of the organization."
      ),
      bullet(
        "Healthy rhythms beat constant reaction. Teams need known times for responsiveness and known times for deeper work.",
        "Rhythm creates predictability and lowers cognitive strain.",
        "This is one of the strongest workplace habits available.",
        "A calm tempo usually outperforms endless partial attention."
      ),
      bullet(
        "Leaders must model the norm. If leadership constantly interrupts, multitasks, or rewards instant reply, the culture will copy it.",
        "Modeling turns values into reality faster than speeches do.",
        "Attention standards travel downward quickly.",
        "People watch what gets rewarded more than what gets written."
      ),
      bullet(
        "Communication channels need clear roles. Email, chat, meetings, and documents should each be used where they fit best.",
        "This reduces needless noise and confusion.",
        "Channel clarity is organizational attention hygiene.",
        "A system where every tool does everything will make attention expensive."
      ),
      bullet(
        "Psychological safety remains essential. People must be able to surface overload, interruption costs, and weak norms without being punished for it.",
        "That keeps the workplace adaptive.",
        "Silence prevents design improvement.",
        "A focus friendly workplace can hear bad news about how work currently feels."
      ),
      bullet(
        "Good systems protect different kinds of work differently. Deep analysis, fast coordination, and relational management do not all need the same interruption standard.",
        "Nuance matters more than one blanket rule.",
        "Fit improves protection.",
        "A mature workplace knows that different work modes deserve different operating conditions."
      ),
      bullet(
        "Rest and recovery are performance concerns. Burned out teams become more distractible, more reactive, and less thoughtful.",
        "This means sustainable attention is a management issue too.",
        "The chapter treats energy as part of system design.",
        "A workplace that glorifies depletion will keep paying for it in cognition."
      ),
      bullet(
        "Focus protection improves output quality. Better concentration produces better thinking, fewer avoidable errors, and more meaningful progress on high value work.",
        "This gives the chapter an operational payoff.",
        "Attention protection is not soft overhead.",
        "It is a way of improving the actual substance of what the organization produces."
      ),
      bullet(
        "An indistractable workplace is built from norms, not slogans. It requires recurring choices in scheduling, tooling, leadership, and candor.",
        "The chapter closes the workplace section by making focus a design commitment.",
        "Culture lives in repetition.",
        "A better workplace emerges when attention is treated as infrastructure rather than as an individual personality trait."
      ),
    ],
    deeperBullets: [
      bullet(
        "The workplace chooses its attention economy through what it rewards. If it rewards urgency theater, people will train for theater. If it rewards thoughtful progress, behavior shifts accordingly.",
        "Incentives are always teaching.",
        "This is why the chapter belongs at the organizational level."
      ),
      bullet(
        "Clarity is a kindness in fast systems. When tools, roles, and priorities are legible, people waste less energy guessing and defending themselves.",
        "That emotional relief improves cognition too.",
        "Better systems reduce both confusion and tension."
      ),
      bullet(
        "Focus friendly cultures are not anti collaboration. They are better at distinguishing when collaboration truly helps from when it merely interrupts.",
        "This is an important correction.",
        "Protected attention and strong teamwork can reinforce each other."
      ),
      bullet(
        "A sustainable attention culture is strategic because the hardest problems rarely yield to permanently fragmented thinking. Organizations that protect depth gain an advantage on quality, not only on comfort.",
        "This is the executive case for the chapter.",
        "Attention quality compounds at the level of the whole firm."
      ),
      bullet(
        "The final workplace test is consistency. A company becomes indistractable not when it launches a focus initiative, but when daily decisions keep protecting attention after the announcement fades.",
        "This makes the work less glamorous but more real.",
        "Enduring norms beat one time campaigns."
      ),
    ],
    takeaways: [
      "Workplace attention is designed",
      "Priority clarity is foundational",
      "Rhythm beats constant reaction",
      "Leaders model the norm",
      "Different work needs different protection",
      "Focus is organizational infrastructure",
    ],
    practice: [
      "Clarify one priority conflict on your team",
      "Create one known rhythm for response and one for deep work",
      "Match one communication tool to a clearer role",
      "Surface one attention cost that people currently stay quiet about",
      "Model one boundary you want others to trust",
    ],
    examples: [
      example(
        "ch28-ex01",
        "Student publication protects production time",
        ["school"],
        "A campus publication keeps missing quality goals because everyone is always in coordination mode and almost no one has protected time to actually write or edit deeply.",
        [
          "Create clearer rhythms for production work versus coordination work.",
          "Protect different tasks according to their real cognitive needs."
        ],
        "This matters because focus friendly systems are built, not wished into being. The group needs norms that fit the work."
      ),
      example(
        "ch28-ex02",
        "Project team wants better collaboration",
        ["school"],
        "A student project team thinks more collaboration means more constant contact, but the result is scattered effort and weak thinking on the hardest parts of the project.",
        [
          "Define when collaboration truly helps and when solo concentration should be protected.",
          "Build a rhythm that supports both."
        ],
        "The chapter helps because strong teamwork is not the same as permanent interruption. Good systems distinguish the two."
      ),
      example(
        "ch28-ex03",
        "Company always on culture",
        ["work"],
        "A company says strategic thinking matters, but leaders respond to every ping instantly and schedule over protected work with little hesitation.",
        [
          "Change the modeled norm first and give focus visible organizational legitimacy.",
          "Make priorities and interruption rules clearer across the system."
        ],
        "This shows that workplace attention is shaped from the top as much as from the tools. Modeling is policy."
      ),
      example(
        "ch28-ex04",
        "Team wants fewer errors",
        ["work"],
        "A team is making avoidable mistakes on complex work because concentration keeps breaking, yet the root problem is still treated as personal sloppiness instead of system design.",
        [
          "Rework the environment so complex tasks get stronger protection than routine coordination.",
          "Treat focus as quality infrastructure, not as a side preference."
        ],
        "The deeper lesson is that output quality follows attention quality more than many cultures admit."
      ),
      example(
        "ch28-ex05",
        "Family project with no shared rhythm",
        ["personal"],
        "A household tries to manage chores, planning, and personal projects with no clear rhythm, so everyone feels interrupted by everyone else all the time.",
        [
          "Create more legible time patterns for coordination, quiet work, and rest.",
          "Stop asking every activity to happen against every other activity simultaneously."
        ],
        "This applies outside formal work because any group benefits from clearer attention rhythms when responsibilities are shared."
      ),
      example(
        "ch28-ex06",
        "Friends building something together",
        ["personal"],
        "A small side project among friends stays chaotic because communication tools, ownership, and decision moments are all mixed together.",
        [
          "Assign clearer roles and match tools to their purpose.",
          "Protect thinking time as much as coordination time."
        ],
        "The chapter matters because focus friendly systems help shared work of every size. Better norms create calmer, better output."
      ),
    ],
    questions: [
      question(
        "ch28-q01",
        "What is the chapter's main claim about workplaces?",
        [
          "They already design attention through norms and systems, whether intentionally or not",
          "Attention is mostly private once someone is hired",
          "Only tools matter",
          "Good culture removes the need for priorities",
        ],
        0
      ),
      question(
        "ch28-q02",
        "Why are clear priorities foundational to an indistractable workplace?",
        [
          "Because people cannot protect focus when they do not know what truly outranks what",
          "Because priorities should stay flexible and hidden",
          "Because clarity reduces collaboration",
          "Because urgency is a better guide",
        ],
        0
      ),
      question(
        "ch28-q03",
        "What kind of rhythm does the chapter recommend?",
        [
          "Known times for responsiveness and known times for deeper work",
          "Permanent reaction mode",
          "Total silence all day",
          "No shared norms at all",
        ],
        0
      ),
      question(
        "ch28-q04",
        "Why is leadership modeling so important?",
        [
          "People copy what leaders reward and enact more than what they merely say",
          "It matters only in small teams",
          "It replaces the need for systems",
          "It has little effect on culture",
        ],
        0
      ),
      question(
        "ch28-q05",
        "How should communication tools be used in a focus friendly workplace?",
        [
          "With clearer roles so each channel is used where it fits best",
          "Interchangeably for everything",
          "Mostly for visible busyness",
          "Without any norms",
        ],
        0
      ),
      question(
        "ch28-q06",
        "Why does the chapter keep psychological safety in the picture?",
        [
          "Because people need to be able to surface overload and weak norms for the system to improve",
          "Because safety matters more than output",
          "Because fear sharpens focus",
          "Because candor is a private issue",
        ],
        0
      ),
      question(
        "ch28-q07",
        "Why should different work types receive different interruption standards?",
        [
          "Because deep analysis and fast coordination do not have the same cognitive needs",
          "Because every task should be treated identically",
          "Because concentration is only for writers",
          "Because collaboration always lowers quality",
        ],
        0
      ),
      question(
        "ch28-q08",
        "What does the chapter suggest about recovery?",
        [
          "It is part of performance design because depleted people become more reactive and distractible",
          "It is unrelated to attention",
          "It matters only outside work",
          "It should be left to individual luck",
        ],
        0
      ),
      question(
        "ch28-q09",
        "Why is focus protection strategically important for organizations?",
        [
          "Because attention quality affects decision quality, error rates, and the substance of output",
          "Because it mainly improves office aesthetics",
          "Because only employees benefit",
          "Because fragmented thinking is just as good for hard problems",
        ],
        0
      ),
      question(
        "ch28-q10",
        "What turns a workplace into an indistractable one?",
        [
          "Repeated daily norms that keep protecting attention after the slogans fade",
          "A single launch announcement",
          "More tools without new norms",
          "Constant availability combined with good intentions",
        ],
        0
      ),
    ],
  }),
  chapter({
    chapterId: "ch22-precommitment-power",
    number: 22,
    title: "Precommitment Protects Future Behavior",
    readingTimeMinutes: 14,
    summary: {
      p1: t(
        "Precommitment protects future behavior because decisions made before temptation arrives are often wiser than decisions made in the middle of temptation.",
        "Eyal frames precommitment as a practical way to defend your future self from predictable moments of weakness, boredom, or impulsivity.",
        "The point is not distrust for its own sake. It is honest planning for how human attention actually behaves."
      ),
      p2: t(
        "This matters because many people keep expecting their future self to be calmer, stronger, or more principled than evidence suggests.",
        "Precommitment replaces that hope with design by limiting later options before the urge gets its turn to bargain.",
        "The deeper lesson is that freedom often improves when the right choices are made earlier. A well chosen constraint can protect what matters better than repeated in the moment negotiation."
      ),
    },
    standardBullets: [
      bullet(
        "Future weakness is predictable. Most people already know the moments when distraction becomes easier to justify.",
        "That makes precommitment practical rather than paranoid.",
        "You are not guessing that temptation may appear. You are planning for patterns you already understand.",
        "Honest anticipation is the foundation of the whole chapter."
      ),
      bullet(
        "Earlier decisions are often better decisions. Before the urge arrives, values and long term goals usually have more influence.",
        "That gives precommitment its strategic advantage.",
        "You choose under clearer conditions.",
        "The later moment is often emotionally louder and cognitively narrower."
      ),
      bullet(
        "Precommitment limits the menu. It works by reducing how many bad options remain easy when you are vulnerable.",
        "That is why the chapter focuses on constraints rather than pep talks.",
        "Fewer available mistakes often means better follow through.",
        "The best defense may be to remove tomorrow's bad choice from tomorrow's reach."
      ),
      bullet(
        "This is not weakness. Using precommitment is an intelligent response to a known pattern, not a confession of moral failure.",
        "The chapter actively rejects the vanity of pretending pure willpower is always enough.",
        "Realism beats pride here.",
        "A person who plans for temptation is often stronger than one who keeps acting surprised by it."
      ),
      bullet(
        "Precommitment works best before the first compromise. Once the drift has already started, bargaining becomes harder to resist.",
        "Timing matters because the earliest constraint usually protects the whole chain.",
        "This is why setup matters so much.",
        "Later rescue attempts often cost more than earlier limits."
      ),
      bullet(
        "Constraints should protect something specific. A good pact is tied to a real value or vulnerable moment, not to vague self punishment.",
        "Specificity keeps the tool useful and proportional.",
        "A clear why makes a pact easier to respect.",
        "Without a real target, a pact can feel arbitrary and become easier to abandon."
      ),
      bullet(
        "Precommitment lowers decision fatigue. You do not have to keep debating the same temptation again and again.",
        "That saved energy can be redirected into the work or rest you actually chose.",
        "The chapter is partly about conservation of judgment.",
        "Every decision you do not have to remake under pressure is attention you get back."
      ),
      bullet(
        "The best pacts fit the pattern. Different distractions call for different forms of commitment, which is why later chapters separate effort, price, and identity pacts.",
        "Precommitment is the umbrella logic behind those specific tools.",
        "Fit matters more than dramatic intensity.",
        "A precise pact usually beats a theatrical one."
      ),
      bullet(
        "Good precommitment still allows review. Constraints should be adjustable when evidence changes, but not in the exact moment of temptation.",
        "This keeps the chapter from becoming rigid or punitive.",
        "Commitment is stronger when revision has a proper place and time.",
        "A pact should be stable under pressure and revisable under reflection."
      ),
      bullet(
        "The deeper goal is protected alignment. Precommitment keeps future behavior closer to what you already know matters.",
        "That is why the chapter sits near the end of the framework.",
        "Once values, triggers, and external cues are clearer, constraints can become very effective.",
        "The pact is not the whole method. It is a powerful final guardrail."
      ),
    ],
    deeperBullets: [
      bullet(
        "The future self is often overestimated. People routinely imagine they will later have more energy, time, and restraint than they actually do.",
        "Precommitment corrects that fantasy.",
        "It is an antidote to optimistic self deception."
      ),
      bullet(
        "A pact is strongest when it changes the moment before thought gets captured. Early structure protects later clarity.",
        "This is why device setup, money stakes, and identity cues can be so effective.",
        "They act before the urge fully argues its case."
      ),
      bullet(
        "Constraint can increase freedom by protecting chosen commitments from momentary volatility. The chapter reverses the common fear that every limit is a loss.",
        "The real loss is often what happens without the limit.",
        "Freedom without structure is easily captured by stronger impulses."
      ),
      bullet(
        "Precommitment should be designed with respect, not contempt, for your future self. The aim is support, not humiliation.",
        "That is why the best pacts feel protective rather than theatrical.",
        "Good constraints preserve dignity while increasing reliability."
      ),
      bullet(
        "The chapter quietly teaches humility. You build pacts not because you are broken, but because attention is finite and temptation is well engineered.",
        "That humility produces better systems.",
        "Pride usually waits too long to add protection."
      ),
    ],
    takeaways: [
      "Precommitment plans for predictable weakness",
      "Earlier decisions are often wiser",
      "Constraints reduce bad options",
      "Pacts are realism not weakness",
      "Good pacts fit real patterns",
      "Review later, not in temptation",
    ],
    practice: [
      "Identify one moment where your future self is reliably weaker",
      "Choose one small constraint before that moment arrives",
      "Tie the pact to a clear value it protects",
      "Review the pact at a calm time, not in the middle of the urge",
      "Notice how many repeated decisions the pact removes",
    ],
    examples: [
      example(
        "ch22-ex01",
        "Exam week self trust fantasy",
        ["school"],
        "A student keeps believing that future study nights will somehow be more disciplined, so no structure is built before the high temptation moments arrive.",
        [
          "Plan the vulnerable hours in advance and add a small constraint before the study block starts.",
          "Stop relying on a future version of yourself that keeps failing the same test."
        ],
        "This matters because precommitment begins with honest forecasting. The problem is often not the future urge itself, but the fantasy that it will not matter much."
      ),
      example(
        "ch22-ex02",
        "Club deadline and late night drift",
        ["school"],
        "A student officer knows that late night work sessions tend to slide into browsing, but she keeps waiting to handle the risk in real time.",
        [
          "Set the protection before the session begins rather than negotiating after tiredness and boredom are already active.",
          "Match the pact to the real weak point."
        ],
        "The chapter helps because earlier decisions are usually clearer than later ones. The pact protects the moment before it becomes noisy."
      ),
      example(
        "ch22-ex03",
        "Important work always vulnerable after lunch",
        ["work"],
        "An employee knows that afternoons are when focus drops and distraction rises, yet every day he reaches that window with no added safeguards in place.",
        [
          "Precommit to the block before lunch with a constraint that protects the afternoon's known weak period.",
          "Reduce the number of choices the tired version of you gets to make."
        ],
        "This shows why pacts are realism. The vulnerable window is not a surprise anymore, so it should stop being treated like one."
      ),
      example(
        "ch22-ex04",
        "Manager keeps promising to stop checking",
        ["work"],
        "A manager tells herself she will not keep checking non essential dashboards during meetings, but because the promise is only mental, the habit keeps winning.",
        [
          "Add a concrete precommitment before the meeting instead of relying on a vague promise inside it.",
          "Let structure carry some of the load."
        ],
        "The chapter matters because good intentions are often too weak once the habit loop has already opened. Earlier structure protects later behavior."
      ),
      example(
        "ch22-ex05",
        "Evening routine keeps collapsing",
        ["personal"],
        "Someone wants calmer evenings but keeps drifting into the same distractions because every night the decision is being made again from scratch.",
        [
          "Choose the boundary in advance and make the later menu smaller.",
          "Use precommitment to remove repeated bargaining."
        ],
        "This applies at home because many personal lapses are just the result of leaving a predictable weak moment undefended."
      ),
      example(
        "ch22-ex06",
        "Weekend plans versus predictable temptation",
        ["personal"],
        "A person knows weekends create lots of unstructured temptation, but still enters them with no plan, then feels surprised by the same drift on Sunday night.",
        [
          "Design one pact before the weekend begins and review it only after the weekend, not during the vulnerable moment.",
          "Treat the pattern as something to plan for, not to rediscover."
        ],
        "The deeper lesson is that repeated surprise is often a refusal to learn. Precommitment turns known patterns into better protection."
      ),
    ],
    questions: [
      question(
        "ch22-q01",
        "Why is precommitment effective?",
        [
          "Earlier decisions are often made under clearer conditions than later tempted ones",
          "It eliminates all temptation permanently",
          "It works only for severe habits",
          "It relies on stronger emotion",
        ],
        0
      ),
      question(
        "ch22-q02",
        "What does precommitment mainly do?",
        [
          "It reduces how many bad options remain easy in a vulnerable moment",
          "It makes every choice feel pleasant",
          "It removes the need for values",
          "It works by increasing surprise",
        ],
        0
      ),
      question(
        "ch22-q03",
        "How does the chapter treat pacts?",
        [
          "As intelligent realism rather than weakness",
          "As a sign of broken character",
          "As a last resort for children only",
          "As replacements for all other methods",
        ],
        0
      ),
      question(
        "ch22-q04",
        "When should a pact usually be created or revised?",
        [
          "In a calm reflective moment, not in the middle of the urge",
          "At the height of temptation",
          "Only after repeated failure with no review",
          "Whenever mood changes",
        ],
        0
      ),
      question(
        "ch22-q05",
        "Why does precommitment reduce decision fatigue?",
        [
          "It stops you from having to renegotiate the same temptation repeatedly",
          "It makes all decisions disappear",
          "It increases impulsivity",
          "It matters only at work",
        ],
        0
      ),
      question(
        "ch22-q06",
        "What makes a pact strong rather than theatrical?",
        [
          "It fits a specific pattern and protects a specific value",
          "It feels severe and dramatic",
          "It shames you effectively",
          "It never changes even with new evidence",
        ],
        0
      ),
      question(
        "ch22-q07",
        "What fantasy does precommitment challenge?",
        [
          "The belief that your future self will magically be more disciplined without support",
          "The belief that environments matter",
          "The belief that values exist",
          "The belief that habits repeat",
        ],
        0
      ),
      question(
        "ch22-q08",
        "How can a constraint increase freedom according to this chapter?",
        [
          "By protecting what you actually chose from momentary volatility",
          "By giving every impulse equal power",
          "By removing all accountability",
          "By making review impossible",
        ],
        0
      ),
      question(
        "ch22-q09",
        "What tone should a good pact have?",
        [
          "Supportive and protective rather than humiliating",
          "Harsh and contemptuous",
          "Secretive and rigid",
          "Vague and symbolic",
        ],
        0
      ),
      question(
        "ch22-q10",
        "Where does precommitment sit in the overall method?",
        [
          "As a strong guardrail that protects alignment after values, triggers, and systems are clearer",
          "As the only chapter that matters",
          "As a replacement for calendars",
          "As something unrelated to traction",
        ],
        0
      ),
    ],
  }),
  chapter({
    chapterId: "ch23-effort-pacts",
    number: 23,
    title: "Make Distraction Harder To Reach",
    readingTimeMinutes: 15,
    summary: {
      p1: t(
        "Making distraction harder to reach means adding effort between an urge and the behavior that usually follows it.",
        "Eyal calls these effort pacts because they work by increasing friction on the distracting option rather than relying only on better feelings.",
        "Small inconveniences matter because many bad habits win mainly through easy access."
      ),
      p2: t(
        "This matters because temptation often rides speed. The faster the path, the less time intention has to return.",
        "By adding extra steps, distance, passwords, or delays, you give the wiser choice another chance to surface before the habit completes itself.",
        "The deeper lesson is that effort shapes behavior continuously. What is easiest is rarely neutral in an over stimulated environment."
      ),
    },
    standardBullets: [
      bullet(
        "Friction changes choices. When the path to distraction becomes less immediate, fewer impulses complete themselves.",
        "That is why even small barriers can have outsized effects.",
        "Habit often depends on convenience more than conviction.",
        "A tiny delay can break a chain that felt unstoppable at full speed."
      ),
      bullet(
        "Make the bad option slower. Logouts, blockers, moved devices, or extra steps all create useful interruption in the habit loop.",
        "The goal is not maximum punishment.",
        "The goal is enough effort to let intention reenter.",
        "A barrier works when it creates time to remember what mattered more."
      ),
      bullet(
        "Use friction where the pattern is reliable. Effort pacts work best on behaviors you already know tend to hijack you quickly.",
        "Specificity keeps the intervention efficient.",
        "You do not need to harden every part of life equally.",
        "Targeted friction usually beats dramatic overcorrection."
      ),
      bullet(
        "Distance is practical friction. Moving a device, tool, or temptation out of immediate reach often changes what happens next.",
        "Physical arrangement still matters in a digital problem.",
        "The body has to move before the habit can continue.",
        "That extra movement is often enough to wake up awareness."
      ),
      bullet(
        "Defaults matter more than pep talks. A system that makes distraction one click away will keep demanding high effort from you all day.",
        "Effort pacts improve the default instead.",
        "This is why they are sustainable.",
        "They reduce the number of heroic moments required."
      ),
      bullet(
        "The pact should protect a real priority. Friction makes more sense when it clearly serves something you value.",
        "That connection keeps the intervention from feeling arbitrary.",
        "Meaning helps constraints hold.",
        "It is easier to tolerate inconvenience when you remember what it is buying."
      ),
      bullet(
        "Use the smallest barrier that works. Overbuilt systems can create backlash if they feel absurd or unlivable.",
        "Proportion keeps effort pacts durable.",
        "The best pact is often modest but consistent.",
        "A small usable barrier is better than a dramatic one you quickly bypass."
      ),
      bullet(
        "Effort pacts are especially good against impulse, not deep conviction. They help most when the habit is fast and somewhat mindless.",
        "That is why they pair well with known weak moments.",
        "Friction works by slowing reflex.",
        "The more automatic the pattern, the more powerful a small interruption can be."
      ),
      bullet(
        "Combine friction with better alternatives. It helps when the productive or restorative option is not only available, but easier than the distraction.",
        "Good design shifts both sides of the choice.",
        "This makes the pact more humane and more effective.",
        "An obstructed distraction plus an easy better option is a strong combination."
      ),
      bullet(
        "Effort pacts protect attention by changing the path, not by waiting for a better mood. That is their strength.",
        "They are simple but often powerful precisely because they operate at the level of access.",
        "What takes effort gets chosen differently.",
        "The chapter reminds you that environment can do meaningful behavioral work on your behalf."
      ),
    ],
    deeperBullets: [
      bullet(
        "Convenience is one of the great hidden governors of modern attention. People often mistake convenience driven behavior for true preference.",
        "Effort pacts challenge that illusion.",
        "What you keep choosing may partly be what you made fastest."
      ),
      bullet(
        "The best friction feels almost invisible once installed. Its success comes from quietly changing outcomes without requiring constant inner speeches.",
        "This is why design so often outperforms motivation.",
        "Good systems reduce drama."
      ),
      bullet(
        "Effort pacts respect weak moments by designing for them. They do not pretend the tired or stressed version of you will reason as well as the rested one.",
        "That is compassionate realism again.",
        "A good pact protects the version of you most likely to need it."
      ),
      bullet(
        "Access shapes identity evidence. When distraction becomes harder, you collect more proof that you can stay with what matters.",
        "That proof can later strengthen identity pacts too.",
        "Behavioral architecture often writes future self belief."
      ),
      bullet(
        "Strong friction can reveal how much of a habit was pure momentum. Once the path is slower, some impulses simply vanish because they were never deeply chosen in the first place.",
        "That is useful diagnostic information.",
        "The habit may be more fragile than it felt."
      ),
    ],
    takeaways: [
      "Friction changes behavior",
      "Small delays matter",
      "Target reliable weak points",
      "Distance is useful design",
      "Use the smallest workable barrier",
      "Protect the path, not just the mood",
    ],
    practice: [
      "Add one extra step to a common distraction path",
      "Move one tempting device farther away",
      "Protect one known weak moment with friction before it starts",
      "Pair the barrier with an easier better option",
      "Notice whether a slowed habit loses power quickly",
    ],
    examples: [
      example(
        "ch23-ex01",
        "Study session and one click temptation",
        ["school"],
        "A student loses study blocks because one familiar site is always one easy click away from the assignment tab.",
        [
          "Add friction to the site or remove the shortcut so the detour is no longer immediate.",
          "Make the study materials the easier next move."
        ],
        "This matters because the habit may be winning mostly on convenience. A little effort can protect a lot of attention."
      ),
      example(
        "ch23-ex02",
        "Phone next to the notebook",
        ["school"],
        "A student taking notes keeps checking the phone because it is right beside the notebook and easier to touch than to resist.",
        [
          "Move the phone away so checking requires more effort and more awareness.",
          "Use distance as a barrier before the urge arrives."
        ],
        "The chapter helps because physical placement is behavioral design. Convenience quietly shapes what happens next."
      ),
      example(
        "ch23-ex03",
        "Work browser opens to temptation",
        ["work"],
        "An employee starts work with distracting sites still logged in and open from the night before, so the first weak moment becomes an easy slide away from the task.",
        [
          "Log out, close, or block the detour path before the work block begins.",
          "Let access require more than one impulsive click."
        ],
        "This shows why effort pacts are powerful. They change the path before stress or boredom has a chance to exploit it."
      ),
      example(
        "ch23-ex04",
        "Manager checks dashboard by reflex",
        ["work"],
        "A manager keeps opening a non essential dashboard because it is pinned and always available, even when it adds little to the current decision.",
        [
          "Remove the shortcut and make dashboard access more deliberate.",
          "Do not let convenience impersonate importance."
        ],
        "The deeper lesson is that what is easiest to open often feels most relevant even when it is not."
      ),
      example(
        "ch23-ex05",
        "Streaming apps beside the bed",
        ["personal"],
        "Someone wants to sleep earlier, but the streaming app is immediately available on the bedside device and keeps winning through pure ease.",
        [
          "Add friction to access or move the device out of immediate reach.",
          "Use inconvenience to protect the evening intention."
        ],
        "This matters because many late night habits do not survive much extra effort. Speed is a big part of their power."
      ),
      example(
        "ch23-ex06",
        "Impulse shopping path too easy",
        ["personal"],
        "A person keeps making small impulse purchases because saved cards and one tap checkout remove almost every moment of reconsideration.",
        [
          "Increase the effort required to complete the purchase path.",
          "Make the better choice easier than the impulsive one."
        ],
        "The chapter applies here because reducing convenience can restore reflection. What feels like desire is often just frictionless momentum."
      ),
    ],
    questions: [
      question(
        "ch23-q01",
        "What is the main mechanism of an effort pact?",
        [
          "It increases the effort needed to complete a distracting behavior",
          "It increases motivation for its own sake",
          "It removes the need for planning",
          "It works by creating shame",
        ],
        0
      ),
      question(
        "ch23-q02",
        "Why can small barriers have large effects?",
        [
          "Many distracting habits win mainly because the path is so fast and easy",
          "Because barriers eliminate desire entirely",
          "Because effort matters only once",
          "Because inconvenience always changes identity instantly",
        ],
        0
      ),
      question(
        "ch23-q03",
        "Where should effort pacts usually be aimed?",
        [
          "At specific, reliable distraction patterns",
          "At every part of life equally",
          "Only at severe addictions",
          "Only at workplace tools",
        ],
        0
      ),
      question(
        "ch23-q04",
        "Why is physical distance useful?",
        [
          "It adds a moment of effort before the habit can continue",
          "It removes the need for any other system",
          "It matters only for phones",
          "It makes values irrelevant",
        ],
        0
      ),
      question(
        "ch23-q05",
        "What keeps effort pacts durable?",
        [
          "Using the smallest barrier that actually works",
          "Making the system as severe as possible",
          "Changing the rules every day",
          "Keeping the value it protects vague",
        ],
        0
      ),
      question(
        "ch23-q06",
        "When are effort pacts especially effective?",
        [
          "When the habit is fast and impulse driven",
          "When the person has already fully decided to ignore the plan",
          "Only when other tools have failed completely",
          "Only in the morning",
        ],
        0
      ),
      question(
        "ch23-q07",
        "Why pair friction with a better alternative?",
        [
          "Because protecting attention works better when the good option is also easy to choose",
          "Because alternatives weaken the pact",
          "Because friction alone should feel punitive",
          "Because the better option should stay hard",
        ],
        0
      ),
      question(
        "ch23-q08",
        "What does this chapter suggest about convenience?",
        [
          "It quietly governs more behavior than people often admit",
          "It matters only for shopping",
          "It is morally neutral and behaviorally irrelevant",
          "It always reflects deep preference",
        ],
        0
      ),
      question(
        "ch23-q09",
        "What can strong friction reveal about a habit?",
        [
          "That the habit was driven largely by momentum and easy access",
          "That the habit was deeply chosen",
          "That planning is unnecessary",
          "That identity never matters",
        ],
        0
      ),
      question(
        "ch23-q10",
        "What is the chapter's central standard?",
        [
          "Change the path to distraction instead of waiting for a better mood every time",
          "Trust convenience and hope for the best",
          "Make the good option harder too",
          "Fight every urge with inner speeches only",
        ],
        0
      ),
    ],
  }),
  chapter({
    chapterId: "ch24-price-pacts",
    number: 24,
    title: "Create Real Costs For Distraction",
    readingTimeMinutes: 16,
    summary: {
      p1: t(
        "Creating real costs for distraction means attaching a meaningful consequence to the behavior you want to reduce before the vulnerable moment arrives.",
        "Eyal calls these price pacts and uses them to harness loss aversion and commitment when easier safeguards are not enough.",
        "The point is to make distraction less cheap, not to create dramatic punishment for its own sake."
      ),
      p2: t(
        "This matters because many distractions feel costless in the moment even when they quietly damage important goals over time.",
        "A price pact makes at least some of that cost immediate and visible, which can strengthen follow through when temptation is strong.",
        "The deeper lesson is that behavior changes when stakes change. Used carefully, price can become a useful ally of intention."
      ),
    },
    standardBullets: [
      bullet(
        "Price changes behavior. People often pay more attention when a lapse has an immediate visible cost.",
        "That is why price pacts can be powerful when softer boundaries keep failing.",
        "Stakes sharpen awareness.",
        "A cost that matters now can outweigh a vague cost that matters only later."
      ),
      bullet(
        "Loss aversion is useful here. People are often more motivated to avoid losing something than to gain an abstract future benefit.",
        "The chapter uses that bias strategically rather than pretending it does not exist.",
        "Behavior design works with human psychology, not against it.",
        "A concrete loss can make tomorrow's values feel more real today."
      ),
      bullet(
        "The pact should be meaningful but proportionate. A consequence that feels real helps. One that feels absurd may create backlash or easy abandonment.",
        "Proportion keeps the tool credible.",
        "A pact should strengthen seriousness without becoming theater.",
        "Severe consequences are not automatically better consequences."
      ),
      bullet(
        "Price pacts are not always the first tool. They tend to work best after you already understand the trigger and have tried simpler design changes.",
        "This keeps the chapter balanced.",
        "Money or public stakes are powerful enough to deserve thoughtful use.",
        "The right escalation order matters."
      ),
      bullet(
        "A cost works only if it is enforceable. Vague penalties that depend on later self mercy are weak pacts.",
        "Credibility is part of the mechanism.",
        "If the consequence can be dodged easily, the pact loses force quickly.",
        "A pact should survive contact with the same weakness it was built to counter."
      ),
      bullet(
        "Use stakes in service of a value, not as self punishment. The consequence should protect something meaningful rather than merely express frustration with yourself.",
        "That difference affects whether the pact feels constructive or corrosive.",
        "Purpose stabilizes price.",
        "Without a clear value, a cost can start to feel like emotional theater."
      ),
      bullet(
        "Public commitment can raise the stake. Telling another person or tying the consequence to a visible agreement can make a price pact harder to ignore.",
        "Social accountability often strengthens follow through.",
        "Attention responds to reputational cost too.",
        "Used wisely, another person can help make the pact real."
      ),
      bullet(
        "Price pacts should be specific. Tie them to a clear behavior, clear condition, and clear consequence.",
        "Specificity reduces loopholes and rationalization.",
        "Clarity keeps the pact fair.",
        "Fuzzy stakes invite fuzzy compliance."
      ),
      bullet(
        "Review whether the pact is helping or only stressing you. A price that creates panic without better behavior may need adjustment.",
        "This is why calm review still matters after commitment.",
        "A pact should protect traction, not create a new distraction spiral.",
        "Strong incentives need monitoring too."
      ),
      bullet(
        "Used well, price makes the future more present. It pulls some of tomorrow's consequence into today's decision point.",
        "That is its real value.",
        "A stronger present cost can defend a stronger present choice.",
        "The chapter teaches that motivation often changes when the timing of cost changes."
      ),
    ],
    deeperBullets: [
      bullet(
        "Many distractions survive because their true cost is delayed and diffuse. Price pacts work by concentrating at least part of that cost into something the moment can feel.",
        "This is a timing intervention as much as an incentive intervention.",
        "The chapter is about making invisible loss harder to ignore."
      ),
      bullet(
        "Public stakes can work because identity and reputation matter. People often protect agreements more carefully when someone else can witness whether they held.",
        "That is why accountability partners or visible commitments can be useful here.",
        "Social cost is still cost."
      ),
      bullet(
        "A bad price pact can become self sabotage. If the consequence is too harsh or too easy to trigger, the system can create shame without producing better design.",
        "Calibration is therefore part of wisdom.",
        "The chapter does not celebrate pain for its own sake."
      ),
      bullet(
        "Price is strongest when paired with earlier environmental fixes. Stakes alone can feel brittle if the temptation path remains frictionless and omnipresent.",
        "Layered defense is usually better than singular severity.",
        "Good systems combine psychology with environment."
      ),
      bullet(
        "The chapter quietly asks what your attention is worth. A price pact makes you answer that question with something tangible instead of only with rhetoric.",
        "That can be clarifying.",
        "People often protect more carefully what they are willing to stake concretely."
      ),
    ],
    takeaways: [
      "Visible stakes can change behavior",
      "Loss aversion can help",
      "Use proportionate consequences",
      "Credibility is essential",
      "Specific rules reduce loopholes",
      "Review whether the pact helps",
    ],
    practice: [
      "Choose one behavior where a real cost might help",
      "Define a specific condition and specific consequence",
      "Make the pact credible enough to survive the weak moment",
      "Tie the stake to a value you actually care about",
      "Review whether the cost improves follow through without creating chaos",
    ],
    examples: [
      example(
        "ch24-ex01",
        "Essay block keeps getting abandoned",
        ["school"],
        "A student has tried reminders and blockers, but still abandons a recurring writing block because the lapse feels cheap in the moment.",
        [
          "Attach a clear and proportionate consequence to missing the block without a real reason.",
          "Make the rule specific enough that the weak moment cannot easily rewrite it."
        ],
        "This matters because delayed academic cost often feels too abstract at the moment of choice. A nearer cost can strengthen follow through."
      ),
      example(
        "ch24-ex02",
        "Study commitment made public",
        ["school"],
        "A student knows she works harder when others can see the standard, but her current goals are entirely private and easy to quietly lower.",
        [
          "Use a public commitment or accountability structure with a real consequence for noncompliance.",
          "Make the stake meaningful enough to matter without becoming absurd."
        ],
        "The chapter helps because social cost can be a powerful form of price when reputation and trust are genuinely valued."
      ),
      example(
        "ch24-ex03",
        "Work deadline ignored until the last second",
        ["work"],
        "An employee keeps wasting protected work time because the cost of delay stays far in the future and therefore never feels urgent enough right now.",
        [
          "Create a nearer stake tied to the protected block or deliverable process.",
          "Use a consequence that makes the present moment care more about the plan."
        ],
        "This shows why timing matters. A future cost may be real and still too weak to guide today's behavior."
      ),
      example(
        "ch24-ex04",
        "Manager wants stronger accountability",
        ["work"],
        "A manager keeps telling herself she will stop multitasking during strategic meetings, but without any real cost the old habit keeps returning.",
        [
          "Make the commitment visible and attach a consequence that would feel real if the behavior repeats.",
          "Review whether the pact is helping rather than simply creating more tension."
        ],
        "The deeper lesson is that stakes can reveal seriousness. If the behavior matters, the protection may need more than intention."
      ),
      example(
        "ch24-ex05",
        "Weekend screen limit never sticks",
        ["personal"],
        "Someone wants to cut back weekend screen drift, but because there is no immediate cost when the rule is broken, the goal keeps dissolving.",
        [
          "Add a meaningful price to breaking the rule and make sure the consequence is actually enforceable.",
          "Keep it proportionate so the pact remains believable."
        ],
        "This matters because many personal distractions feel free in the moment. A real cost changes how the moment is evaluated."
      ),
      example(
        "ch24-ex06",
        "Impulse spending with no nearby consequence",
        ["personal"],
        "A person knows impulse buying hurts future goals, but the pain is diffuse and later, so the checkout button keeps feeling easy today.",
        [
          "Create a nearer consequence tied to the impulse purchase behavior.",
          "Use the stake to make the present decision feel the future more clearly."
        ],
        "The chapter applies here because price pacts are fundamentally about time. They pull cost closer to where the choice is made."
      ),
    ],
    questions: [
      question(
        "ch24-q01",
        "What is the main purpose of a price pact?",
        [
          "To attach an immediate meaningful consequence to a behavior you want to reduce",
          "To make every plan feel severe",
          "To replace all other strategies",
          "To punish yourself emotionally",
        ],
        0
      ),
      question(
        "ch24-q02",
        "Why can price pacts work especially well?",
        [
          "Because a visible present cost can outweigh a delayed vague future cost",
          "Because people care only about money",
          "Because outcomes never matter",
          "Because loss aversion is irrelevant",
        ],
        0
      ),
      question(
        "ch24-q03",
        "How should a good price pact feel?",
        [
          "Meaningful and proportionate",
          "Extreme and humiliating",
          "Vague and flexible",
          "Pleasant and optional",
        ],
        0
      ),
      question(
        "ch24-q04",
        "Why should price pacts usually come after simpler tools?",
        [
          "Because they are stronger and should be used thoughtfully rather than automatically",
          "Because they never work early",
          "Because friction never matters",
          "Because identity is the only real tool",
        ],
        0
      ),
      question(
        "ch24-q05",
        "What makes a price pact credible?",
        [
          "A consequence that is specific and actually enforceable",
          "A vague hope that future you will be strict",
          "A dramatic promise told to no one",
          "A punishment that changes every day",
        ],
        0
      ),
      question(
        "ch24-q06",
        "Why should the consequence be tied to a value?",
        [
          "So the pact feels protective rather than like random self punishment",
          "So the pact becomes harder to understand",
          "So shame increases",
          "So review becomes unnecessary",
        ],
        0
      ),
      question(
        "ch24-q07",
        "How can public commitment strengthen a price pact?",
        [
          "It adds social and reputational cost that makes the agreement harder to ignore",
          "It guarantees no lapse will happen",
          "It removes the need for specificity",
          "It matters only in workplaces",
        ],
        0
      ),
      question(
        "ch24-q08",
        "What should you monitor after setting a price pact?",
        [
          "Whether it improves follow through without creating counterproductive stress",
          "Only how harsh it sounds",
          "Whether it feels dramatic enough",
          "Whether you can revise it in the middle of temptation",
        ],
        0
      ),
      question(
        "ch24-q09",
        "What deeper timing problem are price pacts trying to solve?",
        [
          "The real costs of distraction are often delayed and hard to feel at the decision point",
          "There are no real costs to distraction",
          "People overestimate short term losses",
          "Future costs are always enough on their own",
        ],
        0
      ),
      question(
        "ch24-q10",
        "What is the chapter's central standard for price?",
        [
          "Use tangible stakes to make distraction less cheap, not to create suffering for its own sake",
          "Make the consequence as harsh as possible",
          "Use price first for every habit",
          "Avoid review once the pact exists",
        ],
        0
      ),
    ],
  }),
  chapter({
    chapterId: "ch25-identity-pacts",
    number: 25,
    title: "Use Identity To Defend Attention",
    readingTimeMinutes: 12,
    summary: {
      p1: t(
        "Using identity to defend attention means strengthening the belief that being indistractable is part of who you are and how you act.",
        "Eyal argues that self image shapes behavior because people naturally try to stay consistent with the kind of person they believe themselves to be.",
        "An identity pact turns attention from a one off tactic into a lived standard."
      ),
      p2: t(
        "This matters because identity stories influence countless small choices before conscious reasoning fully arrives.",
        "When focus becomes part of how you see yourself, distractions face not only a rule but a mismatch with your self concept.",
        "The deeper lesson is that identity is built through evidence and language together. What you call yourself and what you repeatedly do start to reinforce one another."
      ),
    },
    standardBullets: [
      bullet(
        "People protect identities. Behavior often follows what feels consistent with who you believe you are.",
        "That gives identity pacts unusual power over repeated choices.",
        "A self image can become a fast internal guide.",
        "When an action clashes with identity, friction appears before the behavior is fully complete."
      ),
      bullet(
        "Language matters. Saying I am indistractable or I am someone who protects my attention creates a different frame than saying I am trying not to fail again.",
        "The wording shifts the emotional center from avoidance to identity.",
        "That can change the feel of the next choice.",
        "Self description quietly influences what seems normal or deviant for you."
      ),
      bullet(
        "Identity pacts work best when believable. A self description should stretch you, not feel absurdly disconnected from evidence.",
        "Credibility keeps the identity from sounding like a slogan.",
        "Believable language is easier to inhabit.",
        "A useful identity claim usually grows from real behavior, not from fantasy alone."
      ),
      bullet(
        "Evidence builds identity. Each follow through moment becomes proof that the identity is becoming more true.",
        "This is why systems and pacts support identity rather than compete with it.",
        "Behavior gives the story weight.",
        "A label repeated without evidence stays fragile and easy to mock internally."
      ),
      bullet(
        "Identity protects in fast moments. Some choices happen too quickly for a long analytical process, so a settled self concept can help guide them.",
        "This is one of the practical benefits of identity work.",
        "The response becomes more immediate.",
        "The mind asks not only what should I do, but what would a person like me do."
      ),
      bullet(
        "Do not build identity around shame. The point is a strong positive standard, not a dramatic enemy story about being broken.",
        "A healthier identity is easier to defend consistently.",
        "Shame based identities often collapse under pressure.",
        "Pride in protecting attention is sturdier than fear of proving your weakness again."
      ),
      bullet(
        "Identity should stay connected to values. The reason to be indistractable is not image alone, but what that identity protects in work, relationships, and life.",
        "This keeps the pact from becoming performative.",
        "A meaningful identity has a purpose beyond itself.",
        "When the why is clear, the self concept becomes easier to honor."
      ),
      bullet(
        "Use identity across situations. The same self concept can guide device use, scheduling, work boundaries, and relational presence.",
        "That gives identity pacts unusual portability.",
        "A broad standard can shape many local choices.",
        "The identity becomes a common thread linking all the book's tactics."
      ),
      bullet(
        "Update identity through repetition. Small wins count because they keep teaching the mind what is now normal for you.",
        "That is how identity becomes less aspirational and more lived.",
        "Repetition turns statement into pattern.",
        "The chapter quietly turns consistency into self authorship."
      ),
      bullet(
        "Attention defense becomes easier when it feels like self respect. Identity pacts help the person experience focus not as restriction, but as fidelity to the self they want to be.",
        "That emotional shift can be powerful.",
        "The choice starts to feel affirmative instead of deprived.",
        "A well built identity pact gives attention a sense of dignity."
      ),
    ],
    deeperBullets: [
      bullet(
        "Identity can fail when it is borrowed rather than chosen. A label imposed by trend, status, or shame often has less staying power than one grounded in your actual values.",
        "Ownership matters here.",
        "The self concept needs to feel internally meaningful."
      ),
      bullet(
        "Small contradictions matter because identity is sensitive to repeated evidence. A long series of exceptions can quietly rewrite the story downward if never addressed.",
        "This is why repair still matters.",
        "The pact is strongest when lapse is followed by return."
      ),
      bullet(
        "The most useful identity is specific enough to guide behavior and broad enough to travel. Indistractable works because it can shape many moments without becoming overly narrow.",
        "That makes it a durable umbrella identity.",
        "Good identity language combines clarity with range."
      ),
      bullet(
        "Identity pacts pair especially well with public integrity. When others know the standard you are trying to live by, your own behavior can feel more coherent and accountable.",
        "This does not mean performing for others.",
        "It means letting chosen standards become socially real."
      ),
      bullet(
        "Self respect is one of the hidden rewards of indistractability. Each kept promise strengthens the sense that your intentions and actions can belong to the same person.",
        "That inner trust is powerful.",
        "The chapter ends the pact section by tying attention back to character."
      ),
    ],
    takeaways: [
      "Identity shapes fast choices",
      "Language influences behavior",
      "Believable claims work best",
      "Evidence strengthens the story",
      "Use positive identity not shame",
      "Self respect reinforces focus",
    ],
    practice: [
      "Write one believable identity statement about how you want to handle attention",
      "Link that identity to a value it protects",
      "Collect one small piece of evidence that supports the statement",
      "Use the identity in one fast decision today",
      "Repair quickly after one contradiction instead of abandoning the story",
    ],
    examples: [
      example(
        "ch25-ex01",
        "Student sees focus as not me",
        ["school"],
        "A student keeps saying disciplined study is just not his personality, so each lapse feels like proof rather than like a moment to repair.",
        [
          "Build a more useful identity statement that he can actually grow into and support with evidence.",
          "Use small follow through moments to make the identity more believable."
        ],
        "This matters because identity stories steer choices early. A better story can create a better default response to temptation."
      ),
      example(
        "ch25-ex02",
        "Campus leader wants reliability",
        ["school"],
        "A student leader wants to be known as reliable, but still treats attention lapses as isolated accidents instead of as contradictions to a chosen standard.",
        [
          "Use the identity of being reliable with attention, not only with intentions.",
          "Let that identity guide how meetings, messages, and deadlines are handled."
        ],
        "The chapter helps because identity can unify many behaviors. Reliability is easier to live when it becomes a self concept, not only a wish."
      ),
      example(
        "ch25-ex03",
        "Worker says I am always scattered",
        ["work"],
        "An employee has repeated for years that he is naturally scattered, so the phrase now arrives before most focus decisions even begin.",
        [
          "Replace the old line with a more accurate and more useful standard tied to real behavior.",
          "Support it with systems that let the new identity gather evidence."
        ],
        "This shows that language can become a pact with distraction as easily as with focus. Naming matters."
      ),
      example(
        "ch25-ex04",
        "Manager wants calmer device behavior",
        ["work"],
        "A manager wants to stop checking the phone in every meeting, but the effort still feels like deprivation instead of like fidelity to a clear standard.",
        [
          "Frame the behavior around the identity of being present and deliberate with attention.",
          "Use that self concept as the quick guide in the room."
        ],
        "The deeper point is that identity changes the emotional meaning of restraint. It can feel like self respect instead of loss."
      ),
      example(
        "ch25-ex05",
        "Parent wants to be more present",
        ["personal"],
        "A parent keeps saying family matters, but still experiences putting the phone away as a sacrifice rather than as a reflection of who they want to be with their child.",
        [
          "Choose an identity that links attention directly to the kind of parent they want to be.",
          "Let that identity shape small daily device decisions."
        ],
        "The chapter applies here because identity can turn presence from a vague aspiration into a consistent relational standard."
      ),
      example(
        "ch25-ex06",
        "Personal project and self trust",
        ["personal"],
        "Someone wants to finish a personal project but keeps telling herself she is not the kind of person who follows through, which weakens each new attempt before it starts.",
        [
          "Adopt a believable identity grounded in one small repeated behavior and keep collecting proof.",
          "Treat each follow through as evidence, not as luck."
        ],
        "This matters because self trust grows from identity and evidence working together. The project improves as the story about the person improves too."
      ),
    ],
    questions: [
      question(
        "ch25-q01",
        "Why can identity pacts be powerful?",
        [
          "People often act in ways that feel consistent with who they believe they are",
          "Identity replaces the need for evidence",
          "Identity matters only in public",
          "Identity makes every choice effortless",
        ],
        0
      ),
      question(
        "ch25-q02",
        "What is the effect of saying I am indistractable rather than I hope I do not fail again?",
        [
          "It frames the behavior as identity consistency rather than fear based avoidance",
          "It guarantees instant success",
          "It removes the need for planning",
          "It works only if nobody hears it",
        ],
        0
      ),
      question(
        "ch25-q03",
        "What kind of identity statement works best?",
        [
          "One that is believable enough to grow into and support with evidence",
          "One that is as dramatic as possible",
          "One with no behavioral proof behind it",
          "One based on shame",
        ],
        0
      ),
      question(
        "ch25-q04",
        "How does evidence relate to identity?",
        [
          "Repeated follow through makes the identity more credible and easier to inhabit",
          "Evidence is less important than slogans",
          "Identity should remain independent of behavior",
          "Only public praise counts as evidence",
        ],
        0
      ),
      question(
        "ch25-q05",
        "Why are identity pacts useful in fast moments?",
        [
          "They can guide action before a long analytical process is even possible",
          "They slow every decision down deliberately",
          "They matter only in calm situations",
          "They replace all other pacts",
        ],
        0
      ),
      question(
        "ch25-q06",
        "What is a danger of shame based identity?",
        [
          "It often becomes brittle and collapses under pressure",
          "It makes evidence easier to collect",
          "It improves self respect",
          "It always strengthens consistency",
        ],
        0
      ),
      question(
        "ch25-q07",
        "Why should identity stay linked to values?",
        [
          "So the self concept protects something meaningful rather than becoming performative",
          "So the identity stays vague",
          "So the story matters more than behavior",
          "So review becomes unnecessary",
        ],
        0
      ),
      question(
        "ch25-q08",
        "How does the chapter suggest identity becomes more lived?",
        [
          "Through repeated small behaviors that keep teaching the mind what is normal",
          "Through a single promise",
          "Through removing all contradictions forever",
          "Through avoiding any public accountability",
        ],
        0
      ),
      question(
        "ch25-q09",
        "What is one benefit of quick repair after a lapse?",
        [
          "It prevents a contradiction from quietly rewriting the identity downward",
          "It proves the identity was false",
          "It removes the need for future effort",
          "It matters only for work habits",
        ],
        0
      ),
      question(
        "ch25-q10",
        "What deeper reward does the chapter associate with identity pacts?",
        [
          "Greater self trust and self respect as intentions and actions align more often",
          "A perfectly distraction free life",
          "Freedom from all rules",
          "Less need for values",
        ],
        0
      ),
    ],
  }),
  chapter({
    chapterId: "ch19-desktop-defense",
    number: 19,
    title: "Make The Desktop Serve The Work",
    readingTimeMinutes: 16,
    summary: {
      p1: t(
        "Making the desktop serve the work means shaping the computer environment so it supports the task at hand instead of constantly advertising alternatives.",
        "Eyal extends the same logic used on the phone to the desktop: defaults, visibility, and convenience quietly steer behavior.",
        "A better desktop lowers the chance that every work session turns into tab wandering."
      ),
      p2: t(
        "This matters because computers are often where high value work happens and where endless detours are only one click away.",
        "When the workspace is cluttered with tabs, badges, bookmarks, and entertainment shortcuts, the cost of distraction falls dramatically.",
        "The deeper lesson is that digital workspace design is cognitive workspace design. Cleaner defaults protect thought before willpower is needed."
      ),
    },
    standardBullets: [
      bullet(
        "The desktop is an environment, not a neutral surface. What it shows and how it behaves shape what feels natural to click.",
        "That means attention is influenced before any conscious decision is made.",
        "Defaults quietly suggest behavior.",
        "A screen full of alternatives trains the mind toward switching."
      ),
      bullet(
        "Open tabs are active temptations. Each visible tab can act like a reminder that another path is ready and easy.",
        "Too many tabs create both clutter and permission to drift.",
        "A smaller active set supports clearer thinking.",
        "Tab abundance often disguises itself as preparedness while increasing cognitive drag."
      ),
      bullet(
        "Separate work from wandering. Different browsers, profiles, or spaces can stop leisure and work cues from living on top of one another.",
        "Context separation weakens habitual switching.",
        "This is useful because many detours win through familiarity.",
        "When the wrong cues are absent, the wrong habit has less to recruit."
      ),
      bullet(
        "Start the machine in service of the task. What opens first matters because first clicks often set the tone of the session.",
        "A stronger startup sequence reduces accidental drift.",
        "Opening into the work is a form of precommitment.",
        "The earliest seconds of a session often decide whether focus begins or bargaining begins."
      ),
      bullet(
        "Reduce badges and visual noise. The desktop should not keep announcing possible interruptions while you are trying to think.",
        "Visual signals work even when you never click them.",
        "Less noise usually means fewer attention leaks.",
        "A cluttered screen keeps part of the mind in surveillance mode."
      ),
      bullet(
        "Use blockers where the habit is strong. If certain sites reliably derail you, make the path slower or unavailable during focus time.",
        "This matters because many habits win long before reflection appears.",
        "Friction protects the vulnerable moment.",
        "A computer designed for your better judgment should not assume your sharpest self is always present."
      ),
      bullet(
        "Bookmarks and shortcuts are policy decisions. What gets one click access is what you are telling yourself matters most.",
        "That is why shortcut design deserves more attention than it usually gets.",
        "Ease signals priority.",
        "If entertainment is easier to reach than the work, the desktop is already voting."
      ),
      bullet(
        "One screen can hold many roles, so role boundaries have to be designed. Work, research, communication, and recreation each need clearer containment.",
        "Without that containment the computer becomes one giant context switcher.",
        "Better role boundaries reduce accidental transitions.",
        "A machine with no internal zones keeps training a mind with no internal zones."
      ),
      bullet(
        "Review where the drift begins. The first detour site, tab, or click often reveals the real opening in your desktop setup.",
        "That pattern is useful because it points to a specific design change.",
        "Not all weak points are equally important.",
        "The earliest leak is often the one worth fixing first."
      ),
      bullet(
        "Build a workspace that favors traction by default. When the computer makes the right action easier, discipline stops carrying the full load alone.",
        "This returns the chapter to the book's broader principle of environment design.",
        "Good defaults reduce negotiation.",
        "A well designed desktop helps you start better, stay better, and recover faster after a drift attempt."
      ),
    ],
    deeperBullets: [
      bullet(
        "Digital clutter is mental clutter with a time delay. You may not consciously notice every cue, but the background competition still taxes attention.",
        "That makes cleanup more consequential than it can appear.",
        "The deepest gain is often calmer cognition, not only fewer clicks."
      ),
      bullet(
        "Research detours often masquerade as work. A desktop full of open possibilities makes it easy to keep feeling engaged while avoiding commitment.",
        "This is why research spaces and execution spaces benefit from separation.",
        "Ambiguous workstations support ambiguous effort."
      ),
      bullet(
        "Startup rituals are identity signals. The first thing your machine opens teaches you what this device session is for.",
        "Repeated starts become repeated expectations.",
        "A focused opening can reshape habit more than people expect."
      ),
      bullet(
        "The desktop reveals your real convenience hierarchy. What is easiest to open is what you have privileged, whether or not you intended to.",
        "That makes interface design a truth telling exercise.",
        "The computer reflects your priorities back to you."
      ),
      bullet(
        "Cleaner digital spaces create better recovery after interruption. When the screen is simpler, it is easier to find the original thread of work again.",
        "This is another hidden value of desktop design.",
        "Good environments reduce both drift and reentry cost."
      ),
    ],
    takeaways: [
      "Desktops shape behavior",
      "Tabs and badges are triggers",
      "Separate work from wandering",
      "Startup matters",
      "Block strong detours",
      "Design defaults for traction",
    ],
    practice: [
      "Close one category of tabs that does not belong in the current task",
      "Separate work and leisure into different browser spaces",
      "Remove one distracting badge or visual cue",
      "Make the first app you open serve the planned work",
      "Add friction to one reliable desktop detour",
    ],
    examples: [
      example(
        "ch19-ex01",
        "Study laptop with endless tabs",
        ["school"],
        "A student keeps dozens of tabs open while studying, so every glance at the browser offers several more interesting alternatives than the assignment.",
        [
          "Close the tabs that are not serving the current block and keep only the materials the task requires.",
          "Make reentry into the assignment easier than drifting outward."
        ],
        "This matters because visible options are active cues. A crowded desktop quietly votes against concentration."
      ),
      example(
        "ch19-ex02",
        "Research becomes random browsing",
        ["school"],
        "A student doing research keeps sliding from useful sources into unrelated links because the same browser space holds both course work and all her usual entertainment habits.",
        [
          "Separate the research environment from the normal wandering environment.",
          "Reduce the number of one click paths from study into drift."
        ],
        "The chapter helps because context separation weakens habitual switching. One machine can still contain cleaner zones."
      ),
      example(
        "ch19-ex03",
        "Work session opens into distraction",
        ["work"],
        "An employee starts the laptop and immediately sees email, chat badges, news tabs, and a video site from the night before, so focused work never really gets a clean beginning.",
        [
          "Redesign startup so the machine opens into the planned task or its key materials.",
          "Remove the cues that invite instant switching."
        ],
        "This shows why the first seconds matter. A bad opening makes attention reactive before the work has even begun."
      ),
      example(
        "ch19-ex04",
        "Reliable detour site during analysis",
        ["work"],
        "A worker notices that almost every difficult analysis session derails when he opens one familiar site that then branches into many more clicks.",
        [
          "Treat that first detour as the key weak point and block or slow it during focus blocks.",
          "Fix the earliest leak rather than only scolding the later cascade."
        ],
        "The deeper lesson is that drift often begins in a repeatable place. Better desktop design targets the opening, not only the aftermath."
      ),
      example(
        "ch19-ex05",
        "Home computer mixes everything together",
        ["personal"],
        "A person uses the same desktop for bills, writing, videos, shopping, and social feeds, so every productive session begins inside an environment built for temptation too.",
        [
          "Create clearer spaces or profiles for different roles on the computer.",
          "Let the productive context show the tools that serve it best."
        ],
        "This matters because role confusion on the screen creates role confusion in attention. Cleaner zones reduce accidental switching."
      ),
      example(
        "ch19-ex06",
        "Late night computer drift",
        ["personal"],
        "Someone sits down to do one useful task on the computer at night, but visible shortcuts and leftover tabs quickly pull the session into random wandering.",
        [
          "Change the desktop so the intended task is the easiest first move and tempting paths require more effort.",
          "Use the environment to protect tired attention."
        ],
        "The chapter applies here because defaults matter most when energy is low. Better setup supports the version of you that is easiest to distract."
      ),
    ],
    questions: [
      question(
        "ch19-q01",
        "What is the main idea of this chapter?",
        [
          "The desktop should be designed to support the current work rather than advertise alternatives",
          "Computers are too neutral to matter",
          "More open tabs always mean better preparation",
          "Desktop distraction matters only in offices",
        ],
        0
      ),
      question(
        "ch19-q02",
        "Why are open tabs a problem?",
        [
          "They act as visible cues and make switching easier",
          "They always slow the computer",
          "They matter only for students",
          "They make blockers unnecessary",
        ],
        0
      ),
      question(
        "ch19-q03",
        "How does separating work and leisure spaces help?",
        [
          "It weakens habitual transitions between unlike roles",
          "It removes the need for planning",
          "It makes every task interesting",
          "It matters only for heavy users",
        ],
        0
      ),
      question(
        "ch19-q04",
        "Why does startup sequence matter?",
        [
          "The first apps and cues often set the tone of the whole session",
          "It only affects boot speed",
          "It matters only on new devices",
          "A good startup can replace all boundaries later",
        ],
        0
      ),
      question(
        "ch19-q05",
        "What role do badges and visual noise play?",
        [
          "They keep announcing possible interruptions even when you do not click them",
          "They improve calm focus",
          "They only matter if sound is on",
          "They help restore attention after drift",
        ],
        0
      ),
      question(
        "ch19-q06",
        "Why can blockers be useful on the desktop?",
        [
          "Many detours win before reflection appears, so friction protects the vulnerable moment",
          "Because blockers make thought unnecessary",
          "Because every site should be blocked",
          "Because discipline never matters",
        ],
        0
      ),
      question(
        "ch19-q07",
        "What do shortcuts and bookmarks quietly communicate?",
        [
          "What you have made easiest to do and therefore most likely to do",
          "Only which sites you like aesthetically",
          "Nothing important about behavior",
          "Whether the device is modern",
        ],
        0
      ),
      question(
        "ch19-q08",
        "What is one smart way to find your biggest desktop weak point?",
        [
          "Look for the first recurring detour click that starts the drift cascade",
          "Count total time online once a month",
          "Assume every app is equal",
          "Focus only on the last tab opened",
        ],
        0
      ),
      question(
        "ch19-q09",
        "Why does cleaner desktop design help after interruptions too?",
        [
          "It lowers reentry cost by making the original work easier to find again",
          "It prevents every interruption forever",
          "It matters only for creative work",
          "It removes the need for any routine",
        ],
        0
      ),
      question(
        "ch19-q10",
        "What is the central standard for the desktop?",
        [
          "Defaults should favor traction so discipline is not carrying the full load alone",
          "Entertainment should stay one click away from every task",
          "A little clutter always improves performance",
          "The screen should reflect every possible option equally",
        ],
        0
      ),
    ],
  }),
  chapter({
    chapterId: "ch20-articles-and-rabbit-holes",
    number: 20,
    title: "Capture Interesting Inputs Without Falling In",
    readingTimeMinutes: 12,
    summary: {
      p1: t(
        "Capturing interesting inputs without falling in means protecting curiosity without letting it hijack the moment that was meant for something else.",
        "Eyal recognizes that articles, videos, ideas, and links can be genuinely valuable while still becoming distractions when consumed at the wrong time.",
        "The practical move is to save the input now and revisit it later under chosen conditions."
      ),
      p2: t(
        "This matters because curiosity can easily masquerade as productive exploration while it quietly destroys continuity.",
        "A capture system lets you honor the value of the input without paying the full price of immediate detour.",
        "The deeper lesson is that not now does not mean not ever. Delayed curiosity is often smarter curiosity."
      ),
    },
    standardBullets: [
      bullet(
        "Interesting is not the same as timely. A useful link can still be distraction if it interrupts the wrong block.",
        "This distinction protects curiosity without making it sovereign.",
        "Value and timing are separate questions.",
        "The same article may be excellent at five o clock and destructive at ten thirty."
      ),
      bullet(
        "Capture beats consume. Saving the idea preserves it without requiring an immediate switch.",
        "That is the core habit the chapter tries to build.",
        "It keeps the moment honest.",
        "A trusted capture system turns curiosity from a trap into a future appointment."
      ),
      bullet(
        "Rabbit holes begin with one seemingly harmless click. The first move often feels justified because the content is not obviously frivolous.",
        "That is why self awareness matters here.",
        "Many detours look educational while still being mistimed.",
        "The danger is not only trivial content. It is broken continuity."
      ),
      bullet(
        "Trust the queue. If you do not believe the input will be there later, you are more likely to consume it now.",
        "A reliable list reduces fear of losing something valuable.",
        "This makes future review psychologically easier.",
        "The capture habit depends on confidence that deferred attention is still real attention."
      ),
      bullet(
        "Review captured material deliberately. A save later list helps only if it has a real later.",
        "Scheduled curiosity keeps the system from becoming a graveyard of guilt.",
        "This is how delayed exploration stays alive.",
        "Curiosity deserves a place, not only postponement."
      ),
      bullet(
        "Distinguish research from wandering. A current project may genuinely require exploration, but that exploration still needs boundaries.",
        "Without boundaries, research can become socially approved drift.",
        "The chapter encourages deliberate search rather than open ended grazing.",
        "Useful exploration has a question it is serving."
      ),
      bullet(
        "The capture moment should be short. If saving the input becomes a whole new activity, the detour still wins.",
        "Keep the step light enough that you can return quickly.",
        "The goal is minimal interruption.",
        "A fast note is better than a complicated filing ritual in the middle of deep work."
      ),
      bullet(
        "Curiosity needs containment, not suppression. The chapter respects the value of discovery while rejecting its right to interrupt every other commitment.",
        "This keeps the method intellectually alive.",
        "You do not have to become less interested in the world.",
        "You do need better rules for when interest gets your full attention."
      ),
      bullet(
        "One saved link can protect many future minutes. Avoiding the initial detour often prevents the whole cascade that would have followed.",
        "This is why a small capture habit can have outsized impact.",
        "Continuity is worth defending.",
        "The real cost of a rabbit hole is rarely the first article alone."
      ),
      bullet(
        "Choose the moment of exploration. Curiosity is best used when it serves the day's actual priorities rather than overruling them.",
        "That returns the chapter to traction versus distraction.",
        "The question is not whether learning is good. It is whether this is the moment for it.",
        "A chosen exploration block keeps wonder while protecting continuity."
      ),
    ],
    deeperBullets: [
      bullet(
        "Curiosity becomes costly when it loses sequence. Even valuable ideas can fracture the mental thread that more important work depends on.",
        "That hidden continuity cost is why this chapter matters.",
        "Intelligence without timing can still reduce effectiveness."
      ),
      bullet(
        "The fear of forgetting drives many detours. People often click now because they do not trust their memory or system to preserve the input.",
        "A better capture habit addresses that fear directly.",
        "System trust is a hidden part of self control."
      ),
      bullet(
        "Research boundaries prevent self flattering drift. People can stay in exploration long after it stops increasing understanding because searching still feels like work.",
        "The chapter is a guard against that illusion.",
        "A defined question helps research remain traction."
      ),
      bullet(
        "A good queue keeps both humility and ambition. It admits that you cannot follow every interesting thread now while preserving respect for what is worth later attention.",
        "That is a mature relationship with abundance.",
        "The queue turns scarcity from loss into order."
      ),
      bullet(
        "Delayed curiosity often leads to better judgment. When you revisit an input later, you can evaluate it with more context and less impulsive hunger.",
        "Timing can improve not only focus, but also learning quality.",
        "Better attention often makes for better curiosity too."
      ),
    ],
    takeaways: [
      "Useful is not always timely",
      "Capture beats detour",
      "Trust a real queue",
      "Schedule later review",
      "Research needs boundaries",
      "Chosen curiosity is stronger",
    ],
    practice: [
      "Create one quick capture list for interesting links",
      "Save one input instead of opening it immediately",
      "Schedule one block for later review",
      "Use a clear research question before opening extra sources",
      "Keep capture fast enough to return to the task quickly",
    ],
    examples: [
      example(
        "ch20-ex01",
        "Interesting source during exam prep",
        ["school"],
        "While reviewing for an exam, a student finds an interesting article connected to the topic and feels the pull to read it right away even though the current block is for practice problems.",
        [
          "Save the article to a trusted queue and return to the practice block.",
          "Review the article later in a time chosen for exploration."
        ],
        "This matters because curiosity can be valuable and mistimed at the same time. Capture protects both learning and continuity."
      ),
      example(
        "ch20-ex02",
        "Research becomes endless clicking",
        ["school"],
        "A student begins looking for one citation and thirty minutes later is still opening new tabs with no clear sense of what question is being answered.",
        [
          "Restate the research question and capture promising links without opening all of them now.",
          "Keep the exploration tied to the assignment's actual need."
        ],
        "The chapter helps because research can become socially approved wandering. Better boundaries keep it in service of the work."
      ),
      example(
        "ch20-ex03",
        "Article detours during strategy work",
        ["work"],
        "An employee doing strategic thinking keeps opening interesting industry pieces as they appear, so the main work session dissolves into serial reading.",
        [
          "Capture the articles quickly and continue the strategy block.",
          "Review the saved pieces later when exploration is the chosen task."
        ],
        "This shows why not now is different from not ever. Delayed curiosity preserves the value without sacrificing the current priority."
      ),
      example(
        "ch20-ex04",
        "Research thread eats the afternoon",
        ["work"],
        "A worker searching for one answer keeps broadening the search because every new source suggests another angle, and the original deliverable stops moving.",
        [
          "Set a clear research question and save side paths to a queue rather than following them immediately.",
          "Keep the work connected to the deliverable."
        ],
        "The deeper issue is loss of sequence. Interesting inputs are not useful if they keep breaking the line of the real work."
      ),
      example(
        "ch20-ex05",
        "Late night idea surfing",
        ["personal"],
        "Someone working on a personal project keeps chasing related videos, articles, and forums because every one of them feels potentially useful.",
        [
          "Capture the best leads in one place and return to building or writing now.",
          "Give exploration its own later block."
        ],
        "This matters because many rabbit holes start with genuinely relevant material. The timing is what turns them into distraction."
      ),
      example(
        "ch20-ex06",
        "Recipe browsing replaces dinner prep",
        ["personal"],
        "A person trying to cook dinner keeps opening more interesting recipes and food content until actual cooking starts much later than planned.",
        [
          "Save ideas for later and stick with the recipe that serves the current meal.",
          "Let the current task stay current."
        ],
        "The chapter applies broadly because curiosity can overrun simple tasks too. A quick capture habit protects the plan without dismissing the interest."
      ),
    ],
    questions: [
      question(
        "ch20-q01",
        "What is the chapter's main distinction?",
        [
          "Interesting content can still be badly timed for the moment you are in",
          "Interesting content is always distraction",
          "Research should always happen immediately",
          "Curiosity should be suppressed",
        ],
        0
      ),
      question(
        "ch20-q02",
        "Why is capturing better than consuming right away in many cases?",
        [
          "It preserves the value of the input without breaking the current traction",
          "It makes the input less useful later",
          "It guarantees the queue stays small",
          "It matters only for work tasks",
        ],
        0
      ),
      question(
        "ch20-q03",
        "What often makes the first click into a rabbit hole feel justified?",
        [
          "The content is genuinely interesting or useful looking",
          "The content is obviously silly",
          "The task was never important",
          "Rabbit holes begin only with entertainment",
        ],
        0
      ),
      question(
        "ch20-q04",
        "Why is trusting the queue important?",
        [
          "Without trust, people fear losing the idea and follow it immediately",
          "It keeps the queue from ever needing review",
          "It makes the content more urgent",
          "It works only with paper notes",
        ],
        0
      ),
      question(
        "ch20-q05",
        "What makes a later review system real rather than fake?",
        [
          "It includes an actual later time for revisiting saved material",
          "It grows without limit",
          "It stores every possible idea forever",
          "It prevents all curiosity",
        ],
        0
      ),
      question(
        "ch20-q06",
        "How should research be handled according to this chapter?",
        [
          "With a defined question and boundaries so it does not become wandering",
          "As open ended grazing whenever possible",
          "Only after the task is finished",
          "Without any note system",
        ],
        0
      ),
      question(
        "ch20-q07",
        "Why should the capture step stay brief?",
        [
          "Because a long saving ritual can become a new detour",
          "Because details never matter",
          "Because queues should be empty",
          "Because short notes are always complete",
        ],
        0
      ),
      question(
        "ch20-q08",
        "What does the chapter mean by containment rather than suppression?",
        [
          "Curiosity should have its own place and timing instead of ruling every moment",
          "Interesting ideas should be avoided completely",
          "Only shallow content should be delayed",
          "Curiosity is dangerous by nature",
        ],
        0
      ),
      question(
        "ch20-q09",
        "What is one hidden cost of a rabbit hole?",
        [
          "Loss of continuity in the work you were originally doing",
          "A cleaner desktop",
          "Fewer ideas to revisit",
          "Lower curiosity overall",
        ],
        0
      ),
      question(
        "ch20-q10",
        "What is the chapter's central standard for exploration?",
        [
          "Choose the moment of curiosity instead of letting it overrule the current plan",
          "Follow every useful link instantly",
          "Keep no queue at all",
          "Let research remain undefined",
        ],
        0
      ),
    ],
  }),
  chapter({
    chapterId: "ch21-feed-control",
    number: 21,
    title: "Stop Feeds From Controlling Your Mind",
    readingTimeMinutes: 13,
    summary: {
      p1: t(
        "Stopping feeds from controlling your mind means refusing to let infinite streams decide what deserves your attention next.",
        "Eyal treats feeds as especially dangerous because they combine endless novelty with algorithms designed to keep you consuming without natural stopping points.",
        "The practical answer is to move from passive feed consumption toward more deliberate and finite information habits."
      ),
      p2: t(
        "This matters because feeds are built to fill every idle space and keep curiosity from ever feeling complete.",
        "When they remain the default source of stimulation, they train fragmented attention and make stillness feel strange.",
        "The deeper lesson is that information abundance needs boundaries. Without them, other people's priorities and algorithms become your mental diet."
      ),
    },
    standardBullets: [
      bullet(
        "Feeds are engineered for continuation. Their design removes natural stopping cues that help attention disengage.",
        "This makes them very different from finite articles or chosen reading lists.",
        "Endlessness is one of their main powers.",
        "A stream without edges keeps inviting one more check and one more minute."
      ),
      bullet(
        "Algorithms do not share your priorities. What rises in the feed is chosen for engagement, not for your best use of time or mind.",
        "This is why passive consumption can drift so far from intention.",
        "The feed optimizes for staying, not for serving you.",
        "Attention outsourced to a ranking system is rarely well aligned by accident."
      ),
      bullet(
        "Feeds thrive on idle moments. Boredom, waiting, and low energy become easy entry points for endless scrolling.",
        "That is one reason feed habits can spread across the whole day.",
        "The stream specializes in occupying cracks in attention.",
        "What begins as a quick fill often becomes a repeated default."
      ),
      bullet(
        "Finite beats infinite. Deliberate lists, saved sources, and chosen reading windows give information boundaries again.",
        "Boundaries make stopping possible.",
        "This is one of the cleanest feed fixes.",
        "A limited set of inputs is easier to use intentionally than a bottomless stream."
      ),
      bullet(
        "Pull is healthier than push. Going to information you chose is different from being constantly fed what a system wants you to see.",
        "That shift restores some authorship over attention.",
        "It also reduces surprise driven checking.",
        "Chosen intake usually produces calmer cognition than algorithmic drift."
      ),
      bullet(
        "Do not confuse awareness with immersion. Staying informed does not require living inside every update stream.",
        "This matters because feeds often justify themselves through identity and fear of missing out.",
        "Breadth without boundaries can still be shallow and costly.",
        "Knowing enough is different from endlessly refreshing."
      ),
      bullet(
        "Reduce feed access points. The fewer routes that lead you into the stream, the fewer moments it can capture.",
        "This can mean removing shortcuts, logging out, or using alternate ways to access chosen content.",
        "Access design is attention design.",
        "The easiest feed to resist is often the one that lost its privileged doorway."
      ),
      bullet(
        "Choose when information deserves your mind. News, social updates, and trend watching all become healthier when they happen in time you selected.",
        "This turns the feed from ambient weather into a chosen activity.",
        "Timing helps restore proportionality.",
        "Some information is worth reading without being worth permanent surveillance."
      ),
      bullet(
        "Mental residue matters. Feed hopping can leave the mind more restless even after the app closes.",
        "That means the cost is not only in minutes spent.",
        "Attention quality after the feed often falls too.",
        "The stream can shape the texture of thinking long after the session ends."
      ),
      bullet(
        "Your mind needs a better diet than whatever the feed serves first. Curate what enters rather than relying on the stream to behave responsibly for you.",
        "The chapter turns information intake into a design choice.",
        "Curation is a form of self protection.",
        "What you repeatedly consume becomes part of the mental environment you later try to think inside."
      ),
    ],
    deeperBullets: [
      bullet(
        "Feeds monetize incompletion. They keep attention hungry by making closure unlikely and novelty constant.",
        "That hunger is not an accident. It is part of the business model.",
        "Understanding this helps reduce naive trust in the stream."
      ),
      bullet(
        "Information abundance can mimic importance. People often overvalue what they see most often, not what matters most.",
        "The feed takes advantage of that bias.",
        "Curation is therefore also a judgment defense."
      ),
      bullet(
        "The stream trains the nervous system toward twitchier attention. Quick novelty shifts can make slower forms of focus feel less natural.",
        "This is one reason feed habits affect other domains of concentration.",
        "The cost is partly neurological rhythm, not only lost time."
      ),
      bullet(
        "Good curation is active leadership of your own mind. It requires choosing sources, frequency, and stopping points before appetite takes over.",
        "This is the deeper alternative to passive consumption.",
        "A better information system is a better attention system."
      ),
      bullet(
        "Silence is informative too. When you step back from the feed, you often learn how much of its urgency was manufactured by repetition rather than by true necessity.",
        "Distance restores perspective.",
        "The chapter invites that experiment directly."
      ),
    ],
    takeaways: [
      "Feeds are built to continue",
      "Algorithms do not share your priorities",
      "Finite beats infinite",
      "Pull is healthier than push",
      "Access points matter",
      "Curate your mental diet",
    ],
    practice: [
      "Replace one feed check with a chosen source or saved list",
      "Remove one easy access point into an endless stream",
      "Set one planned window for news or social updates",
      "Notice how feed use changes your attention after the app closes",
      "Choose a finite stopping point before entering any stream",
    ],
    examples: [
      example(
        "ch21-ex01",
        "News feed before class",
        ["school"],
        "A student opens a news feed while waiting for class and arrives mentally scattered because the quick check turned into an endless stream of emotionally unrelated items.",
        [
          "Replace the feed with a chosen finite source or skip the stream entirely in that waiting window.",
          "Stop giving idle minutes to a system built to keep extending them."
        ],
        "This matters because feeds thrive on small empty spaces. Finite information habits protect those spaces from becoming endless intake."
      ),
      example(
        "ch21-ex02",
        "Social feed between study blocks",
        ["school"],
        "A student checks a social feed between study blocks for a quick reset and then struggles to return because the stream keeps offering new social and emotional pulls.",
        [
          "Use a finite break activity instead of an infinite social stream.",
          "Choose a stopping point before entering any feed."
        ],
        "The chapter helps because the issue is not only time lost. It is the restless state the stream can leave behind."
      ),
      example(
        "ch21-ex03",
        "Industry feed becomes ambient work",
        ["work"],
        "An employee tells himself he is staying informed by keeping an industry feed open all day, but most of the checking is reactive novelty rather than needed insight.",
        [
          "Move updates into a chosen review block and use a curated list instead of an ambient stream.",
          "Let information serve the work rather than interrupt it."
        ],
        "This shows why awareness and immersion are different. A steady feed can create the feeling of relevance while fragmenting the day."
      ),
      example(
        "ch21-ex04",
        "Team trend watching steals focus",
        ["work"],
        "A team keeps dropping interesting feed items into chat all day, and everyone feels pressure to stay current even when most items are not needed for the current priority.",
        [
          "Create a more bounded time and place for trend review.",
          "Protect active work blocks from stream driven side attention."
        ],
        "The chapter matters because feeds can turn whole teams reactive. Better curation restores proportion."
      ),
      example(
        "ch21-ex05",
        "Morning scroll sets the tone",
        ["personal"],
        "Someone starts each morning in a social or news feed and notices that the day begins with other people's agendas, emotions, and urgency.",
        [
          "Replace the morning feed with a chosen finite input or no input at all.",
          "Protect the opening of the day from algorithmic authorship."
        ],
        "This matters because the first attention of the day has outsized influence. Feeds are poor authors for that opening."
      ),
      example(
        "ch21-ex06",
        "Evening unwind becomes stream trance",
        ["personal"],
        "A person wants a little evening relaxation but ends up in a long feed session because there is never a natural point that says enough.",
        [
          "Choose a finite leisure option or define a stopping rule before opening the feed.",
          "Use boundaries that the stream itself will never give you."
        ],
        "The deeper lesson is that endless systems require outside limits. The platform is not designed to stop on your behalf."
      ),
    ],
    questions: [
      question(
        "ch21-q01",
        "Why are feeds especially dangerous for attention?",
        [
          "They are designed for endless continuation and novelty",
          "They contain only false information",
          "They matter only for young users",
          "They always improve awareness",
        ],
        0
      ),
      question(
        "ch21-q02",
        "What is one core problem with algorithmic feeds?",
        [
          "They optimize for engagement, not for your best priorities",
          "They are always too short",
          "They remove social comparison",
          "They work only on phones",
        ],
        0
      ),
      question(
        "ch21-q03",
        "Why do feeds spread so easily through the day?",
        [
          "They fit naturally into boredom and waiting moments",
          "They require large empty time blocks",
          "They only work when people are highly motivated",
          "They are difficult to open quickly",
        ],
        0
      ),
      question(
        "ch21-q04",
        "What is one of the best alternatives to an infinite feed?",
        [
          "A finite, curated list or chosen source",
          "More notifications from the same feed",
          "Opening several feeds at once",
          "Trusting the algorithm more",
        ],
        0
      ),
      question(
        "ch21-q05",
        "What does pull over push mean in this chapter?",
        [
          "Going to information you chose instead of being constantly served whatever keeps you engaged",
          "Checking more often",
          "Using only printed media",
          "Avoiding all updates forever",
        ],
        0
      ),
      question(
        "ch21-q06",
        "Why is staying informed different from living in a feed?",
        [
          "Because awareness can be finite and chosen, while feed immersion is endless and reactive",
          "Because informed people never use technology",
          "Because feeds contain no useful content",
          "Because only professionals need news",
        ],
        0
      ),
      question(
        "ch21-q07",
        "What role do access points play with feeds?",
        [
          "Reducing easy entry points lowers the number of moments the stream can capture",
          "They matter only if you already use blockers",
          "More entry points improve control",
          "Access points are unrelated to habit",
        ],
        0
      ),
      question(
        "ch21-q08",
        "Why should feed use happen in chosen windows?",
        [
          "So the stream stops functioning like ambient mental weather",
          "So urgency increases",
          "So stopping points disappear",
          "So every idle moment stays filled",
        ],
        0
      ),
      question(
        "ch21-q09",
        "What is one hidden cost of feed use?",
        [
          "It can leave the mind more restless even after the app closes",
          "It always improves concentration afterward",
          "It removes the need for curation",
          "It matters only when sessions are long",
        ],
        0
      ),
      question(
        "ch21-q10",
        "What is the chapter's main standard for information intake?",
        [
          "Curate what enters your mind instead of letting the feed decide by default",
          "Stay inside the stream to remain current",
          "Avoid all information entirely",
          "Treat every update as equally important",
        ],
        0
      ),
    ],
  }),
  chapter({
    chapterId: "ch16-group-chat-control",
    number: 16,
    title: "Do Not Let Group Chat Set Your Agenda",
    readingTimeMinutes: 13,
    summary: {
      p1: t(
        "Group chat should not set your agenda because a fast moving thread makes other people's priorities feel urgent whether they are or not.",
        "Eyal treats group chat as a powerful external trigger because it combines social pressure, uncertainty, and constant novelty in one channel.",
        "The answer is not total withdrawal. It is clearer norms, clearer timing, and less automatic access."
      ),
      p2: t(
        "This matters because chat can make everyone feel available all the time while very little thoughtful work gets protected.",
        "When teams or groups do not define urgency, response rhythm, and channel purpose, the thread starts governing attention by default.",
        "The deeper lesson is that speed is a poor substitute for coordination. Better chat habits protect both focus and collaboration."
      ),
    },
    standardBullets: [
      bullet(
        "Chat rewards immediacy. Its design makes every new message feel like a call for attention right now.",
        "That sensation is stronger when the thread involves status, belonging, or fear of missing something important.",
        "The channel therefore needs boundaries more than it needs blind trust.",
        "Without them, the next ping quietly becomes the task."
      ),
      bullet(
        "Not every message deserves the same speed. Treating all chat as urgent destroys the meaning of urgency.",
        "Clear norms help people separate emergencies from updates and casual notes.",
        "This lowers anxiety for everyone.",
        "A channel becomes calmer when response speed is matched to actual stakes."
      ),
      bullet(
        "Mute by default when possible. Silence is often the first line of defense against attention theft.",
        "You can still check intentionally without letting the channel interrupt on its own schedule.",
        "This turns chat from a trigger into a tool again.",
        "The goal is not ignorance. It is chosen timing."
      ),
      bullet(
        "Use chat in batches. Processing the thread at deliberate moments is cheaper than reentering it dozens of times.",
        "That protects concentration and often improves reply quality too.",
        "Batching reduces the emotional pull of constant low grade checking.",
        "A thread feels less powerful when it is no longer allowed to dictate the rhythm of the day."
      ),
      bullet(
        "Define what belongs in chat. Some issues need a document, meeting, or direct decision instead of a noisy stream of partial replies.",
        "Channel fit matters as much here as it does with email.",
        "The wrong medium creates extra attention cost.",
        "Clarity improves when chat stops carrying work it cannot hold well."
      ),
      bullet(
        "Social pressure is part of the problem. People often answer quickly because delay feels like disloyalty or invisibility.",
        "Naming that pressure helps groups design more humane rules.",
        "The issue is not only efficiency. It is emotion.",
        "A team that ignores the social layer will keep recreating the same urgency habits."
      ),
      bullet(
        "Asynchronous work needs protection. Chat should support coordination, not replace thoughtful progress with permanent conversation.",
        "This is why deep work blocks and chat boundaries belong together.",
        "A healthy team can be responsive without being permanently reactive.",
        "Good work rhythm includes times when no reply is expected."
      ),
      bullet(
        "Escalation paths should be explicit. If something truly cannot wait, people need a clearer route than just posting into the thread harder.",
        "That protects both true emergencies and normal attention.",
        "Escalation rules restore signal to the system.",
        "When the path for urgency is vague, every message starts trying to impersonate it."
      ),
      bullet(
        "Thread hygiene matters. Clear summaries, decisions, and ownership reduce repeated re reading and confusion.",
        "That makes chat less sticky and less cognitively expensive.",
        "Attention is saved when people do not have to reconstruct meaning from scattered fragments.",
        "A cleaner thread produces fewer later interruptions."
      ),
      bullet(
        "Chat should serve the work, not become the work. The central test is whether the channel is helping real traction or consuming the time meant for it.",
        "This returns the chapter to the book's larger filter.",
        "Tools are judged by alignment, not by habit.",
        "A busy channel can create the illusion of progress while the actual priorities keep waiting."
      ),
    ],
    deeperBullets: [
      bullet(
        "Group chat often monetizes or rewards vigilance. It trains people to keep one part of the mind socially open at all times.",
        "That background openness is mentally costly even when nobody is actively typing.",
        "The deeper fix is not only fewer messages, but less assumed vigilance."
      ),
      bullet(
        "Chat can collapse hierarchy badly. People may use the same stream for minor chatter, high stakes decisions, and emotional escalation.",
        "That mixture erodes judgment.",
        "Stronger channel boundaries protect meaning as well as focus."
      ),
      bullet(
        "Silence norms shape culture. If delayed responses are treated as disrespect, the group will keep sacrificing depth for reassurance.",
        "Changing that norm is often the true work.",
        "Tool settings help, but culture decides whether people trust those settings."
      ),
      bullet(
        "Fast channels can hide ownership gaps. When everyone can comment quickly, it becomes easier for nobody to hold the real decision clearly.",
        "Thread volume is a poor proxy for accountability.",
        "Good groups pair chat speed with ownership clarity."
      ),
      bullet(
        "The healthiest chat habits protect cognition and relationships at once. People become less resentful when they are not forced to choose between being thoughtful and being seen as responsive.",
        "That is the human advantage of better norms.",
        "The chapter is about social design, not merely muting buttons."
      ),
    ],
    takeaways: [
      "Chat amplifies urgency by design",
      "Mute and batch on purpose",
      "Define what belongs in chat",
      "Social pressure matters",
      "Escalation paths should be clear",
      "Chat should serve real work",
    ],
    practice: [
      "Mute one thread that does not deserve live interruption rights",
      "Set one chat processing window",
      "Clarify what counts as urgent in the channel",
      "Move one ongoing issue to a better medium",
      "Summarize one thread with decisions and owners",
    ],
    examples: [
      example(
        "ch16-ex01",
        "Study group thread never stops",
        ["school"],
        "A study group thread runs all evening with jokes, resources, questions, and anxiety, so everyone keeps checking it while trying to study.",
        [
          "Mute the thread during planned focus blocks and check it at chosen times.",
          "Agree on how urgent questions should be marked and handled."
        ],
        "This matters because the thread is not only sharing information. It is constantly bidding for attention and social reassurance."
      ),
      example(
        "ch16-ex02",
        "Club officers plan in the main chat",
        ["school"],
        "A student club tries to make every decision inside one busy group chat, so important details keep getting buried under casual messages.",
        [
          "Move decisions and owners into a clearer place and reserve chat for the kind of updates it handles well.",
          "Reduce the cost of reconstructing meaning from the stream."
        ],
        "The chapter helps because chat can look efficient while actually increasing confusion and repeated checking."
      ),
      example(
        "ch16-ex03",
        "Team channel interrupts every work block",
        ["work"],
        "An employee cannot finish a focused task because the team channel keeps pulling attention with low stakes updates and quick reactions.",
        [
          "Mute by default and process the channel in batches unless a true escalation path is used.",
          "Protect deep work as something the channel should support rather than replace."
        ],
        "This shows that responsiveness should have a rhythm. Otherwise chat becomes the hidden scheduler of the day."
      ),
      example(
        "ch16-ex04",
        "Manager expects instant chat replies",
        ["work"],
        "A manager uses chat for everything from jokes to urgent requests, so the team has no idea what can wait and what truly cannot.",
        [
          "Define urgency, set a reply rhythm, and separate emergency contact from ordinary chat use.",
          "Make the channel readable again."
        ],
        "The deeper problem is expectation design. When one stream carries every level of importance, attention collapses into constant alertness."
      ),
      example(
        "ch16-ex05",
        "Family group chat invades the workday",
        ["personal"],
        "A family thread is lively all day, and one person keeps checking because silence feels rude even though the messages are rarely urgent.",
        [
          "Mute the thread during chosen work blocks and tell the family what path to use for true urgency.",
          "Let kindness include clearer timing, not only faster checking."
        ],
        "This applies outside work because chat pressure is often social before it is practical. Better expectations reduce guilt driven attention leaks."
      ),
      example(
        "ch16-ex06",
        "Friend group plans everything in one stream",
        ["personal"],
        "A friend group uses one chat for serious plans and endless side conversation, so nobody is sure what was decided and everyone keeps scrolling back.",
        [
          "Summarize decisions clearly and move ongoing planning into a more structured place when needed.",
          "Keep chat from becoming an archive you have to mine repeatedly."
        ],
        "The chapter matters because thread hygiene is also attention hygiene. Confusion creates extra checking."
      ),
    ],
    questions: [
      question(
        "ch16-q01",
        "Why is group chat such a powerful external trigger?",
        [
          "It combines speed, novelty, and social pressure in one channel",
          "It always contains urgent information",
          "It replaces the need for meetings automatically",
          "It is only distracting for large teams",
        ],
        0
      ),
      question(
        "ch16-q02",
        "What is one of the best first defenses against chat driven distraction?",
        [
          "Mute by default and check intentionally",
          "Read every message as soon as it appears",
          "Keep one window open at all times",
          "Treat all silence as rude",
        ],
        0
      ),
      question(
        "ch16-q03",
        "Why should teams define urgency clearly in chat?",
        [
          "So not every message tries to feel immediate",
          "So everyone replies faster",
          "So chat replaces every other channel",
          "So decisions stay inside the stream longer",
        ],
        0
      ),
      question(
        "ch16-q04",
        "What does batching chat responses help reduce?",
        [
          "Repeated context switching and low grade checking",
          "Collaboration quality",
          "Decision clarity",
          "Team trust",
        ],
        0
      ),
      question(
        "ch16-q05",
        "Why is social pressure important in this chapter?",
        [
          "People often answer quickly to avoid seeming disloyal or invisible",
          "It makes every message objectively urgent",
          "It matters only for teenagers",
          "It replaces the need for better norms",
        ],
        0
      ),
      question(
        "ch16-q06",
        "When should chat not be the main tool?",
        [
          "When a clearer medium would handle the issue with less confusion and less repeated checking",
          "Only when the issue is emotional",
          "Never, because chat fits everything",
          "Only in remote teams",
        ],
        0
      ),
      question(
        "ch16-q07",
        "What does the chapter suggest about asynchronous work?",
        [
          "It needs protection so chat does not replace thoughtful progress with permanent conversation",
          "It is less important than being reachable",
          "It cannot coexist with collaboration",
          "It should happen only after business hours",
        ],
        0
      ),
      question(
        "ch16-q08",
        "Why are explicit escalation paths useful?",
        [
          "They reserve true urgency for a clearer route than posting harder into the same thread",
          "They make every message slower",
          "They turn chat into email",
          "They matter only for managers",
        ],
        0
      ),
      question(
        "ch16-q09",
        "What is thread hygiene trying to improve?",
        [
          "Clarity and reduced need for repeated rereading",
          "The total number of jokes",
          "The speed of emotional reactions",
          "The chance that nothing is documented",
        ],
        0
      ),
      question(
        "ch16-q10",
        "What is the central standard for group chat?",
        [
          "It should serve the work rather than quietly becoming the work",
          "It should remain active at all hours",
          "It should replace focus blocks",
          "It should reward the fastest responder most",
        ],
        0
      ),
    ],
  }),
  chapter({
    chapterId: "ch17-meeting-control",
    number: 17,
    title: "Meetings Need Strong Friction And Purpose",
    readingTimeMinutes: 14,
    summary: {
      p1: t(
        "Meetings need strong friction and purpose because without them they expand into easy default interruptions that consume attention without producing enough value.",
        "Eyal treats meetings as one of the most socially accepted ways attention gets fragmented at work and in groups.",
        "The fix is to make meetings earn their existence through clear purpose, clear preparation, and real cost."
      ),
      p2: t(
        "This matters because meetings borrow time from many people at once, which means their hidden cost is usually higher than anyone feels individually.",
        "When friction is low, gatherings happen too easily and thoughtful work gets displaced by performative coordination.",
        "The deeper lesson is that meetings should be scarce enough to matter. Better preparation and better filters protect both decision quality and focus."
      ),
    },
    standardBullets: [
      bullet(
        "Meetings are expensive group interruptions. They take many calendars at once and often break existing deep work blocks.",
        "That is why they need a stronger reason than casual habit.",
        "Their real cost is cumulative, not only visible in the hour itself.",
        "A weak meeting wastes more attention than a weak solo task because it multiplies the loss across people."
      ),
      bullet(
        "Purpose should be explicit. If you cannot say why the meeting exists, the meeting is not ready.",
        "A clear purpose improves preparation and reduces drift inside the conversation.",
        "It also makes cancellation easier when the reason is weak.",
        "Vague meetings survive on inertia."
      ),
      bullet(
        "Agendas create friction that improves quality. An agenda forces someone to think before asking for everyone's time.",
        "That prework alone can eliminate many unnecessary meetings.",
        "When the meeting does happen, the agenda gives it structure.",
        "Preparation is part of respect."
      ),
      bullet(
        "Invite fewer people. Attention is not free, so attendance should be tied to actual contribution or need.",
        "Smaller groups usually decide faster and think more clearly.",
        "Unnecessary attendance spreads fragmentation widely.",
        "If someone can read the outcome instead of sitting through the process, they often should."
      ),
      bullet(
        "Prefer asynchronous updates when live discussion is unnecessary. Not every piece of information needs everyone's simultaneous attention.",
        "This is one of the cleanest ways to reduce meeting load.",
        "Live time should be reserved for what truly benefits from live interaction.",
        "Status exchange alone is often a poor reason to interrupt multiple people."
      ),
      bullet(
        "End with decisions, owners, and next steps. Meetings without clear outputs tend to create repeat meetings.",
        "Closure reduces future attention waste.",
        "The point is not only to talk well. It is to produce movement.",
        "A meeting that clarifies nothing often returns later as another interruption."
      ),
      bullet(
        "Time limits sharpen discipline. A bounded meeting forces prioritization and reduces conversational sprawl.",
        "Scarcity can improve quality here.",
        "Open ended meetings often reward verbal drift over real progress.",
        "A strong limit reminds the group that attention is costly."
      ),
      bullet(
        "Preparation should happen before the room. People waste shared time when they use the meeting to do thinking that should have been done privately.",
        "This is another form of friction that protects collective attention.",
        "Good meetings often rest on strong prework.",
        "The group should not carry confusion that one person could have reduced earlier."
      ),
      bullet(
        "Meeting culture signals respect for focus. Organizations that schedule casually usually communicate that concentration is cheap.",
        "That norm spreads outward into the rest of the workday.",
        "Better meeting habits therefore improve more than meetings.",
        "They teach people what collective attention is worth."
      ),
      bullet(
        "A useful meeting is easier to defend than a habitual one. Strong purpose, structure, and output make the interruptive cost more justifiable.",
        "The chapter is not anti meeting. It is anti casual meeting gravity.",
        "Meetings should serve traction, not replace it by default.",
        "When they must happen, they should be clear enough to deserve the attention they borrow."
      ),
    ],
    deeperBullets: [
      bullet(
        "Low friction meetings often hide decision avoidance. Gathering people can feel like progress when no one is ready to choose.",
        "That makes meetings emotionally convenient even when they are strategically weak.",
        "Purpose and outputs expose this pattern."
      ),
      bullet(
        "The more senior the attendees, the higher the hidden cost. Yet those meetings are often scheduled with the least visible friction.",
        "Cost awareness should rise with leverage, not fall.",
        "Scarce attention becomes especially worth protecting at higher responsibility levels."
      ),
      bullet(
        "Meetings can become status theater. People attend to be seen, informed, or safe rather than because the work needs them there.",
        "That is a cultural problem, not only a logistical one.",
        "Fewer and sharper meetings challenge that theater."
      ),
      bullet(
        "Asynchronous clarity is a skill. Teams that lack it often overuse meetings because writing and ownership are weak.",
        "Better documents and updates can remove surprising amounts of meeting demand.",
        "The deeper solution may be stronger written culture."
      ),
      bullet(
        "Strong meeting friction is respectful, not bureaucratic. It protects collective focus from being spent too cheaply.",
        "This reframes agendas, time limits, and attendee discipline as care for shared attention.",
        "The chapter is about stewardship of group cognition."
      ),
    ],
    takeaways: [
      "Meetings are group interruptions",
      "Purpose must be explicit",
      "Agendas add useful friction",
      "Invite fewer people",
      "Async updates often work better",
      "Meetings should end with owners",
    ],
    practice: [
      "Cancel or convert one meeting with no clear purpose",
      "Add an agenda before asking for group time",
      "Reduce attendance on one recurring meeting",
      "End one meeting with explicit owners and next steps",
      "Protect live discussion for issues that truly need it",
    ],
    examples: [
      example(
        "ch17-ex01",
        "Student committee meets by default",
        ["school"],
        "A student committee meets every week because that is what it has always done, even when most updates could have been shared in writing and the live session produces few decisions.",
        [
          "Give the meeting a clear purpose or replace it with an update and only meet when a real decision or discussion is needed.",
          "Treat everyone's time as costly."
        ],
        "This matters because low friction group time expands easily. Better filters protect attention across the whole team."
      ),
      example(
        "ch17-ex02",
        "Project meeting with half the class",
        ["school"],
        "A group project keeps inviting every member to every planning discussion, even when only a few people are needed for the topic.",
        [
          "Limit attendance to those who need to decide or contribute directly.",
          "Share outcomes clearly with the rest."
        ],
        "The chapter helps because unnecessary attendance multiplies interruption cost without improving the quality of the work."
      ),
      example(
        "ch17-ex03",
        "Weekly work meeting with no agenda",
        ["work"],
        "A recurring team meeting starts with no agenda, drifts through updates, and ends with little more clarity than everyone had before joining.",
        [
          "Require a purpose and agenda before the meeting happens.",
          "If there is no real need for live discussion, send an update instead."
        ],
        "This shows that agenda friction is not bureaucracy for its own sake. It filters weak meetings before they borrow group attention."
      ),
      example(
        "ch17-ex04",
        "Manager keeps scheduling clarification meetings",
        ["work"],
        "A manager uses meetings to think through issues that could have been framed better alone first, so the team spends shared time sorting through avoidable confusion.",
        [
          "Do more prework before convening people.",
          "Use the meeting for actual decision making or discussion, not for first draft thinking."
        ],
        "The deeper issue is that poor preparation exports confusion to many calendars at once. Better preparation protects collective cognition."
      ),
      example(
        "ch17-ex05",
        "Family meeting that solves nothing",
        ["personal"],
        "A household keeps having long planning talks that wander without decisions, so everyone leaves tired and the same issues return later.",
        [
          "State the purpose, limit the time, and end with clear next steps and owners.",
          "Do not use shared time for vague venting if a decision is needed."
        ],
        "The chapter applies at home too because live group time is valuable everywhere. Structure makes it more useful and less draining."
      ),
      example(
        "ch17-ex06",
        "Friend trip planning in endless calls",
        ["personal"],
        "A group of friends keeps scheduling long calls to plan a trip, but most of the basic details could have been handled asynchronously and the call never lands clear decisions.",
        [
          "Use written updates for simple options and reserve live time for the choices that truly need discussion.",
          "Keep the call small and decision focused."
        ],
        "This matters because meetings are not only a workplace problem. Any group can waste collective attention by making live time too easy to call."
      ),
    ],
    questions: [
      question(
        "ch17-q01",
        "Why should meetings face stronger friction than they often do?",
        [
          "Because they borrow attention from many people at once",
          "Because meetings are always bad",
          "Because written work is always better",
          "Because calendars should stay empty",
        ],
        0
      ),
      question(
        "ch17-q02",
        "What is the first test a meeting should pass?",
        [
          "A clear purpose for why live group attention is needed",
          "A large enough attendee list",
          "A long enough time block",
          "A recurring slot on the calendar",
        ],
        0
      ),
      question(
        "ch17-q03",
        "Why do agendas matter?",
        [
          "They force prework and make drift less likely",
          "They make every meeting longer",
          "They replace the need for decisions",
          "They matter only for executives",
        ],
        0
      ),
      question(
        "ch17-q04",
        "What is one of the best ways to reduce meeting cost?",
        [
          "Invite only the people who truly need to contribute or decide",
          "Keep everyone in the room for alignment",
          "Add more status updates to every session",
          "Avoid all written communication",
        ],
        0
      ),
      question(
        "ch17-q05",
        "When should asynchronous updates replace a meeting?",
        [
          "When live discussion is not actually necessary",
          "Only when the topic is unimportant",
          "Never, because meetings build culture",
          "Only after a meeting has already happened",
        ],
        0
      ),
      question(
        "ch17-q06",
        "Why should meetings end with decisions and owners?",
        [
          "So the same confusion does not return later as another interruption",
          "So the meeting feels fuller",
          "So attendance can increase next time",
          "So notes become optional",
        ],
        0
      ),
      question(
        "ch17-q07",
        "What do time limits add to meetings?",
        [
          "Pressure to prioritize and reduce sprawl",
          "More room for drift",
          "Less need for agendas",
          "A reason to invite more people",
        ],
        0
      ),
      question(
        "ch17-q08",
        "What cultural signal do casual meetings send?",
        [
          "That focused attention is cheap and easy to borrow",
          "That the organization loves clarity",
          "That written work is respected",
          "That decisions happen quickly",
        ],
        0
      ),
      question(
        "ch17-q09",
        "What deeper problem can low friction meetings hide?",
        [
          "Decision avoidance dressed up as coordination",
          "Too much written clarity",
          "Too little collaboration",
          "Too much ownership",
        ],
        0
      ),
      question(
        "ch17-q10",
        "What is the chapter's core standard for meetings?",
        [
          "They should be scarce and sharp enough to deserve the attention they borrow",
          "They should happen whenever uncertainty appears",
          "They should replace most solo work",
          "They should be open ended for creativity",
        ],
        0
      ),
    ],
  }),
  chapter({
    chapterId: "ch18-smartphone-defense",
    number: 18,
    title: "Defend Yourself From Phone Triggers",
    readingTimeMinutes: 15,
    summary: {
      p1: t(
        "Defending yourself from phone triggers means redesigning the device so it stops functioning like a portable slot machine for your attention.",
        "Eyal treats the smartphone as a dense bundle of external triggers because it combines notifications, novelty, social reward, and convenience in one object that stays near the body.",
        "The answer is to make the phone serve chosen purposes instead of constantly presenting unchosen ones."
      ),
      p2: t(
        "This matters because the phone collapses many distractions into the easiest possible reach.",
        "When it stays full of visible temptations and interruption rights, moments of boredom or stress turn into automatic checking without much resistance.",
        "The deeper lesson is that device design is life design. Small changes to access, visibility, and friction can meaningfully change how attention gets spent all day."
      ),
    },
    standardBullets: [
      bullet(
        "The phone concentrates triggers. It carries messages, feeds, games, shopping, video, news, and social comparison in one place.",
        "That density makes it unusually powerful as an attention thief.",
        "A small device can therefore create a very large behavioral effect.",
        "The issue is not only what is on the phone, but how close and ready it always is."
      ),
      bullet(
        "Notifications are invitations, not obligations. Many of them should lose the right to interrupt you.",
        "Turning them off is often one of the highest leverage changes available.",
        "Each removed notification eliminates many future moments of bargaining.",
        "The goal is not silence for its own sake. It is better control over when attention gets redirected."
      ),
      bullet(
        "Visibility drives checking. The apps you can see most easily are the ones you are most likely to open impulsively.",
        "That is why home screen design matters.",
        "A cleaner screen reduces cue driven behavior.",
        "Attention often follows what is visually easiest before it follows what is most valuable."
      ),
      bullet(
        "Distance creates friction. A phone across the room behaves differently from a phone in the hand.",
        "Physical placement therefore matters more than people often admit.",
        "Small barriers can protect many moments.",
        "Convenience is never neutral when the behavior is already over practiced."
      ),
      bullet(
        "Separate necessary functions from tempting defaults. The phone can still be useful without giving every entertainment feature prime access.",
        "This is a design question, not an all or nothing question.",
        "Useful tools and tempting cues do not need equal treatment.",
        "Good device design gives purpose more visibility than impulse."
      ),
      bullet(
        "Use the phone on your schedule. Planned check windows weaken the reflex to inspect every moment of boredom or uncertainty.",
        "That is how the device becomes a tool again.",
        "The problem is less owning a phone than being owned by its timing.",
        "A chosen rhythm is stronger than endless informal checking."
      ),
      bullet(
        "Temporary friction helps. Logouts, folders, removed apps, or blocked access can slow the path to impulse.",
        "Friction matters because many phone habits win on speed alone.",
        "When the path lengthens, intention has more room to reappear.",
        "A second of inconvenience can save an hour of drift."
      ),
      bullet(
        "The phone affects presence. Even unused, it can pull part of the mind toward the possibility of interruption.",
        "That is why simply having it visible can matter.",
        "Attention responds to anticipated triggers as well as active ones.",
        "Sometimes the best defense is not resisting the device, but removing it from the scene."
      ),
      bullet(
        "Not every function belongs on the same device. Some activities may be healthier on another screen or in another place.",
        "This creates context specific use instead of universal access.",
        "Context separation weakens habit loops.",
        "A phone does less damage when it stops being the home of every possible urge."
      ),
      bullet(
        "Design the phone for traction. Keep what supports the life you chose and demote what keeps hijacking it.",
        "The standard is alignment, not purity.",
        "A better phone setup protects attention by default rather than only by constant effort.",
        "The device should work for you when you are tired, not only when you are at your sharpest."
      ),
    ],
    deeperBullets: [
      bullet(
        "The phone is powerful partly because it travels into every context. Work, school, rest, relationships, and boredom all meet the same trigger machine.",
        "That makes context design unusually important here.",
        "One object can disrupt many domains at once."
      ),
      bullet(
        "Anticipation is one of the hidden costs. The possibility of something new arriving can fragment attention even before any notification appears.",
        "This is why visible phones and silent phones can both be distracting.",
        "Expectation itself is a trigger."
      ),
      bullet(
        "Removing temptation from the front door matters more than making promises about self control at the threshold. Defaults quietly shape behavior all day.",
        "That is the deeper logic of home screen design.",
        "What you make easiest is what you will often get."
      ),
      bullet(
        "Device friction is compassionate realism. It respects how attention behaves under fatigue instead of assuming perfect judgment in every weak moment.",
        "That makes it a humane strategy, not a punitive one.",
        "Good safeguards help the tired version of you too."
      ),
      bullet(
        "Phone design becomes relational design when the device keeps entering meals, conversations, and intimacy. The chapter is about more than solo productivity.",
        "That wider view gives the device question moral weight.",
        "Portable triggers reshape shared life as well as private focus."
      ),
    ],
    takeaways: [
      "Phones concentrate triggers",
      "Notifications need pruning",
      "Visibility drives checking",
      "Distance adds useful friction",
      "Planned use beats reflexive use",
      "Design the device for traction",
    ],
    practice: [
      "Turn off one category of non essential notifications",
      "Remove one tempting app from your home screen",
      "Keep the phone physically farther away during one focus block",
      "Use one planned phone check window today",
      "Add one extra step between yourself and a common phone habit",
    ],
    examples: [
      example(
        "ch18-ex01",
        "Phone on desk during studying",
        ["school"],
        "A student keeps the phone face up beside the laptop while studying, and even silent screen flashes or idle glances keep breaking concentration.",
        [
          "Move the phone out of sight and reach during the study block.",
          "Remove interruption rights instead of relying only on self control."
        ],
        "This matters because visibility itself is a trigger. The phone does not need to ring to keep part of attention occupied."
      ),
      example(
        "ch18-ex02",
        "Campus walk becomes app loop",
        ["school"],
        "Walking between classes, a student opens the phone out of habit every few minutes because the device is the easiest answer to each small pocket of boredom.",
        [
          "Notice the repeated boredom loop and create more friction around the most reflexive apps.",
          "Use the phone intentionally rather than as the default filler for every idle gap."
        ],
        "The chapter helps because the phone thrives on tiny vulnerable moments. Better design weakens those automatic grabs."
      ),
      example(
        "ch18-ex03",
        "Work phone keeps stealing the writing block",
        ["work"],
        "An employee tries to write a report with the phone on the desk, and every notification or visible badge pulls attention toward checking.",
        [
          "Remove unnecessary notifications and place the phone away from the work surface.",
          "Make the device less interruptive by default."
        ],
        "This shows why phone defense matters even when the main work is on a computer. The device keeps offering faster rewards than the task."
      ),
      example(
        "ch18-ex04",
        "Manager checks phone in every gap",
        ["work"],
        "A manager reaches for the phone in every transition between meetings, so there is almost no unscripted thinking space left in the day.",
        [
          "Use planned check times instead of reflexive gap filling.",
          "Protect some transitions from the phone so attention can reset on purpose."
        ],
        "The deeper issue is not only wasted minutes. It is the loss of mental breathing room that helps better judgment happen."
      ),
      example(
        "ch18-ex05",
        "Phone enters dinner automatically",
        ["personal"],
        "Someone brings the phone to dinner out of habit and ends up splitting attention between the table and the device all evening.",
        [
          "Keep the phone out of sight during shared meals.",
          "Treat the conversation as the traction of that time."
        ],
        "This matters because phone design is also relationship design. What is physically present keeps competing for presence."
      ),
      example(
        "ch18-ex06",
        "Late night habit loop",
        ["personal"],
        "A person intends to sleep, but because the phone is in bed and every tempting app is easy to reach, the night turns into another hour of drifting.",
        [
          "Move the phone out of bed range and add friction to the apps that usually start the loop.",
          "Make the easier default align with sleep instead of with stimulation."
        ],
        "The chapter helps because convenient design quietly sets the path. A better default often beats a nightly promise."
      ),
    ],
    questions: [
      question(
        "ch18-q01",
        "Why is the smartphone such a powerful distraction device?",
        [
          "It concentrates many triggers in one portable object",
          "It matters only because of one app",
          "It always improves productivity",
          "It affects only leisure time",
        ],
        0
      ),
      question(
        "ch18-q02",
        "What is one of the highest leverage changes suggested here?",
        [
          "Turning off non essential notifications",
          "Buying a more expensive phone",
          "Keeping every app visible for convenience",
          "Checking more often to reduce curiosity",
        ],
        0
      ),
      question(
        "ch18-q03",
        "Why does home screen design matter?",
        [
          "Visible apps are easier to open impulsively",
          "The home screen affects only aesthetics",
          "It matters only for children",
          "A good wallpaper solves distraction",
        ],
        0
      ),
      question(
        "ch18-q04",
        "How does physical distance help?",
        [
          "It adds friction that can give intention more time to reappear",
          "It removes the need for any other strategy",
          "It matters only when notifications are on",
          "It works only in offices",
        ],
        0
      ),
      question(
        "ch18-q05",
        "What is the chapter's view of checking the phone?",
        [
          "It should happen on purpose rather than by reflexive timing",
          "It should happen whenever boredom appears",
          "It should be impossible all day",
          "It matters only for social media",
        ],
        0
      ),
      question(
        "ch18-q06",
        "Why can temporary friction be effective?",
        [
          "Many phone habits win mainly because the path is so fast and easy",
          "People only use phones when the path is hard",
          "Friction affects only severe habits",
          "Friction works only as punishment",
        ],
        0
      ),
      question(
        "ch18-q07",
        "What is one hidden effect of simply seeing your phone?",
        [
          "It can keep part of the mind oriented toward possible interruption",
          "It guarantees you will check it",
          "It has no effect if the screen is off",
          "It improves conversation quality",
        ],
        0
      ),
      question(
        "ch18-q08",
        "When might another device or context be better than the phone?",
        [
          "When context separation would weaken an overlearned habit loop",
          "Never, because one device is always best",
          "Only for entertainment",
          "Only for people with poor discipline",
        ],
        0
      ),
      question(
        "ch18-q09",
        "What is the deeper logic behind better phone defaults?",
        [
          "Defaults quietly shape attention all day, especially in tired moments",
          "Defaults matter only once a week",
          "Defaults are less important than willpower promises",
          "Defaults cannot influence behavior much",
        ],
        0
      ),
      question(
        "ch18-q10",
        "What is the chapter's main standard for the phone?",
        [
          "The device should be designed to serve chosen purposes rather than constant unchosen ones",
          "A good phone is one that stays constantly visible",
          "Every app should be equally easy to reach",
          "Portable access is always worth the cost",
        ],
        0
      ),
    ],
  }),
  chapter({
    chapterId: "ch11-schedule-relationships",
    number: 11,
    title: "Relationships Need Planned Time",
    readingTimeMinutes: 13,
    summary: {
      p1: t(
        "Relationships need planned time because the people you care about rarely receive your best attention by accident.",
        "Eyal argues that if relationships matter, they should show up on the calendar with the same seriousness as other important commitments.",
        "This turns care from sentiment into scheduled presence."
      ),
      p2: t(
        "This matters because modern distraction does not only steal work time. It also steals conversation, friendship, parenting, and intimacy one casual interruption at a time.",
        "Planned relational time protects connection before reactive work and digital drift consume what was left of the day.",
        "The deeper lesson is that attention is one of the clearest forms of love. When you schedule it, you stop asking relationships to live on leftovers."
      ),
    },
    standardBullets: [
      bullet(
        "Care needs time, not only feeling. Relationships weaken when attention is always delayed until nothing else is pending.",
        "That is why the chapter treats the calendar as relational, not merely professional.",
        "Time is often the most honest proof of importance.",
        "People do not only need good intentions from you. They need protected moments with you."
      ),
      bullet(
        "Presence should be planned before the day gets crowded. If connection relies on spare time, it often disappears.",
        "This is especially true when work and devices can expand endlessly.",
        "Predecision keeps the relationship from losing every hidden competition.",
        "A vague hope to be more present later is weaker than a real slot that already exists."
      ),
      bullet(
        "Small rituals matter. Repeated walks, dinners, check ins, or calls can carry more weight than dramatic occasional gestures.",
        "Rituals lower the friction of staying connected.",
        "They also make care more reliable.",
        "A relationship often feels safer when contact is patterned rather than constantly renegotiated."
      ),
      bullet(
        "Shared time deserves full attention. Planned connection loses much of its value if it remains full of side checking and partial listening.",
        "The point is not only to be physically nearby.",
        "The point is to let the relationship become the traction of that moment.",
        "A scheduled dinner with constant phone glances still teaches the other person what really owns your mind."
      ),
      bullet(
        "Relationships are easy to undercount. Because they do not always demand urgent deadlines, they can quietly receive whatever energy remains.",
        "That makes them especially vulnerable to distraction culture.",
        "Scheduling corrects for their lack of loudness.",
        "What matters most is not always what shouts the most."
      ),
      bullet(
        "Connection supports focus too. Strong relationships reduce loneliness, resentment, and other internal triggers that later feed distraction.",
        "This gives the chapter strategic as well as emotional importance.",
        "Relational time is not separate from indistractability. It supports it.",
        "Attention becomes steadier when the rest of life is less starved."
      ),
      bullet(
        "Do not confuse availability with connection. Being reachable all day is different from being truly present at a chosen time.",
        "Always on communication can create contact without depth.",
        "Protected attention usually builds more trust than constant partial access.",
        "Quantity of messages is a poor substitute for quality of presence."
      ),
      bullet(
        "Plan both maintenance and repair. Healthy relationships need ordinary time and also space for harder conversations when necessary.",
        "If every difficult discussion waits for a perfect moment, it may never happen.",
        "The calendar can protect repair as well as pleasure.",
        "Intentional time makes relationships more resilient, not only more pleasant."
      ),
      bullet(
        "Your calendar teaches people what they mean to you. Repeated postponement becomes a message even when you never intend it that way.",
        "This is why time allocation has relational consequences.",
        "Attention speaks before explanation does.",
        "People learn your real priorities from patterns, not from reassurances alone."
      ),
      bullet(
        "Treat relationships as real traction. When connection is chosen on purpose, it is not a distraction from life. It is part of life well lived.",
        "That framing matters because some people protect work with rigor while treating care as optional overflow.",
        "The chapter corrects that imbalance directly.",
        "Planned presence is one of the book's clearest examples of values becoming time."
      ),
    ],
    deeperBullets: [
      bullet(
        "Relational neglect often hides inside ambition. People can tell themselves they are temporarily unavailable while teaching a long term pattern of emotional absence.",
        "The chapter quietly challenges that bargain.",
        "Delayed presence can become a lifestyle before you notice what it cost."
      ),
      bullet(
        "Attention creates memory. Many meaningful relationships are built from repeated moments of undivided presence rather than from occasional grand efforts.",
        "That is one reason small rituals matter so much.",
        "They give shared life texture and continuity."
      ),
      bullet(
        "Protected time lowers resentment. When people no longer have to compete with everything else in your life every single time, trust usually improves.",
        "Scheduling therefore has emotional effects beyond logistics.",
        "It reduces chronic uncertainty about whether the relationship will be chosen."
      ),
      bullet(
        "Partial presence is often more painful than honest absence. Being there physically while staying mentally elsewhere can feel like repeated micro rejection.",
        "This is why device boundaries matter during shared time.",
        "Distraction is relational information."
      ),
      bullet(
        "A life that protects only productive output becomes relationally expensive. The chapter broadens the meaning of traction so success is not purchased through constant emotional depletion elsewhere.",
        "This is one of the book's most human correctives.",
        "Focus is valuable, but not if it trains you to vanish from the people you claim to love."
      ),
    ],
    takeaways: [
      "Care needs scheduled time",
      "Presence beats leftovers",
      "Rituals protect connection",
      "Shared time needs full attention",
      "Relationships support steadier focus",
      "Connection is real traction",
    ],
    practice: [
      "Schedule one recurring block for an important relationship",
      "Create one small ritual of connection",
      "Protect one shared activity from device drift",
      "Review where relationships are living on leftovers",
      "Treat one planned conversation as real traction",
    ],
    examples: [
      example(
        "ch11-ex01",
        "Roommate talk always postponed",
        ["school"],
        "Two roommates get along, but every meaningful conversation keeps getting pushed aside because both assume they can catch up later after classes, clubs, and screens settle down.",
        [
          "Schedule a real check in instead of trusting chance to create one.",
          "Treat the conversation as something worthy of protected time."
        ],
        "This matters because relationships often fade through deferral, not through one dramatic break. Time protection keeps connection from becoming an afterthought."
      ),
      example(
        "ch11-ex02",
        "Friendship reduced to constant memes",
        ["school"],
        "A student stays in touch with a close friend through endless short messages, but they rarely have a real conversation anymore and both feel less connected than the message volume suggests.",
        [
          "Plan a deeper conversation or shared activity instead of relying only on ambient contact.",
          "Treat quality attention as different from constant availability."
        ],
        "The chapter helps because it distinguishes connection from mere reachability. Real presence usually needs more intention than constant messaging."
      ),
      example(
        "ch11-ex03",
        "Partner time swallowed by work spillover",
        ["work"],
        "A manager keeps saying family matters, but every evening buffer gets claimed by work that was never bounded earlier in the day.",
        [
          "Put relationship time on the calendar before the spillover begins.",
          "Use work boundaries to defend the block as real traction."
        ],
        "This shows that relationships lose to work by default when they remain unscheduled. Time has to be assigned before other demands expand into it."
      ),
      example(
        "ch11-ex04",
        "Team leader available but not present",
        ["work"],
        "A leader responds constantly in chat, yet skips one on one conversations and focused check ins, so the team feels managed but not really known.",
        [
          "Schedule the relational time that builds trust instead of confusing constant access with connection.",
          "Protect those conversations from multitasking."
        ],
        "The lesson is that relationships at work also depend on planned attention. Presence builds trust more than permanent partial reachability does."
      ),
      example(
        "ch11-ex05",
        "Family dinner with constant side checking",
        ["personal"],
        "A family eats together most nights, but one or more people are usually half inside phones, so the ritual exists without much real connection.",
        [
          "Keep the ritual and add fuller attention by removing devices from the table.",
          "Let the dinner become the real traction of that time."
        ],
        "This matters because shared time is not automatically meaningful. Presence is what turns scheduled contact into relational nourishment."
      ),
      example(
        "ch11-ex06",
        "Friend always gets the leftovers",
        ["personal"],
        "Someone keeps promising to call an old friend when life calms down, but that calm never arrives, so the friendship slowly runs on apologies.",
        [
          "Schedule the call or visit before the week fills with easier obligations.",
          "Treat the friendship as something worth protecting, not something that must wait for spare energy."
        ],
        "The chapter applies here because postponement itself becomes a message. Planned time prevents care from remaining only verbal."
      ),
    ],
    questions: [
      question(
        "ch11-q01",
        "Why does the chapter put relationships on the calendar?",
        [
          "Because care becomes more reliable when it receives protected time",
          "Because spontaneity is always harmful",
          "Because relationships matter only if scheduled weekly",
          "Because work and relationships should compete equally every hour",
        ],
        0
      ),
      question(
        "ch11-q02",
        "What is one risk of leaving connection to spare time?",
        [
          "Relationships quietly receive leftovers and repeated deferral",
          "The calendar becomes too strict",
          "Rituals become impossible",
          "People become less ambitious",
        ],
        0
      ),
      question(
        "ch11-q03",
        "How does the chapter treat planned relational time?",
        [
          "As a distraction from serious goals",
          "As real traction when it reflects chosen values",
          "As less important than recovery",
          "As useful only for families",
        ],
        1
      ),
      question(
        "ch11-q04",
        "Why are small rituals important?",
        [
          "They create reliable connection with less friction than waiting for perfect moments",
          "They remove the need for honest conversation",
          "They work only in personal life",
          "They are more important than full presence",
        ],
        0
      ),
      question(
        "ch11-q05",
        "What is the difference between availability and connection?",
        [
          "Availability means deeper trust automatically",
          "Connection usually requires protected, fuller attention rather than constant partial access",
          "There is no meaningful difference",
          "Availability matters only at work",
        ],
        1
      ),
      question(
        "ch11-q06",
        "Why can connection support indistractability itself?",
        [
          "Healthy relationships can reduce some of the internal triggers that later feed distraction",
          "Relationships eliminate the need for planning",
          "Connection makes every device harmless",
          "It matters only for extroverts",
        ],
        0
      ),
      question(
        "ch11-q07",
        "A person schedules dinner with a partner but keeps checking notifications through it. What problem remains?",
        [
          "The time exists, but the attention is still divided",
          "Dinner should not have been scheduled",
          "Notifications are always harmless during meals",
          "The relationship probably needs less time",
        ],
        0
      ),
      question(
        "ch11-q08",
        "What message does repeated postponement send according to this chapter?",
        [
          "That the relationship keeps losing priority in practice",
          "That the calendar is flexible",
          "That love should stay abstract",
          "That scheduling is cold",
        ],
        0
      ),
      question(
        "ch11-q09",
        "Why should difficult relational repair also get time protection?",
        [
          "Because waiting for a perfect spontaneous moment often means repair never happens",
          "Because conflict solves itself with enough delay",
          "Because only pleasant time should be scheduled",
          "Because calendars should not hold emotional material",
        ],
        0
      ),
      question(
        "ch11-q10",
        "What is the deeper lesson of this chapter?",
        [
          "Attention is one of the clearest forms of care",
          "Good intentions are enough without time",
          "Relationships and focus are unrelated",
          "Presence matters less than explanation",
        ],
        0
      ),
    ],
  }),
  chapter({
    chapterId: "ch12-sync-with-stakeholders",
    number: 12,
    title: "Coordinate Expectations With Others",
    readingTimeMinutes: 14,
    summary: {
      p1: t(
        "Coordinating expectations with others means aligning your plans with the people who can disrupt, support, or depend on them.",
        "Eyal argues that attention is not protected by private intention alone. It is protected when expectations about access, response, and priorities are made explicit.",
        "This turns indistractability into a social skill as well as a personal one."
      ),
      p2: t(
        "This matters because many interruptions and resentments come from ambiguity, not malice.",
        "When bosses, teammates, teachers, roommates, or partners do not know what you are protecting or when you will respond, they fill the gap with their own assumptions.",
        "The deeper lesson is that boundaries work best when they are coordinated rather than silently hoped for. Clear agreements reduce preventable friction on both sides."
      ),
    },
    standardBullets: [
      bullet(
        "Private plans are not enough. Other people affect your attention, so some of your focus strategy has to become visible.",
        "This is especially true in shared work and shared living environments.",
        "Unshared priorities are easy for others to accidentally interrupt.",
        "A hidden boundary is not yet a functioning boundary."
      ),
      bullet(
        "Ambiguity breeds interruption. When expectations are unclear, people default to what is easiest for them.",
        "That can make your calendar feel like a personal failure when it is partly a coordination failure.",
        "Clear agreements reduce unnecessary friction.",
        "Many recurring distractions are really unresolved expectation problems."
      ),
      bullet(
        "Explain what you are protecting and why. People cooperate more easily when they understand the purpose of the boundary.",
        "A boundary feels less arbitrary when tied to meaningful work, rest, or relationship time.",
        "Reason helps buy trust.",
        "You are not only defending time. You are helping others understand the value of the defense."
      ),
      bullet(
        "Discuss response windows honestly. Not everything needs an immediate answer, but people need to know what to expect.",
        "This is one of the cleanest ways to reduce anxiety driven checking on both sides.",
        "Predictability is often more helpful than permanent availability.",
        "A slower but known rhythm beats an always on promise that nobody can actually sustain."
      ),
      bullet(
        "Invite collaboration, not only declaration. Stronger agreements come from conversation rather than unilateral rules.",
        "That is important because other people's needs are real too.",
        "Coordination works better when both sides can surface constraints.",
        "The goal is workable alignment, not theatrical firmness."
      ),
      bullet(
        "Use regular rather than emergency channels when possible. Many interruptions happen because no one agreed on which path fits which urgency level.",
        "Channel clarity lowers noise dramatically.",
        "This is as much a systems issue as a manners issue.",
        "Without channel rules, everything starts impersonating an emergency."
      ),
      bullet(
        "Sync at the level of priorities, not only logistics. People interrupt less when they know what truly matters today and what can wait.",
        "That kind of visibility helps them support, not sabotage, your traction.",
        "It also helps you see where your plan is unrealistic in a shared setting.",
        "Coordination improves when stakes are understood, not just schedules."
      ),
      bullet(
        "Revisit expectations when conditions change. Old agreements decay when workload, roles, or life demands shift.",
        "That is why stakeholder alignment is ongoing, not a single conversation.",
        "A stale boundary often fails because it no longer matches reality.",
        "Updating expectations is maintenance, not instability."
      ),
      bullet(
        "Respect runs both ways. Protecting your own attention should not require treating everyone else like a nuisance.",
        "The most durable boundaries usually preserve mutual dignity.",
        "Firmness and respect are compatible.",
        "People are more likely to support a limit that does not make them feel dismissed."
      ),
      bullet(
        "Shared expectations reduce hidden resentment. When roles are clearer, fewer people feel ignored, abandoned, or constantly on call.",
        "This makes focus more sustainable in relationships and workplaces alike.",
        "Good coordination is emotionally efficient.",
        "The chapter shows that better boundaries can improve connection rather than damage it."
      ),
    ],
    deeperBullets: [
      bullet(
        "Most people are already running a boundary policy, whether they designed one or not. The only question is whether it is explicit and intentional or inconsistent and reactive.",
        "Implicit policies usually create more conflict.",
        "The chapter pushes toward conscious authorship."
      ),
      bullet(
        "Response speed is often a cultural signal. That is why discussing expectations can feel risky in unhealthy environments.",
        "The conversation is not only logistical. It can reveal power and fear.",
        "This insight sets up the later workplace chapters."
      ),
      bullet(
        "Unclear expectations create extra cognitive load. You waste attention guessing what others assume, which makes distraction easier even before an interruption arrives.",
        "Clarity protects mental energy as well as time.",
        "A known rule is easier to carry than a shifting social fog."
      ),
      bullet(
        "Coordination fails when values stay private. If you never explain what a block is for, others will naturally compare it to their own visible pressures and dismiss it.",
        "Meaning helps boundaries hold.",
        "People defend what they understand better than what they only experience as delay."
      ),
      bullet(
        "Healthy boundaries create trust through predictability. People usually adapt better to a stable rhythm than to erratic bursts of access mixed with silent withdrawal.",
        "Consistency is one of the deepest forms of respect in shared attention systems.",
        "That is why explicit agreements often improve relationships on both sides."
      ),
    ],
    takeaways: [
      "Attention is social",
      "Ambiguity invites interruption",
      "Explain what and why",
      "Set honest response windows",
      "Make boundaries collaborative",
      "Predictability builds trust",
    ],
    practice: [
      "Clarify one response time expectation with someone who matters",
      "Explain one focus block and what it protects",
      "Set one channel rule for different urgency levels",
      "Ask one stakeholder what they need from you to make the boundary workable",
      "Review one boundary that no longer fits current reality",
    ],
    examples: [
      example(
        "ch12-ex01",
        "Group project messages at all hours",
        ["school"],
        "A student group keeps messaging one another late at night because no one has ever said what counts as urgent and what can wait until the next day.",
        [
          "Agree on response expectations and which channel is for true urgency.",
          "Make the group's assumptions explicit instead of letting anxiety decide them."
        ],
        "This matters because many interruptions come from uncertainty, not rudeness. Coordination reduces preventable pressure for everyone."
      ),
      example(
        "ch12-ex02",
        "Roommate thinks closed door means nothing",
        ["school"],
        "A student tries to study behind a closed door, but her roommate keeps dropping in because they never discussed what that signal means.",
        [
          "Explain the focus window and what kind of interruptions are actually okay.",
          "Invite a simple agreement that both people can understand and remember."
        ],
        "The chapter helps because hidden boundaries often fail. A cue becomes useful only when the other person knows how to read it."
      ),
      example(
        "ch12-ex03",
        "Boss expects instant replies",
        ["work"],
        "An employee wants time for deep work, but the manager assumes a delayed reply means a lack of urgency because no response rhythm was ever discussed.",
        [
          "Clarify what response time is realistic and how urgent issues should reach you during focus blocks.",
          "Explain the work quality those blocks are meant to protect."
        ],
        "This shows why boundaries need context and coordination. Silence alone rarely teaches people the standard you want them to use."
      ),
      example(
        "ch12-ex04",
        "Team channel used for everything",
        ["work"],
        "A team uses one chat channel for emergencies, casual notes, status updates, and complex requests, so everyone feels half interrupted all day.",
        [
          "Separate channel use by urgency and type of request.",
          "Make those rules explicit so people stop treating every message as equally immediate."
        ],
        "The deeper issue is expectation design. Better channel agreements can reduce noise without reducing cooperation."
      ),
      example(
        "ch12-ex05",
        "Partner interprets delayed replies as indifference",
        ["personal"],
        "One partner wants more uninterrupted work time, while the other interprets slower replies during the day as emotional distance because they never discussed what those delays mean.",
        [
          "Talk about response expectations directly rather than leaving the meaning to guesswork.",
          "Agree on what urgent contact looks like and what can wait."
        ],
        "The chapter matters because unclear expectations turn ordinary delays into relational stories. Better coordination prevents unnecessary hurt."
      ),
      example(
        "ch12-ex06",
        "Family assumes constant availability",
        ["personal"],
        "A person keeps trying to carve out weekend focus time, but relatives keep asking for favors in that window because no one knows it has been claimed.",
        [
          "State the protected time clearly and explain what it serves.",
          "Invite a workable plan for requests that truly cannot wait."
        ],
        "This example shows that coordination is not selfish. It helps everyone know the rules instead of colliding through guesswork."
      ),
    ],
    questions: [
      question(
        "ch12-q01",
        "Why are private intentions often insufficient for protecting attention?",
        [
          "Because other people can affect your time and need some expectations to be explicit",
          "Because calendars never matter",
          "Because boundaries are mostly emotional",
          "Because only workplaces create interruptions",
        ],
        0
      ),
      question(
        "ch12-q02",
        "What is a common source of interruption according to this chapter?",
        [
          "Ambiguity about what others should expect",
          "Bad character alone",
          "Too much planning",
          "Silence about priorities always helps",
        ],
        0
      ),
      question(
        "ch12-q03",
        "Why should you explain the purpose of a boundary?",
        [
          "It helps others understand what meaningful work or time the limit is protecting",
          "It makes collaboration unnecessary",
          "It guarantees everyone will agree instantly",
          "It weakens the boundary by adding context",
        ],
        0
      ),
      question(
        "ch12-q04",
        "What is the value of honest response windows?",
        [
          "They create predictable expectations without requiring permanent availability",
          "They make all delays acceptable",
          "They remove the need for urgent channels",
          "They work only in personal life",
        ],
        0
      ),
      question(
        "ch12-q05",
        "Which approach best fits this chapter?",
        [
          "Declare rules without listening to other people's constraints",
          "Invite collaboration so boundaries become workable agreements",
          "Keep all focus needs private",
          "Answer everyone instantly to avoid discomfort",
        ],
        1
      ),
      question(
        "ch12-q06",
        "Why should teams define which channels fit which urgency?",
        [
          "So everything stops impersonating an emergency",
          "So communication disappears",
          "So chat can replace all meetings",
          "So response time becomes unpredictable",
        ],
        0
      ),
      question(
        "ch12-q07",
        "What happens when priorities stay private?",
        [
          "People interrupt less because they can infer the plan",
          "Others may unintentionally compete with work they do not know you are protecting",
          "Boundaries become stronger automatically",
          "Only urgent tasks remain visible",
        ],
        1
      ),
      question(
        "ch12-q08",
        "Why should expectations be revisited?",
        [
          "Because changed roles or conditions can make old agreements stale",
          "Because consistency is harmful",
          "Because boundaries should never survive more than a week",
          "Because people dislike predictability",
        ],
        0
      ),
      question(
        "ch12-q09",
        "What makes a boundary more durable?",
        [
          "Firmness paired with respect and predictability",
          "Silence and resentment",
          "Constant improvisation",
          "An always on posture",
        ],
        0
      ),
      question(
        "ch12-q10",
        "What is the deeper lesson of stakeholder syncing?",
        [
          "Boundaries work best when coordinated rather than silently hoped for",
          "Only individuals are responsible for attention",
          "Explanations weaken limits",
          "Interruption problems are mostly imaginary",
        ],
        0
      ),
    ],
  }),
  chapter({
    chapterId: "ch13-critical-question",
    number: 13,
    title: "Ask Whether This Serves Traction Or Distraction",
    readingTimeMinutes: 15,
    summary: {
      p1: t(
        "Ask whether this serves traction or distraction because the same trigger can be useful in one moment and harmful in another.",
        "Eyal offers this question as a quick filter that compares the present impulse with the plan you already chose.",
        "It keeps attention grounded in intention rather than in whatever feels easiest or loudest right now."
      ),
      p2: t(
        "This matters because distraction often arrives dressed as something reasonable, efficient, or harmless.",
        "The question cuts through that disguise by asking whether the action serves what you meant to do in this moment.",
        "The deeper lesson is that tools, messages, and opportunities are rarely good or bad on their own. Their value depends on timing, purpose, and alignment."
      ),
    },
    standardBullets: [
      bullet(
        "A trigger is not automatically the problem. The same cue can support traction in one context and undermine it in another.",
        "That is why the chapter avoids simplistic good tool bad tool thinking.",
        "Context and intention decide the meaning.",
        "A calendar reminder may be helpful during one block and disruptive during another."
      ),
      bullet(
        "The question works because it compares the moment to a prior choice. Without that comparison, the urge gets to argue on its own terms.",
        "The earlier plan gives the filter its force.",
        "This is why scheduling and trigger evaluation belong together.",
        "You need a baseline before you can judge what is helping or hijacking you."
      ),
      bullet(
        "Many distractions sound reasonable. They often present themselves as quick checks, useful updates, or harmless detours.",
        "That is what makes a clean question so valuable.",
        "It exposes whether the logic is real or merely convenient.",
        "The more articulate the excuse, the more useful the filter becomes."
      ),
      bullet(
        "Planned leisure can pass the test. If rest or entertainment is what you meant to be doing, it can be traction rather than distraction.",
        "This prevents the method from turning moralistic.",
        "The issue is alignment, not constant productivity.",
        "A chosen movie night is different from accidental scrolling during a writing block."
      ),
      bullet(
        "The question slows the hand. Even a brief pause can stop a reflex from turning into a detour.",
        "This matters because many unwanted switches happen faster than reflection.",
        "The question reintroduces intention into that speed.",
        "A moment of evaluation can change the whole path of the next hour."
      ),
      bullet(
        "It can be used with people as well as tools. Invitations, requests, and conversations also need to be judged against the chosen moment.",
        "That makes the filter broadly practical.",
        "Attention decisions are rarely purely technological.",
        "A well meaning interruption can still be distraction if it breaks the work you deliberately protected."
      ),
      bullet(
        "It reveals rationalization patterns. If you keep answering the question weakly in the same situations, you have found a recurring vulnerability.",
        "That pattern can then be redesigned instead of repeatedly regretted.",
        "The filter is diagnostic as well as protective.",
        "Honest repetition shows where your justifications are most polished."
      ),
      bullet(
        "Use the question quickly and often. Its power comes from repeated application, not from one dramatic moment.",
        "This keeps it realistic and trainable.",
        "Short filters are easier to use under pressure than elaborate debates.",
        "A simple question that actually gets used beats a complicated framework that stays theoretical."
      ),
      bullet(
        "Do not let mood answer in place of intention. A task can feel unattractive and still be traction.",
        "The question protects priorities from being silently replaced by emotion.",
        "It does not deny feeling. It refuses to let feeling cast the only vote.",
        "This is one of the chapter's sharpest practical benefits."
      ),
      bullet(
        "The question becomes a habit of honesty. Over time it trains a more truthful relationship between plan and action.",
        "That is larger than any single decision.",
        "It helps you see your days more clearly.",
        "The chapter gives the book a portable mental checkpoint that works across almost any context."
      ),
    ],
    deeperBullets: [
      bullet(
        "The filter is deceptively simple because it depends on earlier discipline. It works best when traction has already been chosen with some care.",
        "That keeps the chapter connected to the earlier time design chapters.",
        "A weak plan makes for a weak filter."
      ),
      bullet(
        "Rationalization often sounds like flexibility. People can call a switch adaptive when it is really just emotionally convenient.",
        "The question helps separate real adaptation from disguised drift.",
        "That is one reason it is so effective in ambiguous situations."
      ),
      bullet(
        "The test can reveal overcommitment too. If everything seems to fail the filter because your day is overloaded, the schedule itself may need repair.",
        "The question is honest enough to expose planning errors as well as distractions.",
        "It protects reality, not pride."
      ),
      bullet(
        "Good judgment sometimes says yes. A well timed interruption or opportunity may truly serve traction better than the original block.",
        "The chapter is not rigid. It is comparative.",
        "The deeper skill is making that comparison honestly rather than reactively."
      ),
      bullet(
        "Repeated truthful filtering builds self trust. Each answer aligns behavior a little more closely with chosen values.",
        "That accumulated honesty is one of the book's hidden outcomes.",
        "The mind becomes easier to believe when it stops constantly overruling itself."
      ),
    ],
    takeaways: [
      "Triggers need context",
      "Compare the moment to the plan",
      "Reasonable looking detours still need testing",
      "Planned leisure can be traction",
      "The question slows reflexes",
      "Repeated use builds honesty",
    ],
    practice: [
      "Ask the traction or distraction question before one common switch",
      "Use it on a request from another person, not only on a device",
      "Notice one excuse that sounds reasonable but fails the test",
      "Review one moment where the question revealed a planning problem",
      "Keep the filter short enough to use under pressure",
    ],
    examples: [
      example(
        "ch13-ex01",
        "Study break or study escape",
        ["school"],
        "A student feels tired during a study block and wants to watch a few clips, but she is not sure whether that would refresh her or simply break the whole block.",
        [
          "Ask whether the action serves the traction she chose for this time block.",
          "If the answer is weak, choose a shorter intentional reset that actually protects the study session."
        ],
        "This matters because many distractions sound harmless. The question forces the student to compare the urge with the plan instead of with the feeling alone."
      ),
      example(
        "ch13-ex02",
        "Helpful classmate interrupting work",
        ["school"],
        "A classmate wants to chat during a library session and the conversation would be pleasant, but it would also break a block set aside for exam review.",
        [
          "Use the question on the social request, not only on digital tools.",
          "Decide whether talking now supports or pulls away from the traction chosen for the session."
        ],
        "The chapter helps because people can distract us as easily as devices can. The filter applies to both."
      ),
      example(
        "ch13-ex03",
        "Quick inbox check during deep work",
        ["work"],
        "An employee wants to do a fast inbox check in the middle of a protected writing block because it feels efficient to stay updated.",
        [
          "Ask whether the check truly serves the writing block or merely relieves the tension of not knowing.",
          "Answer based on the planned work, not on the temporary urge."
        ],
        "This matters because efficient sounding actions often disguise avoidance. The question exposes whether the timing is right."
      ),
      example(
        "ch13-ex04",
        "Unexpected meeting invite",
        ["work"],
        "A worker gets invited to a same day meeting that might be useful, but it would displace the only serious time reserved for a high stakes deliverable.",
        [
          "Compare both options against the most important traction for the day.",
          "Say yes only if the meeting serves that traction better than the original block does."
        ],
        "The chapter matters because not every interruption should be rejected and not every invitation should be accepted. The comparison is what matters."
      ),
      example(
        "ch13-ex05",
        "Planned movie night versus accidental scrolling",
        ["personal"],
        "A person planned a relaxed movie night, but instead drifts through random clips and feeds for two hours and wonders why it feels worse.",
        [
          "Use the question to distinguish chosen entertainment from unchosen drift.",
          "Return to the activity that actually matches the evening you intended."
        ],
        "This example shows why the filter is not anti leisure. It is anti misalignment."
      ),
      example(
        "ch13-ex06",
        "Exercise block versus suddenly urgent errands",
        ["personal"],
        "Right before a planned workout, someone suddenly wants to handle small errands that were technically necessary but not time sensitive.",
        [
          "Ask whether those errands serve the traction chosen for this block or merely feel easier than exercising.",
          "Use the answer to protect the block if the errands can truly wait."
        ],
        "The chapter helps because distraction often hides inside plausible alternatives. Honest timing is what reveals the difference."
      ),
    ],
    questions: [
      question(
        "ch13-q01",
        "Why is the chapter's core question so useful?",
        [
          "It compares the present impulse with the plan you already chose",
          "It turns every interruption into a hard no",
          "It removes all need for context",
          "It works only for digital habits",
        ],
        0
      ),
      question(
        "ch13-q02",
        "What makes the same trigger useful in one moment and harmful in another?",
        [
          "Timing and whether it serves the chosen traction",
          "The trigger's moral quality",
          "How exciting it feels",
          "Whether someone else suggested it",
        ],
        0
      ),
      question(
        "ch13-q03",
        "How does the chapter treat planned leisure?",
        [
          "As distraction regardless of timing",
          "As traction when it aligns with what you intended to do",
          "As outside the method entirely",
          "As less important than any work task",
        ],
        1
      ),
      question(
        "ch13-q04",
        "Why do many distractions survive without this question?",
        [
          "Because they often arrive sounding reasonable or efficient",
          "Because every distraction is obviously foolish",
          "Because plans are irrelevant",
          "Because feelings should decide timing",
        ],
        0
      ),
      question(
        "ch13-q05",
        "Can the question be used with people as well as tools?",
        [
          "Yes, because requests and conversations also need to be judged against the chosen moment",
          "No, it applies only to notifications",
          "Only in workplaces",
          "Only in personal life",
        ],
        0
      ),
      question(
        "ch13-q06",
        "What does repeated failure under this filter often reveal?",
        [
          "A recurring rationalization pattern or planning weakness",
          "That the question should be abandoned",
          "That all triggers are bad",
          "That values do not matter",
        ],
        0
      ),
      question(
        "ch13-q07",
        "Why should mood not be the only answer to the question?",
        [
          "Because a task can feel unattractive and still be the real traction of the moment",
          "Because moods are always wrong",
          "Because emotions should be ignored completely",
          "Because only work counts as traction",
        ],
        0
      ),
      question(
        "ch13-q08",
        "What makes the filter practical?",
        [
          "Its short form makes it usable in repeated everyday moments",
          "Its complexity makes it impossible to misuse",
          "It requires no earlier planning",
          "It answers every hard tradeoff automatically",
        ],
        0
      ),
      question(
        "ch13-q09",
        "Can a well timed interruption ever pass the test?",
        [
          "Yes, if it truly serves the chosen traction better than the original plan",
          "No, interruptions are always distractions",
          "Only if it feels urgent",
          "Only if it comes from a manager",
        ],
        0
      ),
      question(
        "ch13-q10",
        "What is the deeper effect of using this question repeatedly?",
        [
          "It builds a more honest relationship between intention and action",
          "It makes planning unnecessary",
          "It removes the need for boundaries",
          "It guarantees every choice will feel easy",
        ],
        0
      ),
    ],
  }),
  chapter({
    chapterId: "ch14-work-interruptions",
    number: 14,
    title: "Hack Back Interruptions At Work",
    readingTimeMinutes: 16,
    summary: {
      p1: t(
        "Hacking back work interruptions means redesigning the workday so constant access does not keep breaking concentration.",
        "Eyal shows that many workplace interruptions are structural and predictable rather than random acts of bad luck.",
        "The goal is to create norms and signals that let focus survive in a shared environment."
      ),
      p2: t(
        "This matters because each interruption carries a recovery cost that is usually invisible in the moment.",
        "If work culture treats everyone as permanently interruptible, deep work becomes fragile and people start living inside reaction mode.",
        "The deeper lesson is that defending focus at work is not selfish. It is often how better work gets done with less hidden waste."
      ),
    },
    standardBullets: [
      bullet(
        "Interruptions are more expensive than they look. The visible pause is short, but the lost concentration often lasts longer.",
        "That hidden recovery cost makes frequent disruption especially damaging.",
        "Many workplaces count the interruption and ignore the rebuild.",
        "Focus gets taxed twice when the break happens and when the person has to reenter the work."
      ),
      bullet(
        "Predictable interruptions should be designed for, not merely tolerated. Repeated patterns are opportunities for better systems.",
        "This is what makes the chapter practical rather than resentful.",
        "Where interruption is normal, design should be normal too.",
        "If the same break keeps happening every day, it has stopped being a surprise and started being a design problem."
      ),
      bullet(
        "Signals matter. A visible cue for focus time helps others know when interruption is costly.",
        "That cue might be a status, a location, a door, or a shared block on the calendar.",
        "The point is readability.",
        "People interrupt less when the cost is made legible before they act."
      ),
      bullet(
        "Batching questions can protect everyone. Not every issue needs instant handling the second it appears.",
        "Collecting non urgent items reduces fragmentation across the team.",
        "This creates healthier rhythms for collaborative work.",
        "One shared interruption window is often cheaper than ten scattered ones."
      ),
      bullet(
        "Deep work needs explicit protection. If concentration is always optional, reactive tasks will keep outranking it by default.",
        "Focus blocks become stronger when they are named and defended as real work.",
        "That reframes concentration from personal preference to job requirement.",
        "People are more likely to respect protected work when it is presented as necessary, not indulgent."
      ),
      bullet(
        "Urgency should be defined carefully. Teams lose attention when everything is treated as immediate.",
        "Clear criteria for true urgency lower noise fast.",
        "This is one of the biggest gains available in interruption heavy cultures.",
        "Once urgency is scarce again, actual emergencies become easier to spot."
      ),
      bullet(
        "Availability can be scheduled. You can be responsive without being continuously interruptible.",
        "Office hours, check in windows, or known reply blocks make collaboration easier to manage.",
        "Predictable access beats scattered access.",
        "People often accept delay better when they trust there is a reliable next opening."
      ),
      bullet(
        "Interruptions also reveal culture. If people feel unable to protect thinking time, the issue may be psychological as well as operational.",
        "That connects this chapter to the later workplace section.",
        "A culture that mocks focus will keep recreating interruption problems.",
        "Process fixes help, but cultural permission matters too."
      ),
      bullet(
        "Defending focus should still be respectful. The goal is not hostility toward coworkers, but a clearer agreement about timing and cost.",
        "This makes boundaries more sustainable.",
        "Good interruption defense protects work without making collaboration cold.",
        "Respect improves compliance more than visible irritation does."
      ),
      bullet(
        "Focus protection raises output quality. Better thinking often comes from fewer fragmented starts and stops.",
        "That is the chapter's business case as well as its personal case.",
        "Interruptions do not only waste time. They often degrade the level of thought available.",
        "A calmer work rhythm can produce both better results and less hidden exhaustion."
      ),
    ],
    deeperBullets: [
      bullet(
        "Some workplaces reward responsiveness theater. People may interrupt and answer instantly because speed signals commitment even when quality suffers.",
        "That makes interruption a status issue as well as a workflow issue.",
        "The deeper fix may require changing what the culture praises."
      ),
      bullet(
        "Readability reduces social friction. Clear signals let others know when interruption is costly without requiring repeated awkward conversations.",
        "This is why simple shared cues matter so much.",
        "They turn private frustration into public clarity."
      ),
      bullet(
        "The more cognitively demanding the work, the more interruption costs matter. Not all tasks are equally damaged by fragmentation.",
        "This is one reason generic access norms often fail.",
        "Different work types deserve different interruption rules."
      ),
      bullet(
        "Interruption problems can spread downward. Leaders who stay always available often train teams to expect the same of themselves.",
        "That multiplies the cultural cost.",
        "Modeling is part of focus protection."
      ),
      bullet(
        "Good collaboration is rhythmic, not constant. Teams work better when there are known moments for responsiveness and known moments for sustained concentration.",
        "Rhythm beats permanent partial attention.",
        "The chapter quietly argues for a healthier tempo of work."
      ),
    ],
    takeaways: [
      "Interruptions have hidden recovery costs",
      "Patterns should be redesigned",
      "Signals help others read focus time",
      "Batching reduces fragmentation",
      "Urgency needs a real definition",
      "Rhythm beats constant access",
    ],
    practice: [
      "Create one visible focus signal at work",
      "Batch one category of non urgent questions",
      "Define what truly counts as urgent for your team",
      "Set one predictable availability window",
      "Notice one cultural norm that rewards needless interruption",
    ],
    examples: [
      example(
        "ch14-ex01",
        "Library work broken by constant check ins",
        ["school"],
        "A student team working in the library interrupts one another every few minutes with minor questions that could have waited, so no one sustains concentration for long.",
        [
          "Create short windows for questions and protect the space between them for focused work.",
          "Use a simple signal when someone is in a concentration block."
        ],
        "This matters because interruption cost is often invisible to groups. Batching and signaling make that cost easier to respect."
      ),
      example(
        "ch14-ex02",
        "Club officers assume instant replies",
        ["school"],
        "A club leadership team treats every message as urgent, so planning work keeps getting broken into tiny fragments all week.",
        [
          "Define what truly needs immediate response and what can wait for a check in window.",
          "Protect deeper planning blocks from low stakes interruptions."
        ],
        "The chapter helps because constant access feels cooperative while often damaging the quality of the actual work."
      ),
      example(
        "ch14-ex03",
        "Office questions arrive one by one",
        ["work"],
        "Coworkers keep tapping a colleague throughout the day with minor questions because they know she is helpful, but her own analysis work keeps restarting from scratch.",
        [
          "Create a predictable time for non urgent questions and a visible signal for focus time.",
          "Help the team see the hidden cost of every restart."
        ],
        "This shows why being helpful and being continuously interruptible are not the same thing. Better structure can protect both collaboration and quality."
      ),
      example(
        "ch14-ex04",
        "Manager treats everything as immediate",
        ["work"],
        "A manager messages the team whenever a thought appears, so everyone stays half on alert and no one knows what actually deserves instant response.",
        [
          "Define urgency more carefully and separate ideas, updates, and true emergencies.",
          "Move non urgent items into a regular review channel."
        ],
        "The chapter matters because interruption often flows from leadership habits. When everything sounds urgent, focus collapses for everyone."
      ),
      example(
        "ch14-ex05",
        "Working from home with open door interruptions",
        ["personal"],
        "Someone working from home gets interrupted by family members for small issues all afternoon because no one has a clear signal for when concentration is expensive.",
        [
          "Create a visible cue and a predictable time for non urgent requests.",
          "Explain why the protected block matters so the limit feels understandable."
        ],
        "This applies at home too because interruptions are partly a readability problem. Clear signals reduce repeated accidental collisions."
      ),
      example(
        "ch14-ex06",
        "Shared apartment study chaos",
        ["personal"],
        "Housemates keep pulling one another into casual conversation and quick favors because everyone is technically present, even when someone is trying to finish demanding work.",
        [
          "Agree on focused hours and how to tell when a conversation should wait.",
          "Use a shared rhythm instead of constant improvisation."
        ],
        "The deeper lesson is that good shared life includes coordinated attention norms, not only goodwill."
      ),
    ],
    questions: [
      question(
        "ch14-q01",
        "Why are workplace interruptions more costly than they often appear?",
        [
          "Because the recovery of concentration often lasts longer than the visible pause",
          "Because interruptions always take at least an hour",
          "Because only introverts lose focus",
          "Because collaborative work should never include questions",
        ],
        0
      ),
      question(
        "ch14-q02",
        "What should teams do with predictable interruption patterns?",
        [
          "Treat them as design problems to solve",
          "Assume they are unavoidable forever",
          "Punish anyone who asks questions",
          "Stop doing deep work",
        ],
        0
      ),
      question(
        "ch14-q03",
        "Why do visible focus signals help?",
        [
          "They make the cost of interrupting more readable before the interruption happens",
          "They guarantee perfect silence",
          "They replace the need for trust",
          "They matter only in offices with doors",
        ],
        0
      ),
      question(
        "ch14-q04",
        "What is the benefit of batching non urgent questions?",
        [
          "It reduces fragmentation by replacing many scattered interruptions with fewer planned ones",
          "It makes collaboration slower in every case",
          "It works only for managers",
          "It removes all communication from the team",
        ],
        0
      ),
      question(
        "ch14-q05",
        "How should deep work be treated in an interruption heavy environment?",
        [
          "As a personal luxury if time permits",
          "As real work that needs explicit protection",
          "As something to do only after messages end",
          "As less important than responsiveness",
        ],
        1
      ),
      question(
        "ch14-q06",
        "Why is defining urgency so important?",
        [
          "Because when everything sounds immediate, focus collapses",
          "Because every request is equally urgent",
          "Because urgency should be avoided entirely",
          "Because teams work best in constant emergency mode",
        ],
        0
      ),
      question(
        "ch14-q07",
        "What does the chapter suggest about availability?",
        [
          "It can be scheduled without requiring continuous interruptibility",
          "It should be permanent if collaboration matters",
          "It does not affect concentration",
          "It matters only for remote work",
        ],
        0
      ),
      question(
        "ch14-q08",
        "What does interruption often reveal about culture?",
        [
          "Whether focus is respected or quietly mocked",
          "Whether the team is creative",
          "Whether the tools are modern",
          "Whether people care about one another",
        ],
        0
      ),
      question(
        "ch14-q09",
        "What makes interruption defense sustainable?",
        [
          "Clear boundaries delivered with respect",
          "Visible irritation at every question",
          "Keeping the cost of focus hidden",
          "Refusing all collaboration",
        ],
        0
      ),
      question(
        "ch14-q10",
        "What is the deeper workplace ideal in this chapter?",
        [
          "A rhythm that includes known moments for responsiveness and known moments for concentration",
          "Permanent access for everyone",
          "Total silence all day",
          "Work that never requires thought",
        ],
        0
      ),
    ],
  }),
  chapter({
    chapterId: "ch15-email-boundaries",
    number: 15,
    title: "Use Email Instead Of Being Used By It",
    readingTimeMinutes: 12,
    summary: {
      p1: t(
        "Using email instead of being used by it means treating inboxes as tools to handle deliberately rather than as streams that get to author the day.",
        "Eyal shows that email becomes distracting when it turns into a default to do list, emotional checking loop, and constant invitation to context switch.",
        "The practical answer is to give email clearer boundaries, clearer expectations, and clearer messages."
      ),
      p2: t(
        "This matters because email feels productive even when it is mostly reactive.",
        "When it stays unbounded, it can consume the best hours of the day while more important work keeps sliding into the margins.",
        "The deeper lesson is that asynchronous communication should not function like an endless emergency channel. Better rules restore email to its proper place."
      ),
    },
    standardBullets: [
      bullet(
        "The inbox is other people's agenda. Entering it without intention makes reactive work feel like the default job.",
        "That does not make email bad. It makes it powerful enough to need structure.",
        "Otherwise the day gets authored from the outside in.",
        "A tool designed for messages can quietly become your planner, priority list, and anxiety loop."
      ),
      bullet(
        "Check email on purpose. Scheduled windows protect the rest of the day from constant low grade context switching.",
        "This gives email a role instead of letting it become a permanent backdrop.",
        "Bounded checking usually improves quality as well as focus.",
        "When email has a time, it stops demanding all time."
      ),
      bullet(
        "Not every message deserves the same speed. Response time should match real importance rather than general anxiety.",
        "This reduces compulsive refreshing and unnecessary urgency.",
        "Email works better when expected rhythms are known.",
        "Faster is not automatically better if it destroys better work elsewhere."
      ),
      bullet(
        "Write emails that reduce loops. Clear subject lines, clear asks, and clear next steps make future distraction less likely.",
        "Better writing is therefore part of attention management.",
        "Each ambiguous email can create several later interruptions.",
        "Clarity now saves attention later."
      ),
      bullet(
        "Use the right channel. Some issues need a meeting, call, or document instead of a messy thread.",
        "That matters because email can become a poor home for things it was never designed to carry well.",
        "Bad channel fit creates extra back and forth.",
        "Using email well includes knowing when not to use it."
      ),
      bullet(
        "Processing beats grazing. It is more effective to handle email in batches than to peck at it constantly for emotional reassurance.",
        "Grazing feels responsive but often produces little completion.",
        "Batching lets you think and decide more cleanly.",
        "The inbox becomes less seductive when it is treated as a process block rather than as ambient stimulation."
      ),
      bullet(
        "Reduce the number of decisions email can demand from your best hours. The highest energy time often belongs elsewhere.",
        "This is why checking order matters so much.",
        "Important creation should not always trail reactive consumption.",
        "The sequence of the day often decides who gets your best cognition."
      ),
      bullet(
        "Set expectations where possible. Automatic replies, team norms, and direct communication can reduce false urgency around response time.",
        "Email feels less tyrannical when people know the rhythm.",
        "Expectations are part of boundary design.",
        "Silence about timing lets everyone project their own fears onto delay."
      ),
      bullet(
        "Unsubscribe and filter aggressively. Many inbox demands should never reach your main attention in the first place.",
        "Removal is often better than repeated resistance.",
        "A cleaner inbox creates fewer vulnerable moments.",
        "The easiest email to manage is the one that never got invited in."
      ),
      bullet(
        "Email should support traction, not replace it. The test is whether it is helping the real priorities or consuming the time that was meant for them.",
        "This returns the chapter to the book's larger framework.",
        "The inbox is a tool, not a master scorecard.",
        "When email becomes the center of the day, intention usually moves to the perimeter."
      ),
    ],
    deeperBullets: [
      bullet(
        "Compulsive checking is often emotional checking. People open the inbox not only for information, but for relief from uncertainty and the chance of reward.",
        "That is why email can become habit forming even when most messages are unimportant.",
        "The deeper battle is partly internal, not only procedural."
      ),
      bullet(
        "Email quality influences future attention quality. Poorly written messages externalize confusion and force others to spend focus resolving it.",
        "Good email is a respect practice as much as a productivity practice.",
        "Every unclear message sends hidden work downstream."
      ),
      bullet(
        "Thread length often signals channel failure. Long tangled exchanges usually mean the communication medium is no longer serving clarity.",
        "Recognizing that early protects attention.",
        "A short call can sometimes save hours of reactive reading."
      ),
      bullet(
        "Inbox zero is not the main point. What matters is whether email has a bounded and useful role inside your system.",
        "A perfectly empty inbox can still coexist with a badly designed day.",
        "The deeper metric is whether the tool serves what matters."
      ),
      bullet(
        "Email becomes healthier when the culture around it matures. Individual batching helps, but shared norms about timing, clarity, and channel choice amplify the gain.",
        "This links personal boundaries to organizational design.",
        "The strongest fix is often both personal and social."
      ),
    ],
    takeaways: [
      "Inboxes are reactive by default",
      "Check email on purpose",
      "Clarity reduces later loops",
      "Use the right channel",
      "Batching beats grazing",
      "Filtering removes future friction",
    ],
    practice: [
      "Move email checks into planned windows",
      "Protect your best hour from the inbox",
      "Rewrite one recurring email for more clarity and fewer loops",
      "Unsubscribe from one category that should not reach you",
      "Set one expectation about response time",
    ],
    examples: [
      example(
        "ch15-ex01",
        "Class inbox steals study time",
        ["school"],
        "A student keeps checking school email during every study block because a professor or club might send something useful, even though most checks produce little but distraction.",
        [
          "Move email into planned check windows instead of letting uncertainty open it repeatedly.",
          "Use those windows to process messages fully rather than graze."
        ],
        "This matters because email is often less about urgent information than about relief from not knowing. Structure protects the rest of the block."
      ),
      example(
        "ch15-ex02",
        "Group project thread never ends",
        ["school"],
        "A class project creates a long confusing email thread where no one is sure what has been decided, so students keep rereading the chain instead of moving the work forward.",
        [
          "Write a clear summary email with decisions, open questions, and next owners, or move the issue to a better channel.",
          "Reduce the ambiguity that keeps forcing everyone back into the thread."
        ],
        "The chapter helps because better email writing is also better attention design. Clarity now prevents later loops."
      ),
      example(
        "ch15-ex03",
        "Morning inbox habit",
        ["work"],
        "An employee opens email first every morning and loses the best thinking time to other people's requests before his main project has even started.",
        [
          "Protect the first high energy block for the planned priority.",
          "Check email later on purpose rather than by reflex."
        ],
        "This shows how email can quietly take over the sequence of the day. The issue is not the tool alone but when it gets your best attention."
      ),
      example(
        "ch15-ex04",
        "Manager creates endless reply chains",
        ["work"],
        "A manager sends vague emails with no clear ask, which leads to follow up questions, partial replies, and several extra rounds of interruption for the team.",
        [
          "Write with a clear subject, clear request, and clear next step.",
          "Use another channel if the issue is too nuanced for email."
        ],
        "The deeper lesson is that poor email writing exports confusion to everyone else. Better messages reduce future distraction for the whole system."
      ),
      example(
        "ch15-ex05",
        "Inbox checking on vacation day",
        ["personal"],
        "Someone wants a real day off but keeps peeking at the inbox for reassurance that nothing is on fire, which keeps the mind half at work the whole time.",
        [
          "Set a clear boundary for when email will and will not be checked.",
          "Use expectation setting rather than repeated grazing for relief."
        ],
        "This matters because email can steal rest as easily as it steals work time. Relief seeking often disguises itself as responsibility."
      ),
      example(
        "ch15-ex06",
        "Family logistics lost in threads",
        ["personal"],
        "A household uses email for every detail, creating long threads that no one really tracks well, so people keep searching and reasking.",
        [
          "Move recurring logistics to a clearer shared system and reserve email for what it handles well.",
          "Reduce the attention cost of repeated searching."
        ],
        "The chapter applies outside the office because the tool question is universal. Good channel fit lowers friction in any domain."
      ),
    ],
    questions: [
      question(
        "ch15-q01",
        "What makes email so distracting by default?",
        [
          "It can become other people's agenda for your best attention",
          "It is always more important than planned work",
          "It works only in emergencies",
          "It cannot be structured",
        ],
        0
      ),
      question(
        "ch15-q02",
        "Why are scheduled email windows helpful?",
        [
          "They give the inbox a bounded role instead of letting it run all day",
          "They guarantee an empty inbox",
          "They remove all need for clear writing",
          "They matter only for executives",
        ],
        0
      ),
      question(
        "ch15-q03",
        "How should response time be handled?",
        [
          "Every email should be answered instantly",
          "Speed should match real importance rather than general anxiety",
          "Long delays are always respectful",
          "Timing should remain undefined",
        ],
        1
      ),
      question(
        "ch15-q04",
        "Why does better email writing improve attention?",
        [
          "Because clearer messages reduce future loops and ambiguity",
          "Because long emails are always better",
          "Because subject lines do not matter",
          "Because writing quality only affects tone",
        ],
        0
      ),
      question(
        "ch15-q05",
        "When should email not be the main tool?",
        [
          "When another channel would handle the issue with more clarity and less back and forth",
          "Only when the issue is pleasant",
          "Never, because email fits everything",
          "Only outside work",
        ],
        0
      ),
      question(
        "ch15-q06",
        "What is the problem with constant inbox grazing?",
        [
          "It feels responsive but often keeps attention fragmented and incompletely used",
          "It guarantees every message gets handled well",
          "It improves deep work",
          "It matters only if the inbox is large",
        ],
        0
      ),
      question(
        "ch15-q07",
        "Why protect high energy time from email?",
        [
          "Because reactive processing can consume the cognition better spent on higher value work",
          "Because email should happen only at night",
          "Because high energy time is best spent multitasking",
          "Because inbox work is never real work",
        ],
        0
      ),
      question(
        "ch15-q08",
        "What role do filters and unsubscribes play?",
        [
          "They remove demands before they reach your vulnerable attention",
          "They make good writing unnecessary",
          "They replace scheduling",
          "They only help with spam",
        ],
        0
      ),
      question(
        "ch15-q09",
        "What is the deeper issue behind compulsive inbox checking?",
        [
          "It is often partly a search for emotional relief from uncertainty",
          "It proves a person is naturally efficient",
          "It means every message is urgent",
          "It happens only in workplaces with poor wifi",
        ],
        0
      ),
      question(
        "ch15-q10",
        "What is the chapter's central standard for email?",
        [
          "Email should support traction rather than replace it",
          "Inbox zero is the only real goal",
          "More email always means more progress",
          "Good workers stay in the inbox continuously",
        ],
        0
      ),
    ],
  }),
  chapter({
    chapterId: "ch06-reimagine-trigger",
    number: 6,
    title: "Change How You Interpret The Urge",
    readingTimeMinutes: 13,
    summary: {
      p1: t(
        "Changing how you interpret the urge means treating an impulse as a temporary sensation to observe, not a command you must obey.",
        "Eyal wants the reader to see that urges rise, peak, and pass, and that their power partly comes from the story we attach to them.",
        "When the urge is reinterpreted this way, compulsion gives way to something more workable and smaller."
      ),
      p2: t(
        "This matters because people often lose to distraction before the actual click, not after it. They lose when they decide the urge itself means they have already lost control.",
        "Watching the sensation with curiosity breaks that assumption and gives the mind another way through the moment.",
        "The deeper lesson is that interpretation shapes endurance. When you stop turning a passing urge into a verdict about reality, you can stay with the original task far longer."
      ),
    },
    standardBullets: [
      bullet(
        "An urge is temporary. It feels absolute in the moment, but it moves and changes if you watch it carefully.",
        "That matters because urgency often comes from how the urge is interpreted, not just from the sensation itself.",
        "Seeing the urge as a passing event makes it less convincing.",
        "The mind loses some of its panic when it stops assuming this feeling will stay exactly as strong."
      ),
      bullet(
        "Separate sensation from story. The body may feel restless while the mind adds a dramatic explanation such as I need a break now.",
        "Noticing that split helps you question the story instead of obeying it automatically.",
        "The story is often what gives the urge its false authority.",
        "Many urges are half sensation and half narration, and the narration is usually easier to weaken."
      ),
      bullet(
        "Curiosity softens compulsion. Studying the urge turns you from a victim of it into an observer of it.",
        "That shift does not erase discomfort, but it changes your role in relation to it.",
        "Observation creates distance without denial.",
        "Curiosity also gives the mind something to do besides bargaining or surrendering."
      ),
      bullet(
        "Look at the body. Where the urge shows up physically often tells you more than the first thought about it.",
        "Tightness, buzzing, heat, or pressure are easier to observe honestly than a self flattering story.",
        "This is useful because body sensations can be watched without immediately becoming identity statements.",
        "The more concrete the observation, the less mystical the urge feels."
      ),
      bullet(
        "Delay weakens certainty. A short wait tests whether the urge is truly urgent or only loudly persuasive.",
        "Many impulses become smaller when they are not rewarded right away.",
        "The delay works because time changes the shape of the feeling.",
        "What looked impossible to resist at the first second can look manageable a minute later."
      ),
      bullet(
        "Do not wrestle every thought. Fighting the urge aggressively can sometimes keep attention locked on it.",
        "A calmer stance often makes the feeling easier to outlast.",
        "This is why observation beats melodrama here.",
        "The goal is not to win a dramatic inner battle. It is to keep moving without making the urge the center of the room."
      ),
      bullet(
        "Name the moment honestly. Saying I am feeling an urge is different from saying I have to do this.",
        "That language matters because it preserves agency.",
        "Small wording changes can weaken the sense of inevitability.",
        "You are less trapped when the experience becomes something you are having rather than something that defines you."
      ),
      bullet(
        "Return to the task after the wave. The point of urge observation is not endless self study. It is renewed traction.",
        "Once the intensity drops, reenter the chosen action quickly and simply.",
        "That return matters because it teaches the brain a new sequence.",
        "The urge is no longer the bridge to distraction. It becomes a bridge back to the plan."
      ),
      bullet(
        "Practice during ordinary urges. You do not need a dramatic temptation to build this skill.",
        "Every small craving to check, snack, switch, or scroll is usable training.",
        "That makes the method realistic and repeatable.",
        "Skills built on small moments are more available when the bigger urges arrive."
      ),
      bullet(
        "Interpretation changes endurance. The less catastrophic the urge sounds, the more capacity you have to stay with it.",
        "This is why the chapter focuses on meaning, not just brute restraint.",
        "You last longer when the mind stops telling you the discomfort is unbearable.",
        "A calmer interpretation does not make the urge imaginary. It makes it survivable."
      ),
    ],
    deeperBullets: [
      bullet(
        "Urges often overpromise permanence. They speak as if this feeling will rule the next hour when it may barely survive the next few minutes.",
        "Questioning that promise is part of the skill.",
        "The deeper gain comes from learning that intensity and duration are not the same thing."
      ),
      bullet(
        "Neutral language is underrated. Describing the urge without insult or drama keeps the nervous system from escalating further.",
        "This is one reason measured observation outperforms inner combat for many people.",
        "Calm naming helps the mind stay flexible."
      ),
      bullet(
        "The body is often more honest than the justification. A sensation in the chest or fingers may reveal the urge before the mind invents a polished reason to switch tasks.",
        "That early honesty creates leverage.",
        "Many people catch the body before they can catch the story."
      ),
      bullet(
        "A successful delay changes identity evidence. Each time you watch an urge pass, you collect proof that you are not as captive to it as it claimed.",
        "That proof matters on later days.",
        "Confidence grows from remembered survival."
      ),
      bullet(
        "The method is modest on purpose. It does not demand that the urge vanish. It only asks that you see it clearly enough to stop worshipping it.",
        "That makes the chapter more humane and more usable.",
        "Freedom here is not the absence of impulse. It is the loss of impulse supremacy."
      ),
    ],
    takeaways: [
      "Urges are temporary",
      "Sensation and story differ",
      "Curiosity weakens compulsion",
      "Delay tests urgency",
      "Language preserves agency",
      "Return to traction quickly",
    ],
    practice: [
      "Describe one urge as a body sensation before acting",
      "Delay one non essential impulse for a short window",
      "Use the phrase I am feeling an urge instead of I need this",
      "Observe one ordinary craving from start to finish",
      "Return to the planned task as soon as the wave softens",
    ],
    examples: [
      example(
        "ch06-ex01",
        "Phone urge during reading",
        ["school"],
        "A student feels a sudden urge to check her phone while reading a dense assignment and instantly assumes the discomfort means she cannot focus right now.",
        [
          "Treat the urge as a passing wave and notice where it shows up in the body.",
          "Delay the check briefly and see whether the feeling changes before deciding."
        ],
        "This matters because the student is not only reacting to the urge. She is reacting to her interpretation of the urge as proof that she must switch."
      ),
      example(
        "ch06-ex02",
        "Last minute course portal checking",
        ["school"],
        "Before an exam, a student keeps reopening the course portal and messages because the urge feels urgent, even though no new information is likely to appear.",
        [
          "Name the sensation and the anxious story separately.",
          "Use a short delay to test whether the urge is actually urgent or simply loud."
        ],
        "The chapter helps because it shows that urgency is often partly narration. Once that story loosens, the student can return to more useful preparation."
      ),
      example(
        "ch06-ex03",
        "Chat urge during concentrated work",
        ["work"],
        "An employee working on a deep task feels a sharp urge to open team chat the moment the work becomes mentally demanding.",
        [
          "Observe the urge as sensation first, not as an instruction.",
          "Wait briefly and see whether the pressure changes before opening anything."
        ],
        "This matters because many work interruptions begin inside the worker before they begin on the screen. Reinterpreting the urge creates a chance to keep going."
      ),
      example(
        "ch06-ex04",
        "Defensive reply impulse",
        ["work"],
        "After receiving a critical comment, a manager feels the immediate urge to write a sharp reply because the sensation feels urgent and righteous.",
        [
          "Slow down enough to separate the body heat of the moment from the story that the reply must happen now.",
          "Let the wave pass before choosing the response."
        ],
        "The deeper point is that an urge can feel morally convincing while still being temporary. Watching it reduces the chance of acting from its peak."
      ),
      example(
        "ch06-ex05",
        "Late night snack craving",
        ["personal"],
        "Someone sitting on the couch feels a strong urge to snack and instantly tells himself the craving will keep growing unless he gets up now.",
        [
          "Treat the craving as a sensation to study for a short window instead of a demand that has already won.",
          "Notice what happens to its intensity during the delay."
        ],
        "This matters because many urges gain strength from the prediction that they are unbeatable. Testing that prediction changes the relationship to the impulse."
      ),
      example(
        "ch06-ex06",
        "Impulse to send a loaded text",
        ["personal"],
        "A person feels hurt after an exchange with a friend and wants to send a pointed message right away because the urge feels like honesty.",
        [
          "Separate the bodily charge from the story that immediate expression is the only authentic option.",
          "Wait for the wave to settle, then decide what response actually serves the relationship."
        ],
        "The chapter applies here because an urge can mistake intensity for truth. Observation makes room for a wiser response."
      ),
    ],
    questions: [
      question(
        "ch06-q01",
        "What is the key shift in this chapter?",
        [
          "Treat the urge as a temporary sensation to observe",
          "Eliminate every urge before starting work",
          "Follow the urge quickly so it does not grow",
          "Assume strong urges are always informative",
        ],
        0
      ),
      question(
        "ch06-q02",
        "Why is it useful to separate sensation from story?",
        [
          "Because the story often makes the urge sound more absolute than the sensation itself",
          "Because sensations are always imaginary",
          "Because thoughts should be ignored completely",
          "Because urges matter only in the body",
        ],
        0
      ),
      question(
        "ch06-q03",
        "What does a short delay help test?",
        [
          "Whether the urge is truly urgent or only persuasive",
          "Whether the task should be abandoned",
          "Whether the body can stop feeling discomfort",
          "Whether planning was a mistake",
        ],
        0
      ),
      question(
        "ch06-q04",
        "A worker says, \"I felt like checking chat, so I had no real choice.\" Which idea best challenges that statement?",
        [
          "The feeling itself is proof of necessity",
          "An urge can be noticed without being treated as an order",
          "Strong urges only happen when the plan is wrong",
          "The best answer is to shame yourself faster",
        ],
        1
      ),
      question(
        "ch06-q05",
        "Why can curiosity help in the middle of an urge?",
        [
          "It gives the mind a way to observe the wave instead of instantly serving it",
          "It makes the urge pleasant",
          "It guarantees the urge disappears",
          "It replaces the need to return to the task",
        ],
        0
      ),
      question(
        "ch06-q06",
        "What is the value of focusing on the body during an urge?",
        [
          "Body sensations are often easier to observe honestly than the first self justifying story",
          "Body sensations matter only for food cravings",
          "The body never changes during an urge",
          "It proves the urge is dangerous",
        ],
        0
      ),
      question(
        "ch06-q07",
        "Which response best fits the chapter's view of inner struggle?",
        [
          "Fight every thought aggressively",
          "Use calm observation instead of making the urge the center of a dramatic battle",
          "Trust the loudest impulse",
          "Replace every urge with a reward",
        ],
        1
      ),
      question(
        "ch06-q08",
        "What should happen after the wave softens?",
        [
          "Begin analyzing the urge for the rest of the hour",
          "Return to the chosen task",
          "Reward yourself with a bigger distraction",
          "Rewrite the plan around the urge",
        ],
        1
      ),
      question(
        "ch06-q09",
        "Why practice on ordinary urges?",
        [
          "Small moments are usable training for larger temptations",
          "Ordinary urges do not count",
          "This method works only under severe pressure",
          "Because ordinary urges are always harmless",
        ],
        0
      ),
      question(
        "ch06-q10",
        "What changes when interpretation changes?",
        [
          "The urge becomes impossible to feel",
          "The person can endure the urge longer without obeying it",
          "The task becomes easy automatically",
          "The environment stops mattering",
        ],
        1
      ),
    ],
  }),
  chapter({
    chapterId: "ch07-reimagine-task",
    number: 7,
    title: "Make The Task Less Mentally Painful",
    readingTimeMinutes: 14,
    summary: {
      p1: t(
        "Making the task less mentally painful means redesigning how you engage the work so boredom, confusion, and aversion have less control over you.",
        "Eyal argues that many tasks become distractible because they feel dull, abstract, or emotionally costly, not because the person lacks values.",
        "The practical move is to make the work more startable, more varied, and easier to stay inside."
      ),
      p2: t(
        "This matters because people often try to defeat distraction while leaving the task itself unnecessarily painful.",
        "When the work is reframed with clearer entry points, more challenge, more novelty, or better feedback, focus stops depending quite so much on brute force.",
        "The deeper lesson is that attention is partly a design response. You can shape the task so that staying with it feels more possible and more interesting."
      ),
    },
    standardBullets: [
      bullet(
        "Boring work invites escape. Tasks become distractible when they feel flat, repetitive, or emotionally unrewarding.",
        "That does not mean the task is worthless. It means the current experience of it is easy to abandon.",
        "Seeing this keeps you from moralizing every lapse.",
        "The task may still matter deeply while being poorly shaped for sustained attention."
      ),
      bullet(
        "Startability matters. A task is easier to stay with when the first step is concrete and visible.",
        "Vague starts create friction before momentum ever begins.",
        "That is why breaking the work into an obvious entry action can be so effective.",
        "Many people do not hate the whole task. They hate the uncertainty of beginning it."
      ),
      bullet(
        "Novelty can be created. Even routine work can become easier to engage when you look for variation, experimentation, or a sharper question.",
        "Attention wakes up when something feels a little more alive.",
        "This does not require turning work into entertainment. It requires changing the angle of contact.",
        "A slightly fresher frame can rescue a task from feeling mentally dead."
      ),
      bullet(
        "Challenge should fit ability. Tasks become more absorbing when they are neither trivial nor impossibly vague.",
        "A better fit reduces the urge to escape from boredom on one side and overwhelm on the other.",
        "This is why adjustments in scope can matter so much.",
        "Attention strengthens when the task feels stretchable rather than crushing or empty."
      ),
      bullet(
        "Feedback keeps the mind engaged. Progress is easier to sustain when you can see movement, correction, or improvement.",
        "Invisible progress makes distraction more tempting because the effort feels like it disappears.",
        "Adding markers, checkpoints, or short loops can help the task feel more real.",
        "The mind stays longer with work that answers back."
      ),
      bullet(
        "Make the next move more interesting than the escape. Curiosity is often a stronger ally than sternness.",
        "If the task contains a question you genuinely want answered, attention has more reason to stay.",
        "This is one of the most practical ways to reduce mental pain.",
        "A curious mind is harder to distract than a resentful one."
      ),
      bullet(
        "Time limits can sharpen engagement. A shorter block can make a dull task feel more containable and active.",
        "The limit reduces the feeling of endlessness that often triggers avoidance.",
        "This works especially well when the task has already been given a clear target.",
        "Containment can turn dread into a manageable sprint."
      ),
      bullet(
        "Do not confuse friction with virtue. Leaving work unnecessarily clumsy does not make you stronger.",
        "Sometimes the smartest move is to make the task easier to enter or easier to track.",
        "That is not cheating. It is design.",
        "People often cling to awkward methods because struggle feels noble even when it is mostly waste."
      ),
      bullet(
        "Reframing beats grim endurance. You can often change the felt experience of the task without changing its core purpose.",
        "That may mean asking a better question, redefining the target, or changing the sequence.",
        "The result is not less seriousness. It is better staying power.",
        "Good design reduces the amount of sheer force needed to keep working."
      ),
      bullet(
        "Attention improves when the task invites participation. The work becomes stickier when it gives the mind something active to do.",
        "Passive drifting through a task makes outside stimulation more appealing.",
        "This is why questions, checkpoints, and small experiments matter.",
        "A task that asks for active engagement gives distraction more competition."
      ),
    ],
    deeperBullets: [
      bullet(
        "Play is not childish here. It is a way of increasing experimentation, feedback, and engagement inside work that might otherwise feel dead.",
        "The deeper point is not fun for its own sake. It is more skillful contact with the task.",
        "People often focus better when the work includes some spirit of exploration."
      ),
      bullet(
        "Task pain is often design pain. What looks like lack of discipline can be lack of clarity, feedback, or a reasonable entry point.",
        "This insight redirects blame into better engineering.",
        "A better task structure can unlock effort that guilt never could."
      ),
      bullet(
        "Energy follows perceived progress. When nothing visible moves, the mind starts shopping for relief elsewhere.",
        "Small signs of advancement can therefore matter more than abstract promises about future payoff.",
        "Progress cues are motivational architecture."
      ),
      bullet(
        "The right constraint can create freedom. A clear timebox, scope limit, or challenge rule often makes the task easier to inhabit.",
        "Without boundaries, even simple work can become mentally slippery.",
        "Structure gives attention edges to push against."
      ),
      bullet(
        "You do not have to wait to like the task. Often you only need to reshape your first contact with it enough for momentum to begin.",
        "Liking may come later or not at all.",
        "What matters is making sustained engagement more possible than immediate escape."
      ),
    ],
    takeaways: [
      "Task pain can be redesigned",
      "Clear entry points matter",
      "Novelty and challenge help",
      "Feedback supports focus",
      "Time limits can help",
      "Design can reduce brute force",
    ],
    practice: [
      "Shrink one task to a clearer first move",
      "Add one feedback marker to work that feels invisible",
      "Turn one dull task into a question you can investigate",
      "Use a short timebox on one resisted task",
      "Remove one piece of unnecessary friction from how you work",
    ],
    examples: [
      example(
        "ch07-ex01",
        "Textbook reading that feels dead",
        ["school"],
        "A student keeps zoning out while reading a dry textbook chapter because the work feels passive and endless.",
        [
          "Turn the reading into an active task by asking a question the chapter must answer and marking each section against it.",
          "Use a shorter timebox so the task feels bounded."
        ],
        "This matters because attention often improves when the task invites participation instead of passive endurance."
      ),
      example(
        "ch07-ex02",
        "Problem set avoided by overwhelm",
        ["school"],
        "A student keeps delaying a problem set because the page looks huge and the first step feels unclear.",
        [
          "Cut the task down to one visible starting action and one short work block.",
          "Give yourself progress markers so the effort stops feeling invisible."
        ],
        "The chapter helps because task pain is often created by poor framing. Better structure can make starting feel far less costly."
      ),
      example(
        "ch07-ex03",
        "Repetitive spreadsheet work",
        ["work"],
        "An analyst has to clean a large spreadsheet and keeps drifting to messages because the work feels repetitive and numb.",
        [
          "Create a small challenge, target, or loop that turns the work into a more active process.",
          "Track visible progress so the task answers back."
        ],
        "This shows that boredom is not always defeated by moral pressure. Sometimes the task itself needs a better design."
      ),
      example(
        "ch07-ex04",
        "Proposal drafting with no clear entry",
        ["work"],
        "A worker keeps reorganizing background notes because drafting the proposal feels too vague and heavy to enter directly.",
        [
          "Define the smallest concrete entry point, such as writing the problem statement or the first recommendation.",
          "Contain the effort in a short block instead of staring at the whole document."
        ],
        "The chapter matters because uncertainty at the start is a major source of task pain. Better entry design reduces the urge to detour."
      ),
      example(
        "ch07-ex05",
        "Home paperwork never started",
        ["personal"],
        "Someone keeps postponing household paperwork because it feels dull, confusing, and thankless.",
        [
          "Make the session shorter, more structured, and easier to score with visible progress.",
          "Remove extra friction such as missing documents before the block begins."
        ],
        "Task redesign is useful outside work too. A boring task often becomes more manageable when it stops feeling shapeless."
      ),
      example(
        "ch07-ex06",
        "Learning a skill feels tedious",
        ["personal"],
        "A person wants to practice guitar but quits quickly because the drills feel flat and endless compared with easier entertainment.",
        [
          "Add challenge, variety, or a concrete mini target that makes the practice more interactive.",
          "Use a contained practice block so the work feels finite and real."
        ],
        "The deeper lesson is that attention follows engagement. Making the task more alive can be smarter than simply demanding more grit."
      ),
    ],
    questions: [
      question(
        "ch07-q01",
        "What is the main claim of this chapter?",
        [
          "If a task feels painful, you should always replace it",
          "You can redesign how you engage a task so it is easier to stay with",
          "Only naturally interesting tasks deserve attention",
          "Focus comes only from stronger punishment",
        ],
        1
      ),
      question(
        "ch07-q02",
        "Why does a clear first step matter so much?",
        [
          "It reduces the vague friction that makes starting feel costly",
          "It removes the need for planning",
          "It guarantees the task becomes fun",
          "It matters only for school work",
        ],
        0
      ),
      question(
        "ch07-q03",
        "A worker keeps drifting from a repetitive task because nothing feels like progress. What would help most?",
        [
          "More invisible effort",
          "Visible feedback or checkpoints inside the task",
          "Treating boredom as irrelevant",
          "Keeping the task open ended for longer",
        ],
        1
      ),
      question(
        "ch07-q04",
        "How does novelty help attention here?",
        [
          "It can make the task feel more alive without changing its real purpose",
          "It eliminates every hard part",
          "It works only for creative jobs",
          "It replaces the need for discipline completely",
        ],
        0
      ),
      question(
        "ch07-q05",
        "What is the value of a short time limit?",
        [
          "It makes the task feel endless",
          "It contains the effort and can reduce dread",
          "It proves the task is unimportant",
          "It matters only when the task is enjoyable",
        ],
        1
      ),
      question(
        "ch07-q06",
        "Which statement best fits the chapter's view of friction?",
        [
          "Extra awkwardness usually builds character",
          "A smarter design that reduces unnecessary friction can improve follow through",
          "Friction is always a sign the task should end",
          "Only technology creates friction",
        ],
        1
      ),
      question(
        "ch07-q07",
        "A student avoids a huge assignment because it feels overwhelming. What is the best first move?",
        [
          "Make the whole task more abstract",
          "Break it into a smaller entry point and a shorter block",
          "Wait until motivation becomes intense",
          "Switch to easier work for the rest of the day",
        ],
        1
      ),
      question(
        "ch07-q08",
        "Why does the chapter talk about play or experimentation?",
        [
          "Because all serious work should become entertainment",
          "Because a more active and exploratory contact with the task can improve engagement",
          "Because only games deserve focus",
          "Because structure no longer matters once play appears",
        ],
        1
      ),
      question(
        "ch07-q09",
        "What makes a task more attention friendly according to this chapter?",
        [
          "Passive repetition with no feedback",
          "Visible progress, clear entry, and some active engagement",
          "Larger scope and fewer boundaries",
          "Pure reliance on mood",
        ],
        1
      ),
      question(
        "ch07-q10",
        "What is the deeper message behind reimagining the task?",
        [
          "Task pain is partly a design problem, not only a discipline problem",
          "Hard work should feel miserable to count",
          "The best task is the easiest one available",
          "Once a task is redesigned, distraction disappears forever",
        ],
        0
      ),
    ],
  }),
  chapter({
    chapterId: "ch08-reimagine-temperament",
    number: 8,
    title: "Temperament Can Be Managed",
    readingTimeMinutes: 15,
    summary: {
      p1: t(
        "Temperament can be managed because tendencies are not destiny and identity stories strongly shape how much control people believe they have.",
        "Eyal pushes back against fixed narratives such as I am just bad at focus or I have an addictive personality so there is no point trying.",
        "The chapter argues that belief, self talk, and environment interact with temperament more than people often admit."
      ),
      p2: t(
        "This matters because helpless identities become self fulfilling. If you assume distraction is your nature, you stop looking for leverage.",
        "A more flexible view creates room for training, design, and better choices without denying that some tendencies are real.",
        "The deeper lesson is that self image is itself a trigger or a support. The story you tell about your capacity changes what effort feels worthwhile."
      ),
    },
    standardBullets: [
      bullet(
        "Tendencies are not commands. A trait may describe a pattern, but it does not dictate every next move.",
        "That distinction protects people from turning predispositions into final identity.",
        "It also keeps room open for strategy.",
        "Useful self knowledge should sharpen intervention, not shut it down."
      ),
      bullet(
        "Fixed labels can become excuses. When people say this is just who I am, they often stop testing what could improve.",
        "The label may feel honest, but it can also become permission to surrender early.",
        "That makes identity language behaviorally important.",
        "A belief can quietly protect the very habit it claims to describe."
      ),
      bullet(
        "Belief shapes persistence. People work differently when they think focus can be trained versus when they think failure is proof of a permanent defect.",
        "This matters because effort feels more rational when change seems possible.",
        "Hopeless stories lower investment before the real test even starts.",
        "The deeper cost of a fixed mindset is not only emotion. It is reduced experimentation."
      ),
      bullet(
        "Environment still matters. A more vulnerable temperament is not an argument against design. It is a stronger argument for it.",
        "People with predictable weak points benefit even more from friction, structure, and precommitment.",
        "That keeps the chapter practical instead of purely psychological.",
        "Good design does not deny temperament. It compensates for it."
      ),
      bullet(
        "Self talk influences behavior. The words you use about yourself can either support change or weaken it.",
        "Saying I always do this often feels descriptive while actually strengthening the pattern.",
        "A more accurate form of language leaves room for intervention.",
        "Identity statements can become quiet instructions."
      ),
      bullet(
        "Compassion improves recovery. People who miss once and respond with balance are often more likely to return than people who spiral into condemnation.",
        "This does not make standards softer. It makes repair faster.",
        "That matters because repeated repair is the real engine of behavior change.",
        "A person who can recover cleanly from lapse has a major strategic advantage over one who turns every lapse into a verdict."
      ),
      bullet(
        "Traits describe risk, not fate. Knowing where you are impulsive or novelty seeking can help you build better safeguards.",
        "The honest use of temperament is diagnostic.",
        "It becomes dangerous only when it hardens into helplessness.",
        "The best question is not what am I doomed to do, but where do I need more support."
      ),
      bullet(
        "Identity can be edited through evidence. Repeated small wins change what feels true about you.",
        "This is why systems matter. They create the conditions for collecting better evidence.",
        "Confidence grows from enacted proof, not only from affirmations.",
        "The self story becomes more flexible when your recent behavior gives it something new to say."
      ),
      bullet(
        "Do not romanticize weakness. A tendency toward distraction should be understood clearly, not turned into a dramatic identity.",
        "People sometimes protect a pattern by treating it as deep and special.",
        "A simpler, more pragmatic view is often more useful.",
        "What matters is whether the pattern can be managed better, not whether it sounds psychologically interesting."
      ),
      bullet(
        "Manage what is true without surrendering to it. That is the chapter's balance point.",
        "You can admit real tendencies while still building constraints, routines, and beliefs that improve behavior.",
        "This keeps the book away from both denial and fatalism.",
        "The chapter replaces identity despair with accountable flexibility."
      ),
    ],
    deeperBullets: [
      bullet(
        "Some diagnostic labels help only if they lead to action. A label that increases understanding but reduces agency is serving the habit poorly.",
        "That is the deeper test of whether a story about yourself is actually useful.",
        "A good explanation should improve design, not merely explain defeat."
      ),
      bullet(
        "Temperament often interacts with context. People can look impulsive in one environment and far steadier in another.",
        "This is one reason environment design can be so powerful.",
        "Behavior that seems like essence may partly be context dependence."
      ),
      bullet(
        "The mind prefers identity certainty, even when the identity is limiting. Familiar weakness can feel safer than uncertain change.",
        "That is why flexible self stories take deliberate effort.",
        "Letting go of a limiting identity sometimes feels destabilizing before it feels freeing."
      ),
      bullet(
        "Evidence changes belief more than rhetoric does. Small repeated follow through episodes can do more for self trust than motivational language alone.",
        "This is another reason the book leans so hard on systems and pacts.",
        "They help produce the evidence that new identity requires."
      ),
      bullet(
        "Agency grows when description becomes strategy. The best use of temperament knowledge is deciding what supports you need, when you need them, and why.",
        "That turns self knowledge into leverage.",
        "The chapter becomes practical when it moves from who you are to how you should design around what is true."
      ),
    ],
    takeaways: [
      "Traits are not destiny",
      "Fixed labels can trap you",
      "Belief shapes effort",
      "Environment still matters",
      "Compassion speeds recovery",
      "Evidence reshapes identity",
    ],
    practice: [
      "Rewrite one fixed statement about your focus into a more accurate one",
      "Identify one tendency that needs better support rather than more shame",
      "Create one environmental safeguard for a known weak point",
      "Notice how you talk to yourself after one lapse",
      "Collect one small piece of evidence that you can stay on track",
    ],
    examples: [
      example(
        "ch08-ex01",
        "I am just bad at studying",
        ["school"],
        "A student says he has always been distractible, so he treats every lapse during study as proof that serious focus is not really for him.",
        [
          "Challenge the fixed identity and ask what conditions help him study better even a little.",
          "Build support around the weak point instead of treating it as fate."
        ],
        "This matters because a fixed story can protect the problem from change. A tendency is more useful when it leads to better design, not surrender."
      ),
      example(
        "ch08-ex02",
        "Creative but chaotic club leader",
        ["school"],
        "A student says she is just a chaotic creative person, so she never sets up simple systems for deadlines and follow through.",
        [
          "Keep the useful part of the identity while dropping the helpless part.",
          "Use light structure to support the work instead of pretending structure would kill creativity."
        ],
        "The chapter helps because it rejects the false choice between authenticity and support. People can design around tendencies without betraying themselves."
      ),
      example(
        "ch08-ex03",
        "Always distracted at work story",
        ["work"],
        "An employee describes himself as someone who cannot focus, yet he notices that he works far better in a quiet room with clear targets than in an open noisy setting.",
        [
          "Use that evidence to replace the global label with a more specific diagnosis.",
          "Design the workday around the conditions that reduce the weak point."
        ],
        "This example shows that what looks like permanent temperament may partly be environment. Specificity creates leverage."
      ),
      example(
        "ch08-ex04",
        "Manager spirals after one lapse",
        ["work"],
        "A manager misses one focus block and immediately tells herself she has no discipline, which leads her to give up on the rest of the afternoon too.",
        [
          "Replace the condemning identity story with a faster repair response.",
          "Study what failed and restart instead of turning one miss into an identity statement."
        ],
        "Compassion matters here because it protects recovery. Harsh self talk often extends the lapse it claims to punish."
      ),
      example(
        "ch08-ex05",
        "Family says short attention span runs in the blood",
        ["personal"],
        "Someone has long repeated the family line that everyone in the house has a hopelessly short attention span, so no one builds much structure around devices or routines.",
        [
          "Treat the pattern as a risk factor that calls for better safeguards, not as a final sentence.",
          "Use the family insight to design smarter habits instead of to excuse familiar outcomes."
        ],
        "The chapter matters because explanations can either create strategy or create surrender. The same information can be used in very different ways."
      ),
      example(
        "ch08-ex06",
        "Identity shift through small wins",
        ["personal"],
        "A person who has always called himself impulsive starts using simple rules and notices that he follows through more often than before, but he still resists updating his self story.",
        [
          "Let recent evidence count and build a more flexible identity around it.",
          "Keep collecting proof through systems instead of clinging to the old description."
        ],
        "This matters because identity changes slowly. Small wins matter not only for performance, but for what the person comes to believe is possible."
      ),
    ],
    questions: [
      question(
        "ch08-q01",
        "What is the core claim of this chapter?",
        [
          "Temperament explains behavior so completely that strategy barely matters",
          "Tendencies are real, but they can be managed and designed around",
          "Only self belief matters and traits do not exist",
          "Identity statements are mostly harmless",
        ],
        1
      ),
      question(
        "ch08-q02",
        "Why can fixed labels be dangerous?",
        [
          "They often turn tendencies into excuses that stop experimentation",
          "They make people too optimistic",
          "They reduce the need for environmental design",
          "They matter only in school",
        ],
        0
      ),
      question(
        "ch08-q03",
        "How should a person use knowledge about a weak point?",
        [
          "As proof that change is impossible",
          "As a cue to build better supports and safeguards",
          "As a reason to avoid standards",
          "As a personality brand",
        ],
        1
      ),
      question(
        "ch08-q04",
        "What does the chapter suggest about self talk?",
        [
          "It has little effect on future behavior",
          "It can either support agency or reinforce the pattern",
          "It matters only after success",
          "It should always be harsh to work",
        ],
        1
      ),
      question(
        "ch08-q05",
        "Why is compassion useful after a lapse?",
        [
          "It eliminates the need to change anything",
          "It can speed recovery and reduce the extra pain that prolongs the lapse",
          "It guarantees future perfection",
          "It makes rules unnecessary",
        ],
        1
      ),
      question(
        "ch08-q06",
        "A worker focuses much better in a quiet room with clear targets than in a noisy open setting. What is the best conclusion?",
        [
          "His temperament may be interacting strongly with context",
          "His trait is permanent so nothing can help",
          "Only quiet spaces matter for everyone",
          "Planning is probably irrelevant",
        ],
        0
      ),
      question(
        "ch08-q07",
        "What helps identity change according to this chapter?",
        [
          "Recent evidence created by repeated small wins",
          "One dramatic promise",
          "Ignoring past behavior entirely",
          "Avoiding all structure",
        ],
        0
      ),
      question(
        "ch08-q08",
        "Which statement best matches the chapter?",
        [
          "Traits describe risk, not fate",
          "Labels should be made as global as possible",
          "Weakness becomes manageable only after it disappears",
          "Environment matters less for vulnerable people",
        ],
        0
      ),
      question(
        "ch08-q09",
        "What is the practical balance this chapter recommends?",
        [
          "Deny real tendencies completely",
          "Admit real tendencies while refusing to surrender to them",
          "Accept every habit as authentic",
          "Focus only on motivation",
        ],
        1
      ),
      question(
        "ch08-q10",
        "When is a label actually useful?",
        [
          "When it gives a satisfying explanation even if agency shrinks",
          "When it leads to better design and better action",
          "When it sounds psychologically deep",
          "When it removes responsibility",
        ],
        1
      ),
    ],
  }),
  chapter({
    chapterId: "ch09-values-into-time",
    number: 9,
    title: "Put Values On The Calendar",
    readingTimeMinutes: 16,
    summary: {
      p1: t(
        "Putting values on the calendar means giving your priorities actual time instead of admiring them abstractly.",
        "Eyal argues that values stay sentimental until they are translated into scheduled commitments for work, self care, and relationships.",
        "The calendar becomes the place where intention stops being vague and starts becoming measurable."
      ),
      p2: t(
        "This matters because people often say something is important while giving it only leftover attention.",
        "A calendar exposes that gap and makes it easier to protect what really matters before the day fills with reactive demands.",
        "The deeper lesson is that time is the most honest expression of priority. Values become credible when they survive scheduling, not when they sound noble."
      ),
    },
    standardBullets: [
      bullet(
        "Values need time to become real. What matters in theory still loses if it never receives a place in the day.",
        "This is why the calendar is not a mere logistics tool in the book. It is a values tool.",
        "Time is where priorities become visible.",
        "A value without time attached to it is easy to praise and easy to postpone."
      ),
      bullet(
        "Start with domains that matter. Eyal pushes readers to think about time for self, work, and relationships rather than only career output.",
        "That keeps the system from rewarding one area while starving the others.",
        "A fuller values view produces a healthier calendar.",
        "It also prevents distraction work from hiding behind the excuse that everything important must be professional."
      ),
      bullet(
        "Use the calendar proactively. Decide in advance what deserves space before other claims arrive.",
        "Reactive scheduling usually means somebody else's agenda filled the empty slots first.",
        "Predecision therefore protects meaning as well as efficiency.",
        "Open space can be useful, but unowned space is easy prey for distraction."
      ),
      bullet(
        "Scheduled rest still counts. Recovery is part of a values based life when it is chosen intentionally.",
        "This matters because many people either overschedule work or let rest become accidental drift.",
        "Intentional recovery protects both honesty and sustainability.",
        "The goal is not maximal output. It is aligned use of time."
      ),
      bullet(
        "A calendar reveals tradeoffs. When everything cannot fit, the schedule forces you to see what you are truly choosing.",
        "That honesty can feel uncomfortable, but it is useful.",
        "Real priorities become clearer when they cost something.",
        "The calendar is valuable partly because it makes wishful thinking harder."
      ),
      bullet(
        "Protect important blocks early. Time that matters most should not rely only on whatever energy happens to remain.",
        "This is especially important for cognitively demanding or emotionally meaningful activities.",
        "Prime hours deserve deliberate assignment.",
        "Leftover time is where many stated priorities quietly go to die."
      ),
      bullet(
        "Buffers make the calendar livable. A values based schedule still needs enough room for transition and reality.",
        "Without buffer, the plan becomes brittle and easier to abandon.",
        "Good calendars respect human movement, not just ideal efficiency.",
        "Flexibility works better when it is designed in than when it appears as constant collapse."
      ),
      bullet(
        "Review and revise honestly. The calendar is a working document, not a sacred artifact.",
        "The goal is to learn whether your time allocation matches your stated values in practice.",
        "Regular review keeps the schedule alive and credible.",
        "Without review, a calendar can become a decorative promise instead of a guidance tool."
      ),
      bullet(
        "Relationships deserve planned time too. People rarely get your best attention by accident.",
        "Scheduling connection is not robotic when life is crowded. It is often caring realism.",
        "If the relationship matters, the time should show it.",
        "Unscheduled care is often vulnerable to constant deferral."
      ),
      bullet(
        "The calendar is a mirror, not a performance. Its job is to reveal and support alignment, not to impress anyone.",
        "That is why honest use of it matters more than perfect looking use of it.",
        "A realistic schedule that reflects values is better than an idealized one that collapses daily.",
        "The chapter makes time visible so attention can stop pretending."
      ),
    ],
    deeperBullets: [
      bullet(
        "Many people use stated values to comfort themselves while their calendars tell a different story. The chapter removes that protective distance.",
        "This can feel harsh, but it is also freeing.",
        "Once the gap is visible, it can finally be addressed."
      ),
      bullet(
        "A calendar can uncover hidden hierarchy. What you always protect first may reveal priorities you never intended to make dominant.",
        "That insight is useful even when it is unwelcome.",
        "Time often exposes power structures inside a life."
      ),
      bullet(
        "Values based scheduling is not rigidity. It is deliberate authorship followed by honest adaptation.",
        "The deeper mistake is thinking the alternative to chaos is inflexibility.",
        "A reviewed calendar can be both committed and humane."
      ),
      bullet(
        "Unsurfaced tradeoffs create resentment. When time is never consciously allocated, work, health, and relationships often end up competing in confused ways.",
        "Explicit scheduling reduces some of that hidden conflict.",
        "The calendar becomes a coordination tool inside your own life."
      ),
      bullet(
        "Time is the sharpest anti fantasy tool in the book. It forces abstract intentions to become finite choices.",
        "That is why this chapter sits near the center of the method.",
        "Once values meet limited hours, self deception has less room to hide."
      ),
    ],
    takeaways: [
      "Values need time",
      "Schedule self work and relationships",
      "Planned rest still counts",
      "The calendar reveals tradeoffs",
      "Buffer makes plans livable",
      "Review keeps alignment honest",
    ],
    practice: [
      "Block time for one value you usually leave abstract",
      "Add intentional recovery time instead of accidental drift",
      "Protect one high energy block for meaningful work",
      "Add one relationship block to your calendar",
      "Review where your last week contradicted your stated priorities",
    ],
    examples: [
      example(
        "ch09-ex01",
        "Study goals with no time assigned",
        ["school"],
        "A student says grades matter this term, but the only things on her calendar are classes and social events, so studying happens only when nothing else wins.",
        [
          "Put real study blocks on the calendar before the week begins.",
          "Treat those blocks as the time expression of the value, not as optional leftovers."
        ],
        "This matters because values without time stay fragile. The calendar turns importance into something that can actually be defended."
      ),
      example(
        "ch09-ex02",
        "Club leader neglects recovery",
        ["school"],
        "A student organizer schedules meetings and deadlines but never plans sleep, exercise, or quiet time, then starts calling burnout commitment.",
        [
          "Put recovery on the calendar as part of the value structure rather than as an afterthought.",
          "Use the schedule to support both performance and sustainability."
        ],
        "The chapter matters because self care is not outside the method. It is one of the domains that should become visible in time."
      ),
      example(
        "ch09-ex03",
        "Important project always gets leftovers",
        ["work"],
        "An employee says the strategic project is the top priority, but it never appears on the calendar and keeps getting squeezed out by reactive work.",
        [
          "Place the project in protected time instead of trusting it to survive the cracks of the day.",
          "Use the calendar to prove the priority, not just to describe it."
        ],
        "This shows why values and time have to meet. If the schedule does not protect the stated priority, the statement is not yet operational."
      ),
      example(
        "ch09-ex04",
        "Manager says family matters but never plans for it",
        ["work"],
        "A manager keeps telling his team and family that home life matters, yet every evening is left open for whatever work expands into it.",
        [
          "Schedule the relationship time before the workday grows around it.",
          "Use buffers and boundaries so the plan can survive real life."
        ],
        "The lesson is that values do not compete fairly with endless work unless time is deliberately assigned to them."
      ),
      example(
        "ch09-ex05",
        "Exercise valued but never scheduled",
        ["personal"],
        "Someone genuinely values health, but because workouts are never on the calendar, they get replaced by easier tasks almost every week.",
        [
          "Translate the value into a specific recurring block rather than a general wish.",
          "Choose a time with the best odds of protection."
        ],
        "The chapter makes the gap visible between saying health matters and using time as if it does."
      ),
      example(
        "ch09-ex06",
        "Friendships reduced to spare moments",
        ["personal"],
        "A person misses old friends and says connection matters, but social time now happens only if every other obligation is somehow finished first.",
        [
          "Put friendship on the calendar in a real and recurring way.",
          "Treat planned connection as traction rather than as something that must wait for perfection elsewhere."
        ],
        "This matters because relationships rarely thrive on leftover attention. Time is often the clearest form of care."
      ),
    ],
    questions: [
      question(
        "ch09-q01",
        "Why does the chapter insist on putting values on the calendar?",
        [
          "Because time is where priorities become visible and defensible",
          "Because values matter only at work",
          "Because calendars guarantee perfect follow through",
          "Because important things should stay flexible and undefined",
        ],
        0
      ),
      question(
        "ch09-q02",
        "What does the calendar reveal that intention alone can hide?",
        [
          "Tradeoffs between what you say matters and what actually gets time",
          "Which tasks are emotionally easy",
          "Which tools are most distracting",
          "Whether you naturally like structure",
        ],
        0
      ),
      question(
        "ch09-q03",
        "How does the chapter treat planned rest?",
        [
          "As distraction no matter what",
          "As traction when it is intentional and aligned with recovery",
          "As something that should never be scheduled",
          "As less important than every work task",
        ],
        1
      ),
      question(
        "ch09-q04",
        "Why protect important blocks early in the day or week?",
        [
          "Because meaningful work should not depend only on leftover time and energy",
          "Because reactive tasks are always useless",
          "Because buffers become unnecessary",
          "Because rest should happen only after everything else",
        ],
        0
      ),
      question(
        "ch09-q05",
        "What role do buffers play in a values based schedule?",
        [
          "They make the schedule more realistic and less brittle",
          "They signal weak commitment",
          "They remove all need for boundaries",
          "They matter only for managers",
        ],
        0
      ),
      question(
        "ch09-q06",
        "A person says family matters most, but never schedules time with family. What would this chapter say?",
        [
          "The value is real because it was stated clearly",
          "The calendar is currently telling a different story than the stated value",
          "Relationships should never be scheduled",
          "Work naturally deserves all remaining time",
        ],
        1
      ),
      question(
        "ch09-q07",
        "Why should self, work, and relationships all appear in the schedule?",
        [
          "So one domain does not quietly consume the others by default",
          "Because every domain deserves equal time every day",
          "Because values are best handled separately from time",
          "Because work blocks should be minimized",
        ],
        0
      ),
      question(
        "ch09-q08",
        "What makes the calendar a mirror rather than a performance?",
        [
          "Its job is to reveal and support alignment, not to look impressive",
          "It should be shown to as many people as possible",
          "It only matters if it stays completely unchanged",
          "It works best as a private fantasy",
        ],
        0
      ),
      question(
        "ch09-q09",
        "Why review and revise the calendar regularly?",
        [
          "To learn whether actual time use matches stated values in practice",
          "To make the schedule more complex",
          "To avoid making tradeoffs explicit",
          "To keep every week identical",
        ],
        0
      ),
      question(
        "ch09-q10",
        "What is the deeper lesson of the chapter?",
        [
          "Priorities become credible when they survive finite scheduling decisions",
          "Good intentions are enough if they are sincere",
          "Values should stay abstract to remain pure",
          "Time matters less than mood",
        ],
        0
      ),
    ],
  }),
  chapter({
    chapterId: "ch10-control-inputs",
    number: 10,
    title: "Control Inputs More Than Outcomes",
    readingTimeMinutes: 12,
    summary: {
      p1: t(
        "Control inputs more than outcomes because the behavior you can actually schedule and repeat is more actionable than the result you hope will follow.",
        "Eyal wants readers to judge themselves by whether they followed the planned process, not by whether the world instantly produced the desired payoff.",
        "That shift reduces discouragement and keeps attention on what can truly be done next."
      ),
      p2: t(
        "This matters because outcome obsession often creates anxiety, avoidance, and false urgency.",
        "When you return to controllable inputs such as time spent, messages sent, pages drafted, or conversations initiated, progress becomes steadier and less emotionally distorted.",
        "The deeper lesson is that disciplined attention depends on locus of control. People protect traction better when their scorecard is based on actions they can actually execute."
      ),
    },
    standardBullets: [
      bullet(
        "Outcomes are noisy. Results depend on many factors beyond your immediate control.",
        "That makes outcome based self judgment emotionally unstable.",
        "A person can work well and still not get the instant result they wanted.",
        "If attention depends on immediate payoff, motivation becomes fragile."
      ),
      bullet(
        "Inputs are schedulable. You can place a behavior on a calendar even when you cannot guarantee the final outcome.",
        "This turns ambition into something actionable.",
        "The schedule can therefore protect process more reliably than it can promise results.",
        "Inputs give intention a concrete handle."
      ),
      bullet(
        "Outcome obsession breeds avoidance. Big results can feel so loaded that they make starting emotionally expensive.",
        "A manageable input lowers the emotional threshold for action.",
        "That is why process goals often improve follow through.",
        "The work feels possible when the target is behavior rather than destiny."
      ),
      bullet(
        "Good inputs compound. Repeated controllable actions create better odds over time even when any single attempt looks modest.",
        "This matters because people often quit between input and payoff.",
        "A process lens protects consistency during that lag.",
        "Delayed outcomes are easier to tolerate when the daily scorecard still says the day counted."
      ),
      bullet(
        "Inputs clarify what success looks like today. The question becomes what did I do, not only what happened.",
        "That gives the day a fairer and more usable standard.",
        "It also creates cleaner review because behaviors are easier to inspect than vague ambition.",
        "Specific input goals turn progress into something visible and coachable."
      ),
      bullet(
        "Use inputs across domains. Work, health, learning, and relationships all benefit from behaviors you can actually schedule.",
        "This keeps the chapter from being narrowly professional.",
        "A value becomes more durable when it is attached to a repeatable input.",
        "Attention follows what has been operationalized."
      ),
      bullet(
        "Do not use inputs to avoid truth. Good inputs should still point toward a meaningful outcome rather than becoming empty rituals.",
        "The process matters because it serves something real.",
        "That keeps the chapter balanced and honest.",
        "Controllable action is not the same as busywork."
      ),
      bullet(
        "Review the input quality, not only the quantity. Time spent matters, but so do effort, clarity, and consistency.",
        "A better process scorecard looks at whether the chosen behavior was actually performed well enough to count.",
        "This prevents the chapter from collapsing into box checking.",
        "Inputs help most when they stay connected to serious execution."
      ),
      bullet(
        "Inputs reduce emotional volatility. You can leave a day knowing whether you showed up, even if the full result is still pending.",
        "That steadier feedback helps attention remain more calm and repeatable.",
        "The method becomes less dependent on daily emotional weather.",
        "Reliable action grows when the scorecard stops swinging with every external signal."
      ),
      bullet(
        "The next step should stay controllable. When stuck, move the focus from hoped for result to chosen action.",
        "That shift restores agency quickly.",
        "It is one of the cleanest ways to keep traction alive under uncertainty.",
        "Process does not remove ambition. It gives ambition a viable daily form."
      ),
    ],
    deeperBullets: [
      bullet(
        "Outcome thinking often hides ego and fear. People can become attached to what a result would say about them, which makes the work heavier than it needs to be.",
        "Inputs cut through some of that identity pressure.",
        "They return attention to behavior instead of self image."
      ),
      bullet(
        "A process scorecard protects long games. Many worthwhile efforts have delayed payoff and misleading short term signals.",
        "Input tracking keeps commitment alive through that quiet middle stretch.",
        "This is especially important for learning, relationships, and creative work."
      ),
      bullet(
        "Controllable does not mean trivial. Some of the most important inputs are difficult, uncomfortable, and effortful even though they are still within your power.",
        "That is why the chapter is about control, not ease.",
        "A good input can still be demanding."
      ),
      bullet(
        "Inputs can expose vague goals. If you cannot name the behaviors that would move the value forward, the goal may still be too abstract.",
        "The chapter therefore sharpens planning as well as motivation.",
        "Behavioral clarity is often the missing bridge."
      ),
      bullet(
        "Agency is emotionally stabilizing. People stay less distractible when they can keep returning to something concrete they can actually do.",
        "That is the hidden psychological payoff of the chapter.",
        "Inputs make effort feel less like hoping and more like acting."
      ),
    ],
    takeaways: [
      "Outcomes are noisy",
      "Inputs can be scheduled",
      "Process lowers avoidance",
      "Good inputs compound",
      "Quality matters as well as quantity",
      "Agency grows through controllable action",
    ],
    practice: [
      "Translate one outcome goal into a repeatable input",
      "Put that input on the calendar",
      "Review whether you did the behavior rather than only whether you got the result",
      "Check whether your input still serves a meaningful outcome",
      "Use controllable action when uncertainty rises",
    ],
    examples: [
      example(
        "ch10-ex01",
        "Obsessing over grade instead of study behavior",
        ["school"],
        "A student fixates on getting a top grade and keeps spiraling about the result, but has not defined a stable study process for the week.",
        [
          "Shift the focus from the grade alone to controllable study inputs such as review blocks, practice problems, and office hour questions.",
          "Judge the week first by whether those behaviors happened."
        ],
        "This matters because outcomes can motivate, but inputs are what can actually be scheduled and repeated under pressure."
      ),
      example(
        "ch10-ex02",
        "Trying to get elected without process",
        ["school"],
        "A student running for a campus role keeps worrying about the election result but has no consistent plan for conversations, outreach, or follow up.",
        [
          "Define the controllable outreach inputs that would make the campaign real.",
          "Use those as the daily scorecard instead of staring at the final outcome."
        ],
        "The chapter helps because outcome anxiety often becomes a substitute for meaningful action. Inputs convert hope into execution."
      ),
      example(
        "ch10-ex03",
        "Sales target creates paralysis",
        ["work"],
        "A salesperson becomes so anxious about hitting quota that she avoids calls and spends more time checking dashboards than talking to prospects.",
        [
          "Return to controllable inputs such as outreach blocks, follow ups, and qualified conversations.",
          "Measure the day by those actions first."
        ],
        "This matters because outcome pressure can actually reduce the behavior most likely to improve the result. Inputs restore agency."
      ),
      example(
        "ch10-ex04",
        "Manager wants team trust instantly",
        ["work"],
        "A new manager wants the team to trust him quickly and feels frustrated that the outcome is not immediate.",
        [
          "Shift attention toward controllable behaviors such as clear communication, reliable follow through, and regular one on ones.",
          "Let the trust result emerge from repeated inputs."
        ],
        "The lesson is that many important outcomes arrive slowly. Attention stays steadier when behavior, not impatience, guides the process."
      ),
      example(
        "ch10-ex05",
        "Health goal judged only by scale changes",
        ["personal"],
        "Someone says they want better health but judges every week only by the scale, which makes one disappointing number feel like failure.",
        [
          "Score the week by controllable behaviors such as meals prepared, walks taken, and sleep protected.",
          "Use the outcome as information, not as the only verdict."
        ],
        "This example shows why outcomes can distort motivation. Inputs keep the effort attached to something workable."
      ),
      example(
        "ch10-ex06",
        "Friendship goal with no actions behind it",
        ["personal"],
        "A person wants deeper friendships but keeps waiting for closeness to happen rather than planning calls, invitations, or regular contact.",
        [
          "Turn the wish into inputs you can actually do, such as one outreach block or one planned meet up each week.",
          "Judge yourself by the follow through on those behaviors."
        ],
        "The chapter matters because even relational goals improve when they are translated into actions you can choose directly."
      ),
    ],
    questions: [
      question(
        "ch10-q01",
        "Why does the chapter favor inputs over outcomes as a daily guide?",
        [
          "Because outcomes never matter",
          "Because inputs are the actions you can actually schedule and execute",
          "Because results should be ignored entirely",
          "Because inputs are always easy",
        ],
        1
      ),
      question(
        "ch10-q02",
        "How can outcome obsession make distraction worse?",
        [
          "It can create anxiety that makes starting feel harder",
          "It removes all emotional investment",
          "It makes process easier to define",
          "It matters only for competitive people",
        ],
        0
      ),
      question(
        "ch10-q03",
        "Which option best reflects the chapter's advice?",
        [
          "Judge a writing week only by whether the final piece was praised",
          "Schedule the writing sessions you can control and review whether you showed up to them",
          "Wait for a clear external result before building a process",
          "Replace all ambition with habit tracking",
        ],
        1
      ),
      question(
        "ch10-q04",
        "What is one major advantage of a process scorecard?",
        [
          "It gives a fairer and steadier standard for daily review",
          "It guarantees outcomes quickly",
          "It makes quality irrelevant",
          "It works only for solo work",
        ],
        0
      ),
      question(
        "ch10-q05",
        "Why do good inputs compound?",
        [
          "Repeated controllable actions improve the odds over time even when payoff is delayed",
          "Because one attempt is enough",
          "Because outcomes become unnecessary",
          "Because repetition always removes difficulty",
        ],
        0
      ),
      question(
        "ch10-q06",
        "How should this chapter treat relationships or health goals?",
        [
          "As too personal for scheduled inputs",
          "As areas that also benefit from controllable, repeatable behaviors",
          "As outcomes only",
          "As domains where process does not matter",
        ],
        1
      ),
      question(
        "ch10-q07",
        "What is the risk of a bad input scorecard?",
        [
          "It may become empty ritual if the behaviors no longer serve a real outcome",
          "It becomes too emotional",
          "It tracks outcomes too carefully",
          "It removes all need for planning",
        ],
        0
      ),
      question(
        "ch10-q08",
        "Why should input review include quality, not just quantity?",
        [
          "Because box checking without serious execution can still miss the point",
          "Because quantity is never useful",
          "Because quality cannot be judged",
          "Because inputs should stay vague",
        ],
        0
      ),
      question(
        "ch10-q09",
        "What does the chapter recommend when uncertainty spikes?",
        [
          "Return to the next controllable action",
          "Stop acting until results are clearer",
          "Increase checking behavior",
          "Focus only on the final payoff",
        ],
        0
      ),
      question(
        "ch10-q10",
        "What is the deeper psychological benefit of focusing on inputs?",
        [
          "It gives attention a steadier sense of agency",
          "It makes every effort feel pleasant",
          "It eliminates delayed results",
          "It prevents all disappointment",
        ],
        0
      ),
    ],
  }),
  chapter({
    chapterId: "ch05-deal-with-inner-distraction",
    number: 5,
    title: "Work With Internal Triggers",
    readingTimeMinutes: 13,
    summary: {
      p1: t(
        "Working with internal triggers means noticing uncomfortable feelings without automatically letting them decide what you do next.",
        "Eyal shifts the goal from suppressing emotion to responding to it more skillfully, so the urge loses some of its authority.",
        "The point is not emotional numbness. It is creating enough awareness to choose rather than react."
      ),
      p2: t(
        "This matters because internal triggers do not disappear just because you wish they would.",
        "When you learn to meet them with curiosity, patience, and a small pause, distraction stops feeling so inevitable.",
        "The deeper lesson is that self regulation begins before the visible behavior. It begins in the moment you stop treating every feeling like a command."
      ),
    },
    standardBullets: [
      bullet(
        "An internal trigger is a signal, not an order. Feeling an urge does not require obeying it.",
        "That distinction is basic but powerful because many distractions feel automatic only because the gap is unseen.",
        "Once the feeling is treated as data, choice starts to reappear.",
        "A person becomes less captive to the urge when they stop confusing its presence with its authority."
      ),
      bullet(
        "Pause before responding. Even a short delay can interrupt the speed of the habit loop.",
        "The pause matters because it keeps the feeling from becoming behavior without reflection.",
        "This is where many later tactics get their opening.",
        "Without a pause, most good intentions never get enough time to enter the scene."
      ),
      bullet(
        "Describe the feeling precisely. Specific language makes the trigger easier to work with than a blur of vague discomfort.",
        "Words like anxious, resentful, lonely, restless, or embarrassed reveal more than simply saying bad.",
        "Precision creates leverage because different feelings call for different responses.",
        "It also breaks the illusion that the discomfort is one huge force with no shape."
      ),
      bullet(
        "Ask what need the urge is serving. Many impulses are clumsy attempts to regulate attention, certainty, status, or connection.",
        "That question exposes the logic inside the habit instead of treating it as random weakness.",
        "Once the need is clearer, the response can become more intelligent.",
        "Some urges are trying to protect you, but they are using a poor method."
      ),
      bullet(
        "Swap self accusation for curiosity. Harsh judgment often makes the trigger stronger, not smaller.",
        "Curiosity keeps the mind open long enough to learn what is happening.",
        "That is why gentler awareness can produce firmer behavior than shame can.",
        "You do not need to approve of the urge in order to study it accurately."
      ),
      bullet(
        "Give yourself a small waiting window. A brief delay weakens the feeling that the urge must be satisfied now.",
        "This can be as simple as waiting a few minutes before checking, switching, or reacting.",
        "The delay helps because urges often peak and soften faster than they promise.",
        "Waiting turns inevitability into something testable."
      ),
      bullet(
        "Choose the response in advance when possible. A preselected action is easier to follow than an improvised one under stress.",
        "The mind is less persuasive when it meets a script you already trusted earlier.",
        "This is one reason routines and rules can be so helpful.",
        "Planning the response before the trigger arrives reduces the power of in the moment bargaining."
      ),
      bullet(
        "Use short recovery rituals. A breath, note, stretch, or reset can absorb some discomfort without sending you fully off course.",
        "The ritual is useful because it acknowledges the feeling while still protecting the plan.",
        "That makes it different from a disguised exit.",
        "Good rituals help the nervous system settle without handing control to distraction."
      ),
      bullet(
        "Track recurring patterns. Internal triggers are easier to handle when you know when and where they tend to appear.",
        "A pattern might show up at a certain hour, around a certain person, or during a certain kind of task.",
        "Pattern recognition lets you prepare instead of being surprised every time.",
        "Repeated triggers often look random until someone studies the context closely enough."
      ),
      bullet(
        "Mastery starts with noticing sooner. Earlier awareness gives you more room to respond intelligently.",
        "You do not need perfect control to improve. You need earlier contact with the moment of drift.",
        "That is how inner work becomes practical rather than mystical.",
        "The chapter's promise is modest but powerful: catch the trigger earlier and the odds start to change."
      ),
    ],
    deeperBullets: [
      bullet(
        "Loneliness, resentment, and insecurity deserve the same attention as boredom and stress. Some of the strongest triggers are social and identity based.",
        "That is why focus problems often appear in relationships and status situations too.",
        "A narrow view of triggers misses many of the moments when distraction feels emotionally protective."
      ),
      bullet(
        "The first interpretation often exaggerates the urge. Thoughts such as I need this now or I cannot focus like this are part of the trigger experience, not neutral facts.",
        "Working with triggers includes noticing the story attached to the sensation.",
        "That story is often what makes a passing feeling sound absolute."
      ),
      bullet(
        "Prepared alternatives should actually fit the need. A reset ritual works better when it addresses the real discomfort instead of pretending it does not exist.",
        "For example, uncertainty may need a smaller next step while loneliness may need contact rather than more scrolling.",
        "This is where emotional honesty improves practical design."
      ),
      bullet(
        "Some triggers reveal a structural issue. If the same internal trigger appears constantly, the task, relationship, or environment may need redesign rather than endless endurance.",
        "The chapter does not ask you to tolerate everything forever.",
        "It asks you to distinguish between a moment to endure and a pattern that deserves repair."
      ),
      bullet(
        "Earlier awareness changes identity over time. When you repeatedly see a trigger without obeying it, you begin to trust yourself more.",
        "That trust is one of the hidden rewards of the practice.",
        "Indistractability grows not only from control, but from the evidence that you can face an urge and stay intact."
      ),
    ],
    takeaways: [
      "Urges are signals not orders",
      "Pause creates room to choose",
      "Specific labels help",
      "Curiosity beats self attack",
      "Delays weaken urgency",
      "Patterns make triggers manageable",
    ],
    practice: [
      "Pause for one short breath before obeying a common urge",
      "Name one trigger with more precision than stressed or bad",
      "Test a small waiting window before switching tasks",
      "Write down one recurring trigger pattern you notice",
      "Choose one reset ritual that keeps you with the plan",
    ],
    examples: [
      example(
        "ch05-ex01",
        "Restless study urge",
        ["school"],
        "A student feels restless five minutes into studying and reaches for her phone so quickly that the move feels almost invisible.",
        [
          "Create a short pause and label the feeling before touching the phone.",
          "Use that small gap to decide whether the urge needs attention or only recognition."
        ],
        "This matters because earlier awareness is what makes choice possible. If the trigger stays invisible, the habit keeps feeling automatic."
      ),
      example(
        "ch05-ex02",
        "Class presentation anxiety",
        ["school"],
        "Before practicing a presentation, a student suddenly feels the urge to reorganize slides again because practicing out loud makes him feel exposed.",
        [
          "Name the trigger as anxiety about judgment rather than pretending the slides are still the main issue.",
          "Use one small recovery ritual and then practice one section out loud."
        ],
        "The chapter helps because it asks what the urge is serving. In this case the extra editing is protecting him from exposure, not improving the talk much."
      ),
      example(
        "ch05-ex03",
        "Stress response to a hard report",
        ["work"],
        "An employee opens a difficult report, feels tension in her chest, and immediately looks for easier tasks to prove the morning is still productive.",
        [
          "Pause long enough to label the tension and admit that escape is what the easier task is offering.",
          "Use a small waiting window before switching."
        ],
        "This matters because the internal trigger arrives before the visible distraction. Working with that earlier moment changes the whole sequence."
      ),
      example(
        "ch05-ex04",
        "Manager reacts to criticism with constant checking",
        ["work"],
        "After receiving tough feedback, a manager keeps reopening the message thread and checking team reactions because the discomfort of uncertainty feels hard to sit with.",
        [
          "Recognize the trigger as insecurity and uncertainty instead of calling the checking useful review.",
          "Use a reset ritual and decide on one concrete next action."
        ],
        "The chapter applies here because some distractions are attempts to soothe status threat. The better move begins with naming that feeling honestly."
      ),
      example(
        "ch05-ex05",
        "Argument avoided by impulse shopping",
        ["personal"],
        "After tension with a family member, someone opens shopping apps and starts browsing even though buying anything was never the goal.",
        [
          "Pause and ask what the urge is trying to provide, such as relief, control, or numbness.",
          "Choose a response that addresses the real feeling more directly."
        ],
        "The point is not simply to stop shopping. It is to see the emotional job the browsing is trying to do."
      ),
      example(
        "ch05-ex06",
        "Sunday dread becomes random cleaning",
        ["personal"],
        "A person feels uneasy about the coming week and spends the evening doing scattered chores instead of the one planned task that would actually reduce Monday stress.",
        [
          "Label the feeling as dread or uncertainty and notice how the chores are functioning as escape.",
          "Use a small waiting window, then start the planned task with one concrete first step."
        ],
        "This example shows how internal triggers can make respectable looking detours attractive. Earlier notice gives the plan a chance to survive."
      ),
    ],
    questions: [
      question(
        "ch05-q01",
        "What is the most useful way to think about an internal trigger?",
        [
          "As proof that the plan should be abandoned",
          "As a signal that can be noticed without immediately obeying it",
          "As something that matters only when technology is involved",
          "As a random event with no pattern",
        ],
        1
      ),
      question(
        "ch05-q02",
        "Why is a short pause so important?",
        [
          "It creates a small gap between feeling and action",
          "It guarantees the urge will disappear",
          "It makes planning unnecessary",
          "It works only for mild triggers",
        ],
        0
      ),
      question(
        "ch05-q03",
        "Which response best fits the chapter?",
        [
          "Judge yourself quickly so the urge feels expensive",
          "Describe the feeling more precisely before deciding what to do",
          "Ignore the feeling and hope it fades",
          "Switch tasks before the discomfort grows",
        ],
        1
      ),
      question(
        "ch05-q04",
        "A student keeps editing slides instead of practicing because practicing feels exposing. What is the key insight?",
        [
          "The slides always need more work",
          "Exposure discomfort is driving the substitute behavior",
          "Practice should wait until confidence feels perfect",
          "The best response is more pressure",
        ],
        1
      ),
      question(
        "ch05-q05",
        "Why does curiosity help more than self accusation here?",
        [
          "Curiosity keeps the mind open long enough to learn what the trigger is doing",
          "Curiosity removes all discomfort right away",
          "Curiosity makes patterns less visible",
          "Curiosity only matters for personal life",
        ],
        0
      ),
      question(
        "ch05-q06",
        "What does a small waiting window test?",
        [
          "Whether the urge truly must be obeyed right now",
          "Whether the person is naturally disciplined",
          "Whether planning should be abandoned",
          "Whether the task is enjoyable enough",
        ],
        0
      ),
      question(
        "ch05-q07",
        "Why is tracking recurring trigger patterns useful?",
        [
          "It helps you prepare for them instead of being surprised each time",
          "It proves the triggers are permanent",
          "It makes emotional skill unnecessary",
          "It matters only for severe habits",
        ],
        0
      ),
      question(
        "ch05-q08",
        "What is the value of choosing a response in advance?",
        [
          "It gives the urge more time to bargain",
          "It makes the in the moment decision less dependent on stress",
          "It replaces the need to notice the feeling",
          "It works only when the environment is perfect",
        ],
        1
      ),
      question(
        "ch05-q09",
        "How should a reset ritual function?",
        [
          "As a disguised exit from the task",
          "As a way to acknowledge the feeling while protecting the plan",
          "As a reward after giving in to distraction",
          "As a punishment for drifting",
        ],
        1
      ),
      question(
        "ch05-q10",
        "What changes first when someone starts mastering internal triggers?",
        [
          "The triggers disappear permanently",
          "They stop feeling anything difficult",
          "They notice the trigger earlier and gain more room to respond",
          "They no longer need external structure",
        ],
        2
      ),
    ],
  }),
];

function reportBook(bookPackage) {
  const chapters = [...bookPackage.chapters].sort((left, right) => left.number - right.number);
  const lines = [];

  lines.push("# 1. Book audit summary for Indistractable — Nir Eyal", "");
  AUDIT_SUMMARY.forEach((paragraph) => lines.push(sentence(paragraph), ""));

  lines.push("# 2. Main content problems found", "");
  MAIN_PROBLEMS.forEach((paragraph, index) => lines.push(`${index + 1}. ${sentence(paragraph)}`));
  lines.push("");

  lines.push("# 3. Personalization strategy for Indistractable — Nir Eyal", "");
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
    chapter.quiz.questions.forEach((questionItem, index) => {
      const correctIndex = questionItem.correctAnswerIndex ?? questionItem.correctIndex ?? 0;
      lines.push(`${index + 1}. ${sentence(questionItem.prompt)}`);
      questionItem.choices.forEach((choice, choiceIndex) => {
        lines.push(`${String.fromCharCode(65 + choiceIndex)}. ${sentence(choice)}`);
      });
      lines.push(`Correct answer: ${String.fromCharCode(65 + correctIndex)}`);
      if (questionItem.explanation) {
        lines.push(`Explanation: ${sentence(questionItem.explanation)}`);
      }
      lines.push("");
    });
  });

  lines.push("# 6. Final quality control summary", "");
  lines.push("1. Every chapter now has exactly two summary paragraphs in each depth variant.");
  lines.push("2. Every chapter now has seven Simple bullets, ten Standard bullets, and fifteen Deeper bullets.");
  lines.push("3. Every chapter now has six scenarios with two school, two work, and two personal examples.");
  lines.push("4. The generic summary template, recycled scenario pattern, and predictable quiz shells were replaced across the whole book.");
  lines.push("5. The package remains schema compatible while the reader adds a book specific Indistractable motivation layer.");
  lines.push("6. The result now reads as one designed learning experience instead of a stitched set of generated blocks.");
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
      for (const item of variant.takeaways || []) {
        if (/[–—-]/.test(item)) violations.push(`chapter ${chapter.number} takeaway`);
      }
      for (const item of variant.practice || []) {
        if (/[–—-]/.test(item)) violations.push(`chapter ${chapter.number} practice`);
      }
    }

    for (const exampleItem of chapter.examples) {
      if (/[–—-]/.test(exampleItem.title)) violations.push(`chapter ${chapter.number} example title`);
      if (/[–—-]/.test(exampleItem.scenario)) violations.push(`chapter ${chapter.number} example scenario`);
      if (/[–—-]/.test(exampleItem.whyItMatters)) violations.push(`chapter ${chapter.number} example why`);
      for (const step of exampleItem.whatToDo) {
        if (/[–—-]/.test(step)) violations.push(`chapter ${chapter.number} example step`);
      }
    }

    for (const questionItem of chapter.quiz.questions || []) {
      if (/[–—-]/.test(questionItem.prompt)) violations.push(`chapter ${chapter.number} quiz prompt`);
      if (questionItem.explanation && /[–—-]/.test(questionItem.explanation)) {
        violations.push(`chapter ${chapter.number} quiz explanation`);
      }
      for (const choice of questionItem.choices || []) {
        if (/[–—-]/.test(choice)) violations.push(`chapter ${chapter.number} quiz choice`);
      }
    }
  }

  if (violations.length) {
    throw new Error(`Dash violation found: ${violations[0]}`);
  }
}

function verifyExamples(examples, chapterNumber) {
  const counts = { school: 0, work: 0, personal: 0 };
  for (const ex of examples) {
    const scope = ex.contexts?.[0];
    if (scope !== "school" && scope !== "work" && scope !== "personal") {
      throw new Error(`Chapter ${chapterNumber} has invalid example context.`);
    }
    counts[scope] += 1;
  }
  if (counts.school !== 2 || counts.work !== 2 || counts.personal !== 2) {
    throw new Error(`Chapter ${chapterNumber} must have 2 school, 2 work, and 2 personal examples.`);
  }
}

function verifyChapterShape(revised) {
  const easy = revised.contentVariants.easy.summaryBlocks;
  const medium = revised.contentVariants.medium.summaryBlocks;
  const hard = revised.contentVariants.hard.summaryBlocks;
  const countBullets = (blocks) => blocks.filter((item) => item.type === "bullet").length;
  const countParagraphs = (blocks) => blocks.filter((item) => item.type === "paragraph").length;
  if (countParagraphs(easy) !== 2 || countParagraphs(medium) !== 2 || countParagraphs(hard) !== 2) {
    throw new Error(`Chapter ${revised.number} must have exactly 2 paragraphs in each mode.`);
  }
  if (countBullets(easy) !== 7 || countBullets(medium) !== 10 || countBullets(hard) !== 15) {
    throw new Error(`Chapter ${revised.number} has incorrect bullet counts.`);
  }
}

function buildPackage() {
  const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
  const chapterMap = new Map(CHAPTER_REVISIONS.map((item) => [item.number, item]));

  pkg.createdAt = new Date().toISOString();
  pkg.packageId = randomUUID();
  pkg.chapters = pkg.chapters.map((chapterItem) => {
    const revised = chapterMap.get(chapterItem.number);
    if (!revised) {
      throw new Error(`Missing revision for chapter ${chapterItem.number}`);
    }
    verifyExamples(revised.examples, chapterItem.number);
    verifyChapterShape(revised);
    return revised;
  });

  assertNoDashContent(pkg);

  writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + "\n");
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, reportBook(pkg));
  console.log(`Updated ${packagePath}`);
  console.log(`Wrote ${reportPath}`);
}

buildPackage();
