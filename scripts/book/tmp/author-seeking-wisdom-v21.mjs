import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const repo = resolve(import.meta.dirname, "../../..");
const stateChapters = resolve(repo, "scripts/book/prompts/chapterflow-v21-authored/state/chapters");
const stateBooks = resolve(repo, "scripts/book/prompts/chapterflow-v21-authored/state/books");

const categories = {
  categories: ["Decision Making", "Psychology", "Philosophy", "Self-Help"],
  tags: ["judgment", "mental-models", "bias", "probability", "incentives", "temperament"],
};

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function example(ch, n, name, title, format, tags, domain, audience, stakes, requiredBeat, scenario, whatToDo, whyItMatters) {
  return {
    exampleId: `ch${String(ch).padStart(2, "0")}-ex${String(n).padStart(2, "0")}-${slug(name)}-${slug(title).split("-").slice(0, 4).join("-")}`,
    title,
    tags: [format, ...tags].slice(0, 4),
    planSpec: { domain, audience, stakes, format, requiredBeat },
    scenario,
    whatToDo,
    whyItMatters,
  };
}

function makeQuestion(ch, n, prompt, correct, wrongA, wrongB, correctIndex, bloomsLevel, depthLevel) {
  const choices = [wrongA, wrongB, wrongA];
  choices[correctIndex] = correct;
  const fill = correctIndex === 0 ? [wrongA, wrongB] : correctIndex === 1 ? [wrongA, wrongB] : [wrongA, wrongB];
  for (let i = 0; i < 3; i += 1) {
    if (i !== correctIndex) choices[i] = fill.shift();
  }
  return {
    questionId: `ch${String(ch).padStart(2, "0")}-q${String(n).padStart(2, "0")}`,
    prompt,
    choices,
    correctIndex,
    explanation: "The better answer protects judgment in the live situation. It slows the attractive shortcut, names the pressure at work, and gives the person a test they can use before the cost grows.",
    bloomsLevel,
    depthLevel,
  };
}

function makeQuiz(ch, theme, move) {
  const stems = [
    `A manager is reviewing a plan that feels easy to approve because the room is already nodding. The deadline is noon, the spreadsheet looks clean, and one weak assumption has not been tested. Which move best fits ${theme}?`,
    `A teacher is choosing between a fast response and a slower check after a parent sends an angry note at 7:20 p.m. Which action best applies ${theme} before the reply goes out?`,
    `A founder sees one vivid customer story and wants to change pricing that afternoon. The sample is tiny, but the story is memorable. Which move best protects the decision?`,
    `A parent is deciding whether to punish a teenager after finding a cracked phone screen and three deleted messages. Which response best uses ${theme} in the moment?`,
    `A coach watches a player make the same mistake twice under pressure, then hears the player give a confident reason. Which next step is most useful?`,
    `An engineer is asked to sign off on a release after two green dashboards and one skipped manual check. Which plan best keeps judgment from becoming mere relief?`,
    `A clinic director must choose whether to accept a tidy explanation for late charts when overtime bonuses changed last month. Which action tests the situation best?`,
    `A student gets a surprising practice score and wants to call it proof that the exam is solved. Which response handles the evidence with better judgment?`,
    `A neighbor proposes a quick fix at a condo meeting, and everyone likes how cheap it sounds. Which move best prevents a hidden later cost?`,
  ];
  const blooms = ["apply", "analyze", "evaluate", "apply", "understand", "create", "analyze", "evaluate", "create"];
  const depths = ["simple", "standard", "deep", "standard", "simple", "deep", "standard", "standard", "deep"];
  const idxs = [0, 1, 2, 0, 1, 2, 0, 1, 2];
  return {
    passingScorePercent: 80,
    questions: stems.map((prompt, i) =>
      makeQuestion(
        ch,
        i + 1,
        prompt,
        move,
        "Trust the first confident story and move quickly so the group keeps its energy.",
        "Delay the choice without naming what evidence or pressure would change the answer.",
        idxs[i],
        blooms[i],
        depths[i],
      ),
    ),
  };
}

function makeCards(ch, idea, move) {
  return [
    {
      cardId: `ch${String(ch).padStart(2, "0")}-rc01`,
      front: `You are inside a decision that feels unusually clear. What quick retrieval cue should you use first?`,
      back: `Name the pressure that may be making it feel clear, then use ${move}. The cue turns a warm feeling into a checkable step.`,
      difficulty: "easy",
    },
    {
      cardId: `ch${String(ch).padStart(2, "0")}-rc02`,
      front: `A team gives a smooth explanation for behavior that benefits them. What should you retrieve before judging it?`,
      back: `Retrieve the ${idea} move: ask who gains, who pays, what fear is active, and what evidence would still fit if the story sounded less polished.`,
      difficulty: "medium",
    },
    {
      cardId: `ch${String(ch).padStart(2, "0")}-rc03`,
      front: `A plan sounds right because everyone wants relief. What question keeps the plan honest before action?`,
      back: `Ask what would make the attractive answer fail. A good review names the weak point before pride, fear, or group comfort hardens around it.`,
      difficulty: "medium",
    },
    {
      cardId: `ch${String(ch).padStart(2, "0")}-rc04`,
      front: `A past miss is being retold in a flattering way. What should the review recover?`,
      back: `Recover the real pressure, not the clean story. The useful lesson is the point where judgment bent, because that is the point you can protect next time.`,
      difficulty: "hard",
    },
  ];
}

function makePlan(ch, coreSkill, move) {
  return {
    coreSkill,
    ifThenPlans: [
      {
        context: "work",
        plan: `If a work decision feels easy because the room agrees, then I will pause for ninety seconds and use this move: ${move}.`,
      },
      {
        context: "health",
        plan: `If I want to skip a small health check because I have done the routine before, then I will read the one step most likely to be missed before acting.`,
      },
      {
        context: "personal",
        plan: `If a private choice feels urgent mainly because I want relief, then I will wait one short walk and write the reason that would change my mind.`,
      },
      {
        context: "relationships",
        plan: `If a conversation starts to become a defense of my first reaction, then I will ask what pressure is pulling each person before I answer.`,
      },
    ],
    twentyFourHourChallenge: `In the next day, pick one live decision worth at least twenty minutes of future cost. Write the attractive answer, the pressure making it attractive, and one test you will run before acting.`,
    weeklyPractice: `Once this week, review one decision that went well and one that went badly. For each, name the pressure, the missing check, and the rule you will carry into the next similar moment.`,
  };
}

function makeBreakdown(spec) {
  const { anchor, person, object, place, lesson, trap, move, limit, second, third, key } = spec;
  const fastRead = `${anchor} ${person} has ${object} in front of them at ${place}. The first answer feels clean because ${trap}. That clean feeling is the danger. A familiar pressure can make a weak choice feel like common sense while the cost is still hidden.\n\nTry the plain move: ${move}. Do it before the choice becomes public, before money is spent, or before pride has to defend it. The aim is not to become suspicious of everything. The aim is to catch the old shape of a mistake while it is still cheap to correct.`;

  const deepRead = `${anchor} ${person} does not need a speech. They need a small interruption that puts the decision back under review. ${lesson} A person under pressure often reads comfort as proof. The room agrees, the story sounds smooth, or the first result feels lucky enough to trust. That is when judgment needs a handle.\n\n${second} The useful handle is concrete. Write the base rate. Ask who benefits. Read the checklist. Trace the next effect. Wait until the first emotional surge passes. Each version does the same job: it breaks the spell of the first answer without pretending the answer is always wrong.\n\nA good test also has a limit. ${limit} The move should sharpen attention, not freeze action. Some choices need speed. Some scenes have too little data. Even there, one short check can name the pressure and protect the part of the decision most likely to bend.\n\n${key}`;

  const fullRead = `${anchor} ${person} has ${object} in front of them at ${place}. The first answer is pulling hard. It may be group comfort, a public promise, a vivid story, a cheap fix, a skipped step, or a hot feeling that wants to speak before judgment returns. ${lesson}\n\nA repeated mistake rarely announces itself as repeated. It arrives wearing local clothes. This client is different. This forecast is special. This shortcut is harmless. This anger is justified. The surface changes, but the pressure underneath often has an old shape. The practical skill is to notice that shape early enough to still change course.\n\n${second} That is why the move has to be small and usable. ${move}. It works because it gives the mind a job that is harder to fake than confidence. A base rate can be counted. A payoff can be named. A checklist item can be read aloud. A second effect can be traced. A pause can keep one bad sentence from becoming a whole conflict.\n\n${third} The deeper point is humility with tools. Better thinking is not a mood and it is not a label collection. A label can even become another shortcut if it lets you stop looking. The right test should make you more curious, not more smug. It should uncover what would change the answer, who carries the cost, and where the attractive story might be hiding a weak joint.\n\n${limit} This matters in ordinary rooms, not just in large failures. A bakery board, a ward schedule, a seed catalog, a boiler gauge, a pill organizer, and an angry email can all carry the same lesson. The stakes differ, but the mental move is similar: slow the force that wants to make the choice for you.\n\n${key}`;
  return { fastRead, deepRead, fullRead };
}

const chapterSpecs = [
  {
    number: 1,
    title: "Study Repeated Patterns of Misjudgment",
    readingTimeMinutes: 11,
    hook: "A flour-dusted preorder board can hide the same old mistake under a new holiday rush.",
    counterintuition: "Readers often expect bad judgment to look unusual, but it often looks familiar once you ask what pressure is repeating.",
    tryThisNow: "Before your next yes, write the decision in one line and add: what old mistake does this most resemble?",
    keyTakeaway: "A decision gets safer when you stop admiring its special details and test whether an old pattern of pressure is already shaping what feels obvious.",
    breakdownSpec: {
      anchor: "At 5:42 a.m.",
      person: "Willa",
      object: "a flour-dusted preorder board",
      place: "Croft Street Bakery",
      lesson: "Repeated patterns of misjudgment show up because fear, status, reward, and group comfort keep visiting new situations.",
      trap: "the holiday rush makes every extra order feel like found money",
      move: "ask what old error this scene most resembles, then name one sign that would prove the pattern is active",
      limit: "A pattern is a warning light, not a verdict.",
      second: "Beren sees the same extension-cord shortcut in a school gym and stops treating it as a fresh accident.",
      third: "Keiko feels her legal team nod at a clean opening statement and asks which hostile fact has not yet been invited into the room.",
      key: "The old shape of an error is useful only when it sends you back to the evidence.",
    },
    quizTheme: "pattern recognition under pressure",
    quizMove: "Name the repeated mistake shape, then test one piece of evidence that would show whether it is active here.",
    cardIdea: "pattern recognition",
    cardMove: "name the repeated mistake shape",
    coreSkill: "Build the habit of comparing a live decision with a known failure pattern. You are not labeling the case to feel clever. You are using the label to find the next check.",
    examples: [
      example(1, 1, "Willa", "Willa touches the flour scale before approving the rush board", "decision_point", ["bakery", "forecast"], "a bakery owner weighing whether to accept holiday preorders after two prior overbooking failures", "an owner who wants revenue but remembers last year's refunds", "whether the bakery protects quality or repeats a known capacity mistake", "she catches herself trusting the crowd's excitement before testing whether the old overbooking pattern is back", "Willa taps the flour scale at 5:42 a.m., its metal bowl cold under her fingers, while Croft Street Bakery's holiday preorder board glows with twenty-seven new sticky notes. The staff chat is full of clapping hands. Last December she said yes to every tray and refunded twelve families by noon. The new requests feel like proof that the bakery has grown. Her pen hovers over the accept column. She has to decide whether this is growth or the same overbooking trap in nicer handwriting.", "Stop before marking the orders accepted. Count oven hours, cooling racks, and delivery windows against last year's failure, then decide from capacity instead of applause.", "The same mistake gets expensive when it arrives with a better story. Checking the old pattern turns excitement back into arithmetic while Willa can still say no."),
      example(1, 2, "Beren", "Beren points at the taped cord in the gym", "dialogue", ["school", "safety"], "a junior fire marshal inspecting a school fundraiser setup", "a new inspector who wants to be liked by the principal", "whether a familiar safety shortcut gets corrected before families arrive", "he asks what changed after noticing the same extension-cord shortcut from last year", "Beren kneels on the Wednesday gym floor at 2:18 p.m., the wax smell sharp, and lifts a strip of blue tape covering an orange extension cord. Principal Dacey says, \"It held fine at last year's fair.\" Beren can hear folding chairs scraping behind him. \"What changed since then?\" he asks. She says, \"More booths.\" He looks at the popcorn machine, the bounce-house blower, and the cord warming under his thumb. He has to decide whether to treat it as a one-off shortcut or the same overload pattern returning.", "Ask for the load count and move the blower before the fair opens. Keep the tone calm, but make the repeated setup visible to the principal.", "A shortcut that survived once can become a tradition. Naming what changed stops yesterday's luck from being used as today's safety case."),
      example(1, 3, "Saffron", "Saffron sorts three cards and finds the old promise trap", "postmortem", ["wedding", "photo"], "a wedding photographer reviewing why she missed a promised family portrait", "a freelancer whose referrals depend on confidence and calm", "whether the next client gets a realistic shot list or another overpromised package", "she sees that the missed shot came from the same public-promise trap as prior jobs", "Saffron sits at her kitchen table Sunday at 11:06 p.m., three memory cards lined up beside a mug of cold tea. The missing portrait is not on any card. She told the bride's mother, in front of six relatives, that the terrace shot would be easy after the rain stopped. Now the terrace is dark in every frame. Her notebook shows two earlier jobs where a public promise made her defend a bad plan. She circles the sentence she said aloud and writes the pattern beside it.", "Write a private rule for future shot lists: no public promise until light, access, and timing are checked in the place itself.", "The error was not only a missed photo. It was the moment a spoken promise made revision feel embarrassing, which is the part she can catch next time."),
      example(1, 4, "Gareth", "Gareth predicts a rare fault and finds the intake clogged", "predict_reveal", ["marina", "repair"], "a boat mechanic diagnosing a stalled engine before a charter leaves", "a mechanic proud of solving unusual faults", "whether he wastes the launch window on a special theory instead of checking the repeated cause", "he predicts the new engine fault is special, then finds the same clogged intake he has seen twice this month", "Gareth wipes diesel from his sleeve at 6:27 a.m. on slip 14 while the charter captain drums a key against the rail. The engine coughs once and dies. Gareth says it sounds like a rare sensor fault, the kind he fixed in April. Then he sees eelgrass floating near the stern, the same green ribbon he pulled from two intakes this month. He must decide whether to chase the proud diagnosis or open the ordinary grate first.", "Check the intake before touching the sensor panel. Let the repeated local failure beat the attractive rare-fault story until the grate is clear.", "Expert pride likes unusual problems. A repeated pattern near the boat is better evidence than a clever memory from another repair."),
      example(1, 5, "Inez", "Inez rereads the chlorine vote after the pool closes", "before_after", ["pool", "operations"], "a city pool manager reviewing a staff vote about closing routines", "a manager whose young staff prefers a smooth end-of-shift process", "whether a popular routine leaves swimmers exposed to a recurring chemical miss", "she contrasts a smooth staff vote with the later failure to name a weak chlorine routine", "Friday 8:03 p.m., Inez stands by the city pool's chemical log with the clipboard edge pressed into her palm. Before the season, every lifeguard voted for the faster closing routine. The vote felt clean. After three cloudy-water mornings, she sees the pattern: nobody wanted to be the one who kept the group late, so the chlorine check became optional in practice. The wet concrete smells sour. She writes before and after across the log and draws an arrow between them.", "Replace the popular shortcut with a named final checker and a visible signoff box. Make the weak step someone's job before closing feels finished.", "Group comfort can hide an omission. The log shows that the problem was not knowledge of chlorine, it was a routine that let agreement erase the check."),
      example(1, 6, "Keiko", "Keiko feels the copier warm under her hand", "reflection", ["law", "trial"], "a trial attorney revising an opening statement late at night", "a lawyer whose team has praised the draft all week", "whether she catches group comfort before a hostile fact gets ignored", "she notices her clean opening statement is borrowing strength from the team's nods", "Keiko holds her palm on the copier glass Monday at 10:51 p.m., waiting for the next warm page of her opening statement. The office is quiet except for the machine's sweep. Everyone on the team loved the draft at dinner. That should comfort her. Instead she sees the missing sentence about the bad invoice date, the one fact opposing counsel will lift first. She is deciding whether the draft is strong or only familiar to people who already want it to win.", "Add the hostile invoice date to the first page and make the team answer it in plain words before printing the final version.", "A room that wants the same verdict can make a weak opening feel smooth. The opposing fact is a better test than another friendly nod."),
    ],
  },
  {
    number: 2,
    title: "Read Human Nature Through Incentives",
    readingTimeMinutes: 10,
    hook: "Cash envelopes on a folding table can explain more than a polished reason ever will.",
    counterintuition: "It is tempting to call incentive-reading cynical, but the better version is fairer because it admits mixed motives instead of pretending reasons are pure.",
    tryThisNow: "Pick one puzzling behavior today and write four columns: money, status, fear, and fairness. Put one possible pressure in each.",
    keyTakeaway: "Behavior becomes easier to read when you map what people gain, fear, owe, and want seen, while still leaving room for mixed motives.",
    breakdownSpec: {
      anchor: "At 7:32 a.m.",
      person: "Lior",
      object: "cash envelopes from a youth soccer fundraiser",
      place: "the folding table behind field 3",
      lesson: "Incentives include money, status, approval, fairness, favors, and the fear of losing face.",
      trap: "the rushed equipment vote is wrapped in the warm language of helping the kids",
      move: "map who gains, who pays, who gets status, and who is trying to avoid embarrassment",
      limit: "Incentive reading should not crush every motive into selfishness.",
      second: "Fatou watches a shift swap become clearer once she marks who gets sleep, overtime, and public credit.",
      third: "Pavel turns a lab argument from suspicion into a map of money, status, fairness, and fear.",
      key: "The point is clear sight, not cynicism.",
    },
    quizTheme: "incentive reading",
    quizMove: "Map the payoffs, fears, favors, and status pressures before accepting the stated reason.",
    cardIdea: "incentive reading",
    cardMove: "map the payoffs and fears",
    coreSkill: "Read behavior by checking the payoff structure around it. Include social payoffs, not only money, and keep mixed motives in view.",
    examples: [
      example(2, 1, "Lior", "Lior counts envelopes before the equipment vote", "scene", ["soccer", "money"], "a youth soccer treasurer evaluating a rushed equipment purchase", "a volunteer treasurer who likes the coach but must protect family dues", "whether a costly purchase is read as generosity or as a status play with other people's money", "he checks who benefits from the rushed equipment vote before calling it generosity", "Lior slides rubber bands off cash envelopes Saturday at 7:32 a.m. behind field 3, his fingers dusty from the folding table. Coach Bell wants the board to approve new travel jackets before kickoff. He calls it a gift for the kids. Lior sees the catalog open to the page with the coach's preferred logo, bigger than the players' names. Parents are walking up with coffee and dues. He is deciding whether generosity is the whole story or whether status is steering the vote.", "Ask who pays, who gets seen, and what cheaper option would serve the players. Put those answers on the table before the vote.", "The stated motive may be real and incomplete. Seeing the status payoff keeps Lior from confusing a warm reason with a full reason."),
      example(2, 2, "Fatou", "Fatou keeps the marker cap in her teeth", "dialogue", ["nurse", "schedule"], "a nurse scheduler reviewing a last-minute shift swap", "a scheduler who wants fairness on a short-staffed ward", "whether the swap spreads strain fairly or hides a private payoff", "she asks what the swap does for each nurse before accepting the tidy story", "Fatou stands at the ward whiteboard Tuesday at 6:05 a.m., marker cap in her teeth, while the night nurse says, \"It's just easier if Mara takes my Friday.\" The hallway smells like toast from the staff room. Fatou points to the overtime column. \"Easier for whom?\" she asks. The nurse looks away. Mara would get a third double, the night nurse would make a concert, and the charge nurse would avoid a fight. Fatou must decide whether to approve the neat story or price the swap honestly.", "Name the trade in plain terms, then ask Mara privately before moving the magnet. Fairness has to include the person carrying the extra load.", "A tidy explanation often hides where the cost lands. Mapping the benefit and burden keeps the schedule from rewarding whoever asks first."),
      example(2, 3, "Quentin", "Quentin holds the tasting invite in the rain", "decision_point", ["restaurant", "review"], "a restaurant critic receiving a free chef's-table invitation before writing a review", "a critic whose reputation depends on independence", "whether a generous invite changes pressure on the review even if no one asks for favor", "he decides whether to publish after noticing the gift changes the pressure on his judgment", "Quentin stands outside a rain-glossed bistro Thursday at 9:44 p.m., the chef's free tasting invite folded in his coat pocket. Inside, the last course was excellent. So was the hand-labeled wine sent over after the owner recognized him. Nobody asked for a good review. That is the problem. His phone is open to the draft headline, and his thumb hovers over save. He has to decide whether the gift has changed the pressure enough to delay publication.", "Disclose the invite to his editor and wait to file until he has paid for a normal meal. Make the incentive visible before judging the food.", "A favor can bend judgment without a bribe. Quentin protects the review by treating obligation as a pressure, not an accusation."),
      example(2, 4, "Hester", "Hester reads the donor praise at her dining table", "postmortem", ["nonprofit", "donor"], "a nonprofit director reviewing why a campaign drifted away from mission fit", "a director who values donor relationships and public praise", "whether future campaigns follow need or applause", "she sees that praise, not mission fit, pulled the campaign off course", "Hester sits at her dining table Monday at 8:16 p.m., donor emails printed in two piles beside a bowl of clementine peels. The failed campaign sounded noble in every update. In the margins she writes what each donor praised: boldness, speed, visibility. None praised the intake work families had asked for. She sees the turn now. The team followed the applause because applause felt like proof. She writes reputation payoff in red at the top.", "Build the next campaign review around beneficiary need first, donor visibility second. Make praise a data point, not the steering wheel.", "Praise is an incentive too. If Hester does not name it, the organization can drift while everyone feels virtuous."),
      example(2, 5, "Neven", "Neven spreads the contractor bids beside his phone", "thought_experiment", ["home", "contractor"], "a homeowner comparing two contractor bids with different referral chains", "a reader making a costly household choice under social pressure", "whether friendship and referral debt outrank the actual job requirements", "test the stated reason against hidden payoffs and reputation pressure", "Neven has two contractor bids spread on the kitchen island at 12:10 p.m., his phone buzzing beside the folder. One bid is cheaper and plain. The other is from his cousin's friend, with a glossy packet and three texts saying he is a good guy. Neven can already hear the family dinner if he says no. He has to decide whether the referral is evidence about tile work or a pressure system wrapped around the choice.", "Separate job proof from relationship pressure. Call two past clients for each bid, then tell the cousin the decision will follow workmanship and schedule.", "A referral can carry useful trust and hidden obligation at the same time. Naming both keeps Neven from calling pressure evidence."),
      example(2, 6, "Pavel", "Pavel redraws the lab complaint on a paper towel", "before_after", ["lab", "fairness"], "a lab supervisor investigating a fight over weekend equipment access", "a supervisor tempted to pick a villain quickly", "whether a lab conflict is solved by blame or by fixing the incentives underneath", "he replaces suspicion with a map of money, status, fairness, and fear", "Friday 4:48 p.m., the centrifuge timer chirps while Pavel redraws the lab complaint on a brown paper towel. Before, he saw one postdoc as selfish for booking every Saturday slot. After he writes grant deadline, visa renewal, authorship race, and fear of losing the sample line, the fight looks different. The behavior is still unfair. It is no longer mysterious. Pavel circles the access rule and reaches for the shared calendar.", "Fix the booking rule and name the pressures in the meeting without shaming the postdoc. Change what the system rewards.", "Blame alone leaves the payoff in place. A pressure map lets Pavel correct the behavior without pretending the person had only one motive."),
    ],
  },
  {
    number: 3,
    title: "Use Probability to Resist Overconfidence",
    readingTimeMinutes: 11,
    hook: "A clean story can make one ambulance note feel larger than fifty ordinary cases.",
    counterintuition: "Confidence feels like better evidence, but a plain count of similar cases often beats the story that feels most vivid.",
    tryThisNow: "Before trusting a prediction, write the last ten similar cases you can remember and count how often the expected result actually happened.",
    keyTakeaway: "Good judgment starts by asking how often this kind of thing happens, then lets the vivid case earn any extra weight it deserves.",
    breakdownSpec: {
      anchor: "At 1:37 a.m.",
      person: "Marisol",
      object: "two ambulance notes",
      place: "the ER bay desk",
      lesson: "Probability protects judgment by forcing vivid stories to compete with the rate at which similar things usually happen.",
      trap: "the dramatic note makes one case feel more certain than the quiet run of past cases",
      move: "write the base rate first, then adjust only for facts that truly change the odds",
      limit: "The base rate is a starting point, not a cage.",
      second: "Orla puts ten wet springs beside a charming seed forecast before buying.",
      third: "Boaz separates the thrill of a lucky poker win from the quality of the bet that produced it.",
      key: "Odds do not remove uncertainty, but they stop one bright story from pretending to be the whole field.",
    },
    quizTheme: "probability discipline",
    quizMove: "Start with the rate from similar cases, then adjust for case-specific facts without letting vividness run the decision.",
    cardIdea: "probability discipline",
    cardMove: "start with the rate from similar cases",
    coreSkill: "Use probability as a guard against the story that feels strongest. Start outside the case, then adjust inward with care.",
    examples: [
      example(3, 1, "Marisol", "Marisol writes the base rate on a gauze wrapper", "predict_reveal", ["ER", "triage"], "an ER charge nurse sorting two incoming ambulance calls", "a charge nurse managing scarce beds at night", "whether one vivid note takes resources from the likelier high-risk patient", "she writes base rates before the dramatic call note can own her attention", "Marisol tears the back off a gauze wrapper at 1:37 a.m. at the ambulance bay desk. Two rigs are eight minutes out. One note says chest pain after shoveling snow, calm vitals. The other says panic, screaming, family history, possible collapse. The second note feels louder. Before assigning the last monitored bed, she writes three numbers from the past month: panic calls, true cardiac events, shovel chest pain. The reveal is ugly for her first instinct. She has to choose the bed now.", "Use the base rates before the drama. Assign the monitored bed to the higher-probability risk, while keeping a fast reassessment plan for the louder case.", "The vivid call may still be serious, but volume is not likelihood. A quick count keeps scarce attention from following the scariest wording."),
      example(3, 2, "Orla", "Orla sets the seed catalog under a coffee ring", "decision_point", ["farm", "forecast"], "a farm co-op seed buyer choosing inventory before spring", "a buyer who wants to believe a pleasant weather forecast", "whether the co-op overbuys seed based on charm instead of odds", "she chooses whether to trust the charming forecast or count the last ten wet springs", "Orla has the seed catalog open Tuesday at 3:22 p.m., a coffee ring darkening the page for early sweet corn. The radio forecaster is cheerful about a dry April. Three growers have already called asking for extra bags. Orla's pencil is beside the order box. She remembers the storage shed stacked with unsold seed after last year's wet start. She has to decide whether the friendly forecast beats the co-op's notes from the last ten springs.", "Count the last ten spring starts and size the order from that range, not from the nicest forecast. Add a reorder trigger if the dry spell proves real.", "A forecast can update the odds, but it should not erase the record. Orla needs a bet sized to history plus new evidence, not hope alone."),
      example(3, 3, "Dusan", "Dusan stops the brilliant move before the clock slap", "dialogue", ["chess", "coaching"], "a chess coach teaching a student not to grab the first brilliant move", "a coach working with a talented but impulsive teen", "whether the student learns candidate-move discipline before tournament pressure", "he asks the student for three candidate moves before naming the brilliant one", "Dusan sits in the library basement Saturday at 10:09 a.m., a plastic chess clock ticking beside the board. His student Vera points at a rook sacrifice and says, \"This wins.\" Dusan sees why she loves it. He also sees the quiet knight fork two moves later. \"Give me three candidate moves before you touch the clock,\" he says. Vera groans. The sacrifice sparkles under the fluorescent light. Dusan has to decide whether to praise the idea or make her count alternatives first.", "Require three candidate moves and one risk for each before discussing the sacrifice. Let the brilliant move compete instead of crowning it early.", "A beautiful line can create false certainty. Listing alternatives makes confidence earn its place against other possible futures."),
      example(3, 4, "Althea", "Althea opens the poncho boxes after the crowd is soaked", "postmortem", ["festival", "weather"], "a festival planner reviewing a weather miss after an outdoor show", "a planner embarrassed by a preventable rain decision", "whether future plans use odds or the memory of one lucky dry year", "she records the ignored odds after the crowd gets soaked", "Althea stands under the leaking ticket tent Sunday at 6:58 p.m., unopened poncho boxes softening at her feet. The crowd is soaked. Her planning sheet says forty percent storms, and beside it she had written probably passes north. Last year's storm did pass north. That memory had felt like evidence. Now water runs down the cash drawer. She writes the actual forecast, the cost of staging ponchos, and the cost of not staging them in the postmortem.", "Record the forecast odds and the cost of both errors. Next time, stage cheap protection when downside is large enough, even if rain is not the most likely outcome.", "A forty percent risk can deserve action when the protection is cheap. Althea's mistake was treating not-most-likely as not-worth-preparing-for."),
      example(3, 5, "Nkem", "Nkem holds two mortgage files at the printer tray", "scene", ["mortgage", "underwriting"], "a mortgage underwriter comparing a clean borrower story with a messier but stronger file", "an underwriter whose work is judged by both speed and loan quality", "whether a neat narrative outranks actual default odds", "he notices the clean narrative is not the same as a better probability", "Nkem lifts two mortgage files from the shared printer at 4:11 p.m., toner still warm on his thumb. One borrower has a tidy promotion story and a bright cover letter. The other file is messy, with seasonal income notes and a boring debt record. The clean story pulls his eyes first. Then he marks late payments, cash reserves, and debt ratio on both covers. The plain file starts looking safer. Nkem stops walking toward the approval bin.", "Score the risk factors before reading the cover letters again. Let the borrower story explain numbers, not replace them.", "Narrative order can steer attention. The default risk sits in the pattern of payments and reserves, not in how easy the file is to like."),
      example(3, 6, "Boaz", "Boaz wipes cola from the rail and logs the lucky hand", "reflection", ["poker", "luck"], "a poker dealer on break separating a lucky win from a sound bet", "a player tempted to treat one win as proof of skill", "whether he learns from odds or lets pride rewrite the hand", "he separates a lucky win from a sound bet before pride edits the lesson", "Boaz sits on break at 2:26 a.m., a paper cup of cola sweating on the poker-room rail. He won a side game before his shift with a river card that had no business saving him. The chip stack felt like proof for ten warm minutes. Now he writes the hand on a napkin: bad call, thin draw, lucky river. The casino hums behind him. He is deciding whether to remember the win as skill or record the bet as a mistake that happened to pay.", "Log the decision quality, not the outcome. Mark the call as bad and keep the napkin where the chip count cannot edit it.", "A lucky result can train the wrong lesson if Boaz lets the ending judge the choice. Probability protects learning from the thrill of being paid."),
    ],
  },
  {
    number: 4,
    title: "Think Past the First Consequence",
    readingTimeMinutes: 11,
    hook: "A cheap fix can sound wise until the third consequence is standing at the counter.",
    counterintuition: "The first effect is usually easiest to see, but the later effects often decide whether the choice was smart.",
    tryThisNow: "Take one tempting action and write three lines: immediate result, next reaction, and what people learn to expect afterward.",
    keyTakeaway: "A wise choice follows the chain beyond the first relief and asks what the action teaches, invites, and makes harder next time.",
    breakdownSpec: {
      anchor: "At 8:47 a.m.",
      person: "Estelle",
      object: "a suspension form",
      place: "the deputy principal's office",
      lesson: "First effects are loud because they offer relief, but second and third effects set the real price.",
      trap: "the form promises fast order in a hallway that feels out of control",
      move: "write the immediate effect, the next reaction, and the future expectation before acting",
      limit: "Tracing consequences is not an excuse to avoid hard choices.",
      second: "Ronan sees that a snow-shovel discount today can train next week's customers to wait for panic pricing.",
      third: "Ciara realizes a rush florist order teaches every future client what deadline pressure can buy.",
      key: "The first result is only the first vote on the decision.",
    },
    quizTheme: "second-order thinking",
    quizMove: "Trace the immediate result, the next reaction, and the expectation the action creates before choosing.",
    cardIdea: "second-order thinking",
    cardMove: "trace the next reaction and future expectation",
    coreSkill: "Push the decision past first relief. Ask what the action causes next and what lesson it teaches the people who watch it.",
    examples: [
      example(4, 1, "Estelle", "Estelle holds the suspension form while the hallway squeaks", "decision_point", ["school", "discipline"], "a deputy principal deciding whether to suspend a student after a hallway fight", "a school leader under pressure to restore order quickly", "whether punishment teaches accountability or simply moves the problem downstream", "she pauses to trace what the punishment will teach the hallway, not just the student", "Estelle holds a suspension form Thursday at 8:47 a.m., shoe squeaks and whispers leaking through her office door. The student across from her has split knuckles and a blank stare. A suspension would quiet the hallway by lunch. It would also send him home to an empty apartment and teach the watching crowd that the school only appears after punches. Her pen hovers above the date line. She has to decide whether first relief is the whole consequence.", "Trace the next two effects before signing. Pair any consequence with a repair meeting, a hallway plan, and one adult who checks in tomorrow morning.", "Order by lunch is not the same as learning by Friday. Estelle needs a response that changes what the student and the hallway expect next."),
      example(4, 2, "Ronan", "Ronan rubs curling price stickers beside the shovel display", "dialogue", ["retail", "pricing"], "a hardware store owner deciding whether to discount snow shovels before a storm", "an owner trying to keep customers and margin during weather panic", "whether a quick discount trains bad future expectations", "he asks what a discount will do to next week's expectations before approving it", "Ronan stands beside the snow-shovel display Saturday at 6:19 a.m., price stickers curling in his hand. His clerk says, \"Drop them five dollars and they'll clear before the storm.\" Ronan looks at the window, already white at the edges. \"And next storm?\" he asks. The clerk shrugs. \"They wait us out.\" A customer is tugging the locked door. Ronan has to decide whether today's fast sell-through is worth teaching the town to expect panic discounts.", "Keep the price steady and add a small salt-bag bundle for early buyers. Reward readiness without training customers to wait for pressure.", "A discount solves the first problem and may create the next one. Ronan is pricing tomorrow's expectation as much as today's shovel."),
      example(4, 3, "Laleh", "Laleh watches the boiler gauge rattle after the patch", "before_after", ["building", "maintenance"], "an apartment superintendent reviewing a quick boiler repair", "a superintendent balancing tenant heat complaints and repair budgets", "whether a cheap patch creates larger tenant and equipment costs", "she compares the quick boiler patch with the tenant calls it caused later", "Monday 5:03 p.m., Laleh stands in the boiler room with the pressure gauge rattling like a spoon in a cup. Before, the cheap valve patch bought heat through one cold night and praise from the owner. After, the pressure swings tripped alarms for three mornings and filled her phone with tenant calls. The first consequence had been warmth. The second was distrust. The third is the repair crew now charging emergency rates.", "Write the full chain on the work order and recommend the real valve replacement. Show the owner the cost of the patch, not only the price of the part.", "A quick patch can borrow calm from tomorrow. Laleh's record makes the later cost visible while the owner still remembers the first relief."),
      example(4, 4, "Soraya", "Soraya keeps her thumb above the blue arrow", "thought_experiment", ["message", "conflict"], "a team lead about to send a blunt correction to a group thread", "a reader tempted by the clean feeling of public correction", "whether a correct reply creates defensiveness, silence, or better work", "trace the reply's second and third effects before pressing send", "Soraya is at her kitchen counter at 9:28 p.m., thumb above the blue arrow on a group-thread reply. Her correction is accurate. It is also sharp enough to make Devlin look careless in front of eight people. The first effect would be relief: the record fixed, the point made. The next effect might be a defensive paragraph. The third might be three quieter teammates next week. She has to decide whether accuracy needs this audience.", "Move the correction to a smaller thread unless the group truly needs the record fixed in public. Protect the lesson from avoidable shame.", "The first consequence is a corrected fact. The later consequence may be a team that hides errors. Soraya needs both in view before sending."),
      example(4, 5, "Bram", "Bram stacks cones and maps the water-table chain", "postmortem", ["race", "volunteer"], "a volunteer race director reviewing a race-day logistics failure", "a director who moved one station to solve a crowding issue", "whether a small operational fix is reviewed through its downstream effects", "he maps the chain from moving a water table to three missed mile markers", "Bram sits on his car bumper Sunday at 2:14 p.m., orange cones stacked by his left shoe and a race map spread across his knees. Moving the water table fifty yards solved the start-line crowding. It also blocked the chalk arrow, sent the lead cyclists wide, and left three mile markers unmanned while volunteers chased runners. He draws the chain with a ballpoint pen and stops at the word solved. It solved one thing and broke four.", "Review future changes against the map, not just the local crowd. Any moved station needs a route check and volunteer re-brief before race time.", "Local fixes can travel. Bram's map turns a well-meant adjustment into a visible chain of effects he can protect next year."),
      example(4, 6, "Ciara", "Ciara cuts ribbon while the rush order waits", "scene", ["florist", "deadline"], "a florist deciding whether to accept a last-minute premium order", "a shop owner with a small team and regular wedding clients", "whether saying yes once rewrites future deadline norms", "she sees that saying yes today changes every future deadline", "Ciara slices ivory ribbon Friday at 4:36 p.m., wet stems spread across the cutting mat and a rush-order email open beside the register. The client will pay double for ten centerpieces by noon tomorrow. Saying yes would cover the slow Tuesday. It would also pull two florists off a wedding order that was booked six months ago. Ciara can already hear next month's clients saying, but you did it for them. She must decide what the yes teaches.", "Decline the rush or offer a smaller same-day arrangement that does not touch booked work. Protect the shop's promise before the premium fee rewrites it.", "A profitable exception can become a new rule in the client's mind. Ciara is deciding what future deadlines will mean."),
    ],
  },
  {
    number: 5,
    title: "Use Checklists to Protect Judgment",
    readingTimeMinutes: 10,
    hook: "A pill organizer snapped shut too fast is exactly when memory needs a guardrail.",
    counterintuition: "A checklist can feel beneath an expert, but it protects the expert from the familiar task that no longer feels risky.",
    tryThisNow: "Write a three-item checklist for one repeated task you trust too much. Put the easiest-to-miss step in the middle.",
    keyTakeaway: "Use a checklist where a familiar task can hide a costly omission, and keep it short enough that people will read it under pressure.",
    breakdownSpec: {
      anchor: "At 7:08 a.m.",
      person: "Thandi",
      object: "a plastic pill organizer",
      place: "a patient's porch with the light still on",
      lesson: "Checklists protect judgment where knowledge is already present but attention is likely to skip a step.",
      trap: "the route is familiar enough to make the pill check feel automatic",
      move: "read the few critical checks aloud before the task feels finished",
      limit: "A checklist should protect the weak point, not cover the whole world.",
      second: "Crispin reads the crane lift list through the radio while sleet ticks on the cab window.",
      third: "Greer finds the skipped audio preflight step that ruined a guest recording.",
      key: "The list is there for the moment when memory feels most trustworthy.",
    },
    quizTheme: "checklist discipline",
    quizMove: "Use a short checklist for the few costly omissions that repeat under speed, comfort, or pressure.",
    cardIdea: "checklist discipline",
    cardMove: "read the few critical checks aloud",
    coreSkill: "Protect repeated work from skipped steps. A checklist is not a replacement for judgment. It is a small support for the moment judgment gets busy.",
    examples: [
      example(5, 1, "Thandi", "Thandi opens the pill organizer under the porch light", "scene", ["health", "home"], "a home-health nurse checking medication on a familiar morning route", "a nurse who knows the patient well and risks trusting habit", "whether a common medication omission is caught before a dose is missed", "she uses the two-line check before trusting a familiar route", "Thandi clicks open the plastic pill organizer Tuesday at 7:08 a.m., the porch light still on and rain ticking through the gutter. Mr. Noll is already joking from the recliner. She has done this route for six months and can feel her hands moving ahead of her eyes. The Tuesday slot is empty, but the refill bottle is still sealed in her bag. Her two-line card says dose, refill, swallow. She must choose in the next minute: rhythm or the card.", "Read the two-line card out loud and refill before conversation pulls her away. Treat familiarity as the reason to check, not the reason to skip.", "The risk is not ignorance. The risk is a known step disappearing inside a friendly routine."),
      example(5, 2, "Crispin", "Crispin reads the lift list through sleet", "dialogue", ["crane", "safety"], "a crane operator refusing to skip a lift checklist under time pressure", "an operator with a foreman pushing to beat weather", "whether speed pressure overrides a critical pre-lift check", "he reads the lift checklist aloud when the site foreman wants speed", "Crispin sits in the crane cab Wednesday at 5:55 a.m., sleet ticking on the window and the radio hissing against his vest. The foreman says, \"We are losing the weather. Pick it.\" Crispin looks down at the laminated lift card clipped beside the joystick. \"Ground mats?\" he asks. \"Fine.\" \"Spotter line?\" Silence. Below, a rigger turns and looks for the tag rope still coiled on the pallet. Crispin must pick between speed and the next checklist line.", "Keep reading until every critical item is answered by the person responsible. No lift moves while a checklist silence is still open.", "The checklist turns pressure into shared facts. A missing tag line is easier to fix before steel is hanging."),
      example(5, 3, "Meera", "Meera chooses the allergen card over memory", "decision_point", ["kitchen", "wedding"], "a hotel pastry chef checking allergens during a wedding rush", "a chef who knows the recipes but is tired during service", "whether a guest's allergy is protected when memory feels fast", "she chooses the allergen card over memory during a wedding rush", "Meera stands at the hotel pass Saturday at 8:41 p.m., almond flour dusting her sleeve and six dessert plates waiting under the heat lamps. A server asks whether the pistachio tart is safe for table twelve's nut allergy. Meera knows the recipe. She made the batch herself. The allergen card is clipped three feet away, already smudged with butter. The band starts another song in the ballroom. She has to decide whether memory is enough.", "Step to the card and read the nut line before answering. Make the server wait ten seconds for the check that protects the guest.", "Food memory is fast and fragile under service noise. The card exists for the exact moment when certainty feels cheaper than checking."),
      example(5, 4, "Sol", "Sol clips the closing list to the campground keys", "before_after", ["campground", "routine"], "a campground ranger preventing repeated closing misses", "a ranger whose evening rounds are interrupted by campers", "whether a tiny list stops recurring gate and fire-ring misses", "he contrasts missed gate locks with a small closing list clipped to the keys", "Monday 9:12 p.m., Sol sweeps a flashlight beam across the campground padlocks. Before the list, he trusted the same loop each night and still missed the north gate twice, then a fire ring after a camper stopped him to ask about showers. After he clips a four-item closing list to the key ring, the interruptions stay the same. The misses stop. He can feel the paper bump his knuckles before he pockets the keys.", "Keep the list on the key ring and check it at the gate, not back at the office. Put the prompt where the miss happens.", "A checklist works best when it meets the task in the field. Sol did not need more willpower, he needed the weak step attached to the keys."),
      example(5, 5, "Greer", "Greer stares at the flat guest waveform", "postmortem", ["podcast", "audio"], "a podcast producer reviewing a ruined guest recording", "a producer who has made the same setup many times", "whether future recordings get a preflight check even when the guest is famous and time is tight", "she finds the skipped preflight step that ruined a guest recording", "Greer sits in the studio Friday at 11:33 p.m., headphones beside a flat waveform stretching across the screen. The guest was famous, late, and kind. Greer skipped the preflight playback because the levels bounced green. Now the local track is empty. In the trash bin is the sticky note she meant to turn into a checklist: mic source, local record, cloud backup, ten-second playback. She writes skipped playback in the incident log and underlines it twice.", "Turn the sticky note into a preflight card and require the ten-second playback before every interview, no matter who is waiting.", "The ruined file came from a step everyone knew. The checklist protects the known step when status and hurry make skipping feel reasonable."),
      example(5, 6, "Ansel", "Ansel lays the red rope across the mat", "predict_reveal", ["climbing", "instruction"], "a climbing instructor teaching a student why the knot check matters", "an instructor working with a confident beginner", "whether a student learns to inspect the knot instead of trusting the feeling of done", "he lets a student predict the knot is fine, then shows the unthreaded tail", "Ansel lays a red rope across the gym mat Sunday at 1:04 p.m. and asks his student to predict whether the figure-eight is safe. The student grins and says yes before bending close. Ansel turns the knot once. The tail has not been threaded back through. The student's chalky fingers stop moving. Ansel is about to let the wall card teach the next move.", "Point to the card and have the student run each knot check aloud on this rope, then on his own harness.", "The visible miss teaches why the list exists. The card gives the student a repeatable check after the surprise fades."),
    ],
  },
  {
    number: 6,
    title: "Protect Temperament While You Learn",
    readingTimeMinutes: 11,
    hook: "The smartest note in the margin is useless if anger gets to answer the email first.",
    counterintuition: "Learning more is not enough, because pressure can lock the better idea out of reach at the exact moment it is needed.",
    tryThisNow: "Choose one trigger that makes you react fast. Write the sentence you will say to buy a pause before your next response.",
    keyTakeaway: "Wisdom depends on keeping access to good judgment when fear, pride, anger, or status pressure tries to make the choice for you.",
    breakdownSpec: {
      anchor: "At 9:17 p.m.",
      person: "Roswitha",
      object: "a parent email glowing beside a metronome",
      place: "her violin studio",
      lesson: "Temperament is the guard that keeps better thinking reachable while emotion is loud.",
      trap: "the email makes a public criticism feel like a threat to identity",
      move: "build a pause between the first surge and the committed response",
      limit: "Steadiness does not mean swallowing every feeling or avoiding every hard reply.",
      second: "Tejal asks a trainee to breathe before reviewing a missed compression count.",
      third: "Solveig waits out the first anger spike before calling a client about a tax penalty.",
      key: "The goal is not perfect calm. It is fewer choices made by the hottest part of the moment.",
    },
    quizTheme: "temperament under pressure",
    quizMove: "Create a short pause that keeps fear, pride, or anger from acting before judgment returns.",
    cardIdea: "temperament",
    cardMove: "build a pause before the committed response",
    coreSkill: "Protect access to what you know when pressure rises. The work is not to feel nothing. The work is to keep the first feeling from becoming the whole decision.",
    examples: [
      example(6, 1, "Roswitha", "Roswitha lets the metronome tick before replying", "decision_point", ["teaching", "email"], "a violin teacher deciding how to answer a parent's sharp complaint", "a teacher whose pride is touched by a public criticism", "whether she protects the relationship and the lesson plan from a defensive first reply", "she delays the first reply so pride does not write it", "Roswitha reads the parent email Monday at 9:17 p.m., the metronome still ticking on the studio shelf. The message says her recital prep is disorganized and copies the other parents. Her first reply is already forming, exact dates, extra rehearsals, proof. The cursor blinks after Dear Mr. Vale. Her jaw is tight enough to ache, and her hand hovers over the trackpad.", "Save the draft, set a morning reminder, and write only the facts she wants to keep after sleep. Let the first heat pass before the relationship carries it.", "The facts may be on her side, but pride can make true facts sound like punishment. A pause keeps accuracy from becoming damage."),
      example(6, 2, "Tejal", "Tejal touches the vinyl mask before the review", "dialogue", ["paramedic", "training"], "a paramedic instructor reviewing a missed compression count with a shaken trainee", "an instructor who wants learning to survive embarrassment", "whether feedback lands as a lesson or as humiliation", "she asks the trainee to breathe before reviewing the miss", "Tejal stands beside the practice dummy Thursday at 2:52 p.m., the vinyl mask smelling of disinfectant. Her trainee Rook missed the compression count and is talking fast. \"I know, I know, I froze.\" Tejal puts one hand on the manikin's shoulder. \"Breathe once before we review it,\" she says. He inhales like it hurts. The class is watching from the wall. Tejal must choose between the count and the person who needs to hear it.", "Slow the body first, then review the count with the timer in view. Ask Rook to restart the sequence once after he can speak at normal speed.", "Embarrassment blocks learning. Tejal protects the lesson by lowering the threat enough for the trainee to use it."),
      example(6, 3, "Henrik", "Henrik marks fear in the term-sheet margin", "postmortem", ["startup", "law"], "a startup counsel reviewing why he pushed a bad contract clause", "a lawyer who dislikes looking weak in investor talks", "whether the next negotiation names fear before it dresses as legal logic", "he admits fear of looking weak, not legal logic, drove the bad clause", "Henrik sits Friday at 6:40 p.m. with a redlined term sheet, highlighter drying on page seven. The clause he fought for made the investor angry and won nothing useful. In the meeting he called it leverage. In the margin now he writes fear of looking weak. The phrase stings more than the redline. His legal reason was not fake, but it was not driving. He circles the moment his voice got louder.", "Record the emotional driver beside the legal issue and rehearse a calmer concession line before the next negotiation.", "A cleaned-up reason would teach the wrong lesson. Henrik can only improve the next talk if the record includes the fear that bent this one."),
      example(6, 4, "Zadie", "Zadie hears lane ropes knock after the parent challenge", "reflection", ["swim", "coaching"], "a swim coach replaying a public challenge from a parent", "a coach who knows technique but gets rattled by status pressure", "whether she sees how pressure made knowledge unavailable", "she sees that her knowledge vanished when a parent questioned her in public", "Zadie walks the empty pool deck Saturday at 7:25 a.m., lane ropes knocking softly against the tile. Yesterday a parent asked, in front of four swimmers, why her daughter was moved to lane three. Zadie knew the answer: stroke count, fatigue, safer pacing. What came out was a clipped sentence about coach judgment. Now the pool smells of chlorine and regret. She is deciding what vanished first, the facts or her steadiness.", "Write the real answer on an index card and practice the first calm sentence for public challenges. Prepare the pause, not just the policy.", "Knowledge can disappear behind status threat. Zadie needs a way to keep the useful answer reachable while people are watching."),
      example(6, 5, "Murat", "Murat writes one pause question by the vending machine", "before_after", ["union", "conflict"], "a shop steward changing how he handles tense break-room arguments", "a steward whose instant rebuttals keep escalating good issues", "whether a pause question preserves judgment during conflict", "he changes from instant rebuttal to one written pause question", "Tuesday 3:07 p.m., the vending machine hums outside the break room while Murat writes one question on the back of a receipt: what problem are we solving first? Before, he met every angry complaint with a faster rebuttal and watched the room split into camps. After he starts reading the question aloud before answering, the anger does not vanish. It stops choosing the agenda. The receipt gets soft at the fold from his thumb.", "Use the written question before any rebuttal. Make the room name the problem before pride turns the meeting into sides.", "A pause question gives judgment a place to stand. Murat is not avoiding conflict, he is stopping speed from running it."),
      example(6, 6, "Solveig", "Solveig waits beside the curled calculator tape", "scene", ["tax", "client"], "a tax preparer deciding when to call a client about a penalty notice", "a preparer exhausted near filing deadline", "whether anger controls a client call after an avoidable mistake", "she protects judgment by calling the client after the first anger spike passes", "Solveig stares at the penalty notice April 14 at 8:58 p.m., calculator tape curled over the desk edge like a white ribbon. The client ignored three document requests and now wants the fee waived. Solveig's first call would be sharp and satisfying. Her headset is already in her hand. She sees the yellow note on her monitor: no client calls in the first anger spike. Solveig must choose now: note or headset.", "Wait ten minutes, write the three facts the client needs, then call with the document trail open. Keep the boundary clear without donating the call to anger.", "Anger may point to a real problem, but it is a poor spokesperson. Solveig protects both the boundary and the relationship by waiting."),
    ],
  },
];

for (const ch of chapterSpecs) {
  ch.breakdown = makeBreakdown(ch.breakdownSpec);
  ch.quiz = makeQuiz(ch.number, ch.quizTheme, ch.quizMove);
  ch.reviewCards = makeCards(ch.number, ch.cardIdea, ch.cardMove);
  ch.implementationPlan = makePlan(ch.number, ch.coreSkill, ch.cardMove);
  ch.memorableLines = [
    {
      text: ch.keyTakeaway,
      location: "keyTakeaway",
      why: "It carries the main move in one practical sentence.",
    },
    {
      text: ch.breakdown.deepRead.split(/(?<=[.!?])\s+/).find((s) => s.length >= 55 && s.length <= 180) ?? ch.breakdown.deepRead.split(/(?<=[.!?])\s+/)[0],
      location: "breakdown.deepRead",
      why: "It turns the idea into a scene-level test.",
    },
    {
      text: ch.breakdown.fullRead.split(/(?<=[.!?])\s+/).reverse().find((s) => s.length >= 55 && s.length <= 180) ?? ch.breakdown.fullRead.split(/(?<=[.!?])\s+/).at(-1),
      location: "breakdown.fullRead",
      why: "It gives the reader the limit and the use case together.",
    },
  ];
}

mkdirSync(stateChapters, { recursive: true });
mkdirSync(stateBooks, { recursive: true });
writeFileSync(resolve(stateBooks, "seeking-wisdom.categories.json"), JSON.stringify(categories, null, 2), "utf8");

for (const ch of chapterSpecs) {
  const out = {
    chapterId: `seeking-wisdom-ch${String(ch.number).padStart(2, "0")}`,
    number: ch.number,
    title: ch.title,
    readingTimeMinutes: ch.readingTimeMinutes,
    hook: ch.hook,
    counterintuition: ch.counterintuition,
    tryThisNow: ch.tryThisNow,
    keyTakeaway: ch.keyTakeaway,
    breakdown: ch.breakdown,
    examples: ch.examples,
    quiz: ch.quiz,
    reviewCards: ch.reviewCards,
    implementationPlan: ch.implementationPlan,
    memorableLines: ch.memorableLines,
  };
  writeFileSync(
    resolve(stateChapters, `${out.chapterId}.v21-native.chapter.json`),
    JSON.stringify(out, null, 2),
    "utf8",
  );
}

console.log(`Wrote ${chapterSpecs.length} Seeking Wisdom v21 chapters.`);
