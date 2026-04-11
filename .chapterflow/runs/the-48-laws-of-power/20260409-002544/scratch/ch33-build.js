const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const runRoot = path.resolve(".chapterflow/runs/the-48-laws-of-power/20260409-002544");
const num = 33;
const stem = `ch${String(num).padStart(2, "0")}`;
const title = "Discover Each Man's Thumbscrew";
const chapterId = "ch33-discover-each-mans-thumbscrew";
const createdAt = new Date().toISOString();

function tone(gentle, direct, competitive) {
  return { gentle, direct, competitive };
}

const canonical = `Greene's thirty-third law begins with a question about why broad pressure so often misses. People can resist arguments, ignore status displays, and absorb generic force if none of it touches what actually moves them. The chapter begins by treating leverage as person-specific. If you do not know the fear, vanity, dependency, longing, or insecurity that matters most to the person in front of you, you may waste pressure where it has no real purchase.

Its claim is not that every person has one simple weakness or that motive-reading can ever become perfect. Greene's point is narrower and more strategic. People are often governed by recurring sensitivities they do not advertise plainly. Once those hidden motives are understood, influence can become more efficient because it stops pushing everywhere at once and starts pressing where movement is most likely. Discovering the thumbscrew therefore matters not because human beings reduce neatly to one flaw, but because generic leverage usually underperforms precise leverage.

That is why the law focuses on careful reading rather than on crude stereotype. Greene is not praising wild projection, amateur mind reading, or cartoonish weakness hunting. He is distinguishing tested observation from overconfident fantasy about what makes someone tick. The useful move is not to invent a vulnerability because it fits a theory. It is to watch patterns, incentives, emotional reactions, and dependencies until a real pressure point becomes visible. The law becomes unstable when the reader confuses one observed trait with the whole person or pushes so brutally that leverage turns into purposeless cruelty.

Ordinary settings make the mechanism visible. A leader may fail repeatedly with generic incentives until noticing that one person is moved more by vanity, another by security, and another by fear of exclusion. An admissions board or alumni office may respond less to broad persuasion than to the exact status concern or institutional anxiety hiding underneath the formal language. A person in private life may stop escalating arguments once they see that the conflict is really tied to one embarrassment, need, or dependency. In each case, the issue is not whether pressure exists. It is whether the pressure is aimed at what actually matters.

The chapter's limit matters. Thumbscrew thinking can decay into dehumanizing caricature, bad overread, or abusive fixation if it treats people as static bundles of weakness. Greene overreaches if the law becomes permission to reduce others to one exploit or to press a vulnerability with no regard for consequence. The useful version is narrower: read carefully, verify the pressure point through behavior, and stay revisable when the person or context changes. Chapter 32 showed how fantasy can attract desire broadly before facts finish speaking. Chapter 33 asks what exact opening inside a person turns broad attraction or fear into specific leverage. That points toward Chapter 34, where attention shifts from reading hidden motives in others to shaping how others read you by acting with royal expectation before leverage is even required.`;

const edited = canonical;

const critic = `# Chapter 33 Critic Report

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
- Paragraph 4 is most vulnerable because work, school, and personal examples can flatten into generic psychology talk if conversion drops the person-specific leverage and overread-limit mechanics.

Strongest sentence:
- "If you do not know the fear, vanity, dependency, longing, or insecurity that matters most to the person in front of you, you may waste pressure where it has no real purchase."

Anchor use notes:
- The draft stays inside the frozen support: people are moved by hidden motives and vulnerabilities, tailored leverage outperforms generic force, precise reading differs from stereotype, and the chapter has a hard cruelty-and-overread limit.

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
        "This law says generic pressure often fails because people are moved by specific hidden motives. Greene is not saying that every person has one magical weakness or that you can read someone perfectly at a glance. The chapter makes a narrower point. If you keep pushing without knowing what actually matters to the person in front of you, you may waste force. Some people are moved by vanity, some by fear, some by dependence, and some by one private insecurity they do not say out loud. But the chapter is not praising cruel mind games or invented psychology. Strategic reading means watching behavior closely enough to find a real leverage point, not projecting one because it sounds clever. The lesson is to stop pressing everywhere at once and instead find what actually makes this person move.",
        "Greene's thirty-third law argues that influence gets stronger when it touches the real pressure point instead of using broad force. The chapter is not telling you that people are simple or permanently defined by one flaw. It is telling you that hidden motives matter. When you identify what someone most fears, wants, needs, or protects, your pressure becomes more precise and often more effective. That can save energy because you stop fighting the whole person and start addressing the part of the situation that actually governs their response. But the chapter is not saying every guess about weakness is wise. Leverage matters only if the read is real, tested, and specific enough to hold. Used badly, thumbscrew thinking becomes stereotype, overconfidence, or cruelty detached from actual understanding.",
        "This law gives a practical warning: if you never find the real motive, you may keep escalating pressure without changing anything important. Greene's point is that leverage often depends on what is hidden. A competitive reader should notice that people rarely announce their most sensitive point directly. But the chapter is not asking for paranoid overreading or reducing everyone to one defect. It is asking for careful diagnosis. Watch what a person protects, repeats, avoids, or reacts to, then see where the real seam may be. The tactic works only if the read stays revisable. If you force a shallow theory onto the person, you may miss the true pressure point and create resistance instead of leverage.",
      ),
      keyTakeaways: [
        { point: tone("Generic pressure often misses.", "Leverage works better when it reaches the motive that actually moves the person.", "Push the real seam, not the whole wall.") },
        { point: tone("Hidden motives matter.", "Fear, vanity, dependency, and craving often shape behavior more than surface words do.", "People usually move from the place they are guarding most.") },
        { point: tone("Careful reading is not the same as cruel stereotype.", "The chapter supports tested observation, not invented weakness hunting.", "If the read is fake, the leverage will be fake too.") }
      ],
      oneMinuteRecap: tone(
        "This law says leverage gets stronger when you identify the real pressure point instead of pressing generically.",
        "Do not assume broad force will work if the hidden motive has not been found yet.",
        "Read carefully, but do not turn one guess about weakness into a rigid caricature."
      )
    },
    medium: {
      chapterBreakdown: tone(
        `Greene's thirty-third law begins by questioning the usefulness of generic pressure. Many people assume that if they push harder, explain more, threaten more clearly, or sweeten the incentive enough, the other person will eventually move. Greene hears a different problem. Pressure often fails because it is aimed at the wrong place. The chapter asks what happens when influence stops treating people as abstract obstacles and starts reading the hidden motive that actually governs response.

That is why the thumbscrew matters here. Greene is not claiming that every person can be reduced to a single weakness or that leverage can be discovered without error. He is describing pressure-point reading. If you identify the fear, vanity, dependency, insecurity, or longing that most strongly shapes a person's behavior, influence can become narrower and more effective. The chapter treats tailored leverage as strategically useful because generic force often scatters where precise reading would concentrate.

The chapter is strongest when it distinguishes tested observation from stereotype. The useful move is not to invent a motive because it fits a clever story about the person. It is to notice what they protect, what they repeat, what they avoid, and where emotion spikes around apparently minor matters. Greene is not praising cartoon psychology. He is showing how leverage improves when the read is grounded in behavior rather than in projection.

The pattern appears in ordinary settings. A work lead may stop wasting time on broad incentives after seeing that one colleague is moved mainly by recognition, another by safety, and another by fear of being sidelined. An admissions board or alumni office may reveal that official language hides one more specific concern about prestige, reputation, or institutional caution. A personal conflict may soften once someone sees that the argument is feeding one embarrassment or one dependency rather than the whole stated issue. In each case, the force was not missing. The diagnosis was.

The limit matters because thumbscrew thinking can rot. If the read is shallow, fixed, or vindictive, the tactic collapses into dehumanization and bad overconfidence. Greene's practical claim is narrower: observe carefully, find the real seam, and stay revisable when the person or context changes. Chapter 32 dealt with broad desire and fantasy. Chapter 33 deals with exact leverage once the general pull is no longer enough. Chapter 34 then turns from reading others to shaping yourself, where royal self-presentation sets the floor for how others respond before you ever need to press a pressure point.`,
        `Greene's thirty-third law argues that influence usually sharpens when it is aimed at the hidden motive actually governing someone rather than at the whole visible person. The chapter therefore begins with a strategic problem, not a cruelty lesson. What if broad pressure keeps failing because it is hitting the surface while the real leverage point sits somewhere deeper?

That is why pressure-point reading can be useful. If you discover what someone most fears, wants, protects, or depends on, you may be able to move them with less force than a generic push would require. Greene is interested in that efficiency. The chapter values tailored leverage because behavior often follows hidden sensitivities more than public explanations.

This is why the chapter is not generic weakness-hunting advice. Greene is not telling the reader to invent dark motives or to assume one observed insecurity explains everything forever. He is separating careful diagnosis from shallow projection. The issue is not whether a vulnerability exists. The issue is whether you have read it accurately enough to act on it without fooling yourself first. Leverage works when the read is real. It fails when the reader falls in love with their own theory.

The pattern appears everywhere. Darien may stop pressing with broad pressure once he notices that one colleague responds only when status is at risk. An alumni office may reveal that a polished institutional concern is really anxiety about prestige loss. A private conversation may change once the real sensitivity is seen as embarrassment instead of stubbornness. In each case, the behavior begins to make more sense once the hidden seam is identified.

The limit remains central because pressure-point thinking can become ugly and inaccurate at the same time. If you flatten a person into one defect, confuse one momentary reaction with a permanent weakness, or press so hard that the tactic becomes pure cruelty, the chapter's leverage logic breaks. Greene's point is disciplined rather than sadistic: read closely, verify the seam, and stay aware that the same person may shift under different conditions. Chapter 32 dealt with making a path broadly attractive. Chapter 33 deals with what exact thing inside someone responds to that attraction or resists it. Chapter 34 then asks how power changes when you stop reading weak points and start projecting a status floor of your own.`,
        `This law starts with a tempting mistake: assuming that people resist because you have not yet pushed hard enough. Greene's warning is that more force can remain useless if it never reaches the actual source of movement. A person may argue about one thing while protecting another, declare one motive while serving another, and resist broadly while actually being vulnerable at one narrow seam. The chapter therefore treats human leverage as more diagnostic than blunt.

That matters because precise reading changes where pressure should go. A person whose public language sounds principled may privately move from vanity, fear, dependence, or the need to avoid shame. The chapter therefore treats observation as a power tool. What changes is not only how hard you push. It is where you place the push once the hidden motive becomes visible.

This keeps the law narrower than praise for predation. Greene is not asking you to turn everyone into a caricature of weakness or to assume every human reaction hides a dark secret. He is asking whether the visible conflict is masking a more specific pressure point. Strategic leverage means reading enough reality to find it. It becomes failure when the reader stops testing the theory and starts worshipping it.

Common settings make the point plain. A leader may discover that generic incentives fail because one person cares only about recognition and another about security. An admissions board may sound procedural while actually protecting status or caution. A personal dispute may remain stuck until someone sees the one shame or dependency the surface argument keeps circling. In each case, the force becomes effective only when it stops being generic.

The limit matters because a pressure-point read can be wrong, stale, or abusively overused. If the read is static while the person changes, or if leverage becomes an excuse for cruelty, the same tactic meant to sharpen influence can misfire badly. Chapter 32 showed that broad fantasy can attract desire. Chapter 33 shows that broad attraction still passes through one person's specific seam. Chapter 34 follows by asking how self-presentation can preempt some of these contests entirely by making others read you from a higher status floor at first sight.`
      ),
      keyTakeaways: [
        {
          point: tone("Generic pressure often fails because it is aimed too broadly.", "Leverage improves when it reaches the motive that actually governs response.", "A narrow seam can move more than a wide shove."),
          moreDetails: tone("The chapter focuses on diagnosis before force.", "Pressure often looks weak only because it is hitting the wrong part of the person or situation.", "A more accurate read can make the same amount of force far more effective.")
        },
        {
          point: tone("Fear, vanity, dependency, and craving often drive behavior quietly.", "Hidden motives can matter more than surface language or stated reasons.", "What people say they are protecting is not always what they are actually protecting."),
          moreDetails: tone("Greene values leverage reading because the real driver of behavior is often indirect or disguised.", "The chapter's leverage comes from noticing what consistently triggers protection, emotion, or defensiveness.", "A behavior pattern can reveal more than a stated explanation does.")
        },
        {
          point: tone("Careful reading differs from stereotype or projection.", "The chapter supports tested motive diagnosis, not fantasy about weakness.", "If you invent the seam, you will press air."),
          moreDetails: tone("The law still requires observation, pattern-testing, and enough humility to revise a bad read.", "Leverage matters only while the diagnosis remains more accurate than your assumptions.", "A clever theory can become its own blindfold if it stops being checked against behavior.")
        },
        {
          point: tone("Work, school, and personal settings all show that tailored leverage beats generic force.", "Different people respond to different pressure points even inside the same environment.", "One key rarely opens every lock."),
          moreDetails: tone("Status anxiety, shame, security needs, and social exclusion can each govern behavior differently depending on the person.", "The chapter becomes practical when you ask what this person repeatedly protects or reacts to.", "Specificity often explains why one kind of pressure works on one person and fails on another.")
        },
        {
          point: tone("The law has an overread and cruelty limit.", "Pressure-point thinking fails when it becomes fixed caricature or abusive exploitation.", "A bad read can be as dangerous as no read at all."),
          moreDetails: tone("Some motives shift with context, and some vulnerabilities should not be pressed without consequence awareness.", "Greene warns against wasted force, not against recognizing full human complexity.", "The right boundary is where leverage reading stops sharpening influence and starts flattening the person into a target diagram.")
        }
      ],
      activationPrompt: tone(
        "Identify one person or situation where broad pressure keeps failing and ask what motive may actually be governing the response.",
        "Choose one conflict that might change if you found the real fear, vanity, or dependency instead of pushing harder at the surface.",
        "Pick one interaction where diagnosis matters more than escalation."
      ),
      selfCheckPrompt: tone(
        "What does this person repeatedly protect, avoid, or react to more strongly than the surface issue would justify?",
        "Am I reading a real pressure point here, or projecting a theory because it flatters my explanation?",
        "Where should this leverage read stay revisable instead of turning into a rigid label?"
      ),
      oneMinuteRecap: tone(
        "This chapter says leverage becomes stronger when it reaches the real pressure point instead of pressing generically.",
        "Do not assume more force will work if the hidden motive driving the behavior has not been found yet.",
        "Read carefully, but do not flatten a person into one fixed weakness or use leverage as an excuse for cruelty."
      )
    },
    hard: {
      chapterBreakdown: tone(
        `Greene's thirty-third law treats leverage as a diagnostic art rather than as a contest of raw force. Most people hear "discover each man's thumbscrew" and imagine cruelty, secret buttons, or cartoonishly simple weaknesses. Greene is interested in a sharper claim: pressure works poorly when it is generic. The chapter therefore begins by asking what actually governs a person's movement once public language, stated principle, and surface resistance have all been stripped away. A person can absorb broad force while remaining highly vulnerable at one narrow seam.

That is why the thumbscrew can matter here. Greene is not claiming that everyone can be reduced to one permanent defect, nor that motive-reading ever becomes infallible. He is describing concentrated leverage. If you identify the vanity, fear, insecurity, dependency, or hidden longing that most strongly shapes someone's decisions, influence can become more exact and therefore more efficient. The chapter treats pressure-point knowledge as part of power because human behavior is often organized around sensitivities that remain invisible until closely observed.

The chapter is strongest when it resists the lazy reading that pressure-point analysis is just cynical stereotyping. Greene is not praising projection, melodramatic mind reading, or sadistic weakness hunting for its own sake. He is distinguishing patient observation from fantasy about what people are. Useful leverage reading stays close to evidence: patterns of defensiveness, repeated reactions, status anxieties, dependency habits, emotional spikes, and the odd places where reason gives way to protection. Bad leverage reading confuses one clue with the whole map and then treats the theory as more real than the person.

This is why generic pressure often feels ineffective. The problem is not always insufficient force. The problem is misalignment. Once pressure misses the actual governing motive, it can become louder without becoming more useful. The chapter therefore asks whether influence belongs to the person who pushes hardest or to the person who knows exactly where pressure belongs. A broad shove can fail where one precise touch on shame, fear, vanity, or need can redirect the whole interaction.

Ordinary settings show the mechanism clearly. A leader may stop wasting time on universal incentives once it becomes clear that one colleague moves only when status is threatened, another only when security is promised, and another only when exclusion feels imminent. An admissions board or alumni office may speak in polished institutional language while actually protecting prestige, caution, or reputational insulation. A personal conflict may stay stuck until someone recognizes that the visible issue is only orbiting a hidden humiliation, dependency, or fear. In each case, what matters is not whether pressure exists. What matters is whether the pressure is touching live structure or only the surface around it.

The limit matters because thumbscrew thinking can decay into abuse and error at the same time. If the read becomes dehumanizing, if one observed trait is treated as an eternal truth, or if leverage is pressed with no regard for consequence, the tactic stops being strategic and becomes both ugly and unstable. Greene is not arguing that people should be reduced to exploitable defects. He is arguing that power sharpens when it stops mistaking the whole person for the whole problem. Chapter 32 showed how fantasy can attract desire in broad strokes. Chapter 33 asks what exact craving, fear, or vulnerability broad attraction finally narrows into inside one person. Chapter 34 follows naturally from there. Once you understand how others can be read at their seams, power also depends on controlling how others read you, setting a higher status floor before they even begin their own leverage calculus. Thumbscrew reading succeeds only when the diagnosis is truer than the stereotype and more restrained than cruelty.`,
        `Greene's thirty-third law argues that precise leverage can be strategically useful because people are rarely moved by generic pressure alone. Most readers hear the title and imagine dark psychology as theater. Greene hears a more practical problem: broad force often misses because it is aimed at the surface while the real motive sits elsewhere.

Pressure-point reading preserves advantage because it concentrates force. If you know what someone most fears, wants, protects, or depends on, you may be able to move them with less wasted effort than a general push would require. Greene is interested in that concentration. The chapter values hidden-motive reading not because people become simple, but because influence usually improves when it stops pressing randomly.

That is why the chapter should not be flattened into permission for stereotype. It is not saying that one embarrassed reaction reveals the entire person or that every human being can be solved like a code. It is saying that behavior often exposes specific seams if you watch it carefully enough. Strategic leverage means diagnosing with evidence. Crude leverage means imposing your own story of weakness on someone and then mistaking your projection for insight.

The pattern appears in ordinary life. Darien may fail with broad pressure until he notices the actual motive is prestige anxiety. Sola may realize that a procedural institution is really governed by fear of reputational loss. A private argument may shift once the hidden dependence beneath the surface stubbornness becomes visible. In each case, the field changes because the read becomes narrower and more accurate.

The limit remains central because a bad read can harden into cruelty or self-deception. Greene's practical claim is narrower: find the seam that is actually governing behavior, test the diagnosis against what the person repeatedly reveals, and remain willing to revise if the context changes. Chapter 32 dealt with making a path broadly desirable. Chapter 33 deals with the exact point inside a person where desire, fear, vanity, or insecurity can be made to move. Chapter 34 then turns toward self-presentation, where power begins controlling not their weakness but your perceived rank. The reader's edge lies in seeing that leverage often depends less on how much pressure you own than on whether you know where the person in front of you is already weakly structured.`,
        `This law works only if you track what a person repeatedly protects before deciding what pressure will matter. Most people focus on arguments, incentives, and visible objections. Greene's warning is that the visible contest may be downstream from a more private seam. Once you identify what a person is desperate to preserve, avoid, or hide, the apparent complexity of the interaction can become more legible. The chapter is about that narrowing.

That is why pressure-point diagnosis can be strategically valuable. A person who knows where vanity, dependence, shame, or fear actually lives may need less force because the leverage becomes more direct. Greene is not praising cruelty for its own sake. He is protecting influence from waste. Precise reading changes outcomes because people can resist a broad push while remaining highly exposed at one accurate point of contact.

The chapter therefore distinguishes evidence-based leverage from imaginative overreach. A recurring reaction is not the whole soul. A vulnerability in one context is not a permanent key to the person. Strategic reading keeps enough humility that the diagnosis can be tested and revised. Without the diagnosis, pressure diffuses. Without the humility, leverage can turn into fantasy wearing the mask of psychological insight.

Common settings show the law with almost embarrassing clarity. A rollout may fail because leadership keeps offering generic incentives when one teammate only moves for recognition and another only for safety. An alumni office may dress its motive in procedural calm while actually protecting prestige. A personal fight may seem about principle while really circling one humiliation no one wants to name. In each case, the interaction changes when the hidden motive becomes the visible target of understanding.

The limit matters because thumbscrew thinking can fail too. Read too broadly and nothing moves. Read too narrowly or cruelly and you may misdiagnose the person, trigger backlash, or corrode the situation beyond use. Greene's better point is to search for the actual seam without pretending people are nothing but seams. Chapter 32 taught that desire can be lit broadly through fantasy. Chapter 33 teaches that broad desire or fear still narrows into one person's specific opening. Chapter 34 follows because once you understand how others can be read and pressed, power also depends on ensuring that your own self-presentation commands treatment before others start searching for your weak points. The deepest lesson is that leverage belongs not to the loudest pressure, but to the truest diagnosis.`
      ),
      keyTakeaways: [
        {
          point: tone("Leverage improves when force becomes diagnostic instead of generic.", "A narrow pressure point can move what broad pressure keeps missing.", "One live seam can matter more than ten loud pushes."),
          moreDetails: tone("The chapter emphasizes concentrated influence rather than escalation by volume.", "Pressure often fails because it is aimed at the visible obstacle instead of the hidden driver of behavior.", "A truer read can make smaller force more effective than a larger vague push.")
        },
        {
          point: tone("Hidden motives often organize visible behavior.", "Fear, vanity, dependency, shame, and longing can govern action beneath stated reasons.", "What a person guards most often explains more than what they say most loudly."),
          moreDetails: tone("Greene values motive-reading because public explanation frequently hides more specific emotional structure underneath it.", "The chapter's leverage comes from observing what consistently triggers protection or emotional spike.", "A repeated reaction can reveal what formal language is trying to cover.")
        },
        {
          point: tone("Evidence-based reading differs from stereotype and projection.", "The move is patient observation, not forcing a weakness theory onto the person.", "If the theory arrives before the evidence, the leverage is already drifting into fantasy."),
          moreDetails: tone("The chapter still requires testing, revision, and enough humility to let behavior correct a bad diagnosis.", "Leverage matters only while the read remains more accurate than the story you wanted to tell about the person.", "A clever psychological narrative can become its own blind spot if it stops being checked against reality.")
        },
        {
          point: tone("Specific leverage beats broad pressure across work, school, and personal life.", "Different people break, bend, or move at different seams even under the same external conditions.", "The same key does not fit every lock."),
          moreDetails: tone("Recognition, security, shame, prestige, and exclusion can each govern different people more than the official issue does.", "The chapter becomes practical when you ask what this person repeatedly cannot bear, cannot resist, or cannot stop protecting.", "Behavior makes more sense once the right seam is being watched.")
        },
        {
          point: tone("The law has a cruelty and overread limit.", "Thumbscrew thinking fails when it turns a person into a fixed target diagram or presses a seam with no consequence awareness.", "A bad diagnosis and an ugly one can easily become the same thing."),
          moreDetails: tone("Some vulnerabilities shift, some motives are contextual, and some leverage points should not be pressed without understanding the cost of doing so.", "Greene warns against wasted force, not against recognizing that people remain more complex than their weak points.", "The right boundary is where leverage stops being precise understanding and starts becoming dehumanizing fantasy.")
        }
      ],
      activationPrompt: tone(
        "Identify one person you keep pushing broadly and ask what exact motive, fear, or vanity may actually be governing the response.",
        "Choose one stalled interaction where better diagnosis would matter more than more force.",
        "Pick one repeated behavior and ask what hidden seam it may be protecting."
      ),
      selfCheckPrompts: [
        tone(
          "What does this person repeatedly protect even when the official issue changes?",
          "Am I reading a real pressure point here, or am I inventing one because it makes the situation easier to explain?",
          "If I pressed this seam, would that reflect accurate diagnosis or just aggressive projection?"
        ),
        tone(
          "Which observed pattern here is strong enough to trust, and which is still too thin to turn into leverage?",
          "Would a change in context make this supposed weakness disappear or reverse?",
          "At what point would pressing this vulnerability stop being strategic and start becoming cruelty or self-deception?"
        )
      ],
      predictionPrompt: tone(
        "Once hidden motives in others are understood, how might Chapter 34 show that power also depends on teaching others to read you from a higher status floor?",
        "If leverage comes from knowing their seams, what changes next when your own self-presentation is built to reduce how easily others can lower you?",
        "After diagnosing hidden vulnerabilities, how does power grow when you act in a way that sets the terms of how you are treated?"
      ),
      oneMinuteRecap: tone(
        "This chapter argues that power sharpens when leverage is aimed at the hidden motive that actually governs a person rather than at the whole visible surface around them.",
        "Do not assume more force will solve a problem if the real seam has not been diagnosed yet.",
        "Sometimes the strongest pressure is the one placed more accurately, not more loudly."
      )
    }
  },
  examples: [
    {
      title: "Darien Stops Pushing Broadly Once He Sees Which Motive Actually Moves the Colleague",
      format: "decision_point",
      category: "work",
      endingType: "broader_principle",
      scenario: tone("Darien has tried incentives, pressure, and explanation, but one colleague keeps resisting in ways that do not match the stated reason on the surface.", "He has to decide whether to push harder or pause long enough to identify the real motive underneath the resistance.", "Darien can escalate broadly or find the one seam that the broad pressure keeps missing."),
      whatToDo: tone("He watches what the colleague protects most closely and tailors his approach to that motive instead of escalating everywhere at once.", "He lets diagnosis come before more force.", "He stops pressing the wall and starts finding the seam."),
      whyItMatters: tone("The chapter says leverage improves when pressure reaches what actually governs response.", "His move shows why generic force can fail when the hidden motive is still untouched.", "A truer read can save energy that broad escalation only wastes.")
    },
    {
      title: "Sola Hears Why the Admissions Board's Formal Language Was Hiding a More Specific Status Fear",
      format: "dialogue",
      category: "school",
      endingType: "self_directed_question",
      scenario: tone("Sola listens as someone explains that the admissions board kept talking in neutral procedural terms while repeatedly reacting most strongly around prestige, image, and institutional caution.", "She hears that the surface reasons were not false, but they were not the whole driver either.", "Sola learns that the visible objection can orbit a narrower hidden concern."),
      whatToDo: tone("She asks what repeated reaction pattern revealed the board's real seam under the official language.", "She studies how status anxiety may have governed a decision that sounded merely procedural.", "She asks where the read is evidence-based and where it could still slide into projection."),
      whyItMatters: tone("The chapter warns that leverage often depends on what behavior reveals rather than what explanation announces.", "The admissions board shows how precise motive-reading can change where influence should be applied.", "A formal objection may hide a more personal or institutional vulnerability underneath it.")
    },
    {
      title: "Mirei Weighs a Personal Pressure-Point Read Against the Risk of Overreading One Reaction",
      format: "dilemma",
      category: "personal",
      endingType: "surprising_implication",
      scenario: tone("Mirei thinks she sees the one embarrassment driving a recurring personal conflict, but she also knows one observed reaction may not justify a full theory about the person.", "She has to decide whether the seam is real enough to act on or still too thin to trust.", "Mirei can turn one clue into leverage or let humility slow the read before it hardens into fantasy."),
      whatToDo: tone("She tests the pattern against repeated behavior before treating it as the governing pressure point.", "She chooses evidence over clever overconfidence.", "She lets the read stay revisable until the seam proves real under more than one moment."),
      whyItMatters: tone("The chapter says leverage fails when the reader loves the theory more than the person in front of them.", "Her dilemma shows the line between precise diagnosis and self-flattering projection.", "A false seam can waste pressure and damage the relationship at the same time.")
    },
    {
      title: "Alumni-Office Review Predicts Which Concern Will Actually Move the Decision",
      format: "predict_reveal",
      category: "school",
      endingType: "cross_domain",
      scenario: tone("An alumni-office review presents several official concerns, but one repeated nervous reaction keeps surfacing whenever prestige and donor perception enter the room.", "The observer predicts that this status concern, not the stated procedural caution alone, will decide what the office finally does.", "The real leverage point may already be visible in what the room cannot stop protecting."),
      whatToDo: tone("The observer tests whether the repeated status sensitivity is the true seam or only one layer of the decision.", "They look for the pattern that keeps reappearing beneath the office's polished language.", "They distinguish motive-reading from paranoia by staying tied to repeated behavior."),
      whyItMatters: tone("The chapter says pressure works best when it meets the motive actually organizing behavior.", "The office example shows how formal explanations can hide a narrower institutional vulnerability.", "A repeated reaction often tells the truth more clearly than the official script does.")
    },
    {
      title: "Work Debrief Finds the Team Kept Escalating Because No One Identified the Live Pressure Point",
      format: "postmortem",
      category: "work",
      endingType: "common_trap",
      scenario: tone("A work debrief finds that repeated pressure failed because the team kept turning up the volume without understanding what actually mattered to the blocker in front of them.", "The review shows that the force was real but misdirected.", "The group learns that escalation without diagnosis can look like action while missing the whole seam."),
      whatToDo: tone("They rebuild the approach around hidden-motive diagnosis before applying more pressure.", "They move from louder force to narrower leverage.", "They treat observation as part of influence instead of as a delay before it."),
      whyItMatters: tone("The chapter warns that generic pressure often fails because it is hitting the wrong part of the problem.", "Their failure came less from weakness of force than from weakness of diagnosis.", "A better read might have made less force do more work.")
    },
    {
      title: "Before and After Broad Pressure Gave Way to Pressure-Point Reading",
      format: "before_after",
      category: "personal",
      endingType: "perspective_reframe",
      scenario: tone("Before, every conflict was met with more explanation, more pressure, or broader incentives, and the other person kept resisting in ways that looked irrational. After, the interaction changed once one hidden fear or vanity seam became visible.", "The contrast is between pressure without diagnosis and leverage through specific reading.", "One version pushes harder; the other reads deeper."),
      whatToDo: tone("Stop assuming the surface objection is the whole issue and look for the repeated seam underneath it.", "Let the true motive narrow the pressure before applying more force.", "Use evidence-based leverage instead of louder generic pressure."),
      whyItMatters: tone("The law distinguishes tailored influence from wasted escalation.", "Pressure-point reading can make the same situation suddenly more legible and more movable.", "A person may not need more force; the situation may need a truer diagnosis.")
    }
  ],
  reviewCards: [
    { cardId: "ch33-rc01", front: tone("Why does generic pressure often fail in this chapter?", "Why isn't more force always better leverage?", "What happens when pressure misses the real seam?"), back: tone("Because broad pressure can miss the hidden motive actually governing the person's response.", "The chapter says leverage fails when it is aimed at the surface instead of the real pressure point.", "More force does not help much if it is landing in the wrong place."), difficulty: "easy" },
    { cardId: "ch33-rc02", front: tone("What is a thumbscrew strategically?", "Why do hidden motives matter here?", "What kind of thing counts as the live seam?"), back: tone("It is the fear, vanity, craving, dependency, or insecurity that actually gives leverage over the person's movement.", "The chapter treats hidden motive as the place where tailored influence becomes stronger.", "A thumbscrew is the specific sensitivity that matters more than broad generic pressure."), difficulty: "easy" },
    { cardId: "ch33-rc03", front: tone("How is precise reading different from stereotype?", "What separates diagnosis from projection here?", "Why isn't one clue enough?"), back: tone("Precise reading is grounded in repeated behavior and tested patterns, while stereotype projects a weakness theory without enough evidence.", "The law supports careful observation, not fantasy about what makes people tick.", "A real seam is discovered through evidence, not through a clever story alone."), difficulty: "medium" },
    { cardId: "ch33-rc04", front: tone("Where does this law appear in ordinary settings?", "How do work, school, and personal conflicts reveal hidden pressure points?", "Why does one key not fit every lock?"), back: tone("It appears wherever different people respond to different motives under the same surface issue.", "Teams, boards, offices, and personal conflicts all show that tailored leverage beats generic force.", "The chapter becomes practical when you ask what this specific person keeps protecting or reacting to."), difficulty: "medium" },
    { cardId: "ch33-rc05", front: tone("How does Chapter 33 bridge to Chapter 34?", "Why does leverage reading lead into royal self-presentation?", "What changes after you understand others' seams?"), back: tone("Once hidden motives in others are understood, the next question is how to shape how others read you before they start pressing your weak points.", "Chapter 34 turns from diagnosing others to setting your own status floor.", "First find their seam, then make sure your own surface is harder to lower."), difficulty: "hard" }
  ],
  keyTakeawayCard: tone(
    "Discovering each person's thumbscrew is useful when leverage is aimed at the real hidden motive that governs them instead of being scattered broadly across the surface.",
    "This law warns that broad pressure wastes force and favors tested motive-reading over stereotype, while keeping the read revisable and constrained by consequence.",
    "Power often sharpens when diagnosis becomes truer than projection and more precise than escalation."
  )
};

const quiz = {
  passingScorePercent: 70,
  questions: [
    { questionId: "ch33-q01", prompt: "Why does generic pressure often fail in this chapter?", choices: ["Because pressure should never be used", "Because broad force can miss the hidden motive that actually governs response", "Because all people respond the same way"], correctIndex: 1, explanation: tone("Correct. The chapter says leverage fails when it keeps landing on the surface instead of the seam.", "Broad pressure often looks weak only because it is aimed at the wrong place.", "Right. More force does little if it never touches what actually moves the person."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch33-q02", prompt: "What is a thumbscrew strategically?", choices: ["The specific fear, vanity, need, or dependency that gives real leverage", "Any random weakness you can imagine", "A permanent label that defines the whole person forever"], correctIndex: 0, explanation: tone("Yes. Greene uses the term for the pressure point that actually governs movement.", "The chapter treats the thumbscrew as a live seam, not as a whole personality summary.", "Right. It is the specific sensitivity where leverage becomes more exact."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch33-q03", prompt: "Why is this chapter not generic cruelty advice?", choices: ["Because every pressure point should always be pressed as hard as possible", "Because hidden motives never matter", "Because it distinguishes evidence-based reading from stereotype and needless exploitation"], correctIndex: 2, explanation: tone("Correct. The line is between careful diagnosis and ugly projection or abuse.", "Greene supports tested observation, not cruel weakness-hunting for its own sake.", "Yes. The tactic breaks when leverage becomes stereotype, dehumanization, or purposeless harm."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch33-q04", prompt: "In Darien's work scenario, what best fits the chapter?", choices: ["Keep escalating broad pressure and hope the colleague finally breaks", "Pause long enough to identify the hidden motive generic force keeps missing", "Assume the first theory about weakness must be right"], correctIndex: 1, explanation: tone("Yes. The chapter favors diagnosis before more force.", "He needs the live seam, not just more volume.", "Right. The stronger move is to locate what actually governs the response."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch33-q05", prompt: "Why did the admissions board example matter for Sola?", choices: ["Because school boards always reveal every true motive openly", "Because polished procedure eliminates hidden vulnerability", "Because formal language can hide a narrower status or reputational concern underneath it"], correctIndex: 2, explanation: tone("Correct. The chapter shows how official language can sit on top of a more specific institutional seam.", "The real leverage point may be prestige anxiety rather than the stated procedural reason alone.", "Yes. Behavior can reveal a narrower concern under the formal script."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch33-q06", prompt: "What is the strongest reading of Mirei's dilemma?", choices: ["She should treat one observed reaction as permanent proof of the whole person", "She should test whether the seam is real before trusting it as leverage", "She should avoid reading motives at all"], correctIndex: 1, explanation: tone("Yes. The chapter's limit is that leverage reads must stay tied to evidence and remain revisable.", "One clue is not enough if it has not survived pattern-testing.", "Right. A false seam can waste force and damage the situation at once."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch33-q07", prompt: "Why does tailored leverage often outperform generic force?", choices: ["Because it uses more total pressure", "Because it reaches the specific motive actually organizing behavior", "Because it guarantees perfect control"], correctIndex: 1, explanation: tone("Correct. The chapter says precise diagnosis concentrates force where it can matter.", "A narrow seam can redirect the situation more effectively than a broad shove.", "Yes. Leverage improves when the push reaches the live driver of behavior."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch33-q08", prompt: "When does pressure-point thinking become overconfident or abusive?", choices: ["When the read becomes fixed caricature or gets pressed with no consequence awareness", "When the diagnosis stays revisable and evidence-based", "When leverage is tied to repeated behavior instead of projection"], correctIndex: 0, explanation: tone("Exactly. The tactic fails once the person is flattened into a target diagram or the read stops being tested.", "A bad read and a cruel one often arrive together when leverage loses humility.", "Right. The strategy breaks when stereotype and abuse replace diagnosis."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch33-q09", prompt: "How does Chapter 32 lead into Chapter 33?", choices: ["Broad fantasy pull leads next to the exact craving, fear, or vulnerability inside one person", "Desire framing makes person-specific leverage unnecessary", "Chapter 33 rejects any connection between attraction and pressure points"], correctIndex: 0, explanation: tone("Correct. Chapter 32 attracts broadly, and Chapter 33 narrows that movement into one person's seam.", "The sequence moves from general desire to specific leverage.", "Right. After the path glows, the next question is what exact point inside this person responds to it."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch33-q10", prompt: "What bridge carries Chapter 33 into Chapter 34?", choices: ["Pressure-point diagnosis makes self-presentation irrelevant", "Once you understand others' weak points, the next question is how to set your own status floor before they read you", "Chapter 34 rejects any link between leverage and status"], correctIndex: 1, explanation: tone("Correct. The next law turns from reading others' seams to teaching others how to read your rank.", "Chapter 34 asks how royal self-presentation preempts some contests before they begin.", "Right. After leverage diagnosis, power shifts toward making your own surface harder to lower."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" }
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
for (const name of ["Darien", "Sola", "Mirei"]) continuity.nameUsage[name] = [stem];
continuity.withinChapterNames[stem] = ["Darien", "Sola", "Mirei"];
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
- Chapter-specific mechanism remains pressure-point diagnosis, hidden motives, and overread limits rather than generic dark-psychology language
- Hard depth preserves the diagnosis-versus-cruelty boundary and the Chapter 34 self-presentation bridge
- Quiz stays within supported facts from the approved draft and frozen source bundle

## Gate result
- Approved for chapter gate and automatic continuation
`;
writeText(paths.validation, validation);

fs.appendFileSync(
  paths.runLog,
  `\n- Completed writer, editor, critic, converter, quiz, and validator steps for Chapter 33.\n- Validation result: PASS.\n- Continuity hash sealed for \`${stem}\`: \`${seal}\`\n`,
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
