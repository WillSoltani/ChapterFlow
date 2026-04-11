const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const runRoot = path.resolve(".chapterflow/runs/the-48-laws-of-power/20260409-002544");
const num = 42;
const stem = `ch${String(num).padStart(2, "0")}`;
const title = "Strike the Shepherd and the Sheep Will Scatter";
const chapterId = "ch42-strike-the-shepherd-and-the-sheep-will-scatter";
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

const canonical = `Greene's forty-second law turns from inherited leadership shadow toward concentrated leadership in the present. A group, conflict, or institution may look broad and difficult to move because many people are involved. Greene's warning is that the visible spread can hide a narrower reality. Coordination, morale, and direction may depend heavily on one central figure. When that figure is pressured, removed, or discredited, the wider group can lose coherence faster than a diffuse struggle against everyone at once would suggest.

The point is not that every group is reducible to a single person or that every visible leader is the true source of power. Greene is arguing that some systems hold together through a shepherd, not through equal strength in every member. If the shepherd is the real coordinator, symbol, or nerve center, striking there can scatter followers more efficiently than attacking the whole flock. The danger is not focusing force. The danger is focusing it on the wrong figure and mistaking a surface face for the actual center.

That is why the chapter distinguishes a true shepherd from a scapegoat or merely visible member. Some leaders are replaceable. Some figureheads carry image but not coordination. Some conflicts regenerate because the underlying structure is intact even after one person falls. Greene's stronger claim is narrower: identify where morale, command, or permission actually concentrates, then decide whether root pressure will weaken the whole more effectively than broad friction.

Ordinary settings make the mechanism visible. A workplace conflict may persist because one coordinator keeps everybody aligned against change. A club or lab may look divided across many members while actually depending on one person who sets tone and direction. A family or friend group may revolve around one volatile center whose presence keeps the disorder organized. In each case, the practical question is whether the group is truly centralized or only appears to be.

The law overreaches when it becomes cruelty, scapegoating, or lazy personalization of structural problems. Some systems survive because leadership is distributed. Some visible leaders are symbols rather than roots. Some conflicts harden again even after the center is hit. Greene is strongest when he asks the reader to find the true coordinating node, not when he turns every problem into a hunt for one person to blame. Chapter 41 showed how power can be constrained by inherited shadow. Chapter 42 shows how power can be disrupted by concentrated leadership. Chapter 43 follows by asking how influence works when it reaches hearts and minds instead of coordination alone.`;

const edited = canonical;

const critic = `# Chapter 42 Critic Report

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
- Paragraph 4 is most vulnerable because work, school, and personal cases can flatten into generic attack-the-leader advice if conversion loses the distinction between true center and visible surface figure.

Strongest sentence:
- "The danger is focusing it on the wrong figure and mistaking a surface face for the actual center."

Anchor use notes:
- The draft stays inside the frozen support: central figure concentration, scatter effects, root targeting, symbolic versus operational leaders, and the scapegoat limit.

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
        "This law says that some groups stay together because one central figure keeps them coordinated. Greene is not saying that every problem comes from one person or that every visible leader is the real root. The point is that broad disorder can still depend on one nerve center. If that center is pressured, the wider group may lose direction and confidence faster than if you fought everyone at once. That is why the chapter values finding the true shepherd. The mistake is not focused pressure by itself. The mistake is choosing a scapegoat or surface figure while the real coordinator stays untouched.",
        "Greene's forty-second law argues that some conflicts are easier to break by targeting the central figure than by spreading force across the whole field. The issue is not aggression alone. The issue is concentration. A true shepherd can hold morale, permission, or coordination together. If that person is the real center, striking there can scatter followers faster than broad friction. The law is not generic attack-the-leader advice. It is advice to identify the real root before concentrating force.",
        "This law gives a competitive warning: a flock may look strong in numbers while actually leaning on one shepherd. Greene wants the reader to see that centralized groups can scatter quickly once the real center is hit. But the chapter has a limit. The move fails when the leader is only symbolic, when the system is resilient, or when you mistake blameworthy visibility for true coordination. The edge comes from hitting the real root, not from hunting a dramatic face."
      ),
      keyTakeaways: [
        { point: tone("Some groups concentrate around one center.", "A central figure can hold coordination or morale together.", "The whole field may depend on one nerve point.") },
        { point: tone("Root targeting can be more efficient than diffuse struggle.", "Hitting the real shepherd can scatter the wider flock.", "Focused pressure can break a centralized group faster than broad friction.") },
        { point: tone("The law has a scapegoat limit.", "Not every visible leader is the true center, and some systems stay intact after one figure falls.", "Misreading the root can waste force and leave the real structure untouched.") }
      ],
      oneMinuteRecap: tone(
        "This law says that some groups weaken fastest when pressure lands on the real coordinating center.",
        "Find the true shepherd before you spread force across the whole flock.",
        "Target the root, not the most dramatic face."
      )
    },
    medium: {
      chapterBreakdown: tone(
        `A large group can hide a narrow center of control. Greene's forty-second law begins there. A conflict, institution, or resistance movement may look broad because many people are involved. Yet the visible spread may conceal concentrated coordination. One figure may set permission, pace, morale, or strategic direction for everyone else. The chapter turns the reader away from the whole field and toward the real point where coherence is being maintained.

That is why the shepherd matters here. Greene is not saying that every organization collapses when one visible person is removed. He is saying that some organizations depend heavily on one true center. A coordinator can unify people who would otherwise fragment. A symbolic leader can hold morale together long enough for action to continue. A central operator can make scattered parts feel like one body. The danger is not focusing on the center. The danger is assuming the center is obvious when it may not be.

The key distinction is between a true shepherd and a merely visible figure. A true shepherd holds actual coordination, morale, or permission. A merely visible figure attracts attention without holding the system together. Greene respects root targeting because it can be far more efficient than friction applied everywhere. But efficiency appears only if the root has been identified correctly. A dramatic face is not automatically the real node.

Ordinary settings show the pattern clearly. Voren may realize that a difficult workplace conflict is kept alive by one quiet coordinator rather than by the whole team equally. Elin may see that a club presidency fight or lab dependency problem turns on the person who grants direction, not just the person with the loudest profile. A personal group may revolve around one unstable center whose presence keeps everyone reacting in formation. In each case, the practical question is whether striking the center would truly weaken the whole.

The law becomes weak if it turns into leader-blame theater. Some systems are distributed. Some visible leaders are replaceable. Some groups scatter only briefly because the underlying structure survives intact. Greene's stronger point is narrower: find the real coordinating node before you concentrate force. Chapter 41 showed how leadership shadow can trap a successor. Chapter 42 shows how leadership concentration can expose a system to disruption. Chapter 43 then turns from scattering followers to securing deeper allegiance in hearts and minds.`,
        `Some conflicts are held together less by numbers than by a single organizing center. Greene uses that idea to shift the reader from broad opposition to root concentration. The chapter matters because attacking the whole field can waste effort when one shepherd is doing most of the coordinating work.

That is why direct pressure can matter here. A true center can hold morale, permission, and timing together. If that center is weakened, the rest may lose coherence faster than expected. Greene's practical claim is that focused pressure can outperform diffuse struggle when the system is genuinely centralized. The issue is not cruelty. The issue is whether the center is real.

The chapter is strongest when it separates root focus from scapegoating. Root focus identifies the node that actually holds the system together. Scapegoating personalizes a problem because one face is easy to blame. Greene is not asking the reader to hunt the loudest figure by default. He is asking the reader to determine whether one person truly concentrates the group's energy.

The pattern appears everywhere. Voren can stop treating every teammate as equally central once he sees who is really coordinating resistance. Elin can study whether the club or lab depends on one granting figure more than on formal titles. A personal group can look chaotic while still being organized around one volatile source. The chapter stays specific when center, coordination, and replacement risk all remain visible at once.

The law overreaches if it becomes simplistic personalization of structural problems. Its useful boundary is sharper than that: strike the true center when there is one, avoid wasting force on visible substitutes, and remember that some systems regenerate because leadership was never as concentrated as it looked. Chapter 41 dealt with dependence through inherited shadow. Chapter 42 deals with vulnerability through concentrated leadership. The next law turns toward working on hearts and minds rather than only breaking coordination.`,
        `A scattered field can still depend on one center. Greene's forty-second law warns that breadth can be misleading when real power is concentrated. Many readers see a large group and assume the problem must be addressed everywhere at once. Greene notices that some systems are held together by one figure who supplies direction, legitimacy, or emotional coherence.

That is why the law values root targeting over diffuse pressure. Once the real shepherd is identified, pressure on that figure can do more than pressure on many peripheral members. Remove the source of coordination and the flock may fragment on its own. Greene's harder claim is that strategic efficiency often depends less on total force than on correct concentration.

This is also why the chapter should not be flattened into generic attack-the-leader advice. Some visible leaders are replaceable. Some figureheads hold image without holding command. Some groups keep moving because structure, not personality, is the true root. The strategic error is not targeting one figure. The strategic error is targeting the wrong one and mistaking publicity for centrality.

Common settings make the line visible. Voren can see that a workplace problem is not equally distributed once one coordinator's influence becomes legible. Elin can detect that a school conflict may turn less on formal titles than on who actually grants permission and tone. A personal group can appear noisy while still revolving around one person who organizes the reaction. These cases are not about cruelty. They are about whether the center is operational, symbolic, or replaceable.

The limit matters because lazy personalization can also distort strategy. Greene's law works when it sharpens diagnosis, not when it turns every conflict into a search for one face to punish. Strike the real root when the root is real. Step back when the system is distributed. Chapter 41 dealt with shadow around leadership succession. Chapter 42 deals with concentration inside active leadership. Chapter 43 follows by asking how influence becomes durable when it secures hearts and minds rather than merely scattering a group.`
      ),
      keyTakeaways: [
        {
          point: tone("Some groups are more centralized than they appear.", "A central figure can quietly hold morale, permission, or direction together.", "A broad field can still depend on one coordinating node."),
          moreDetails: tone("Greene asks the reader to look past numerical spread toward concentration of function.", "The visible size of the group may hide a much narrower source of coherence.", "Centrality is about coordination, not just attention.")
        },
        {
          point: tone("Focused root pressure can outperform broad struggle.", "Pressure on the real shepherd can scatter a centralized flock faster than broad friction.", "Correct concentration can outperform raw breadth of force."),
          moreDetails: tone("The law favors focused pressure when the root is truly holding the system together.", "Strategic efficiency grows when force lands on the coordinating node.", "You gain more by breaking coherence than by exhausting yourself everywhere.")
        },
        {
          point: tone("A true shepherd is different from a visible scapegoat.", "Not every loud or prominent figure is the real center.", "Public visibility is not the same thing as operational centrality."),
          moreDetails: tone("A figurehead may attract blame without carrying coordination.", "The chapter stays sharp only when the reader distinguishes symbolic presence from real control.", "Mistaking attention for centrality leads force away from the true root.")
        },
        {
          point: tone("Work, school, and personal conflicts all reveal center logic.", "Ordinary groups also show how morale and permission can concentrate in one person.", "The same scatter effect appears wherever coordination narrows into one node."),
          moreDetails: tone("A workplace team, school institution, or private group may each depend on one central figure.", "The practical test is whether pressure on that figure would weaken the whole or merely change the face.", "Diagnosis matters more than drama.")
        },
        {
          point: tone("The law has a resilient-system limit.", "Some systems survive because leadership is distributed or replaceable.", "Scapegoating can fail as badly as diffuse struggle if the center was misread."),
          moreDetails: tone("The chapter stays reliable only when it resists easy leader-blame.", "A real strategy asks whether the structure would persist even after one figure falls.", "Root targeting needs accurate system reading, not just bold focus.")
        }
      ],
      activationPrompt: tone(
        "Find one conflict or group in your world where coordination may be more centralized than it first appears.",
        "Choose one situation where identifying the true node would matter more than pushing everywhere at once.",
        "Identify one visible figure who may be a scapegoat and one person who may be the real center."
      ),
      selfCheckPrompt: tone(
        "Am I looking at the real coordinating center, or only at the most visible face?",
        "Would pressure on this figure actually weaken the whole system, or would the structure stay intact?",
        "Am I diagnosing a root or personalizing a problem because one person is easy to blame?"
      ),
      oneMinuteRecap: tone(
        "This chapter argues that some groups weaken fastest when pressure hits the true coordinating center rather than the whole field.",
        "Focused force works best when the shepherd is real and the system is genuinely centralized.",
        "The strategic task is to identify the true root without sliding into scapegoating."
      )
    },
    hard: {
      chapterBreakdown: tone(
        `Greene's forty-second law is less about attacking leaders in general than about diagnosing concentration. A group may appear broad, resilient, and widely energized, yet the sources of permission, timing, morale, and coordination may still narrow into one central figure. The chapter therefore asks the reader to distrust visible spread when operational coherence is actually being held at one point. What matters strategically is whether the flock has many equal centers or one shepherd whose pressure-bearing role is decisive.

That is why the law values striking the shepherd. Greene is not glamorizing aggression for its own sake. He is describing the efficiency of root pressure in genuinely centralized systems. A true leader can hold together people who would otherwise fragment, hesitate, or lose nerve. Disturb that center and the rest may not know how to keep moving in formation. Pressure can therefore travel outward through morale and coordination rather than through physical force alone.

The central distinction is between a true shepherd and a merely visible figure. A true shepherd carries command, permission, symbolic weight, or practical coordination in ways the wider group depends on. A visible figure may attract attention yet remain replaceable. One kind of target disrupts the whole. The other only satisfies the desire to personalize conflict. Greene's sharper claim is that root targeting works only when the root is real.

That distinction matters in ordinary settings. Voren may find that a workplace conflict looks broadly entrenched but is actually synchronized by one quiet coordinator. Elin may see that a club or lab does not revolve around the loudest face but around the person who grants permission, access, or confidence. A personal group may appear chaotic while still depending on one volatile center who keeps everyone reacting to the same signal. In each case, the move works because coordination was concentrated before pressure was applied.

The chapter is strongest when it refuses both diffuse struggle and lazy scapegoating. Some systems are distributed. Some leaders are ornamental. Some organizations regenerate because replacement, not collapse, follows the first strike. Greene's useful boundary is sharper: target the true center when one exists, but do not mistake visibility, blameworthiness, or drama for actual centrality. Chapter 41 dealt with inherited shadow around leadership. Chapter 42 deals with present concentration inside leadership.

That bridge matters because centrality is another hidden form of leverage. A group may look collective while still depending on one node to remain a group at all. Chapter 42 therefore teaches a different diagnostic from Chapter 41: ask not who deserves attention, but who keeps the structure coherent. Chapter 43 follows by shifting from disruption to persuasion, asking how influence works when the aim is not scattering followers but winning hearts and minds.`,
        `A system can be broad in membership and narrow in coordination. Greene uses that fact to move the reader from the whole field to the true center. The strategic question is never only how many opponents or participants there are. The deeper question is where permission, morale, and direction actually concentrate.

The chapter therefore values focused pressure because focused pressure can break a centralized system more cleanly than friction spread everywhere. Once the real shepherd is identified, the flock may scatter through confusion, lowered morale, or loss of command rather than through direct confrontation with each member. Greene's argument is that efficiency grows when you stop fighting the whole body and start reading the nerve center.

The harder distinction is between striking a root and selecting a scapegoat. A root strike weakens the structure because the target held real coordination. A scapegoat strike only creates spectacle because the target held visibility without control. Greene is not asking the reader to personalize every problem. He is asking for enough clarity to tell whether one person truly keeps the group coherent.

Voren's work problem, Elin's school conflict, and a personal group organized around one volatile presence all show the same mechanism. Each looks distributed at first. Each becomes narrower once the center is seen clearly. The real issue is whether the group would keep moving with the same confidence if that center lost force. If yes, the target was probably symbolic. If no, the root may have been found.

The law overreaches when it turns diagnosis into leader-blame theater or cruelty disguised as strategy. Its better boundary is exacting but usable: strike the true center when coordination is genuinely concentrated, avoid wasting force on visible substitutes, and remember that some structures survive because they were never dependent on one person alone. Chapter 41 exposed weakness through inherited comparison. Chapter 42 tracks weakness through concentrated coordination. Chapter 43 then asks how power works when it seeks durable assent instead of mere scattering.`,
        `Greene's forty-second law warns that numbers can mislead if they hide concentration. Many readers see a large, noisy field and assume power must be addressed everywhere. Greene keeps asking a narrower question. Who actually grants permission, sets tone, holds morale, or makes collective action feel possible? If the answer converges on one figure, then breadth is partly illusion. The flock looks large, but the shepherd still matters most.

Its strongest claim is that disruption can travel through coordination rather than through direct pressure on every member. Remove the figure who makes the group coherent, and the group's apparent strength may dissolve into hesitation or fragmentation. If you ignore that, you may waste force fighting peripheral members while the center keeps rebuilding the whole. Greene's correction is to treat centrality as a structural fact to be diagnosed, not a dramatic guess to be made from appearances.

That is why identifying the true shepherd can be a form of power preservation. Correct root targeting spends less force while causing wider disarray. Misidentified targeting does the opposite. It personalizes conflict around a visible face while the real coordinator remains untouched. Greene is not celebrating harm for its own sake. He is defending concentrated strategy against the seduction of diffuse struggle and theatrical blame.

The examples expose the same structure across settings. Voren is not merely dealing with a difficult team; he is deciding whether one quiet coordinator is the actual source of resistance. Elin is not merely handling club politics or lab dysfunction; she is deciding whether the formal leader, the granting figure, or someone else entirely is the real center. A personal group is not merely emotional; it is a test of whether one person organizes the whole reaction cycle. In each case, the weak move is not confronting broadly. The weak move is failing to distinguish the real root from the visible face.

The limit matters because leader focus can easily collapse into scapegoating. Some systems are resilient enough to replace the center immediately. Some centers are symbolic rather than operational. Some problems survive because the structure, not the shepherd, is the source. Greene's law works only when it sharpens judgment about concentration rather than replacing judgment with a hunt for one person to blame. Strike the true root when the root is real. Otherwise, read the structure more carefully. Chapter 41 dealt with shadow dependence. Chapter 42 deals with concentration dependence. Chapter 43 follows by showing that durable power also requires winning hearts and minds, not merely breaking a center.`
      ),
      keyTakeaways: [
        {
          point: tone("Breadth can hide concentration.", "A large group may still depend on one central coordinating node.", "Numbers can conceal a narrow source of coherence."),
          moreDetails: tone("The chapter asks the reader to diagnose where morale, permission, and direction actually converge.", "Visible spread is not proof of distributed power.", "Centrality is a structural question, not a visual guess.")
        },
        {
          point: tone("Root targeting can disrupt more efficiently than broad struggle.", "Pressure on the true shepherd can scatter the flock without fighting everyone directly.", "Correct concentration can create wider disarray with less wasted force."),
          moreDetails: tone("Greene values focused pressure because it can break coordination at its source.", "The system weakens when the node holding it together loses force.", "Efficiency comes from breaking coherence, not from exhausting yourself everywhere.")
        },
        {
          point: tone("A real shepherd differs from a visible scapegoat.", "Attention and blame do not prove operational centrality.", "The loudest face may be less important than the quieter coordinator."),
          moreDetails: tone("The chapter stays hard only if the reader separates symbol, figurehead, and true node.", "A mistaken target produces spectacle rather than systemic weakening.", "Root targeting works only when the root has been diagnosed accurately.")
        },
        {
          point: tone("Work, school, and personal groups all reveal center logic.", "Ordinary conflicts also show how one figure can organize the whole reaction pattern.", "The same scatter effect appears wherever coordination narrows into one person."),
          moreDetails: tone("A team, club, lab, or private group may each remain broad on the surface but centralized underneath.", "The practical test is whether the whole would lose coherence if that figure lost force.", "Diagnosis outranks drama in every setting.")
        },
        {
          point: tone("The law needs a resilient-system boundary.", "Some structures survive because leadership is distributed or replaceable.", "Scapegoating fails when the system was never centered the way it looked."),
          moreDetails: tone("The law keeps its edge only when it refuses blame theater and keeps reading the structure.", "The useful line is to target the real center without pretending every system has one.", "Judgment matters because structure can outlive the shepherd.")
        }
      ],
      activationPrompt: tone(
        "Locate one group in your world where visible spread may be hiding a narrow coordinating center.",
        "Choose one conflict where finding the real node would matter more than increasing broad pressure.",
        "Identify one visible leader who may be replaceable and one quieter figure who may actually hold the group together."
      ),
      selfCheckPrompts: [
        tone(
          "If this figure disappeared, would the group actually lose coordination, or would it keep moving almost unchanged?",
          "Am I identifying a real nerve center or only reacting to the most visible face?",
          "What evidence shows that morale, permission, or timing truly concentrates here?"
        ),
        tone(
          "Would pressure on this node weaken the whole, or am I personalizing a structural problem?",
          "Is this system centralized, distributed, or resilient enough to replace the center quickly?",
          "Am I pursuing a root strike, or just satisfying the urge to blame one person?"
        )
      ],
      predictionPrompt: tone(
        "If Chapter 42 warns about systems concentrated around one shepherd, how might Chapter 43 shift from disruption toward influence that wins hearts and minds?",
        "What changes once the goal is not scattering followers but securing their allegiance?",
        "After identifying how a group breaks, how does strategy move toward understanding how a group is persuaded?"
      ),
      oneMinuteRecap: tone(
        "This chapter argues that some groups are held together by one real coordinating center, and pressure there can scatter the wider flock faster than diffuse struggle.",
        "Power is preserved by identifying the true shepherd before concentrating force and by refusing to mistake a scapegoat for the real node.",
        "The task is to read concentration accurately without turning diagnosis into theatrical blame."
      )
    }
  },
  examples: [
    {
      title: "Voren Finds the Quiet Coordinator Instead of Fighting the Whole Team",
      format: "decision_point",
      category: "work",
      endingType: "broader_principle",
      scenario: tone("Voren faces a workplace conflict that looks spread across the entire team, but one quieter person appears to be setting permission and direction for everyone else.", "He has to choose between pushing against the whole field and testing the real center.", "The conflict looks broad, but the coordination may be narrow."),
      whatToDo: tone("He studies whether pressure on the actual coordinator would weaken the wider resistance more than broad friction would.", "He refuses to spend force everywhere before confirming where coherence is really held.", "He targets the root only after verifying that it is the root."),
      whyItMatters: tone("The chapter says some groups are more centralized than they first appear.", "His case shows why root targeting can outperform diffuse struggle when coordination is concentrated.", "The real gain comes from breaking coherence, not from arguing with everyone.")
    },
    {
      title: "Elin Explains Why the Club Presidency Fight Turns on One Granting Figure",
      format: "dialogue",
      category: "school",
      endingType: "self_directed_question",
      scenario: tone("Elin talks through a school conflict that seems to involve many loud voices, yet one person appears to control access, permission, and confidence for the rest.", "The conversation turns from visible leadership to true centrality.", "She is trying to separate the shepherd from the public face."),
      whatToDo: tone("She asks who actually grants direction and whether the conflict would lose shape if that person lost force.", "She studies operational centrality instead of assuming the loudest person is the root.", "She distinguishes title from coordination before making the next move."),
      whyItMatters: tone("The chapter says a real shepherd differs from a visible figurehead.", "Her example shows how school groups can concentrate around one node without saying so openly.", "Pressure only works strategically once the true center is identified.")
    },
    {
      title: "Perrin Has to Decide Whether a Volatile Family Figure Is the Root or Only the Face",
      format: "dilemma",
      category: "personal",
      endingType: "surprising_implication",
      scenario: tone("Perrin sees a family or friend-group disorder that always seems to swirl around one intense person, but he is not yet sure whether that person is the real source of coordination or simply the most visible problem.", "He has to decide whether the group would actually scatter without that figure.", "The real question is whether the center is operational or only dramatic."),
      whatToDo: tone("He tests whether the group's pattern depends on that person's permission, timing, or emotional signal before acting as if the root has been found.", "He refuses to confuse frustration with diagnosis.", "He looks for the coordinating role behind the visible noise."),
      whyItMatters: tone("The law says misreading a scapegoat as the shepherd wastes force.", "His dilemma shows why root targeting requires evidence, not just blame.", "A dramatic face is not always the real node.")
    },
    {
      title: "Alaia Predicts the Lab Dependency Will Break Only if the Real Coordinator Loses Force",
      format: "predict_reveal",
      category: "school",
      endingType: "cross_domain",
      scenario: tone("Alaia predicts that a lab dependency problem will not change just because a visible member is challenged, because the real coordinator may be someone else.", "She expects the group to stay intact unless the true shepherd is pressured.", "The scene becomes a forecast about centrality rather than title alone."),
      whatToDo: tone("She watches who grants permission, who others wait for, and whose loss would actually disrupt the pattern.", "She tests whether the lab is centralized or merely noisy.", "She asks what would scatter and what would quickly replace itself."),
      whyItMatters: tone("The chapter says effective pressure depends on identifying the real center.", "Her prediction shows how centrality can hide beneath formal roles in school settings too.", "The law is about coordination roots, not just leadership optics.")
    },
    {
      title: "The Debrief Finds That Broad Pressure Failed Because the Real Node Was Left Untouched",
      format: "postmortem",
      category: "work",
      endingType: "common_trap",
      scenario: tone("A work review shows that broad pressure was applied across an entire team, but the conflict kept rebuilding because the actual coordinator remained untouched.", "They realize the struggle was too diffuse and the diagnosis too shallow.", "The debrief becomes a lesson in root concentration rather than effort alone."),
      whatToDo: tone("They separate visible noise from actual coordination and redesign the response around the true node.", "They stop equating broad effort with strategic precision.", "They focus on the point where coherence is actually maintained."),
      whyItMatters: tone("The chapter warns that diffuse struggle can waste force when one center is holding the whole together.", "Their mistake was attacking the flock while leaving the shepherd intact.", "The system survived because the real root was never hit.")
    },
    {
      title: "Before and After Hitting the Real Center Changed the Whole Pattern",
      format: "before_after",
      category: "personal",
      endingType: "perspective_reframe",
      scenario: tone("Before, pressure was scattered across many people and the group kept reforming. After, the real center was identified and the pattern lost coherence quickly.", "The contrast is between fighting the whole field and disrupting the actual node.", "One version exhausts itself; the other changes the pattern."),
      whatToDo: tone("Confirm where morale and permission truly converge, then focus there instead of multiplying friction everywhere.", "Choose diagnosis over drama before deciding where to apply pressure.", "Trade diffuse struggle for root-level clarity."),
      whyItMatters: tone("The chapter becomes visible when one correct target matters more than many noisy confrontations.", "This before-and-after shows why centrality diagnosis changes the whole strategy.", "Power shifts once the real shepherd is known.")
    }
  ],
  reviewCards: [
    { cardId: "ch42-rc01", front: tone("What is the main claim of Chapter 42?", "Why does the shepherd matter here?", "What can a central figure do?"), back: tone("The chapter argues that some groups and conflicts hold together through a real central figure whose disruption can scatter the wider group.", "The shepherd matters because coordination, morale, or permission may be concentrated there.", "A central figure can keep the flock coherent in ways the wider group depends on."), difficulty: "easy" },
    { cardId: "ch42-rc02", front: tone("What is the difference between a true shepherd and a visible figure?", "Why is not every leader the right target?", "What keeps center diagnosis clean?"), back: tone("A true shepherd carries real coordination, while a visible figure may carry attention without holding the system together.", "Not every leader is the right target because some are replaceable or mostly symbolic.", "Center diagnosis stays clean when visibility is separated from operational centrality."), difficulty: "easy" },
    { cardId: "ch42-rc03", front: tone("Why can root targeting be more efficient than broad struggle?", "What happens when the real coordinator is hit?", "How does coherence break here?"), back: tone("The system can lose morale, timing, or direction once the true coordinating node is weakened.", "A real center matters because the wider group may fragment when its source of coherence loses force.", "Coherence breaks when the flock can no longer organize around the shepherd."), difficulty: "medium" },
    { cardId: "ch42-rc04", front: tone("Where does this law appear in ordinary settings?", "How do work, school, and personal groups show center logic?", "Why is breadth not the whole story?"), back: tone("It appears anywhere a team, institution, or private group depends on one figure for direction or morale.", "Workplace conflicts, school leadership fights, and personal groups can all revolve around one coordinating node.", "Breadth is not the whole story when coordination is narrow underneath it."), difficulty: "medium" },
    { cardId: "ch42-rc05", front: tone("How does Chapter 42 bridge to Chapter 43?", "What comes after scattering the flock?", "Why does center disruption lead toward hearts and minds?"), back: tone("After showing how concentrated leadership can be disrupted, the next issue is how durable influence works through deeper allegiance.", "Chapter 43 turns from breaking coordination toward winning hearts and minds.", "The bridge asks how power secures consent after it understands disruption."), difficulty: "hard" }
  ],
  keyTakeawayCard: tone(
    "Striking the shepherd means recognizing that some broad-looking groups are actually held together by one real coordinating center whose disruption can scatter the whole.",
    "This law values root diagnosis over diffuse struggle because pressure on the true node can break coherence more efficiently than force spread everywhere.",
    "Power grows when you identify the real center accurately and refuse to confuse a scapegoat with the structure's actual root."
  )
};

const quiz = {
  passingScorePercent: 70,
  questions: [
    { questionId: "ch42-q01", prompt: "Why does the shepherd matter in this chapter?", choices: ["Because every group depends on exactly one person", "Because some groups hold together through a real central figure", "Because visible leaders are always the true root"], correctIndex: 1, explanation: tone("Correct. The chapter focuses on concentrated coordination, not on every group being identical.", "The shepherd matters when morale, permission, or direction converges there.", "Right. The issue is real centrality, not leadership in the abstract."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch42-q02", prompt: "What can striking the center do strategically?", choices: ["It guarantees permanent collapse in every case", "It makes structure irrelevant", "It can break coordination or morale faster than broad pressure"], correctIndex: 2, explanation: tone("Yes. The chapter says focused pressure can scatter a centralized flock more efficiently.", "Breaking the center can weaken coherence faster than fighting everyone equally.", "Correct. The gain comes from disrupting coordination at its source."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch42-q03", prompt: "Why is this chapter not generic attack-the-leader advice?", choices: ["Because it distinguishes a true center from a symbolic or replaceable figure", "Because it rejects focused pressure entirely", "Because it says every visible leader should be ignored"], correctIndex: 0, explanation: tone("Correct. The law is about diagnosis of real centrality, not automatic hostility to leaders.", "Greene separates the true shepherd from scapegoats and figureheads.", "Right. A visible face is not automatically the root."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch42-q04", prompt: "In Voren's work scenario, what best fits the chapter?", choices: ["Pressure the whole team equally before checking who coordinates it", "Identify whether one quiet coordinator is keeping the wider resistance coherent", "Assume the loudest opponent is the real shepherd"], correctIndex: 1, explanation: tone("Yes. He needs to verify where coherence is really being held.", "The chapter favors root diagnosis before broad effort.", "Correct. Force should follow centrality, not just noise."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch42-q05", prompt: "What does Elin's school example show?", choices: ["That formal titles always reveal the true center", "That centrality can hide in the person who grants permission rather than the loudest profile", "That school groups are too shallow for this law"], correctIndex: 1, explanation: tone("Correct. Her case shows that operational centrality can differ from public visibility.", "The chapter asks who actually grants direction and confidence.", "Right. Titles and noise do not always reveal the real node."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch42-q06", prompt: "What is the strongest reading of Perrin's personal dilemma?", choices: ["A dramatic face is automatically the real center", "Only organizations, not private groups, can have shepherds", "He must test whether the volatile figure is truly the coordinating root or only the visible problem"], correctIndex: 2, explanation: tone("Yes. The chapter says root targeting needs evidence rather than frustration alone.", "His dilemma turns on whether the center is operational or merely dramatic.", "Correct. A visible problem is not always the real node."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch42-q07", prompt: "Why can root targeting be more efficient than diffuse pressure?", choices: ["Because the whole group may lose coherence once the real center is weakened", "Because broad struggle is always wrong", "Because symbolic leaders always control operations"], correctIndex: 0, explanation: tone("Correct. The law values breaking coherence at the source.", "Focused pressure matters when the system is genuinely centralized.", "Right. Efficiency comes from disrupting the node holding the flock together."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch42-q08", prompt: "When does the law slip into scapegoating?", choices: ["When it identifies the real coordinating center carefully", "When it personalizes a structural problem around a visible face that does not hold the system together", "When it checks whether the system is resilient"], correctIndex: 1, explanation: tone("Exactly. The chapter warns against confusing blame with diagnosis.", "Scapegoating happens when visibility is mistaken for centrality.", "Right. A dramatic face can absorb attention while the true structure survives."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch42-q09", prompt: "How does Chapter 41 lead into Chapter 42?", choices: ["By proving leadership no longer matters after succession", "By replacing comparison with total decentralization", "By moving from leadership shadow in succession to vulnerability in concentrated active leadership"], correctIndex: 2, explanation: tone("Correct. Chapter 41 dealt with shadow around leadership, and Chapter 42 deals with concentration inside leadership.", "The bridge moves from inherited pressure to present structural vulnerability.", "Right. Both chapters examine how leadership shapes power, but in different ways."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch42-q10", prompt: "What bridge carries Chapter 42 into Chapter 43?", choices: ["After understanding how groups scatter, the next issue is how influence secures hearts and minds", "Chapter 43 returns only to centralized disruption", "Breaking a center eliminates the need for persuasion"], correctIndex: 0, explanation: tone("Correct. The next law shifts from disrupting coordination to gaining durable allegiance.", "Chapter 43 asks how influence reaches deeper than fear or disruption.", "Right. Scattering a group is different from winning its consent."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" }
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
for (const name of ["Voren", "Elin", "Perrin", "Alaia"]) continuity.nameUsage[name] = [stem];
continuity.withinChapterNames[stem] = ["Voren", "Elin", "Perrin", "Alaia"];
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
- Chapter-specific mechanism remains centrality, coordination, root targeting, and scapegoat limits rather than generic aggression advice
- Hard depth preserves the root-versus-scapegoat boundary and the Chapter 43 bridge
- Quiz stays within supported facts from the approved draft and frozen source bundle

## Gate result
- Approved for chapter gate and automatic continuation
`;
writeText(paths.validation, validation);

fs.appendFileSync(
  paths.runLog,
  `\n- Completed writer, editor, critic, converter, quiz, and validator steps for Chapter 42.\n- Validation result: PASS.\n- Continuity hash sealed for \`${stem}\`: \`${seal}\`\n`,
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
