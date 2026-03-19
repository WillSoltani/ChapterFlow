import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";

const packagePath = resolve(process.cwd(), "book-packages/33-strategies-of-war.modern.json");
const reportPath = resolve(process.cwd(), "notes/33-strategies-of-war-revision-report.md");

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
  "Make the most visible move right away so nobody questions your resolve.",
  "Avoid taking a clear position so you do not create resistance.",
  "Copy the old habit that feels safest and hope the pressure passes.",
  "Focus on sounding principled even if the structure stays weak.",
  "Hand the hard part to someone else and trust that loyalty will follow.",
  "Use a symbolic show of strength even if it does not fix the real issue.",
  "Keep everyone equally happy even if control becomes unclear.",
  "Wait for the situation to settle itself before you shape it.",
];

const AUDIT_SUMMARY = [
  "The existing The 33 Strategies of War package was not ready to ship. Its main weakness was not only structural mismatch. The prose itself was produced through a generic template system that repeated the same logic, the same sentence rhythm, and often the same scenario shapes across almost every strategy.",
  "Most summaries did not explain Robert Greene's actual strategic logic. They took a chapter title, inserted one or two chapter specific nouns, and then dropped back into the same vague advice about incentives, legitimacy, and pressure. The result sounded polished at a glance and empty on a careful read.",
  "The bullet sets repeated shared templates across the whole book, the scenarios reused the same school, work, and personal shells with only a few nouns changed, and the quizzes often tested wording patterns rather than understanding. Depth modes also missed the target counts at 6, 10, and 14 instead of 7, 10, and 15.",
  "This revision therefore replaces the content book wide. The aim is to keep the existing package structure while rebuilding the book around Greene's real themes of initiative, morale, positioning, deception, timing, coalition management, and long game endurance.",
];

const MAIN_PROBLEMS = [
  "The summaries were vague, repetitive, and only loosely tied to the real strategy of each chapter.",
  "The bullets reused the same explanatory template across the whole book, which flattened distinct strategies into generic advice.",
  "The scenarios were mechanically recycled across chapters and did not feel specific to the strategy being taught.",
  "The quizzes leaned on weak applied logic and often sounded like template output instead of real understanding checks.",
  "Depth variation was structurally incomplete because the package used 6, 10, and 14 bullets instead of the required 7, 10, and 15.",
  "The reader had no book specific motivation layer for Robert Greene, so Gentle, Direct, and Competitive did not feel meaningfully tailored.",
];

const PERSONALIZATION_STRATEGY = [
  "Depth stays in the package itself. Simple gives a fast, faithful reading with seven bullets. Standard gives the strongest all around lesson with ten bullets. Deeper adds five real layers about leverage, timing, second order effects, and misread signals rather than extra filler.",
  "Motivation is handled as a reader layer, not as nine duplicated packages. The core meaning stays fixed while tone shifts in summary framing, scenario guidance, recap language, and quiz explanations.",
  "Gentle for this book does not erase Greene's harder edge. It helps the reader stay calm around conflict. Direct names the contest, pressure, and tradeoff clearly. Competitive stresses edge, wasted leverage, and the cost of naive positioning when the strategy naturally supports it.",
  "This keeps schema impact minimal while making the experience across Simple, Standard, Deeper and Gentle, Direct, Competitive feel materially different.",
];

const SCHEMA_NOTE =
  "No package schema change was required. The revision stays inside the existing JSON structure. Content depth is authored in the package and tone personalization is handled in the reader with a book specific layer.";

const CHAPTER_REVISIONS = [
  chapter({
    chapterId: "ch01-clear-the-inner-field",
    number: 1,
    title: "Clear the Inner Field",
    readingTimeMinutes: 13,
    summary: {
      p1: t(
        "Inner conflict is the first battlefield, and Greene argues that no external strategy works for long if you are still ruled by fear, vanity, anger, or old wounds. Clear thinking under pressure has to be built on purpose, emotional control, and the ability to separate what is actually happening from what your ego wants to see.",
        "This opening strategy treats self command as a practical military skill. The person who cannot govern reactions keeps choosing fights badly, reading signals badly, and handing initiative to stronger personalities.",
        "Greene is not praising passivity. He is arguing that inner stillness creates better aggression, better timing, and better selection of where conflict is worth spending."
      ),
      p2: t(
        "This matters because people often lose important contests before the real contest begins. They walk in with resentment, insecurity, or hunger for immediate relief, and those private pressures quietly decide the next move for them.",
        "The deeper lesson is that clarity is a strategic resource. When you can see your own triggers clearly, you stop mistaking provocation for necessity and stop rewarding other people for knowing how to push you.",
        "In everyday life, this is what keeps conflict from becoming theater. You can act with force when needed, but the force comes from a chosen objective rather than from emotional spillover."
      ),
    },
    standardBullets: [
      bullet(
        "Begin with self command. Greene treats emotional control as the first condition of useful strategy.",
        "If your reactions lead, other people can set your agenda without earning that power."
      ),
      bullet(
        "Do not let mood choose the contest. Anger, hurt pride, and insecurity all make weak fights look urgent.",
        "A bad emotional read can waste strength before the real issue is even clear."
      ),
      bullet(
        "Name the real objective early. Strategy improves when you know exactly what must be protected, won, or ended.",
        "Vague purpose turns pressure into noise."
      ),
      bullet(
        "Read yourself as carefully as you read others. Your own habits under stress reveal where you are easiest to provoke.",
        "Self knowledge closes openings your rivals would otherwise use."
      ),
      bullet(
        "Calm is not softness. A steady inner field lets you escalate cleanly instead of lashing out and then scrambling to repair the damage.",
        "Control gives force direction."
      ),
      bullet(
        "Distinguish signal from trigger. Not every discomfort is a threat and not every insult deserves reply.",
        "Useful strategy begins when you stop reacting to everything that touches your ego."
      ),
      bullet(
        "Slow the first move. Early restraint usually produces better information than fast retaliation does.",
        "A short pause can reveal motive, pattern, and hidden options."
      ),
      bullet(
        "Guard your reputation through composure. People learn how to push you by watching what breaks your balance.",
        "Visible steadiness becomes a form of deterrence."
      ),
      bullet(
        "Use pressure to clarify priorities. Hard moments should narrow attention toward the essential, not scatter it across every irritation.",
        "Composure helps you conserve effort for the decisive point."
      ),
      bullet(
        "The closing lesson is simple. The person who wins the inner war enters the outer one with far better odds.",
        "Clear purpose and controlled emotion make the rest of strategy possible."
      ),
    ],
    deeperBullets: [
      bullet(
        "Greene treats self command as leverage, not as personal virtue language. The calmer person usually sees more of the field and therefore controls more of the exchange.",
        "Perception widens when ego pressure drops."
      ),
      bullet(
        "Inner disorder creates predictable patterns. Once people know what flatters, shames, or enrages you, they can maneuver you without direct force.",
        "Emotional predictability is a strategic weakness."
      ),
      bullet(
        "Composure protects timing. A reactive person moves when pushed. A strategic person moves when the moment is genuinely right.",
        "That difference is often the difference between initiative and manipulation."
      ),
      bullet(
        "This strategy also limits overreading. When you are flooded internally, you project intention onto ordinary events and turn manageable friction into imagined war.",
        "Clear inner ground produces cleaner judgment about what is actually hostile."
      ),
      bullet(
        "The broader lesson is that self mastery is cumulative power. It protects energy, sharpens reading, and makes every later tactic less expensive.",
        "Greene starts here because a mind in disorder cannot hold a larger campaign together."
      ),
    ],
    takeaways: [
      "Self command comes first",
      "Do not let emotion pick the fight",
      "Name the real objective",
      "Pause before the first move",
      "Composure protects reputation",
      "Inner clarity improves outer strategy",
    ],
    practice: [
      "Write the real objective before responding",
      "Name the trigger you are most likely to over obey",
      "Pause long enough to separate signal from ego",
      "Choose one move that protects energy and leverage",
    ],
    examples: [
      example(
        "ch01-ex01",
        "Slack flare up before launch",
        ["work"],
        "A product lead gets a sharp message in a public channel two hours before a launch. The message feels disrespectful, and the first impulse is to answer in the same tone and settle the status issue immediately.",
        [
          "Pause, restate the real launch objective, and answer only the part of the message that affects execution.",
          "Move the status tension into a later private conversation unless it truly changes the launch decision."
        ],
        "The strategy matters because public provocation often tries to recruit your ego into the other person's timing. Clear inner ground keeps the goal from being replaced by the mood."
      ),
      example(
        "ch01-ex02",
        "Manager under criticism from above",
        ["work"],
        "A manager gets blunt criticism from a director and starts preparing a defensive reply that explains why everyone else made the problem worse. The response would protect pride, but it would not fix the actual risk now facing the team.",
        [
          "Separate the emotional sting from the practical problem and answer the problem first.",
          "Use the next conversation to show control, facts, and a clear plan instead of searching for emotional relief."
        ],
        "Greene's point is that private agitation becomes public weakness when it starts selecting your moves for you."
      ),
      example(
        "ch01-ex03",
        "Group project with a difficult teammate",
        ["school"],
        "A teammate makes a dismissive comment in front of the class, and the group leader feels the urge to challenge it on the spot. The public exchange would feel satisfying, but it could also break the group before the deadline.",
        [
          "Identify what actually needs to be protected, which is the project and role clarity, not immediate emotional payback.",
          "Address the behavior in a controlled setting after you secure the work that cannot be lost."
        ],
        "The strategy applies because wounded pride loves immediate battle. Composure lets you choose the field and the timing instead."
      ),
      example(
        "ch01-ex04",
        "Club election tension",
        ["school"],
        "A club officer feels threatened by a rising member and starts interpreting every suggestion as a challenge. Meetings become tense because the officer is fighting a possible future loss rather than the actual discussion happening now.",
        [
          "Notice the insecurity driving the interpretation before you treat ordinary input as open revolt.",
          "Return the conversation to the specific decision in front of the group and refuse to battle over imagined motives you cannot yet prove."
        ],
        "Inner disorder creates phantom enemies. Greene wants the reader to stop feeding those inventions before they reshape the whole room."
      ),
      example(
        "ch01-ex05",
        "Argument with a sibling",
        ["personal"],
        "A familiar family argument starts again, and within minutes both people are reacting more to years of stored resentment than to the present issue. Each sentence is landing on old territory.",
        [
          "Name the present issue in one sentence and refuse to drag the whole family archive into the exchange.",
          "If you cannot regain clarity, pause the conversation before you create damage that serves no goal."
        ],
        "This strategy matters in personal life because old emotional maps make people fight the past while pretending to address the present."
      ),
      example(
        "ch01-ex06",
        "Dating decision under mixed signals",
        ["personal"],
        "Someone receives intense attention from a new romantic interest and wants to treat the intensity as proof of seriousness. The attraction is strong enough that warning signs start feeling rude to notice.",
        [
          "Slow your pace and watch for consistent behavior before letting mood define the person's character.",
          "Use calm observation to protect standards instead of treating chemistry as evidence."
        ],
        "Greene's lesson is that emotional heat can blur judgment fast. Inner steadiness keeps desire from writing a false story for you."
      ),
    ],
    directQuestions: [
      question(
        "ch01-q01",
        "What is the first battlefield Greene wants you to win?",
        [
          "Public perception",
          "Your own emotional reactivity",
          "The other side's reputation",
          "Control of the loudest room"
        ],
        1,
        "He begins with self command because a reactive mind is easy to steer."
      ),
      question(
        "ch01-q02",
        "Why is a short pause often strategically useful?",
        [
          "It makes you seem mysterious no matter the situation",
          "It creates space to separate the real objective from the trigger",
          "It guarantees the other side will calm down",
          "It keeps you from ever needing force"
        ],
        1,
        "The pause matters because it helps prevent mood from selecting the fight."
      ),
      question(
        "ch01-q03",
        "What does visible composure teach other people?",
        [
          "That you will never answer pressure",
          "That provocation is a reliable way to control you",
          "That your moves are harder to force on bad timing",
          "That you care less than everyone else"
        ],
        2,
        "Steadiness deters manipulation because it reduces the reward for provocation."
      ),
      question(
        "ch01-q04",
        "What deeper principle closes this strategy?",
        [
          "Calm matters mainly for private peace",
          "Inner clarity improves timing, reading, and force across the whole campaign",
          "Emotion should be removed from all human conflict",
          "The outer war matters more than self command"
        ],
        1,
        "Greene treats self mastery as a multiplier on every later strategic choice."
      ),
    ],
  }),
  chapter({
    chapterId: "ch02-state-a-real-aim",
    number: 2,
    title: "State a Real Aim",
    readingTimeMinutes: 13,
    summary: {
      p1: t(
        "Conflict becomes wasteful when the goal is fuzzy, and Greene argues that many people fight from irritation, habit, or pride without ever naming what winning actually means. A real aim gives conflict shape. It tells you what matters, what does not, and how far the struggle is worth taking.",
        "This strategy pushes the reader to stop drifting through diffuse hostility. If you cannot name the target, the point of decision, and the acceptable cost, you are not really strategizing yet.",
        "Greene's larger point is that clarity about aim keeps you from scattering force across substitute battles. You stop attacking whatever is nearest and start moving toward what actually changes the outcome."
      ),
      p2: t(
        "This matters because unfocused conflict feels active while producing very little. People vent, posture, retaliate, and defend themselves without improving position because they never defined the result that would count as success.",
        "The deeper lesson is that aim creates economy. When the objective is clear, you can ignore bait, preserve energy, and design steps that build toward a conclusion rather than feeding endless friction.",
        "In real life, this often means naming the contest beneath the surface contest. The visible argument may be about tone, status, or timing, while the real issue is access, trust, territory, or future control."
      ),
    },
    standardBullets: [
      bullet(
        "Start by naming the win. Greene wants conflict tied to a defined result rather than to emotional discharge.",
        "A clear aim gives pressure direction."
      ),
      bullet(
        "Do not confuse activity with progress. Many intense fights keep people busy while leaving the real objective untouched.",
        "Motion without aim is still drift."
      ),
      bullet(
        "Separate surface issues from the true contest. The loudest disagreement is often not the most strategic one.",
        "Better naming usually changes the whole plan."
      ),
      bullet(
        "Set the acceptable cost. If you do not know what you are willing to spend, escalation becomes reckless quickly.",
        "Aim includes limits as well as ambition."
      ),
      bullet(
        "Aim creates selection. Once the objective is clear, some provocations become irrelevant and some opportunities become obvious.",
        "Clarity narrows the field usefully."
      ),
      bullet(
        "Write the target in concrete terms. Vague hopes such as respect or control are too loose to guide action well.",
        "Specific outcomes improve judgment."
      ),
      bullet(
        "Let the aim organize sequence. Good strategy starts aligning moves in order instead of chasing every irritation as it appears.",
        "Sequence becomes clearer when the end point is named."
      ),
      bullet(
        "Check whether the aim is truly yours. People often inherit other people's battles and then call the pressure their own mission.",
        "Borrowed conflict burns energy fast."
      ),
      bullet(
        "Return to the aim when emotion rises. Clarity is most valuable when the field becomes noisy and tempting side fights appear.",
        "The goal should keep pulling you back into line."
      ),
      bullet(
        "The closing lesson is that clear objectives make conflict smaller, sharper, and more effective.",
        "A named aim is what turns struggle into strategy."
      ),
    ],
    deeperBullets: [
      bullet(
        "Greene treats aim as a filter for perception. Once you know what matters, the field reorganizes and much of the apparent urgency falls away.",
        "Clarity changes what you even notice."
      ),
      bullet(
        "Hidden aims cause self sabotage. People say they want resolution while acting as though they really want vindication, attention, or revenge.",
        "Strategic honesty begins with admitting the real objective."
      ),
      bullet(
        "A clear aim also improves alliance management. Others can help you better when the objective is concrete instead of emotionally foggy.",
        "Named purpose attracts more usable support."
      ),
      bullet(
        "This strategy limits endless war. When success is defined, you are less likely to keep fighting past the point where the contest is already won.",
        "Ambiguity makes conflict sticky."
      ),
      bullet(
        "The broader lesson is that purpose is economy. It protects energy, sharpens choice, and keeps force from leaking into battles that feel satisfying but change nothing.",
        "Greene treats aim as the center of all later campaign design."
      ),
    ],
    takeaways: [
      "Name the win clearly",
      "Separate the real contest from the noisy one",
      "Define acceptable cost",
      "Let the aim organize sequence",
      "Check whether the aim is truly yours",
      "Clarity makes conflict more efficient",
    ],
    practice: [
      "Write the exact result that would count as success",
      "Name one side fight that does not serve the real goal",
      "Set the cost you are not willing to exceed",
      "Choose the next move that advances the actual aim",
    ],
    examples: [
      example(
        "ch02-ex01",
        "Cross functional fight over ownership",
        ["work"],
        "Two teams are arguing publicly over who should own a project, and the discussion keeps expanding into personality complaints and status grievances. Nobody has clearly stated what outcome would actually solve the problem.",
        [
          "Force the conversation to name the real decision, the owner, and the measures of success before debating tone or credit.",
          "Refuse to spend more time on side arguments once the actual objective has been defined."
        ],
        "The strategy matters because diffuse conflict often survives by staying vague. A real aim cuts away the emotional surplus that keeps the fight alive."
      ),
      example(
        "ch02-ex02",
        "Negotiation drifting into pride",
        ["work"],
        "A manager starts a negotiation trying to protect budget but slowly shifts into wanting to prove a point after feeling disrespected. The position hardens even though the original objective has been forgotten.",
        [
          "Write the original objective down and compare each new move against it before escalating.",
          "If the current battle serves pride more than outcome, reset the frame before continuing."
        ],
        "Greene's point is that unnamed aims are easily replaced by ego once friction appears."
      ),
      example(
        "ch02-ex03",
        "Student election message problem",
        ["school"],
        "A student campaign keeps reacting to rumors and criticism online. The team is working nonstop, but it is no longer clear whether the aim is to win votes, look strong, or punish critics.",
        [
          "Restate the concrete electoral goal and evaluate every response by whether it helps move undecided voters.",
          "Stop answering attacks that do not change the outcome you are actually trying to reach."
        ],
        "This strategy applies because aim converts frantic effort into useful selection. Without it, every criticism becomes its own war."
      ),
      example(
        "ch02-ex04",
        "Group project with no shared target",
        ["school"],
        "A project team keeps arguing about effort and fairness, yet nobody has aligned on what the finished work must actually achieve. The conflict feels moral, but the problem is mostly lack of a common objective.",
        [
          "Define the required outcome first, then assign work in relation to that result rather than to vague complaints.",
          "Use the shared aim to decide what deserves conflict and what should simply be ignored."
        ],
        "Greene would say the group is trying to fight without first choosing what the battle is for."
      ),
      example(
        "ch02-ex05",
        "Roommate conflict spreading everywhere",
        ["personal"],
        "A roommate disagreement about shared space starts swallowing every other irritation in the home. Soon the conflict is about tone, past habits, money, and who cares more.",
        [
          "Reduce the argument to the concrete change that would actually solve the living problem.",
          "Do not let unrelated resentments keep expanding the battle past the objective."
        ],
        "A real aim makes conflict smaller and more solvable. Vague resentment keeps multiplying fronts."
      ),
      example(
        "ch02-ex06",
        "Dating situation with mixed intentions",
        ["personal"],
        "Someone keeps cycling through confusion in a new relationship because they want clarity, reassurance, and excitement all at once but have not decided what they are actually seeking.",
        [
          "Name the result you really want before reading every signal as proof or threat.",
          "Let that aim decide the pace, the questions you ask, and what you are no longer willing to tolerate."
        ],
        "The strategy matters because unclear personal aims make people overinterpret attention and underprotect their own position."
      ),
    ],
    directQuestions: [
      question(
        "ch02-q01",
        "Why does Greene insist on a clearly named objective?",
        [
          "Because it makes conflict look more impressive",
          "Because it turns pressure into a directed campaign instead of emotional drift",
          "Because it guarantees quick agreement",
          "Because it removes the need for tradeoffs"
        ],
        1,
        "A named objective gives selection, economy, and sequence to the whole contest."
      ),
      question(
        "ch02-q02",
        "What often replaces the real aim once friction rises?",
        [
          "Better intelligence",
          "Clearer long term planning",
          "Ego goals such as vindication or status repair",
          "Healthier alliance structure"
        ],
        2,
        "People often start wanting to feel restored more than they want the original result."
      ),
      question(
        "ch02-q03",
        "Why does aim improve economy?",
        [
          "It makes every conflict morally pure",
          "It helps you ignore bait and spend force only where the result actually changes",
          "It eliminates the need for adaptation",
          "It makes side fights more satisfying"
        ],
        1,
        "Clarity filters noise and stops effort from leaking into symbolic battles."
      ),
      question(
        "ch02-q04",
        "What deeper principle closes this strategy?",
        [
          "The loudest issue is usually the real one",
          "Clear purpose is what turns conflict into strategy",
          "Any strong feeling can serve as a good objective",
          "Winning depends mostly on intensity"
        ],
        1,
        "Greene wants purpose to do the organizing work that raw emotion cannot do well."
      ),
    ],
  }),
  chapter({
    chapterId: "ch03-create-emotional-distance",
    number: 3,
    title: "Create Emotional Distance",
    readingTimeMinutes: 13,
    summary: {
      p1: t(
        "Emotional distance keeps present conflict from being hijacked by old hurt, fantasies of revenge, or the need to feel instantly restored. Greene argues that without distance people fight the last war again and again, reading current events through stale injury instead of actual conditions.",
        "This strategy is about cooling interpretation before cooling action. You do not need to stop caring. You need enough distance to judge proportion, motive, and timing without dragging old emotional residue into every decision.",
        "Greene's claim is that distance improves reality contact. It prevents you from confusing memory, projection, and pattern with the specific problem now in front of you."
      ),
      p2: t(
        "This matters because repeated conflict often becomes ritual. The same trigger pulls the same story, the same story produces the same move, and the whole exchange starts running on history rather than on strategy.",
        "The deeper lesson is that emotional distance creates adaptability. Once you stop treating every tense moment as proof that the old wound is back, you can finally see where the present field differs from the past one.",
        "In practical life, this strategy protects relationships, negotiations, and campaigns from becoming overdetermined by habit. Distance interrupts repetition and gives choice back to you."
      ),
    },
    standardBullets: [
      bullet(
        "Do not fight yesterday's battle again. Greene warns against carrying old scripts into new conditions.",
        "Past pain can distort the reading of present reality."
      ),
      bullet(
        "Create space between feeling and decision. Distance lets interpretation cool before action hardens.",
        "That space reduces expensive projection."
      ),
      bullet(
        "Notice the repeating pattern. If the same kind of person or event keeps producing the same reaction, the script may be yours as much as theirs.",
        "Repetition is a useful warning sign."
      ),
      bullet(
        "Distinguish memory from evidence. A familiar sensation is not proof that the current situation is the same as the old one.",
        "Similarity can be superficial and still feel intense."
      ),
      bullet(
        "Use distance to improve proportion. Once the emotional fog thins, you can match response to reality instead of to stored fear.",
        "Better proportion protects leverage."
      ),
      bullet(
        "Do not let the other side recruit your history. Skilled opponents often benefit when they can trigger your old narrative.",
        "Distance keeps present choices from being outsourced."
      ),
      bullet(
        "Distance sharpens timing. A person who is not drowning in memory can wait, redirect, or escalate with better discipline.",
        "Cooling often produces stronger action later."
      ),
      bullet(
        "Protect your judgment from emotional fusion. When past and present collapse together, the field becomes harder to read.",
        "Strategy needs separation to stay accurate."
      ),
      bullet(
        "Practice seeing the event as if it were happening to someone else first. Temporary detachment can widen the frame usefully.",
        "Perspective is one way to interrupt repetition."
      ),
      bullet(
        "The closing lesson is that distance is freedom. It keeps old injury from quietly commanding current strategy.",
        "You fight better when memory is information, not a dictator."
      ),
    ],
    deeperBullets: [
      bullet(
        "Greene is attacking emotional inevitability. People often talk as though the old reaction just happened to them, but he wants that sequence slowed and studied.",
        "Distance makes the script visible enough to revise."
      ),
      bullet(
        "This strategy also improves reading of others. When you are less flooded by your own history, you can notice the other person's actual incentives instead of turning them into a stand in for someone older.",
        "Projection shrinks as attention widens."
      ),
      bullet(
        "Distance does not mean indifference. It means refusing to give the first wave of feeling authority over final judgment.",
        "The emotion can stay present without becoming the general."
      ),
      bullet(
        "Repeated overreaction trains your environment. If others learn that certain triggers reliably scramble your judgment, they start using them intentionally or unconsciously.",
        "Distance breaks that training loop."
      ),
      bullet(
        "The broader lesson is that psychological flexibility begins with separation. Once old pain is no longer fused to present choice, far more strategic options appear.",
        "Greene treats distance as a practical path out of repetition."
      ),
    ],
    takeaways: [
      "Do not fight the old war again",
      "Pause between feeling and decision",
      "Memory is not evidence",
      "Projection distorts proportion",
      "Distance improves timing",
      "Separation restores choice",
    ],
    practice: [
      "Name the old story the event is trying to activate",
      "List one present fact that differs from the old pattern",
      "Delay the move until proportion returns",
      "Choose an action based on the current field not the familiar feeling",
    ],
    examples: [
      example(
        "ch03-ex01",
        "Feedback that lands like an old attack",
        ["work"],
        "A manager gives blunt feedback, and an employee immediately feels the same mix of shame and anger that used to appear with a critical parent. The reply forming in the employee's head is about old humiliation as much as current work.",
        [
          "Separate the feedback from the old emotional script before deciding what needs to be answered.",
          "Respond to the specific work issue first, and save any discussion about tone until you can do it without reliving the older conflict."
        ],
        "Greene's point is that emotional distance prevents old pain from drafting the current move for you."
      ),
      example(
        "ch03-ex02",
        "Negotiation derailed by past distrust",
        ["work"],
        "A partner makes a last minute change, and the team leader instantly assumes betrayal because a former partner behaved that way before. The leader is ready to punish hard before checking whether the new situation is actually the same.",
        [
          "Slow the interpretation and ask what evidence belongs to this situation instead of to the earlier wound.",
          "Use the pause to test motive, leverage, and options before turning caution into full retaliation."
        ],
        "Distance matters because unresolved history can make necessary caution look identical to certainty."
      ),
      example(
        "ch03-ex03",
        "Classroom conflict with an authority figure",
        ["school"],
        "A professor's comment feels dismissive, and a student instantly reads it through earlier experiences of being overlooked. The student now wants to confront the professor publicly even though the actual comment may have been careless rather than hostile.",
        [
          "Separate the emotional truth of the reaction from the strategic question of what happened here and what response would serve you best.",
          "Gather a little more evidence before choosing a move that could raise the stakes."
        ],
        "This strategy applies because present choices become more accurate when past injury is acknowledged without being allowed to dominate the field."
      ),
      example(
        "ch03-ex04",
        "Team captain repeating an old rivalry",
        ["school"],
        "A team captain keeps treating one teammate like a threat because the teammate resembles a past rival in style and confidence. Ordinary disagreement keeps getting interpreted as deliberate challenge.",
        [
          "Notice the pattern and ask where memory is filling in facts that the current teammate has not actually provided.",
          "Reset the relationship around present behavior and present incentives instead of resemblance."
        ],
        "Greene would say distance interrupts the habit of fighting a substitute enemy."
      ),
      example(
        "ch03-ex05",
        "Family holiday turning into a replay",
        ["personal"],
        "A small comment at a family gathering triggers the exact same argument people have had for years. Everyone is speaking to prior versions of one another more than to the actual moment.",
        [
          "Name the current issue narrowly and refuse to let the older archive take over the conversation.",
          "If nobody can separate past from present, pause the exchange before the replay writes itself."
        ],
        "The strategy matters because repeated family fights often run on stored scripts that nobody is consciously choosing anymore."
      ),
      example(
        "ch03-ex06",
        "Dating fear shaping the present",
        ["personal"],
        "Someone starts withdrawing from a promising relationship because the current person reminds them of a past betrayal in one small way. The old fear is now silently writing a new story.",
        [
          "Ask what belongs to the present pattern and what belongs to the old wound before pulling away.",
          "Use distance to test for real evidence rather than treating resemblance as proof."
        ],
        "Greene's lesson is that memory should inform present judgment, not impersonate it."
      ),
    ],
    directQuestions: [
      question(
        "ch03-q01",
        "What danger is Greene trying to prevent with emotional distance?",
        [
          "Loss of all feeling",
          "Public disagreement of any kind",
          "Replaying old conflicts inside new situations",
          "The need for future alliances"
        ],
        2,
        "He wants the reader to stop importing old scripts into present contests."
      ),
      question(
        "ch03-q02",
        "Why does distance improve proportion?",
        [
          "Because it eliminates stakes entirely",
          "Because it helps match response to current evidence rather than to stored fear",
          "Because it makes everyone else more honest",
          "Because it removes the need for judgment"
        ],
        1,
        "Cooling the interpretation usually produces a response that better fits the actual field."
      ),
      question(
        "ch03-q03",
        "What is a useful warning sign that you may be fighting the last war?",
        [
          "The situation feels mild and easy to read",
          "The same kind of trigger keeps producing the same intense reaction",
          "You have too much concrete information",
          "The other side agrees with you immediately"
        ],
        1,
        "Repetition often signals that an older script is running again."
      ),
      question(
        "ch03-q04",
        "What deeper principle closes this strategy?",
        [
          "Distance is a way of restoring choice and adaptability",
          "Old wounds should always be ignored",
          "The past is never useful information",
          "Emotion and strategy cannot coexist"
        ],
        0,
        "Greene wants memory acknowledged without letting it take command of present action."
      ),
    ],
  }),
  chapter({
    chapterId: "ch04-stay-in-motion",
    number: 4,
    title: "Stay in Motion",
    readingTimeMinutes: 13,
    summary: {
      p1: t(
        "Motion creates initiative, and Greene argues that once conflict begins, hesitation usually rewards the other side more than it rewards you. The aim is not mindless speed. It is purposeful movement that prevents stagnation, keeps pressure on rivals, and denies fear the time it needs to thicken into paralysis.",
        "This strategy treats momentum as both psychological and practical. When you keep moving with direction, you gather information, unsettle opponents, and protect yourself from the fantasy that perfect certainty will arrive before action is required.",
        "Greene's core lesson is that stillness becomes dangerous when it is really disguised avoidance. A campaign needs forward energy even while details are still changing."
      ),
      p2: t(
        "This matters because uncertainty often tricks people into waiting for cleaner conditions than reality ever offers. While they wait, their rivals adapt, prepare, and seize the narrative of action.",
        "The deeper lesson is that movement generates options. It exposes weak points, draws reactions, and teaches you things that static analysis never will. Stagnation protects fear more than it protects position.",
        "In everyday life, staying in motion often means choosing the next useful step before you feel fully ready. Done well, motion creates tempo, and tempo can become a form of control."
      ),
    },
    standardBullets: [
      bullet(
        "Do not confuse hesitation with prudence. Greene warns that waiting often feels wise while quietly surrendering initiative.",
        "Time usually helps the side already in motion."
      ),
      bullet(
        "Create purposeful momentum. Movement should be tied to the campaign, not to random restlessness.",
        "Useful motion advances position and gathers information."
      ),
      bullet(
        "Action generates clarity. Once you move, the field starts answering back and hidden facts become easier to read.",
        "Some knowledge arrives only through engagement."
      ),
      bullet(
        "Momentum unsettles opponents. The side that keeps adjusting and pressing often forces others into reaction mode.",
        "Reaction is a weaker posture than initiative."
      ),
      bullet(
        "Use small steps to break paralysis. You do not need perfect certainty to move the campaign forward.",
        "Even a limited advance can change the emotional weather."
      ),
      bullet(
        "Protect tempo once you have it. Frequent stalls teach the other side that your pressure can be waited out.",
        "Broken rhythm weakens authority."
      ),
      bullet(
        "Do not let fear demand total information first. That demand is often a dressed up form of avoidance.",
        "Movement is how you keep fear from owning the clock."
      ),
      bullet(
        "Make movement observable where useful. Visible initiative can improve morale and signal seriousness.",
        "People rally more easily behind a campaign that seems alive."
      ),
      bullet(
        "Adjust while advancing. Motion does not mean stubbornly holding the first plan no matter what you learn.",
        "Good tempo includes correction."
      ),
      bullet(
        "The closing lesson is that momentum is a strategic asset. It protects confidence, reveals the field, and keeps the campaign from being trapped in thought alone.",
        "Greene wants purposeful movement before fear becomes the real commander."
      ),
    ],
    deeperBullets: [
      bullet(
        "Greene links movement to morale. A side that keeps moving often feels more powerful than one with better ideas but no forward motion.",
        "Psychology follows tempo closely."
      ),
      bullet(
        "Stagnation creates fantasy. The longer people stay still, the more they imagine disastrous futures or perfect openings that never appear.",
        "Motion shrinks speculative fear."
      ),
      bullet(
        "This strategy also concerns narrative. The actor often looks stronger than the watcher even before results are settled.",
        "Visible initiative shapes interpretation."
      ),
      bullet(
        "Momentum compounds because each move alters the environment for the next one. Even modest action can produce reactions that open better later choices.",
        "Motion creates new terrain."
      ),
      bullet(
        "The broader lesson is that initiative is rarely given back cheaply once surrendered. Greene wants the reader to keep some forward energy alive so the campaign stays under chosen pressure rather than borrowed pressure.",
        "Tempo is not decoration. It is control."
      ),
    ],
    takeaways: [
      "Do not let fear own the clock",
      "Movement creates information",
      "Momentum unsettles rivals",
      "Use small steps to break paralysis",
      "Adjust while advancing",
      "Tempo is a form of control",
    ],
    practice: [
      "Choose the next move that reveals useful information",
      "Set a short deadline for the first action",
      "Protect tempo by avoiding unnecessary stalls",
      "Review what the field taught you after each move",
    ],
    examples: [
      example(
        "ch04-ex01",
        "Stalled product decision",
        ["work"],
        "A team keeps delaying a product decision because every option has some risk. Competitors are moving, internal energy is dropping, and the group keeps asking for one more round of certainty.",
        [
          "Pick the next reversible move that advances learning and keeps tempo alive.",
          "Do not wait for total clarity if moving now will expose the real constraints faster."
        ],
        "The strategy matters because stagnation often feels safe while position quietly decays. Motion can be the cleaner form of risk."
      ),
      example(
        "ch04-ex02",
        "Job search stuck in preparation mode",
        ["work"],
        "Someone spends weeks polishing materials and researching opportunities but delays actual outreach because they do not yet feel fully ready. The work feels productive, yet no campaign has really begun.",
        [
          "Convert preparation into outward motion by setting a first round of applications or conversations immediately.",
          "Use the responses from the field to improve the campaign instead of trying to perfect it in private."
        ],
        "Greene's point is that forward movement teaches more than private rehearsal once a contest is active."
      ),
      example(
        "ch04-ex03",
        "Student leader frozen by campus backlash",
        ["school"],
        "A student leader faces criticism and now hesitates to make any next move at all. Meetings become defensive, energy drops, and the group starts waiting for the controversy to resolve itself.",
        [
          "Take one controlled public step that shows the group is still capable of action and adjustment.",
          "Use visible movement to restore morale while you continue refining the larger plan."
        ],
        "The strategy applies because stillness under pressure often gives critics the emotional initiative."
      ),
      example(
        "ch04-ex04",
        "Group project losing momentum",
        ["school"],
        "A project team has a good plan, but nobody is moving because each member wants clearer instructions from the others first. The delay is creating more confusion than it is solving.",
        [
          "Assign the next concrete action and a short deadline so the project starts generating fresh information.",
          "Let early motion reveal where coordination is weak instead of trying to imagine every problem in advance."
        ],
        "Greene would say that action often organizes a group better than prolonged hesitation does."
      ),
      example(
        "ch04-ex05",
        "Personal goal trapped in overthinking",
        ["personal"],
        "A person wants to make a major life change but keeps collecting advice, scenarios, and reasons to wait for perfect timing. Months pass and the energy that once felt strong is turning into self doubt.",
        [
          "Choose one concrete move that shifts the goal from idea into campaign right away.",
          "Use motion to test the path rather than demanding certainty before the path begins."
        ],
        "The strategy matters because overthinking often masquerades as seriousness while actually serving fear."
      ),
      example(
        "ch04-ex06",
        "Relationship repair delayed too long",
        ["personal"],
        "After a conflict, someone keeps waiting for the ideal moment to reopen the conversation. The delay feels respectful, but it is also giving misunderstanding time to harden.",
        [
          "Take a measured step toward repair before silence becomes its own message.",
          "Use movement to reopen information flow instead of letting fear keep both sides frozen."
        ],
        "Greene's lesson is that controlled motion can prevent avoidable loss of initiative in personal conflict too."
      ),
    ],
    directQuestions: [
      question(
        "ch04-q01",
        "What is the main danger of hesitation in Greene's logic?",
        [
          "It always looks weak in public",
          "It often hands initiative and emotional advantage to the other side",
          "It prevents any future planning",
          "It makes adaptation impossible later"
        ],
        1,
        "He sees costly delay as a way of surrendering the clock and the tempo."
      ),
      question(
        "ch04-q02",
        "Why does movement often improve judgment?",
        [
          "Because it removes risk from the campaign",
          "Because it forces the field to answer back with usable information",
          "Because it guarantees morale forever",
          "Because the first plan is usually perfect"
        ],
        1,
        "Some truths only appear once action draws a real response."
      ),
      question(
        "ch04-q03",
        "What keeps movement strategic rather than reckless?",
        [
          "Total refusal to adjust",
          "Attachment to speed for its own sake",
          "A clear purpose joined to ongoing correction",
          "Ignoring the cost of tempo"
        ],
        2,
        "Greene wants purposeful momentum, not random activity."
      ),
      question(
        "ch04-q04",
        "What deeper principle closes this strategy?",
        [
          "Motion is useful mainly for appearances",
          "Tempo can become a form of control when it keeps a campaign alive and adaptive",
          "Stillness is always weakness",
          "Initiative matters less than certainty"
        ],
        1,
        "Momentum helps govern morale, information, and initiative all at once."
      ),
    ],
  }),
  chapter({
    chapterId: "ch05-build-moral-authority",
    number: 5,
    title: "Build Moral Authority",
    readingTimeMinutes: 14,
    summary: {
      p1: t(
        "People fight harder for leaders who seem to stand for something larger than appetite, and Greene argues that moral authority is strategic power, not sentimental decoration. A cause that feels disciplined, just, and larger than ego builds cohesion, sacrifice, and endurance that raw force rarely produces by itself.",
        "This does not mean preaching virtue while acting opportunistically underneath. Greene's point is that standards, fairness, and visible seriousness create followership because they make people believe the struggle has meaning and order.",
        "The strategy therefore joins legitimacy to effectiveness. Moral authority helps a leader ask more of others because others can see what the demands are serving."
      ),
      p2: t(
        "This matters because groups fall apart when they sense that sacrifice is being asked for someone else's vanity. Once followers start reading ambition without principle, morale weakens even if discipline still looks intact on the surface.",
        "The deeper lesson is that moral authority multiplies force through belief. It gives people reasons to endure setbacks, trust hard calls, and keep acting in alignment even when supervision is imperfect.",
        "In daily life, this often means earning legitimacy before demanding loyalty. Standards, fairness, and steadiness create influence that louder domination never fully secures."
      ),
    },
    standardBullets: [
      bullet(
        "Authority grows when people see standards behind it. Greene connects moral weight to disciplined behavior, not to slogans.",
        "Followers trust harder demands when they can see the rule behind them."
      ),
      bullet(
        "Do not ask sacrifice for vanity. People may comply for a while, but morale weakens when the cause serves ego more than purpose.",
        "Meaning matters in sustained conflict."
      ),
      bullet(
        "Visible fairness strengthens cohesion. Consistent standards make authority feel earned rather than arbitrary.",
        "Fair procedure often protects long term loyalty."
      ),
      bullet(
        "Tie the struggle to something larger than status. A cause with moral shape can hold people together through stress.",
        "Belief creates endurance."
      ),
      bullet(
        "Match message and conduct. Moral language without disciplined action quickly turns into cynicism.",
        "Hypocrisy drains authority faster than silence does."
      ),
      bullet(
        "Use standards to reduce internal friction. When people know what is being defended, energy is less likely to leak into side suspicion.",
        "Shared meaning organizes effort."
      ),
      bullet(
        "Moral authority improves difficult timing. People accept hard decisions more readily when they trust the intent and the rule behind them.",
        "Legitimacy softens resistance to necessary strain."
      ),
      bullet(
        "Avoid cheap righteousness. Greene is not asking for moral theater. He is asking for credible seriousness that people can test against conduct.",
        "Authority must survive scrutiny."
      ),
      bullet(
        "Protect the cause from pettiness. Small acts of favoritism or humiliation can undo the larger claim of justice.",
        "Little contradictions can poison belief."
      ),
      bullet(
        "The closing lesson is that belief can become strategic force. Moral authority gives a campaign coherence, trust, and stamina that pressure alone cannot produce.",
        "Legitimacy is a power source."
      ),
    ],
    deeperBullets: [
      bullet(
        "Greene is describing morale as a political asset. Once people believe the leader stands for something disciplined and fair, they contribute more than simple obedience.",
        "Belief widens capacity."
      ),
      bullet(
        "This strategy also explains why hypocrisy is so corrosive. It does not just offend ideals. It breaks the emotional contract that made sacrifice feel meaningful.",
        "Trust collapses when the standard is visibly fake."
      ),
      bullet(
        "Moral authority helps with decentralization. People make better unsupervised choices when they understand the larger principle guiding the campaign.",
        "Shared standards improve local judgment."
      ),
      bullet(
        "The cause does not need to be grandiose, but it does need to feel real. Even small groups want to know what their difficulty is serving beyond one person's mood.",
        "Meaning stabilizes effort."
      ),
      bullet(
        "The broader lesson is that legitimacy is not softness. It is a form of strategic depth that lets a leader ask for patience, discipline, and risk without constantly resorting to coercion.",
        "Greene treats moral authority as force with roots."
      ),
    ],
    takeaways: [
      "Standards create authority",
      "Do not ask sacrifice for ego",
      "Fairness strengthens cohesion",
      "Message and conduct must match",
      "Legitimacy improves endurance",
      "Belief can become force",
    ],
    practice: [
      "Name the principle the group is actually defending",
      "Check whether your conduct matches the standard you invoke",
      "Remove one source of unfairness that weakens trust",
      "Ask what sacrifice feels justified and what feels exploitative",
    ],
    examples: [
      example(
        "ch05-ex01",
        "Reorganization with fading trust",
        ["work"],
        "A manager needs the team to absorb a difficult reorganization, but people suspect the changes are really about the manager's image rather than about the work. Compliance exists, yet trust is thin.",
        [
          "Explain the principle behind the decision, apply the costs fairly, and show through your own conduct that you are sharing the burden rather than outsourcing it.",
          "Let visible fairness do more of the persuading than forceful messaging."
        ],
        "The strategy matters because people will endure strain more readily when they believe the hardship serves a real rule instead of private vanity."
      ),
      example(
        "ch05-ex02",
        "Leader losing credibility through favoritism",
        ["work"],
        "A team lead talks constantly about standards and accountability but quietly excuses one favored employee. The double standard is becoming common knowledge and draining the lead's authority.",
        [
          "Repair the standard in practice before trying to repair it in language.",
          "Remove the favoritism and show that the rule applies even where it costs you comfort."
        ],
        "Greene would say moral authority is built through visible consistency. Once the cause looks selective, loyalty weakens."
      ),
      example(
        "ch05-ex03",
        "Campus group asking for more than it has earned",
        ["school"],
        "A student organization wants members to commit more time and effort, but newer members do not yet trust that leadership uses that effort fairly or for a meaningful purpose.",
        [
          "Clarify what the work serves, apply expectations consistently, and demonstrate standards through leadership behavior before demanding heavier sacrifice.",
          "Earn belief first if you want enduring effort later."
        ],
        "The strategy applies because people do not give their best to structures that feel arbitrary or self serving."
      ),
      example(
        "ch05-ex04",
        "Club president preaching values without living them",
        ["school"],
        "A club president talks about respect and inclusion while handling disagreement with sarcasm and side conversations. Members hear the values, but they trust the behavior more than the speech.",
        [
          "Stop trying to preserve moral authority through language alone and rebuild it through consistent conduct.",
          "Treat every small public interaction as evidence for or against the standard you claim."
        ],
        "Greene's lesson is that legitimacy lives in observable behavior, not in declared ideals by themselves."
      ),
      example(
        "ch05-ex05",
        "Family member asking for patience without fairness",
        ["personal"],
        "One person in a family keeps asking others to be patient and supportive during a stressful season, but the person is not carrying the burden fairly and is using moral language to hide uneven demands.",
        [
          "Make the burden visible, distribute it more fairly, and stop invoking duty where trust has not been earned.",
          "Use fairness to rebuild authority before asking for more patience."
        ],
        "The strategy matters because sacrifice feels noble only when people believe it is being asked under a credible rule."
      ),
      example(
        "ch05-ex06",
        "Volunteer group losing belief",
        ["personal"],
        "A volunteer organizer wants more commitment from the group, but members are quietly questioning whether the project still stands for what it claims. Energy is falling because meaning is fading.",
        [
          "Reconnect the work to a clear principle and remove the small hypocrisies that are making the project feel hollow.",
          "Let conduct restore belief before you push harder on discipline."
        ],
        "Greene would say morale weakens when the cause loses moral weight. Belief has to be maintained as carefully as logistics."
      ),
    ],
    directQuestions: [
      question(
        "ch05-q01",
        "Why does Greene treat moral authority as strategic rather than decorative?",
        [
          "Because it makes leaders sound kinder",
          "Because belief, fairness, and visible seriousness increase cohesion and endurance",
          "Because moral language removes all conflict",
          "Because status alone creates loyalty"
        ],
        1,
        "He sees legitimacy as a force multiplier that can hold effort together under strain."
      ),
      question(
        "ch05-q02",
        "What most weakens moral authority?",
        [
          "Refusing to use any slogans",
          "Asking sacrifice while visibly serving vanity or favoritism",
          "Explaining the purpose of a campaign",
          "Applying standards consistently"
        ],
        1,
        "Authority collapses when people see the claimed standard and the lived standard separating."
      ),
      question(
        "ch05-q03",
        "Why does fairness matter so much in this strategy?",
        [
          "It makes difficult demands feel more credible and less arbitrary",
          "It guarantees no one will resist",
          "It removes the need for structure",
          "It makes moral language unnecessary"
        ],
        0,
        "Visible fairness helps people trust both the intent and the burden of the campaign."
      ),
      question(
        "ch05-q04",
        "What deeper principle closes this strategy?",
        [
          "Legitimacy is a soft alternative to force",
          "Belief can become a durable source of strategic power",
          "Groups only need clear punishments",
          "Authority matters less than morale"
        ],
        1,
        "Greene treats moral authority as force with deeper roots than pressure alone."
      ),
    ],
  }),
  chapter({
    chapterId: "ch06-set-a-disciplined-pace",
    number: 6,
    title: "Set a Disciplined Pace",
    readingTimeMinutes: 13,
    summary: {
      p1: t(
        "A campaign is often lost through bad rhythm rather than through one dramatic error, and Greene argues that pace has to be managed deliberately. Leaders who lurch between frenzy and collapse exhaust themselves, exhaust their teams, and teach opponents that they can simply wait for the burst to burn out.",
        "This strategy treats rhythm as a form of command. A disciplined pace helps you preserve strength, sequence effort, and keep pressure meaningful instead of noisy.",
        "Greene is not praising slowness. He is praising controlled expenditure. The right pace lets you keep moving without spending tomorrow's strength for the sake of today's excitement."
      ),
      p2: t(
        "This matters because intensity often looks like commitment, especially in competitive settings. But many people mistake urgency for progress and end up creating a campaign that cannot be sustained.",
        "The deeper lesson is that pace shapes morale and perception. A stable rhythm makes you look harder to shake, while erratic surges make you easier to bait, tire, and read.",
        "In practical life, disciplined pace means knowing when to press, when to pause, and how to keep the whole effort aligned with the length of the contest rather than with the mood of the hour."
      ),
    },
    standardBullets: [
      bullet(
        "Treat rhythm as strategy. Greene wants pace chosen, not merely suffered.",
        "A stable tempo keeps effort useful over time."
      ),
      bullet(
        "Do not peak too early. Huge early expenditure can leave a campaign hollow when the hardest phase finally arrives.",
        "Bad pacing turns strength into waste."
      ),
      bullet(
        "Avoid the frenzy crash cycle. Bursts followed by exhaustion make your pressure easy to survive.",
        "Opponents learn to wait you out."
      ),
      bullet(
        "Budget force across the whole contest. The campaign matters more than the emotion of a single round.",
        "Disciplined pacing protects long range capacity."
      ),
      bullet(
        "Use pauses deliberately. A pause that restores order is different from a stall born of drift or fear.",
        "Recovery can be strategic when it is chosen."
      ),
      bullet(
        "Set a rhythm others can follow. Teams break when leaders demand permanent emergency energy.",
        "Good pace sustains coordination."
      ),
      bullet(
        "Keep tempo steady enough to signal confidence. Erratic speed often reveals insecurity or lack of plan.",
        "Rhythm is also communication."
      ),
      bullet(
        "Adjust pace to the terrain. Not every phase of a conflict requires the same speed or pressure.",
        "Disciplined pace still leaves room for variation."
      ),
      bullet(
        "Watch for emotional overspending. Ego, fear, and excitement all tempt you to spend more than the situation really requires.",
        "Mood is a bad timekeeper."
      ),
      bullet(
        "The closing lesson is that endurance depends on rhythm. Set the pace so you can keep pressure meaningful without draining the campaign dry.",
        "Control over tempo is control over staying power."
      ),
    ],
    deeperBullets: [
      bullet(
        "Greene treats pacing as a hidden form of power. The side that controls rhythm often controls the emotional weather of the contest.",
        "Tempo shapes how urgency is experienced."
      ),
      bullet(
        "This strategy also protects decision quality. Exhausted people make grand gestures, shallow reads, and costly concessions simply to reduce strain.",
        "Bad rhythm weakens judgment as well as stamina."
      ),
      bullet(
        "A disciplined pace denies easy manipulation. Opponents cannot provoke you into reckless spending as easily when you already know what rate of effort the campaign can bear.",
        "Measured rhythm closes baited openings."
      ),
      bullet(
        "Pace is contagious inside groups. A leader's rhythm becomes the group's assumption about how conflict must be handled.",
        "That is why personal frenzy spreads so fast through teams."
      ),
      bullet(
        "The broader lesson is that rhythm turns ambition into durability. Greene wants sustained force, not theatrical exhaustion.",
        "The campaign should still have strength left after today's round is over."
      ),
    ],
    takeaways: [
      "Pace is a strategic choice",
      "Do not spend everything early",
      "Avoid frenzy and collapse",
      "Set a rhythm others can sustain",
      "Pause with purpose",
      "Endurance depends on tempo",
    ],
    practice: [
      "Define the pace the contest can actually sustain",
      "Cut one source of theatrical urgency",
      "Plan the next pause as carefully as the next push",
      "Check where mood is overspending future energy",
    ],
    examples: [
      example(
        "ch06-ex01",
        "Team stuck in permanent emergency",
        ["work"],
        "A manager keeps pushing the team with crisis language even when the work now requires steady execution more than adrenaline. People are still moving fast, but mistakes and quiet resentment are rising.",
        [
          "Reset the pace around the actual length of the campaign instead of around the leader's anxiety.",
          "Keep urgency for true pressure points and build a rhythm the team can maintain without burning accuracy away."
        ],
        "Greene's lesson is that constant emergency drains authority and stamina together. Pace has to match the real contest, not the leader's mood."
      ),
      example(
        "ch06-ex02",
        "Job search burnout",
        ["work"],
        "Someone attacks a job search with extreme energy for one week, then disappears from it for the next two because the pace cannot be sustained. The campaign keeps restarting from an emotional spike instead of building momentum.",
        [
          "Set a weekly rhythm that is demanding but repeatable instead of relying on bursts of panic.",
          "Judge the search by consistency over time, not by the intensity of one anxious sprint."
        ],
        "This strategy matters because uneven rhythm makes long contests feel endless and much harder than they need to be."
      ),
      example(
        "ch06-ex03",
        "Student collapse before finals",
        ["school"],
        "A student works at maximum intensity for several days, sleeps badly, and then loses focus right when exams become hardest. The effort was real, but the pace made the effort self defeating.",
        [
          "Shift from heroic bursts to a pace that preserves judgment through the full exam period.",
          "Protect sleep, review rhythm, and recovery as part of the strategy, not as luxuries outside it."
        ],
        "Greene would say a campaign is badly paced when its earliest effort weakens its most important phase."
      ),
      example(
        "ch06-ex04",
        "Club organizer creating chaos through speed",
        ["school"],
        "A club organizer changes timelines and expectations every few days because urgency feels like leadership. Members stop trusting the rhythm and begin conserving effort because they expect more chaos soon.",
        [
          "Set a tempo that people can believe in and stop rewarding your own restlessness with new deadlines.",
          "Let steady cadence, not dramatic escalation, prove seriousness."
        ],
        "The strategy applies because erratic pace makes followers defensive. People stop giving full effort when rhythm feels unreliable."
      ),
      example(
        "ch06-ex05",
        "Relationship repair pushed too hard",
        ["personal"],
        "After a serious argument, one person wants to repair everything immediately and keeps forcing long conversations every day. The pressure is meant as commitment, but it is actually overwhelming the process.",
        [
          "Set a pace that allows both honesty and recovery instead of treating nonstop intensity as proof of care.",
          "Use steady follow through rather than emotional flooding to rebuild trust."
        ],
        "Greene's point is that bad rhythm can damage even good intent when it ignores the actual pace required for durable progress."
      ),
      example(
        "ch06-ex06",
        "Personal goal run like a sprint",
        ["personal"],
        "Someone starts a major health or financial goal with severe restrictions and total discipline for ten days, then crashes and abandons it. The pace was built for excitement, not for victory.",
        [
          "Choose a demanding rhythm that can survive ordinary life instead of designing for a short heroic phase.",
          "Treat repeatability as part of the strategy, not as a compromise with seriousness."
        ],
        "This strategy matters because sustainable force beats unstable intensity in long contests almost every time."
      ),
    ],
    directQuestions: [
      question(
        "ch06-q01",
        "Why does Greene care so much about pace?",
        [
          "Because rhythm determines whether effort can stay effective across the whole campaign",
          "Because speed alone wins every conflict",
          "Because pauses always signal weakness",
          "Because planning removes the need for recovery"
        ],
        0,
        "He treats tempo as a strategic resource that protects stamina, morale, and sequence."
      ),
      question(
        "ch06-q02",
        "What is the main problem with frenzy followed by collapse?",
        [
          "It makes a leader look too emotional",
          "It teaches opponents and teammates that your pressure will not last",
          "It prevents any early success",
          "It makes people less ambitious forever"
        ],
        1,
        "Broken rhythm turns pressure into something other people can simply survive."
      ),
      question(
        "ch06-q03",
        "When is a pause strategic in this chapter's logic?",
        [
          "When it is used to restore order and preserve the campaign",
          "Whenever the work becomes uncomfortable",
          "When it hides lack of commitment",
          "When it replaces sequence with drift"
        ],
        0,
        "Greene distinguishes chosen recovery from avoidance or collapse."
      ),
      question(
        "ch06-q04",
        "What deeper principle closes this strategy?",
        [
          "Pace matters mainly for appearances",
          "Endurance comes from controlled expenditure rather than from repeated bursts of excitement",
          "Long contests should always be fought slowly",
          "Mood is a good guide for tempo"
        ],
        1,
        "He wants sustainable force that can still matter later, not energy spent for drama now."
      ),
    ],
  }),
  chapter({
    chapterId: "ch07-turn-resistance-into-fuel",
    number: 7,
    title: "Turn Resistance Into Fuel",
    readingTimeMinutes: 13,
    summary: {
      p1: t(
        "Resistance is not only an obstacle. Greene argues that opposition can sharpen commitment, expose what matters, and give a campaign energy if it is interpreted correctly. The problem is not resistance itself. The problem is responding to it with self pity, confusion, or diffuse anger.",
        "This strategy asks the reader to convert friction into definition. Obstacles show where the field pushes back, where morale is weak, and where the cause still lacks enough force or clarity.",
        "Greene's point is that resistance can organize you. It can harden resolve, refine method, and turn vague intention into serious effort if you stop treating every setback as a verdict against the campaign."
      ),
      p2: t(
        "This matters because many people expect the right path to feel confirmed early. When they hit resistance, they either collapse, overreact, or personalize the pushback instead of using it.",
        "The deeper lesson is that friction can be diagnostic and motivating at the same time. It tells you where pressure is real, and it can also create the urgency needed to stop drifting or fantasizing.",
        "In real situations, this strategy does not mean loving every obstacle. It means refusing to hand resistance the final word. The setback becomes material for stronger strategy rather than proof that the effort should dissolve."
      ),
    },
    standardBullets: [
      bullet(
        "Do not read resistance as automatic defeat. Greene wants friction treated as part of real conflict, not as evidence that the campaign was mistaken.",
        "Early pushback is often normal."
      ),
      bullet(
        "Use opposition to clarify the cause. Resistance shows what the other side fears, protects, or values enough to defend.",
        "Friction reveals hidden stakes."
      ),
      bullet(
        "Turn anger into disciplined effort. Raw outrage burns fast, but shaped resistance can produce sharper focus.",
        "Emotion needs direction to become useful."
      ),
      bullet(
        "Let obstacles refine method. When the first route is blocked, the blockage itself can teach where the field is strongest and weakest.",
        "Resistance is information if you can read it."
      ),
      bullet(
        "Avoid the self pity trap. Feeling wronged can become its own narcotic and stall real adaptation.",
        "Victim emotion often weakens agency."
      ),
      bullet(
        "Use challenge to harden morale. Shared difficulty can unite a team more strongly than easy progress does.",
        "Resistance can build collective seriousness."
      ),
      bullet(
        "Do not worship struggle for its own sake. The aim is to convert friction into advantage, not to become addicted to hardship theater.",
        "Pain alone is not strategy."
      ),
      bullet(
        "Choose the lesson fast. Long complaint periods let resistance consume the energy it might have sharpened.",
        "Meaning has to be claimed quickly."
      ),
      bullet(
        "Use resistance to prove seriousness to yourself. What survives pressure becomes more believable as a commitment.",
        "Difficulty can separate wish from decision."
      ),
      bullet(
        "The closing lesson is that opposition can strengthen the campaign when it is turned into information, resolve, and better design.",
        "Resistance becomes fuel only when it is interpreted with discipline."
      ),
    ],
    deeperBullets: [
      bullet(
        "Greene is interested in how resistance changes energy. The same obstacle can either scatter a campaign or concentrate it depending on the frame brought to it.",
        "Interpretation decides whether friction weakens or hardens."
      ),
      bullet(
        "This strategy also protects realism. Easy progress can tempt fantasy, while real pushback forces a clearer reading of the environment.",
        "Opposition can restore truth to the plan."
      ),
      bullet(
        "Shared hardship often creates stronger identity than shared comfort does. Groups become more cohesive when difficulty is made meaningful instead of being treated as random suffering.",
        "Resistance can organize belonging."
      ),
      bullet(
        "There is a warning here as well. Some people secretly need resistance because it gives them emotional drama. Greene wants conversion, not addiction.",
        "The obstacle should strengthen the campaign, not become the campaign."
      ),
      bullet(
        "The broader lesson is that resilient strategy metabolizes pressure. It learns, concentrates, and continues rather than collapsing into complaint or blind retaliation.",
        "Fuel is resistance transformed, not resistance endured passively."
      ),
    ],
    takeaways: [
      "Resistance is not automatic defeat",
      "Friction reveals stakes",
      "Convert anger into focused effort",
      "Do not romanticize hardship",
      "Choose the lesson quickly",
      "Opposition can harden morale",
    ],
    practice: [
      "Name what the resistance is revealing",
      "Cut complaint time and move to adjustment",
      "Translate frustration into one disciplined next step",
      "Check whether the obstacle is sharpening or distracting the campaign",
    ],
    examples: [
      example(
        "ch07-ex01",
        "Stakeholder rejects the first proposal",
        ["work"],
        "A team gets strong resistance from a stakeholder and starts slipping into a mix of anger and discouragement. Some people want to quit the idea. Others want to attack the stakeholder personally.",
        [
          "Read the resistance for what it reveals about incentives, fear, and power before deciding how to respond.",
          "Turn the pushback into a sharper version of the proposal or a cleaner plan for where the real contest now sits."
        ],
        "Greene's lesson is that opposition becomes fuel when it clarifies the field instead of turning the team inward against itself."
      ),
      example(
        "ch07-ex02",
        "Repeated rejection in a sales or hiring process",
        ["work"],
        "Someone takes repeated rejection as proof that the whole effort is failing and starts swinging between despair and random tactic changes. The pressure is real, but the interpretation is making it worse.",
        [
          "Use the resistance to identify what pattern keeps getting rejected and what should actually be refined.",
          "Channel the frustration into a steadier method instead of treating each setback as a verdict on your value."
        ],
        "This strategy matters because resistance can mature effort when it is turned into diagnosis instead of identity damage."
      ),
      example(
        "ch07-ex03",
        "Campus event meets criticism",
        ["school"],
        "A student group announces an event and immediately faces criticism that makes members defensive. The group is now tempted either to shut down or to lash out without learning anything from the reaction.",
        [
          "Separate bad faith attacks from meaningful resistance and use the meaningful part to strengthen the plan.",
          "Let the pushback sharpen the group's seriousness instead of dissolving it into complaint."
        ],
        "Greene wants groups to metabolize pressure. The right obstacle can make the campaign smarter and more committed."
      ),
      example(
        "ch07-ex04",
        "Study group loses confidence after one bad result",
        ["school"],
        "A study group performs poorly on a first exam and starts acting as though the whole plan was wrong. Morale drops because difficulty is being read as failure instead of as feedback.",
        [
          "Use the setback to identify the weak points in method, pace, and preparation.",
          "Make the loss meaningful quickly so it strengthens effort rather than draining it."
        ],
        "The strategy applies because early resistance often decides whether a group becomes more serious or simply more emotional."
      ),
      example(
        "ch07-ex05",
        "Family pushback on a major change",
        ["personal"],
        "Someone tries to make an important life change and receives discouraging reactions from family members. The pushback makes the goal feel less solid because the resistance is being felt more than interpreted.",
        [
          "Ask what the resistance is actually protecting and what part of it offers useful information.",
          "Use the friction to clarify your reason and improve the plan instead of giving the first negative reaction total authority."
        ],
        "Greene's point is that opposition can test and strengthen commitment if it is turned into clarity rather than shame."
      ),
      example(
        "ch07-ex06",
        "Friend group resists a needed boundary",
        ["personal"],
        "A person finally sets a boundary in a friend group and receives irritation in return. The resistance creates doubt about whether the boundary was right at all.",
        [
          "Treat the discomfort as evidence that something real was touched, then decide whether the boundary still serves the long term position.",
          "Use the resistance to refine the way you hold the line, not to erase the line automatically."
        ],
        "This strategy matters because resistance often appears precisely when a move matters. The key is converting it into steadier conviction rather than instant retreat."
      ),
    ],
    directQuestions: [
      question(
        "ch07-q01",
        "What is Greene's main claim about resistance?",
        [
          "It proves the campaign was always wrong",
          "It should be ignored emotionally and strategically",
          "It can be turned into clarity, resolve, and better method",
          "It matters only for morale"
        ],
        2,
        "He wants pressure converted into stronger strategy rather than treated as final defeat."
      ),
      question(
        "ch07-q02",
        "What most often wastes the value of resistance?",
        [
          "Immediate learning",
          "Self pity and unfocused retaliation",
          "Better sequencing",
          "Sharper reading of the field"
        ],
        1,
        "Complaint and scattered anger consume the energy that resistance could have sharpened."
      ),
      question(
        "ch07-q03",
        "Why can resistance strengthen group morale?",
        [
          "Because hardship is always good",
          "Because shared difficulty can make commitment more real when it is given meaning",
          "Because pressure removes the need for leadership",
          "Because conflict automatically creates trust"
        ],
        1,
        "Meaningful hardship can unite a group more deeply than easy progress does."
      ),
      question(
        "ch07-q04",
        "What deeper principle closes this strategy?",
        [
          "Fuel is resistance turned into disciplined advantage",
          "Obstacles should be sought for drama",
          "Resistance matters more than the objective",
          "Any setback should provoke a stronger attack"
        ],
        0,
        "Greene wants the campaign strengthened by pressure, not fascinated by it."
      ),
    ],
  }),
  chapter({
    chapterId: "ch08-choose-your-arena",
    number: 8,
    title: "Choose Your Arena",
    readingTimeMinutes: 14,
    summary: {
      p1: t(
        "Position shapes outcome before the visible clash begins, and Greene argues that strong strategists do not accept the other side's chosen field without question. The arena can be physical, social, procedural, or psychological, but in every case it determines which strengths matter, which weaknesses are exposed, and who feels more natural in the exchange.",
        "This strategy is about forcing conflict onto ground that favors your design rather than your opponent's habits. Better terrain can make the same amount of force far more effective.",
        "Greene's lesson is that many people lose by entering the wrong setting too quickly. They accept a frame, pace, audience, or process that quietly advantages the other side and then act surprised when their own strengths do not land."
      ),
      p2: t(
        "This matters because the arena is often chosen before people notice that a choice was made at all. One side sets the meeting, the medium, the timing, or the audience, and the whole exchange starts leaning in their favor.",
        "The deeper lesson is that position is leverage in disguised form. Once you control the field, you influence how people read confidence, evidence, speed, and legitimacy.",
        "In real life, choosing your arena can mean moving a hard conversation into private space, slowing a rushed decision, changing the format of debate, or refusing terms that reward the other side's strongest habits."
      ),
    },
    standardBullets: [
      bullet(
        "The field is part of the fight. Greene wants you to read the setting as strategy, not background.",
        "Where conflict happens often shapes who looks stronger."
      ),
      bullet(
        "Do not accept the opponent's preferred ground by default. Their chosen setting usually rewards their habits and resources.",
        "Unexamined terrain gives away hidden advantage."
      ),
      bullet(
        "Arena includes medium and audience. A message in public, private, writing, or live debate can change the balance completely.",
        "Format is never neutral."
      ),
      bullet(
        "Use the field to magnify your strengths. Good positioning lets the same effort travel farther.",
        "Better ground can multiply limited force."
      ),
      bullet(
        "Make the other side less comfortable. You do not need unfairness. You need terms that stop them from playing only their favorite game.",
        "Shift them out of automatic advantage."
      ),
      bullet(
        "Read procedural terrain too. Deadlines, agendas, and decision rules are part of the arena.",
        "Process can decide before argument does."
      ),
      bullet(
        "Take time to reposition when needed. Entering bad ground fast is usually worse than delaying to improve the field.",
        "Good placement can justify patience."
      ),
      bullet(
        "Do not confuse boldness with accepting hostile terms. Walking into the wrong setting may look brave while actually being careless.",
        "Selection is part of courage."
      ),
      bullet(
        "Use arena choice to reduce noise. The right setting can calm ego, lower audience pressure, and make truth easier to surface.",
        "Field design affects emotional temperature."
      ),
      bullet(
        "The closing lesson is that better ground changes the whole contest. Choose the arena so your strengths become easier to use and theirs harder to hide behind.",
        "Position is one of the cheapest forms of leverage."
      ),
    ],
    deeperBullets: [
      bullet(
        "Greene treats terrain broadly because modern conflict is often procedural or psychological rather than physical. The room, the channel, and the audience all shape force.",
        "Arena is any structure that governs what counts."
      ),
      bullet(
        "This strategy also changes interpretation. The same statement can sound strong in one setting and weak in another because the arena alters what people notice.",
        "Perception is partly positional."
      ),
      bullet(
        "Choosing the arena is an early act of authorship. It lets you define the rules of relevance before the main exchange even begins.",
        "That is why it can feel minor and still matter greatly."
      ),
      bullet(
        "Poor arena choice often comes from impatience. People want the fight now and forget to ask whether now and here actually serve them.",
        "Urgency can be positional laziness."
      ),
      bullet(
        "The broader lesson is that terrain does quiet work. Greene wants the reader to notice how much advantage can be won before the visible contest starts at all.",
        "Good positioning makes later force less expensive."
      ),
    ],
    takeaways: [
      "The field shapes the outcome",
      "Do not accept hostile terms by default",
      "Audience and medium are part of terrain",
      "Position can magnify limited force",
      "Process is also an arena",
      "Good ground makes later moves cheaper",
    ],
    practice: [
      "Ask who benefits most from the current setting",
      "Change one medium, time, or audience condition before engaging",
      "Pick the field that makes your strength easier to use",
      "Refuse terms that reward the other side's habits",
    ],
    examples: [
      example(
        "ch08-ex01",
        "Public meeting set up to corner a manager",
        ["work"],
        "A difficult issue is being pushed into a large public meeting where one executive is strongest in live dominance and rapid pressure. The manager knows the current setting favors theater over real problem solving.",
        [
          "Move the key decision into a smaller setting or written process where facts and sequence matter more than performance pressure.",
          "Do not accept the original field just because the invitation arrived that way."
        ],
        "Greene's point is that arena choice often decides whether you are arguing on evidence or merely surviving someone else's style."
      ),
      example(
        "ch08-ex02",
        "Job interview on the wrong terms",
        ["work"],
        "An applicant keeps getting pulled into fast conversational interviews that reward charm more than thoughtful work, even though the applicant's real advantage is depth, preparation, and problem solving.",
        [
          "Create opportunities to show work in a medium that better fits your strengths, such as a case response, portfolio, or follow up memo.",
          "Reposition the exchange instead of treating the original format as sacred."
        ],
        "This strategy matters because better ground can let real strengths appear that hostile formats would hide."
      ),
      example(
        "ch08-ex03",
        "Club dispute playing out in group chat",
        ["school"],
        "A club conflict is unfolding in a large group chat where speed, sarcasm, and audience effects are rewarding the wrong voices. The current arena is making the problem worse.",
        [
          "Move the serious part of the conflict into a setting that lowers performance and increases clarity.",
          "Choose a field where sequence, facts, and resolution can actually happen."
        ],
        "The strategy applies because medium is not neutral. Some arenas reward heat more than truth."
      ),
      example(
        "ch08-ex04",
        "Class debate with bad framing",
        ["school"],
        "A student knows a debate topic has been framed in a way that narrows the options and quietly favors the opponent's prepared angle. Entering without changing the frame would mean arguing uphill from the start.",
        [
          "Challenge the frame or widen the criteria before the main debate begins.",
          "Treat framing itself as the arena and refuse to start from terms that already weaken your position."
        ],
        "Greene would say that the person who defines the field often wins before the first strong point is made."
      ),
      example(
        "ch08-ex05",
        "Hard family conversation in the wrong place",
        ["personal"],
        "Someone wants to raise a serious issue during a crowded family dinner because that is the only time everyone is together. The setting almost guarantees defensiveness and performance.",
        [
          "Move the conversation to a smaller and calmer arena where the real issue can be heard without audience pressure.",
          "Choose a field that serves resolution instead of spectacle."
        ],
        "The strategy matters because some settings reward honesty while others reward face saving and escalation."
      ),
      example(
        "ch08-ex06",
        "Relationship issue handled only by text",
        ["personal"],
        "A couple keeps trying to resolve a sensitive issue through text because it feels easier than speaking live. The medium is stripping tone, increasing assumption, and rewarding misreading.",
        [
          "Shift the conflict into a format that matches the seriousness of the issue and allows nuance to survive.",
          "Do not let convenience choose an arena that repeatedly damages the result."
        ],
        "Greene's lesson is that good terrain is often simply the setting in which your best judgment can actually work."
      ),
    ],
    directQuestions: [
      question(
        "ch08-q01",
        "What does Greene mean by choosing your arena?",
        [
          "Picking the most dramatic place to fight",
          "Selecting the setting, medium, and process that shape which strengths matter",
          "Avoiding conflict whenever possible",
          "Refusing all public action"
        ],
        1,
        "He treats the field broadly because setting often decides leverage before the main exchange begins."
      ),
      question(
        "ch08-q02",
        "Why is accepting the other side's preferred ground risky?",
        [
          "Because bold opponents never use fair settings",
          "Because their chosen field usually rewards their habits and hides yours",
          "Because it makes timing irrelevant",
          "Because it always creates public conflict"
        ],
        1,
        "Unexamined terrain often carries unearned advantage."
      ),
      question(
        "ch08-q03",
        "What is one of the cheapest sources of leverage in this strategy?",
        [
          "Louder emotion",
          "Better positioning before the clash starts",
          "Refusing all procedure",
          "Moving faster than anyone else"
        ],
        1,
        "Good ground can multiply ordinary effort without adding drama."
      ),
      question(
        "ch08-q04",
        "What deeper principle closes this strategy?",
        [
          "Position quietly shapes interpretation and force across the whole contest",
          "Process matters less than courage",
          "The arena is mostly background scenery",
          "Any field can be mastered by pure will"
        ],
        0,
        "Greene wants readers to see how much is decided by terrain before visible combat begins."
      ),
    ],
  }),
  chapter({
    chapterId: "ch09-make-conflict-selective",
    number: 9,
    title: "Make Conflict Selective",
    readingTimeMinutes: 13,
    summary: {
      p1: t(
        "Not every provocation deserves battle, and Greene argues that selective conflict is a sign of strength rather than timidity. Strategy improves when you choose the fights that matter, decline the ones that only drain you, and treat attention as a limited resource that should be spent where outcomes actually move.",
        "This does not mean avoiding all conflict. It means refusing to be pulled into every collision, every insult, and every small contest that someone else can use to tire, distract, or misdirect you.",
        "Greene's central lesson is that economy protects power. A person who fights everything soon has less force for what truly counts."
      ),
      p2: t(
        "This matters because conflict often arrives in clusters. Small affronts, side disputes, and symbolic tests crowd around the main issue and tempt you to respond to all of them as proof of seriousness.",
        "The deeper lesson is that refusing a bad fight can be more strategic than winning it. Selectivity preserves morale, time, reputation, and surprise for the contests where the result has real consequence.",
        "In practice, this strategy means asking a hard question early: if I win this exchange, what truly changes. If the answer is thin, the battle may belong on the list of things to let pass or postpone."
      ),
    },
    standardBullets: [
      bullet(
        "Choose battles by consequence. Greene wants conflict measured by what it changes, not by how strongly it stings.",
        "Importance is a better guide than irritation."
      ),
      bullet(
        "Do not answer every provocation. Some fights are designed mainly to drain attention and force early reaction.",
        "Refusal can protect leverage."
      ),
      bullet(
        "Save strength for decisive points. Economy matters because no campaign has unlimited time, energy, or goodwill.",
        "Selective spending preserves power."
      ),
      bullet(
        "Let small losses prevent larger waste when needed. Not every retreat is defeat and not every concession is weakness.",
        "Strategy prices the whole field, not the ego of one exchange."
      ),
      bullet(
        "Separate symbolic threats from material ones. Some challenges hurt pride more than position.",
        "That distinction helps choose wisely."
      ),
      bullet(
        "Use nonengagement as a tool. Silence, delay, or redirection can be stronger than immediate reply.",
        "Not fighting can still be active strategy."
      ),
      bullet(
        "Avoid turning life into a permanent war state. Constant combat makes judgment rough and alliances harder to hold.",
        "Overfighting damages the campaign itself."
      ),
      bullet(
        "Pick conflicts you can shape. A battle chosen on someone else's terms often costs more than it is worth.",
        "Selection and arena work together."
      ),
      bullet(
        "Explain selectivity to your side when needed. Followers sometimes mistake nonresponse for weakness if they do not understand the larger campaign.",
        "Context can protect morale."
      ),
      bullet(
        "The closing lesson is that disciplined refusal is part of real strength. Fight where the result matters and let lesser contests starve.",
        "Selectivity keeps force concentrated."
      ),
    ],
    deeperBullets: [
      bullet(
        "Greene is attacking vanity warfare. Many people fight to feel intact in the moment rather than to improve their long term position.",
        "Selectivity protects against ego taxation."
      ),
      bullet(
        "This strategy also protects reputation. A person who battles everything starts to look unstable, thin skinned, or easy to manipulate.",
        "Measured engagement often reads as stronger."
      ),
      bullet(
        "Declining a fight can create strategic ambiguity. Others cannot always tell whether you are ignoring, storing, or redirecting their move.",
        "That uncertainty can itself be useful."
      ),
      bullet(
        "Selective conflict sharpens morale because it gives each chosen battle more weight and clarity. Constant skirmishing makes serious effort harder to rally.",
        "Economy helps significance survive."
      ),
      bullet(
        "The broader lesson is that power leaks through unnecessary engagement. Greene wants force concentrated around decisive stakes rather than scattered across every emotional demand for response.",
        "Restraint is part of concentration."
      ),
    ],
    takeaways: [
      "Do not answer every provocation",
      "Fight by consequence not by sting",
      "Save strength for decisive points",
      "Nonengagement can be active strategy",
      "Small concessions can prevent bigger waste",
      "Selectivity protects concentration",
    ],
    practice: [
      "Ask what winning this exchange would actually change",
      "List one provocation that does not deserve your force",
      "Protect energy for the main contest",
      "Use silence or delay where immediate reply adds no value",
    ],
    examples: [
      example(
        "ch09-ex01",
        "Manager baited into every side dispute",
        ["work"],
        "A manager is trying to lead a major project but keeps getting pulled into minor status skirmishes and side complaints that do not change the real delivery risk. The manager feels rude ignoring them, yet the main work is slipping.",
        [
          "Sort the issues by actual consequence and stop spending leadership energy on fights that do not affect the campaign.",
          "Answer the important conflicts clearly and let lesser provocations lose oxygen."
        ],
        "Greene's point is that attention spent everywhere becomes power spent nowhere important."
      ),
      example(
        "ch09-ex02",
        "Negotiation with endless small demands",
        ["work"],
        "A counterpart keeps raising new small objections in a negotiation. Each one invites a separate debate, and the deal is slowly being drained by issues that are more tiring than meaningful.",
        [
          "Refocus the negotiation on the limited points that truly determine the result instead of treating every objection as equally important.",
          "Use selectivity to prevent the conversation from becoming a war of attrition on trivial ground."
        ],
        "This strategy matters because some conflicts are designed less to win than to wear you down."
      ),
      example(
        "ch09-ex03",
        "Student leader pulled into online fights",
        ["school"],
        "A student leader keeps responding to every comment and criticism online because silence feels weak. The result is that the leader is constantly fighting small fires and losing sight of the actual campaign.",
        [
          "Choose the few conflicts that affect real support or real outcomes and let the rest pass without ritual combat.",
          "Treat nonresponse as a tool when the battle offers no meaningful gain."
        ],
        "The strategy applies because public noise can consume all your force if you let every challenge define seriousness."
      ),
      example(
        "ch09-ex04",
        "Group project with too many side battles",
        ["school"],
        "A project group is arguing about tone, credit, timing, and effort all at once. Some issues matter. Others are merely multiplying tension.",
        [
          "Name the one or two conflicts that directly affect the outcome and suspend the rest until the main work is secure.",
          "Do not let emotional crowding disguise which battles are truly worth having."
        ],
        "Greene would say selectivity keeps the group from bleeding itself out on secondary fronts."
      ),
      example(
        "ch09-ex05",
        "Family member answering every jab",
        ["personal"],
        "Someone in a family keeps correcting every unfair comment because letting any remark pass feels like surrender. The person is always engaged and always exhausted.",
        [
          "Choose the few moments where speaking up protects something real and let smaller jabs die without full battle.",
          "Measure the exchange by what changes afterward, not by how sharp the comment felt in the moment."
        ],
        "The strategy matters because constant engagement can turn minor friction into a lifestyle of depletion."
      ),
      example(
        "ch09-ex06",
        "Friend group with endless small dramas",
        ["personal"],
        "A friend group keeps spinning into tiny conflicts that feel important because they are immediate, even though none of them affect the health of the group much on their own.",
        [
          "Stop treating every small flare up as a full scale crisis and choose the issue that actually deserves a serious conversation.",
          "Use selectivity to preserve energy for the conflict that can really improve the group."
        ],
        "Greene's lesson is that not all friction deserves equal response. Force becomes smarter when it is ranked."
      ),
    ],
    directQuestions: [
      question(
        "ch09-q01",
        "Why does Greene call for selective conflict?",
        [
          "Because all conflict is unhealthy",
          "Because concentrated force works better than energy scattered across every provocation",
          "Because silence always wins",
          "Because pride should never matter"
        ],
        1,
        "He wants effort reserved for the contests that truly affect position."
      ),
      question(
        "ch09-q02",
        "What is a good test for whether a fight is worth having?",
        [
          "Whether it feels emotionally satisfying",
          "Whether the other side wants it",
          "Whether winning it would change something important",
          "Whether you can speak the loudest"
        ],
        2,
        "Consequence is the main strategic measure in this chapter."
      ),
      question(
        "ch09-q03",
        "Why can nonengagement be strong rather than weak?",
        [
          "Because it prevents every opponent from seeing how thin your resources are",
          "Because it guarantees moral superiority",
          "Because it removes the need for future action",
          "Because it always confuses everyone"
        ],
        0,
        "Refusing a bad fight can preserve leverage and deny others the drain they wanted."
      ),
      question(
        "ch09-q04",
        "What deeper principle closes this strategy?",
        [
          "Restraint helps concentrate power around decisive stakes",
          "Every concession is a hidden defeat",
          "A strong person should answer everything",
          "Conflict should usually be symbolic"
        ],
        0,
        "Greene wants disciplined refusal to serve concentration, not fear."
      ),
    ],
  }),
  chapter({
    chapterId: "ch10-read-hidden-motives",
    number: 10,
    title: "Read Hidden Motives",
    readingTimeMinutes: 14,
    summary: {
      p1: t(
        "People rarely act from the reasons they announce most clearly, and Greene argues that strategy improves when you learn to read incentives, status fears, ambitions, and hidden constraints beneath the surface story. Words matter, but motive is usually better inferred from pattern, pressure, and what each person stands to gain or avoid losing.",
        "This strategy is about seeing the contest underneath the language around the contest. Once you read the real driver, options that were previously invisible start to appear.",
        "Greene's point is not to become paranoid. It is to stop taking declared reasons as the whole truth when behavior keeps pointing somewhere deeper."
      ),
      p2: t(
        "This matters because shallow reading makes people strategically innocent. They respond to stated positions while missing the actual fear or desire shaping those positions, and so their answers keep landing on the wrong target.",
        "The deeper lesson is that motive reading changes leverage. If you know what the other side is really protecting, craving, or hiding from, you can negotiate, pressure, reassure, or bypass far more effectively.",
        "In daily life, this often means watching consistency, timing, audience, and repeated incentives instead of becoming hypnotized by explanation alone. Greene wants behavioral reading, not theatrical suspicion."
      ),
    },
    standardBullets: [
      bullet(
        "Look past stated reasons. Greene wants motives read through incentives and patterns, not words alone.",
        "Declared explanations are often partial and strategic."
      ),
      bullet(
        "Ask what each person stands to gain or avoid. Hidden motives usually track advantage, status, fear, or self protection.",
        "Interest often explains behavior better than declared principle does."
      ),
      bullet(
        "Study consistency over time. Repeated behavior usually tells the truth faster than a single explanation.",
        "Pattern is stronger evidence than performance."
      ),
      bullet(
        "Watch timing carefully. People reveal motive through when they act, delay, appear, or go silent.",
        "Timing often exposes the real pressure."
      ),
      bullet(
        "Use audience as a clue. What someone says in private and public can reveal what they are trying to protect.",
        "Context changes disclosure."
      ),
      bullet(
        "Separate declared values from operational behavior. The gap between the two is often where motive lives.",
        "Contradiction is useful data."
      ),
      bullet(
        "Do not become theatrically suspicious. Good motive reading stays empirical and disciplined.",
        "Paranoia distorts as much as innocence does."
      ),
      bullet(
        "Read your own motives too. You are easier to mislead when your own hidden needs stay unexamined.",
        "Self blindness weakens reading of others."
      ),
      bullet(
        "Design responses for the real driver. Once motive is clearer, you can choose pressure, reassurance, or redirection more intelligently.",
        "Correct reading improves fit of response."
      ),
      bullet(
        "The closing lesson is that hidden motives shape visible behavior. Read the deeper driver and the field becomes more legible.",
        "Good strategy listens beneath the script."
      ),
    ],
    deeperBullets: [
      bullet(
        "Greene is teaching behavioral interpretation, not mind reading. He wants conclusions built from evidence, sequence, incentives, and repeated signals.",
        "The method is disciplined, not mystical."
      ),
      bullet(
        "This strategy also protects against manipulation through language. Skilled actors often present noble or neutral explanations for moves driven by status, fear, or gain.",
        "Surface virtue can hide strategic appetite."
      ),
      bullet(
        "Hidden motive reading improves pacing. Once you know what is actually driving the other side, you stop wasting moves on arguments that never touched the live wire.",
        "Accuracy saves energy."
      ),
      bullet(
        "People often hide motives from themselves as well as from others. That is why pattern matters more than declared self understanding.",
        "Behavior frequently outruns explanation."
      ),
      bullet(
        "The broader lesson is that leverage starts with diagnosis. Greene wants the reader to respond to the structure under the speech, because that is where the contest is really being run.",
        "Read the engine, not only the smoke."
      ),
    ],
    takeaways: [
      "Words are only part of the truth",
      "Incentives reveal hidden drivers",
      "Pattern beats isolated explanation",
      "Timing and audience matter",
      "Do not confuse suspicion with reading",
      "Respond to the real driver not the surface script",
    ],
    practice: [
      "Ask what the other side gains by the current position",
      "Compare public reasons with repeated behavior",
      "Use timing as evidence not as background",
      "Design your next move for the deeper motive you can actually support",
    ],
    examples: [
      example(
        "ch10-ex01",
        "Partner says the issue is timing",
        ["work"],
        "A business partner says a proposal is being delayed because the timing is not right, but the pattern suggests the real issue is loss of control over a decision the partner used to own.",
        [
          "Read the delay as a clue about status and control before assuming the surface explanation is complete.",
          "Design the next conversation around ownership, reassurance, or redistributed influence rather than arguing only about the calendar."
        ],
        "Greene's lesson is that solutions improve once you answer the real motive instead of the polite script covering it."
      ),
      example(
        "ch10-ex02",
        "Manager praises caution while protecting turf",
        ["work"],
        "A manager keeps framing resistance to a new idea as wise caution, but the pattern suggests the real concern is that success would shift credit and influence elsewhere.",
        [
          "Study what the manager stands to lose if the idea moves forward and let that guide your next move.",
          "Treat the stated principle seriously, but do not mistake it for the only force shaping the behavior."
        ],
        "This strategy matters because declared prudence can hide status fear, and the wrong response leaves the real problem untouched."
      ),
      example(
        "ch10-ex03",
        "Professor offers help with conditions",
        ["school"],
        "A professor offers support for a project but keeps steering it toward their own interests. The help sounds generous, yet the pattern suggests a deeper need for ownership and influence.",
        [
          "Read the support through the incentives surrounding it instead of through tone alone.",
          "Accept or renegotiate the help based on the real exchange being proposed."
        ],
        "Greene wants readers to see how generosity, delay, and criticism can all carry motives larger than their wording."
      ),
      example(
        "ch10-ex04",
        "Club ally changes position suddenly",
        ["school"],
        "A club ally publicly changes position and gives a neutral explanation, but the shift happened right after a new audience appeared that rewards distance from the original plan.",
        [
          "Use timing and audience as clues about what is really shaping the move.",
          "Respond to the underlying pressure rather than debating only the stated rationale."
        ],
        "The strategy applies because motive is often visible in sequence long before it is visible in confession."
      ),
      example(
        "ch10-ex05",
        "Friend says they are just busy",
        ["personal"],
        "A friend keeps canceling plans and says they are only overwhelmed, but the pattern suggests something more specific such as resentment, changed priorities, or discomfort with the relationship.",
        [
          "Look at the pattern and the timing before deciding what story to believe.",
          "Ask questions or change expectations based on the deeper signal rather than on the safest surface explanation alone."
        ],
        "Greene's point is that kind sounding language can still hide a more useful truth about motive."
      ),
      example(
        "ch10-ex06",
        "Family member objects on principle",
        ["personal"],
        "A relative keeps objecting to a decision on supposed principle, but only when the choice reduces that person's influence. The pattern suggests the principle is partly real and partly cover.",
        [
          "Respect the stated concern while also reading the status and control issue underneath it.",
          "Design your response for both layers instead of treating the public explanation as complete."
        ],
        "This strategy matters because people often tell stories about motives that are cleaner than the motives actually driving them."
      ),
    ],
    directQuestions: [
      question(
        "ch10-q01",
        "What is Greene asking you to read beneath people's words?",
        [
          "Only their childhood history",
          "Their hidden motives, incentives, and fears",
          "Their public values alone",
          "Their most flattering explanation"
        ],
        1,
        "He wants strategic reading to move beneath surface language into the drivers of behavior."
      ),
      question(
        "ch10-q02",
        "What kind of evidence is most useful in this strategy?",
        [
          "Repeated patterns, timing, and incentive structure",
          "Single emotional impressions",
          "Rumor from uninvolved people",
          "Pure suspicion without verification"
        ],
        0,
        "Greene wants disciplined interpretation built from behavioral evidence."
      ),
      question(
        "ch10-q03",
        "Why can reading hidden motives improve leverage?",
        [
          "Because it removes the need for honesty",
          "Because it helps you answer the real driver rather than the polite script",
          "Because it makes every person predictable",
          "Because it guarantees cooperation"
        ],
        1,
        "Accurate diagnosis lets you choose pressure, reassurance, or redirection more intelligently."
      ),
      question(
        "ch10-q04",
        "What deeper principle closes this strategy?",
        [
          "Good strategy means distrusting everyone equally",
          "The field becomes clearer once you read the structure beneath the speech",
          "Motives matter less than outcomes",
          "Words are never useful evidence"
        ],
        1,
        "Greene wants readers to interpret the engine of behavior, not only the visible statement riding above it."
      ),
    ],
  }),
  chapter({
    chapterId: "ch11-create-aligned-teams",
    number: 11,
    title: "Create Aligned Teams",
    readingTimeMinutes: 14,
    summary: {
      p1: t(
        "A group becomes strategically dangerous when its members are pulling in the same direction with clear roles, shared standards, and trust in the campaign. Greene argues that alignment is not sameness of personality. It is coordinated purpose that prevents energy from being spent on internal rivalry, confusion, or status protection.",
        "This strategy treats cohesion as designed, not accidental. Teams need a common aim, role clarity, and enough justice in the internal order that people do not spend half their attention fighting one another.",
        "Greene's point is that unaligned groups leak force constantly. They may still have talent, but the talent is busy negotiating, resenting, or second guessing instead of combining."
      ),
      p2: t(
        "This matters because teams often confuse friendliness with alignment. People can like one another and still work at cross purposes when the mission is vague, authority is muddy, or standards are uneven.",
        "The deeper lesson is that alignment multiplies ordinary skill. Shared direction lets small signals travel faster, reduces noise under pressure, and makes sacrifice feel more intelligible.",
        "In practical life, building alignment often means clarifying the mission repeatedly, assigning real ownership, and removing the small unfairnesses that turn cooperation into politics."
      ),
    },
    standardBullets: [
      bullet(
        "Start with shared purpose. Greene wants the team united by a real mission rather than by vague good feeling.",
        "A common aim organizes effort better than personality harmony does."
      ),
      bullet(
        "Give roles clear shape. People cooperate better when ownership is visible and confusion is reduced.",
        "Role clarity lowers internal friction."
      ),
      bullet(
        "Do not let status contests run the group. Internal rivalry drains force that should be pointed outward.",
        "Unmanaged ego becomes hidden sabotage."
      ),
      bullet(
        "Use standards to create trust. Consistent expectations make coordination easier because people know what others are trying to uphold.",
        "Alignment grows through reliability."
      ),
      bullet(
        "Tie individual pride to collective success. Teams become stronger when members can see their contribution inside the larger result.",
        "Belonging sharpens commitment."
      ),
      bullet(
        "Segment tasks without splitting the mission. Distinct roles should serve one campaign, not create small private kingdoms.",
        "Division of labor must still feel unified."
      ),
      bullet(
        "Protect morale through fairness. Uneven burden or hidden favoritism quickly fractures cooperation.",
        "People watch internal justice closely."
      ),
      bullet(
        "Make coordination faster than gossip. Teams fail when informal politics travels more efficiently than the mission does.",
        "Information flow is part of alignment."
      ),
      bullet(
        "Reinforce the mission during stress. Pressure makes groups regress into self protection unless the shared aim stays visible.",
        "Alignment needs maintenance, not one speech."
      ),
      bullet(
        "The closing lesson is that coordinated groups are stronger than talented but divided ones. Alignment turns many efforts into one force.",
        "Greene treats cohesion as a weapon."
      ),
    ],
    deeperBullets: [
      bullet(
        "Greene sees alignment as emotional and structural at once. The mission, the roles, and the justice of the internal order all matter together.",
        "Cohesion fails when any of the three stays weak."
      ),
      bullet(
        "This strategy also protects speed. Teams with shared direction make fewer interpretive mistakes when conditions change quickly.",
        "Alignment reduces delay caused by confusion."
      ),
      bullet(
        "Groups often break from small indignities before they break from large hardship. Repeated unfairness teaches people to conserve themselves instead of committing fully.",
        "Internal politics grows where trust thins."
      ),
      bullet(
        "Real alignment makes decentralization possible. People can act independently with better judgment when the mission and standards are already shared deeply enough.",
        "Common purpose improves local decisions."
      ),
      bullet(
        "The broader lesson is that unity has to be built in design, discipline, and morale. Greene wants the group to stop spending strength against itself.",
        "Aligned force is cheaper and stronger at the same time."
      ),
    ],
    takeaways: [
      "Friendliness is not enough",
      "Shared purpose comes first",
      "Role clarity reduces friction",
      "Fairness protects morale",
      "Alignment must be maintained under stress",
      "Cohesion multiplies ordinary skill",
    ],
    practice: [
      "State the shared mission in one plain sentence",
      "Clarify one role that is still muddy",
      "Remove one source of internal unfairness",
      "Check whether the group's energy is leaking into status contests",
    ],
    examples: [
      example(
        "ch11-ex01",
        "Cross functional team pulling apart",
        ["work"],
        "A project team has skilled people, but each function is optimizing for its own local win. Meetings are polite while the actual campaign is fragmenting into small departmental agendas.",
        [
          "Restate the shared objective, assign visible ownership, and force tradeoffs to be made against the campaign rather than against local pride.",
          "Remove the incentives that reward subteam politics more than group success."
        ],
        "Greene's lesson is that talent without alignment produces internal drag that can be stronger than outside resistance."
      ),
      example(
        "ch11-ex02",
        "Manager relies on goodwill instead of structure",
        ["work"],
        "A manager assumes the team is aligned because people get along well, but deadlines keep slipping because responsibilities overlap and no one knows who has final say on critical decisions.",
        [
          "Replace assumed harmony with explicit mission, roles, and decision rights.",
          "Use structure to support the goodwill so cooperation does not depend on constant emotional negotiation."
        ],
        "This strategy matters because likeable groups still fracture when the campaign has no clear lines."
      ),
      example(
        "ch11-ex03",
        "Club officers working at cross purposes",
        ["school"],
        "A student club has energetic officers, but each one is running a separate vision of success. Members feel the internal split even though nobody names it directly.",
        [
          "Unify the officers around one mission and assign responsibilities in ways that support rather than compete with that mission.",
          "Treat hidden role conflict as a strategic problem, not as a personality quirk."
        ],
        "Greene would say the group is spending force inward. Alignment pulls the energy back toward the actual campaign."
      ),
      example(
        "ch11-ex04",
        "Lab group with quiet resentment",
        ["school"],
        "A lab or project group looks cooperative on the surface, but a few members keep carrying more than others and the imbalance is becoming quietly corrosive. No open fight has started yet, but trust is thinning.",
        [
          "Make the workload visible, rebalance it fairly, and reconnect the group to the shared outcome.",
          "Do not wait for frustration to become a public rupture before treating it as a strategic weakness."
        ],
        "The strategy applies because morale often breaks through accumulated unfairness before anyone openly defects."
      ),
      example(
        "ch11-ex05",
        "Family event planning turning political",
        ["personal"],
        "A family is planning a major event, and people are starting to protect territory, credit, and preferences more than the event itself. The hidden competition is becoming more important than the shared purpose.",
        [
          "Return everyone to the actual objective, assign clear roles, and reduce the conditions that reward small status battles.",
          "Use fairness and clarity to stop the campaign from turning into internal politics."
        ],
        "Greene's point is that any group can leak force when roles and purpose become secondary to personal positioning."
      ),
      example(
        "ch11-ex06",
        "Friend trip with no real coordination",
        ["personal"],
        "A group trip is approaching, and the friends keep assuming good intentions will carry the logistics. No one owns the key tasks, and irritation is rising because people thought alignment would happen naturally.",
        [
          "Give the plan a clear purpose, assign actual ownership, and remove ambiguity before stress magnifies it.",
          "Treat coordination as design, not as something friendship should magically solve."
        ],
        "This strategy matters because unclear roles turn even warm groups into messy campaigns under pressure."
      ),
    ],
    directQuestions: [
      question(
        "ch11-q01",
        "What does Greene mean by alignment in a team?",
        [
          "Everyone having the same personality",
          "A group sharing clear purpose, roles, and standards",
          "Avoiding all disagreement",
          "Keeping decisions informal"
        ],
        1,
        "He treats alignment as coordinated purpose, not emotional sameness."
      ),
      question(
        "ch11-q02",
        "Why can talented groups still perform badly?",
        [
          "Because talent weakens discipline",
          "Because talent can be spent on internal rivalry and confusion instead of the mission",
          "Because skill matters less than charisma",
          "Because large groups never align"
        ],
        1,
        "Unaligned talent leaks force into politics and friction."
      ),
      question(
        "ch11-q03",
        "What most quickly damages team cohesion here?",
        [
          "Clear role ownership",
          "Consistent standards",
          "Quiet unfairness and role confusion",
          "Shared mission language"
        ],
        2,
        "People often detach when they sense that burden and rules are not being carried fairly."
      ),
      question(
        "ch11-q04",
        "What deeper principle closes this strategy?",
        [
          "Cohesion is a force multiplier that turns many efforts into one campaign",
          "Teams should minimize structure to stay creative",
          "Alignment matters only in crisis",
          "Friendship is the main source of discipline"
        ],
        0,
        "Greene wants unity designed so the group stops spending strength against itself."
      ),
    ],
  }),
  chapter({
    chapterId: "ch12-center-decisions-under-pressure",
    number: 12,
    title: "Center Decisions Under Pressure",
    readingTimeMinutes: 14,
    summary: {
      p1: t(
        "Pressure scatters groups unless there is a stable center of judgment, and Greene argues that conflict requires someone or some process able to absorb noise, sort signal, and make clear decisions without panic. The center does not need to be loud, but it does need to be trusted and operational.",
        "This strategy is about preventing chaos from becoming democratic by accident. When everyone is improvising emotionally, the campaign loses direction exactly when direction matters most.",
        "Greene's point is that calm command creates order under stress. A strong center keeps fear from multiplying through the group faster than judgment can travel."
      ),
      p2: t(
        "This matters because pressure creates a strong illusion that more voices, more movement, and more reaction must mean more control. Often the opposite is true. Without a clear center, urgency turns into fragmentation.",
        "The deeper lesson is that decision quality under pressure depends on emotional containment. The center has to take in alarm without passing the full alarm straight through the system.",
        "In practical life, this can mean one trusted decision maker, a crisis protocol, or a disciplined process. Greene cares less about format than about the presence of a real center strong enough to keep the campaign coherent."
      ),
    },
    standardBullets: [
      bullet(
        "Pressure needs a center. Greene wants a stable point where noise is filtered and decisions are made.",
        "Without a center, urgency becomes scatter."
      ),
      bullet(
        "Do not let panic democratize command. More voices under stress often means less clarity, not more wisdom.",
        "Crisis magnifies confusion quickly."
      ),
      bullet(
        "Absorb fear before transmitting orders. The center should convert alarm into sequence, not simply spread the alarm onward.",
        "Containment protects morale and judgment."
      ),
      bullet(
        "Use clear decision rules ahead of time. Pressure is easier to govern when the group already knows where judgment consolidates.",
        "Structure reduces chaos cost."
      ),
      bullet(
        "Separate signal from emotional noise fast. Not every urgent sounding message deserves equal weight.",
        "Filtering is part of leadership."
      ),
      bullet(
        "Communicate decisions in plain form. Under stress, complexity behaves like delay.",
        "Clarity helps execution survive pressure."
      ),
      bullet(
        "Protect the center from overload. A decision hub buried in avoidable detail will fail when timing matters most.",
        "Command needs usable bandwidth."
      ),
      bullet(
        "Keep correction possible. A center is not strong because it never changes course. It is strong because it can adjust without collapsing into chaos.",
        "Stability and learning must coexist."
      ),
      bullet(
        "Train people to bring usable information upward. Better inputs make the center better without turning it into a shouting match.",
        "Command depends on disciplined reporting."
      ),
      bullet(
        "The closing lesson is that calm command is a strategic asset. A trusted center keeps pressure from choosing for the whole group.",
        "Judgment needs somewhere to gather."
      ),
    ],
    deeperBullets: [
      bullet(
        "Greene is describing emotional architecture as much as formal authority. The center is where anxiety is processed into action.",
        "Without that conversion, groups spread fear faster than they spread judgment."
      ),
      bullet(
        "This strategy improves tempo as well as clarity. When the center is stable, the group does not waste time renegotiating who gets to decide in the middle of the emergency.",
        "Decision rights protect speed."
      ),
      bullet(
        "A weak center invites power struggles precisely when unity is most needed. Pressure then becomes a contest over voice instead of a contest with the actual problem.",
        "Internal competition often spikes in chaos."
      ),
      bullet(
        "Centers fail when they become bottlenecks or emotional amplifiers. Greene wants enough authority to decide and enough discipline not to spread panic theatrically.",
        "Strength at the center includes restraint."
      ),
      bullet(
        "The broader lesson is that command under pressure is largely about conversion. Raw urgency has to be turned into ordered response before the campaign can survive it.",
        "The center is where urgency is made usable."
      ),
    ],
    takeaways: [
      "Pressure needs a clear center",
      "Do not multiply voices in panic",
      "Contain fear before passing orders",
      "Use simple decision rules",
      "Protect the center from overload",
      "Calm command keeps the campaign coherent",
    ],
    practice: [
      "Name where decisions consolidate under pressure",
      "Cut one channel that spreads noise faster than signal",
      "State the crisis decision rule in plain language",
      "Train reports to bring facts and options not panic alone",
    ],
    examples: [
      example(
        "ch12-ex01",
        "Incident response with too many voices",
        ["work"],
        "An unexpected system problem hits, and multiple leaders start issuing overlapping directions in different channels. The team is moving fast, but the movement is becoming contradictory.",
        [
          "Declare one decision center for the incident and route updates through that center in a disciplined way.",
          "Convert the flood of noise into a clear sequence of priorities before more activity creates more damage."
        ],
        "Greene's point is that speed without a center becomes chaos under pressure. Command must gather urgency before it directs it."
      ),
      example(
        "ch12-ex02",
        "Manager forwarding panic",
        ["work"],
        "A manager receives anxious messages from above and immediately passes the same anxiety down to the team without sorting what actually matters. The group becomes more frightened than informed.",
        [
          "Filter the fear, identify the essential decisions, and communicate those decisions without copying the emotional temperature you received.",
          "Use your position as a buffer that turns pressure into clarity."
        ],
        "This strategy matters because command weakens when it merely amplifies alarm instead of organizing response."
      ),
      example(
        "ch12-ex03",
        "Student event goes off script",
        ["school"],
        "A campus event starts going wrong, and every committee member is trying to solve a different problem at once. Nobody knows whose call is final for the next ten minutes.",
        [
          "Create a clear center for immediate decisions and reduce the number of active voices until the group regains order.",
          "Make the next three calls simple and visible so the event has direction again."
        ],
        "Greene would say chaos multiplies when command is unclear under pressure. A center keeps the group from fragmenting into good intentions."
      ),
      example(
        "ch12-ex04",
        "Study group stress before an exam",
        ["school"],
        "A study group hits a difficult review session and starts scattering into side debates, anxious speculation, and last minute topic switching. Everyone is reacting, but nobody is centering the effort.",
        [
          "Put one person or one clear process in charge of sequence so the group can stop spiraling through panic topics.",
          "Use the center to decide what matters most now instead of letting fear rank everything equally."
        ],
        "The strategy applies because pressure needs filtration. Otherwise the loudest anxiety starts passing for the smartest priority."
      ),
      example(
        "ch12-ex05",
        "Family emergency with no clear lead",
        ["personal"],
        "A family emergency unfolds, and several people keep giving different instructions at once. The confusion is increasing stress at the exact moment the family needs steadiness.",
        [
          "Name one person or one simple process to consolidate decisions for the immediate situation.",
          "Let others feed information upward while the center keeps the response ordered."
        ],
        "Greene's lesson is that strong centers calm groups because they turn raw urgency into usable action."
      ),
      example(
        "ch12-ex06",
        "Friend trip crisis handled by group panic",
        ["personal"],
        "A trip problem appears and the whole friend group jumps into solving it at once, creating contradictory plans and more emotion than clarity. The issue itself is manageable, but the group response is not.",
        [
          "Reduce the active decision makers and create one temporary center for sorting facts, options, and next steps.",
          "Use calm structure to stop the problem from growing through collective panic."
        ],
        "This strategy matters because pressure without a center multiplies confusion faster than it multiplies solutions."
      ),
    ],
    directQuestions: [
      question(
        "ch12-q01",
        "What is the main job of the center under pressure?",
        [
          "To sound more urgent than everyone else",
          "To gather noise, filter it, and turn it into clear decisions",
          "To delay action until total agreement appears",
          "To let every voice carry equal weight"
        ],
        1,
        "Greene wants command to convert urgency into sequence rather than multiply confusion."
      ),
      question(
        "ch12-q02",
        "Why is panic passed straight through a group so damaging?",
        [
          "Because fear is always dishonest",
          "Because it spreads noise faster than judgment",
          "Because it eliminates all morale forever",
          "Because it makes structure irrelevant"
        ],
        1,
        "Containment matters because panic behaves like bad information when it moves unchecked."
      ),
      question(
        "ch12-q03",
        "What protects decision quality in a crisis?",
        [
          "More overlapping authorities",
          "A clear center and simple decision rules",
          "Endless debate before action",
          "Allowing the loudest person to set the plan"
        ],
        1,
        "Stable command reduces both delay and fragmentation under pressure."
      ),
      question(
        "ch12-q04",
        "What deeper principle closes this strategy?",
        [
          "Urgency is useful only when it is converted into ordered response",
          "The best groups avoid structure in crisis",
          "Pressure should be distributed equally through everyone",
          "Command matters less than morale"
        ],
        0,
        "Greene treats the center as the place where raw pressure becomes usable action."
      ),
    ],
  }),
  chapter({
    chapterId: "ch13-build-depth-before-moves",
    number: 13,
    title: "Build Depth Before Moves",
    readingTimeMinutes: 14,
    summary: {
      p1: t(
        "A move is stronger when it rests on preparation, reserves, and second lines rather than on hope that the first push will work cleanly. Greene argues that shallow strategy is fragile because it commits to visible action before building the depth needed to absorb resistance, surprise, or delay.",
        "This strategy is about creating layers before exposure. Depth can mean preparation, backup options, intelligence, reserves, or relationships that keep the campaign alive when the first plan meets reality.",
        "Greene's lesson is that impressive moves often fail because they were asked to do too much on their own. Better depth makes action sturdier and less theatrical."
      ),
      p2: t(
        "This matters because bold visible action gets more attention than invisible preparation does. People love the first move and neglect the support system that determines whether the move survives contact.",
        "The deeper lesson is that depth protects initiative. It lets you keep acting after the first setback because the campaign was never hanging entirely on one line of success.",
        "In practical terms, building depth often means developing a second route, holding back a reserve, preparing the follow through, and asking what happens if the first version works only halfway."
      ),
    },
    standardBullets: [
      bullet(
        "Do not ask the first move to carry the whole campaign. Greene wants visible action supported by depth behind it.",
        "Shallow plans break quickly under resistance."
      ),
      bullet(
        "Build reserves before exposure. Backup options make pressure easier to bear without panic.",
        "Depth buys time and choice."
      ),
      bullet(
        "Prepare follow through, not only entry. Many strong openings collapse because nothing solid was built behind them.",
        "The campaign continues after the first impact."
      ),
      bullet(
        "Use intelligence to add depth. Better preparation turns surprises into manageable strain rather than total disorder.",
        "Knowledge is part of reserve."
      ),
      bullet(
        "Keep a second route alive. If the obvious path stalls, a prepared alternative preserves initiative.",
        "Fallback plans reduce desperation."
      ),
      bullet(
        "Do not overcommit everything at once. A full early commitment can leave no capacity for correction later.",
        "Restraint is part of depth."
      ),
      bullet(
        "Depth makes confidence more real. People act better when they know the campaign has more than one line of support.",
        "Preparation stabilizes morale."
      ),
      bullet(
        "Look beyond best case scenarios. Build for friction, delay, and partial success, not just for smooth execution.",
        "Reality usually asks more of the plan."
      ),
      bullet(
        "Use depth to lower emotional overreaction. When options remain, one setback does not feel like total collapse.",
        "Reserve protects judgment."
      ),
      bullet(
        "The closing lesson is that layered preparation makes action durable. Greene wants moves built on depth, not on spectacle alone.",
        "Strong campaigns have more than one line of life."
      ),
    ],
    deeperBullets: [
      bullet(
        "Greene is shifting attention from dramatic initiative to staying power. Depth ensures the first move does not become the last move by necessity.",
        "Durability is part of force."
      ),
      bullet(
        "This strategy also changes the emotional field. People who know there is reserve tend to panic less and read setbacks more accurately.",
        "Preparation calms interpretation."
      ),
      bullet(
        "A shallow plan often invites overbluffing. When nothing meaningful stands behind the visible action, leaders compensate with attitude and urgency.",
        "Theatrics frequently hide thin depth."
      ),
      bullet(
        "Building depth can feel slow, but it often makes later movement faster because fewer shocks become catastrophic interruptions.",
        "Reserve improves tempo over the whole campaign."
      ),
      bullet(
        "The broader lesson is that hidden support determines visible power. Greene wants the reader to stop admiring the front line without asking what is holding it up.",
        "Depth is invisible strength made usable."
      ),
    ],
    takeaways: [
      "Do not rely on one line of success",
      "Build reserves before exposure",
      "Prepare follow through",
      "Keep a second route alive",
      "Depth protects morale and judgment",
      "Hidden support determines visible power",
    ],
    practice: [
      "Name the reserve behind your next visible move",
      "Write the backup route if the first approach stalls",
      "Plan the follow through before the launch",
      "Ask what happens if the first version succeeds only halfway",
    ],
    examples: [
      example(
        "ch13-ex01",
        "Launch with no fallback",
        ["work"],
        "A team is preparing a public launch and putting all attention into the first day message. Almost nothing has been built for customer confusion, technical issues, or the week after the announcement.",
        [
          "Build the support layers behind the launch before adding more show to the launch itself.",
          "Prepare the second line of communication, troubleshooting, and follow through so the first move does not have to carry everything."
        ],
        "Greene's lesson is that bold openings often fail because they were not backed by enough invisible depth."
      ),
      example(
        "ch13-ex02",
        "Career move with one narrow outcome",
        ["work"],
        "Someone is pursuing one internal promotion so completely that no reserve path exists if the decision goes another way. The whole campaign is emotionally and practically hanging on one outcome.",
        [
          "Build depth by keeping alternative routes, relationships, and preparation alive instead of wagering identity on a single line.",
          "Use reserve to keep judgment steady if the first route closes."
        ],
        "This strategy matters because shallow commitment makes normal setbacks feel like collapse."
      ),
      example(
        "ch13-ex03",
        "Student election with no field plan",
        ["school"],
        "A student campaign is built around one big event and one strong speech. If turnout, timing, or reaction goes badly, there is little else behind the effort.",
        [
          "Add layers behind the headline moment, including follow up, outreach, and alternative ways to carry the message.",
          "Make the campaign deeper than its most visible performance."
        ],
        "Greene would say the campaign needs more than a front line. It needs hidden support that keeps it alive after the first test."
      ),
      example(
        "ch13-ex04",
        "Group project with no buffer",
        ["school"],
        "A project plan assumes everything will go right and leaves no time or role flexibility for unexpected problems. The group feels confident only because it has not imagined friction yet.",
        [
          "Build buffer, backup ownership, and a second route before the project starts testing you in public.",
          "Treat reserve as part of seriousness rather than as pessimism."
        ],
        "The strategy applies because depth keeps a setback from becoming a crisis of identity for the whole group."
      ),
      example(
        "ch13-ex05",
        "Personal change with no support system",
        ["personal"],
        "Someone is trying to make a major life change through willpower alone and has built almost no support, no backup routine, and no recovery plan for a bad week.",
        [
          "Create depth behind the intention through structure, support, and fallback habits before testing your commitment in hard conditions.",
          "Do not ask motivation to do the whole job that preparation should be doing."
        ],
        "Greene's point is that shallow plans rely too much on perfect first line performance."
      ),
      example(
        "ch13-ex06",
        "Relationship repair with no next layer",
        ["personal"],
        "A couple has one good conversation after a rough stretch and treats that single moment as if it solved the whole problem. No deeper support or follow through is built behind it.",
        [
          "Use the good conversation as an opening, then build the routines and agreements that give it depth.",
          "Do not let one front line success substitute for a real second line."
        ],
        "This strategy matters because visible breakthroughs fade quickly when nothing steady stands behind them."
      ),
    ],
    directQuestions: [
      question(
        "ch13-q01",
        "What is Greene warning against in this strategy?",
        [
          "Using any visible initiative",
          "Expecting one move to carry the whole campaign without reserve behind it",
          "Preparing too many options",
          "Holding back any energy at all"
        ],
        1,
        "He wants depth behind action so the campaign can survive friction and partial success."
      ),
      question(
        "ch13-q02",
        "Why do reserves matter so much here?",
        [
          "They make the first move look less important",
          "They preserve choice and keep setbacks from turning into panic",
          "They prevent all future conflict",
          "They remove the need for timing"
        ],
        1,
        "Reserve protects both strategy and judgment when the first line meets resistance."
      ),
      question(
        "ch13-q03",
        "What often receives too much attention compared with depth?",
        [
          "Invisible preparation",
          "The visible opening move",
          "Long term morale",
          "Second routes"
        ],
        1,
        "People admire the launch while neglecting the layers that decide whether it survives."
      ),
      question(
        "ch13-q04",
        "What deeper principle closes this strategy?",
        [
          "Hidden support is what makes visible power durable",
          "A strong first move is enough by itself",
          "Reserve is mostly a sign of fear",
          "Depth matters only for large organizations"
        ],
        0,
        "Greene wants moves built on layers of support, not on spectacle alone."
      ),
    ],
  }),
  chapter({
    chapterId: "ch14-split-attention-and-surprise",
    number: 14,
    title: "Split Attention and Surprise",
    readingTimeMinutes: 14,
    summary: {
      p1: t(
        "Surprise works best when attention has already been guided elsewhere, and Greene argues that effective disruption usually combines distraction with a move that lands outside the opponent's prepared focus. The aim is not random trickery. It is directed surprise that breaks expectation at the point where expectation had become rigid.",
        "This strategy treats attention as terrain. If the other side is fixed on one line, one threat, or one story, a well timed shift can make a smaller force feel much larger.",
        "Greene's lesson is that direct strength is not the only way to win initiative. Surprise can alter morale, timing, and interpretation all at once when it hits where the other side stopped looking."
      ),
      p2: t(
        "This matters because people become predictable around their own habits of attention. They watch what has hurt before, what looks most obvious now, or what they most hope to control, and that narrow focus creates openings elsewhere.",
        "The deeper lesson is that surprise is designed in advance. It depends on reading expectation, feeding or fixing that expectation, and then moving through the unattended space at the decisive moment.",
        "In practical settings, this can mean changing format, sequence, messenger, or direction after the other side has settled into one interpretation. Greene wants surprise used with purpose, not for cleverness alone."
      ),
    },
    standardBullets: [
      bullet(
        "Surprise begins with attention management. Greene wants you to read where the other side is looking before deciding how to move.",
        "Expectation creates the opening."
      ),
      bullet(
        "Use distraction to support the real move. A decoy line can hold focus long enough for the decisive action to land elsewhere.",
        "Attention split makes surprise more effective."
      ),
      bullet(
        "Do not confuse surprise with randomness. The move should be unexpected and still clearly connected to the objective.",
        "Cleverness without aim wastes the advantage."
      ),
      bullet(
        "Study habits of expectation. People usually watch what has mattered before and miss what falls outside that habit.",
        "Routine makes surprise possible."
      ),
      bullet(
        "Time the surprise to rigidity. The best moment often comes after the other side has settled into confidence about the pattern.",
        "Certainty creates vulnerability."
      ),
      bullet(
        "Keep the decisive move simple. Surprise loses force when execution becomes too ornate or fragile.",
        "The unexpected should still be usable."
      ),
      bullet(
        "Use surprise to change morale as well as position. A clean unexpected move can make the other side doubt its own reading.",
        "Psychological shock matters."
      ),
      bullet(
        "Prepare the line after surprise. The opening created by surprise closes fast if you do not exploit it quickly.",
        "Follow through turns shock into gain."
      ),
      bullet(
        "Do not overuse one trick. Repeated surprise becomes a pattern and therefore stops being surprise.",
        "Novelty decays when predictable."
      ),
      bullet(
        "The closing lesson is that expectation can be attacked. Split attention, land decisively, and use the moment before the field resets.",
        "Surprise works when it is designed and finished cleanly."
      ),
    ],
    deeperBullets: [
      bullet(
        "Greene treats attention as a scarce and steerable resource. The battle is partly won when you determine what the other side is able to notice.",
        "Perception can be positioned before action."
      ),
      bullet(
        "This strategy also relies on patience. Surprise often requires allowing the other side to become comfortable with a pattern before breaking it.",
        "Expectation needs time to harden."
      ),
      bullet(
        "A good surprise reorganizes the emotional field. People who thought they understood the map suddenly have to question it, and that hesitation creates room.",
        "Shock buys time and doubt together."
      ),
      bullet(
        "Poor surprise fails because it is self admiring. Greene wants practical disruption that changes the result, not theatrical novelty that only looks smart afterward.",
        "The move must serve the campaign."
      ),
      bullet(
        "The broader lesson is that predictability is a vulnerability in both individuals and systems. Read the fixation, feed it if useful, and then move where attention has thinned.",
        "Surprise is targeted misalignment of expectation and reality."
      ),
    ],
    takeaways: [
      "Read where attention is fixed",
      "Use distraction to support the real move",
      "Surprise must serve the objective",
      "Time the break after expectation hardens",
      "Exploit the opening quickly",
      "Repeated tricks stop being surprise",
    ],
    practice: [
      "Ask what pattern the other side thinks it understands",
      "Choose a decoy line only if it serves the real move",
      "Keep the unexpected step simple enough to execute cleanly",
      "Plan the follow through before the surprise lands",
    ],
    examples: [
      example(
        "ch14-ex01",
        "Negotiation stuck on one visible demand",
        ["work"],
        "A counterpart is fixated on one visible demand and has built all its preparation around that line. Meanwhile there is an unguarded point elsewhere that would matter more to the final agreement.",
        [
          "Keep the focus on the expected debate long enough to hold attention there, then shift decisively to the less defended leverage point.",
          "Use the surprise to create a real opening, not just a clever moment."
        ],
        "Greene's lesson is that surprise works when attention has already been organized somewhere else."
      ),
      example(
        "ch14-ex02",
        "Manager changes the messenger",
        ["work"],
        "A team expects a difficult message to come through a familiar leader in a familiar format, and has already prepared resistance. Sending the same message the same way would trigger the old defense immediately.",
        [
          "Change the sequence, the messenger, or the format so the old pattern does not get to activate automatically.",
          "Use the break in expectation to make the message land before resistance reassembles."
        ],
        "This strategy matters because people often defend against patterns, not just against content."
      ),
      example(
        "ch14-ex03",
        "Debate opponent prepared for one angle",
        ["school"],
        "A student debate opponent has clearly prepared to answer one obvious line of attack and is waiting for it. That readiness is so strong that it has created weakness on the rest of the field.",
        [
          "Feed the expected line just enough to hold attention, then move through the less defended question that changes the round more deeply.",
          "Make sure the shift is still simple enough to carry through under live pressure."
        ],
        "Greene would say surprise becomes powerful when it hits against overconfidence in a known pattern."
      ),
      example(
        "ch14-ex04",
        "Club meeting with one predictable script",
        ["school"],
        "A campus group keeps replaying the same argument in the same order every time a topic comes up. Everyone now knows where to perform and where to defend.",
        [
          "Break the script by changing sequence, asking the neglected question first, or moving the decision into a different format.",
          "Use the shift to open thinking, not simply to look clever."
        ],
        "The strategy applies because repeated patterns create attention ruts. Surprise can reopen the field."
      ),
      example(
        "ch14-ex05",
        "Personal conversation that always derails the same way",
        ["personal"],
        "A couple keeps having the same hard conversation and it always follows the same script. Both people can now predict exactly where the other will defend or accuse.",
        [
          "Break the pattern in a deliberate way, such as changing the setting, beginning point, or question that opens the talk.",
          "Use the interruption to reach the real issue before the routine conflict path takes over again."
        ],
        "Greene's point is that repeated attention patterns make people easier to surprise into honesty or at least into rethinking."
      ),
      example(
        "ch14-ex06",
        "Friend group expecting one kind of response",
        ["personal"],
        "A friend group expects one person to always react defensively to criticism, and the whole group is unconsciously preparing for that old reaction again. The script is helping everyone stay stuck.",
        [
          "Use a calm, unexpected response that breaks the group's prepared reading and changes the emotional field.",
          "Follow the surprise with a clear move that redirects the conversation before the old pattern can reassemble."
        ],
        "This strategy matters because surprise can reopen possibility when a social system has become too sure it knows what comes next."
      ),
    ],
    directQuestions: [
      question(
        "ch14-q01",
        "What makes surprise strategically useful in Greene's view?",
        [
          "It is inherently more moral than direct action",
          "It exploits fixed attention and expectation to create a real opening",
          "It eliminates the need for follow through",
          "It works best when completely random"
        ],
        1,
        "He wants surprise tied to expectation, not to randomness for its own sake."
      ),
      question(
        "ch14-q02",
        "Why does distraction often matter before surprise?",
        [
          "Because it divides attention and fixes the other side on the wrong line",
          "Because it guarantees confusion forever",
          "Because it makes simple execution impossible",
          "Because it weakens your own objective"
        ],
        0,
        "Attention split makes a later decisive move harder to anticipate."
      ),
      question(
        "ch14-q03",
        "What most often weakens a surprise move?",
        [
          "A simple objective",
          "Follow through prepared in advance",
          "Theatrical cleverness that is not tied to the campaign",
          "Patience before the break"
        ],
        2,
        "Surprise that serves ego more than strategy usually wastes the opening."
      ),
      question(
        "ch14-q04",
        "What deeper principle closes this strategy?",
        [
          "Attention can be shaped and then attacked at the point of fixation",
          "Randomness is the heart of strategic genius",
          "Expectation never creates vulnerability",
          "Surprise matters more than objective"
        ],
        0,
        "Greene treats expectation as a structure that can be manipulated and then broken decisively."
      ),
    ],
  }),
  chapter({
    chapterId: "ch15-offer-an-attractive-path",
    number: 15,
    title: "Offer an Attractive Path",
    readingTimeMinutes: 13,
    summary: {
      p1: t(
        "People resist direct force more than they resist options that appear to serve their own interest, and Greene argues that strong strategists often guide opponents indirectly by offering a path that feels chosen rather than imposed. The trick is not pure deception. It is shaping incentives so movement in your preferred direction becomes easier, safer, or more appealing than the alternatives.",
        "This strategy treats pressure as design. Instead of pushing head on, you create a route that draws the other side where you want the contest to go.",
        "Greene's lesson is that indirect movement can be cheaper and cleaner than frontal coercion. When the other side walks willingly into the position you prepared, you spend less force and create less open resistance."
      ),
      p2: t(
        "This matters because direct confrontation often stiffens pride and provokes defensive energy. People start resisting not only the substance of the move, but the experience of being pushed.",
        "The deeper lesson is that choice architecture changes behavior. If you understand what the other side wants, fears, and wishes to avoid, you can often frame a route that lets them cooperate while still thinking of themselves as self directed.",
        "In practical life, this can mean presenting an appealing next step, narrowing the options, or arranging the setting so the most attractive move also happens to be the one that serves your campaign."
      ),
    },
    standardBullets: [
      bullet(
        "Indirect guidance often beats direct pressure. Greene wants incentives designed so the other side moves willingly.",
        "People defend pride against open force."
      ),
      bullet(
        "Make the preferred route attractive. The best path is often the one that feels easiest, safest, or most rewarding to the other side.",
        "Design can guide behavior quietly."
      ),
      bullet(
        "Read desire before shaping the route. You cannot lure well if you do not know what the other side wants badly enough to follow.",
        "Motive reading supports indirect influence."
      ),
      bullet(
        "Reduce the appeal of rival paths. Attractive guidance works better when the alternatives feel thinner or costlier.",
        "Comparison shapes choice."
      ),
      bullet(
        "Do not make the path feel like a trap too soon. Visible manipulation creates resistance and caution.",
        "Subtlety keeps the route open."
      ),
      bullet(
        "Use structure more than argument. People are often moved more effectively by how options are arranged than by how loudly they are debated.",
        "Design can outperform persuasion."
      ),
      bullet(
        "Keep the route aligned with the objective. A tempting path that leads to the wrong place is only distraction.",
        "Attraction must still serve the campaign."
      ),
      bullet(
        "Let the other side feel agency where possible. Cooperation is easier when dignity survives the move.",
        "People resist humiliation as much as pressure."
      ),
      bullet(
        "Prepare for the moment they notice the design. Indirect influence still needs a next line once awareness rises.",
        "Good routes include follow through."
      ),
      bullet(
        "The closing lesson is that shaping choice can be stronger than forcing action. Offer a path they want to walk and resistance often falls on its own.",
        "Greene prefers cheaper leverage when it can do the job."
      ),
    ],
    deeperBullets: [
      bullet(
        "Greene is working with the psychology of self direction. People are more cooperative when they can preserve the feeling that they are acting for their own reasons.",
        "Agency is part of compliance."
      ),
      bullet(
        "This strategy is not only about others. It also protects your own force from the cost of frontal conflict when that cost is unnecessary.",
        "Indirect design can conserve energy."
      ),
      bullet(
        "Attractive paths often work because they translate your objective into the other side's incentives. The route succeeds when their interest and your direction overlap enough to move the same way.",
        "Alignment creates pull."
      ),
      bullet(
        "There is a limit here. If the path becomes too manipulative or too humiliating when discovered, the later backlash can outweigh the early gain.",
        "Indirect guidance still needs judgment."
      ),
      bullet(
        "The broader lesson is that influence grows when you shape environments, not just arguments. Greene wants the field arranged so the desired move feels natural.",
        "Choice can be guided through structure."
      ),
    ],
    takeaways: [
      "Indirect pressure can be cheaper than direct force",
      "Make the preferred route attractive",
      "Read desire before you guide",
      "Protect the other side's sense of agency",
      "Use structure more than argument when possible",
      "Shape choice so movement serves the campaign",
    ],
    practice: [
      "Name what the other side most wants or fears",
      "Design one option that serves both their motive and your aim",
      "Make weak alternatives less appealing without overplaying the trap",
      "Plan what happens after they take the offered path",
    ],
    examples: [
      example(
        "ch15-ex01",
        "Stakeholder needs to adopt your plan",
        ["work"],
        "A stakeholder is resisting a proposal because direct adoption would feel like surrendering status. The substance might still be workable if the path into it preserved that person's sense of control.",
        [
          "Present the route in a way that lets the stakeholder claim authorship or visible influence while still moving toward the needed outcome.",
          "Shape the options so the path that saves face is also the path that serves the campaign."
        ],
        "Greene's lesson is that people often resist the feeling of being pushed more than they resist the substance itself."
      ),
      example(
        "ch15-ex02",
        "Manager needs better reporting",
        ["work"],
        "A manager wants a team member to change reporting behavior, but every direct correction creates defensiveness. The person hears control more than improvement.",
        [
          "Redesign the process so the better reporting path feels simpler and more rewarding than the old one.",
          "Use structure and incentives before relying on more frontal pressure."
        ],
        "This strategy matters because indirect design can move behavior with less resistance than repeated command alone."
      ),
      example(
        "ch15-ex03",
        "Club needs volunteers for unglamorous work",
        ["school"],
        "A student club needs people to take on less visible tasks, but direct pleading is not working. Members agree politely and then disappear.",
        [
          "Design the roles so the contribution feels meaningful, visible enough, and easier to accept than to avoid.",
          "Offer a path people can choose without feeling trapped into thankless labor."
        ],
        "Greene would say an attractive route often gets more real compliance than direct pressure that merely produces polite resistance."
      ),
      example(
        "ch15-ex04",
        "Study group needs one person to step back",
        ["school"],
        "A strong personality in a study group keeps dominating the conversation, and direct calls to stop are creating more ego defense. The group needs a cleaner way to reshape the role.",
        [
          "Offer a different role that preserves that person's sense of value while moving speaking time into a healthier structure.",
          "Guide the person into the better position instead of forcing a frontal identity loss."
        ],
        "The strategy applies because people cooperate more easily when the new path still protects some dignity."
      ),
      example(
        "ch15-ex05",
        "Family member refusing needed help",
        ["personal"],
        "A relative clearly needs support but rejects direct offers because accepting help feels like weakness. The current path makes pride and need collide.",
        [
          "Offer help through a route that preserves the person's agency, contribution, or sense of reciprocity.",
          "Design the path so acceptance feels less like surrender and more like a chosen next step."
        ],
        "Greene's point is that indirect support can succeed where direct pressure only hardens resistance."
      ),
      example(
        "ch15-ex06",
        "Friend conflict that needs a better exit",
        ["personal"],
        "A friend group needs one person to step away from a draining pattern, but direct confrontation keeps creating denial and escalation. The group needs a route that changes behavior without triggering immediate war.",
        [
          "Create an option that lets the person shift position with dignity instead of making retreat feel like public defeat.",
          "Use the path of least resistance to guide the outcome you need."
        ],
        "This strategy matters because the route someone takes toward change often determines whether change can happen at all."
      ),
    ],
    directQuestions: [
      question(
        "ch15-q01",
        "Why does Greene favor offering an attractive path over direct pressure when possible?",
        [
          "Because direct force is always immoral",
          "Because people often resist being pushed more than they resist the substance itself",
          "Because indirect methods require no planning",
          "Because dignity never matters in conflict"
        ],
        1,
        "He wants behavior guided through incentives and agency where that is cheaper and more effective."
      ),
      question(
        "ch15-q02",
        "What makes an offered path strategically strong?",
        [
          "It flatters everyone equally",
          "It aligns the other side's motives with your intended direction",
          "It hides the objective completely",
          "It removes all alternatives forever"
        ],
        1,
        "The route works when their desire pulls them where your campaign needs them to go."
      ),
      question(
        "ch15-q03",
        "What weakens this strategy badly?",
        [
          "Preserving the other side's dignity",
          "Using structure instead of argument",
          "Making the path feel like an obvious trap too early",
          "Reducing the appeal of weaker alternatives"
        ],
        2,
        "Visible manipulation creates suspicion and resistance before the route can do its work."
      ),
      question(
        "ch15-q04",
        "What deeper principle closes this strategy?",
        [
          "Choice can often be guided more cheaply through designed incentives than through frontal force",
          "Indirect influence removes the need for ethics or judgment",
          "People never need to feel agency in hard situations",
          "Argument is always weaker than design"
        ],
        0,
        "Greene wants the field arranged so movement becomes easier in the direction you need."
      ),
    ],
  }),
  chapter({
    chapterId: "ch16-strike-the-weak-link",
    number: 16,
    title: "Strike the Weak Link",
    readingTimeMinutes: 13,
    summary: {
      p1: t(
        "Strong strategists do not attack everywhere equally. Greene argues that pressure becomes decisive when it is concentrated against the weakest point in a chain, system, coalition, or argument. A weak link may be a person, a dependency, a process, a timing gap, or a hidden assumption that the whole structure quietly needs.",
        "This strategy is about diagnosis before force. Instead of admiring the opponent's strongest face, you study what keeps the whole arrangement vulnerable.",
        "Greene's lesson is that targeted pressure often beats broad effort. One well chosen strike can create consequences far larger than the size of the move itself."
      ),
      p2: t(
        "This matters because diffuse conflict feels energetic while leaving the real structure intact. People attack what is visible, familiar, or emotionally satisfying and miss the small point where the whole system is actually easiest to break or redirect.",
        "The deeper lesson is that leverage lives in asymmetry. You do not need equal force everywhere if you can identify where the whole setup depends on something thin, exposed, or unstable.",
        "In practical life, this strategy often means finding the chokepoint, the overloaded person, the brittle assumption, or the underdefended relationship that quietly decides far more than it seems to decide."
      ),
    },
    standardBullets: [
      bullet(
        "Do not attack the whole front. Greene wants force concentrated where the structure is most dependent and least protected.",
        "Targeted pressure beats diffuse struggle."
      ),
      bullet(
        "Study dependency chains. The weak link is often the point everything else quietly relies on.",
        "Small nodes can carry large consequences."
      ),
      bullet(
        "Look past obvious strength. The visible center of power may not be the easiest or most useful point of entry.",
        "Impressive surfaces can hide brittle supports."
      ),
      bullet(
        "Use diagnosis before escalation. A strike is only efficient if it lands where the system is vulnerable to it.",
        "Leverage comes from accurate reading."
      ),
      bullet(
        "Weak links may be human or structural. A process, assumption, delay, or morale problem can be more decisive than a single person.",
        "Vulnerability is not always personal."
      ),
      bullet(
        "Hit the point that changes the most, not the point that feels most satisfying.",
        "Emotion is a poor guide to leverage."
      ),
      bullet(
        "Protect against your own weak links too. The strategy becomes stronger when you can see what in your side would break under similar pressure.",
        "Self diagnosis supports both attack and defense."
      ),
      bullet(
        "Use smaller force well rather than larger force badly. Proper targeting can make limited means surprisingly effective.",
        "Precision multiplies effort."
      ),
      bullet(
        "Exploit the opening quickly after the strike. Weak links often create brief windows rather than permanent collapse.",
        "Follow through matters."
      ),
      bullet(
        "The closing lesson is that leverage grows where dependence is thin. Find the weak link and the whole structure becomes easier to move.",
        "Strategic force is concentrated force."
      ),
    ],
    deeperBullets: [
      bullet(
        "Greene is teaching systems thinking inside conflict. The question is not who looks strongest, but what the whole arrangement cannot easily lose.",
        "Dependency matters more than spectacle."
      ),
      bullet(
        "Weak links are often hidden by status. People protect the visible center while neglecting the boring mechanism that actually carries the load.",
        "Prestige and vulnerability rarely align perfectly."
      ),
      bullet(
        "This strategy also saves energy. Once force is aimed at the decisive point, the rest of the field may shift without needing equal direct attack.",
        "Precision is a form of economy."
      ),
      bullet(
        "There is a warning here about cruelty and shortsightedness. Hitting the weakest person is not the same as hitting the weakest link if that person is not structurally decisive.",
        "Weakness has to matter strategically."
      ),
      bullet(
        "The broader lesson is that leverage comes from understanding what holds the whole system together. Greene wants pressure aimed where the chain is thin, not where the armor is loud.",
        "Good targeting turns modest force into decisive change."
      ),
    ],
    takeaways: [
      "Do not attack everywhere equally",
      "Study what the system depends on",
      "Visible strength can hide real weakness",
      "Precision multiplies force",
      "Check your own weak links too",
      "Exploit the opening after the strike",
    ],
    practice: [
      "Name the one dependency the whole contest leans on",
      "Ask whether the obvious target is actually decisive",
      "Check where your own side is just as vulnerable",
      "Plan the follow through before the pressure lands",
    ],
    examples: [
      example(
        "ch16-ex01",
        "Process bottleneck controlling a whole launch",
        ["work"],
        "A launch is slowing down, and everyone is arguing with the loudest stakeholder. The real problem is that one underdesigned approval step is quietly delaying every major decision.",
        [
          "Stop spending force on the most visible frustration and attack the process point that is actually choking the campaign.",
          "Redesign or bypass the bottleneck so one small change unlocks the larger system."
        ],
        "Greene's point is that leverage often sits in the unnoticed dependency rather than in the loudest argument around it."
      ),
      example(
        "ch16-ex02",
        "Negotiation resting on one internal blocker",
        ["work"],
        "A company seems united in resisting a deal, but closer reading suggests one influential person is quietly shaping the whole internal resistance. Winning over or containing that one node would shift everything else.",
        [
          "Identify the person or mechanism the broader resistance depends on before spreading effort across the whole group.",
          "Put pressure where the chain is actually thin instead of fighting every surface objection."
        ],
        "This strategy matters because broad resistance often has one or two decisive supports behind it."
      ),
      example(
        "ch16-ex03",
        "Campus campaign attacking the wrong issue",
        ["school"],
        "A student campaign keeps responding to every criticism in public while ignoring one quiet concern that is actually moving undecided voters. The campaign is fighting heat instead of leverage.",
        [
          "Locate the small issue that is truly shifting support and address it directly.",
          "Stop spending effort on every visible attack if one weaker point is deciding the result."
        ],
        "Greene would say the weak link is the place where a limited intervention can change the whole campaign."
      ),
      example(
        "ch16-ex04",
        "Group project with one overloaded member",
        ["school"],
        "A project group looks dysfunctional everywhere, but the deeper problem is that one overburdened member is carrying the planning structure for all of it. If that single link fails, the whole project will fragment.",
        [
          "Protect or redistribute the overloaded point before trying to fix every surface tension at once.",
          "Treat the weak link as the decisive structural issue, not as merely one problem among many."
        ],
        "The strategy applies because one fragile dependency can matter more than several visible annoyances combined."
      ),
      example(
        "ch16-ex05",
        "Family conflict shaped by one assumption",
        ["personal"],
        "A family keeps fighting about money, yet the real weakness is an unspoken assumption that one person will always absorb emergencies. That hidden dependency keeps recreating the same strain.",
        [
          "Address the underlying assumption instead of relitigating each new argument as if it were separate.",
          "Strike the weak link in the pattern, not only the latest visible disagreement."
        ],
        "Greene's lesson is that recurring conflict often runs through one fragile but decisive support point."
      ),
      example(
        "ch16-ex06",
        "Friend group held together by one brittle connector",
        ["personal"],
        "A friend group seems stable, but all coordination, peacekeeping, and planning quietly depend on one person who is near burnout. Everyone talks about different symptoms while missing the one link the whole structure relies on.",
        [
          "Recognize the structural dependency before it fails and redistribute what the group is quietly asking one person to carry.",
          "Fix the weak link rather than fighting the noise created around it."
        ],
        "This strategy matters because the whole arrangement often depends on something smaller and more fragile than people first assume."
      ),
    ],
    directQuestions: [
      question(
        "ch16-q01",
        "What is Greene mainly asking you to find before you strike?",
        [
          "The loudest point in the conflict",
          "The weakest link the larger structure quietly depends on",
          "The most emotional person in the room",
          "The oldest part of the system"
        ],
        1,
        "He wants diagnosis of dependency before concentration of force."
      ),
      question(
        "ch16-q02",
        "Why is attacking the whole front often inefficient?",
        [
          "Because broad pressure always looks weak",
          "Because diffuse effort wastes force that could have been concentrated at the decisive vulnerability",
          "Because systems only have one moving part",
          "Because visible strength is never real"
        ],
        1,
        "Leverage comes from the point of dependence, not from equal pressure everywhere."
      ),
      question(
        "ch16-q03",
        "What is one key warning in this strategy?",
        [
          "Never use follow through after a strike",
          "The weakest person is always the weakest link",
          "Weakness matters only if it is structurally decisive",
          "Precision matters less than intensity"
        ],
        2,
        "The vulnerable point has to move the larger system, not just look easy to hit."
      ),
      question(
        "ch16-q04",
        "What deeper principle closes this strategy?",
        [
          "Leverage is found where dependence is thin and consequence is large",
          "Broad effort is the fairest form of strategy",
          "Visible power is the only power",
          "Any small target is a good target"
        ],
        0,
        "Greene wants force aimed where the chain is most vulnerable to it."
      ),
    ],
  }),
  chapter({
    chapterId: "ch17-shape-the-story",
    number: 17,
    title: "Shape the Story",
    readingTimeMinutes: 14,
    summary: {
      p1: t(
        "Events do not speak for themselves, and Greene argues that whoever frames what happened often gains a large share of the strategic advantage afterward. People react not only to facts, but to the story that links the facts into meaning, blame, purpose, and future expectation.",
        "This strategy is about narrative command without drifting into fantasy. You do not invent reality out of nothing, but you do shape which parts become central, what motives are emphasized, and how the audience understands the stakes.",
        "Greene's point is that unframed events are vulnerable events. If you leave the story blank, louder or faster actors will fill it in with meanings that may damage your position for a long time."
      ),
      p2: t(
        "This matters because conflict continues after the immediate move. The interpretation of what just happened influences morale, legitimacy, alliances, and what people think is now possible or necessary.",
        "The deeper lesson is that narrative is strategic terrain. Story can stabilize a group, isolate an opponent, justify sacrifice, or make the next move look natural before it even occurs.",
        "In practical life, shaping the story often means being early, being coherent, and linking facts to a frame people can carry forward. Greene wants narrative used as command of meaning, not as empty spin detached from reality."
      ),
    },
    standardBullets: [
      bullet(
        "Do not leave interpretation unattended. Greene wants the meaning of events guided before others harden it against you.",
        "Narrative vacuum rarely stays empty."
      ),
      bullet(
        "Move early with a coherent frame. The first durable story often becomes the reference point for later judgment.",
        "Timing matters in meaning as much as in action."
      ),
      bullet(
        "Use facts selectively without breaking reality. Strong framing highlights what matters most and gives it shape.",
        "Story is emphasis and sequence, not pure invention."
      ),
      bullet(
        "Link the event to purpose. People follow stories that tell them what the event means for the larger campaign.",
        "Meaning organizes response."
      ),
      bullet(
        "Shape blame and responsibility carefully. Who looks reckless, steady, unfair, or necessary matters to what happens next.",
        "Narrative changes political weight."
      ),
      bullet(
        "Keep the story simple enough to travel. Complex framing often loses to cleaner narratives even when the facts are richer.",
        "Portable meaning spreads farther."
      ),
      bullet(
        "Protect credibility while framing. Story fails if the audience starts reading it as obvious manipulation detached from what they can see.",
        "Legitimacy still constrains narrative."
      ),
      bullet(
        "Use story to steady your side. Interpretation can either scatter morale or give people a clear way to understand pressure.",
        "Groups need meaning during strain."
      ),
      bullet(
        "Do not surrender narrative speed to louder actors. Delay lets other people teach the audience how to read the event.",
        "Silence can be strategically expensive."
      ),
      bullet(
        "The closing lesson is that story directs aftermath. Shape the meaning of events and you shape what people think should happen next.",
        "Narrative is a lever on future action."
      ),
    ],
    deeperBullets: [
      bullet(
        "Greene sees narrative as command over memory. The frame that survives is often what later decisions start from.",
        "Story makes some facts durable and others peripheral."
      ),
      bullet(
        "This strategy matters because morale runs through interpretation. The same setback can feel fatal or formative depending on how it is narrated.",
        "Meaning changes emotional consequence."
      ),
      bullet(
        "Story is also anticipatory. A good frame prepares the audience to accept later moves because it has already defined the problem and the likely remedy.",
        "Narrative can clear future ground."
      ),
      bullet(
        "Poor story shaping usually comes from either passivity or overreach. Silence cedes meaning. Exaggeration destroys trust.",
        "Greene wants coherence with discipline."
      ),
      bullet(
        "The broader lesson is that reality enters public life through interpretation. Greene wants the reader to guide meaning fast enough and honestly enough that future leverage is not surrendered for free.",
        "Events matter, but framed events matter more."
      ),
    ],
    takeaways: [
      "Do not leave the story empty",
      "Frame early and coherently",
      "Narrative should stay tied to reality",
      "Meaning shapes morale and blame",
      "Simple stories travel farther",
      "Story influences the next move",
    ],
    practice: [
      "State the meaning of the event before others do it for you",
      "Choose the facts that truly carry the frame",
      "Keep the story simple enough to repeat",
      "Check that the frame still matches what people can verify",
    ],
    examples: [
      example(
        "ch17-ex01",
        "Project setback after a visible miss",
        ["work"],
        "A project misses an important milestone, and the room is full of competing explanations. If the team leaves the meaning open, the miss may harden into a story of incompetence rather than a story of correction and next steps.",
        [
          "Frame the miss quickly with a truthful account of what happened, what it means, and how the team is now moving.",
          "Do not let the event speak only through rumor, blame, or the loudest frustration in the room."
        ],
        "Greene's lesson is that the story around a setback often decides whether the setback remains manageable or becomes identity."
      ),
      example(
        "ch17-ex02",
        "Manager allows a rival to define the conflict",
        ["work"],
        "A rival inside an organization keeps shaping a dispute as if one side is reckless and the other is responsible. That frame is gaining ground because nobody has yet offered a stronger interpretation.",
        [
          "Present a clearer narrative that links the facts to the deeper issue and shows why your line is the steadier one.",
          "Move before the rival's story settles into common sense."
        ],
        "This strategy matters because people often choose sides through narrative before they fully examine evidence."
      ),
      example(
        "ch17-ex03",
        "Club controversy after a bad meeting",
        ["school"],
        "A club meeting goes badly, and members leave with different impressions. If nobody shapes the aftermath, the event will be remembered only through the most emotional retelling.",
        [
          "Issue a clear account of what happened, what will change, and what the group should understand the moment to mean.",
          "Use the story to steady morale and direct the next steps before gossip writes the memory."
        ],
        "Greene would say that the aftermath is part of the battle. Interpretation decides what the event becomes."
      ),
      example(
        "ch17-ex04",
        "Student leader lets online retelling take over",
        ["school"],
        "After a campus dispute, a student leader stays quiet too long, assuming the facts will eventually speak clearly for themselves. Online retelling is now defining the leader's role in the event.",
        [
          "Frame the event early with a simple, credible account tied to the larger purpose of the group.",
          "Do not wait for the perfect statement if the current silence is teaching the audience the wrong lesson."
        ],
        "The strategy applies because narrative speed often determines whether later truth arrives as correction or as weakness."
      ),
      example(
        "ch17-ex05",
        "Family conflict remembered the wrong way",
        ["personal"],
        "A family disagreement ends, but the story traveling afterward makes one person look selfish and another person look purely patient, even though the reality was more mixed. The emotional memory is now becoming political memory.",
        [
          "Clarify the meaning of the event while people are still forming their interpretation of it.",
          "Link the facts to a fairer frame before the most flattering retelling becomes the permanent one."
        ],
        "Greene's point is that story does not only manage outsiders. It also shapes what close groups remember and repeat."
      ),
      example(
        "ch17-ex06",
        "Friend group split after one public scene",
        ["personal"],
        "A tense public moment leaves a friend group uncertain about what happened and who acted out of proportion. The social future of the group now depends heavily on the story that wins.",
        [
          "Offer a calm and credible frame that explains the event without feeding needless drama.",
          "Use the story to direct the group toward the next useful step instead of leaving everyone inside raw confusion."
        ],
        "This strategy matters because interpretation often decides whether a group repairs, fractures, or repeats the same scene later."
      ),
    ],
    directQuestions: [
      question(
        "ch17-q01",
        "Why does Greene care so much about shaping the story after an event?",
        [
          "Because facts have no value at all",
          "Because interpretation influences morale, blame, and what people think should happen next",
          "Because the fastest story is always true",
          "Because narrative replaces action"
        ],
        1,
        "He sees narrative as a lever on aftermath, alliances, and future moves."
      ),
      question(
        "ch17-q02",
        "What most weakens a strategic story?",
        [
          "Moving early",
          "Staying tied to verifiable facts",
          "Obvious exaggeration detached from reality",
          "Keeping the frame simple"
        ],
        2,
        "Credibility matters because story that reads as pure manipulation loses force."
      ),
      question(
        "ch17-q03",
        "Why is simplicity important in this strategy?",
        [
          "Because portable stories spread faster and organize interpretation better",
          "Because complex reality is never useful",
          "Because only slogans can move people",
          "Because narrative should ignore evidence"
        ],
        0,
        "A frame has to travel if it is going to shape the wider field."
      ),
      question(
        "ch17-q04",
        "What deeper principle closes this strategy?",
        [
          "Events matter only if they are dramatic",
          "Meaning is a strategic terrain that should be guided rather than abandoned",
          "Silence is always the strongest narrative move",
          "Story should replace all substance"
        ],
        1,
        "Greene wants the reader to see interpretation itself as part of the campaign."
      ),
    ],
  }),
  chapter({
    chapterId: "ch18-control-timing",
    number: 18,
    title: "Control Timing",
    readingTimeMinutes: 13,
    summary: {
      p1: t(
        "Timing turns ordinary moves into strong moves or wasted moves, and Greene argues that the same action can succeed brilliantly or fail badly depending on when it lands. Control of timing means refusing to rush because of nerves and refusing to wait because of passive hope. It means reading ripeness with discipline.",
        "This strategy is about tempo at the point of decision. A move should arrive when preparation, context, and vulnerability are aligned enough to make the effort count.",
        "Greene's lesson is that impatience and passivity are twin enemies of good timing. One acts too early to relieve tension. The other acts too late and lets the opening disappear."
      ),
      p2: t(
        "This matters because people often know what to do before they know when to do it. They have the move but misread the moment, which can make a sound idea feel weak or reckless.",
        "The deeper lesson is that timing is relational. You are reading not just your own readiness, but the opponent's rhythm, the audience's mood, the level of exposure, and the cost of delay.",
        "In practical life, controlling timing often means letting pressure ripen, interrupting just before a pattern settles, or moving in the narrow interval when the other side is least able to answer well."
      ),
    },
    standardBullets: [
      bullet(
        "Timing changes the value of the move. Greene wants action measured against the moment, not judged only in the abstract.",
        "Good ideas can fail on bad timing."
      ),
      bullet(
        "Do not move early just to relieve tension. Premature action often serves nerves more than strategy.",
        "Impatience can waste strong plans."
      ),
      bullet(
        "Do not wait for perfect certainty either. Openings often close while people are still trying to feel safer.",
        "Passivity is also bad timing."
      ),
      bullet(
        "Read ripeness before acting. Conditions matter more than internal eagerness.",
        "The field has to be ready enough as well."
      ),
      bullet(
        "Watch the other side's rhythm. Timing improves when you know when they are overextended, inattentive, or slow to answer.",
        "Their cycle helps reveal your moment."
      ),
      bullet(
        "Use delay with intention. Waiting can strengthen a move if the delay is building exposure or ripeness rather than just avoiding discomfort.",
        "Purposeful waiting is still action."
      ),
      bullet(
        "Exploit the narrow interval. Many timing advantages are brief, so clarity has to be ready before the opening arrives.",
        "Preparation makes fast use possible."
      ),
      bullet(
        "Separate urgency from importance. Some moves feel urgent only because emotions are high, not because the window is truly closing.",
        "Heat is not the same as timing."
      ),
      bullet(
        "Prepare the move before the moment arrives. Good timing often belongs to the side already ready to use it.",
        "Readiness turns intervals into opportunities."
      ),
      bullet(
        "The closing lesson is that timing is force applied at the right moment. Control the when, and the same action can gain far more weight.",
        "Moment and move belong together."
      ),
    ],
    deeperBullets: [
      bullet(
        "Greene treats timing as the meeting point of preparation and opportunity. Neither one is enough by itself.",
        "Readiness without opening stalls. Opening without readiness is wasted."
      ),
      bullet(
        "This strategy also protects morale. A well timed move feels stronger and cleaner, which increases confidence in the campaign.",
        "Successes teach rhythm."
      ),
      bullet(
        "Bad timing often comes from emotion. Anxiety pushes action too soon, while fear of exposure postpones action too long.",
        "The inner field still shapes the clock."
      ),
      bullet(
        "Timing is not only about attack. It also governs when to answer, when to absorb, and when to let the other side spend itself a little longer.",
        "Patience and force are both timing tools."
      ),
      bullet(
        "The broader lesson is that moments have structure. Greene wants the reader to recognize when conditions, attention, and vulnerability have aligned enough that effort will finally count for more.",
        "The right when can transform the same what."
      ),
    ],
    takeaways: [
      "Good timing changes the value of the move",
      "Do not act early to soothe nerves",
      "Do not wait for perfect safety",
      "Read the other side's rhythm",
      "Prepare before the opening appears",
      "Moment and move must align",
    ],
    practice: [
      "Name what would make the move ripe enough",
      "Check whether your urge to act is strategic or emotional",
      "Watch one timing clue from the other side",
      "Prepare the move so you can use a short opening fast",
    ],
    examples: [
      example(
        "ch18-ex01",
        "Manager forcing a decision too early",
        ["work"],
        "A manager wants to settle an internal dispute now because the tension is uncomfortable, but key information is still missing and one more week would expose the stronger route clearly.",
        [
          "Do not act early just to remove discomfort if the field is still ripening in your favor.",
          "Use the short delay to gather the conditions that will make the eventual move land with more force."
        ],
        "Greene's point is that premature action often serves emotional relief more than strategic timing."
      ),
      example(
        "ch18-ex02",
        "Negotiation window closing",
        ["work"],
        "A team has the information it needs and can see the counterpart is unusually pressured, but internal caution keeps postponing the offer. The best opening may vanish during the delay.",
        [
          "Use the opening while the other side's timing is still favorable instead of waiting for a fantasy of complete certainty.",
          "Let preparation support decisiveness once the moment is genuinely there."
        ],
        "This strategy matters because hesitation after ripeness can waste the very leverage you worked to create."
      ),
      example(
        "ch18-ex03",
        "Student group speaking too late",
        ["school"],
        "A student group has strong evidence in a campus dispute, but waits so long to present it that the public mood has already settled around another story. The facts are still good, but the timing is now weak.",
        [
          "Move before the interpretation hardens if the evidence and the window are already sufficient.",
          "Do not mistake delay for maturity when the field is about to close."
        ],
        "Greene would say timing changes how much weight the same truth can carry."
      ),
      example(
        "ch18-ex04",
        "Class project feedback delivered at the wrong moment",
        ["school"],
        "A student gives valid feedback to a teammate right before a public presentation when the teammate has no room to absorb or apply it well. The content is right. The timing is destructive.",
        [
          "Separate the value of the point from the value of the moment and choose a time when the feedback can improve the campaign instead of rattling it.",
          "Use timing to increase impact, not simply to discharge the point."
        ],
        "The strategy applies because a correct move at the wrong moment can behave like a bad move."
      ),
      example(
        "ch18-ex05",
        "Personal decision delayed into weakness",
        ["personal"],
        "Someone knows a needed conversation has to happen, but keeps waiting for a moment that will feel perfect. The other person's behavior is hardening while the opportunity for a clean talk is shrinking.",
        [
          "Stop waiting for the ideal emotional atmosphere if the real opening is already beginning to close.",
          "Use enough preparation to move well, then accept that timing often requires action before comfort arrives."
        ],
        "Greene's lesson is that passivity can ruin timing just as quickly as impatience can."
      ),
      example(
        "ch18-ex06",
        "Friend group intervention mistimed",
        ["personal"],
        "A group wants to address a serious issue with one friend, but chooses a moment when everyone is already tired and defensive. The conversation explodes before the actual issue is heard.",
        [
          "Pick a moment with enough calm, privacy, and attention that the message can actually land.",
          "Treat the timing of the intervention as part of the intervention itself."
        ],
        "This strategy matters because timing changes not only whether people hear you, but what emotional meaning they attach to being approached."
      ),
    ],
    directQuestions: [
      question(
        "ch18-q01",
        "What is Greene's main claim about timing?",
        [
          "Timing matters less than courage",
          "The same move can succeed or fail largely because of when it lands",
          "Good timing removes the need for preparation",
          "The best move is always the fastest move"
        ],
        1,
        "He treats moment and move as inseparable."
      ),
      question(
        "ch18-q02",
        "What often causes premature action?",
        [
          "Strategic ripeness",
          "Emotional need to relieve tension",
          "Too much reserve",
          "Perfect intelligence"
        ],
        1,
        "People often act early because the discomfort of waiting feels harder than the cost of bad timing."
      ),
      question(
        "ch18-q03",
        "Why can waiting also be a timing failure?",
        [
          "Because every delay is weakness",
          "Because openings can close while people chase perfect safety",
          "Because patience always hurts morale",
          "Because the other side never changes rhythm"
        ],
        1,
        "Passivity can waste ripe conditions just as surely as impatience can."
      ),
      question(
        "ch18-q04",
        "What deeper principle closes this strategy?",
        [
          "Timing is preparation and opportunity meeting in the same interval",
          "The clock matters only for attack",
          "Emotion is a reliable guide to moment selection",
          "Ripeness is mostly luck"
        ],
        0,
        "Greene wants readers ready enough to exploit short openings when they appear."
      ),
    ],
  }),
  chapter({
    chapterId: "ch19-exhaust-opposing-plans",
    number: 19,
    title: "Exhaust Opposing Plans",
    readingTimeMinutes: 13,
    summary: {
      p1: t(
        "One way to win is not only to advance your own design but to wear down the other side's ability to keep their design coherent. Greene argues that opposing plans can be exhausted through delay, redirection, complication, denial of closure, and pressure that forces constant adjustment.",
        "This strategy is not about noisy harassment for its own sake. It is about making the other side spend more energy maintaining their plan than the plan is worth.",
        "Greene's lesson is that campaigns weaken when they must keep solving new problems instead of building momentum. Exhaustion can break design before direct defeat arrives."
      ),
      p2: t(
        "This matters because many strong plans fail not from one dramatic hit, but from too much friction over too much time. The designers become reactive, the sequence frays, and morale drops because the plan no longer feels clean or under control.",
        "The deeper lesson is that disruption compounds. Small forced adjustments can produce fatigue, doubt, and error that finally make the whole campaign brittle.",
        "In practical life, exhausting opposing plans often means denying easy progress, forcing costly rework, or keeping pressure distributed in ways that make concentration harder for the other side than they expected."
      ),
    },
    standardBullets: [
      bullet(
        "Attack coherence, not only strength. Greene wants the other side's plan to become expensive to maintain.",
        "A tired design is easier to beat."
      ),
      bullet(
        "Force repeated adjustment. Plans weaken when they must keep changing in response to new pressure.",
        "Constant revision drains confidence and clarity."
      ),
      bullet(
        "Deny easy closure. Opponents often rely on fast resolution to preserve momentum and morale.",
        "Delay can be strategically corrosive."
      ),
      bullet(
        "Use friction that multiplies. Small complications matter when they keep generating more work downstream.",
        "The best disruptions echo."
      ),
      bullet(
        "Make them spend attention in the wrong places. The more their focus is consumed by maintenance, the less force remains for execution.",
        "Exhaustion is often cognitive before it is physical."
      ),
      bullet(
        "Do not copy their pace blindly. Exhausting their plan may require refusing the tempo they hoped to impose.",
        "Rhythm can be a pressure tool."
      ),
      bullet(
        "Look for brittle sequences. Plans with tight dependencies tire quickly when one step keeps slipping.",
        "Sequence reveals where exhaustion can spread."
      ),
      bullet(
        "Make pressure cumulative, not merely irritating. Random annoyance wastes effort unless it is connected to a larger draining effect.",
        "The disruption should add up."
      ),
      bullet(
        "Protect your own plan from symmetrical fatigue. Exhaustion strategies fail when they cost you just as much as the other side.",
        "Asymmetry still matters."
      ),
      bullet(
        "The closing lesson is that drained plans break themselves. Exhaust the design and the people holding it will start making your work easier for you.",
        "Coherence is a target."
      ),
    ],
    deeperBullets: [
      bullet(
        "Greene is interested in how fatigue changes judgment. Once people are overextended by maintenance, they become more predictable, more emotional, and easier to misread their own position.",
        "Exhaustion weakens intelligence."
      ),
      bullet(
        "This strategy can be quieter than direct attack. The opponent may feel busier and busier before realizing the plan is already thinning out structurally.",
        "Drain often hides inside ordinary work."
      ),
      bullet(
        "Delay matters here because many campaigns derive force from momentum and confidence. Interrupting sequence can do more damage than one blunt confrontation.",
        "Stall can be a weapon."
      ),
      bullet(
        "Not all friction is useful. Greene wants pressure that degrades design, not static noise that simply proves you are present.",
        "Purpose decides whether irritation becomes strategy."
      ),
      bullet(
        "The broader lesson is that plans fail when they become too expensive to sustain. Greene wants the reader to target the cost of coherence itself.",
        "Drain their ability to stay organized and the campaign weakens from within."
      ),
    ],
    takeaways: [
      "Attack the opponent's coherence",
      "Force repeated adjustment",
      "Deny easy closure",
      "Use friction that compounds",
      "Protect yourself from equal fatigue",
      "Drained plans weaken from within",
    ],
    practice: [
      "Identify where the other side's plan is most sequence dependent",
      "Choose one pressure that creates downstream rework",
      "Avoid disruptions that tire you equally",
      "Ask whether your friction is cumulative or merely noisy",
    ],
    examples: [
      example(
        "ch19-ex01",
        "Competitor relying on a rigid rollout",
        ["work"],
        "A competitor has a tightly sequenced rollout that looks strong on paper. The plan depends on hitting several time sensitive steps cleanly, and small delays are already creating internal strain.",
        [
          "Pressure the sequence points that force rework or additional coordination rather than trying to beat the whole rollout at once.",
          "Make them spend energy preserving coherence until the plan starts tiring itself out."
        ],
        "Greene's lesson is that plans often weaken when the cost of keeping them together becomes too high."
      ),
      example(
        "ch19-ex02",
        "Negotiation strategy losing focus",
        ["work"],
        "A counterpart enters a negotiation with a clean script, but you can see that small requests for clarification and sequence changes are starting to push them off their prepared path. Their confidence is dropping as maintenance grows.",
        [
          "Use pressure that forces repeated adjustment and consumes their attention without abandoning your own clarity.",
          "Target the coherence of the plan, not just the surface position stated aloud."
        ],
        "This strategy matters because a plan that keeps repairing itself may eventually stop advancing at all."
      ),
      example(
        "ch19-ex03",
        "Student campaign with brittle routines",
        ["school"],
        "A rival student campaign depends on a very tight schedule and a narrow set of volunteers. Small disruptions are beginning to create more strain than the campaign can comfortably absorb.",
        [
          "Focus on the sequence points where delay or redirection creates the most downstream fatigue.",
          "Do not spread effort widely if one well chosen friction point can force repeated rework."
        ],
        "Greene would say the best exhaustion strategy attacks the cost of maintaining the campaign, not only the message around it."
      ),
      example(
        "ch19-ex04",
        "Group project plan fraying",
        ["school"],
        "A project opponent in a debate or contest has a polished approach that depends on the discussion staying in one order. Small detours are making the plan less coherent each round.",
        [
          "Keep pressing the points that force reordering and improvisation rather than letting the opponent run the prepared script cleanly.",
          "Use cumulative disruption instead of random aggression."
        ],
        "The strategy applies because exhaustion grows when a plan has to keep rebuilding itself under live conditions."
      ),
      example(
        "ch19-ex05",
        "Family pressure campaign losing shape",
        ["personal"],
        "One family member keeps trying to pressure others with the same rehearsed line, but the line weakens when people refuse quick closure and keep asking for specifics. The effort is starting to tire itself out.",
        [
          "Continue forcing the plan into repeated clarification instead of arguing on the original simplified terms.",
          "Let the pressure exhaust itself by making coherence expensive."
        ],
        "Greene's point is that some pressures fail once they must keep rebuilding their own internal story."
      ),
      example(
        "ch19-ex06",
        "Friend group drama sustained by momentum",
        ["personal"],
        "A pattern of group drama survives because it keeps reaching quick emotional conclusions before anyone slows it down. The drama looks powerful mainly because it has momentum.",
        [
          "Interrupt the momentum with clarifying questions, delayed closure, and refusal to let the old script complete itself quickly.",
          "Make the pattern work harder to sustain itself until it begins to lose force."
        ],
        "This strategy matters because many harmful dynamics survive on ease and speed more than on true strength."
      ),
    ],
    directQuestions: [
      question(
        "ch19-q01",
        "What is Greene trying to exhaust in this strategy?",
        [
          "Only the opponent's emotions",
          "The coherence and maintainability of the opposing plan",
          "Every person equally on the other side",
          "All communication at once"
        ],
        1,
        "He wants the other side's design to become too costly to keep coherent."
      ),
      question(
        "ch19-q02",
        "Why is repeated adjustment so useful here?",
        [
          "Because it always creates surrender",
          "Because it drains attention, confidence, and momentum over time",
          "Because it removes the need for leverage",
          "Because it is morally neutral"
        ],
        1,
        "Plans grow brittle when they must keep repairing sequence and coherence."
      ),
      question(
        "ch19-q03",
        "What kind of friction is strategically strongest?",
        [
          "Random irritation with no larger effect",
          "Pressure that multiplies into more work or more delay downstream",
          "Noise that proves you are active",
          "Any emotional escalation"
        ],
        1,
        "Greene wants compounding disruption, not meaningless annoyance."
      ),
      question(
        "ch19-q04",
        "What deeper principle closes this strategy?",
        [
          "Plans weaken when the cost of maintaining coherence becomes too high",
          "Exhaustion works only through loud confrontation",
          "Delay is always a sufficient weapon by itself",
          "Symmetrical fatigue is still a win"
        ],
        0,
        "He is targeting the opponent's ability to keep the design intact, not just their mood."
      ),
    ],
  }),
  chapter({
    chapterId: "ch20-escalate-only-with-advantage",
    number: 20,
    title: "Escalate Only With Advantage",
    readingTimeMinutes: 13,
    summary: {
      p1: t(
        "Escalation should increase leverage, not merely increase heat, and Greene argues that many people escalate because they want to feel serious, righteous, or strong in the moment. Strategic escalation is different. It is used when position, timing, morale, or information makes the higher level of pressure likely to improve the outcome.",
        "This strategy asks a simple question before force rises: what advantage will the escalation convert or protect. If that answer is weak, the move is probably emotional or theatrical rather than strategic.",
        "Greene's lesson is that escalation is expensive. It commits resources, narrows options, and raises the stakes, so it should be used when the field already gives you reason to believe the stronger move can land well."
      ),
      p2: t(
        "This matters because escalation feels clarifying even when it is careless. It can temporarily silence doubt, signal resolve, or satisfy pride, which is why people are drawn to it before they have earned it.",
        "The deeper lesson is that advantage should precede intensity. Better information, better terrain, stronger morale, cleaner alliances, or a ripe opening should support the move before pressure is raised.",
        "In practice, this means refusing to escalate from wounded ego, social embarrassment, or impatience alone. Greene wants pressure matched to position so the larger move works for you rather than simply making the whole contest more dangerous."
      ),
    },
    standardBullets: [
      bullet(
        "Escalation is not proof of strength by itself. Greene wants added pressure tied to a real advantage.",
        "Heat alone does not equal leverage."
      ),
      bullet(
        "Ask what the stronger move improves. If escalation changes nothing useful, it is probably serving emotion.",
        "Purpose must rise with pressure."
      ),
      bullet(
        "Do not escalate from wounded pride. Humiliation and anger often demand bigger moves before the field supports them.",
        "Ego is a reckless escalator."
      ),
      bullet(
        "Raise intensity when timing, position, or information favors you. Advantage should make escalation cleaner and cheaper.",
        "Prepared pressure lands better."
      ),
      bullet(
        "Remember the cost of escalation. Higher force narrows options and often makes deescalation harder later.",
        "Intensity changes the whole campaign."
      ),
      bullet(
        "Keep lower level tools alive. Escalation is stronger when it is a deliberate step up from control, not a leap from frustration.",
        "Sequence matters."
      ),
      bullet(
        "Do not mistake audience demands for strategic need. Public pressure often rewards dramatic overreach.",
        "The crowd is rarely a good commander."
      ),
      bullet(
        "Escalate with follow through ready. Larger pressure without the next line prepared can create exposure instead of advantage.",
        "The move has to be supportable."
      ),
      bullet(
        "Use restraint as proof of seriousness. Refusing to escalate early can preserve credibility and surprise for a better moment later.",
        "Control can signal strength too."
      ),
      bullet(
        "The closing lesson is that force should rise when advantage is already present, not when emotion merely wants relief.",
        "Good escalation converts position into outcome."
      ),
    ],
    deeperBullets: [
      bullet(
        "Greene sees escalation as irreversible enough to deserve high standards. Once the level rises, the campaign often cannot return cheaply to its earlier shape.",
        "That is why heat should be earned."
      ),
      bullet(
        "This strategy protects against crowd logic. Teams and audiences often confuse stronger language or stronger pressure with clearer strategy.",
        "Collective emotion can overrate intensity."
      ),
      bullet(
        "Escalation works best when the other side is already strained or exposed. Otherwise you may simply enlarge the contest on terms they can still answer.",
        "Position should carry the pressure."
      ),
      bullet(
        "Restraint is not passivity here. It is preservation of future force until the field offers better conversion.",
        "Delayed escalation can be a stronger threat."
      ),
      bullet(
        "The broader lesson is that leverage should set the level. Greene wants intensity to follow advantage instead of trying to create advantage out of raw aggression alone.",
        "Pressure is strongest when supported by field conditions."
      ),
    ],
    takeaways: [
      "Heat is not the same as leverage",
      "Do not escalate from pride",
      "Advantage should come before intensity",
      "Higher pressure changes the whole campaign",
      "Restraint can preserve future force",
      "Escalation should convert position into outcome",
    ],
    practice: [
      "Name the concrete advantage supporting escalation",
      "Check whether the urge is strategic or emotional",
      "Prepare the next line before raising pressure",
      "Refuse escalation when it only enlarges danger",
    ],
    examples: [
      example(
        "ch20-ex01",
        "Manager wants to go public too early",
        ["work"],
        "A manager is tempted to escalate a dispute to senior leadership after one frustrating exchange. The urge is strong, but the evidence is still thin and the current field offers little real advantage.",
        [
          "Wait until the issue is better documented or the timing gives the escalation a clearer chance of changing the result.",
          "Do not raise the level simply because the current discomfort feels intolerable."
        ],
        "Greene's lesson is that escalation should convert leverage, not compensate for its absence."
      ),
      example(
        "ch20-ex02",
        "Negotiation pressure raised without backing",
        ["work"],
        "A team wants to threaten walking away in a negotiation even though it has not fully prepared the alternative path. The harder line would feel strong, but the support behind it is weak.",
        [
          "Build the fallback and the evidence first so the higher pressure rests on real position.",
          "Refuse dramatic escalation if the stronger move cannot yet be carried through cleanly."
        ],
        "This strategy matters because unsupported escalation can reveal weakness more than strength."
      ),
      example(
        "ch20-ex03",
        "Student leader considering a public call out",
        ["school"],
        "A student leader is angry at a rival and wants to escalate by making the conflict public immediately. The move would attract attention, but it is not clear that it would improve the actual campaign.",
        [
          "Ask what concrete advantage the public escalation would create beyond emotional satisfaction.",
          "If the answer is thin, hold the pressure until the field gives you a better reason to raise the level."
        ],
        "Greene would say public heat often flatters resolve while weakening position."
      ),
      example(
        "ch20-ex04",
        "Group project conflict getting bigger than the work",
        ["school"],
        "A project disagreement is becoming personal, and one student wants to escalate immediately to the professor. The conflict may need outside intervention later, but it is not yet clear that the timing helps.",
        [
          "Use lower level tools first if they still have a real chance to clarify the issue or gather stronger evidence.",
          "Escalate when the higher level is likely to improve the outcome, not just when frustration peaks."
        ],
        "The strategy applies because bigger moves should be chosen for leverage, not for emotional relief."
      ),
      example(
        "ch20-ex05",
        "Family confrontation raised too fast",
        ["personal"],
        "A person wants to escalate a family conflict into a major confrontation while still reacting from embarrassment and anger. The pressure would rise, but the advantage behind it is uncertain.",
        [
          "Let the emotional surge settle enough to ask what the stronger move would actually gain and what it would cost.",
          "Choose a higher level only if it protects something important and the field can support it."
        ],
        "Greene's point is that intensity chosen from wounded pride usually enlarges the danger faster than the leverage."
      ),
      example(
        "ch20-ex06",
        "Friend group ultimatum with no support",
        ["personal"],
        "Someone in a friend group wants to issue an ultimatum, but has not thought through what comes next if the ultimatum is ignored. The escalation is emotionally tempting and strategically underbuilt.",
        [
          "Do not raise the level until you know what outcome you are truly seeking and how you will sustain the move afterward.",
          "Escalate only when the stronger stance has real backing and a clear purpose."
        ],
        "This strategy matters because unsupported ultimatums often damage credibility more than they create control."
      ),
    ],
    directQuestions: [
      question(
        "ch20-q01",
        "What standard does Greene set for escalation?",
        [
          "It should follow real advantage rather than emotional heat alone",
          "It should happen whenever the issue feels important",
          "It should always be public",
          "It should replace lower level tools immediately"
        ],
        0,
        "He wants intensity tied to position, timing, and support, not to wounded pride."
      ),
      question(
        "ch20-q02",
        "Why is escalation expensive?",
        [
          "Because it always fails",
          "Because it narrows options and raises the stakes for the whole campaign",
          "Because it removes all audience interest",
          "Because it eliminates the need for follow through"
        ],
        1,
        "Higher force changes the shape of the contest and is not easy to reverse cheaply."
      ),
      question(
        "ch20-q03",
        "What often pushes people to escalate too soon?",
        [
          "Careful timing",
          "Better intelligence",
          "Pride, humiliation, and the need to feel serious",
          "A strong reserve line"
        ],
        2,
        "Greene warns that emotional relief often disguises itself as strategic necessity."
      ),
      question(
        "ch20-q04",
        "What deeper principle closes this strategy?",
        [
          "Advantage should set the level of force, not the other way around",
          "Pressure creates leverage by itself",
          "Restraint always looks weak",
          "Escalation matters most for appearances"
        ],
        0,
        "He wants leverage to precede intensity so the larger move can actually convert into outcome."
      ),
    ],
  }),
  chapter({
    chapterId: "ch21-use-flexibility-over-pride",
    number: 21,
    title: "Use Flexibility Over Pride",
    readingTimeMinutes: 13,
    summary: {
      p1: t(
        "Pride makes people keep pressing the wrong method long after the field has changed, and Greene argues that flexibility is often the more powerful form of self respect. Strong strategists adapt to conditions, opponents, and timing instead of treating consistency of style as a sacred virtue.",
        "This strategy does not celebrate shapelessness. It asks for firmness of purpose combined with flexibility of method. The objective stays. The route changes when the field demands it.",
        "Greene's lesson is that rigid identity creates strategic blindness. Once you become attached to appearing strong in one particular way, the other side can start using that predictability against you."
      ),
      p2: t(
        "This matters because pride often disguises itself as principle. People say they are staying true to themselves when in reality they are refusing to learn, bend, or retreat in time.",
        "The deeper lesson is that adaptation preserves initiative. The side that can shift without emotional collapse keeps more options alive and turns change into a weapon rather than a threat.",
        "In practical life, flexibility often means changing tone, route, sequence, or method while holding onto the real objective. Greene wants the reader to value results over self flattering rigidity."
      ),
    },
    standardBullets: [
      bullet(
        "Keep the objective firm and the method flexible. Greene wants adaptation without loss of purpose.",
        "The mission should survive even when the method changes."
      ),
      bullet(
        "Do not confuse pride with strength. Sticking with a failing approach often serves identity more than the campaign.",
        "Ego can make bad methods feel noble."
      ),
      bullet(
        "Read when the field has changed. A method that once fit can become expensive or predictable later.",
        "Conditions decide usefulness."
      ),
      bullet(
        "Use retreat and redirection when they protect leverage. Not every bend is a loss.",
        "Flexible movement can preserve power."
      ),
      bullet(
        "Change tone when needed. The same objective may require firmness in one moment and softness in another.",
        "Style should answer the field."
      ),
      bullet(
        "Break attachment to one self image. People who need to look fearless or unbending are easy to bait.",
        "Identity can become a trap."
      ),
      bullet(
        "Adapt faster than resentment. The longer you stay emotionally committed to the old way, the more expensive the change becomes.",
        "Speed matters in correction too."
      ),
      bullet(
        "Study what the other side expects from you. Predictability creates openings they can prepare for.",
        "Flexibility disrupts preparation."
      ),
      bullet(
        "Let learning show in action. Adaptation is not theory. It is visible revision based on reality.",
        "Change has to reach behavior."
      ),
      bullet(
        "The closing lesson is that pride freezes strategy. Greene prefers the person who bends with reality and still reaches the objective.",
        "Adaptability is durable strength."
      ),
    ],
    deeperBullets: [
      bullet(
        "Greene is separating integrity from stubbornness. Integrity can remain intact while tactics shift repeatedly under pressure.",
        "The difference is whether purpose or vanity is in command."
      ),
      bullet(
        "This strategy also protects morale. Groups lose faith when leaders cling to broken methods only to preserve face.",
        "Adaptation can restore confidence by showing reality is being read honestly."
      ),
      bullet(
        "Rigid style makes you legible to opponents. Once they know the move you cannot emotionally resist making, they can build around it.",
        "Predictable pride becomes exploitable structure."
      ),
      bullet(
        "Flexibility requires emotional looseness. People who cannot tolerate being seen changing course often stay loyal to the wrong plan too long.",
        "Shame can block correction."
      ),
      bullet(
        "The broader lesson is that strategy lives in contact with changing reality. Greene wants purpose strong enough to survive method change and ego light enough to allow it.",
        "Adaptation keeps the campaign alive."
      ),
    ],
    takeaways: [
      "Keep purpose firm and method flexible",
      "Pride can freeze correction",
      "Read when the field has changed",
      "Retreat can protect leverage",
      "Predictability helps opponents",
      "Adaptation is durable strength",
    ],
    practice: [
      "Name one method you are defending mostly from pride",
      "Check what changed in the field since the plan was first chosen",
      "Revise the method without revising the objective",
      "Ask what your predictability is teaching the other side",
    ],
    examples: [
      example(
        "ch21-ex01",
        "Manager clinging to one leadership style",
        ["work"],
        "A manager has always led through direct pressure and fast calls, but the current team is becoming more cautious and information heavy under new constraints. The old style is producing resistance rather than speed.",
        [
          "Keep the objective of clarity and momentum, but change the method to fit the team and the field now in front of you.",
          "Do not defend the old style just because it once made you look strong."
        ],
        "Greene's lesson is that identity based leadership becomes brittle when conditions change and the leader does not."
      ),
      example(
        "ch21-ex02",
        "Negotiation tactic no longer working",
        ["work"],
        "Someone keeps using the same negotiation move because it worked in earlier deals. The counterpart now expects it and has prepared a clean answer.",
        [
          "Notice that the method has become readable and change the route before pride forces you into a rehearsed defeat.",
          "Adapt while the objective is still reachable rather than after the cost has risen."
        ],
        "This strategy matters because yesterday's successful method can become today's predictable weakness."
      ),
      example(
        "ch21-ex03",
        "Student leader defending a broken plan",
        ["school"],
        "A student leader knows a campus event plan is failing, but keeps doubling down because changing course publicly would feel embarrassing. The plan is being protected more than the event itself.",
        [
          "Protect the event, not your pride, and change the method before the cost of consistency gets larger than the cost of revision.",
          "Let adaptation show that the mission is more important than face."
        ],
        "Greene would say rigidity often hides under the language of commitment. The real question is what you are truly being loyal to."
      ),
      example(
        "ch21-ex04",
        "Team captain refuses a tactical shift",
        ["school"],
        "A team captain keeps using the same approach because it feels like the team's identity, even though opponents are now prepared for it. The pattern is turning tradition into predictability.",
        [
          "Hold onto the team's purpose and spirit while changing the method that has become too easy to read.",
          "Do not let style loyalty make the group strategically stale."
        ],
        "The strategy applies because pride in one form can quietly weaken the larger campaign."
      ),
      example(
        "ch21-ex05",
        "Family conflict trapped in one script",
        ["personal"],
        "A person keeps handling a family conflict the same way because backing off or changing tone feels like losing. The repeated method is no longer working, but pride is blocking adjustment.",
        [
          "Redefine success as protecting the actual relationship or boundary rather than preserving one familiar style of strength.",
          "Use a different route if the old one now produces the same bad ending every time."
        ],
        "Greene's point is that flexibility can be stronger than insistence when insistence has become a ritual of failure."
      ),
      example(
        "ch21-ex06",
        "Friend group expects your usual reaction",
        ["personal"],
        "A friend group has learned that you will answer tension in one predictable way. That expectation is now shaping how conflicts with you begin.",
        [
          "Break the expectation by changing method while holding your real objective steady.",
          "Use the shift to recover initiative instead of replaying the same script they already know."
        ],
        "This strategy matters because predictability hands other people emotional preparation before the conversation even starts."
      ),
    ],
    directQuestions: [
      question(
        "ch21-q01",
        "What does Greene want you to keep flexible?",
        [
          "The objective",
          "Only your public image",
          "The method, while the objective stays firm",
          "Every principle and goal equally"
        ],
        2,
        "He separates firmness of purpose from rigidity of method."
      ),
      question(
        "ch21-q02",
        "Why is pride dangerous in this strategy?",
        [
          "Because it makes change feel like humiliation and keeps broken methods alive",
          "Because it always destroys morale instantly",
          "Because it prevents any confidence",
          "Because it makes objectives unclear"
        ],
        0,
        "Pride often protects identity more fiercely than it protects the campaign."
      ),
      question(
        "ch21-q03",
        "How does rigidity help the other side?",
        [
          "It makes your motive clearer",
          "It makes your moves predictable and easier to prepare for",
          "It reduces the cost of their errors",
          "It forces them to slow down"
        ],
        1,
        "Predictable pride is a usable structure for an opponent."
      ),
      question(
        "ch21-q04",
        "What deeper principle closes this strategy?",
        [
          "Purpose should be strong enough to survive method change",
          "Consistency matters more than reality",
          "Retreat always weakens authority",
          "Adaptation means low standards"
        ],
        0,
        "Greene wants adaptation guided by purpose rather than blocked by ego."
      ),
    ],
  }),
  chapter({
    chapterId: "ch22-break-predictable-patterns",
    number: 22,
    title: "Break Predictable Patterns",
    readingTimeMinutes: 13,
    summary: {
      p1: t(
        "Predictable patterns make you readable, and Greene argues that once others can anticipate your sequence, tone, or method, they can prepare cheaply and answer you before you move. Breaking predictable patterns restores uncertainty and makes your next action harder to price in advance.",
        "This strategy is not random chaos. It is deliberate variation that keeps habits from hardening into exploitable routines.",
        "Greene's lesson is that repetition creates comfort for the other side. Once your rhythm becomes expected, your strength begins losing surprise, initiative, and emotional edge."
      ),
      p2: t(
        "This matters because people naturally settle into patterns that feel efficient or familiar. Those patterns often work for a while, which is exactly why they become dangerous later. Success can make a method too visible.",
        "The deeper lesson is that unpredictability preserves leverage by forcing others to hold more possibilities in mind. That mental burden can slow them down, increase mistakes, and weaken their confidence in their own reading.",
        "In practical life, breaking pattern can mean changing sequence, tone, timing, medium, or response style. Greene wants variation used to reopen the field, not to indulge restlessness."
      ),
    },
    standardBullets: [
      bullet(
        "Routine makes you easier to read. Greene wants you to notice when your habits have become part of the other side's preparation.",
        "Predictability lowers the cost of defending against you."
      ),
      bullet(
        "Break pattern without losing purpose. Variation should disrupt expectation while still serving the objective.",
        "Unpredictability is not randomness."
      ),
      bullet(
        "Change the sequence if the sequence is now expected. A new order can reopen options the old pattern had closed.",
        "Timing and order shape anticipation."
      ),
      bullet(
        "Alter the medium or tone when needed. People often prepare for style as much as for content.",
        "Small variations can create large interpretive shifts."
      ),
      bullet(
        "Do not overrepeat success. What worked last time becomes easier to answer each time you reuse it.",
        "Past wins can turn into future tells."
      ),
      bullet(
        "Make the other side carry more possibilities. Uncertainty forces them to spread attention and defend more broadly.",
        "That wider burden can weaken response quality."
      ),
      bullet(
        "Use pattern breaks at meaningful moments. Variation gains more force when it interrupts a settled expectation.",
        "Disruption needs a target."
      ),
      bullet(
        "Protect your own reading too. If you become addicted to someone else's pattern, you may miss the moment they finally change it.",
        "Expectation can blind both sides."
      ),
      bullet(
        "Keep some core signals stable. Total unpredictability can confuse allies and weaken trust if nothing remains readable.",
        "Variation works best around a stable purpose."
      ),
      bullet(
        "The closing lesson is that readable patterns leak leverage. Break them carefully and you recover surprise, initiative, and room to move.",
        "Variation is a strategic reset."
      ),
    ],
    deeperBullets: [
      bullet(
        "Greene is attacking mechanical efficiency here. The easiest routine can become the most expensive one once it has taught others how to answer it.",
        "Convenience is not always strategic."
      ),
      bullet(
        "This strategy also affects morale. Opponents who cannot comfortably predict you often feel less secure and more reactive.",
        "Uncertainty changes emotional posture."
      ),
      bullet(
        "Pattern breaks are strongest when they arrive after others have invested heavily in your old sequence. Their preparation then becomes part of their vulnerability.",
        "Expectation can be turned against its owner."
      ),
      bullet(
        "There is a limit here. If you vary too much without a stable underlying purpose, your own side starts spending energy decoding you.",
        "Unpredictability must not erode trust."
      ),
      bullet(
        "The broader lesson is that repetition teaches your opponent. Greene wants readers to stop giving away free instruction through overly stable habits.",
        "Break the lesson before it matures into defense."
      ),
    ],
    takeaways: [
      "Routine teaches opponents",
      "Break sequence without losing purpose",
      "Do not overrepeat success",
      "Variation should raise uncertainty for others",
      "Keep core purpose stable",
      "Pattern breaks restore initiative",
    ],
    practice: [
      "Identify one habit the other side can now expect from you",
      "Change the sequence or medium of the next move",
      "Keep the objective steady while varying the route",
      "Watch for where you have become too comfortable with old success",
    ],
    examples: [
      example(
        "ch22-ex01",
        "Manager always delivering pressure the same way",
        ["work"],
        "A manager always handles performance issues in the same format and tone. The team now prepares for that pattern and has learned how to survive it without really changing.",
        [
          "Break the expected sequence or medium so the old defensive routine no longer fits automatically.",
          "Use the variation to reopen attention, not simply to look unpredictable."
        ],
        "Greene's lesson is that repeated patterns teach others how to absorb you at low cost."
      ),
      example(
        "ch22-ex02",
        "Negotiation style now fully legible",
        ["work"],
        "A negotiator relies on one successful tactic so often that counterparts now see it coming. The move still feels strong because it once worked well, but it is now losing surprise and bite.",
        [
          "Retain the objective but change the route before the old success becomes a permanent tell.",
          "Use deliberate variation to make the other side spread its attention again."
        ],
        "This strategy matters because predictable competence can become convenient weakness."
      ),
      example(
        "ch22-ex03",
        "Student leader repeating the same appeal",
        ["school"],
        "A student leader keeps making the same kind of argument in every dispute. Opponents now anticipate the sequence and prepare replies before the conversation even starts.",
        [
          "Change the entry point, the format, or the order so the old preparation no longer maps neatly onto the new move.",
          "Break the routine without losing the larger objective."
        ],
        "Greene would say that repetition trains the audience as much as it trains the speaker."
      ),
      example(
        "ch22-ex04",
        "Class project stuck in one workflow",
        ["school"],
        "A project team keeps using the same workflow because it once felt efficient, but the problems have changed and the old sequence now keeps creating the same bottleneck.",
        [
          "Break the routine that made sense earlier but now teaches the same failure over and over.",
          "Use variation to reopen learning rather than staying loyal to a familiar process."
        ],
        "The strategy applies because predictable patterns can become invisible sources of weakness inside teams as well."
      ),
      example(
        "ch22-ex05",
        "Family expects your standard reaction",
        ["personal"],
        "Your family now expects one particular response from you in conflict and starts building around it before you even speak. The pattern gives them confidence and you frustration.",
        [
          "Change the response pattern in a way that stays true to your purpose but breaks their easy preparation.",
          "Use the surprise to recover initiative rather than to create chaos."
        ],
        "Greene's point is that predictable reactions become social terrain that others quietly exploit."
      ),
      example(
        "ch22-ex06",
        "Friend group can script your disagreement",
        ["personal"],
        "A friend group knows exactly how you will disagree and in what order. They may not even be doing it maliciously, but your own pattern is making every conflict easier for them to manage.",
        [
          "Interrupt the familiar sequence with a different tone, timing, or route that still serves the same objective.",
          "Make the group carry more uncertainty than it is used to carrying."
        ],
        "This strategy matters because a broken pattern can reopen possibility even when the content of the disagreement stays similar."
      ),
    ],
    directQuestions: [
      question(
        "ch22-q01",
        "Why does Greene want predictable patterns broken?",
        [
          "Because routine is morally weak",
          "Because repetition teaches others how to prepare for you cheaply",
          "Because unpredictability should be constant",
          "Because success should never be repeated"
        ],
        1,
        "He wants leverage restored by disrupting habits that opponents now understand too well."
      ),
      question(
        "ch22-q02",
        "What keeps a pattern break strategic rather than random?",
        [
          "Keeping the underlying objective stable",
          "Changing everything at once",
          "Ignoring allies' expectations completely",
          "Using the loudest move possible"
        ],
        0,
        "Variation should serve the mission rather than replacing it."
      ),
      question(
        "ch22-q03",
        "Why can success become dangerous in this strategy?",
        [
          "Because winning always weakens morale",
          "Because repeated success can turn a method into an obvious tell",
          "Because good methods should be hidden forever",
          "Because opponents never learn"
        ],
        1,
        "A tactic that worked well can become easier to answer each time it is repeated unchanged."
      ),
      question(
        "ch22-q04",
        "What deeper principle closes this strategy?",
        [
          "Variation preserves uncertainty and therefore leverage",
          "Total chaos is better than stable purpose",
          "Predictability matters only in war",
          "Pattern breaks should confuse your own side too"
        ],
        0,
        "Greene wants the other side carrying more uncertainty, not your own team."
      ),
    ],
  }),
  chapter({
    chapterId: "ch23-turn-setbacks-into-cover",
    number: 23,
    title: "Turn Setbacks Into Cover",
    readingTimeMinutes: 13,
    summary: {
      p1: t(
        "A setback does not have to remain only a setback, and Greene argues that losses, delays, and apparent retreats can be used as cover for regrouping, repositioning, or misleading the other side about your next move. What looks like weakness on the surface can hide preparation if it is handled deliberately.",
        "This strategy is not denial. The loss is real. The question is whether it will be left as open damage or converted into a shield behind which the campaign becomes harder to read.",
        "Greene's lesson is that apparent disadvantage can lower the opponent's guard, soften expectations, and create freedom to rebuild in ways that open strength often cannot."
      ),
      p2: t(
        "This matters because setbacks usually pull everyone toward panic, shame, or rushed repair. Those reactions make the damage more legible and keep the campaign emotionally trapped at the point of loss.",
        "The deeper lesson is that concealment can sometimes grow out of failure itself. When others think they have already measured your weakness, they may stop looking for the changes happening behind it.",
        "In practical life, turning setbacks into cover often means controlling the interpretation of the loss, using the quieter period to reset, and refusing to let one bad moment define the rest of the campaign."
      ),
    },
    standardBullets: [
      bullet(
        "Do not let a setback remain pure exposure. Greene wants losses converted into room for repositioning where possible.",
        "Damage can become cover if handled well."
      ),
      bullet(
        "Avoid panic repair. Rushed recovery often reveals more weakness than the original loss did.",
        "Shame makes people overexpose themselves."
      ),
      bullet(
        "Use lowered expectations to your advantage. When others think they understand your weakness, they may watch less closely.",
        "Underestimation can create space."
      ),
      bullet(
        "Regroup behind the visible damage. The setback can hide preparation if you stop performing distress and start rebuilding quietly.",
        "Recovery does not need to be loud."
      ),
      bullet(
        "Control the meaning of the loss. Story matters because interpretation can either freeze the campaign or keep it flexible.",
        "Narrative shapes aftermath."
      ),
      bullet(
        "Use the setback to discard what was not working anyway. Loss sometimes grants permission for a harder reset.",
        "Weak structures can be left behind."
      ),
      bullet(
        "Do not fake weakness badly. Apparent loss helps only if it fits reality closely enough to be believable.",
        "Cover fails when it looks theatrical."
      ),
      bullet(
        "Keep the next line hidden until it is ready. A setback can buy privacy if you do not rush to prove recovery too soon.",
        "Silence can protect rebuilding."
      ),
      bullet(
        "Learn visibly later, not noisily now. The first task is regaining position, not delivering an elegant explanation of the failure.",
        "Sequence matters after loss."
      ),
      bullet(
        "The closing lesson is that setbacks can conceal renewal. Greene wants the campaign rebuilt under the cover of lowered expectation rather than broken by one public moment.",
        "Loss can become camouflage."
      ),
    ],
    deeperBullets: [
      bullet(
        "Greene is interested in what loss does to attention. People often stop expecting much from the side that just stumbled, and that change in scrutiny can create room.",
        "Disappointment can lower surveillance."
      ),
      bullet(
        "This strategy also protects dignity. A setback handled quietly can preserve more future strength than a frantic display of instant redemption.",
        "Composure after loss matters."
      ),
      bullet(
        "Cover is useful because rebuilding often needs privacy. Strong recovery work may require time that public pressure would otherwise corrupt.",
        "Setbacks can create that hidden interval."
      ),
      bullet(
        "There is a limit here. Not every loss can be romanticized into opportunity. Greene still expects honest diagnosis and real repair, not spin divorced from capacity.",
        "Cover must hide actual rebuilding."
      ),
      bullet(
        "The broader lesson is that apparent weakness changes the field. If you use that altered attention well, a setback can become a mask under which the next phase grows stronger.",
        "Loss can be transformed into concealment."
      ),
    ],
    takeaways: [
      "Do not panic after a setback",
      "Lowered expectations can create room",
      "Regroup behind the visible loss",
      "Control the meaning of the setback",
      "Keep rebuilding quiet until ready",
      "Loss can become camouflage",
    ],
    practice: [
      "Name what the setback now hides as well as what it exposed",
      "Stop the urge to prove instant recovery",
      "Use the quiet period to reset weak structures",
      "Prepare the next line before announcing it",
    ],
    examples: [
      example(
        "ch23-ex01",
        "Missed deadline creates unexpected privacy",
        ["work"],
        "A team misses an expected deadline and now fears its credibility is gone. At the same time, outside attention has shifted slightly away because people assume little can happen quickly from this point.",
        [
          "Use the lowered expectations to rebuild the plan, correct the weak architecture, and prepare a stronger next phase quietly.",
          "Do not waste the cover by rushing into visible overcompensation."
        ],
        "Greene's lesson is that a setback can create temporary concealment if you stop treating it only as shame and start using the altered field."
      ),
      example(
        "ch23-ex02",
        "Job rejection clears the wrong path",
        ["work"],
        "Someone gets rejected from an opportunity that had been absorbing all attention. The loss is real, but it also creates a window to change direction without being watched through the old expectations.",
        [
          "Use the quieter moment after the setback to reset your campaign around a stronger route rather than immediately trying to erase the embarrassment.",
          "Let the loss hide the transition until the next move is actually ready."
        ],
        "This strategy matters because disappointment can reduce scrutiny and create a cleaner space for redesign."
      ),
      example(
        "ch23-ex03",
        "Student campaign setback before the final push",
        ["school"],
        "A student campaign has a public stumble and opponents now assume it is fading. The team feels humiliated, but the new underestimation is also changing the field.",
        [
          "Stop performing panic and use the temporary drop in attention to reorganize the next push.",
          "Turn the visible stumble into cover for sharper preparation rather than feeding the story of collapse."
        ],
        "Greene would say that lowered expectations can be useful if they are not wasted on frantic self defense."
      ),
      example(
        "ch23-ex04",
        "Project team after a bad first review",
        ["school"],
        "A project team receives harsh first feedback and wants to defend itself immediately. The reaction would feel natural, but it may also freeze the group around the exact moment of failure.",
        [
          "Use the setback to strip out weak assumptions and rebuild quietly before staging your recovery publicly.",
          "Treat the low point as cover for rework, not as a stage for emotional explanation."
        ],
        "The strategy applies because a bad first impression can create the private space needed for a stronger second line."
      ),
      example(
        "ch23-ex05",
        "Personal embarrassment after a visible mistake",
        ["personal"],
        "Someone makes a visible social mistake and feels the need to repair their image immediately. The urge to explain everything is strong, but it would also keep the whole group focused on the failure.",
        [
          "Do not overexpose yourself in the rush to redeem the moment. Let the attention cool while you regain footing.",
          "Use the quieter interval after the embarrassment to reset your position rather than to keep reliving it publicly."
        ],
        "Greene's point is that setbacks become more damaging when shame keeps them in the center of the stage."
      ),
      example(
        "ch23-ex06",
        "Friend group conflict after a bad scene",
        ["personal"],
        "A tense group moment goes badly, and one person wants to repair everything immediately in a public way. The group, however, is temporarily underestimating that person's next move and not watching closely.",
        [
          "Use the lull to think, rebuild alliances, and prepare a cleaner next step instead of chasing instant image repair.",
          "Let the apparent setback create room rather than forcing yourself back into the spotlight too early."
        ],
        "This strategy matters because loss can create cover, but only if you resist the urge to burn that cover on immediate emotional recovery."
      ),
    ],
    directQuestions: [
      question(
        "ch23-q01",
        "What does Greene mean by turning setbacks into cover?",
        [
          "Pretending the loss never happened",
          "Using the altered attention after a setback to regroup and rebuild more quietly",
          "Attacking harder immediately after every failure",
          "Hiding from all accountability"
        ],
        1,
        "He wants the loss used as concealment for repositioning, not denied or theatrically avenged."
      ),
      question(
        "ch23-q02",
        "Why is panic repair dangerous after a loss?",
        [
          "Because it can expose more weakness and keep the campaign trapped at the point of failure",
          "Because setbacks never need action",
          "Because audiences always prefer silence",
          "Because recovery is usually impossible"
        ],
        0,
        "Rushed recovery often serves shame rather than strategy."
      ),
      question(
        "ch23-q03",
        "What can lowered expectations create in this strategy?",
        [
          "A guarantee of later success",
          "Useful room for regrouping because others may watch less closely",
          "Permanent sympathy from everyone",
          "Freedom from the need to learn"
        ],
        1,
        "Underestimation can become a resource if it is used for real rebuilding."
      ),
      question(
        "ch23-q04",
        "What deeper principle closes this strategy?",
        [
          "Loss can change the field in ways that hide renewal",
          "Every failure is secretly an advantage",
          "Story does not matter after setbacks",
          "Fast image repair should always come first"
        ],
        0,
        "Greene wants the reader to use the altered attention around loss rather than letting shame waste it."
      ),
    ],
  }),
  chapter({
    chapterId: "ch24-close-escape-routes-carefully",
    number: 24,
    title: "Close Escape Routes Carefully",
    readingTimeMinutes: 14,
    summary: {
      p1: t(
        "Pressure becomes more intense when retreat feels impossible, and Greene argues that limiting escape can force commitment, courage, and concentration from people who would otherwise stay half invested. But he adds an important warning through the word carefully. Cornered people also become desperate, volatile, and dangerous.",
        "This strategy is about using necessity with judgment. When the route backward narrows, effort often sharpens because ambiguity is gone and the cost of hesitation rises.",
        "Greene's lesson is that no retreat can produce full commitment, but only if the people pushed into that condition still have enough structure, trust, and purpose to direct the desperation productively."
      ),
      p2: t(
        "This matters because many campaigns fail from divided commitment. People keep one foot in and one foot out, which makes effort cautious, defensive, and easy to break. Closing escape routes can end that softness.",
        "The deeper lesson is that desperation is not automatically useful. It has to be contained by leadership, morale, and a viable line of action or it turns into panic and self destruction.",
        "In everyday life, this strategy means creating real stakes and real consequence where drift is too easy, while being careful not to trap people in ways that produce blind resistance or collapse instead of disciplined effort."
      ),
    },
    standardBullets: [
      bullet(
        "Necessity sharpens effort. Greene wants commitment made real enough that half measures become harder to sustain.",
        "High stakes can focus attention and courage."
      ),
      bullet(
        "Too many exits weaken resolve. When retreat is always easy, effort often stays partial and cautious.",
        "Ambiguity can feed softness."
      ),
      bullet(
        "Close escape routes carefully. Cornered people can fight harder, but they can also become chaotic and reckless.",
        "Desperation needs containment."
      ),
      bullet(
        "Use no retreat conditions only with enough preparation. Commitment rises best when people still have structure, support, and a viable path forward.",
        "Necessity works poorly without design."
      ),
      bullet(
        "Make the stakes visible. People commit more fully when the cost of drift is concrete rather than abstract.",
        "Clarity strengthens resolve."
      ),
      bullet(
        "Do not corner others casually. Trapped opponents may become far more dangerous than contained opponents.",
        "Desperation changes behavior sharply."
      ),
      bullet(
        "Use pressure to simplify priorities. When retreat narrows, the campaign should become clearer, not noisier.",
        "Necessity should concentrate effort."
      ),
      bullet(
        "Match the level of closure to the group's readiness. Too much pressure too early can break morale instead of hardening it.",
        "Readiness matters."
      ),
      bullet(
        "Keep leadership strong inside high stakes moments. The more escape is reduced, the more the group needs direction.",
        "No retreat conditions magnify command quality."
      ),
      bullet(
        "The closing lesson is that closing exits can produce full commitment, but only when desperation is guided rather than simply unleashed.",
        "Necessity is a strong tool and a dangerous one."
      ),
    ],
    deeperBullets: [
      bullet(
        "Greene is interested in the psychology of irreversible choice. Once people know there is no comfortable fallback, effort can stop negotiating with itself.",
        "Commitment becomes more singular."
      ),
      bullet(
        "This strategy works because drift often survives through ambiguity. Clear stakes remove the soft middle where delay and excuse usually live.",
        "Necessity can cut through indecision."
      ),
      bullet(
        "The danger is unmanaged panic. If the path forward is not credible enough, closing exits may create despair rather than courage.",
        "Pressure must still leave a line of action."
      ),
      bullet(
        "Cornered opponents need careful handling because desperation can erase their earlier caution. People with nothing left to preserve often become less predictable and more aggressive.",
        "Closing routes changes the whole emotional field."
      ),
      bullet(
        "The broader lesson is that commitment rises when consequence becomes real. Greene wants necessity used to end drift, not to glorify reckless entrapment.",
        "High stakes need strong structure around them."
      ),
    ],
    takeaways: [
      "Real stakes sharpen commitment",
      "Too many exits can weaken effort",
      "Cornering can produce both courage and panic",
      "Desperation needs structure",
      "Match pressure to readiness",
      "Necessity should end drift not create chaos",
    ],
    practice: [
      "Name one area where easy retreat is weakening commitment",
      "Make the cost of drift more visible",
      "Check whether the group has enough structure for higher stakes",
      "Use necessity only with a credible path forward",
    ],
    examples: [
      example(
        "ch24-ex01",
        "Team keeps keeping one foot out",
        ["work"],
        "A team is working on an important transition, but everyone is treating it as provisional and reversible. The lack of real stake is weakening ownership and slowing every decision.",
        [
          "Create a more binding commitment point so the team has to organize around the new direction rather than hovering between options.",
          "Raise the stakes carefully and only with enough support that the commitment can become productive instead of chaotic."
        ],
        "Greene's lesson is that too many exits often produce half effort. Real consequence can harden focus when it is introduced wisely."
      ),
      example(
        "ch24-ex02",
        "Manager corners a teammate too hard",
        ["work"],
        "A manager wants a teammate to commit more strongly and removes every fallback too quickly. The teammate does not become more focused. They become frightened, defensive, and harder to work with.",
        [
          "Use pressure only with enough support and clarity that the person has a workable line forward.",
          "Do not mistake trapped panic for committed energy."
        ],
        "This strategy matters because necessity is powerful only when it still leaves room for disciplined action."
      ),
      example(
        "ch24-ex03",
        "Student group drifting through a major deadline",
        ["school"],
        "A student group keeps acting as if a major deadline is flexible even though the drift is already threatening the result. Nobody is fully committing because the stakes still feel abstract.",
        [
          "Make the consequence concrete and create a real point after which the old drift is no longer available.",
          "Use the sharper stake to focus ownership and effort rather than to create blame theater."
        ],
        "Greene would say commitment rises when retreat stops feeling casually available."
      ),
      example(
        "ch24-ex04",
        "Club leader traps members without support",
        ["school"],
        "A club leader tries to create commitment by imposing hard stakes suddenly, but members were never prepared for that level of pressure and now morale is breaking.",
        [
          "Build structure, clarity, and trust before closing options more tightly.",
          "Remember that no retreat conditions magnify leadership quality, for better or worse."
        ],
        "The strategy applies because desperation without preparation becomes disorder, not disciplined commitment."
      ),
      example(
        "ch24-ex05",
        "Personal change stays optional forever",
        ["personal"],
        "Someone keeps saying they want a major personal change, but the path backward remains so easy and so comfortable that no full commitment ever forms.",
        [
          "Create a real stake or commitment point that makes drifting expensive enough to finally concentrate effort.",
          "Make sure the new stakes still leave a workable path ahead rather than only fear."
        ],
        "Greene's point is that half commitment often survives by keeping retreat too available."
      ),
      example(
        "ch24-ex06",
        "Friend group corners one person badly",
        ["personal"],
        "A group decides to confront one friend all at once and gives the person no room to respond with dignity. The friend becomes far more defensive and volatile than anyone expected.",
        [
          "Do not close escape routes so harshly that desperation becomes the main emotional driver in the room.",
          "Preserve enough path for accountability and movement rather than forcing a panic reaction."
        ],
        "This strategy matters because cornered people can become more dangerous, not more reasonable."
      ),
    ],
    directQuestions: [
      question(
        "ch24-q01",
        "Why can closing escape routes increase commitment?",
        [
          "Because it removes the need for planning",
          "Because reduced retreat can force effort to become more singular and serious",
          "Because people love being trapped",
          "Because desperation always improves judgment"
        ],
        1,
        "Greene sees necessity as a way of ending the softness created by too many exits."
      ),
      question(
        "ch24-q02",
        "What is the main warning built into this strategy?",
        [
          "High stakes never matter",
          "Cornered people may become chaotic and dangerous if desperation is not contained",
          "Retreat should always be easy",
          "Leadership matters less under pressure"
        ],
        1,
        "Necessity can sharpen effort or produce panic depending on how it is structured."
      ),
      question(
        "ch24-q03",
        "What makes no retreat conditions more likely to work well?",
        [
          "A credible path forward supported by preparation and command",
          "Total uncertainty about the objective",
          "Public humiliation",
          "Removing every source of support"
        ],
        0,
        "The pressure needs structure around it or it becomes blind desperation."
      ),
      question(
        "ch24-q04",
        "What deeper principle closes this strategy?",
        [
          "Necessity should end drift while still leaving disciplined action possible",
          "Cornering is always better than persuasion",
          "Panic is the same thing as commitment",
          "Higher stakes solve weak leadership"
        ],
        0,
        "Greene wants consequence used with judgment, not recklessly admired."
      ),
    ],
  }),
  chapter({
    chapterId: "ch25-manage-alliances-well",
    number: 25,
    title: "Manage Alliances Well",
    readingTimeMinutes: 14,
    summary: {
      p1: t(
        "Alliances expand reach, but Greene argues that they are never self running and never purely sentimental. Coalitions are made of overlapping interests, unequal needs, and shifting loyalty, so managing them requires constant reading, maintenance, and boundary control.",
        "This strategy treats alliances as living structures rather than as declarations. A partner can increase your force, open a new route, or share risk, but the same partner can also dilute your objective or quietly gain leverage over you.",
        "Greene's lesson is that alliances work best when the common interest is real, the expectations are clear, and the dependence does not become blind."
      ),
      p2: t(
        "This matters because people often confuse alignment on one issue with durable unity. Temporary overlap gets mistaken for deep loyalty, and then surprise arrives when interests diverge later.",
        "The deeper lesson is that alliances should be priced politically. You need to know what the other side wants, what they will demand later, and what your position looks like if the arrangement weakens.",
        "In daily life, managing alliances means maintaining trust while staying realistic. Greene wants cooperation without innocence, and reciprocity without forgetting that interests can change."
      ),
    },
    standardBullets: [
      bullet(
        "Treat alliances as structures of interest, not as declarations of friendship.",
        "Shared language means less than aligned incentives."
      ),
      bullet(
        "Know what each ally really wants. Greene wants the hidden price of cooperation understood early.",
        "Future demands often begin in present motives."
      ),
      bullet(
        "Define expectations clearly. Confusion about roles and returns weakens coalitions fast.",
        "Clarity protects trust."
      ),
      bullet(
        "Do not become blindly dependent. An ally that becomes your only source of strength can quietly become your limiter.",
        "Support and vulnerability can grow together."
      ),
      bullet(
        "Maintain the relationship actively. Alliances weaken when contact, reciprocity, and communication are left to chance.",
        "Upkeep is part of strategy."
      ),
      bullet(
        "Watch for shifting interests. Today's overlap may not survive tomorrow's incentives.",
        "Alliances move with the field."
      ),
      bullet(
        "Protect your own objective inside the partnership. Cooperation should enlarge your campaign, not dissolve it.",
        "Common work still needs boundaries."
      ),
      bullet(
        "Do not romanticize loyalty. Even useful partners may act from self interest first.",
        "Realism keeps alliances usable."
      ),
      bullet(
        "Use reciprocity to deepen reliability. People invest more seriously when the relationship feels balanced and valuable.",
        "Fair exchange stabilizes coalitions."
      ),
      bullet(
        "The closing lesson is that alliances are strategic instruments that require maintenance, clarity, and realism. Managed well, they multiply force. Managed badly, they multiply vulnerability.",
        "Cooperation needs discipline."
      ),
    ],
    deeperBullets: [
      bullet(
        "Greene is interested in alliance drift. Partnerships often fail gradually as interests shift while the old language of unity stays in place.",
        "Outdated assumptions make coalitions brittle."
      ),
      bullet(
        "This strategy also concerns autonomy. A strong alliance helps you without making you unable to move if the relationship cools.",
        "Healthy cooperation still leaves room to stand."
      ),
      bullet(
        "Maintenance matters because trust decays in silence. Small neglects, unclear returns, and unspoken resentment can weaken the bond long before open conflict appears.",
        "Alliances need active care."
      ),
      bullet(
        "Not every ally should be treated the same way. Some relationships deserve deep investment. Others are temporary alignments that should be used cautiously and kept bounded.",
        "Different coalitions need different depth."
      ),
      bullet(
        "The broader lesson is that alliances multiply power only when interest, trust, and independence are kept in balance. Greene wants cooperation without strategic naivete.",
        "Good coalitions widen force without swallowing judgment."
      ),
    ],
    takeaways: [
      "Alliances run on interest as well as trust",
      "Know the real price of support",
      "Maintain the relationship actively",
      "Do not become blindly dependent",
      "Watch for shifting incentives",
      "Good alliances multiply force without erasing autonomy",
    ],
    practice: [
      "Name what each ally truly wants from the arrangement",
      "Clarify one expectation that is still too vague",
      "Check where the partnership is creating unhealthy dependence",
      "Maintain reciprocity before resentment starts speaking for you",
    ],
    examples: [
      example(
        "ch25-ex01",
        "Partnership built on one shared enemy",
        ["work"],
        "Two teams have aligned because they both dislike the same obstacle, but almost nothing has been clarified about what each side expects once that obstacle is gone. The alliance feels stronger than it really is.",
        [
          "Define the common interest and the likely points of divergence before the current overlap starts getting mistaken for permanent unity.",
          "Treat the partnership as real but conditional, not as a bond that can run itself."
        ],
        "Greene's lesson is that temporary alignment can be useful without being durable. Clarity keeps the future surprise smaller."
      ),
      example(
        "ch25-ex02",
        "Manager leaning too heavily on one ally",
        ["work"],
        "A manager keeps relying on one influential ally inside the organization until that ally quietly becomes the gate through which almost every important move must pass. Support is turning into dependency.",
        [
          "Preserve the alliance while rebuilding independent lines of strength so the relationship does not become your only route.",
          "Use support to widen your campaign, not to narrow it around one gatekeeper."
        ],
        "This strategy matters because allies can become hidden bottlenecks if dependence is left unchecked."
      ),
      example(
        "ch25-ex03",
        "Student coalition with unclear expectations",
        ["school"],
        "Several student groups join forces around a campus issue, but nobody has clearly discussed workload, credit, or what happens after the immediate issue changes shape. Warmth is covering strategic vagueness.",
        [
          "Clarify expectations while goodwill is still high instead of waiting for frustration to do the clarifying for you.",
          "Build the alliance on visible reciprocity and real interest, not on mood alone."
        ],
        "Greene would say that unmanaged coalitions often fail from unpriced assumptions rather than from open betrayal."
      ),
      example(
        "ch25-ex04",
        "Club alliance drifting as incentives change",
        ["school"],
        "Two campus clubs worked well together for one event, and everyone assumes that future cooperation is now automatic. But the incentives for the next event are already shifting in different directions.",
        [
          "Reevaluate the alliance under the new conditions instead of letting old success stand in for current alignment.",
          "Treat cooperation as a living structure that needs new terms when the field changes."
        ],
        "The strategy applies because yesterday's overlap can become today's illusion if the interests are no longer the same."
      ),
      example(
        "ch25-ex05",
        "Family members aligned only while pressure lasts",
        ["personal"],
        "Two relatives are cooperating closely because a short term problem affects both of them. The arrangement feels solid, but their deeper interests diverge more than either wants to admit yet.",
        [
          "Appreciate the alliance while staying realistic about where it may later loosen.",
          "Set expectations early so support today does not become resentment tomorrow."
        ],
        "Greene's point is that alliances should be valued without being romanticized."
      ),
      example(
        "ch25-ex06",
        "Friendship and project alliance getting blurred",
        ["personal"],
        "A friendship is carrying a joint project, and the emotional bond is making it hard to speak clearly about effort, credit, and obligation. The alliance is useful, but the lack of boundaries is growing risky.",
        [
          "Protect the friendship by clarifying the strategic terms of the joint effort instead of assuming goodwill can carry all ambiguity.",
          "Use realism to preserve trust rather than waiting for disappointment to reveal the hidden price."
        ],
        "This strategy matters because unmanaged overlap between feeling and shared work can weaken both the alliance and the friendship behind it."
      ),
    ],
    directQuestions: [
      question(
        "ch25-q01",
        "What does Greene want you to understand first about alliances?",
        [
          "They are mostly expressions of friendship",
          "They are structures of overlapping interest that require active management",
          "They should always be permanent",
          "They remove the need for independent strength"
        ],
        1,
        "He sees alliances as useful but conditional structures, not as self running declarations of unity."
      ),
      question(
        "ch25-q02",
        "Why is blind dependence on an ally dangerous?",
        [
          "Because alliances always fail",
          "Because support can quietly become a limiting dependency",
          "Because reciprocity weakens trust",
          "Because communication makes coalitions rigid"
        ],
        1,
        "An ally that becomes your only route can also become your bottleneck."
      ),
      question(
        "ch25-q03",
        "What most often weakens coalitions over time?",
        [
          "Clear expectations",
          "Active maintenance",
          "Shifting interests plus neglected communication",
          "Visible reciprocity"
        ],
        2,
        "Alliance drift usually appears when incentives change and the relationship is not being actively managed."
      ),
      question(
        "ch25-q04",
        "What deeper principle closes this strategy?",
        [
          "Strong alliances balance trust, interest, and independence",
          "Loyalty always matters more than incentives",
          "Realism ruins cooperation",
          "Partnership should replace autonomy"
        ],
        0,
        "Greene wants cooperation widened by discipline, not hollowed by innocence."
      ),
    ],
  }),
  chapter({
    chapterId: "ch26-defend-the-core",
    number: 26,
    title: "Defend the Core",
    readingTimeMinutes: 13,
    summary: {
      p1: t(
        "A campaign can survive peripheral loss more easily than damage to its core, and Greene argues that wise strategy begins by identifying what absolutely cannot be surrendered. The core may be a mission, a revenue line, a trusted relationship, a base of morale, a key capability, or the principle without which the rest of the structure becomes hollow.",
        "This strategy is about hierarchy under pressure. Not everything deserves equal protection, and the inability to rank what matters most often causes leaders to defend the edges while the center quietly weakens.",
        "Greene's lesson is that core defense creates strategic sanity. Once the vital center is named, tradeoffs become clearer and panic becomes harder to exploit."
      ),
      p2: t(
        "This matters because pressure invites dispersal. People try to hold everything at once, and in doing so they sometimes underprotect the few elements that actually decide whether recovery remains possible.",
        "The deeper lesson is that core defense is what preserves future options. If the center holds, you can rebuild the rest. If the center breaks, many apparent victories at the edge stop mattering.",
        "In practical life, defending the core often means protecting trust, runway, health, or the one capability that keeps the whole effort viable. Greene wants force assigned by importance, not by noise."
      ),
    },
    standardBullets: [
      bullet(
        "Name what is vital. Greene wants the core identified before pressure forces confused tradeoffs.",
        "You cannot defend what you have not ranked clearly."
      ),
      bullet(
        "Do not treat every loss as equal. Peripheral damage and central damage are not the same strategic event.",
        "Hierarchy improves defense."
      ),
      bullet(
        "Protect what keeps recovery possible. The core is often the thing that lets the rest be rebuilt later.",
        "Future options depend on it."
      ),
      bullet(
        "Let the core guide sacrifice. Once the center is clear, some outer concessions become easier to accept intelligently.",
        "Tradeoffs need a reference point."
      ),
      bullet(
        "Watch for attacks at the center disguised as small issues. Important assets are often harmed through quiet leaks, not dramatic blows.",
        "Core damage can begin subtly."
      ),
      bullet(
        "Defend morale and trust where they are central. Emotional infrastructure can be as strategic as money or process.",
        "Not all cores are material."
      ),
      bullet(
        "Do not overdefend the edges from pride. Leaders often spend too much saving symbolic territory.",
        "Vanity can misprice importance."
      ),
      bullet(
        "Recheck the core as conditions change. What is most vital can shift across phases of a campaign.",
        "Hierarchy is not frozen forever."
      ),
      bullet(
        "Make the core visible to your side. People coordinate better when they know what must not be lost.",
        "Shared understanding improves defense."
      ),
      bullet(
        "The closing lesson is that strong defense begins with ranking. Protect the center and the campaign stays alive enough to fight on.",
        "Core clarity preserves resilience."
      ),
    ],
    deeperBullets: [
      bullet(
        "Greene is warning against emotional mispricing. The loudest pressure point is often not the one that matters most to survival.",
        "Noise can distort hierarchy."
      ),
      bullet(
        "This strategy also strengthens offense. Once the core is protected, force spent elsewhere becomes cleaner because panic about total collapse recedes.",
        "Security at the center frees action at the edge."
      ),
      bullet(
        "Many cores are invisible until damaged. Trust, morale, credibility, and timing discipline often sit unnoticed until their weakening starts changing everything else.",
        "The hidden center still governs the whole."
      ),
      bullet(
        "There is a moral dimension here too. Knowing what is vital can keep leaders from sacrificing people or principles merely to save face in less important zones.",
        "Ranking protects against vanity defense."
      ),
      bullet(
        "The broader lesson is that survival and recovery depend on preserving the irreplaceable. Greene wants the campaign defended from the inside out, not from the noisiest edge inward.",
        "A held center keeps the future alive."
      ),
    ],
    takeaways: [
      "Name the vital center",
      "Not every loss is equal",
      "Protect what keeps recovery possible",
      "Do not overdefend symbolic edges",
      "Trust and morale can be core assets",
      "Core clarity preserves resilience",
    ],
    practice: [
      "Write the one thing the campaign cannot afford to lose",
      "List one noisy issue that matters less than it seems",
      "Protect the resource that keeps recovery possible",
      "Explain the core to the people helping defend it",
    ],
    examples: [
      example(
        "ch26-ex01",
        "Company protecting optics over cash",
        ["work"],
        "A company under pressure is spending huge energy defending image, side projects, and symbolic wins while the real core issue is shrinking cash runway. The edges are being defended while the center weakens.",
        [
          "Name the true core and redirect defense toward the resource that keeps the organization alive enough to recover.",
          "Let lesser symbols go if they are distracting from what actually preserves the future."
        ],
        "Greene's point is that campaigns often fail by guarding the visible edge and underdefending the vital center."
      ),
      example(
        "ch26-ex02",
        "Manager saving every feature except the trust line",
        ["work"],
        "A manager is trying to protect every feature request and stakeholder promise even as trust inside the team is thinning out. The most vital asset may be the part receiving the least protection.",
        [
          "Identify whether trust, not breadth, is now the real core and defend it accordingly.",
          "Accept outer loss if it keeps the center from breaking further."
        ],
        "This strategy matters because some cores are emotional infrastructure rather than visible deliverables."
      ),
      example(
        "ch26-ex03",
        "Student group preserving reputation but losing members",
        ["school"],
        "A student organization is trying to maintain every public commitment even though member burnout is becoming severe. The group may keep its image and lose the capacity that image depends on.",
        [
          "Treat membership health and mission continuity as the core if they now determine whether the group survives.",
          "Scale back less vital fronts so the center remains intact."
        ],
        "Greene would say the group has to rank what truly keeps recovery possible instead of protecting every edge equally."
      ),
      example(
        "ch26-ex04",
        "Project team defending credit over outcome",
        ["school"],
        "A project team is fighting hard over visibility and credit while the actual result is starting to slip. The campaign is protecting ego territory at the expense of the center.",
        [
          "Reorder the group's defense around the core outcome rather than the symbolic distribution around it.",
          "Let lower stakes status concerns wait until the center is secure."
        ],
        "The strategy applies because teams often misprice importance once pride enters the field."
      ),
      example(
        "ch26-ex05",
        "Family under stress protecting appearances",
        ["personal"],
        "A family under financial or emotional strain is still spending heavy effort defending appearances, traditions, and side expectations while the real core issue is household stability and trust.",
        [
          "Protect the elements that keep the family functional and able to recover, even if that means loosening less important fronts.",
          "Do not let public image outrank the true center."
        ],
        "Greene's lesson is that recovery remains possible when the core is held even if some outer forms are temporarily reduced."
      ),
      example(
        "ch26-ex06",
        "Friend group losing the connector",
        ["personal"],
        "A friend group is arguing about surface issues while the real core is that the one person keeping communication open is burning out. If that connection fails, the rest may not hold.",
        [
          "Defend the relationship or process that is actually holding the group together rather than spending force on secondary disputes.",
          "Treat the hidden center as strategically important before it breaks."
        ],
        "This strategy matters because the core of a group is often quieter and more fragile than the conflict happening around it."
      ),
    ],
    directQuestions: [
      question(
        "ch26-q01",
        "What is Greene mainly asking you to identify in this strategy?",
        [
          "The noisiest issue",
          "The core element the campaign cannot afford to lose",
          "The most public victory",
          "The strongest emotional grievance"
        ],
        1,
        "He wants defense organized around what is vital rather than around what is loud."
      ),
      question(
        "ch26-q02",
        "Why can defending every front equally be dangerous?",
        [
          "Because it usually leaves the center underprotected",
          "Because all losses are basically symbolic",
          "Because the edge never matters",
          "Because retreat is always better than defense"
        ],
        0,
        "Without ranking, leaders often waste effort on edges while the core weakens."
      ),
      question(
        "ch26-q03",
        "What kind of thing can count as the core in Greene's logic?",
        [
          "Only money or physical assets",
          "Any irreplaceable source of survival or recovery, including trust or morale",
          "Only public reputation",
          "Whatever is easiest to explain"
        ],
        1,
        "The vital center can be material, social, or psychological if it governs the campaign's survival."
      ),
      question(
        "ch26-q04",
        "What deeper principle closes this strategy?",
        [
          "The future survives when the irreplaceable center is protected",
          "Every visible loss should be prevented at all cost",
          "Defending symbols is the same as defending substance",
          "Hierarchy weakens judgment"
        ],
        0,
        "Greene wants leaders defending the inside of the campaign before the noisy edges."
      ),
    ],
  }),
  chapter({
    chapterId: "ch27-attack-assumptions",
    number: 27,
    title: "Attack Assumptions",
    readingTimeMinutes: 13,
    summary: {
      p1: t(
        "Plans often rest on assumptions that stop being examined once they feel normal, and Greene argues that some of the strongest strategic moves come from identifying and attacking the beliefs a system is quietly counting on. An assumption can concern timing, loyalty, capability, process, demand, or what the other side thinks you will never do.",
        "This strategy is about questioning what everyone has started treating as background truth. If the assumption is weak, the whole design built on it may be easier to disturb than the visible surface suggests.",
        "Greene's lesson is that hidden premises are often more vulnerable than stated positions because they are less defended. People protect the claim they know they are making. They protect the assumption less carefully."
      ),
      p2: t(
        "This matters because assumptions guide action silently. Once a belief becomes standard, it starts doing strategic work without drawing much attention to itself.",
        "The deeper lesson is that attacking assumptions can produce disproportionate effects. If you alter or expose the premise, many later moves lose coherence at once.",
        "In practical life, this strategy means asking what everyone is acting as though were definitely true, then testing whether that foundation is sturdy or simply familiar."
      ),
    },
    standardBullets: [
      bullet(
        "Look beneath the visible argument. Greene wants the underlying assumption found before the surface fight consumes all attention.",
        "Premises quietly govern behavior."
      ),
      bullet(
        "Question what everyone treats as obvious. Familiarity often protects weak assumptions from scrutiny.",
        "The normal can be strategically soft."
      ),
      bullet(
        "Attack the foundation, not just the conclusion. A shaken premise can weaken many later moves at once.",
        "Assumption pressure has wide reach."
      ),
      bullet(
        "Test your own assumptions too. The same blindness you exploit in others can exist in your side.",
        "Self critique sharpens offense."
      ),
      bullet(
        "Watch for hidden dependencies on one belief. Some plans only work because one premise remains unchallenged.",
        "Belief can be structural support."
      ),
      bullet(
        "Use evidence and reality checks to expose weak premises. Good attacks on assumptions feel grounded, not abstract.",
        "Concrete contradiction lands harder."
      ),
      bullet(
        "Do not attack every assumption at once. Choose the one whose collapse would matter most.",
        "Targeting still matters."
      ),
      bullet(
        "Read what the other side thinks you will never challenge. Untested confidence often reveals the best premise to attack.",
        "Complacency marks the opening."
      ),
      bullet(
        "Prepare for disorientation after the breach. When assumptions break, people often react emotionally before they reorient.",
        "Shock changes the field."
      ),
      bullet(
        "The closing lesson is that unexamined premises create exploitable stability. Attack the assumption and the visible structure may start weakening on its own.",
        "Premises hold more than they seem to hold."
      ),
    ],
    deeperBullets: [
      bullet(
        "Greene is teaching strategic skepticism here. What feels obvious may simply be what nobody has bothered to test under current conditions.",
        "Familiarity is not proof."
      ),
      bullet(
        "This strategy works because assumptions compress thought. Once a premise is accepted, many later decisions get made automatically.",
        "Break the premise and automatic movement slows."
      ),
      bullet(
        "Attacking assumptions can be cheaper than contesting every outcome built on them. Change the root belief and many branches move with less direct effort.",
        "Foundations offer economy."
      ),
      bullet(
        "There is a caution here as well. Endless suspicion without good evidence can paralyze your own campaign and make you fight ghosts.",
        "Greene wants testing, not empty contrarianism."
      ),
      bullet(
        "The broader lesson is that strategy improves when background truth is treated as a candidate for review. Hidden premises can be some of the softest and most decisive ground in the whole field.",
        "Attack what is doing silent work."
      ),
    ],
    takeaways: [
      "Question what feels obvious",
      "Attack premises not only conclusions",
      "Test your own assumptions too",
      "Choose the premise that matters most",
      "Use evidence to expose weak beliefs",
      "Hidden premises can be decisive terrain",
    ],
    practice: [
      "Write one assumption the whole situation seems to rest on",
      "Test what would happen if it proved false",
      "Look for the assumption your own side is protecting too casually",
      "Choose one grounded way to challenge the premise",
    ],
    examples: [
      example(
        "ch27-ex01",
        "Team assumes one customer need is fixed",
        ["work"],
        "A team keeps building around one customer assumption that no longer seems stable, but the whole plan has started treating that belief as unquestionable background truth.",
        [
          "Test the assumption directly instead of optimizing endlessly around it.",
          "If the premise is weak, change it before the rest of the campaign gets more expensive."
        ],
        "Greene's lesson is that one soft assumption can quietly control a large strategy if nobody challenges it."
      ),
      example(
        "ch27-ex02",
        "Manager assumes one person will always stay",
        ["work"],
        "A manager is planning as though one key employee will certainly remain available, even though the signals around that assumption are getting weaker. The whole workload design depends on it.",
        [
          "Treat the belief as an assumption that needs testing, not as a fact protected by habit.",
          "Attack the premise early enough that you can redesign the plan before the weakness becomes a crisis."
        ],
        "This strategy matters because a background assumption can do enormous strategic work while receiving almost no strategic attention."
      ),
      example(
        "ch27-ex03",
        "Student campaign assumes turnout pattern",
        ["school"],
        "A student campaign is behaving as though turnout will follow an old pattern because that is what usually happens. The new context suggests the assumption may be stale.",
        [
          "Challenge the familiar premise before the whole campaign spends itself on a pattern that may no longer hold.",
          "Use evidence to stress test the belief instead of calling it common sense."
        ],
        "Greene would say that familiar assumptions become dangerous exactly because they feel too obvious to review."
      ),
      example(
        "ch27-ex04",
        "Project team assumes silence means agreement",
        ["school"],
        "A project group keeps treating silence as buy in, and the whole plan now relies on the assumption that nobody is carrying serious reservations. That premise may be false and highly consequential.",
        [
          "Challenge the assumption directly before the team learns its weakness at the worst possible moment.",
          "Test the quiet premise, not only the visible schedule."
        ],
        "The strategy applies because hidden assumptions can carry more weight than the explicit parts of the plan."
      ),
      example(
        "ch27-ex05",
        "Family assumes one person will keep absorbing the strain",
        ["personal"],
        "A family keeps acting as though one person will always remain calm, available, and willing to absorb the extra burden. Nobody says it aloud, but many choices depend on it.",
        [
          "Surface the assumption before it fails under pressure and reorganize responsibilities around reality rather than habit.",
          "Treat the background belief as a live strategic issue."
        ],
        "Greene's point is that hidden premises often support whole systems until the day they suddenly cannot."
      ),
      example(
        "ch27-ex06",
        "Friend group assumes the old peacemaker role",
        ["personal"],
        "A friend group still acts as though one member will always smooth tension and reconnect everyone after conflict. The assumption is so normal that nobody notices how fragile it has become.",
        [
          "Question the familiar premise before the group discovers its weakness through collapse.",
          "Attack the assumption while there is still room to redesign the social pattern around it."
        ],
        "This strategy matters because the beliefs doing the most hidden work are often the ones nobody thinks to defend."
      ),
    ],
    directQuestions: [
      question(
        "ch27-q01",
        "What is Greene mainly asking you to attack in this strategy?",
        [
          "Only public statements",
          "The assumptions quietly supporting a plan or system",
          "The strongest personality in the room",
          "Every norm you can find"
        ],
        1,
        "He wants the hidden premise challenged because it may be doing more work than the visible claim."
      ),
      question(
        "ch27-q02",
        "Why can assumptions be especially vulnerable?",
        [
          "Because they are never useful",
          "Because people often defend them less carefully than the claims built on them",
          "Because they always fail in public",
          "Because they cannot shape behavior"
        ],
        1,
        "Hidden premises are often less protected because they have become normal."
      ),
      question(
        "ch27-q03",
        "What is one danger in this strategy if used badly?",
        [
          "Questioning your own assumptions",
          "Grounded testing of familiar beliefs",
          "Empty contrarian suspicion that creates paranoia without evidence",
          "Choosing one premise that matters most"
        ],
        2,
        "Greene wants disciplined testing, not theatrical doubt for its own sake."
      ),
      question(
        "ch27-q04",
        "What deeper principle closes this strategy?",
        [
          "Background assumptions can be some of the softest and most decisive terrain in a conflict",
          "Only visible claims matter strategically",
          "The obvious is usually true enough",
          "Premises matter less than timing"
        ],
        0,
        "The hidden belief often holds more structure than people realize."
      ),
    ],
  }),
  chapter({
    chapterId: "ch28-use-absence-as-pressure",
    number: 28,
    title: "Use Absence as Pressure",
    readingTimeMinutes: 13,
    summary: {
      p1: t(
        "Presence is not the only way to exert force, and Greene argues that absence can create uncertainty, longing, overextension, or renewed attention when used deliberately. Strategic absence is not passive disappearance. It is controlled withdrawal that changes how the other side feels the field.",
        "This strategy works because people often value, fear, or chase what is no longer easily available. A sudden void can expose dependence, sharpen attention, and make others reveal more than they would under constant contact.",
        "Greene's lesson is that removal can be as active as contact when it is timed well and tied to a purpose. Absence changes the shape of expectation."
      ),
      p2: t(
        "This matters because many people overuse presence. They argue too much, explain too much, answer too quickly, and keep the field so full that others never have to feel the weight of the missing element.",
        "The deeper lesson is that space can pressure people into motion. In the quiet created by absence, they may pursue, overinterpret, expose need, or finally notice what your presence had been carrying for them.",
        "In practical life, using absence can mean withholding immediate response, stepping back from overfunctioning, or removing a resource long enough for others to confront what its absence reveals. Greene wants withdrawal used with discipline, not with sulking or manipulation for its own sake."
      ),
    },
    standardBullets: [
      bullet(
        "Absence can exert force. Greene wants withdrawal treated as a strategic move when it changes the field usefully.",
        "Removing presence can alter attention and behavior."
      ),
      bullet(
        "Do not fill every silence. Constant availability can make your value and your boundaries less visible.",
        "Overpresence reduces pressure."
      ),
      bullet(
        "Use absence to reveal dependence. People often notice a role, a resource, or a stabilizing presence only when it is missing.",
        "The void clarifies value."
      ),
      bullet(
        "Time the withdrawal carefully. Absence works when it interrupts expectation, not when it looks like random disengagement.",
        "Purpose and timing still matter."
      ),
      bullet(
        "Let others move into the silence. In the gap, they may reveal motive, chase, or expose what they really need.",
        "Space can draw motion."
      ),
      bullet(
        "Do not confuse strategic absence with sulking. Withdrawal should serve the campaign, not punish the field through vague resentment.",
        "Purpose separates strategy from mood."
      ),
      bullet(
        "Use absence to stop overfunctioning. If your constant presence is carrying the whole system, stepping back can reveal the hidden dependency.",
        "The gap can teach structure."
      ),
      bullet(
        "Protect credibility while withdrawing. People should be able to read that the move has shape, not only confusion.",
        "Absence loses force when it looks aimless."
      ),
      bullet(
        "Return with intention. A good withdrawal changes the field so the next presence lands differently.",
        "Absence and return belong together."
      ),
      bullet(
        "The closing lesson is that space can create pressure. Greene wants the void used to reveal need, reset value, and make others move under new conditions.",
        "Withdrawal can be active leverage."
      ),
    ],
    deeperBullets: [
      bullet(
        "Greene is working with the psychology of habituation. What is constantly available often stops being consciously valued.",
        "Absence breaks the habit and refreshes perception."
      ),
      bullet(
        "This strategy also shifts initiative. In the space left by withdrawal, the other side may be forced to show more of its own desire, fear, or overreach.",
        "Silence can make the field speak."
      ),
      bullet(
        "Absence is strongest when the missing element was doing real structural work. Empty dramatic withdrawal rarely has the same effect.",
        "Value has to be real before its removal has force."
      ),
      bullet(
        "There is a limit here. Stay away too long or without shape, and absence becomes irrelevance rather than pressure.",
        "Withdrawal must stay connected to return or consequence."
      ),
      bullet(
        "The broader lesson is that presence is not the only way to steer behavior. Greene wants readers to use controlled space as a lever on attention, dependence, and motion.",
        "The void can be designed."
      ),
    ],
    takeaways: [
      "Withdrawal can be active pressure",
      "Constant presence can hide value",
      "Absence reveals dependence",
      "Do not confuse silence with sulking",
      "Use space to make others move",
      "Withdraw and return with purpose",
    ],
    practice: [
      "Ask what your constant presence is quietly carrying",
      "Choose one place where strategic space would reveal more than more argument",
      "Time the withdrawal to expectation not to mood",
      "Plan what the return is meant to accomplish",
    ],
    examples: [
      example(
        "ch28-ex01",
        "Manager always filling every gap",
        ["work"],
        "A manager keeps solving every coordination problem immediately, and the team has stopped feeling the cost of its own disorganization. Constant presence is hiding the dependency.",
        [
          "Step back in a controlled way so the team has to confront what your constant intervention was quietly carrying.",
          "Use the absence to reveal structure problems, not merely to punish people for having them."
        ],
        "Greene's lesson is that a well timed void can teach more than another round of overinvolved presence."
      ),
      example(
        "ch28-ex02",
        "Negotiator answering too fast",
        ["work"],
        "A negotiator responds immediately to every message and has trained the other side to expect endless access. The constant presence is lowering pressure rather than raising it.",
        [
          "Introduce deliberate intervals so the other side has to feel the uncertainty and cost of not having instant contact.",
          "Use absence to change expectation rather than to create petty confusion."
        ],
        "This strategy matters because easy access can weaken leverage when it removes the pressure of waiting or pursuing."
      ),
      example(
        "ch28-ex03",
        "Club leader doing all the social glue work",
        ["school"],
        "A club leader keeps repairing every tension, chasing every volunteer, and filling every silence. Members are depending on that presence so heavily that they never feel the structural weakness beneath it.",
        [
          "Step back enough for the dependency to become visible while still keeping the group from collapse.",
          "Use the gap to teach the group what your constant presence had been covering."
        ],
        "Greene would say absence can clarify value and reveal hidden dependence that argument alone could not expose."
      ),
      example(
        "ch28-ex04",
        "Student waiting before replying",
        ["school"],
        "A student is in a campus dispute and keeps replying instantly to every new comment. The constant presence is letting others control the rhythm and never feel uncertainty.",
        [
          "Withdraw from instant response long enough to reset the timing and make the other side reveal more of its own urgency.",
          "Use the silence as structure, not as vague punishment."
        ],
        "The strategy applies because the gap created by absence can change who is chasing and who is defining the pace."
      ),
      example(
        "ch28-ex05",
        "Family member always smoothing tension",
        ["personal"],
        "One person in a family keeps smoothing every rough moment immediately. Nobody sees how much emotional labor is being supplied because the labor is constant and invisible.",
        [
          "Withdraw some of the automatic repair so the family can feel the gap and recognize what has been taken for granted.",
          "Use absence to expose dependence, not to create cruelty."
        ],
        "Greene's point is that what is always there often stops being consciously valued until it is missing."
      ),
      example(
        "ch28-ex06",
        "Dating dynamic shaped by overavailability",
        ["personal"],
        "Someone keeps answering instantly, initiating constantly, and filling every silence in a dating dynamic. The overpresence is making it harder to read the other person's genuine level of interest.",
        [
          "Create space and let the other person move into it if they choose rather than carrying the whole connection alone.",
          "Use absence to reveal motive and level of investment more clearly."
        ],
        "This strategy matters because the void created by stepping back can show what your constant presence was masking."
      ),
    ],
    directQuestions: [
      question(
        "ch28-q01",
        "What does Greene mean by using absence as pressure?",
        [
          "Disappearing without purpose",
          "Creating a controlled void that changes attention, dependence, or motion",
          "Refusing all future contact",
          "Avoiding responsibility through silence"
        ],
        1,
        "He wants withdrawal used deliberately to alter the field."
      ),
      question(
        "ch28-q02",
        "Why can constant presence weaken leverage?",
        [
          "Because it makes your value and boundaries less visible",
          "Because it always creates trust",
          "Because communication is usually harmful",
          "Because absence is morally superior"
        ],
        0,
        "What is always available can stop being felt as costly or valuable."
      ),
      question(
        "ch28-q03",
        "What makes absence strategically stronger than mere sulking?",
        [
          "Long duration alone",
          "A clear purpose tied to what the gap is meant to reveal or change",
          "Total unpredictability",
          "Public drama"
        ],
        1,
        "Purpose distinguishes pressure from mood."
      ),
      question(
        "ch28-q04",
        "What deeper principle closes this strategy?",
        [
          "The void can be designed to reveal dependence and shift initiative",
          "Silence is always better than presence",
          "Withdrawal matters only in romance",
          "Absence removes the need for return"
        ],
        0,
        "Greene wants space used as active leverage, not as random disappearance."
      ),
    ],
  }),
  chapter({
    chapterId: "ch29-convert-rivals-when-possible",
    number: 29,
    title: "Convert Rivals When Possible",
    readingTimeMinutes: 13,
    summary: {
      p1: t(
        "Permanent enemies are expensive, and Greene argues that when conditions allow it, converting rivals into partners, neutral parties, or at least less dangerous actors can produce more durable advantage than endless direct opposition. The aim is not naive reconciliation. It is strategic reduction of hostility.",
        "This strategy asks what the rival truly wants, what dignity must be preserved, and whether a route exists by which opposition can be redirected rather than continually fought.",
        "Greene's lesson is that destruction is not the only way to win. Some rivals can become useful if their interests are partly realigned, their role is redefined, or their energy is redirected into a less hostile channel."
      ),
      p2: t(
        "This matters because constant rivalry consumes resources and keeps two sides locked into mutual escalation. Even when you are stronger, the repeated cost of maintaining that hostility may exceed the value of keeping it alive.",
        "The deeper lesson is that conversion changes the structure of the field. A rival turned neutral, cooperative, or divided inside can alter the whole balance more than another round of frontal attack.",
        "In practical life, this strategy means asking whether the person is truly irreconcilable or whether the current conflict is being sustained by status, fear, misalignment, or a role that could be changed with enough care."
      ),
    },
    standardBullets: [
      bullet(
        "Do not assume every rival must stay an enemy. Greene wants hostility reduced when the field supports it.",
        "Conversion can be cheaper than perpetual combat."
      ),
      bullet(
        "Read what the rival actually wants. Conversion begins with motive, not with vague appeals to harmony.",
        "Interests reveal possible routes."
      ),
      bullet(
        "Preserve enough dignity for movement. People resist conversion when it feels like public humiliation disguised as peace.",
        "Face matters in transitions."
      ),
      bullet(
        "Offer a role the rival can live inside. Redirection often works better than demanding a total personality change.",
        "Structure can soften conflict."
      ),
      bullet(
        "Use conversion when it alters the field materially. The goal is strategic gain, not moral theater about forgiveness.",
        "Outcome still matters."
      ),
      bullet(
        "Stay cautious during the shift. A rival in transition is not yet a stable ally.",
        "Trust should grow with evidence."
      ),
      bullet(
        "Reduce the rewards of ongoing hostility. Rivalry weakens when the old fight stops paying enough.",
        "Incentives shape peace too."
      ),
      bullet(
        "Know when conversion is not realistic. Some actors are too committed, too dangerous, or too advantaged by conflict to redirect safely.",
        "Not every enemy is convertible."
      ),
      bullet(
        "Use partial conversion if full conversion is impossible. Neutrality, delay, or reduced hostility can still be valuable gains.",
        "The outcome does not need to be total friendship."
      ),
      bullet(
        "The closing lesson is that changed relationships can be stronger than repeated collisions. Greene wants readers to reduce expensive enemies where the field truly allows it.",
        "Redirection can outperform destruction."
      ),
    ],
    deeperBullets: [
      bullet(
        "Greene is interested in political economy here. Even a manageable enemy imposes costs every round that could sometimes be reduced through conversion.",
        "Lower hostility can widen capacity elsewhere."
      ),
      bullet(
        "This strategy also relies on role change. People often sustain conflict because the current structure rewards them for staying in the rival position.",
        "Shift the role and the motive may shift with it."
      ),
      bullet(
        "Dignity matters because humiliation locks identity into resistance. A rival who can move without visible degradation has more room to cooperate.",
        "Face can be a bridge."
      ),
      bullet(
        "Conversion should stay conditional. Greene is not advocating innocence after years of conflict. Evidence still has to earn trust.",
        "Realignment needs verification."
      ),
      bullet(
        "The broader lesson is that reducing hostility can be a strategic victory in itself. Greene wants the field simplified where possible so force can be spent more profitably elsewhere.",
        "Not every win requires annihilation."
      ),
    ],
    takeaways: [
      "Not every rival should stay an enemy",
      "Read the rival's real motive",
      "Preserve dignity during transition",
      "Partial conversion can still be valuable",
      "Stay cautious while trust is forming",
      "Reducing hostility can itself be a win",
    ],
    practice: [
      "Ask what the rival gains from staying hostile",
      "Design one route that changes the rival's role not only the rhetoric",
      "Protect dignity enough for movement without becoming naive",
      "Decide what evidence would make reduced hostility credible",
    ],
    examples: [
      example(
        "ch29-ex01",
        "Internal rival could become a useful partner",
        ["work"],
        "A colleague has become a rival partly because both of you are being pushed into the same scarce space. The hostility is real, but the structure may be creating more of it than either person truly wants.",
        [
          "Look for a role or division of wins that reduces the payoff of continued rivalry and gives the other person a credible path into cooperation.",
          "Do not demand emotional closeness first. Change the structure that keeps funding the conflict."
        ],
        "Greene's lesson is that some rivals persist because the current arrangement keeps rewarding the rivalry itself."
      ),
      example(
        "ch29-ex02",
        "Competitor inside a team could be neutralized",
        ["work"],
        "A team member keeps opposing you, but much of the opposition seems tied to fear of exclusion and loss of status. Full friendship is unlikely, yet reduced hostility may be achievable.",
        [
          "Offer a role or form of recognition that lowers the cost of stepping out of the rival posture without pretending trust is already complete.",
          "Aim first for neutralization or limited cooperation if full conversion is unrealistic."
        ],
        "This strategy matters because a reduced enemy can still change the whole balance of the field."
      ),
      example(
        "ch29-ex03",
        "Campus rival after an election",
        ["school"],
        "A student rival keeps opposing your leadership after an election. The conflict is partly personal and partly driven by the rival's need to avoid public irrelevance.",
        [
          "Give the rival a path into a meaningful role that reduces the gain from staying in open opposition.",
          "Preserve enough dignity that movement toward cooperation does not feel like pure surrender."
        ],
        "Greene would say some post election enemies can be converted when role, face, and interest are handled carefully."
      ),
      example(
        "ch29-ex04",
        "Group project rival still needed for success",
        ["school"],
        "A class rival is difficult, but the project would improve if the rivalry could be softened into workable cooperation. Open combat is now costing both sides more than it is paying.",
        [
          "Look for a task structure that channels the rival's ambition into contribution rather than direct competition.",
          "Use limited realignment if full trust is not yet realistic."
        ],
        "The strategy applies because some rivalries survive mostly from role and status, not from true incompatibility."
      ),
      example(
        "ch29-ex05",
        "Family conflict with a possible neutral path",
        ["personal"],
        "A family member has become a standing opponent in every decision, but the hostility seems partly sustained by fear of losing voice and respect. Pure battle is exhausting everyone.",
        [
          "See whether a role change or a more dignified channel for input could reduce the need for constant opposition.",
          "Aim first for reduced hostility if full conversion is too ambitious now."
        ],
        "Greene's point is that some enemies can be made less dangerous by changing the structure around the fight."
      ),
      example(
        "ch29-ex06",
        "Friendship turned rivalry through status",
        ["personal"],
        "A friendship has slowly become competitive and suspicious. The current pattern rewards comparison so heavily that every interaction feels like a small contest.",
        [
          "Redesign the interaction or the shared role so the reward for rivalry drops and cooperation becomes easier to choose.",
          "Do not confuse conversion with instant trust. Let evidence build slowly if the shift begins to hold."
        ],
        "This strategy matters because some rivalries are being funded by the structure more than by permanent hatred."
      ),
    ],
    directQuestions: [
      question(
        "ch29-q01",
        "Why does Greene want rivals converted when possible?",
        [
          "Because all conflict is morally bad",
          "Because reducing durable hostility can be cheaper and more strategic than endless direct opposition",
          "Because every rival secretly wants friendship",
          "Because power should never be used defensively"
        ],
        1,
        "He sees hostility as expensive and sometimes unnecessarily permanent."
      ),
      question(
        "ch29-q02",
        "What often makes conversion possible?",
        [
          "Ignoring the rival's motives",
          "Changing the role, incentives, or dignity conditions around the rivalry",
          "Public humiliation",
          "Demanding total trust immediately"
        ],
        1,
        "Role and incentive shifts often matter more than moral appeals alone."
      ),
      question(
        "ch29-q03",
        "Why is caution still necessary after a rival starts to shift?",
        [
          "Because conversion is never useful",
          "Because realignment needs evidence and may not yet be stable",
          "Because dignity should always be denied",
          "Because cooperation always weakens leverage"
        ],
        1,
        "Greene wants realism preserved during the transition."
      ),
      question(
        "ch29-q04",
        "What deeper principle closes this strategy?",
        [
          "Reducing hostility can be a strategic victory in itself",
          "Every enemy should be forgiven quickly",
          "Trust matters more than evidence",
          "Annihilation is always the best ending"
        ],
        0,
        "He wants force spent where it matters most, not locked forever into avoidable rivalry."
      ),
    ],
  }),
  chapter({
    chapterId: "ch30-end-with-legitimacy",
    number: 30,
    title: "End With Legitimacy",
    readingTimeMinutes: 14,
    summary: {
      p1: t(
        "Winning badly can poison the peace, and Greene argues that strategy includes how you finish, not only how you prevail. An ending with legitimacy leaves the field more governable, reduces needless backlash, and makes the result easier to hold because people can understand why the conflict ended as it did.",
        "This strategy is about consolidation after pressure. The final move should create order, not just satisfaction. If victory humiliates, confuses, or leaves the aftermath morally or structurally unstable, the campaign may simply be inviting the next round.",
        "Greene's lesson is that endings shape memory and future resistance. How you close determines whether the result looks rightful, grudgingly acceptable, or like a provocation waiting to be answered."
      ),
      p2: t(
        "This matters because the final phase of conflict often tempts excess. After strain, people want dramatic vindication, total dominance, or punishment that feels complete. Those impulses may feel powerful while weakening the settlement they are supposed to secure.",
        "The deeper lesson is that legitimacy is practical. It reduces the political cost of aftermath by giving others a way to live inside the new reality without needing immediate revenge or endless resistance.",
        "In practical life, ending with legitimacy often means making the terms clear, proportional, and supportable, closing with enough fairness that the result can stand without constant reenforcement through force alone."
      ),
    },
    standardBullets: [
      bullet(
        "Think about the ending before the peak. Greene wants the aftermath designed, not improvised from emotion.",
        "A messy finish can ruin a strong campaign."
      ),
      bullet(
        "Do not confuse domination with durable closure. A result that feels satisfying in the moment may still be hard to hold.",
        "Endings should govern what comes next."
      ),
      bullet(
        "Leave terms others can live under. Legitimacy grows when the outcome is clear, bounded, and not needlessly degrading.",
        "Acceptance matters to durability."
      ),
      bullet(
        "Avoid humiliating victory where possible. Humiliation often creates future resistance stronger than ordinary defeat does.",
        "Shame can keep conflict alive."
      ),
      bullet(
        "Make the settlement intelligible. People comply more readily when they can see the rule and reason in the ending.",
        "Clarity supports legitimacy."
      ),
      bullet(
        "Close at the right point. Continuing past the decisive moment can turn strength into overreach.",
        "Good endings know when enough is enough."
      ),
      bullet(
        "Use proportion. Excessive punishment or extraction weakens the moral and political base of the result.",
        "Aftermath should not create a new war needlessly."
      ),
      bullet(
        "Protect your own reputation in victory. The ending teaches others how to read your power and what future cooperation with you may cost.",
        "Closure shapes future alliances."
      ),
      bullet(
        "Secure the order behind the finish. An ending needs structure, not only declaration.",
        "Legitimacy still needs implementation."
      ),
      bullet(
        "The closing lesson is that the strongest finish is the one that can last. Greene wants victory translated into a settlement that remains governable after emotion cools.",
        "Endings should stabilize the field."
      ),
    ],
    deeperBullets: [
      bullet(
        "Greene is warning against victory intoxication. Success often lowers restraint exactly when restraint would make the result easier to keep.",
        "Triumph can be strategically expensive."
      ),
      bullet(
        "This strategy matters because endings become stories. People remember how power behaved at the finish and carry that memory into future trust or resistance.",
        "The close writes the reputation."
      ),
      bullet(
        "Legitimacy lowers enforcement cost. A result that feels comprehensible and bounded usually needs less constant pressure to sustain it.",
        "Acceptance saves force."
      ),
      bullet(
        "There is also a sequencing lesson here. Closure must arrive after the decisive gain is real, but before extra punishment starts creating new enemies unnecessarily.",
        "Timing matters in endings too."
      ),
      bullet(
        "The broader lesson is that strategic closure should produce order, memory, and future governability in your favor. Greene wants the win to settle the field rather than leave it morally and emotionally raw.",
        "A durable ending is part of the victory itself."
      ),
    ],
    takeaways: [
      "Design the aftermath early",
      "Do not turn victory into humiliation",
      "Clear terms help results hold",
      "Proportion protects legitimacy",
      "Closure should arrive before overreach",
      "Endings shape future memory and trust",
    ],
    practice: [
      "Write what a governable ending would actually look like",
      "Remove one piece of unnecessary humiliation from the close",
      "Check whether the settlement is clear enough to live under",
      "Plan the structure that makes the ending real after the announcement",
    ],
    examples: [
      example(
        "ch30-ex01",
        "Manager wins the dispute and risks overpunishing",
        ["work"],
        "A manager has clearly won an internal dispute and now has room to shape the final terms. The temptation is to make the other side pay fully so the win feels complete.",
        [
          "Stop at the point where the result is secure and avoid turning the close into a humiliation that creates future resistance.",
          "Make the new terms clear, bounded, and workable enough that people can live inside them."
        ],
        "Greene's lesson is that the aftermath can undo the victory if it produces more resentment than order."
      ),
      example(
        "ch30-ex02",
        "Negotiation close without a stable settlement",
        ["work"],
        "A team is about to close a negotiation on favorable terms, but the current draft leaves enough ambiguity that future conflict is likely. Winning the moment may not mean securing the relationship.",
        [
          "Use the leverage to create a clear and supportable settlement rather than only a dramatic close.",
          "Make the ending legible enough that it can hold after the current pressure fades."
        ],
        "This strategy matters because a vague or vindictive finish can keep the conflict alive under a new name."
      ),
      example(
        "ch30-ex03",
        "Student election win followed by gloating",
        ["school"],
        "A student candidate wins and now has a chance either to unify the group or to savor the victory publicly against rivals. The tone of the finish will shape the next phase of leadership.",
        [
          "Close in a way that secures governability and leaves rivals less eager to sabotage the result.",
          "Treat the win as the start of a system you must now hold, not as a final moment of emotional release."
        ],
        "Greene would say that endings matter because they teach the field how victory intends to govern."
      ),
      example(
        "ch30-ex04",
        "Group project conflict resolved without clarity",
        ["school"],
        "A group finally resolves a major internal conflict, but everyone is eager to move on and skip the step of making the new arrangement explicit. The dispute may be ending, yet the aftermath is still structurally weak.",
        [
          "Turn the resolution into a clear and credible settlement rather than assuming relief will keep it in place.",
          "Use the close to create governable order, not merely a temporary pause in tension."
        ],
        "The strategy applies because endings that are emotionally satisfying but structurally thin often reopen later."
      ),
      example(
        "ch30-ex05",
        "Family argument finally settled",
        ["personal"],
        "A difficult family dispute reaches a turning point, and one person now has the chance either to keep punishing old wrongs or to set clear terms that everyone can live with going forward.",
        [
          "Choose closure that stabilizes the relationship structure rather than closure that maximizes emotional payback.",
          "Let the ending create a future people can actually inhabit."
        ],
        "Greene's point is that a result holds better when people can accept it without living inside humiliation."
      ),
      example(
        "ch30-ex06",
        "Friend group ending a long conflict",
        ["personal"],
        "A friend group is finally ready to end a long conflict, but the final conversation could still become a stage for score settling. The way it closes will determine whether peace lasts.",
        [
          "Use the ending to make boundaries, terms, and expectations clear without reopening every old wound for dramatic effect.",
          "Aim for a finish that reduces future resistance rather than feeding it one last time."
        ],
        "This strategy matters because people often lose the peace by trying to extract too much from the moment of closure itself."
      ),
    ],
    directQuestions: [
      question(
        "ch30-q01",
        "Why does Greene care about legitimacy at the end of a conflict?",
        [
          "Because all endings should feel nice",
          "Because a result that feels governable and understandable is easier to hold",
          "Because humiliation always creates obedience",
          "Because closure matters less than victory"
        ],
        1,
        "He wants the ending to lower future resistance and enforcement cost."
      ),
      question(
        "ch30-q02",
        "What often weakens a strong finish?",
        [
          "Clear terms",
          "Stopping once enough has been won",
          "Victory intoxication and unnecessary humiliation",
          "Planning the aftermath"
        ],
        2,
        "Emotional excess after success can make the settlement harder to sustain."
      ),
      question(
        "ch30-q03",
        "Why is proportion important in this strategy?",
        [
          "Because it makes the result more acceptable and less likely to generate new enemies",
          "Because it prevents all resentment",
          "Because it removes the need for structure",
          "Because it makes endings slower"
        ],
        0,
        "A bounded result is often easier to live under and therefore easier to hold."
      ),
      question(
        "ch30-q04",
        "What deeper principle closes this strategy?",
        [
          "A durable ending is part of the victory itself",
          "The final emotional release matters most",
          "Governability belongs only to large institutions",
          "Force should always remain high after success"
        ],
        0,
        "Greene wants the close to produce order that survives the heat of the conflict."
      ),
    ],
  }),
  chapter({
    chapterId: "ch31-review-errors-unsparingly",
    number: 31,
    title: "Review Errors Unsparingly",
    readingTimeMinutes: 13,
    summary: {
      p1: t(
        "You do not improve by protecting your self image from the truth of your mistakes, and Greene argues that strategic growth requires unsparing review after both failure and success. Error has to be studied without excuse, vanity, or comforting myth if it is going to become future advantage.",
        "This strategy is not about self punishment. It is about accurate diagnosis. Where did the reading fail, the pacing fail, the alliance fail, the assumption fail, or the ego overrule the field.",
        "Greene's lesson is that unexamined error becomes repeated error. People often call the repetition bad luck when it is really defended blindness."
      ),
      p2: t(
        "This matters because conflict creates strong incentives to lie to yourself. Loss makes excuse attractive, and success makes complacency attractive. Both reactions interrupt learning.",
        "The deeper lesson is that review is part of the campaign, not an afterthought outside it. Honest analysis changes how the next contest will be read, prepared, and timed.",
        "In practical life, unsparing review means separating outcome from explanation, facing the role of pride or fear, and turning what happened into concrete adjustment instead of into narrative comfort."
      ),
    },
    standardBullets: [
      bullet(
        "Review error without vanity. Greene wants truth about failure more than protection of image.",
        "Learning begins where excuses weaken."
      ),
      bullet(
        "Study success too. Good outcomes can hide bad methods just as failure can hide useful lessons.",
        "Results alone are not enough."
      ),
      bullet(
        "Separate explanation from comfort. The first story you tell yourself after a setback often serves dignity before accuracy.",
        "Narrative can block learning."
      ),
      bullet(
        "Look for repeated patterns. The same mistake returning in new form usually signals something deeper than bad luck.",
        "Repetition points to structure."
      ),
      bullet(
        "Identify where ego or fear bent judgment. Emotional distortion often hides inside technical mistakes.",
        "Inner causes shape outer errors."
      ),
      bullet(
        "Turn review into adjustment. Analysis matters only if it changes preparation, method, or timing next time.",
        "Learning needs behavioral proof."
      ),
      bullet(
        "Do not outsource blame completely. External factors matter, but the strategic question is what was still under your control.",
        "Agency has to be recovered."
      ),
      bullet(
        "Review close to the event while memory is still sharp. Delay often lets self protecting stories harden.",
        "Accuracy decays if you wait too long."
      ),
      bullet(
        "Use honest review to lower future surprise. The more clearly you see your errors, the less likely you are to call them mysterious next time.",
        "Clarity reduces repeated shock."
      ),
      bullet(
        "The closing lesson is that unsparing review converts pain into leverage. Greene wants mistakes turned into design, not into identity damage or denial.",
        "Error should become instruction."
      ),
    ],
    deeperBullets: [
      bullet(
        "Greene is attacking self deception, not only technical sloppiness. People often know more than they admit about why a campaign went wrong, but pride edits the evidence.",
        "Review has to reach the ego layer."
      ),
      bullet(
        "This strategy also protects against success blindness. Victories can hide weak assumptions that only become visible when fortune shifts later.",
        "Review should not wait for collapse."
      ),
      bullet(
        "Unsparing does not mean theatrical self hatred. Greene wants honest diagnosis that preserves agency, not shame that paralyzes it.",
        "Truth should strengthen future action."
      ),
      bullet(
        "Repeated error often means a recurring emotional script is still alive. The same fear, rush, vanity, or dependence keeps reappearing in different clothes.",
        "Pattern review reveals the root."
      ),
      bullet(
        "The broader lesson is that disciplined reflection is part of strategy's long game. Greene wants the next contest entered with fewer illusions than the last one.",
        "Review is future preparation in analytic form."
      ),
    ],
    takeaways: [
      "Review without vanity",
      "Study wins as well as losses",
      "Separate comfort from diagnosis",
      "Look for repeated patterns",
      "Translate review into adjustment",
      "Error should become instruction",
    ],
    practice: [
      "Write the first excuse you are tempted to believe",
      "Name the role of pride, fear, or haste in the result",
      "Find the pattern if the mistake has appeared before",
      "Choose one concrete adjustment for the next campaign",
    ],
    examples: [
      example(
        "ch31-ex01",
        "Postmortem reduced to blame",
        ["work"],
        "A team finishes a difficult project and immediately starts turning the review into a blame allocation exercise. The real learning is being lost behind self protection.",
        [
          "Separate the question of responsibility from the question of what actually failed in reading, method, or sequence.",
          "Use the review to produce future adjustment rather than present relief."
        ],
        "Greene's lesson is that review becomes useless when it serves image management more than diagnosis."
      ),
      example(
        "ch31-ex02",
        "Successful quarter hiding weak method",
        ["work"],
        "A team gets a strong result and decides the approach must have been sound. A closer look suggests the result depended heavily on luck and overextension that cannot be repeated safely.",
        [
          "Review the method even though the outcome feels flattering.",
          "Do not let success protect the exact weaknesses that may break you later."
        ],
        "This strategy matters because wins can hide as much strategic error as losses do."
      ),
      example(
        "ch31-ex03",
        "Student after a poor exam",
        ["school"],
        "A student gets a bad exam result and immediately blames unfair questions, bad sleep, and bad luck. Some of those factors may be real, but the whole review is drifting away from agency.",
        [
          "Name the external factors honestly while still asking what reading, preparation, or pacing error was yours.",
          "Use the answer to redesign the next study campaign rather than protect the current story."
        ],
        "Greene would say that review has to recover leverage, not only soothe disappointment."
      ),
      example(
        "ch31-ex04",
        "Group project win with hidden cost",
        ["school"],
        "A project group wins praise, but only because one person carried an unsustainable share of the work and the rest made last minute recoveries. The result flatters the process more than it should.",
        [
          "Review what actually made the success possible and what would fail if the same conditions returned.",
          "Do not let a good grade erase the need for structural honesty."
        ],
        "The strategy applies because outcome can distract from method unless review looks past applause."
      ),
      example(
        "ch31-ex05",
        "Family argument explained away too quickly",
        ["personal"],
        "After a bad family argument, someone tells a simple story in which the other person was unreasonable and nothing more needs to be learned. The explanation is tidy and strategically empty.",
        [
          "Ask where your own timing, tone, or ego helped create the result even if the other person's behavior was also weak.",
          "Use the review to gain a stronger next move instead of a cleaner self image."
        ],
        "Greene's point is that unsparing review is about leverage, not self punishment or self innocence."
      ),
      example(
        "ch31-ex06",
        "Repeated dating pattern blamed on bad luck",
        ["personal"],
        "Someone keeps ending up in the same unhealthy dating pattern and calls it bad luck each time. The repetition suggests there is a strategy problem hidden inside the story.",
        [
          "Review the recurring signals you ignored, the pace you allowed, and the needs that may have bent your reading.",
          "Turn the pattern into new rules for the next situation instead of into a fatalistic identity story."
        ],
        "This strategy matters because repeated error often hides in the part of the narrative that feels most personally protective."
      ),
    ],
    directQuestions: [
      question(
        "ch31-q01",
        "Why does Greene want error reviewed unsparingly?",
        [
          "Because shame is the best teacher",
          "Because protected mistakes tend to return in new form",
          "Because blame is strategically useful",
          "Because success should not be examined"
        ],
        1,
        "He wants mistakes turned into future advantage rather than defended into repetition."
      ),
      question(
        "ch31-q02",
        "Why does he insist that success should also be reviewed?",
        [
          "Because success is usually a problem",
          "Because good outcomes can hide weak methods and lucky escapes",
          "Because winning removes the need for morale",
          "Because review matters only after victory"
        ],
        1,
        "A flattering result can protect the exact weakness that will hurt you later."
      ),
      question(
        "ch31-q03",
        "What most often weakens honest review?",
        [
          "Early documentation",
          "Comforting stories that serve dignity before accuracy",
          "Pattern analysis",
          "Turning lessons into adjustments"
        ],
        1,
        "Self protecting explanation usually arrives before strategic diagnosis."
      ),
      question(
        "ch31-q04",
        "What deeper principle closes this strategy?",
        [
          "Review is future preparation carried out through disciplined honesty",
          "Past errors should stay in the past",
          "Outcome matters more than method",
          "Blame restores agency"
        ],
        0,
        "Greene wants reflection to enter the next campaign as reduced illusion."
      ),
    ],
  }),
  chapter({
    chapterId: "ch32-build-systems-not-heroics",
    number: 32,
    title: "Build Systems Not Heroics",
    readingTimeMinutes: 13,
    summary: {
      p1: t(
        "Heroic rescue is unreliable strategy, and Greene argues that durable advantage comes from systems, routines, structures, and repeatable standards rather than from occasional brilliance by a few people. Heroics can save a moment, but systems decide whether the next moment will need saving at all.",
        "This strategy is about moving from performance to architecture. A strong system turns good judgment into repeatable behavior and reduces dependence on mood, memory, or singular personalities.",
        "Greene's lesson is that institutions outlast bursts. The campaign becomes harder to break when competence is embedded in process rather than concentrated in one heroic figure."
      ),
      p2: t(
        "This matters because people often admire visible brilliance and underinvest in the quiet design that would make brilliance less necessary. That admiration can turn organizations and personal habits into machines that require constant rescue.",
        "The deeper lesson is that systems preserve force. They reduce avoidable confusion, distribute competence, and keep quality from depending on whether the right person happens to be in the room at the right moment.",
        "In practical life, building systems means creating standards, routines, handoffs, and learning loops that keep performance reliable enough that crisis becomes rarer and less dramatic."
      ),
    },
    standardBullets: [
      bullet(
        "Do not rely on heroics as the main plan. Greene wants repeatable strength, not occasional rescue.",
        "A system is safer than a savior."
      ),
      bullet(
        "Turn good judgment into process. Reliable routines preserve quality even when pressure rises.",
        "What can be repeated can be trusted more widely."
      ),
      bullet(
        "Reduce single points of failure. A campaign becomes fragile when too much depends on one exceptional person.",
        "Concentrated competence creates risk."
      ),
      bullet(
        "Build standards that survive mood. Systems protect performance from energy swings and memory gaps.",
        "Structure preserves consistency."
      ),
      bullet(
        "Create handoffs and backups. Good systems let people leave, rest, or fail without taking the whole campaign with them.",
        "Continuity matters."
      ),
      bullet(
        "Use review to improve the structure, not only the individual. Repeated mistakes often point to system design, not just to personal weakness.",
        "Architecture shapes behavior."
      ),
      bullet(
        "Do not romanticize improvisation. What looks flexible can sometimes be undisciplined dependence on last minute rescue.",
        "Crisis fluency is not enough."
      ),
      bullet(
        "Make the system teach new people quickly. Durable structures can be learned and carried by more than the founders.",
        "Transmission is part of strength."
      ),
      bullet(
        "Let systems free up higher judgment. Routine should handle the repeatable so attention can go to the truly new.",
        "Structure protects bandwidth."
      ),
      bullet(
        "The closing lesson is that durable campaigns are built, not constantly saved. Greene wants competence embedded in design rather than celebrated only in emergencies.",
        "Systems are stored power."
      ),
    ],
    deeperBullets: [
      bullet(
        "Greene is criticizing performative leadership as much as weak operations. Some leaders secretly benefit from chaos because it keeps their hero role alive.",
        "Heroics can hide design failure."
      ),
      bullet(
        "This strategy also protects morale. Teams trust the future more when success does not depend on one exhausted expert saving each round.",
        "Systems make effort feel safer."
      ),
      bullet(
        "Structure does not eliminate creativity. It protects creativity by removing avoidable disorder from the parts that should already be reliable.",
        "Routine and judgment can reinforce one another."
      ),
      bullet(
        "Building systems takes humility because it shifts attention from visible personal brilliance to invisible collective strength.",
        "The ego often prefers heroics."
      ),
      bullet(
        "The broader lesson is that embedded competence outlasts performance spikes. Greene wants strength that can survive turnover, fatigue, surprise, and ordinary human inconsistency.",
        "Design is endurance made concrete."
      ),
    ],
    takeaways: [
      "Heroics cannot be the main plan",
      "Turn judgment into repeatable process",
      "Reduce single points of failure",
      "Build standards that survive mood",
      "Use review to improve structure",
      "Systems store competence over time",
    ],
    practice: [
      "Name one area relying too much on heroics",
      "Turn one repeated judgment into a clear process",
      "Add a backup or handoff for a fragile role",
      "Ask what the current chaos is rewarding that design should replace",
    ],
    examples: [
      example(
        "ch32-ex01",
        "Team kept alive by one star operator",
        ["work"],
        "A team looks strong because one person keeps rescuing the work at the last minute. The performance is admired, but the real system underneath is fragile and dependent.",
        [
          "Use the hero's knowledge to build process, backups, and standards before the dependence becomes a crisis.",
          "Shift the team's strength from one person's rescue to shared structure."
        ],
        "Greene's lesson is that repeated heroics usually signal a system that has not yet been built well enough."
      ),
      example(
        "ch32-ex02",
        "Manager solving the same preventable problems",
        ["work"],
        "A manager keeps fixing the same category of issue personally and takes pride in staying calm under pressure. The skill is real, but the pattern suggests the system is still training emergencies into normal life.",
        [
          "Stop admiring the rescue long enough to redesign the process that keeps needing rescue.",
          "Use your crisis skill to build a quieter structure that makes the next crisis less likely."
        ],
        "This strategy matters because performance under chaos is not the same as strength beyond chaos."
      ),
      example(
        "ch32-ex03",
        "Student group relying on one organizer",
        ["school"],
        "A campus group functions only because one organizer remembers everything, chases everyone, and solves every problem. The group's apparent strength is really concentrated fragility.",
        [
          "Turn the organizer's private memory into shared process, calendar structure, and visible handoffs.",
          "Build the group so it can survive the organizer having an off week or leaving entirely."
        ],
        "Greene would say the campaign is only as strong as what remains after the hero is gone."
      ),
      example(
        "ch32-ex04",
        "Project team romanticizing all nighters",
        ["school"],
        "A project team keeps praising its ability to save things at the last minute. The pattern feels impressive and keeps reproducing the exact conditions that require it.",
        [
          "Replace the crisis romance with process that surfaces work earlier and distributes responsibility more evenly.",
          "Treat repeated all night rescues as a design failure, not as the team's special gift."
        ],
        "The strategy applies because heroics can become a culture that blocks the system improvement everyone actually needs."
      ),
      example(
        "ch32-ex05",
        "Household running on one person only",
        ["personal"],
        "A household works only because one person tracks every detail and solves every forgotten problem. The arrangement looks stable until that person becomes tired or unavailable.",
        [
          "Build routines and visible responsibilities so the house can function without one permanent rescuer.",
          "Turn hidden labor into shared structure before exhaustion becomes the teacher."
        ],
        "Greene's point is that durable systems matter in personal life too. Heroic overfunctioning is still fragility."
      ),
      example(
        "ch32-ex06",
        "Friend group plans saved by one person",
        ["personal"],
        "A friend group keeps praising one person for always making everything happen, but the praise is masking how little system the group has built for itself.",
        [
          "Use the next planning cycle to create routines, expectations, and shared ownership instead of another quiet rescue.",
          "Make the group's competence transferable rather than personal."
        ],
        "This strategy matters because groups become more resilient when their reliability is embedded in structure, not only in generosity."
      ),
    ],
    directQuestions: [
      question(
        "ch32-q01",
        "What is Greene mainly criticizing in this strategy?",
        [
          "Talent itself",
          "Dependence on recurring heroics instead of durable structure",
          "Creativity under pressure",
          "Any strong individual performance"
        ],
        1,
        "He wants rescue turned into repeatable design rather than endlessly admired as rescue."
      ),
      question(
        "ch32-q02",
        "Why are systems strategically stronger than heroics?",
        [
          "Because they eliminate all need for judgment",
          "Because they make competence more repeatable and less dependent on one person",
          "Because they are always simpler than people",
          "Because they make adaptation impossible"
        ],
        1,
        "Systems store capability so the campaign is less fragile under fatigue, turnover, or surprise."
      ),
      question(
        "ch32-q03",
        "What often signals a system problem rather than a one off issue?",
        [
          "A single difficult day",
          "The same category of rescue happening repeatedly",
          "A well documented routine",
          "Smooth handoffs"
        ],
        1,
        "Repeated heroics usually point back to missing structure."
      ),
      question(
        "ch32-q04",
        "What deeper principle closes this strategy?",
        [
          "Design is stored power that outlasts individual brilliance",
          "Heroics are the purest form of leadership",
          "Structure matters only in large organizations",
          "Routines weaken morale"
        ],
        0,
        "Greene wants competence embedded in architecture rather than concentrated in rescue moments."
      ),
    ],
  }),
  chapter({
    chapterId: "ch33-preserve-energy-for-the-next-contest",
    number: 33,
    title: "Preserve Energy for the Next Contest",
    readingTimeMinutes: 13,
    summary: {
      p1: t(
        "No contest is the last contest unless you ruin yourself inside it, and Greene argues that strategic strength includes preserving enough energy, credibility, and morale for what comes after the current round. The temptation to spend everything now can be intense, especially when stakes feel personal, but total expenditure often weakens the next campaign before it begins.",
        "This final strategy treats conservation as realism, not timidity. You should spend what the objective truly requires, but not more merely to feel complete in the moment.",
        "Greene's lesson is that strength has to survive victory, loss, and delay alike. A campaign is part of a longer sequence, and strategy should respect that larger horizon."
      ),
      p2: t(
        "This matters because people often evaluate moves only by immediate effect. They ask whether the action landed now and ignore what it cost in trust, stamina, flexibility, health, or reputation for the future.",
        "The deeper lesson is that economy is a form of long range power. Preserved energy allows faster recovery, cleaner decision making, and better readiness when the next pressure arrives.",
        "In practical life, this often means ending earlier, speaking less, recovering properly, declining unnecessary escalations, and refusing the vanity of total self expenditure. Greene closes by reminding the reader that strategy is a long game of retained capacity."
      ),
    },
    standardBullets: [
      bullet(
        "Spend for the objective, not for emotional completion. Greene wants force matched to need rather than to the desire to feel total.",
        "Overexpenditure weakens the next round."
      ),
      bullet(
        "Treat every contest as part of a sequence. The current move matters, but so does the condition you will be left in afterward.",
        "Long range thinking changes present spending."
      ),
      bullet(
        "Protect stamina and clarity. Exhaustion makes later judgment rough and expensive.",
        "Energy is part of strategy."
      ),
      bullet(
        "Do not chase the last drop of victory. The gain from pushing beyond sufficiency is often lower than the cost.",
        "More is not always better."
      ),
      bullet(
        "Preserve reputation along with strength. Short term wins that damage trust or credibility can make future contests harder.",
        "How you spend force teaches the field."
      ),
      bullet(
        "Use recovery as strategic maintenance. Rest, reset, and regroup are part of readiness, not rewards after the serious work is done.",
        "Capacity has to be renewed."
      ),
      bullet(
        "Avoid conflict that only drains. Some engagements cost more energy than their outcome can possibly justify.",
        "Economy protects future leverage."
      ),
      bullet(
        "Budget emotional energy too. Resentment, obsession, and replay can keep spending force long after the visible contest has ended.",
        "The campaign continues inside the mind."
      ),
      bullet(
        "Leave room for the next adaptation. If everything is spent now, the next surprise arrives against empty reserves.",
        "Conservation preserves flexibility."
      ),
      bullet(
        "The closing lesson is that durable strength survives the round. Greene wants readers finishing each contest with enough left to think, act, and recover again.",
        "Economy is long game power."
      ),
    ],
    deeperBullets: [
      bullet(
        "Greene is ending on strategic metabolism. Power is not only force applied but capacity preserved and renewed across many rounds.",
        "Sustainability is part of seriousness."
      ),
      bullet(
        "This strategy also limits revenge logic. People often overspend because they want emotional closure that the field was never going to give them anyway.",
        "Completion can be a costly fantasy."
      ),
      bullet(
        "Preserved energy improves learning because a drained system cannot review, adapt, or rebuild very intelligently.",
        "Recovery supports reflection."
      ),
      bullet(
        "What is conserved is broader than physical effort. Greene is also concerned with reputation, trust, morale, and strategic flexibility as forms of stored energy.",
        "Future contests draw on many reserves."
      ),
      bullet(
        "The broader lesson is that economy protects continuity. Greene wants every campaign conducted with an awareness that tomorrow will still ask something of you.",
        "Long game thinking governs present expenditure."
      ),
    ],
    takeaways: [
      "Do not spend for emotional completion",
      "Every contest sits inside a longer sequence",
      "Protect stamina, trust, and flexibility",
      "Recovery is strategic maintenance",
      "Avoid conflicts that only drain",
      "Economy is long game power",
    ],
    practice: [
      "Ask what the current move will cost you tomorrow",
      "Stop where the objective is met instead of where emotion feels complete",
      "Recover on purpose after major pressure",
      "Protect one reserve you will need for the next contest",
    ],
    examples: [
      example(
        "ch33-ex01",
        "Manager wins but empties the team",
        ["work"],
        "A team finally wins a difficult push, but the manager keeps pressing as though the same level of strain can continue indefinitely. The result is success now and depletion afterward.",
        [
          "Stop once the objective is truly secured and protect the team's energy for the next phase instead of spending every remaining ounce on emotional completion.",
          "Treat recovery as part of the campaign rather than as a reward outside it."
        ],
        "Greene's lesson is that a victory that leaves the system empty can quietly weaken the next contest before it starts."
      ),
      example(
        "ch33-ex02",
        "Professional argument not worth the drain",
        ["work"],
        "Someone is tempted to keep fighting a professional argument long after the practical benefit has become small because backing off now would feel unsatisfying. The conflict is consuming future capacity.",
        [
          "Measure the next round by what it would still change, not by whether it would feel emotionally complete.",
          "Preserve force for the future campaign instead of feeding a shrinking return."
        ],
        "This strategy matters because overfighting can turn a real gain into a long range loss of energy and credibility."
      ),
      example(
        "ch33-ex03",
        "Student after a brutal exam week",
        ["school"],
        "A student finishes an exhausting exam week and immediately throws the same depleted energy into the next demand without recovery. The current round ends, but the next one begins against empty reserves.",
        [
          "Treat restoration as part of academic strategy instead of as proof that you were not serious enough.",
          "Protect the mental and physical capacity the next contest will require."
        ],
        "Greene would say that endurance is not only about surviving the round. It is about still being usable afterward."
      ),
      example(
        "ch33-ex04",
        "Club leader keeps escalating small issues",
        ["school"],
        "A student leader answers every small challenge as if the whole future of the group were at stake. The behavior looks committed, but it is gradually emptying the group's patience and focus.",
        [
          "Spend only what the real objective requires and stop making every small contest carry total weight.",
          "Preserve the group's energy for the moments that actually decide its future."
        ],
        "The strategy applies because energy spent everywhere rarely remains available for what matters most."
      ),
      example(
        "ch33-ex05",
        "Personal conflict replayed for weeks",
        ["personal"],
        "A conflict ends outwardly, but one person keeps replaying it internally, arguing with imagined versions of the other person, and draining energy long after the visible event is over.",
        [
          "Recognize the ongoing internal expenditure and stop paying for a finished contest with fresh emotional energy every day.",
          "Preserve your future strength by ending the inner war as well as the outer one."
        ],
        "Greene's point is that strategy includes how long you keep spending yourself after the event has already closed."
      ),
      example(
        "ch33-ex06",
        "Dating conflict pushed past usefulness",
        ["personal"],
        "A relationship issue needs to be addressed, but one person keeps pushing the conversation past the point of usefulness because they want total emotional satisfaction before stopping. The result is depletion without new understanding.",
        [
          "End the exchange when the necessary point has landed and preserve energy for the next needed conversation.",
          "Do not spend future trust and stamina for the fantasy of perfect completion in one round."
        ],
        "This strategy matters because overcompletion is often just another form of overexpenditure."
      ),
    ],
    directQuestions: [
      question(
        "ch33-q01",
        "What is Greene mainly warning against in the final strategy?",
        [
          "Using any energy at all",
          "Spending more force than the objective truly requires and weakening the next contest",
          "Recovering after pressure",
          "Treating reputation as part of strategy"
        ],
        1,
        "He wants the current round fought with awareness of what future rounds will still demand."
      ),
      question(
        "ch33-q02",
        "Why can pushing past sufficiency be strategically costly?",
        [
          "Because more victory is always weakness",
          "Because the extra gain may be small while the drain on future capacity is large",
          "Because endings should feel incomplete",
          "Because recovery is not important"
        ],
        1,
        "Overexpenditure often serves emotional completion more than strategic need."
      ),
      question(
        "ch33-q03",
        "What counts as preserved energy in Greene's logic?",
        [
          "Only physical stamina",
          "Stamina, trust, morale, reputation, and flexibility",
          "Only money",
          "Only formal authority"
        ],
        1,
        "He treats future capacity as broader than physical effort alone."
      ),
      question(
        "ch33-q04",
        "What deeper principle closes the book?",
        [
          "Long game economy should govern present expenditure",
          "Total commitment means total depletion",
          "Every contest should be fought as if nothing comes after it",
          "Recovery belongs outside strategy"
        ],
        0,
        "Greene ends by tying strength to what remains usable after the current round closes."
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

  lines.push("# 1. Book audit summary for The 33 Strategies of War by Robert Greene", "");
  AUDIT_SUMMARY.forEach((paragraph) => lines.push(sentence(paragraph), ""));

  lines.push("# 2. Main content problems found", "");
  MAIN_PROBLEMS.forEach((paragraph, index) => lines.push(`${index + 1}. ${sentence(paragraph)}`));
  lines.push("");

  lines.push("# 3. Personalization strategy for The 33 Strategies of War by Robert Greene", "");
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
    standardBullets.forEach((block, index) =>
      lines.push(`${index + 1}. ${sentence(renderBullet(block))}`)
    );
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
  lines.push("5. The package remains schema compatible while the reader can apply a Robert Greene specific motivation layer.");
  lines.push("6. The resulting book now reads as a designed lesson rather than a generated placeholder.");
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
