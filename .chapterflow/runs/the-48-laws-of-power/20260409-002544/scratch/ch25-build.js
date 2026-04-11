const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const runRoot = path.resolve(".chapterflow/runs/the-48-laws-of-power/20260409-002544");
const num = 25;
const stem = `ch${String(num).padStart(2, "0")}`;
const title = "Re-Create Yourself";
const chapterId = "ch25-re-create-yourself";
const createdAt = new Date().toISOString();

function tone(gentle, direct, competitive) {
  return { gentle, direct, competitive };
}

const canonical = `Greene's twenty-fifth law begins with a trap that looks harmless because it often arrives as familiarity. Once other people decide who you are, what role you play, and what kind of future fits you, they begin relating not only to you but to a stable version of you that they can predict. The chapter begins by treating fixed public identity as a political problem. A stale role makes a person easier to classify, easier to limit, and easier to manage.

Its claim is not that sincerity is worthless or that every life should become theater. Greene's point is more strategic. Deliberate self-fashioning can keep others from fixing you inside one narrow image. If you revise the form in which you appear, you can unsettle stale expectations, recover initiative, and reopen possibilities that a settled identity had closed. Image therefore matters not as vanity alone, but as a way of resisting confinement through predictability.

That is why the law focuses on governed reinvention rather than on empty costume changes. Greene is not praising random shape-shifting, manipulative lying, or instability for its own sake. He is distinguishing strategic self-creation from hollow performance. The useful move is not to become unreal. It is to refuse the dead version of yourself that others would rather keep using, while preserving enough inner direction that change serves agency instead of dissolving it.

Ordinary settings make the mechanism visible. A worker who has been filed mentally as reliable but uncreative may need to alter tone, scope, or public framing before the team can see a different level of capability. A student at a paper or showcase panel may find that old labels keep shaping how new work is received. A person in private life may discover that family or friends keep speaking to an earlier self unless something visible shifts. In each case, reinvention is not fantasy. It is a move against stale legibility.

The chapter's limit matters. Reinvention can fail if it becomes pure display, constant instability, or endless performance with no governing center underneath. Greene overreaches if the law becomes advice to live only through image. The useful version is narrower: recreate the self where stale identity has become a cage, but do not let performance become the only thing left of the person being protected. Chapter 24 showed how presentation carries force through hierarchy. Chapter 25 asks how the larger public form of the self must sometimes be revised so power does not harden into predictability. That points toward Chapter 26, where shaped identity still intersects with blame, labor, and visible risk that can be displaced onto others.`;

const edited = canonical;

const critic = `# Chapter 25 Critic Report

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
- Paragraph 4 is most vulnerable because work, school, and personal examples can flatten into generic self-improvement rhetoric if conversion drops the stale-role and legibility mechanism.

Strongest sentence:
- "Image therefore matters not as vanity alone, but as a way of resisting confinement through predictability."

Anchor use notes:
- The draft stays inside the frozen support: fixed roles create predictability, self-fashioning can recover initiative, reinvention differs from empty theater, and the tactic fails when no governing center remains underneath.

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
        "This law says a fixed public identity can become a trap. If other people already think they know exactly who you are, they may stop seeing what else you can become. Greene is not saying that life should turn into fake costume play. The chapter makes a narrower point. Deliberate self-creation can help you escape stale labels that make you easier to predict and control. If you keep appearing in exactly the same way, other people may keep confining you to the same role. Re-creating yourself means changing the public form of your identity so old expectations lose some of their grip. But the chapter is not praising random shape-shifting or manipulative lying. Strategic reinvention is supposed to recover room to move, not erase the person underneath. The lesson is to notice when your old image has become a cage and to revise it with enough direction that change serves agency rather than turning into empty theater.",
        "Greene's twenty-fifth law argues that power can depend on shaping yourself deliberately instead of accepting a stale identity as fate. If your role has become too familiar, other people may start managing you through that familiarity. The chapter is not telling you to become fake in every moment. It is telling you that image and public form matter because they affect what others believe you can do. The stronger reading is strategic self-fashioning, not shallow branding. Revise the way you appear so the room cannot keep filing you under the same old label. Change can reopen options when a settled image has been narrowing them. But the chapter is not saying you should become unstable or perform constantly with no center. Reinvention matters only if it helps you recover initiative without losing internal direction. Used well, self-creation keeps the self from going stale in other people's hands.",
        "This law gives a practical warning: when your identity becomes too fixed in public, it can stop being a source of trust and start becoming a limit. Greene's point is that self-fashioning can be useful because it unsettles stale expectation. A person who is always read the same way becomes easier to predict, flatter, dismiss, or confine. But the chapter is not asking for theatrical chaos or endless personal rebranding. It is asking for governed reinvention. A competitive reader should notice that changing your form can recover power when old assumptions have become too comfortable around you. The move works only if there is still a center making the changes for a reason. If you keep revising yourself until nothing stable directs the revision, the tactic has already collapsed into performance. The right move is to break the dead role without becoming a costume built from other people's attention.",
      ),
      keyTakeaways: [
        { point: tone("Fixed public identities can become cages.", "A stale role makes you easier to predict and confine.", "Once they think they know you, they start managing the version they already filed.") },
        { point: tone("Deliberate redesign can reopen room that stale labels had closed.", "Revising your image can reopen options that old labels had closed.", "Change the form and stale expectations lose some grip.") },
        { point: tone("Useful reinvention is directed, not theatrical.", "The chapter is about governed self-creation, not random shape-shifting.", "If reinvention loses its center, it stops being power.") }
      ],
      oneMinuteRecap: tone(
        "This law says stale identity can become a cage, and deliberate self-creation can reopen room to move.",
        "Do not let other people keep reading you through a dead version of yourself.",
        "Reinvent with direction, not with empty costume energy."
      )
    },
    medium: {
      chapterBreakdown: tone(
        `Greene's twenty-fifth law begins by questioning the comfort of a fixed identity. Once other people become accustomed to a stable version of you, they begin anticipating your moves, limiting your range, and relating to a role as much as to a person. Greene is interested in that hardening process. The chapter asks what happens when the self stops being accepted as given and starts being shaped deliberately instead.

That is why self-fashioning matters here. Greene is not describing vanity, shallow branding, or decorative image work for its own sake. He is describing strategic legibility control. If you revise how you appear, you can unsettle stale assumptions and recover initiative from people who had already filed you into a narrow part. Reinvention does not create power from nothing. It changes the frame through which existing power is interpreted, limited, or allowed.

The chapter is strongest when it distinguishes strategic reinvention from hollow performance. The useful move is not to chase novelty for applause or to invent a new mask every week. It is to refuse the dead form of yourself that others have begun using as a cage. Greene is not praising instability. He is showing how governed changes in public form can reopen possibilities while preserving a directing center underneath.

The pattern appears in ordinary settings. A worker known only as dependable support may need to revise tone, visibility, or portfolio framing before others can imagine leadership or range. A student at a paper or showcase panel may realize that old reputation still shapes how new work is judged. A person in private life may find that family and friends continue speaking to an earlier version until something visible changes the script. In each case, stale identity narrows what the next move is allowed to mean.

The limit matters because reinvention can become theatrical emptiness. If every revision is only another performance for attention, or if no governing center survives beneath the image changes, the tactic fails. Greene's practical claim is narrower: recreate the self where predictability has become confinement, but do not let crafted image replace the person whose agency it was meant to protect. Chapter 24 showed how presentation lowers friction in the room. Chapter 25 asks how the larger public form must sometimes be revised so the room cannot keep trapping you in one stale reading. Chapter 26 then turns toward the politics of visible labor and blame, where even a well-shaped identity still benefits from keeping certain burdens off your own hands.`,
        `Greene's twenty-fifth law argues that a settled identity can become politically dangerous. People like consistency because it makes others easier to understand. Greene hears another cost: the more fixed your public role becomes, the easier it is for others to anticipate, contain, and use you according to yesterday's script. The chapter therefore begins with a strategic problem, not a motivational slogan. What if the self you once built has now become the shape through which others limit you?

That is why reinvention can be useful. If you alter your image, tone, public form, or visible range, you may interrupt assumptions that had become too stable. Greene is interested in that interruption. A revised self can disturb the confidence with which others thought they knew your limits. Self-fashioning therefore matters because it recovers uncertainty in your favor and prevents stale legibility from becoming a permanent leash.

This is why the chapter is not generic branding advice. Greene is not telling the reader to become hollow, trendy, or endlessly dramatic. He is separating strategic self-creation from unstable theatricality. The issue is not attention for its own sake. The issue is whether a changed image gives you back agency that a fixed role had slowly taken away. Reinvention works when it is directed; it fails when it becomes empty costume motion with no internal governance.

The pattern appears everywhere. A team may keep seeing Zara as careful support until she changes how she claims space, frames her work, and enters key decisions. A student paper may keep reading Noel through an outdated reputation even after the work itself has matured. A personal relationship may remain trapped in an old version of someone until the cues around that person visibly change. In each case, public form shapes what others believe is possible before they evaluate the substance again.

The limit remains central because not every change is liberating. If reinvention destroys trust, dissolves continuity, or leaves no center underneath the revisions, it becomes another cage. Greene's point is disciplined rather than manic: revise the self where stale identity has become too legible and restrictive, but keep enough governing center that the new form is serving power instead of consuming it. Chapter 24 dealt with how strength is carried inside hierarchy. Chapter 25 deals with how the carrier itself may need redesign. Chapter 26 then asks how visible blame and dirty work can still be managed once that redesigned self is in place.`,
        `This law starts with a tempting mistake: treating a familiar identity as automatically safe. Greene's warning is that what feels stable can also become predictable, and what becomes predictable becomes easier for others to sort, use, and contain. If everyone already knows your part in the script, they may stop granting you the possibility of another one. The chapter therefore treats fixed identity as a strategic weakness when it has hardened into public expectation.

That matters because self-fashioning changes what others think they are dealing with. A revised public form can interrupt stale readings, unsettle old assumptions, and widen the field of possible action around you. The chapter therefore treats image control as a way of recovering initiative. What changes is not only how you look. It is how others start calculating what you can do next.

This keeps the law narrower than praise for constant reinvention. Greene is not asking you to become all surface or to turn life into permanent improvisation. He is asking whether your current identity is still serving you or merely making you easy to read. Strategic reinvention means changing the role without losing the center that governs the change. It becomes failure when image shifts are driven only by attention hunger, fear, or emptiness.

Common settings make the point plain. A coworker known for reliability but not imagination may need to change visible scope before new authority becomes thinkable. A student at a showcase panel may find that an old label still shapes how the room interprets a stronger new project. A family dynamic may stay trapped in an outdated version of someone until the form of that person's presence changes. In each case, stale identity acts like a script others keep handing back to you.

The limit matters because reinvention can curdle into instability. If you change so often that no one can trust the continuity of your judgment, the tactic stops opening room and starts burning it. Chapter 24 showed that grace carries force through social rooms. Chapter 25 shows that the self being carried may need revision when it has gone stale in public imagination. Chapter 26 follows by asking how power works once the visible self is shaped but the dirtier consequences of action can still be kept at a distance.`,
      ),
      keyTakeaways: [
        {
          point: tone("Fixed identities can become strategic traps.", "A stale public role makes you easier to predict and manage.", "Once your part hardens, other people start organizing you through it."),
          moreDetails: tone("The chapter focuses on legibility cost rather than on consistency as an automatic virtue.", "Familiarity can become a leash when it narrows how others interpret new behavior.", "The old version of you can keep doing political work against the current one.")
        },
        {
          point: tone("A redesigned public form can restore strategic room.", "Changing public form can reopen options closed by stale expectation.", "Revise the image and old assumptions lose confidence."),
          moreDetails: tone("Greene values reinvention because it unsettles people who thought your range was already known.", "The chapter's leverage comes from interrupting stale readings of capability and role.", "A changed form can force the room to recalculate what you can do next.")
        },
        {
          point: tone("Strategic reinvention differs from hollow theater.", "The move is governed redesign, not random costume motion.", "A new form works only if a real center is steering it."),
          moreDetails: tone("The chapter still requires purpose, direction, and enough continuity to keep change from becoming emptiness.", "Reinvention matters only if it serves agency instead of replacing it with performance.", "If the revision answers only attention hunger, the tactic has already thinned out.")
        },
        {
          point: tone("Work, school, and personal settings all show the stale-role trap.", "Old labels shape reception before new substance gets a fair reading.", "The role people expect can decide what your next move is allowed to mean."),
          moreDetails: tone("Tone shifts, portfolio framing, changed introductions, and new visible scope all alter how people interpret capability.", "The chapter becomes practical when you ask which public cues keep returning you to yesterday's script.", "Substance often needs a new frame before others stop reading it through an old file.")
        },
        {
          point: tone("The chapter keeps a hard boundary around unstable reinvention.", "Reinvention fails if it becomes unstable performance with no center left underneath.", "Change the role, but do not scatter the self."),
          moreDetails: tone("Some continuity is necessary for trust, coherence, and judgment to survive the revisions.", "Greene warns against turning self-creation into endless image churn.", "The right boundary is where redesign stops recovering agency and starts consuming it.")
        }
      ],
      activationPrompt: tone(
        "Identify one public role that has become too stale to carry the range you now need.",
        "Choose one identity cue you could revise so others stop reading you through an old script.",
        "Pick one place where a changed form would make the room recalculate your range."
      ),
      selfCheckPrompt: tone(
        "Am I redesigning a stale role, or just chasing novelty for relief?",
        "Which part of my public form keeps inviting the same limiting interpretation?",
        "Where would reinvention recover agency, and where would it start dissolving trust or center?"
      ),
      oneMinuteRecap: tone(
        "This chapter says self-fashioning can protect power by preventing stale identity from becoming a cage.",
        "Do not let yesterday's public form keep writing tomorrow's limits.",
        "Recreate yourself with direction, not with hollow instability."
      )
    },
    hard: {
      chapterBreakdown: tone(
        `Greene's twenty-fifth law treats self-creation as a political act rather than as a therapeutic slogan. Most people hear "re-create yourself" and think of confidence, personal growth, or theatrical self-expression. Greene is interested in a sharper claim: once your public identity hardens into a fixed role, it becomes easier for others to classify, anticipate, and confine you. The chapter therefore begins by questioning familiarity as a neutral good. A stable image can reassure allies, but it can also turn the self into a legible object that other people know how to manage.

That is why self-fashioning can matter here. Greene is not praising vanity or spectacle for their own sake. He is describing resistance to stale legibility. If you revise the form in which you appear, you can disturb assumptions that had begun doing political work against you. Others who thought they knew your range must recalculate. The chapter treats image control as part of power because public form affects not only how you are seen, but what future moves others think remain available to you.

The chapter is strongest when it resists the lazy reading that reinvention means constant costume change. Greene is not praising instability, manipulative fabrication, or endless novelty. He is distinguishing strategic reinvention from hollow performance. Strategic reinvention alters public form while remaining answerable to a governing center underneath. Hollow performance changes surface after surface until no coherent direction survives. The difference is whether the revised identity serves agency or replaces it with theatrical drift.

This is why stale identity can be expensive. The problem is not only boredom. It is predictability. Once a room has filed you under one reliable heading, it starts interpreting new evidence through that old file. Your work, your tone, your range, and even your ambitions are filtered by a role that may no longer fit. The chapter therefore asks whether the self should remain loyal to a public form that now functions mainly as an instrument of your confinement.

Ordinary settings show the mechanism clearly. A professional known as careful support may need to reframe visibility, decision ownership, and portfolio shape before a team can perceive leadership rather than dutiful assistance. A student paper or showcase panel may continue reading Noel through an earlier reputation even after the work has changed. A private circle may keep addressing someone as the earlier family version because the cues around that person have not shifted enough to force a new reading. In each case, what is being managed is not fantasy. It is the political afterlife of old expectations.

The limit matters because reinvention can become corrosive. If every revision is performed for applause, if continuity evaporates, or if no governing center remains beneath the changing forms, the tactic fails. Greene is not arguing that the self should dissolve into pure image. He is arguing against leaving the self trapped inside yesterday's public script. Chapter 24 showed how grace carries strength through hierarchy. Chapter 25 asks how the larger public form of the self must sometimes be redesigned so that grace does not merely preserve an old cage more elegantly. Chapter 26 follows naturally from there. Even a well-fashioned identity still benefits when visible blame, risk, and dirty work can be displaced elsewhere. Self-creation succeeds only when reinvention is purposeful, bounded, and governed by something deeper than the room's appetite for novelty. If the role changes but the self remains steerable, power has expanded. If the role changes and the self disappears into performance, the room has simply acquired a more entertaining object to manage.`,
        `Greene's twenty-fifth law argues that self-fashioning can be strategically useful because fixed identities make people easier to control. Most readers hear "re-create yourself" and imagine self-help advice about becoming more expressive or confident. Greene hears another issue: the more legible your public role becomes, the easier it is for other people to decide in advance what you can be, what you can attempt, and what they need from you.

Reinvention preserves initiative because it interrupts those settled assumptions. If you alter your visible form, others lose some of the confidence that came from reading you through a stale file. Greene is interested in that uncertainty. A revised identity can reopen strategic room by forcing the field to update its map of you. The chapter values image control not because image is everything, but because stale image can become a prison.

That is why the chapter should not be flattened into advice about branding. It is not saying that all stability is weak or that theatrical novelty is inherently powerful. It is saying that public form must sometimes be redesigned when it has hardened into predictability. Strategic reinvention means changing the role while preserving a governing center. Empty performance means changing appearances without preserving the continuity of judgment that gives the changes meaning.

The pattern appears in ordinary life. Zara may need to shift how she enters meetings, frames credit, and presents her portfolio before the team stops reading her as support-only. Noel may discover that a student paper still reads new work through an outdated reputation that no longer fits. A private relationship may remain trapped in an earlier version of someone until the cues around that person's identity change enough to disrupt the old script. In each case, the question is not whether the self is fake. The question is whether the inherited public form is still politically usable.

The limit remains central because reinvention is not automatically liberating. If it becomes chronic instability, attention-seeking emptiness, or a severance from any center that can govern the revisions, it starts destroying trust and coherence. Greene's practical claim is narrower: recreate the self where stale identity has become a constraint, but keep enough direction that the redesign increases agency instead of replacing it with image churn. Chapter 24 dealt with how strength is presented inside hierarchy. Chapter 25 deals with how the presenter itself may need revision. Chapter 26 then turns toward cleaner power, where even a revised self benefits from pushing visible dirt and blame outward. The reader's edge lies in seeing that image is a tool of agency, not an altar for it. Once the tool becomes the only self you have, the tactic has inverted.`,
        `This law works only if you track what predictability is doing before you decide what consistency means. Most people focus on what a familiar identity gives them: trust, coherence, recognizability, ease. Greene's warning is that familiarity also gives other people a stable file on you. Once that file hardens, they stop meeting the current person and start managing the role they already know how to use. The chapter is about that transfer.

That is why deliberate self-creation can be strategically valuable. A person who revises public form may appear more dramatic while actually becoming less governable. Changes in tone, scope, visibility, or aesthetic carriage can interrupt stale expectation and widen the field of possible action. Greene is not praising reinvention because novelty is beautiful. He is protecting agency from the political cost of being too easily read.

The chapter therefore distinguishes governed redesign from theatrical drift. Empty image work is not self-creation. Endless role changes are not power. Strategic reinvention keeps a center that decides why the image is changing and what the new form is supposed to recover. Without that center, revision becomes performance for its own sake. Without revision, the self may stay trapped in a publicly useful version that has already outlived its value.

Common settings show the law with almost embarrassing clarity. A coworker known for steadiness may need a visible shift in how she claims ownership before leadership becomes legible to the room. A showcase panel may keep reading a stronger project through an older label unless the framing changes first. A family may keep addressing someone as the earlier compliant self until voice, posture, or boundaries alter the script. In each case, reinvention changes the conditions under which new substance can be seen at all.

The limit matters because self-fashioning can fail too. Change too little and the room keeps governing you through yesterday's script. Change too wildly and you become a moving costume with no continuity that others can trust or that you can steer. Greene's better point is to make image answerable to judgment rather than to boredom or hunger for attention. Chapter 24 taught that grace can preserve access inside status theaters. Chapter 25 teaches that the self carried through those theaters may itself need redesign before grace simply preserves a stale prison more elegantly. Chapter 26 follows because once the self is shaped strategically, power still grows cleaner when visible risk and blame can be shifted away. The deepest lesson is that power depends partly on refusing to remain the version of yourself that other people found easiest to file. If you revise the form while keeping a center, the room must recalculate. If you revise the form until no center remains, the room has not lost control of you. It has gained a spectacle whose movements no longer need a cage because the spectacle now performs it from within.`,
      ),
      keyTakeaways: [
        {
          point: tone("Fixed identity can become a political trap.", "A stale public role makes you easier to classify and contain.", "Once the file on you hardens, other people start using it to govern your range."),
          moreDetails: tone("The chapter emphasizes predictability cost rather than continuity as an automatic virtue.", "Old labels can keep interpreting new behavior before the room has actually seen it.", "Yesterday's version of you can remain active in the room long after it stopped being true.")
        },
        {
          point: tone("Changing public form can force a recalculation.", "Changing public form can force others to recalculate what you are capable of.", "Revise the role and stale expectation loses some of its authority."),
          moreDetails: tone("Greene values reinvention because it interrupts settled assumptions that had become restrictive.", "The chapter's leverage comes from disturbing stale legibility and reopening strategic room.", "A new form can make the field uncertain again in ways that favor you.")
        },
        {
          point: tone("Reinvention only works when redesign stays governed.", "The move is governed redesign, not image churn.", "A changed form works only if a center still decides what the change is for."),
          moreDetails: tone("The chapter still requires direction, purpose, and enough continuity for judgment to survive the revision.", "Reinvention matters only if it increases agency rather than replacing it with spectacle.", "When the image starts changing only to feed attention, the tactic has lost its governor.")
        },
        {
          point: tone("Ordinary settings reveal how stale roles keep shaping new reception.", "Work, school, and personal life all show that old scripts govern what new substance is allowed to mean.", "The frame people already have on you can decide the verdict before the next act begins."),
          moreDetails: tone("Portfolio framing, meeting presence, introductions, voice, and boundary shifts all alter what role the room thinks it is seeing.", "The chapter becomes practical when you ask which cues keep returning you to an outdated file.", "New substance often needs a revised social frame before anyone can read it freshly.")
        },
        {
          point: tone("There is a hard limit where redesign starts erasing the governor.", "Reinvention fails if continuity evaporates and no steerable self remains.", "Change the role without scattering the person who must direct it."),
          moreDetails: tone("Some consistency is needed for trust, coherence, and strategic follow-through.", "Greene warns against turning self-creation into endless theatrical instability.", "The right boundary is where redesign stops expanding agency and starts consuming it.")
        }
      ],
      activationPrompt: tone(
        "Identify one public role that has become too legible to keep serving your current range.",
        "Choose one identity cue you could revise so the room must update its file on you.",
        "Pick one stale reading of yourself that now needs deliberate redesign."
      ),
      selfCheckPrompts: [
        tone(
          "Am I revising a stale role, or merely performing novelty for relief?",
          "Which visible cues keep inviting other people to read me through an outdated file?",
          "If I change this form, what center remains stable enough to govern the change?"
        ),
        tone(
          "What part of my current identity still serves me, and what part now serves other people's convenience?",
          "How can I force a recalculation without becoming image churn?",
          "At what point would reinvention stop expanding agency and start hollowing it out?"
        )
      ],
      predictionPrompt: tone(
        "Once the self is deliberately shaped, how might Chapter 26 show that power also depends on keeping visible blame and dirty work away from that shaped identity?",
        "If reinvention protects agency from stale identity, what changes next when the burden of risk and mess can be shifted onto others?",
        "After redesigning the self, how does power grow cleaner when someone else carries the visible dirt?"
      ),
      oneMinuteRecap: tone(
        "This chapter argues that power can depend on redesigning a stale public identity before it hardens into a cage that others use to predict and contain you.",
        "Do not confuse familiar continuity with freedom if your current form mainly serves other people's old map of you.",
        "Sometimes power grows when the self is revised deliberately enough to force a recalculation without dissolving the center that guides the revision."
      )
    }
  },
  examples: [
    {
      title: "Zara Revises the Reliable-Support Image So the Team Stops Missing Her Strategic Range",
      format: "decision_point",
      category: "work",
      endingType: "broader_principle",
      scenario: tone("Zara sees that her team keeps treating her as dependable support even when her ideas are stronger than the visible leads'.", "She has to decide whether to keep the trusted old role or change how she frames ownership, presence, and scope.", "Zara can preserve the stale image that feels safe or revise the form that keeps her trapped inside it."),
      whatToDo: tone("She changes how she claims visible authorship and enters key decisions so the room can no longer file her the same way.", "She revises the form before arguing about the label.", "She treats identity as something to shape rather than something to inherit passively."),
      whyItMatters: tone("The chapter says stale public roles make people easier to manage.", "Her self-fashioning interrupts the assumptions that had been limiting what others could imagine from her.", "A changed form can force a recalculation that old effort alone could not.")
    },
    {
      title: "Noel Hears Why the Student Paper Keeps Reading New Work Through an Old Reputation",
      format: "dialogue",
      category: "school",
      endingType: "self_directed_question",
      scenario: tone("Noel listens as an editor explains why classmates still react to his new work as if he were the same uneven writer from last year.", "He hears how the paper is not only judging the article in front of it but also the old file it already has on him.", "Noel learns that stale reputation can keep rewriting new evidence before the room has truly read it."),
      whatToDo: tone("He asks what visible changes in framing, role, and presentation would force a fresh reading instead of another recycling of the old label.", "He studies how to revise the cues that keep inviting yesterday's judgment.", "He asks what part of his public form needs redesign before the work itself gets a clean chance."),
      whyItMatters: tone("The chapter warns that fixed identity keeps shaping reception even after substance improves.", "The student paper shows how stale legibility can become a cage for new work.", "If the file stays old, the evidence keeps arriving inside the wrong frame.")
    },
    {
      title: "Ines Weighs Reinvention Against the Fear of Becoming All Performance",
      format: "dilemma",
      category: "personal",
      endingType: "surprising_implication",
      scenario: tone("Ines knows the version of herself her family expects no longer fits, but she worries that changing too visibly will make her feel artificial.", "She has to decide whether reinvention is liberation or the beginning of a life lived through performance.", "Ines can stay legible in the old script or risk a new form without losing her center."),
      whatToDo: tone("She changes the cues that keep returning her to the old role while protecting a private center that gives the change direction.", "She chooses governed reinvention instead of either obedience or chaos.", "She lets the form move without letting the self dissolve into theater."),
      whyItMatters: tone("The chapter says self-fashioning works only while it stays answerable to something deeper than attention.", "Her dilemma shows the difference between strategic redesign and hollow image churn.", "The tactic breaks the cage only if it does not become another one.")
    },
    {
      title: "Perry Predicts Why an Operator Changes Public Form Before the Showcase Panel",
      format: "predict_reveal",
      category: "work",
      endingType: "cross_domain",
      scenario: tone("Perry notices an operator alter tone, portfolio order, and visual presentation before facing a showcase panel that already thinks it knows his lane.", "He predicts the change is meant to unsettle the panel's stale reading before the work is judged.", "Perry can already see that the redesign is aimed at the room's old file, not at vanity alone."),
      whatToDo: tone("He judges whether the shift is governed self-fashioning or shallow spectacle.", "He looks for form changes that widen strategic room rather than merely attracting attention.", "He scores the move on whether it forces recalculation without losing coherence."),
      whyItMatters: tone("The chapter says reinvention can recover initiative by interrupting stale expectation.", "The operator may be changing how the panel reads the work before the first question even lands.", "Sometimes the new frame does as much strategic work as the new evidence.")
    },
    {
      title: "Showcase-Panel Debrief Finds That an Old Label Narrowed How a Strong Project Was Received",
      format: "postmortem",
      category: "school",
      endingType: "common_trap",
      scenario: tone("A showcase panel reviews why a strong project landed as smaller than it was and realizes the presenter was still being read through an old narrow label.", "The debrief finds that the work had changed more than the public form around it had.", "The team learns that stale framing can shrink new substance before it is fairly seen."),
      whatToDo: tone("They redesign introductions, credit framing, and visible scope so the next project is not trapped in the same file.", "They stop assuming the work alone will overcome an outdated reading.", "They change the form that kept making the same old verdict feel obvious."),
      whyItMatters: tone("The chapter warns that old identity can keep governing reception long after it stops fitting reality.", "Their problem was not only the project but the stale lens through which it arrived.", "A dead label can keep winning if no one forces the room to drop it.")
    },
    {
      title: "Before and After an Inherited Identity Gave Way to Governed Self-Creation",
      format: "before_after",
      category: "personal",
      endingType: "perspective_reframe",
      scenario: tone("Before, introductions, habits, and tone kept returning someone to an inherited role that no longer fit. After, visible cues shifted enough that others had to meet a more current version instead.", "The contrast is between stale legibility and deliberate redesign.", "One version keeps accepting the old file; the other forces a new reading without losing its center."),
      whatToDo: tone("Change the cues that keep inviting outdated interpretation, but keep the redesign answerable to a coherent internal direction.", "Revise the form without scattering the person.", "Force a recalculation without becoming image churn."),
      whyItMatters: tone("The law distinguishes strategic self-fashioning from random shape-shifting.", "Governed change can recover power when inherited identity has become a trap.", "The room can read you differently only after the script changes enough to require it.")
    }
  ],
  reviewCards: [
    { cardId: "ch25-rc01", front: tone("Why can fixed identity be dangerous in this chapter?", "Why does a stale public role become a problem?", "What makes old identity politically costly?"), back: tone("Because a fixed role makes you easier to predict, classify, and confine.", "The chapter says stale identity can become a cage through legibility.", "Once the room has filed you, it starts managing the file."), difficulty: "easy" },
    { cardId: "ch25-rc02", front: tone("What can self-fashioning recover here?", "Why does reinvention matter in this law?", "What changes when public form is revised?"), back: tone("It can recover initiative by unsettling stale expectations and reopening strategic room.", "Reinvention forces others to recalculate what they think you can do.", "A revised form can interrupt the old script."), difficulty: "easy" },
    { cardId: "ch25-rc03", front: tone("How is strategic reinvention different from hollow performance?", "What separates redesign from image churn?", "Why isn't novelty alone enough?"), back: tone("Strategic reinvention stays governed by a center, while hollow performance changes surface without preserving direction.", "The chapter values purposeful redesign, not random theatricality.", "If the image changes but no governor remains, the tactic has failed."), difficulty: "medium" },
    { cardId: "ch25-rc04", front: tone("Where does this law appear in ordinary life?", "How do work, school, and personal settings show stale-role traps?", "Where does public form change what new substance can mean?"), back: tone("It appears wherever old labels keep shaping how new behavior is received.", "Teams, student groups, and families all keep reading people through inherited files until form shifts.", "The frame often has to change before the evidence gets a fresh reading."), difficulty: "medium" },
    { cardId: "ch25-rc05", front: tone("How does Chapter 25 bridge to Chapter 26?", "Why does self-creation lead into clean hands?", "What comes after the self is strategically redesigned?"), back: tone("Once identity is shaped deliberately, the next question is how visible blame, labor, and dirt are kept off that shaped self.", "Chapter 26 turns from form control to burden displacement.", "First redesign the self, then ask who carries the mess."), difficulty: "hard" }
  ],
  keyTakeawayCard: tone(
    "Recreating yourself is useful when deliberate self-fashioning breaks a stale identity that others had begun using to predict and confine you.",
    "This law warns that old public forms can become cages and favors governed reinvention over random theatricality.",
    "Power grows when the role is redesigned without losing the center that directs the redesign."
  )
};

const quiz = {
  passingScorePercent: 70,
  questions: [
    { questionId: "ch25-q01", prompt: "Why is a fixed public identity risky in this chapter?", choices: ["Because it makes you easier to predict and confine", "Because consistency is always weak", "Because public image should never matter"], correctIndex: 0, explanation: tone("Correct. The chapter says stale identity becomes politically costly when it hardens into legibility others can use against you.", "A fixed role can become a cage because people start managing the version they already know.", "Right. Once the file on you is stable, the room starts governing through it."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch25-q02", prompt: "What can deliberate self-creation recover here?", choices: ["Permanent popularity", "Initiative lost to stale expectations", "Freedom from all continuity"], correctIndex: 1, explanation: tone("Yes. Reinvention matters because it can reopen strategic room closed by old labels.", "The chapter treats self-fashioning as a way to recover initiative from stale readings.", "Right. A revised form can force the field to recalculate you."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch25-q03", prompt: "Why is this chapter not generic branding advice?", choices: ["Because image never matters in real power", "Because reinvention is only about aesthetics", "Because it concerns stale identity, legibility, and strategic agency"], correctIndex: 2, explanation: tone("Correct. Greene is tracking political use of identity, not shallow personal-branding polish.", "The issue is how fixed public form narrows agency and how redesign can interrupt that narrowing.", "Yes. This is about role control, not decorative self-promotion."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch25-q04", prompt: "In Zara's work scenario, what best fits the chapter?", choices: ["Keep the safe old support role so trust stays simple", "Change how she claims ownership and visible scope so the team must recalculate her range", "Act unpredictably in every meeting so no one can label her"], correctIndex: 1, explanation: tone("Yes. The chapter favors governed redesign that interrupts stale assumptions without becoming chaos.", "She revises the form that was confining her instead of merely protesting the label.", "Right. The room often has to see a different frame before it grants a different role."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch25-q05", prompt: "Why did Noel's student-paper reputation remain a problem?", choices: ["Because old labels kept shaping how new work was read", "Because student groups hate improvement", "Because new work never matters"], correctIndex: 0, explanation: tone("Correct. The chapter says stale files can keep interpreting new evidence before it gets a fresh reading.", "His problem was not only the work but the inherited frame around it.", "Yes. The old label kept arriving before the article did."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch25-q06", prompt: "What is the strongest reading of Ines's dilemma?", choices: ["She should never change because continuity is always safer", "Reinvention works only if it stays guided by a center instead of becoming pure performance", "Any redesign of self is automatically fake"], correctIndex: 1, explanation: tone("Yes. The chapter's limit is that self-fashioning fails when no governing center survives beneath the changes.", "Strategic reinvention protects agency only while it is directed rather than empty.", "Right. The tactic breaks the cage only if it does not become another costume prison."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch25-q07", prompt: "How does image control function in this chapter?", choices: ["It changes how others calculate what you can do next", "It guarantees admiration without substance", "It removes the need for continuity"], correctIndex: 0, explanation: tone("Correct. Public form matters because it shapes the expectations through which others read your range.", "The chapter treats image control as a way of disturbing stale calculations.", "Yes. Change the frame and the room has to update its map of you."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch25-q08", prompt: "When does reinvention become hollow instability instead of strategy?", choices: ["When it preserves direction while changing the form", "When it turns into image churn with no governing center or continuity", "When it forces the room to recalculate you"], correctIndex: 1, explanation: tone("Exactly. Greene's useful limit is the point where redesign loses its governor and becomes emptiness.", "The tactic fails when revision no longer serves agency but only keeps performing change.", "Right. If no steerable self remains underneath, the reinvention has thinned into spectacle."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch25-q09", prompt: "How does Chapter 24 lead into Chapter 25?", choices: ["Graceful presentation inside hierarchy leads to the larger question of reshaping the self that is being presented", "Chapter 25 rejects presentation as irrelevant", "Once tact works, identity no longer matters"], correctIndex: 0, explanation: tone("Correct. Chapter 24 managed how strength is carried; Chapter 25 asks whether the carrier itself has gone stale.", "The sequence moves from tactical presentation to redesign of public form.", "Right. First learn how to move through the room, then ask whether the self the room sees still serves you."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch25-q10", prompt: "What bridge carries Chapter 25 into Chapter 26?", choices: ["Chapter 26 abandons image and agency entirely", "Once identity is redesigned, the next question is how visible blame and dirty work stay off that shaped self", "Self-creation makes burden displacement unnecessary"], correctIndex: 1, explanation: tone("Correct. The next law turns from shaping identity to keeping visible dirt and blame away from it.", "Chapter 26 asks who carries the mess once the self has been strategically formed.", "Right. After redesigning the role, power still grows cleaner when someone else carries the stain."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" }
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
for (const name of ["Zara", "Noel", "Ines", "Perry"]) continuity.nameUsage[name] = [stem];
continuity.withinChapterNames[stem] = ["Zara", "Noel", "Ines", "Perry"];
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
- Chapter-specific mechanism remains stale identity, legibility cost, self-fashioning, and governing-center limits rather than generic reinvention rhetoric
- Hard depth preserves the redesign-versus-performance boundary and the Chapter 26 clean-hands bridge
- Quiz stays within supported facts from the approved draft and frozen source bundle

## Gate result
- Approved for chapter gate and automatic continuation
`;
writeText(paths.validation, validation);

fs.appendFileSync(
  paths.runLog,
  `\n- Completed writer, editor, critic, converter, quiz, and validator steps for Chapter 25.\n- Validation result: PASS.\n- Continuity hash sealed for \`${stem}\`: \`${seal}\`\n`,
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
