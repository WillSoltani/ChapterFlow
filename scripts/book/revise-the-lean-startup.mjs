import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";

const packagePath = resolve(process.cwd(), "book-packages/the-lean-startup.modern.json");
const reportPath = resolve(process.cwd(), "notes/the-lean-startup-revision-report.md");

const SIMPLE_INDEXES = [0, 1, 2, 4, 6, 8, 9];

const AUDIT_SUMMARY = [
  "The existing The Lean Startup package was structurally complete on paper but editorially unreliable in practice. It had the right chapter count, the right surface fields, and the right basic flow, yet most of the prose was generic template writing that barely reflected Eric Ries's actual logic.",
  "The summaries often repeated the chapter title, inserted the same borrowed sentence patterns, and leaned on vague language about pressure and judgment instead of explaining uncertainty, experimentation, validated learning, innovation accounting, or the specific management problems Ries is trying to solve.",
  "The bullets were especially weak. Many chapters reused the same explanation paragraphs with only one sentence swapped, which made the lessons feel interchangeable. The scenarios and quizzes had the same problem, so the book stopped feeling like fourteen distinct lessons and started feeling like one template stretched across a business book.",
  "This revision therefore replaces the content book wide rather than polishing sentence fragments. The goal is a faithful, premium learning experience that keeps the current package shape, restores real depth variation, and gives The Lean Startup its own voice, logic, transfer, and motivation handling.",
];

const MAIN_PROBLEMS = [
  "The summaries were shallow, repetitive, and often failed to explain the true chapter argument.",
  "The bullets reused generic explanation text across chapters, which broke fidelity and made the lessons feel mechanically generated.",
  "The scenarios were mostly recycled patterns with thin chapter specific relevance.",
  "The quiz questions often tested wording recall or included obvious answers, and many explanations were missing.",
  "Depth variation was out of spec because the book used 6, 10, and 14 bullets instead of about 7, exactly 10, and exactly 15.",
  "Motivation personalization existed only as a generic reader layer, so this book did not yet have a tone strategy tailored to Ries's evidence driven worldview.",
  "The whole lesson flow lacked clear progression because summary, bullets, scenarios, and quiz often repeated the same surface statement rather than adding new value.",
];

const PERSONALIZATION_STRATEGY = [
  "Depth remains the authored content axis. Simple delivers quick understanding with seven bullets, Standard delivers the strongest general use lesson with ten bullets, and Deeper adds five genuinely richer insights about tradeoffs, hidden logic, organizational friction, and second order effects.",
  "Motivation stays as a lean guidance layer instead of nine duplicated full packages. The core meaning of each chapter remains stable, while the reader experience shifts through book specific summary framing, scenario guidance, recap language, and quiz explanation tone.",
  "Gentle for The Lean Startup emphasizes calm learning, patience with uncertainty, and honest adjustment without shame. Direct emphasizes disciplined decision making, clear standards, and early evidence. Competitive emphasizes edge, wasted motion, and the cost of letting weaker teams learn faster than you.",
  "This keeps the schema small while still making Simple, Standard, Deeper and Gentle, Direct, Competitive feel materially different for this particular book.",
];

const SCHEMA_NOTE =
  "No package schema expansion was required. The book revision stays inside the current JSON shape, and motivation personalization is upgraded through the existing reader level hook with Lean Startup specific copy instead of nine duplicated chapter files.";

const chapter = ({
  summary,
  standardBullets,
  deeperBullets,
  simpleIndexes = SIMPLE_INDEXES,
  takeaways,
  practice,
  examples,
  questions,
}) => ({
  summary,
  standardBullets,
  deeperBullets,
  simpleIndexes,
  takeaways,
  practice,
  examples,
  questions,
});

const t = (base, standard = "", deeper = "") => ({ base, standard, deeper });

const compose = (value, level) =>
  [value.base, level === "medium" || level === "hard" ? value.standard : "", level === "hard" ? value.deeper : ""]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

const bullet = (text, detail) => ({ text, detail });

const example = (scope, title, scenario, whatToDo, whyItMatters) => ({
  scope,
  title,
  scenario,
  whatToDo,
  whyItMatters,
});

const question = (prompt, correct, distractors, explanation) => ({
  prompt,
  correct,
  distractors,
  explanation,
});

function clean(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function sentence(value) {
  const text = clean(value);
  if (!text) return "";
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function rotate(values, by) {
  const shift = ((by % values.length) + values.length) % values.length;
  return values.map((_, index) => values[(index + shift) % values.length]);
}

function buildQuestion(questionDef, chapterNumber, index) {
  const ordered = [questionDef.correct, ...questionDef.distractors];
  const rotated = rotate(ordered, (chapterNumber + index) % 4);
  return {
    questionId: `ch${String(chapterNumber).padStart(2, "0")}-q${String(index + 1).padStart(2, "0")}`,
    prompt: clean(questionDef.prompt),
    choices: rotated.map((choice) => clean(choice)),
    correctAnswerIndex: rotated.indexOf(questionDef.correct),
    explanation: clean(questionDef.explanation),
  };
}

function buildSummaryBlocks(summary, bullets, level) {
  return [
    { type: "paragraph", text: clean(compose(summary.p1, level)) },
    { type: "paragraph", text: clean(compose(summary.p2, level)) },
    ...bullets.map((item) => ({
      type: "bullet",
      text: clean(item.text),
      detail: clean(item.detail),
    })),
  ];
}

function renderBullet(block) {
  return `${sentence(block.text)} ${sentence(block.detail)}`.trim();
}

function buildReport(bookPackage) {
  const chapters = [...bookPackage.chapters].sort((left, right) => left.number - right.number);
  const lines = [];

  lines.push("# 1. Book audit summary for The Lean Startup by Eric Ries", "");
  AUDIT_SUMMARY.forEach((paragraph) => lines.push(sentence(paragraph), ""));

  lines.push("# 2. Main content problems found", "");
  MAIN_PROBLEMS.forEach((paragraph, index) => lines.push(`${index + 1}. ${sentence(paragraph)}`));
  lines.push("");

  lines.push("# 3. Personalization strategy for The Lean Startup by Eric Ries", "");
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
    simpleBullets.forEach((block, index) => lines.push(`${index + 1}. ${renderBullet(block)}`));
    lines.push("");
    lines.push("#### Standard", "");
    standardBullets.forEach((block, index) => lines.push(`${index + 1}. ${renderBullet(block)}`));
    lines.push("");
    lines.push("#### Deeper", "");
    deeperBullets.forEach((block, index) => lines.push(`${index + 1}. ${renderBullet(block)}`));
    lines.push("");

    lines.push("### Scenarios", "");
    chapter.examples.forEach((entry, index) => {
      const scope = (entry.contexts?.[0] || "personal").toUpperCase();
      lines.push(`${index + 1}. ${entry.title} (${scope})`);
      lines.push(`Scenario: ${sentence(entry.scenario)}`);
      lines.push(`What to do: ${entry.whatToDo.map((step) => sentence(step)).join(" ")}`);
      lines.push(`Why it matters: ${sentence(entry.whyItMatters)}`);
      lines.push("");
    });

    lines.push("### Quiz", "");
    chapter.quiz.questions.forEach((entry, index) => {
      lines.push(`${index + 1}. ${sentence(entry.prompt)}`);
      entry.choices.forEach((choice, choiceIndex) => {
        lines.push(`${String.fromCharCode(65 + choiceIndex)}. ${sentence(choice)}`);
      });
      lines.push(`Correct answer: ${String.fromCharCode(65 + entry.correctAnswerIndex)}`);
      lines.push(`Explanation: ${sentence(entry.explanation)}`);
      lines.push("");
    });
  });

  lines.push("# 6. Final quality control summary", "");
  lines.push("1. Every chapter now has exactly two authored summary paragraphs in Simple, Standard, and Deeper.");
  lines.push("2. Bullet depth now matches the intended product shape with 7, 10, and 15 meaningful bullets.");
  lines.push("3. Every chapter now has exactly six scenarios with two school, two work, and two personal cases.");
  lines.push("4. Every chapter now has ten quiz questions with four answer choices, one clearly best answer, and explanations.");
  lines.push("5. The content stays inside the current package schema while the reader gains Lean Startup specific motivation guidance.");
  lines.push("6. The full book now reads as a guided lesson sequence instead of a repeated content template.");
  lines.push("");

  return lines.join("\n");
}

function assertNoDashContent(bookPackage) {
  const violations = [];

  const check = (value, label) => {
    if (/[–—-]/.test(value)) violations.push(label);
  };

  check(AUDIT_SUMMARY.join(" "), "audit summary");
  check(MAIN_PROBLEMS.join(" "), "main problems");
  check(PERSONALIZATION_STRATEGY.join(" "), "personalization strategy");
  check(SCHEMA_NOTE, "schema note");

  for (const chapter of bookPackage.chapters) {
    check(chapter.title, `chapter ${chapter.number} title`);

    for (const variant of Object.values(chapter.contentVariants)) {
      check((variant.takeaways || []).join(" "), `chapter ${chapter.number} takeaways`);
      check((variant.practice || []).join(" "), `chapter ${chapter.number} practice`);
      for (const block of variant.summaryBlocks || []) {
        check(block.text, `chapter ${chapter.number} block text`);
        if (block.type === "bullet") check(block.detail || "", `chapter ${chapter.number} block detail`);
      }
    }

    for (const entry of chapter.examples) {
      check(entry.title, `chapter ${chapter.number} example title`);
      check(entry.scenario, `chapter ${chapter.number} example scenario`);
      check(entry.whyItMatters, `chapter ${chapter.number} example why`);
      for (const step of entry.whatToDo) check(step, `chapter ${chapter.number} example step`);
    }

    for (const entry of chapter.quiz.questions) {
      check(entry.prompt, `chapter ${chapter.number} quiz prompt`);
      check(entry.explanation || "", `chapter ${chapter.number} quiz explanation`);
      entry.choices.forEach((choice) => check(choice, `chapter ${chapter.number} quiz choice`));
    }
  }

  if (violations.length) {
    throw new Error(`Dash violation found in ${violations[0]}`);
  }
}

function assertChapterStructure(bookPackage) {
  for (const chapter of bookPackage.chapters) {
    const easy = chapter.contentVariants.easy.summaryBlocks.filter((block) => block.type === "bullet");
    const medium = chapter.contentVariants.medium.summaryBlocks.filter((block) => block.type === "bullet");
    const hard = chapter.contentVariants.hard.summaryBlocks.filter((block) => block.type === "bullet");
    if (easy.length !== 7) throw new Error(`Chapter ${chapter.number} easy bullets ${easy.length}`);
    if (medium.length !== 10) throw new Error(`Chapter ${chapter.number} medium bullets ${medium.length}`);
    if (hard.length !== 15) throw new Error(`Chapter ${chapter.number} hard bullets ${hard.length}`);

    const scopes = chapter.examples.reduce(
      (counts, entry) => {
        const scope = entry.contexts?.[0] || "personal";
        counts[scope] = (counts[scope] || 0) + 1;
        return counts;
      },
      {}
    );

    if (chapter.examples.length !== 6) throw new Error(`Chapter ${chapter.number} examples ${chapter.examples.length}`);
    if (scopes.school !== 2 || scopes.work !== 2 || scopes.personal !== 2) {
      throw new Error(`Chapter ${chapter.number} example scopes invalid`);
    }

    if (chapter.quiz.questions.length !== 10) {
      throw new Error(`Chapter ${chapter.number} quiz questions ${chapter.quiz.questions.length}`);
    }

    for (const question of chapter.quiz.questions) {
      if (question.choices.length !== 4) throw new Error(`Chapter ${chapter.number} invalid choice count`);
      if (question.correctAnswerIndex < 0 || question.correctAnswerIndex > 3) {
        throw new Error(`Chapter ${chapter.number} invalid correct answer index`);
      }
    }
  }
}

const CHAPTER_CONTENT = {};

CHAPTER_CONTENT["ch01-startup-definition"] = chapter({
  summary: {
    p1: t(
      "A startup exists to create something new under conditions of extreme uncertainty. Eric Ries argues that this definition matters more than company size, industry, or office style because the real job is not routine execution. The real job is learning what customers need and how a new venture can survive.",
      "That is why entrepreneurship becomes a management problem, not just a personality trait. Startups still need discipline, but the discipline must fit uncertainty instead of pretending certainty already exists.",
      "The chapter also widens the category on purpose. A startup can live inside a garage company, a campus project, or a large enterprise division as long as the team is trying to build something new without a proven path."
    ),
    p2: t(
      "This matters because people often borrow the habits of stable businesses and then mistake motion for progress. Ries's deeper lesson is that uncertain work needs fast feedback, visible assumptions, and honest evidence, or else confidence and busyness hide waste.",
      "That logic applies far beyond tech founders. Whenever a team is trying to discover what should be built, old measures of performance can reward exactly the wrong behavior.",
      "What looks responsible in a mature business can become dangerous in a startup if it delays learning. Under uncertainty, certainty theater is often one of the costliest forms of waste."
    ),
  },
  standardBullets: [
    bullet(
      "Uncertainty changes the job. A startup is not defined by size but by the fact that it is creating something new without a reliable map.",
      "That means the team cannot judge itself by execution alone. It has to learn what reality will support before scale or polish mean much."
    ),
    bullet(
      "Newness matters more than labels. A project can feel corporate, academic, or informal and still face the same startup problem.",
      "If the path to customers, product fit, and sustainability is unclear, the work still belongs to the world Ries is describing."
    ),
    bullet(
      "Entrepreneurship is management. Ries rejects the myth that startups succeed by passion alone.",
      "Uncertainty does not remove the need for management. It changes what management must manage."
    ),
    bullet(
      "Learning is the real early output. The first responsibility is not to look finished. It is to discover what is true.",
      "That reframes early work from performance to evidence, which makes better decisions possible sooner."
    ),
    bullet(
      "Activity can hide waste. Teams can ship features, hold meetings, and work late while learning almost nothing important.",
      "Visible effort feels reassuring, but it can still delay the uncomfortable questions that actually matter."
    ),
    bullet(
      "Assumptions should be named. Hidden beliefs quietly control strategy until they are exposed and tested.",
      "Once assumptions become visible, the team can decide which ones deserve immediate proof and which ones are secondary."
    ),
    bullet(
      "Evidence beats confidence. A persuasive founder story is not the same thing as customer truth.",
      "Ries keeps pulling attention back to observed behavior because belief is cheap and correction is expensive when it arrives late."
    ),
    bullet(
      "Uncertainty needs systems, not chaos. The answer is not to improvise endlessly.",
      "The answer is to build feedback loops that make uncertain work more learnable and less political."
    ),
    bullet(
      "Large organizations face this too. New products inside established companies still need startup logic when the future is unknown.",
      "The chapter matters because many teams are punished for uncertainty instead of being taught how to manage it."
    ),
    bullet(
      "Honest definition creates the first advantage. Once a team admits it is operating under uncertainty, it can stop pretending the work is already understood.",
      "That closing shift is foundational for the whole book. Better judgment begins when the situation is named truthfully."
    ),
  ],
  deeperBullets: [
    bullet(
      "The chapter is also a warning about borrowed prestige. A mature looking process can feel safer than a learning process even when it produces worse decisions.",
      "People often import budgeting, forecasting, and planning rituals because they signal seriousness. Ries is asking whether those rituals are useful at this stage, not whether they look respectable."
    ),
    bullet(
      "The phrase human institution matters. A startup is not just an idea or a product concept. It is a social system making decisions under stress.",
      "That is why culture, incentives, reporting lines, and communication matter so early. Learning speed is shaped by the institution around the idea."
    ),
    bullet(
      "Waste begins before scale. Teams do not need a huge budget to waste months of effort.",
      "They only need the wrong assumptions plus a system that rewards appearing busy more than becoming correct."
    ),
    bullet(
      "Defining a startup this way makes failure easier to read. If the goal is learning under uncertainty, some early disappointments are signs of progress rather than collapse.",
      "The crucial question becomes what the team learned and how quickly it learned it, not whether every early guess turned out right."
    ),
    bullet(
      "Ries is quietly redefining professionalism. In uncertain work, professionalism means disciplined contact with reality, not polished certainty.",
      "That deeper standard runs through the rest of the book because it changes how progress, leadership, and accountability should be judged."
    ),
  ],
  takeaways: [
    "A startup exists under uncertainty",
    "Entrepreneurship is management",
    "Learning is early progress",
    "Activity can hide waste",
    "Assumptions must be visible",
    "Evidence matters most",
  ],
  practice: [
    "Write the three biggest unknowns",
    "Name one assumption behind the current plan",
    "Ask what evidence would change your mind",
    "Separate activity from actual learning",
    "Treat uncertainty as a management problem",
  ],
  examples: [
    example(
      "school",
      "Campus app nobody has asked for",
      "You and two classmates are building an app to help students trade lecture notes. Everyone is excited about design ideas, but nobody has checked whether students actually struggle with the current options or would trust a new system.",
      [
        "Pause the feature debate and list the unknowns that could make the whole project fail",
        "Talk to likely users before building more screens so you learn whether the problem is real"
      ],
      "The chapter matters here because the team is behaving as if the product is already understood. Naming the uncertainty first creates a better starting point."
    ),
    example(
      "school",
      "New club with no clear demand",
      "A student group wants to launch a paid peer tutoring program and starts planning flyers, pricing, and shifts before anyone knows which subjects students would actually pay for.",
      [
        "Treat the idea like uncertain work instead of a mini version of an established service",
        "Run a small demand check first so the club learns what students truly need"
      ],
      "This shows why startup thinking belongs in school life too. When the path is unclear, planning without learning mostly creates busywork."
    ),
    example(
      "work",
      "Internal product with executive pressure",
      "Your company created a small team to explore a new customer segment. Leadership keeps asking for launch dates and polished forecasts even though the team still does not know which problem matters most.",
      [
        "Reframe the work around the unknowns that must be resolved before a real forecast means anything",
        "Ask for success criteria tied to learning milestones instead of only calendar promises"
      ],
      "The hidden problem is not lack of effort. It is using mature business expectations on a problem that is still uncertain."
    ),
    example(
      "work",
      "Agency team chasing motion",
      "A consulting team is building a new analytics service and keeps adding dashboards because the client likes demos, but nobody can say which customer decision the service should improve.",
      [
        "Stop counting output as progress and identify what must be learned about customer value first",
        "Make the next piece of work answer one important uncertainty instead of adding more surface area"
      ],
      "This is a classic case of motion hiding weak learning. The chapter pushes teams to ask whether the work is reducing uncertainty or just looking productive."
    ),
    example(
      "personal",
      "Weekend business with assumed demand",
      "You want to start a meal prep side business and spend your evenings branding it, researching containers, and planning menus before checking whether local customers want your price point or delivery style.",
      [
        "List the unknowns that would decide whether this can work before perfecting the brand",
        "Use a small test to learn about demand and preferences before investing deeper"
      ],
      "Personal projects often feel safer when they are polished. Ries would say the safer move is faster learning, not prettier guessing."
    ),
    example(
      "personal",
      "Community project with fuzzy purpose",
      "You volunteer to organize a neighborhood tool sharing program, but everyone keeps proposing features and rules without agreeing on what problem the program is meant to solve.",
      [
        "Define the uncertain problem first so the group can stop treating opinions as settled facts",
        "Gather a little evidence from likely users before building a full system around assumptions"
      ],
      "The deeper lesson is that uncertainty belongs in the open. When a group acts as if unknowns are already resolved, waste grows quietly."
    ),
  ],
  questions: [
    question(
      "What best captures the kind of work a startup is doing at the beginning?",
      "It is trying to create something new under conditions of extreme uncertainty",
      [
        "It is mainly trying to execute a proven plan with more energy",
        "It is mainly trying to look polished enough to earn credibility",
        "It is mainly trying to imitate what mature businesses already do"
      ],
      "The chapter starts by defining a startup through uncertainty and newness, not through size, age, or style."
    ),
    question(
      "A student team keeps debating features for a new campus product before learning whether students have the problem at all. What is the strongest next move?",
      "Name the unknowns and gather evidence about the problem before building more",
      [
        "Keep building because visible progress will create momentum",
        "Wait until the product is complete and then ask for feedback",
        "Focus on branding first so the idea feels more credible"
      ],
      "The best answer treats early work as uncertain learning. It brings the real unknown to the surface before more effort is spent."
    ),
    question(
      "Why does Ries call entrepreneurship a form of management?",
      "Because uncertain work still needs systems for learning and decision making",
      [
        "Because founders should control every detail personally",
        "Because startups should copy the structures of large firms immediately",
        "Because management titles are more important than customer insight"
      ],
      "Ries is arguing against chaos, not against management. The system must manage uncertainty instead of pretending it is already gone."
    ),
    question(
      "Which result would count as better early progress for a new venture?",
      "The team learns which assumption is wrong and changes course quickly",
      [
        "The team works late for weeks and adds many features",
        "The team produces a detailed forecast with no customer evidence",
        "The team receives praise for how professional the deck looks"
      ],
      "Validated learning matters more than impressive activity because learning changes what the team should do next."
    ),
    question(
      "What hidden risk appears when a new initiative is judged with mature business habits too early?",
      "The team can optimize appearances while the real uncertainty stays untouched",
      [
        "The team will become too creative to manage",
        "The team will always lose interest in customers",
        "The team will avoid every form of planning forever"
      ],
      "The chapter warns that mature rituals can create false comfort when the main job is still discovery."
    ),
    question(
      "A manager says uncertainty means the team should stop using structure and just improvise. What does Ries's logic say instead?",
      "Uncertainty needs better feedback systems, not less management",
      [
        "Uncertainty disappears if the team works faster",
        "Uncertainty means customers cannot teach you anything useful",
        "Uncertainty should be hidden so the team feels more confident"
      ],
      "Ries treats uncertainty as a reason to design smarter learning loops, not as an excuse for disorder."
    ),
    question(
      "Why is visible effort a weak early measure of progress?",
      "Because a team can stay busy without learning what is actually true",
      [
        "Because effort only matters after a product is profitable",
        "Because effort should never be tracked at all",
        "Because customers dislike teams that work hard"
      ],
      "The chapter separates motion from progress. Effort is only useful when it reduces uncertainty."
    ),
    question(
      "You are planning a personal side project and have six ideas you could build. Which question best reflects this chapter's discipline?",
      "Which idea carries the most important unknown and how can I learn about it fast",
      [
        "Which idea lets me stay busiest this month",
        "Which idea sounds most impressive when I describe it",
        "Which idea lets me avoid talking to users for the longest time"
      ],
      "The strongest first question is about uncertainty and learning, because early effort should expose what matters most."
    ),
    question(
      "What deeper shift happens when a team openly admits it is in startup conditions?",
      "It can stop performing certainty and start managing learning directly",
      [
        "It can stop making decisions until everything is known",
        "It can justify any mistake as part of the process",
        "It can ignore structure because discovery excuses disorder"
      ],
      "Ries wants teams to replace certainty theater with disciplined contact with reality."
    ),
    question(
      "Which statement best fits the chapter's broader message?",
      "A truthful definition of the situation is the first step to better management",
      [
        "A startup succeeds mainly by looking more confident than rivals",
        "A startup should postpone measurement until it feels stable",
        "A startup should behave like a mature business from day one"
      ],
      "The chapter's closing lesson is that better decisions begin with naming uncertainty honestly."
    ),
  ],
});

CHAPTER_CONTENT["ch02-entrepreneurial-management"] = chapter({
  summary: {
    p1: t(
      "New ventures need a different management logic because they are still searching for a viable path. Traditional management is built to optimize repeatable work, while startups must discover who the customer is, what problem matters, and what kind of business can last.",
      "Ries is not rejecting management. He is rejecting the idea that uncertain work should be judged with the same scorecards used after the model is already proven.",
      "That distinction matters in large companies as much as in new ones. A team inside an established organization can still need startup management if it is operating without a known answer."
    ),
    p2: t(
      "This matters because early teams are often rewarded for polish, forecasts, or output volume even when those things do not reduce uncertainty. The deeper lesson is that the system around a startup must protect learning, or people will optimize the wrong game.",
      "When the surrounding organization prizes predictability too early, builders start managing impressions instead of truth. That is one reason innovative ideas die inside institutions that claim to want them.",
      "Entrepreneurial management is therefore not a softer form of management. It is a stricter one in a different direction. It asks whether the work is producing learning serious enough to deserve more time, money, and trust."
    ),
  },
  standardBullets: [
    bullet(
      "Discovery and optimization are different jobs. Startups are not miniature mature businesses.",
      "A team still searching for a viable model needs tools that surface uncertainty instead of hiding it behind routine plans."
    ),
    bullet(
      "Mature metrics can kill early learning. Revenue forecasts and efficiency targets often create pressure before a startup knows what it is really building.",
      "When the scoreboard is wrong, people become skilled at pleasing the scoreboard rather than learning."
    ),
    bullet(
      "Management still matters deeply. Ries is not romanticizing chaos or intuition.",
      "He is arguing for management that matches uncertain work by organizing experiments, decisions, and accountability around learning."
    ),
    bullet(
      "Forecasts are weakest when uncertainty is highest. Early precision can create false confidence.",
      "A number with many decimals may look responsible while resting on guesses that have never faced customers."
    ),
    bullet(
      "The system should reward questions as well as delivery. Teams need permission to surface what is unknown.",
      "If uncertainty becomes embarrassing, people hide it until the cost is larger."
    ),
    bullet(
      "Established companies need this logic too. Innovation teams inside large firms often fail because the parent company judges them like mature lines of business.",
      "That mismatch makes promising experiments look weak before they have a fair chance to learn."
    ),
    bullet(
      "Functional silos slow learning. When product, marketing, design, and finance optimize separately, no one sees the whole experiment clearly.",
      "Entrepreneurial management tries to align the team around shared learning goals instead of isolated output targets."
    ),
    bullet(
      "Appearance can become a trap. Professional decks, roadmaps, and plans can substitute for contact with reality.",
      "Ries is asking leaders to notice when management theater starts crowding out actual discovery."
    ),
    bullet(
      "Protection is part of leadership. Early venture teams need enough room to test, fail, and adjust without being crushed by premature certainty demands.",
      "That protection is not indulgence. It is how serious organizations give innovation a real shot."
    ),
    bullet(
      "Manage for learning until there is something real to optimize. Only then do classic efficiency questions become central.",
      "This closing insight keeps the book from becoming anti management. It simply sequences management around the real job at hand."
    ),
  ],
  deeperBullets: [
    bullet(
      "Wrong management creates fake discipline. A team can look organized while being strategically lost.",
      "That is why Ries cares so much about fit between the method and the stage of the venture."
    ),
    bullet(
      "Premature forecasting changes behavior. Once people are judged on a number they cannot truly know yet, they start shaping the story to protect themselves.",
      "The distortion is cultural as much as analytical because it teaches people to defend assumptions instead of testing them."
    ),
    bullet(
      "Entrepreneurial management makes uncertainty discussable. Good leaders create a setting where unknowns can be named without loss of status.",
      "That directly improves decision quality because the team stops confusing hidden doubt with alignment."
    ),
    bullet(
      "A startup inside a big firm often faces two enemies at once: market uncertainty and corporate certainty pressure.",
      "Without a tailored management system, the second problem can kill the venture before the market gets a fair vote."
    ),
    bullet(
      "Ries is also redrawing accountability. The question is not whether leaders can promise outcomes early. The question is whether they can build a system that learns responsibly.",
      "That deeper standard is harder to fake and more useful than polished predictability."
    ),
  ],
  takeaways: [
    "Discovery needs different management",
    "Mature metrics can mislead",
    "Learning still needs discipline",
    "Forecast theater is risky",
    "Protect real experimentation",
    "Big firms need this too",
  ],
  practice: [
    "Replace one output target with a learning target",
    "Ask what the team is still pretending to know",
    "Cut one forecast that lacks real evidence",
    "Align functions around one experiment",
    "Protect one uncertain project from premature judgment",
  ],
  examples: [
    example(
      "school",
      "Class project judged too early",
      "Your class is building a prototype for a local nonprofit, but the professor keeps grading the team on finished polish even though the users have not reacted to the core concept yet.",
      [
        "Ask to separate early learning milestones from final presentation quality",
        "Use the next phase to test what the nonprofit actually values before polishing the wrong solution"
      ],
      "This situation shows how the wrong management logic can make a team optimize appearance before insight."
    ),
    example(
      "school",
      "Student founder competition pressure",
      "A campus startup competition asks for five year revenue projections from teams that have never spoken to a paying customer.",
      [
        "Treat the forecast request as a reminder to show uncertainty clearly, not to fake precision",
        "Bring evidence about the problem and customer behavior instead of hiding weak assumptions behind a big spreadsheet"
      ],
      "The chapter matters because early certainty can become a performance that blocks honest learning."
    ),
    example(
      "work",
      "Corporate pilot forced into quarterly targets",
      "Your company launches a pilot product for a new market but judges the team by the same margin targets used for mature products.",
      [
        "Push for a separate scorecard based on what the team must learn before margin targets are meaningful",
        "Show how premature efficiency pressure will distort decisions and shrink experimentation"
      ],
      "The hidden issue is not weak effort. It is that the organization is managing discovery as if discovery were already complete."
    ),
    example(
      "work",
      "Cross functional team with no shared learning goal",
      "Design wants usability wins, sales wants launch assets, and finance wants certainty, but nobody can state the one assumption the new service needs to test next.",
      [
        "Reset the project around a single learning objective that every function can support",
        "Use that shared question to decide what work matters now and what can wait"
      ],
      "Entrepreneurial management aligns a team around learning rather than letting each function optimize its own comfort."
    ),
    example(
      "personal",
      "Side project run like a finished business",
      "You start a newsletter and immediately build a publishing calendar, brand guide, and monetization plan before learning what readers actually want from it.",
      [
        "Treat the project as discovery work until you know what readers respond to and return for",
        "Use simple tests and reader feedback to shape the offering before locking in systems built on guesses"
      ],
      "Personal projects can also suffer from mature business habits applied too soon. Structure helps only when it serves the real stage of the work."
    ),
    example(
      "personal",
      "Volunteer team drowning in process",
      "A community initiative creates forms, approval rules, and committees before the group has proven that neighbors want the service it plans to offer.",
      [
        "Strip the process back to what helps the group learn whether the idea is useful",
        "Add heavier structure only after the demand and core workflow are clearer"
      ],
      "The chapter's deeper lesson is that management should protect learning first. Otherwise process becomes a shield against uncertainty instead of a tool for handling it."
    ),
  ],
  questions: [
    question(
      "Why does Ries say new ventures need a different management logic?",
      "Because they are still discovering the model and cannot be managed like repeatable operations",
      [
        "Because management is mostly unnecessary in early ventures",
        "Because uncertainty disappears if the team stays small",
        "Because customers prefer founders who avoid structure"
      ],
      "The chapter distinguishes discovery from optimization. The management system has to fit the stage of the work."
    ),
    question(
      "A team is asked for precise long range revenue forecasts before it has tested customer demand. What is the strongest response?",
      "Clarify what must be learned first and use evidence based milestones before pretending the forecast is solid",
      [
        "Create a more detailed spreadsheet so the projection looks convincing",
        "Ignore the request and keep building in secret",
        "Promise aggressive numbers so leadership stays interested"
      ],
      "The best answer does not reject accountability. It places accountability on learning that can actually be supported."
    ),
    question(
      "What is the main danger of using mature business metrics too early?",
      "They can make teams optimize the wrong behavior while uncertainty remains unresolved",
      [
        "They always eliminate creativity from every organization",
        "They make customers impossible to understand",
        "They cause teams to stop caring about speed altogether"
      ],
      "Wrong metrics are harmful because they reward appearances and efficiency before the team knows what deserves to be optimized."
    ),
    question(
      "Which situation best fits entrepreneurial management?",
      "A cross functional team aligns around a learning goal and uses work to test it",
      [
        "A team follows each department's preferred metric separately",
        "A team avoids measurement so creativity stays free",
        "A team treats polished reporting as proof of progress"
      ],
      "Ries is asking for management that organizes discovery, not isolated output."
    ),
    question(
      "Why can early forecasts be especially misleading?",
      "Because they often look precise while resting on assumptions that have not met reality",
      [
        "Because numbers never help with startup decisions",
        "Because customers always reject planned businesses",
        "Because founders should rely only on instinct"
      ],
      "The problem is not numbers themselves. It is false certainty created by unsupported numbers."
    ),
    question(
      "A professor grades a student venture mainly on how complete the prototype looks, even though the team has not tested its central idea. What is being missed?",
      "The difference between learning stage work and optimization stage work",
      [
        "The need for bigger budgets",
        "The fact that design never matters",
        "The rule that all school projects should move faster"
      ],
      "The chapter keeps asking whether the evaluation system matches the venture's actual stage."
    ),
    question(
      "What role should leadership play around uncertain projects inside large organizations?",
      "Protect the team from premature certainty pressure while still demanding real learning",
      [
        "Remove accountability until the product is profitable",
        "Judge the team by the same metrics as established units immediately",
        "Let each function define success on its own"
      ],
      "Protection and accountability are both needed. The key is to make the accountability fit uncertain work."
    ),
    question(
      "Which choice most clearly reflects management theater rather than entrepreneurial management?",
      "Producing polished plans that do not answer what the team has learned",
      [
        "Testing an assumption before scaling a feature",
        "Tracking whether user behavior changes after an experiment",
        "Aligning departments around one risky unknown"
      ],
      "The chapter warns that good looking process can substitute for useful learning if leaders are not careful."
    ),
    question(
      "A friend launches a personal project and builds full systems before learning whether anyone wants it. What principle is most relevant?",
      "Use management to support discovery instead of running the project like a proven operation too soon",
      [
        "Avoid structure because structure blocks creativity",
        "Spend more on branding so demand arrives faster",
        "Double the plan because commitment will create the market"
      ],
      "The core mistake is applying mature business logic before the basic unknowns have been addressed."
    ),
    question(
      "What deeper standard of accountability is Ries proposing?",
      "Whether leaders build a system that learns responsibly under uncertainty",
      [
        "Whether leaders can promise exact results from the start",
        "Whether leaders remove all ambiguity from new work immediately",
        "Whether leaders keep stakeholders fully comfortable at all times"
      ],
      "Entrepreneurial management is still disciplined. It simply judges discipline by learning quality rather than premature predictability."
    ),
  ],
});

CHAPTER_CONTENT["ch03-validated-learning"] = chapter({
  summary: {
    p1: t(
      "Learning must be proven, not assumed. Ries argues that startup progress should be measured as validated learning about customers, value, and the business model rather than by how busy, optimistic, or polished the team feels.",
      "Good intentions and hard work do not count as proof. Learning only becomes meaningful when it changes what the team knows about real customer behavior.",
      "This gives startups a different definition of progress from the one most organizations use. Instead of asking how much was built, the chapter asks what belief was tested and what became clearer."
    ),
    p2: t(
      "This matters because early effort often feels productive long before it becomes informative. The deeper lesson is that a failed idea can still be progress if it reveals a bad assumption quickly, while visible momentum can be waste if it teaches nothing useful.",
      "Validated learning turns failure into data and success into something more than wishful interpretation. It helps teams stay honest about whether the business is becoming more real or only more elaborate.",
      "The emotional challenge is central here. Teams must learn to prefer early correction over late vindication, because being wrong quickly is often cheaper than being confidently wrong for months."
    ),
  },
  standardBullets: [
    bullet(
      "Progress means validated learning. Early success is measured by what has been proven about customers and the model.",
      "That standard stops teams from confusing motion, morale, or output volume with strategic improvement."
    ),
    bullet(
      "Opinions do not become facts because a smart team repeats them. A startup must earn belief through evidence.",
      "Ries is pushing the team toward external proof, especially observed customer behavior."
    ),
    bullet(
      "Learning should change decisions. If a new piece of information leaves the plan untouched, it may not be meaningful enough.",
      "Validated learning matters because it has consequences for what the team builds next."
    ),
    bullet(
      "Failure can be useful when it is informative. A disproved assumption is not a wasted result if it arrived early enough to redirect effort.",
      "This reframes setbacks as part of disciplined progress rather than as automatic proof of incompetence."
    ),
    bullet(
      "Unvalidated momentum is dangerous. A team can grow the product, the pitch, and the budget while the core logic stays weak.",
      "Without proof, activity can amplify a bad guess instead of correcting it."
    ),
    bullet(
      "Learning goals should be explicit. Teams need to know what belief they are testing and what signal would count as evidence.",
      "That clarity prevents vague experiments and helps people interpret results with less self deception."
    ),
    bullet(
      "Customer behavior matters more than compliments. What people do is usually more reliable than what they say in a friendly conversation.",
      "Ries keeps bringing the team back to action because action reveals tradeoffs and true priorities."
    ),
    bullet(
      "Document what changed. Learning becomes more real when the team can name the assumption, the evidence, and the resulting decision.",
      "This builds institutional memory and reduces the chance that the same debate returns with new confidence and old ignorance."
    ),
    bullet(
      "Validated learning creates accountability without pretending certainty. It gives a startup a serious way to show progress before financial outcomes fully appear.",
      "That protects the team from both vague storytelling and premature financial judgment."
    ),
    bullet(
      "The core discipline is intellectual honesty. Teams move faster when they stop treating belief as a substitute for proof.",
      "That closing insight is why the chapter feels foundational. It changes what progress, failure, and evidence should mean."
    ),
  ],
  deeperBullets: [
    bullet(
      "The chapter also changes the emotional meaning of being wrong. In a startup, early disconfirmation can be a sign that the system is working.",
      "What matters is not protecting ego. It is shortening the time between mistaken belief and better action."
    ),
    bullet(
      "Validated learning resists politics. When evidence is explicit, status has less room to decide what the truth is.",
      "Teams still argue, but the argument can move closer to observed reality and farther from narrative power."
    ),
    bullet(
      "A startup can fail while still learning, but it cannot progress without learning. That asymmetry is easy to miss.",
      "Ries is not celebrating failure. He is insisting that the absence of learning is the deeper failure because it leaves the team blind."
    ),
    bullet(
      "Learning quality depends on question quality. Weakly framed questions often produce data that feels interesting but stays strategically vague.",
      "That is why validated learning requires sharper hypotheses, not just more customer contact."
    ),
    bullet(
      "This chapter turns humility into an operating advantage. The less a team needs its first story to be right, the faster it can become right enough to matter.",
      "That is a competitive strength as much as a moral virtue, because it improves adaptation under pressure."
    ),
  ],
  takeaways: [
    "Progress means validated learning",
    "Proof must change decisions",
    "Customer behavior matters",
    "Informative failure still helps",
    "Document what changed",
    "Belief is not proof",
  ],
  practice: [
    "Write the assumption being tested",
    "Define what evidence would count",
    "Observe behavior instead of only opinions",
    "Record what changed after the result",
    "Ask whether the team learned anything decision worthy",
  ],
  examples: [
    example(
      "school",
      "Survey praise without commitment",
      "Your group surveys students about a study tool and gets very positive responses, but when you offer a rough trial almost nobody actually signs up.",
      [
        "Treat the trial behavior as stronger evidence than the earlier compliments",
        "Revise the assumption about value before polishing the tool further"
      ],
      "The hidden lesson is that friendly words are weaker than costly action. Validated learning cares about what people actually choose."
    ),
    example(
      "school",
      "Prototype that impressed the class",
      "A professor praises your prototype presentation, and your team assumes the idea is validated even though the intended users have not used it in their real workflow.",
      [
        "Separate presentation success from evidence about actual use",
        "Run a test with real users so the next decision rests on proof rather than classroom enthusiasm"
      ],
      "The chapter matters because social approval can feel like progress while teaching almost nothing about real demand."
    ),
    example(
      "work",
      "Feature launch with no behavior change",
      "Your product team launches a requested feature and celebrates because several customers said they were excited, but usage stays flat after release.",
      [
        "Count the lack of behavior change as a real result instead of explaining it away",
        "Review the original value assumption and test what customers actually needed from the workflow"
      ],
      "This is validated learning in practice. The market just taught the team something important, even if the answer was unwelcome."
    ),
    example(
      "work",
      "Growing dashboard with weak insight",
      "A new service keeps adding users through promotions, but nobody can tell whether those users retain, activate, or solve the problem the team claims to address.",
      [
        "Stop treating top line growth as proof and identify what behavior would show real customer value",
        "Measure the part of usage that would validate the business logic, not just the easiest number to celebrate"
      ],
      "Unvalidated momentum is one of the main risks Ries is warning about. Growth can amplify a weak model if the team never learns what is truly working."
    ),
    example(
      "personal",
      "Creative project with polite support",
      "You tell friends about a paid workshop idea and everyone says it sounds great, but almost nobody commits when you open a simple registration form.",
      [
        "Use the commitment gap as data instead of defending the original story",
        "Revisit the offer, audience, or problem before investing more time in materials"
      ],
      "The deeper lesson is that interest and action are not the same thing. Validated learning looks for behavior with some real cost attached."
    ),
    example(
      "personal",
      "Habit system that feels productive",
      "You build a detailed habit tracker for a wellness plan and feel highly organized, but after two weeks you still do not know which part of the plan actually improves your behavior.",
      [
        "Simplify the system and identify one variable you are truly testing",
        "Judge progress by what you learned about your behavior, not by how complete the tracker looks"
      ],
      "This scenario shows that validated learning matters outside business too. A beautiful system is not the same thing as a useful discovery."
    ),
  ],
  questions: [
    question(
      "What counts as real progress in this chapter's logic?",
      "Learning that has been validated by evidence and changes what the team should do next",
      [
        "Working hard enough that the team feels confident",
        "Building more features than the original roadmap promised",
        "Getting strong praise from people who have not used the product"
      ],
      "Ries defines progress through validated learning, not through effort, optimism, or surface output."
    ),
    question(
      "Why can a failed test still be valuable?",
      "Because it can expose a bad assumption early enough to redirect effort",
      [
        "Because failure automatically proves the team was ambitious",
        "Because customers always reward honest mistakes later",
        "Because a failed test removes the need for future testing"
      ],
      "The chapter reframes informative failure as progress when it teaches something decision worthy."
    ),
    question(
      "A team hears enthusiastic customer comments but sees almost no actual usage after launch. What should it trust more?",
      "The behavior after launch",
      [
        "The early compliments because they came first",
        "The internal team's confidence because it knows the vision best",
        "The feature count because it shows commitment"
      ],
      "Ries repeatedly treats action as stronger evidence than stated interest because behavior reveals real priorities."
    ),
    question(
      "Which question best reflects validated learning?",
      "What assumption did we test, what evidence appeared, and what should change now",
      [
        "How can we keep morale high regardless of the result",
        "How can we explain the result without altering the plan",
        "How can we make the work look more complete before reviewing it"
      ],
      "Validated learning is valuable because it connects evidence to a decision, not because it generates activity."
    ),
    question(
      "What is the main problem with unvalidated momentum?",
      "It can make the venture larger while the core logic remains unproven",
      [
        "It always causes customers to leave immediately",
        "It prevents any future experiments from working",
        "It only happens in large organizations"
      ],
      "Growth or complexity without proof can magnify the cost of a weak assumption."
    ),
    question(
      "A class team gets a high grade for a presentation and assumes the project is now validated. What is missing?",
      "Evidence from the real users the project is meant to serve",
      [
        "A bigger budget for the next phase",
        "A more polished visual style",
        "A stricter team hierarchy"
      ],
      "Social approval and validated learning are not the same thing. The latter depends on real world evidence."
    ),
    question(
      "Why does Ries want learning goals to be explicit before a test?",
      "So the team can tell whether the result actually answers an important question",
      [
        "So the team can guarantee a positive outcome",
        "So the team can avoid interacting with customers",
        "So the team can skip documenting the result later"
      ],
      "Clear learning goals prevent vague experiments and make interpretation more honest."
    ),
    question(
      "Which choice best follows the chapter in a personal project?",
      "Ask what belief the next action is meant to prove before spending more time",
      [
        "Keep refining the plan until it feels impressive",
        "Avoid testing because early reactions might be discouraging",
        "Use compliments from friends as final proof of demand"
      ],
      "The chapter pushes personal builders toward explicit assumptions and evidence, not comforting momentum."
    ),
    question(
      "What deeper organizational benefit comes from validated learning?",
      "It reduces room for status and storytelling to substitute for reality",
      [
        "It removes every disagreement from the team",
        "It guarantees that experiments will be cheap",
        "It makes long term planning unnecessary"
      ],
      "When evidence is explicit, arguments can move closer to observed reality and farther from internal politics."
    ),
    question(
      "Which statement best captures the chapter's core warning?",
      "Do not confuse feeling productive with becoming correct",
      [
        "Do not ask customers anything before launch",
        "Do not measure progress until the product is stable",
        "Do not revise the idea after public praise"
      ],
      "The chapter is fundamentally about separating the appearance of progress from validated learning."
    ),
  ],
});

CHAPTER_CONTENT["ch04-experiments"] = chapter({
  summary: {
    p1: t(
      "Experiments move strategy forward by turning ideas into testable questions. Ries treats each startup move as an experiment designed to discover whether customers want the value being offered and whether the business can grow around it.",
      "The point is not to perform science for its own sake. The point is to make strategic uncertainty observable enough that the next decision becomes clearer.",
      "A good experiment is therefore tied to a choice the team is actually willing to make. It is not an abstract learning exercise disconnected from action."
    ),
    p2: t(
      "This matters because teams often build first and rationalize later. The deeper lesson is that experiments are strongest when they are small, concrete, and designed around the risk that most threatens the venture.",
      "An experiment that cannot change the plan is mostly a ritual. Ries wants tests that sharpen commitment by showing what deserves more investment and what does not.",
      "The chapter also exposes a subtle failure mode: teams say they love evidence while designing tests too vague or too gentle to challenge what they already believe."
    ),
  },
  standardBullets: [
    bullet(
      "Strategy should become testable. Big ideas gain value when they can be challenged by reality.",
      "Experiments turn ambition into something a team can learn from instead of merely defend."
    ),
    bullet(
      "Value and growth both need tests. It is not enough to ask whether customers like the product in theory.",
      "The team also needs to know whether adoption can spread in a sustainable way."
    ),
    bullet(
      "Every experiment should answer a decision. A test matters most when the result changes what happens next.",
      "That keeps research from becoming interesting but strategically useless."
    ),
    bullet(
      "Small experiments are usually stronger than vague giant efforts. Short loops make evidence arrive while change is still cheap.",
      "The smaller the test, the faster the team can refine the strategy or abandon a weak guess."
    ),
    bullet(
      "Customer behavior is the core signal. Friendly reactions are weaker than actions that cost time, money, or attention.",
      "Experiments gain power when they observe what people actually choose under realistic conditions."
    ),
    bullet(
      "Success criteria should be clear in advance. Teams need to know what result would count as meaningful.",
      "Without that discipline, people reinterpret evidence to fit the story they already prefer."
    ),
    bullet(
      "Test the risk that matters most. Safe questions can produce data while the venture's real fragility stays untouched.",
      "Ries wants the experiment aimed at the assumption that could break the whole strategy."
    ),
    bullet(
      "Fast cycles lower emotional cost. Teams change direction more intelligently when evidence arrives before identity hardens around the current plan.",
      "That makes experimentation a cultural asset as well as an analytical one."
    ),
    bullet(
      "The team must be willing to act on the result. Evidence is wasted if nobody will let it shape the plan.",
      "Real experimentation includes the courage to let a test overrule preference."
    ),
    bullet(
      "Experiments are disciplined strategy, not random tinkering. They exist to reduce uncertainty in the service of a better business decision.",
      "That closing insight keeps the chapter practical. Testing is valuable because it improves judgment."
    ),
  ],
  deeperBullets: [
    bullet(
      "The design of the experiment reveals what the team truly believes. Weak tests often signal that the group wants reassurance more than truth.",
      "That is why experiment quality is also a test of organizational honesty."
    ),
    bullet(
      "One experiment should carry one central question. When a test tries to answer everything at once, interpretation becomes muddy.",
      "Sharper questions usually create cleaner learning even if the result feels narrower at first."
    ),
    bullet(
      "Experiments protect strategy from storytelling drift. Instead of arguing in the abstract, the team can compare its narrative against an observed result.",
      "That shrinks the space where charisma or seniority can quietly substitute for proof."
    ),
    bullet(
      "Poorly chosen experiments can create false negatives too. If the test is unrealistic or badly targeted, the team may reject a good idea for the wrong reason.",
      "Ries is not calling for reckless testing. He is calling for thoughtful tests that fit the actual hypothesis."
    ),
    bullet(
      "The deepest benefit is shared reality. Once a team has run a good experiment, debate can move from preference to evidence.",
      "That speeds alignment because people are no longer arguing only from private intuition."
    ),
  ],
  takeaways: [
    "Strategy should be testable",
    "Test value and growth",
    "Tie experiments to decisions",
    "Small tests learn faster",
    "Behavior matters most",
    "Define success in advance",
  ],
  practice: [
    "State the question behind the next test",
    "Define the decision the result should change",
    "Name the behavior that counts as evidence",
    "Target the riskiest assumption first",
    "Write success criteria before running the test",
  ],
  examples: [
    example(
      "school",
      "Hackathon idea with no test",
      "Your team wants to spend the whole weekend building a study planner app at a hackathon even though nobody has checked whether students will return to it after the event.",
      [
        "Design a small experiment that tests repeat use instead of building the full feature list first",
        "Make the result answer whether students actually value the behavior you are betting on"
      ],
      "The hidden problem is not lack of effort. It is that the team wants to build before it has framed the strategic question clearly."
    ),
    example(
      "school",
      "Career center service pilot",
      "A student group wants to launch a peer resume review service and keeps debating branding and scheduling without testing whether students trust peer feedback enough to use it.",
      [
        "Run a narrow pilot that reveals whether students will actually submit resumes for review",
        "Use the result to decide whether the service concept deserves more work"
      ],
      "The chapter matters because a good experiment reduces uncertainty tied to a real decision. It does not just create more discussion."
    ),
    example(
      "work",
      "Feature roadmap without a test",
      "Your team has a six month roadmap for a collaboration feature, but nobody can say what customer behavior would prove the idea is strategically useful.",
      [
        "Shrink the plan into an experiment that tests one important behavior before committing to the full roadmap",
        "Agree in advance what result would justify building more"
      ],
      "This is exactly the sort of situation Ries wants to correct. Strategy should be challenged early, not protected until the budget is spent."
    ),
    example(
      "work",
      "Sales feedback treated as proof",
      "A salesperson says several prospects love a proposed feature, and leadership wants to fast track it even though none of those prospects has taken any concrete step toward adopting it.",
      [
        "Turn the enthusiasm into a test that asks for a real action such as a trial, commitment, or workflow change",
        "Judge the feature by what customers do when the request becomes real"
      ],
      "Experiments matter because stated interest is weaker than behavior with a real cost attached."
    ),
    example(
      "personal",
      "Coaching offer with unclear demand",
      "You want to launch a weekend coaching offer and spend hours designing the package before testing whether people care enough about the problem to book even one session.",
      [
        "Create a simple experiment that asks for a real commitment before polishing the full offer",
        "Use that result to decide whether the concept is strong or needs a different angle"
      ],
      "The chapter teaches that experiments should answer the choice in front of you. In this case the real choice is whether the offer solves a live problem."
    ),
    example(
      "personal",
      "Community event planning by assumption",
      "You are organizing a recurring community event and keep expanding the format without testing which part actually makes people come back.",
      [
        "Run one focused change at a time so returning behavior can be interpreted cleanly",
        "Tie the test to a concrete decision about what the event should keep or drop"
      ],
      "When experiments are vague, learning becomes vague too. The chapter asks for tests that make the next decision easier."
    ),
  ],
  questions: [
    question(
      "What is the main purpose of an experiment in Ries's framework?",
      "To test a strategic assumption so the next decision becomes clearer",
      [
        "To make the team feel more scientific",
        "To gather as much interesting data as possible",
        "To delay commitment until every possible question is answered"
      ],
      "Experiments matter because they reduce strategic uncertainty in a way that should shape action."
    ),
    question(
      "Why is a test weak if it cannot change the plan?",
      "Because it may produce information without producing decision relevant learning",
      [
        "Because customers dislike experiments that are small",
        "Because all useful tests must run for several months",
        "Because learning only matters after a product launches fully"
      ],
      "Ries wants tests that connect evidence to a choice. Otherwise the experiment becomes mostly ritual."
    ),
    question(
      "A team asks customers whether they like a feature idea and gets positive comments. What is still missing?",
      "Evidence about what customers will actually do when the feature becomes real",
      [
        "A larger engineering team",
        "A stronger founder story",
        "A longer roadmap with more detail"
      ],
      "The chapter treats behavior as the stronger signal because it reflects real tradeoffs."
    ),
    question(
      "What is the benefit of defining success criteria before the experiment runs?",
      "It reduces the chance that the team will reinterpret the result to protect the original idea",
      [
        "It guarantees that the result will be positive",
        "It removes the need for customer observation",
        "It makes every small test automatically reliable"
      ],
      "Clear criteria create honesty around interpretation. Without them, teams can bend weak evidence to fit preference."
    ),
    question(
      "Which experiment is strongest by this chapter's logic?",
      "A small test aimed at the riskiest assumption with a clear decision attached",
      [
        "A large build intended to impress investors before users react",
        "A broad survey that asks many questions without any planned next step",
        "A feature launch designed to prove the team was right all along"
      ],
      "The best experiments are focused, decision relevant, and tied to the venture's real risk."
    ),
    question(
      "What hidden problem appears when a team chooses only safe experiments?",
      "It can gather data while avoiding the assumption most likely to break the strategy",
      [
        "It will always confuse customers",
        "It will lose the ability to prioritize work",
        "It will become too small to grow later"
      ],
      "Ries wants the venture's meaningful risk confronted, not surrounded by comfortable research."
    ),
    question(
      "A personal project founder keeps running broad tests that answer many small questions at once. Why might that backfire?",
      "Because muddled experiments make the result hard to interpret and weak as a guide for action",
      [
        "Because broad curiosity is always harmful",
        "Because customers prefer only formal laboratory tests",
        "Because all experiments should focus on price first"
      ],
      "One strong question per experiment usually creates cleaner learning than many fuzzy questions at once."
    ),
    question(
      "What deeper organizational value do experiments create?",
      "They give the team a shared reality that can reduce debate driven by status or preference",
      [
        "They remove the need for leadership judgment",
        "They guarantee alignment even when the data is weak",
        "They allow teams to skip documenting what happened"
      ],
      "Good experiments do not erase disagreement, but they move disagreement closer to evidence."
    ),
    question(
      "Why can a badly designed experiment create the wrong conclusion?",
      "Because the team may reject a good idea based on a poor test rather than on the idea itself",
      [
        "Because good ideas never need testing",
        "Because all customer evidence is unreliable",
        "Because the market always rewards first movers regardless of design"
      ],
      "Ries is calling for thoughtful testing. The point is truth seeking, not careless trial and error."
    ),
    question(
      "Which statement best captures the chapter's core lesson?",
      "Test strategy early enough that reality can still improve it",
      [
        "Protect strategy from criticism until the full product is ready",
        "Use experiments mainly to impress stakeholders",
        "Treat any customer conversation as proof of demand"
      ],
      "The chapter is about using experiments to strengthen judgment before commitment gets too expensive."
    ),
  ],
});
