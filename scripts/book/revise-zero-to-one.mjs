import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";

const packagePath = resolve(process.cwd(), "book-packages/zero-to-one.modern.json");
const reportPath = resolve(process.cwd(), "notes/zero-to-one-revision-report.md");

const SIMPLE_INDEXES = [0, 1, 2, 4, 5, 7, 9];

const b = (text, detail) => ({ type: "bullet", text, detail });

const ex = (exampleId, title, scope, scenario, whatToDo, whyItMatters) => ({
  exampleId,
  title,
  contexts: [scope],
  scenario,
  whatToDo: Array.isArray(whatToDo) ? whatToDo : [whatToDo],
  whyItMatters,
});

const q = (questionId, prompt, choices, correctIndex, explanation) => ({
  questionId,
  prompt: sanitizePrompt(prompt),
  choices,
  correctIndex,
  explanation,
});

function sanitizePrompt(value) {
  return String(value)
    .replace(/\bthis chapter\b/gi, "the reading")
    .replace(/\bthe chapter\b/gi, "the reading")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

function sentence(value) {
  const text = cleanText(value);
  if (!text) return "";
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function renderBullet(block) {
  return `${block.text} ${block.detail}`;
}

function buildVariant(paragraphs, bullets, takeaways, practice) {
  return {
    importantSummary: paragraphs.map((paragraph) => sentence(paragraph)).join(" "),
    summaryBlocks: [
      ...paragraphs.map((text) => ({ type: "paragraph", text: sentence(text) })),
      ...bullets.map((item) => ({
        type: "bullet",
        text: sentence(item.text),
        detail: sentence(item.detail),
      })),
    ],
    summaryBullets: bullets.map((item) => sentence(item.text)),
    takeaways: takeaways.map((item) => cleanText(item)),
    keyTakeaways: takeaways.slice(0, 3).map((item) => cleanText(item)),
    practice: practice.map((item) => cleanText(item)),
  };
}

function buildChapter(definition) {
  const simpleBullets = SIMPLE_INDEXES.map((index) => definition.standardBullets[index]);
  const deeperBullets = [
    ...definition.standardBullets.slice(0, 9),
    ...definition.deeperExtras,
    definition.standardBullets[9],
  ];

  return {
    chapterId: definition.chapterId,
    number: definition.number,
    title: definition.title,
    readingTimeMinutes: definition.readingTimeMinutes,
    contentVariants: {
      easy: buildVariant(
        definition.summary.simple,
        simpleBullets,
        definition.takeaways,
        definition.practice
      ),
      medium: buildVariant(
        definition.summary.standard,
        definition.standardBullets,
        definition.takeaways,
        definition.practice
      ),
      hard: buildVariant(
        definition.summary.deeper,
        deeperBullets,
        definition.takeaways,
        definition.practice
      ),
    },
    examples: definition.examples.map((item) => ({
      ...item,
      scenario: sentence(item.scenario),
      whatToDo: item.whatToDo.map((step) => sentence(step)),
      whyItMatters: sentence(item.whyItMatters),
    })),
    quiz: {
      passingScorePercent: 80,
      questions: definition.quiz.map((item) => ({
        ...item,
        prompt: sentence(item.prompt),
        choices: item.choices.map((choice) => sentence(choice)),
        explanation: sentence(item.explanation),
      })),
    },
  };
}

const AUDIT_SUMMARY = [
  "The existing Zero to One package was structurally complete enough to render, but not close to publication quality. The summaries repeated the same mechanical framing across chapters, the examples recycled the same six situations book wide, and the quizzes mostly tested slogan recall instead of real understanding.",
  "Depth variation was also out of spec. Simple only had six bullets and Deeper only had fourteen, while the actual prose difference across modes was too shallow to feel like a premium reading choice. Switching depth changed the count slightly, but rarely changed the quality of thought.",
  "Fidelity was uneven. Several chapter titles were modernized in ways that blurred the original argument, and many explanations flattened Thiel's worldview into generic advice about originality, execution, or confidence. That weakened the book's distinctive logic about monopoly, power laws, secrets, foundations, and definite planning.",
  "This revision replaces the book chapter by chapter. The goal was to keep the existing platform shape, restore the real logic of Zero to One, add believable transfer scenarios, build applied quizzes, and make depth plus motivation feel meaningfully authored instead of mechanically decorated.",
];

const MAIN_PROBLEMS = [
  "Summaries were formulaic, repetitive, and often started with generic framing instead of the chapter's real claim.",
  "Bullets overlapped heavily across chapters and did not produce a real Simple, Standard, Deeper ladder of understanding.",
  "All fourteen chapters reused the same six scenarios, which made transfer feel fake and disconnected from the actual lesson.",
  "Quiz prompts followed a stock template and the answer sets often turned the right choice into a copied slogan instead of a judgment test.",
  "Several chapters drifted away from Thiel's real reasoning by sounding like generic startup motivation rather than a specific argument about strategy and company building.",
  "Motivation personalization for this book fell back to the generic reader layer, so Gentle, Direct, and Competitive did not feel tailored to Thiel's sharper logic about leverage, planning, and differentiated value.",
];

const PERSONALIZATION_STRATEGY = [
  "Depth remains the authored content axis. Simple gives a clean, fast read with seven bullets. Standard gives the strongest default lesson with ten bullets. Deeper adds five genuine extensions about tradeoffs, second order effects, and hidden logic instead of repeating the same claims at greater length.",
  "Motivation is handled as a focused guidance layer in the reader rather than by storing nine duplicated versions of every chapter. The core meaning stays stable while the summary framing, scenario guidance, recap, and quiz explanations shift to feel Gentle, Direct, or Competitive in a way that fits Zero to One.",
  "Gentle for this book keeps the writing calm while still respecting hard strategic truth. Direct makes the edge, tradeoff, and execution demand explicit. Competitive emphasizes leverage, missed advantage, and the cost of entering crowded games when that framing naturally fits the argument.",
  "This keeps the schema lean, preserves compatibility, and still gives users a meaningful nine path experience across reading depth and motivation style.",
];

const SCHEMA_NOTE =
  "No package schema change was required. The revision stays inside the current JSON structure. Depth is authored directly in the package, and motivation is strengthened through a Zero to One specific reader layer rather than nine duplicated full packages.";

const CHAPTERS = [
  {
    chapterId: "ch01-future-and-progress",
    number: 1,
    title: "The Challenge of the Future",
    readingTimeMinutes: 14,
    summary: {
      simple: [
        "The future depends on creating something new, not just repeating what already works. Thiel calls that move from zero to one, and he treats it as the real source of progress.",
        "This matters because growth can look impressive while still avoiding invention. The chapter pushes readers to ask whether they are adding a new capability or only spreading an old pattern wider.",
      ],
      standard: [
        "The future is shaped by two kinds of progress. Horizontal progress means copying something that already works and taking it to more places, while vertical progress means creating a new solution that did not exist before.",
        "Thiel cares more about vertical progress because copying eventually runs into limits, while invention changes what people can do. The chapter matters because it trains builders to ask whether they are entering an existing race or changing the game itself.",
      ],
      deeper: [
        "The future depends on zero to one progress because a richer world cannot be built forever by repeating old formulas. Thiel distinguishes horizontal progress, which spreads existing ideas, from vertical progress, which adds a new capability and changes what is possible.",
        "The deeper lesson is that societies drift when they confuse activity with invention. A founder, student, or operator who learns to ask where true novelty could come from starts seeing opportunities that a purely comparative mindset never notices.",
      ],
    },
    standardBullets: [
      b(
        "Name the two kinds of progress. Horizontal progress spreads an existing model, while vertical progress creates a new one.",
        "That distinction stops you from mistaking replication for invention."
      ),
      b(
        "Global reach is not the same as innovation. Taking a proven system to more users can help, but it does not automatically create a new capability.",
        "The book wants you to notice when scale is useful and when it is only extension."
      ),
      b(
        "Technology means any better way to do things. Thiel uses the term broadly, not just for software.",
        "A tool, process, or product counts if it lets people do more with less."
      ),
      b(
        "A busy economy can still be stagnant. More activity, more competition, and more capital do not prove that new value is being created.",
        "Motion is easy to celebrate, but progress is the harder standard."
      ),
      b(
        "Creation is harder because there is no script. Copying comes with benchmarks and examples, but genuine novelty requires independent judgment.",
        "That is why zero to one work feels riskier and lonelier at first."
      ),
      b(
        "Practical question first. Ask whether your project adds a real new capability or merely joins an existing pattern.",
        "That simple test keeps effort aimed at originality instead of reflex imitation."
      ),
      b(
        "Scaling without insight hits limits. If anyone can copy the same model, margins fall and differentiation disappears.",
        "New creation is what gives a project room to matter over time."
      ),
      b(
        "Small breakthroughs can matter a lot. A real advance does not need to remake the whole world on day one.",
        "It only needs to unlock something that was not previously possible."
      ),
      b(
        "Do not outsource the future to momentum. If you assume progress will happen on its own, you stop taking responsibility for building it.",
        "Passive optimism sounds comfortable but usually produces stale outcomes."
      ),
      b(
        "The future is made, not inherited. Better outcomes come from people who treat the present as incomplete and worth improving.",
        "That closing insight sets the tone for the whole book."
      ),
    ],
    deeperExtras: [
      b(
        "Copying often hides behind respectable language. People call it optimization, best practice, or execution discipline.",
        "Those things matter, but none of them replaces the harder work of insight."
      ),
      b(
        "Vertical progress changes the baseline for everyone after it appears. Once a breakthrough exists, later growth can build on it.",
        "That is why invention has outsized long term leverage."
      ),
      b(
        "Original work usually looks smaller at first. Early novelty can seem narrow because there is no familiar category for it yet.",
        "Builders need patience to judge potential before social proof arrives."
      ),
      b(
        "One to many still matters when it carries zero to one work further. Thiel is not dismissing scale.",
        "He is arguing that scale is strongest when it rests on a real breakthrough."
      ),
      b(
        "A culture that admires competition more than creation can become efficient and unimaginative at the same time.",
        "The chapter quietly asks what kind of ambition a society rewards."
      ),
    ],
    takeaways: [
      "Zero to one",
      "Horizontal versus vertical progress",
      "Technology as new capability",
      "Scale is not innovation",
      "Creation needs independent thought",
      "The future is built",
    ],
    practice: [
      "Ask what new capability your project creates",
      "List one place where you are copying by default",
    ],
    examples: [
      ex(
        "ch01-ex01",
        "Science fair copycat",
        "school",
        "A student notices that last year's winning science fair entries all used polished versions of familiar experiments. She is tempted to repeat one of them because the path looks safe.",
        [
          "Start by asking what question no one else in the room is trying to answer.",
          "Choose a project that creates even a small new insight instead of a cleaner version of an old display."
        ],
        "The point is not to be weird for its own sake. It is to notice that real learning and real progress begin when you stop treating existing options as final."
      ),
      ex(
        "ch01-ex02",
        "Campus app with nothing new",
        "school",
        "An entrepreneurship club wants to launch another campus marketplace because similar apps have raised money elsewhere. Nobody can explain what students on this campus still cannot do today.",
        [
          "Pause the build and write down the specific new capability the product would create.",
          "If the answer is only faster imitation, keep searching before you commit."
        ],
        "A copied idea can look exciting because the precedent is easy to point to. Thiel's standard is harder and more useful: what becomes possible if this exists?"
      ),
      ex(
        "ch01-ex03",
        "Feature sprint by imitation",
        "work",
        "A product team spends each quarter shipping whatever features the market leader released last quarter. The roadmap is full, but customers still struggle to explain why the product matters.",
        [
          "Separate defensive parity work from real invention work.",
          "Reserve time for one bet that creates a capability your customers cannot already get elsewhere."
        ],
        "Constant imitation can keep a team busy while slowly erasing its identity. New value is what creates strategic room."
      ),
      ex(
        "ch01-ex04",
        "Manual process nobody questions",
        "work",
        "An operations lead sees employees spending hours each week moving data between systems by hand because that is how the company has always worked.",
        [
          "Treat the old process as optional rather than sacred.",
          "Look for the smallest change that would remove the manual burden instead of accepting the repetition as normal."
        ],
        "Zero to one progress does not always look like a famous invention. Sometimes it begins when someone decides a stale workflow no longer deserves to exist."
      ),
      ex(
        "ch01-ex05",
        "Side project with no real edge",
        "personal",
        "A friend wants to start a weekend side hustle selling the same imported accessories already offered by dozens of local accounts. She likes the idea because the examples look easy to follow.",
        [
          "Ask what unmet need or original angle would make the project more than another listing page.",
          "If you cannot find one, redirect the energy toward a problem with less crowding."
        ],
        "Copying feels lower risk because the map already exists. The hidden cost is that everyone else can read the same map."
      ),
      ex(
        "ch01-ex06",
        "Career choice by trend alone",
        "personal",
        "Someone chooses a career path mainly because the field is growing fast and many peers are entering it. He has not asked what new thing he wants to help create.",
        [
          "Look past the trend and identify where your work could add something distinctive.",
          "Use growth as context, not as a substitute for original direction."
        ],
        "The chapter is not anti scale or anti growth. It simply says the future gets better when ambition points toward creation rather than crowded momentum."
      ),
    ],
    quiz: [
      q(
        "ch01-q01",
        "Which choice best matches the idea of going from zero to one?",
        [
          "Creating a new capability that did not exist before.",
          "Opening the same store format in more cities.",
          "Lowering price to match competitors faster.",
          "Copying a proven product with better marketing."
        ],
        0,
        "Zero to one means invention, not wider repetition of an existing model."
      ),
      q(
        "ch01-q02",
        "A founder says her company is innovative because it uses a common business model in a new country. What is the best response?",
        [
          "That may be useful expansion, but it is not automatically a new capability.",
          "Any geographic expansion counts as the highest form of innovation.",
          "Innovation only matters after a company becomes profitable.",
          "A copied model is stronger than an original one because risk is lower."
        ],
        0,
        "The chapter separates horizontal spread from vertical creation, even when both can create value."
      ),
      q(
        "ch01-q03",
        "Which team is thinking in the way Thiel prefers?",
        [
          "A team asking what important problem still lacks a real solution.",
          "A team asking which crowded category has the largest current spend.",
          "A team asking which competitor has the weakest recent marketing.",
          "A team asking how closely they can match the leader's feature list."
        ],
        0,
        "The book pushes builders toward unsolved problems and original capability, not toward crowded comparison."
      ),
      q(
        "ch01-q04",
        "Why does the chapter treat mere activity with suspicion?",
        [
          "Because a system can look energetic while adding very little new value.",
          "Because growth is always a sign of waste.",
          "Because technology removes the need for disciplined execution.",
          "Because invention only matters in software companies."
        ],
        0,
        "Thiel is warning that motion and expansion can hide a lack of real invention."
      ),
      q(
        "ch01-q05",
        "A student is deciding between polishing a familiar idea and testing a smaller original one. Which choice fits the argument best?",
        [
          "Test the smaller original idea if it creates a real new insight.",
          "Choose the familiar idea because novelty is usually a distraction.",
          "Pick whichever option looks easiest to explain to judges.",
          "Delay both options until a more popular topic appears."
        ],
        0,
        "A modest breakthrough is closer to zero to one thinking than a polished copy."
      ),
      q(
        "ch01-q06",
        "What does Thiel mean by technology in this opening argument?",
        [
          "Any better way of doing things that creates new capability.",
          "Only software and hardware products.",
          "Any process that cuts labor costs.",
          "Any scientific discovery whether useful or not."
        ],
        0,
        "He uses technology broadly to mean a better way to do more with less."
      ),
      q(
        "ch01-q07",
        "Which statement is most faithful to the relationship between invention and scale?",
        [
          "Scale matters most when it carries a genuine breakthrough further.",
          "Scale makes invention irrelevant once distribution is strong.",
          "Invention and scale are mutually exclusive choices.",
          "Scale always creates monopoly even without differentiation."
        ],
        0,
        "The book values scale, but treats it as strongest when it rests on real novelty."
      ),
      q(
        "ch01-q08",
        "A manager says progress will happen naturally if the team just stays busy. What is the hidden flaw?",
        [
          "Busyness can replace responsibility for making a better future on purpose.",
          "Busy teams never execute well.",
          "Progress only happens in startups.",
          "Predictability is worse than uncertainty."
        ],
        0,
        "The chapter rejects passive optimism and asks people to build deliberately."
      ),
      q(
        "ch01-q09",
        "Which project has the strongest zero to one quality?",
        [
          "A tool that solves a painful problem no one else has addressed well.",
          "A brand that copies a best seller with nicer packaging.",
          "A service that offers the same workflow at a slightly lower price.",
          "A marketplace that enters the most crowded category because demand is proven."
        ],
        0,
        "The best answer creates a new capability instead of joining a known pattern."
      ),
      q(
        "ch01-q10",
        "What is the deepest practical lesson of the opening argument?",
        [
          "Treat the present as unfinished and look for where creation could matter.",
          "Join the largest existing trend before it saturates.",
          "Assume innovation will come from other people and focus on execution only.",
          "Avoid original work unless there is immediate consensus behind it."
        ],
        0,
        "The opening chapter is really a demand for deliberate creation instead of passive imitation."
      ),
    ],
  },
  {
    chapterId: "ch02-party-and-contrarian-truth",
    number: 2,
    title: "Party Like It's 1999",
    readingTimeMinutes: 14,
    summary: {
      simple: [
        "Strong companies often begin with a true idea that most people do not yet accept. Thiel uses the dot com era to argue that consensus is usually a poor guide to breakthrough value.",
        "This matters because people often learn the wrong lessons from spectacular failures. The chapter teaches readers to look for truths that are both unpopular and grounded in reality, not merely fashionable or provocative."
      ],
      standard: [
        "Great ventures usually start with an important truth that few people agree with. Thiel uses the dot com crash to show how whole industries can swing from naive excess to equally naive caution, then mistake that caution for wisdom.",
        "The chapter matters because consensus thinking compresses ambition. If everyone already agrees with an idea, the strategic upside is usually limited. Builders need the harder skill of spotting a true insight before it becomes obvious."
      ],
      deeper: [
        "The most valuable starting point in business is often a contrarian truth, something important that is true but not yet widely believed. Thiel uses the aftermath of the dot com crash to show that public overcorrections can create a false common sense that blocks new creation.",
        "The deeper lesson is that disagreement alone is worthless. The useful question is why a smart crowd is wrong, what incentive or blind spot keeps the truth hidden, and how a company could turn that neglected truth into a real business."
      ],
    },
    standardBullets: [
      b(
        "Start with a true idea others miss. A strong company often begins where widespread agreement is weakest.",
        "If everyone already sees the same opportunity, most of the easy upside is gone."
      ),
      b(
        "Ask the contrarian question carefully. Thiel's test is simple: what important truth do few people agree with you on?",
        "The question forces you past clichés and into actual independent thought."
      ),
      b(
        "Consensus can be wrong in both directions. The dot com boom was reckless, but the reaction to it often became too timid.",
        "Public correction can create a new set of bad rules that feel wise only because they sound cautious."
      ),
      b(
        "Bad lessons can survive because they flatter fear. Incremental moves, endless flexibility, and safe imitation feel prudent after a bubble bursts.",
        "The chapter argues that these habits can quietly erase the boldness needed for real breakthroughs."
      ),
      b(
        "Good contrarian ideas are true, not theatrical. The goal is not to sound rebellious.",
        "The goal is to see something real before everyone else does."
      ),
      b(
        "Unpopular truth often points to neglected markets. The best opportunities may look too small, too strange, or too early to matter.",
        "That initial neglect is often part of the advantage."
      ),
      b(
        "If smart people all agree, ask what keeps them in line. Sometimes the barrier is social pressure, and sometimes it is bad incentive design.",
        "Either way, mispricing often lives inside consensus."
      ),
      b(
        "A contrarian insight needs a path to execution. A surprising belief only matters if it can support a company, product, or market position.",
        "Clever opinions without implementation are just conversation."
      ),
      b(
        "Look for the reason others are missing it. The best truth is not random. It stays hidden for a cause you can explain.",
        "That explanation makes the opportunity more usable and more durable."
      ),
      b(
        "Value often begins before agreement. The closing insight is that originality in business usually starts as reasoned disagreement with the crowd.",
        "Consensus comes later, often after the best returns have already been claimed."
      ),
    ],
    deeperExtras: [
      b(
        "The crowd can be wrong because status punishes deviation. People often prefer a respectable mistake to a lonely insight.",
        "That makes genuine contrarian thinking socially expensive, which is part of why it can be valuable."
      ),
      b(
        "Timing matters inside contrarian truth. An idea can be true too early to build on or true only after another constraint changes.",
        "The builder has to distinguish hidden truth from premature truth."
      ),
      b(
        "Some truths are technological and some are social. A market may be misread because of engineering limits or because people accept a stale story.",
        "Both kinds can produce opportunity if you see them clearly."
      ),
      b(
        "False contrarianism is easy to fake. Saying the opposite of the crowd proves nothing if the crowd is right.",
        "The hard part is holding both courage and evidence at the same time."
      ),
      b(
        "A company turns contrarian insight into durable advantage. Belief matters most when it changes what gets built, who joins, and which market gets pursued.",
        "Without that translation into action, the truth stays intellectually interesting but commercially unused."
      ),
    ],
    takeaways: [
      "Contrarian truth",
      "Consensus compresses upside",
      "Bad lessons can survive",
      "Disagreement needs evidence",
      "Explain why others miss it",
      "Insight must become execution",
    ],
    practice: [
      "Write one important truth you believe that most people dismiss",
      "Ask what keeps others from seeing it"
    ],
    examples: [
      ex(
        "ch02-ex01",
        "Unpopular project thesis",
        "school",
        "A student wants to research a topic the class considers unimportant because it seems too niche. The mainstream topics are safer, but they also sound identical.",
        [
          "Test whether the niche idea reveals something true that others are ignoring for lazy reasons.",
          "If it does, build the project around the real insight rather than following the crowded list."
        ],
        "A contrarian idea becomes useful when it rests on evidence, not ego. The gain comes from seeing what consensus has filtered out."
      ),
      ex(
        "ch02-ex02",
        "Campus startup nobody believes in",
        "school",
        "A student founder thinks international students have a painful paperwork problem that domestic students barely notice. Peers dismiss it because the affected group seems too small.",
        [
          "Talk directly with the overlooked users and confirm whether the pain is real and repeated.",
          "Use that evidence to decide whether the ignored problem is actually the better starting point."
        ],
        "Many opportunities look minor from the outside because most observers are not the people feeling the pain. Contrarian truth often starts with better contact with reality."
      ),
      ex(
        "ch02-ex03",
        "Rejected customer insight",
        "work",
        "A product manager believes a neglected customer segment is willing to pay for a simpler tool, but the team keeps chasing louder feature requests from existing power users.",
        [
          "Collect evidence that the ignored segment has a clear problem and a usable buying path.",
          "Frame the idea as a testable truth, not as a personality conflict with the team."
        ],
        "The chapter is not a license to romanticize every outsider view. It is a reminder that real edge often begins where consensus has stopped looking."
      ),
      ex(
        "ch02-ex04",
        "Company copies the accepted lesson",
        "work",
        "After a failed product launch, leadership decides the firm should never again take concentrated bets. Every new initiative becomes small, reversible, and strategically bland.",
        [
          "Ask whether the failure came from boldness itself or from a specific execution flaw.",
          "Do not let one public mistake harden into a permanent fear of conviction."
        ],
        "Overcorrection can become its own trap. The wrong lesson from failure can be more damaging than the original failure."
      ),
      ex(
        "ch02-ex05",
        "Career move that looks odd now",
        "personal",
        "Someone is drawn to an unfashionable industry because she sees a neglected change in customer behavior, but friends keep steering her toward more prestigious paths.",
        [
          "Clarify the truth you think others are missing and what evidence supports it.",
          "Make the choice based on the strength of the insight, not on whether the crowd finds it impressive."
        ],
        "Prestige can hide weak opportunity just as easily as niche status can hide strong opportunity. Independent thought matters because social approval is a poor filter for value."
      ),
      ex(
        "ch02-ex06",
        "Community problem everyone shrugs at",
        "personal",
        "A neighborhood keeps treating a recurring problem as normal because nobody expects it to be solvable. One resident thinks a small service could fix it, but the idea sounds too ordinary to get attention.",
        [
          "Ask whether the problem is tolerated because it is unsolved or because people have stopped imagining a solution.",
          "If the demand is real, treat the lack of excitement as information, not as disproof."
        ],
        "Secrets and contrarian truths often hide inside areas the crowd has mentally written off. The absence of enthusiasm can be part of the opening."
      ),
    ],
    quiz: [
      q(
        "ch02-q01",
        "What makes a contrarian idea valuable in Thiel's sense?",
        [
          "It is true and not yet widely believed.",
          "It sounds bold enough to attract attention.",
          "It rejects whatever the market leader is doing.",
          "It avoids all risk by staying highly flexible."
        ],
        0,
        "The standard is truth plus disagreement, not mere novelty or noise."
      ),
      q(
        "ch02-q02",
        "Why does the chapter revisit the dot com crash?",
        [
          "To show that public overreaction can create a new set of bad assumptions.",
          "To prove that all internet businesses were mistakes.",
          "To argue that timing never matters.",
          "To show that cautious consensus is usually correct."
        ],
        0,
        "Thiel uses the crash to show that a crowd can be wrong in boom and in backlash."
      ),
      q(
        "ch02-q03",
        "Which founder is using the contrarian question best?",
        [
          "A founder who can name a neglected truth, why others miss it, and how to build from it.",
          "A founder who opposes popular ideas on principle.",
          "A founder who waits until the whole market agrees.",
          "A founder who copies a proven model and calls it unique."
        ],
        0,
        "The strong answer ties disagreement to evidence and execution."
      ),
      q(
        "ch02-q04",
        "A team says, \"After one failure we should only pursue small reversible ideas.\" What is the most Thiel like response?",
        [
          "Be careful not to turn one failure into a permanent fear of conviction.",
          "That rule is wise because ambition is the main cause of failure.",
          "The only fix is to copy the current market leader.",
          "Large truths are irrelevant if the team feels uncertain."
        ],
        0,
        "The chapter warns that overcorrection can kill the very boldness needed for real breakthroughs."
      ),
      q(
        "ch02-q05",
        "Which statement about consensus is most faithful to the reading?",
        [
          "If everyone already agrees, the strategic upside is often smaller.",
          "Consensus is the best evidence that an idea will create monopoly.",
          "Consensus matters more than truth in early stage company building.",
          "Consensus protects founders from timing mistakes."
        ],
        0,
        "Wide agreement often means the opportunity has already been priced in."
      ),
      q(
        "ch02-q06",
        "What is missing from a merely theatrical contrarian claim?",
        [
          "A reason it is true and a path for using it.",
          "A large enough audience on social media.",
          "A dramatic rejection of all existing markets.",
          "A founder who refuses all criticism."
        ],
        0,
        "Disagreement alone is empty unless it rests on reality and can drive execution."
      ),
      q(
        "ch02-q07",
        "A student notices a painful problem among a small overlooked group. Friends say the group is too niche. Which choice best fits the chapter?",
        [
          "Investigate whether the pain is real and whether that neglected niche is the right place to start.",
          "Drop the idea because broad popularity must come first.",
          "Add flashy features so the idea looks bigger than it is.",
          "Wait until the crowd becomes interested before doing any research."
        ],
        0,
        "Small neglected groups can contain strong starting markets when the underlying truth is real."
      ),
      q(
        "ch02-q08",
        "Why does the chapter ask why others are missing the truth?",
        [
          "Because the reason it stays hidden often explains the size and durability of the opportunity.",
          "Because other people's mistakes do the execution work for you.",
          "Because every unpopular idea is a secret monopoly.",
          "Because customers prefer what experts dismiss."
        ],
        0,
        "The hidden cause matters because it tells you whether the opportunity is real or accidental."
      ),
      q(
        "ch02-q09",
        "Which response shows the weakest understanding of contrarian thinking?",
        [
          "I want a view that is true before I want one that sounds brave.",
          "I need to know why the crowd is missing this and how the business benefits.",
          "If the idea makes everyone uncomfortable, that alone proves it is strong.",
          "The insight has to become a product or market position to matter."
        ],
        2,
        "Discomfort alone proves nothing. The idea must be true, not merely unpopular."
      ),
      q(
        "ch02-q10",
        "What is the chapter's deepest strategic move?",
        [
          "Find a neglected truth before consensus captures the value around it.",
          "Use marketing to make a common idea feel original.",
          "Avoid all ideas that look risky or unproven.",
          "Treat flexibility as a substitute for conviction."
        ],
        0,
        "The opportunity is largest before the truth becomes common sense."
      ),
    ],
  },
  {
    chapterId: "ch03-happy-companies-and-monopoly",
    number: 3,
    title: "All Happy Companies Are Different",
    readingTimeMinutes: 15,
    summary: {
      simple: [
        "Great businesses become different enough that they escape commodity competition. Thiel argues that monopoly, in the creative sense, gives a company room to plan, invest, and endure.",
        "This matters because competition sounds healthy but often destroys profits and focus. The chapter teaches readers to look for businesses that are unique in a way others cannot easily copy."
      ],
      standard: [
        "Successful companies are different because each one has found a way to escape direct competition. Thiel uses monopoly to describe a business with real pricing power and meaningful differentiation, not a lazy incumbent protected by politics.",
        "The chapter matters because many founders romanticize competition when they should be avoiding it. If you cannot explain why your business is meaningfully different, you are probably building a commodity with thinner margins and weaker strategic options."
      ],
      deeper: [
        "Creative monopoly is Thiel's name for a company that solves a problem so well, and so distinctly, that it earns durable freedom from commodity rivalry. Every strong monopoly is unique because its edge comes from a particular combination of product, market, timing, and capability.",
        "The deeper lesson is that competition is often treated as proof of virtue when it is really a signal of weak differentiation. A builder who learns to seek unique value instead of crowded approval starts designing for durability rather than for constant reaction."
      ],
    },
    standardBullets: [
      b(
        "Creative monopoly is the goal. It means a business is distinct enough to avoid pure price competition.",
        "That gives the company room to invest, plan, and earn real profits."
      ),
      b(
        "Competition compresses value. When many firms offer the same thing, customers gain bargaining power and margins shrink.",
        "A crowded market may look active while quietly becoming unattractive."
      ),
      b(
        "Each strong business is different in its own way. There is no generic formula for monopoly.",
        "The source of escape must fit a specific market and problem."
      ),
      b(
        "Monopolists often understate how dominant they are. They define their market broadly so they look modest.",
        "That helps explain why strong businesses can hide in plain sight."
      ),
      b(
        "Perfect competition is a bad aspiration for builders. It leaves little room for profit, reinvestment, or strategic patience.",
        "What looks fair in theory can be punishing in practice."
      ),
      b(
        "Profit is not greed in this argument. It is the resource that lets a company keep building and improving.",
        "Without it, even a useful business stays fragile."
      ),
      b(
        "Differentiation must be meaningful, not cosmetic. A slightly nicer version of the same thing rarely changes market structure.",
        "Unique value has to alter customer choice in a durable way."
      ),
      b(
        "Crowded markets pull attention toward rivals. That makes it harder to think long term or build depth.",
        "The more a company fights over the same ground, the less it creates new ground."
      ),
      b(
        "Practical test. Ask why customers would still choose you if five close substitutes appear tomorrow.",
        "If the answer is weak, your position is probably weaker than it looks."
      ),
      b(
        "The best businesses are not the best fighters in a bad market. They are the ones that changed the market enough to stop fighting like everyone else.",
        "That is the chapter's closing standard."
      ),
    ],
    deeperExtras: [
      b(
        "Monopoly here is dynamic, not static. It is created through innovation rather than protected only by regulation or legacy power.",
        "That keeps the argument tied to building, not to rent seeking."
      ),
      b(
        "Customers can benefit when a company has room to invest deeply. The chapter does not praise exploitation.",
        "It praises the freedom to improve rather than live quarter to quarter."
      ),
      b(
        "Short term price wars often look customer friendly while weakening the product ecosystem over time.",
        "If no one can earn durable returns, no one can keep investing patiently."
      ),
      b(
        "True uniqueness is usually narrow before it is broad. The early market often looks too small to outsiders.",
        "That smallness can be a feature because it makes the escape from competition more realistic."
      ),
      b(
        "People often admire competition because it feels demanding. Thiel's harder standard is whether the effort creates durable value or only motion inside a crowded lane.",
        "The emotional appeal of rivalry can hide weak economics."
      ),
    ],
    takeaways: [
      "Creative monopoly",
      "Competition compresses margins",
      "Uniqueness beats rivalry",
      "Profit funds durability",
      "Cosmetic differentiation is weak",
      "Change the market",
    ],
    practice: [
      "Write why customers would choose you over five substitutes",
      "Name the source of real differentiation"
    ],
    examples: [
      ex(
        "ch03-ex01",
        "Tutoring service in a crowded lane",
        "school",
        "A student group wants to start another general tutoring program even though several campus options already offer the same subjects in the same way.",
        [
          "Look for a specific unmet need that existing groups do not solve well.",
          "If you cannot name one, do not confuse another competitor with a differentiated service."
        ],
        "The chapter is not telling you to avoid useful work. It is telling you that value rises when you stop entering markets where everyone looks interchangeable."
      ),
      ex(
        "ch03-ex02",
        "Club that copies every other club",
        "school",
        "A new student organization wants to recruit members by promising the same events and the same benefits every other leadership club already promises.",
        [
          "Define what experience or outcome your group offers that is meaningfully different.",
          "Build the club around that difference instead of around generic slogans."
        ],
        "If your audience cannot explain why you are distinct, you are already drifting toward commodity status."
      ),
      ex(
        "ch03-ex03",
        "Agency trapped in underpricing",
        "work",
        "A small agency keeps winning business only by charging slightly less than other agencies. The team is busy, but profits are thin and no one has time to improve the service.",
        [
          "Stop treating lower price as the main strategy and identify a capability clients cannot easily compare away.",
          "Use that difference to reposition the business rather than to keep racing downward."
        ],
        "Competition can keep revenue flowing while quietly making the business worse. Distinct value is what creates breathing room."
      ),
      ex(
        "ch03-ex04",
        "Feature list with no market power",
        "work",
        "A software company keeps matching every competitor feature and calls itself best in class, yet prospects still negotiate hard on price because the offers look nearly identical.",
        [
          "Find the problem you solve unusually well instead of building for parity alone.",
          "Make the product easier to choose for a reason other than small differences in price or polish."
        ],
        "Customers bargain hardest when they believe the alternatives are interchangeable. Monopoly begins where that belief breaks."
      ),
      ex(
        "ch03-ex05",
        "Online shop with no identity",
        "personal",
        "Someone opens an online store selling the same widely available items many similar accounts already promote. Every growth idea depends on paying for more visibility.",
        [
          "Ask what distinctive value would make customers seek you out instead of merely noticing you in a feed.",
          "If there is no strong answer, rethink the category before spending more money."
        ],
        "Attention is expensive when the offer is easy to replace. A better position comes from being chosen for a real reason."
      ),
      ex(
        "ch03-ex06",
        "Local service everyone can copy",
        "personal",
        "A friend wants to launch a local service with a business model that already has many look alike providers. She assumes hard work alone will separate her.",
        [
          "Respect the effort required, but also ask what durable difference the market will recognize.",
          "Choose a niche or capability that gives you room to matter instead of only room to hustle."
        ],
        "The book is not anti work. It is anti building something that rewards endless work without creating a stronger position."
      ),
    ],
    quiz: [
      q(
        "ch03-q01",
        "What is a creative monopoly in this argument?",
        [
          "A business with real differentiation and pricing power because it solves a problem in a distinctive way.",
          "Any large company with a famous brand.",
          "A firm protected from competition only by regulation.",
          "A business that cuts price below everyone else."
        ],
        0,
        "Thiel is describing monopoly created by unique value, not by simple size or political protection."
      ),
      q(
        "ch03-q02",
        "Why does the chapter treat perfect competition as unattractive for founders?",
        [
          "Because profits shrink and long term investment becomes harder.",
          "Because customers always lose in competitive markets.",
          "Because competition removes the need for product quality.",
          "Because monopoly can be built only in regulated industries."
        ],
        0,
        "In a commodity market, margins stay thin and strategic patience becomes difficult."
      ),
      q(
        "ch03-q03",
        "Which company is closest to the chapter's ideal?",
        [
          "A company customers would still choose if many substitutes appeared tomorrow.",
          "A company that wins mainly by being slightly cheaper.",
          "A company that copies the leader quickly and markets harder.",
          "A company that grows only when rivals make mistakes."
        ],
        0,
        "The best answer signals durable differentiation rather than reactive advantage."
      ),
      q(
        "ch03-q04",
        "A founder says, \"Competition proves our market is healthy.\" What is the hidden risk?",
        [
          "Crowding may show that no one has escaped commodity conditions.",
          "Healthy markets never include more than one company.",
          "Competition means customers do not value innovation.",
          "A healthy market guarantees monopoly later."
        ],
        0,
        "Crowding can be a sign that nobody has created enough distance from rivals."
      ),
      q(
        "ch03-q05",
        "Why might a strong monopoly define its market broadly in public?",
        [
          "To make its dominance look smaller and less threatening.",
          "Because broad markets always describe reality better.",
          "Because customers dislike niche positioning.",
          "Because differentiation disappears at scale."
        ],
        0,
        "Monopolists often present themselves as competing in a much larger field than the one they truly dominate."
      ),
      q(
        "ch03-q06",
        "Which statement best captures the relationship between profit and value here?",
        [
          "Profit gives a company the ability to keep improving and planning long term.",
          "Profit is separate from product quality and strategic strength.",
          "Profit matters only after monopoly is guaranteed by law.",
          "Profit comes mainly from copying the biggest market."
        ],
        0,
        "Thiel treats profit as the fuel for durability, not just as a vanity metric."
      ),
      q(
        "ch03-q07",
        "A business has a polished product but customers still compare it only on price. What does that suggest?",
        [
          "Its differentiation is probably cosmetic rather than structural.",
          "Its monopoly is already secure.",
          "Its market is too large to support pricing power.",
          "Its main problem is lack of competition."
        ],
        0,
        "If customers still see the offer as interchangeable, the business has not escaped commodity logic."
      ),
      q(
        "ch03-q08",
        "Why does the chapter say every strong company is different?",
        [
          "Because each durable edge comes from a particular combination of capabilities and market position.",
          "Because monopolies always operate in secret.",
          "Because each founder should ignore every existing business model.",
          "Because differentiation is mainly a branding issue."
        ],
        0,
        "There is no one size formula for creative monopoly."
      ),
      q(
        "ch03-q09",
        "Which move shows the strongest understanding of this chapter?",
        [
          "Narrowing to a market where you can become meaningfully distinct before expanding.",
          "Entering the largest crowded market because demand is already proven.",
          "Competing on price first and planning strategy later.",
          "Copying the leader until customers trust you."
        ],
        0,
        "The best route is to earn distinction in a place where it can actually hold."
      ),
      q(
        "ch03-q10",
        "What is the chapter's deepest strategic standard?",
        [
          "Do not become the best fighter in a bad market when you could build a better market position instead.",
          "Accept rivalry as the natural proof that your company matters.",
          "Treat attention as more important than pricing power.",
          "Assume all large markets reward the same strategy."
        ],
        0,
        "The strongest companies change the terms of competition rather than only surviving inside crowded ones."
      ),
    ],
  },
  {
    chapterId: "ch04-ideology-of-competition",
    number: 4,
    title: "The Ideology of Competition",
    readingTimeMinutes: 14,
    summary: {
      simple: [
        "Competition can become a trap when people start copying rivals instead of creating something distinct. Thiel argues that intense rivalry often narrows judgment rather than sharpening it.",
        "This matters because many people are trained to admire competition by default. The chapter shows that obsession with rivals can waste energy, erase differentiation, and pull smart people into bad markets."
      ],
      standard: [
        "Competition is not just a market condition in Zero to One. It is also an ideology that teaches people to treat rivalry as the natural path to excellence. Thiel argues that this mindset often pushes firms into imitation, escalation, and thin returns.",
        "The chapter matters because rivalry changes how people think. When founders define success mainly against peers, they stop asking whether the market itself is worth entering or whether a different path could create more value with less friction."
      ],
      deeper: [
        "The ideology of competition is dangerous because it turns rivalry into a moral good instead of a strategic problem. Thiel shows that people can become so fixated on winning against visible opponents that they lose sight of what they were trying to build in the first place.",
        "The deeper lesson is that competition often survives because it flatters ego and social status. A builder who learns to step outside inherited contests can recover imagination, avoid avoidable wars, and design for differentiated advantage instead of endless reaction."
      ],
    },
    standardBullets: [
      b(
        "Competition is often a symptom, not a goal. It usually means many players are chasing the same ground in similar ways.",
        "That is a warning sign about weak differentiation."
      ),
      b(
        "Rivalry narrows attention. The more you fixate on an opponent, the more likely you are to copy their priorities and miss larger possibilities.",
        "You begin reacting instead of designing."
      ),
      b(
        "People often admire competition because it feels demanding. It looks energetic, disciplined, and fair.",
        "But emotional respect for rivalry can hide poor economics."
      ),
      b(
        "Bad markets trap good effort. Smart people can work very hard inside conditions that never allow durable returns.",
        "Intensity is not proof that the game is worth playing."
      ),
      b(
        "Education trains people into comparison. Rankings, tests, and prestige ladders make rivalry feel normal long before business begins.",
        "That habit can carry into company building in harmful ways."
      ),
      b(
        "Direct competition encourages imitation. Once you watch rivals too closely, your roadmap starts to look like theirs.",
        "The very act of competing can erase the uniqueness you needed."
      ),
      b(
        "A broader view can reveal a better game. Many fights look mandatory only because the market was defined too narrowly.",
        "Changing the frame can open an escape from rivalry."
      ),
      b(
        "Practical check. Ask whether your next move creates difference or only answers a competitor.",
        "That question reveals whether strategy is being driven by value or by reaction."
      ),
      b(
        "You do not win by caring most. Many industries contain people who work obsessively and still destroy value for one another.",
        "Effort alone cannot rescue a structurally bad contest."
      ),
      b(
        "The strongest move is often to leave the war everyone else accepts. Real progress comes from building where rivalry has less power over your thinking.",
        "That is how originality survives."
      ),
    ],
    deeperExtras: [
      b(
        "Competition can create identity. People may cling to a rival because the rivalry tells them who they are.",
        "That makes bad contests emotionally sticky."
      ),
      b(
        "Markets and personal lives share this trap. Comparison can become a hidden organizer of ambition long before any company exists.",
        "The chapter matters because the habit of rivalry starts early."
      ),
      b(
        "Visible opponents are easier to think about than hidden opportunity. It feels simpler to answer a rival than to imagine a new category.",
        "That convenience is part of the trap."
      ),
      b(
        "Winning a crowded fight can still leave you weak. If the structure of the market stays bad, victory may only buy temporary relief.",
        "Strategic escape matters more than tactical superiority."
      ),
      b(
        "A company that stops worshipping rivalry regains attention for customers, product, and timing. That shift sounds soft, but it changes everything.",
        "Freed attention is one of the biggest gains from avoiding competition."
      ),
    ],
    takeaways: [
      "Competition is a warning sign",
      "Rivalry narrows judgment",
      "Effort cannot fix a bad market",
      "Comparison starts early",
      "Answer value not rivals",
      "Leave bad wars",
    ],
    practice: [
      "Write one way your strategy is reacting instead of differentiating",
      "Redefine the market from the customer view"
    ],
    examples: [
      ex(
        "ch04-ex01",
        "Debate team obsessed with one rival",
        "school",
        "A school debate team designs its whole season around beating one rival school. Practice topics, travel choices, and morale all start revolving around that opponent.",
        [
          "Refocus on the broader capabilities the team is trying to build, not only the rival's habits.",
          "Use the opponent as information, not as the team’s identity."
        ],
        "Once rivalry becomes the center of the mission, it starts choosing goals for you. The chapter warns against letting competition define the game."
      ),
      ex(
        "ch04-ex02",
        "Club that copies another club's every move",
        "school",
        "A student club keeps changing its events after another campus group announces something similar. Members feel active, but the group no longer has a clear direction of its own.",
        [
          "Stop adjusting around the other club's calendar and ask what your group uniquely serves.",
          "Build from that purpose even if the rival gets more attention in the short term."
        ],
        "Reaction can feel like strategy because it is immediate. The hidden cost is that imitation slowly replaces identity."
      ),
      ex(
        "ch04-ex03",
        "Pricing war at work",
        "work",
        "Two firms in the same local market keep undercutting each other for small contracts. Sales volume stays high, but margins vanish and the teams grow resentful.",
        [
          "Question whether this is a market worth fighting in on current terms.",
          "Look for a niche, capability, or customer segment where you can stop playing the same game."
        ],
        "Winning a bad fight is not the same as building a good business. Competition can trap disciplined people inside weak economics."
      ),
      ex(
        "ch04-ex04",
        "Roadmap driven by the market leader",
        "work",
        "A startup's weekly meeting begins with a review of what the market leader shipped. The team claims this keeps them sharp, but it now drives most product decisions.",
        [
          "Use competitors to inform awareness, not to dictate priorities.",
          "Rebuild the roadmap around the customer problem you want to own."
        ],
        "The more you organize around a rival, the easier it becomes to inherit the rival's assumptions and blind spots."
      ),
      ex(
        "ch04-ex05",
        "Fitness plan shaped by comparison",
        "personal",
        "Someone keeps changing workout plans because friends are progressing faster in different programs. He is working hard, but the constant comparison leaves him scattered.",
        [
          "Choose goals that fit your own body, schedule, and outcome instead of chasing someone else's race.",
          "Use comparison only as occasional information, not as the driver of your plan."
        ],
        "The chapter applies outside business because rivalry can quietly replace real purpose in any domain where people compare themselves constantly."
      ),
      ex(
        "ch04-ex06",
        "Side hustle launched only to beat a neighbor",
        "personal",
        "A friend starts a side hustle mainly because someone nearby is earning attention doing something similar. The desire to win the comparison becomes stronger than the reason to build.",
        [
          "Ask whether you would still want this project if there were no obvious rival to compare against.",
          "If the answer is weak, step back before rivalry chooses your commitment."
        ],
        "Competition feels motivating, but borrowed ambition is unstable. Thiel's point is to build from differentiated purpose, not from envy."
      ),
    ],
    quiz: [
      q(
        "ch04-q01",
        "What is the main strategic danger of intense competition?",
        [
          "It can narrow judgment and pull firms into imitation.",
          "It guarantees customers will stop caring.",
          "It makes growth impossible in every market.",
          "It removes the need for distribution."
        ],
        0,
        "The chapter argues that rivalry often distorts thinking before it destroys economics."
      ),
      q(
        "ch04-q02",
        "Why does Thiel call competition an ideology as well as a market condition?",
        [
          "Because people are trained to admire rivalry even when it leads them into bad games.",
          "Because law requires firms to compete in identical ways.",
          "Because monopolies always hide from public view.",
          "Because every competitor shares the same incentives."
        ],
        0,
        "The idea is cultural as much as economic. People can worship competition by default."
      ),
      q(
        "ch04-q03",
        "A team watches a rival so closely that its own roadmap starts to mirror the rival's. What has happened?",
        [
          "Competition has begun to erase the team's differentiation.",
          "The team has found the fastest path to monopoly.",
          "The team is proving that product quality does not matter.",
          "The team is wisely avoiding customer feedback."
        ],
        0,
        "The chapter says reactive rivalry often produces imitation rather than strategy."
      ),
      q(
        "ch04-q04",
        "Which response best fits this chapter when a market turns into a pricing war?",
        [
          "Question whether you should stay in that fight on those terms at all.",
          "Work harder than rivals and accept the structure as fixed.",
          "Assume the market will become attractive once everyone lowers price enough.",
          "Delay all strategic thinking until one competitor exits."
        ],
        0,
        "Effort matters, but Thiel wants builders to question the game itself."
      ),
      q(
        "ch04-q05",
        "Why is a broader market view strategically useful?",
        [
          "It can reveal ways to escape a narrow rivalry that once looked unavoidable.",
          "It guarantees customers will pay more.",
          "It proves competition is morally wrong.",
          "It removes the need for differentiation."
        ],
        0,
        "A better framing can show alternatives to head to head conflict."
      ),
      q(
        "ch04-q06",
        "What is the best practical check from this chapter?",
        [
          "Ask whether your next move creates difference or only answers a rival.",
          "Ask how quickly you can match the market leader on every feature.",
          "Ask whether the market is large enough to support many identical firms.",
          "Ask whether customers enjoy having many look alike options."
        ],
        0,
        "The question exposes whether strategy is being driven by value or by reaction."
      ),
      q(
        "ch04-q07",
        "Which statement shows the weakest understanding of the chapter?",
        [
          "If a contest is crowded and imitative, it may be wiser to leave the contest.",
          "Hard work in a bad market can still destroy value.",
          "Competition is automatically good because it pushes everyone to improve.",
          "Rivalry can become part of a person's identity."
        ],
        2,
        "The chapter specifically challenges the assumption that competition is healthy by default."
      ),
      q(
        "ch04-q08",
        "A founder says, \"We are serious because we are fighting hard.\" What important question is missing?",
        [
          "Is the fight itself worth entering or are we trapped in a bad market?",
          "Can we reduce product quality to save cash?",
          "Should we define ourselves entirely against one rival?",
          "Can we avoid building any unique capability?"
        ],
        0,
        "Intensity does not answer whether the underlying game is strategically attractive."
      ),
      q(
        "ch04-q09",
        "How does this chapter connect competition to originality?",
        [
          "Obsessive rivalry makes originality harder because it rewards imitation and reaction.",
          "Competition is the only reliable source of originality.",
          "Originality matters only after a company wins its category.",
          "Rivalry and originality are unrelated."
        ],
        0,
        "Once a company organizes around rivals, it becomes harder to build from first principles."
      ),
      q(
        "ch04-q10",
        "What is the deepest strategic move this chapter recommends?",
        [
          "Step outside inherited contests and build where rivalry has less power over your thinking.",
          "Try to become the most aggressive player in every crowded market.",
          "Use competition as the main proof that a category is attractive.",
          "Treat reaction speed as a substitute for differentiated strategy."
        ],
        0,
        "The strongest move is often to stop worshipping the war and design a better position."
      ),
    ],
  },
];

function renderReport(bookPackage) {
  const chapters = [...bookPackage.chapters].sort((left, right) => left.number - right.number);
  const lines = [];

  lines.push("# 1. Book audit summary for Zero to One by Peter Thiel", "");
  AUDIT_SUMMARY.forEach((paragraph) => lines.push(sentence(paragraph), ""));

  lines.push("# 2. Main content problems found", "");
  MAIN_PROBLEMS.forEach((paragraph, index) => lines.push(`${index + 1}. ${sentence(paragraph)}`));
  lines.push("");

  lines.push("# 3. Personalization strategy for Zero to One by Peter Thiel", "");
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
      const correctIndex = question.correctAnswerIndex ?? question.correctIndex ?? 0;
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
  lines.push("3. Every chapter now has exactly six scenarios with two school, two work, and two personal examples.");
  lines.push("4. Quiz questions now test applied understanding instead of stock slogan recall, and each question keeps four plausible choices.");
  lines.push("5. The book remains schema compatible while gaining a book specific motivation layer in the reader.");
  lines.push("6. The revised experience now reads as a complete lesson in each chapter: orientation, structured understanding, transfer, and understanding checks.");
  lines.push("");

  return lines.join("\n");
}

function assertNoDashContent(bookPackage) {
  const violations = [];

  for (const chapter of bookPackage.chapters) {
    if (/[–—-]/.test(chapter.title)) violations.push(`chapter ${chapter.number} title`);

    for (const variant of Object.values(chapter.contentVariants)) {
      for (const block of variant.summaryBlocks || []) {
        if (/[–—-]/.test(block.text)) violations.push(`chapter ${chapter.number} block text`);
        if (block.type === "bullet" && block.detail && /[–—-]/.test(block.detail)) {
          violations.push(`chapter ${chapter.number} block detail`);
        }
      }

      for (const item of [...(variant.takeaways || []), ...(variant.keyTakeaways || []), ...(variant.practice || [])]) {
        if (/[–—-]/.test(item)) violations.push(`chapter ${chapter.number} variant list`);
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

function assertStructure(bookPackage) {
  for (const chapter of bookPackage.chapters) {
    const easy = chapter.contentVariants.easy;
    const medium = chapter.contentVariants.medium;
    const hard = chapter.contentVariants.hard;

    const easyParagraphs = easy.summaryBlocks.filter((block) => block.type === "paragraph");
    const mediumParagraphs = medium.summaryBlocks.filter((block) => block.type === "paragraph");
    const hardParagraphs = hard.summaryBlocks.filter((block) => block.type === "paragraph");

    const easyBullets = easy.summaryBlocks.filter((block) => block.type === "bullet");
    const mediumBullets = medium.summaryBlocks.filter((block) => block.type === "bullet");
    const hardBullets = hard.summaryBlocks.filter((block) => block.type === "bullet");

    if (easyParagraphs.length !== 2) throw new Error(`Chapter ${chapter.number} easy paragraph count`);
    if (mediumParagraphs.length !== 2) throw new Error(`Chapter ${chapter.number} medium paragraph count`);
    if (hardParagraphs.length !== 2) throw new Error(`Chapter ${chapter.number} hard paragraph count`);
    if (easyBullets.length !== 7) throw new Error(`Chapter ${chapter.number} easy bullet count`);
    if (mediumBullets.length !== 10) throw new Error(`Chapter ${chapter.number} medium bullet count`);
    if (hardBullets.length !== 15) throw new Error(`Chapter ${chapter.number} hard bullet count`);

    const scopeCounts = chapter.examples.reduce(
      (counts, example) => {
        const scope = example.contexts?.[0] || "personal";
        counts[scope] = (counts[scope] || 0) + 1;
        return counts;
      },
      {}
    );

    if (chapter.examples.length !== 6) throw new Error(`Chapter ${chapter.number} example count`);
    if (scopeCounts.school !== 2 || scopeCounts.work !== 2 || scopeCounts.personal !== 2) {
      throw new Error(`Chapter ${chapter.number} scope distribution`);
    }

    if (chapter.quiz.questions.length !== 10) throw new Error(`Chapter ${chapter.number} quiz count`);
    for (const question of chapter.quiz.questions) {
      if (question.choices.length !== 4) {
        throw new Error(`Chapter ${chapter.number} question ${question.questionId} choice count`);
      }
      if (!Number.isInteger(question.correctIndex) || question.correctIndex < 0 || question.correctIndex > 3) {
        throw new Error(`Chapter ${chapter.number} question ${question.questionId} correct index`);
      }
    }
  }
}

const pkg = JSON.parse(readFileSync(packagePath, "utf8"));

pkg.createdAt = new Date().toISOString();
pkg.packageId = randomUUID();
pkg.book.title = "Zero to One";
pkg.book.author = "Peter Thiel, Blake Masters";
pkg.chapters = CHAPTERS.map(buildChapter);

assertStructure(pkg);
assertNoDashContent(pkg);

writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + "\n");

mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, renderReport(pkg));

console.log(`Updated ${packagePath}`);
console.log(`Wrote ${reportPath}`);
