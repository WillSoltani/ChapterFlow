import { copyFileSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const ROOT = process.cwd();
const SOURCE_DIR = resolve(ROOT, ".chapterflow/runs/drive/20260601-083118/sidecars/source");
const ROOT_CHAPTERS = resolve(ROOT, "state/chapters");
const AUTHORED_CHAPTERS = resolve(ROOT, "scripts/book/prompts/chapterflow-v21-authored/state/chapters");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function norm(text) {
  return String(text).replace(/\s+/g, " ").trim();
}

function sentence(text) {
  const clean = norm(text).replace(/\brather than\b/gi, "instead of");
  return /[.!?]$/.test(clean) ? clean : `${clean}.`;
}

function question(text) {
  return sentence(text).replace(/[.!]$/, "?");
}

function firstSentence(text) {
  return sentence(norm(text).split(/(?<=[.!?])\s+/)[0] ?? text);
}

function shortLabel(label) {
  const beforeIn = norm(label).split(/\s+in\s+/i)[0];
  const words = beforeIn.split(/\s+/);
  return words.length <= 5 ? beforeIn : words.slice(0, 5).join(" ");
}

function loadSource(n) {
  const ch = String(n).padStart(2, "0");
  return readJson(resolve(SOURCE_DIR, `ch${ch}.source.json`));
}

function projectionWithoutAllowed(chapter) {
  const clone = JSON.parse(JSON.stringify(chapter));
  for (const q of clone.quiz.questions) {
    delete q.prompt;
    delete q.explanation;
  }
  for (const c of clone.reviewCards) delete c.front;
  for (const e of clone.examples) delete e.whatToDo;
  return clone;
}

function cardFronts(chapter, source) {
  const backs = chapter.reviewCards.map((card) => firstSentence(card.back).replace(/\.$/, ""));
  const labels = source.namedExamples.map((anchor) => shortLabel(anchor.label));
  const concept = source.centralConcept.name;
  const n = chapter.number;
  const card1 = [
    `What problem does ${concept} help diagnose in "${chapter.title}"?`,
    `How should a reader define ${concept} before applying it?`,
    `What core idea sits behind ${concept}?`,
    `Why is ${concept} more than a motivational slogan?`,
    `What does ${concept} name in practical terms?`,
  ][(n - 1) % 5];
  const card2 = [
    `What does ${labels[0]} reveal about ${concept}?`,
    `Why does ${labels[0]} matter to the main claim?`,
    `How does ${labels[0]} change the obvious interpretation?`,
    `What source lesson should a reader take from ${labels[0]}?`,
    `Which mistaken expectation does ${labels[0]} overturn?`,
  ][(n + 1) % 5];
  const card3 = [
    `When would this claim guide a decision: ${backs[2]}?`,
    `What situation does this claim clarify: ${backs[2]}?`,
    `Why is this supporting claim useful: ${backs[2]}?`,
    `What boundary or application does "${backs[2]}" provide?`,
    `How should the reader use this source claim: ${backs[2]}?`,
  ][(n + 2) % 5];
  const card4 = [
    `How does this source detail sharpen ${concept}: ${backs[3]}?`,
    `What does ${labels[1] ?? labels[0]} show when ${backs[3]}?`,
    `Which part of ${concept} becomes clearer from "${backs[3]}"?`,
    `What source pattern is visible in this detail: ${backs[3]}?`,
    `How should a reader interpret ${labels[1] ?? labels[0]} through "${backs[3]}"?`,
  ][(n + 3) % 5];
  const card5 = [
    `What design mistake follows when ${backs[4]}?`,
    `How does this warning change the reader's next decision: ${backs[4]}?`,
    `Which practical risk does this card name: ${backs[4]}?`,
    `What should a reader avoid after learning that ${backs[4]}?`,
    `How does ${concept} prevent the problem described here: ${backs[4]}?`,
  ][(n + 4) % 5];
  return [card1, card2, card3, card4, card5].map(question);
}

function quizPrompts(chapter, source) {
  const labels = source.namedExamples.map((anchor) => shortLabel(anchor.label));
  const concept = source.centralConcept.name;
  const domains = chapter.examples.map((e) => e.planSpec.domain);
  const n = chapter.number;
  const banks = [
    [
      `Before changing incentives in the ${domains[0]}, what does ${concept} ask the team to diagnose`,
      `How does ${labels[0]} challenge the idea that only paid control produces serious work`,
      `A facilitator in the ${domains[2]} overstates ${concept}; what boundary keeps the claim useful`,
      `The ${domains[3]} needs judgment, not just compliance. What would ${labels[0]} support`,
      `What distinction from ${labels[1] ?? labels[0]} prevents ${concept} from becoming a universal rule`,
      `In the ${domains[5]}, how should ${labels[2] ?? labels[0]} be read when someone says outcomes no longer matter`,
      `Which small test would give the ${domains[0]} real evidence about ${concept}`,
      `Output rises in the ${domains[4]}, but ownership drops. How should ${concept} interpret that result`,
      `What is the first practical move for applying ${concept} in the ${domains[5]}`,
    ],
    [
      `What should the ${domains[0]} inspect before it adds a prize or tighter rule`,
      `What does ${labels[0]} reveal about motivation that a paid-expert forecast would miss`,
      `When ${concept} sounds too sweeping in the ${domains[2]}, which limit belongs in the answer`,
      `Which policy would fit the ${domains[3]} if ${labels[0]} is taken seriously`,
      `How does ${labels[1] ?? labels[0]} narrow the lesson to the right kind of work`,
      `What correction should follow when ${labels[2] ?? labels[0]} is used to dismiss structure`,
      `What reversible experiment belongs in the ${domains[0]} before a permanent rule is made`,
      `How should the ${domains[4]} read a short-term gain that weakens the motive underneath it`,
      `If a reader had one day to use ${concept}, what action should come first`,
    ],
    [
      `What hidden assumption should be surfaced in the ${domains[0]} before the incentive changes`,
      `Why does ${labels[0]} complicate the simple story that money and management explain effort`,
      `Which answer keeps ${concept} from being turned into an anti-structure slogan`,
      `The ${domains[3]} is choosing between pressure and better conditions. What fits ${labels[0]}`,
      `What does ${labels[1] ?? labels[0]} teach about applying the idea selectively`,
      `How should the reader answer the claim that ${labels[2] ?? labels[0]} makes outcomes irrelevant`,
      `What would count as a modest, evidence-producing trial in the ${domains[0]}`,
      `What diagnosis fits when the ${domains[4]} gets output but loses curiosity`,
      `What concrete step translates ${concept} into tomorrow's work`,
    ],
    [
      `In the ${domains[0]}, what question should come before any new reward design`,
      `What conclusion follows from ${labels[0]} when the obvious bet favors professional control`,
      `Which guardrail stops ${concept} from becoming a blanket rejection of structure`,
      `How should ${labels[0]} guide a policy choice inside the ${domains[3]}`,
      `Which distinction from ${labels[1] ?? labels[0]} protects the reader from overreach`,
      `What is the right response when ${labels[2] ?? labels[0]} is stretched into an outcomes-free claim`,
      `What should the ${domains[0]} test before calling ${concept} a success`,
      `How should a leader read the ${domains[4]} if the number improves but commitment fades`,
      `What action makes ${concept} usable without waiting for a full redesign`,
    ],
    [
      `What would a better motivational diagnosis look like in the ${domains[0]}`,
      `What does ${labels[0]} prove about motives that are invisible to a control-first plan`,
      `Which boundary keeps the ${domains[2]} discussion faithful to ${concept}`,
      `What policy signal would ${labels[0]} send in the ${domains[3]}`,
      `Where does ${labels[1] ?? labels[0]} draw the line for using this idea`,
      `How can the ${domains[5]} keep outcomes in view while still honoring ${labels[2] ?? labels[0]}`,
      `Which trial in the ${domains[0]} would test conditions instead of slogans`,
      `What should worry the ${domains[4]} when output improves but ownership weakens`,
      `What should a reader change first to make ${concept} concrete`,
    ],
  ];
  return banks[(n - 1) % banks.length].map(question);
}

function quizExplanations(chapter, source) {
  const labels = source.namedExamples.map((anchor) => shortLabel(anchor.label));
  const concept = source.centralConcept.name;
  const domains = chapter.examples.map((e) => e.planSpec.domain);
  return chapter.quiz.questions.map((q, i) => {
    const correct = q.choices[q.correctIndex];
    const local = [
      `${chapter.title} diagnostic: ${correct}`,
      `${labels[0]} lesson: ${correct}`,
      `${concept} boundary: ${correct}`,
      `${domains[3]} policy: ${correct}`,
      `${labels[1] ?? labels[0]} distinction: ${correct}`,
      `${labels[2] ?? labels[0]} correction: ${correct}`,
      `${domains[0]} evidence test: ${correct}`,
      `${domains[4]} interpretation: ${correct}`,
      `${domains[5]} action: ${correct}`,
    ];
    return sentence(local[i]);
  });
}

function whatToDoList(chapter, source) {
  const concept = source.centralConcept.name;
  const anchors = source.namedExamples.map((anchor) => shortLabel(anchor.label));
  const domains = chapter.examples.map((e) => e.planSpec.domain);
  const n = chapter.number;
  const banks = [
    [
      `At the ${domains[0]}, classify the work type and remove one control that blocks contribution.`,
      `In the ${domains[1]}, ask where factory-style supervision helps and where it dulls creative judgment.`,
      `Audit the ${domains[2]} for the social meaning people would defend, not just the payout math.`,
      `Use ${anchors[0]} to choose one contribution path for the ${domains[3]} that is easier to join.`,
      `In the ${domains[4]}, compare compliance metrics with curiosity signals before changing the lab design.`,
      `Write one support-script rule to loosen so agents can handle unusual problems with judgment.`,
    ],
    [
      `Before the ${domains[0]}, name the motive a prize could crowd out and design around that risk.`,
      `In the ${domains[1]}, protect a block of exploratory time before discussing any bonus.`,
      `Audit the ${domains[2]} for the social norm a fee might convert into a market bargain.`,
      `For the ${domains[3]}, check whether the target invites learning or encourages gaming the number.`,
      `At the ${domains[4]}, make the volunteer choice feel self-directed before offering a reward.`,
      `In the ${domains[5]}, cap the bounty and add a quality review so attention does not narrow to payout.`,
    ],
    [
      `For the ${domains[0]}, confirm the task is routine and set a modest completion reward.`,
      `Explain why the ${domains[1]} matters, then let people choose their sequence of work.`,
      `In the ${domains[2]}, settle baseline fairness before using any backlog incentive.`,
      `Acknowledge the dullness of the ${domains[3]} and offer one choice over method.`,
      `For the ${domains[4]}, tie the reward to completion without pretending the route is creative.`,
      `Use an after-the-fact thank-you in the ${domains[5]} instead of an announced if-then bargain.`,
    ],
    [
      `In the ${domains[0]}, change one condition before labeling the people as Type I or Type X.`,
      `Ask the ${domains[1]} participant which choice, skill signal, or relationship would support better effort.`,
      `At the ${domains[2]}, look for internal drive instead of mistaking status hunger for motivation.`,
      `Turn one struggle in the ${domains[3]} into feedback about strategy, not talent.`,
      `For the ${domains[4]}, replace a pressure cue with a need-support cue.`,
      `In the ${domains[5]}, identify the reward habit that trained external dependence.`,
    ],
    [
      `Give the ${domains[0]} team one bounded choice over time while keeping patient-care standards visible.`,
      `For the ${domains[1]}, let engineers choose one task slice while preserving the shared roadmap outcome.`,
      `Judge the ${domains[2]} by completed service outcomes, not visible online presence.`,
      `Ask teachers in the ${domains[3]} to choose one technique within the common goal.`,
      `In the ${domains[4]}, leave one creative route open instead of scripting every move.`,
      `Let the ${domains[5]} team choose collaborators for one improvement experiment.`,
    ],
    [
      `Set one stretch target for the ${domains[0]} that is hard enough to focus attention.`,
      `In the ${domains[1]}, turn the next code weakness into a deliberate practice drill.`,
      `Use the ${domains[2]} audit to adjust difficulty before it becomes panic or boredom.`,
      `Ask the ${domains[3]} learner to treat one mistake as information for the next attempt.`,
      `During the ${domains[4]}, choose one film clip that shows the next reachable improvement.`,
      `For the ${domains[5]}, give one precise correction and schedule a repeat attempt.`,
    ],
    [
      `At the ${domains[0]}, make one budget choice that proves the mission has tradeoff power.`,
      `In the ${domains[1]}, connect the next task to the patient or person it serves.`,
      `For the ${domains[2]}, build contribution into the operating plan instead of adding charity afterward.`,
      `Ask the ${domains[3]} client who benefits beyond private achievement.`,
      `In the ${domains[4]}, test the benefits proposal against the people it claims to serve.`,
      `For the ${domains[5]}, name the public contribution the redesign should make visible.`,
    ],
    [
      `At the ${domains[0]}, record when work feels absorbing, draining, useful, or empty.`,
      `In the ${domains[1]}, protect one renewal block before the calendar fills with client work.`,
      `Use an unexpected prompt in the ${domains[2]} to break a stale creative pattern.`,
      `In the ${domains[3]}, log one flow moment and one frustration before redesigning the routine.`,
      `Remove one recurring drain from the ${domains[4]} before adding another productivity trick.`,
      `Use the ${domains[5]} to reset attention instead of letting errands swallow it.`,
    ],
    [
      `Run an autonomy audit in the ${domains[0]} before blaming disengagement on attitude.`,
      `For the ${domains[1]}, define the delivery moment before opening self-directed work time.`,
      `Make one recognition note in the ${domains[2]} specific, modest, and peer-delivered.`,
      `Ask the ${domains[3]} group whose purpose the mission currently serves.`,
      `Pair the ${domains[4]} with clear outcomes so flexibility has trust and standards.`,
      `In the ${domains[5]}, revise one metric that rewards visibility over judgment.`,
    ],
    [
      `In the ${domains[0]}, check internal and external fairness before discussing purpose.`,
      `For the ${domains[1]}, make the offer signal trust without turning every result into a bargain.`,
      `Use the ${domains[2]} to find one comparison that keeps people staring at pay.`,
      `In the ${domains[3]}, remove one commission pressure that harms long-term customer value.`,
      `Ask the ${domains[4]} whether compensation, not purpose, is driving the departure risk.`,
      `At the ${domains[5]}, simplify one incentive so money becomes less distracting.`,
    ],
    [
      `Test the ${domains[0]} assignment for one real choice, one mastery path, and one purpose connection.`,
      `In the ${domains[1]}, separate family contribution from paid chores before discussing allowance.`,
      `Give the ${domains[2]} student a bounded project choice and a clear sharing moment.`,
      `During the ${domains[3]}, praise the strategy used, not fixed smartness.`,
      `For the ${domains[4]}, keep the showcase accountable without turning it into a prize chase.`,
      `In the ${domains[5]}, write feedback that points to the next learning strategy.`,
    ],
  ];
  return (banks[n - 1] ?? banks[0]).map(sentence);
}

function validate(before, after, source) {
  if (JSON.stringify(projectionWithoutAllowed(before)) !== JSON.stringify(projectionWithoutAllowed(after))) {
    throw new Error(`${after.chapterId}: forbidden field changed`);
  }
  before.quiz.questions.forEach((oldQ, i) => {
    const q = after.quiz.questions[i];
    if (q.correctIndex !== oldQ.correctIndex) throw new Error(`${q.questionId}: correctIndex changed`);
    if (q.choices[q.correctIndex] !== oldQ.choices[oldQ.correctIndex]) throw new Error(`${q.questionId}: correct choice text changed`);
    if (JSON.stringify(q.choices) !== JSON.stringify(oldQ.choices)) throw new Error(`${q.questionId}: choices changed`);
    if (!q.prompt.endsWith("?")) throw new Error(`${q.questionId}: prompt is not a question`);
  });
  for (const card of after.reviewCards) {
    if (!card.front.endsWith("?")) throw new Error(`${card.cardId}: front is not a question`);
  }
  const distinctActions = new Set(after.examples.map((e) => e.whatToDo)).size;
  if (distinctActions < 4) throw new Error(`${after.chapterId}: only ${distinctActions} distinct whatToDo values`);
  const bad = [
    "reward diagnostic?",
    "challenges paid-control assumptions in",
    "is overstated in",
    "How would you explain this motivation idea:",
    "What source example helps explain why",
  ];
  const assembled = [
    ...after.quiz.questions.flatMap((q) => [q.prompt, q.explanation]),
    ...after.reviewCards.map((c) => c.front),
    ...after.examples.map((e) => e.whatToDo),
  ].join("\n");
  for (const phrase of bad) {
    if (assembled.includes(phrase)) throw new Error(`${after.chapterId}: retained templated phrase ${phrase}`);
  }
}

for (let n = 1; n <= 11; n += 1) {
  const ch = String(n).padStart(2, "0");
  const path = resolve(ROOT_CHAPTERS, `drive-ch${ch}.v21-native.chapter.json`);
  const before = readJson(path);
  const source = loadSource(n);
  const after = JSON.parse(JSON.stringify(before));

  const prompts = quizPrompts(after, source);
  const explanations = quizExplanations(after, source);
  after.quiz.questions = after.quiz.questions.map((q, i) => ({
    ...q,
    prompt: prompts[i],
    explanation: explanations[i],
  }));
  const fronts = cardFronts(after, source);
  after.reviewCards = after.reviewCards.map((card, i) => ({ ...card, front: fronts[i] }));
  const actions = whatToDoList(after, source);
  after.examples = after.examples.map((example, i) => ({ ...example, whatToDo: actions[i] }));

  validate(before, after, source);
  writeFileSync(path, `${JSON.stringify(after, null, 2)}\n`, "utf8");
  copyFileSync(path, resolve(AUTHORED_CHAPTERS, `drive-ch${ch}.v21-native.chapter.json`));
  console.log(`polished drive-ch${ch}`);
}
