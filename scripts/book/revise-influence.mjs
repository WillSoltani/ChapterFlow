import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";

const packagePath = resolve(process.cwd(), "book-packages/influence.modern.json");
const reportPath = resolve(process.cwd(), "notes/influence-revision-report.md");

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

const SCENARIO_WRONG_BANK = [
  "Make the request louder so the other side has less space to resist.",
  "Avoid taking any clear position and hope agreement appears on its own.",
  "Copy the familiar script even if the real pressure point is somewhere else.",
  "Focus on sounding persuasive instead of checking what is actually moving the yes.",
  "Push for immediate agreement before the other person has time to think.",
  "Use whatever tactic feels strongest even if it damages trust later.",
  "Keep everyone equally comfortable even if the message gets weaker.",
  "Wait for certainty instead of reading the cues already in front of you.",
];

const AUDIT_SUMMARY = [
  "The existing Influence package was not ready to ship as premium learning content. It used the modern schema, but the actual writing was a near total template repeat. The same generic explanation of pressure, incentives, and legitimacy had been spread across all nine chapters with only the chapter label changed.",
  "That flattening broke fidelity. Cialdini's book is about specific compliance triggers such as reciprocity, commitment, social proof, liking, authority, scarcity, and unity. The current package kept replacing those mechanisms with vague judgment advice, so the learner was not actually being taught Cialdini's reasoning.",
  "The summary layers repeated each other, the scenarios used the same shells with different nouns, and the quiz questions often tested phrase recognition instead of applied understanding. Depth personalization was also structurally incomplete because the package used 6, 10, and 14 bullets instead of the required 7, 10, and 15.",
  "This revision therefore replaces the book wide content while keeping the current package shape. The goal is a faithful nine part lesson flow built around the existing chapter structure: an introduction to automatic shortcuts, seven core persuasion principles inside the platform's structure, and a final chapter on ethical use and defense.",
];

const MAIN_PROBLEMS = [
  "The summaries were generic and did not explain the real compliance mechanism in each chapter.",
  "The bullets repeated the same template logic across the book and flattened distinct principles into vague advice.",
  "The scenarios were recycled and often did not naturally fit the principle they were supposed to teach.",
  "The quizzes were too close to wording recall and did not pressure the learner to compare plausible alternatives.",
  "Depth variation missed the required 7, 10, and 15 bullet progression.",
  "Gentle, Direct, and Competitive were still generic reader tones rather than an Influence specific guidance layer.",
];

const PERSONALIZATION_STRATEGY = [
  "Depth lives in the package itself. Simple gives a fast but faithful read with seven bullets. Standard gives the strongest all around lesson with ten bullets. Deeper adds five real layers about trigger conditions, misuse, ethical limits, and transfer rather than repeating the same point more slowly.",
  "Motivation stays in the reader as a lean book specific layer rather than nine duplicated packages. The core idea of each principle stays fixed, while summary framing, scenario guidance, recap language, and quiz explanations shift with the user's preferred tone.",
  "Gentle for this book helps the reader stay calm and ethical while seeing the mechanism clearly. Direct emphasizes the trigger, the mistake, and the practical move. Competitive stresses edge, missed leverage, and the cost of being influenced by others before you notice the pattern.",
  "This keeps the schema stable while making the user experience across Simple, Standard, Deeper and Gentle, Direct, Competitive feel materially different.",
];

const SCHEMA_NOTE =
  "No schema change was required. The revision stays inside the current JSON package shape. Depth is authored in the package and motivation styling is handled in the reader with an Influence specific layer.";

const CHAPTER_REVISIONS = [
  chapter({
    chapterId: "ch01-why-people-use-shortcuts",
    number: 1,
    title: "Why People Use Shortcuts",
    readingTimeMinutes: 12,
    summary: {
      p1: t(
        "People use mental shortcuts because full analysis is too slow for daily life, and Cialdini argues that these automatic responses are neither rare nor foolish. They are efficient rules of thumb that help people decide quickly, especially when attention is limited or the situation feels familiar.",
        "This opening chapter explains why influence works at all. Most people cannot inspect every choice from first principles, so they rely on cues that usually point them in the right direction.",
        "Cialdini is not mocking human judgment. He is showing that speed creates vulnerability. Once a shortcut is activated at the right moment, people can say yes before they have properly examined why."
      ),
      p2: t(
        "This matters because the same mental shortcuts that make life manageable can also be exploited. If you know which cues trigger automatic agreement, you can use them more ethically and defend yourself more intelligently.",
        "The deeper lesson is that influence is often about conditions, not only arguments. A person may respond to a single signal such as authority, scarcity, or prior commitment while barely noticing the larger context.",
        "In real life, this chapter gives the whole book its frame. Learn the shortcuts, notice when they are firing, and decide whether they are serving judgment or bypassing it."
      ),
    },
    standardBullets: [
      bullet(
        "Shortcuts are normal. Cialdini argues that automatic responding is a practical feature of human decision making.",
        "People use quick cues because constant full analysis would be exhausting and slow."
      ),
      bullet(
        "Efficiency creates exposure. The faster a choice becomes, the easier it can be to steer with one strong signal.",
        "Convenience is useful, but it lowers the amount of scrutiny given to the request."
      ),
      bullet(
        "One cue can dominate. Under the right conditions, a single trigger can outweigh broader context for a moment.",
        "This is why seemingly small details can move compliance so strongly."
      ),
      bullet(
        "Automatic does not mean irrational. Many shortcuts work well most of the time because they reflect real patterns in life.",
        "The problem begins when the cue is present but the larger situation does not deserve the same response."
      ),
      bullet(
        "Low attention is a risk zone. Fatigue, distraction, overload, and repetition make people more likely to rely on automatic judgment.",
        "The less mental space available, the more powerful the shortcut becomes."
      ),
      bullet(
        "Influence often works through setup. The request matters, but the conditions around the request often matter just as much.",
        "A yes can be shaped before the person thinks they are deciding."
      ),
      bullet(
        "The same knowledge can be used well or badly. Cialdini wants readers to understand the tools of influence, not simply admire them.",
        "Ethical use and self protection both depend on seeing the mechanism clearly."
      ),
      bullet(
        "Defense starts with recognition. If you can spot when a shortcut is being triggered, you can pause before agreeing automatically.",
        "Awareness reopens room for judgment."
      ),
      bullet(
        "Context beats isolated cues. Strong judgment asks whether the signal really belongs here, not whether the signal exists at all.",
        "A good cue in the wrong situation can still mislead."
      ),
      bullet(
        "The chapter's closing idea is simple. Learn the shortcuts so you can use them responsibly and resist them when they are being used on you.",
        "That frame supports every later principle in the book."
      ),
    ],
    deeperBullets: [
      bullet(
        "Automatic responding is strongest when the mind expects a familiar pattern. The person stops asking what is unique about this case and starts reacting to what usually follows the cue.",
        "Habit and pattern recognition make shortcuts efficient and vulnerable at once."
      ),
      bullet(
        "Cialdini's opening chapter shifts the study of persuasion away from personality myths. Influence does not depend only on charm or force. It often depends on which trigger enters the decision first.",
        "That makes the book more scientific and less theatrical."
      ),
      bullet(
        "Good influence and bad influence may use the same mechanism. The ethical difference is whether the shortcut leads the person toward a genuinely fitting decision or toward one they would reject under fuller scrutiny.",
        "Mechanism alone does not settle morality."
      ),
      bullet(
        "The best defense is selective alertness, not constant paranoia. If you tried to inspect everything equally, you would lose the efficiency shortcuts provide in the first place.",
        "The skill is knowing which moments deserve a deliberate pause."
      ),
      bullet(
        "This chapter matters because it teaches leverage at the level of attention and processing. Once you see that yes can be shaped by cues, every later principle becomes easier to understand and harder to ignore.",
        "The invisible machinery of influence becomes visible."
      ),
    ],
    takeaways: [
      "Shortcuts are normal decision tools",
      "Efficiency creates influence openings",
      "One cue can sometimes dominate",
      "Low attention increases automatic responding",
      "Recognition is the start of defense",
      "Mechanism does not settle ethics",
    ],
    practice: [
      "Notice one moment today when you answered from habit instead of analysis",
      "Ask which cue pushed the decision forward",
      "Pause longer when tired or overloaded",
      "Check whether the cue fits the full context",
    ],
    examples: [
      example(
        "ch01-ex01",
        "Fast sign up at a student fair",
        ["school"],
        "At a busy campus fair, a club leader asks you to sign up right away because everyone else is already doing it and the line is moving fast. You barely know what the club actually does.",
        [
          "Pause and ask one grounding question about what the commitment really includes before signing.",
          "Do not let speed and social momentum stand in for understanding."
        ],
        "The shortcut is not the problem by itself. The problem is letting speed create a yes before you have matched the cue to the real choice."
      ),
      example(
        "ch01-ex02",
        "Group chat pressure before an event",
        ["school"],
        "A class group chat is quickly agreeing to one plan for an event, and you feel the urge to answer yes just because everyone else already has.",
        [
          "Step back long enough to check whether you actually support the plan or are only responding to momentum.",
          "A short pause can separate your judgment from the room's pace."
        ],
        "Automatic responding often feels social rather than mental. The group speed becomes the cue that bypasses fuller thought."
      ),
      example(
        "ch01-ex03",
        "Sales email at the end of a long day",
        ["work"],
        "At the end of a draining workday, you get an email asking for immediate approval on a paid tool upgrade. The message uses urgency and confidence, and you are tempted to clear it quickly just to empty the inbox.",
        [
          "Delay the decision until you have enough attention to judge whether the request deserves the urgency it is claiming.",
          "Protect tired moments from fast yes decisions."
        ],
        "Low attention makes single cues more powerful. The strongest defense is noticing when your mental bandwidth is too low for a clean decision."
      ),
      example(
        "ch01-ex04",
        "Manager asks for a quick favor in passing",
        ["work"],
        "A manager casually asks whether you can take on one more task while walking between meetings, and you almost agree before thinking about your actual workload.",
        [
          "Ask for a short moment to review the tradeoff before answering so the request is judged in context instead of in motion.",
          "Do not confuse quick access with a requirement to answer quickly."
        ],
        "The setting itself can be part of the influence. A moving rushed context nudges the mind toward automatic compliance."
      ),
      example(
        "ch01-ex05",
        "Free trial that feels harmless",
        ["personal"],
        "You are about to start a free trial because the offer looks easy and low cost, but you have not checked what happens after the first week ends.",
        [
          "Read the full condition before agreeing and ask whether the ease of entry is hiding a larger commitment later.",
          "Use attention on the part of the decision that the shortcut is trying to skip."
        ],
        "Shortcuts often focus attention on the attractive cue while pulling it away from the real cost structure."
      ),
      example(
        "ch01-ex06",
        "Invited into a fast emotional yes",
        ["personal"],
        "A friend makes a request while you are feeling grateful, relaxed, and socially close, and you sense that the emotional atmosphere is making yes feel more natural than reflection.",
        [
          "Acknowledge the request warmly, then give yourself enough distance to decide whether the answer fits your actual priorities.",
          "Kindness does not require instant compliance."
        ],
        "The opening chapter matters because many yes decisions are shaped by state, not only by substance."
      ),
    ],
    directQuestions: [
      question(
        "ch01-q01",
        "What is the main reason people rely on judgment shortcuts?",
        [
          "They dislike careful thinking in every setting.",
          "They need efficient ways to decide in a world with too much information and too little attention.",
          "They are usually too emotional to reason well.",
          "They prefer to let other people decide for them."
        ],
        1,
        "Cialdini treats shortcuts as normal efficiency tools, not as proof of foolishness."
      ),
      question(
        "ch01-q02",
        "When does a shortcut become risky?",
        [
          "When the cue is present but the wider situation does not deserve the usual response.",
          "Whenever the decision matters at all.",
          "Only when other people are involved.",
          "Only when money is involved."
        ],
        0,
        "The cue may be real, but the broader context may not justify trusting it automatically."
      ),
      question(
        "ch01-q03",
        "Which move best protects you from automatic agreement?",
        [
          "Reject all fast decisions on principle.",
          "Pause selectively when a strong cue appears under low attention or pressure.",
          "Assume every request is manipulative.",
          "Trust first instinct because it is more authentic."
        ],
        1,
        "The goal is not constant suspicion. It is selective alertness when shortcuts are likely to fire."
      ),
      question(
        "ch01-q04",
        "Why does this opening chapter matter for the rest of the book?",
        [
          "It shows that influence is mostly about charisma.",
          "It proves people cannot make good decisions.",
          "It explains the general mechanism that later principles trigger in more specific ways.",
          "It argues that persuasion is always unethical."
        ],
        2,
        "The later principles are more concrete triggers inside the wider system of automatic responding introduced here."
      ),
    ],
  }),
  chapter({
    chapterId: "ch02-reciprocity-creates-obligation",
    number: 2,
    title: "Reciprocity Creates Obligation",
    readingTimeMinutes: 13,
    summary: {
      p1: t(
        "Reciprocity creates a strong pressure to return what has been given, and Cialdini argues that this norm is one of the most powerful social forces behind compliance. When someone gives a favor, a concession, help, or unexpected kindness first, people often feel an immediate pull to repay it.",
        "The principle is powerful because it supports social life. Cooperation becomes easier when people expect giving to be answered rather than ignored.",
        "Cialdini's warning is that the same norm can be weaponized. A small gift or strategic favor can create obligation far larger than the original gesture deserves."
      ),
      p2: t(
        "This matters because people often answer the feeling of debt before evaluating whether the request itself makes sense. They are trying to clear the social pressure, not judge the offer calmly.",
        "The deeper lesson is that obligation can be manufactured. What feels like fairness may really be a compliance setup designed to make refusal socially uncomfortable.",
        "In real life, this chapter teaches two skills. Give first when you want to build trust ethically, and notice when someone else's giving is trying to buy a yes that you would not freely choose."
      ),
    },
    standardBullets: [
      bullet(
        "Reciprocity is ancient and strong. Cialdini treats it as a basic social rule that supports exchange and cooperation.",
        "People generally want to repay what they receive."
      ),
      bullet(
        "Giving creates pressure. A favor can produce obligation even before the other person has judged the later request.",
        "The emotional debt arrives fast."
      ),
      bullet(
        "Small gifts can trigger large compliance. The return pressure often outweighs the actual size of the first gesture.",
        "This is what makes the principle so easy to misuse."
      ),
      bullet(
        "Uninvited favors are especially tricky. You may feel obliged to repay something you never asked for in the first place.",
        "The norm can still fire even when the gift was imposed."
      ),
      bullet(
        "Concessions also activate reciprocity. When someone appears to give ground, people often feel pressure to give ground back.",
        "This helps explain why retreat after an extreme ask can be persuasive."
      ),
      bullet(
        "Debt can outrun judgment. People sometimes agree just to relieve the pressure of owing, not because the request is wise.",
        "The need to rebalance the social ledger can become stronger than evaluation."
      ),
      bullet(
        "Ethical use starts with real generosity. Giving is strongest when it is sincere, relevant, and not disguised as a trap.",
        "Trust grows when the first move is genuinely valuable."
      ),
      bullet(
        "Defense begins with reframing. If the gift was manipulative, you can treat it as a tactic rather than as a true favor that deserves repayment.",
        "That breaks some of the artificial obligation."
      ),
      bullet(
        "Reciprocity works in daily life, not only in sales. Invitations, advice, introductions, help, and emotional labor can all trigger it.",
        "The principle is ordinary, which is why it is easy to miss."
      ),
      bullet(
        "The chapter's closing insight is balance. Reciprocity sustains healthy exchange, but it becomes dangerous when debt is manufactured to steer consent.",
        "The point is to keep generosity human instead of coercive."
      ),
    ],
    deeperBullets: [
      bullet(
        "Reciprocity is powerful because refusing to return a favor can feel like refusing membership in the social order itself. The pressure is not only private guilt. It is fear of seeming selfish or ungrateful.",
        "That social cost gives the norm its force."
      ),
      bullet(
        "The most skillful manipulators give strategically irrelevant gifts. The item may be small, but the psychological debt can be aimed at a much larger request later.",
        "Size of gift and size of compliance do not have to match."
      ),
      bullet(
        "Concession based reciprocity is especially subtle because it can feel like fairness or compromise rather than influence. Yet the structure is the same. One side moves first and expects movement back.",
        "This is why door in the face techniques can work."
      ),
      bullet(
        "Defending yourself does not require becoming cold. It requires distinguishing true generosity from engineered obligation and responding to each accordingly.",
        "The principle can be honored without being exploited."
      ),
      bullet(
        "The strategic gain of understanding reciprocity is twofold. You can create real trust through thoughtful giving, and you can stop confusing social debt with actual good judgment.",
        "That makes the principle useful from both sides of the exchange."
      ),
    ],
    takeaways: [
      "People feel pressure to return what they receive",
      "Small gifts can create large obligation",
      "Unasked favors can still trigger debt",
      "Concessions also invite return movement",
      "Reframe manipulative gifts as tactics",
      "Real generosity builds trust better than traps",
    ],
    practice: [
      "Notice one moment this week when a favor changed your willingness to say yes",
      "Ask whether a gift was generous or strategic",
      "Pause before repaying with a bigger commitment than the gesture deserves",
      "Use giving to help first, not to corner later",
    ],
    examples: [
      example(
        "ch02-ex01",
        "Class notes before an ask",
        ["school"],
        "A classmate sends you very organized notes before an exam, and the next day asks you to take over their part of a project because they are stressed.",
        [
          "Thank them for the notes, but judge the project request on its own merits instead of repaying with a commitment that is too large.",
          "Separate gratitude from obligation."
        ],
        "Reciprocity can make the second request feel morally linked to the first gift even when the exchange is no longer balanced."
      ),
      example(
        "ch02-ex02",
        "Club leadership makes a public concession",
        ["school"],
        "In a club meeting, a leader backs away from one strict policy after pushback and then immediately asks members to accept a different rule without debate.",
        [
          "Notice the pressure to return the concession and examine the new rule on its own quality before agreeing.",
          "Do not let the social urge to reciprocate replace evaluation."
        ],
        "Concessions can be persuasive because they create the feeling that fairness requires movement back."
      ),
      example(
        "ch02-ex03",
        "Vendor gives free extras first",
        ["work"],
        "A vendor offers extra support and a few free add ons during a trial, then asks for a faster contract decision than your team usually allows.",
        [
          "Acknowledge the help, but return to the normal decision standard so the gift does not buy a rushed yes.",
          "Keep gratitude and procurement judgment separate."
        ],
        "The principle matters because gifts can shorten scrutiny if they are allowed to create a stronger sense of debt than they deserve."
      ),
      example(
        "ch02-ex04",
        "Coworker keeps doing favors before asking coverage",
        ["work"],
        "A coworker often covers small tasks for you without being asked, then regularly uses those moments to pressure you into taking difficult late shifts for them.",
        [
          "Recognize the growing debt pattern and stop paying it back with commitments that consistently cost you more than the original favors did.",
          "Set a clearer boundary around what help creates and what it does not create."
        ],
        "Reciprocity becomes coercive when the exchange stops being proportional and starts functioning like stored leverage."
      ),
      example(
        "ch02-ex05",
        "Gift before a personal favor",
        ["personal"],
        "A relative brings you an unexpected gift and then soon asks for a favor you had already decided you did not want to do.",
        [
          "Thank them for the gift, but do not let the social discomfort of refusal decide the answer to the later request.",
          "You can appreciate the gesture without turning it into a binding obligation."
        ],
        "The emotional pull comes from not wanting to look ungrateful. Naming that pressure makes it easier to answer honestly."
      ),
      example(
        "ch02-ex06",
        "Date pays for everything and sets a pace",
        ["personal"],
        "Someone you are dating keeps paying for most things early on, and you notice a growing pressure to match their pace of closeness because it feels unfair to keep accepting generosity without giving something back.",
        [
          "Separate financial or social generosity from decisions about intimacy and make those choices on your actual comfort and judgment.",
          "Repayment does not need to take the form the other person quietly prefers."
        ],
        "Reciprocity can spill into areas where consent and timing should never be governed by debt."
      ),
    ],
    directQuestions: [
      question(
        "ch02-q01",
        "Why is reciprocity such a powerful influence force?",
        [
          "Because people like gifts more than rules.",
          "Because people feel social and moral pressure to repay what they have received.",
          "Because favors always produce trust.",
          "Because people cannot refuse after any gift."
        ],
        1,
        "The norm is powerful because repayment feels tied to fairness and social belonging."
      ),
      question(
        "ch02-q02",
        "What makes an uninvited favor influential?",
        [
          "It creates gratitude only if the item is expensive.",
          "It can trigger obligation even when the recipient never asked for it.",
          "It guarantees later compliance.",
          "It works only with strangers."
        ],
        1,
        "The norm can fire even when the original favor was imposed rather than requested."
      ),
      question(
        "ch02-q03",
        "Which response best defends against manipulative reciprocity?",
        [
          "Reject every generous act from now on.",
          "Repay immediately with whatever the other person asks.",
          "Reframe the gesture as a tactic if it was used to manufacture debt, then judge the request independently.",
          "Accept the debt and feel resentful."
        ],
        2,
        "The key defense is separating true generosity from engineered obligation."
      ),
      question(
        "ch02-q04",
        "What does concession based reciprocity show?",
        [
          "That compromise is always fake.",
          "That people often feel pressure to move after the other side appears to have moved first.",
          "That the first request should always be extreme.",
          "That fairness makes persuasion unnecessary."
        ],
        1,
        "A visible concession can trigger return movement even when the new offer still needs independent evaluation."
      ),
    ],
  }),
  chapter({
    chapterId: "ch03-consistency-shapes-identity",
    number: 3,
    title: "Consistency Shapes Identity",
    readingTimeMinutes: 14,
    summary: {
      p1: t(
        "Once people commit to a position, Cialdini argues that they feel pressure to behave consistently with it. Public statements, written choices, and small initial agreements can shape later behavior because people want to look stable to others and to themselves.",
        "This principle is powerful because consistency normally helps life work. It supports reliability, identity, and follow through.",
        "The danger is that an early commitment can keep guiding action long after the original reasons have weakened. People may defend the prior yes simply because it is now part of who they believe they are."
      ),
      p2: t(
        "This matters because influence often becomes easier after the first small step. A modest initial commitment can quietly prepare the ground for a much larger request later.",
        "The deeper lesson is that identity talk is persuasive. If a choice is framed as evidence of who you are, consistency pressure grows stronger than logic alone might justify.",
        "In real life, this chapter teaches both how to build steadier habits and how to resist being walked from a small yes into a larger one that no longer fits your interests."
      ),
    },
    standardBullets: [
      bullet(
        "Commitment creates momentum. Once people have taken a stand, they often feel pressure to stay aligned with it.",
        "The prior choice begins shaping later ones."
      ),
      bullet(
        "Consistency supports identity. People want to appear dependable and coherent to themselves and to others.",
        "That desire gives the principle its emotional power."
      ),
      bullet(
        "Small first steps matter. A modest early yes can increase the odds of a larger later yes.",
        "The first commitment changes the psychological terrain."
      ),
      bullet(
        "Public commitments are stronger. When other people can see the stance, backing away becomes more costly.",
        "Visibility adds social pressure to internal pressure."
      ),
      bullet(
        "Written commitments can deepen follow through. Putting a position into words makes it feel more real and more self authored.",
        "Expression strengthens ownership."
      ),
      bullet(
        "People often defend old choices automatically. They may justify the original commitment rather than reconsider whether it still makes sense.",
        "Consistency can outrun reality."
      ),
      bullet(
        "Ethical use starts with genuine alignment. Help people commit to actions that truly fit their values and interests.",
        "Consistency is strongest when it supports rather than distorts identity."
      ),
      bullet(
        "Defense begins with reexamination. A prior yes does not deserve obedience forever if the conditions have changed.",
        "Past commitment should inform judgment, not replace it."
      ),
      bullet(
        "Watch the foot in the door pattern. The smaller request may matter most because it is laying identity groundwork for the next request.",
        "The sequence is the persuasion."
      ),
      bullet(
        "The chapter's closing lesson is disciplined consistency. Let your commitments guide you when they still fit, and revise them cleanly when they no longer do.",
        "Integrity is not blind repetition."
      ),
    ],
    deeperBullets: [
      bullet(
        "Consistency is powerful because it makes thinking cheaper after the first decision. Once identity is attached, people stop re evaluating from zero each time.",
        "That saves effort and increases vulnerability."
      ),
      bullet(
        "Public image and private self image reinforce each other. The more visible the commitment, the more uncomfortable reversal can feel.",
        "This is why public promises often outlast private confidence."
      ),
      bullet(
        "The most effective early commitments feel voluntary and self chosen. Pressure works less well than helping the person generate their own stated position.",
        "Ownership deepens the later pull toward consistency."
      ),
      bullet(
        "Consistency becomes dangerous when it is mistaken for virtue by itself. A person can remain loyal to a bad path simply because changing course now feels embarrassing.",
        "Stubbornness can borrow the costume of integrity."
      ),
      bullet(
        "The strategic gain of this principle is sequence awareness. If you understand how the first yes shapes the second, you can design better habit formation and resist slow compliance traps.",
        "The pressure is often built step by step."
      ),
    ],
    takeaways: [
      "Commitment shapes later action",
      "Consistency is tied to identity",
      "Small first steps matter",
      "Public and written commitments are stronger",
      "Old yes decisions can outlive good reasons",
      "Integrity includes revising when needed",
    ],
    practice: [
      "Notice one small yes that is shaping later choices",
      "Ask whether a past commitment still fits current reality",
      "Use written commitments for habits you genuinely want",
      "Pause when someone starts with a harmless first step",
    ],
    examples: [
      example(
        "ch03-ex01",
        "Volunteer once then every week",
        ["school"],
        "You agree to help at one school event because it sounds easy, and soon the organizer is treating you like a reliable ongoing volunteer for the whole semester.",
        [
          "Recognize that the first small yes is shaping how both you and the organizer now read your role, then decide explicitly whether you want that identity or not.",
          "Do not let inertia answer the bigger question."
        ],
        "Consistency pressure often grows from a harmless beginning. The first step changes the meaning of the next request."
      ),
      example(
        "ch03-ex02",
        "Public opinion in class discussion",
        ["school"],
        "You make a confident statement in class early in a discussion, and later evidence starts pointing the other way, but you feel pressure to keep defending the first position.",
        [
          "Notice that the discomfort is about consistency and image, then update the view openly instead of protecting the first claim at the cost of accuracy.",
          "Changing your mind can be cleaner than performing certainty."
        ],
        "The principle is powerful because public statements quickly become identity material."
      ),
      example(
        "ch03-ex03",
        "Free pilot turns into a bigger rollout",
        ["work"],
        "Your team agrees to a very limited pilot with a vendor, and soon the vendor is framing a larger purchase as the natural next step because the organization has already said yes once.",
        [
          "Treat the pilot as a separate decision and judge the larger proposal from current evidence instead of from the pressure to be consistent with the earlier agreement.",
          "Sequence should not replace scrutiny."
        ],
        "A small first commitment can create momentum toward a larger move that feels pre approved even when it still needs its own test."
      ),
      example(
        "ch03-ex04",
        "Manager asks for a small extra stretch",
        ["work"],
        "You take on one small extra responsibility to be helpful, and a manager soon starts building a larger workload expectation around that first act.",
        [
          "Clarify whether the first yes was situational help or a genuine role expansion before consistency pressure turns it into a silent contract.",
          "Name the category before it hardens."
        ],
        "Commitments become persuasive because people prefer to act like the same person across time."
      ),
      example(
        "ch03-ex05",
        "Dating pace after one early yes",
        ["personal"],
        "You agreed to one level of closeness early in a new relationship, and now you feel uneasy because the other person treats that first yes as proof you should keep escalating at the same pace.",
        [
          "Separate past willingness from present judgment and reset the pace clearly if the earlier step is being used as a lever.",
          "Consistency should not overrule comfort or consent."
        ],
        "The pressure here is not always explicit. Often it comes from the story that one prior yes must define the next one."
      ),
      example(
        "ch03-ex06",
        "You keep defending an expensive choice",
        ["personal"],
        "You bought something costly and now keep praising it to yourself and others even though you are starting to suspect it was not a good decision.",
        [
          "Notice the urge to stay consistent with the original purchase and allow yourself to reassess without turning revision into personal failure.",
          "Identity protection can make bad decisions last longer than they need to."
        ],
        "Consistency pressure often appears after the commitment, when the mind starts defending the prior yes to avoid discomfort."
      ),
    ],
    directQuestions: [
      question(
        "ch03-q01",
        "Why does a small first commitment matter so much?",
        [
          "Because it is usually the biggest request in the sequence.",
          "Because it can reshape identity and prepare the person to act consistently later.",
          "Because people always forget the second request.",
          "Because written agreements stop mattering after the first one."
        ],
        1,
        "The first step matters because it changes how later steps are interpreted by the person making them."
      ),
      question(
        "ch03-q02",
        "What usually makes a commitment more powerful?",
        [
          "Keeping it vague and private.",
          "Making it public or putting it in the person's own words.",
          "Adding more pressure from the outside.",
          "Moving quickly before the person notices."
        ],
        1,
        "Public and self authored commitments deepen the pull toward later consistency."
      ),
      question(
        "ch03-q03",
        "What is the healthiest defense against harmful consistency pressure?",
        [
          "Never commit to anything.",
          "Assume every old promise must still be obeyed.",
          "Reexamine whether the prior commitment still fits present reality.",
          "Hide your commitments from other people."
        ],
        2,
        "The key is not rejecting commitment. It is refusing to let past yes decisions replace current judgment."
      ),
      question(
        "ch03-q04",
        "What is the most important caution in this chapter?",
        [
          "Consistency is stronger than truth.",
          "People can mistake stubborn continuation for integrity.",
          "Public promises are always manipulative.",
          "Changing your mind usually destroys trust."
        ],
        1,
        "Cialdini's warning is that consistency is useful until it becomes blind loyalty to a path that no longer fits."
      ),
    ],
  }),
  chapter({
    chapterId: "ch04-social-proof-guides-uncertainty",
    number: 4,
    title: "Social Proof Guides Uncertainty",
    readingTimeMinutes: 15,
    summary: {
      p1: t(
        "When people are unsure what to do, Cialdini argues that they often look to the behavior of others as evidence of what is correct. Social proof becomes especially persuasive under uncertainty because other people's actions feel like a shortcut to reality.",
        "The principle is most powerful when the observed others seem similar, numerous, or calm in the face of the same ambiguity.",
        "Cialdini's central warning is that crowds can guide well and mislead well. Looking outward for clues is useful, but it can also produce mass error if everyone is reading everyone else instead of the situation."
      ),
      p2: t(
        "This matters because uncertainty is common. People copy restaurant lines, classroom reactions, online reviews, workplace habits, and social norms because shared behavior seems safer than standing alone with incomplete information.",
        "The deeper lesson is that imitation grows strongest where clarity is weakest. If the facts are thin, the crowd becomes more persuasive.",
        "In real life, this chapter teaches two skills. Use social proof responsibly when it reflects real evidence, and become suspicious when similarity, urgency, or group momentum is replacing actual judgment."
      ),
    },
    standardBullets: [
      bullet(
        "Social proof answers uncertainty. People often decide what is correct by noticing what others are doing.",
        "The less clear the situation feels, the stronger this pull becomes."
      ),
      bullet(
        "Similarity magnifies the effect. Other people's behavior is most persuasive when they seem like people in your position.",
        "Comparable others feel more diagnostic than distant ones."
      ),
      bullet(
        "Crowds can calm and crowd can distort. Social proof is not automatically wrong, but it is not automatically wise either.",
        "The quality of the crowd matters."
      ),
      bullet(
        "Plural ignorance is a risk. Groups can reinforce error when each person uses the others as evidence that nothing is wrong.",
        "Everyone can misread the room together."
      ),
      bullet(
        "Uncertainty is the amplifier. When facts are weak, copied behavior becomes more attractive than private judgment.",
        "That is why confusion is fertile ground for conformity."
      ),
      bullet(
        "Visible numbers create pressure. Many examples, many reviews, or many people doing one thing can feel like proof by volume.",
        "Quantity often stands in for quality."
      ),
      bullet(
        "Ethical use depends on accuracy. Social proof is most legitimate when it reflects real behavior from relevant similar others.",
        "Honest evidence helps people orient without distorting them."
      ),
      bullet(
        "Defense begins with checking the base reality. Ask whether the group behavior is informed, independent, and truly relevant to your case.",
        "A crowd is persuasive. It is not automatically correct."
      ),
      bullet(
        "Online settings intensify the principle. Likes, ratings, rankings, and visible adoption counts turn social proof into a constant signal.",
        "Digital platforms make copied behavior easier to display and easier to trust too quickly."
      ),
      bullet(
        "The chapter's closing idea is disciplined observation. Learn from what others are doing, but do not let the crowd do all the thinking for you.",
        "Social evidence should support judgment, not replace it."
      ),
    ],
    deeperBullets: [
      bullet(
        "Social proof works partly because it lowers the private cost of decision making. If many similar others have already chosen, your choice can feel less risky and less lonely.",
        "The comfort of shared behavior can be as persuasive as the evidence it seems to provide."
      ),
      bullet(
        "The most dangerous social proof appears when no one has good information but everyone assumes someone else does. The resulting loop can produce confident collective error.",
        "This is why uncertainty and imitation can become a trap."
      ),
      bullet(
        "Negative norms also spread through social proof. If people keep seeing disengagement, cheating, or rudeness as common, those behaviors can become more available to them.",
        "The principle shapes decline as well as improvement."
      ),
      bullet(
        "The better use of social proof is selective matching. Similar others should be truly similar in knowledge, incentives, and context, not just superficially alike.",
        "Relevance matters more than raw resemblance."
      ),
      bullet(
        "The strategic gain of understanding this principle is better independent judgment under ambiguity. You can take in social evidence without being swallowed by it.",
        "That balance is rare and useful."
      ),
    ],
    takeaways: [
      "People copy others when unsure",
      "Similarity increases trust in the cue",
      "Crowds can guide or mislead",
      "Uncertainty strengthens imitation",
      "Social proof online is constant and potent",
      "Check whether group behavior deserves trust",
    ],
    practice: [
      "Notice one decision today where other people's behavior shaped your choice",
      "Ask whether the examples were truly similar to you",
      "Check whether the group had real information or only shared momentum",
      "Pause when visible numbers start feeling like proof by themselves",
    ],
    examples: [
      example(
        "ch04-ex01",
        "Silence in a difficult class",
        ["school"],
        "In a difficult lecture, nobody asks a question after the teacher explains something confusing, and you almost assume everyone else understands even though several faces look lost.",
        [
          "Treat the silence as ambiguous rather than as proof of understanding and ask the clarifying question if you need it.",
          "Do not let the group's inaction define reality too quickly."
        ],
        "Social proof becomes misleading when everyone is using everyone else's silence as evidence that confusion is private."
      ),
      example(
        "ch04-ex02",
        "Student group copies weak effort",
        ["school"],
        "A group project begins with one or two people doing very little, and soon the rest of the team starts matching that low effort because it now feels normal.",
        [
          "Reset the visible norm early by making strong contribution and clear expectations more public than the drift toward passivity.",
          "Do not let the first weak pattern become the social proof for everyone else."
        ],
        "Negative norms spread for the same reason positive ones do. Visible behavior teaches what is acceptable."
      ),
      example(
        "ch04-ex03",
        "Product decision driven by competitor behavior",
        ["work"],
        "A team wants to copy a competitor feature mainly because many other companies are already doing it, even though the customer evidence inside your own product is weak.",
        [
          "Treat industry movement as one signal, then test whether those companies are truly relevant models for your users, incentives, and timing.",
          "Do not let visible adoption replace fit."
        ],
        "Social proof can look strategic while quietly becoming lazy imitation if relevance is not checked."
      ),
      example(
        "ch04-ex04",
        "Meeting mood flips after a few voices",
        ["work"],
        "In a meeting, the first few people react positively to a shaky idea, and the rest of the room starts aligning before anyone has really examined the proposal.",
        [
          "Interrupt the drift by asking for the underlying evidence before the early reactions harden into the meeting's shared position.",
          "Name the need for substance before momentum becomes its own proof."
        ],
        "Early visible agreement can create a social proof cascade that outpaces the quality of the idea."
      ),
      example(
        "ch04-ex05",
        "Restaurant line feels like proof",
        ["personal"],
        "You are choosing between two places to eat while traveling and feel drawn to the one with the line, even though you know almost nothing else about either option.",
        [
          "Use the line as one clue rather than as a final answer and check whether the crowd is actually similar to what you want from the experience.",
          "Crowded can mean good. It can also mean convenient, familiar, or tourist friendly."
        ],
        "Social proof helps when other people are relevant guides. It misleads when the only real evidence is visible popularity."
      ),
      example(
        "ch04-ex06",
        "Online reviews steer a personal buy",
        ["personal"],
        "You are about to buy something because it has a high rating and thousands of reviews, but you have not checked whether the reviewers care about the same features you do.",
        [
          "Look for proof from users with needs close to yours instead of being persuaded by volume alone.",
          "Similarity matters more than raw numbers."
        ],
        "Digital social proof is powerful because it is visible, fast, and easy to mistake for objective truth."
      ),
    ],
    directQuestions: [
      question(
        "ch04-q01",
        "When is social proof most persuasive?",
        [
          "When the choice is obvious and low stakes.",
          "When the situation is uncertain and the observed others seem similar.",
          "When the crowd is large no matter who they are.",
          "When the person already has strong private evidence."
        ],
        1,
        "Cialdini ties the strength of social proof to uncertainty and perceived similarity."
      ),
      question(
        "ch04-q02",
        "What is the biggest risk in relying on social proof?",
        [
          "It always leads to selfish choices.",
          "It can turn shared confusion into shared certainty without real evidence.",
          "It only works in public spaces.",
          "It makes people act too slowly."
        ],
        1,
        "Collective error becomes likely when everyone is treating everyone else as evidence instead of checking the situation directly."
      ),
      question(
        "ch04-q03",
        "What is the strongest defense against misleading social proof?",
        [
          "Ignore all other people completely.",
          "Copy only the first visible reaction.",
          "Ask whether the observed others are informed, independent, and genuinely relevant to your case.",
          "Trust the largest number available."
        ],
        2,
        "The key is not rejecting social evidence. It is testing whether the source actually deserves to guide you."
      ),
      question(
        "ch04-q04",
        "Why are online ratings and visible counts so influential?",
        [
          "Because they make social proof immediate and easy to treat as objective evidence.",
          "Because online behavior is always honest.",
          "Because numbers remove all uncertainty.",
          "Because digital choices are simpler than offline ones."
        ],
        0,
        "Digital platforms display social proof constantly, which makes copied behavior feel factual and frictionless."
      ),
    ],
  }),
  chapter({
    chapterId: "ch05-liking-lowers-resistance",
    number: 5,
    title: "Liking Lowers Resistance",
    readingTimeMinutes: 16,
    summary: {
      p1: t(
        "People prefer to say yes to people they like, and Cialdini argues that warmth, familiarity, similarity, compliments, and cooperation can lower resistance long before the request itself is examined. Liking works because it changes how the requester and the request are felt together.",
        "The principle is stronger than simple friendliness. Attraction to the person can spill over onto judgments about the offer, the risk, and the motive behind it.",
        "Cialdini's warning is that liking can bias consent. People often grant trust or flexibility to a pleasant familiar person that they would not grant to a stranger making the same ask."
      ),
      p2: t(
        "This matters because liking is woven into ordinary life. Friends, peers, attractive strangers, charming salespeople, and cooperative teammates all benefit from the same basic bias toward agreeable people.",
        "The deeper lesson is that positive feeling can mask weak evaluation. Similarity, flattery, and shared identity cues can make the mind feel safer than the facts justify.",
        "In practice, this chapter teaches two balanced habits. Build genuine rapport when you want to persuade ethically, and separate warmth from evidence when you need a clean decision."
      ),
    },
    standardBullets: [
      bullet(
        "Liking lowers resistance. People are more open to requests from people they enjoy, trust, or feel close to.",
        "The person becomes part of the persuasive force."
      ),
      bullet(
        "Similarity creates comfort. Shared background, interests, style, or experience can make someone feel safer and more persuasive.",
        "We often trust the familiar before we examine the facts."
      ),
      bullet(
        "Compliments work because they change mood and relationship. Even imperfect praise can increase liking when it feels plausible enough.",
        "Warm feeling can widen the path to yes."
      ),
      bullet(
        "Familiarity matters. Repeated exposure can increase comfort even without deep evidence.",
        "What feels known often feels better."
      ),
      bullet(
        "Physical attractiveness can spill over. People often infer other positive qualities from appearance.",
        "This halo effect can bias judgment quickly."
      ),
      bullet(
        "Cooperation strengthens liking. Working with someone toward a shared goal can make their requests feel more legitimate and easier to accept.",
        "Partnership changes persuasion."
      ),
      bullet(
        "Rapport can be ethical. Building sincere connection helps people listen more openly without requiring deception.",
        "Real warmth often improves communication quality."
      ),
      bullet(
        "Defense begins with separation. Ask whether you would say yes if the same request came from someone you liked less.",
        "That question can reveal how much liking is driving the answer."
      ),
      bullet(
        "Warmth is not proof. A pleasant person can still make a weak offer, and an awkward person can still make a strong one.",
        "Good judgment needs evidence beyond attraction."
      ),
      bullet(
        "The chapter's closing lesson is to respect the bias. Liking is human and useful, but it should open the conversation, not decide it alone.",
        "Connection should support judgment instead of replacing it."
      ),
    ],
    deeperBullets: [
      bullet(
        "Liking is persuasive because it reduces social friction. The more ease and goodwill someone creates, the less defensive scrutiny their request may face.",
        "Pleasant feeling alters cognitive posture as well as emotional posture."
      ),
      bullet(
        "The halo effect can be especially costly when decisions are high stakes. A positive trait such as humor, style, or beauty may cause people to overestimate honesty or competence without real basis.",
        "One admired quality can contaminate the rest of the evaluation."
      ),
      bullet(
        "Engineered similarity is common because it is cheap and effective. Mirroring background, finding common ground fast, or using insider language can create a sense of kinship before trust has been earned.",
        "The cue can feel intimate even when it is strategic."
      ),
      bullet(
        "The strongest ethical use of liking comes from genuine regard and collaboration, not from synthetic charm. People notice the difference over time even when the first effect is similar.",
        "Durable influence depends on real relationship, not just pleasant technique."
      ),
      bullet(
        "The strategic gain of understanding this principle is better discernment around warmth. You can appreciate connection while still checking whether the request deserves agreement on its own terms.",
        "That protects both kindness and judgment."
      ),
    ],
    takeaways: [
      "People say yes more easily to people they like",
      "Similarity and familiarity create comfort",
      "Compliments and attractiveness can bias trust",
      "Cooperation deepens liking",
      "Warmth should be separated from evidence",
      "Genuine rapport is stronger than synthetic charm",
    ],
    practice: [
      "Ask whether the request would still look good from a less likable person",
      "Notice one halo effect this week",
      "Build rapport by listening and cooperating instead of performing charm",
      "Check whether similarity is real or merely persuasive",
    ],
    examples: [
      example(
        "ch05-ex01",
        "Friendly classmate makes a bigger ask",
        ["school"],
        "A classmate you genuinely like asks you to cover more of the presentation because you work well together and they know you will probably help.",
        [
          "Judge the fairness of the workload separately from how much you enjoy them and answer from the actual tradeoff, not only from goodwill.",
          "Warmth can stay intact even if the answer is no."
        ],
        "Liking makes generosity feel easier, which is good until it starts hiding whether the request is balanced."
      ),
      example(
        "ch05-ex02",
        "Campus rep wins trust too fast",
        ["school"],
        "A campus ambassador feels instantly convincing because they are funny, stylish, and seem very similar to you, even though you know little about the program they are promoting.",
        [
          "Enjoy the connection, but pause to test the actual claims before letting similarity stand in for evidence.",
          "Ask whether the offer would seem equally strong without the charm."
        ],
        "Liking is persuasive because it changes how the source feels. The defense is not coldness. It is separation."
      ),
      example(
        "ch05-ex03",
        "Charming vendor in a pitch",
        ["work"],
        "A vendor is easy to like, uses your team's language well, and creates a relaxed cooperative mood during the meeting, making the proposal feel safer than it might really be.",
        [
          "Separate the quality of the relationship from the quality of the proposal and review the offer with the same standards you would use for a less charming presenter.",
          "Do not let rapport quietly lower scrutiny."
        ],
        "The principle is powerful in work because positive chemistry often gets mistaken for evidence of fit or reliability."
      ),
      example(
        "ch05-ex04",
        "Manager asks a favorite for extra help",
        ["work"],
        "A manager gives extra opportunities to the employees they feel warmest toward and keeps getting more help from them because the relationship makes refusal awkward.",
        [
          "Notice when liking is shaping workload decisions and restore a clearer standard so warmth does not become hidden labor extraction.",
          "Good relationships should not replace fair structure."
        ],
        "Liking lowers resistance, which can quietly distort fairness when leaders are not conscious of it."
      ),
      example(
        "ch05-ex05",
        "Attraction speeds trust in dating",
        ["personal"],
        "You feel a strong pull to trust someone new because they are attractive, familiar feeling, and easy to talk to, even though there has not been much time to test follow through.",
        [
          "Let the attraction exist while slowing the trust decision enough to gather actual evidence about consistency and motive.",
          "Do not let chemistry do work that only time can do well."
        ],
        "This principle matters because liking often feels like insight when it may only be ease and projection."
      ),
      example(
        "ch05-ex06",
        "Friend's compliment softens your no",
        ["personal"],
        "A friend praises how reliable and generous you are right before asking for a favor you do not actually want to do.",
        [
          "Recognize how the compliment is shaping the emotional climate and answer the favor request from your real capacity, not from the desire to match the flattering image.",
          "You can appreciate the compliment without renting your schedule to it."
        ],
        "Compliments are powerful because they do more than feel nice. They can make a requested identity harder to refuse."
      ),
    ],
    directQuestions: [
      question(
        "ch05-q01",
        "Why is liking such a strong influence factor?",
        [
          "Because pleasant people always make better offers.",
          "Because positive feeling toward the person can spill over into the evaluation of the request.",
          "Because similarity guarantees honesty.",
          "Because charm removes the need for evidence."
        ],
        1,
        "Cialdini's point is that the requester and the request often get judged together rather than separately."
      ),
      question(
        "ch05-q02",
        "What is the halo effect in this chapter?",
        [
          "Treating one attractive quality as evidence of other unproven positive qualities.",
          "Only trusting friends and family.",
          "Preferring repeated exposure to novelty.",
          "Using compliments to start a conversation."
        ],
        0,
        "A single admired trait such as beauty or charm can bias judgments about trustworthiness or competence."
      ),
      question(
        "ch05-q03",
        "What is the strongest defense against liking based influence when the stakes are high?",
        [
          "Avoid likable people completely.",
          "Ask whether the same request would still deserve agreement from someone you liked less.",
          "Distrust compliments in every setting.",
          "Prefer cold communication styles."
        ],
        1,
        "This question separates warmth from the actual merits of the request."
      ),
      question(
        "ch05-q04",
        "What makes ethical use of liking different from manipulative use?",
        [
          "Ethical use comes from genuine rapport and does not rely on warmth alone to bypass judgment.",
          "Ethical use avoids all friendliness.",
          "Manipulative use depends only on physical attractiveness.",
          "Ethical use works only in close relationships."
        ],
        0,
        "The difference lies in whether connection supports honest judgment or is being used to lower it unfairly."
      ),
    ],
  }),
  chapter({
    chapterId: "ch06-authority-signals-competence",
    number: 6,
    title: "Authority Signals Competence",
    readingTimeMinutes: 11,
    summary: {
      p1: t(
        "People are highly responsive to signs of authority, and Cialdini argues that expertise and credibility can trigger compliance even before the underlying advice is examined in detail. Titles, uniforms, credentials, introductions, and confident signals all shape how persuasive a speaker appears.",
        "The principle works because deference to real expertise is often useful. Listening to qualified people can save time and reduce error.",
        "Cialdini's warning is that authority signals can be borrowed, exaggerated, or faked. People may obey the symbol of expertise without testing whether the expertise is real or relevant."
      ),
      p2: t(
        "This matters because authority cues move fast. A lab coat, a title, a polished introduction, or a confident recommendation can shift behavior before the substance has been checked.",
        "The deeper lesson is that people often respond to appearance of authority more easily than to proof of authority. The cue gets trusted because it usually points toward knowledge, not because it always does.",
        "In real life, this chapter teaches a sharp double skill. Signal your own expertise honestly when you have earned it, and verify authority before granting it power over important choices."
      ),
    },
    standardBullets: [
      bullet(
        "Authority can accelerate agreement. People often comply more quickly when a source appears expert or official.",
        "The signal reduces the felt need to inspect everything alone."
      ),
      bullet(
        "Real expertise is useful. Deference to genuine knowledge can improve judgment and efficiency.",
        "The principle is not irrational by design."
      ),
      bullet(
        "Authority symbols move quickly. Titles, uniforms, credentials, and introductions can change behavior before content has landed.",
        "The cue often acts ahead of scrutiny."
      ),
      bullet(
        "Appearance can outrun substance. A person may look authoritative in ways that exceed their actual competence or relevance.",
        "This is where the principle becomes risky."
      ),
      bullet(
        "Relevance matters as much as prestige. True expertise in one domain does not automatically transfer into every other decision.",
        "People often overgeneralize authority."
      ),
      bullet(
        "Trustworthiness strengthens the effect. Expertise persuades best when the source also appears honest and aligned rather than merely impressive.",
        "Credibility is more than knowledge display."
      ),
      bullet(
        "Honest signaling is useful. If you have earned expertise, making it visible can help good information get heard.",
        "Hiding credibility can make strong advice less effective than it should be."
      ),
      bullet(
        "Defense begins with verification. Ask what the person knows, how they know it, and whether that knowledge actually fits this case.",
        "Authority deserves testing before obedience."
      ),
      bullet(
        "Confidence is not proof. Calm certainty can be persuasive even when the underlying evidence is weak.",
        "Delivery and validity are not the same thing."
      ),
      bullet(
        "The chapter's closing lesson is disciplined respect. Listen seriously to expertise, but do not outsource judgment to symbols alone.",
        "Authority should inform thought, not replace it."
      ),
    ],
    deeperBullets: [
      bullet(
        "Authority is efficient because it compresses complexity. If a trusted expert has already done the evaluation, the follower can save time and mental labor.",
        "That efficiency is why the cue is so valuable and so abusable."
      ),
      bullet(
        "The most misleading authority signals are often technically true but practically irrelevant. A real title can still be used outside its proper domain.",
        "The symbol is genuine. The application is not."
      ),
      bullet(
        "Cialdini's chapter also shows the power of arranged introductions. Even a brief authoritative framing by someone else can increase perceived legitimacy fast.",
        "Status can be transferred socially."
      ),
      bullet(
        "Trustworthiness matters because people do not want only competence. They also want to know whether the expert's incentives align with their welfare.",
        "Authority without trust can produce compliance but not durable confidence."
      ),
      bullet(
        "The strategic gain of understanding this principle is cleaner deference. You can move faster with real expertise while becoming harder to fool with decorative expertise.",
        "That saves both time and costly mistakes."
      ),
    ],
    takeaways: [
      "Authority cues can trigger fast compliance",
      "Real expertise is useful but symbolic expertise is risky",
      "Titles and uniforms move quickly",
      "Relevance matters as much as prestige",
      "Trustworthiness strengthens expertise",
      "Verify before obeying",
    ],
    practice: [
      "Ask what actually qualifies a source in this exact decision",
      "Notice one authority symbol that changes your reaction quickly",
      "Signal your own earned expertise clearly and honestly",
      "Separate confident delivery from verified knowledge",
    ],
    examples: [
      example(
        "ch06-ex01",
        "Guest speaker with impressive title",
        ["school"],
        "A guest speaker with a prestigious title gives advice about a field you want to enter, and everyone around you starts treating each recommendation as obviously right.",
        [
          "Respect the expertise, but still ask whether the speaker's knowledge fits your specific path, timing, and constraints before copying their advice.",
          "Title is a cue, not a complete answer."
        ],
        "Authority works because it usually points toward knowledge. The danger begins when the symbol replaces the question of fit."
      ),
      example(
        "ch06-ex02",
        "Older student becomes instant expert",
        ["school"],
        "An older student sounds extremely confident about the best way to handle a course sequence, and newer students start following the advice without checking whether the curriculum has changed.",
        [
          "Test the advice against current facts and relevant experience instead of granting full authority from confidence and status alone.",
          "Experience matters, but it still needs verification."
        ],
        "Authority cues often become strongest when one person appears more informed than the rest of the room."
      ),
      example(
        "ch06-ex03",
        "Consultant with polished credibility",
        ["work"],
        "A consultant enters with strong credentials, a polished deck, and a confident recommendation, and the team begins leaning toward agreement before the underlying assumptions are examined.",
        [
          "Use the credibility as a reason to listen closely, not as a reason to skip verification of the reasoning and local fit.",
          "High status should improve attention, not end evaluation."
        ],
        "Authority is most useful when it sharpens inquiry instead of replacing it."
      ),
      example(
        "ch06-ex04",
        "Boss cites an expert outside their field",
        ["work"],
        "A senior leader keeps invoking a famous expert to justify a decision, but the expert's reputation comes from a different domain than the one you are actually deciding in.",
        [
          "Name the difference between general prestige and relevant expertise before the borrowed authority starts steering the whole conversation.",
          "Domain fit matters more than fame."
        ],
        "People often overextend authority by assuming excellence travels intact across unrelated fields."
      ),
      example(
        "ch06-ex05",
        "Doctor image in an ad",
        ["personal"],
        "An advertisement uses medical clothing, technical language, and confident recommendations, and you feel yourself trusting the product before checking who is actually behind the claim.",
        [
          "Verify the real expertise and incentive structure behind the signal instead of granting trust to the visual authority alone.",
          "A symbol of expertise is not the same as real expertise."
        ],
        "Authority cues work quickly because they compress complexity. That is why symbolic imitation can be so persuasive."
      ),
      example(
        "ch06-ex06",
        "Friend always sounds certain about money",
        ["personal"],
        "A friend speaks confidently about investing and is treated as the money expert in your circle, but most of the confidence comes from style, not from a clear record or relevant qualification.",
        [
          "Separate confidence from demonstrated competence before letting their certainty guide important financial choices.",
          "Ask what the expertise actually rests on."
        ],
        "The chapter matters because people often obey confidence when they really intended to obey knowledge."
      ),
    ],
    directQuestions: [
      question(
        "ch06-q01",
        "Why are authority cues so persuasive?",
        [
          "Because people dislike making any decisions independently.",
          "Because deference to expertise often saves time and effort when the expertise is real.",
          "Because titles guarantee honesty.",
          "Because uniforms make arguments stronger by themselves."
        ],
        1,
        "Authority is efficient because real expertise can legitimately reduce the need to inspect everything alone."
      ),
      question(
        "ch06-q02",
        "What is the most important caution in this principle?",
        [
          "That expertise is never worth trusting.",
          "That appearance of authority can be mistaken for relevant and genuine authority.",
          "That titles are always fake.",
          "That confidence should be ignored."
        ],
        1,
        "The risk lies in obeying the signal of expertise before checking the substance and fit of that expertise."
      ),
      question(
        "ch06-q03",
        "What is the strongest defense against misleading authority?",
        [
          "Reject every credentialed source.",
          "Trust the highest status person in the room.",
          "Ask what the source knows, how they know it, and whether it applies here.",
          "Wait for the source to prove they are wrong."
        ],
        2,
        "Verification of knowledge and relevance is the right counterweight to automatic deference."
      ),
      question(
        "ch06-q04",
        "When is authority being used ethically?",
        [
          "When a real expert makes earned credibility visible so useful guidance can be heard and judged properly.",
          "When the symbol of authority is stronger than the evidence.",
          "When confidence replaces explanation.",
          "When the requester benefits more than the listener."
        ],
        0,
        "Honest signaling of real expertise can help good advice travel more effectively without requiring blind obedience."
      ),
    ],
  }),
  chapter({
    chapterId: "ch07-scarcity-changes-perception",
    number: 7,
    title: "Scarcity Changes Perception",
    readingTimeMinutes: 12,
    summary: {
      p1: t(
        "Scarcity increases perceived value, and Cialdini argues that people want opportunities more when they seem rare, threatened, or about to disappear. Loss feels urgent, so limited access can make the same option look more attractive than it did a moment earlier.",
        "The principle works because people do not simply value what they can gain. They also react strongly to what they may lose.",
        "Cialdini's warning is that scarcity changes perception before it improves judgment. An item, chance, or relationship can become more desirable mainly because access is shrinking, not because the thing itself has improved."
      ),
      p2: t(
        "This matters because time limits, low stock alerts, exclusive access, and sudden competition can all create pressure that bypasses calmer evaluation. People become more reactive when they think freedom of choice is narrowing.",
        "The deeper lesson is that scarcity often works through threatened freedom as much as through objective rarity. What is being restricted can feel more valuable precisely because choice now feels constrained.",
        "In real life, this chapter teaches you to treat urgency as a signal to slow down and verify value rather than as proof that the opportunity deserves immediate surrender."
      ),
    },
    standardBullets: [
      bullet(
        "Scarcity increases appeal. People usually value things more when they seem limited or harder to get.",
        "Reduced access can make desire rise fast."
      ),
      bullet(
        "Loss feels sharper than gain. Cialdini shows that threatened loss often motivates more strongly than equivalent possible gain.",
        "People react intensely to what seems to be slipping away."
      ),
      bullet(
        "Deadlines amplify pressure. Limited time can make a request feel more serious than its actual merits justify.",
        "Urgency changes the emotional texture of choice."
      ),
      bullet(
        "Restricted freedom increases wanting. When people feel choice is being taken away, they often want the blocked option more.",
        "Threatened freedom can create reactance."
      ),
      bullet(
        "Competition intensifies scarcity. An opportunity can look more valuable once others appear ready to claim it.",
        "Rivalry adds emotional heat to limited access."
      ),
      bullet(
        "Scarcity can be real or staged. Low stock, exclusive access, and disappearing offers can reflect truth or manipulation.",
        "The cue deserves inspection before obedience."
      ),
      bullet(
        "Ethical use depends on honesty. Real scarcity can be relevant information when it accurately reflects supply, timing, or access.",
        "False scarcity turns urgency into deception."
      ),
      bullet(
        "Defense begins with value first. Ask whether the thing would still deserve interest without the countdown or the shrinking window.",
        "That question separates merit from pressure."
      ),
      bullet(
        "Emotion rises as options narrow. Once scarcity enters, people often feel more aroused and less analytical at the same time.",
        "That combination makes errors more likely."
      ),
      bullet(
        "The chapter's closing lesson is to respect urgency without submitting to it. Scarcity may matter, but it should not be allowed to do all the deciding.",
        "Value deserves verification even under pressure."
      ),
    ],
    deeperBullets: [
      bullet(
        "Scarcity is persuasive partly because it changes attention. The mind stops asking what something is worth in general and starts asking whether it will soon be gone.",
        "Loss frames the entire decision differently."
      ),
      bullet(
        "New scarcity often feels stronger than old scarcity. People react sharply when access has recently been reduced, because the change itself is vivid.",
        "Diminishing freedom can be more persuasive than stable rarity."
      ),
      bullet(
        "Reactance explains why restriction can create desire. Once a choice feels blocked, people may pursue it partly to restore a sense of autonomy.",
        "The wanted object becomes mixed with the defense of freedom."
      ),
      bullet(
        "The most misleading scarcity cues often surround average offers. Pressure is added not because the option is exceptional, but because pressure can manufacture the impression of exceptionality.",
        "Urgency may be covering mediocrity."
      ),
      bullet(
        "The strategic gain of understanding scarcity is better pressure management. You can move quickly when the limit is real and stay composed when the urgency is mostly psychological theater.",
        "That protects both opportunity and judgment."
      ),
    ],
    takeaways: [
      "Limited access raises perceived value",
      "Loss pressure is especially strong",
      "Deadlines and competition intensify desire",
      "Threatened freedom can create reactance",
      "Check value before obeying urgency",
      "Real scarcity informs while fake scarcity distorts",
    ],
    practice: [
      "Ask whether you would want it as much without the countdown",
      "Notice one recent decision shaped by fear of missing out",
      "Separate real limits from staged urgency",
      "Slow down most when the pressure to hurry rises fastest",
    ],
    examples: [
      example(
        "ch07-ex01",
        "Last seats message for a campus event",
        ["school"],
        "You were only mildly interested in a campus event until the sign up page says there are very few seats left, and now the event suddenly feels important.",
        [
          "Pause and ask whether the event itself became more valuable or whether the shrinking access is doing most of the persuasive work.",
          "Make the decision from fit, not only from shrinking availability."
        ],
        "Scarcity changes desire quickly because loss feels urgent. The defense is checking whether the underlying value changed at all."
      ),
      example(
        "ch07-ex02",
        "Internship deadline looks dramatic",
        ["school"],
        "An internship application says the offer may close early, and the urgency makes you want to apply immediately even though the role did not seem like a strong fit yesterday.",
        [
          "Treat the deadline as information, then still judge whether the opportunity deserves your time and energy on its actual merits.",
          "A closing window should not create value from nothing."
        ],
        "Scarcity often moves people by making inaction feel like loss before they have even decided whether the thing is worth having."
      ),
      example(
        "ch07-ex03",
        "Client pressures same day approval",
        ["work"],
        "A client or vendor says the current pricing disappears by end of day, and the compressed timeline makes the deal feel smarter than it did under normal review.",
        [
          "Ask what the offer would be worth without the clock and whether the limit is real, relevant, and worth changing your standards for.",
          "Do not let deadline pressure replace commercial judgment."
        ],
        "Scarcity is powerful because it can turn speed into a substitute for analysis."
      ),
      example(
        "ch07-ex04",
        "Hiring competition raises interest",
        ["work"],
        "A candidate seemed solid but not exceptional until you learned another company is also pursuing them, and now the whole team feels more eager to move.",
        [
          "Recognize how competition is altering perception and return to the actual evidence of fit before escalating the offer.",
          "Rival interest is useful information, but it can also create artificial inflation."
        ],
        "Scarcity becomes stronger when someone else appears ready to take the same opportunity from you."
      ),
      example(
        "ch07-ex05",
        "Limited drop changes your taste",
        ["personal"],
        "A product release you barely noticed becomes highly tempting once you hear it is limited and people online are racing to get it.",
        [
          "Separate the object's real usefulness from the emotional charge created by rarity and public competition.",
          "If the desire collapses without the limit, the scarcity was doing most of the work."
        ],
        "Scarcity can make ordinary things feel special by threatening access rather than by improving substance."
      ),
      example(
        "ch07-ex06",
        "Someone pulls away and becomes more wanted",
        ["personal"],
        "A person seemed moderately interesting until they became less available, and now you feel a much stronger pull toward them than before.",
        [
          "Ask whether the person themselves became more valuable or whether restricted access and threatened choice are driving the new intensity.",
          "Do not confuse reduced availability with deeper compatibility."
        ],
        "Scarcity changes perception in relationships too, especially when freedom to choose begins to feel narrowed."
      ),
    ],
    directQuestions: [
      question(
        "ch07-q01",
        "Why does scarcity often make something seem more valuable?",
        [
          "Because rare things are always better.",
          "Because threatened loss and reduced choice intensify desire.",
          "Because deadlines improve quality.",
          "Because urgent sellers are more trustworthy."
        ],
        1,
        "Cialdini emphasizes the power of loss and threatened freedom, not simple rarity alone."
      ),
      question(
        "ch07-q02",
        "What is the strongest defense against misleading scarcity?",
        [
          "Refuse every limited offer automatically.",
          "Ask whether the option would still deserve interest without the scarcity cue.",
          "Always wait until the deadline passes.",
          "Trust competitive demand as proof of quality."
        ],
        1,
        "The key is checking underlying value before urgency does all the deciding."
      ),
      question(
        "ch07-q03",
        "What is reactance in this chapter?",
        [
          "The calm review of a limited offer.",
          "The increase in desire that can occur when freedom of choice feels restricted.",
          "The habit of ignoring all deadlines.",
          "The tendency to prefer expensive items."
        ],
        1,
        "Threatened freedom can make people want the restricted option more intensely."
      ),
      question(
        "ch07-q04",
        "When is scarcity being used ethically?",
        [
          "When scarcity is false but persuasive.",
          "When urgency replaces explanation.",
          "When real limits are communicated honestly and relevantly.",
          "When the goal is to close the choice before thought."
        ],
        2,
        "Real limits can be legitimate information. The ethical line is honesty and relevance."
      ),
    ],
  }),
  chapter({
    chapterId: "ch08-shared-identity-multiplies-trust",
    number: 8,
    title: "Shared Identity Multiplies Trust",
    readingTimeMinutes: 13,
    summary: {
      p1: t(
        "People are more easily influenced by those they experience as one of us, and Cialdini argues that shared identity can create a deeper persuasive bond than simple liking alone. When a message comes from someone inside the same group, values, or sense of belonging, resistance often drops and trust rises quickly.",
        "This newer principle of unity builds on the idea that people do not only respond to people they like. They also respond strongly to people they experience as part of the same shared self.",
        "Cialdini's warning is that unity can bypass caution. Shared background, tribe, or affiliation can make people grant loyalty and trust before those things are truly earned."
      ),
      p2: t(
        "This matters because shared identity appears everywhere in modern life. Alumni ties, neighborhood loyalty, family language, founder culture, fandom, profession, and cause based belonging can all make messages feel safer and more compelling.",
        "The deeper lesson is that identity based trust is powerful because it reduces perceived distance. The other person feels less like an outside persuader and more like part of the same side.",
        "In real life, this chapter teaches you to build belonging honestly and to question whether sameness cues are creating more trust than the evidence deserves."
      ),
    },
    standardBullets: [
      bullet(
        "Shared identity deepens trust. People often respond more openly to someone they see as one of us.",
        "Belonging changes persuasion at a deeper level than surface friendliness alone."
      ),
      bullet(
        "Unity is stronger than similarity. Similarity says you are like me. Unity says you are with me or of me.",
        "That shift can create a much stronger bias toward agreement."
      ),
      bullet(
        "Group membership carries emotional weight. Family, team, culture, profession, and cause can all create faster trust and softer scrutiny.",
        "Belonging can compress distance instantly."
      ),
      bullet(
        "Language can signal unity. Shared references, inside terms, and common stories often make a request feel more intimate and less guarded.",
        "Words can mark who counts as inside."
      ),
      bullet(
        "Identity can outrun evidence. People may grant credibility to an in group speaker that they would deny to an outsider making the same claim.",
        "Loyalty can bias evaluation."
      ),
      bullet(
        "Ethical unity is built, not faked. Genuine shared identity or authentic common purpose can create trust that supports better cooperation.",
        "Belonging is strongest when it is real."
      ),
      bullet(
        "Borrowed identity is risky. Forced familiarity or exaggerated in group cues can manufacture false closeness.",
        "The signal may feel warm even when the substance is thin."
      ),
      bullet(
        "Defense begins with checking standards. Ask whether the request would still deserve trust if it came from someone outside the group.",
        "That question keeps belonging from doing all the deciding."
      ),
      bullet(
        "Shared identity can be used for good leadership. People move more willingly when they feel the messenger is part of the same fate, not merely above them.",
        "Unity can strengthen honest cooperation."
      ),
      bullet(
        "The chapter's closing lesson is clear. Belonging is powerful, but shared identity should deepen responsibility and trust, not excuse weak scrutiny.",
        "One of us is not the same as automatically right."
      ),
    ],
    deeperBullets: [
      bullet(
        "Unity works because it shifts the boundary of concern. When another person feels included in the same collective self, helping them can feel closer to helping the group you belong to.",
        "Distance shrinks at the level of identity."
      ),
      bullet(
        "In group trust can become dangerous when it turns into epistemic laziness. People may stop checking facts because loyalty itself feels like enough reason to believe.",
        "Identity can replace evidence unless it is watched carefully."
      ),
      bullet(
        "The principle is especially strong in uncertain times. Stress often pushes people toward group anchors that promise safety, familiarity, and moral clarity.",
        "Belonging feels more valuable when the world feels unstable."
      ),
      bullet(
        "The ethical use of unity is not tribal manipulation. It is the honest creation of shared purpose, shared standards, and mutual obligation that deserve trust.",
        "Real belonging carries responsibility along with persuasive force."
      ),
      bullet(
        "The strategic gain of understanding unity is cleaner trust calibration. You can use shared identity to build commitment while staying alert to when identity cues are being used to bypass deserved scrutiny.",
        "That balance matters in modern online and offline life alike."
      ),
    ],
    takeaways: [
      "One of us is a powerful cue",
      "Unity goes deeper than surface similarity",
      "Shared identity can speed trust",
      "Belonging should not replace evidence",
      "Real common purpose is stronger than borrowed tribe signals",
      "Group loyalty needs standards too",
    ],
    practice: [
      "Ask where shared identity is increasing your trust faster than the facts justify",
      "Build belonging through real contribution and shared purpose",
      "Check whether in group language is doing persuasive work",
      "Test requests from insiders against the same standards used for outsiders",
    ],
    examples: [
      example(
        "ch08-ex01",
        "Same major means instant trust",
        ["school"],
        "A student from your major asks you to share materials because you are both in the same academic community, and the common identity makes the request feel hard to question.",
        [
          "Acknowledge the shared bond, then still decide from fairness, policy, and real cost rather than from automatic in group loyalty.",
          "Belonging should not erase standards."
        ],
        "Unity is powerful because it turns a request into an inside request. The defense is keeping shared identity from becoming automatic permission."
      ),
      example(
        "ch08-ex02",
        "Campus cause creates pressure",
        ["school"],
        "A student group says that because you care about the same cause, you should support their exact tactic and timeline without much question.",
        [
          "Separate shared values from unconditional agreement on method and judge the specific ask on its own merits.",
          "Common cause should support discussion, not end it."
        ],
        "Unity can make disagreement feel like betrayal when it is really just judgment about means."
      ),
      example(
        "ch08-ex03",
        "Founder says we are family",
        ["work"],
        "A founder keeps describing the company as a family right before asking people to accept unpaid extra effort and flexible boundaries.",
        [
          "Notice how shared identity language is being used to increase compliance and return to concrete fairness, role expectations, and real consent.",
          "Belonging language does not erase commercial reality."
        ],
        "Unity is especially persuasive in work because it can make a professional request feel like loyalty to the group itself."
      ),
      example(
        "ch08-ex04",
        "Alumni connection drives a decision",
        ["work"],
        "A hiring manager feels unusually positive about a candidate because they share a school background and social references, even though the interview evidence is mixed.",
        [
          "Treat the shared identity as a source of warmth, not as a substitute for evaluating competence and fit.",
          "Use the same hiring standard you would use without the alumni bond."
        ],
        "The principle matters because one of us can quietly become a stronger signal than the actual decision criteria."
      ),
      example(
        "ch08-ex05",
        "Friend group loyalty overrides concern",
        ["personal"],
        "A close group frames one person's request as something you should do because you are all family at this point, even though the ask crosses a boundary for you.",
        [
          "Respect the closeness while still judging the request against your actual limits and values instead of group identity pressure alone.",
          "Shared identity should increase care, not erase consent."
        ],
        "Unity becomes unhealthy when belonging is used to make refusal feel disloyal by default."
      ),
      example(
        "ch08-ex06",
        "Online community feels instantly trustworthy",
        ["personal"],
        "An online community feels deeply aligned with your worldview, and because the shared language is strong you catch yourself trusting advice there faster than you would anywhere else.",
        [
          "Treat the in group feeling as one cue and still check evidence, incentives, and expertise before acting.",
          "Shared identity can create fast trust, but it does not guarantee sound guidance."
        ],
        "Digital spaces can make unity feel intense because identity markers are displayed so clearly and rewarded so quickly."
      ),
    ],
    directQuestions: [
      question(
        "ch08-q01",
        "What makes unity different from simple liking?",
        [
          "Unity creates a sense of shared identity rather than just positive feeling toward another person.",
          "Unity depends only on physical attraction.",
          "Unity is weaker than similarity.",
          "Unity works only in families."
        ],
        0,
        "Cialdini's newer principle goes beyond liking by making the persuader feel like part of the same collective self."
      ),
      question(
        "ch08-q02",
        "Why can unity be risky?",
        [
          "Because shared identity always leads to conflict.",
          "Because belonging cues can cause people to grant trust before it has been fully earned.",
          "Because groups make liking impossible.",
          "Because all common purpose is manipulative."
        ],
        1,
        "The strength of in group trust is exactly what can make it bypass needed scrutiny."
      ),
      question(
        "ch08-q03",
        "What is the strongest defense against unhealthy unity pressure?",
        [
          "Reject all group belonging.",
          "Pretend shared values do not matter.",
          "Ask whether the request would still deserve trust if it came from outside the group.",
          "Avoid helping insiders."
        ],
        2,
        "The question separates the value of belonging from the quality of the request itself."
      ),
      question(
        "ch08-q04",
        "When is unity being used well?",
        [
          "When it creates false closeness to lower scrutiny.",
          "When it builds real shared purpose and mutual responsibility that deserve trust.",
          "When it replaces evidence with loyalty.",
          "When it makes disagreement impossible."
        ],
        1,
        "The ethical use of unity deepens responsible cooperation rather than tribal obedience."
      ),
    ],
  }),
  chapter({
    chapterId: "ch09-use-influence-with-integrity",
    number: 9,
    title: "Use Influence With Integrity",
    readingTimeMinutes: 14,
    summary: {
      p1: t(
        "Influence is ethically neutral at the level of mechanism, but Cialdini argues that its use is not morally neutral in practice. The same principles that can help people make good decisions, coordinate better, and act on real value can also be used to bypass judgment and exploit human shortcuts.",
        "This closing chapter turns the whole book toward responsibility. Learning how influence works should make the reader more ethical and more resistant, not merely more effective at getting yes.",
        "Cialdini's larger point is that durable persuasion depends on integrity. Influence that wins fast by damaging trust, choice, or truth eventually carries a hidden cost."
      ),
      p2: t(
        "This matters because every principle in the book can be used in two directions. You can inform someone with relevant evidence, or you can corner them by loading the choice with pressure and distorted cues.",
        "The deeper lesson is that ethical influence respects the other person's ability to judge. It helps a fitting choice become easier, rather than making an unfit choice harder to resist.",
        "In real life, this chapter asks you to do two things at once. Use the principles with honesty and restraint, and build defenses strong enough to notice when someone is trying to steer you without deserving that power."
      ),
    },
    standardBullets: [
      bullet(
        "Influence is a tool. Cialdini closes by stressing that the moral question lies in how the principles are used.",
        "Mechanism explains behavior. It does not justify every use of that mechanism."
      ),
      bullet(
        "Ethical influence supports better decisions. The goal is to make a true, relevant, and beneficial choice easier to see and act on.",
        "Good persuasion serves judgment instead of replacing it."
      ),
      bullet(
        "Manipulative influence bypasses scrutiny. It loads the choice with pressure, distortion, or hidden leverage so the person says yes for the wrong reasons.",
        "The issue is not influence itself, but how consent is being shaped."
      ),
      bullet(
        "Trust is a long game asset. Fast wins that damage credibility often create later resistance and reputational cost.",
        "Short term success can hide long term loss."
      ),
      bullet(
        "Transparency matters. Honest signals about motive, limits, and value make influence cleaner and more durable.",
        "Truth reduces hidden coercion."
      ),
      bullet(
        "Restraint is part of persuasion. Just because a trigger works does not mean it deserves to be pushed to its maximum force.",
        "Ethics often lives in the amount as much as in the method."
      ),
      bullet(
        "Self defense requires pattern recognition. Once you know the principles, you can notice which cue is being used and whether it deserves your trust.",
        "Naming the mechanism lowers its invisible power."
      ),
      bullet(
        "Ask whether the influence helps or corners. A strong ethical test is whether the other person would feel respected after seeing the full method used.",
        "Shame after disclosure is often a warning sign."
      ),
      bullet(
        "Use the principles to create mutual gain where possible. Influence is strongest when both sides can still endorse the result under clearer light.",
        "Durability often tracks fairness."
      ),
      bullet(
        "The chapter's closing lesson is stewardship. Learn the science, use it carefully, and refuse to hand your judgment away just because the trigger is skillfully deployed.",
        "Integrity is the right end point of influence literacy."
      ),
    ],
    deeperBullets: [
      bullet(
        "Cialdini's ethics are practical as well as moral. Exploitative persuasion damages repeat trust, invites backlash, and makes future influence harder.",
        "Integrity is not only noble. It is strategically durable."
      ),
      bullet(
        "The sharpest ethical line is often consent quality. Was the person helped toward a fitting decision, or were they maneuvered past the very scrutiny that should have protected them?",
        "That distinction clarifies the whole book."
      ),
      bullet(
        "Defense improves when principles are named specifically. A vague feeling of pressure is weaker than recognizing this is reciprocity, this is scarcity, this is authority.",
        "Specific recognition returns choice."
      ),
      bullet(
        "Ethical influence still uses leverage. The difference is that the leverage points toward a decision that can survive fuller awareness instead of collapsing under it.",
        "Clean persuasion remains persuasive."
      ),
      bullet(
        "The strategic gain of ending the book here is maturity. Influence literacy should leave the reader more deliberate, more honest, and harder to exploit, not merely more skilled at moving other people.",
        "That is the premium lesson of the book as a whole."
      ),
    ],
    takeaways: [
      "Mechanism is not morality",
      "Ethical influence supports sound judgment",
      "Manipulation bypasses deserved scrutiny",
      "Trust compounds and can be spent badly",
      "Specific pattern recognition improves defense",
      "Integrity makes persuasion more durable",
    ],
    practice: [
      "Name which influence cue you are using before making an important ask",
      "Ask whether the other person would still endorse the choice under fuller awareness",
      "Notice one moment when you felt pressure without clear fit",
      "Use transparency to strengthen one real request this week",
    ],
    examples: [
      example(
        "ch09-ex01",
        "Getting sign ups for a campus event",
        ["school"],
        "You know you could increase event sign ups by making the opportunity sound scarcer than it really is, and you are tempted because turnout matters for the club.",
        [
          "Use honest urgency and real social proof only if they are true, then build the ask around the event's actual value rather than inflated pressure.",
          "Do not trade trust for one cleaner number."
        ],
        "This chapter matters because influence skills become ethically meaningful only when the reader decides how far to push what works."
      ),
      example(
        "ch09-ex02",
        "Study group leader uses guilt",
        ["school"],
        "A study group leader keeps using friendship language and guilt to get people to attend sessions that no longer help them much.",
        [
          "Recognize the mechanism, separate relationship from obligation, and answer from whether the request still serves your real goals.",
          "Do not let belonging language replace fit."
        ],
        "Defense becomes stronger when you can identify the principle being used instead of only feeling vague discomfort."
      ),
      example(
        "ch09-ex03",
        "Sales pressure inside your own team",
        ["work"],
        "Your team can probably close a client by leaning hard on authority and scarcity signals that are technically plausible but more forceful than the situation deserves.",
        [
          "Use only the cues that reflect the truth of the offer and remove the pressure that exists mainly to outrun scrutiny.",
          "A short term close is not worth a later trust collapse."
        ],
        "Cialdini's closing lesson is that influence remains strongest when the eventual relationship can survive full visibility."
      ),
      example(
        "ch09-ex04",
        "You realize a pitch cornered someone",
        ["work"],
        "After a meeting you realize the client agreed largely because the room was loaded with time pressure, status, and concession moves, not because the choice was clearly right for them.",
        [
          "Reopen space for a cleaner decision while trust still can be protected rather than congratulating yourself on a fragile yes.",
          "Ethical influence includes correcting leverage that became too distorting."
        ],
        "Integrity sometimes requires loosening the pressure after noticing that the yes was thinner than it first looked."
      ),
      example(
        "ch09-ex05",
        "Friend keeps sending you limited offers",
        ["personal"],
        "A friend regularly pushes deals, events, and opportunities on you using urgency and social proof, and you keep agreeing faster than you actually want to.",
        [
          "Name the pattern to yourself, slow the decision, and ask whether the choice still makes sense once the pressure cue is removed.",
          "The best defense is to restore your own pace."
        ],
        "Influence with integrity is also about refusing to lend your time, money, or attention to cues that do not deserve that power."
      ),
      example(
        "ch09-ex06",
        "Using persuasion in a close relationship",
        ["personal"],
        "You know exactly which cues make someone close to you soften, and you are deciding whether to use that knowledge to get your way in a situation that mainly benefits you.",
        [
          "Ask whether you are helping them see something true or simply maneuvering them past the scrutiny that would protect them, then choose the cleaner path.",
          "Closeness increases responsibility, not entitlement."
        ],
        "The final chapter matters most when the influence tools become personally available. That is where ethics stops being abstract."
      ),
    ],
    directQuestions: [
      question(
        "ch09-q01",
        "What makes influence ethical in Cialdini's closing frame?",
        [
          "It uses the strongest trigger available.",
          "It helps a fitting decision become easier without unfairly bypassing the person's judgment.",
          "It produces a yes quickly.",
          "It works best in close relationships."
        ],
        1,
        "The ethical standard is not mere effectiveness. It is whether the influence supports or distorts sound consent."
      ),
      question(
        "ch09-q02",
        "What is the clearest warning sign of manipulative influence?",
        [
          "The request includes any persuasive element at all.",
          "The other person would likely feel cornered or misled if they saw the full method used on them.",
          "The request comes from someone you do not know.",
          "The request is emotionally important."
        ],
        1,
        "If full visibility would produce shame or a sense of unfair cornering, the influence has likely crossed the line."
      ),
      question(
        "ch09-q03",
        "Why does specific recognition improve self defense?",
        [
          "Because all persuasion stops working once named.",
          "Because identifying the exact principle returns awareness and choice to the decision.",
          "Because naming pressure makes it rude.",
          "Because people only use one cue at a time."
        ],
        1,
        "Specific pattern recognition is stronger than vague discomfort because it restores conscious evaluation."
      ),
      question(
        "ch09-q04",
        "What is the most durable reason to use influence with integrity?",
        [
          "It keeps every conversation pleasant.",
          "It avoids all conflict forever.",
          "It protects trust, repeat relationships, and the legitimacy of the yes itself.",
          "It makes persuasion slower in every case."
        ],
        2,
        "Integrity is durable because persuasion that survives fuller awareness creates stronger trust and less backlash."
      ),
    ],
  }),
];
];

function buildScenarioQuestions(chapterNumber, examples) {
  return examples.map((ex, index) => {
    const correct = ex.whatToDo[0];
    const wrongIndexes = [
      (chapterNumber + index) % SCENARIO_WRONG_BANK.length,
      (chapterNumber + index + 2) % SCENARIO_WRONG_BANK.length,
      (chapterNumber + index + 5) % SCENARIO_WRONG_BANK.length,
    ];

    const choices = [
      correct,
      SCENARIO_WRONG_BANK[wrongIndexes[0]],
      SCENARIO_WRONG_BANK[wrongIndexes[1]],
      SCENARIO_WRONG_BANK[wrongIndexes[2]],
    ];

    return question(
      `ch${String(chapterNumber).padStart(2, "0")}-sq${index + 1}`,
      `${ex.scenario} What is the strongest next step?`,
      choices,
      0,
      ex.whyItMatters
    );
  });
}

function chapter({
  chapterId,
  number,
  title,
  readingTimeMinutes,
  simpleIndexes = DEFAULT_SIMPLE_INDEXES,
  summary,
  standardBullets,
  deeperBullets,
  takeaways,
  practice,
  examples,
  directQuestions,
}) {
  const easyBullets = simpleIndexes.map((index) => standardBullets[index]);
  const hardBullets = [...standardBullets, ...deeperBullets];
  const scenarioQuestions = buildScenarioQuestions(number, examples);
  const questions = [...directQuestions, ...scenarioQuestions];

  if (easyBullets.length !== 7) {
    throw new Error(`Chapter ${number} must have 7 simple bullets.`);
  }
  if (standardBullets.length !== 10) {
    throw new Error(`Chapter ${number} must have 10 standard bullets.`);
  }
  if (hardBullets.length !== 15) {
    throw new Error(`Chapter ${number} must have 15 deeper bullets.`);
  }
  if (examples.length !== 6) {
    throw new Error(`Chapter ${number} must have 6 examples.`);
  }
  if (questions.length !== 10) {
    throw new Error(`Chapter ${number} must have 10 questions.`);
  }

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

function reportBook(bookPackage) {
  const chapters = [...bookPackage.chapters].sort((left, right) => left.number - right.number);
  const lines = [];

  lines.push("# 1. Book audit summary for Influence by Robert Cialdini", "");
  AUDIT_SUMMARY.forEach((paragraph) => lines.push(sentence(paragraph), ""));

  lines.push("# 2. Main content problems found", "");
  MAIN_PROBLEMS.forEach((paragraph, index) => lines.push(`${index + 1}. ${sentence(paragraph)}`));
  lines.push("");

  lines.push("# 3. Personalization strategy for Influence by Robert Cialdini", "");
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
      lines.push(`Explanation: ${sentence(questionItem.explanation || "")}`);
      lines.push("");
    });
  });

  lines.push("# 6. Final quality control summary", "");
  lines.push("1. Every chapter now has exactly two summary paragraphs in each depth variant.");
  lines.push("2. Every chapter now has seven Simple bullets, ten Standard bullets, and fifteen Deeper bullets.");
  lines.push("3. Every chapter has six scenarios with two work, two school, and two personal examples.");
  lines.push("4. The generic template summaries, recycled scenarios, and weak quiz patterns were replaced book wide.");
  lines.push("5. The package remains schema compatible while the reader can apply an Influence specific motivation layer.");
  lines.push("6. The resulting book now reads as a designed lesson instead of a placeholder package.");
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
