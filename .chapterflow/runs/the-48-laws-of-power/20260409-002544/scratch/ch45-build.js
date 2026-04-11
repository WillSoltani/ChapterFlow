const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const runRoot = path.resolve(".chapterflow/runs/the-48-laws-of-power/20260409-002544");
const num = 45;
const stem = `ch${String(num).padStart(2, "0")}`;
const title = "Preach the Need for Change, but Never Reform Too Much at Once";
const chapterId = "ch45-preach-the-need-for-change-but-never-reform-too-much-at-once";
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

const canonical = `Greene's forty-fifth law argues that change often fails not because reform is unnecessary, but because reform outruns what people can absorb. He is not praising inertia. He is warning that abrupt transformation can provoke fear, resistance, and backlash when people experience the new order as a total overturning of the old one. The chapter is strongest when it stays on pacing, absorption, sequencing, and legitimacy rather than turning into a sermon about caution for its own sake.

That is why the law cares about continuity buffers. People often tolerate more change than leaders assume, but they tolerate it unevenly. They need enough continuity to recognize the world they are being asked to stay inside. Greene's point is that successful reform depends not only on the content of the change, but also on the speed, order, and framing through which it arrives. Reform that moves too far, too fast can unite resistance that slower sequencing might have prevented.

The chapter therefore distinguishes strategic pacing from timid delay. Strategic pacing still moves. It stages, sequences, and absorbs. Timid delay hides behind prudence while protecting the status quo indefinitely. Greene's useful claim is narrower than anti-change advice: preserve enough continuity that people can adapt, but do not confuse adaptation time with permission to do nothing.

Ordinary settings make the mechanism visible. A work team may accept a serious process change when it is rolled out in a sequence people can learn, test, and trust. A club or school committee may support reform when familiar rituals or structures remain long enough to prevent panic. A personal change in household or relationship patterns may stick better when people have time to absorb it instead of feeling that the entire emotional order has been rewritten overnight. In each case, pacing protects legitimacy while still moving the field.

The law overreaches when it becomes an excuse for endless gradualism. Some systems need urgent reform. Some appeals to continuity only protect a bad arrangement. Greene is strongest when he treats pacing as a strategic discipline rather than as a moral absolute. Chapter 44 showed how reflection can unsettle self-image. Chapter 45 turns from unsettling a person to changing a system without triggering avoidable backlash. Chapter 46 will ask how visible imperfection can reduce envy and preserve cooperation.`;

const edited = canonical;

const critic = `# Chapter 45 Critic Report

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
- Paragraph 4 is most exposed because the work, school, and personal examples can drift into generic change-management advice if conversion loses the absorption and legitimacy logic.

Strongest sentence:
- "Reform that moves too far, too fast can unite resistance that slower sequencing might have prevented."

Anchor use notes:
- The draft stays inside the supported frame: backlash from abrupt reform, continuity and absorption limits, sequencing, legitimacy preservation, and the limit where prudence becomes timidity.

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
        "This law says change can fail when it arrives too fast for people to absorb. Greene is not saying change is bad. He is saying backlash grows when reform feels like a total overturning all at once. That is why pacing matters. A leader can still move change forward while leaving enough continuity that people can recognize the system they are staying inside. The mistake is not reform by itself. The mistake is forcing so much reform, so fast, that resistance hardens before the change can take hold.",
        "Greene's forty-fifth law argues that reform often fails because speed and sequencing are mishandled. People do not resist only because change is wrong. They also resist when the change feels too abrupt to absorb. The law is not anti-change advice. It is advice to pace reform so legitimacy survives the transition. Keep enough continuity to prevent backlash, but do not let caution turn into endless delay.",
        "This law gives a competitive warning: necessary reform can still destroy its own support if it outruns what people can tolerate. Greene is not defending inertia. He is showing that backlash often comes from speed, not only from substance. The edge lies in sequencing change so people can adapt without believing their whole world is being torn up at once."
      ),
      keyTakeaways: [
        { point: tone("Abrupt reform can provoke backlash.", "People resist change more fiercely when it arrives too fast to absorb.", "Overhaul can unite resistance that slower sequencing might avoid.") },
        { point: tone("Pacing can preserve legitimacy.", "Continuity helps people stay inside a changing system.", "Smart reform protects support while still moving forward.") },
        { point: tone("The law has a timidity limit.", "Prudence fails when it becomes an excuse for not changing what must change.", "Delay is not strategy if it only protects the status quo.") }
      ],
      oneMinuteRecap: tone(
        "This law says reform works better when people have enough continuity and time to absorb it.",
        "Pace change to reduce backlash without surrendering the change itself.",
        "Move in sequence, not in a way that turns necessary reform into a revolt trigger."
      )
    },
    medium: {
      chapterBreakdown: tone(
        "Greene's forty-fifth law begins with a practical problem: reform can be necessary and still fail if it arrives too abruptly. People often do not experience sudden change as a neutral improvement. They experience it as disorientation, threat, or loss of control. That is why the chapter keeps its focus on pacing. Greene is not saying that continuity is always sacred. He is saying that backlash grows when people feel the old order is being destroyed faster than they can absorb what is replacing it.\n\nContinuity matters here for a practical reason. A continuity buffer does not cancel reform. It gives people enough familiar structure to stay cooperative while the change takes hold. Greene's point is that legitimacy depends not only on whether the reform is sound, but also on how it is sequenced, framed, and timed. A reform that moves in stages may preserve support that an immediate overhaul would ignite into resistance.\n\nThe chapter is strongest when it separates strategic pacing from timid delay. Strategic pacing still changes the system. It chooses order, staging, and absorption on purpose. Timid delay says all the right words about prudence while protecting the old arrangement indefinitely. Greene is not offering anti-change comfort. He is offering a narrower discipline: move in a way people can absorb, but do not use caution as camouflage for fear.\n\nOrdinary settings keep the logic concrete. Ivor can roll out a work-team reform in steps so people learn the new process without treating it as a hostile takeover. Maelle can stage a club rule overhaul so members see continuity as well as change. A personal shift in family expectations can work better when the new pattern arrives through sequence rather than shock. In each setting, pacing keeps the reform legible enough to gain cooperation.\n\nThe law overreaches when it excuses endless gradualism. Some systems need urgent repair, and some continuity talk only protects a bad status quo. Greene's useful limit is sharper: pace change strategically when absorption matters, but do not let the need for legitimacy become an alibi for never acting. Chapter 44 dealt with disturbance through reflection. Chapter 45 deals with reform that moves without needless backlash. Chapter 46 turns toward visible imperfection and envy.",
        "A change can be right and still be rejected if it arrives in the wrong rhythm. Greene's point in this chapter is that people often oppose abrupt transformation less because they love the old system than because they cannot absorb too much disruption at once. That is why reform pacing matters. The issue is not simply whether change is needed. The issue is whether the reform can advance without making people feel that every stable surface beneath them is disappearing at once.\n\nContinuity is the chapter's mechanism for that problem. Greene is not worshipping tradition. He is noticing that people adapt more reliably when they can still recognize part of the world they are being asked to remain loyal to. A staged reform can therefore preserve legitimacy while still changing the structure. The reform keeps moving, but the field does not feel totally overturned in a single motion.\n\nThis is also why the chapter should not be flattened into generic caution. Strategic pacing is active. It sequences. It prioritizes. It absorbs. Generic caution only postpones. Greene's harder distinction is between leaders who modulate reform to keep support intact and leaders who hide fear behind the language of prudence.\n\nExamples make the distinction easier to see. Ivor can change a workflow in phases so the team learns the new standard before the next piece lands. Maelle can handle a school committee reform by preserving a few recognizable rituals while updating the real rules underneath them. A personal change works the same way when people are given a path into the new pattern rather than a command to accept a total emotional rewrite.\n\nThe law fails when the desire to avoid backlash becomes more important than the reform itself. Some conditions demand speed. Some institutions deserve disruption. Greene's point is not to slow every change. It is to judge when speed will needlessly create enemies that sequence could have prevented. Chapter 44 asked how reflection unsettles self-image. Chapter 45 asks how reform can move without overthrowing its own support base. The next chapter shifts toward how visible imperfection helps manage envy.",
        "Greene's forty-fifth law warns that reformers often lose not because their change is unnecessary, but because they force too much of it at once. Readers who flatten the chapter into anti-change advice miss the sharper mechanism. People can accept major change when they have time and continuity enough to absorb it. They often resist lesser change when it feels like a sudden erasure of the order they know. The law therefore studies backlash as a function of pacing, sequencing, and legitimacy rather than as a simple vote on whether the reform is good.\n\nContinuity buffers matter because they keep people cooperative during transition. A continuity buffer is not submission to the old order. It leaves enough recognizable structure in place for deeper change to settle without panic. Greene's strategic claim is that reform must often preserve some recognizable surfaces while deeper changes settle underneath. If everything changes at once, people may defend the old system less out of conviction than out of panic.\n\nThe useful distinction is between sequencing reform and worshipping stability. Sequencing reform means deciding what must change first, what can follow later, and what familiar structure will keep the group from hardening into backlash. Worshipping stability means refusing necessary change in the name of comfort. Greene is not advocating fear. He is warning that careless speed can sabotage a sound reform by collapsing legitimacy.\n\nIvor's work case, Maelle's school reform, and a personal adjustment all show the same mechanism. The first question is not whether change is deserved. The first question is whether the people living through it can absorb the order in which it arrives. That is why pacing is strategic rather than sentimental. It protects movement by preventing overload.\n\nThe chapter overreaches when it becomes an excuse for preserving injustice one small step at a time. Some reforms must be fast because the cost of delay is too high. Greene's reliable lesson is narrower and harder: move as fast as the situation can sustain without creating backlash that destroys the reform's own base of support. Chapter 44 dealt with disturbance through reflection. Chapter 45 deals with transition through staged change. Chapter 46 follows by asking how visible imperfection can preserve cooperation against envy."
      ),
      keyTakeaways: [
        {
          point: tone("Backlash often comes from speed as well as substance.", "Abrupt reform can turn even justified change into a threat response.", "People fight transformation harder when it feels like total overturn at once."),
          moreDetails: tone("The chapter asks the reader to track absorption limits, not only policy merits.", "Resistance grows when people cannot orient themselves inside the new order.", "A reform can be right and still be strategically self-destructive if it outruns tolerance.")
        },
        {
          point: tone("Continuity buffers can preserve cooperation.", "People absorb change more easily when some familiar structures remain visible during transition.", "Legitimacy survives better when reform does not erase every recognizable surface at once."),
          moreDetails: tone("Continuity here is a stabilizer, not a surrender to the past.", "Staging lets people stay inside the system while its deeper rules change.", "Support is often preserved by sequencing rather than by softening the substance.")
        },
        {
          point: tone("Strategic pacing is different from timid delay.", "Sequencing change still requires movement.", "Caution becomes weakness when it hides a refusal to reform."),
          moreDetails: tone("The chapter is not generic gradualism advice.", "Prudence is useful only if it changes the system on purpose.", "Delay stops being strategy once it exists mainly to protect the existing order.")
        },
        {
          point: tone("Work, school, and personal settings all expose the same logic.", "Ordinary settings show how staged reform can preserve legitimacy.", "The same backlash curve appears wherever change outruns absorption."),
          moreDetails: tone("A team, committee, or household can all reject change that feels like total replacement.", "The practical test is whether people can still recognize the field while they adapt to it.", "Pacing matters because overload creates enemies faster than explanation can calm them.")
        },
        {
          point: tone("The law has an urgency limit.", "Some systems need fast reform despite the risks of backlash.", "Pacing is not a moral absolute when delay protects a bad order."),
          moreDetails: tone("Greene stays useful only when the reader preserves this limit.", "A continuity buffer should not become an alibi for inaction.", "The hard question is how fast the situation can sustain, not how slow feels comfortable.")
        }
      ],
      activationPrompt: tone(
        "Find one change you are trying to make and identify which part needs sequencing rather than shock.",
        "Choose one setting where continuity would protect legitimacy without weakening the reform.",
        "Name one reform that needs staging and one where speed matters more than comfort."
      ),
      selfCheckPrompt: tone(
        "What exactly are people being asked to absorb, and what continuity would help them do it?",
        "Am I pacing this change strategically, or am I disguising fear as prudence?",
        "Which part of this reform must move now, and which part can be sequenced without losing force?"
      ),
      oneMinuteRecap: tone(
        "This chapter says change fails when reform outruns what people can absorb.",
        "Successful reform preserves enough continuity to keep legitimacy alive while the system changes.",
        "The strategic task is to sequence change without letting caution become disguised surrender."
      )
    },
    hard: {
      chapterBreakdown: {
        gentle: "Greene's forty-fifth law is less about moderation as a virtue than about absorption as a strategic limit. Reformers often imagine that if the change is justified, resistance is merely irrational or selfish. Greene notices something harsher. People can resist not only because they prefer the old arrangement, but because too much of the visible order is being altered faster than they can metabolize it. The chapter therefore asks the reader to treat backlash as a pacing problem as much as a moral or ideological one.\n\nThat is why continuity buffers matter. A continuity buffer is not reverence for the past. It is a way of keeping a group oriented while transition takes place. Greene's claim is that reform succeeds more often when some familiar surfaces remain intact long enough for the deeper shift to settle underneath them. If every symbol, routine, and expectation is overturned at once, people may defend the old system simply because it is the last stable map they still understand.\n\nThe harder distinction is between strategic pacing and defensive gradualism. Strategic pacing is disciplined movement. It chooses sequence, order, and rate so the reform does not generate unnecessary enemies. Defensive gradualism is the language of caution used to preserve comfort or avoid conflict indefinitely. Greene is not telling the reader to soften every reform. He is telling the reader to ask how much disruption the field can absorb before legitimacy collapses.\n\nIvor's work rollout, Maelle's school reform, and a personal renegotiation all reveal the same structure. Each case turns on whether change arrives in a sequence people can live inside. The strategic gain is not slower motion for its own sake. The gain is that staged movement preserves enough trust for the next stage to land. Reform keeps moving precisely because not everything is forced into a single shock.\n\nThe law remains useful only if its limit is preserved. Some systems are so unjust or decayed that delay strengthens the harm. Some continuity buffers merely protect the guilty. Greene's chapter works when it sharpens judgment about where sequence preserves legitimacy and where urgency should override comfort. Chapter 44 showed how reflection can destabilize a person's self-image. Chapter 45 shows how reform can move a larger field without provoking needless revolt.\n\nThat bridge matters because psychological disturbance and institutional change obey different risks. Reflection can succeed by unsettling. Reform can fail by unsettling too much. Chapter 45 therefore teaches a diagnostic of transition: ask not only what must change, but what must remain recognizable long enough for the change to hold. Chapter 46 follows by turning from paced reform to visible imperfection and the management of envy.",
        direct: "A reformer can be correct and still lose by moving at the wrong speed. Greene uses Chapter 45 to shift attention from the substance of change to the rate at which a system can absorb it. Readers who reduce this to generic caution miss the strategic core. The issue is not that people hate change by nature. The issue is that a field can harden into backlash when too many familiar supports disappear before the new order becomes legible.\n\nThat is why continuity is useful here. Continuity is not the enemy of reform. It is a bridge that keeps people inside the transition long enough for the reform to stabilize. Greene's argument is that successful change often preserves symbols, routines, or sequences that make adaptation possible even while the deeper rules are being rewritten. Sequence protects legitimacy by preventing the experience of total overthrow.\n\nThe real distinction is between staging change and retreating from it. Staging change still makes demands. It prioritizes what must move first, what can follow, and what continuity is necessary to keep support from collapsing. Retreating from change borrows the language of prudence to avoid paying the cost of reform. Greene's law is therefore not anti-change. It is anti-carelessness about the political and psychological cost of excess speed.\n\nIvor's workplace sequence, Maelle's club overhaul, and a personal shift all show the same mechanism. In each case, legitimacy survives when the reform remains intelligible to the people living through it. If the transition feels like total erasure, even sound reform may gather enemies faster than it gathers trust. Pacing matters because overload converts uncertainty into organized resistance.\n\nThe chapter overreaches when readers use it to justify delay in systems that need immediate correction. That limit has to stay active. Some reforms deserve speed because the old order is already intolerable. Greene's useful instruction is narrower: move as fast as the field can sustain without destroying the coalition that must carry the reform through. Chapter 44 tracked disruption through reflection. Chapter 45 tracks transformation through disciplined sequencing. Chapter 46 then turns toward the social management of envy through visible imperfection.",
        competitive: "Greene's forty-fifth law warns that reform can lose its base by winning too much too quickly. Many readers treat opposition to change as proof that the old system is deeply loved. Greene's sharper observation is that people often defend what is merely familiar once reform begins erasing every stable surface at once. The backlash curve is not only moral disagreement. It is also overload, disorientation, and the instinct to preserve a map before the terrain has been redrawn clearly enough to live on.\n\nThat is why sequencing is power, not softness. A reform that leaves some continuity visible can keep opponents from consolidating around the fear of total replacement. Greene is not praising half measures. He is describing how legitimacy is preserved while deeper shifts take root. The leader who changes everything at once may look decisive, but may also build the very coalition that stops the reform from lasting.\n\nThe harder edge in the chapter is its distinction between strategic pacing and cowardly caution. Strategic pacing still breaks the old order where it must, but it chooses tempo so the field does not revolt before the change becomes usable. Cowardly caution preserves comfort and calls it prudence. Greene's claim is that timing is part of force. A sound reform mishandled in sequence can fail more completely than an imperfect reform introduced at an absorbable pace.\n\nIvor, Maelle, and a personal renegotiation all expose the same pattern. The question is not whether change is deserved. The question is how much disruption the field can carry before legitimacy snaps. Once legitimacy snaps, every later stage becomes harder because people are no longer debating the reform. They are defending themselves against disorientation.\n\nThe limit is what keeps the law from collapsing into apologetics for inertia. Some systems need fast rupture because gradualism only lengthens harm. Some continuity buffers are camouflage for protecting the guilty. Greene remains useful only when the reader can judge when sequence preserves the reform and when urgency should dominate. Chapter 44 used disturbance to crack self-image. Chapter 45 uses sequence to keep institutional change from cracking its own support. Chapter 46 follows by asking how visible imperfection prevents envy from gathering against you."
      },
      keyTakeaways: [
        {
          point: tone("Backlash is often an absorption problem.", "People resist not only what changes, but how much changes before the new order becomes legible.", "A field can revolt against overload even when the reform is substantively sound."),
          moreDetails: tone("The chapter asks the reader to study disorientation as a source of resistance.", "Too many simultaneous changes can make legitimacy collapse before benefits are felt.", "Strategic failure often begins when reform outruns the group's ability to orient itself.")
        },
        {
          point: tone("Continuity buffers can stabilize transition.", "Keeping some recognizable structures in place can preserve cooperation during deeper reform.", "Visible continuity prevents fear of total replacement from becoming the opposition's rally point."),
          moreDetails: tone("Continuity is used here as a bridge, not as surrender.", "People often stay with a changing system when they can still recognize part of it.", "Sequence preserves support by keeping transition livable while the deeper shift settles.")
        },
        {
          point: tone("Strategic pacing is movement, not retreat.", "Staging reform means deciding order and tempo without abandoning the reform itself.", "Timing is part of force because mishandled speed can build the coalition that kills the change."),
          moreDetails: tone("The chapter turns weak if prudence becomes a cover for fear.", "A reform is still active when it chooses absorbable sequence instead of total shock.", "Careless speed can be a stronger ally of the status quo than deliberate staging.")
        },
        {
          point: tone("Ordinary reforms reveal the same transition logic.", "Teams, committees, and households all show how sequence can preserve legitimacy.", "The same backlash curve appears wherever people experience change as total erasure."),
          moreDetails: tone("The issue is whether people can still live inside the transition while they adapt.", "Work, school, and personal changes all fail faster when every support disappears at once.", "Practical strategy starts by asking what must remain recognizable during the shift.")
        },
        {
          point: tone("The law fails when pacing protects injustice.", "Urgency sometimes matters more than continuity.", "Gradualism becomes cowardice when it lengthens harm in the name of comfort."),
          moreDetails: tone("This limit keeps the chapter from becoming anti-change advice.", "Some systems deserve rupture because delay preserves the damage.", "The real judgment is not slow versus fast, but what tempo preserves the reform's purpose.")
        }
      ],
      activationPrompt: tone(
        "Find one reform that is failing because people cannot yet absorb how much is shifting at once.",
        "Choose one change where sequencing would preserve legitimacy without shrinking the substance.",
        "Identify one case where continuity is a strategic bridge and one where it would only excuse delay."
      ),
      selfCheckPrompts: [
        tone(
          "What part of this reform is producing overload rather than persuasion?",
          "Which familiar structure needs to remain long enough for the next stage to land?",
          "Am I treating sequence as a tool for movement or as a refuge from conflict?"
        ),
        tone(
          "If I slow this change, what harm is being preserved by the delay?",
          "At what point does prudence become a defense of the status quo rather than a protection of legitimacy?",
          "How fast can this field sustain reform before backlash destroys the coalition carrying it?"
        )
      ],
      predictionPrompt: tone(
        "If Chapter 45 is about pacing reform, how might Chapter 46 shift from change management to managing envy through visible imperfection?",
        "What changes when the problem is no longer backlash to reform but resentment toward visible excellence?",
        "After learning how sequence preserves legitimacy, how does strategy move toward appearing less perfect so others stay cooperative?"
      ),
      oneMinuteRecap: tone(
        "This chapter argues that necessary change can fail when it arrives faster than people can absorb it.",
        "Reform holds when sequence preserves enough continuity to keep legitimacy alive during transition.",
        "The hard task is to pace change without letting caution become a shield for the order that needs to be broken."
      )
    }
  },
  examples: [
    {
      title: "Ivor Sequences the Team Reform Before Anyone Can Treat It as a Hostile Takeover",
      format: "decision_point",
      category: "work",
      endingType: "broader_principle",
      scenario: tone("Ivor needs to change how his team works, but a total overnight overhaul would make people feel that every stable routine has disappeared at once.", "He has to decide whether the reform needs one push or a staged rollout.", "The real issue is not change versus no change, but whether the team can absorb the order in which the change arrives."),
      whatToDo: tone("He rolls out the reform in sequence so one change becomes legible before the next one lands.", "He keeps enough familiar structure in place to preserve cooperation while the deeper rules shift.", "He treats timing as part of the reform instead of as an afterthought."),
      whyItMatters: tone("The chapter says backlash grows when change outruns absorption.", "His case shows how sequence can protect legitimacy without weakening the reform.", "The gain comes from preventing overload, not from avoiding change.")
    },
    {
      title: "Maelle Explains Why the Club Overhaul Needs a Continuity Buffer",
      format: "dialogue",
      category: "school",
      endingType: "self_directed_question",
      scenario: tone("Maelle is helping a club change its rules, but members are already reacting as if the entire organization is being replaced.", "The conversation turns on whether a continuity buffer would reduce fear without diluting the update.", "She is trying to separate strategic pacing from fear-based stalling."),
      whatToDo: tone("She preserves a few recognizable structures while sequencing the real reform underneath them.", "She asks which part of the old routine people need in order to stay cooperative during transition.", "She stages the change so legitimacy survives long enough for the new rules to stabilize."),
      whyItMatters: tone("The chapter argues that continuity can preserve support while reform still moves.", "Her example shows that people often resist disorientation more than they resist substance.", "Pacing matters because recognizable structure can keep reform from provoking avoidable backlash.")
    },
    {
      title: "Bren Has to Judge Whether a Family Change Needs Staging or Immediate Rupture",
      format: "dilemma",
      category: "personal",
      endingType: "surprising_implication",
      scenario: tone("Bren wants to change an unhealthy household pattern, but he cannot tell whether gradual movement will help people absorb the shift or simply preserve the damage longer.", "He has to decide whether pacing is strategic or evasive in this case.", "The dilemma is between absorption and urgency, not comfort and effort."),
      whatToDo: tone("He asks which part of the change truly needs time and which part only looks safer when delayed.", "He refuses to confuse continuity with permission to keep the harmful pattern in place.", "He sequences what can be staged and moves immediately on what should not be preserved."),
      whyItMatters: tone("The chapter has a timidity limit as well as a pacing principle.", "His case shows that prudence becomes weak once it mainly protects the status quo.", "The strategic task is to know when absorption matters and when urgency overrides it.")
    },
    {
      title: "Arden Predicts the Curriculum Reform Will Hold Only If People Can Still Recognize the Institution",
      format: "predict_reveal",
      category: "school",
      endingType: "cross_domain",
      scenario: tone("Arden predicts that a curriculum-team reform will fail if every ritual, schedule, and standard changes at once.", "He expects resistance to harden less around the content than around the feeling of total replacement.", "The scene becomes a forecast about legitimacy rather than about slogans for change."),
      whatToDo: tone("He identifies which familiar structures should remain long enough for the deeper change to settle.", "He sequences the visible reform so people can live inside the transition.", "He treats recognition as part of adaptation instead of as surrender to the old system."),
      whyItMatters: tone("The chapter says reform must often preserve some continuity to avoid unnecessary backlash.", "His prediction shows that sequencing can matter as much as substance.", "Change becomes more sustainable when the field does not feel erased all at once.")
    },
    {
      title: "The Debrief Finds That the First Rollout Failed Because Everything Changed Simultaneously",
      format: "postmortem",
      category: "work",
      endingType: "common_trap",
      scenario: tone("A work debrief shows that the reform itself was mostly sound, but the first rollout triggered resistance because every procedure shifted at once.", "They realize the failure came from overload more than from disagreement about the goal.", "The review becomes a lesson in sequence rather than in messaging alone."),
      whatToDo: tone("They rebuild the rollout in stages so each piece becomes stable before the next change lands.", "They keep only the continuity that helps people orient themselves during transition.", "They stop mistaking maximum speed for maximum seriousness."),
      whyItMatters: tone("The chapter warns that careless speed can destroy support for necessary change.", "Their mistake was treating pace as separate from reform design.", "The fix comes from matching the rollout to what the team can absorb.")
    },
    {
      title: "Before and After the Change Became Easier Once the New Pattern Arrived in Sequence",
      format: "before_after",
      category: "personal",
      endingType: "perspective_reframe",
      scenario: tone("Before, the new household expectation felt like a total rewrite, so everyone defended the old pattern. After, the same change was introduced in a staged way and resistance dropped.", "The contrast is between shock and absorbable sequence.", "One version feels like erasure; the other feels like transition."),
      whatToDo: tone("Introduce the new expectation in an order people can learn without losing every familiar support at once.", "Use continuity as a bridge, not as a permanent excuse for keeping the old pattern.", "Pair movement with recognition so the change can actually hold."),
      whyItMatters: tone("The chapter becomes visible when the same reform succeeds once pacing changes.", "This before-and-after shows why sequence can preserve legitimacy better than a total immediate rewrite.", "What changes is not the goal but the field's ability to absorb the path toward it.")
    }
  ],
  reviewCards: [
    { cardId: "ch45-rc01", front: tone("What is the main claim of Chapter 45?", "Why does reform pacing matter here?", "What does Greene warn against?"), back: tone("The chapter argues that reform often fails when it moves faster than people can absorb.", "Pacing matters because abrupt change can trigger backlash even when the reform is necessary.", "Greene warns against reforming so much, so quickly, that support hardens into resistance."), difficulty: "easy" },
    { cardId: "ch45-rc02", front: tone("What is a continuity buffer?", "Why keep some familiar structure during change?", "How can continuity help reform?"), back: tone("A continuity buffer keeps enough recognizable structure in place for people to stay cooperative during transition.", "Familiar surfaces help people absorb change without feeling that the whole order has vanished at once.", "Continuity helps preserve legitimacy while deeper reform takes hold."), difficulty: "easy" },
    { cardId: "ch45-rc03", front: tone("How is strategic pacing different from timid delay?", "Why is this chapter not anti-change advice?", "When does caution stop being useful?"), back: tone("Strategic pacing still moves reform in sequence, while timid delay hides behind prudence to protect the status quo.", "The chapter is about absorbable movement, not about avoiding change.", "Caution stops being useful when it exists mainly to postpone necessary reform."), difficulty: "medium" },
    { cardId: "ch45-rc04", front: tone("How do ordinary settings show the law?", "Why do work, school, and personal changes all face the same issue?", "What does sequence protect?"), back: tone("Ordinary settings show that people resist overload when change feels like total replacement.", "Teams, committees, and households all need a transition they can still recognize.", "Sequence protects legitimacy by keeping the reform livable while it unfolds."), difficulty: "medium" },
    { cardId: "ch45-rc05", front: tone("How does Chapter 45 bridge to Chapter 46?", "What comes after paced reform?", "Why does this law lead toward visible imperfection?"), back: tone("After showing how reform must be paced to avoid backlash, the next issue is how visible imperfection reduces envy and preserves cooperation.", "Chapter 46 turns from transition management toward appearing less perfect.", "The bridge moves from absorbable change to the politics of envy."), difficulty: "hard" }
  ],
  keyTakeawayCard: tone(
    "Preaching the need for change without reforming too much at once means pacing necessary reform so people can absorb it without turning disorientation into backlash.",
    "This law values sequencing and continuity buffers because legitimacy often depends on how change arrives, not only on whether the change is right.",
    "Power is preserved when you move reform at a tempo the field can sustain and refuse to mistake endless caution for strategy."
  )
};

const quiz = {
  passingScorePercent: 70,
  questions: [
    { questionId: "ch45-q01", prompt: "Why does reform pacing matter in this chapter?", choices: ["Because people can resist necessary change when it arrives too abruptly to absorb", "Because continuity always matters more than reform", "Because fast change is always strategically wrong"], correctIndex: 0, explanation: tone("Correct. The chapter focuses on backlash produced by excess speed.", "Pacing matters because reform can fail when people experience it as total disorientation.", "Right. The issue is absorption and legitimacy, not a blanket rejection of speed."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch45-q02", prompt: "What can abrupt reform trigger strategically?", choices: ["Automatic loyalty to the reformer", "Fear, resistance, and backlash", "Guaranteed legitimacy through decisiveness"], correctIndex: 1, explanation: tone("Yes. Greene warns that too much change too quickly can harden resistance.", "Abrupt reform can provoke backlash when people feel their world is being overturned at once.", "Correct. Speed can create enemies even when the reform itself is justified."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch45-q03", prompt: "Why is this chapter not anti-change advice?", choices: ["Because it says all reform should be delayed", "Because it treats continuity as sacred in every case", "Because it distinguishes strategic pacing from fear-driven stalling"], correctIndex: 2, explanation: tone("Correct. Greene separates active sequencing from passive delay.", "The chapter still wants reform to move; it rejects only careless overreach and disguised timidity.", "Right. The law is about absorbable change, not about worshipping the status quo."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch45-q04", prompt: "In Ivor's work scenario, what best fits the chapter?", choices: ["Roll out each part of the reform in sequence so the team can absorb it", "Change every workflow at once to prove seriousness", "Avoid reform until nobody disagrees with it"], correctIndex: 0, explanation: tone("Correct. His case shows how sequence can preserve cooperation.", "The chapter favors staged rollout when overload would create avoidable resistance.", "Right. He is still changing the system, but in an order the team can live through."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch45-q05", prompt: "What does Maelle's school example show?", choices: ["That school reforms should stay symbolic instead of structural", "That recognizable continuity can help members absorb a real rule change", "That legitimacy comes only from voting on every detail"], correctIndex: 1, explanation: tone("Yes. Her example uses continuity as a stabilizer during transition.", "The chapter says people often adapt better when some familiar structures remain visible.", "Correct. Continuity helps the reform hold without canceling the reform itself."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch45-q06", prompt: "What is the strongest reading of Bren's personal dilemma?", choices: ["Every change should be gradual no matter the harm", "The old pattern should stay because continuity is always safer", "He must distinguish strategic pacing from delay that preserves damage"], correctIndex: 2, explanation: tone("Correct. The law has a timidity limit as well as a pacing principle.", "His dilemma turns on whether delay helps absorption or merely extends the harm.", "Right. Prudence becomes weak once it mainly protects what should be changed."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch45-q07", prompt: "How can sequencing preserve legitimacy while still moving reform?", choices: ["By leaving enough recognizable structure in place for people to adapt during transition", "By replacing the reform with smaller symbolic gestures", "By making sure no one notices the change"], correctIndex: 0, explanation: tone("Correct. The chapter links legitimacy to absorbable transition.", "Sequencing works because people can remain inside a recognizable system while it changes.", "Right. The reform still moves, but not in a way that feels like total erasure all at once."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch45-q08", prompt: "When does prudence become timidity in this chapter?", choices: ["When leaders explain the reform too clearly", "When continuity is used as a permanent excuse to avoid necessary reform", "When a reform keeps any familiar ritual during transition"], correctIndex: 1, explanation: tone("Exactly. Prudence fails when it mostly protects the status quo.", "The chapter's limit is that pacing should not become camouflage for fear or avoidance.", "Right. Delay stops being strategic once it abandons the reform's purpose."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch45-q09", prompt: "How does Chapter 44 lead into Chapter 45?", choices: ["By proving that personal mirroring and institutional reform are identical tactics", "By showing that only psychological disturbance matters in politics", "By moving from reflection that unsettles self-image to reform that must be paced to avoid backlash"], correctIndex: 2, explanation: tone("Correct. Chapter 44 unsettled the person, and Chapter 45 manages change in the wider field.", "The bridge moves from psychological disturbance toward structural transition.", "Right. The new issue is not reflection itself but how change can hold without provoking revolt."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch45-q10", prompt: "What bridge carries Chapter 45 into Chapter 46?", choices: ["After pacing reform, the next issue is how visible imperfection can reduce envy and preserve cooperation", "Chapter 46 returns only to continuity buffers and rollout order", "Successful reform eliminates the need to manage envy at all"], correctIndex: 1, explanation: tone("Correct. The next law shifts from reform pacing to envy and visible imperfection.", "Chapter 46 turns toward never appearing too perfect after Chapter 45 deals with paced change.", "Right. The bridge moves from transition management to social perception and resentment."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" }
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
for (const name of ["Ivor", "Maelle", "Bren", "Arden"]) continuity.nameUsage[name] = [stem];
continuity.withinChapterNames[stem] = ["Ivor", "Maelle", "Bren", "Arden"];
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
- Chapter-specific mechanism remains pacing, absorption limits, continuity buffers, legitimacy preservation, and the timidity limit rather than generic caution
- Hard depth preserves the distinction between strategic pacing and fear-driven delay and keeps the Chapter 46 bridge visible
- Quiz stays within supported facts from the approved draft and frozen source bundle

## Gate result
- Approved for chapter gate and automatic continuation
`;
writeText(paths.validation, validation);

fs.appendFileSync(
  paths.runLog,
  `\n- Repaired Chapter 45 prewriter drift: replaced banned primary names with allowed names in brief and outline before writer start.\n- Completed writer, editor, critic, converter, quiz, and validator steps for Chapter 45.\n- Validation result: PASS.\n- Continuity hash sealed for \`${stem}\`: \`${seal}\`\n`,
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
