import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const packagePath = resolve(
  process.cwd(),
  "book-packages/good-strategy-bad-strategy.modern.json"
);
const reportPath = resolve(
  process.cwd(),
  "notes/good-strategy-bad-strategy-revision-report.md"
);

const SIMPLE_INDEXES = [0, 1, 2, 4, 5, 7, 9];

const AUDIT_SUMMARY = [
  "The existing Good Strategy Bad Strategy package was structurally present but editorially weak. Most chapters reused the same summary shape, the same emotional filler in bullet details, nearly the same scenarios, and quiz prompts that tested wording rather than judgment.",
  "The book had a second fidelity problem. The current titles gestured toward Rumelt's ideas, but the actual lesson flow often drifted into generic self management language about pressure, confidence, and behavior instead of strategy, diagnosis, leverage, coherence, and constraint.",
  "Depth personalization was also thin. Simple, Standard, and Deeper mostly differed by count rather than by meaning, while motivation personalization relied on generic suffixes that were not authored for Rumelt's voice or subject matter.",
  "The revision therefore replaces the book almost completely while preserving the package shape. Every chapter now has two authored summary paragraphs per depth, a real seven ten fifteen bullet ladder, six realistic scenarios, and a scenario based quiz designed around applied judgment."
];

const MAIN_PROBLEMS = [
  "Summary paragraphs were repetitive, vague, and not specific enough to explain Rumelt's core logic.",
  "Bullet details repeated the same generic psychology filler across many chapters, which made the experience feel templated and untrustworthy.",
  "Scenarios reused the same patterns and titles across the book, so transfer felt fake instead of chapter specific.",
  "Quiz prompts referenced the chapter title directly and often used answer choices that were copied slogans instead of plausible decisions.",
  "Depth modes did not change interpretive depth enough, and the current motivation layer did not feel authored for the book."
];

const PERSONALIZATION_STRATEGY = [
  "Depth is authored directly in the package. Simple gives quick clarity with seven bullets, Standard gives the strongest full default with ten bullets, and Deeper adds five real extensions on tradeoffs, hidden logic, and second order implications.",
  "Motivation style stays as a guidance layer rather than nine duplicated packages. For this book, Gentle emphasizes calm honesty, Direct emphasizes disciplined choice, and Competitive emphasizes leverage, edge, and the cost of strategic drift.",
  "The core meaning does not move across modes. What changes is compression, interpretive depth, coaching tone, and how strongly the content pushes the reader toward honest diagnosis and coherent action."
];

const SCHEMA_NOTE =
  "No package schema change was required. The revision stays within the existing JSON shape, and the reader can deliver meaningful motivation differences through a book specific guidance layer instead of nine duplicated content trees.";

const b = (text, detail) => ({ type: "bullet", text, detail });

const ex = (exampleId, title, contexts, scenario, whatToDo, whyItMatters) => ({
  exampleId,
  title,
  contexts,
  scenario,
  whatToDo,
  whyItMatters,
});

const q = (prompt, choices, correctAnswerIndex, explanation) => ({
  prompt,
  choices,
  correctAnswerIndex,
  explanation,
});

const CHAPTERS_PART_ONE = [
  {
    chapterId: "ch01-good-and-bad-strategy",
    title: "What Separates Real Strategy From Empty Slogans",
    simpleSummary: [
      "Good strategy starts by naming the real challenge and choosing a response that fits it. Rumelt argues that bad strategy sounds ambitious, but it usually avoids diagnosis, tradeoffs, and coordinated action.",
      "This matters because people often reward goals and confidence more than useful choices. Once you ask what problem is actually being solved and how the actions fit together, empty plans become much easier to spot."
    ],
    standardSummary: [
      "Good strategy identifies the critical challenge, sets a guiding approach, and concentrates action around that problem. Rumelt contrasts it with bad strategy, which confuses vision statements, wish lists, and broad aspiration for real strategic work.",
      "The deeper lesson is that strategy is an act of honesty before it is an act of ambition. Leaders gain leverage not by sounding bold, but by facing constraints, making choices, and coordinating action in a way that actually changes the situation."
    ],
    deeperSummary: [
      "Good strategy begins with a clear diagnosis of the obstacle that matters most and then builds a focused response around it. Rumelt shows that bad strategy usually avoids this discipline by hiding behind buzzwords, growth talk, or goals that never explain how the challenge will actually be overcome.",
      "That distinction matters because bad strategy is socially comfortable. It flatters people, postpones tradeoffs, and lets organizations confuse energy with effect. Real strategy feels sharper because it exposes weakness, rejects scatter, and links limited means to a point of leverage."
    ],
    takeaways: [
      "Good strategy starts with diagnosis, not ambition.",
      "Goals only become strategic when they guide choice under constraint.",
      "Coherent action matters more than a long initiative list.",
      "Fluff often hides avoidance."
    ],
    practice: [
      "write the real challenge in one sentence",
      "cut one vague phrase from a current plan",
      "name the tradeoff the plan is avoiding",
      "link one action directly to the obstacle",
      "check whether the plan changes budgets or priorities"
    ],
    standardBullets: [
      b(
        "Start with the challenge. Strategy begins when you define the obstacle that actually matters.",
        "Without a real challenge, action spreads across too many issues and never gains force."
      ),
      b(
        "Goals are not strategy. Wanting growth, impact, or leadership only states desire.",
        "Strategy explains how progress will be made when resources are limited and resistance is real."
      ),
      b(
        "Diagnosis creates leverage. A sharp explanation tells you where effort can matter most.",
        "Once the problem is framed correctly, ordinary moves can become powerful because they hit the right point."
      ),
      b(
        "A guiding approach narrows choice. Good strategy rules out a lot of attractive but distracting action.",
        "That discipline is what keeps effort from fragmenting the moment pressure rises."
      ),
      b(
        "Coherent action proves the strategy. Separate tasks become strategic only when they reinforce one another.",
        "A pile of initiatives is not a strategy unless the pieces work together against the same challenge."
      ),
      b(
        "Fluff is a warning sign. Inflated language often appears when leaders do not want to face the real problem.",
        "The grander the wording, the more carefully you should ask what will actually change."
      ),
      b(
        "Balance can become avoidance. Trying to satisfy every stakeholder equally usually destroys focus.",
        "Strategy needs uneven attention because some problems matter more than others."
      ),
      b(
        "Test whether behavior changes. A real strategy alters priorities, budgets, staffing, or daily decisions.",
        "If nothing concrete moves, the plan is still a statement of hope."
      ),
      b(
        "Constraint is part of the work. Scarce time, money, and attention are what make strategic choice necessary.",
        "Ignoring constraint leads straight back to vague promises and weak execution."
      ),
      b(
        "Good strategy feels practical. It turns uncomfortable truth into coordinated action instead of motivational theater.",
        "That is why a plain, sharp strategy usually outperforms a polished but empty one."
      )
    ],
    deeperBullets: [
      b(
        "Bad strategy often sounds safer because it hides conflict. Vague language lets people delay saying no.",
        "The social comfort is real, but the cost shows up later when effort is spread and results stay weak."
      ),
      b(
        "A strong diagnosis is selective. It chooses the challenge that explains the most important difficulty, not every difficulty.",
        "Trying to solve everything at once is usually proof that nothing important has been prioritized."
      ),
      b(
        "Leverage depends on exclusion. Once the key obstacle is known, many appealing actions should disappear.",
        "What a strategy refuses to do is often as revealing as what it chooses."
      ),
      b(
        "Bad strategy survives in strong organizations too. Talent and effort can temporarily mask weak logic.",
        "That is why good results do not automatically prove that a strategy was good."
      ),
      b(
        "Strategy is useful because reality pushes back. If there were no constraints or rivals, slogans would be enough.",
        "The need for strategy comes from friction, resistance, and the fact that resources cannot cover everything."
      )
    ],
    examples: [
      ex(
        "ch01-ex01",
        "Debate team without diagnosis",
        ["school"],
        "A debate team keeps saying it wants to win the regional tournament, but every practice covers a different weakness. The team still loses close rounds because rebuttals collapse late in each match.",
        [
          "Name the main obstacle before planning another full week of practice.",
          "If late rebuttals are the issue, shift preparation toward fast evidence retrieval and closing drills instead of trying to improve everything at once."
        ],
        "The point is not to sound more determined. It is to connect practice to the problem that is actually costing wins."
      ),
      ex(
        "ch01-ex02",
        "Club recruitment with too many ideas",
        ["school"],
        "A student club wants more members and creates flyers, giveaways, social posts, and a long event calendar. Signups stay flat because nobody has asked why students stop after the first meeting.",
        [
          "Treat retention as the challenge until the club understands the drop off point.",
          "Interview recent members, fix the first meeting experience, and pause extra promotion until that obstacle is clearer."
        ],
        "Activity can feel strategic when people are busy. Strategy starts when effort is tied to the bottleneck that matters most."
      ),
      ex(
        "ch01-ex03",
        "Retention plan built on slogans",
        ["work"],
        "A software team announces a strategy to become the most customer centric platform in its market. Churn still rises because the first week of onboarding is confusing and no team owns that experience.",
        [
          "Replace the slogan with a diagnosis of why customers leave early.",
          "Assign ownership, simplify the first week, and measure whether the actions actually reduce early churn."
        ],
        "A strong aspiration does not help if it does not direct concrete changes. The diagnosis is what makes the next actions coherent."
      ),
      ex(
        "ch01-ex04",
        "Restaurant aiming for excellence",
        ["work"],
        "A restaurant manager tells staff that the new strategy is to deliver the best service in town. Online reviews keep complaining about long waits because the kitchen and floor schedule still clash at peak hours.",
        [
          "Stop treating excellence as the strategy and diagnose the service failure precisely.",
          "Rebuild the shift pattern around the busy window and test whether wait times drop."
        ],
        "Strategy earns its name when it changes operations, not when it improves the language around a goal."
      ),
      ex(
        "ch01-ex05",
        "Fitness plan full of tools",
        ["personal"],
        "Someone buys a tracker, new shoes, and a meal app because they want to get in shape. Progress stays weak because the real issue is that late nights keep wrecking energy and consistency.",
        [
          "Name the limiting obstacle before adding another tool.",
          "If sleep is the real issue, build the plan around bedtime and morning recovery instead of buying more motivation."
        ],
        "Bad strategy in personal life often looks like effort without diagnosis. The right obstacle matters more than the number of tactics."
      ),
      ex(
        "ch01-ex06",
        "Job search with vague ambition",
        ["personal"],
        "A recent graduate says the strategy is to find a great career quickly. They keep rewriting their profile and applying everywhere, but they have not identified whether the main issue is portfolio quality, weak targeting, or lack of referrals.",
        [
          "Write the most likely obstacle in plain language before sending more applications.",
          "Build the next two weeks around one response that fits that diagnosis, such as portfolio work or focused networking."
        ],
        "A broad ambition feels serious, but it does not guide difficult decisions. A diagnosis does."
      )
    ],
    quiz: [
      q(
        "A student founder says, \"Our strategy is to become the top app on campus this year.\" What is missing?",
        [
          "A diagnosis of the obstacle and a focused response",
          "More confidence in the team message",
          "A longer list of growth goals",
          "A promise to work harder than rivals"
        ],
        0,
        "The strongest answer identifies the real challenge before adding more ambition."
      ),
      q(
        "A manager presents fifteen initiatives tied to one broad vision. What is the clearest concern?",
        [
          "The plan may be a wish list rather than a coherent strategy",
          "The team is probably not motivated enough",
          "The budget should be spread even wider",
          "A strong strategy should include every reasonable idea"
        ],
        0,
        "Strategy needs coordinated choices, not a politically balanced collection of activity."
      ),
      q(
        "Which statement sounds most like bad strategy?",
        [
          "We will improve margins by exiting low value accounts and redesigning service for the profitable segment",
          "We will diagnose why new users leave in week one and rebuild onboarding around that point",
          "We will lead the industry through excellence, innovation, and world class execution",
          "We will concentrate recruiting on the channel that produces our best hires"
        ],
        2,
        "The weak option sounds impressive but does not identify a challenge or a response."
      ),
      q(
        "Why does Rumelt treat fluff as a danger rather than a style issue?",
        [
          "Because vague language often hides the absence of diagnosis and choice",
          "Because plain writing is always more inspiring",
          "Because strategy should avoid any abstract thinking",
          "Because leaders should never speak about goals"
        ],
        0,
        "Fluff matters because it can conceal that no real strategic work has happened."
      ),
      q(
        "A team says it has a strategy, but budgets, staffing, and metrics all stay the same. What is the best conclusion?",
        [
          "The strategy is probably not real yet because behavior has not changed",
          "The strategy is working quietly behind the scenes",
          "The plan only needs better branding",
          "Good strategy should avoid operational changes at first"
        ],
        0,
        "Real strategy changes choices under constraint, not just the wording around them."
      ),
      q(
        "Which move best reflects strategic thinking under constraint?",
        [
          "Concentrating effort on the pivotal obstacle even if other requests are delayed",
          "Giving every issue equal attention to avoid conflict",
          "Expanding the number of active priorities so no group feels ignored",
          "Replacing tradeoffs with a stronger vision statement"
        ],
        0,
        "Strategy uses constraint to force sharper choice instead of avoiding it."
      ),
      q(
        "A team keeps adding tactics whenever progress stalls. What does that most likely signal?",
        [
          "The team has not diagnosed the core challenge clearly enough",
          "The team needs more slogans",
          "The team should avoid prioritizing",
          "The team already has a strong strategy"
        ],
        0,
        "Tactic accumulation often shows that the problem definition is still weak."
      ),
      q(
        "Which option is the best test for whether a plan is actually strategic?",
        [
          "Check whether the actions reinforce one another against one defined challenge",
          "Check whether the language sounds ambitious enough",
          "Check whether the plan includes all stakeholder requests",
          "Check whether every department can claim one initiative"
        ],
        0,
        "A strategy is visible in coherence, not in the amount of activity it can name."
      ),
      q(
        "A person says, \"My strategy is to become more successful this year.\" What would improve that most?",
        [
          "Defining the real obstacle and choosing a few reinforcing actions that fit it",
          "Adding more habits so no area is missed",
          "Making the statement more inspiring",
          "Avoiding any narrow focus too early"
        ],
        0,
        "The improvement comes from diagnosis and coherent action, not stronger aspiration."
      ),
      q(
        "What is the deepest distinction between good strategy and bad strategy?",
        [
          "Good strategy turns hard truth into focused action while bad strategy hides from it",
          "Good strategy sets larger goals while bad strategy sets smaller ones",
          "Good strategy inspires more people while bad strategy inspires fewer",
          "Good strategy avoids tradeoffs while bad strategy creates them"
        ],
        0,
        "Rumelt's core distinction is honesty about the problem and discipline about the response."
      )
    ]
  },
  {
    chapterId: "ch02-the-kernel",
    title: "Strong Strategy Has a Core Structure",
    simpleSummary: [
      "Strong strategy has a kernel made of diagnosis, guiding policy, and coherent action. Rumelt's point is that strategy becomes usable when those three parts fit together.",
      "This matters because many plans jump straight to tasks or slogans. The kernel forces people to explain the problem, state the logic of response, and choose actions that actually reinforce one another."
    ],
    standardSummary: [
      "Strong strategy has a kernel with three linked parts: a diagnosis of the challenge, a guiding policy for dealing with it, and coherent actions that carry that policy out. Rumelt uses this structure to show why some plans create direction while others collapse into scattered activity.",
      "The kernel matters because it prevents strategic thinking from breaking apart. Diagnosis stops wishful thinking, guiding policy stops random action, and coherent action stops execution from drifting into unrelated projects."
    ],
    deeperSummary: [
      "Strong strategy has a kernel with three linked parts: diagnosis, guiding policy, and coherent action. Rumelt treats this not as a neat framework to memorize, but as the minimum structure needed for strategy to survive contact with reality.",
      "Its value is deeper than neat organization. The kernel forces causal thinking. It asks whether you understand the obstacle, whether your chosen approach actually fits that obstacle, and whether your actions reinforce one another rather than cancel one another out."
    ],
    takeaways: [
      "The kernel keeps strategy from becoming a slogan.",
      "Diagnosis, policy, and action each answer a different question.",
      "A plan without fit across the three parts will drift.",
      "Coherence is what turns action into strategy."
    ],
    practice: [
      "write the diagnosis before drafting actions",
      "state the guiding policy in one plain sentence",
      "remove one action that does not fit the policy",
      "check whether the actions reinforce each other",
      "ask whether the policy follows from the diagnosis"
    ],
    standardBullets: [
      b(
        "Diagnosis explains the problem. It tells you what kind of challenge you are actually facing.",
        "Without diagnosis, even energetic action rests on guesswork."
      ),
      b(
        "Guiding policy sets direction. It defines the kind of response that makes sense.",
        "This is the bridge between seeing the problem and deciding how to act."
      ),
      b(
        "Coherent action carries the policy out. The actions should reinforce the same line of attack.",
        "If the actions compete with one another, the kernel is broken."
      ),
      b(
        "The order matters. Action should not arrive before diagnosis and policy are clear.",
        "Jumping straight into tasks often locks teams into motion that later turns out to be wrong."
      ),
      b(
        "The kernel sharpens communication. People can understand what the challenge is, what the approach is, and what they are expected to do.",
        "That clarity is one of the biggest practical benefits of a well formed strategy."
      ),
      b(
        "Diagnosis is not a complaint list. It identifies the key challenge that best explains the situation.",
        "Good diagnosis simplifies reality by finding the issue that matters most."
      ),
      b(
        "Guiding policy is not a slogan. It should narrow choice enough to shape real tradeoffs.",
        "If any action could fit the policy, the policy is still too vague."
      ),
      b(
        "Coherent action usually involves coordination. The pieces gain strength because they fit together.",
        "That is why a shorter aligned action set often beats a longer scattered one."
      ),
      b(
        "A missing part weakens the whole. Good actions with bad diagnosis still fail, and sharp diagnosis without action changes nothing.",
        "The kernel works because all three parts support one another."
      ),
      b(
        "The kernel is a discipline for staying honest. It keeps plans tied to explanation, choice, and execution at the same time.",
        "That structure is what gives strategy its practical strength."
      )
    ],
    deeperBullets: [
      b(
        "A diagnosis can be wrong and still feel elegant. The kernel does not guarantee truth by itself.",
        "It improves the odds by making the logic visible enough to challenge and revise."
      ),
      b(
        "Guiding policy should reduce temptation. A good policy makes many attractive but low fit actions easier to reject.",
        "That is one reason strong strategy often feels narrower than people first expect."
      ),
      b(
        "Coherent action often reveals whether the policy is real. If no one can name the reinforcing actions, the policy may only be rhetoric.",
        "Execution is therefore not separate from strategy. It is evidence about strategy quality."
      ),
      b(
        "The kernel supports adaptation. When facts change, you can ask which part needs revision instead of rewriting everything blindly.",
        "That makes strategic learning faster and less emotional."
      ),
      b(
        "Teams often overinvest in action because it feels productive. The kernel restores value to framing and choice.",
        "It reminds leaders that premature motion is not the same as progress."
      )
    ],
    examples: [
      ex(
        "ch02-ex01",
        "Term paper rescue plan",
        ["school"],
        "A student is behind on a major paper and keeps making to do lists that get longer each day. The real issue is not effort alone. The paper has no clear argument, so research time keeps turning into aimless reading.",
        [
          "Diagnose the actual challenge before adding more tasks.",
          "Set a guiding policy such as narrowing the thesis first, then choose actions that support that policy, like one outline session and one source pass."
        ],
        "The kernel keeps academic work from turning into panic. A better problem definition produces better action."
      ),
      ex(
        "ch02-ex02",
        "Campus event planning",
        ["school"],
        "A student committee wants a bigger turnout for a speaker event. Members are arguing about posters, food, and room layout, but nobody has agreed on whether the main problem is awareness, relevance, or scheduling.",
        [
          "Start with diagnosis instead of debating tactics.",
          "Once the main problem is clear, choose a guiding policy for it and then align the event tasks around that one response."
        ],
        "The kernel stops a team from fighting over actions before it knows what the actions are supposed to solve."
      ),
      ex(
        "ch02-ex03",
        "Product adoption stall",
        ["work"],
        "A product team wants more weekly active users and launches new features every sprint. Adoption is still flat because the team has not agreed on whether the real barrier is discovery, setup friction, or weak repeat value.",
        [
          "Force the conversation through diagnosis, guiding policy, and coherent action.",
          "If setup friction is the diagnosis, let onboarding simplification drive the next sprint rather than another broad feature push."
        ],
        "The kernel prevents smart teams from confusing motion with progress. It links action back to the logic that justifies it."
      ),
      ex(
        "ch02-ex04",
        "Sales turnaround without structure",
        ["work"],
        "A sales leader demands faster pipeline growth and asks every manager for new ideas. Reps receive more outreach targets, new scripts, and extra meetings, but nothing is coordinated around why deals are actually stalling.",
        [
          "Build the turnaround around one clear diagnosis, one guiding policy, and a few reinforcing actions.",
          "That might mean fixing qualification and follow up before adding more volume."
        ],
        "When the kernel is missing, the team feels busy and direction still stays weak."
      ),
      ex(
        "ch02-ex05",
        "Debt reduction plan",
        ["personal"],
        "Someone wants to get out of debt and starts cutting random expenses each week. The effort feels serious, but the real issue is that irregular income makes cash flow unstable and the cuts do not match that pattern.",
        [
          "Diagnose the financial problem precisely before choosing tactics.",
          "Then set a guiding policy such as smoothing monthly cash and pick actions that support it, like automatic buffers and invoice timing."
        ],
        "Personal plans improve when diagnosis, policy, and action fit together instead of pulling in different directions."
      ),
      ex(
        "ch02-ex06",
        "Career pivot without a kernel",
        ["personal"],
        "A professional wants to move into a new field and is taking random online courses, networking broadly, and rewriting their resume every few days. None of it adds up because they have not decided whether the main gap is credibility, portfolio evidence, or industry access.",
        [
          "Use the kernel to structure the transition.",
          "Name the core gap, choose one guiding policy for closing it, and stack actions that reinforce that choice."
        ],
        "The kernel makes a complex move feel manageable because it creates sequence and fit."
      )
    ],
    quiz: [
      q(
        "A team can list many actions but cannot explain the core problem. Which part of the kernel is missing?",
        [
          "Diagnosis",
          "Coherent action",
          "Execution energy",
          "Long term ambition"
        ],
        0,
        "The kernel starts with explaining the challenge, not with listing tasks."
      ),
      q(
        "What is the main job of guiding policy?",
        [
          "To define the kind of response that fits the diagnosis",
          "To motivate the team with broad vision language",
          "To replace diagnosis with concrete tasks",
          "To remove the need for tradeoffs"
        ],
        0,
        "Guiding policy connects explanation to choice by narrowing the right kind of response."
      ),
      q(
        "Which example shows coherent action?",
        [
          "Several actions that reinforce the same chosen approach to one challenge",
          "A long task list gathered from every department",
          "Independent initiatives that each solve a different issue",
          "A strong diagnosis with no change in work"
        ],
        0,
        "Coherent action means the pieces work together rather than merely existing together."
      ),
      q(
        "A leader says, \"Our policy is to be best in class.\" Why is that weak?",
        [
          "It does not narrow action enough to guide real choices",
          "It pays too much attention to diagnosis",
          "It already describes coherent action",
          "It removes the need for execution"
        ],
        0,
        "A guiding policy must shape tradeoffs, not just restate a goal in nicer words."
      ),
      q(
        "Why is action first often a strategic mistake?",
        [
          "Because tasks chosen before diagnosis can lock a team into the wrong response",
          "Because action should always wait until perfect information arrives",
          "Because strategy is mostly about policy language",
          "Because execution matters less than framing"
        ],
        0,
        "Premature action often hardens weak assumptions before anyone has tested them."
      ),
      q(
        "A student writes a clear diagnosis and a good policy, but nothing changes in the plan. What is missing?",
        [
          "Coherent action that carries the policy out",
          "A stronger slogan",
          "A broader diagnosis",
          "More possible options"
        ],
        0,
        "The kernel is incomplete until action reinforces the chosen approach."
      ),
      q(
        "Which statement best captures the relationship among the three parts?",
        [
          "Diagnosis explains the challenge, policy defines the response, and action makes that response real",
          "Diagnosis lists symptoms, policy motivates, and action stays flexible",
          "Policy replaces diagnosis, and action can be sorted out later",
          "Action matters most, while diagnosis and policy are optional"
        ],
        0,
        "The three parts answer different questions and only work well when they fit."
      ),
      q(
        "A company says customer churn is rising, so every team should launch one retention idea. What would improve this most?",
        [
          "Agreeing on the main reason churn is happening before assigning actions",
          "Adding more teams to the project",
          "Making each idea independent so no coordination is needed",
          "Expanding the goal to include all customer metrics"
        ],
        0,
        "Without diagnosis, many actions can move at once and still miss the cause."
      ),
      q(
        "What makes the kernel useful during change?",
        [
          "It lets teams revise the part of the logic that changed instead of reacting blindly",
          "It guarantees that the first diagnosis was correct",
          "It removes the need for leadership judgment",
          "It turns any action list into a strategy"
        ],
        0,
        "The kernel gives strategy a visible logic that can be tested and adjusted."
      ),
      q(
        "Why does Rumelt treat the kernel as a practical discipline rather than a presentation tool?",
        [
          "Because it keeps strategy tied to explanation, choice, and execution at the same time",
          "Because it makes slides easier to organize",
          "Because it eliminates conflict from planning",
          "Because it proves every action is equally valuable"
        ],
        0,
        "The kernel matters because it makes strategic logic usable under real constraints."
      )
    ]
  },
  {
    chapterId: "ch03-hallmarks-of-bad-strategy",
    title: "Learn to Spot Strategy Failure Early",
    simpleSummary: [
      "Bad strategy usually reveals itself through recognizable signals such as fluff, weak diagnosis, and goals masquerading as strategy. Rumelt's point is that failure can often be seen before results collapse if you know what to look for.",
      "This matters because weak strategy often survives by sounding serious. Learning the warning signs helps you challenge empty plans earlier, when the cost of correction is still low."
    ],
    standardSummary: [
      "Bad strategy usually reveals itself through clear warning signs: inflated language, failure to face the real challenge, confusion of goals with strategy, and weak strategic objectives. Rumelt argues that these are not minor writing flaws but evidence that the underlying logic is missing.",
      "The chapter matters because many weak plans survive on social momentum. They look respectable, protect people from hard choices, and delay accountability. Spotting the pattern early protects time, money, and credibility."
    ],
    deeperSummary: [
      "Bad strategy often announces itself long before performance makes the failure obvious. Rumelt identifies hallmarks such as fluff, avoidance of the core problem, goals presented as if they were strategy, and objectives that do not guide action under constraint.",
      "These signals matter because organizations rarely fail from ignorance alone. They fail because vague language, political compromise, and false clarity make weak logic look acceptable. Learning the warning signs is therefore a form of strategic defense."
    ],
    takeaways: [
      "Bad strategy has visible warning signs.",
      "Goals and strategy are not the same thing.",
      "Fluff and vagueness usually hide missing logic.",
      "Weak objectives fail because they do not guide action."
    ],
    practice: [
      "rewrite one goal as a diagnosis and response",
      "circle every vague phrase in a current plan",
      "ask what challenge the plan is avoiding",
      "test whether the objective changes priorities",
      "remove one initiative that has no strategic logic"
    ],
    standardBullets: [
      b(
        "Fluff is often camouflage. Inflated language can hide that no real strategic thought has taken place.",
        "The problem is not style alone. The problem is that the wording substitutes for substance."
      ),
      b(
        "Bad strategy avoids the challenge. It talks around the obstacle instead of naming it directly.",
        "Once the hard problem is avoided, every later action becomes weaker."
      ),
      b(
        "Goals are frequently mislabeled as strategy. Saying what you want is not the same as saying how you will get there.",
        "This is one of the most common and most expensive strategic errors."
      ),
      b(
        "Weak strategic objectives do not guide action. They sound desirable but do not help anyone decide what to do next.",
        "An objective should shape behavior under pressure, not just look good on a slide."
      ),
      b(
        "A long initiative list can be a warning sign. More action items do not fix missing logic.",
        "Bad strategy often responds to confusion by adding motion."
      ),
      b(
        "Compromise language can destroy focus. Plans written to offend no one usually direct no one.",
        "The softer the tradeoff, the weaker the strategic edge."
      ),
      b(
        "Bad strategy often borrows the tone of confidence. It can sound serious while remaining empty.",
        "That is why critical reading matters more than surface polish."
      ),
      b(
        "Early detection saves resources. The sooner weak logic is exposed, the cheaper it is to fix.",
        "Strategic error becomes harder to unwind once budgets and identity attach to it."
      ),
      b(
        "Strong questions reveal weak strategy. Ask what challenge is being solved, what the policy is, and what will actually change.",
        "If the answers stay fuzzy, the strategy is probably weak."
      ),
      b(
        "The warning signs are practical. They help you separate persuasive language from useful strategic thinking.",
        "That skill protects judgment in meetings, plans, and everyday decisions."
      )
    ],
    deeperBullets: [
      b(
        "Weak strategy often survives because it is politically convenient. Vague language lets multiple groups hear what they want to hear.",
        "That flexibility feels useful until execution demands a real choice."
      ),
      b(
        "Bad objectives can create false progress. Teams may hit the metric and still fail strategically because the metric never tracked the real problem.",
        "A measure is only useful when it connects to the strategic logic."
      ),
      b(
        "The more pressure there is to sound unified, the easier it is for weak strategy to spread.",
        "People often confuse disagreement with disloyalty when the real issue is poor logic."
      ),
      b(
        "Hallmarks matter most before results are final. Once performance collapses, everyone can see the problem.",
        "The strategic advantage lies in noticing weakness while there is still time to redirect."
      ),
      b(
        "Reading strategy critically is part of leadership. Teams need people who can distinguish ambition, policy, and action clearly.",
        "Otherwise the organization becomes too easy to impress and too slow to correct itself."
      )
    ],
    examples: [
      ex(
        "ch03-ex01",
        "Group project with polished language",
        ["school"],
        "A student team writes that its strategy is to deliver a world class presentation through innovation, excellence, and collaboration. Nobody can explain what problem the team is most worried about or how the work will be divided.",
        [
          "Treat the polished wording as a warning sign rather than a finished plan.",
          "Ask what challenge could actually derail the presentation and rebuild the plan around that issue."
        ],
        "The problem is not weak vocabulary. It is weak strategic logic hiding under strong language."
      ),
      ex(
        "ch03-ex02",
        "Exam goal mistaken for strategy",
        ["school"],
        "A student says the strategy for finals is to get all A grades. The study schedule still spreads time evenly across every subject even though one course is clearly the biggest risk.",
        [
          "Separate the goal from the strategy.",
          "Name the course or skill that most threatens the outcome and let the study plan respond to that."
        ],
        "The warning sign is easy to miss because the goal sounds serious. It still does not guide action."
      ),
      ex(
        "ch03-ex03",
        "Turnaround deck with weak objectives",
        ["work"],
        "An executive deck promises growth, innovation, customer delight, operational excellence, and talent leadership. Teams leave the meeting energized but unclear about what will actually change first.",
        [
          "Do not accept the deck as strategy just because it sounds large and impressive.",
          "Push for the actual challenge, the response to that challenge, and the few objectives that would change near term behavior."
        ],
        "Weak objectives waste time because they create energy without direction."
      ),
      ex(
        "ch03-ex04",
        "Priority list that keeps expanding",
        ["work"],
        "A company tries to fix margin pressure by launching twelve projects at once. Managers treat the size of the list as proof of seriousness even though the projects do not reinforce one another.",
        [
          "Read the growing list as a signal that the strategy may still be missing.",
          "Ask which challenge matters most and which few actions actually fit that challenge."
        ],
        "Bad strategy often responds to uncertainty by adding more motion. That usually increases waste instead of reducing it."
      ),
      ex(
        "ch03-ex05",
        "Savings plan with empty metrics",
        ["personal"],
        "Someone announces a strategy to become financially secure this year and starts tracking many small spending categories. The deeper issue is that housing cost is the main pressure, but the plan avoids touching it.",
        [
          "Notice the avoidance instead of admiring the amount of tracking.",
          "Move attention to the challenge that actually dominates the outcome, even if it forces a harder choice."
        ],
        "A plan can look disciplined and still be weak if it avoids the real source of difficulty."
      ),
      ex(
        "ch03-ex06",
        "Relationship repair without a diagnosis",
        ["personal"],
        "A couple says the strategy is to communicate better. They keep having the same conflict because neither person has named whether the real issue is time pressure, trust, or unresolved expectations.",
        [
          "Treat the broad goal as a starting point, not a strategy.",
          "Identify the actual pattern causing the repeat conflict and respond to that pattern directly."
        ],
        "When the real issue stays unnamed, even good intentions fail to guide better action."
      )
    ],
    quiz: [
      q(
        "Which statement is the clearest hallmark of bad strategy?",
        [
          "A plan built around broad aspirations with no clear challenge or response",
          "A plan that concentrates resources on one pivotal issue",
          "A plan that makes a hard tradeoff explicit",
          "A plan that changes priorities based on diagnosis"
        ],
        0,
        "Bad strategy often sounds ambitious while leaving the strategic logic undefined."
      ),
      q(
        "Why is fluff strategically dangerous?",
        [
          "It can hide that no diagnosis or coherent response has been made",
          "It always lowers morale",
          "It makes people read too slowly",
          "It prevents any long term goal setting"
        ],
        0,
        "Fluff matters because it can mask missing substance."
      ),
      q(
        "A team says, \"Our strategy is to win the market.\" What is the basic problem?",
        [
          "It states a goal without explaining how the challenge will be overcome",
          "It focuses too much on customers",
          "It is too specific about tradeoffs",
          "It names too few initiatives"
        ],
        0,
        "A desired outcome is not a strategy until it guides choice and action."
      ),
      q(
        "What makes a strategic objective weak?",
        [
          "It sounds good but does not help people decide what to do",
          "It is measurable",
          "It focuses on one issue at a time",
          "It creates resource concentration"
        ],
        0,
        "A strategic objective must shape action, not just signal virtue."
      ),
      q(
        "A plan keeps expanding to include every leader's preferred project. What does that most likely indicate?",
        [
          "Compromise has replaced strategy",
          "The diagnosis is getting sharper",
          "The plan is becoming more coherent",
          "The organization is improving its leverage"
        ],
        0,
        "When everything is included, strategy is usually being replaced by politics."
      ),
      q(
        "Why is early detection of bad strategy valuable?",
        [
          "Because weak logic is cheaper to correct before identity and budgets lock it in",
          "Because any plan becomes good if revised often enough",
          "Because results no longer matter once weakness is spotted",
          "Because bad strategy only harms communication"
        ],
        0,
        "Weak strategy becomes more costly once people commit money, time, and reputation to it."
      ),
      q(
        "Which question best tests whether a plan is real strategy?",
        [
          "What challenge is being solved and what will change because of the response",
          "How many goals can be named in the opening slide",
          "How positive the executive tone sounds",
          "Whether every team received at least one initiative"
        ],
        0,
        "Strong questions force the plan to reveal its logic."
      ),
      q(
        "A student says, \"My strategy is to do my best this semester.\" Which revision is strongest?",
        [
          "My biggest risk is weak quantitative work, so I will rebuild my weekly study time around that class first",
          "My goal is still to do my best, but with more confidence",
          "I will keep all study time balanced so every course feels equal",
          "I will add more activities so I stay motivated"
        ],
        0,
        "The stronger version identifies a challenge and links action to it."
      ),
      q(
        "What do vague objectives and vague language often have in common?",
        [
          "Both let people avoid the hard choice that strategy requires",
          "Both increase strategic focus",
          "Both make execution easier",
          "Both prove the organization is thinking long term"
        ],
        0,
        "Weak wording and weak objectives often protect people from confronting tradeoffs."
      ),
      q(
        "What is the best overall use of Rumelt's warning signs?",
        [
          "To challenge persuasive but empty plans before they consume more resources",
          "To reject any ambitious goal",
          "To avoid planning documents altogether",
          "To focus only on wording rather than results"
        ],
        0,
        "The hallmarks help readers separate strong strategic logic from impressive presentation."
      )
    ]
  },
  {
    chapterId: "ch04-why-bad-strategy-persists",
    title: "Why Weak Strategy Keeps Returning",
    simpleSummary: [
      "Weak strategy keeps returning because it is easier to say pleasant things than to make sharp choices. Rumelt argues that bad strategy persists through avoidance, politics, wishful thinking, and the desire to protect status.",
      "This matters because strategic failure is rarely a pure knowledge problem. It is often a courage problem inside systems that reward comfort over clarity."
    ],
    standardSummary: [
      "Weak strategy keeps returning because the forces that produce it are ordinary and persistent. Rumelt points to avoidance of hard truth, unwillingness to choose, political bargaining, and leadership weakness as common reasons bad strategy survives.",
      "The chapter matters because it explains why knowing the right framework is not enough. Good strategy often threatens reputation, habits, and internal bargains, so organizations drift toward softer language and wider compromise unless leaders resist that pull."
    ],
    deeperSummary: [
      "Weak strategy keeps returning because it serves short term psychological and political needs. It protects status, postpones conflict, and lets people perform seriousness without exposing weak assumptions or making painful tradeoffs.",
      "That makes the problem deeper than bad planning technique. Bad strategy persists because it can be rewarded in the short run. Real strategy asks for clarity, prioritization, and truth telling that many groups would rather delay, especially when stakes are high."
    ],
    takeaways: [
      "Bad strategy persists because it is comfortable.",
      "Politics and status often compete with strategic clarity.",
      "Leadership weakness shows up as strategic softness.",
      "Courage and diagnosis are linked."
    ],
    practice: [
      "name one tradeoff you are avoiding",
      "ask who benefits from strategic vagueness",
      "replace one comfort phrase with a hard fact",
      "surface one political compromise in a current plan",
      "state what the strategy is willing to stop doing"
    ],
    standardBullets: [
      b(
        "Comfort favors weak strategy. Pleasant language protects people from hard truth.",
        "That comfort is one reason bad strategy can survive even in smart groups."
      ),
      b(
        "Tradeoffs create political pain. Strategy requires saying yes here and no elsewhere.",
        "Many weak plans exist because leaders want the appearance of choice without its cost."
      ),
      b(
        "Status often blocks diagnosis. Naming the real challenge can expose past mistakes or weak positions.",
        "People resist that exposure even when the facts are obvious."
      ),
      b(
        "Wishful thinking is cheaper than analysis. Hope can feel faster than careful diagnosis.",
        "The problem is that it creates fragile plans that fail when reality pushes back."
      ),
      b(
        "Leadership weakness shows up as strategic softness. When leaders avoid clarity, the whole system becomes vague.",
        "People then fill the vacuum with compromise language and unrelated initiatives."
      ),
      b(
        "Internal bargaining can replace strategy. Plans become containers for competing demands rather than a focused response.",
        "This keeps the peace briefly while weakening actual performance."
      ),
      b(
        "Bad strategy can be rewarded in the short term. It sounds positive, avoids blame, and offends fewer people.",
        "That is why it keeps returning instead of disappearing on its own."
      ),
      b(
        "Good strategy requires strategic honesty. Someone has to say what is not working and what matters most.",
        "That is a leadership act, not just an analytic one."
      ),
      b(
        "The deeper fight is cultural. Organizations teach people whether truth or comfort will be rewarded.",
        "That pattern shapes strategy long before the annual plan is written."
      ),
      b(
        "Weak strategy persists until someone is willing to make reality harder to ignore than politics.",
        "That is why strong strategy often begins with plain speaking."
      )
    ],
    deeperBullets: [
      b(
        "Vagueness can function like insurance. People use it to avoid being pinned to a risky claim.",
        "That protects careers, but it leaves the organization with weak commitments and weak action."
      ),
      b(
        "Consensus can become a trap. Agreement is not a virtue if it was purchased by removing the hard choice.",
        "A strategy everyone can endorse may be too diluted to matter."
      ),
      b(
        "Short term calm can produce long term cost. Avoiding the hard conversation now usually raises the price later.",
        "Strategic softness often looks humane at first and wasteful later."
      ),
      b(
        "Strategic honesty is easier when evidence is visible. Facts, comparisons, and resource limits help cut through performance.",
        "Leaders can reduce resistance by making the tradeoff concrete instead of abstract."
      ),
      b(
        "Because the causes are human, they never disappear fully. Strategy needs recurring discipline, not one time correction.",
        "The work is to build habits and norms that keep the drift from taking over."
      )
    ],
    examples: [
      ex(
        "ch04-ex01",
        "Club officers avoiding the real issue",
        ["school"],
        "A student club has shrinking attendance, but officers keep blaming campus busyness because that explanation feels harmless. The harder truth is that meetings are repetitive and new members feel ignored.",
        [
          "Say the uncomfortable explanation out loud instead of protecting feelings with a soft story.",
          "Once the real issue is named, rebuild the meetings around member experience rather than generic promotion."
        ],
        "Weak strategy persists when comfort wins over diagnosis. Naming the real problem is the first break in that cycle."
      ),
      ex(
        "ch04-ex02",
        "Team project ruled by compromise",
        ["school"],
        "A class project keeps adding sections because every teammate wants their favorite topic included. Nobody wants conflict, so the final plan becomes broad, slow, and hard to present well.",
        [
          "Recognize that the problem is not lack of ideas but refusal to choose.",
          "Cut the project back to the few sections that serve the strongest argument."
        ],
        "Compromise can feel fair while quietly destroying coherence. Strategy requires uneven commitment."
      ),
      ex(
        "ch04-ex03",
        "Executive team that protects status",
        ["work"],
        "A company is losing share in a market it once dominated. Leaders keep framing the issue as a temporary slowdown because admitting a structural shift would expose that the old model no longer works.",
        [
          "Make the diagnosis concrete enough that status protection becomes harder than adaptation.",
          "Use customer data and competitor comparisons to force a real conversation about the changed landscape."
        ],
        "Bad strategy persists when honest diagnosis threatens identity. Evidence helps break that protection."
      ),
      ex(
        "ch04-ex04",
        "Manager afraid to cut priorities",
        ["work"],
        "A manager knows the team cannot deliver five major projects well, but does not want to disappoint senior stakeholders. The result is a polite plan that promises all five and quietly underdelivers on each.",
        [
          "Treat the avoidance itself as the strategic issue.",
          "Bring the capacity limit into the open and force the tradeoff early instead of letting failure make the choice later."
        ],
        "Weak strategy often comes from reluctance to choose under political pressure."
      ),
      ex(
        "ch04-ex05",
        "Household budget built on optimism",
        ["personal"],
        "A household keeps saying next month will be better, even though spending always rises again after one careful week. Nobody wants to admit that the deeper issue is a living cost level the current income cannot comfortably support.",
        [
          "Replace hopeful language with the facts of the recurring pattern.",
          "Build the plan around the structural gap instead of assuming motivation will solve it next month."
        ],
        "Wishful thinking feels easier than strategy because it postpones the hardest choice."
      ),
      ex(
        "ch04-ex06",
        "Career plan that protects ego",
        ["personal"],
        "Someone says their career strategy is to wait for the right opportunity because the market is unclear. The harder truth is that applying seriously would expose gaps in skill and confidence they would rather not face.",
        [
          "Look for the part of the story that protects pride more than progress.",
          "If the real issue is skill or proof of ability, make that the problem to solve first."
        ],
        "Bad personal strategy often survives because it lets people preserve self image without making a sharper move."
      )
    ],
    quiz: [
      q(
        "Why can bad strategy survive inside capable organizations?",
        [
          "Because it often protects comfort, status, and political peace in the short term",
          "Because smart people do not need strategy",
          "Because tradeoffs disappear in large organizations",
          "Because analysis always makes action slower"
        ],
        0,
        "Weak strategy persists because it can serve social and political interests even while hurting results."
      ),
      q(
        "A leader refuses to cut priorities because each sponsor is important. What is the strategic failure?",
        [
          "Avoiding the tradeoff that strategy requires",
          "Using too much diagnosis",
          "Focusing too narrowly on execution",
          "Giving the team too much clarity"
        ],
        0,
        "The weakness comes from refusing to choose under constraint."
      ),
      q(
        "Why does status often interfere with strategy?",
        [
          "Because honest diagnosis can expose past mistakes or current weakness",
          "Because strategy never works in hierarchical settings",
          "Because leaders should avoid evidence",
          "Because ambition and strategy are incompatible"
        ],
        0,
        "Naming the real challenge can threaten reputation, which makes vagueness tempting."
      ),
      q(
        "Which behavior best signals wishful thinking rather than strategy?",
        [
          "Assuming improvement will come without confronting the real structural issue",
          "Using evidence to test a diagnosis",
          "Concentrating effort on one major bottleneck",
          "Dropping low value work to free resources"
        ],
        0,
        "Hope becomes strategic weakness when it replaces diagnosis and choice."
      ),
      q(
        "What role does leadership play in the persistence of weak strategy?",
        [
          "Leaders either force clarity or allow vagueness to spread through the system",
          "Leaders matter only during execution",
          "Leaders should avoid hard truths to protect morale",
          "Leaders improve strategy by keeping all groups equally satisfied"
        ],
        0,
        "Leadership weakness often appears first as strategic softness."
      ),
      q(
        "Why can broad consensus be a bad sign?",
        [
          "Because agreement may have been purchased by removing the real choice",
          "Because strategy should always divide the group evenly",
          "Because conflict proves good diagnosis",
          "Because consensus eliminates the need for policy"
        ],
        0,
        "Consensus is not valuable if it comes from diluting the strategy until nothing sharp remains."
      ),
      q(
        "A team keeps using soft language around a failing product. What is the most likely strategic cost?",
        [
          "The language delays the hard diagnosis and lets weak action continue",
          "The language improves coherence",
          "The language sharpens tradeoffs",
          "The language makes the guiding policy clearer"
        ],
        0,
        "Soft language protects people in the moment but weakens action over time."
      ),
      q(
        "What is the best first move when politics are blocking a necessary strategic choice?",
        [
          "Make the capacity limits and tradeoffs concrete enough that avoidance is harder",
          "Add more priorities so everyone stays represented",
          "Replace the data with positive messaging",
          "Wait for the conflict to disappear on its own"
        ],
        0,
        "Concrete evidence can make the real choice harder to dodge."
      ),
      q(
        "Why is bad strategy not just a technical planning issue?",
        [
          "Because the causes are human and political as much as analytic",
          "Because planning never helps strategy",
          "Because only markets create strategy problems",
          "Because execution quality does not matter"
        ],
        0,
        "Rumelt's point is that weak strategy often survives for social reasons, not only intellectual ones."
      ),
      q(
        "What usually breaks the cycle of weak strategy first?",
        [
          "Plain speaking about reality and the tradeoff it demands",
          "A longer planning document",
          "More optimistic objectives",
          "A broader compromise among stakeholders"
        ],
        0,
        "The cycle usually breaks when someone makes the real problem harder to ignore."
      )
    ]
  },
  {
    chapterId: "ch05-sources-of-power",
    title: "Good Strategy Uses Concentrated Sources of Power",
    simpleSummary: [
      "Good strategy looks for sources of power that can move outcomes disproportionately. Rumelt argues that leverage matters more than effort spread evenly across every problem.",
      "This matters because not all strengths are strategically useful. The strongest move is often to find the point where limited action can create outsized effect."
    ],
    standardSummary: [
      "Good strategy uses concentrated sources of power such as leverage, bottlenecks, asymmetries, and positions where a focused move can change the whole situation. Rumelt's point is that strategic strength comes from using power where it matters most, not from doing more of everything.",
      "The chapter matters because most organizations waste force through equal distribution. Strategy becomes powerful when it identifies the few points where insight, resources, or timing can create effects far larger than the effort invested."
    ],
    deeperSummary: [
      "Good strategy uses concentrated sources of power by searching for leverage points where a relatively small move can shift a much larger system. Rumelt is not praising cleverness for its own sake. He is showing that strategy earns its name by finding asymmetry between effort spent and effect produced.",
      "That matters because strategic power is usually hidden inside structure. It lives in bottlenecks, neglected positions, sequencing, and the way systems respond unevenly to pressure. Leaders who miss these points often replace leverage with grind."
    ],
    takeaways: [
      "Leverage is about disproportionate effect.",
      "Not every strength becomes strategic power.",
      "Concentration beats equal distribution.",
      "A leverage point can make small moves matter a lot."
    ],
    practice: [
      "list the few places where a small move could change a large result",
      "rank your current efforts by likely leverage",
      "cut one low impact activity",
      "ask what bottleneck controls the whole outcome",
      "move one key resource toward the highest leverage point"
    ],
    standardBullets: [
      b(
        "Leverage means disproportionate effect. A strong move changes more than its size would suggest.",
        "Strategy searches for these points instead of assuming all effort pays equally."
      ),
      b(
        "Not every strength matters strategically. A capability becomes power only when it affects the key challenge.",
        "Useful power is always relative to the situation, not abstract."
      ),
      b(
        "Bottlenecks often hold power. Fixing the right constraint can improve the whole system.",
        "That is why diagnosis and leverage belong together."
      ),
      b(
        "Asymmetry creates opportunity. When others are poorly positioned for a specific issue, a focused move can matter more.",
        "Strategy improves when it notices where the field is uneven."
      ),
      b(
        "Concentration is usually required. Power weakens when it is spread for the sake of fairness or comfort.",
        "A leverage point only matters if enough force reaches it."
      ),
      b(
        "Timing can magnify power. The same move has different value at different moments.",
        "Leverage is not only about where to act, but also when."
      ),
      b(
        "Leverage often looks unglamorous. The critical point may be a dull process, a narrow segment, or one small rule.",
        "Strategic value is not measured by visibility."
      ),
      b(
        "Low leverage effort is expensive. Activity that cannot change the central outcome drains attention and resources.",
        "Cutting it is part of strategic discipline."
      ),
      b(
        "Leverage shifts as the situation changes. A point of power today may fade once others adapt.",
        "That is why strategy keeps reading the environment instead of freezing the first insight."
      ),
      b(
        "Good strategy turns limited means into larger effect by finding where concentrated force actually matters.",
        "That is the practical meaning of strategic power."
      )
    ],
    deeperBullets: [
      b(
        "Leverage depends on understanding the system, not only the resource. More money or talent does not help if aimed at the wrong place.",
        "The quality of the diagnosis controls the usefulness of the power."
      ),
      b(
        "A leverage point can be hidden by routine thinking. People often keep spending where effort has always gone instead of where it would now matter most.",
        "Historical allocation is a weak guide when the structure has changed."
      ),
      b(
        "Because leverage is uneven, strategic work can look unfair. Some areas get intense support while others are deliberately starved.",
        "That tension is often a sign that real prioritization is happening."
      ),
      b(
        "Competitors can train themselves to miss leverage. Success in one model can make them slow to notice the new pressure point.",
        "That creates openings for smaller but sharper players."
      ),
      b(
        "The danger is falling in love with effort. Grind feels virtuous even when it keeps missing the leverage point.",
        "Strategy disciplines effort so that work and effect stop drifting apart."
      )
    ],
    examples: [
      ex(
        "ch05-ex01",
        "Study time at the wrong point",
        ["school"],
        "A student spends hours polishing subjects that already feel comfortable. The grade risk still sits in one statistics unit that controls the largest share of the final exam.",
        [
          "Treat the weak unit as the leverage point rather than studying by comfort.",
          "Move the best hours of the week to that unit first and build supporting review around it."
        ],
        "Leverage in school often means putting effort where it can change the whole result, not where work feels easiest."
      ),
      ex(
        "ch05-ex02",
        "Fundraiser focused on the wrong channel",
        ["school"],
        "A student group is trying to raise money and keeps posting on every social channel. Most donations actually come from a small group of alumni who respond when contacted personally.",
        [
          "Stop treating every outreach channel as equally strategic.",
          "Concentrate effort on the alumni segment and design the campaign around that leverage point."
        ],
        "A narrow source of power can matter more than a broad but weak campaign."
      ),
      ex(
        "ch05-ex03",
        "Customer success bottleneck",
        ["work"],
        "A company wants higher renewals and keeps asking every department for ideas. The data shows that customers who finish one setup step in week one almost always stay.",
        [
          "Use that step as the leverage point for the retention strategy.",
          "Concentrate product, support, and messaging changes on getting more customers through that moment."
        ],
        "A single point in the customer journey can carry more strategic power than many broad initiatives."
      ),
      ex(
        "ch05-ex04",
        "Operations team spread too thin",
        ["work"],
        "An operations leader is trying to improve service quality by running many small fixes across every location. One recurring scheduling failure is actually driving most of the delays.",
        [
          "Stop distributing effort equally and attack the dominant delay source first.",
          "Give that point enough people and attention to see whether the whole system improves."
        ],
        "Concentrated force matters because some constraints govern the whole experience."
      ),
      ex(
        "ch05-ex05",
        "Personal routine missing the real lever",
        ["personal"],
        "Someone wants more daily focus and keeps experimenting with apps, desks, and playlists. The biggest driver of a bad day is still a late start that pushes everything into reactive mode.",
        [
          "Treat the start of the day as the leverage point instead of optimizing every tool.",
          "Protect the first hour and let the rest of the routine support that move."
        ],
        "Personal leverage often hides in one pattern that shapes many later outcomes."
      ),
      ex(
        "ch05-ex06",
        "Side business with one strong channel",
        ["personal"],
        "A small creator business is trying to grow through every platform at once. Most sales still come from a weekly email that consistently converts readers into buyers.",
        [
          "Concentrate on the channel that has already shown leverage.",
          "Improve the offer, sequence, and follow up there before expanding effort elsewhere."
        ],
        "Strategy improves when it respects actual power instead of distributing energy for the sake of variety."
      )
    ],
    quiz: [
      q(
        "What does Rumelt mean by a source of power in strategy?",
        [
          "A point where focused effort can produce disproportionate effect",
          "Any large budget or team",
          "Any visible strength the organization can mention",
          "Any area with the most current activity"
        ],
        0,
        "A source of power matters because it changes more than its size would suggest."
      ),
      q(
        "Why is concentration usually necessary for leverage?",
        [
          "Because a leverage point only matters if enough force actually reaches it",
          "Because strategy should ignore all secondary issues forever",
          "Because equal allocation always improves outcomes",
          "Because visibility is the same as power"
        ],
        0,
        "Spreading effort too thin often weakens the very point that could have mattered most."
      ),
      q(
        "A team says every customer segment is equally strategic. What is the likely mistake?",
        [
          "Failing to identify where advantage or leverage is actually strongest",
          "Using too much diagnosis",
          "Focusing too much on tradeoffs",
          "Letting timing matter too much"
        ],
        0,
        "Not every segment carries the same power, even if treating them equally feels fair."
      ),
      q(
        "Which situation best shows a leverage point?",
        [
          "One setup step that strongly predicts whether a customer will renew",
          "A list of general goals for the year",
          "A plan to improve every metric by the same amount",
          "A busy calendar with many unrelated tasks"
        ],
        0,
        "A leverage point is a place where one move can shift many later outcomes."
      ),
      q(
        "Why can low leverage effort be dangerous?",
        [
          "It consumes attention and resources without changing the main outcome much",
          "It always lowers morale immediately",
          "It makes diagnosis unnecessary",
          "It guarantees that stronger moves will appear later"
        ],
        0,
        "Strategy is partly the discipline of stopping work that cannot move the central result."
      ),
      q(
        "What role does timing play in strategic power?",
        [
          "The same move can have very different value depending on when it is made",
          "Timing matters only after resources are concentrated",
          "Timing is less important than visibility",
          "Timing eliminates the need for leverage"
        ],
        0,
        "Power is often a combination of place and moment."
      ),
      q(
        "A company with more resources keeps missing a smaller rival's moves. What is the best explanation?",
        [
          "The smaller rival may be using leverage better by focusing on the right point",
          "Resources never matter in strategy",
          "The larger company is too coherent",
          "The smaller rival must be spreading effort more widely"
        ],
        0,
        "More resources do not guarantee power if they are aimed badly."
      ),
      q(
        "What is the best response after finding a true bottleneck?",
        [
          "Concentrate enough effort there to see whether the whole system improves",
          "Spread the effort evenly so no area feels neglected",
          "Ignore it and fix the strongest area first",
          "Turn it into a slogan for the wider team"
        ],
        0,
        "A bottleneck matters because the whole system is waiting on it."
      ),
      q(
        "Why might a leverage point look unimportant at first?",
        [
          "Because strategic value often hides in a narrow process or neglected position",
          "Because strong strategy is always dramatic",
          "Because leverage only exists in marketing",
          "Because visible work is always higher impact"
        ],
        0,
        "Leverage is defined by effect, not by how exciting the point looks."
      ),
      q(
        "What is the deepest mistake in replacing leverage with grind?",
        [
          "Confusing more effort with more strategic effect",
          "Using too much analysis before action",
          "Cutting low value work",
          "Making timing part of the strategy"
        ],
        0,
        "Rumelt's point is that strategic strength comes from disproportionate effect, not raw strain."
      )
    ]
  },
  {
    chapterId: "ch06-using-advantage",
    title: "Advantage Must Be Understood and Renewed",
    simpleSummary: [
      "Advantage matters only when it creates a meaningful difference that can be used in the real situation. Rumelt argues that advantage is not a label to claim but a position to understand, exploit, and renew.",
      "This matters because many people mistake size, pride, or history for advantage. Real advantage is specific, practical, and temporary unless it is maintained."
    ],
    standardSummary: [
      "Advantage matters when an organization has a meaningful difference that helps it perform better against a specific challenge. Rumelt emphasizes that advantage must be understood clearly, linked to actual value, and renewed as conditions change.",
      "The chapter matters because leaders often treat advantage as a permanent asset once it appears. In reality, advantage can decay, be copied, or become irrelevant if the environment shifts and the organization stops working to extend it."
    ],
    deeperSummary: [
      "Advantage matters only when a meaningful difference improves results in a particular context. Rumelt's point is that competitive advantage is not prestige, size, or good feeling. It is an operative difference that changes cost, value, access, speed, or some other strategically relevant outcome.",
      "That matters because advantage is relational and temporary. It depends on what rivals can or cannot do, what customers value now, and whether the organization keeps renewing the system that produced the edge. A misunderstood advantage becomes a story. A renewed advantage stays strategic."
    ],
    takeaways: [
      "Advantage is a meaningful difference, not a self description.",
      "It only matters relative to a real challenge or rival context.",
      "Advantage decays if it is not renewed.",
      "Leaders need to know why the edge exists."
    ],
    practice: [
      "name one real difference that changes outcomes in your favor",
      "ask who values that difference and why",
      "identify what could erode the edge",
      "strengthen one activity that supports the advantage",
      "drop one story about advantage that has no current evidence"
    ],
    standardBullets: [
      b(
        "Advantage is a meaningful difference. It improves performance in a way that matters in the real contest.",
        "A trait only becomes strategic when it changes outcomes, not when it sounds impressive."
      ),
      b(
        "Advantage is relative. It depends on the market, the rival set, and the problem being solved.",
        "What counts as an edge in one context may be useless in another."
      ),
      b(
        "You need to know why the edge exists. A claimed advantage that cannot be explained is hard to protect.",
        "Understanding the source is what lets leaders invest in it intelligently."
      ),
      b(
        "Advantage must connect to value. Lower cost, better fit, faster response, or stronger trust can all matter if customers care.",
        "An internal strength with no market effect is not enough."
      ),
      b(
        "Edges can be copied or eroded. Success invites imitation and environmental change.",
        "That is why advantage cannot be treated as permanent."
      ),
      b(
        "Renewal is part of the job. Strong organizations keep strengthening the system that creates the edge.",
        "They do not simply defend the story of past success."
      ),
      b(
        "Scale is not automatically advantage. Bigger can help, but only if it improves the factors that matter.",
        "Size without fit can become drag instead of strength."
      ),
      b(
        "Operational fit often matters more than slogans. Small differences in process, cost structure, or customer experience can create durable advantage.",
        "These are easy to overlook because they are rarely glamorous."
      ),
      b(
        "False advantage is dangerous. If leaders misread their edge, they invest in the wrong things and miss real threats.",
        "Good strategy therefore demands evidence, not pride."
      ),
      b(
        "Advantage stays useful when it is understood, linked to value, and renewed before it fades.",
        "That is how an edge becomes strategically durable for longer."
      )
    ],
    deeperBullets: [
      b(
        "Many organizations confuse success with advantage. Past wins do not prove the edge still exists now.",
        "The conditions that created the earlier success may already have changed."
      ),
      b(
        "The strongest advantages often live in systems, not in one feature. Process, reputation, access, and cost structure can reinforce one another.",
        "That makes the edge harder to copy because rivals must reproduce a whole pattern."
      ),
      b(
        "Customers decide whether the difference matters. Internal pride is a weak substitute for external value.",
        "An advantage no one values will not stay strategic for long."
      ),
      b(
        "Renewal often requires cannibalizing comfort. You may need to update the very routines that once created the edge.",
        "That is one reason successful organizations can lose advantage despite knowing their history well."
      ),
      b(
        "The danger is becoming loyal to the label of advantage after the fact. Once that story hardens, adaptation gets slower.",
        "Real strategy keeps asking whether the edge is still operative, still valued, and still defendable."
      )
    ],
    examples: [
      ex(
        "ch06-ex01",
        "Student with a real edge",
        ["school"],
        "A student is strong at explaining complex material to classmates and assumes that means they will also do well in every exam format. The current course grades are mostly driven by fast problem solving under time pressure.",
        [
          "Ask whether the strength actually matters in the current contest.",
          "If speed under pressure is the missing factor, use the communication skill where it helps but train the timed skill directly."
        ],
        "A real strength is not always the same as a relevant advantage. Context decides whether the edge pays off."
      ),
      ex(
        "ch06-ex02",
        "Club with fading reputation",
        ["school"],
        "A campus club assumes it has an advantage because it has been respected for years. New students barely know it, and rival groups now offer better onboarding and more relevant events.",
        [
          "Treat history as evidence to inspect, not as proof that the edge still exists.",
          "Identify what current students value now and rebuild the club's advantage around that."
        ],
        "Past prestige can hide present weakness. Advantage has to stay relevant to matter."
      ),
      ex(
        "ch06-ex03",
        "Product team misreading its edge",
        ["work"],
        "A software company says its advantage is superior engineering talent. Customers actually stay because the product integrates smoothly with the tools they already use.",
        [
          "Trace the advantage to the difference customers value most.",
          "Invest in strengthening that integration system rather than only celebrating internal talent."
        ],
        "Understanding why the edge works is what allows a company to defend and extend it."
      ),
      ex(
        "ch06-ex04",
        "Retail chain relying on size",
        ["work"],
        "A retail chain assumes its scale guarantees advantage. Costs are rising, customer experience is uneven, and a smaller rival is winning with sharper local assortment and faster service.",
        [
          "Stop treating size as an automatic edge.",
          "Find the specific differences that still matter to customers and rebuild operations around those."
        ],
        "Scale helps only when it improves the factors that actually drive better performance."
      ),
      ex(
        "ch06-ex05",
        "Freelancer with one clear edge",
        ["personal"],
        "A freelancer gets repeat work because they turn around drafts much faster than peers, but keeps trying to compete mainly on low price. That price pressure is making the business harder to sustain.",
        [
          "Recognize the real advantage and price around the value it creates.",
          "Then protect the systems that allow the fast, reliable turnaround."
        ],
        "Misreading your own edge can make you compete in the wrong way."
      ),
      ex(
        "ch06-ex06",
        "Network advantage that needs renewal",
        ["personal"],
        "Someone has built a strong professional network and keeps assuming that network will keep opening doors. They have stopped maintaining relationships and stopped updating the work that originally made them valuable.",
        [
          "Treat the network as an advantage that needs renewal rather than a permanent asset.",
          "Reinvest in the relationships and in the underlying quality that made those relationships useful."
        ],
        "Advantage decays when people defend the label instead of renewing the source."
      )
    ],
    quiz: [
      q(
        "What makes a difference count as strategic advantage?",
        [
          "It improves performance in a way that matters in the real context",
          "It sounds impressive inside the organization",
          "It is based on a long history",
          "It involves the largest possible scale"
        ],
        0,
        "Advantage matters only when the difference changes actual outcomes."
      ),
      q(
        "Why is advantage always relative?",
        [
          "Because its value depends on the rivals, the customers, and the specific challenge",
          "Because every advantage is temporary by definition",
          "Because no organization can really know its strengths",
          "Because scale removes all comparisons"
        ],
        0,
        "An edge is meaningful only in relation to a real competitive or strategic setting."
      ),
      q(
        "A firm says its advantage is brand prestige, but customers choose it mainly for speed and convenience. What should leaders do?",
        [
          "Recenter the strategy on the difference customers actually value",
          "Keep investing in prestige because it sounds stronger",
          "Ignore the customer behavior because history matters more",
          "Spread investment evenly across every possible strength"
        ],
        0,
        "Understanding why the edge works is necessary if you want to protect it."
      ),
      q(
        "Why can scale fail as an advantage?",
        [
          "Because size only helps if it improves the factors that matter",
          "Because small firms always beat large ones",
          "Because scale removes the need for strategy",
          "Because cost never matters in advantage"
        ],
        0,
        "Size is useful only when it changes cost, value, access, or some other relevant outcome."
      ),
      q(
        "What is the best reason to renew an advantage actively?",
        [
          "Success invites imitation and changing conditions can erode the edge",
          "Advantage gets stronger automatically over time",
          "Renewal mainly improves morale",
          "Renewal is only needed after a crisis"
        ],
        0,
        "Advantage decays if the system behind it is not refreshed."
      ),
      q(
        "Which example best shows false advantage?",
        [
          "Leaders invest heavily in a strength that customers do not actually value",
          "A team doubles down on the factor that drives customer retention",
          "A company protects a process advantage that lowers cost",
          "A firm notices imitation risk and updates its edge early"
        ],
        0,
        "False advantage is dangerous because it pulls investment away from what really matters."
      ),
      q(
        "Why are system based advantages often more durable?",
        [
          "Because rivals must copy a whole pattern of reinforcing activities rather than one feature",
          "Because systems never change",
          "Because customers cannot evaluate them",
          "Because they remove the need for renewal"
        ],
        0,
        "A system edge is harder to replicate because many parts support it."
      ),
      q(
        "A successful business keeps repeating, \"We have always been the best.\" What is the strategic risk?",
        [
          "The story of past success may replace honest testing of whether the edge still exists",
          "The business is probably too focused on renewal",
          "The business is already proving its current advantage",
          "The business is concentrating too much on customer value"
        ],
        0,
        "Past success can become a comforting story that slows adaptation."
      ),
      q(
        "What is the strongest first question when identifying an advantage?",
        [
          "What meaningful difference changes outcomes in our favor right now",
          "What strength makes us feel most proud",
          "What feature is easiest to advertise",
          "What has been true for the longest time"
        ],
        0,
        "The first question is about operative difference, not internal sentiment."
      ),
      q(
        "Which statement best captures the overall lesson?",
        [
          "An edge stays strategic only when it is understood clearly and renewed before it fades",
          "Any success automatically creates permanent advantage",
          "Advantage depends mostly on size and confidence",
          "The safest strategy is to defend the old story"
        ],
        0,
        "Rumelt treats advantage as something to understand, exploit, and renew, not merely claim."
      )
    ]
  }
];
const CHAPTERS_PART_TWO = [
  {
    chapterId: "ch07-proximate-objectives",
    title: "Set Near Term Objectives That Move the Problem",
    simpleSummary: [
      "Good strategy uses near term objectives that are close enough to guide action and important enough to move the larger problem. Rumelt's point is that people need a strategically meaningful next target, not just a distant ambition.",
      "This matters because big goals often fail at the point of execution. A strong near term objective makes progress concrete, reveals what must happen next, and keeps effort connected to the real challenge."
    ],
    standardSummary: [
      "Good strategy uses near term objectives that are close enough to organize immediate action while still serving the larger aim. Rumelt emphasizes that these objectives are not random short tasks. They are chosen because reaching them changes the strategic position in a meaningful way.",
      "The chapter matters because long range intent without a good next objective creates drift. Near term objectives reduce confusion, create momentum, and help teams test whether their strategy can actually move the problem step by step."
    ],
    deeperSummary: [
      "Good strategy uses near term objectives that are both achievable and strategically important. Rumelt treats them as bridges between high level intent and present action. They make strategy less dependent on wishful sequencing by identifying the next condition that must be created before larger success is possible.",
      "That matters because the best next move is often neither the final goal nor a tiny task. It is the intermediate outcome that unlocks later progress, clarifies resource use, and exposes whether the strategy has enough power to keep advancing."
    ],
    takeaways: [
      "Near term objectives connect big aims to present action.",
      "A good next objective changes the strategic position, not just the task list.",
      "Sequence matters because some wins make later wins possible.",
      "A vague next step creates drift."
    ],
    practice: [
      "write the next objective that would most improve your position",
      "test whether the objective is strategically meaningful",
      "remove one task that does not support that objective",
      "set a visible sign that the objective has been reached",
      "ask what later move becomes possible if this objective is met"
    ],
    standardBullets: [
      b(
        "A near term objective gives strategy traction. It tells people what important condition must be created next.",
        "That is different from naming the final destination and hoping the steps will appear on their own."
      ),
      b(
        "The objective should be close enough to guide action now. If it is too far away, it will not help with today's decisions.",
        "Good strategy turns distance into sequence."
      ),
      b(
        "The objective still needs strategic weight. A small task is not enough if finishing it changes nothing important.",
        "The right next objective improves position, not just activity."
      ),
      b(
        "Near term objectives reduce confusion. They help teams coordinate around one meaningful step instead of many unrelated tasks.",
        "This is especially valuable when uncertainty is high."
      ),
      b(
        "A strong next objective can expose capability gaps. Trying to reach it shows what is missing in the current plan.",
        "That feedback is useful because it comes before bigger failure."
      ),
      b(
        "Sequence is part of strategy. Some outcomes must come before others if the larger aim is to be realistic.",
        "Ignoring that order often leads to wasted effort."
      ),
      b(
        "Near term objectives help allocate resources. They make it clearer what deserves attention right now.",
        "That clarity is one reason they improve execution quality."
      ),
      b(
        "A vague objective creates false movement. Teams stay busy without knowing whether their effort is improving position.",
        "Precision matters because the point is progress, not motion."
      ),
      b(
        "The best next objective often unlocks later options. It may remove a constraint, prove a model, or build a needed capability.",
        "That is what makes it strategically important."
      ),
      b(
        "Near term objectives keep strategy honest by forcing the big idea to become operational.",
        "A strategy that cannot name its next meaningful objective is usually still too loose."
      )
    ],
    deeperBullets: [
      b(
        "A near term objective should reduce uncertainty, not just consume time. The best ones teach as well as advance.",
        "They help leaders learn whether the diagnosis and policy are strong enough."
      ),
      b(
        "Some objectives matter because they create credibility. A visible early win can free resources and attention for the next move.",
        "That makes sequencing partly political as well as operational."
      ),
      b(
        "Choosing the wrong near term objective can trap a strategy in local success. Small wins that do not improve position can still feel persuasive.",
        "That is why strategic importance matters as much as achievability."
      ),
      b(
        "The right objective often compresses many choices into one test. If it fails, the strategy learns quickly where the weakness lies.",
        "This keeps expensive illusions from lasting too long."
      ),
      b(
        "Near term objectives are a discipline against fantasy. They force the strategist to ask what must truly happen next in reality.",
        "That is why they improve both execution and judgment."
      )
    ],
    examples: [
      ex(
        "ch07-ex01",
        "Research paper without a next milestone",
        ["school"],
        "A student wants to write an excellent final paper and keeps collecting more sources. Progress stalls because the next objective should be settling the argument, not expanding the reading forever.",
        [
          "Choose the next condition that would move the whole project forward most.",
          "If that condition is a working thesis and outline, treat that as the objective for the week and make reading serve it."
        ],
        "A good near term objective stops a big project from dissolving into open ended activity."
      ),
      ex(
        "ch07-ex02",
        "Club launch without sequence",
        ["school"],
        "A student team wants a successful conference and is trying to solve sponsors, speakers, promotion, and volunteers at once. The event still lacks a date and a confirmed venue.",
        [
          "Ask which next objective unlocks the rest of the work.",
          "Secure the venue and date first, then let later actions sequence around that condition."
        ],
        "Some moves matter because they make other moves possible. That is what near term objectives are for."
      ),
      ex(
        "ch07-ex03",
        "Product turnaround with no bridge step",
        ["work"],
        "A product leader wants to restore growth and keeps discussing a full repositioning. The team still does not know whether new users understand the product well enough to reach first value.",
        [
          "Set a near term objective that tests and improves the key adoption step first.",
          "Let that objective shape the next sprint before taking on the bigger repositioning effort."
        ],
        "A strategic next objective should move the problem and teach the team at the same time."
      ),
      ex(
        "ch07-ex04",
        "Service team buried in tasks",
        ["work"],
        "A service team is trying to improve satisfaction, reduce backlog, and retrain staff all in one quarter. The most urgent issue is that ticket triage is weak, so the queue keeps filling with the wrong work.",
        [
          "Pick the objective that changes the position fastest.",
          "Make reliable triage the near term objective and use that to organize staffing and training."
        ],
        "A strong next objective simplifies execution because it creates an order for action."
      ),
      ex(
        "ch07-ex05",
        "Fitness plan with distant goals only",
        ["personal"],
        "Someone wants to run a half marathon in six months and keeps thinking about the race day target. The current problem is that they have not built a steady base of three weekly runs.",
        [
          "Replace the distant outcome with the near term objective that makes it realistic.",
          "Treat consistent weekly base training as the next strategic condition to create."
        ],
        "Near term objectives keep a long goal from becoming motivational wallpaper."
      ),
      ex(
        "ch07-ex06",
        "Career move without a bridge step",
        ["personal"],
        "A professional wants to move into product management and is networking broadly, reading articles, and applying to roles. They still lack one clear case study that proves the shift is credible.",
        [
          "Identify the next objective that would change the job search position.",
          "Build one strong case study first, then use it to support networking and applications."
        ],
        "The right near term objective often creates the evidence needed for later success."
      )
    ],
    quiz: [
      q(
        "What makes a near term objective strategic rather than merely busy?",
        [
          "It is the next reachable outcome that materially improves the position",
          "It is any task that can be completed quickly",
          "It is the final goal written in shorter language",
          "It is the easiest action for the team to agree on"
        ],
        0,
        "A strategic next objective must be both reachable and position changing."
      ),
      q(
        "Why are distant goals alone usually weak guides for execution?",
        [
          "They do not tell people what important condition must be created next",
          "They make tradeoffs too obvious",
          "They eliminate uncertainty",
          "They are always too narrow"
        ],
        0,
        "A big goal needs a meaningful bridge step to shape present action."
      ),
      q(
        "A team can finish the next task easily, but the task will not improve the real position. What is the issue?",
        [
          "The task lacks strategic importance even if it is achievable",
          "The task is too close to the present",
          "The team is focusing too much on sequence",
          "The objective is already strong because it can be finished"
        ],
        0,
        "Achievability is not enough if the step does not move the problem."
      ),
      q(
        "What is a useful benefit of a strong near term objective besides progress?",
        [
          "It reveals capability gaps before a larger failure appears",
          "It removes the need for diagnosis",
          "It lets teams avoid resource choices",
          "It turns any strategy into a good one"
        ],
        0,
        "The next objective also teaches the team where the plan is still weak."
      ),
      q(
        "Which situation best shows correct sequencing?",
        [
          "Securing the condition that unlocks later moves before expanding the plan",
          "Launching all major initiatives at once to build momentum",
          "Choosing the easiest visible task first regardless of importance",
          "Waiting until the final goal is fully mapped"
        ],
        0,
        "Sequence matters because some wins make later progress possible."
      ),
      q(
        "Why can a vague near term objective be dangerous?",
        [
          "It creates activity without a clear test of whether position is improving",
          "It makes the strategy too focused",
          "It always reduces morale",
          "It prevents any learning"
        ],
        0,
        "Vagueness replaces traction with the appearance of motion."
      ),
      q(
        "A leader chooses a next objective mainly because it will look good publicly, not because it changes the position. What is the likely problem?",
        [
          "The objective may become local success that does not serve the strategy",
          "The objective is probably too precise",
          "The objective will always build real capability",
          "The objective is guaranteed to unlock later options"
        ],
        0,
        "A visible win is only strategic if it improves the actual position."
      ),
      q(
        "How do near term objectives improve resource allocation?",
        [
          "They clarify what deserves attention right now",
          "They make every resource equally valuable",
          "They remove the need for concentration",
          "They turn all tasks into priorities"
        ],
        0,
        "A sharp next objective helps leaders decide what matters now."
      ),
      q(
        "What is the strongest test of a proposed near term objective?",
        [
          "If we reach this, will the larger problem become meaningfully easier to solve",
          "Will everyone feel equally represented by it",
          "Can we finish it without changing any priorities",
          "Does it contain as many tasks as possible"
        ],
        0,
        "The best test is whether the objective improves strategic position."
      ),
      q(
        "What is the deepest purpose of near term objectives in strategy?",
        [
          "They force the big idea to become operational in the real world",
          "They replace long term intent entirely",
          "They keep action small so risk disappears",
          "They allow strategy to avoid uncertainty"
        ],
        0,
        "Rumelt uses near term objectives to connect strategic thought to real movement."
      )
    ]
  },
  {
    chapterId: "ch08-chain-link-systems",
    title: "Weak Links Can Limit the Whole System",
    simpleSummary: [
      "Some systems perform only as well as their weakest critical link. Rumelt argues that strategy must find and strengthen that limiting point instead of assuming improvement anywhere will help equally.",
      "This matters because many people invest in what is already strong or visible. In a chain link system, that choice wastes effort because the real constraint sits somewhere narrower and more fragile."
    ],
    standardSummary: [
      "Some systems behave like chain links, which means the whole result depends on the weakest critical part. Rumelt uses this idea to show why strategy must identify and strengthen the specific link that limits performance instead of improving the system broadly.",
      "The chapter matters because chain link systems punish sloppy prioritization. Excelling in one area does not save the whole when one fragile point governs the outcome. Strategy therefore begins by finding the constraint that caps everything else."
    ],
    deeperSummary: [
      "Some systems behave like chain links, where the entire outcome depends on the reliability of the weakest critical link. Rumelt's point is not just that bottlenecks exist. It is that some environments require minimum strength across a sequence, so excess strength elsewhere adds little until the weak link is fixed.",
      "That matters because chain link logic changes how leaders should allocate resources. In these systems, prestige improvements, average improvements, and isolated excellence can all be strategically inferior to shoring up one neglected vulnerability that governs the whole result."
    ],
    takeaways: [
      "A chain link system is limited by its weakest critical link.",
      "Improving strong areas does not help much if the limiting link stays weak.",
      "Strategy must find the constraint that caps the whole system.",
      "Uniform reliability can matter more than isolated excellence."
    ],
    practice: [
      "map the sequence that produces the result",
      "identify the one step that most often breaks the chain",
      "direct the next resource increase to that link",
      "set a minimum standard for the critical link",
      "stop overinvesting in already strong parts of the chain"
    ],
    standardBullets: [
      b(
        "A chain link system is limited by its weakest critical part. The overall result cannot exceed that constraint for long.",
        "This makes diagnosis much more important than broad improvement."
      ),
      b(
        "Not every system works this way, but when one does, average strength is misleading.",
        "High performance in several areas does little if one link keeps failing."
      ),
      b(
        "Improving the strongest part may add almost nothing. The gain only appears when the limiting link is addressed.",
        "That is why prestige investments can be strategically wasteful."
      ),
      b(
        "The weak link is often a process step, handoff, or reliability issue.",
        "It may look small while controlling the whole result."
      ),
      b(
        "Minimum standards matter in chain link systems. One fragile point can undo excellence elsewhere.",
        "Strategy should therefore ask what level of reliability the system requires."
      ),
      b(
        "Redundancy can be strategic. In especially fragile links, backup capacity may matter more than optimization.",
        "Protecting the chain can be more valuable than maximizing one node."
      ),
      b(
        "Resource allocation has to be uneven. The weak link deserves disproportionate attention until the cap moves.",
        "Equal spending can preserve the problem instead of solving it."
      ),
      b(
        "Measurement should follow the chain, not vanity metrics. The right question is where the flow breaks.",
        "That keeps leaders from rewarding strength that the system cannot actually use."
      ),
      b(
        "Once the weak link improves, the constraint may shift elsewhere.",
        "Strategy has to keep rereading the system rather than assuming the first bottleneck is permanent."
      ),
      b(
        "The lesson is simple but demanding: find the link that limits the whole and fix that before polishing what is already strong.",
        "That is how chain link strategy creates real improvement."
      )
    ],
    deeperBullets: [
      b(
        "Chain link logic punishes pride. Teams often want to invest where they already look good instead of where they look weak.",
        "That preference feels rewarding and can be strategically backward."
      ),
      b(
        "The weak link may be social rather than technical. One unclear handoff or one role no one owns can cap the whole system.",
        "People miss these limits because they are less visible than equipment or budget."
      ),
      b(
        "Overcapacity in the wrong place can hide the real problem. Strong teams upstream may keep compensating for a weak link downstream.",
        "This makes the constraint harder to see until stress rises."
      ),
      b(
        "Some links deserve prevention more than optimization. It may be better to make failure rare than to make success slightly faster.",
        "That tradeoff is often misunderstood in fragile systems."
      ),
      b(
        "Chain link strategy teaches humility about where value comes from. The system only benefits from strength it can actually carry through to the end.",
        "That is why the weak link deserves such disciplined attention."
      )
    ],
    examples: [
      ex(
        "ch08-ex01",
        "Lab report bottleneck",
        ["school"],
        "A lab team has strong data collection and strong writing, but every report turns chaotic because one person is the only one who knows how to clean the data correctly. That delay holds up the whole submission.",
        [
          "Treat the data cleaning step as the critical link instead of polishing already strong parts.",
          "Add backup capability there and protect the workflow before investing elsewhere."
        ],
        "In a chain link system, the weakest critical step controls the result more than the strongest step."
      ),
      ex(
        "ch08-ex02",
        "Club event blocked by approvals",
        ["school"],
        "A student group is excellent at promotion and volunteer turnout, but events still stumble because room approvals happen late every time. That one process gap keeps limiting the whole operation.",
        [
          "Focus on the approval link until it becomes reliable.",
          "Create an earlier checklist, one owner, and a backup plan instead of adding more promotion."
        ],
        "Improving a strong link does not help much when another link keeps breaking the chain."
      ),
      ex(
        "ch08-ex03",
        "Customer onboarding chain",
        ["work"],
        "A company has good marketing, a solid product, and a capable support team, but new accounts sit idle because contract setup is slow and error prone. Revenue growth keeps stalling at that step.",
        [
          "Treat contract setup as the limiting link in the system.",
          "Put the next process redesign and staffing effort there before refining stronger areas."
        ],
        "The whole funnel can only move as well as the weakest critical step allows."
      ),
      ex(
        "ch08-ex04",
        "Operations handoff failure",
        ["work"],
        "A service business keeps hiring strong frontline staff, yet customers still complain because scheduling information is handed off poorly between sales and operations. The break is small but it poisons the full experience.",
        [
          "Map the chain and repair the handoff before celebrating frontline improvements.",
          "Clarify ownership and create one reliable transfer process."
        ],
        "A weak link is often a handoff people have learned to tolerate rather than fix."
      ),
      ex(
        "ch08-ex05",
        "Move planning with one missing document",
        ["personal"],
        "Someone is planning a move carefully and has packed early, budgeted well, and arranged transport. The whole move is still at risk because one required document for the new lease remains unresolved.",
        [
          "Treat the missing document as the weak link and solve it first.",
          "Do not keep polishing packed boxes while the single blocking condition remains open."
        ],
        "A chain link problem is solved by fixing the constraint, not by improving everything else around it."
      ),
      ex(
        "ch08-ex06",
        "Family trip limited by one step",
        ["personal"],
        "A family has travel funds, days off, and a full itinerary, but one visa application has been delayed. Everyone keeps discussing packing and activities even though the trip depends on that one pending step.",
        [
          "Concentrate attention on the critical missing link.",
          "Build backup options around that document instead of spending more time on already secure parts."
        ],
        "Chain link logic is ordinary in life. One fragile step can govern the whole result."
      )
    ],
    quiz: [
      q(
        "What defines a chain link system strategically?",
        [
          "The whole result depends on the weakest critical link",
          "Every part contributes equally to the outcome",
          "The strongest area determines the final result",
          "Average performance is the best guide to system quality"
        ],
        0,
        "Chain link logic means the limiting link caps the system."
      ),
      q(
        "Why can improving the strongest part be wasteful in a chain link system?",
        [
          "Because the weak link still limits the total outcome",
          "Because strong areas should never be funded",
          "Because optimization always lowers reliability",
          "Because the chain link is already fixed"
        ],
        0,
        "Extra strength where the system is not constrained adds little."
      ),
      q(
        "Which example best fits chain link logic?",
        [
          "A launch where one approval step repeatedly delays the entire process",
          "A team where every department contributes independently to brand awareness",
          "A market where customer demand is equally spread",
          "A project where small gains in any area help the same amount"
        ],
        0,
        "One critical step that limits the whole is the signature of a chain link system."
      ),
      q(
        "What is a useful first question in diagnosing a chain link problem?",
        [
          "Where does the sequence most often break or stall",
          "Which team looks strongest this quarter",
          "Which area has the most prestige",
          "Which function wants the next budget increase"
        ],
        0,
        "The goal is to find the step that governs the whole flow."
      ),
      q(
        "Why can average performance mislead in these systems?",
        [
          "Because one weak link can undo several strong links",
          "Because average performance always hides success",
          "Because averages are never useful in strategy",
          "Because strong links do not matter at all"
        ],
        0,
        "The system can look healthy on average while still failing at one decisive point."
      ),
      q(
        "When is redundancy strategically useful in a chain link system?",
        [
          "When the critical link is fragile enough that backup capacity prevents system failure",
          "When every link is equally strong",
          "When the goal is to raise vanity metrics",
          "When optimization has already fixed the weak link"
        ],
        0,
        "Backup capacity can be more valuable than small efficiency gains at a fragile point."
      ),
      q(
        "Why should resource allocation be uneven in a chain link problem?",
        [
          "Because the limiting link deserves disproportionate attention until the cap moves",
          "Because fairness is never useful",
          "Because strong links should be ignored forever",
          "Because weak links never shift over time"
        ],
        0,
        "Equal allocation can leave the bottleneck untouched."
      ),
      q(
        "A team keeps celebrating upstream productivity while downstream delivery still fails. What is the likely explanation?",
        [
          "Overcapacity in the wrong place is hiding the real weak link",
          "The upstream productivity automatically solves the system",
          "The downstream issues are not strategic",
          "The system is no longer a chain"
        ],
        0,
        "Strong performance before the bottleneck does not remove the bottleneck."
      ),
      q(
        "What often happens after a weak link is fixed?",
        [
          "The constraint shifts and a new weak link becomes visible",
          "The system stops needing strategy",
          "All links become equally strong permanently",
          "Measurement becomes unnecessary"
        ],
        0,
        "Improving one constraint often reveals the next limiting point."
      ),
      q(
        "What is the deepest strategic lesson of chain link systems?",
        [
          "Only strength the whole system can carry through to the end creates value",
          "The strongest team member always decides the result",
          "Optimization beats reliability in fragile systems",
          "Polishing visible strengths is the safest choice"
        ],
        0,
        "The system benefits only from strength that the weakest critical link can support."
      )
    ]
  },
  {
    chapterId: "ch09-design-and-coherence",
    title: "Coherent Design Beats Isolated Moves",
    simpleSummary: [
      "Good strategy works like design because actions should reinforce one another around a clear logic. Rumelt argues that isolated good moves are weaker than a system of moves that fit together.",
      "This matters because many plans fail from internal contradiction, not lack of effort. Coherence creates more power by making each action support the others."
    ],
    standardSummary: [
      "Good strategy works like design. It organizes actions so they reinforce one another around a clear diagnosis and policy. Rumelt's point is that strategic strength often comes from fit, not from one brilliant isolated move.",
      "The chapter matters because organizations often pursue individually reasonable actions that work against one another. Coherent design turns separate choices into a stronger whole by aligning priorities, incentives, timing, and resources."
    ],
    deeperSummary: [
      "Good strategy works like design because its power often comes from the way multiple choices fit together. Rumelt emphasizes that strategy is not merely selecting a strong move. It is arranging a set of moves so that each one raises the value of the others and reduces internal friction.",
      "That matters because incoherence can quietly destroy advantage. An organization can invest heavily, hire well, and act quickly while still losing power if its policies, incentives, and operating choices pull in different directions. Design is therefore a strategic discipline of fit."
    ],
    takeaways: [
      "Strategic strength often comes from fit among actions.",
      "Reasonable actions can still clash if the design is weak.",
      "Incentives, timing, and priorities all affect coherence.",
      "Design turns separate moves into a stronger whole."
    ],
    practice: [
      "list the actions that should reinforce the same logic",
      "find one move that currently conflicts with the strategy",
      "align one incentive with the chosen direction",
      "remove one action that adds friction to the design",
      "check whether timing supports or weakens the fit"
    ],
    standardBullets: [
      b(
        "Strategy is partly design. Its power often comes from how choices fit together.",
        "A single strong move matters less when the surrounding system works against it."
      ),
      b(
        "Coherence multiplies effect. Each action becomes more valuable when it supports the same underlying logic.",
        "This is why fit can outperform isolated brilliance."
      ),
      b(
        "Reasonable actions can still clash. A plan may contain many smart pieces that pull in different directions.",
        "The strategist has to design for fit, not just collect good ideas."
      ),
      b(
        "Design includes incentives and structure. These shape whether people can actually carry the strategy out.",
        "Ignoring them leaves coherence to chance."
      ),
      b(
        "Timing is part of coherence. Even good actions can weaken one another if they arrive in the wrong order.",
        "Fit depends on sequence as well as content."
      ),
      b(
        "Coherent design reduces friction. It makes execution smoother because fewer parts work at cross purposes.",
        "That saved friction becomes strategic power."
      ),
      b(
        "What you do not include matters too. Removing a conflicting move can improve the strategy more than adding a new one.",
        "Good design is selective."
      ),
      b(
        "Coherence can create advantage that rivals find hard to copy. Reproducing one action is easier than reproducing a fitted system.",
        "That makes design strategically durable."
      ),
      b(
        "Incoherence often hides in success metrics. Different teams may be rewarded for behaviors that weaken one another.",
        "A strategist needs to read the system, not only the stated plan."
      ),
      b(
        "Coherent design turns many actions into one strategic force.",
        "That is why fit is one of the deepest sources of power in strategy."
      )
    ],
    deeperBullets: [
      b(
        "Design requires subtraction as much as addition. Too many elements can create hidden contradiction.",
        "A cleaner system often carries more strategic force than a fuller one."
      ),
      b(
        "The strongest fit is often operational, not rhetorical. Meetings, staffing, pricing, and handoffs may reveal coherence more clearly than mission language.",
        "Real design shows up where work actually happens."
      ),
      b(
        "Coherence can be lost one local choice at a time. Small exceptions accumulate until the design no longer holds.",
        "That is why strategic maintenance matters after the initial plan is made."
      ),
      b(
        "A designed system can educate the organization. When choices fit, people learn the logic by working inside it.",
        "Coherence therefore shapes culture as well as performance."
      ),
      b(
        "Fit is demanding because it exposes contradiction. The more coherent the strategy becomes, the harder it is to justify moves that do not belong.",
        "That discomfort is one sign the design is getting sharper."
      )
    ],
    examples: [
      ex(
        "ch09-ex01",
        "School event with mixed signals",
        ["school"],
        "A student conference wants to attract serious attendees, but the promotion emphasizes casual fun while the agenda promises dense workshops. The event is drawing the wrong audience because the design is incoherent.",
        [
          "Align the message, format, and experience around one clear positioning choice.",
          "Cut elements that pull the event toward a different audience even if they look appealing on their own."
        ],
        "A few fitted choices create more power than many mismatched ones."
      ),
      ex(
        "ch09-ex02",
        "Study plan with internal conflict",
        ["school"],
        "A student wants deep mastery in one hard course but keeps accepting new club commitments during the same weeks. The calendar, energy, and learning goal are not designed to support one another.",
        [
          "Treat the issue as a design problem rather than a motivation problem.",
          "Remove or move the commitments that undermine the study plan so the parts of the week reinforce the real priority."
        ],
        "Coherence matters in personal systems too. Good intentions fail when the design conflicts with the goal."
      ),
      ex(
        "ch09-ex03",
        "Product strategy with conflicting incentives",
        ["work"],
        "A company says it wants long term customer value, but the sales team is paid mainly for fast contract volume. Support and product then inherit poor fit customers and rising churn.",
        [
          "Redesign incentives so that the sales move supports the retention strategy instead of fighting it.",
          "The strategy will remain weak until the system reinforces one logic."
        ],
        "Incoherent incentives can quietly undo a sensible strategy."
      ),
      ex(
        "ch09-ex04",
        "Premium service with discount habits",
        ["work"],
        "A firm wants to compete as a premium service, yet keeps running aggressive discounts and overloading staff. Customers receive mixed signals and the operating model keeps undermining the position.",
        [
          "Treat pricing, staffing, and service standards as one designed system.",
          "Remove the discount behavior that contradicts the premium promise unless the whole position changes."
        ],
        "A strategic position is only strong when the operating choices fit it."
      ),
      ex(
        "ch09-ex05",
        "Home routine that fights itself",
        ["personal"],
        "Someone wants calmer mornings, but keeps staying up late, leaving clutter in shared spaces, and packing the first hour with small urgent tasks. Every part of the routine works against the stated goal.",
        [
          "Redesign the routine so the pieces support the same outcome.",
          "Move evening preparation, reduce morning decisions, and remove the habits that create friction at the exact moment you want calm."
        ],
        "Coherence turns a set of habits into a system instead of a collection of wishes."
      ),
      ex(
        "ch09-ex06",
        "Relationship repair with mixed moves",
        ["personal"],
        "A couple says they want more trust, but one person keeps making reassuring promises while avoiding the concrete behavior change the other asked for. The words and the operating choices do not match.",
        [
          "Replace symbolic gestures with actions that reinforce the stated goal.",
          "Choose a small set of consistent behaviors and stop adding moves that send the opposite signal."
        ],
        "Trust grows from coherent action more than from isolated reassuring statements."
      )
    ],
    quiz: [
      q(
        "What gives coherent design its strategic power?",
        [
          "Multiple actions reinforce one another around the same logic",
          "It allows every team to pursue a different priority",
          "It replaces the need for tradeoffs",
          "It depends on one brilliant move more than system fit"
        ],
        0,
        "Coherence matters because fit multiplies the value of individual actions."
      ),
      q(
        "Why can individually smart actions still produce weak strategy?",
        [
          "Because they may conflict with one another instead of forming a fitted system",
          "Because smart actions always reduce flexibility",
          "Because strategy should avoid detailed choices",
          "Because coherence only matters in operations"
        ],
        0,
        "Good parts do not add up automatically if their logic clashes."
      ),
      q(
        "Which example most clearly shows incoherence?",
        [
          "A premium strategy paired with discounts that train customers to expect cheap access",
          "A policy with a few reinforcing actions",
          "A team sequencing its work around one objective",
          "An organization removing a conflicting initiative"
        ],
        0,
        "The mixed signals weaken the position because the design does not fit."
      ),
      q(
        "Why are incentives part of strategic design?",
        [
          "Because they shape whether people actually reinforce the intended logic",
          "Because incentives only matter after execution ends",
          "Because good strategy should ignore behavior",
          "Because incentives eliminate the need for policy"
        ],
        0,
        "A plan is incoherent if the system rewards behavior that contradicts it."
      ),
      q(
        "What is one of the best ways to improve coherence quickly?",
        [
          "Remove a move that conflicts with the strategy's core logic",
          "Add more initiatives so the design feels complete",
          "Reward every team for a different metric",
          "Delay sequencing until all actions are launched"
        ],
        0,
        "Subtraction can increase fit more than addition."
      ),
      q(
        "How does timing affect coherence?",
        [
          "Even good actions can weaken one another if they arrive in the wrong order",
          "Timing matters only in crisis",
          "Timing is separate from design",
          "Timing becomes irrelevant when incentives are aligned"
        ],
        0,
        "Fit depends on sequence as well as on the actions themselves."
      ),
      q(
        "Why can coherent design create durable advantage?",
        [
          "Because rivals can copy one action more easily than a whole fitted system",
          "Because coherence prevents adaptation",
          "Because design matters only to internal morale",
          "Because customers cannot detect inconsistency"
        ],
        0,
        "A system of fit is harder to reproduce than an isolated tactic."
      ),
      q(
        "A company says it values retention but rewards only new sales volume. What is the deepest problem?",
        [
          "The strategy's operating design conflicts with its stated goal",
          "The company is too focused on customers",
          "The policy is already coherent and only needs time",
          "The company has too few initiatives"
        ],
        0,
        "The contradiction is in the system, not just in the words."
      ),
      q(
        "What does coherent design reduce besides confusion?",
        [
          "Friction created by parts that work at cross purposes",
          "The need for diagnosis",
          "The importance of prioritization",
          "The value of operational fit"
        ],
        0,
        "Fit saves energy by reducing internal conflict."
      ),
      q(
        "Which statement best captures the overall lesson?",
        [
          "Strategy is strongest when it is designed as a system of reinforcing choices",
          "Strategy depends mainly on one standout action",
          "Any large plan becomes coherent if it is detailed enough",
          "Design is secondary to rhetorical vision"
        ],
        0,
        "Rumelt is showing that fit itself can be a major source of strategic power."
      )
    ]
  },
  {
    chapterId: "ch10-focus-and-resource-concentration",
    title: "Concentrate Resources Where They Matter Most",
    simpleSummary: [
      "Strategy often requires concentration instead of even distribution. Rumelt argues that scarce resources become powerful when they are focused on the few places that can shift the outcome.",
      "This matters because spreading effort widely can feel fair and safe while producing weak results. Concentration creates force by refusing to treat every issue as equally important."
    ],
    standardSummary: [
      "Strategy often requires concentration of resources, attention, and leadership energy on the few places that matter most. Rumelt emphasizes that this is not recklessness. It is the practical response to scarcity and uneven strategic importance.",
      "The chapter matters because organizations are constantly pulled toward broad distribution. Concentration feels politically difficult, but without it, leverage weakens and the strategy loses the force needed to make a difference."
    ],
    deeperSummary: [
      "Strategy often requires concentration because resources are limited and strategic importance is uneven. Rumelt's point is that strength comes not merely from possessing resources, but from focusing them where they can create a decisive shift instead of being diluted across the whole field.",
      "That matters because concentration is socially costly. It means some worthy activities get less support. Yet without that discipline, organizations preserve harmony at the expense of effect. Concentration is therefore both an analytic and a political act."
    ],
    takeaways: [
      "Scarcity makes concentration necessary.",
      "Even distribution usually weakens leverage.",
      "Concentration is a choice about relative importance.",
      "Force comes from focused commitment."
    ],
    practice: [
      "rank current efforts by strategic importance",
      "cut one low priority commitment",
      "move real time or money to the top priority",
      "state what will receive less support because of the concentration",
      "check whether the focus point has enough force to matter"
    ],
    standardBullets: [
      b(
        "Scarcity makes concentration necessary. Limited means cannot produce much if spread too evenly.",
        "Strategy turns scarcity into force by choosing where not to invest."
      ),
      b(
        "Not all priorities deserve equal support. Strategic importance is uneven by nature.",
        "Treating everything as equal is usually a refusal to choose."
      ),
      b(
        "Concentration creates impact. Focused resources can shift an outcome where thin distribution cannot.",
        "This is one of the clearest ways strategy differs from broad planning."
      ),
      b(
        "Attention is also a resource. Leadership focus has to be concentrated, not only money and staff.",
        "Scattered executive attention often creates scattered execution."
      ),
      b(
        "Concentration demands explicit tradeoffs. Some useful work will receive less support.",
        "That discomfort is part of what makes concentration hard."
      ),
      b(
        "Wide distribution can look prudent while quietly reducing effect. Everyone gets something and no one gets enough.",
        "The result is low force everywhere."
      ),
      b(
        "Concentration often works best in sequence. One front gets force now so another can be addressed later.",
        "This allows strategy to compound rather than fragment."
      ),
      b(
        "A focused push needs protection. Once the concentration point is chosen, competing demands will try to pull resources away.",
        "The strategist has to defend the focus."
      ),
      b(
        "Reserve matters because concentration increases exposure. A focused strategy still needs enough margin to absorb surprise.",
        "Good concentration is disciplined, not brittle."
      ),
      b(
        "Concentrating resources where they matter most is how limited means become strategically powerful.",
        "Without that focus, even large effort can stay strategically weak."
      )
    ],
    deeperBullets: [
      b(
        "Concentration can look unfair because it is unfair by design. It gives more to what matters more.",
        "That is why political resistance often rises just when the strategy becomes sharper."
      ),
      b(
        "A weak concentration point is a hidden failure. Calling something a priority is meaningless if it still lacks enough force to change the result.",
        "Real concentration changes the resource pattern visibly."
      ),
      b(
        "Sequential concentration can create momentum. Winning one critical front can free capacity for the next move.",
        "This is often more effective than trying to advance everywhere at once."
      ),
      b(
        "The danger is confusing concentration with obsession. Focus should serve leverage, not personal attachment.",
        "If the concentrated point stops mattering, the resource pattern should change."
      ),
      b(
        "Concentration reveals seriousness. It turns strategic claims into observable sacrifice and commitment.",
        "That is why resource patterns often tell the truth more clearly than speeches do."
      )
    ],
    examples: [
      ex(
        "ch10-ex01",
        "Semester with one decisive class",
        ["school"],
        "A student has four classes, one scholarship requirement, and a part time job. One difficult class has the biggest effect on the scholarship but keeps receiving the same study time as everything else.",
        [
          "Concentrate the best energy and calendar space on the class that matters most to the outcome.",
          "Let lower consequence work receive enough support to stay stable, not equal support."
        ],
        "Equal effort can feel balanced while still being strategically weak."
      ),
      ex(
        "ch10-ex02",
        "Student group with too many campaigns",
        ["school"],
        "A campus organization is trying to recruit members, run a conference, launch a publication, and expand community outreach in the same month. Leaders keep feeling busy and underwhelmed.",
        [
          "Choose the one effort that most changes the group's position this term.",
          "Concentrate volunteers and leadership attention there, then sequence the next push later."
        ],
        "Concentration turns scattered enthusiasm into force."
      ),
      ex(
        "ch10-ex03",
        "Company with ten strategic priorities",
        ["work"],
        "A leadership team calls ten projects strategic for the year. Each project receives some funding, but none receives enough senior attention or talent to create a real shift.",
        [
          "Reduce the field and fund the few priorities that can actually matter.",
          "Show the concentration in staffing, budget, and leadership time, not only in presentation language."
        ],
        "A diluted priority list is usually evidence that concentration never happened."
      ),
      ex(
        "ch10-ex04",
        "Sales team chasing every segment",
        ["work"],
        "A sales team is pursuing enterprise, mid market, and small business deals with the same messaging and staffing model. The team is working hard but not building enough force anywhere.",
        [
          "Pick the segment where the current advantage is strongest and concentrate there first.",
          "Let the message, talent, and support model follow that decision."
        ],
        "Concentration gives the team a chance to win somewhere meaningful instead of staying thin everywhere."
      ),
      ex(
        "ch10-ex05",
        "Personal budget with symbolic cuts",
        ["personal"],
        "Someone wants to improve savings and keeps making tiny cuts across many categories. The biggest financial pressure still comes from one recurring spending pattern they have not seriously addressed.",
        [
          "Concentrate on the dominant cost driver instead of making many low force changes.",
          "Put the main effort where it can create the largest shift in cash flow."
        ],
        "Small distributed cuts can feel disciplined while failing to touch the real source of pressure."
      ),
      ex(
        "ch10-ex06",
        "Creative project with split attention",
        ["personal"],
        "A creator wants to finish a major project, grow an audience, improve health, and redesign their home setup at the same time. Every area receives a little effort and none makes visible progress.",
        [
          "Choose the one project where concentration would create the biggest payoff right now.",
          "Protect time for that push and accept reduced attention elsewhere for a while."
        ],
        "Concentration is often the difference between feeling committed and becoming effective."
      )
    ],
    quiz: [
      q(
        "Why does strategy often require concentration?",
        [
          "Because limited resources gain power when focused on what matters most",
          "Because equal distribution always lowers morale",
          "Because concentration removes all risk",
          "Because every issue is strategically identical"
        ],
        0,
        "Concentration turns scarcity into force by refusing to spread it thin."
      ),
      q(
        "What is usually the problem with calling too many things top priorities?",
        [
          "No priority gets enough force to create a meaningful shift",
          "The plan becomes more coherent",
          "Resources naturally multiply",
          "Tradeoffs become easier"
        ],
        0,
        "When everything is strategic, nothing receives enough concentration to matter."
      ),
      q(
        "Why can even distribution be strategically weak?",
        [
          "It often leaves every front underpowered",
          "It always wastes resources immediately",
          "It proves the diagnosis is wrong",
          "It eliminates the need for sequencing"
        ],
        0,
        "Broad fairness can produce low force everywhere."
      ),
      q(
        "Which resource should also be concentrated besides money?",
        [
          "Leadership attention",
          "Only inventory",
          "Only physical assets",
          "Only public messaging"
        ],
        0,
        "Executive focus is a scarce resource too, and scattered attention weakens execution."
      ),
      q(
        "What is one reason concentration is politically difficult?",
        [
          "It requires giving less support to some worthwhile activities",
          "It removes all choice from the organization",
          "It always favors the loudest team",
          "It makes reserve impossible"
        ],
        0,
        "Concentration creates visible tradeoffs, which many groups resist."
      ),
      q(
        "Why can sequence improve concentration?",
        [
          "Because one focused win can free resources and momentum for the next move",
          "Because concentrating twice cancels the first focus",
          "Because sequence removes the need for priorities",
          "Because simultaneous pushes are always stronger"
        ],
        0,
        "Sequential focus allows effort to compound instead of fragment."
      ),
      q(
        "What is a sign that a declared priority is not truly concentrated?",
        [
          "Its resource pattern looks almost the same as everything else",
          "It faces resistance from other groups",
          "It has a clear tradeoff attached to it",
          "It receives visible leadership attention"
        ],
        0,
        "Real concentration shows up in resource movement, not only in language."
      ),
      q(
        "Why does a concentrated strategy still need reserve?",
        [
          "Because focus without margin can become brittle when surprises hit",
          "Because reserve makes concentration unnecessary",
          "Because reserve should be spread evenly across all priorities",
          "Because concentration works only in stable settings"
        ],
        0,
        "Good concentration is disciplined without becoming fragile."
      ),
      q(
        "A team says it is focused, but keeps letting side requests pull people off the main push. What is missing?",
        [
          "Protection of the concentration point against competing demands",
          "A bigger initiative list",
          "More even allocation across side work",
          "A refusal to make tradeoffs"
        ],
        0,
        "Focus has to be defended or it dissolves under pressure."
      ),
      q(
        "What is the deepest lesson of resource concentration?",
        [
          "Strategic seriousness appears in what receives enough force to matter and what does not",
          "Any large budget guarantees strategic power",
          "Concentration is mainly a motivational signal",
          "The safest strategy is to protect every activity equally"
        ],
        0,
        "Concentration reveals whether the organization is truly choosing what matters most."
      )
    ]
  },
  {
    chapterId: "ch11-growth-and-healthy-demand",
    title: "Growth Needs Strategic Logic, Not Momentum Alone",
    simpleSummary: [
      "Growth is not a strategy by itself. Rumelt argues that durable growth comes from a real source of demand and advantage, not from expansion for its own sake.",
      "This matters because growth can look like success even when it weakens the system underneath. Strategy asks what kind of growth is healthy, why it should happen, and whether the organization can support it."
    ],
    standardSummary: [
      "Growth is not a strategy by itself because expansion only creates value when it follows a real source of demand and a defensible strategic position. Rumelt's point is that healthy growth comes from logic, fit, and capability, not from momentum worship.",
      "The chapter matters because many leaders treat growth as proof that strategy is working. But growth can also hide weak economics, overload operations, and spread resources into areas where the organization has little advantage."
    ],
    deeperSummary: [
      "Growth is not a strategy by itself because expansion can strengthen or weaken a system depending on why it occurs and what it builds on. Rumelt treats healthy growth as an outcome of underlying strategic strength, not as a substitute for it.",
      "That matters because growth has social prestige. It flatters leaders, attracts attention, and can temporarily hide structural weakness. Real strategy therefore asks which growth deepens advantage, which growth stretches the system too far, and which growth should be refused."
    ],
    takeaways: [
      "Growth is an outcome, not a strategy.",
      "Healthy growth depends on demand, fit, and capability.",
      "Expansion can hide weakness if the underlying logic is poor.",
      "Some growth should be refused."
    ],
    practice: [
      "ask what real source of demand is driving the growth",
      "test whether the system can support more scale cleanly",
      "identify where growth strengthens the advantage",
      "spot one area where growth is adding strain without logic",
      "say no to one expansion move that weakens the system"
    ],
    standardBullets: [
      b(
        "Growth is not strategy. Expansion only helps when it follows a sound strategic logic.",
        "Treating size as the plan is one of the fastest ways to lose discipline."
      ),
      b(
        "Healthy growth starts with real demand. People must genuinely want what the system offers.",
        "Momentum without demand usually fades once novelty or subsidy runs out."
      ),
      b(
        "Growth should build on advantage. Expansion is stronger when it deepens a meaningful difference.",
        "Growth without an edge often becomes expensive imitation."
      ),
      b(
        "Scale can strain the system. Hiring, service, quality, and coordination often get harder as volume rises.",
        "A strategy for growth has to account for those stresses."
      ),
      b(
        "Rapid expansion can hide weak economics. Revenue or activity can rise while the underlying position worsens.",
        "That is why growth needs strategic interpretation, not admiration."
      ),
      b(
        "Some growth strengthens fit. It can create density, learning, trust, or cost advantages when the logic is right.",
        "The strategist needs to know why the added scale helps."
      ),
      b(
        "Not all opportunities deserve pursuit. Entering every adjacent space can dilute attention and identity.",
        "The quality of growth matters more than the quantity."
      ),
      b(
        "Healthy demand is often specific. It comes from a segment, use case, or pattern the organization understands well.",
        "Specific demand is easier to serve well than abstract desire for bigger markets."
      ),
      b(
        "Growth should be read through capability. If the organization cannot support the next stage, expansion can become self defeating.",
        "Capacity is part of strategy, not a side note."
      ),
      b(
        "Good strategy asks what kind of growth improves the position and what kind merely enlarges the problem.",
        "That distinction protects the system from momentum for its own sake."
      )
    ],
    deeperBullets: [
      b(
        "Growth has status value, which makes it easy to overpursue. Leaders may chase it partly because it signals success.",
        "That prestige can weaken judgment if the underlying logic is poor."
      ),
      b(
        "A healthy growth engine is usually narrow before it becomes broad. It starts where demand and capability fit strongly.",
        "Trying to universalize too early often destroys the original advantage."
      ),
      b(
        "Bad growth can consume the very strengths it depends on. Service quality, trust, or culture may erode under unmanaged expansion.",
        "The headline number rises while the foundation weakens."
      ),
      b(
        "Sometimes refusal is strategic strength. Passing on fast but low fit growth can preserve the system for better opportunities later.",
        "That kind of restraint is often underrated."
      ),
      b(
        "The strategist must separate growth as evidence from growth as cause. Expansion can reveal strength, but it does not automatically create it.",
        "Confusing those directions leads to shallow strategy."
      )
    ],
    examples: [
      ex(
        "ch11-ex01",
        "Student organization growing too wide",
        ["school"],
        "A student club gains momentum and immediately tries to launch many new programs. The original weekly event that attracted members is now harder to run well because leaders are spread thin.",
        [
          "Ask which growth actually strengthens the club's core value and which growth only expands obligations.",
          "Protect the program that creates real demand before adding more surface activity."
        ],
        "Growth is healthy when it deepens strength, not when it stretches the system past its ability."
      ),
      ex(
        "ch11-ex02",
        "Tutoring service with unclear demand",
        ["school"],
        "A student tutoring group wants to scale across many subjects, but most repeat demand comes from one difficult chemistry sequence. Expansion into everything else is creating confusion and weak results.",
        [
          "Treat the chemistry demand as the strategic core until another engine is proven.",
          "Grow where the group has clear fit and proof rather than broad ambition."
        ],
        "Healthy growth often starts from a specific source of demand, not from a generic wish to get bigger."
      ),
      ex(
        "ch11-ex03",
        "Startup hiring ahead of logic",
        ["work"],
        "A startup is growing fast and keeps adding staff across every function. Revenue is rising, but churn, onboarding, and margin are all worsening because the growth outpaced the operating model.",
        [
          "Stop treating topline growth as proof that the strategy is healthy.",
          "Find the source of demand and the capability gaps, then let hiring follow that logic instead of momentum."
        ],
        "Expansion can look strong while quietly weakening the business."
      ),
      ex(
        "ch11-ex04",
        "Agency tempted by every client type",
        ["work"],
        "An agency has strong word of mouth in one industry niche, but keeps chasing unrelated clients because each new contract looks like growth. The team is losing efficiency and its best reputation advantages.",
        [
          "Ask which growth deepens the existing edge and which growth dilutes it.",
          "Concentrate on the demand pattern the agency can serve exceptionally well."
        ],
        "Not every revenue opportunity strengthens the position."
      ),
      ex(
        "ch11-ex05",
        "Side project growing in the wrong way",
        ["personal"],
        "A creator sees quick audience growth from short entertainment clips and assumes the whole brand should follow that path. The deeper goal is to build a premium educational business that those clips do not support well.",
        [
          "Separate attention growth from strategically healthy growth.",
          "Favor the content and audience pattern that strengthens the intended business, not just the easiest spike."
        ],
        "Growth only helps when it leads toward the position you actually want."
      ),
      ex(
        "ch11-ex06",
        "Freelance work becoming overload",
        ["personal"],
        "A freelancer keeps taking every new client because revenue is climbing. The schedule is now so overloaded that quality, energy, and repeat business are slipping.",
        [
          "Ask whether the current growth pattern strengthens the business or enlarges the strain.",
          "Refuse low fit work and rebuild around the clients and services that support healthier demand."
        ],
        "Some growth is strategically weak because it damages the system that produced it."
      )
    ],
    quiz: [
      q(
        "Why is growth not a strategy by itself?",
        [
          "Because expansion only helps when it follows real demand and strategic logic",
          "Because growth never improves a position",
          "Because small scale is always better",
          "Because strategy should ignore customers"
        ],
        0,
        "Rumelt treats growth as an outcome that needs explanation, not as an explanation by itself."
      ),
      q(
        "What makes growth healthy strategically?",
        [
          "It deepens advantage and matches the system's real capabilities",
          "It increases activity regardless of fit",
          "It expands into every adjacent opportunity",
          "It raises prestige even if quality drops"
        ],
        0,
        "Healthy growth strengthens the position instead of stretching it blindly."
      ),
      q(
        "Why can rapid growth hide weakness?",
        [
          "Because rising volume can mask deteriorating economics or coordination",
          "Because any growth proves the strategy is sound",
          "Because growth eliminates operational strain",
          "Because customer demand stops mattering during expansion"
        ],
        0,
        "Expansion can make the surface numbers look good while the underlying position worsens."
      ),
      q(
        "What is the best reason to refuse an attractive growth opportunity?",
        [
          "It would dilute focus or weaken the system's core advantage",
          "It would create new demand",
          "It would increase scale",
          "It would attract public attention"
        ],
        0,
        "Saying no can protect the logic that makes future growth healthier."
      ),
      q(
        "A company grows fastest in a segment it does not understand well. What is the strongest response?",
        [
          "Test whether that growth is strategically healthy before building the whole business around it",
          "Assume fast demand automatically means strong fit",
          "Pursue every segment equally",
          "Ignore capability constraints until later"
        ],
        0,
        "The quality of demand matters as much as the quantity."
      ),
      q(
        "Why should growth be linked to advantage?",
        [
          "Because expansion is stronger when it builds on a meaningful difference",
          "Because advantage matters only after growth ends",
          "Because growth eliminates rivalry",
          "Because customers value size more than fit"
        ],
        0,
        "Growth without an edge often becomes expensive and fragile."
      ),
      q(
        "What is one sign that growth is outrunning the strategy?",
        [
          "Service quality and coordination worsen while leaders keep celebrating size",
          "The firm deepens a proven niche",
          "Capacity is matched to demand carefully",
          "Leadership narrows the expansion field"
        ],
        0,
        "When the system weakens under expansion, growth may be harming the position."
      ),
      q(
        "Why is a narrow demand pattern often valuable early?",
        [
          "It gives the organization a specific engine of growth it can understand and serve well",
          "It guarantees permanent dominance",
          "It removes the need for capability building",
          "It makes strategic focus unnecessary"
        ],
        0,
        "Specific demand helps leaders see what is actually working."
      ),
      q(
        "What is the strategic mistake in admiring growth for its own sake?",
        [
          "Confusing a visible outcome with the underlying source of strength",
          "Paying too much attention to customers",
          "Using scale to lower cost",
          "Protecting quality during expansion"
        ],
        0,
        "Growth can reveal strength, but it does not automatically create it."
      ),
      q(
        "Which statement best captures the overall lesson?",
        [
          "The right question is not whether growth is happening, but whether the growth improves the strategic position",
          "Any expansion is proof of healthy demand",
          "Growth should always be maximized before strategy is discussed",
          "The larger system can be ignored if topline numbers rise"
        ],
        0,
        "Rumelt wants leaders to judge growth by logic, not by prestige."
      )
    ]
  },
  {
    chapterId: "ch12-using-coordination",
    title: "Coordination Can Create Hidden Strength",
    simpleSummary: [
      "Coordination can create strength that isolated action cannot. Rumelt argues that when decisions are timed and aligned well, the whole system can produce far more than the parts would produce separately.",
      "This matters because coordination is easy to undervalue when it looks ordinary. Yet a well coordinated set of moves can create hidden power, lower friction, and make a strategy much harder to copy."
    ],
    standardSummary: [
      "Coordination can create hidden strength by aligning actions, timing, and roles so they reinforce one another. Rumelt treats coordination as a source of strategic power because the whole system can become more effective than any one action would suggest on its own.",
      "The chapter matters because coordination is often dismissed as mere management. In reality, coordinated action can create speed, reliability, learning, and force that rivals cannot match if they treat each move as separate."
    ],
    deeperSummary: [
      "Coordination can create hidden strength when multiple parts of a system are arranged to move together in a way that isolated action could not reproduce. Rumelt's point is that some of the strongest strategic advantages are not dramatic inventions but carefully aligned patterns of timing, information, and execution.",
      "That matters because coordinated strength is easy to miss from the outside and hard to imitate once embedded. It often lives in routines, shared understanding, and organizational design. When done well, coordination reduces waste and multiplies the effect of ordinary actions."
    ],
    takeaways: [
      "Coordination can be a source of strategic power.",
      "Alignment of timing, roles, and actions creates hidden strength.",
      "What looks like ordinary management can create real advantage.",
      "Coordinated systems are often harder to copy than isolated tactics."
    ],
    practice: [
      "identify two actions that would be stronger if timed together",
      "clarify one handoff or role that weakens coordination",
      "align one incentive with the desired sequence",
      "create one shared rhythm that reduces confusion",
      "remove one step that forces teams to work at cross purposes"
    ],
    standardBullets: [
      b(
        "Coordination can create force beyond individual effort. Aligned moves often outperform stronger isolated moves.",
        "The gain comes from fit and timing, not from magic."
      ),
      b(
        "Shared timing matters. Actions that happen in the right sequence can raise one another's value.",
        "Poor timing can waste otherwise good work."
      ),
      b(
        "Role clarity supports coordination. People need to know where their work connects to the whole.",
        "Confused ownership is one of the fastest ways to lose hidden strength."
      ),
      b(
        "Coordination reduces friction. It cuts duplication, delay, and contradiction across the system.",
        "That saved friction becomes strategic energy."
      ),
      b(
        "Ordinary routines can create extraordinary advantage. What looks simple on the surface may be hard to copy in full.",
        "The power often lives in the pattern, not the headline feature."
      ),
      b(
        "Information flow is part of coordination. Good decisions travel more effectively when the system is built for it.",
        "Weak handoffs weaken the whole pattern."
      ),
      b(
        "Coordination is often invisible when it works well. People notice the outcome more than the aligned system behind it.",
        "That invisibility is one reason it is undervalued."
      ),
      b(
        "The payoff is compounding. Each aligned action makes the next action easier and more effective.",
        "This is what turns coordination into hidden strength."
      ),
      b(
        "Rivals can copy single actions faster than coordinated systems. Embedded fit takes longer to reproduce.",
        "That is why coordination can create durable advantage."
      ),
      b(
        "Good strategy uses coordination deliberately rather than treating it as background administration.",
        "The aligned system itself can become a major source of power."
      )
    ],
    deeperBullets: [
      b(
        "Coordination often depends on stable rules and rhythms. Ad hoc effort can mimic it briefly but rarely sustain it.",
        "The deeper strength lies in repeatable alignment."
      ),
      b(
        "Some coordination advantages are cultural. Shared expectations let people act correctly with less explicit control.",
        "That lowers delay and makes the system faster under pressure."
      ),
      b(
        "The absence of visible heroics can be a clue that coordination is strong. Smooth systems often hide the work that made them smooth.",
        "Observers may misread this as simplicity rather than capability."
      ),
      b(
        "Poor coordination taxes talent. Even strong people underperform when the surrounding pattern is disordered.",
        "That is why strategy has to care about system alignment, not only individual quality."
      ),
      b(
        "Coordination becomes especially powerful when linked to leverage. A well timed, well aligned response can unlock more than any isolated effort of the same size.",
        "This is where design and coordination reinforce one another."
      )
    ],
    examples: [
      ex(
        "ch12-ex01",
        "School event with perfect timing",
        ["school"],
        "A student organization usually promotes events too late and scrambles volunteers the day of. This semester it synchronizes venue confirmation, speaker outreach, promotion, and volunteer roles on one shared schedule and turnout jumps.",
        [
          "Treat the gain as coordinated strength rather than luck.",
          "Keep the shared timeline and role clarity because the alignment itself is part of the advantage."
        ],
        "The hidden strength came from many ordinary actions fitting together at the right time."
      ),
      ex(
        "ch12-ex02",
        "Study group that finally clicks",
        ["school"],
        "A study group used to meet without structure, so everyone repeated the same material and key questions went unanswered. After assigning prep topics and sequencing the meeting, the same group starts learning much faster.",
        [
          "Notice that the improvement came from coordination more than from extra effort.",
          "Keep the role clarity and sequence because those are the source of the added strength."
        ],
        "Coordination turns scattered contribution into compound value."
      ),
      ex(
        "ch12-ex03",
        "Launch team with aligned handoffs",
        ["work"],
        "A product launch used to create friction because marketing, support, and engineering worked on different rhythms. Once the teams align messaging, release timing, and issue escalation, the launch feels calmer and converts better.",
        [
          "Preserve the shared timing and handoff rules instead of treating them as one time luck.",
          "The coordination pattern is part of the strategy, not just project hygiene."
        ],
        "What looks like smooth execution often hides a coordinated system that rivals may struggle to copy."
      ),
      ex(
        "ch12-ex04",
        "Service business with broken coordination",
        ["work"],
        "A service business has talented people in every function, but clients still experience delays because scheduling, delivery, and follow up are poorly connected. The talent is there and the pattern is weak.",
        [
          "Fix the rhythm and handoffs before adding more talent.",
          "Coordination is the leverage point because the current disorder is taxing the whole system."
        ],
        "Poor coordination can waste strength that the organization already has."
      ),
      ex(
        "ch12-ex05",
        "Household routine that works together",
        ["personal"],
        "Morning stress keeps hitting a household because lunches, keys, clothes, and departure times are handled separately. Once the family sets one evening routine and one morning sequence, the same people move through the day with much less friction.",
        [
          "Treat the routine as coordinated design rather than a collection of chores.",
          "Keep the shared sequence because the gain comes from how the parts fit together."
        ],
        "Coordination can create quiet strength in ordinary life by removing repeated friction."
      ),
      ex(
        "ch12-ex06",
        "Creative partnership with shared rhythm",
        ["personal"],
        "Two collaborators keep missing deadlines even though both work hard. The problem is that drafts, reviews, and revisions arrive unpredictably. Once they agree on a fixed weekly rhythm, output quality and trust both improve.",
        [
          "Name the lack of rhythm as the issue rather than blaming effort alone.",
          "Use a repeatable sequence so each person's work arrives when the other can use it."
        ],
        "Coordination often creates strength by making one person's work more usable to another."
      )
    ],
    quiz: [
      q(
        "Why can coordination create hidden strength?",
        [
          "Because aligned actions, timing, and roles can produce more than isolated effort",
          "Because coordination replaces the need for strategy",
          "Because only large organizations can coordinate",
          "Because hidden strength comes mainly from secrecy"
        ],
        0,
        "Coordination multiplies effect through fit and timing."
      ),
      q(
        "What is one reason coordination is easy to undervalue?",
        [
          "It often looks ordinary or invisible when it is working well",
          "It always depends on expensive technology",
          "It matters only after growth",
          "It reduces the need for role clarity"
        ],
        0,
        "Smooth systems often hide the coordinated work that made them smooth."
      ),
      q(
        "Which example best shows coordination as a source of power?",
        [
          "Several teams timing their moves so each one raises the value of the others",
          "One team working harder while others stay disconnected",
          "A plan that rewards every function for different priorities",
          "A project that adds tasks without changing sequence"
        ],
        0,
        "The strength comes from aligned action, not isolated intensity."
      ),
      q(
        "Why is role clarity important to coordination?",
        [
          "People need to know how their work connects to the whole system",
          "Role clarity mainly improves morale and little else",
          "Coordination works best when ownership is vague",
          "Role clarity matters only in small teams"
        ],
        0,
        "Confused ownership is a common cause of weak coordination."
      ),
      q(
        "How does coordination reduce friction?",
        [
          "It cuts duplication, delay, and contradiction across the system",
          "It removes all need for leadership",
          "It eliminates the need for timing decisions",
          "It makes every action independent"
        ],
        0,
        "Less friction means more of the system's effort reaches the real objective."
      ),
      q(
        "Why can coordination be hard for rivals to copy?",
        [
          "Because reproducing a fitted system takes longer than copying one visible move",
          "Because coordination depends on slogans alone",
          "Because coordination never changes over time",
          "Because information flow does not matter in coordination"
        ],
        0,
        "The advantage often lives in the pattern, not in any one element."
      ),
      q(
        "A company has strong talent but weak handoffs. What is the strategic diagnosis?",
        [
          "Poor coordination is taxing the system's existing strengths",
          "Talent no longer matters once coordination problems appear",
          "The company should ignore process and hire faster",
          "The best response is to widen priorities"
        ],
        0,
        "Disorder can make strong people look weaker than they are."
      ),
      q(
        "Why are shared rhythms useful?",
        [
          "They make alignment repeatable instead of relying on constant improvisation",
          "They replace the need for any judgment",
          "They matter only in manufacturing",
          "They always reduce strategic flexibility"
        ],
        0,
        "Stable rhythms help turn coordination into a durable capability."
      ),
      q(
        "What is a sign that coordination is being mistaken for ordinary administration?",
        [
          "Leaders ignore aligned timing and handoffs even though they drive results",
          "Teams review their system fit regularly",
          "The organization treats routines as a source of strength",
          "Shared expectations make action faster under pressure"
        ],
        0,
        "If the aligned pattern drives performance, it deserves strategic attention."
      ),
      q(
        "Which statement best captures the overall lesson?",
        [
          "A well aligned system can create strategic power that no isolated action could match",
          "Coordination is secondary to individual brilliance",
          "Only dramatic innovations create hidden strength",
          "Good strategy should minimize shared timing"
        ],
        0,
        "Rumelt shows that hidden strength often comes from aligned patterns, not heroic moves."
      )
    ]
  }
];
const CHAPTERS_PART_THREE = [
  {
    chapterId: "ch13-using-dynamics",
    title: "Read Momentum, Timing, and Change",
    simpleSummary: [
      "Good strategy pays attention to momentum, timing, and change rather than treating the environment as fixed. Rumelt argues that strategic judgment improves when leaders read how the situation is moving, not just what it looks like at one moment.",
      "This matters because the same move can be smart early and weak late. Reading dynamics helps you spot windows, turning points, and shifts that change where leverage lives."
    ],
    standardSummary: [
      "Good strategy reads momentum, timing, and change because the environment is dynamic, not static. Rumelt emphasizes that leaders need to see where forces are building, where timing windows are opening or closing, and how current movement may alter future possibilities.",
      "The chapter matters because strategy often fails through bad timing rather than bad ideas alone. A move that fits the situation poorly in sequence or speed can waste resources, miss openings, or lock the organization into reactive behavior."
    ],
    deeperSummary: [
      "Good strategy reads momentum, timing, and change by asking how the situation is evolving and which shifts could alter strategic value. Rumelt's point is that leaders should not only ask what is true now. They should ask what is gaining force, what is decaying, and where a small timing difference could produce a large positional difference.",
      "That matters because leverage is dynamic. Momentum can carry a good move further, while inertia can delay needed response until the window closes. Strategic judgment therefore includes sensitivity to pace, sequence, and turning points, not only analytical clarity about the current state."
    ],
    takeaways: [
      "Strategy should read movement, not only the snapshot.",
      "Timing changes the value of action.",
      "Momentum and turning points affect leverage.",
      "Dynamic environments reward timely choice."
    ],
    practice: [
      "name one force that is building and one that is fading",
      "identify the window that matters most right now",
      "ask what move becomes weaker if delayed",
      "look for the turning point that could change the field",
      "adjust one plan to fit the current pace of change"
    ],
    standardBullets: [
      b(
        "A situation is not only a snapshot. Strategy has to read motion as well as position.",
        "What matters may be less about where things are and more about where they are headed."
      ),
      b(
        "Timing changes value. The same move can be powerful early and weak once the moment passes.",
        "Good strategy respects windows instead of assuming opportunities stay open."
      ),
      b(
        "Momentum can create leverage. A developing trend may carry a well timed action further than expected.",
        "That is why momentum should be read, not merely admired."
      ),
      b(
        "Turning points deserve attention. Small changes can mark the moment when the field is about to behave differently.",
        "Missing that moment can be more costly than missing a static fact."
      ),
      b(
        "Pace matters. Some situations punish delay while others punish premature action.",
        "The strategist has to judge not just direction, but speed."
      ),
      b(
        "Dynamic reading improves resource use. It helps leaders commit when conditions are favorable and hold back when they are not.",
        "This prevents both wasteful rushing and lazy waiting."
      ),
      b(
        "Momentum is not permanence. What is rising now can still reverse.",
        "Strategy needs moving judgment, not trend worship."
      ),
      b(
        "Timing can shape competition. Acting first or acting after the field clarifies may each be right in different settings.",
        "The key is understanding what the moment rewards."
      ),
      b(
        "Change shifts leverage points. A constraint or advantage that mattered yesterday may matter less after the environment moves.",
        "This is why strategy has to keep rereading the system."
      ),
      b(
        "Reading dynamics turns strategy from a static plan into an active judgment about movement, sequence, and opportunity.",
        "That is how leaders avoid being trapped by yesterday's logic."
      )
    ],
    deeperBullets: [
      b(
        "Static analysis can create false confidence. A plan that fits today's picture may fail if the picture is already moving away from it.",
        "Good strategy therefore treats time as part of the diagnosis."
      ),
      b(
        "Momentum often attracts imitation, which can also change its value. A trend becomes less useful once everyone piles into it.",
        "The timing advantage may lie in entering early or in staying out once the field crowds."
      ),
      b(
        "Turning points are easier to name after the fact than during the shift. Leaders need cues that help them notice change while it is still ambiguous.",
        "That is one reason repeated environmental reading matters."
      ),
      b(
        "Sometimes the strategic move is to prepare for change before the market validates it publicly. Waiting for certainty can hand away the timing advantage.",
        "Judgment under uncertainty is part of dynamic strategy."
      ),
      b(
        "A good dynamic read combines patience and speed. The art is knowing what should ripen and what should be acted on before it closes.",
        "That balance is one mark of mature strategic judgment."
      )
    ],
    examples: [
      ex(
        "ch13-ex01",
        "Student election with a closing window",
        ["school"],
        "A student campaign sees interest rising after one debate, but keeps waiting to organize volunteers because it wants a more polished plan first. The enthusiasm starts fading before the team acts.",
        [
          "Treat the surge as a timing window, not just a good sign.",
          "Use the momentum while it is still fresh and accept a cleaner but less delayed response."
        ],
        "Momentum has value only if the strategy can convert it before it dissipates."
      ),
      ex(
        "ch13-ex02",
        "Course workload shift",
        ["school"],
        "A student notices one class is about to become much harder after midterm because the project phase starts. They keep studying the course that just produced the last exam because it feels urgent from the recent stress.",
        [
          "Look ahead to the change in difficulty rather than reacting only to the last pressure point.",
          "Move preparation toward the class whose demands are rising before the bottleneck becomes visible to everyone."
        ],
        "Reading dynamics means responding to where the pressure is going, not only where it was."
      ),
      ex(
        "ch13-ex03",
        "Market shift in customer expectation",
        ["work"],
        "A software firm sees customers starting to expect faster implementation after a rival changes the category norm. The team keeps treating setup speed as a minor issue because current contracts are still closing.",
        [
          "Read the shift as an early change in the field, not as a distant possibility.",
          "Move before the demand becomes universal and more expensive to answer."
        ],
        "A developing change can matter strategically before the lagging metrics fully show it."
      ),
      ex(
        "ch13-ex04",
        "Late response to internal momentum",
        ["work"],
        "A product line finally shows strong traction after months of testing, but leadership keeps spreading investment evenly because it wants more proof. Competitors start copying the offer while the company is still hesitating.",
        [
          "Recognize when caution has turned into timing loss.",
          "Concentrate resources while the momentum still offers an advantage rather than after the field has adjusted."
        ],
        "Sometimes delay wastes a good idea by arriving after the window of asymmetric gain has closed."
      ),
      ex(
        "ch13-ex05",
        "Personal habit change at the right time",
        ["personal"],
        "Someone wants to reset a bad routine but keeps postponing until life feels calmer. A schedule change next month will actually make the old routine even harder to break.",
        [
          "Use the current transition as a leverage point instead of waiting for perfect calm.",
          "Act while the pattern is already in motion and easier to redesign."
        ],
        "Timing can make change easier or harder even when the person stays the same."
      ),
      ex(
        "ch13-ex06",
        "Friendship tension nearing a turning point",
        ["personal"],
        "A friendship has been drifting and one conversation could either repair it or let the distance harden. One person keeps waiting for a perfectly comfortable moment that never arrives.",
        [
          "Notice that the relationship is moving even while nothing explicit is said.",
          "Choose a timely conversation before the silence itself becomes the new default."
        ],
        "Dynamic situations often change because of delay as much as because of action."
      )
    ],
    quiz: [
      q(
        "Why does strategic judgment need to read dynamics rather than only the current snapshot?",
        [
          "Because leverage and opportunity change as the situation moves",
          "Because current facts do not matter",
          "Because timing always outweighs diagnosis",
          "Because momentum guarantees success"
        ],
        0,
        "What matters strategically often depends on where the field is going, not just where it is."
      ),
      q(
        "What is a timing window?",
        [
          "A period when a move has unusual value before conditions change",
          "Any deadline set by management",
          "A sign that speed always beats caution",
          "A moment when strategy becomes unnecessary"
        ],
        0,
        "Timing windows matter because strategic value is often temporary."
      ),
      q(
        "Why can a good idea still fail strategically?",
        [
          "It may arrive too early, too late, or at the wrong pace for the changing situation",
          "Ideas fail only when the diagnosis is absent",
          "Good ideas never fail if the team works hard",
          "The environment rarely changes enough to matter"
        ],
        0,
        "Timing and sequence can ruin an otherwise sensible move."
      ),
      q(
        "What makes a turning point important?",
        [
          "It can change how the field behaves and where leverage sits",
          "It proves momentum will continue forever",
          "It removes the need for resource concentration",
          "It matters only in markets, not in organizations"
        ],
        0,
        "A turning point can alter the structure the strategy is operating in."
      ),
      q(
        "Why is momentum useful but dangerous to misread?",
        [
          "It can magnify a move, but it can also reverse or attract imitators",
          "It guarantees that any strategy is correct",
          "It matters only after the strategy is complete",
          "It replaces the need for timing"
        ],
        0,
        "Momentum is part of the read, not a substitute for judgment."
      ),
      q(
        "When is delay especially costly?",
        [
          "When the value of the move depends on acting before the field adjusts",
          "When the environment is static and calm",
          "When the strategy has reserve",
          "When the organization has already chosen to wait"
        ],
        0,
        "Delay is costly when it lets the timing advantage disappear."
      ),
      q(
        "What is one reason to prepare before change is fully confirmed?",
        [
          "Waiting for certainty can surrender the timing advantage",
          "Preparation is only useful after the shift is complete",
          "Uncertainty means no action should ever begin",
          "Preparation matters less than observing momentum"
        ],
        0,
        "Dynamic strategy often requires moving before the signal is completely comfortable."
      ),
      q(
        "A leader keeps using last quarter's logic even though the environment is changing quickly. What is the core problem?",
        [
          "Static analysis is replacing dynamic judgment",
          "The leader is concentrating resources too much",
          "The leader is reading timing too carefully",
          "The environment should be ignored"
        ],
        0,
        "A strategy can become stale simply because the field moved and the logic did not."
      ),
      q(
        "What is the strongest use of a dynamic read?",
        [
          "To match action to the pace, window, and direction of change",
          "To avoid choosing until the picture is perfectly stable",
          "To copy whatever trend is rising fastest",
          "To treat every small shift as a major turning point"
        ],
        0,
        "Dynamic reading helps leaders choose when and how force should be used."
      ),
      q(
        "Which statement best captures the overall lesson?",
        [
          "Strategy is partly a judgment about movement and timing, not only about static fit",
          "A good static plan is enough for any changing situation",
          "Momentum matters more than leverage",
          "Timing is useful only after execution begins"
        ],
        0,
        "Rumelt is expanding strategy from a snapshot to a living read of the field."
      )
    ]
  },
  {
    chapterId: "ch14-inertia-and-entropy",
    title: "Organizations Drift Without Strategic Energy",
    simpleSummary: [
      "Organizations drift through inertia and entropy unless leaders keep renewing direction and standards. Rumelt argues that strategy has to overcome the natural pull toward habit, fragmentation, and decay.",
      "This matters because good plans do not stay good automatically. Without ongoing energy and attention, even capable organizations slide away from coherence."
    ],
    standardSummary: [
      "Organizations drift through inertia and entropy unless leaders keep direction, standards, and attention alive. Rumelt uses these forces to explain why strategy is not only about choosing a path but also about sustaining alignment against the natural pull of routine and disorder.",
      "The chapter matters because decline often appears quietly. Systems that once fit well accumulate clutter, habits harden, and energy diffuses. Strategic leadership has to counter that drift deliberately instead of assuming momentum will preserve coherence."
    ],
    deeperSummary: [
      "Organizations drift through inertia and entropy because established routines resist change and complex systems naturally lose order over time. Rumelt treats these not as excuses but as real opposing forces that strategy must overcome if it wants coherence to persist.",
      "That matters because strategic decay is usually incremental. Nothing looks disastrous at first. Standards soften, priorities multiply, and yesterday's design is preserved past its usefulness. Leaders therefore need to supply not only direction but the renewing energy that keeps the organization from relaxing back into drift."
    ],
    takeaways: [
      "Inertia and entropy pull organizations away from strategy.",
      "Coherence decays if it is not renewed.",
      "Leadership has to keep standards and direction alive.",
      "Drift is often gradual before it becomes obvious."
    ],
    practice: [
      "identify one routine that is being preserved by inertia",
      "spot one sign of strategic clutter or decay",
      "renew one standard that has softened",
      "remove one practice that no longer fits the strategy",
      "focus leadership attention on the place where drift is growing"
    ],
    standardBullets: [
      b(
        "Inertia resists change. Existing routines and commitments make organizations slow to move.",
        "That resistance is one reason strategic shifts require more than a good memo."
      ),
      b(
        "Entropy creates drift. Over time, systems accumulate clutter, inconsistency, and loss of fit.",
        "Without deliberate renewal, coherence decays naturally."
      ),
      b(
        "Past success can strengthen inertia. What once worked becomes harder to question.",
        "That is why strong histories can produce weak adaptation."
      ),
      b(
        "Strategic energy has to be renewed. Direction, standards, and follow through all need active support.",
        "Otherwise the organization slides back toward routine."
      ),
      b(
        "Drift is usually gradual. Few systems collapse all at once.",
        "The danger lies in the accumulation of small losses of fit."
      ),
      b(
        "Clutter is a warning sign. Extra processes, reports, and exceptions often reveal growing entropy.",
        "Complexity becomes expensive when it no longer serves the strategy."
      ),
      b(
        "Pruning matters as much as adding. Leaders need to remove outdated practices to preserve coherence.",
        "Subtraction is one way to fight entropy directly."
      ),
      b(
        "Standards shape whether drift spreads. Once standards soften in one place, inconsistency multiplies.",
        "Strategic discipline depends on what the system continues to insist on."
      ),
      b(
        "Inertia can protect or trap. Stable routines help execution until the environment changes enough that the old pattern becomes a cost.",
        "Leaders need judgment about when stability has become rigidity."
      ),
      b(
        "Strategy survives only if someone keeps pushing against the natural pull toward disorder and habit.",
        "That is why sustaining coherence is real strategic work."
      )
    ],
    deeperBullets: [
      b(
        "Entropy often hides under busyness. Teams keep working hard while the system quietly loses clarity and fit.",
        "Effort can therefore mask drift rather than cure it."
      ),
      b(
        "Exceptions are one of the main carriers of decay. Each local accommodation may look harmless while the overall design weakens.",
        "This is how entropy often enters without an official decision."
      ),
      b(
        "Because inertia lives in routines, changing strategy often means changing habits, not only announcing priorities.",
        "The organization moves when its regular behavior moves."
      ),
      b(
        "Strategic renewal is partly emotional labor. Leaders have to disturb comfortable routines and defend sharper standards.",
        "That demand is one reason drift is easier than renewal."
      ),
      b(
        "The deepest danger is mistaking continuity for strength. A system can look stable while quietly losing strategic relevance.",
        "Survival of the routine is not the same as survival of the strategy."
      )
    ],
    examples: [
      ex(
        "ch14-ex01",
        "Club repeating an old format",
        ["school"],
        "A student club keeps running the same meeting format because it used to work well. Attendance and energy are fading, but leaders keep preserving the routine because it feels familiar and safe.",
        [
          "Treat the familiar routine as inertia, not as proof of current fit.",
          "Update or remove the parts that no longer serve the club's present purpose."
        ],
        "Past success can keep an organization loyal to a format long after the environment has changed."
      ),
      ex(
        "ch14-ex02",
        "Course team buried in process clutter",
        ["school"],
        "A student publication has added so many approval steps over time that each issue now moves slowly and confuses new editors. Everyone is busy, but the system has clearly accumulated entropy.",
        [
          "Map the extra steps and ask which ones still serve the strategy.",
          "Prune the process until the workflow regains clarity and speed."
        ],
        "Entropy often enters through additions that were never later cleaned up."
      ),
      ex(
        "ch14-ex03",
        "Company living on old routines",
        ["work"],
        "A firm keeps operating around a market logic that worked five years ago. Teams still follow the old approval rhythms and reporting structure even though customers now expect much faster response.",
        [
          "Name the gap between current routine and current reality directly.",
          "Change the operating habits that carry the old strategy instead of only announcing new goals."
        ],
        "Inertia is powerful because it lives inside daily routines, not only in official statements."
      ),
      ex(
        "ch14-ex04",
        "Growing entropy in a service team",
        ["work"],
        "A service organization keeps adding exceptions to satisfy important accounts. Over time, the exceptions become the norm and the system grows harder to manage, train, and improve.",
        [
          "Treat the exception pattern as strategic decay, not as a sign of flexibility.",
          "Restore clear standards and cut the custom work that no longer justifies its complexity."
        ],
        "Entropy often arrives through many small accommodations that weaken the original design."
      ),
      ex(
        "ch14-ex05",
        "Personal routine sliding into clutter",
        ["personal"],
        "Someone once had a clean weekly planning routine, but over months they added scattered notes, extra apps, and many small reminders. The system now feels heavy and is used less consistently.",
        [
          "Recognize the pattern as entropy rather than lack of discipline.",
          "Prune the system back to the few practices that still create clarity."
        ],
        "Even personal systems drift when they are not renewed and simplified."
      ),
      ex(
        "ch14-ex06",
        "Family habits running on inertia",
        ["personal"],
        "A family keeps following a schedule built around old constraints that no longer apply. The routine is creating stress now, but nobody questions it because it has become normal.",
        [
          "Ask whether the routine is still serving the current reality or only surviving by habit.",
          "Update the schedule around the present needs instead of preserving it out of familiarity."
        ],
        "Inertia feels natural precisely because it turns yesterday's design into today's unquestioned default."
      )
    ],
    quiz: [
      q(
        "What is inertia in strategic terms?",
        [
          "The resistance created by established routines and commitments",
          "The same thing as momentum in a favorable trend",
          "A sign that the strategy is fully coherent",
          "A temporary dip in morale"
        ],
        0,
        "Inertia is the pull of the existing pattern against change."
      ),
      q(
        "What is entropy in organizations?",
        [
          "The gradual accumulation of clutter, inconsistency, and loss of fit",
          "A sudden failure caused by one weak link",
          "The advantage created by coordination",
          "A form of demand growth"
        ],
        0,
        "Entropy is the natural drift toward disorder if no one renews the system."
      ),
      q(
        "Why can past success increase strategic risk?",
        [
          "Because it can harden routines that become harder to question later",
          "Because success always destroys advantage immediately",
          "Because growth removes inertia",
          "Because successful systems no longer need standards"
        ],
        0,
        "What once worked can become the reason change is resisted."
      ),
      q(
        "What is a common early sign of entropy?",
        [
          "Extra processes and exceptions that no longer support the strategy",
          "Clear pruning of outdated work",
          "Stronger role clarity",
          "More focused resource concentration"
        ],
        0,
        "Clutter often reveals that the system is losing coherence."
      ),
      q(
        "Why is drift hard to notice?",
        [
          "Because it usually accumulates gradually rather than appearing all at once",
          "Because entropy only shows up in failing organizations",
          "Because leaders can see it instantly",
          "Because routines never affect strategy"
        ],
        0,
        "Small losses of fit can build for a long time before they become undeniable."
      ),
      q(
        "What is one of the best ways to fight entropy?",
        [
          "Prune practices and exceptions that no longer fit the strategy",
          "Add more process layers to stabilize the system",
          "Treat all old routines as permanent strengths",
          "Ignore clutter until performance collapses"
        ],
        0,
        "Subtraction is often essential to preserving coherence."
      ),
      q(
        "Why do leaders need to renew strategic energy actively?",
        [
          "Because coherence does not preserve itself against routine and disorder",
          "Because strategy becomes automatic once chosen",
          "Because inertia disappears in large organizations",
          "Because standards naturally tighten over time"
        ],
        0,
        "Direction and standards decay unless someone keeps reinforcing them."
      ),
      q(
        "A team is working hard but the system keeps getting more complicated and less aligned. What is the likely issue?",
        [
          "Busyness is masking entropy instead of reversing it",
          "The team needs more exceptions",
          "The strategy is becoming more coherent",
          "Inertia has already been solved"
        ],
        0,
        "Effort does not automatically remove drift if the design keeps decaying."
      ),
      q(
        "When does inertia become strategically dangerous?",
        [
          "When stability hardens into rigidity after the environment has changed",
          "When routines improve coordination",
          "When the system keeps clear standards",
          "When the strategy is still fit for the context"
        ],
        0,
        "Stability helps until it starts preserving the wrong pattern."
      ),
      q(
        "Which statement best captures the overall lesson?",
        [
          "Strategy needs ongoing renewal because organizations naturally drift away from coherence",
          "A good strategy stays good automatically",
          "Entropy matters only in chaotic firms",
          "The safest leadership move is to preserve continuity at all costs"
        ],
        0,
        "Rumelt's point is that sustaining strategy requires energy against habit and disorder."
      )
    ]
  },
  {
    chapterId: "ch15-putting-strategy-to-work",
    title: "Strategy Must Survive Contact With Reality",
    simpleSummary: [
      "Strategy is only real when it changes choices, resources, and action under actual constraints. Rumelt argues that a plan has to survive contact with budgets, staffing, behavior, and feedback, not just sound right in discussion.",
      "This matters because many strategies exist only in presentations. Reality tests reveal whether the diagnosis is strong enough and whether the organization is willing to act on it."
    ],
    standardSummary: [
      "Strategy is only real when it survives contact with budgets, staffing, incentives, and day to day choices. Rumelt stresses that execution is not separate from strategy. It is one of the main places where strategic quality is exposed.",
      "The chapter matters because plans can appear coherent while remaining operationally empty. Once the strategy has to shape real behavior, gaps in diagnosis, weak commitment, and missing coordination become visible very quickly."
    ],
    deeperSummary: [
      "Strategy is only real when it survives contact with reality by changing what the organization actually does under constraint. Rumelt's point is that strategy should be visible in resource flows, operating choices, sequencing, and feedback, not merely in stated intent.",
      "That matters because reality is a harsh but useful examiner. It shows whether leaders believed the strategy enough to fund it, whether the system can carry it, and whether the initial logic was strong enough to hold up once actual consequences appear."
    ],
    takeaways: [
      "A strategy becomes real when behavior changes.",
      "Budgets, staffing, and incentives reveal true priorities.",
      "Execution exposes strategic weakness quickly.",
      "Feedback should refine the strategy, not be ignored."
    ],
    practice: [
      "check where the strategy appears in budget and calendar choices",
      "identify one behavior that should change if the strategy is real",
      "align one incentive or resource flow with the plan",
      "test one assumption early in execution",
      "revise the plan where reality disproves the logic"
    ],
    standardBullets: [
      b(
        "A strategy becomes real through changed behavior. If choices stay the same, the strategy is still mostly talk.",
        "Operational change is evidence that the plan has real force."
      ),
      b(
        "Budgets and staffing reveal belief. Resource patterns usually tell the truth about what the organization really prioritizes.",
        "A funded strategy is more real than a celebrated one."
      ),
      b(
        "Execution tests the diagnosis. If the plan fails quickly, the underlying logic may need revision.",
        "Reality is a feedback source, not just a compliance hurdle."
      ),
      b(
        "Incentives must fit the strategy. People usually follow the system they are rewarded by.",
        "Misaligned incentives can quietly nullify a good plan."
      ),
      b(
        "Early tests matter. Small contact with reality can reveal weaknesses before the organization makes a larger commitment.",
        "This protects strategy from expensive illusion."
      ),
      b(
        "Resource flow is part of strategy. The plan should show up in schedules, hiring, capital, and management attention.",
        "Otherwise execution remains trapped in the old pattern."
      ),
      b(
        "Adaptation is not abandonment. Revising a strategy after contact with reality can be a sign of strength.",
        "The key is to update the logic, not to retreat into vagueness."
      ),
      b(
        "The strategy should be visible in decision rules. Frontline choices need to reflect the priorities the plan created.",
        "If local decisions do not change, the strategy has not traveled far enough."
      ),
      b(
        "Presentation quality is a poor substitute for operational proof. A clean deck cannot carry a weak implementation logic for long.",
        "Reality forces the plan to become specific."
      ),
      b(
        "Strategy survives contact with reality when it can alter action, absorb feedback, and still hold coherent direction.",
        "That is what makes it usable rather than decorative."
      )
    ],
    deeperBullets: [
      b(
        "Reality often exposes commitment before it exposes theory. Leaders may discover that they liked the strategy in words more than in sacrifice.",
        "Resource reluctance is therefore a strategic signal."
      ),
      b(
        "Small implementation frictions can reveal deeper design flaws. A handoff failure or staffing conflict may point back to a weak policy.",
        "Execution details often carry diagnostic value."
      ),
      b(
        "Some strategies fail because the organization never translated them into local decision rules. The idea stays central while the choices stay old.",
        "This is a common gap between top level strategy and daily work."
      ),
      b(
        "Testing assumptions early is a strategic act. It lets the organization learn before full scale commitment hardens mistakes.",
        "Early contact with reality is cheaper than late contact."
      ),
      b(
        "The goal is not rigid execution. It is disciplined execution that can learn without dissolving into drift.",
        "That balance is what keeps strategy both real and adaptive."
      )
    ],
    examples: [
      ex(
        "ch15-ex01",
        "Study plan that never hits the calendar",
        ["school"],
        "A student says the strategy is to raise a difficult grade by practicing every morning. The plan sounds strong, but the calendar stays full of late nights and the morning block never gets protected.",
        [
          "Treat the unchanged schedule as evidence that the strategy is not real yet.",
          "Move sleep, calendar blocks, and environment around the stated plan so behavior can actually follow it."
        ],
        "A strategy becomes real when it appears in the lived pattern of action, not only in intention."
      ),
      ex(
        "ch15-ex02",
        "Project strategy with no resource shift",
        ["school"],
        "A student team says the strategy is to raise the quality of its final presentation by rehearsing more. The team still spends most meetings making slides and leaves no rehearsal time protected before the deadline.",
        [
          "Look at where the time is actually going rather than trusting the stated priority.",
          "Reallocate meetings and task ownership so the strategy shows up in the work pattern."
        ],
        "If resources do not move, the strategy has not yet survived contact with reality."
      ),
      ex(
        "ch15-ex03",
        "Company strategy not reflected in budget",
        ["work"],
        "A company declares retention the top priority for the year, but most new funding still goes to acquisition. Teams keep hearing the strategy while watching the old resource pattern continue.",
        [
          "Read the budget as the real strategy signal.",
          "If retention is serious, staffing, product work, and executive attention need to move accordingly."
        ],
        "Resource flows often reveal whether a strategy exists in substance or only in language."
      ),
      ex(
        "ch15-ex04",
        "New process ignored on the front line",
        ["work"],
        "A manager rolls out a new service strategy, but frontline staff keep making decisions the old way because the incentives and scripts were never changed. Leadership then blames execution discipline.",
        [
          "Treat the unchanged local rules as a strategic design issue, not just a people problem.",
          "Make the new priorities visible in incentives, scripts, and escalation choices."
        ],
        "A strategy that never reaches decision rules will not survive daily reality."
      ),
      ex(
        "ch15-ex05",
        "Personal finance plan with no behavioral proof",
        ["personal"],
        "Someone says their strategy is to save more, but subscriptions, automatic spending, and default transfers remain untouched. The plan keeps failing in the exact same way each month.",
        [
          "Ask what concrete behavior should change if the strategy is real.",
          "Then alter the defaults and money flows so the plan exists in action, not in hope."
        ],
        "Reality reveals whether a strategy has been translated into repeatable behavior."
      ),
      ex(
        "ch15-ex06",
        "Health plan without feedback",
        ["personal"],
        "A person starts a detailed health plan and sticks with it even though one part keeps producing fatigue and inconsistency. They treat revision as failure instead of as information.",
        [
          "Use the early friction as feedback about the plan rather than as proof that more force is needed.",
          "Keep the goal and revise the mechanism that reality is disproving."
        ],
        "Strategy survives contact with reality by learning, not by pretending the first version was perfect."
      )
    ],
    quiz: [
      q(
        "What is the clearest sign that a strategy is real?",
        [
          "It changes actual choices, resources, and behavior under constraint",
          "It sounds coherent in a presentation",
          "It receives positive feedback from leadership",
          "It contains many detailed initiatives"
        ],
        0,
        "A strategy becomes real when it alters the pattern of action."
      ),
      q(
        "Why are budgets and staffing such important strategic signals?",
        [
          "They reveal what the organization truly prioritizes",
          "They matter only after strategy is complete",
          "They replace the need for diagnosis",
          "They make incentives irrelevant"
        ],
        0,
        "Resource patterns often tell the truth more clearly than strategy language does."
      ),
      q(
        "What can early execution problems reveal?",
        [
          "Weakness in the diagnosis, policy, design, or commitment behind the strategy",
          "That execution should stop entirely",
          "That the strategy should never be revised",
          "That only frontline effort is lacking"
        ],
        0,
        "Reality tests the full strategic logic, not just the workers carrying it out."
      ),
      q(
        "Why do incentives matter so much to strategy in practice?",
        [
          "Because people follow the system that rewards their actual choices",
          "Because incentives are only a morale tool",
          "Because strategy should stay above operational details",
          "Because incentives eliminate uncertainty"
        ],
        0,
        "A strategy and an incentive system that conflict will usually produce the old behavior."
      ),
      q(
        "What is the value of early testing?",
        [
          "It lets the organization discover weak assumptions before full commitment",
          "It proves the strategy is finished",
          "It makes adaptation unnecessary",
          "It replaces the need for concentration"
        ],
        0,
        "Small contact with reality is one of the cheapest forms of strategic learning."
      ),
      q(
        "When is adaptation a sign of strength rather than failure?",
        [
          "When the strategy updates its mechanism in response to feedback without losing direction",
          "When the team abandons all priorities at the first obstacle",
          "When leadership hides the change to preserve appearances",
          "When the plan becomes more vague after execution begins"
        ],
        0,
        "Good strategy learns from reality without dissolving into drift."
      ),
      q(
        "A company says retention matters but frontline scripts still reward quick sales. What is the core issue?",
        [
          "The strategy has not been translated into local decision rules",
          "The diagnosis is already proven",
          "The company is adapting too quickly",
          "The budget no longer matters"
        ],
        0,
        "Local rules and incentives need to carry the strategy if it is going to survive daily reality."
      ),
      q(
        "Why is presentation quality a weak test of strategy?",
        [
          "Because a polished story can hide the lack of operational proof",
          "Because presentations never matter at all",
          "Because good execution requires vague communication",
          "Because reality and strategy are separate problems"
        ],
        0,
        "Reality forces plans to become specific in ways slides can avoid."
      ),
      q(
        "What does it mean for a strategy to survive contact with reality?",
        [
          "It changes behavior, absorbs feedback, and still holds coherent direction",
          "It never changes once announced",
          "It keeps all existing resource patterns intact",
          "It protects leaders from making tradeoffs"
        ],
        0,
        "Survival means the strategy works as an operational guide and can still learn."
      ),
      q(
        "Which statement best captures the overall lesson?",
        [
          "Execution is one of the main tests of strategic quality, not a separate afterthought",
          "A strategy only needs sound logic on paper",
          "Reality mainly affects morale, not strategic design",
          "Once a plan is approved, adaptation becomes a weakness"
        ],
        0,
        "Rumelt ties strategy and execution together through the test of real constraints."
      )
    ]
  },
  {
    chapterId: "ch16-leadership-and-judgment",
    title: "Leadership Requires Sharp Strategic Judgment",
    simpleSummary: [
      "Leadership adds value when it makes sharper judgments than the system would produce on its own. Rumelt argues that leaders earn their place by diagnosing clearly, choosing well, and keeping action coherent under uncertainty.",
      "This matters because strategy is not mainly a charisma exercise. It is a discipline of judgment that faces ambiguity, tradeoffs, and uncomfortable reality better than routine thinking does."
    ],
    standardSummary: [
      "Leadership adds value when it applies sharper strategic judgment than the surrounding system would produce by default. Rumelt emphasizes diagnosis, choice, and coherent action as leadership work, especially when conditions are uncertain and competing pressures are strong.",
      "The chapter matters because leadership is often romanticized as vision or confidence. Rumelt treats it more rigorously. Strategic leadership means seeing the situation more clearly, choosing what matters, and holding the organization to that logic even when softer options are socially easier."
    ],
    deeperSummary: [
      "Leadership adds value when it contributes strategic judgment that the organization would not reliably generate on its own. Rumelt's view is demanding. A leader is not mainly a motivator or symbol. A leader is someone who can diagnose the situation, make disciplined tradeoffs, organize coherent action, and keep learning as the field changes.",
      "That matters because judgment sits at the center of strategy. It is needed most when evidence is incomplete, incentives are noisy, and social pressure pulls toward vagueness. Strategic leadership is therefore less about broad inspiration and more about sustained clarity under pressure."
    ],
    takeaways: [
      "Strategic leadership is judged by the quality of judgment it adds.",
      "Diagnosis, tradeoffs, and coherence are leadership work.",
      "Charisma is not a substitute for clear strategic thought.",
      "Leaders have to hold clarity under uncertainty and pressure."
    ],
    practice: [
      "state the situation before stating the solution",
      "name the tradeoff the decision is really making",
      "ask what the organization would do by default if no leader intervened",
      "make one choice clearer than the group would make on autopilot",
      "revisit one judgment after new evidence arrives"
    ],
    standardBullets: [
      b(
        "Leadership adds value through judgment. The leader sees, chooses, and organizes better than the default system would.",
        "That is a much sharper standard than simply sounding confident."
      ),
      b(
        "Diagnosis is a leadership task. Someone has to frame the challenge clearly enough for the organization to act well.",
        "Weak framing is often a leadership failure before it becomes an execution failure."
      ),
      b(
        "Tradeoffs are leadership work. A leader has to decide what matters most and what will not be pursued.",
        "Avoiding that choice usually leaves the organization vague and overextended."
      ),
      b(
        "Judgment matters most under uncertainty. Strategy rarely arrives with perfect information.",
        "That is why disciplined reasoning matters more than certainty theater."
      ),
      b(
        "Leadership has to hold coherence. The system naturally drifts toward fragmentation unless someone keeps the logic clear.",
        "This is part of why strategic leadership is ongoing, not one speech."
      ),
      b(
        "Charisma can help communication but cannot replace strategic thought. Inspiration without judgment creates weak strategy faster, not slower.",
        "People may follow energy into a bad decision if clarity is missing."
      ),
      b(
        "Leaders should ask hard questions others may avoid. That includes questions about evidence, tradeoffs, and resource reality.",
        "Strategic leadership often feels inconvenient before it feels useful."
      ),
      b(
        "Attention is part of judgment. Where the leader spends time tells the organization what is strategically real.",
        "Leadership focus shapes collective focus."
      ),
      b(
        "Teaching the logic matters. The organization executes better when it understands the reasoning behind the choices.",
        "Good leaders spread judgment rather than hoarding it."
      ),
      b(
        "Sharp strategic judgment is the core leadership contribution because it keeps the organization closer to reality and closer to coherent action.",
        "That is what leadership is for in Rumelt's view."
      )
    ],
    deeperBullets: [
      b(
        "The hardest leadership moments combine uncertainty with pressure to appear certain. That is where shallow confidence becomes especially dangerous.",
        "Real judgment can admit ambiguity without surrendering direction."
      ),
      b(
        "Leadership failure often appears as social accommodation. People are pleased in the short term and the strategy weakens quietly.",
        "This is why good leaders sometimes disappoint groups in order to protect coherence."
      ),
      b(
        "Judgment improves with repeated contact with evidence. Leaders who keep reality close can refine their strategic sense faster.",
        "Distance from facts often produces confident but brittle decisions."
      ),
      b(
        "A leader's resource decisions educate the organization. They show which tradeoffs are real and which claims were decorative.",
        "Behavior teaches strategy more strongly than speeches do."
      ),
      b(
        "The goal is not heroic central control. It is sharper judgment that helps the whole system think and act better.",
        "That is how leadership creates more capability rather than more dependency."
      )
    ],
    examples: [
      ex(
        "ch16-ex01",
        "Student leader facing a hard cut",
        ["school"],
        "A student group can only fund one of two major projects well, but its president keeps promising both because the members are enthusiastic about each one. The group is now underpowered on both fronts.",
        [
          "Use leadership to make the sharper choice the group is avoiding.",
          "Explain the tradeoff plainly and commit the resources strongly enough for one project to succeed."
        ],
        "Leadership matters when the default group process would stay vague and underpowered."
      ),
      ex(
        "ch16-ex02",
        "Team captain avoiding diagnosis",
        ["school"],
        "A team captain keeps telling players to stay confident even though the real problem is that practices are unfocused and the late game structure is weak. Morale talk is replacing strategic judgment.",
        [
          "Start with the actual diagnosis before trying to motivate the group.",
          "Then change the practice design so the message and the strategy align."
        ],
        "Confidence helps only after judgment clarifies what needs to change."
      ),
      ex(
        "ch16-ex03",
        "Manager under pressure to please everyone",
        ["work"],
        "A manager knows the team should stop a low value product line, but several internal groups are attached to it. The easier path is to keep it alive quietly and spread resources thinner.",
        [
          "Treat the willingness to choose as part of leadership, not as a political inconvenience.",
          "Make the tradeoff explicit and reallocate resources toward the stronger line."
        ],
        "Leadership adds value when it protects strategic logic against social drift."
      ),
      ex(
        "ch16-ex04",
        "Founder mistaking energy for judgment",
        ["work"],
        "A founder energizes the company well, but keeps changing priorities weekly based on the latest conversation or fear. The organization is motivated and strategically blurry.",
        [
          "Separate inspiration from judgment and rebuild around a clearer diagnosis and policy.",
          "Use leadership attention to hold the line instead of resetting it constantly."
        ],
        "Energy without stable judgment can make an organization move fast in the wrong pattern."
      ),
      ex(
        "ch16-ex05",
        "Career decision with no real choice",
        ["personal"],
        "Someone keeps collecting advice about a career move but avoids the actual tradeoff between security and growth. They want a leader's clarity from everyone else while refusing to exercise judgment themselves.",
        [
          "Name the real choice and the cost of each path directly.",
          "Then make the decision based on the strategic logic, not on the hope that more input will remove the tradeoff."
        ],
        "Judgment often begins where certainty ends."
      ),
      ex(
        "ch16-ex06",
        "Family decision without a clear owner",
        ["personal"],
        "A family needs to make a difficult housing decision, but each conversation circles the same facts without anyone framing the core issue or proposing a coherent path. Everyone is involved and no one is leading.",
        [
          "Use leadership to frame the problem and the real options clearly.",
          "Then choose a path based on the tradeoffs instead of reopening the whole conversation every time."
        ],
        "Leadership is useful when a group needs sharper judgment than its default discussion is producing."
      )
    ],
    quiz: [
      q(
        "What is Rumelt's sharpest test of leadership value?",
        [
          "Whether the leader adds better strategic judgment than the default system would",
          "Whether the leader keeps everyone equally satisfied",
          "Whether the leader always appears certain",
          "Whether the leader gives the strongest motivational speeches"
        ],
        0,
        "Leadership matters when it improves diagnosis, choice, and coherence."
      ),
      q(
        "Why is diagnosis a leadership task?",
        [
          "Because someone has to frame the challenge clearly enough for the organization to act well",
          "Because only analysts should handle problem framing",
          "Because diagnosis matters only before leadership begins",
          "Because teams naturally diagnose perfectly on their own"
        ],
        0,
        "Weak framing often reflects weak leadership judgment."
      ),
      q(
        "What happens when leaders avoid tradeoffs?",
        [
          "The organization becomes vague, overextended, and strategically softer",
          "The strategy becomes more coherent automatically",
          "Resources expand to cover every priority",
          "The need for judgment disappears"
        ],
        0,
        "Avoided tradeoffs usually return later as weaker results."
      ),
      q(
        "Why is certainty theater dangerous in leadership?",
        [
          "It can replace disciplined reasoning with shallow confidence under uncertainty",
          "It improves diagnostic quality",
          "It helps organizations adapt faster",
          "It removes the need for evidence"
        ],
        0,
        "Appearing certain is not the same as thinking well."
      ),
      q(
        "What is one strategic function of leadership attention?",
        [
          "It signals what the organization should treat as truly important",
          "It removes the need for resource choices",
          "It guarantees morale improvement",
          "It should be spread evenly across every issue"
        ],
        0,
        "Where leaders spend time helps define what is strategically real."
      ),
      q(
        "Why can charisma become a strategic liability?",
        [
          "It can persuade people to follow energy when the underlying judgment is weak",
          "It makes communication impossible",
          "It always reduces motivation",
          "It prevents any tradeoff from being made"
        ],
        0,
        "Inspiration amplifies good strategy and bad strategy alike."
      ),
      q(
        "What kind of questions should strategic leaders ask?",
        [
          "Questions about evidence, tradeoffs, and what reality will actually support",
          "Questions that avoid discomfort and preserve harmony",
          "Questions only about long term aspiration",
          "Questions that delay action until certainty appears"
        ],
        0,
        "Hard questions often protect strategy from drift."
      ),
      q(
        "Why does teaching the logic of a strategy matter?",
        [
          "It helps the organization execute with better local judgment",
          "It removes the need for leadership entirely",
          "It turns every choice into a central decision",
          "It makes incentives unnecessary"
        ],
        0,
        "Leaders spread capability when people understand the reasoning behind the choices."
      ),
      q(
        "A leader keeps changing priorities to match the latest pressure. What is the strategic problem?",
        [
          "The leader is not holding coherent judgment under pressure",
          "The leader is concentrating too effectively",
          "The leader is using diagnosis too much",
          "The leader is proving agility"
        ],
        0,
        "Reactive priority changes weaken the line of strategic logic."
      ),
      q(
        "Which statement best captures the overall lesson?",
        [
          "Leadership is most valuable when it keeps the organization closer to reality and coherent action",
          "Leadership is mainly about confidence and pace",
          "Leadership should minimize tradeoffs whenever possible",
          "Leadership matters only after strategy is complete"
        ],
        0,
        "Rumelt treats strategic judgment as the core leadership contribution."
      )
    ]
  },
  {
    chapterId: "ch17-science-of-strategy",
    title: "Treat Strategy as a Search for Better Explanation",
    simpleSummary: [
      "Strategy improves when people search for better explanations instead of clinging to the first story that sounds plausible. Rumelt argues that diagnosis is closer to disciplined inquiry than to confident assertion.",
      "This matters because weak explanations produce weak strategies. Better explanation helps leaders see causes, compare alternatives, and revise the plan before mistakes get expensive."
    ],
    standardSummary: [
      "Strategy improves when leaders treat diagnosis as a search for better explanation rather than as a one time declaration. Rumelt emphasizes comparison, evidence, and causal reasoning because strategy is only as strong as the explanation behind it.",
      "The chapter matters because many weak strategies begin with shallow stories that are never tested. Better explanation sharpens leverage, reveals hidden causes, and reduces the chance that action will be organized around the wrong problem."
    ],
    deeperSummary: [
      "Strategy improves when diagnosis is treated as a search for better explanation. Rumelt's view is close to disciplined inquiry: compare competing accounts, examine evidence, look for anomalies, and keep asking what causal story best fits the pattern you see.",
      "That matters because explanation shapes everything that follows. A shallow or convenient story produces false leverage and wasted action. A stronger explanation can reframe the challenge, expose a new point of intervention, and save the organization from committing hard to the wrong logic."
    ],
    takeaways: [
      "Diagnosis is a search for better explanation.",
      "Strategy depends on causal understanding, not just description.",
      "Comparing explanations improves judgment.",
      "Revision is a strength when evidence changes the story."
    ],
    practice: [
      "write two competing explanations for the same problem",
      "ask what evidence would disprove your favorite story",
      "look for one anomaly the current explanation ignores",
      "trace the cause rather than restating the symptom",
      "update the strategy when a better explanation appears"
    ],
    standardBullets: [
      b(
        "Diagnosis starts with explanation. Strategy needs to know why the problem exists, not just what it looks like on the surface.",
        "Description alone rarely tells you where leverage lies."
      ),
      b(
        "Better explanations lead to better action. A sharper causal story changes what counts as a sensible move.",
        "That is why diagnosis deserves so much care."
      ),
      b(
        "Comparison improves judgment. Looking at more than one explanation reduces attachment to the first plausible story.",
        "Competing accounts make strategic thinking more disciplined."
      ),
      b(
        "Evidence matters because elegant stories can still be wrong. Strategy needs reasons that survive contact with facts.",
        "Confidence without evidence is a weak foundation."
      ),
      b(
        "Anomalies are useful. The fact that does not fit may reveal that the current explanation is shallow or wrong.",
        "Good strategists pay attention when reality resists the story."
      ),
      b(
        "Causal reasoning matters more than symptom labeling. Naming the visible problem is not enough if the source remains unclear.",
        "The best leverage often sits beneath the symptom."
      ),
      b(
        "Explanation and strategy evolve together. A new understanding of cause can reshape the whole plan.",
        "Revision is part of disciplined strategy, not a sign of weakness."
      ),
      b(
        "Authority is not proof. Even confident leaders need to test their explanations against reality.",
        "Status can protect bad stories if evidence is ignored."
      ),
      b(
        "Good questions improve explanation. Asking what else could explain the pattern is strategically powerful.",
        "It helps prevent early closure around a convenient story."
      ),
      b(
        "Treating strategy as a search for better explanation keeps action tied to reality instead of assumption.",
        "That is one of Rumelt's deepest lessons about strategic thinking."
      )
    ],
    deeperBullets: [
      b(
        "Many strategic errors begin with explanation by analogy. People force a new problem into the shape of an old one because it feels familiar.",
        "A better explanation may require dropping the comforting comparison."
      ),
      b(
        "A useful explanation should make surprising facts less surprising. It should organize reality, not merely sound intelligent.",
        "This is one practical test of explanatory quality."
      ),
      b(
        "Because strategy acts before certainty, the goal is not perfect explanation but better explanation than the alternatives.",
        "Judgment improves through relative improvement, not through waiting for flawless proof."
      ),
      b(
        "Bad explanations often survive because they flatter incentives or identity. A stronger explanation may be resisted precisely because it is less comfortable.",
        "This ties diagnosis back to leadership courage."
      ),
      b(
        "The search for explanation creates strategic optionality. Better understanding often reveals interventions that were previously invisible.",
        "A new explanation can therefore create a new strategy, not only correct an old one."
      )
    ],
    examples: [
      ex(
        "ch17-ex01",
        "Grades falling for the wrong reason",
        ["school"],
        "A student assumes a drop in grades means they are not working hard enough. Looking closer shows the real issue is that the course format changed and passive review no longer fits the testing style.",
        [
          "Write more than one explanation before redesigning the study plan.",
          "If the problem is a method mismatch rather than low effort, shift the strategy toward active practice and feedback."
        ],
        "A better explanation changes where leverage sits and what action is sensible."
      ),
      ex(
        "ch17-ex02",
        "Club losing members for hidden reasons",
        ["school"],
        "A club assumes members are leaving because students are busier this semester. Short interviews reveal that new members feel lost after the first meeting and do not know where they fit.",
        [
          "Treat the busyness story as one hypothesis, not as the diagnosis.",
          "Compare it with other explanations and rebuild the strategy around the one that best matches the evidence."
        ],
        "Weak strategy often begins with a comfortable explanation that was never tested."
      ),
      ex(
        "ch17-ex03",
        "Sales slump with a shallow story",
        ["work"],
        "A company blames a sales slump on poor rep effort. Deeper analysis shows that a recent pricing change created confusion in mid market deals and lengthened approvals.",
        [
          "Look for the causal story that best explains the pattern, not the story that assigns blame fastest.",
          "Then let the strategy target the true cause instead of the easiest target."
        ],
        "A better explanation prevents the team from organizing action around the wrong problem."
      ),
      ex(
        "ch17-ex04",
        "Product complaints misread as support failure",
        ["work"],
        "A rise in customer complaints is blamed on support quality, but the data shows complaints surge mainly after one confusing product update. The support issue is mostly downstream of a design issue.",
        [
          "Trace the complaint pattern back to the upstream cause before fixing the visible symptom.",
          "Use the new explanation to shift the response toward product clarity."
        ],
        "Causal explanation is strategically valuable because it reveals where intervention will matter more."
      ),
      ex(
        "ch17-ex05",
        "Budget problem with the wrong story",
        ["personal"],
        "Someone thinks they are bad with money because they feel stressed every month. A closer look shows the real issue is irregular timing of bills and income, not constant overspending across the board.",
        [
          "Test more than one explanation before changing the whole financial system.",
          "If timing mismatch is the cause, build the strategy around smoothing cash flow rather than around guilt."
        ],
        "A better explanation can replace blame with leverage."
      ),
      ex(
        "ch17-ex06",
        "Repeated conflict with a shallow diagnosis",
        ["personal"],
        "A couple keeps saying they fight because one person is impatient. After looking at when the arguments happen, they realize the fights cluster when decisions are left vague until the last minute.",
        [
          "Use the pattern to build a better explanation than the first personality story.",
          "If ambiguity is the driver, change the decision process rather than only urging more patience."
        ],
        "Strategic explanation often reveals a system cause beneath a personal label."
      )
    ],
    quiz: [
      q(
        "Why does Rumelt treat diagnosis as a search for better explanation?",
        [
          "Because strategy depends on understanding cause, not just naming the visible problem",
          "Because explanations matter only after execution",
          "Because the first plausible story is usually best",
          "Because comparison weakens decision making"
        ],
        0,
        "A stronger explanation changes what counts as sensible strategy."
      ),
      q(
        "What is the value of comparing more than one explanation?",
        [
          "It reduces attachment to the first convenient story",
          "It guarantees perfect certainty",
          "It makes evidence less important",
          "It delays action without improving judgment"
        ],
        0,
        "Competing explanations make diagnosis more disciplined."
      ),
      q(
        "Why are anomalies strategically useful?",
        [
          "They can reveal that the current explanation is too shallow or wrong",
          "They should be ignored so the strategy stays simple",
          "They prove the first diagnosis automatically",
          "They matter only in scientific research"
        ],
        0,
        "A fact that does not fit may point toward a better explanation."
      ),
      q(
        "What is the weakness of symptom labeling?",
        [
          "It names the visible issue without reaching the source of leverage",
          "It always creates too much complexity",
          "It makes action impossible",
          "It is better than causal reasoning"
        ],
        0,
        "Symptoms do not tell you where the real cause sits."
      ),
      q(
        "Which move best reflects Rumelt's approach to explanation?",
        [
          "Testing a favored diagnosis against alternative causal stories and evidence",
          "Choosing the explanation that flatters the team most",
          "Keeping the original story because revising looks weak",
          "Using authority to settle the diagnosis quickly"
        ],
        0,
        "Better explanation comes from disciplined comparison and evidence, not from comfort."
      ),
      q(
        "Why is authority a weak substitute for explanation?",
        [
          "A confident leader can still organize action around a false story",
          "Authority eliminates the need for strategy",
          "Authority always lowers morale",
          "Authority matters only in execution"
        ],
        0,
        "Status does not prove that the underlying causal account is right."
      ),
      q(
        "What is a practical test of a strong explanation?",
        [
          "It makes the observed pattern more intelligible than the alternatives do",
          "It sounds the most sophisticated",
          "It contains the most technical language",
          "It avoids any uncomfortable implication"
        ],
        0,
        "A good explanation organizes reality better, not just rhetoric."
      ),
      q(
        "Why can a better explanation change the whole strategy?",
        [
          "Because it can reveal a different source of leverage and a different point of intervention",
          "Because strategy and diagnosis are unrelated",
          "Because explanations only affect messaging",
          "Because leverage never depends on cause"
        ],
        0,
        "The action logic depends on the causal story you believe."
      ),
      q(
        "What is the right goal under uncertainty?",
        [
          "To reach a better explanation than the available alternatives, not a perfect one",
          "To wait until all ambiguity disappears",
          "To use only the first explanation that fits",
          "To avoid revising once a strategy is announced"
        ],
        0,
        "Strategic judgment improves through better explanation, not perfect certainty."
      ),
      q(
        "Which statement best captures the overall lesson?",
        [
          "Strategic strength starts with explanatory quality because action follows the story chosen",
          "Good action can compensate fully for weak diagnosis",
          "Strategy should avoid causal reasoning in favor of momentum",
          "The safest path is to preserve the first diagnosis"
        ],
        0,
        "Rumelt links strategy directly to the search for the best available explanation."
      )
    ]
  },
  {
    chapterId: "ch18-strategic-mindset",
    title: "A Strategic Mindset Can Be Practiced",
    simpleSummary: [
      "A strategic mindset can be practiced through repeated habits of diagnosis, leverage, and coherent action. Rumelt argues that strategy is not only for major institutions. It is a way of thinking that improves with deliberate use.",
      "This matters because strategic judgment grows from practice, not from admiration alone. The more often you frame problems clearly and look for real leverage, the more natural better decisions become."
    ],
    standardSummary: [
      "A strategic mindset can be practiced by repeatedly diagnosing reality, finding leverage, making tradeoffs, and coordinating action around what matters most. Rumelt closes by treating strategy as a disciplined habit of thought rather than a rare gift.",
      "The chapter matters because it brings the book back to daily use. Strategic thinking improves when people apply it to ordinary choices, not only to grand planning moments. Practice builds sharper perception and better judgment over time."
    ],
    deeperSummary: [
      "A strategic mindset can be practiced because the core disciplines of strategy are learnable: diagnose the challenge, search for leverage, choose under constraint, and coordinate action around a coherent logic. Rumelt's closing emphasis is that strategy should become a repeated mode of judgment, not a special event reserved for formal plans.",
      "That matters because strategic weakness is often habitual and so is strategic strength. People can train themselves to separate goals from strategy, to ask better explanatory questions, and to notice where limited effort could matter most. Practice does not remove uncertainty, but it improves how one meets it."
    ],
    takeaways: [
      "Strategic thinking is a practice, not a one time insight.",
      "Diagnosis, leverage, and coherence can be trained.",
      "Ordinary decisions are a place to practice strategy.",
      "Better habits of thought improve judgment over time."
    ],
    practice: [
      "write the real challenge before acting on a problem",
      "ask where leverage sits before adding effort",
      "state the tradeoff instead of hiding it",
      "check whether your actions reinforce one another",
      "review one result each week for what it taught about your strategy"
    ],
    standardBullets: [
      b(
        "Strategy is a habit of thought. It improves when people practice diagnosis, choice, and coordination repeatedly.",
        "This makes strategy less mysterious and more learnable."
      ),
      b(
        "Ordinary problems are good training grounds. Small decisions can still teach strategic discipline.",
        "Practice does not require a dramatic context to be valuable."
      ),
      b(
        "Start by separating goals from strategy. Ask what the challenge is before deciding what to do.",
        "This one move improves many weak plans immediately."
      ),
      b(
        "Look for leverage before adding effort. More work is a poor substitute for better positioning.",
        "That habit helps prevent grind from replacing strategy."
      ),
      b(
        "Make tradeoffs visible. Strategic thinking gets sharper when choices are stated plainly.",
        "Hidden tradeoffs usually reappear later as confusion."
      ),
      b(
        "Connect actions so they reinforce one another. Coherence should become a regular check, not an occasional insight.",
        "The pattern of fit is one of the best signals of strategic quality."
      ),
      b(
        "Use feedback to refine judgment. Outcomes should update future diagnosis and policy.",
        "Practice includes review, not just initial choice."
      ),
      b(
        "Questions shape mindset. Better strategic questions produce better strategic attention.",
        "The way a problem is framed often determines the quality of the response."
      ),
      b(
        "Strategic thinking becomes easier with repetition because the habits start to compound.",
        "People learn to see constraints, leverage, and incoherence faster over time."
      ),
      b(
        "A practiced strategic mindset turns better judgment into a repeatable advantage across work, school, and personal life.",
        "That is the practical promise of the whole book."
      )
    ],
    deeperBullets: [
      b(
        "Practice matters because default thinking is often reactive. Without training, people move toward urgency, not leverage.",
        "A strategic mindset interrupts that reflex."
      ),
      b(
        "Review is part of practice. Looking back on outcomes strengthens future diagnosis more than endless forward motion does.",
        "Learning loops are strategic assets."
      ),
      b(
        "The smallest strategic question can shift a large decision. Asking what the real challenge is can save hours of poor effort.",
        "This is why practice on ordinary problems compounds."
      ),
      b(
        "A practiced mindset also improves communication. People who think strategically explain choices more clearly to others.",
        "That makes coordination easier as well as judgment sharper."
      ),
      b(
        "The point of practice is not perfect foresight. It is better contact with reality, leverage, and coherent action over time.",
        "That is what turns strategy into a durable personal capability."
      )
    ],
    examples: [
      ex(
        "ch18-ex01",
        "Weekly planning as strategic practice",
        ["school"],
        "A student starts each week by listing every task and feeling overwhelmed. They begin practicing strategy by naming the real challenge first and choosing one leverage point for the week.",
        [
          "Use the weekly plan as a place to practice diagnosis and concentration.",
          "Ask what one move would improve the whole week most before filling the calendar."
        ],
        "Strategic thinking gets stronger when it is used on ordinary planning, not only on major crises."
      ),
      ex(
        "ch18-ex02",
        "Group project with better questions",
        ["school"],
        "A class team keeps arguing over tactics. One member starts asking what challenge matters most, what the next objective is, and which action actually changes the result.",
        [
          "Use those questions consistently until the team's decision quality improves.",
          "The repetition is the practice, not just the one answer it produces."
        ],
        "A strategic mindset often grows by making better questions habitual."
      ),
      ex(
        "ch18-ex03",
        "Manager building strategic habits",
        ["work"],
        "A manager notices that every problem meeting jumps straight to solutions. They start insisting on a brief diagnosis, one leverage point, and one visible tradeoff before action is chosen.",
        [
          "Turn those prompts into a routine rather than a one time exercise.",
          "Over time the team will learn to think more strategically before it acts."
        ],
        "Practice creates strategic capability by repeating the same core disciplines."
      ),
      ex(
        "ch18-ex04",
        "Founder reviewing outcomes better",
        ["work"],
        "A founder keeps moving from one decision to the next without review. The same strategic errors return because no one looks back at what the last choices revealed.",
        [
          "Build a short review loop that asks what the result says about diagnosis and leverage.",
          "Use the answer to sharpen the next round of decisions."
        ],
        "Practice includes learning from outcomes, not just making more moves."
      ),
      ex(
        "ch18-ex05",
        "Home routine used as training",
        ["personal"],
        "Someone wants less chaotic mornings and decides to treat the issue like a strategic exercise. They diagnose the main source of friction, choose one leverage point, and align a few supporting habits around it.",
        [
          "Use everyday friction as a chance to practice real strategic logic.",
          "The skill grows because the structure is repeated, not because the problem is grand."
        ],
        "Ordinary life gives many opportunities to train strategic attention."
      ),
      ex(
        "ch18-ex06",
        "Career development with deliberate review",
        ["personal"],
        "A professional keeps working hard but feels stuck. They begin reviewing each month by asking what challenge actually held them back, where leverage seemed strongest, and which actions reinforced or conflicted.",
        [
          "Make the monthly review a standing practice instead of waiting for major setbacks.",
          "Use the repeated reflection to improve the next month's choices."
        ],
        "Strategic mindset becomes durable when diagnosis and review turn into routine habits."
      )
    ],
    quiz: [
      q(
        "Why does Rumelt end by calling strategy a practice?",
        [
          "Because diagnosis, leverage, and coherent choice improve through repeated use",
          "Because strategy only matters in small personal decisions",
          "Because strategic judgment should avoid review",
          "Because good strategy appears automatically with experience"
        ],
        0,
        "The mindset grows through repetition, not through admiration alone."
      ),
      q(
        "What is one of the simplest ways to practice strategic thinking daily?",
        [
          "Separate the goal from the actual challenge before choosing action",
          "Add more effort before asking questions",
          "Treat every issue as equally urgent",
          "Avoid making tradeoffs visible"
        ],
        0,
        "That one habit immediately sharpens diagnosis."
      ),
      q(
        "Why are ordinary problems useful for practice?",
        [
          "They let people rehearse diagnosis and leverage in repeatable situations",
          "They are too small to teach anything",
          "They remove the need for coherent action",
          "They matter only if the stakes are high"
        ],
        0,
        "Small decisions still train the same core strategic muscles."
      ),
      q(
        "What role does review play in a strategic mindset?",
        [
          "It updates future judgment by showing what the last strategy actually revealed",
          "It mainly protects pride after a mistake",
          "It is less important than continuous motion",
          "It should happen only when the result was a success"
        ],
        0,
        "Review helps practice become cumulative rather than repetitive."
      ),
      q(
        "Why is leverage a useful daily question?",
        [
          "It shifts attention from more effort toward where effort can matter most",
          "It removes the need for tradeoffs",
          "It proves the diagnosis was correct",
          "It turns every task into a top priority"
        ],
        0,
        "Asking about leverage helps prevent grind from replacing strategy."
      ),
      q(
        "What does it mean to make tradeoffs visible in practice?",
        [
          "To state clearly what will receive less support because another thing matters more",
          "To hide the costs so action feels smoother",
          "To avoid choosing until every option is safe",
          "To divide attention equally and call it balance"
        ],
        0,
        "Practice gets sharper when the real cost of choice is stated plainly."
      ),
      q(
        "How does a practiced strategic mindset improve communication?",
        [
          "It helps people explain the logic behind choices more clearly to others",
          "It replaces the need for explanation",
          "It makes coordination less important",
          "It turns every decision into a private judgment"
        ],
        0,
        "Clear reasoning travels better through a group than vague intention does."
      ),
      q(
        "What is one sign that strategic practice is working?",
        [
          "You notice constraints, leverage, and incoherence faster than before",
          "You stop needing feedback entirely",
          "You never revise a decision again",
          "You feel certain more often"
        ],
        0,
        "Practice improves the speed and quality of strategic attention."
      ),
      q(
        "Why does Rumelt connect strategy to habit rather than to rare brilliance?",
        [
          "Because repeated disciplined thinking creates better judgment over time",
          "Because strategic insight cannot be learned",
          "Because habits matter only in execution",
          "Because brilliance is always strategically weak"
        ],
        0,
        "The point is durable capability, not occasional flashes of insight."
      ),
      q(
        "What is the deepest lesson of the closing chapter?",
        [
          "Strategy becomes a real advantage when its core disciplines are practiced until they become habitual",
          "Strategy is mainly for formal planning sessions",
          "Only large organizations can think strategically",
          "Practice matters less than natural instinct"
        ],
        0,
        "Rumelt closes by making strategy a repeatable way of seeing and acting."
      )
    ]
  }
];

const CHAPTERS = [
  ...CHAPTERS_PART_ONE,
  ...CHAPTERS_PART_TWO,
  ...CHAPTERS_PART_THREE,
];

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

function makeVariant(paragraphs, bullets, takeaways, practice) {
  return {
    importantSummary: paragraphs.map((paragraph) => sentence(paragraph)).join(" "),
    summaryBullets: bullets.map((item) => item.text),
    keyTakeaways: takeaways,
    practice,
    summaryBlocks: [
      ...paragraphs.map((text) => ({ type: "paragraph", text })),
      ...bullets,
    ],
  };
}

function buildQuestionId(chapterId, index) {
  return `${chapterId}-q${String(index + 1).padStart(2, "0")}`;
}

function countsByScope(examples) {
  return examples.reduce(
    (acc, example) => {
      const scope = example.contexts?.[0] || "personal";
      acc[scope] = (acc[scope] || 0) + 1;
      return acc;
    },
    { school: 0, work: 0, personal: 0 }
  );
}

function renderReport(bookPackage) {
  const chapters = [...bookPackage.chapters].sort((left, right) => left.number - right.number);
  const lines = [];

  lines.push("# 1. Book audit summary for Good Strategy Bad Strategy by Richard Rumelt", "");
  AUDIT_SUMMARY.forEach((paragraph) => lines.push(sentence(paragraph), ""));

  lines.push("# 2. Main content problems found", "");
  MAIN_PROBLEMS.forEach((paragraph, index) => lines.push(`${index + 1}. ${sentence(paragraph)}`));
  lines.push("");

  lines.push("# 3. Personalization strategy for Good Strategy Bad Strategy by Richard Rumelt", "");
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
  lines.push("2. Every chapter now has seven Simple bullets, ten Standard bullets, and fifteen Deeper bullets with real progression.");
  lines.push("3. Every chapter now has exactly six scenarios with two school, two work, and two personal cases.");
  lines.push("4. Every chapter now has a scenario based ten question quiz that tests judgment rather than chapter title recall.");
  lines.push("5. No package schema expansion was needed, and motivation can be delivered through a book specific reader layer.");
  lines.push("6. The book now reads like a guided lesson on Rumelt's strategic logic instead of a generic productivity package.");
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
      for (const value of variant.keyTakeaways || []) {
        if (/[–—-]/.test(value)) violations.push(`chapter ${chapter.number} key takeaway`);
      }
      for (const value of variant.practice || []) {
        if (/[–—-]/.test(value)) violations.push(`chapter ${chapter.number} practice`);
      }
      if (variant.importantSummary && /[–—-]/.test(variant.importantSummary)) {
        violations.push(`chapter ${chapter.number} important summary`);
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
      if (/\bthis chapter\b|\bthe chapter\b|\bthe reading\b/i.test(question.prompt)) {
        violations.push(`chapter ${chapter.number} forbidden quiz prompt phrase`);
      }
      for (const choice of question.choices) {
        if (/[–—-]/.test(choice)) violations.push(`chapter ${chapter.number} quiz choice`);
      }
    }
  }

  if (violations.length) {
    throw new Error(`Content rule violation: ${violations[0]}`);
  }
}

function assertStructure(pkg) {
  if (CHAPTERS.length !== 18) {
    throw new Error(`Expected 18 authored chapters, found ${CHAPTERS.length}`);
  }

  for (const chapter of pkg.chapters) {
    const simpleBlocks = chapter.contentVariants.easy.summaryBlocks;
    const standardBlocks = chapter.contentVariants.medium.summaryBlocks;
    const deeperBlocks = chapter.contentVariants.hard.summaryBlocks;
    const simpleBullets = simpleBlocks.filter((block) => block.type === "bullet");
    const standardBullets = standardBlocks.filter((block) => block.type === "bullet");
    const deeperBullets = deeperBlocks.filter((block) => block.type === "bullet");
    const simpleParagraphs = simpleBlocks.filter((block) => block.type === "paragraph");
    const standardParagraphs = standardBlocks.filter((block) => block.type === "paragraph");
    const deeperParagraphs = deeperBlocks.filter((block) => block.type === "paragraph");

    if (simpleParagraphs.length !== 2 || standardParagraphs.length !== 2 || deeperParagraphs.length !== 2) {
      throw new Error(`Chapter ${chapter.number} must have exactly two summary paragraphs per depth`);
    }
    if (simpleBullets.length !== 7) throw new Error(`Chapter ${chapter.number} simple bullet count ${simpleBullets.length}`);
    if (standardBullets.length !== 10) throw new Error(`Chapter ${chapter.number} standard bullet count ${standardBullets.length}`);
    if (deeperBullets.length !== 15) throw new Error(`Chapter ${chapter.number} deeper bullet count ${deeperBullets.length}`);
    if (chapter.quiz.questions.length !== 10) throw new Error(`Chapter ${chapter.number} quiz count ${chapter.quiz.questions.length}`);
    if (chapter.examples.length !== 6) throw new Error(`Chapter ${chapter.number} example count ${chapter.examples.length}`);
    const scopes = countsByScope(chapter.examples);
    if (scopes.school !== 2 || scopes.work !== 2 || scopes.personal !== 2) {
      throw new Error(`Chapter ${chapter.number} must have two school, two work, and two personal scenarios`);
    }
    for (const question of chapter.quiz.questions) {
      if (!Array.isArray(question.choices) || question.choices.length !== 4) {
        throw new Error(`Chapter ${chapter.number} quiz choice count invalid`);
      }
    }
  }
}

const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
const authoredById = new Map(CHAPTERS.map((chapter) => [chapter.chapterId, chapter]));

pkg.createdAt = new Date().toISOString();

pkg.chapters = pkg.chapters.map((chapter) => {
  const authored = authoredById.get(chapter.chapterId);
  if (!authored) {
    throw new Error(`Missing authored chapter for ${chapter.chapterId}`);
  }

  const standardBullets = authored.standardBullets;
  const deeperBullets = [...standardBullets, ...authored.deeperBullets];
  const simpleBullets = SIMPLE_INDEXES.map((index) => standardBullets[index]);

  const sharedTakeaways =
    authored.takeaways ??
    [standardBullets[0].text, standardBullets[3].text, standardBullets[9].text];

  return {
    ...chapter,
    title: authored.title,
    contentVariants: {
      easy: makeVariant(authored.simpleSummary, simpleBullets, sharedTakeaways, authored.practice),
      medium: makeVariant(authored.standardSummary, standardBullets, sharedTakeaways, authored.practice),
      hard: makeVariant(authored.deeperSummary, deeperBullets, sharedTakeaways, authored.practice),
    },
    examples: authored.examples,
    quiz: {
      passingScorePercent: 80,
      questions: authored.quiz.map((question, index) => ({
        questionId: buildQuestionId(chapter.chapterId, index),
        ...question,
      })),
    },
  };
});

assertStructure(pkg);
assertNoDashContent(pkg);

writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + "\n");
mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, renderReport(pkg));

console.log(`Updated ${packagePath}`);
console.log(`Wrote ${reportPath}`);
