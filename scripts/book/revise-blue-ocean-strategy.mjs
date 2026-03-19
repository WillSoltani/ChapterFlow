import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";

const packagePath = resolve(process.cwd(), "book-packages/blue-ocean-strategy.modern.json");
const reportPath = resolve(process.cwd(), "notes/blue-ocean-strategy-revision-report.md");

const existingPackage = JSON.parse(readFileSync(packagePath, "utf8"));
const readingTimeByNumber = new Map(
  existingPackage.chapters.map((chapter) => [chapter.number, chapter.readingTimeMinutes])
);

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

const question = (questionId, prompt, choices, correctAnswerIndex, explanation) => ({
  questionId,
  prompt: sanitizePrompt(prompt),
  choices,
  correctAnswerIndex,
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
  "The existing Blue Ocean Strategy package was structurally complete on paper, but it was not close to premium quality. The book had been pushed through a generic content template that repeated the same scaffolding across nearly every chapter, so the experience rarely felt like Blue Ocean Strategy itself.",
  "Most summaries opened with stock phrasing, explained the chapter only loosely, and drifted into generic advice about pressure, judgment, and reflection. They often missed the specific strategic logic of the book, especially the tools, frameworks, sequencing rules, and system alignment ideas that make Kim and Mauborgne distinctive.",
  "The bullet sets were mechanically patterned at 6, 10, and 14 items instead of the required 7, 10, and 15. Their detail text was heavily recycled across the whole book, which made different chapters sound interchangeable even when the underlying ideas were completely different.",
  "The scenarios and quizzes had the same problem. Scenario titles and structures repeated across all eleven chapters, the situations were thinly adapted, and the quiz prompts relied on stock templates instead of applied strategic judgment. This revision replaces the package book wide, restores the expanded edition chapter logic, and adds cleaner motivation styling in the reader without bloating the schema.",
];

const MAIN_PROBLEMS = [
  "The chapter titles and explanations were too generic and often drifted away from the expanded edition structure of the book.",
  "Summary paragraphs did not clearly explain the real claim of each chapter or why the claim matters in strategy practice.",
  "Bullet detail text repeated across the book, which made the learning experience feel templated instead of authored.",
  "Simple, Standard, and Deeper were incomplete because the package used 6, 10, and 14 bullets instead of the required 7, 10, and 15.",
  "Scenarios reused the same six titles and near identical patterns in every chapter, so transfer felt fake rather than chapter specific.",
  "Quiz questions tested stock phrasing more than strategic understanding and repeated the same prompt frames chapter after chapter.",
  "Motivation tone was generic because Blue Ocean Strategy fell back to the default reader personalization instead of a book specific guidance layer.",
  "The whole flow lacked progression. Summaries, bullets, scenarios, and quizzes often repeated the same thin idea instead of building understanding step by step.",
];

const PERSONALIZATION_STRATEGY = [
  "Depth remains the authored axis in the package. Simple now delivers seven clear bullets with lower cognitive load. Standard gives the strongest ten bullet lesson flow for most readers. Deeper adds five real insights about tradeoffs, failure points, system alignment, and strategic transfer rather than padding the same points.",
  "Motivation remains a reader layer rather than nine duplicated package files. Blue Ocean Strategy now gets book specific Gentle, Direct, and Competitive guidance in summary framing, recap language, scenario coaching, and quiz explanations, so the tone shifts feel intentional while the core meaning stays stable.",
  "Gentle keeps the book welcoming without softening its strategic discipline. Direct emphasizes clear tradeoffs, hard choices, and commercial reality. Competitive highlights edge, missed opportunity, imitation risk, and the cost of settling for crowded markets when the chapter naturally supports that frame.",
  "This keeps the schema lean, preserves compatibility with the existing package structure, and still makes the nine user facing combinations feel materially different.",
];

const SCHEMA_NOTE =
  "No package schema change was required. The revision stays inside the existing JSON shape. Content depth is authored in the package, and motivation styling is handled in the reader with Blue Ocean specific copy rather than nine duplicated content trees.";

const FINAL_QC_SUMMARY = [
  "Every chapter now has exactly two summary paragraphs in each depth, with the first paragraph stating the core claim and the second paragraph deepening the practical meaning.",
  "Bullet structure now follows the required counts of 7, 10, and 15 with meaningful differentiation between Simple, Standard, and Deeper.",
  "Every chapter now includes exactly six scenarios with the required distribution of two school, two work, and two personal contexts.",
  "Every quiz now contains ten questions with four choices each, one clearly best answer, and a progression from concept to applied judgment.",
  "The revised package keeps the expanded edition logic of the book, restores key frameworks and terminology, and removes the generic template drift found in the original version.",
  "Blue Ocean Strategy now has book specific motivation layering in the reader, so Gentle, Direct, and Competitive guidance feels aligned with the strategic logic of the book rather than appended generically.",
  "A validation pass checks counts, scenario distribution, quiz structure, and the no dash rule across user facing package content before the file is written.",
];

const CHAPTERS = [
  chapter({
    chapterId: "ch01-red-and-blue-markets",
    number: 1,
    title: "Creating Blue Oceans",
    summary: {
      p1: t(
        "The chapter argues that lasting growth comes from creating blue oceans, not from trying to beat rivals inside crowded red oceans. Blue oceans are new demand spaces where a company can offer buyers a leap in value while lowering the cost structure tied to old industry habits.",
        "Kim and Mauborgne call this value innovation. The point is not to outfight competitors. It is to make the competition less relevant by changing what buyers get and what the business chooses not to do.",
        "That is why the authors treat blue ocean strategy as a strategic move, not a trait of a special company or a lucky industry. Market boundaries can be redrawn when leaders stop treating current rules as fixed."
      ),
      p2: t(
        "This matters because red ocean thinking pushes teams toward benchmarking, incremental improvement, and price pressure. The more everyone copies the same factors, the harder it becomes to grow without shrinking value.",
        "Blue ocean thinking changes the question from How do we win against rivals to What new value curve can unlock demand and cost room at the same time. That shift is what makes the book a strategy book rather than a creativity book.",
        "The deeper lesson is that growth often stalls not because opportunity is gone, but because managers search inside the wrong frame. Once they accept industry assumptions as permanent, they mistake crowded competition for reality itself."
      ),
    },
    simpleIndexes: [0, 1, 2, 4, 6, 8, 9],
    standardBullets: [
      bullet(
        "Red ocean pressure. Existing industries push firms into crowded comparison, price pressure, and shrinking margins.",
        "When everyone chases the same buyers with the same factors, improvement gets expensive and imitation gets fast."
      ),
      bullet(
        "Blue ocean space. A blue ocean creates new demand instead of fighting over existing share.",
        "The aim is to open market space people can recognize as clearly more useful, simpler, or more accessible."
      ),
      bullet(
        "Value innovation. The strongest move raises buyer value while reducing the costs tied to outdated factors.",
        "Blue ocean strategy rejects the lazy choice between differentiation and low cost when both are being defined by old rules."
      ),
      bullet(
        "Strategic moves matter. Blue oceans are created by decisions and design, not by belonging to a special industry.",
        "That matters because any organization can fall into red ocean habits, and any one can rethink the field."
      ),
      bullet(
        "Competition loses force. When the offer changes the game, rivals become a weaker reference point.",
        "You still notice competitors, but you stop letting them dictate what deserves investment."
      ),
      bullet(
        "Boundaries can move. Industry rules feel stable until someone recombines value in a better way.",
        "The book treats markets as patterns people built, which means they can be redesigned."
      ),
      bullet(
        "Benchmarking is a trap. Copying best practice often keeps firms on the same curve with slightly different numbers.",
        "Improvement alone can make you better within the old game while doing nothing to change the game."
      ),
      bullet(
        "Growth economics shift. Blue oceans matter because they can expand demand and cut waste together.",
        "The research behind the book shows that a smaller share of launches can drive a larger share of profit when they create new market space."
      ),
      bullet(
        "Practical starting point. Look for factors buyers tolerate only because the industry made them normal.",
        "That question exposes cost and friction hidden in plain sight and often reveals where new demand can be unlocked."
      ),
      bullet(
        "Change the field. The best strategic move is not to win the rivalry more elegantly. It is to make rivalry a weaker source of value.",
        "That closing idea sets the direction for the whole book."
      ),
    ],
    deeperBullets: [
      bullet(
        "Innovation is not invention alone. A blue ocean move can use known technology or familiar assets in a newly useful configuration.",
        "What matters is the new value curve, not whether the input looks novel to insiders."
      ),
      bullet(
        "New demand can emerge inside old industries. Blue oceans do not always require creating a whole new category from scratch.",
        "Many powerful moves reshape an existing market by cutting through habits buyers already dislike."
      ),
      bullet(
        "Creativity is not enough. If the offer excites people but cannot support price, cost, or adoption, it is not yet a strong strategic move.",
        "Later chapters matter because blue ocean strategy has to become commercially coherent, not merely interesting."
      ),
      bullet(
        "Blue oceans do not stay blue forever. Success attracts imitation and drift unless the organization renews the strategy over time.",
        "The opening promise of the book is powerful, but it is not magic or permanent."
      ),
      bullet(
        "The hardest barrier is mental. Leaders must question tradeoffs their industry treats as obvious and inevitable.",
        "That is why the book keeps pushing readers to challenge assumptions before they chase rivals."
      ),
    ],
    takeaways: [
      "Create demand instead of chase share",
      "Value innovation breaks old tradeoffs",
      "Competition can be made less relevant",
      "Industry boundaries are movable",
      "Benchmarking keeps you crowded",
      "Strategic moves create blue oceans",
    ],
    practice: [
      "Map one market where everyone competes on the same factors",
      "List one group of nonbuyers the market ignores",
      "Name one costly factor buyers tolerate without liking",
      "Sketch one offer that changes value and cost together",
    ],
    examples: [
      example(
        "ch01-ex01",
        "Club fair with no new draw",
        ["school"],
        "At the campus club fair, every student group offers the same free snacks, social posts, and pitch about community. Your language exchange club keeps losing attention even though students still want help meeting people across majors and cultures.",
        [
          "Stop copying the fair formula and ask what students actually struggle to get from the current options.",
          "Build a simple first week service, such as fast host matching for newcomers and commuter meetups, instead of another generic social pitch."
        ],
        "This matters because growth rarely comes from shouting louder inside the same setup. A blue ocean move starts when you solve an ignored need that makes the old comparison less important."
      ),
      example(
        "ch01-ex02",
        "Tutoring that feels easier to use",
        ["school"],
        "Your tutoring center competes by adding more subjects and more hours, but first year students still avoid it. They mostly want quick help before quizzes and do not want the friction of booking a formal session.",
        [
          "Drop the assumption that more hours automatically create more value.",
          "Design an easy entry option, such as short drop in problem clinics and one page study maps, that opens demand from students who never used tutoring before."
        ],
        "The chapter teaches that new demand often appears when you remove the friction current buyers learned to tolerate and nonbuyers refused to accept."
      ),
      example(
        "ch01-ex03",
        "Gym stuck in a discount war",
        ["work"],
        "A neighborhood gym keeps matching rival discounts and adding more classes, but cancellations continue. Former members say they mostly wanted a simple guided recovery routine after work, not a full fitness identity.",
        [
          "Stop assuming the market is only about full memberships and feature volume.",
          "Create a focused recovery offer with quick booking, short guided sessions, and no long contract so the gym serves a new kind of demand."
        ],
        "This matters because beating rivals on the old factors can hide a better opportunity. A different value curve can attract people the market was never really built for."
      ),
      example(
        "ch01-ex04",
        "Software for crews, not only managers",
        ["work"],
        "Your software team keeps adding planning features because rivals are doing the same. Small field crews still ignore the product because setup takes too long and the mobile experience feels built for office managers.",
        [
          "Question whether the current competition is pushing you toward complexity your best growth users do not need.",
          "Design a stripped down mobile first version that makes fast updates easy for crews and removes the features that mainly impress internal stakeholders."
        ],
        "The chapter matters here because blue oceans often come from changing who the solution is truly designed for and what value they actually need."
      ),
      example(
        "ch01-ex05",
        "A side income that stops copying the crowd",
        ["personal"],
        "You keep thinking about starting a content account because it seems like the standard way to make extra money online. At the same time, people in your area regularly ask for help setting up new phones, printers, and home Wi Fi without confusion.",
        [
          "Stop assuming the crowded path is the only path that counts.",
          "Test a simple home tech setup service for busy families and older adults instead of joining a market already packed with look alike creators."
        ],
        "This matters because blue ocean thinking is not only for corporations. It helps you look past crowded prestige paths and notice demand that already exists around you."
      ),
      example(
        "ch01-ex06",
        "A hobby group that lowers the barrier",
        ["personal"],
        "You want to start a weekend film club, but every local group is built for experts who want long debates and late nights. Friends say they would join if the experience felt lighter, easier, and more social.",
        [
          "Do not copy the current club model just because it is established.",
          "Create a short monthly watch night with beginner friendly prompts, earlier timing, and a simple social format that welcomes people who never joined film clubs before."
        ],
        "The chapter shows that new demand often comes from redesigning an experience for the people who were left out by the standard version."
      ),
    ],
    questions: [
      question(
        "ch01-q01",
        "What makes a blue ocean move different from ordinary competition?",
        [
          "It creates new demand by changing the value curve instead of only beating rivals on existing factors",
          "It spends more than rivals so buyers notice the offer faster",
          "It focuses on premium positioning because high prices signal uniqueness",
          "It ignores cost so the team can push differentiation as far as possible"
        ],
        0,
        "A blue ocean move changes the field by opening demand and rethinking the factors of value and cost together."
      ),
      question(
        "ch01-q02",
        "What is value innovation trying to do?",
        [
          "Raise buyer value while lowering the costs tied to outdated industry assumptions",
          "Choose differentiation first and worry about cost once the brand is established",
          "Reduce cost mainly by copying the cheapest competitor in the market",
          "Add more features so buyers see obvious superiority"
        ],
        0,
        "Value innovation joins buyer value and cost logic instead of accepting the usual tradeoff between them."
      ),
      question(
        "ch01-q03",
        "Why is benchmarking a weak default for growth?",
        [
          "It usually keeps you on the same competitive curve with only minor improvements",
          "It makes the company learn too much from strong rivals",
          "It forces leaders to lower prices before the product is ready",
          "It works only in brand new industries"
        ],
        0,
        "Benchmarking can improve execution inside the old game while doing little to change the game itself."
      ),
      question(
        "ch01-q04",
        "Which belief is most consistent with blue ocean strategy?",
        [
          "Industry boundaries can be redrawn when leaders question the rules buyers have learned to accept",
          "Market rules are stable, so the safest move is to outwork rivals on the same factors",
          "Only companies with breakthrough technology can create new market space",
          "New demand appears mainly after a firm wins the existing leaders' customers"
        ],
        0,
        "The book treats market boundaries as movable, which is why strategic moves can create new space."
      ),
      question(
        "ch01-q05",
        "At the campus club fair, every student group offers the same free snacks, social posts, and pitch about community. Your language exchange club keeps losing attention even though students still want help meeting people across majors and cultures. What is the strongest next step?",
        [
          "Build a practical first week service for newcomers and commuters instead of copying the usual club fair formula",
          "Match the most popular club by offering even more giveaways at the same event",
          "Keep the current model but post more often so students notice the club's energy",
          "Wait until next semester and hope lower competition changes the outcome"
        ],
        0,
        "A stronger move looks for ignored demand and changes the value curve instead of competing harder on the same fair tactics."
      ),
      question(
        "ch01-q06",
        "Your tutoring center competes by adding more subjects and more hours, but first year students still avoid it. They mostly want quick help before quizzes and do not want the friction of booking a formal session. What is the strongest next step?",
        [
          "Create an easy entry offer such as short drop in clinics and simple study maps for students who never used tutoring before",
          "Add even more tutors so the center can advertise larger academic coverage",
          "Raise the academic standard of each session so tutoring feels more elite",
          "Keep the current system and remind students that strong learners plan ahead"
        ],
        0,
        "The better move opens demand by removing the barrier that kept nonusers away."
      ),
      question(
        "ch01-q07",
        "A neighborhood gym keeps matching rival discounts and adding more classes, but cancellations continue. Former members say they mostly wanted a simple guided recovery routine after work, not a full fitness identity. What is the strongest next step?",
        [
          "Design a focused recovery offer with easy booking and no long contract instead of copying the market's feature race",
          "Add more classes across the full schedule so current members have greater variety",
          "Lower prices again so the gym can defend market share from nearby rivals",
          "Increase marketing spend around motivation and discipline"
        ],
        0,
        "This answer changes the market logic by serving overlooked demand rather than fighting harder inside the same comparison."
      ),
      question(
        "ch01-q08",
        "Your software team keeps adding planning features because rivals are doing the same. Small field crews still ignore the product because setup takes too long and the mobile experience feels built for office managers. What is the strongest next step?",
        [
          "Build a stripped down mobile first version for crews and remove the complexity that blocks adoption",
          "Add more advanced dashboards so managers have reasons to mandate the product",
          "Keep the roadmap focused on matching every major competitor feature",
          "Raise price to signal that the product is for serious customers"
        ],
        0,
        "The strongest move creates a different value curve for a neglected group of users instead of copying rival priorities."
      ),
      question(
        "ch01-q09",
        "You keep thinking about starting a content account because it seems like the standard way to make extra money online. At the same time, people in your area regularly ask for help setting up new phones, printers, and home Wi Fi without confusion. What is the strongest next step?",
        [
          "Test a simple home tech setup service for people who already struggle with current options",
          "Post in the crowded creator space anyway because that market seems more visible",
          "Wait until you can build a large audience before offering any service",
          "Offer the same generic productivity templates that everyone else is selling"
        ],
        0,
        "Blue ocean thinking pushes you to notice real unmet demand instead of assuming the most crowded path is the only serious one."
      ),
      question(
        "ch01-q10",
        "You want to start a weekend film club, but every local group is built for experts who want long debates and late nights. Friends say they would join if the experience felt lighter, easier, and more social. What is the strongest next step?",
        [
          "Create a beginner friendly watch night with earlier timing and a simpler format for people who never joined film clubs before",
          "Copy the expert clubs so your group seems credible from the start",
          "Keep the format demanding because serious groups should filter out casual interest",
          "Delay the idea until you find a way to compete directly with the biggest clubs"
        ],
        0,
        "The best answer expands demand by designing for people who were excluded by the current market format."
      ),
    ],
  }),
  chapter({
    chapterId: "ch02-analytical-tools",
    number: 2,
    title: "Analytical Tools and Frameworks",
    summary: {
      p1: t(
        "The chapter argues that blue ocean strategy becomes practical only when managers use clear visual tools to see how an industry competes and where value can be rebuilt. The strategy canvas maps the current factors of competition and shows the value curve each player delivers.",
        "From there the book introduces the four actions framework and the eliminate reduce raise create grid to break accepted tradeoffs. These tools force choice instead of vague ambition.",
        "It also adds the pioneer migrator settler map, which helps leaders see whether their portfolio is drifting toward safe extensions instead of future growth."
      ),
      p2: t(
        "This matters because most strategy conversations stay trapped in slogans, budgets, and feature lists. Without a shared picture of the current curve, teams debate opinions while protecting inherited assumptions.",
        "The tools make strategy discussable in plain sight. They reveal overinvestment, underdelivered value, and whether an idea actually diverges from the pack.",
        "The deeper lesson is that visual clarity is not cosmetic. It is a discipline that keeps strategy tied to buyer reality and forces leaders to make tradeoffs they would rather leave blurry."
      ),
    },
    simpleIndexes: [0, 2, 3, 5, 6, 7, 9],
    standardBullets: [
      bullet(
        "See the curve. The strategy canvas shows what buyers are being asked to pay for across the market.",
        "It turns scattered claims into one picture so teams can see where the industry is clustered."
      ),
      bullet(
        "Expose inherited factors. Naming every factor of competition makes old assumptions visible.",
        "Teams often discover they are investing in features or rituals buyers barely value."
      ),
      bullet(
        "Focus matters. Strong blue ocean curves do not try to excel on everything.",
        "A focused curve signals discipline because the strategy is choosing what not to chase."
      ),
      bullet(
        "Divergence matters. A new curve must look meaningfully different from the industry's average shape.",
        "If the profile looks the same as everyone else with small upgrades, the strategy is still crowded."
      ),
      bullet(
        "Tagline test. A compelling tagline checks whether the offer is clear and worth noticing.",
        "If the strategy cannot be captured in simple buyer language, it is usually not sharp enough yet."
      ),
      bullet(
        "Four actions discipline. Eliminate, reduce, raise, and create push teams past incremental tweaking.",
        "The framework challenges the factors the industry accepts as permanent."
      ),
      bullet(
        "ERRC grid turns ideas into choices. Writing each action in its own box forces commitment about what changes.",
        "It prevents strategy from staying at the level of aspiration and keeps teams honest about tradeoffs."
      ),
      bullet(
        "Portfolio reality check. The pioneer migrator settler map shows whether a company is funding future growth or only polishing familiar lines.",
        "It helps leaders see whether their portfolio is full of safe extensions that will not open new space."
      ),
      bullet(
        "Practical move. Draw your current curve before you debate the next strategy.",
        "A team can argue about the future more intelligently once it has a shared view of the present."
      ),
      bullet(
        "Visual tools create alignment. Once the curve is visible, strategy becomes easier to challenge, explain, and execute.",
        "The tools work because they make tradeoffs visible to everyone."
      ),
    ],
    deeperBullets: [
      bullet(
        "Numbers do not reveal shape on their own. A spreadsheet can hide the fact that every rival is investing in nearly the same profile.",
        "The canvas adds pattern recognition that raw metrics often bury."
      ),
      bullet(
        "The canvas is comparative, not isolated. A value curve matters because it is read against alternatives, not because it sounds impressive by itself.",
        "That keeps the tool market facing instead of internally self congratulatory."
      ),
      bullet(
        "A bloated curve is a warning sign. If the line is trying to stay high everywhere, cost and confusion are likely rising together.",
        "Blue oceans usually sharpen by subtraction before they expand by addition."
      ),
      bullet(
        "A strong visual strategy travels well inside the firm. The clearer the curve, the easier it is for sales, operations, and product teams to align around it.",
        "Communication strength is part of strategic strength, not a separate concern."
      ),
      bullet(
        "The tools are only useful when tied to real buyer insight. A neat grid built from conference room assumptions can still produce a weak strategy.",
        "The chapter's tools are disciplines for seeing reality, not decorations for a slide deck."
      ),
    ],
    takeaways: [
      "Use the strategy canvas",
      "Focus and divergence matter",
      "A clear tagline is a real test",
      "ERRC forces tradeoffs",
      "Visual tools expose waste",
      "Portfolio maps show growth posture",
    ],
    practice: [
      "Draw the current value curve for one offer and two alternatives",
      "List what should be eliminated, reduced, raised, and created",
      "Write a plain language tagline for the proposed move",
      "Classify your current projects as pioneers, migrators, or settlers",
    ],
    examples: [
      example(
        "ch02-ex01",
        "Debate club finally sees the real comparison",
        ["school"],
        "A debate club wants more members and keeps arguing about social media content, flyers, and event frequency. Students outside the club do not compare it only with other debate teams. They compare it with casual speaking workshops, entrepreneurship clubs, and no extra activity at all.",
        [
          "Draw a simple strategy canvas that compares those real alternatives on factors like time pressure, competition intensity, feedback, and social ease.",
          "Use the picture to decide what the club should stop emphasizing and what it should create for students who want speaking practice without the full debate identity."
        ],
        "This matters because good tools expose the actual field of competition. Once the real comparison is visible, better strategic choices become easier."
      ),
      example(
        "ch02-ex02",
        "A project team cuts through feature fog",
        ["school"],
        "Your group is building a campus food pantry app, and every meeting adds more requested features. The result is an overgrown plan that no one can explain clearly.",
        [
          "Use the eliminate reduce raise create grid to sort which ideas remove friction, which ones simply add clutter, and which ones create genuine new value.",
          "Keep only the changes that produce a more focused and different curve for students using the service."
        ],
        "The chapter matters here because tools are what turn crowded brainstorming into strategic choice."
      ),
      example(
        "ch02-ex03",
        "A coffee chain stops guessing",
        ["work"],
        "A small coffee chain wants a stronger loyalty offer and keeps copying what larger brands are doing. Leaders have opinions about convenience, ambiance, food, and speed, but they have never mapped how customers compare the chain with convenience stores, local cafes, and brewing at home.",
        [
          "Build a strategy canvas against those alternatives instead of treating only direct cafes as the market.",
          "Use the curve to identify where the chain is overspending and where a clearer offer could actually diverge."
        ],
        "This matters because visual tools reveal where the business is clustered with rivals and where a real opening might exist."
      ),
      example(
        "ch02-ex04",
        "A product portfolio with no real pioneers",
        ["work"],
        "Your software company has many active products, but most of them are feature extensions of the same core model. The team talks as if the portfolio is balanced, yet growth keeps slowing.",
        [
          "Use a pioneer migrator settler map to classify each offer honestly by how much new value space it opens.",
          "Then shift attention toward the projects that could become true pioneers instead of endlessly polishing settlers."
        ],
        "The chapter shows that strategy tools are also portfolio tools. They make it harder to confuse activity with future growth."
      ),
      example(
        "ch02-ex05",
        "A side project becomes legible",
        ["personal"],
        "You and two friends want to build a weekend side project, but you keep bouncing between ideas because each conversation drifts into random features and personal taste.",
        [
          "Map the real alternatives people use today and compare them on a short list of value factors.",
          "Use that picture to decide where your idea can focus, diverge, and say something clear in one line."
        ],
        "This matters because a visual frame helps small teams stop confusing enthusiasm with strategy."
      ),
      example(
        "ch02-ex06",
        "Choosing the right fitness plan",
        ["personal"],
        "You are trying to choose between several fitness options, and each one sounds good in isolation. What actually matters to you is convenience, recovery, social comfort, and consistency, but you have never compared the options on those factors side by side.",
        [
          "Make a simple value map instead of deciding from scattered impressions.",
          "Use the comparison to see which option is focused on what you truly value and which ones are bloated with things that sound impressive but will not keep you consistent."
        ],
        "The chapter applies in personal life because clear tools often reveal the real decision far faster than vague reflection does."
      ),
    ],
    questions: [
      question(
        "ch02-q01",
        "What does the strategy canvas mainly help a team see?",
        [
          "How the market competes across key factors and where its own value curve sits in that pattern",
          "How much total budget the team should request for the next launch",
          "Which competitor has the strongest branding voice on social media",
          "Which internal department is most excited about change"
        ],
        0,
        "The strategy canvas makes the current competitive profile visible so leaders can spot sameness and openings."
      ),
      question(
        "ch02-q02",
        "Why is focus important in a blue ocean value curve?",
        [
          "Because trying to be strong on everything usually creates cost and sameness at the same time",
          "Because buyers only trust offers with very few features",
          "Because focus mainly helps marketing teams write shorter copy",
          "Because focus matters only in luxury markets"
        ],
        0,
        "A focused curve shows disciplined choice about what deserves investment and what does not."
      ),
      question(
        "ch02-q03",
        "What is the main purpose of the eliminate reduce raise create grid?",
        [
          "To force concrete tradeoffs about what the strategy will stop, cut back, strengthen, and newly build",
          "To rank competitors from weakest to strongest before choosing a price",
          "To estimate how much time each department spends on execution",
          "To gather as many feature ideas as possible before narrowing them"
        ],
        0,
        "The grid turns abstract ambition into strategic choices about value and cost."
      ),
      question(
        "ch02-q04",
        "Why is a compelling tagline a useful test?",
        [
          "It shows whether the strategy is clear enough for buyers to understand and care about",
          "It proves the company has already achieved strong brand awareness",
          "It guarantees the offer will be difficult for rivals to imitate",
          "It replaces the need for any further strategic analysis"
        ],
        0,
        "If the offer cannot be expressed clearly in buyer language, the strategy is often still fuzzy."
      ),
      question(
        "ch02-q05",
        "A debate club wants more members and keeps arguing about social media content, flyers, and event frequency. Students outside the club do not compare it only with other debate teams. They compare it with casual speaking workshops, entrepreneurship clubs, and no extra activity at all. What is the strongest next step?",
        [
          "Draw a strategy canvas against those real alternatives before deciding what the club should change",
          "Increase posting volume first so students can see more debate activity",
          "Copy the most successful debate team on campus and match its schedule",
          "Keep adding events so the club appears more serious"
        ],
        0,
        "The canvas clarifies the real field of comparison and reveals where the club can actually diverge."
      ),
      question(
        "ch02-q06",
        "Your group is building a campus food pantry app, and every meeting adds more requested features. The result is an overgrown plan that no one can explain clearly. What is the strongest next step?",
        [
          "Use the eliminate reduce raise create grid to cut clutter and keep only the changes that create a clearer value curve",
          "Accept every feature so the final app can satisfy the widest range of opinions",
          "Delay all decisions until more student requests come in",
          "Choose the most technically impressive version so the project feels innovative"
        ],
        0,
        "The grid helps the team move from feature collection to strategic choice."
      ),
      question(
        "ch02-q07",
        "A small coffee chain wants a stronger loyalty offer and keeps copying what larger brands are doing. Leaders have opinions about convenience, ambiance, food, and speed, but they have never mapped how customers compare the chain with convenience stores, local cafes, and brewing at home. What is the strongest next step?",
        [
          "Build a strategy canvas against those alternatives to see where the current offer is clustered and where it could diverge",
          "Adopt the largest chain's loyalty structure so customers immediately recognize the program",
          "Raise discounts across all purchase categories to match the market",
          "Focus the discussion on what the internal team personally likes about the brand"
        ],
        0,
        "The right tool exposes the current curve and stops the team from copying the market blindly."
      ),
      question(
        "ch02-q08",
        "Your software company has many active products, but most of them are feature extensions of the same core model. The team talks as if the portfolio is balanced, yet growth keeps slowing. What is the strongest next step?",
        [
          "Map the portfolio as pioneers, migrators, and settlers to see whether real future growth options are actually being built",
          "Keep funding all current products equally so no team feels threatened",
          "Add more features to the strongest settler product and call that innovation",
          "Wait for quarterly revenue to reveal which product deserves investment"
        ],
        0,
        "The pioneer migrator settler map makes it harder to confuse busy product activity with genuine future growth."
      ),
      question(
        "ch02-q09",
        "You and two friends want to build a weekend side project, but you keep bouncing between ideas because each conversation drifts into random features and personal taste. What is the strongest next step?",
        [
          "Map the current alternatives and compare them on a small set of value factors before choosing the direction",
          "Pick the idea with the longest feature list because it seems most ambitious",
          "Choose whichever concept feels newest and most exciting in the moment",
          "Delay the decision until one person is confident enough to overrule the others"
        ],
        0,
        "A simple value map creates shared visibility and keeps the team from confusing enthusiasm with strategy."
      ),
      question(
        "ch02-q10",
        "You are trying to choose between several fitness options, and each one sounds good in isolation. What actually matters to you is convenience, recovery, social comfort, and consistency, but you have never compared the options on those factors side by side. What is the strongest next step?",
        [
          "Create a simple comparison curve around the factors that truly matter and decide from that picture",
          "Pick the option with the strongest marketing and assume the rest will work out",
          "Choose the most advanced program because more features usually mean better value",
          "Wait until one option goes on sale and use price alone to decide"
        ],
        0,
        "The chapter's tools are useful because they make the real choice visible instead of leaving it buried in vague impressions."
      ),
    ],
  }),
  chapter({
    chapterId: "ch03-reconstruct-market-boundaries",
    number: 3,
    title: "Reconstruct Market Boundaries",
    summary: {
      p1: t(
        "The chapter argues that blue oceans are found by reconstructing market boundaries in a systematic way, not by waiting for random inspiration. The six paths framework shows where to look beyond accepted rivals, buyers, and product definitions.",
        "Those paths ask leaders to look across alternative industries, strategic groups, the chain of buyers, complementary offerings, functional and emotional appeal, and external trends over time.",
        "The core move is to challenge the narrow lens that defines what business you think you are in. Once that lens changes, new demand patterns become easier to see."
      ),
      p2: t(
        "This matters because most competition becomes intense after firms accept the same market boundaries and the same buyer problem. Teams start improving the answer they inherited instead of questioning the question itself.",
        "The six paths give disciplined ways to widen the search. They help strategy move from wishful brainstorming to repeatable discovery.",
        "The deeper lesson is that blue oceans often sit at the seams between categories buyers already cross in real life. People combine alternatives, work around friction, and balance tradeoffs long before companies recognize the pattern."
      ),
    },
    simpleIndexes: [0, 1, 2, 3, 4, 5, 9],
    standardBullets: [
      bullet(
        "Alternative industries. Buyers often choose between different kinds of solutions, not just same industry rivals.",
        "Looking across alternatives reveals what people are really trying to accomplish, not just the product category they happen to use."
      ),
      bullet(
        "Strategic groups. Value gaps appear between high end and low end positions when neither solves the full job well.",
        "Moving across group boundaries can expose a better mix of simplicity, status, quality, and price."
      ),
      bullet(
        "Chain of buyers. Users, purchasers, and influencers can value different things.",
        "A blue ocean can appear when you redesign the offer for the neglected decision maker in the chain."
      ),
      bullet(
        "Complementary offerings. Friction often lives before, during, or after the core purchase.",
        "If you remove the hassle around the product, you can create value competitors never addressed."
      ),
      bullet(
        "Functional and emotional appeal. Industries often overcommit to one mode and ignore the other.",
        "Shifting the appeal can open space by simplifying a category or making it more engaging and human."
      ),
      bullet(
        "Time trends. External shifts can create openings when you act on them early and clearly.",
        "The useful trends are the ones that are irreversible, have a clear direction, and matter to buyer value."
      ),
      bullet(
        "Redefine the job. The question is not how to beat rivals at their own frame, but whether the frame is too small.",
        "Blue ocean search starts by reframing what problem is actually being solved."
      ),
      bullet(
        "Combine paths. The strongest moves often draw insight from more than one path at the same time.",
        "A better strategy can come from linking buyer chain insight with complement insight or trend insight with alternative industries."
      ),
      bullet(
        "Practical observation. Watch where people stitch together workarounds across categories.",
        "Those workarounds often point straight to unmet value that the market has failed to integrate."
      ),
      bullet(
        "Disciplined imagination. Boundary reconstruction turns creativity into a search process.",
        "The point is not to dream harder. It is to look in the right places."
      ),
    ],
    deeperBullets: [
      bullet(
        "Noncustomers often make the seams visible first. People outside the market are less likely to accept its boundaries as natural.",
        "Their refusal often reveals which assumptions are strangling demand."
      ),
      bullet(
        "Not every trend is strategically useful. Leaders should look for trends that are clear, decisive, and already changing behavior.",
        "Weak or fashionable signals can distract a team into speculative strategy."
      ),
      bullet(
        "Category language can blind you. The labels an industry uses can make certain alternatives or buyer groups disappear from view.",
        "Changing the language often changes what the team can finally notice."
      ),
      bullet(
        "The six paths are strongest when grounded in field evidence. They are not meant to be solved by clever whiteboard talk alone.",
        "Real observation keeps the search from becoming abstract or self flattering."
      ),
      bullet(
        "Boundary reconstruction is a practical antidote to competitive tunnel vision. It creates pattern recognition where crowded markets create habit.",
        "That is why the framework sits at the heart of blue ocean discovery."
      ),
    ],
    takeaways: [
      "Use the six paths framework",
      "Look across real alternatives",
      "Buyer chains and complements matter",
      "Functional and emotional frames can shift",
      "Trends can open new space",
      "Discovery needs a search process",
    ],
    practice: [
      "Choose one market and inspect it through all six paths",
      "List the workarounds buyers use before and after the core purchase",
      "Ask which buyer in the chain is being ignored",
      "Write one strategic idea that combines two paths at once",
    ],
    examples: [
      example(
        "ch03-ex01",
        "Late night study food that solves the real problem",
        ["school"],
        "A student team wants to improve late night food access on campus and keeps comparing dining halls with other campus dining options. Students actually bounce between vending machines, delivery apps, instant noodles, and long walks off campus depending on time, money, and stress.",
        [
          "Look across those alternative solutions and the complementary hassles around them instead of treating dining halls as the only comparison.",
          "Design around the real job students are trying to solve, which is reliable fast food during study pressure without cost or travel friction."
        ],
        "This matters because the biggest opening often appears when you stop using the industry's own boundaries and start following how people actually solve the problem."
      ),
      example(
        "ch03-ex02",
        "A mentorship program for the ignored buyer",
        ["school"],
        "A college mentorship program mainly speaks to high achieving students who already know how to navigate internships. Career counselors notice that parents and first generation students often influence the decision to join, but the program never designed for them.",
        [
          "Look across the buyer chain and ask whose concerns are shaping participation behind the scenes.",
          "Redesign the program with simple parent briefings, first step guidance, and low pressure entry points that make the neglected decision makers more supportive."
        ],
        "The chapter matters here because a better strategy can come from addressing a different buyer in the chain, not just polishing the old offer."
      ),
      example(
        "ch03-ex03",
        "Pet care between the vet and the groomer",
        ["work"],
        "A pet care business keeps benchmarking other grooming salons, yet customers often juggle vets, mobile groomers, do it yourself baths, and pet supply stores depending on what they need. The company still thinks only in salon terms.",
        [
          "Study the alternative industries and complementary steps customers already combine.",
          "Build an offer that removes the switching hassle, such as bundled health check reminders, simple grooming plans, and easier home care support."
        ],
        "This matters because better strategy often comes from seeing the broader problem space buyers already navigate on their own."
      ),
      example(
        "ch03-ex04",
        "Accounting software that lowers anxiety",
        ["work"],
        "A small business accounting tool competes on features and depth, but many owners stay with messy spreadsheets because they dread complex finance software. The whole category assumes buyers want more technical power, when many actually want calm and confidence.",
        [
          "Look at the functional and emotional orientation of the market instead of adding more professional grade features.",
          "Design a simpler guidance led experience that reduces fear and turns accounting into a more approachable task."
        ],
        "The chapter shows that a category can open new space when it changes the kind of appeal it delivers."
      ),
      example(
        "ch03-ex05",
        "A family travel plan that beats the usual options",
        ["personal"],
        "You are planning a yearly family trip and keep comparing airlines, hotels, and rental houses one by one. What your family actually cares about is reducing coordination stress, food uncertainty, and boredom for different age groups.",
        [
          "Stop treating each provider category as the whole decision and look across the complementary experience around the trip.",
          "Choose or design the trip around the total experience your family needs rather than the single category that is easiest to compare online."
        ],
        "This matters because people often solve real life problems across categories. Strategy improves when you follow the full job instead of the narrow label."
      ),
      example(
        "ch03-ex06",
        "A neighborhood child care idea with a different frame",
        ["personal"],
        "Parents on your block say they need help with child care, but the current choices feel split between expensive sitters and informal favors that are hard to organize. Everyone complains, yet no one has looked at the problem beyond those two standard options.",
        [
          "Look across alternative solutions, buyer concerns, and complementary hassles such as pickup timing and trust.",
          "Create a simpler rotating care format or trusted backup circle that addresses the real coordination job the current options leave unresolved."
        ],
        "The chapter applies here because new value often appears when you stop accepting the standard categories people have been forced to choose between."
      ),
    ],
    questions: [
      question(
        "ch03-q01",
        "What is the main purpose of the six paths framework?",
        [
          "To help leaders systematically look beyond accepted market boundaries instead of relying on random brainstorming",
          "To rank competitors by market share before choosing a response",
          "To decide which departments should own execution after launch",
          "To price a new offer after the features are already locked in"
        ],
        0,
        "The six paths framework widens the search for opportunity in a disciplined way."
      ),
      question(
        "ch03-q02",
        "Why is looking across alternative industries useful?",
        [
          "Because buyers often choose between different kinds of solutions that solve the same broader problem",
          "Because rivals inside the industry are usually too similar to study",
          "Because alternative industries always have lower prices",
          "Because blue oceans can only exist outside existing categories"
        ],
        0,
        "Alternative industries reveal what buyers are really trying to get done beyond the industry's own label."
      ),
      question(
        "ch03-q03",
        "What does the chain of buyers path highlight?",
        [
          "That users, purchasers, and influencers can value different things and one of them may be underserved",
          "That the most profitable buyer is always the end user",
          "That buyers mainly care about product complexity",
          "That marketing should speak to every buyer in the same way"
        ],
        0,
        "A market can open when the strategy is rebuilt for the neglected decision maker in the chain."
      ),
      question(
        "ch03-q04",
        "Which statement best reflects the chapter's logic?",
        [
          "Strategy improves when you redefine the problem instead of only improving the inherited answer",
          "The best ideas usually come from adding more value to current customer segments one by one",
          "The safest growth path is to stay inside the industry's accepted boundaries",
          "Trend analysis matters only after the strategy is already launched"
        ],
        0,
        "Blue ocean discovery begins by questioning the frame of competition itself."
      ),
      question(
        "ch03-q05",
        "A student team wants to improve late night food access on campus and keeps comparing dining halls with other campus dining options. Students actually bounce between vending machines, delivery apps, instant noodles, and long walks off campus depending on time, money, and stress. What is the strongest next step?",
        [
          "Look across those alternatives and the complementary hassles around them before designing the offer",
          "Add more menu items to the existing dining hall and assume choice is the main problem",
          "Copy the best rated campus dining format from another university",
          "Focus only on dining hall price because that is the core category"
        ],
        0,
        "The better move follows the broader job students are trying to solve rather than the narrow industry category."
      ),
      question(
        "ch03-q06",
        "A college mentorship program mainly speaks to high achieving students who already know how to navigate internships. Career counselors notice that parents and first generation students often influence the decision to join, but the program never designed for them. What is the strongest next step?",
        [
          "Redesign parts of the program for the neglected decision makers in the buyer chain",
          "Keep the current model and simply advertise the same benefits more widely",
          "Raise the bar for entry so the program feels more prestigious",
          "Focus only on the current top students because they are easiest to recruit"
        ],
        0,
        "The chain of buyers path helps reveal whose needs are shaping demand even when they are not the visible user."
      ),
      question(
        "ch03-q07",
        "A pet care business keeps benchmarking other grooming salons, yet customers often juggle vets, mobile groomers, do it yourself baths, and pet supply stores depending on what they need. What is the strongest next step?",
        [
          "Study those alternative solutions and the total hassle customers face before building a new offer",
          "Keep comparing only grooming salons because that is the direct industry",
          "Lower prices against rival salons first and revisit strategy later",
          "Add more premium grooming packages to signal expertise"
        ],
        0,
        "Looking across alternative industries and complementary hassles reveals the broader problem customers are already solving for themselves."
      ),
      question(
        "ch03-q08",
        "A small business accounting tool competes on features and depth, but many owners stay with messy spreadsheets because they dread complex finance software. What is the strongest next step?",
        [
          "Shift the offer toward a simpler and calmer experience instead of adding more technical depth",
          "Match the most advanced competitor feature set so the product seems serious",
          "Target only trained accountants and abandon anxious owners",
          "Keep the current design and explain the features more aggressively"
        ],
        0,
        "This uses the functional and emotional path by changing the kind of value the market delivers."
      ),
      question(
        "ch03-q09",
        "You are planning a yearly family trip and keep comparing airlines, hotels, and rental houses one by one. What your family actually cares about is reducing coordination stress, food uncertainty, and boredom for different age groups. What is the strongest next step?",
        [
          "Design the trip around the total experience and complementary hassles instead of comparing single categories in isolation",
          "Choose the cheapest flight first and let the rest of the plan sort itself out",
          "Copy the itinerary another family used because it already worked once",
          "Focus only on lodging quality because that is the highest cost item"
        ],
        0,
        "The chapter applies because better solutions often appear when you follow the whole job rather than one narrow category."
      ),
      question(
        "ch03-q10",
        "Parents on your block say they need help with child care, but the current choices feel split between expensive sitters and informal favors that are hard to organize. Everyone complains, yet no one has looked at the problem beyond those two standard options. What is the strongest next step?",
        [
          "Look across the alternative solutions and the coordination hassles to design a different care format",
          "Accept that child care only has the two normal options and pick the cheaper one",
          "Wait until a formal business can solve the whole problem at scale",
          "Keep using informal favors because they are familiar even if they are unreliable"
        ],
        0,
        "A blue ocean opportunity often appears when people stop accepting the standard categories they have been forced to choose between."
      ),
    ],
  }),
  chapter({
    chapterId: "ch04-big-picture-focus",
    number: 4,
    title: "Focus on the Big Picture, Not the Numbers",
    summary: {
      p1: t(
        "The chapter argues that teams should build blue ocean strategy around the big picture of buyer value rather than around spreadsheets and line item planning. A visual process helps leaders see the current curve, explore alternatives in the field, test new curves, and communicate the chosen one.",
        "Kim and Mauborgne outline four steps: visual awakening, visual exploration, visual strategy fair, and visual communication. Each step moves the team from internal assumption toward shared strategic clarity.",
        "The point is not to ignore numbers. It is to use numbers after the strategic picture is strong enough to deserve detailed support."
      ),
      p2: t(
        "This matters because detail can create the feeling of rigor while hiding weak strategy. Teams can spend months refining budgets for an idea that is still trapped in the old game.",
        "A visual process breaks that pattern. It brings customers, noncustomers, and frontline reality into strategy formation before the organization commits.",
        "The deeper lesson is that big picture thinking is a coordination tool. When people can picture the move, they can debate it honestly, support it faster, and stop optimizing tiny parts against the whole."
      ),
    },
    simpleIndexes: [0, 1, 2, 3, 4, 8, 9],
    standardBullets: [
      bullet(
        "Big picture first. Strategy should be visible before it is fully quantified.",
        "A team needs to see the shape of the move before it buries the discussion in detail."
      ),
      bullet(
        "Visual awakening. Compare your current curve with rivals to see how similar you really are.",
        "This step is meant to shake people out of the belief that the existing strategy is already distinctive."
      ),
      bullet(
        "Field exploration. Go outside the office and observe customers, noncustomers, and alternatives directly.",
        "Real observation reveals friction, shortcuts, and unmet needs that reports often miss."
      ),
      bullet(
        "Strategy fair. Put multiple possible curves in front of users and partners and listen to their reactions.",
        "This tests whether the new direction creates genuine clarity and attraction for the market."
      ),
      bullet(
        "Visual communication. Once the curve is chosen, show everyone how the old and new profiles differ.",
        "That makes the strategic shift easier to understand across the organization."
      ),
      bullet(
        "Details can hide sameness. More numbers do not rescue a weak strategic shape.",
        "A precise budget attached to a crowded strategy is still a crowded strategy."
      ),
      bullet(
        "Users reveal waste. Outsiders spot pain points insiders have normalized.",
        "This is why field work matters so much in the blue ocean planning process."
      ),
      bullet(
        "One picture supports tradeoffs. A clear curve helps teams decide what to stop doing.",
        "Tradeoffs become more realistic when people can see the whole system at once."
      ),
      bullet(
        "Practical test. If you cannot explain the strategy in one picture and one clear sentence, it is not ready.",
        "Lack of clarity at this stage usually signals lack of strategic focus."
      ),
      bullet(
        "Shared picture, better execution. People follow through better when the move is easy to see.",
        "A visible strategy is easier to debate, remember, and execute."
      ),
    ],
    deeperBullets: [
      bullet(
        "Debate improves when it is anchored in visuals. People can challenge a picture more honestly than a fog of slogans and spreadsheets.",
        "That makes disagreement more productive because it stays tied to the strategic shape."
      ),
      bullet(
        "Frontline voices matter because they live the buyer experience. Visual exploration loses power when leaders outsource the field reality they most need to see.",
        "Direct exposure creates strategic conviction that secondhand summaries rarely produce."
      ),
      bullet(
        "The four step process creates discipline against premature convergence. It slows the rush to decide before the field has really been explored.",
        "That patience improves the odds of finding a curve that truly diverges."
      ),
      bullet(
        "Budgets should support the curve, not lead it. Once numbers start driving strategy too early, the team often protects legacy assumptions disguised as realism.",
        "Good sequencing matters even in planning."
      ),
      bullet(
        "Visual clarity helps preserve divergence over time. It gives the organization a reference point for later choices, which reduces drift back into sameness.",
        "A visible curve is not just a planning tool. It is also a guardrail."
      ),
    ],
    takeaways: [
      "Use a visual planning process",
      "See the current curve before changing it",
      "Field exploration beats conference room guesses",
      "Strategy fairs test real reactions",
      "One picture supports tradeoffs",
      "Clarity improves execution",
    ],
    practice: [
      "Compare your current value curve with the closest alternatives",
      "Observe buyers and nonbuyers in the field instead of only reading reports",
      "Sketch at least two new curves before choosing one",
      "Communicate the final strategy in one picture and one sentence",
    ],
    examples: [
      example(
        "ch04-ex01",
        "Orientation planning with too many sheets and not enough sight",
        ["school"],
        "A student affairs team is redesigning first year orientation and keeps trading spreadsheets about events, attendance, and staffing. Very few of the planners have walked the day from a new student's point of view, and nobody can describe the overall experience clearly.",
        [
          "Start by mapping the current experience visually and comparing it with what students actually do when they arrive.",
          "Then observe the journey on the ground and test a few new experience curves before locking the schedule."
        ],
        "This matters because details can consume a planning process before the team has even agreed on the strategic shape of the experience."
      ),
      example(
        "ch04-ex02",
        "A campus app that needs a strategy fair",
        ["school"],
        "Your project team is designing a campus event app and has three competing concepts, yet the whole debate is happening inside the team. Students who do not currently use event tools have never seen the alternatives.",
        [
          "Run a simple strategy fair with students, staff, and nonusers so the team can see which concept actually creates the clearest value.",
          "Use those reactions to choose one curve and explain it visually before building further."
        ],
        "The chapter matters here because a visual strategy fair tests the big picture with real people before the team commits to detail."
      ),
      example(
        "ch04-ex03",
        "A bank service redesign that needs field reality",
        ["work"],
        "A regional bank wants to improve its small business service, but planning meetings stay trapped in dashboards and process charts. Frontline visits have been postponed because leaders assume they already know the main pain points.",
        [
          "Use visual awakening to compare the current curve with real alternatives, then send the team into the field to watch business owners navigate the service.",
          "Do not return to detailed planning until the team has sketched and tested a clearer future curve."
        ],
        "This matters because visual exploration often reveals a very different strategic picture than internal reporting does."
      ),
      example(
        "ch04-ex04",
        "A volunteer program drowning in metrics",
        ["work"],
        "A nonprofit is redesigning its volunteer program and keeps multiplying dashboards, forms, and scorecards. Staff members can no longer explain the program in a simple way, and volunteer retention is falling.",
        [
          "Pull the team back to the big picture and map the current volunteer experience visually.",
          "Use that picture to decide which parts of the program create real value and which details are simply obscuring a weak strategic shape."
        ],
        "The chapter shows that more measurement is not the same as better strategy. The big picture has to come first."
      ),
      example(
        "ch04-ex05",
        "A community run group that cannot decide what it is",
        ["personal"],
        "You and a few friends want to start a neighborhood running group, but the idea keeps drifting between serious training, casual social runs, and wellness education. The plan is full of details, yet no one can say what experience the group is really meant to deliver.",
        [
          "Sketch a few possible value curves for the group before deciding on activities and logistics.",
          "Show those options to both runners and nonrunners so the group can choose a clear direction with real feedback."
        ],
        "This matters because even small projects benefit from a visible strategic picture before they sink into detail."
      ),
      example(
        "ch04-ex06",
        "A family meal service that needs one clear picture",
        ["personal"],
        "Your family is considering a small weekend meal prep service, but planning conversations jump between packaging, recipes, kitchen costs, and delivery timing. No one has yet described the overall experience buyers would actually be choosing.",
        [
          "Step back and draw the current alternatives and the future experience you want to create before refining operations.",
          "Use that big picture to decide what the service is really promising and what details matter enough to support it."
        ],
        "The chapter applies here because clarity about the whole experience makes later planning more useful and less chaotic."
      ),
    ],
    questions: [
      question(
        "ch04-q01",
        "Why does the chapter put the big picture before detailed planning?",
        [
          "Because detailed numbers can create false rigor around a strategy that is still crowded or unclear",
          "Because numbers are rarely useful in business decisions",
          "Because the best strategies are always simple enough to need no further analysis",
          "Because budgeting should happen only after launch"
        ],
        0,
        "The point is to establish a strong strategic shape before detail locks weak assumptions in place."
      ),
      question(
        "ch04-q02",
        "What is visual awakening meant to do?",
        [
          "Show the team how similar its current strategy may be to the rest of the market",
          "Help leaders write more persuasive marketing copy",
          "Create detailed financial forecasts for future demand",
          "Test pricing before the offer has been redesigned"
        ],
        0,
        "Visual awakening helps teams see the current curve clearly and challenge the belief that it is already distinctive."
      ),
      question(
        "ch04-q03",
        "Why is field exploration important in the process?",
        [
          "It exposes real buyer and nonbuyer experience that internal reports and assumptions often miss",
          "It helps managers avoid talking with users directly after launch",
          "It mainly gives the team stronger anecdotes for presentations",
          "It replaces the need for any visual strategy work"
        ],
        0,
        "Field exploration grounds the strategic picture in observed reality rather than conference room belief."
      ),
      question(
        "ch04-q04",
        "What is the best test for whether a strategic picture is clear enough?",
        [
          "You can show it in one picture and explain it in one plain sentence",
          "It includes every possible detail the team might later need",
          "Senior leaders agree to it immediately without external feedback",
          "It uses the largest amount of data available"
        ],
        0,
        "Clarity is a real test because strategy has to be grasped before it can be aligned and executed."
      ),
      question(
        "ch04-q05",
        "A student affairs team is redesigning first year orientation and keeps trading spreadsheets about events, attendance, and staffing. Very few of the planners have walked the day from a new student's point of view, and nobody can describe the overall experience clearly. What is the strongest next step?",
        [
          "Map the current experience visually and observe the journey on the ground before refining the schedule",
          "Keep optimizing the staffing sheet because operations detail will reveal the best strategy",
          "Add more orientation events so students have greater choice",
          "Finalize the budget first and use it to define the experience later"
        ],
        0,
        "The chapter's process starts by making the big picture visible and then testing it against real experience."
      ),
      question(
        "ch04-q06",
        "Your project team is designing a campus event app and has three competing concepts, yet the whole debate is happening inside the team. Students who do not currently use event tools have never seen the alternatives. What is the strongest next step?",
        [
          "Run a strategy fair with users and nonusers before committing to one concept",
          "Let the loudest internal advocate choose the direction to save time",
          "Build all three versions in detail and compare them later",
          "Keep the debate private until the design is fully polished"
        ],
        0,
        "A strategy fair tests the strategic picture with the people it is meant to serve."
      ),
      question(
        "ch04-q07",
        "A regional bank wants to improve its small business service, but planning meetings stay trapped in dashboards and process charts. Frontline visits have been postponed because leaders assume they already know the main pain points. What is the strongest next step?",
        [
          "Compare the current curve with real alternatives and send the team into the field before returning to detailed planning",
          "Add more performance metrics so leaders can reach a decision faster",
          "Focus first on internal efficiency because buyers usually adapt to the service",
          "Keep the service model unchanged and upgrade the presentation materials"
        ],
        0,
        "The chapter argues that field reality and the strategic picture should guide detail, not the other way around."
      ),
      question(
        "ch04-q08",
        "A nonprofit is redesigning its volunteer program and keeps multiplying dashboards, forms, and scorecards. Staff members can no longer explain the program in a simple way, and volunteer retention is falling. What is the strongest next step?",
        [
          "Map the current volunteer experience visually and decide which details actually support a clearer strategy",
          "Create even more scorecards so every part of the program can be measured",
          "Increase volunteer expectations so only serious people remain",
          "Wait for more retention data before challenging the existing shape"
        ],
        0,
        "A weak strategic picture often hides behind excessive detail. The first fix is to see the whole experience clearly."
      ),
      question(
        "ch04-q09",
        "You and a few friends want to start a neighborhood running group, but the idea keeps drifting between serious training, casual social runs, and wellness education. The plan is full of details, yet no one can say what experience the group is really meant to deliver. What is the strongest next step?",
        [
          "Sketch a few possible value curves and test them with both runners and nonrunners before deciding the format",
          "Keep adding activities so the group appeals to everyone at once",
          "Start with the schedule and worry about the group's identity later",
          "Copy the most established local running club to save time"
        ],
        0,
        "The chapter shows that a clear strategic picture should come before detailed planning and execution."
      ),
      question(
        "ch04-q10",
        "Your family is considering a small weekend meal prep service, but planning conversations jump between packaging, recipes, kitchen costs, and delivery timing. No one has yet described the overall experience buyers would actually be choosing. What is the strongest next step?",
        [
          "Draw the current alternatives and the future experience you want to create before refining operations",
          "Keep discussing kitchen details until the strategy becomes obvious on its own",
          "Start selling immediately and let buyer complaints define the model",
          "Choose the cheapest operational setup and build the experience around it later"
        ],
        0,
        "A strong answer begins with the big picture of buyer value, which then guides which operational details matter."
      ),
    ],
  }),
  chapter({
    chapterId: "ch05-beyond-existing-demand",
    number: 5,
    title: "Reach Beyond Existing Demand",
    summary: {
      p1: t(
        "The chapter argues that the biggest blue oceans come from reaching beyond existing demand instead of segmenting current customers ever more finely. Noncustomers often reveal the largest openings because their reasons for staying away expose what the market gets wrong.",
        "The book organizes noncustomers into three tiers: those on the edge of leaving or joining, those who consciously refuse the market, and those who have never been targeted at all. Looking across these tiers reveals shared barriers that firms can remove.",
        "This shifts strategy from chasing finer preference differences to finding a broader common value proposition that pulls more people in."
      ),
      p2: t(
        "This matters because customer focus can become too narrow. Firms listen closely to current buyers and accidentally optimize for the people who already learned to tolerate the market's friction.",
        "Noncustomers widen the lens. They show what makes the category too costly, too complex, too intimidating, or simply not worth the effort.",
        "The deeper lesson is that mass demand often comes from solving a few big barriers that cut across groups, not from tailoring tiny variations for every segment. Blue oceans grow by simplifying access to meaningful value."
      ),
    },
    simpleIndexes: [0, 1, 2, 4, 5, 7, 9],
    standardBullets: [
      bullet(
        "Existing customers can blind you. Studying only current buyers narrows the search for growth.",
        "Current customers already adapted to the market, so they may not reveal the biggest barriers holding others back."
      ),
      bullet(
        "First tier noncustomers are near the edge. They use the market reluctantly or only sometimes.",
        "Their behavior shows which parts of the current offer are barely good enough."
      ),
      bullet(
        "Second tier noncustomers refuse the market on purpose. They saw the offer and decided it was not worth it.",
        "Their reasons often reveal strong barriers that incumbents have normalized."
      ),
      bullet(
        "Third tier noncustomers sit outside the industry's map entirely.",
        "Looking at them can reveal demand the market never thought to address."
      ),
      bullet(
        "Common hurdles matter more than fine differences. Blue oceans often emerge from what many noncustomers share.",
        "The goal is to find a few powerful barriers that keep a large group away."
      ),
      bullet(
        "Remove complexity, risk, and hassle. Many people stay away because the category asks too much.",
        "Making the offer easier, safer, and more straightforward can unlock mass demand."
      ),
      bullet(
        "Aim for mass, not micro segments. The chapter warns against slicing the market into smaller and smaller pieces.",
        "Growth gets bigger when the strategy makes sense to more people at once."
      ),
      bullet(
        "Practical interviews. Ask noncustomers why they stay away, what they use instead, and what makes the category not worth the trouble.",
        "Those conversations often reveal more than another satisfaction survey of current users."
      ),
      bullet(
        "Noncustomer insight pairs with value innovation. The point is not to study outsiders for curiosity alone.",
        "The point is to redesign the offer around the barriers that keep them out."
      ),
      bullet(
        "Demand grows when the reason people opted out is solved. That is how the market boundary expands.",
        "The chapter turns attention from defending current share to unlocking new participation."
      ),
    ],
    deeperBullets: [
      bullet(
        "The tiers are useful because they widen the search gradually. They move the team from near market edges to fully outside the accepted frame.",
        "That helps leaders avoid jumping straight into vague speculation."
      ),
      bullet(
        "Low interest is not the same as no demand. Sometimes people stay away because the offer asks them to accept too much friction or identity cost.",
        "Nonuse can be a design signal, not proof of indifference."
      ),
      bullet(
        "Demographics alone rarely explain the opening. The deeper pattern is usually a shared barrier or shared job to be done.",
        "That is why the chapter looks for commonality before difference."
      ),
      bullet(
        "Aiming for mass may require giving up attractive edge cases. Some features loved by current insiders can block broader adoption.",
        "Blue ocean growth often requires the courage to simplify."
      ),
      bullet(
        "Noncustomers often reveal missing complements too. What they avoid may include setup effort, learning cost, or coordination burdens around the product itself.",
        "That connects this chapter directly to the broader value innovation logic of the book."
      ),
    ],
    takeaways: [
      "Study noncustomers, not only customers",
      "Use the three tiers",
      "Look for common barriers",
      "Simplify access to value",
      "Avoid oversegmentation",
      "Growth comes from solving opt out reasons",
    ],
    practice: [
      "List the three tiers of noncustomers around one market",
      "Interview at least one person from each tier",
      "Write the shared barriers that appear across those interviews",
      "Redesign the offer around one barrier that keeps many people out",
    ],
    examples: [
      example(
        "ch05-ex01",
        "A library workshop for people who never come",
        ["school"],
        "Campus library workshops draw the same high performing students every month, while commuters and first generation students rarely attend. The staff keeps refining workshop content for regular attendees instead of studying the people who stay away.",
        [
          "Talk directly with the nonattenders and group them by how close they are to using the service and why they opted out.",
          "Redesign the workshops around the barriers they share, such as timing, intimidation, or unclear usefulness, instead of adding more content for current regulars."
        ],
        "This matters because growth often depends on understanding the people who said no, not only the people who already learned how to say yes."
      ),
      example(
        "ch05-ex02",
        "A coding club with no easy entry point",
        ["school"],
        "A coding club is full of capable members, but most students who are curious about tech never join. Leaders keep building advanced sessions for current members and call the low turnout outside the club a motivation problem.",
        [
          "Study the students who almost joined, the ones who rejected the club, and the ones who never considered it at all.",
          "Use the common barriers to create a low pressure entry path that makes the club feel useful and reachable for a much larger group."
        ],
        "The chapter shows that noncustomers usually reveal demand barriers more clearly than insiders do."
      ),
      example(
        "ch05-ex03",
        "Insurance that only works for confident users",
        ["work"],
        "An insurance app is designed for digitally confident customers who are comfortable comparing plans, uploading documents, and reading policy language. Many people still avoid the app because the whole process feels stressful and risky.",
        [
          "Study nonusers and light users to see which barriers are keeping them from the category's digital option.",
          "Redesign the experience around simpler choices, clearer guidance, and lower anxiety instead of only adding tools for current power users."
        ],
        "This matters because the biggest demand jump often comes from removing what makes the category feel not worth the effort."
      ),
      example(
        "ch05-ex04",
        "A climbing gym that wants more than climbers",
        ["work"],
        "A bouldering gym markets mostly to existing enthusiasts and wonders why growth has slowed. People who have never climbed say they feel too inexperienced, too unsure of etiquette, or too intimidated by the atmosphere.",
        [
          "Treat those noncustomers as the strategic center of the growth problem instead of as an afterthought.",
          "Build a beginner path that removes the social and practical barriers they share, rather than refining the offer mainly for the current climbing crowd."
        ],
        "The chapter matters here because noncustomers expose the friction current insiders stopped noticing."
      ),
      example(
        "ch05-ex05",
        "A book group for busy parents who never join book groups",
        ["personal"],
        "You want to start a neighborhood reading group, but every local version asks people to finish a full book, meet at night, and talk for hours. Busy parents say they like the idea of connection and learning, but not the current format.",
        [
          "Focus on why they stay away rather than refining the standard book club experience.",
          "Create a lighter format, such as short audio summaries, rotating child care, and shorter conversations, built around the barriers many parents share."
        ],
        "This matters because demand expands when the experience is redesigned for the people who never found the standard version worth joining."
      ),
      example(
        "ch05-ex06",
        "Homemade lunches beyond the usual buyers",
        ["personal"],
        "A friend sells healthy homemade lunches mainly to fitness enthusiasts. Office workers nearby still buy routine takeout because they assume the service is too specialized, too expensive, or too inconvenient for ordinary workdays.",
        [
          "Study the nonbuyers and look for the shared reasons they keep choosing the old routine.",
          "Redesign the offer for those common barriers, such as simpler ordering, predictable pricing, and more familiar meals, rather than adding more niche options for current fans."
        ],
        "The chapter shows that growth often comes from making an offer feel more reachable to people who never saw it as meant for them."
      ),
    ],
    questions: [
      question(
        "ch05-q01",
        "Why can current customers be a weak source of growth insight on their own?",
        [
          "Because they already adapted to the market's friction and may hide the barriers keeping larger groups away",
          "Because current customers are usually too loyal to give honest feedback",
          "Because only noncustomers understand price sensitivity",
          "Because current customers stop mattering once a company seeks growth"
        ],
        0,
        "Current customers know the market, but noncustomers often reveal what the market makes too hard or not worth the effort."
      ),
      question(
        "ch05-q02",
        "What is the point of looking across the three tiers of noncustomers?",
        [
          "To widen the search from near market edges to people the industry never targeted and find shared barriers across them",
          "To prove which noncustomers are least valuable so the firm can ignore them",
          "To identify which tier should receive the biggest advertising budget first",
          "To replace customer insight entirely"
        ],
        0,
        "The three tiers structure the search for new demand and help leaders look beyond the current customer base."
      ),
      question(
        "ch05-q03",
        "Which approach best fits the chapter's logic?",
        [
          "Look for common reasons many people stay away before chasing fine preference differences",
          "Segment the market into smaller groups until every offer can be highly customized",
          "Improve satisfaction among the most profitable current customers first and let growth follow",
          "Treat nonuse as proof that those people simply do not need the category"
        ],
        0,
        "Blue ocean demand often expands when a few major barriers are removed for a broad group."
      ),
      question(
        "ch05-q04",
        "What kind of barriers most often matter in noncustomer analysis?",
        [
          "The complexity, risk, hassle, and lack of obvious value that make the category feel not worth it",
          "The absence of premium features for advanced users",
          "The need for more detailed segmentation data before launch",
          "The lack of enough brand history in the category"
        ],
        0,
        "Many noncustomers stay away because the category asks too much before it gives enough value."
      ),
      question(
        "ch05-q05",
        "Campus library workshops draw the same high performing students every month, while commuters and first generation students rarely attend. The staff keeps refining workshop content for regular attendees instead of studying the people who stay away. What is the strongest next step?",
        [
          "Study the nonattenders by tier and redesign around the barriers they share",
          "Add more advanced workshop content for the students who already attend regularly",
          "Increase promotional reminders and assume awareness is the main issue",
          "Leave the format unchanged because regular attendees prove the workshops have value"
        ],
        0,
        "The chapter points leaders toward the people staying away and the barriers that keep them out."
      ),
      question(
        "ch05-q06",
        "A coding club is full of capable members, but most students who are curious about tech never join. Leaders keep building advanced sessions for current members and call the low turnout outside the club a motivation problem. What is the strongest next step?",
        [
          "Study the nonmembers across the three tiers and build a low pressure entry path around their shared barriers",
          "Make advanced sessions even more rigorous so the club becomes more prestigious",
          "Wait for current members to recruit their friends informally",
          "Offer more of the same sessions and assume interest will eventually rise"
        ],
        0,
        "Noncustomers often reveal that the problem is design and access, not motivation alone."
      ),
      question(
        "ch05-q07",
        "An insurance app is designed for digitally confident customers who are comfortable comparing plans, uploading documents, and reading policy language. Many people still avoid the app because the whole process feels stressful and risky. What is the strongest next step?",
        [
          "Redesign around the barriers nonusers share, such as anxiety, complexity, and unclear guidance",
          "Add more advanced comparison tools for the power users already on the app",
          "Assume the nonusers are simply not the right market for a digital product",
          "Lower price first and leave the experience unchanged"
        ],
        0,
        "A better move addresses why the offer feels not worth the effort to a broad group of nonusers."
      ),
      question(
        "ch05-q08",
        "A bouldering gym markets mostly to existing enthusiasts and wonders why growth has slowed. People who have never climbed say they feel too inexperienced, too unsure of etiquette, or too intimidated by the atmosphere. What is the strongest next step?",
        [
          "Build a beginner path around the social and practical barriers these noncustomers share",
          "Add more advanced wall routes for the regular climbers who already come often",
          "Raise membership prices so the gym can improve its image",
          "Ignore nonclimbers because they are outside the current customer base"
        ],
        0,
        "The chapter argues that large growth often comes from redesigning the offer for people who currently stay away."
      ),
      question(
        "ch05-q09",
        "You want to start a neighborhood reading group, but every local version asks people to finish a full book, meet at night, and talk for hours. Busy parents say they like the idea of connection and learning, but not the current format. What is the strongest next step?",
        [
          "Redesign the format around the barriers busy parents share instead of polishing the standard book club model",
          "Keep the standard book club structure so the group feels serious",
          "Target only the few parents who already enjoy long evening discussions",
          "Delay the group until everyone can commit to the original format"
        ],
        0,
        "The strongest move focuses on why noncustomers opt out and removes those common barriers."
      ),
      question(
        "ch05-q10",
        "A friend sells healthy homemade lunches mainly to fitness enthusiasts. Office workers nearby still buy routine takeout because they assume the service is too specialized, too expensive, or too inconvenient for ordinary workdays. What is the strongest next step?",
        [
          "Study those nonbuyers and redesign around the common barriers that make the service feel out of reach",
          "Create even more specialized menu options for current enthusiasts",
          "Assume office workers do not care enough about lunch quality to matter",
          "Increase social posting and keep the offer essentially unchanged"
        ],
        0,
        "Growth is more likely when the offer is rebuilt around why a larger group has been staying away."
      ),
    ],
  }),
  chapter({
    chapterId: "ch06-sequence-right",
    number: 6,
    title: "Get the Strategic Sequence Right",
    summary: {
      p1: t(
        "The chapter argues that a blue ocean idea becomes commercially sound only when it passes a clear strategic sequence. The order is buyer utility, strategic price, target cost, and adoption.",
        "The sequence matters because a team can fall in love with novelty and only later discover that the offer does not deliver real utility, cannot attract the mass of buyers, or faces resistance that was never planned for.",
        "By forcing each test in order, the book turns value innovation into a viability discipline rather than a hopeful story."
      ),
      p2: t(
        "This matters because many attractive ideas fail for predictable reasons. They solve an internal ambition instead of a buyer problem, price for margin instead of market reach, or leave cost and adoption issues until it is too late.",
        "Strategic sequence keeps the model coherent. It links what buyers want, what the market will pay, what the organization must cost, and what stakeholders must accept.",
        "The deeper lesson is that creativity is only powerful when the whole system supports it. A weak link in utility, price, cost, or adoption can pull the whole strategy back into red water."
      ),
    },
    simpleIndexes: [0, 1, 2, 3, 5, 8, 9],
    standardBullets: [
      bullet(
        "Utility comes first. A blue ocean offer has to solve a meaningful buyer problem before anything else.",
        "If the utility is weak, the rest of the model is only helping a weak idea move faster."
      ),
      bullet(
        "Exceptional utility removes major blocks in the buyer experience.",
        "The chapter pushes teams to look for the pain points that make purchase, use, or disposal harder than it should be."
      ),
      bullet(
        "Strategic price aims for mass adoption. Price should not be chosen only for margin or prestige.",
        "A blue ocean move needs a price that attracts a broad set of buyers and discourages easy imitation."
      ),
      bullet(
        "Price comes before cost. Teams should decide what the market can embrace before they decide what the model must cost.",
        "That sequence prevents the firm from building a beautiful offer with no path to mass adoption."
      ),
      bullet(
        "Target costing forces redesign. Once the price is clear, the business must shape the model to fit it.",
        "This is where leaders remove cost drivers that do not support the new value curve."
      ),
      bullet(
        "Adoption hurdles deserve early attention. Employees, partners, and the public can all slow a move if their concerns are ignored.",
        "The chapter treats resistance as something to solve before launch, not after trouble starts."
      ),
      bullet(
        "Sequence protects against internal bias. Teams are less likely to fall in love with features, technology, or brand theater when each step must pass a real test.",
        "A disciplined order makes strategic thinking more honest."
      ),
      bullet(
        "A strong product alone is not enough. Buyers may still resist if price, switching burden, or trust issues are unresolved.",
        "Commercial viability depends on the whole path to adoption, not only the core offer."
      ),
      bullet(
        "Practical checklist. Ask utility, price, cost, and adoption in that order every time.",
        "The simple sequence saves teams from expensive rework later."
      ),
      bullet(
        "Viability comes from alignment across the sequence. Each answer needs to strengthen the next one.",
        "That is how blue ocean strategy becomes commercially robust."
      ),
    ],
    deeperBullets: [
      bullet(
        "The buyer utility map sharpens diagnosis. It helps teams locate where the biggest blocks sit across the buyer experience.",
        "Utility becomes more actionable when the pain points are named precisely."
      ),
      bullet(
        "Strategic price is about reach as well as revenue. The right price widens access and makes the move harder for rivals to neutralize quickly.",
        "Mass potential matters because a blue ocean needs scale, not only excitement."
      ),
      bullet(
        "Cost innovation often comes from subtraction. Target costing forces leaders to eliminate or reduce factors that no longer belong in the new curve.",
        "The model gets stronger when cost design follows strategic choice."
      ),
      bullet(
        "Adoption barriers can sit outside the buyer. Regulators, partners, channel players, and internal teams can all block the move if their concerns are not anticipated.",
        "A blue ocean strategy has to survive the real system it enters."
      ),
      bullet(
        "Skipping the sequence creates expensive illusion. Teams can mistake praise, novelty, or pilot excitement for a model that is actually ready to scale.",
        "The order matters because it keeps the strategy grounded in commercial reality."
      ),
    ],
    takeaways: [
      "Use the utility price cost adoption sequence",
      "Utility comes before price",
      "Price comes before cost",
      "Target costing is strategic",
      "Adoption barriers are real",
      "Viability depends on the whole system",
    ],
    practice: [
      "Name the biggest buyer utility block in one idea you are considering",
      "Write a price that would attract broad adoption and explain why",
      "List what the model must remove or redesign to hit that cost",
      "Identify the adoption fears of buyers, employees, or partners before launch",
    ],
    examples: [
      example(
        "ch06-ex01",
        "A study app that sounds exciting but skips the sequence",
        ["school"],
        "A student team wants to build an AI study app with many advanced tools. Users in early interviews say parts of it sound impressive, but nobody has checked whether the main utility is strong enough, what students would really pay, or whether campus tutors would support it.",
        [
          "Stop debating extra features and run the idea through the sequence of utility, price, cost, and adoption.",
          "Use the answers to decide whether the concept is ready, needs redesign, or should be dropped."
        ],
        "This matters because the right sequence saves teams from building polished solutions that never become viable."
      ),
      example(
        "ch06-ex02",
        "A conference plan with no adoption logic",
        ["school"],
        "A student association wants to launch a paid mini conference and keeps focusing on speaker prestige. Nobody has checked whether attendees see enough practical utility, whether the price fits student reality, or whether partner groups will help promote the event.",
        [
          "Test the buyer utility and a realistic strategic price before committing to the full format.",
          "Then redesign the event costs and partner concerns around the model that can actually attract attendance."
        ],
        "The chapter matters because even exciting ideas fail when they are not sequenced through real commercial and adoption tests."
      ),
      example(
        "ch06-ex03",
        "A clinic service that buyers will not switch to yet",
        ["work"],
        "A health clinic wants to launch a virtual follow up service and assumes convenience alone will drive adoption. Patients are unsure how it works, some staff worry it will add hidden workload, and pricing has not been designed for broad use.",
        [
          "Run the idea through utility, price, cost, and adoption instead of treating convenience as automatic proof of success.",
          "Use each stage to redesign the model until buyers and staff can both see why the switch makes sense."
        ],
        "This matters because a promising idea still needs a clear path through price, operational design, and stakeholder acceptance."
      ),
      example(
        "ch06-ex04",
        "A product team that priced for margin first",
        ["work"],
        "A software company builds a simple tool for small teams but prices it like a premium enterprise product because leadership wants strong margins from the start. Adoption stays weak, and the team keeps blaming sales execution.",
        [
          "Revisit the sequence and set a strategic price for mass adoption before locking the cost structure.",
          "Then redesign the model so the business can profit at that price instead of forcing the market to accept an internally convenient number."
        ],
        "The chapter shows that price should be set for strategic reach, not only for internal comfort."
      ),
      example(
        "ch06-ex05",
        "A tutoring service with a shaky model",
        ["personal"],
        "You want to start a weekend tutoring service and already have ideas for branding, worksheets, and expansion. You have not yet tested which student problem matters most, what families would comfortably pay, or how much time the service would truly require.",
        [
          "Run the idea through the full sequence before investing more effort in presentation and growth plans.",
          "Use the sequence to see whether the offer has real utility, a broad enough price point, a workable cost structure, and low enough friction for families to adopt."
        ],
        "This matters because sequence protects small ventures from mistaking enthusiasm for a real model."
      ),
      example(
        "ch06-ex06",
        "A meal prep side hustle with partner resistance",
        ["personal"],
        "You and a friend want to sell healthy weekly meals to a nearby apartment complex. The food idea seems strong, but residents worry about pickup timing, your friend worries about prep labor, and the building manager is unsure about deliveries.",
        [
          "Treat those issues as part of the strategic sequence, not as later details.",
          "Test utility, mass price, cost fit, and adoption concerns together so the idea works as a whole system."
        ],
        "The chapter matters because a good concept still fails if the surrounding adoption and cost logic are not designed early."
      ),
    ],
    questions: [
      question(
        "ch06-q01",
        "What is the correct strategic sequence in the chapter?",
        [
          "Buyer utility, strategic price, target cost, adoption",
          "Target cost, strategic price, buyer utility, adoption",
          "Adoption, buyer utility, target cost, strategic price",
          "Strategic price, buyer utility, adoption, target cost"
        ],
        0,
        "The order matters because each stage tests whether the idea can become a workable blue ocean move."
      ),
      question(
        "ch06-q02",
        "Why does the chapter start with buyer utility?",
        [
          "Because a weak utility proposition makes every later improvement less meaningful",
          "Because price is easy to change later but utility is not",
          "Because buyers care only about practical value and never about price",
          "Because cost matters only after a company has won the market"
        ],
        0,
        "Utility is the foundation. If the offer does not solve a meaningful problem, the rest of the sequence is helping a weak idea."
      ),
      question(
        "ch06-q03",
        "Why does strategic price come before target cost?",
        [
          "Because the team should first decide what price can attract broad adoption and then design the model to fit it",
          "Because cost is impossible to estimate until the full launch is finished",
          "Because high prices always create stronger blue oceans",
          "Because cost matters only to the finance team"
        ],
        0,
        "The sequence prevents the firm from building a model around internal cost comfort rather than market reality."
      ),
      question(
        "ch06-q04",
        "What is the role of adoption in the sequence?",
        [
          "To address the concerns of buyers and other stakeholders who could block the move",
          "To decide how much advertising should be purchased",
          "To replace utility testing with customer education",
          "To prove the product is technically innovative"
        ],
        0,
        "Adoption barriers can come from buyers, employees, partners, or others in the system and have to be anticipated early."
      ),
      question(
        "ch06-q05",
        "A student team wants to build an AI study app with many advanced tools. Users in early interviews say parts of it sound impressive, but nobody has checked whether the main utility is strong enough, what students would really pay, or whether campus tutors would support it. What is the strongest next step?",
        [
          "Run the idea through utility, price, cost, and adoption before building more features",
          "Add more advanced tools so the app feels more innovative",
          "Launch quickly and let later user feedback determine the business model",
          "Price it high to signal the app's quality and uniqueness"
        ],
        0,
        "The chapter's sequence exists to test whether the whole idea is viable before more effort is spent polishing it."
      ),
      question(
        "ch06-q06",
        "A student association wants to launch a paid mini conference and keeps focusing on speaker prestige. Nobody has checked whether attendees see enough practical utility, whether the price fits student reality, or whether partner groups will help promote the event. What is the strongest next step?",
        [
          "Test utility and strategic price first, then redesign cost and adoption around that answer",
          "Book the biggest speakers possible so demand becomes obvious",
          "Increase the ticket price to cover uncertainty in the budget",
          "Wait until the event is announced before asking partners for support"
        ],
        0,
        "Prestige does not replace sequence. The model has to work for buyers, costs, and adoption together."
      ),
      question(
        "ch06-q07",
        "A health clinic wants to launch a virtual follow up service and assumes convenience alone will drive adoption. Patients are unsure how it works, some staff worry it will add hidden workload, and pricing has not been designed for broad use. What is the strongest next step?",
        [
          "Run the service through utility, price, cost, and adoption so the whole model can be redesigned coherently",
          "Train the staff to speak more positively about the idea and keep the model unchanged",
          "Add more digital features so the service looks more advanced",
          "Assume patient hesitation will disappear once the service is launched"
        ],
        0,
        "A strong idea still needs an integrated answer to buyer value, price, operating cost, and stakeholder concerns."
      ),
      question(
        "ch06-q08",
        "A software company builds a simple tool for small teams but prices it like a premium enterprise product because leadership wants strong margins from the start. Adoption stays weak, and the team keeps blaming sales execution. What is the strongest next step?",
        [
          "Reset the model around a strategic price for broad adoption and then redesign the cost structure to fit it",
          "Push the sales team harder because the product already has enough value",
          "Add more premium features so the high price feels justified",
          "Wait until a few large customers adopt before changing anything"
        ],
        0,
        "The chapter makes price a strategic reach decision before cost is fixed around it."
      ),
      question(
        "ch06-q09",
        "You want to start a weekend tutoring service and already have ideas for branding, worksheets, and expansion. You have not yet tested which student problem matters most, what families would comfortably pay, or how much time the service would truly require. What is the strongest next step?",
        [
          "Run the concept through utility, price, cost, and adoption before investing more in presentation and scale",
          "Build the full brand first so families can see the service is serious",
          "Set a premium price because high commitment families value quality",
          "Expand the idea into more subjects before testing the basic model"
        ],
        0,
        "Sequence protects a venture from mistaking polished presentation for commercial readiness."
      ),
      question(
        "ch06-q10",
        "You and a friend want to sell healthy weekly meals to a nearby apartment complex. The food idea seems strong, but residents worry about pickup timing, your friend worries about prep labor, and the building manager is unsure about deliveries. What is the strongest next step?",
        [
          "Treat utility, price, cost, and adoption as one linked sequence and redesign the offer around the weak points",
          "Ignore the extra concerns and test only whether residents like the meals",
          "Lower price immediately and assume the rest will solve itself",
          "Launch to a few residents quietly and postpone all system questions"
        ],
        0,
        "The sequence matters because a promising concept still fails if its surrounding system does not support adoption and profitability."
      ),
    ],
  }),
  chapter({
    chapterId: "ch07-organizational-hurdles",
    number: 7,
    title: "Overcome Key Organizational Hurdles",
    summary: {
      p1: t(
        "The chapter argues that blue ocean strategy often stalls not because the idea is weak, but because the organization cannot move. Tipping point leadership overcomes this by concentrating effort on the few acts that shift perception, resources, motivation, and political support.",
        "The book identifies four hurdles: cognitive, resource, motivational, and political. Rather than launching a broad change campaign, leaders look for leverage points that make movement possible.",
        "It is a theory of concentrated change. Big strategic shifts do not require matching force everywhere if you can move the right people, the right facts, and the right constraints."
      ),
      p2: t(
        "This matters because managers often answer resistance with more meetings, more memos, and broader plans. That spreads energy thin and leaves the real blockers untouched.",
        "Tipping point leadership puts leaders in direct contact with harsh reality, channels resources toward hot spots, focuses on kingpins, and anticipates political attacks.",
        "The deeper lesson is that execution capacity is itself a strategic design problem. Change becomes more realistic when leaders treat human resistance and institutional inertia as concrete hurdles rather than as vague culture issues."
      ),
    },
    simpleIndexes: [0, 1, 2, 4, 5, 7, 9],
    standardBullets: [
      bullet(
        "Strategy dies on internal hurdles. Even a strong move can fail if the organization never truly shifts.",
        "The chapter begins by treating execution barriers as central strategic obstacles, not side issues."
      ),
      bullet(
        "Cognitive hurdle. People must see and feel the problem before they will support change.",
        "Direct exposure to harsh reality often moves belief faster than reports and presentations."
      ),
      bullet(
        "Resource hurdle. Leaders should move resources from cold spots to hot spots instead of spreading them thin.",
        "The goal is concentration where the strategy can gain the most traction."
      ),
      bullet(
        "Resource leverage can include horse trading. Not every important resource shift requires new budget.",
        "Creative reallocation can unlock movement even when money feels tight."
      ),
      bullet(
        "Motivational hurdle. Focus on kingpins whose behavior others watch closely.",
        "When visible people change, the effect can spread through the system."
      ),
      bullet(
        "Fishbowl management. Make performance and progress visible enough that people cannot hide from the change.",
        "Visibility raises accountability and reinforces the seriousness of the move."
      ),
      bullet(
        "Atomization. Break a huge strategic shift into concrete parts people can actually act on.",
        "Smaller, clear steps keep big change from feeling paralyzing."
      ),
      bullet(
        "Political hurdle. Identify angels, devils, and a wise counselor before conflict intensifies.",
        "Political resistance is easier to manage when it is named early instead of denied."
      ),
      bullet(
        "Concentrated action beats broad rhetoric. A few well chosen moves can matter more than a long generic change campaign.",
        "The chapter is always asking where leverage is strongest."
      ),
      bullet(
        "Leverage beats mass. Tipping point leadership is about moving the few factors that unlock the many.",
        "That is what makes ambitious strategic change feel possible under real constraints."
      ),
    ],
    deeperBullets: [
      bullet(
        "Frontline exposure beats abstraction. Leaders often underestimate the cognitive hurdle because reports soften the felt reality of the problem.",
        "Seeing the pain directly creates urgency that slide decks rarely achieve."
      ),
      bullet(
        "Not all resources are equal. The chapter pushes managers to stop treating every budget line as equally strategic.",
        "Concentration is more important than evenness when the goal is real movement."
      ),
      bullet(
        "Motivation spreads socially. Kingpins matter because their behavior shapes norms for everyone else.",
        "That turns motivation into a network effect, not only an individual incentive problem."
      ),
      bullet(
        "Political resistance should be expected, not resented. Strategic change threatens positions, habits, and informal power.",
        "Naming that reality early makes leaders more prepared and less naive."
      ),
      bullet(
        "Concentration requires courage. Leaders have to stop protecting pet projects and familiar routines if they want resources to support the new move.",
        "The resource hurdle is often a decision hurdle in disguise."
      ),
    ],
    takeaways: [
      "Use tipping point leadership",
      "Name the four hurdles",
      "Expose people to reality",
      "Shift resources to hot spots",
      "Focus on kingpins and politics",
      "Concentration beats mass effort",
    ],
    practice: [
      "Name the cognitive, resource, motivational, and political hurdles in one change effort",
      "Choose one hot spot where resources should be concentrated",
      "Identify the kingpins whose behavior others watch",
      "List the key angels, devils, and counselor before rollout",
    ],
    examples: [
      example(
        "ch07-ex01",
        "Advising reform that no one feels yet",
        ["school"],
        "A college wants to improve academic advising, but many faculty members think the current system is fine because they mostly see the top students who manage well. The long waits, confusion, and missed meetings affecting other students stay invisible to them.",
        [
          "Start with the cognitive hurdle by bringing faculty into direct contact with the lived advising experience.",
          "Then focus the redesign effort on the hot spots and the most influential advisers instead of launching a broad vague campaign."
        ],
        "This matters because people rarely support real change until the problem becomes concrete and unavoidable."
      ),
      example(
        "ch07-ex02",
        "A club president with no budget cushion",
        ["school"],
        "A student club wants to shift from passive meetings to more useful projects, but members say there is no budget, no time, and no energy. A few respected members quietly shape the mood for everyone else.",
        [
          "Move resources toward the activities that matter most, break the shift into small actions, and focus on the visible members who can model the new behavior.",
          "Do not waste energy trying to motivate everyone equally at the same moment."
        ],
        "The chapter shows that concentrated leverage often changes a group faster than broad appeals do."
      ),
      example(
        "ch07-ex03",
        "A hospital process change under real constraint",
        ["work"],
        "A hospital unit wants to change how discharge planning is handled, but staff say there is no extra capacity and several senior people are skeptical. The current delays hurt patients, yet the problem feels spread across too many moving parts.",
        [
          "Identify the hot spots where improvement will release the most pressure, expose leaders to the current patient experience, and focus motivation on the staff members others follow.",
          "At the same time, map the political resistance before it hardens."
        ],
        "This matters because strategic execution improves when leaders treat resource, motivation, and politics as design constraints they can work with."
      ),
      example(
        "ch07-ex04",
        "A sales reorganization with hidden devils",
        ["work"],
        "A company wants to reorganize sales teams around customer problems instead of territories. Some managers privately oppose the shift because it weakens the way they currently control information and credit.",
        [
          "Do not frame this only as a communication problem.",
          "Identify the political devils, secure the angels who benefit from the new structure, and move resources and incentives toward the few teams that can prove the model quickly."
        ],
        "The chapter matters here because political resistance is often strongest exactly where strategic change threatens old power."
      ),
      example(
        "ch07-ex05",
        "A family budget reset that feels too big",
        ["personal"],
        "Your household wants to get spending under control, but every conversation turns into blame or vague promises. The numbers are abstract, the goals feel huge, and no one knows where to start.",
        [
          "Make the problem visible in a way everyone can feel, then atomize the change into a few concrete spending shifts that matter most.",
          "Focus first on the habits and people whose behavior has the biggest influence on the rest of the household."
        ],
        "This matters because even personal change improves when the real hurdle is identified and the first moves are concentrated."
      ),
      example(
        "ch07-ex06",
        "A community garden that cannot get momentum",
        ["personal"],
        "A neighborhood garden keeps losing volunteers. Everyone says they care, but work days feel disorganized, a few dependable people are tired, and others assume someone else will handle it.",
        [
          "Stop asking the whole group for the same level of effort and focus on a few visible volunteers who can model the new system.",
          "Make progress public, break tasks into small pieces, and move tools and attention to the hot spots that make the garden look alive quickly."
        ],
        "The chapter shows that motivation grows when change feels visible, manageable, and socially reinforced."
      ),
    ],
    questions: [
      question(
        "ch07-q01",
        "What is the basic idea of tipping point leadership?",
        [
          "Concentrate effort on the few actions and people that can unlock larger organizational movement",
          "Try to persuade every stakeholder equally before making any move",
          "Wait until resources are abundant enough to support broad change",
          "Use long communication campaigns to build slow consensus"
        ],
        0,
        "Tipping point leadership is about leverage, not blanket effort."
      ),
      question(
        "ch07-q02",
        "What is the cognitive hurdle?",
        [
          "People do not yet see and feel the need for change strongly enough to act on it",
          "The organization lacks a detailed budget model",
          "Political resistance has already defeated the strategy",
          "Leaders do not know how to motivate the top performers"
        ],
        0,
        "The cognitive hurdle is about perception and belief, which is why direct exposure matters."
      ),
      question(
        "ch07-q03",
        "Why does the chapter focus on kingpins?",
        [
          "Because the behavior of visible and influential people can shift the norms of the wider group",
          "Because kingpins always control the largest budgets",
          "Because only senior leaders are capable of real change",
          "Because ordinary contributors matter only after launch"
        ],
        0,
        "Kingpins matter because motivation and attention spread through the social system."
      ),
      question(
        "ch07-q04",
        "What is the best way to think about the political hurdle?",
        [
          "As a real and predictable source of resistance that should be mapped early",
          "As a sign that the strategy itself must always be abandoned",
          "As a minor issue compared with the budget hurdle",
          "As something that will disappear if the communication is polite enough"
        ],
        0,
        "Political resistance is often built into change because power and routines are being threatened."
      ),
      question(
        "ch07-q05",
        "A college wants to improve academic advising, but many faculty members think the current system is fine because they mostly see the top students who manage well. The long waits, confusion, and missed meetings affecting other students stay invisible to them. What is the strongest next step?",
        [
          "Expose faculty directly to the lived advising experience and then focus effort on the most influential advisers and biggest hot spots",
          "Send a long memo explaining why advising is important and hope belief changes",
          "Spread small changes evenly across every part of advising at the same time",
          "Wait until the next budget cycle before acting"
        ],
        0,
        "The chapter starts by solving the cognitive hurdle and then concentrates effort where it can shift the system."
      ),
      question(
        "ch07-q06",
        "A student club wants to shift from passive meetings to more useful projects, but members say there is no budget, no time, and no energy. A few respected members quietly shape the mood for everyone else. What is the strongest next step?",
        [
          "Concentrate resources on the most important activities and focus on the visible members who can model the new behavior",
          "Ask everyone for equal commitment so the burden feels fair",
          "Delay the shift until a larger budget arrives",
          "Create more meetings so all concerns can be discussed first"
        ],
        0,
        "The strongest move uses leverage by targeting hot spots and kingpins rather than trying to change everything evenly."
      ),
      question(
        "ch07-q07",
        "A hospital unit wants to change how discharge planning is handled, but staff say there is no extra capacity and several senior people are skeptical. The current delays hurt patients, yet the problem feels spread across too many moving parts. What is the strongest next step?",
        [
          "Identify the hot spots, expose leaders to the patient reality, and focus motivation on the staff others follow",
          "Start with a full system overhaul across every unit so the change feels comprehensive",
          "Wait until skepticism disappears on its own before making a move",
          "Treat the resistance mainly as a communication failure and avoid structural shifts"
        ],
        0,
        "The chapter argues for concentrated change built around the most important hurdles and leverage points."
      ),
      question(
        "ch07-q08",
        "A company wants to reorganize sales teams around customer problems instead of territories. Some managers privately oppose the shift because it weakens the way they currently control information and credit. What is the strongest next step?",
        [
          "Map the political resistance early and back the change with allies, visible wins, and concentrated resource shifts",
          "Ignore the politics and assume good logic will eventually win",
          "Spread resources evenly across every team so no one feels threatened",
          "Drop the strategy because politics always make reorganization impossible"
        ],
        0,
        "Political resistance is predictable in strategic change and should be planned for directly."
      ),
      question(
        "ch07-q09",
        "Your household wants to get spending under control, but every conversation turns into blame or vague promises. The numbers are abstract, the goals feel huge, and no one knows where to start. What is the strongest next step?",
        [
          "Make the problem visible and break the change into a few high impact actions led by the most influential habits and people",
          "Set a very large goal and tell everyone to try harder immediately",
          "Track every tiny expense before naming any priorities",
          "Avoid concrete choices until everyone feels fully motivated"
        ],
        0,
        "Even personal change improves when the real hurdle is named and the first moves are concentrated."
      ),
      question(
        "ch07-q10",
        "A neighborhood garden keeps losing volunteers. Everyone says they care, but work days feel disorganized, a few dependable people are tired, and others assume someone else will handle it. What is the strongest next step?",
        [
          "Focus on a few visible volunteers, make progress public, and break work into small concrete pieces that create quick wins",
          "Keep asking the entire group for equal effort at every session",
          "Wait until a larger number of volunteers appears before changing the system",
          "Assume motivation is low because the group simply does not care enough"
        ],
        0,
        "The chapter's logic is to create leverage through visible, manageable, socially reinforced change."
      ),
    ],
  }),
  chapter({
    chapterId: "ch08-build-execution-into-strategy",
    number: 8,
    title: "Build Execution into Strategy",
    summary: {
      p1: t(
        "The chapter argues that execution should be built into strategy from the start through fair process. When people are engaged, decisions are explained, and expectations are clear, they are far more likely to cooperate even when the outcome is not exactly what they wanted.",
        "Fair process does not mean everyone gets a veto or a preferred answer. It means people see that the process respected their intelligence and treated them honestly.",
        "That is why the authors connect process to performance. Execution improves when strategy earns trust, not just compliance."
      ),
      p2: t(
        "This matters because resistance often comes less from the decision itself than from how the decision was made. People fight, drag, or disengage when they feel ignored, blindsided, or judged unfairly.",
        "Fair process creates voluntary cooperation. It builds trust and commitment while reducing the need for constant supervision.",
        "The deeper lesson is that strategy is social as well as analytical. A great move can still fail if the process signals disrespect, because people protect dignity before they protect plans they did not believe in."
      ),
    },
    simpleIndexes: [0, 1, 2, 3, 4, 8, 9],
    standardBullets: [
      bullet(
        "Execution starts in formulation. A strategy is easier to carry out when people were treated fairly while it was being shaped.",
        "The chapter rejects the idea that execution begins only after the strategic choice is final."
      ),
      bullet(
        "Engagement matters. People should be allowed to contribute views and facts that affect the decision.",
        "Being heard does not mean being obeyed, but it changes how people relate to the final choice."
      ),
      bullet(
        "Explanation matters. Leaders should explain why decisions were made the way they were.",
        "Clear reasoning lowers suspicion and helps people see the logic behind tough tradeoffs."
      ),
      bullet(
        "Expectation clarity matters. Everyone needs to know what standards, roles, and consequences now apply.",
        "Ambiguity after a decision invites confusion and resentment."
      ),
      bullet(
        "Fair process does not require consensus. Leaders still choose, but they choose transparently and respectfully.",
        "That balance preserves authority without sacrificing legitimacy."
      ),
      bullet(
        "People cooperate when they feel heard and respected. The process itself shapes commitment.",
        "Trust grows when people believe the rules were applied fairly."
      ),
      bullet(
        "Intellectual and emotional recognition both matter. People want their ideas taken seriously and their dignity preserved.",
        "A fair process speaks to both needs."
      ),
      bullet(
        "Fair process reduces sabotage and silent resistance. It lowers the need for leaders to constantly push or police.",
        "Voluntary cooperation is cheaper and stronger than forced compliance."
      ),
      bullet(
        "Practical move. Explain tradeoffs and roles before rollout, not after confusion has already spread.",
        "Fairness needs to be visible at the moment people start interpreting the change."
      ),
      bullet(
        "Trust is a strategic asset, not a soft extra. Better process can produce better execution and better results.",
        "That is the chapter's central claim."
      ),
    ],
    deeperBullets: [
      bullet(
        "Fairness increases learning as well as commitment. People surface better information when they believe the process will treat them seriously.",
        "That makes fair process valuable before, during, and after strategic choice."
      ),
      bullet(
        "Efficiency without fairness often backfires. A leader can move quickly in the moment and pay later through drag, cynicism, and weak execution.",
        "Process shortcuts are not always real speed."
      ),
      bullet(
        "Expectation clarity prevents rumor from becoming policy. People fill silence with stories, and those stories often harden into resistance.",
        "Clarity is protective, not merely administrative."
      ),
      bullet(
        "Fair process still matters in painful decisions. Respectful explanation and clear expectations remain essential even when some people dislike the result.",
        "The standard is fairness, not comfort."
      ),
      bullet(
        "The chapter connects directly to the later people proposition. A strategy becomes stronger when the people who must deliver it see the process as legitimate.",
        "Execution quality depends on both the move and the meaning people attach to it."
      ),
    ],
    takeaways: [
      "Execution begins in the process",
      "Use engagement, explanation, and expectation clarity",
      "Fair process is not consensus",
      "Respect shapes commitment",
      "Clarity reduces resistance",
      "Trust is strategic",
    ],
    practice: [
      "Invite relevant people to contribute facts and concerns before deciding",
      "Explain the reasons behind the final choice in plain language",
      "State what each person can expect after the decision",
      "Check whether the process felt fair to the people who must execute it",
    ],
    examples: [
      example(
        "ch08-ex01",
        "A capstone redesign that feels imposed",
        ["school"],
        "A department redesigns the capstone project requirements and sends out the final rules without student input. Students are not mainly upset about the tougher standards. They are upset that the change feels sudden, unexplained, and disconnected from how the work is actually done.",
        [
          "Rebuild the process by engaging the people affected, explaining the reasoning behind the standards, and clarifying what is now expected.",
          "Do not treat resistance as proof that the new rules are wrong before you first address how the decision was made."
        ],
        "This matters because unfair process can damage execution even when the decision itself has merit."
      ),
      example(
        "ch08-ex02",
        "A club roster decision that creates resentment",
        ["school"],
        "A student club selects a competition team behind closed doors and only announces the final list. Several members accept that not everyone can be chosen, but they stop helping because the process felt arbitrary and disrespectful.",
        [
          "Use fair process in the next round by explaining selection criteria early, hearing relevant input, and clarifying expectations for everyone after the decision.",
          "Keep leadership authority, but make the logic and standards visible."
        ],
        "The chapter matters because people often resist the way a decision was reached even when they could have accepted the result."
      ),
      example(
        "ch08-ex03",
        "A remote work policy with no fair process",
        ["work"],
        "A company changes its remote work policy with a short announcement and no explanation of the reasoning. Managers are then surprised that employees comply weakly, keep asking side questions, and interpret the policy in contradictory ways.",
        [
          "Engage the affected teams before finalizing, explain the tradeoffs behind the choice, and define the expectations clearly once the policy is set.",
          "Treat the process as part of execution, not as a separate communication task."
        ],
        "This matters because people execute more faithfully when they believe the process was serious and fair."
      ),
      example(
        "ch08-ex04",
        "A restaurant redesign that ignores the staff",
        ["work"],
        "A restaurant owner redesigns service flow and menu structure without involving the floor staff. The changes look efficient on paper, but execution becomes messy because staff members feel ignored and do not fully understand the intent.",
        [
          "Reopen the process enough to gather staff insight, explain the new tradeoffs, and set clear expectations for service behavior.",
          "Do not confuse one sided announcement with real execution readiness."
        ],
        "The chapter shows that strategy works better when the people delivering it see the process as legitimate and understandable."
      ),
      example(
        "ch08-ex05",
        "Shared chores after a move",
        ["personal"],
        "After moving into a new place with roommates, one person quietly assigns chores based on what seems most efficient. The plan looks sensible, yet tension rises because no one felt heard and the expectations were never fully spelled out.",
        [
          "Pause and rebuild the agreement through a fairer process that includes input, explanation, and clear expectations.",
          "Keep the final structure simple, but make the reasoning and responsibilities visible to everyone."
        ],
        "This matters because cooperation in personal life also depends on whether people feel respected by the process."
      ),
      example(
        "ch08-ex06",
        "A group trip budget that falls apart",
        ["personal"],
        "One friend plans the budget and rules for a group trip alone, then sends the final plan to everyone else. The numbers may be reasonable, but people push back because they feel controlled and unsure what was assumed on their behalf.",
        [
          "Use fair process before locking the plan by gathering key constraints, explaining the tradeoffs, and making expectations explicit.",
          "That keeps the decision efficient without making the group feel dismissed."
        ],
        "The chapter applies here because even a practical plan can fail when the process strips people of voice and clarity."
      ),
    ],
    questions: [
      question(
        "ch08-q01",
        "What are the three main elements of fair process in the chapter?",
        [
          "Engagement, explanation, and expectation clarity",
          "Vision, pricing, and budgeting",
          "Authority, speed, and consensus",
          "Recruitment, incentive, and control"
        ],
        0,
        "The chapter centers fair process on engagement, explanation, and clear expectations."
      ),
      question(
        "ch08-q02",
        "Why does the chapter connect fair process to execution?",
        [
          "Because people are more likely to cooperate when they believe the decision process treated them seriously and fairly",
          "Because fair process removes the need for leaders to make hard choices",
          "Because execution problems usually come only from low skill",
          "Because fairness is mainly a way to avoid accountability"
        ],
        0,
        "Process shapes trust and commitment, which directly affect how well a strategy is carried out."
      ),
      question(
        "ch08-q03",
        "What does fair process not require?",
        [
          "Consensus on every decision",
          "Clear explanation of the final choice",
          "Respectful treatment of affected people",
          "Visible expectations after the decision"
        ],
        0,
        "Fair process preserves leadership authority while making that authority feel legitimate."
      ),
      question(
        "ch08-q04",
        "Why is expectation clarity important after a decision?",
        [
          "Because ambiguity invites rumor, confusion, and resistance about what happens next",
          "Because people mostly care about rules and not reasons",
          "Because it lets leaders avoid engagement before the choice is made",
          "Because it makes explanation unnecessary"
        ],
        0,
        "Clear expectations help people understand how to act once the strategy is set."
      ),
      question(
        "ch08-q05",
        "A department redesigns the capstone project requirements and sends out the final rules without student input. Students are not mainly upset about the tougher standards. They are upset that the change feels sudden, unexplained, and disconnected from how the work is actually done. What is the strongest next step?",
        [
          "Rebuild the process by engaging students, explaining the reasoning, and clarifying the new expectations",
          "Dismiss the reaction because resistance always proves the standards are strong",
          "Keep the process closed but repeat the rules more often",
          "Lower the standards immediately without changing the process"
        ],
        0,
        "The issue is not only the decision. It is the lack of fair process around the decision."
      ),
      question(
        "ch08-q06",
        "A student club selects a competition team behind closed doors and only announces the final list. Several members accept that not everyone can be chosen, but they stop helping because the process felt arbitrary and disrespectful. What is the strongest next step?",
        [
          "Use fair process by making criteria visible, hearing relevant input, and clarifying expectations after the choice",
          "Add stricter rules to force members to support the final roster",
          "Keep the same process because leadership should not explain difficult decisions",
          "Let members vote on every future choice so leadership has no discretion"
        ],
        0,
        "Fair process is not the same as consensus. It is transparent, respectful, and clear."
      ),
      question(
        "ch08-q07",
        "A company changes its remote work policy with a short announcement and no explanation of the reasoning. Managers are then surprised that employees comply weakly, keep asking side questions, and interpret the policy in contradictory ways. What is the strongest next step?",
        [
          "Rebuild the rollout around engagement, explanation, and clear expectations",
          "Assume the employees are simply unwilling to adapt and tighten enforcement",
          "Keep the policy vague so managers can interpret it flexibly",
          "Focus only on the policy wording and ignore the missing process"
        ],
        0,
        "The chapter argues that execution quality is shaped by whether the process felt legitimate."
      ),
      question(
        "ch08-q08",
        "A restaurant owner redesigns service flow and menu structure without involving the floor staff. The changes look efficient on paper, but execution becomes messy because staff members feel ignored and do not fully understand the intent. What is the strongest next step?",
        [
          "Gather staff input, explain the tradeoffs, and clarify what the new design expects from them",
          "Add more rules immediately so the staff have less room to resist",
          "Return to the old model because any resistance means the strategy is wrong",
          "Keep the process closed but ask managers to sell the decision harder"
        ],
        0,
        "A strategy can be analytically sound and still execute badly when the process strips people of voice and clarity."
      ),
      question(
        "ch08-q09",
        "After moving into a new place with roommates, one person quietly assigns chores based on what seems most efficient. The plan looks sensible, yet tension rises because no one felt heard and the expectations were never fully spelled out. What is the strongest next step?",
        [
          "Rebuild the agreement through a fairer process with input, explanation, and clear expectations",
          "Keep the same plan because efficiency matters more than fairness",
          "Rotate chores randomly so no explanation is needed",
          "Avoid naming responsibilities clearly to keep the atmosphere light"
        ],
        0,
        "The strongest answer treats process as part of cooperation, not as an optional courtesy."
      ),
      question(
        "ch08-q10",
        "One friend plans the budget and rules for a group trip alone, then sends the final plan to everyone else. The numbers may be reasonable, but people push back because they feel controlled and unsure what was assumed on their behalf. What is the strongest next step?",
        [
          "Gather key constraints, explain the tradeoffs, and make expectations explicit before finalizing the plan",
          "Keep the process centralized because shared planning always slows groups down too much",
          "Ignore the complaints if the budget math is technically correct",
          "Give everyone full veto power over every line item"
        ],
        0,
        "Fair process keeps leadership efficient while still preserving legitimacy and cooperation."
      ),
    ],
  }),
  chapter({
    chapterId: "ch09-alignment-and-renewal",
    number: 9,
    title: "Align Value, Profit, and People Propositions",
    summary: {
      p1: t(
        "The chapter argues that a blue ocean strategy lasts only when three propositions fit together: value for buyers, profit for the company, and people support from employees and partners. If one of these propositions breaks, the strategy becomes unstable.",
        "A strong blue ocean move gives buyers a compelling reason to choose, gives the business a sound way to earn, and gives the people who must deliver it a reason to support it.",
        "This chapter extends the book from idea creation to system design. Blue oceans are not just offers. They are aligned operating systems."
      ),
      p2: t(
        "This matters because teams often fix one side and ignore the others. They may build a great customer promise that loses money, a profitable model that exhausts the people who run it, or a motivating internal story that buyers do not value.",
        "Alignment forces tradeoffs into the open. It helps leaders see whether incentives, costs, channel choices, and ways of working reinforce the strategy or quietly undermine it.",
        "The deeper lesson is that strategic coherence is hard to fake. When value, profit, and people propositions reinforce one another, execution gets stronger and renewal becomes easier. When they clash, red ocean pressure returns through the back door."
      ),
    },
    simpleIndexes: [0, 1, 2, 3, 4, 7, 9],
    standardBullets: [
      bullet(
        "Three propositions, one system. Value, profit, and people propositions have to work together.",
        "A blue ocean strategy weakens when any one of these three pulls against the others."
      ),
      bullet(
        "Value proposition. This is the reason buyers should care enough to choose the offer.",
        "If buyer value is weak, the rest of the system cannot rescue the strategy for long."
      ),
      bullet(
        "Profit proposition. This explains how the business earns sustainably from the move.",
        "A strong customer promise without a sound profit model turns strategy into strain."
      ),
      bullet(
        "People proposition. Employees and partners need reasons to support and deliver the move.",
        "If the people carrying the strategy lose, they will slow it, distort it, or leave it."
      ),
      bullet(
        "Alignment matters more than brilliance in one corner. A strategy can shine in one dimension and still fail as a whole.",
        "Blue oceans need coherence, not isolated excellence."
      ),
      bullet(
        "Misalignment shows up as friction, delay, and hidden cost.",
        "Operational drag is often a sign that one proposition is asking the others to carry too much."
      ),
      bullet(
        "Partner incentives are part of the strategy. Channels, suppliers, and frontline allies shape whether the move can really scale.",
        "The people proposition includes the broader ecosystem, not only internal employees."
      ),
      bullet(
        "Practical test. Ask where the three propositions currently pull against each other.",
        "That question often reveals the weakest link faster than another growth meeting does."
      ),
      bullet(
        "Strong alignment makes scale easier. When each proposition reinforces the others, execution gets simpler and stronger.",
        "The system works with itself instead of against itself."
      ),
      bullet(
        "Sustainable blue oceans are designed as whole systems. Alignment is what keeps a move from collapsing under its own contradictions.",
        "That is the chapter's central lesson."
      ),
    ],
    deeperBullets: [
      bullet(
        "The people proposition is about capability and dignity, not only pay. People support a strategy more fully when the work feels fair, workable, and worth doing.",
        "That connects this chapter back to fair process as a strategic input."
      ),
      bullet(
        "Lowering price without redesigning cost or incentives creates hidden damage. One proposition cannot absorb all the pressure forever.",
        "Misalignment often looks fine briefly and then fails through strain."
      ),
      bullet(
        "Operational shortcuts can quietly break the value promise. Cost moves are strategic only when they preserve what buyers actually came for.",
        "A profit proposition should strengthen the value proposition, not hollow it out."
      ),
      bullet(
        "Internal excitement without profit logic is fragile. Teams may love the move, yet the strategy still fails if the economics never work.",
        "Alignment requires discipline across all three propositions, not strong feeling in one."
      ),
      bullet(
        "Renewal later on also depends on alignment. A company renews more effectively when it understands how the three propositions reinforce one another in the current system.",
        "Whole system thinking is what makes blue ocean strategy durable."
      ),
    ],
    takeaways: [
      "Think in three propositions",
      "Buyer value is only one part",
      "Profit logic must be real",
      "People support is strategic",
      "Misalignment creates friction",
      "Blue oceans need system design",
    ],
    practice: [
      "Write the current value, profit, and people propositions for one offer",
      "Mark where the three propositions reinforce each other",
      "Mark where one proposition creates strain for another",
      "Fix the weakest link before adding more growth goals",
    ],
    examples: [
      example(
        "ch09-ex01",
        "A tutoring service that helps students but burns tutors",
        ["school"],
        "A campus tutoring program becomes popular because students love the convenience and clarity of the sessions. The program still loses momentum because tutors feel overloaded, scheduling is chaotic, and the budget model cannot support the service level students now expect.",
        [
          "Map the value, profit, and people propositions together instead of trying to patch each issue separately.",
          "Redesign the model so student value, program economics, and tutor experience reinforce one another rather than compete for survival."
        ],
        "This matters because a strong buyer value proposition cannot hold a strategy together if the economics and people experience collapse underneath it."
      ),
      example(
        "ch09-ex02",
        "A thrift event with unhappy partner groups",
        ["school"],
        "A student thrift swap draws large crowds and seems like a success, but the clubs helping run it feel used because the workload and recognition are uneven. Buyers enjoy the event, yet the people delivering it do not want to return.",
        [
          "Treat the partner experience as part of the strategy, not as volunteer background noise.",
          "Adjust the event so buyer value, resource flow, and partner incentives align instead of relying on goodwill to absorb the mismatch."
        ],
        "The chapter shows that people propositions matter even in small organizations. If the delivery system resists the strategy, success will not last."
      ),
      example(
        "ch09-ex03",
        "A meal kit people love but the business cannot carry",
        ["work"],
        "A meal kit service gets strong customer praise for flexibility and freshness, but margins are thin and drivers keep leaving because routes change constantly. The company keeps treating each issue as separate.",
        [
          "Look at the value, profit, and people propositions as one design problem.",
          "Change the offer, operations, and partner incentives together until the model works across all three dimensions."
        ],
        "This matters because a strategy that wins buyers while exhausting the economics and the people system is not truly aligned."
      ),
      example(
        "ch09-ex04",
        "A training platform with the wrong internal incentives",
        ["work"],
        "A business training platform has a promising revenue model and useful content, but account managers are rewarded for short term volume while trainers are judged on deep engagement. Buyers receive mixed signals and the strategy feels unstable.",
        [
          "Map where the three propositions are misaligned and fix the incentive conflicts first.",
          "Make sure the value promised to buyers is supported by the way revenue is earned and the way people are rewarded."
        ],
        "The chapter matters because internal incentive design can quietly break a strong market promise."
      ),
      example(
        "ch09-ex05",
        "A family bakery subscription under strain",
        ["personal"],
        "Your family bakery launches a pastry subscription that customers love, but weekend production strains the family, delivery favors are wearing thin, and the pricing leaves little room to improve the experience.",
        [
          "Step back and check whether the buyer promise, profit logic, and people reality actually fit together.",
          "Redesign the offer or the operating model until the people delivering the service can win along with the buyers and the business."
        ],
        "This matters because even a loved offer becomes fragile when the underlying system is pulling itself apart."
      ),
      example(
        "ch09-ex06",
        "A child care circle that is cheap but unsustainable",
        ["personal"],
        "A neighborhood child care circle keeps costs low for parents, but hosting duties are uneven and the families carrying the most work are becoming resentful. The group likes the value, yet the people proposition is cracking.",
        [
          "Treat the hosting burden and the participation rules as strategic design issues, not side complaints.",
          "Realign the system so the value for families does not depend on a few people quietly absorbing all the strain."
        ],
        "The chapter applies here because sustainable value requires a people proposition strong enough to support the model over time."
      ),
    ],
    questions: [
      question(
        "ch09-q01",
        "What three propositions must align in this chapter?",
        [
          "Value, profit, and people propositions",
          "Brand, product, and finance propositions",
          "Price, promotion, and place propositions",
          "Customer, competitor, and investor propositions"
        ],
        0,
        "The chapter argues that sustainable blue oceans require alignment across value, profit, and people."
      ),
      question(
        "ch09-q02",
        "What is the people proposition about?",
        [
          "Why employees and partners will support and deliver the strategy in practice",
          "Why buyers will pay a premium price",
          "Why investors will prefer one market over another",
          "Why competitors will struggle to copy the brand"
        ],
        0,
        "The people proposition concerns the human system that has to carry the strategy."
      ),
      question(
        "ch09-q03",
        "What is the danger of solving only one proposition well?",
        [
          "The strategy can still fail because the system remains internally inconsistent",
          "The market will automatically become too large to serve",
          "Leaders will lose sight of competitors entirely",
          "It becomes impossible to renew the strategy later"
        ],
        0,
        "A brilliant value proposition or profit model alone cannot compensate for system misalignment."
      ),
      question(
        "ch09-q04",
        "Which sign most strongly suggests proposition misalignment?",
        [
          "Persistent friction, hidden cost, and weak follow through across the delivery system",
          "A clear and simple strategic message",
          "Stable partner support over time",
          "High buyer satisfaction matched by healthy economics"
        ],
        0,
        "Misalignment often shows up as friction because one part of the system is asking another part to carry too much."
      ),
      question(
        "ch09-q05",
        "A campus tutoring program becomes popular because students love the convenience and clarity of the sessions. The program still loses momentum because tutors feel overloaded, scheduling is chaotic, and the budget model cannot support the service level students now expect. What is the strongest next step?",
        [
          "Redesign the value, profit, and people propositions together instead of patching each issue separately",
          "Protect student value at any cost and ask tutors to adapt over time",
          "Cut session quality sharply so the budget problem disappears",
          "Ignore tutor strain because the student response proves the strategy works"
        ],
        0,
        "The problem is system misalignment, so the fix has to reconnect buyer value, economics, and the people delivering the service."
      ),
      question(
        "ch09-q06",
        "A student thrift swap draws large crowds and seems like a success, but the clubs helping run it feel used because the workload and recognition are uneven. Buyers enjoy the event, yet the people delivering it do not want to return. What is the strongest next step?",
        [
          "Treat partner incentives and workload as part of the strategy and realign them with buyer value",
          "Keep the event identical because strong turnout proves the model is fine",
          "Add more marketing so the event feels even bigger next time",
          "Ask a few loyal clubs to carry the burden quietly"
        ],
        0,
        "A strategy is unstable if the people proposition is weak even when buyers are enthusiastic."
      ),
      question(
        "ch09-q07",
        "A meal kit service gets strong customer praise for flexibility and freshness, but margins are thin and drivers keep leaving because routes change constantly. What is the strongest next step?",
        [
          "Redesign the offer, operations, and partner incentives as one aligned system",
          "Raise marketing spend because the buyer response is already strong",
          "Tell drivers the customer promise matters more than route stability",
          "Protect the current buyer promise and hope scale will solve the rest"
        ],
        0,
        "The chapter pushes leaders to treat buyer value, economics, and delivery support as one design problem."
      ),
      question(
        "ch09-q08",
        "A business training platform has a promising revenue model and useful content, but account managers are rewarded for short term volume while trainers are judged on deep engagement. Buyers receive mixed signals and the strategy feels unstable. What is the strongest next step?",
        [
          "Fix the incentive conflict so the people proposition supports the value and profit logic",
          "Keep the incentives and simply explain the strategy more often",
          "Increase short term sales targets so revenue growth offsets the confusion",
          "Reduce trainer involvement because it complicates the model"
        ],
        0,
        "Internal incentives can quietly break a strategy when they pull against the value being promised and sold."
      ),
      question(
        "ch09-q09",
        "Your family bakery launches a pastry subscription that customers love, but weekend production strains the family, delivery favors are wearing thin, and the pricing leaves little room to improve the experience. What is the strongest next step?",
        [
          "Check whether the buyer promise, profit logic, and people reality fit together and redesign where they do not",
          "Keep the offer unchanged because customer enthusiasm should come first",
          "Lower quality slightly and hope buyers do not notice",
          "Work harder in the short term and postpone any strategic change"
        ],
        0,
        "The strategy needs alignment across all three propositions if it is going to last."
      ),
      question(
        "ch09-q10",
        "A neighborhood child care circle keeps costs low for parents, but hosting duties are uneven and the families carrying the most work are becoming resentful. The group likes the value, yet the people proposition is cracking. What is the strongest next step?",
        [
          "Realign the participation rules so the value does not depend on a few people absorbing all the strain",
          "Keep the costs low and assume resentment will fade if the service remains useful",
          "Add more families without changing the hosting model",
          "Ignore the complaints because the basic value proposition is strong"
        ],
        0,
        "A strategy becomes unstable when the people proposition is weak even if buyers like the outcome."
      ),
    ],
  }),
  chapter({
    chapterId: "ch10-renew-blue-oceans",
    number: 10,
    title: "Renew Blue Oceans",
    summary: {
      p1: t(
        "The chapter argues that blue oceans must be renewed before imitation and internal drift turn them red. A successful move creates growth, but success also attracts copycats and routines that slowly weaken divergence.",
        "The strategy canvas becomes a monitoring tool here. Leaders can watch whether their curve is still distinctive and whether the organization is slipping back into competitive convergence.",
        "Renewal is not a call for restless novelty. It is a disciplined timing problem that balances harvesting the current blue ocean with building the next one."
      ),
      p2: t(
        "This matters because complacency and panic are both costly. Renew too late and you lose the edge that made growth possible. Renew too early and you abandon a strong position before it has been fully used.",
        "The authors want leaders to manage both exploitation and innovation. Strong organizations know when to defend the current curve, when to reduce overinvestment, and when to design the next leap.",
        "The deeper lesson is that renewal depends on honest self observation. The same habits that once created a blue ocean can later harden into doctrine unless leaders keep testing the curve against buyer reality."
      ),
    },
    simpleIndexes: [0, 1, 2, 4, 5, 8, 9],
    standardBullets: [
      bullet(
        "Blue oceans attract imitation. Strong moves invite rivals and gradually lose some of their uniqueness.",
        "Success changes the market, and that change eventually makes the original space more crowded."
      ),
      bullet(
        "Success can breed internal complacency. The organization may start defending yesterday's winner instead of questioning it.",
        "Internal drift can be as dangerous as external competition."
      ),
      bullet(
        "The strategy canvas helps monitor drift. A curve that starts looking like the market again is a warning sign.",
        "The same tool used for creation becomes useful for renewal."
      ),
      bullet(
        "Watch for convergence in factors and messaging. Sameness often arrives gradually rather than dramatically.",
        "Small additions and defensive moves can slowly pull the curve back into red water."
      ),
      bullet(
        "Renew while current success still funds the next move. Waiting until decline is obvious makes renewal harder and more desperate.",
        "Healthy positions give leaders more options."
      ),
      bullet(
        "Do not renew for vanity or novelty alone. A strong current blue ocean should still be harvested while it has room.",
        "Renewal needs evidence, not restlessness."
      ),
      bullet(
        "Harvest and innovate at the same time. Leaders need to manage today's blue ocean and tomorrow's possibility together.",
        "This is a portfolio and timing challenge, not a single event."
      ),
      bullet(
        "Practical trigger. Review where buyers now see sameness, clutter, or diminishing value.",
        "Those signals often show where the next leap should begin."
      ),
      bullet(
        "Renewal often starts by removing yesterday's successful excess. What once differentiated the offer can later become noise or cost.",
        "Blue oceans stay healthy when leaders keep questioning what no longer belongs."
      ),
      bullet(
        "The goal is repeated value innovation, not one lucky breakthrough. Renewal is part of strategic discipline.",
        "That is how blue ocean strategy becomes a long term capability."
      ),
    ],
    deeperBullets: [
      bullet(
        "Late renewal shrinks options. When the market is already crowded and margins are already under pressure, the next move becomes harder to fund and harder to believe in.",
        "Timing matters because strategic freedom is greater before obvious decline."
      ),
      bullet(
        "Early renewal can also be costly. Leaders can confuse boredom with evidence and abandon a strong position before it has been fully used.",
        "The chapter asks for judgment, not reflexive change."
      ),
      bullet(
        "Old profit pools can resist the next move. Internal winners from the current model may become obstacles to renewal.",
        "Renewal is strategic, but it is also political and organizational."
      ),
      bullet(
        "Portfolio thinking matters. Strong firms often need one eye on today's blue ocean and one eye on the next one at the same time.",
        "Renewal becomes easier when it is built into the management rhythm rather than treated as a last minute rescue."
      ),
      bullet(
        "Renewal requires honesty about nostalgia. Success stories can become myths that block the very questioning that created the blue ocean in the first place.",
        "The best renewal cultures honor past wins without becoming trapped by them."
      ),
    ],
    takeaways: [
      "Blue oceans eventually crowd",
      "Use the canvas to monitor drift",
      "Renew before decline is obvious",
      "Do not change for vanity alone",
      "Harvest and innovate together",
      "Repeated value innovation matters",
    ],
    practice: [
      "Review your current value curve against newer alternatives",
      "List the factors that now look crowded or overbuilt",
      "Name one sign that would tell you renewal should begin",
      "Protect the current winner while funding one serious next move",
    ],
    examples: [
      example(
        "ch10-ex01",
        "A festival that every club now copies",
        ["school"],
        "A student group built a campus event that once felt fresh and drew huge interest. Two years later, other clubs copied the format, added their own extras, and the original event is starting to feel cluttered and less distinctive.",
        [
          "Use the current curve to see where the event has drifted into sameness and where buyer value is fading.",
          "Renew the experience before the decline becomes obvious, but do not throw away the parts that still create real demand."
        ],
        "This matters because strong ideas eventually crowd, and renewal is easier while the original move still has energy and resources."
      ),
      example(
        "ch10-ex02",
        "A study newsletter that outgrew itself",
        ["school"],
        "A study newsletter became popular because it offered short clear exam guidance. Over time it added interviews, long articles, event listings, and resource links. Readers now skim past much of it and newer copies are appearing across campus.",
        [
          "Review the curve and ask which additions now create clutter instead of differentiation.",
          "Renew the offer by protecting what still matters and removing the features that made the original edge less clear."
        ],
        "The chapter shows that yesterday's winning factors can become today's excess if they are not reexamined."
      ),
      example(
        "ch10-ex03",
        "A cafe concept losing its blue water",
        ["work"],
        "A cafe once stood out by making specialty coffee feel simple, fast, and friendly. Rivals copied the tone and menu style, while the cafe itself added merchandise, events, and elaborate seasonal items that slowed service.",
        [
          "Use the strategy canvas to see both imitation outside and drift inside.",
          "Renew the concept around what still creates distinct value instead of defending every successful addition from the past."
        ],
        "This matters because renewal often starts by seeing where success has turned into clutter and where imitation has narrowed the gap."
      ),
      example(
        "ch10-ex04",
        "A software product turning back into sameness",
        ["work"],
        "A software product gained early traction by being simpler than enterprise tools. After several years, the team kept adding features to answer every competitor move. New customers now describe the product as useful but not clearly different.",
        [
          "Treat the loss of divergence as a renewal signal rather than as a marketing problem alone.",
          "Review which factors should be removed, rebuilt, or newly created so the product earns a distinctive curve again."
        ],
        "The chapter matters because internal feature creep can turn a blue ocean move back into red ocean competition."
      ),
      example(
        "ch10-ex05",
        "A run club that lost its original charm",
        ["personal"],
        "A neighborhood run club began as a simple social Saturday loop and grew quickly. Now it has multiple tracks, complex chats, branded shirts, and pressure around attendance. New people say it feels harder to join than it used to.",
        [
          "Review what created the original demand and which additions now make the group feel ordinary or cumbersome.",
          "Renew the club by protecting the core value and removing the extras that weakened accessibility."
        ],
        "This matters because renewal is often about recovering distinct value before growth habits harden into clutter."
      ),
      example(
        "ch10-ex06",
        "A side business everyone now copies",
        ["personal"],
        "Your small online service took off because it solved a common problem in a clear low friction way. A year later similar offers are everywhere, and you have kept adding little bonuses instead of rethinking the next move.",
        [
          "Use your current success as the funding window for renewal rather than waiting until demand obviously weakens.",
          "Study where the service now looks interchangeable and where a fresh leap in value could open the next space."
        ],
        "The chapter applies here because blue oceans are temporary unless leaders keep renewing the curve ahead of crowding."
      ),
    ],
    questions: [
      question(
        "ch10-q01",
        "Why do blue oceans need renewal?",
        [
          "Because imitation and internal drift can gradually turn a once distinctive move back into crowded competition",
          "Because buyers always abandon successful products quickly",
          "Because renewal is needed any time a company becomes profitable",
          "Because blue ocean strategy only works in short bursts"
        ],
        0,
        "Blue oceans are powerful but not permanent. Success changes both the market and the organization."
      ),
      question(
        "ch10-q02",
        "How does the strategy canvas help in renewal?",
        [
          "It helps leaders see whether the current value curve is converging with the market again",
          "It predicts exactly when rivals will launch competing products",
          "It replaces the need for field research during renewal",
          "It automatically generates the next blue ocean idea"
        ],
        0,
        "The canvas remains useful because it reveals drift, clutter, and loss of divergence."
      ),
      question(
        "ch10-q03",
        "What is the danger of renewing too early?",
        [
          "A firm can abandon a strong position before it has fully harvested the value of its current blue ocean",
          "The market will interpret the move as weak branding",
          "Employees will stop caring about strategy altogether",
          "Rivals will always copy the renewal instantly"
        ],
        0,
        "The chapter warns against changing for novelty alone. Renewal should be guided by evidence."
      ),
      question(
        "ch10-q04",
        "Which sign most strongly suggests renewal may be needed?",
        [
          "Buyers increasingly see the offer as similar to alternatives or cluttered with features that no longer add clear value",
          "The company is still earning strong profits and attracting more attention",
          "A competitor launched one new feature last week",
          "The brand is becoming better known in the market"
        ],
        0,
        "Renewal signals usually appear through convergence and fading distinctiveness, not through visibility alone."
      ),
      question(
        "ch10-q05",
        "A student group built a campus event that once felt fresh and drew huge interest. Two years later, other clubs copied the format, added their own extras, and the original event is starting to feel cluttered and less distinctive. What is the strongest next step?",
        [
          "Review the current curve, identify where sameness and clutter have grown, and renew before the decline becomes obvious",
          "Add more extras than every other club so the event can look bigger than before",
          "Keep the event unchanged because it was once successful",
          "Cancel the event immediately and replace it with something completely unrelated"
        ],
        0,
        "The best move renews from evidence rather than from panic or nostalgia."
      ),
      question(
        "ch10-q06",
        "A study newsletter became popular because it offered short clear exam guidance. Over time it added interviews, long articles, event listings, and resource links. Readers now skim past much of it and newer copies are appearing across campus. What is the strongest next step?",
        [
          "Remove the additions that created clutter and renew around the value that originally made the offer distinctive",
          "Add even more sections so the newsletter feels more comprehensive",
          "Keep every successful addition because cutting features will look like retreat",
          "Wait until readership collapses before making any strategic change"
        ],
        0,
        "Renewal often begins by cutting yesterday's excess, not by piling on more of it."
      ),
      question(
        "ch10-q07",
        "A cafe once stood out by making specialty coffee feel simple, fast, and friendly. Rivals copied the tone and menu style, while the cafe itself added merchandise, events, and elaborate seasonal items that slowed service. What is the strongest next step?",
        [
          "Use the current curve to find where imitation and internal clutter have narrowed the difference and renew around the core value",
          "Add more seasonal items so the cafe can prove it is still creative",
          "Lower prices across the board and accept the market as crowded",
          "Keep the current model because high variety always creates advantage"
        ],
        0,
        "The chapter calls for renewal grounded in what still creates distinct value, not defense of every past addition."
      ),
      question(
        "ch10-q08",
        "A software product gained early traction by being simpler than enterprise tools. After several years, the team kept adding features to answer every competitor move. New customers now describe the product as useful but not clearly different. What is the strongest next step?",
        [
          "Treat the loss of divergence as a renewal signal and rebuild the curve around a clearer leap in value",
          "Keep matching competitor features because that is how strong products stay current",
          "Increase advertising and avoid changing the product itself",
          "Wait for a full revenue decline before reviewing the strategy"
        ],
        0,
        "Feature creep can turn a blue ocean move back into sameness, which is why the current curve needs to be reexamined."
      ),
      question(
        "ch10-q09",
        "A neighborhood run club began as a simple social Saturday loop and grew quickly. Now it has multiple tracks, complex chats, branded shirts, and pressure around attendance. New people say it feels harder to join than it used to. What is the strongest next step?",
        [
          "Review what created the original demand and remove the additions that now make the group feel heavy and ordinary",
          "Keep adding structure so the club can serve every type of runner",
          "Raise the attendance expectations to strengthen commitment",
          "Assume the club has simply reached its natural size"
        ],
        0,
        "Renewal can mean returning to the clearer value that made the offering distinctive in the first place."
      ),
      question(
        "ch10-q10",
        "Your small online service took off because it solved a common problem in a clear low friction way. A year later similar offers are everywhere, and you have kept adding little bonuses instead of rethinking the next move. What is the strongest next step?",
        [
          "Use the current success window to study where the service now looks interchangeable and design the next leap in value",
          "Keep adding minor bonuses so the current offer feels busier than the copies",
          "Wait until demand falls sharply before thinking about renewal",
          "Assume imitation means the original strategy was never strong"
        ],
        0,
        "The chapter urges leaders to renew while they still have the room and resources to do it well."
      ),
    ],
  }),
  chapter({
    chapterId: "ch11-humanity-and-confidence",
    number: 11,
    title: "Avoid Red Ocean Traps",
    summary: {
      p1: t(
        "The chapter argues that many companies fail at blue ocean strategy because they carry red ocean assumptions into the work. The final lesson is a warning against common traps that sound strategic but quietly return teams to competition on old terms.",
        "Kim and Mauborgne clarify that blue ocean strategy is not the same as technology innovation, differentiation alone, low cost alone, niche play, customer led incrementalism, or reckless disruption.",
        "The chapter works like a final filter. It protects the reader from adopting the language of blue oceans while keeping the logic of red oceans."
      ),
      p2: t(
        "This matters because labels are easy to copy. A team can call a move innovative while still benchmarking rivals, chasing existing demand, or building something buyers will not adopt.",
        "The traps matter because each one captures a tempting half truth. Taken alone, each half truth narrows strategy and hides the full discipline of value innovation.",
        "The deeper lesson is that good strategy requires conceptual precision. When leaders confuse blue ocean thinking with any kind of novelty, they waste effort and mistake noise for market creation."
      ),
    },
    simpleIndexes: [0, 1, 2, 4, 5, 7, 9],
    standardBullets: [
      bullet(
        "Technology is not the strategy. New tech matters only when it unlocks compelling value for buyers.",
        "A sophisticated technology can still fail to create a blue ocean if the value curve stays weak or crowded."
      ),
      bullet(
        "Differentiation alone is not enough. A unique offer can still be too costly or too narrow.",
        "Blue ocean strategy asks for value and cost logic together, not difference for its own sake."
      ),
      bullet(
        "Low cost alone is not enough. Cheap sameness keeps you inside red ocean logic.",
        "Lower price matters only when it supports a different and more compelling value proposition."
      ),
      bullet(
        "Niche play is not automatically a blue ocean. The aim is profitable new demand, not simply a smaller corner.",
        "A tiny specialized segment can still be crowded, fragile, or commercially weak."
      ),
      bullet(
        "Disruption is not required. A blue ocean move can be nondisruptive to incumbents and still create powerful growth.",
        "The important question is not whether others are harmed. It is whether new value and demand are created."
      ),
      bullet(
        "Current customers are not the whole story. Noncustomers remain essential to the logic of the book.",
        "A strategy built only around current buyers can easily slide back into red ocean competition."
      ),
      bullet(
        "Creativity without sequence fails. Utility, price, cost, and adoption still have to work together.",
        "Calling an idea creative does not solve the discipline of commercial viability."
      ),
      bullet(
        "Execution is part of the strategy. A clever concept that people will not deliver is incomplete.",
        "Blue ocean strategy never separates idea quality from the system that has to carry it."
      ),
      bullet(
        "Blue oceans are not permanent. Renewal and alignment still matter after success.",
        "Treating one winning move as eternal is another path back into red water."
      ),
      bullet(
        "Return to value innovation. The safest way out of traps is to ask whether value, cost, and demand are truly being rethought together.",
        "That question restores the real logic of the book."
      ),
    ],
    deeperBullets: [
      bullet(
        "First mover status is not the essence either. A company can create a blue ocean without being the first entrant if it rebuilds value in a stronger way.",
        "Chronology matters less than the strategic move itself."
      ),
      bullet(
        "New market space can emerge inside existing industries. You do not need a brand new category label for a move to be blue ocean.",
        "What matters is the shift in the value curve and demand, not the novelty of the category name."
      ),
      bullet(
        "Brand aspiration can hide weak utility. Teams sometimes mistake a striking story or premium image for real buyer value.",
        "The chapter warns against strategic theater that never changes the underlying proposition."
      ),
      bullet(
        "Current customer surveys can mislead when used alone. They often reinforce the logic of the existing market rather than reveal where new demand could be unlocked.",
        "That is why noncustomers remain central to blue ocean thinking."
      ),
      bullet(
        "Blue ocean strategy is systematic, not mystical. The frameworks matter because they keep leaders from treating novelty as proof of strategic quality.",
        "The final chapter is really a defense against lazy interpretation."
      ),
    ],
    takeaways: [
      "Do not confuse novelty with strategy",
      "Technology alone is not a blue ocean",
      "Differentiation and low cost must connect",
      "Noncustomers still matter",
      "Execution and renewal stay part of the logic",
      "Use value innovation as the final test",
    ],
    practice: [
      "List the red ocean trap your current idea is most tempted by",
      "Check whether the idea creates both buyer value and cost logic",
      "Ask which noncustomers the idea could realistically attract",
      "Test whether the move can be executed and renewed as a system",
    ],
    examples: [
      example(
        "ch11-ex01",
        "A student founder chasing novelty for its own sake",
        ["school"],
        "A student founder is convinced that an AI feature automatically makes her campus app a blue ocean move. She has not tested whether the feature solves a meaningful problem better, widens demand, or fits a workable model.",
        [
          "Stop treating technology as proof of strategy and return to value innovation as the real test.",
          "Ask whether the app creates better buyer value, cost logic, and new demand rather than simply sounding new."
        ],
        "This matters because one of the easiest red ocean traps is mistaking novelty, especially technical novelty, for a real strategic move."
      ),
      example(
        "ch11-ex02",
        "A club that confuses exclusivity with blue ocean strategy",
        ["school"],
        "A student organization decides that the way to stand out is to become more selective, more insider focused, and more specialized. Leaders call the move strategic, yet the group is really shrinking into a tighter version of an already familiar model.",
        [
          "Question whether the move truly creates new demand or simply narrows the current market into a prestige niche.",
          "Return to the bigger question of what value could attract people who are not currently participating at all."
        ],
        "The chapter matters because a smaller niche is not automatically a blue ocean. It may just be a smaller red ocean."
      ),
      example(
        "ch11-ex03",
        "A premium redesign that never changes the game",
        ["work"],
        "An executive announces a premium redesign and calls it blue ocean strategy. The product gets more expensive, the packaging looks better, and the marketing language becomes more elevated, but the actual buyer problems and cost structure barely change.",
        [
          "Do not confuse differentiation theater with value innovation.",
          "Test whether the redesign changes the value curve in a way that can create new demand and a stronger economic model."
        ],
        "This matters because blue ocean strategy is not just about looking different. It is about changing the value and cost logic of the offer."
      ),
      example(
        "ch11-ex04",
        "A startup obsessed with disruption language",
        ["work"],
        "A startup talks constantly about disrupting an industry, but customers are still unclear on why the offer is better, the price is shaky, and channel partners are wary. The team treats aggressive rhetoric as proof of strategic strength.",
        [
          "Ignore the disruption language and test the move against utility, price, cost, adoption, and new demand.",
          "If the fundamentals are weak, rebuild them before using bigger claims."
        ],
        "The chapter warns that disruption language can hide the absence of a real blue ocean strategy."
      ),
      example(
        "ch11-ex05",
        "A personal project that is novel but not useful",
        ["personal"],
        "You are excited about a complicated app idea because it feels original, but the more you explain it, the harder it is to say who would use it regularly or why it would beat simpler alternatives.",
        [
          "Treat that confusion as a warning rather than as proof that the idea is ahead of its time.",
          "Return to the basic tests of buyer value, cost logic, demand expansion, and execution before calling it strategic."
        ],
        "This matters because novelty without clear value is one of the most common ways people fool themselves."
      ),
      example(
        "ch11-ex06",
        "A friend lowers price and calls it a blue ocean",
        ["personal"],
        "A friend cuts the price of her service sharply and says she has found her blue ocean because more people are asking questions. The service itself is still ordinary, the workload is rising, and the new price leaves little room to earn.",
        [
          "Question the idea that low price alone creates new market space.",
          "Ask how the service could change the value curve and cost logic together instead of treating discounting as a strategy by itself."
        ],
        "The chapter shows that low cost without renewed value is still red ocean competition."
      ),
    ],
    questions: [
      question(
        "ch11-q01",
        "Which statement best fits the chapter's warning?",
        [
          "Not every novel or different move is a blue ocean move because value innovation still has to be real",
          "Any new technology idea automatically creates a blue ocean",
          "Blue ocean strategy mainly means targeting a smaller and more specialized niche",
          "A lower price is usually enough to make competition irrelevant"
        ],
        0,
        "The chapter protects readers from confusing labels and novelty with real strategic quality."
      ),
      question(
        "ch11-q02",
        "Why is differentiation alone not enough?",
        [
          "Because a distinctive offer can still be too costly, too narrow, or too weak in demand creation",
          "Because buyers do not care about uniqueness",
          "Because all blue oceans must be cheaper than every rival",
          "Because differentiation matters only in mature industries"
        ],
        0,
        "Blue ocean strategy asks for a new value and cost logic, not merely a different look."
      ),
      question(
        "ch11-q03",
        "What is wrong with treating low cost alone as a blue ocean?",
        [
          "Cheap sameness is still red ocean logic if the value curve and demand remain ordinary",
          "Low cost always reduces demand",
          "Blue ocean buyers never care about price",
          "Low cost works only for digital products"
        ],
        0,
        "Low cost matters only when it supports a stronger strategic move rather than simple price competition."
      ),
      question(
        "ch11-q04",
        "Why does the chapter keep noncustomers in view even at the end?",
        [
          "Because focusing only on current customers can quietly pull strategy back into red ocean assumptions",
          "Because noncustomers are always more profitable than current customers",
          "Because current customers never provide useful information",
          "Because blue ocean strategy ignores existing demand completely"
        ],
        0,
        "Noncustomers remain central because they reveal how demand can expand beyond the current market frame."
      ),
      question(
        "ch11-q05",
        "A student founder is convinced that an AI feature automatically makes her campus app a blue ocean move. She has not tested whether the feature solves a meaningful problem better, widens demand, or fits a workable model. What is the strongest next step?",
        [
          "Return to value innovation and test whether the feature truly creates better value, demand, and economics",
          "Add even more advanced AI functions so the strategy feels more original",
          "Assume the technology itself will create demand once students hear about it",
          "Raise price to signal the app's sophistication"
        ],
        0,
        "Technology is not the strategy. The real test is whether the move creates value innovation."
      ),
      question(
        "ch11-q06",
        "A student organization decides that the way to stand out is to become more selective, more insider focused, and more specialized. Leaders call the move strategic, yet the group is really shrinking into a tighter version of an already familiar model. What is the strongest next step?",
        [
          "Question whether this is new demand creation or simply a prestige niche inside the same old game",
          "Push the niche further because exclusivity always creates a blue ocean",
          "Assume the smaller audience will automatically be more profitable",
          "Ignore nonparticipants because they are not the intended market anyway"
        ],
        0,
        "The chapter warns that a niche is not automatically a blue ocean. It may simply be a smaller crowded space."
      ),
      question(
        "ch11-q07",
        "An executive announces a premium redesign and calls it blue ocean strategy. The product gets more expensive, the packaging looks better, and the marketing language becomes more elevated, but the actual buyer problems and cost structure barely change. What is the strongest next step?",
        [
          "Test whether the redesign actually changes the value curve and economic logic instead of assuming premium appearance is enough",
          "Keep the redesign because stronger branding alone makes competition irrelevant",
          "Raise the price further to strengthen the premium signal",
          "Assume buyer confusion is temporary whenever a strategy is sophisticated"
        ],
        0,
        "Differentiation theater is one of the traps the chapter is trying to prevent."
      ),
      question(
        "ch11-q08",
        "A startup talks constantly about disrupting an industry, but customers are still unclear on why the offer is better, the price is shaky, and channel partners are wary. What is the strongest next step?",
        [
          "Ignore the disruption language and test the move against utility, price, cost, adoption, and demand creation",
          "Increase the aggressive rhetoric so the market sees the ambition more clearly",
          "Assume partner resistance proves the startup is truly disruptive",
          "Delay all pricing work until the company has fully unsettled the market"
        ],
        0,
        "Disruption language does not replace the discipline of building a coherent blue ocean move."
      ),
      question(
        "ch11-q09",
        "You are excited about a complicated app idea because it feels original, but the more you explain it, the harder it is to say who would use it regularly or why it would beat simpler alternatives. What is the strongest next step?",
        [
          "Treat the confusion as a warning and return to the basic tests of buyer value, demand, and workable economics",
          "Protect the idea from criticism because truly original ideas are always hard to explain at first",
          "Add more features so the idea sounds even more advanced",
          "Assume the lack of clarity proves the idea is ahead of the market"
        ],
        0,
        "Novelty without clear value is one of the easiest ways to misread strategic quality."
      ),
      question(
        "ch11-q10",
        "A friend cuts the price of her service sharply and says she has found her blue ocean because more people are asking questions. The service itself is still ordinary, the workload is rising, and the new price leaves little room to earn. What is the strongest next step?",
        [
          "Question the low price trap and redesign the service so value and cost logic improve together",
          "Cut price even further to prove the strategy is truly bold",
          "Assume more buyer interest means the strategy is already working",
          "Ignore the workload strain because demand growth matters more than profit"
        ],
        0,
        "Low price alone is not a blue ocean if the offer stays ordinary and the economics deteriorate."
      ),
    ],
  }),
];

function chapter({
  chapterId,
  number,
  title,
  summary,
  standardBullets,
  deeperBullets,
  takeaways,
  practice,
  examples,
  questions,
  simpleIndexes = DEFAULT_SIMPLE_INDEXES,
}) {
  const readingTimeMinutes = readingTimeByNumber.get(number) ?? 14;
  const simpleBullets = simpleIndexes.map((index) => standardBullets[index]).filter(Boolean);
  const mediumBullets = standardBullets;
  const hardBullets = [...standardBullets, ...deeperBullets];

  return {
    chapterId,
    number,
    title,
    readingTimeMinutes,
    summaries: summary,
    simpleBullets,
    mediumBullets,
    hardBullets,
    takeaways,
    practice,
    examples,
    questions,
  };
}

function renderVariantContent(summary, bullets, level, takeaways, practice) {
  const p1 = compose(summary.p1, level);
  const p2 = compose(summary.p2, level);
  return {
    importantSummary: `${p1} ${p2}`,
    summaryBullets: bullets.map((item) => item.text),
    summaryBlocks: [
      { type: "paragraph", text: p1 },
      { type: "paragraph", text: p2 },
      ...bullets.map((item) => ({
        type: "bullet",
        text: item.text,
        detail: compose(item.detail, level),
      })),
    ],
    takeaways,
    practice,
  };
}

function buildPackage() {
  return {
    schemaVersion: existingPackage.schemaVersion,
    packageId: randomUUID(),
    createdAt: "2026-03-19T00:00:00Z",
    contentOwner: existingPackage.contentOwner,
    book: {
      ...existingPackage.book,
      title: "Blue Ocean Strategy",
      author: "W. Chan Kim, Renee Mauborgne",
      categories: ["Strategy", "Business", "Innovation"],
      tags: [
        "strategy",
        "innovation",
        "market creation",
        "competition",
        "differentiation",
        "execution",
      ],
      edition: {
        name: "Expanded Edition",
        publishedYear: 2015,
      },
      variantFamily: "EMH",
    },
    chapters: CHAPTERS.map((chapterData) => ({
      chapterId: chapterData.chapterId,
      number: chapterData.number,
      title: chapterData.title,
      readingTimeMinutes: chapterData.readingTimeMinutes,
      contentVariants: {
        easy: renderVariantContent(
          chapterData.summaries,
          chapterData.simpleBullets,
          "easy",
          chapterData.takeaways,
          chapterData.practice
        ),
        medium: renderVariantContent(
          chapterData.summaries,
          chapterData.mediumBullets,
          "medium",
          chapterData.takeaways,
          chapterData.practice
        ),
        hard: renderVariantContent(
          chapterData.summaries,
          chapterData.hardBullets,
          "hard",
          chapterData.takeaways,
          chapterData.practice
        ),
      },
      examples: chapterData.examples,
      quiz: {
        passingScorePercent: 80,
        questions: chapterData.questions,
        retryQuestions: buildRetryQuestions(chapterData),
      },
    })),
  };
}

function buildRetryQuestions(chapterData) {
  return chapterData.questions.slice(0, 6).map((item, index) => ({
    questionId: `${item.questionId}-retry`,
    prompt: item.prompt,
    choices: item.choices,
    correctAnswerIndex: item.correctAnswerIndex,
    explanation:
      index % 2 === 0
        ? item.explanation
        : `${item.explanation} The sequence of reasoning matters more than the surface wording.`,
  }));
}

function renderReport(packageJson) {
  const lines = [];
  lines.push("# 1. Book audit summary for Blue Ocean Strategy by W. Chan Kim, Renee Mauborgne");
  lines.push("");
  AUDIT_SUMMARY.forEach((paragraph) => {
    lines.push(paragraph);
    lines.push("");
  });

  lines.push("# 2. Main content problems found");
  lines.push("");
  MAIN_PROBLEMS.forEach((item, index) => {
    lines.push(`${index + 1}. ${item}`);
  });
  lines.push("");

  lines.push("# 3. Personalization strategy for Blue Ocean Strategy by W. Chan Kim, Renee Mauborgne");
  lines.push("");
  PERSONALIZATION_STRATEGY.forEach((paragraph) => {
    lines.push(paragraph);
    lines.push("");
  });

  lines.push("# 4. Any minimal schema adjustments needed");
  lines.push("");
  lines.push(SCHEMA_NOTE);
  lines.push("");

  lines.push("# 5. Chapter by chapter revised content");
  lines.push("");

  CHAPTERS.forEach((chapterData) => {
    lines.push(`## ${chapterData.number}. ${chapterData.title}`);
    lines.push("");
    lines.push("### Summary");
    lines.push("");
    lines.push("#### Simple");
    lines.push("");
    lines.push(`1. ${compose(chapterData.summaries.p1, "easy")}`);
    lines.push(`2. ${compose(chapterData.summaries.p2, "easy")}`);
    lines.push("");
    lines.push("#### Standard");
    lines.push("");
    lines.push(`1. ${compose(chapterData.summaries.p1, "medium")}`);
    lines.push(`2. ${compose(chapterData.summaries.p2, "medium")}`);
    lines.push("");
    lines.push("#### Deeper");
    lines.push("");
    lines.push(`1. ${compose(chapterData.summaries.p1, "hard")}`);
    lines.push(`2. ${compose(chapterData.summaries.p2, "hard")}`);
    lines.push("");

    lines.push("### Bullet points");
    lines.push("");
    lines.push("#### Simple");
    lines.push("");
    chapterData.simpleBullets.forEach((item, index) => {
      lines.push(`${index + 1}. ${item.text} ${compose(item.detail, "easy")}`);
    });
    lines.push("");
    lines.push("#### Standard");
    lines.push("");
    chapterData.mediumBullets.forEach((item, index) => {
      lines.push(`${index + 1}. ${item.text} ${compose(item.detail, "medium")}`);
    });
    lines.push("");
    lines.push("#### Deeper");
    lines.push("");
    chapterData.hardBullets.forEach((item, index) => {
      lines.push(`${index + 1}. ${item.text} ${compose(item.detail, "hard")}`);
    });
    lines.push("");

    lines.push("### Scenarios");
    lines.push("");
    chapterData.examples.forEach((item, index) => {
      const label = item.contexts[0]?.toUpperCase() ?? "GENERAL";
      lines.push(`${index + 1}. ${item.title} (${label})`);
      lines.push(`Scenario: ${item.scenario}`);
      lines.push(`What to do: ${item.whatToDo.join(" ")}`);
      lines.push(`Why it matters: ${item.whyItMatters}`);
      lines.push("");
    });

    lines.push("### Quiz");
    lines.push("");
    chapterData.questions.forEach((item, index) => {
      lines.push(`${index + 1}. ${item.prompt}`);
      lines.push(`A. ${item.choices[0]}`);
      lines.push(`B. ${item.choices[1]}`);
      lines.push(`C. ${item.choices[2]}`);
      lines.push(`D. ${item.choices[3]}`);
      lines.push(`Correct answer: ${String.fromCharCode(65 + item.correctAnswerIndex)}`);
      lines.push(`Explanation: ${item.explanation}`);
      lines.push("");
    });
  });

  lines.push("# 6. Final quality control summary");
  lines.push("");
  FINAL_QC_SUMMARY.forEach((item) => {
    lines.push(`1. ${item}`);
  });
  lines.push("");

  return `${lines.join("\n").trim()}\n`;
}

function validatePackage(packageJson) {
  const issues = [];

  for (const chapterData of packageJson.chapters) {
    const easyBlocks = chapterData.contentVariants.easy.summaryBlocks;
    const mediumBlocks = chapterData.contentVariants.medium.summaryBlocks;
    const hardBlocks = chapterData.contentVariants.hard.summaryBlocks;

    const countBullets = (blocks) => blocks.filter((block) => block.type === "bullet").length;
    const countParagraphs = (blocks) => blocks.filter((block) => block.type === "paragraph").length;

    if (countParagraphs(easyBlocks) !== 2) issues.push(`Chapter ${chapterData.number} easy summary needs 2 paragraphs.`);
    if (countParagraphs(mediumBlocks) !== 2) issues.push(`Chapter ${chapterData.number} medium summary needs 2 paragraphs.`);
    if (countParagraphs(hardBlocks) !== 2) issues.push(`Chapter ${chapterData.number} hard summary needs 2 paragraphs.`);

    if (countBullets(easyBlocks) !== 7) issues.push(`Chapter ${chapterData.number} easy bullet count is not 7.`);
    if (countBullets(mediumBlocks) !== 10) issues.push(`Chapter ${chapterData.number} medium bullet count is not 10.`);
    if (countBullets(hardBlocks) !== 15) issues.push(`Chapter ${chapterData.number} hard bullet count is not 15.`);

    if (chapterData.examples.length !== 6) issues.push(`Chapter ${chapterData.number} example count is not 6.`);
    const contexts = chapterData.examples.flatMap((item) => item.contexts ?? []);
    const workCount = contexts.filter((value) => value === "work").length;
    const schoolCount = contexts.filter((value) => value === "school").length;
    const personalCount = contexts.filter((value) => value === "personal").length;
    if (workCount !== 2 || schoolCount !== 2 || personalCount !== 2) {
      issues.push(`Chapter ${chapterData.number} scenario distribution is not 2 work, 2 school, 2 personal.`);
    }

    if (chapterData.quiz.questions.length !== 10) issues.push(`Chapter ${chapterData.number} quiz count is not 10.`);
    chapterData.quiz.questions.forEach((item, index) => {
      if (item.choices.length !== 4) issues.push(`Chapter ${chapterData.number} question ${index + 1} does not have 4 choices.`);
      if (item.correctAnswerIndex < 0 || item.correctAnswerIndex > 3) {
        issues.push(`Chapter ${chapterData.number} question ${index + 1} has an invalid correct answer index.`);
      }
    });
  }

  const dashIssues = [];
  walkStrings(packageJson, (path, value) => {
    if (shouldIgnoreDashCheck(path)) return;
    if (/[-–—]/.test(value)) dashIssues.push(`${path} contains a dash like character.`);
  });

  issues.push(...dashIssues);
  if (issues.length > 0) {
    throw new Error(issues.join("\n"));
  }
}

function walkStrings(value, visit, path = "root") {
  if (typeof value === "string") {
    visit(path, value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkStrings(item, visit, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => {
      walkStrings(item, visit, `${path}.${key}`);
    });
  }
}

function shouldIgnoreDashCheck(path) {
  return (
    path.endsWith(".schemaVersion") ||
    path.endsWith(".packageId") ||
    path.endsWith(".createdAt") ||
    path.endsWith(".book.bookId") ||
    path.endsWith(".chapterId") ||
    path.endsWith(".questionId") ||
    path.endsWith(".exampleId") ||
    path.endsWith(".author") ||
    path.includes(".tags[") ||
    path.includes(".categories[") ||
    path.includes(".contexts[")
  );
}

function main() {
  const packageJson = buildPackage();
  validatePackage(packageJson);
  const report = renderReport(packageJson);

  mkdirSync(dirname(packagePath), { recursive: true });
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
  writeFileSync(reportPath, report);
}

main();
