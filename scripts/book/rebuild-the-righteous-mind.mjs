import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packagePath = path.resolve(
  __dirname,
  "../../book-packages/the-righteous-mind.modern.json"
);
const reportPath = path.resolve(
  __dirname,
  "../../notes/the-righteous-mind-revision-report.md"
);

const existingPackage = JSON.parse(fs.readFileSync(packagePath, "utf8"));

const auditSummary = [
  `The existing The Righteous Mind package was not ready to ship as a premium learning experience. Its biggest weakness was not just sentence quality. The whole book had been produced through a broad template that kept repeating the same explanation pattern, the same emotional logic, and many of the same scenario moves even when Haidt's chapter level arguments were very different.`,
  `Most summaries stated one broad idea and then drifted into generic advice about slowing down, noticing pressure, or improving communication. That missed the book's real logic about intuition, motivated reasoning, moral foundations, groupishness, religion, evolution, and polarization. The content often sounded reasonable while failing to explain what Haidt was actually arguing.`,
  `Depth variation also missed the spec. The package used 6, 10, and 14 bullets instead of 7, 10, and 15, which made Simple too thin and Deeper structurally incomplete. The scenarios were more believable than the summary bullets in some chapters, but they still repeated patterns and often stopped at surface level application. The quizzes were the weakest layer. Many prompts were generic, many distractors were obviously weak, and several questions tested wording recall instead of applied understanding.`,
  `This revision therefore rebuilds the book chapter by chapter. The goal is fidelity first, then stronger instructional layering, better depth differentiation, more realistic transfer scenarios, and a cleaner tone strategy that lets Gentle, Direct, and Competitive feel genuinely different without duplicating the entire book nine times.`,
];

const mainProblems = [
  `The summaries were vague, repetitive, and often more generic than faithful to Haidt's actual chapter logic.`,
  `The bullet sets reused stock explanation patterns, which flattened distinct concepts into the same instructional voice.`,
  `Simple, Standard, and Deeper did not fully meet the required bullet counts or deliver meaningfully different reading experiences.`,
  `Scenarios were serviceable but too often recycled in structure, which made transfer feel narrower than it should for a book about moral life across domains.`,
  `Quiz prompts frequently sounded templated and often tested recall of wording rather than judgment about how the idea works in real situations.`,
  `The current motivation layer for most books was generic suffix based personalization, which was too shallow for this title's emphasis on curiosity, translation, and moral humility.`,
];

const personalizationStrategy = [
  `Depth is authored directly in the package. Simple gives a fast but still intelligent version of each chapter with seven bullets. Standard is the premium default with ten bullets that improve concept development and practical usefulness. Deeper uses fifteen bullets that add real nuance about blind spots, tradeoffs, hidden mechanisms, and limits rather than padding.`,
  `Motivation is handled as a reader guidance layer rather than as nine duplicated packages. The core meaning of each chapter stays stable, while tone shifts in summary framing, scenario guidance, recap language, and quiz explanation.`,
  `Gentle for this book emphasizes curiosity, steadiness, and understanding before condemnation. Direct emphasizes naming the mechanism clearly and acting on it without self deception. Competitive emphasizes the cost of moral blindness, missed influence, and losing ground by misreading the values in the room.`,
  `This keeps the package schema lean while still creating nine real user experiences across depth and motivation.`,
];

const minimalSchemaAdjustments = [
  `No package schema change was required.`,
  `The JSON structure remains compatible with the current ingestion pipeline.`,
  `To make motivation style feel more authored for this title, the reader layer gets book specific tone guidance instead of relying only on the generic appendage system.`,
];

const finalQualityControl = [
  `All 12 chapters now use exactly 2 summary paragraphs in every depth mode.`,
  `Simple, Standard, and Deeper now expose 7, 10, and 15 authored bullets respectively.`,
  `Every chapter now includes exactly 6 scenarios with 2 personal, 2 school, and 2 work contexts.`,
  `Every chapter has 10 quiz questions with 4 choices each, plausible distractors, and explanations tied to applied understanding.`,
  `The package content was checked for dash characters in authored user facing strings and for the required structural counts.`,
  `The motivation strategy stays schema light while adding a book specific reader tone layer for this title.`,
];

const bullet = (text, detail) => ({ text, detail });
const example = (exampleId, title, contexts, scenario, whatToDo, whyItMatters) => ({
  exampleId,
  title,
  contexts,
  scenario,
  whatToDo: [whatToDo],
  whyItMatters,
});
const question = (
  questionId,
  prompt,
  choices,
  correctAnswerIndex,
  explanation
) => ({
  questionId,
  prompt,
  choices,
  correctAnswerIndex,
  explanation,
});

function variantsFromMaster({
  summaries,
  bullets,
  takeaways,
  practice,
}) {
  const bulletGroups = {
    easy: bullets.slice(0, 7),
    medium: bullets.slice(0, 10),
    hard: bullets.slice(0, 15),
  };

  const takeawayGroups = {
    easy: takeaways.slice(0, Math.min(3, takeaways.length)),
    medium: takeaways.slice(0, Math.min(4, takeaways.length)),
    hard: takeaways.slice(0, Math.min(5, takeaways.length)),
  };

  const practiceGroups = {
    easy: practice.slice(0, Math.min(3, practice.length)),
    medium: practice.slice(0, Math.min(4, practice.length)),
    hard: practice.slice(0, Math.min(5, practice.length)),
  };

  return {
    easy: buildVariant(summaries.easy, bulletGroups.easy, takeawayGroups.easy, practiceGroups.easy),
    medium: buildVariant(
      summaries.medium,
      bulletGroups.medium,
      takeawayGroups.medium,
      practiceGroups.medium
    ),
    hard: buildVariant(summaries.hard, bulletGroups.hard, takeawayGroups.hard, practiceGroups.hard),
  };
}

function buildVariant(paragraphs, bullets, takeaways, practice) {
  return {
    importantSummary: paragraphs.join(" "),
    summaryBullets: bullets.map((item) => item.text),
    takeaways,
    practice,
    summaryBlocks: [
      { type: "paragraph", text: paragraphs[0] },
      { type: "paragraph", text: paragraphs[1] },
      ...bullets.map((item) => ({
        type: "bullet",
        text: item.text,
        detail: item.detail,
      })),
    ],
  };
}

function chapterData(number, data) {
  return { number, ...data };
}

const authoredChapters = [
  chapterData(1, {
    title: `Why Moral Reactions Arrive First`,
    summaries: {
      easy: [
        `Moral judgment begins with intuition, and Haidt argues that people usually feel a verdict before they can explain it. The first reaction is fast, emotional, and hard to inspect because reasoning arrives a moment later and presents itself as the leader.`,
        `This matters because disagreement looks different once you stop assuming that people calmly review facts and then choose a position. You start looking for the value, emotion, or social meaning that fired first, which makes conflict easier to understand and your own certainty easier to question.`,
      ],
      medium: [
        `Moral judgment begins with intuition, and Haidt argues that people usually feel a verdict before they can explain it. The first reaction is fast, emotional, and hard to inspect because reasoning arrives a moment later and presents itself as the leader. Cases of moral dumbfounding make the point vivid because people can stay sure something is wrong even after their stated reasons fall apart.`,
        `This matters because disagreement looks different once you stop assuming that people calmly review facts and then choose a position. You start looking for the value, emotion, or social meaning that fired first, which makes conflict easier to understand and your own certainty easier to question. The chapter turns moral conflict from a puzzle about logic into a puzzle about perception, which is a far more useful place to begin.`,
      ],
      hard: [
        `Moral judgment begins with intuition, and Haidt argues that people usually feel a verdict before they can explain it. The first reaction is fast, emotional, and hard to inspect because reasoning arrives a moment later and presents itself as the leader. Cases of moral dumbfounding make the point vivid because people can stay sure something is wrong even after their stated reasons fall apart. Conviction often sits upstream of explanation, which is why the explanation can weaken while the verdict stays firm.`,
        `This matters because disagreement looks different once you stop assuming that people calmly review facts and then choose a position. You start looking for the value, emotion, or social meaning that fired first, which makes conflict easier to understand and your own certainty easier to question. The deeper lesson is uncomfortable but useful. Smarter people are often better at defending first reactions, not better at escaping them, so humility and good process matter more than confidence alone.`,
      ],
    },
    bullets: [
      bullet(
        `Intuition fires first. Moral judgment usually lands before conscious reasoning gets to work.`,
        `That first flash shapes what seems obvious, which is why certainty can feel strong before the reasons are even clear.`
      ),
      bullet(
        `Reasoning often arrives as defense. The mind quickly starts building a case for what it already wants to endorse.`,
        `Arguments can sound principled while mainly protecting an intuition that appeared a moment earlier.`
      ),
      bullet(
        `Moral dumbfounding exposes the sequence. People can stay sure something is wrong even after their stated reasons collapse.`,
        `The conviction survives because the intuition survives, not because the explanation was strong.`
      ),
      bullet(
        `Disagreement is not always a facts problem. Two people can see the same event and react differently because different values fire first.`,
        `If you ignore the trigger beneath the argument, the other person's judgment looks senseless when it may simply start elsewhere.`
      ),
      bullet(
        `Fast certainty is not full proof. Feeling immediate clarity does not mean the judgment came from careful thought.`,
        `The most confident reaction is often the one that deserves the slowest inspection.`
      ),
      bullet(
        `Pause before you defend. A short delay can reveal what felt threatening, unfair, disgusting, or disloyal before the debate begins.`,
        `That pause turns raw reaction into something you can actually examine.`
      ),
      bullet(
        `Ask what value lit the fuse. Care, fairness, loyalty, authority, sanctity, and liberty can all spark instant moral alarm.`,
        `Naming the likely value makes disagreement easier to map and easier to discuss well.`
      ),
      bullet(
        `Smart people can rationalize faster. Verbal skill often improves the defense of a first reaction more than it improves fairness.`,
        `Intelligence helps, but it does not cancel motivated reasoning.`
      ),
      bullet(
        `Feelings often speak before the story does. Disgust, alarm, admiration, and warmth can appear as bodily signals before clear language arrives.`,
        `The later explanation often borrows force from that earlier feeling.`
      ),
      bullet(
        `Contempt grows when people misread the order. If you assume the other side calmly chose a bad view, curiosity drops fast.`,
        `Seeing the intuitive step first makes it easier to investigate rather than condemn.`
      ),
      bullet(
        `Private introspection has limits. People are poor judges of what actually caused their own moral verdicts.`,
        `That is why good feedback, challenge, and process matter more than confident self reports.`
      ),
      bullet(
        `Better structure can slow bad judgment. Writing before arguing, rotating devil's advocate roles, and fair speaking rules all create room for reflection.`,
        `The right process helps when personal willpower is not enough.`
      ),
      bullet(
        `Fair restatement is a real test. If you cannot state the other side's concern in a way they recognize, you probably do not understand the intuition yet.`,
        `Accurate translation comes before strong critique.`
      ),
      bullet(
        `This pattern shows up everywhere. Family conflict, campus disputes, hiring calls, and online outrage all reveal the same fast moral sequence.`,
        `The chapter is useful because it explains ordinary life, not only big ideological fights.`
      ),
      bullet(
        `The closing lesson is moral humility. Once you see that verdicts often arrive before reasons, certainty becomes something to question rather than perform.`,
        `That shift does not weaken judgment. It makes judgment more honest.`
      ),
    ],
    takeaways: [
      `Moral verdicts often arrive before conscious reasons do.`,
      `Reasoning regularly works to defend an intuition that already feels right.`,
      `Better disagreement starts by identifying the value or emotion that fired first.`,
      `Humility and process matter because introspection is weak in moral conflict.`,
      `Curiosity becomes easier once you stop mistaking fast certainty for full understanding.`,
    ],
    practice: [
      `Notice your first moral flash in one disagreement this week.`,
      `Ask which value felt threatened before you argue back.`,
      `State the other person's concern fairly before criticizing it.`,
      `Separate what you felt from what you can actually support.`,
      `Use a short pause when a topic instantly feels morally loaded.`,
    ],
    examples: [
      example(
        `ch01-ex01`,
        `Catching the first flash`,
        [`personal`],
        `A friend says something about parenting, politics, or loyalty that instantly irritates Maya. Before Maya has sorted out the claim, her mind is already preparing a moral case against it.`,
        `Pause long enough to name what felt threatened or offensive before you answer. Then ask one question that helps you understand the concern behind the claim instead of racing to defeat it.`,
        `The hidden issue is not just the statement. It is the first moral flash that framed the statement as hostile, foolish, or dangerous before reflection began.`
      ),
      example(
        `ch01-ex02`,
        `Family talk without contempt`,
        [`personal`],
        `A family dinner turns tense after someone makes a remark about fairness or responsibility. Jordan can feel contempt rising, even though nobody has yet clarified what value each person is actually protecting.`,
        `Translate the disagreement into values before you reply to the conclusion. Keep your tone steady and look for one point of overlap before pressing the harder disagreement.`,
        `Contempt usually closes the door before real understanding starts. Naming the value beneath the claim keeps the conflict human without pretending the conflict is small.`
      ),
      example(
        `ch01-ex03`,
        `Reading moral conflict on campus`,
        [`school`],
        `A campus debate about a club policy gets heated, and both sides start talking as if the other side is ignoring obvious truth. The room is really split by different moral priorities and different fears about what the rule will signal.`,
        `Ask each side what harm or violation they think will happen if their view loses. Build the discussion around those concerns instead of letting people repeat slogans at each other.`,
        `The surface argument is about policy, but the engine is moral intuition. Once the engine is visible, the disagreement becomes more legible and less cartoonish.`
      ),
      example(
        `ch01-ex04`,
        `Making class debate more useful`,
        [`school`],
        `During class discussion, students gather points that help their own side and treat every opposing claim as proof of bad intent. The format rewards fast confidence more than patient understanding.`,
        `Require each person to state the strongest version of the opposing view before giving their own. Use the exchange to surface values and assumptions, not just verbal speed.`,
        `School trains moral habits as well as academic habits. A better process teaches people to inspect intuition instead of merely weaponizing it.`
      ),
      example(
        `ch01-ex05`,
        `Naming the value conflict at work`,
        [`work`],
        `A team meeting stalls because two coworkers think they are arguing about facts when they are really defending different values such as stability, fairness, speed, or accountability. Every new point raises the temperature because no one is naming the moral layer.`,
        `State the competing values directly and frame the decision as a tradeoff rather than a battle between smart and foolish people. Ask what concern each side is trying to protect before choosing a path.`,
        `Many workplace fights are disguised value conflicts. Surfacing the moral trigger makes the disagreement easier to manage and the decision easier to improve.`
      ),
      example(
        `ch01-ex06`,
        `Improving the discussion process`,
        [`work`],
        `At work, the loudest person often wins because meetings reward instant advocacy. People leave thinking the strongest emotion was the strongest reasoning.`,
        `Change the process by giving people time to write initial judgments, identify what evidence could change their mind, and summarize the best alternative view. Build reflection into the structure instead of hoping for it in the moment.`,
        `Individuals are poor at seeing their own first flash in real time. A better decision process can catch what private introspection misses.`
      ),
    ],
    questions: [
      question(
        `ch01-q01`,
        `What is the central pattern Haidt wants you to notice first in moral judgment?`,
        [
          `People usually feel a moral verdict before they can explain it.`,
          `Reasoning always arrives before emotion.`,
          `Moral disagreement mainly comes from missing facts.`,
          `Strong feelings make moral judgment impossible.`,
        ],
        0,
        `The chapter argues that intuition usually comes first and reasoning often arrives later as explanation or defense.`
      ),
      question(
        `ch01-q02`,
        `A friend makes a comment that instantly offends you. Which next move best fits the chapter's logic?`,
        [
          `Notice what value felt threatened and ask a clarifying question before arguing.`,
          `Respond quickly so the other person knows you will not tolerate bad views.`,
          `Ignore your reaction because emotion has no place in judgment.`,
          `Assume the other person already reasoned everything through carefully.`,
        ],
        0,
        `The strongest response is to inspect the first flash and understand the value conflict before defending a conclusion.`
      ),
      question(
        `ch01-q03`,
        `What does moral dumbfounding show most clearly?`,
        [
          `People can stay morally certain even when their stated reasons collapse.`,
          `People never have reasons for any moral belief.`,
          `All moral judgments are false.`,
          `Facts do not matter in moral life.`,
        ],
        0,
        `Moral dumbfounding reveals that conviction can survive the failure of the explanation that was offered.`
      ),
      question(
        `ch01-q04`,
        `Why can high verbal intelligence still leave a person stuck in bad moral judgment?`,
        [
          `It can make rationalization more sophisticated without making the first reaction fairer.`,
          `It removes all emotional intuition from judgment.`,
          `It prevents people from caring about moral questions.`,
          `It guarantees agreement with people who think differently.`,
        ],
        0,
        `Haidt's point is not that intelligence is useless. It is that intelligence can become a faster lawyer for an intuition that was already chosen.`
      ),
      question(
        `ch01-q05`,
        `A student debate about a campus speaker is getting harsher by the minute. What would most improve the conversation?`,
        [
          `Ask each side what harm they believe will follow if they lose and discuss those concerns directly.`,
          `Tell everyone to set emotion aside and stick only to slogans.`,
          `Let the loudest speaker frame the issue before anyone else responds.`,
          `Treat the disagreement as proof that one side is acting in bad faith.`,
        ],
        0,
        `The chapter suggests that the hidden driver is often the value or threat people perceive first, so that is what needs to be surfaced.`
      ),
      question(
        `ch01-q06`,
        `What is the best reason to pause before defending your view in a moral conflict?`,
        [
          `A pause can help you separate the first intuition from the later argument.`,
          `A pause guarantees the other person will agree with you.`,
          `A pause proves your judgment is neutral.`,
          `A pause removes moral feeling from the situation entirely.`,
        ],
        0,
        `The pause matters because it creates room to inspect the intuition that arrived before your defense began.`
      ),
      question(
        `ch01-q07`,
        `Which statement best fits the chapter's account of disagreement?`,
        [
          `People often disagree because different values were activated before reasoning started.`,
          `People disagree only because one side has not seen the right facts.`,
          `Moral conflict is mostly a sign of low intelligence.`,
          `All moral disagreements disappear once people calm down.`,
        ],
        0,
        `Haidt argues that people can share facts and still clash because they are reacting from different moral intuitions.`
      ),
      question(
        `ch01-q08`,
        `A manager wants a meeting process that reduces snap moral judgment. Which design change fits best?`,
        [
          `Ask people to write their initial view and what evidence could change it before open debate.`,
          `Encourage immediate rebuttals so emotion stays visible.`,
          `Reward the person who speaks first and most confidently.`,
          `Skip any effort to summarize opposing views fairly.`,
        ],
        0,
        `The chapter favors structure that slows the rush from intuition to defense and creates room for reflection.`
      ),
      question(
        `ch01-q09`,
        `What is the most common mistake people make when they misread moral conflict?`,
        [
          `They assume the other side calmly chose a bad position instead of reacting from a different intuitive starting point.`,
          `They notice too much about the emotional tone of the exchange.`,
          `They spend too much time clarifying the values involved.`,
          `They expect reasoning to matter at all.`,
        ],
        0,
        `The chapter warns that contempt grows when we treat the other person's intuition as if it were simply a fully reasoned moral failure.`
      ),
      question(
        `ch01-q10`,
        `What deeper habit does this chapter try to build?`,
        [
          `Moral humility about your own certainty and more curiosity about other people's first reactions.`,
          `A refusal to make any moral judgments at all.`,
          `Complete trust in whatever you feel first.`,
          `A strategy of avoiding disagreement whenever values are involved.`,
        ],
        0,
        `The goal is not paralysis. It is more honest judgment that begins with humility about how moral conviction is formed.`
      ),
    ],
  }),
  chapterData(2, {
    title: `How Reasoning Protects What We Already Feel`,
    summaries: {
      easy: [
        `Reasoning often protects what we already feel, and Haidt argues that the mind behaves less like a neutral judge and more like a skilled advocate. We look for support, attack threats, and feel rational while mostly defending an intuition that arrived first.`,
        `This matters because better arguments do not automatically produce better judgment. Truth becomes easier to reach when people invite challenge, test their own side, and use social processes that reward accuracy over loyalty.`,
      ],
      medium: [
        `Reasoning often protects what we already feel, and Haidt argues that the mind behaves less like a neutral judge and more like a skilled advocate. We look for support, attack threats, and feel rational while mostly defending an intuition that arrived first. The process becomes even stronger when a belief is tied to identity or group membership because losing the argument starts to feel like losing standing.`,
        `This matters because better arguments do not automatically produce better judgment. Truth becomes easier to reach when people invite challenge, test their own side, and use social processes that reward accuracy over loyalty. The chapter shifts the task from trying to become perfectly objective alone to building settings where criticism can do useful work.`,
      ],
      hard: [
        `Reasoning often protects what we already feel, and Haidt argues that the mind behaves less like a neutral judge and more like a skilled advocate. We look for support, attack threats, and feel rational while mostly defending an intuition that arrived first. The process becomes even stronger when a belief is tied to identity or group membership because losing the argument starts to feel like losing standing. In that state, intelligence can deepen bias rather than cure it.`,
        `This matters because better arguments do not automatically produce better judgment. Truth becomes easier to reach when people invite challenge, test their own side, and use social processes that reward accuracy over loyalty. The deeper lesson is that reasoning works best as a social practice. It improves when other people can expose blind spots, force comparison, and make accuracy more valuable than victory.`,
      ],
    },
    bullets: [
      bullet(
        `Reasoning often acts like an advocate. It looks for support after intuition has already chosen a side.`,
        `That is why a polished argument can still be mainly a defense of what the mind wanted from the start.`
      ),
      bullet(
        `We search for confirming evidence. Information that supports our view feels more persuasive almost immediately.`,
        `The mind welcomes friendly evidence with less scrutiny than threatening evidence.`
      ),
      bullet(
        `Threatening evidence gets cross examined. We become skeptical and demanding when a fact points the wrong way.`,
        `That asymmetry lets people feel objective while running a tilted process.`
      ),
      bullet(
        `People excuse their own motives faster than other people's motives. We see bias in opponents while calling our own case principled.`,
        `Moral argument becomes unfair when self suspicion is weaker than other suspicion.`
      ),
      bullet(
        `Intelligence can deepen partisanship. Higher reasoning power often improves a person's ability to defend the team they already favor.`,
        `Smart people are not immune to motivated reasoning. They can be better equipped for it.`
      ),
      bullet(
        `Reasoning is deeply social. People think more carefully when they expect challenge and when credibility matters.`,
        `The mind works better in good conversation than in isolated self approval.`
      ),
      bullet(
        `Good disagreement can improve thinking. Strong critics can expose holes that allies leave untouched.`,
        `Truth seeking often needs honest friction rather than comfort.`
      ),
      bullet(
        `Ask what evidence would change your mind. That question reveals whether you are investigating or only preparing a speech.`,
        `If nothing could move you, reasoning has already become performance.`
      ),
      bullet(
        `Seek disconfirming voices on purpose. The most useful feedback often comes from people who do not share your default instincts.`,
        `Opposition is not always obstruction. It can be information you were about to filter out.`
      ),
      bullet(
        `Process beats willpower. Red teams, written pre mortems, and explicit decision criteria reduce the space for motivated reasoning.`,
        `People stay fairer when the system forces comparison before commitment.`
      ),
      bullet(
        `Private reflection has real limits. Sitting alone with your thoughts does not guarantee honesty about why you want what you want.`,
        `Without external challenge, the inner lawyer usually stays in control.`
      ),
      bullet(
        `Identity raises the stakes. Once a belief becomes tied to group membership, questioning it can feel like betrayal instead of inquiry.`,
        `That is why moral arguments grow more rigid inside tribes.`
      ),
      bullet(
        `Small admissions create better thinking. When people can concede one point without losing the whole case, they become easier to reason with.`,
        `Conversation improves when accuracy is rewarded more than dominance.`
      ),
      bullet(
        `The goal is not to stop reasoning. The goal is to use reasoning where it works best, which is testing ideas in the company of others.`,
        `A social tool becomes more honest when it is used cooperatively.`
      ),
      bullet(
        `The closing lesson is disciplined truth seeking. If you know your mind argues like a lawyer, you can build habits that give the judge a fairer chance.`,
        `Humility matters, but structure matters more.`
      ),
    ],
    takeaways: [
      `Reasoning often behaves like advocacy rather than neutral inspection.`,
      `People welcome friendly evidence and attack threatening evidence asymmetrically.`,
      `Identity and group loyalty can make motivated reasoning much stronger.`,
      `Truth seeking improves when criticism is invited and processes force comparison.`,
      `Reasoning works best socially when accuracy matters more than winning.`,
    ],
    practice: [
      `Ask what evidence would genuinely change your mind before a hard discussion.`,
      `Seek one strong objection from someone who does not share your view.`,
      `Write the best case against your position before you present it.`,
      `Use decision criteria before the room starts defending preferred answers.`,
      `Reward small admissions of error in your own conversations.`,
    ],
    examples: [
      example(
        `ch02-ex01`,
        `Defending a hurt feeling`,
        [`personal`],
        `After a canceled plan, Riley starts building a complete moral case about what the cancellation means for the friendship. The more Riley thinks, the more every memory seems to support the conclusion that the friend does not care.`,
        `Separate the feeling of hurt from the story you are building around it. Ask what facts you know, what you are inferring, and what information would genuinely change your read of the situation.`,
        `The hidden problem is not that reasoning is happening. It is that reasoning is being recruited to protect a feeling that already wants a verdict.`
      ),
      example(
        `ch02-ex02`,
        `Believing the flattering story`,
        [`personal`],
        `Jordan reads a dramatic article that confirms what Jordan already suspects about a public controversy. Without checking the sourcing, Jordan starts sharing it and dismissing skeptical friends as naive.`,
        `Pause and test the claim hardest at the point where it most helps your side. Look for a source that does not share your preferred narrative and compare the strongest competing explanations.`,
        `Motivated reasoning feels cleanest when the story is emotionally satisfying. The chapter warns that agreement with your instincts is not the same as reliability.`
      ),
      example(
        `ch02-ex03`,
        `Writing the essay you already wanted to write`,
        [`school`],
        `A student begins a paper with a firm view and then quietly fills the bibliography with sources that support it. Counterevidence gets labeled weak before it receives a fair reading.`,
        `Write down the best objection to your thesis before drafting the final argument. Treat the strongest opposing source as a required part of the paper rather than a box to check.`,
        `School rewards argument quality, but argument quality drops when the research process becomes a search mission for support.`
      ),
      example(
        `ch02-ex04`,
        `Explaining away your part in the group project`,
        [`school`],
        `A group project goes badly, and everyone can list the mistakes of the other members in detail. Almost nobody is using the same scrutiny on their own missed deadlines, weak drafts, or vague communication.`,
        `Run a review that requires each person to name their own contribution to the problem before naming someone else's. Use the same standard of evidence on your own behavior that you use on the group.`,
        `Reasoning becomes more honest when self defense loses its monopoly on the conversation. That is where learning actually begins.`
      ),
      example(
        `ch02-ex05`,
        `Cherry picking after a bad launch`,
        [`work`],
        `A team reviews a weak product launch and immediately starts highlighting the metrics that make the work look better. Warning signs are treated as unusual or unfair while flattering numbers are treated as decisive.`,
        `Set the review criteria before you reopen the dashboard. Ask what evidence would count against the team's preferred story and make sure it gets equal time in the room.`,
        `The danger is not only bias. It is false confidence built on a one sided reading of the same event.`
      ),
      example(
        `ch02-ex06`,
        `Turning a strategy meeting into a search for truth`,
        [`work`],
        `An executive meeting is full of smart people, yet each person is mainly defending the plan they walked in with. The group has talent, but not a structure that rewards anyone for exposing the weakness in their own idea.`,
        `Assign someone to build the strongest case against each favored option and require leaders to answer it directly. Treat dissent as part of the decision process rather than as disloyalty.`,
        `Haidt's point is that good reasoning usually needs other minds. Intelligence helps most when it is used to test ideas, not just to protect them.`
      ),
    ],
    questions: [
      question(
        `ch02-q01`,
        `Which description best fits reasoning in this chapter?`,
        [
          `It often behaves like an advocate defending a view the mind already prefers.`,
          `It usually begins with perfect neutrality and then adds emotion later.`,
          `It matters only in academic settings and not in daily life.`,
          `It becomes useless whenever people care strongly about an issue.`,
        ],
        0,
        `Haidt compares ordinary reasoning to a lawyer more than a judge because it often protects a position that already feels right.`
      ),
      question(
        `ch02-q02`,
        `Which habit most clearly signals motivated reasoning?`,
        [
          `Accepting supportive evidence quickly while demanding much stronger proof from opposing evidence.`,
          `Checking whether your view can survive a strong objection.`,
          `Inviting someone who disagrees with you to review your argument.`,
          `Writing decision criteria before the debate starts.`,
        ],
        0,
        `Motivated reasoning shows up in the unequal standard applied to friendly and threatening evidence.`
      ),
      question(
        `ch02-q03`,
        `What question best tests whether you are actually open to changing your mind?`,
        [
          `What evidence would cause me to revise this view?`,
          `How can I explain this position more confidently?`,
          `Which friends already agree with me?`,
          `What makes the other side look weakest?`,
        ],
        0,
        `If you cannot name evidence that would move you, the reasoning process is probably serving commitment rather than inquiry.`
      ),
      question(
        `ch02-q04`,
        `A student only chooses sources that support a paper's thesis and dismisses strong counterevidence early. What is the real problem?`,
        [
          `Research has become advocacy for a preferred conclusion.`,
          `The student has too much interest in the topic.`,
          `The student should stop using reasoning altogether.`,
          `The student needs more emotional conviction.`,
        ],
        0,
        `The chapter warns that reasoning can quietly become a search for supporting evidence rather than a test of what is actually true.`
      ),
      question(
        `ch02-q05`,
        `Why can smart people still become deeply partisan?`,
        [
          `Their reasoning power can help them defend the side they already favor.`,
          `Intelligence removes all social pressure from belief formation.`,
          `Smart people do not care about group identity.`,
          `Partisanship disappears once someone is logically trained.`,
        ],
        0,
        `Higher cognitive skill can improve defense of a preferred position without improving fairness toward opposing evidence.`
      ),
      question(
        `ch02-q06`,
        `A launch review keeps highlighting flattering metrics and minimizing warning signs. What would best improve the discussion?`,
        [
          `Define the review criteria first and require the team to examine what counts against its preferred story.`,
          `Let each leader defend the numbers that help their own area most.`,
          `Avoid any negative evidence because morale matters more than accuracy.`,
          `Wait until emotions disappear before looking at the data again.`,
        ],
        0,
        `Process matters because it can force the team to examine evidence that motivated reasoning would rather ignore.`
      ),
      question(
        `ch02-q07`,
        `What makes reasoning socially useful in Haidt's account?`,
        [
          `Other people can challenge our blind spots and force better comparison.`,
          `Private reflection always reveals the true motive behind a belief.`,
          `Reasoning becomes fair whenever a person is sincere.`,
          `Group discussion works only when everyone already agrees.`,
        ],
        0,
        `Reasoning improves when it operates in a setting where objections, accountability, and comparison can correct individual bias.`
      ),
      question(
        `ch02-q08`,
        `Which decision process would best reduce motivated reasoning in a team?`,
        [
          `Using pre set criteria and assigning someone to build the strongest case against the favored option.`,
          `Letting the most senior person decide first so others can align quickly.`,
          `Asking everyone to speak from intuition only.`,
          `Skipping any formal review because smart people can self correct alone.`,
        ],
        0,
        `The chapter favors structures that make competing evidence harder to ignore and loyalty less dominant.`
      ),
      question(
        `ch02-q09`,
        `What common mistake weakens moral argument most in this chapter?`,
        [
          `Using harsher suspicion on other people's motives than on your own motives.`,
          `Caring about the truth too much.`,
          `Allowing other people to ask questions.`,
          `Changing your mind in response to better evidence.`,
        ],
        0,
        `Motivated reasoning often survives because we give ourselves a kinder reading than we give everyone else.`
      ),
      question(
        `ch02-q10`,
        `What deeper habit does this chapter try to build?`,
        [
          `A disciplined search for disconfirming evidence and better criticism.`,
          `A refusal to commit to any view under pressure.`,
          `Confidence that strong feelings guarantee accuracy.`,
          `Suspicion that reasoning never helps at all.`,
        ],
        0,
        `The goal is not cynicism about reason. It is a better use of reason through challenge, humility, and structure.`
      ),
    ],
  }),
  chapterData(3, {
    title: `Why Morality Extends Beyond Personal Gain`,
    summaries: {
      easy: [
        `Morality extends beyond personal gain, and Haidt argues that human beings are built for cooperation, reputation, and shared life rather than pure individual advantage. Moral emotions and social norms help people trust one another, punish cheating, and protect the groups they depend on.`,
        `This matters because many moral disputes are really disputes about what holds a community together. When you see morality as a system for social life, not just private preference, duties, rules, and shared standards start to make more sense.`,
      ],
      medium: [
        `Morality extends beyond personal gain, and Haidt argues that human beings are built for cooperation, reputation, and shared life rather than pure individual advantage. Moral emotions and social norms help people trust one another, punish cheating, and protect the groups they depend on. A thin model of self interest can explain exchange, but it struggles to explain duty, gratitude, loyalty, and moral anger at free riders.`,
        `This matters because many moral disputes are really disputes about what holds a community together. When you see morality as a system for social life, not just private preference, duties, rules, and shared standards start to make more sense. The chapter also explains why morality can feel both supportive and constraining. It helps groups function, but it also asks individuals to limit themselves for the sake of a larger order.`,
      ],
      hard: [
        `Morality extends beyond personal gain, and Haidt argues that human beings are built for cooperation, reputation, and shared life rather than pure individual advantage. Moral emotions and social norms help people trust one another, punish cheating, and protect the groups they depend on. A thin model of self interest can explain exchange, but it struggles to explain duty, gratitude, loyalty, and moral anger at free riders. Haidt is showing that morality is not just private calculation with better manners. It is part of the machinery that makes group life stable enough to scale.`,
        `This matters because many moral disputes are really disputes about what holds a community together. When you see morality as a system for social life, not just private preference, duties, rules, and shared standards start to make more sense. The chapter also explains why morality can feel both supportive and constraining. It helps groups function, but it also asks individuals to limit themselves for the sake of a larger order. The deeper lesson is that moral life is always balancing freedom and cohesion. Without standards, trust collapses. With overly rigid standards, groups become punitive and brittle.`,
      ],
    },
    bullets: [
      bullet(
        `Morality is about more than personal gain. Humans care about trust, duty, reputation, and shared life, not only immediate advantage.`,
        `That broader moral equipment helps groups cooperate and survive.`
      ),
      bullet(
        `Cooperation needs rules and emotions. Guilt, gratitude, anger, and admiration help people reward good partners and resist cheaters.`,
        `Reason alone is too weak to hold everyday cooperation together.`
      ),
      bullet(
        `Free riders threaten group life. People resent cheating not just because it hurts them personally but because it weakens the system everyone relies on.`,
        `Punishment and disapproval protect the common project.`
      ),
      bullet(
        `Reputation is a moral asset. People watch whether others keep promises, share burdens, and respect norms.`,
        `Moral life is public because trust depends on observed behavior.`
      ),
      bullet(
        `Duty often feels real even when it is costly. Humans will sometimes sacrifice convenience to uphold a norm or defend a group.`,
        `That makes little sense if morality is only self interest in disguise.`
      ),
      bullet(
        `Groups need common standards. Shared expectations reduce uncertainty and make cooperation less fragile.`,
        `Morality helps people know what conduct a community will praise or condemn.`
      ),
      bullet(
        `Fair exchange is only part of the picture. Loyalty, gratitude, and role based obligation also guide moral life.`,
        `A thin model of self interest cannot fully explain why these forces feel binding.`
      ),
      bullet(
        `Moral emotions help communities scale. People can cooperate with strangers more easily when norms, trust, and sanction systems are in place.`,
        `Moral order makes larger social life possible.`
      ),
      bullet(
        `Community standards can feel constraining because they are. Morality asks people to limit some impulses for the sake of living together.`,
        `The restriction is not always pleasant, but it often serves a larger social good.`
      ),
      bullet(
        `The same forces that bind can also exclude. Strong moral communities can become harsh toward people seen as disloyal or irresponsible.`,
        `Understanding the social value of morality does not require romanticizing every moral system.`
      ),
      bullet(
        `Good moral design balances trust and flexibility. A community needs norms strong enough to discourage cheating but not so rigid that they crush honest difference.`,
        `Healthy groups protect cooperation without turning every deviation into betrayal.`
      ),
      bullet(
        `Children learn morality through participation. They absorb rules, stories, approval, and disapproval from the groups around them.`,
        `Moral life is trained socially long before it is defended intellectually.`
      ),
      bullet(
        `Institutions inherit moral expectations. Schools, teams, families, and companies all depend on norms that people treat as more than private preference.`,
        `When those norms break down, coordination gets expensive fast.`
      ),
      bullet(
        `A narrow self interest model misreads moral anger. People often react strongly to conduct that threatens a shared system even when the personal cost is small.`,
        `The reaction is about protecting a social order, not just a private payoff.`
      ),
      bullet(
        `The closing lesson is that morality makes social life durable. It limits, binds, and sometimes blinds, but without it trust and cooperation stay much weaker.`,
        `To understand moral conflict, you have to understand the groups people are trying to protect.`
      ),
    ],
    takeaways: [
      `Morality helps sustain cooperation, trust, and shared standards.`,
      `Free rider anger often protects a group order rather than only a private interest.`,
      `Duty, gratitude, and loyalty cannot be reduced to simple exchange alone.`,
      `Healthy communities need both binding norms and room for honest difference.`,
      `Moral conflict often reflects competing ideas about what keeps a group together.`,
    ],
    practice: [
      `Notice one norm in your life that protects cooperation even when it feels inconvenient.`,
      `Ask what shared system a person's moral anger may be trying to defend.`,
      `Separate a private preference from a true community standard before you argue.`,
      `Name one duty you accept because a relationship depends on it.`,
      `Check whether a rule is protecting trust or only protecting habit.`,
    ],
    examples: [
      example(
        `ch03-ex01`,
        `More than a private preference at home`,
        [`personal`],
        `A household keeps fighting about chores, and one roommate treats the issue as a matter of personal style. The others feel a stronger moral charge because the real issue is whether everyone can trust the shared arrangement.`,
        `Frame the conversation around fairness, reliability, and the kind of home everyone is trying to maintain. Move the discussion from irritation about small acts to the shared standard those acts are shaping.`,
        `The hidden issue is not only mess or convenience. It is whether a common life can work when one person treats shared burdens as optional.`
      ),
      example(
        `ch03-ex02`,
        `Keeping trust with a friend group`,
        [`personal`],
        `A friend promises to help with an important move, cancels late, and acts as if the problem is only logistical. The rest of the group reacts more strongly because the broken promise affects how dependable everyone seems to one another.`,
        `Address the missed commitment as a trust issue, not only a scheduling issue. Ask what kind of reliability the friendship group needs if people are going to keep relying on one another.`,
        `Moral disappointment often reaches beyond the single event. It points to whether a small community can count on its own rules.`
      ),
      example(
        `ch03-ex03`,
        `Why cheating bothers the whole class`,
        [`school`],
        `Students hear that several classmates are using unauthorized help on major assignments. Even students who are not directly harmed feel angry because the cheating weakens the fairness of the whole course.`,
        `Discuss the issue as a problem of trust and shared standards, not only as a private shortcut by a few students. Make clear how the behavior changes the meaning of everyone else's effort.`,
        `The chapter explains why moral anger can be group focused. People defend norms because the group depends on them, not just because of personal loss.`
      ),
      example(
        `ch03-ex04`,
        `Carrying the club together`,
        [`school`],
        `A student organization keeps relying on the same few members to do the work while others enjoy the status and benefits. The resentment grows because the arrangement feels like a moral failure, not just an uneven task list.`,
        `Set visible expectations for contribution and make the shared purpose explicit. If someone wants the identity and benefits of membership, they should also carry a fair share of the burden.`,
        `Groups hold together when duties feel real. When too many people coast, the moral fabric of the group weakens along with the workload balance.`
      ),
      example(
        `ch03-ex05`,
        `Protecting credit and responsibility`,
        [`work`],
        `A team member keeps presenting group wins as personal wins while staying quiet about who carried the difficult parts. Coworkers are upset because the behavior distorts the trust and reciprocity the team relies on.`,
        `Name the issue as a norm problem, not only as a personality problem. Clarify how credit should be shared if people are going to keep helping one another without resentment.`,
        `Teams depend on moral expectations as much as technical skill. Recognition rules shape whether cooperation keeps happening.`
      ),
      example(
        `ch03-ex06`,
        `Expense rules and shared trust`,
        [`work`],
        `An employee keeps bending a reimbursement policy in ways that seem small in isolation. Others react strongly because the behavior signals that common rules apply only when they are convenient.`,
        `Address the pattern in terms of trust in the system rather than only the dollar amount involved. Explain how small exceptions can quietly teach a group that fairness is optional.`,
        `Moral systems break down through repeated small evasions as much as through dramatic misconduct. People care because the shared order is what makes cooperation workable.`
      ),
    ],
    questions: [
      question(
        `ch03-q01`,
        `What broader job does morality perform in this chapter?`,
        [
          `It supports cooperation, trust, and shared standards in group life.`,
          `It mainly helps individuals maximize private gain more efficiently.`,
          `It replaces all practical incentives with pure idealism.`,
          `It matters only in formal legal settings.`,
        ],
        0,
        `Haidt argues that morality helps groups coordinate, trust, and punish cheating in ways that simple self interest cannot explain well.`
      ),
      question(
        `ch03-q02`,
        `Why do people often react strongly to free riders even when the direct personal cost is small?`,
        [
          `Because free riding threatens the system of trust and cooperation everyone depends on.`,
          `Because people only care about symbolic violations.`,
          `Because punishment always benefits the punisher immediately.`,
          `Because morality has nothing to do with shared life.`,
        ],
        0,
        `The anger often protects a common order, not only a single private payoff.`
      ),
      question(
        `ch03-q03`,
        `Which example best fits the chapter's view of morality beyond self interest?`,
        [
          `A student reports cheating because it weakens the fairness of the class for everyone.`,
          `A shopper buys a cheaper product with no effect on anyone else.`,
          `A friend chooses a favorite movie for personal enjoyment.`,
          `An athlete improves because winning feels good.`,
        ],
        0,
        `The chapter emphasizes moral concern for shared systems, not just private preference or advantage.`
      ),
      question(
        `ch03-q04`,
        `Why do loyalty and duty matter in Haidt's account?`,
        [
          `They help groups hold together in ways that cannot be explained by exchange alone.`,
          `They are illusions that disappear once people calculate carefully.`,
          `They matter only in military settings.`,
          `They are always signs of blind conformity.`,
        ],
        0,
        `The chapter argues that moral life includes obligations that feel real even when they are costly and not immediately profitable.`
      ),
      question(
        `ch03-q05`,
        `A roommate says chore complaints are only about personal taste, but the rest of the apartment feels morally frustrated. What is the deeper issue?`,
        [
          `The shared arrangement depends on fairness and reliability, not only on individual preference.`,
          `No one should care because chores are never moral.`,
          `The best response is to let everyone follow private rules only.`,
          `The conflict exists only because emotions are too strong.`,
        ],
        0,
        `The chapter would treat the dispute as a problem of sustaining a common life, not just managing isolated tastes.`
      ),
      question(
        `ch03-q06`,
        `A worker keeps taking group credit in subtle ways. Why does the team react so strongly?`,
        [
          `Because the behavior threatens the reciprocity and trust that future cooperation depends on.`,
          `Because teams only care about appearances.`,
          `Because moral anger is always irrational at work.`,
          `Because recognition does not affect cooperation.`,
        ],
        0,
        `The team is reacting to a threat to the moral rules that make collaboration sustainable.`
      ),
      question(
        `ch03-q07`,
        `What does a thin self interest model fail to explain well?`,
        [
          `Why people care about duty, gratitude, and the policing of shared norms.`,
          `Why people enjoy personal rewards.`,
          `Why people notice clear incentives.`,
          `Why groups can never enforce any standard.`,
        ],
        0,
        `Haidt argues that many moral emotions and obligations make little sense if self interest is the whole story.`
      ),
      question(
        `ch03-q08`,
        `What would a healthy moral community look like in this chapter?`,
        [
          `Strong enough to protect trust, but flexible enough not to punish every difference as betrayal.`,
          `Free of any shared standards at all.`,
          `Built entirely on fear of punishment.`,
          `Focused only on private gain and never on common goods.`,
        ],
        0,
        `The chapter allows for a balance. Norms are necessary, but excessive rigidity can make a group brittle and harsh.`
      ),
      question(
        `ch03-q09`,
        `Why does reputation matter so much in moral life?`,
        [
          `Trust depends on whether other people believe you will carry your part of the shared burden.`,
          `Reputation matters only because people enjoy gossip.`,
          `Moral systems work fine without any public expectations.`,
          `A good reputation removes the need for rules entirely.`,
        ],
        0,
        `Reputation signals whether a person can be relied on within a network of cooperation.`
      ),
      question(
        `ch03-q10`,
        `What deeper lesson does this chapter leave with the reader?`,
        [
          `Moral life is one of the systems that makes durable social cooperation possible.`,
          `Morality should be reduced to personal taste whenever groups disagree.`,
          `Rules matter only when they are personally profitable.`,
          `All moral anger is a disguised private grievance.`,
        ],
        0,
        `The chapter broadens morality from private preference to the social infrastructure of trust, duty, and cooperation.`
      ),
    ],
  }),
  chapterData(4, {
    title: `The Mind Has a Fast Driver and a Story Teller`,
    summaries: {
      easy: [
        `The mind works like a rider on an elephant, and Haidt says conscious reasoning is more like a guide and storyteller than a true ruler. Intuitions, emotions, and habits provide most of the power, while the rider explains, justifies, and occasionally nudges the direction.`,
        `This matters because self control improves when you stop treating willpower as the whole answer. Change happens more reliably when you train intuition, shape environments, and practice habits that make the elephant easier to steer.`,
      ],
      medium: [
        `The mind works like a rider on an elephant, and Haidt says conscious reasoning is more like a guide and storyteller than a true ruler. Intuitions, emotions, and habits provide most of the power, while the rider explains, justifies, and occasionally nudges the direction. The image is helpful because it shows both the limits of conscious control and the real though smaller influence the rider still has.`,
        `This matters because self control improves when you stop treating willpower as the whole answer. Change happens more reliably when you train intuition, shape environments, and practice habits that make the elephant easier to steer. The chapter turns moral growth into a design problem as much as a decision problem. Better cues, better repetition, and better social settings can teach the elephant what the rider cannot simply command.`,
      ],
      hard: [
        `The mind works like a rider on an elephant, and Haidt says conscious reasoning is more like a guide and storyteller than a true ruler. Intuitions, emotions, and habits provide most of the power, while the rider explains, justifies, and occasionally nudges the direction. The image is helpful because it shows both the limits of conscious control and the real though smaller influence the rider still has. The rider can plan, name goals, and redesign conditions, but it usually fails when it tries to overpower the elephant in one heroic burst.`,
        `This matters because self control improves when you stop treating willpower as the whole answer. Change happens more reliably when you train intuition, shape environments, and practice habits that make the elephant easier to steer. The chapter turns moral growth into a design problem as much as a decision problem. Better cues, better repetition, and better social settings can teach the elephant what the rider cannot simply command. The deeper lesson is hopeful precisely because it is realistic. People change best when they respect the scale of the forces they are trying to direct.`,
      ],
    },
    bullets: [
      bullet(
        `The elephant supplies most of the power. Intuition, emotion, and habit drive action far more often than conscious reasoning does.`,
        `The rider feels in charge because it speaks in words, but words do not provide most of the force.`
      ),
      bullet(
        `The rider is a skilled storyteller. Conscious reasoning explains, justifies, and plans, yet it often arrives after movement has already begun.`,
        `That is why people can sound deliberate while mainly describing what the elephant already wants.`
      ),
      bullet(
        `Willpower is real but limited. The rider can tug, warn, and occasionally redirect, but it tires quickly when it fights the elephant head on.`,
        `Lasting change needs more than heroic self control in the moment.`
      ),
      bullet(
        `Training beats forcing. Repetition, practice, and stable cues gradually teach the elephant new defaults.`,
        `Habits are powerful because they change what feels natural before the rider starts arguing.`
      ),
      bullet(
        `Emotion can move the elephant faster than logic. Images, stories, music, belonging, and example often shift behavior more effectively than abstract reasons.`,
        `If you want change, you have to speak to the part of the mind that actually moves.`
      ),
      bullet(
        `The social world helps steer intuition. People borrow tone, courage, fear, and moral posture from the groups around them.`,
        `Environment is not background. It is part of the steering system.`
      ),
      bullet(
        `Good environments reduce the need for struggle. When cues, norms, and routines support the right behavior, the rider does not have to win the same fight every day.`,
        `Design can do what raw resolve cannot sustain.`
      ),
      bullet(
        `Self knowledge matters because elephants have patterns. Each person has triggers, comforts, and stories that either strengthen or weaken control.`,
        `Seeing those patterns makes change more practical.`
      ),
      bullet(
        `Shame rarely trains well. Harsh self attack can frighten the elephant without teaching it where to go.`,
        `Guidance works better when it combines honesty with usable structure.`
      ),
      bullet(
        `Small wins matter. Each successful repetition teaches the elephant what future action should feel like.`,
        `Momentum grows when the desired move becomes more familiar and less effortful.`
      ),
      bullet(
        `Reason still matters, but not as a commander. The rider can choose goals, shape conditions, and interpret experience in ways that slowly retrain intuition.`,
        `Planning is strongest when it respects the scale of the task.`
      ),
      bullet(
        `Moral growth is often indirect. You become kinder, braver, or steadier not only by deciding to be that way but by practicing the situations that call it out.`,
        `Character is built through repeated contact with lived conditions.`
      ),
      bullet(
        `Persuasion works better when it reaches both parts. A strong case needs clear reasons and some felt connection that makes the reasons land.`,
        `Facts alone often bounce off an unmoved elephant.`
      ),
      bullet(
        `Failure is often a design problem, not only a character problem. When someone keeps repeating a bad pattern, the cue system may be helping the problem survive.`,
        `Repair becomes easier when you change the setup instead of only blaming the self.`
      ),
      bullet(
        `The closing lesson is realistic self control. Progress comes when the rider stops pretending to be a king and starts acting like a trainer.`,
        `That shift makes change slower, wiser, and more durable.`
      ),
    ],
    takeaways: [
      `The rider can guide, but the elephant supplies most of the force.`,
      `Habits, cues, and emotion shape moral action more than pure willpower does.`,
      `Better environments often succeed where repeated self scolding fails.`,
      `Change sticks when the elephant is trained rather than repeatedly overpowered.`,
      `Reason matters most when it plans and reshapes conditions for future action.`,
    ],
    practice: [
      `Pick one recurring moral failure and map the cue that usually starts it.`,
      `Design one small environment change that helps the better action feel easier.`,
      `Practice the desired move when the stakes are low so it feels less foreign later.`,
      `Use stories, examples, or reminders that move you emotionally, not only logically.`,
      `Measure progress by repetition and setup, not only by dramatic moments of willpower.`,
    ],
    examples: [
      example(
        `ch04-ex01`,
        `Not sending the angry text`,
        [`personal`],
        `After a tense exchange, Maya feels the urge to send a late night text that will likely make the conflict worse. The rider knows it is a bad idea, but the elephant wants immediate release.`,
        `Create a rule that no charged message gets sent without a delay and a reread in the morning. Replace the instant action with a small routine that gives the elephant another path to discharge the emotion.`,
        `The problem is not only weak intention. It is that the emotional system is already moving and needs structure, not a speech, if you want a better outcome.`
      ),
      example(
        `ch04-ex02`,
        `Changing a health habit realistically`,
        [`personal`],
        `Jordan keeps deciding to eat better and then drifting back into the same evening routine. The plan keeps relying on resolve at the exact hour when energy and attention are already low.`,
        `Change the setup before the vulnerable moment arrives. Remove the easiest bad cue, prepare the easier good option, and make the desired action the path of least resistance.`,
        `The chapter suggests that repeated failure often points to poor design, not only poor character. The rider keeps asking too much from the elephant at the worst possible time.`
      ),
      example(
        `ch04-ex03`,
        `Studying before panic takes over`,
        [`school`],
        `A student keeps waiting until fear is intense before beginning a major assignment. By then the elephant has learned to connect the work with dread and avoidance.`,
        `Break the task into an early routine that feels small enough to start before panic builds. Use a consistent place and time so beginning the work becomes a cue driven act instead of a daily negotiation.`,
        `The goal is to teach the elephant a new default. Small consistent starts do more than grand speeches about discipline.`
      ),
      example(
        `ch04-ex04`,
        `Using feedback without shutting down`,
        [`school`],
        `A professor gives hard feedback, and the first reaction is embarrassment followed by a rush to explain why the criticism is unfair. The rider wants to learn, but the elephant is protecting status.`,
        `Delay the response, summarize the feedback in writing, and identify one useful correction before defending yourself. Give the emotional reaction time to settle before deciding what is true in the critique.`,
        `The chapter matters here because the first response is about protection, not learning. Training a better pause changes what the feedback can become.`
      ),
      example(
        `ch04-ex05`,
        `Helping a team hear a hard message`,
        [`work`],
        `A manager knows the team needs to change a failing process, but every previous explanation has landed as blame. The facts are clear, yet the room keeps getting more defensive.`,
        `Use examples, visible patterns, and a clear shared goal so the message reaches emotion as well as logic. Pair the critique with a workable next step that makes the better behavior easier to enact immediately.`,
        `People rarely change because the rider was given more sentences. They change when the elephant can feel the path and the stakes clearly enough to move.`
      ),
      example(
        `ch04-ex06`,
        `Building a better default at work`,
        [`work`],
        `A team says it wants thoughtful meetings, but the routine still rewards whoever speaks first and strongest. Everyone leaves with the same shallow habit because the setup keeps training the elephant in the same direction.`,
        `Redesign the meeting so people write first, rank options before discussion, and revisit assumptions after hearing others. The structure should make the wiser behavior feel normal instead of heroic.`,
        `The chapter's lesson is that repeated group behavior reflects training. If you want a different result, you have to retrain the setting, not just praise a better ideal.`
      ),
    ],
    questions: [
      question(
        `ch04-q01`,
        `In the rider and elephant image, what does the elephant represent most strongly?`,
        [
          `The large intuitive and emotional system that supplies most of the motivational force.`,
          `The fully rational part of the mind that makes every decision.`,
          `A separate social identity that never changes.`,
          `The part of the mind that has no influence on action.`,
        ],
        0,
        `The elephant stands for intuition, emotion, and habit, which usually carry far more force than deliberate reasoning alone.`
      ),
      question(
        `ch04-q02`,
        `What is the rider usually best at in this chapter?`,
        [
          `Explaining, planning, and occasionally guiding rather than fully commanding.`,
          `Controlling all behavior through willpower.`,
          `Removing emotion from every moral judgment.`,
          `Working independently from the elephant.`,
        ],
        0,
        `Haidt gives the rider a real but limited role. It can guide and plan, but it is not an all powerful ruler.`
      ),
      question(
        `ch04-q03`,
        `Why does willpower often fail as a long term strategy for change?`,
        [
          `Because the rider tires quickly when it tries to overpower a much larger system by force alone.`,
          `Because the elephant never changes under any condition.`,
          `Because habits are weaker than conscious intention.`,
          `Because emotions disappear once a plan is made.`,
        ],
        0,
        `The chapter argues that direct struggle is usually too weak and too exhausting to work by itself over time.`
      ),
      question(
        `ch04-q04`,
        `A person keeps sending reactive messages late at night and regretting them later. Which fix best fits this chapter?`,
        [
          `Create a delay rule and a replacement routine before the emotional moment arrives.`,
          `Keep relying on in the moment self lectures.`,
          `Assume the pattern proves the person has no values.`,
          `Remove all emotion from the relationship.`,
        ],
        0,
        `The best answer reshapes the environment and routine so the elephant has a better path when the cue appears.`
      ),
      question(
        `ch04-q05`,
        `What kind of change does the chapter treat as most durable?`,
        [
          `Change that retrains intuition through habit, repetition, and better cues.`,
          `Change that depends on one dramatic burst of resolve.`,
          `Change that ignores the social environment completely.`,
          `Change that focuses only on abstract argument.`,
        ],
        0,
        `Durable improvement comes when new defaults are taught to the elephant instead of merely demanded by the rider.`
      ),
      question(
        `ch04-q06`,
        `Why can stories and examples shift behavior more effectively than abstract reasons alone?`,
        [
          `They move the elephant, which is the part that carries most action.`,
          `They eliminate the need for any reasoning.`,
          `They prove emotion is always superior to thought.`,
          `They work only on people with weak self control.`,
        ],
        0,
        `The chapter does not dismiss reason. It shows that emotion and felt connection often move the motivational system faster.`
      ),
      question(
        `ch04-q07`,
        `A student keeps procrastinating until panic is high. What is the deeper mistake?`,
        [
          `The plan depends on late heroics instead of training an earlier easier routine.`,
          `The student has too much information about the task.`,
          `The only solution is harsher self criticism.`,
          `Panic is a reliable way to train good habits.`,
        ],
        0,
        `The rider keeps waiting for a huge act of control when the elephant needs a smaller and more repeatable cue structure.`
      ),
      question(
        `ch04-q08`,
        `What role does the social environment play in this chapter?`,
        [
          `It helps steer intuition by shaping tone, norms, and what feels natural.`,
          `It matters only after a person has already mastered self control.`,
          `It has no effect on moral action.`,
          `It weakens every attempt at change.`,
        ],
        0,
        `The environment is part of the steering system because people absorb cues and expectations from the groups around them.`
      ),
      question(
        `ch04-q09`,
        `Which statement best captures the chapter's view of failure?`,
        [
          `Repeated failure often points to poor design and poor cues, not only weak character.`,
          `Failure always proves the elephant cannot learn.`,
          `Failure is solved by more shame and no other change.`,
          `Failure means reasoning is irrelevant.`,
        ],
        0,
        `Haidt suggests that many bad patterns survive because the setup keeps rewarding them.`
      ),
      question(
        `ch04-q10`,
        `What deeper habit does this chapter try to build?`,
        [
          `Realistic self control that trains intuition instead of pretending to command it instantly.`,
          `A refusal to plan for difficult moments at all.`,
          `Confidence that emotion should always lead.`,
          `Belief that the rider has no useful role in moral life.`,
        ],
        0,
        `The chapter keeps both parts of the image in view. The rider matters most when it plans, designs, and trains well.`
      ),
    ],
  }),
  chapterData(5, {
    title: `The Main Moral Foundations People Use`,
    summaries: {
      easy: [
        `People rely on several main moral foundations, and Haidt argues that care, fairness, loyalty, authority, sanctity, and liberty act like recurring taste receptors in moral life. Different people and cultures combine these concerns differently, which is why serious disagreement can arise even when everyone thinks they are being principled.`,
        `This matters because moral conflict becomes easier to read once you stop assuming that one moral language should explain everything. The chapter helps you translate disputes by asking which foundations are doing the work and which ones a person may be ignoring.`,
      ],
      medium: [
        `People rely on several main moral foundations, and Haidt argues that care, fairness, loyalty, authority, sanctity, and liberty act like recurring taste receptors in moral life. Different people and cultures combine these concerns differently, which is why serious disagreement can arise even when everyone thinks they are being principled. The foundations are not full moral systems by themselves, but they are reliable building blocks that show up again and again.`,
        `This matters because moral conflict becomes easier to read once you stop assuming that one moral language should explain everything. The chapter helps you translate disputes by asking which foundations are doing the work and which ones a person may be ignoring. It also explains why people can sound heartless, naive, rigid, or disloyal to one another while each side is actually defending a different part of the moral map.`,
      ],
      hard: [
        `People rely on several main moral foundations, and Haidt argues that care, fairness, loyalty, authority, sanctity, and liberty act like recurring taste receptors in moral life. Different people and cultures combine these concerns differently, which is why serious disagreement can arise even when everyone thinks they are being principled. The foundations are not full moral systems by themselves, but they are reliable building blocks that show up again and again. Haidt's deeper claim is that moral diversity is partly structured rather than random. People are often drawing from different moral equipment, not merely making inconsistent noise.`,
        `This matters because moral conflict becomes easier to read once you stop assuming that one moral language should explain everything. The chapter helps you translate disputes by asking which foundations are doing the work and which ones a person may be ignoring. It also explains why people can sound heartless, naive, rigid, or disloyal to one another while each side is actually defending a different part of the moral map. The deeper lesson is about blind spots. Every foundation can protect something important, and every foundation can become distorted when it rules without competition from the others.`,
      ],
    },
    bullets: [
      bullet(
        `There is more than one moral taste. Haidt argues that moral life is built from several recurring foundations rather than one master principle.`,
        `That is why people can disagree deeply while each side still feels sincerely moral.`
      ),
      bullet(
        `Care protects the vulnerable. This foundation responds to suffering, cruelty, and the need to shield people from harm.`,
        `It becomes especially visible when someone feels a duty to protect the weak.`
      ),
      bullet(
        `Fairness tracks cheating, reciprocity, and proportionality. People use it to ask whether benefits and burdens are being distributed in a legitimate way.`,
        `Different groups define fairness differently, but the concern appears widely.`
      ),
      bullet(
        `Loyalty binds people into teams. It values standing with a group, honoring commitments, and resisting betrayal.`,
        `This foundation helps explain why group desertion can feel morally charged even when no formal rule was broken.`
      ),
      bullet(
        `Authority organizes role and order. It responds to duty, legitimate hierarchy, and the expectation that some positions deserve deference.`,
        `People who rely on it strongly often see disrespect and disorder faster than others do.`
      ),
      bullet(
        `Sanctity protects boundaries. It shows up in reactions to contamination, degradation, and things a community treats as elevated or sacred.`,
        `This foundation can govern bodies, spaces, symbols, and ways of life.`
      ),
      bullet(
        `Liberty resists domination. It activates when people feel bullied, trapped, or controlled by someone with too much power.`,
        `The core concern is not only freedom in the abstract but protection from oppression.`
      ),
      bullet(
        `The foundations are like taste buds, not full meals. They offer recurring sensitivities that cultures then elaborate into complete moral systems.`,
        `This makes the model structured without pretending every morality is identical.`
      ),
      bullet(
        `People differ in calibration. The same event can feel mainly cruel to one person, unfair to another, and disloyal to someone else.`,
        `The moral reaction depends on which foundations fire most strongly.`
      ),
      bullet(
        `Moral arguments sound bizarre when the active foundations differ. People talk past each other because they are protecting different things.`,
        `Translation matters more than louder assertion.`
      ),
      bullet(
        `Each foundation has strengths and blind spots. Care can become naive, loyalty can become exclusion, authority can become submission, and liberty can become suspicion of all structure.`,
        `Moral maturity requires balancing goods, not idolizing one of them.`
      ),
      bullet(
        `Institutions reward different moral languages. Families, churches, teams, schools, markets, and states all lean on different combinations of foundations.`,
        `That is why the same person can sound morally different across settings.`
      ),
      bullet(
        `Good disagreement begins with moral translation. Ask which foundation the other person is protecting before you decide they are simply wrong or cold.`,
        `That question reduces confusion and makes critique sharper.`
      ),
      bullet(
        `A one foundation morality will miss real human concerns. No single foundation can carry the whole weight of social life by itself.`,
        `Plural moral grammar explains more of the world than moral monoculture does.`
      ),
      bullet(
        `The closing lesson is that moral diversity has structure. Once you can hear the foundations inside an argument, conflict becomes more intelligible and judgment becomes less shallow.`,
        `The map does not solve every dispute, but it helps you see what the dispute is really about.`
      ),
    ],
    takeaways: [
      `Care, fairness, loyalty, authority, sanctity, and liberty form a useful map of recurring moral concerns.`,
      `People often clash because different foundations fire first, not because only one side has morals.`,
      `Each foundation protects something real and creates blind spots when it dominates alone.`,
      `Moral translation improves both understanding and critique.`,
      `The model is plural rather than one note, which is why it explains more kinds of disagreement.`,
    ],
    practice: [
      `In your next disagreement, ask which foundation the other person may be protecting.`,
      `Notice which two foundations you rely on most naturally and which one you tend to neglect.`,
      `Translate one policy dispute into at least two different moral languages.`,
      `Test whether your idea of fairness is really equality, reciprocity, or proportional reward.`,
      `Ask what good a foundation protects before naming its possible excess.`,
    ],
    examples: [
      example(
        `ch05-ex01`,
        `When cleanliness becomes moral`,
        [`personal`],
        `One roommate treats kitchen hygiene as a basic matter of respect and another treats it as a flexible preference. The argument keeps escalating because one person is reacting through sanctity while the other is still hearing a style complaint.`,
        `Stop arguing at the level of annoyance and name the underlying concern directly. Ask whether the issue is comfort, contamination, respect for shared space, or all three, then build a rule that matches the real concern.`,
        `The hidden conflict is moral language mismatch. Once the active foundation is visible, the dispute becomes easier to solve and easier to judge fairly.`
      ),
      example(
        `ch05-ex02`,
        `Family loyalty versus personal choice`,
        [`personal`],
        `A family is upset that a member skipped an important event for an individual opportunity. The person who skipped it sees the choice as reasonable, while others feel a loyalty violation that is much larger than a calendar issue.`,
        `Name the conflict as loyalty versus personal autonomy instead of pretending one side is merely emotional. Then ask what future expectation the family actually wants to protect and whether that expectation is fair.`,
        `The foundations model helps because it shows that the fight is not just about time management. It is about which moral claim gets priority when values compete.`
      ),
      example(
        `ch05-ex03`,
        `Reading the hidden values in a campus rule`,
        [`school`],
        `Students react strongly to a proposed campus conduct rule, but they are not all reacting to the same thing. Some care most about safety, others about fairness of enforcement, and others about liberty from overreach.`,
        `Map the objections by foundation before treating them as one pile of resistance. The discussion will improve once people can see whether they are arguing about harm, domination, fairness, or respect for order.`,
        `Many school conflicts get muddled because several moral foundations are active at once. Translation brings structure back into the conversation.`
      ),
      example(
        `ch05-ex04`,
        `Why a teacher's tone matters`,
        [`school`],
        `A professor publicly corrects a student in a way that some classmates see as necessary authority and others see as disrespectful or unfair. The same moment splits the room because different moral foundations are interpreting it differently.`,
        `Discuss the incident by separating the authority question from the care and fairness questions. Ask whether the teacher was preserving order, humiliating a student, or trying to do both poorly at once.`,
        `The chapter matters because complex moral scenes often contain several legitimate concerns, not one clean answer that everyone simply missed.`
      ),
      example(
        `ch05-ex05`,
        `The team star who breaks trust`,
        [`work`],
        `A top performer delivers great numbers but keeps undermining teammates and ignoring shared commitments. Leadership is split between fairness to results, loyalty to the team, and respect for formal authority.`,
        `Name the foundations in conflict before deciding what standard should dominate. Then decide what message the final choice will send about performance, belonging, and the legitimacy of leadership.`,
        `Work conflicts often stay muddy because leaders talk as if only one foundation matters. A clearer moral map leads to clearer decisions.`
      ),
      example(
        `ch05-ex06`,
        `Safety rules and moral language`,
        [`work`],
        `An employee rolls eyes at a safety procedure that seems excessive. One manager sees the reaction as insubordination, another sees it as a liberty complaint, and another sees it as a direct care issue because people could get hurt.`,
        `Separate the authority, liberty, and care concerns before handling the issue. Explain what the rule protects, what room exists for reasonable challenge, and what kind of dissent still counts as responsible.`,
        `The foundations model helps leaders respond to the actual moral structure of the problem instead of collapsing everything into attitude.`
      ),
    ],
    questions: [
      question(
        `ch05-q01`,
        `What is the main idea behind moral foundations in this chapter?`,
        [
          `Moral life draws on several recurring concerns rather than one single moral principle.`,
          `Every moral argument is really about fairness only.`,
          `People have no stable moral patterns across situations.`,
          `Cultures invent morality with no shared human tendencies at all.`,
        ],
        0,
        `Haidt presents several recurring foundations as a structured way to explain moral diversity.`
      ),
      question(
        `ch05-q02`,
        `Which foundation is most directly activated by concern for suffering and protection of the vulnerable?`,
        [
          `Care`,
          `Loyalty`,
          `Authority`,
          `Sanctity`,
        ],
        0,
        `Care focuses on harm, suffering, and the moral impulse to protect.`
      ),
      question(
        `ch05-q03`,
        `Which statement best fits the chapter's view of fairness?`,
        [
          `It concerns cheating, reciprocity, and legitimate distribution, not just one fixed formula.`,
          `It always means equal outcomes in every context.`,
          `It is less important than loyalty in all cultures.`,
          `It appears only in legal systems.`,
        ],
        0,
        `Haidt treats fairness as a broad moral concern whose exact interpretation can vary.`
      ),
      question(
        `ch05-q04`,
        `A friend is furious that someone skipped a key family event for a personal opportunity. Which foundation is most visibly active in that reaction?`,
        [
          `Loyalty`,
          `Sanctity`,
          `Liberty`,
          `Care only`,
        ],
        0,
        `The reaction is centered on commitment to the group and the moral weight of standing with one's people.`
      ),
      question(
        `ch05-q05`,
        `A student objects to a public correction from a professor because it felt humiliating, while another student defends it as needed order. What does the chapter help you see?`,
        [
          `Different moral foundations are interpreting the same event in different ways.`,
          `One student must be irrational because authority and care cannot clash.`,
          `The event has no moral content at all.`,
          `Only the professor's intent matters.`,
        ],
        0,
        `The foundations model makes sense of why one scene can trigger several moral readings at once.`
      ),
      question(
        `ch05-q06`,
        `Which foundation is most concerned with resisting domination and bullying?`,
        [
          `Liberty`,
          `Authority`,
          `Sanctity`,
          `Loyalty`,
        ],
        0,
        `Liberty responds strongly when power feels oppressive or controlling.`
      ),
      question(
        `ch05-q07`,
        `What is the best way to use the foundations model in a disagreement?`,
        [
          `Translate the conflict by asking which foundation each side is protecting.`,
          `Use it to prove that one foundation should silence all the others.`,
          `Treat every disagreement as random emotion with no structure.`,
          `Ignore the other person's stated concerns and talk louder.`,
        ],
        0,
        `The map is most useful when it helps you understand the moral language in play before you critique it.`
      ),
      question(
        `ch05-q08`,
        `Why are the foundations compared to taste buds rather than complete meals?`,
        [
          `They are recurring sensitivities that cultures combine into fuller moral systems.`,
          `They are subjective in the sense that nothing moral can be discussed rationally.`,
          `They make every culture morally identical.`,
          `They only apply to private preference.`,
        ],
        0,
        `The taste bud image suggests structured diversity. The foundations recur, but cultures build larger systems from them.`
      ),
      question(
        `ch05-q09`,
        `What is a major risk of building morality around only one foundation?`,
        [
          `Important human concerns protected by other foundations can be ignored or misread.`,
          `The resulting moral view becomes easier for everyone to accept.`,
          `Disagreement disappears because the system is simpler.`,
          `People stop having any blind spots at all.`,
        ],
        0,
        `Each foundation protects something valuable, so a one note morality tends to become blind in predictable ways.`
      ),
      question(
        `ch05-q10`,
        `What deeper habit does this chapter encourage?`,
        [
          `Hearing moral pluralism without collapsing into moral confusion.`,
          `Reducing every moral dispute to harm alone.`,
          `Treating all foundations as equally right in every case.`,
          `Avoiding judgment whenever values conflict.`,
        ],
        0,
        `The chapter aims for a richer moral vocabulary that improves understanding without ending evaluation.`
      ),
    ],
  }),
  chapterData(6, {
    title: `Politics Uses Different Moral Taste Profiles`,
    summaries: {
      easy: [
        `Politics draws on different moral taste profiles, and Haidt argues that liberals and conservatives often prioritize different moral foundations rather than simply holding different facts. Liberals tend to lean more on care, fairness, and liberty from oppression, while conservatives more often draw on a broader spread that also includes loyalty, authority, and sanctity.`,
        `This matters because political persuasion fails when people speak only in their own moral language. If you want to understand or influence another side, you have to grasp what they see as morally urgent before you tell them why they are wrong.`,
      ],
      medium: [
        `Politics draws on different moral taste profiles, and Haidt argues that liberals and conservatives often prioritize different moral foundations rather than simply holding different facts. Liberals tend to lean more on care, fairness, and liberty from oppression, while conservatives more often draw on a broader spread that also includes loyalty, authority, and sanctity. The point is not that every person fits a rigid box. It is that political camps develop recognizably different moral matrices.`,
        `This matters because political persuasion fails when people speak only in their own moral language. If you want to understand or influence another side, you have to grasp what they see as morally urgent before you tell them why they are wrong. The chapter also explains why each camp can find the other morally deficient. People are often hearing silence where the other side hears one of its most important values.`,
      ],
      hard: [
        `Politics draws on different moral taste profiles, and Haidt argues that liberals and conservatives often prioritize different moral foundations rather than simply holding different facts. Liberals tend to lean more on care, fairness, and liberty from oppression, while conservatives more often draw on a broader spread that also includes loyalty, authority, and sanctity. The point is not that every person fits a rigid box. It is that political camps develop recognizably different moral matrices, which then shape what feels obviously right, dangerous, or insulting.`,
        `This matters because political persuasion fails when people speak only in their own moral language. If you want to understand or influence another side, you have to grasp what they see as morally urgent before you tell them why they are wrong. The chapter also explains why each camp can find the other morally deficient. People are often hearing silence where the other side hears one of its most important values. The deeper lesson is strategic as well as ethical. Moral translation is one of the few ways to lower contempt without flattening real disagreement.`
      ],
    },
    bullets: [
      bullet(
        `Political conflict is often moral conflict in disguise. People weigh different foundations differently and then argue as if only facts are dividing them.`,
        `That is why persuasion fails even when both sides have access to similar information.`
      ),
      bullet(
        `Liberals often center care, fairness, and liberty from oppression. Harm reduction and protection from domination carry special moral weight in that matrix.`,
        `These concerns shape what feels urgent and what feels unjust.`
      ),
      bullet(
        `Conservatives often draw on a broader set that includes loyalty, authority, and sanctity along with care and fairness.`,
        `That wider spread changes how conservatives read order, tradition, and social breakdown.`
      ),
      bullet(
        `Libertarian thinking gives unusual centrality to liberty. The moral focus falls heavily on coercion, state overreach, and personal autonomy.`,
        `This profile can overlap with either camp on some issues while still sounding distinct.`
      ),
      bullet(
        `The same event can trigger different moral alarms in different groups. One side sees cruelty, another sees chaos, another sees betrayal, and another sees domination.`,
        `Political language hides these differences more often than it reveals them.`
      ),
      bullet(
        `Moral monism creates political blindness. If you think your favorite foundation explains every issue, other people start looking either stupid or evil.`,
        `The chapter warns against mistaking moral narrowness for moral clarity.`
      ),
      bullet(
        `Persuasion works better in the listener's moral language. People rarely move because you ignored the value they care about most.`,
        `Translation is not manipulation. It is respect for how moral cognition works.`
      ),
      bullet(
        `Contempt grows when camps cannot hear each other's moral motives. Silence on a value often gets interpreted as indifference or malice.`,
        `That is one reason polarization hardens so quickly.`
      ),
      bullet(
        `Not every individual fits the average pattern. Moral matrices describe tendencies inside groups, not perfect portraits of every person.`,
        `The model helps most when it opens inquiry rather than replaces it.`
      ),
      bullet(
        `Policy disputes are moral tradeoff disputes as much as technical disputes. Behind arguments about evidence sit arguments about what deserves protection.`,
        `That is why data alone so often fails to settle politics.`
      ),
      bullet(
        `Each political camp highlights real goods and misses real goods. Liberal concern can catch cruelty early, while conservative concern can catch erosion of trust and order early.`,
        `Seeing this does not erase disagreement, but it does improve the diagnosis.`
      ),
      bullet(
        `Coalitions stabilize when they honor more than one foundation. A movement that speaks only one moral language struggles to hold people with different intuitions.`,
        `Broad moral fluency increases political reach.`
      ),
      bullet(
        `Good civic conversation begins with honorable interpretation. Ask what decent concern the other side thinks it is defending.`,
        `That question makes it easier to challenge an argument without caricaturing the person.`
      ),
      bullet(
        `Moral translation can be learned. You can practice restating a view in the values that make it feel compelling to its supporters.`,
        `This is one of the book's most practical political skills.`
      ),
      bullet(
        `The closing lesson is that politics is morally plural. If you cannot hear more than your own matrix, you will keep misreading both persuasion and opposition.`,
        `Understanding the map does not guarantee agreement, but it greatly improves judgment.`
      ),
    ],
    takeaways: [
      `Political groups often differ in moral weighting before they differ in arguments.`,
      `Liberals, conservatives, and libertarians emphasize different parts of the moral map.`,
      `Persuasion improves when you speak in the listener's moral language.`,
      `Political contempt grows when camps treat unfamiliar values as proof of bad character.`,
      `Moral translation is one of the clearest tools for reducing shallow political misreadings.`,
    ],
    practice: [
      `Translate one issue you care about into a moral language your side rarely uses.`,
      `Ask what honorable concern the other side believes it is protecting.`,
      `Notice when you treat a missing value as proof of moral failure.`,
      `Listen for loyalty, authority, sanctity, or liberty language in a debate instead of only policy claims.`,
      `Restate a position in a way that would sound fair to someone who holds it.`,
    ],
    examples: [
      example(
        `ch06-ex01`,
        `The family argument that uses two moral languages`,
        [`personal`],
        `Two siblings argue about a public issue and each thinks the other is refusing obvious truth. One keeps talking about harm and fairness while the other keeps talking about responsibility, social order, and what happens when norms erode.`,
        `Stop answering only the words you prefer and identify the moral foundation each sibling is actually protecting. Then respond in that language before you return to your own values.`,
        `The hidden issue is not only disagreement about facts. It is moral translation failure across different taste profiles.`
      ),
      example(
        `ch06-ex02`,
        `Neighborhood rules and moral mismatch`,
        [`personal`],
        `A local dispute over a neighborhood policy becomes bitter because some residents hear the issue mainly as liberty versus overreach while others hear it as care, safety, and duty to the community. Every statement lands as moral blindness from the other side.`,
        `Map the issue into at least two moral vocabularies before choosing how to argue for your side. If you cannot explain why the other view feels responsible to its supporters, you are not ready to persuade.`,
        `Political conflict often hardens because each side keeps broadcasting in a frequency the other side is not tuned to hear.`
      ),
      example(
        `ch06-ex03`,
        `Campus speaker conflict`,
        [`school`],
        `Students split over a speaker invitation and talk as if one side values only cruelty while the other values only censorship. In reality, the room contains care concerns, liberty concerns, authority concerns, and loyalty concerns all at once.`,
        `Force the discussion to identify which moral foundations are active for each group before debating solutions. Then evaluate the proposals as tradeoffs among competing goods, not as a simple contest between compassion and evil.`,
        `The chapter helps because campus politics often looks irrational until you hear the moral matrix beneath the slogans.`
      ),
      example(
        `ch06-ex04`,
        `Discipline policy on campus`,
        [`school`],
        `A school policy debate gets stuck because some students see strict enforcement as fairness and order, while others see the same enforcement as domination and unequal treatment. Each side thinks the other is ignoring the morally obvious.`,
        `Ask what each side thinks the policy protects and what each side fears it normalizes. Build the conversation around those moral tradeoffs before debating details of the rule.`,
        `Different moral taste profiles change what counts as a threat. That is why the same policy can feel protective to one group and dangerous to another.`
      ),
      example(
        `ch06-ex05`,
        `Return to office and hidden values`,
        [`work`],
        `A return to office policy debate keeps producing frustration because leaders talk only about productivity while employees are reacting through liberty, care, fairness, trust, and community norms. Neither side feels heard because the stated argument is narrower than the lived one.`,
        `Translate the policy into the moral concerns actually driving support and resistance. If leadership wants cooperation, it needs to address domination fears, fairness concerns, and loyalty expectations directly rather than only citing output.`,
        `Workplace politics follows the same pattern as public politics. People resist faster when a decision seems morally tone deaf, not merely inconvenient.`
      ),
      example(
        `ch06-ex06`,
        `Selling a change across different teams`,
        [`work`],
        `A leader has one message for every team and keeps getting uneven buy in. The message works with one department because it speaks to fairness and care, but it falls flat with another that cares more about duty, trust, and the stability of the system.`,
        `Tailor the argument to the moral profile of each audience without changing the underlying policy dishonestly. Explain the same decision through the values that matter most to the people being asked to accept it.`,
        `Persuasion improves when leaders stop assuming that one moral vocabulary is universal. The chapter treats that assumption as a major source of avoidable failure.`
      ),
    ],
    questions: [
      question(
        `ch06-q01`,
        `What is the central claim of this chapter about politics?`,
        [
          `Political camps often differ in moral weighting, not just in facts or intelligence.`,
          `Political disagreement disappears once people see more data.`,
          `All political conflict is mainly about personal temperament and not values.`,
          `Only conservatives use moral language in politics.`,
        ],
        0,
        `Haidt argues that different political groups rely on different moral matrices, which shapes what feels urgent or threatening.`
      ),
      question(
        `ch06-q02`,
        `Which set of foundations is most associated with the liberal profile in this chapter?`,
        [
          `Care, fairness, and liberty from oppression`,
          `Loyalty, sanctity, and authority only`,
          `Authority and sanctity without care`,
          `Only liberty with no concern for fairness`,
        ],
        0,
        `The liberal pattern is described as leaning more heavily on care, fairness, and liberty from oppression.`
      ),
      question(
        `ch06-q03`,
        `What does the chapter suggest about conservative moral language?`,
        [
          `It often draws from a broader range that includes loyalty, authority, and sanctity as well as care and fairness.`,
          `It uses no concern for harm or fairness at all.`,
          `It is identical to the liberal profile once facts are agreed on.`,
          `It is too inconsistent to describe in any structured way.`,
        ],
        0,
        `Haidt's point is not that conservatives lack moral concern. It is that their matrix typically draws on more foundations at once.`
      ),
      question(
        `ch06-q04`,
        `If you want to persuade someone across a political divide, what is the best first move from this chapter?`,
        [
          `State your case in a moral language that speaks to the values they actually hold.`,
          `Repeat your own preferred moral language with more intensity.`,
          `Avoid talking about values altogether.`,
          `Assume they would agree if they were more informed.`,
        ],
        0,
        `The chapter treats moral translation as one of the few reliable ways to improve understanding and persuasion.`
      ),
      question(
        `ch06-q05`,
        `A campus argument feels impossible because one side keeps speaking about harm while the other speaks about order and community loyalty. What is the chapter helping you notice?`,
        [
          `Different moral taste profiles are structuring the same conflict.`,
          `One side has morals and the other side does not.`,
          `Political arguments should ignore values and focus only on rules.`,
          `The disagreement is probably fake.`,
        ],
        0,
        `The chapter explains why the same event can trigger different moral alarms in different groups.`
      ),
      question(
        `ch06-q06`,
        `What is moral monism in the context of this chapter?`,
        [
          `Treating one favored moral foundation as if it should explain every political question.`,
          `Believing that politics has nothing to do with morality.`,
          `Assuming all foundations are always equally important.`,
          `Changing your moral language depending on the audience.`,
        ],
        0,
        `Moral monism creates blindness because it makes unfamiliar concerns look unserious or corrupt by default.`
      ),
      question(
        `ch06-q07`,
        `Why does political contempt grow so easily according to this chapter?`,
        [
          `Groups mishear unfamiliar moral concerns as proof of bad character or indifference.`,
          `Politics contains no real values worth defending.`,
          `People always know the other side's motives perfectly well.`,
          `Contempt only comes from lack of technical expertise.`,
        ],
        0,
        `Silence on a value often gets read as malice, which is one reason moral translation matters so much.`
      ),
      question(
        `ch06-q08`,
        `A leader wants a policy to land with teams that care about different things. What is the strongest approach?`,
        [
          `Explain the policy through the different moral concerns each audience is most likely to prioritize.`,
          `Use one moral script for every team because consistency is more important than understanding.`,
          `Avoid any appeal to values and rely only on authority.`,
          `Assume that people who disagree are acting in bad faith.`,
        ],
        0,
        `The chapter treats moral fluency as a practical leadership skill because audiences are not all moved by the same moral emphasis.`
      ),
      question(
        `ch06-q09`,
        `Which statement best reflects the chapter's nuance?`,
        [
          `These profiles describe broad tendencies, not perfect descriptions of every individual.`,
          `Every liberal and every conservative uses the exact same moral weighting.`,
          `Political identity has no effect on moral perception.`,
          `The model matters only for national elections and not daily life.`,
        ],
        0,
        `Haidt offers structured tendencies, not rigid boxes that erase variation within a camp.`
      ),
      question(
        `ch06-q10`,
        `What deeper skill does this chapter try to build?`,
        [
          `Moral translation across political divides without erasing genuine disagreement.`,
          `A refusal to criticize any political position at all.`,
          `Confidence that one moral language is enough for every audience.`,
          `Suspicion that politics can never be understood morally.`,
        ],
        0,
        `The chapter is trying to build both understanding and better persuasion by widening the reader's moral hearing.`
      ),
    ],
  }),
  chapterData(7, {
    title: `People Are Individuals and Group Joiners`,
    summaries: {
      easy: [
        `People are individuals and group joiners, and Haidt argues that human beings can sometimes switch from ordinary self focus into a more collective state. Shared movement, danger, music, ritual, and common purpose can make people feel lifted into something larger than themselves.`,
        `This matters because group life is not just a burden or a trap. It can produce joy, trust, sacrifice, and meaning. But the same capacity that helps people unite can also weaken criticism and make bad collective behavior feel righteous.`,
      ],
      medium: [
        `People are individuals and group joiners, and Haidt argues that human beings can sometimes switch from ordinary self focus into a more collective state. Shared movement, danger, music, ritual, and common purpose can make people feel lifted into something larger than themselves. Haidt treats this hive switch as a real part of human psychology, not just a metaphor about crowds.`,
        `This matters because group life is not just a burden or a trap. It can produce joy, trust, sacrifice, and meaning. But the same capacity that helps people unite can also weaken criticism and make bad collective behavior feel righteous. The chapter explains why belonging feels so powerful and why moral life becomes dangerous when people lose the ability to step back from the group mind.`,
      ],
      hard: [
        `People are individuals and group joiners, and Haidt argues that human beings can sometimes switch from ordinary self focus into a more collective state. Shared movement, danger, music, ritual, and common purpose can make people feel lifted into something larger than themselves. Haidt treats this hive switch as a real part of human psychology, not just a metaphor about crowds. We are not built only to calculate as isolated individuals. Under the right conditions, we are built to merge attention, emotion, and effort with others.`,
        `This matters because group life is not just a burden or a trap. It can produce joy, trust, sacrifice, and meaning. But the same capacity that helps people unite can also weaken criticism and make bad collective behavior feel righteous. The chapter explains why belonging feels so powerful and why moral life becomes dangerous when people lose the ability to step back from the group mind. The deeper lesson is about design. Healthy groups create belonging while preserving conscience, whereas unhealthy groups demand fusion at the cost of judgment.`
      ],
    },
    bullets: [
      bullet(
        `Humans are both self interested and groupish. We compete as individuals, yet under the right conditions we can also merge into a shared moral world.`,
        `That dual nature helps explain both ordinary ambition and powerful collective devotion.`
      ),
      bullet(
        `The hive switch is real. People can move from private calculation into a state of shared purpose, trust, and emotional synchrony.`,
        `The shift feels different from everyday individual striving.`
      ),
      bullet(
        `Shared movement and ritual can trigger collective feeling. Music, chanting, marching, dancing, and danger often pull attention into the group.`,
        `The body helps create belonging before the mind narrates it.`
      ),
      bullet(
        `Collective states can feel joyful. People often describe moments of group fusion as meaningful, elevating, and larger than ordinary pleasure.`,
        `This helps explain why belonging is so attractive.`
      ),
      bullet(
        `The hive switch can increase trust and sacrifice. People often work harder and give more when they feel part of a common whole.`,
        `That makes group life one source of moral power.`
      ),
      bullet(
        `Belonging is not always irrational. The desire to join something larger can support courage, service, and endurance.`,
        `A purely individual model of human life misses this motivational force.`
      ),
      bullet(
        `The same switch can also reduce criticism. Once the group becomes sacred, doubt can feel like betrayal.`,
        `That is where group joy starts turning into moral danger.`
      ),
      bullet(
        `Leaders can channel group energy well or badly. Shared purpose can be used for service, healing, creativity, or manipulation.`,
        `The moral quality of the group depends on what the belonging is being asked to protect.`
      ),
      bullet(
        `Modern life often underestimates the hunger for fusion. People seek intense belonging because isolated individualism does not satisfy every moral need.`,
        `This helps explain the appeal of movements, teams, rituals, and causes.`
      ),
      bullet(
        `Loneliness can make destructive group identities more tempting. When people are starved for belonging, rigid and extreme groups can feel unusually meaningful.`,
        `The need is human even when the outlet is harmful.`
      ),
      bullet(
        `Healthy groups build connection without erasing conscience. They create solidarity while leaving room for questions, correction, and exit.`,
        `Belonging becomes safer when it is not absolute.`
      ),
      bullet(
        `Shared symbols matter because they focus attention. Flags, songs, uniforms, and rituals help people experience the group as real and emotionally loaded.`,
        `Symbolic life is part of moral life, not decoration outside it.`
      ),
      bullet(
        `Some of the best experiences in life are collective. Team triumph, shared grief, worship, volunteer service, and creative collaboration can all feel morally enlarging.`,
        `The chapter widens moral psychology beyond isolated choice.`
      ),
      bullet(
        `Groupishness does not excuse cruelty. The fact that group fusion feels noble from the inside does not make every group purpose morally sound.`,
        `Warmth inside the group can coexist with blindness toward outsiders.`
      ),
      bullet(
        `The closing lesson is that belonging is a human strength with built in risk. We need shared purpose, but we also need habits that keep shared purpose from swallowing judgment.`,
        `Good moral design holds those two truths together.`
      ),
    ],
    takeaways: [
      `Humans have a real capacity for collective fusion as well as individual striving.`,
      `Belonging can produce joy, trust, sacrifice, and meaning.`,
      `The hive switch can also weaken criticism and intensify moral blindness.`,
      `Healthy groups create solidarity without demanding total surrender of conscience.`,
      `A good moral psychology has to explain both the attraction and the danger of group life.`,
    ],
    practice: [
      `Notice one group experience that makes you feel more generous or more fused with others.`,
      `Ask whether a strong group bond in your life leaves room for honest correction.`,
      `Separate the feeling of belonging from the moral quality of the cause it serves.`,
      `Use shared ritual carefully when you are leading a team or community.`,
      `Look for ways to build connection that do not require an enemy.`,
    ],
    examples: [
      example(
        `ch07-ex01`,
        `The volunteer day that changes the mood`,
        [`personal`],
        `A group of neighbors starts a demanding cleanup project with little energy, but once they are moving together the tone changes. Shared effort, jokes, rhythm, and visible progress create a sense of unity that no planning meeting could have generated.`,
        `Notice what features of the moment are creating the shared lift and use them intentionally in future group work. Build belonging through common action, not only through talk about values.`,
        `The chapter explains why shared movement and common purpose can unlock generosity that isolated individuals do not display as easily.`
      ),
      example(
        `ch07-ex02`,
        `When a fan crowd feels larger than the game`,
        [`personal`],
        `At a stadium, the crowd starts singing and moving in sync, and for a while people feel less like separate strangers and more like one body. The feeling is exhilarating, but it also makes hostility toward the opposing side feel normal.`,
        `Enjoy the belonging without letting the crowd write your whole moral script. Keep enough distance to notice when the group energy is pushing you toward contempt or cruelty.`,
        `The hive switch can create joy and blindness together. That dual effect is exactly what the chapter wants you to see.`
      ),
      example(
        `ch07-ex03`,
        `Why the retreat changes the class`,
        [`school`],
        `A difficult cohort feels fragmented until a shared retreat includes challenge, ritual, and mutual dependence. Students return with far more trust because they experienced one another inside a common effort rather than as disconnected classmates.`,
        `Do not dismiss the shift as fake just because it feels emotional. Ask how shared hardship, rhythm, and purpose created a bond that ordinary discussion could not create alone.`,
        `The chapter shows why certain school experiences change group cohesion faster than informational sessions ever do.`
      ),
      example(
        `ch07-ex04`,
        `Protecting conscience inside a student organization`,
        [`school`],
        `A student group becomes so bonded that members stop questioning the inner circle. New doubts feel disloyal because the group identity is now doing moral work for everyone inside it.`,
        `Create norms that protect belonging and dissent at the same time. People should be able to challenge the group without being treated as if they are abandoning the group.`,
        `Healthy groups do not only produce fusion. They also preserve the ability to step back and think.`
      ),
      example(
        `ch07-ex05`,
        `The work team that finally clicks`,
        [`work`],
        `A team that used to feel fragmented starts solving problems better after a demanding deadline creates visible mutual reliance. People trust each other more because they shared strain, rhythm, and a real goal.`,
        `Study what created the shift and keep the good parts without romanticizing crisis. Shared challenge, clear purpose, and coordinated effort can be designed more safely than emergency mode can.`,
        `The chapter explains why some groups become more than a collection of skilled individuals. The moral energy of the team changes when people feel like a real collective.`
      ),
      example(
        `ch07-ex06`,
        `Using company ritual without manipulation`,
        [`work`],
        `A leader wants stronger culture and starts adding rituals, stories, and symbols to meetings. Some of it helps, but some of it starts feeling like pressure to perform belonging rather than real connection.`,
        `Use ritual to reinforce genuine shared purpose, not to silence doubt or force emotion on command. The group should feel more connected and more honest, not more controlled.`,
        `Group tools are powerful because they move people beyond isolated self interest. That is exactly why leaders need to use them with care.`
      ),
    ],
    questions: [
      question(
        `ch07-q01`,
        `What does the hive switch describe in this chapter?`,
        [
          `A move from ordinary self focus into a stronger shared group state.`,
          `A permanent loss of individual identity.`,
          `A biological change that only happens in religious settings.`,
          `A purely metaphorical idea with no effect on behavior.`,
        ],
        0,
        `Haidt uses the hive switch to describe real moments of collective fusion, not a total or permanent erasure of individuality.`
      ),
      question(
        `ch07-q02`,
        `Which experience is most likely to activate collective feeling according to this chapter?`,
        [
          `Shared movement, rhythm, and common purpose`,
          `Silent solitary reflection only`,
          `A purely technical task done alone`,
          `Reading neutral instructions with no social element`,
        ],
        0,
        `The chapter highlights synchrony, ritual, challenge, and common purpose as strong triggers of group fusion.`
      ),
      question(
        `ch07-q03`,
        `Why does Haidt take group belonging seriously rather than treating it as a mere weakness?`,
        [
          `Because it can generate trust, sacrifice, joy, and meaning that isolated individualism cannot fully explain.`,
          `Because it always leads groups to behave morally.`,
          `Because belonging removes all conflict from human life.`,
          `Because people can only think well inside a fused group.`,
        ],
        0,
        `The chapter emphasizes the genuine moral power of shared purpose while still warning about its risks.`
      ),
      question(
        `ch07-q04`,
        `What is the main danger of the hive switch?`,
        [
          `It can weaken criticism and make the group feel sacred in unhealthy ways.`,
          `It makes people incapable of cooperation.`,
          `It destroys any chance of joy in collective life.`,
          `It only matters in sports settings.`,
        ],
        0,
        `Belonging becomes dangerous when group fusion turns doubt into betrayal and outsiders into moral enemies.`
      ),
      question(
        `ch07-q05`,
        `A student organization feels intensely bonded but reacts badly to internal criticism. What has gone wrong?`,
        [
          `The group built fusion without protecting conscience and correction.`,
          `The members need less shared purpose and more isolation.`,
          `Strong belonging can never support healthy groups.`,
          `Criticism is proof that the group lacks any real values.`,
        ],
        0,
        `The chapter argues that healthy groups need solidarity and room for honest dissent at the same time.`
      ),
      question(
        `ch07-q06`,
        `Why can crowds or rituals feel exhilarating?`,
        [
          `They can pull attention and emotion into a collective state that feels larger than the isolated self.`,
          `They eliminate all moral risk from group life.`,
          `They replace reason with permanent irrationality.`,
          `They work only on people with weak identities.`,
        ],
        0,
        `The joy is part of the story. Haidt wants the reader to see why group fusion is attractive, not only why it can be dangerous.`
      ),
      question(
        `ch07-q07`,
        `What would a healthy leader do with the insights from this chapter?`,
        [
          `Build shared purpose and ritual while preserving space for independent judgment.`,
          `Use group energy to make dissent morally impossible.`,
          `Avoid any attempt to create belonging because it is always manipulative.`,
          `Treat symbols and ritual as irrelevant to group life.`,
        ],
        0,
        `The strongest answer keeps the value of solidarity while guarding against blind fusion.`
      ),
      question(
        `ch07-q08`,
        `Why can lonely people become drawn to extreme groups?`,
        [
          `Because the human need for belonging can make rigid group identity feel deeply meaningful.`,
          `Because extreme groups always provide the best moral reasoning.`,
          `Because loneliness removes all critical thought forever.`,
          `Because group identity matters only to insecure people.`,
        ],
        0,
        `The need for belonging is real, which is why harmful groups can exploit it so effectively.`
      ),
      question(
        `ch07-q09`,
        `Which statement best reflects the chapter's nuance?`,
        [
          `Collective fusion can produce noble cooperation and dangerous blindness at the same time.`,
          `Group life is always morally superior to individual life.`,
          `Individual judgment should always override any sense of shared purpose.`,
          `Belonging matters only in childhood.`,
        ],
        0,
        `The chapter is balanced. It treats the hive switch as a strength with built in risk, not as a pure good or pure evil.`
      ),
      question(
        `ch07-q10`,
        `What deeper habit does this chapter try to build?`,
        [
          `Respect for the power of belonging combined with caution about moral fusion.`,
          `Suspicion that all group joy is fake.`,
          `Confidence that the group can never mislead you.`,
          `A desire to avoid collective life whenever possible.`,
        ],
        0,
        `The chapter wants the reader to understand both why people seek shared purpose and why shared purpose needs moral guardrails.`
      ),
    ],
  }),
  chapterData(8, {
    title: `Why Shared Ritual and Belief Hold Groups Together`,
    summaries: {
      easy: [
        `Shared ritual and belief help groups hold together, and Haidt argues that religion often works less like a mistaken science lesson and more like a social technology for trust, meaning, and cohesion. Costly practices, sacred stories, and shared rituals can bind people tightly enough to cooperate in ways that thin individualism cannot sustain.`,
        `This matters because religion makes more sense once you ask what it does for a community, not only whether every belief is literally true. The lesson also reaches beyond religion because secular groups use symbols, rituals, and sacred values for many of the same binding purposes.`,
      ],
      medium: [
        `Shared ritual and belief help groups hold together, and Haidt argues that religion often works less like a mistaken science lesson and more like a social technology for trust, meaning, and cohesion. Costly practices, sacred stories, and shared rituals can bind people tightly enough to cooperate in ways that thin individualism cannot sustain. Haidt is not claiming that every religious belief should be accepted uncritically. He is claiming that the social function of religion is too important to ignore.`,
        `This matters because religion makes more sense once you ask what it does for a community, not only whether every belief is literally true. The lesson also reaches beyond religion because secular groups use symbols, rituals, and sacred values for many of the same binding purposes. The chapter explains why communities with strong ritual life can sometimes generate trust and sacrifice more effectively than communities that rely only on argument or preference.`,
      ],
      hard: [
        `Shared ritual and belief help groups hold together, and Haidt argues that religion often works less like a mistaken science lesson and more like a social technology for trust, meaning, and cohesion. Costly practices, sacred stories, and shared rituals can bind people tightly enough to cooperate in ways that thin individualism cannot sustain. Haidt is not claiming that every religious belief should be accepted uncritically. He is claiming that the social function of religion is too important to ignore, especially in understanding how human groups solve trust and loyalty problems.`,
        `This matters because religion makes more sense once you ask what it does for a community, not only whether every belief is literally true. The lesson also reaches beyond religion because secular groups use symbols, rituals, and sacred values for many of the same binding purposes. The chapter explains why communities with strong ritual life can sometimes generate trust and sacrifice more effectively than communities that rely only on argument or preference. The deeper lesson is double edged. Sacred systems can cultivate meaning, restraint, and solidarity, but they can also intensify exclusion when the group's sacred order becomes unquestionable.`
      ],
    },
    bullets: [
      bullet(
        `Religion often functions as social glue. It binds people through shared meaning, common practice, and sacred obligation.`,
        `That social function matters even when people disagree about doctrine.`
      ),
      bullet(
        `Ritual is a bonding technology. Shared movement, repetition, sacrifice, and attention make the group feel real and morally weighty.`,
        `The body often learns commitment before the intellect explains it.`
      ),
      bullet(
        `Costly practices signal commitment. When belonging asks something real of people, free riding becomes harder and trust can deepen.`,
        `The cost itself helps prove that the bond is serious.`
      ),
      bullet(
        `Sacred stories coordinate communities. They give groups a memory, a purpose, and a moral horizon larger than individual convenience.`,
        `Meaning helps stabilize cooperation across time.`
      ),
      bullet(
        `Religious communities often solve trust problems. Members know who shares the rules, the rituals, and the duties.`,
        `That shared framework can make cooperation easier and faster.`
      ),
      bullet(
        `Belief is only part of the system. Practice, identity, and communal life can matter as much as formal doctrine.`,
        `A purely intellectual reading of religion misses this embodied side.`
      ),
      bullet(
        `Sacred values can increase self restraint. People often endure inconvenience or sacrifice because the community teaches that some things should not be violated.`,
        `This can support long term moral order.`
      ),
      bullet(
        `Religious groups can provide belonging in hard times. Grief, crisis, celebration, and life transition often become easier to bear inside a sacred community.`,
        `Meaning and cohesion reinforce one another.`
      ),
      bullet(
        `The same sacred power can exclude outsiders. When the group's symbols and norms become morally untouchable, suspicion toward difference can rise quickly.`,
        `Solidarity inside can coexist with hostility outside.`
      ),
      bullet(
        `Religion is not the only place this logic appears. Nations, schools, companies, movements, and teams also use ritual and sacred symbols to create cohesion.`,
        `The chapter broadens the idea of the sacred beyond formal worship.`
      ),
      bullet(
        `A community with no rituals often struggles to feel like a community. Shared practice turns abstract belonging into lived belonging.`,
        `Regular repetition matters because it keeps the group morally vivid.`
      ),
      bullet(
        `Explaining religion only as false belief misses why it survives. It often persists because it does real social work.`,
        `Function is not the same as truth, but it is still part of explanation.`
      ),
      bullet(
        `Healthy sacred systems combine depth with humility. They give people meaning without making every outsider a threat.`,
        `A sacred center becomes dangerous when it cannot tolerate honest scrutiny.`
      ),
      bullet(
        `Leaders should treat ritual and sacred values carefully. These tools are powerful because they shape trust, duty, and willingness to sacrifice.`,
        `Powerful moral tools deserve deliberate handling.`
      ),
      bullet(
        `The closing lesson is that cohesion often needs more than argument. Shared belief, ritual, and sacred symbols can accomplish forms of social binding that reasoning alone rarely produces.`,
        `Understanding that fact helps explain both the strength and the danger of sacred communities.`
      ),
    ],
    takeaways: [
      `Religion often works as a binding social system, not just a set of propositions.`,
      `Ritual, sacrifice, and sacred stories help groups solve trust and cohesion problems.`,
      `Sacred systems can support meaning and self restraint while also risking exclusion.`,
      `Secular groups borrow many of the same binding tools.`,
      `Understanding what religion does socially helps explain why it remains powerful.`,
    ],
    practice: [
      `Look at one community you belong to and identify its rituals and sacred symbols.`,
      `Ask what costly practices in a group are signaling about commitment and trust.`,
      `Notice how shared ritual changes a group's emotional tone compared with discussion alone.`,
      `Separate the social function of a belief system from the question of whether you endorse every claim in it.`,
      `Check whether a sacred norm in your community encourages meaning, exclusion, or both.`,
    ],
    examples: [
      example(
        `ch08-ex01`,
        `Why the family ritual still matters`,
        [`personal`],
        `A family keeps a yearly ritual after a major loss, and younger members sometimes dismiss it as sentimental habit. Yet when the ritual disappears one year, the family feels less connected and less able to hold shared memory together.`,
        `Treat the ritual as a moral technology for belonging rather than as a piece of decorative nostalgia. Ask what form of memory, duty, and closeness it is helping the family sustain.`,
        `The chapter explains why repeated shared acts can carry social meaning that arguments alone cannot replace.`
      ),
      example(
        `ch08-ex02`,
        `A recovery group and real commitment`,
        [`personal`],
        `Someone joins a recovery community and is surprised by how much structured ritual, repeated language, and public commitment shape the experience. What looked strange from outside starts to feel stabilizing from inside.`,
        `Pay attention to the role that repetition, shared story, and costly honesty play in building trust. Do not reduce the system to belief statements alone when its power lies in lived practice.`,
        `Haidt's point is that sacred and ritual structure often does social work that thin individual choice cannot do by itself.`
      ),
      example(
        `ch08-ex03`,
        `Campus tradition and real cohesion`,
        [`school`],
        `A school tradition that once felt corny suddenly matters during a difficult year. Students who participate feel more bonded because the shared ritual turns a loose student body into something more like a community.`,
        `Study what the ritual is accomplishing before dismissing it as empty symbolism. If it is increasing trust, memory, and mutual obligation, it is doing real moral work.`,
        `The chapter matters because schools also need binding practices, not only rules and information.`
      ),
      example(
        `ch08-ex04`,
        `When a campus symbol becomes contested`,
        [`school`],
        `A school symbol or tradition becomes controversial, and the debate gets intense because one side sees cherished continuity while another sees exclusion and moral harm. The conflict is about sacred meaning, not only about branding.`,
        `Treat the issue as a dispute over what the symbol binds people into and who pays the cost of that binding. Honest reform is impossible if leaders pretend the symbol was morally neutral to begin with.`,
        `Sacred things carry power because they bind. That same power can heal or exclude depending on what the group is actually venerating.`
      ),
      example(
        `ch08-ex05`,
        `Onboarding that becomes more than information`,
        [`work`],
        `A company wants new hires to feel part of something real, but its onboarding is purely informational and emotionally flat. People learn procedures, yet they do not feel much loyalty or shared purpose.`,
        `Add shared stories, visible rituals, and symbols that clarify what the group stands for and what membership asks of people. The ritual should connect people to real norms, not just produce theater.`,
        `Workplace cohesion often needs embodied practice as well as explanation. Groups feel morally real when they are enacted, not only described.`
      ),
      example(
        `ch08-ex06`,
        `Sacred language at work without cult behavior`,
        [`work`],
        `A leader sees how powerful mission language can be and starts treating every company goal as sacred. Morale rises for a while, but dissent starts to feel disloyal and important criticisms get muted.`,
        `Use mission and ritual to deepen purpose, not to make the organization morally untouchable. A healthy culture can have sacred commitments and still permit honest correction.`,
        `The chapter is double edged. Sacred tools build cohesion, but they can also become instruments of exclusion when nothing inside the group may be questioned.`
      ),
    ],
    questions: [
      question(
        `ch08-q01`,
        `What is the main claim of this chapter about religion?`,
        [
          `Religion often works as a social technology for trust, meaning, and cohesion.`,
          `Religion matters only because people confuse it with science.`,
          `Ritual has no effect on group behavior.`,
          `Belief systems survive only when individuals profit immediately.`,
        ],
        0,
        `Haidt emphasizes the social function of religion in binding people together and organizing moral life.`
      ),
      question(
        `ch08-q02`,
        `Why can costly rituals strengthen a group?`,
        [
          `They signal commitment and make free riding harder.`,
          `They prove every doctrine is literally true.`,
          `They remove all conflict from community life.`,
          `They matter only to highly emotional people.`,
        ],
        0,
        `Costly practices can deepen trust because they show that membership and obligation are serious.`
      ),
      question(
        `ch08-q03`,
        `Which statement best fits the chapter's treatment of ritual?`,
        [
          `Ritual helps turn abstract belonging into lived belonging.`,
          `Ritual is merely decorative and has no moral role.`,
          `Ritual matters only in childhood religious education.`,
          `Ritual should always be replaced by pure discussion.`,
        ],
        0,
        `The chapter argues that repeated shared practices make communities feel real in embodied ways.`
      ),
      question(
        `ch08-q04`,
        `A family tradition seems sentimental until the year it disappears and everyone feels less connected. What would this chapter say?`,
        [
          `The ritual was doing real social work by carrying memory and cohesion.`,
          `The family only missed it because change is always wrong.`,
          `The ritual proves all family beliefs are correct.`,
          `The feeling of loss shows rituals should be avoided.`,
        ],
        0,
        `The point is functional. Shared rituals can sustain bonds in ways that are easy to ignore until they vanish.`
      ),
      question(
        `ch08-q05`,
        `Why is reducing religion to false belief an incomplete explanation?`,
        [
          `It misses the trust, identity, and cooperation work that religion can perform socially.`,
          `It assumes all religious claims are true.`,
          `It proves that ritual never matters.`,
          `It shows that only doctrine matters and practice does not.`,
        ],
        0,
        `Function is not the same as truth, but it still helps explain why religions remain powerful.`
      ),
      question(
        `ch08-q06`,
        `What risk appears when a group's sacred symbols become untouchable?`,
        [
          `Solidarity inside can turn into hostility or exclusion toward outsiders.`,
          `Members stop feeling any connection to one another.`,
          `The group becomes incapable of sacrifice.`,
          `The group's rituals lose all emotional force.`,
        ],
        0,
        `Sacred systems can bind a group very tightly, which is one reason they can also become exclusionary.`
      ),
      question(
        `ch08-q07`,
        `How does this chapter extend beyond formal religion?`,
        [
          `It shows that secular groups also use ritual, symbol, and sacred values to create cohesion.`,
          `It argues that only religious communities ever build trust.`,
          `It claims that companies and schools have no sacred elements.`,
          `It treats ritual as irrelevant outside worship.`,
        ],
        0,
        `Haidt broadens the idea of sacred binding to include many nonreligious institutions and communities.`
      ),
      question(
        `ch08-q08`,
        `A workplace wants stronger culture. What would best reflect this chapter's insight?`,
        [
          `Use shared stories and rituals to reinforce real norms without making the organization beyond criticism.`,
          `Rely only on information and assume cohesion will appear automatically.`,
          `Make every company practice sacred and shut down dissent.`,
          `Avoid any shared ritual because it is always manipulative.`,
        ],
        0,
        `The strongest answer uses binding tools carefully so they deepen purpose without turning correction into disloyalty.`
      ),
      question(
        `ch08-q09`,
        `What does this chapter suggest communities often need in addition to argument?`,
        [
          `Shared practices and symbols that make obligations feel real.`,
          `Less meaning and more pure convenience.`,
          `A refusal to mark anything as important.`,
          `Only formal punishment with no positive ritual life.`,
        ],
        0,
        `Reasoning matters, but cohesion often depends on embodied and repeated forms of shared meaning.`
      ),
      question(
        `ch08-q10`,
        `What deeper habit does this chapter encourage?`,
        [
          `Seeing sacred systems as powerful tools for cohesion that deserve both respect and scrutiny.`,
          `Treating every ritual as proof of truth.`,
          `Assuming that meaning and community can be built without any shared practice.`,
          `Rejecting all forms of collective symbolism.`,
        ],
        0,
        `The chapter asks the reader to understand sacred binding without either romanticizing it or dismissing it.`
      ),
    ],
  }),
  chapterData(9, {
    title: `How Evolution Shaped Moral Instincts`,
    summaries: {
      easy: [
        `Moral instincts were shaped by evolution at more than one level, and Haidt argues that human beings carry a tension between individual competition and group cooperation. We are built to pursue personal advantage, yet we also have instincts that help groups organize, trust, and outcompete less cooperative groups.`,
        `This matters because both pure selfishness stories and pure altruism stories miss the structure of human nature. The chapter explains why moral life feels conflicted from the inside. We want status and advantage, but we also respond to loyalty, sacrifice, and shared purpose.`,
      ],
      medium: [
        `Moral instincts were shaped by evolution at more than one level, and Haidt argues that human beings carry a tension between individual competition and group cooperation. We are built to pursue personal advantage, yet we also have instincts that help groups organize, trust, and outcompete less cooperative groups. Haidt uses this framework to explain why people can be selfish, generous, tribal, and idealistic without contradiction.`,
        `This matters because both pure selfishness stories and pure altruism stories miss the structure of human nature. The chapter explains why moral life feels conflicted from the inside. We want status and advantage, but we also respond to loyalty, sacrifice, and shared purpose. The practical lesson is that systems matter. Institutions can reward the more cooperative side of human nature or feed the more selfish side, depending on how they are built.`,
      ],
      hard: [
        `Moral instincts were shaped by evolution at more than one level, and Haidt argues that human beings carry a tension between individual competition and group cooperation. We are built to pursue personal advantage, yet we also have instincts that help groups organize, trust, and outcompete less cooperative groups. Haidt uses this framework to explain why people can be selfish, generous, tribal, and idealistic without contradiction. The evolutionary story is not simple harmony. It is a layered design in which individuals compete within groups while groups also compete with other groups.`,
        `This matters because both pure selfishness stories and pure altruism stories miss the structure of human nature. The chapter explains why moral life feels conflicted from the inside. We want status and advantage, but we also respond to loyalty, sacrifice, and shared purpose. The practical lesson is that systems matter. Institutions can reward the more cooperative side of human nature or feed the more selfish side, depending on how they are built. The deeper lesson is that morality becomes more intelligible when you stop asking whether humans are good or bad and start asking what kinds of selection pressures a setting is activating.`
      ],
    },
    bullets: [
      bullet(
        `Human nature contains two pressures at once. Individuals compete for advantage, but groups also benefit when members can cooperate and trust one another.`,
        `That tension helps explain why moral life is never simply selfish or simply selfless.`
      ),
      bullet(
        `Selection can work at more than one level. Traits that help individuals inside a group can differ from traits that help groups survive against other groups.`,
        `The chapter uses this layered picture to explain moral complexity.`
      ),
      bullet(
        `Selfish impulses do not disappear in cooperative systems. People still seek status, resources, and advantage even inside moral communities.`,
        `Moral order has to manage that fact rather than deny it.`
      ),
      bullet(
        `Cooperative instincts also matter. Loyalty, shame, gratitude, and punishment can help groups suppress cheating and coordinate better.`,
        `These instincts become socially valuable when group success depends on trust.`
      ),
      bullet(
        `Moral emotions are part of the adaptive package. They encourage behaviors that make groups more capable of holding together under pressure.`,
        `Feeling is not a side effect here. It is part of the design.`
      ),
      bullet(
        `Free riders remain a permanent challenge. A cooperative group must still detect and discipline members who take benefits without carrying burdens.`,
        `Moral systems often exist partly to solve that problem.`
      ),
      bullet(
        `Culture can amplify biology. Rituals, stories, rules, and institutions can strengthen the group friendly side of human behavior.`,
        `Human evolution works through cultural design as well as through raw instinct.`
      ),
      bullet(
        `Institutions select behavior every day. Reward structures quietly favor selfishness, cooperation, or some unstable mix of the two.`,
        `That is why moral design matters in schools, teams, and companies.`
      ),
      bullet(
        `A system that rewards narrow self interest will train narrow self interest. People often adapt to the incentives around them more than they adapt to the speeches above them.`,
        `Character and structure are linked.`
      ),
      bullet(
        `Group success does not make every group morally admirable. A highly cohesive group can still be cruel, exclusionary, or destructive toward outsiders.`,
        `Evolutionary usefulness is not the same as moral worth.`
      ),
      bullet(
        `Pure cynicism misses real sacrifice. People really do give up short term private advantage for groups they love or honor.`,
        `The chapter rejects the idea that every noble act is secretly selfish in the same simple way.`
      ),
      bullet(
        `Pure idealism misses real rivalry. Cooperative language often sits inside systems where individuals still compete for recognition and gain.`,
        `Both levels stay active at once.`
      ),
      bullet(
        `Moral conflict often reflects which level is being emphasized. One side defends the group's needs while another notices the individual's costs or freedoms.`,
        `Good judgment requires seeing both levels clearly.`
      ),
      bullet(
        `The best systems channel our divided nature rather than pretend it will disappear. They reward contribution, constrain cheating, and keep loyalty from becoming absolute.`,
        `Good design respects the whole human package.`
      ),
      bullet(
        `The closing lesson is that morality is an evolved balancing act. We are built for competition and for cooperation, and social life depends on how wisely institutions handle both forces.`,
        `That perspective makes moral psychology more realistic and more practical.`
      ),
    ],
    takeaways: [
      `Human beings carry both competitive and cooperative tendencies.`,
      `Selection pressures operate within groups and between groups.`,
      `Moral emotions help groups solve trust and free rider problems.`,
      `Institutions amplify whichever side of human nature they reward.`,
      `Good moral design works with our divided nature instead of denying it.`,
    ],
    practice: [
      `Look at one group you belong to and ask what behavior its incentives are actually rewarding.`,
      `Notice whether a conflict in your life is really about individual cost, group need, or both.`,
      `Ask how a rule helps control free riding or support contribution.`,
      `Distinguish evolutionary usefulness from moral approval when judging a group pattern.`,
      `Test whether a system appeals to cooperation while rewarding selfishness in practice.`,
    ],
    examples: [
      example(
        `ch09-ex01`,
        `Family chores and the free rider problem`,
        [`personal`],
        `A family wants to believe everyone naturally helps out, but one person repeatedly avoids the shared work. Tension rises because the group is trying to stay cooperative while an individual keeps protecting private comfort.`,
        `Treat the issue as a predictable free rider problem instead of as a shocking moral mystery. Build clear expectations and consequences that reward contribution and make avoidance less attractive.`,
        `The chapter explains why good intentions are not enough. Cooperative groups still need ways to manage self interest inside the group.`
      ),
      example(
        `ch09-ex02`,
        `Planning a trip with friends`,
        [`personal`],
        `A friend group is planning a trip and everyone likes the idea of shared fun, but people start quietly optimizing for their own convenience on costs, timing, and responsibility. The group feels fragile because there is no structure that aligns personal and collective incentives.`,
        `Clarify contribution, cost sharing, and decision rules before resentment builds. The goal is to make cooperative behavior easy and opportunism visible.`,
        `The moral lesson is not that friends are selfish by nature. It is that groups stay fairer when systems guide the tension between private gain and common good.`
      ),
      example(
        `ch09-ex03`,
        `An honor code that no one enforces`,
        [`school`],
        `A school claims to value honesty, but students know that cheating is common and rarely punished. The institution is praising cooperation while rewarding the students who defect without consequence.`,
        `Match the stated moral norm with actual enforcement and visible support for integrity. If the school wants group trust, it has to make honesty a viable strategy, not only a slogan.`,
        `Evolutionary thinking becomes practical here. People adapt to the pressures a system creates, not only to the values it announces.`
      ),
      example(
        `ch09-ex04`,
        `Lab partners and uneven effort`,
        [`school`],
        `A lab group keeps letting one reliable student carry the details while others coast. Everyone likes the identity of being collaborative, but the structure is quietly teaching the group that unequal effort is tolerated.`,
        `Assign visible roles and rotate accountability so contribution can be seen and rewarded. A cooperative identity lasts longer when the system discourages private advantage through passivity.`,
        `The chapter shows why moral communities need design. Group harmony weakens when self interest pays better than contribution.`
      ),
      example(
        `ch09-ex05`,
        `Bonus structure and team behavior`,
        [`work`],
        `A company says teamwork matters, but its bonus system rewards only individual wins. Predictably, people hoard information and protect personal optics even while repeating the language of collaboration.`,
        `Redesign the incentive system so team contribution has real consequences for advancement and reward. Moral messaging becomes credible only when selection pressures support it.`,
        `This is a direct application of the chapter. Institutions call out one side of human nature and mute the other depending on what they reward.`
      ),
      example(
        `ch09-ex06`,
        `Why one unit trusts and another does not`,
        [`work`],
        `Two teams in the same company perform very differently. One has strong norms around shared ownership and mutual help, while the other treats every decision as a private competition for credit.`,
        `Study the local rules, status signals, and consequences rather than assuming the difference comes only from personality. Then reinforce the conditions that make contribution safer and freeriding harder.`,
        `The chapter reminds you that moral behavior is partly selected. Local cultures evolve around what a group repeatedly rewards or tolerates.`
      ),
    ],
    questions: [
      question(
        `ch09-q01`,
        `What central tension about human nature does this chapter emphasize?`,
        [
          `Humans are shaped by pressures toward individual competition and group cooperation at the same time.`,
          `Humans are purely selfish and never group oriented.`,
          `Humans are purely altruistic once they join a community.`,
          `Evolution has little to do with moral life.`,
        ],
        0,
        `Haidt argues that moral life makes sense only if we see both levels operating together.`
      ),
      question(
        `ch09-q02`,
        `What is a key reason moral emotions can be useful from an evolutionary perspective?`,
        [
          `They help groups manage trust, contribution, and punishment of free riders.`,
          `They remove all competition inside groups.`,
          `They make every cohesive group morally good.`,
          `They matter only in formal religion.`,
        ],
        0,
        `Moral emotions support cooperation by making cheating, gratitude, shame, and loyalty socially significant.`
      ),
      question(
        `ch09-q03`,
        `Why is a free rider such an important figure in this chapter?`,
        [
          `Free riders expose the constant tension between individual advantage and group survival.`,
          `Free riders prove that cooperation never works.`,
          `Free riders are rare and therefore unimportant.`,
          `Free riders matter only in economics and not morality.`,
        ],
        0,
        `The free rider problem is central because moral systems often exist to keep cooperation from collapsing.`
      ),
      question(
        `ch09-q04`,
        `A school praises honesty but rarely punishes cheating. What would this chapter predict?`,
        [
          `Students will adapt to the actual incentives and the honor language will lose force.`,
          `The public praise of honesty is enough to keep cheating low.`,
          `Evolutionary logic stops mattering inside schools.`,
          `Cheating will disappear because students value reputation.`,
        ],
        0,
        `The chapter stresses that systems select behavior. Rewarding one thing while preaching another creates predictable hypocrisy.`
      ),
      question(
        `ch09-q05`,
        `Why is it a mistake to say human behavior is simply selfish or simply selfless?`,
        [
          `Because both competitive and cooperative pressures are built into human social life.`,
          `Because people always act morally regardless of incentives.`,
          `Because selfishness exists only in theory.`,
          `Because group identity removes all personal interest.`,
        ],
        0,
        `Haidt rejects both simple cynicism and simple idealism. Each one misses part of the evolutionary picture.`
      ),
      question(
        `ch09-q06`,
        `What role do institutions play in this chapter?`,
        [
          `They amplify whichever side of human nature their incentives reward.`,
          `They have almost no influence compared with biology.`,
          `They can only suppress morality and never support it.`,
          `They matter only in political systems.`,
        ],
        0,
        `Institutions shape everyday selection pressures by making some behaviors safer, more rewarded, and more normal than others.`
      ),
      question(
        `ch09-q07`,
        `A company talks about teamwork but pays only for individual wins. What is the deeper problem?`,
        [
          `The incentive structure is selecting selfish behavior while the culture praises cooperation.`,
          `The company should stop caring about teamwork at all.`,
          `Employees would cooperate anyway if they were more moral.`,
          `The problem is only a communication issue.`,
        ],
        0,
        `The chapter treats this kind of mismatch as a predictable design failure rather than a surprise.`
      ),
      question(
        `ch09-q08`,
        `What nuance does the chapter keep about successful groups?`,
        [
          `A cohesive group can be effective without being morally admirable toward outsiders.`,
          `Any group that cooperates well is automatically good.`,
          `Group success proves its sacred values are true.`,
          `Only individuals can act morally.`,
        ],
        0,
        `Evolutionary usefulness and moral approval are not the same thing, which is why group success must still be judged.`
      ),
      question(
        `ch09-q09`,
        `What is the strongest way to apply this chapter to real life?`,
        [
          `Ask what selection pressures a setting is creating before you blame only individual character.`,
          `Assume character never matters at all.`,
          `Ignore structure and focus only on intention.`,
          `Treat every conflict as a simple contest between good people and bad people.`,
        ],
        0,
        `The chapter makes moral judgment more practical by directing attention to the pressures a system creates.`
      ),
      question(
        `ch09-q10`,
        `What deeper habit does this chapter build?`,
        [
          `Looking at moral behavior through the interaction of human nature and institutional design.`,
          `Reducing morality to biology alone.`,
          `Treating culture as unimportant to moral life.`,
          `Assuming that incentives always defeat values completely.`,
        ],
        0,
        `The chapter joins evolutionary insight to institutional analysis so moral behavior becomes easier to explain and shape.`
      ),
    ],
  }),
  chapterData(10, {
    title: `Why Groups Polarize and Talk Past Each Other`,
    summaries: {
      easy: [
        `Groups polarize because moral communities bind people to teams before they bind them to truth, and Haidt argues that once identity is involved, information starts serving belonging. People sort into camps, trust in group sources more than outsiders, and increasingly treat opponents as morally defective instead of differently ordered.`,
        `This matters because polarization is not just a problem of ignorance. It is a problem of loyalty, status, and moral narrative. Better information helps less than people expect when the real struggle is over which team gets to define what counts as good and decent.`,
      ],
      medium: [
        `Groups polarize because moral communities bind people to teams before they bind them to truth, and Haidt argues that once identity is involved, information starts serving belonging. People sort into camps, trust in group sources more than outsiders, and increasingly treat opponents as morally defective instead of differently ordered. Group discussion with the like minded often pushes members toward more extreme versions of what they already favored.`,
        `This matters because polarization is not just a problem of ignorance. It is a problem of loyalty, status, and moral narrative. Better information helps less than people expect when the real struggle is over which team gets to define what counts as good and decent. The chapter pushes the reader to look at the social environment around belief formation, not only at the content of the belief itself.`,
      ],
      hard: [
        `Groups polarize because moral communities bind people to teams before they bind them to truth, and Haidt argues that once identity is involved, information starts serving belonging. People sort into camps, trust in group sources more than outsiders, and increasingly treat opponents as morally defective instead of differently ordered. Group discussion with the like minded often pushes members toward more extreme versions of what they already favored because status and loyalty reward the sharper team line.`,
        `This matters because polarization is not just a problem of ignorance. It is a problem of loyalty, status, and moral narrative. Better information helps less than people expect when the real struggle is over which team gets to define what counts as good and decent. The chapter pushes the reader to look at the social environment around belief formation, not only at the content of the belief itself. The deeper lesson is that depolarization requires changing relationships, incentives, and institutions, not only winning isolated arguments.`
      ],
    },
    bullets: [
      bullet(
        `Identity changes how people process information. Once a belief becomes part of a team story, evidence starts serving belonging as much as truth.`,
        `That is why correction gets harder as tribal commitment grows.`
      ),
      bullet(
        `Like minded groups often drift toward greater extremes. Discussion inside a camp rewards sharper signaling of loyalty and purity.`,
        `The group can become more certain even when the evidence has not improved.`
      ),
      bullet(
        `People trust in group sources more than outsider sources. The messenger becomes part of the moral message.`,
        `Information from the wrong tribe arrives already contaminated.`
      ),
      bullet(
        `Reputation pressure shapes public opinion. People often say what fits the camp because social standing is at stake.`,
        `Status inside the group can matter more than accuracy in the moment.`
      ),
      bullet(
        `Moral narratives turn opponents into symbols. The other side stops looking like a mixed human group and starts looking like a unified moral threat.`,
        `This transformation feeds contempt and fear.`
      ),
      bullet(
        `Polarization is self reinforcing. The more groups dislike one another, the more every new event gets interpreted through prior hostility.`,
        `Bad expectation creates more bad evidence.`
      ),
      bullet(
        `Shared outrage can feel morally energizing. It gives members a sense of purity, solidarity, and purpose.`,
        `That emotional reward makes polarization sticky.`
      ),
      bullet(
        `Cross group contact matters because it interrupts caricature. Personal relationships make it harder to reduce a whole camp to one moral label.`,
        `Human detail weakens tribal simplification.`
      ),
      bullet(
        `Institutions can either cool or inflame polarization. Media systems, leadership incentives, and group sorting patterns all affect how far camps drift apart.`,
        `The chapter keeps responsibility at the system level as well as the personal level.`
      ),
      bullet(
        `Argument alone often fails because the argument is not the whole contest. Status, identity, and moral belonging are also in the room.`,
        `A perfect fact can still lose to a powerful tribe.`
      ),
      bullet(
        `People need spaces where mixed identities can survive. If every issue becomes team total war, nuance becomes socially expensive.`,
        `Cross pressure is one of the best defenses against extremity.`
      ),
      bullet(
        `Leaders can profit from polarization. They gain loyalty and clarity by turning compromise into betrayal and complexity into threat.`,
        `The moral energy of the group becomes a political resource.`
      ),
      bullet(
        `Humility is harder in polarized settings because admission sounds like surrender. The social cost of nuance rises as camps harden.`,
        `Good systems lower that cost.`
      ),
      bullet(
        `Depolarization requires relationship work as well as intellectual work. People soften faster when they encounter honorable motives in the other camp.`,
        `Moral translation matters here as much as rebuttal.`
      ),
      bullet(
        `The closing lesson is that tribes can hijack judgment. If you want clearer thinking, you have to address the social forces that reward moral simplification and team performance.`,
        `Polarization is a group problem before it is a logic problem.`
      ),
    ],
    takeaways: [
      `Identity and belonging heavily shape how people process political and moral information.`,
      `Like minded groups often become more extreme through internal reinforcement.`,
      `Polarization is powered by status, emotion, and social reward as much as by evidence.`,
      `Cross group relationships and mixed identities can soften tribal caricature.`,
      `Depolarization requires social design, not only better arguments.`,
    ],
    practice: [
      `Notice one issue where your first question is about which side said it rather than whether it is true.`,
      `Seek one serious voice outside your camp that you can regard as honorable even when you disagree.`,
      `Watch how group approval affects what sounds reasonable in a like minded room.`,
      `Protect at least one relationship that crosses a moral or political line.`,
      `Ask what incentive a leader has to make the disagreement feel total and permanent.`,
    ],
    examples: [
      example(
        `ch10-ex01`,
        `The family group chat spiral`,
        [`personal`],
        `A family group chat about a public issue goes from disagreement to character judgment in a few messages. Soon each person is reading every word as proof that the other side belongs to a morally broken camp.`,
        `Pause the exchange and move the conversation toward one concrete concern instead of the whole tribal story. If possible, reconnect through a relationship frame before returning to the issue frame.`,
        `Polarization feeds on the collapse of the person into the camp. Restoring the person is often the first step toward better judgment.`
      ),
      example(
        `ch10-ex02`,
        `Friendship under tribal pressure`,
        [`personal`],
        `A longtime friendship starts fraying because every current event now seems to demand public team signaling. Small differences feel bigger because each one is loaded with tribal meaning.`,
        `Protect the relationship by naming the team pressure directly. Agree on norms for discussing hard issues that do not force each conversation to become a loyalty test.`,
        `The chapter matters because polarization often destroys relationships by turning nuance into a reputational risk.`
      ),
      example(
        `ch10-ex03`,
        `Campus coalition drift`,
        [`school`],
        `A student coalition begins with a broad goal and then grows more rigid as members keep talking only with one another. Positions harden partly because stronger internal signaling earns more status inside the group.`,
        `Introduce structured engagement with serious critics and protect space for internal nuance. A group gets wiser when its members are not rewarded only for moving further toward purity.`,
        `Like minded groups often drift toward more extreme versions of themselves. The chapter explains that drift as a social process, not just a change of mind.`
      ),
      example(
        `ch10-ex04`,
        `Reading the other campus faction too simply`,
        [`school`],
        `Two student groups dislike one another so much that every action by the other side gets interpreted as strategic bad faith. Members have almost no ordinary contact outside conflict spaces, so caricature keeps growing unchecked.`,
        `Create low threat contact where members have to cooperate on a bounded task unrelated to the main dispute. Human detail lowers the power of a total tribal story.`,
        `Polarization survives when people know the other side only as a symbol. The chapter shows why relationship structure matters.`
      ),
      example(
        `ch10-ex05`,
        `Product teams becoming camps`,
        [`work`],
        `Two product teams start treating every planning dispute as proof that the other team is irresponsible or arrogant. Internal meetings within each team make the shared story more extreme because everyone keeps rewarding the same interpretation.`,
        `Interrupt the camp logic by creating mixed planning sessions with clear shared goals and shared success metrics. Do not let each team narrate the other in private without contact.`,
        `Workplace polarization follows the same mechanics as political polarization when identity, status, and repeated grievance take over.`
      ),
      example(
        `ch10-ex06`,
        `Leaders who benefit from the split`,
        [`work`],
        `A manager keeps framing disagreements as battles between the serious people and the blockers. The story wins loyalty from one faction, but it makes honest complexity harder to discuss.`,
        `Examine the incentives behind the rhetoric and rebuild norms that separate disagreement from betrayal. Reward leaders who can reduce heat while preserving clarity.`,
        `The chapter warns that polarization can be useful to ambitious leaders. That is one reason teams need structures that do not reward tribal dramatization.`
      ),
    ],
    questions: [
      question(
        `ch10-q01`,
        `What makes polarization more than a simple information problem in this chapter?`,
        [
          `Identity, loyalty, status, and moral narrative shape how information is received.`,
          `People stop caring about any values at all.`,
          `Groups become more neutral the longer they discuss an issue.`,
          `Evidence never matters in any setting.`,
        ],
        0,
        `Haidt argues that tribal forces change the function of information, so more facts alone often do less than people expect.`
      ),
      question(
        `ch10-q02`,
        `Why do like minded groups often become more extreme?`,
        [
          `Internal discussion rewards stronger signals of loyalty and purity.`,
          `They hear so many strong arguments against themselves.`,
          `Extremity disappears whenever people agree at the start.`,
          `Groups naturally move toward balance over time.`,
        ],
        0,
        `The chapter treats extremity as a social drift that grows inside reinforcing camps.`
      ),
      question(
        `ch10-q03`,
        `What role does the messenger play in polarized settings?`,
        [
          `People judge information partly by whether it comes from an in group or an out group source.`,
          `The messenger becomes irrelevant once facts are clear.`,
          `Only the most emotional messenger is believed.`,
          `Trust is unaffected by group identity.`,
        ],
        0,
        `The source itself becomes morally loaded, which is why outsider information is often filtered out early.`
      ),
      question(
        `ch10-q04`,
        `A friendship is deteriorating because every issue feels like a loyalty test. What would best fit this chapter?`,
        [
          `Name the tribal pressure directly and create norms that allow disagreement without turning it into betrayal.`,
          `Avoid all difficult topics forever.`,
          `Demand stronger public loyalty from both sides.`,
          `Assume the friendship must end because disagreement is impossible.`,
        ],
        0,
        `The strongest response reduces the social cost of nuance instead of intensifying the team frame.`
      ),
      question(
        `ch10-q05`,
        `Why can shared outrage feel good inside a polarized group?`,
        [
          `It creates solidarity, purity, and a sense of common purpose.`,
          `It removes every risk of overreaction.`,
          `It proves the group is morally complete.`,
          `It guarantees accurate judgment about opponents.`,
        ],
        0,
        `Outrage can be emotionally rewarding because it deepens belonging, which is one reason it persists.`
      ),
      question(
        `ch10-q06`,
        `What is one strong reason cross group relationships matter?`,
        [
          `They make it harder to reduce an entire camp to a simple moral caricature.`,
          `They eliminate all disagreement instantly.`,
          `They matter only in family life and not politics or work.`,
          `They weaken every conviction regardless of truth.`,
        ],
        0,
        `Human detail interrupts the symbolic team story that fuels contempt.`
      ),
      question(
        `ch10-q07`,
        `A student coalition keeps getting more rigid after private internal meetings. What dynamic does this chapter highlight?`,
        [
          `Group discussion inside one camp can intensify the camp's existing line.`,
          `Private discussion always produces moderation.`,
          `The coalition is becoming wiser because its views are getting sharper.`,
          `Identity has no effect on how the group processes its own arguments.`,
        ],
        0,
        `The chapter explains why like minded groups often drift toward more extreme versions of what they already favored.`
      ),
      question(
        `ch10-q08`,
        `What system level factor can worsen polarization?`,
        [
          `Institutions and leaders that reward moral dramatization and team loyalty over nuance`,
          `Frequent contact with honorable disagreement`,
          `Mixed identity settings where people belong to more than one group`,
          `Norms that separate criticism from betrayal`,
        ],
        0,
        `Polarization is reinforced when a system pays people for inflaming the tribal frame.`
      ),
      question(
        `ch10-q09`,
        `Why do direct arguments often fail in polarized settings?`,
        [
          `Because the disagreement is also about belonging and status, not only about evidence.`,
          `Because people lose the ability to understand language.`,
          `Because evidence should never be discussed.`,
          `Because every camp is equally informed on every issue.`,
        ],
        0,
        `The chapter emphasizes that argument is only one layer of a conflict that is also social and moral.`
      ),
      question(
        `ch10-q10`,
        `What deeper habit does this chapter build?`,
        [
          `Looking for the social machinery behind extremity instead of treating polarization as mere stupidity.`,
          `Assuming all group conflict is fake.`,
          `Believing that tribes can never be challenged.`,
          `Avoiding any strong conviction under all conditions.`,
        ],
        0,
        `The chapter pushes the reader to diagnose the incentives and identities that drive tribal judgment.`
      ),
    ],
  }),
  chapterData(11, {
    title: `How Moral Humility Improves Conversation`,
    summaries: {
      easy: [
        `Moral humility improves conversation because no one sees the whole moral map clearly from inside one mind. Haidt argues that better disagreement starts when you assume the other side may be responding to values you also recognize, even if you rank them differently.`,
        `This matters because humility is not surrender. It is a practical way to reduce distortion, ask better questions, and speak in ways that people can actually hear. Without it, moral conflict turns into performance for your own side.`,
      ],
      medium: [
        `Moral humility improves conversation because no one sees the whole moral map clearly from inside one mind. Haidt argues that better disagreement starts when you assume the other side may be responding to values you also recognize, even if you rank them differently. The point is not to flatten major differences. It is to lower self righteousness enough that understanding can happen before attack.`,
        `This matters because humility is not surrender. It is a practical way to reduce distortion, ask better questions, and speak in ways that people can actually hear. Without it, moral conflict turns into performance for your own side. The chapter ties humility to moral capital as well. People listen better when they feel seen, respected, and not instantly condemned.`,
      ],
      hard: [
        `Moral humility improves conversation because no one sees the whole moral map clearly from inside one mind. Haidt argues that better disagreement starts when you assume the other side may be responding to values you also recognize, even if you rank them differently. The point is not to flatten major differences. It is to lower self righteousness enough that understanding can happen before attack. In a book about the righteous mind, humility becomes a countermeasure to the mind's built in tendency to treat its own intuitions as obviously correct.`,
        `This matters because humility is not surrender. It is a practical way to reduce distortion, ask better questions, and speak in ways that people can actually hear. Without it, moral conflict turns into performance for your own side. The chapter ties humility to moral capital as well. People listen better when they feel seen, respected, and not instantly condemned. The deeper lesson is that persuasion often depends less on sharper attack and more on whether you have created conditions where the other person can revise without humiliation.`
      ],
    },
    bullets: [
      bullet(
        `Humility begins with cognitive realism. Your mind is built to defend its own views, so certainty should be held with some caution.`,
        `This is not weakness. It is an honest starting point.`
      ),
      bullet(
        `Understanding comes before effective critique. If you misread the moral concern on the other side, your argument will strike the wrong target.`,
        `Bad diagnosis makes strong rhetoric useless.`
      ),
      bullet(
        `Humility is not relativism. You can judge firmly while still admitting that your own view is partial and fallible.`,
        `The chapter is asking for openness, not mushiness.`
      ),
      bullet(
        `Ask how the world looks from the other side. Narrative questions often reveal moral concerns that slogans hide.`,
        `Stories expose values more reliably than point scoring does.`
      ),
      bullet(
        `Steel man before you answer. State the strongest recognizable version of the other person's view before offering your criticism.`,
        `That discipline improves both fairness and precision.`
      ),
      bullet(
        `Moral capital matters. People are more willing to listen when they feel respected, not instantly treated as corrupt or stupid.`,
        `Trust creates room for revision.`
      ),
      bullet(
        `Curiosity lowers heat. Asking what concern a person is trying to protect often changes the whole tone of a conversation.`,
        `The move humanizes without pretending the disagreement is minor.`
      ),
      bullet(
        `Good questions are often stronger than fast conclusions. Questions invite explanation and reveal where the real disagreement lives.`,
        `They also make defensive performance less necessary.`
      ),
      bullet(
        `People can hold partial truths inside flawed arguments. Humility searches for the real concern even when the framing is clumsy or overstated.`,
        `That is how understanding gets deeper without becoming gullible.`
      ),
      bullet(
        `Accusation closes revision. Once a person feels morally cornered, they usually defend identity before reconsidering evidence.`,
        `Humiliation is a terrible teacher in moral conflict.`
      ),
      bullet(
        `Humility works best with boundaries. You do not have to accept abuse, manipulation, or false equivalence in order to understand someone honestly.`,
        `Respect and clarity can coexist.`
      ),
      bullet(
        `Mixed groups need norms that reward good faith. Without those norms, the loudest and most moralizing voices crowd out learning.`,
        `Conversation quality depends on the structure around it.`
      ),
      bullet(
        `Self examination should accompany other examination. Ask what in your own identity, tribe, or experience may be narrowing your hearing.`,
        `The chapter applies the same moral scrutiny inward and outward.`
      ),
      bullet(
        `Persuasion often depends on dignity. People can change more easily when they have a path to revision that does not destroy self respect.`,
        `A wise conversation protects that path when possible.`
      ),
      bullet(
        `The closing lesson is that humility is a strategic and moral skill. It improves understanding, lowers distortion, and makes honest disagreement more productive.`,
        `Without humility, the righteous mind keeps talking mostly to itself.`
      ),
    ],
    takeaways: [
      `Moral humility starts from the fact that your own mind is biased toward self defense.`,
      `Understanding the other side's moral concern improves critique rather than weakening it.`,
      `People listen better when they feel respected and not cornered morally.`,
      `Humility does not require surrendering standards or tolerating abuse.`,
      `Good disagreement depends on dignity, structure, and curiosity as much as on logic.`,
    ],
    practice: [
      `Ask one narrative question before you make your main argument in a hard conversation.`,
      `State the strongest version of the other person's view before offering critique.`,
      `Notice what part of your own identity feels threatened in the exchange.`,
      `Look for one partial truth in a view you still reject overall.`,
      `Protect a path for revision that does not humiliate the other person.`,
    ],
    examples: [
      example(
        `ch11-ex01`,
        `Making a family disagreement less self righteous`,
        [`personal`],
        `A family conflict keeps replaying because each person comes prepared with conclusions and almost no real questions. Everyone feels morally clear and emotionally unheard at the same time.`,
        `Start by asking what concern the other person thinks they are protecting and repeat it back in a way they recognize. Only then move to your critique of how they are handling it.`,
        `Humility changes the order of operations. It does not remove the disagreement, but it does reduce the distortion created by self righteousness.`
      ),
      example(
        `ch11-ex02`,
        `Holding a boundary without contempt`,
        [`personal`],
        `A friend keeps crossing a line, and the injured person is tempted to frame the issue as proof that the friend is morally defective in every way. The urge is understandable, but it will likely make repair or clear separation harder.`,
        `State the specific behavior, the impact, and the boundary while avoiding a total moral portrait of the person. Leave room for understanding without surrendering the standard you need to hold.`,
        `The chapter is not asking you to be passive. It is asking you to keep judgment specific enough that truth can still be seen clearly.`
      ),
      example(
        `ch11-ex03`,
        `Office hours that become real inquiry`,
        [`school`],
        `A student is upset about a grade and walks into office hours ready to prove unfairness. The professor is prepared to defend the grading process, so the conversation is headed toward mutual self defense.`,
        `Begin with questions about what standards were being applied and where your work fell short of them as the professor saw it. After that, raise your concern about fairness as clearly as you can.`,
        `Humility here is not submission. It is a better sequence that increases the chance of learning and of being heard.`
      ),
      example(
        `ch11-ex04`,
        `Student leaders who need moral capital`,
        [`school`],
        `A student leader wants to challenge a harmful pattern in a group but has already burned a lot of trust by talking as if disagreement is proof of moral failure. Even good concerns now get dismissed because the leader has little moral capital left.`,
        `Rebuild the conversation by showing you understand why others see the issue differently and by acknowledging any legitimate concerns on their side. Then make the strongest case you can for why the pattern still needs to change.`,
        `People rarely listen well when they expect instant condemnation. Moral capital is part of persuasion, not a cosmetic extra.`
      ),
      example(
        `ch11-ex05`,
        `Correcting without cornering at work`,
        [`work`],
        `A manager needs to confront an employee about a real problem, but every prior feedback conversation has felt like a status contest. The employee hears attack faster than instruction, so revision never really starts.`,
        `Lead with clear facts and a good faith effort to understand how the employee saw the situation. Then name the standard that still has to be met and the specific change required.`,
        `The chapter's lesson is that people revise more easily when they are not forced to choose between learning and dignity.`
      ),
      example(
        `ch11-ex06`,
        `Making disagreement productive in a leadership team`,
        [`work`],
        `A leadership team is smart and committed, but debate keeps turning into moral theater for each person's constituency. Members are arguing to look righteous to allies rather than to test what is true.`,
        `Set norms that require fair restatement, real questions, and acknowledgment of a strong point on the other side before rebuttal. Those rules raise the cost of performance and lower the cost of honest revision.`,
        `Humility can be designed into a room. The chapter treats structure as an ally of better conversation, not a substitute for it.`
      ),
    ],
    questions: [
      question(
        `ch11-q01`,
        `What is the starting point of moral humility in this chapter?`,
        [
          `Recognizing that your own mind is biased toward defending itself.`,
          `Assuming all moral positions are equally good.`,
          `Giving up strong standards in conversation.`,
          `Trusting your first intuition without question.`,
        ],
        0,
        `Humility begins with realism about the mind's built in tendency toward self defense and partial vision.`
      ),
      question(
        `ch11-q02`,
        `What does this chapter mean by saying humility is not relativism?`,
        [
          `You can judge firmly while still admitting your own perspective is limited.`,
          `You must avoid all judgment in difficult conversations.`,
          `Every moral view should be treated as equally sound.`,
          `Understanding another person means agreeing with them.`,
        ],
        0,
        `Haidt is asking for openness and accuracy, not for the abandonment of standards.`
      ),
      question(
        `ch11-q03`,
        `Why is fair restatement so important here?`,
        [
          `It shows whether you actually understand the moral concern you are trying to answer.`,
          `It guarantees the other person will change their mind.`,
          `It proves your own view is already correct.`,
          `It removes the need for critique afterward.`,
        ],
        0,
        `Without understanding the other side accurately, critique often misses the real issue.`
      ),
      question(
        `ch11-q04`,
        `A student is upset about a grade. Which opening move best fits this chapter?`,
        [
          `Ask how the professor applied the standards before pressing the fairness concern.`,
          `Begin by accusing the professor of obvious bias.`,
          `Avoid the conversation entirely because humility means silence.`,
          `Pretend the grade does not matter to keep the peace.`,
        ],
        0,
        `The strongest move starts with understanding and then moves to critique, which improves both learning and influence.`
      ),
      question(
        `ch11-q05`,
        `What is moral capital in the context of this chapter?`,
        [
          `The trust and goodwill that make people more willing to hear correction from you.`,
          `A record of always winning moral arguments.`,
          `The right to shame people whenever they disagree.`,
          `A way to avoid difficult conversations permanently.`,
        ],
        0,
        `Moral capital helps because respect lowers defensiveness and makes revision more possible.`
      ),
      question(
        `ch11-q06`,
        `Why are questions often stronger than fast conclusions in a hard conversation?`,
        [
          `They reveal the real concern and reduce the need for immediate self defense.`,
          `They prevent you from ever taking a position.`,
          `They prove your moral superiority.`,
          `They work only when there is no disagreement.`,
        ],
        0,
        `Good questions invite explanation and uncover the values or fears that slogans often hide.`
      ),
      question(
        `ch11-q07`,
        `What makes humiliation such a poor strategy for moral change?`,
        [
          `People usually defend identity before they reconsider when they feel morally cornered.`,
          `Humiliation always produces honest agreement.`,
          `It makes standards clearer than respect does.`,
          `It matters only in personal relationships.`,
        ],
        0,
        `The chapter argues that dignity affects whether a person can revise without treating the revision as self destruction.`
      ),
      question(
        `ch11-q08`,
        `Which statement best fits the chapter's boundaries?`,
        [
          `You can seek understanding while still holding clear limits against harmful behavior.`,
          `Humility requires tolerating abuse and manipulation.`,
          `Boundaries prove humility is impossible.`,
          `Respect means never naming a wrong clearly.`,
        ],
        0,
        `The chapter separates humility from passivity. Understanding and boundaries can coexist.`
      ),
      question(
        `ch11-q09`,
        `A leadership team wants better disagreement. What structural rule best fits this chapter?`,
        [
          `Require fair restatement and one acknowledged strong point from the other side before rebuttal.`,
          `Let the most forceful voice set the moral tone immediately.`,
          `Ban all questions so meetings move faster.`,
          `Treat concession as weakness and punish it socially.`,
        ],
        0,
        `The chapter treats conversation quality as something that can be supported by well chosen norms.`
      ),
      question(
        `ch11-q10`,
        `What deeper habit does this chapter try to build?`,
        [
          `Firm judgment joined to curiosity, dignity, and better moral listening.`,
          `A reluctance to care about moral issues at all.`,
          `Confidence that only your tribe sees clearly.`,
          `A belief that the best argument is always the sharpest attack.`,
        ],
        0,
        `The chapter's goal is not weaker conviction. It is wiser conversation built on humility and respect for how the righteous mind works.`
      ),
    ],
  }),
  chapterData(12, {
    title: `Living Well With Moral Difference`,
    summaries: {
      easy: [
        `Living well with moral difference means accepting that the righteous mind is both necessary and dangerous. Haidt's closing lesson is that morality makes cooperation possible, yet the same moral passions can blind people, divide societies, and turn disagreement into moral war.`,
        `This matters because there is no final escape from moral difference. A better life depends on humility, plural institutions, strong relationships, and habits that let people share a society without pretending they all hear the same moral music.`,
      ],
      medium: [
        `Living well with moral difference means accepting that the righteous mind is both necessary and dangerous. Haidt's closing lesson is that morality makes cooperation possible, yet the same moral passions can blind people, divide societies, and turn disagreement into moral war. The book does not end by asking people to stop caring about values. It ends by asking them to care in a wiser and more plural way.`,
        `This matters because there is no final escape from moral difference. A better life depends on humility, plural institutions, strong relationships, and habits that let people share a society without pretending they all hear the same moral music. The chapter turns the whole book toward design. We need communities, teams, and civic rules that protect common goods while still leaving room for moral diversity and correction.`,
      ],
      hard: [
        `Living well with moral difference means accepting that the righteous mind is both necessary and dangerous. Haidt's closing lesson is that morality makes cooperation possible, yet the same moral passions can blind people, divide societies, and turn disagreement into moral war. The book does not end by asking people to stop caring about values. It ends by asking them to care in a wiser and more plural way. Moral life has to be strong enough to bind people into common projects and humble enough to remember that no one mind or one camp sees the whole field.`,
        `This matters because there is no final escape from moral difference. A better life depends on humility, plural institutions, strong relationships, and habits that let people share a society without pretending they all hear the same moral music. The chapter turns the whole book toward design. We need communities, teams, and civic rules that protect common goods while still leaving room for moral diversity and correction. The deeper lesson is that mature moral life is not the victory of one purified value system. It is the ongoing work of balancing goods, checking blind spots, and building settings where disagreement does not automatically become dehumanization.`
      ],
    },
    bullets: [
      bullet(
        `The righteous mind is both a gift and a danger. It makes trust, duty, and common purpose possible, yet it also makes self righteousness easy.`,
        `Any realistic moral life has to keep both truths in view.`
      ),
      bullet(
        `Moral difference is permanent. People will continue to rank goods differently because they rely on different intuitions, experiences, and group identities.`,
        `The goal is not to erase difference but to live with it more wisely.`
      ),
      bullet(
        `Pluralism needs structure. Diverse societies work better when institutions protect both shared norms and respectful contest.`,
        `Good systems make disagreement less destructive.`
      ),
      bullet(
        `Common goods still matter. Shared life requires some moral commitments that hold a community together even when people differ elsewhere.`,
        `Pluralism without any common standards collapses into mistrust.`
      ),
      bullet(
        `Moral humility is a civic virtue. It keeps conviction from turning too quickly into condemnation.`,
        `Humility does not solve conflict, but it changes how conflict is carried.`
      ),
      bullet(
        `Friendship across difference is morally important. Personal relationships soften caricature and make whole camps harder to hate.`,
        `Human closeness is one of the best defenses against dehumanization.`
      ),
      bullet(
        `Institutions should invite cross pressure. People think better when their identities are not fully sorted into one total tribe.`,
        `Mixed roles and mixed communities reduce extremity.`
      ),
      bullet(
        `Shared rituals and stories can help plural communities hold together. People need more than rules if they are going to experience a common life.`,
        `Cohesion requires lived belonging, not only formal tolerance.`
      ),
      bullet(
        `Boundaries still matter. Not every belief deserves equal endorsement and not every conflict can be harmonized.`,
        `Living well with difference includes clarity about what you will still oppose.`
      ),
      bullet(
        `Media and group choice shape moral life. The communities you inhabit train what feels obvious, threatening, and honorable.`,
        `Selecting healthier inputs is part of moral self management.`
      ),
      bullet(
        `Diverse teams can be wiser if they are well led. Different moral sensitivities can catch different risks and goods.`,
        `Difference becomes an asset when the structure keeps it from becoming warfare.`
      ),
      bullet(
        `Private virtue needs public support. People reason and behave better inside institutions that reward fairness, dignity, and accountability.`,
        `Individual effort matters more when the environment helps it.`
      ),
      bullet(
        `Moral complexity should not become moral paralysis. Seeing more sides should improve judgment, not dissolve it into endless hesitation.`,
        `Clarity after humility is better than certainty before humility.`
      ),
      bullet(
        `A good life includes ongoing moral revision. Growth often comes from learning which value you overuse and which value you neglect.`,
        `The book ends by turning moral psychology back into personal practice.`
      ),
      bullet(
        `The closing lesson is to build moral life with wisdom rather than purity. Strong communities, decent institutions, and humble relationships matter more than dreams of total moral victory.`,
        `That is how people live with difference without surrendering meaning.`
      ),
    ],
    takeaways: [
      `Moral life must hold together cooperation and humility at the same time.`,
      `Difference is permanent, so the real task is learning how to carry it without dehumanization.`,
      `Plural institutions and strong relationships help protect common life.`,
      `Moral complexity should sharpen judgment rather than dissolve it.`,
      `The book ends by asking for wiser design, not for one final ideological win.`,
    ],
    practice: [
      `Notice one value you tend to overuse and one value you often neglect.`,
      `Protect one relationship that helps you stay connected across moral difference.`,
      `Choose one community, media habit, or institution that makes your moral life healthier rather than harsher.`,
      `Ask what common good a disagreement still requires even when no full agreement is possible.`,
      `Use humility to refine judgment, not to avoid it.`,
    ],
    examples: [
      example(
        `ch12-ex01`,
        `Family holidays without moral war`,
        [`personal`],
        `A family gathering keeps collapsing into moral sorting because everyone arrives prepared to defend a whole worldview. The event needs some common life if it is going to survive, but it cannot require fake agreement on everything.`,
        `Set a few shared norms that protect dignity and allow real difference without total combat. The goal is not to solve every issue over one meal. It is to preserve a moral community that can hold disagreement without humiliation.`,
        `The closing chapter is practical here. Living well with difference means deciding what common standards are necessary and what total victories are not.`
      ),
      example(
        `ch12-ex02`,
        `Choosing a healthier moral environment`,
        [`personal`],
        `Someone notices that their daily media diet leaves them angrier, more contemptuous, and less able to imagine any decency in people outside their camp. The content keeps the righteous mind activated without giving it any corrective contact.`,
        `Treat media choice as moral environment design. Reduce inputs that reward moral performance and add voices or communities that widen understanding without demanding false neutrality.`,
        `The chapter ends with design because moral life is shaped by what we repeatedly expose ourselves to, not only by what we claim to believe.`
      ),
      example(
        `ch12-ex03`,
        `Writing residence rules that people can live with`,
        [`school`],
        `A residence hall needs clear standards for shared life, yet students have different values around privacy, community, freedom, and order. If the rules only honor one value cluster, resentment grows quickly.`,
        `Build the policy around the common goods that really must be protected while leaving reasonable space for difference elsewhere. Explain which tradeoffs are being made and why.`,
        `Plural life works best when institutions name the common standard clearly without pretending that every resident shares the same moral ranking.`
      ),
      example(
        `ch12-ex04`,
        `A student group that needs both conviction and breadth`,
        [`school`],
        `A student organization cares deeply about its mission but is becoming internally brittle because members treat every disagreement as a threat to moral identity. New people with useful perspectives stop staying.`,
        `Rebuild norms so that challenge can count as commitment rather than betrayal. Strong mission and moral humility should support each other, not act like enemies.`,
        `The chapter's final lesson is that durable groups need both moral purpose and enough openness to keep learning.`
      ),
      example(
        `ch12-ex05`,
        `Leading a morally diverse team`,
        [`work`],
        `A manager leads people who differ in political instinct, risk tolerance, and moral emphasis, yet the team still has to make good decisions together. If every disagreement becomes a referendum on character, the team will get slower and meaner.`,
        `Define the common goods the team must protect, such as fairness, safety, accountability, and trust, and then create a process where different moral sensitivities can surface risks without becoming identity warfare.`,
        `Diversity becomes useful when structure turns moral difference into better judgment rather than into permanent tribal struggle.`
      ),
      example(
        `ch12-ex06`,
        `Company values after a hard conflict`,
        [`work`],
        `A company goes through a painful internal dispute and realizes its stated values are too vague to guide conflict well. People want cohesion, but they also want protection from moral conformity.`,
        `Rewrite the values around a few real common commitments and pair them with norms that protect dissent, accountability, and dignity. A healthy culture needs shared standards and a way to challenge them honestly when they are applied badly.`,
        `The chapter closes the book by pointing toward institutional wisdom. Good moral life depends on design as much as on private intention.`
      ),
    ],
    questions: [
      question(
        `ch12-q01`,
        `What is the central balance this final chapter tries to hold?`,
        [
          `Morality is necessary for common life, yet moral passion can also blind and divide.`,
          `Morality should be replaced by pure individual preference.`,
          `Shared life works best when every group uses one moral language.`,
          `Difference disappears once people learn the six foundations.`,
        ],
        0,
        `Haidt closes by holding together the value and the danger of the righteous mind.`
      ),
      question(
        `ch12-q02`,
        `What does the chapter suggest about moral difference?`,
        [
          `It is permanent enough that we need wiser ways to live with it rather than fantasies of eliminating it.`,
          `It can be erased by one good civic program.`,
          `It matters only in politics and not in ordinary life.`,
          `It should be ignored whenever groups need unity.`,
        ],
        0,
        `The final chapter treats difference as a durable feature of social life, which is why design and humility matter so much.`
      ),
      question(
        `ch12-q03`,
        `Why do plural societies still need common standards?`,
        [
          `Because shared life collapses without some common goods and rules of dignity.`,
          `Because all citizens actually share the same moral ranking once they think harder.`,
          `Because diversity always weakens cooperation.`,
          `Because common standards remove the need for humility.`,
        ],
        0,
        `Pluralism needs some common goods to hold a community together while leaving room for difference elsewhere.`
      ),
      question(
        `ch12-q04`,
        `A family gathering cannot solve every worldview conflict in one night. What is the wisest goal from this chapter?`,
        [
          `Protect a shared moral community with clear norms of dignity rather than chasing total victory.`,
          `Force full agreement before the meal can continue.`,
          `Avoid any standards at all so no one feels constrained.`,
          `Assume that unresolved conflict means the family has failed morally.`,
        ],
        0,
        `The chapter favors preserving common life where possible instead of treating every encounter as a final showdown.`
      ),
      question(
        `ch12-q05`,
        `Why are friendships across moral difference so important here?`,
        [
          `They make entire camps harder to dehumanize and keep complexity alive.`,
          `They guarantee agreement on major issues.`,
          `They matter only when political stakes are low.`,
          `They replace the need for institutions.`,
        ],
        0,
        `Personal relationships protect against caricature and make moral life less tribal.`
      ),
      question(
        `ch12-q06`,
        `What would it mean to use moral complexity badly?`,
        [
          `Turning it into paralysis or refusing to judge anything at all.`,
          `Letting it refine judgment after humility.`,
          `Using it to hear more than one moral concern in a conflict.`,
          `Pairing it with common goods and boundaries.`,
        ],
        0,
        `The chapter does not want endless hesitation. It wants wiser judgment that comes after wider seeing.`
      ),
      question(
        `ch12-q07`,
        `A leader wants a diverse team to make better decisions without turning diversity into chaos. What best fits this chapter?`,
        [
          `Clarify common goods and use process to let different moral sensitivities surface productively.`,
          `Demand identical values from every member before work can begin.`,
          `Ignore moral difference because only technical skill matters.`,
          `Treat every disagreement as proof the team is broken.`,
        ],
        0,
        `The chapter points toward design that turns difference into a source of insight rather than a trigger for moral warfare.`
      ),
      question(
        `ch12-q08`,
        `Why does the chapter care about media and community choice?`,
        [
          `Because environments train what feels obvious, threatening, and honorable over time.`,
          `Because private belief is untouched by repeated social input.`,
          `Because only formal laws shape moral life.`,
          `Because the righteous mind is fixed once adulthood begins.`,
        ],
        0,
        `The closing lesson continues the book's emphasis on design by treating environments as moral training grounds.`
      ),
      question(
        `ch12-q09`,
        `Which statement best captures the chapter's tone?`,
        [
          `Seek wisdom rather than purity and design common life for people who will never agree on everything.`,
          `Give up on shared life because moral difference is too strong.`,
          `Trust that your own camp can safely define the whole moral order.`,
          `Avoid all strong commitments so conflict disappears.`,
        ],
        0,
        `The chapter is neither cynical nor utopian. It looks for wiser forms of common life under permanent difference.`
      ),
      question(
        `ch12-q10`,
        `What deeper habit does this final chapter try to build?`,
        [
          `Balancing conviction, humility, common goods, and institutional design in moral life.`,
          `Replacing all moral judgment with procedural neutrality.`,
          `Believing that only personal virtue matters and systems do not.`,
          `Treating every conflict as a sign that pluralism has failed.`,
        ],
        0,
        `The book ends by asking for mature moral practice that can live with complexity without surrendering standards.`
      ),
    ],
  }),
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertNoDash(value, pathLabel) {
  if (typeof value !== "string") return;
  if (/[—-]/.test(value)) {
    throw new Error(`Dash found at ${pathLabel}: ${value}`);
  }
}

function validateChapter(chapter) {
  assert(chapter.summaries.easy.length === 2, `Chapter ${chapter.number} simple summary count`);
  assert(chapter.summaries.medium.length === 2, `Chapter ${chapter.number} standard summary count`);
  assert(chapter.summaries.hard.length === 2, `Chapter ${chapter.number} deeper summary count`);
  assert(chapter.bullets.length === 15, `Chapter ${chapter.number} bullet count`);
  assert(chapter.examples.length === 6, `Chapter ${chapter.number} example count`);
  assert(chapter.questions.length === 10, `Chapter ${chapter.number} question count`);

  const contextCounts = chapter.examples.reduce(
    (counts, item) => {
      item.contexts.forEach((context) => {
        counts[context] = (counts[context] || 0) + 1;
      });
      return counts;
    },
    { personal: 0, school: 0, work: 0 }
  );
  assert(contextCounts.personal === 2, `Chapter ${chapter.number} personal scenario count`);
  assert(contextCounts.school === 2, `Chapter ${chapter.number} school scenario count`);
  assert(contextCounts.work === 2, `Chapter ${chapter.number} work scenario count`);

  const checkValue = (value, pathLabel) => {
    if (typeof value === "string") {
      assertNoDash(value, pathLabel);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => checkValue(item, `${pathLabel}[${index}]`));
      return;
    }
    if (value && typeof value === "object") {
      Object.entries(value).forEach(([key, inner]) => {
        if (key === "questionId" || key === "exampleId") return;
        checkValue(inner, `${pathLabel}.${key}`);
      });
    }
  };

  checkValue(
    {
      summaries: chapter.summaries,
      bullets: chapter.bullets,
      takeaways: chapter.takeaways,
      practice: chapter.practice,
      examples: chapter.examples,
      questions: chapter.questions,
    },
    `chapter${chapter.number}`
  );

  chapter.questions.forEach((item, index) => {
    assert(item.choices.length === 4, `Chapter ${chapter.number} question ${index + 1} choice count`);
  });
}

function buildPackage() {
  authoredChapters.forEach(validateChapter);

  const chaptersByNumber = new Map(authoredChapters.map((item) => [item.number, item]));

  const nextPackage = {
    ...existingPackage,
    createdAt: "2026-03-19T00:00:00Z",
    chapters: existingPackage.chapters.map((chapter) => {
      const authored = chaptersByNumber.get(chapter.number);
      assert(authored, `Missing authored chapter ${chapter.number}`);
      return {
        ...chapter,
        contentVariants: variantsFromMaster(authored),
        examples: authored.examples,
        quiz: {
          passingScorePercent: 80,
          questions: authored.questions,
        },
      };
    }),
  };

  return nextPackage;
}

function renderReport(chapters) {
  const lines = [];
  lines.push(`# 1. Book audit summary for The Righteous Mind by Jonathan Haidt`);
  lines.push("");
  auditSummary.forEach((paragraph) => {
    lines.push(paragraph);
    lines.push("");
  });

  lines.push(`# 2. Main content problems found`);
  lines.push("");
  mainProblems.forEach((item, index) => {
    lines.push(`${index + 1}. ${item}`);
  });
  lines.push("");

  lines.push(`# 3. Personalization strategy for The Righteous Mind by Jonathan Haidt`);
  lines.push("");
  personalizationStrategy.forEach((paragraph) => {
    lines.push(paragraph);
    lines.push("");
  });

  lines.push(`# 4. Any minimal schema adjustments needed`);
  lines.push("");
  minimalSchemaAdjustments.forEach((item) => {
    lines.push(`1. ${item}`);
  });
  lines.push("");

  lines.push(`# 5. Chapter by chapter revised content`);
  lines.push("");

  chapters.forEach((chapter) => {
    lines.push(`## ${chapter.number}. ${chapter.title}`);
    lines.push("");
    lines.push(`### Summary`);
    lines.push("");
    lines.push(`#### Simple`);
    lines.push("");
    lines.push(`1. ${chapter.summaries.easy[0]}`);
    lines.push(`2. ${chapter.summaries.easy[1]}`);
    lines.push("");
    lines.push(`#### Standard`);
    lines.push("");
    lines.push(`1. ${chapter.summaries.medium[0]}`);
    lines.push(`2. ${chapter.summaries.medium[1]}`);
    lines.push("");
    lines.push(`#### Deeper`);
    lines.push("");
    lines.push(`1. ${chapter.summaries.hard[0]}`);
    lines.push(`2. ${chapter.summaries.hard[1]}`);
    lines.push("");

    lines.push(`### Bullet points`);
    lines.push("");
    lines.push(`#### Simple`);
    lines.push("");
    chapter.bullets.slice(0, 7).forEach((item, index) => {
      lines.push(`${index + 1}. ${item.text} ${item.detail}`);
    });
    lines.push("");
    lines.push(`#### Standard`);
    lines.push("");
    chapter.bullets.slice(0, 10).forEach((item, index) => {
      lines.push(`${index + 1}. ${item.text} ${item.detail}`);
    });
    lines.push("");
    lines.push(`#### Deeper`);
    lines.push("");
    chapter.bullets.slice(0, 15).forEach((item, index) => {
      lines.push(`${index + 1}. ${item.text} ${item.detail}`);
    });
    lines.push("");

    lines.push(`### Scenarios`);
    lines.push("");
    chapter.examples.forEach((item, index) => {
      lines.push(`${index + 1}. ${item.title}`);
      lines.push(`Scenario: ${item.scenario}`);
      lines.push(`What to do: ${item.whatToDo[0]}`);
      lines.push(`Why it matters: ${item.whyItMatters}`);
      lines.push("");
    });

    lines.push(`### Quiz`);
    lines.push("");
    chapter.questions.forEach((item, index) => {
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

  lines.push(`# 6. Final quality control summary`);
  lines.push("");
  finalQualityControl.forEach((item, index) => {
    lines.push(`${index + 1}. ${item}`);
  });
  lines.push("");

  return `${lines.join("\n").trim()}\n`;
}

function main() {
  const nextPackage = buildPackage();
  fs.writeFileSync(packagePath, `${JSON.stringify(nextPackage, null, 2)}\n`);
  fs.writeFileSync(reportPath, renderReport(authoredChapters));
  console.log(`Wrote ${packagePath}`);
  console.log(`Wrote ${reportPath}`);
}

main();
