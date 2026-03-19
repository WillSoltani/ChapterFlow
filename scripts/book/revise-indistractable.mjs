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

const question = (questionId, prompt, choices, correctIndex, explanation) => ({
  questionId,
  prompt: sanitizePrompt(prompt),
  choices,
  correctIndex,
  explanation,
});

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
