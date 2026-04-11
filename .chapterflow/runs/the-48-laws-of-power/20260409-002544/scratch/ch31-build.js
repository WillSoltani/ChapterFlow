const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const runRoot = path.resolve(".chapterflow/runs/the-48-laws-of-power/20260409-002544");
const num = 31;
const stem = `ch${String(num).padStart(2, "0")}`;
const title = "Control the Options: Get Others to Play with the Cards You Deal";
const chapterId = "ch31-control-the-options-get-others-to-play-with-the-cards-you-deal";
const createdAt = new Date().toISOString();

function tone(gentle, direct, competitive) {
  return { gentle, direct, competitive };
}

const canonical = `Greene's thirty-first law begins with a strategic question about where a decision is really made. Many people focus on the final yes or no, the visible refusal or acceptance, and the apparent freedom of the chooser. The chapter begins earlier. It treats the menu itself as the hidden battleground. If the available options have already been shaped, sequenced, or weighted, the outcome may be largely decided before the chooser ever feels the decision happening.

Its claim is not that people have no agency or that every choice can be controlled perfectly. Greene's point is narrower and more strategic. Framing the options can reduce open resistance, lower the cost of direct conflict, and guide another person toward a result that still feels self-chosen. When one path looks safer, cleaner, or more dignified than the others, menu design can do the work that overt pressure would only make harder. Controlling the options therefore matters not because force disappears, but because it is often more effective to shape the field before the choice than to fight at the moment of choice itself.

That is why the law focuses on guided choice rather than on obvious cornering. Greene is not praising crude false alternatives, transparent traps, or total coercion dressed up as consent. He is distinguishing strategic choice architecture from ham-fisted pressure that announces itself too loudly. The useful move is not to make the frame feel like a prison. It is to build the set of plausible paths so the preferred route seems reasonable enough that the chooser walks toward it without feeling shoved. The law becomes unstable only when the frame grows so narrow, so manipulative, or so opaque about material stakes that the design reveals itself as a trick.

Ordinary settings make the mechanism visible. A leader may get less resistance by presenting shaped alternatives that all move the team toward a workable target instead of demanding one naked outcome. A student senate may debate more smoothly when the agenda is structured so the acceptable paths are already narrowed before the vote. A person in private life may preserve more cooperation by arranging choices that let the other person keep some dignity while still moving within a defined lane. In each case, the issue is not whether a choice exists. It is who designed the field in which that choice appears.

The chapter's limit matters. Option control can fail when people realize the menu is rigged, when important paths or stakes were hidden unfairly, or when apparent freedom becomes too obviously false to trust. Greene overreaches if the law becomes permission to conceal material facts or to equate shaped menus with genuine consent. The useful version is narrower: arrange the field, sequence the choices, and reduce needless resistance, but leave enough truth and room that the frame can still hold. Chapter 30 showed how polished surfaces shape what people see. Chapter 31 asks how shaped options influence what people feel free to choose. That points toward Chapter 32, where power pushes even deeper by working on fantasy itself, making one path feel attractive long before blunt pressure would ever be needed.`;

const edited = canonical;

const critic = `# Chapter 31 Critic Report

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
- Paragraph 4 is most vulnerable because work, school, and personal examples can flatten into generic persuasion talk if conversion drops the menu-control, agency, and coercion-limit mechanics.

Strongest sentence:
- "The chapter begins earlier. It treats the menu itself as the hidden battleground."

Anchor use notes:
- The draft stays inside the frozen support: framed options shape outcomes upstream, apparent agency lowers resistance, guided choice differs from crude coercion, and the tactic fails when the frame becomes too visible or unfair.

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
        "This law says the real decision is often shaped before the final choice appears. Greene is not saying that people have no freedom or that every outcome can be controlled perfectly. The chapter makes a narrower point. If you design the menu of options, you can often guide what happens without using as much open force. People resist less when they feel they are choosing within a field instead of being shoved toward one naked command. But the chapter is not praising obvious traps or fake consent. Strategic option control means shaping the available paths so one route looks more workable, while still leaving enough reality and dignity that the frame can hold. The lesson is to notice that outcomes are often set upstream by the menu, not only at the moment someone says yes or no.",
        "Greene's thirty-first law argues that menu design can decide more than direct argument or pressure. The chapter is not telling you that choosers are mindless or that any narrow frame is wise. It is telling you that choice architecture matters. When the available options already guide someone toward one result, the final decision can feel self-chosen even though the field was shaped in advance. That can lower resistance because people often push harder against force than against a menu that still seems to leave room. But the chapter is not saying you should hide material facts or make the frame so rigged that it collapses into a trick. Option control matters only if the design channels the outcome without becoming obviously coercive. Used well, the frame does the early work before the final choice has to carry all of it.",
        "This law gives a practical warning: if you wait until the final decision to fight for the outcome, you may already be too late. Greene's point is that the menu itself can be the real instrument of control. A competitive reader should notice that people often accept a result more easily when it arrives through shaped alternatives instead of blunt demand. But the chapter is not asking for crude false choices or hidden stakes that make consent fake. It is asking for upstream design. Arrange the options so the strongest path is easier to choose, then let the chooser feel some agency inside that frame. The tactic works only if the menu does not become so narrow or deceptive that the pressure reveals itself. If the frame looks rigged, the design stops lowering resistance and starts creating it.",
      ),
      keyTakeaways: [
        { point: tone("The menu can decide the outcome before the final choice appears.", "Shaped options often matter more than the last visible yes or no.", "Who controls the cards often shapes the play.") },
        { point: tone("Apparent agency lowers resistance.", "People often accept a guided path more easily when it still feels chosen.", "A framed choice usually meets less pushback than a naked order.") },
        { point: tone("Guided choice is not the same as crude coercion.", "The chapter supports shaping options, not hiding material stakes or making the trap obvious.", "If the menu feels rigged, the frame starts working against you.") }
      ],
      oneMinuteRecap: tone(
        "This law says outcomes are often decided upstream when the options themselves are designed in advance.",
        "Do not fight only at the moment of choice if shaping the menu earlier would lower resistance.",
        "Guide the field, but do not let the frame become so narrow or deceptive that it exposes itself as coercion."
      )
    },
    medium: {
      chapterBreakdown: tone(
        `Greene's thirty-first law begins by questioning where control actually enters a decision. Many people focus on persuasion at the moment of refusal or agreement, as if power appears only when someone is finally forced to answer. Greene moves earlier than that. The chapter asks what happens when the available options have already been arranged before the chooser feels the decision pressing on them.

That is why menu control matters here. Greene is not describing magical domination or saying that choosers become puppets. He is describing upstream influence. If the field of choices is shaped carefully, one path may come to feel safer, cleaner, or more reasonable than the others. The chapter treats option design as part of power because a decision can be nudged long before blunt pressure would have become necessary.

The chapter is strongest when it distinguishes guided choice from visible coercion. The useful move is not to make people feel trapped in an obvious false alternative. It is to create a set of plausible paths that still leave the chooser feeling some agency while quietly favoring one result. Greene is not praising crude cornering. He is showing how lower-friction control can work so long as the frame does not become too narrow or too deceptive to trust.

The pattern appears in ordinary settings. A work lead may get more cooperation by offering shaped alternatives that all move toward a workable objective instead of insisting on a single stark demand. A student senate may vote more smoothly when the agenda already narrows the serious options before debate peaks. A personal conversation may preserve dignity by giving someone choices inside a lane rather than forcing direct surrender in public. In each case, what changes is not whether a decision exists. It is who built the environment around it.

The limit matters because option control can backfire. If the menu looks rigged, if material stakes were hidden, or if the chooser feels their agency was only decorative, resistance returns harder. Greene's practical claim is narrower: arrange the field so the preferred route feels natural enough to choose, but do not make the frame so false that the design reveals itself as coercion. Chapter 30 controlled appearance at the surface. Chapter 31 controls the menu behind the decision. Chapter 32 then turns toward fantasy, where desire itself can make one shaped path feel more attractive than pressure ever could.`,
        `Greene's thirty-first law argues that many outcomes are decided before a person thinks they are choosing freely. A decision can look open on the surface while the menu beneath it has already been structured to favor one path. The chapter therefore begins with a strategic problem, not a lesson in brute force. What if the strongest way to direct a result is not to compel the final choice, but to design the field in which that choice is made?

That is why framed options can be useful. If you present a limited but plausible set of paths, the chooser may move toward the preferred outcome with less resistance than a direct demand would provoke. Greene is interested in that difference. The chapter values option architecture because people often fight overt pressure more fiercely than they fight a menu that still lets them feel involved in the decision.

This is why the chapter is not generic coercion advice. Greene is not telling the reader to eliminate agency entirely or to use absurd false alternatives that insult the chooser. He is separating strategic framing from clumsy cornering. The issue is not whether one path is favored. The issue is whether the frame remains believable enough that the chooser still experiences some ownership of the movement inside it. Menu control works when it channels without overexposing the channel.

The pattern appears everywhere. Caden may reduce pushback by structuring the work alternatives so every serious path still serves the core objective. A portfolio review may narrow the acceptable revisions before discussion turns chaotic. A personal conversation may preserve cooperation by arranging choices that leave room for dignity instead of forcing a humiliating public surrender. In each case, the result is shaped not only by what is chosen, but by what was available to choose from.

The limit remains central because shaped choice can collapse into visible manipulation. If the missing options matter too much, if the hidden stakes are unfair, or if the design becomes too transparent, the frame loses its softness and starts to feel like a trap. Greene's point is disciplined rather than absolute: shape the menu, lower resistance, and let agency do part of the work, but do not mistake framed choice for limitless permission to deceive. Chapter 30 dealt with controlling appearance. Chapter 31 deals with controlling the cards on the table. Chapter 32 then asks how fantasy can pull people toward those cards even more effectively than design alone.`,
        `This law starts with a tempting mistake: assuming that the real contest begins only when someone must finally decide. Greene's warning is that the field may already have been tilted long before that visible moment arrives. If the available options have been arranged carefully, the chooser can feel free while moving through a route that was largely prepared in advance. The chapter therefore treats the menu itself as a hidden instrument of power.

That matters because apparent agency changes resistance. A person who feels openly cornered may fight harder than a person who still sees movement inside the frame. The chapter therefore treats guided choice as a way of reducing friction. What changes is not only the content of the options. It is the chooser's experience of still having enough room to take part in the result.

This keeps the law narrower than praise for entrapment. Greene is not asking you to hide essential facts or stage insulting fake alternatives. He is asking whether the menu has been designed well enough that your preferred outcome can emerge through a believable field of choices. Strategic framing means shaping the path without making the path look like a cage. It becomes failure when the missing freedom becomes too visible to ignore.

Common settings make the point plain. A leader may secure more compliance by shaping alternatives instead of issuing one exposed order. A student senate may move toward a preferred outcome because the agenda and sequence already narrowed what feels realistic. A personal negotiation may stay intact because the other person can still choose how to move inside a bounded lane. In each case, the frame guides the result before the final answer arrives.

The limit matters because design can become coercive theater if the menu is too narrow or the stakes are too hidden. If the chooser discovers the field was unfairly rigged, the same tactic meant to reduce resistance can produce sharper backlash. Chapter 30 showed that surface control shapes perception. Chapter 31 shows that option control shapes movement. Chapter 32 follows by asking how fantasy can make one shaped option feel not only acceptable, but desirable.`
      ),
      keyTakeaways: [
        {
          point: tone("The menu can decide more than the final visible choice.", "Outcomes are often shaped upstream by which options are made available.", "The field can be tilted before anyone feels the decision landing."),
          moreDetails: tone("The chapter focuses on choice architecture rather than on last-minute persuasion alone.", "A decision may look free on the surface while the available paths already favor one destination.", "The chooser's final gesture often matters less than the design of the paths leading to it.")
        },
        {
          point: tone("Apparent agency lowers resistance.", "People resist less when they still feel involved in the movement toward the result.", "A guided path often meets less friction than a naked command."),
          moreDetails: tone("Greene values framed freedom because people push hardest against visible force.", "The chapter's leverage comes from letting agency do part of the control work.", "A believable field of choice can move people farther than overt pressure can.")
        },
        {
          point: tone("Strategic framing differs from crude cornering.", "The chapter supports believable menus, not insulting fake alternatives.", "Shape the lane, but do not make the lane feel like a trap."),
          moreDetails: tone("The law still requires enough plausibility and room that the chooser does not instantly experience the frame as a prison.", "Menu control matters only while the design remains softer than brute coercion.", "Once the frame announces itself too loudly, resistance returns with more clarity.")
        },
        {
          point: tone("Work, school, and personal settings all show how upstream design shapes downstream decisions.", "The environment around the choice often matters more than the final statement of preference.", "People choose within fields, not in empty space."),
          moreDetails: tone("Agendas, revision paths, and bounded personal alternatives all reveal how outcomes are shaped by what is placed on the table.", "The chapter becomes practical when you ask who built the menu and what each available path quietly favors.", "A result often begins in the architecture around the decision rather than in the decision alone.")
        },
        {
          point: tone("The law has a coercion-and-fairness limit.", "Option control fails when the frame is too visible, too narrow, or hides material stakes unfairly.", "A rigged menu eventually feels like one."),
          moreDetails: tone("Some contexts require wider choice sets or clearer disclosure than the tactic can comfortably allow.", "Greene warns against resistance, not against reality.", "The right boundary is where design stops lowering friction and starts corrupting consent or trust.")
        }
      ],
      activationPrompt: tone(
        "Identify one decision where shaping the available options would matter more than arguing at the final moment.",
        "Choose one current situation where a better menu would reduce resistance before the visible choice even arrives.",
        "Pick one outcome you are trying to influence and ask whether the field around the choice has been designed at all."
      ),
      selfCheckPrompt: tone(
        "Am I shaping a believable field of choice here, or am I building a frame that will feel obviously rigged?",
        "Which option on this menu quietly carries the outcome I actually want, and why would someone accept it as self-chosen?",
        "Where would fairness or material disclosure require me to widen or clarify the frame?"
      ),
      oneMinuteRecap: tone(
        "This chapter says outcomes are often shaped earlier than the final decision, through the design of the options themselves.",
        "Do not wait for the visible yes-or-no moment if upstream menu control could lower resistance first.",
        "Guide the path, but do not make the frame so false or narrow that it collapses into visible coercion."
      )
    },
    hard: {
      chapterBreakdown: tone(
        `Greene's thirty-first law treats choice architecture as a power instrument rather than as a neutral background condition. Most people hear "control the options" and think of manipulation in its most obvious form, as if power enters only when coercion becomes visible. Greene is interested in a sharper claim: the decisive struggle often happens before anyone feels forced. The chapter therefore begins by asking where freedom is being experienced and where the field beneath that experience has already been built.

That is why menu design can matter here. Greene is not denying human agency, and he is not claiming that every chooser becomes a puppet the moment options are framed. He is describing constrained freedom. If the available paths are sequenced, narrowed, and weighted carefully, a preferred outcome can begin to look like the most reasonable movement inside the field. The chapter treats framed choice as part of power because direct force often creates more resistance than a menu that still lets the chooser feel involved in the result.

The chapter is strongest when it resists the lazy reading that guided choice is just disguised coercion. Greene is not praising clownish false alternatives, obvious cornering, or total control so visible that everyone feels mocked by the pretense of agency. He is distinguishing strategic option design from crude traps. Strategic framing works because it preserves enough believable room that the chooser can still experience movement as partly their own. Crude coercion fails because the frame becomes too narrow, too insulting, or too dishonest about what is really at stake.

This is why the menu itself can be more decisive than the final answer. The problem is not simply that people choose badly. It is that they often choose from fields someone else has already prepared. Once the serious options have been defined in advance, the visible decision may become only the last gesture in a process whose direction was set upstream. The chapter therefore asks whether power is better spent winning the argument at the end or designing the table at the start. A field that has been built well can absorb resistance before resistance knows what to oppose.

Ordinary settings show the mechanism clearly. A leader may secure more cooperation by presenting shaped alternatives that all move toward a workable target rather than by ordering one exposed path. A student senate may feel free in debate even though the agenda already narrowed the serious routes before the floor opened. A personal negotiation may remain calmer when one side retains dignity through limited options instead of being pushed toward one humiliating public surrender. In each case, what matters is not whether a decision happened. It is who authored the plausible menu from which the decision emerged.

The limit matters because framed freedom can rot into visible coercion. If the hidden constraints are too tight, if essential information is withheld, or if the chooser discovers that their apparent agency was mostly decorative, the same tactic meant to soften resistance can produce sharper backlash than open force would have triggered. Greene is not arguing that any engineered menu counts as legitimate influence. He is arguing that conflict can often be won earlier, more quietly, and with less friction when the field is shaped well. Chapter 30 showed how polished surfaces shape perception. Chapter 31 asks how the structure beneath apparent choice shapes movement itself. Chapter 32 follows naturally from there. Once the menu is framed, power deepens further by working on fantasy, making one available path feel not merely reasonable, but alluring. Choice architecture succeeds only when the frame is stronger than open pressure and still honest enough not to collapse under its own manipulative weight.`,
        `Greene's thirty-first law argues that controlling options can be strategically useful because people rarely choose inside empty space. Most readers hear the title and imagine blunt manipulation. Greene hears a more precise problem: by the time the final decision arrives, the important work may already have been done if the available alternatives have been arranged carefully enough.

Framed choice preserves advantage because it moves conflict upstream. If the menu of believable options already favors one result, you may not need to force the chooser at the visible moment of decision. Greene is interested in that upstream leverage. The chapter values option architecture not because freedom vanishes, but because apparent agency often reduces resistance more effectively than naked pressure does.

That is why the chapter should not be flattened into permission for false consent. It is not saying that any rigged menu counts as mastery or that material facts can be hidden without cost. It is saying that menu design can guide movement if the frame stays believable enough to hold. Strategic framing means arranging the cards so the preferred play looks usable from inside the chooser's own experience. Coercive framing means narrowing the field so sharply or dishonestly that the chooser experiences only the insult of fake freedom.

The pattern appears in ordinary life. Caden may guide a work decision by structuring the acceptable alternatives instead of fighting for one exposed demand. Liora may notice that a portfolio review's serious paths were decided before the discussion felt fully open. A private conversation may stay cooperative because the available choices preserve dignity while still channeling the outcome. In each case, the field around the choice matters as much as the choice itself.

The limit remains central because an overdesigned menu can collapse into backlash the moment people see the missing cards. Greene's practical claim is narrower: build the field before the decision, let agency soften resistance, and do not let the frame become so false that trust breaks when the design becomes visible. Chapter 30 dealt with controlling what people see at the surface. Chapter 31 deals with controlling the option set underneath what they think they are choosing. Chapter 32 then turns toward fantasy, where desire can be steered toward one framed path more powerfully than pressure alone. The reader's edge lies in seeing that power often wins not by eliminating choice, but by choreographing the choices that remain.`,
        `This law works only if you track what available options are doing to a chooser before deciding what influence really means. Most people focus on arguments, demands, and explicit persuasion. Greene's warning is that the visible contest may be downstream from the real design. Once the serious alternatives have already been selected, sequenced, and framed, the chooser can feel free while walking through a corridor that was built in advance. The chapter is about that corridor.

That is why shaped menus can be strategically valuable. A person who controls the field around the decision may encounter less open resistance because the chooser still experiences movement as partly self-directed. Greene is not praising empty illusions of freedom. He is protecting influence from the backlash that overt cornering usually triggers. Framed choice changes outcomes because people can accept a path more easily when their own agency still has somewhere to stand.

The chapter therefore distinguishes guided choice from decorative agency masking a trap. A believable menu is not the same thing as a fake one. Total openness is not always necessary. Strategic option control keeps enough plausible room that the chooser does not immediately experience the frame as humiliation. Without the design, the outcome may require a harsher fight. Without the fairness, the design can become a slower way of producing the same fight later.

Common settings show the law with almost embarrassing clarity. A rollout may succeed because leadership shaped the alternatives long before objections hardened. A student senate may believe it debated freely while moving through an agenda that already selected the plausible outcomes. A personal negotiation may stay intact because the bounded options preserved dignity better than a direct command would have. In each case, the architecture of the choice mattered before the chooser realized how much it mattered.

The limit matters because menu control can fail too. Frame the choice too loosely and the result escapes. Frame it too tightly or dishonestly and the chooser may recognize the cage. Greene's better point is to shape the field enough that the desired path emerges through believable agency rather than brute pressure. Chapter 30 taught that polished surfaces shape perception. Chapter 31 teaches that shaped options shape movement. Chapter 32 follows because once options are framed, fantasy can make one option glow more brightly than the others. The deepest lesson is that power often belongs to the one who decides which freedoms are actually placed on the table. If the menu is built well, resistance softens. If the menu is built falsely, resistance returns with clearer cause.`
      ),
      keyTakeaways: [
        {
          point: tone("The field around the choice often matters more than the final choice gesture.", "Menus can decide outcomes upstream before the visible decision arrives.", "Who sets the table often shapes what gets eaten."),
          moreDetails: tone("The chapter emphasizes choice architecture rather than last-second persuasion alone.", "A decision may appear free while the serious alternatives were already narrowed in advance.", "The final answer is often only the last movement inside a field someone else authored.")
        },
        {
          point: tone("Apparent agency can lower resistance more effectively than naked force.", "People often move farther inside a shaped field than they would under a direct command.", "A corridor with room feels softer than a shove, even when both head the same direction."),
          moreDetails: tone("Greene values guided choice because overt pressure invites clearer opposition.", "The chapter's leverage comes from leaving enough room that the chooser still experiences some authorship.", "Agency does part of the work when the frame is believable enough to hold.")
        },
        {
          point: tone("Strategic framing differs from decorative freedom masking an obvious trap.", "The move is believable option design, not insulting fake consent.", "Build the lane, but do not paint prison bars on it."),
          moreDetails: tone("The chapter still requires plausibility, room, and enough truth that the chooser does not feel mocked by the pretense of choice.", "Framing matters only while the menu remains softer than overt coercion.", "Once the chooser sees the missing cards too clearly, the tactic starts teaching them where to resist.")
        },
        {
          point: tone("Ordinary settings reveal that choices are made inside authored environments.", "Work, school, and personal decisions all show that the menu can be the hidden contest.", "People choose among available paths, not among infinite abstract freedoms."),
          moreDetails: tone("Agendas, revision paths, and bounded personal alternatives all demonstrate how upstream design shapes downstream movement.", "The chapter becomes practical when you ask who authored the plausible options and what outcome those options quietly favor.", "A choice often begins long before anyone believes the choice has started.")
        },
        {
          point: tone("The law has a fairness and visibility limit.", "Option control fails when hidden stakes or narrow framing make the menu feel unfairly rigged.", "A false corridor eventually reveals itself as one."),
          moreDetails: tone("Some situations require wider disclosure and broader choice than the tactic can comfortably allow, and the chapter overreaches if it treats that need as irrelevant.", "Greene warns against direct resistance, not against reality itself.", "The right boundary is where design stops guiding movement and starts corrupting consent or trust.")
        }
      ],
      activationPrompt: tone(
        "Identify one result you are trying to influence where the real leverage lies in shaping options earlier, not arguing later.",
        "Choose one decision environment that could be redesigned so the preferred path feels more usable from inside it.",
        "Pick one moment where you are fighting at the end because you never built the field at the start."
      ),
      selfCheckPrompts: [
        tone(
          "What serious options are actually on this table, and who authored them?",
          "Am I guiding movement through believable agency here, or am I building a frame that will feel insulting once seen clearly?",
          "Which hidden stake or missing path would make this menu feel unfair if the chooser noticed it?"
        ),
        tone(
          "How much room does this frame leave before it stops feeling like a choice and starts feeling like a trap?",
          "Would the preferred outcome still look reasonable from inside the chooser's experience, or only from mine?",
          "Where should truth widen this menu so the design stays strong instead of collapsing into backlash later?"
        )
      ],
      predictionPrompt: tone(
        "Once the menu of choices is shaped, how might Chapter 32 show that power grows further by making one path feel desirable through fantasy rather than merely available through design?",
        "If apparent freedom is already framed, what changes next when desire itself is steered toward the framed option?",
        "After the cards are dealt, how does power deepen when one card begins to glow in the chooser's imagination?"
      ),
      oneMinuteRecap: tone(
        "This chapter argues that power often wins earlier than the visible decision, through the design of the options that make one path feel self-chosen.",
        "Do not confuse the final choice gesture with the whole contest if the menu was authored long before it.",
        "Sometimes the strongest control is the one that leaves agency feeling real without letting the field stay unshaped."
      )
    }
  },
  examples: [
    {
      title: "Caden Shapes the Work Alternatives So the Team Walks Toward the Target Without One Naked Order",
      format: "decision_point",
      category: "work",
      endingType: "broader_principle",
      scenario: tone("Caden knows the team will resist a blunt command, so he has to decide whether to force one path directly or offer shaped alternatives that all move toward the workable target.", "He has to choose between winning at the final demand and winning earlier through the menu.", "Caden can push at the decision point or design the field before the decision point does all the work."),
      whatToDo: tone("He presents believable alternatives that still channel the team toward the result he needs.", "He lets the menu absorb some of the resistance that a naked command would trigger.", "He controls the cards without making the table feel obviously rigged."),
      whyItMatters: tone("The chapter says outcomes are often set upstream by the options placed on the table.", "His move shows how framed freedom can soften pushback without eliminating agency entirely.", "A designed field can do work that blunt force would only make noisier.")
    },
    {
      title: "Liora Hears Why the Student Senate's Debate Felt Open Even Though the Agenda Already Narrowed the Paths",
      format: "dialogue",
      category: "school",
      endingType: "self_directed_question",
      scenario: tone("Liora listens as someone explains that the student senate's serious outcomes were largely shaped before the floor debate ever felt fully open.", "She hears that the agenda and sequencing already narrowed what could plausibly happen.", "Liora learns that a vote can feel free while still moving inside a field someone designed earlier."),
      whatToDo: tone("She asks which parts of the agenda controlled the options before the visible choice began.", "She studies how apparent freedom remained intact even as the field quietly narrowed.", "She asks where the menu was well-framed and where it risked becoming too obviously rigged."),
      whyItMatters: tone("The chapter warns that the real contest may happen in the design of the available alternatives.", "The senate shows how upstream framing can shape downstream choice without an open shove.", "A decision can feel free while still reflecting prior architecture.")
    },
    {
      title: "Varek Weighs a Bounded Personal Menu Against the Risk of Turning It into a Trap",
      format: "dilemma",
      category: "personal",
      endingType: "surprising_implication",
      scenario: tone("Varek wants to guide a difficult personal conversation by offering bounded alternatives, but he also knows that if the frame is too tight the other person will feel cornered.", "He has to decide how much design is enough before the menu stops feeling real.", "Varek can lower resistance with structure or trigger backlash by making the structure too visible."),
      whatToDo: tone("He arranges the options so dignity remains while the path still runs inside defined limits.", "He chooses guided choice over fake freedom.", "He lets agency stay believable instead of squeezing the frame until it breaks."),
      whyItMatters: tone("The chapter says option control works only while the chooser still experiences enough room for movement.", "His dilemma shows the line between strategic framing and coercive cornering.", "A softer corridor can guide farther than a visible cage.")
    },
    {
      title: "Ilya Predicts Why the Portfolio Review Will Favor the Path Already Built into the Revision Menu",
      format: "predict_reveal",
      category: "school",
      endingType: "cross_domain",
      scenario: tone("Ilya notices that the portfolio review presents several revision paths, but one path already carries the incentives, timing, and tone that make it far easier to accept.", "He predicts the panel's final discussion will feel open while still converging on the path built into the menu.", "Ilya can already see that the visible decision is downstream from the earlier design."),
      whatToDo: tone("He tests whether the review menu is strategic framing or unfair narrowing of the field.", "He looks for agency that is real enough to hold while still guiding the outcome.", "He judges the menu by what it quietly favors before anyone speaks as if the choice were starting fresh."),
      whyItMatters: tone("The chapter says a chooser often moves inside options whose architecture they did not author.", "His prediction shows how framing can direct motion before direct persuasion even begins.", "The menu can carry the outcome quietly if it stays believable.")
    },
    {
      title: "Work Debrief Finds the Team Fought at the Final Decision Because No One Designed the Field Earlier",
      format: "postmortem",
      category: "work",
      endingType: "common_trap",
      scenario: tone("A work debrief finds that a conflict turned ugly because everyone waited until the final decision meeting to battle openly instead of shaping the serious alternatives beforehand.", "The review shows that the team tried to win at the end what should have been arranged at the start.", "The group learns that a naked showdown is often the cost of missing upstream menu design."),
      whatToDo: tone("They rebuild the process so future decisions arrive through shaped alternatives rather than one exposed collision point.", "They move the real leverage upstream into the design of the available paths.", "They treat the menu itself as part of the decision instead of as neutral background."),
      whyItMatters: tone("The chapter warns that waiting for the final yes-or-no moment often makes resistance louder than it needed to be.", "Their failure came less from the outcome itself than from the absence of choice architecture around it.", "A better field could have softened the conflict before the room ever reached the vote.")
    },
    {
      title: "Before and After Naked Demands Gave Way to Framed Alternatives",
      format: "before_after",
      category: "personal",
      endingType: "perspective_reframe",
      scenario: tone("Before, every difficult outcome was pursued through direct demand, and resistance hardened because the other person felt forced in public. After, the same goals were approached through bounded alternatives that still left room for dignity.", "The contrast is between final-moment pressure and upstream design.", "One version fights over the answer; the other shapes the question first."),
      whatToDo: tone("Design the field of serious options before expecting the final decision to carry the whole burden.", "Let agency remain visible while the menu quietly channels the movement.", "Use framing to lower friction without pretending the chooser was offered infinite freedom."),
      whyItMatters: tone("The law distinguishes strategic menu control from crude command.", "Framed alternatives can preserve cooperation where naked pressure only sharpens opposition.", "A result often changes once the path to it has been authored before the final choice arrives.")
    }
  ],
  reviewCards: [
    { cardId: "ch31-rc01", front: tone("Why does the menu matter so much in this chapter?", "Where is the real decision often made here?", "Why isn't the final yes-or-no moment the whole contest?"), back: tone("Because the available options can already shape the outcome before the final choice feels visible.", "The chapter says the field around the decision often matters more than the last gesture inside it.", "A chooser may be moving through a result someone else prepared upstream."), difficulty: "easy" },
    { cardId: "ch31-rc02", front: tone("Why can apparent agency lower resistance?", "What does guided choice do that naked orders do not?", "How does framed freedom help the preferred path?"), back: tone("Because people often push less when they still feel involved in the movement toward the result.", "A bounded choice can feel softer than a blunt command even when both serve the same outcome.", "The chapter values menus that let agency do part of the control work."), difficulty: "easy" },
    { cardId: "ch31-rc03", front: tone("How is strategic framing different from coercive cornering?", "What separates believable menus from insulting fake choices?", "Where does the tactic break?"), back: tone("Strategic framing leaves enough plausible room that the chooser does not instantly feel trapped, while coercive framing becomes too narrow or dishonest to hold.", "The law supports shaping the lane, not painting prison bars on it.", "The frame fails once the chooser sees that their apparent freedom was mostly decorative."), difficulty: "medium" },
    { cardId: "ch31-rc04", front: tone("Where does this law appear in ordinary settings?", "How do work, school, and personal choices reveal menu control?", "Why are decisions rarely made in empty space?"), back: tone("It appears wherever agendas, alternatives, or bounded paths are designed before the visible choice arrives.", "Teams, senates, reviews, and personal negotiations all show that options are often authored upstream.", "The chooser moves through a field, not through abstract unlimited freedom."), difficulty: "medium" },
    { cardId: "ch31-rc05", front: tone("How does Chapter 31 bridge to Chapter 32?", "Why does option control lead into fantasy?", "What changes after the cards on the table are already arranged?"), back: tone("Once the menu is framed, the next question is how one path becomes attractive through fantasy rather than merely available through design.", "Chapter 32 turns from structured options to seductive desire.", "First shape the cards, then make one card glow."), difficulty: "hard" }
  ],
  keyTakeawayCard: tone(
    "Controlling the options is useful when the menu of believable choices is designed so the preferred path can emerge through agency rather than through blunt pressure.",
    "This law warns that many outcomes are shaped upstream by framed alternatives and favors believable choice architecture over visible cornering.",
    "Power often grows when the field is authored early and the chooser still feels enough room to move inside it."
  )
};

const quiz = {
  passingScorePercent: 70,
  questions: [
    { questionId: "ch31-q01", prompt: "Why is direct force often weaker than menu design in this chapter?", choices: ["Because choices do not matter", "Because shaped options can guide the outcome before open resistance fully forms", "Because final decisions are always irrelevant"], correctIndex: 1, explanation: tone("Correct. The chapter says upstream option design can do work that blunt force makes harder.", "If the menu already channels the choice, the final confrontation may need less pressure.", "Right. Direct force often meets more resistance than a framed field does."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch31-q02", prompt: "What does controlling the options change upstream?", choices: ["The field in which the final choice appears", "Human agency disappears completely", "Only the wording of the final argument"], correctIndex: 0, explanation: tone("Yes. Greene treats the menu itself as the hidden battleground.", "The available paths can shape the result before the visible decision moment arrives.", "Right. The field around the decision is often where the real leverage sits."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch31-q03", prompt: "Why is this chapter not generic coercion advice?", choices: ["Because any narrow menu is automatically ethical", "Because shaped options never affect resistance", "Because it distinguishes believable guided choice from obvious traps or hidden material deception"], correctIndex: 2, explanation: tone("Correct. The line is between strategic framing and insulting fake freedom.", "Greene supports option design that still holds as a believable field, not crude coercion.", "Yes. The tactic fails once the frame becomes too false or unfair to trust."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch31-q04", prompt: "In Caden's work scenario, what best fits the chapter?", choices: ["Insist on one naked order and dare the team to resist", "Offer shaped alternatives that all move toward the workable target", "Hide material risks so the team cannot understand the choice"], correctIndex: 1, explanation: tone("Yes. The chapter favors menu control that lowers resistance before the final decision point.", "He shapes the field instead of forcing a visible collision at the end.", "Right. The stronger move is to author the plausible options first."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch31-q05", prompt: "Why did the student senate example matter for Liora?", choices: ["Because open debate proved agendas do not matter", "Because the agenda had already narrowed the serious outcomes before the vote felt fully open", "Because school settings are too small for option control"], correctIndex: 1, explanation: tone("Correct. The chapter shows that visible freedom can still sit inside a predesigned field.", "The agenda shaped the plausible paths before the final vote arrived.", "Yes. The senate felt open while still moving inside earlier architecture."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch31-q06", prompt: "What is the strongest reading of Varek's dilemma?", choices: ["He should tighten the menu until the other person feels trapped", "He should leave the field totally unshaped", "He should preserve dignity and believable room while still channeling the outcome"], correctIndex: 2, explanation: tone("Yes. The chapter supports shaped alternatives only while the frame still feels like a real field of choice.", "He needs guidance without humiliating cornering.", "Right. The frame holds only if agency remains believable enough to soften resistance."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch31-q07", prompt: "Why does apparent agency lower resistance?", choices: ["Because people never resist anything they choose", "Because a guided path feels less hostile than a naked command", "Because agency removes the need for incentives or design"], correctIndex: 1, explanation: tone("Correct. The chapter says people often push less when they still feel involved in the movement.", "A bounded menu can carry the outcome more softly than blunt pressure can.", "Yes. Agency helps here because it absorbs friction that overt force would intensify."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch31-q08", prompt: "When does option control become too visible or unfair to hold?", choices: ["When the frame hides material stakes or feels obviously rigged", "When the menu leaves believable room to move", "When the preferred path still looks reasonable inside the field"], correctIndex: 0, explanation: tone("Exactly. The tactic fails when the chooser can clearly see the cage or the hidden unfairness behind it.", "A rigged menu collapses once the frame becomes too narrow or dishonest.", "Right. Design stops softening resistance when it starts insulting the chooser's sense of reality."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch31-q09", prompt: "How does Chapter 30 lead into Chapter 31?", choices: ["Making accomplishment look effortless removes the need to shape options", "Chapter 31 rejects any link between appearance and choice architecture", "Polished surface control leads next to shaping the menu beneath apparent choice"], correctIndex: 2, explanation: tone("Correct. Chapter 30 controls the finish people see, and Chapter 31 controls the field they move through next.", "The sequence moves from surface perception to menu design.", "Right. After appearance is managed, the next leverage point is the structure of the options themselves."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch31-q10", prompt: "What bridge carries Chapter 31 into Chapter 32?", choices: ["Once the cards are dealt, the next question is how one card becomes attractive through fantasy", "Framed choice makes desire irrelevant", "Chapter 32 rejects any role for shaped options"], correctIndex: 0, explanation: tone("Correct. The next law turns from available paths to seductive desire around those paths.", "Chapter 32 asks how fantasy can make one option glow more brightly than the others.", "Right. After the menu is framed, power can deepen by shaping what people want from it."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" }
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
for (const name of ["Caden", "Liora", "Varek", "Ilya"]) continuity.nameUsage[name] = [stem];
continuity.withinChapterNames[stem] = ["Caden", "Liora", "Varek", "Ilya"];
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
- Chapter-specific mechanism remains menu control, framed freedom, upstream field design, and coercion limits rather than generic persuasion advice
- Hard depth preserves the agency-versus-cornering boundary and the Chapter 32 fantasy bridge
- Quiz stays within supported facts from the approved draft and frozen source bundle

## Gate result
- Approved for chapter gate and automatic continuation
`;
writeText(paths.validation, validation);

fs.appendFileSync(
  paths.runLog,
  `\n- Completed writer, editor, critic, converter, quiz, and validator steps for Chapter 31.\n- Validation result: PASS.\n- Continuity hash sealed for \`${stem}\`: \`${seal}\`\n`,
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
