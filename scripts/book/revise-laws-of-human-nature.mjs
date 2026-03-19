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
  chapter({
    chapterId: "ch10-beware-the-fragile-ego",
    number: 10,
    title: "Beware the Fragile Ego",
    readingTimeMinutes: 13,
    summary: {
      p1: t(
        "Envy grows from comparison, and Greene argues that people are most threatened not by the far away success of strangers but by the nearby success of peers, friends, siblings, and colleagues. The pain comes from similarity, because another person's rise can feel like a judgment on your own standing.",
        "This law teaches the reader to recognize envy as a hidden force that rarely announces itself honestly. It often appears as cool distance, faint praise, small sabotage, moral criticism, or sudden delight when the envied person stumbles.",
        "Greene wants you to understand envy as a major social pressure precisely because it hides so well. People are ashamed of it, so they disguise it."
      ),
      p2: t(
        "This matters because envy can quietly corrode trust long before open conflict appears. Success changes relationships, and some people cannot bear to remain close to what makes them feel smaller.",
        "The deeper lesson is double sided. You need to detect envy in others, but you also need to study your own envious impulses before they harden into bitterness or disguised attack.",
        "In practice, the law asks for realism and restraint. Do not flaunt advantages carelessly, and do not assume admiration is always as clean as it sounds."
      ),
    },
    standardBullets: [
      bullet(
        "Envy thrives on similarity. People usually feel it most strongly toward those they see as close comparisons.",
        "A peer's success can feel more painful than a distant celebrity's success."
      ),
      bullet(
        "Envy hides behind masks. Greene shows how it often appears as subtle coldness, faint praise, moral criticism, or small obstruction.",
        "Because the feeling is shameful, it rarely arrives openly."
      ),
      bullet(
        "Watch the emotional shift after success. Some people become harder to read, less warm, or oddly detached once you gain status, attention, or momentum.",
        "That shift matters even if their words remain supportive."
      ),
      bullet(
        "Do not broadcast every advantage. Visible ease, bragging, and constant proof of superiority can trigger avoidable resentment.",
        "Restraint protects relationships without requiring false humility."
      ),
      bullet(
        "Read sabotage in small forms. Delayed help, private undermining, and quiet pleasure in your setback can all signal envy at work.",
        "The pattern matters more than one awkward remark."
      ),
      bullet(
        "Admiration and envy can coexist. A person may genuinely respect you while also feeling pained by your rise.",
        "Human feeling is often mixed, not pure."
      ),
      bullet(
        "Study your own comparisons. Envy becomes less dangerous once you can name the wound instead of disguising it.",
        "Awareness turns corrosive feeling into usable information."
      ),
      bullet(
        "Transform envy into direction. Another person's strength can reveal what you actually want to build rather than what you merely resent.",
        "That shift keeps comparison from turning destructive."
      ),
      bullet(
        "Limit trust where envy deepens. Some relationships cannot carry asymmetry well once status gaps become visible.",
        "Realism can be kinder than repeated surprise."
      ),
      bullet(
        "The final lesson is sober. Success changes emotional weather around you, and not everyone can stand in that new climate gracefully.",
        "Greene wants you alert without becoming paranoid."
      ),
    ],
    deeperBullets: [
      bullet(
        "Envy often attaches to what feels unfairly close. Shared background, similar age, or parallel ambition can make comparison especially sharp.",
        "Proximity intensifies the wound."
      ),
      bullet(
        "People often moralize envy. Instead of admitting pain, they recast the envied person as shallow, lucky, compromised, or undeserving.",
        "That story protects self image while preserving resentment."
      ),
      bullet(
        "The envied person can self sabotage by overdisplaying ease. Visible comfort can inflame the feeling more than achievement itself.",
        "Understatement is sometimes a form of social intelligence."
      ),
      bullet(
        "Your own envy becomes most useful when it points to neglected desire. The question is not only whom you envy, but what that envy is revealing about your hunger.",
        "Properly read, the feeling can become directional rather than corrosive."
      ),
      bullet(
        "The strategic gain of this law is cleaner trust management. Once you notice who grows bitter around comparison, you can adjust exposure, expectation, and alliance with less confusion.",
        "Envy is easier to survive when it is not misnamed as random mood."
      ),
    ],
    takeaways: [
      "Envy feeds on similarity",
      "It often hides behind politeness",
      "Success can change old relationships",
      "Do not overdisplay advantage",
      "Read your own comparisons honestly",
      "Envy can become direction or sabotage",
    ],
    practice: [
      "Notice one relationship that changed after visible success",
      "Understate one advantage instead of showcasing it",
      "Name one envy and ask what desire sits underneath it",
      "Track small sabotage instead of explaining it away",
    ],
    examples: [
      example(
        "ch10-ex01",
        "Friend grows cold after your award",
        ["school"],
        "After you win a scholarship, a friend congratulates you politely but stops sharing information, withdraws warmth, and jokes more sharply about your ambition.",
        [
          "Treat the emotional shift as meaningful data and lower how much validation or strategic trust you keep expecting from the friendship for now.",
          "Stay civil, but do not ignore the pattern because the words stayed technically supportive."
        ],
        "Envy often arrives as a change in warmth rather than as open confession. Greene wants you to read the shift without melodrama."
      ),
      example(
        "ch10-ex02",
        "Classmate celebrates your setback",
        ["school"],
        "A classmate who always compared themselves to you seems oddly energized when you stumble on an exam, even though they still talk like a supportive friend.",
        [
          "Notice the mismatch between the stated support and the emotional reaction to your failure before deciding how much closeness or cooperation still makes sense.",
          "Keep the observation grounded in pattern, not in a single dramatic accusation."
        ],
        "Pleasure at another person's fall is one of the clearest signs that comparison has turned toxic."
      ),
      example(
        "ch10-ex03",
        "Peer on the team starts undermining quietly",
        ["work"],
        "A colleague with a similar role becomes noticeably less helpful after your work gets public praise and begins questioning your ideas in subtle ways outside the meeting.",
        [
          "Read the timing and pattern clearly and protect your work with documentation, calmer exposure, and lower dependence on their goodwill.",
          "Do not feed the comparison further through unnecessary display."
        ],
        "The law matters because envy often moves sideways through private undermining long before open conflict appears."
      ),
      example(
        "ch10-ex04",
        "Your own resentment after someone else's promotion",
        ["work"],
        "A coworker gets promoted, and you catch yourself downgrading their talent and replaying every lucky break they ever had.",
        [
          "Name the envy directly and ask what it is revealing about your own neglected ambition or frustration.",
          "Turn the pain into a clearer plan instead of into a secret campaign against their legitimacy."
        ],
        "Greene does not want the reader to act above envy. He wants you to use self honesty before the feeling hardens into sabotage."
      ),
      example(
        "ch10-ex05",
        "Sibling comparison after a visible win",
        ["personal"],
        "After a big personal milestone, a sibling becomes more sarcastic and less available even though they continue using the language of family support.",
        [
          "Respect the possibility that your gain has activated an old comparison dynamic and adjust how much celebration or disclosure you keep routing through them.",
          "Stay kind without forcing closeness they cannot currently hold."
        ],
        "Envy is especially sharp in close comparison relationships because history gives the feeling more fuel."
      ),
      example(
        "ch10-ex06",
        "You feel stung by a friend's new relationship",
        ["personal"],
        "A close friend enters a relationship that seems stable and happy, and you feel yourself becoming more dismissive of their choices than the situation really warrants.",
        [
          "Treat the reaction as information about your own unmet longing instead of disguising it as superior judgment about their life.",
          "Use the feeling to understand what you want rather than to reduce what they have."
        ],
        "The law teaches that envy becomes less corrosive when it is faced as pain and desire instead of hidden under contempt."
      ),
    ],
    directQuestions: [
      question(
        "ch10-q01",
        "Why is envy often strongest toward peers rather than distant stars?",
        [
          "Because peers are easier to judge morally.",
          "Because similarity makes their success feel like a comparison with your own standing.",
          "Because strangers can never trigger envy.",
          "Because envy depends only on money."
        ],
        1,
        "Greene emphasizes similarity and proximity as the main intensifiers of envy."
      ),
      question(
        "ch10-q02",
        "Which reaction most strongly suggests envy rather than simple disagreement?",
        [
          "A friend asks practical questions about how you achieved something.",
          "A person becomes quietly colder and more undermining after your visible success.",
          "A colleague wants clearer details about a plan.",
          "A sibling needs time after a stressful week."
        ],
        1,
        "The emotional shift after your rise is a stronger clue than polite surface language."
      ),
      question(
        "ch10-q03",
        "What is the healthiest inward response to your own envy?",
        [
          "Deny it and call it objective standards.",
          "Use it to identify what you want and build toward that honestly.",
          "Punish yourself for feeling it.",
          "Distance yourself from everyone doing well."
        ],
        1,
        "Greene wants envy transformed into clearer self knowledge and direction."
      ),
      question(
        "ch10-q04",
        "What is the chapter's clearest advice for handling your own visible advantages?",
        [
          "Hide all success completely.",
          "Display ease and superiority so people accept the hierarchy.",
          "Use restraint and do not inflame comparison unnecessarily.",
          "Apologize for every win."
        ],
        2,
        "The law favors understatement and awareness over flaunting or false guilt."
      ),
    ],
  }),
  chapter({
    chapterId: "ch11-know-your-limits",
    number: 11,
    title: "Know Your Limits",
    readingTimeMinutes: 13,
    summary: {
      p1: t(
        "Grandiosity makes people lose contact with reality by inflating their power, insight, importance, or immunity to error. Greene argues that success often feeds this delusion because praise and momentum make self belief expand faster than judgment.",
        "The law is not against ambition. It is against the swelling fantasy that makes a person stop reading limits, feedback, and actual capability accurately.",
        "Greene treats grandiosity as dangerous because it turns strength into blindness. The person begins believing their story more than the field they are operating in."
      ),
      p2: t(
        "This matters because many collapses begin not in weakness but in overreach. People who stop respecting limits take bolder and poorer risks, silence correction, and assume the future must keep rewarding them.",
        "The deeper lesson is that reality connection is a discipline. You need structures, feedback, and humility strong enough to survive success, not only failure.",
        "In practice, the law asks for grounded ambition. Build big, but keep enough friction with reality that growth does not turn into self deception."
      ),
    },
    standardBullets: [
      bullet(
        "Grandiosity expands faster than reality. Success can make a person believe their story more than the actual conditions around them.",
        "That gap is where overreach begins."
      ),
      bullet(
        "Ambition is not the problem. Greene distinguishes real aspiration from inflated self myth.",
        "The danger is not wanting much. It is believing too much about yourself."
      ),
      bullet(
        "Praise is an inflaming factor. Constant admiration can reduce self correction and increase fantasy.",
        "Success needs stronger grounding, not less."
      ),
      bullet(
        "Limits protect intelligence. Knowing where your range ends keeps strategy closer to reality.",
        "A clear boundary is often a source of strength."
      ),
      bullet(
        "Feedback becomes harder to hear under grandiosity. The ego starts filtering out anything that dents the heroic story.",
        "This is how warning signs get missed."
      ),
      bullet(
        "Overconfidence invites larger errors. Once self belief loses proportion, risk taking stops being strategic and becomes theatrical.",
        "The person acts as if consequences now apply less to them."
      ),
      bullet(
        "Return to the work. Greene repeatedly favors concrete practice and measurable reality over inflated self image.",
        "Reality contact grows through doing, not through admiring yourself."
      ),
      bullet(
        "Keep advisers who are not captured by your mood. Independent correction helps defend against the success delusion.",
        "A leader without honest feedback is already in danger."
      ),
      bullet(
        "Use confidence in measured form. Practical grandiosity can energize you, but it must stay tied to preparation and fact.",
        "Belief should support performance, not replace it."
      ),
      bullet(
        "The closing lesson is to stay proportionate. Greene wants boldness disciplined by reality rather than fantasy dressed as vision.",
        "That proportion is what keeps ambition durable."
      ),
    ],
    deeperBullets: [
      bullet(
        "Grandiosity often begins as compensation. Early insecurity can later flip into exaggerated self importance once the person tastes success.",
        "The old wound remains underneath the bigger image."
      ),
      bullet(
        "The most dangerous moment is often after a streak of wins. Repeated success can persuade you that your intuition has become infallible.",
        "That is when error checking matters most."
      ),
      bullet(
        "Reality based confidence is specific. It knows what has been tested, what remains uncertain, and where help is still needed.",
        "Grandiosity prefers fog because fog helps self myth expand."
      ),
      bullet(
        "Some people confuse scale with depth. Bigger goals, louder language, and grander identity can hide shallow preparation.",
        "Greene keeps returning the reader to substance."
      ),
      bullet(
        "The strategic gain of this law is longevity. People who respect limits can keep growing because they do not keep forcing reality to punish them back to size.",
        "Humility here is a practical survival tool."
      ),
    ],
    takeaways: [
      "Grandiosity breaks contact with reality",
      "Ambition needs proportion",
      "Praise can inflate self myth",
      "Feedback protects against overreach",
      "Return to the work not the image",
      "Limits support durability",
    ],
    practice: [
      "List one area where success may be making you less teachable",
      "Ask one person for correction you do not control",
      "Name a limit that protects quality rather than shrinking you",
      "Replace one fantasy statement with one tested fact",
    ],
    examples: [
      example(
        "ch11-ex01",
        "Student leader who stops preparing",
        ["school"],
        "After a few visible wins, a student leader starts assuming they can improvise every important presentation and no longer checks details the way they used to.",
        [
          "Treat the new casualness as a grandiosity warning and return to the preparation habits that originally made the leader effective.",
          "Visible confidence should not replace the quiet work that keeps results real."
        ],
        "Success often creates the illusion that the rules no longer apply. Greene wants the reader to catch that drift early."
      ),
      example(
        "ch11-ex02",
        "Top student ignores warning signs",
        ["school"],
        "A student who usually does well takes on too many hard commitments at once because they now assume they can handle any load through natural ability alone.",
        [
          "Reassess from actual capacity instead of from self image and cut back before the overreach becomes public failure.",
          "Respecting limits here protects performance rather than shrinking ambition."
        ],
        "Grandiosity often enters through the belief that prior success guarantees future immunity from overload."
      ),
      example(
        "ch11-ex03",
        "Founder believes the hype",
        ["work"],
        "A founder receives glowing press and starts making major decisions from instinct alone, dismissing the product data and the team members who still track the numbers carefully.",
        [
          "Rebuild decision making around evidence and independent correction before the inflated self story starts steering the company.",
          "Separate public praise from operational reality."
        ],
        "The law matters because admiration can make self belief expand faster than the underlying business deserves."
      ),
      example(
        "ch11-ex04",
        "High performer expands beyond competence",
        ["work"],
        "A strong operator begins taking control of areas they do not understand because their success in one domain has convinced them that judgment automatically transfers everywhere.",
        [
          "Test the new domain with smaller scope, outside expertise, and clear measures instead of assuming competence scales by confidence alone.",
          "Honor the difference between momentum and mastery."
        ],
        "Overreach often comes from importing justified confidence from one field into another where it has not been earned."
      ),
      example(
        "ch11-ex05",
        "You start believing your own image",
        ["personal"],
        "After repeated praise in a social circle, you begin expecting special treatment and feel unusually irritated when ordinary limits or criticism return.",
        [
          "Notice the inflation early and reconnect with the tasks, relationships, and routines that do not care about your image.",
          "Use reality contact to cool the swelling story."
        ],
        "Grandiosity is dangerous because it can grow quietly inside normal success and attention."
      ),
      example(
        "ch11-ex06",
        "Relationship harmed by never being wrong",
        ["personal"],
        "You become attached to being the wise one in a relationship and start treating any correction from your partner as proof they are not seeing the big picture.",
        [
          "Drop the identity of being beyond correction and reenter the conversation as someone who can still be mistaken.",
          "Closeness often depends more on reality contact than on preserving superiority."
        ],
        "Grandiosity damages intimacy because it makes humility feel like status loss instead of contact with truth."
      ),
    ],
    directQuestions: [
      question(
        "ch11-q01",
        "What is the core difference between ambition and grandiosity in this law?",
        [
          "Ambition wants growth, while grandiosity inflates self belief beyond reality.",
          "Ambition is moral and grandiosity is immoral.",
          "Ambition is quiet and grandiosity is loud.",
          "Ambition belongs only to leaders."
        ],
        0,
        "Greene opposes self delusion, not large aspiration."
      ),
      question(
        "ch11-q02",
        "Why is success a dangerous phase for grandiosity?",
        [
          "Because success proves most people were wrong about you.",
          "Because praise and momentum can weaken self correction right when confidence is rising fastest.",
          "Because failure is easier to manage than success.",
          "Because success makes feedback unnecessary."
        ],
        1,
        "The success delusion comes from letting admiration replace reality contact."
      ),
      question(
        "ch11-q03",
        "Which habit best protects against overreach?",
        [
          "Trusting intuition more each time you win.",
          "Avoiding all ambitious goals.",
          "Keeping strong feedback loops and respect for tested limits.",
          "Reducing your circle to admirers only."
        ],
        2,
        "Reality based feedback is one of Greene's main antidotes to grandiosity."
      ),
      question(
        "ch11-q04",
        "What does practical grandiosity mean here?",
        [
          "Using belief as energy while keeping it tied to preparation and fact.",
          "Letting confidence replace evidence.",
          "Projecting absolute certainty so others submit.",
          "Pretending you have no limits."
        ],
        0,
        "Greene allows for energizing self belief, but only when it stays anchored to reality."
      ),
    ],
  }),
  chapter({
    chapterId: "ch12-reconnect-to-the-masculine-or-feminine-within-you",
    number: 12,
    title: "Reconnect to the Masculine or Feminine Within You",
    readingTimeMinutes: 12,
    summary: {
      p1: t(
        "Gender rigidity narrows human range, and Greene argues that people become less capable when they overidentify with a fixed performance of what a man or woman is supposed to be. In his language, each person loses access to traits culturally coded as the opposite sex and becomes harder, flatter, and less adaptive.",
        "The chapter uses older binary language, but its practical lesson is broader: social roles can cut people off from emotional range, patience, intuition, assertiveness, or receptivity that they actually need.",
        "Greene wants the reader to become more complete by recovering the traits they were taught to suppress for the sake of role conformity."
      ),
      p2: t(
        "This matters because rigid identity performances can damage judgment, relationships, leadership, and self knowledge. When a person clings to one narrow style, they lose flexibility and misread the kinds of strength a situation actually requires.",
        "The deeper lesson is to reclaim a fuller internal range without turning that range into another performance. Real integration makes a person calmer, more creative, and less dependent on stereotype for direction.",
        "In practice, the law asks you to notice what qualities you dismiss as not for someone like you, and then recover them as human capacities rather than forbidden territory."
      ),
    },
    standardBullets: [
      bullet(
        "Rigid roles reduce range. Greene argues that forced gender performance can make a person less responsive to reality.",
        "What looks like identity strength may actually be adaptation weakness."
      ),
      bullet(
        "Suppressed traits do not disappear. Qualities a person rejects as unfit for their role often remain underused rather than absent.",
        "The loss is practical as well as emotional."
      ),
      bullet(
        "A fuller range improves judgment. Assertiveness, empathy, patience, boldness, receptivity, and intuition all have situational value.",
        "No one style serves every moment well."
      ),
      bullet(
        "Stereotype can become a prison. People often mistake social approval for authenticity.",
        "The chapter invites a harder look at what was trained rather than chosen."
      ),
      bullet(
        "Relationships benefit from range. Rigid role performance can produce misunderstanding, contempt, and repetitive conflict.",
        "More flexibility usually means more accurate contact."
      ),
      bullet(
        "Leadership needs both strength and receptivity. A person who only commands or only accommodates becomes easier to predict and easier to outmaneuver.",
        "Balance improves influence."
      ),
      bullet(
        "Do not romanticize the role you reject. Greene is not telling the reader to flip from one costume to another.",
        "The aim is integration, not inversion."
      ),
      bullet(
        "Study what traits you mock. Dismissal often points to a quality you have been taught to disown.",
        "Judgment can reveal the border of your own rigidity."
      ),
      bullet(
        "Build from actual usefulness. Recover the traits that make you more whole and more capable in real situations.",
        "Practical range matters more than symbolic identity work."
      ),
      bullet(
        "The closing lesson is expansion. Greene wants a person less ruled by stereotype and more able to bring the right quality to the right moment.",
        "That is the form of freedom inside this law."
      ),
    ],
    deeperBullets: [
      bullet(
        "The chapter reflects Greene's binary frame, and that frame is narrower than many readers will find adequate today. The durable lesson lies in recovering a fuller human range from social rigidity.",
        "That keeps fidelity without pretending the language has no limit."
      ),
      bullet(
        "People often defend rigid roles because they provide status, certainty, and belonging. Letting the performance loosen can feel like loss before it feels like freedom.",
        "That makes this law emotionally harder than it first appears."
      ),
      bullet(
        "Suppressed traits often return in distorted form. A denied need for softness may become collapse, while denied assertiveness may emerge as resentment or passive control.",
        "Integration is cleaner than leakage."
      ),
      bullet(
        "The strongest people are often the least role bound. They can combine firmness with sensitivity and confidence with receptivity as the situation demands.",
        "Range increases adaptability."
      ),
      bullet(
        "The strategic gain is social depth. Once you stop needing to prove a rigid identity, you can pay more attention to reality and less attention to maintaining a costume.",
        "That improves presence, judgment, and relationship quality."
      ),
    ],
    takeaways: [
      "Rigid roles shrink human range",
      "Suppressed traits still matter",
      "Range improves judgment and closeness",
      "Balance beats role performance",
      "Mocked traits may reveal blind spots",
      "Integration is expansion not costume change",
    ],
    practice: [
      "Name one useful trait you were taught not to value in yourself",
      "Notice where role performance feels stronger than authenticity",
      "Use one neglected quality in a real conversation this week",
      "Watch for contempt that may hide disowned need",
    ],
    examples: [
      example(
        "ch12-ex01",
        "Student leader afraid to show warmth",
        ["school"],
        "A student leader thinks authority means staying emotionally distant, so meetings become efficient but cold and people stop bringing problems early.",
        [
          "Bring more warmth and receptivity into the role without giving up standards, so people experience leadership as both clear and approachable.",
          "Treat responsiveness as strength instead of as softness that weakens authority."
        ],
        "Rigid role performance can damage leadership because it confuses one style with the whole of strength."
      ),
      example(
        "ch12-ex02",
        "Classmate who hides ambition",
        ["school"],
        "A classmate has strong ideas but keeps minimizing them because they fear being seen as too assertive or too visible for the role they think they should play.",
        [
          "Encourage them to use more direct voice and claim authorship of their thinking without turning that shift into a theatrical new persona.",
          "Capability often needs traits a person was taught to suppress."
        ],
        "The law applies because social scripts can make someone smaller than their actual range requires."
      ),
      example(
        "ch12-ex03",
        "Manager who equates care with weakness",
        ["work"],
        "A manager prides themselves on being tough and decisive, but the team keeps misreading priorities because the manager refuses to listen closely or acknowledge emotional reality.",
        [
          "Recover receptivity as a practical leadership skill and use it to hear what the room knows before locking the next decision.",
          "Firmness becomes stronger when it is informed by more than one internal mode."
        ],
        "The chapter teaches that leadership weakens when one narrow performance is treated as the only legitimate way to be strong."
      ),
      example(
        "ch12-ex04",
        "People pleasing professional avoids hard calls",
        ["work"],
        "A thoughtful employee is excellent at harmony and support but keeps delaying necessary conflict because directness feels too harsh or unlike the kind of person they think they should be.",
        [
          "Practice clearer assertion as a human skill rather than as a betrayal of identity and pair it with the empathy they already have.",
          "The goal is a fuller range, not a new costume."
        ],
        "Suppressed firmness often returns later as resentment. Integration lets a person act earlier and more cleanly."
      ),
      example(
        "ch12-ex05",
        "Dating script feels performative",
        ["personal"],
        "In dating, you keep performing a version of yourself that feels socially recognizable, but the performance leaves little room for tenderness, direct desire, or honest uncertainty.",
        [
          "Notice which parts of yourself are being edited out for the sake of role and gradually bring them back in truthful ways.",
          "Closeness improves when identity is less scripted."
        ],
        "Rigid roles can look smooth while quietly blocking real contact."
      ),
      example(
        "ch12-ex06",
        "Family mocks one trait in you",
        ["personal"],
        "Your family repeatedly mocks a trait in you as not fitting the kind of person you are supposed to be, and over time you have started distrusting that part of yourself too.",
        [
          "Reclaim the trait by testing where it is genuinely useful and humane in your current life instead of letting old role language define it.",
          "Use lived evidence to weaken the inherited script."
        ],
        "The law matters because disowned capacities often stay buried under family and cultural performance long after they are needed."
      ),
    ],
    directQuestions: [
      question(
        "ch12-q01",
        "What is the central cost of gender rigidity in this law?",
        [
          "It makes social life simpler.",
          "It cuts people off from useful traits and narrows their adaptive range.",
          "It removes all difference between people.",
          "It matters only in intimate relationships."
        ],
        1,
        "Greene's practical point is that rigid role performance makes a person less complete and less responsive."
      ),
      question(
        "ch12-q02",
        "Which response best reflects the strongest modern use of this chapter?",
        [
          "Replace one rigid role with the opposite rigid role.",
          "Treat culturally coded traits as human capacities you can recover where useful.",
          "Ignore the topic because the language feels dated.",
          "Choose one style and perform it more confidently."
        ],
        1,
        "The usable lesson is expansion of range rather than obedience to stereotype."
      ),
      question(
        "ch12-q03",
        "Why do suppressed traits matter even when they are hidden well?",
        [
          "Because they disappear completely.",
          "Because unused capacities reduce flexibility and may return in distorted ways.",
          "Because everyone should express every trait equally.",
          "Because role performance is always dishonest."
        ],
        1,
        "The chapter treats denied qualities as lost range that later leaks or weakens judgment."
      ),
      question(
        "ch12-q04",
        "What is the chapter's clearest warning about identity performance?",
        [
          "It can be mistaken for authenticity even when it is just social approval hardened into habit.",
          "It never helps anyone belong.",
          "It only harms leaders.",
          "It disappears automatically with age."
        ],
        0,
        "Greene wants the reader to ask which traits were truly chosen and which were merely rewarded."
      ),
    ],
  }),
  chapter({
    chapterId: "ch13-advance-with-a-sense-of-purpose",
    number: 13,
    title: "Advance with a Sense of Purpose",
    readingTimeMinutes: 13,
    summary: {
      p1: t(
        "Aimlessness scatters energy, and Greene argues that people become easier to distract, flatter, and derail when they do not have a clear inner direction. Purpose gathers attention into a stronger line, making decisions cleaner because they answer to something larger than mood.",
        "The chapter treats purpose less as a slogan about passion and more as a disciplined relationship to what matters enough to organize your life around.",
        "For Greene, purpose is protective. It helps the reader resist drift, social contagion, false ambitions, and the hunger for constant external validation."
      ),
      p2: t(
        "This matters because a person without direction becomes highly available to other people's agendas. Their energy gets spent in reaction, performance, and scattered opportunity rather than in coherent building.",
        "The deeper lesson is that purpose grows through sustained contact with your strengths, curiosity, and contribution, not through fantasy identity alone. It becomes reliable once it is practiced.",
        "In daily life, the law asks you to choose a line and keep returning to it. That repetition is what turns vague desire into real direction."
      ),
    },
    standardBullets: [
      bullet(
        "Purpose concentrates energy. Greene argues that inner direction reduces waste because choices can be judged against a stronger line.",
        "Scattered energy usually reflects scattered aim."
      ),
      bullet(
        "Aimlessness invites drift. Without a clear line, people become easier to pull into status games, distraction, and borrowed goals.",
        "Lack of direction makes outside noise more powerful."
      ),
      bullet(
        "Purpose is practiced, not merely declared. A strong sense of direction grows through repeated work and recurring choice.",
        "Identity becomes sturdier when action keeps confirming it."
      ),
      bullet(
        "Look for the work that keeps drawing you back. Greene favors long attraction over temporary excitement.",
        "Repeated pull is often more revealing than sudden intensity."
      ),
      bullet(
        "False purposes are seductive. Fame, image, or borrowed prestige can feel like direction while quietly leaving you empty and unstable.",
        "The test is whether the aim can sustain effort and meaning over time."
      ),
      bullet(
        "Purpose improves resilience. Hard periods become easier to endure when effort answers to a larger reason.",
        "Meaning changes the emotional weight of struggle."
      ),
      bullet(
        "Cut what weakens the line. Not every opportunity deserves entry once your direction becomes clearer.",
        "Purpose depends on exclusion as much as inclusion."
      ),
      bullet(
        "Use service as a test. Strong purpose often creates value beyond your own image.",
        "Contribution helps separate durable direction from vanity performance."
      ),
      bullet(
        "Return to your voice. Greene wants the reader to hear the quieter inner line beneath comparison, pressure, and imitation.",
        "That voice becomes clearer through solitude and work."
      ),
      bullet(
        "The final lesson is coherence. Purpose lets a person move through the world with less fragmentation and less borrowed motion.",
        "It is the difference between being carried and choosing a path."
      ),
    ],
    deeperBullets: [
      bullet(
        "Purpose often emerges from wound as well as talent. Some of the strongest directions come from what you have suffered, studied, or deeply needed.",
        "Difficulty can shape vocation when it is processed well."
      ),
      bullet(
        "Many people fear purpose because it closes doors. Drift can feel safer because it postpones the pain of exclusion and commitment.",
        "Greene asks the reader to accept that real direction costs optionality."
      ),
      bullet(
        "Purpose is stronger when embodied in routine. Without structure, even meaningful aims stay aspirational.",
        "Daily rhythm gives direction material force."
      ),
      bullet(
        "False purpose often feeds the ego quickly and empties the self slowly. It gives image, but not durable inner authority.",
        "That is why borrowed ambition feels impressive and strangely hollow."
      ),
      bullet(
        "The strategic gain of this law is reduced manipulability. A person with real direction is harder to flatter off course and harder to panic out of motion.",
        "Purpose becomes inner ballast."
      ),
    ],
    takeaways: [
      "Purpose gathers scattered energy",
      "Drift makes you easier to steer",
      "Direction must be practiced",
      "False purpose looks bright and feels hollow",
      "Exclusion protects coherence",
      "Purpose reduces manipulability",
    ],
    practice: [
      "Write the line of work or contribution that keeps returning",
      "Cut one commitment that weakens your main direction",
      "Translate one purpose idea into a weekly routine",
      "Ask whether one current goal feeds image more than meaning",
    ],
    examples: [
      example(
        "ch13-ex01",
        "Choosing too many campus paths",
        ["school"],
        "You keep joining interesting opportunities, but the result is a schedule full of motion with no clear direction and a growing sense that none of the work is deepening into anything.",
        [
          "Choose the one or two commitments that most clearly match your longer line and start cutting the rest even if each one looks good in isolation.",
          "Let coherence matter more than surface variety."
        ],
        "Aimlessness often disguises itself as openness. Greene wants the reader to notice when endless yes is really scattered drift."
      ),
      example(
        "ch13-ex02",
        "Class choice driven by image",
        ["school"],
        "You are about to choose a course load mainly because it looks impressive to others, even though the subjects that actually hold your attention point in a different direction.",
        [
          "Check whether the choice serves your developing purpose or mostly your image, and give more weight to the path that creates durable skill and meaning.",
          "Use outside prestige as a weak signal, not the deciding one."
        ],
        "False purpose thrives on comparison. The law asks for a quieter and more stable test of direction."
      ),
      example(
        "ch13-ex03",
        "Promising project but no core line",
        ["work"],
        "At work you are competent across many tasks, but because you have never named a stronger direction you keep becoming the person who handles whatever lands nearby.",
        [
          "Define the line you want your work to build toward and start making choices that align responsibility, skill growth, and visibility with that path.",
          "Do not confuse usefulness in general with direction in particular."
        ],
        "A person without purpose gets used by circumstance. Greene wants energy organized rather than merely spent."
      ),
      example(
        "ch13-ex04",
        "Startup chasing every shiny opportunity",
        ["work"],
        "A small company keeps pivoting toward whatever trend is getting attention, and each move sounds promising until the team realizes it no longer knows what it is actually trying to build.",
        [
          "Return to the core purpose that justifies the work and judge new opportunities by whether they deepen that line or dissolve it.",
          "Use focus as a strategic filter, not as a refusal to adapt."
        ],
        "Purpose reduces chaos because it gives each new possibility a real test."
      ),
      example(
        "ch13-ex05",
        "Personal project that keeps getting postponed",
        ["personal"],
        "A creative or meaningful project matters to you, but it keeps losing to easier activities because it has not yet been given a protected place in your life.",
        [
          "Stop waiting for pure motivation and build a recurring structure that lets the purpose survive ordinary distraction.",
          "Treat the project as part of your direction, not as a hobby you honor only when time feels abundant."
        ],
        "Purpose becomes believable to yourself when it starts shaping the calendar."
      ),
      example(
        "ch13-ex06",
        "Relationship choice that conflicts with direction",
        ["personal"],
        "Someone wants more of your time and future than you can honestly give without abandoning a line of work or growth that matters deeply to you.",
        [
          "Be clear about the direction you are actually committed to instead of promising closeness you cannot sustain without resentment.",
          "Purpose is not an excuse for selfishness, but it does require honest boundaries."
        ],
        "A strong line helps you make difficult relational choices with less drift and less false promise."
      ),
    ],
    directQuestions: [
      question(
        "ch13-q01",
        "What is the clearest effect of real purpose in this law?",
        [
          "It eliminates uncertainty entirely.",
          "It concentrates energy and makes choices more coherent.",
          "It removes the need for sacrifice.",
          "It guarantees visible status."
        ],
        1,
        "Greene treats purpose as a way of gathering attention, effort, and judgment into a stronger line."
      ),
      question(
        "ch13-q02",
        "How can you tell a false purpose from a stronger one?",
        [
          "False purpose usually provides fast image but weak long term meaning.",
          "False purpose always looks boring.",
          "Stronger purpose never includes ambition.",
          "Stronger purpose attracts instant praise."
        ],
        0,
        "A false purpose often feeds the ego quickly while failing to sustain deep commitment."
      ),
      question(
        "ch13-q03",
        "What is the most practical way to strengthen purpose?",
        [
          "Talk about it more often.",
          "Wait for perfect certainty before acting.",
          "Translate it into recurring choices and routines.",
          "Keep every option open."
        ],
        2,
        "Purpose becomes real through repetition and structure, not through abstract self description."
      ),
      question(
        "ch13-q04",
        "Why does purpose reduce manipulability?",
        [
          "Because people with purpose never need others.",
          "Because a stronger inner line makes flattery and distraction less controlling.",
          "Because purpose eliminates emotion.",
          "Because direction is always obvious to everyone."
        ],
        1,
        "Inner direction gives outside pressure less room to steer you."
      ),
    ],
  }),
  chapter({
    chapterId: "ch14-resist-the-downward-pull-of-the-group",
    number: 14,
    title: "Resist the Downward Pull of the Group",
    readingTimeMinutes: 13,
    summary: {
      p1: t(
        "Conformity is powerful because groups quickly shape what feels normal, sayable, admirable, and safe. Greene argues that once people enter a strong collective mood they can surrender judgment, exaggerate certainty, and perform loyalty in ways they would never choose alone.",
        "The chapter studies how courts, teams, movements, and social circles generate emotional contagion and subtle pressure toward sameness.",
        "For Greene, the danger is not only open mob behavior. It is the quieter way a group can bend attention, language, and courage until reality itself feels harder to name."
      ),
      p2: t(
        "This matters because much social error begins with wanting harmony, status, or belonging more than accuracy. The person starts reading the room instead of reading the situation.",
        "The deeper lesson is not total independence theater. Greene wants a reality based relation to groups in which you can belong without dissolving your judgment into them.",
        "In practice, the law asks you to track mood, incentives, and court politics while building ties to people who still care about truth more than performance."
      ),
    },
    standardBullets: [
      bullet(
        "Groups shape perception fast. What a room rewards or punishes quickly becomes part of what members feel able to say and see.",
        "Belonging pressure changes judgment before people realize it."
      ),
      bullet(
        "Mood is contagious. Anxiety, excitement, outrage, and certainty can spread through a group like weather.",
        "Emotional climate matters as much as formal policy."
      ),
      bullet(
        "Courts create performers. Greene warns that status focused environments train people to read favor more than reality.",
        "Once approval becomes the main currency, candor gets expensive."
      ),
      bullet(
        "Harmony can become cowardice. People often call it being supportive when they are really avoiding the risk of truthful dissent.",
        "Comfort inside the group can cost accuracy."
      ),
      bullet(
        "Keep a reality group. You need at least a few people whose loyalty to the truth stays stronger than their loyalty to mood.",
        "Such ties protect independence under pressure."
      ),
      bullet(
        "Notice how language shifts. Euphemism, slogans, and repeated phrases can signal when a group is enforcing feeling more than thought.",
        "Language is one of the first places conformity becomes visible."
      ),
      bullet(
        "Do not let collective emotion decide timing. A charged group often pushes premature certainty and action.",
        "Distance helps you recover judgment."
      ),
      bullet(
        "Belong without dissolving. Greene is not asking for permanent outsider identity. He is asking for internal separation where it matters.",
        "You can participate without surrendering your mind."
      ),
      bullet(
        "Read the incentives around agreement. Sometimes people conform because truth is costly, not because the consensus is strong.",
        "That distinction matters for judgment."
      ),
      bullet(
        "The final lesson is vigilance. The pull of the group is strong precisely because it often feels warm, righteous, and obvious while it is distorting your sight.",
        "Independent thought must be actively defended."
      ),
    ],
    deeperBullets: [
      bullet(
        "Conformity often works through fear of exclusion more than love of the belief itself. People adopt the mood to stay safe inside the group body.",
        "This makes social pressure deeper than mere argument."
      ),
      bullet(
        "A group can become a substitute self. The more unsure a person feels inwardly, the more total collective certainty can attract them.",
        "Belonging then becomes identity support."
      ),
      bullet(
        "Dissent is easiest before the mood hardens. Once a room has publicly committed to one emotional line, correction becomes much costlier.",
        "Timing therefore matters for independent judgment too."
      ),
      bullet(
        "Some people gain status by amplifying conformity. They become interpreters of the official mood and punish deviation to strengthen their own place.",
        "Court politics feeds on this dynamic."
      ),
      bullet(
        "The strategic gain of this law is cleaner reality contact. If you can feel the group pull without obeying it automatically, you gain a rare advantage in judgment and leadership.",
        "Distance inside belonging is a powerful skill."
      ),
    ],
    takeaways: [
      "Groups reshape what feels normal",
      "Mood spreads fast",
      "Court politics rewards performance",
      "Truth needs a reality group",
      "Belonging can hide fear",
      "Independence requires active defense",
    ],
    practice: [
      "Notice one room where approval matters too much",
      "Track one repeated phrase that signals group pressure",
      "Build one tie with someone who values candor over mood",
      "Pause before joining a collective emotional rush",
    ],
    examples: [
      example(
        "ch14-ex01",
        "Seminar mood turns moralistic",
        ["school"],
        "A seminar discussion quickly settles into one approved emotional tone, and students begin speaking more to display alignment than to explore the idea honestly.",
        [
          "Notice the shift from inquiry to performance and reintroduce one concrete question that brings the room back to the actual issue.",
          "If the room cannot hold it, keep your inner distance instead of fusing with the mood."
        ],
        "Conformity often first appears as the shrinking of what can be asked without social cost."
      ),
      example(
        "ch14-ex02",
        "Club starts revolving around a favored inner circle",
        ["school"],
        "A campus group develops a small court around its most visible leaders, and members begin echoing the preferred tone rather than bringing useful disagreement.",
        [
          "Read the environment as a court dynamic and create smaller channels where candid planning can survive outside the performance center.",
          "Do not confuse visible unity with healthy reality contact."
        ],
        "Greene's court language matters because status hunger often drives conformity more than shared conviction does."
      ),
      example(
        "ch14-ex03",
        "Team rushes into group certainty",
        ["work"],
        "A team becomes excited about one strategy and quickly starts treating hesitation as negativity even though major assumptions remain untested.",
        [
          "Slow the emotional momentum by naming the assumptions that still need proof and separating loyalty to the team from loyalty to the current mood.",
          "Create a structured space for dissent before the consensus hardens further."
        ],
        "Collective enthusiasm can distort judgment just as powerfully as collective fear."
      ),
      example(
        "ch14-ex04",
        "Office culture punishes bad news",
        ["work"],
        "In your office everyone talks about openness, but people who surface unwelcome facts quietly lose favor while optimistic framing gets rewarded.",
        [
          "Read the incentive system clearly and find the people or channels where truth still has protection before raising critical issues.",
          "Do not mistake the official language for the real group norm."
        ],
        "Conformity is often maintained by hidden costs around honesty rather than by explicit rules."
      ),
      example(
        "ch14-ex05",
        "Friend group shares one target",
        ["personal"],
        "A friend group starts bonding through collective criticism of one absent person, and it becomes easier to join in than to challenge the growing certainty.",
        [
          "Notice the emotional reward of belonging that the group is offering and refuse to strengthen a judgment you have not examined yourself.",
          "If needed, step back from the conversation rather than feed the group body."
        ],
        "The downward pull often feels warm because it offers closeness in exchange for independent thought."
      ),
      example(
        "ch14-ex06",
        "Family mood decides what can be said",
        ["personal"],
        "In your family, one emotional script dominates every gathering, and people quickly learn which truths will be treated as betrayal.",
        [
          "Keep inner clarity about the actual pattern and choose carefully where honest conversation is possible instead of automatically obeying the script.",
          "Reality may need to be preserved inwardly before it can be spoken outwardly."
        ],
        "Not every group can hold truth at all times. Greene's law includes knowing how strong the collective pull really is."
      ),
    ],
    directQuestions: [
      question(
        "ch14-q01",
        "What makes conformity dangerous in Greene's account?",
        [
          "It always produces explicit violence.",
          "It can quietly replace reality based judgment with mood, performance, and fear of exclusion.",
          "It means people care too much about belonging.",
          "It affects only political movements."
        ],
        1,
        "The danger lies in subtle distortion of perception and courage, not only in dramatic mob behavior."
      ),
      question(
        "ch14-q02",
        "What is a reality group?",
        [
          "A circle that always agrees quickly.",
          "A set of people who share the same background.",
          "A few people whose commitment to truth can survive collective pressure.",
          "Any group that meets privately."
        ],
        2,
        "Greene wants the reader to maintain relationships where candor can outlast mood."
      ),
      question(
        "ch14-q03",
        "How does court politics usually affect a group?",
        [
          "It rewards substance over image.",
          "It trains people to read favor and status instead of reality.",
          "It removes the need for leadership.",
          "It always begins with formal hierarchy."
        ],
        1,
        "Court dynamics push people toward performance and alignment with the center of approval."
      ),
      question(
        "ch14-q04",
        "What is the strongest way to resist the downward pull of the group?",
        [
          "Reject all belonging and stand outside every group.",
          "Stay inside the group while preserving inner distance, better questions, and ties to truthful people.",
          "Wait until the mood becomes extreme before thinking independently.",
          "Fight every consensus publicly."
        ],
        1,
        "Greene calls for disciplined inner separation, not theatrical outsider identity."
      ),
    ],
  }),
  chapter({
    chapterId: "ch15-make-them-want-to-follow-you",
    number: 15,
    title: "Make Them Want to Follow You",
    readingTimeMinutes: 13,
    summary: {
      p1: t(
        "Fickleness makes people restless, skeptical, and hard to lead for long, and Greene argues that authority must therefore be earned emotionally as well as structurally. People want guidance, but they also resist feeling used, ignored, or trapped under someone weak, vain, or chaotic.",
        "The chapter teaches leadership through steadiness, fairness, competence, and a larger sense of purpose that invites willing followership instead of mere compliance.",
        "Greene is especially alert to entitlement and resentment. Followers often expect more than they give, so authority has to be built with both standards and psychological intelligence."
      ),
      p2: t(
        "This matters because groups do not follow for long on title alone. If people sense confusion, self indulgence, or emotional volatility at the center, loyalty thins quickly.",
        "The deeper lesson is that authority begins inside. A leader who cannot govern mood, timing, and standards in themselves will struggle to stabilize them in others.",
        "In real life, the law asks you to create trust through consistency and direction. People follow more willingly when they feel the leader is carrying burden, not merely extracting obedience."
      ),
    },
    standardBullets: [
      bullet(
        "People are emotionally fickle. Greene argues that support can rise and fall quickly when a leader does not create steadiness.",
        "Authority must therefore be renewed through behavior, not assumed as permanent."
      ),
      bullet(
        "Title is not enough. Formal position can secure compliance for a while, but it rarely secures willing followership on its own.",
        "People judge the person holding power as much as the power itself."
      ),
      bullet(
        "Carry yourself with calm authority. Followers read the emotional center of a leader closely.",
        "Panic, vanity, and indecision spread outward fast."
      ),
      bullet(
        "Make standards visible. Fairness and consistency reduce the resentment that grows in ambiguous leadership climates.",
        "Clear expectations are a stabilizing force."
      ),
      bullet(
        "Show competence through action. Authority deepens when people see that your decisions improve reality rather than merely decorate your image.",
        "Results earn followership more reliably than rhetoric."
      ),
      bullet(
        "Take on burden. Greene stresses that leaders must absorb pressure and responsibility rather than only distribute demand.",
        "People follow more easily when sacrifice is visible at the top."
      ),
      bullet(
        "Recognize entitlement without surrendering to it. Groups often want more ease, praise, and reward than the situation permits.",
        "A leader must balance empathy with standards."
      ),
      bullet(
        "Give meaning, not only instruction. People become steadier when they understand what the effort serves.",
        "Purpose strengthens obedience into commitment."
      ),
      bullet(
        "Avoid emotional favoritism. Uneven treatment poisons authority faster than many technical mistakes do.",
        "Perceived fairness is central to legitimacy."
      ),
      bullet(
        "The closing lesson is inner authority. Greene wants leadership that begins in self control and radiates outward as trust, clarity, and direction.",
        "Without inner authority, outer authority stays brittle."
      ),
    ],
    deeperBullets: [
      bullet(
        "Fickleness grows under unclear leadership because uncertainty invites rumor, grievance, and status competition among followers.",
        "A weak center creates noisy edges."
      ),
      bullet(
        "Authority is partly theatrical, but the theater must be backed by substance. Visible calm without competence becomes hollow quickly.",
        "Image can open the door, but it cannot carry the weight alone."
      ),
      bullet(
        "People often test authority indirectly. Delay, complaint, cynicism, and selective obedience can all be probes of the leader's steadiness.",
        "How you answer those probes teaches the group what authority means under you."
      ),
      bullet(
        "A leader's self pity is especially corrosive. Once followers feel the center is emotionally needy, respect tends to thin into management of the leader's feelings.",
        "Burden should travel up more than down."
      ),
      bullet(
        "The strategic gain of this law is durable legitimacy. When people want to follow, enforcement costs drop and group energy can go toward the mission instead of toward internal friction.",
        "Strong authority reduces wasted emotional motion."
      ),
    ],
    takeaways: [
      "Followers are emotionally changeable",
      "Title alone is thin authority",
      "Calm and fairness stabilize groups",
      "Visible burden earns trust",
      "Meaning strengthens obedience",
      "Inner authority is the core",
    ],
    practice: [
      "Name one standard your group experiences as unclear",
      "Carry one difficult burden instead of pushing it downward",
      "Check whether your behavior teaches calm or confusion",
      "Explain one decision through purpose not only instruction",
    ],
    examples: [
      example(
        "ch15-ex01",
        "Team captain loses credibility",
        ["school"],
        "A team captain keeps asking for discipline while showing up late and changing expectations from week to week, so teammates start following only when watched.",
        [
          "Rebuild authority through visible consistency, shared standards, and personal example before demanding more buy in from others.",
          "People follow more readily when the leader carries the standard first."
        ],
        "Fickleness grows when leadership feels uneven. Authority needs behavior that reduces resentment and uncertainty."
      ),
      example(
        "ch15-ex02",
        "Club leader over relies on popularity",
        ["school"],
        "A club leader wants to stay liked by everyone and avoids hard calls, but the lack of clear standards is making the group more frustrated and less committed.",
        [
          "Choose fairness and consistency over broad popularity and explain the reasoning behind the harder decisions clearly.",
          "Willing followership usually grows from legitimacy more than from constant comfort."
        ],
        "People often say they want a soft leader, then lose trust when softness creates disorder."
      ),
      example(
        "ch15-ex03",
        "Manager gives orders without context",
        ["work"],
        "A manager keeps changing priorities and issuing tasks without explaining the larger goal, and the team is becoming passive, cynical, and slow.",
        [
          "Reconnect the work to a clear direction and show steadier prioritization so the team feels guided instead of jerked around.",
          "Authority strengthens when instruction is joined to meaning."
        ],
        "People follow more willingly when they can see that the burden being asked of them serves something coherent."
      ),
      example(
        "ch15-ex04",
        "Founder seeks admiration from the team",
        ["work"],
        "A founder wants constant emotional reassurance from employees and becomes erratic when the room is not visibly excited enough.",
        [
          "Shift leadership away from the need to be fed and back toward steadiness, competence, and real responsibility for the group's problems.",
          "Authority weakens when followers must parent the center."
        ],
        "Greene's leadership law depends on inner authority. A needy center produces brittle followership."
      ),
      example(
        "ch15-ex05",
        "Friend group needs direction on a trip",
        ["personal"],
        "A friend group trip starts going poorly because nobody wants to make clear calls, and the person who informally takes over keeps changing plans based on whoever complained last.",
        [
          "Create a simple, fair structure for decisions and stick to it instead of governing by the last wave of pressure.",
          "People usually relax when leadership becomes steadier and more predictable."
        ],
        "Fickleness is not only political. Small groups also test whether the person in charge can absorb pressure without dissolving."
      ),
      example(
        "ch15-ex06",
        "Family member trusted only in crisis",
        ["personal"],
        "Your family turns to one person during emergencies because they stay calm, but ignores another member with the louder title because that person becomes dramatic and inconsistent under pressure.",
        [
          "Notice that real authority is being granted to steadiness rather than to formal status and build more of that inner authority if you want people to trust your lead.",
          "Emotional center matters more than position when stress rises."
        ],
        "Greene's point is that people follow the person who carries uncertainty best, not merely the person who claims the seat."
      ),
    ],
    directQuestions: [
      question(
        "ch15-q01",
        "Why is title alone weak authority in this law?",
        [
          "Because people dislike all hierarchy.",
          "Because followers judge steadiness, fairness, and competence in the person using the title.",
          "Because authority should always be hidden.",
          "Because rules never matter."
        ],
        1,
        "Formal power may secure compliance, but willing followership depends on lived legitimacy."
      ),
      question(
        "ch15-q02",
        "What most quickly weakens leadership legitimacy?",
        [
          "Visible consistency and burden carrying.",
          "Fair standards that apply to everyone.",
          "Emotional volatility and self indulgence at the center.",
          "Explaining the larger mission."
        ],
        2,
        "Followers lose trust quickly when the center feels chaotic, vain, or needy."
      ),
      question(
        "ch15-q03",
        "How should a leader respond to group entitlement?",
        [
          "Give the group whatever keeps them happy in the moment.",
          "Ignore morale completely.",
          "Balance empathy with standards rather than surrendering authority to complaint.",
          "Punish complaints publicly."
        ],
        2,
        "Greene's leader stays human and firm at the same time."
      ),
      question(
        "ch15-q04",
        "What creates inner authority?",
        [
          "Being admired often.",
          "Self control, steadiness, and clear relation to burden and standards.",
          "Speaking with maximum certainty.",
          "Avoiding all closeness with followers."
        ],
        1,
        "The chapter grounds outer authority in disciplined inward command."
      ),
    ],
  }),
  chapter({
    chapterId: "ch16-see-the-hostility-behind-the-friendly-facade",
    number: 16,
    title: "See the Hostility Behind the Friendly Facade",
    readingTimeMinutes: 13,
    summary: {
      p1: t(
        "Aggression is a permanent part of human nature, and Greene argues that it often appears in indirect or polished forms long before it appears openly. The friendly facade can hide rivalry, resentment, passive punishment, territory defense, or a quiet wish to diminish another person.",
        "The chapter teaches the reader to stop assuming hostility always looks loud. Sophisticated aggression often arrives as delay, guilt, mock innocence, selective forgetfulness, and smiling obstruction.",
        "Greene also turns the law inward by arguing that your own aggressive energy must be recognized and governed instead of denied until it leaks out destructively."
      ),
      p2: t(
        "This matters because people who only watch for open attack are easy to wear down by subtler forms of hostility. Much personal and professional damage happens through passive pressure that remains deniable on the surface.",
        "The deeper lesson is to respond at the level of pattern, not at the level of the aggressor's preferred disguise. If you keep debating the mask, the aggression keeps working.",
        "In practice, the law asks for clean boundaries and controlled force. Better to name and channel aggression honestly than to let it become poison under a polite surface."
      ),
    },
    standardBullets: [
      bullet(
        "Aggression is often indirect. Greene warns that hostility frequently hides behind friendliness, helplessness, or civility.",
        "The smoother the surface, the easier it can be to miss the pattern."
      ),
      bullet(
        "Passive aggression is real aggression. Delay, guilt, sabotage, selective silence, and convenient forgetting can all serve hostile aims.",
        "The lack of overt attack does not make the pattern harmless."
      ),
      bullet(
        "Watch for deniable repetition. One ambiguous act proves little, but a repeated pattern of obstruction or sting matters.",
        "Aggression often depends on making you doubt your own reading."
      ),
      bullet(
        "Do not argue with the mask. If you spend all your energy debating whether the person is really hostile, you may ignore the actual effect of the behavior.",
        "Respond to pattern and consequence."
      ),
      bullet(
        "Set clear consequences early. Subtle aggressors often advance when the cost of their behavior stays vague.",
        "Clean boundaries reduce room for hidden warfare."
      ),
      bullet(
        "Use directness over passive retaliation. Greene prefers controlled confrontation to joining the same murky style yourself.",
        "Matching indirect hostility usually thickens the fog."
      ),
      bullet(
        "Study your own aggression honestly. Denied aggressive energy often turns into sarcasm, resentment, or delayed punishment.",
        "What you cannot admit is harder to govern."
      ),
      bullet(
        "Channel force toward protection. Aggression can be useful when it defends boundaries, standards, and necessary action.",
        "The aim is controlled force, not uncontrolled discharge."
      ),
      bullet(
        "Do not reward chronic hostility with naivete. Some people repeatedly choose indirect warfare because it gives them both injury and innocence.",
        "Realism protects your time and trust."
      ),
      bullet(
        "The final lesson is to clear the field. Greene wants fewer hidden battles and more honest power around conflict.",
        "What is named becomes easier to manage."
      ),
    ],
    deeperBullets: [
      bullet(
        "Sophisticated aggressors often prefer moral cover. They cast themselves as hurt, principled, or misunderstood while continuing the hostile pattern.",
        "This cover keeps others arguing about intent instead of addressing effect."
      ),
      bullet(
        "Passive aggression is attractive because it offers discharge without full responsibility. The person can punish while preserving a cleaner self image.",
        "That is part of its persistence."
      ),
      bullet(
        "Your own fear of conflict can empower hidden aggression. People who hate directness often tolerate too much indirect warfare before they respond.",
        "Avoiding open tension can increase covert tension."
      ),
      bullet(
        "Controlled aggression is not cruelty. Greene means the capacity to act decisively, set limits, and protect your ground without sentimental hesitation.",
        "Force can be clean when it is conscious."
      ),
      bullet(
        "The strategic gain of this law is faster pattern recognition. Once you stop expecting hostility to look dramatic, you become harder to manipulate through guilt, confusion, and delay.",
        "Seeing the true form of aggression changes the whole response."
      ),
    ],
    takeaways: [
      "Aggression often hides well",
      "Passive aggression is still aggression",
      "Read repeated effect not surface innocence",
      "Set consequences early",
      "Name your own aggression honestly",
      "Controlled force beats murky retaliation",
    ],
    practice: [
      "Notice one repeated hostile pattern you keep minimizing",
      "State one boundary without apology or fog",
      "Name one indirect way your own aggression leaks out",
      "Respond to effect instead of debating hidden intent forever",
    ],
    examples: [
      example(
        "ch16-ex01",
        "Classmate who keeps forgetting the hard part",
        ["school"],
        "A classmate always volunteers for visible parts of a project and repeatedly forgets the invisible work that would actually help you, then acts surprised when you are frustrated.",
        [
          "Treat the repeated pattern as real aggression against fairness and reset the work structure with clear tasks and consequences instead of accepting another innocent explanation.",
          "Do not let deniability erase the effect."
        ],
        "Passive aggression works by making the target feel unreasonable for noticing it. Greene wants you to stay with the pattern."
      ),
      example(
        "ch16-ex02",
        "Friend who jokes only at your expense",
        ["school"],
        "A friend keeps making cutting jokes about you in group settings and then hides behind humor whenever you show discomfort.",
        [
          "Name the pattern directly and make clear that humor does not excuse repeated humiliation.",
          "If the behavior continues, reduce access instead of arguing about their intentions."
        ],
        "Friendly packaging does not make a hostile pattern harmless. The chapter teaches you to read what the jokes are doing socially."
      ),
      example(
        "ch16-ex03",
        "Coworker slows your work through nice language",
        ["work"],
        "A coworker always sounds cooperative but repeatedly delays the approvals only your work needs, forcing you to chase them while they keep a polite tone.",
        [
          "Move the issue into clearer process, deadlines, and visible accountability so the passive pattern loses room to operate in private.",
          "Respond to the obstruction as a real behavior problem, not as a misunderstanding of tone."
        ],
        "Indirect aggression survives in ambiguity. Structure can make hidden hostility more expensive."
      ),
      example(
        "ch16-ex04",
        "Manager punishes through distance",
        ["work"],
        "After you disagree with a manager, they become outwardly civil but start excluding you from useful information and small opportunities.",
        [
          "Recognize the pattern as retaliatory instead of accepting the polite surface at face value, and document the exclusions while deciding what formal boundary or escalation is needed.",
          "Do not keep debating whether the coldness is intentional if the effect is consistent."
        ],
        "Greene's point is that sophistication can make aggression harder to name but no less damaging."
      ),
      example(
        "ch16-ex05",
        "Partner punishes through silence",
        ["personal"],
        "During conflict, your partner rarely raises their voice, but they withdraw warmth, delay important answers, and let you sit in uncertainty until you give in.",
        [
          "Name the pattern as coercive rather than treating it as harmless quietness, and set a standard for direct communication during conflict.",
          "If the pattern does not change, respond from self respect rather than from increasing appeasement."
        ],
        "Silence can be used as aggression when it is repeatedly weaponized to control the emotional field."
      ),
      example(
        "ch16-ex06",
        "You keep becoming sarcastic instead of direct",
        ["personal"],
        "You tell yourself you are easygoing, but when resentment builds you start delivering it through sarcasm and little punishments rather than through clean honesty.",
        [
          "Admit the aggressive energy early and practice direct statement before it curdles into indirect attack.",
          "Use aggression for boundary and truth, not for disguised revenge."
        ],
        "The law turns inward because denied aggression often leaks out in the very forms we claim to dislike in others."
      ),
    ],
    directQuestions: [
      question(
        "ch16-q01",
        "What makes passive aggression especially effective?",
        [
          "It is more honest than direct conflict.",
          "It allows harm while preserving deniability and innocence on the surface.",
          "It is always accidental.",
          "It affects only very sensitive people."
        ],
        1,
        "Greene emphasizes the combination of injury and plausible innocence that makes passive aggression hard to confront."
      ),
      question(
        "ch16-q02",
        "What is the strongest response to a repeated subtle hostile pattern?",
        [
          "Keep debating whether the person meant it.",
          "Mirror the same indirect style back to them.",
          "Address the pattern and set clearer consequences around effect.",
          "Ignore it until they become openly aggressive."
        ],
        2,
        "The law favors responding to the lived pattern rather than getting trapped inside the disguise."
      ),
      question(
        "ch16-q03",
        "Why is it important to admit your own aggression?",
        [
          "So you can use it against people more efficiently.",
          "Because admitted aggression is easier to direct and less likely to leak destructively.",
          "Because direct anger always improves relationships.",
          "Because everyone else is more aggressive than you are."
        ],
        1,
        "Integration makes force more governable. Denial tends to produce murkier and less controlled expressions."
      ),
      question(
        "ch16-q04",
        "What is controlled aggression in this chapter?",
        [
          "Cruelty with better language.",
          "The refusal to feel any anger.",
          "Clear force used for boundary, protection, and decisive action.",
          "Winning every conflict quickly."
        ],
        2,
        "Greene is distinguishing conscious force from disguised hostility and uncontrolled discharge."
      ),
    ],
  }),
  chapter({
    chapterId: "ch17-seize-the-historical-moment",
    number: 17,
    title: "Seize the Historical Moment",
    readingTimeMinutes: 12,
    summary: {
      p1: t(
        "Generational myopia makes people assume their own habits, tastes, fears, and hopes are timeless when they are actually shaped by the era that formed them. Greene argues that every generation develops a distinct emotional tone and that successful action often depends on reading the larger mood of the time.",
        "The chapter teaches the reader to study the spirit of the age rather than acting as if personal preference alone can explain social change.",
        "For Greene, timing is historical as well as individual. Some ideas, styles, and moves only land when they meet a broader wave that is already rising."
      ),
      p2: t(
        "This matters because many people miss opportunity by fighting the era instead of understanding it. Others become prisoners of their generation and cannot see when the culture has moved on.",
        "The deeper lesson is to balance adaptation with independence. You want enough distance to see the pattern, but enough flexibility to work with it rather than against it blindly.",
        "In practice, the law asks you to read recurring generational needs, anxieties, and desires, then position your work and choices where the current is already building force."
      ),
    },
    standardBullets: [
      bullet(
        "Each generation is shaped by its era. Greene argues that shared events and conditions leave an emotional imprint on a cohort.",
        "That imprint influences taste, fear, ambition, and reaction."
      ),
      bullet(
        "Do not mistake the present mood for timeless truth. What feels natural to one generation can feel stale or oppressive to the next.",
        "Historical perspective reduces arrogance about your own assumptions."
      ),
      bullet(
        "Read the spirit of the times. Successful action often aligns with a larger social current already gathering strength.",
        "Timing matters because some moves are powerful only in the right era."
      ),
      bullet(
        "Generational conflict often hides different emotional experiences of the world. What looks like stubbornness can reflect formation under very different pressures.",
        "Reading those pressures improves judgment."
      ),
      bullet(
        "Spot rising needs and frustrations. Change often begins where a generation feels constrained, unseen, or underserved.",
        "Desire at scale creates historical momentum."
      ),
      bullet(
        "Avoid nostalgic blindness. Attachment to the old mood can stop you from noticing what the new one demands.",
        "What once worked may now repel."
      ),
      bullet(
        "Do not become a simple trend follower. Greene wants active reading, not empty imitation.",
        "You still need substance and independent thought."
      ),
      bullet(
        "Position work where the wave is rising. Timing and fit can multiply the impact of a strong idea or skill.",
        "Historical awareness improves leverage."
      ),
      bullet(
        "Study the generation above and below you. Perspective widens when you compare the emotional climate that formed each group.",
        "This reduces lazy caricature."
      ),
      bullet(
        "The closing lesson is to become historically awake. Greene wants you to move with time consciously instead of being carried by it unconsciously.",
        "That awareness improves both strategy and self understanding."
      ),
    ],
    deeperBullets: [
      bullet(
        "Generational identity can become a soft prison. People repeat the emotional style of their cohort even after conditions have changed.",
        "Formation is powerful, but it should not become fate."
      ),
      bullet(
        "Historical moments are often legible before they are fully named. Small shifts in language, aspiration, and irritation can signal a deeper turn already underway.",
        "Attentive observers can see the wave early."
      ),
      bullet(
        "Aging increases the risk of historical blindness if people confuse maturity with timeless correctness. Adaptation becomes harder once identity fuses with one era's rules.",
        "Greene is warning against that fusion."
      ),
      bullet(
        "Reading the moment is not surrendering to fashion. The stronger move is to understand the current deeply enough to bring something real to it.",
        "Substance plus timing beats mimicry."
      ),
      bullet(
        "The strategic gain of this law is leverage. When your work meets an already rising social need, the same effort can travel much farther.",
        "Historical awareness lets you ride force instead of manufacturing all of it alone."
      ),
    ],
    takeaways: [
      "Generations are shaped by shared conditions",
      "The current mood is not timeless",
      "Read the spirit of the age",
      "Timing multiplies substance",
      "Avoid nostalgic blindness",
      "Historical awareness creates leverage",
    ],
    practice: [
      "List one major condition that shaped your cohort",
      "Notice one rising social frustration or desire around you",
      "Compare how two generations read the same issue differently",
      "Ask whether your current plan fits the time or only your preference",
    ],
    examples: [
      example(
        "ch17-ex01",
        "Campus project aimed at an outdated mood",
        ["school"],
        "You are designing a campus initiative using a tone and format that appealed strongly a few years ago, but current students are responding to different needs and different forms of trust.",
        [
          "Study what the present cohort is actually responding to now and redesign from the live mood rather than from nostalgic certainty about what used to work.",
          "Keep the core value, but adapt the form to the current moment."
        ],
        "The law matters because even a good idea can miss when it speaks to the wrong emotional climate."
      ),
      example(
        "ch17-ex02",
        "Conflict with an older mentor",
        ["school"],
        "An older mentor keeps giving advice that made sense in their own formation period, but parts of it do not fit the current environment you are actually entering.",
        [
          "Read the advice through the era that shaped it, take what remains structurally strong, and separate that from what is dated by changed conditions.",
          "Respect does not require historical blindness."
        ],
        "Generational myopia weakens judgment when people mistake their own formation for timeless truth."
      ),
      example(
        "ch17-ex03",
        "Product misses a rising shift",
        ["work"],
        "A team keeps refining a product for an audience whose priorities are shifting faster than the roadmap, and each release feels more polished but less relevant.",
        [
          "Study the broader mood and emerging frustrations around the market now, then reposition the product where the social current is actually moving.",
          "Do not let attachment to yesterday's fit block tomorrow's opening."
        ],
        "Seizing the historical moment means reading the wave early enough to meet it with substance."
      ),
      example(
        "ch17-ex04",
        "Leader clings to an old communication style",
        ["work"],
        "A leader insists on a style of authority that worked in an earlier professional era, but the current team reads the same behavior as distance and opacity.",
        [
          "Separate the enduring need for leadership from the dated performance style and adapt the form without losing the standard.",
          "Authority survives better when it understands the time it is leading in."
        ],
        "The chapter is not anti tradition. It is anti blindness about whether the old form still reaches the present mind."
      ),
      example(
        "ch17-ex05",
        "Family conflict over life timing",
        ["personal"],
        "Your family sees career and relationship milestones through one historical script, while your generation is navigating a different economic and social landscape altogether.",
        [
          "Interpret the conflict through the different conditions that shaped each side rather than through simple accusations of laziness or rigidity.",
          "Use that understanding to negotiate expectations more intelligently."
        ],
        "Generational tension often becomes more manageable once you stop pretending both groups were formed by the same world."
      ),
      example(
        "ch17-ex06",
        "You dismiss a new cultural shift too quickly",
        ["personal"],
        "You catch yourself mocking a rising taste or platform because it looks shallow from the outside, yet the energy around it may be pointing to a deeper unmet need.",
        [
          "Look past the first distaste reaction and ask what broader desire, fear, or frustration the shift is expressing.",
          "Reading the need beneath the form is often more useful than mocking the form itself."
        ],
        "Historical awareness begins when you stop assuming your own taste is the measure of what matters now."
      ),
    ],
    directQuestions: [
      question(
        "ch17-q01",
        "What is generational myopia in this law?",
        [
          "The belief that every generation is identical.",
          "The tendency to mistake the outlook shaped by your era for timeless truth.",
          "The habit of studying history too much.",
          "The refusal to learn from older people."
        ],
        1,
        "Greene uses the law to show how formation by an era can become invisible to the people inside it."
      ),
      question(
        "ch17-q02",
        "Why does reading the spirit of the times matter strategically?",
        [
          "Because timing can multiply the force of a good idea or skill.",
          "Because trends remove the need for substance.",
          "Because older approaches are always useless.",
          "Because every cultural shift is worth following."
        ],
        0,
        "Historical awareness helps strong work meet a rising social need instead of missing it."
      ),
      question(
        "ch17-q03",
        "What is the strongest response to conflict between generations?",
        [
          "Assume the older side is always rigid.",
          "Assume the younger side is always entitled.",
          "Read how each group was formed by different conditions before judging too quickly.",
          "Avoid the topic completely."
        ],
        2,
        "The law improves judgment by locating the different emotional and material worlds that shaped each side."
      ),
      question(
        "ch17-q04",
        "What does this chapter warn against in successful people?",
        [
          "Adapting too quickly.",
          "Confusing the methods of their own rise with permanently valid law.",
          "Taking pride in past work.",
          "Studying younger audiences."
        ],
        1,
        "Historical blindness often grows when people think what once worked must still fit unchanged conditions."
      ),
    ],
  }),
  chapter({
    chapterId: "ch18-meditate-on-our-common-mortality",
    number: 18,
    title: "Meditate on Our Common Mortality",
    readingTimeMinutes: 12,
    summary: {
      p1: t(
        "Death denial distorts life by encouraging distraction, pettiness, and the fantasy of endless time. Greene argues that when people refuse to face mortality, they often live more timidly, not more freely, because they keep postponing what matters and clinging to trivial emotional battles.",
        "The chapter treats awareness of death as a clarifying force rather than a morbid obsession.",
        "For Greene, mortality is the final teacher because it exposes scale. It shows what deserves urgency, what deserves gratitude, and what does not deserve so much of your life."
      ),
      p2: t(
        "This matters because remembering finitude can cut through drift, vanity, and fear of judgment. Many things lose power once you ask whether they deserve a meaningful portion of a limited life.",
        "The deeper lesson is not reckless living but intensified presence. Mortality sharpens purpose, courage, and appreciation because time is no longer treated as abstract surplus.",
        "In practice, the law helps you live with more proportion. It reduces the temptation to sleepwalk through years or spend them on conflicts and performances that never really mattered."
      ),
    },
    standardBullets: [
      bullet(
        "Mortality creates clarity. Greene argues that awareness of death can reorder what feels important.",
        "Limited time changes the scale of daily decisions."
      ),
      bullet(
        "Death denial encourages postponement. People act as if life's real work can always begin later.",
        "That fantasy quietly wastes years."
      ),
      bullet(
        "Many conflicts shrink under mortality. Petty status fights and stale resentments lose force when viewed against finite life.",
        "Perspective can dissolve false urgency."
      ),
      bullet(
        "Awareness of death can deepen presence. Ordinary moments become more vivid when they are not treated as endlessly replaceable.",
        "Finitude can increase gratitude."
      ),
      bullet(
        "Use mortality to strengthen courage. Fear of embarrassment and delay weakens once time itself becomes the clearer cost.",
        "A limited life asks for cleaner priority."
      ),
      bullet(
        "Do not confuse urgency with frenzy. Greene is not calling for frantic consumption of experience.",
        "He is calling for more intentional use of time."
      ),
      bullet(
        "Mortality can clarify purpose. What matters most becomes easier to identify when the horizon is real.",
        "Death awareness sharpens selection."
      ),
      bullet(
        "Shared mortality can soften arrogance. Everyone is moving under the same ultimate limit.",
        "That recognition can deepen empathy and humility."
      ),
      bullet(
        "Build a philosophy of life, not just fear of loss. The point is not to dread death daily but to let it improve how you live.",
        "A good death meditation returns you to fuller life."
      ),
      bullet(
        "The final lesson is to spend time like it matters because it does. Greene closes by turning mortality into a discipline of meaning, proportion, and aliveness.",
        "Facing the end can make the middle more honest."
      ),
    ],
    deeperBullets: [
      bullet(
        "Death denial often looks like busyness, not only fear. People can hide from mortality by filling life with noise that prevents contact with deeper questions.",
        "Distraction becomes a shield against finitude."
      ),
      bullet(
        "Mortality awareness exposes false endlessness in relationships, work, and self presentation. It becomes harder to justify wasting years on what you do not respect.",
        "This is why the law can be so liberating."
      ),
      bullet(
        "The chapter is not anti planning. It is anti unconscious postponement. Long term building matters more, not less, once you accept that time is finite.",
        "Death awareness can actually improve discipline."
      ),
      bullet(
        "Shared mortality also widens compassion. Other people's vanity, fear, and confusion can look different once you remember they too are finite creatures under uncertainty.",
        "The law balances urgency with tenderness."
      ),
      bullet(
        "The strategic gain of this law is proportion. When death becomes thinkable, you stop granting trivial things a level of importance they never deserved.",
        "Perspective can return force to what is truly worth a life."
      ),
    ],
    takeaways: [
      "Mortality clarifies priority",
      "Death denial feeds postponement",
      "Finitude can deepen presence",
      "Urgency should be intentional not frantic",
      "Shared mortality softens arrogance",
      "Time deserves proportionate use",
    ],
    practice: [
      "Ask what current conflict would matter from a larger life horizon",
      "Choose one delayed important act and move it forward now",
      "Notice one way busyness is hiding deeper avoidance",
      "Spend one hour this week in line with what would still matter years from now",
    ],
    examples: [
      example(
        "ch18-ex01",
        "Waiting to start the real work",
        ["school"],
        "You keep telling yourself that the work you care about will begin after this semester, after next year, or after some cleaner version of life arrives.",
        [
          "Use mortality as a corrective and move one meaningful part of that work into the present instead of protecting the fantasy of endless later.",
          "A finite horizon makes postponement more visible."
        ],
        "The law matters because delay often survives on the illusion that real life has not started yet."
      ),
      example(
        "ch18-ex02",
        "Campus conflict feels huge until perspective returns",
        ["school"],
        "A social conflict at school is consuming your emotional energy, but when you step back it is clear the fight is taking more life than it deserves.",
        [
          "Ask whether this conflict is worthy of a meaningful slice of your limited time and respond from that larger measure.",
          "Do not confuse constant mental rehearsal with importance."
        ],
        "Mortality perspective shrinks some battles not by denying them, but by placing them in true proportion."
      ),
      example(
        "ch18-ex03",
        "Career plan built on endless deferral",
        ["work"],
        "You stay in a work pattern that drains you because making a change feels uncomfortable, and the mind keeps promising there will be a later season for more meaningful direction.",
        [
          "Use the fact of finite time to test the story of endless later and take one concrete step toward the work that actually deserves your life.",
          "Fear often weakens when time becomes the clearer cost."
        ],
        "Death awareness can make career drift harder to justify because life stops feeling like an abstract surplus."
      ),
      example(
        "ch18-ex04",
        "Team obsessed with trivial internal drama",
        ["work"],
        "A team is spending weeks on prestige friction and bruised egos while the work that could genuinely matter to users keeps losing time and attention.",
        [
          "Recenter the group on what actually merits limited human effort and refuse to keep feeding trivial theater as if it were the core mission.",
          "Mortality perspective can restore seriousness without becoming grim."
        ],
        "Some organizational drama survives only because nobody asks whether it deserves a real portion of life."
      ),
      example(
        "ch18-ex05",
        "You keep waiting to say what matters",
        ["personal"],
        "There is something important you need to say to someone you love, but discomfort keeps pushing the conversation into a vague future date that never arrives.",
        [
          "Let finitude sharpen courage and say the necessary thing while time still exists for honesty, repair, or appreciation.",
          "Mortality often clarifies the real cost of avoidance."
        ],
        "The law is useful because death awareness can turn emotional hesitation into timely presence."
      ),
      example(
        "ch18-ex06",
        "Losing days to numb distraction",
        ["personal"],
        "You finish many days feeling occupied but not alive, as if your time has been spent rather than used in any way you would later respect.",
        [
          "Treat that dullness as a mortality signal and redesign part of your routine around presence, meaning, and fuller engagement instead of endless numb filling.",
          "A finite life deserves more than passive expenditure."
        ],
        "Greene ends the book by asking what kind of life your habits are actually building under the limit of time."
      ),
    ],
    directQuestions: [
      question(
        "ch18-q01",
        "What is the strongest practical benefit of mortality awareness in this law?",
        [
          "It removes all fear instantly.",
          "It clarifies priority and reduces wasted time on what matters less.",
          "It makes planning unnecessary.",
          "It encourages reckless living."
        ],
        1,
        "Greene uses mortality to sharpen proportion, courage, and meaningful selection."
      ),
      question(
        "ch18-q02",
        "What does death denial most often encourage?",
        [
          "Intentional living.",
          "Deep gratitude.",
          "Postponement and life drift under the fantasy of endless later.",
          "Better long term planning."
        ],
        2,
        "The law argues that people often delay what matters because they act as if real time pressure does not exist."
      ),
      question(
        "ch18-q03",
        "Which response best reflects the chapter's tone?",
        [
          "Live frantically because life is short.",
          "Use awareness of finitude to act with more intention and presence.",
          "Avoid thinking about death because it lowers morale.",
          "Cut yourself off from ordinary pleasures."
        ],
        1,
        "Greene is aiming for clarified life, not panic or grim austerity."
      ),
      question(
        "ch18-q04",
        "Why does this law soften arrogance as well as intensify urgency?",
        [
          "Because everyone shares the same ultimate limit of mortality.",
          "Because death makes everyone equally successful.",
          "Because urgency always creates compassion.",
          "Because people become perfect when they think about death."
        ],
        0,
        "Shared finitude can widen empathy and reduce the illusion that some lives stand above the human condition."
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
