import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "fs";
import { resolve } from "path";

const repo = resolve(new URL("../../../../..", import.meta.url).pathname);
const authoredDir = resolve(repo, "scripts/book/prompts/chapterflow-v21-authored/state/chapters");
const rootDir = resolve(repo, "state/chapters");

const chapterIds = Array.from({ length: 12 }, (_, i) => `range-ch${String(i + 1).padStart(2, "0")}`);

const updates = {
  "range-ch01": {
    fastRead: `At a tryout table, a parent points from a Tiger Woods poster to a seven-year-old's year-round schedule and asks why every sport should not copy golf.

The Range test is environmental before it is motivational. Golf and chess reward repeated exposure to stable patterns, while many adult decisions hide the rule, delay feedback, or change the game.

The head-start story is strongest where rules repeat and feedback is clean. Outside chessboards and driving ranges, narrow early practice can train confidence for the wrong world.

Choose one skill you admire and ask: is feedback fast, accurate, and stable? If not, name the breadth that would protect the learner from practicing the wrong lesson.`,
    fullRead: `The Tiger Woods story is powerful because it is concrete: a small child, a tiny club, a visible ball, and adults who can tell immediately whether the shot worked. Laszlo Polgar's chess experiment makes the same case in a different arena. Susan, Sofia, and especially Judit became extraordinary players because chess gives repeated patterns, stable rules, and feedback that arrives quickly enough for practice to teach the right lesson.

Epstein does not dismiss those achievements. He narrows their jurisdiction. Grandmasters remember meaningful chess positions because years of play have organized the board into familiar patterns; scramble the pieces randomly and much of the advantage disappears. That finding matters because it shows how much expertise depends on the structure of the environment, not on a universal mental gift.

Golf and chess are unusually kind learning worlds. Most adult domains are less courteous. Hiring, science, parenting, leadership, markets, and forecasting often hide the rule until later, reward a move for the wrong reason, or change the pattern just as a learner becomes fluent. In those settings, an early head start can become a tunnel: fast progress inside a narrow track that teaches confidence before it teaches judgment.

The better question is not whether practice matters. It is what kind of world the practice is training for. Early specialization can be magnificent when the environment is kind. When the environment is wicked, sampling can gather information about fit, feedback, and transfer before commitment hardens into identity.`,
    implementationPlan: {
      title: "Kind-or-Wicked Learning Audit",
      coreSkill: "Judge whether a skill deserves narrow repetition or early breadth by testing the learning environment: fast feedback, accurate feedback, stable rules, and recurring patterns.",
      ifThenPlans: [
        { context: "When a head-start story tempts me", plan: "If a prodigy story makes early specialization look obvious, then I will ask whether the skill has golf-or-chess feedback before copying the path." },
        { context: "When practice feels productive", plan: "If reps are getting smoother, then I will check whether the environment is teaching a stable pattern or just making me fluent in a narrow routine." },
        { context: "When choosing for a young learner or new hire", plan: "If the future task is wicked, then I will add sampling, messy cases, or varied contexts before locking in specialization." },
      ],
      twentyFourHourChallenge: "Pick one skill or training decision. Score its feedback on speed, accuracy, stability, and pattern repetition; then decide whether it needs narrow reps or protective breadth.",
      weeklyPractice: "This week, review one place where you are rewarding a head start. Add one test that reveals whether the learner can adapt when the rules are less kind.",
    },
    reviewCards: [
      { cardId: "card01", front: "What did the Polgar sisters' chess success demonstrate about early specialization?", back: "Early specialization can work powerfully when the domain has stable rules, recurring patterns, and fast feedback, as chess did for the Polgar sisters.", difficulty: "easy" },
      { cardId: "card02", front: "How do you tell whether a learning environment is kind?", back: "A kind environment gives quick, accurate feedback, repeats recognizable patterns, and keeps the rules stable enough for practice to teach the right lesson.", difficulty: "medium" },
      { cardId: "card03", front: "Why can a head start become a liability in wicked domains?", back: "Fast early progress can build confidence in a narrow routine before the learner discovers that the real setting changes rules, delays feedback, or rewards transfer.", difficulty: "hard" },
      { cardId: "card04", front: "What should you add when a skill does not have golf-or-chess feedback?", back: "Add sampling, varied cases, and reflection on fit before re-specializing, so practice does not harden around the wrong lesson.", difficulty: "medium" },
    ],
  },
  "range-ch02": {
    fastRead: `In Luria's fieldwork, a villager groups a saw with wood because that is how life uses them; a schooled observer groups the saw with tools.

Flynn's clue is that modern people became more practiced at seeing context-free patterns. Raven's matrices reward relationship hunting when no familiar object or trade tells you what to do.

That shift is not proof that older practical worlds were foolish. It shows that schooling, markets, bureaucracy, and science trained different habits for different problems.

Take one current problem and sort it twice: first by immediate use, then by hidden relation or category. Notice which sort opens more options.`,
    fullRead: `Alexander Luria's Central Asian villagers were not failing intelligence tests in the simple sense. They were reasoning inside a world where practical relations mattered. A saw belonged with wood because that pairing did work. A taxonomic category such as "tool" was less useful than the concrete arrangement that everyday life demanded.

James Flynn's rising IQ data points to a historical change in mental habits. The largest gains appeared on tasks like Raven's Progressive Matrices, where people infer abstract relationships without relying on school vocabulary. Modern institutions made that kind of reasoning more common: classify, compare, generalize, and carry a pattern into a new setting.

The change came with a tradeoff. Practical worlds cultivate fine local distinctions that abstract thinkers can miss. Modern wicked worlds ask for another move as well: step back from familiar use, name the invisible relation, and transfer it. A problem in one field may need the category or pattern that another field already knows.

This is not a sneer at the unschooled past. It is an ecological argument. Different environments train different minds. As work becomes less routine and feedback less direct, abstraction becomes a survival skill, especially when concrete experience alone keeps solving yesterday's problem.`,
    implementationPlan: {
      title: "Concrete-to-Abstract Reframe",
      coreSkill: "Move a problem from local use to transferable structure by classifying what is concrete, what is abstract, and which hidden relation can travel.",
      ifThenPlans: [
        { context: "When a problem feels too local", plan: "If I keep describing only the familiar objects and people, then I will rewrite the problem using categories, relations, and constraints." },
        { context: "When the team sorts by habit", plan: "If everyone groups options by immediate use, then I will ask for a second grouping by underlying pattern." },
        { context: "When abstraction floats away from reality", plan: "If the conceptual frame gets vague, then I will tie it back to one concrete test or example before acting." },
      ],
      twentyFourHourChallenge: "Choose one stuck problem. Write a concrete description, then an abstract version that names the relation, pattern, or category underneath.",
      weeklyPractice: "This week, practice a two-sort review on three decisions: sort once by practical use and once by hidden structure, then compare the options each sort reveals.",
    },
    reviewCards: [
      { cardId: "card01", front: "What did Flynn's rising IQ data suggest had changed across generations?", back: "The gains suggested a shift in practiced reasoning habits, especially comfort with abstract pattern problems, not a sudden biological leap in intelligence.", difficulty: "easy" },
      { cardId: "card02", front: "What is the difference between concrete and abstract sorting?", back: "Concrete sorting groups things by immediate use or lived context; abstract sorting groups by category, relation, pattern, or rule that can travel across contexts.", difficulty: "medium" },
      { cardId: "card03", front: "Why do wicked problems reward abstract reasoning?", back: "Wicked problems often hide their rules and appear in unfamiliar settings, so the useful move is to recognize a transferable structure rather than repeat a local routine.", difficulty: "hard" },
      { cardId: "card04", front: "What caution keeps abstraction from becoming arrogance?", back: "Abstract reasoning should not dismiss local knowledge; it should add a portable frame while still checking concrete details and practical constraints.", difficulty: "medium" },
    ],
  },
  "range-ch03": {
    fastRead: `In a Venetian music school, a girl shifts from violin to viola to continuo, and the ensemble gets stronger because she hears more than one part.

Less of the same does not mean less seriousness. It means a richer skill diet before a person narrows again with better judgment and more connections.

The Ospedale della Pieta, Vivaldi's setting, and Django Reinhardt all complicate the idea that one straight track creates the best artistry.

Audit one skill diet: what are you over-repeating, what adjacent role could you sample, and when will you re-specialize with what you learned?`,
    fullRead: `The figlie del coro at the Ospedale della Pieta were not trained by protecting each child inside a single narrow lane. The institution needed flexible musicians, and Antonio Vivaldi's world rewarded performers who understood the ensemble from several seats. Rotation did not weaken seriousness; it gave practice more angles.

That is the challenge to the fear that breadth dilutes mastery. Variety can look inefficient in the short run because it interrupts the clean progress of one repeated drill. Over time, it can build musicians who hear relationships, adapt to missing parts, and specialize with a wider map of the craft.

Django Reinhardt supplies the same idea from another direction. His injured hand did not make practice irrelevant. It forced a nonstandard route, and the constraint became part of his sound. A varied or disrupted path can generate technique that a straight path would never have discovered.

The point is not that intensity is unnecessary. It is that the content of practice matters. Sampling roles, instruments, styles, and constraints can prepare a person to re-specialize with better perception. Less of the same can become more of the skill that actually matters.`,
    implementationPlan: {
      title: "Skill-Diet Breadth Audit",
      coreSkill: "Improve a skill by spotting over-narrow practice, adding purposeful sampling, and then re-specializing with better information.",
      ifThenPlans: [
        { context: "When practice feels repetitive but shallow", plan: "If I am drilling the same move without new perception, then I will add one adjacent role, style, or constraint for a short cycle." },
        { context: "When breadth feels like drifting", plan: "If sampling starts to become avoidance, then I will define what each variation is supposed to teach before trying it." },
        { context: "When it is time to narrow again", plan: "If the sampling cycle reveals a better fit or missing skill, then I will re-specialize around that evidence." },
      ],
      twentyFourHourChallenge: "List your current skill diet. Mark what is repeated too often, then add one adjacent practice that teaches a different view of the same craft.",
      weeklyPractice: "This week, run a sampling block before a specialization block: rotate one role, constraint, or style, then write what changed about your main practice.",
    },
    reviewCards: [
      { cardId: "card01", front: "How did the Ospedale della Pieta make breadth part of serious musical training?", back: "Its performers learned across instruments and ensemble roles, so variety strengthened their ability to hear, adapt, and perform inside the whole musical system.", difficulty: "easy" },
      { cardId: "card02", front: "What is a skill diet?", back: "A skill diet is the mix of drills, roles, examples, constraints, and contexts that shape what a learner notices and can transfer.", difficulty: "medium" },
      { cardId: "card03", front: "When does sampling help rather than distract?", back: "Sampling helps when each variation teaches a relevant contrast, exposes fit, or builds perception that the main narrow drill cannot provide.", difficulty: "hard" },
      { cardId: "card04", front: "Why should breadth often be followed by re-specialization?", back: "Breadth gathers information and connections; re-specialization turns that information into focused improvement instead of endless dabbling.", difficulty: "medium" },
    ],
  },
  "range-ch04": {
    fastRead: `A student reaches for a formula, the teacher pauses, and the room has to compare two solution paths before anyone rescues them with the next step.

Learning that feels fast can be fragile. Smooth hints, blocked drills, and popular instruction often produce better feelings than later transfer.

Desirable difficulty works when it is tied to retrieval, spacing, generation, discrimination, or explanation. Random confusion is just confusion.

Build one drill that makes you generate before being told, mixes problem types, and returns after a delay.`,
    fullRead: `The trap is the lesson that feels smooth. Lindsey Richland's classroom research shows how a promising comparison question can collapse into procedural rescue when students hesitate and the teacher supplies the next step too quickly. Everyone feels helped, but the deeper link may never be built.

The Air Force Academy evidence sharpens the discomfort. Students can prefer instructors who make a course feel easier while later performance reveals that the demanding course taught more. The learner's immediate experience is real, but it is not always the best measure of durable learning.

Blocked practice creates the same illusion. When every problem uses the just-demonstrated method, speed rises because the learner already knows what kind of problem it is. Interleaving forces the harder act: diagnose the problem type, choose a strategy, and retrieve the method after interference. That difficulty trains transfer.

This is not a defense of bad teaching. Difficulty helps only when it does cognitive work: retrieval, spacing, generation, discrimination, or explanation. The craft is to design struggle that points at the skill you want, not to romanticize frustration.`,
    implementationPlan: {
      title: "Desirable-Difficulty Drill Builder",
      coreSkill: "Design practice that feels slower now because it strengthens later retrieval, discrimination, spacing, and transfer.",
      ifThenPlans: [
        { context: "When practice feels too smooth", plan: "If I can solve every item because the method is obvious, then I will mix problem types so I must choose the strategy first." },
        { context: "When I want to explain immediately", plan: "If I am about to give or request the answer, then I will first generate a guess, comparison, or explanation attempt." },
        { context: "When difficulty becomes noise", plan: "If the struggle is not tied to retrieval, spacing, generation, or discrimination, then I will redesign it instead of praising the pain." },
      ],
      twentyFourHourChallenge: "Convert one easy drill into a desirable-difficulty drill: space it, mix item types, and require a generated answer before checking.",
      weeklyPractice: "This week, replace one blocked practice session with interleaving and one immediate review with delayed retrieval; compare later performance, not just comfort.",
    },
    reviewCards: [
      { cardId: "card01", front: "What did Richland's math-classroom research warn about?", back: "Promising comparison questions can become shallow hint routines when teachers rescue students before they do the conceptual work.", difficulty: "easy" },
      { cardId: "card02", front: "What makes a difficulty desirable?", back: "It is desirable when it forces useful cognitive work such as retrieval, spacing, generation, explanation, or discriminating among problem types.", difficulty: "medium" },
      { cardId: "card03", front: "Why can blocked practice flatter learning?", back: "Blocked practice tells learners which method to use before they have to diagnose the problem, so fluency can rise while transfer stays weak.", difficulty: "hard" },
      { cardId: "card04", front: "How should you judge a hard learning experience?", back: "Judge it by later mastery and transfer, while checking that the struggle is purposeful rather than random frustration or poor instruction.", difficulty: "medium" },
    ],
  },
  "range-ch05": {
    fastRead: `Late in the lab, Ravi's sensor data refuses the usual electrical model, so he asks the team what invisible influence it resembles: current, magnetism, scent, pressure.

Kepler used analogies because direct evidence was not enough. Good analogy drops surface detail and maps relations carefully.

The radiation-and-fortress problem shows the same move: the story helps only when force, path, convergence, and damage are mapped back to the real case.

Choose one stuck problem, write three distant analogies, map the relation in each, and discard the ones that only sound clever.`,
    fullRead: `Johannes Kepler was not using analogy as decoration. He faced astronomical problems that exceeded the evidence and explanations available to him, so he borrowed relational patterns from light, magnetism, currents, and other phenomena to reason about invisible influence.

That kind of analogy is demanding. It asks what corresponds to what, which relationships transfer, and which surface features should be ignored. The radiation-and-fortress problem makes the method visible: a military story about dividing forces only helps the medical problem when the deep structure is mapped back to radiation paths, concentrated force, and damage limits.

Kevin Dunbar's observations of molecular biology labs show why diverse groups have more resources when experiments surprise them. A failed assay can remain a local failure, or it can become a comparison problem: what else behaves like this? Outsiders and varied backgrounds widen the stock of possible relations.

The shallow version of the lesson is to brainstorm metaphors. The stronger version is to test analogies. A useful analogy travels because the relation fits, not because the image is charming. When experience has no ready pattern, careful comparison can create one.`,
    implementationPlan: {
      title: "Analogy-Transfer Protocol",
      coreSkill: "Use analogy by mapping relationships, testing fit, dropping surface detail, and keeping only what transfers to the target problem.",
      ifThenPlans: [
        { context: "When a metaphor sounds exciting", plan: "If an analogy grabs the room, then I will map the source, target, shared relation, and non-transferable details before using it." },
        { context: "When experience has no answer", plan: "If the familiar model fails, then I will ask which distant domains handle the same relationship or constraint." },
        { context: "When an analogy starts driving too much", plan: "If the comparison hides a crucial difference, then I will revise or drop it rather than force the fit." },
      ],
      twentyFourHourChallenge: "Pick one stuck problem. Generate three analogies, map the shared relation for each, and choose one small test that would reveal whether the best analogy transfers.",
      weeklyPractice: "This week, run one analogy review before a decision: name the relation, the mismatch, and the evidence that would make you abandon the comparison.",
    },
    reviewCards: [
      { cardId: "card01", front: "How did Kepler use analogy to reason beyond direct evidence?", back: "Kepler compared planetary motion with other forms of invisible influence so he could reason about relationships that available evidence did not yet explain.", difficulty: "easy" },
      { cardId: "card02", front: "What makes an analogy useful rather than merely clever?", back: "A useful analogy maps a deep relation between source and target, identifies limits, and suggests a testable move in the real problem.", difficulty: "medium" },
      { cardId: "card03", front: "What does local jargon often hide from analogy?", back: "Jargon can hide the transferable structure of a problem: forces, flows, incentives, constraints, timing, or feedback loops that another field already understands.", difficulty: "hard" },
      { cardId: "card04", front: "When should you drop an analogy?", back: "Drop it when the shared relation is weak, the mismatch affects the decision, or the comparison creates confidence without a test.", difficulty: "medium" },
    ],
  },
  "range-ch06": {
    fastRead: `A counselor looks at Van Gogh's long trail of abandoned roles and sees search information, not a simple failure of will.

Grit is a virtue after match quality has been tested. Before that, persistence can trap a person in the wrong arena.

Malamud's education comparison and West Point retention both point to the same distinction: endurance does not solve a fit problem by itself.

Name one hard thing you are enduring. Ask whether the difficulty is growth, bad fit, sunk cost, or fear of shame.`,
    fullRead: `Vincent van Gogh's path is emotionally useful because it is messy. Art dealer, teacher, bookseller, religious aspirant, preacher, painter: the sequence can look like failure if every departure is treated as weakness. It looks different if each role produced information about match quality.

Ofer Malamud's comparison of England, Wales, and Scotland gives the institutional version. Later specialization can allow students to learn more about fit before committing, and that exploration can improve the eventual match. The question is not whether commitment matters. It is when commitment becomes informed enough to deserve grit.

West Point and Army retention complicate the heroic version of persistence. A grit scale can predict who endures an initial ordeal, but assignment frustration and later exits show that endurance alone does not answer whether the work fits the person and the institution.

The discipline is to separate valuable difficulty from bad-fit difficulty. Some hard seasons build capacity. Others mainly reveal that the arena is wrong. Switching can be avoidance, but it can also be the mature act of using evidence rather than worshiping sunk cost.`,
    implementationPlan: {
      title: "Match-Quality Check",
      coreSkill: "Distinguish disciplined switching from quitting by testing whether difficulty reflects growth, bad fit, sunk cost, or missing information.",
      ifThenPlans: [
        { context: "When shame says stay", plan: "If I want to persist mainly to avoid looking like a quitter, then I will list the fit evidence before recommitting." },
        { context: "When discomfort says leave", plan: "If I want to switch because the work is hard, then I will ask whether the difficulty is teaching valued skill or exposing poor match." },
        { context: "When sunk cost speaks loudly", plan: "If past investment is the strongest reason to continue, then I will run a small alternative test before adding more investment." },
      ],
      twentyFourHourChallenge: "Choose one commitment under strain. Sort the evidence into growth difficulty, bad-fit difficulty, sunk cost, and fear of shame; then choose the next test.",
      weeklyPractice: "This week, schedule one match-quality review before a major persistence decision and define what evidence would justify staying or switching.",
    },
    reviewCards: [
      { cardId: "card01", front: "How did Van Gogh's career changes complicate the idea of quitting?", back: "His repeated departures can be read as search for match quality, showing that switching roles may produce information rather than merely reveal weak persistence.", difficulty: "easy" },
      { cardId: "card02", front: "When is grit most useful?", back: "Grit is most useful after enough exploration has shown that the arena fits the person and the difficulty is worth enduring.", difficulty: "medium" },
      { cardId: "card03", front: "How can you tell disciplined switching from avoidance?", back: "Disciplined switching responds to evidence about fit, values, and learning; avoidance responds mainly to discomfort without testing whether the challenge is valuable.", difficulty: "hard" },
      { cardId: "card04", front: "Why does sunk cost distort match-quality decisions?", back: "Sunk cost makes past investment feel like proof that staying is wise, even when current evidence says the match is weak.", difficulty: "medium" },
    ],
  },
  "range-ch07": {
    fastRead: `Frances Hesselbein does not begin with a polished leadership destiny; she steps through a volunteer door and discovers a possible self in action.

Identity is not only found by introspection. It is prototyped through small tests, new networks, and feedback from real work.

The Dark Horse Project, Ibarra's identity work, Darwin's detours, and end-of-history bias all warn against treating today's self as final.

Design one low-cost identity experiment, choose the review date, and write what evidence would make the possible self more or less real.`,
    fullRead: `Frances Hesselbein's leadership life did not unfold from a childhood master plan. A volunteer role became a doorway, and action revealed capacities that planning alone could not have named. That is why Epstein treats identity as something to test, not just something to declare.

Herminia Ibarra's work on possible selves gives the practical mechanism. People try provisional identities, meet different networks, and learn from the friction between imagined self and lived experience. The Dark Horse Project found fulfilled unconventional careers built through local experiments and personal fit rather than one universal ladder.

Darwin's later scientific path also resists clean backward planning. Detours, curiosity, and changing circumstances mattered. The end-of-history illusion explains why this is hard: people can see how much they have changed in the past while underestimating how much they will change next.

Plans still matter, but they should behave like hypotheses. A possible self needs a cheap trial, real feedback, and a review date. Action tests identity more honestly than endless private certainty.`,
    implementationPlan: {
      title: "Possible-Self Experiment",
      coreSkill: "Test identity with small, reversible actions that produce real feedback before turning a possible self into a plan.",
      ifThenPlans: [
        { context: "When I feel stuck choosing a future", plan: "If introspection loops without new evidence, then I will design a one-week experiment that lets me act as one possible self." },
        { context: "When a plan feels too certain", plan: "If I start treating a career story as destiny, then I will write what evidence could change it." },
        { context: "When an experiment ends", plan: "If the trial is complete, then I will review energy, skill, fit, and feedback before deciding the next step." },
      ],
      twentyFourHourChallenge: "Pick one possible self and design a low-cost experiment: action, cost limit, feedback source, and review date.",
      weeklyPractice: "This week, run one identity experiment and record what felt energizing, what felt false, and what evidence deserves a second trial.",
    },
    reviewCards: [
      { cardId: "card01", front: "How did Frances Hesselbein's path show identity emerging through action?", back: "A volunteer opportunity let her discover leadership capacity through real responsibility rather than through a fully formed ambition story.", difficulty: "easy" },
      { cardId: "card02", front: "What is a possible-self experiment?", back: "It is a small, reversible action that lets you try an identity in the world and gather evidence about fit, energy, skill, and feedback.", difficulty: "medium" },
      { cardId: "card03", front: "Why are plans better treated as hypotheses?", back: "People and worlds keep changing, so a plan should invite tests and updates instead of pretending the present self can perfectly predict the future self.", difficulty: "hard" },
      { cardId: "card04", front: "What should you review after an identity experiment?", back: "Review what you learned about energy, competence, values, social context, and what evidence would justify another trial.", difficulty: "medium" },
    ],
  },
  "range-ch08": {
    fastRead: `In a pharmaceutical lab, senior chemists stare at the same purification problem until Dana strips away the company language and writes what physically has to happen.

That is when the problem can travel. An outsider in a distant field may recognize the structure: a coating, mechanics, dentistry, materials, or flow problem hiding inside chemistry jargon.

Outsiders do not replace insiders. They help when insiders frame the problem clearly enough for different expertise to enter without losing local judgment.

Rewrite one stuck problem without local jargon, name the function and constraints, then list three distant fields that already solve that shape.`,
    fullRead: `Dana's lab has reviewed the purification problem three times, and every meeting has become more fluent in the same local language. The senior chemists know the equipment, the compounds, and the embarrassment risk of letting a hard problem leave the company. What they no longer know is how the problem sounds to someone who has never worked inside their walls.

Alph Bingham's work at Eli Lilly challenged the assumption that proprietary specialists should solve every hard chemistry problem internally. The point was not that outsiders were wiser than chemists. It was that some stalled problems needed to be translated into a form that could travel. Innocentive made that translation operational by broadcasting carefully framed challenges to a wide pool of solvers whose backgrounds often looked irrelevant on paper.

Karim Lakhani's research on solver distance explains why this can work. A solver far from the sponsor's home domain may be close to a different domain that contains the needed tool. A chemistry obstacle might look like a materials problem, a dentistry problem, a mechanics problem, or a coating problem once stripped to its functional shape. The Einstellung effect explains the inside risk: experts can keep reaching for familiar methods even when a better route is available.

So Dana rewrites the challenge. She removes company acronyms, names the physical behavior that must change, preserves the cost and safety constraints, and asks which distant fields already solve that shape. The posted version does not dump confusion on a crowd; it gives outsiders a clean structure and keeps insiders responsible for judgment. When a solver recognizes the problem as familiar from another field, the lab has something testable instead of another internal review.

The simplistic takeaway is that outsiders are smarter than experts. The real claim is interactional: insiders know the local details, outsiders bring different search tools, and careful framing is the bridge between them.`,
    implementationPlan: {
      title: "Outside-In Problem Frame",
      coreSkill: "Turn a stuck insider problem into a framed challenge that can travel to distant expertise while preserving local judgment.",
      ifThenPlans: [
        { context: "When a stuck problem is buried in local language", plan: "If the description depends on company or field jargon, then I will rewrite it in plain functional terms before asking for help." },
        { context: "When insiders have tried the same path twice", plan: "If the same expert move keeps returning, then I will name the function and search for distant fields that solve that shape." },
        { context: "When an outsider idea sounds promising", plan: "If a distant analogy appears, then I will test whether it fits the constraints before letting enthusiasm outrun insider judgment." },
      ],
      twentyFourHourChallenge: `Apply the Outside-In Problem Frame to one stuck problem:
1. Strip jargon - How would I describe the problem with no company- or field-specific terms?
2. Name the function - What physical, behavioral, or logical thing must happen?
3. Name constraints - What must stay true: cost, safety, speed, material, scale?
4. Search distant fields - Which fields already solve this shape?
5. Test translation - What outsider idea can we try without losing insider judgment?`,
      weeklyPractice: "This week, choose one stalled problem and run a thirty-minute outside-in review with at least one person from a distant field; end with one small translation test.",
    },
    reviewCards: [
      { cardId: "card01", front: "Why did Bingham's Eli Lilly experiment challenge the insiders-only assumption?", back: "It showed that carefully framed research problems could sometimes be solved by people outside the firm after internal experts had exhausted familiar approaches.", difficulty: "easy" },
      { cardId: "card02", front: "Why must a problem travel to benefit from outsiders?", back: "A problem travels when it is stripped of local jargon and framed by function and constraints, so distant solvers can recognize a structure their own field already knows.", difficulty: "medium" },
      { cardId: "card03", front: "What does local jargon hide?", back: "Local jargon can hide the transferable shape of a problem: the physical, behavioral, or logical function that another field may already solve.", difficulty: "medium" },
      { cardId: "card04", front: "What is a distant analogy, and when does it help?", back: "A distant analogy borrows a matching structure from another field. It helps when the relation fits the constraints and insiders still test it against local reality.", difficulty: "hard" },
    ],
    examples: {
      ex01: {
        tags: ["outside-in", "pharma", "problem-framing"],
        scenario: "Dana works inside a pharmaceutical lab with a purification problem that has resisted three internal reviews. At a 10:00 a.m. research council, senior chemists worry that posting the challenge beyond the company will make the lab look stuck. Dana rewrites the problem without company acronyms, names the physical separation that has to happen, and preserves the safety constraints before proposing a limited outside posting.",
        whatToDo: "Dana posts the reframed challenge only after insiders agree on function, constraints, and review criteria. When an outside solver recognizes a related materials problem, the lab tests the suggestion without surrendering judgment.",
        whyItMatters: "Outside-in thinking works when the problem can travel. The bridge is disciplined translation, not blind faith in outsiders.",
      },
    },
  },
  "range-ch09": {
    fastRead: `At a prototype bench, Rina pushes aside an expensive new sensor and picks up a cheap calculator display that already survives rough handling.

Gunpei Yokoi saw mature parts as design material, not leftovers. Old technology can become fresh when cost, reliability, and user need line up.

The candle problem and 3M's broad integrators point to the same habit: stop seeing an object only as its usual label.

List three boring tools near your problem. For each, write one new job it could do if freed from its default use.`,
    fullRead: `Gunpei Yokoi's Nintendo philosophy began with respect for technology that no longer looked glamorous. Cheap, familiar components could become playful products because their limits were known, their costs were low, and designers could build around users instead of around novelty.

That is not nostalgia. The candle problem shows how functional fixedness blocks people from seeing a box as a platform rather than merely a container. Yokoi's strength was similar: look at a calculator display, a simple control, or an old part and ask what new job it can do when removed from its usual label.

Andy Ouderkirk's work at 3M adds the organizational version. On uncertain innovation projects, broad connectors can matter because they know enough across adhesives, packaging, displays, and medical materials to import a proven-but-underused tool. They are not shallow generalists; they are translators among mature possibilities.

The lazy takeaway is that old technology is better. The useful lesson is strategic fit. A withered technology helps when reliability, price, availability, trust, or user context make it the right material for a new combination.`,
    implementationPlan: {
      title: "Withered-Technology Reuse Scan",
      coreSkill: "Find mature, cheap, reliable tools whose proven properties can be recombined for a new user need.",
      ifThenPlans: [
        { context: "When novelty becomes the default", plan: "If the team reaches first for a new technology, then I will list mature tools that already meet the key constraint." },
        { context: "When an object has one obvious label", plan: "If I see a tool only by its usual use, then I will name its properties and ask what other job those properties could do." },
        { context: "When old tech looks too humble", plan: "If a proven tool seems unimpressive, then I will test whether cost, reliability, or familiarity makes it strategically stronger." },
      ],
      twentyFourHourChallenge: "Inventory five boring tools or components near your problem. For each, list properties, current use, and one new job it could perform.",
      weeklyPractice: "This week, prototype one solution with a mature or underused tool before buying or inventing a new one.",
    },
    reviewCards: [
      { cardId: "card01", front: "How did Yokoi's Nintendo philosophy treat mature components?", back: "It treated cheap, familiar, reliable parts as design advantages when they could be recombined around a real user need.", difficulty: "easy" },
      { cardId: "card02", front: "What is functional fixedness?", back: "Functional fixedness is the habit of seeing an object only through its usual label, which can hide other useful properties or roles.", difficulty: "medium" },
      { cardId: "card03", front: "When is old technology strategically useful?", back: "Old technology helps when its low cost, reliability, availability, trust, or known limits fit the problem better than a novel alternative.", difficulty: "hard" },
      { cardId: "card04", front: "What should you list before repurposing a tool?", back: "List the tool's properties, constraints, proven contexts, costs, and the new function those properties might serve.", difficulty: "medium" },
    ],
  },
  "range-ch10": {
    fastRead: `On a forecasting call, Beth lowers her probability in public after a teammate shows new trade data, and the room treats the update as progress rather than defeat.

Expertise can become brittle when it fuses with identity and one grand theory. Tetlock found that fox-like habits beat confident hedgehog certainty.

The Ehrlich-Simon bet is a warning about proxies: one clean wager can answer a narrow question without settling the whole debate.

Track one prediction this week with probability, time horizon, outside view, update rule, and what would change your mind.`,
    fullRead: `Prediction is where expertise can sound most impressive and fail most visibly. Paul Ehrlich and Julian Simon stood on opposite sides of population anxiety and resource optimism, and their famous metals bet created a clean result. But a proxy can be narrow: winning a wager about selected commodity prices over a period does not settle every ecological, technological, or resource question.

Philip Tetlock's expert prediction research explains why confidence is not enough. Some credentialed experts become hedgehogs, organizing the world through one big explanatory idea and defending it as identity. Others behave more like foxes: they update, use many small models, state probabilities, and let evidence weaken their favorite view.

The Good Judgment Project turns that temperament into practice. Forecasts improve when people track predictions, invite outside views, break questions into parts, and revise probabilities without treating revision as humiliation. Accuracy depends less on status than on habits of calibration.

The claim is not that expertise is useless. Prediction punishes expertise that refuses feedback. The disciplined expert keeps records, makes uncertainty explicit, and welcomes the evidence that would make a confident story smaller.`,
    implementationPlan: {
      title: "Forecasting Hygiene Check",
      coreSkill: "Make predictions accountable by tracking probabilities, time horizons, outside views, updates, and evidence that would change your mind.",
      ifThenPlans: [
        { context: "When I make a confident prediction", plan: "If I feel certain, then I will write a probability, time horizon, and what evidence would lower my confidence." },
        { context: "When a proxy settles the room", plan: "If one metric or wager seems decisive, then I will ask which question it actually answers and which questions remain open." },
        { context: "When updating feels embarrassing", plan: "If new evidence changes the odds, then I will revise the forecast publicly and record why." },
      ],
      twentyFourHourChallenge: "Write one live prediction with probability, deadline, outside-view comparison, and an update trigger.",
      weeklyPractice: "This week, keep a forecast log for three decisions; review which estimates changed and whether you updated like a fox or defended like a hedgehog.",
    },
    reviewCards: [
      { cardId: "card01", front: "What did Tetlock's expert prediction research reveal about confident expertise?", back: "It found that credentials and confidence did not guarantee accuracy; forecasters improved when they updated, used multiple models, and treated uncertainty explicitly.", difficulty: "easy" },
      { cardId: "card02", front: "Why can a proxy mislead a forecast?", back: "A proxy can answer a narrow measurable question while being mistaken for proof about a larger, messier issue.", difficulty: "medium" },
      { cardId: "card03", front: "What is forecasting hygiene?", back: "Forecasting hygiene means recording probabilities, time horizons, evidence, outside views, and updates so prediction becomes accountable rather than rhetorical.", difficulty: "hard" },
      { cardId: "card04", front: "How does a fox-like forecaster behave?", back: "A fox-like forecaster uses several models, updates with new evidence, breaks questions apart, and treats revision as accuracy work rather than defeat.", difficulty: "medium" },
    ],
  },
  "range-ch11": {
    fastRead: `In a case classroom, Julia sees the sponsorship payoff circled in red and realizes no one has asked for the missing temperature data.

Familiar tools are hardest to drop when they once proved competence: a payoff table, a launch norm, a checklist, a fire tool, a green dashboard.

Carter Racing, Challenger, Mann Gulch, Storm King, and Weick all ask the same question: what assumption has changed, and what must be released now?

Name one tool you would hate to drop under pressure. Write the cue that tells you it has crossed from useful to harmful.`,
    fullRead: `The Carter Racing case begins with a familiar managerial temptation: calculate the visible upside, weigh the known failures, and make a decision. Many students race because the sponsorship payoff is vivid and the available failure data feels sufficient. The missing move is to ask for nonfailure temperature data, the comparison that would reveal whether the dataset can answer the risk question.

That hidden structure maps onto the Challenger launch decision. O-ring concerns existed, but NASA's quantitative culture made evidence harder to hear when it did not arrive in the preferred form. Diane Vaughan's work on normalization of deviance shows how previous survival can become false reassurance; danger starts to look routine because catastrophe has not yet happened.

Mann Gulch and Storm King Mountain turn the metaphor physical. Firefighters carried tools that represented competence and identity, even when dropping weight could aid escape. Karl Weick's sensemaking frame emphasizes that leaders must update the meaning of a situation, not merely defend the tool that once made sense.

The lesson is not to throw away procedure. Procedures, metrics, and tools are vital while their assumptions hold. Adaptation begins when someone notices the boundary: the old tool is now hiding missing data, blocking an anomaly, slowing escape, or preserving identity at the expense of reality.`,
    implementationPlan: {
      title: "Drop-the-Tool Cue",
      coreSkill: "Recognize when a familiar tool, metric, procedure, or identity cue has crossed from helpful to harmful under changed conditions.",
      ifThenPlans: [
        { context: "When my usual tool feels reassuring", plan: "If the tool gives comfort under pressure, then I will ask which assumption must be true for it to still fit." },
        { context: "When evidence arrives in an unfamiliar form", plan: "If a warning does not fit my preferred metric, then I will translate it before dismissing it." },
        { context: "When dropping the tool feels like losing competence", plan: "If abandoning a method feels shameful, then I will name the survival or learning cue that outranks identity." },
      ],
      twentyFourHourChallenge: "Name one tool, metric, or procedure you would resist dropping. Write the conditions that make it useful and the cue that means it must be demoted.",
      weeklyPractice: "This week, run one assumption check on a trusted dashboard, checklist, or routine; add a visible cue for when the tool should become a clue rather than a verdict.",
    },
    reviewCards: [
      { cardId: "card01", front: "What missing evidence did Carter Racing decision makers often fail to seek?", back: "They often failed to ask for nonfailure temperature data, the comparison needed to judge whether cold conditions predicted engine risk.", difficulty: "easy" },
      { cardId: "card02", front: "When does a familiar tool become dangerous?", back: "A tool becomes dangerous when the conditions that made it useful have changed and the tool now hides anomalies, missing data, or urgent adaptation.", difficulty: "medium" },
      { cardId: "card03", front: "Why are tools hard to drop under pressure?", back: "Tools can become tied to competence, role, and identity, so releasing them can feel like abandoning the self rather than adapting to reality.", difficulty: "hard" },
      { cardId: "card04", front: "What cue should trigger a drop-the-tool review?", back: "Use a cue such as missing comparison data, warnings outside the normal metric, changed assumptions, or the tool slowing response in a live situation.", difficulty: "medium" },
    ],
  },
  "range-ch12": {
    fastRead: `On a quiet Saturday bench, Oliver Smithies plays with starch gels inside a serious scientific career and leaves enough trace for the surprise to be tested.

Deliberate amateurism is disciplined play. Expertise supplies the testing skill; beginner mode supplies questions insiders stopped asking.

Smithies, Geim, Tu Youyou, and Casadevall all reject sealed specialization, but none of them excuse sloppy proof.

Protect one small play block inside serious work, choose the boundary, and write the rule for testing anything it produces.`,
    fullRead: `Oliver Smithies protected informal Saturday experiments not because rigor bored him, but because serious work needed room for unscripted contact with materials. His tinkering with starch gels helped produce electrophoresis techniques and showed how play can matter when skilled hands notice a surprise and test it.

Andre Geim's Friday night experiments made a similar space inside physics. The famous oddities, from frog levitation to adhesive-tape work that helped isolate graphene with Konstantin Novoselov, were not a claim that whimsy beats evidence. They were a practice of asking cheap, bounded questions before outcomes were obvious.

Tu Youyou adds another form of deliberate amateurism: crossing time and prestige boundaries. She searched classical Chinese medical sources for malaria leads, noticed an extraction clue, changed the method, and then tested systematically. Arturo Casadevall supplies the institutional warning that narrow training can weaken broad judgment about rigor, fraud, and creative possibility.

The soft misreading is that amateur enthusiasm alone produces breakthroughs. The stronger claim is depth plus deliberate re-entry into beginner mode. Stay skilled enough to test. Stay humble enough to play. Leave room for adjacent questions, then let evidence answer.`,
    implementationPlan: {
      title: "Protected Play Test",
      coreSkill: "Schedule bounded exploratory play inside serious work and define how any surprise will be documented, tested, and judged.",
      ifThenPlans: [
        { context: "When serious work leaves no room to explore", plan: "If every hour is tied to immediate output, then I will reserve a small bounded block for adjacent questions." },
        { context: "When play becomes sloppy", plan: "If an experiment is playful, then I will still define the safety, documentation, and test rule before starting." },
        { context: "When a strange result appears", plan: "If play produces a surprise, then I will write the next evidence test before declaring it useful." },
      ],
      twentyFourHourChallenge: "Schedule one protected play block. Define the question, limit, materials, documentation rule, and test that would make the result worth continuing.",
      weeklyPractice: "This week, run one bounded amateur experiment inside your serious work and review whether it produced a testable lead, not just an entertaining detour.",
    },
    reviewCards: [
      { cardId: "card01", front: "What did Smithies's Saturday experiments protect inside serious science?", back: "They protected playful, informal exploration with materials while still relying on expert judgment to notice and test useful surprises.", difficulty: "easy" },
      { cardId: "card02", front: "What makes deliberate amateurism disciplined?", back: "It combines beginner-like curiosity with boundaries, documentation, safety, and evidence tests, so play remains answerable to proof.", difficulty: "medium" },
      { cardId: "card03", front: "Why can expertise benefit from re-entering beginner mode?", back: "Beginner mode lets experts ask questions their routines may have stopped asking, while expertise keeps the exploration from becoming sloppy.", difficulty: "hard" },
      { cardId: "card04", front: "What should a protected play block include?", back: "It should include a bounded question, low cost, safety limits, documentation, and a rule for deciding whether the result deserves another test.", difficulty: "medium" },
    ],
  },
};

const fullReadAddenda = {
  "range-ch01": `A reader can use the distinction immediately. Put the desired skill on one side of the page and write what feedback looks like. Does the learner see the result today or months later? Is the result honestly tied to the action, or tangled with luck, politics, timing, and other people? Do the rules repeat, or does each setting teach a new trick? Those questions decide whether the Tiger Woods template is a useful model or a seductive mismatch.

That is why the Polgar example belongs in the argument without ruling every learning decision. It gives the strongest case for early focus, then asks where that case stops. If the environment behaves like chess, narrow deliberate practice can compound beautifully. If the environment behaves like a market, a lab, a classroom, or a career, breadth may be the safer first move because it exposes the learner to different feedback systems before one path becomes too emotionally expensive to question.

The practice is therefore diagnostic. Do not ask only, "How soon can we start?" Ask, "What kind of world will this practice prepare us for?" A head start is valuable when it points down the right track. Range begins with the humility to check the track before celebrating the speed.`,
  "range-ch02": `The practical exercise is to move back and forth between those habits instead of idolizing either one. A nurse doing a handoff needs concrete local knowledge: this patient, this medication, this odd symptom. A policy designer may need the abstract relation underneath: bottlenecks, incentives, classification errors, or delayed feedback. The modern skill is knowing when to climb up a level and when to come back down.

Flynn, Raven, and Luria also protect the reader from a lazy progress story. Abstraction can travel, but it can also become thin. Concrete knowledge can be narrow, but it can also be exquisitely accurate. Wicked problems often require both: the local facts that keep a plan honest and the conceptual frame that lets a person see why a problem in one setting resembles a problem somewhere else.

So a useful reframe does not erase the village, the workshop, or the clinic. It asks what the local pairing teaches and what larger category might release new options. When a task stops presenting familiar materials beside familiar tools, the person who can name the hidden relation has more room to move.`,
  "range-ch03": `A reader can treat this as a practice audit rather than a music anecdote. If every hour goes into the same drill, ask what the drill is failing to teach. Does the violinist understand harmony? Does the designer understand the user's constraint? Does the support rep understand the sales promise that created the complaint? Rotating through adjacent roles can make the main role sharper because it changes what the learner hears.

The boundary matters. Sampling is not a permanent refusal to commit. The figlie were not casual dabblers, and Reinhardt was not rescued by accident alone. Their breadth and constraint fed disciplined craft. A good sampling block has a purpose: reveal fit, expose blind spots, build contrast, or import a technique that the main lane never supplied.

After that, re-specialization matters. The learner returns to the instrument, the product, the role, or the medium with a richer ear. Less of the same becomes more when it changes the quality of attention.`,
  "range-ch04": `A reader can build this into any practice session. First, delay the answer long enough to generate. Second, mix examples so the learner must identify the problem type. Third, return after time has passed, because retrieval after forgetting is where durable memory is built. Fourth, explain why two methods differ or match. Those moves feel slower than demonstration followed by repetition, but they train the judgment that later tasks require.

The boundary condition is compassion as much as rigor. A learner should not be abandoned in confusion. The teacher, coach, or self-learner designs a gap that can be crossed with effort and feedback. Too much rescue removes the work; too little structure turns practice into fog. Desirable difficulty lives between those failures.

That is why the evidence cuts against both comfort worship and struggle worship. The smooth lesson may vanish. The painful lesson may be pointless. The useful lesson makes the learner retrieve, discriminate, and explain when the answer is no longer sitting beside the question.`,
  "range-ch05": `A reader can make the method concrete with a four-column page. In the first column, state the target problem in plain terms. In the second, list possible source domains. In the third, map the relationship: what plays the role of force, path, resistance, signal, incentive, or constraint? In the fourth, name the mismatch. That last column keeps analogy honest because every borrowed comparison has a breaking point.

Dunbar's lab observations matter because surprise often arrives before explanation. A homogeneous group may all reach for the same familiar cause. A varied group has more comparisons available, and one person's odd reminder can become the start of a better model. The goal is not to collect decorative metaphors; it is to enlarge the search space when direct experience has run out of road.

Kepler's example is demanding for that reason. He did not ask whether planets were literally magnets, boats, or beams of light. He asked what relation those images made thinkable. Useful analogy is disciplined imagination: borrow the structure, test the fit, and let the mismatch teach as much as the resemblance.`,
  "range-ch06": `The practice is uncomfortable because it asks for evidence before pride. Write the hard thing down, then separate the sources of pain. Some pain comes from acquiring a skill you value. Some comes from a role that violates your strengths or values. Some comes from public embarrassment. Some comes from the fear that leaving will make past years feel wasted. These are different problems, and grit answers only some of them.

Malamud's comparison matters because systems can either force early lock-in or preserve exploration long enough for better matches. West Point matters because selection for endurance can still leave a person in a role that does not fit. Together they make switching less sentimental and more analytical.

The mature move is not to flee every hard moment. It is to run a match-quality check before making persistence a moral identity. Stay when the evidence says the difficulty is part of becoming better at the right thing. Switch when the evidence says you are only becoming tougher at enduring the wrong thing.`,
  "range-ch07": `The reader-facing version is deliberately small. Do not begin by resigning, declaring a new identity, or building a five-year plan around a fantasy. Begin with a conversation, a volunteer shift, a side project, a class, a shadowing day, or a bounded assignment. The experiment should be cheap enough to end and real enough to teach.

The review is as important as the action. Did the work energize you after the novelty faded? Did the social world fit or repel you? Did feedback point to learnable gaps or a deeper mismatch? What did the trial reveal about values you could not see from the outside? Those questions turn possible selves into evidence rather than mood.

Hesselbein's story, Darwin's detours, and the Dark Horse accounts all resist the tyranny of a single early plan. They do not promise that every experiment becomes a calling. They show that a person can learn who they are becoming by entering small doors and reading what happens on the other side.`,
  "range-ch08": `Dana's scene also shows why the inside role remains essential. The outsiders do not know the company's safety rules, manufacturing realities, or which secrets must remain protected. If the lab posts a vague plea, the crowd receives confusion. If the lab posts a careless disclosure, the company creates risk. The work is to translate enough structure for recognition while keeping enough judgment at home.

That is the difference between distance and randomness. Outside-in thinking does not mean asking strangers to brainstorm around an undefined mess. It means stripping the problem to function, constraints, and testable behavior so a person from another knowledge neighborhood can say, "We solve that kind of shape all the time." The solver's field may look irrelevant until the structure is named.

When the lab tests the outside suggestion, both sides matter. The outsider supplies a search tool the insiders lacked; the insiders decide whether it survives chemistry, safety, cost, scale, and ethics. The advantage is not outsider purity. It is a better exchange between local knowledge and distant pattern recognition.`,
  "range-ch09": `A reader can run the scan with objects already in reach. Name the component, then refuse its usual label for a moment. A scanner is not only a scanner; it is a rugged input device with a trigger, a display, a sound, and a known training burden. A crate is not only storage; it is a surface, a divider, a seat, a mount, or a baffle. Properties travel more easily than labels.

The candle problem is useful because it makes the block visible. People see the box as the container for tacks, not as the platform that solves the problem. In product work, the same blindness can make teams buy sophistication while ignoring the cheap part that already has the needed property.

The practice should still face user reality. Mature technology is not good because it is old; it is good when the oldness creates trust, availability, durability, or price advantages that fit the job. Lateral thinking with withered technology is a disciplined reuse of proven materials, not a costume party for outdated tools.`,
  "range-ch10": `A reader can make this brutally simple with a forecast log. Write the claim, the probability, the deadline, and the reason. Add the outside view: what usually happens in cases like this? Add the update trigger: what fact would move the number by ten points? Without those pieces, prediction easily becomes performance, especially when an expert identity is onstage.

The Ehrlich-Simon wager belongs here because it tempts people to overread clean outcomes. A clean result is valuable, but only for the question it actually measured. Tetlock's work generalizes the warning: the more a person needs one theory to explain everything, the harder it becomes to hear disconfirming evidence.

Good forecasting is humble in a very specific way. It does not mumble that anything could happen. It makes uncertainty measurable, invites challenge, and moves the number when facts move. Expertise remains valuable when it is disciplined by calibration; it becomes dangerous when it turns prediction into identity defense.`,
  "range-ch11": `A reader can use this by naming the object before the crisis. What is the tool you would hate to demote? A dashboard, checklist, model, script, credential, protocol, or role can all become too meaningful. Then write the assumptions that make it valid. If those assumptions fail, the tool must become a clue rather than a command.

This is why Carter Racing and the fire stories belong together. In one case the tool is a decision frame that hides missing comparison data. In another it is literal equipment that slows escape. In both, competence becomes dangerous when it keeps a person from asking what the situation has become.

Weick's sensemaking language keeps the lesson alive after the dramatic cases. Adaptation is not just choosing faster. It is noticing that the old meaning of the moment is wrong. The professional act may be to request the missing data, challenge the normalized warning, drop the pack, or pause the checklist long enough to see the anomaly.`,
  "range-ch12": `A reader can turn this into a schedule instead of a personality trait. Protected play needs a boundary: time, budget, safety, materials, and documentation. The point is to create a small space where odd questions can be tried without pretending they already deserve a grant, a product roadmap, or a public claim.

The evidence rule keeps the practice honest. After the play block, ask what changed in the material, data, or understanding. Did the trial produce a repeatable effect, a better question, a failed assumption, or only a pleasant hour? Any of those can be useful, but they should not be confused.

That is the balance Smithies, Geim, Tu Youyou, and Casadevall make visible. Expertise can become sealed and stale; amateur energy can become sloppy and self-flattering. Deliberate amateurism keeps the door open between them: enough play to find the strange lead, enough rigor to know whether the lead is real.`,
};

const fullReadExtra = {
  "range-ch03": `The reader's decision point is simple: before asking for more hours of the same practice, ask what kind of variety would make the next hour smarter. Breadth earns its place when it changes perception, not when it merely adds novelty.`,
  "range-ch04": `This also changes feedback. Instead of asking whether the session felt clear, ask what the learner can do later, mixed with other tasks, without being told which procedure applies. The delayed test is the honest one.`,
  "range-ch05": `The best analogies usually begin as questions, not answers. "What is this like?" is only the start. The useful follow-up is, "What would have to be true for the likeness to matter, and how would we find out?"`,
  "range-ch06": `A good match-quality review also has a date. Without a review point, exploration becomes drift and grit becomes autopilot. The discipline is to decide what evidence you are waiting for before the next hard season begins.`,
  "range-ch07": `That review date protects both courage and restraint. It makes the experiment real enough to teach while preventing one vivid afternoon from becoming a premature life story. The next action can be modest: repeat the trial, alter the context, meet people closer to the work, or retire the identity with gratitude for what it taught.`,
  "range-ch09": `This is also a budget habit. Constraints can make the search more creative because they force the team to ask what is already reliable enough to try before complexity is purchased. The first prototype does not need to be elegant; it needs to reveal whether the humble component has the property the new use requires.`,
  "range-ch10": `The log creates memory outside the ego. Once the forecast is written down, the question changes from "Was I impressive?" to "Did I update, calibrate, and learn?"`,
  "range-ch11": `That cue should be rehearsed while the room is calm. Under pressure, people rarely invent a new identity quickly. They follow the script they practiced, including the script for letting a trusted tool go.`,
  "range-ch12": `The protected block should be small enough to survive ordinary obligations. Deliberate amateurism fails when it depends on a heroic mood; it works when curiosity has a recurring appointment and a standard for proof.`,
};

function polishScenario(text) {
  return text
    .replace(/At (\d{1,2}:\d{2}) morning/g, "At $1 a.m.")
    .replace(/At (\d{1,2}:\d{2}) evening/g, "At $1 p.m.")
    .replace(/\b(\d{1,2}:\d{2}) evening\b/g, "$1 p.m.")
    .replace(/\b(\d{1,2}:\d{2}) morning\b/g, "$1 a.m.")
    .replace(/At (\d{1,2}) evening/g, "At $1 p.m.")
    .replace(/(\b[A-Z][A-Za-z .&'-]+(?:experiment|case|template|principle|comparison|research|story|lesson|finding|habit|advice)) sits in (her|his|their) notes/g, "$1 is fresh in $2 mind")
    .replace(/ he rereads Johannes Kepler's habit/g, " he revisits Johannes Kepler's habit")
    .replace(/ A Gunpei Yokoi biography sits beside/g, " A Gunpei Yokoi biography lies beside")
    .replace(/\. (?:At|Before|In|During|On|Beside) [^.]*\b(?:must|has to|needs to) (?:decide|choose)[^.]*\./g, ".")
    .replace(/\. As [^.]* before [^.]*\./g, ".")
    .replace(/\. As [^.]* has [^.]* before [^.]*\./g, ".")
    .replace(/\s+/g, " ")
    .trim();
}

function reduceEditableRepeatedPhrases(value, key = "") {
  if (key === "quiz") return value;
  if (typeof value === "string") {
    return value.replace(/\brather than\b/g, "instead of");
  }
  if (Array.isArray(value)) {
    return value.map((item) => reduceEditableRepeatedPhrases(item));
  }
  if (value && typeof value === "object") {
    for (const childKey of Object.keys(value)) {
      value[childKey] = reduceEditableRepeatedPhrases(value[childKey], childKey);
    }
  }
  return value;
}

const beforeQuiz = new Map();
for (const id of chapterIds) {
  const path = resolve(authoredDir, `${id}.v21-native.chapter.json`);
  const chapter = JSON.parse(readFileSync(path, "utf8"));
  beforeQuiz.set(id, JSON.stringify(chapter.quiz));
}

for (const id of chapterIds) {
  const path = resolve(authoredDir, `${id}.v21-native.chapter.json`);
  const chapter = JSON.parse(readFileSync(path, "utf8"));
  const update = updates[id];
  if (!update) throw new Error(`missing update for ${id}`);

  chapter.breakdown.fastRead = update.fastRead;
  chapter.breakdown.fullRead = `${update.fullRead}\n\n${fullReadAddenda[id]}${fullReadExtra[id] ? `\n\n${fullReadExtra[id]}` : ""}`;
  chapter.implementationPlan = update.implementationPlan;
  chapter.reviewCards = update.reviewCards;

  for (const example of chapter.examples) {
    example.scenario = polishScenario(example.scenario);
    if (update.examples?.[example.exampleId]) {
      Object.assign(example, update.examples[example.exampleId]);
    }
    if (example.tags) {
      example.tags = example.tags.map((tag) => {
        if (tag === "eli" || tag === "lilly" || tag === "posting") return null;
        if (tag === "innocentive") return "open-innovation";
        return tag;
      }).filter(Boolean);
      example.tags = [...new Set(example.tags)];
    }
  }

  reduceEditableRepeatedPhrases(chapter);

  const afterQuiz = JSON.stringify(chapter.quiz);
  if (afterQuiz !== beforeQuiz.get(id)) {
    throw new Error(`quiz changed for ${id}`);
  }

  writeFileSync(path, JSON.stringify(chapter, null, 2) + "\n", "utf8");
  mkdirSync(rootDir, { recursive: true });
  copyFileSync(path, resolve(rootDir, `${id}.v21-native.chapter.json`));
}

console.log(`Repaired ${chapterIds.length} Range chapters; quizzes unchanged.`);
