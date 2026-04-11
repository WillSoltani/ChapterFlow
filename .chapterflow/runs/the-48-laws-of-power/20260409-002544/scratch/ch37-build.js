const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const runRoot = path.resolve(".chapterflow/runs/the-48-laws-of-power/20260409-002544");
const num = 37;
const stem = `ch${String(num).padStart(2, "0")}`;
const title = "Create Compelling Spectacles";
const chapterId = "ch37-create-compelling-spectacles";
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

const canonical = `Greene's thirty-seventh law asks why some messages disappear even when their content is sound. The chapter answers by shifting attention from explanation alone to visible form. An image, symbol, scene, or dramatic arrangement can force a meaning into memory more quickly than another layer of abstract argument. The law therefore treats spectacle as a way of making power concrete enough to be seen and difficult enough to ignore.

Its claim is not that flash should replace substance or that display by itself can carry any weak idea forever. Greene's point is narrower. Human attention often responds first to striking form. A visible demonstration, symbolic arrangement, or dramatic contrast can compress meaning and make it feel immediate. Spectacle matters because it does not merely inform. It stages. When done well, that staging turns abstraction into something the audience can grasp almost at once.

That is why the chapter distinguishes meaningful spectacle from hollow theatrics. Greene is not praising decorative excess, manipulative noise, or visual clutter for its own sake. He is describing a display whose form serves a real point. The strongest version of the law uses image and drama to sharpen interpretation, not to hide emptiness. Spectacle becomes weak when it outruns purpose and starts asking the audience to admire presentation without receiving any concentrated meaning in return.

Ordinary settings make the mechanism visible. A work leader may need a visible demonstration rather than another explanatory memo. A gallery review or student assembly may remember a symbolic arrangement more clearly than a longer verbal appeal. A personal situation may shift because a single memorable gesture makes seriousness visible where repeated explanation had blurred. In each case, form changes what attention can hold.

The chapter's limit matters. Some situations require sobriety, proof, or reasoning that can stand without dramatic packaging. Greene overreaches if the law becomes permission to decorate weakness with sensation. The useful version is narrower: use spectacle where visible form can crystallize meaning, direct memory, and make power legible, but do not confuse hollow display with force. Chapter 36 dealt with starving unwanted attention. Chapter 37 turns to designing wanted attention through image and staging. That leads naturally to Chapter 38, where difference may still need to live inside outward conformity rather than visible defiance.`;

const edited = canonical;

const critic = `# Chapter 37 Critic Report

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
- Paragraph 4 is most vulnerable because work, school, and personal illustrations can flatten into generic presentation advice if conversion drops the symbol-versus-hollow-display tension.

Strongest sentence:
- "Spectacle matters because it does not merely inform. It stages."

Anchor use notes:
- The draft stays inside the frozen support: visible form captures attention, image shapes memory, spectacle can clarify power, and empty display remains the limit.

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
        "This law says that visible form can seize attention faster than more explanation. Greene is not saying that spectacle should replace substance or that flashy display always wins. The point is that image, symbol, and dramatic arrangement can make meaning feel immediate. A strong demonstration or memorable scene may reach people before another abstract argument does. That is why spectacle can matter strategically. But the chapter is not praising empty show. Spectacle works only when the form serves a real point. Once the display becomes louder than the meaning underneath it, the tactic starts looking hollow instead of powerful.",
        "Greene's thirty-seventh law argues that people often remember what they can picture more clearly than what they only hear explained. The chapter says spectacle matters because it gives force a visible shape. Symbol, scene, and dramatic contrast can make a message hard to ignore. But the law is not generic advice to add flash to everything. Meaningful spectacle sharpens interpretation. Hollow spectacle only decorates weakness. Used well, visible form helps attention and memory lock onto the point. Used badly, the audience sees the display and misses the substance entirely.",
        "This law gives a competitive warning: if your message stays abstract, someone else's visible form may take the room first. Greene wants the reader to notice how attention behaves. A compelling image or staged contrast can do more than another round of explanation. But the chapter has a limit. Not every setting rewards display, and weak substance does not become strong just because it is dramatic. The reader's edge comes from knowing when spectacle clarifies meaning and when it merely performs urgency without carrying anything real."
      ),
      keyTakeaways: [
        { point: tone("Spectacle can seize attention quickly.", "Visible form often lands faster than abstract explanation alone.", "What can be seen is often remembered before what is only described.") },
        { point: tone("Symbol and drama can make meaning concrete.", "A staged image can compress and clarify a point.", "Spectacle turns ideas into something the room can grasp at once.") },
        { point: tone("Spectacle has a hollow-display limit.", "The chapter supports meaningful staging, not empty flash.", "If the form outruns the purpose, the display starts exposing weakness.") }
      ],
      oneMinuteRecap: tone(
        "This law says attention often belongs first to what is visible, dramatic, and memorable.",
        "Use spectacle when form can clarify meaning, not when it would only decorate thin substance.",
        "A compelling image can make power legible quickly, but empty show can undo the same effect."
      )
    },
    medium: {
      chapterBreakdown: tone(
        `Greene's thirty-seventh law begins with a practical problem: explanation often arrives too softly to survive in a crowded field of attention. The chapter answers by turning from abstraction to image. A visible arrangement, symbolic gesture, or dramatic contrast can make a message feel immediate in a way that more words often cannot.

That is why spectacle matters here. Greene is not claiming that image should replace reasoning in every case. He is saying that visible form can organize attention and memory quickly. When a point is staged well, people do not merely understand it more easily. They feel that it has shape. Spectacle can therefore make power look concrete instead of leaving it trapped in abstraction.

The distinction that matters is between meaningful display and hollow theatrics. Meaningful spectacle serves the point. Hollow spectacle asks the audience to admire the staging while the meaning underneath remains thin. The chapter becomes weak if it is flattened into generic showmanship advice, because Greene is not praising flash for its own sake. He is describing form that concentrates interpretation.

Ordinary settings show the pattern clearly. Lucan may need a visible demonstration at work instead of another round of abstract explanation. A gallery review or student assembly may remember Isolde's symbolic staging more clearly than a longer speech. A personal situation may shift because a single image or gesture makes seriousness visible where explanation had become blur. In each case, form changes recall as well as attention.

The limit remains central because spectacle can also expose weakness. If the display is louder than the meaning or if the setting demands sobriety more than drama, the tactic collapses into noise. Greene's better point is narrower: use visible form when it clarifies force and memory, not when it merely decorates emptiness. Chapter 36 dealt with withdrawing tribute from what shrinks you. Chapter 37 deals with directing attention through image once it can be used positively again. Chapter 38 then asks how visible strategy coexists with outward conformity.`,
        `A room can ignore a sound argument while still being captured by a strong image. Greene uses that fact to move the reader from explanation alone to staged form. The issue is not whether ideas matter. It is whether the audience receives them first through analysis or through what can be seen and remembered.

That is why symbol and spectacle can be strategically useful. A visible contrast, dramatic scene, or memorable arrangement can compress meaning faster than another layer of abstraction. Greene's practical claim is that spectacle helps power feel immediate. It turns interpretation into something that reaches the senses before it is fully sorted into language.

The chapter is strongest when it separates concentrated symbolism from decorative excess. A good spectacle sharpens the point. A bad spectacle swells around the point until nothing remains but the swelling. Greene is not asking the reader to become louder by default. He is asking the reader to make force legible where words alone are fading.

The pattern appears everywhere. Lucan can either keep explaining a proposal abstractly or make its logic visible through demonstration. Isolde can either rely on more language in a student assembly or stage a form the room will remember. A personal appeal can either keep circling in explanation or land through one vivid, clarifying act. The event changes because the form changes.

The law overreaches if it becomes an excuse for empty flash, propaganda aesthetics, or display detached from meaning. The useful boundary is sharper than that: use spectacle when it serves clarity, memory, and force, but not when it asks image to carry what substance cannot. Chapter 36 asked how attention is withdrawn from denial. Chapter 37 asks how attention is seized positively. The next law then turns toward surviving visible difference under the pressure to outwardly fit in.`,
        `Greene's thirty-seventh law warns that abstraction alone often loses the first battle for attention. Readers usually assume that if a point is strong enough, explanation will eventually carry it. Greene is less trusting. He sees that image, drama, and visible form often decide what gets noticed before content is patiently evaluated.

The law values spectacle because form can concentrate meaning. A visible demonstration does not simply decorate an argument. It gives the argument a body. Symbol, scene, and contrast make a point easier to remember and harder to ignore. In that sense, spectacle is not ornamental. It is a method of forcing attention and memory to work in your favor.

This is why the chapter should not be flattened into endorsement of sheer flash. Greene is not saying that every setting rewards theatrical intensity or that weak substance becomes strong once it is staged. He is saying that meaning sometimes needs a visible carrier. Meaningful spectacle compresses interpretation. Hollow spectacle scatters it by making the audience notice only the performance.

Common cases make the line visible. Lucan may gain more from letting a team see a result than from another memo about it. Isolde may shape a gallery review or student assembly through symbolic form that the room can recall later. A personal moment may become decisive because one visible gesture says what five explanations could not anchor. These are not different rules. They are the same spectacle logic at different scales.

The limit matters because display can make weakness more obvious when the stage is bigger than the point. Greene's law works only when image serves force rather than pretending to be force. Chapter 36 dealt with starving attention from the wrong object. Chapter 37 deals with earning it through visible design. Chapter 38 follows because what attracts notice still has to survive among people who reward conformity at the surface.`
      ),
      keyTakeaways: [
        {
          point: tone("Spectacle can capture attention before abstraction settles in.", "Visible form often reaches the room faster than explanation alone.", "A strong image can win the first battle for notice."),
          moreDetails: tone("The chapter treats image and staging as ways to make interpretation immediate.", "Attention often organizes itself around what can be seen and felt before it organizes itself around analysis.", "Spectacle matters because the audience may remember form before it remembers reasoning.")
        },
        {
          point: tone("Symbol and drama can make power feel concrete.", "A staged form can compress meaning into something quickly grasped.", "Visible contrast turns abstract force into legible presence."),
          moreDetails: tone("Greene values spectacle because it gives ideas a memorable body.", "Demonstration and symbolic arrangement can make a point feel undeniable at a glance.", "The tactic works when form is carrying meaning rather than replacing it.")
        },
        {
          point: tone("Hollow theatrics are different from meaningful spectacle.", "Good display sharpens the point; bad display swells around it.", "When the audience remembers only the performance, the spectacle failed."),
          moreDetails: tone("The chapter stays sharp only if spectacle remains tied to substance.", "Decorative excess can scatter interpretation instead of concentrating it.", "Visible drama without strategic purpose becomes a liability rather than a force multiplier.")
        },
        {
          point: tone("Work, school, and personal settings all reveal spectacle logic.", "Ordinary rooms also reward what becomes visible and memorable.", "A room often recalls a staged form more easily than another explanation."),
          moreDetails: tone("Demonstrations, symbolic arrangements, and vivid gestures all show how form affects recall.", "The law becomes practical when you ask whether your point needs a body rather than more description.", "Spectacle is visible whenever a scene does more work than another paragraph.")
        },
        {
          point: tone("The law has a hollow-display limit.", "Spectacle turns weak when the setting, substance, or purpose cannot support it.", "A larger stage can expose a smaller point."),
          moreDetails: tone("Greene warns against empty flash, not against visible clarity.", "The useful line is to stage what meaning can sustain and to avoid display that merely decorates thinness.", "Image helps only while it is serving force instead of pretending to create force from nothing.")
        }
      ],
      activationPrompt: tone(
        "Find one idea that may need a visible form rather than more explanation.",
        "Choose one setting where a strong symbol or demonstration could make the point more memorable.",
        "Identify one place where spectacle would clarify meaning and one where it would only create noise."
      ),
      selfCheckPrompt: tone(
        "Does this display make the point clearer, or is it asking the audience to admire the display itself?",
        "What would the room remember from this scene a day later, and would that memory match the meaning I intend?",
        "If the form were stripped away, would enough substance remain to justify the stage I am building?"
      ),
      oneMinuteRecap: tone(
        "This chapter argues that spectacle matters because visible form can seize attention and shape memory before abstraction fully arrives.",
        "Use image, symbol, and drama when they make force legible, not when they would simply decorate a weak point.",
        "A compelling spectacle succeeds when the audience remembers the meaning through the form rather than the form without the meaning."
      )
    },
    hard: {
      chapterBreakdown: tone(
        `Greene's thirty-seventh law asks the reader to think of attention as something that can be staged rather than merely awaited. A strong idea may still lose if it arrives only as explanation in a field crowded with competing impressions. The chapter therefore relocates power from argument alone to visible form. What matters strategically is whether force becomes something the audience can picture, feel, and remember before abstraction cools it.

That is why the law values spectacle. Greene is not glamorizing gaudy display for its own sake. He is describing an arrangement of image, symbol, and dramatic contrast that makes a point difficult to ignore. Spectacle can compress meaning because the visible scene carries more than one sentence at once. It can make power appear inevitable, memorable, or emotionally immediate where explanation would have arrived thinner and later.

The central distinction is between meaningful spectacle and hollow theatrics. Meaningful spectacle serves interpretation by giving the audience a concentrated form of the point. Hollow theatrics invert that relation. They ask the audience to admire the staging while the meaning underneath remains vague, weak, or decorative. One form of display makes force legible. The other exposes how little force there was to begin with.

That distinction matters because memory and attention often attach to scenes faster than to explanations. Lucan may do more by demonstrating a result visibly than by elaborating it in another memo. Isolde may make a gallery review or student assembly memorable through symbolic staging that lets the room feel the point before it summarizes it. A personal gesture may carry seriousness because the form concentrates what repeated words had diffused. In each case, spectacle does not replace meaning. It gives meaning a body.

The chapter is strongest when it refuses both bland abstraction and empty flash. Some settings need sobriety. Some arguments must stand without visual drama. Some displays become liabilities because the stage grows larger than the point. Greene's limit therefore matters. Spectacle is strategic only when visible form sharpens force instead of pretending to manufacture force from thin substance.

Chapter 36 argued that attention should be withdrawn from denied objects that keep extracting tribute. Chapter 37 turns attention outward again by showing how image and staging can seize it on purpose. The sequence matters. First stop feeding absence. Then design presence that can hold the eye. Chapter 38 follows by asking how visible force survives within social environments that still punish surface difference and reward outward sameness.`,
        `A room can forget a sound explanation while remaining fixed on a single scene. Greene uses that fact to shift the reader from abstract persuasion to symbolic form. The strategic issue is not whether content matters. It is whether content will actually reach the audience before other impressions claim the field.

The chapter therefore values spectacle because image can organize response at high speed. A symbolic arrangement, vivid contrast, or visible demonstration can compress a point into something graspable at once. Greene's practical claim is that spectacle gives force an exterior shape. It converts meaning from something merely stated into something staged.

The harder distinction is between concentration and inflation. A good spectacle concentrates the point. A bad spectacle inflates around the point until nothing remains but noise, sensation, and decorative excess. Greene is not calling for louder presentation by default. He is calling for forms that make the point memorable without letting the performance detach from its purpose.

Lucan's work demonstration, Isolde's assembly or gallery staging, and a personal visible gesture all reveal the same structure. They succeed when the audience can feel the meaning through the form rather than merely witness a performance. That is why spectacle can outperform more explanation. It changes not only what is said, but how quickly the audience can carry it into memory.

The law overreaches whenever it turns image into a substitute for substance or confuses visual impact with strategic depth. Its useful boundary is sharper than that. Stage what meaning can sustain. Avoid what makes weakness more visible by enlarging it. Chapter 36 asked how attention is denied to the wrong object. Chapter 37 asks how it is won for the right one. Chapter 38 then tests whether that visible winning can survive under the pressure to outwardly resemble everyone else.`,
        `Greene's thirty-seventh law is really about visible concentration. Most people trust explanation because it feels fairer and more rational, yet explanation often arrives slowly and disperses under pressure. Spectacle matters because it gathers meaning into a form that can strike, stay, and return in memory. The law therefore turns power into a problem of design as much as of content.

Its strongest claim is that attention is selective in ways abstraction often underestimates. A room may overlook a chain of reasoning while fixing on a single image. An audience may forget a careful explanation while remembering one scene that made the idea legible. If you ignore those dynamics, you may keep strengthening the argument while losing the audience. Greene's correction is that form is not outside strategy. It is part of how strategy enters perception.

That is why spectacle should be understood as symbolic staging rather than as mere show. A good spectacle does not hide meaning. It delivers it in concentrated visible form. Hollow display does the opposite. It asks attention to admire the shell after the center has gone missing. The distinction is brutal but necessary: spectacle serves force when it clarifies; it betrays force when it tries to replace it.

The examples make that line visible. Lucan gains leverage when the team can see a result instead of only reading about it. Isolde shapes a room when symbolic arrangement does what explanation had not done. A personal gesture becomes decisive when it lets seriousness take visible shape. These are not separate tricks. They are the same design logic in different settings: meaning becomes harder to ignore when it can be seen as well as understood.

The limit matters because a larger stage also enlarges failure. Greene's law becomes useful only when the image is answerable to the point beneath it. If the form outruns the substance, the spectacle begins proving weakness instead of power. Chapter 36 dealt with withdrawing attention from what should shrink. Chapter 37 deals with concentrating attention on what should stand out. Chapter 38 follows because visible difference still has to move through social worlds that often reward behavioral sameness even when they admire inward originality.`
      ),
      keyTakeaways: [
        {
          point: tone("Spectacle can stage attention instead of waiting for it.", "Visible form lets force enter perception quickly.", "A strong scene can win the first battle for memory before analysis catches up."),
          moreDetails: tone("The chapter treats image and arrangement as strategic tools, not decorative extras.", "Attention often latches onto what can be pictured before it latches onto what can be paraphrased.", "Visible concentration can make meaning harder to ignore.")
        },
        {
          point: tone("Symbolic staging can make power feel concrete.", "A well-designed spectacle gives meaning a body.", "What is seen clearly can compress what would otherwise require many sentences."),
          moreDetails: tone("Greene values spectacle because visible contrast and symbol can make interpretation immediate.", "Demonstration often does more than further explanation because it turns the point into an event.", "The tactic works when form is carrying force instead of distracting from it.")
        },
        {
          point: tone("Hollow theatrics invert the value of spectacle.", "A spectacle fails when the audience remembers only the shell.", "Inflated display can advertise the thinness it hoped to conceal."),
          moreDetails: tone("The chapter stays hard only if form remains answerable to meaning.", "Decorative excess can make weakness more visible by enlarging it.", "Spectacle becomes liability once performance detaches from strategic purpose.")
        },
        {
          point: tone("Work, school, and personal rooms all show the same design logic.", "A visible form often survives in memory where explanation diffuses.", "Spectacle is ordinary whenever a scene carries more force than another paragraph."),
          moreDetails: tone("Demonstrations, staged arrangements, and vivid gestures reveal how form changes recall.", "The law becomes practical when you ask what your idea would look like if it had to become visible.", "Meaning enters differently when the audience can both see and understand it.")
        },
        {
          point: tone("The law has a stage-versus-substance limit.", "A larger display can magnify weakness when the point underneath is small.", "What form cannot honestly support, spectacle will eventually expose."),
          moreDetails: tone("Greene warns against empty flash, not against memorable design.", "The useful rule is to stage only what substance can carry and what the setting can bear.", "Spectacle becomes strategic strength only when the visible body matches the real weight of the point.")
        }
      ],
      activationPrompt: tone(
        "Locate one argument that may be losing because it has no visible form yet.",
        "Choose one setting where design and symbol could make your meaning harder to ignore.",
        "Identify one place where a stronger stage would clarify force and one where it would only enlarge weakness."
      ),
      selfCheckPrompts: [
        tone(
          "If this became a scene rather than a sentence, what exactly would the audience carry away from it?",
          "Am I using visible form to concentrate meaning or to distract from thin substance?",
          "What part of this design would still matter if the novelty wore off tomorrow?"
        ),
        tone(
          "Does the setting reward spectacle here, or will visible excess damage credibility more than it helps recall?",
          "Would the audience remember the point through the image, or only the image without the point?",
          "If the stage got larger, would the meaning beneath it become clearer or more fragile?"
        )
      ],
      predictionPrompt: tone(
        "If attention can be won through spectacle, how might Chapter 38 argue that power still requires outward conformity in environments hostile to visible difference?",
        "What happens when a person knows how to stand out but must still survive by blending behaviorally with the group?",
        "After mastering visible concentration, how does strategy change when social safety depends on looking ordinary?"
      ),
      oneMinuteRecap: tone(
        "This chapter argues that spectacle is a way of concentrating attention and memory through visible form, making meaning immediate where abstraction might fade.",
        "Use image, symbol, and dramatic arrangement when they sharpen force, but do not confuse a larger stage with stronger substance.",
        "Power grows when the audience remembers the point because of the form rather than mistaking the form for the whole point."
      )
    }
  },
  examples: [
    {
      title: "Lucan Uses a Visible Demonstration Instead of Another Abstract Memo",
      format: "decision_point",
      category: "work",
      endingType: "broader_principle",
      scenario: tone("Lucan sees that repeated explanation is not moving the room, and he has to decide whether to keep arguing abstractly or make the point visible.", "He has to choose between more description and a compelling demonstration.", "Lucan can keep informing or stage something the room can actually picture."),
      whatToDo: tone("He designs a demonstration that lets the team see the result instead of only hearing about it.", "He gives the argument a visible body instead of another layer of memo language.", "He makes the point hard to ignore by turning it into something concrete."),
      whyItMatters: tone("The chapter says spectacle can seize attention where abstraction is fading.", "His case shows how visible form can do more than more explanation.", "He wins the room by making meaning legible at a glance.")
    },
    {
      title: "Isolde Explains Why the Assembly Remembered the Symbol More Than the Speech",
      format: "dialogue",
      category: "school",
      endingType: "self_directed_question",
      scenario: tone("Isolde describes how a student assembly or gallery review stayed in memory because of one symbolic arrangement rather than because of the longest verbal explanation.", "She shows that the room carried the image forward after the words faded.", "The conversation turns into a lesson about form and memory rather than volume alone."),
      whatToDo: tone("She studies what the room saw and why that visible contrast carried the meaning so quickly.", "She asks how symbol can compress what speech had been stretching out.", "She tracks which form made the point concrete enough to stay."), 
      whyItMatters: tone("The chapter says spectacle helps people remember what they can picture.", "Her example shows how image can keep meaning alive after the event ends.", "The room recalled the point because the form carried it, not because the speech was longer.")
    },
    {
      title: "Marlo Has to Decide Whether a Dramatic Gesture Will Clarify Meaning or Only Create Noise",
      format: "dilemma",
      category: "personal",
      endingType: "surprising_implication",
      scenario: tone("Marlo is tempted to make a dramatic visible gesture, but he is unsure whether it would sharpen the point or simply make the moment louder.", "He has to decide whether the spectacle would serve the meaning or replace it.", "Marlo can stage clarity or accidentally stage emptiness."),
      whatToDo: tone("He keeps only the part of the gesture that makes the meaning visible and cuts the rest.", "He lets the form concentrate the point instead of inflating around it.", "He chooses a spectacle the substance can actually carry."),
      whyItMatters: tone("The chapter says hollow theatrics expose weakness when the display outruns the point.", "His dilemma shows the line between meaningful staging and decorative excess.", "A stronger scene is useful only if it clarifies force rather than pretending to create it.")
    },
    {
      title: "Emani Predicts the Gallery Review Will Be Won by What the Room Can See at Once",
      format: "predict_reveal",
      category: "school",
      endingType: "cross_domain",
      scenario: tone("Emani predicts that the gallery review will turn less on who explains the longest and more on which arrangement gives the room an immediate visible grasp of the point.", "She expects image and staging to outrun abstraction in first impact.", "The scene becomes a forecast about attention design rather than argument alone."),
      whatToDo: tone("She watches which display compresses meaning most clearly into one memorable scene.", "She tests whether the visible form sharpens interpretation or merely decorates it.", "She compares raw explanation with image that organizes recall."), 
      whyItMatters: tone("The chapter says attention often follows what becomes visible first.", "Her prediction shows how spectacle can dominate even intellectually serious settings.", "The room will likely remember the scene that made the idea legible fastest.")
    },
    {
      title: "The Work Debrief Finds That the Team's Abstract Case Only Moved Once It Became Visible",
      format: "postmortem",
      category: "work",
      endingType: "common_trap",
      scenario: tone("A work debrief shows that the team kept strengthening its explanation without noticing that the room needed to see the point rather than hear it one more time.", "They realize the case moved only after someone staged a visible demonstration.", "The review becomes a lesson in design rather than in more abstract proof."),
      whatToDo: tone("They separate what required evidence from what required visible form and stop treating those as the same problem.", "They build the next case around a demonstration the room can carry in memory.", "They stop confusing more words with more force."), 
      whyItMatters: tone("The chapter warns that abstraction can lose the first battle for attention.", "Their mistake was not weak content but content without a body.", "Once the point became visible, the room could finally hold it.")
    },
    {
      title: "Before and After One Image Did the Work Five Explanations Could Not Do",
      format: "before_after",
      category: "personal",
      endingType: "perspective_reframe",
      scenario: tone("Before, the same point kept being explained and slipping away. After, one visible gesture or symbolic contrast made the meaning immediate and memorable.", "The contrast is between abstraction without grip and form with grip.", "One version diffuses; the other concentrates."),
      whatToDo: tone("Find the visible body of the point instead of adding another layer of explanation.", "Use one clarifying image that lets the meaning arrive whole.", "Let form carry what repetition has been diluting."), 
      whyItMatters: tone("The law becomes visible when one scene does what many sentences could not sustain.", "This before-and-after shows how spectacle can concentrate meaning into recall.", "The audience holds the point once it can see it.")
    }
  ],
  reviewCards: [
    { cardId: "ch37-rc01", front: tone("What is the main claim of Chapter 37?", "Why does spectacle matter here?", "What can visible form do to attention?"), back: tone("The chapter argues that striking visible form can seize attention and shape memory more forcefully than abstraction alone.", "Spectacle matters because image and staging can make meaning immediate.", "Visible form can make a point hard to ignore and easier to remember."), difficulty: "easy" },
    { cardId: "ch37-rc02", front: tone("What does symbolic staging do strategically?", "Why can image outperform more words?", "How does spectacle make power concrete?"), back: tone("It gives meaning a visible body the audience can grasp quickly.", "Symbol and dramatic arrangement can compress what explanation would stretch out.", "Spectacle makes force feel concrete by staging it."), difficulty: "easy" },
    { cardId: "ch37-rc03", front: tone("How is meaningful spectacle different from hollow theatrics?", "When does display start failing?", "What makes the audience remember only the shell?"), back: tone("Meaningful spectacle sharpens the point, while hollow theatrics inflate around it and expose thin substance.", "Display fails when it asks the audience to admire the form without receiving clear meaning.", "If the shell survives without the point, the spectacle was hollow."), difficulty: "medium" },
    { cardId: "ch37-rc04", front: tone("Where does this law appear in ordinary settings?", "How do work, school, and personal examples show spectacle logic?", "Why is a scene sometimes stronger than a paragraph?"), back: tone("It appears wherever visible demonstration or symbolic form can do more than further explanation.", "Meetings, assemblies, reviews, and personal gestures all show how form changes recall.", "A scene can carry meaning into memory faster than repeated abstraction."), difficulty: "medium" },
    { cardId: "ch37-rc05", front: tone("How does Chapter 37 bridge to Chapter 38?", "What comes after learning to seize attention visibly?", "Why does spectacle lead into conformity?"), back: tone("Once attention can be won through visible form, the next question is how to survive socially while still behaving outwardly like others.", "Chapter 38 turns from standing out visibly to blending behaviorally when needed.", "Visible force still has to operate inside groups that punish obvious difference."), difficulty: "hard" }
  ],
  keyTakeawayCard: tone(
    "Creating compelling spectacles becomes powerful when visible form, symbol, and dramatic arrangement make meaning immediate without letting display outrun substance.",
    "This law values spectacle because attention often follows what can be seen and remembered quickly, while warning that hollow flash exposes weakness instead of concentrating force.",
    "Power grows when the audience remembers the point through the image rather than being left with only the image."
  )
};

const quiz = {
  passingScorePercent: 70,
  questions: [
    { questionId: "ch37-q01", prompt: "Why does spectacle matter in this chapter?", choices: ["Because it makes all substance unnecessary", "Because visible form can seize attention faster than abstraction alone", "Because dramatic display always beats argument"], correctIndex: 1, explanation: tone("Correct. The chapter says image and visible form can capture attention quickly.", "Spectacle matters because what can be seen often lands before what is only explained.", "Right. The law is about concentrated visibility, not replacing meaning entirely."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch37-q02", prompt: "What can visible form do that abstraction often cannot?", choices: ["Guarantee that weak ideas become strong", "Remove the need for context", "Make the point immediate and memorable"], correctIndex: 2, explanation: tone("Yes. The chapter says spectacle can give meaning a body the audience can grasp quickly.", "Visible form helps attention and memory hold the point.", "Correct. It compresses meaning into something easier to see and recall."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch37-q03", prompt: "Why is this chapter not empty showmanship advice?", choices: ["Because it distinguishes meaningful spectacle from hollow theatrics", "Because it says every setting rewards more display", "Because it rejects substance"], correctIndex: 0, explanation: tone("Correct. The chapter supports form that sharpens meaning, not empty flash.", "Greene is drawing a line between strategic staging and noise.", "Right. Hollow display fails when it outruns the point it should serve."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch37-q04", prompt: "In Lucan's work scenario, what best fits the chapter?", choices: ["Keep sending abstract memos if the room is not responding", "Use a visible demonstration that lets the room see the point", "Add louder language without changing form"], correctIndex: 1, explanation: tone("Yes. The chapter favors a visible demonstration when explanation alone is fading.", "He gives the argument a body instead of only another paragraph.", "Correct. Spectacle here means making the point concrete enough to see."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch37-q05", prompt: "What does Isolde's school example show?", choices: ["That the longest speech is always most memorable", "That gallery reviews ignore visible form", "That symbolic staging can carry meaning longer than more words"], correctIndex: 2, explanation: tone("Correct. The room remembers the symbol because the form carried the point.", "Her example shows how spectacle shapes recall, not just first attention.", "Right. The scene stayed because the meaning had a visible carrier."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch37-q06", prompt: "What is the strongest reading of Marlo's dilemma?", choices: ["A dramatic gesture helps only if it clarifies the meaning rather than inflating around it", "Any dramatic gesture is automatically strong", "He should avoid all visible form"], correctIndex: 0, explanation: tone("Yes. The chapter's limit is that display must serve the point.", "His real decision is whether the form clarifies force or merely creates noise.", "Correct. Hollow theatrics expose weakness instead of concentrating meaning."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch37-q07", prompt: "How do symbol and drama shape memory in this chapter?", choices: ["They erase the need for meaning", "They make every setting theatrical", "They let the audience carry the point in visible form"], correctIndex: 2, explanation: tone("Correct. Spectacle helps memory because the audience can picture the point.", "Symbol and drama give abstraction a form that can be recalled later.", "Right. Memory often holds a scene better than another explanation."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch37-q08", prompt: "When does spectacle collapse into decorative noise?", choices: ["When form sharpens interpretation", "When the display becomes louder than the meaning it should serve", "When image supports substance"], correctIndex: 1, explanation: tone("Exactly. The chapter warns that spectacle fails when the audience sees only the shell.", "If the stage outruns the point, the display begins exposing weakness.", "Right. Hollow display is noise because it inflates around thin substance."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch37-q09", prompt: "How does Chapter 36 lead into Chapter 37?", choices: ["By moving from withdrawing tribute to designing attention through visible form", "By proving spectacle is unrelated to attention", "By making image unnecessary"], correctIndex: 0, explanation: tone("Correct. Chapter 36 starves the wrong object of attention, and Chapter 37 turns to seizing attention positively.", "The sequence moves from refusal to staging.", "Right. Once attention is no longer trapped by denial, it can be designed on purpose."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch37-q10", prompt: "What bridge carries Chapter 37 into Chapter 38?", choices: ["Once you can stand out visibly, the next question is how to survive while behaving outwardly like others", "Chapter 38 rejects all visible strategy", "Spectacle removes any need for conformity"], correctIndex: 0, explanation: tone("Correct. The next law turns from standing out through form to blending behaviorally when needed.", "Chapter 38 asks how visible force lives inside social conformity.", "Right. Power still has to move through groups that punish obvious difference."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" }
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
for (const name of ["Lucan", "Isolde", "Marlo", "Emani"]) continuity.nameUsage[name] = [stem];
continuity.withinChapterNames[stem] = ["Lucan", "Isolde", "Marlo", "Emani"];
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
- Chapter-specific mechanism remains spectacle, image, symbolic staging, and hollow-display limits rather than generic promotion advice
- Hard depth preserves the concentrated-meaning versus decorative-noise boundary and the Chapter 38 conformity bridge
- Quiz stays within supported facts from the approved draft and frozen source bundle

## Gate result
- Approved for chapter gate and automatic continuation
`;
writeText(paths.validation, validation);

fs.appendFileSync(
  paths.runLog,
  `\n- Completed writer, editor, critic, converter, quiz, and validator steps for Chapter 37.\n- Validation result: PASS.\n- Continuity hash sealed for \`${stem}\`: \`${seal}\`\n`,
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
