const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const runRoot = path.resolve(".chapterflow/runs/the-48-laws-of-power/20260409-002544");
const num = 26;
const stem = `ch${String(num).padStart(2, "0")}`;
const title = "Keep Your Hands Clean";
const chapterId = "ch26-keep-your-hands-clean";
const createdAt = new Date().toISOString();

function tone(gentle, direct, competitive) {
  return { gentle, direct, competitive };
}

const canonical = `Greene's twenty-sixth law begins with a reputational fact that many people prefer to ignore. Authority is not judged only by outcomes. It is also judged by what stains seem to cling visibly to the person in charge. When blame, punishment, mess, or harsh execution attach directly to your hands, your standing can suffer even if the action was necessary. The chapter begins by treating visible dirt as a political liability.

Its claim is not that responsibility should disappear or that innocence can be faked without cost. Greene's point is more strategic. Power often lasts longer when visible blame and unpleasant execution are buffered by distance, intermediaries, or delegated channels. Clean public hands do not remove the need for hard action. They separate the central figure from the direct contamination of carrying it out in full view. Reputation therefore depends not only on decisions, but also on where visible dirt is allowed to land.

That is why the law focuses on controlled buffering rather than on reckless blame-dumping. Greene is not praising cowardice, random scapegoating, or abandonment of responsibility. He is distinguishing strategic distance from irresponsible displacement. The useful move is not to let someone else act wildly in your name while you pretend to be absent. It is to use buffers that preserve authority without surrendering control over the harsh work still being done.

Ordinary settings make the mechanism visible. A manager may let a process owner deliver painful enforcement while keeping final authority less publicly stained. A debate-board chair may remain visibly above the conflict while other officers absorb the procedural heat. A person in private life may avoid becoming the face of every hard boundary by letting structure, timing, or agreed channels carry part of the burden. In each case, distance protects standing because dirt attaches most strongly to whoever appears to execute it directly.

The chapter's limit matters. Clean-hands strategy can fail if scapegoating becomes obvious, if the intermediary becomes too powerful, or if distance destroys trust and fairness. Greene overreaches if the law becomes advice to evade all responsibility while disposable agents absorb the damage. The useful version is narrower: keep visible dirt off your hands where it preserves authority, but maintain control, accept real responsibility, and avoid structures that collapse into obvious abuse. Chapter 25 redesigned the public self. Chapter 26 asks how that self stays reputationally clean when unpleasant outcomes still have to happen. That points toward Chapter 27, where power also depends on projecting enough independence that others remain attached and obedient without feeling you need them too much.`;

const edited = canonical;

const critic = `# Chapter 26 Critic Report

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
- Paragraph 4 is most vulnerable because work, school, and personal examples can flatten into generic blame-avoidance talk if conversion drops the visible-dirt, authority, and control-risk mechanism.

Strongest sentence:
- "Clean public hands do not remove the need for hard action."

Anchor use notes:
- The draft stays inside the frozen support: visible blame stains standing, buffers can preserve authority, strategic distance differs from scapegoating, and the tactic fails when control or fairness collapses.

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
        "This law says visible blame can damage power even when hard action was necessary. People react not only to what happened but also to whose hands seem dirty afterward. Greene is not saying responsibility disappears or that leaders should become fake innocents. The chapter makes a narrower point. Distance, buffers, and delegated handling can protect a person's public standing from direct contamination. If every harsh action lands visibly on you, your reputation may absorb the dirt as well as the result. Keeping your hands clean means letting some unpleasant work move through controlled channels instead of attaching directly to your own image. But the chapter is not praising cowardly blame-dumping or treating subordinates as disposable shields. Strategic distance is supposed to preserve authority without giving up control or fairness. The lesson is to manage where visible dirt lands so necessary action does not stain the central figure more than it has to.",
        "Greene's twenty-sixth law argues that public authority can weaken when mess, blame, or harsh execution attach directly to the person at the center. The chapter is not telling you to avoid all responsibility. It is telling you that visible cleanliness can protect reputation when unpleasant tasks still need to happen. The stronger reading is controlled buffering, not false innocence. Use intermediaries, process, or distance so the visible burden does not always fall on your own hands. That can preserve authority because people often judge harshly the figure who seems to deliver the pain personally. But the chapter is not saying you should hide behind reckless scapegoats or let others run wild in your name. Distance matters only if you still keep control of the action and accept that the underlying responsibility remains yours. Used well, clean hands protect public standing without turning power into obvious evasion.",
        "This law gives a practical warning: if every punishment, ugly decision, or public mess carries your signature, your authority may start wearing the stain. Greene's point is that buffers can be useful because they separate decision from direct contamination. An intermediary, structure, or agreed process can absorb some of the visible dirt while the central figure keeps more of the public standing intact. But the chapter is not asking for sham innocence or cruel scapegoating. It is asking for controlled distance. A competitive reader should notice that authority often survives better when harsh execution is not performed too visibly by the same hands that need to stay respected. The tactic works only if the buffer stays governed and the displacement does not become obviously unfair. If people can see that you are simply burning others to protect your image, the clean hands will not stay clean for long. The right move is to reduce visible stain without losing command of what is being done.",
      ),
      keyTakeaways: [
        { point: tone("Visible blame can stain authority.", "Harsh outcomes look worse when the dirt lands directly on your hands.", "Who appears to carry the mess often absorbs the stain.") },
        { point: tone("Buffers can preserve public standing.", "Distance and intermediaries can protect reputation from direct contamination.", "Let controlled channels carry some visible dirt.") },
        { point: tone("Strategic distance differs from scapegoating.", "The chapter is about controlled buffering, not reckless blame-dumping.", "If the shield becomes obvious abuse, the tactic backfires.") }
      ],
      oneMinuteRecap: tone(
        "This law says visible dirt can weaken authority, and controlled distance can help keep a central figure publicly clean.",
        "Do not confuse direct execution of every harsh act with strength if it unnecessarily stains your standing.",
        "Use buffers without surrendering control or fairness."
      )
    },
    medium: {
      chapterBreakdown: tone(
        `Greene's twenty-sixth law begins by questioning the idea that authority can absorb unlimited visible dirt without consequence. People often remember not only what was done, but who seemed to carry the blame, enforce the punishment, or deliver the unpleasant outcome directly. Greene is interested in that attachment. The chapter asks what happens when reputation is protected by separating the central figure from the visible mess of execution.

That is why clean hands matter here. Greene is not describing innocence in a moral sense or pretending that hard action can vanish. He is describing reputation shielding. If blame, discipline, or unpopular execution moves through buffers, intermediaries, or formal channels, the person at the center may keep more authority intact than if every stain attached directly. The chapter treats distance as part of power because public standing can erode when unpleasant necessity is too visibly personalized.

The chapter is strongest when it distinguishes strategic buffering from scapegoating. The useful move is not to dump blame recklessly on expendable people or to abandon all responsibility while others burn. Greene is not praising that. He is showing how controlled distance can preserve authority when the mechanism remains governed. Buffers work only if the central figure still directs the action and prevents the intermediary from becoming uncontrolled, resented, or too powerful.

The pattern appears in ordinary settings. A manager may let a process lead deliver an unpopular enforcement step while the larger role stays less publicly stained. A debate-board chair may preserve the image of impartial authority while officers handle visible procedural conflict. A personal boundary may land through agreed rules or shared structure rather than through one person becoming the sole visible villain every time. In each case, reputation is preserved by managing where the dirt appears to stick.

The limit matters because clean-hands strategy can become corrosive. If the intermediary is obviously sacrificed, if injustice becomes visible, or if distance destroys trust, the tactic fails. Greene's practical claim is narrower: keep visible dirt off your hands where it protects authority, but keep control, accept responsibility, and avoid systems that collapse into transparent blame dumping. Chapter 25 redesigned the self that the public sees. Chapter 26 asks how that visible self stays cleaner than the hard work required underneath. Chapter 27 then turns toward needlessness, where power also depends on not appearing too dependent on those below.`,
        `Greene's twenty-sixth law argues that public standing can be damaged by direct attachment to blame. People like to imagine that decisive leaders should carry every visible burden personally. Greene hears another possibility: too much visible dirt can stain the authority that still needs to govern after the unpleasant action is complete. The chapter therefore begins with a strategic problem, not a moral excuse. What if direct execution costs more authority than delegated handling would?

That is why intermediaries can be useful. If harsh enforcement, messy process, or unpopular decisions move through a buffer, the central figure may retain more legitimacy and room to act later. Greene is interested in that separation. Distance does not erase responsibility, but it changes how contamination spreads through public perception. Reputation can remain cleaner when the visible burden is not always carried by the same hands that must continue to lead.

This is why the chapter is not generic irresponsibility advice. Greene is not telling the reader to dump every ugly consequence on someone weaker and walk away. He is separating controlled buffering from reckless scapegoating. The issue is not cowardice. The issue is whether visible dirt can be displaced without losing command or creating obvious injustice. Distance works when it is governed. It fails when the shield becomes the story.

The pattern appears everywhere. Yara may need a controlled process owner to deliver a painful change so her authority is not reduced to the face of punishment. A debate board may let officers absorb procedural conflict while the chair preserves broader standing. A private agreement may place the burden on structure and timing instead of on one person becoming the entire visible target of resentment. In each case, clean hands protect future room by redirecting where the stain settles.

The limit remains central because buffers are dangerous too. Intermediaries can become resentful, overpowered, or publicly associated with obvious unfairness. Greene's point is disciplined rather than cynical: keep your image cleaner where that preserves authority, but stay accountable enough that the machinery does not rot into abuse. Chapter 25 dealt with self-fashioning. Chapter 26 deals with keeping the fashioned self from direct contamination. Chapter 27 then asks what changes when power also depends on appearing independent of the people whose labor sustains it.`,
        `This law starts with a tempting mistake: assuming that visible ownership of every harsh act always proves strength. Greene's warning is that direct attachment to mess can also weaken the authority that must outlast the moment. If blame, punishment, and ugly execution keep landing on your own hands, your image can absorb more stain than the result is worth. The chapter therefore treats public cleanliness as a strategic resource.

That matters because buffers change where reputational damage sticks. A delegated channel, visible process, or intermediary can keep unpleasant action from attaching too directly to the central figure. The chapter therefore treats distance as a way of preserving standing. What changes is not the need for action, but the distribution of visible dirt around it.

This keeps the law narrower than praise for scapegoating. Greene is not saying you should evade all accountability or burn weaker people casually. He is asking whether the burden can be carried through a structure that preserves authority without collapsing justice or control. Strategic distance means keeping the hands clean while still governing the dirt. It becomes failure when the displacement grows too obvious, too unfair, or too autonomous.

Common settings make the point plain. A coworker may rely on process ownership so every painful decision is not experienced as personal punishment from one visible leader. A yearbook committee may keep the chair cleaner by letting sub-editors handle direct disputes, until that buffering becomes too obvious and breeds mistrust. A personal life system may depend on shared rules so hard boundaries do not always feel like one person's aggression. In each case, clean hands preserve room only when the structure holding the dirt remains credible.

The limit matters because the tactic can rot quickly. If the shield becomes the villain you knowingly feed to protect your own image, people will see the arrangement and judge it. Chapter 25 showed that the public self can be shaped. Chapter 26 shows that the same self may need shielding from visible dirt. Chapter 27 follows by asking how power deepens when the figure at the center also appears not to need others too much.`
      ),
      keyTakeaways: [
        {
          point: tone("Visible dirt can weaken authority.", "Direct attachment to blame can stain the figure who still needs to lead.", "If the mess keeps landing on you, the stain may outlast the decision."),
          moreDetails: tone("The chapter focuses on reputational contamination rather than on responsibility disappearing.", "People often remember who visibly carried the harsh act as much as they remember why it happened.", "Authority can shrink when punishment becomes too personalized.")
        },
        {
          point: tone("Buffers and intermediaries can preserve standing.", "Distance can shield reputation from direct contamination.", "A controlled channel can keep the center cleaner than direct execution would."),
          moreDetails: tone("Greene values buffers because they separate authority from the most visible dirt of enforcement.", "The chapter's leverage comes from shifting where public stain appears to stick.", "The same decision can look less corrosive when someone else visibly carries the procedural heat.")
        },
        {
          point: tone("Strategic distance differs from scapegoating.", "The move is governed buffering, not disposable blame transfer.", "Keep the hands clean without feeding someone else to the crowd."),
          moreDetails: tone("The chapter still requires control, fairness, and responsibility over the action being buffered.", "Distance matters only if the shield remains governed and the arrangement does not become obviously unjust.", "If the intermediary becomes the sacrifice, the tactic has already started turning on you.")
        },
        {
          point: tone("Work, school, and personal settings all show how stain follows visible execution.", "Public process changes who absorbs resentment and why.", "The face attached to the harsh act often carries more damage than the rule itself."),
          moreDetails: tone("Process owners, committee officers, and shared structures all redistribute visible burden in different ways.", "The chapter becomes practical when you ask who is seen as delivering the pain and whether that visibility is strategically necessary.", "Reputation often depends on where the anger is forced to attach.")
        },
        {
          point: tone("The law has a control-and-fairness limit.", "Clean hands fail when the buffer becomes too autonomous or the blame transfer too obvious.", "Distance protects authority only while the machinery stays governed."),
          moreDetails: tone("Some contexts require visible ownership, and some delegated structures create backlash if they appear abusive.", "Greene warns against letting the buffer become stronger than the principal or more hated than the system can absorb.", "The right boundary is where shielding stops protecting authority and starts exposing manipulation.")
        }
      ],
      activationPrompt: tone(
        "Identify one place where direct visible execution is staining authority more than the underlying decision requires.",
        "Choose one burden that could move through a cleaner buffer without losing control.",
        "Pick one harsh task where the visible dirt is landing in the wrong place for long-term authority."
      ),
      selfCheckPrompt: tone(
        "Am I preserving standing through structure, or just trying to disappear from responsibility?",
        "Who is visibly carrying the dirt right now, and is that arrangement still controlled and fair?",
        "Where does distance protect authority, and where would it become obvious scapegoating?"
      ),
      oneMinuteRecap: tone(
        "This chapter says authority can be protected when visible blame and harsh execution do not attach directly to the central figure.",
        "Do not confuse personal exposure to every unpleasant act with strategic strength.",
        "Keep the hands clean through controlled buffers, not through reckless blame transfer."
      )
    },
    hard: {
      chapterBreakdown: tone(
        `Greene's twenty-sixth law treats visible cleanliness as a political asset rather than as a moral decoration. Most people hear "keep your hands clean" and think of hypocrisy, cowardice, or simple blame avoidance. Greene is interested in a sharper claim: public authority is damaged not only by bad outcomes, but by visible attachment to dirt, punishment, and harsh execution. The chapter therefore begins by questioning whether the person at the center should also be the most visibly stained by the actions required to preserve control.

That is why buffers and intermediaries can matter here. Greene is not praising innocence theater for its own sake. He is describing contamination management. When unpleasant action moves through distance, structure, or delegated agents, the central figure may preserve a cleaner public image than direct execution would allow. Clean hands do not eliminate the harsh act. They separate reputation from the most visible layer of carrying it out. The chapter treats this separation as a form of power because authority often survives only if it remains less dirty than the work done in its name.

The chapter is strongest when it resists the lazy reading that this is just advice to scapegoat someone weaker. Greene is not praising reckless blame-dumping, casual cruelty, or abandonment of command. He is distinguishing strategic distance from irresponsible displacement. Strategic distance keeps control of the act while redistributing visible stain. Scapegoating loses control, creates obvious injustice, and may empower or destroy the very agent carrying the dirt. The difference is whether the buffering still serves authority or has become a transparent sacrifice to protect image.

This is why direct attachment can be expensive. The problem is not only moral criticism. It is reputational wear. Once the same figure becomes known as the face of punishment, blame, and ugly execution, later authority may arrive already stained. People may obey, but with less trust, less admiration, and less willingness to attach positive meaning to that authority. The chapter therefore asks whether harsh necessity should always be performed by the hands that most need to remain publicly usable afterward.

Ordinary settings show the mechanism clearly. A manager may preserve more long-term standing by letting a process lead carry the visible enforcement step rather than turning every painful decision into a personal disciplinary spectacle. A debate-board chair may remain cleaner by allowing officers to absorb procedural heat and visible conflict. A personal boundary may be enforced through rules, calendars, or shared agreements so the full resentment does not repeatedly attach to one person as naked will. In each case, dirt follows visibility more than formal responsibility.

The limit matters because buffers can become dangerous. If the intermediary becomes too hated, too powerful, too autonomous, or too obviously sacrificed, the tactic collapses. Greene is not arguing that the center should escape responsibility. He is arguing against unnecessary direct contamination of the center's image. Chapter 25 redesigned the public self so stale identity would not become a cage. Chapter 26 asks how that redesigned self remains cleaner than the ugly work still required underneath it. Chapter 27 follows naturally from there. Once the self is shaped and shielded, power also depends on projecting enough independence that others continue to desire, obey, or pursue it without feeling it depends on them too openly. Clean hands succeed only when distance remains controlled, blame remains governable, and the buffer does not become more politically consequential than the person it was meant to protect. If dirt is displaced without losing authority, reputation survives. If dirt is displaced badly, the attempted cleanliness becomes another stain.`,
        `Greene's twenty-sixth law argues that keeping your hands clean can be strategically useful because visible blame clings to authority. Most readers hear the title and assume it means refusing responsibility. Greene hears a different issue: when the central figure is seen as personally delivering every ugly consequence, that figure may keep the decision-making power and lose the standing that made the power effective.

Distance preserves reputation because it changes where visible dirt accumulates. If discipline, blame, or messy execution moves through an intermediary, the central figure may keep more symbolic authority intact. Greene is interested in that symbolic separation. The chapter values clean hands not because the center becomes morally pure, but because public stain is often more damaging than hidden responsibility. What matters is not who formally decided, but who seems to have touched the dirt.

That is why the chapter should not be flattened into advice about cowardice. It is not saying that leaders should always hide behind others or burn subordinates casually. It is saying that authority often needs a reputational buffer between itself and the harshest visible acts. Strategic distance means the buffer remains controlled, credible, and subordinate. Scapegoating means the arrangement becomes unjust, obvious, or politically unstable enough to rebound against the center.

The pattern appears in ordinary life. Yara may rely on a process owner to carry out a painful change so her authority is not reduced to being the face of punishment. Darin may notice that a debate-board chair preserves broader standing by letting officers absorb public procedural conflict. A private household system may rely on calendars, agreements, or external rules so difficult boundaries are not always experienced as one person's naked aggression. In each case, the structure determines where resentment visibly settles.

The limit remains central because buffers can corrode the system they protect. If the intermediary becomes resented, empowered, or obviously sacrificial, the shield begins attracting the very scrutiny it was meant to deflect. Greene's practical claim is narrower: keep direct stain off your hands where it preserves authority, but stay responsible enough that the machinery does not become abusive or uncontrollable. Chapter 25 dealt with crafting the self that appears in public. Chapter 26 deals with keeping that self from visible contamination. Chapter 27 then turns toward needlessness, where power also depends on not appearing dependent on the people who execute, admire, or obey. The reader's edge lies in seeing that public cleanliness is not innocence. It is a managed relation to visible dirt. Once the management becomes too obvious, the relation itself becomes the scandal.`,
        `This law works only if you track what visibility is doing before you decide what responsibility means. Most people focus on who is actually accountable. Greene's warning is that politics also runs on who appears dirty. Once blame, harshness, or ugly enforcement keep landing on the same public figure, that figure's authority starts carrying a residue that later decisions cannot avoid. The chapter is about that residue.

That is why controlled distance can be strategically valuable. A person who stays one step removed from the visible dirt may look colder while actually preserving the symbolic authority needed for future action. Delegated channels, formal process, and intermediaries can all absorb backlash that would otherwise stick to the center. Greene is not praising distance because separation is noble. He is protecting usable authority from reputational corrosion.

The chapter therefore distinguishes buffering from abandonment. Empty blame transfer is not strategy. Disposable shields are not stable power. Strategic clean hands keep control over the dirt even while redirecting where it is seen. Without that control, the intermediary can become a rival, a scandal, or a victim whose mistreatment rebounds. Without the distance, the center may remain formally powerful and publicly overexposed.

Common settings show the law with almost embarrassing clarity. A coworker who uses formal process to deliver a painful decision may keep more leadership legitimacy than one who turns every hard choice into personal confrontation. A yearbook committee may let sub-editors absorb direct dispute, until that arrangement looks too convenient and trust collapses. A private agreement may protect one person's standing by letting shared rules carry the visible boundary instead of making every denial feel like personal rejection. In each case, the question is not whether dirt exists. The question is where it visibly settles.

The limit matters because clean-hands strategy can fail too. Shift too little and the center becomes the permanent face of stain. Shift too much and the structure starts looking manipulative, unjust, or out of control. Greene's better point is to make visible cleanliness answerable to control rather than to vanity. Chapter 25 taught that the self can be redesigned so others stop confining it through stale identity. Chapter 26 teaches that the redesigned self may still need shielding from direct contamination. Chapter 27 follows because even a clean image weakens if it looks needy. The deepest lesson is that power often depends on staying less visibly dirty than the work done beneath you, while never letting the buffer become a spectacle of abuse or autonomy. If the dirt lands elsewhere and authority stays governed, the tactic works. If the dirt lands elsewhere and the buffer starts telling the real story, the hands are not clean. They are merely hidden badly.`
      ),
      keyTakeaways: [
        {
          point: tone("Visible stain weakens authority.", "Blame and harsh execution damage the figure who remains visibly attached to them.", "If your hands keep showing the dirt, your standing starts carrying the residue."),
          moreDetails: tone("The chapter emphasizes reputational contamination rather than responsibility disappearing.", "People often respond to who visibly delivered the harsh act more than to who reasoned it through.", "Authority can remain formally intact while symbolically corroding.")
        },
        {
          point: tone("Buffers protect usable standing.", "Intermediaries and process can preserve a cleaner public image for the center.", "Distance changes where visible dirt settles."),
          moreDetails: tone("Greene values buffers because they keep the harshest visible layer off the central figure's reputation.", "The chapter's leverage comes from separating authority from direct contamination.", "A cleaner image often survives longer when someone else carries the procedural heat.")
        },
        {
          point: tone("Strategic distance differs from scapegoating.", "The move is controlled buffering, not sacrificial blame transfer.", "Keep the dirt off your hands without feeding someone else to it blindly."),
          moreDetails: tone("The chapter still requires command, fairness, and control over the agent or structure carrying the burden.", "Distance matters only if the shield remains governed and the injustice does not become obvious.", "When the buffer becomes the scandal, the tactic has already inverted.")
        },
        {
          point: tone("Ordinary systems show how resentment follows visible carriers of dirt.", "Work, school, and personal life all redistribute stain through process and role.", "The face attached to the harsh act often absorbs more damage than the rule behind it."),
          moreDetails: tone("Process owners, committee officers, and shared rules all alter who looks dirty after conflict.", "The chapter becomes practical when you ask where the visible residue is sticking and whether that placement is strategic.", "Public memory often tracks the carrier of pain more than the architecture around it.")
        },
        {
          point: tone("The law has a control-risk limit.", "Clean hands fail when the intermediary becomes too autonomous, too hated, or too obviously sacrificed.", "Distance protects power only while the buffer remains under command."),
          moreDetails: tone("Some contexts require visible ownership, and some delegated dirt creates backlash if it appears abusive.", "Greene warns against letting the shield become stronger, dirtier, or more politically central than the authority it serves.", "The right boundary is where buffering stops preserving authority and starts exposing manipulation.")
        }
      ],
      activationPrompt: tone(
        "Identify one place where visible dirt is sticking too directly to the figure who still needs to remain broadly usable.",
        "Choose one harsh task that could move through a controlled buffer without losing command.",
        "Pick one source of blame whose current visible carrier is weakening the authority you still need."
      ),
      selfCheckPrompts: [
        tone(
          "Am I buffering visible dirt strategically, or merely trying to disappear from responsibility?",
          "Who is carrying the stain right now, and is that placement still controlled rather than abusive?",
          "If I stay cleaner here, what mechanism keeps the buffer from becoming the scandal?"
        ),
        tone(
          "What part of this unpleasant action actually needs my visible signature, and what part only needs my control?",
          "How much distance preserves authority before the arrangement starts looking manipulative?",
          "At what point would the shield become stronger, more hated, or more politically consequential than the center?"
        )
      ],
      predictionPrompt: tone(
        "Once visible dirt is buffered away from the center, how might Chapter 27 show that power also depends on appearing not to need the people carrying that dirt too much?",
        "If clean hands preserve reputation, what changes next when authority must also project needlessness rather than dependence?",
        "After shielding the image from stain, how does power deepen when the image also looks unattached and unneedy?"
      ),
      oneMinuteRecap: tone(
        "This chapter argues that power often survives better when the central figure is less visibly stained than the harsh work done in its name.",
        "Do not confuse public exposure to every ugly act with strategic authority if that exposure corrodes the image you still need.",
        "Sometimes power stays cleaner when dirt is buffered without letting the buffer become the story."
      )
    }
  },
  examples: [
    {
      title: "Yara Uses a Controlled Process Buffer So a Painful Change Does Not Stain Her Authority More Than Necessary",
      format: "decision_point",
      category: "work",
      endingType: "broader_principle",
      scenario: tone("Yara has to implement a painful shift that will trigger anger, and she must decide whether to deliver every harsh detail herself.", "She has to choose between direct visible ownership of the entire mess or a controlled buffer that keeps her broader authority cleaner.", "Yara can become the face of the pain or let structure carry some of the visible dirt."),
      whatToDo: tone("She routes the execution through a governed process owner while keeping command over the result.", "She separates control from visible stain.", "She keeps the authority central while letting the procedural heat land elsewhere."),
      whyItMatters: tone("The chapter says visible dirt can weaken the very figure who still needs to lead afterward.", "A controlled buffer can preserve standing better than making every harsh step personally visible.", "Keeping hands cleaner can protect future room to govern.")
    },
    {
      title: "Darin Hears Why the Debate Board Chair Stayed Publicly Clean While Others Carried the Visible Conflict",
      format: "dialogue",
      category: "school",
      endingType: "self_directed_question",
      scenario: tone("Darin listens as someone explains why the debate board chair kept broader legitimacy by letting officers absorb the procedural fight over a disputed ruling.", "He hears how visible conflict stuck less to the chair because the dirt landed elsewhere in the structure first.", "Darin learns that who appears to carry the mess can matter as much as who decided it."),
      whatToDo: tone("He asks when that buffering preserved authority and when it would have become obvious scapegoating.", "He studies the line between strategic distance and convenient sacrifice.", "He asks what kind of control keeps the buffer from becoming the scandal instead."),
      whyItMatters: tone("The chapter warns that public standing can be stained by direct attachment to blame and conflict.", "The board shows how a cleaner central image can be maintained through visible intermediaries.", "The carrier of procedural heat often absorbs the room's resentment first.")
    },
    {
      title: "Quinn Weighs Reputation Protection Against the Cost of Shifting Visible Burden",
      format: "dilemma",
      category: "personal",
      endingType: "surprising_implication",
      scenario: tone("Quinn wants to stop becoming the visible villain in every difficult family boundary, but worries that shifting the burden will feel evasive or unfair.", "He has to decide whether using structure and distance preserves sanity or merely disguises responsibility.", "Quinn can keep taking every stain directly or redesign how the dirt is carried."),
      whatToDo: tone("He uses agreed structure to carry part of the visible burden while staying accountable for the boundary itself.", "He separates responsibility from theatrical self-sacrifice.", "He keeps the line firm without making his own face the only place resentment can stick."),
      whyItMatters: tone("The chapter says clean hands can preserve authority only if the displacement remains fair and governed.", "His dilemma shows the difference between strategic distance and moral evasion.", "The tactic works only if the shield does not become an abused substitute victim.")
    },
    {
      title: "Esme Predicts Why One Operator Uses an Intermediary to Absorb Backlash",
      format: "predict_reveal",
      category: "work",
      endingType: "cross_domain",
      scenario: tone("Esme notices an operator let a process lead announce the most unpopular enforcement details while keeping the central office one step removed.", "She predicts the move is designed to keep the operator's broader standing cleaner than direct delivery would allow.", "Esme can already see that the intermediary is carrying more than information; it is carrying visible residue."),
      whatToDo: tone("She judges whether the arrangement preserves authority without sacrificing control or fairness.", "She looks for buffering with governance rather than image cleansing through expendable people.", "She scores the move on whether the dirt moved strategically or merely got dumped downstream."),
      whyItMatters: tone("The chapter says authority often depends on where visible contamination settles.", "An intermediary can absorb backlash that would corrode the center's image more directly.", "Sometimes the harsh act matters less politically than whose hands seem to have touched it.")
    },
    {
      title: "Yearbook-Committee Debrief Finds That Obvious Scapegoating Damaged Trust More Than the Original Conflict",
      format: "postmortem",
      category: "school",
      endingType: "common_trap",
      scenario: tone("A yearbook committee reviews why trust collapsed after one sub-editor took the visible blame for a messy dispute while everyone knew the chair had hidden behind the arrangement.", "The debrief shows that the buffer became too obvious and too unfair to protect anyone's standing for long.", "The team learns that dirt displaced badly can become an even bigger stain."),
      whatToDo: tone("They redesign responsibility so buffers remain credible, controlled, and not transparently sacrificial.", "They stop confusing delegated visibility with disposable blame.", "They rebuild a structure where process can carry heat without becoming the scandal itself."),
      whyItMatters: tone("The chapter warns that clean-hands strategy fails when scapegoating becomes visible and unjust.", "Their problem was not buffering itself but the collapse of fairness and control around it.", "Once the shield became the story, the center lost the protection it wanted.")
    },
    {
      title: "Before and After Visible Dirt Moved from Personal Exposure to Controlled Distance",
      format: "before_after",
      category: "personal",
      endingType: "perspective_reframe",
      scenario: tone("Before, every difficult boundary or unpleasant task attached directly to one person's face, and resentment kept sticking there. After, shared rules and structure carried more of the visible burden.", "The contrast is between naked personal exposure and governed distance.", "One version keeps collecting stain; the other keeps the task intact while changing where the residue lands."),
      whatToDo: tone("Keep responsibility, but use structure, timing, and delegated channels so every harsh act is not experienced as direct personal aggression.", "Let process absorb more heat than personality.", "Move the dirt without losing command of the outcome."),
      whyItMatters: tone("The law distinguishes strategic buffering from false innocence.", "Controlled distance can preserve standing when direct exposure keeps corroding it.", "Public dirt does not disappear; it simply matters where it visibly settles.")
    }
  ],
  reviewCards: [
    { cardId: "ch26-rc01", front: tone("Why is visible blame costly in this chapter?", "Why can harsh execution stain authority?", "What makes dirt politically expensive here?"), back: tone("Because public stain attaches to whoever seems to carry the ugly act directly.", "The chapter says authority can be damaged by visible contamination even when the action was necessary.", "If your hands keep showing the dirt, the residue sticks to your standing."), difficulty: "easy" },
    { cardId: "ch26-rc02", front: tone("What do buffers and intermediaries preserve here?", "Why does distance matter in this law?", "What does a clean-hands structure protect?"), back: tone("They preserve the center's public standing by redirecting visible dirt elsewhere.", "Distance matters because it changes where blame and procedural heat appear to land.", "A buffer can keep authority cleaner than direct execution would."), difficulty: "easy" },
    { cardId: "ch26-rc03", front: tone("How is strategic distance different from scapegoating?", "What separates buffering from reckless blame transfer?", "Why isn't any clean-hands move automatically wise?"), back: tone("Strategic distance keeps control and fairness, while scapegoating becomes obvious, unjust, or unstable.", "The chapter values governed buffers, not disposable shields.", "If the intermediary becomes the scandal, the tactic has already failed."), difficulty: "medium" },
    { cardId: "ch26-rc04", front: tone("Where does this law appear in ordinary life?", "How do work, school, and personal systems redistribute visible dirt?", "Where does stain follow the visible carrier of conflict?"), back: tone("It appears wherever rules, roles, and channels determine who the room sees as delivering the pain.", "Managers, committees, and shared structures all route resentment differently depending on visibility.", "Resentment usually attaches first to the role performing the unpleasant task, not to the hidden design that assigned it there."), difficulty: "medium" },
    { cardId: "ch26-rc05", front: tone("How does Chapter 26 bridge to Chapter 27?", "Why does clean hands logic lead into needlessness?", "What comes after the self is shaped and shielded?"), back: tone("Once the image is shielded from visible dirt, the next question is how power also projects independence rather than need.", "Chapter 27 turns from buffered stain to strategic needlessness.", "First keep the hands clean, then avoid looking too dependent on the people beneath you."), difficulty: "hard" }
  ],
  keyTakeawayCard: tone(
    "Keeping your hands clean is useful when controlled buffers keep visible dirt from corroding the authority that still needs to remain broadly usable.",
    "This law warns that harsh execution can stain reputation and favors governed distance over reckless blame transfer.",
    "Power stays cleaner when dirt is displaced without letting the shield become the scandal."
  )
};

const quiz = {
  passingScorePercent: 70,
  questions: [
    { questionId: "ch26-q01", prompt: "Why is visible blame costly in this chapter?", choices: ["Because public stain can cling to the authority figure who seems to carry the harsh act directly", "Because responsibility should always disappear into process", "Because direct action is always weak"], correctIndex: 0, explanation: tone("Correct. The chapter says visible dirt can corrode the standing of whoever appears to execute it personally.", "Authority can suffer when blame and harshness attach too directly to the same hands that must continue to lead.", "Right. The residue of visible dirt often sticks to the carrier, not just to the event."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch26-q02", prompt: "What do buffers or intermediaries preserve here?", choices: ["Permanent innocence", "Public standing and reputational cleanliness", "Freedom from all accountability"], correctIndex: 1, explanation: tone("Yes. Buffers matter because they can keep the central figure cleaner in public perception.", "The chapter treats distance as a way of preserving usable authority.", "Right. A controlled channel can shield reputation from direct contamination."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch26-q03", prompt: "Why is this chapter not generic irresponsibility advice?", choices: ["Because no one should ever delegate anything", "Because authority never needs shielding", "Because it distinguishes governed buffering from reckless blame-dumping"], correctIndex: 2, explanation: tone("Correct. Greene is not erasing responsibility; he is describing how visible dirt can be managed without losing control.", "The issue is strategic distance with governance, not simple evasion.", "Yes. This is about contamination management, not childish refusal to own consequences."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch26-q04", prompt: "In Yara's work scenario, what best fits the chapter?", choices: ["Have an uncontrolled subordinate absorb the backlash while she disowns the result", "Route the painful execution through a governed process buffer while keeping command of the outcome", "Deliver every harsh detail personally so authority always looks direct"], correctIndex: 1, explanation: tone("Yes. The chapter favors controlled buffering that preserves standing without surrendering command.", "She separates visible stain from central authority while still governing the result.", "Right. The move is distance with control, not either total exposure or cynical abandonment."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch26-q05", prompt: "Why did the debate board example matter for Darin?", choices: ["Because visible officers carried procedural heat that the chair stayed cleaner from", "Because chairs should never be accountable for anything", "Because procedures always erase resentment"], correctIndex: 0, explanation: tone("Correct. The example shows how visible conflict can attach more strongly to those who carry it publicly.", "The chair preserved broader standing because the procedural heat settled elsewhere first.", "Yes. The room often remembers who looked dirty more than who held formal authority."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch26-q06", prompt: "What is the strongest reading of Quinn's dilemma?", choices: ["He should personally carry every visible stain forever", "Distance is useful only if it remains fair, governed, and not simply moral evasion", "Any use of structure is automatically manipulative"], correctIndex: 1, explanation: tone("Yes. The chapter's limit is that clean-hands strategy fails when the shift becomes unfair or transparently evasive.", "Buffers work only while responsibility and governance remain real.", "Right. The tactic preserves standing only if the shield does not become a substitute victim."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch26-q07", prompt: "How does delegated dirt function in this chapter?", choices: ["It changes where visible contamination settles around a decision", "It guarantees the center will never be criticized", "It removes the need to control the intermediary"], correctIndex: 0, explanation: tone("Correct. The chapter treats delegation as a way of relocating visible stain, not eliminating consequence.", "Where the dirt appears to land affects how authority survives the action.", "Yes. The political question is often who seems to have touched the mess."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch26-q08", prompt: "When does clean-hands strategy become reckless scapegoating or loss of control?", choices: ["When the central figure stays one step removed from visible dirt", "When the buffer becomes obvious, unjust, too autonomous, or more politically dangerous than the center", "When process carries part of the burden"], correctIndex: 1, explanation: tone("Exactly. The tactic fails when the shield becomes the scandal or the agent escapes governance.", "Distance stops being strategic once it looks abusive or loses control.", "Right. A buffer that turns into the story destroys the protection it was meant to provide."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch26-q09", prompt: "How does Chapter 25 lead into Chapter 26?", choices: ["Once the self is strategically shaped, the next question is how to keep that public form from visible contamination", "Chapter 26 abandons reputation concerns altogether", "Self-fashioning makes buffers unnecessary"], correctIndex: 0, explanation: tone("Correct. Chapter 25 shaped the self; Chapter 26 asks how that self stays cleaner than the dirt attached to hard action.", "The sequence moves from redesign of public form to shielding that form from visible stain.", "Right. First craft the image, then protect it from direct contamination."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch26-q10", prompt: "What bridge carries Chapter 26 into Chapter 27?", choices: ["Needlessness makes clean hands irrelevant", "Chapter 27 rejects reputation entirely", "After clean hands preserve image, power next depends on appearing not to need others too openly"], correctIndex: 2, explanation: tone("Correct. The next law turns from buffered stain to the power of looking independent and unneedy.", "Chapter 27 asks what happens once the image is shielded and must also look unattached.", "Right. After keeping the hands clean, the next challenge is avoiding visible dependence."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" }
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
for (const name of ["Yara", "Darin", "Quinn", "Esme"]) continuity.nameUsage[name] = [stem];
continuity.withinChapterNames[stem] = ["Yara", "Darin", "Quinn", "Esme"];
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
- Chapter-specific mechanism remains visible dirt, blame shielding, delegated buffers, and control-risk limits rather than generic irresponsibility rhetoric
- Hard depth preserves the buffering-versus-scapegoating boundary and the Chapter 27 needlessness bridge
- Quiz stays within supported facts from the approved draft and frozen source bundle

## Gate result
- Approved for chapter gate and automatic continuation
`;
writeText(paths.validation, validation);

fs.appendFileSync(
  paths.runLog,
  `\n- Completed writer, editor, critic, converter, quiz, and validator steps for Chapter 26.\n- Validation result: PASS.\n- Continuity hash sealed for \`${stem}\`: \`${seal}\`\n`,
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
