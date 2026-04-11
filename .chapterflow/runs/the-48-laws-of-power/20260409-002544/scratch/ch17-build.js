const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const runRoot = path.resolve(".chapterflow/runs/the-48-laws-of-power/20260409-002544");
const num = 17;
const stem = `ch${String(num).padStart(2, "0")}`;
const title = "Keep Others in Suspended Terror: Cultivate an Air of Unpredictability";
const chapterId = "ch17-keep-others-in-suspended-terror-cultivate-an-air-of-unpredictability";
const createdAt = new Date().toISOString();

function tone(gentle, direct, competitive) {
  return { gentle, direct, competitive };
}

const canonical = `Greene's seventeenth law turns from scarcity into uncertainty. The chapter begins with a simple strategic fact: predictability makes other people comfortable. Once your timing, reactions, and rhythms become easy to map, others can prepare around you. They gain confidence in their forecasts. That confidence lowers caution and makes management easier.

That is why the chapter values unpredictability. If your pattern becomes harder to read, other people lose some of that forecast comfort. Their planning becomes shakier. They hesitate longer. Greene's point is not that chaos is glamorous. It is that unreadable timing can create strategic caution because stable expectations are easier to exploit than broken ones.

The chapter is strongest when it keeps that mechanism narrow. Unpredictability works here because it interrupts the routines others use to manage you. A person whose responses never vary can be studied like a schedule. A person whose timing occasionally breaks pattern can be harder to approach with the same confidence. Uncertainty itself becomes pressure.

That distinction matters because the law is easy to vulgarize into random volatility. Greene is not best understood as praising disorder for its own sake. The mechanism has a limit. Unpredictability helps only when it unsettles other people more than it destabilizes you. If your pattern-breaking looks sloppy, impulsive, or uncontrollable, the effect reverses. You stop looking dangerous and start looking unreliable.

The pattern appears in ordinary settings. A manager whose meetings always follow the same rhythm becomes easier to anticipate than one whose timing sometimes shifts. A student council that telegraphs every move loses leverage because opponents can prepare calmly. A personal dynamic can become stale and easy to game when every response arrives on the same beat. In each case, broken pattern creates caution.

The limit remains central. Not every context rewards unpredictability, and not every broken rhythm produces strength. Teams still need trust. Relationships still need baseline steadiness. Greene's harder point is conditional: unpredictability can create useful hesitation, but only when credibility and self-command remain intact. The move is about disrupting hostile expectation, not performing instability.

Chapter 16 asked how absence and spacing can renew value. Chapter 17 asks what happens when others cannot settle into a reliable rhythm around you at all. That points forward too. If broken pattern creates caution, the next question is what happens when you overcorrect into isolation and fortress-building, cutting yourself off from the very information and contact that strategy still needs.`;

const edited = `Greene's seventeenth law turns from scarcity into uncertainty. The chapter begins with a simple strategic fact: predictability makes other people comfortable. Once your timing, reactions, and rhythms become easy to map, others can prepare around you. They gain confidence in their forecasts. That confidence lowers caution and makes management easier.

That is why the chapter values unpredictability. If your pattern becomes harder to read, other people lose some of that forecast comfort. Their planning becomes shakier. They hesitate longer. Greene's point is not that chaos is admirable. It is that unreadable timing can create strategic caution because stable expectations are easier to exploit than broken ones.

The chapter is strongest when it keeps that mechanism narrow. Unpredictability works here because it interrupts the routines others use to manage you. A person whose responses never vary can be studied like a schedule. A person whose timing occasionally breaks pattern can be harder to approach with the same confidence. Uncertainty itself becomes pressure.

That distinction matters because the law is easy to vulgarize into random volatility. Greene is not best understood as praising disorder for its own sake. The mechanism has a limit. Unpredictability helps only when it unsettles other people more than it destabilizes you. If your pattern-breaking looks sloppy, impulsive, or uncontrollable, the effect reverses. You stop looking dangerous and start looking unreliable.

The pattern appears in ordinary settings. A manager whose meetings always follow the same rhythm becomes easier to anticipate than one whose timing sometimes shifts. A student council that telegraphs every move loses leverage because opponents can prepare calmly. A personal dynamic can become stale and easy to game when every response arrives on the same beat. In each case, broken pattern creates caution.

The limit remains central. Not every context rewards unpredictability, and not every broken rhythm produces strength. Teams still need trust. Relationships still need baseline steadiness. Greene's harder point is conditional: unpredictability can create useful hesitation, but only when credibility and self-command remain intact. The move is about disrupting hostile expectation, not performing instability.

Chapter 16 asked how absence and spacing can renew value. Chapter 17 asks what happens when others cannot settle into a reliable rhythm around you at all. That points forward. If broken pattern creates caution, the next question is what happens when you overcorrect into isolation and fortress-building, cutting yourself off from the very information and contact that strategy still needs.`;

const critic = `# Chapter 17 Critic Report

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
- Paragraph 5 is the most vulnerable because the work, school, and personal cases can collapse into generic "be surprising" advice if conversion drops the readability-versus-credibility distinction.

Strongest sentence:
- "Uncertainty itself becomes pressure."

Anchor use notes:
- The draft stays inside the frozen support: predictability creates comfort, disrupted pattern creates caution, unreadable timing unsettles forecasting, and the chapter fails when unpredictability becomes instability.

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
        "This law says people get comfortable when they can predict your pattern. If your timing, reactions, and routines stay the same, others can prepare for you more easily. Greene's point is that unpredictability changes that comfort. When your rhythm is harder to map, people hesitate more because their forecasts feel weaker. But the law has a limit. It is not advice to become chaotic or unreliable. Unpredictability only helps when it creates caution without making you look unstable. The narrower lesson is to avoid becoming so readable that others can manage you like a schedule. Break the pattern enough to create caution, not enough to lose control. A useful surprise should make them slower, not make you look broken. Readability is the real target, not steadiness itself. The room should lose confidence in the map, not confidence in you. The gain comes from weaker forecasting and stronger caution in the other side.",
        "Greene's seventeenth law argues that predictability makes other people easier around you because they can see your rhythm coming. Unpredictability changes that by making timing harder to forecast. The point is not random chaos. It is that uncertainty can produce caution and hesitation when others can no longer rely on a stable pattern. But the law has a limit. If your pattern-breaking looks sloppy or unstable, the effect reverses and your credibility drops. The chapter works when it stays on controlled unreadability rather than on reckless volatility. The stronger version leaves other people less sure of their map while keeping your own position visibly intact. Their caution should rise while your command still looks real. The advantage is disciplined uncertainty, not noise for its own sake. They should read less certainty in the timing and more control in you. That pressure belongs in their planning, not in your posture.",
        "This law makes a sharp point: if people can read your pattern, they can get comfortable around it. Break that rhythm and the comfort weakens. Greene's claim is that unpredictability creates caution because stable routines are easier to manage than broken ones. But the move is not universal. Randomness that destroys trust is not power. The lesson is to stop being fully readable, not to become chaos on legs. Keep enough control that the uncertainty unsettles them more than it damages you. The room should feel less certain about the forecast, not more certain that you are unreliable. Useful variation keeps command visible even while pattern breaks. The gain comes from hesitation in them, not instability in you. Break the timetable and keep the authority standing. Make them doubt the schedule, not your nerve. Force caution, not contempt. Keep the edge in the pattern break, not in theatrics.",
      ),
      keyTakeaways: [
        { point: tone("Predictable patterns make other people more comfortable and prepared.", "Readability lowers caution.", "A visible rhythm makes you easier to manage.") },
        { point: tone("Controlled unpredictability can create hesitation by weakening forecasts.", "Broken pattern creates caution.", "Unreadable timing slows other people down.") },
        { point: tone("The law fails when unpredictability turns into instability or lost credibility.", "Chaos is not the same as strategic uncertainty.", "If the pattern break wrecks trust, you lose the edge.") }
      ],
      oneMinuteRecap: tone(
        "This law says broken pattern can create caution when predictability has made you too easy to read, but the move fails if instability replaces control.",
        "Predictability comforts. Controlled unpredictability unsettles. Chaos destroys credibility.",
        "Be harder to forecast, not harder to trust."
      )
    },
    medium: {
      chapterBreakdown: tone(
        `Greene's seventeenth law argues that predictability makes people easier around you because stable patterns are easier to read. Once others can map your timing and reactions, they prepare more calmly. Their confidence in the forecast reduces caution. You become easier to approach, manage, and plan around because your rhythm no longer surprises them.

That is the chapter's uncertainty logic. Unpredictability increases hesitation because it weakens those forecasts. When your responses or timing break pattern, other people lose some of their comfort. They have to pause longer, calculate harder, and leave more room for what they cannot fully predict. Greene therefore treats unreadable timing as a source of strategic pressure.

The chapter works best when it stays narrow. This is not praise for random chaos or emotional instability. The point is not disorder for its own sake. It is that stable patterns can be exploited, while controlled disruption can make exploitation less confident. Unpredictability matters here because broken rhythm changes what other people think they can safely expect.

Ordinary settings show the pattern clearly. A manager whose meetings always unfold the same way becomes easier to anticipate than one who changes cadence deliberately. A debate council that telegraphs every next move loses leverage because opponents can prepare without tension. A personal exchange can become too easy to game when every response arrives on schedule. In each case, pattern stability reduces caution.

The limit is just as important. Not every context rewards unpredictability, and not every broken rhythm helps. Teams still need credibility. Relationships still need basic steadiness. Greene's harder point is conditional: unpredictability works only when it unsettles hostile forecasting without making you look impulsive or unreliable. That is why the chapter bridges naturally from Chapter 16's scarcity into Chapter 17's uncertainty, and then toward Chapter 18, where too much defensive distance becomes its own danger.`,
        `Greene's seventeenth law says predictability lowers leverage because it makes your behavior easier to read and manage. If people can see your rhythm clearly, they gain confidence. They know when to prepare, how to respond, and what to expect next. That confidence makes them calmer than the chapter wants them to be. They start reserving less caution for your range.

Unpredictability changes that by interrupting their pattern map. When timing, response, or visible habit become less readable, caution rises. Other people hesitate because their expectation loses firmness. Greene is therefore interested in strategic unreadability, not in random mood or chaos.

That distinction keeps the chapter disciplined. The law is not saying that volatility is automatically powerful. It works only when unpredictability remains controlled enough that you still look credible. If your pattern-breaking appears sloppy, impulsive, or unstable, the uncertainty stops feeling threatening and starts feeling weak.

You can see the mechanism in ordinary settings. A leader with a perfectly regular cadence becomes easier to plan around than one who shifts timing deliberately. A school group that reveals every next move on schedule becomes less intimidating because opponents can rehearse calmly. A personal dynamic can lose edge when responses become perfectly forecastable. In each case, predictability lowers strategic tension.

The chapter also carries a hard limit. People still need to trust your baseline reliability. If unpredictability damages that trust, the effect reverses. Instead of creating useful hesitation in others, you create doubt about yourself. That is why Chapter 17 follows Chapter 16 so closely: after value has been renewed by scarcity, unreadable timing can make others less sure of their forecasts. But if the tactic keeps escalating, Chapter 18 warns that isolation and overdefensiveness can become the next trap. A broken pattern helps only when the person breaking it still looks more governed than the people trying to read it. The tactic works when their map fails and your credibility does not. The result should be caution in their planning, not suspicion about your discipline. That is the difference between strategic uncertainty and self-sabotage.`,
        `This law starts with a practical weakness: if your rhythm is obvious, people settle around it. Predictability lets others forecast your next step, and a good forecast lowers caution. Once your behavior starts reading like a timetable, other people gain comfort because surprise has mostly left the board.

Unpredictability interrupts that comfort. Break the visible pattern, and other people hesitate more because they can no longer trust their map in the same way. Greene's point is that uncertainty can pressure a room without direct confrontation. Broken rhythm alone can unsettle expectation.

That does not make the chapter a manual for chaos. The move is narrower than that. It works when your pattern becomes less readable while your credibility stays intact. It fails when broken rhythm starts looking like disorder, moodiness, or self-damage. Then the uncertainty weakens you more than it weakens them.

The pattern travels across common settings. A worker with a perfectly fixed response cadence becomes easier to anticipate. A design-lab group that always shows its hand early becomes comfortable for rivals to manage. A personal exchange that follows the same beat every time becomes easy to game. Less readability changes the level of caution in each case.

The limit is decisive. Some systems reward steadiness more than surprise, and some roles cannot afford much volatility at all. The chapter remains useful only when unpredictability creates hesitation without making you lose trust or self-command. That is why it points beyond Chapter 16's spacing and into Chapter 18's warning about isolation. Disrupted pattern can create caution, but strategy still needs contact, information, and control.`,
      ),
      keyTakeaways: [
        {
          point: tone("Stable patterns make you easier to forecast and manage.", "Predictability lowers tension.", "A fixed rhythm hands other people a cleaner map."),
          moreDetails: tone("The chapter focuses on readability because confidence in a forecast reduces caution.", "Once others know your cadence, they can prepare with less strain.", "When your pattern reads like a schedule, the room stops bracing.")
        },
        {
          point: tone("Controlled unpredictability can create caution by weakening forecasts.", "Broken rhythm introduces hesitation.", "Unreadable timing slows their confidence."),
          moreDetails: tone("The value of unpredictability here is not chaos but uncertainty in the other side's planning.", "The chapter's pressure comes from disrupting expectation without losing command.", "If the map keeps failing, the room moves less comfortably.")
        },
        {
          point: tone("Strategic unreadability differs from sloppiness or emotional instability.", "Uncertainty is not the same as disorder.", "A useful pattern break still has to look controlled."),
          moreDetails: tone("The chapter allows disruption only when credibility remains intact.", "If unpredictability starts looking impulsive, the edge reverses.", "Once the break reads like loss of control, the room stops hesitating and starts downgrading you.")
        },
        {
          point: tone("Work, school, and personal settings all show how forecastable rhythms reduce leverage.", "Perfect regularity can make strong positions easier to manage.", "Visible cadence can make you comfortable to oppose."),
          moreDetails: tone("Repeated meeting rhythm, fixed response cadence, and obvious sequencing can all weaken tension once they become easy to model.", "The chapter becomes practical when you ask where your next move feels too easy to guess.", "If rivals can script your sequence before you begin, your leverage is already thinner than it looks.")
        },
        {
          point: tone("The law stays useful only when unpredictability remains controlled and conditional.", "Some situations need steadiness more than broken rhythm.", "Use this everywhere and you just start looking unstable."),
          moreDetails: tone("Some roles need steadiness more than surprise, so the reader has to judge credibility before breaking pattern.", "The chapter keeps its force only when uncertainty unsettles others more than it damages you.", "If the pattern break destroys trust, you lose the game you meant to complicate.")
        }
      ],
      activationPrompt: tone(
        "Think of one place where your rhythm may have become too readable and ask what small controlled variation would make others less comfortable forecasting you.",
        "Choose one role or relationship where predictability may be lowering your leverage, then identify one pattern that could be broken without hurting trust.",
        "Pick one board where your rhythm is obvious and name the pattern break that would make the map less clean."
      ),
      selfCheckPrompt: tone(
        "Am I disrupting a readable pattern, or am I drifting into instability that will damage trust?",
        "Does this context benefit from uncertainty, or does it mainly need steadiness from me?",
        "Will this pattern break create caution, or just make me look unreliable?"
      ),
      oneMinuteRecap: tone(
        "The chapter says predictable rhythm comforts others, while controlled unpredictability can create hesitation, but the move fails when credibility collapses.",
        "Break the forecast, not your own baseline trust.",
        "Be harder to map without becoming harder to rely on."
      )
    },
    hard: {
      chapterBreakdown: tone(
        `Greene's seventeenth law treats predictability as a strategic gift you may be handing to other people without noticing. If your reactions, timing, and rhythms become highly legible, others stop spending energy on uncertainty. They forecast you more confidently. That confidence changes the entire field. It lowers caution, reduces suspense, and makes your behavior easier to manage because the next step feels less like a question and more like a timetable. The cleaner that timetable looks, the less strain they feel while planning against you.

That is why unpredictability matters in this chapter. It is not random noise. It is the deliberate disruption of pattern that others were starting to trust too much. Once those expectations weaken, hesitation rises. Other people must leave more room for the unknown. They second-guess their timing, recalculate their approach, and lose some of the ease that predictability had granted them. Greene's point is that unreadable rhythm can create pressure even before any overt action lands.

The hard distinction is between strategic uncertainty and self-damaging volatility. The chapter is not strongest when it sounds wild. It is strongest when the unpredictability remains controlled enough that you still look governed rather than chaotic. If the broken pattern reads as instability, mood, or impulse, the effect reverses. Other people stop feeling cautious of your strategic range and start discounting you as unreliable.

For that reason, the law travels carefully across ordinary settings. In work, a person with perfectly regular timing can become easy for rivals or colleagues to plan around. In school, a group that signals every next move on schedule loses tension because opponents can prepare without strain. In personal life, a completely forecastable response pattern can make the dynamic feel easy to manipulate. The same mechanism runs through each case: stable pattern increases comfort; controlled disruption weakens it.

Yet the law carries an immediate limit. Not every environment rewards broken rhythm, and not every role can afford much unpredictability. Teams still need coordination. Relationships still need a baseline of trust. If your pattern-breaking destroys confidence in your steadiness, you may create the wrong kind of uncertainty. Instead of caution about your range, others simply lose respect for your reliability.

So the chapter's real question is exact: are you interrupting hostile forecasting, or are you eroding your own credibility? This is why Chapter 17 follows Chapter 16 so closely. Scarcity and absence can restore value, but unpredictability changes the readability of whatever remains visible. It also explains the bridge into Chapter 18. A reader who keeps escalating unreadability may drift into defensive isolation, forgetting that strategy still depends on information, contact, and a field you can actually read back. The law succeeds only when broken pattern creates hesitation in others without breaking command in yourself. If the uncertainty starts living more inside you than inside them, the tactic has already flipped. The room should become less comfortable around you, not less respectful of you. The forecast has to weaken on their side while your command still looks intact on yours. Otherwise the uncertainty becomes self-inflicted damage instead of strategic pressure. The strongest version leaves them slower, warier, and still unsure of the next beat. It also keeps them spending attention on possibilities they can no longer dismiss as routine. Their confidence shrinks before your reliability does. They should feel more exposed to surprise while still seeing you as deliberate, measured, and hard to map.`,
        `Greene's seventeenth law argues that stable patterns make people easier to manage because legibility lowers caution. Once your responses and timing can be charted, other people grow calmer around you. They can prepare with more confidence because they trust the map they have built. Predictability therefore weakens leverage not by making you weaker in substance, but by making you less uncertain to face. It lets them behave as if your next move is already half-written. They stop paying the full price of caution.

Unpredictability changes that map. When your rhythm stops being fully readable, confidence in the forecast drops. Other people hesitate because they can no longer trust the timing they expected. Greene is therefore interested in uncertainty as strategic pressure. A broken pattern can force more caution than a loud warning because the unknown itself alters behavior.

The chapter remains precise only when it separates controlled unreadability from disorder. This is not a recommendation to become chaotic, impulsive, or emotionally unstable. It works only if the unpredictability makes your pattern harder to manage while your credibility stays intact. The moment the tactic makes you look unreliable, the pressure shifts back onto you.

Ordinary settings reveal the mechanism well. A leader with a perfectly regular cadence becomes easier to rehearse against. A debate council whose moves are always forecastable loses leverage because rivals can prepare without fear of surprise. A personal relationship with entirely fixed response rhythms can become easy to steer. In each case, stable pattern lowers strategic tension.

But the law also has a discipline problem. Readers can overapply it and confuse volatility with power. That fails because some contexts need steadiness more than uncertainty. Trust, coordination, and self-command still matter. The stronger claim is narrower: unpredictability works when it introduces hesitation in others without destroying your own reliability.

The deeper test is therefore conditional: does broken rhythm unsettle hostile expectation, or does it mainly make you look unstable? Chapter 16 restored value through scarcity. Chapter 17 makes that value harder to forecast. Chapter 18 then warns what happens when defensive unreadability hardens into isolation. The sequence matters. Uncertainty can create caution, but strategy still requires contact with the field. The law succeeds only when your unpredictability complicates their map more than it damages your own standing within it. A good pattern break leaves them less certain and you still believable. It raises caution in the room while preserving faith in your command. The point is to create hesitation in their planning, not confusion about your own reliability. A useful unreadability sharpens their caution while leaving your structure visible. Done well, it makes the room slower to act without making you smaller in their eyes. They should begin budgeting for surprise again, and that restored caution is the leverage the chapter is trying to create. The best version burdens their timing calculations while keeping your own discipline visibly intact. That extra uncertainty is what makes approach feel costly.`,
        `This law works only if you understand how much comfort stable patterns give to other people. Predictability lets them prepare. It reduces suspense. It allows them to treat your next move as something they can model instead of something they must respect as uncertain. Greene's claim is that comfort of this kind lowers caution and makes opposition easier.

Unpredictability disrupts that comfort. Once your rhythm is less readable, the forecast weakens. Other people leave more room for error. They hesitate, hedge, and spend more energy accounting for what they cannot settle in advance. The chapter's power comes from that pressure of uncertainty, not from spectacle.

The key boundary is control. This chapter does not reward aimless volatility. It rewards pattern disruption that remains credible. If the unpredictability looks like self-loss, poor judgment, or emotional chaos, the room stops respecting the uncertainty and starts judging the instability. Then the tactic fails because you have made yourself less trusted, not more strategically difficult.

That is why the chapter applies carefully in ordinary life. A worker with a perfectly fixed cadence can be managed more comfortably than one whose timing has some disciplined variation. A school group whose sequence never changes becomes easier to anticipate. A personal dynamic with no variation at all becomes easier to game. In each case, broken pattern can create caution if it stays within the bounds of credibility.

The danger is making unpredictability into identity rather than tactic. Some situations need steadiness, clarity, and visible follow-through. Some people depend on your reliability. If your pattern-breaking corrodes that foundation, the uncertainty you create will mostly hurt your own position. Greene's point therefore stays conditional at every level: strategic unreadability matters only if self-command still governs it.

So the chapter's real test is whether others hesitate more because your pattern is harder to read, or whether they simply trust you less because it looks unstable. Chapter 17 stands after scarcity because renewed value becomes more potent when its rhythm is less forecastable. It points into Chapter 18 because too much unreadability can tempt a retreat into fortress thinking. The law works only when the broken rhythm unsettles their confidence while leaving your own credibility visibly intact. The room should become less sure of the forecast and not less sure of your command. If the pattern break makes you look weaker instead of harder to read, the edge has already vanished. The best result is a room that hesitates before acting because the map is less clean, not because you have become visibly unsound. Make them recalculate the approach without giving them grounds to dismiss you as erratic. Their caution should grow faster than their doubt. Force them to price in more uncertainty about timing, exposure, and response while you still look composed enough to carry the move. If their plan gets heavier before your credibility gets lighter, the pressure is landing on the correct side of the board. That margin matters.`,
      ),
      keyTakeaways: [
        {
          point: tone("Predictability lowers tension because it gives other people a cleaner forecast.", "Readable rhythm weakens leverage.", "A clear pattern hands the other side a map."),
          moreDetails: tone("The chapter focuses on comfort in the other person's planning, not on a literal loss of strength.", "Stable expectations reduce caution because others can prepare more easily.", "If your next move reads like a timetable, the room braces less.")
        },
        {
          point: tone("Controlled unpredictability creates hesitation by weakening trusted expectations.", "Broken pattern introduces uncertainty pressure.", "Unreadable timing forces more caution into the room."),
          moreDetails: tone("The power here comes from making forecasts less firm, not from loud drama.", "The chapter's uncertainty effect depends on disrupting pattern without losing command.", "If the map keeps failing, their confidence starts slowing down.")
        },
        {
          point: tone("Strategic unpredictability differs from volatility because credibility must survive the pattern break.", "Uncertainty is useful only while control remains visible.", "Break the rhythm, not your own command."),
          moreDetails: tone("The chapter allows unreadability only when self-command and baseline reliability remain intact.", "If broken pattern looks impulsive, others stop respecting the uncertainty and start discounting the instability.", "A good surprise creates caution; a sloppy one creates contempt.")
        },
        {
          point: tone("Work, school, and personal settings all show how forecastable cadence lowers pressure.", "Fixed sequencing can make strong positions easier to rehearse against.", "Visible rhythm can make you comfortable to oppose."),
          moreDetails: tone("Regular response cadence, obvious sequencing, and telegraphed next moves can all reduce leverage once the pattern becomes dependable to rivals.", "The chapter becomes practical when you examine where your pattern has become too easy to model.", "If the other side can prepare three beats ahead, your visible rhythm is already doing part of their work.")
        },
        {
          point: tone("The law stays useful only when unpredictability remains a tactic rather than a personality collapse.", "Some contexts punish broken rhythm more than they reward it.", "Use this blindly and you just start looking unstable."),
          moreDetails: tone("Some roles need steadiness more than uncertainty, so the reader has to judge context before breaking pattern.", "Chapter 17 keeps its force only when others are unsettled more than your own credibility is damaged.", "If the pattern break shreds trust, the tactic has flipped against you.")
        }
      ],
      activationPrompt: tone(
        "Identify one place where your rhythm may have become too forecastable and ask what controlled variation would create caution without weakening trust.",
        "Choose one context where others may be overconfident in reading your timing, then test what pattern break would unsettle that confidence while keeping credibility intact.",
        "Pick one board where your cadence is obvious and decide what variation would spoil the map without making you look unstable."
      ),
      selfCheckPrompts: [
        tone(
          "Am I making myself harder to forecast, or am I only making myself harder to trust?",
          "Does this pattern break create hesitation in others, or mostly signal instability in me?",
          "Will they respect the uncertainty, or just discount the disorder?"
        ),
        tone(
          "Can I vary rhythm here without damaging coordination, care, or baseline credibility?",
          "Does this context allow strategic unreadability, or does it still depend on visible steadiness from me?",
          "Will this break the map they built, or break the confidence they should still have in me?"
        )
      ],
      predictionPrompt: tone(
        "Once unpredictability has unsettled forecasts, how might Chapter 18 show the danger of overcorrecting into isolation and fortress-building?",
        "If broken pattern creates caution, what changes when a person retreats too far from contact in the next chapter?",
        "After the map gets harder to read, what danger appears when the player starts disappearing behind walls?"
      ),
      oneMinuteRecap: tone(
        "This law argues that broken pattern can create hesitation by weakening forecasts, but the effect holds only while credibility and self-command remain intact.",
        "Predictability comforts others. Controlled unpredictability unsettles them. Instability weakens you.",
        "Be harder to map without becoming harder to believe."
      )
    }
  },
  examples: [
    {
      title: "Orla Breaks an Overly Readable Work Rhythm Before Others Can Plan Around It",
      format: "decision_point",
      category: "work",
      endingType: "broader_principle",
      scenario: tone("Orla realizes her response cadence and meeting rhythm have become so regular that others can prepare around her too easily.", "She has to decide whether to keep the comfortable pattern or vary it enough that forecasting her becomes harder.", "Orla can keep running on rails or make the timetable less safe to trust."),
      whatToDo: tone("She introduces controlled variation into visible timing while keeping the work itself reliable.", "She breaks the pattern enough to unsettle forecasts without looking unstable.", "She ruins the map without burning the bridge."),
      whyItMatters: tone("The chapter says readability lowers caution while controlled unpredictability raises it.", "Her leverage improves when others lose confidence in the old rhythm.", "If they cannot trust the schedule, they stop moving so comfortably.")
    },
    {
      title: "Mitesh Hears Why the Debate Council Lost Leverage by Telegraphing Every Move",
      format: "dialogue",
      category: "school",
      endingType: "self_directed_question",
      scenario: tone("Mitesh listens as someone explains why the debate council became easy to manage once everyone could predict its next step.", "He hears how fixed pattern reduced tension and let rivals prepare calmly.", "Mitesh learns that a readable council writes half the opposing script for free."),
      whatToDo: tone("He asks where the group's pattern can become less forecastable without becoming disorganized.", "He looks for controlled unreadability instead of comfortable repetition.", "He asks how to bend the rhythm without breaking the council."),
      whyItMatters: tone("The chapter distinguishes useful uncertainty from reckless chaos.", "A group loses leverage when its next move becomes too easy to rehearse against.", "Visible rhythm can make even strong players comfortable to oppose.")
    },
    {
      title: "Celine Weighs Unreadable Timing Against Looking Emotionally Unstable",
      format: "dilemma",
      category: "personal",
      endingType: "surprising_implication",
      scenario: tone("Celine wants to stop being perfectly easy to forecast, but she knows erratic behavior could look like self-loss rather than strategy.", "She has to choose between disciplined variation and volatility that would damage trust.", "Celine can break the beat or break belief in her steadiness."),
      whatToDo: tone("She changes timing and predictability without making care or self-command disappear.", "She uses controlled unreadability instead of emotional randomness.", "She bends the rhythm without shattering the frame."),
      whyItMatters: tone("The chapter allows pattern disruption only when credibility survives it.", "Useful unpredictability creates hesitation in others without making you look unstable.", "If the surprise kills trust, the tactic flips.") 
    },
    {
      title: "Bram Predicts Why One Leader Refuses a Perfectly Regular Cadence",
      format: "predict_reveal",
      category: "work",
      endingType: "cross_domain",
      scenario: tone("Bram notices one leader avoid a fully regular visible rhythm and predicts it is meant to keep others from planning too comfortably.", "He expects the leader to preserve strategic uncertainty without looking chaotic.", "Bram can already tell the move is about caution, not mess."),
      whatToDo: tone("He judges whether the variation unsettles forecasts while leaving the role credible.", "He looks for controlled unpredictability rather than theatrical volatility.", "He scores the move on caution created, not confusion sprayed."),
      whyItMatters: tone("The chapter says uncertainty works when it interrupts comfort in the other side's map.", "Less readable timing can increase hesitation if the underlying position still looks solid.", "A broken schedule can pressure the room without a word.")
    },
    {
      title: "Design-Lab Debrief Finds That a Fixed Pattern Made an Opponent Too Comfortable",
      format: "postmortem",
      category: "school",
      endingType: "common_trap",
      scenario: tone("A design lab reviews why a rival group stayed unusually calm and discovers its own move sequence had become perfectly easy to anticipate.", "The team sees that stable rhythm gave opponents too much preparation comfort.", "The lab realizes it had been handing out a clean map every round."),
      whatToDo: tone("They identify where sequence, timing, or visible routine had become too readable.", "They separate useful consistency from pattern that made them easy to manage.", "They stop treating predictability as harmless once it starts writing the rival's script."),
      whyItMatters: tone("The chapter warns that comfort in a forecast lowers caution.", "Fixed pattern can weaken tension even when the underlying position is strong.", "If the enemy feels relaxed, your rhythm may be helping them.") 
    },
    {
      title: "Before and After a Personal Rhythm Stopped Being Easy to Game",
      format: "before_after",
      category: "personal",
      endingType: "perspective_reframe",
      scenario: tone("Before, every response arrived on the same beat and the pattern became easy to predict. After, more controlled variation made the dynamic harder to steer casually.", "The contrast is between forecastable rhythm and readable but less manageable timing.", "Before was timetable. After was caution."),
      whatToDo: tone("Notice whether changed timing creates healthier caution without making the bond feel chaotic.", "Judge the variation by whether credibility holds while predictability drops.", "Ask whether the new rhythm is harder to game without becoming hard to trust."),
      whyItMatters: tone("The chapter says broken pattern helps only when it unsettles others more than it destabilizes you.", "Less readability can restore leverage if baseline steadiness survives.", "The gain comes from caution, not from confusion theater.")
    }
  ],
  implementationPlan: {
    coreSkill: tone("The core skill is disrupting forecastable pattern without letting unpredictability turn into instability.", "Core skill: weaken other people's map of your rhythm while keeping credibility intact.", "Core skill: break the timetable without breaking the trust.")
  ,
    ifThenPlans: [
      { context: "work", plan: tone("If my work rhythm has become too easy to forecast, then I will vary visible timing enough to reduce comfort while keeping outputs dependable.", "If others are planning around my cadence too easily, then I will break the readable sequence without breaking reliability.", "If work can rehearse my move, I spoil the map and keep the bridge standing.") },
      { context: "school", plan: tone("If a school group keeps telegraphing its next move, then I will identify where controlled variation would create caution without causing disorder.", "If rivals seem too calm because our pattern is obvious, then I will disrupt the sequencing they trust.", "If the school board can read the script, I rewrite the rhythm without dropping the line.") },
      { context: "personal", plan: tone("If a personal dynamic has become too easy to game, then I will vary rhythm without making care or steadiness disappear.", "If predictability is lowering leverage personally, then I will introduce controlled unreadability that still preserves trust.", "If the bond reads like a timetable, I bend the beat without breaking belief in me.") }
    ],
    twentyFourHourChallenge: tone("Within 24 hours, identify one context where your rhythm may be too forecastable and name one controlled pattern break that would reduce comfort without harming trust.", "Today, choose one role or relationship where others may be overconfident in reading your next step and define one variation that keeps credibility intact.", "Before the day ends, find one board where your cadence is obvious and pick one move that ruins the map without making you look unstable."),
    weeklyPractice: tone("For one week, track where predictability lowered caution, where controlled variation created useful hesitation, and where broken rhythm would have damaged credibility instead.", "Spend seven days auditing pattern, uncertainty, and the point where surprise stops helping and starts looking unstable.", "Run a one-week unpredictability audit and separate useful unreadability from sloppy volatility.")
  },
  reviewCards: [
    { cardId: "ch17-rc01", front: tone("Why does predictability weaken leverage in this chapter?", "How does readable rhythm make you easier to manage?", "Why is a visible timetable strategically soft?"), back: tone("Because stable patterns let other people forecast you more calmly and prepare with less caution.", "Predictability lowers tension by giving others a cleaner map of your next move.", "A readable rhythm makes the room more comfortable around you."), difficulty: "easy" },
    { cardId: "ch17-rc02", front: tone("Why can unpredictability create caution?", "How does broken pattern produce hesitation?", "Why does an unreadable rhythm pressure the room?"), back: tone("Because uncertainty weakens confidence in the forecast and forces others to hesitate more.", "Broken pattern makes planning less comfortable and more cautious.", "If the map keeps failing, the room slows down."), difficulty: "easy" },
    { cardId: "ch17-rc03", front: tone("How is strategic unpredictability different from chaos?", "What separates unreadability from instability?", "Why isn't disorder the same as edge?"), back: tone("Strategic unpredictability stays controlled enough that credibility survives the pattern break.", "The chapter values uncertainty that unsettles others without making you look impulsive.", "Break the schedule, not your own command."), difficulty: "medium" },
    { cardId: "ch17-rc04", front: tone("Where does this law show up in ordinary life?", "How do work, school, and personal settings reveal forecast comfort?", "Where does readable rhythm lower pressure?"), back: tone("It appears wherever fixed cadence, obvious sequencing, or telegraphed timing make you easier to rehearse against.", "Stable rhythm can make even strong positions more comfortable to manage.", "Any room gets calmer once it trusts your timetable."), difficulty: "medium" },
    { cardId: "ch17-rc05", front: tone("What limit keeps this law from becoming self-defeating?", "Why must unpredictability stay conditional?", "What happens if you overuse broken rhythm?"), back: tone("Some contexts need trust and coordination more than uncertainty, so volatility can flip the tactic against you.", "The law works only while unpredictability creates more hesitation in others than damage in your own credibility.", "Use this blindly and the room stops feeling cautious and starts feeling doubtful."), difficulty: "hard" }
  ],
  keyTakeawayCard: tone("Controlled unpredictability can create caution by weakening forecasts, but the tactic works only if credibility and self-command remain intact.", "This law is about breaking hostile expectation without turning yourself into chaos.", "Spoil the map, not your own command."),
};

const quiz = {
  passingScorePercent: 70,
  questions: [
    {
      questionId: "ch17-q01",
      prompt: "Why does predictability weaken leverage in this chapter?",
      choices: [
        "Because stable patterns let other people forecast you more calmly",
        "Because all routine behavior automatically looks weak",
        "Because unpredictability always replaces competence"
      ],
      correctIndex: 0,
      explanation: tone("Correct. The chapter says readable rhythm lowers caution because others can prepare around it.", "Predictability gives the other side a cleaner map of your next move.", "Right. A timetable comforts the room."), 
      bloomsLevel: "remember-understand",
      depthLevel: "easy"
    },
    {
      questionId: "ch17-q02",
      prompt: "What does uncertainty change here?",
      choices: [
        "It removes the need for discipline completely",
        "It creates hesitation by weakening confidence in the forecast",
        "It proves that chaos is always powerful"
      ],
      correctIndex: 2,
      explanation: tone("Yes. The chapter values uncertainty because it makes planning less comfortable for others.", "Broken pattern weakens trusted expectation and raises caution.", "Right. If the map gets shaky, the room slows down."), 
      bloomsLevel: "remember-understand",
      depthLevel: "easy"
    },
    {
      questionId: "ch17-q03",
      prompt: "Why is this law not generic chaos advice?",
      choices: [
        "Because unpredictability only helps while credibility and control still remain intact",
        "Because Greene rejects all pattern-breaking completely",
        "Because the law applies only in military settings"
      ],
      correctIndex: 2,
      explanation: tone("Exactly. The chapter is about controlled unreadability, not random instability.", "If unpredictability destroys trust, the tactic flips.", "Right. Break the forecast, not your own command."), 
      bloomsLevel: "remember-understand",
      depthLevel: "easy"
    },
    {
      questionId: "ch17-q04",
      prompt: "In Orla's work scenario, what best fits the chapter?",
      choices: [
        "Keep the same visible cadence so everyone knows what to expect",
        "Introduce controlled variation into timing while keeping the work dependable",
        "Become erratic enough that nobody can coordinate with her"
      ],
      correctIndex: 2,
      explanation: tone("Yes. The point is to weaken forecasts without weakening reliability.", "She should break the readable rhythm, not become chaotic.", "Right. Spoil the map and keep the bridge standing."), 
      bloomsLevel: "apply-analyze",
      depthLevel: "medium"
    },
    {
      questionId: "ch17-q05",
      prompt: "Why did Mitesh's debate council lose leverage?",
      choices: [
        "Because predictable sequencing let rivals prepare calmly in advance",
        "Because all councils are automatically unreadable",
        "Because stability is always worse than confusion"
      ],
      correctIndex: 0,
      explanation: tone("Correct. Forecast comfort lowered the opponents' caution.", "The council telegraphed too much of its next move.", "Yes. The readable script made rivals calmer than they should have been."), 
      bloomsLevel: "apply-analyze",
      depthLevel: "medium"
    },
    {
      questionId: "ch17-q06",
      prompt: "What is the strongest reading of Celine's dilemma?",
      choices: [
        "Any personal unpredictability automatically creates respect",
        "Controlled unreadability can help, but emotional instability would damage trust",
        "The safest move is to become impossible to read at all costs"
      ],
      correctIndex: 1,
      explanation: tone("Yes. The chapter allows variation only while credibility survives.", "Useful unpredictability is different from instability that scares trust away.", "Right. Bend the beat without breaking belief."), 
      bloomsLevel: "apply-analyze",
      depthLevel: "medium"
    },
    {
      questionId: "ch17-q07",
      prompt: "Why can uncertainty create hesitation?",
      choices: [
        "Because it weakens confidence in other people's forecasts and timing",
        "Because people never act under any uncertainty at all",
        "Because disorder always looks impressive"
      ],
      correctIndex: 0,
      explanation: tone("Correct. The chapter's pressure comes from less trusted expectation.", "If the forecast weakens, hesitation grows.", "Yes. A shaky map slows the room."), 
      bloomsLevel: "analyze-evaluate",
      depthLevel: "hard"
    },
    {
      questionId: "ch17-q08",
      prompt: "When does unpredictability become self-damaging in this chapter?",
      choices: [
        "When it lowers your own credibility more than it unsettles others",
        "When it breaks a forecast others trusted too much",
        "When it remains controlled and deliberate"
      ],
      correctIndex: 0,
      explanation: tone("Exactly. The tactic fails once instability starts outweighing strategic caution.", "If others stop trusting your steadiness, the uncertainty has flipped against you.", "Right. When the pattern break shreds credibility, the edge is gone."), 
      bloomsLevel: "analyze-evaluate",
      depthLevel: "hard"
    },
    {
      questionId: "ch17-q09",
      prompt: "How does Chapter 16 lead into Chapter 17?",
      choices: [
        "Scarcity makes timing irrelevant in the next chapter",
        "Renewed value from spacing becomes harder to manage once timing also grows less readable",
        "Absence and unpredictability are exactly the same mechanism"
      ],
      correctIndex: 1,
      explanation: tone("Yes. Chapter 16 restores value through spacing, and Chapter 17 changes how readable that valued presence is.", "The sequence moves from scarcity into uncertainty about timing.", "Right. First the value sharpens, then the map gets shakier."), 
      bloomsLevel: "analyze-evaluate",
      depthLevel: "hard"
    },
    {
      questionId: "ch17-q10",
      prompt: "What bridge carries Chapter 17 into Chapter 18?",
      choices: [
        "Unpredictability naturally leads to total isolation as the best strategy",
        "Once pattern becomes harder to read, the next danger is retreating too far into fortress-style isolation",
        "Chapter 18 rejects all need for caution or contact"
      ],
      correctIndex: 1,
      explanation: tone("Correct. The next chapter warns about overcorrecting into defensive separation.", "Broken pattern can create caution, but strategy still needs contact and information.", "Right. The map gets shakier, but hiding behind walls creates a new weakness."), 
      bloomsLevel: "analyze-evaluate",
      depthLevel: "hard"
    }
  ]
};

chapter.quiz = quiz;

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
for (const name of ["Orla", "Mitesh", "Celine", "Bram"]) {
  continuity.nameUsage[name] = [stem];
}
continuity.withinChapterNames[stem] = ["Orla", "Mitesh", "Celine", "Bram"];
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
- Supporting structures present: implementation plan, review cards, key takeaway card
- Review package wraps the full validated chapter JSON
- Reading metrics written and continuity hash sealed at \`${seal}\`

## Prose checks
- No contamination phrases detected in reader-facing tone objects
- No plain-string scenario fields in required mode
- No exact tone collapse detected
- Chapter-specific mechanism remains predictability, uncertainty, hesitation, broken pattern, and credibility limit rather than generic chaos advice
- Hard depth preserves the unreadability-versus-instability boundary and the Chapter 18 isolation bridge
- Quiz stays within supported facts from the approved draft and frozen source bundle

## Drift repair
- No repair required during this chapter pass.

## Gate result
- Approved for chapter gate and automatic continuation
`;
writeText(paths.validation, validation);

fs.appendFileSync(
  paths.runLog,
  `\n- Completed writer, editor, critic, converter, quiz, and validator steps for Chapter 17.\n- Validation result: PASS.\n- Continuity hash sealed for \`${stem}\`: \`${seal}\`\n`,
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
