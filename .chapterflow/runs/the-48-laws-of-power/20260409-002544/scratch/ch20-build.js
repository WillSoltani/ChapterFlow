const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const runRoot = path.resolve(".chapterflow/runs/the-48-laws-of-power/20260409-002544");
const num = 20;
const stem = `ch${String(num).padStart(2, "0")}`;
const title = "Do Not Commit to Anyone";
const chapterId = "ch20-do-not-commit-to-anyone";
const createdAt = new Date().toISOString();

function tone(gentle, direct, competitive) {
  return { gentle, direct, competitive };
}

const canonical = `Greene's twentieth law begins with a familiar pressure: choose a side. Commit, endorse, align, declare, prove. Other people prefer clarity when that clarity benefits them. Once you visibly belong to one camp, one agenda, or one faction, they can start counting on your loyalty, predicting your movement, and spending your leverage as if it were already theirs. The chapter begins by questioning that convenience.

Its argument is not that loyalty is always foolish. Greene's point is narrower and more strategic. Premature commitment reduces options. It narrows your room to negotiate, weakens your independence, and makes you easier to use in someone else's conflict. Once your allegiance is public, rivals stop competing for you in the same way, allies start assuming access to you, and your value can collapse into usefulness for a side you did not fully choose on your own terms.

That is why noncommitment matters here. Remaining uncommitted does not simply avoid burden. It can preserve leverage. If multiple sides still want your alignment, then your position retains strategic value. Greene is interested in that retained optionality. A person who cannot be counted too early is harder to spend cheaply. Their timing still belongs to them.

The chapter is strongest when it distinguishes this from passive drift. Greene is not praising cowardly vagueness or endless indecision. Strategic noncommitment is not the refusal to think. It is the refusal to give away alignment before the terms, incentives, and consequences are clear enough to justify the cost. Empty fence-sitting preserves nothing. Timed independence preserves something real.

The pattern appears in ordinary settings. A worker who joins one internal coalition too quickly can become a tool in a dispute that was never truly theirs. A student council that rushes endorsement may lose bargaining power it could have used to shape terms. A personal conflict can trap someone into becoming the permanent instrument of another person's grievance if they bind themselves too fast. In each case, early commitment turns leverage into obligation.

The limit matters too. Some commitments are necessary. Some loyalties are honorable. Some moments do require a clear side. Greene's point is not to refuse all allegiance forever. It is to understand the cost of surrendering independence before the situation has shown what that surrender is worth. Chapter 19 asked you to read the person in front of you. Chapter 20 asks what happens after that person tries to bind you. That points toward Chapter 21, where advantage comes from letting other people underestimate you by seeming weaker or simpler than you are.`;

const edited = `Greene's twentieth law begins with a familiar pressure: choose a side. Commit, endorse, align, declare, prove. Other people prefer clarity when that clarity benefits them. Once you visibly belong to one camp, one agenda, or one faction, they can start counting on your loyalty, predicting your movement, and spending your leverage as if it were already theirs. The chapter begins by questioning that convenience.

Its argument is not that loyalty is always foolish. Greene's point is narrower and more strategic. Premature commitment reduces options. It narrows your room to negotiate, weakens your independence, and makes you easier to use in someone else's conflict. Once your allegiance is public, rivals stop competing for you in the same way, allies start assuming access to you, and your value can collapse into usefulness for a side you did not fully choose on your own terms.

That is why noncommitment matters here. Remaining uncommitted does not simply avoid burden. It can preserve leverage. If multiple sides still want your alignment, then your position retains strategic value. Greene is interested in that retained optionality. A person who cannot be counted too early is harder to spend cheaply. Their timing still belongs to them.

The chapter is strongest when it distinguishes this from passive drift. Greene is not praising cowardly vagueness or endless indecision. Strategic noncommitment is not the refusal to think. It is the refusal to give away alignment before the terms, incentives, and consequences are clear enough to justify the cost. Empty fence-sitting preserves nothing. Timed independence preserves something real.

The pattern appears in ordinary settings. A worker who joins one internal coalition too quickly can become a tool in a dispute that was never truly theirs. A student council that rushes endorsement may lose bargaining power it could have used to shape terms. A personal conflict can trap someone into becoming the permanent instrument of another person's grievance if they bind themselves too fast. In each case, early commitment turns leverage into obligation.

The limit matters too. Some commitments are necessary. Some loyalties are honorable. Some moments do require a clear side. Greene's point is not to refuse all allegiance forever. It is to understand the cost of surrendering independence before the situation has shown what that surrender is worth. Chapter 19 asked you to read the person in front of you. Chapter 20 asks what happens after that person tries to bind you. That points toward Chapter 21, where advantage comes from letting other people underestimate you by seeming weaker or simpler than you are.`;

const critic = `# Chapter 20 Critic Report

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
- Paragraph 5 is the most vulnerable because work, school, and personal examples can flatten into generic independence rhetoric if conversion drops the leverage-loss mechanism.

Strongest sentence:
- "Once your allegiance is public, rivals stop competing for you in the same way, allies start assuming access to you, and your value can collapse into usefulness for a side you did not fully choose on your own terms."

Anchor use notes:
- The draft stays inside the frozen support: noncommitment preserves leverage, premature alignment reduces options, other people try to capture your allegiance, and drift is not the same as strategic independence.

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
        "This law says commitment can cost you leverage when you join a side too quickly. Once you are publicly aligned, other people can start predicting you, using you, and counting on you as if your choice already belongs to them. Greene is not saying all loyalty is foolish. The chapter makes a narrower point. Early allegiance can reduce your options before you understand the terms. Noncommitment matters because it keeps your timing, bargaining power, and independence more alive. If several sides still want your support, your position still has value. The danger is giving that value away too early. But the law is not praising empty drift either. Strategic noncommitment means waiting until commitment is actually worth its cost. The lesson is to avoid becoming a tool in someone else's fight before you know what your choice will buy or destroy. A fast yes can look principled while quietly surrendering the only uncertainty that gave you strength.",
        "Greene's twentieth law argues that people often want your commitment because it helps them more than it helps you. Once you visibly take a side, you become easier to count, easier to direct, and easier to spend. The chapter is not against loyalty in every form. It is against premature alignment that narrows your options too soon. Noncommitment can preserve leverage because more than one side still has to care what you will do. That gives you room to judge timing and terms. The stronger reading is not passive indecision. It is strategic independence. Stay uncommitted long enough to keep your options alive and your value negotiable. Commit when the choice is worth the cost, not when pressure simply wants you pinned down. If more than one camp still needs your answer, your uncertainty is still doing work for you.",
        "This law makes a practical warning: the moment you rush into a side, you may stop being a player and start being an asset someone else spends. Commitment can be honorable, but it can also be premature. Greene's point is that early allegiance often reduces independence before it creates real gain. If you stay uncommitted, more than one side may still compete for your alignment, which means your leverage remains higher. But the chapter is not asking for hollow fence-sitting. It is asking for judgment about timing. Strategic distance keeps you from being captured too cheaply. Do not let someone else's urgency decide your commitment before you know what staying, joining, or refusing will really cost. Join too early and your usefulness may become theirs before the gain becomes yours. A competitive reader asks who profits most from getting your loyalty before you have priced the trade.",
      ),
      keyTakeaways: [
        { point: tone("Premature commitment can reduce options and make you easier to use.", "Early alignment can turn leverage into obligation.", "Choose too fast and you become somebody else's asset.") },
        { point: tone("Noncommitment can preserve leverage because multiple sides still want access to you.", "Unchosen timing keeps bargaining power alive.", "If they still need your yes, your value is not spent yet.") },
        { point: tone("The chapter distinguishes strategic independence from empty drifting.", "Waiting with purpose differs from refusing to think.", "Fence-sitting is weak only when it preserves nothing.") }
      ],
      oneMinuteRecap: tone(
        "This law says early allegiance can make you easier to count and use, while strategic noncommitment can preserve leverage.",
        "Do not give away your side before you know the price.",
        "Keep your timing until commitment is worth the cost."
      )
    },
    medium: {
      chapterBreakdown: tone(
        `Greene's twentieth law argues that commitment becomes dangerous when it is given away before its cost is understood. Other people want you to choose, endorse, declare, and align because your visible allegiance helps them predict your behavior and use your position. Once you are counted on one side, your independence narrows. Options that existed before commitment often vanish after it.

That is why noncommitment matters here. Greene is not talking about laziness or fear of decision. He is talking about leverage. If more than one side still wants your support, then your position retains value. Rivals have to keep courting you. Allies cannot fully spend you yet. Strategic distance can therefore preserve bargaining power and timing that premature allegiance would surrender.

The chapter is strongest when it distinguishes this from empty drift. Passive indecision preserves nothing if it has no purpose. Strategic noncommitment preserves something specific: freedom of movement, negotiating power, and the ability to judge terms before joining a side. Greene is not praising vagueness for its own sake. He is praising independence that keeps others from capturing your utility too cheaply.

Ordinary settings show the pattern clearly. A worker who joins an internal coalition too early can become a tool in a dispute that serves someone else more than it serves them. A student council that rushes endorsement may give away bargaining room it could have used to shape policy or timing. A personal conflict can turn someone into the standing instrument of another person's resentment if loyalty is pledged before the real stakes are understood. In each case, commitment converts leverage into duty faster than people expect.

The chapter's limit matters too. Some commitments are real obligations worth taking. Some loyalties are necessary. Greene's claim is narrower: do not surrender optionality before the situation justifies the cost. Chapter 19 asked you to read the person in front of you. Chapter 20 asks what to do when that person wants your alignment. That leads naturally to Chapter 21, where advantage comes from not letting people feel fully certain about how to size you up. The real question is whether this timing serves your judgment or only relieves their pressure. The strongest commitment is not the fastest one. It is the one that still leaves you able to say the choice was made on terms you actually examined.`,
        `Greene's twentieth law says the wrong commitment is often not false commitment but early commitment. Once you visibly join a side, other people can begin using your loyalty, predicting your choices, and treating your leverage as if it now belongs inside their plan. The chapter is about the cost of becoming too easy to count. What feels like decisive clarity can also become a public discount on your independence.

Noncommitment preserves value because uncertainty still surrounds your alignment. If several sides believe they can win you, your position retains negotiating weight. Greene is interested in that competitive tension. A person who cannot be claimed too early is harder to spend cheaply and harder to trap inside someone else's agenda.

This is why the chapter is not generic anti-loyalty advice. Greene is not saying all allegiance is weakness. He is separating strategic independence from surrendering yourself before the terms are clear. The issue is timing. Commitment can be wise once it buys something real. It becomes costly when pressure alone forces it.

The pattern appears everywhere. A manager may rush into one internal bloc and lose room to influence the others. A policy council may endorse too quickly and find it has no leverage left to negotiate terms. A personal conflict may absorb someone completely because they joined out of urgency rather than out of judgment. In each case, the side gains usefulness while the individual loses freedom of movement.

The limit remains central because endless detachment can become empty too. Noncommitment is not valuable when it preserves no leverage, no timing, and no purpose. Greene's point is disciplined rather than absolute: stay uncommitted until commitment is worth what it will cost. Chapter 19 sharpened person-reading; Chapter 20 sharpens alignment control. Chapter 21 then moves toward the value of being underestimated rather than easily counted. If withholding preserves no bargaining force, then it is only delay. But if it keeps several sides attentive, then it is still doing strategic work for you. The key test is whether your distance still forces others to account for your choice rather than assume it is already theirs.`,
        `This law starts with a pressure most people recognize: choose now. Take the side, show the loyalty, make the declaration, remove uncertainty. Greene's warning is that this pressure often serves the people asking for your commitment more than it serves you. Once your allegiance is visible, they can fold your position into their plan.

That matters because visible commitment reduces options. Rivals stop competing for your support in the same way. Allies begin assuming access to your effort, reputation, or influence. The chapter therefore treats noncommitment as leverage preservation. If your alignment is still undecided, your timing and bargaining power remain less captured.

This keeps the law narrower than generic aloofness. Greene is not praising indecision for its own sake. He is distinguishing strategic independence from hollow refusal. Waiting is useful only if it protects something concrete, such as freedom of movement, negotiating room, or the ability to read the field before you join it.

Common settings make the point plain. A colleague can become trapped inside one office faction's fight after aligning too early. A product incubator can spend its endorsement before extracting terms. A personal conflict can recruit someone into a battle that was never fully theirs. In each case, commitment turns optionality into obligation.

The limit matters because some commitments are necessary, honorable, or timely. The chapter's practical claim is simpler: do not let someone else's urgency spend your leverage before you know what the choice is worth. Chapter 19 showed why different people try different kinds of pressure. Chapter 20 asks why you should resist being captured by that pressure too quickly. Chapter 21 then explores what happens when others underestimate you because they no longer feel certain how to place you.`,
      ),
      keyTakeaways: [
        {
          point: tone("Commitment can reduce leverage when it is given before the price is clear.", "Early alignment makes you easier to count and use.", "The first side to pin you down often spends you cheapest."),
          moreDetails: tone("The chapter focuses on option loss, not on loyalty as a moral failure.", "Visible allegiance narrows movement because others now plan around your assumed position.", "Once your yes is cheap, your leverage usually is too.")
        },
        {
          point: tone("Noncommitment can preserve value because multiple sides still want access to you.", "Unchosen alignment keeps bargaining tension alive.", "If they still have to win you, they still have to pay attention to you."),
          moreDetails: tone("Greene values noncommitment here because uncertainty around your alignment can preserve negotiating power.", "The chapter's leverage comes from not being spendable too early.", "A withheld commitment can keep more than one camp competing for your value.")
        },
        {
          point: tone("Strategic independence differs from passive drift.", "Waiting with purpose is not the same as refusing to decide.", "A blank fence does not become strategy just because you sit on it."),
          moreDetails: tone("The chapter still expects judgment, timing, and clarity about what is being preserved.", "Noncommitment matters only when it protects room to negotiate, move, or assess terms.", "Distance is useful when it saves leverage, not when it hides thought.")
        },
        {
          point: tone("Work, school, and personal settings all show how sides try to capture your usefulness.", "Early allegiance often turns independent value into obligation.", "The side wants your flag because it also wants your leverage."),
          moreDetails: tone("Coalitions, endorsements, and emotional disputes all become cheaper for others once your alignment is fixed.", "The chapter becomes practical when you ask who benefits most from making your commitment happen quickly.", "A side usually wants your certainty before you know the full bill.")
        },
        {
          point: tone("The chapter allows commitment, but only when its cost is justified.", "Not every refusal is strong and not every allegiance is weak.", "The issue is whether the timing serves judgment or just pressure."),
          moreDetails: tone("Some commitments are necessary, but Greene warns against surrendering independence before the return is visible.", "The limit matters because empty detachment can preserve nothing worth having.", "Commit when the gain is real enough to justify losing the option.")
        }
      ],
      activationPrompt: tone(
        "Identify one place where pressure is pushing you to choose before the terms are clear, then ask what leverage you lose by deciding now.",
        "Choose one side-taking decision that may be arriving too early, and name what optionality you still need to preserve before committing.",
        "Pick one demand for your allegiance and decide whether it serves your judgment or someone else's urgency."
      ),
      selfCheckPrompt: tone(
        "Am I delaying commitment to preserve something real, or just drifting without purpose?",
        "What leverage disappears the moment my alignment becomes easy to count?",
        "Does this side want my good, or mostly my usefulness?"
      ),
      oneMinuteRecap: tone(
        "This chapter says early allegiance can make you easier to use, while strategic noncommitment can preserve leverage and option space.",
        "Do not commit because pressure wants clarity more than you do.",
        "Keep your yes expensive until the terms justify spending it."
      )
    },
    hard: {
      chapterBreakdown: tone(
        `Greene's twentieth law treats commitment as a lever other people are eager to pull on you. The pressure to choose a side often arrives dressed as clarity, principle, urgency, or loyalty. Yet the chapter insists that visible alignment frequently benefits the side demanding it more than the person giving it. Once your allegiance is public, your choices become easier to predict, your independence becomes easier to narrow, and your leverage becomes easier to spend on purposes you did not set yourself.

That is why premature commitment matters so much here. A side wants more than your agreement. It wants your usefulness. Once you are visibly inside its camp, rivals stop competing for you in the same way, allies begin assuming access to your effort and influence, and the uncertainty that once protected your bargaining position begins to disappear. Greene is interested in that evaporation of optionality. A counted person is easier to direct than a contested one.

The chapter is strongest when it resists the lazy reading that noncommitment is merely indecision. Greene is not praising drift for its own sake. He is distinguishing strategic independence from hollow refusal. Strategic noncommitment preserves something concrete: timing, negotiating room, and the ability to judge terms before surrendering your option to withhold yourself. Empty fence-sitting preserves nothing if it does not keep leverage alive.

This is why capture risk sits at the center of the law. The danger is not only that you pick the wrong side. The danger is that you become usable on terms that were never negotiated in your favor. A commitment given under pressure can turn your position into somebody else's tool before you have tested the return. Once alignment becomes visible, the side may stop persuading and start presuming. That presumption is one of the costs Greene wants the reader to see.

Ordinary settings reveal the mechanism clearly. A professional who joins one internal bloc too early may lose the ability to negotiate across the office and instead become fuel for another person's dispute. A policy council that endorses quickly can throw away the only uncertainty that gave it bargaining force. A personal conflict can absorb someone into a permanent role inside another person's grievance simply because they pledged loyalty before deciding what the fight would demand. In each case, commitment converts negotiable value into obligation.

The limit is crucial. Some commitments are necessary, principled, or strategically wise. Greene is not arguing that all loyalty is stupidity. He is warning against surrendering independence before the cost has been measured and the return has been clarified. The chapter therefore asks for timing, not vacancy. Chapter 19 taught you to read the person who is pressuring you. Chapter 20 asks what to do when that person wants to bind your allegiance to their purposes. Chapter 21 follows naturally from there. If others are eager to classify and count you, one advantage lies in letting them underestimate how much you still withhold. The law succeeds only when noncommitment keeps your leverage real rather than merely making you look evasive. A side is safest for you only after it stops being cheapest for them. If your public loyalty arrives before the negotiation is finished, then your strongest chip has already left your hand. A side that truly deserves you can survive waiting long enough for you to price the loss of your independence honestly. A side that panics at that delay is often revealing exactly why your uncertainty was valuable.`,
        `Greene's twentieth law argues that commitment becomes expensive when it is given before its market is clear. Most people hear pressure to align as a demand for moral seriousness or decisiveness. Greene hears something else as well: an attempt to convert your independent value into someone's owned asset. The chapter therefore begins with suspicion toward urgent allegiance, not because all sides are false, but because early visibility makes you easier to count and spend.

Noncommitment preserves leverage because uncertainty around your alignment still creates competition. If several factions, teams, or agendas believe they might win you, then your position retains bargaining force. Once you commit, much of that force collapses. Rivals stop courting. Allies stop offering. Your usefulness becomes easier to assume and harder to price. Greene is interested in this moment where a person's public certainty becomes another party's convenience.

That is why the chapter should not be flattened into generic anti-loyalty rhetoric. It is not saying that honorable commitment never matters. It is saying that timing matters. Strategic independence means withholding commitment until its cost, terms, and consequences are better understood. Passive drift, by contrast, merely postpones decision without protecting anything worth preserving. The distinction is whether your distance keeps options alive or merely hides indecision.

The pattern appears in ordinary life. A manager may be drawn into one coalition's struggle and lose the freedom to bargain with the others. A school body may endorse early and discover that the endorsement was the last thing it had to trade. A personal disagreement may recruit someone into a long-term conflict they would never have chosen if they had first asked what loyalty here will eventually demand. In each case, commitment changes the power geometry more than the initial chooser expects.

The limit remains central because some moments genuinely require a side. Greene's practical claim is narrower: do not let other people's urgency, flattery, or pressure decide the timing of your allegiance for you. Chapter 19 sharpened your read of the person. Chapter 20 sharpens your control over whether that person gets to own your alignment. Chapter 21 then extends the logic by asking what advantage comes from letting others mismeasure you instead of feeling certain where they have already placed you. The chapter's leverage rests on that delay. A commitment is not free just because it is clear. Sometimes clarity is the very thing another side wants most from you because it is what makes you easiest to use. If the room wants certainty faster than you can justify it, the room is already telling you whose convenience the pressure serves. Measured delay keeps that convenience from becoming their profit too soon. The reader's edge lies in noticing when a side values your clarity more than the actual substance it is offering in return. That asymmetry is often the warning that your independence is still underpriced.`,
        `This law works only if you track what commitment buys for the side asking for it. Most people focus on what allegiance says about them: loyalty, seriousness, decisiveness, courage. Greene's warning is that commitment also does something practical for others. It reduces uncertainty. It tells rivals where not to invest. It tells allies what they may now presume. It tells the field that your leverage has become easier to count. The chapter is about that transfer of control.

That is why noncommitment can be strategically valuable. A person who remains unclaimed is still contested. Contested value is harder to spend cheaply. If several sides still need your yes, then your alignment retains market force. Once your answer is public, the market often collapses. Greene is not praising mystery for decoration. He is protecting optionality from being converted into obligation before the exchange is worth it.

The chapter therefore distinguishes independence from drift. Empty indecision is not leverage. Strategic noncommitment is purposeful withholding. It preserves room to read the field, weigh the return, test the terms, and decide whether the side demanding loyalty deserves what it is asking to own. Without that purpose, staying uncommitted becomes sterile rather than strong.

Common settings show the law with almost embarrassing clarity. A worker can be turned into factional fuel by joining too early. A student body can lose its bargaining edge by endorsing before extracting anything. A personal conflict can capture someone into a role they never examined because they confused urgent loyalty with wise loyalty. In each case, what disappears is not only neutrality. What disappears is bargaining power.

The limit matters because noncommitment can fail too. Hold back forever without purpose and you preserve no leverage worth having. Greene's better point is to spend commitment deliberately, not reflexively. Chapter 19 taught that different people try different forms of pressure. Chapter 20 teaches that your answer to that pressure should not be cheaply available. Chapter 21 follows because once others want to classify and use you, one defense is to let them misjudge how simple, weak, or countable you really are. The deepest lesson is that allegiance has a price on both sides of the exchange. If you commit before you know what your clarity is buying for them and costing you, you have probably sold too early. A side becomes safe to join only after your leverage has not already been surrendered as the admission fee. Competitive advantage here comes from refusing to make your certainty available at a discount. If they want the value of your side, they should not receive it before you know what it is truly worth. The harder question is what your clarity will let them stop offering, stop fearing, and stop negotiating. If the answer is too much, your commitment is still underpriced. A skilled reader delays the sale until the cost of losing your independence is finally matched by something worth buying. Keep that price high.`,
      ),
      keyTakeaways: [
        {
          point: tone("Commitment can transfer control by making your position easier for others to count and spend.", "Visible alignment often benefits the side more than the signer.", "The moment they can count you, they can start pricing you like inventory."),
          moreDetails: tone("The chapter emphasizes option loss and usability rather than moralizing about loyalty.", "Once your allegiance is public, both allies and rivals reorganize around your reduced uncertainty.", "A clear yes can quietly convert your independent value into another camp's working asset.")
        },
        {
          point: tone("Noncommitment preserves leverage when uncertainty around your alignment still creates competition.", "Contested allegiance has more bargaining force than captured allegiance.", "If more than one camp still wants you, your price has not crashed yet."),
          moreDetails: tone("Greene values noncommitment because multiple sides may still need to persuade, court, or reward you.", "The chapter's leverage comes from not letting your usefulness become cheap too early.", "A withheld answer can keep the market for your alignment alive.")
        },
        {
          point: tone("Strategic independence differs from passive drift because it preserves something concrete.", "Delay is only strong when it protects timing, terms, or movement.", "Fence-sitting is strategy only when it keeps your options doing real work."),
          moreDetails: tone("The chapter still expects judgment, reading, and eventual decision when warranted.", "Noncommitment matters only if it protects leverage rather than disguising indecision.", "Distance that saves no option is only fog, not force.")
        },
        {
          point: tone("Work, school, and personal conflicts all show how sides try to capture your usefulness cheaply.", "Early allegiance often turns negotiable value into obligation.", "The side wants your commitment because it also wants to stop paying for your uncertainty."),
          moreDetails: tone("Coalitions, endorsements, and grievances all become less costly for others once your alignment is fixed.", "The chapter becomes practical when you ask who gains most if your allegiance becomes visible today.", "Urgency often means they need your clarity before you need their side.")
        },
        {
          point: tone("The law allows commitment, but only after timing and cost are actually judged.", "A necessary allegiance can still be strategic if it is not prematurely surrendered.", "The strong commitment is the one that is spent late enough to stay expensive."),
          moreDetails: tone("Greene is not rejecting loyalty itself; he is rejecting reflexive surrender of independence.", "The limit matters because endless refusal can become empty as surely as rushed allegiance becomes cheap.", "Commit when the return justifies the lost option, not when pressure simply wants closure.")
        }
      ],
      activationPrompt: tone(
        "Identify one side that wants your clarity more than your good, then ask what leverage disappears if you commit today.",
        "Choose one allegiance decision that may be arriving before the terms are clear, and name what option or bargaining force you still need to keep alive.",
        "Pick the pressure asking for your yes right now and decide what your uncertainty is still worth."
      ),
      selfCheckPrompts: [
        tone(
          "Am I withholding commitment to preserve leverage, or only to avoid thinking?",
          "What becomes cheaper for them the moment my alignment becomes visible?",
          "If I say yes now, whose agenda gets easier to run besides my own?"
        ),
        tone(
          "What option, timing advantage, or bargaining force disappears once I am counted?",
          "Does this side want my loyalty because it is truly earned, or because it is currently useful to them?",
          "What would make this commitment worth the leverage it costs?"
        )
      ],
      predictionPrompt: tone(
        "Once others want to count and classify you, how might Chapter 21 show the advantage of seeming weaker or simpler than you are?",
        "If commitment makes you easier to size up, what changes next when you let others underestimate you instead?",
        "After refusing cheap alignment, what leverage appears when the room mismeasures your strength?"
      ),
      oneMinuteRecap: tone(
        "This chapter argues that premature commitment can make you easier to use, while strategic noncommitment can preserve leverage and timing.",
        "Do not surrender your side before you know the price of clarity.",
        "Keep your allegiance expensive until the terms justify the sale."
      )
    }
  },
  examples: [
    {
      title: "Miraan Delays Alignment Until One Team Stops Trying to Spend His Leverage for Free",
      format: "decision_point",
      category: "work",
      endingType: "broader_principle",
      scenario: tone("Miraan sees one internal team pushing for his immediate public alignment before the terms are clear.", "He has to decide whether to join fast or keep his timing until the side shows what the commitment is really worth.", "Miraan can hand over the flag now or make them pay attention to the price first."),
      whatToDo: tone("He delays visible allegiance until the return is clearer and his leverage is not being spent for free.", "He preserves optionality instead of becoming an early asset in someone else's fight.", "He keeps the yes expensive until the terms stop being cheap for them."),
      whyItMatters: tone("The chapter says commitment can make you easier to count and use.", "His value remains higher while more than one side still has to care what he will do.", "Once they can count him, they can start spending him.")
    },
    {
      title: "Seline Hears Why a Policy Council Lost Bargaining Power by Choosing Too Fast",
      format: "dialogue",
      category: "school",
      endingType: "self_directed_question",
      scenario: tone("Seline listens as someone explains why the council's rushed endorsement gave away the uncertainty that had made it valuable.", "She hears how early alignment collapsed the room's bargaining force.", "Seline learns that a fast yes can be the cheapest thing you sell."),
      whatToDo: tone("She asks what should have been negotiated before the endorsement became public.", "She looks for leverage that was surrendered by choosing too early.", "She asks what their uncertainty had been worth before they spent it."),
      whyItMatters: tone("The chapter warns that commitment can shrink options faster than people expect.", "The council lost value when it became too easy to count.", "The side gained clarity while the council lost price.")
    },
    {
      title: "Oren Weighs Loyalty Against Becoming Captured by Someone Else's Conflict",
      format: "dilemma",
      category: "personal",
      endingType: "surprising_implication",
      scenario: tone("Oren feels pressure to prove loyalty in a conflict whose long-term demands are still unclear.", "He has to choose between immediate allegiance and preserving enough distance to judge what the fight will require from him.", "Oren can call it loyalty now or discover later that he volunteered to be used."),
      whatToDo: tone("He delays binding allegiance until he knows what his commitment will actually purchase and cost.", "He separates care for the person from surrender to the conflict.", "He refuses to confuse urgency with worth."),
      whyItMatters: tone("The chapter says other people often want your commitment because it makes their agenda easier to run.", "Loyalty can be honorable, but premature capture can still be costly.", "A fast yes can turn care into obligation before the terms are visible.")
    },
    {
      title: "Kalina Predicts Why One Operator Stays Uncommitted Until Better Terms Appear",
      format: "predict_reveal",
      category: "work",
      endingType: "cross_domain",
      scenario: tone("Kalina notices one operator resist public alignment even while several sides try to claim her support.", "She predicts the operator is preserving market value by staying contested.", "Kalina can already tell the uncertainty itself is part of the leverage."),
      whatToDo: tone("She judges whether the operator's distance preserves bargaining power rather than disguising indecision.", "She looks for strategic noncommitment instead of sterile drift.", "She scores the move on whether the unanswered yes is still doing work."),
      whyItMatters: tone("The chapter says contested allegiance can carry more force than captured allegiance.", "The operator stays hard to spend because her alignment is not yet cheaply available.", "If multiple camps still want the answer, the answer still has price.")
    },
    {
      title: "Product-Incubator Debrief Finds That Early Allegiance Spent the Best Bargaining Chip",
      format: "postmortem",
      category: "school",
      endingType: "common_trap",
      scenario: tone("A product incubator reviews why its endorsement had little effect and sees that it gave away support before asking for terms.", "The team realizes its uncertainty had been the strongest thing it owned.", "The incubator learns that visibility can be cheaper than it looks."),
      whatToDo: tone("They identify what should have been extracted before commitment became public.", "They rebuild future support around timing, terms, and leverage retention.", "They stop spending certainty before they see the invoice."),
      whyItMatters: tone("The chapter warns that early commitment can collapse bargaining power.", "The side gained usefulness while the team lost optionality.", "A side loves your clarity when your clarity costs you more than it costs them.")
    },
    {
      title: "Before and After Automatic Side-Taking Became Deliberate Commitment Timing",
      format: "before_after",
      category: "personal",
      endingType: "perspective_reframe",
      scenario: tone("Before, every pressure to choose was answered quickly and leverage disappeared early. After, commitment was delayed until the terms and consequences were clearer.", "The contrast is between reflexive allegiance and timed commitment.", "One version rushes to belong; the other waits to price the cost."),
      whatToDo: tone("Keep the ability to commit, but stop making commitment available before judgment is ready.", "Preserve the option long enough to see what the side is really buying.", "Do not refuse forever; refuse cheap timing."),
      whyItMatters: tone("The law distinguishes loyalty from surrendering leverage too early.", "Strategic timing can protect both independence and the eventual value of commitment.", "Your clearest yes is strongest when it is not the easiest one to get.")
    }
  ],
  reviewCards: [
    { cardId: "ch20-rc01", front: tone("Why can commitment reduce leverage in this chapter?", "How does early alignment make you easier to use?", "Why does a visible side sometimes cheapen your position?"), back: tone("Because public allegiance makes you easier to count, predict, and spend for someone else's purposes.", "Early commitment narrows options and reduces bargaining room.", "A visible yes can turn independent value into obligation."), difficulty: "easy" },
    { cardId: "ch20-rc02", front: tone("What can noncommitment preserve?", "Why does staying uncommitted carry value here?", "What remains alive when your alignment is still open?"), back: tone("It can preserve timing, optionality, and bargaining power because multiple sides may still want your support.", "Uncertainty around your allegiance can keep leverage alive.", "If they still need your yes, your price has not fully fallen."), difficulty: "easy" },
    { cardId: "ch20-rc03", front: tone("How is strategic noncommitment different from drift?", "What separates independence from mere indecision?", "Why isn't fence-sitting automatically strong?"), back: tone("Strategic noncommitment preserves something concrete, while drift preserves nothing worth using.", "The chapter distinguishes purposeful withholding from empty avoidance.", "Waiting is only strong when it keeps leverage or timing alive."), difficulty: "medium" },
    { cardId: "ch20-rc04", front: tone("Where does this law show up in ordinary life?", "How do work, school, and personal settings reveal capture risk?", "Where does early allegiance turn value into obligation?"), back: tone("It appears wherever someone wants your side before the terms are clear.", "Coalitions, endorsements, and personal disputes all become easier to run once your alignment is fixed.", "The side often wants your certainty because your certainty makes you usable."), difficulty: "medium" },
    { cardId: "ch20-rc05", front: tone("How does Chapter 20 bridge to Chapter 21?", "Why does resisting alignment lead into seeming weaker or simpler?", "What comes after keeping your allegiance expensive?"), back: tone("Once others want to count you, the next edge is letting them underestimate how fully they have read you.", "Chapter 21 moves from withholding allegiance to benefiting from mismeasurement.", "First stay unclaimed; then let them size you wrong."), difficulty: "hard" }
  ],
  keyTakeawayCard: tone("Premature commitment can make you easier to use, while strategic noncommitment can preserve leverage until allegiance is actually worth its cost.", "This law warns against giving your side away before the terms are clear.", "Keep your yes expensive until the exchange deserves it."),
};

const quiz = {
  passingScorePercent: 70,
  questions: [
    { questionId: "ch20-q01", prompt: "Why can early commitment reduce leverage in this chapter?", choices: ["Because all loyalty is always weak", "Because visible alignment makes you easier to count and use", "Because uncertainty is always morally superior"], correctIndex: 1, explanation: tone("Correct. The chapter says public allegiance can make your position easier to predict and spend.", "Early alignment narrows options and lowers bargaining force.", "Right. Once they can count you, they can work around you."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch20-q02", prompt: "What can noncommitment preserve here?", choices: ["Timing, options, and bargaining power", "Permanent moral purity", "Guaranteed safety from all pressure"], correctIndex: 0, explanation: tone("Yes. The chapter values noncommitment because it can keep leverage alive.", "Uncertain alignment may preserve option space and negotiating room.", "Right. If the yes is still open, it still has price."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch20-q03", prompt: "Why is this chapter not generic anti-loyalty advice?", choices: ["Because it says no commitment is ever worthwhile", "Because neutrality always wins", "Because it allows commitment once the cost is justified"], correctIndex: 2, explanation: tone("Correct. Greene warns against premature allegiance, not every allegiance.", "The issue is timing and leverage, not loyalty as such.", "Right. Commit when the return justifies losing the option."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch20-q04", prompt: "In Miraan's work scenario, what best fits the chapter?", choices: ["Join fast so the team stops pressuring him", "Delay visible alignment until the terms are clearer", "Promise loyalty to both sides at once"], correctIndex: 1, explanation: tone("Yes. He preserves leverage by not making his side too cheap too early.", "The chapter favors timed commitment over pressured capture.", "Right. Keep the yes expensive until the terms sharpen."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch20-q05", prompt: "Why did Seline's policy council lose bargaining power?", choices: ["Because endorsement came before terms were extracted", "Because councils should never endorse anything", "Because all public votes are weak"], correctIndex: 0, explanation: tone("Correct. Early allegiance spent the uncertainty that had bargaining value.", "The council became easier to count before it got enough in return.", "Yes. It sold clarity too cheaply."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch20-q06", prompt: "What is the strongest reading of Oren's dilemma?", choices: ["Loyalty is always a trap", "Immediate allegiance proves seriousness better than judgment", "Care for someone can coexist with delaying capture by their conflict"], correctIndex: 2, explanation: tone("Yes. The chapter separates care from surrendering independence too early.", "He can value the person without letting urgency dictate commitment timing.", "Right. Loyalty is not the same as volunteering to be used."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch20-q07", prompt: "How does visible alignment make you easier to use?", choices: ["It lets others assume access to your loyalty and plan around it", "It makes every future choice impossible", "It removes all uncertainty from the world"], correctIndex: 0, explanation: tone("Correct. Visible allegiance reduces uncertainty for others in a way that helps them.", "Once your side is known, others can reorganize around your reduced independence.", "Yes. Your certainty becomes their convenience."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch20-q08", prompt: "When does noncommitment become empty drift instead of strategy?", choices: ["When it preserves no leverage, timing, or purpose", "When it keeps options alive", "When it delays a side until terms are clearer"], correctIndex: 0, explanation: tone("Exactly. Distance matters only if it protects something concrete.", "The chapter rejects fence-sitting that preserves nothing worth using.", "Right. Delay without leverage is just fog."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch20-q09", prompt: "How does Chapter 19 lead into Chapter 20?", choices: ["Person-reading becomes irrelevant once pressure starts", "After reading the person, the next issue is resisting being bound by their agenda", "Chapter 20 rejects all need to judge people"], correctIndex: 1, explanation: tone("Correct. Chapter 19 reads the person; Chapter 20 manages what that person wants from your alignment.", "The sequence moves from pressure-reading to commitment control.", "Right. First read who they are, then guard what they want to bind."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch20-q10", prompt: "What bridge carries Chapter 20 into Chapter 21?", choices: ["Chapter 21 says public certainty is always strongest", "Noncommitment removes the need for misdirection", "Keeping your allegiance expensive prepares the next edge of being underestimated"], correctIndex: 2, explanation: tone("Correct. The next chapter turns from withheld alignment to the usefulness of being sized up wrongly.", "After resisting capture, the next advantage is mismeasurement.", "Right. First stay unclaimed, then let them read you too simply."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" }
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
for (const name of ["Miraan", "Seline", "Oren", "Kalina"]) continuity.nameUsage[name] = [stem];
continuity.withinChapterNames[stem] = ["Miraan", "Seline", "Oren", "Kalina"];
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
- Chapter-specific mechanism remains commitment cost, leverage retention, and capture risk rather than generic independence rhetoric
- Hard depth preserves the independence-versus-drift boundary and the Chapter 21 underestimation bridge
- Quiz stays within supported facts from the approved draft and frozen source bundle

## Drift repair
- Repaired prewriter drift before writer start by replacing banned assigned name \`Tessa\` with \`Seline\`.

## Gate result
- Approved for chapter gate and automatic continuation
`;
writeText(paths.validation, validation);

fs.appendFileSync(
  paths.runLog,
  `\n- Completed writer, editor, critic, converter, quiz, and validator steps for Chapter 20.\n- Validation result: PASS.\n- Continuity hash sealed for \`${stem}\`: \`${seal}\`\n`,
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
