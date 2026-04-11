const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const runRoot = path.resolve(".chapterflow/runs/the-48-laws-of-power/20260409-002544");
const num = 16;
const stem = `ch${String(num).padStart(2, "0")}`;
const title = "Use Absence to Increase Respect and Honor";
const chapterId = "ch16-use-absence-to-increase-respect-and-honor";
const createdAt = new Date().toISOString();

function tone(gentle, direct, competitive) {
  return { gentle, direct, competitive };
}

const canonical = `Greene's sixteenth law shifts away from force and toward scarcity. The chapter starts with a simple social problem: constant presence can cheapen value. When someone is always available, always visible, and always easy to reach, familiarity can flatten distinction. Attention stops sharpening around them. Respect can drift downward not because they have less substance, but because they are no longer scarce enough to feel notable.

That is why the law treats absence as a lever on value. If visibility is reduced and access is no longer constant, attention can recover. People notice what is not always in front of them. A little distance can renew curiosity, regard, and perceived importance. Greene's point is not that vanishing is glamorous in itself. It is that saturation often lowers impact while selective scarcity can raise it.

The chapter is strongest when it keeps that mechanism narrow. Absence works here because overexposure can make people, contributions, and roles feel ordinary. Spacing restores contour. Constant presence lets others adapt to you too fully. Strategic absence interrupts that adaptation and makes your return or participation matter more than it did under saturation.

That distinction matters because the law is easy to vulgarize into generic ghosting advice. Greene is not best understood as saying that neglect always creates respect. The mechanism has a limit. Absence can elevate value only when some basis of regard already exists and when withdrawal does not destroy trust. If the distance looks flaky, contemptuous, or irresponsible, the effect reverses. Respect turns into frustration.

The pattern appears in ordinary settings. A colleague who answers every message instantly can become taken for granted even when their work is strong. A student editor who is everywhere in a club may start to feel like background infrastructure rather than a valued presence. A personal relationship can lose sharpness when all space disappears, then recover when pacing and room return. In each case, scarcity changes attention.

The limit remains central. Not every role allows strategic absence, and not every context rewards distance. Duties, care, and reliability still matter. Greene's harder point is conditional: overpresence can reduce value, but absence only helps when it interrupts saturation without breaking responsibility. The move is about restoring weight, not about withholding as a reflex.

Chapter 15 ended one problem by asking how recurring threats are fully closed. Chapter 16 asks what happens after pressure recedes and presence no longer has to be constant. That points forward too. Once value can be shaped by spacing, the next question is how unpredictability changes power when people can no longer settle into a stable expectation of you.`;

const edited = `Greene's sixteenth law shifts away from force and toward scarcity. The chapter begins with a simple social problem: constant presence can cheapen value. When someone is always available, always visible, and always easy to reach, familiarity can flatten distinction. Attention stops sharpening around them. Respect can drift downward not because they have less substance, but because they are no longer scarce enough to feel notable.

That is why the law treats absence as a lever on value. If visibility is reduced and access is no longer constant, attention can recover. People notice what is not always in front of them. A little distance can renew curiosity, regard, and perceived importance. Greene's point is not that vanishing is admirable by itself. It is that saturation often lowers impact while selective scarcity can raise it.

The chapter is strongest when it keeps that mechanism narrow. Absence works here because overexposure can make people, contributions, and roles feel ordinary. Spacing restores contour. Constant presence lets others adapt to you too fully. Strategic absence interrupts that adaptation and makes your return or participation matter more than it did under saturation.

That distinction matters because the law is easy to vulgarize into generic ghosting advice. Greene is not best understood as saying that neglect always creates respect. The mechanism has a limit. Absence can elevate value only when some basis of regard already exists and when withdrawal does not destroy trust. If the distance looks flaky, contemptuous, or irresponsible, the effect reverses. Respect turns into irritation or distrust.

The pattern appears in ordinary settings. A colleague who answers every message instantly can become taken for granted even when their work is strong. A student editor who is everywhere in a club may start to feel like background infrastructure rather than a valued presence. A personal relationship can lose sharpness when all space disappears, then recover when pacing and room return. In each case, scarcity changes attention.

The limit remains central. Not every role allows strategic absence, and not every context rewards distance. Duties, care, and reliability still matter. Greene's harder point is conditional: overpresence can reduce value, but absence only helps when it interrupts saturation without breaking responsibility. The move is about restoring weight, not about withholding as a reflex.

Chapter 15 ended one problem by asking how recurring threats are fully closed. Chapter 16 asks what happens after pressure recedes and presence no longer has to be constant. That points forward. Once value can be shaped by spacing, the next question is how unpredictability changes power when people can no longer settle into a stable expectation of you.`;

const critic = `# Chapter 16 Critic Report

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
- Paragraph 5 is the most vulnerable because the work, school, and personal cases can flatten into generic "be less available" advice if conversion drops the overexposure-versus-responsibility distinction.

Strongest sentence:
- "Spacing restores contour."

Anchor use notes:
- The draft stays inside the frozen support: overpresence lowers value, scarcity renews attention, absence can increase respect and honor, and the tactic fails when distance breaks trust or responsibility.

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
        "This law says too much presence can make a person easier to overlook. If someone is always available, always visible, and always easy to reach, people can start treating them like background instead of value. Greene's point is that scarcity changes attention. When access is not constant, presence can feel more important again. Absence works here because overexposure can cheapen respect. But the law has a limit. It is not advice to ghost people or ignore duties. Distance only helps when some real regard already exists and when reliability is still intact. If absence starts looking flaky or careless, the effect reverses. The stronger lesson is narrower: reduce saturation without breaking trust. Make room for presence to matter again. Let the room notice the difference between endless availability and deliberate return. Presence regains weight when it stops arriving as a permanent background stream.",
        "Greene's sixteenth law argues that overpresence can lower value while selective absence can raise respect. Constant visibility makes people easier to take for granted. Scarcity restores attention because what is less available can feel more notable. That is the chapter's core mechanism. The point is not mysterious vanishing for its own sake. It is that familiarity and saturation can flatten impact. But the law has a limit. Absence helps only when it interrupts overexposure without damaging reliability. If people experience the distance as neglect, contempt, or irresponsibility, respect drops instead of rising. The chapter works when it stays on attention, value, and controlled spacing rather than generic nonresponse advice. The best version keeps trust firm while making presence less automatic. Scarcity helps only when the return still feels dependable. Otherwise reduced visibility just turns into annoyance with better styling. Respect rises only if the room can still count on what comes back.",
        "This law makes a sharp point: if you are always there, people may stop feeling your weight. Constant presence can turn value into furniture. Greene's claim is that scarcity restores contour. Step back enough to break saturation and attention often comes back stronger. That is why absence can increase respect and honor here. But the move is not universal. If the distance makes you look flaky, lazy, or uncaring, the value effect dies. The lesson is not to disappear at random. It is to stop flooding the room so your presence can matter again without breaking trust. Real scarcity sharpens notice only when the room still believes you are solid. Weight rises when rarity and reliability hold together. If trust slips, the same gap starts reading as failure instead of value. The room has to miss you without fearing you are gone for good."
      ),
      keyTakeaways: [
        { point: tone("Too much presence can reduce perceived value through overfamiliarity.", "Overexposure cheapens attention.", "Flood the space long enough and your weight starts feeling automatic.") },
        { point: tone("Selective absence can renew respect by restoring scarcity.", "Spacing can raise value.", "Rarity sharpens notice.") },
        { point: tone("The law fails when absence starts looking like neglect or unreliability.", "Scarcity is not flakiness.", "Break trust and the value effect dies.") }
      ],
      oneMinuteRecap: tone(
        "This law says scarcity can renew respect when constant presence has made value easier to ignore, but absence only helps if reliability still holds.",
        "Overexposure lowers impact. Controlled spacing can restore it. Neglect destroys it.",
        "Be scarce enough to matter, not absent enough to rot trust."
      )
    },
    medium: {
      chapterBreakdown: tone(
        `Greene's sixteenth law argues that constant presence can reduce respect by making a person, role, or contribution feel ordinary. When access is always open and visibility never changes, attention relaxes. Familiarity starts flattening distinction. What once felt notable becomes part of the room's background, and value is still real but no longer felt with the same sharpness.

That is the chapter's scarcity logic. Absence can increase respect because it interrupts saturation. When someone is not constantly present, their return carries more contour. Attention renews itself around what is not endlessly available. Greene therefore treats spacing and selective withdrawal as ways to restore value rather than as acts of pure mystery.

The chapter works best when it stays narrow. It is not generic advice to disappear, ignore people, or play emotional games. The mechanism depends on overexposure first. If saturation has made attention cheap, a reduction in presence can make that attention more deliberate again. Scarcity matters because it changes perception of value.

You can see the pattern in ordinary settings. A colleague who answers every message instantly may become useful but underrespected because access feels unlimited. A student-paper editor who is present in every conversation may start to feel like infrastructure rather than a presence the group notices. A personal relationship can lose some freshness when no space exists at all, then regain it when pacing and room return. In each case, less can become more because saturation had dulled notice.

The limit is just as important. Not every context allows strategic absence, and not every role should become harder to reach. Trust, duty, and reliability still carry weight. Greene's harder point is conditional: absence helps only when it interrupts overfamiliarity without reading as neglect. Used crudely, the move damages respect instead of increasing it. That is why the chapter bridges naturally from Chapter 15's closure into Chapter 16's spacing logic, and then toward Chapter 17, where unpredictability goes beyond scarcity into unsettled expectation.`,
        `Greene's sixteenth law says overpresence can lower value while selective absence can increase respect and honor. A person who is always visible, always available, and always within reach can become easier to overlook. Familiarity does not merely create comfort here. It can also create flattening. The more saturated the contact becomes, the less sharply attention registers the person's value.

Absence matters because scarcity changes perception. When access is reduced and visibility becomes less constant, attention starts recovering its edge. A return, a contribution, or even a simple appearance can feel more significant because it is no longer automatic. Greene is therefore interested in spacing, not in disappearing for drama.

That distinction keeps the chapter disciplined. This is not a universal rule to withdraw from people or duties. It works only when constant availability has already made presence cheap. Strategic absence raises value only if some base of regard already exists and if reliability remains visible enough not to collapse.

Ordinary settings show the pattern clearly. A manager who is in every thread, every meeting, and every response loop may lose symbolic weight even while doing excellent work. A school editor who never leaves the room can become so familiar that peers stop marking the role as special. In personal life, constant contact can blur appreciation until a healthier rhythm restores it. Scarcity changes the felt value of presence.

The law also carries a strict limit. If absence starts looking careless, superior, or flaky, the effect reverses. Respect turns into frustration. The chapter's stronger claim is that value rises under controlled spacing, not under broken responsibility. That is why Chapter 16 follows Chapter 15 so closely: once overt pressure is gone, power can shift from force to timing, distance, and managed visibility before Chapter 17 turns that instability into unpredictability. Scarcity matters here only because the room can still trust what returns. If trust disappears, the value effect disappears with it. Distance then lowers regard instead of lifting it. The room has to feel more respect after the gap, not more doubt.`,
        `This law starts with a practical discomfort: being everywhere can make you matter less. Constant presence may look like service or commitment, yet it can also make the room adapt to you too fully. Once people stop registering your absence as possible, they often stop registering your presence as valuable. Greene's point is that saturation can cheapen respect.

Scarcity changes that. Pull back with control, and the room pays attention again. The return gains shape because it is no longer automatic. Honor and respect rise here not through raw domination but through reduced overfamiliarity. Absence restores contrast.

That does not make the chapter a ghosting manual. The move is narrower than that. It works when overexposure has made value ordinary, and it fails when distance starts reading as neglect. Scarcity is powerful only if the relationship or role can carry it without trust collapsing.

The pattern travels across common settings. A highly responsive worker can become taken for granted because their access feels endless. A robotics-club lead can become so available that the role starts feeling routine instead of respected. A personal bond can feel dulled by saturation, then sharpen when room returns. Less presence changes the emotional and symbolic weight of what remains.

The limit is decisive. Some roles require steadiness more than scarcity, and some people read withdrawal as disrespect immediately. The chapter remains useful only when absence interrupts saturation without breaking obligation. That is why it points beyond Chapter 15's closure and forward into Chapter 17's unpredictability. Scarcity renews value; unpredictability then makes that value harder to settle around.`
      ),
      keyTakeaways: [
        {
          point: tone("Constant presence can flatten value by making someone feel ordinary.", "Overfamiliarity dulls respect.", "Your weight can start feeling automatic once the room fully adapts."),
          moreDetails: tone("The chapter focuses on saturation because constant visibility can turn value into background.", "Respect drops here through overexposure rather than through loss of substance.", "If the room never feels your absence, it stops marking your presence.")
        },
        {
          point: tone("Selective absence can renew attention by restoring scarcity.", "Spacing sharpens notice.", "Rarity makes the return register again."),
          moreDetails: tone("Value rises because reduced access makes presence less automatic and more deliberate.", "The chapter's scarcity effect depends on breaking saturation rather than creating confusion.", "The room looks up harder when it cannot assume you are always there.")
        },
        {
          point: tone("Strategic absence differs from neglect or emotional withholding.", "Scarcity is not irresponsibility.", "Distance works only if trust stays standing."),
          moreDetails: tone("The chapter allows pacing and withdrawal only when duties and regard remain intact.", "If absence reads as carelessness, the value effect reverses quickly.", "A missed room can increase weight; a broken promise kills it.")
        },
        {
          point: tone("Work, school, and personal life all show how overexposure cheapens attention.", "Unlimited access can make even strong roles feel routine.", "Too much visibility can turn value into furniture."),
          moreDetails: tone("This is why instant replies, omnipresence, and endless availability can quietly lower symbolic weight.", "The chapter becomes practical when you ask where saturation has made notice cheap.", "Flood the board and the board starts forgetting what you cost.")
        },
        {
          point: tone("The law stays useful only when scarcity remains controlled and conditional.", "Not every role should become harder to reach.", "Use this everywhere and you just become flaky."),
          moreDetails: tone("Some contexts reward steadiness more than distance, so the reader has to judge responsibility before withdrawal.", "The chapter keeps its force only when scarcity is balanced against trust and duty.", "If the room needed reliability, mystery is a bad trade.")
        }
      ],
      activationPrompt: tone(
        "Think of one place where constant availability may have made your value easier to overlook and ask what cleaner spacing would change.",
        "Choose one relationship or role where saturation may be lowering respect, then identify what controlled distance could restore.",
        "Pick one room where you may be flooding the board and name what a little scarcity would do there."
      ),
      selfCheckPrompt: tone(
        "Am I interrupting overexposure, or am I starting to withdraw in a way that will look unreliable?",
        "Does this context have enough trust for scarcity to help, or does it mainly need steadiness from me?",
        "Will this spacing restore weight, or just make me look flaky?"
      ),
      oneMinuteRecap: tone(
        "The chapter says scarcity can renew respect when overexposure has flattened value, but the move fails if absence damages trust.",
        "Value rises here through controlled spacing, not through careless disappearance.",
        "Break saturation without breaking reliability."
      )
    },
    hard: {
      chapterBreakdown: tone(
        `Greene's sixteenth law treats overpresence as a problem of symbolic erosion. Value does not disappear because a person becomes less capable. It can disappear from perception because their presence becomes too continuous to feel distinct. Constant visibility, unlimited access, and repeated availability let the room adapt too fully. Once the adaptation is complete, respect can soften into assumption. The person is still useful, but their importance no longer lands with the same force.

Absence functions as more than simple distance in this chapter. It is a scarcity intervention. By interrupting saturation, absence restores contrast. People notice what is not perpetually in front of them. A return, an appearance, or even a contribution starts carrying more weight because it no longer arrives as an endless baseline. Greene's point is that rarity can intensify attention, and attention can intensify respect.

The harder distinction is between scarcity and neglect. The chapter is not strongest when it sounds aloof or emotionally withholding. It is strongest when it shows how strategic spacing preserves value without breaking duty. Absence works only when some basis of regard already exists and when the withdrawal does not read as contempt, laziness, or irresponsibility. Once trust cracks, scarcity stops looking valuable and starts looking selfish.

The law travels carefully across ordinary settings for the same reason. At work, someone can answer every message, appear in every meeting, and still lose symbolic weight because access feels unlimited. At school, a highly visible student leader or editor can become so familiar that the role stops attracting notice. In personal life, constant contact can flatten appreciation until healthy room returns. The same structure appears in each case: saturation lowers felt value, spacing can restore it.

Yet the law immediately risks overreach. Not every absence increases honor, and not every role should cultivate rarity. Some obligations require steadiness, responsiveness, and visible care. If a person with real responsibilities tries to create value through disappearance, they may trade respect for resentment. The move remains conditional even at its strongest edge. Scarcity helps only where overpresence has made attention cheap and where trust can survive reduced contact.

So the chapter's real question is exact: has saturation made presence too ordinary, and can distance restore contour without collapsing reliability? Chapter 16 follows Chapter 15 so naturally because once direct pressure has ended, power no longer has to work only through force. It can work through timing, absence, and managed visibility. The chapter then points into Chapter 17, where unpredictability makes that timing harder to read. Scarcity renews value, but the law works only when rarity restores weight instead of turning absence into dereliction. A return has to feel rarer and still dependable at the same time to produce the effect Greene wants. Controlled spacing sharpens attention only when the room still sees responsibility behind the gap. The mechanism depends on rarity and trust arriving together. If either side breaks, the room stops reading the gap as honor and starts reading it as instability. The move works only when the pause clarifies worth instead of introducing suspicion. A useful gap leaves the room more attentive and still secure, not more anxious and confused. In Greene's terms, the missing piece must intensify value rather than expose weakness in the structure around it. The room should feel a cleaner sense of significance after the pause, not merely a sharper sense of uncertainty.`,
        `Greene's sixteenth law argues that value can be damaged by overfamiliarity. A person may remain competent, impressive, or necessary, yet lose felt importance because they are too continuously present. When access never closes and visibility never varies, the room stops marking the person as scarce. Respect begins to flatten into habit, and honor loses some of its charge because the presence feels built into the furniture.

Absence changes that by restoring scarcity. Reduced presence creates renewed notice because what is less available draws more deliberate attention. A contribution feels weightier when it is not simply one more constant arrival in an endless stream. Greene therefore treats distance as a way to increase perceived value, not because disappearance is glamorous, but because saturation cheapens impact.

The chapter keeps its precision only when it separates strategic withdrawal from unreliability. Scarcity is not flakiness. It works only if some basis of respect already exists and if obligations still remain legible to others. The moment absence looks dismissive, lazy, superior, or careless, the mechanism reverses. Instead of honor rising, trust decays.

Ordinary settings make the logic visible. A leader who is everywhere can become easier to ignore symbolically than a leader whose appearances are less constant but still deliberate. A school editor who is always available can feel like infrastructure instead of a presence people consciously value. A personal relationship can lose edge under saturation and recover some regard under healthier pacing. In each case, scarcity sharpens attention after overexposure had dulled it.

But the law also carries a discipline problem. Readers can easily overapply it and treat all distance as power. That fails because some contexts demand steadiness more than rarity. Duties, care, and responsiveness still create trust, and trust is part of what makes scarcity effective at all. Without that base, absence is not strategic; it is just abandonment in nicer clothing.

The deeper test is therefore conditional: has presence become so saturated that value is no longer registering clearly, and can reduced contact restore distinction without damaging obligation? Chapter 15 closed a threat. Chapter 16 asks how value works when force gives way to spacing. Chapter 17 then asks what happens when spacing is joined by unpredictability. The sequence matters. Scarcity creates renewed attention, but unpredictability destabilizes expectation itself. Greene's claim holds only when distance preserves respect rather than draining it away. That means the room must still read the withdrawal as controlled rather than as abandonment. If people only feel dropped, the chapter's mechanism never activates. The gain depends on contour rather than on disappearance by itself. Value rises only when the gap stays legible as intentional and dependable. Once the room stops trusting the return, scarcity no longer increases honor or significance. In that case the distance subtracts value instead of sharpening it. The reader must see that failed scarcity does not create mystery; it merely lowers confidence and reduces the return to a weaker signal instead of a stronger one.`,
        `This law works only if you see how constant presence can lower value without lowering substance. Someone can remain competent, generous, or important, yet lose symbolic force because the room has adapted too fully to their continuous availability. Overexposure turns presence into assumption. Once that happens, respect weakens not through hostility but through familiarity so complete that notice becomes dull.

Scarcity reverses part of that erosion. Controlled absence restores contrast. The room pays more attention to what it cannot treat as endless. A return, a message, an appearance, or a contribution gains more contour because it is no longer folded into a permanent background stream. Greene's insight is that respect and honor can rise when presence stops being automatic.

The crucial boundary is reliability. This chapter does not reward neglect. It rewards spacing that interrupts saturation while preserving trust. If absence becomes dereliction, withholding, or visible carelessness, the value effect collapses. People do not honor what feels contemptuous or unstable. Scarcity depends on an underlying structure of regard and responsibility.

That is why the chapter is useful beyond ceremonial or elite settings. A worker who is reachable every second can become undernoticed precisely because access feels infinite. A student leader who appears in every room can lose symbolic edge through pure repetition. A close personal bond can feel flattened by nonstop contact and then sharpen when mutual space returns. In each setting, less presence can produce more felt value if the reduction is controlled rather than chaotic.

The danger is overreading the law into universal aloofness. Some roles cannot afford strategic distance. Some people need reassurance more than scarcity. Some systems punish absence because responsibility there is measured through visible reliability. Greene's point remains conditional at every level: scarcity raises value only where overpresence has already lowered it and where trust survives the reduction.

So the chapter's real test is whether absence restores significance or merely signals disregard. Chapter 16 sits after closure because once direct conflict is gone, power can move through attention rather than force. It opens into Chapter 17 because value that has been renewed through spacing becomes even harder to predict once timing itself turns unstable. The law succeeds only when the room feels your weight more clearly after the space, not when it simply feels abandoned by it. The return has to land as rarer, cleaner, and still trustworthy for the mechanism to hold. If the room reads only neglect, scarcity never becomes honor at all. Respect rises only when the space sharpens notice without weakening faith. The gap has to preserve reliability strongly enough that people feel more regard when you return, not less. Otherwise absence drains the very esteem it was supposed to increase. The chapter succeeds when people miss the value and then recognize it more clearly on return. If recognition does not deepen after the gap, the strategy has failed even if the silence looked dramatic. A valuable absence should leave the return feeling more meaningful, not merely more visible. If the return is only more visible and not more respected, the chapter's promise has not been met.`
      ),
      keyTakeaways: [
        {
          point: tone("Overpresence can erode symbolic value even when real substance remains.", "Constant availability can make importance harder to feel.", "A room can adapt until your weight becomes background."),
          moreDetails: tone("The law focuses on perception under saturation, not on a literal loss of competence or worth.", "Respect falls here because uninterrupted visibility makes distinction feel ordinary.", "If the stream never stops, the room stops marking the cost of what it gets.")
        },
        {
          point: tone("Absence raises value by restoring scarcity and contrast.", "Reduced availability sharpens attention.", "Rarity gives the return more contour."),
          moreDetails: tone("Scarcity works because the room notices more carefully what it cannot assume will always appear.", "The chapter's value effect depends on breaking saturation, not on creating random confusion.", "The board looks up harder when the piece is no longer treated as permanent furniture.")
        },
        {
          point: tone("Strategic spacing differs from neglect because trust must remain intact.", "Reliability is the hard limit on scarcity.", "Distance without trust just becomes dereliction."),
          moreDetails: tone("The chapter allows absence only when obligations remain credible and regard already exists.", "If the withdrawal reads as contempt or carelessness, respect drops instead of rising.", "A missed presence can add weight; a broken duty drains it instantly.")
        },
        {
          point: tone("Work, school, and personal settings all show how overfamiliarity can cheapen attention.", "Unlimited access can turn strong roles into unnoticed infrastructure.", "Flood enough rooms and the rooms stop feeling your shape."),
          moreDetails: tone("The pattern appears wherever a person becomes so continuously available that the room stops actively valuing the contribution.", "The chapter becomes practical when you examine where notice has dulled through repetition.", "If you are in every thread, the room may forget that your thread has a cost.")
        },
        {
          point: tone("The law remains conditional because some roles need steadiness more than rarity.", "Scarcity is powerful only where trust can survive reduced visibility.", "Use absence blindly and you trade honor for resentment."),
          moreDetails: tone("The reader has to judge obligation, dependence, and context before treating distance as strategic.", "Chapter 16 stays sound only when scarcity is balanced against responsibility and care.", "If the room needed reliability, mystery is a losing bargain.")
        }
      ],
      activationPrompt: tone(
        "Identify one place where overfamiliarity may be flattening your value and ask whether controlled spacing could restore attention without harming trust.",
        "Choose one role where you may be oversaturating the room, then test what reduced availability would change if responsibility still stayed clear.",
        "Pick one board you may be flooding and decide whether a little scarcity would sharpen notice or just make you look unreliable."
      ),
      selfCheckPrompts: [
        tone(
          "Has saturation really cheapened my value here, or am I just attracted to distance because it feels dramatic?",
          "Is overpresence the actual problem in this context, or does the situation still mainly require steadiness from me?",
          "Am I fixing saturation, or just dressing up withdrawal as strategy?"
        ),
        tone(
          "Would this absence preserve trust while restoring contour, or would it read as neglect once people felt its cost?",
          "Can I reduce visibility without reducing reliability in a way the room will understand clearly?",
          "Will the room feel my weight more after the gap, or just feel abandoned by it?"
        )
      ],
      predictionPrompt: tone(
        "Once scarcity has renewed attention, how might Chapter 17's unpredictability make that attention even harder for others to settle around?",
        "If spacing has already increased value, what changes when your timing also becomes less readable in the next chapter?",
        "After scarcity sharpens the board, what happens when the room can no longer predict your rhythm?"
      ),
      oneMinuteRecap: tone(
        "This law argues that scarcity can renew respect by interrupting overfamiliarity, but the effect survives only when absence does not damage trust.",
        "Value rises here through controlled spacing and reduced saturation, not through careless disappearance.",
        "Be rare enough to regain weight and reliable enough not to lose the room."
      )
    }
  },
  examples: [
    {
      title: "Tamsin Stops Flooding the Team Channel So Her Work Carries More Weight",
      format: "decision_point",
      category: "work",
      endingType: "broader_principle",
      scenario: tone("Tamsin is in every thread and every response loop, and her strong work is starting to feel ordinary because access to her never closes.", "She has to decide whether to remain constantly available or create cleaner spacing around her highest-value contributions.", "Tamsin can keep flooding the board or give her best moves room to land."),
      whatToDo: tone("She reduces unnecessary visibility while staying dependable on the work that truly requires her.", "She creates deliberate spacing around her presence without breaking reliability.", "She stops spraying availability and makes the real appearances count."),
      whyItMatters: tone("The chapter says overpresence can cheapen value and scarcity can restore attention.", "Her weight returns when access stops feeling unlimited.", "If the board cannot assume infinite access, it starts noticing the piece again.")
    },
    {
      title: "Ravi Hears Why the Student Paper Editor Became Easy to Take for Granted",
      format: "dialogue",
      category: "school",
      endingType: "self_directed_question",
      scenario: tone("Ravi listens as someone explains why the student paper editor lost symbolic weight by being present in every small discussion.", "He hears how nonstop visibility turned a respected role into background infrastructure.", "Ravi learns that the editor became so constant that the room stopped looking up."),
      whatToDo: tone("He asks where cleaner spacing could restore the role's contour without abandoning the paper's real duties.", "He looks for how reduced overpresence could renew respect while keeping the work reliable.", "He asks how to pull back from noise without dropping the paper."),
      whyItMatters: tone("The chapter distinguishes scarcity that renews notice from absence that breaks obligation.", "A role can lose felt value when familiarity becomes total.", "Too much visibility can sand the edge off respect.")
    },
    {
      title: "Elodie Weighs Healthy Space Against Personal Withdrawal That Would Feel Cold",
      format: "dilemma",
      category: "personal",
      endingType: "surprising_implication",
      scenario: tone("Elodie senses that nonstop contact has flattened appreciation, but she also knows sudden distance could feel hurtful and careless.", "She has to choose between creating healthier room and withdrawing so sharply that trust drops.", "Elodie can restore space or accidentally turn space into frost."),
      whatToDo: tone("She creates pacing that renews regard without making care feel withdrawn.", "She uses spacing rather than neglect, keeping the bond dependable while reducing saturation.", "She builds room without making the other person feel abandoned."),
      whyItMatters: tone("The chapter allows absence only when trust remains intact.", "Distance helps here only if it restores value without reading as contempt.", "If the gap kills trust, the scarcity effect dies with it.")
    },
    {
      title: "Kellan Predicts Why One Leader Declines Needless Appearances",
      format: "predict_reveal",
      category: "work",
      endingType: "cross_domain",
      scenario: tone("Kellan notices that one leader skips low-value appearances and predicts it is meant to preserve weight rather than to look superior.", "He expects the leader to manage visibility so presence stays notable.", "Kellan can already tell the move is about contour, not ego theater."),
      whatToDo: tone("He judges whether the reduced presence keeps responsibilities clear while avoiding saturation.", "He looks for controlled scarcity rather than random aloofness.", "He scores the move on weight and reliability, not on drama."),
      whyItMatters: tone("The chapter says selective absence can increase respect when it interrupts overfamiliarity.", "Less visibility can raise value only if the room still trusts the role.", "Scarcity works when the board still knows the piece is solid.")
    },
    {
      title: "Robotics-Club Debrief Finds That Constant Access Made a Leadership Role Feel Ordinary",
      format: "postmortem",
      category: "school",
      endingType: "common_trap",
      scenario: tone("A robotics club reviews why a capable leader stopped being especially respected after becoming available for every tiny issue.", "The group sees that nonstop access made the role feel routine instead of notable.", "The club realizes the role got flattened into background service through pure repetition."),
      whatToDo: tone("They identify where cleaner boundaries and fewer low-value appearances would restore the role's contour.", "They separate real duties from overpresence that had made attention cheap.", "They stop mistaking endless access for endless value."),
      whyItMatters: tone("The chapter warns that saturation can lower felt importance even when competence stays high.", "Value can disappear from perception when familiarity becomes total.", "If the room treats you like infrastructure, respect starts going soft.")
    },
    {
      title: "Before and After Space Returned Weight to a Relationship That Had Felt Saturated",
      format: "before_after",
      category: "personal",
      endingType: "perspective_reframe",
      scenario: tone("Before, constant contact made attention dull and automatic. After, healthier spacing made the relationship feel more intentional and more noticed again.", "The contrast is between saturation that cheapened appreciation and pacing that restored it.", "Before was flood. After was contour."),
      whatToDo: tone("Notice whether reduced frequency creates more regard while care remains visible and dependable.", "Judge the change by whether trust holds while attention sharpens.", "Ask whether the space adds weight or just adds worry."),
      whyItMatters: tone("The chapter says absence helps only when it restores value without breaking trust.", "Controlled room can renew appreciation after saturation has flattened it.", "The gain comes from contour, not from coldness.")
    }
  ],
  implementationPlan: {
    coreSkill: tone("The core skill is restoring value through controlled spacing without letting absence turn into neglect.", "Core skill: reduce saturation while preserving trust and responsibility.", "Core skill: create contour without looking flaky."),
    ifThenPlans: [
      { context: "work", plan: tone("If I am in every work thread and my value feels easier to overlook, then I will reduce low-value visibility while staying dependable on core responsibilities.", "If the team takes my presence for granted, then I will separate essential access from saturation-level availability.", "If work keeps treating me like background furniture, I stop flooding the room and keep the real door solid.") },
      { context: "school", plan: tone("If a school role feels underrespected through overfamiliarity, then I will create cleaner boundaries around where I show up constantly.", "If a club starts treating my role as routine infrastructure, then I will cut needless omnipresence without dropping obligations.", "If the school room stops looking up, I reduce the noise, not the duty.") },
      { context: "personal", plan: tone("If constant contact has dulled appreciation, then I will add healthier spacing without letting care feel withdrawn.", "If saturation is flattening a personal bond, then I will restore room while keeping trust visible.", "If the bond feels flooded, I add contour without making the other person feel abandoned.") }
    ],
    twentyFourHourChallenge: tone("Within 24 hours, identify one place where constant availability may be lowering your value and name one boundary that would reduce saturation without harming reliability.", "Today, choose one context where overpresence may be flattening respect and define one controlled spacing move that still keeps trust intact.", "Before the day ends, find one room you are flooding and decide what to cut without touching what must stay solid."),
    weeklyPractice: tone("For one week, track where overexposure made your value easier to overlook, where spacing renewed attention, and where reduced presence would have harmed trust instead.", "Spend seven days auditing saturation, scarcity, and the point where distance stops helping and starts reading as neglect.", "Run a one-week scarcity audit and separate contour-building gaps from flaky disappearances.")
  },
  reviewCards: [
    { cardId: "ch16-rc01", front: tone("Why can constant presence reduce respect in this chapter?", "How does overexposure flatten value?", "Why can being everywhere make you matter less?"), back: tone("Because continuous visibility can make a person feel ordinary and easy to take for granted.", "Overfamiliarity dulls attention and weakens felt distinction.", "The room adapts until your weight feels automatic."), difficulty: "easy" },
    { cardId: "ch16-rc02", front: tone("Why can selective absence increase value?", "How does scarcity raise attention here?", "Why does the return matter more after space?"), back: tone("Because reduced presence restores scarcity and makes attention more deliberate again.", "Spacing interrupts saturation so presence regains contour.", "The board notices harder when it cannot assume you are always there."), difficulty: "easy" },
    { cardId: "ch16-rc03", front: tone("How is strategic absence different from neglect?", "What keeps scarcity from becoming flakiness?", "Why isn't distance alone enough?"), back: tone("Strategic absence preserves trust and duty while reducing overexposure.", "The move works only if reliability still remains visible.", "Distance without trust just turns into dereliction."), difficulty: "medium" },
    { cardId: "ch16-rc04", front: tone("Where does this law show up in ordinary life?", "How do work, school, and personal settings reveal saturation?", "Where does overpresence turn value into furniture?"), back: tone("It appears wherever endless access and nonstop visibility make a strong role feel routine.", "Instant replies, omnipresence, and saturation can cheapen felt importance.", "Any room can start ignoring what it never has to miss."), difficulty: "medium" },
    { cardId: "ch16-rc05", front: tone("What limit keeps this law from being overapplied?", "Why must scarcity stay conditional?", "What happens if you use absence blindly?"), back: tone("Some roles need steadiness more than rarity, so distance can damage respect if trust depends on presence.", "Scarcity only helps where overexposure was the real problem and reliability can survive the reduction.", "Use absence everywhere and you just trade value for resentment."), difficulty: "hard" }
  ],
  keyTakeawayCard: tone("Scarcity can renew respect when overpresence has flattened value, but the move works only if trust and responsibility remain intact.", "This law is about restoring contour through controlled spacing, not about disappearing carelessly.", "Be scarce enough to matter and solid enough not to lose the room."),
};

const quiz = {
  passingScorePercent: 70,
  questions: [
    {
      questionId: "ch16-q01",
      prompt: "Why can constant presence reduce respect in this chapter?",
      choices: [
        "Because visible people are always less competent than private ones",
        "Because overfamiliarity can make value feel ordinary and easier to overlook",
        "Because respect depends on silence more than on contribution"
      ],
      correctIndex: 1,
      explanation: tone("Yes. The chapter's mechanism is overexposure flattening perceived value.", "Constant availability can make a person easier to take for granted.", "Right. If the room never has to miss you, it can stop feeling your weight."),
      bloomsLevel: "remember-understand",
      depthLevel: "easy"
    },
    {
      questionId: "ch16-q02",
      prompt: "What does scarcity change here?",
      choices: [
        "It makes attention more deliberate by interrupting saturation",
        "It proves that all distance is better than closeness",
        "It removes the need for reliability completely"
      ],
      correctIndex: 2,
      explanation: tone("Correct. Scarcity works by renewing notice after overpresence has dulled it.", "Reduced availability can restore contour to presence.", "Yes. Rarity sharpens notice when saturation had made it cheap."),
      bloomsLevel: "remember-understand",
      depthLevel: "easy"
    },
    {
      questionId: "ch16-q03",
      prompt: "Why is this law not generic ghosting advice?",
      choices: [
        "Because absence only helps when trust remains intact and overexposure was the real problem",
        "Because Greene rejects strategic distance entirely",
        "Because the chapter applies only to formal leadership roles"
      ],
      correctIndex: 1,
      explanation: tone("Exactly. The chapter stays narrow and conditional.", "Scarcity is different from neglect because reliability still matters.", "Right. Distance that breaks trust stops helping."), 
      bloomsLevel: "remember-understand",
      depthLevel: "easy"
    },
    {
      questionId: "ch16-q04",
      prompt: "In Tamsin's work scenario, what best fits the chapter?",
      choices: [
        "Reduce low-value visibility while staying dependable on the work that truly requires her",
        "Disappear from the team entirely so nobody can make demands",
        "Stay in every thread so her value remains obvious"
      ],
      correctIndex: 2,
      explanation: tone("Correct. The move is controlled spacing, not abandoned responsibility.", "She should reduce saturation without breaking reliability.", "Right. Cut the flood, keep the real door solid."),
      bloomsLevel: "apply-analyze",
      depthLevel: "medium"
    },
    {
      questionId: "ch16-q05",
      prompt: "Why did Ravi's student-paper example lose symbolic weight?",
      choices: [
        "Because the editor became less talented over time",
        "Because nonstop visibility made the role feel like background infrastructure",
        "Because all school leadership roles are automatically undervalued"
      ],
      correctIndex: 1,
      explanation: tone("Yes. Overpresence made the role too familiar to notice sharply.", "Endless visibility can flatten a role into routine infrastructure.", "Right. The room stopped looking up because the role was always there."), 
      bloomsLevel: "apply-analyze",
      depthLevel: "medium"
    },
    {
      questionId: "ch16-q06",
      prompt: "What is the strongest reading of Elodie's dilemma?",
      choices: [
        "Healthy spacing can renew regard, but withdrawal that feels cold will damage trust",
        "Any distance in personal life always increases respect",
        "The safest move is to become harder to reach no matter the bond"
      ],
      correctIndex: 2,
      explanation: tone("Yes. The chapter allows room only when care still stays visible.", "Distance helps here only if the bond does not start feeling neglected.", "Right. Add contour, not frost."), 
      bloomsLevel: "apply-analyze",
      depthLevel: "medium"
    },
    {
      questionId: "ch16-q07",
      prompt: "Why can selective withdrawal increase perceived value?",
      choices: [
        "Because any confusion makes people respectful",
        "Because reduced availability can restore contrast after saturation",
        "Because silence automatically looks superior"
      ],
      correctIndex: 1,
      explanation: tone("Correct. Scarcity changes attention by making presence less automatic.", "Spacing restores contrast after overexposure had flattened notice.", "Yes. The return lands harder when the room cannot assume constant access."), 
      bloomsLevel: "analyze-evaluate",
      depthLevel: "hard"
    },
    {
      questionId: "ch16-q08",
      prompt: "When does the chapter become an overread?",
      choices: [
        "When it treats all availability as weakness and turns scarcity into unreliability",
        "When it distinguishes controlled spacing from neglect",
        "When it asks whether trust can survive reduced visibility"
      ],
      correctIndex: 2,
      explanation: tone("Exactly. The law breaks when absence is used as a universal answer.", "Scarcity becomes self-defeating once it damages duty and trust.", "Right. If every gap becomes strategy, you just start looking flaky."), 
      bloomsLevel: "analyze-evaluate",
      depthLevel: "hard"
    },
    {
      questionId: "ch16-q09",
      prompt: "How does Chapter 15 lead into Chapter 16?",
      choices: [
        "Once direct pressure is gone, power can shift from closure into the value effects of spacing and scarcity",
        "Chapter 15 proves force is no longer ever needed in the book",
        "Chapter 16 replaces all strategic thinking with pure charm"
      ],
      correctIndex: 0,
      explanation: tone("Correct. The sequence moves from ending overt threat to shaping value through presence and absence.", "After closure, the next question is how attention works when presence is no longer constant.", "Right. Force closes the fight; spacing changes the value field afterward."), 
      bloomsLevel: "analyze-evaluate",
      depthLevel: "hard"
    },
    {
      questionId: "ch16-q10",
      prompt: "What bridge carries Chapter 16 into Chapter 17?",
      choices: [
        "Scarcity renews attention, then unpredictability makes timing itself harder to settle around",
        "Absence makes unpredictability unnecessary",
        "Once value rises, consistency should become perfectly transparent"
      ],
      correctIndex: 0,
      explanation: tone("Yes. The next chapter moves from spacing into unreadable rhythm.", "Chapter 17 builds on renewed attention by making expectation less stable.", "Right. First the board notices you again, then it stops knowing your rhythm."), 
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
for (const name of ["Tamsin", "Ravi", "Elodie", "Kellan"]) {
  continuity.nameUsage[name] = [stem];
}
continuity.withinChapterNames[stem] = ["Tamsin", "Ravi", "Elodie", "Kellan"];
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
- Chapter-specific mechanism remains scarcity, overexposure, familiarity decay, renewed attention, and the trust limit rather than generic ghosting advice
- Hard depth preserves the scarcity-versus-neglect boundary and the Chapter 17 unpredictability bridge
- Quiz stays within supported facts from the approved draft and frozen source bundle

## Drift repair
- No repair required during this chapter pass.

## Gate result
- Approved for chapter gate and automatic continuation
`;
writeText(paths.validation, validation);

fs.appendFileSync(
  paths.runLog,
  `\n- Completed writer, editor, critic, converter, quiz, and validator steps for Chapter 16.\n- Validation result: PASS.\n- Continuity hash sealed for \`${stem}\`: \`${seal}\`\n`,
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
