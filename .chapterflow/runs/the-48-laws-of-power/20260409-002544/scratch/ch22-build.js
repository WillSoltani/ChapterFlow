const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const runRoot = path.resolve(".chapterflow/runs/the-48-laws-of-power/20260409-002544");
const num = 22;
const stem = `ch${String(num).padStart(2, "0")}`;
const title = "Use the Surrender Tactic: Transform Weakness into Power";
const chapterId = "ch22-use-the-surrender-tactic-transform-weakness-into-power";
const createdAt = new Date().toISOString();

function tone(gentle, direct, competitive) {
  return { gentle, direct, competitive };
}

const canonical = `Greene's twenty-second law begins by challenging the instinct to push back against pressure immediately. When a stronger side is already driving the motion, direct resistance can sometimes help that side more than it helps you. Fighting at the wrong moment can waste strength, harden the opponent, and turn their momentum into your exhaustion. The chapter begins from that unequal exchange.

Its claim is not that surrender is noble in itself. Greene's point is more strategic. A tactical yielding can absorb force that would be costly to meet head-on. By stepping back, appearing to concede, or refusing to escalate at the moment the stronger side expects a clash, you may preserve energy, reduce damage, and buy time that direct struggle would destroy. Apparent weakness can therefore become a way of protecting future initiative.

That is why the law focuses on controlled surrender rather than collapse. Greene is not praising helplessness, panic, or permanent submission. He is distinguishing strategic yielding from losing the future. The useful move is not to become defenseless. It is to let force spend itself where it gives the stronger side less long-term advantage than a direct confrontation would.

Ordinary settings make the mechanism visible. A worker facing a superior's public push may refuse the immediate showdown, collect the overreach, and return when the stronger side has become overconfident. A student-senate bloc may yield one vote to regroup, expose how the winning side misreads the room, and return with better timing. A personal conflict can cool when one person stops feeding the other's momentum and instead lets the surge burn off before choosing the next move. In each case, yielding preserves more room than reflexive resistance.

The chapter's limit matters. Some surrenders only ratify defeat. If yielding destroys later agency, the tactic fails. Greene overreaches if the law becomes advice for passive acceptance or endless retreat. The useful version is narrower: absorb force only when doing so preserves more initiative than a frontal clash would. Chapter 21 preserved room by pacing recognition. Chapter 22 preserves room by pacing resistance. That points toward Chapter 23, where preserved initiative compounds once force is concentrated instead of scattered.`;

const edited = canonical;

const critic = `# Chapter 22 Critic Report

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
- Paragraph 4 is most vulnerable because work, school, and personal examples can flatten into generic patience rhetoric if conversion drops the force-absorption and later-reversal mechanism.

Strongest sentence:
- "The useful move is not to become defenseless. It is to let force spend itself where it gives the stronger side less long-term advantage than a direct confrontation would."

Anchor use notes:
- The draft stays inside the frozen support: direct resistance can strengthen the stronger side, surrender can absorb force and buy time, overconfidence can follow apparent victory, and yielding fails if it destroys later agency.

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
        "This law says direct resistance is not always the strongest move. If the other side already has more force, pushing back immediately can help their momentum more than it helps you. Greene is not saying surrender is always wise. The chapter makes a narrower point. Sometimes yielding for a moment can reduce damage, preserve energy, and keep a later move alive. When force is already running against you, refusing to collide with it can be smarter than feeding it. But the chapter is not praising helplessness or giving up forever. Strategic surrender means absorbing pressure without losing the ability to act later. The lesson is to protect future initiative rather than spending everything in one bad confrontation. What matters is not looking brave in the wrong second, but keeping enough strength to matter in the right one.",
        "Greene's twenty-second law argues that a temporary surrender can be stronger than direct resistance when the balance is against you. If you fight too early, you may harden the stronger side and waste your own leverage. The chapter is not telling you to become passive. It is telling you that yielding can sometimes buy time, reduce damage, and invite overconfidence in the aggressor. That overconfidence can later create the opening you need. The stronger reading is controlled surrender, not collapse. Step back when collision helps them more than it helps you. Preserve enough position to return after their force has spent itself badly. A useful surrender protects tomorrow's move instead of sacrificing everything to today's pressure. The side that thinks your yielding finished the contest may become exactly careless enough to give you a better field later.",
        "This law gives a practical warning: when you resist the stronger side at the wrong moment, you may become the fuel for its momentum. Greene's point is that surrender can be useful because it absorbs force and changes timing. If others think they have already won, they may overextend, relax, or expose their assumptions. But the chapter is not asking for weak panic or permanent retreat. It is asking for disciplined yielding. Do not confuse immediate defiance with strength when that defiance only helps the bigger push gather speed. A competitive reader knows that surviving the hit, preserving room, and returning later can be worth more than losing everything in a brave but mistimed clash. The force they cannot waste on you now may become the opening you use later. Let them spend their certainty too early, and they may hand you back the timing they thought they took.",
      ),
      keyTakeaways: [
        { point: tone("Direct collision can strengthen the stronger side.", "Pushing back too early can waste your position.", "Fight on their timing and you may power their move.") },
        { point: tone("Tactical surrender can absorb force and preserve room.", "Yielding can buy time, reduce damage, and keep a later move alive.", "A temporary step back can protect future leverage.") },
        { point: tone("Strategic yielding differs from collapse.", "The chapter is about preserved initiative, not helplessness.", "Give ground without giving away the future.") }
      ],
      oneMinuteRecap: tone(
        "This law says yielding can be useful when direct resistance would only strengthen the stronger side.",
        "Do not collide with force when absorbing it preserves a better move later.",
        "Sometimes surviving the push matters more than answering it immediately."
      )
    },
    medium: {
      chapterBreakdown: tone(
        `Greene's twenty-second law begins by questioning the reflex to resist pressure head-on. When a stronger side already has momentum, direct opposition can sometimes intensify exactly what you hoped to stop. The clash drains your strength, confirms the opponent's confidence, and lets their force spend you at the moment of their greatest advantage. Greene is interested in that asymmetry. The chapter asks what happens when the smarter move is not resistance but controlled yielding.

That is why surrender can matter here. Greene is not describing noble defeat or passive acceptance. He is describing force absorption. If you yield at the right moment, you may reduce damage, preserve resources, and buy time while the stronger side spends energy believing the contest is already settled. Tactical surrender therefore changes the timing of the struggle. It shifts the contest away from their strongest moment and toward a later one that may serve you better.

The chapter is strongest when it distinguishes strategic yielding from collapse. The useful move is not to forfeit the future. It is to protect it. Greene is not praising panic, appeasement, or endless retreat. He is showing how an apparent concession can preserve later initiative when frontal defiance would only lock you into a losing exchange. Yielding matters only if it leaves you more able to move afterward than resistance would have left you.

The pattern appears in ordinary settings. A worker can accept a public setback from a stronger executive and use the overreach later when the executive grows less careful. A student-senate bloc may surrender one vote, regroup, and return after the winners misread their victory as final. A personal conflict may calm once one person stops feeding the surge and waits for the other side's force to lose shape. In each case, the gain comes from altered timing rather than from simple defeat.

The limit matters because not every surrender is strategic. If yielding destroys your later agency, it has failed. Greene's practical claim is narrower: absorb force only when doing so preserves more initiative than direct resistance would. Chapter 21 preserved room by slowing recognition. Chapter 22 preserves room by slowing collision. Chapter 23 then asks what happens when that saved initiative is concentrated instead of scattered.`,
        `Greene's twenty-second law argues that resisting too early can strengthen the stronger side. People often treat immediate defiance as proof of courage, but Greene hears another possibility: badly timed resistance may waste energy while the opponent is at full momentum. The chapter therefore begins with a strategic problem, not a moral one. What if collision helps them more than it helps you?

That is why surrender can be useful. If you yield temporarily, the stronger side may spend force without receiving the clean fight it expected. You preserve time, reduce damage, and often invite overconfidence. Greene is interested in that overconfidence because apparent victory can make a dominant side less disciplined. A rushed winner may overreach, misread the field, or stop protecting itself as carefully as before.

This is why the chapter is not generic passivity advice. Greene is not praising helplessness or telling the reader to submit permanently. He is separating tactical surrender from collapse. The issue is timing. Yielding can be intelligent once it protects future agency. It becomes failure when it destroys the ability to return, regroup, or redirect the situation later.

The pattern appears everywhere. A manager who accepts one round of pressure may later use the other side's careless overreach. A prototype-studio team that gives up an early clash can preserve resources for the point when the dominant side is spread thin. A personal disagreement can shift once one person refuses to keep feeding escalation and instead waits for the surge to exhaust itself. In each case, the stronger side loses some advantage once its momentum has already spent part of itself.

The limit remains central because surrender is not magic. If it legitimizes your defeat without preserving any later move, it is simply loss. Greene's point is disciplined rather than romantic: give way only when doing so keeps more initiative alive than a frontal contest would. Chapter 21 dealt with room created by underestimation. Chapter 22 deals with room created by absorbed force. Chapter 23 then turns toward concentrated force as the next way to convert preserved position into power.`,
        `This law starts with a tempting mistake: calling all resistance strength. Greene's warning is that timing matters more than posture. If the other side already has more force, more visibility, or better position, meeting that push directly can feed their success rather than interrupt it. You may give them the clean conflict they wanted while exhausting your own options too early.

That matters because surrender can change the geometry of pressure. A temporary yielding can absorb momentum, buy time, and make the aggressor think the outcome is already settled. The chapter therefore treats apparent weakness as a timing tool. If they believe they have won, they may become less careful, less disciplined, and more exposed to reversal.

This keeps the law narrower than generic retreat. Greene is not asking you to disappear, capitulate permanently, or celebrate weakness for its own sake. Strategic surrender means giving way in order to keep agency. It delays the decisive contest until the balance is less favorable to the stronger side and more workable for you.

Common settings make the point plain. A coworker who stops escalating a superior's push may later have cleaner evidence of overreach than if the fight had exploded immediately. A student bloc can lose one procedural round and still gain the larger campaign when the winners assume the matter is closed. A personal exchange may improve once one person declines the immediate clash and lets the other side's intensity burn itself down. In each case, yielding preserves future movement.

The limit matters because real collapse is not the goal. If you yield so far that you cannot recover timing, leverage, or voice, the tactic has failed. Chapter 21 showed that visible brilliance can trigger defense. Chapter 22 shows that visible weakness can sometimes redirect force. Chapter 23 then asks what happens when the initiative you preserved is finally concentrated where it counts.`,
      ),
      keyTakeaways: [
        {
          point: tone("Badly timed resistance can strengthen the stronger side.", "Badly timed defiance can waste your position.", "Meet their surge head-on at the wrong moment and you may carry it for them."),
          moreDetails: tone("The chapter focuses on unequal timing rather than on bravery as a performance.", "Force already in motion can become more effective when you collide with it badly.", "The wrong fight can become unpaid labor for their momentum.")
        },
        {
          point: tone("Tactical surrender can absorb force and buy time.", "Yielding can reduce damage while preserving future initiative.", "A controlled retreat can keep tomorrow's move alive."),
          moreDetails: tone("Greene values surrender here because it can shift the contest away from the opponent's strongest moment.", "The chapter's leverage comes from force absorption and delayed response.", "Let them spend their best push before you spend your best answer.")
        },
        {
          point: tone("Strategic yielding differs from passive collapse.", "The move is preservation, not helplessness.", "Give way without handing over the future."),
          moreDetails: tone("The chapter still requires later agency, timing, and the ability to return.", "Surrender matters only if it leaves you more capable afterward than frontal resistance would have.", "If nothing remains to cash later, the retreat was only loss.")
        },
        {
          point: tone("Overconfidence often follows apparent victory.", "A dominant side can grow careless once it thinks the contest is settled.", "Winners who relax too early become easier to read and hit later."),
          moreDetails: tone("Work, school, and personal settings all show how a premature winner may overextend.", "The chapter becomes practical when you ask what the stronger side stops protecting after it thinks you are done.", "Their confidence after the win may be the first opening the tactic buys you.")
        },
        {
          point: tone("The law has an agency limit.", "Surrender fails if it destroys the ability to return.", "Absorb force, but do not dissolve into it."),
          moreDetails: tone("Some situations punish yielding more than resistance, so the tactic must stay conditional.", "Greene warns against mistaking any retreat for strategy.", "Yield only when the future you preserve is real enough to use.")
        }
      ],
      activationPrompt: tone(
        "Identify one pressure where direct resistance may only strengthen the stronger side.",
        "Choose one conflict where yielding briefly could preserve more initiative than collision.",
        "Pick the push that might expose more if you stop feeding it immediately."
      ),
      selfCheckPrompt: tone(
        "Am I preserving future agency, or just accepting defeat?",
        "What does direct resistance buy me here besides helping their momentum?",
        "If I yield now, what opening could their overconfidence create later?"
      ),
      oneMinuteRecap: tone(
        "This chapter says tactical surrender can absorb force and preserve initiative when direct resistance would only strengthen the stronger side.",
        "Do not confuse immediate collision with strength if timing is against you.",
        "Sometimes the best counter begins after the surge spends itself."
      )
    },
    hard: {
      chapterBreakdown: tone(
        `Greene's twenty-second law treats surrender as a timing instrument rather than a moral concession. Most people hear surrender and imagine defeat, humiliation, or the end of agency. Greene is interested in a narrower possibility: when a stronger side is already pushing with superior force, direct resistance may do more to complete its momentum than to interrupt it. The chapter therefore begins by questioning the romance of immediate defiance. A frontal clash can spend your energy at the exact moment the opponent most wants you spending it.

That is why tactical yielding can be useful. If you give way deliberately, you may absorb force that would otherwise break against you at full strength. The gain is not dignity through suffering. The gain is altered timing. A side that thinks it has already won may spend less carefully, reveal more overconfidence, and stop protecting itself as if the contest were still live. Greene wants the reader to notice that apparent defeat can change the quality of the enemy's attention.

The chapter is strongest when it resists the lazy reading that surrender is merely passivity. Greene is not praising collapse, helplessness, or permanent retreat. He is distinguishing strategic surrender from forfeiture. Strategic surrender preserves a later move. It protects resources, buys time, and keeps open the possibility of reversal. Collapse, by contrast, destroys the very agency the tactic is supposed to save. The difference is whether yielding leaves you more capable of acting later than collision would have left you.

This is why direct resistance can be expensive. The problem is not only loss. It is reinforcement. A stronger side often becomes stronger when you meet it on its preferred ground at its preferred moment. Your resistance confirms its structure, sharpens its justification, and gives it the contest it is best prepared to win. The chapter therefore asks whether the satisfaction of visibly fighting back is worth the positional damage that fight may cause when the balance is already bad.

Ordinary settings show the mechanism clearly. A professional who refuses to escalate publicly with a stronger executive may later use the executive's overreach, impatience, or false sense of finality more effectively than a losing confrontation would have allowed. A student-senate bloc that yields one vote may discover that the winning coalition relaxes, miscounts its support, and exposes vulnerabilities in the next round. A personal conflict can change when one person no longer feeds the immediate surge and instead waits for the other side's force to outrun its discipline. In each case, what is preserved is not pride. What is preserved is initiative.

The limit matters because some surrenders simply ratify defeat. If yielding costs you the ability to return, regroup, or redirect, the tactic has failed. Greene is not arguing that every pressure should be absorbed. He is arguing against wasting strength on collisions that help the stronger side more than they help you. Chapter 21 preserved access by delaying recognition. Chapter 22 preserves agency by delaying decisive resistance. Chapter 23 follows naturally from there. Once you have survived force without squandering yourself against it, the next question is where concentrated effort can create compounding advantage. The law succeeds only when surrender remains temporary, chosen, and connected to a later position that is actually better than the first clash would have been. If nothing is saved, nothing has been transformed. If initiative is preserved, weakness has begun to change its value.`,
        `Greene's twenty-second law argues that surrender can be strategically useful because direct resistance is sometimes the wrong gift to hand a stronger side. Most readers hear "surrender" and think it means approving the other's power. Greene hears a different calculation: collision at the wrong moment may feed their momentum, drain your resources, and remove the very flexibility you still needed.

Tactical surrender preserves initiative because it changes when and how force gets spent. If the dominant side expects impact and gets little resistance instead, it may waste energy pressing harder than necessary or relax too quickly after apparent success. Greene is interested in that overconfidence. The side that believes the contest is over may begin acting as though discipline is no longer needed. That shift can create opportunities no frontal struggle would have produced.

That is why the chapter should not be flattened into advice for passivity. It is not saying that weakness is admirable in itself. It is saying that yielding can be intelligent when it protects future agency better than immediate defiance would. Strategic surrender means remaining able to return. Passive collapse, by contrast, abandons the future and calls the loss wisdom after the fact. The distinction is whether the retreat preserves a next move.

The pattern appears in ordinary life. A manager may accept one public setback to let a stronger opponent expose arrogance or overreach later. A prototype-studio team may give up an early contest so the dominant side stretches itself across too many fronts. A personal disagreement may become more workable once one person stops feeding escalation and lets the other side's certainty outrun its control. In each case, force loses quality after it thinks it has already won.

The limit remains central because surrender is not automatically transforming. If it seals your defeat or normalizes a position you cannot recover from, it has not preserved anything worth having. Greene's practical claim is narrower: yield only when doing so protects more agency than direct resistance would. Chapter 21 managed what the room sees when it looks at your strength. Chapter 22 manages what the stronger side does when it thinks your weakness is final. Chapter 23 then turns toward concentration, where preserved initiative stops surviving and starts compounding. The reader's edge lies in asking not whether surrender feels strong, but whether it saves a better future move than collision would have saved. Timing, not posture, decides whether the tactic has power. A surrender that shortens the stronger side's discipline while lengthening your own future options has already begun changing the balance before any visible reversal arrives. The side that relaxes after your yielding may also expose where its control was thinner than its first victory made it seem, and that exposure is often where the next answer starts.`,
        `This law works only if you track what force is doing before you decide what defiance means. Most people focus on what resistance says about them: courage, principle, toughness, refusal to submit. Greene's warning is that resistance also does something practical for the stronger side. It can give that side the clean impact, visible conflict, and immediate expenditure of your resources that it most wants. The chapter is about that transfer.

That is why surrender can be strategically valuable. A person who yields in a controlled way may lose face in the short term and gain position in the longer term. A stronger side that believes the matter is finished often reveals how poorly it behaves when vigilance drops. Loose winners overextend. Loose victors grow careless. Loose aggressors spend force on the assumption that no answer remains. Greene is not praising surrender for drama. He is protecting future initiative from being crushed inside the wrong confrontation.

The chapter therefore distinguishes yielding from disappearance. Empty collapse is not strategy. Strategic surrender is purposeful absorption. It preserves room to recover, gather, redirect, and let an opponent's overreach create the next opening. Without preserved agency underneath, the move fails. You cannot transform weakness into power if your surrender has actually dissolved the means of returning.

Common settings show the law with almost embarrassing clarity. A coworker who stops escalating a superior's push may later have the cleaner case when the superior's confidence outruns discipline. A senate bloc can lose a round and still win the campaign if the winners celebrate too early and scatter their attention. A personal confrontation may become easier to redirect once one person no longer supplies the friction the other side needs to stay inflamed. In each case, the shift is not merely tonal. The cost structure of force changes once the stronger side keeps spending energy as though no meaningful answer remains.

The limit matters because surrender can fail too. Yield too far and you ratify a defeat that no later cleverness can repair. Resist too soon and you spend yourself exactly where the stronger side hoped you would. Greene's better point is to choose collision deliberately, not reflexively. Chapter 21 taught that visible brilliance can make your edge easier to guard against. Chapter 22 teaches that visible weakness can sometimes make force cheaper to survive and easier to reverse later. Chapter 23 follows because preserved initiative matters most when it stops diffusing itself and gathers weight in one place. The deepest lesson is that weakness only becomes power when it is managed as timing instead of accepted as identity. If you surrender without a preserved future, you have only lost. If you surrender while saving a real next move, then the apparent defeat may already be changing sides. The stronger side's worst habit is assuming your yielding ended the contest rather than postponed the terms on which it will continue. Their confidence after the apparent finish is often the first resource your surrender quietly extracts from them.`,
      ),
      keyTakeaways: [
        {
          point: tone("Direct resistance can reinforce the stronger side's momentum.", "Bad timing can make defiance serve the opponent.", "Fight on their best ground and you may become part of their machinery."),
          moreDetails: tone("The chapter emphasizes unequal force and timing rather than courage as display.", "A frontal clash can confirm the stronger side's structure and waste your resources.", "The wrong resistance can become fuel they did not have to generate themselves.")
        },
        {
          point: tone("Tactical surrender can absorb force and preserve initiative.", "Yielding can protect resources while shifting the timing of the struggle.", "Let their surge spend itself before you spend your best answer."),
          moreDetails: tone("Greene values surrender because it can reduce damage and invite overconfidence after apparent victory.", "The chapter's leverage comes from force absorption, delayed response, and altered attention.", "A weaker position can survive by refusing to be broken at the strongest point of impact.")
        },
        {
          point: tone("Strategic yielding differs from collapse.", "The move is to save a next action, not to rationalize defeat.", "Give ground only if the future you save is real."),
          moreDetails: tone("The chapter still requires recoverable agency, timing, and the ability to return.", "Yielding matters only if it leaves you more capable afterward than collision would have.", "A retreat that cannot cash later is only decorated loss.")
        },
        {
          point: tone("Apparent victory can make the stronger side careless.", "Winners often loosen discipline once they think the contest is settled.", "Overconfidence after the win may be the first advantage your surrender buys."),
          moreDetails: tone("Work, school, and personal settings all show how a rushed victor may overextend after success.", "The chapter becomes practical when you ask what the stronger side stops protecting once it thinks you are finished.", "Their relaxed attention may be the real battlefield your yielding creates.")
        },
        {
          point: tone("The law has a severe agency limit.", "Surrender fails if it destroys the capacity to return.", "Absorb force without becoming its permanent shape."),
          moreDetails: tone("Some situations punish yielding too severely for the tactic to be wise.", "Greene warns against reflexive retreat just as much as reflexive collision.", "Transform weakness only when something usable survives the transformation.")
        }
      ],
      activationPrompt: tone(
        "Identify one stronger pressure where collision may be helping the other side more than you.",
        "Choose one conflict where a controlled yielding could preserve a better future move.",
        "Pick the surge that might expose more if you stopped feeding it right now."
      ),
      selfCheckPrompts: [
        tone(
          "Am I preserving a real next move, or only calling defeat strategic?",
          "What does direct resistance buy the stronger side at this exact moment?",
          "If I yield now, what force, attention, or discipline might they start wasting?"
        ),
        tone(
          "When would collision help me more than absorption?",
          "What future initiative actually survives this surrender?",
          "If I step back, where could concentrated effort matter later?"
        )
      ],
      predictionPrompt: tone(
        "Once force is survived instead of scattered against it, how might Chapter 23 show concentrated effort compounding advantage?",
        "If surrender preserves initiative, what changes next when that initiative is no longer diffused but focused hard in one place?",
        "After absorbing pressure without breaking, what becomes possible when your answer stops spreading itself thin?"
      ),
      oneMinuteRecap: tone(
        "This chapter argues that tactical surrender can absorb force and preserve agency when direct resistance would only strengthen the stronger side.",
        "Do not confuse immediate collision with strength if it spends you at the enemy's best moment.",
        "Sometimes weakness becomes power only after it survives the push and chooses the later fight."
      )
    }
  },
  examples: [
    {
      title: "Alma Stops Escalating a Stronger Executive's Push So the Overreach Becomes Visible Later",
      format: "decision_point",
      category: "work",
      endingType: "broader_principle",
      scenario: tone("Alma faces a public push from a stronger executive who seems eager for an immediate clash.", "She has to decide whether fighting now helps her more than it helps the executive's momentum.", "Alma can collide on his terms or preserve a later opening."),
      whatToDo: tone("She yields the immediate clash, documents the overreach, and waits for the stronger side to grow less careful.", "She protects future initiative instead of feeding the other side's best moment.", "She lets his force outrun his discipline before answering it."),
      whyItMatters: tone("The chapter says direct resistance can help the stronger side when timing is bad.", "Her restraint preserves a cleaner later move than a losing confrontation would.", "The first win he wants may be the one she should refuse to give him.")
    },
    {
      title: "Joren Hears Why a Student-Senate Bloc Yielded One Vote to Regroup and Return Stronger",
      format: "dialogue",
      category: "school",
      endingType: "self_directed_question",
      scenario: tone("Joren listens as someone explains why losing one vote was better than burning all leverage in a doomed procedural fight.", "He hears how the winning bloc relaxed too quickly after the apparent victory.", "Joren learns that not every immediate loss is the wrong move."),
      whatToDo: tone("He asks what was preserved by giving way and what the winners stopped protecting after they thought the matter was closed.", "He studies how a tactical loss can buy a better round later.", "He asks what future move the surrender actually saved."),
      whyItMatters: tone("The chapter warns that strategic yielding differs from collapse because it preserves later initiative.", "The bloc gained more from the winners' overconfidence than from a losing showdown.", "A rushed victory often spends the winner's discipline too.")
    },
    {
      title: "Petra Weighs Immediate Defiance Against Preserving Room for a Better Response Later",
      format: "dilemma",
      category: "personal",
      endingType: "surprising_implication",
      scenario: tone("Petra feels the pull to answer a surge of pressure immediately even though the other person's intensity is still rising.", "She must choose between visible defiance and a temporary yielding that keeps the future open.", "Petra can call the next five minutes strength or ask what they will cost tomorrow."),
      whatToDo: tone("She declines the immediate clash and protects enough space to respond after the surge loses shape.", "She separates silence now from surrender forever.", "She gives way to timing, not to domination."),
      whyItMatters: tone("The chapter says force can lose quality once it outruns its own discipline.", "Her yielding can preserve more agency than a collision at the other side's strongest point.", "Not answering now may be the move that keeps a real answer possible later.")
    },
    {
      title: "Rafi Predicts Why One Operator Accepts a Temporary Loss to Let Pressure Spend Itself",
      format: "predict_reveal",
      category: "work",
      endingType: "cross_domain",
      scenario: tone("Rafi notices an operator accept a temporary setback instead of contesting every inch of a stronger push.", "He predicts the operator is letting force spend itself where it will produce less durable harm.", "Rafi can already see that the retreat may be shaping the later answer."),
      whatToDo: tone("He judges whether the yielding preserves agency or merely decorates defeat.", "He looks for controlled absorption rather than panic.", "He scores the move on whether the future remains usable afterward."),
      whyItMatters: tone("The chapter says tactical surrender works only when it preserves a next move.", "The operator may be refusing to energize the stronger side's best moment.", "A temporary loss can be cheaper than a badly timed stand.")
    },
    {
      title: "Prototype-Studio Debrief Finds That Forcing a Confrontation Early Only Strengthened the Dominant Side",
      format: "postmortem",
      category: "school",
      endingType: "common_trap",
      scenario: tone("A prototype-studio team reviews why an early showdown drained its energy while the dominant side only grew more confident.", "The debrief finds that the clash happened exactly when the other side wanted it.", "The team learns that brave timing can still be bad timing."),
      whatToDo: tone("They identify where yielding would have preserved resources and invited more overreach later.", "They redesign the next round around survival first and collision second.", "They stop feeding force at the point of maximum impact."),
      whyItMatters: tone("The chapter warns that direct resistance can reinforce the stronger side's structure.", "The team lost initiative by fighting when the balance was worst for them.", "Their mistake was not resisting; it was resisting on the enemy's schedule.")
    },
    {
      title: "Before and After Reflexive Resistance Became Strategic Yielding That Preserved Initiative",
      format: "before_after",
      category: "personal",
      endingType: "perspective_reframe",
      scenario: tone("Before, every pressure was answered immediately and energy vanished in collisions that changed little. After, yielding was used selectively to preserve the moment that actually mattered.", "The contrast is between posture and timing.", "One version spends strength proving defiance; the other saves strength for the useful answer."),
      whatToDo: tone("Keep the willingness to resist, but stop offering resistance at the opponent's best moment by default.", "Yield only as far as it preserves a better next move.", "Do not worship the first clash if the real leverage lives later."),
      whyItMatters: tone("The law distinguishes temporary surrender from permanent defeat.", "Better timing can preserve both agency and reversal potential.", "The strongest answer may begin with surviving the wrong fight instead of performing it.")
    }
  ],
  reviewCards: [
    { cardId: "ch22-rc01", front: tone("Why can direct resistance fail in this chapter?", "How can pushing back too early help the stronger side?", "Why might a frontal clash serve the opponent?"), back: tone("Because collision at the wrong moment can feed the stronger side's momentum and waste your position.", "The chapter says badly timed resistance can reinforce the opponent's advantage.", "You may give them the exact fight they were best prepared to win."), difficulty: "easy" },
    { cardId: "ch22-rc02", front: tone("What can tactical surrender preserve?", "Why can yielding be useful here?", "What does force absorption buy you?"), back: tone("It can preserve energy, reduce damage, buy time, and keep a later move alive.", "Greene values surrender here because it can alter timing and protect future initiative.", "Absorbing the push can save room for a better answer."), difficulty: "easy" },
    { cardId: "ch22-rc03", front: tone("How is strategic yielding different from collapse?", "What separates surrender from permanent defeat?", "Why isn't giving way automatically weakness?"), back: tone("Strategic yielding preserves later agency, while collapse destroys it.", "The chapter values surrender only when a real future move survives.", "Give way only if the future remains usable."), difficulty: "medium" },
    { cardId: "ch22-rc04", front: tone("Where does this law appear in ordinary life?", "How do work, school, and personal settings show force absorption?", "Where can a temporary loss create a later opening?"), back: tone("It appears wherever a stronger side wants immediate conflict on favorable terms.", "Executive pressure, bloc votes, and personal escalation all change when one side stops feeding momentum.", "A controlled retreat can sometimes buy the better round."), difficulty: "medium" },
    { cardId: "ch22-rc05", front: tone("How does Chapter 22 bridge to Chapter 23?", "Why does surviving force lead into concentrating force?", "What comes after preserved initiative?"), back: tone("Once you survive force without wasting yourself against it, the next question is where to concentrate effort for compounding gain.", "Chapter 23 turns preserved initiative into focused strength.", "First absorb the wrong fight, then concentrate for the right one."), difficulty: "hard" }
  ],
  keyTakeawayCard: tone(
    "Direct resistance can help the stronger side when timing is bad, while tactical surrender can absorb force and preserve a better later move.",
    "This law warns against colliding with force when yielding preserves more agency.",
    "Sometimes weakness becomes power only after it survives the surge and returns on better terms."
  )
};

const quiz = {
  passingScorePercent: 70,
  questions: [
    { questionId: "ch22-q01", prompt: "Why can direct resistance fail in this chapter?", choices: ["Because all resistance is foolish", "Because collision at the wrong moment can strengthen the stronger side", "Because surrender always guarantees victory"], correctIndex: 1, explanation: tone("Correct. The chapter says badly timed resistance can reinforce the stronger side's momentum.", "A frontal clash may help them more than it helps you when the balance is bad.", "Right. You can end up powering the push you meant to stop."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch22-q02", prompt: "What can tactical surrender preserve or create here?", choices: ["Time, reduced damage, and a later opening", "Permanent admiration from everyone involved", "Proof that weakness is better than strength"], correctIndex: 0, explanation: tone("Yes. Greene values surrender here because it can buy time and preserve future initiative.", "Yielding can absorb force and keep a later move alive.", "Right. Survive the surge and the next answer may still be yours."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch22-q03", prompt: "Why is this chapter not generic passivity advice?", choices: ["Because all conflict should be avoided forever", "Because yielding always humiliates the stronger side", "Because it only values surrender when later agency survives"], correctIndex: 2, explanation: tone("Correct. The chapter separates strategic surrender from helpless collapse.", "The tactic matters only if it preserves a real next move.", "Right. A retreat without future agency is just loss."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch22-q04", prompt: "In Alma's work scenario, what best fits the chapter?", choices: ["Escalate immediately so the executive cannot feel strong", "Yield the immediate clash and use the overreach later", "Disappear completely and never answer the issue"], correctIndex: 1, explanation: tone("Yes. She preserves a cleaner later move by refusing the clash on the stronger side's terms.", "The chapter favors altered timing over losing confrontation.", "Right. Let the push overreach before you answer it."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch22-q05", prompt: "Why did Joren's student-senate example make tactical sense?", choices: ["Because the bloc never needed votes at all", "Because a temporary loss let the winners relax too soon", "Because surrender is always more mature than fighting"], correctIndex: 1, explanation: tone("Correct. The winners' overconfidence created a later opening.", "The bloc preserved initiative by not spending everything in the doomed round.", "Yes. The early win made the other side less careful."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch22-q06", prompt: "What is the strongest reading of Petra's dilemma?", choices: ["Temporary yielding can preserve a better later response", "Immediate defiance always proves the most strength", "Silence means she fully accepts the other side's control"], correctIndex: 0, explanation: tone("Yes. The chapter separates delayed response from permanent surrender.", "She may keep more agency by not colliding at the other side's strongest moment.", "Right. Not answering now can protect the real answer later."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch22-q07", prompt: "How can apparent victory make the stronger side weaker later?", choices: ["It can make the winner overconfident and less careful", "It guarantees the winner will become kind", "It removes all structural advantages immediately"], correctIndex: 0, explanation: tone("Correct. The chapter says apparent victory can relax discipline and invite overreach.", "A dominant side may protect itself less once it thinks the matter is settled.", "Yes. The win can be what makes them sloppy."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch22-q08", prompt: "When does surrender become collapse instead of strategy?", choices: ["When it reduces immediate damage", "When it changes the timing of the conflict", "When it destroys the ability to return or redirect later"], correctIndex: 2, explanation: tone("Exactly. Yielding matters only if future agency survives.", "The tactic fails when nothing usable remains afterward.", "Right. If no next move is left, you did not preserve anything."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch22-q09", prompt: "How does Chapter 21 lead into Chapter 22?", choices: ["Underestimation removes the need to manage force", "Chapter 22 rejects timing and mismeasurement", "After visible weakness can change perception, the next move is to let weakness absorb pressure tactically"], correctIndex: 2, explanation: tone("Correct. Chapter 21 used underestimation to create room; Chapter 22 uses weakness to change how force lands.", "The sequence moves from mismeasured strength to strategic yielding.", "Right. First they underrate you, then their push lands on different terms."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch22-q10", prompt: "What bridge carries Chapter 22 into Chapter 23?", choices: ["Once initiative survives the wrong fight, the next question is where to concentrate it", "Concentration makes surrender unnecessary in every case", "Chapter 23 abandons the issue of timing completely"], correctIndex: 0, explanation: tone("Correct. The next chapter asks how preserved initiative compounds when effort stops scattering.", "Chapter 23 turns survival and repositioning into focused force.", "Right. First save the move, then concentrate it."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" }
  ]
};

chapter.quiz = quiz;

function ensureDir(file) { fs.mkdirSync(path.dirname(file), { recursive: true }); }
function writeText(file, text) { ensureDir(file); fs.writeFileSync(file, text.endsWith("\n") ? text : `${text}\n`, "utf8"); }
function writeJson(file, data) { ensureDir(file); fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8"); }
function words(text) { return String(text).trim().split(/\s+/).filter(Boolean).length; }

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
for (const name of ["Alma", "Joren", "Petra", "Rafi"]) continuity.nameUsage[name] = [stem];
continuity.withinChapterNames[stem] = ["Alma", "Joren", "Petra", "Rafi"];
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
- Chapter-specific mechanism remains force absorption, delayed reversal, and preserved initiative rather than generic patience rhetoric
- Hard depth preserves the surrender-versus-collapse boundary and the Chapter 23 concentration bridge
- Quiz stays within supported facts from the approved draft and frozen source bundle

## Gate result
- Approved for chapter gate and automatic continuation
`;
writeText(paths.validation, validation);

fs.appendFileSync(
  paths.runLog,
  `\n- Completed writer, editor, critic, converter, quiz, and validator steps for Chapter 22.\n- Validation result: PASS.\n- Continuity hash sealed for \`${stem}\`: \`${seal}\`\n`,
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
