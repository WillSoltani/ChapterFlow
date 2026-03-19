import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";

const packagePath = resolve(process.cwd(), "book-packages/laws-of-human-nature.modern.json");
const reportPath = resolve(process.cwd(), "notes/laws-of-human-nature-revision-report.md");

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
  "Make the most visible move right away so nobody questions your certainty.",
  "Avoid taking a clear position so you never have to test your judgment.",
  "Copy the old habit that feels safest and hope the pressure fades on its own.",
  "Focus on sounding wise even if the real pattern stays untouched.",
  "Hand the hard part to someone else and trust that the problem will sort itself out.",
  "Use a symbolic show of confidence even if it does not change the underlying issue.",
  "Keep everyone equally comfortable even if clarity gets weaker.",
  "Wait for the situation to settle itself before you decide what it means.",
];

const AUDIT_SUMMARY = [
  "The existing The Laws of Human Nature package was not ready to ship. It used the older package structure, but the deeper problem was editorial. The prose, scenarios, and quiz logic were built from a generic template that kept flattening Greene's specific laws into vague advice about pressure, judgment, and social dynamics.",
  "The summaries often repeated the same sentence skeleton with only a few nouns swapped out. They rarely explained the actual law, the mechanism behind it, or the caution Greene was trying to teach. Several chapters also drifted away from the real table of contents and toward a loose student interpretation that weakened fidelity.",
  "The bullet sets were repetitive, the scenarios reused interchangeable shells, and the quizzes mixed weak distractors with wording recall. Depth variation was structurally incomplete because the package did not deliver the required 7, 10, and 15 bullet progression.",
  "This revision therefore replaces the book wide content while keeping the same overall package schema. The aim is to preserve usability in the platform while rebuilding the learning experience around Greene's real laws of irrationality, narcissism, role playing, character, desire, time horizon, defensiveness, self sabotage, repression, envy, grandiosity, gender rigidity, purpose, conformity, leadership, aggression, generational pattern, and mortality.",
];

const MAIN_PROBLEMS = [
  "The summaries were shallow, repetitive, and often too vague to explain the actual law.",
  "The bullets were template driven and did not give each chapter a distinct intellectual shape.",
  "The scenarios felt recycled across chapters and often failed to show the real transfer of the law.",
  "The quizzes tested wording more than judgment and several distractors were too weak to make the user think.",
  "Depth personalization was incomplete because the book was not built to the 7, 10, and 15 bullet standard.",
  "Gentle, Direct, and Competitive were still relying on generic reader behavior instead of a Laws specific guidance layer.",
];

const PERSONALIZATION_STRATEGY = [
  "Depth lives in the package itself. Simple gives a fast, faithful read with seven bullets. Standard gives the strongest all around lesson with ten bullets. Deeper adds five real layers about motive, warning signs, tradeoffs, and transfer instead of stretching the same point.",
  "Motivation stays in the reader as a lean book specific layer rather than nine duplicated packages. The law itself does not change, but summary framing, scenario guidance, recap language, and quiz explanations shift in a meaningful way.",
  "Gentle for this book supports calm observation and self honesty. Direct names the pattern and consequence clearly. Competitive stresses edge, blind spots, and the cost of being outread by other people when that frame fits the law.",
  "This keeps the schema stable while making the user facing experience across Simple, Standard, Deeper and Gentle, Direct, Competitive feel materially different.",
];

const SCHEMA_NOTE =
  "No schema change was required. The revision stays inside the existing JSON package shape. Depth is authored in the package and motivation styling is handled in the reader with book specific guidance.";

const CHAPTER_REVISIONS = [
  chapter({
    chapterId: "ch01-master-your-emotional-self",
    number: 1,
    title: "Master Your Emotional Self",
    readingTimeMinutes: 13,
    summary: {
      p1: t(
        "Irrationality is the default human state, and Greene argues that emotion quietly shapes far more of our judgment than we admit. We tell ourselves a story of reason afterward, but in the moment anger, fear, vanity, and desire often choose first.",
        "The law teaches that rationality is not natural calm. It is a discipline of noticing when mood, insecurity, or wounded pride has started shrinking the field of vision.",
        "Greene begins here because every later law depends on it. If you cannot see how emotion steers you, you will misread other people, overreact to pressure, and mistake self protection for clear thinking."
      ),
      p2: t(
        "This matters because small irrational moves compound quickly. A fast reply, a defensive choice, or a bad interpretation of another person's intent can turn an ordinary moment into lasting damage.",
        "The deeper lesson is to lengthen the gap between impulse and action. The more space you create before responding, the easier it becomes to spot patterns, inflaming factors, and real consequences.",
        "In practice, the law is not asking you to become cold. It is asking you to make emotion usable as information instead of letting it act as your hidden commander."
      ),
    },
    standardBullets: [
      bullet(
        "Emotion often moves first. Greene argues that reason usually arrives later to explain a choice that feeling already made.",
        "That is why confidence after the fact can be such a poor test of good judgment."
      ),
      bullet(
        "Watch the inflaming factors. Stress, sudden gain, sudden loss, status threat, and old wounds can all narrow your view fast.",
        "If you know what overheats you, you can protect important decisions before the heat arrives."
      ),
      bullet(
        "Increase reaction time. A short pause before acting is one of the simplest forms of rationality.",
        "Time weakens the spell of first impulse and gives evidence a chance to reenter."
      ),
      bullet(
        "Study your recurring biases. What you want to be true often distorts what you think is true.",
        "Repeated error patterns tell you more than one dramatic mistake does."
      ),
      bullet(
        "Do not confuse discomfort with danger. Feeling exposed or challenged can make ordinary friction look like open threat.",
        "That is how people escalate conflicts they never needed to fight."
      ),
      bullet(
        "Crowds amplify irrationality. Group mood can make extreme reactions feel normal for a while.",
        "Stepping back from shared heat protects independent judgment."
      ),
      bullet(
        "Name the real decision. Greene pushes the reader to identify what actually needs to be solved before emotion writes the script.",
        "A clear decision question cuts through defensive theater."
      ),
      bullet(
        "Review behavior after pressure. Your worst moments often reveal the habits that need the most work.",
        "Post conflict reflection turns embarrassment into usable data."
      ),
      bullet(
        "Assume other people are emotional too. Clear reading improves when you stop expecting pure logic from anyone else.",
        "This makes you less shocked by irrational behavior and better prepared for it."
      ),
      bullet(
        "Rationality is built, not granted. The chapter closes by treating self command as a practice rather than a personality trait.",
        "Better judgment comes from repetition, not from self image."
      ),
    ],
    deeperBullets: [
      bullet(
        "Irrationality often hides behind moral language. People call a move principled when it is really protecting ego, comfort, or revenge.",
        "That is why Greene wants the reader to inspect motive before praising conviction."
      ),
      bullet(
        "Inflamed states make time feel shorter. Under emotion, immediate relief starts to look wiser than long term gain.",
        "Protecting time horizon is therefore part of protecting reason."
      ),
      bullet(
        "Self knowledge beats cleverness. A smart person with blind triggers can be easier to manipulate than a modest person who knows their weak points.",
        "The law is hard because it attacks vanity at the source."
      ),
      bullet(
        "Rationality improves social reading as well as private judgment. Once you stop projecting your own mood everywhere, other people's behavior becomes easier to interpret accurately.",
        "Inner steadiness widens outer perception."
      ),
      bullet(
        "The strategic payoff is cumulative. Each avoided overreaction preserves reputation, energy, and options for later.",
        "Greene starts with irrationality because one unmanaged impulse can ruin many otherwise solid advantages."
      ),
    ],
    takeaways: [
      "Emotion moves faster than reason",
      "Know what inflames you",
      "Increase reaction time",
      "Name the real decision",
      "Review patterns after pressure",
      "Rationality is a practice",
    ],
    practice: [
      "Write the decision before you reply",
      "List three situations that reliably overheat you",
      "Pause long enough to separate feeling from evidence",
      "Review one recent overreaction for pattern not shame",
    ],
    examples: [
      example(
        "ch01-ex01",
        "Public feedback after class",
        ["school"],
        "A professor gives blunt feedback on your presentation in front of other students, and you feel the urge to challenge the comment immediately so you do not look weak.",
        [
          "Write down the actual issue being raised, wait until the emotion drops, and respond to the substance instead of the embarrassment.",
          "If you still disagree, ask for a short follow up conversation where the goal is clarity rather than public vindication."
        ],
        "Irrationality often enters through status pain. The pause matters because it keeps wounded pride from deciding what the next move must be."
      ),
      example(
        "ch01-ex02",
        "Team chat before a deadline",
        ["school"],
        "A group project chat turns tense the night before a deadline after one teammate blames everyone else for the messy draft. The fastest response would be to match the tone and settle the disrespect immediately.",
        [
          "Separate the emotional insult from the work that still has to be finished, and steer the chat back to the exact tasks that protect the grade.",
          "Address the tone later when the deadline pressure is no longer distorting everyone's judgment."
        ],
        "The law matters here because time pressure makes reactive choices feel necessary. Clarity comes from solving the real problem before performing emotion."
      ),
      example(
        "ch01-ex03",
        "Sharp message before launch",
        ["work"],
        "A coworker posts a pointed message in a shared channel two hours before launch, and your first instinct is to answer hard so nobody thinks you caused the problem.",
        [
          "State the launch risk plainly, move the personal tension out of the public channel, and answer only the part that affects execution.",
          "Once the immediate risk is contained, deal with the behavior in a separate conversation with facts."
        ],
        "Public provocation recruits your ego into someone else's timing. Rationality breaks that recruitment."
      ),
      example(
        "ch01-ex04",
        "Director criticism in a review",
        ["work"],
        "A director criticizes your work in a review meeting, and you leave mentally building a case against everyone who made the project harder.",
        [
          "List the concrete problem that now needs correction and handle that first before drafting any defense of your reputation.",
          "Use a later response to explain context only after your plan shows control and accuracy."
        ],
        "Emotion loves a courtroom. Greene's point is that the urge to justify yourself can be stronger than the urge to solve the actual problem."
      ),
      example(
        "ch01-ex05",
        "Old argument with a sibling",
        ["personal"],
        "A small disagreement with your sibling suddenly pulls in years of old resentment, and both of you start reacting to family history instead of the present issue.",
        [
          "Reduce the conversation to the present disagreement in one sentence and refuse to widen the field while emotions are rising.",
          "If neither of you can do that, pause the talk before the past takes complete control of the moment."
        ],
        "Irrationality often arrives disguised as sincerity. Feeling deeply does not guarantee that you are responding to what is actually happening now."
      ),
      example(
        "ch01-ex06",
        "Mixed signals while dating",
        ["personal"],
        "Someone you are dating is inconsistent for a week, and you start reading every delayed reply as proof of a major shift in interest or intent.",
        [
          "Slow down the interpretation, look for a broader pattern over time, and do not make a dramatic decision from one anxious stretch.",
          "If clarity is still missing, ask a direct question once you can do it without trying to force relief."
        ],
        "Strong feeling narrows the future into a single feared outcome. The law helps you resist turning uncertainty into certainty before you have evidence."
      ),
    ],
    directQuestions: [
      question(
        "ch01-q01",
        "An investor criticizes your pitch and you feel both embarrassed and angry. What is the strongest immediate move?",
        [
          "Write the response you want to send, wait, and then return to the specific decision the criticism affects.",
          "Reply quickly so nobody mistakes your silence for weakness.",
          "Assume the criticism was personal and begin planning distance.",
          "Ignore the feedback because emotion proves the exchange was unfair."
        ],
        0,
        "The law favors increasing reaction time and naming the real decision before emotion hardens into action."
      ),
      question(
        "ch01-q02",
        "Which sign most clearly suggests irrationality is steering judgment?",
        [
          "You feel strong emotion and then start gathering facts on both sides.",
          "You treat discomfort as proof that someone must have hostile intent.",
          "You wait a day before deciding on a high stakes message.",
          "You ask what pattern your reaction fits."
        ],
        1,
        "Irrationality often turns feeling into false certainty about motive."
      ),
      question(
        "ch01-q03",
        "What habit best supports rationality over time?",
        [
          "Trying to eliminate emotion completely.",
          "Trusting your first instinct because it is more authentic.",
          "Reviewing the situations that reliably inflame you before high stakes moments.",
          "Avoiding all disagreement so nothing can trigger you."
        ],
        2,
        "Greene treats self knowledge of triggers and inflaming factors as a practical route to better judgment."
      ),
      question(
        "ch01-q04",
        "A team begins spiraling after a rumor about layoffs. Which response best reflects this law?",
        [
          "Match the urgency of the room so people know you care.",
          "Let the mood play out before you gather facts.",
          "Separate facts from interpretations and slow the pace of the next decision.",
          "Privately decide who is overreacting and exclude them."
        ],
        2,
        "The best move is to reduce emotional heat so the group can recover contact with reality."
      ),
    ],
  }),
  chapter({
    chapterId: "ch02-transform-self-love-into-empathy",
    number: 2,
    title: "Transform Self Love into Empathy",
    readingTimeMinutes: 13,
    summary: {
      p1: t(
        "Narcissism is universal, and Greene argues that every person is absorbed in their own needs, injuries, and self story to some degree. The useful question is not whether narcissism exists, but where someone falls on the spectrum and whether their self focus can be turned outward into empathy.",
        "The chapter separates healthy self regard from the deeper forms of narcissism that make a person fragile, grandiose, manipulative, or hungry for constant attention.",
        "Greene wants the reader to stop imagining narcissism as a rare disorder found only in obvious villains. It is a human baseline that shapes listening, conflict, attraction, and persuasion every day."
      ),
      p2: t(
        "This matters because poor social judgment often begins with forgetting how little other people are actually centered on you and how centered they are on themselves. Once you see that clearly, empathy becomes less sentimental and more strategic.",
        "The deeper lesson is that empathy is a form of leverage and protection at the same time. It helps you read people's insecurities, motives, and moods, while also making you less trapped inside your own reactions.",
        "In practice, the law teaches two things at once. Build a healthier outward focus in yourself, and learn to recognize the deeper narcissists whose need for control, admiration, and emotional feeding will eventually cost you."
      ),
    },
    standardBullets: [
      bullet(
        "Assume self absorption is normal. Greene treats narcissism as a spectrum rather than a rare exception.",
        "That makes the chapter more useful because it explains ordinary behavior, not just extreme cases."
      ),
      bullet(
        "Healthy self regard turns outward. The stronger version of self love includes the ability to notice other people's reality.",
        "Empathy is not self erasure. It is disciplined attention beyond yourself."
      ),
      bullet(
        "Deep narcissists drain the room. They need admiration, control, or emotional fuel to hold themselves together.",
        "Their charm can be real, but the pattern eventually tilts toward extraction."
      ),
      bullet(
        "Do not take every reaction personally. Many people's moods and sharp turns are driven by their own insecurity, not by your importance in their story.",
        "That one shift can calm a great deal of unnecessary interpretation."
      ),
      bullet(
        "Listen for need, not just content. What someone keeps asking from the room often reveals more than their stated argument.",
        "Attention hunger, grievance, and superiority all have distinct emotional signatures."
      ),
      bullet(
        "Empathy begins with curiosity. You cannot understand another person well if you are secretly waiting to return to yourself.",
        "Real observation requires temporary surrender of self importance."
      ),
      bullet(
        "Practice visceral empathy. Tone, pacing, eyes, and energy often reveal feeling before words do.",
        "People rarely state their emotional reality as cleanly as they display it."
      ),
      bullet(
        "Set limits with deeper narcissists. Understanding them does not require volunteering to be used by them.",
        "Empathy without boundaries becomes a liability."
      ),
      bullet(
        "Use empathy to improve influence. People respond more openly when they feel accurately seen.",
        "Much resistance softens when someone experiences real recognition."
      ),
      bullet(
        "The final lesson is double edged. Study your own narcissism and everyone else's at the same time.",
        "That balance keeps the chapter from turning into pure diagnosis of other people."
      ),
    ],
    deeperBullets: [
      bullet(
        "Narcissism is often strongest where self esteem is weakest. Grand performance can be a compensation for inner instability rather than proof of true confidence.",
        "That is why the need for attention can coexist with intense fragility."
      ),
      bullet(
        "Empathy widens strategic vision. The more accurately you can imagine other people's inward experience, the less likely you are to provoke blind resistance.",
        "Understanding motive lets you move with more precision."
      ),
      bullet(
        "The chapter warns against moral vanity too. People can turn their own supposed empathy into a flattering identity and stop observing honestly.",
        "Claiming sensitivity is not the same as practicing it."
      ),
      bullet(
        "Deep narcissists often repeat a cycle. Idealize, draw people close, demand emotional supply, and punish disappointment.",
        "Pattern recognition matters more than any one impressive first encounter."
      ),
      bullet(
        "Healthy narcissism is not weakness. Greene actually treats it as a source of resilience because it combines confidence with outward awareness.",
        "The goal is not to erase self regard but to civilize it."
      ),
    ],
    takeaways: [
      "Narcissism is a spectrum",
      "Empathy turns self focus outward",
      "Do not over personalize other people's moods",
      "Read need beneath words",
      "Set boundaries with deep narcissists",
      "Study your own blind spots too",
    ],
    practice: [
      "In one conversation, listen for need before opinion",
      "Notice where you keep making the story about you",
      "Track a repeated pattern before labeling someone",
      "Pair empathy with one clear boundary",
    ],
    examples: [
      example(
        "ch02-ex01",
        "Partner who needs constant praise",
        ["school"],
        "A project partner does useful work but constantly needs reassurance that their contribution is the most important part of the assignment. Small corrections lead to visible withdrawal.",
        [
          "Acknowledge the value they need recognized, then redirect the conversation toward the shared task and concrete next steps.",
          "Do not enter a cycle where the group must continually feed insecurity just to keep the work moving."
        ],
        "Empathy helps because you can see the need behind the behavior. Boundaries matter because meeting every emotional demand would hand control of the project to that need."
      ),
      example(
        "ch02-ex02",
        "Friend who retells every story around themselves",
        ["school"],
        "A friend in your program keeps turning group conversations back to their own stress and wins, and people are starting to avoid them without saying why.",
        [
          "Treat the pattern as self absorption rather than as personal disrespect toward you, and use a direct but calm moment to widen the conversation beyond them.",
          "If the pattern does not change, limit how much emotional labor you keep donating."
        ],
        "The law matters because it stops you from confusing another person's self focus with a special attack on you. That gives you a cleaner read and a cleaner response."
      ),
      example(
        "ch02-ex03",
        "Manager who feeds on admiration",
        ["work"],
        "A manager praises people lavishly when they admire their vision but becomes cold when someone questions a plan. The room is learning to flatter instead of think.",
        [
          "Recognize the hunger for admiration underneath the charm and present disagreements in a way that protects the manager's need for face without surrendering substance.",
          "Keep records and boundaries so the team is not forced into emotional dependence."
        ],
        "Empathy here is strategic, not naive. You are reading the insecurity that drives the behavior so you can avoid being ruled by it."
      ),
      example(
        "ch02-ex04",
        "Coworker who monopolizes check ins",
        ["work"],
        "A coworker uses every one on one to describe how overloaded and underappreciated they are, leaving little room for real coordination.",
        [
          "Show that you understand the pressure they feel, then narrow the meeting to the decisions and responsibilities that actually need alignment.",
          "Do not reward endless self focus by letting it take over every operational conversation."
        ],
        "The law applies because people often open up only after they feel seen, but they do not necessarily know when to stop centering themselves."
      ),
      example(
        "ch02-ex05",
        "Early dating with a magnetic self focus",
        ["personal"],
        "Someone you are dating is charismatic and intense, but most closeness happens on terms that keep attention flowing toward their needs, feelings, and image.",
        [
          "Watch whether curiosity about you grows over time or whether the relationship keeps circling back to their emotional center.",
          "If the pattern stays one sided, step back before charm and hope turn into unpaid caretaking."
        ],
        "Deep narcissism often feels exciting before it feels expensive. Pattern matters more than the first powerful impression."
      ),
      example(
        "ch02-ex06",
        "Family member who makes every event about them",
        ["personal"],
        "A family member reacts to other people's milestones by redirecting attention toward their own crisis, disappointment, or special sensitivity.",
        [
          "Recognize the need for centrality instead of trying to win a fairness argument in the middle of the moment.",
          "Give only the amount of acknowledgement needed to move past the emotional grab, then protect the original occasion."
        ],
        "Seeing the need clearly helps you respond with less resentment and more control. Empathy is useful here because it reduces surprise, not because it excuses the behavior."
      ),
    ],
    directQuestions: [
      question(
        "ch02-q01",
        "What is the strongest sign of healthy self regard rather than deeper narcissism?",
        [
          "A strong outward curiosity about other people's feelings and perspectives.",
          "A constant desire to be recognized as exceptional.",
          "A habit of turning feedback into an insult.",
          "A need to dominate the tone of every conversation."
        ],
        0,
        "Greene treats empathy as the key mark of healthier narcissism because attention can move beyond the self."
      ),
      question(
        "ch02-q02",
        "Why is empathy strategically powerful in this law?",
        [
          "It removes the need for boundaries.",
          "It helps you read motive and mood without getting trapped in your own interpretation.",
          "It guarantees people will behave well once understood.",
          "It makes manipulation impossible."
        ],
        1,
        "Empathy widens perception. It does not solve everything, but it sharply improves reading and response."
      ),
      question(
        "ch02-q03",
        "A teammate reacts badly to mild criticism. What is the best first interpretation?",
        [
          "They must have always disliked you.",
          "Their self image may be more fragile than the comment itself deserved.",
          "The criticism was automatically too harsh to be useful.",
          "You should stop giving any honest feedback."
        ],
        1,
        "The law encourages reading insecurity and self opinion before assuming a deeper personal meaning."
      ),
      question(
        "ch02-q04",
        "Which response best reflects the chapter's balance between empathy and limits?",
        [
          "Understand the person's need and keep feeding it so conflict never appears.",
          "Judge the person quickly and cut them off without further observation.",
          "Recognize the underlying need while setting boundaries that stop the pattern from ruling the relationship.",
          "Mirror their self focus until they notice how tiring it feels."
        ],
        2,
        "Greene's point is not endless accommodation. It is accurate reading plus controlled boundaries."
      ),
    ],
  }),
  chapter({
    chapterId: "ch03-see-through-peoples-masks",
    number: 3,
    title: "See Through People's Masks",
    readingTimeMinutes: 13,
    summary: {
      p1: t(
        "People perform versions of themselves for social life, and Greene argues that almost everyone manages impressions while hiding insecurity, resentment, ambition, or desire behind a mask. The chapter teaches you to read the cracks in that performance through tone, timing, body language, contradiction, and shifts from baseline behavior.",
        "The point is not paranoid suspicion. Greene is teaching a second language of behavior that helps you notice what words alone often conceal.",
        "Because most people are trying to look reasonable, generous, and controlled, the most useful signals often appear in what leaks out sideways when attention slips."
      ),
      p2: t(
        "This matters because direct statements are often curated for effect. If you rely only on explicit content, you can miss the real state of trust, attraction, resistance, or hidden hostility in the room.",
        "The deeper lesson is to compare surface presentation with repeated behavior over time. Single signals can mislead, but patterns of mismatch tell you a great deal.",
        "In real life, the law also turns inward. You become more effective when you understand your own mask, how you present yourself, and what unintended signals escape around the edges."
      ),
    },
    standardBullets: [
      bullet(
        "Assume some role playing is normal. Social life depends on presentation, so masks are not automatically malicious.",
        "That assumption keeps the chapter useful and stops it from turning into cheap cynicism."
      ),
      bullet(
        "Read nonverbal cues closely. Eyes, posture, timing, voice, and energy can reveal what speech is trying to smooth over.",
        "People often leak emotion before they state it."
      ),
      bullet(
        "Establish a baseline. You need to know what is normal for a person before you can read what is unusual.",
        "A sudden deviation from their ordinary pattern is often more informative than any isolated gesture."
      ),
      bullet(
        "Watch for mismatch. When words say one thing and behavior says another, the gap matters.",
        "Contradiction is often where the real feeling becomes visible."
      ),
      bullet(
        "Observe under pressure. Stress, competition, attraction, and fatigue all weaken impression management.",
        "Hard moments let the mask slip faster than calm ones do."
      ),
      bullet(
        "Do not overread one sign. Greene wants pattern recognition, not theatrical mind reading.",
        "Accuracy comes from accumulation, not from decoding one glance like a movie detective."
      ),
      bullet(
        "Notice what people want to be seen as. The chosen image often tells you where their insecurity or ambition lives.",
        "Mask design itself is a clue."
      ),
      bullet(
        "Present yourself deliberately. Since everyone reads signals, you should become more conscious of what your own behavior communicates.",
        "Self awareness makes your presence cleaner and less confusing to others."
      ),
      bullet(
        "Use patience over confrontation. When you suspect a gap, continue observing instead of accusing too early.",
        "Premature confrontation often teaches people to hide better."
      ),
      bullet(
        "The closing insight is practical. Read the whole pattern, not the polished script.",
        "People reveal themselves more in leakage and repetition than in prepared language."
      ),
    ],
    deeperBullets: [
      bullet(
        "A mask is usually aspirational as well as protective. People display the version of themselves they want believed, admired, or forgiven.",
        "That makes their performance a clue to both fear and ambition."
      ),
      bullet(
        "Mismatches become clearer when stakes rise. Attraction, status competition, and uncertainty pull hidden feeling closer to the surface.",
        "That is why Greene emphasizes observation in dynamic situations."
      ),
      bullet(
        "The law warns against naive transparency myths. Most people are not lying all the time, but they are editing themselves constantly.",
        "Good social reading begins once you accept that ordinary politeness is selective truth."
      ),
      bullet(
        "Reading masks also prevents projection. Without close observation, you are likely to fill ambiguity with your own hopes or fears.",
        "Behavioral evidence protects you from inventing motives."
      ),
      bullet(
        "The strategic use of this law is restraint. You do not need to expose every contradiction you notice.",
        "Often the stronger move is to keep gathering data while choosing your response from a position of clearer knowledge."
      ),
    ],
    takeaways: [
      "Masks are normal in social life",
      "Read behavior with words",
      "Baseline matters",
      "Mismatches reveal feeling",
      "Do not overread one sign",
      "Observe before confronting",
    ],
    practice: [
      "Notice one mismatch between words and behavior this week",
      "Establish a baseline before drawing conclusions",
      "Track repeated leakage not one dramatic cue",
      "Review what your own presence signals accidentally",
    ],
    examples: [
      example(
        "ch03-ex01",
        "Classmate who says yes too quickly",
        ["school"],
        "A classmate eagerly agrees to join your research presentation, but every follow up message from them is delayed, thin, and slightly evasive.",
        [
          "Treat the warm first answer as surface presentation and read the slower pattern of behavior before depending on the commitment.",
          "Ask one direct clarifying question while leaving room for them to step back honestly."
        ],
        "The law matters because enthusiasm in words can hide reluctance in behavior. The mismatch tells you more than the opening promise."
      ),
      example(
        "ch03-ex02",
        "Club officer who sounds supportive",
        ["school"],
        "A club officer says they support your event idea, but during meetings they cut eye contact, change the subject, and never volunteer the next step.",
        [
          "Notice the repeated nonverbal resistance and test commitment with one concrete ask instead of trusting the friendly language alone.",
          "Adjust your plan from the answer you get in behavior, not from the script of support."
        ],
        "Masks often stay polite while real resistance shows up in timing, energy, and follow through."
      ),
      example(
        "ch03-ex03",
        "Stakeholder who keeps saying aligned",
        ["work"],
        "A stakeholder says they are aligned on a project, yet every time a milestone gets close they reopen basic questions and quietly delay approvals.",
        [
          "Read the repeated mismatch as unresolved resistance and surface it through specific decisions and deadlines rather than broad reassurance.",
          "Keep observing what conditions make the mask slip most clearly."
        ],
        "Words often protect image. Behavior reveals whether true buy in exists."
      ),
      example(
        "ch03-ex04",
        "Candidate who interviews smoothly",
        ["work"],
        "A candidate answers every interview question elegantly, but the way they treat the coordinator, handle interruptions, and ask follow up questions feels inconsistent with the polished front.",
        [
          "Use the small unscripted moments to balance the formal answers and weigh the whole behavioral pattern before deciding.",
          "Pay more attention to how they act when the script weakens than to the rehearsed parts of the interview."
        ],
        "The chapter teaches that spontaneous leakage often carries more signal than prepared performance."
      ),
      example(
        "ch03-ex05",
        "Friend whose kindness feels strained",
        ["personal"],
        "A friend says they are happy for your recent success, but their smile is tight, their questions are brief, and their tone changes when other people praise you.",
        [
          "Do not accuse them from one moment, but keep observing whether the mismatch repeats before you decide how much to share or rely on them emotionally.",
          "Let the pattern, not your wish for harmony, guide the next level of trust."
        ],
        "This law protects you from taking polished words at full value when the emotional reality is more complicated."
      ),
      example(
        "ch03-ex06",
        "Date with a polished persona",
        ["personal"],
        "Someone you are seeing always says exactly the right thing, but when plans change or the mood turns uncertain, their patience and warmth drop sharply.",
        [
          "Pay attention to the unscripted moments because they show more of the real person than the smooth parts do.",
          "Wait for a wider pattern before deepening commitment."
        ],
        "Impression management can be attractive, but the mask matters less than what leaks out when control is harder to maintain."
      ),
    ],
    directQuestions: [
      question(
        "ch03-q01",
        "What is the strongest way to read someone's hidden state accurately?",
        [
          "Decode one dramatic gesture and trust it completely.",
          "Compare words with repeated behavior and shifts from baseline.",
          "Assume nervousness always means deception.",
          "Ask direct questions until they admit the truth."
        ],
        1,
        "Greene emphasizes baseline, mismatch, and repetition over single theatrical clues."
      ),
      question(
        "ch03-q02",
        "Why is baseline behavior so important?",
        [
          "Because ordinary habits make it easier to notice when something meaningful has changed.",
          "Because it lets you judge people faster from first impressions.",
          "Because it proves words never matter.",
          "Because it tells you who is lying before you speak to them."
        ],
        0,
        "Without a baseline, you cannot tell whether a cue is unusual or simply normal for that person."
      ),
      question(
        "ch03-q03",
        "A coworker sounds supportive but repeatedly slows your project in subtle ways. What is the best read?",
        [
          "You should ignore the behavior because the spoken support is what counts.",
          "The gap between the script and the pattern deserves careful attention.",
          "One delay proves malicious intent.",
          "Confront them publicly before gathering more evidence."
        ],
        1,
        "The law teaches that repeated mismatch often reveals the real stance more clearly than polite language."
      ),
      question(
        "ch03-q04",
        "What is the main danger of overreading one cue?",
        [
          "You become passive in every social situation.",
          "You stop needing direct communication.",
          "You replace observation with projection and false certainty.",
          "You make people too comfortable around you."
        ],
        2,
        "Single cues invite projection. Greene wants accumulated evidence, not fantasy decoding."
      ),
    ],
  }),
  chapter({
    chapterId: "ch04-determine-the-strength-of-peoples-character",
    number: 4,
    title: "Determine the Strength of People's Character",
    readingTimeMinutes: 13,
    summary: {
      p1: t(
        "Character is the deep pattern beneath personality, and Greene argues that people reveal it through repeated behavior long before they describe it honestly. Charm, talent, and intelligence can impress you for a while, but under pressure the same person will tend to react in the same familiar ways.",
        "This law teaches the reader to study compulsive patterns, especially how someone handles frustration, boredom, power, attention, and delay.",
        "Greene is less interested in isolated mistakes than in the structure beneath them. Character is what keeps reappearing after the excuses change."
      ),
      p2: t(
        "This matters because many bad alliances begin with being seduced by style while ignoring pattern. Once a person's deeper habits are clear, later surprises become far less surprising.",
        "The deeper lesson is that character predicts future cost. Reliability, steadiness, self control, and generosity all matter because they determine what life with that person will actually feel like over time.",
        "The law also turns inward. Greene wants you to study your own compulsions and build stronger character traits deliberately, not just diagnose weakness in everyone else."
      ),
    },
    standardBullets: [
      bullet(
        "Look for pattern over promise. Greene argues that repeated behavior tells you more than polished self description ever will.",
        "People often describe their ideals. Character shows up in their habits."
      ),
      bullet(
        "Pressure reveals structure. Stress strips away some of the social varnish that normally hides a person's deeper tendencies.",
        "How someone acts when frustrated is often more predictive than how they act when comfortable."
      ),
      bullet(
        "Small signs matter early. The way a person handles waiting, blame, gratitude, and minor inconvenience can reveal the larger pattern.",
        "Character usually leaks through little moments before the big moments arrive."
      ),
      bullet(
        "Do not confuse talent with strength. Someone can be gifted and still be unstable, vain, or impossible to rely on.",
        "Competence in one area does not erase weakness of character."
      ),
      bullet(
        "Notice compulsive loops. Repeated defensiveness, repeated envy, repeated impulsiveness, and repeated victim stories rarely stay contained.",
        "Patterns that show up in one context usually travel into others."
      ),
      bullet(
        "Test for recovery, not perfection. Strong character includes the ability to correct, learn, and regain balance after failure.",
        "The key question is not whether someone slips, but how they respond after slipping."
      ),
      bullet(
        "Choose people for long term cost. Greene wants you to think beyond first chemistry toward the eventual burden or steadiness a person brings.",
        "Character determines maintenance cost in work, friendship, and love."
      ),
      bullet(
        "Build stronger traits in yourself. Deliberate honesty, patience, reliability, and realism are forms of character training.",
        "The law is practical only if it changes your own habits too."
      ),
      bullet(
        "Be cautious with toxic types. Deeply manipulative, volatile, or self sabotaging patterns rarely improve because you saw them clearly.",
        "Recognition should guide distance, not fantasy rescue."
      ),
      bullet(
        "The final insight is predictive. Character is valuable because it lets you see tomorrow inside today's repeated pattern.",
        "That foresight protects judgment and commitment."
      ),
    ],
    deeperBullets: [
      bullet(
        "Compulsive behavior often began as adaptation. A trait that once protected a person can harden into a lifelong loop that now harms them and others.",
        "Understanding this gives the reader realism without naivete."
      ),
      bullet(
        "People with weak character often depend on circumstance to look good. When the setting is favorable they seem fine, but the pattern collapses once life stops cooperating.",
        "Strength shows up as stability across conditions."
      ),
      bullet(
        "Charm can camouflage character weakness for a long time. Pleasant style buys people more chances than their pattern deserves.",
        "That is why Greene urges quiet observation before deep commitment."
      ),
      bullet(
        "Superior character is not stiffness. It combines discipline with flexibility, because a rigid person can also become compulsive in their own way.",
        "Strength includes the ability to adapt without losing standards."
      ),
      bullet(
        "The strategic advantage of this law is early recognition. Once you stop overvaluing image, you make cleaner choices about trust, delegation, partnership, and intimacy.",
        "Most preventable trouble begins with ignoring an obvious pattern because the packaging is attractive."
      ),
    ],
    takeaways: [
      "Pattern reveals character",
      "Pressure shows the structure",
      "Talent does not equal strength",
      "Small signs matter early",
      "Choose people by long term cost",
      "Train stronger character in yourself",
    ],
    practice: [
      "Write one repeated pattern you keep excusing in someone",
      "Notice how a person reacts to delay or correction",
      "Track recovery after failure not image before it",
      "Choose one trait to strengthen through repetition",
    ],
    examples: [
      example(
        "ch04-ex01",
        "Reliable until challenged",
        ["school"],
        "A classmate seems smart and helpful, but every time their idea is questioned they get sarcastic, withdraw effort, and quietly stop supporting the group.",
        [
          "Treat the repeated response to disagreement as a character pattern and limit how much the project depends on their emotional steadiness.",
          "Assign responsibilities around demonstrated reliability rather than around talent alone."
        ],
        "The chapter matters because brilliance can distract you from the maintenance cost of weak character."
      ),
      example(
        "ch04-ex02",
        "Friendship built on rescue",
        ["school"],
        "A friend repeatedly creates avoidable crises before deadlines and then relies on other people to save the situation while promising change each time.",
        [
          "Pay more attention to the repeated cycle than to the apology and stop building your plans around the hope that this version will finally be different.",
          "Support them only in ways that do not require you to carry the cost of their pattern."
        ],
        "Compulsive behavior becomes clearer when you stop treating every repeat as a fresh event."
      ),
      example(
        "ch04-ex03",
        "High performer with a blame habit",
        ["work"],
        "A strong performer delivers good work but blames others every time a project hits friction. Over time the team starts hiding problems to avoid becoming the next target.",
        [
          "Recognize blame as part of the person's deeper pattern and do not confuse output quality with trustworthiness under strain.",
          "Set clear expectations and documentation so their habits do not define the team's emotional climate."
        ],
        "Character predicts what pressure will cost the group, not just what talent can produce on a good day."
      ),
      example(
        "ch04-ex04",
        "Founder who repeats the same mistake",
        ["work"],
        "A founder says each bad hire was just bad luck, but every hiring cycle they get seduced by charisma and ignore the same warning signs about follow through and ego.",
        [
          "Look at the recurring decision pattern rather than the surface details of each individual hire.",
          "Change the process at the level of character assessment instead of retelling the last failure as a one off."
        ],
        "Greene's point is that repeated mistakes often reveal your own compulsive pattern as much as someone else's."
      ),
      example(
        "ch04-ex05",
        "Dating someone with repeated chaos",
        ["personal"],
        "Someone you like is warm and exciting, but they cycle through jobs, friendships, and commitments in the same dramatic way, always with a fresh explanation for why this case was special.",
        [
          "Read the repetition as character, not as a string of isolated unlucky chapters.",
          "Decide whether you are being drawn to intensity that will later become instability."
        ],
        "Character is costly because it follows people from situation to situation even when the story changes."
      ),
      example(
        "ch04-ex06",
        "Relative who never admits fault",
        ["personal"],
        "A relative can be generous when things go smoothly, but when conflict appears they immediately rewrite events so they are always the misunderstood one.",
        [
          "Stop expecting ordinary accountability from a pattern that has repeatedly refused it and set your boundaries around what they actually do.",
          "Use realism instead of another round of surprised disappointment."
        ],
        "The law protects you from basing trust on occasional warmth while ignoring a stable refusal to face reality."
      ),
    ],
    directQuestions: [
      question(
        "ch04-q01",
        "What is the strongest reason to study repeated behavior instead of polished self description?",
        [
          "Because repetition reveals the deeper pattern likely to return under future pressure.",
          "Because words never matter in any relationship.",
          "Because first impressions are always false.",
          "Because character cannot change at all."
        ],
        0,
        "Greene uses repeated behavior as the best guide to future cost and reliability."
      ),
      question(
        "ch04-q02",
        "Which sign suggests strong character more than social skill?",
        [
          "A person becomes more charming when stakes rise.",
          "A person recovers honestly after error and adjusts behavior.",
          "A person explains every failure in a compelling way.",
          "A person attracts quick admiration from strangers."
        ],
        1,
        "Recovery, correction, and steadiness are stronger signs of character than surface appeal."
      ),
      question(
        "ch04-q03",
        "A coworker is talented but repeatedly unstable under pressure. What is the wisest read?",
        [
          "Talent cancels out the pattern.",
          "The instability matters only if it becomes personal.",
          "The pattern is a real part of what working with them will cost over time.",
          "You should wait for a more dramatic failure before noticing it."
        ],
        2,
        "Character predicts maintenance cost, not just occasional performance."
      ),
      question(
        "ch04-q04",
        "What is the chapter's most practical inner demand on the reader?",
        [
          "Become better at judging other people while leaving yourself unchanged.",
          "Choose one superior trait and train it through repetition.",
          "Avoid difficult people completely.",
          "Assume anyone with a flaw is dangerous."
        ],
        1,
        "Greene wants the reader to build stronger character, not just diagnose weakness in others."
      ),
    ],
  }),
  chapter({
    chapterId: "ch05-become-an-elusive-object-of-desire",
    number: 5,
    title: "Become an Elusive Object of Desire",
    readingTimeMinutes: 12,
    summary: {
      p1: t(
        "Covetousness is the force that makes people want what seems distant, elevated, scarce, or desired by others. Greene argues that desire grows stronger when something feels just out of reach, because the imagination begins adding value beyond the thing itself.",
        "The chapter is not only about romance. It explains why people chase status, roles, ideas, opportunities, and people with greater intensity once scarcity, prestige, or rivalry enters the picture.",
        "Greene wants the reader to understand that value is often socially amplified. What others want, what seems forbidden, and what remains partially unavailable can all become magnetic."
      ),
      p2: t(
        "This matters because many people weaken their own position by overexposing themselves, overexplaining their offer, or making access too easy. Desire often cools when everything is given away too quickly.",
        "The deeper lesson is to respect the role of distance, mystery, and earned access in human motivation. People commit more strongly to what invites imagination and effort than to what arrives fully flattened in front of them.",
        "In practice, the law also teaches restraint. You can create value without becoming manipulative if you learn how not to cheapen yourself, your ideas, or your opportunities through anxious overavailability."
      ),
    },
    standardBullets: [
      bullet(
        "Desire grows through distance. What is partly withheld often gains emotional value in the mind.",
        "Scarcity creates room for imagination to work."
      ),
      bullet(
        "Social proof intensifies wanting. People want things more once they see others reaching for them.",
        "Rivalry and prestige can multiply interest quickly."
      ),
      bullet(
        "Overexposure lowers heat. Constant availability can flatten curiosity and reduce perceived value.",
        "When nothing has to be earned, desire often cools."
      ),
      bullet(
        "Do not explain everything at once. Greene shows how some mystery keeps interest active.",
        "A fully flattened offer gives the imagination no role."
      ),
      bullet(
        "Obstacles can increase commitment. A small barrier or challenge can make people invest more deeply in what lies beyond it.",
        "Effort changes value perception."
      ),
      bullet(
        "Create genuine distinction. Desire lasts longer when what you offer actually carries style, rarity, or meaning.",
        "Scarcity without substance becomes a cheap trick."
      ),
      bullet(
        "Protect your own standards of access. Not everyone should get the same level of time, closeness, or opportunity by default.",
        "Selective access signals value and preserves energy."
      ),
      bullet(
        "Read other people's longing carefully. Sudden intensity can say more about fantasy, envy, or rivalry than about stable value.",
        "Not all desire is reliable."
      ),
      bullet(
        "Use absence more intelligently than pressure. Pulling back can reveal true interest faster than pushing harder.",
        "Distance often clarifies where words stay vague."
      ),
      bullet(
        "The closing lesson is about not cheapening value. Greene wants you to stop making what matters too easy to ignore.",
        "Respect for desire begins with respect for your own worth."
      ),
    ],
    deeperBullets: [
      bullet(
        "Covetousness often converts borrowed desire into personal desire. People start wanting what the crowd has already marked as important.",
        "That makes prestige environments especially potent and deceptive."
      ),
      bullet(
        "The imagination can outgrow the object. Once fantasy builds, the pursued thing may matter less than the story attached to it.",
        "This is why some pursuits collapse after acquisition."
      ),
      bullet(
        "Elusiveness is strongest when paired with real substance. Empty mystery eventually produces distrust.",
        "Greene's practical edge works best when scarcity protects something genuinely valuable."
      ),
      bullet(
        "Anxious overgiving is often self sabotage. People reveal insecurity when they flood others with access, proof, and explanation in hopes of forcing commitment.",
        "Desire usually weakens under that pressure."
      ),
      bullet(
        "The ethical use of this law is self respect. Create room, standards, and distinction so your work and relationships are entered with intention rather than casual consumption.",
        "That is different from manipulative baiting."
      ),
    ],
    takeaways: [
      "Distance can increase desire",
      "Prestige and rivalry amplify wanting",
      "Overexposure cheapens value",
      "Mystery leaves room for imagination",
      "Standards of access matter",
      "Not all desire is trustworthy",
    ],
    practice: [
      "Notice where you over explain or over offer",
      "Add one real standard of access to your time",
      "Test interest with distance instead of pressure",
      "Separate genuine value from crowd driven prestige",
    ],
    examples: [
      example(
        "ch05-ex01",
        "Everyone wants the same club role",
        ["school"],
        "A leadership role in a student organization suddenly becomes more attractive once several ambitious people start competing for it, including students who barely cared a month earlier.",
        [
          "Recognize that the surge in interest is partly social desire and decide whether the role truly fits your goals before joining the race.",
          "If you are already in consideration, let your work and standards speak instead of campaigning from visible desperation."
        ],
        "Covetousness grows when prestige and rivalry enter. The law helps you avoid confusing crowd heat with personal clarity."
      ),
      example(
        "ch05-ex02",
        "Project idea loses its appeal after oversharing",
        ["school"],
        "You keep explaining every feature of a proposed campus project to classmates, and what first felt exciting starts feeling ordinary and over familiar.",
        [
          "Stop flattening the idea with constant explanation and present the core value with enough room for curiosity and discovery.",
          "Invite selective involvement from the people who show sustained interest rather than broadcasting every detail to everyone."
        ],
        "Desire weakens when nothing is left to imagine or choose into. The point is not secrecy for its own sake, but protecting energy and value."
      ),
      example(
        "ch05-ex03",
        "Job candidate tries too hard",
        ["work"],
        "A candidate follows up after an interview with multiple long messages proving how available, interested, and flexible they are. The effort starts to feel less impressive than anxious.",
        [
          "Use one sharp follow up that reinforces value and interest without flooding the other side with access or pressure.",
          "Let your standard and selectivity support your credibility."
        ],
        "Overavailability can reduce perceived value because it signals fear of losing the opportunity more than confidence in fit."
      ),
      example(
        "ch05-ex04",
        "Product team rushes to give everything away",
        ["work"],
        "A small team keeps adding free custom work for every potential client in hopes of winning the deal, but the extra access makes the offer seem less distinctive rather than more compelling.",
        [
          "Protect the offer with clearer boundaries, selective access, and a sharper statement of what is genuinely rare or valuable about the work.",
          "Do not let fear of losing attention flatten the very thing that creates desire."
        ],
        "The law applies because value rises when access feels intentional and earned rather than limitless and anxious."
      ),
      example(
        "ch05-ex05",
        "Dating someone who only wants what is distant",
        ["personal"],
        "Someone pursues you intensely when you are busy and less available, then goes cool once you start making steady room for them.",
        [
          "Read the pattern as attraction to pursuit rather than stable readiness for closeness and adjust your trust accordingly.",
          "Do not chase consistency by offering even more of yourself."
        ],
        "Covetousness can mimic genuine affection at first. Distance exposes whether the desire has real depth."
      ),
      example(
        "ch05-ex06",
        "Creative work shared too early",
        ["personal"],
        "You show every early draft of a personal project to friends as soon as you make it, and the work starts to feel drained of its own energy before it is ready.",
        [
          "Keep more of the process protected until the work has enough substance to stand with confidence.",
          "Use selective sharing so feedback deepens the project instead of dispersing its charge."
        ],
        "Not every valuable thing benefits from constant exposure. Some forms of desire and commitment need space to mature."
      ),
    ],
    directQuestions: [
      question(
        "ch05-q01",
        "Why does overavailability often weaken desire?",
        [
          "Because people only value what is expensive.",
          "Because constant access removes distance, imagination, and earned commitment.",
          "Because interest should always be hidden.",
          "Because scarcity matters only in romance."
        ],
        1,
        "Greene argues that desire often needs some distance and effort to deepen."
      ),
      question(
        "ch05-q02",
        "Which move best reflects the law without becoming manipulative?",
        [
          "Create endless confusion so people stay hooked.",
          "Protect access with clear standards and let genuine value create interest.",
          "Ignore all follow up after showing initial interest.",
          "Manufacture rivalry even when none exists."
        ],
        1,
        "The strongest use of the law comes from self respect and real distinction, not empty games."
      ),
      question(
        "ch05-q03",
        "A role becomes appealing only after other people begin competing for it. What should you remember first?",
        [
          "Competition proves the role fits you perfectly.",
          "Crowd desire can inflate value beyond your own real reasons for wanting it.",
          "The smartest move is to join the race immediately.",
          "Prestige is always a reliable guide."
        ],
        1,
        "Covetousness often borrows value from social proof and rivalry."
      ),
      question(
        "ch05-q04",
        "What is the chapter's clearest warning?",
        [
          "Mystery can replace substance forever.",
          "Scarcity works only when people never understand what you offer.",
          "Anxious overgiving can cheapen your value faster than silence can.",
          "Distance is always better than communication."
        ],
        2,
        "The law warns against flattening value through fear driven overexposure."
      ),
    ],
  }),
  chapter({
    chapterId: "ch06-elevate-your-perspective",
    number: 6,
    title: "Elevate Your Perspective",
    readingTimeMinutes: 13,
    summary: {
      p1: t(
        "Shortsightedness makes people chase immediate relief, visible wins, and local emotion while ignoring the wider chain of consequences. Greene argues that many disasters begin with a narrow time horizon that feels practical in the moment and reckless later.",
        "The chapter teaches the reader to step above the present scene, study second order effects, and resist the pressure of urgency when the long term cost is still hidden.",
        "For Greene, perspective is a strategic advantage. It helps you see where today's comfort will become tomorrow's trap and where current pain might actually protect a better future."
      ),
      p2: t(
        "This matters because short horizon thinking appears in small daily choices as much as in dramatic mistakes. People overspend energy, damage trust, choose poor alliances, or lock themselves into weak options because the near term feeling is louder than the distant result.",
        "The deeper lesson is to train yourself to think like a future witness to today's decision. When you imagine what this move will create next, impulsive action loses some of its glamour.",
        "In real life, the law does not ask you to ignore the present. It asks you to place the present inside a longer arc so urgency stops pretending to be wisdom."
      ),
    },
    standardBullets: [
      bullet(
        "Short term relief is seductive. Greene shows how immediate comfort often disguises later cost.",
        "That is why impulsive decisions can feel smart while they are setting up future pain."
      ),
      bullet(
        "Lift your view above the moment. A wider perspective makes hidden consequences easier to see.",
        "Distance protects judgment from the drama of now."
      ),
      bullet(
        "Think in chains, not snapshots. Every serious decision creates a sequence, not just an isolated outcome.",
        "The next effect often matters more than the first effect."
      ),
      bullet(
        "Urgency can be a false advisor. Time pressure does not automatically mean the fastest move is the wisest move.",
        "Sometimes the urgent feeling belongs to fear, not to reality."
      ),
      bullet(
        "Study your moments of madness. Greene wants the reader to notice when desire, anger, boredom, or panic has repeatedly shortened their horizon.",
        "Pattern recognition helps you protect future decisions."
      ),
      bullet(
        "Trade local praise for long term position. People often take the move that looks good today and weakens them later.",
        "Perspective means choosing durability over quick applause."
      ),
      bullet(
        "Use planning as emotional discipline. Thinking through likely consequences calms impulse and improves timing.",
        "Forecasting is not pessimism. It is practical self control."
      ),
      bullet(
        "Accept delayed results. Many strong moves feel slower at the beginning because they are building a stronger base.",
        "Patience is easier once you trust compounding."
      ),
      bullet(
        "Read other people's short horizon too. Someone pushing for immediate gratification may be inviting you into a cost they do not plan to carry.",
        "Perspective improves your reading of pressure tactics."
      ),
      bullet(
        "The closing lesson is to become future minded. Greene wants you to make present choices that an older version of you will respect.",
        "That is how perspective becomes daily behavior."
      ),
    ],
    deeperBullets: [
      bullet(
        "Shortsightedness often masquerades as realism. People call a narrow decision practical because it solves the nearest discomfort.",
        "Greene is asking whether that comfort purchases a much larger problem."
      ),
      bullet(
        "The chapter treats imagination as a discipline, not as daydreaming. You need enough foresight to picture the consequences before you feel them.",
        "That kind of imagination is part of strategic maturity."
      ),
      bullet(
        "Long horizon thinking changes risk selection. Instead of avoiding all pain, you choose the pain that protects a better future.",
        "That is a harder but stronger standard than chasing ease."
      ),
      bullet(
        "Many people become tools of another person's urgency. A wider perspective helps you see whose timeline is being served by the push.",
        "This is why perspective improves resistance to manipulation."
      ),
      bullet(
        "The broader gain is steadier ambition. Once you think beyond the next burst of emotion, you can build systems, relationships, and work that survive contact with time.",
        "Perspective turns reaction into direction."
      ),
    ],
    takeaways: [
      "Short term relief can hide long term loss",
      "Think in chains not snapshots",
      "Urgency is not always wisdom",
      "Study your repeated moments of madness",
      "Choose durable position over quick applause",
      "Future minded thinking improves resistance",
    ],
    practice: [
      "Ask what this choice creates next month not just tonight",
      "Write the second and third effects of one big decision",
      "Notice who benefits from your urgency",
      "Choose one delayed gain over one fast relief",
    ],
    examples: [
      example(
        "ch06-ex01",
        "Cramming versus learning",
        ["school"],
        "You can cram for tomorrow's exam and probably survive it, but doing so means skipping the slower review that would actually help you in the final and in the next course.",
        [
          "Decide from the wider timeline and protect at least some study method that serves the later exam, not just tomorrow's panic.",
          "Treat the urge for immediate relief as information, not as the ruler of the whole plan."
        ],
        "Shortsightedness makes tomorrow feel like the only reality. Perspective restores the larger arc you are actually living inside."
      ),
      example(
        "ch06-ex02",
        "Taking the easy club promise",
        ["school"],
        "A student group offers you a flashy title with little substance, and you are tempted because it sounds impressive now even though it will consume time you wanted for deeper work.",
        [
          "Judge the role by what it builds over time, not by how satisfying it sounds in the next conversation.",
          "Choose the path that strengthens your long range direction even if it feels less glamorous immediately."
        ],
        "The law helps you separate near term image from lasting position."
      ),
      example(
        "ch06-ex03",
        "Rushing a weak product fix",
        ["work"],
        "A team wants to push a visible quick fix to quiet complaints, even though the patch will make the underlying system harder to repair next quarter.",
        [
          "Surface the second and third effects clearly and argue from the longer maintenance cost, not only from today's heat.",
          "If a temporary fix is unavoidable, keep it explicitly temporary with a real follow through plan."
        ],
        "Perspective matters because fast relief can quietly mortgage the future."
      ),
      example(
        "ch06-ex04",
        "Accepting a client who warps the roadmap",
        ["work"],
        "A potential client promises immediate revenue but demands custom work that would bend your product away from its strongest long term direction.",
        [
          "Judge the offer by the chain of consequences it creates after the first payment, not just by the immediate cash.",
          "Protect the larger position if the short term win would weaken the core."
        ],
        "Greene's law is about resisting the temptation to trade future strength for present relief."
      ),
      example(
        "ch06-ex05",
        "Comfort spending after a hard week",
        ["personal"],
        "After a draining week, you want to spend money you do not really have because the purchase would feel like instant emotional repair.",
        [
          "Pause long enough to picture how the decision will feel after the emotion drops and the financial cost remains.",
          "Choose a form of relief that does not make the next month harder."
        ],
        "Shortsightedness often treats mood repair as if it existed outside of future consequences."
      ),
      example(
        "ch06-ex06",
        "Returning to a familiar but harmful relationship",
        ["personal"],
        "You are tempted to go back to someone because the loneliness of today feels louder than the repeated pattern that made the relationship painful before.",
        [
          "Review the full cycle instead of the current ache and judge the decision from the whole pattern.",
          "Let memory of the longer arc balance the pressure of the present feeling."
        ],
        "The law matters because loneliness and fear can shrink time until the immediate comfort seems wiser than the whole lived history."
      ),
    ],
    directQuestions: [
      question(
        "ch06-q01",
        "What is the clearest sign of shortsightedness?",
        [
          "A decision that feels slightly uncomfortable now but stronger later.",
          "A decision made from the full chain of likely effects.",
          "A decision chosen mainly because it relieves the nearest discomfort.",
          "A decision that requires patience."
        ],
        2,
        "Shortsightedness favors immediate relief even when later cost is visible or knowable."
      ),
      question(
        "ch06-q02",
        "Why does Greene push second order thinking so strongly?",
        [
          "Because the first effect of a move is often less important than what it sets in motion next.",
          "Because prediction is always exact if you think hard enough.",
          "Because the present almost never matters.",
          "Because planning eliminates uncertainty."
        ],
        0,
        "Perspective improves when you study the chain created by a choice, not only the first visible result."
      ),
      question(
        "ch06-q03",
        "A leader is being rushed into a flashy response to bad news. What should they ask first?",
        [
          "How quickly can we look decisive.",
          "Who can we blame if this fails.",
          "What does this move solve after today's emotional pressure passes.",
          "How can we make the response feel confident."
        ],
        2,
        "The law teaches future minded diagnosis before satisfying the emotional demand of the moment."
      ),
      question(
        "ch06-q04",
        "What is the healthiest way to think about delayed results?",
        [
          "As proof the plan is failing.",
          "As wasted time unless other people notice the effort.",
          "As an expected part of building durable gains.",
          "As something only patient personalities can handle."
        ],
        2,
        "Perspective trusts compounding and does not let slow visible reward automatically discredit a strong move."
      ),
    ],
  }),
  chapter({
    chapterId: "ch07-soften-peoples-resistance",
    number: 7,
    title: "Soften People's Resistance",
    readingTimeMinutes: 13,
    summary: {
      p1: t(
        "Defensiveness makes people protect their self image before they evaluate your argument, and Greene argues that direct pressure often hardens the very resistance you are trying to overcome. If someone feels corrected, cornered, or made small, they start defending identity instead of considering truth.",
        "The law teaches indirect influence through recognition, timing, and respect for the other person's self opinion.",
        "Greene is not saying people should be flattered into illusion. He is saying that persuasion works better once you understand how deeply people need to feel reasonable in their own eyes."
      ),
      p2: t(
        "This matters because blunt truth can fail even when it is accurate. Many stalled conversations, rejected ideas, and pointless conflicts come from attacking another person's pride instead of shaping the conditions under which they can revise themselves.",
        "The deeper lesson is that influence begins with ego management. People become more flexible when they feel seen, not humiliated.",
        "In everyday life, this law is useful both socially and morally. It helps you reduce needless friction without surrendering honesty, because the aim is smarter delivery, not fakery."
      ),
    },
    standardBullets: [
      bullet(
        "People defend identity before ideas. Greene argues that most resistance begins in self image, not in pure logic.",
        "If your approach threatens how someone sees themselves, argument quality may stop mattering."
      ),
      bullet(
        "Confirm self opinion first. Recognition lowers resistance because it lets the other person keep dignity while listening.",
        "People loosen faster when they do not feel erased."
      ),
      bullet(
        "Avoid direct ego collisions. Public correction, contempt, and impatience usually strengthen the wall you wanted to lower.",
        "A bruised ego rarely becomes more teachable."
      ),
      bullet(
        "Lead people toward the conclusion. Indirect framing often works better than blunt insistence.",
        "Ownership of the idea matters to acceptance."
      ),
      bullet(
        "Use questions to widen thought. A good question lets someone adjust without feeling defeated.",
        "Questions can create room where assertions create armor."
      ),
      bullet(
        "Match timing to receptivity. Even sound advice fails when delivered during shame, anger, or public exposure.",
        "Right timing is part of respect."
      ),
      bullet(
        "Separate the person from the problem. The more clearly you target the issue, the less likely the other person is to experience the conversation as a personal attack.",
        "Precision protects influence."
      ),
      bullet(
        "Notice your own need to be right. Defensiveness is contagious, and your ego can easily join the contest.",
        "Persuasion weakens once self victory becomes your hidden goal."
      ),
      bullet(
        "Set boundaries without humiliation. You can be firm and still leave the other person some face to stand on.",
        "Strength is often more effective when it is not theatrical."
      ),
      bullet(
        "The chapter closes on practical realism. People change more easily when their pride is guided instead of crushed.",
        "That is the difference between forcing compliance and creating movement."
      ),
    ],
    deeperBullets: [
      bullet(
        "Defensiveness often hides fear of psychic collapse. Some people cling to an opinion because letting go would destabilize the story they live inside.",
        "Reading that fear helps you choose a wiser approach."
      ),
      bullet(
        "Indirect influence is not weakness. It is often the stronger route because it works with human ego instead of pretending ego does not exist.",
        "Greene treats this as practical respect for reality."
      ),
      bullet(
        "Flattery is a shallow substitute for confirmation. Empty praise may soothe someone briefly, but it usually does not create durable openness.",
        "The better move is accurate recognition tied to the conversation at hand."
      ),
      bullet(
        "When someone cannot tolerate any dent to self opinion, persuasion has limits. At that point distance, structure, or consequence may work better than further dialogue.",
        "The law includes knowing when talk is no longer the tool."
      ),
      bullet(
        "The inner use of this chapter is humility. Once you notice how much your own ego resists correction, you become both a better persuader and a better learner.",
        "Self observation keeps the law from becoming one sided social technique."
      ),
    ],
    takeaways: [
      "Resistance usually starts in self image",
      "Confirm dignity before pushing change",
      "Questions often work better than collision",
      "Timing shapes receptivity",
      "Firmness does not require humiliation",
      "Your own ego can ruin persuasion",
    ],
    practice: [
      "Begin one hard conversation by naming what the other person values",
      "Use a question where you would usually use a correction",
      "Wait for a calmer time before giving one piece of advice",
      "Notice when your need to win overrides your aim to persuade",
    ],
    examples: [
      example(
        "ch07-ex01",
        "Teammate who rejects feedback",
        ["school"],
        "A teammate shuts down whenever edits are suggested and immediately explains why their section should stay untouched.",
        [
          "Start by naming what is working in their effort and then move the conversation toward the shared standard the project still needs to meet.",
          "Use questions that let them help improve the section instead of making the exchange a verdict on their competence."
        ],
        "The law matters because people hear criticism through the filter of self opinion. If dignity collapses, collaboration usually follows."
      ),
      example(
        "ch07-ex02",
        "Club member who feels ignored",
        ["school"],
        "A club member is resisting every new process, but beneath the pushback it is clear they feel sidelined and unrecognized by newer leaders.",
        [
          "Acknowledge the value of what they have contributed before asking them to engage the new system on its merits.",
          "Once their status injury is lowered, you can discuss the process with far less friction."
        ],
        "People often defend wounded pride under the cover of principle. Recognition softens resistance enough for the real issue to appear."
      ),
      example(
        "ch07-ex03",
        "Manager pushing a weak plan",
        ["work"],
        "Your manager is attached to a plan with clear flaws, and bluntly calling it a bad idea in the meeting would likely make them defend it harder.",
        [
          "Frame your concern around the result both of you want, then ask questions that surface the weak point without forcing an immediate ego contest.",
          "Give the manager a path to adjust while preserving face."
        ],
        "The law is not about manipulation for its own sake. It is about delivering truth in a form the other person can actually use."
      ),
      example(
        "ch07-ex04",
        "Coworker who takes boundaries personally",
        ["work"],
        "A coworker sees every limit on your time as rejection and responds with defensiveness or guilt.",
        [
          "State the boundary in terms of workload and priorities rather than in language that invites them to read it as a personal downgrading.",
          "Be firm, but keep the boundary free of unnecessary sting."
        ],
        "People hear no through the story they tell about themselves. Cleaner framing reduces avoidable resistance."
      ),
      example(
        "ch07-ex05",
        "Friend who doubles down when corrected",
        ["personal"],
        "A friend says something unfair in an argument, and the more directly you prove they are wrong, the more stubborn and defensive they become.",
        [
          "Step away from the urge to win the point and ask the question that gets underneath the fear or pride driving the argument.",
          "Return to the issue once the need for self defense has lowered."
        ],
        "Defensiveness can make truth sound like attack. If identity is on fire, logic usually arrives too late."
      ),
      example(
        "ch07-ex06",
        "Parent who resists advice",
        ["personal"],
        "You want a parent to change a habit that is causing problems, but every direct instruction gets heard as disrespect.",
        [
          "Begin from shared concern and past competence before suggesting a specific change in a way that preserves dignity.",
          "If the moment is too charged, wait instead of trying to force openness from humiliation."
        ],
        "The law helps because people of every age often protect pride before they consider advice."
      ),
    ],
    directQuestions: [
      question(
        "ch07-q01",
        "Why does direct correction often fail even when the correction is accurate?",
        [
          "Because facts never persuade anyone.",
          "Because people usually defend self image before they evaluate the idea.",
          "Because truth should always remain private.",
          "Because disagreement ruins all trust."
        ],
        1,
        "Greene's core point is that ego resistance often blocks the path before reason can enter."
      ),
      question(
        "ch07-q02",
        "What is the strongest first move in a persuasive conversation with a defensive person?",
        [
          "Show them immediately why they are wrong.",
          "Confirm the part of their self opinion or concern that is genuinely true before moving the discussion forward.",
          "Use sarcasm to break the tension.",
          "Speak more loudly so the point feels unavoidable."
        ],
        1,
        "Recognition lowers resistance by preserving dignity without requiring you to surrender honesty."
      ),
      question(
        "ch07-q03",
        "Which method best reflects indirect influence?",
        [
          "Cornering someone into agreement in front of others.",
          "Letting them arrive at the revision through questions and framing.",
          "Withholding all information until they apologize.",
          "Flattering them until they obey."
        ],
        1,
        "Indirect influence works by creating a path to adjustment that does not force an ego collapse."
      ),
      question(
        "ch07-q04",
        "What is the chapter's most important warning for the reader?",
        [
          "Your own need to be right can quietly turn persuasion into a duel.",
          "Every difficult person is impossible to influence.",
          "Boundaries always need soft language.",
          "Public pressure is the best path to durable change."
        ],
        0,
        "The law applies inward too. Your ego can sabotage the influence you were trying to build."
      ),
    ],
  }),
  chapter({
    chapterId: "ch08-change-your-circumstances-by-changing-your-attitude",
    number: 8,
    title: "Change Your Circumstances by Changing Your Attitude",
    readingTimeMinutes: 13,
    summary: {
      p1: t(
        "Self sabotage begins in attitude, and Greene argues that the story you carry about yourself, other people, and the world shapes what you notice, what risks you take, and what possibilities you refuse. A constricted attitude makes life look hostile, fixed, and small, while an expansive attitude opens range and movement.",
        "The chapter does not deny external limits. It shows how inner posture can intensify those limits or help you work with them more creatively.",
        "Greene is interested in the hidden way attitude becomes fate. What feels like reality can often be a repeated interpretation you have taught yourself to trust."
      ),
      p2: t(
        "This matters because many people keep reproducing the very circumstances they say they want to escape. They shrink from challenge, misread neutral events as rejection, or build narratives that guarantee hesitation and bitterness.",
        "The deeper lesson is that attitude is not mood decoration. It is a filtering system that shapes perception, action, and social response.",
        "In practice, the law is empowering because it locates freedom in interpretation and behavior. You may not control every condition, but you can stop strengthening bad conditions with the same stale inner script."
      ),
    },
    standardBullets: [
      bullet(
        "Attitude filters reality. Greene argues that how you interpret events changes what you see and what you do next.",
        "That filter can either widen choice or quietly narrow it."
      ),
      bullet(
        "A constricted attitude expects defeat. It reads challenge as proof of limitation and uses that reading to avoid growth.",
        "The result is often self confirming failure."
      ),
      bullet(
        "An expansive attitude looks for range. It does not deny pain or difficulty, but it refuses to make them the whole story.",
        "That stance creates more room for action."
      ),
      bullet(
        "Notice your repeated inner script. Greene wants the reader to hear the phrases that keep turning struggle into identity.",
        "The story you repeat shapes the future you permit."
      ),
      bullet(
        "Stop overpersonalizing setbacks. Many obstacles are structural or ordinary, yet people read them as proof of private inadequacy.",
        "That interpretation makes recovery slower and weaker."
      ),
      bullet(
        "Use action to change attitude. Waiting to feel different before moving usually extends the old pattern.",
        "A better posture is often built through behavior."
      ),
      bullet(
        "Protect energy from bitterness. Chronic resentment narrows attention and makes even opportunity feel like threat.",
        "A negative attitude often becomes socially contagious as well."
      ),
      bullet(
        "Expand curiosity under stress. Asking what else might be true interrupts a constricted reading of events.",
        "Curiosity keeps the mind from collapsing into one interpretation."
      ),
      bullet(
        "Choose environments that support the better script. Surroundings influence which attitude becomes normal.",
        "A strong inner shift is easier when the outer setting does not constantly reinforce the old loop."
      ),
      bullet(
        "The closing lesson is that freedom begins in stance. Greene wants the reader to stop handing circumstance extra power through interpretation.",
        "Attitude does not solve everything, but it changes the field you meet everything from."
      ),
    ],
    deeperBullets: [
      bullet(
        "Self sabotage often feels realistic to the person living it. Pessimism can masquerade as wisdom because it protects against disappointment.",
        "Greene challenges that comfort by asking what it has actually produced."
      ),
      bullet(
        "Attitude changes social feedback. People respond differently to someone who radiates possibility than to someone who radiates grievance and defeat.",
        "This creates a loop in which attitude helps shape the environment that seems to confirm it."
      ),
      bullet(
        "The law is not naive positivity. Expansive attitude includes realism, but it refuses to collapse identity around suffering or limitation.",
        "That distinction keeps the chapter grounded."
      ),
      bullet(
        "Behavioral experimentation matters. One new move can break a stale mental script faster than another hour of private rumination.",
        "Action gives the mind fresh evidence to work with."
      ),
      bullet(
        "The strategic gain is regained agency. Once you see attitude as a lever, you stop treating your current interpretation as unquestionable fact.",
        "That is where practical freedom begins."
      ),
    ],
    takeaways: [
      "Attitude filters what you see",
      "Constricted stories shrink action",
      "Expansive attitude creates range",
      "Action can reshape inner posture",
      "Bitterness distorts perception",
      "Agency begins in stance",
    ],
    practice: [
      "Write the old script you keep replaying",
      "Ask what else could be true before deciding a setback means failure",
      "Take one outward action before waiting to feel ready",
      "Choose one environment that reinforces the better attitude",
    ],
    examples: [
      example(
        "ch08-ex01",
        "After one bad grade",
        ["school"],
        "You receive one disappointing grade and quickly turn it into a story that you are simply not the kind of person who succeeds in this subject.",
        [
          "Treat the grade as data about one performance and build the next step from what can be changed instead of from what the result supposedly proves about you.",
          "Use action, such as office hours or a revised study method, to interrupt the script early."
        ],
        "Self sabotage begins when one event becomes an identity. The law restores movement by changing the interpretation and the next behavior together."
      ),
      example(
        "ch08-ex02",
        "Campus rejection spiral",
        ["school"],
        "After not getting one selective role, you start reading later neutral responses from professors and clubs as signs that nothing is opening for you.",
        [
          "Notice the constricted storyline forming and challenge it with fresh evidence rather than letting one disappointment define the whole season.",
          "Keep making targeted attempts from a wider view of the field."
        ],
        "A negative attitude narrows reality until it looks smaller than it is. Greene wants the reader to stop feeding that shrinkage."
      ),
      example(
        "ch08-ex03",
        "Workplace disappointment turning bitter",
        ["work"],
        "You were passed over for a chance at work, and now every request from the team feels like proof that you are only valued for routine support.",
        [
          "Separate the disappointment from the total meaning you are assigning to every later interaction and look for moves that increase real leverage instead of private bitterness.",
          "Choose one action that expands options rather than rehearsing the grievance."
        ],
        "Bitterness feels clarifying, but it usually narrows the field and leads to more self sabotage than strategic response."
      ),
      example(
        "ch08-ex04",
        "Startup slump interpreted as doom",
        ["work"],
        "A project hits a rough quarter, and the team begins talking as if the setback proves the whole venture was flawed from the start.",
        [
          "Interrupt the collapse into fatal meaning and separate what the setback actually reveals from what fear is adding to the story.",
          "Use the expanded reading to decide the next experiment or correction."
        ],
        "Attitude shapes what evidence seems visible. Once the team adopts a constricted script, it starts acting in ways that make the script come true."
      ),
      example(
        "ch08-ex05",
        "Social withdrawal after embarrassment",
        ["personal"],
        "One awkward social moment leads you to pull back from invitations because the event now feels like proof that you always come off badly.",
        [
          "Refuse to let the mind turn one moment into a fixed identity and reenter social situations before the story hardens.",
          "Use small outward actions to produce better evidence than the old script provides."
        ],
        "Self sabotage strengthens through retreat. The chapter pushes you toward fresh contact with reality."
      ),
      example(
        "ch08-ex06",
        "Family narrative you keep obeying",
        ["personal"],
        "You still carry a family story that you are the unreliable one, and now every small mistake seems to confirm that role while your successes feel temporary or accidental.",
        [
          "Name the inherited script directly and stop using it as the default explanation for every imperfect moment.",
          "Build a pattern of behavior that creates a newer identity from evidence rather than from family memory."
        ],
        "Greene's point is that attitude can become destiny when an old story is never examined or challenged."
      ),
    ],
    directQuestions: [
      question(
        "ch08-q01",
        "What makes attitude so powerful in this law?",
        [
          "It determines external conditions by itself.",
          "It shapes perception, action, and the meaning attached to events.",
          "It allows you to avoid all painful feeling.",
          "It replaces the need for skill."
        ],
        1,
        "Greene treats attitude as a filtering system that changes what you notice and how you respond."
      ),
      question(
        "ch08-q02",
        "What is the strongest way to interrupt self sabotage?",
        [
          "Wait until your mood fully improves before doing anything new.",
          "Repeat positive phrases while leaving behavior unchanged.",
          "Take a concrete action that weakens the old script and creates fresh evidence.",
          "Assume the problem is only external."
        ],
        2,
        "Action helps revise attitude because it gives the mind a different set of facts to work with."
      ),
      question(
        "ch08-q03",
        "Which response best reflects an expansive attitude?",
        [
          "This setback proves the whole path was wrong.",
          "This is painful, but it is one event and I still have room to respond intelligently.",
          "Nothing matters if I did not get the outcome I wanted.",
          "The safest move is to expect less from now on."
        ],
        1,
        "An expansive attitude stays realistic without shrinking identity and possibility around one failure."
      ),
      question(
        "ch08-q04",
        "What is the chapter's clearest warning about bitterness?",
        [
          "It makes you morally superior to people who succeed.",
          "It protects you from future disappointment.",
          "It narrows perception and quietly reproduces the conditions you resent.",
          "It is harmless as long as you keep it private."
        ],
        2,
        "Bitterness constricts perception, energy, and behavior, which is why Greene treats it as a self sabotaging stance."
      ),
    ],
  }),
  chapter({
    chapterId: "ch09-confront-your-dark-side",
    number: 9,
    title: "Confront Your Dark Side",
    readingTimeMinutes: 13,
    summary: {
      p1: t(
        "Repression hides the traits you dislike in yourself, but Greene argues that those denied parts do not disappear. They leak out through mood swings, overreactions, moral rigidity, secret compulsions, and contradictions between the image you present and the behavior that keeps breaking through it.",
        "The chapter calls this hidden region the dark side or shadow and treats it as a normal part of human nature, not a freak exception.",
        "Greene is warning the reader that what you most refuse to face in yourself often gains power precisely through that refusal."
      ),
      p2: t(
        "This matters because the traits people judge most harshly in others often have some unresolved echo in themselves. Repression makes self knowledge weak and projection stronger.",
        "The deeper lesson is integration rather than self hatred. Once you can admit ambition, envy, sexuality, aggression, vanity, or neediness as part of your actual makeup, those forces become easier to direct instead of easier to deny.",
        "In real life, confronting the dark side reduces hypocrisy and surprise. You stop acting shocked by your own contradictions and start working with them honestly."
      ),
    },
    standardBullets: [
      bullet(
        "Denied traits do not vanish. Greene argues that repressed qualities return through sideways behavior.",
        "What is hidden often becomes more powerful, not less."
      ),
      bullet(
        "The dark side is normal. Everyone contains impulses and desires they would rather not include in their public identity.",
        "Treating this as human baseline makes honest observation possible."
      ),
      bullet(
        "Watch for contradiction. Sudden cruelty from a gentle image or reckless indulgence from a rigid moral image often signals repression at work.",
        "The gap between persona and behavior is a key clue."
      ),
      bullet(
        "Projection is a major symptom. People often attack in others what they cannot bear to face in themselves.",
        "That is why strong moral certainty can hide blind spots."
      ),
      bullet(
        "Humor, fantasy, and slips can reveal what is underneath. The hidden self leaks out in moments of reduced control.",
        "You learn a lot from what escapes casually."
      ),
      bullet(
        "Integration is stronger than denial. Admitting a trait gives you more choice about how it appears.",
        "What is named becomes more governable."
      ),
      bullet(
        "Do not build identity around purity. The need to look spotless often drives the strongest repression.",
        "A rigid self image makes honest self study harder."
      ),
      bullet(
        "Read your strongest recurring judgments. The traits you obsessively condemn may be pointing back toward something unresolved in you.",
        "Judgment can become a diagnostic tool."
      ),
      bullet(
        "Channel dark energy constructively. Aggression, ambition, desire, and intensity can all become useful once they are acknowledged and directed.",
        "Integration turns raw force into chosen force."
      ),
      bullet(
        "The final lesson is to become less divided. Greene wants a fuller self that is honest enough to hold contradiction without collapsing into it.",
        "That honesty creates both realism and control."
      ),
    ],
    deeperBullets: [
      bullet(
        "Repression often forms early when certain traits are punished, shamed, or made incompatible with the role a person learned to play.",
        "The adult pattern can therefore feel morally chosen when it actually began as adaptation."
      ),
      bullet(
        "Extreme saintliness can hide extreme shadow material. The harder someone works to appear above ordinary impulse, the more carefully you should watch for leakage.",
        "Greene repeatedly warns against worshiping spotless images."
      ),
      bullet(
        "Integration is not indulgence. Admitting a dark impulse does not mean obeying it. It means bringing it into conscious governance.",
        "That distinction keeps the chapter from sliding into excuse making."
      ),
      bullet(
        "Projection damages relationships because it makes self knowledge external. The person keeps hunting outside themselves for what really needs inward recognition.",
        "That search produces repetitive conflict."
      ),
      bullet(
        "The strategic gain of this law is reduced surprise. When you know your own shadow material, you are less likely to be hijacked by it or manipulated through it.",
        "Self honesty is protective power."
      ),
    ],
    takeaways: [
      "Denied traits leak sideways",
      "The shadow is normal not rare",
      "Projection reveals blind spots",
      "Purity images create weakness",
      "Integration beats denial",
      "Named impulses are easier to direct",
    ],
    practice: [
      "Notice one trait you judge too intensely in others",
      "Track one contradiction between your image and your behavior",
      "Name one impulse you keep pretending you do not have",
      "Channel one dark energy into a chosen form of work",
    ],
    examples: [
      example(
        "ch09-ex01",
        "Rigidly good teammate who gossips hard",
        ["school"],
        "A classmate presents themselves as the most mature and ethical person in the group, yet they repeatedly spread the sharpest gossip when someone threatens their status.",
        [
          "Read the contradiction as a clue about repression instead of taking the moral image at full face value.",
          "Protect your trust decisions through pattern rather than through the comfort of their persona."
        ],
        "The shadow often shows up where the image is most polished. Greene wants you to watch the leak, not just the mask."
      ),
      example(
        "ch09-ex02",
        "You judge attention seekers harshly",
        ["school"],
        "You find yourself unusually irritated by students who speak with confidence in seminars, and the intensity of your annoyance feels bigger than the situation itself.",
        [
          "Ask whether the reaction contains envy, disowned ambition, or fear of your own desire to be seen.",
          "Use that recognition to respond more honestly instead of turning the discomfort into moral superiority."
        ],
        "Projection becomes visible when your judgment is stronger than the actual offense."
      ),
      example(
        "ch09-ex03",
        "Leader with a spotless image",
        ["work"],
        "A leader brands themselves as unusually selfless and principled, but the team keeps noticing hidden competition, favoritism, and vindictive small moves.",
        [
          "Pay attention to repeated contradictions between the image and the behavior rather than giving the image ongoing credit it has not earned.",
          "Make decisions around the lived pattern, not the official story."
        ],
        "Greene warns that strong virtue theater can hide a powerful shadow that leaks through when stakes rise."
      ),
      example(
        "ch09-ex04",
        "Creative ambition denied as detachment",
        ["work"],
        "You tell yourself you do not care about recognition, but you become sullen and critical whenever someone else gets credit for work near yours.",
        [
          "Admit that ambition matters to you and create a direct, constructive way to pursue recognition instead of letting resentment speak for it.",
          "Integrated ambition is easier to manage than denied ambition."
        ],
        "What is hidden tends to govern from below. Naming the motive gives you more choice in how to act."
      ),
      example(
        "ch09-ex05",
        "Relationship built on being the calm one",
        ["personal"],
        "You pride yourself on always being calm in conflict, but when anger finally breaks through it arrives as cutting remarks and delayed retaliation instead of clean honesty.",
        [
          "Stop treating anger as incompatible with your identity and learn to express it earlier in a direct, bounded way.",
          "Integration lowers the risk of explosive leakage later."
        ],
        "Repressed emotion does not vanish because it offends your image. It usually returns in a less controlled form."
      ),
      example(
        "ch09-ex06",
        "Moral outrage hiding personal struggle",
        ["personal"],
        "A family member constantly condemns other people's selfishness while quietly using guilt and emotional pressure to control everyone around them.",
        [
          "See the contradiction clearly and respond to the controlling behavior rather than getting lost inside the moral language around it.",
          "Keep boundaries around the lived pattern instead of the self description."
        ],
        "The chapter teaches that projection and repression often make people fiercest against the traits they are enacting indirectly."
      ),
    ],
    directQuestions: [
      question(
        "ch09-q01",
        "What is the core problem with repression?",
        [
          "It removes all dark impulses permanently.",
          "It makes hidden traits disappear from behavior.",
          "It pushes denied traits into indirect and less controlled forms.",
          "It matters only for extreme personalities."
        ],
        2,
        "Greene's point is that denied qualities leak out sideways and often become harder to govern."
      ),
      question(
        "ch09-q02",
        "Which sign most strongly suggests projection?",
        [
          "Calm curiosity about another person's flaws.",
          "An unusually charged judgment that keeps returning to the same trait in others.",
          "A willingness to admit mixed motives in yourself.",
          "A balanced response to contradiction."
        ],
        1,
        "Projection often appears as repeated, overheated judgment of a trait the person has not faced inwardly."
      ),
      question(
        "ch09-q03",
        "What does healthy integration look like in this law?",
        [
          "Openly indulging every impulse.",
          "Pretending the impulse is gone because you understand it.",
          "Admitting the impulse and directing it consciously.",
          "Avoiding situations that might reveal contradiction."
        ],
        2,
        "Integration means bringing a trait into awareness so it can be governed instead of denied."
      ),
      question(
        "ch09-q04",
        "Why are spotless moral images risky?",
        [
          "They always prove a person is lying.",
          "They can encourage repression and make shadow behavior harder to notice until it leaks.",
          "They make people less interesting.",
          "They only matter in politics."
        ],
        1,
        "Greene repeatedly warns that an intense need to appear pure can strengthen repression rather than wisdom."
      ),
    ],
  }),
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

  lines.push("# 1. Book audit summary for The Laws of Human Nature by Robert Greene", "");
  AUDIT_SUMMARY.forEach((paragraph) => lines.push(sentence(paragraph), ""));

  lines.push("# 2. Main content problems found", "");
  MAIN_PROBLEMS.forEach((paragraph, index) => lines.push(`${index + 1}. ${sentence(paragraph)}`));
  lines.push("");

  lines.push("# 3. Personalization strategy for The Laws of Human Nature by Robert Greene", "");
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
  lines.push("4. The generic template prose, recycled scenarios, and weak quiz patterns were replaced book wide.");
  lines.push("5. The package remains schema compatible while the reader can apply a Laws specific motivation layer.");
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
