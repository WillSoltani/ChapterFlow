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
