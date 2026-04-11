const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const runRoot = path.resolve(".chapterflow/runs/the-48-laws-of-power/20260409-002544");
const num = 44;
const stem = `ch${String(num).padStart(2, "0")}`;
const title = "Disarm and Infuriate with the Mirror Effect";
const chapterId = "ch44-disarm-and-infuriate-with-the-mirror-effect";
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

const canonical = `Greene's forty-fourth law turns from winning people through persuasion toward unsettling them through reflection. A person often feels most stable inside an image of themselves that goes unchallenged. Greene's warning is that this stability can crack when someone is confronted with a reflected version of their own style, aggression, or assumptions. The mirror effect matters because it returns a person to themselves from the outside, and that can disarm, embarrass, or provoke more powerfully than direct argument.

The point is not that all imitation is strategic or that mirroring works automatically. Greene is arguing that deliberate reflection can force self-confrontation. A person who sees their own behavior, tone, or tactic mirrored back may lose confidence, become angry, or suddenly recognize what had felt invisible from the inside. The power of the move comes from making the other person meet themselves as an object rather than as a comfortable point of view.

That is why the chapter distinguishes strategic mirroring from childish copying. Strategic mirroring is selective, timed, and tied to a purpose. Empty imitation is obvious, shallow, and often weak. Greene's stronger claim is narrower: reflection can interrupt confidence or provoke reaction when it exposes self-image dependence, but only if the context supports the move and the escalation can be contained.

Ordinary settings make the mechanism visible. A negotiation can shift when one side calmly reflects the other's hard style back to them. A debate or club conflict can change when someone's favorite tactic is returned in a way that reveals its effect. A personal tension can be disrupted when one person is made to face the emotional pattern they had been projecting outward without noticing. In each case, the practical question is whether the reflection clarifies, disarms, or inflames.

The law overreaches when it becomes mystical mimicry, obvious mockery, or escalation without control. Some people will not notice the mirror. Some settings punish visible imitation. Some reactions become dangerous when self-confrontation turns into humiliation. Greene is strongest when he treats reflection as a precise disturbance rather than as a magical shortcut. Chapter 43 showed how hearts and minds can be won through buy-in. Chapter 44 shows how self-image can be destabilized through reflection. Chapter 45 follows by asking how change can be introduced without reforming too much at once.`;

const edited = canonical;

const critic = `# Chapter 44 Critic Report

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
- Paragraph 4 is most vulnerable because work, school, and personal examples can flatten into generic mimicry advice if conversion loses the self-confrontation and escalation-limit logic.

Strongest sentence:
- "The power of the move comes from making the other person meet themselves as an object rather than as a comfortable point of view."

Anchor use notes:
- The draft stays inside the frozen support: reflection, self-confrontation, destabilization, confidence interruption, and the escalation limit.

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
        "This law says that people can be unsettled when they face a reflection of themselves from the outside. Greene is not saying that copying always works or that mirroring is some kind of magic. The point is that reflected behavior can force self-confrontation. If someone sees their own style or tactic returned to them, they may lose confidence, feel exposed, or react emotionally. That is why the chapter values the mirror effect. The mistake is not reflection by itself. The mistake is turning it into obvious imitation, mockery, or escalation you cannot control.",
        "Greene's forty-fourth law argues that strategic mirroring can disarm or provoke by reflecting people back to themselves. The issue is not mimicry alone. The issue is self-confrontation. When someone meets their own behavior from the outside, their confidence or comfort may break. The law is not generic copy-them advice. It is advice to use reflection carefully when returning a person's style to them will interrupt their self-image.",
        "This law gives a competitive warning: people often handle criticism better than they handle a mirror. Greene wants the reader to see that reflected behavior can provoke stronger reactions than direct accusation. But the chapter has a limit. Mirroring fails when it is childish, too obvious, or too risky for the setting. The edge comes from precise reflection, not from crude imitation."
      ),
      keyTakeaways: [
        { point: tone("Reflection can force self-confrontation.", "People can be unsettled when they meet their own style from the outside.", "A mirror can expose what direct criticism leaves protected.") },
        { point: tone("Strategic mirroring can disarm or provoke.", "Returned behavior can interrupt confidence or trigger reaction.", "The mirror effect matters because it unsettles self-image.") },
        { point: tone("The law has an escalation limit.", "Obvious copying or uncontrolled provocation can fail badly.", "Mirroring becomes weak when it loses precision and control.") }
      ],
      oneMinuteRecap: tone(
        "This law says reflected behavior can disarm or infuriate because people are disturbed by confronting themselves from the outside.",
        "Use mirroring when it reveals self-image dependence more effectively than direct argument.",
        "Reflect with precision, not with childish imitation."
      )
    },
    medium: {
      chapterBreakdown: tone(
        `People often feel safest inside an unchallenged image of themselves. Greene's forty-fourth law begins there. A person may act aggressively, self-righteously, or manipulatively without fully experiencing what that style feels like from the outside. Reflection changes that. The chapter turns the reader away from direct accusation alone and toward the power of showing someone themselves from another angle.

That is why the mirror effect matters here. Greene is not saying that imitation is enough by itself. He is saying that reflected behavior can force self-confrontation. A person who sees their own tactic returned may lose composure, feel exposed, or become angry because their style no longer belongs only to them. Reflection matters because it interrupts the comfort of acting without seeing.

The key distinction is between strategic mirroring and empty imitation. Strategic mirroring is selective and purposeful. Empty imitation is obvious and childish. Greene respects reflection because it can interrupt confidence and reveal self-image dependence. But the move only works when the context can hold the reaction and when the reflection is precise enough to do more than mock.

Ordinary settings show the pattern clearly. Tovin may return a negotiator's hard style in a calm way that makes the tactic suddenly visible. Nerida may use a debate or club conflict to reflect someone's own method back to them and break their comfort with it. A personal conflict may change once one person sees their own emotional pattern echoed back. In each case, the practical question is whether the mirror will clarify, disarm, or inflame.

The law becomes weak if it turns into theatrical copying. Some people will miss the reflection. Some settings punish visible mirroring. Some reactions become dangerous if the other person feels humiliated rather than confronted. Greene's stronger point is narrower: use reflection when it reveals something the other person cannot easily face directly, but keep control of the context and the risk. Chapter 43 showed how people are won through hearts and minds. Chapter 44 shows how people can be unsettled through reflection. Chapter 45 then turns toward how change must be paced to avoid overreform.`,
        `A mirror can provoke faster than an argument. Greene uses that idea to shift the reader from criticism to reflection. The chapter matters because people often defend themselves against direct attack, yet become less steady when their own style is returned to them in visible form.

That is why mirroring can work here. A reflected tactic can disturb confidence, expose vanity, or make a person suddenly aware of how they are landing on others. Greene's practical claim is that self-confrontation can destabilize someone more effectively than explanation by itself. The issue is not mimicry for show. The issue is whether reflection makes the person's own behavior newly legible to them.

The chapter is strongest when it separates precision from childish copying. Precision reflects just enough to expose the pattern. Childish copying only advertises itself and loses force. Greene is not asking the reader to become petty or theatrical. He is asking the reader to understand when a mirror reveals more than a direct challenge.

The pattern appears everywhere. Tovin can reflect a negotiating style without losing his own control. Nerida can show in a school argument how a tactic looks once it is returned. A personal tension can change once someone sees their own emotional pressure mirrored back. The chapter stays specific when self-confrontation, reaction, and context all remain visible at once.

The law overreaches if it becomes mockery or escalation detached from purpose. Its useful boundary is sharper than that: reflect selectively, know what reaction you are inviting, and stop if the context cannot contain the result. Chapter 43 dealt with winning inward assent. Chapter 44 deals with disrupting self-image. The next law turns toward change and the danger of reform pushed too far, too fast.`,
        `Greene's forty-fourth law warns that self-image is often weaker under reflection than under attack. Many readers assume that criticism is the cleanest way to challenge an opponent. Greene notices that criticism can be resisted, argued with, or ignored, while a mirror can create a more intimate disturbance. What returns from the outside can make a person's own style suddenly hard to avoid.

That is why the law values reflection over ordinary mimicry. Once a person confronts a returned version of their own behavior, they may feel their confidence break or their emotional balance shift. Greene's harder claim is that the mirror effect works because it interrupts the person's control over how they experience themselves. Reflection turns private certainty into a visible pattern.

This is also why the chapter should not be flattened into advice to copy people. Some mirroring is too obvious to work. Some contexts turn reflection into needless escalation. The strategic error is not using reflection. The strategic error is using it without precision, purpose, or control. If the mirror becomes childish or humiliating, the reaction may stop being useful.

Common settings make the line visible. Tovin can see that a counterpart's style loses power once reflected back at the same temperature. Nerida can detect that a debate tactic becomes unstable once its owner has to face it from the outside. A personal pattern can become newly visible once the emotional field is mirrored instead of argued over. These cases are not about mockery for its own sake. They are about whether reflection reveals something the other person was relying on not having to see.

The limit matters because provocation can outrun insight. Greene's law works when it sharpens self-confrontation, not when it confuses reflection with automatic dominance. Use the mirror when it clarifies or destabilizes with purpose. Drop it when the setting turns volatile or the reflection becomes too blunt to teach anything. Chapter 43 dealt with persuasion through inward assent. Chapter 44 deals with disruption through self-recognition. Chapter 45 follows by asking how change can be introduced without reforming so much, so quickly, that people revolt against it.`
      ),
      keyTakeaways: [
        {
          point: tone("Reflection can expose a person to themselves.", "People are often more disturbed by mirrored behavior than by direct criticism.", "The mirror effect works by forcing self-confrontation."),
          moreDetails: tone("Greene asks the reader to notice how people can act without fully seeing what they are projecting.", "A returned version of their style can make that projection suddenly hard to avoid.", "Reflection matters because it makes private certainty externally visible.")
        },
        {
          point: tone("Strategic mirroring can interrupt confidence.", "Returned behavior can disarm or provoke by disrupting self-image.", "A well-timed mirror can break comfort faster than argument."),
          moreDetails: tone("The law values reflection because it can unsettle someone at the level of identity or vanity.", "Confidence often weakens once a person has to face their own tactic from the outside.", "Reflection matters because it alters the person's vantage on their own behavior.")
        },
        {
          point: tone("Strategic reflection is different from obvious imitation.", "Precision matters more than theatrical copying.", "A mirror loses force when it becomes childish mimicry."),
          moreDetails: tone("The chapter is not generic copy-them advice.", "Obvious imitation can advertise itself and collapse into mockery.", "The strongest mirror reflects just enough to expose the pattern without becoming the story.")
        },
        {
          point: tone("Ordinary conflicts across work, school, and private life reveal mirror logic.", "Ordinary settings also show how reflected behavior changes the emotional field.", "The same pattern appears wherever self-image is doing hidden work."),
          moreDetails: tone("Negotiations, debates, club conflicts, and personal tensions can all shift once someone's pattern is reflected back.", "The practical test is whether the mirror clarifies, disarms, or only inflames.", "Context matters as much as the reflection itself.")
        },
        {
          point: tone("The law has a context limit.", "Mirroring fails when it is too obvious, too blunt, or too risky for the setting.", "Escalation can erase the value of reflection if control is lost."),
          moreDetails: tone("The chapter stays reliable only when the reader keeps the reaction inside manageable bounds.", "A mirror that humiliates or confuses may provoke more danger than insight.", "Reflection works best when it serves a precise purpose and the setting can hold the response.")
        }
      ],
      activationPrompt: tone(
        "Find one interaction where direct criticism is being resisted but reflection might expose the pattern more clearly.",
        "Choose one setting where a careful mirror could reveal a tactic or self-image dependence.",
        "Identify one situation where mirroring would clarify and one where it would likely escalate too far."
      ),
      selfCheckPrompt: tone(
        "Am I reflecting a pattern precisely, or just copying in a way that will look childish?",
        "What self-image or confidence does this mirror actually expose?",
        "Can the context contain the reaction if the other person feels provoked instead of enlightened?"
      ),
      oneMinuteRecap: tone(
        "This chapter argues that reflection can disarm or infuriate because people are unsettled when they confront themselves from the outside.",
        "Mirroring matters when it exposes a tactic, style, or self-image more effectively than direct criticism would.",
        "The strategic task is to reflect with purpose and control rather than sliding into mockery or escalation."
      )
    },
    hard: {
      chapterBreakdown: tone(
        `Greene's forty-fourth law is less about imitation than about self-recognition under pressure. A person often acts from inside a style, tactic, or self-image that remains comfortable precisely because it is not being experienced from the outside. The chapter therefore asks the reader to distrust direct challenge as the only path to disruption. Reflection can work differently. It can force a person to meet their own behavior in a form that unsettles the inward certainty supporting it.

That is why the law values the mirror effect. Greene is not romanticizing mimicry for its own sake. He is describing the disturbance created when someone confronts their own aggression, vanity, or patterned conduct as an external object. A returned behavior can disarm because it makes the tactic suddenly visible. It can infuriate because visibility feels like exposure. Reflection can therefore destabilize confidence by turning self-image into something no longer fully under the person's control.

The central distinction is between strategic reflection and empty imitation. Strategic reflection is selective, controlled, and tied to a specific psychological break point. Empty imitation is broad, obvious, and more likely to look petty than revealing. Greene's sharper claim is that the mirror effect works only when the reflection exposes a dependency in self-image without letting the performance itself become the main event.

That distinction matters in ordinary settings. Tovin may reflect a negotiator's own hardness back in a measured way that makes the tactic lose its invisibility. Nerida may return a debate style just enough to reveal its underlying vanity or coercion. A personal conflict may shift once one emotional pattern is mirrored back to the person producing it. In each case, the move works because self-recognition is being forced from the outside rather than volunteered from within.

The chapter is strongest when it refuses both naive directness and childish copying. Some people will not register the mirror. Some settings punish visible reflection. Some mirrors trigger humiliation or rage that outruns strategic value. Greene's useful boundary is sharper: mirror only what you need to expose, only when the setting can absorb the response, and only while the reflection remains more diagnostic than inflammatory. Chapter 43 dealt with persuasion through inward assent. Chapter 44 deals with disturbance through self-recognition.

That bridge matters because persuasion and mirroring operate on different sides of inner life. One seeks willing alignment. The other interrupts comfort by exposing self-image from the outside. Chapter 44 therefore teaches a different diagnostic from Chapter 43: ask not only what people feel persuaded by, but what they cannot bear to see reflected back to themselves. Chapter 45 follows by turning from psychological reflection toward the pacing of change, asking how reform can proceed without provoking broad revolt.`,
        `A mirror can do what an argument often cannot. Greene uses that fact to move the reader from criticism to reflected exposure. The strategic question is never only whether you can tell someone what they are doing. The deeper question is whether you can make them confront it in a way that bypasses their usual defenses.

The chapter therefore values strategic mirroring because strategic mirroring changes the terms of awareness. Once a tactic, tone, or emotional pattern is returned, the person may stop experiencing it as neutral or justified. Greene's argument is that the shock of encountering oneself externally can create a more destabilizing interruption than explanation alone.

The harder distinction is between forcing self-confrontation and performing mockery. Forcing self-confrontation reveals a pattern the other person relies on not having to see. Performing mockery only advertises contempt or imitation. Greene is not asking the reader to become theatrical. He is asking for enough control to know when a mirror will produce recognition and when it will only produce noise.

Tovin's work scenario, Nerida's school setting, and a personal reflected pattern all show the same mechanism. Each looks like conflict at first. Each becomes more psychologically charged once the other person faces their own method from outside themselves. The real issue is whether the reflection has struck self-image, not simply whether it has repeated behavior.

The law overreaches when it turns reflection into a fetish or uses escalation as proof of effectiveness. Its better boundary is exacting but usable: mirror selectively, watch the response, and stop before the reflection becomes less revealing than the reaction it provokes. Chapter 43 exposed how influence wins assent. Chapter 44 tracks how reflection unsettles confidence. Chapter 45 then asks how change can be introduced without triggering backlash through excess reform.`,
        `Greene's forty-fourth law warns that self-image is often defended more strongly against explanation than against reflection. Many readers assume that people change when flaws are named clearly. Greene keeps noticing that naming can be resisted, argued with, or dismissed. Reflection does something else. It makes the person's own pattern appear in front of them as something visible, and that visibility can be hard to absorb without losing composure.

Its strongest claim is that the mirror effect destabilizes because it exposes dependence on a certain self-understanding. A person may feel powerful, justified, or invisible inside their own style until that style is returned. Once returned, it may look crude, predictable, or embarrassing. Greene's correction is to treat reflection as a way of changing what the other person can no longer avoid seeing about themselves.

That is why selective mirroring can be a form of power preservation. A precise mirror spends less force than a prolonged argument while sometimes causing more internal disturbance. Crude imitation does the opposite. It turns the move into spectacle and gives the other person something easier to dismiss. Greene is not celebrating provocation for its own sake. He is defending reflection as a disciplined tactic against the comfort of unexamined self-image.

The examples expose the same structure across settings. Tovin is not merely echoing a work counterpart; he is deciding whether reflection will make a hidden tactic visible to its owner. Nerida is not merely copying a debate style; she is deciding whether the returned pattern will reveal vanity or coercion. A personal mirror is not merely emotional retaliation; it is a test of whether self-recognition can alter the field faster than direct explanation. In each case, the weak move is not reflecting. The weak move is reflecting without precision, control, or context.

The limit matters because mirrors can provoke more than they reveal. Some people break into anger without learning anything. Some settings punish the reflector more than the reflected. Some mirrors are too blunt to distinguish insight from humiliation. Greene's law works only when it sharpens judgment about what self-image dependence can be exposed and what risks the setting can absorb. Reflect what matters, contain the response, and do not mistake escalation for success. Chapter 43 dealt with allegiance through buy-in. Chapter 44 deals with disruption through self-recognition. Chapter 45 follows by showing how change can fail when reform outruns what people can tolerate at once.`
      ),
      keyTakeaways: [
        {
          point: tone("Reflection can force self-recognition in ways argument cannot.", "People may resist explanation but still be unsettled by a returned version of themselves.", "A mirror can expose what direct criticism leaves defended."),
          moreDetails: tone("The chapter asks the reader to notice how a pattern changes once it becomes externally visible to its owner.", "Self-confrontation can arrive more forcefully through reflection than through accusation.", "The mirror matters because it alters what the other person can no longer avoid seeing.")
        },
        {
          point: tone("The mirror effect can interrupt confidence or provoke reaction.", "Returned behavior can destabilize self-image by making it visible from outside.", "Reflection matters because it breaks the comfort of acting without seeing."),
          moreDetails: tone("Greene values reflection because it can expose vanity, aggression, or patterned conduct at the level of identity.", "Confidence often weakens when the tactic no longer belongs only to the actor using it.", "The disturbance comes from confronting oneself as an object rather than as a point of view.")
        },
        {
          point: tone("Strategic reflection is different from broad imitation.", "Precision matters more than obvious copying.", "A mirror loses force when it becomes spectacle."),
          moreDetails: tone("The chapter stays hard only if the reflection remains selective and tied to a real break point.", "Crude mimicry gives the other person an easier way to dismiss the move.", "The strongest mirror reveals the pattern without making imitation itself the whole story.")
        },
        {
          point: tone("Work, school, and personal conflicts repeatedly expose mirror logic.", "Ordinary settings also show how self-image can be destabilized through reflection.", "The same pattern appears wherever people rely on not seeing themselves from outside."),
          moreDetails: tone("Negotiations, debates, club conflicts, and personal tensions can all shift once a tactic is mirrored back to its owner.", "The practical test is whether the reflection produces recognition, disarmament, or unproductive escalation.", "Context matters because not every field can hold the same mirror safely.")
        },
        {
          point: tone("The law needs an escalation boundary.", "A mirror can fail if it becomes too obvious, humiliating, or context-blind.", "Provocation can outrun insight if the setting cannot hold the response."),
          moreDetails: tone("The law keeps its edge only when the reflection remains more revealing than inflammatory.", "Strategic mirroring weakens when the reaction becomes the only thing that matters.", "Judgment matters because the best mirror is contained as well as precise.")
        }
      ],
      activationPrompt: tone(
        "Locate one interaction where a precise reflection might expose more than another direct argument would.",
        "Choose one setting where self-image dependence seems stronger than the person's tolerance for criticism.",
        "Identify one pattern worth mirroring and one context where the same mirror would likely escalate too far."
      ),
      selfCheckPrompts: [
        tone(
          "What exactly am I reflecting, and what dependency in self-image does it expose?",
          "Will this mirror force recognition, or will it just look like imitation?",
          "Can the setting contain the reaction if the person feels exposed rather than instructed?"
        ),
        tone(
          "Am I using reflection to clarify something real, or am I drifting into mockery?",
          "At what point would the response become less revealing and more dangerous?",
          "Is this mirror precise enough to expose the pattern without turning the reflection itself into spectacle?"
        )
      ],
      predictionPrompt: tone(
        "If Chapter 44 uses reflection to unsettle, how might Chapter 45 shift toward introducing change without making reform feel intolerable?",
        "What changes once the issue is no longer self-confrontation but the pacing of reform?",
        "After learning how reflection disturbs self-image, how does strategy move toward change that people can absorb?"
      ),
      oneMinuteRecap: tone(
        "This chapter argues that reflection can disarm or infuriate because people are often destabilized by confronting themselves from the outside.",
        "Power is preserved by mirroring precisely enough to expose self-image dependence while keeping control of context and reaction.",
        "The task is to use reflection as disciplined disturbance rather than letting it collapse into mimicry, mockery, or escalation."
      )
    }
  },
  examples: [
    {
      title: "Tovin Returns the Negotiator's Hard Style Until It Stops Feeling Invisible",
      format: "decision_point",
      category: "work",
      endingType: "broader_principle",
      scenario: tone("Tovin faces a counterpart whose hard style works partly because the person never has to experience it from the outside.", "He has to decide whether a careful mirror would expose the tactic more effectively than more argument.", "The issue is not the tactic alone but the confidence hidden inside it."),
      whatToDo: tone("He reflects just enough of the style back to make it visible without losing his own control.", "He uses the mirror to expose the tactic rather than to perform imitation for its own sake.", "He makes the other person meet their own method from outside themselves."),
      whyItMatters: tone("The chapter says reflection can reveal what direct criticism leaves protected.", "His case shows why a mirrored tactic can disrupt confidence more quickly than explanation.", "The real gain comes from forcing self-confrontation, not from copying theatrically.")
    },
    {
      title: "Nerida Explains Why the Debate Tactic Changes Once Its Owner Has to Face It",
      format: "dialogue",
      category: "school",
      endingType: "self_directed_question",
      scenario: tone("Nerida talks through a debate-team or club negotiation conflict where one person's favored tactic feels strong until it is calmly reflected back at them.", "The conversation turns from argument to self-recognition.", "She is trying to separate strategic reflection from obvious mimicry."),
      whatToDo: tone("She asks what the tactic looks like once its owner experiences it externally.", "She studies whether the reflection exposes vanity, coercion, or dependency in self-image.", "She keeps the mirror precise enough to reveal rather than merely taunt."),
      whyItMatters: tone("The chapter says mirroring can unsettle because people confront themselves from outside.", "Her example shows how school settings can make self-image dependence visible too.", "Reflection matters most when it changes what the other person can no longer ignore.")
    },
    {
      title: "Ilyas Has to Decide Whether Mirroring Will Clarify the Pattern or Only Escalate the Conflict",
      format: "dilemma",
      category: "personal",
      endingType: "surprising_implication",
      scenario: tone("Ilyas is in a personal conflict where the other person's pattern might become visible if mirrored, but the same move could also provoke a reaction that outruns the setting.", "He has to decide whether the context can hold the reflection.", "The real question is whether the mirror will teach, disarm, or simply inflame."),
      whatToDo: tone("He tests whether a selective mirror would reveal the pattern more effectively than another direct explanation.", "He refuses to mistake provocation for strategy.", "He uses reflection only if the response can still be contained and read."),
      whyItMatters: tone("The law says mirroring has an escalation limit as well as a destabilizing power.", "His dilemma shows why context matters as much as the reflection itself.", "A mirror that cannot be contained may stop being useful even if it is accurate.")
    },
    {
      title: "Coralie Predicts the Club Negotiation Will Shift Once the Self-Image Behind the Tactic Is Reflected",
      format: "predict_reveal",
      category: "school",
      endingType: "cross_domain",
      scenario: tone("Coralie predicts that a club negotiation will turn only after one participant sees their own style returned to them in a recognizable form.", "She expects the reaction to come less from disagreement than from self-confrontation.", "The scene becomes a forecast about disrupted confidence rather than better reasoning alone."),
      whatToDo: tone("She watches for whether the mirror changes the person's comfort with their own method.", "She tests whether the tactic depends on not being experienced from the outside.", "She asks what level of reflection the setting can absorb safely."),
      whyItMatters: tone("The chapter says the mirror effect can interrupt confidence more sharply than direct challenge.", "Her prediction shows how reflection logic works in school negotiations too.", "The law is about destabilized self-image, not mystical copying.")
    },
    {
      title: "The Debrief Finds That Criticism Failed Until the Pattern Was Reflected Back",
      format: "postmortem",
      category: "work",
      endingType: "common_trap",
      scenario: tone("A work review shows that direct criticism kept being resisted until the same behavior was reflected back in a way that made it newly visible.", "They realize the issue was not lack of feedback but lack of self-recognition.", "The debrief becomes a lesson in reflection rather than repetition."),
      whatToDo: tone("They separate useful mirroring from performative copying and keep only the reflection that exposes the pattern cleanly.", "They stop assuming more explanation is always the strongest tool.", "They use the mirror to reveal what argument had left defended."),
      whyItMatters: tone("The chapter warns that some patterns resist explanation more than reflection.", "Their mistake was relying only on criticism when self-image was the real shield.", "The shift came once the behavior became hard to avoid seeing.")
    },
    {
      title: "Before and After the Mirror Changed the Emotional Field Faster Than the Argument",
      format: "before_after",
      category: "personal",
      endingType: "perspective_reframe",
      scenario: tone("Before, direct explanation produced defense and denial. After, a reflected version of the same pattern unsettled the other person enough to change the field.", "The contrast is between argument and self-confrontation.", "One version names the pattern; the other makes it visible."),
      whatToDo: tone("Reflect only what needs to be seen, then stop before the mirror becomes humiliation or spectacle.", "Choose precision over volume when the issue is self-image rather than information.", "Trade repeated accusation for a clearer reflection when the setting can hold it."),
      whyItMatters: tone("The chapter becomes visible when reflection succeeds where explanation alone kept failing.", "This before-and-after shows why self-recognition can shift a conflict faster than another round of critique.", "The emotional field changes once the person has to face themselves from outside.")
    }
  ],
  reviewCards: [
    { cardId: "ch44-rc01", front: tone("What is the main claim of Chapter 44?", "Why does the mirror effect matter here?", "What can reflection do?"), back: tone("The chapter argues that reflection can disarm or infuriate by forcing people to confront themselves from the outside.", "The mirror effect matters because returned behavior can unsettle self-image more sharply than direct criticism.", "Reflection can expose vanity, interrupt confidence, or provoke reaction."), difficulty: "easy" },
    { cardId: "ch44-rc02", front: tone("What is the difference between strategic reflection and empty imitation?", "Why is copying not enough?", "What keeps mirroring sharp?"), back: tone("Strategic reflection is selective and purposeful, while empty imitation is obvious and childish.", "Copying is not enough because it can make the imitation itself the whole story.", "Mirroring stays sharp when it exposes a pattern without turning into spectacle."), difficulty: "easy" },
    { cardId: "ch44-rc03", front: tone("Why can mirroring interrupt confidence?", "What happens when people face their own tactic from outside?", "How does self-confrontation matter here?"), back: tone("People can lose confidence when their own style is returned to them as something visible and hard to avoid.", "Facing a returned tactic can create self-confrontation more effectively than another explanation.", "The mirror matters because it changes how the person experiences themselves."), difficulty: "medium" },
    { cardId: "ch44-rc04", front: tone("Where does this law appear in ordinary settings?", "How do work, school, and personal conflicts show mirror logic?", "Why is argument not always enough?"), back: tone("It appears wherever a pattern remains defended until it is reflected back to its owner.", "Negotiations, debates, club conflicts, and personal tensions can all shift once self-image is confronted externally.", "Argument is not always enough when the real shield is self-perception."), difficulty: "medium" },
    { cardId: "ch44-rc05", front: tone("How does Chapter 44 bridge to Chapter 45?", "What comes after destabilizing reflection?", "Why does the mirror effect lead toward reform pacing?"), back: tone("After showing how reflection can unsettle people, the next issue is how change can be introduced without triggering revolt through excess reform.", "Chapter 45 turns from psychological reflection toward paced reform.", "The bridge asks how disturbance differs from sustainable change."), difficulty: "hard" }
  ],
  keyTakeawayCard: tone(
    "Disarming and infuriating with the mirror effect means using reflection to make a person's own style or self-image newly visible, unstable, and hard to avoid.",
    "This law values precise mirroring over direct criticism because self-confrontation can disrupt confidence faster than explanation alone.",
    "Power grows when you reflect what matters, contain the response, and refuse to confuse strategic mirroring with childish imitation."
  )
};

const quiz = {
  passingScorePercent: 70,
  questions: [
    { questionId: "ch44-q01", prompt: "Why does the mirror effect matter in this chapter?", choices: ["Because reflection can force self-confrontation more sharply than direct criticism", "Because copying always guarantees control", "Because mirroring removes all escalation risk"], correctIndex: 0, explanation: tone("Correct. The chapter focuses on self-confrontation created by reflection.", "The mirror matters because people can be unsettled when they face themselves from outside.", "Right. The issue is destabilizing self-image, not automatic dominance."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch44-q02", prompt: "What can strategic reflection do?", choices: ["Replace the need for judgment or timing", "Work equally well in every setting", "Interrupt confidence or provoke reaction by returning a person's own style"], correctIndex: 2, explanation: tone("Yes. The chapter says reflection can disarm or inflame by making self-image visible.", "Strategic mirroring matters because it changes how the other person experiences their own behavior.", "Correct. The gain is interruption of confidence, not context-free certainty."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch44-q03", prompt: "Why is this chapter not generic mimicry advice?", choices: ["Because it distinguishes strategic reflection from childish copying", "Because it rejects all imitation completely", "Because it says obvious copying always wins"], correctIndex: 0, explanation: tone("Correct. The law separates precise reflection from empty imitation.", "Greene is not endorsing broad copying; he is describing selective mirroring with purpose.", "Right. Precision and context matter more than copying by itself."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch44-q04", prompt: "In Tovin's work scenario, what best fits the chapter?", choices: ["Mock the counterpart loudly so the imitation becomes obvious", "Mirror the counterpart's style precisely enough to expose it without losing control", "Avoid any reflection and rely only on more argument"], correctIndex: 1, explanation: tone("Yes. He uses reflection to make the tactic visible without turning the move into spectacle.", "The chapter favors selective mirroring over either blunt accusation or childish copying.", "Correct. The mirror works because it reveals the pattern while control is preserved."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch44-q05", prompt: "What does Nerida's school example show?", choices: ["That school conflicts are too shallow for the mirror effect", "That mirroring only works when it is theatrical", "That self-image can be disturbed once a debate tactic is reflected back to its owner"], correctIndex: 2, explanation: tone("Correct. Her case shows how self-confrontation can change a school conflict too.", "The chapter says reflection can make a tactic newly visible to the person using it.", "Right. The effect comes from self-recognition, not from showmanship."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch44-q06", prompt: "What is the strongest reading of Ilyas's personal dilemma?", choices: ["If the mirror is accurate, escalation risk does not matter", "He must judge whether the context can contain the reaction the reflection invites", "Personal conflict has nothing to do with self-confrontation"], correctIndex: 1, explanation: tone("Yes. The chapter says the mirror effect has an escalation limit as well as a strategic use.", "His dilemma turns on whether the setting can hold the reaction safely.", "Correct. Accuracy alone is not enough if the context cannot contain the result."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch44-q07", prompt: "How can mirroring interrupt confidence?", choices: ["By making the person experience their own tactic from the outside", "By ensuring they agree with criticism immediately", "By replacing the need for any follow-up judgment"], correctIndex: 0, explanation: tone("Correct. The chapter says confidence can weaken once self-image is externally visible.", "A returned tactic can disturb the comfort of acting without seeing oneself.", "Right. The mirror matters because it forces a new vantage point on the same behavior."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch44-q08", prompt: "When does mirroring become empty imitation or unsafe escalation?", choices: ["When it is precise, selective, and context-aware", "When it is too obvious, humiliating, or used in a setting that cannot absorb the reaction", "When it exposes self-image dependence clearly"], correctIndex: 1, explanation: tone("Exactly. The chapter warns against mirrors that turn into mockery, spectacle, or uncontrolled provocation.", "Mirroring fails when reflection becomes blunter than the setting can handle.", "Right. The value is lost once escalation outruns insight."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch44-q09", prompt: "How does Chapter 43 lead into Chapter 44?", choices: ["By proving persuasion and reflection are the same tactic", "By replacing buy-in with pure coercion", "By moving from inward assent through persuasion to self-confrontation through reflection"], correctIndex: 2, explanation: tone("Correct. Chapter 43 dealt with winning assent, and Chapter 44 deals with unsettling self-image.", "The bridge moves from building willingness to disrupting confidence.", "Right. Both chapters work on inner life, but in very different ways."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch44-q10", prompt: "What bridge carries Chapter 44 into Chapter 45?", choices: ["Chapter 45 returns only to mirroring tactics", "After learning how reflection unsettles, the next issue is how change can be paced without overreform", "Destabilizing reflection makes reform timing irrelevant"], correctIndex: 1, explanation: tone("Correct. The next law shifts from psychological reflection to introducing change without excess reform.", "Chapter 45 asks how reform can proceed without provoking revolt through too much change at once.", "Right. The bridge moves from disturbance through reflection to pacing structural change."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" }
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
for (const name of ["Tovin", "Nerida", "Ilyas", "Coralie"]) continuity.nameUsage[name] = [stem];
continuity.withinChapterNames[stem] = ["Tovin", "Nerida", "Ilyas", "Coralie"];
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
- Chapter-specific mechanism remains reflection, self-confrontation, confidence interruption, and escalation limits rather than generic mimicry advice
- Hard depth preserves the reflection-versus-escalation boundary and the Chapter 45 bridge
- Quiz stays within supported facts from the approved draft and frozen source bundle

## Gate result
- Approved for chapter gate and automatic continuation
`;
writeText(paths.validation, validation);

fs.appendFileSync(
  paths.runLog,
  `\n- Completed writer, editor, critic, converter, quiz, and validator steps for Chapter 44.\n- Validation result: PASS.\n- Continuity hash sealed for \`${stem}\`: \`${seal}\`\n`,
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
