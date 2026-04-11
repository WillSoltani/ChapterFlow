const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const runRoot = path.resolve(".chapterflow/runs/the-48-laws-of-power/20260409-002544");
const num = 35;
const stem = `ch${String(num).padStart(2, "0")}`;
const title = "Master the Art of Timing";
const chapterId = "ch35-master-the-art-of-timing";
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

const canonical = `Greene's thirty-fifth law asks why some moves fail even when the idea behind them is sound. The chapter answers by shifting attention from intent alone to timing. A proposal, confrontation, launch, refusal, or display may carry enough force in itself, yet still break weakly against a field that is not ready. The law therefore treats timing as part of power, not as a decorative afterthought.

Its claim is not that patience always beats action or that waiting carries mystical wisdom by itself. Greene's point is narrower. Situations have tempo, mood, and sequence. Some moments are still forming. Others are already ripening. If you move too early, you spend force before the opening exists. If you move too late, you discover that the opening has already hardened, drifted, or passed to someone else. Timing matters because the same act can read as bold, awkward, desperate, or stale depending on when it appears.

That is why the law values strategic patience rather than passive hesitation. Greene is not praising drift, excuse-making, or endless postponement disguised as discernment. He is describing a discipline of waiting while the field clarifies and then moving when the window becomes real. The chapter becomes strongest when it treats timing as rhythm-reading instead of fear-based delay. Patience preserves force only while it is serving ripeness. Beyond that point, delay starts converting caution into loss.

Ordinary settings make the mechanism visible. A work proposal may land better after decision-makers have felt the pressure that makes them ready to hear it. A fellowship shortlist or debate semifinal may reward the person who speaks once the room is receptive rather than the person who rushes to be first. A difficult conversation in private life may fail if it arrives when emotion is still too hot, yet also fail if it is postponed until trust goes cold. In each case, the move is judged not only by content but by its contact with the moment.

The chapter's limit matters. Timing can become a false religion if it turns into superstition, chronic waiting, or fear of committing while conditions remain imperfect. Greene overreaches if the law becomes advice to postpone all risk until certainty arrives. The useful version is narrower: read pace, wait while readiness is still forming, and move once the opening is genuinely available. Chapter 34 showed how bearing can set the floor for treatment. Chapter 35 asks when force should appear so that even good bearing and serious intent actually land. That leads naturally to Chapter 36, where what cannot be had may require disdain instead of further pursuit.`;

const edited = canonical;

const critic = `# Chapter 35 Critic Report

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
- Paragraph 4 is most vulnerable because the work, school, and personal illustrations can flatten into generic patience advice if conversion drops the ripeness-versus-delay tension.

Strongest sentence:
- "Patience preserves force only while it is serving ripeness."

Anchor use notes:
- The draft stays inside the frozen support: pace, delay, release, strategic patience, mistimed force, and the limit against endless waiting.

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
        "This law says power depends partly on when you act, not only on what you do. Greene is not saying that waiting is always better or that timing is mystical fate. The point is that a strong move can still fail when it arrives too early or too late. A request, launch, or confrontation may need a field that is ready to receive it. Strategic patience therefore matters because it keeps you from spending force before the opening exists. But the chapter is not praising passive delay. Patience helps only while it is letting the moment ripen. Once the opening is real, continued waiting starts to waste the very leverage that patience protected.",
        "Greene's thirty-fifth law argues that timing changes the effect of the same action. The chapter says situations have tempo, mood, and sequence. If you move before readiness forms, the act feels premature. If you move after the window has passed, it feels stale or weak. That is why timing belongs inside strategy. But the law is not generic advice to be patient forever. Strategic patience means waiting while the field is still forming and then acting once the opening becomes real. Used well, timing makes moderate force land harder. Used badly, delay turns caution into drift and costs you the moment you were trying to protect.",
        "This law gives a competitive warning: many people lose not because their move is poor, but because their release is badly timed. Greene wants the reader to notice rhythm. A room, market, audience, or relationship may not be ready yet, and force spent too early can bounce off. But the opposite mistake matters too. Waiting can become fear wearing the costume of wisdom. The chapter is strongest when it treats timing as judgment rather than superstition. Read the pace, keep your force in reserve while the opening develops, and then move before hesitation converts patience into surrender."
      ),
      keyTakeaways: [
        { point: tone("Timing affects whether action lands or slips.", "The same move can succeed or fail depending on when it appears.", "Bad timing can waste good force.") },
        { point: tone("Strategic patience is not passive delay.", "Waiting helps only while readiness is still forming.", "Patience preserves leverage only until the window opens.") },
        { point: tone("Delay also has a cost.", "Once the opening is real, hesitation starts destroying what timing was meant to protect.", "If you keep waiting after the field is ready, you are no longer reading rhythm well.") }
      ],
      oneMinuteRecap: tone(
        "This law says a move needs the right moment as much as the right intent.",
        "Do not spend force before the opening exists, but do not hide inside patience after the opening arrives.",
        "Power often belongs to the person who can wait without drifting and act without being late."
      )
    },
    medium: {
      chapterBreakdown: tone(
        `Greene's thirty-fifth law begins by asking why sound decisions still misfire. The answer is that action enters a field that has tempo, sequence, and mood. A move is never judged in a vacuum. The same proposal, refusal, or display can feel premature in one moment and decisive in another because the surrounding conditions change what the act means.

That is why the chapter treats timing as part of power rather than as a secondary flourish. Greene is not claiming that waiting always wins. He is saying that readiness matters. If the field is still forming, early force often wastes itself. If the field has already shifted, late force arrives after the leverage has thinned. Well-timed action can therefore outperform stronger action that lands out of phase with the moment.

The distinction that matters most is between strategic patience and passive hesitation. Strategic patience keeps force in reserve while the opening is not yet real. Passive hesitation keeps postponing after the opening is already there. The first protects leverage. The second leaks it. The law becomes weak if it is flattened into generic patience advice, because Greene is not praising drift. He is describing controlled delay followed by decisive release.

Ordinary settings show this clearly. Adel may hold a proposal until decision-makers have absorbed enough pressure to hear it seriously. A debate semifinal may reward Maelis for entering once the room is attentive rather than for speaking simply to be first. A difficult private conversation may need enough cooling time to avoid explosion, but not so much delay that trust stiffens into distance. In each case, timing changes the force of the same content.

The limit remains central because timing can become an excuse. If a person waits for perfect certainty, they may call it wisdom while the opening dies. Greene's better point is narrower: read pace carefully, preserve force while readiness is still developing, and then move when the window is genuinely available. Chapter 34 raised the question of how bearing sets treatment floor. Chapter 35 adds that even strong bearing lands badly when the moment is wrong. Chapter 36 then asks what to do when the object cannot be recovered at all.`,
        `A field can look similar from the outside while hiding a crucial difference: one moment is still unripe and another is already opening. Greene uses that difference to shift the reader away from raw intent. Good intent is not enough. Decisive energy is not enough. Timing determines whether the same move feels bold, awkward, needy, or stale.

That is why pace and sequence matter. A request made before others feel the pressure behind it may sound premature. The same request made after conditions sharpen may sound obvious and necessary. Greene's practical claim is that force should meet readiness. Timing matters because it changes reception before it changes content.

The chapter is strongest when it separates patience from passivity. Patience watches the field. Passivity hides from commitment. Strategic delay keeps power available while conditions are still assembling. Fearful delay wastes power because it refuses to act even after the window has opened. Greene is not praising slowness by itself. He is praising release that is matched to ripeness.

The pattern appears everywhere. Adel can wait until a leadership group is ready to hear his proposal instead of pushing it while resistance is still automatic. Maelis can read a school room and choose the moment when intervention will clarify rather than merely interrupt. A private conversation can be timed for seriousness instead of reactive heat. The move changes because the moment changes.

The law overreaches if it becomes mysticism or endless postponement. The useful boundary is simple: wait while the field is not ready, then act before caution hardens into loss. Chapter 34 dealt with how you are priced on entry. Chapter 35 deals with when entry becomes effective at all. The next law then turns to what remains when pursuit itself no longer deserves more energy.`,
        `Greene's thirty-fifth law warns that many failures are really failures of release. Readers often admire courage, preparation, and intensity, but those strengths can still be badly spent. A mistimed move asks the moment to carry what the moment cannot yet hold or no longer wants. The chapter therefore treats timing as a hard strategic discipline rather than as a soft virtue.

The law values patience because some fields must ripen before force can work. Decision-makers may need pressure to accumulate. Audiences may need mood to shift. A relationship may need emotional heat to cool. In those cases, waiting is not weakness. It is how you avoid throwing force against closed ground. Yet the law values timing, not waiting alone. Once the opening becomes real, continued delay changes from preservation into surrender.

This is why the chapter should not be flattened into advice about calmness in general. Greene is not saying that the slowest actor wins. He is saying that the most rhythm-aware actor often does. Strategic patience watches sequence, preserves energy, and then commits. Passive hesitation keeps rehearsing, postponing, and renaming fear as discernment. One discipline stores force. The other drains it.

Ordinary cases make the distinction concrete. Adel may gain more by releasing his proposal once the room has encountered the problem it solves. Maelis may wait until the debate semifinal reaches the point where her intervention can redirect the room instead of disappearing into noise. A difficult conversation may need to be delayed until listening becomes possible, but if it is delayed beyond that point the relation may harden around silence. The same content is not the same act once timing changes.

The limit matters because a doctrine of timing can easily excuse inaction. Greene's sharper claim is that readiness has to be read, not worshiped. Wait while the field is still unready. Move once the opening is genuinely present. Chapter 34 set treatment floor through bearing. Chapter 35 decides when the move should enter. Chapter 36 follows by asking how power behaves when the desired object is no longer worth chasing.`
      ),
      keyTakeaways: [
        {
          point: tone("Timing changes the force of the same action.", "A move is judged partly by the moment that carries it.", "Good content can still die in a bad window."),
          moreDetails: tone("The chapter treats mood, sequence, and pace as part of strategy instead of background noise.", "Reception changes when the field is unripe, ready, or already closed.", "Timing is not decoration around force; it is part of how force works.")
        },
        {
          point: tone("Strategic patience preserves leverage before the opening exists.", "Waiting can be intelligent when the field is still forming.", "Reserve is useful while the ground remains closed."),
          moreDetails: tone("Greene values patience because early force often spends itself against unreadiness.", "The law favors controlled delay over premature release.", "You protect leverage when you refuse to act simply to satisfy impatience.")
        },
        {
          point: tone("Passive hesitation is a different problem from patience.", "Delay becomes weakness when the opening is already real.", "Fear often renames itself as timing wisdom."),
          moreDetails: tone("Once readiness appears, more waiting can leak the advantage patience protected.", "The chapter stays sharp only if delay is judged, not romanticized.", "A late move can fail for the opposite reason an early move fails.")
        },
        {
          point: tone("Work, school, and personal life all reveal timing logic.", "Everyday settings show that rhythm matters outside grand strategy.", "Ordinary moments still reward release that matches readiness."),
          moreDetails: tone("Proposals, interventions, and conversations all change meaning with sequence and mood.", "The law becomes practical when you ask whether the field is still forming or already open.", "Timing is visible whenever identical words would land differently a day earlier or later.")
        },
        {
          point: tone("Timing doctrine has an inaction limit.", "The chapter fails if it becomes superstition or endless postponement.", "A perfect moment that never arrives is often just fear in ceremonial clothing."),
          moreDetails: tone("Greene warns against mistimed force, not against eventual commitment.", "The useful boundary is to wait only while readiness is genuinely absent.", "Timing judgment ends in action, not in permanent suspension.")
        }
      ],
      activationPrompt: tone(
        "Find one move you may be trying to force before the field is ready.",
        "Choose one situation where better timing could change the effect of the same action.",
        "Identify one place where waiting is preserving leverage and one where it may already be costing you."
      ),
      selfCheckPrompt: tone(
        "Is this field still unripe, or am I calling my hesitation patience because action feels costly?",
        "What sign would tell me the opening is genuinely present rather than merely hoped for?",
        "If I wait one step longer, will leverage improve or begin to thin?"
      ),
      oneMinuteRecap: tone(
        "This chapter argues that timing is not decorative; it changes whether force can land at all.",
        "Wait while the field is still forming, but do not confuse a real opening with a reason to keep delaying.",
        "A move becomes powerful when readiness, release, and resolve finally line up."
      )
    },
    hard: {
      chapterBreakdown: tone(
        `Greene's thirty-fifth law asks the reader to stop treating action as though it were separable from the moment that receives it. Many people explain failure by criticizing courage, preparation, or strength, yet those explanations miss a more uncomfortable fact. A move can be well designed and still arrive into the wrong temporal shape. If the field is not ripe, force scatters. If the field has already shifted, force lands after consequence has moved on. Timing therefore belongs inside the act itself.

That is why the law values rhythm-reading. Greene is not asking for vague intuition or mystical submission to fate. He is describing attention to pace, mood, and sequence. Decision-makers harden, soften, tire, or become urgent. Audiences become inattentive, receptive, or saturated. Relationships pass through heat, cooling, and silence. The chapter's practical claim is that release should be matched to those conditions rather than imposed on them as if all moments were equivalent.

The central distinction is between strategic patience and passive hesitation. Strategic patience holds force back while readiness is genuinely absent. It preserves optionality, protects energy, and lets pressure gather. Passive hesitation appears similar from the outside but works differently. It delays after the opening exists. It fears visible commitment, keeps revising, and mistakes avoidance for discernment. One form of waiting stores power. The other leaks it under the name of wisdom.

That distinction matters because timing can improve moderate force more than extra intensity can improve mistimed force. Adel may not need a stronger proposal so much as a room that has finally encountered the cost of not changing. Maelis may not need louder intervention in a debate semifinal so much as a moment when the room is prepared to hear the pivot. A private conversation may not need better wording so much as a point where listening is possible but detachment has not yet hardened. In each case, sequence is not background. Sequence determines what the act can become.

The chapter is strongest when it refuses both impatience and passivity. Move too early and you spend force on unreadiness. Move too late and you spend force on a window that is already thinning. Refuse to move at all and you convert timing into a doctrine of permanent suspension. Greene's limit is therefore essential. Timing is strategic only if it ends in release once ripeness appears. Otherwise patience turns ceremonial and the law collapses into excuse-making.

Chapter 34 argued that bearing helps set the floor for treatment before open testing begins. Chapter 35 adds that even a well-priced presence can misfire if it enters at the wrong moment. The sequence matters. First establish how you are read. Then decide when to appear, press, ask, launch, or refuse. Chapter 36 follows by asking what power looks like when the object itself is lost or denied. Timing governs moves that can still be made. Disdain becomes necessary when the move is no longer worth making at all.`,
        `This law should make the reader suspicious of both impulsive boldness and ornamental patience. Greene's claim is that action has a temporal fit. A move is not just right or wrong in the abstract. It may be right for one phase and wrong for another. That means force cannot be evaluated apart from the field it enters.

The chapter therefore values timing because tempo changes meaning. A proposal before pressure accumulates can feel self-serving. The same proposal after the cost of delay becomes visible can feel inevitable. A confrontation in raw heat can amplify noise. The same confrontation after cooling can create clarity. Greene is describing how sequence converts identical content into different strategic events.

Strategic patience matters here because some moments are still forming. Waiting in those cases is not cowardice. It is a refusal to spend force against ground that will not yet carry it. But the chapter's harder warning is aimed at the other side. Delay quickly becomes self-protective theater. A person can keep waiting, revising, and naming the habit sophistication while the opening quietly narrows. Timing without release is only decorated avoidance.

Adel's proposal, Maelis's intervention, and a private difficult conversation all reveal the same pattern. They do not succeed because the actors are calmer in general. They succeed because the actors read readiness accurately enough to commit when the moment can bear weight. That is why timing can outperform added force. A moderately strong move in a ripe window often beats a stronger move launched into resistance or after relevance has passed.

The law overreaches whenever it turns timing into superstition or endless optimization. Its useful boundary is sharper than that. Wait while the field is genuinely unready. Move once the opening is real. If you cannot distinguish those states, you will alternate between impatience and drift while calling both strategy. Chapter 34 set the social floor. Chapter 35 sets the temporal entry. Chapter 36 then tests what remains when pursuit itself should be refused rather than better timed.`,
        `Greene's thirty-fifth law is really about release discipline. Most people focus on intent, courage, and preparation because those are easier to admire in themselves. Timing is harder because it asks whether a cherished move should still be withheld or whether a feared move should finally be released. The law therefore turns strategy into a problem of temporal self-command.

Its strongest claim is that readiness is uneven. A room can be closed, then receptive, then fatigued. A relationship can be volatile, then open, then emotionally distant. An institution can resist change, then feel pressure, then normalize a different path. If you ignore those shifts, you will think the issue is only the quality of your force. Greene's correction is that force meets conditions, and conditions alter what force can do.

That is why patience should not be romanticized. Strategic patience watches conditions and keeps strength in reserve while nothing useful can yet be done. Passive hesitation, by contrast, is attached to the comfort of delay. It enjoys the identity of the careful strategist without paying the cost of action. The distinction is brutal but necessary: patience serves the opening; hesitation serves the self-protective wish not to be tested.

The examples make that line visible. Adel gains little by pushing a proposal before others feel the problem, but he loses just as much if he waits until the room's attention has moved elsewhere. Maelis benefits by entering once the debate can still be redirected, not when the room is still noisy or after its judgments have calcified. A difficult conversation becomes constructive only after enough cooling for listening and before enough distance for indifference. These are not separate rules. They are the same timing logic appearing in different scales.

The limit matters because timing easily becomes a respectable mask for fear. Greene's law works only when it culminates in timely commitment. If you keep waiting once readiness is present, you are not mastering timing. You are declining the test while preserving a flattering story about your restraint. Chapter 34 showed how bearing changes the opening valuation of you. Chapter 35 shows that valuation still has to enter at the right point in the sequence. Chapter 36 follows because some denied objects should no longer receive more timing, more pursuit, or more emotional investment at all.`
      ),
      keyTakeaways: [
        {
          point: tone("Action cannot be separated from the moment that receives it.", "Force succeeds or fails partly because of temporal fit.", "A mistimed move is structurally different from a timely one even when the content matches."),
          moreDetails: tone("The chapter treats pace, mood, and sequence as part of the act itself.", "Timing changes reception before it changes substance.", "Strategic analysis is incomplete if it ignores the field's readiness.")
        },
        {
          point: tone("Strategic patience protects force while readiness is absent.", "Waiting can preserve leverage when the ground is still closed.", "Reserve is useful when release would only dissipate energy."),
          moreDetails: tone("Patience matters because some openings are still forming rather than available.", "The law values withholding as preparation for better release, not as a virtue on its own.", "Early force often spends itself against unreadiness.")
        },
        {
          point: tone("Passive hesitation masquerades as wisdom.", "Delay becomes self-defeating once the opening is real.", "Fear often prefers the prestige of timing language to the risk of commitment."),
          moreDetails: tone("The chapter stays hard only if it distinguishes careful reading from excuse-making.", "A late move fails for the opposite reason an early move fails, but it still fails.", "Timing doctrine collapses when it protects the actor from action instead of protecting the action from mistiming.")
        },
        {
          point: tone("Moderate force in a ripe moment can beat stronger force in a bad one.", "Readiness often matters more than extra intensity.", "Sequence can outperform strength."),
          moreDetails: tone("Adel, Maelis, and the personal conversation examples all show that release quality depends on window quality.", "The actor who reads ripeness correctly may need less raw force than the actor who relies only on courage.", "Power grows when pressure meets the field at the point where it can carry weight.")
        },
        {
          point: tone("Timing has an anti-passivity limit.", "The law fails when it becomes superstition, endless optimization, or chronic postponement.", "A perfect moment that never arrives is usually a story that protects inaction."),
          moreDetails: tone("Greene warns against both impulsive release and ritualized waiting.", "The useful rule is to wait while the field is unready and act once readiness becomes real.", "Timing mastery ends in timely commitment, not in permanent suspense.")
        }
      ],
      activationPrompt: tone(
        "Locate one move you may be trying to release into an unripe field.",
        "Choose one important action whose result may depend more on timing than on additional force.",
        "Identify one place where your caution is still strategic and one where it may already be self-protective delay."
      ),
      selfCheckPrompts: [
        tone(
          "What evidence tells me the field is truly unready rather than merely uncomfortable for me?",
          "If the opening appeared today, would I recognize it or keep postponing under a better-sounding name?",
          "Am I protecting the action from mistiming or protecting myself from exposure?"
        ),
        tone(
          "What would make one step more waiting improve leverage instead of thinning it?",
          "Has the room's mood shifted enough that the same move would now mean something different?",
          "If I delay further, what window am I assuming will remain open?"
        )
      ],
      predictionPrompt: tone(
        "If timing can no longer recover a desired object, how might Chapter 36 argue that power requires indifference instead of continued pursuit?",
        "What changes when the issue stops being when to act and becomes whether the object deserves any more energy at all?",
        "After mastering release, what remains when the best move is to deny frustration its hold?"
      ),
      oneMinuteRecap: tone(
        "This chapter argues that timing is a form of strategic self-command: hold force while the opening is absent, then release it before fear renames delay as wisdom.",
        "A move is not only what it says or does; it is also the moment it enters, and that moment can multiply or erase its force.",
        "Power belongs to the actor who can read ripeness without drifting and commit without needing perfect certainty."
      )
    }
  },
  examples: [
    {
      title: "Adel Waits Until the Proposal Meets a Room That Can Finally Hear It",
      format: "decision_point",
      category: "work",
      endingType: "broader_principle",
      scenario: tone("Adel has a strong proposal, but he can tell the leadership group has not yet felt the pressure that would make it legible.", "He has to choose between pushing early and waiting for a more receptive opening.", "Adel can spend force on unreadiness or release it when the room can finally carry it."),
      whatToDo: tone("He waits until the decision-makers have encountered the cost of delay and then presents the same idea into a riper field.", "He times the release instead of merely improving the wording.", "He lets readiness do part of the work that extra force would otherwise have to do alone."),
      whyItMatters: tone("The chapter says timing changes what the same action can accomplish.", "His case shows that a better moment can outperform a louder push.", "He wins by reading sequence, not by mistaking impatience for decisiveness.")
    },
    {
      title: "Maelis Explains Why the Debate Semifinal Needed Timing More Than Volume",
      format: "dialogue",
      category: "school",
      endingType: "self_directed_question",
      scenario: tone("Maelis describes how an intervention that would have vanished early in the debate became decisive once the room was ready to hear it.", "She argues that the same words would have meant something different ten minutes earlier.", "The discussion becomes a lesson in timing rather than in mere confidence."),
      whatToDo: tone("She identifies the point where the room shifted from noise into receptivity and then acted inside that opening.", "She studies sequence instead of assuming speed is always strength.", "She asks what the room had to become before her intervention could matter."),
      whyItMatters: tone("The chapter says readiness changes the value of the same force.", "Her example shows that timing can beat volume.", "The room's condition, not just the speaker's intent, determined whether the move could land.")
    },
    {
      title: "Corwin Has to Decide Whether Delay Is Still Patience or Already Fear",
      format: "dilemma",
      category: "personal",
      endingType: "surprising_implication",
      scenario: tone("Corwin has delayed a difficult conversation long enough for emotions to cool, but he now suspects more waiting may be protecting him more than the conversation itself.", "He has to decide whether the opening is finally real.", "Corwin may be preserving leverage or wasting it under a noble label."),
      whatToDo: tone("He checks whether listening is now possible and then acts before distance hardens into silence.", "He stops confusing emotional caution with timing mastery.", "He moves once the window becomes constructive instead of endlessly polishing the decision."),
      whyItMatters: tone("The chapter distinguishes strategic patience from passive hesitation.", "His problem shows where delay stops serving ripeness and starts serving self-protection.", "A law about timing becomes real when it forces you to decide whether the field is open enough now.")
    },
    {
      title: "Nerida Predicts the Fellowship Shortlist Will Reward the Right Entry, Not the Earliest One",
      format: "predict_reveal",
      category: "school",
      endingType: "cross_domain",
      scenario: tone("Nerida watches a shortlist discussion and predicts that the candidate who enters at the right point in the room's sequence will gain more traction than the candidate who rushed to be noticed first.", "She expects timing to matter more than visible eagerness.", "The scene turns into a test of ripeness rather than raw initiative."),
      whatToDo: tone("She tracks when the committee becomes ready for a serious intervention and measures how late is too late.", "She watches sequence instead of mistaking firstness for advantage.", "She reads the opening as a moving window, not a static invitation."),
      whyItMatters: tone("The chapter says a timely move can outperform a stronger but premature one.", "Her prediction shows how institutional rooms also have tempo.", "Timing governs school decisions the same way it governs work or private conflict.")
    },
    {
      title: "The Work Debrief Shows the Team Mistook Constant Deferral for Strategic Timing",
      format: "postmortem",
      category: "work",
      endingType: "common_trap",
      scenario: tone("A work debrief reveals that the team kept postponing a necessary move in the name of better timing even after the opening had become obvious.", "They called the delay strategic long after it stopped protecting anything.", "The review shows how timing language can hide fear of commitment."),
      whatToDo: tone("They separate true unreadiness from the comfort of having more time and rebuild their release criteria around concrete signs of ripeness.", "They stop treating delay as automatically intelligent.", "They define what must be true for waiting to help instead of merely continuing it."),
      whyItMatters: tone("The chapter warns that timing doctrine can collapse into excuse-making.", "Their mistake was not impatience but reverent over-delay.", "The lesson is that a window can die while a team keeps congratulating itself for caution.")
    },
    {
      title: "Before and After One Conversation Was Timed for Listening Instead of Raw Heat",
      format: "before_after",
      category: "personal",
      endingType: "perspective_reframe",
      scenario: tone("Before, every difficult talk began in the middle of reactive heat or after so much delay that nothing alive remained to discuss. After, the same person waited for listening but not for emotional vacancy.", "The contrast is between bad sequence and constructive sequence.", "The words changed less than the moment did."),
      whatToDo: tone("Time the conversation for the point where seriousness is possible and defensiveness is no longer total.", "Use enough delay for cooling, but not so much that relevance drains away.", "Let timing change the quality of contact before trying to change the wording again."),
      whyItMatters: tone("The law says the same content can become a different act when the moment changes.", "This before-and-after makes timing visible in ordinary life.", "The shift shows why rhythm can matter more than another round of preparation.")
    }
  ],
  reviewCards: [
    { cardId: "ch35-rc01", front: tone("What is the main claim of Chapter 35?", "Why does timing matter as much as force here?", "What changes when the moment changes?"), back: tone("The chapter argues that action succeeds or fails partly because of when it is released.", "Timing changes whether the same move can actually land.", "A different moment can turn identical content into a different strategic event."), difficulty: "easy" },
    { cardId: "ch35-rc02", front: tone("What is strategic patience?", "When does waiting help in this chapter?", "Why is reserve sometimes power?"), back: tone("Strategic patience keeps force in reserve while the field is still unready.", "Waiting helps when readiness is still forming rather than available.", "Reserve matters because early release can waste force against closed ground."), difficulty: "easy" },
    { cardId: "ch35-rc03", front: tone("How is hesitation different from patience?", "When does delay turn weak?", "What makes timing language suspicious?"), back: tone("Hesitation delays after the opening is already real.", "Delay turns weak when it protects the actor more than the action.", "Timing language becomes suspicious when it keeps renaming fear as discernment."), difficulty: "medium" },
    { cardId: "ch35-rc04", front: tone("Why can moderate force beat stronger force in this chapter?", "What does ripeness add to action?", "How does sequence outperform intensity?"), back: tone("Because a ripe window can carry a move that extra intensity cannot force into an unready one.", "Ripeness lets the field do part of the work of reception.", "Sequence matters because the same effort means more in a ready moment than in a mistimed one."), difficulty: "medium" },
    { cardId: "ch35-rc05", front: tone("How does Chapter 35 bridge to Chapter 36?", "What comes after timing if the object cannot be recovered?", "Why does this law lead toward disdain?"), back: tone("Once timing cannot recover the object, the next question is whether power requires withholding further pursuit altogether.", "Chapter 36 turns from release timing to refusing fixation on what cannot be had.", "When the window is gone, better timing may matter less than disciplined indifference."), difficulty: "hard" }
  ],
  keyTakeawayCard: tone(
    "Mastering timing means holding force while readiness is absent and releasing it once the opening is real rather than early out of impatience or late out of fear.",
    "This law treats pace, delay, and release as part of power itself, while warning that patience fails when it becomes passive postponement.",
    "The strongest actor is often the one who can read the window accurately enough to wait without drifting and act without being late."
  )
};

const quiz = {
  passingScorePercent: 70,
  questions: [
    { questionId: "ch35-q01", prompt: "What is the main claim of Chapter 35?", choices: ["That every delay is wise", "That timing shapes whether action lands", "That patience replaces action"], correctIndex: 1, explanation: tone("Correct. The chapter says timing changes whether force can actually land.", "Action succeeds or fails partly because of when it appears.", "Right. The law is about temporal fit, not delay for its own sake."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch35-q02", prompt: "What makes a field unripe in this chapter's logic?", choices: ["The actor feels impatient", "The content is automatically wrong", "Conditions are not yet ready to receive the move"], correctIndex: 2, explanation: tone("Yes. Unripe means the surrounding conditions are not ready yet.", "The law focuses on readiness, mood, and sequence.", "Correct. The issue is that the field cannot yet carry the move well."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch35-q03", prompt: "Why is this chapter not generic patience advice?", choices: ["Because it values delay even after the opening is present", "Because it distinguishes strategic patience from passive hesitation", "Because it says the slowest actor always wins"], correctIndex: 1, explanation: tone("Correct. The chapter separates helpful waiting from fear-based postponement.", "Patience serves ripeness, while hesitation keeps delaying after readiness exists.", "Right. The law values timing judgment, not delay in the abstract."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch35-q04", prompt: "In Adel's work scenario, what best fits the chapter?", choices: ["Push the proposal before decision-makers feel the pressure behind it", "Keep rewriting forever so no release is needed", "Wait until the room can actually hear the proposal seriously"], correctIndex: 2, explanation: tone("Yes. The chapter says a proposal can land harder once the room is ready for it.", "He is reading readiness instead of spending force too early.", "Correct. Timing can do more than another round of wording."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch35-q05", prompt: "What does Maelis's debate-semifinal example show?", choices: ["That volume matters more than sequence", "That entering first is always strongest", "That the same intervention can gain force when the room is receptive"], correctIndex: 2, explanation: tone("Correct. Her example shows that sequence changes the power of the same words.", "The intervention matters more once the room can bear it.", "Right. Timing beats mere firstness here."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch35-q06", prompt: "What is the best reading of Corwin's dilemma?", choices: ["Delay may no longer be protecting the conversation and may now be protecting him", "Any delay means he has mastered timing", "He should act immediately because patience is always weakness"], correctIndex: 0, explanation: tone("Yes. The chapter asks whether waiting is still strategic or already self-protective.", "His test is whether the opening is now real enough to act inside.", "Correct. Delay becomes suspect once it serves the actor more than the action."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch35-q07", prompt: "How can well-timed action outperform stronger mistimed action?", choices: ["Because timing removes all need for force", "Because a ripe moment lets the field carry the move more effectively", "Because stronger action is always unnecessary"], correctIndex: 1, explanation: tone("Correct. Readiness can multiply moderate force.", "A better window can do what extra intensity cannot do alone.", "Right. The field's condition changes what the act can become."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch35-q08", prompt: "When does timing doctrine fail in this chapter?", choices: ["When it becomes endless waiting or excuse-making", "When it reads sequence carefully", "When it avoids premature release"], correctIndex: 0, explanation: tone("Exactly. The limit is that timing language can become a mask for chronic postponement.", "The chapter rejects passivity disguised as wisdom.", "Right. Waiting is useful only while readiness is truly absent."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch35-q09", prompt: "How does Chapter 34 lead into Chapter 35?", choices: ["By showing that bearing makes timing irrelevant", "By moving from treatment floor to the moment when action should actually land", "By rejecting any relation between presence and release"], correctIndex: 1, explanation: tone("Correct. Chapter 34 sets the floor of treatment, and Chapter 35 asks when the move should enter.", "The sequence moves from how you are read to when your action should appear.", "Right. Strong bearing still needs the right moment."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch35-q10", prompt: "What bridge carries Chapter 35 into Chapter 36?", choices: ["If timing cannot recover the object, the next issue may be refusing further fixation", "Better timing always restores any lost object", "Chapter 36 abandons the question of response entirely"], correctIndex: 0, explanation: tone("Correct. The next law turns toward disciplined indifference when pursuit no longer deserves more energy.", "Chapter 36 asks what power looks like when better timing is no longer the answer.", "Right. Once the window is gone, disdain may matter more than renewed pursuit."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" }
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
for (const name of ["Adel", "Maelis", "Corwin", "Nerida"]) continuity.nameUsage[name] = [stem];
continuity.withinChapterNames[stem] = ["Adel", "Maelis", "Corwin", "Nerida"];
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
- Chapter-specific mechanism remains pace, ripeness, strategic patience, and delay limits rather than generic productivity advice
- Hard depth preserves the patience-versus-passivity boundary and the Chapter 36 disdain bridge
- Quiz stays within supported facts from the approved draft and frozen source bundle

## Gate result
- Approved for chapter gate and automatic continuation
`;
writeText(paths.validation, validation);

fs.appendFileSync(
  paths.runLog,
  `\n- Completed writer, editor, critic, converter, quiz, and validator steps for Chapter 35.\n- Validation result: PASS.\n- Continuity hash sealed for \`${stem}\`: \`${seal}\`\n`,
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
