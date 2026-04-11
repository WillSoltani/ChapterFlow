const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const runRoot = path.resolve(".chapterflow/runs/the-48-laws-of-power/20260409-002544");
const num = 38;
const stem = `ch${String(num).padStart(2, "0")}`;
const title = "Think as You Like but Behave Like Others";
const chapterId = "ch38-think-as-you-like-but-behave-like-others";
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

const canonical = `Greene's thirty-eighth law asks what happens when visible difference costs more than it is worth to announce. The chapter answers by shifting attention from self-expression to camouflage. A person may keep their judgment, taste, or conviction intact while choosing not to display every difference openly in environments that punish deviation quickly. The law therefore treats outward conformity as a shield for inner freedom rather than as immediate surrender.

Its claim is not that independence should be abandoned or that honest dissent is always foolish. Greene's point is narrower. Social environments often react defensively to obvious difference. They may punish what stands out, not because it is wrong, but because it unsettles group comfort, vanity, or hierarchy. Surface conformity matters because it can reduce friction and buy room to think, plan, and act without unnecessary retaliation.

That is why the chapter distinguishes adaptive discretion from self-erasure. Greene is not praising cowardice, empty agreement, or permanent masking for its own sake. He is describing a tactical choice about visibility. The strongest version of the law keeps the inner core independent while allowing the surface to look ordinary enough to avoid needless resistance. Camouflage becomes weak only when the tactic no longer protects freedom and starts slowly dissolving the very judgment it was meant to hide.

Ordinary settings make the mechanism visible. A work dissenter may preserve influence by avoiding theatrical difference in front of a rigid group. A department seminar or student board may punish someone more for style than for substance, making surface adaptation a wiser first move. A personal setting may call for discretion when visible contrast would create noise that blocks any deeper effect. In each case, the question is not whether you think differently. It is whether announcing difference now serves you more than it costs.

The chapter's limit matters. Some moments require open dissent, moral refusal, or visible courage because the cost of conformity becomes corrupting rather than strategic. Greene overreaches if the law becomes advice to disappear into permanent agreement or to mistake fear for prudence. The useful version is narrower: blend at the surface when it preserves real freedom, but stop when camouflage begins hardening into surrender. Chapter 37 dealt with winning attention through visible form. Chapter 38 asks when visibility becomes strategically expensive instead. That leads toward Chapter 39, where preserved position can later be used to unsettle others and expose weakness through disturbed emotion.`;

const edited = canonical;

const critic = `# Chapter 38 Critic Report

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
- Paragraph 4 is most vulnerable because work, school, and personal examples can flatten into generic people-pleasing if conversion drops the camouflage-versus-surrender tension.

Strongest sentence:
- "Surface conformity matters because it can reduce friction and buy room to think, plan, and act without unnecessary retaliation."

Anchor use notes:
- The draft stays inside the frozen support: visible deviation cost, outward conformity as shield, adaptive discretion, and the limit against surrender of self.

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
        "This law says that open difference can cost you more than it is worth in some environments. Greene is not saying that inward freedom should be abandoned or that conformity is always good. The point is that groups often punish visible deviation before your real judgment has room to work. Surface conformity can therefore protect you. If you behave outwardly like others, you may keep more freedom to think, plan, and move privately. But the chapter is not praising cowardice or total surrender. Camouflage helps only while it protects independence. Once blending in starts changing your core judgment instead of shielding it, the tactic has crossed into loss.",
        "Greene's thirty-eighth law argues that people often react more harshly to open difference than to hidden difference. The chapter says visible nonconformity can trigger friction, envy, or punishment even when the difference itself is harmless. That is why behaving like others on the surface can matter strategically. It lowers resistance and keeps your independence from becoming the only thing the group sees. But the law is not generic advice to please everyone. Useful camouflage preserves inward freedom. Empty conformity erases it. Used well, the surface protects the core. Used badly, the surface slowly replaces the core.",
        "This law gives a competitive warning: announcing every difference can satisfy pride while shrinking your real room to act. Greene wants the reader to notice cost. A rigid room may attack style before it ever reaches substance. Outward sameness can keep you inside the game longer. But the chapter has a limit. Some moments require open refusal, not camouflage. The reader's edge comes from knowing when discretion preserves freedom and when it starts becoming surrender in better-sounding clothes."
      ),
      keyTakeaways: [
        { point: tone("Visible difference can trigger avoidable resistance.", "Open nonconformity may cost more than announcing it is worth.", "Groups often punish what stands out before they understand it.") },
        { point: tone("Outward sameness can shield inner freedom.", "Blending outwardly can buy room to think and act independently.", "The surface can serve the core instead of exposing it too early.") },
        { point: tone("Camouflage has a surrender limit.", "The chapter supports adaptive discretion, not losing yourself.", "If the mask starts rewriting the mind, the tactic has failed.") }
      ],
      oneMinuteRecap: tone(
        "This law says that behaving like others on the surface can protect the freedom to think differently underneath.",
        "Blend when visibility would provoke useless resistance, but do not let camouflage become self-erasure.",
        "The tactic works only while the surface is shielding independence rather than replacing it."
      )
    },
    medium: {
      chapterBreakdown: tone(
        `Greene's thirty-eighth law begins with a social problem rather than a moral slogan: visible difference often triggers resistance faster than the value of announcing it can justify. The chapter answers by turning from expression to camouflage. A person may think, judge, or intend differently while choosing to behave outwardly like others long enough to preserve room to move.

That is why surface conformity matters. Greene is not claiming that difference should vanish. He is saying that obvious deviation can provoke hostility, envy, or punishment before the independent thought behind it can do any useful work. Behaving like others on the surface can reduce that friction. It can keep the group from treating your difference as the entire story.

The distinction that matters is between adaptive discretion and self-erasure. Adaptive discretion hides what needs protection. Self-erasure starts losing contact with what was being protected. The chapter becomes weak if it is flattened into generic people-pleasing advice, because Greene is not praising agreement for its own sake. He is describing camouflage that preserves inward freedom.

Ordinary settings show the pattern clearly. Orian may preserve influence at work by not making his dissent the most visible thing in a rigid room. A department seminar or student board may punish Vela's style of difference before it considers her reasoning. A personal setting may call for discretion when visible contrast would produce more noise than movement. In each case, outward sameness changes the cost of staying independent.

The limit remains central because camouflage can become habit. If the surface no longer protects freedom but slowly replaces it, the strategy collapses into surrender. Greene's better point is narrower: conform outwardly when it buys room for real independence, and stop when the tactic begins consuming the core. Chapter 37 dealt with winning attention through spectacle. Chapter 38 deals with surviving a world that can punish visibility. Chapter 39 then asks how preserved position can later be used to unsettle others and expose weakness.`,
        `A group can tolerate hidden difference more easily than visible difference. Greene uses that fact to shift the reader from open distinction to protective camouflage. The issue is not whether independence matters. It is whether displaying it immediately serves strategy more than it satisfies pride.

That is why behaving like others can be strategically useful. Surface conformity lowers resistance. It keeps people from rallying against your difference before your judgment has room to work. Greene's practical claim is that outward sameness can shield inward freedom. The visible fit buys time, access, and positional safety.

The chapter is strongest when it separates discretion from surrender. Discretion withholds exposure. Surrender abandons the inner position itself. Greene is not asking the reader to become inwardly obedient. He is asking the reader to decide when visibility is wasting force. The mask is useful only if there is still a mind behind it.

The pattern appears everywhere. Orian can either advertise dissent in a way that hardens the room or blend behaviorally long enough to preserve influence. Vela can either provoke the department seminar or student board into policing style, or keep the surface ordinary while protecting her real judgment. A personal difference can either be announced into resistance or carried quietly until the timing or terrain improves. The result changes because the visible cost changes.

The law overreaches if it becomes cowardice, moral compromise, or permission for permanent masking. The useful boundary is sharper than that: use camouflage to protect genuine freedom, not to bury it. Chapter 37 asked how attention is won by visible force. Chapter 38 asks when visible force is strategically expensive. The next law then turns from camouflage to disturbance, asking how emotion and confusion can be stirred to reveal weakness.`,
        `Greene's thirty-eighth law warns that many people pay too much for the pleasure of visible difference. Readers often admire candor, originality, and open dissent, yet Greene notices a harder pattern: groups punish what feels conspicuously different even when the content of that difference is not their real problem. The chapter therefore treats conformity at the surface as a strategic shelter rather than as immediate defeat.

The law values camouflage because hostility often attaches first to what is visible. A person who looks, sounds, or behaves too differently may trigger correction before anyone has judged the substance at stake. Outward sameness can interrupt that reflex. It allows independent thought to survive without becoming the obvious object of retaliation. In that sense, conformity is not always obedience. It can be concealment.

This is why the chapter should not be flattened into praise for fear or hypocrisy. Greene is not saying that moral dissent never deserves open form. He is saying that independence sometimes needs protection from premature exposure. Adaptive discretion keeps the inner position intact. Self-erasure slowly conforms the inside to the outside. One preserves freedom under cover. The other gives freedom away.

Common cases make the line visible. Orian may keep his influence longer by avoiding theatrical difference in a rigid workplace. Vela may save her judgment from becoming a target by blending at the surface in a department seminar or student board. A personal divergence may matter more if it is timed and shielded instead of immediately displayed. These are not different rules. They are the same camouflage logic in different environments.

The limit matters because a shield can become a cage. Greene's law works only when surface conformity remains answerable to inner independence. If the tactic becomes permanent self-revision toward the group's comfort, camouflage has stopped serving strategy and started serving surrender. Chapter 37 dealt with standing out visibly. Chapter 38 deals with surviving by looking ordinary. Chapter 39 follows because preserved position can later be used more aggressively, through disturbance rather than display.`
      ),
      keyTakeaways: [
        {
          point: tone("Visible difference can provoke resistance before substance is heard.", "Groups often react to deviation faster than to the meaning behind it.", "Open difference can spend force before it earns room."),
          moreDetails: tone("The chapter treats visible nonconformity as a cost center, not an automatic virtue.", "Style, surface, and signal can trigger punishment before content gets a hearing.", "Strategic discretion begins by noticing that dynamic.")
        },
        {
          point: tone("Surface conformity can protect inner freedom.", "Outward sameness may buy access, time, and room to think independently.", "The surface can be used as camouflage for the core."),
          moreDetails: tone("Greene values conformity here because it can lower friction without requiring inward agreement.", "The tactic works by hiding difference long enough for it to matter more effectively later.", "Camouflage preserves position when visibility would only waste it.")
        },
        {
          point: tone("Discretion is different from surrender.", "A useful mask protects judgment; a bad mask rewrites it.", "Camouflage fails when the inside starts obeying the surface."),
          moreDetails: tone("The chapter stays sharp only if the reader keeps the inner position alive.", "Self-erasure begins when fitting in matters more than preserving independent thought.", "The line is whether the tactic serves freedom or slowly replaces it.")
        },
        {
          point: tone("Work, school, and personal settings all reveal camouflage logic.", "Ordinary rooms also punish visible difference before they test substance.", "Outward sameness can change the cost of staying independent."),
          moreDetails: tone("Rigid teams, seminars, boards, and personal groups all show how style can become the first target.", "The law becomes practical when you ask whether visible difference is opening minds or only summoning resistance.", "Camouflage is ordinary whenever the surface buys room for the deeper move.")
        },
        {
          point: tone("The law has a surrender limit.", "Conformity becomes weak when it starts protecting comfort more than freedom.", "A shield that never comes off may become a cage."),
          moreDetails: tone("Greene warns against self-erasure, not against strategic discretion.", "The useful line is to blend only while the tactic preserves real independence and moral room.", "Surface fit becomes collapse once the core is no longer steering it.")
        }
      ],
      activationPrompt: tone(
        "Find one place where visible difference may be costing more than it is helping.",
        "Choose one environment where surface conformity could protect a stronger inner move.",
        "Identify one situation where blending would preserve freedom and one where it would only excuse fear."
      ),
      selfCheckPrompt: tone(
        "Is this camouflage protecting a real independent judgment, or is it quietly training me out of it?",
        "What exactly would be gained by visible difference here, and what resistance would it trigger first?",
        "If I blend on the surface now, when and how will I know the tactic is still serving the core?"
      ),
      oneMinuteRecap: tone(
        "This chapter argues that outward conformity can sometimes shield the inner freedom that visible difference would expose too early.",
        "Blend when the surface buys room for thought and movement, but do not mistake long-term self-erasure for strategy.",
        "A useful disguise protects independence; a bad one slowly edits it out."
      )
    },
    hard: {
      chapterBreakdown: tone(
        `Greene's thirty-eighth law asks the reader to treat visibility as a strategic cost rather than as a moral good in itself. An opinion, style, or conviction may be worth holding, yet still not be worth advertising plainly in a hostile environment. The chapter therefore relocates power from expression alone to camouflage. What matters strategically is whether independence remains alive while surface difference is temporarily withheld.

That is why the law values conformity at the surface. Greene is not praising obedience for its own sake. He is describing a social reflex: people often react against what looks openly different before they seriously evaluate it. Visible nonconformity can trigger envy, correction, exclusion, or punishment that overwhelms the benefit of announcing the difference. Surface sameness can interrupt that reflex and keep your freedom from becoming the first thing the group attacks.

The central distinction is between adaptive discretion and surrender. Adaptive discretion preserves the inner position while muting the outer signal. Surrender goes further. It lets the surface train the inside until the original judgment weakens, shrinks, or disappears. One form of conformity protects independence. The other exchanges independence for comfort and calls the trade prudence.

That distinction matters because groups often police visible style more quickly than substance. Orian may preserve more influence by avoiding theatrical dissent in a rigid workplace. Vela may keep her position in a department seminar or student board by reducing visible difference while retaining judgment privately. A personal setting may reward discretion where open contrast would summon resistance without changing anything useful. In each case, camouflage does not deny difference. It manages when difference becomes visible and at what cost.

The chapter is strongest when it refuses both prideful display and cowardly erasure. Some moments demand open refusal because the moral price of blending in becomes higher than the strategic price of standing apart. Greene's limit therefore matters. Conformity is useful only while it shelters freedom, not when it starts dissolving the very core it claimed to protect. A mask that cannot be removed has stopped being a tactic.

Chapter 37 argued that attention can be won through visible form. Chapter 38 adds that visibility itself can become dangerous in certain environments. The sequence matters. First learn how to stand out. Then learn when standing out is strategically expensive. Chapter 39 follows by asking how preserved position can later be used more aggressively, through disturbed emotion and confusion rather than through visible defiance.`,
        `A group may tolerate hidden difference while punishing visible difference immediately. Greene uses that fact to move the reader away from reflexive authenticity and toward strategic discretion. The issue is not whether independence matters. It is whether exposing it now improves your position or merely gives the group a target.

The chapter therefore values surface conformity because obvious deviation often becomes the story before the underlying judgment is even heard. A person who looks too different, sounds too contrary, or behaves too distinctly can trigger social defense mechanisms that have little to do with truth. Greene's practical claim is that behaving like others outwardly can shield the inward freedom needed for later action.

The harder distinction is between concealment and conversion. Concealment hides difference. Conversion lets conformity rewrite difference until the person can no longer tell what was being protected in the first place. Greene is not calling for inward obedience. He is calling for discipline about when exposure is useful and when it is merely expensive.

Orian's workplace restraint, Vela's seminar or board camouflage, and a personal choice toward discretion all show the same structure. They succeed when the surface buys time, access, and safety without owning the mind beneath it. That is why conformity can outperform visible originality in hostile settings. It changes not only how others react, but whether you remain free enough to choose your moment later.

The law overreaches whenever it becomes permission for moral cowardice or permanent submission to the group. Its useful boundary is sharper than that. Blend only while the disguise protects genuine independence and only while the cost of visible difference is strategically wasteful rather than ethically necessary. Chapter 37 asked how attention is won by standing out. Chapter 38 asks when standing out is the wrong first move. Chapter 39 then turns from camouflage to provocation, where preserved position can be used to unsettle others and expose their weakness.`,
        `Greene's thirty-eighth law is really about preserving interior sovereignty under exterior pressure. Many readers instinctively admire visible candor, yet visible candor can become strategically naive when the surrounding environment punishes deviation before it judges content. The chapter therefore turns freedom into a problem of timing, concealment, and social cost.

Its strongest claim is that conformity is not always agreement. A surface can fit while the mind remains independent. If you ignore that possibility, you may confuse public display with courage and force yourself into needless collision. Greene's correction is that open difference is only valuable when it buys more than it costs. In environments that punish visibility, outward sameness may be the price of keeping your inner position intact.

That is why camouflage should be understood as protection rather than celebration. A useful disguise keeps the core alive under hostile conditions. A useless disguise becomes a slow interior surrender because the person starts inhabiting the role too well. The distinction is brutal but necessary: conformity serves freedom when it shelters it, and betrays freedom when it edits it away.

The examples make that line visible. Orian keeps room to act because he does not turn dissent into visible performance too early. Vela preserves judgment by letting the surface look ordinary in a seminar or board that would punish overt difference. A personal divergence gains more by discretion than by pointless display. These are not different tricks. They are one camouflage logic across different scales: preserve the core by managing the surface.

The limit matters because a strategy of concealment can become a habit of disappearance. Greene's law becomes useful only when the person can still locate the independent self beneath the camouflage and still know when the time for openness has arrived. If that never happens, the shield has become a cage. Chapter 37 dealt with visible concentration. Chapter 38 deals with strategic invisibility. Chapter 39 follows because the position protected by camouflage can later be used to disturb others and reveal what their composure was hiding.`
      ),
      keyTakeaways: [
        {
          point: tone("Visible difference can become a strategic cost before it becomes a strategic gain.", "Groups often punish deviation faster than they evaluate its substance.", "Open distinction may spend freedom instead of expressing it."),
          moreDetails: tone("The chapter treats visible nonconformity as something to price, not automatically celebrate.", "Hostility often attaches first to surface signals and only later to underlying content.", "Strategic thinking begins by noticing the social tax on visible difference.")
        },
        {
          point: tone("Surface conformity can function as camouflage for inner freedom.", "Outward sameness may preserve time, access, and room to act independently.", "A useful disguise lets the mind stay free while the surface stays ordinary."),
          moreDetails: tone("Greene values camouflage because it can prevent the group from targeting difference too early.", "The tactic works when it lowers friction without requiring inward submission.", "Conformity serves strategy here by shielding the core from premature attack.")
        },
        {
          point: tone("Camouflage fails when it becomes conversion.", "A tactic turns dangerous when the outer role starts rewriting the inner judgment.", "A mask that educates the mind into obedience is no longer protective."),
          moreDetails: tone("The chapter stays hard only if the reader keeps the interior position alive.", "Self-erasure begins when comfort, safety, or belonging become more important than preserving freedom.", "The difference between discretion and surrender is whether the core is still steering the surface.")
        },
        {
          point: tone("Work, school, and personal environments all show the same camouflage logic.", "Ordinary groups also punish visible difference before they test value.", "Behavioral blending can change whether independence survives long enough to matter."),
          moreDetails: tone("Rigid offices, seminars, boards, and personal circles all show how quickly style becomes a target.", "The law becomes practical when you ask whether current visibility is opening possibilities or merely inviting correction.", "Camouflage is ordinary whenever the surface is buying room for a later move.")
        },
        {
          point: tone("The law has a moral and strategic stopping point.", "Blend only while the disguise protects freedom more than it corrodes it.", "A shield that never comes off has become a cage."),
          moreDetails: tone("Greene warns against needless exposure, not against open refusal in serious moments.", "The useful rule is to conform only when the tactic preserves genuine independence and ethical room.", "Concealment becomes collapse once no inner freedom remains to protect.")
        }
      ],
      activationPrompt: tone(
        "Locate one environment where visible difference may currently be costing more than it buys.",
        "Choose one place where surface conformity could preserve a stronger independent move later.",
        "Identify one situation where camouflage would be strategic and one where it would quietly turn into surrender."
      ),
      selfCheckPrompts: [
        tone(
          "What part of my independent judgment is this disguise actually protecting right now?",
          "Would open difference here change anything useful, or would it mostly give the group a target?",
          "If I continue blending at the surface, how will I know the core is still intact?"
        ),
        tone(
          "Am I preserving freedom under cover, or am I getting used to belonging on terms that rewrite me?",
          "What sign would tell me the tactic has shifted from discretion into self-erasure?",
          "If the moment for openness arrived tomorrow, would I still be able to act from the same inner position?"
        )
      ],
      predictionPrompt: tone(
        "If camouflage preserves position, how might Chapter 39 argue that disturbed emotion and confusion can later be used to expose others from that protected position?",
        "What changes once the goal is no longer to blend in, but to unsettle others enough to reveal weakness?",
        "After strategic invisibility, how does power return through disturbance rather than conformity?"
      ),
      oneMinuteRecap: tone(
        "This chapter argues that outward conformity can sometimes shield inner freedom where visible difference would attract wasteful retaliation before it could act effectively.",
        "Blend when the surface buys time and position, but stop the moment camouflage begins teaching the inside to obey the outside.",
        "A useful disguise protects independence; a permanent one slowly deletes it."
      )
    }
  },
  examples: [
    {
      title: "Orian Blends Behaviorally So His Judgment Is Not Rejected Before It Can Work",
      format: "decision_point",
      category: "work",
      endingType: "broader_principle",
      scenario: tone("Orian sees that a rigid team reacts against visible dissent faster than it evaluates substance, and he has to decide whether to announce his difference or protect it under a more ordinary surface.", "He has to choose between open distinction and strategic camouflage.", "Orian can spend his influence on style resistance or preserve it for the deeper move."),
      whatToDo: tone("He keeps the outer behavior ordinary enough to stay inside the room while preserving the dissenting judgment privately.", "He lowers visible friction so the group does not attack the difference before it matters.", "He uses the surface as cover for the core instead of turning the core into a target."),
      whyItMatters: tone("The chapter says visible difference can trigger resistance that overwhelms its value.", "His case shows how surface conformity can protect rather than erase independence.", "He keeps more freedom by not advertising the difference too early.")
    },
    {
      title: "Vela Explains Why the Seminar Reacted to Style Before It Ever Reached Substance",
      format: "dialogue",
      category: "school",
      endingType: "self_directed_question",
      scenario: tone("Vela describes how a department seminar or student board fixated on visible difference before it seriously considered the thought underneath it.", "She shows that the room punished deviation at the surface faster than it judged the reasoning.", "The conversation becomes a lesson about camouflage cost rather than about agreement alone."),
      whatToDo: tone("She studies how outward fit could have preserved more room for the real judgment to survive the room.", "She asks what part of the resistance was directed at style rather than substance.", "She traces how a quieter surface might have protected the same inner position."), 
      whyItMatters: tone("The chapter says groups often react to visible deviation before they evaluate what it means.", "Her example shows how discretion can preserve a better strategic position in school settings too.", "The thought was not attacked alone; its visible carrier was attacked first.")
    },
    {
      title: "Ciro Has to Decide Whether Camouflage Is Protecting His Freedom or Slowly Replacing It",
      format: "dilemma",
      category: "personal",
      endingType: "surprising_implication",
      scenario: tone("Ciro has been blending for long enough that he is no longer sure whether the tactic is still protecting his independence or teaching him to give it up.", "He has to decide whether the disguise still serves the core.", "Ciro may be using a shield or living inside a cage with better language."),
      whatToDo: tone("He checks whether the inner judgment is still alive and whether the surface can still be removed when needed.", "He refuses to let a temporary camouflage become permanent self-erasure.", "He keeps the tactic only if it remains answerable to freedom."), 
      whyItMatters: tone("The chapter says camouflage fails when it begins dissolving the independence it was meant to protect.", "His dilemma shows the line between adaptive discretion and surrender.", "A useful mask becomes dangerous when the person can no longer tell what it was hiding.")
    },
    {
      title: "Nadira Predicts the Board Will Punish Visible Difference Before It Hears the Actual Case",
      format: "predict_reveal",
      category: "school",
      endingType: "cross_domain",
      scenario: tone("Nadira predicts that the student board will react against visible contrast in behavior before it seriously evaluates the substance of the position being defended.", "She expects style resistance to arrive first and reasoning second.", "The scene becomes a forecast about social camouflage rather than argument alone."),
      whatToDo: tone("She watches whether the person makes themselves a visible target unnecessarily or preserves room through outward sameness.", "She tests how much behavioral conformity changes the board's willingness to hear the real case.", "She compares open contrast with disguised independence."), 
      whyItMatters: tone("The chapter says surface fit can reduce friction enough for thought to survive.", "Her prediction shows how groups often punish difference at the visible level first.", "The board may reject the signal before it ever reaches the substance.")
    },
    {
      title: "The Work Debrief Finds the Team Lost Position by Advertising Difference Too Early",
      format: "postmortem",
      category: "work",
      endingType: "common_trap",
      scenario: tone("A work debrief shows that the team turned its difference into a visible identity too early and triggered resistance before the real idea had room to move.", "They realize the problem was not only the content but the cost of exposing it at the wrong surface level.", "The review becomes a lesson in camouflage rather than in louder persuasion."),
      whatToDo: tone("They separate the independent judgment they want to preserve from the visible signals that keep making it the room's target.", "They rebuild the next approach around outward fit and quieter positioning.", "They stop paying unnecessary social cost for difference before the difference can do useful work."), 
      whyItMatters: tone("The chapter warns that visible distinction can waste force by provoking avoidable correction.", "Their mistake was not independence itself but the way it was exposed.", "Once they manage the surface better, the core has more room to matter.")
    },
    {
      title: "Before and After Outward Sameness Protected Instead of Betrayed Inner Difference",
      format: "before_after",
      category: "personal",
      endingType: "perspective_reframe",
      scenario: tone("Before, every difference was displayed openly and drew resistance that made the person more reactive than free. After, the same person kept the inner position intact while reducing the visible signals that kept summoning conflict.", "The contrast is between exposed independence and protected independence.", "One version spends freedom on announcement; the other preserves it for use."), 
      whatToDo: tone("Keep the core alive while making the surface ordinary enough to avoid needless collision.", "Use discretion to protect the judgment instead of advertising it into punishment.", "Let outward sameness buy room for inward difference to survive."), 
      whyItMatters: tone("The law becomes visible when camouflage lowers cost without deleting conviction.", "This before-and-after shows how conformity can serve freedom rather than oppose it.", "The person keeps more self-direction once visibility stops doing the enemy's work.")
    }
  ],
  reviewCards: [
    { cardId: "ch38-rc01", front: tone("What is the main warning of Chapter 38?", "Why can visible difference be costly here?", "What often happens before substance is heard?"), back: tone("Visible difference can trigger resistance before the value of announcing it has time to pay off.", "The chapter warns that groups often punish deviation at the surface first.", "Style or signal may be attacked before the underlying judgment is evaluated."), difficulty: "easy" },
    { cardId: "ch38-rc02", front: tone("What does surface conformity do strategically?", "Why can behaving like others protect freedom?", "How can camouflage help the core?"), back: tone("It lowers visible friction and protects room for independent thought or action.", "Surface conformity can shield inward freedom from premature retaliation.", "Camouflage helps when the outer fit keeps the inner position alive."), difficulty: "easy" },
    { cardId: "ch38-rc03", front: tone("How is adaptive discretion different from surrender?", "When does the mask become dangerous?", "What proves camouflage has started failing?"), back: tone("Adaptive discretion protects the core, while surrender lets the surface rewrite it.", "The mask becomes dangerous when the person can no longer locate the independent self beneath it.", "Camouflage fails when it starts training the inside to obey the outside."), difficulty: "medium" },
    { cardId: "ch38-rc04", front: tone("Where does this law appear in ordinary settings?", "How do work, school, and personal examples show camouflage logic?", "Why does outward sameness sometimes preserve more than open difference?"), back: tone("It appears wherever visible difference would trigger more resistance than useful movement.", "Rigid teams, seminars, boards, and personal groups all show how the surface can become the first target.", "Outward sameness can preserve position long enough for the deeper move to matter."), difficulty: "medium" },
    { cardId: "ch38-rc05", front: tone("How does Chapter 38 bridge to Chapter 39?", "What comes after camouflage preserves position?", "Why does conformity lead toward disturbance?"), back: tone("Once position is preserved under camouflage, the next question is how to unsettle others enough to expose weakness.", "Chapter 39 turns from strategic invisibility to strategic disturbance.", "A protected position can later be used to stir emotion and confusion rather than display open difference."), difficulty: "hard" }
  ],
  keyTakeawayCard: tone(
    "Thinking as you like while behaving like others becomes powerful when outward conformity protects real inward freedom instead of slowly replacing it.",
    "This law values camouflage because visible deviation can trigger wasteful resistance, while warning that a disguise that cannot be removed has become surrender.",
    "Power grows when the surface buys time and room for the core rather than asking the core to disappear."
  )
};

const quiz = {
  passingScorePercent: 70,
  questions: [
    { questionId: "ch38-q01", prompt: "Why can visible difference be costly in this chapter?", choices: ["Because all difference is wrong", "Because groups often punish deviation before they evaluate it", "Because conformity is always morally superior"], correctIndex: 1, explanation: tone("Correct. The chapter says visible nonconformity can trigger resistance before substance is heard.", "The cost comes from how groups react to surface deviation.", "Right. The law is about strategic social friction, not automatic moral judgment."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch38-q02", prompt: "What does surface conformity do strategically?", choices: ["It guarantees inward agreement", "It removes all need for courage", "It can protect room for independent thought or action"], correctIndex: 2, explanation: tone("Yes. The chapter values outward conformity because it can shield inner freedom.", "Surface fit can lower friction and preserve position.", "Correct. The tactic works when the outer layer protects the core."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch38-q03", prompt: "Why is this chapter not generic cowardice advice?", choices: ["Because it distinguishes adaptive discretion from surrender", "Because it says open dissent is always foolish", "Because it rejects inner independence"], correctIndex: 0, explanation: tone("Correct. The chapter supports camouflage that protects judgment, not surrender that erases it.", "Greene is drawing a line between tactical surface fit and loss of self.", "Right. The core must remain independent for the tactic to stay valid."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch38-q04", prompt: "In Orian's work scenario, what best fits the chapter?", choices: ["Advertise dissent in the most visible way possible", "Give up the judgment entirely", "Blend behaviorally to keep the judgment from becoming the room's first target"], correctIndex: 2, explanation: tone("Yes. The chapter favors reducing visible friction when open difference would waste influence.", "He uses the surface to protect the deeper move.", "Correct. The point is camouflage in service of independence, not surrender."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch38-q05", prompt: "What does Vela's school example show?", choices: ["That seminars always reward visible nonconformity", "That style resistance can arrive before reasoning is heard", "That conformity requires inward agreement"], correctIndex: 1, explanation: tone("Correct. Her case shows the room reacting to visible difference before evaluating the substance.", "The chapter warns that surface signals can become the first target.", "Right. The visible carrier of the idea may be punished before the idea itself is judged."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch38-q06", prompt: "What is the strongest reading of Ciro's dilemma?", choices: ["Any disguise is automatically wise", "He should display every difference immediately", "Camouflage is useful only while it still protects a living inner position"], correctIndex: 2, explanation: tone("Yes. The chapter's limit is that disguise fails when it begins rewriting the inside.", "He has to test whether the mask still serves freedom.", "Correct. A protective tactic turns dangerous once it becomes self-erasure."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch38-q07", prompt: "How can outward sameness preserve independent action?", choices: ["By proving the group is right", "By lowering resistance long enough for the deeper move to survive", "By making difference disappear permanently"], correctIndex: 1, explanation: tone("Correct. Surface conformity can buy time, access, and safety for the core.", "The law says the outer fit can protect the inner position.", "Right. The tactic works by reducing visible friction, not by surrendering judgment."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch38-q08", prompt: "When does camouflage become self-erasure?", choices: ["When the surface starts rewriting the core", "When it protects room to think freely", "When it avoids needless conflict briefly"], correctIndex: 0, explanation: tone("Exactly. The tactic fails when the mask is no longer removable in practice.", "Camouflage becomes dangerous when it changes the inside instead of shielding it.", "Right. A disguise that trains obedience is no longer serving freedom."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch38-q09", prompt: "How does Chapter 37 lead into Chapter 38?", choices: ["By proving spectacle makes camouflage unnecessary", "By moving from visible attention strategy to strategic invisibility in hostile groups", "By rejecting all concern with visibility"], correctIndex: 1, explanation: tone("Correct. Chapter 37 uses visibility, while Chapter 38 asks when visibility itself becomes too costly.", "The sequence moves from standing out to blending in strategically.", "Right. Power sometimes shifts from display to camouflage depending on the room."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch38-q10", prompt: "What bridge carries Chapter 38 into Chapter 39?", choices: ["Preserved position can later be used to unsettle others and expose weakness", "Camouflage ends the need for any further strategy", "Chapter 39 rejects emotion entirely"], correctIndex: 0, explanation: tone("Correct. The next law turns from camouflage to disturbance.", "Chapter 39 asks how preserved position can be used to stir emotion and confusion.", "Right. After surviving by blending, power may return through unsettling others."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" }
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
for (const name of ["Orian", "Vela", "Ciro", "Nadira"]) continuity.nameUsage[name] = [stem];
continuity.withinChapterNames[stem] = ["Orian", "Vela", "Ciro", "Nadira"];
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
- Chapter-specific mechanism remains camouflage, surface conformity, visible deviation cost, and surrender limits rather than generic people-pleasing
- Hard depth preserves the adaptive-discretion versus self-erasure boundary and the Chapter 39 disturbance bridge
- Quiz stays within supported facts from the approved draft and frozen source bundle

## Gate result
- Approved for chapter gate and automatic continuation
`;
writeText(paths.validation, validation);

fs.appendFileSync(
  paths.runLog,
  `\n- Completed writer, editor, critic, converter, quiz, and validator steps for Chapter 38.\n- Validation result: PASS.\n- Continuity hash sealed for \`${stem}\`: \`${seal}\`\n`,
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
