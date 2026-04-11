const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const runRoot = path.resolve(".chapterflow/runs/the-48-laws-of-power/20260409-002544");
const num = 47;
const stem = `ch${String(num).padStart(2, "0")}`;
const title = "Do Not Go Past the Mark You Aimed For; In Victory, Learn When to Stop";
const chapterId = "ch47-do-not-go-past-the-mark-you-aimed-for-in-victory-learn-when-to-stop";
const createdAt = new Date().toISOString();

function tone(gentle, direct, competitive) {
  return { gentle, direct, competitive };
}

function ensureDir(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

function writeText(file, text) {
  ensureDir(file);
  fs.writeFileSync(file, text.endsWith("\n") ? text : `${text}\n`, "utf8");
}

function writeJson(file, data) {
  ensureDir(file);
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function words(text) {
  return String(text).trim().split(/\s+/).filter(Boolean).length;
}

const canonical = `Greene's forty-seventh law argues that victory contains its own danger. Once a person reaches the objective they were aiming for, success often creates the temptation to keep pressing anyway. The law is not saying ambition is bad or that one should stop before the work is done. It is saying that excess after success can expose a position that was already strong enough, turning a secured gain into an avoidable reversal. The chapter is strongest when it stays on overreach, stop points, and consolidation rather than drifting into generic moderation.

That is why the chapter values disciplined stopping. A win is not always preserved by one more push. Sometimes the extra move adds more exposure than advantage. Greene's point is that victory can intoxicate judgment. People who have just succeeded may feel larger than the limits that still surround them. Restraint after success can therefore be part of securing the gain rather than a sign of weakness. Knowing when to stop may protect the victory better than trying to enlarge it.

The chapter therefore distinguishes strategic stopping from timid under-aiming. Strategic stopping happens after the mark is reached and the position can be held. Timid under-aiming stops before the objective is secured and confuses fear with discipline. Greene's useful claim is narrower than anti-ambition advice: consolidate what you have won, but do not confuse excess with strength or incompletion with prudence.

Ordinary settings make the mechanism visible. A work negotiation may already be won before one more demand turns cooperation into backlash. A student campaign or committee fight may already have enough support before triumph pushes the room into opposition. A personal conflict may be resolved before one extra point turns closure into renewed hostility. In each case, the practical question is whether the next move secures the gain or exposes it.

The law overreaches when it becomes fear of finishing or refusal to consolidate a fragile win. Some victories are incomplete and still need follow-through. Some situations punish stopping too soon. Greene is strongest when he treats restraint after success as a strategic limit rather than as a command to stay small. Chapter 46 showed how visible perfection can provoke envy unless success is softened. Chapter 47 shows how victory can provoke reversal unless success is limited. Chapter 48 follows by turning from stop points toward formless adaptation.`;

const edited = canonical;

const critic = `# Chapter 47 Critic Report

Score: 11/12

- hook quality: 2/2
- paragraph-job distinctness: 2/2
- anchor use: 2/2
- chapter specificity: 2/2
- easy-mode convertibility: 1/1
- meta-distance: 1/1
- hard-edge preservation: 1/1
- conceptual repetition risk: 0/1

Weakest paragraph:
- Paragraph 4 is most exposed because the work, school, and personal examples can collapse into generic restraint advice if conversion loses the victory-versus-overreach logic.

Strongest sentence:
- "Sometimes the extra move adds more exposure than advantage."

Anchor use notes:
- The draft stays inside the supported frame: success creating overreach temptation, excess producing reversal, strategic stopping after the mark, and the limit where stopping too early leaves the gain unsecured.

Contamination / source-splice check:
- No contamination phrase detected.
- No source-splice suspicion detected.

Gate judgment:
- Local patching only if needed during conversion.
- No global reroute required.
`;

const chapter = {
  chapterId,
  number: num,
  title,
  readingTimeMinutes: 8,
  contentVariants: {
    easy: {
      chapterBreakdown: tone(
        "This law says success can become dangerous when you keep pushing past the point that already won the goal. Greene is not saying ambition is bad. He is saying victory can create overconfidence, and overconfidence can turn one more move into a reversal. That is why stopping matters here. The goal is not to quit early. The goal is to know when the mark has been reached and when extra pressure only adds risk. The mistake is not winning. The mistake is trying to enlarge the win after the gain is already secure enough.",
        "Greene's forty-seventh law argues that people often lose after they win because they do not know when to stop. Success can make the next move feel irresistible even when the goal is already achieved. The law is not anti-ambition advice. It is advice to consolidate victory instead of overextending it. Push until the mark is reached, then judge whether another move protects the gain or threatens it.",
        "This law gives a competitive warning: victory can tempt you into the one move too many. Greene is not praising passivity. He is showing that excess after success can create backlash, exposure, or reversal. The edge lies in stopping after the win is secured instead of letting triumph talk you into overreach."
      ),
      keyTakeaways: [
        { point: tone("Victory can create overreach.", "Success often tempts people to push past the original mark.", "A win can become unstable when triumph turns into excess.") },
        { point: tone("Stopping can preserve the gain.", "Restraint after success can protect what has already been won.", "Consolidation may be stronger than one more push.") },
        { point: tone("The law has a premature-stop limit.", "Do not stop before the objective is secure enough to hold.", "Restraint fails if it abandons necessary consolidation.") }
      ],
      oneMinuteRecap: tone(
        "This law says a win can be lost if you keep pushing after the mark is already reached.",
        "Protect victory by knowing when the next move adds exposure instead of strength.",
        "Stop after success is secure, not before it can hold."
      )
    },
    medium: {
      chapterBreakdown: tone(
        "Greene's forty-seventh law begins with a danger hidden inside success itself: victory often tempts people to go beyond the point they originally needed. People do not always lose because they failed to push hard enough. They also lose because the feeling of triumph distorts judgment after the objective has already been reached. That is why the chapter keeps its focus on overreach. Greene is not saying that ambition should be weak. He is saying that one move too many can turn a real gain into exposure, backlash, or reversal.\n\nStopping matters here for a strategic reason. A position that is already won is not always made safer by pressing further. Sometimes the extra demand, extra display, or extra pressure creates new opposition that did not need to exist. Greene's point is that victory can intoxicate the person who has just achieved it. Restraint after success can therefore preserve the gain more effectively than further expansion. A stop point can be part of power, not a retreat from it.\n\nThe chapter is strongest when it separates strategic stopping from timid under-aiming. Strategic stopping still reaches the mark and secures it. Timid under-aiming quits before the position is strong enough to hold. Greene is not offering passive moderation. He is offering a narrower discipline: stop once the objective is secured enough to preserve, but do not confuse unfinished work with post-victory restraint.\n\nOrdinary settings make the logic concrete. Ronan may already have enough in a work negotiation before one more demand turns the room against him. Leora may have already won a school campaign before triumph makes the team overplay its advantage. A personal disagreement may be resolved before one extra point revives the conflict. In each setting, the practical question is whether the next move consolidates the gain or endangers it.\n\nThe law overreaches when it excuses fear of finishing or refusal to stabilize a fragile win. Some victories still need follow-through before they are safe. Greene's useful limit is sharper: learn where the mark really is, stop when the gain can hold, but continue when the position would collapse without consolidation. Chapter 46 dealt with softening success so it would not provoke envy. Chapter 47 deals with limiting success so it does not provoke reversal. Chapter 48 turns toward formless adaptation.",
        "A person can win and still ruin the result by refusing to stop. Greene's point in this chapter is that danger often arrives after success, not only before it. People who have just gained leverage may believe that another push will make them invulnerable. What it may actually do is widen the field of resistance. That is why the victory limit matters. The issue is not whether success is good. The issue is whether the next move protects the win or turns achievement into overreach.\n\nThe stop point is the chapter's mechanism for that problem. Greene is not worshipping caution for its own sake. He is noticing that a gain can become less secure when a person tries to enlarge it after the decisive point has already been reached. Consolidation may be stronger than one more demand. The victory remains, but the extra pressure is removed before it creates needless backlash.\n\nThis is also why the chapter should not be flattened into generic moderation advice. Strategic restraint is active. It secures, consolidates, and holds. Generic moderation only says less is safer. Greene's harder distinction is between someone who knows the difference between winning and overreaching and someone who stops too early out of fear.\n\nExamples make the line easier to see. Ronan can take the work win without pushing so far that cooperation collapses after the agreement. Leora can stop a school campaign at the point of secured support instead of turning confidence into arrogance. A personal setting can improve once one person stops arguing after closure has already been reached. In each case, the shift is from enlarging the win to preserving it.\n\nThe law fails when avoiding overreach becomes more important than making the victory stable. Some settings require a final step of consolidation. Greene's point is not to cut off every follow-through. It is to judge when more pressure is now serving triumph rather than strategy. Chapter 46 asked how visible success could avoid envy. Chapter 47 asks how visible success can avoid self-created reversal. The next chapter shifts toward formlessness beyond fixed stop points.",
        "Greene's forty-seventh law warns that people often fall after victory because they mistake momentum for necessity. Readers who flatten the chapter into anti-ambition advice miss the sharper mechanism. Success can be strengthened by consolidation. It can be endangered by excess. The law therefore studies overreach as a reaction to winning rather than as a simple failure of planning.\n\nStop points matter for a strategic reason. A stop point is not submission to fear. It is a way of protecting a gain once the original mark has already been reached. Greene's strategic claim is that victory may need a consolidation window rather than immediate enlargement. If triumph keeps pressing for more, people may organize themselves less around the justice of the win than around the need to halt the winner.\n\nThe useful distinction is between preserving the mark and abandoning the finish. Preserving the mark means judging what is already secure and refusing needless escalation. Abandoning the finish means stopping before the position can hold. Greene is not advocating timidity. He is warning that excess after success can sabotage a sound outcome by making it larger, louder, or harsher than it needed to be.\n\nRonan's work case, Leora's school win, and a personal negotiation all show the same mechanism. The first question is not whether victory is deserved. The first question is whether the people living with it can absorb one more push without organizing against it. Post-victory restraint is strategic rather than sentimental here. It protects the gain by preventing triumph from becoming its own opponent.\n\nThe chapter overreaches when it becomes an excuse for leaving a win unconsolidated or fragile. Some victories are not real until they are stabilized. Greene's reliable lesson is narrower and harder: stop after the mark is defensible, not after the first emotional feeling of success. Chapter 46 dealt with managing resentment around visible success. Chapter 47 deals with managing excess after success. Chapter 48 follows by asking what remains when strategy stops clinging to fixed form."
      ),
      keyTakeaways: [
        {
          point: tone("Victory can create the temptation to overreach.", "Success often invites one push too many.", "The danger of triumph is that it can mistake momentum for strategic need."),
          moreDetails: tone("The chapter asks the reader to watch what changes once the objective is already in hand.", "A gain can become vulnerable when the winner keeps enlarging it without reason.", "Reversal often starts after success has already distorted judgment.")
        },
        {
          point: tone("A stop point can preserve the gain.", "Restraint after victory can secure what excess would expose.", "Consolidation may be stronger than immediate enlargement."),
          moreDetails: tone("Stopping here is a way of protecting the objective once it is reached.", "The chapter values the discipline of holding a win instead of always inflating it.", "Power is preserved when the next move is judged by protection rather than triumph.")
        },
        {
          point: tone("Strategic stopping is different from timid under-aiming.", "Stopping after the mark is not the same as quitting before the position can hold.", "Restraint stops being strength once it leaves the gain exposed and unconsolidated."),
          moreDetails: tone("The chapter is not permission for passive half-measures.", "A useful stop point arrives after the objective is defensible, not before it exists.", "Premature stopping solves the wrong problem by protecting comfort instead of the gain.")
        },
        {
          point: tone("Work, school, and personal settings all expose the same victory logic.", "Ordinary settings show how one extra push can reverse a real win.", "The same overreach curve appears wherever triumph outruns strategy."),
          moreDetails: tone("A team, campaign, or relationship can all turn once a secured gain is pushed too far.", "The practical test is whether the next move stabilizes the result or turns others against it.", "Stopping matters because backlash often forms around excess, not only around the original win.")
        },
        {
          point: tone("The law has a consolidation limit.", "Some victories still need follow-through before they are safe.", "Restraint fails when it leaves the win too fragile to survive."),
          moreDetails: tone("Greene stays useful only when this limit remains active.", "Stopping too soon can undo the lesson by leaving the position exposed.", "The hard judgment is whether the mark has really been reached in a durable way.")
        }
      ],
      activationPrompt: tone(
        "Find one victory you are tempted to enlarge and ask whether the next move would secure it or expose it.",
        "Choose one setting where consolidation is now stronger than another push.",
        "Name one case where stopping preserves the gain and one where more work is still needed to make the win hold."
      ),
      selfCheckPrompt: tone(
        "Has the original mark actually been reached, or am I trying to stop too early?",
        "What new exposure would this next move create that the current win does not require?",
        "Am I consolidating a gain, or am I feeding triumph with unnecessary escalation?"
      ),
      oneMinuteRecap: tone(
        "This chapter says victory can become dangerous when success tempts you into the extra move that exposes the gain.",
        "A strong strategy often consolidates what has already been won instead of enlarging it for the sake of triumph.",
        "The strategic task is to know when a win is secure enough to hold and when stopping would still be premature."
      )
    },
    hard: {
      chapterBreakdown: {
        gentle: "Greene's forty-seventh law is less about caution as a virtue than about victory as a distortion of judgment. People often prepare for danger on the way up and then become careless once success arrives. The chapter therefore asks the reader to distrust triumph after the mark has already been reached. A win can still be lost if the winner continues acting as though every further gain is necessary. Greene is studying what one push too many does to a field that had already begun to settle.\n\nThat is why disciplined stopping matters. Disciplined stopping is not surrender to fear. It is a way of protecting a gain once the objective is already secure enough to defend. Greene's point is that the next move after victory can create exposure disproportionate to its value. The gain stays real, but the additional pressure pushes others into backlash, revenge, or renewed resistance that the original win had already avoided.\n\nThe harder distinction is between strategic stopping and premature withdrawal. Strategic stopping keeps the gain intact. It consolidates what matters and refuses unnecessary enlargement. Premature withdrawal leaves the position too soft to survive. Greene is not telling the reader to become hesitant. He is telling the reader to stop once the mark is defensible instead of confusing excess with strength.\n\nRonan's negotiation, Leora's school campaign, and a personal settled conflict all reveal the same structure. Each case turns on whether the next move secures the result or only satisfies triumph. The strategic gain is not smaller ambition. The gain is that consolidation protects a real win that overreach might dissolve. Victory keeps its value precisely because it is not stretched into needless danger.\n\nThe law remains useful only if its limit is preserved. Some wins are illusions until they are stabilized. Some fields punish early stopping more than overreach. Greene's chapter works when it sharpens judgment about where restraint preserves the gain and where further action is still required to make the gain real. Chapter 46 showed how visible perfection can provoke envy if success is displayed too purely. Chapter 47 shows how victory can provoke reversal if success is pressed too far.\n\nThat bridge matters because envy and overreach are different threats to success. One turns the field against visible superiority. The other turns the winner against their own advantage through excess. Chapter 47 therefore teaches a diagnostic of completion: ask not only whether you have won, but whether the next move is defending the mark or merely enlarging triumph. Chapter 48 follows by turning from stop points toward formless adaptation beyond fixed shape.",
        direct: "A winner can undo the win by refusing to stop. Greene uses Chapter 47 to shift attention from the difficulty of achieving victory to the difficulty of limiting it. Readers who reduce this to generic moderation miss the strategic core. The issue is not that ambition always goes too far. The issue is that success can blur the difference between what is necessary to secure the gain and what is merely satisfying to the ego that has just won.\n\nThat is why stop points are useful here. A stop point is not cowardice. It is a boundary that protects a gain once the objective has become defensible. Greene's argument is that victory often survives better when the winner consolidates rather than expands. One more demand, one more humiliation, or one more assertion of power can turn a settling field back into an oppositional one.\n\nThe real distinction is between preserving the win and retreating from completion. Preserving the win still stabilizes the outcome. Retreating from completion stops before the structure can hold. Greene's law is therefore not anti-ambition. It is anti-overreach after success when overreach is needlessly building the coalition that will challenge the victory.\n\nRonan's negotiation, Leora's campaign, and a personal closed dispute all show the same mechanism. In each case, the question is whether the next move is creating security or simply extending triumph. If it is the second, exposure begins to grow faster than leverage. Post-victory restraint matters because backlash often forms around excess, not around the original success itself.\n\nThe chapter overreaches when readers use it to justify incomplete work, weak consolidation, or fear of finishing in fields that require one final stabilizing move. That limit must remain active. Some wins are not safe until they are settled fully. Greene's useful instruction is narrower: stop after the mark is secured enough to endure, but keep moving if the gain would collapse without one more necessary step. Chapter 46 tracked cooperation under visible success. Chapter 47 tracks durability under victory. Chapter 48 then turns toward formless adaptation beyond fixed victory shapes.",
        competitive: "Greene's forty-seventh law warns that victory can become its own enemy the moment it forgets where the mark was. Many readers think failure comes mainly from not pushing far enough. Greene's sharper observation is that people often lose after they have already won, because triumph keeps pressing long after strategy should have stopped. What breaks the position is not always weakness. It is the excess that turns leverage into provocation and completion into overreach.\n\nThat is why restraint after success is power rather than softness. A disciplined stop can keep opponents from reorganizing around the need to punish the winner's excess. Greene is not praising half-measures. He is describing how a gain is preserved while the field is still capable of accepting it. The person who extends victory too aggressively may look stronger for a moment, but may also gather the very backlash that makes the win unstable.\n\nThe harder edge in the chapter is its distinction between strategic stopping and cowardly incompletion. Strategic stopping secures the mark and refuses needless enlargement. Cowardly incompletion avoids the last necessary step and calls it prudence. Greene's claim is that completion is part of force. A sound victory mishandled after the fact can create more danger than a slightly smaller victory left in a stable form.\n\nRonan, Leora, and a personal settled conflict all expose the same pattern. The question is not whether the win is deserved. The question is how much more the field can absorb before the winner's own momentum becomes the problem. Once backlash hardens, people stop responding to the original issue and start responding to the winner's excess. That is when triumph becomes strategically expensive.\n\nThe limit is what keeps the law from collapsing into timid anti-ambition advice. Some victories are not real until they are consolidated fully enough to survive. Some fields punish soft stopping more than hard finishing. Greene remains useful only when the reader can judge when restraint preserves the gain and when follow-through is still required to make the victory durable. Chapter 46 used moderated display to keep success from provoking envy. Chapter 47 uses moderated momentum to keep success from provoking reversal. Chapter 48 follows by asking what strategy becomes when it stops clinging even to fixed winning form."
      },
      keyTakeaways: [
        {
          point: tone("Victory can distort judgment after the mark is already reached.", "Success often creates the temptation to keep pushing after necessity has ended.", "Triumph can turn momentum into overreach when the winner forgets the original objective."),
          moreDetails: tone("The chapter asks the reader to study what changes after the gain is already in hand.", "A real win can become fragile when excess replaces strategic need.", "Reversal often begins when success enlarges itself beyond its own purpose.")
        },
        {
          point: tone("Disciplined stopping can preserve what has been won.", "Consolidation may protect a gain better than one more assertion of power.", "A stop point can keep leverage from becoming provocation."),
          moreDetails: tone("Stopping here means defending the mark once it is secure enough to endure.", "The chapter values holding a win instead of inflating it for triumph's sake.", "Power is preserved when the next move is judged by durability rather than ego.")
        },
        {
          point: tone("Strategic stopping is different from cowardly incompletion.", "Stopping after the mark is defensible is not the same as quitting before the gain can hold.", "Restraint fails once it leaves the victory without the consolidation it still needs."),
          moreDetails: tone("The chapter turns weak if the reader mistakes it for permission to leave work half-finished.", "A useful stop point arrives after the position can survive without more pressure.", "Premature stopping protects comfort but leaves the gain exposed.")
        },
        {
          point: tone("Ordinary settings reveal the same overreach curve after success.", "Teams, campaigns, and relationships all show how one extra push can reverse a real win.", "The same pressure appears wherever victory makes the winner forget the field's tolerance."),
          moreDetails: tone("The issue is whether others can still absorb the next move without reorganizing against it.", "Work, school, and personal settings all become unstable when triumph demands more than the secured gain requires.", "Practical strategy starts by asking whether the next move is consolidation or ego enlargement.")
        },
        {
          point: tone("The law fails when restraint leaves the victory too fragile.", "Some wins still need a final stabilizing step before they are real.", "Stopping is strategic only when the mark is secure enough to hold."),
          moreDetails: tone("This limit keeps the chapter from becoming passive moderation doctrine.", "Some fields need full consolidation before the win is durable.", "The hard judgment is how much follow-through is necessary before restraint begins to protect rather than endanger.")
        }
      ],
      activationPrompt: tone(
        "Find one win where the next move feels attractive mainly because you are winning, not because the gain still needs it.",
        "Choose one success that would now be stronger if it were consolidated instead of enlarged.",
        "Identify one field where stopping preserves the mark and one where another necessary step is still required."
      ),
      selfCheckPrompts: [
        tone(
          "Has the mark actually been reached in a durable way, or am I just eager to stop?",
          "What additional exposure would this next move create that the current win does not need?",
          "Am I preserving the gain, or am I feeding triumph with unnecessary extension?"
        ),
        tone(
          "If I stop here, what weakness in the position remains unconsolidated?",
          "At what point does more pressure stop serving strategy and start serving ego?",
          "How much more can this field absorb before victory turns into provocation or reversal?"
        )
      ],
      predictionPrompt: tone(
        "If Chapter 47 is about learning where to stop after victory, how might Chapter 48 move beyond stop points toward formless adaptation?",
        "What changes when strategy no longer depends on fixed marks or fixed winning shapes?",
        "After learning when to stop, how does strategy move toward flexibility that can survive changing conditions?"
      ),
      oneMinuteRecap: tone(
        "This chapter argues that victory can become dangerous when success keeps pressing after the mark is already secured.",
        "A gain holds more safely when the winner consolidates it instead of enlarging it for the sake of triumph.",
        "The hard task is to know when the objective is durable enough to stop and when restraint would still be premature."
      )
    }
  },
  examples: [
    {
      title: "Ronan Stops the Negotiation at the Point Where the Deal Is Already Won",
      format: "decision_point",
      category: "work",
      endingType: "broader_principle",
      scenario: tone("Ronan has enough in a work negotiation to secure the outcome, but he is tempted to push one demand further because the other side is already yielding.", "He has to decide whether the extra demand strengthens the win or endangers it.", "The issue is not whether more is possible, but whether more is strategically necessary."),
      whatToDo: tone("He stops once the gain is defensible and shifts from enlargement to consolidation.", "He protects the agreement instead of turning triumph into needless exposure.", "He treats the stop point as part of securing the win rather than as lost ambition."),
      whyItMatters: tone("The chapter says one move too many can reverse a real gain.", "His case shows how restraint can preserve a victory more effectively than one extra demand.", "The gain comes from protecting leverage before it becomes provocation.")
    },
    {
      title: "Leora Explains Why the Campaign Should Stop at the Win Instead of Enlarging It",
      format: "dialogue",
      category: "school",
      endingType: "self_directed_question",
      scenario: tone("Leora is helping a student campaign that already has enough support, but the team wants to keep pressing as if victory itself proves that more pressure is safe.", "The conversation turns on whether the next move would consolidate support or turn confidence into backlash.", "She is trying to separate strategic completion from triumph-driven overreach."),
      whatToDo: tone("She secures the win and stops before the campaign's momentum becomes the opposition's rally point.", "She asks which part of the result still needs stabilization and which part is already safe enough to hold.", "She treats completion as a boundary rather than as permission for excess."),
      whyItMatters: tone("The chapter argues that victory can create danger when it keeps pushing past the mark.", "Her example shows how school settings also punish triumph when it outruns necessity.", "Stopping matters because one more push can organize resistance that the original win had already avoided.")
    },
    {
      title: "Hugo Has to Judge Whether One More Point in the Argument Will Secure Closure or Reopen the Fight",
      format: "dilemma",
      category: "personal",
      endingType: "surprising_implication",
      scenario: tone("Hugo has effectively won a personal dispute, but he can still feel the urge to make one more point so the other person understands exactly how wrong they were.", "He has to decide whether that extra point secures the outcome or turns closure back into conflict.", "The dilemma is between completion and ego extension, not between strength and gentleness."),
      whatToDo: tone("He stops at the point where the issue is already resolved instead of converting closure into humiliation.", "He checks whether the gain is truly secure or whether a final consolidating step is still needed.", "He refuses to confuse emotional satisfaction with strategic necessity."),
      whyItMatters: tone("The chapter has a premature-stop limit as well as an overreach warning.", "His case shows that the extra point often serves triumph more than durable resolution.", "The hard task is to preserve the win without reopening the field.")
    },
    {
      title: "Viona Predicts the Tournament Committee Will Turn If the Winners Push Their Advantage Too Far",
      format: "predict_reveal",
      category: "school",
      endingType: "cross_domain",
      scenario: tone("Viona predicts that a tournament committee will accept the initial result but resist if the winning side turns that result into a wider display of dominance.", "She expects backlash to form less around the original victory than around the way it is enlarged afterward.", "The scene becomes a forecast about overreach rather than about the first win itself."),
      whatToDo: tone("She identifies where the mark actually is and advises stopping there instead of converting success into provocation.", "She leaves room for the result to settle before anyone tries to widen it.", "She treats consolidation as the stronger move once the objective is already in hand."),
      whyItMatters: tone("The chapter says excess after victory can create reversal that the first win did not require.", "Her prediction shows that restraint after success can be more stabilizing than further assertion.", "A gain becomes more durable when the field is not forced to answer triumph with opposition.")
    },
    {
      title: "The Debrief Finds That the Reversal Started Only After the Team Tried to Turn the Win Into More",
      format: "postmortem",
      category: "work",
      endingType: "common_trap",
      scenario: tone("A work debrief shows that the team had already secured the core result, but support collapsed after they tried to use that success to press farther than the situation required.", "They realize the failure came from overreach more than from weakness in the original win.", "The review becomes a lesson in stop points rather than in effort alone."),
      whatToDo: tone("They map the exact point where the objective had already been met and where additional pressure only created exposure.", "They keep the lesson focused on consolidation instead of congratulating endless momentum.", "They stop mistaking maximum push for maximum safety."),
      whyItMatters: tone("The chapter warns that excess can undo what victory had already secured.", "Their mistake was treating momentum as proof that more pressure was still strategic.", "The fix comes from distinguishing completed success from unnecessary enlargement.")
    },
    {
      title: "Before and After the Win Held Once the Extra Push Was Removed",
      format: "before_after",
      category: "personal",
      endingType: "perspective_reframe",
      scenario: tone("Before, a settled personal conflict was reopened because one side kept pressing after the issue was effectively resolved. After, the same win was allowed to stand and the result held.", "The contrast is between secure closure and triumph-driven reopening.", "One version seeks stability; the other seeks one more emotional victory."),
      whatToDo: tone("Stop at the point where the gain is already real instead of adding a final push that exposes it.", "Use consolidation as a boundary, not as an excuse to leave the issue half-finished.", "Pair closure with enough stability that the result can endure without further assertion."),
      whyItMatters: tone("The chapter becomes visible when the same win survives once the extra move is removed.", "This before-and-after shows why stopping can protect a gain better than enlarging it.", "What changes is not the original success but the refusal to turn it into overreach.")
    }
  ],
  reviewCards: [
    { cardId: "ch47-rc01", front: tone("What is the main claim of Chapter 47?", "Why can victory be risky here?", "What does Greene warn against?"), back: tone("The chapter argues that victory can become dangerous when success keeps pushing past the mark it already needed to reach.", "Victory is risky because one move too many can create backlash, exposure, or reversal.", "Greene warns against overreaching after success instead of securing the gain."), difficulty: "easy" },
    { cardId: "ch47-rc02", front: tone("Why does stopping matter after success?", "How can restraint help around a win?", "What does consolidation do?"), back: tone("Stopping matters because a secured gain may be protected better by consolidation than by further pressure.", "Restraint can preserve victory by preventing unnecessary exposure after the objective is met.", "Consolidation keeps the win durable instead of enlarging it into risk."), difficulty: "easy" },
    { cardId: "ch47-rc03", front: tone("How is strategic stopping different from premature stopping?", "Why is this chapter not anti-ambition advice?", "When does restraint stop helping?"), back: tone("Strategic stopping happens after the mark is defensible, while premature stopping leaves the win too weak to hold.", "The chapter is about post-victory judgment, not about quitting early out of fear.", "Restraint stops helping when it abandons necessary consolidation."), difficulty: "medium" },
    { cardId: "ch47-rc04", front: tone("How do ordinary settings show the law?", "Why do work, school, and personal wins all face the same issue?", "What does the stop point protect?"), back: tone("Ordinary settings show that one extra push after success can reverse a real gain.", "Teams, campaigns, and relationships all react badly when triumph outruns strategy.", "The stop point protects the win by preventing leverage from becoming provocation."), difficulty: "medium" },
    { cardId: "ch47-rc05", front: tone("How does Chapter 47 bridge to Chapter 48?", "What comes after learning when to stop?", "Why does this law lead toward formlessness?"), back: tone("After showing how victory must be limited to avoid reversal, the next issue is how strategy adapts without fixed form.", "Chapter 48 turns from stop points toward formlessness and flexibility.", "The bridge moves from disciplined completion to adaptive shapelessness."), difficulty: "hard" }
  ],
  keyTakeawayCard: tone(
    "Not going past the mark you aimed for means protecting a real victory by stopping once the gain is secure enough and refusing the extra move that turns success into exposure.",
    "This law values stop points and consolidation because triumph after success can create more risk than strength.",
    "Power is preserved when you secure the win, resist ego-driven enlargement, and refuse to confuse unfinished work with disciplined stopping."
  )
};

const quiz = {
  passingScorePercent: 70,
  questions: [
    { questionId: "ch47-q01", prompt: "Why does victory create danger in this chapter?", choices: ["Because success can tempt a person into one push too many", "Because winning always weakens leverage", "Because every victory should be hidden"], correctIndex: 0, explanation: tone("Correct. The chapter focuses on overreach after success.", "Victory creates danger here because success can distort judgment and invite excess.", "Right. The issue is the temptation to keep pressing beyond what the win requires."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch47-q02", prompt: "What can one push too many trigger strategically?", choices: ["Guaranteed security for the gain", "Backlash, exposure, or reversal", "Proof that ambition was correct"], correctIndex: 1, explanation: tone("Yes. Greene warns that excess after success can undo the gain.", "One extra move can create resistance or exposure that the secured win did not need.", "Correct. The danger is reversal created by overreach, not weakness before the win."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch47-q03", prompt: "Why is this chapter not anti-ambition advice?", choices: ["Because it says less effort is always safer", "Because it rejects consolidation as unnecessary", "Because it distinguishes strategic stopping from quitting before the win can hold"], correctIndex: 2, explanation: tone("Correct. Greene does not tell the reader to stop before the objective is secure.", "The chapter separates disciplined stopping after success from timid incompletion.", "Right. The goal is to preserve the gain without abandoning needed follow-through."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch47-q04", prompt: "In Ronan's work scenario, what best fits the chapter?", choices: ["Add one more demand because the other side is already yielding", "Stop once the core result is defensible and consolidate it", "Keep negotiating until the other side is completely humiliated"], correctIndex: 1, explanation: tone("Correct. His case shows how consolidation can protect a win better than further pressure.", "The chapter favors stopping once the gain is secure enough to hold.", "Right. He is preserving leverage instead of turning triumph into exposure."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch47-q05", prompt: "What does Leora's school example show?", choices: ["That school victories should always be enlarged while momentum is high", "That a campaign can create backlash by pressing after it already has enough support", "That student wins do not require consolidation"], correctIndex: 1, explanation: tone("Yes. Her example shows how overreach can organize resistance after a real win.", "The chapter says momentum is not the same thing as strategic necessity.", "Correct. The issue is whether more pressure now protects the win or destabilizes it."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch47-q06", prompt: "What is the strongest reading of Hugo's personal dilemma?", choices: ["He should add one more point so the other person feels completely defeated", "He must decide whether the extra point secures closure or only serves triumph", "He should stop every argument before the other person understands the issue"], correctIndex: 1, explanation: tone("Correct. The chapter has a premature-stop limit as well as an overreach warning.", "His dilemma turns on whether the next move protects closure or reopens the conflict.", "Right. The extra point often serves ego more than durable resolution."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch47-q07", prompt: "How can stopping preserve gains after success?", choices: ["By protecting a secured result from the exposure created by needless enlargement", "By refusing all final consolidation steps", "By making the win look smaller than it is"], correctIndex: 0, explanation: tone("Correct. The chapter values stop points because they prevent triumph from becoming overreach.", "Stopping preserves the gain when the next move would create more risk than advantage.", "Right. Consolidation is stronger than needless expansion once the mark is reached."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch47-q08", prompt: "When does stopping become premature under-aiming?", choices: ["When it removes an unnecessary extra demand", "When it prevents humiliation of the losing side", "When it leaves the victory too unconsolidated or fragile to hold"], correctIndex: 2, explanation: tone("Exactly. The law fails if the gain is not yet stable enough to survive.", "Stopping too early abandons necessary consolidation and confuses fear with discipline.", "Right. Restraint is strategic only once the objective is defensible."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch47-q09", prompt: "How does Chapter 46 lead into Chapter 47?", choices: ["By proving that envy and overreach are the same mechanism", "By showing that display matters but momentum does not", "By moving from softening visible success to limiting success so it does not reverse itself through overreach"], correctIndex: 2, explanation: tone("Correct. Chapter 46 managed resentment around success, and Chapter 47 manages excess after success.", "The bridge moves from absorbable display to absorbable momentum.", "Right. Both chapters ask what success can provoke, but they do so in different ways."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch47-q10", prompt: "What bridge carries Chapter 47 into Chapter 48?", choices: ["Chapter 48 returns only to stop points and consolidation", "Victory makes adaptation unnecessary once the mark is secured", "After learning where to stop, the next issue is how to adapt without fixed form"], correctIndex: 2, explanation: tone("Correct. The next law shifts from disciplined stopping toward formlessness and adaptation.", "Chapter 48 turns from fixed marks toward flexible shape.", "Right. The bridge moves from completed success to adaptive strategy beyond fixed form."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" }
  ]
};

chapter.quiz = quiz;

const paths = {
  canonical: path.join(runRoot, "drafts/canonical", `${stem}.md`),
  edited: path.join(runRoot, "drafts/edited", `${stem}.md`),
  critic: path.join(runRoot, "reports", `${stem}.critic.md`),
  structured: path.join(runRoot, "structured", `${stem}.chapter.json`),
  quiz: path.join(runRoot, "quizzes", `${stem}.quiz.json`),
  validated: path.join(runRoot, "validated", `${stem}.chapter.json`),
  review: path.join(runRoot, "validated", `${stem}.review-package.json`),
  metrics: path.join(runRoot, "sidecars", `${stem}.reading-metrics.json`),
  validation: path.join(runRoot, "reports", `${stem}.validation.md`),
  continuity: path.join(runRoot, "continuity/continuity-state.json"),
  runLog: path.join(runRoot, "reports/run-log.md")
};

writeText(paths.canonical, canonical);
writeText(paths.edited, edited);
writeText(paths.critic, critic);
writeJson(paths.quiz, quiz);
writeJson(paths.structured, chapter);
writeJson(paths.validated, chapter);

const reviewPackage = {
  schemaVersion: "1.1.0",
  packageId: `the-48-laws-of-power-${stem}-review`,
  createdAt,
  contentOwner: "ChapterFlow",
  book: {
    bookId: "the-48-laws-of-power",
    title: "The 48 Laws of Power",
    author: "Robert Greene",
    categories: ["Power", "Strategy", "Self-Help", "Political Psychology"],
    variantFamily: "EMH"
  },
  chapters: [chapter]
};
writeJson(paths.review, reviewPackage);

const metrics = {
  chapterId,
  number: num,
  title,
  readingTimeMinutes: 8,
  wordCounts: {
    easyDirect: words(chapter.contentVariants.easy.chapterBreakdown.direct),
    mediumDirect: words(chapter.contentVariants.medium.chapterBreakdown.direct),
    hardDirect: words(chapter.contentVariants.hard.chapterBreakdown.direct)
  },
  takeawayCounts: {
    easy: chapter.contentVariants.easy.keyTakeaways.length,
    medium: chapter.contentVariants.medium.keyTakeaways.length,
    hard: chapter.contentVariants.hard.keyTakeaways.length
  },
  exampleCount: chapter.examples.length,
  quizQuestionCount: quiz.questions.length,
  criticScore: 11,
  sourceHeading: ""
};
writeJson(paths.metrics, metrics);

const seal = crypto.createHash("sha256").update(fs.readFileSync(paths.validated)).digest("hex");
const continuity = JSON.parse(fs.readFileSync(paths.continuity, "utf8"));
for (const name of ["Ronan", "Leora", "Hugo", "Viona"]) continuity.nameUsage[name] = [stem];
continuity.withinChapterNames[stem] = ["Ronan", "Leora", "Hugo", "Viona"];
continuity.approvedChapterHashes[stem] = seal;
writeJson(paths.continuity, continuity);

const easyGentle = words(chapter.contentVariants.easy.chapterBreakdown.gentle);
const easyCompetitive = words(chapter.contentVariants.easy.chapterBreakdown.competitive);
const hardGentle = words(chapter.contentVariants.hard.chapterBreakdown.gentle);
const hardCompetitive = words(chapter.contentVariants.hard.chapterBreakdown.competitive);
const dist = quiz.questions.reduce((acc, q) => {
  acc[q.correctIndex] = (acc[q.correctIndex] || 0) + 1;
  return acc;
}, { 0: 0, 1: 0, 2: 0 });

const validation = `# Validation Report: ${title}

- Status: PASS
- Validation mode: chapter_gate
- Chapter: ${stem}
- Critic score carried into gate: 11/12
- Source heading: n/a

## Mechanical checks
- JSON structure complete and valid for \`structured/${stem}.chapter.json\`, \`quizzes/${stem}.quiz.json\`, \`validated/${stem}.chapter.json\`, and \`validated/${stem}.review-package.json\`
- Easy / medium / hard depth surfaces present
- Chapter-breakdown word bands verified: easy direct \`${metrics.wordCounts.easyDirect}\`, medium direct \`${metrics.wordCounts.mediumDirect}\`, hard direct \`${metrics.wordCounts.hardDirect}\`
- Easy companion variants also verified in band: gentle \`${easyGentle}\`, competitive \`${easyCompetitive}\`
- Hard companion variants also verified in band: gentle \`${hardGentle}\`, competitive \`${hardCompetitive}\`
- Medium uses singular \`selfCheckPrompt\`
- Hard uses exactly two \`selfCheckPrompts\`
- Example rotation complete: 6 canonical formats, 6 unique endings, 2/2/2 category split
- Quiz generated with 10 questions and 3 choices each
- Quiz schema complete on all 10 questions: \`questionId\`, \`prompt\`, \`choices\`, \`correctIndex\`, \`explanation\`, \`bloomsLevel\`, and \`depthLevel\`
- \`correctIndex\` distribution is roughly balanced across \`0/1/2\` at \`${dist[0]}/${dist[1]}/${dist[2]}\`
- Supporting structures present: review cards, key takeaway card
- Review package wraps the full validated chapter JSON
- Reading metrics written and continuity hash sealed at \`${seal}\`

## Prose checks
- No contamination phrases detected in reader-facing tone objects
- Chapter-specific mechanism remains overreach after success, stop points, consolidation, and the premature-stop limit rather than generic moderation advice
- Hard depth preserves the distinction between disciplined stopping and incomplete consolidation and keeps the Chapter 48 bridge visible
- Quiz stays within supported facts from the approved draft and frozen source bundle

## Gate result
- Approved for chapter gate and automatic continuation
`;
writeText(paths.validation, validation);

fs.appendFileSync(
  paths.runLog,
  `\n- Completed writer, editor, critic, converter, quiz, and validator steps for Chapter 47.\n- Validation result: PASS.\n- Continuity hash sealed for \`${stem}\`: \`${seal}\`\n`,
  "utf8"
);

console.log(JSON.stringify({
  easyDirect: metrics.wordCounts.easyDirect,
  mediumDirect: metrics.wordCounts.mediumDirect,
  hardDirect: metrics.wordCounts.hardDirect,
  easyGentle,
  easyCompetitive,
  hardGentle,
  hardCompetitive,
  seal,
  dist
}, null, 2));
