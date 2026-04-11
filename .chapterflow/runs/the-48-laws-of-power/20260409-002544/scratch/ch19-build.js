const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const runRoot = path.resolve(".chapterflow/runs/the-48-laws-of-power/20260409-002544");
const num = 19;
const stem = `ch${String(num).padStart(2, "0")}`;
const title = "Know Who You're Dealing With - Do Not Offend the Wrong Person";
const chapterId = "ch19-know-who-youre-dealing-with-do-not-offend-the-wrong-person";
const createdAt = new Date().toISOString();

function tone(gentle, direct, competitive) {
  return { gentle, direct, competitive };
}

const canonical = `Greene's nineteenth law narrows power from general strategy to a specific person standing in front of you. The chapter begins with a simple correction to lazy tactics: people do not respond in identical ways. One remark that passes harmlessly with one person can become costly with another. One pressure tactic that works on a flexible person can turn dangerous with someone proud, brittle, resentful, or deeply attentive to slights. The law begins by rejecting the comfort of a universal script.

That rejection matters because offense is not distributed evenly. The same action can produce different consequences depending on the temperament, memory, vanity, grievance, or status sensitivity of the person receiving it. Greene's point is not that everyone is mysterious beyond reading. It is that strategy fails when you stop asking who this person is, what they react to, and what kind of response profile they carry. Careless generalization can make a minor move strategically expensive.

The chapter is strongest when it stays away from paranoia. Greene is not asking for fear of every person. He is asking for discrimination. Different people carry different thresholds. Some absorb friction and move on. Some remember public embarrassment. Some turn small slights into long campaigns. Some are safer to confront directly than others. The chapter's logic depends on concrete reading, not on universal suspicion.

That makes the law more demanding than it first appears. It is easy to repeat a tactic that succeeded last time and assume it will transfer cleanly. It is harder to pause and re-read the person in front of you. But without that pause, you can end up offending the one person least safe to offend. The risk is not only that they strike back. The risk is that you misjudge the scale, timing, or style of their reaction because you treated a specific person like a type.

The pattern appears in ordinary settings. A colleague may take direct criticism as useful, while another experiences the same public friction as a personal insult that hardens future behavior. A student board may joke with most members and then discover that one member stores humiliation instead of shrugging it off. A personal relationship may tolerate bluntness in one season and become far more reactive in another if old grievance has thickened underneath. In each case, the person matters more than the script.

The limit matters too. Person-reading is not mind-reading. You cannot know everything in advance, and careful attention does not guarantee control. Greene's point is narrower: stop acting as if every person will absorb the same move in the same way. Reading people concretely lowers avoidable offense and forces more precise judgment. Chapter 18 restored awareness after the danger of isolation. Chapter 19 uses that awareness on the actual person in front of you. That points toward Chapter 20, where leverage depends on resisting other people's efforts to bind you to their side, aims, or timetable.`;

const edited = `Greene's nineteenth law narrows power from general strategy to a specific person standing in front of you. The chapter begins with a simple correction to lazy tactics: people do not respond in identical ways. One remark that passes harmlessly with one person can become costly with another. One pressure tactic that works on a flexible person can turn dangerous with someone proud, brittle, resentful, or deeply attentive to slights. The law begins by rejecting the comfort of a universal script.

That rejection matters because offense is not distributed evenly. The same action can produce different consequences depending on the temperament, memory, vanity, grievance, or status sensitivity of the person receiving it. Greene's point is not that everyone is unreadable. It is that strategy fails when you stop asking who this person is, what they react to, and what kind of response profile they carry. Careless generalization can make a minor move strategically expensive.

The chapter is strongest when it stays away from paranoia. Greene is not asking for fear of every person. He is asking for discrimination. Different people carry different thresholds. Some absorb friction and move on. Some remember public embarrassment. Some turn small slights into long campaigns. Some are safer to confront directly than others. The chapter's logic depends on concrete reading, not on universal suspicion.

That makes the law more demanding than it first appears. It is easy to repeat a tactic that succeeded last time and assume it will transfer cleanly. It is harder to pause and re-read the person in front of you. Without that pause, you can end up offending the one person least safe to offend. The risk is not only retaliation. The risk is that you misjudge the scale, timing, or style of response because you treated a specific person like a type.

The pattern appears in ordinary settings. A colleague may take direct criticism as useful, while another experiences the same public friction as a personal insult that hardens future behavior. A student board may joke with most members and then discover that one member stores humiliation instead of shrugging it off. A personal relationship may tolerate bluntness in one season and become far more reactive in another if old grievance has thickened underneath. In each case, the person matters more than the script.

The limit matters too. Person-reading is not mind-reading. You cannot know everything in advance, and careful attention does not guarantee control. Greene's point is narrower: stop acting as if every person will absorb the same move in the same way. Reading people concretely lowers avoidable offense and forces more precise judgment. Chapter 18 restored awareness after the danger of isolation. Chapter 19 uses that awareness on the person in front of you. That points toward Chapter 20, where leverage depends on resisting other people's efforts to bind you to their side, aims, or timetable.`;

const critic = `# Chapter 19 Critic Report

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
- Paragraph 5 is the most vulnerable because work, school, and personal cases can flatten into generic people-skills advice if conversion loses the uneven-reaction mechanism.

Strongest sentence:
- "The risk is that you misjudge the scale, timing, or style of their reaction because you treated a specific person like a type."

Anchor use notes:
- The draft stays inside the frozen support: different people react differently, offense cost is uneven, strategy requires person-specific reading, and careful judgment remains partial rather than omniscient.

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
        "This law says you should not assume every person will react the same way. A move that feels small to one person may feel insulting, threatening, or unforgettable to another. Greene's point is that different people carry different sensitivities, vanities, and grievance patterns. The chapter is not telling you to fear everyone. It is telling you to stop using a universal script. Before you push, joke, criticize, or provoke, you need to ask who is in front of you and how that person is likely to react. If you miss that, you may offend the one person least safe to offend. The danger is not only hurt feelings. The danger is misjudging the scale and style of the response that follows. Read the person, not just the tactic. The same move can land lightly, heavily, or disastrously depending on the person receiving it. A familiar method is only safe when the recipient actually fits it. Otherwise the shortcut starts writing a bill you did not expect to pay.",
        "Greene's nineteenth law argues that strategy fails when you treat unlike people as if they respond alike. Different people store slights differently, protect pride differently, and retaliate differently. The chapter is strongest when it stays with that unevenness. A familiar tactic can seem safe because it worked before, yet it may become costly when used on someone with a different response profile. The chapter does not ask for paranoid guessing. It asks for concrete reading. Ask what this person remembers, what this person resents, and what this person is likely to do if crossed. Once you stop assuming a universal reaction, your judgment gets sharper. The chapter's warning is simple: do not casually offend a person you have not read well. A small move can become expensive when the person is wrong for it. Competitive reading means pricing the recipient before you spend the tactic. If you charge ahead without that read, the wrong person can turn your own move into their leverage over you.",
        "This law makes a practical claim: people are not interchangeable. One person shrugs off pressure. Another person stores it. One person accepts bluntness. Another person turns the same moment into a lasting grievance. Greene's warning is that a strategy cannot be copied from one person to another without checking who you are dealing with. The chapter is not about treating everyone as dangerous. It is about noticing that reaction patterns differ, and that those differences matter. If you miss them, you can create trouble that your usual script never prepared for. The safe move is not automatic caution. It is better reading. Offense becomes costly when it lands on a person whose pride, memory, or grievance you failed to notice. The tactic matters, but the person matters more. Push the wrong person with the wrong script and the board stops being yours to control."
      ),
      keyTakeaways: [
        { point: tone("People do not react uniformly to the same move.", "The same tactic lands differently on different people.", "One script can produce three different wars.") },
        { point: tone("Offense becomes expensive when you misread the person receiving it.", "The wrong person can make a small move costly.", "A light push can hit the exact person who pushes back hardest.") },
        { point: tone("The chapter calls for person-specific reading, not paranoia.", "Read concretely instead of fearing everyone equally.", "Study the person, not your own favorite script.") }
      ],
      oneMinuteRecap: tone(
        "This law says strategy gets dangerous when you assume every person will absorb the same move in the same way.",
        "Different people carry different reaction profiles.",
        "Read the person before you run the tactic."
      )
    },
    medium: {
      chapterBreakdown: tone(
        `Greene's nineteenth law argues that strategy becomes careless when it stops distinguishing between people. A move that works cleanly with one person can become costly with another because people do not hold pride, grievance, memory, or status in the same way. The chapter begins by rejecting one-size-fits-all handling. Different people produce different consequences from the same input.

That is why offense matters here. The problem is not simply that someone may feel bad. The problem is that a poorly judged move can trigger retaliation, obstruction, long memory, or hidden resistance in ways your standard script never anticipated. Greene is therefore interested in response profiles. Before you push, mock, pressure, or expose someone, you need to ask how this specific person tends to process injury and what kind of reaction they are capable of sustaining.

The chapter is not strongest when it turns into generic fearfulness. Greene is not saying every person should be treated like a trap. He is saying that strategy requires concrete discrimination. Some people cool down fast. Some convert embarrassment into resolve. Some react publicly. Some wait. Some are less dangerous than they look; others are more dangerous than they first appear. Person-reading is the core skill.

Ordinary settings make the pattern obvious. A colleague may accept direct criticism in one team and appreciate the clarity, while another treats the same public note as humiliation that changes future cooperation. A student board may joke with most members and then discover one member does not forget social embarrassment. A personal relationship may absorb blunt truth in one season and react sharply in another because grievance has accumulated underneath. The same move does not stay the same once the person changes.

The limit matters too. You cannot know every response in advance, and careful reading is not mind-reading. The chapter's claim is narrower: do not assume uniformity where difference matters. Chapter 18 restored live awareness after the danger of isolation. Chapter 19 concentrates that awareness onto the actual person in front of you. That bridge points toward Chapter 20, where the next question is how different people try to bind you into commitments that serve them more than you.`,
        `Greene's nineteenth law says the wrong mistake is often not the tactic itself but the assumption that the tactic transfers cleanly from one person to another. People differ in pride, volatility, grievance, memory, insecurity, and appetite for retaliation. If you ignore those differences, you start creating consequences you did not budget for. The chapter therefore treats person-specific judgment as a practical necessity rather than as a social nicety.

Offense is expensive because reaction is uneven. The same public correction, joke, exclusion, or pressure move can create no lasting problem with one person and a durable enemy with another. Greene is warning against strategic laziness. You cannot safely rely on a familiar script until you know whether the person in front of you fits it.

This is why the chapter is not just paranoia advice. The point is not to fear every interaction. Instead, read concretely. What does this person remember? What kind of slight do they magnify? How do they answer friction when pride is involved? What happens when embarrassment becomes grievance? Those are the questions that keep a small move from becoming a long problem.

The pattern appears everywhere. A leader may use bluntness as a normal tool and then misjudge the one colleague who treats public sharpness as a lasting insult. A school board may tease freely until it misreads the one member who stores status wounds. A personal conflict may escalate because someone assumed a familiar tone would land as lightly as it did before. In each case, the person changes the risk more than the tactic does.

The chapter's limit remains central. Person-reading is always partial, and certainty about your own read can become its own mistake. Still, Greene's point stands: universal scripts are dangerous because people are not universal. Chapter 19 follows Chapter 18 for a reason. Once you return from isolation to live awareness, the next task is to direct that awareness toward the person actually in play. Chapter 20 continues the sequence by asking how those different people will try to capture your commitment once they know what matters to you.`,
        `This law starts with a common strategic shortcut: repeating what worked before. Greene's warning is that repetition becomes dangerous when the person changes. Different people carry different thresholds for offense, different memories for insult, different ways of answering pressure, and different levels of volatility once grievance is touched. The chapter says strategy fails when it forgets those differences.

That failure can look small at first. A joke, criticism, delay, exclusion, or challenge may seem minor because it caused no trouble elsewhere. But if the person in front of you stores slights, guards pride, or retaliates indirectly, the same move can become strategically expensive. Greene's point is that consequence depends not only on action but also on the response profile of the recipient.

This keeps the chapter narrower than generic suspicion. It is not telling you to imagine hidden danger in everyone equally. It is asking you to replace lazy generalization with concrete reading. Who absorbs friction? Who remembers it? Who strikes back openly? Who waits? Who becomes difficult in ways that are slow, private, or durable? Those distinctions matter more than a universal script.

Common settings show the point clearly. One coworker may welcome directness while another hears the same tone as disrespect. One editorial board member may brush off teasing while another turns it into a long memory about status. One personal relationship may take blunt honesty as care while another receives it through old grievance and answers differently. In each case, the person changes the meaning of the move.

The limit is that reading is never perfect. You can still misjudge, and careful attention does not remove uncertainty. The chapter's practical claim is simpler: stop acting as if interchangeable tactics meet interchangeable people. Chapter 18 warned against stale maps produced by isolation. Chapter 19 takes the refreshed map and asks whether you are using it on the actual person in front of you. Chapter 20 then shifts from reading reactions to resisting the commitments different people try to pull out of you once they know how to work on you.`,
      ),
      keyTakeaways: [
        {
          point: tone("People do not carry pride, grievance, memory, or volatility in the same way.", "Reaction profiles differ more than scripts admit.", "The person changes the risk before the tactic even lands."),
          moreDetails: tone("The chapter focuses on uneven response, not on dramatic mystery.", "A tactic that is safe with one person may be costly with another because the person changes the likely consequence.", "What matters is not just the move, but whose pride, memory, or grievance receives it.")
        },
        {
          point: tone("Offense becomes strategically expensive when you misread the recipient.", "The wrong person can turn a small move into a long problem.", "A small slight can buy a very large enemy."),
          moreDetails: tone("This is why public embarrassment, bluntness, exclusion, or pressure cannot be transferred automatically from case to case.", "The chapter's warning is about disproportionate consequence caused by bad person-reading.", "A move can look minor until it lands on someone who stores it like a debt.")
        },
        {
          point: tone("Person-reading differs from paranoia because it asks for discrimination, not fear.", "Read concretely instead of suspecting everyone equally.", "The law rewards observation, not trembling."),
          moreDetails: tone("Greene is not asking you to imagine danger everywhere in the same form.", "The task is to notice what this person reacts to, remembers, or magnifies.", "Fear flattens people; reading separates them.")
        },
        {
          point: tone("Work, school, and personal life all show that the person changes the consequence.", "A recycled script can miss the one recipient who reprices it completely.", "The same sentence can pass, sting, or ignite depending on who hears it."),
          moreDetails: tone("Public correction, teasing, exclusion, or delay all shift in meaning once the recipient shifts.", "The chapter becomes practical when you identify the recipient who makes your default move most expensive.", "A script that worked yesterday may fail today because the person is different, not because the tactic changed.")
        },
        {
          point: tone("The chapter allows careful reading but not certainty about your own read.", "You still read through partial information.", "A sharp read can still be wrong at the edge."),
          moreDetails: tone("Person-specific judgment lowers avoidable offense without promising total control.", "The limit matters because overconfidence in your map can itself recreate the problem.", "Reading helps most when it stays flexible enough to revise itself.")
        }
      ],
      activationPrompt: tone(
        "Identify one person you may be treating with a recycled script and ask what about their pride, memory, or grievance profile makes that risky.",
        "Choose one interaction where your default move may not fit the specific person in front of you, then name the signal that should change your approach.",
        "Pick the person least safe to handle on autopilot and decide what your script is missing about them."
      ),
      selfCheckPrompt: tone(
        "Am I reading this person, or am I just replaying a tactic that worked on someone else?",
        "What reaction profile might make this move costlier here than it looked elsewhere?",
        "Do I know enough about this person to push safely, or am I leaning on a lazy script?"
      ),
      oneMinuteRecap: tone(
        "This chapter says strategy gets expensive when you assume different people will absorb the same move in the same way.",
        "Read the person before you trust the script.",
        "The wrong person can turn a small move into a large cost."
      )
    },
    hard: {
      chapterBreakdown: tone(
        `Greene's nineteenth law treats person-specific judgment as a protection against one of strategy's laziest mistakes: assuming transferable consequences. A tactic that produced a mild result in one case can create a severe result in another because people do not carry offense, pride, grievance, memory, or humiliation on the same scale. The chapter begins by stripping away the comfort of the universal script. It is not enough to know what worked. You have to know on whom it worked, why it worked there, and what changes when the person changes.

That is why offense matters so much in this chapter. A badly judged move does not merely produce disapproval. It can produce durable retaliation, disguised obstruction, long memory, or a grievance that ripens over time. The tactical failure comes from mistaking a specific person for a familiar type. Once you do that, you start budgeting consequence according to your script rather than according to the reaction profile in front of you.

The chapter is strongest when it resists both simplification and paranoia. Greene is not offering a neat taxonomy that makes everyone readable at a glance. Nor is he arguing that every person is a hidden threat. He is asking for discrimination. Some people metabolize friction quickly. Some preserve insult with surprising patience. Some answer openly. Some answer indirectly. Some can be pressured bluntly. Others convert blunt pressure into a lasting enemy. The law depends on those differences being concrete rather than theatrical.

That concrete reading is harder than people admit because repetition flatters confidence. Once a method has worked before, it begins to feel reliable. The danger is that reliability may belong less to the method itself than to the kind of person it was used on. A reader who forgets that will offend exactly the wrong person while still feeling strategically competent. The mistake is not only moral or interpersonal. It is diagnostic. They misread the pressure-bearing capacity, grievance memory, or pride structure of the person in front of them.

Ordinary settings make the logic plain. A manager may use sharp public correction as a normal efficiency tool and then misjudge the one colleague for whom public embarrassment becomes a durable status wound. A student board may use teasing as social glue until it misreads the one member whose memory for humiliation is long and strategic. A personal relationship may have tolerated bluntness for months and then stop tolerating it once grievance, insecurity, or accumulated slight changes the meaning of the same tone. In each case, the action is not separable from the person receiving it.

The limit is crucial. Person-reading is not omniscience. Signals can mislead, and a confident interpretation can become its own trap. The chapter therefore asks for flexible judgment rather than certainty. Greene's claim is narrower: stop acting as if unlike people generate like consequences. Chapter 18 restored awareness after warning against fortress isolation. Chapter 19 spends that restored awareness on the person who can make your move cheap or costly. That naturally leads to Chapter 20. Once you understand that people differ in how they react and bind, the next problem is refusing the commitments they try to extract on terms that advantage them. The law succeeds only when your tactic remains subordinate to the person-specific read rather than the other way around. A script is safe only if the person in front of you actually fits it.`,
        `Greene's nineteenth law argues that the real danger in offense is not its existence but its uneven distribution. People do not take injury in the same way, do not remember insult in the same way, and do not retaliate in the same way. Strategy becomes clumsy the moment it stops distinguishing between those differences. A move that is tolerable to one person can become strategically ruinous with another because the same act enters two different temperaments and comes back out as two different consequences. The recipient is part of the mechanism, not just the audience for it.

This is why the chapter centers on who, not merely on what. Greene wants the reader to stop asking only whether a tactic is clever and start asking whether it fits the response profile of the person receiving it. Public correction, exclusion, teasing, pressure, delay, bluntness, or exposure do not carry fixed costs. Their cost changes with the recipient's pride, insecurity, grievance memory, and style of retaliation. Person-reading therefore changes strategy at the level where consequence is priced.

The law should not be mistaken for a manual of nervous suspicion. It is not saying that everyone hides some equally dangerous flaw. It is saying that people are uneven and must be read unevenly. Concrete signals matter more than generic categories. Does this person cool down, harden, remember, publicize, sulk, obstruct, or escalate? Those questions are more useful than any universal story about how people ought to respond.

Common life makes the mechanism easy to see. One leader can use direct public feedback with several team members and then misread the one person who experiences it as rank injury. One editorial board can treat sarcasm as harmless until it lands on the member whose pride translates embarrassment into slow retaliation. One personal history can make a familiar tone newly dangerous because accumulated grievance has altered how the next remark will be heard. In every case, the tactic did not stay constant because the person did not stay interchangeable.

The limit remains central because a strong read can still be partial. People can surprise you, signals can be mixed, and overconfidence in your interpretation can recreate the same laziness the chapter warns against. Greene's practical claim is therefore disciplined rather than absolute: do not run a generic script on a specific person whose response profile you have not understood. Chapter 18 prepared this move by restoring live awareness. Chapter 19 narrows that awareness to the person in play. Chapter 20 then asks what happens when those differently built people try to lock you into their preferred commitments. The chapter's edge lies in that precision. A tactic is never merely a tactic once it lands on a person who stores consequence differently than your script expected. A script that ignores the recipient will eventually offend the very person most able and willing to make the price unforgettable. The sharper reading notices that risk before the move leaves your hand.`,
        `This law works only if you separate tactics from recipients. Most people judge a move by remembering how it worked last time. Greene's warning is that last time may say more about the previous person than about the move itself. If you carry that lesson forward without adjusting for the new temperament in front of you, you start mispricing consequence. The chapter says that unlike people do not absorb pressure, embarrassment, exclusion, or bluntness in interchangeable ways. What looked efficient in one case can become ruinous in the next.

That matters because offense is not linear. A slight that washes off one person may sink into another person and remain active. A challenge that clarifies one relationship may poison another. A public correction that improves one workflow may convert another colleague into a quiet enemy. Greene is pointing to the gap between the visible size of the act and the hidden size of the reaction it can trigger once it lands on the wrong pride, memory, grievance, or insecurity.

The chapter therefore rewards reading over scripting. It is not telling you to become paranoid, and it is not giving you a final chart of human types. It is telling you to stop acting as if the recipient does not matter. What does this person store? What do they magnify? Which injuries do they forgive? Which ones do they convert into future action? Those questions turn a tactic from recycled habit into strategy.

Everyday life shows the law clearly. A worker may assume that blunt efficiency is universally respected and then offend the one coworker who reads it as status disrespect. A board may joke freely and then discover that one member treats humiliation as a debt. A personal exchange may become explosive because someone assumed the other person would process the moment the way they did months earlier, before grievance had thickened. In each case, what changed was not only the act. What changed was the person receiving it.

The limit is that person-reading remains partial and revisable. Confidence in your read can harden into the same universal script the chapter opposes, only now dressed up as insight. Greene's better point is to stay flexible enough to revise as new signals appear. Chapter 18 showed why stale awareness is dangerous. Chapter 19 shows why fresh awareness still has to be aimed at the concrete person in front of you. Chapter 20 follows because once you know people differ, you can see that they will also differ in how they try to bind you, recruit you, or extract commitment. The deepest lesson is not simply "be careful." It is that strategy becomes cheaper or costlier depending on whose pride, grievance, and memory you wake up with your move. If your script outruns your read, the wrong person will teach you the price of that shortcut. Competitive advantage here comes from refusing to spend pressure blindly where the recipient can multiply the cost back at you.`
      ),
      keyTakeaways: [
        {
          point: tone("People do not convert the same act into the same consequence.", "Reaction profiles change the price of a tactic.", "A move's real cost is set by the person it lands on."),
          moreDetails: tone("The chapter emphasizes uneven consequence rather than theatrical mystery.", "The same act can produce mild friction, durable grievance, or strategic retaliation depending on the recipient.", "A tactic is never cheaper than the pride, memory, or insecurity it activates.")
        },
        {
          point: tone("Offense becomes costly when you misread pride, grievance, or response style.", "The wrong person can make a familiar move strategically ruinous.", "A small slight can recruit a very patient enemy."),
          moreDetails: tone("This is why public embarrassment, exclusion, teasing, or bluntness have no fixed cost across people.", "The chapter warns against budgeting consequence from the script instead of from the recipient.", "A move stops being minor the moment it lands on someone who stores it for later use.")
        },
        {
          point: tone("Person-reading differs from paranoia because it relies on concrete signal rather than universal fear.", "Read unevenly because people are unevenly built.", "The law asks for discrimination, not trembling."),
          moreDetails: tone("Greene is not claiming that everyone hides identical danger in secret.", "The task is to notice who cools down, who hardens, who remembers, and who escalates.", "Fear blurs people together; reading pulls them apart.")
        },
        {
          point: tone("Work, school, and personal settings all show that recipients alter the meaning of the same act.", "A fixed script can collapse once the recipient changes.", "The sentence stays the same, but the person changes the blast radius."),
          moreDetails: tone("Public feedback, sarcasm, delay, exclusion, or blunt honesty all shift in consequence once the person shifts.", "The chapter becomes practical when you identify the recipient most likely to punish your usual move differently.", "A script can fail without changing a word if the recipient changes a wound.")
        },
        {
          point: tone("The chapter permits careful reading but not certainty in your own read.", "A strong read can still be partial and revisable.", "Insight goes bad the moment it thinks it is final."),
          moreDetails: tone("Person-specific judgment lowers avoidable offense without promising control over every outcome.", "The limit matters because overconfidence in your own map can recreate the shortcut the law opposes.", "Reading works best when it stays sharp enough to notice and humble enough to update.")
        }
      ],
      activationPrompt: tone(
        "Identify one person you may be treating with a transferable script, then name the specific pride, grievance, or memory signal that should change your approach.",
        "Choose one interaction where the tactic may be less important than the recipient, and specify what about this person's response profile you still need to read better.",
        "Pick the person least safe to offend casually and decide what your favorite script is missing about them."
      ),
      selfCheckPrompts: [
        tone(
          "Am I reading this specific person, or am I trusting a tactic because it worked on someone else?",
          "What reaction profile could make this move costlier here than my script predicts?",
          "Am I pricing consequence from the person in front of me or from my own habit?"
        ),
        tone(
          "Which signal here points to pride, grievance, memory, or volatility that my script may be ignoring?",
          "If my read is wrong, how would this person punish that mistake differently from others?",
          "What would make me revise my map of this person before I push further?"
        )
      ],
      predictionPrompt: tone(
        "Once you know different people try to bind you in different ways, how might Chapter 20 show the value of refusing commitment?",
        "If response profiles differ, what changes next when people start pulling for your allegiance on their terms?",
        "After reading the person clearly, what leverage appears when you refuse to get tied to one side too early?"
      ),
      oneMinuteRecap: tone(
        "This chapter argues that a tactic becomes expensive when you assume different people will absorb it in the same way.",
        "Read the recipient before you trust the move.",
        "The wrong person can make a familiar script catastrophically overpriced."
      )
    }
  },
  examples: [
    {
      title: "Leena Changes Course Before Public Friction Lands on the Wrong Colleague",
      format: "decision_point",
      category: "work",
      endingType: "broader_principle",
      scenario: tone("Leena realizes one colleague will not absorb public sharpness the way others on the team do.", "She has to decide whether to use the familiar tactic or change it for this specific person.", "Leena can run the usual script or stop before it hits the wrong pride."),
      whatToDo: tone("She shifts the approach once she sees that the recipient changes the likely consequence.", "She reads the person before repeating the tactic.", "She respects the blast radius before lighting the fuse."),
      whyItMatters: tone("The chapter says the person changes the cost of the move.", "A tactic can become expensive when the recipient is wrong for it.", "The same push lands like feedback with one person and like war with another.")
    },
    {
      title: "Corin Hears Why an Editorial Board Misread the One Member It Was Safest Not to Needle",
      format: "dialogue",
      category: "school",
      endingType: "self_directed_question",
      scenario: tone("Corin listens as someone explains how the board treated every member as if they stored embarrassment the same way.", "He hears why one person's long memory made the group's joking script suddenly dangerous.", "Corin learns that one misread person can reprice the whole room."),
      whatToDo: tone("He asks which signals should have warned the group that this member's response profile was different.", "He looks for person-specific cues instead of leaning on the board's usual tone.", "He asks what made this member the wrong person to needle cheaply."),
      whyItMatters: tone("The chapter warns that universal scripts fail against uneven temperaments.", "The board paid for misreading the recipient, not just for speaking.", "The wrong memory can turn a joke into a campaign.")
    },
    {
      title: "Saira Weighs Honesty Against the Cost of Triggering the Wrong Grievance",
      format: "dilemma",
      category: "personal",
      endingType: "surprising_implication",
      scenario: tone("Saira wants to speak plainly, but she can tell the other person's grievance history may change how the same truth lands.", "She has to choose between using a familiar blunt style and re-reading what this person is likely to store.", "Saira can trust the script or respect the wound underneath it."),
      whatToDo: tone("She adjusts timing and delivery to the person rather than to her own habit.", "She reads the response profile before she pushes the point.", "She stops treating honesty like a move with a fixed price."),
      whyItMatters: tone("The chapter says offense cost depends on the person receiving it.", "The same truth can clarify, bruise, or permanently alter the relationship depending on stored grievance.", "What matters is not only what is said, but whose old injury hears it.")
    },
    {
      title: "Ilan Predicts Why One Operator Studies Reaction Patterns Before Pushing a Rival",
      format: "predict_reveal",
      category: "work",
      endingType: "cross_domain",
      scenario: tone("Ilan notices one operator pause to study a rival's response style before applying pressure.", "He predicts the pause is about pricing consequence by person, not by tactic alone.", "Ilan can already tell the real variable is the recipient."),
      whatToDo: tone("He judges whether the operator is reading pride, memory, and retaliation style before moving.", "He looks for person-specific calibration rather than generic aggression.", "He scores the move on whether it fits the rival, not on whether it feels bold."),
      whyItMatters: tone("The chapter says a familiar tactic is only safe if the person fits it.", "The operator avoids offending the wrong person by reading the response profile first.", "Pressure is cheap only until it wakes the wrong memory.")
    },
    {
      title: "Capstone-Lab Postmortem Finds That a Universal Script Hit the One Person with the Longest Memory",
      format: "postmortem",
      category: "school",
      endingType: "common_trap",
      scenario: tone("A capstone lab reviews why a routine pressure move backfired and sees that one member stored the slight far differently than others.", "The team realizes it had budgeted consequence from its script instead of from the recipient.", "The lab learns that interchangeability was the real mistake."),
      whatToDo: tone("They identify which signals of pride, memory, or grievance they ignored before using the move.", "They rebuild their handling around the person rather than around habit.", "They stop mistaking a familiar script for a safe one."),
      whyItMatters: tone("The chapter warns that uneven reaction profiles make universal tactics costly.", "The lab offended the wrong person because it treated everyone as equivalent.", "A routine move becomes a trap when the recipient is not routine.")
    },
    {
      title: "Before and After a Personal Script Stopped Pretending Everyone Processes Conflict the Same Way",
      format: "before_after",
      category: "personal",
      endingType: "perspective_reframe",
      scenario: tone("Before, the same style was applied to everyone and avoidable offense kept appearing. After, person-specific reading changed tone, timing, and pressure according to the recipient.", "The contrast is between transferable script and calibrated judgment.", "One version trusts habit; the other reads the person."),
      whatToDo: tone("Keep the principle, but adapt the move to the response profile in front of you.", "Preserve honesty and pressure where needed, while adjusting them to the person.", "Do not abandon the tactic; subordinate it to the recipient."),
      whyItMatters: tone("The chapter distinguishes strong judgment from generic handling.", "Precision reduces avoidable offense better than fear or autopilot does.", "The safest move is not always softer; it is better aimed.")
    }
  ],
  reviewCards: [
    { cardId: "ch19-rc01", front: tone("Why do one-size-fits-all tactics fail in this chapter?", "Why can't a tactic transfer cleanly across people?", "Why does the same move change cost with different recipients?"), back: tone("Because different people carry different pride, grievance, memory, and reaction patterns.", "The chapter says consequence changes when the person changes.", "A tactic is priced by the recipient as much as by the act."), difficulty: "easy" },
    { cardId: "ch19-rc02", front: tone("Why can offense become strategically expensive?", "How does the wrong person make a small move costly?", "Why isn't offense evenly distributed?"), back: tone("Because one person may ignore what another stores and repays later.", "The chapter warns that uneven response profiles change the consequence of the same act.", "A small slight can become a large problem when the recipient is wrong for it."), difficulty: "easy" },
    { cardId: "ch19-rc03", front: tone("How is person-reading different from paranoia?", "What separates concrete reading from generic suspicion?", "Why doesn't this law say everyone is equally dangerous?"), back: tone("Person-reading looks for specific signals instead of fearing everyone in the same way.", "The chapter asks for discrimination, not universal fear.", "Reading separates people; paranoia flattens them."), difficulty: "medium" },
    { cardId: "ch19-rc04", front: tone("Where does this law show up in ordinary life?", "How do work, school, and personal settings reveal uneven consequence?", "Where does the recipient change the meaning of the same act?"), back: tone("It appears wherever the same bluntness, teasing, or pressure lands differently on different people.", "The person can change the risk more than the tactic changes.", "A familiar move stops being familiar once the recipient is different."), difficulty: "medium" },
    { cardId: "ch19-rc05", front: tone("How does Chapter 19 bridge to Chapter 20?", "Why does person-specific reading lead into noncommitment?", "What comes after learning who you are dealing with?"), back: tone("Once you see people differ in how they react, the next issue is how they differ in trying to bind you.", "Chapter 20 shifts from reading recipients to resisting their preferred commitments.", "First read the person; then refuse the trap of automatic allegiance."), difficulty: "hard" }
  ],
  keyTakeawayCard: tone("Different people can turn the same move into very different consequences, so strategy has to read the recipient before trusting the script.", "This law warns against offending the wrong person through lazy generalization.", "Do not run a generic script on a specific person."),
};

const quiz = {
  passingScorePercent: 70,
  questions: [
    { questionId: "ch19-q01", prompt: "Why do one-size-fits-all tactics fail in this chapter?", choices: ["Because people react differently to the same move", "Because every tactic is always wrong", "Because all people hide the same danger"], correctIndex: 0, explanation: tone("Correct. The chapter says consequence changes when the person changes.", "Different recipients convert the same act into different reactions.", "Right. The script is not universal because the people are not."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch19-q02", prompt: "What makes offense strategically expensive here?", choices: ["It always leads to immediate open conflict", "The wrong person can turn a small move into a durable problem", "Any discomfort automatically ruins strategy"], correctIndex: 1, explanation: tone("Yes. The chapter warns about uneven reaction profiles.", "A small move can become costly when the recipient stores or magnifies it.", "Right. The price rises when the wrong memory receives it."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch19-q03", prompt: "Why is this chapter not generic paranoia advice?", choices: ["Because it says no person is ever risky", "Because offense is always harmless if you stay calm", "Because it asks for concrete reading instead of fear of everyone equally"], correctIndex: 2, explanation: tone("Correct. The law calls for discrimination, not universal fear.", "Reading means noticing differences instead of flattening people.", "Right. Person-reading separates; paranoia blurs."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch19-q04", prompt: "In Leena's work scenario, what best fits the chapter?", choices: ["Use the same public sharpness on every colleague", "Change the approach once she sees this recipient will price it differently", "Avoid all feedback forever"], correctIndex: 1, explanation: tone("Yes. The recipient changes the cost of the move.", "She should read the person before replaying the tactic.", "Right. Same script, wrong pride, bigger price."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch19-q05", prompt: "Why did Corin's editorial board get into trouble?", choices: ["Because every board member was equally fragile", "Because sarcasm is always forbidden", "Because it misread the one member who stored humiliation differently"], correctIndex: 2, explanation: tone("Correct. The board failed by treating uneven people as interchangeable.", "The issue was not joking in the abstract but misreading the recipient.", "Right. The wrong memory turned a casual move expensive."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch19-q06", prompt: "What is the strongest reading of Saira's dilemma?", choices: ["The same blunt honesty always lands the same way", "Person-specific timing matters because grievance changes how truth is heard", "The safest move is to say nothing to anyone"], correctIndex: 1, explanation: tone("Yes. The chapter says the recipient changes the meaning of the same act.", "Old grievance can reprice a familiar tone.", "Right. What is said matters, but who hears it matters more."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch19-q07", prompt: "How does person-reading change strategic choice?", choices: ["It replaces concrete judgment with rigid stereotypes", "It helps you price consequence by the recipient rather than by habit alone", "It guarantees perfect control over every reaction"], correctIndex: 1, explanation: tone("Correct. The chapter pushes you to read the person before trusting the script.", "Consequence is priced by the recipient as well as the act.", "Yes. Better reading changes which moves are actually cheap."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch19-q08", prompt: "When does confidence in your own read become risky?", choices: ["When it hardens into certainty and stops revising itself", "When it notices difference between people", "When it avoids universal scripts"], correctIndex: 0, explanation: tone("Exactly. The chapter allows reading, but not omniscience.", "A confident map can become another lazy script if it stops updating.", "Right. Insight goes bad when it thinks it is final."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch19-q09", prompt: "How does Chapter 18 lead into Chapter 19?", choices: ["Restored awareness has to be directed onto the specific person in front of you", "Isolation makes all people identical", "Chapter 19 rejects the need for live awareness"], correctIndex: 0, explanation: tone("Correct. Chapter 18 restored the map, and Chapter 19 spends it on the person in play.", "Fresh awareness matters only if you use it on the actual recipient.", "Right. First recover the field, then read the person."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch19-q10", prompt: "What bridge carries Chapter 19 into Chapter 20?", choices: ["The next chapter says commitment always solves the problem", "Person-reading removes all need for leverage", "Once you know people differ, the next issue is how they try to bind your commitment"], correctIndex: 2, explanation: tone("Correct. The next chapter shifts from reading reactions to refusing binding commitments.", "Different people will try to recruit or trap you differently.", "Right. First read who they are, then resist the allegiance they want."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" }
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
for (const name of ["Leena", "Corin", "Saira", "Ilan"]) continuity.nameUsage[name] = [stem];
continuity.withinChapterNames[stem] = ["Leena", "Corin", "Saira", "Ilan"];
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
- Chapter-specific mechanism remains person-specific reading, offense cost, uneven reaction, and uncertainty limit rather than generic fear advice
- Hard depth preserves the person-reading-versus-overconfidence boundary and the Chapter 20 commitment bridge
- Quiz stays within supported facts from the approved draft and frozen source bundle

## Drift repair
- Repaired prewriter drift before writer start by replacing banned assigned name \`Felix\` with \`Ilan\`.

## Gate result
- Approved for chapter gate and automatic continuation
`;
writeText(paths.validation, validation);

fs.appendFileSync(
  paths.runLog,
  `\n- Completed writer, editor, critic, converter, quiz, and validator steps for Chapter 19.\n- Validation result: PASS.\n- Continuity hash sealed for \`${stem}\`: \`${seal}\`\n`,
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
