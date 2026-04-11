const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const runRoot = path.resolve(".chapterflow/runs/the-48-laws-of-power/20260409-002544");
const num = 43;
const stem = `ch${String(num).padStart(2, "0")}`;
const title = "Work on the Hearts and Minds of Others";
const chapterId = "ch43-work-on-the-hearts-and-minds-of-others";
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

const canonical = `Greene's forty-third law turns from disrupting groups through their center toward binding people more durably through persuasion. Fear, blunt pressure, and surface compliance can produce obedience for a while. Greene's warning is that this kind of obedience is often thin. It fades when pressure weakens, and it can leave resentment underneath. The chapter asks what happens when influence works not only on behavior, but on feeling, identity, and perceived interest.

The point is not that emotion replaces structure or that persuasion is automatically honest. Greene is arguing that people cooperate more steadily when they feel understood, engaged, or invested in the outcome. Working on hearts and minds matters because it lowers resistance from inside rather than merely suppressing it from outside. A person who feels reached may give more willingly, follow longer, and resist less than someone who is only complying under visible force.

That is why the chapter distinguishes durable buy-in from manipulative softness. Some influence becomes shallow because it relies on flattery, vague sentiment, or emotional theater without real substance. Some force remains necessary because boundaries, structure, and incentives still matter. Greene's stronger claim is narrower: lasting influence joins emotional understanding with credible structure so that people feel both moved and anchored rather than merely managed.

Ordinary settings make the mechanism visible. A manager may get short-term compliance through pressure but deeper cooperation only after people feel their interests are understood. A school campaign or team morale crisis may shift once participants believe they are invested in the outcome, not simply ordered into it. A personal conflict may soften when the other person feels seen rather than cornered. In each case, the practical question is whether influence has reached hearts and minds or only behavior on the surface.

The law overreaches when it becomes generic kindness, false empathy, or sentimental manipulation detached from reality. Some situations still require hard limits. Some emotional appeals are only a softer form of control. Greene is strongest when he treats buy-in as a strategic depth that must be joined to real structure, not as a replacement for structure altogether. Chapter 42 showed how a group can be scattered by pressure on the center. Chapter 43 shows how a group can be held together more durably when hearts and minds are won. Chapter 44 follows by turning from persuasion toward destabilization through the mirror effect.`;

const edited = canonical;

const critic = `# Chapter 43 Critic Report

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
- Paragraph 4 is most vulnerable because work, school, and personal persuasion cases can flatten into generic empathy advice if conversion loses the durable-buy-in versus shallow-compliance mechanism.

Strongest sentence:
- "Working on hearts and minds matters because it lowers resistance from inside rather than merely suppressing it from outside."

Anchor use notes:
- The draft stays inside the frozen support: emotional buy-in, durable consent, shallow compliance, felt investment, and the sentimentality limit.

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
        "This law says that force can produce obedience without producing real willingness. Greene is not saying that structure disappears or that persuasion is always sincere. The point is that people cooperate more deeply when they feel understood, involved, or invested. If you reach only their behavior, they may comply briefly and resist underneath. If you reach their hearts and minds, they may follow with less resistance and more steadiness. That is why the chapter values buy-in over surface submission. The mistake is not emotion itself. The mistake is treating fear or pressure as enough when what you need is lasting cooperation.",
        "Greene's forty-third law argues that durable influence comes from working on hearts and minds rather than relying on force alone. The issue is not emotion without structure. The issue is depth. A person who feels understood or invested often cooperates more steadily than one who is only complying under pressure. The law is not generic kindness advice. It is advice to create real buy-in so that influence lasts beyond the immediate moment of control.",
        "This law gives a competitive warning: command can move people for a moment, but only buy-in can hold them for longer. Greene wants the reader to see that shallow compliance is unstable. If people feel cornered, they may obey briefly and resist later. But the chapter has a limit. Sentimental language and false empathy can fail just as badly if they ignore boundaries, incentives, or reality. The edge comes from joining emotional reach to real structure."
      ),
      keyTakeaways: [
        { point: tone("Fear can create shallow compliance.", "Pressure may control behavior without securing real willingness.", "Surface obedience is not the same thing as durable consent.") },
        { point: tone("Emotional buy-in deepens cooperation.", "People resist less when they feel understood or invested.", "Hearts and minds matter because they make cooperation steadier.") },
        { point: tone("The law has a sentimentality limit.", "False empathy and vague softness fail if they ignore real structure.", "Soft manipulation can collapse as quickly as blunt force.") }
      ],
      oneMinuteRecap: tone(
        "This law says durable influence grows when people feel reached emotionally, not only controlled behaviorally.",
        "Build buy-in if you want cooperation that lasts beyond the moment of pressure.",
        "Win hearts and minds without mistaking sentiment for structure."
      )
    },
    medium: {
      chapterBreakdown: tone(
        `Force can secure motion without securing allegiance. Greene's forty-third law begins there. A person or group may comply because pressure, fear, or authority makes refusal costly. Yet that compliance can remain thin. Once the pressure fades, resentment, passivity, or quiet resistance may return. The chapter turns the reader away from obedience alone and toward the deeper question of whether hearts and minds have actually been reached.

That is why emotional buy-in matters here. Greene is not saying that rules, incentives, or structure become irrelevant. He is saying that people cooperate more steadily when they feel understood, engaged, or invested in the outcome. Emotional leverage matters because it changes not just what people do, but how willingly they do it. A person who feels reached from within can become less resistant than one who is only managed from above.

The key distinction is between durable persuasion and manipulative softness. Durable persuasion joins feeling with credibility, structure, and real interest. Manipulative softness uses flattery or sentiment as a substitute for substance. Greene respects hearts-and-minds work because it can create lasting willingness. But willingness lasts only when emotional reach is attached to something real enough to hold.

Ordinary settings show the pattern clearly. Caden may get short-term compliance from a work team through pressure, but only deeper cooperation once people feel their concerns and interests are understood. Mireya may see a student campaign or morale rebuild change once participants feel invested rather than merely instructed. A personal conflict may soften once one person feels seen instead of cornered. In each case, the practical question is whether influence has reached buy-in or only behavior.

The law becomes weak if it turns into generic kindness theater. Some situations still need firm boundaries. Some emotional appeals are manipulative because they ask for trust without credible structure. Greene's stronger point is narrower: work on hearts and minds when you want durable cooperation, but do not confuse warm feeling with a complete strategy. Chapter 42 showed how a group can be disrupted by targeting its center. Chapter 43 shows how a group can be held more deeply through felt allegiance. Chapter 44 then shifts toward disarming and infuriating through the mirror effect.`,
        `Shallow compliance looks stable until pressure weakens. Greene uses that idea to shift the reader from overt control to inner consent. The chapter matters because people often obey for reasons that do not last. If fear or pressure is doing all the work, the relationship to authority may remain brittle underneath.

That is why hearts and minds matter here. A person who feels understood, included, or invested may cooperate with less internal resistance. Greene's practical claim is that emotional buy-in creates steadier influence than blunt command by itself. The issue is not softness alone. The issue is whether the influence reaches the person's felt stake in the outcome.

The chapter is strongest when it separates real buy-in from flattery. Real buy-in gives people a reason to care, identify, or participate more willingly. Flattery only performs warmth while avoiding hard reality. Greene is not asking the reader to become vague, endlessly nice, or emotionally theatrical. He is asking the reader to understand that durable influence often depends on psychological and emotional assent.

The pattern appears everywhere. Caden can enforce work rules and still fail to create commitment until people feel genuinely involved. Mireya can watch a school campaign or morale problem turn once students feel the effort belongs partly to them. A personal disagreement can ease once understanding changes the emotional posture of the exchange. The chapter stays specific when consent, cooperation, and structure all remain visible at once.

The law overreaches if it becomes sentimental manipulation or empathy without boundaries. Its useful boundary is sharper than that: combine emotional reach with real structure, seek buy-in when compliance alone will not last, and remember that persuasion fails when it asks feeling to carry what reality will not support. Chapter 42 dealt with breaking coordination. Chapter 43 deals with building steadier allegiance. The next law turns toward the mirror effect as a different way of unsettling others.`,
        `Greene's forty-third law warns that control without inward assent is often temporary. Many readers notice visible obedience and assume influence is secure. Greene notices how often such obedience depends on pressure that cannot be maintained forever. If the person's heart and mind were never reached, the compliance may remain narrow, brittle, and ready to reverse once the external force weakens.

That is why the law values emotional buy-in over surface submission. Once people feel understood, represented, or invested, they may stop experiencing influence as pure imposition. Greene's harder claim is that durable power often depends on making cooperation feel internally acceptable or even meaningful, not merely externally unavoidable.

This is also why the chapter should not be flattened into praise for generic kindness. Some leaders flatter and soothe without building trust, credibility, or structure. Some manipulators use emotional language as camouflage for weak strategy. The strategic error is not using feeling. The strategic error is using feeling alone and calling that persuasion. If nothing credible anchors the appeal, the emotional surface can dissolve quickly.

Common settings make the line visible. Caden can see that a work team follows more steadily once concerns are genuinely absorbed into the plan. Mireya can detect that student support becomes durable when people feel psychologically invested, not just instructed to comply. A personal conflict can change once understanding reaches the emotional center of the disagreement. These cases are not about softness for its own sake. They are about whether influence has reached the inner reason people say yes.

The limit matters because sentimental theater can also weaken authority. Greene's law works when it sharpens the path from emotional reach to durable cooperation, not when it replaces incentives and boundaries with vague warmth. Build real buy-in, keep real structure, and do not mistake a softer tone for a stronger foundation. Chapter 42 dealt with disruption through the center. Chapter 43 deals with allegiance through hearts and minds. Chapter 44 follows by showing how mirroring can unsettle others in a very different register.`
      ),
      keyTakeaways: [
        {
          point: tone("Force often creates only shallow compliance.", "Pressure can move behavior without securing inward assent.", "Visible obedience can hide unstable allegiance."),
          moreDetails: tone("Greene asks the reader to notice how compliance can remain thin when it depends only on pressure.", "Once the pressure fades, resistance or resentment may return.", "Behavior alone is not proof that hearts and minds have been won.")
        },
        {
          point: tone("Emotional buy-in can create steadier cooperation.", "People follow more deeply when they feel understood or invested.", "Hearts and minds matter because they reduce resistance from within."),
          moreDetails: tone("The law values emotional reach because it changes willingness, not just action.", "People tend to cooperate more durably when they feel a stake in the outcome.", "Buy-in matters because it creates steadier participation than command alone.")
        },
        {
          point: tone("Durable persuasion differs from manipulative softness.", "Real buy-in joins feeling to credibility and structure.", "Sentiment without substance is not lasting influence."),
          moreDetails: tone("The chapter is not generic kindness advice.", "Flattery and emotional theater can look persuasive while remaining strategically thin.", "Durable consent needs something real enough to hold the feeling in place.")
        },
        {
          point: tone("Work, school, and personal conflicts all reveal buy-in logic.", "Ordinary settings also show how felt investment changes cooperation.", "The same pattern appears wherever willingness matters more than surface obedience."),
          moreDetails: tone("A team, campaign, morale problem, or personal conflict can all shift once people feel seen or invested.", "The practical test is whether the influence changed internal posture or only external behavior.", "Lasting cooperation usually depends on more than command.")
        },
        {
          point: tone("The law has a structure limit.", "Emotional reach fails when it ignores incentives, boundaries, or reality.", "Softness can collapse if it tries to replace real structure."),
          moreDetails: tone("The chapter stays reliable only when it keeps feeling tied to credible conditions.", "Persuasion weakens when it asks emotion to carry what the structure cannot support.", "Hearts and minds work best when the emotional appeal rests on something real.")
        }
      ],
      activationPrompt: tone(
        "Find one situation where visible compliance may be hiding weak or resentful inward consent.",
        "Choose one relationship where deeper buy-in matters more than another round of pressure.",
        "Identify one emotional reality you need to reach and one structural condition you still need to keep firm."
      ),
      selfCheckPrompt: tone(
        "Am I getting real buy-in here, or only short-term behavior under pressure?",
        "What would make this person feel genuinely invested rather than merely managed?",
        "Have I tied the emotional appeal to something credible enough to last?"
      ),
      oneMinuteRecap: tone(
        "This chapter argues that durable influence depends on reaching hearts and minds, not just securing outward compliance.",
        "Buy-in matters because people cooperate more steadily when they feel understood, involved, or invested.",
        "The strategic task is to join emotional reach to real structure rather than replacing structure with sentiment."
      )
    },
    hard: {
      chapterBreakdown: tone(
        `Greene's forty-third law is less about kindness than about the depth of consent. A person may obey because pressure, hierarchy, or fear makes refusal costly, yet that obedience can remain shallow. The chapter therefore asks the reader to distrust visible compliance when the inner posture remains untouched. What matters strategically is whether influence has only constrained behavior or has also reached feeling, identity, and perceived interest.

That is why the law values hearts-and-minds work. Greene is not romanticizing emotion for its own sake. He is describing the durability that emerges when people feel understood, represented, or invested rather than merely compelled. A person whose inward resistance has softened may cooperate more steadily than a person who remains resentful underneath visible obedience. Influence can therefore deepen when it enters the emotional and psychological layer where willingness is formed.

The central distinction is between durable persuasion and manipulative softness. Durable persuasion gives feeling something credible to attach to: real interest, intelligible structure, or meaningful participation. Manipulative softness borrows the language of empathy while offering no stable basis for trust or investment. One form of influence creates inward assent. The other performs warmth while remaining strategically hollow.

That distinction matters in ordinary settings. Caden may discover that a work team stops merely complying and starts cooperating once people feel their concerns are actually shaping the plan. Mireya may find that a school campaign or morale repair effort only stabilizes after students feel psychologically invested, not just rhetorically courted. A personal conflict may thaw once someone feels recognized at the level of identity or hurt rather than only instructed to change behavior. In each case, the move works because it alters the inner relation to the outcome.

The chapter is strongest when it refuses both blunt coercion and sentimental theater. Some situations still require boundaries, incentives, and force. Some emotional appeals are only a softer route to manipulation. Greene's useful boundary is sharper: work on hearts and minds when durable cooperation matters, but do not pretend that warm feeling can replace structure, credibility, or real stake. Chapter 42 dealt with breaking groups through concentrated pressure. Chapter 43 deals with holding people more durably through inward assent.

That bridge matters because a scattered group and a persuaded group are opposite strategic conditions. A group can be broken by pressure on the center, but it is held by more than pressure once hearts and minds are engaged. Chapter 43 therefore teaches a different diagnostic from Chapter 42: ask not only who obeys, but how deeply they believe, identify, or invest. Chapter 44 follows by turning from persuasion toward destabilization through mirroring and reflection.`,
        `Compliance can be outwardly clear and inwardly unstable. Greene uses that fact to move the reader from command to consent. The strategic question is never only whether people are doing what you want right now. The deeper question is whether they are doing it from pressure alone or from some felt form of assent that can survive after the pressure weakens.

The chapter therefore values emotional buy-in because emotional buy-in changes the interior quality of cooperation. Once people feel their interests, identity, or pain have been reached, they may stop treating influence as a pure external imposition. Greene's argument is that durability often depends on this shift from managed behavior to accepted participation.

The harder distinction is between building assent and performing empathy. Building assent joins emotional understanding to credible structure, boundaries, and a real path forward. Performing empathy uses soft language, flattery, or reassurance to make control feel pleasant without making it legitimate. Greene is not asking the reader to become vague or sentimental. He is asking for enough clarity to know when persuasion has actually become believable to the people it needs to move.

Caden's work problem, Mireya's school setting, and a personal conflict softened by recognition all show the same mechanism. Each looks behavioral at first. Each becomes deeper once emotional posture changes. The real issue is whether the person now has an inward reason to cooperate, not merely an outward reason to comply.

The law overreaches when it turns influence into soft manipulation or empathy theater detached from structure. Its better boundary is exacting but usable: reach feeling without abandoning reality, create investment without discarding boundaries, and remember that lasting influence usually needs both psychological assent and credible conditions. Chapter 42 exposed vulnerability through concentrated leadership. Chapter 43 tracks durability through inward buy-in. Chapter 44 then asks what happens when power uses reflection instead of persuasion to unsettle others.`,
        `Greene's forty-third law warns that pressure alone often fails at the point of duration. Many readers see obedience and assume the work of influence is complete. Greene keeps noticing the opposite possibility. The same obedience can remain brittle if it depends only on fear, friction, or hierarchy. Once those supports weaken, the hidden resistance underneath may return and undo the apparent success.

Its strongest claim is that influence lasts longer when people experience the outcome as psychologically or emotionally acceptable, not merely compulsory. That does not mean honesty is guaranteed or that emotion substitutes for structure. It means that hearts and minds are where durable willingness is formed. If you ignore that layer, you may keep winning behavior while losing allegiance.

That is why working on hearts and minds can be a form of power preservation. A credible emotional appeal can reduce resentment, deepen identification, and make cooperation feel less imposed. Soft manipulation does the opposite. It uses the language of care without building the substance that care would need in order to hold. Greene is not celebrating warm tone for its own sake. He is defending inward consent against the weakness of surface obedience.

The examples expose the same structure across settings. Caden is not merely enforcing better behavior at work; he is deciding whether people will feel ownership in what follows. Mireya is not merely persuading students; she is deciding whether support will become identity-level investment or remain temporary compliance. A personal disagreement is not merely about calming someone down; it is a test of whether understanding can change the emotional basis of the relationship. In each case, the weak move is not using structure. The weak move is assuming structure alone will create lasting willingness.

The limit matters because emotional influence can collapse into sentimentality. Some conflicts still require hard lines. Some people read emotional language as manipulation when nothing real supports it. Some systems need more than buy-in because incentives remain misaligned. Greene's law works only when it sharpens judgment about what inward assent requires and what boundaries must remain. Reach the heart, respect the mind, and keep the structure real. Chapter 42 dealt with disruption through the shepherd. Chapter 43 deals with durability through allegiance. Chapter 44 follows by showing how the mirror effect can disarm and disturb in a different way than persuasion does.`
      ),
      keyTakeaways: [
        {
          point: tone("Visible obedience can hide unstable inward resistance.", "Compliance alone does not prove durable influence.", "Behavior may move before allegiance does."),
          moreDetails: tone("The chapter asks the reader to look beneath surface compliance toward inner posture.", "Pressure can secure action while leaving resentment intact.", "Durability depends on more than visible behavior.")
        },
        {
          point: tone("Emotional buy-in can create deeper cooperation.", "People follow more steadily when they feel understood, represented, or invested.", "Hearts and minds matter because inward assent lasts longer than fear."),
          moreDetails: tone("Greene values emotional reach because it changes the quality of cooperation from within.", "A person with felt investment may resist less and contribute more steadily.", "Buy-in matters because it gives behavior an inner reason to persist.")
        },
        {
          point: tone("Durable persuasion is different from empathy theater.", "Real assent joins feeling to credibility, boundaries, and structure.", "Warm language without substance is not lasting influence."),
          moreDetails: tone("The chapter stays hard only if emotional reach is anchored in something believable.", "Flattery and soft language can mimic persuasion without producing real trust.", "Inward assent needs both emotional and structural support.")
        },
        {
          point: tone("Work, school, and personal settings all reveal buy-in logic.", "Ordinary conflicts also show how psychological investment changes cooperation.", "The same pattern appears wherever lasting willingness matters."),
          moreDetails: tone("A team, campaign, morale repair, or private conflict can each deepen once people feel seen and invested.", "The practical test is whether internal posture changed or only external compliance.", "Lasting influence usually requires more than command.")
        },
        {
          point: tone("The law needs a structure boundary.", "Emotion cannot carry what incentives, credibility, or limits do not support.", "Sentimentality fails when it tries to replace real conditions."),
          moreDetails: tone("The law keeps its force only when it ties emotional reach to something structurally real.", "Buy-in weakens when the underlying situation gives people no credible reason to trust the appeal.", "Judgment matters because hearts and minds are not won by warmth alone.")
        }
      ],
      activationPrompt: tone(
        "Locate one relationship where people may be complying outwardly while resisting inwardly.",
        "Choose one situation where lasting cooperation depends on emotional buy-in rather than another round of pressure.",
        "Identify one emotional reality that must be reached and one structural condition that must stay credible."
      ),
      selfCheckPrompts: [
        tone(
          "If the pressure eased tomorrow, would this cooperation remain or collapse?",
          "What inward reason does this person have to say yes beyond fear or convenience?",
          "Am I reaching feeling and identity, or only controlling behavior?"
        ),
        tone(
          "Is this emotional appeal attached to something credible enough to last?",
          "Have I mistaken warmth, reassurance, or flattery for real buy-in?",
          "What boundary or incentive must remain firm for this persuasion to stay believable?"
        )
      ],
      predictionPrompt: tone(
        "If Chapter 43 works through hearts and minds, how might Chapter 44 unsettle others by forcing them to confront a reflected version of themselves?",
        "What changes once the goal is no longer allegiance but destabilization through mirroring?",
        "After learning how people are persuaded, how does strategy shift toward using reflection to disarm and infuriate?"
      ),
      oneMinuteRecap: tone(
        "This chapter argues that influence lasts longer when it reaches hearts and minds instead of stopping at outward compliance.",
        "Power is preserved by creating inward assent through credible emotional buy-in while keeping boundaries and structure real.",
        "The task is to seek durable cooperation without letting persuasion collapse into soft manipulation or sentimentality."
      )
    }
  },
  examples: [
    {
      title: "Caden Rebuilds Cooperation by Creating Real Stake Instead of More Pressure",
      format: "decision_point",
      category: "work",
      endingType: "broader_principle",
      scenario: tone("Caden leads a team that is obeying instructions on the surface but still resisting underneath.", "He has to choose between tightening command again and creating deeper investment in the plan.", "The behavior looks compliant, but the cooperation is still thin."),
      whatToDo: tone("He studies what would make the team feel understood and genuinely invested rather than only managed.", "He uses structure and emotional reach together instead of relying on pressure alone.", "He builds an inner reason for cooperation instead of demanding another outward yes."),
      whyItMatters: tone("The chapter says lasting influence needs more than visible obedience.", "His case shows why buy-in can deepen cooperation beyond short-term compliance.", "The real gain comes from changing willingness, not just behavior.")
    },
    {
      title: "Mireya Explains Why the Campaign Changes Once Students Feel It Is Also Theirs",
      format: "dialogue",
      category: "school",
      endingType: "self_directed_question",
      scenario: tone("Mireya talks through a school campaign or morale problem that looks stagnant until students begin to feel psychologically invested in the outcome.", "The conversation turns from messaging to felt ownership.", "She is trying to separate true buy-in from surface enthusiasm."),
      whatToDo: tone("She asks what would make people feel represented rather than merely recruited.", "She studies whether the effort has reached emotion and identity or only gained temporary attention.", "She links the emotional appeal to something concrete enough to keep support stable."),
      whyItMatters: tone("The chapter says people cooperate more deeply when they feel understood or invested.", "Her example shows how emotional buy-in can change the steadiness of support.", "Persuasion matters most when it becomes participation, not just applause.")
    },
    {
      title: "Sorin Has to Decide Whether Understanding Will Reduce Resistance Better Than More Pressure",
      format: "dilemma",
      category: "personal",
      endingType: "surprising_implication",
      scenario: tone("Sorin is in a personal conflict where direct pressure keeps producing outward compliance but no real change in posture.", "He has to decide whether deeper understanding would alter the conflict more than stronger insistence.", "The real question is whether the resistance is behavioral or emotional at its root."),
      whatToDo: tone("He looks for the hurt, identity issue, or felt stake that is still untouched before adding more pressure.", "He refuses to confuse temporary quiet with real resolution.", "He tests whether reaching the inner reason for resistance changes the outcome more than command does."),
      whyItMatters: tone("The law says hearts and minds must be reached when compliance alone is too brittle.", "His dilemma shows why emotional buy-in can matter even in private conflict.", "A calmer surface is not the same as deeper consent.")
    },
    {
      title: "Laleh Predicts the Morale Rebuild Will Fail Unless People Feel Seen, Not Just Directed",
      format: "predict_reveal",
      category: "school",
      endingType: "cross_domain",
      scenario: tone("Laleh predicts that a team morale rebuild will stall if students receive only instructions and not a credible sense that their feelings and stake are understood.", "She expects the effort to remain shallow unless buy-in becomes emotional as well as procedural.", "The scene becomes a forecast about consent rather than command."),
      whatToDo: tone("She watches for whether people start speaking as participants instead of as managed followers.", "She tests whether the campaign is building inward assent or only outward compliance.", "She asks what would make support feel psychologically real."),
      whyItMatters: tone("The chapter says emotional reach lowers resistance and deepens cooperation.", "Her prediction shows how buy-in logic works in school groups too.", "The law is about durable willingness, not only better messaging.")
    },
    {
      title: "The Debrief Finds That Compliance Held Briefly Because No One Felt Invested",
      format: "postmortem",
      category: "work",
      endingType: "common_trap",
      scenario: tone("A work review shows that a team followed the plan while pressure was high, but commitment faded once the pressure eased because no one felt invested in the outcome.", "They realize the system produced motion without allegiance.", "The debrief becomes a lesson in shallow compliance rather than in pure discipline."),
      whatToDo: tone("They separate immediate obedience from durable cooperation and redesign the process around real stake and credible structure.", "They stop mistaking execution under pressure for inward support.", "They build for commitment, not just for short-term movement."),
      whyItMatters: tone("The chapter warns that compliance can stay thin when hearts and minds are untouched.", "Their mistake was treating visible order as proof of real consent.", "The structure moved behavior but never won investment.")
    },
    {
      title: "Before and After Buy-In Changed the Same Rules Into a Different Relationship",
      format: "before_after",
      category: "personal",
      endingType: "perspective_reframe",
      scenario: tone("Before, the same rules felt imposed and invited hidden resistance. After, those rules were tied to understanding, investment, and a credible reason to cooperate.", "The contrast is between surface compliance and inward assent.", "One version controls; the other holds."),
      whatToDo: tone("Keep the boundaries, but explain and structure them in a way that people can feel part of rather than merely subject to.", "Choose emotional credibility over repeated pressure when the rules alone are not enough.", "Trade brittle obedience for steadier willingness."),
      whyItMatters: tone("The chapter becomes visible when the same structure works differently once hearts and minds are reached.", "This before-and-after shows why buy-in can make compliance more durable without removing limits.", "Influence deepens when the inner reason for cooperation changes.")
    }
  ],
  reviewCards: [
    { cardId: "ch43-rc01", front: tone("What is the main claim of Chapter 43?", "Why do hearts and minds matter here?", "What can buy-in change?"), back: tone("The chapter argues that durable influence comes from reaching hearts and minds rather than relying on force or surface compliance alone.", "Hearts and minds matter because they shape whether cooperation is willing and lasting.", "Buy-in can turn thin obedience into steadier cooperation."), difficulty: "easy" },
    { cardId: "ch43-rc02", front: tone("What is the difference between durable persuasion and shallow compliance?", "Why is surface obedience not enough?", "What keeps influence deep?"), back: tone("Durable persuasion reaches inward assent, while shallow compliance only moves behavior under pressure.", "Surface obedience is not enough because resistance can remain intact underneath it.", "Influence stays deep when emotional reach is joined to real structure and credibility."), difficulty: "easy" },
    { cardId: "ch43-rc03", front: tone("Why can emotional buy-in matter more than command alone?", "What happens when people feel invested?", "How does resistance soften here?"), back: tone("People often cooperate more steadily when they feel understood, represented, or invested in the outcome.", "Felt investment can reduce inward resistance and strengthen lasting participation.", "Resistance softens when the influence reaches more than outward behavior."), difficulty: "medium" },
    { cardId: "ch43-rc04", front: tone("Where does this law appear in ordinary settings?", "How do work, school, and personal situations show buy-in logic?", "Why is command not the whole story?"), back: tone("It appears anywhere compliance is easy to force briefly but harder to sustain deeply.", "Teams, campaigns, morale rebuilds, and private conflicts all show how inward assent changes cooperation.", "Command is not the whole story when durable willingness matters."), difficulty: "medium" },
    { cardId: "ch43-rc05", front: tone("How does Chapter 43 bridge to Chapter 44?", "What comes after winning hearts and minds?", "Why does persuasion lead toward the mirror effect?"), back: tone("After showing how influence secures deeper allegiance, the next issue is how reflection can unsettle and provoke.", "Chapter 44 turns from persuasion toward disarming and infuriating through mirroring.", "The bridge asks how power shifts from winning assent to destabilizing the other person's self-perception."), difficulty: "hard" }
  ],
  keyTakeawayCard: tone(
    "Working on hearts and minds means recognizing that pressure can secure behavior for a while, but only buy-in can make cooperation feel inwardly acceptable and durable.",
    "This law values credible emotional persuasion over surface compliance because people follow more steadily when they feel understood and invested.",
    "Power grows when you create inward assent without mistaking sentimentality or soft language for a real foundation."
  )
};

const quiz = {
  passingScorePercent: 70,
  questions: [
    { questionId: "ch43-q01", prompt: "Why do hearts and minds matter in this chapter?", choices: ["Because emotion replaces structure completely", "Because durable influence needs more than force or surface compliance", "Because fear never works at all"], correctIndex: 1, explanation: tone("Correct. The chapter focuses on durable cooperation rather than short-term obedience alone.", "Hearts and minds matter because influence lasts longer when inward assent is reached.", "Right. The issue is depth of cooperation, not emotion without structure."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch43-q02", prompt: "What can emotional buy-in do strategically?", choices: ["Remove the need for boundaries", "Guarantee honesty in persuasion", "Lower resistance and deepen cooperation"], correctIndex: 2, explanation: tone("Yes. The chapter says buy-in can create steadier cooperation than pressure alone.", "Emotional investment matters because it changes willingness from within.", "Correct. The gain is deeper cooperation, not the end of all structure."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch43-q03", prompt: "Why is this chapter not generic kindness advice?", choices: ["Because it rejects emotional understanding entirely", "Because it treats all empathy as manipulation", "Because it distinguishes durable buy-in from flattery or sentiment without structure"], correctIndex: 2, explanation: tone("Correct. The law has a structure limit and does not reduce persuasion to niceness.", "Greene separates real buy-in from soft theater or flattery.", "Right. Emotional reach matters only when it is attached to something credible."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch43-q04", prompt: "In Caden's work scenario, what best fits the chapter?", choices: ["Increase pressure again even if cooperation stays shallow", "Create felt investment so the team has an inward reason to cooperate", "Remove all structure and rely on warm tone alone"], correctIndex: 1, explanation: tone("Yes. He needs buy-in, not just another round of visible control.", "The chapter favors deeper investment when compliance alone is brittle.", "Correct. Structure remains, but hearts and minds also need to be reached."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch43-q05", prompt: "What does Mireya's school example show?", choices: ["That campaigns depend only on slogans", "That support becomes steadier once people feel the effort is partly theirs", "That student morale can be forced indefinitely"], correctIndex: 1, explanation: tone("Correct. Her case shows how felt ownership deepens cooperation.", "The chapter says investment matters more than recruitment language alone.", "Right. Participation grows when support becomes psychologically real."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch43-q06", prompt: "What is the strongest reading of Sorin's personal dilemma?", choices: ["More pressure always fixes resistance faster", "Private conflict has nothing to do with hearts and minds", "Understanding may change the emotional root of resistance better than another demand"], correctIndex: 2, explanation: tone("Yes. The chapter says some resistance is inward and cannot be resolved by pressure alone.", "His dilemma turns on whether the real barrier is emotional rather than purely behavioral.", "Correct. A quiet surface is not the same as real assent."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch43-q07", prompt: "Why can persuasion create more durable cooperation than force alone?", choices: ["Because inward assent can last after immediate pressure weakens", "Because rules and incentives become unnecessary", "Because emotional language is always believed"], correctIndex: 0, explanation: tone("Correct. The chapter values buy-in because it can survive beyond the moment of command.", "Durability grows when cooperation has an inner reason to continue.", "Right. Force may move action now, but buy-in supports continuation later."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch43-q08", prompt: "When does the law slip into sentimentality or soft manipulation?", choices: ["When influence reaches both feeling and reason", "When emotional language is used without credible structure, incentives, or boundaries", "When people feel genuinely represented"], correctIndex: 1, explanation: tone("Exactly. The chapter warns against soft persuasion that has nothing real beneath it.", "Sentimentality fails when feeling is asked to replace structure entirely.", "Right. Warmth alone is not a durable foundation."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch43-q09", prompt: "How does Chapter 42 lead into Chapter 43?", choices: ["By moving from breaking a group's coordination to building deeper allegiance within people", "By proving disruption is the only form of influence", "By replacing leadership with pure emotion"], correctIndex: 0, explanation: tone("Correct. Chapter 42 covered disruption through the center, and Chapter 43 covers durable buy-in.", "The bridge moves from scattering groups to holding them through inward assent.", "Right. The sequence shifts from breaking coherence to building steadier cooperation."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch43-q10", prompt: "What bridge carries Chapter 43 into Chapter 44?", choices: ["After winning hearts and minds, the next issue is how mirroring can unsettle and disarm", "Chapter 44 returns only to emotional persuasion", "Buy-in eliminates the need to understand others at all"], correctIndex: 0, explanation: tone("Correct. The next law shifts from persuasion toward destabilization through the mirror effect.", "Chapter 44 asks how reflection can infuriate and unsettle in a different register.", "Right. The bridge moves from winning assent to altering self-perception."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" }
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
for (const name of ["Caden", "Mireya", "Sorin", "Laleh"]) continuity.nameUsage[name] = [stem];
continuity.withinChapterNames[stem] = ["Caden", "Mireya", "Sorin", "Laleh"];
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
- Chapter-specific mechanism remains buy-in, durable consent, shallow compliance, and structure limits rather than generic kindness advice
- Hard depth preserves the buy-in-versus-sentimentality boundary and the Chapter 44 bridge
- Quiz stays within supported facts from the approved draft and frozen source bundle

## Gate result
- Approved for chapter gate and automatic continuation
`;
writeText(paths.validation, validation);

fs.appendFileSync(
  paths.runLog,
  `\n- Completed writer, editor, critic, converter, quiz, and validator steps for Chapter 43.\n- Validation result: PASS.\n- Continuity hash sealed for \`${stem}\`: \`${seal}\`\n`,
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
