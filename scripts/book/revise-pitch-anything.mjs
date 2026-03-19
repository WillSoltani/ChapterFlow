import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";

const packagePath = resolve(process.cwd(), "book-packages/pitch-anything.modern.json");
const reportPath = resolve(process.cwd(), "notes/pitch-anything-revision-report.md");

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
    .replace(/\s+/g, " ")
    .trim();

const DEFAULT_SIMPLE_INDEXES = [0, 1, 2, 4, 6, 8, 9];

const SCENARIO_WRONG_BANK = [
  "Answer every question immediately with more detail, even if the room is getting colder",
  "Let the other side define the meeting and hope the strength of the idea carries you",
  "Signal how badly you need the outcome so they understand the stakes",
  "Keep talking until there is no uncertainty left for anyone",
  "Treat pushback as proof that you should defend harder inside their frame",
  "Lead with background and process before you state the core idea",
  "Chase approval first and discuss leverage later",
  "Wait for the room to become interested on its own before you sharpen the pitch",
];

const AUDIT_SUMMARY = [
  "The existing Pitch Anything package was not ready to ship. It used a thin template across all eight chapters, so the book lost most of its distinct logic around frames, status, intrigue, and leverage.",
  "Most summaries repeated the same generic structure, swapped a few nouns, and rarely explained what Klaff was actually teaching. Paragraph two was often a reusable paragraph about work, school, and personal life rather than a deeper reading of the idea.",
  "The bullet sets were repetitive, Simple mode only surfaced six authored bullets, the scenarios were almost identical from chapter to chapter, and the quiz prompts were generic wrappers that tested pattern recognition more than understanding.",
  "This revision replaces the book package chapter by chapter, keeps the current eight chapter structure, restores fidelity to the book's method, and adds book specific motivation styling in the reader so the experience feels authored instead of mechanically decorated.",
];

const MAIN_PROBLEMS = [
  "The summaries explained a template more than the real chapter logic.",
  "Bullet points were repetitive across chapters and did not build a satisfying learning arc.",
  "Simple, Standard, and Deeper did not differ enough in quality or count, since the authored sets were 6, 10, and 14.",
  "Scenarios were recycled with minor wording changes, so they did not feel chapter specific or believable enough.",
  "Quiz prompts were generic and the distractors did not consistently test applied judgment.",
  "Motivation styling in the reader was generic and not tailored to Klaff's sharper focus on frames, status, and leverage.",
];

const PERSONALIZATION_STRATEGY = [
  "Depth remains the authored content axis. Simple now gives a fast but faithful lesson with seven bullets. Standard is the strongest default with ten bullets and better sequencing. Deeper adds five real insights about tradeoffs, diagnostic cues, and transfer rather than padding the same ideas.",
  "Motivation remains a reader layer rather than nine duplicated package files. The package stores the stable meaning of each chapter, while the reader now applies Pitch Anything specific guidance to summary framing, scenario coaching, recap language, and quiz explanations.",
  "Gentle for this book stays calm without becoming soft. Direct sharpens clarity and consequence. Competitive emphasizes edge, leverage, and the cost of giving the room your position too early.",
  "This keeps the schema lean while making the user facing experience across Simple, Standard, Deeper and Gentle, Direct, Competitive feel materially different.",
];

const SCHEMA_NOTE =
  "No package schema change was required. The revision stays inside the current JSON structure. Depth is authored in the package, and motivation is personalized in the reader with Pitch Anything specific guidance rather than nine duplicated book files.";

const CHAPTER_REVISIONS = [
  chapter({
    chapterId: "ch01-pitch-method",
    number: 1,
    title: "The Pitch Method Starts In The Brain",
    readingTimeMinutes: 13,
    summary: {
      p1: t(
        "Klaff argues that a pitch succeeds or dies first in the listener's fast survival filter, not in the part of the mind that calmly compares evidence. Before people study your logic, they decide whether your message feels novel, threatening, boring, or worth attention.",
        "That is why Pitch Anything starts with the brain instead of with slides. The book treats pitching as a sequence designed for attention, emotion, and social perception before analytical detail arrives.",
        "Klaff uses a simplified brain model, but his practical point is clear. If the room feels overloaded or defensive, better information alone will not rescue the pitch."
      ),
      p2: t(
        "This matters because many good ideas fail before they are really heard. When speakers open with too much detail, too much need, or too little tension, the audience checks out or pushes back before the case is built.",
        "The deeper lesson is that persuasion starts with managing state, not just delivering facts. You have to earn curiosity, lower resistance, and control pace so the analytical mind gets a chance to engage.",
        "In real life, this changes how you prepare. You stop treating the pitch as a data dump and start designing an experience that moves from attention to interest to decision."
      ),
    },
    standardBullets: [
      bullet(
        "The fast filter decides first. The listener sorts for danger, boredom, and novelty before weighing logic.",
        "If you lose that filter, the rest of the pitch struggles to land."
      ),
      bullet(
        "More detail is not the first answer. Early information overload can feel like pressure rather than value.",
        "A crowded opening often makes the room defend itself instead of leaning in."
      ),
      bullet(
        "Novelty earns a hearing. A pitch needs contrast, tension, or a fresh angle that tells the audience this is worth tracking.",
        "Curiosity is the bridge to deeper reasoning."
      ),
      bullet(
        "Social signals shape cognition. People read calm, status, and certainty while they listen.",
        "The pitch lands inside a relationship, not inside a neutral vacuum."
      ),
      bullet(
        "Frame before facts. The audience needs a reason to care and a way to interpret the conversation before raw detail helps.",
        "Context determines whether facts feel relevant or heavy."
      ),
      bullet(
        "Attention is a scarce resource. Strong pitchers pace information so the room can stay engaged.",
        "They do not spend all of the audience's energy in the first few minutes."
      ),
      bullet(
        "Hot cognition matters. Emotion, surprise, and stakes wake the room up.",
        "A pitch that never creates felt significance rarely gets remembered."
      ),
      bullet(
        "Overexplaining is usually a fear response. When speakers sense doubt, they often talk faster and longer.",
        "That move usually tells the room the idea needs rescue."
      ),
      bullet(
        "Read reactions in real time. Confused faces, interrupted pacing, or drifting attention are signals, not annoyances.",
        "Good pitchers adjust before the room fully disengages."
      ),
      bullet(
        "The real skill is sequence. A pitch works when attention, tension, status, and logic arrive in the right order.",
        "That closing point sets up the rest of Klaff's method."
      ),
    ],
    deeperBullets: [
      bullet(
        "Klaff's brain model is a practical shortcut, not a laboratory argument. Its value is strategic sequencing.",
        "It reminds the speaker to win attention before trying to win analysis."
      ),
      bullet(
        "Threat and boredom fail a pitch in different ways, but both block thoughtful consideration.",
        "One makes the room defensive. The other makes the room absent."
      ),
      bullet(
        "The first minutes are about state change, not exhaustive proof. You are moving the audience from guarded to curious.",
        "That is why good openings often feel lighter than nervous speakers expect."
      ),
      bullet(
        "The room is judging whether you can guide it through uncertainty. Delivery and structure answer that question as much as content does.",
        "A speaker who looks lost makes even good ideas feel riskier."
      ),
      bullet(
        "Strong preparation designs a path from alertness to curiosity to evaluation. That path is the hidden architecture of persuasion.",
        "Once you see the pitch this way, random detail starts to look expensive."
      ),
    ],
    takeaways: [
      "Win attention before analysis",
      "Do not overload the opening",
      "Use novelty to wake the room",
      "Frame the conversation early",
      "Read audience state in real time",
      "Sequence beats volume",
    ],
    practice: [
      "Cut your opening to one sharp idea",
      "Add a reason the room should care now",
      "Watch for signs of overload",
      "Save deeper detail until curiosity is active",
    ],
    examples: [
      example(
        "ch01-ex01",
        "Feature review overload",
        ["work"],
        "A product lead walks into an executive review with eighteen slides of research and process detail. By the fifth slide, people are checking messages and asking side questions because they still do not know why the feature matters.",
        [
          "Open with the customer tension and the payoff if it gets solved.",
          "Give only enough context to keep attention alive before you add evidence."
        ],
        "The room has to care before it can compare. Attention is the first gate, so strong ideas still lose when the opening feels heavy."
      ),
      example(
        "ch01-ex02",
        "Consulting proposal cold open",
        ["work"],
        "A consultant begins a proposal meeting with credentials, methodology, and process charts. The buyer quickly turns the call into a price conversation because the real stakes never became vivid.",
        [
          "Lead with the one market shift or risk that makes the proposal matter now.",
          "Create curiosity around the opportunity before you walk through method."
        ],
        "If the audience never feels the urgency or difference, the rest of the pitch becomes easy to commoditize."
      ),
      example(
        "ch01-ex03",
        "Science fair explanation",
        ["school"],
        "A student explains every step of an experiment before showing the surprising result. The judges listen politely, but their attention drops because the point has not arrived yet.",
        [
          "Start with the result and why it matters.",
          "Backfill method only after the audience wants to know how you got there."
        ],
        "Curiosity creates permission for detail. Without it, even solid work can feel slow and forgettable."
      ),
      example(
        "ch01-ex04",
        "Club funding request",
        ["school"],
        "A student senate pitch opens with club history, logistics, and budget minutiae. The room starts treating the request like paperwork instead of a live idea worth backing.",
        [
          "Lead with the campus problem your event solves and the visible outcome it creates.",
          "Use numbers after the room sees the point of the request."
        ],
        "People need a reason to care before they will care about the mechanics. Good sequence turns administration back into attention."
      ),
      example(
        "ch01-ex05",
        "Family care conversation",
        ["personal"],
        "A family meeting about care for an aging parent starts with a long recap of old arguments. Everyone gets tired before the immediate decision is even clear.",
        [
          "Open with the urgent choice and why delay creates a real cost.",
          "Keep the first part of the conversation simple enough that people can stay present."
        ],
        "Even personal conversations are filtered through attention and emotion. If the opening drains the room, clarity never arrives."
      ),
      example(
        "ch01-ex06",
        "Weekend trip pitch",
        ["personal"],
        "A friend tries to sell a group trip by listing options, routes, and logistics for ten straight minutes. The group stops engaging because the experience never feels vivid enough to matter.",
        [
          "Start with the best picture of the experience and why this weekend is worth claiming.",
          "Add logistics only once people are leaning in."
        ],
        "A good pitch gives the room a reason to imagine the outcome before it asks the room to process the details."
      ),
    ],
    directQuestions: [
      question(
        "ch01-q01",
        "What does a strong pitch need to win before detailed analysis begins?",
        [
          "Attention from the listener's fast threat and novelty filter",
          "Permission to share every supporting detail",
          "Immediate agreement on price and timing",
          "A long stretch with no interruption"
        ],
        0,
        "Klaff's opening claim is that the pitch first has to get through the listener's fast filter. Analysis matters later."
      ),
      question(
        "ch01-q02",
        "Why can a detailed opening hurt a good idea?",
        [
          "Because it makes the speaker look too prepared",
          "Because it overloads the room before curiosity and context exist",
          "Because detail only matters after a contract is signed",
          "Because listeners never care about evidence"
        ],
        1,
        "Early overload feels like pressure. Without curiosity first, more information often weakens the pitch."
      ),
      question(
        "ch01-q03",
        "What is the real job of the opening minute?",
        [
          "Cover every likely objection",
          "Prove the speaker's technical expertise",
          "Move the audience from guarded or bored to curious enough to keep listening",
          "Get the audience to promise a decision on the spot"
        ],
        2,
        "The opening is about changing state. Once the room is attentive, deeper proof has a place to land."
      ),
      question(
        "ch01-q04",
        "What habit follows from this view of pitching?",
        [
          "Explain more whenever you feel resistance",
          "Treat slides as the main persuader",
          "Ignore tone and focus only on substance",
          "Design the pitch for how the audience will process it, not for how much you want to say"
        ],
        3,
        "Klaff's method is audience centered in a very practical way. Sequence has to follow how attention and resistance actually work."
      ),
    ],
  }),
  chapter({
    chapterId: "ch02-frame-control",
    number: 2,
    title: "Control The Social Frame Early",
    readingTimeMinutes: 14,
    summary: {
      p1: t(
        "Klaff argues that the person who sets the frame first shapes how the whole conversation is interpreted. A pitch is never heard in a vacuum. It lands inside a mental story about who has authority, what kind of meeting this is, and what rules will govern it.",
        "That is why strong pitches define the interaction before they defend the idea. If the other side turns your meeting into a commodity review, an interrogation, or a plea for approval, you begin from a weaker position.",
        "Frame control is less about dominance than about protecting meaning. The room is always deciding what this conversation is, and delay usually hands that decision to someone else."
      ),
      p2: t(
        "This matters because many speakers fight about content inside a frame that already makes them look ordinary or dependent. Once that happens, even good answers can strengthen the wrong setup.",
        "The deeper lesson is that persuasion depends on the lens as much as the facts. Agenda, tempo, and the first few moves often matter more than the tenth supporting point.",
        "In practice, this means you prepare the setup, not just the slides. You decide how the meeting starts, what the point is, and how to recover if the room tries to drag you somewhere weaker."
      ),
    },
    standardBullets: [
      bullet(
        "A frame is the lens of the interaction. It tells the room what kind of conversation this is and who is supposed to lead it.",
        "Once that lens hardens, every later point gets interpreted through it."
      ),
      bullet(
        "The default buyer frame is often weak for the speaker. It turns the pitch into a comparison shop where the audience holds all of the leverage.",
        "If you accept that setup too quickly, the idea starts to look interchangeable."
      ),
      bullet(
        "Early moments decide who controls meaning. The first few exchanges tell the room whether you are leading a valuable opportunity or answering for yourself.",
        "That is why frame control has to happen early."
      ),
      bullet(
        "Defending inside a hostile frame deepens the loss. Long explanations can make the other side's assumptions look even more legitimate.",
        "You often need a reset, not a bigger defense."
      ),
      bullet(
        "Strong openings set agenda and stakes. They make clear why this meeting matters and what the audience should be paying attention to.",
        "That gives your idea a stronger container before objections arrive."
      ),
      bullet(
        "Pattern interrupts can break a weak frame. A short unexpected move can stop the room from sliding into autopilot.",
        "The goal is not performance for its own sake. The goal is to wake attention back up."
      ),
      bullet(
        "Brevity protects frame control. When pressure rises, tighter answers usually work better than longer ones.",
        "Long defense often sounds like submission."
      ),
      bullet(
        "Tempo is part of the frame. Whoever controls pacing often controls how the idea gets judged.",
        "Rush lets the room set the terms. Calm pace creates room to lead."
      ),
      bullet(
        "Frame control is not bullying. It is a way of keeping the conversation on meaningful ground.",
        "You can be respectful and still refuse a weak setup."
      ),
      bullet(
        "If you do not set the frame, one will be set for you. That closing lesson is one of the book's hard rules.",
        "Pitch quality depends on how the interaction is defined before the details arrive."
      ),
    ],
    deeperBullets: [
      bullet(
        "Frames change what counts as relevant. The same facts can feel persuasive or forgettable depending on the lens around them.",
        "That is why frame control changes meaning, not just tone."
      ),
      bullet(
        "A frame collision is usually won with clarity, not with volume. The calmer speaker often keeps more authority.",
        "When you react emotionally, you help the other frame absorb you."
      ),
      bullet(
        "Time boundaries are part of frame control. How long the room gets to drift is a strategic choice, not a neutral detail.",
        "A pitch with no boundaries is easier to dilute."
      ),
      bullet(
        "Respect does not require surrendering the setup. You can answer hard questions without letting the interaction become something smaller than it should be.",
        "That distinction separates composure from submission."
      ),
      bullet(
        "Early frame losses often cascade into later problems with price, status, and decision quality. The opening is not a minor ritual.",
        "It quietly determines how much ground you will spend recovering later."
      ),
    ],
    takeaways: [
      "Frame shapes meaning",
      "Set the lens early",
      "Do not defend inside weak setup",
      "Control agenda and tempo",
      "Use brevity under pressure",
      "Respect does not mean surrender",
    ],
    practice: [
      "Define the meeting before the room does",
      "Prepare one reset line for weak frames",
      "Shorten answers when pressure rises",
      "Protect time and agenda on purpose",
    ],
    examples: [
      example(
        "ch02-ex01",
        "Procurement squeeze",
        ["work"],
        "A buyer opens the call by saying they just want your lowest number because they are comparing three vendors. If you accept that setup immediately, the rest of the pitch becomes a commodity exercise.",
        [
          "Reset the meeting around fit, results, and whether this is even the right solution before you talk price.",
          "Keep the call from becoming a pure comparison game you did not choose."
        ],
        "If you accept the other side's weak frame, you start bargaining from it. Frame control decides how the offer will be understood."
      ),
      example(
        "ch02-ex02",
        "Decision meeting turns into update",
        ["work"],
        "You scheduled a meeting to win approval for a strategic initiative, but your manager opens with, \"Just give me a quick update.\" The room starts drifting into surface reporting instead of the decision you came to get.",
        [
          "Restate the purpose and the decision needed before you dive into details.",
          "Hold to the agenda that gives the idea its real weight."
        ],
        "A weak frame can shrink a serious proposal into background noise. Resetting early keeps the interaction on the right ground."
      ),
      example(
        "ch02-ex03",
        "Presentation turns into defense",
        ["school"],
        "During a class presentation, a professor interrupts in the first minute and the student starts answering question after question. Soon the entire talk feels like a defense rather than a guided pitch.",
        [
          "Answer briefly, then return to the setup so the room understands the core idea first.",
          "Keep the frame as a presentation instead of accepting an endless cross examination."
        ],
        "Once the wrong frame takes over, even good answers can make the speaker look reactive. Early resets protect the rest of the pitch."
      ),
      example(
        "ch02-ex04",
        "Sponsor meeting becomes paperwork",
        ["school"],
        "A club leader meets a sponsor to discuss a meaningful partnership, but the conversation slips into forms and logistics before value is established. The sponsor starts treating the meeting like routine administration.",
        [
          "Reopen with the main opportunity and why the sponsor should care before getting stuck in process.",
          "Use the first few minutes to define the interaction as a high value conversation."
        ],
        "Process is important, but process is a weak frame when it arrives before meaning. Good speakers protect the lens before the checklist."
      ),
      example(
        "ch02-ex05",
        "Family loan talk",
        ["personal"],
        "You ask a relative to consider backing your small business idea, and they immediately make the conversation about whether you are responsible enough as a person. If you answer only inside that frame, the opportunity disappears.",
        [
          "Reframe around the actual opportunity, the standards, and whether the fit makes sense for both sides.",
          "Do not accept a pure character trial as the only definition of the conversation."
        ],
        "The wrong frame can make any ask feel smaller and weaker than it is. Reframing protects both dignity and decision quality."
      ),
      example(
        "ch02-ex06",
        "Roommate renegotiation",
        ["personal"],
        "A conversation about chores turns into a broad attack on personality and maturity. The practical issue disappears under a much weaker and more emotional setup.",
        [
          "Narrow the talk back to the current agreement and the practical change needed.",
          "Protect the issue from being swallowed by a hostile frame."
        ],
        "Frame control matters outside formal pitches because meaning decides what kind of solution is even possible."
      ),
    ],
    directQuestions: [
      question(
        "ch02-q01",
        "What does frame control actually change in a pitch?",
        [
          "The color of the slides and the pace of the handoff",
          "The meaning of the interaction before detailed debate begins",
          "The audience's technical expertise",
          "The speaker's need for preparation"
        ],
        1,
        "Frame control is about the lens of the meeting. It shapes how the room interprets everything that follows."
      ),
      question(
        "ch02-q02",
        "What usually happens when you defend yourself inside the other side's weak frame?",
        [
          "You make the frame feel even more legitimate",
          "You automatically raise your status",
          "You remove the need for an agenda",
          "You guarantee a faster decision"
        ],
        0,
        "Long defense often strengthens the setup that hurt you in the first place. The problem is the lens, not only the answer."
      ),
      question(
        "ch02-q03",
        "What is a strong early move when the room starts defining the meeting too narrowly?",
        [
          "Add more background so nobody feels rushed",
          "Wait for the audience to finish setting the terms",
          "Restate the agenda and the stakes before the idea gets trapped in the wrong setup",
          "Answer every side question in full"
        ],
        2,
        "Strong speakers reset early. They do not let a weak frame harden before trying to lead again."
      ),
      question(
        "ch02-q04",
        "What deeper rule sits under frame control?",
        [
          "The loudest speaker usually wins",
          "Slides matter more than human interaction",
          "A respectful pitch should accept whatever setup appears",
          "If you do not define the interaction, the room will do it for you"
        ],
        3,
        "Frames are always forming. Waiting too long usually means living inside someone else's assumptions."
      ),
    ],
  }),
  chapter({
    chapterId: "ch03-status-signals",
    number: 3,
    title: "Status Shapes How The Pitch Lands",
    readingTimeMinutes: 15,
    summary: {
      p1: t(
        "Klaff argues that people hear a pitch through status signals long before they separate the offer from the speaker. Tone, pace, certainty, and willingness to qualify the opportunity all tell the room who is leading and who is seeking approval.",
        "In this book, status is not vanity language. It is a practical description of how social hierarchy shapes attention and judgment inside a live room.",
        "That is why the chapter focuses on calm authority rather than on aggression. High status in Klaff's sense is composure, not noise."
      ),
      p2: t(
        "This matters because a strong idea can sound weak if it arrives wrapped in low status behavior. Overexplaining, apologizing, and pedestalizing the other side can make the room discount value before it evaluates substance.",
        "The deeper lesson is that status is part of the message container. If you protect your own standing, the audience is more likely to hear the offer as something worth following rather than something begging to be approved.",
        "In practice, this means treating status like a design variable. You control it through pace, boundaries, qualification, and your behavior under challenge."
      ),
    },
    standardBullets: [
      bullet(
        "Status is context, not ego. It shapes how the audience reads the speaker before it fully reads the offer.",
        "People infer value from who seems able to lead the interaction."
      ),
      bullet(
        "The room borrows cues from the presenter. Calm authority makes the idea feel safer and more valuable.",
        "Nervous approval seeking makes the same idea feel less scarce."
      ),
      bullet(
        "Calm restraint signals status better than volume. High status rarely looks frantic.",
        "The speaker who can stay measured under pressure often looks more credible."
      ),
      bullet(
        "Neediness is a status leak. The more visibly you need the outcome, the more leverage the room feels it has.",
        "Status drops when the speaker starts acting chased."
      ),
      bullet(
        "Status alignment beats supplication. You do not have to dominate the room, but you do have to avoid placing yourself beneath it.",
        "Equal footing keeps the message from sounding like a plea."
      ),
      bullet(
        "Qualification works both ways. The audience can evaluate you, but you can also evaluate whether the audience is the right fit.",
        "That shift often restores balance to the conversation."
      ),
      bullet(
        "Small behaviors reveal hierarchy. Rushing, filling silence, and answering everything instantly can place you lower without a word being said.",
        "Status is often lost through micro behavior, not big mistakes."
      ),
      bullet(
        "Pushback is often a status test. The room wants to see whether you can hold shape under pressure.",
        "If you melt into explanation, the test answers itself."
      ),
      bullet(
        "Respect and status can coexist. You can be warm, clear, and still protect your position.",
        "High status is not hostility. It is steadiness."
      ),
      bullet(
        "Protect your standing to protect your idea. The audience often judges the two together.",
        "That is why status is part of pitch method, not a side topic."
      ),
    ],
    deeperBullets: [
      bullet(
        "Local status can be built inside a room even when global prestige is uneven. The meeting has its own hierarchy.",
        "Good speakers manage the status of the moment, not just their title."
      ),
      bullet(
        "High status includes comfort with qualification. Desperation to be chosen is a weak signal even when the offer is strong.",
        "People trust value more when it is not presented as free for the taking."
      ),
      bullet(
        "Over friendliness can become one down behavior when it is driven by fear. Warmth helps only if it still carries self respect.",
        "Tone changes meaning when it comes from anxiety."
      ),
      bullet(
        "Status tests often invite overreaction. The trap is to become louder, longer, or more defensive than the moment requires.",
        "Composure is usually the better answer."
      ),
      bullet(
        "The room wants a guide, not a petitioner. People follow offers more readily when they feel the speaker can carry complexity without flinching.",
        "Status gives the pitch a leader, not just a description."
      ),
    ],
    takeaways: [
      "Status shapes perception",
      "Calm beats frantic energy",
      "Neediness lowers standing",
      "Qualification restores balance",
      "Pushback often tests status",
      "Protect the container of the idea",
    ],
    practice: [
      "Slow your pace under pressure",
      "Stop answering every doubt instantly",
      "Qualify the fit on both sides",
      "Notice where you pedestal the room",
    ],
    examples: [
      example(
        "ch03-ex01",
        "Discount request spiral",
        ["work"],
        "A freelancer hears a client push on price and immediately starts justifying every line item. The more the freelancer explains, the more the client feels in control of the conversation.",
        [
          "Slow down, restate value and scope, and qualify whether the client wants premium results or just the cheapest option.",
          "Do not let the urge to be chosen collapse your standing."
        ],
        "Status often falls through overexplaining. Once that happens, the room starts reading the offer as weaker than it really is."
      ),
      example(
        "ch03-ex02",
        "Promotion conversation",
        ["work"],
        "An employee enters a promotion meeting sounding apologetic and grateful just to be considered. The discussion starts feeling like a favor request instead of a serious evaluation of contribution and next scope.",
        [
          "Speak from evidence and standards, not permission seeking.",
          "Treat the meeting as a mutual evaluation rather than a plea for approval."
        ],
        "A strong case can still land weakly if the room hears low status behavior around it. Position changes perception."
      ),
      example(
        "ch03-ex03",
        "Project leader ignored",
        ["school"],
        "In a group project, a student has the clearest plan but keeps softening every recommendation. More confident classmates begin treating the student like an assistant rather than the person with the best judgment.",
        [
          "Present the recommendation calmly, explain why it serves the goal, and stop asking the group to rescue your certainty.",
          "Use clarity instead of repeated permission seeking."
        ],
        "People often follow status signals before they follow substance. Weak delivery can hide strong thinking."
      ),
      example(
        "ch03-ex04",
        "Scholarship interview pressure",
        ["school"],
        "An interviewer challenges a student sharply and the student starts talking faster, smiling nervously, and answering far beyond the question. The interview shifts from confident to one down in seconds.",
        [
          "Pause, answer cleanly, and keep the same pace you had before the challenge.",
          "Let composure signal credibility."
        ],
        "Pushback often functions like a status test. Calm answers preserve more authority than anxious completeness."
      ),
      example(
        "ch03-ex05",
        "Boundary conversation",
        ["personal"],
        "You need a friend to stop canceling late, but you open with so much apology that the point almost disappears. The conversation starts sounding like a request for kindness rather than a fair standard.",
        [
          "State the boundary plainly and without resentment.",
          "Respect the other person without acting as if basic respect is too much to ask."
        ],
        "Low status behavior turns simple standards into negotiable favors. Steady delivery protects the meaning of the ask."
      ),
      example(
        "ch03-ex06",
        "Selling a used car",
        ["personal"],
        "A buyer acts disinterested, and before any real negotiation begins you start lowering the price and volunteering extra concessions. The buyer learns that pressure works on you before the car is even discussed properly.",
        [
          "Stay calm, qualify the buyer's seriousness, and let the offer stand unless there is a real reason to change it.",
          "Do not teach the other side that uncertainty makes you fold."
        ],
        "Status is partly about whether you seem able to hold your own terms. Weak signals change how the room values the deal."
      ),
    ],
    directQuestions: [
      question(
        "ch03-q01",
        "Which behavior most often lowers status in a pitch?",
        [
          "Speaking with calm brevity",
          "Qualifying whether the fit is right",
          "Rushing to answer every doubt while asking for approval",
          "Holding a steady pace under challenge"
        ],
        2,
        "Overexplaining and approval seeking make the speaker look dependent. That lowers status fast."
      ),
      question(
        "ch03-q02",
        "What does high status look like in Klaff's method?",
        [
          "Calm authority and willingness to qualify the opportunity",
          "Maximum volume and constant certainty",
          "Refusing every question",
          "Making the audience feel small"
        ],
        0,
        "High status here is composure plus standards. It is not theatrical dominance."
      ),
      question(
        "ch03-q03",
        "Why do audiences use status cues when they hear a pitch?",
        [
          "Because status always matters more than substance",
          "Because they are inferring whether the speaker can guide the decision and whether the offer carries value",
          "Because they prefer rude speakers to polite ones",
          "Because they do not want to think about the content"
        ],
        1,
        "People read the presenter as part of the offer. Status cues shape whether the idea feels guided or needy."
      ),
      question(
        "ch03-q04",
        "What deeper habit should this chapter create?",
        [
          "Dominate every conversation no matter the cost",
          "Assume titles will solve status problems for you",
          "Avoid warmth so nobody mistakes you for weak",
          "Protect your own standing so the idea is not heard as a plea"
        ],
        3,
        "The pitch lands through the speaker. Guarding your status keeps the message from being containerized as need."
      ),
    ],
  }),
  chapter({
    chapterId: "ch04-big-idea-structure",
    number: 4,
    title: "Present The Big Idea With Clear Structure",
    readingTimeMinutes: 16,
    summary: {
      p1: t(
        "Klaff argues that a good pitch does not dump information in the order the presenter collected it. It moves through a deliberate structure that starts with a big idea, builds intrigue, lands a hook point, and only then opens more proof.",
        "This is where his STRONG method matters most. Structure is how the speaker turns attention into momentum instead of letting the room drown in background and detail.",
        "The chapter's real point is sequencing. A pitch becomes stronger when each part earns the next part."
      ),
      p2: t(
        "This matters because people rarely reject a good idea after fully understanding it. More often they lose the thread before the value becomes clear.",
        "The deeper lesson is that structure is a form of respect for the audience's attention. It lets you reveal complexity in the order that preserves curiosity and decision quality.",
        "In real use, this means leading with the central shift, giving the room a memorable hook, and treating detail as support rather than as the engine of persuasion."
      ),
    },
    standardBullets: [
      bullet(
        "Structure protects attention. A clear sequence keeps the room from getting lost before the point appears.",
        "Good pitching feels simple because the design did the work early."
      ),
      bullet(
        "Lead with the big idea before background. The audience needs to know what changed or why this matters.",
        "Without that anchor, context turns into drift."
      ),
      bullet(
        "Story gives movement to the pitch. It lets the audience feel progression instead of receiving a pile of facts.",
        "Movement helps memory and interest at the same time."
      ),
      bullet(
        "Intrigue keeps the room leaning in. A useful gap or tension invites the audience to want the next part.",
        "Curiosity is easier to sustain than obligation."
      ),
      bullet(
        "The hook point crystallizes novelty and value. It is the sharp idea the room should repeat after the meeting.",
        "If the pitch has no hook point, it often leaves no trace."
      ),
      bullet(
        "Detail should support after interest is active. Proof is strongest when the room already wants the answer.",
        "Premature evidence often feels heavier than it needs to."
      ),
      bullet(
        "Slides are servants, not the center. The pitch is a guided experience, not a file transfer.",
        "Visuals help when they strengthen the spine instead of replacing it."
      ),
      bullet(
        "Tension and payoff matter. The audience should feel what problem is being solved and why the resolution is worth attention.",
        "A pitch with no emotional movement often sounds flat even when correct."
      ),
      bullet(
        "Ask for a concrete next step. Structure should move toward decision, not just admiration.",
        "A memorable pitch still fails if it leaves action vague."
      ),
      bullet(
        "Strong structure makes confidence easier. When the spine is clear, the speaker can stay present instead of juggling too many loose points.",
        "That is why structure is both a persuasion tool and a performance tool."
      ),
    ],
    deeperBullets: [
      bullet(
        "STRONG works as pacing architecture, not just as a list of ingredients. Each section earns permission for the next one.",
        "The sequence matters as much as the content itself."
      ),
      bullet(
        "Story is useful because it compresses complexity into movement. People track change more naturally than they track categories.",
        "Narrative does not replace rigor. It carries rigor more effectively."
      ),
      bullet(
        "A hook point should survive after the meeting. If the audience cannot restate the central shift simply, the pitch has not fully landed.",
        "Memorability is part of decision quality."
      ),
      bullet(
        "Numbers validate the claim, but they should not bury it. Data is strongest when it arrives after the audience already knows what it is measuring.",
        "Evidence works best when it answers live curiosity."
      ),
      bullet(
        "Good structure survives interruption because the spine is clear. When the meeting gets messy, the speaker can still return to the main line.",
        "That resilience is a hidden sign of a well built pitch."
      ),
    ],
    takeaways: [
      "Lead with the big idea",
      "Use story to create movement",
      "Build intrigue on purpose",
      "Land a clear hook point",
      "Let detail support the spine",
      "End with real next step",
    ],
    practice: [
      "Rewrite your opening around one central shift",
      "Find the one line the room should repeat later",
      "Move proof after curiosity",
      "End every pitch with a concrete decision ask",
    ],
    examples: [
      example(
        "ch04-ex01",
        "Startup demo deck",
        ["work"],
        "A founder starts an investor meeting with team bios, market size tables, and roadmap detail before anyone understands the core shift in the product. The room hears effort, but not the idea's force.",
        [
          "Lead with the big idea and the one insight that makes it unavoidable.",
          "Use the rest of the deck to support that spine instead of hiding it."
        ],
        "Structure decides whether the audience gets pulled into the pitch or buried under it. Strong sequence makes proof easier to hear."
      ),
      example(
        "ch04-ex02",
        "Internal initiative proposal",
        ["work"],
        "An analyst proposes a new workflow by walking through every operational detail from page one. Managers start questioning mechanics before they even see why the change matters.",
        [
          "Start with the central problem, the simple shift, and the payoff.",
          "Sequence supporting detail behind the main idea rather than ahead of it."
        ],
        "A pitch loses force when detail outruns meaning. The spine should lead the room into the evidence."
      ),
      example(
        "ch04-ex03",
        "Capstone presentation",
        ["school"],
        "A student opens a capstone talk with literature review and method while classmates struggle to see why the project matters. By the time the result arrives, the room's energy is already low.",
        [
          "State the claim and the key finding first.",
          "Let the structure guide people from interest to evidence."
        ],
        "People remember what they can organize. A clear big idea gives the rest of the work somewhere to land."
      ),
      example(
        "ch04-ex04",
        "Fundraiser pitch",
        ["school"],
        "A club leader piles every good reason for an event into the first minute and ends up with no central line at all. The audience hears enthusiasm but not a memorable case.",
        [
          "Choose one main idea, one moment of intrigue, and one hook point the room can carry away.",
          "Let supporting points serve those instead of competing with them."
        ],
        "Strong structure feels lighter because it forces choice. It trades volume for clarity and memory."
      ),
      example(
        "ch04-ex05",
        "Move to a new city",
        ["personal"],
        "You want your partner to consider relocating, but you begin with a long list of costs and logistics. The chance to paint the larger opportunity disappears under planning detail.",
        [
          "Start with the shared opportunity and the future it could open up.",
          "Work through objections after the core picture is clear."
        ],
        "Even personal decisions need structure. People commit more easily when they can see the main idea before the complexity."
      ),
      example(
        "ch04-ex06",
        "Group trip plan",
        ["personal"],
        "A friend planning a reunion jumps straight into dates, spreadsheets, and food options. The group never gets a vivid sense of why this trip is worth making happen now.",
        [
          "Open with the central reason the trip matters and the best version of the experience.",
          "Use logistics only to turn interest into action."
        ],
        "Clear structure turns enthusiasm into commitment. Without a spine, details scatter attention instead of focusing it."
      ),
    ],
    directQuestions: [
      question(
        "ch04-q01",
        "What should come before background detail in a strong pitch?",
        [
          "A long explanation of process",
          "A clear big idea that makes the room want the rest",
          "An exhaustive list of objections",
          "A full history of the problem"
        ],
        1,
        "The audience needs the central shift first. Once the point is clear, context becomes easier to process."
      ),
      question(
        "ch04-q02",
        "What does intrigue do inside the pitch structure?",
        [
          "It replaces evidence so the speaker can stay vague",
          "It guarantees immediate agreement",
          "It keeps attention alive by leaving a meaningful gap the audience wants closed",
          "It makes slides more decorative"
        ],
        2,
        "Intrigue gives the room a reason to stay engaged. It is a device for sustained curiosity."
      ),
      question(
        "ch04-q03",
        "Why does the hook point matter?",
        [
          "It gives the room a sharp way to remember why the idea is different",
          "It lets the speaker avoid asking for a decision",
          "It proves the presenter has charisma",
          "It removes the need for data"
        ],
        0,
        "The hook point is the memorable center of the pitch. It helps the audience carry the value after the meeting ends."
      ),
      question(
        "ch04-q04",
        "What deeper rule governs pitch structure here?",
        [
          "Information should follow the order it was researched",
          "The pitch should sound complex if the idea is complex",
          "Structure matters only for nervous speakers",
          "Information should arrive in the order that builds interest and decision, not in the order the presenter collected it"
        ],
        3,
        "Klaff's method is a sequencing rule. The order of delivery is chosen for persuasion, not for the speaker's convenience."
      ),
    ],
  }),
  chapter({
    chapterId: "ch05-frame-stacking",
    number: 5,
    title: "Use Multiple Frames To Shift The Dynamic",
    readingTimeMinutes: 12,
    summary: {
      p1: t(
        "Klaff argues that a pitch rarely succeeds with one static stance. Different forms of resistance call for different frames, so the speaker has to know when to use intrigue, prize, time, moral, or power to change the room.",
        "This is the chapter where frame control becomes dynamic rather than one time. The room keeps moving, and the speaker needs more than one way to move it back.",
        "Frame stacking is not a bag of tricks. It is a diagnosis based way of answering the real source of resistance."
      ),
      p2: t(
        "This matters because many objections are not really requests for more information. They are signs that the current frame is weak or that the other side is trying to seize control.",
        "The deeper lesson is that better evidence inside the wrong frame often changes very little. Sometimes the productive move is to shift the interaction before you continue the content.",
        "In practice, this means asking what kind of pressure is in the room right now and choosing a frame that solves that pressure with the least wasted motion."
      ),
    },
    standardBullets: [
      bullet(
        "Different resistance needs different frames. One response cannot solve every problem in the room.",
        "Good speakers diagnose what kind of pressure is actually present."
      ),
      bullet(
        "The intrigue frame fights boredom and analyst overload. It keeps the room curious enough to stay with you.",
        "Curiosity often opens space that force cannot."
      ),
      bullet(
        "The prize frame reverses dependency. It reminds the audience that the opportunity is not automatically theirs.",
        "That shift protects value and changes posture on both sides."
      ),
      bullet(
        "The time frame prevents endless drift. It pushes the room to treat attention and opportunity as limited.",
        "Without time pressure, strong ideas can die in comfort."
      ),
      bullet(
        "The moral frame exposes unfair or weak behavior. It resets the conversation when the other side is being unreasonable or disrespectful.",
        "This works because it changes what the room is now evaluating."
      ),
      bullet(
        "The power frame stops dominance plays. It reminds the room that you will not simply accept imposed terms.",
        "Used well, it protects position without becoming theatrical."
      ),
      bullet(
        "The analyst frame can become a trap. Endless detail questions sometimes serve delay more than understanding.",
        "Not every request for more data deserves full expansion."
      ),
      bullet(
        "Frame stacking works in sequence. One frame wakes the room, another restores leverage, another creates decision.",
        "The order matters because each frame solves a different problem."
      ),
      bullet(
        "Short controlled shifts usually work best. Announcing your tactic loudly can make the room resist harder.",
        "Good reframing often feels natural in hindsight."
      ),
      bullet(
        "The point of reframing is to change the room, not just the wording. A real frame shift alters behavior, attention, or leverage.",
        "That is why this chapter is about dynamics, not slogans."
      ),
    ],
    deeperBullets: [
      bullet(
        "Frame choice should follow diagnosis. The same move that helps with boredom can backfire under a status challenge.",
        "Skill grows when you read the source of resistance before reaching for a tactic."
      ),
      bullet(
        "The analyst frame often hides a stalling move. Some people ask for more detail because it keeps them safe from decision.",
        "Recognizing that pattern saves huge amounts of wasted explanation."
      ),
      bullet(
        "The prize frame fails if neediness leaks through it. You cannot act scarce while sounding desperate.",
        "Frames work together, so weak status can collapse a strong tactic."
      ),
      bullet(
        "Too much power frame can make the room defensive. The aim is control, not ego display.",
        "Strong speakers spend force carefully."
      ),
      bullet(
        "The best frame stacks feel smooth because each shift answers the next problem. That is why practice matters.",
        "When the sequence is right, the conversation starts moving instead of circling."
      ),
    ],
    takeaways: [
      "Diagnose resistance first",
      "Use intrigue to reopen attention",
      "Use prize to protect leverage",
      "Use time to stop drift",
      "Use moral or power with control",
      "Frame stacks work through sequence",
    ],
    practice: [
      "Name the kind of resistance in the room",
      "Prepare one short intrigue reset",
      "Decide where to use time pressure",
      "Do not answer every analyst prompt in full",
    ],
    examples: [
      example(
        "ch05-ex01",
        "Investor due diligence spiral",
        ["work"],
        "An investor keeps asking for more numbers and the meeting feels colder even though the model is strong. The founder keeps answering deeply, but the room keeps moving farther from decision.",
        [
          "Use intrigue or time to step out of endless analysis and bring the conversation back to the central opportunity.",
          "Answer only the detail that moves a real decision."
        ],
        "Some objections are frame problems, not information problems. More detail inside a stall frame often makes the stall stronger."
      ),
      example(
        "ch05-ex02",
        "Client keeps delaying",
        ["work"],
        "A client says the proposal is interesting but continues delaying next steps while asking for more minor revisions. The consultant keeps feeding analysis because the client sounds engaged.",
        [
          "Shift into time and prize frames by clarifying the cost of drift and qualifying whether the client is ready to move seriously.",
          "Do not keep rewarding delay with unlimited labor."
        ],
        "Frame shifts matter because drift is its own power move. Without a reset, the speaker slowly hands away leverage."
      ),
      example(
        "ch05-ex03",
        "Budget nitpick from adviser",
        ["school"],
        "A faculty adviser keeps poking small holes in a club event budget and the student leader answers every one for twenty minutes. The original value of the event disappears under minor analysis.",
        [
          "Cover the point briefly, then shift back to the larger value and decision.",
          "Use a better frame instead of living inside the nitpick."
        ],
        "The wrong frame can shrink a meaningful conversation into endless low level proof. Reframing restores scale."
      ),
      example(
        "ch05-ex04",
        "Loaded debate question",
        ["school"],
        "In class, another student asks a question built to make you look naive. If you answer it literally, you accept the premise and the room follows their frame.",
        [
          "Use a moral or power frame to call out the premise calmly, then return to your argument.",
          "Do not accept every hostile setup as the ground of discussion."
        ],
        "Multiple frames matter because different attacks require different resets. Content alone is not always the right answer."
      ),
      example(
        "ch05-ex05",
        "Friend asks for another favor",
        ["personal"],
        "A friend who already pushes boundaries asks for a large favor and treats refusal as selfish. If you stay only in explanation mode, the guilt frame keeps growing.",
        [
          "Use a moral frame to make the fairness issue visible and a prize frame to remind them your time is not automatic.",
          "Do not answer guilt with more apology."
        ],
        "Frames govern everyday life too. When the wrong one dominates, clarity and fairness both get weaker."
      ),
      example(
        "ch05-ex06",
        "Holiday plans drift forever",
        ["personal"],
        "A family group chat keeps looping on holiday plans without a decision. Everyone has more input, but nobody feels any time pressure to choose.",
        [
          "Use a time frame to narrow the choice and create a real deadline.",
          "Stop treating endless open discussion as neutral."
        ],
        "The time frame matters because drift silently kills commitment. Good framing gives movement back to the group."
      ),
    ],
    directQuestions: [
      question(
        "ch05-q01",
        "Why use multiple frames in one pitch?",
        [
          "Because different forms of resistance require different shifts in meaning",
          "Because one strong frame should always dominate the whole conversation",
          "Because more tactics automatically create more trust",
          "Because frame changes replace the need for substance"
        ],
        0,
        "Klaff's point is diagnostic. Different problems in the room call for different reframing moves."
      ),
      question(
        "ch05-q02",
        "What does the prize frame do when used well?",
        [
          "It makes the pitch longer and more analytical",
          "It reminds the audience that they also need to qualify for the opportunity",
          "It removes all need for time pressure",
          "It guarantees agreement"
        ],
        1,
        "Prize changes the dependency structure. It protects value by making the opportunity feel selective rather than chased."
      ),
      question(
        "ch05-q03",
        "What is a common framing mistake under pressure?",
        [
          "Leaving the meeting early",
          "Answering every challenge with more detail inside the same losing frame",
          "Using curiosity to reopen attention",
          "Setting a clear next step"
        ],
        1,
        "More evidence inside the wrong frame often strengthens the problem. Sometimes the setup has to shift first."
      ),
      question(
        "ch05-q04",
        "What deeper habit should this chapter build?",
        [
          "Use the power frame every time so the room stays obedient",
          "Treat every analyst question as good faith curiosity",
          "Avoid all direct confrontation",
          "Diagnose the source of resistance before choosing the next frame"
        ],
        3,
        "Reframing gets smarter when it follows diagnosis. The right tool depends on what the room is actually doing."
      ),
    ],
  }),
  chapter({
    chapterId: "ch06-neediness-destroys-power",
    number: 6,
    title: "Neediness Weakens The Deal",
    readingTimeMinutes: 13,
    summary: {
      p1: t(
        "Klaff argues that neediness tells the room you have already handed away leverage. When you signal that you need this buyer, boss, professor, or friend to say yes, the offer loses scarcity and your behavior invites pressure.",
        "In Pitch Anything, neediness is not just an emotion. It is a visible pattern in pace, tone, and decision making that changes how the other side values both you and the deal.",
        "That is why the book ties neediness to status, frames, and prize. Once desperation shows up, the rest of the method gets harder to hold."
      ),
      p2: t(
        "This matters because even a strong proposal can get discounted if the presenter radiates dependence. Desperation invites delay, harder terms, and subtle disrespect.",
        "The deeper lesson is that leverage starts inside the speaker before it appears in negotiation. Real options, standards, and self control protect value better than forced indifference ever can.",
        "In practice, this means qualifying harder, attaching less to one outcome, and refusing to let urgency on your side become the other side's weapon."
      ),
    },
    standardBullets: [
      bullet(
        "Neediness is visible before it is verbal. The room can feel it in speed, tone, and overeagerness.",
        "That is why it changes leverage so quickly."
      ),
      bullet(
        "Desperation lowers perceived value. What looks overly available rarely feels scarce or powerful.",
        "The same offer sounds different when it is chased."
      ),
      bullet(
        "Approval seeking invites harder terms. The more badly you need to be liked or chosen, the more pressure the other side can apply.",
        "Neediness rewards the room for squeezing."
      ),
      bullet(
        "Neediness makes you over answer. Fear of losing the deal often produces longer explanations and weaker boundaries.",
        "That usually deepens the very problem you are trying to solve."
      ),
      bullet(
        "Scarcity depends on self possession. People value opportunities more when the speaker can hold standards calmly.",
        "Composure protects perceived worth."
      ),
      bullet(
        "The prize frame needs emotional detachment. You cannot present the opportunity as valuable while acting terrified to lose it.",
        "Internal urgency leaks into external weakness."
      ),
      bullet(
        "Qualification protects leverage. You should be judging fit, seriousness, and timing on the other side too.",
        "That keeps the deal from becoming a one way audition."
      ),
      bullet(
        "Silence and pauses can strengthen the pitch. Neediness often sounds like rushing to fill every gap.",
        "A calmer pace shows that you are not collapsing under uncertainty."
      ),
      bullet(
        "Real options reduce emotional dependence. The fewer alternatives you have, the harder it is to stay steady.",
        "Preparation and pipeline are leverage tools."
      ),
      bullet(
        "Protect leverage by staying willing to walk. The room feels it when your standards matter more than one specific outcome.",
        "That is the closing discipline of this chapter."
      ),
    ],
    deeperBullets: [
      bullet(
        "Neediness is emotional before it is tactical. By the time it appears in language, it has usually already shaped posture and pace.",
        "That is why inner state matters to outer leverage."
      ),
      bullet(
        "Single outcome obsession causes tactical mistakes. Speakers start accepting weak frames, weak terms, and weak timing because they cannot imagine losing this one shot.",
        "Attachment narrows judgment."
      ),
      bullet(
        "False indifference is weaker than real standards. Acting cool without real boundaries often looks brittle.",
        "The stronger move is genuine self respect plus selective interest."
      ),
      bullet(
        "Qualification is how you protect scarce time and attention. It reminds both sides that not every deal deserves full pursuit.",
        "This turns leverage into a process, not just a feeling."
      ),
      bullet(
        "Detachment improves judgment as well as negotiation power. When you are less trapped by one outcome, you make cleaner decisions about fit and timing.",
        "Neediness hurts strategy before it hurts price."
      ),
    ],
    takeaways: [
      "Neediness leaks through behavior",
      "Desperation lowers value",
      "Approval seeking invites pressure",
      "Qualification restores leverage",
      "Options support composure",
      "Standards matter more than one outcome",
    ],
    practice: [
      "Notice where urgency changes your pace",
      "Qualify the other side before you chase",
      "Build alternatives before the meeting",
      "Use pauses instead of rescuing silence",
    ],
    examples: [
      example(
        "ch06-ex01",
        "Discount before asked",
        ["work"],
        "A consultant is so eager to win an account that they start offering concessions before the client has made a serious commitment. The client learns immediately that pressure will work.",
        [
          "Slow down and qualify the client's priorities before changing terms.",
          "Keep the offer tied to value instead of anxiety."
        ],
        "Neediness teaches the other side how much leverage they have. Once that lesson lands, the deal gets harder to hold."
      ),
      example(
        "ch06-ex02",
        "Promotion plea",
        ["work"],
        "An employee asks for a promotion by focusing on how long they have waited and how much it would mean personally. The conversation shifts away from contribution and into emotional need.",
        [
          "Ground the case in results, future scope, and mutual fit.",
          "Do not make personal need the center of the ask."
        ],
        "A strong request weakens when it sounds like relief seeking. Standards and value create better leverage than emotion alone."
      ),
      example(
        "ch06-ex03",
        "Competition application",
        ["school"],
        "A student writes an application essay that sounds desperate to be chosen and tries to oversell every line. The result feels less confident, not more compelling.",
        [
          "Present the genuine fit and the standards you meet.",
          "Let substance carry the case instead of begging for validation."
        ],
        "Neediness can hide merit by making the speaker sound dependent on approval. Calm clarity often travels better."
      ),
      example(
        "ch06-ex04",
        "Group project approval seeking",
        ["school"],
        "A team lead keeps asking if every tiny decision is okay because they want everyone to like them. The group starts doubting the lead's judgment because the lead never acts as if their own judgment counts.",
        [
          "Make clean recommendations and invite real input only where it changes the outcome.",
          "Stop treating leadership like a popularity test."
        ],
        "Approval seeking changes how others value your role. Neediness weakens authority even in low stakes settings."
      ),
      example(
        "ch06-ex05",
        "Boundary in dating",
        ["personal"],
        "You want clearer communication in a relationship, but you fear the person will leave if you say the standard plainly. You keep softening the point until the standard almost disappears.",
        [
          "State the standard calmly and accept that a good fit can handle clarity.",
          "Do not let fear of loss write the terms for you."
        ],
        "Neediness creates bad deals in personal life too. When you hide your standard to keep the person, you usually keep the problem instead."
      ),
      example(
        "ch06-ex06",
        "Selling furniture online",
        ["personal"],
        "A buyer delays and lowballs, and you keep replying instantly because you want the item gone. The buyer senses the urgency and pushes even harder.",
        [
          "Keep a calm pace, state the terms, and let the buyer qualify themselves.",
          "Do not turn your urgency into the other person's bargaining power."
        ],
        "Leverage weakens when the other side can feel how badly you need the outcome. Calm standards protect value."
      ),
    ],
    directQuestions: [
      question(
        "ch06-q01",
        "What does neediness tell the room in Klaff's model?",
        [
          "That the speaker depends on this outcome more than the room depends on the offer",
          "That the speaker has prepared carefully",
          "That the offer is morally superior",
          "That the deal is moving quickly"
        ],
        0,
        "Neediness reveals dependence. Once the room sees that, leverage shifts fast."
      ),
      question(
        "ch06-q02",
        "Why is neediness so costly in a pitch or negotiation?",
        [
          "Because it always offends the audience",
          "Because it lowers scarcity and invites the other side to press for more",
          "Because it proves the speaker lacks technical skill",
          "Because it makes questions impossible"
        ],
        1,
        "Neediness changes perceived value and bargaining posture. It rewards the other side for squeezing."
      ),
      question(
        "ch06-q03",
        "What is a better response than fake indifference?",
        [
          "Talking faster so the room cannot hesitate",
          "Offering discounts before anyone asks",
          "Real standards, real options, and calm qualification of the other side",
          "Avoiding all direct asks"
        ],
        2,
        "The answer is not performance. It is genuine leverage built through standards, options, and self control."
      ),
      question(
        "ch06-q04",
        "What deeper lesson should stay with the reader here?",
        [
          "The loudest negotiator usually wins",
          "Any deal is worth taking if the timing is right",
          "Status matters more than fit",
          "Leverage is protected by self control before it is protected by tactics"
        ],
        3,
        "Tactics work better when the speaker is not emotionally trapped by the outcome. Inner control comes first."
      ),
    ],
  }),
  chapter({
    chapterId: "ch07-airport-case",
    number: 7,
    title: "See The Method In A Real Deal",
    readingTimeMinutes: 14,
    summary: {
      p1: t(
        "A live deal shows that Klaff's method works as a sequence, not as a checklist. In real negotiations, frame control, status, intrigue, and prize dynamics keep interacting, and the speaker has to adjust without losing the spine of the pitch.",
        "This is where the book stops feeling abstract. The reader sees how small moves early in the meeting shape later leverage, questions, and decision quality.",
        "The case matters because it reveals flow. The method is not a stack of slogans. It is a pattern of timing under pressure."
      ),
      p2: t(
        "This matters because many readers understand the individual tools and still miss how they fit together in motion. A real deal teaches where the meeting opens, where the frame gets tested, when interest spikes, and how the speaker protects value without rushing to close.",
        "The deeper lesson is that pitching is an adaptive sequence. You keep the structure, but you flex the move that best fits the room you are actually getting.",
        "In practice, this means studying live interactions for transitions, not just lines. The next level of skill comes from seeing the whole arc and learning where leverage was built or lost."
      ),
    },
    standardBullets: [
      bullet(
        "A case study turns theory into sequence. It shows how the parts of the method connect under real pressure.",
        "That is what makes the chapter memorable and practical."
      ),
      bullet(
        "The opening conditions shape the whole meeting. Early frame control changes what the audience listens for later.",
        "A weak start often creates expensive recovery work."
      ),
      bullet(
        "Status is tested in small moments. A real deal shows how tiny behaviors can preserve or leak authority.",
        "You rarely lose a room through one grand mistake."
      ),
      bullet(
        "Interest is built before detail. The case makes clear that proof lands better after the audience feels the value.",
        "Sequence is visible when you watch a live exchange."
      ),
      bullet(
        "Objections often reveal frame conflict, not just content gaps. What sounds like a factual issue may really be a control issue.",
        "That is why the speaker has to read the objection before answering it."
      ),
      bullet(
        "Prize and qualification keep leverage alive inside the meeting. The presenter is not just asking to be chosen.",
        "That balance helps the offer hold value as pressure rises."
      ),
      bullet(
        "Timing matters as much as talking points. Knowing when to press, when to pause, and when to shift frames changes the outcome.",
        "The same words can work differently at different moments."
      ),
      bullet(
        "Recovery is part of the skill. Real pitches get messy, and the case shows how to return to the spine without panic.",
        "Perfection is less important than clean recovery."
      ),
      bullet(
        "Listening is active diagnosis. The speaker is constantly reading signals about interest, tension, and leverage.",
        "A live deal rewards people who notice more than they speak."
      ),
      bullet(
        "The method's real lesson is integration. The tools gain force when they are used together in sequence.",
        "That is what the case makes visible."
      ),
    ],
    deeperBullets: [
      bullet(
        "Live deals are not linear. The meeting can move forward, stall, and reopen several times.",
        "That is why rigid scripts break down under real pressure."
      ),
      bullet(
        "Small moments can redirect the whole arc. A quick frame reset or a weak defensive answer can alter everything that follows.",
        "The case teaches leverage through timing."
      ),
      bullet(
        "Good listening is part of pitch control. Reading the room well tells you which tool matters next.",
        "Without diagnosis, technique becomes guesswork."
      ),
      bullet(
        "Recovery after pressure matters more than perfect scripting. Many strong meetings include awkward moments that get handled well.",
        "That should make the reader practice resilience, not fantasy smoothness."
      ),
      bullet(
        "Integration turns separate tools into a repeatable method. The case shows why structure and adaptation have to coexist.",
        "That is the bridge from understanding the book to using it."
      ),
    ],
    takeaways: [
      "Study the flow not just the lines",
      "Watch how the opening shapes later leverage",
      "Read objections before answering",
      "Use timing as a skill",
      "Recover cleanly under pressure",
      "Integration makes the method work",
    ],
    practice: [
      "Review live meetings for transitions and tests",
      "Mark where leverage rose or fell",
      "Practice returning to the spine after interruptions",
      "Listen for frame conflict inside objections",
    ],
    examples: [
      example(
        "ch07-ex01",
        "Board proposal under pressure",
        ["work"],
        "An executive pitches a new expansion plan to a board, gets early skepticism, and has to keep the meeting from becoming a pure risk review. The interesting part is not one line. It is how the executive keeps the sequence intact while adjusting to pressure.",
        [
          "Watch where the frame gets tested, where status is challenged, and how the speaker uses brief reframing instead of long defense.",
          "Model the sequence, not just the wording, in your own preparation."
        ],
        "A real deal teaches flow. The value comes from seeing how pressure changes the next move, not from memorizing isolated lines."
      ),
      example(
        "ch07-ex02",
        "Retainer negotiation",
        ["work"],
        "A freelancer moves from discovery call to proposal and the client tests timing, price, and fit in one conversation. Each pressure point is connected, so the speaker has to manage the whole arc instead of treating each moment separately.",
        [
          "Treat the exchange as one flowing pitch rather than as isolated mini talks.",
          "Protect leverage across the full sequence instead of solving each objection in isolation."
        ],
        "Live deals reward integration. A good answer at the wrong time can still weaken the whole meeting."
      ),
      example(
        "ch07-ex03",
        "Scholarship interview flow",
        ["school"],
        "A student knows the content of every answer but misses how the interview keeps shifting between rapport, challenge, and decision. The result feels uneven even though the information is strong.",
        [
          "Study the whole interaction, not just the words in each answer.",
          "Notice how openings, pauses, and frame shifts shape the result."
        ],
        "Seeing the method in motion teaches more than memorizing separate rules. Sequence is what turns content into performance."
      ),
      example(
        "ch07-ex04",
        "Club partnership meeting",
        ["school"],
        "Two student groups discuss a joint event, and the leader keeps solving immediate objections without protecting the main opportunity. The meeting gets busier while the deal gets weaker.",
        [
          "Track how the conversation moves and bring it back to the core value whenever the room fragments.",
          "Use the whole arc as your unit of control."
        ],
        "A live pitch is easy to lose through fragmentation. Integration keeps the meeting tied to the real decision."
      ),
      example(
        "ch07-ex05",
        "Housemate agreement",
        ["personal"],
        "Housemates negotiate rent split, chores, and move in date, and the conversation keeps jumping between leverage and emotion. Each jump changes the pressure on the next one.",
        [
          "Hold the main structure of the conversation while adjusting tactically inside it.",
          "Treat the deal as a sequence instead of as disconnected arguments."
        ],
        "Real negotiations are messy. This chapter matters because it teaches how to keep a spine while the room keeps moving."
      ),
      example(
        "ch07-ex06",
        "Family purchase decision",
        ["personal"],
        "Siblings discussing a major family purchase keep cycling through data, fairness, and emotion. The discussion has enough information, but not enough structure to turn information into a decision.",
        [
          "Watch which tool the room needs next and keep the conversation moving toward decision instead of endless loops.",
          "Use the whole pattern of the meeting, not just the next answer, as your guide."
        ],
        "The case study lesson transfers because many important conversations fail through poor sequence rather than lack of information."
      ),
    ],
    directQuestions: [
      question(
        "ch07-q01",
        "Why is a live deal useful for learning this method?",
        [
          "It shows how the tools interact under pressure rather than as isolated slogans",
          "It proves every pitch should follow one exact script",
          "It removes the need for preparation",
          "It turns every meeting into a price negotiation"
        ],
        0,
        "A real case reveals sequence, timing, and adjustment. That is what separate tips cannot fully show on their own."
      ),
      question(
        "ch07-q02",
        "In a real pitch, what do objections often reveal?",
        [
          "Only missing technical data",
          "Frame conflict, uncertainty, or status pressure as much as content gaps",
          "A need to talk longer",
          "A guaranteed failed deal"
        ],
        1,
        "Live objections usually carry social meaning too. Reading that meaning changes the best response."
      ),
      question(
        "ch07-q03",
        "What should you watch for when studying a strong real deal?",
        [
          "Whether the speaker uses the most slides",
          "How quickly the speaker gets to price",
          "How the speaker opens, shifts frames, times detail, and protects leverage",
          "Whether the speaker avoids every awkward moment"
        ],
        2,
        "The lesson sits in the transitions and responses, not in surface polish alone."
      ),
      question(
        "ch07-q04",
        "What deeper habit does the case study build?",
        [
          "Treat every live meeting as too unpredictable to study",
          "Focus only on the exact words that closed the deal",
          "Ignore timing and watch only substance",
          "See the pitch as a flowing sequence that you diagnose and adjust in motion"
        ],
        3,
        "The method becomes usable when you can read and steer the whole arc of the conversation."
      ),
    ],
  }),
  chapter({
    chapterId: "ch08-enter-the-game",
    number: 8,
    title: "Confidence Grows Through Repetition",
    readingTimeMinutes: 15,
    summary: {
      p1: t(
        "Klaff argues that real pitch confidence comes from repeated practice under live conditions, not from psyching yourself up. Repetition trains the opening, the frame shifts, and the emotional control that let the method hold when stakes rise.",
        "This final chapter turns the method from theory into habit. Confidence is treated as earned familiarity with pressure, not as a personality gift.",
        "That is why the book ends with action rather than with inspiration. The method only becomes natural after enough real reps."
      ),
      p2: t(
        "This matters because untested confidence collapses at the first hard question, while practiced structure frees you to read the room. Repetition gives you enough stability to stay flexible.",
        "The deeper lesson is that mastery is not memorizing the perfect script. It is being able to keep shape when the room stops cooperating.",
        "In practice, this means rehearsing aloud, stress testing likely objections, reviewing performance honestly, and using small real conversations as training ground for bigger ones."
      ),
    },
    standardBullets: [
      bullet(
        "Confidence is earned memory. It comes from seeing yourself handle the moment more than once.",
        "That is why real repetition beats positive self talk."
      ),
      bullet(
        "Practice should be verbal and live. Pitching is a performance skill, not only a thinking skill.",
        "You need your voice, pace, and recovery moves to get trained too."
      ),
      bullet(
        "Rehearse the opening until calm. The first minute carries extra weight, so it deserves extra reps.",
        "A stable opening makes the rest of the pitch easier to steer."
      ),
      bullet(
        "Train on objections, not only perfect conditions. The room teaches you most when it pushes back.",
        "Practice that never includes resistance leaves confidence fragile."
      ),
      bullet(
        "Review performance honestly. What felt strong in your head may have landed differently in the room.",
        "Feedback turns repetition into improvement."
      ),
      bullet(
        "Small repetitions compound. Everyday asks, updates, and proposals are all part of the training ground.",
        "You do not have to wait for a giant pitch to practice pitch method."
      ),
      bullet(
        "Use real conversations as reps. Live stakes teach timing and composure better than private fantasy alone.",
        "Pressure is part of the curriculum."
      ),
      bullet(
        "Pressure reveals weak spots. That is useful information, not proof that you are bad at pitching.",
        "The point is to see where the method still breaks."
      ),
      bullet(
        "Keep refining sequence, not just charisma. Better order and better recovery create more usable confidence than louder energy.",
        "Method compounds when you repeat the right structure."
      ),
      bullet(
        "Mastery looks like composure under challenge. The goal is not a perfect script. It is stable control when the room becomes unpredictable.",
        "That is the final form of pitch confidence."
      ),
    ],
    deeperBullets: [
      bullet(
        "Repetition only compounds when it includes feedback. Doing the same weak pattern more often does not create mastery.",
        "Deliberate review is what separates practice from habit."
      ),
      bullet(
        "Recorded review exposes weak signals you do not notice live. Pace, filler, overexplaining, and status leaks are easier to see after the fact.",
        "That honesty accelerates growth."
      ),
      bullet(
        "Small stakes reps prepare you for big rooms. Daily practice lowers the emotional weight of larger moments over time.",
        "Confidence grows through accumulation, not through one heroic event."
      ),
      bullet(
        "Practice builds emotional distance from any one outcome. Repeated exposure makes one meeting feel less absolute.",
        "That detachment strengthens both status and judgment."
      ),
      bullet(
        "The final goal is adaptive composure, not canned confidence. You want the method inside you deeply enough that you can stay flexible in motion.",
        "That is when repetition becomes mastery."
      ),
    ],
    takeaways: [
      "Confidence comes from reps",
      "Practice aloud and under pressure",
      "Train the opening hard",
      "Review what actually happened",
      "Use small moments as practice",
      "Mastery is composure under challenge",
    ],
    practice: [
      "Rehearse the first minute out loud",
      "Stress test likely objections",
      "Review one real pitch every week",
      "Use daily asks as live reps",
    ],
    examples: [
      example(
        "ch08-ex01",
        "Weekly sales calls",
        ["work"],
        "A founder reads about pitch strategy but still freezes when prospects interrupt. The problem is not lack of theory. It is lack of repeated live use.",
        [
          "Turn live calls into reps, review what broke, and rehearse the opening and key frame shifts before the next one.",
          "Treat repetition as the path to usable confidence."
        ],
        "Confidence grows when the body has evidence, not just the mind. Real repetition makes pressure more familiar and more manageable."
      ),
      example(
        "ch08-ex02",
        "Senior team update",
        ["work"],
        "An analyst knows the material but sounds tentative every month because each update feels like a fresh test. The content is stable, but the performance never gets trained.",
        [
          "Practice the opening aloud, rehearse likely objections, and refine after every meeting.",
          "Use repetition to remove avoidable uncertainty."
        ],
        "Practice turns recurring pressure into a trained setting. Without reps, every meeting keeps feeling brand new."
      ),
      example(
        "ch08-ex03",
        "Debate prep",
        ["school"],
        "A student studies arguments alone and feels confident until live rebuttal begins. The logic is there, but the timing and recovery skills are untested.",
        [
          "Practice with interruptions, time pressure, and real pushback.",
          "Use live conditions to train what solo review cannot."
        ],
        "Pressure reveals which parts of the method are actually internalized. Repetition under strain builds the missing layer."
      ),
      example(
        "ch08-ex04",
        "Interview rehearsal",
        ["school"],
        "An intern candidate memorizes answers but loses flow when the conversation becomes less scripted. The problem is not knowledge. It is that practice never included movement.",
        [
          "Rehearse themes, transitions, and recovery moves rather than only exact lines.",
          "Build flexible confidence through varied repetition."
        ],
        "Real confidence is not memorized perfection. It is the ability to stay clear when the conversation takes a different path."
      ),
      example(
        "ch08-ex05",
        "Hard boundary conversation",
        ["personal"],
        "You know what you need to say to a friend but keep postponing because you want the first attempt to be perfect. The delay keeps making the conversation feel heavier.",
        [
          "Practice the first two minutes out loud and accept that clean repetition beats fantasy confidence.",
          "Use rehearsal to lower the emotional cost of starting."
        ],
        "Many people wait to feel ready before they act. Klaff's point is that readiness often comes from action repeated enough times."
      ),
      example(
        "ch08-ex06",
        "Landlord request",
        ["personal"],
        "You need to ask a landlord about a lease change and you keep rewriting the message instead of sending it. The request keeps feeling bigger because it never enters the real world.",
        [
          "Use the method in small real situations and build evidence that you can handle response.",
          "Enter the game instead of rehearsing only in your head."
        ],
        "Confidence grows from contact with reality. Repetition turns imagined risk into practiced experience."
      ),
    ],
    directQuestions: [
      question(
        "ch08-q01",
        "Where does real pitch confidence come from in this method?",
        [
          "Repeated practice under real conditions, not self hype alone",
          "One perfect high stakes performance",
          "Avoiding situations that feel uncomfortable",
          "Memorizing the longest possible script"
        ],
        0,
        "Klaff ends by locating confidence in repetition. Real reps teach the body and the mind how to hold pressure."
      ),
      question(
        "ch08-q02",
        "Why should practice happen out loud rather than only in your head?",
        [
          "Because speaking aloud automatically wins status",
          "Because delivery, pace, and recovery are performance skills as much as intellectual ones",
          "Because written notes are useless",
          "Because live rooms never interrupt"
        ],
        1,
        "Pitching uses voice, timing, and composure. Those skills do not fully train through silent review."
      ),
      question(
        "ch08-q03",
        "What kind of practice builds the most usable confidence?",
        [
          "Practice that avoids difficult questions",
          "Practice that focuses only on charisma",
          "Practice that includes objections, timing pressure, and honest review",
          "Practice that happens only right before the big meeting"
        ],
        2,
        "Pressure plus review turns repetition into growth. Easy rehearsal alone leaves confidence fragile."
      ),
      question(
        "ch08-q04",
        "What deeper lesson remains at the end of the book?",
        [
          "A great pitch depends mostly on personality",
          "Preparation matters only for beginners",
          "The room should always follow the script you wrote",
          "Mastery is the ability to stay clear and adaptive when the room stops cooperating"
        ],
        3,
        "The method ends in adaptive composure. The goal is not rigid performance but confident control under real variation."
      ),
    ],
  }),
];

function rotate(array, by) {
  const shift = ((by % array.length) + array.length) % array.length;
  return array.map((_, index) => array[(index + shift) % array.length]);
}

function buildScenarioQuestions(chapterNumber, examples) {
  return examples.map((ex, index) => {
    const correct = ex.whatToDo[0];
    const wrongIndexes = [
      (chapterNumber + index) % SCENARIO_WRONG_BANK.length,
      (chapterNumber + index + 2) % SCENARIO_WRONG_BANK.length,
      (chapterNumber + index + 5) % SCENARIO_WRONG_BANK.length,
    ];
    const rawChoices = [
      correct,
      SCENARIO_WRONG_BANK[wrongIndexes[0]],
      SCENARIO_WRONG_BANK[wrongIndexes[1]],
      SCENARIO_WRONG_BANK[wrongIndexes[2]],
    ];
    const choices = rotate(rawChoices, (chapterNumber + index) % 4);
    const correctIndex = choices.indexOf(correct);

    return question(
      `ch${String(chapterNumber).padStart(2, "0")}-sq${index + 1}`,
      `${ex.scenario} What is the strongest next step?`,
      choices,
      correctIndex,
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

  lines.push("# 1. Book audit summary for Pitch Anything — Oren Klaff", "");
  AUDIT_SUMMARY.forEach((paragraph) => lines.push(sentence(paragraph), ""));

  lines.push("# 2. Main content problems found", "");
  MAIN_PROBLEMS.forEach((paragraph, index) => lines.push(`${index + 1}. ${sentence(paragraph)}`));
  lines.push("");

  lines.push("# 3. Personalization strategy for Pitch Anything — Oren Klaff", "");
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
  lines.push("4. The repeated template prose, recycled scenarios, and generic quiz wrappers were replaced book wide.");
  lines.push("5. The package stays schema compatible while the reader can apply Pitch Anything specific motivation styling.");
  lines.push("6. The revised book now reads as a guided lesson rather than a generated placeholder.");
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
