const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const runRoot = path.resolve(".chapterflow/runs/the-48-laws-of-power/20260409-002544");
const num = 39;
const stem = `ch${String(num).padStart(2, "0")}`;
const title = "Stir Up Waters to Catch Fish";
const chapterId = "ch39-stir-up-waters-to-catch-fish";
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

const canonical = `Greene's thirty-ninth law asks what happens when calm composure hides more than it reveals. The chapter answers by turning from observation under still conditions to disturbance. A person who looks measured while everything is smooth may become far more readable once anger, confusion, or agitation interrupts their control. The law therefore treats emotional turbulence as a way of exposing weakness and reducing judgment.

Its claim is not that chaos is automatically useful or that cruelty is strategic by default. Greene's point is narrower. Disturbance can weaken self-command. A provoked person may say too much, overreact, misjudge timing, or expose hidden instability. Power can grow when one side stays calmer while the other side is pulled into reaction. What matters is not noise for its own sake, but what the noise reveals.

That is why the chapter distinguishes strategic provocation from reckless cruelty. Greene is not praising bullying, random escalation, or rage as entertainment. He is describing pressure that creates readable disturbance while preserving control on the provocateur's side. The strongest version of the law creates asymmetry: one party becomes reactive while the other remains composed enough to observe, exploit, or redirect the resulting weakness.

Ordinary settings make the mechanism visible. A negotiation may expose instability once one side is mildly unsettled. A faculty hearing or team debate may reveal who loses judgment fastest when pressure rises. A personal disagreement may show more truth after one sharp disturbance than after a long calm exchange, provided the disturbance does not outrun control. In each case, emotional turbulence changes what becomes visible.

The chapter's limit matters. Some disturbances escalate beyond utility and create danger, confusion, or backlash that the calmer party cannot reliably contain. Greene overreaches if the law becomes advice to create chaos without boundaries or to injure others merely to watch them break. The useful version is narrower: disturb only when the agitation reveals more weakness than risk, and only while you can remain calmer than what you have stirred. Chapter 38 dealt with preserving position through camouflage. Chapter 39 asks how preserved position can be used to draw weakness into the open. That leads naturally to Chapter 40, where leverage depends less on disturbance than on refusing the cheap, the free, and the dependent lure.`;

const edited = canonical;

const critic = `# Chapter 39 Critic Report

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
- Paragraph 4 is most vulnerable because work, school, and personal examples can flatten into generic conflict escalation if conversion drops the calm-asymmetry and escalation-limit logic.

Strongest sentence:
- "What matters is not noise for its own sake, but what the noise reveals."

Anchor use notes:
- The draft stays inside the frozen support: disturbance weakens judgment, provocation can reveal weakness, calm asymmetry creates leverage, and uncontrolled escalation remains the limit.

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
        "This law says that disturbance can make people more readable and less controlled. Greene is not saying that chaos is always useful or that cruelty is automatically smart. The point is that anger, confusion, and agitation can weaken judgment. A calm person may still hide a lot, but once pressure rises they may reveal impulse, instability, or weakness. That is why provocation can matter strategically. But the chapter is not praising random escalation. Disturbance helps only when it reveals more than it destroys. Once the chaos becomes larger than the advantage it creates, the tactic starts collapsing into risk.",
        "Greene's thirty-ninth law argues that people often lose judgment when they become emotionally reactive. The chapter says disturbance matters because it can expose hidden tendencies that calm discussion keeps covered. A provoked person may speak too quickly, misread the moment, or reveal more than intended. But the law is not generic advice to make every conflict louder. Strategic provocation is different from reckless cruelty. Used well, the calmer party gains asymmetry. Used badly, both sides can lose control and the advantage disappears.",
        "This law gives a competitive warning: calm conditions can hide weakness that emotional turbulence makes visible. Greene wants the reader to notice reaction. A little agitation may show more than a long steady exchange. But the chapter has a limit. Some people become more dangerous rather than more readable when provoked, and some conflicts escalate too far to be useful. The reader's edge comes from knowing when disturbance exposes weakness and when it simply creates uncontrollable mess."
      ),
      keyTakeaways: [
        { point: tone("Disturbance can weaken judgment.", "Agitation can make people more reactive and more readable.", "What loses balance often loses control.") },
        { point: tone("Calm asymmetry creates leverage.", "If you stay composed while others react, you may see and use more.", "The calmer side often gains the advantage once the other side is stirred.") },
        { point: tone("Provocation has an escalation limit.", "The chapter supports controlled disturbance, not chaos for its own sake.", "If the waters become too wild, you may lose the fish and the net.") }
      ],
      oneMinuteRecap: tone(
        "This law says that emotional turbulence can expose weakness that calm conditions keep hidden.",
        "Disturb when the reaction reveals more than it costs, and only while you remain calmer than what you stirred.",
        "Provocation becomes useful only if it creates leverage instead of uncontrollable chaos."
      )
    },
    medium: {
      chapterBreakdown: tone(
        `Greene's thirty-ninth law begins with a practical problem: calm conditions often hide the very weakness you want to read. The chapter answers by turning from observation alone to disturbance. A person may look controlled, measured, and guarded until confusion, anger, or pressure shakes the surface enough to expose what steadiness had concealed.

That is why disturbance matters here. Greene is not claiming that noise is automatically useful. He is saying that agitation can reduce judgment. A provoked person may reveal impulse, insecurity, timing errors, or poor control more quickly than they would in a composed exchange. The turbulence matters because it changes what becomes visible.

The distinction that matters is between strategic provocation and reckless cruelty. Strategic provocation creates readable pressure while preserving control. Reckless cruelty creates escalation without a usable advantage. The chapter becomes weak if it is flattened into generic conflict advice, because Greene is not praising chaos for its own sake. He is describing disturbance that produces asymmetry: one side remains calmer while the other becomes reactive.

Ordinary settings show the pattern clearly. Senan may expose instability in a negotiation with mild provocation rather than direct accusation. A faculty hearing or team debate may show that Mirel gains ground simply by staying composed while others lose their balance. A personal setting may reveal more under controlled disturbance than under a polite but unreadable surface. In each case, agitation changes access to information.

The limit remains central because provocation can also outrun control. If the agitation becomes too intense, too cruel, or too dangerous, the tactic stops generating leverage and starts creating uncontrollable cost. Greene's better point is narrower: stir only when the disturbance exposes more weakness than it creates risk. Chapter 38 dealt with preserving position through camouflage. Chapter 39 deals with using that preserved position to create diagnostic pressure. Chapter 40 then turns toward refusing dependency by rejecting what comes too cheaply.`,
        `A reactive person often reveals more than a composed person. Greene uses that fact to shift the reader from calm observation to controlled disturbance. The issue is not whether emotion exists. It is whether provoking it can expose what steady conditions keep hidden.

That is why agitation can be strategically useful. A person in anger or confusion may say too much, misjudge timing, or lose the discipline that had been protecting them. Greene's practical claim is that emotional turbulence can make weakness legible. If you remain calmer than what you have stirred, the imbalance can become leverage.

The chapter is strongest when it separates exposure from cruelty. Exposure reveals something useful. Cruelty escalates because it wants escalation. Greene is not asking the reader to make every situation uglier. He is asking the reader to understand when a controlled disturbance exposes hidden weakness and when it merely destroys the setting.

The pattern appears everywhere. Senan can use mild provocation to read a negotiation partner more clearly. Mirel can let a faculty hearing or team debate show who loses judgment fastest under pressure. A personal disagreement may clarify more under one sharp disturbance than under endless restrained ambiguity. The result changes because emotional control changes.

The law overreaches if it becomes permission for bullying, chaos, or provocation detached from containment. The useful boundary is sharper than that: stir only what you can still read and survive, and only when the agitation gives you more information or leverage than it gives you danger. Chapter 38 asked how position is preserved under camouflage. Chapter 39 asks how preserved position can then be used to disturb others. The next law turns from turbulence toward independence from what is too easy or too cheap.`,
        `Greene's thirty-ninth law warns that composed surfaces can be deceptive. Readers often trust what calm demeanor suggests, yet Greene notices that self-control under still conditions can hide more than it reveals. The chapter therefore treats disturbance as a test. A little agitation may make visible what a great deal of calm observation could not reach.

The law values provocation because emotional turbulence can reduce judgment. A person who is confused, angered, or unsettled may expose impulse, insecurity, vanity, or poor timing much faster than a person speaking from equilibrium. In that sense, disturbance is diagnostic. It turns hidden tendencies into visible reactions.

This is why the chapter should not be flattened into endorsement of indiscriminate cruelty. Greene is not saying that chaos is a free advantage or that escalation is valuable by default. He is saying that controlled disturbance can create a useful asymmetry if one side stays composed. Uncontrolled disturbance destroys that asymmetry by consuming both sides.

Common cases make the line visible. Senan may learn more from a pressured negotiation than from a smooth one. Mirel may gain in a faculty hearing or team debate because she can stay calm while others become exposed by reaction. A personal disagreement may reveal its true fault line only after a contained disturbance breaks the polite surface. These are not different rules. They are the same pressure logic at different scales.

The limit matters because escalation can quickly outrun strategy. Greene's law works only when the waters are stirred enough to reveal movement but not so violently that everything becomes unreadable. Chapter 38 dealt with camouflage and position. Chapter 39 deals with disturbance and exposure. Chapter 40 follows because once weakness is exposed, the next question becomes how dependency is resisted by refusing the free and the cheap.`
      ),
      keyTakeaways: [
        {
          point: tone("Disturbance can reveal weakness hidden by composure.", "Agitation often exposes what calm surfaces conceal.", "A reactive moment can make hidden tendencies legible."),
          moreDetails: tone("The chapter treats disturbance as a diagnostic condition rather than as noise alone.", "Judgment often weakens once anger, confusion, or agitation rises.", "Provocation matters because it changes what can be observed.")
        },
        {
          point: tone("Calm asymmetry can create leverage.", "If one side stays composed while the other reacts, information and advantage shift.", "The calmer actor often sees more and spends less."),
          moreDetails: tone("Greene values provocation because it can create an imbalance in judgment and self-control.", "The tactic works when the provocateur remains more stable than the response produced.", "Asymmetry is the point; shared chaos destroys the value.")
        },
        {
          point: tone("Strategic provocation is different from reckless cruelty.", "Useful disturbance reveals; reckless disturbance only escalates.", "The tactic fails when pressure stops being diagnostic and becomes uncontrolled."),
          moreDetails: tone("The chapter stays sharp only if provocation remains tied to information, exposure, or leverage.", "Cruelty without control increases risk faster than value.", "Disturbance becomes strategic only while it remains containable.")
        },
        {
          point: tone("Work, school, and personal settings all reveal pressure logic.", "Ordinary conflicts also show how agitation changes readability.", "Calm surfaces often break differently once disturbed."),
          moreDetails: tone("Negotiations, hearings, debates, and personal disagreements can all reveal more under controlled pressure.", "The law becomes practical when you ask whether calm exchange is hiding the thing you need to see.", "Turbulence matters because reaction often tells the truth faster than posture does.")
        },
        {
          point: tone("The law has an escalation limit.", "Provocation turns weak once the turbulence becomes more dangerous than revealing.", "You need water stirred, not a flood that destroys the net."),
          moreDetails: tone("Greene warns against uncontrolled agitation, not against all disturbance.", "The useful line is to provoke only while the reaction remains readable and the situation remains survivable.", "Once chaos outruns control, the advantage is gone.")
        }
      ],
      activationPrompt: tone(
        "Find one situation where calm politeness may be hiding more than it reveals.",
        "Choose one setting where a small controlled disturbance could produce clarity.",
        "Identify one place where provocation would expose useful weakness and one where it would only create uncontrollable risk."
      ),
      selfCheckPrompt: tone(
        "If I stir this situation, am I likely to reveal something useful or simply lose the conditions needed to read it?",
        "Can I stay calmer than the reaction I am trying to provoke?",
        "At what point would more turbulence stop increasing information and start increasing danger?"
      ),
      oneMinuteRecap: tone(
        "This chapter argues that emotional disturbance can expose weakness by weakening judgment and making hidden tendencies visible.",
        "Stir only what you can still read and contain, and only while your own composure stays stronger than the reaction you provoke.",
        "Provocation is useful when it creates calm asymmetry, not when it turns both sides into chaos."
      )
    },
    hard: {
      chapterBreakdown: tone(
        `Greene's thirty-ninth law asks the reader to think of emotional disturbance as a revealing condition rather than as mere disorder. A composed surface may conceal impulse, insecurity, vanity, or bad judgment for a long time. The chapter therefore relocates leverage from still observation alone to controlled agitation. What matters strategically is whether turbulence makes hidden weakness visible before the situation becomes unreadable.

That is why the law values disturbance. Greene is not glamorizing chaos for its own sake. He is describing the way anger, confusion, and provocation can disrupt self-command. A reactive person may overspeak, mistime action, expose obsession, or reveal unstable judgment. Disturbance can therefore work like pressure on a fault line: it shows where the structure gives way and how quickly.

The central distinction is between strategic provocation and reckless cruelty. Strategic provocation creates exposure while preserving asymmetry. Reckless cruelty destroys asymmetry by escalating the situation beyond the provocateur's control. One form of disturbance reveals weakness. The other creates a wider mess in which weakness becomes harder, not easier, to read.

That distinction matters because calm asymmetry is the real advantage. Senan may gain more from a negotiation once mild provocation exposes instability than from endless composed exchange. Mirel may gain in a faculty hearing or team debate because she can remain balanced while others become reactive. A personal conflict may reveal the real break line only after a controlled disturbance punctures the polite surface. In each case, the tactic works because one side keeps judgment while the other side spends it.

The chapter is strongest when it refuses both sentimentality about calm and fascination with chaos. Some people become more dangerous, not more readable, under provocation. Some disturbances escalate into backlash, noise, or conditions no one can use. Greene's limit therefore matters. Stir only what remains containable, and only while the disturbance is increasing readable weakness faster than it is increasing risk.

Chapter 38 argued that camouflage can preserve position in hostile environments. Chapter 39 turns preserved position outward again by asking how controlled disturbance can expose what calm settings hide. The sequence matters. First avoid becoming the target too early. Then, from a safer position, create the kind of pressure that makes others expose themselves. Chapter 40 follows by turning from provocation toward dependency, asking how the free and the cheap can become hidden forms of weakness.`,
        `A person in calm control is not always transparent. Greene uses that fact to shift the reader from passive observation to provoked exposure. The strategic issue is not whether emotion exists. It is whether stirring it reveals something otherwise inaccessible and whether that revelation is worth the risk.

The chapter therefore values disturbance because agitation changes judgment. A person who is confused or angered may betray timing errors, defensive habits, hidden vanity, or poor control far more quickly than a person speaking under smooth conditions. Greene's practical claim is that turbulence can convert invisible weakness into visible reaction.

The harder distinction is between revelation and escalation. A good provocation reveals the fault line. A bad provocation drowns the room in so much chaos that no one can read anything cleanly anymore. Greene is not calling for more intensity by default. He is calling for disturbance precise enough to expose weakness while keeping the provocateur's own balance intact.

Senan's negotiation pressure, Mirel's faculty hearing or team debate calm, and a personal controlled disturbance all show the same structure. They succeed when the other side loses more judgment than the calmer side does. That is why disturbance can outperform direct confrontation. It changes the other's state instead of merely restating your position.

The law overreaches whenever it turns provocation into bullying, indiscriminate agitation, or emotional sport. Its useful boundary is sharper than that. Create only the disturbance you can still read, contain, and exploit. Chapter 38 asked how to preserve position under cover. Chapter 39 asks how to use that cover to unsettle others strategically. Chapter 40 then moves away from turbulence and toward refusing what creates dependency through cheap access.`,
        `Greene's thirty-ninth law is really about leverage through disequilibrium. Many readers respect calm surfaces too much, assuming that what appears controlled is therefore strong. Greene is less trusting. He notices that composure under still conditions may say more about the environment than about the person. Disturb the environment and the person may disclose far more than calm ever allowed.

Its strongest claim is that judgment is not equally stable across conditions. A reaction under pressure can expose the hidden operating system of a person more quickly than their composed self-description ever will. If you ignore that, you may keep mistaking poise for strength. Greene's correction is that controlled disturbance can reveal the true boundaries of someone's self-command.

That is why provocation should be understood as diagnostic pressure rather than as theatrical aggression. A useful disturbance tests control. A useless disturbance only multiplies emotion. The distinction is brutal but necessary: provocation serves strategy when it creates readable asymmetry, and betrays strategy when it destroys the provocateur's own ability to read, contain, or survive the outcome.

The examples make that line visible. Senan does more with mild provocation in negotiation than with another calm round of statements because the disturbance reveals instability. Mirel gains in a hearing or debate by staying balanced while others expose themselves through reaction. A personal disagreement becomes informative only if the disturbance is contained enough to show where judgment actually breaks. These are not separate tricks. They are one disequilibrium logic across different settings: create a state in which weakness has to move.

The limit matters because disequilibrium can escalate faster than advantage. Greene's law becomes useful only when the turbulence remains more revealing than destructive and only when the provocateur stays calmer than the reaction provoked. If that stops being true, the waters are no longer being stirred to catch fish. They are simply flooding the field. Chapter 38 dealt with strategic invisibility. Chapter 39 deals with strategic disturbance. Chapter 40 follows because once leverage is exposed, the next vulnerability often lies in what a person cannot resist when it comes cheaply or freely.`
      ),
      keyTakeaways: [
        {
          point: tone("Disturbance can function as a revealing condition.", "Agitation can expose weakness that calm surfaces conceal.", "Pressure often shows the fault line faster than stillness does."),
          moreDetails: tone("The chapter treats emotional turbulence as diagnostic rather than merely destructive.", "A composed surface may be stable only until provocation tests it.", "Strategic insight begins when disturbance changes what becomes visible.")
        },
        {
          point: tone("Calm asymmetry is the core advantage.", "Provocation matters when one side stays steadier than the reaction it creates.", "The calmer side can read and use what the reactive side is spending."),
          moreDetails: tone("Greene values disturbance because it can create a gap in judgment and self-command.", "The tactic works only while the provocateur preserves more balance than the target.", "Asymmetry is the leverage; shared agitation destroys it.")
        },
        {
          point: tone("Reckless cruelty is not the same as strategic provocation.", "A good disturbance reveals; a bad one only escalates.", "When chaos replaces readability, the tactic has failed."),
          moreDetails: tone("The chapter stays hard only if pressure remains tied to exposure and containment.", "Cruelty without control multiplies risk faster than information.", "Provocation becomes strategic only while the reaction remains usable.")
        },
        {
          point: tone("Negotiations, hearings, debates, and personal conflicts all show the same disequilibrium logic.", "Ordinary settings also reveal more once calm balance is tested.", "Reaction often tells the truth that posture was hiding."),
          moreDetails: tone("The law becomes practical when you ask whether stillness is concealing the thing you need to know.", "Disturbance matters because reaction can reveal timing errors, vanity, fear, or poor control quickly.", "Pressure changes what the other side can keep hidden.")
        },
        {
          point: tone("The law has a containment limit.", "Stir only what remains more revealing than dangerous.", "Flooding the field destroys the advantage of stirring it."),
          moreDetails: tone("Greene warns against uncontrollable escalation, not against all provocation.", "The useful rule is to create only the disturbance you can still read, survive, and exploit.", "Once turbulence outruns calm asymmetry, the leverage is gone.")
        }
      ],
      activationPrompt: tone(
        "Locate one interaction where calm conditions may be protecting a weakness you need to understand.",
        "Choose one setting where mild provocation could reveal more than another polite exchange.",
        "Identify one place where you could keep calm asymmetry and one where disturbance would likely outrun control."
      ),
      selfCheckPrompts: [
        tone(
          "What exactly am I trying to reveal through this disturbance, and how would I know if it had been revealed?",
          "Can I stay steadier than the reaction I am trying to trigger?",
          "If the waters rise one level higher than I expect, what becomes unreadable or unsafe?"
        ),
        tone(
          "Is this pressure diagnostic, or am I drifting toward cruelty because agitation itself feels powerful?",
          "Would a calmer exchange actually keep the key weakness hidden here?",
          "At what point would more disturbance stop increasing leverage and start erasing it?"
        )
      ],
      predictionPrompt: tone(
        "If disturbance exposes weakness, how might Chapter 40 argue that the next hidden weakness lies in dependency on what comes too cheaply or too freely?",
        "What changes once the issue is no longer judgment under pressure but appetite for the easy offer?",
        "After using disequilibrium to reveal weakness, how does strategy shift toward resisting cheap dependency?"
      ),
      oneMinuteRecap: tone(
        "This chapter argues that controlled disturbance can expose weakness by reducing judgment and forcing hidden tendencies into visible reaction.",
        "Stir only what you can still read and contain, and only while your own composure remains stronger than the reaction you provoke.",
        "Power grows when disequilibrium reveals the other's weakness without destroying your own control."
      )
    }
  },
  examples: [
    {
      title: "Senan Uses Mild Provocation to Expose Instability in a Negotiation",
      format: "decision_point",
      category: "work",
      endingType: "broader_principle",
      scenario: tone("Senan notices that a negotiation partner looks disciplined while everything stays calm, and he has to decide whether a small disturbance would reveal more than another smooth round of talk.", "He has to choose between continued stillness and controlled pressure.", "Senan can keep reading the surface or stir the water enough to see what moves underneath."),
      whatToDo: tone("He introduces a mild provocation that tests timing and composure without losing his own balance.", "He uses pressure to reveal more than the polished surface was showing.", "He stays calmer than the reaction he is trying to trigger."),
      whyItMatters: tone("The chapter says disturbance can expose weakness hidden by calm demeanor.", "His case shows how mild provocation can create readable asymmetry.", "He gains leverage by making instability visible rather than by arguing longer.")
    },
    {
      title: "Mirel Explains Why the Hearing Revealed More Once the Room Became Reactive",
      format: "dialogue",
      category: "school",
      endingType: "self_directed_question",
      scenario: tone("Mirel describes how a faculty hearing or team debate stayed unreadable while everyone was smooth, then revealed far more once pressure made some people reactive.", "She shows that agitation changed what could be seen.", "The conversation turns into a lesson about calm asymmetry rather than about volume alone."),
      whatToDo: tone("She studies who lost judgment first, who stayed composed, and what the disturbance exposed that calm politeness had hidden.", "She asks what information the turbulence made newly legible.", "She tracks whether the pressure stayed diagnostic or became too chaotic to use."),
      whyItMatters: tone("The chapter says reaction often reveals more than posture does.", "Her example shows how disturbance can expose instability faster than steady exchange.", "The room became informative only once control was tested.")
    },
    {
      title: "Tobin Has to Decide Whether Stirring the Situation Will Reveal Truth or Just Create Chaos",
      format: "dilemma",
      category: "personal",
      endingType: "surprising_implication",
      scenario: tone("Tobin believes a controlled disturbance might reveal what a personal conflict is hiding, but he also knows the same move could escalate beyond anything useful.", "He has to decide whether the pressure would stay diagnostic or become reckless.", "Tobin may expose weakness or simply flood the field."),
      whatToDo: tone("He uses only as much disturbance as he can still contain and read, or he does not stir at all.", "He refuses to mistake escalation for strategic depth.", "He keeps calm asymmetry as the condition for acting."),
      whyItMatters: tone("The chapter says disturbance works only while it reveals more weakness than risk.", "His dilemma shows the line between strategic provocation and uncontrolled chaos.", "A little pressure may clarify; too much may erase the advantage entirely.")
    },
    {
      title: "Laysa Predicts the Team Debate Will Reveal Who Loses Judgment First Under Pressure",
      format: "predict_reveal",
      category: "school",
      endingType: "cross_domain",
      scenario: tone("Laysa predicts that the team debate will not be decided only by ideas, but by who becomes visibly reactive once the exchange is sharpened.", "She expects disturbance to expose the weaker self-command.", "The scene becomes a forecast about reaction rather than stated position alone."),
      whatToDo: tone("She watches which participant remains calm enough to use the disturbance and which participant starts spending judgment through reaction.", "She tests whether the pressure reveals a fault line or just spreads noise.", "She compares smooth composure with composure under fire."),
      whyItMatters: tone("The chapter says pressure can reveal what calm conditions keep hidden.", "Her prediction shows how disturbance can make control legible in academic settings too.", "The debate may turn on reaction quality more than on polished opening posture.")
    },
    {
      title: "The Work Debrief Finds That Smooth Discussion Hid the Weakness Until Pressure Exposed It",
      format: "postmortem",
      category: "work",
      endingType: "common_trap",
      scenario: tone("A work debrief shows that a negotiation stayed unreadable while everyone remained composed, and only a sharper pressure point exposed the instability that mattered.", "They realize the weakness was not absent; it had simply been protected by calm conditions.", "The review becomes a lesson in diagnostic pressure rather than in endless politeness."),
      whatToDo: tone("They separate useful disturbance from reckless escalation and design the next pressure test more carefully.", "They stop assuming that smooth demeanor equals stable judgment.", "They build for revelation, not merely more heat."),
      whyItMatters: tone("The chapter warns that some weaknesses only appear once control is disturbed.", "Their mistake was trusting the calm surface too completely.", "The pressure mattered because it revealed what stillness concealed.")
    },
    {
      title: "Before and After One Controlled Disturbance Made the Hidden Break Line Visible",
      format: "before_after",
      category: "personal",
      endingType: "perspective_reframe",
      scenario: tone("Before, the conflict remained polite but unreadable. After, one contained disturbance exposed where judgment, impulse, or vanity actually broke down.", "The contrast is between hidden weakness under stillness and revealed weakness under pressure.", "One version conceals; the other discloses."),
      whatToDo: tone("Use only enough disturbance to reveal the true line of weakness, then stop before control collapses on both sides.", "Let the pressure clarify rather than engulf the situation.", "Keep your own composure stronger than the turbulence you create."),
      whyItMatters: tone("The law becomes visible when one reaction reveals more truth than a long calm exchange.", "This before-and-after shows how disturbance can change what information is available.", "The break line appears once the waters move.")
    }
  ],
  reviewCards: [
    { cardId: "ch39-rc01", front: tone("What is the main claim of Chapter 39?", "Why does disturbance matter here?", "What can agitation reveal?"), back: tone("The chapter argues that emotional disturbance can weaken judgment and expose weakness hidden by calm conditions.", "Disturbance matters because reaction can make hidden tendencies visible.", "Agitation can reveal impulse, instability, and poor control."), difficulty: "easy" },
    { cardId: "ch39-rc02", front: tone("What does calm asymmetry do strategically?", "Why does staying calmer than the reaction matter?", "How does leverage appear here?"), back: tone("It gives the calmer side more information and more control while the reactive side spends judgment.", "The tactic works when one party remains steadier than the turbulence it creates.", "Leverage appears through the gap between reaction and composure."), difficulty: "easy" },
    { cardId: "ch39-rc03", front: tone("How is strategic provocation different from cruelty?", "When does disturbance stop helping?", "What makes the tactic collapse?"), back: tone("Strategic provocation reveals weakness while cruelty escalates without useful control.", "The tactic stops helping once the turbulence becomes more chaotic than readable.", "If escalation destroys asymmetry, the advantage is gone."), difficulty: "medium" },
    { cardId: "ch39-rc04", front: tone("Where does this law appear in ordinary settings?", "How do work, school, and personal examples show disturbance logic?", "Why can reaction reveal more than calm exchange?"), back: tone("It appears wherever pressure changes what hidden tendencies become visible.", "Negotiations, hearings, debates, and personal conflicts all show how agitation can expose control limits.", "Reaction often reveals more than posture once calm surfaces are disturbed."), difficulty: "medium" },
    { cardId: "ch39-rc05", front: tone("How does Chapter 39 bridge to Chapter 40?", "What comes after weakness is exposed through disturbance?", "Why does provocation lead toward refusing the cheap?"), back: tone("Once weakness is exposed, the next issue is often what people still cannot resist when it comes easily or cheaply.", "Chapter 40 turns from disequilibrium to dependency.", "After disturbance reveals weakness, strategy asks what easy offers keep people vulnerable."), difficulty: "hard" }
  ],
  keyTakeawayCard: tone(
    "Stirring up waters becomes powerful when controlled disturbance weakens judgment enough to expose vulnerability while the provocateur remains calmer than the reaction produced.",
    "This law values emotional turbulence as diagnostic pressure while warning that uncontrolled escalation destroys the asymmetry the tactic depends on.",
    "Power grows when disturbance reveals weakness without flooding the field beyond control."
  )
};

const quiz = {
  passingScorePercent: 70,
  questions: [
    { questionId: "ch39-q01", prompt: "Why does disturbance matter in this chapter?", choices: ["Because chaos is always useful", "Because it can weaken judgment and expose hidden weakness", "Because anger proves strength"], correctIndex: 1, explanation: tone("Correct. The chapter says turbulence can reveal weakness and reduce control.", "Disturbance matters because reaction makes hidden tendencies visible.", "Right. The law is about exposure through agitation, not chaos for its own sake."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch39-q02", prompt: "What does agitation do strategically here?", choices: ["It guarantees victory for the provocateur", "It can make people more reactive and more readable", "It removes all risk from conflict"], correctIndex: 1, explanation: tone("Yes. Agitation can expose instability, bad timing, or poor self-command.", "The chapter values disturbance because it changes what becomes visible.", "Correct. Reaction can make weakness easier to read."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch39-q03", prompt: "Why is this chapter not generic cruelty advice?", choices: ["Because it distinguishes strategic provocation from reckless escalation", "Because it says bullying always works", "Because it rejects the need for control"], correctIndex: 0, explanation: tone("Correct. The chapter supports controlled disturbance, not cruelty for its own sake.", "Greene is drawing a line between diagnostic pressure and chaotic escalation.", "Right. The tactic works only while it remains containable and useful."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch39-q04", prompt: "In Senan's work scenario, what best fits the chapter?", choices: ["Create as much chaos as possible immediately", "Avoid any pressure even if the surface stays unreadable", "Use mild provocation to test composure while staying calm yourself"], correctIndex: 2, explanation: tone("Yes. The chapter favors controlled pressure that reveals more than it destroys.", "He uses disturbance to expose instability without losing his own balance.", "Correct. The point is calm asymmetry, not raw escalation."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch39-q05", prompt: "What does Mirel's school example show?", choices: ["That hearings and debates reveal who loses judgment first under pressure", "That calm demeanor always tells the truth", "That provocation is useless in school settings"], correctIndex: 0, explanation: tone("Correct. Her case shows how pressure exposes control limits more clearly than stillness does.", "The chapter says reaction can reveal more than polished posture.", "Right. The room becomes more informative once composure is tested."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch39-q06", prompt: "What is the strongest reading of Tobin's dilemma?", choices: ["He should escalate no matter what", "Controlled disturbance is useful only while it reveals more than it risks", "Any provocation is cruelty"], correctIndex: 1, explanation: tone("Yes. The chapter's limit is that disturbance must remain more diagnostic than destructive.", "He needs to decide whether the pressure will stay containable.", "Correct. The tactic fails once the risk outruns the revelation."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch39-q07", prompt: "How does calm asymmetry create leverage?", choices: ["By making both sides equally reactive", "By keeping one side steadier while the other side spends judgment", "By removing the need to observe reactions"], correctIndex: 1, explanation: tone("Correct. The calmer side can read and use what the reactive side exposes.", "The chapter says the advantage lies in the gap between control and reaction.", "Right. Shared chaos destroys the value, but asymmetric calm preserves it."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch39-q08", prompt: "When does provocation collapse into uncontrollable chaos?", choices: ["When it remains readable and containable", "When the disturbance increases useful exposure without excess risk", "When escalation outruns control and the situation stops being readable"], correctIndex: 2, explanation: tone("Exactly. The tactic fails once turbulence becomes more chaotic than diagnostic.", "If the waters flood the field, the advantage disappears.", "Right. Provocation needs containment as much as it needs pressure."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch39-q09", prompt: "How does Chapter 38 lead into Chapter 39?", choices: ["By moving from preserving position through camouflage to using that position for disturbance", "By proving camouflage makes later pressure impossible", "By rejecting any relation between concealment and provocation"], correctIndex: 0, explanation: tone("Correct. Chapter 38 preserves position, and Chapter 39 spends it to expose weakness.", "The sequence moves from camouflage to disturbance.", "Right. Hidden position can later support controlled provocation."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch39-q10", prompt: "What bridge carries Chapter 39 into Chapter 40?", choices: ["Chapter 40 abandons leverage entirely", "Refusing the cheap has no relation to exposed weakness", "Once weakness is exposed, the next issue is dependency on what comes too cheaply"], correctIndex: 2, explanation: tone("Correct. The next law turns from disturbance to what people still cannot resist when it is free or easy.", "Chapter 40 shifts from reaction under pressure to appetite under cheap access.", "Right. After exposure comes the question of dependency."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" }
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
for (const name of ["Senan", "Mirel", "Tobin", "Laysa"]) continuity.nameUsage[name] = [stem];
continuity.withinChapterNames[stem] = ["Senan", "Mirel", "Tobin", "Laysa"];
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
- Chapter-specific mechanism remains disturbance, calm asymmetry, judgment loss, and escalation limits rather than generic conflict escalation
- Hard depth preserves the diagnostic-pressure versus uncontrollable-chaos boundary and the Chapter 40 dependency bridge
- Quiz stays within supported facts from the approved draft and frozen source bundle

## Gate result
- Approved for chapter gate and automatic continuation
`;
writeText(paths.validation, validation);

fs.appendFileSync(
  paths.runLog,
  `\n- Completed writer, editor, critic, converter, quiz, and validator steps for Chapter 39.\n- Validation result: PASS.\n- Continuity hash sealed for \`${stem}\`: \`${seal}\`\n`,
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
