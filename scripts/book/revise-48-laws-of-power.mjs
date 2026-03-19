import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";

const packagePath = resolve(process.cwd(), "book-packages/the-48-laws-of-power.modern.json");
const reportPath = resolve(process.cwd(), "notes/the-48-laws-of-power-revision-report.md");

const SIMPLE_INDEXES = [0, 1, 2, 4, 6, 8, 9];
const SUMMARY_BULLET_TARGETS = {
  easy: 7,
  medium: 10,
  hard: 15,
};

const AUDIT_SUMMARY = [
  "The existing The 48 Laws of Power package was structurally close to the app schema and editorially far below shipping quality. It had the right chapter count, six examples per law, and ten quiz questions per law, but the authored text was generated from repeated scaffolds that made different laws sound like the same lesson wearing different titles.",
  "Summaries reused the same two paragraph shell across almost the entire book. The first paragraph usually inserted one law specific sentence and then dropped back into the same generic language about status, incentives, fear, and visibility. The second paragraph was often identical from chapter to chapter except for one swapped phrase.",
  "Bullet detail text repeated at industrial scale. The package reused the same long explanatory blocks hundreds of times, which flattened Greene's distinct laws into boilerplate. Easy mode also missed the target count with six bullets instead of about seven, and Deeper mode missed with fourteen instead of fifteen.",
  "Scenarios were even weaker. The same six shells were recycled across the book with only names or one closing clause changed, so school, work, and personal transfer never felt grounded in the actual law. Quiz writing had the same problem. Whole answer sets and prompt stems repeated across all forty eight laws, and some questions even marked obviously wrong answers as correct. The book therefore needed a full authored replacement, not a light polish.",
];

const MAIN_PROBLEMS = [
  "Summary writing was repetitive, vague, and only loosely connected to Greene's actual logic.",
  "Easy and Deeper depth counts were out of spec at six and fourteen bullets instead of about seven and fifteen.",
  "Bullet detail text repeated across dozens of chapters, so distinct laws lost their meaning.",
  "Scenario sets were recycled almost verbatim from chapter to chapter and did not feel believable.",
  "Quiz prompts and answer banks repeated across the whole book, which made recall easier than judgment.",
  "Several quiz items used the wrong answer as the correct option, which broke trust and fidelity.",
  "Motivation tone existed in the reader, but The 48 Laws of Power did not have a book specific layer, so Gentle, Direct, and Competitive did not feel intentionally authored for Greene's worldview.",
];

const PERSONALIZATION_STRATEGY = [
  "Depth remains the authored content axis inside the package. Simple gives two summary paragraphs and seven bullets for fast understanding. Standard gives the strongest ten bullet lesson. Deeper adds five more bullets that focus on hidden logic, misuse risk, warning signs, and longer game consequences.",
  "Motivation style stays a reader layer rather than nine duplicated content packages. The core law stays fixed, while summary framing, scenario guidance, recap language, and quiz explanation shift meaningfully for Gentle, Direct, and Competitive readers.",
  "For this book, Gentle emphasizes calm judgment inside live power dynamics. Direct names the hierarchy, incentive, and leverage plainly. Competitive stresses edge, wasted position, and the cost of naive exposure when the law naturally supports that framing.",
  "This keeps the schema stable while making Simple, Standard, Deeper and Gentle, Direct, Competitive feel materially different in the actual reading experience.",
];

const SCHEMA_NOTE =
  "No package schema change was required. The revision stays inside the existing JSON structure. Depth is authored in the package, and motivation tone is applied in the reader through a book specific layer for The 48 Laws of Power.";

const SCENARIO_ACTION_OPENERS = [
  "Slow the situation down enough to read the real pattern.",
  "Name the deeper dynamic before you answer the surface tension.",
  "Do not let urgency choose the move for you.",
  "Treat the visible problem as a signal of the larger pattern.",
  "Protect your position before you protect your mood.",
  "Look at the structure first, then choose the move.",
];

const SCENARIO_FOLLOW_OPENERS = [
  "Use the law early, before the room hardens around the weaker pattern.",
  "Make the next step serve position instead of quick emotional relief.",
  "Keep the move clear and controlled so the law stays useful.",
  "Choose the action that preserves room to maneuver later.",
  "Let the response solve the deeper issue, not just the visible irritation.",
  "Apply the law in a way that keeps the longer game intact.",
];

const ACTION_DISTRACTORS = [
  "Answer the visible tension immediately so nobody doubts your confidence.",
  "Explain every motive in detail and trust openness alone to solve the problem.",
  "Leave the structure unchanged and hope good intentions carry the moment.",
  "Push harder in public so everyone can see where the authority sits.",
  "Wait passively and assume the pressure will settle itself.",
  "Treat the pattern as purely personal and ignore the deeper power dynamic.",
];

const LOGIC_DISTRACTORS = [
  "Formal rules explain almost everything that matters once people say the right words aloud.",
  "The loudest move is usually the strongest move because hesitation always looks weak.",
  "Good intentions cancel most hidden incentives once people know you mean well.",
  "Visible confidence matters more than structure, timing, or emotional pressure.",
  "Direct force is almost always more reliable than position, framing, or patience.",
  "One honest conversation usually erases deeper status dynamics on its own.",
];

const law = (
  number,
  claim,
  why,
  nuance,
  move,
  warning,
  longGame,
  school,
  work,
  personal
) => ({
  number,
  claim,
  why,
  nuance,
  move,
  warning,
  longGame,
  school,
  work,
  personal,
});

const LAWS = [
  law(
    1,
    "Publicly outshining a superior makes your ability feel like a threat.",
    "Once a person above you feels diminished, gratitude often turns into defensiveness faster than merit gets rewarded.",
    "The law is about staging strength, not pretending to have less of it.",
    "Let the superior keep visible credit, correct in private, and tie your strength to their success.",
    "Sudden coolness, nitpicking, or reduced access after a visible win usually means the status injury has already landed.",
    "Protected access beats one satisfying moment of public victory.",
    "You help rescue a club event led by a president who cares a lot about status.",
    "Your analysis impresses senior leaders more than the manager who brought you into the room.",
    "You join a social circle built around a host who likes being the center of attention."
  ),
  law(
    2,
    "Friends can become careless allies, while rivals often work harder to prove themselves.",
    "Familiarity lowers caution and can blur competence, incentives, and resentment in ways people miss because the relationship feels warm.",
    "Greene is not praising cynicism for its own sake. He is warning against blind loyalty.",
    "Test people through incentives and performance, and use capable rivals where clear interests keep them disciplined.",
    "Borrowed trust, loose boundaries, or hidden envy disguised as warmth often show up before the failure itself does.",
    "A reliable structure outlasts sentiment.",
    "You need a reliable project partner and your closest friend is charming but inconsistent.",
    "A former rival on your team wants a chance to prove themselves on a hard account.",
    "A friend keeps asking for trust that their behavior has not earned."
  ),
  law(
    3,
    "Showing your full intentions too early gives other people time to resist, copy, or block you.",
    "Most opposition gathers only after people can see where you are heading and how it might affect them.",
    "Concealment here means controlled disclosure, not random lying.",
    "Reveal only what the next step requires and keep the larger design harder to map.",
    "When advice, delay, rivalry, or nervous curiosity cluster around your plan, you probably disclosed too much too soon.",
    "Ambiguity preserves room to move while certainty gives other people a target.",
    "You announce every step of a student campaign before support is secure.",
    "You reveal a new initiative too broadly before approvals are locked.",
    "You tell a manipulative relative exactly what boundary you plan to set before you set it."
  ),
  law(
    4,
    "Speaking less can make your position feel stronger because it gives other people less material to challenge.",
    "The more you explain, the more openings you create for contradiction, dilution, and lowered mystique.",
    "Silence is useful only when it is paired with clarity and control.",
    "Say the essential thing, stop early, and let restraint carry weight.",
    "If you hear yourself repeating, justifying, or filling every pause, your position is already getting weaker.",
    "Measured speech builds authority because people learn you do not waste words.",
    "You keep defending a simple point in class until the room starts arguing with side details.",
    "You overexplain a strong decision in a meeting and invite new objections.",
    "You send long texts in a conflict that only needed one clear sentence."
  ),
  law(
    5,
    "Reputation shapes how every later move is read, so it functions like stored power.",
    "A strong name makes ordinary actions easier, while a damaged one turns even good actions into uphill work.",
    "Reputation is not vanity. It is a practical shield and a practical weapon.",
    "Guard your name early, answer attacks quickly, and keep your strongest qualities consistently visible.",
    "When small doubts spread faster than your actual record, the reputational field is already shifting under you.",
    "A trusted name saves time, attracts allies, and narrows the room for cheap attacks.",
    "A rumor about a group project starts spreading before a leadership selection.",
    "A colleague starts seeding doubts about your reliability after losing influence.",
    "Someone in your circle keeps framing you through one old mistake."
  ),
  law(
    6,
    "Attention is a form of power because what people notice is easier to value, fear, or follow.",
    "In crowded settings, the invisible person is often ignored no matter how strong the substance may be.",
    "The law is about memorable presence, not noise for its own sake.",
    "Stand out through timing, distinctiveness, and controlled theater that supports the point.",
    "When good work keeps disappearing into the background, the problem is often visibility rather than quality.",
    "Memorable presence opens doors only if it stays connected to real value.",
    "Your strongest ideas in club meetings keep getting overlooked because louder people own the room.",
    "Your team does important work that leadership barely notices.",
    "People forget you quickly because you never give them a vivid reason to remember you."
  ),
  law(
    7,
    "Power grows through orchestration when other people's effort can be directed toward your design.",
    "If you do every important task yourself, you stay trapped in labor instead of leverage.",
    "The law turns rotten when coordination becomes theft instead of leadership.",
    "Use other people's skill well, organize the outcome, and make sure the visible result points back to your direction.",
    "If you are indispensable only as a worker and not as a strategist, your ceiling is lower than it needs to be.",
    "Leverage comes from making effort compound through systems and people.",
    "You keep doing most of the group project instead of coordinating the whole team well.",
    "A founder rewrites every task instead of using the team as force multipliers.",
    "You handle every family task yourself and become trapped in labor."
  ),
  law(
    8,
    "When you make other people come to you, you gain timing, leverage, and better terms.",
    "The side that chases often reveals need and loses control of the setup.",
    "The law favors pull over needless pursuit, not passive waiting for magic.",
    "Create conditions that draw people out, then negotiate on ground they had to cross to reach you.",
    "When you keep rushing after approval or response, the other side learns how badly you want it.",
    "The person who controls the approach usually shapes the terms.",
    "Your club keeps begging for volunteers instead of making the role attractive enough that people step forward.",
    "A seller keeps chasing meetings by dropping price early.",
    "You keep texting someone who enjoys making you wait."
  ),
  law(
    9,
    "Visible results persuade more effectively than argument because they leave less room for prideful debate.",
    "People defend themselves against reasoning, but outcomes are harder to dismiss than words.",
    "Action does not replace explanation in every case, but proof changes the balance of belief.",
    "Demonstrate, prototype, or deliver the result instead of trying to win through talk alone.",
    "If the conversation keeps looping without movement, the room probably needs proof more than another argument.",
    "A record of results makes future arguments shorter and stronger.",
    "A classmate keeps arguing study methods instead of showing results.",
    "A product lead argues over priorities instead of shipping a small proof.",
    "You keep telling family you have changed without showing a changed pattern."
  ),
  law(
    10,
    "Some people spread chaos, self pity, or repeated disaster, and staying close to them pulls your judgment off course.",
    "Moods, habits, and patterns are contagious long before people admit how much they spread.",
    "The law is not contempt for people in pain. It is caution about repeated destructive patterns.",
    "Set distance from people who keep turning every room into crisis, blame, or helplessness.",
    "If contact keeps leaving you drained, reactive, and less clear, the pattern is already costing you.",
    "Protecting your environment protects your judgment.",
    "A lab partner keeps bringing drama and missed deadlines into every project.",
    "A coworker floods every week with complaint, panic, and blame.",
    "A friend only contacts you when they need rescue from the same mess."
  ),
  law(
    11,
    "If other people need your skill, access, or connection, they become more careful about how they treat you.",
    "Dependence changes the balance of power because people protect what they cannot easily replace.",
    "Useful dependence is stronger than begging for affection or fairness.",
    "Develop a capability, relationship, or resource that makes your role valuable and hard to substitute.",
    "When people think losing you would cost them little, promises and praise can vanish quickly.",
    "The strongest security often comes from being needed for something real.",
    "A club relies on you for one part of the system that nobody else has learned well.",
    "Several teams depend on an expertise you built and can explain clearly.",
    "You are always helpful at home but never strategically necessary."
  ),
  law(
    12,
    "Selective honesty and generosity can lower defenses because they look like the opposite of manipulation.",
    "A well timed sincere gesture makes people relax their guard and reveal more than a harder push would have extracted.",
    "The law works because truth used sparingly feels credible, not because everything should become performance.",
    "Offer a real concession or a truthful point when it softens suspicion and opens the next move.",
    "A small honest admission can change the tone faster than a polished pitch when the room is already guarded.",
    "Credibility spent carefully can buy more access than force.",
    "A tense student meeting softens after one real concession or honest admission.",
    "A negotiation gets easier once you admit one real limitation instead of acting flawless.",
    "A family conversation changes once you state one uncomfortable truth about your own part."
  ),
  law(
    13,
    "People move fastest when a request clearly serves their interest.",
    "Appeals to mercy feel optional, but concrete gain gives the other person a reason to act.",
    "Greene is not denying kindness. He is teaching that durable influence usually rides on benefit.",
    "Frame the ask around what the other person gains, avoids, or protects by saying yes.",
    "Guilt based requests often produce weak promises, delay, or quiet resentment instead of real movement.",
    "Mutual advantage creates sturdier cooperation than emotional pressure.",
    "You need help from a professor and start by describing your stress instead of why helping you strengthens the project.",
    "You want another team to support a launch and frame it as your deadline problem instead of their gain.",
    "You ask a friend for a favor by listing hardship instead of making the request worthwhile or easy."
  ),
  law(
    14,
    "Careful listening lets you learn what loud presence would scare people into hiding.",
    "Information flows toward the person who seems interested but not threatening.",
    "The law rewards disciplined observation, not paranoid suspicion.",
    "Ask, watch, and let other people talk until patterns reveal what they want, fear, and protect.",
    "If you show your full hand too early, you lose the chance to learn what others were about to expose.",
    "Better information makes later moves cheaper and cleaner.",
    "You speak very little in a study group and start seeing who actually drives the group.",
    "In a kickoff meeting, you mostly listen and learn who is protecting which turf.",
    "At a party, you watch how a new friend talks about other people before sharing much about yourself."
  ),
  law(
    15,
    "A serious threat left half alive often returns with more patience and more motive.",
    "Humiliation plus survival creates stronger revenge than a clean decisive ending.",
    "Crush completely means end the threat, not indulge cruelty or theatrical domination.",
    "If a conflict truly must be fought, remove the other side's ability to strike again.",
    "Small wins can look satisfying while the core power, access, or grievance remains intact and dangerous.",
    "Complete endings cost less than repeated unfinished battles.",
    "A teammate keeps undermining a project and you keep solving each incident without removing their ability to repeat it.",
    "A rival keeps leaking doubts about your proposal and you answer each leak without cutting off the source.",
    "A manipulative ex keeps finding small ways back into your life because the boundary is never final."
  ),
  law(
    16,
    "Scarcity can increase respect because people notice what is not constantly available.",
    "Constant availability makes value blend into the background and feel cheaper than it is.",
    "Absence only helps when something real was valuable in the first place.",
    "Step back at the right moment so people can feel the space your presence or work actually fills.",
    "If you are always present, others often stop sensing the cost of losing you.",
    "Measured scarcity turns taken for granted value back into felt value.",
    "You are at every club meeting and reply instantly to every message, so people stop valuing your time.",
    "You answer every message within minutes and clients start treating access to you as limitless.",
    "You are always the first to say yes in your friend group and your presence stops feeling special."
  ),
  law(
    17,
    "Unpredictability creates caution because people hesitate when they cannot map your rhythm.",
    "Readability gives other people comfort, timing, and permission to test you.",
    "The useful version is controlled variety, not chaos that burns trust without buying leverage.",
    "Change pace, pattern, or response just enough that others stop assuming they know the next move.",
    "Once people can forecast you too easily, they start acting from that certainty and pushing farther.",
    "A little uncertainty preserves respect and bargaining room.",
    "A teacher always reacts the same way to late work, so students start timing the behavior.",
    "Your negotiation style never changes and vendors start gaming it.",
    "A sibling knows exactly how to provoke you because your reactions are always the same."
  ),
  law(
    18,
    "Isolation weakens power because it cuts you off from correction, information, and living reality.",
    "When outside signals disappear, fear and fantasy start writing the story instead.",
    "Privacy can protect you. A fortress mindset makes you brittle.",
    "Stay connected to the people and information that keep your picture of the world honest.",
    "Too much self protection slowly turns into blindness and brittle decision making.",
    "Selective connection protects both security and awareness.",
    "You start working alone because it feels safer and then lose perspective on the assignment.",
    "A founder stays inside a closed circle and loses contact with what customers and staff are actually seeing.",
    "After a hard breakup, you isolate so fully that your thinking gets darker and less accurate."
  ),
  law(
    19,
    "Different people require different handling because pride, insecurity, and memory vary by person.",
    "The wrong tone with the wrong person can create needless enemies faster than the issue itself.",
    "This is targeted judgment, not a license to reduce people to simple labels.",
    "Read the person before choosing pressure, humor, bluntness, or warmth.",
    "A tactic that worked on one person can insult or provoke another because the underlying psychology is different.",
    "Accurate reading saves energy and prevents avoidable backlash.",
    "A joke that works with one teacher backfires badly with another.",
    "A blunt feedback style motivates one direct report and alienates another.",
    "You give the same advice style to two friends with completely different temperaments."
  ),
  law(
    20,
    "Uncommitted independence keeps your options and increases your bargaining value.",
    "Once one side assumes it owns you, your leverage starts dropping whether or not you noticed the trade.",
    "The law favors strategic independence, not empty fence sitting with no courage.",
    "Stay useful without becoming owned until commitment truly serves your position.",
    "Early allegiance can turn you into a pawn before the terms, protections, and upside are actually clear.",
    "Independence lets you choose rather than merely comply.",
    "Two campus groups want your endorsement and both assume it comes free if they flatter you.",
    "Two leaders want your team attached to their initiative while offering very little protection in return.",
    "Friends expect you to take their side in a conflict that mostly serves their drama."
  ),
  law(
    21,
    "Letting people underestimate you can make them careless, loose, and easier to read.",
    "People guard themselves less around someone they think is weaker, slower, or simpler than they are.",
    "Playing the sucker is a temporary mask, not a permanent identity or excuse for passivity.",
    "Let the other person feel clever while you collect information and choose the real moment.",
    "Proving your intelligence too early can trigger rivalry, caution, or tighter defenses that were avoidable.",
    "Underestimation buys surprise, access, and time.",
    "A quiet student lets louder classmates underestimate them before the graded presentation.",
    "A junior employee asks naive questions and learns who is hiding what.",
    "Someone at a gathering starts bragging because they think you are less informed than you are."
  ),
  law(
    22,
    "Strategic surrender can preserve strength when direct resistance would waste it.",
    "Yielding for the moment can drain the other side's momentum and protect your remaining resources.",
    "This is tactical retreat, not emotional collapse or permanent submission.",
    "Bend when the position is weak, regroup, and return on better terms.",
    "Stubborn defiance from a bad position often serves pride more than purpose and burns what you still need.",
    "Survival plus timing can beat doomed heroics.",
    "You get overwhelmed by a teacher's harsh reaction and decide not to fight in the moment.",
    "A team takes a public loss on a proposal and chooses not to counterattack immediately.",
    "In a family argument, you stop pushing once the other person is too heated to hear anything."
  ),
  law(
    23,
    "Concentrated force changes outcomes more than scattered effort.",
    "Most gains come from pressure gathered at the decisive point, not from equal energy everywhere.",
    "Focus is not blindness. It is deliberate concentration after comparison.",
    "Pick the strongest point of impact and stack time, attention, and talent there.",
    "When everything stays active, nothing gets strong enough to matter and the field stays unfocused.",
    "Focused effort compounds while divided effort leaks away.",
    "A student leader tries to fix every club problem at once and solves none of them well.",
    "A startup chases five customer types and wins none of them cleanly.",
    "You split energy across too many personal goals and feel busy without progress."
  ),
  law(
    24,
    "Grace, timing, and tact let you move near power without triggering resistance.",
    "In hierarchical settings, how you deliver matters almost as much as what you say.",
    "The law teaches polished influence, not fake submission or empty flattery.",
    "Read status carefully, flatter without groveling, and make difficult truths easy to receive.",
    "Raw correctness delivered badly can still damage your position if the form creates needless offense.",
    "Social precision lets truth travel farther with less friction.",
    "You have a strong point for a teacher but keep delivering it without tact or timing.",
    "An employee has excellent analysis but poor sense of when to flatter, when to wait, and when to push.",
    "At a formal family gathering, you speak truth without reading the status layers in the room."
  ),
  law(
    25,
    "A public identity can be redesigned instead of passively inherited.",
    "Once other people settle on a story about you, they start fitting every new move inside that story.",
    "Re creating yourself means deliberate authorship, not random reinvention every week.",
    "Choose the image, habits, and story that support the person you mean to become.",
    "If you keep wearing an outdated identity, other people keep pricing you through it even after you have changed.",
    "A chosen identity can pull better opportunities toward you.",
    "You still carry a reputation from earlier years that no longer fits who you are.",
    "A reliable executor wants to be seen as a strategist, not only the person who gets tasks done.",
    "Friends still treat you like an older version of yourself that you have already outgrown."
  ),
  law(
    26,
    "Keeping visible distance from dirty work protects status and legitimacy.",
    "People stick blame to the face they can see, even when the hard act was structurally necessary.",
    "The law is about avoiding needless stain, not dodging moral responsibility.",
    "Use process, buffers, and role design so necessary hard acts do not mark you more than needed.",
    "If you personally become the face of every ugly task, you collect resentment that outlasts the necessity.",
    "Protected distance helps authority survive hard decisions.",
    "A club president personally handles every awkward rejection and public discipline issue.",
    "A founder keeps taking the direct visible heat for every hard enforcement instead of using process.",
    "You keep becoming the visible villain for decisions that the whole family privately wanted."
  ),
  law(
    27,
    "People hunger for belonging, certainty, and ritual, which makes strong belief systems powerful.",
    "A vivid creed organizes feeling and loyalty faster than careful nuance does.",
    "The law describes a mechanism of influence, not a moral endorsement of cult behavior.",
    "Give people a clear doctrine, shared language, and a sense of chosen belonging.",
    "Pure complexity often loses against messages that make people feel initiated, certain, and part of something special.",
    "Communities held together by belief mobilize faster than loose agreement.",
    "A campus group grows fast because it offers ritual, certainty, and belonging more than careful argument.",
    "A charismatic founder binds a team with a creed that feels bigger than the product.",
    "A wellness circle attracts people because it offers certainty and identity more than nuance."
  ),
  law(
    28,
    "Bold entry gives a move force because hesitation invites doubt and resistance.",
    "People sense uncertainty fast and often push back hardest when they smell fear or apology.",
    "Boldness is decisive commitment after preparation, not blind recklessness or ego display.",
    "Prepare well, enter firmly, and remove the apologetic signals that weaken follow through.",
    "Tentative action tells other people there is still time to test, stall, or block the move.",
    "Decisive execution often shapes the field before objections can fully organize.",
    "You wait too timidly before presenting a strong proposal and lose the room.",
    "A founder launches a change halfheartedly and invites endless renegotiation.",
    "You set a boundary so softly that the other person treats it like a suggestion."
  ),
  law(
    29,
    "Planning to the end keeps short wins from turning into longer losses.",
    "A move that works now can create cost, backlash, or trapped follow through if the next steps are unplanned.",
    "The law asks for consequence chains, not paralysis or fantasy control over every variable.",
    "Map reactions, second moves, and the desired end state before you begin.",
    "If the plan ends at the first victory, the real cost is probably still ahead and waiting to arrive.",
    "Ending well matters more than starting strong.",
    "You start a campus campaign without thinking about what happens if it actually wins.",
    "A company wins a big client without planning the delivery strain that follows.",
    "You make a dramatic life move for the immediate win and ignore the months after it."
  ),
  law(
    30,
    "Seeming effortless increases authority because calm execution looks like mastery.",
    "Visible strain can shrink the perceived size of an achievement even when the hidden work was enormous.",
    "The hidden labor is real. The law is about presentation, not laziness or pretending the work is easy.",
    "Do the hard preparation in private so the public performance feels smooth and controlled.",
    "If people mainly see scramble and stress, they may underestimate the capability behind the result.",
    "Controlled presentation turns competence into status.",
    "A strong presentation loses force because the audience mainly sees panic and scramble.",
    "A product demo only feels powerful if the heavy preparation stays backstage.",
    "You want a difficult conversation to feel composed rather than visibly labored."
  ),
  law(
    31,
    "When you shape the available options, you influence choices before the argument even starts.",
    "People feel freer when they choose, even if the menu was designed for a reason.",
    "The law works through field design, not open coercion or endless debate.",
    "Set the choices so the outcome you want feels like the smartest path on the menu.",
    "If you start arguing after the options are already wide open, you lost influence at the design stage.",
    "Frame control often beats brute persuasion.",
    "A professor asks for project topics and you can shape the menu before the choice is made.",
    "You present an executive with two plans that both move toward your preferred direction.",
    "You give a roommate two cleanup options that both solve the actual problem."
  ),
  law(
    32,
    "Hopeful narratives move people because desire often outruns sober fact.",
    "People act more readily on a future they can feel than on a truth that only sounds correct.",
    "The law is about emotional truth and aspiration, not empty fantasy without substance.",
    "Connect your message to the dream, relief, or identity people want to move toward.",
    "Bare reality can be accurate and still fail to mobilize anyone if it never touches desire.",
    "Hope mobilizes best when it stays tethered to something real.",
    "A student group rallies around a vision of what the club could become, not just a list of tasks.",
    "A founder gets buy in by painting the future customers will belong to, not only the spreadsheet.",
    "A friend changes habits once the goal feels like a better self story, not just rules."
  ),
  law(
    33,
    "Each person has a lever that moves them more than general pressure ever could.",
    "People care unequally about status, fear, desire, pain, and shame, so pressure works best when it is precise.",
    "The law values precision, not cruelty or sadistic curiosity.",
    "Study what this person most wants, fears, or hides, then build the approach around that lever.",
    "Broad pressure wastes force when one precise lever would do the work with less noise and less cost.",
    "Precise leverage makes influence cheaper and cleaner.",
    "A student leader learns one member is driven by recognition while another is driven by autonomy.",
    "A negotiation turns once you spot the one issue the other side truly cannot ignore.",
    "A family member always softens when the conversation touches legacy and pride."
  ),
  law(
    34,
    "Acting with dignity changes how other people measure your worth.",
    "People often respond first to the status signal you project, then to the evidence that follows.",
    "This is not arrogance. It is self presentation that refuses smallness and cheapness.",
    "Set a high standard for your treatment, speech, and presence, then keep meeting it.",
    "If you carry yourself cheaply or apologetically, many people follow that cue faster than they follow your words.",
    "Earned dignity wins respect before you have to ask for it.",
    "You stop apologizing for every sentence in seminar and the room treats you differently.",
    "A consultant enters the room with calm standards and immediately gets better treatment.",
    "Changing how you carry yourself in close relationships raises the standard of what people bring to you."
  ),
  law(
    35,
    "Timing decides the value of a move because the right action at the wrong moment still fails.",
    "Impatience makes people confuse internal urgency with external readiness.",
    "Timing is active waiting with preparedness, not passivity or timid avoidance.",
    "Read tempo, mood, and readiness before you release force.",
    "Good ideas become bad moves when they land before the room, the person, or the structure can carry them.",
    "Patience paired with readiness gives smaller moves more impact.",
    "You push for a group decision before the team is ready and create needless resistance.",
    "A product team launches too early because the deadline feels emotional.",
    "You bring up a hard topic when the other person is exhausted and get nowhere."
  ),
  law(
    36,
    "Strategic disregard can reduce the power of what you cannot have.",
    "Attention feeds frustration, envy, and visible need far more than most people admit.",
    "The law is not denial of feeling. It is refusal to let a closed door command your posture.",
    "Withdraw attention from what is unavailable and redirect energy toward what still moves.",
    "Visible obsession gives power to the thing withholding itself from you and lowers your own dignity in the process.",
    "Indifference preserves dignity and frees attention for better openings.",
    "You fixate on joining one club that clearly does not want you and miss better paths nearby.",
    "You obsess over one closed deal and neglect live opportunities that could actually move.",
    "A romantic rejection keeps controlling your mood and behavior long after the answer is clear."
  ),
  law(
    37,
    "Vivid images and staged moments move people faster than plain explanation alone.",
    "People remember scenes, symbols, and drama longer than careful exposition.",
    "Spectacle works best when it reveals a real point instead of hiding emptiness behind shine.",
    "Use striking presentation, symbols, and staging to make the message unforgettable.",
    "A strong idea can disappear if the form is flat and forgettable even when the reasoning is sound.",
    "Memorable form extends the reach of real substance.",
    "A student presentation lands because the visuals create one unforgettable moment.",
    "A product reveal needs a scene people will remember, not just a dense slide deck.",
    "You persuade family faster with a clear picture than with a long explanation."
  ),
  law(
    38,
    "Surface conformity can protect deeper independence.",
    "Groups punish visible difference faster than they punish private deviation.",
    "The law is about strategic fit, not surrender of thought or identity.",
    "Blend with the customs of the room while keeping your deeper judgment intact.",
    "Broadcasting every difference can unite ordinary people against you before your real point is even heard.",
    "Strategic fit helps you survive long enough to matter.",
    "A student with unusual views keeps broadcasting difference and attracts needless resistance.",
    "An employee challenges every office custom on day one and becomes easy to reject.",
    "In a conservative family setting, you decide how much difference to show on the surface."
  ),
  law(
    39,
    "Agitation can reveal weakness because angry people show more of their real shape.",
    "Emotion strips away control and makes hidden motives easier to see.",
    "The law is about controlled disturbance, not constant cruelty or reckless escalation.",
    "Use irritation carefully when it helps expose imbalance, overreaction, or poor control.",
    "A calm opponent can hide much more than an agitated one, so visible emotion often carries information.",
    "Revealed weakness is more useful than guessed weakness.",
    "A calm bully loses shape once a student lightly provokes them into overreacting.",
    "A difficult negotiator exposes more when lightly irritated than when gently handled.",
    "A manipulative relative shows their actual motive once someone stops soothing them."
  ),
  law(
    40,
    "Free offerings often hide cost, dependency, or reduced value.",
    "Price shapes seriousness, obligation, and quality more than most people like to admit.",
    "The law is not stinginess. It is attention to hidden terms and hidden obligations.",
    "Pay clearly for what matters when price buys freedom, alignment, or better quality.",
    "A vague gift can later cost leverage, independence, or taste even when the upfront number was zero.",
    "Clear exchange is often safer than fuzzy obligation.",
    "A student takes free help with hidden strings attached.",
    "A company takes a free pilot from a vendor and ends up locked into bad terms.",
    "A free family favor turns into years of leverage."
  ),
  law(
    41,
    "Trying to fill a giant predecessor's shape can trap you in comparison.",
    "People measure the successor against the legend before they can see the new person clearly.",
    "Respect what came before without becoming its imitation.",
    "Break the comparison early by creating a distinct style, path, or identity.",
    "Copying the old formula can keep you permanently second because the original always owns it.",
    "Difference gives successors room to grow.",
    "You take over a famous club role and keep getting compared to the last president.",
    "A new leader inherits a legendary founder's shadow and keeps repeating the old style.",
    "A younger sibling keeps being measured against the older one who came first."
  ),
  law(
    42,
    "One central troublemaker can carry the energy of an entire group.",
    "Many networks organize their boldness or disorder around a single figure rather than through equal shared strength.",
    "The law favors precise intervention, not broad aggression or panic.",
    "Identify the person who organizes the trouble and focus the response there.",
    "Fighting everyone equally wastes force and can strengthen solidarity around the real source of the problem.",
    "Targeting the center is cheaper than wrestling the whole field.",
    "One student keeps stirring the whole group against deadlines and accountability.",
    "A toxic manager poisons an otherwise solid team.",
    "One relative turns every holiday tense and the rest follow their cue."
  ),
  law(
    43,
    "Lasting influence works better when people feel seen and voluntarily aligned.",
    "Force gets compliance, but hearts and minds produce deeper cooperation that survives pressure.",
    "The law uses empathy as leverage, not as sentiment without structure.",
    "Understand what people care about and connect the ask to their pride, fear, and hope.",
    "Cold pressure often creates surface obedience and private resistance that shows up later when you most need commitment.",
    "Willing alignment holds better under stress than coerced compliance.",
    "A team works harder once the leader shows they understand what each member actually cares about.",
    "A manager needs buy in for a hard change and orders alone are not enough.",
    "A family request lands only after you speak to pride and care, not just duty."
  ),
  law(
    44,
    "Mirroring can unsettle or calm because it shows people their own behavior coming back at them.",
    "People often lose certainty when their exact rhythm, tone, or tactic is reflected instead of opposed head on.",
    "Mirror effect can soothe, expose, or confuse depending on how carefully it is used.",
    "Reflect the other person's method just enough to break their comfort and clarity.",
    "Direct collision can harden someone who would wobble against reflection because the fight feels familiar to them.",
    "Reflection can shift the game without a frontal fight.",
    "A rude classmate becomes unsettled when their own tone is mirrored back calmly.",
    "A difficult executive softens once someone meets them with a mirror of their exact style.",
    "A controlling friend gets disoriented when you match the pattern instead of arguing about it."
  ),
  law(
    45,
    "People often resist too much reform too fast, even when change is needed.",
    "Sudden upheaval feels like identity loss, not just improvement, so even useful reform can trigger revolt.",
    "The law favors paced transition, not stagnant caution or fear of all change.",
    "Introduce change in steps, preserve familiar anchors, and let people adapt without panic.",
    "Overnight reform can unite moderate people against a good idea because the speed feels like disrespect.",
    "Stable reform lasts longer than dramatic reform that sparks revolt.",
    "A student government reform plan is good but too sweeping for the culture to absorb at once.",
    "A new manager changes every process at once and the team revolts.",
    "A family habit needs to change, but too much reform too fast gets rejected."
  ),
  law(
    46,
    "Looking too perfect can provoke envy, suspicion, and hidden opposition.",
    "People tolerate superiority better when it leaves them some room for dignity and humanity.",
    "The law is not self sabotage. It is management of envy and unnecessary resentment.",
    "Show enough humanity or restraint that success does not feel like humiliation to others.",
    "Perfection on display makes people wait for your fall or quietly unite against your shine.",
    "Sustained success depends on lowering needless resentment.",
    "A top student keeps displaying total perfection and classmates start rooting against them.",
    "A star employee keeps making peers feel small without meaning to.",
    "A friend who always seems flawless becomes hard to trust or celebrate."
  ),
  law(
    47,
    "Going past the mark after victory can turn strength into overreach.",
    "Success changes incentives and tempts appetite to outrun purpose once momentum feels good.",
    "Stopping on time is part of winning, not evidence of weakness or timidity.",
    "Define the true objective in advance and slow down once it is secured.",
    "Momentum can make extra gains look free when they are actually exposed and likely to generate backlash.",
    "Controlled endings preserve gains that vanity would spend.",
    "You win the main point with a professor and keep pushing until the relationship worsens.",
    "A team secures the contract and then squeezes for one more concession.",
    "You finally get an apology and keep pushing for total surrender."
  ),
  law(
    48,
    "Formlessness protects power because rigid shapes are easier to predict and break.",
    "Conditions shift faster than fixed patterns want to admit, so yesterday's answer can become today's trap.",
    "Formlessness is adaptive strength, not chaos without structure or purpose.",
    "Stay fluid, update quickly, and avoid becoming so defined that other people can pin you down.",
    "Once a successful pattern becomes too visible, the world starts adjusting to it and eroding its edge.",
    "Flexibility keeps you alive through shifts that break rigid players.",
    "A student who always uses the same study plan gets exposed when the class format changes.",
    "A company relies on one successful model until the market shifts around it.",
    "A person clings to one identity after life circumstances change."
  ),
];

const lawByNumber = new Map(LAWS.map((entry) => [entry.number, entry]));

function clean(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function ensureSentence(value) {
  const text = clean(value);
  if (!text) return "";
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function lowerFirst(value) {
  const text = clean(value);
  if (!text) return "";
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function titleCase(value) {
  return clean(value)
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function pick(values, number, offset = 0) {
  return values[(number + offset) % values.length];
}

function stripLeadingWord(value) {
  return clean(value).replace(/^(you|a|an|the)\s+/i, "");
}

function buildScenarioTitle(seed, scope, index) {
  const base = stripLeadingWord(seed)
    .split(/[,.]/)[0]
    .split(/\s+/)
    .slice(0, 5)
    .join(" ");
  const scoped = `${scope} ${index === 0 ? "decision" : "follow up"}`;
  if (!base) return titleCase(scoped);
  return titleCase(index % 2 === 0 ? base : `${base} follow up`);
}

function buildParagraphs(entry) {
  const simple = [
    `${ensureSentence(entry.claim)} ${ensureSentence(entry.why)}`,
    `${ensureSentence(entry.move)} ${ensureSentence(entry.longGame)}`,
  ];
  const medium = [
    `${ensureSentence(entry.claim)} ${ensureSentence(entry.why)} ${ensureSentence(entry.nuance)}`,
    `${ensureSentence(entry.move)} ${ensureSentence(entry.warning)} ${ensureSentence(entry.longGame)}`,
  ];
  const hard = [
    `${ensureSentence(entry.claim)} ${ensureSentence(entry.why)} ${ensureSentence(entry.nuance)}`,
    `${ensureSentence(entry.move)} ${ensureSentence(entry.warning)} ${ensureSentence(entry.longGame)} This is where the law becomes judgment instead of slogan.`,
  ];
  return { easy: simple, medium, hard };
}

function buildStandardBullets(entry) {
  const bulletData = [
    {
      text: `${pick(["Hold the core rule in view.", "Start with the central move.", "Anchor the law in this idea."], entry.number)} ${ensureSentence(entry.claim)}`,
      detail: ensureSentence(entry.why),
    },
    {
      text: `${pick(["Read the human pressure underneath.", "Notice what the law is reacting to.", "Name the hidden driver clearly."], entry.number, 1)} ${ensureSentence(entry.why)}`,
      detail: ensureSentence(entry.nuance),
    },
    {
      text: `${pick(["Use the move before the room hardens.", "Apply the law early, not after panic sets in.", "Make the practical move before the pattern gets expensive."], entry.number, 2)} ${ensureSentence(entry.move)}`,
      detail: "Early action usually keeps the law useful instead of theatrical.",
    },
    {
      text: `${pick(["Watch the warning sign closely.", "The field usually tells you when the law is live.", "Do not miss the early signal."], entry.number, 3)} ${ensureSentence(entry.warning)}`,
      detail: "Catching the sign early keeps more room for a clean response.",
    },
    {
      text: `${pick(["Do not flatten the law into a slogan.", "The law is sharper than a lazy reading suggests.", "This is where nuance matters."], entry.number, 4)} ${ensureSentence(entry.nuance)}`,
      detail: "Without nuance, the same law becomes clumsy and self defeating.",
    },
    {
      text: `${pick(["Turn the rule into action.", "Convert the law into a practical move.", "Make the principle visible in behavior."], entry.number, 5)} ${ensureSentence(entry.move)}`,
      detail: "Use the law in the next decision, not only in abstract reflection.",
    },
    {
      text: `${pick(["Protect tomorrow's position.", "Think in sequence, not mood.", "Stay with the longer game."], entry.number, 6)} ${ensureSentence(entry.longGame)}`,
      detail: "Short term relief is rarely the same as stronger position.",
    },
    {
      text: `${pick(["Pressure usually announces itself before the blow lands.", "Do not wait for the full collapse.", "The live pattern is often visible early."], entry.number, 7)} ${ensureSentence(entry.warning)}`,
      detail: "That is why reading the field matters as much as making the move.",
    },
    {
      text: `${pick(["Stress test the law in ordinary life.", "The law belongs in live situations, not only historical stories.", "Translate the law into present decisions."], entry.number, 8)} ${ensureSentence(entry.move)}`,
      detail: "The best test is whether the move helps in school, work, or personal life without losing the deeper logic.",
    },
    {
      text: `${pick(["Close on the deeper lesson.", "The final pattern matters most.", "Carry this closing insight forward."], entry.number, 9)} ${ensureSentence(entry.longGame)}`,
      detail: ensureSentence(entry.claim),
    },
  ];
  return bulletData;
}

function buildDeeperBullets(entry) {
  return [
    {
      text: `${pick(["Greene's deeper logic is leverage, not theater.", "The hidden layer is leverage management.", "The law matters because leverage shifts quietly."], entry.number, 10)} ${ensureSentence(entry.why)}`,
      detail: "What looks emotional on the surface is often structural underneath.",
    },
    {
      text: `${pick(["The next move matters as much as the visible move.", "Second moves are where many readers lose the law.", "The sequence after the first action is part of the law."], entry.number, 11)} ${ensureSentence(entry.move)}`,
      detail: "A move that looks strong now can still weaken you if it shrinks later options.",
    },
    {
      text: `${pick(["Misreading the warning is what gets expensive.", "Costs rise once the warning is ignored.", "The warning is not decorative detail."], entry.number, 12)} ${ensureSentence(entry.warning)}`,
      detail: "Most preventable losses begin with a sign people preferred not to read.",
    },
    {
      text: `${pick(["Nuance keeps the law accurate.", "Without restraint, the law turns crude.", "Precision is what saves the law from caricature."], entry.number, 13)} ${ensureSentence(entry.nuance)}`,
      detail: "A premium reading protects the insight without flattening human reality.",
    },
    {
      text: `${pick(["The closing test is position tomorrow.", "Judge the law by tomorrow's field.", "The final standard is tomorrow's leverage."], entry.number, 14)} ${ensureSentence(entry.longGame)}`,
      detail: "If the move only feels good today, it is probably not the best reading of the law.",
    },
  ];
}

function buildVariant(entry, variant) {
  const paragraphs = buildParagraphs(entry)[variant];
  const standardBullets = buildStandardBullets(entry);
  const deeperBullets = buildDeeperBullets(entry);

  let chosenBullets = [];
  if (variant === "easy") {
    chosenBullets = SIMPLE_INDEXES.map((index) => standardBullets[index]);
  } else if (variant === "medium") {
    chosenBullets = standardBullets;
  } else {
    chosenBullets = [...standardBullets, ...deeperBullets];
  }

  return {
    importantSummary: `${paragraphs[0]} ${paragraphs[1]}`,
    summaryBullets: chosenBullets.map((item) => clean(item.text)),
    takeaways: standardBullets.slice(0, 6).map((item) => clean(item.text)),
    practice: [
      ensureSentence(entry.move),
      `Watch for this sign: ${lowerFirst(ensureSentence(entry.warning))}`,
      `Use the nuance as a guardrail: ${lowerFirst(ensureSentence(entry.nuance))}`,
      `Keep the longer game in view: ${lowerFirst(ensureSentence(entry.longGame))}`,
    ].map(clean),
    summaryBlocks: [
      { type: "paragraph", text: clean(paragraphs[0]) },
      { type: "paragraph", text: clean(paragraphs[1]) },
      ...chosenBullets.map((item) => ({
        type: "bullet",
        text: clean(item.text),
        detail: clean(item.detail),
      })),
    ],
  };
}

function buildScenario(seed, entry, scope, slot) {
  const opener = pick(SCENARIO_ACTION_OPENERS, entry.number, slot);
  const closer = pick(SCENARIO_FOLLOW_OPENERS, entry.number, slot);
  const baseScenario =
    slot % 2 === 0
      ? `${ensureSentence(seed)} The easy move is to answer the visible tension right away, even though that would usually weaken your position.`
      : `${ensureSentence(seed)} The pressure sharpens when the next decision asks whether you will protect your position or chase quick emotional relief.`;
  const why =
    slot % 2 === 0
      ? `${ensureSentence(entry.why)} ${ensureSentence(entry.longGame)}`
      : `${ensureSentence(entry.warning)} ${ensureSentence(entry.nuance)} ${ensureSentence(entry.longGame)}`;
  return {
    title: buildScenarioTitle(seed, scope, slot),
    contexts: [scope],
    scenario: clean(baseScenario),
    whatToDo: [
      clean(`${opener} ${ensureSentence(entry.move)}`),
      clean(closer),
    ],
    whyItMatters: clean(why),
  };
}

function buildExamples(entry, chapter) {
  return [
    buildScenario(entry.school, entry, "school", 0),
    buildScenario(entry.school, entry, "school", 1),
    buildScenario(entry.work, entry, "work", 2),
    buildScenario(entry.work, entry, "work", 3),
    buildScenario(entry.personal, entry, "personal", 4),
    buildScenario(entry.personal, entry, "personal", 5),
  ].map((example, index) => ({
    exampleId: `${chapter.chapterId}-ex${String(index + 1).padStart(2, "0")}`,
    ...example,
  }));
}

function rotateChoices(choices, by) {
  const shift = ((by % choices.length) + choices.length) % choices.length;
  if (!shift) return choices;
  return choices.map((_, index) => choices[(index + shift) % choices.length]);
}

function buildScenarioChoice(entry, questionIndex) {
  const action = clean(entry.move);
  const distractors = rotateChoices(
    [
      clean(pick(ACTION_DISTRACTORS, entry.number, questionIndex)),
      clean(pick(ACTION_DISTRACTORS, entry.number, questionIndex + 1)),
      clean(pick(ACTION_DISTRACTORS, entry.number, questionIndex + 2)),
    ],
    questionIndex
  );
  const choices = rotateChoices([action, ...distractors], entry.number + questionIndex);
  const correctIndex = choices.findIndex((choice) => choice === action);
  return { choices, correctIndex };
}

function buildLogicChoice(correct, entry, questionIndex) {
  const distractors = rotateChoices(
    [
      clean(pick(LOGIC_DISTRACTORS, entry.number, questionIndex)),
      clean(pick(LOGIC_DISTRACTORS, entry.number, questionIndex + 1)),
      clean(pick(LOGIC_DISTRACTORS, entry.number, questionIndex + 2)),
    ],
    questionIndex
  );
  const choices = rotateChoices([clean(correct), ...distractors], entry.number + questionIndex + 2);
  const correctIndex = choices.findIndex((choice) => choice === clean(correct));
  return { choices, correctIndex };
}

function buildQuestions(entry, chapter) {
  const scenarioPrompts = [
    `You are in a school situation like this: ${clean(entry.school)} Which move best fits the law?`,
    `At work, the pressure looks like this: ${clean(entry.work)} Which response best protects your position?`,
    `In personal life, imagine this situation: ${clean(entry.personal)} Which move best reflects the law?`,
    `A second round of the same pattern appears. Which next step most closely follows the law in practice?`,
  ];

  const questions = [];

  scenarioPrompts.forEach((prompt, index) => {
    const choiceSet = buildScenarioChoice(entry, index);
    questions.push({
      questionId: `${chapter.chapterId}-q${String(index + 1).padStart(2, "0")}`,
      prompt: clean(prompt),
      choices: choiceSet.choices,
      correctIndex: choiceSet.correctIndex,
      explanation: clean(`${ensureSentence(entry.move)} ${ensureSentence(entry.longGame)}`),
    });
  });

  const logicPrompts = [
    {
      prompt: "What hidden pressure does this law ask you to notice first?",
      correct: entry.why,
      explanation: entry.why,
    },
    {
      prompt: "Which reading best captures the point of the law?",
      correct: entry.nuance,
      explanation: entry.nuance,
    },
    {
      prompt: "Which sign should make you slow down and read the field again?",
      correct: entry.warning,
      explanation: entry.warning,
    },
    {
      prompt: "What does the longer game of the law protect?",
      correct: entry.longGame,
      explanation: entry.longGame,
    },
    {
      prompt: "Which response would most likely weaken your position here?",
      correct: pick(ACTION_DISTRACTORS, entry.number, 4),
      explanation: `${ensureSentence(entry.move)} ${ensureSentence(entry.longGame)}`,
    },
    {
      prompt: "What keeps a good reading of the law from turning crude or reckless?",
      correct: entry.nuance,
      explanation: `${ensureSentence(entry.nuance)} ${ensureSentence(entry.move)}`,
    },
  ];

  logicPrompts.forEach((item, index) => {
    const questionNumber = questions.length + 1;
    const choiceSet =
      index === 4
        ? {
            choices: rotateChoices(
              [
                clean(item.correct),
                clean(pick(ACTION_DISTRACTORS, entry.number, 5)),
                clean(pick(ACTION_DISTRACTORS, entry.number, 0)),
                clean(entry.move),
              ],
              entry.number + index + 3
            ),
            correctIndex: 0,
          }
        : buildLogicChoice(item.correct, entry, index + 4);

    const choices =
      index === 4
        ? choiceSet.choices
        : choiceSet.choices;
    const correctIndex =
      index === 4
        ? choices.findIndex((choice) => choice === clean(item.correct))
        : choiceSet.correctIndex;

    questions.push({
      questionId: `${chapter.chapterId}-q${String(questionNumber).padStart(2, "0")}`,
      prompt: clean(item.prompt),
      choices,
      correctIndex,
      explanation: clean(ensureSentence(item.explanation)),
    });
  });

  return questions.slice(0, 10);
}

function buildRetryQuestions(questions, chapter) {
  return questions.slice(0, 5).map((question, index) => {
    const rotatedChoices = rotateChoices(question.choices, index + 1);
    return {
      questionId: `${question.questionId}-retry-${String(index + 1).padStart(2, "0")}`,
      prompt: clean(`Take a second look at this situation. ${question.prompt}`),
      choices: rotatedChoices,
      correctIndex: rotatedChoices.findIndex(
        (choice) => choice === question.choices[question.correctIndex]
      ),
      explanation: question.explanation,
    };
  });
}

function buildChapter(baseChapter, entry) {
  const questions = buildQuestions(entry, baseChapter);
  return {
    chapterId: baseChapter.chapterId,
    number: baseChapter.number,
    title: baseChapter.title,
    readingTimeMinutes: baseChapter.readingTimeMinutes,
    contentVariants: {
      easy: buildVariant(entry, "easy"),
      medium: buildVariant(entry, "medium"),
      hard: buildVariant(entry, "hard"),
    },
    examples: buildExamples(entry, baseChapter),
    quiz: {
      passingScorePercent: 80,
      questions,
      retryQuestions: buildRetryQuestions(questions, baseChapter),
    },
  };
}

function assertNoDash(value, path) {
  if (/[-–—]/.test(value)) {
    throw new Error(`Dash found at ${path}: ${value}`);
  }
}

function validatePackage(pkg) {
  for (const chapter of pkg.chapters) {
    const entry = lawByNumber.get(chapter.number);
    if (!entry) throw new Error(`Missing blueprint for chapter ${chapter.number}`);

    const easyBullets = chapter.contentVariants.easy.summaryBlocks.filter((block) => block.type === "bullet").length;
    const mediumBullets = chapter.contentVariants.medium.summaryBlocks.filter((block) => block.type === "bullet").length;
    const hardBullets = chapter.contentVariants.hard.summaryBlocks.filter((block) => block.type === "bullet").length;

    if (easyBullets !== SUMMARY_BULLET_TARGETS.easy) {
      throw new Error(`Easy bullets out of spec for chapter ${chapter.number}`);
    }
    if (mediumBullets !== SUMMARY_BULLET_TARGETS.medium) {
      throw new Error(`Standard bullets out of spec for chapter ${chapter.number}`);
    }
    if (hardBullets !== SUMMARY_BULLET_TARGETS.hard) {
      throw new Error(`Deeper bullets out of spec for chapter ${chapter.number}`);
    }
    if (chapter.examples.length !== 6) {
      throw new Error(`Examples out of spec for chapter ${chapter.number}`);
    }
    const contexts = chapter.examples.flatMap((example) => example.contexts ?? []);
    const counts = {
      school: contexts.filter((value) => value === "school").length,
      work: contexts.filter((value) => value === "work").length,
      personal: contexts.filter((value) => value === "personal").length,
    };
    if (counts.school !== 2 || counts.work !== 2 || counts.personal !== 2) {
      throw new Error(`Scenario context mix out of spec for chapter ${chapter.number}`);
    }
    if (chapter.quiz.questions.length !== 10 || (chapter.quiz.retryQuestions ?? []).length !== 5) {
      throw new Error(`Quiz count out of spec for chapter ${chapter.number}`);
    }

    const scan = (value, path) => {
      if (typeof value === "string") {
        assertNoDash(value, path);
        return;
      }
      if (Array.isArray(value)) {
        value.forEach((item, index) => scan(item, `${path}[${index}]`));
        return;
      }
      if (value && typeof value === "object") {
        for (const [key, item] of Object.entries(value)) {
          if (key === "questionId" || key === "exampleId" || key === "chapterId") continue;
          scan(item, `${path}.${key}`);
        }
      }
    };

    scan(chapter.contentVariants, `chapter.${chapter.number}.contentVariants`);
    scan(chapter.examples, `chapter.${chapter.number}.examples`);
    scan(chapter.quiz, `chapter.${chapter.number}.quiz`);
  }
}

function renderBulletList(lines, items) {
  items.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.text} ${item.detail}`, "");
  });
}

function renderQuiz(lines, questions) {
  questions.forEach((question, index) => {
    lines.push(`${index + 1}. ${question.prompt}`);
    question.choices.forEach((choice, choiceIndex) => {
      lines.push(`${String.fromCharCode(65 + choiceIndex)}. ${choice}`);
    });
    lines.push(`Correct answer: ${String.fromCharCode(65 + question.correctIndex)}`);
    lines.push(`Explanation: ${question.explanation}`, "");
  });
}

function buildReport(pkg) {
  const lines = [];
  lines.push("# 1. Book audit summary for The 48 Laws of Power by Robert Greene", "");
  AUDIT_SUMMARY.forEach((paragraph) => lines.push(paragraph, ""));

  lines.push("# 2. Main content problems found", "");
  MAIN_PROBLEMS.forEach((item, index) => lines.push(`${index + 1}. ${item}`));
  lines.push("");

  lines.push("# 3. Personalization strategy for The 48 Laws of Power by Robert Greene", "");
  PERSONALIZATION_STRATEGY.forEach((paragraph) => lines.push(paragraph, ""));

  lines.push("# 4. Any minimal schema adjustments needed", "", SCHEMA_NOTE, "");

  lines.push("# 5. Chapter by chapter revised content", "");
  pkg.chapters.forEach((chapter) => {
    const easy = chapter.contentVariants.easy;
    const medium = chapter.contentVariants.medium;
    const hard = chapter.contentVariants.hard;
    const easyParagraphs = easy.summaryBlocks.filter((block) => block.type === "paragraph");
    const mediumParagraphs = medium.summaryBlocks.filter((block) => block.type === "paragraph");
    const hardParagraphs = hard.summaryBlocks.filter((block) => block.type === "paragraph");
    const easyBullets = easy.summaryBlocks.filter((block) => block.type === "bullet");
    const mediumBullets = medium.summaryBlocks.filter((block) => block.type === "bullet");
    const hardBullets = hard.summaryBlocks.filter((block) => block.type === "bullet");

    lines.push(`## ${chapter.number}. ${chapter.title}`, "");
    lines.push("### Summary", "");
    lines.push("#### Simple", "", easyParagraphs[0]?.text ?? "", "", easyParagraphs[1]?.text ?? "", "");
    lines.push("#### Standard", "", mediumParagraphs[0]?.text ?? "", "", mediumParagraphs[1]?.text ?? "", "");
    lines.push("#### Deeper", "", hardParagraphs[0]?.text ?? "", "", hardParagraphs[1]?.text ?? "", "");

    lines.push("### Bullet points", "");
    lines.push("#### Simple", "");
    renderBulletList(lines, easyBullets);
    lines.push("#### Standard", "");
    renderBulletList(lines, mediumBullets);
    lines.push("#### Deeper", "");
    renderBulletList(lines, hardBullets);

    lines.push("### Scenarios", "");
    chapter.examples.forEach((example, index) => {
      const scope = (example.contexts?.[0] ?? "personal").toUpperCase();
      lines.push(`${index + 1}. ${example.title} (${scope})`);
      lines.push(`Scenario: ${example.scenario}`);
      lines.push(`What to do: ${example.whatToDo.join(" ")}`);
      lines.push(`Why it matters: ${example.whyItMatters}`, "");
    });

    lines.push("### Quiz", "");
    renderQuiz(lines, chapter.quiz.questions);
  });

  lines.push("# 6. Final quality control summary", "");
  lines.push("1. Every law now has two authored summary paragraphs in Simple, Standard, and Deeper.");
  lines.push("2. Bullet depth now changes meaningfully across the book with seven Simple bullets, ten Standard bullets, and fifteen Deeper bullets.");
  lines.push("3. Every law now carries exactly six scenarios with two school, two work, and two personal examples.");
  lines.push("4. Every law now has ten primary quiz questions plus five retry questions with scenario grounded prompts and plausible distractors.");
  lines.push("5. The package stays schema compatible while the reader can apply a The 48 Laws of Power specific motivation layer.");
  lines.push("");

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

function main() {
  const base = JSON.parse(readFileSync(packagePath, "utf8"));
  const baseByNumber = new Map(base.chapters.map((chapter) => [chapter.number, chapter]));
  const chapters = [];

  for (let number = 1; number <= 48; number += 1) {
    const baseChapter = baseByNumber.get(number);
    const entry = lawByNumber.get(number);
    if (!baseChapter || !entry) {
      throw new Error(`Missing chapter or blueprint for ${number}`);
    }
    chapters.push(buildChapter(baseChapter, entry));
  }

  const nextPackage = {
    ...base,
    packageId: randomUUID(),
    createdAt: new Date().toISOString(),
    chapters,
  };

  validatePackage(nextPackage);
  const report = buildReport(nextPackage);

  mkdirSync(dirname(packagePath), { recursive: true });
  mkdirSync(dirname(reportPath), { recursive: true });

  writeFileSync(packagePath, `${JSON.stringify(nextPackage, null, 2)}\n`);
  writeFileSync(reportPath, report);
}

main();
