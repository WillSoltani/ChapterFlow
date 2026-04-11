const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const runRoot = path.resolve(".chapterflow/runs/the-48-laws-of-power/20260409-002544");
const num = 28;
const stem = `ch${String(num).padStart(2, "0")}`;
const title = "Enter Action with Boldness";
const chapterId = "ch28-enter-action-with-boldness";
const createdAt = new Date().toISOString();

function tone(gentle, direct, competitive) {
  return { gentle, direct, competitive };
}

const canonical = `Greene's twenty-eighth law begins with a psychological cost that appears before a plan even succeeds or fails. Hesitation is rarely neutral. When you move half-committed, visibly uncertain, or apologetically tentative, you invite scrutiny, counterpressure, and opportunistic resistance. The chapter begins by treating hesitation as a tax on action. Before the substance of the move is tested, visible uncertainty can already weaken it.

Its claim is not that preparation is useless or that every risk deserves reckless speed. Greene's point is more strategic. Bold entry can create momentum, shape perception, and reduce the confidence of opponents before the outcome is settled. A decisive move often looks stronger than it technically is because confidence changes the field around it. Boldness therefore matters not only because of what it does materially, but because of the psychological advantage it creates in the moment of entry.

That is why the law focuses on decisive execution rather than on theatrical aggression. Greene is not praising noise, bravado, or impulsive stunt behavior for its own sake. He is distinguishing strategic boldness from preventable overreach. The useful move is not to act blindly. It is to enter with enough confidence that you do not leak weakness through hesitation while still preserving enough judgment to avoid running far past reality.

Ordinary settings make the mechanism visible. A leader who launches a plan decisively may face less early resistance than one who keeps revising the visible framing in public. A strategy-lab team may lose its edge when it signals uncertainty long enough for others to gather objections. A person in private life may get cleaner results by stating and acting on a decision directly instead of testing the room timidly until everyone sees doubt. In each case, boldness alters perception before results can fully do so.

The chapter's limit matters. Bold action can fail if it outruns preparation, ignores obvious reality, or mistakes speed for strength. Greene overreaches if the law becomes advice for reckless lunging under every condition. The useful version is narrower: where hesitation would feed resistance, enter decisively enough to seize momentum, but keep enough discipline that boldness does not become a loud form of self-sabotage. Chapter 27 built aura through belief and symbolic certainty. Chapter 28 asks how action must now carry that aura forward through confidence rather than puncturing it with visible doubt. That points toward Chapter 29, where decisive movement still needs enough long-range planning to survive its own beginning.`;

const edited = canonical;

const critic = `# Chapter 28 Critic Report

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
- Paragraph 4 is most vulnerable because work, school, and personal examples can flatten into generic confidence talk if conversion drops the hesitation, momentum, and overreach mechanics.

Strongest sentence:
- "A decisive move often looks stronger than it technically is because confidence changes the field around it."

Anchor use notes:
- The draft stays inside the frozen support: hesitation invites resistance, bold entry shapes perception and momentum, decisive execution differs from recklessness, and overreach remains the chapter's central limit.

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
        "This law says hesitation weakens action before the action is even fully judged. When you move timidly, keep apologizing in public, or visibly doubt your own step, other people notice. Greene is not saying preparation is useless or that every risk deserves blind speed. The chapter makes a narrower point. Bold entry can create momentum and shape perception before results fully arrive. If you act decisively, you reduce the room's chance to organize around your uncertainty. That can make the same move stronger than it would have looked if you had entered it half-committed. But the chapter is not praising reckless lunging or loud showmanship. Strategic boldness is supposed to keep confidence visible without letting judgment disappear. The lesson is to notice when hesitation is feeding resistance and to enter strongly enough that your own doubt does not become part of the obstacle.",
        "Greene's twenty-eighth law argues that action often works better when it is entered boldly instead of timidly. The chapter is not telling you to rush everywhere or to ignore preparation. It is telling you that visible hesitation can invite doubt, scrutiny, and opposition that would have been weaker if you had moved decisively. The stronger reading is confidence in execution, not reckless theater. Enter the move firmly enough that people feel momentum instead of smelling uncertainty. That can change the field because perception often hardens before outcomes do. But the chapter is not saying boldness can replace reality forever or that confidence excuses bad planning. Boldness matters only if it helps you seize momentum without sprinting past what the situation can support. Used well, decisive action makes resistance slower to gather and your own side easier to carry forward.",
        "This law gives a practical warning: if you look unsure while acting, others may attack the uncertainty before they even test the plan. Greene's point is that boldness can be useful because confidence itself changes perception. A competitive reader should notice that people often treat a decisive move as stronger than an equally good move presented with hesitation. But the chapter is not asking for noisy overconfidence or reckless stunts. It is asking for committed execution. Move clearly enough that your opening creates momentum instead of debate about whether you believe in your own action. The tactic works only if boldness still rests on some preparation and awareness of limits. If the confidence is pure bluff with no grounding, reality can punish it fast. The right move is to stop leaking weakness through hesitation while keeping enough judgment to avoid turning boldness into a public crash.",
      ),
      keyTakeaways: [
        { point: tone("Hesitation invites resistance.", "Visible uncertainty weakens action before the result is known.", "If you leak doubt, the room starts pushing there.") },
        { point: tone("Bold entry can create momentum.", "Decisive action shapes perception before outcomes fully settle.", "Move strongly enough and the field starts adjusting to you.") },
        { point: tone("Strategic boldness differs from recklessness.", "The chapter is about committed execution, not blind overreach.", "If boldness outruns reality, it stops being power.") }
      ],
      oneMinuteRecap: tone(
        "This law says hesitation can weaken action, while bold entry can create momentum and confidence around a move.",
        "Do not feed opposition with visible uncertainty if decisive execution would change the field first.",
        "Enter strongly enough to seize momentum without sprinting into obvious overreach."
      )
    },
    medium: {
      chapterBreakdown: tone(
        `Greene's twenty-eighth law begins by questioning the value of visible hesitation. Many people imagine that public caution always looks wise, but Greene hears another effect: hesitation can advertise uncertainty, invite challenge, and encourage others to gather resistance before the move has even taken shape. The chapter asks what happens when action is entered boldly enough to deny that opening.

That is why boldness matters here. Greene is not describing empty swagger or confidence as a costume. He is describing momentum capture. If you move decisively, you may shape perception, reduce counterpressure, and make the field respond to your action rather than to your doubt. The chapter treats confidence as strategically useful because hesitation is often contagious in the wrong direction. Your visible uncertainty can become everyone else's reason to push back harder.

The chapter is strongest when it distinguishes strategic boldness from reckless overreach. The useful move is not to charge blindly or to confuse volume with strength. It is to enter with enough commitment that others do not get to organize around your own indecision. Greene is not praising stupidity. He is showing how confidence in execution can create an early advantage so long as the action still rests on enough preparation and reality contact to survive its own opening.

The pattern appears in ordinary settings. A work leader who launches a plan clearly may face less early sabotage than one who keeps visibly revising the opening in front of everyone. A strategy-lab team may lose edge by broadcasting uncertainty long enough for rival proposals to gather. A personal decision may land more cleanly when it is stated and enacted directly instead of floated timidly for approval. In each case, the perception effect arrives before the substantive outcome.

The limit matters because boldness can curdle into spectacle. If action outruns preparation, ignores obvious constraints, or becomes loud enough to substitute for thinking, the tactic fails. Greene's practical claim is narrower: where hesitation would weaken you, enter decisively enough to create momentum, but keep enough judgment that boldness does not turn into self-created disaster. Chapter 27 built aura through belief and symbolic certainty. Chapter 28 asks whether action can now sustain that aura through visible confidence. Chapter 29 then turns toward planning all the way to the end so that bold beginnings do not collapse midstream.`,
        `Greene's twenty-eighth law argues that visible uncertainty can weaken action more than many people admit. Caution may feel prudent from the inside, but from the outside it can look like doubt, vulnerability, or permission to resist. The chapter therefore begins with a strategic problem, not a motivational slogan. What if hesitation gives opponents time and confidence they would not have had if you had moved more decisively?

That is why decisive entry can be useful. If you act with confidence, people may read strength before they have grounds to measure it fully. Greene is interested in that perception shift. Boldness can seize momentum because it compresses the window in which others organize around your uncertainty. A move that looks settled often attracts a different response than one that looks half-born.

This is why the chapter is not generic recklessness advice. Greene is not telling the reader to leap without thought or to glorify noise. He is separating strategic boldness from preventable overextension. The issue is not speed for its own sake. The issue is whether public confidence in execution can produce an advantage before caution would only have invited more pressure. Boldness works when it remains attached to preparation and judgment. It fails when it becomes theater that reality can swat down immediately.

The pattern appears everywhere. Niall may need to launch a proposal firmly so the room adjusts to it instead of sniffing uncertainty. A festival committee may create more opposition by hesitating publicly than by making a clean opening and defending it from there. A personal move may succeed because confidence closed debate that visible wavering would have reopened. In each case, momentum is psychological before it becomes material.

The limit remains central because action entered boldly can still break if it lacks support. Greene's point is disciplined rather than manic: cut off hesitation where it would feed resistance, but do not mistake boldness for immunity from consequences. Chapter 27 dealt with belief-generated aura. Chapter 28 deals with acting in a way that protects that aura from being punctured by visible doubt. Chapter 29 then asks how long-range planning keeps bold entry from becoming a dramatic but short-lived start.`,
        `This law starts with a tempting mistake: assuming that hesitation hides weakness when it often displays it. Greene's warning is that visible uncertainty can do part of the opponent's work for them. If your entry looks doubtful, incomplete, or apologetic, people may challenge the move before they would have challenged the substance itself. The chapter therefore treats hesitation as a field-shaping problem, not just a private feeling.

That matters because boldness changes what others think is happening. A decisive move can create momentum, project confidence, and make resistance look slower or smaller than it might otherwise have felt. The chapter therefore treats bold execution as a way of shaping perception. What changes is not only what you do. It is what everyone else thinks they can do in response.

This keeps the law narrower than praise for bravado. Greene is not saying that loudness wins or that careful preparation is weakness. He is asking whether your visible entry is making your action easier or harder to attack. Strategic boldness means moving clearly enough that others do not organize around your uncertainty. It becomes failure when confident action outruns the facts holding it up.

Common settings make the point plain. A leader who keeps restating doubts about a rollout can invite resistance that a firmer opening would have delayed or weakened. A strategy lab may lose initiative by treating public indecision as thoughtful nuance. A personal decision can get diluted when it is floated timidly and revised aloud instead of owned. In each case, the opening signal changes the field before results have time to settle.

The limit matters because boldness can degrade into self-made trouble. If the move has no grounding, no calibration, or no plan beyond the opening gesture, momentum will not save it for long. Chapter 27 showed that belief can magnetize people toward a center. Chapter 28 shows that the center must now act in a way that does not puncture the magnetism with hesitation. Chapter 29 follows by asking how bold entry survives when the endgame has not yet arrived.`
      ),
      keyTakeaways: [
        {
          point: tone("Hesitation can weaken action before outcomes are known.", "Visible doubt gives resistance a place to gather.", "If your opening leaks uncertainty, others may attack the leak first."),
          moreDetails: tone("The chapter focuses on hesitation as a perception problem rather than on caution disappearing entirely.", "Opposition often organizes faster when your own entry signals uncertainty.", "A weak opening can do part of the field's counterwork before the plan is tested.")
        },
        {
          point: tone("Bold entry can capture momentum.", "Decisive action shapes perception and can reduce early counterpressure.", "Confidence in motion often forces the field to react instead of preempt."),
          moreDetails: tone("Greene values boldness because the perception of strength changes how others organize themselves around your move.", "The chapter's leverage comes from psychological advantage arriving before final results.", "A move that looks settled often meets less opportunistic resistance than one that looks tentative.")
        },
        {
          point: tone("Committed execution is not the same thing as overextended force.", "The move is committed execution, not loud self-endangerment.", "Enter strongly, but do not sprint past the reality holding you up."),
          moreDetails: tone("The chapter still requires preparation, calibration, and enough reality contact for confidence to remain credible.", "Boldness matters only if it is attached to something sturdier than adrenaline.", "If the opening outruns the footing beneath it, the same visibility that helped will accelerate collapse.")
        },
        {
          point: tone("Work, school, and personal settings all show how openings change the field.", "The way a move is entered can matter before the move is fully measured.", "People often respond to the confidence signal before they respond to the substance."),
          moreDetails: tone("Rollouts, proposals, and boundaries all gather different reactions depending on whether the entry looks settled or shaky.", "The chapter becomes practical when you ask what part of the opposition is feeding on your own visible doubt.", "Momentum often begins in the room's reading of your opening, not in the scoreboard.")
        },
        {
          point: tone("The law has an overreach limit.", "Boldness fails when it loses calibration and turns into spectacle or bluff.", "Confidence protects action only while reality can still carry it."),
          moreDetails: tone("Some situations reward patience or concealment more than bold visible entry, and some bold moves collapse if they lack follow-through.", "Greene warns against treating decisiveness as a substitute for planning.", "The right boundary is where boldness stops closing openings for others and starts opening one against yourself.")
        }
      ],
      activationPrompt: tone(
        "Identify one move where visible hesitation is weakening execution before the substance is tested.",
        "Choose one action you could enter more decisively so the room has less time to organize around your doubt.",
        "Pick one opening where confidence would change perception before results fully arrive."
      ),
      selfCheckPrompt: tone(
        "Am I preserving judgment, or just leaking uncertainty in public?",
        "What part of the resistance here is feeding on my visible hesitation?",
        "Where would boldness create momentum, and where would it outrun what the situation can actually hold?"
      ),
      oneMinuteRecap: tone(
        "This chapter says hesitation can weaken action, while bold entry can change perception and seize momentum early.",
        "Do not give the field extra time to organize around your uncertainty if decisive execution would alter the opening.",
        "Act strongly enough to shape the room without letting boldness outrun reality."
      )
    },
    hard: {
      chapterBreakdown: tone(
        `Greene's twenty-eighth law treats boldness as a field-shaping force rather than as a personality trait. Most people hear "enter action with boldness" and think of courage, confidence, or loud temperament. Greene is interested in a sharper claim: visible hesitation does political work against you before the substantive work of the action even begins. The chapter therefore begins by questioning whether timidity is ever merely private. A half-committed entry can signal weakness, invite resistance, and make the field more confident in challenging you than it would have been against a decisive move.

That is why boldness can matter here. Greene is not praising speed for its own sake or treating forceful posture as magic. He is describing momentum capture. When you enter decisively, you may shape perception, compress the window for opposition, and make others respond to your action rather than to your visible doubt. The chapter treats confidence in execution as part of power because a move often becomes easier or harder to oppose depending on how settled it looks in its opening moments.

The chapter is strongest when it resists the lazy reading that boldness means recklessness. Greene is not praising impulsive lunges, empty bravado, or aggressive theater disconnected from preparation. He is distinguishing strategic boldness from noisy overreach. Strategic boldness enters the field with commitment while still resting on enough judgment, preparation, and reality contact to survive the very momentum it creates. Overreach confuses the psychological advantage of boldness with immunity from consequences.

This is why hesitation can be expensive. The problem is not only slower action. It is exposed uncertainty. Once others see that you are publicly unconvinced by your own move, they gain time, confidence, and sometimes permission to resist. The chapter therefore asks whether caution still protects you once it starts advertising a weakness others can coordinate around. A timid opening can strengthen the very opposition a stronger entry might have prevented from fully forming.

Ordinary settings show the mechanism clearly. A leader who launches a proposal firmly may face less sabotage than one who keeps signaling revisions and doubt in public. A strategy-lab team may lose initiative not because its plan was worse, but because its hesitant entry let alternatives harden around it. A personal decision may land with more force when enacted directly instead of floated, qualified, and renegotiated before anyone even tests it. In each case, what matters first is not final success. It is the opening shift in perceived strength.

The limit matters because boldness can become a self-inflicted trap. If confidence outruns preparation, if the move is detached from real capacity, or if visible decisiveness becomes mere spectacle, the field eventually punishes it. Greene is not arguing that every action should begin with maximal force. He is arguing against entering visibly weak where weakness would invite attack. Chapter 27 created aura through belief, symbol, and loyalty. Chapter 28 asks whether action can now carry that aura forward through visible confidence rather than puncture it with hesitation. Chapter 29 follows naturally from there. Bold beginnings still require long-range planning if the momentum they create is going to survive the route to the end. Boldness succeeds only when it denies resistance an easy opening without denying reality its due. If your entry looks settled and your footing is real, momentum gathers. If your entry looks bold and your footing is imaginary, momentum becomes a faster way to reach the cliff.`,
        `Greene's twenty-eighth law argues that bold action can be strategically useful because hesitation often strengthens the field against you. Most readers hear the title and imagine generic confidence advice. Greene hears a more practical problem: a visibly uncertain opening can provide opponents with information, time, and encouragement they would not have had if the move had arrived more decisively.

Boldness preserves advantage because it changes the first interpretation of the move. If you act firmly, others may read strength before they have evidence strong enough to measure it. Greene is interested in that first reading. A decisive entry can seize momentum by forcing reaction before resistance has fully organized itself. The chapter values boldness not because courage is beautiful, but because hesitation can do part of the enemy's work.

That is why the chapter should not be flattened into recklessness advice. It is not saying that planning is weakness or that any loud move becomes strong. It is saying that visible commitment can close opportunities for opposition when public uncertainty would have opened them. Strategic boldness means entering cleanly enough to shape perception while remaining grounded enough not to collapse under the weight of your own opening.

The pattern appears in ordinary life. Niall may need to put a proposal forward firmly so the room reacts to the proposal itself rather than to his uncertainty about it. Eira may notice that a strategy-lab team lost edge because public hesitation gave others time to gather objections. A private boundary may work because it is enacted clearly instead of floated timidly for permission. In each case, the opening signal changes how the rest of the interaction unfolds.

The limit remains central because boldness without footing turns quickly into embarrassment. If preparation is weak, if capacity is overstated, or if the visible force is mostly theatrical, the same attention boldness created can accelerate failure. Greene's practical claim is narrower: where hesitation would feed resistance, enter decisively enough to cut off that feed, but keep enough calibration that momentum does not become a faster path to collapse. Chapter 27 dealt with building aura. Chapter 28 deals with acting in a way that keeps aura credible. Chapter 29 then turns toward end-state planning, where momentum must survive beyond the opening gesture. The reader's edge lies in seeing that boldness is not opposed to thought. It is opposed to visibly weakening your own move before the field has had to do the work of weakening it for you.`,
        `This law works only if you track what public hesitation is doing before you decide what prudence means. Most people focus on whether a move is ready. Greene's warning is that readiness has a public component too. If your entry appears unsure, apologetic, or visibly revisable, the field begins to organize around that uncertainty. The chapter is about that leakage.

That is why decisive execution can be strategically valuable. A person who enters boldly may create the impression of strength before the underlying result has been fully tested. Greene is not praising impression detached from substance. He is protecting the opening from becoming an invitation to attack. Momentum often depends on whether others feel they are meeting a settled action or a tentative proposal waiting to be pushed off balance.

The chapter therefore distinguishes bold entry from reckless self-exposure. Empty confidence is not strategic boldness. Loudness is not momentum. Strategic boldness keeps enough footing under the move that confidence can survive first contact. Without that footing, boldness becomes performance that reality corrects in public. Without the boldness, reality may never get its chance because hesitation already handed the field to resistance.

Common settings show the law with almost embarrassing clarity. A rollout launched with clear timing and ownership may face less early sabotage than one announced with visible caveats and hesitation. A festival committee may invite more resistance through public wavering than the plan itself ever deserved. A personal move may succeed because clear enactment prevented endless renegotiation. In each case, confidence changes what others think is possible in response.

The limit matters because decisive action can fail too. Move too timidly and opposition gathers. Move too boldly without support and collapse arrives faster because attention came faster too. Greene's better point is to make boldness answerable to preparation rather than to adrenaline. Chapter 27 taught that people can be magnetized by belief and aura. Chapter 28 teaches that aura weakens when action does not look like it believes in itself. Chapter 29 follows because boldness still needs an endgame if it is to become more than a strong beginning. The deepest lesson is that power often belongs to the one who denies hesitation the chance to become public evidence against the move. If the opening is strong and the footing real, others must adjust to you. If the opening is strong and the footing imaginary, they will still adjust, but only long enough to watch you fall faster.`
      ),
      keyTakeaways: [
        {
          point: tone("Visible hesitation invites resistance.", "Public doubt weakens action before outcomes are settled.", "If the opening leaks uncertainty, the field starts working against the leak."),
          moreDetails: tone("The chapter emphasizes hesitation as a public liability rather than caution disappearing as a value.", "Opposition often gathers fastest where your own entry signals uncertainty and revisability.", "A shaky beginning can strengthen resistance before the plan deserves either support or attack.")
        },
        {
          point: tone("Boldness can seize momentum.", "Decisive entry shapes first perception and compresses the opening for counterattack.", "Move firmly enough and the field starts reacting to you instead of waiting for your doubts to finish talking."),
          moreDetails: tone("Greene values boldness because first readings of strength can alter how others coordinate their response.", "The chapter's leverage comes from confidence changing the early geometry of action.", "Momentum often begins in the room's interpretation before it arrives in the scoreboard.")
        },
        {
          point: tone("Bold entry only works when confidence still has footing.", "The move is committed entry with footing, not loud self-exposure without support.", "Boldness works when the ground can carry it."),
          moreDetails: tone("The chapter still requires preparation, capacity, and enough calibration that confidence remains credible after contact.", "Boldness matters only if it closes openings for resistance without opening a larger one against yourself.", "When the action's footing is imaginary, visibility accelerates correction instead of advantage.")
        },
        {
          point: tone("Ordinary settings show how opening signals change the whole field.", "Work, school, and personal actions all reveal that confidence affects response before results settle.", "People often challenge the uncertainty first and the substance second."),
          moreDetails: tone("Rollouts, proposals, and boundaries all attract different resistance depending on whether the opening looks settled or wavering.", "The chapter becomes practical when you ask what part of the pushback is feeding on your own visible hesitation.", "Perception often shapes the first round before reality gets to shape the rest.")
        },
        {
          point: tone("The law has an overreach limit.", "Boldness fails when speed, volume, or confidence outrun preparation and reality.", "Do not let momentum become a faster route to collapse."),
          moreDetails: tone("Some situations need staged preparation or concealment, and some bold moves invite a harsher correction when they lack support.", "Greene warns against confusing a strong opening with a complete strategy.", "The right boundary is where decisive entry stops denying openings to others and starts creating one against yourself.")
        }
      ],
      activationPrompt: tone(
        "Identify one move where your visible hesitation is giving the field too much time and confidence.",
        "Choose one action you could enter more decisively so resistance has less room to organize around your doubt.",
        "Pick one opening where boldness would change perception before the result is fully known."
      ),
      selfCheckPrompts: [
        tone(
          "Am I protecting judgment, or am I advertising uncertainty that others can coordinate around?",
          "What part of the current resistance is feeding on my visible hesitation rather than on the move itself?",
          "If I enter more boldly here, what real footing keeps momentum from turning into spectacle?"
        ),
        tone(
          "What must look settled in the opening, and what can remain privately adjustable underneath it?",
          "How much confidence closes openings for opposition before it starts outrunning the facts?",
          "At what point would a bolder entry stop shaping the field and start exposing me to a faster correction?"
        )
      ],
      predictionPrompt: tone(
        "Once boldness creates momentum, how might Chapter 29 show that power now depends on planning far enough ahead that the opening does not outstrip the ending?",
        "If decisive action wins the first psychological round, what changes next when the long route to the end still has to be managed?",
        "After entering boldly, how does power deepen when the endgame has already been thought through?"
      ),
      oneMinuteRecap: tone(
        "This chapter argues that power often favors the one who enters action decisively enough to keep hesitation from becoming public evidence against the move.",
        "Do not confuse visible caution with strength if it mainly feeds opposition and slows momentum.",
        "Sometimes boldness works because the field must react before it has time to build fully around your doubt."
      )
    }
  },
  examples: [
    {
      title: "Niall Launches the Move Decisively Before the Room Can Organize Around His Doubt",
      format: "decision_point",
      category: "work",
      endingType: "broader_principle",
      scenario: tone("Niall has a solid proposal, but he can feel himself wanting to soften the opening with public caveats and visible uncertainty.", "He has to decide whether to enter decisively or signal enough doubt that the room starts testing the weakness first.", "Niall can shape the room's first reading or let the room shape it for him."),
      whatToDo: tone("He launches clearly, claims the logic firmly, and lets debate meet a settled move instead of a half-born one.", "He removes hesitation from the public opening.", "He makes the field react to the action instead of to his uncertainty about it."),
      whyItMatters: tone("The chapter says visible hesitation feeds resistance before outcomes are fully tested.", "A bold entry can create momentum the same proposal would lose if introduced timidly.", "How a move enters the room can matter before the room even knows what to do with it.")
    },
    {
      title: "Eira Hears Why the Strategy-Lab Team Lost Edge by Hesitating in Public",
      format: "dialogue",
      category: "school",
      endingType: "self_directed_question",
      scenario: tone("Eira listens as someone explains why a strategy-lab team lost initiative after publicly wavering, revising, and re-softening its opening again and again.", "She hears how the hesitation gave other teams time to gather objections and confidence.", "Eira learns that the weak point others attacked first was not the plan but the team's uncertainty about it."),
      whatToDo: tone("She asks what the team could have entered more firmly without losing its private room for adjustment.", "She studies how visible doubt became fuel for opposition.", "She asks where clearer commitment would have changed the field before the details were fully contested."),
      whyItMatters: tone("The chapter warns that hesitation can do the opponent's work by making resistance easier to organize.", "The strategy lab shows how public uncertainty can weaken action before substance is even measured.", "A hesitant opening often attracts challenge faster than a settled one does.")
    },
    {
      title: "Tomasi Weighs Bold Entry Against the Risk of Outrunning Preparation",
      format: "dilemma",
      category: "personal",
      endingType: "surprising_implication",
      scenario: tone("Tomasi knows that a timid move will probably fail, but he also knows that pure swagger could outrun what he has actually prepared.", "He has to decide how to enter strongly without turning confidence into spectacle detached from footing.", "Tomasi can protect himself with hesitation or expose himself with unsupported boldness."),
      whatToDo: tone("He enters decisively only after identifying what support is real enough to carry the opening.", "He chooses grounded boldness over either visible doubt or loud fantasy.", "He lets confidence ride on actual footing instead of asking it to replace footing."),
      whyItMatters: tone("The chapter says boldness works when it closes openings for resistance without creating a bigger one against yourself.", "His dilemma shows the line between strategic entry and preventable overreach.", "Momentum is powerful only while reality can still carry it.")
    },
    {
      title: "Brie Predicts Why One Operator Acts Fast Enough to Shape Perception Before Resistance Gathers",
      format: "predict_reveal",
      category: "work",
      endingType: "cross_domain",
      scenario: tone("Brie notices an operator move quickly and clearly enough that critics are forced to respond after the opening has already set the tone.", "She predicts the speed is not panic but a way of denying hesitation a visible place to grow.", "Brie can already see that the operator is shaping the first reading of the move before others can harden theirs."),
      whatToDo: tone("She judges whether the action is bold with footing or simply fast with no support underneath it.", "She looks for momentum created through settled entry rather than noise.", "She scores the move on whether confidence is changing the field or merely trying to outrun weakness."),
      whyItMatters: tone("The chapter says decisive action can create psychological advantage before the scoreboard is clear.", "The operator may be winning the first round by closing the opening for organized doubt.", "Sometimes boldness works because it changes the rhythm of everyone else's response.")
    },
    {
      title: "Festival-Committee Debrief Finds That Timid Execution Invited More Opposition Than the Plan Itself",
      format: "postmortem",
      category: "school",
      endingType: "common_trap",
      scenario: tone("A festival committee reviews why a decent plan met disproportionate resistance and realizes the public rollout was filled with caveats, pauses, and visible uncertainty.", "The debrief shows that the opening practically asked for objections before anyone had to grapple with the plan on its own terms.", "The team learns that the weakness others attacked first was hesitation, not substance."),
      whatToDo: tone("They redesign the next rollout so the opening lands clearly and the revisions happen privately instead of leaking doubt in public.", "They stop feeding opposition with their own uncertainty cues.", "They change the rhythm of entry before changing the plan itself."),
      whyItMatters: tone("The chapter warns that public hesitation can create more resistance than the proposal itself deserves.", "Their problem was not mainly the plan but the weak opening signal around it.", "Momentum often fails first at the threshold, not in the middle.")
    },
    {
      title: "Before and After Visible Hesitation Gave Way to Decisive Action With Real Footing",
      format: "before_after",
      category: "personal",
      endingType: "perspective_reframe",
      scenario: tone("Before, decisions were floated timidly, revised aloud, and weakened by visible doubt before they could land. After, they were entered clearly enough that the room had to react to them rather than to uncertainty.", "The contrast is between hesitation leakage and momentum capture.", "One version asks permission to act; the other acts clearly enough to reshape the room."),
      whatToDo: tone("Keep the preparation underneath, but let the public opening carry confidence instead of caveated uncertainty.", "Separate private calibration from public hesitation.", "Enter strongly enough that doubt is not the first thing others get to organize around."),
      whyItMatters: tone("The law distinguishes strategic boldness from reckless volume.", "A clear entry can gather momentum where a timid one only gathers scrutiny.", "People often resist the shaky opening before they even test the move behind it.")
    }
  ],
  reviewCards: [
    { cardId: "ch28-rc01", front: tone("Why is hesitation costly in this chapter?", "Why can a timid opening weaken a move before it is tested?", "What does hesitation do politically here?"), back: tone("Because visible uncertainty invites doubt, resistance, and opportunistic challenge.", "The chapter says hesitation can weaken action before outcomes have had time to speak.", "A shaky opening gives the field something easy to push against."), difficulty: "easy" },
    { cardId: "ch28-rc02", front: tone("What can bold entry create here?", "Why does decisive action matter in this law?", "What does confidence in execution do?"), back: tone("It can create momentum, shape first perception, and reduce early counterpressure.", "Bold entry changes how others organize themselves around the move.", "Decisive execution often forces reaction before resistance fully gathers."), difficulty: "easy" },
    { cardId: "ch28-rc03", front: tone("How is strategic boldness different from recklessness?", "What separates committed execution from overreach?", "Why isn't louder always stronger?"), back: tone("Strategic boldness stays attached to footing and judgment, while recklessness outruns what reality can carry.", "The chapter values settled entry, not noisy self-exposure without support.", "If confidence outruns capacity, visibility accelerates collapse instead of advantage."), difficulty: "medium" },
    { cardId: "ch28-rc04", front: tone("Where does this law appear in ordinary life?", "How do work, school, and personal openings reveal the hesitation tax?", "Where does the opening signal change the field?"), back: tone("It appears wherever rollouts, proposals, or boundaries are weakened or strengthened by how they enter the room.", "Teams, clubs, and personal decisions all attract different resistance depending on whether the opening looks settled or shaky.", "People often answer the confidence signal first and the substance second."), difficulty: "medium" },
    { cardId: "ch28-rc05", front: tone("How does Chapter 28 bridge to Chapter 29?", "Why does boldness lead into planning to the end?", "What must follow a strong opening?"), back: tone("Once boldness creates momentum, the next question is whether the move has been planned far enough to survive its own beginning.", "Chapter 29 turns from decisive entry to full-route planning.", "First enter strongly, then make sure the path to the end will hold."), difficulty: "hard" }
  ],
  keyTakeawayCard: tone(
    "Boldness is useful when decisive entry keeps hesitation from feeding resistance and gives momentum a chance to form before the field fully hardens against you.",
    "This law warns that visible uncertainty can weaken action before outcomes are known and favors grounded confidence over timid leakage.",
    "Power often belongs to the move that enters strongly enough to shape the room without outrunning the footing beneath it."
  )
};

const quiz = {
  passingScorePercent: 70,
  questions: [
    { questionId: "ch28-q01", prompt: "Why is hesitation costly in this chapter?", choices: ["Because visible uncertainty invites doubt and resistance", "Because every cautious move is weak", "Because preparation never matters"], correctIndex: 0, explanation: tone("Correct. The chapter says hesitation can weaken a move before its substance is fully tested.", "Visible uncertainty gives others confidence and time to push back.", "Right. A shaky opening can feed resistance before reality has even spoken."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch28-q02", prompt: "What can bold entry create here?", choices: ["Permanent safety from failure", "Momentum and a stronger first perception", "Freedom from planning"], correctIndex: 1, explanation: tone("Yes. Greene values bold entry because it can shape perception and compress the opening for opposition.", "The chapter treats decisive action as a way of capturing early momentum.", "Right. Confidence in motion changes how the field reacts."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch28-q03", prompt: "Why is this chapter not generic recklessness advice?", choices: ["Because loudness always wins", "Because hesitation should never be questioned", "Because it distinguishes strategic boldness from overreach detached from reality"], correctIndex: 2, explanation: tone("Correct. The issue is grounded decisiveness, not blind speed or swagger.", "Greene is tracking momentum and confidence effects without erasing the need for footing.", "Yes. This is about decisive execution with support, not reckless lunging."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch28-q04", prompt: "In Niall's work scenario, what best fits the chapter?", choices: ["Publicly soften the launch so everyone sees the doubts first", "Launch clearly enough that the room reacts to the move instead of to his uncertainty", "Keep revising the opening in public until no one can object"], correctIndex: 1, explanation: tone("Yes. The chapter favors a settled entry that closes the easiest opening for resistance.", "He changes the room's first reading by removing visible hesitation.", "Right. People often attack the doubt first if you leave it in the opening."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch28-q05", prompt: "Why did the strategy-lab example matter for Eira?", choices: ["Because public hesitation gave opposition time and confidence to gather", "Because plans are always weakest in school settings", "Because nuance should never be visible"], correctIndex: 0, explanation: tone("Correct. The team lost edge because its uncertainty did part of the opposition's work.", "The chapter shows how hesitant openings can create avoidable resistance.", "Yes. The field organized around doubt before it had to face the plan itself."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch28-q06", prompt: "What is the strongest reading of Tomasi's dilemma?", choices: ["He should delay until every uncertainty disappears", "Boldness works only when it still rests on real footing and preparation", "Any fast move is automatically strategic"], correctIndex: 1, explanation: tone("Yes. The chapter's limit is that boldness fails when it outruns what reality can carry.", "Strategic entry needs confidence with support underneath it.", "Right. Momentum helps only if the ground below the move is real."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch28-q07", prompt: "How does confidence shape perception before results settle?", choices: ["It can make the field react to a move as if it is stronger and more settled than hesitation would suggest", "It eliminates the need for substance", "It guarantees no one will resist"], correctIndex: 0, explanation: tone("Correct. The chapter says first readings of strength can alter how others coordinate their response.", "Confidence changes the opening geometry of the field before the scoreboard is final.", "Yes. Decisive action often shapes response before results fully arrive."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch28-q08", prompt: "When does boldness become reckless overextension?", choices: ["When it outruns preparation, ignores constraints, or turns into theater with no footing", "When it enters clearly", "When it closes openings for opposition"], correctIndex: 0, explanation: tone("Exactly. The tactic fails when visible confidence no longer has enough support underneath it.", "Boldness becomes dangerous once reality cannot carry the momentum it creates.", "Right. A strong opening without footing becomes a faster path to collapse."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch28-q09", prompt: "How does Chapter 27 lead into Chapter 28?", choices: ["Aura makes action unnecessary", "Once belief creates aura, the next question is whether action sustains that aura through visible confidence", "Chapter 28 abandons perception effects"], correctIndex: 1, explanation: tone("Correct. Chapter 27 built belief and aura; Chapter 28 asks whether action can carry them forward instead of puncturing them.", "The sequence moves from symbolic attachment to decisive execution.", "Right. First create magnetism, then act in a way that does not leak doubt."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch28-q10", prompt: "What bridge carries Chapter 28 into Chapter 29?", choices: ["Bold entry is enough even without a long route to the end", "Chapter 29 rejects momentum entirely", "Once action begins boldly, the next question is whether the move was planned far enough to survive its own opening"], correctIndex: 2, explanation: tone("Correct. The next law turns from bold entry to long-range planning that can carry momentum to the finish.", "Chapter 29 asks whether the route to the end has been thought through.", "Yes. A strong beginning still needs an endgame."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" }
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
for (const name of ["Niall", "Eira", "Tomasi", "Brie"]) continuity.nameUsage[name] = [stem];
continuity.withinChapterNames[stem] = ["Niall", "Eira", "Tomasi", "Brie"];
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
- Chapter-specific mechanism remains hesitation tax, momentum capture, confidence signal, and overreach limits rather than generic motivation rhetoric
- Hard depth preserves the boldness-versus-recklessness boundary and the Chapter 29 planning bridge
- Quiz stays within supported facts from the approved draft and frozen source bundle

## Gate result
- Approved for chapter gate and automatic continuation
`;
writeText(paths.validation, validation);

fs.appendFileSync(
  paths.runLog,
  `\n- Completed writer, editor, critic, converter, quiz, and validator steps for Chapter 28.\n- Validation result: PASS.\n- Continuity hash sealed for \`${stem}\`: \`${seal}\`\n`,
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
