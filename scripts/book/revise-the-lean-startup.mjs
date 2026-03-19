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

CHAPTER_CONTENT["ch05-leap-of-faith"] = chapter({
  summary: {
    p1: t(
      "Every venture rests on risky assumptions that matter before anything can be fully proven. Ries says the first strategic task is to identify the leap of faith beliefs about customer value and growth that must be true for the business to work at all.",
      "Those assumptions deserve special attention because the whole plan quietly leans on them. If they are wrong, better execution only scales the mistake.",
      "This chapter pushes founders to stop testing the comfortable edges of the idea while leaving the core gamble untouched. The earliest learning should strike the heart of the model."
    ),
    p2: t(
      "This matters because teams often test easy details while protecting the assumptions that could actually sink the venture. The deeper lesson is that honest entrepreneurship starts by naming the most dangerous belief and confronting it directly.",
      "Early adopters become important here because they reveal whether the pain is strong enough to overcome an imperfect first solution. They give the team a sharper view of value before mass market polish exists.",
      "If a startup hides its leap of faith under a polished narrative, it usually wastes time improving the wrong thing. Clear risk naming is what turns vague hope into disciplined learning."
    ),
  },
  standardBullets: [
    bullet(
      "Every plan depends on a leap of faith. Some belief must be true before the business can work.",
      "Ries wants founders to surface that belief early so the strategy stops resting on hidden hope."
    ),
    bullet(
      "Value and growth are the key early bets. The team needs to know whether users truly care and whether adoption can spread.",
      "If either belief fails, the venture has to change no matter how energetic execution looks."
    ),
    bullet(
      "Test the riskiest assumption first. Easy questions can consume time while the biggest danger remains untouched.",
      "The strongest early learning comes from confronting the belief that could collapse the whole model."
    ),
    bullet(
      "Early adopters matter because they tolerate imperfection when the problem is painful enough. Their response reveals intensity of need.",
      "That makes them more informative than a broad audience that is only mildly interested."
    ),
    bullet(
      "Observation in the field beats distant speculation. Ries favors direct contact with the context in which the problem lives.",
      "What people say in the abstract can differ sharply from what they do in their real environment."
    ),
    bullet(
      "Hidden assumptions distort roadmaps. Teams often schedule work around what they hope is true instead of what they must prove.",
      "Once the leap of faith is named, the roadmap can be reorganized around learning rather than comfort."
    ),
    bullet(
      "Convenient assumptions are especially dangerous. They feel rational precisely because they have not yet been stressed.",
      "Ries wants founders to become suspicious of the beliefs that make the current plan feel easiest."
    ),
    bullet(
      "Customer interviews alone are not enough. Conversation helps, but the venture still needs tests that reveal commitment and behavior.",
      "A leap of faith becomes clearer when people give up time, money, or habit to pursue the proposed value."
    ),
    bullet(
      "Naming the core bet aligns the team. It helps everyone understand what is actually being risked and what the next learning goal should be.",
      "That reduces scattered execution because the work starts serving one real uncertainty."
    ),
    bullet(
      "Clear risk naming turns hope into strategy. The leap of faith does not disappear, but it becomes manageable.",
      "That closing move is what makes the chapter practical. Courage becomes more useful when it is pointed at the right unknown."
    ),
  ],
  deeperBullets: [
    bullet(
      "Many startups protect the central bet with peripheral work. Design, hiring, planning, and messaging can all become shelters from the hardest test.",
      "Ries is asking whether the team is improving the business or only delaying the most revealing question."
    ),
    bullet(
      "A value hypothesis and a growth hypothesis can fail independently. People may love the product but not spread it, or spread it without staying.",
      "That is why both beliefs need separate attention instead of being collapsed into one general feeling of traction."
    ),
    bullet(
      "Early adopter behavior is valuable because it reveals urgency, not because early adopters are representative of everyone.",
      "The team learns whether the problem is strong enough to pull people through inconvenience before trying to satisfy the whole market."
    ),
    bullet(
      "The leap of faith often hides inside language like obvious, clearly, or of course. Certainty words can mask the weakest part of the model.",
      "Listening for those phrases helps leaders notice where confidence has replaced examination."
    ),
    bullet(
      "This chapter is really about strategic honesty. Teams move faster when they stop pretending the central gamble is smaller than it is.",
      "Once the real bet is visible, the venture can organize experiments, resources, and emotion around reality instead of theater."
    ),
  ],
  takeaways: [
    "Name the leap of faith",
    "Test value and growth bets",
    "Start with the riskiest assumption",
    "Use early adopters well",
    "Observe real behavior closely",
    "Do not hide the core gamble",
  ],
  practice: [
    "Write the value hypothesis plainly",
    "Write the growth hypothesis plainly",
    "Rank the assumptions by danger",
    "Talk to likely early adopters in context",
    "Design one test for the core bet",
  ],
  examples: [
    example(
      "school",
      "Campus marketplace with a hidden bet",
      "Your team wants to launch a student marketplace, but the whole concept depends on the belief that students feel enough friction in existing groups to switch to a new platform.",
      [
        "State that belief directly instead of debating secondary features",
        "Test whether students will take a real action that shows the pain is strong enough"
      ],
      "The chapter matters because the project's future rests on one core assumption. If that assumption stays hidden, the team can spend weeks polishing the wrong answer."
    ),
    example(
      "school",
      "Peer mentoring program without urgency",
      "A student organization plans a peer mentoring service and assumes first year students want it, but nobody has checked whether new students feel the problem strongly enough to join without heavy nudging.",
      [
        "Identify the real leap of faith about urgency and willingness to participate",
        "Run a small test that asks for genuine sign up behavior rather than polite interest"
      ],
      "This scenario shows how an idea can sound good while the central bet remains untested."
    ),
    example(
      "work",
      "New product built around executive belief",
      "Leadership is convinced a new customer segment wants premium analytics, but the team has not tested whether those customers feel the problem intensely enough to change current habits.",
      [
        "Name the value hypothesis in concrete terms before building the full offer",
        "Design a test that reveals whether the target customer will make a real commitment"
      ],
      "Ries would say the executive story is not yet strategy. Strategy begins when the key assumption is exposed and examined."
    ),
    example(
      "work",
      "Referral plan assumed to drive growth",
      "Your product team assumes referrals will fuel adoption, but existing users are only mildly engaged and rarely talk about the product to anyone.",
      [
        "Treat the growth logic as its own leap of faith instead of assuming enthusiasm will appear later",
        "Test whether current users will actually invite others under realistic conditions"
      ],
      "The deeper lesson is that value and growth are separate bets. A weak growth assumption can undermine a product even when some users like it."
    ),
    example(
      "personal",
      "Coaching service based on a guess",
      "You want to offer one on one coaching and assume busy professionals will pay for faster feedback, but you have not tested whether the pain is strong enough for anyone to book.",
      [
        "State the payment assumption clearly instead of refining the package endlessly",
        "Run a simple offer test that asks for real commitment"
      ],
      "The chapter teaches that personal ventures should expose the core gamble early rather than protect it with preparation."
    ),
    example(
      "personal",
      "Neighborhood tool library with unknown growth",
      "A local tool sharing idea seems useful, but nobody knows whether early members would actually invite neighbors or whether growth would stall after the first enthusiastic group.",
      [
        "Separate the question of value from the question of spread so both can be tested honestly",
        "Use a small pilot to learn whether new members arrive through member behavior or only through organizer effort"
      ],
      "This makes the chapter concrete outside startups. A helpful idea still needs its core assumptions about value and growth examined directly."
    ),
  ],
  questions: [
    question(
      "What is a leap of faith assumption in this chapter?",
      "A belief that must be true for the venture to work even though it has not yet been proven",
      [
        "A feature that users requested after launch",
        "A process rule used by mature companies",
        "A detailed forecast supported by historical data"
      ],
      "Ries uses the phrase for the core unproven beliefs that the business quietly depends on."
    ),
    question(
      "Why should the riskiest assumption be tested early?",
      "Because it can invalidate the whole strategy and should not be left hidden while time is spent elsewhere",
      [
        "Because easy assumptions never matter",
        "Because customers only answer one question well",
        "Because early teams should avoid any positive evidence"
      ],
      "The chapter warns against improving the edges of an idea while the main vulnerability stays untouched."
    ),
    question(
      "What do early adopters help reveal best?",
      "Whether the problem is painful enough for people to tolerate an imperfect first solution",
      [
        "Whether the mass market is fully ready to buy at scale",
        "Whether branding matters more than the product",
        "Whether financial forecasting can now replace testing"
      ],
      "Early adopters are valuable because they reveal urgency and value intensity before the broader market would respond."
    ),
    question(
      "A team keeps refining branding because the core demand assumption feels uncomfortable to test. What is happening?",
      "Peripheral work is protecting the central gamble from scrutiny",
      [
        "The team is wisely sequencing its highest priority learning",
        "The team has already validated the product without realizing it",
        "The team is proving that design is the only thing customers care about"
      ],
      "The chapter cautions that side work can become a shelter from the most important question."
    ),
    question(
      "Why are value and growth treated as separate assumptions?",
      "Because a product can attract users without spreading well, or spread interest without creating durable value",
      [
        "Because growth never depends on the product itself",
        "Because value matters only after scale",
        "Because startups should choose one and ignore the other"
      ],
      "Ries wants both beliefs tested because either one can fail and force a major change."
    ),
    question(
      "A student venture gets many likes on a pitch post but few sign ups for a pilot. Which interpretation fits the chapter best?",
      "Interest is not enough evidence if the leap of faith involves real commitment",
      [
        "The pitch post has already validated demand",
        "The team should now avoid testing to preserve momentum",
        "The problem must be that the users need more features"
      ],
      "The chapter treats meaningful behavior as stronger evidence than low cost attention."
    ),
    question(
      "What is the best first move for a founder who cannot state the venture's key assumption in one sentence?",
      "Clarify the core value or growth belief before planning more work",
      [
        "Add more features to discover the assumption indirectly",
        "Focus on building a longer roadmap for stakeholders",
        "Delay customer contact until the concept feels more complete"
      ],
      "If the central bet is not visible, the rest of the work is likely to become scattered."
    ),
    question(
      "Why can customer interviews be insufficient on their own?",
      "Because people may describe interest without taking the actions that reveal true commitment",
      [
        "Because interviews always mislead founders",
        "Because customers should never be asked directly about problems",
        "Because only pricing tests ever matter"
      ],
      "Interviews help, but Ries still wants evidence tied to behavior and commitment."
    ),
    question(
      "What deeper leadership skill does this chapter demand?",
      "Strategic honesty about what the venture is really betting on",
      [
        "The ability to make every assumption sound obvious",
        "The ability to delay difficult questions until morale is higher",
        "The ability to forecast outcomes without evidence"
      ],
      "The chapter turns honesty into an operating advantage because it points learning at the real risk."
    ),
    question(
      "Which statement best captures the chapter's practical message?",
      "Expose the core gamble early enough that evidence can still improve the strategy",
      [
        "Protect the core gamble with as much preparation as possible",
        "Treat all assumptions as equally urgent",
        "Assume customer value if the team believes in the mission strongly enough"
      ],
      "The point is not to eliminate uncertainty instantly. It is to confront the most dangerous uncertainty before it becomes expensive."
    ),
  ],
});

CHAPTER_CONTENT["ch06-minimum-viable-product"] = chapter({
  summary: {
    p1: t(
      "A minimum viable product should be the smallest thing that starts real learning. Ries argues that an early version succeeds when it teaches about customer behavior quickly, not when it looks finished or complete.",
      "Quality still matters, but only in the ways the test actually requires. The right standard is fitness for learning, not premature perfection.",
      "This chapter is often misunderstood as a license to ship junk. Ries's actual claim is more precise: build only what is necessary to answer the next important question."
    ),
    p2: t(
      "This matters because perfectionism is one of the easiest ways to delay evidence. The deeper lesson is that an MVP is an instrument for learning, so its size, polish, and format should match the assumption being tested.",
      "Concierge service, manual work, and rough prototypes can all qualify if they expose the right customer truth. The waste comes from building more than the test requires.",
      "The real danger is usually not embarrassment from shipping something small. It is spending months polishing features nobody needed and then discovering the lesson too late."
    ),
  },
  standardBullets: [
    bullet(
      "An MVP is built to learn, not to impress. Its job is to create the earliest credible contact with reality.",
      "That reframes scope decisions around evidence instead of around image."
    ),
    bullet(
      "Smallest means smallest that still teaches. Cutting scope only helps when the remaining version can answer the important question.",
      "A product that teaches nothing is not viable in Ries's sense even if it is tiny."
    ),
    bullet(
      "Perfection can be a form of avoidance. Teams often keep refining because launch would finally expose the truth.",
      "The chapter treats delay as expensive because it postpones the feedback that should guide everything else."
    ),
    bullet(
      "Quality should match the test. Some contexts require trust and reliability while others can tolerate roughness.",
      "The right question is what level of quality is necessary for the learning to be valid."
    ),
    bullet(
      "Manual solutions can be excellent MVPs. Concierge and Wizard of Oz styles often teach faster than full automation.",
      "Ries cares more about learning speed than about whether the first version looks scalable."
    ),
    bullet(
      "Early adopters forgive roughness when the problem matters enough. Their behavior reveals whether the pain is real.",
      "That makes them ideal partners for early learning even if the product is still awkward."
    ),
    bullet(
      "An MVP should focus the team on one main assumption. Scope creeps when the product tries to answer every question at once.",
      "Clarity about the learning goal keeps the first version honest and manageable."
    ),
    bullet(
      "Shipping sooner lowers the cost of correction. The earlier users react, the less rework sits between belief and evidence.",
      "That is why MVP thinking is deeply connected to waste reduction."
    ),
    bullet(
      "A rough first version still needs careful observation. Launching is only useful if the team watches what users actually do next.",
      "The MVP starts the conversation with reality. It does not finish it."
    ),
    bullet(
      "The core mistake is overbuilding before proof. MVP discipline keeps ambition alive by preventing waste from swallowing it.",
      "That closing idea explains why smaller can be more serious rather than less serious."
    ),
  ],
  deeperBullets: [
    bullet(
      "The chapter distinguishes embarrassment from risk. Founders often fear looking unfinished more than they fear learning too late.",
      "Ries reverses that priority because late learning is usually the more damaging outcome."
    ),
    bullet(
      "Scalability can wait longer than many teams think. An early manual process may be strategically wiser than automated complexity.",
      "If the business logic is still uncertain, efficient scaling of the wrong product only accelerates waste."
    ),
    bullet(
      "Not every small product is a good MVP. If the scope reduction removes the ability to test the real assumption, the lesson becomes false or weak.",
      "Ries is not praising minimalism for style. He is praising minimalism in the service of valid learning."
    ),
    bullet(
      "Trust critical contexts need sharper judgment. A finance, health, or safety product may need higher initial reliability to make the test meaningful.",
      "The point is still learning. The threshold simply changes because the user risk is different."
    ),
    bullet(
      "MVP discipline protects morale in the long run. Teams burn out faster when they overbuild in secret and then discover the plan was wrong.",
      "Small releases create a healthier rhythm because learning arrives before identity and exhaustion become too expensive."
    ),
  ],
  takeaways: [
    "An MVP exists to learn",
    "Smallest means smallest that teaches",
    "Perfection can delay truth",
    "Manual tests can work",
    "Observe behavior after launch",
    "Overbuilding creates waste",
  ],
  practice: [
    "Write the one question the MVP should answer",
    "Cut anything that does not serve that question",
    "Match quality to the learning need",
    "Consider a manual version first",
    "Decide what user behavior would validate the idea",
  ],
  examples: [
    example(
      "school",
      "Student planner built too wide",
      "Your team wants to build a full student planner with reminders, note storage, calendars, and collaboration before testing whether students would use even the core planning flow.",
      [
        "Strip the first version down to the smallest interaction that reveals whether students use the core habit",
        "Observe actual return behavior before adding the extra layers"
      ],
      "The hidden issue is not ambition. It is that the team is building many answers before proving one meaningful question."
    ),
    example(
      "school",
      "Peer tutoring platform with automation first",
      "A class project plans matching software, scheduling tools, and rating systems before anyone has tried a simple manual tutoring match.",
      [
        "Test the tutoring demand with a manual process first",
        "Use what you learn to decide which parts deserve automation later"
      ],
      "This scenario shows why manual work can be a smart MVP. Scalability matters later than many teams assume."
    ),
    example(
      "work",
      "Product team waiting for polish",
      "Your team keeps delaying release because the onboarding flow, notifications, and edge cases are not perfect, even though the central question is whether users will perform one repeated action at all.",
      [
        "Release the smallest trustworthy version that can test the repeated action",
        "Track the behavior closely so the team learns before polishing secondary details"
      ],
      "Ries would say the bigger risk is not an imperfect launch. It is learning too late after the team has invested far more than the question required."
    ),
    example(
      "work",
      "Service idea built as software too soon",
      "A company wants to automate a new premium service from the start even though nobody knows which parts of the service customers value most.",
      [
        "Deliver the service manually at first so customer behavior can reveal what actually matters",
        "Automate only after the high value parts are clearer"
      ],
      "The chapter pushes teams to earn automation through learning instead of treating automation as proof of seriousness."
    ),
    example(
      "personal",
      "Course idea without a first test",
      "You want to create a full online course and start filming every lesson before checking whether people will engage with the basic promise or pay for a first workshop.",
      [
        "Run a simpler live session or pilot first to test the central value claim",
        "Use that learning to decide whether the larger course deserves full production"
      ],
      "An MVP protects your time by letting reality speak before the full build consumes your energy."
    ),
    example(
      "personal",
      "Community service planned at full scale",
      "You want to organize a neighborhood meal exchange and immediately create forms, menus, and logistics for everyone on the block before seeing whether a much smaller pilot would work.",
      [
        "Start with a tiny pilot that still reveals whether neighbors participate reliably",
        "Let the pilot teach which pieces actually need structure before scaling the effort"
      ],
      "This is MVP thinking outside software. The principle is to build only enough to learn whether the service deserves more."
    ),
  ],
  questions: [
    question(
      "What makes an MVP viable in Ries's sense?",
      "It is small but still capable of teaching something important about customer behavior",
      [
        "It is the cheapest version regardless of what it teaches",
        "It is fully automated from the start",
        "It is polished enough that nobody notices what is missing"
      ],
      "Viable means the product can support meaningful learning, not simply that it is minimal."
    ),
    question(
      "Why can perfectionism be dangerous at this stage?",
      "Because it often delays the evidence that should shape the product",
      [
        "Because customers always prefer unfinished products",
        "Because quality never matters early",
        "Because design choices should be ignored until scale"
      ],
      "Ries treats delayed learning as a major cost because correction becomes harder after more investment."
    ),
    question(
      "When is a manual service a strong MVP?",
      "When it reveals customer value faster than full automation would",
      [
        "Only when the service will never need to scale",
        "Only when engineering resources are unavailable",
        "Never, because manual work invalidates the test"
      ],
      "The chapter explicitly allows manual approaches when they answer the right learning question."
    ),
    question(
      "A team cuts features until the product can no longer test the central assumption. What has happened?",
      "The product became small without staying viable as a learning tool",
      [
        "The team achieved the ideal MVP",
        "The team proved the assumption is false",
        "The team discovered that quality never matters"
      ],
      "Minimal scope only helps when the remaining version still produces meaningful evidence."
    ),
    question(
      "Why can early adopters accept a rough product?",
      "Because a painful enough problem can matter more to them than polish",
      [
        "Because early adopters always like unfinished things",
        "Because early adopters care only about low prices",
        "Because rough products automatically generate viral growth"
      ],
      "Their tolerance helps the startup learn whether the underlying need is genuinely strong."
    ),
    question(
      "What is the strongest next move for a personal creator planning a large course without any proof of demand?",
      "Run a smaller pilot that tests whether the core promise attracts and engages people",
      [
        "Record every lesson first so the offer looks professional",
        "Wait until the entire course is polished before talking to anyone",
        "Assume demand is already validated by compliments from friends"
      ],
      "The MVP logic says to test the core value claim before spending the full production effort."
    ),
    question(
      "How should quality be judged for an MVP?",
      "By whether the quality level is sufficient for the learning to be valid",
      [
        "By whether the team feels proud of the design",
        "By whether every planned feature is included",
        "By whether competitors would call it impressive"
      ],
      "Quality still matters, but the chapter ties it to the learning objective rather than to premature completeness."
    ),
    question(
      "What should a team do immediately after launching an MVP?",
      "Watch what users actually do and interpret the behavior against the learning goal",
      [
        "Move straight into a full scale rollout",
        "Assume launch itself counts as validation",
        "Avoid looking at early results to keep morale up"
      ],
      "The MVP begins the contact with reality. The learning comes from what the team observes next."
    ),
    question(
      "What deeper waste does MVP discipline try to prevent?",
      "Months of building features that were never necessary to learn the key truth",
      [
        "Any form of iteration after launch",
        "Any manual work before automation",
        "Any product with more than one feature"
      ],
      "Ries cares about reducing the distance between belief and evidence so large hidden waste does not accumulate."
    ),
    question(
      "Which statement best matches the chapter's main idea?",
      "Build only enough to answer the next important question about customers",
      [
        "Build enough to impress stakeholders before customers react",
        "Build the full vision so testing happens under perfect conditions",
        "Build as little as possible even if the result teaches nothing"
      ],
      "The point is strategic learning, not minimalism for its own sake."
    ),
  ],
});

CHAPTER_CONTENT["ch07-measure"] = chapter({
  summary: {
    p1: t(
      "Use metrics that change decisions. Ries argues that startup measurement should reveal whether a specific change improves customer behavior, not simply produce large impressive numbers that make the team feel successful.",
      "That is why he separates actionable metrics from vanity metrics. Numbers matter only when they help the team see cause and effect clearly enough to learn.",
      "The chapter therefore treats measurement as part of strategy rather than as a reporting afterthought. Good metrics become a way of forcing honesty into the discussion."
    ),
    p2: t(
      "This matters because aggregate growth can hide churn, weak activation, or a broken business model. The deeper lesson is that the right dashboard makes truth harder to avoid and pivot decisions easier to justify.",
      "Cohort analysis, split tests, and stage based funnel thinking all help the team ask what changed for whom and why. They reduce the chance that good storytelling will overpower weak evidence.",
      "Bad metrics are not harmless. They actively teach the organization to celebrate the wrong things. Once vanity numbers become status markers, honest learning slows down."
    ),
  },
  standardBullets: [
    bullet(
      "Metrics should change decisions. A number matters when it helps the team choose the next move more intelligently.",
      "If the metric never alters behavior, it is probably closer to decoration than to management."
    ),
    bullet(
      "Vanity metrics feel good but explain little. Aggregate counts often rise while the true customer story stays blurry.",
      "Ries wants measures that make weak learning visible instead of hiding it inside impressive totals."
    ),
    bullet(
      "Actionable metrics tie change to behavior. They help the team see whether a specific product move caused a meaningful result.",
      "That connection is what turns data into learning rather than into noise."
    ),
    bullet(
      "Cohort analysis matters because it separates groups over time. New and old users rarely behave the same way.",
      "Looking at cohorts prevents the team from treating one blended number as if it explained the whole system."
    ),
    bullet(
      "Split testing sharpens cause and effect. Comparing versions lets the team see whether a change actually improved the target behavior.",
      "This is far more useful than relying on intuition after a broad release."
    ),
    bullet(
      "Funnels reveal where value leaks. A team needs to know whether people activate, retain, refer, or pay at the expected points.",
      "Without stage based visibility, the business can look healthy while a critical step is collapsing."
    ),
    bullet(
      "Measurement should follow the hypothesis. The right numbers depend on what the team is trying to learn right now.",
      "A metric becomes more useful when it is chosen for a specific strategic question rather than out of habit."
    ),
    bullet(
      "Context matters as much as volume. Raw counts can mislead when they ignore timing, channel, or customer segment.",
      "Ries keeps asking what changed, for which group, and relative to what baseline."
    ),
    bullet(
      "Clear metrics reduce politics. Better numbers make it harder for preference and seniority to dominate the conversation.",
      "Teams still interpret data, but the data becomes less vulnerable to wishful reading."
    ),
    bullet(
      "Measurement is a learning tool. The point is not to collect more data than everyone else. The point is to understand reality well enough to act.",
      "That closing insight keeps the chapter grounded. Good measurement exists to improve decisions under uncertainty."
    ),
  ],
  deeperBullets: [
    bullet(
      "Vanity metrics are seductive because they compress complexity into a flattering story. They give leaders something simple to celebrate.",
      "Ries is asking whether the simplicity is clarifying reality or merely protecting confidence."
    ),
    bullet(
      "A metric can be numerically accurate and strategically useless at the same time. Precision does not guarantee relevance.",
      "That is why the chapter cares so much about whether the number answers an important causal question."
    ),
    bullet(
      "Bad dashboards train bad culture. Once people learn which numbers earn praise, they start shaping work to satisfy those numbers.",
      "The wrong metrics therefore distort incentives, not just reporting."
    ),
    bullet(
      "Cohorts protect the team from self deception. They force comparison across time instead of letting a blended average hide deterioration.",
      "That makes them especially powerful when growth or promotion spikes would otherwise mask product weakness."
    ),
    bullet(
      "Measurement quality is a leadership choice. Organizations do not drift into honest dashboards by accident.",
      "Someone has to decide that actionable truth matters more than impressive optics."
    ),
  ],
  takeaways: [
    "Metrics should change decisions",
    "Vanity numbers mislead easily",
    "Use cohorts and split tests",
    "Track where value leaks",
    "Choose numbers for the hypothesis",
    "Good dashboards reduce politics",
  ],
  practice: [
    "Name one vanity metric you overvalue",
    "Build one cohort view",
    "Tie the next experiment to one decision metric",
    "Track the step where users leak out",
    "Compare results to a clear baseline",
  ],
  examples: [
    example(
      "school",
      "Club app with brag worthy downloads",
      "Your team celebrates three hundred downloads of a new campus club app, but almost nobody returns after the first day and event attendance does not change.",
      [
        "Stop using downloads as the main signal and examine retention and actual club behavior",
        "Choose metrics that show whether the app changes the outcome it was meant to improve"
      ],
      "The chapter matters because big top line numbers can hide a weak product when they are not tied to meaningful behavior."
    ),
    example(
      "school",
      "Research project with blended averages",
      "A student service pilot looks strong in the average weekly report, but new users are dropping off quickly while a small loyal group keeps the average up.",
      [
        "Break the data into cohorts so the team can see what newer users actually do",
        "Use that view to decide whether the service is improving or quietly weakening"
      ],
      "Blended numbers often hide the real story. Cohorts make the change over time visible."
    ),
    example(
      "work",
      "Dashboard everyone likes but nobody uses",
      "Your product team shows rising page views on an internal dashboard, yet leaders still cannot tell whether recent product changes improved activation or retention.",
      [
        "Replace the vanity count with a measure tied to the decision the team is trying to make",
        "Use split testing or cohort analysis so the change in behavior becomes clearer"
      ],
      "Ries would say the dashboard is serving optics instead of learning if it cannot guide the next move."
    ),
    example(
      "work",
      "Paid campaign hiding weak value",
      "A new paid campaign brings many sign ups, but most users disappear after the first session and the team keeps celebrating acquisition volume.",
      [
        "Track the funnel past sign up so the business sees where value is leaking",
        "Use the full behavior pattern to judge whether the campaign is attracting useful users or only cheap vanity growth"
      ],
      "This scenario shows why measurement must follow the real hypothesis. Acquisition alone cannot validate a weak product."
    ),
    example(
      "personal",
      "Newsletter measured by followers",
      "You keep checking subscriber count on a new newsletter, but you are not measuring open rates, replies, or repeat engagement that would show whether readers truly care.",
      [
        "Choose one behavior metric that reflects real reader value instead of status",
        "Use that number to decide what content direction deserves more effort"
      ],
      "Personal projects also suffer from vanity metrics. Large numbers can feel rewarding while teaching almost nothing useful."
    ),
    example(
      "personal",
      "Habit app judged by streak length alone",
      "You use a habit app and judge success only by total days tracked, even though the habit you care about is still weak in the specific situations that matter most.",
      [
        "Measure the behavior in the context that actually matters instead of relying on one flattering summary number",
        "Let the metric reflect the real problem you are trying to solve"
      ],
      "The deeper lesson is that measurement should serve truth. A convenient number can still be the wrong one."
    ),
  ],
  questions: [
    question(
      "What makes a metric actionable in this chapter?",
      "It helps the team understand cause and effect well enough to change a decision",
      [
        "It is large enough to impress stakeholders",
        "It can be refreshed every day",
        "It summarizes many outcomes into one blended total"
      ],
      "Actionable metrics matter because they guide behavior rather than simply decorating reports."
    ),
    question(
      "Why are vanity metrics dangerous?",
      "They can make weak learning look strong by hiding the real customer story",
      [
        "They are always mathematically wrong",
        "They prevent any team from growing",
        "They only matter in consumer apps"
      ],
      "Ries criticizes vanity metrics because they flatter the venture without clarifying what is actually improving."
    ),
    question(
      "What is the main value of cohort analysis?",
      "It shows how different groups behave over time instead of blending them into one average",
      [
        "It replaces the need for experiments",
        "It guarantees that retention will rise",
        "It makes customer interviews unnecessary"
      ],
      "Cohorts are powerful because they reveal change patterns that blended data can hide."
    ),
    question(
      "A team sees rising sign ups but falling retention. What does the chapter imply?",
      "Acquisition alone is not enough to judge whether the product is getting healthier",
      [
        "Retention matters only after profitability",
        "The rise in sign ups proves the strategy is working",
        "The team should stop measuring until the product is stable"
      ],
      "The chapter insists that the business be read through the behaviors that matter to value and growth, not through the easiest celebratory number."
    ),
    question(
      "Why are split tests useful?",
      "They help isolate whether a specific change improved the target behavior",
      [
        "They make customer segments irrelevant",
        "They eliminate all ambiguity from product work",
        "They turn every idea into a guaranteed win"
      ],
      "Split tests strengthen causal learning by comparing versions instead of relying on post hoc stories."
    ),
    question(
      "What is the strongest next move when a dashboard looks impressive but nobody can explain what decision it should influence?",
      "Redesign the dashboard around the decision the team is trying to make",
      [
        "Keep the dashboard because morale matters",
        "Add more top line numbers so the story feels complete",
        "Ignore the metrics and trust instinct instead"
      ],
      "A good dashboard serves learning. If it cannot guide a choice, it needs to change."
    ),
    question(
      "How can bad metrics shape culture?",
      "They teach people to optimize for flattering numbers instead of real progress",
      [
        "They remove every form of ambition from the team",
        "They make honest measurement impossible forever",
        "They matter only to finance departments"
      ],
      "The chapter warns that metrics influence behavior because people respond to what gets praised."
    ),
    question(
      "A student team reports average user satisfaction, but one important user group is steadily disengaging. What is the best interpretation?",
      "The average is hiding a segment level problem that needs a more precise view",
      [
        "The average proves the service is healthy enough",
        "The disengaging users are too small to matter",
        "The team should stop collecting feedback"
      ],
      "Ries wants the team to ask for which users the product is improving, not just whether one blended score looks good."
    ),
    question(
      "Which personal behavior best reflects the chapter's lesson?",
      "Choosing a metric that reveals whether the habit or project is solving the real problem",
      [
        "Checking the biggest available number because it feels motivating",
        "Avoiding all metrics to stay creative",
        "Changing metrics every day to keep things interesting"
      ],
      "The chapter's deeper message is that measurement should serve truth, not ego."
    ),
    question(
      "What is the chapter's broadest claim about measurement?",
      "Good metrics are a form of disciplined learning under uncertainty",
      [
        "Good metrics mainly exist to impress investors",
        "Good metrics matter only after a pivot",
        "Good metrics remove the need for judgment"
      ],
      "Measurement matters because it improves how the team sees reality and acts on it."
    ),
  ],
});

CHAPTER_CONTENT["ch08-pivot-or-persevere"] = chapter({
  summary: {
    p1: t(
      "Teams must periodically decide whether to change direction or keep going. Ries treats a pivot as a structured correction designed to test a new strategic hypothesis, not as panic or aimless reinvention.",
      "Perseverance is only disciplined when evidence still supports the current path. Without that evidence, persistence can quietly become denial.",
      "This chapter matters because startups often die in the space between obvious failure and honest adjustment. People keep working, but the strategy stops evolving."
    ),
    p2: t(
      "This matters because sunk cost, identity, and internal politics make weak plans feel harder to leave than they should. The deeper lesson is that change becomes easier when teams define learning milestones early and review them on purpose instead of waiting for a crisis.",
      "A pivot meeting gives evidence a formal place to outrank momentum. It turns change from a personal embarrassment into a strategic decision.",
      "Ries is not praising restless change. He is protecting the team from the opposite failure, which is using steady effort to defend a hypothesis the market has already weakened."
    ),
  },
  standardBullets: [
    bullet(
      "Persevere and pivot are both strategic choices. Neither one is automatically more mature or more brave.",
      "What matters is whether the evidence still supports the current hypothesis."
    ),
    bullet(
      "A pivot is a structured correction. It preserves learning while changing the part of the strategy that no longer holds.",
      "That makes a pivot different from starting over blindly or reacting to every wobble."
    ),
    bullet(
      "Regular review points matter. Teams need moments where they ask explicitly whether the plan still deserves commitment.",
      "Without that cadence, momentum keeps running long after the evidence turns weak."
    ),
    bullet(
      "Sunk cost distorts judgment. The more time and identity invested, the harder it feels to admit a weak path.",
      "Ries wants milestones and evidence to challenge that emotional pressure before it calcifies."
    ),
    bullet(
      "Learning milestones make change easier to judge. The team should know what it hoped to prove and what result would count as progress.",
      "Then a pivot becomes a reasoned response rather than a vague mood shift."
    ),
    bullet(
      "Small tweaks can hide big problems. Minor feature changes sometimes postpone the deeper strategic decision that is actually needed.",
      "The chapter warns against confusing local optimization with a real answer to a flawed direction."
    ),
    bullet(
      "Pivots come in different forms. Customer segment, need, channel, value capture, and other shifts can all preserve part of what was learned.",
      "That variety matters because change does not always mean abandoning the whole mission."
    ),
    bullet(
      "Clear communication protects morale. A team handles change better when it understands what was learned and why the shift follows from that learning.",
      "Otherwise a pivot can feel arbitrary even when it is correct."
    ),
    bullet(
      "Waiting for certainty is costly. The market rarely provides perfect proof before a change becomes necessary.",
      "A disciplined team acts when the weight of evidence is strong enough, not when doubt disappears entirely."
    ),
    bullet(
      "The deeper skill is learning how to leave the wrong path in time. Good judgment is not just about working hard. It is about redirecting effort before waste compounds.",
      "That is why pivot or persevere becomes one of the central leadership moments in the book."
    ),
  ],
  deeperBullets: [
    bullet(
      "A pivot is often emotionally harder than a product change because it challenges the story the team has been telling itself.",
      "Ries is asking leaders to build a culture where correction is respected rather than quietly punished."
    ),
    bullet(
      "Too much persistence can look like conviction from the inside and like avoidance from the outside. The difference is whether learning is still accumulating.",
      "If the same evidence keeps arriving and nothing strategic changes, perseverance has probably become inertia."
    ),
    bullet(
      "The right pivot preserves assets. Good teams carry forward insights, relationships, and technical learning even while changing direction.",
      "That is why a pivot is a refinement of strategy, not an admission that all prior work was worthless."
    ),
    bullet(
      "Indecision can be more damaging than a bold pivot. Lingering in between paths drains morale and clouds measurement.",
      "A team forced to half believe the old plan and half explore a new one often learns slowly in both directions."
    ),
    bullet(
      "This chapter quietly redefines discipline. Discipline is not stubborn consistency. It is consistent contact with evidence, even when evidence asks for a painful change.",
      "That deeper reading keeps the book from becoming either impulsive or rigid."
    ),
  ],
  takeaways: [
    "Persevere only with evidence",
    "A pivot is a structured correction",
    "Review the strategy on purpose",
    "Sunk cost distorts judgment",
    "Different pivots preserve learning",
    "Change before waste compounds",
  ],
  practice: [
    "Set the next review date now",
    "Write the learning milestone for the current strategy",
    "Name what evidence would trigger a change",
    "Separate small tweaks from real strategic shifts",
    "Explain the reason for change clearly to the team",
  ],
  examples: [
    example(
      "school",
      "Club service nobody uses",
      "A student club launches a peer support service and keeps adding little improvements even though the target students rarely use it and the real issue may be that the service solves the wrong problem.",
      [
        "Hold a real review that asks whether the core need assumption still stands",
        "Be willing to change the service direction instead of layering small fixes onto a weak concept"
      ],
      "The chapter matters because small improvements can become a way of avoiding the larger strategic decision."
    ),
    example(
      "school",
      "Campus project stuck between audiences",
      "Your team built a study tool for undergraduates, but the few enthusiastic users are graduate students. The team keeps debating whether to keep chasing the original audience anyway.",
      [
        "Look at the evidence and ask whether a customer segment pivot is stronger than continued hope",
        "Use the next cycle to test the audience that is already showing real need"
      ],
      "A pivot preserves learning by following where the evidence is stronger instead of clinging to the original story."
    ),
    example(
      "work",
      "Feature set with weak retention",
      "Your product has decent trial sign ups but poor repeat use. The team keeps debating small onboarding changes even though the deeper issue may be that the product solves a low urgency need.",
      [
        "Review whether the evidence points to a need or segment pivot rather than another surface tweak",
        "Define what result would justify staying on the current path"
      ],
      "The hidden problem is indecision. Without a real pivot or a real case for perseverance, the team keeps paying for fog."
    ),
    example(
      "work",
      "Founder attached to original vision",
      "A founder keeps the team on the same strategy because changing direction would feel like admitting the original pitch was wrong, even though the customer data keeps pointing elsewhere.",
      [
        "Reframe the change as a decision based on learning rather than as a referendum on personal worth",
        "Use the data to define the next hypothesis and test it cleanly"
      ],
      "Ries's deeper lesson is that identity can make bad strategies stick long after evidence weakens them."
    ),
    example(
      "personal",
      "Newsletter topic that never catches",
      "You keep publishing a newsletter on one topic because it matches your original plan, but readers only engage when you write about a related angle you treated as secondary.",
      [
        "Examine whether the engagement pattern is asking for a topic pivot rather than more persistence",
        "Run a focused test on the stronger angle before investing further in the weaker one"
      ],
      "This is pivot logic outside a startup. The question is whether evidence supports the current direction or points to a better one."
    ),
    example(
      "personal",
      "Volunteer program everyone is tired of defending",
      "You and friends keep running the same volunteer event format because so much effort has already gone into it, even though attendance and energy keep slipping.",
      [
        "Hold an honest review around what the event was supposed to prove and what the recent evidence says",
        "Choose either a meaningful format change or a clear reason to continue, not a tired middle ground"
      ],
      "The chapter warns that sunk cost can make persistence feel noble when it is mostly expensive drift."
    ),
  ],
  questions: [
    question(
      "What is a pivot in Ries's framework?",
      "A structured change to the strategy based on learning from the current path",
      [
        "A sign that the team failed and should start over randomly",
        "A small feature adjustment that avoids bigger questions",
        "A morale tactic used when growth slows"
      ],
      "Ries defines a pivot as a disciplined correction that preserves learning while changing the hypothesis."
    ),
    question(
      "Why are regular review points valuable?",
      "They create a formal moment for evidence to challenge momentum",
      [
        "They guarantee the team will pivot often",
        "They remove the need for metrics",
        "They make customer feedback less emotional"
      ],
      "Without deliberate review, teams often continue by inertia long after the evidence has weakened."
    ),
    question(
      "A team keeps making small interface changes while usage stays flat and the core value seems weak. What is the likely problem?",
      "Local tweaks are hiding the need for a larger strategic decision",
      [
        "The team is wisely persevering",
        "The team should stop measuring for a while",
        "The flat usage proves that the interface is already strong"
      ],
      "The chapter warns that minor optimization can become an excuse to avoid a more important pivot question."
    ),
    question(
      "What makes perseverance disciplined rather than stubborn?",
      "Continued evidence that the current hypothesis is still strengthening",
      [
        "A strong emotional attachment to the original vision",
        "The fact that a lot of time has already been invested",
        "The hope that more effort will eventually solve everything"
      ],
      "Perseverance is justified by learning, not by pride or sunk cost."
    ),
    question(
      "Why can sunk cost make weak strategies last too long?",
      "Because past investment creates emotional pressure to defend the path even when evidence weakens",
      [
        "Because sunk cost improves the original idea automatically",
        "Because customers respect persistence more than relevance",
        "Because pivoting is only valid before launch"
      ],
      "The chapter highlights sunk cost as a major distortion that milestones and reviews should counter."
    ),
    question(
      "A campus product built for undergraduates is only resonating with graduate students. What is the strongest interpretation?",
      "The evidence may support a customer segment pivot",
      [
        "The team should ignore the graduate users because they were not the plan",
        "The team should keep all messaging unchanged and wait longer",
        "The team should add more features before learning anything else"
      ],
      "A pivot follows the stronger evidence while preserving what the team has already learned."
    ),
    question(
      "What is lost when a team waits for total certainty before changing direction?",
      "Time, morale, and the chance to redirect effort while the correction is still cheaper",
      [
        "The opportunity to collect any more data",
        "The need for leadership judgment",
        "The value of all previous work"
      ],
      "Ries argues that the market rarely delivers perfect certainty before a pivot becomes wise."
    ),
    question(
      "Why can a good pivot help morale even though it changes the plan?",
      "Because it makes the learning legible and gives effort a clearer direction again",
      [
        "Because pivots always mean the hardest work is over",
        "Because teams enjoy change more than clarity",
        "Because morale depends only on novelty"
      ],
      "Clear reasoning helps a team experience the pivot as progress rather than as chaos."
    ),
    question(
      "Which statement best captures the chapter's deeper view of discipline?",
      "Discipline means staying loyal to evidence even when it asks for a painful change",
      [
        "Discipline means never changing the original plan",
        "Discipline means changing strategy whenever feedback feels discouraging",
        "Discipline means protecting the founder's confidence above all else"
      ],
      "The chapter reframes discipline as consistent contact with reality rather than rigid consistency."
    ),
    question(
      "What is the strongest summary of this chapter's practical lesson?",
      "Do not let momentum keep spending effort on a hypothesis that evidence has weakened",
      [
        "Do not pivot until the market fully rejects every feature",
        "Do not persevere once the first experiment disappoints",
        "Do not discuss strategy changes in front of the team"
      ],
      "Ries wants teams to make deliberate choices between change and continuation before waste compounds."
    ),
  ],
});

CHAPTER_CONTENT["ch09-batch"] = chapter({
  summary: {
    p1: t(
      "Smaller batches accelerate learning because they shorten the distance between action and feedback. Ries argues that large batches create queues, delay discovery, and hide mistakes until the cost of fixing them is much higher.",
      "This is not only a manufacturing point. It applies to product releases, design work, customer communication, and operational handoffs wherever work waits too long before reality responds.",
      "Batch size therefore becomes a strategic variable. It shapes how quickly the venture can notice, interpret, and correct its own errors."
    ),
    p2: t(
      "This matters because big launches often feel efficient on paper while quietly storing up rework. The deeper lesson is that small batches make mistakes cheaper, collaboration tighter, and learning loops faster.",
      "They also make process problems visible earlier. A large batch can hide weak coordination for weeks, while a small batch forces the team to face friction almost immediately.",
      "Ries's point is not that small is always pleasant. It is that smaller flow usually reveals truth sooner, and truth sooner is what keeps waste from compounding."
    ),
  },
  standardBullets: [
    bullet(
      "Batch size shapes learning speed. The larger the batch, the longer the team waits to discover whether the work helped.",
      "That delay makes correction slower and more expensive because more effort piles up behind each assumption."
    ),
    bullet(
      "Large batches hide defects. Errors can travel a long distance before anyone notices them.",
      "By the time the problem surfaces, many connected decisions may need rework too."
    ),
    bullet(
      "Small releases reduce rework. A quicker feedback cycle lets the team correct course before the mistake spreads widely.",
      "That is one reason smaller batches can be more efficient overall even if they feel less impressive at first."
    ),
    bullet(
      "Queue time is a real cost. Work sitting between stages delays learning even when everyone seems busy.",
      "Ries treats delay itself as a form of waste because it postpones the moment reality can teach the team."
    ),
    bullet(
      "Smaller batches improve handoffs. Teams understand one another's work better when pieces move through the system more often and at lower volume.",
      "That can reduce friction between design, engineering, operations, and customer facing functions."
    ),
    bullet(
      "Customers teach faster when releases are smaller. Each change gets a cleaner reaction because it is not buried inside a massive launch.",
      "This makes the meaning of the feedback easier to interpret."
    ),
    bullet(
      "Smaller scope lowers fear. People are more willing to release and learn when the cost of being wrong feels manageable.",
      "That makes batch size a cultural issue as well as an operational one."
    ),
    bullet(
      "One piece flow reveals process weakness. Small batches expose bottlenecks that large projects can hide behind momentum.",
      "The discomfort is useful because it shows where the system needs redesign."
    ),
    bullet(
      "Local efficiency can be misleading. A team may feel productive by accumulating large amounts of work, even while the whole system learns slowly.",
      "Ries keeps attention on overall flow and feedback rather than on isolated busyness."
    ),
    bullet(
      "Reducing batch size reduces distance from reality. That is the strategic benefit that makes the chapter important.",
      "Smaller movement lets the startup learn sooner, waste less, and adapt with lower cost."
    ),
  ],
  deeperBullets: [
    bullet(
      "Big batches often create false confidence. The longer a release stays internal, the more stories the team can build around it without challenge.",
      "Small batches interrupt that illusion by asking the market to respond sooner."
    ),
    bullet(
      "Queue length is often invisible because waiting looks quieter than active work. Yet waiting can be where the real waste lives.",
      "Ries is asking leaders to see delay as a strategic problem rather than as a neutral background condition."
    ),
    bullet(
      "Small batches make accountability sharper. When less is changing at once, it becomes easier to connect results to decisions.",
      "That improves learning because the team can see what likely caused the new behavior."
    ),
    bullet(
      "The chapter also challenges ego. Large launches let teams attach identity to a big reveal, while smaller batches require steadier humility.",
      "Learning often improves when the emotional theater around release size gets smaller."
    ),
    bullet(
      "Reducing batch size is not just operational tuning. It changes the venture's metabolism.",
      "The whole organization starts living closer to evidence and farther from delayed interpretation."
    ),
  ],
  takeaways: [
    "Batch size controls feedback speed",
    "Large batches hide defects",
    "Small releases cut rework",
    "Queue time is real cost",
    "Small flow exposes bottlenecks",
    "Learn closer to reality",
  ],
  practice: [
    "Shrink the next release scope",
    "Measure where work waits in line",
    "Ask which error is discovered too late",
    "Reduce one handoff bottleneck",
    "Choose faster feedback over bigger launches",
  ],
  examples: [
    example(
      "school",
      "Semester project saved for the end",
      "Your team waits until the week before the due date to show a full project draft, so major flaws appear only when there is no room left to respond well.",
      [
        "Break the work into smaller reviewable pieces much earlier",
        "Use each small check to catch errors before the whole project depends on them"
      ],
      "The chapter matters because large batches delay feedback until the cost of learning is much higher."
    ),
    example(
      "school",
      "Club event planned all at once",
      "A student club designs an entire event season before testing whether the first event format actually works for members.",
      [
        "Pilot one event pattern first instead of building the whole sequence on assumptions",
        "Use the early feedback to adjust before the rest of the work locks in"
      ],
      "Small batches make learning cheaper. Large commitments made too early mostly multiply rework."
    ),
    example(
      "work",
      "Quarterly release hiding bugs",
      "Your product team bundles months of work into one major release, and customer issues become hard to trace because too many changes landed at once.",
      [
        "Move toward smaller releases so problems surface closer to the changes that caused them",
        "Use the shorter loop to reduce rework and clarify what customers are reacting to"
      ],
      "The hidden problem is not only quality. It is that the team's learning loop has become too long to guide strategy well."
    ),
    example(
      "work",
      "Design approvals piling up",
      "Design work sits in review for weeks, then a huge batch of approved screens reaches engineering at once and overwhelms the team with late changes.",
      [
        "Reduce the approval batch and move work through in smaller units",
        "Treat waiting time as a problem to solve rather than as normal overhead"
      ],
      "This is exactly the kind of queue waste Ries is pointing to. Waiting delays learning even when nobody looks idle."
    ),
    example(
      "personal",
      "Creator project held until perfect",
      "You keep ten finished essays in a folder because you want a perfect launch sequence, but that means you are getting no signal on what readers actually respond to.",
      [
        "Publish in smaller batches so feedback can shape the next pieces sooner",
        "Use the early response to guide the sequence rather than locking everything in first"
      ],
      "The chapter applies personally because delayed release can quietly turn into delayed learning."
    ),
    example(
      "personal",
      "Home organization reset too large",
      "You try to reorganize your whole apartment in one weekend, become overwhelmed, and learn only at the end that your storage idea does not fit how you actually live.",
      [
        "Test the system in one smaller area first so the lesson arrives sooner",
        "Let each small adjustment teach you before the next one expands"
      ],
      "Smaller batches are not only for software. They are a practical way to lower the cost of discovering that the first plan was off."
    ),
  ],
  questions: [
    question(
      "Why do smaller batches help a startup learn faster?",
      "Because feedback arrives sooner and mistakes are discovered before more work piles up behind them",
      [
        "Because smaller batches always reduce the amount of total work",
        "Because customers prefer constant novelty over useful improvements",
        "Because large launches can never succeed"
      ],
      "The main value is shorter distance between action and feedback, which lowers the cost of correction."
    ),
    question(
      "What is a hidden cost of large batches?",
      "They can store up defects and rework while the team still feels productive",
      [
        "They automatically improve team morale",
        "They guarantee more accurate interpretation of customer feedback",
        "They eliminate the need for coordination"
      ],
      "Large batches can look efficient while quietly delaying the discovery of problems."
    ),
    question(
      "Why is queue time important in this chapter?",
      "Because waiting delays learning even when everyone appears busy",
      [
        "Because queue time only affects engineering",
        "Because queue time proves the team is prioritizing well",
        "Because waiting makes work higher quality by default"
      ],
      "Ries treats delay as waste because it pushes reality farther away from the decisions creating it."
    ),
    question(
      "What is the main advantage of releasing less at one time to customers?",
      "The feedback is easier to interpret because fewer things changed at once",
      [
        "Customers will always like smaller releases more",
        "The team no longer needs metrics",
        "The product can stop planning future work"
      ],
      "Smaller changes make it easier to connect customer reaction to the specific move that caused it."
    ),
    question(
      "A student team presents a full project only at the end and then discovers the core concept is weak. What principle was ignored?",
      "Smaller batches would have surfaced the weakness earlier when it was cheaper to respond",
      [
        "The team should have avoided feedback entirely",
        "The team should have added more features sooner",
        "The team should have trusted the original concept more strongly"
      ],
      "The chapter is about reducing the delay between work and learning."
    ),
    question(
      "How can small batches improve collaboration across functions?",
      "They create more frequent, lower risk handoffs that reveal friction earlier",
      [
        "They remove the need for coordination meetings entirely",
        "They allow each function to optimize in isolation",
        "They matter only after product market fit"
      ],
      "Smaller movement through the system helps teams spot and fix handoff problems before they grow."
    ),
    question(
      "Why can large launches feel emotionally attractive even when they are risky?",
      "They allow teams to attach identity and drama to a big reveal instead of steady learning",
      [
        "They always prove stronger customer demand",
        "They eliminate the possibility of errors",
        "They make queues disappear from the workflow"
      ],
      "The chapter quietly challenges the ego appeal of large batches because it can interfere with better learning."
    ),
    question(
      "What should a leader conclude if work often waits quietly between stages for days or weeks?",
      "The system is carrying hidden batch and queue waste that slows learning",
      [
        "The waiting is harmless because no one is actively struggling",
        "The team should add more reporting before changing the workflow",
        "The delay proves the upstream work is high quality"
      ],
      "Waiting is not neutral. It delays the moment reality can shape the next decision."
    ),
    question(
      "Which personal choice best applies the chapter?",
      "Testing a smaller version of a plan before committing the whole effort",
      [
        "Building the entire plan so feedback happens under ideal conditions",
        "Avoiding all release until the project feels complete",
        "Choosing the largest possible reset to stay motivated"
      ],
      "The principle is to reduce the cost of being wrong by learning in smaller steps."
    ),
    question(
      "What is the broadest strategic claim of this chapter?",
      "Reducing batch size moves the organization closer to reality and away from delayed waste",
      [
        "Reducing batch size matters only for manufacturing teams",
        "Reducing batch size is mainly a way to look agile",
        "Reducing batch size replaces the need for strategic judgment"
      ],
      "Ries is using batch size as a lever for faster learning, lower waste, and better adaptation."
    ),
  ],
});

CHAPTER_CONTENT["ch10-grow"] = chapter({
  summary: {
    p1: t(
      "Growth has distinct engines, and a startup gets stronger when it knows which one is actually driving compounding. Ries describes sticky, viral, and paid growth as different systems that each depend on different user behaviors and metrics.",
      "That means growth is not one generic problem with one generic solution. The right tactic depends on the engine the business is actually trying to strengthen.",
      "This chapter brings discipline to a part of startup talk that often becomes noisy fast. Instead of chasing growth in the abstract, Ries asks what mechanism turns one user into the next."
    ),
    p2: t(
      "This matters because teams often scatter energy across every growth tactic they can imagine. The deeper lesson is that growth is a system with constraints, so progress comes from understanding the engine, tuning its key variables, and recognizing when that engine starts to saturate.",
      "Retention becomes especially important here because weak product value can hide behind acquisition for only so long. A startup that grows without durable value may look bigger while staying fragile.",
      "Ries is also warning against shallow traction. If the team does not understand how growth really compounds, it can celebrate activity while the business remains structurally weak."
    ),
  },
  standardBullets: [
    bullet(
      "Growth is not one thing. Different businesses expand through different underlying engines.",
      "That means the team should stop borrowing growth advice without asking what mechanism actually applies."
    ),
    bullet(
      "Sticky growth depends on retention. Users keep the business alive when they stay long enough and churn stays low.",
      "If people do not come back, acquisition alone will struggle to build durable momentum."
    ),
    bullet(
      "Viral growth depends on users bringing more users. The product itself becomes part of the acquisition system.",
      "That requires behavior strong enough that people naturally invite or expose others to the product."
    ),
    bullet(
      "Paid growth depends on sound unit economics. Customer acquisition cost has to stay below the long term value of the customer.",
      "Without that balance, spending faster only scales the loss."
    ),
    bullet(
      "One engine should anchor focus at a time. Trying to optimize every path at once usually scatters learning.",
      "Ries wants the team to know what system it is actually strengthening."
    ),
    bullet(
      "Retention often tells the truth first. It reveals whether users continue receiving real value after the initial spike of curiosity.",
      "A weak retention pattern can expose fragility even when top line growth looks good."
    ),
    bullet(
      "Each engine has its own key metrics. What matters most for one model may be secondary for another.",
      "That is why growth measurement has to match the actual mechanism rather than generic dashboards."
    ),
    bullet(
      "Every engine saturates eventually. The same tactic cannot compound forever without limits.",
      "Recognizing that limit early helps the company avoid confusing slowdown with pure execution failure."
    ),
    bullet(
      "Growth work should stay tied to product learning. Tactics cannot permanently rescue a weak core value proposition.",
      "The engine works best when the product and the growth mechanism reinforce each other."
    ),
    bullet(
      "Sustainable growth comes from understanding the system, not from chasing every hack. That is the chapter's practical center.",
      "When the mechanism is clear, the team can tune it with far less wasted effort."
    ),
  ],
  deeperBullets: [
    bullet(
      "Growth confusion often comes from mixing mechanisms. A team may talk about virality while relying mostly on paid acquisition or retention.",
      "That conceptual blur makes strategy sloppy because the wrong metrics receive attention."
    ),
    bullet(
      "A fast top line can hide a weak engine. If users arrive but do not stay, refer, or justify acquisition cost, the growth is less stable than it appears.",
      "Ries is asking whether the engine truly compounds or only looks busy."
    ),
    bullet(
      "The bottleneck depends on the engine. Sticky businesses must study churn, viral businesses must study invitation behavior, and paid businesses must study unit economics.",
      "That makes prioritization sharper because not every growth problem deserves equal energy."
    ),
    bullet(
      "Engine choice is partly strategic discipline. It forces the team to accept what kind of game it is really playing instead of fantasizing about all possible games at once.",
      "This is often harder than it sounds because founders may prefer the glamour of one engine while the evidence supports another."
    ),
    bullet(
      "The chapter also protects against magical thinking. Sustainable growth is not a slogan about momentum. It is a repeatable mechanism that can be measured, tuned, and eventually exhausted.",
      "That framing makes growth more rigorous and less theatrical."
    ),
  ],
  takeaways: [
    "Growth uses distinct engines",
    "Sticky growth depends on retention",
    "Viral growth depends on sharing",
    "Paid growth depends on unit economics",
    "Focus on one engine clearly",
    "Top line growth can mislead",
  ],
  practice: [
    "Name the main growth engine",
    "Choose the metric that reveals that engine",
    "Check retention honestly",
    "Identify the current bottleneck",
    "Stop chasing tactics outside the engine",
  ],
  examples: [
    example(
      "school",
      "Campus tool with weak return use",
      "A study app gets a burst of sign ups from campus promotion, but most students stop using it after two sessions and the team keeps talking about growth as if downloads solved the problem.",
      [
        "Treat retention as the key signal if the product needs sticky growth to work",
        "Fix the reason students are not coming back before chasing more promotion"
      ],
      "The hidden issue is engine confusion. Acquisition volume cannot rescue a weak sticky engine for long."
    ),
    example(
      "school",
      "Club platform hoping for virality",
      "A student platform assumes users will invite friends, but the product gives them no strong reason to share and no moment where sharing fits naturally.",
      [
        "Test whether user behavior actually supports a viral loop instead of assuming it will emerge",
        "If sharing is weak, stop treating virality as the growth engine without evidence"
      ],
      "The chapter matters because different engines require different customer behaviors. Hope is not a growth mechanism."
    ),
    example(
      "work",
      "Paid ads covering weak value",
      "Your company is buying lots of traffic and celebrating user growth, but retention is poor and the lifetime value of many customers appears lower than acquisition cost.",
      [
        "Examine whether the paid engine is truly sustainable before spending more",
        "Use the data to improve value or change the growth logic rather than scaling a weak equation"
      ],
      "Ries would say growth is only meaningful when the engine actually compounds instead of quietly burning cash."
    ),
    example(
      "work",
      "Product team chasing every channel",
      "A team tries referrals, content, partnerships, and paid ads all at once, yet no one can explain which engine is primary or what variable is improving.",
      [
        "Choose the engine the evidence supports and focus the next cycle there",
        "Measure the bottleneck that belongs to that engine instead of spreading attention across everything"
      ],
      "The chapter argues that scattered growth work usually slows learning because the system itself never becomes clear."
    ),
    example(
      "personal",
      "Newsletter growth by random tactics",
      "You try social clips, guest posts, paid boosts, and referral prompts for your newsletter without knowing which behavior actually keeps growth going after the initial push.",
      [
        "Ask what engine is realistically available for this project and measure it honestly",
        "Stop copying tactics that do not support the actual mechanism of growth"
      ],
      "This scenario shows why growth advice gets noisy fast. Without an engine in mind, every tactic feels possible and none becomes legible."
    ),
    example(
      "personal",
      "Coaching practice with low repeat value",
      "You get new clients through your network, but few clients return or refer others, and you keep assuming growth will sort itself out if you market harder.",
      [
        "Check whether the service has enough value to create repeat use or referrals before pushing promotion harder",
        "Let the right engine guide what you improve next"
      ],
      "The chapter warns against treating acquisition as the whole story when the engine depends on deeper customer behavior."
    ),
  ],
  questions: [
    question(
      "Why does Ries separate growth into distinct engines?",
      "Because different businesses compound through different mechanisms and need different metrics",
      [
        "Because growth should only be studied after profitability",
        "Because one universal tactic works best for all startups",
        "Because product teams should avoid thinking about growth early"
      ],
      "The chapter adds discipline by tying growth strategy to the mechanism that actually drives compounding."
    ),
    question(
      "What is the key question in a sticky growth engine?",
      "Whether users stay long enough and churn low enough for growth to compound",
      [
        "Whether the brand looks premium enough",
        "Whether paid acquisition volume is high this week",
        "Whether the product can support every possible segment"
      ],
      "Sticky growth lives or dies by retention, so user return behavior becomes central."
    ),
    question(
      "What does a viral growth engine rely on?",
      "Users naturally bringing in additional users through product linked behavior",
      [
        "A larger feature roadmap",
        "High margins on every customer",
        "Quarterly advertising bursts"
      ],
      "Viral growth depends on user actions that create the next wave of acquisition."
    ),
    question(
      "Why can top line growth be misleading?",
      "Because acquisition can rise while retention, referrals, or unit economics remain weak",
      [
        "Because growth numbers are always vanity metrics",
        "Because every startup should ignore user counts",
        "Because only qualitative research matters"
      ],
      "Ries asks whether growth is structurally sustainable, not just whether the number moved upward."
    ),
    question(
      "A team is buying users faster than those users create long term value. Which engine logic is failing?",
      "Paid growth",
      [
        "Sticky growth only",
        "Viral growth only",
        "Every engine at once by definition"
      ],
      "Paid growth depends on acquisition cost staying below customer lifetime value. Without that, scaling spend scales the problem."
    ),
    question(
      "Why is focusing on one engine at a time useful?",
      "It keeps learning concentrated on the mechanism that actually matters instead of scattering effort",
      [
        "It guarantees that all other channels stop mattering forever",
        "It makes retention irrelevant for the rest of the company",
        "It removes the need to understand customers deeply"
      ],
      "The chapter values focus because growth systems become clearer when one mechanism is being tuned deliberately."
    ),
    question(
      "A campus product gets many sign ups from promotion but almost no repeat use. What should the team study first if the product needs sticky growth?",
      "Why users are not returning",
      [
        "How to buy even more promotion immediately",
        "How to make the logo more memorable",
        "How to add every requested feature at once"
      ],
      "If the engine is sticky, retention tells the truth before new acquisition does."
    ),
    question(
      "What does saturation mean in this chapter?",
      "An engine can eventually stop compounding at the same rate even if the tactic once worked well",
      [
        "The product is fully validated forever",
        "The team should stop measuring growth",
        "Customers no longer matter to strategy"
      ],
      "Ries notes that every engine has limits, which is why the team must understand the mechanism rather than worship one tactic."
    ),
    question(
      "Which personal choice best reflects the chapter?",
      "Identify the real mechanism through which new users or clients arrive and strengthen that system deliberately",
      [
        "Copy as many growth tricks as possible in parallel",
        "Assume demand will compound if the project feels exciting",
        "Ignore retention because growth is about acquisition only"
      ],
      "The chapter's deeper lesson is that growth becomes manageable when the mechanism is named and measured."
    ),
    question(
      "What is the chapter's broadest warning?",
      "Do not confuse noisy activity around growth with a real engine of growth",
      [
        "Do not invest in growth until the product is perfect",
        "Do not use metrics when thinking about growth",
        "Do not change the engine even when evidence points elsewhere"
      ],
      "Ries is trying to replace vague traction talk with a repeatable, measurable understanding of compounding."
    ),
  ],
});

CHAPTER_CONTENT["ch11-adapt"] = chapter({
  summary: {
    p1: t(
      "Adaptive organizations learn faster because they treat problems as signals about the system, not just as isolated mistakes by individuals. Ries argues that speed does not require sloppy work. It requires processes that can improve as the company grows.",
      "The Five Whys method becomes central here because it helps teams trace visible failures back to root causes and make proportionate improvements.",
      "This chapter shifts lean thinking from product strategy into daily operations. The same discipline of learning now applies to how the organization itself behaves under stress."
    ),
    p2: t(
      "This matters because growth often breaks the habits that once made a startup fast. The deeper lesson is that quality problems, recurring fire drills, and hero culture are usually system problems in disguise, and they become more expensive when leaders treat them as one off events.",
      "Ries wants teams to invest just enough in prevention each time they learn. That balance protects speed without burying the company in process it does not yet need.",
      "The chapter's challenge is maturity without bureaucracy. The organization must become better at learning from failure without losing the agility that made learning possible in the first place."
    ),
  },
  standardBullets: [
    bullet(
      "Problems are system signals. Visible errors often reveal a deeper weakness in process, communication, or training.",
      "That perspective turns failure into a learning opportunity rather than into a search for someone to blame."
    ),
    bullet(
      "Speed and quality are not enemies. Poor quality creates delays later even if it feels fast in the moment.",
      "Ries is pushing against the idea that startups must choose between moving quickly and building responsibly."
    ),
    bullet(
      "Five Whys helps teams reach root causes. Asking why repeatedly can uncover the process failure underneath the immediate symptom.",
      "The method is useful because many recurring problems have a human and system component, not just a technical one."
    ),
    bullet(
      "Fixes should be proportionate. One problem does not justify a giant process overhaul every time.",
      "The company should invest enough to reduce recurrence without burying itself in heavy bureaucracy."
    ),
    bullet(
      "Blame blocks learning. If people fear punishment for surfacing a mistake, the system becomes slower and less honest.",
      "Adaptive organizations need psychological room to investigate what went wrong."
    ),
    bullet(
      "Recurring errors are expensive clues. When the same type of breakdown keeps happening, the process is asking to be redesigned.",
      "Ignoring repetition simply turns the same lesson into a growing tax."
    ),
    bullet(
      "Just in time process building is healthier than early overengineering. Teams should add structure where real strain appears.",
      "This keeps the organization practical while it is still evolving."
    ),
    bullet(
      "Heroics can be warning signs. If the company constantly depends on rescue behavior, the system is weaker than the culture admits.",
      "Ries wants sustainable learning, not recurring emergencies disguised as dedication."
    ),
    bullet(
      "Leaders must join the diagnosis. Root cause work is not only an operational chore for junior staff.",
      "Leadership choices shape incentives, resourcing, and standards, so leaders have to be part of the learning loop."
    ),
    bullet(
      "Adaptation lets growth add capability instead of chaos. That is the operational promise of the chapter.",
      "A company that learns from its own failures can move faster over time because the same weakness stops draining it repeatedly."
    ),
  ],
  deeperBullets: [
    bullet(
      "Five Whys works best when the goal is understanding, not prosecution. The method collapses if each why becomes a hunt for a guilty person.",
      "Ries wants the inquiry to end in prevention and support, not fear."
    ),
    bullet(
      "Quality debt behaves like product debt. Shortcuts that seem efficient now can slow the whole organization later.",
      "That is why the chapter treats prevention as an investment rather than as administrative drag."
    ),
    bullet(
      "Adaptive organizations learn in the process layer, not just in the product layer. They improve how work moves, how handoffs happen, and how decisions are surfaced.",
      "This widens lean thinking from startup tactics into organizational design."
    ),
    bullet(
      "Overreaction is also a risk. A team can turn one painful failure into a heavy control system that slows everything afterward.",
      "Proportion is the quiet discipline in the chapter. Learn seriously without smothering the company."
    ),
    bullet(
      "The chapter is partly about respect for people. When the system is designed better, fewer preventable mistakes fall on individual shoulders.",
      "That makes adaptation not only efficient but also more humane."
    ),
  ],
  takeaways: [
    "Problems expose systems",
    "Speed needs quality too",
    "Use Five Whys carefully",
    "Fix root causes proportionately",
    "Blame blocks adaptation",
    "Heroics can hide weakness",
  ],
  practice: [
    "Run Five Whys on one recurring problem",
    "Find one shortcut that creates later rework",
    "Add one preventive process step",
    "Remove blame from the diagnosis conversation",
    "Watch for repeated heroics as a signal",
  ],
  examples: [
    example(
      "school",
      "Group project rescued at midnight again",
      "Your project team keeps relying on one organized student to fix everything the night before deadlines, and the team keeps calling this dedication instead of asking why the same crisis repeats.",
      [
        "Treat the repeated rescue as a system signal rather than as proof the team is fine",
        "Ask why the late scramble keeps happening and add a lighter process fix before the next deadline"
      ],
      "The chapter matters because heroics can hide the real weakness. Adaptation starts when the team studies the pattern instead of praising the rescue."
    ),
    example(
      "school",
      "Lab mistakes blamed on one person",
      "A lab partner enters the wrong data twice, and the group wants to blame carelessness without asking whether the handoff instructions and review steps are too weak.",
      [
        "Use a root cause discussion to see whether the process invites the same mistake",
        "Add a proportionate check that prevents recurrence without making the whole lab cumbersome"
      ],
      "Ries would say the mistake is data about the system too. The point is not to remove responsibility. It is to improve the process that keeps producing the error."
    ),
    example(
      "work",
      "Bug fire drill every release",
      "A team has a major release bug almost every cycle and fixes it through late nights, yet nobody changes the review, testing, or handoff process behind the pattern.",
      [
        "Run a Five Whys review after the issue and identify the upstream process change that would lower recurrence",
        "Invest enough in prevention that the team stops paying the same emergency cost each cycle"
      ],
      "The hidden cost is not only the bug. It is the repeated organizational weakness that keeps turning into last minute panic."
    ),
    example(
      "work",
      "New hire confusion treated as personal weakness",
      "Several new hires make similar onboarding mistakes, and managers keep saying the hires are careless even though the instructions are vague and undocumented.",
      [
        "Read the repeated pattern as a process problem and improve onboarding where the confusion actually begins",
        "Use the mistake to build just enough structure for the next hire"
      ],
      "This is adaptive thinking in action. Repetition is a clue that the system needs to learn."
    ),
    example(
      "personal",
      "Fitness routine keeps collapsing the same way",
      "You restart the same workout plan several times, and each attempt fails when busy weeks hit, yet you keep blaming motivation instead of examining the design of the routine.",
      [
        "Ask why the plan breaks under pressure and redesign the system around the real weak point",
        "Add one proportionate safeguard instead of creating a huge life overhaul"
      ],
      "The chapter applies personally because repeated breakdowns often reveal system flaws, not only character flaws."
    ),
    example(
      "personal",
      "Volunteer group with repeating miscommunication",
      "Your volunteer team keeps double booking tasks, and every time people apologize and move on without changing how assignments are recorded or confirmed.",
      [
        "Treat the repeated confusion as a process issue and trace where the miscommunication starts",
        "Add a small clear confirmation step that prevents the same problem from recurring"
      ],
      "Adaptation means using the mistake to improve the system rather than reliving the same lesson again."
    ),
  ],
  questions: [
    question(
      "What does it mean to treat problems as system signals?",
      "It means asking what process weakness made the failure likely instead of stopping at blame",
      [
        "It means removing personal responsibility from all mistakes",
        "It means assuming every issue is technical",
        "It means ignoring urgent fixes until a full review is complete"
      ],
      "Ries wants failures to teach the organization something about how the work is set up."
    ),
    question(
      "Why does Ries reject the tradeoff between speed and quality?",
      "Because poor quality creates delays and rework that slow the company later",
      [
        "Because startups should optimize quality above all else",
        "Because speed only matters in the earliest stage",
        "Because quality problems never affect growth"
      ],
      "The chapter argues that quality protects future speed by preventing repeated failure costs."
    ),
    question(
      "What is the purpose of Five Whys?",
      "To trace a visible problem back to the root causes that made it likely",
      [
        "To identify the person most at fault",
        "To create as much documentation as possible",
        "To prove that the first explanation was correct"
      ],
      "The method is designed to improve prevention, not to intensify blame."
    ),
    question(
      "Why should process fixes be proportionate?",
      "Because one painful failure does not justify burying the team in excessive bureaucracy",
      [
        "Because recurring problems usually solve themselves",
        "Because process never helps startups",
        "Because leaders should avoid any operational changes during growth"
      ],
      "Ries wants adaptive organizations, not heavy systems built from fear."
    ),
    question(
      "What is a warning sign of unhealthy operations in this chapter?",
      "The company repeatedly depends on heroics to survive predictable issues",
      [
        "The company ships smaller batches",
        "The company reviews failures after launch",
        "The company documents root causes"
      ],
      "Heroics can feel admirable while quietly revealing that the system is weaker than it should be."
    ),
    question(
      "A team sees the same onboarding mistake from several new hires. What is the strongest interpretation?",
      "The process likely needs improvement because the pattern is repeating across people",
      [
        "Each new hire is independently careless",
        "The hiring standard should be ignored",
        "The best response is a strict punishment policy"
      ],
      "Repeated errors are a clue that the system is generating confusion, not just that individuals are failing."
    ),
    question(
      "Why can blame make an organization less adaptive?",
      "Because people hide or soften problems when surfacing them feels unsafe",
      [
        "Because blame makes quality less important",
        "Because blame removes all standards",
        "Because blame always reduces short term output immediately"
      ],
      "Adaptive learning requires honest information. Fear makes information worse."
    ),
    question(
      "Which personal action best reflects the chapter?",
      "Redesign the routine around the repeated failure point instead of only criticizing yourself",
      [
        "Assume the pattern proves you lack discipline forever",
        "Start a much more complex routine after each slip",
        "Ignore the repeated failure because motivation changes daily"
      ],
      "The chapter turns recurring breakdowns into system clues that can improve the next attempt."
    ),
    question(
      "What larger shift is happening in this chapter compared with earlier ones?",
      "Lean thinking is now being applied to the organization's own processes, not only to the product",
      [
        "The book is abandoning experimentation for operations",
        "The book is shifting from evidence to intuition",
        "The book is arguing that process problems matter only in large firms"
      ],
      "Ries is extending the same learning logic inward so the company can adapt as it grows."
    ),
    question(
      "What is the chapter's deepest operational lesson?",
      "A company grows better when it learns from repeated failure without burying itself in fear driven process",
      [
        "A company grows best when it avoids all process until late stage scale",
        "A company grows best by rewarding the people who rescue every crisis",
        "A company grows best when it treats every issue as an isolated mistake"
      ],
      "The goal is maturity without bureaucracy, using proportionate learning to make growth more sustainable."
    ),
  ],
});

CHAPTER_CONTENT["ch12-innovation-accounting"] = chapter({
  summary: {
    p1: t(
      "Account for learning like a real asset. Ries argues that early innovation needs a form of accounting that can judge progress before normal financial results are visible, because standard metrics often kill uncertain work too soon.",
      "Innovation accounting gives startups and internal venture teams staged milestones so they can show what they learned, decide whether to pivot, and justify continued investment without pretending they are already mature businesses.",
      "This chapter is what makes uncertainty legible inside organizations that trust numbers but often trust the wrong numbers at the wrong time."
    ),
    p2: t(
      "This matters because new initiatives are easy to dismiss when the scoreboard expects immediate efficiency or revenue. The deeper lesson is that promising innovation needs protected space, clear learning goals, and a review system that respects the stage of the venture.",
      "Ries is not asking leaders to suspend accountability. He is asking them to move accountability toward baselines, tuned experiments, and evidence of improved assumptions.",
      "Without that shift, the organizational immune system wins by default. Novel efforts look weak not because the idea has failed, but because they are judged by measures designed for a different kind of work."
    ),
  },
  standardBullets: [
    bullet(
      "Early innovation needs different accounting. Standard financial results often arrive too late to guide the first strategic choices.",
      "A startup still needs accountability, but the accountability has to match what can reasonably be known at that stage."
    ),
    bullet(
      "Innovation accounting begins with a baseline. The team needs an honest picture of current user behavior before claiming improvement.",
      "That baseline becomes the starting point for learning rather than a vague sense that the product is getting better."
    ),
    bullet(
      "The next task is to tune the engine. Teams run experiments meant to improve the metrics that actually matter to the model.",
      "This turns progress into a staged process rather than into a single dramatic verdict."
    ),
    bullet(
      "Then comes the pivot or persevere decision. The accounting system should support a clear strategic judgment, not endless drift.",
      "That link to decision making keeps the metrics tied to action."
    ),
    bullet(
      "Learning milestones make uncertainty discussable. Leaders can fund, question, and compare new efforts using evidence that fits the stage.",
      "This helps innovation become governable without forcing false precision."
    ),
    bullet(
      "Internal startups need protection from the corporate immune system. Existing organizations naturally trust mature metrics and habits.",
      "Without a different scoreboard, internal innovation is often rejected before it has learned enough to deserve a fair verdict."
    ),
    bullet(
      "Autonomy still needs accountability. A protected team should not become an unexamined hobby inside the organization.",
      "Innovation accounting gives leaders a way to review progress seriously without demanding impossible certainty."
    ),
    bullet(
      "Scarce but stable resources matter. Teams need enough support to run meaningful tests, not so little that every lesson is distorted by starvation.",
      "Ries is balancing discipline with realism about what learning requires."
    ),
    bullet(
      "Metrics shape what an institution takes seriously. If the measure ignores learning, the organization will underinvest in real innovation.",
      "That makes accounting design a strategic choice, not merely an administrative one."
    ),
    bullet(
      "What gets measured gets defended. Innovation accounting is how early learning earns legitimacy inside systems built for later stage performance.",
      "That closing insight explains why this chapter matters beyond startups alone."
    ),
  ],
  deeperBullets: [
    bullet(
      "A baseline protects against flattering stories. Teams often claim improvement without first establishing what normal behavior looked like.",
      "Ries wants the starting point recorded clearly so later change means something."
    ),
    bullet(
      "The chapter also reframes governance. Good oversight does not mean treating every project alike. It means matching review to the kind of uncertainty involved.",
      "That is a deeper form of rigor than simply applying one financial template to everything."
    ),
    bullet(
      "Innovation accounting reduces false negatives inside institutions. A good idea may look weak for a while if the measure expects mature outcomes too soon.",
      "The right scoreboard buys enough time for reality to answer the question fairly."
    ),
    bullet(
      "Protected space without milestones becomes indulgence, while milestones without protected space become theater. The strength comes from combining both.",
      "Ries is designing a middle path between chaos and bureaucracy."
    ),
    bullet(
      "The broader lesson is that accounting systems are cultural weapons. They can either make learning visible or quietly punish it.",
      "That is why innovation accounting belongs in a book about entrepreneurship rather than only in a finance handbook."
    ),
  ],
  takeaways: [
    "Early innovation needs new accounting",
    "Start with a baseline",
    "Tune the engine before judging",
    "Tie milestones to pivot decisions",
    "Protect internal startups wisely",
    "Metrics decide what gets funded",
  ],
  practice: [
    "Write the current baseline clearly",
    "Define the next learning milestone",
    "Choose the metric that reflects improvement",
    "Set the next pivot or persevere review",
    "Ask whether the project is judged by the right scoreboard",
  ],
  examples: [
    example(
      "school",
      "Campus incubator judged like a finished business",
      "An entrepreneurship program expects student teams to show meaningful revenue within weeks, even though the teams are still learning whether their users care about the problem.",
      [
        "Use staged learning milestones so teams can show progress before mature results are realistic",
        "Judge the early work by baseline evidence and tested improvement rather than by instant revenue"
      ],
      "The hidden problem is not lack of standards. It is using a scoreboard designed for later stage businesses on ventures still proving the basics."
    ),
    example(
      "school",
      "Innovation lab without a baseline",
      "A class innovation lab keeps saying a new service is improving, but nobody wrote down how users behaved before the last set of changes.",
      [
        "Establish the current baseline before claiming progress",
        "Use the next round of changes to measure improvement against something real"
      ],
      "The chapter matters because learning becomes vague when a team never records where it started."
    ),
    example(
      "work",
      "Internal venture starved by normal KPIs",
      "A large company expects a new internal product team to hit the same margin targets as established products, so the team cuts experiments to protect short term optics.",
      [
        "Create an innovation accounting path that tracks learning milestones first",
        "Give the team enough protected runway to test the core assumptions before demanding mature economics"
      ],
      "Ries would say the immune system is winning here. The wrong scoreboard is strangling the very learning the company claims to want."
    ),
    example(
      "work",
      "Skunkworks team with no accountability",
      "A small innovation team has freedom and budget but no clear milestone system, so executives cannot tell whether the project is learning responsibly or drifting.",
      [
        "Add baseline metrics and stage based learning goals so autonomy is paired with real review",
        "Use those milestones to make future funding decisions clearer"
      ],
      "Protected space only works when it is paired with accountability that fits uncertain work."
    ),
    example(
      "personal",
      "Side business judged by mature standards too soon",
      "You start a small coaching business and feel discouraged because it is not producing stable monthly income immediately, even though you are still learning which offer and audience actually fit.",
      [
        "Set early milestones around validated demand and repeatable client behavior instead of mature revenue expectations",
        "Use those milestones to judge whether the idea is improving or needs a change"
      ],
      "The chapter applies personally because the wrong scoreboard can make a promising project look weaker than it really is at its current stage."
    ),
    example(
      "personal",
      "Creative project with no baseline",
      "You keep redesigning a membership offering and telling yourself it is getting better, but you have no baseline on conversion, retention, or engagement to show whether the changes help.",
      [
        "Record the current behavior before changing more variables",
        "Treat the next round like an accountable learning cycle rather than a string of hopeful edits"
      ],
      "Innovation accounting starts with a baseline because improvement only means something against a real starting point."
    ),
  ],
  questions: [
    question(
      "Why does early innovation need a different accounting system?",
      "Because normal financial results often appear too late and judge uncertain work by the wrong standards",
      [
        "Because early teams should avoid accountability",
        "Because financial metrics never matter in any venture",
        "Because innovation succeeds best when leaders stop reviewing it"
      ],
      "Ries is shifting accountability, not removing it. The accounting has to fit what can be learned at the current stage."
    ),
    question(
      "What is the first step in innovation accounting?",
      "Establishing a truthful baseline for current behavior",
      [
        "Choosing a pivot before collecting any data",
        "Launching the full feature set",
        "Comparing the project to mature business units immediately"
      ],
      "The baseline matters because improvement cannot be judged clearly without knowing where the team started."
    ),
    question(
      "What is the purpose of tuning the engine?",
      "To improve the metrics that matter to the model before deciding whether the strategy deserves continued commitment",
      [
        "To avoid all future pivots",
        "To make the company look more efficient to outsiders",
        "To delay measurement until the product is complete"
      ],
      "Tuning sits between baseline and the pivot or persevere decision in Ries's sequence."
    ),
    question(
      "Why do internal startups often need protection inside large organizations?",
      "Because mature systems tend to judge them with scorecards built for proven businesses",
      [
        "Because internal startups should never face review",
        "Because large organizations cannot innovate at all",
        "Because customer learning only happens in small companies"
      ],
      "The chapter highlights the organizational immune system that can reject uncertain work too early."
    ),
    question(
      "What goes wrong if a protected innovation team has no milestones?",
      "Autonomy turns into drift because leaders cannot tell whether learning is actually happening",
      [
        "The team automatically becomes more creative",
        "The project becomes fully validated by default",
        "The company no longer needs a baseline"
      ],
      "Ries wants protection and accountability together. One without the other creates its own failure mode."
    ),
    question(
      "What deeper role do metrics play in this chapter?",
      "They determine what an institution treats as serious and worth funding",
      [
        "They mainly help teams feel more motivated",
        "They replace strategy discussions completely",
        "They matter only once a venture is profitable"
      ],
      "Accounting systems shape organizational attention, which is why the choice of metric becomes strategic."
    ),
    question(
      "A student venture is told to prove full commercial success before it has validated demand. What is the best response?",
      "Show progress through baseline learning and tested improvement instead of pretending maturity too soon",
      [
        "Hide the uncertainty and promise aggressive revenue numbers",
        "Avoid measurement until the semester ends",
        "Treat the criticism as proof that the idea is wrong"
      ],
      "The strongest response preserves accountability while matching it to the real stage of the venture."
    ),
    question(
      "Why can a good idea become a false negative inside a large organization?",
      "Because it may be judged by mature outcome metrics before it has enough time to learn properly",
      [
        "Because large organizations always reject customer insight",
        "Because good ideas never need a baseline",
        "Because revenue is irrelevant to long term success"
      ],
      "Innovation accounting reduces this risk by giving early work a fairer, stage appropriate measure."
    ),
    question(
      "Which personal action best applies the chapter?",
      "Judge an early project by validated progress toward a repeatable model, not by mature income expectations immediately",
      [
        "Assume the project failed if revenue is not stable right away",
        "Ignore numbers completely until the project feels established",
        "Set goals based only on how much work you complete"
      ],
      "The same accounting problem can distort personal ventures if the scoreboard expects a late stage result too early."
    ),
    question(
      "What is the chapter's broadest claim?",
      "The scoreboard chosen for uncertain work can either reveal learning or quietly punish it",
      [
        "Every project should use one universal set of metrics",
        "Accounting is mostly separate from entrepreneurial strategy",
        "Innovation succeeds only when it avoids measurement"
      ],
      "Ries is showing that measurement systems are part of how innovation survives inside real institutions."
    ),
  ],
});

CHAPTER_CONTENT["ch13-sustainable-growth-and-culture"] = chapter({
  summary: {
    p1: t(
      "Long term success needs discipline and culture because lean methods fail when they survive only as isolated tactics. Ries ends the main argument by treating waste as the real enemy, especially the waste of time, talent, and creativity spent building the wrong things or learning too slowly.",
      "That turns lean startup from a set of tricks into a way of running an organization. The culture has to keep truth, customer contact, and disciplined experimentation alive after the first burst of startup energy fades.",
      "This chapter matters because many teams adopt the visible habits of lean while keeping the deeper cultural incentives that reward vanity, overbuilding, and status protection."
    ),
    p2: t(
      "This matters because organizations naturally drift back toward comforting stories unless leaders keep the system aligned with evidence. The deeper lesson is that durable innovation depends on norms: short feedback loops, respect for customers, honest review of waste, and the willingness to stop work that no longer earns its keep.",
      "Culture shows up in what gets funded, praised, postponed, and quietly tolerated. If those signals reward appearance over learning, lean language will not save the organization.",
      "Ries is asking for a discipline that protects creativity rather than constraining it. When waste becomes normal, the real loss is often hidden in abandoned initiative, slow correction, and customers who stop trusting the team to listen."
    ),
  },
  standardBullets: [
    bullet(
      "Lean is a culture before it is a toolkit. Methods last only when the surrounding norms support honest learning.",
      "That means leaders have to care about incentives and habits, not only about the visible practices people copy."
    ),
    bullet(
      "Waste includes lost human potential. It is not only money or code that gets wasted.",
      "Ries is also talking about the time, talent, and energy people spend on work that never should have been built."
    ),
    bullet(
      "Short feedback loops need cultural support. A team cannot learn quickly if it is punished for bringing back inconvenient evidence.",
      "The speed of learning depends on whether truth is safe to surface."
    ),
    bullet(
      "Rewards shape behavior. People move toward what earns approval, budget, and status.",
      "If the organization praises activity and certainty theater, it will get more of both regardless of the official values."
    ),
    bullet(
      "Customer contact should stay close to the work. Culture weakens when decision makers drift too far from the people they serve.",
      "Direct exposure keeps learning grounded and makes waste easier to notice."
    ),
    bullet(
      "Stopping weak work early is a cultural act. It requires enough honesty and trust to end effort that no longer earns more investment.",
      "That is emotionally hard, which is why the surrounding norms matter so much."
    ),
    bullet(
      "Scaling can dilute learning discipline. As teams grow, process and hierarchy can slowly widen the distance from evidence.",
      "Ries is warning leaders to protect the original learning loops instead of assuming they will survive on their own."
    ),
    bullet(
      "Storytelling can distort progress. Organizations naturally create clean narratives that hide uncertainty and waste.",
      "The culture has to make room for messy reality or the story will outrun the truth."
    ),
    bullet(
      "Discipline protects creativity. Clear experiments, meaningful metrics, and honest reviews free the team from wandering wastefully.",
      "The point is not to make innovation smaller. It is to make it more useful."
    ),
    bullet(
      "Culture decides whether lean survives success. Once the company grows, daily norms become the real system.",
      "That closing insight explains why long term success depends on what gets repeated, not just on what was once discovered."
    ),
  ],
  deeperBullets: [
    bullet(
      "Waste often hides behind competence. Skilled teams can build the wrong thing very efficiently if the culture rewards smooth execution over sharp questioning.",
      "That is why Ries keeps linking waste to management, not just to effort."
    ),
    bullet(
      "Cultural drift is subtle. A company can keep lean vocabulary while quietly restoring old habits of vanity metrics and defensive planning.",
      "Leaders have to watch the incentives under the language, not only the language itself."
    ),
    bullet(
      "A mature culture knows how to stop. Ending a weak initiative with clarity is often healthier than keeping it alive for political comfort.",
      "This is where discipline becomes visible, because organizations usually find continuation emotionally easier than honest closure."
    ),
    bullet(
      "Customer respect is operational, not sentimental. It means learning from real needs instead of forcing people to validate the organization's internal assumptions.",
      "That respect reduces waste because it keeps the company closer to the problem it claims to solve."
    ),
    bullet(
      "The chapter's deepest warning is about normalization. Once waste becomes part of how things are done, people stop seeing it as a solvable design problem.",
      "A lean culture keeps waste visible enough that correction stays imaginable."
    ),
  ],
  takeaways: [
    "Lean needs culture to last",
    "Waste includes human potential",
    "Rewards shape learning behavior",
    "Stay close to customers",
    "Stop weak work early",
    "Culture decides what repeats",
  ],
  practice: [
    "Name one kind of waste the team ignores",
    "Check what behavior gets praised most",
    "Bring one customer voice closer to the work",
    "End one effort that no longer earns investment",
    "Protect one feedback loop from growing slower",
  ],
  examples: [
    example(
      "school",
      "Club keeps repeating low value events",
      "A student club runs the same event format every month because it looks busy and familiar, even though attendance is weak and members privately admit the events do not solve the problem they were meant to solve.",
      [
        "Treat the repeated low value work as cultural waste, not just as a scheduling issue",
        "Use member feedback to decide whether the format should change or stop entirely"
      ],
      "The chapter matters because culture is revealed by what a group keeps funding with time and energy after the evidence weakens."
    ),
    example(
      "school",
      "Innovation class that rewards polish over learning",
      "A course praises teams with the slickest demos even when their user learning is thin, so students start optimizing the presentation instead of the experiment.",
      [
        "Change the class scoring so evidence and learning quality count more than surface polish",
        "Make the cultural reward system support the behavior the course actually wants"
      ],
      "Rewards shape behavior. If the institution praises the wrong thing, lean language alone will not fix the drift."
    ),
    example(
      "work",
      "Company celebrates shipping more than learning",
      "Your organization praises teams that launch the most features, even when post launch data shows many of those features add little value or are rarely used.",
      [
        "Shift recognition toward evidence of customer value and useful learning, not output volume alone",
        "Use that change in praise and review to make waste harder to normalize"
      ],
      "This is a culture problem, not just a dashboard problem. People build toward what the organization rewards."
    ),
    example(
      "work",
      "Growing startup drifting away from users",
      "As the company hires managers and layers, fewer product decisions involve direct customer contact, and teams start arguing from internal narratives more than from fresh evidence.",
      [
        "Restore regular contact with customers close to the decision process",
        "Treat the growing distance from users as a cultural risk, not a minor inconvenience"
      ],
      "The chapter warns that scale can quietly widen the gap between the organization and reality unless leaders protect the feedback loops."
    ),
    example(
      "personal",
      "Side project kept alive from pride",
      "You keep pouring weekends into a side project that no longer shows signs of real demand because ending it would feel like admitting the original effort was wasted.",
      [
        "Ask whether continuing is now preserving value or only preserving identity",
        "Let the evidence guide whether the project deserves a redesign, a pause, or a clean ending"
      ],
      "Stopping weak work early is one of the hardest cultural disciplines because pride often argues for more waste instead of less."
    ),
    example(
      "personal",
      "Volunteer group normalizing confusion",
      "A volunteer group accepts constant miscommunication and last minute scrambling as just how things are, even though everyone is frustrated and the same waste keeps repeating.",
      [
        "Name the recurring friction as waste rather than as personality",
        "Use one honest review to change the norm that has made the problem feel inevitable"
      ],
      "The chapter's deeper lesson is that waste often becomes invisible when people get used to it. Good culture keeps it visible enough to fix."
    ),
  ],
  questions: [
    question(
      "Why does Ries connect long term success to culture?",
      "Because lean practices will not last if the surrounding norms reward the opposite behavior",
      [
        "Because culture matters only after a company stops growing",
        "Because culture replaces the need for experiments",
        "Because culture is mainly a branding issue"
      ],
      "The chapter argues that daily incentives and habits determine whether lean methods stay alive or decay into slogans."
    ),
    question(
      "What kind of waste does this chapter highlight beyond money?",
      "Lost time, talent, creativity, and attention spent on work that should not continue",
      [
        "Only marketing spend",
        "Only unused code",
        "Only manufacturing defects"
      ],
      "Ries widens the idea of waste to include the human cost of slow or misguided learning."
    ),
    question(
      "Why are rewards so important to lean culture?",
      "Because people move toward whatever behavior the organization consistently praises and funds",
      [
        "Because rewards eliminate the need for leadership",
        "Because rewards matter only for sales teams",
        "Because rewards cannot influence what teams build"
      ],
      "The chapter is direct on this point: values follow incentives more than slogans."
    ),
    question(
      "What happens when teams drift far from customer contact?",
      "Internal stories start replacing fresh evidence more easily",
      [
        "The company automatically becomes more efficient",
        "The company no longer needs metrics",
        "The company becomes better at predicting demand from intuition"
      ],
      "Ries wants customer truth kept close because distance makes waste harder to spot."
    ),
    question(
      "Why can ending an initiative be a sign of good culture?",
      "Because it shows the organization can stop spending on work that no longer earns more investment",
      [
        "Because endings always prove the team lacked resilience",
        "Because every weak project should be closed immediately after one setback",
        "Because stopping work matters more than learning from it"
      ],
      "The chapter treats healthy stopping as a disciplined use of evidence, not as a failure of nerve."
    ),
    question(
      "A company keeps celebrating feature count while weak customer value stays hidden. What is the core problem?",
      "The culture is rewarding output more than useful learning",
      [
        "The company needs more dashboards but the same incentives",
        "The company should stop measuring entirely",
        "The company should avoid hiring more people"
      ],
      "Metrics matter, but this chapter emphasizes the cultural signal behind what gets praised."
    ),
    question(
      "What does it mean to say discipline protects creativity here?",
      "Clear learning systems reduce waste so creative effort has a better chance to matter",
      [
        "Discipline should limit experimentation to keep everyone aligned",
        "Creativity only thrives without any structure",
        "Discipline matters only for mature organizations"
      ],
      "Ries is arguing that good discipline directs creativity toward truth instead of letting it dissolve into scattered effort."
    ),
    question(
      "Why is normalization dangerous?",
      "Because once waste feels ordinary, people stop seeing it as a design problem that can be fixed",
      [
        "Because normalization makes teams too ambitious",
        "Because normalization improves process speed automatically",
        "Because normalization only affects personal projects"
      ],
      "The chapter warns that accepted waste becomes hard to challenge precisely because it stops looking unusual."
    ),
    question(
      "Which personal action best reflects this chapter?",
      "Notice what you keep rewarding in your own projects and stop funding the patterns that create waste",
      [
        "Assume motivation problems should always be solved with more effort",
        "Keep every project alive to honor the time already invested",
        "Avoid feedback so creative momentum stays high"
      ],
      "The same cultural logic applies personally because repeated self rewards shape what behavior continues."
    ),
    question(
      "What is the chapter's broadest message?",
      "Lean becomes durable only when the culture keeps evidence, customer truth, and waste reduction central over time",
      [
        "Lean becomes durable only when every process is formalized heavily",
        "Lean becomes durable only in very small teams",
        "Lean becomes durable only when growth stops changing the company"
      ],
      "The chapter is about protecting the deeper norms that let experimentation stay real as the organization evolves."
    ),
  ],
});

CHAPTER_CONTENT["ch14-see-the-whole-system"] = chapter({
  summary: {
    p1: t(
      "Lean thinking becomes a broader management system when its principles are applied beyond any single startup. Ries closes by arguing that entrepreneurship is a discipline for navigating uncertainty in companies, schools, nonprofits, and public institutions, not only in small venture backed teams.",
      "This widens the book from startup method to management philosophy. Experiments, feedback loops, and evidence based adaptation become tools for redesigning whole systems.",
      "The chapter is therefore an invitation. It asks readers to see uncertainty as a common managerial condition and to use lean thinking wherever waste and delayed learning are hurting real people."
    ),
    p2: t(
      "This matters because waste at system scale is not only financial. It appears wherever institutions force people to pretend they know what has not yet been learned. The deeper lesson is that better experimentation, better measurement, and better leadership can make organizations more effective and more humane at the same time.",
      "Ries is careful not to frame this as ideology without practice. The movement grows through local examples where learning gets faster, waste gets lower, and evidence has a better chance to outrank status.",
      "The final implication is demanding. If uncertainty is everywhere, then better management of uncertainty is not a founder niche. It becomes a public and institutional responsibility."
    ),
  },
  standardBullets: [
    bullet(
      "Lean applies beyond startups. Any system facing uncertainty can use shorter feedback loops and evidence based learning.",
      "That includes schools, governments, nonprofits, and large companies, not only new venture teams."
    ),
    bullet(
      "Entrepreneurship becomes a management discipline. It is less about a founder identity and more about how institutions learn under uncertainty.",
      "This makes the book's ideas broadly transferable rather than narrowly cultural."
    ),
    bullet(
      "System level waste is real. Institutions often spend huge effort defending assumptions that have never been properly tested.",
      "Ries is arguing that lean methods can reduce that hidden cost across many settings."
    ),
    bullet(
      "Experiments can humanize organizations. Better tests and faster learning can reduce the frustration of serving people with weak assumptions.",
      "The point is not merely efficiency. It is also a better experience for the people affected by the system."
    ),
    bullet(
      "Measurement should serve learning everywhere. The same principle from startups applies at larger scale.",
      "When metrics reward appearances instead of truth, systems drift away from the people they claim to help."
    ),
    bullet(
      "Local examples matter. Broad change starts when one team demonstrates a better way to learn.",
      "Ries treats practice as the seed of movement, not just as proof of concept."
    ),
    bullet(
      "Methods must fit context. Lean thinking is transferable, but it still has to respect the realities of the setting.",
      "The goal is disciplined adaptation, not mindless copying of startup rituals."
    ),
    bullet(
      "Communities accelerate learning. People improve faster when they share patterns, failures, and working practices across organizations.",
      "That is part of what makes a movement stronger than a single success story."
    ),
    bullet(
      "Better management of uncertainty is a public good. When institutions learn faster, waste falls for more than just shareholders or founders.",
      "Students, workers, customers, and citizens all benefit when systems become less defensive and more truthful."
    ),
    bullet(
      "The whole system changes one practiced improvement at a time. That is the chapter's closing realism.",
      "Lean thinking grows through repeated examples that make evidence a stronger force inside real institutions."
    ),
  ],
  deeperBullets: [
    bullet(
      "The chapter reframes entrepreneurship as civic capability. A society with better ways to test and learn wastes less collective effort.",
      "That makes the book's logic larger than company building alone."
    ),
    bullet(
      "Scale does not erase uncertainty. Large institutions often hide it better, but they still make consequential bets with incomplete knowledge.",
      "Ries wants leaders to manage that condition honestly instead of burying it under formality."
    ),
    bullet(
      "Transfer requires humility. The right move is to carry the principles across settings while adapting the methods to the local reality.",
      "That keeps lean thinking from becoming another rigid ideology disguised as flexibility."
    ),
    bullet(
      "A movement matters because isolated teams are fragile. Shared language and shared examples help better practices survive leadership changes and organizational pressure.",
      "The broader system becomes easier to shift when people can point to peers, not just to theory."
    ),
    bullet(
      "The final chapter is optimistic but demanding. It assumes institutions can learn better, yet only if leaders choose evidence over comfort repeatedly.",
      "That is why the book ends with responsibility rather than with celebration."
    ),
  ],
  takeaways: [
    "Lean thinking travels widely",
    "Entrepreneurship is a management discipline",
    "System level waste is avoidable",
    "Adapt methods to the context",
    "Shared examples build movements",
    "Better uncertainty management helps everyone",
  ],
  practice: [
    "Pick one uncertain system you can improve",
    "Apply one feedback loop outside startup work",
    "Share one useful learning pattern with others",
    "Adapt the principle to the context carefully",
    "Use evidence to challenge one stale assumption",
  ],
  examples: [
    example(
      "school",
      "Student support service redesigned by feedback",
      "A campus support office keeps adding programs based on staff assumptions, even though students rarely use some of them and no one is testing what would actually help most.",
      [
        "Apply lean thinking to the service by running smaller tests with clearer student feedback loops",
        "Use the evidence to redesign the support system instead of defending the original assumptions"
      ],
      "The chapter matters because uncertainty management is not only for startups. Schools also waste effort when they build without learning."
    ),
    example(
      "school",
      "Course policy built from tradition",
      "A department keeps a complicated class participation policy because it has always existed that way, even though students find it confusing and faculty cannot show that it improves learning.",
      [
        "Treat the policy like an uncertain system and test a simpler version in one section first",
        "Let the result guide whether the broader policy deserves to stay"
      ],
      "This makes the final chapter concrete. Lean thinking becomes a broader management system when institutions test inherited assumptions instead of protecting them by habit."
    ),
    example(
      "work",
      "Hospital workflow nobody has tested recently",
      "A service team in a hospital follows a complex intake process because it was designed years ago, but staff and patients both feel the friction and no one has recently measured where the biggest waste sits.",
      [
        "Map the uncertain assumptions in the current workflow and test smaller process improvements where the bottlenecks are clearest",
        "Use real patient and staff feedback to decide what the system should keep or change"
      ],
      "The chapter extends lean thinking into institutions where better learning can improve both efficiency and human experience."
    ),
    example(
      "work",
      "Company transformation by isolated teams only",
      "One product team learns quickly and runs useful experiments, but the rest of the company keeps using slow approval chains and vanity metrics, so the better practice struggles to spread.",
      [
        "Share the local success as a repeatable model and adapt it to neighboring teams rather than leaving it isolated",
        "Build community around the practice so the improvement can survive beyond one team"
      ],
      "The movement idea matters because isolated excellence is fragile. Broader change needs shared examples and shared language."
    ),
    example(
      "personal",
      "Family budgeting rules never questioned",
      "Your household follows a budgeting routine that creates stress every month, but everyone treats it as fixed even though no one has tested a simpler system that might work better.",
      [
        "Treat the routine as an uncertain system and run a small experiment on one part of it",
        "Use the result to improve the household process instead of accepting inherited friction"
      ],
      "Lean thinking applies personally too. The point is to manage uncertainty in daily systems with more evidence and less stale assumption."
    ),
    example(
      "personal",
      "Volunteer network that never shares learning",
      "Different volunteer groups in your area keep solving the same problems separately because nobody shares what has already been tested, learned, or dropped.",
      [
        "Create a simple way for groups to exchange working patterns and failed attempts",
        "Use that shared learning to reduce repeated waste across the network"
      ],
      "The final chapter emphasizes movement because shared learning makes better systems easier to build and sustain."
    ),
  ],
  questions: [
    question(
      "What is Ries claiming in the book's final expansion of lean thinking?",
      "That the discipline of learning under uncertainty can improve many kinds of institutions, not only startups",
      [
        "That startups should stop learning once they scale",
        "That lean ideas belong only to technology companies",
        "That uncertainty disappears in large systems"
      ],
      "The final chapter widens the frame from startup practice to broader management of uncertainty."
    ),
    question(
      "Why does the chapter talk about waste at system scale?",
      "Because institutions can spend huge effort defending untested assumptions that affect many people",
      [
        "Because waste only matters in public sector work",
        "Because scale automatically creates better learning",
        "Because large systems should avoid experimentation"
      ],
      "Ries is showing that the cost of slow learning rises when the system itself is large and consequential."
    ),
    question(
      "What does it mean to call entrepreneurship a management discipline here?",
      "It means the key skill is building systems that learn under uncertainty, not only founding companies",
      [
        "It means every manager should become a startup founder",
        "It means management can be replaced by intuition",
        "It means uncertainty matters only in product teams"
      ],
      "The chapter broadens entrepreneurship from identity to method."
    ),
    question(
      "Why does Ries emphasize local examples and shared communities?",
      "Because real examples make better practices easier to spread and sustain across institutions",
      [
        "Because theory becomes useless once a team succeeds",
        "Because communities eliminate the need for adaptation",
        "Because broad change happens mainly through slogans"
      ],
      "Movement grows when people can learn from each other's actual experiments, not only from abstract claims."
    ),
    question(
      "What is the risk of copying lean methods into a new setting without adaptation?",
      "The ritual may survive while the principle loses fit with the local reality",
      [
        "The setting will become too innovative too quickly",
        "The methods will always work better than expected",
        "The need for measurement will disappear"
      ],
      "The chapter values transfer with humility, carrying principles across contexts while adjusting the method."
    ),
    question(
      "A school department keeps a policy because tradition says it works, but no one has tested it recently. What does the chapter suggest?",
      "Treat the policy as an uncertain system and run a smaller test of a better alternative",
      [
        "Leave the policy alone because institutions should avoid experiments",
        "Rewrite the entire system at once without evidence",
        "Judge the policy only by how familiar it feels"
      ],
      "The chapter extends lean thinking to inherited institutional assumptions that deserve fresh evidence."
    ),
    question(
      "Why can lean thinking make institutions more humane as well as more effective?",
      "Because better feedback and better learning reduce the burden of serving people through weak assumptions",
      [
        "Because efficiency always matters more than experience",
        "Because humane systems should avoid measurement",
        "Because institutions improve only when they slow down"
      ],
      "Ries connects learning quality with the lived experience of the people the system affects."
    ),
    question(
      "What is the public good argument in the final chapter?",
      "Better management of uncertainty lowers waste for workers, users, students, and citizens, not only for founders",
      [
        "Only private companies benefit from better experimentation",
        "Public institutions should not care about waste",
        "Customers are the only group affected by bad systems"
      ],
      "The chapter broadens the beneficiaries of lean learning well beyond the startup team."
    ),
    question(
      "Which personal action best fits the chapter?",
      "Apply a lean feedback loop to one stale system in your own life and let the evidence shape the next change",
      [
        "Accept inherited routines because they probably once worked",
        "Overhaul every personal system at the same time",
        "Ignore measurement outside work"
      ],
      "The final message is practical. Better management of uncertainty starts with small applied examples."
    ),
    question(
      "What is the chapter's broadest closing challenge?",
      "Choose evidence over comfort repeatedly in the systems you can influence",
      [
        "Wait for a complete movement before changing anything locally",
        "Treat uncertainty as a problem only for founders",
        "Assume good intentions make experimentation unnecessary"
      ],
      "The book ends by putting responsibility on leaders and builders to improve real systems through disciplined learning."
    ),
  ],
});

const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
pkg.packageId = randomUUID();
pkg.createdAt = new Date().toISOString();

for (const chapterMeta of pkg.chapters) {
  const content = CHAPTER_CONTENT[chapterMeta.chapterId];
  if (!content) {
    throw new Error(`Missing chapter content for ${chapterMeta.chapterId}`);
  }

  const simpleBullets = content.simpleIndexes.map((index) => content.standardBullets[index]);
  const standardBullets = content.standardBullets;
  const deeperBullets = [...content.standardBullets, ...content.deeperBullets];

  const buildVariant = (level, bullets) => ({
    importantSummary: `${compose(content.summary.p1, level)} ${compose(content.summary.p2, level)}`.trim(),
    summaryBullets: bullets.map((item) => clean(item.text)),
    summaryBlocks: buildSummaryBlocks(content.summary, bullets, level),
    takeaways: content.takeaways.map((item) => clean(item)),
    practice: content.practice.map((item) => clean(item)),
  });

  chapterMeta.contentVariants = {
    easy: buildVariant("easy", simpleBullets),
    medium: buildVariant("medium", standardBullets),
    hard: buildVariant("hard", deeperBullets),
  };

  chapterMeta.examples = content.examples.map((entry, index) => ({
    exampleId: `ch${String(chapterMeta.number).padStart(2, "0")}-ex${String(index + 1).padStart(2, "0")}`,
    title: clean(entry.title),
    scenario: clean(entry.scenario),
    whatToDo: entry.whatToDo.map((step) => clean(step)),
    whyItMatters: clean(entry.whyItMatters),
    contexts: [entry.scope],
  }));

  chapterMeta.quiz = {
    passingScorePercent: 80,
    questions: content.questions.map((entry, index) => buildQuestion(entry, chapterMeta.number, index)),
  };
}

assertChapterStructure(pkg);
assertNoDashContent(pkg);

mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + "\n");
writeFileSync(reportPath, buildReport(pkg));

console.log(`Updated ${packagePath}`);
console.log(`Wrote ${reportPath}`);
